// app.js
const API_URL = "https://script.google.com/macros/s/AKfycbzMP5-kMpyZYUdBqsWkow7ZyiZIpIyvJQXNqrDPujefgt40pRrGMdcAJfB7TvQsIHfFew/exec"; // ends with /exec
const HOVER_DELAY_MS = 220;

// Clip nodes (Ableton-ish)
const MAX_NODE_W = 240;   // slightly smaller
const NODE_PAD_X = 4;     // was 10
const NODE_PAD_Y = 2;     // was 7
const NODE_RX = 0;        // smaller rounding (or 0 for sharp)

// Brackets: visual only
const BRACKET_MODE = "paren"; // "none" | "paren"

// Bubble placement (you already have similar)
const BUBBLE_OFFSET_X = 18;
const BUBBLE_OFFSET_Y = 14;
const BUBBLE_PAD = 12;

// Relation visual styles (monochrome, legend-friendly)
const REL_STYLE = {
  agrees_with:      { dash: null,        wMul: 1.0 },
  responds_to:      { dash: null,        wMul: 1.0 },
  extends:          { dash: null,        wMul: 1.5 },
  documents:        { dash: null,        wMul: 1.5 },
  clarifies:        { dash: null,        wMul: 1.5 },
  reframes:         { dash: null,        wMul: 1.5 },
  disagrees_with:   { dash: "6,5",       wMul: 1.0 },
  asks:             { dash: "1,6",       wMul: 1.0 },
  co_constitutive:  { dash: "8,4,2,4",   wMul: 1.1 },
  in_conversation_with: { dash: "3,6",   wMul: 1.0 }
};

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

let state = {
  seeds: [],
  edges: [],
  nodes: [],
  links: [],

  // title -> seed_id mapping for UI (IDs hidden)
  titleToId: new Map(),
  idToTitle: new Map(),

  hoverTimer: null,
  hoveredNodeId: null,
  pinnedNodeId: null,

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

btnReload?.addEventListener("click", () => loadAndRender());
btnToggleForm?.addEventListener("click", () => toggleForm());
btnCancel?.addEventListener("click", () => toggleForm(false));

previewClose?.addEventListener("click", () => {
  state.pinnedNodeId = null;
  hidePreview();
});

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

// Guard: if user picks from dropdown and blur happens, still resolve
primaryBindTitle?.addEventListener("change", () => {
  const t = String(primaryBindTitle.value || "").trim();
  const id = state.titleToId.get(t) || "";
  if (primaryBindId) primaryBindId.value = id;
});

// ------------ Form submit (POST) ------------
seedForm?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  formStatus.textContent = "Submitting…";

  // Ensure bind id is resolved
  const t = String(primaryBindTitle?.value || "").trim();
  const bindId = state.titleToId.get(t) || (primaryBindId?.value || "").trim();
  if (!bindId) {
    formStatus.textContent = "Error: Primary bind must match an existing seed title.";
    return;
  }
  if (primaryBindId) primaryBindId.value = bindId;

  // Build payload from form
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
    // clear bind
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

  // Only published seeds for UI pickers
  const seeds = (state.seeds || []).filter(s => (s.moderation_state || "published") !== "hidden");

  for (const s of seeds) {
    const id = String(s.seed_id || "").trim();
    const title = String(s.title_or_label || "").trim();
    if (!id || !title) continue;

    state.titleToId.set(title, id);
    state.idToTitle.set(id, title);

    if (seedTitleList) {
      const opt = document.createElement("option");
      opt.value = title; // IMPORTANT: title values, not ids
      seedTitleList.appendChild(opt);
    }
  }
}

// ------------ Graph building (seeds only, edges typed) ------------
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

    links.push({
      source: from,
      target: to,
      relation: rel,
      is_primary: isPrimary
    });
  }

  state.nodes = nodes;
  state.links = links;
}

// ------------ Rendering (D3 force + labels) ------------
let svg, g, linkSel, nodeSel, labelSel, simulation, zoom;

