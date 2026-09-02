document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("tree-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  const cardWidth = 140;
  const photoRadius = 35;
  const spouseGap = 200;
  const siblingGap = 160;
  const levelGap = 260;
  const duration = 400;

  let rootData;
  let idCounter = 0;
  let allNodesData = [];

  const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  // Keep the floating zoom controls above mobile browser chrome (Safari's
  // collapsible bottom toolbar, the on-screen keyboard). CSS
  // `position: fixed; bottom: 24px` alone isn't reliable for this: several
  // mobile browsers anchor fixed elements to a viewport that doesn't
  // shrink for keyboard/toolbar changes, so the controls can end up
  // rendered behind that chrome instead of above it.
  //
  // This anchors the controls directly to the REAL bottom edge of the
  // currently-visible area (visualViewport.offsetTop + visualViewport.height),
  // switching from `bottom` to an explicit `top` -- deliberately not
  // comparing against window.innerHeight (an earlier version of this fix
  // did), since window.innerHeight is known to shrink alongside the
  // visual viewport on some iOS Safari versions, which would make that
  // comparison always evaluate to ~0 and silently no-op the whole fix.
  //
  // Also disables native pinch-zoom of the page (see the viewport meta tag
  // in index.html): a native browser pinch/pan shifts the visible slice of
  // the page independently of this calculation and was the root cause of
  // the controls ending up positioned outside the visible area after a
  // search-select, in a way that didn't resolve on its own over time.
  (function initZoomControlsViewportOffset() {
    const zoomControls = document.querySelector(".zoom-controls");
    if (!zoomControls || !window.visualViewport) return;

    const gap = 24; // desired gap above the visible bottom edge
    let settleTimer1 = null;
    let settleTimer2 = null;

    function applyOffset() {
      const vv = window.visualViewport;
      const controlsHeight = zoomControls.offsetHeight || 150;
      const visibleBottomEdge = vv.offsetTop + vv.height;
      const top = visibleBottomEdge - controlsHeight - gap;

      zoomControls.style.setProperty("position", "fixed", "important");
      zoomControls.style.setProperty("top", `${top}px`, "important");
      zoomControls.style.setProperty("bottom", "auto", "important");
    }

    function updateOffset() {
      // Immediate, optimistic update for responsiveness.
      applyOffset();

      // iOS animates browser-chrome/keyboard transitions over several
      // hundred ms and can fire 'resize'/'scroll' mid-transition, so a
      // position computed from the very first event in a burst may be
      // based on a viewport size that hasn't settled yet. Re-run using a
      // fresh reading shortly after the last event in the burst, and once
      // more a bit later to catch slower transitions.
      clearTimeout(settleTimer1);
      clearTimeout(settleTimer2);
      settleTimer1 = setTimeout(applyOffset, 180);
      settleTimer2 = setTimeout(applyOffset, 500);
    }

    window.visualViewport.addEventListener("resize", updateOffset);
    window.visualViewport.addEventListener("scroll", updateOffset);
    window.addEventListener("orientationchange", updateOffset);
    requestAnimationFrame(updateOffset);
  })();

  const defs = svg.append("defs");

  // Highlight Drop-shadow Filter
  const filter = defs.append("filter")
    .attr("id", "glow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");
  filter.append("feGaussianBlur")
    .attr("stdDeviation", "6")
    .attr("result", "coloredBlur");
  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  svg.append("rect")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", () => {
      closeDrawer();
      clearHighlights();
    });

  const g = svg.append("g");

  // --- ZOOM BEHAVIOR ---
  const zoom = d3.zoom()
    .scaleExtent([0.15, 2.5])
    .on("zoom", (event) => g.attr("transform", event.transform));

  svg.call(zoom);

  // Helper to center the tree dynamically based on actual SVG rendered bounds
  function centerTree(transitionDuration = 0) {
    if (!rootData) return;

    // Force recalculation of live container measurements
    const svgNode = svg.node();
    const rect = svgNode ? svgNode.getBoundingClientRect() : null;
    const currentWidth = rect && rect.width ? rect.width : (container.clientWidth || width);
    const isMobile = currentWidth <= 600;

    // Retrieve exact tree group SVG element bounding dimensions
    const gNode = g.node();
    if (!gNode) return;
    const gBounds = gNode.getBBox();
    if (gBounds.width === 0 || gBounds.height === 0) return;

    // Initial scale selection based on device viewport
    const initialScale = isMobile ? 0.65 : 1.0;

    // Calculate center coordinates directly using live bounding dimensions
    const x = (currentWidth / 2) - (gBounds.x + gBounds.width / 2) * initialScale;
    const y = isMobile ? 30 : 60;

    const transform = d3.zoomIdentity
      .translate(x, y)
      .scale(initialScale);

    if (transitionDuration > 0) {
      svg.transition().duration(transitionDuration).call(zoom.transform, transform);
    } else {
      svg.call(zoom.transform, transform);
    }
  }

  document.getElementById("zoom-in")?.addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 1.3));
  document.getElementById("zoom-out")?.addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));
  document.getElementById("zoom-reset")?.addEventListener("click", () => {
    clearHighlights();
    centerTree(500);
  });
  document.getElementById("export-svg")?.addEventListener("click", exportSVG);
  document.getElementById("export-png")?.addEventListener("click", exportPNG);
  document.getElementById("close-drawer")?.addEventListener("click", () => closeDrawer());

  function closeDrawer() {
    const drawer = document.getElementById("detail-drawer");
    if (drawer) drawer.classList.add("hidden");
  }

  function openDrawer(personData) {
    const drawer = document.getElementById("detail-drawer");
    if (!drawer) return;

    document.getElementById("drawer-name").textContent = personData.name || "Unknown";
    document.getElementById("drawer-dates").textContent = personData.born ? `${personData.born} – ${personData.died || 'Present'}` : '';

    const photoEl = document.getElementById("drawer-photo");
    if (personData.photo && personData.photo !== "assets/photos/placeholder.jpg") {
      photoEl.src = personData.photo;
      photoEl.style.display = "block";
    } else {
      photoEl.style.display = "none";
    }

    let bioContent = "";
    if (personData.birthplace) bioContent += `<p><strong>Birthplace:</strong> ${personData.birthplace}</p>`;
    if (personData.occupation) bioContent += `<p><strong>Occupation:</strong> ${personData.occupation}</p>`;
    if (personData.bio) bioContent += `<p style="margin-top: 10px;">${personData.bio}</p>`;

    document.getElementById("drawer-bio").innerHTML = bioContent || "<p>No detailed biography available.</p>";
    drawer.classList.remove("hidden");
  }

  // --- RECURSIVE DATA PREPARATION ---
  function prepareData(node) {
    node.id = node.id || ++idCounter;
    node.spousesList = node.spouses || (node.spouse ? [node.spouse] : []);

    node.spouseBranches = [];

    node.spousesList.forEach((sp, idx) => {
      sp.spouseId = sp.spouseId || `spouse-${++idCounter}`;
      const children = (sp.children || []).map(child => prepareData(child));
      node.spouseBranches.push({
        spouse: sp,
        spouseIdx: idx,
        children: children
      });
    });

    return node;
  }

  // --- BOUNDING-BOX LAYOUT ENGINE ---
  function computeSubtreeBounds(node) {
    if (!node.spouseBranches || node.spouseBranches.length === 0) {
      node._subtreeWidth = cardWidth;
      return cardWidth;
    }

    let totalBranchesWidth = 0;

    node.spouseBranches.forEach(branch => {
      let childrenTotalWidth = 0;
      if (branch.children && branch.children.length > 0) {
        branch.children.forEach(child => {
          childrenTotalWidth += computeSubtreeBounds(child);
        });
        childrenTotalWidth += (branch.children.length - 1) * siblingGap;
      } else {
        childrenTotalWidth = cardWidth;
      }

      branch._width = Math.max(cardWidth, childrenTotalWidth);
      totalBranchesWidth += branch._width;
    });

    totalBranchesWidth += (node.spouseBranches.length - 1) * spouseGap;
    node._subtreeWidth = Math.max(cardWidth, totalBranchesWidth);
    return node._subtreeWidth;
  }

  function layoutNode(node, leftX, y) {
    node.y = y;

    if (!node.spouseBranches || node.spouseBranches.length === 0) {
      node.x = leftX + node._subtreeWidth / 2;
      return;
    }

    const primaryCenter = leftX + node._subtreeWidth / 2;
    node.x = primaryCenter;

    let currentBranchLeft = leftX;

    node.spouseBranches.forEach((branch) => {
      const branchCenter = currentBranchLeft + branch._width / 2;
      const spouseY = y + photoRadius + 90;

      branch.spouse.x = branchCenter;
      branch.spouse.y = spouseY;

      if (branch.children && branch.children.length > 0) {
        let currentChildLeft = currentBranchLeft;
        branch.children.forEach(child => {
          layoutNode(child, currentChildLeft, y + levelGap);
          currentChildLeft += child._subtreeWidth + siblingGap;
        });
      }

      currentBranchLeft += branch._width + spouseGap;
    });
  }

  function drawPersonCard(containerGroup, personData, x, y) {
    const cardId = personData.id || personData.spouseId;
    const cardGroup = containerGroup.append("g")
      .attr("class", "person-card")
      .attr("id", `card-${cardId}`)
      .attr("transform", `translate(${x}, ${y})`)
      .style("cursor", "pointer")
      .on("click", (event) => {
        event.stopPropagation();
        openDrawer(personData);
      });

    cardGroup.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", photoRadius)
      .style("fill", (personData.photo && personData.photo !== "assets/photos/placeholder.jpg") ? `url(#avatar-pattern-${cardId})` : "#e2e8f0")
      .style("stroke", "#ffffff")
      .style("stroke-width", "3px");

    cardGroup.append("text")
      .attr("class", "avatar-placeholder")
      .attr("x", 0)
      .attr("y", 8)
      .attr("text-anchor", "middle")
      .attr("fill", "#a0aec0")
      .attr("font-size", "32px")
      .text((personData.photo && personData.photo !== "assets/photos/placeholder.jpg") ? "" : "👤");

    cardGroup.append("text")
      .attr("class", "name")
      .attr("x", 0)
      .attr("y", photoRadius + 18)
      .attr("text-anchor", "middle")
      .style("font-weight", "600")
      .style("font-size", "14px")
      .style("fill", "#2d3748")
      .text(personData.name);

    return cardGroup;
  }

  // --- SEARCH ENGINE & HIGHLIGHTING ---
  function setupSearch() {
    const searchInput = document.getElementById("node-search");
    const searchResults = document.getElementById("search-results");

    if (!searchInput || !searchResults) return;

    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      searchResults.innerHTML = "";

      if (!query) {
        searchResults.classList.add("hidden");
        clearHighlights();
        return;
      }

      const matches = allNodesData.filter(n =>
        n.data.name && n.data.name.toLowerCase().includes(query)
      );

      if (matches.length === 0) {
        searchResults.classList.add("hidden");
        return;
      }

      searchResults.classList.remove("hidden");
      matches.forEach(match => {
        const li = document.createElement("li");
        li.className = "search-result-item";
        li.textContent = match.data.name;
        li.addEventListener("click", () => {
          focusOnNode(match);
          // Hide and clear results completely
          searchResults.classList.add("hidden");
          searchResults.innerHTML = "";
          searchInput.value = match.data.name;
          // Dismiss the on-screen keyboard on mobile: position:fixed
          // elements (the zoom controls) can end up hidden behind/under
          // it while it's open, since fixed positioning tracks the
          // layout viewport rather than the visually-shrunk one on most
          // mobile browsers.
          searchInput.blur();
        });
        searchResults.appendChild(li);
      });
    });

    document.addEventListener("click", (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add("hidden");
        searchResults.innerHTML = "";
        searchInput.blur();
      }
    });
  }

  function focusOnNode(node) {
    clearHighlights();

    const targetId = node.data.id || node.data.spouseId;
    const card = g.select(`#card-${targetId}`);

    if (!card.empty()) {
      // Highlight circle border with color and glow
      card.select("circle")
        .transition()
        .duration(300)
        .style("stroke", "#ff5722")
        .style("stroke-width", "6px")
        .attr("filter", "url(#glow)");

      // Highlight text color
      card.select("text.name")
        .transition()
        .duration(300)
        .style("fill", "#ff5722")
        .style("font-weight", "800");
    }

    // Target center coordinates
    const scale = 1.2;
    const currentWidth = container.clientWidth || width;
    const currentHeight = container.clientHeight || height;
    const targetX = -node.x * scale + currentWidth / 2;
    const targetY = -node.y * scale + currentHeight / 3;

    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity.translate(targetX, targetY).scale(scale));
  }

  function clearHighlights() {
    g.selectAll(".person-card circle")
      .style("stroke", "#ffffff")
      .style("stroke-width", "3px")
      .attr("filter", null);

    g.selectAll(".person-card text.name")
      .style("fill", "#2d3748")
      .style("font-weight", "600");
  }

  // --- RENDER ---
  d3.json("data/family.json").then(rawData => {
    rootData = prepareData(rawData);
    computeSubtreeBounds(rootData);
    layoutNode(rootData, 0, 0);

    renderTree();
    setupSearch();

    // Double-frame delay ensures SVG elements are drawn before measuring bounding boxes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        centerTree(0);
      });
    });
  }).catch(error => {
    console.error("Error loading family tree data:", error);
  });

  function renderTree() {
    g.selectAll("*").remove();

    const allNodes = [];
    const spouseConnections = [];
    const spouseBranchGroups = [];

    function collect(node) {
      allNodes.push({ data: node, x: node.x, y: node.y, type: 'primary' });

      (node.spouseBranches || []).forEach(branch => {
        const sp = branch.spouse;
        allNodes.push({ data: sp, x: sp.x, y: sp.y, type: 'spouse' });

        spouseConnections.push({
          x1: node.x,
          y1: node.y + photoRadius,
          x2: sp.x,
          y2: sp.y - photoRadius,
          labelX: (node.x + sp.x) / 2,
          labelY: (node.y + photoRadius + sp.y - photoRadius) / 2
        });

        if (branch.children && branch.children.length > 0) {
          spouseBranchGroups.push({
            motherX: sp.x,
            motherY: sp.y,
            children: branch.children
          });

          branch.children.forEach(child => collect(child));
        }
      });
    }

    collect(rootData);
    allNodesData = allNodes;

    // Register Patterns
    allNodes.forEach(n => {
      const p = n.data;
      const id = p.id || p.spouseId;
      if (p.photo && p.photo !== "assets/photos/placeholder.jpg") {
        const patternId = `avatar-pattern-${id}`;
        if (defs.select(`#${patternId}`).empty()) {
          defs.append("pattern")
            .attr("id", patternId)
            .attr("height", 1)
            .attr("width", 1)
            .append("image")
            .attr("x", 0)
            .attr("y", 0)
            .attr("height", photoRadius * 2)
            .attr("width", photoRadius * 2)
            .attr("preserveAspectRatio", "xMidYMid slice")
            .attr("xlink:href", p.photo);
        }
      }
    });

    // 1. Draw Marriage Lines
    spouseConnections.forEach(conn => {
      g.append("line")
        .attr("x1", conn.x1)
        .attr("y1", conn.y1)
        .attr("x2", conn.x2)
        .attr("y2", conn.y2)
        .attr("stroke", "#cbd5e0")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "3 3");

      g.append("text")
        .attr("x", conn.labelX)
        .attr("y", conn.labelY)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-style", "italic")
        .style("fill", "#718096")
        .text("SPOUSE ❤️");
    });

    // 2. Draw Separate Child Trees Per Mother (Exact top attachment)
    spouseBranchGroups.forEach(group => {
      const startX = group.motherX;
      const startY = group.motherY + photoRadius + 45;
      const midY = startY + 25;

      const childrenX = group.children.map(c => c.x);
      const minX = Math.min(...childrenX);
      const maxX = Math.max(...childrenX);

      // Line straight down from mother
      g.append("path")
        .attr("class", "link")
        .attr("d", `M ${startX} ${startY} V ${midY}`)
        .attr("fill", "none")
        .attr("stroke", "#cbd5e0")
        .attr("stroke-width", 2);

      // Horizontal line covering ONLY her children
      g.append("path")
        .attr("class", "link")
        .attr("d", `M ${minX} ${midY} H ${maxX}`)
        .attr("fill", "none")
        .attr("stroke", "#cbd5e0")
        .attr("stroke-width", 2);

      // Vertical line stopping precisely at circle boundary
      group.children.forEach(child => {
        g.append("path")
          .attr("class", "link")
          .attr("d", `M ${child.x} ${midY} V ${child.y - photoRadius}`)
          .attr("fill", "none")
          .attr("stroke", "#cbd5e0")
          .attr("stroke-width", 2);
      });
    });

    // 3. Draw Person Cards
    allNodes.forEach(n => {
      drawPersonCard(g, n.data, n.x, n.y);
    });
  }
});

