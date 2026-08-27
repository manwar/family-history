document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("tree-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  const nodeWidth = 140;
  const nodeHeight = 160;
  const photoRadius = 35;
  const duration = 400;

  let root;
  let idCounter = 0;

  const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  const defs = svg.append("defs");

  svg.append("rect")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", () => closeDrawer());

  const g = svg.append("g");

  // --- ZOOM BEHAVIOR ---
  const zoom = d3.zoom()
    .scaleExtent([0.3, 2.5])
    .on("zoom", (event) => g.attr("transform", event.transform));

  svg.call(zoom);

  const initialTransform = d3.zoomIdentity
    .translate(width / 2, 80)
    .scale(1);

  svg.call(zoom.transform, initialTransform);

  document.getElementById("zoom-in")?.addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 1.3));
  document.getElementById("zoom-out")?.addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));
  document.getElementById("zoom-reset")?.addEventListener("click", () => svg.transition().duration(500).call(zoom.transform, initialTransform));
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

  // --- RECURSIVE TRANSFORMER WITH VIRTUAL SPOUSE BRANCHES ---
  function transformMultiSpouseData(data) {
    function processNode(node) {
      const spousesList = node.spouses || (node.spouse ? [node.spouse] : []);
      let virtualChildren = [];

      if (spousesList.length > 0) {
        spousesList.forEach((sp, idx) => {
          sp.spouseId = `spouse-${++idCounter}`;
          const spouseChildren = (sp.children || []).map(child => processNode(child));

          // Create a virtual container for each spouse branch so d3.tree calculates independent X bounds
          virtualChildren.push({
            isVirtualSpouseBranch: true,
            spouseData: sp,
            spouseIdx: idx,
            totalSpouses: spousesList.length,
            children: spouseChildren.length > 0 ? spouseChildren : null
          });
        });
      } else if (node.children) {
        virtualChildren = node.children.map(child => processNode(child));
      }

      node.spousesList = spousesList;
      node.children = virtualChildren.length > 0 ? virtualChildren : null;
      return node;
    }
    return processNode(data);
  }

  function drawPersonCard(containerGroup, personData, offsetX, offsetY) {
    const cardGroup = containerGroup.append("g")
      .attr("class", "person-card")
      .attr("transform", `translate(${offsetX}, ${offsetY})`)
      .style("cursor", "pointer")
      .on("click", (event) => {
        event.stopPropagation();
        openDrawer(personData);
      });

    cardGroup.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", photoRadius)
      .style("fill", (personData.photo && personData.photo !== "assets/photos/placeholder.jpg") ? `url(#avatar-pattern-${personData.id || personData.spouseId})` : "#e2e8f0")
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

  function getSpouseXOffset(spousesCount, spouseIdx, spacing = nodeWidth + 30) {
    if (spousesCount <= 0 || spouseIdx === undefined) return 0;
    const startX = -((spousesCount - 1) * spacing) / 2;
    return startX + spouseIdx * spacing;
  }

  const treeLayout = d3.tree()
    .nodeSize([nodeWidth * 1.6, nodeHeight * 1.8]);

  // --- LOAD DATA ---
  d3.json("data/family.json").then(rawData => {
    const preparedData = transformMultiSpouseData(rawData);
    root = d3.hierarchy(preparedData);
    root.x0 = 0;
    root.y0 = 0;

    root.descendants().forEach(d => { d.id = ++idCounter; });

    update(root);
  }).catch(error => {
    console.error("Error loading family tree data:", error);
  });

  // --- UPDATE TREE ---
  function update(source) {
    const treeData = treeLayout(root);

    // Filter out virtual nodes from visual rendering but keep hierarchy coords
    const allDescendants = treeData.descendants();
    const realNodes = allDescendants.filter(d => !d.data.isVirtualSpouseBranch);

    const spouseOffsetY = photoRadius + 110;

    realNodes.forEach(d => {
      d.y = d.depth * 220;
    });

    // Register image patterns
    realNodes.forEach(d => {
      const createPattern = (id, photo) => {
        if (photo && photo !== "assets/photos/placeholder.jpg") {
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
              .attr("xlink:href", photo);
          }
        }
      };

      createPattern(d.id, d.data.photo);
      (d.data.spousesList || []).forEach(sp => createPattern(sp.spouseId, sp.photo));
    });

    const node = g.selectAll("g.node")
      .data(realNodes, d => d.id || (d.id = ++idCounter));

    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", () => `translate(${source.x0}, ${source.y0})`);

    nodeEnter.each(function(d) {
      const nodeGroup = d3.select(this);

      // Primary Person
      drawPersonCard(nodeGroup, d.data, 0, 0);

      // Render Spouses
      const spouses = d.data.spousesList || [];
      const totalSpouses = spouses.length;

      if (totalSpouses > 0) {
        spouses.forEach((spouse, idx) => {
          const spouseX = getSpouseXOffset(totalSpouses, idx);

          // Connection line to spouse
          nodeGroup.append("line")
            .attr("x1", 0)
            .attr("y1", photoRadius + 20)
            .attr("x2", spouseX)
            .attr("y2", spouseOffsetY - photoRadius - 6)
            .attr("stroke", "#cbd5e0")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "3 3");

          // SPOUSE indicator
          nodeGroup.append("text")
            .attr("x", spouseX)
            .attr("y", spouseOffsetY - photoRadius - 16)
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .style("font-style", "italic")
            .style("fill", "#718096")
            .text("SPOUSE ❤️");

          drawPersonCard(nodeGroup, spouse, spouseX, spouseOffsetY);

          if (spouse.children && spouse.children.length > 0) {
            nodeGroup.append("text")
              .attr("x", spouseX)
              .attr("y", spouseOffsetY + photoRadius + 32)
              .attr("text-anchor", "middle")
              .style("font-size", "10px")
              .style("font-style", "italic")
              .style("fill", "#718096")
              .text("CHILDREN");
          }
        });
      }
    });

    node.merge(nodeEnter).transition()
      .duration(duration)
      .attr("transform", d => `translate(${d.x}, ${d.y})`);

    node.exit().transition()
      .duration(duration)
      .attr("transform", () => `translate(${source.x}, ${source.y})`)
      .remove();

    // --- ACCURATE PER-SPOUSE LINK CONNECTIONS ---
    const linkData = [];

    allDescendants.forEach(d => {
      if (d.data.isVirtualSpouseBranch && d.children) {
        const parentNode = d.parent;
        const spouseData = d.data.spouseData;
        const spouseIdx = d.data.spouseIdx;
        const totalSpouses = d.data.totalSpouses;

        const spouseX = parentNode.x + getSpouseXOffset(totalSpouses, spouseIdx);
        const spouseY = parentNode.y + spouseOffsetY;

        const startX = spouseX;
        const startY = spouseY + photoRadius + 45;
        const midY = startY + 20;

        const childrenX = d.children.map(c => c.x);
        const minX = Math.min(...childrenX);
        const maxX = Math.max(...childrenX);

        d.children.forEach(child => {
          linkData.push({
            id: `${spouseData.spouseId}-${child.id}`,
            startX,
            startY,
            midY,
            minX,
            maxX,
            targetX: child.x,
            targetY: child.y - photoRadius
          });
        });
      }
    });

    const link = g.selectAll("path.link")
      .data(linkData, d => d.id);

    const linkEnter = link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", d => `M ${d.startX} ${d.startY} V ${d.startY} H ${d.targetX} V ${d.targetY}`);

    link.merge(linkEnter).transition()
      .duration(duration)
      .attr("d", d => {
        return `M ${d.startX} ${d.startY} V ${d.midY} M ${d.minX} ${d.midY} H ${d.maxX} M ${d.targetX} ${d.midY} V ${d.targetY}`;
      });

    link.exit().transition()
      .duration(duration)
      .attr("d", d => `M ${d.startX} ${d.startY} V ${d.startY} H ${d.targetX} V ${d.targetY}`)
      .remove();

    realNodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
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
