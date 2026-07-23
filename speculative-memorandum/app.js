"use strict";

// Keep the working /exec URL from your deployed copy when replacing this file.
const API_URL = "https://script.google.com/macros/s/AKfycbxJMexOcHzCfZ6mNz2MN-23iN0nR97oWueG0AUJofh7WN16mTcKAtuyIx85PeIqawSI/exec";
const DEMO_MODE = API_URL.indexOf("PASTE_YOUR") !== -1;

// Graph rendering: retained from the original QCWU map, adapted to two entry kinds.
const MAX_NODE_W = 190;
const NODE_PAD_X = 18;
const NODE_PAD_Y = 12;
const EDGE_OFFSET = 32;
const EDGE_COLOR = "rgba(70, 82, 73, 0.66)";
const EDGE_NODE_GAP = 6;
const ARROW_TIP_OVERHANG = 0.7;

const state = {
  rawEntries: [],
  rawRelations: [],
  versions: [],
  entries: [],
  relations: [],
  selected: null,
  search: "",
  keywordFilters: new Set(),
  focusMode: false,
  pendingBranchFrom: "",
  simulation: null,
  lastPointer: { x: 120, y: 120 },
  hasLoaded: false,
  refreshToken: 0,
  graphTransform: null,
  positionCache: new Map(),
  renderedGraph: null
};

const els = {
  loadingOverlay: document.querySelector("#loadingOverlay"),
  graphPanel: document.querySelector(".graphPanel"),
  graph: document.querySelector("#graph"),
  refreshButton: document.querySelector("#btnReload"),
  preview: document.querySelector("#preview"),
  previewLabel: document.querySelector("#previewLabel"),
  previewBody: document.querySelector("#previewBody"),
  previewClose: document.querySelector("#previewClose"),
  emptyState: document.querySelector("#emptyState"),
  lastUpdated: document.querySelector("#lastUpdated"),
  connectionStatus: document.querySelector("#connectionStatus"),
  searchInput: document.querySelector("#mapSearch"),
  focusToggle: document.querySelector("#focusModeToggle"),
  resultCount: document.querySelector("#filterResultCount"),
  entryPanel: document.querySelector("#formWrap"),
  relationPanel: document.querySelector("#relationFormWrap"),
  editPanel: document.querySelector("#editFormWrap"),
  entryForm: document.querySelector("#entryForm"),
  relationForm: document.querySelector("#relationForm"),
  editForm: document.querySelector("#editForm"),
  entryEditFields: document.querySelector("#entryEditFields"),
  relationEditFields: document.querySelector("#relationEditFields"),
  branchNotice: document.querySelector("#branchNotice"),
  entryHeading: document.querySelector("#entryFormHeading"),
  keywordSuggestions: document.querySelector("#keywordSuggestions")
};

const keywordPickers = new Map();

const demoData = {
  entries: [
    {
      entry_id: "entry_memo_01",
      created_at: "2031-04-03T09:00:00Z",
      entry_kind: "memorandum",
      label_or_number: "Clause 1.1",
      title: "Reciprocal exposure",
      body: "The Institution and the Collective agree that exposure is not a service delivered by one party to another, but a condition they produce and endure together.",
      keywords: "exposure, reciprocity, institution",
      attachment_url: "",
      created_by: "Demonstration"
    },
    {
      entry_id: "entry_deriv_01",
      created_at: "2031-04-03T09:20:00Z",
      entry_kind: "derivative",
      label_or_number: "SECURITY LOG 04/03",
      title: "The door remained unlocked",
      body: "At 02:14, a guard records that the gallery door refused to recognize the distinction between staff and visitor.",
      keywords: "security, access, misreading",
      attachment_url: "",
      created_by: "Demonstration"
    },
    {
      entry_id: "entry_memo_02",
      created_at: "2031-04-03T09:40:00Z",
      entry_kind: "memorandum",
      label_or_number: "Clause 4.2",
      title: "Right of derivative narration",
      body: "Any consequence of this agreement may be narrated by either party, including through documents whose factual status remains unresolved.",
      keywords: "narration, evidence, fiction",
      attachment_url: "",
      created_by: "Demonstration"
    }
  ],
  relations: [
    {
      relation_id: "relation_demo_01",
      created_at: "2031-04-03T10:00:00Z",
      from_id: "entry_memo_01",
      to_id: "entry_deriv_01",
      relation_text: "is misread as an operational instruction by",
      attachment_url: "",
      created_by: "Demonstration"
    },
    {
      relation_id: "relation_demo_02",
      created_at: "2031-04-03T10:10:00Z",
      from_id: "entry_memo_02",
      to_id: "entry_deriv_01",
      relation_text: "retroactively authorizes",
      attachment_url: "",
      created_by: "Demonstration"
    }
  ],
  versions: []
};

function init() {
  setupKeywordPickers();
  bindEvents();
  loadData({ initial: true });
}

function bindEvents() {
  els.refreshButton.addEventListener("click", event => {
    event.preventDefault();
    loadData();
  });
  document.querySelector("#btnToggleForm").addEventListener("click", () => openEntryPanel());
  document.querySelector("#btnToggleRelationForm").addEventListener("click", () => openRelationPanel());
  document.querySelector("#btnCancel").addEventListener("click", () => hidePanel(els.entryPanel));
  document.querySelector("#btnRelationCancel").addEventListener("click", () => hidePanel(els.relationPanel));
  document.querySelector("#btnEditCancel").addEventListener("click", () => hidePanel(els.editPanel));
  document.querySelector("#btnResetFilters").addEventListener("click", resetFilters);
  els.previewClose.addEventListener("click", clearSelection);

  els.searchInput.addEventListener("input", event => {
    state.search = event.target.value.trim().toLowerCase();
    renderGraph();
  });

  els.focusToggle.addEventListener("change", event => {
    state.focusMode = Boolean(event.target.checked);
    renderGraph();
    if (state.selected) refreshPreview();
  });

  els.entryForm.addEventListener("submit", submitEntry);
  els.relationForm.addEventListener("submit", submitRelation);
  els.editForm.addEventListener("submit", submitVersion);
  els.editForm.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      els.editForm.requestSubmit();
    }
  });

  els.previewBody.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button || !state.selected) return;
    const action = button.dataset.action;
    if (state.selected.kind === "entry") {
      const entry = entryById(state.selected.id);
      if (!entry) return;
      if (action === "edit") openEditEntry(entry);
      if (action === "branch") openEntryPanel(entry.entry_id);
      if (action === "connect") openRelationPanel(entry.entry_id);
    } else if (state.selected.kind === "relation" && action === "edit") {
      const relation = relationById(state.selected.id);
      if (relation) openEditRelation(relation);
    }
  });

  window.addEventListener("resize", debounce(renderGraph, 120));
}

