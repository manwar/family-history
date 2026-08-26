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

  // Background rect to handle zoom/pan and close drawer when clicking empty space
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
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

  const initialTransform = d3.zoomIdentity
    .translate(width / 2, 80)
    .scale(1);

  svg.call(zoom.transform, initialTransform);

  // --- ZOOM BUTTON CONTROLS ---
  document.getElementById("zoom-in")?.addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.3);
  });

  document.getElementById("zoom-out")?.addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.7);
  });

  document.getElementById("zoom-reset")?.addEventListener("click", () => {
    svg.transition().duration(500).call(zoom.transform, initialTransform);
  });

  // --- EXPORT EVENT LISTENERS ---
  document.getElementById("export-svg")?.addEventListener("click", exportSVG);
  document.getElementById("export-png")?.addEventListener("click", exportPNG);

  // --- DRAWER CLOSE BUTTON ---
  document.getElementById("close-drawer")?.addEventListener("click", () => closeDrawer());

  function closeDrawer() {
    const drawer = document.getElementById("detail-drawer");
    if (drawer) drawer.classList.add("hidden");
  }

  function openDrawer(personData) {
    const drawer = document.getElementById("detail-drawer");
    const photoEl = document.getElementById("drawer-photo");
    const nameEl = document.getElementById("drawer-name");
    const datesEl = document.getElementById("drawer-dates");
    const bioEl = document.getElementById("drawer-bio");

    if (!drawer) return;

    nameEl.textContent = personData.name || "Unknown";
    datesEl.textContent = personData.born ? `${personData.born} – ${personData.died || 'Present'}` : '';

    if (personData.photo && personData.photo !== "assets/photos/placeholder.jpg") {
      photoEl.src = personData.photo;
      photoEl.style.display = "block";
    } else {
      photoEl.style.display = "none";
    }

    let bioContent = "";
    if (personData.birthplace) bioContent += `<p><strong>Birthplace:</strong> ${personData.birthplace}</p>`;
    if (personData.occupation) bioContent += `<p><strong>Occupation:</strong> ${personData.occupation}</p>`;
    if (personData.bio) {
      bioContent += `<p style="margin-top: 10px;">${personData.bio}</p>`;
    } else if (!personData.birthplace && !personData.occupation) {
      bioContent = "<p>No detailed biography available for this family member.</p>";
    }

    if (personData.documents && personData.documents.length > 0) {
      bioContent += `<hr><h4 style="margin: 12px 0 6px 0;">Historical Records</h4><ul style="padding-left: 18px;">`;
      personData.documents.forEach(doc => {
        bioContent += `<li><a href="${doc.url}" target="_blank" rel="noopener">${doc.title}</a></li>`;
      });
      bioContent += `</ul>`;
    }

    bioEl.innerHTML = bioContent;
    drawer.classList.remove("hidden");
  }

  const treeLayout = d3.tree()
    .nodeSize([nodeWidth + 60, nodeHeight * 2.8]);

  // Helper to draw an individual card (avatar + name)
  function drawPersonCard(containerGroup, personData, offsetY) {
    const cardGroup = containerGroup.append("g")
      .attr("class", "person-card")
      .attr("transform", `translate(0, ${offsetY})`)
      .style("cursor", "pointer")
      .on("click", (event) => {
        event.stopPropagation();
        openDrawer(personData);
      });

    // Outer ring / avatar circle
    cardGroup.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", photoRadius)
      .style("fill", (personData.photo && personData.photo !== "assets/photos/placeholder.jpg") ? `url(#avatar-pattern-${personData.id || personData.spouseId})` : "#e2e8f0")
      .style("stroke", "#ffffff")
      .style("stroke-width", "3px");

    // Placeholder Icon if no photo
    cardGroup.append("text")
      .attr("class", "avatar-placeholder")
      .attr("x", 0)
      .attr("y", 8)
      .attr("text-anchor", "middle")
      .attr("fill", "#a0aec0")
      .attr("font-size", "32px")
      .text((personData.photo && personData.photo !== "assets/photos/placeholder.jpg") ? "" : "👤");

    // Name text underneath avatar with added margin to avoid collisions
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

  // --- LOAD DATA ---
  d3.json("data/family.json").then(data => {
    root = d3.hierarchy(data);
    root.x0 = 0;
    root.y0 = 0;

    root.descendants().forEach(d => {
      d.id = ++idCounter;
      if (d.data.spouse) {
        d.data.spouse.spouseId = `spouse-${d.id}`;
      }
    });

    update(root);
    setupSearch();
  }).catch(error => {
    console.error("Error loading family tree data:", error);
  });

  // --- UPDATE TREE ---
  function update(source) {
    const treeData = treeLayout(root);
    const nodes = treeData.descendants();
    const links = treeData.links();

    // Adjust vertical depth spacing dynamically to fit spouse structures
    nodes.forEach(d => {
      d.y = d.depth * 320;
    });

    // Register image patterns
    nodes.forEach(d => {
      const createPattern = (id, photo) => {
        if (photo && photo !== "assets/photos/placeholder.jpg") {
          const patternId = `avatar-pattern-${id}`;
          let pattern = defs.select(`#${patternId}`);

          if (pattern.empty()) {
            pattern = defs.append("pattern")
              .attr("id", patternId)
              .attr("height", 1)
              .attr("width", 1)
              .attr("x", "0")
              .attr("y", "0");

            pattern.append("image")
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
      if (d.data.spouse) {
        createPattern(d.data.spouse.spouseId, d.data.spouse.photo);
      }
    });

    // Nodes binding
    const node = g.selectAll("g.node")
      .data(nodes, d => d.id || (d.id = ++idCounter));

    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", () => `translate(${source.x0}, ${source.y0})`);

    // Render nodes with corrected non-overlapping layout
    nodeEnter.each(function(d) {
      const nodeGroup = d3.select(this);

      // 1. Primary Person Card
      drawPersonCard(nodeGroup, d.data, 0);

      // 2. Spouse Stacking & Connection Line
      if (d.data.spouse) {
        // Increased offset to push the spouse card completely past the primary person's name text
        const spouseOffsetY = photoRadius + 110;

        // Vertical dashed connection line between primary avatar and spouse avatar
        nodeGroup.append("line")
          .attr("x1", 0)
          .attr("y1", photoRadius + 24)
          .attr("x2", 0)
          .attr("y2", spouseOffsetY - photoRadius - 6)
          .attr("stroke", "#cbd5e0")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "3 3");

        // SPOUSE label positioned clearly along the connection line
        nodeGroup.append("text")
          .attr("x", 0)
          .attr("y", photoRadius + 42)
          .attr("text-anchor", "middle")
          .style("font-size", "10px")
          .style("font-style", "italic")
          .style("fill", "#718096")
          .text("SPOUSE");

        // Small Heart Icon
        nodeGroup.append("text")
          .attr("x", 0)
          .attr("y", photoRadius + 56)
          .attr("text-anchor", "middle")
          .style("font-size", "10px")
          .style("fill", "#e53e3e")
          .text("❤️");

        // Draw Spouse Card below
        drawPersonCard(nodeGroup, d.data.spouse, spouseOffsetY);

        // CHILDREN label if children exist
        if (d.children || d._children) {
          nodeGroup.append("text")
            .attr("x", 0)
            .attr("y", spouseOffsetY + photoRadius + 42)
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .style("font-style", "italic")
            .style("fill", "#718096")
            .text("CHILDREN");
        }
      } else if (d.children || d._children) {
        // CHILDREN label for single parents
        nodeGroup.append("text")
          .attr("x", 0)
          .attr("y", photoRadius + 42)
          .attr("text-anchor", "middle")
          .style("font-size", "10px")
          .style("font-style", "italic")
          .style("fill", "#718096")
          .text("CHILDREN");
      }
    });

    // Transitions
    const nodeUpdate = node.merge(nodeEnter).transition()
      .duration(duration)
      .attr("transform", d => `translate(${d.x}, ${d.y})`);

    node.exit().transition()
      .duration(duration)
      .attr("transform", () => `translate(${source.x}, ${source.y})`)
      .remove();

    // Links calculation with offset taking spouse height into account
    const link = g.selectAll("path.link")
      .data(links, d => d.target.id);

    const getLinkSourceY = (d) => {
      if (d.source.data.spouse) {
        return d.source.y + photoRadius + 155;
      }
      return d.source.y + photoRadius + 50;
    };

    const linkEnter = link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", () => {
        const sy = getLinkSourceY({ source: source });
        return `M ${source.x0} ${sy} V ${source.y0} H ${source.x0} V ${source.y0}`;
      });

    link.merge(linkEnter).transition()
      .duration(duration)
      .attr("d", d => {
        const sy = getLinkSourceY(d);
        const ty = d.target.y - photoRadius - 10;
        const midY = sy + (ty - sy) / 2;
        return `M ${d.source.x} ${sy} V ${midY} H ${d.target.x} V ${ty}`;
      });

    link.exit().transition()
      .duration(duration)
      .attr("d", () => {
        const sy = getLinkSourceY({ source: source });
        return `M ${source.x} ${sy} V ${source.y} H ${source.x} V ${source.y}`;
      })
      .remove();

    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // --- SEARCH ---
  function setupSearch() {
    const searchInput = document.getElementById("node-search");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      const nodes = root.descendants();

      nodes.forEach(d => {
        const matchPrimary = d.data.name.toLowerCase().includes(searchTerm);
        const matchSpouse = d.data.spouse && d.data.spouse.name.toLowerCase().includes(searchTerm);

        if (searchTerm !== "" && (matchPrimary || matchSpouse)) {
          d.highlighted = true;
          const transform = d3.zoomIdentity
            .translate(width / 2 - d.x, height / 2 - d.y)
            .scale(1.2);
          svg.transition().duration(500).call(zoom.transform, transform);
        } else {
          d.highlighted = false;
        }
      });

      update(root);
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
