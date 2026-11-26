// game-relay.js — game page, the extension's isolated world: only passes
// messages between game-main.js (CustomEvent) and the service worker (runtime).
// It may be injected again into an open tab: a copy whose extension is still
// alive keeps the job, an orphaned one (extension reloaded) is replaced.
(() => {
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; } };
  if (globalThis.__foeBridgeRelay && globalThis.__foeBridgeRelay.alive()) return;
  globalThis.__foeBridgeRelay = { alive };

  const EVENT_OUT = "foe-optimizer-bridge:game";
  const EVENT_IN = "foe-optimizer-bridge:relay";

  document.addEventListener(EVENT_OUT, (e) => {
    if (!alive()) return;
    let m = null; try { m = JSON.parse(e.detail); } catch { return; }
    // an early prototype's script sends its own version (so the menu and the monitor can flag it)
    try { chrome.runtime.sendMessage({ from: "game", ...m, version: m.version || chrome.runtime.getManifest().version }).catch(() => {}); } catch { /* extension gone */ }
  });

  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.type === "request-snapshot")
      document.dispatchEvent(new CustomEvent(EVENT_IN, { detail: JSON.stringify({ request: "snapshot" }) }));
    else if (m && m.type === "request-definitions")
      document.dispatchEvent(new CustomEvent(EVENT_IN, { detail: JSON.stringify({ request: "definitions" }) }));
  });
})();