async function loadData(options = {}) {
  const initial = options.initial === true || !state.hasLoaded;
  const refreshToken = ++state.refreshToken;

  if (initial) showLoading(true);
  else setDiagramRefreshing(true);

  setConnectionStatus(
    DEMO_MODE
      ? "Demo mode — deploy the Apps Script backend to write."
      : initial ? "Loading…" : "Refreshing diagram…"
  );
  try {
    const data = DEMO_MODE ? demoData : await fetchJson(`${API_URL}?action=get&_=${Date.now()}`);
    if (data.ok === false) throw new Error(data.error || "The backend returned an error.");

    state.rawEntries = Array.isArray(data.entries) ? data.entries : [];
    state.rawRelations = Array.isArray(data.relations) ? data.relations : [];
    state.versions = Array.isArray(data.versions) ? data.versions : [];
    state.entries = (Array.isArray(data.effective_entries)
      ? data.effective_entries
      : resolveEntries(state.rawEntries, state.versions))
      .map(normalizeEntryKeywords);
    state.relations = Array.isArray(data.effective_relations)
      ? data.effective_relations
      : resolveRelations(state.rawRelations, state.versions);

    populateEntrySelects();
    populateKeywordSuggestions();
    validateSelection();
    renderGraph();
    refreshPreview();

    const now = new Date();
    els.lastUpdated.textContent = DEMO_MODE
      ? "Demo data"
      : `Last refreshed ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    setConnectionStatus(
      DEMO_MODE
        ? "Demo mode — sample data only."
        : `${state.entries.length} entries · ${state.relations.length} relations · ${state.versions.length} appended versions`
    );
  } catch (error) {
    console.error(error);
    els.lastUpdated.textContent = "Could not refresh";
    setConnectionStatus(error.message, true);
  } finally {
    state.hasLoaded = true;
    if (refreshToken === state.refreshToken) {
      if (initial) showLoading(false);
      else setDiagramRefreshing(false);
    }
  }
}

function resolveEntries(entries, versions) {
  const latest = latestVersionsMap(versions, "entry");
  return entries.map(base => {
    const version = latest.get(String(base.entry_id));
    return version ? {
      entry_id: base.entry_id,
      created_at: base.created_at,
      created_by: base.created_by,
      entry_kind: version.entry_kind,
      title: version.title,
      body: version.body,
      keywords: version.keywords || "",
      label_or_number: version.label_or_number,
      attachment_url: version.attachment_url,
      current_version_id: version.version_id,
      updated_at: version.created_at,
      updated_by: version.created_by
    } : {
      ...base,
      current_version_id: "",
      updated_at: base.created_at,
      updated_by: base.created_by
    };
  });
}

function resolveRelations(relations, versions) {
  const latest = latestVersionsMap(versions, "relation");
  return relations.map(base => {
    const version = latest.get(String(base.relation_id));
    return version ? {
      relation_id: base.relation_id,
      created_at: base.created_at,
      created_by: base.created_by,
      from_id: version.from_id,
      to_id: version.to_id,
      relation_text: version.relation_text,
      attachment_url: version.attachment_url,
      current_version_id: version.version_id,
      updated_at: version.created_at,
      updated_by: version.created_by
    } : {
      ...base,
      current_version_id: "",
      updated_at: base.created_at,
      updated_by: base.created_by
    };
  });
}

function latestVersionsMap(versions, targetKind) {
  const map = new Map();
  versions.forEach(version => {
    if (String(version.target_kind) === targetKind) {
      map.set(String(version.target_id), version);
    }
  });
  return map;
}

function filteredGraphData() {
  const query = state.search;
  const relationMatchIds = new Set();

  if (query) {
    state.relations.forEach(relation => {
      const haystack = [relation.relation_text, relation.created_by].join(" ").toLowerCase();
      if (haystack.includes(query)) {
        relationMatchIds.add(String(relation.from_id));
        relationMatchIds.add(String(relation.to_id));
      }
    });
  }

  let entries = state.entries.filter(entry => {
    const entryKeywords = parseKeywords(entry.keywords);
    if (state.keywordFilters.size && !entryKeywords.some(keyword => state.keywordFilters.has(keyword))) {
      return false;
    }
    if (!query) return true;
    const haystack = [entry.title, entry.body, entry.label_or_number, entry.created_by, entryKeywords.join(" ")]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query) || relationMatchIds.has(String(entry.entry_id));
  });

  if (state.focusMode && state.selected) {
    const focusIds = new Set();
    if (state.selected.kind === "entry") {
      focusIds.add(state.selected.id);
      state.relations.forEach(relation => {
        if (String(relation.from_id) === state.selected.id) focusIds.add(String(relation.to_id));
        if (String(relation.to_id) === state.selected.id) focusIds.add(String(relation.from_id));
      });
    } else {
      const relation = relationById(state.selected.id);
      if (relation) {
        focusIds.add(String(relation.from_id));
        focusIds.add(String(relation.to_id));
      }
    }
    entries = entries.filter(entry => focusIds.has(String(entry.entry_id)));
  }

  const ids = new Set(entries.map(entry => String(entry.entry_id)));
  let relations = state.relations.filter(relation =>
    ids.has(String(relation.from_id)) && ids.has(String(relation.to_id))
  );

  if (state.focusMode && state.selected && state.selected.kind === "entry") {
    relations = relations.filter(relation =>
      String(relation.from_id) === state.selected.id || String(relation.to_id) === state.selected.id
    );
  }
  if (state.focusMode && state.selected && state.selected.kind === "relation") {
    relations = relations.filter(relation => String(relation.relation_id) === state.selected.id);
  }

  return {
    entries: entries.map(entry => ({ ...entry })),
    relations: relations.map(relation => ({
      ...relation,
      source: String(relation.from_id),
      target: String(relation.to_id)
    }))
  };
}

function renderGraph() {
  const { entries, relations } = filteredGraphData();
  const width = Math.max(els.graph.clientWidth, 420);
  const height = Math.max(els.graph.clientHeight, 460);

  if (state.simulation) {
    state.simulation.stop();
    state.simulation = null;
  }

  assignParallelEdgeOffsets(relations);
  seedNodePositions(entries, width, height);

  els.graph.innerHTML = "";
  els.emptyState.classList.toggle("hidden", entries.length > 0);
  els.resultCount.textContent = `${entries.length} of ${state.entries.length} entries · ${relations.length} relations`;
  state.renderedGraph = null;

  if (!entries.length) return;

  const svg = d3.select(els.graph)
    .append("svg")
    .attr("class", `mapSvg${state.focusMode ? " is-focus-mode" : ""}`)
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  const defs = svg.append("defs");
  defs.append("marker")
    .attr("id", "arrow-relation")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 9)
    .attr("refY", 0)
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", 7)
    .attr("markerHeight", 7)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", EDGE_COLOR);

  const root = svg.append("g").attr("class", "zoomLayer");
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.25, 5])
    .on("zoom", event => {
      root.attr("transform", event.transform);
      state.graphTransform = event.transform;
    });

  svg.call(zoomBehavior);
  if (state.graphTransform) {
    svg.call(zoomBehavior.transform, state.graphTransform);
  }

  const linkLayer = root.append("g").attr("class", "linkLayer");
  const labelLayer = root.append("g").attr("class", "edgeLabelLayer");
  const nodeLayer = root.append("g").attr("class", "nodeLayer");

  const edge = linkLayer.selectAll("path.edge")
    .data(relations, relation => relation.relation_id)
    .join("path")
    .attr("class", "edge")
    .attr("fill", "none")
    .attr("stroke", EDGE_COLOR)
    .attr("marker-end", "url(#arrow-relation)")
    .on("mouseenter", (event, relation) => {
      d3.select(event.currentTarget).classed("hovered", true);
      edgeLabel.classed("edge-label-visible", item => item.relation_id === relation.relation_id);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).classed("hovered", false);
      applyGraphSelectionStyles();
    })
    .on("click", (event, relation) => {
      event.stopPropagation();
      rememberPointer(event);
      selectItem("relation", relation.relation_id);
    });

  const edgeHit = linkLayer.selectAll("path.edge-hit")
    .data(relations, relation => relation.relation_id)
    .join("path")
    .attr("class", "edge-hit")
    .attr("fill", "none")
    .on("mouseenter", (_, relation) => {
      edge.classed("hovered", item => item.relation_id === relation.relation_id);
      edgeLabel.classed("edge-label-visible", item => item.relation_id === relation.relation_id);
    })
    .on("mouseleave", () => {
      edge.classed("hovered", false);
      applyGraphSelectionStyles();
    })
    .on("click", (event, relation) => {
      event.stopPropagation();
      rememberPointer(event);
      selectItem("relation", relation.relation_id);
    });

  const edgeLabel = labelLayer.selectAll("text.edge-label")
    .data(relations, relation => relation.relation_id)
    .join("text")
    .attr("class", "edge-label")
    .attr("data-relation-id", relation => relation.relation_id)
    .text(relation => truncate(relation.relation_text, 52))
    .on("click", (event, relation) => {
      event.stopPropagation();
      rememberPointer(event);
      selectItem("relation", relation.relation_id);
    });

  const node = nodeLayer.selectAll("g.node")
    .data(entries, entry => entry.entry_id)
    .join("g")
    .attr("class", entry => `node ${entry.entry_kind}`)
    .on("mouseenter", (_, entry) => {
      edge.classed("is-emphasized", relation => isConnected(relation, entry.entry_id));
      edge.classed("is-dimmed", relation => !isConnected(relation, entry.entry_id));
      edgeLabel.classed("edge-label-visible", relation => isConnected(relation, entry.entry_id));
    })
    .on("mouseleave", () => {
      edge.classed("is-emphasized", false).classed("is-dimmed", false);
      applyGraphSelectionStyles();
    })
    .on("click", (event, entry) => {
      event.stopPropagation();
      rememberPointer(event);
      selectItem("entry", entry.entry_id);
    })
    .call(d3.drag()
      .on("start", dragStarted)
      .on("drag", dragged)
      .on("end", dragEnded));

  node.append("rect")
    .attr("class", "node-hit")
    .attr("fill", "transparent")
    .style("pointer-events", "all");

  node.append("rect")
    .attr("class", "node-bg");

  node.append("text")
    .attr("class", "node-label")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("pointer-events", "none");

  node.append("title").text(entry => {
    const keywords = parseKeywords(entry.keywords);
    return `${entry.title || "Untitled"}\n${truncate(entry.body, 180)}${keywords.length ? `\nKeywords: ${keywords.join(", ")}` : ""}`;
  });

node.each(function(entry) {
  const group = d3.select(this);
  const text = group.select("text.node-label");
  text.text(null);

  appendWrappedLines(
    text,
    entry.title || "Untitled",
    "node-title",
    MAX_NODE_W
  );

  text.append("tspan")
    .attr("class", "node-type")
    .attr("x", 0)
    .attr("dy", "1.45em")
    .text(entry.entry_kind);

  const note =
    entry.label_or_number ||
    parseKeywords(entry.keywords).slice(0, 3).join(" · ");

  if (note) {
    text.append("tspan")
      .attr("class", "node-note")
      .attr("x", 0)
      .attr("dy", "1.35em")
      .text(truncate(note, 38));
  }

  recenterText(text);

  /*
   * Measure the text, then translate it so that its exact bounding-box
   * centre coincides with the D3 node position at 0,0.
   */
  const textBox = text.node().getBBox();
  const textCentreX = textBox.x + textBox.width / 2;
  const textCentreY = textBox.y + textBox.height / 2;

  text.attr(
    "transform",
    `translate(${-textCentreX}, ${-textCentreY})`
  );

  const nodeWidth = textBox.width + NODE_PAD_X * 2;
  const nodeHeight = textBox.height + NODE_PAD_Y * 2;

  /*
   * Centre the visible rectangle explicitly around 0,0.
   * nodeBoundaryPoint() already assumes this geometry.
   */
  const x = -nodeWidth / 2;
  const y = -nodeHeight / 2;

  entry._w = nodeWidth;
  entry._h = nodeHeight;

  const corner =
    entry.entry_kind === "derivative"
      ? Math.min(24, nodeHeight / 2)
      : 12;

  entry._r = corner;

  group.select("rect.node-bg")
    .attr("x", x)
    .attr("y", y)
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .attr("rx", corner)
    .attr("ry", corner);

  group.select("rect.node-hit")
    .attr("x", x)
    .attr("y", y)
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .attr("rx", corner)
    .attr("ry", corner);
});

  svg.on("click", event => {
    rememberPointer(event);
    clearSelection();
  });

  const degreeByNode = calculateNodeDegrees(relations);

  state.renderedGraph = {
    svg,
    zoomBehavior,
    root,
    node,
    edge,
    edgeHit,
    edgeLabel,
    entries,
    relations
  };

  state.simulation = d3.forceSimulation(entries)
    .force("link", d3.forceLink(relations)
      .id(entry => String(entry.entry_id))
      .distance(relation => {
        const sourceDegree = degreeByNode.get(String(relation.from_id)) || 1;
        const targetDegree = degreeByNode.get(String(relation.to_id)) || 1;
        const hubAdjustment = Math.min(80, (sourceDegree + targetDegree) * 5);
        const baseDistance = relation.parallelTotal > 1 ? 245 : 205;
        return baseDistance + hubAdjustment;
      })
      .strength(0.12)
      .iterations(4))
    .force("charge", d3.forceManyBody()
      .strength(entry => {
        const degree = degreeByNode.get(String(entry.entry_id)) || 1;
        return -520 - Math.min(360, degree * 32);
      })
      .distanceMin(80)
      .distanceMax(1000))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX(width / 2).strength(0.008))
    .force("y", d3.forceY(height / 2).strength(0.008))
    .force("collision", d3.forceCollide()
      .radius(entry => Math.max(
        68,
        Math.sqrt((entry._w || 100) ** 2 + (entry._h || 60) ** 2) / 2 + 30
      ))
      .strength(1)
      .iterations(3));

  state.simulation.alphaDecay(0.035);
  state.simulation.velocityDecay(0.62);

  state.simulation.on("tick", () => {
    edge.attr("d", edgePath);
    edgeHit.attr("d", edgePath);
    edgeLabel
      .attr("x", relation => edgeLabelPoint(relation).x)
      .attr("y", relation => edgeLabelPoint(relation).y)
      .attr("transform", relation => {
        const point = edgeLabelPoint(relation);
        return `rotate(${point.angle}, ${point.x}, ${point.y})`;
      });
    node.attr("transform", entry => {
      state.positionCache.set(String(entry.entry_id), { x: entry.x, y: entry.y });
      return `translate(${entry.x}, ${entry.y})`;
    });
  });

  applyGraphSelectionStyles();

  function dragStarted(event, entry) {
    event.sourceEvent?.stopPropagation?.();
    if (!event.active) state.simulation.alphaTarget(0.25).restart();
    entry.fx = entry.x;
    entry.fy = entry.y;
  }

  function dragged(event, entry) {
    entry.fx = event.x;
    entry.fy = event.y;
  }

  function dragEnded(event, entry) {
    if (!event.active) state.simulation.alphaTarget(0);
    entry.fx = null;
    entry.fy = null;
  }
}

function seedNodePositions(entries, width, height) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  entries.forEach((entry, index) => {
    const cached = state.positionCache.get(String(entry.entry_id));
    if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.y)) {
      entry.x = cached.x;
      entry.y = cached.y;
      return;
    }
    const radius = 34 * Math.sqrt(index + 1);
    const angle = index * goldenAngle;
    entry.x = width / 2 + Math.cos(angle) * radius;
    entry.y = height / 2 + Math.sin(angle) * radius;
  });
}

function assignParallelEdgeOffsets(relations) {
  const groups = new Map();
  relations.forEach(relation => {
    const a = String(relation.from_id);
    const b = String(relation.to_id);
    const key = a < b ? `${a}__${b}` : `${b}__${a}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(relation);
  });

  groups.forEach(group => {
    group.sort((a, b) => String(a.relation_id).localeCompare(String(b.relation_id)));
    const total = group.length;
    group.forEach((relation, index) => {
      relation.parallelIndex = index;
      relation.parallelTotal = total;
      relation.curveOffset = (index - (total - 1) / 2) * EDGE_OFFSET;
      if (String(relation.from_id) > String(relation.to_id)) relation.curveOffset *= -1;
    });
  });
}

