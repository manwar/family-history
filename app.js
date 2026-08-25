document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("tree-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  const nodeWidth = 160;
  const nodeHeight = 60;
  const duration = 400; // Animation duration in ms

  let root;
  let idCounter = 0;

  // Append SVG
  const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  // Transparent background rect to capture all zoom/drag events
  svg.append("rect")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "none")
    .attr("pointer-events", "all");

  const g = svg.append("g");

  // Configure Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.3, 2.5])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Initial centering
  const initialTransform = d3.zoomIdentity
    .translate(width / 2, 80)
    .scale(1);
  svg.call(zoom.transform, initialTransform);

  const treeLayout = d3.tree()
    .nodeSize([nodeWidth + 40, nodeHeight + 60]);

  // Fetch JSON data
  d3.json("data/family.json").then(data => {
    root = d3.hierarchy(data);
    root.x0 = 0;
    root.y0 = 0;

    // Helper to assign sequential unique IDs to nodes
    root.descendants().forEach(d => {
      d.id = ++idCounter;
    });

    // Render tree initially
    update(root);
  }).catch(error => {
    console.error("Error loading family tree data:", error);
  });

  // Main update function for interactive expand/collapse
  function update(source) {
    const treeData = treeLayout(root);
    const nodes = treeData.descendants();
    const links = treeData.links();

    // Set fixed depth spacing between generations
    nodes.forEach(d => { d.y = d.depth * (nodeHeight + 60); });

    // ---------------- NODES ----------------
    const node = g.selectAll("g.node")
      .data(nodes, d => d.id || (d.id = ++idCounter));

    // Enter new nodes at parent's previous position
    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", () => `translate(${source.x0 - nodeWidth / 2}, ${source.y0 - nodeHeight / 2})`)
      .style("cursor", d => (d.children || d._children) ? "pointer" : "default")
      .on("click", (event, d) => {
        // Toggle children on click
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else if (d._children) {
          d.children = d._children;
          d._children = null;
        }
        update(d);
      });

    // Node rectangle
    nodeEnter.append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight);

    // Member Name
    nodeEnter.append("text")
      .attr("class", "name")
      .attr("x", nodeWidth / 2)
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .text(d => d.data.name);

    // Member Dates
    nodeEnter.append("text")
      .attr("class", "dates")
      .attr("x", nodeWidth / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .text(d => `${d.data.born || '?'} - ${d.data.died || 'Present'}`);

    // Indicator (+ / -) for expandable nodes
    nodeEnter.append("text")
      .attr("class", "toggle-icon")
      .attr("x", nodeWidth / 2)
      .attr("y", 54)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#3498db");

    // UPDATE: Transition nodes to their new position
    const nodeUpdate = node.merge(nodeEnter).transition()
      .duration(duration)
      .attr("transform", d => `translate(${d.x - nodeWidth / 2}, ${d.y - nodeHeight / 2})`);

    // Update node styling based on collapsed state
    node.merge(nodeEnter).select("rect")
      .style("stroke", d => d._children ? "#e74c3c" : "#2c3e50")
      .style("stroke-width", d => d._children ? "3px" : "2px");

    // Update +/- indicator text
    node.merge(nodeEnter).select(".toggle-icon")
      .text(d => {
        if (d._children) return "▼ (expand)";
        if (d.children && d.depth > 0) return "▲ (collapse)";
        return "";
      });

    // EXIT: Transition exiting nodes back to parent's position
    node.exit().transition()
      .duration(duration)
      .attr("transform", () => `translate(${source.x - nodeWidth / 2}, ${source.y - nodeHeight / 2})`)
      .remove();

    // ---------------- LINKS ----------------
    const link = g.selectAll("path.link")
      .data(links, d => d.target.id);

    // Enter links at parent's previous position
    const linkEnter = link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", () => {
        const o = { x: source.x0, y: source.y0 };
        return d3.linkVertical()({ source: o, target: o });
      });

    // UPDATE: Transition links to new positions
    link.merge(linkEnter).transition()
      .duration(duration)
      .attr("d", d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y)
      );

    // EXIT: Transition exiting links back to parent's position
    link.exit().transition()
      .duration(duration)
      .attr("d", () => {
        const o = { x: source.x, y: source.y };
        return d3.linkVertical()({ source: o, target: o });
      })
      .remove();

    // Stash old positions for transition calculations
    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
});
