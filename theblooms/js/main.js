import { renderDiagram } from "./diagramView.js";

/* Utility functions */
function getColorByCategory(cat) {
  switch (cat) {
    case "Bloom":
      return "#e60026";
    case "Blooming Organisms":
      return "#f28c8c";
    case "Human and Nonhuman Agencies":
      return "#f57c00";
    case "Environmental Conditions":
      return "#795548";
    case "Technology":
      return "#757575";
    case "Capital":
      return "#1565c0";
    case "Speculation":
      return "#7b1fa2";
    case "Value":
      return "#43a047";
    case "Labor":
      return "#ec407a";
    default:
      return "#000000";
  }
}

/* Global state */
let navigationMode = "random";
let visibleNodes = [];
let visibleLinks = [];
let currentLinkKey = null;
let diagram = null;
let recentVisitedLinks = [];

/* DOM hooks */
const navToggle = document.getElementById("modeToggle");
const modeLabel = document.getElementById("modeLabel");

/* Text-to-Speech Helper */
function narrateText(text, onEnd) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.onend = onEnd;
  u.onerror = (e) => console.error("TTS error:", e);
  speechSynthesis.speak(u);
}

/* Diagram Updating */
function updateDiagram(linkKey, shouldCenter = true) {
  const [sourceId, targetId] = linkKey.split("->").map((s) => s.trim());

  const nextIds = visibleLinks
    .filter((l) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      return src === targetId && l.narration;
    })
    .map(
      (l) =>
        `${typeof l.source === "object" ? l.source.id : l.source} -> ${
          typeof l.target === "object" ? l.target.id : l.target
        }`
    );
    if (!diagram) {
      diagram = renderDiagram(
        { nodes: visibleNodes, links: visibleLinks },
        {
          containerId: "#diagram",
          zoomExtent: 3,
          showLabels: true,
          directed: true,
          colorByCategory: true,
          nodeRadius: 8,
          arrowSize: 4,
          arrowOffset: 10,
          maxCurveOffset: 50,
          currentLinkId: linkKey,
          subsequentIds: nextIds,
          shouldCenter: navigationMode === "random" // pass this option directly
        }
      );
    } else {
      window._diagramInstance.updateLinks(linkKey, nextIds, shouldCenter);
    }

  currentLinkKey = linkKey;
}

/* Manual Mode Functions */
function clearManualNextNodes() {
  d3.selectAll(".manual-next-node")
    .classed("manual-next-node", false)
    .style("cursor", null)
    .on("pointerdown", null)
    .on("pointerup", null);
}

function showManualNextNodes(sourceId) {
  clearManualNextNodes();

  visibleLinks
    .filter((l) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      return src === sourceId && l.narration;
    })
    .forEach((l) => {
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;

      let pointerDownTime = 0;

      d3.select(`#node-${tgtId}`)
        .classed("manual-next-node", true)
        .style("cursor", "pointer")
        .on("pointerdown", function (event) {
          pointerDownTime = Date.now();
        })
        .on("pointerup", function (event) {
          const delta = Date.now() - pointerDownTime;
          if (delta < 300) {
            // Treat as click if released quickly
            event.stopPropagation();
            const nodeId = this.id.replace(/^node-/, "");
            const linkKey = `${sourceId} -> ${nodeId}`;
            console.log("[click] Node clicked:", nodeId);

            speechSynthesis.cancel(); // Cancel old narration immediately

            narrateLink(linkKey);
          }
        });
    });
}

/* ✅ Cinema Updating */
function updateCinemaByLinkKey(linkKey) {
  const imageElement = document.getElementById("cinemaImage");
  const captionElement = document.getElementById("caption");

  const linkObj = visibleLinks.find((l) => {
    const src = typeof l.source === "object" ? l.source.id : l.source;
    const tgt = typeof l.target === "object" ? l.target.id : l.target;
    return (
      src === linkKey.split("->")[0].trim() &&
      tgt === linkKey.split("->")[1].trim()
    );
  });

  if (!linkObj) {
    console.warn("No link object found for updating cinema:", linkKey);
    return;
  }

  const imageUrl = `./img/${linkObj.id}.jpg`; 
  imageElement.onerror = () => {
    imageElement.src = './img/default.jpg';
  };
  imageElement.src = imageUrl;

  const captionText = linkObj.narration || "";
  captionElement.textContent = captionText;
}

