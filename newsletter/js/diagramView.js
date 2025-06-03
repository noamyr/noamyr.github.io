import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const nodesCSVURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeL_ZNMDxGeyc-DXN_TOq-CRSDHmXeMHaaa85yVk1lzSrkFVnzwxE0P8CAX4zcthtbgAW3vnWTQA3O/pub?gid=1025729289&single=true&output=csv";
const linksCSVURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeL_ZNMDxGeyc-DXN_TOq-CRSDHmXeMHaaa85yVk1lzSrkFVnzwxE0P8CAX4zcthtbgAW3vnWTQA3O/pub?gid=2103570227&single=true&output=csv";

Promise.all([
  d3.csv(nodesCSVURL),
  d3.csv(linksCSVURL)
]).then(([nodesRaw, linksRaw]) => {
  const nodes = nodesRaw.map(d => ({
    id: d.id,
    title: d.title,
    number: d.number || null,
    caption: d.caption || "",
    link: d.link,
    image: d.image || null,
    category: d.category?.toLowerCase() || "default"
  }));

  const links = linksRaw.map(d => ({
    source: d.source,
    target: d.target,
    relation: d.relation || ""
  }));

  initDiagram(nodes, links);
});

function initDiagram(nodes, links) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  let lastTappedNodeId = null;
  let lastEvent = null;
  let dragging = false;

  const svg = d3.select("#diagram-container").append("svg")
    .attr("width", width)
    .attr("height", height);

  const container = svg.append("g").attr("class", "container");

  const colorMap = {
    "essay": "#f07d82",           // soft coral pink (used in node bg)
    "sci-fi": "#88c4d8",          // pastel blue
    "external link": "#7d91e0",   // soft periwinkle
    "artwork": "#c49fd4",         // lavender-pink
    "default": "#999999"          // light gray fallback
  };  

  const legendData = Object.entries(colorMap).filter(([key]) => key !== "default");

  const legend = d3.select("#diagram-container").append("div")
    .attr("id", "legend")
    .style("position", "absolute")
    .style("top", "12px")
    .style("left", "12px");

  legend.selectAll("div")
    .data(legendData)
    .enter()
    .append("div")
    .style("margin-bottom", "8px")
    .html(([key, color]) => `<span style="display:inline-block;width:12px;height:12px;background:${color};margin-right:8px;border-radius:4px;"></span> ${key}`);

  const preview = d3.select("body").append("div")
    .attr("id", "preview")
    .style("display", "none")
    .style("position", "fixed")
    .style("width", "200px")
    .style("z-index", "1000")
    .style("pointer-events", "none");

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(200))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const link = container.append("g")
    .attr("stroke", "#999999")
    .attr("stroke-opacity", 0.5)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", 1);

  const linkLabelGroup = container.append("g")
    .selectAll("g")
    .data(links)
    .join("g")
    .attr("class", "link-label");

  linkLabelGroup.each(function(d) {
    const group = d3.select(this);
    const words = d.relation.split(" ");
    const lines = [];
    let line = [];

    words.forEach(word => {
      const testLine = [...line, word].join(" ");
      if (testLine.length > 15) {
        lines.push(line.join(" "));
        line = [word];
      } else {
        line.push(word);
      }
    });
    if (line.length) lines.push(line.join(" "));

    const fontSize = 6;
    const lineHeight = fontSize * 1.2;
    const charWidth = fontSize * 0.6;
    const padding = 2;

    const maxLineLength = Math.max(...lines.map(l => l.length));
    const textWidth = maxLineLength * charWidth;
    const textHeight = lines.length * lineHeight;

    group.append("rect")
      .attr("x", -textWidth / 2 - padding)
      .attr("y", -textHeight / 2 - padding)
      .attr("width", textWidth + padding * 2)
      .attr("height", textHeight + padding * 2)
      .attr("fill", "#2c2c2c")
      .attr("rx", 4);

    const text = group.append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#f8f4f2")
      .style("font-size", `${fontSize}px`)
      .style("pointer-events", "none");

    const textYOffset = -((lines.length - 1) * lineHeight) / 2 + fontSize * 0.3;

    lines.forEach((lineText, i) => {
      text.append("tspan")
        .attr("x", 0)
        .attr("dy", i === 0 ? textYOffset : lineHeight)
        .text(lineText);
    });
  });

  const node = container.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation));

  node.each(function(d) {
    const group = d3.select(this);
    const fullLabel = d.number ? `${d.number}: ${d.title}` : d.title;
    const words = fullLabel.split(" ");
    const lines = [];
    let line = [];

    words.forEach(word => {
      const testLine = [...line, word].join(" ");
      if (testLine.length > 18) {
        lines.push(line.join(" "));
        line = [word];
      } else {
        line.push(word);
      }
    });
    if (line.length) lines.push(line.join(" "));

    const fontSize = d.number ? 9 : 6;
    const padding = fontSize / 2;
    const lineHeight = fontSize * 1.2;
    const charWidth = fontSize * 0.6;

    const maxLineLength = Math.max(...lines.map(line => line.length));
    const estimatedTextWidth = maxLineLength * charWidth;
    const estimatedTextHeight = lines.length * lineHeight;

    const rectWidth = estimatedTextWidth + padding * 2;
    const rectHeight = estimatedTextHeight + padding * 2;

    group.append("rect")
      .attr("x", -rectWidth / 2)
      .attr("y", -rectHeight / 2)
      .attr("width", rectWidth)
      .attr("height", rectHeight)
      .attr("rx", 10)
      .attr("ry", 10)
      .attr("fill", colorMap[d.category] || colorMap.default);

    const text = group.append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#111")
      .style("font-size", `${fontSize}px`)
      .style("pointer-events", "none");

    const textYOffset = -((lines.length - 1) * fontSize * 1.2) / 2;

    lines.forEach((lineText, i) => {
      text.append("tspan")
        .attr("x", 0)
        .attr("dy", i === 0 ? textYOffset + fontSize * 0.4 : fontSize * 1.2)
        .text(lineText);
    });
  });

  node
    .style("cursor", d => d.link ? "pointer" : "default")
    .on("mouseover", (event, d) => {
      if (window.innerWidth > 768) {
        lastEvent = event;
        const title = d.number ? `<strong>${d.number}: ${d.title}</strong>` : `<strong>${d.title}</strong>`;
        const clickable = d.link ? `<br><br><em>Click to open</em>` : "";
        preview
          .style("display", "block")
          .html(`${title}<br>${d.caption}${clickable}`);
      }
    })    .on("mousemove", (event) => {
      if (window.innerWidth > 768) {
        lastEvent = event;
        preview
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`);
      }
    })
    .on("mouseout", () => {
      if (window.innerWidth > 768) {
        preview.style("display", "none");
      }
    })
 .on("click", (event, d) => {
      const isMobile = window.innerWidth <= 768;
      const title = d.number ? `<strong>${d.number}: ${d.title}</strong>` : `<strong>${d.title}</strong>`;
      const clickable = d.link ? `<br><br><em>Tap the node again to open</em>` : "";
      if (isMobile) {
        if (lastTappedNodeId === d.id) {
          if (d.link) window.open(d.link, "_blank");
          lastTappedNodeId = null;
          preview.style("display", "none");
        } else {
          lastTappedNodeId = d.id;
          preview
            .style("display", "block")
            .html(`${title}<br>${d.caption}${clickable}`)
            .style("left", `${(window.innerWidth - 200) / 2}px`)
            .style("top", `${(window.innerHeight - 80) / 2}px`);
        }
      } else {
        if (d.link) window.open(d.link, "_blank");
      }
    });

  d3.select("body").on("click", (event) => {
    const clickedOnNode = event.target.closest("g");
    if (!clickedOnNode) {
      lastTappedNodeId = null;
      preview.style("display", "none");
    }
  });

  let numberedNodes = nodes.filter(n => n.number).sort((a, b) => +a.number - +b.number);
  let currentIndex = 0;
  let initialPanDone = false;

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);

    if (window.innerWidth > 768 && lastEvent) {
      preview
        .style("left", `${lastEvent.pageX + 10}px`)
        .style("top", `${lastEvent.pageY + 10}px`);
    }

    linkLabelGroup.attr("transform", d => {
      const x = (d.source.x + d.target.x) / 2;
      const y = (d.source.y + d.target.y) / 2;
      return `translate(${x},${y})`;
    });

    if (!initialPanDone && numberedNodes.length > 0) {
      panToNode(Math.floor(Math.random() * numberedNodes.length));
      initialPanDone = true;
    }
  });

  const zoom = d3.zoom().on("zoom", (event) => {
    container.attr("transform", event.transform);
  });
  svg.call(zoom);

  function panToNode(index) {
    const d = numberedNodes[index];
    if (!d) return;
    const zoomLevel = 2;
    const tx = width / 2 - d.x * zoomLevel;
    const ty = height / 2 - d.y * zoomLevel;
    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(zoomLevel));
    currentIndex = index;
    updateCurrentNumberLabel();
  }

  function updateCurrentNumberLabel() {
    const node = numberedNodes[currentIndex];
    document.getElementById("current-node-number").textContent = node?.number || "";
  }

  document.getElementById("prev-node").onclick = () => {
    currentIndex = (currentIndex - 1 + numberedNodes.length) % numberedNodes.length;
    panToNode(currentIndex);
  };

  document.getElementById("next-node").onclick = () => {
    currentIndex = (currentIndex + 1) % numberedNodes.length;
    panToNode(currentIndex);
  };

  document.getElementById("random-node").onclick = () => {
    const randomIndex = Math.floor(Math.random() * numberedNodes.length);
    currentIndex = randomIndex;
    panToNode(currentIndex);
  };

  function drag(simulation) {
    return d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        dragging = true;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
        lastEvent = event;
        if (window.innerWidth > 768) {
          preview
            .style("left", `${event.sourceEvent.pageX + 10}px`)
            .style("top", `${event.sourceEvent.pageY + 10}px`);
        }
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        dragging = false;
      });
  }
}