// --- EXPORT FUNCTIONS ---
function getSvgWithStyles() {
  const container = document.getElementById("tree-container");
  const svgEl = container ? container.querySelector("svg") : null;
  if (!svgEl) return null;

  const svgClone = svgEl.cloneNode(true);
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .node circle { fill: #e2e8f0 !important; stroke: #ffffff !important; stroke-width: 3px !important; }
    .node text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
    .node text.name { font-weight: 600 !important; font-size: 14px !important; fill: #2d3748 !important; }
    .node text.avatar-placeholder { fill: #a0aec0 !important; }
    path.link { fill: none !important; stroke: #cbd5e0 !important; stroke-width: 2px !important; }
  `;
  svgClone.insertBefore(styleEl, svgClone.firstChild);

  const width = container.clientWidth || 1000;
  const height = container.clientHeight || 800;

  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgClone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  svgClone.setAttribute("width", width);
  svgClone.setAttribute("height", height);
  svgClone.setAttribute("viewBox", `0 0 ${width} ${height}`);

  return {
    xml: new XMLSerializer().serializeToString(svgClone),
    width,
    height
  };
}

function exportSVG() {
  const svgData = getSvgWithStyles();
  if (!svgData) return;

  const svgBlob = new Blob([svgData.xml], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = "family_tree.svg";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(svgUrl);
}

function exportPNG() {
  const svgData = getSvgWithStyles();
  if (!svgData) return;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();

  canvas.width = svgData.width * 2;
  canvas.height = svgData.height * 2;

  const svgBlob = new Blob([svgData.xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, svgData.width, svgData.height);

    ctx.drawImage(img, 0, 0);

    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = "family_tree.png";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  img.src = url;
}