function narrateLink(linkKey) {
  console.log("[narrateLink] narrating:", linkKey);

  updateCinemaByLinkKey(linkKey);

  speechSynthesis.cancel(); 
  updateDiagram(linkKey, navigationMode === "random");  // Pass correct centering

  const [_, targetId] = linkKey.split("->").map(s => s.trim());

  if (navigationMode === "manual") {
    showManualNextNodes(targetId);
  }

  const linkObj = visibleLinks.find(l => {
    const src = typeof l.source === "object" ? l.source.id : l.source;
    const tgt = typeof l.target === "object" ? l.target.id : l.target;
    return src === linkKey.split("->")[0].trim() && tgt === linkKey.split("->")[1].trim();
  });

  if (!linkObj || !linkObj.narration) {
    console.warn("[narrateLink] No narration for", linkKey);
    return;
  }

  recentVisitedLinks.push(linkKey);
  if (recentVisitedLinks.length > 45) {
    recentVisitedLinks.shift();
  }

  d3.selectAll(".link")
    .classed("visited", function(d) {
      const src = typeof d.source === "object" ? d.source.id : d.source;
      const tgt = typeof d.target === "object" ? d.target.id : d.target;
      const currentLinkKey = `${src} -> ${tgt}`;
      return recentVisitedLinks.includes(currentLinkKey);
    });

  narrateText(linkObj.narration, () => {
    if (navigationMode === "random") {
      onNarrationEnd(targetId);
    }
  });

  const targetNode = visibleNodes.find(n => n.id === linkKey.split("->")[1].trim());
if (targetNode?.category === "Speculation") {
  const popup = document.getElementById("donationPopup");
  const countdownSpan = document.getElementById("popupCountdown");
  if (popup && countdownSpan) {
    let remaining = 5;
    // Show popup
    popup.classList.remove("hidden");
    setTimeout(() => popup.classList.add("show"), 50);

    countdownSpan.textContent = remaining;

    const interval = setInterval(() => {
      remaining--;
      countdownSpan.textContent = remaining;

      if (remaining <= 0) {
        clearInterval(interval);
        popup.classList.remove("show");
        setTimeout(() => popup.classList.add("hidden"), 300);
      }
    }, 1000);
  }
}
}

function onNarrationEnd(sourceId) {
  // 1) collect all valid next links
  const allChoices = visibleLinks
    .filter(l => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      return src === sourceId && l.narration;
    })
    .map(l => 
      `${typeof l.source === "object" ? l.source.id : l.source} -> ${
        typeof l.target === "object" ? l.target.id : l.target
      }`
    );

  if (!allChoices.length) return;

  // 2) filter out the ones seen in the last 30 steps
  const fresh = allChoices.filter(c => !recentVisitedLinks.includes(c));

  // 3) pick randomly among fresh if available, otherwise among all
  const nextLink = fresh.length > 0
    ? pickRandom(fresh)
    : pickRandom(allChoices);

  narrateLink(nextLink);
}

/* Utility */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* Initialization */
async function init() {
  try {
    const resp = await fetch("data/diagram.json");
    const raw = await resp.json();

    visibleNodes = raw.nodes.map((n) => ({
      ...n,
      color: getColorByCategory(n.category),
    }));

    const nodeIds = new Set(visibleNodes.map((n) => n.id));

    visibleLinks = raw.relationships
      .filter((d) => nodeIds.has(d.fromId) && nodeIds.has(d.toId))
      .map((d) => ({
        id: d.id,
        source: d.fromId,
        target: d.toId,
        narration: d.type,
      }));

    const keys = visibleLinks
      .filter((l) => l.narration)
      .map((l) => `${l.source} -> ${l.target}`);

    currentLinkKey = pickRandom(keys);
    updateDiagram(currentLinkKey);

    const startButton = document.getElementById("startButton");
    if (startButton) {
      startButton.addEventListener("click", () => {
        document.getElementById("introOverlay").style.display = "none";
        narrateLink(currentLinkKey);
      }, { once: true });
    }
  } catch (err) {
    console.error("Failed to load diagram.json", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const imageElement = document.getElementById("cinemaImage");
  const captionElement = document.getElementById("caption");

  // Set default content immediately
  if (imageElement) {
    imageElement.src = './img/default.jpg';
  }

  if (captionElement) {
    captionElement.textContent = ""; // clear any previous text
    captionElement.innerHTML = "<em>Speculation in progress...</em>";
}

  // Now initialize the rest of the script
  init();
});

/* Mode toggle */
navToggle.addEventListener("change", () => {
  if (navToggle.checked) {
    navigationMode = "random";
    modeLabel.textContent = "Guided Mode";
    clearManualNextNodes();
    console.log("Switching to GUIDED Mode");
    window._diagramInstance.disableZoom();
    window._diagramInstance.centerOnCurrentTarget(300);
  } else {
    navigationMode = "manual";
    modeLabel.textContent = "Explore Mode";
    clearManualNextNodes();
    const targetId = currentLinkKey.split("->")[1].trim();
    showManualNextNodes(targetId);
    console.log("Switching to EXPLORE Mode");
    window._diagramInstance.enableZoom();
  }
  // force re-apply zoom behavior and/or centering:
  updateDiagram(currentLinkKey, navigationMode === "random");
});