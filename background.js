// Private Dark Mode — background service worker
//
// Two jobs only, both entirely local:
//   1. Set sane defaults the first time the extension is installed.
//   2. Handle the optional keyboard shortcut to toggle the current site.
// No network calls, no remote code, nothing leaves the device.

const DEFAULTS = {
  globalDefault: true, // dark mode is ON for every site unless overridden
  siteOverrides: {}, // { "example.com": true|false }
};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  chrome.storage.local.get(["globalDefault", "siteOverrides"], (data) => {
    const toSet = {};
    if (data.globalDefault === undefined) toSet.globalDefault = DEFAULTS.globalDefault;
    if (data.siteOverrides === undefined) toSet.siteOverrides = DEFAULTS.siteOverrides;
    if (Object.keys(toSet).length) chrome.storage.local.set(toSet);
  });
});

function hostnameOf(href) {
  try {
    return new URL(href).hostname;
  } catch (e) {
    return null;
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-dark-mode") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) return;
    const hostname = hostnameOf(tab.url);
    if (!hostname) return;

    chrome.storage.local.get(["globalDefault", "siteOverrides"], (data) => {
      const globalDefault = data.globalDefault !== false;
      const overrides = { ...(data.siteOverrides || {}) };
      const currentlyDark = Object.prototype.hasOwnProperty.call(overrides, hostname)
        ? !!overrides[hostname]
        : globalDefault;

      overrides[hostname] = !currentlyDark;
      chrome.storage.local.set({ siteOverrides: overrides });
    });
  });
});