function calculateNodeDegrees(relations) {
  const degree = new Map();
  relations.forEach(relation => {
    const from = String(relation.from_id);
    const to = String(relation.to_id);
    degree.set(from, (degree.get(from) || 0) + 1);
    degree.set(to, (degree.get(to) || 0) + 1);
  });
  return degree;
}

function isConnected(relation, entryId) {
  const id = String(entryId);
  return String(relation.from_id) === id || String(relation.to_id) === id;
}

function nodeBoundaryPoint(node, toward, gap = EDGE_NODE_GAP) {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const halfWidth = Math.max(1, (node._w || 100) / 2);
  const halfHeight = Math.max(1, (node._h || 60) / 2);
  const radius = Math.max(0, Math.min(node._r || 0, halfWidth, halfHeight));

  const tx = Math.abs(ux) > 1e-9 ? halfWidth / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-9 ? halfHeight / Math.abs(uy) : Infinity;
  const boxDistance = Math.min(tx, ty);
  const boxX = ux * boxDistance;
  const boxY = uy * boxDistance;

  let boundaryDistance = boxDistance;
  const hitsVerticalStraight = tx <= ty && Math.abs(boxY) <= halfHeight - radius;
  const hitsHorizontalStraight = ty <= tx && Math.abs(boxX) <= halfWidth - radius;

  if (radius > 0 && !hitsVerticalStraight && !hitsHorizontalStraight) {
    const cornerX = Math.sign(ux || 1) * (halfWidth - radius);
    const cornerY = Math.sign(uy || 1) * (halfHeight - radius);
    const projection = ux * cornerX + uy * cornerY;
    const cornerSquared = cornerX * cornerX + cornerY * cornerY;
    const discriminant = Math.max(0, projection * projection - (cornerSquared - radius * radius));
    boundaryDistance = projection + Math.sqrt(discriminant);
  }

  const distance = boundaryDistance + gap;
  return { x: node.x + ux * distance, y: node.y + uy * distance };
}

