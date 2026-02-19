// app.js
const API_URL = "https://script.google.com/macros/s/AKfycbzMP5-kMpyZYUdBqsWkow7ZyiZIpIyvJQXNqrDPujefgt40pRrGMdcAJfB7TvQsIHfFew/exec";
const HOVER_DELAY_MS = 220;

// Node label wrapping
const MAX_NODE_W = 260;

// Hit padding around text for hover/click area + highlight bg
const HIT_PAD_X = 10;
const HIT_PAD_Y = 6;

// Bubble placement
const BUBBLE_GAP = 18;
const BUBBLE_PAD = 14;

// Relation colors (primary bind types)
const REL_COLOR = {
  responds_to: "#2f6fff",
  agrees_with: "#2f6fff",
  disagrees_with: "#e24b4b",
  asks: "#7a7a86",
  co_constitutive: "#8b5cf6",
  extends: "#f59e0b",
  documents: "#f59e0b",
  clarifies: "#f59e0b"
};

// ---- State ----
let state = {
  seeds: [],
  edges: [],
  nodes: [],
  links: [],

  // title -> seed_id mapping for UI (IDs hidden)
  titleToId: new Map(),
  idToTitle: new Map(),

  hoverTimer: null,
  hoverOutTimer: null,

  hoveredNodeId: null,
  pinnedNodeId: null,
  overPreview: false,        // <-- NEW: cursor is over preview bubble
  overNode: false,           // <-- NEW: cursor is over node hitbox

  // Preview cache (avoid redundant iframe reload)
  previewNodeId: null,
  previewUrl: null
};

// DOM
const graphEl = document.getElementById("graph");
const btnReload = document.getElementById("btnReload");
const btnToggleForm = document.getElementById("btnToggleForm");
const formWrap = document.getElementById("formWrap");
const seedForm = document.getElementById("seedForm");
const formStatus = document.getElementById("formStatus");
const btnCancel = document.getElementById("btnCancel");

// Preview bubble
const preview = document.getElementById("preview");
const previewFrame = document.getElementById("previewFrame");
const previewLabel = document.getElementById("previewLabel");
const previewMeta = document.getElementById("previewMeta");
const previewClose = document.getElementById("previewClose");

// Primary bind title/id inputs
const primaryBindTitle = document.getElementById("primaryBindTitle"); // name="primary_bind_title"
const primaryBindId = document.getElementById("primaryBindId");       // name="primary_bind" (hidden)

// Datalist for titles
const seedTitleList = document.getElementById("seedTitleList");

// Chips UI (in_conversation_with)
const icwInput = document.getElementById("icwInput");
const icwAddBtn = document.getElementById("icwAddBtn");
const icwChips = document.getElementById("icwChips");
const icwHidden = document.getElementById("icwHidden");
const icwSet = new Set(); // seed_ids (internal only)

// ---- Preview bubble hover wiring (CRITICAL to stop flicker) ----
(function wirePreviewHover() {
  if (!preview) return;

  // Allow preview bubble to "hold" the hover state
  preview.addEventListener("mouseenter", () => {
    state.overPreview = true;
    if (state.hoverOutTimer) clearTimeout(state.hoverOutTimer);
    state.hoverOutTimer = null;
  });

  preview.addEventListener("mouseleave", () => {
    state.overPreview = false;
    scheduleHoverClose();
  });

  previewClose?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.pinnedNodeId = null;
    hidePreview();
  });
})();

// ---- Buttons ----
btnReload?.addEventListener("click", () => loadAndRender());
btnToggleForm?.addEventListener("click", () => toggleForm());
btnCancel?.addEventListener("click", () => toggleForm(false));

