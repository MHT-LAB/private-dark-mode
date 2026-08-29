// Private Dark Mode — popup script
// Reads/writes chrome.storage.local only. No network access.

const hostnameEl = document.getElementById("hostname");
const siteToggle = document.getElementById("site-toggle");
const globalToggle = document.getElementById("global-toggle");
const resetLink = document.getElementById("reset-link");

let currentHostname = null;

function hostnameOf(href) {
  try {
    return new URL(href).hostname;
  } catch (e) {
    return null;
  }
}

function render(data) {
  const globalDefault = data.globalDefault !== false;
  const overrides = data.siteOverrides || {};
  globalToggle.checked = globalDefault;

  if (!currentHostname) {
    hostnameEl.textContent = "This page";
    siteToggle.checked = globalDefault;
    siteToggle.disabled = true;
    resetLink.hidden = true;
    return;
  }

  hostnameEl.textContent = currentHostname;
  siteToggle.disabled = false;

  const hasOverride = Object.prototype.hasOwnProperty.call(overrides, currentHostname);
  siteToggle.checked = hasOverride ? !!overrides[currentHostname] : globalDefault;
  resetLink.hidden = !hasOverride;
}

function loadAndRender() {
  chrome.storage.local.get(["globalDefault", "siteOverrides"], render);
}

function init() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    currentHostname = tab && tab.url ? hostnameOf(tab.url) : null;
    loadAndRender();
  });
}

siteToggle.addEventListener("change", () => {
  if (!currentHostname) return;
  chrome.storage.local.get(["siteOverrides"], (data) => {
    const overrides = { ...(data.siteOverrides || {}) };
    overrides[currentHostname] = siteToggle.checked;
    chrome.storage.local.set({ siteOverrides: overrides }, loadAndRender);
  });
});

globalToggle.addEventListener("change", () => {
  chrome.storage.local.set({ globalDefault: globalToggle.checked }, loadAndRender);
});

resetLink.addEventListener("click", () => {
  if (!currentHostname) return;
  chrome.storage.local.get(["siteOverrides"], (data) => {
    const overrides = { ...(data.siteOverrides || {}) };
    delete overrides[currentHostname];
    chrome.storage.local.set({ siteOverrides: overrides }, loadAndRender);
  });
});

init();
