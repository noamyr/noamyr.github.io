import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const nodesCSVURL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeL_ZNMDxGeyc-DXN_TOq-CRSDHmXeMHaaa85yVk1lzSrkFVnzwxE0P8CAX4zcthtbgAW3vnWTQA3O/pub?gid=1025729289&single=true&output=csv";
const linksCSVURL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeL_ZNMDxGeyc-DXN_TOq-CRSDHmXeMHaaa85yVk1lzSrkFVnzwxE0P8CAX4zcthtbgAW3vnWTQA3O/pub?gid=2103570227&single=true&output=csv";

const colorMap = {
  essay: "#FF665E",
  "sci-fi": "#00A95C",
  "external link": "#0000EE",
  artwork: "#c49fd4",
  default: "#999999",
};

const preferredCategoryOrder = [
  "essay",
  "sci-fi",
  "artwork",
  "external link",
];

const state = {
  nodes: [],
  links: [],
  nodeById: new Map(),
  activeCategories: new Set(),
  query: "",
  mode: "explore",
  selectedNodeId: null,
  hoveredNodeId: null,
  previewNodeId: null,
  previewPinned: false,
  selectedLink: null,
  currentNumberedIndex: 0,
  visibleNumberedNodes: [],
  exploreTransform: d3.zoomIdentity,
  focusTransitionToken: 0,
  initialNavigationDone: false,
  sizeByMetric: false,
  influenceMedian: 1,
  metricsByNodeId: new Map(),
  simulation: null,
  svg: null,
  zoomLayer: null,
  zoomBehavior: null,
  nodeSelection: null,
  linkSelection: null,
  linkHitboxSelection: null,
  linkLabelSelection: null,
};

const diagramContainer = document.getElementById("diagram-container");
const loadingState = document.getElementById("loading-state");
const legendItems = document.getElementById("legend-items");
const searchInput = document.getElementById("node-search");
const sizeByMetricToggle = document.getElementById("size-by-metric");
const rankingDescription = document.getElementById("ranking-description");
const weightFormula = document.getElementById("weight-formula");
const rankingList = document.getElementById("ranking-list");
const focusModeToggle = document.getElementById("focus-mode-toggle");
const modeDescription = document.getElementById("mode-description");
const resetButton = document.getElementById("reset-controls");
const interfacePanel = document.getElementById("interface-panel");
const interfacePanelToggle = document.getElementById("interface-panel-toggle");
const resultCount = document.getElementById("result-count");
const currentNodeNumber = document.getElementById("current-node-number");
const previousButton = document.getElementById("prev-node");
const nextButton = document.getElementById("next-node");
const randomButton = document.getElementById("random-node");
const preview = document.getElementById("preview");
const previewContent = document.getElementById("preview-content");
const previewClose = document.getElementById("preview-close");

let searchDebounceTimer = null;
let resizeDebounceTimer = null;

loadDiagram();

async function loadDiagram() {
  try {
    const [nodesRaw, linksRaw] = await Promise.all([
      d3.csv(nodesCSVURL),
      d3.csv(linksCSVURL),
    ]);

    state.nodes = nodesRaw
      .map(parseNode)
      .filter((node) => node.id && node.title);

    state.nodeById = new Map(state.nodes.map((node) => [node.id, node]));

    state.links = linksRaw
      .map(parseLink)
      .filter(
        (link) =>
          link.source &&
          link.target &&
          state.nodeById.has(link.source) &&
          state.nodeById.has(link.target)
      );

    buildNetworkMetrics();

    state.activeCategories = new Set(
      state.nodes.map((node) => node.category)
    );

    buildLegend();
    bindControls();
    renderDiagram();
    loadingState?.classList.add("hidden");
  } catch (error) {
    console.error("Could not load the Archive of Patchy Studies:", error);
    if (loadingState) {
      loadingState.textContent =
        "The diagram could not be loaded. Check that the published Google Sheets CSV links are still available.";
    }
  }
}

function parseNode(row) {
  return {
    id: clean(row.id),
    title: clean(row.title),
    number: clean(row.number) || null,
    caption: clean(row.caption),
    link: clean(row.link),
    image: clean(row.image) || null,
    category: clean(row.category).toLowerCase() || "default",
    x: Number.isFinite(+row.x) ? +row.x : undefined,
    y: Number.isFinite(+row.y) ? +row.y : undefined,
  };
}

function parseLink(row, index) {
  return {
    id: `link-${index}`,
    source: clean(row.source),
    target: clean(row.target),
    relation: clean(row.relation),
  };
}

function buildNetworkMetrics() {
  const neighborIdsByNode = new Map(
    state.nodes.map((node) => [node.id, new Set()])
  );

  state.links.forEach((link) => {
    neighborIdsByNode.get(link.source)?.add(link.target);
    neighborIdsByNode.get(link.target)?.add(link.source);
  });

  state.metricsByNodeId = new Map(
    state.nodes.map((node) => {
      const neighborIds = [...(neighborIdsByNode.get(node.id) || [])];
      const neighbors = neighborIds
        .map((id) => state.nodeById.get(id))
        .filter(Boolean);
      const numberedNeighbors = neighbors
        .filter((neighbor) => clean(neighbor.number))
        .sort((a, b) => Number(a.number) - Number(b.number));
      const externalNeighbors = neighbors.filter(
        (neighbor) => neighbor.category === "external link"
      );
      const numberedValues = numberedNeighbors
        .map((neighbor) => Number(neighbor.number))
        .filter(Number.isFinite);

      return [
        node.id,
        {
          neighborIds,
          neighbors,
          numberedNeighbors,
          externalNeighbors,
          degree: neighborIds.length,
          studyCount: numberedNeighbors.length,
          sourceCount: externalNeighbors.length,
          earliestStudy: numberedValues.length
            ? Math.min(...numberedValues)
            : null,
          latestStudy: numberedValues.length
            ? Math.max(...numberedValues)
            : null,
        },
      ];
    })
  );

  state.influenceMedian = calculateInfluenceMedian();
}

function getNodeMetrics(nodeOrId) {
  const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.id;
  return (
    state.metricsByNodeId.get(id) || {
      neighborIds: [],
      neighbors: [],
      numberedNeighbors: [],
      externalNeighbors: [],
      degree: 0,
      studyCount: 0,
      sourceCount: 0,
      earliestStudy: null,
      latestStudy: null,
    }
  );
}

