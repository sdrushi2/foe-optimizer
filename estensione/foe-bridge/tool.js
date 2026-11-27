// ─────────────────────────────────────────────────────────────────────────────
//  tool.js — FoE Optimizer page (foe-optimizer.com or localhost), isolated
//  world. Tells the site the bridge is there and passes it the cities with
//  window.postMessage ({ type: "foe-bridge", event, … }). Without the
//  extension nothing happens and the site works as always.
//
//  - Presence signal every 15 s ("presence", with the number of open game
//    tabs): the site shows LIVE / OFF and goes back to OFF when the signals
//    stop (extension disabled or removed). With the extension disabled this
//    script stays in the page but chrome.runtime is gone: it stops.
//  - The building definitions (63 MB) arrive only when the site asks for them
//    ({ type: "foe-bridge-request", what: "definitions", signature }), every
//    time, and only for that world.
//  - { type: "foe-bridge-request", what: "presence" | "snapshot" } from the site.
//  - When the extension is disabled or removed the connection closes and cannot
//    be reopened: "offline" is sent right away, so the site shows OFF at once
//    (the 45 s without signals remain as a safety net). When Chrome only puts
//    the service worker to sleep the connection reopens and nothing is sent.
// ─────────────────────────────────────────────────────────────────────────────
//  It may be injected again into an open tab (extension enabled, updated or
//  reloaded): a copy whose extension is still alive keeps the job.
//
//  Silent until the page introduces itself: nothing is sent and no connection is
//  opened before the first { type: "foe-bridge-request" } from the page (FoE
//  Optimizer sends one at startup and, while the bridge is not there, every few
//  seconds). Any other page on localhost (another project's dev server) never gets
//  cities, player names or definitions.
(() => {
  const VERSION = chrome.runtime.getManifest().version;
  const toSite = (m) => window.postMessage({ type: "foe-bridge", version: VERSION, ...m }, location.origin);
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; } };
  if (globalThis.__foeBridgeTool && globalThis.__foeBridgeTool.alive()) return;
  globalThis.__foeBridgeTool = { alive };
  let port = null;
  /** Signature of the definitions already passed to this page (all parts arrived). */
  let known = null;
  const parts = new Map(); // signature → parts arrived
  /** Definitions the site asked for and has not received yet (signature or ""): asked
   *  again after a reconnection, so the request is not lost while the worker sleeps. */
  let wanted = null, wantedAt = 0;
  const WANTED_MS = 60000;   // the site gives up after a minute: so do we
  const askDefinitions = () => port && port.postMessage({ type: "request", kind: "tool", signature: null, noDefinitions: false, only: wanted || null });
  const hello = () => {
    if (!port) return;
    if (wanted !== null && Date.now() - wantedAt > WANTED_MS) wanted = null;
    if (wanted !== null) askDefinitions();
    else port.postMessage({ type: "hello", kind: "tool", signature: known, noDefinitions: true });
  };
  let offline = false;
  let beat = null;
  const goOffline = () => {
    if (offline) return;
    offline = true;
    clearInterval(beat);
    // the orphaned script can still talk to the page: tell the site right away
    window.postMessage({ type: "foe-bridge", version: VERSION, event: "offline" }, location.origin);
  };
  const connect = () => {
    if (offline || port) return;   // one connection at a time (a reconnection may already have happened)
    if (!alive()) { goOffline(); return; }
    try { port = chrome.runtime.connect({ name: "foe-bridge" }); } catch { port = null; goOffline(); return; }
    port.onMessage.addListener((m) => {
      // kind (0.10.0): "own" or "visited" (a site that does not know it treats every city as own)
      if (m.type === "city") toSite({ event: "city", kind: m.kind === "visited" ? "visited" : "own", reason: m.reason, ts: m.ts, server: m.server, player: m.player, playerId: m.playerId, signature: m.signature, json: m.json });
      else if (m.type === "definitions") {
        toSite({ event: "definitions", signature: m.signature, part: m.part, parts: m.parts, text: m.text });
        const n = (parts.get(m.signature) || 0) + 1; parts.set(m.signature, n);
        if (n === m.parts) { known = m.signature; parts.clear(); if (!wanted || wanted === m.signature) wanted = null; }
      }
      else if (m.type === "status") toSite({ event: "status", status: m.status });
      else if (m.type === "game-tabs") toSite({ event: "game-tabs", n: m.n });
      else if (m.type === "pong") toSite({ event: "presence", gameTabs: m.gameTabs });
    });
    // the service worker may fall asleep: reconnect and get a fresh snapshot
    port.onDisconnect.addListener(() => { port = null; setTimeout(connect, alive() ? 1000 : 0); });
    hello();
  };
  const ping = () => {
    if (!alive()) { goOffline(); return; }   // extension disabled or reloaded
    if (!port) connect();
    try { port && port.postMessage({ type: "ping" }); } catch { /* reconnects at the next beat */ }
  };
  let started = false;
  const start = () => {
    started = true;
    connect();
    beat = setInterval(ping, 15000);
    ping();
  };
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.type !== "foe-bridge-request" || !alive()) return;
    if (!started) start();
    if (e.data.what === "presence") ping();
    else if (e.data.what === "definitions") {
      // the site wants them for an import: again, even if already passed
      known = null; parts.clear();
      wanted = typeof e.data.signature === "string" ? e.data.signature : ""; wantedAt = Date.now();
      if (!port) connect(); else askDefinitions();
    }
    // snapshot: with the connection closed (worker asleep, tab hidden) the reconnection asks
    // for one by itself (hello = fresh snapshot); otherwise it is asked now
    else if (!port) connect();
    else port.postMessage({ type: "request", kind: "tool", signature: known, noDefinitions: true });
  });
})();