// ------------ Form helpers (IDs hidden) ------------
function resetICW() {
  icwSet.clear();
  syncICWHidden();
  renderICWChips();
  if (icwInput) icwInput.value = "";
}
function syncICWHidden() {
  if (!icwHidden) return;
  icwHidden.value = Array.from(icwSet).join(", ");
}
function renderICWChips() {
  if (!icwChips) return;
  icwChips.innerHTML = "";
  for (const id of icwSet) {
    const title = state.idToTitle.get(id) || id;
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${escapeHtml(title)}</span>`;
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.addEventListener("click", () => {
      icwSet.delete(id);
      syncICWHidden();
      renderICWChips();
    });
    chip.appendChild(x);
    icwChips.appendChild(chip);
  }
}
function tryAddICWTitle(val) {
  const t = String(val || "").trim();
  if (!t) return;
  const id = state.titleToId.get(t);
  if (!id) return;
  icwSet.add(id);
  syncICWHidden();
  renderICWChips();
  if (icwInput) icwInput.value = "";
}

icwAddBtn?.addEventListener("click", () => tryAddICWTitle(icwInput.value));
icwInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    tryAddICWTitle(icwInput.value);
  }
});

// Primary bind: title -> id (hidden field)
primaryBindTitle?.addEventListener("input", () => {
  const t = String(primaryBindTitle.value || "").trim();
  const id = state.titleToId.get(t) || "";
  if (primaryBindId) primaryBindId.value = id;
});
primaryBindTitle?.addEventListener("change", () => {
  const t = String(primaryBindTitle.value || "").trim();
  const id = state.titleToId.get(t) || "";
  if (primaryBindId) primaryBindId.value = id;
});

// ------------ Form submit (POST) ------------
seedForm?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  formStatus.textContent = "Submitting…";

  const t = String(primaryBindTitle?.value || "").trim();
  const bindId = state.titleToId.get(t) || (primaryBindId?.value || "").trim();
  if (!bindId) {
    formStatus.textContent = "Error: Primary bind must match an existing seed title.";
    return;
  }
  if (primaryBindId) primaryBindId.value = bindId;

  const fd = new FormData(seedForm);
  const payload = new URLSearchParams(fd);

  try {
    const res = await fetch(API_URL, { method: "POST", body: payload });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Non-JSON response:", text);
      throw new Error("Server did not return JSON. Check Apps Script deployment.");
    }
    if (!data.ok) throw new Error(data.error || "Submission failed");

    formStatus.textContent = "Submitted ✓";
    seedForm.reset();
    resetICW();
    if (primaryBindId) primaryBindId.value = "";
    toggleForm(false);

    await loadAndRender();
  } catch (err) {
    formStatus.textContent = `Error: ${String(err.message || err)}`;
  }
});

function toggleForm(force) {
  const willShow = (typeof force === "boolean") ? force : formWrap.classList.contains("hidden");
  formWrap.classList.toggle("hidden", !willShow);
  if (willShow) {
    formStatus.textContent = "";
    resetICW();
    if (primaryBindTitle) primaryBindTitle.value = "";
    if (primaryBindId) primaryBindId.value = "";
  }
}

// ------------ Data loading ------------
async function loadData() {
  const url = `${API_URL}?action=get&_=${Date.now()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Failed to load");
  state.seeds = data.seeds || [];
  state.edges = data.edges || [];
}

// Build title/id maps + datalist
function buildTitleMapsAndDatalist() {
  state.titleToId.clear();
  state.idToTitle.clear();
  if (seedTitleList) seedTitleList.innerHTML = "";

  const seeds = (state.seeds || []).filter(s => (s.moderation_state || "published") !== "hidden");
  for (const s of seeds) {
    const id = String(s.seed_id || "").trim();
    const title = String(s.title_or_label || "").trim();
    if (!id || !title) continue;

    state.titleToId.set(title, id);
    state.idToTitle.set(id, title);

    if (seedTitleList) {
      const opt = document.createElement("option");
      opt.value = title;
      seedTitleList.appendChild(opt);
    }
  }
}

// ------------ Graph building ------------
function buildGraph() {
  const nodes = (state.seeds || [])
    .filter(s => (s.moderation_state || "published") !== "hidden")
    .map(s => ({
      id: String(s.seed_id).trim(),
      label: String(s.title_or_label || "").trim() || "(untitled)",
      url: String(s.return_address_url || "").trim(),
      handle: String(s.handle || "").trim(),
      care_mode: String(s.care_mode || "look_dont_touch").trim(),
      embed_policy: String(s.embed_policy || "iframe_ok").trim(),
      keywords: String(s.keywords || "").trim(),
      context: String(s.context || "").trim(),
      mood: String(s.mood || "").trim(),
      a_debt_to: String(s.a_debt_to || "").trim()
    }));

  const idSet = new Set(nodes.map(n => n.id));
  const links = [];

  for (const e of state.edges || []) {
    const from = String(e.from_id || "").trim();
    const to = String(e.to_id || "").trim();
    if (!from || !to) continue;
    if (!idSet.has(from) || !idSet.has(to)) continue;

    const rel = String(e.relation_type || "responds_to").trim() || "responds_to";
    const isPrimary = String(e.is_primary) === "true" || e.is_primary === true;

    links.push({ source: from, target: to, relation: rel, is_primary: isPrimary });
  }

  state.nodes = nodes;
  state.links = links;
}

// ------------ Rendering (D3 force + text nodes) ------------
let svg, g, linkSel, simulation, zoom;

function render() {
  graphEl.innerHTML = "";
  const { width, height } = graphEl.getBoundingClientRect();

  svg = d3.select(graphEl).append("svg")
    .attr("width", width)
    .attr("height", height);

  g = svg.append("g");

  // Background click: unpin + close
  svg.on("click", () => {
    if (state.pinnedNodeId) {
      state.pinnedNodeId = null;
      hidePreview();
    }
  });

  // Zoom
  zoom = d3.zoom()
    .scaleExtent([0.2, 6])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
      if (state.pinnedNodeId) {
        const n = state.nodes.find(x => x.id === state.pinnedNodeId);
        if (n) positionPreviewBubble(n);
      }
    });

  svg.call(zoom);

  // ---- Label formatting ----
  function bracketize(label) {
    const t = String(label || "").trim();
    if (!t) return "(untitled)";
    if (t.startsWith("(") && t.endsWith(")")) return t;
    return `(${t})`;
  }

  // ---- Edge styling ----
  const FALLBACK_PRIMARY_COLOR = "rgba(120,120,120,0.75)";
  const COLOR_WEAK = "rgba(120,120,120,0.26)";
  const COLOR_ICW  = "rgba(120,120,120,0.52)";

  function rel(d) { return String(d.relation || "responds_to"); }
  function isICW(d) { return rel(d) === "in_conversation_with"; }

  function edgeStroke(d) {
    if (isICW(d)) return COLOR_ICW;
    if (d.is_primary) {
      const key = rel(d);
      return (REL_COLOR && REL_COLOR[key]) ? REL_COLOR[key] : FALLBACK_PRIMARY_COLOR;
    }
    return COLOR_WEAK;
  }

  function edgeWidth(d) {
    if (isICW(d)) return 1.6;
    if (d.is_primary) return 3.0;
    return 1.0;
  }

  function edgeDash(d) {
    if (isICW(d)) return "2,6";
    if (!d.is_primary) return "3,8";
    const r = rel(d);
    if (r === "disagrees_with") return "10,6";
    if (r === "asks") return "2,7";
    if (r === "co_constitutive") return "10,4,2,4";
    return null;
  }

  // Links behind nodes
  linkSel = g.append("g")
    .attr("stroke-linecap", "round")
    .selectAll("line")
    .data(state.links)
    .enter()
    .append("line")
    .attr("stroke", d => edgeStroke(d))
    .attr("stroke-width", d => edgeWidth(d))
    .attr("stroke-dasharray", d => edgeDash(d))
    .attr("opacity", d => (isICW(d) ? 0.75 : (d.is_primary ? 0.92 : 0.35)));

  // ---- Nodes: group with hitbox + bg + centered wrapped text ----
  const nodeG = g.append("g")
    .selectAll("g.node")
    .data(state.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .style("cursor", "pointer")
    .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

  nodeG.append("rect")
    .attr("class", "node-hit")
    .attr("fill", "transparent")
    .style("pointer-events", "all");

  nodeG.append("rect")
    .attr("class", "node-bg")
    .style("opacity", 0)
    .style("pointer-events", "none");

  nodeG.append("text")
    .attr("class", "node-label")
    .attr("x", 0)
    .attr("y", 0)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("pointer-events", "none");

  // Attach events to hitbox
  nodeG.select("rect.node-hit")
    .on("mouseenter", (event, d) => {
      state.overNode = true;
      state.hoveredNodeId = d.id;
      if (state.hoverOutTimer) clearTimeout(state.hoverOutTimer);
      state.hoverOutTimer = null;
      onNodeEnter(event, d);
      updateNodeHighlight(nodeG);
    })
.on("mouseleave", () => {
  state.overNode = false;
  state.hoveredNodeId = null;          // <-- add this
  onNodeLeave();
  updateNodeHighlight(nodeG);
  scheduleHoverClose();
})
    .on("click", (event, d) => {
      event.stopPropagation();
      onNodeClick(event, d);
      updateNodeHighlight(nodeG);
    });

  // Measure + wrap, then size hitbox/bg using GROUP bbox (stable, accurate)
  nodeG.each(function(d) {
    const gEl = d3.select(this);
    const textEl = gEl.select("text.node-label");

    const shown = bracketize(d.label);
    textEl.text(null);
    wrapSvgTextCentered(textEl, shown, MAX_NODE_W);

    const gb = gEl.node().getBBox(); // local coords

    // Expand bbox for hit area
    const rx = gb.x - HIT_PAD_X;
    const ry = gb.y - HIT_PAD_Y;
    const rw = gb.width + HIT_PAD_X * 2;
    const rh = gb.height + HIT_PAD_Y * 2;

    d._w = rw;
    d._h = rh;

    gEl.select("rect.node-hit")
      .attr("x", rx).attr("y", ry).attr("width", rw).attr("height", rh);

    gEl.select("rect.node-bg")
      .attr("x", rx).attr("y", ry).attr("width", rw).attr("height", rh);
  });

  // Forces (primary tighter, ICW looser)
  simulation = d3.forceSimulation(state.nodes)
    .force("link", d3.forceLink(state.links)
      .id(d => d.id)
      .distance(d => {
        if (String(d.relation) === "in_conversation_with") return 220;
        if (d.is_primary) return 140;
        return 120;
      })
      .strength(d => {
        if (String(d.relation) === "in_conversation_with") return 0.02;
        if (d.is_primary) return 0.14;
        return 0.08;
      })
    )
    .force("charge", d3.forceManyBody().strength(-150))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide()
      .radius(d => {
        const w = d._w || 70;
        const h = d._h || 20;
        return Math.max(18, Math.sqrt(w*w + h*h) / 2);
      })
      .strength(0.8)
    );

  simulation.alphaDecay(0.08);
  simulation.velocityDecay(0.55);

  simulation.on("tick", () => {
    linkSel
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    nodeG.attr("transform", d => `translate(${d.x}, ${d.y})`);

    if (state.pinnedNodeId) {
      const n = state.nodes.find(x => x.id === state.pinnedNodeId);
      if (n) positionPreviewBubble(n);
    }
  });

  updateNodeHighlight(nodeG);

  function dragstarted(event, d) {
    event.sourceEvent?.stopPropagation?.();
    if (!event.active) simulation.alphaTarget(0.25).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    if (state.pinnedNodeId === d.id) return; // keep pinned fixed if you want
    d.fx = null;
    d.fy = null;
  }
}