function getInfluenceMetricConfig() {
  return {
    description:
      "External links ranked by unique direct connections to numbered studies. Recurrence is used as a trace of influence, not proof of causality.",
    score: (node) => getNodeMetrics(node).studyCount,
    eligible: (node) => node.category === "external link",
    singular: "study",
    plural: "studies",
  };
}

function calculateInfluenceMedian() {
  const positiveScores = state.nodes
    .filter((node) => node.category === "external link")
    .map((node) => getNodeMetrics(node).studyCount)
    .filter((score) => score > 0)
    .sort((a, b) => a - b);

  if (!positiveScores.length) return 1;

  const middle = Math.floor(positiveScores.length / 2);
  return positiveScores.length % 2
    ? positiveScores[middle]
    : (positiveScores[middle - 1] + positiveScores[middle]) / 2;
}

function bindControls() {
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      state.query = normalizeSearch(searchInput.value);

      if (
        state.selectedNodeId &&
        !nodeMatchesSearch(state.nodeById.get(state.selectedNodeId))
      ) {
        clearSelection({ keepPreview: false });
        if (state.mode === "focus") {
          clearFocusNeighborhood({ keepZoom: true });
        }
      }

      updateVisibility();
    }, 120);
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const matches = getSearchMatchingNodes().filter(nodeMatchesCategory);
    if (!matches.length) return;

    const exact = findExactSearchMatch(matches, state.query) || matches[0];
    navigateToNode(exact, {
      focus: state.mode === "focus",
      showPreview: true,
    });
  });

  sizeByMetricToggle?.addEventListener("change", () => {
    state.sizeByMetric = sizeByMetricToggle.checked;
    updateMetricVisuals();
  });

  rankingList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-node-id]");
    if (!button) return;
    const node = state.nodeById.get(button.dataset.nodeId);
    if (!node) return;
    navigateToNode(node, {
      focus: state.mode === "focus",
      showPreview: true,
    });
  });

  previewContent?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-node-id]");
    if (!button) return;
    event.stopPropagation();
    const node = state.nodeById.get(button.dataset.nodeId);
    if (!node) return;
    focusNodeFromPreview(node);
  });

  preview?.addEventListener("click", (event) => {
    if (
event.target.closest(
  "button, a, input, select, textarea, .preview-caption, .preview-relations"
)    ) return;
    openPinnedPreviewSource();
  });

  preview?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target !== preview) return;
    event.preventDefault();
    openPinnedPreviewSource();
  });

  focusModeToggle?.addEventListener("change", () => {
    setMode(focusModeToggle.checked ? "focus" : "explore");
  });

  resetButton?.addEventListener("click", resetControls);
  interfacePanelToggle?.addEventListener("click", toggleInterfacePanel);
  previousButton?.addEventListener("click", () => stepNumberedNode(-1));
  nextButton?.addEventListener("click", () => stepNumberedNode(1));
  randomButton?.addEventListener("click", navigateToRandomNumberedNode);

  previewClose?.addEventListener("click", (event) => {
    event.stopPropagation();
    hidePreview();
    if (state.mode === "explore") {
      state.selectedNodeId = null;
      updateSelectionStyles();
    }
  });

  window.addEventListener("resize", () => {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = window.setTimeout(resizeDiagram, 120);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hidePreview();
      if (state.mode === "focus") {
        clearSelection({ keepPreview: false });
        clearFocusNeighborhood({ keepZoom: true });
        updateVisibility();
      } else {
        state.selectedNodeId = null;
        updateSelectionStyles();
      }
    }
  });
}

function toggleInterfacePanel() {
  if (!interfacePanel || !interfacePanelToggle) return;

  const collapsed = interfacePanel.classList.toggle("is-collapsed");
  const action = collapsed ? "Expand" : "Collapse";

  interfacePanelToggle.setAttribute("aria-expanded", String(!collapsed));
  interfacePanelToggle.setAttribute(
    "aria-label",
    `${action} diagram controls`
  );
  interfacePanelToggle.title = `${action} diagram controls`;

  const icon = interfacePanelToggle.querySelector(".panel-collapse-icon");
  if (icon) icon.textContent = collapsed ? "+" : "−";

  // Focus-mode framing reserves space for the panel, so recalculate it.
  window.requestAnimationFrame(resizeDiagram);
}

function buildLegend() {
  if (!legendItems) return;
  legendItems.innerHTML = "";

  const categories = [...new Set(state.nodes.map((node) => node.category))].sort(
    (a, b) => {
      const aIndex = preferredCategoryOrder.indexOf(a);
      const bIndex = preferredCategoryOrder.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    }
  );

  categories.forEach((category) => {
    const label = document.createElement("label");
    label.className = "legend-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.activeCategories.has(category);
    checkbox.dataset.category = category;
    checkbox.setAttribute("aria-label", `Show ${category} nodes`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.activeCategories.add(category);
      else state.activeCategories.delete(category);

      if (
        state.selectedNodeId &&
        !nodeMatchesCategory(state.nodeById.get(state.selectedNodeId))
      ) {
        clearSelection({ keepPreview: false });
        if (state.mode === "focus") {
          clearFocusNeighborhood({ keepZoom: true });
        }
      }

      updateVisibility();
    });

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = colorForCategory(category);
    swatch.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "legend-name";
    name.textContent = category;

    const count = document.createElement("span");
    count.className = "legend-count";
    count.textContent = state.nodes.filter(
      (node) => node.category === category
    ).length;

    label.append(checkbox, swatch, name, count);
    legendItems.appendChild(label);
  });
}

