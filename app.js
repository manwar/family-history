document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("tree-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Node dimensions (expanded width to accommodate photo + text)
  const nodeWidth = 200;
  const nodeHeight = 70;
  const photoRadius = 22; // Diameter will be 44px
  const duration = 400;

  let root;
  let idCounter = 0;

  const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  // SVG Definitions section for pattern/clipping masks
  const defs = svg.append("defs");

  // Transparent background rect to catch all pan/zoom events
  svg.append("rect")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "none")
    .attr("pointer-events", "all");

  const g = svg.append("g");

  // Zoom Setup
  const zoom = d3.zoom()
    .scaleExtent([0.3, 2.5])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Initial Center position
  const initialTransform = d3.zoomIdentity
    .translate(width / 2, 80)
    .scale(1);
  svg.call(zoom.transform, initialTransform);

  const treeLayout = d3.tree()
    .nodeSize([nodeWidth + 30, nodeHeight + 60]);

  // Load JSON Data
  d3.json("data/family.json").then(data => {
    root = d3.hierarchy(data);
    root.x0 = 0;
    root.y0 = 0;

    root.descendants().forEach(d => {
      d.id = ++idCounter;
    });

    update(root);
  }).catch(error => {
    console.error("Error loading family tree data:", error);
  });

  function update(source) {
    const treeData = treeLayout(root);
    const nodes = treeData.descendants();
    const links = treeData.links();

    nodes.forEach(d => { d.y = d.depth * (nodeHeight + 60); });

    // ---------------- DEFS (Dynamic Image Patterns) ----------------
    // Create unique image patterns for nodes with photos
    nodes.forEach(d => {
      if (d.data.photo) {
        const patternId = `avatar-pattern-${d.id}`;
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
            .attr("xlink:href", d.data.photo);
        }
      }
    });

    // ---------------- NODES ----------------
    const node = g.selectAll("g.node")
      .data(nodes, d => d.id || (d.id = ++idCounter));

    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", () => `translate(${source.x0 - nodeWidth / 2}, ${source.y0 - nodeHeight / 2})`)
      .style("cursor", d => (d.children || d._children) ? "pointer" : "default")
      .on("click", (event, d) => {
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else if (d._children) {
          d.children = d._children;
          d._children = null;
        }
        update(d);
      });

    // Base Card Rectangle
    nodeEnter.append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("rx", 10)
      .attr("ry", 10);

    // Profile Photo Container (Circle)
    nodeEnter.append("circle")
      .attr("class", "photo-circle")
      .attr("cx", photoRadius + 12)
      .attr("cy", nodeHeight / 2)
      .attr("r", photoRadius)
      .style("fill", d => d.data.photo ? `url(#avatar-pattern-${d.id})` : "#34495e")
      .style("stroke", "#3498db")
      .style("stroke-width", "2px");

    // Placeholder Icon text (if no photo is provided in JSON)
    nodeEnter.append("text")
      .attr("class", "avatar-placeholder")
      .attr("x", photoRadius + 12)
      .attr("y", (nodeHeight / 2) + 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#ffffff")
      .attr("font-size", "14px")
      .text(d => d.data.photo ? "" : "👤");

    // Member Name (Shifted right to accommodate photo)
    nodeEnter.append("text")
      .attr("class", "name")
      .attr("x", (photoRadius * 2) + 24)
      .attr("y", 30)
      .attr("text-anchor", "start")
      .text(d => d.data.name);

    // Member Dates
    nodeEnter.append("text")
      .attr("class", "dates")
      .attr("x", (photoRadius * 2) + 24)
      .attr("y", 48)
      .attr("text-anchor", "start")
      .text(d => `${d.data.born || '?'} - ${d.data.died || 'Present'}`);

    // Expand / Collapse Indicator Icon
    nodeEnter.append("text")
      .attr("class", "toggle-icon")
      .attr("x", nodeWidth - 14)
      .attr("y", (nodeHeight / 2) + 4)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#7f8c8d");

    // UPDATE: Smooth Position Transition
    const nodeUpdate = node.merge(nodeEnter).transition()
      .duration(duration)
      .attr("transform", d => `translate(${d.x - nodeWidth / 2}, ${d.y - nodeHeight / 2})`);

    node.merge(nodeEnter).select("rect")
      .style("stroke", d => d._children ? "#e74c3c" : "#2c3e50")
      .style("stroke-width", d => d._children ? "3px" : "2px");

    node.merge(nodeEnter).select(".toggle-icon")
      .text(d => {
        if (d._children) return "►";
        if (d.children && d.depth > 0) return "▼";
        return "";
      });

    // EXIT
    node.exit().transition()
      .duration(duration)
      .attr("transform", () => `translate(${source.x - nodeWidth / 2}, ${source.y - nodeHeight / 2})`)
      .remove();

    // ---------------- LINKS ----------------
    const link = g.selectAll("path.link")
      .data(links, d => d.target.id);

    const linkEnter = link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", () => {
        const o = { x: source.x0, y: source.y0 };
        return d3.linkVertical()({ source: o, target: o });
      });

    link.merge(linkEnter).transition()
      .duration(duration)
      .attr("d", d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y)
      );

    link.exit().transition()
      .duration(duration)
      .attr("d", () => {
        const o = { x: source.x, y: source.y };
        return d3.linkVertical()({ source: o, target: o });
      })
      .remove();

    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
});