function updateNodeHighlight(nodeG) {
  nodeG.select("rect.node-bg")
    .style("opacity", d => {
      const isPinned = state.pinnedNodeId && d.id === state.pinnedNodeId;
      const isHover = state.hoveredNodeId && d.id === state.hoveredNodeId;
      return (isPinned || isHover) ? 1 : 0;
    });
}

// ------------ Hover/pin + preview logic ------------
function scheduleHoverClose() {
  if (state.pinnedNodeId) return;         // pinned stays
  if (state.overNode) return;             // still on node
  if (state.overPreview) return;          // still on preview

  if (state.hoverOutTimer) clearTimeout(state.hoverOutTimer);
  state.hoverOutTimer = setTimeout(() => {
    if (state.pinnedNodeId) return;
    if (state.overNode) return;
    if (state.overPreview) return;
    hidePreview();
  }, 120);
}

function onNodeEnter(event, d) {
  if (state.pinnedNodeId && state.pinnedNodeId !== d.id) return;

  if (state.hoverTimer) clearTimeout(state.hoverTimer);
  state.hoverTimer = setTimeout(() => {
    if (state.pinnedNodeId && state.pinnedNodeId !== d.id) return;
    showPreviewForNode(d, { pinned: false });
  }, HOVER_DELAY_MS);
}