function edgeGeometry(relation) {
  const source = relation.source;
  const target = relation.target;

  if (
    !source ||
    !target ||
    !Number.isFinite(source.x) ||
    !Number.isFinite(source.y) ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y)
  ) {
    return {
      sx: 0,
      sy: 0,
      tx: 0,
      ty: 0,
      cx: 0,
      cy: 0
    };
  }

  if (
    source === target ||
    String(source.entry_id) === String(target.entry_id)
  ) {
    const radius =
      Math.max(source._w || 100, source._h || 60) / 2 + 42;

    return {
      self: true,
      sx: source.x + (source._w || 100) / 2,
      sy: source.y,
      tx: source.x,
      ty: source.y + (source._h || 60) / 2,
      radius
    };
  }

  /*
   * Calculate the curve's control point from the node centres first.
   *
   * The previous version clipped both endpoints along the straight
   * centre-to-centre line. That is incorrect for a curved relation:
   * the visible line leaves and enters each node along the curve's
   * tangent, which can create a much larger gap at one end.
   */
  const centreDx = target.x - source.x;
  const centreDy = target.y - source.y;
  const centreLength = Math.max(
    1,
    Math.hypot(centreDx, centreDy)
  );

  const normalX = -centreDy / centreLength;
  const normalY = centreDx / centreLength;
  const offset = relation.curveOffset || 0;

  const controlPoint = {
    x:
      (source.x + target.x) / 2 +
      normalX * offset,
    y:
      (source.y + target.y) / 2 +
      normalY * offset
  };

  /*
   * Clip each end in the direction of its actual curve tangent.
   * The target receives a tiny extra offset to compensate for the
   * arrow tip extending beyond the SVG path endpoint.
   */
  const sourcePoint = nodeBoundaryPoint(
    source,
    controlPoint,
    EDGE_NODE_GAP
  );

  const targetPoint = nodeBoundaryPoint(
    target,
    controlPoint,
    EDGE_NODE_GAP + ARROW_TIP_OVERHANG
  );

  return {
    sx: sourcePoint.x,
    sy: sourcePoint.y,
    tx: targetPoint.x,
    ty: targetPoint.y,
    cx: controlPoint.x,
    cy: controlPoint.y
  };
}