function render() {
  graphEl.innerHTML = "";

  const { width, height } = graphEl.getBoundingClientRect();

  svg = d3.select(graphEl).append("svg")
    .attr("width", width)
    .attr("height", height);

  g = svg.append("g");

  // -----------------------------
  // Background click: unpin + close
  // -----------------------------
  svg.on("click", () => {
    if (state.pinnedNodeId) {
      state.pinnedNodeId = null;
      hidePreview();
      updateNodeHighlight();
    }
  });

  // -----------------------------
  // Zoom (only affects transform + keeps bubble aligned)
  // -----------------------------
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

  // -----------------------------
  // Helpers: node label formatting + wrapping
  // -----------------------------
  const MAX_NODE_W = 260;   // wrap width (you can lower to tighten)
  const PAD_X = 6;          // tight background padding
  const PAD_Y = 3;

  function bracketize(label) {
    const t = String(label || "").trim();
    if (!t) return "(untitled)";
    if (t.startsWith("(") && t.endsWith(")")) return t;
    return `(${t})`;
  }

  // Wrap text into tspans (multi-line), no fancy hyphenation
  function wrapSvgText(textSel, str, maxWidth) {
    const words = String(str).split(/\s+/).filter(Boolean);
    textSel.text(null);

    let line = [];
    let lineNumber = 0;
    const lineHeightEm = 1.15;

    const makeTspan = (txt) => textSel.append("tspan")
      .attr("x", textSel.attr("x"))
      .attr("dy", lineNumber === 0 ? "0em" : `${lineHeightEm}em`)
      .text(txt);

    let tspan = makeTspan("");

    for (const w of words) {
      line.push(w);
      tspan.text(line.join(" "));
      const node = textSel.node();
      if (!node) continue;

      if (node.getComputedTextLength() > maxWidth && line.length > 1) {
        line.pop();
        tspan.text(line.join(" "));
        line = [w];
        lineNumber += 1;
        tspan = makeTspan(w);
      }
    }
  }

  // -----------------------------
  // Simple edge styling
  // -----------------------------
  // REL_COLOR should map: relation_type -> "rgba(r,g,b,a)" (or any CSS color)
  // Example keys: responds_to, agrees_with, disagrees_with, asks, co_constitutive, extends, documents, clarifies
  const FALLBACK_PRIMARY_COLOR = "rgba(120,120,120,0.75)";
  const COLOR_WEAK = "rgba(120,120,120,0.26)";
  const COLOR_ICW  = "rgba(120,120,120,0.45)"; // make ICW clearly visible

  function rel(d) {
    return String(d.relation || "responds_to");
  }
  function isICW(d) {
    return rel(d) === "in_conversation_with";
  }

  function edgeStroke(d) {
    if (isICW(d)) return COLOR_ICW;
    if (d.is_primary) {
      const key = rel(d);
      return (typeof REL_COLOR === "object" && REL_COLOR && REL_COLOR[key]) ? REL_COLOR[key] : FALLBACK_PRIMARY_COLOR;
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

    // minimal mapping; keep it simple
    const r = rel(d);
    if (r === "disagrees_with") return "10,6";
    if (r === "asks") return "2,7";
    if (r === "co_constitutive") return "10,4,2,4";
    return null; // solid
  }

  // -----------------------------
  // Create links first (behind nodes)
  // -----------------------------
  linkSel = g.append("g")
    .attr("stroke-linecap", "round")
    .selectAll("line")
    .data(state.links)
    .enter()
    .append("line")
    .attr("stroke", d => edgeStroke(d))
    .attr("stroke-width", d => edgeWidth(d))
    .attr("stroke-dasharray", d => edgeDash(d))
    .attr("opacity", d => (isICW(d) ? 0.65 : (d.is_primary ? 0.90 : 0.35)));

  // -----------------------------
  // Nodes as text only + tight highlight background (hover/pin)
  // -----------------------------
  const nodeG = g.append("g")
    .selectAll("g.node")
    .data(state.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .style("cursor", "pointer")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended)
    )
    .on("mouseenter", (event, d) => {
      state.hoveredNode = d;
      onNodeEnter(event, d);
      updateNodeHighlight();
    })
    .on("mouseleave", () => {
      state.hoveredNode = null;
      onNodeLeave();
      updateNodeHighlight();
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      onNodeClick(event, d);
      updateNodeHighlight();
    });

  // Background highlight rect (invisible by default)
  nodeG.append("rect")
    .attr("class", "node-bg")
    .attr("rx", 0)
    .attr("ry", 0)
    .style("opacity", 0);

  // Text
  nodeG.append("text")
    .attr("class", "node-label")
    .attr("x", 0)
    .attr("y", 0)
    .attr("dominant-baseline", "hanging")
    .style("pointer-events", "none");

  // Measure + wrap once
  nodeG.each(function(d) {
    const gEl = d3.select(this);
    const textEl = gEl.select("text.node-label");

    const shown = bracketize(d.label);
    textEl.text(null);
    wrapSvgText(textEl, shown, MAX_NODE_W);

    const bb = textEl.node().getBBox();
    d._w = bb.width;
    d._h = bb.height;

    // highlight rect sized tightly around text
    gEl.select("rect.node-bg")
      .attr("x", bb.x - PAD_X)
      .attr("y", bb.y - PAD_Y)
      .attr("width", bb.width + PAD_X * 2)
      .attr("height", bb.height + PAD_Y * 2);
  });

  function updateNodeHighlight() {
    nodeG.select("rect.node-bg")
      .style("opacity", d => {
        const isPinned = state.pinnedNodeId && d.id === state.pinnedNodeId;
        const isHover = state.hoveredNode && d.id === state.hoveredNode.id;
        return (isPinned || isHover) ? 1 : 0;
      });
  }

  // -----------------------------
  // Forces (shorter links, more collision)
  // -----------------------------
  function nodeRadius(d) {
    // collision based on measured text box (tight but effective)
    const w = d._w || 60;
    const h = d._h || 16;
    return Math.max(18, Math.sqrt(w*w + h*h) / 2);
  }

// ---- Forces ----
simulation = d3.forceSimulation(state.nodes)
  .force("link", d3.forceLink(state.links)
    .id(d => d.id)

    // PRIMARY = shorter, tighter; ICW = longer, looser
    .distance(d => {
      const rel = String(d.relation || "");
      const isICW = (rel === "in_conversation_with");
      if (isICW) return 200;              // longer
      if (d.is_primary) return 150;        // short
      return 90;                          // fallback (if you ever add other non-primary)
    })

    .strength(d => {
      const rel = String(d.relation || "");
      const isICW = (rel === "in_conversation_with");
      if (isICW) return 0.01;             // weak spring
      if (d.is_primary) return 0.1;      // strong spring
      return 0.12;
    })
  )

  // keep your other forces (charge/center/collision) as-is
  .force("charge", d3.forceManyBody().strength(-140))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collision", d3.forceCollide()
    .radius(d => Math.max(12, (d._labelW ? d._labelW / 2 : 18)))
    .strength(0.7)
  );

