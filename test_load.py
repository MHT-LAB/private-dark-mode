"""Load the unpacked extension in real Chromium and confirm it darkens a page."""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

EXT_PATH = str(Path(__file__).parent.resolve())
USER_DATA_DIR = "/tmp/pw-ext-profile"

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        USER_DATA_DIR,
        headless=False,
        args=[
            f"--disable-extensions-except={EXT_PATH}",
            f"--load-extension={EXT_PATH}",
            "--no-sandbox",
        ],
        executable_path="/opt/pw-browsers/chromium/chrome-linux/chrome"
        if Path("/opt/pw-browsers/chromium/chrome-linux/chrome").exists()
        else None,
    )

    # Give the extension's service worker a moment to register + set defaults.
    time.sleep(1.5)

    page = ctx.new_page()
    page.goto("http://localhost:8934/index.html")
    page.wait_for_timeout(800)

    html_filter = page.eval_on_selector("html", "el => getComputedStyle(el).filter")
    style_present = page.eval_on_selector(
        "html", "el => !!document.getElementById('__private_dark_mode_style__')"
    )

    print("computed filter on <html>:", html_filter)
    print("dark-mode <style> tag present:", style_present)

    assert style_present, "dark mode style element was not injected"
    assert "invert" in html_filter.lower(), f"expected invert filter, got: {html_filter}"

    # Now flip it off for this site via storage directly (simulating the popup)
    # and confirm the style is removed live, without a reload.
    bg_page = None
    for sw in ctx.service_workers:
        if "background" in sw.url:
            bg_page = sw
            break

    if bg_page:
        bg_page.evaluate(
            "() => chrome.storage.local.set({siteOverrides: {}, globalDefault: false})"
        )
        page.wait_for_timeout(500)
        style_present_after = page.eval_on_selector(
            "html", "el => !!document.getElementById('__private_dark_mode_style__')"
        )
        print("style present after turning global default off:", style_present_after)
        assert not style_present_after, "style should have been removed live"
    else:
        print("WARNING: could not find background service worker to test live toggle")

    print("ALL CHECKS PASSED")
    ctx.close()