function edgePath(relation) {
  const geometry = edgeGeometry(relation);
  if (geometry.self) {
    const { sx, sy, tx, ty, radius } = geometry;
    return `M ${sx} ${sy} C ${sx + radius} ${sy - radius}, ${tx + radius} ${ty + radius}, ${tx} ${ty}`;
  }
  return `M ${geometry.sx} ${geometry.sy} Q ${geometry.cx} ${geometry.cy} ${geometry.tx} ${geometry.ty}`;
}

function edgeLabelPoint(relation) {
  const geometry = edgeGeometry(relation);
  if (geometry.self) {
    return { x: geometry.sx + geometry.radius * 0.7, y: geometry.sy - geometry.radius * 0.45, angle: 0 };
  }
  const x = 0.25 * geometry.sx + 0.5 * geometry.cx + 0.25 * geometry.tx;
  const y = 0.25 * geometry.sy + 0.5 * geometry.cy + 0.25 * geometry.ty;
  const tangentX = geometry.tx - geometry.sx;
  const tangentY = geometry.ty - geometry.sy;
  let angle = Math.atan2(tangentY, tangentX) * 180 / Math.PI;
  if (angle > 90 || angle < -90) angle += 180;
  return { x, y, angle };
}

function appendWrappedLines(textSelection, value, className, maxWidth) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) words.push("Untitled");
  let line = [];
  let tspan = textSelection.append("tspan")
    .attr("class", className)
    .attr("x", 0)
    .attr("dy", 0);

  words.forEach(word => {
    line.push(word);
    tspan.text(line.join(" "));
    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
      line.pop();
      tspan.text(line.join(" "));
      line = [word];
      tspan = textSelection.append("tspan")
        .attr("class", className)
        .attr("x", 0)
        .attr("dy", "1.18em")
        .text(word);
    }
  });
}

function recenterText(textSelection) {
  const tspans = textSelection.selectAll("tspan").nodes();
  if (!tspans.length) return;
  const lineHeight = 1.18;
  const total = (tspans.length - 1) * lineHeight;
  d3.select(tspans[0]).attr("dy", `${-total / 2}em`);
}

function applyGraphSelectionStyles() {
  const rendered = state.renderedGraph;
  if (!rendered) return;
  const { node, edge, edgeLabel } = rendered;

  node.classed("selected", entry => isSelected("entry", entry.entry_id));
  edge.classed("selected", relation => isSelected("relation", relation.relation_id));

  edgeLabel.classed("edge-label-visible", relation => {
    if (!state.selected) return false;
    if (state.selected.kind === "relation") return state.selected.id === String(relation.relation_id);
    return isConnected(relation, state.selected.id);
  });
}

function selectItem(kind, id) {
  state.selected = { kind, id: String(id) };
  if (state.focusMode) renderGraph();
  else applyGraphSelectionStyles();
  refreshPreview();
}

function clearSelection() {
  state.selected = null;
  els.preview.classList.add("hidden");
  if (state.focusMode) renderGraph();
  else applyGraphSelectionStyles();
}

function isSelected(kind, id) {
  return Boolean(state.selected && state.selected.kind === kind && state.selected.id === String(id));
}

function validateSelection() {
  if (!state.selected) return;
  const exists = state.selected.kind === "entry"
    ? Boolean(entryById(state.selected.id))
    : Boolean(relationById(state.selected.id));
  if (!exists) state.selected = null;
}

function refreshPreview() {
  if (!state.selected) {
    els.preview.classList.add("hidden");
    return;
  }
  if (state.selected.kind === "entry") {
    const entry = entryById(state.selected.id);
    if (entry) renderEntryPreview(entry);
  } else {
    const relation = relationById(state.selected.id);
    if (relation) renderRelationPreview(relation);
  }
  positionPreview();
  els.preview.classList.remove("hidden");
}