function renderDiagram() {
  state.simulation?.stop();
  diagramContainer.querySelector("svg")?.remove();

  const { width, height } = diagramContainer.getBoundingClientRect();

  const svg = d3
    .select(diagramContainer)
    .insert("svg", ":first-child")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Interactive network diagram");

  const zoomLayer = svg.append("g").attr("class", "zoom-layer");
  const linkLayer = zoomLayer.append("g").attr("class", "link-layer");
  const labelLayer = zoomLayer.append("g").attr("class", "link-label-layer");
  const nodeLayer = zoomLayer.append("g").attr("class", "node-layer");

  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.2, 6])
    .on("zoom", (event) => {
      zoomLayer.attr("transform", event.transform);
      if (state.mode === "explore") {
        state.exploreTransform = event.transform;
      }
    });

  svg.call(zoomBehavior);
  svg.on("click", () => {
    hidePreview();
    hideAllLinkLabels();

    if (state.mode === "focus") {
      clearSelection({ keepPreview: false });
      clearFocusNeighborhood({ keepZoom: true });
      updateVisibility();
    } else {
      state.selectedNodeId = null;
      updateSelectionStyles();
    }
  });

  const linkSelection = linkLayer
    .selectAll("line.diagram-link")
    .data(state.links, (link) => link.id)
    .join("line")
    .attr("class", "diagram-link")
    .attr("stroke", "#2c2c2c")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", 1);

  const linkLabelSelection = labelLayer
    .selectAll("g.link-label")
    .data(state.links, (link) => link.id)
    .join("g")
    .attr("class", "link-label")
    .style("display", "none");

  linkLabelSelection.each(function buildLinkLabel(link) {
    const relation = clean(link.relation);
    if (!relation) return;

    const group = d3.select(this);
    const lines = wrapWords(relation, 30);
    const fontSize = 6;
    const lineHeight = fontSize * 1.5;
    const padding = fontSize;
    const charWidth = fontSize * 0.5;
    const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
    const textWidth = maxLineLength * charWidth;
    const textHeight = lines.length * lineHeight;

    group
      .append("rect")
      .attr("x", -textWidth / 2 - padding)
      .attr("y", -textHeight / 2 - padding)
      .attr("width", textWidth + padding * 2)
      .attr("height", textHeight + padding * 2)
      .attr("fill", "rgb(245,255,245)")
      .attr("rx", 6);

    const text = group
      .append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#2c2c2c")
      .style("font-size", `${fontSize}px`);

    const firstLineOffset =
      -((lines.length - 1) * lineHeight) / 2 + fontSize * 0.3;

    lines.forEach((line, index) => {
      text
        .append("tspan")
        .attr("x", 0)
        .attr("dy", index === 0 ? firstLineOffset : lineHeight)
        .text(line);
    });
  });

  const linkHitboxSelection = linkLayer
    .append("g")
    .attr("class", "link-hitbox-layer")
    .selectAll("line.link-hitbox")
    .data(state.links, (link) => link.id)
    .join("line")
    .attr("class", "link-hitbox")
    .attr("stroke", "transparent")
    .attr("stroke-width", 20)
    .style("cursor", (link) => (link.relation ? "pointer" : "default"))
    .on("mouseenter", (event, link) => {
      if (!link.relation || isTouchLayout()) return;
      showOnlyLinkLabel(link.id);
    })
    .on("mouseleave", (event, link) => {
      if (!link.relation || isTouchLayout()) return;
      hideLinkLabel(link.id);
    })
    .on("click", (event, link) => {
      if (!link.relation || !isTouchLayout()) return;
      event.stopPropagation();
      toggleLinkLabel(link.id);
    });

  const nodeSelection = nodeLayer
    .selectAll("g.node")
    .data(state.nodes, (node) => node.id)
    .join("g")
    .attr("class", "node")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (node) => nodeAccessibleLabel(node))
    .style("cursor", "pointer")
    .call(createDragBehavior());

  nodeSelection.each(function drawNode(node) {
    const group = d3.select(this);
    const fullLabel = node.number
      ? `${node.number}: ${node.title}`
      : node.title;
    const lines = wrapWords(fullLabel, 18);
    const fontSize = node.number ? 9 : 6;
    const paddingX = fontSize * 0.65;
    const paddingY = fontSize * 0.65;
    const lineHeight = fontSize * 1.2;
    const charWidth = fontSize * 0.6;
    const maxLineLength = Math.max(...lines.map((line) => line.length), 1);

    node._width = maxLineLength * charWidth + paddingX * 2;
    node._height = lines.length * lineHeight + paddingY * 2;

    group
      .append("rect")
      .attr("x", -node._width / 2)
      .attr("y", -node._height / 2)
      .attr("width", node._width)
      .attr("height", node._height)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", colorForCategory(node.category));

    const text = group
      .append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#f5f5f5")
      .style("font-size", `${fontSize}px`)
      .style("pointer-events", "none");

    const firstLineOffset =
      -((lines.length - 1) * lineHeight) / 2 + fontSize * 0.4;

    lines.forEach((line, index) => {
      text
        .append("tspan")
        .attr("x", 0)
        .attr("dy", index === 0 ? firstLineOffset : lineHeight)
        .text(line);
    });
  });

  nodeSelection
    .on("mouseenter", (event, node) => {
      if (isTouchLayout() || isNodeHidden(node) || state.previewPinned) return;
      state.hoveredNodeId = node.id;
      showPreview(node, { event, transient: true });
      emphasizeConnections(node.id);
    })
    .on("mousemove", (event, node) => {
      if (
        isTouchLayout() ||
        state.previewPinned ||
        state.hoveredNodeId !== node.id
      ) return;
      positionPreviewNearPointer(event);
    })
    .on("mouseleave", () => {
      if (isTouchLayout()) return;
      state.hoveredNodeId = null;
      if (!state.previewPinned) hidePreview();
      restoreConnectionOpacity();
    })
    .on("click", (event, node) => {
      event.stopPropagation();
      handleNodeActivation(node, event);
    })
    .on("keydown", (event, node) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      handleNodeActivation(node, event);
    });

  state.svg = svg;
  state.zoomLayer = zoomLayer;
  state.zoomBehavior = zoomBehavior;
  state.nodeSelection = nodeSelection;
  state.linkSelection = linkSelection;
  state.linkHitboxSelection = linkHitboxSelection;
  state.linkLabelSelection = linkLabelSelection;

  updateMetricVisuals({ restartSimulation: false });

  const simulation = d3
    .forceSimulation(state.nodes)
    .force(
      "link",
      d3
        .forceLink(state.links)
        .id((node) => node.id)
        .distance(200)
        .strength(0.32)
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "collision",
      d3
        .forceCollide()
        .radius(
          (node) =>
            (Math.max(node._width, node._height) / 2) *
              (node._visualScale || 1) +
            10
        )
        .strength(0.8)
    );

  simulation.on("tick", () => {
    linkSelection
      .attr("x1", (link) => link.source.x)
      .attr("y1", (link) => link.source.y)
      .attr("x2", (link) => link.target.x)
      .attr("y2", (link) => link.target.y);

    linkHitboxSelection
      .attr("x1", (link) => link.source.x)
      .attr("y1", (link) => link.source.y)
      .attr("x2", (link) => link.target.x)
      .attr("y2", (link) => link.target.y);

    linkLabelSelection.attr("transform", (link) => {
      const x = (link.source.x + link.target.x) / 2;
      const y = (link.source.y + link.target.y) / 2;
      return `translate(${x},${y})`;
    });

    nodeSelection.attr("transform", nodeTransform);

    if (!state.initialNavigationDone && simulation.alpha() < 0.45) {
      state.initialNavigationDone = true;
      updateVisibility();
      navigateToRandomNumberedNode({ showPreview: false });
    }
  });

  state.simulation = simulation;
  updateVisibility();
}

