// Private Dark Mode — content script
//
// Runs at document_start on every frame of every page. It never talks to
// the network and never sends anything anywhere; it only reads a small
// on/off preference out of chrome.storage.local (which lives on this
// device only) and, if dark mode should be on, inserts a single <style>
// element that inverts the page and re-inverts media so photos/video
// don't look like negatives.
//
// This is the well-known "smart invert" trick: invert everything, then
// invert a second time on images/video/canvas/etc. so two inversions
// cancel out and media renders normally while text/backgrounds stay dark.

(function () {
  const STYLE_ID = "__private_dark_mode_style__";

  // Marker attribute so the toggle logic can find/replace its own <style>
  // even across the (rare) case where document.documentElement gets
  // replaced by the page before we've attached.
  const DARK_CSS = `
    html {
      background-color: #fff !important;
      filter: invert(1) hue-rotate(180deg) !important;
    }

    img, picture, video, canvas, svg, iframe, embed, object,
    [style*="background-image"], [style*="background: url"] {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `.trim();

  function hostnameOf(href) {
    try {
      return new URL(href).hostname;
    } catch (e) {
      return null;
    }
  }

  function insertStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = DARK_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  function applyState(shouldBeDark) {
    if (shouldBeDark) {
      insertStyle();
    } else {
      removeStyle();
    }
  }

  function resolveDarkState(data, hostname) {
    const overrides = data.siteOverrides || {};
    const globalDefault = data.globalDefault !== false; // default true
    if (hostname && Object.prototype.hasOwnProperty.call(overrides, hostname)) {
      return !!overrides[hostname];
    }
    return globalDefault;
  }

  const hostname = hostnameOf(location.href);

  // Initial read. chrome.storage.local resolves fast (no network hop),
  // so this normally lands before first paint at document_start.
  try {
    chrome.storage.local.get(["globalDefault", "siteOverrides"], (data) => {
      if (chrome.runtime.lastError) return;
      applyState(resolveDarkState(data, hostname));
    });
  } catch (e) {
    // Extension context can be invalidated (e.g. reloaded) — fail closed,
    // do nothing rather than throw on every page.
  }

  // If the head isn't there yet when we first tried, make sure the style
  // still gets attached once it exists.
  if (!document.head) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        if (document.getElementById(STYLE_ID)) return;
        chrome.storage.local.get(["globalDefault", "siteOverrides"], (data) => {
          if (chrome.runtime.lastError) return;
          applyState(resolveDarkState(data, hostname));
        });
      },
      { once: true }
    );
  }

  // Live updates: when the popup (or the keyboard shortcut) changes
  // storage, every open tab for that site reacts immediately — no reload
  // needed.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!("globalDefault" in changes) && !("siteOverrides" in changes)) return;

      chrome.storage.local.get(["globalDefault", "siteOverrides"], (data) => {
        if (chrome.runtime.lastError) return;
        applyState(resolveDarkState(data, hostname));
      });
    });
  } catch (e) {
    // ignore
  }
})();