function renderEntryPreview(entry) {
  const history = versionsFor("entry", entry.entry_id);
  els.previewLabel.textContent = entry.label_or_number
    ? `${entry.label_or_number} — ${entry.title || "Untitled"}`
    : entry.title || "Untitled";
  els.previewBody.innerHTML = `
    <span class="previewTag ${escapeHtml(entry.entry_kind)}">${escapeHtml(entry.entry_kind)}</span>
    <p class="previewLead">${escapeHtml(entry.title || "Untitled")}</p>
    <p class="previewText">${escapeHtml(entry.body || "")}</p>
    ${keywordListHtml(entry.keywords)}
    ${attachmentHtml(entry.attachment_url)}
    ${metadataHtml(entry)}
    <div class="previewActions">
      <button class="previewActionBtn" type="button" data-action="edit">Edit</button>
      <button class="previewActionBtn" type="button" data-action="branch">Branch derivative</button>
      <button class="previewActionBtn" type="button" data-action="connect">Connect</button>
    </div>
    ${versionHistoryHtml(history)}
  `;
}

function renderRelationPreview(relation) {
  const from = entryById(relation.from_id);
  const to = entryById(relation.to_id);
  const history = versionsFor("relation", relation.relation_id);
  els.previewLabel.textContent = truncate(relation.relation_text, 85) || "Relation";
  els.previewBody.innerHTML = `
    <span class="previewTag relation">relation</span>
    <div class="previewEndpoints">
      <span>${escapeHtml(from ? from.title || from.entry_id : relation.from_id)}</span>
      <strong>→</strong>
      <span>${escapeHtml(to ? to.title || to.entry_id : relation.to_id)}</span>
    </div>
    <p class="previewText">${escapeHtml(relation.relation_text || "")}</p>
    ${attachmentHtml(relation.attachment_url)}
    ${metadataHtml(relation)}
    <div class="previewActions">
      <button class="previewActionBtn" type="button" data-action="edit">Edit</button>
    </div>
    ${versionHistoryHtml(history)}
  `;
}

function positionPreview() {
  const panel = els.graph.closest(".graphPanel");
  if (!panel || window.matchMedia("(max-width: 980px)").matches) return;
  const rect = panel.getBoundingClientRect();
  const maxLeft = Math.max(12, rect.width - Math.min(560, rect.width * 0.46) - 12);
  const maxTop = Math.max(12, rect.height - Math.min(700, window.innerHeight * 0.74) - 12);
  const left = clamp(state.lastPointer.x - rect.left + 18, 12, maxLeft);
  const top = clamp(state.lastPointer.y - rect.top + 18, 12, maxTop);
  els.preview.style.left = `${left}px`;
  els.preview.style.top = `${top}px`;
}

function rememberPointer(event) {
  if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    state.lastPointer = { x: event.clientX, y: event.clientY };
  }
}

function metadataHtml(item) {
  const created = formatDate(item.created_at);
  const updated = formatDate(item.updated_at || item.created_at);
  return `<dl class="previewFacts">
    <dt>Created</dt><dd>${escapeHtml(created)}${item.created_by ? ` by ${escapeHtml(item.created_by)}` : ""}</dd>
    <dt>Current state</dt><dd>${escapeHtml(item.current_version_id || "base row")}</dd>
    <dt>Last saved</dt><dd>${escapeHtml(updated)}${item.updated_by ? ` by ${escapeHtml(item.updated_by)}` : ""}</dd>
  </dl>`;
}

function versionHistoryHtml(history) {
  if (!history.length) {
    return `<section class="versionSection"><h3 class="versionSectionTitle">Version history</h3><p class="previewNotes">No appended edits yet. The immutable base row is current.</p></section>`;
  }
  return `<section class="versionSection">
    <h3 class="versionSectionTitle">Version history</h3>
    ${history.map(version => `<article class="versionCard">
      <div class="versionMeta">${escapeHtml(formatDate(version.created_at))}${version.created_by ? ` · ${escapeHtml(version.created_by)}` : ""} · ${escapeHtml(version.version_id)}</div>
      <p class="versionNote">${escapeHtml(version.change_note || "Saved without a change note.")}</p>
    </article>`).join("")}
  </section>`;
}

function versionsFor(kind, id) {
  return state.versions
    .filter(version => String(version.target_kind) === kind && String(version.target_id) === String(id))
    .slice()
    .reverse();
}

function openEntryPanel(branchFrom = "") {
  const wasHidden = els.entryPanel.classList.contains("hidden");
  closeAllPanels();
  if (!wasHidden && !branchFrom) return;

  state.pendingBranchFrom = branchFrom ? String(branchFrom) : "";
  els.entryForm.reset();
  setKeywordPickerValues("entry", []);
  els.entryForm.elements.entry_kind.value = branchFrom ? "derivative" : "memorandum";
  els.entryHeading.textContent = branchFrom ? "Branch a derivative" : "Add an entry";

  const source = branchFrom ? entryById(branchFrom) : null;
  els.branchNotice.classList.toggle("hidden", !source);
  els.branchNotice.textContent = source
    ? `After creating this derivative, the relation form will open from “${source.title || "Untitled"}”.`
    : "";

  if (branchFrom) {
    els.entryForm.elements.connect_from_id.value = branchFrom;
  }
  els.entryPanel.classList.remove("hidden");
  scrollPanelIntoView(els.entryPanel);
  els.entryForm.elements.title.focus();
}

function openRelationPanel(fromId = "", toId = "") {
  const wasHidden = els.relationPanel.classList.contains("hidden");
  closeAllPanels();
  if (!wasHidden && !fromId && !toId) return;

  populateEntrySelects();
  els.relationForm.reset();
  if (fromId) els.relationForm.elements.from_id.value = String(fromId);
  if (toId) els.relationForm.elements.to_id.value = String(toId);
  els.relationPanel.classList.remove("hidden");
  scrollPanelIntoView(els.relationPanel);
  els.relationForm.elements.relation_text.focus();
}

function openEditEntry(entry) {
  closeAllPanels();
  els.editForm.reset();
  els.editForm.elements.target_kind.value = "entry";
  els.editForm.elements.target_id.value = entry.entry_id;
  els.editForm.elements.previous_version_id.value = entry.current_version_id || "";
  els.editForm.elements.entry_kind.value = entry.entry_kind;
  els.editForm.elements.label_or_number.value = entry.label_or_number || "";
  els.editForm.elements.title.value = entry.title || "";
  els.editForm.elements.body.value = entry.body || "";
  setKeywordPickerValues("edit", parseKeywords(entry.keywords));
  els.editForm.elements.attachment_url.value = entry.attachment_url || "";
  els.editForm.elements.created_by.value = entry.updated_by || entry.created_by || "";
  els.entryEditFields.classList.remove("hidden");
  els.relationEditFields.classList.add("hidden");
  document.querySelector("#editFormTitle").textContent = `Edit “${entry.title || "Untitled"}”`;
  els.editPanel.classList.remove("hidden");
  scrollPanelIntoView(els.editPanel);
  els.editForm.elements.body.focus();
}