function handleNodeActivation(node, event) {
  if (isNodeHidden(node)) return;

  state.selectedNodeId = node.id;
  updateSelectionStyles();
  syncCurrentNumberedIndex(node);

  if (state.mode === "focus") {
    applyFocusNeighborhood(node.id, { animate: true, recenter: true });
  }

  showPreview(node, { event, transient: false });
}

function focusNodeFromPreview(node) {
  if (!node) return;

  state.selectedNodeId = node.id;
  updateSelectionStyles();

  if (state.mode !== "focus") {
    setMode("focus");
  }

  navigateToNode(node, {
    focus: true,
    showPreview: true,
  });
}

function openPinnedPreviewSource() {
  if (!state.previewPinned || !state.previewNodeId) return;
  const node = state.nodeById.get(state.previewNodeId);
  if (!node?.link) return;
  window.open(node.link, "_blank", "noopener,noreferrer");
}

function setMode(mode) {
  if (mode !== "explore" && mode !== "focus" || state.mode === mode) return;

  state.mode = mode;
  state.focusTransitionToken += 1;

  if (focusModeToggle) {
    focusModeToggle.checked = mode === "focus";
  }

  if (modeDescription) {
    modeDescription.textContent =
      mode === "focus"
        ? "Select a node to reveal it and its immediate relations."
        : "Explore the full filtered diagram.";
  }

  if (mode === "focus") {
    state.exploreTransform =
      state.exploreTransform || d3.zoomTransform(state.svg?.node());

    if (state.selectedNodeId) {
      applyFocusNeighborhood(state.selectedNodeId, {
        animate: true,
        recenter: true,
      });
    } else {
      clearFocusNeighborhood({ keepZoom: true });
    }
  } else {
    clearSelection({ keepPreview: false });
    clearFocusNeighborhood({ keepZoom: false });
    restoreExploreZoom();
  }

  updateVisibility();
}

function resetControls() {
  state.query = "";
  state.activeCategories = new Set(
    state.nodes.map((node) => node.category)
  );

  if (searchInput) searchInput.value = "";
  state.sizeByMetric = false;
  if (sizeByMetricToggle) sizeByMetricToggle.checked = false;
  updateMetricVisuals();

  legendItems
    ?.querySelectorAll('input[type="checkbox"][data-category]')
    .forEach((checkbox) => {
      checkbox.checked = true;
    });

  clearSelection({ keepPreview: false });
  clearFocusNeighborhood({ keepZoom: true });
  updateVisibility();
}

function updateVisibility() {
  if (!state.nodeSelection) return;

  const visibleNodeIds = new Set();

  state.nodeSelection
    .classed("is-filtered-out", (node) => {
      const visible = nodeMatchesBaseFilters(node);
      if (visible) visibleNodeIds.add(node.id);
      return !visible;
    })
    .classed(
      "is-search-match",
      (node) => Boolean(state.query) && nodeMatchesBaseFilters(node)
    )
    .style("pointer-events", (node) =>
      visibleNodeIds.has(node.id) ? "all" : "none"
    )
    .style("opacity", (node) => (visibleNodeIds.has(node.id) ? 1 : 0));

  const linkVisible = (link) => {
    const sourceId = linkEndpointId(link.source);
    const targetId = linkEndpointId(link.target);
    return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
  };

  state.linkSelection
    .classed("is-filtered-out", (link) => !linkVisible(link))
    .style("pointer-events", (link) =>
      linkVisible(link) ? "stroke" : "none"
    )
    .style("opacity", (link) => (linkVisible(link) ? 0.5 : 0));

  state.linkHitboxSelection
    .classed("is-filtered-out", (link) => !linkVisible(link))
    .style("pointer-events", (link) =>
      linkVisible(link) && link.relation ? "stroke" : "none"
    );

  state.linkLabelSelection
    .classed("is-filtered-out", (link) => !linkVisible(link))
    .style("display", (link) =>
      linkVisible(link) && isLinkLabelOpen(link.id) ? "block" : "none"
    );

  updateNumberedNavigation(visibleNodeIds);
  updateResultCount(visibleNodeIds, linkVisible);
  updateRankingList();

  if (state.mode === "focus" && state.selectedNodeId) {
    applyFocusNeighborhood(state.selectedNodeId, {
      animate: false,
      recenter: false,
    });
  }
}

function nodeMatchesBaseFilters(node) {
  return nodeMatchesCategory(node) && nodeMatchesSearch(node);
}

function nodeMatchesCategory(node) {
  return Boolean(node) && state.activeCategories.has(node.category);
}

