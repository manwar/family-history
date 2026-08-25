document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("tree-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  const nodeWidth = 160;
  const nodeHeight = 60;

  // Append SVG
  const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  // Transparent background rect to catch ALL pointer/drag events uniformly
  const bg = svg.append("rect")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "none")
    .attr("pointer-events", "all");

  // Main group that holds the tree
  const g = svg.append("g");

  // Configure Zoom behavior with smooth extents
  const zoom = d3.zoom()
    .scaleExtent([0.3, 2.5]) // Prevents extreme zoom jumps
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  // Attach zoom event to the SVG element
  svg.call(zoom);

  // Initial centering calculation
  const initialTransform = d3.zoomIdentity
    .translate(width / 2, 80)
    .scale(1);

  svg.call(zoom.transform, initialTransform);

  // Fetch JSON data
  d3.json("data/family.json").then(data => {
    const root = d3.hierarchy(data);

    const treeLayout = d3.tree()
      .nodeSize([nodeWidth + 40, nodeHeight + 60]);

    treeLayout(root);

    // Links
    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y)
      );

    // Nodes
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x - nodeWidth / 2}, ${d.y - nodeHeight / 2})`);

    // Node Box
    node.append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight);

    // Member Name
    node.append("text")
      .attr("class", "name")
      .attr("x", nodeWidth / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .text(d => d.data.name);

    // Member Dates
    node.append("text")
      .attr("class", "dates")
      .attr("x", nodeWidth / 2)
      .attr("y", 45)
      .attr("text-anchor", "middle")
      .text(d => `${d.data.born || '?'} - ${d.data.died || 'Present'}`);
  }).catch(error => {
    console.error("Error loading family tree data:", error);
  });
});
