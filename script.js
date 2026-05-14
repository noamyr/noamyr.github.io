const CONFIG = {
  urgentMessage:
    "More urgent (than art) information about the ongoing genocide in Palestine",

  casualtiesUrl:
    "https://data.techforpalestine.org/api/v2/casualties_daily.min.json",

  killedInGazaUrl:
    "https://data.techforpalestine.org/api/v3/killed-in-gaza.min.json",

  martyrLimit: 800,
  marqueeSpeed: 40 // pixels per second
};

createFooter();
loadUrgentMessage();
loadCasualtyReports();
loadMartyrNames();

window.addEventListener("load", updateMarquees);
window.addEventListener("resize", () => {
  loadUrgentMessage();
  updateMarquees();
});

function createFooter() {
  const footer = document.createElement("footer");
  footer.id = "institution-footer";

  footer.innerHTML = `
    <div class="footer-bars">
      <div class="info-bar white-bar">
        <span id="urgent-message"></span>
      </div>

      <div class="info-bar green-bar">
        <span id="casualty-report">Loading daily Gaza casualty reports…</span>
      </div>

      <div class="info-bar red-bar martyr-bar">
        <div class="martyr-label">Names of people killed in Gaza</div>

        <div class="martyr-scroll">
          <span id="martyr-names">Loading names…</span>
        </div>
      </div>
    </div>

    <div class="footer-control">
      <span class="footer-question">
        Are you representing a German state-funded institution?
      </span>

      <span>No</span>

      <label class="switch">
        <input id="institution-toggle" type="checkbox" />
        <span class="slider"></span>
      </label>

      <span>Yes</span>
    </div>
  `;

  document.body.appendChild(footer);

  const toggle = document.getElementById("institution-toggle");
  const bars = footer.querySelector(".footer-bars");

  toggle.checked = false;

  toggle.addEventListener("change", () => {
    bars.style.display = toggle.checked ? "none" : "flex";
  });
}

function loadUrgentMessage() {
  const target = document.getElementById("urgent-message");
  setLoopingTextIfNeeded(target, CONFIG.urgentMessage, 4);
}

async function loadCasualtyReports() {
  const target = document.getElementById("casualty-report");

  try {
    const response = await fetch(CONFIG.casualtiesUrl);
    const data = await response.json();
    const latest = data[data.length - 1];

    const report =
      `Latest Gaza report: ${latest.report_date} — ` +
      `killed cumulative: ${latest.killed_cum ?? "unreported"}, ` +
      `injured cumulative: ${latest.injured_cum ?? "unreported"}. ` +
      `Source: Tech for Palestine daily casualties dataset.`;

    setLoopingText(target, report, 4);
  } catch (error) {
    console.error(error);
    target.textContent =
      "Daily Gaza casualty report unavailable. Source: Tech for Palestine casualties_daily dataset.";
  }

  updateMarquees();
}

async function loadMartyrNames() {
  const target = document.getElementById("martyr-names");

  try {
    const response = await fetch(CONFIG.killedInGazaUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const names = extractNames(data, CONFIG.martyrLimit);

if (names.length === 0) {
  throw new Error("No names found in killed-in-Gaza dataset");
}

setLoopingText(target, names.join(" — "), 2);  } catch (error) {
    console.error(error);
    target.textContent =
      "Names of people killed in Gaza — data could not be loaded.";
  }

  updateMarquees();
}

function extractNames(data, limit) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  // v3 format: first row is headers, following rows are arrays
  if (Array.isArray(data[0])) {
    const headers = data[0];
    const rows = data.slice(1, limit);

    const enNameIndex = headers.indexOf("en_name");
    const arNameIndex = headers.indexOf("name");

    return rows
      .map(row => row[enNameIndex] || row[arNameIndex])
      .filter(Boolean);
  }

  // fallback format: array of objects
  return data
    .slice(0, limit)
    .map(person => person.en_name || person.name)
    .filter(Boolean);
}
function setLoopingText(element, text, repeatCount = 2) {
  element.textContent = Array(repeatCount).fill(text).join(" — ");
}

function setLoopingTextIfNeeded(element, text, repeatCount = 4) {
  element.textContent = text;

  requestAnimationFrame(() => {
    const container = getScrollingContainer(element);

    if (element.scrollWidth > container.clientWidth) {
      setLoopingText(element, text, repeatCount);
    }

    updateMarquees();
  });
}

function updateMarquees() {
  document.querySelectorAll(".info-bar").forEach(bar => {
    const text = bar.querySelector("span");
    const container = getScrollingContainer(text);

    const shouldScroll = text.scrollWidth > container.clientWidth;

    container.classList.toggle("overflow", shouldScroll);

    if (shouldScroll) {
      const distance = text.scrollWidth / 2;
      const duration = distance / CONFIG.marqueeSpeed;
      text.style.animationDuration = `${duration}s`;
    } else {
      text.style.animationDuration = "";
    }
  });
}

function getScrollingContainer(element) {
  return element.closest(".martyr-scroll") || element.closest(".info-bar");
}