function nodeMatchesSearch(node) {
  if (!node) return false;
  if (!state.query) return true;

  const numericQuery = state.query.match(/^#?(\d+)$/);
  if (numericQuery) {
    return clean(node.number) === numericQuery[1];
  }

  return nodeSearchText(node).includes(state.query);
}

function nodeSearchText(node) {
  const relatedText = getNodeMetrics(node).neighbors.flatMap((neighbor) => [
    neighbor.title,
    neighbor.caption,
  ]);

  return [
    node.id,
    node.number,
    node.title,
    node.caption,
    node.category,
    ...relatedText,
  ]
    .map(clean)
    .join(" ")
    .toLowerCase();
}

function getSearchMatchingNodes() {
  return state.nodes.filter(nodeMatchesSearch);
}

function findExactSearchMatch(nodes, query) {
  const normalized = normalizeSearch(query);
  if (!normalized) return null;

  const numericQuery = normalized.match(/^#?(\d+)$/);
  if (numericQuery) {
    return nodes.find((node) => clean(node.number) === numericQuery[1]) || null;
  }

  return (
    nodes.find((node) => normalizeSearch(node.title) === normalized) || null
  );
}

function getFocusNeighborhood(nodeId) {
  const selectedNode = state.nodeById.get(nodeId);
  if (!nodeMatchesCategory(selectedNode)) {
    return { nodeIds: new Set(), linkIds: new Set() };
  }

  const nodeIds = new Set([nodeId]);
  const linkIds = new Set();

  state.links.forEach((link) => {
    const sourceId = linkEndpointId(link.source);
    const targetId = linkEndpointId(link.target);
    const touchesSelected = sourceId === nodeId || targetId === nodeId;
    if (!touchesSelected) return;

    const otherId = sourceId === nodeId ? targetId : sourceId;
    const otherNode = state.nodeById.get(otherId);
    if (!nodeMatchesCategory(otherNode)) return;

    nodeIds.add(otherId);
    linkIds.add(link.id);
  });

  return { nodeIds, linkIds };
}

function applyFocusNeighborhood(nodeId, options = {}) {
  if (state.mode !== "focus" || !state.nodeSelection) return;

  const { animate = true, recenter = true } = options;
  const token = ++state.focusTransitionToken;
  const { nodeIds, linkIds } = getFocusNeighborhood(nodeId);

  state.nodeSelection
    .filter((node) => nodeIds.has(node.id))
    .classed("is-filtered-out", false)
    .classed("focus-displayed-none", false)
    .classed("focus-hidden", false)
    .style("display", null)
    .style("pointer-events", "all")
    .style("opacity", 1);

  state.linkSelection
    .filter((link) => linkIds.has(link.id))
    .classed("is-filtered-out", false)
    .classed("focus-displayed-none", false)
    .classed("focus-hidden", false)
    .style("display", null)
    .style("pointer-events", "stroke")
    .style("opacity", 0.62);

  state.linkHitboxSelection
    .filter((link) => linkIds.has(link.id))
    .classed("is-filtered-out", false)
    .classed("focus-displayed-none", false)
    .classed("focus-hidden", false)
    .style("display", null)
    .style("pointer-events", (link) => (link.relation ? "stroke" : "none"));

  state.linkLabelSelection
    .filter((link) => linkIds.has(link.id))
    .classed("is-filtered-out", false)
    .classed("focus-displayed-none", false)
    .classed("focus-hidden", false);

  const hiddenNodes = state.nodeSelection.filter(
    (node) => !nodeIds.has(node.id)
  );
  const hiddenLinks = state.linkSelection.filter(
    (link) => !linkIds.has(link.id)
  );
  const hiddenHitboxes = state.linkHitboxSelection.filter(
    (link) => !linkIds.has(link.id)
  );
  const hiddenLabels = state.linkLabelSelection.filter(
    (link) => !linkIds.has(link.id)
  );

  hiddenNodes.classed("focus-hidden", true).style("pointer-events", "none");
  hiddenLinks.classed("focus-hidden", true).style("pointer-events", "none");
  hiddenHitboxes
    .classed("focus-hidden", true)
    .style("pointer-events", "none");
  hiddenLabels
    .classed("focus-hidden", true)
    .style("pointer-events", "none");

  updateFocusResultCount(nodeIds, linkIds);

  const finalize = () => {
    if (token !== state.focusTransitionToken) return;

    hiddenNodes
      .classed("focus-displayed-none", true)
      .style("display", "none");
    hiddenLinks
      .classed("focus-displayed-none", true)
      .style("display", "none");
    hiddenHitboxes
      .classed("focus-displayed-none", true)
      .style("display", "none");
    hiddenLabels
      .classed("focus-displayed-none", true)
      .style("display", "none");

    if (recenter) zoomToNodeSet(nodeIds, animate);
  };

  if (animate) window.setTimeout(finalize, 190);
  else finalize();
}

function clearFocusNeighborhood(options = {}) {
  if (!state.nodeSelection) return;

  const { keepZoom = true } = options;
  state.focusTransitionToken += 1;

  [
    state.nodeSelection,
    state.linkSelection,
    state.linkHitboxSelection,
    state.linkLabelSelection,
  ].forEach((selection) => {
    selection
      .classed("focus-displayed-none", false)
      .classed("focus-hidden", false)
      .style("display", null);
  });

  updateVisibilityBaseOnly();

  if (!keepZoom && state.mode === "explore") restoreExploreZoom();
}

function updateVisibilityBaseOnly() {
  if (!state.nodeSelection) return;

  const visibleNodeIds = new Set(
    state.nodes.filter(nodeMatchesBaseFilters).map((node) => node.id)
  );

  state.nodeSelection
    .classed("is-filtered-out", (node) => !visibleNodeIds.has(node.id))
    .style("display", null)
    .style("pointer-events", (node) =>
      visibleNodeIds.has(node.id) ? "all" : "none"
    )
    .style("opacity", (node) => (visibleNodeIds.has(node.id) ? 1 : 0));

  const isVisibleLink = (link) =>
    visibleNodeIds.has(linkEndpointId(link.source)) &&
    visibleNodeIds.has(linkEndpointId(link.target));

  state.linkSelection
    .classed("is-filtered-out", (link) => !isVisibleLink(link))
    .style("display", null)
    .style("pointer-events", (link) =>
      isVisibleLink(link) ? "stroke" : "none"
    )
    .style("opacity", (link) => (isVisibleLink(link) ? 0.5 : 0));

  state.linkHitboxSelection
    .classed("is-filtered-out", (link) => !isVisibleLink(link))
    .style("display", null)
    .style("pointer-events", (link) =>
      isVisibleLink(link) && link.relation ? "stroke" : "none"
    );

  state.linkLabelSelection
    .classed("is-filtered-out", (link) => !isVisibleLink(link))
    .style("display", "none");
}

function updateNumberedNavigation(visibleNodeIds) {
  state.visibleNumberedNodes = state.nodes
    .filter(
      (node) => node.number && visibleNodeIds.has(node.id)
    )
    .sort((a, b) => Number(a.number) - Number(b.number));

  if (!state.visibleNumberedNodes.length) {
    state.currentNumberedIndex = 0;
    if (currentNodeNumber) currentNodeNumber.textContent = "—";
    [previousButton, nextButton, randomButton].forEach((button) => {
      if (button) button.disabled = true;
    });
    return;
  }

  [previousButton, nextButton, randomButton].forEach((button) => {
    if (button) button.disabled = false;
  });

  const selectedIndex = state.visibleNumberedNodes.findIndex(
    (node) => node.id === state.selectedNodeId
  );

  if (selectedIndex !== -1) {
    state.currentNumberedIndex = selectedIndex;
  } else {
    state.currentNumberedIndex = clamp(
      state.currentNumberedIndex,
      0,
      state.visibleNumberedNodes.length - 1
    );
  }

  updateCurrentNumberDisplay();
}

function updateCurrentNumberDisplay() {
  const current = state.visibleNumberedNodes[state.currentNumberedIndex];
  if (!currentNodeNumber) return;
  currentNodeNumber.textContent = current?.number || "—";
  currentNodeNumber.title = current?.title || "No numbered study visible";
}

function stepNumberedNode(direction) {
  const nodes = state.visibleNumberedNodes;
  if (!nodes.length) return;

  state.currentNumberedIndex =
    (state.currentNumberedIndex + direction + nodes.length) % nodes.length;

  navigateToNode(nodes[state.currentNumberedIndex], {
    focus: state.mode === "focus",
    showPreview: true,
  });
}

function navigateToRandomNumberedNode(options = {}) {
  const nodes = state.visibleNumberedNodes;
  if (!nodes.length) return;

  const randomIndex = Math.floor(Math.random() * nodes.length);
  state.currentNumberedIndex = randomIndex;

  navigateToNode(nodes[randomIndex], {
    focus: state.mode === "focus",
    showPreview: options.showPreview !== false,
  });
}

function navigateToNode(node, options = {}) {
  if (!node) return;

  const { focus = false, showPreview: shouldShowPreview = true } = options;

  state.selectedNodeId = focus || isTouchLayout() ? node.id : null;
  updateSelectionStyles();
  syncCurrentNumberedIndex(node);

  if (focus && state.mode === "focus") {
    applyFocusNeighborhood(node.id, { animate: true, recenter: true });
  } else {
    panToNode(node);
  }

  if (shouldShowPreview) {
    showPreview(node, { transient: false });
  }
}

function syncCurrentNumberedIndex(node) {
  if (!node?.number || !state.visibleNumberedNodes.length) return;
  const index = state.visibleNumberedNodes.findIndex(
    (candidate) => candidate.id === node.id
  );
  if (index === -1) return;
  state.currentNumberedIndex = index;
  updateCurrentNumberDisplay();
}

function panToNode(node) {
  if (!state.svg || !state.zoomBehavior || !Number.isFinite(node.x)) return;

  const { width, height } = diagramContainer.getBoundingClientRect();
  const scale = 2;
  const transform = d3.zoomIdentity
    .translate(width / 2 - node.x * scale, height / 2 - node.y * scale)
    .scale(scale);

  state.svg
    .transition()
    .duration(reducedMotion() ? 0 : 650)
    .call(state.zoomBehavior.transform, transform);
}

function zoomToNodeSet(nodeIds, animate = true) {
  if (!state.svg || !state.zoomBehavior || !nodeIds.size) return;

  const nodes = state.nodes.filter(
    (node) => nodeIds.has(node.id) && Number.isFinite(node.x)
  );
  if (!nodes.length) return;

  const { width, height } = diagramContainer.getBoundingClientRect();
  const panelWidth = document.getElementById("interface-panel")?.offsetWidth || 0;
  const leftPadding = Math.min(panelWidth + 36, width * 0.35);
  const rightPadding = 70;
  const topPadding = 54;
  const bottomPadding = 72;

  const minX = d3.min(
    nodes,
    (node) => node.x - (node._width * (node._visualScale || 1)) / 2
  );
  const maxX = d3.max(
    nodes,
    (node) => node.x + (node._width * (node._visualScale || 1)) / 2
  );
  const minY = d3.min(
    nodes,
    (node) => node.y - (node._height * (node._visualScale || 1)) / 2
  );
  const maxY = d3.max(
    nodes,
    (node) => node.y + (node._height * (node._visualScale || 1)) / 2
  );

  const boundsWidth = Math.max(1, maxX - minX);
  const boundsHeight = Math.max(1, maxY - minY);
  const availableWidth = Math.max(100, width - leftPadding - rightPadding);
  const availableHeight = Math.max(100, height - topPadding - bottomPadding);
  const scale = clamp(
    Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight) * 0.78,
    0.7,
    3.2
  );

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const viewportCenterX = leftPadding + availableWidth / 2;
  const viewportCenterY = topPadding + availableHeight / 2;

  const transform = d3.zoomIdentity
    .translate(
      viewportCenterX - centerX * scale,
      viewportCenterY - centerY * scale
    )
    .scale(scale);

  const target = animate && !reducedMotion() ? state.svg.transition().duration(620) : state.svg;
  target.call(state.zoomBehavior.transform, transform);
}

function restoreExploreZoom() {
  if (!state.svg || !state.zoomBehavior) return;
  const transform = state.exploreTransform || d3.zoomIdentity;
  state.svg
    .transition()
    .duration(reducedMotion() ? 0 : 520)
    .call(state.zoomBehavior.transform, transform);
}

function showPreview(node, options = {}) {
  if (!preview || !previewContent || !node) return;

  const { event = null, transient = false } = options;
  const metrics = getNodeMetrics(node);
  const numberPrefix = node.number ? `${escapeHTML(node.number)}: ` : "";
  const imageHTML = node.image
    ? `<img src="./images/${escapeAttribute(node.image)}" class="preview-image" alt="">`
    : "";
  const captionHTML = node.caption
    ? `<div class="preview-caption">${escapeHTML(node.caption)}</div>`
    : "";
  const linkHTML =
    node.link && !transient
      ? `<div class="preview-open-hint">Click this card again to open source ↗</div>`
      : "";

  const metricItems = [
    `${metrics.degree} ${metrics.degree === 1 ? "relation" : "relations"}`,
  ];

  if (node.category === "external link") {
    metricItems.push(
      `${metrics.studyCount} linked ${
        metrics.studyCount === 1 ? "study" : "studies"
      }`
    );

    if (metrics.studyCount > 0) {
      metricItems.push(`${formatWeightRatio(metrics.studyCount)}× median weight`);
    }
  } else if (clean(node.number)) {
    metricItems.push(
      `${metrics.sourceCount} ${
        metrics.sourceCount === 1 ? "source" : "sources"
      }`
    );
  }

  if (
    node.category === "external link" &&
    metrics.earliestStudy !== null &&
    metrics.latestStudy !== null &&
    metrics.earliestStudy !== metrics.latestStudy
  ) {
    metricItems.push(`#${metrics.earliestStudy}–#${metrics.latestStudy}`);
  }

  const metricsHTML = `
    <div class="preview-metrics">
      ${metricItems
        .map(
          (item) =>
            `<span class="preview-metric">${escapeHTML(item)}</span>`
        )
        .join("")}
    </div>
  `;

  const relationNodes =
    node.category === "external link"
      ? metrics.numberedNeighbors
      : metrics.externalNeighbors;

  const relationsTitle =
    node.category === "external link"
      ? "Directly linked studies"
      : "Connected references";

  const relationsHTML = relationNodes.length
    ? `
      <div class="preview-relations">
        <div class="preview-relations-title">${relationsTitle}</div>
        <div class="preview-neighbor-list">
          ${relationNodes
            .map((neighbor) => {
              const label = neighbor.number
                ? `#${neighbor.number} ${neighbor.title}`
                : neighbor.title;
              return `
                <button class="preview-neighbor" type="button" data-node-id="${escapeAttribute(
                  neighbor.id
                )}">
                  ${escapeHTML(label)}
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `
    : "";

previewContent.innerHTML = `
  ${imageHTML}

  <div class="preview-scroll-body">
    <strong>${numberPrefix}${escapeHTML(node.title)}</strong>
    ${captionHTML}

    <div class="preview-category">
      ${escapeHTML(node.category)}
    </div>

    ${metricsHTML}
    ${relationsHTML}
    ${linkHTML}
  </div>
`;
  state.previewNodeId = node.id;
  state.previewPinned = !transient;

  preview.classList.add("is-open");
  preview.classList.toggle("is-pinned", !transient);
  preview.classList.toggle("is-linkable", !transient && Boolean(node.link));
  preview.dataset.transient = transient ? "true" : "false";
  preview.dataset.pinned = transient ? "false" : "true";
  preview.tabIndex = !transient && node.link ? 0 : -1;
  preview.setAttribute(
    "aria-label",
    !transient && node.link
      ? `${node.title}. Click again to open source.`
      : `${node.title}. Node details.`
  );

  if (!isTouchLayout() && event) {
    positionPreviewNearPointer(event);
  } else if (!isTouchLayout()) {
    positionPreviewBesideNode(node);
  }
}

function positionPreviewNearPointer(event) {
  if (!preview || isTouchLayout()) return;

  const margin = 12;
  const width = preview.offsetWidth || 240;
  const height = preview.offsetHeight || 160;
  let left = event.clientX + 12;
  let top = event.clientY + 12;

  if (left + width + margin > window.innerWidth) {
    left = event.clientX - width - 12;
  }
  if (top + height + margin > window.innerHeight) {
    top = event.clientY - height - 12;
  }

  preview.style.left = `${Math.max(margin, left)}px`;
  preview.style.top = `${Math.max(margin, top)}px`;
}

function positionPreviewBesideNode(node) {
  if (!preview || !state.svg || isTouchLayout()) return;

  const transform = d3.zoomTransform(state.svg.node());
  const [screenX, screenY] = transform.apply([node.x, node.y]);
  positionPreviewNearPointer({ clientX: screenX, clientY: screenY });
}

function hidePreview() {
  state.previewNodeId = null;
  state.previewPinned = false;
  preview?.classList.remove("is-open", "is-pinned", "is-linkable");
  if (preview) {
    preview.dataset.transient = "false";
    preview.dataset.pinned = "false";
    preview.tabIndex = -1;
    preview.setAttribute("aria-label", "Node details");
  }
  if (previewContent) previewContent.innerHTML = "";
}

function clearSelection(options = {}) {
  const { keepPreview = false } = options;
  state.selectedNodeId = null;
  state.selectedLink = null;
  updateSelectionStyles();
  if (!keepPreview) hidePreview();
}

function updateSelectionStyles() {
  state.nodeSelection?.classed(
    "is-selected",
    (node) => node.id === state.selectedNodeId
  );
}

function emphasizeConnections(nodeId) {
  if (!state.linkSelection || state.mode === "focus") return;

  state.linkSelection.style("opacity", (link) => {
    if (linkSelectionHidden(link)) return 0;
    return linkTouchesNode(link, nodeId) ? 0.9 : 0.08;
  });

  state.linkLabelSelection
    .filter((link) => link.relation)
    .style("display", (link) =>
      linkTouchesNode(link, nodeId) && !linkSelectionHidden(link)
        ? "block"
        : "none"
    );
}

function restoreConnectionOpacity() {
  if (!state.linkSelection) return;

  state.linkSelection.style("opacity", (link) =>
    linkSelectionHidden(link) ? 0 : state.mode === "focus" ? 0.62 : 0.5
  );
  hideAllLinkLabels();
}

function linkSelectionHidden(link) {
  const element = state.linkSelection
    ?.filter((candidate) => candidate.id === link.id)
    .node();
  return Boolean(
    element?.classList.contains("is-filtered-out") ||
      element?.classList.contains("focus-hidden") ||
      element?.classList.contains("focus-displayed-none")
  );
}

function showOnlyLinkLabel(linkId) {
  state.linkLabelSelection?.style("display", (link) =>
    link.id === linkId && !linkSelectionHidden(link) ? "block" : "none"
  );
}

function hideLinkLabel(linkId) {
  state.linkLabelSelection
    ?.filter((link) => link.id === linkId)
    .style("display", "none");
}

function toggleLinkLabel(linkId) {
  const label = state.linkLabelSelection?.filter(
    (link) => link.id === linkId
  );
  if (!label) return;

  const currentlyOpen = label.style("display") === "block";
  hideAllLinkLabels();
  if (!currentlyOpen) label.style("display", "block");
}

function hideAllLinkLabels() {
  state.linkLabelSelection?.style("display", "none");
}

function isLinkLabelOpen(linkId) {
  const node = state.linkLabelSelection
    ?.filter((link) => link.id === linkId)
    .node();
  return node?.style.display === "block";
}

function updateRankingList() {
  const config = getInfluenceMetricConfig();
  if (rankingDescription) {
    rankingDescription.textContent = config.description;
  }

  if (weightFormula) {
    const medianLabel = Number.isInteger(state.influenceMedian)
      ? state.influenceMedian
      : state.influenceMedian.toFixed(1);
    weightFormula.textContent = `Make node size relative to weight`;
  }

  if (!rankingList) return;

  const rankedNodes = state.nodes
    .filter((node) => config.eligible(node) && nodeMatchesBaseFilters(node))
    .map((node) => ({
      node,
      score: config.score(node),
      degree: getNodeMetrics(node).degree,
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.degree - a.degree ||
        a.node.title.localeCompare(b.node.title)
    )
    .slice(0, 8);

  if (!rankedNodes.length) {
    rankingList.innerHTML =
      '<li class="ranking-empty">No ranked nodes match the current filters.</li>';
    return;
  }

  let displayRank = 0;
  let previousScore = null;

  rankingList.innerHTML = rankedNodes
    .map((entry, index) => {
      if (entry.score !== previousScore) {
        displayRank = index + 1;
        previousScore = entry.score;
      }

      const unit = entry.score === 1 ? config.singular : config.plural;
      const numberPrefix = entry.node.number
        ? `#${entry.node.number} `
        : "";

      return `
        <li>
          <button
            class="ranking-item"
            type="button"
            data-node-id="${escapeAttribute(entry.node.id)}"
            title="${escapeAttribute(entry.node.title)}"
          >
            <span class="ranking-position">${displayRank}</span>
            <span class="ranking-name">${escapeHTML(
              numberPrefix + entry.node.title
            )}</span>
            <span class="ranking-score">${entry.score} ${unit} · ${formatWeightRatio(entry.score)}×</span>
          </button>
        </li>
      `;
    })
    .join("");
}

function formatWeightRatio(score) {
  const median = Math.max(state.influenceMedian || 1, 1);
  const ratio = score / median;
  return Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(1);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function updateMetricVisuals(options = {}) {
  const { restartSimulation = true } = options;
  const config = getInfluenceMetricConfig();
  const median = Math.max(state.influenceMedian || 1, 1);

  state.nodes.forEach((node) => {
    const eligible = config.eligible(node);
    const score = eligible ? config.score(node) : 0;
    const relativeWeight = score > 0 ? score / median : 0;

    node._visualScale =
      state.sizeByMetric && eligible
        ? clamp(relativeWeight, 0.5, 5)
        : 1;
  });

  state.nodeSelection?.attr("transform", nodeTransform);

  const collision = state.simulation?.force("collision");
  collision?.radius(
    (node) =>
      (Math.max(node._width, node._height) / 2) *
        (node._visualScale || 1) +
      10
  );

  if (restartSimulation && state.simulation) {
    state.simulation.alpha(0.28).restart();
  }
}

function nodeTransform(node) {
  const x = Number.isFinite(node.x) ? node.x : 0;
  const y = Number.isFinite(node.y) ? node.y : 0;
  return `translate(${x},${y}) scale(${node._visualScale || 1})`;
}

function updateResultCount(visibleNodeIds, linkVisible) {
  if (!resultCount) return;

  const visibleLinks = state.links.filter(linkVisible).length;
  const modeSuffix = state.mode === "focus" ? " · focus" : "";
  resultCount.textContent = `${visibleNodeIds.size}/${state.nodes.length} nodes · ${visibleLinks}/${state.links.length} links${modeSuffix}`;
}

function updateFocusResultCount(nodeIds, linkIds) {
  if (!resultCount) return;
  resultCount.textContent = `${nodeIds.size}/${state.nodes.length} nodes · ${linkIds.size}/${state.links.length} links · focus`;
}

function createDragBehavior() {
  return d3
    .drag()
    .on("start", (event, node) => {
      if (!event.active) state.simulation?.alphaTarget(0.3).restart();
      node.fx = node.x;
      node.fy = node.y;
    })
    .on("drag", (event, node) => {
      node.fx = event.x;
      node.fy = event.y;
    })
    .on("end", (event, node) => {
      if (!event.active) state.simulation?.alphaTarget(0);
      node.fx = null;
      node.fy = null;
    });
}

function resizeDiagram() {
  if (!state.svg || !state.simulation) return;

  const { width, height } = diagramContainer.getBoundingClientRect();
  state.svg
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  state.simulation.force("center", d3.forceCenter(width / 2, height / 2));
  state.simulation.alpha(0.25).restart();

  if (state.mode === "focus" && state.selectedNodeId) {
    const { nodeIds } = getFocusNeighborhood(state.selectedNodeId);
    zoomToNodeSet(nodeIds, false);
  }
}

function isNodeHidden(node) {
  const element = state.nodeSelection
    ?.filter((candidate) => candidate.id === node.id)
    .node();
  return Boolean(
    element?.classList.contains("is-filtered-out") ||
      element?.classList.contains("focus-hidden") ||
      element?.classList.contains("focus-displayed-none")
  );
}

function linkTouchesNode(link, nodeId) {
  return (
    linkEndpointId(link.source) === nodeId ||
    linkEndpointId(link.target) === nodeId
  );
}

function linkEndpointId(endpoint) {
  return typeof endpoint === "object" ? endpoint.id : endpoint;
}

function colorForCategory(category) {
  return colorMap[category] || colorMap.default;
}

function nodeAccessibleLabel(node) {
  const number = node.number ? `Study ${node.number}. ` : "";
  const metrics = getNodeMetrics(node);
  return `${number}${node.title}. ${node.category}. ${metrics.degree} relations. ${node.caption}`.trim();
}

function wrapWords(text, maxCharacters) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let currentLine = [];

  words.forEach((word) => {
    const testLine = [...currentLine, word].join(" ");
    if (testLine.length > maxCharacters && currentLine.length) {
      lines.push(currentLine.join(" "));
      currentLine = [word];
    } else {
      currentLine.push(word);
    }
  });

  if (currentLine.length) lines.push(currentLine.join(" "));
  return lines;
}

function normalizeSearch(value) {
  return clean(value).toLowerCase();
}

function clean(value) {
  return String(value ?? "").trim();
}

function isTouchLayout() {
  return window.matchMedia("(max-width: 768px), (hover: none)").matches;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function escapeHTML(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replaceAll("`", "&#096;");
}
