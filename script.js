const footer = document.createElement("footer");
footer.id = "institution-footer";

footer.innerHTML = `
  <div class="footer-bars">
    <div class="info-bar white-bar">
      <span>More urgent (than art) information about the ongoing genocide in Palestine</span>
    </div>

    <div class="info-bar green-bar">
      <span id="casualty-report">Loading daily Gaza casualty reports…</span>
    </div>

<div class="info-bar red-bar martyr-bar">
  <div class="martyr-label">
    Names of people killed in Gaza
  </div>

  <div class="martyr-scroll">
    <span id="martyr-names">
      Loading names…
    </span>
  </div>
</div>  </div>

  <div class="footer-control">
    <span class="martyr-label">Are you representing a German state-funded institution?</span>

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

async function loadCasualtyReports() {
  const target = document.getElementById("casualty-report");

  try {
    const response = await fetch(
      "https://data.techforpalestine.org/api/v2/casualties_daily.min.json"
    );

    const data = await response.json();
    const latest = data[data.length - 1];

    const report =
  `Latest Gaza report: ${latest.report_date} — ` +
  `killed cumulative: ${latest.killed_cum ?? "unreported"}, ` +
  `injured cumulative: ${latest.injured_cum ?? "unreported"}. ` +
  `Source: Tech for Palestine daily casualties dataset.`;

makeLoopingText(target, report, 4);
  } catch (error) {
    target.textContent =
      "Daily Gaza casualty report unavailable. Source: Tech for Palestine casualties_daily dataset.";
  }

  activateMarqueeOnlyWhenNeeded();
setMarqueeSpeed();
  
}

async function loadMartyrNames() {
  const target = document.getElementById("martyr-names");

  target.textContent = "Loading names of people killed in Gaza…";

  try {
    const response = await fetch(
      "https://data.techforpalestine.org/api/v3/killed-in-gaza.min.json"
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const headers = data[0];
    const rows = data.slice(1, 800); // only first 799 names, for speed

    const enNameIndex = headers.indexOf("en_name");
    const arNameIndex = headers.indexOf("name");

    const names = rows
      .map(row => row[enNameIndex] || row[arNameIndex])
      .filter(Boolean);

    makeLoopingText(target, names.join(" — "), 2);

activateMarqueeOnlyWhenNeeded();
setMarqueeSpeed();

  } catch (error) {
    console.error(error);
    target.textContent =
      "Names of people killed in Gaza — data could not be loaded.";
  }
}

function activateMarqueeOnlyWhenNeeded() {
document.querySelectorAll(".info-bar").forEach(bar => {
  const scrollingContainer =
    bar.querySelector(".martyr-scroll") || bar;

  const text = bar.querySelector("span");

  if (text.scrollWidth > scrollingContainer.clientWidth) {
    scrollingContainer.classList.add("overflow");
  } else {
    scrollingContainer.classList.remove("overflow");
  }
});}

function makeLoopingText(element, text, repeatCount = 2) {
  const spacer = " — ";
  element.textContent = Array(repeatCount).fill(text).join(spacer);
}

function setMarqueeSpeed() {
  document.querySelectorAll(".info-bar").forEach(bar => {
    const text = bar.querySelector("span");

const scrollingContainer =
  bar.querySelector(".martyr-scroll") || bar;

if (!scrollingContainer.classList.contains("overflow")) return;

    const distance = text.scrollWidth / 2;

    // pixels per second
    const speed = 40;

    const duration = distance / speed;

    text.style.animationDuration = `${duration}s`;
  });
}

window.addEventListener("load", () => {
  activateMarqueeOnlyWhenNeeded();
  setMarqueeSpeed();
});

window.addEventListener("resize", () => {
  activateMarqueeOnlyWhenNeeded();
  setMarqueeSpeed();
});

setTimeout(activateMarqueeOnlyWhenNeeded, 1000);
setTimeout(activateMarqueeOnlyWhenNeeded, 3000);

loadCasualtyReports();
loadMartyrNames();