function onNodeLeave() {
  if (state.hoverTimer) clearTimeout(state.hoverTimer);
  state.hoverTimer = null;

  // don't hide immediately; let node->preview transition happen
  scheduleHoverClose();
}

function onNodeClick(event, d) {
  event.stopPropagation();

  if (state.pinnedNodeId === d.id) {
    state.pinnedNodeId = null;
    hidePreview();
    return;
  }

  state.pinnedNodeId = d.id;
  showPreviewForNode(d, { pinned: true });
}

function showPreviewForNode(d) {
  if (!d || !d.url) return;

  // avoid redundant reload
  if (
    state.previewNodeId === d.id &&
    state.previewUrl === d.url &&
    !preview.classList.contains("hidden")
  ) {
    positionPreviewBubble(d);
    return;
  }

  state.previewNodeId = d.id;
  state.previewUrl = d.url;

  previewFrame.classList.remove("hidden");
  previewFrame.src = d.url;

  previewLabel.textContent = d.label;

  previewMeta.innerHTML = `
    <div class="previewMetaLeft">
      <div>care: <strong>${escapeHtml(d.care_mode)}</strong></div>
      ${d.keywords ? `<div>keywords: ${escapeHtml(d.keywords)}</div>` : ""}
      ${d.a_debt_to ? `<div>debt: ${escapeHtml(d.a_debt_to)}</div>` : ""}
      ${d.context ? `<div class="previewContext">${escapeHtml(d.context)}</div>` : ""}
    </div>
    <div class="previewMetaRight">
      <a href="${escapeAttr(d.url)}" target="_blank" rel="noopener">Open ↗</a>
    </div>
  `;

  preview.classList.remove("hidden");
  positionPreviewBubble(d);
}

