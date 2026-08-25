document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("tree-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Node dimensions
  const nodeWidth = 160;
  const nodeHeight = 60;

  // Append SVG element with zoom support
  const svg = d3.select("#tree-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .call(d3.zoom().on("zoom", (event) => {
      g.attr("transform", event.transform);
    }));

  const g = svg.append("g")
    .attr("transform", `translate(${width / 2}, 80)`);

  // Fetch JSON data
  d3.json("data/family.json").then(data => {
    // Convert data to D3 hierarchy
    const root = d3.hierarchy(data);

    // Create D3 Tree Layout
    const treeLayout = d3.tree()
      .nodeSize([nodeWidth + 40, nodeHeight + 60]);

    treeLayout(root);

    // Render Connecting Links
    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y)
      );

    // Render Nodes
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
