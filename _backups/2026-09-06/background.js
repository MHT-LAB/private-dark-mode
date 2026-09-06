// Private Dark Mode — background service worker
//
// This is the ONLY place CSS gets injected, via chrome.scripting.insertCSS.
// That's a deliberate choice: a content script that appends a <style> tag
// is a DOM node the page's own JavaScript can see, remove, or fight with,
// and on some sites it can be blocked outright by a strict Content-
// Security-Policy. chrome.scripting.insertCSS injects the rule directly
// into the browser's style engine — it isn't part of the page's DOM at
// all, page JS can't touch it, and Chrome documents it as bypassing the
// page's CSP entirely. That's what makes dark mode survive on sites that
// manage their own <head> (most modern single-page apps) or that lock
// down style-src.
//
// Everything here is local: no network calls, no analytics, nothing
// leaves the device. Preferences live in chrome.storage.local only.

const DARK_CSS = `
html {
  background-color: #fff !important;
  filter: invert(1) hue-rotate(180deg) !important;
}

img, picture, video, canvas, svg, iframe, embed, object,
[style*="background-image"], [style*="background: url"] {
  filter: invert(1) hue-rotate(180deg) !important;
}
`;

const DEFAULTS = {
  globalDefault: true, // dark mode is ON for every site unless overridden
  siteOverrides: {}, // { "example.com": true|false }
};

function hostnameOf(href) {
  try {
    return new URL(href).hostname;
  } catch (e) {
    return null;
  }
}

function isInjectableUrl(url) {
  // scripting.insertCSS only works on http(s) pages — chrome://, the Web
  // Store, PDF viewer, etc. are off-limits to extensions regardless of
  // permissions, so skip those rather than let insertCSS throw.
  return !!url && /^https?:\/\//i.test(url);
}

function getPrefs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["globalDefault", "siteOverrides"], (data) => {
      resolve({
        globalDefault: data.globalDefault !== false,
        siteOverrides: data.siteOverrides || {},
      });
    });
  });
}

function shouldBeDark(hostname, prefs) {
  if (hostname && Object.prototype.hasOwnProperty.call(prefs.siteOverrides, hostname)) {
    return !!prefs.siteOverrides[hostname];
  }
  return prefs.globalDefault;
}

// Always remove first, then insert if needed. This makes the operation
// idempotent no matter how many times it's called for the same tab —
// calling insertCSS twice without a matching removeCSS would apply the
// invert filter twice (which cancels itself out visually), so we never
// assume we know the tab's current state and instead force it.
async function applyToTab(tabId, url) {
  if (!isInjectableUrl(url)) return;
  const hostname = hostnameOf(url);
  const prefs = await getPrefs();
  const dark = shouldBeDark(hostname, prefs);

  try {
    await chrome.scripting.removeCSS({ target: { tabId, allFrames: true }, css: DARK_CSS });
  } catch (e) {
    // Fine if there was nothing to remove, or the frame is gone.
  }

  if (dark) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, css: DARK_CSS });
    } catch (e) {
      // Fine — e.g. a restricted page slipped through the URL check.
    }
  }
}

async function applyToAllOpenTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined && isInjectableUrl(tab.url)) {
      applyToTab(tab.id, tab.url);
    }
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(["globalDefault", "siteOverrides"], (data) => {
    const toSet = {};
    if (data.globalDefault === undefined) toSet.globalDefault = DEFAULTS.globalDefault;
    if (data.siteOverrides === undefined) toSet.siteOverrides = DEFAULTS.siteOverrides;
    if (Object.keys(toSet).length) chrome.storage.local.set(toSet);
  });
  if (details.reason === "install" || details.reason === "update") {
    applyToAllOpenTabs();
  }
});

chrome.runtime.onStartup.addListener(() => {
  applyToAllOpenTabs();
});

// Re-apply as soon as a tab starts loading a new page — this is what
// catches ordinary navigations. Client-side route changes inside a
// single-page app don't re-fire this, but they also don't need to: the
// CSS rule targets html/img/video/etc. generically, so it keeps applying
// to whatever content the app swaps in underneath.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url) {
    applyToTab(tabId, tab.url);
  }
});

// A user can switch to a tab that was already open before the extension
// was installed/updated, or that finished loading before we got a chance
// to inject — make sure it's covered on activation too, cheaply.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    if (tab && tab.url) applyToTab(tabId, tab.url);
  });
});

// Live updates: the popup and the keyboard shortcut both just write to
// chrome.storage.local. When that changes, re-apply to every open tab so
// the effect is immediate — no reload needed.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!("globalDefault" in changes) && !("siteOverrides" in changes)) return;
  applyToAllOpenTabs();
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-dark-mode") return;

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) return;
    const hostname = hostnameOf(tab.url);
    if (!hostname) return;

    const prefs = await getPrefs();
    const currentlyDark = shouldBeDark(hostname, prefs);
    const overrides = { ...prefs.siteOverrides, [hostname]: !currentlyDark };
    chrome.storage.local.set({ siteOverrides: overrides });
  });
});