// A bit more settling helps the strong/weak structure “lock in”
simulation.alphaDecay(0.08);
simulation.velocityDecay(0.55);


  simulation.on("tick", () => {
    linkSel
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    // position node group centered on (x,y)
    nodeG.attr("transform", d => {
      const w = d._w || 60;
      const h = d._h || 16;
      return `translate(${d.x - w/2}, ${d.y - h/2})`;
    });

    if (state.pinnedNodeId) {
      const n = state.nodes.find(x => x.id === state.pinnedNodeId);
      if (n) positionPreviewBubble(n);
    }
  });

  // initial highlight state
  updateNodeHighlight();

  // -----------------------------
  // Drag handlers
  // -----------------------------
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
    d.fx = null;
    d.fy = null;
  }
}

// ------------ Hover/pin + bubble preview logic ------------
function onNodeEnter(event, d) {
  // If pinned to some other node, ignore hover entirely
  if (state.pinnedNodeId && state.pinnedNodeId !== d.id) return;

  state.hoveredNodeId = d.id;

  if (state.hoverTimer) clearTimeout(state.hoverTimer);
  state.hoverTimer = setTimeout(() => {
    // If pinned, only allow hover to show the pinned node
    if (state.pinnedNodeId && state.pinnedNodeId !== d.id) return;

    showPreviewForNode(d, { pinned: false });
  }, HOVER_DELAY_MS);
}

function onNodeLeave() {
  if (state.hoverTimer) clearTimeout(state.hoverTimer);
  state.hoverTimer = null;
  state.hoveredNodeId = null;

  // If not pinned, hide on mouseout
  if (!state.pinnedNodeId) hidePreview();
}

function onNodeClick(event, d) {
  event.stopPropagation();

  // Toggle pin
  if (state.pinnedNodeId === d.id) {
    state.pinnedNodeId = null;
    hidePreview();
    return;
  }

  // Pin to this node (moves bubble intentionally)
  state.pinnedNodeId = d.id;
  showPreviewForNode(d, { pinned: true });
}