function hidePreview() {
  preview.classList.add("hidden");
  previewFrame.src = "about:blank";
  previewFrame.classList.remove("hidden");

  state.previewNodeId = null;
  state.previewUrl = null;

  if (state.hoverTimer) clearTimeout(state.hoverTimer);
  state.hoverTimer = null;

  if (state.hoverOutTimer) clearTimeout(state.hoverOutTimer);
  state.hoverOutTimer = null;

  state.overPreview = false;
  state.hoveredNodeId = null;
}

// Position bubble near node; clamp inside graph panel
function positionPreviewBubble(node) {
  const bubble = preview;
  if (!bubble || bubble.classList.contains("hidden")) return;
  if (!svg || !node) return;

  const hostRect = graphEl.getBoundingClientRect();
  const svgEl = svg.node();
  const t = d3.zoomTransform(svgEl);

  const x = node.x * t.k + t.x;
  const y = node.y * t.k + t.y;

  const bubbleW = bubble.offsetWidth || 520;
  const bubbleH = bubble.offsetHeight || 420;

  const hostW = hostRect.width;
  const hostH = hostRect.height;

  // Choose side with room; add extra gap so it doesn't spawn under cursor on right edge
  const roomRight = hostW - x;
  const roomLeft = x;
  const canRight = roomRight >= (bubbleW + BUBBLE_GAP + BUBBLE_PAD);
  const canLeft = roomLeft >= (bubbleW + BUBBLE_GAP + BUBBLE_PAD);

  let bx = canRight ? (x + BUBBLE_GAP + 12) : (x - bubbleW - BUBBLE_GAP - 12);
  if (!canRight && !canLeft) bx = x + BUBBLE_GAP + 12;

  let by = y - bubbleH * 0.35;

  bx = Math.max(BUBBLE_PAD, Math.min(bx, hostW - bubbleW - BUBBLE_PAD));
  by = Math.max(BUBBLE_PAD, Math.min(by, hostH - bubbleH - BUBBLE_PAD));

  bubble.classList.toggle("arrowBottom", by < y && (by + bubbleH) < y + 20);

  bubble.style.left = `${bx}px`;
  bubble.style.top = `${by}px`;
}

// ------------ Wrapping (centered) ------------
function wrapSvgTextCentered(textSel, str, maxWidth) {
  const words = String(str).split(/\s+/).filter(Boolean);

  textSel.text(null)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle");

  const lineHeightEm = 1.15;
  let line = [];
  let lineNumber = 0;

  const makeTspan = (txt) => textSel.append("tspan")
    .attr("x", 0)
    .attr("dy", lineNumber === 0 ? "0em" : `${lineHeightEm}em`)
    .text(txt);

  let tspan = makeTspan("");

  for (const w of words) {
    line.push(w);
    tspan.text(line.join(" "));

    const len = tspan.node().getComputedTextLength();
    if (len > maxWidth && line.length > 1) {
      line.pop();
      tspan.text(line.join(" "));

      line = [w];
      lineNumber += 1;
      tspan = makeTspan(w);
    }
  }

  const tspans = textSel.selectAll("tspan").nodes();
  const n = tspans.length || 1;
  const totalEm = (n - 1) * lineHeightEm;

  textSel.select("tspan").attr("dy", `${-totalEm / 2}em`);
}

// ------------ Utils ------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}

// ------------ Boot ------------
async function loadAndRender() {
  try {
    await loadData();
    buildTitleMapsAndDatalist();
    buildGraph();
    render();
  } catch (err) {
    console.error(err);
    alert("Failed to load data. Check API_URL and Apps Script deployment.");
  }
}
loadAndRender();