function openEditRelation(relation) {
  closeAllPanels();
  populateEntrySelects();
  els.editForm.reset();
  setKeywordPickerValues("edit", []);
  els.editForm.elements.target_kind.value = "relation";
  els.editForm.elements.target_id.value = relation.relation_id;
  els.editForm.elements.previous_version_id.value = relation.current_version_id || "";
  els.editForm.elements.from_id.value = relation.from_id;
  els.editForm.elements.to_id.value = relation.to_id;
  els.editForm.elements.relation_text.value = relation.relation_text || "";
  els.editForm.elements.attachment_url.value = relation.attachment_url || "";
  els.editForm.elements.created_by.value = relation.updated_by || relation.created_by || "";
  els.entryEditFields.classList.add("hidden");
  els.relationEditFields.classList.remove("hidden");
  document.querySelector("#editFormTitle").textContent = "Edit relation";
  els.editPanel.classList.remove("hidden");
  scrollPanelIntoView(els.editPanel);
  els.editForm.elements.relation_text.focus();
}

function closeAllPanels() {
  [els.entryPanel, els.relationPanel, els.editPanel].forEach(hidePanel);
}

function hidePanel(panel) {
  panel.classList.add("hidden");
}

function scrollPanelIntoView(panel) {
  requestAnimationFrame(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }));
}

async function submitEntry(event) {
  event.preventDefault();
  if (!ensureWritable()) return;

  commitKeywordInput("entry");
  const formData = new FormData(els.entryForm);
  const connectFrom = String(formData.get("connect_from_id") || "").trim();
  const relationText = String(formData.get("connection_relation_text") || "").trim();
  const relationAttachment = String(formData.get("connection_attachment_url") || "").trim();
  formData.delete("connect_from_id");
  formData.delete("connection_relation_text");
  formData.delete("connection_attachment_url");

  setPanelStatus("formStatus", "Saving…");
  setFormBusy(els.entryForm, true);
  try {
    const result = await postForm("add_entry", formData);
    const newEntryId = result.entry && result.entry.entry_id;

    if (connectFrom && relationText && newEntryId) {
      const relationData = new FormData();
      relationData.set("from_id", connectFrom);
      relationData.set("to_id", newEntryId);
      relationData.set("relation_text", relationText);
      relationData.set("attachment_url", relationAttachment);
      relationData.set("created_by", String(formData.get("created_by") || ""));
      await postForm("add_relation", relationData);
    }

    hidePanel(els.entryPanel);
    await loadData();
    if (newEntryId) selectItem("entry", newEntryId);

    if (state.pendingBranchFrom && newEntryId && !relationText) {
      const branchFrom = state.pendingBranchFrom;
      state.pendingBranchFrom = "";
      openRelationPanel(branchFrom, newEntryId);
    } else {
      state.pendingBranchFrom = "";
    }
  } catch (error) {
    setPanelStatus("formStatus", error.message, true);
  } finally {
    setFormBusy(els.entryForm, false);
  }
}

async function submitRelation(event) {
  event.preventDefault();
  if (!ensureWritable()) return;
  const formData = new FormData(els.relationForm);
  setPanelStatus("relationFormStatus", "Saving…");
  setFormBusy(els.relationForm, true);
  try {
    const result = await postForm("add_relation", formData);
    const relationId = result.relation && result.relation.relation_id;
    hidePanel(els.relationPanel);
    await loadData();
    if (relationId) selectItem("relation", relationId);
  } catch (error) {
    setPanelStatus("relationFormStatus", error.message, true);
  } finally {
    setFormBusy(els.relationForm, false);
  }
}

async function submitVersion(event) {
  event.preventDefault();
  if (!ensureWritable()) return;
  if (String(els.editForm.elements.target_kind.value || "") === "entry") {
    commitKeywordInput("edit");
  }
  const formData = new FormData(els.editForm);
  const targetKind = String(formData.get("target_kind") || "");
  const targetId = String(formData.get("target_id") || "");
  setPanelStatus("editFormStatus", "Saving a new snapshot…");
  setFormBusy(els.editForm, true);
  try {
    await postForm("save_version", formData);
    hidePanel(els.editPanel);
    await loadData();
    selectItem(targetKind, targetId);
  } catch (error) {
    setPanelStatus("editFormStatus", error.message, true);
  } finally {
    setFormBusy(els.editForm, false);
  }
}