function showPreviewForNode(d, opts = {}) {
  if (!d || !d.url) return;

  // Don’t redundantly reload iframe (helps stability)
  if (
    state.previewNodeId === d.id &&
    state.previewUrl === d.url &&
    !preview.classList.contains("hidden")
  ) {
    // Still reposition bubble (node may have moved)
    positionPreviewBubble(d);
    return;
  }

  state.previewNodeId = d.id;
  state.previewUrl = d.url;

  // Embed policy
  if (d.embed_policy === "no_embed" || d.embed_policy === "link_only") {
    previewFrame.src = "about:blank";
    previewFrame.classList.add("hidden");
  } else {
    previewFrame.classList.remove("hidden");
    previewFrame.src = d.url;
  }

  // Header label
  const headerBits = [];
  if (d.handle) headerBits.push(d.handle);
  if (d.mood) headerBits.push(`mood: ${d.mood}`);
  previewLabel.textContent = `${d.label}${headerBits.length ? " — " + headerBits.join(" · ") : ""}`;

  previewMeta.innerHTML = `
    <div>
      <div>care: <strong>${escapeHtml(d.care_mode)}</strong></div>
      ${d.keywords ? `<div>keywords: ${escapeHtml(d.keywords)}</div>` : ""}
      ${d.a_debt_to ? `<div>debt: ${escapeHtml(d.a_debt_to)}</div>` : ""}
      ${d.context ? `<div style="margin-top:8px;opacity:0.85">${escapeHtml(d.context)}</div>` : ""}
    </div>
    <div style="text-align:right">
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

  // Also clear hover timer to avoid reopen after close
  if (state.hoverTimer) clearTimeout(state.hoverTimer);
  state.hoverTimer = null;
}

// Position the bubble near the node in screen coordinates.
// Node stays visible; bubble clamps within viewport.
function positionPreviewBubble(node) {
  // previewBubble is your #preview element (the bubble)
  const bubble = preview; // assuming `preview` is the bubble container
  if (!bubble || bubble.classList.contains("hidden")) return;
  if (!svg || !node) return;

  // The bubble is absolutely positioned inside the graph panel,
  // so we MUST compute coordinates relative to graphEl.
  const hostRect = graphEl.getBoundingClientRect();
  const svgEl = svg.node();
  const t = d3.zoomTransform(svgEl);

  // Node position in *screen px* relative to SVG’s top-left
  const nodeScreenX = node.x * t.k + t.x;
  const nodeScreenY = node.y * t.k + t.y;

  // Convert to graph panel local coordinates (top-left = 0,0)
  const x = nodeScreenX; // already relative to SVG inside graphEl
  const y = nodeScreenY;

  // Measure bubble (after it has content)
  // (If this returns 0 the first time, call again on next tick; usually fine once open.)
  const bubbleW = bubble.offsetWidth || 520;
  const bubbleH = bubble.offsetHeight || 420;

  const PAD = 14;       // keep away from edges
  const GAP = 14;       // space between node and bubble
  const ARROW_PAD = 10; // if you're using arrow styling

  const hostW = hostRect.width;
  const hostH = hostRect.height;

  // Decide side based on available room inside the graph panel
  const roomRight = hostW - x;
  const roomLeft  = x;
  let placeRight = roomRight >= (bubbleW + GAP + PAD);
  let placeLeft  = roomLeft  >= (bubbleW + GAP + PAD);

  // Prefer right, otherwise left, otherwise right (and clamp)
  let bx = placeRight ? (x + GAP) : (x - bubbleW - GAP);
  if (!placeRight && !placeLeft) bx = x + GAP; // fallback; clamp later

  // Vertical placement: prefer centered around node, then clamp
  let by = y - bubbleH * 0.35; // keeps node still visible above bubble a bit

  // Clamp to graph panel bounds
  bx = Math.max(PAD, Math.min(bx, hostW - bubbleW - PAD));
  by = Math.max(PAD, Math.min(by, hostH - bubbleH - PAD));

  // Optional: arrow direction class (if you use ::before arrow)
  // If bubble is above node, arrow points down; if below, arrow points up.
  bubble.classList.toggle("arrowBottom", by < y && (by + bubbleH) < y + 20);

  bubble.style.left = `${bx}px`;
  bubble.style.top = `${by}px`;
}


// ------------ Edge style helpers ------------
function edgeDash(d) {
  const rel = String(d.relation || "responds_to");
  const st = REL_STYLE[rel] || REL_STYLE.responds_to;
  return st.dash || null;
}

function edgeStrokeWidth(d) {
  const rel = String(d.relation || "responds_to");
  const st = REL_STYLE[rel] || REL_STYLE.responds_to;
  const base = d.is_primary ? 2.4 : 1.1;
  return base * (st.wMul || 1.0);
}

function bracketize(s) {
  if (BRACKET_MODE === "paren") return `(${s})`;
  return s;
}

// Wrap SVG <text> into tspans within maxWidth (px)
function wrapSvgText(textSel, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let line = [];
  const lineHeightEm = 1.15;

  let tspan = textSel.append("tspan")
    .attr("x", NODE_PAD_X)
    .attr("dy", "0em");

  for (let i = 0; i < words.length; i++) {
    line.push(words[i]);
    tspan.text(line.join(" "));

    const len = tspan.node().getComputedTextLength();
    if (len > maxWidth && line.length > 1) {
      line.pop();
      tspan.text(line.join(" "));

      line = [words[i]];
      tspan = textSel.append("tspan")
        .attr("x", NODE_PAD_X)
        .attr("dy", `${lineHeightEm}em`)
        .text(words[i]);
    }
  }
}

// ------------ Utils ------------
function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

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
