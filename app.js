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

  // Helper to center the tree horizontally relative to container width
  function centerTree(transitionDuration = 0) {
    if (!rootData) return;

    const treeWidth = rootData._subtreeWidth || 0;

    // Detect mobile viewport to calculate initial scale and offsets accurately
    const currentContainerWidth = container.clientWidth || width;
    const isMobile = currentContainerWidth <= 600;
    const initialScale = isMobile ? 0.65 : 1.0;

    const x = (currentContainerWidth / 2) - (treeWidth * initialScale / 2);
    const y = isMobile ? 40 : 80;

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
        li.style.padding = "8px 12px";
        li.style.cursor = "pointer";
        li.textContent = match.data.name;
        li.addEventListener("click", () => {
          focusOnNode(match);
          // Hide and clear results completely
          searchResults.classList.add("hidden");
          searchResults.innerHTML = "";
          searchInput.value = match.data.name;
        });
        searchResults.appendChild(li);
      });
    });

    document.addEventListener("click", (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add("hidden");
        searchResults.innerHTML = "";
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

    // Ensure rendering dimensions calculate correctly before auto-centering
    requestAnimationFrame(() => {
      centerTree(0);
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