async function postForm(action, formData) {
  const payload = new URLSearchParams();
  payload.set("action", action);
  for (const [key, value] of formData.entries()) payload.set(key, String(value));
  const response = await fetch(API_URL, {
    method: "POST",
    body: payload,
    redirect: "follow"
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

async function fetchJson(url) {
  const response = await fetch(url, { redirect: "follow", cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);
  return data;
}

function populateEntrySelects() {
  const entries = state.entries
    .slice()
    .sort((a, b) => entryDisplay(a).localeCompare(entryDisplay(b)));

  const optionHtml = entries
    .map(entry => `<option value="${escapeAttribute(entry.entry_id)}">${escapeHtml(entryDisplay(entry))}</option>`)
    .join("");

  document.querySelectorAll('select[name="from_id"], select[name="to_id"]').forEach(select => {
    const previous = select.value;
    select.innerHTML = `<option value="">Select an entry</option>${optionHtml}`;
    if (previous) select.value = previous;
  });

  document.querySelectorAll('select[name="connect_from_id"]').forEach(select => {
    const previous = select.value;
    select.innerHTML = `<option value="">No connection</option>${optionHtml}`;
    if (previous) select.value = previous;
  });
}

function entryDisplay(entry) {
  const title = entry.title || "Untitled";
  return entry.label_or_number ? `${entry.label_or_number} — ${title}` : title;
}

function entryById(id) {
  return state.entries.find(entry => String(entry.entry_id) === String(id));
}

function relationById(id) {
  return state.relations.find(relation => String(relation.relation_id) === String(id));
}

function attachmentHtml(rawUrl) {
  const url = safeUrl(rawUrl);
  if (!url) return "";
  const embed = googleEmbedUrl(url);
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
  const preview = isImage
    ? `<img class="attachmentPreview" src="${escapeAttribute(url)}" alt="Attachment preview">`
    : embed
      ? `<div class="sourceEmbedWrap"><iframe class="sourceEmbed" src="${escapeAttribute(embed)}" title="Attachment preview" loading="lazy"></iframe></div>`
      : "";
  return `${preview}<a class="openLink" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">Open attachment ↗</a>`;
}

function googleEmbedUrl(url) {
  const patterns = [
    [/docs\.google\.com\/document\/d\/([^/]+)/, id => `https://docs.google.com/document/d/${id}/preview`],
    [/docs\.google\.com\/spreadsheets\/d\/([^/]+)/, id => `https://docs.google.com/spreadsheets/d/${id}/preview`],
    [/docs\.google\.com\/presentation\/d\/([^/]+)/, id => `https://docs.google.com/presentation/d/${id}/embed`],
    [/drive\.google\.com\/file\/d\/([^/]+)/, id => `https://drive.google.com/file/d/${id}/preview`]
  ];
  for (const [pattern, make] of patterns) {
    const match = url.match(pattern);
    if (match) return make(match[1]);
  }
  return "";
}

function safeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function normalizeEntryKeywords(entry) {
  return { ...entry, keywords: serializeKeywords(parseKeywords(entry && entry.keywords)) };
}

function parseKeywords(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/);
  const seen = new Set();
  return values
    .map(keyword => String(keyword || "").trim().replace(/\s+/g, " ").toLowerCase())
    .filter(keyword => keyword && !seen.has(keyword) && seen.add(keyword));
}

function serializeKeywords(keywords) {
  return parseKeywords(keywords).join(", ");
}

function allKeywords() {
  const values = new Set();
  state.entries.forEach(entry => parseKeywords(entry.keywords).forEach(keyword => values.add(keyword)));
  return [...values].sort((a, b) => a.localeCompare(b));
}

function populateKeywordSuggestions() {
  const existing = allKeywords();
  els.keywordSuggestions.innerHTML = existing
    .map(keyword => `<option value="${escapeAttribute(keyword)}"></option>`)
    .join("");
}

function setupKeywordPickers() {
  document.querySelectorAll("[data-keyword-picker]").forEach(root => {
    const name = root.dataset.keywordPicker;
    const input = root.querySelector("[data-keyword-text]");
    const tagList = root.querySelector("[data-keyword-tags]");
    const hidden = root.querySelector('input[type="hidden"][name="keywords"]');
    const picker = { name, root, input, tagList, hidden, values: [] };
    keywordPickers.set(name, picker);

    input.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        commitKeywordInput(name);
      } else if (event.key === "Backspace" && !input.value && picker.values.length) {
        setKeywordPickerValues(name, picker.values.slice(0, -1));
      }
    });
    input.addEventListener("change", () => commitKeywordInput(name));
    input.addEventListener("blur", () => {
      if (input.value.trim() && allKeywords().includes(normalizeKeyword(input.value))) {
        commitKeywordInput(name);
      }
    });
    tagList.addEventListener("click", event => {
      const button = event.target.closest("[data-remove-keyword]");
      if (!button) return;
      setKeywordPickerValues(name, picker.values.filter(keyword => keyword !== button.dataset.removeKeyword));
      input.focus();
    });
    root.addEventListener("click", event => {
      if (!event.target.closest("button")) input.focus();
    });
  });
}

function normalizeKeyword(value) {
  return parseKeywords([value])[0] || "";
}

function commitKeywordInput(name) {
  const picker = keywordPickers.get(name);
  if (!picker) return;
  const additions = parseKeywords(picker.input.value);
  picker.input.value = "";
  if (!additions.length) return;
  setKeywordPickerValues(name, [...picker.values, ...additions]);
}

function setKeywordPickerValues(name, values) {
  const picker = keywordPickers.get(name);
  if (!picker) return;
  picker.values = parseKeywords(values);
  picker.tagList.innerHTML = picker.values.map(keyword => `
    <span class="keywordChip">
      <span>${escapeHtml(keyword)}</span>
      <button type="button" data-remove-keyword="${escapeAttribute(keyword)}" aria-label="Remove ${escapeAttribute(keyword)}">×</button>
    </span>`).join("");
  if (picker.hidden) picker.hidden.value = serializeKeywords(picker.values);
  if (name === "filter") {
    state.keywordFilters = new Set(picker.values);
    renderGraph();
  }
}

function keywordListHtml(value) {
  const keywords = parseKeywords(value);
  if (!keywords.length) return "";
  return `<div class="previewKeywords" aria-label="Keywords">${keywords
    .map(keyword => `<span class="keywordChip static">${escapeHtml(keyword)}</span>`)
    .join("")}</div>`;
}

function resetFilters() {
  state.search = "";
  state.keywordFilters = new Set();
  state.focusMode = false;
  els.searchInput.value = "";
  els.focusToggle.checked = false;
  setKeywordPickerValues("filter", []);
  renderGraph();
}

function showLoading(show) {
  els.loadingOverlay.classList.toggle("hidden", !show);
}

function setDiagramRefreshing(refreshing) {
  els.graphPanel.classList.toggle("isRefreshing", refreshing);
  els.graph.setAttribute("aria-busy", String(refreshing));
  els.refreshButton.disabled = refreshing;
  els.refreshButton.textContent = refreshing ? "Refreshing…" : "Refresh now";
}

function setConnectionStatus(message, isError = false) {
  els.connectionStatus.textContent = message;
  els.connectionStatus.classList.toggle("errorText", isError);
}

function setPanelStatus(id, message, isError = false) {
  const element = document.querySelector(`#${id}`);
  element.textContent = message;
  element.classList.toggle("errorText", isError);
}

function ensureWritable() {
  if (!DEMO_MODE) return true;
  setConnectionStatus("Demo mode is read-only. Paste the deployed Apps Script /exec URL into app.js.", true);
  return false;
}

function setFormBusy(form, busy) {
  form.querySelectorAll("button, input, select, textarea").forEach(control => {
    control.disabled = busy;
  });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function truncate(value, length) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, match => `\\${match}`);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

init();
