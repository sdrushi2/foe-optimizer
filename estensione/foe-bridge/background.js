// ─────────────────────────────────────────────────────────────────────────────
//  background.js — the bridge's service worker.
//
//  Forwards the game's light snapshots to the connected pages (FoE Optimizer
//  and the monitor). It keeps the building definitions (CityEntities, ~63 MB)
//  in IndexedDB, one copy per signature (= version of the game's file):
//  - a snapshot with a signature it does not have → it asks the game for the
//    definitions (once per game version), joins the parts and stores them;
//  - a page that does not have that signature → the extension sends them
//    itself, in parts, before the snapshot. The game never resends them.
//  When connecting, each page says what it is ("tool" or "monitor") and which
//  signature it already has ("hello"). FoE Optimizer asks for definitions only
//  when importing, and only for the world it is importing ("only").
//
//  Debug: the state of every game tab (world, helper, script version, last
//  status, last snapshot) is kept in memory and sent to the monitor and the
//  menu; diagnostic lines ("log") go to the monitor only.
//
//  Which cities go to FoE Optimizer (0.10.0, switches in the menu): per world
//  a pause and, per city, a switch. The player's own city starts ON; the last
//  10 visited cities of each world are remembered (with their last package)
//  and start OFF: switched ON, the stored package goes to FoE Optimizer at
//  once and every new visit keeps it updated. Everything lives in
//  storage.local (the service worker can be stopped at any moment). The
//  number on the icon (badge) is the number of remembered cities.
// ─────────────────────────────────────────────────────────────────────────────
const VERSION = chrome.runtime.getManifest().version;
const PART = 8 * 1024 * 1024;
const KEEP = 3;                  // stored definitions (most recent)
const GAME = ["https://*.forgeofempires.com/game*"];
/** Connected pages: port → { kind: "tool" | "monitor" | "?", known, noDefinitions, only, wantsSince } */
const ports = new Map();

// ── IndexedDB: "definitions" (signature → text) and "index" (signature → ts, MB) ──
let dbP = null;
function db() {
  dbP ||= new Promise((ok, ko) => {
    const r = indexedDB.open("foe-bridge", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("definitions", { keyPath: "signature" }); r.result.createObjectStore("index", { keyPath: "signature" }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { dbP = null; ko(r.error); };
  });
  return dbP;
}
const req = (r) => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error(what + ": no answer in " + ms + " ms")), ms))]);
const short = (s) => String(s).slice(0, 48);

const send = (port, m) => { try { port.postMessage(m); return true; } catch (e) { ports.delete(port); log("a page went away (" + (e && e.message) + ")"); return false; } };
const toAll = (m) => { for (const p of [...ports.keys()]) send(p, m); };
/** Diagnostics in the log of the monitor (not sent to FoE Optimizer). */
function log(text) {
  for (const [p, st] of ports) if (st.kind === "monitor") { try { p.postMessage({ type: "log", text }); } catch { /* closed */ } }
}

/** Signatures stored in IndexedDB (from the small "index" store, cached). */
let storedSigs = null;
async function storedList() {
  try {
    const list = (await withTimeout((async () => req((await db()).transaction("index").objectStore("index").getAll()))(), 10000, "listing definitions")).sort((a, b) => b.ts - a.ts);
    storedSigs = new Set(list.map(v => v.signature));
    return list;
  } catch (e) { log("error listing definitions: " + (e && e.message)); return []; }
}
/** Are definitions stored for this signature? Cheap: no 63 MB read. */
async function hasDefinitions(signature) {
  if (!storedSigs) await storedList();
  return !!storedSigs && storedSigs.has(signature);
}
async function readDefinitions(signature) {
  const t0 = Date.now();
  try {
    const v = await withTimeout((async () => req((await db()).transaction("definitions").objectStore("definitions").get(signature)))(), 10000, "reading definitions");
    log(`stored definitions for ${short(signature)}: ${v ? (v.text.length / 1e6).toFixed(1) + " MB" : "none"} (read in ${Date.now() - t0} ms)`);
    return v ? v.text : null;
  } catch (e) { log("error reading definitions: " + (e && e.message)); return null; }
}
async function storeDefinitions(signature, text, gameVersion) {
  const d = await db();
  const t = d.transaction(["definitions", "index"], "readwrite");
  t.objectStore("definitions").put({ signature, text });
  t.objectStore("index").put({ signature, ts: Date.now(), mb: +(text.length / 1e6).toFixed(1), gameVersion: gameVersion || null, gameVersions: gameVersion ? [gameVersion] : [] });
  await new Promise((ok, ko) => { t.oncomplete = ok; t.onerror = () => ko(t.error); t.onabort = () => ko(t.error || new Error("transaction aborted")); });
  const old = (await storedList()).slice(KEEP);
  if (old.length) {
    const t2 = d.transaction(["definitions", "index"], "readwrite");
    for (const v of old) { t2.objectStore("definitions").delete(v.signature); t2.objectStore("index").delete(v.signature); }
    await new Promise((ok) => { t2.oncomplete = ok; t2.onerror = ok; });
    log(`old definitions removed: ${old.map(v => short(v.signature)).join(", ")}`);
    await storedList();
  }
}
async function clearStored() {
  const t = (await db()).transaction(["definitions", "index"], "readwrite");
  t.objectStore("definitions").clear(); t.objectStore("index").clear();
  await new Promise((ok) => { t.oncomplete = ok; t.onerror = ok; });
  storedSigs = new Set();
  incoming.clear();
}

// ── Game tabs ──
/** tabId → { server, url, helper, version, gameVersion, status, statusTs, lastCity, signature, map, player, visiting } (in memory: rebuilt after a restart) */
const gameState = new Map();
async function gameTabs() { return chrome.tabs.query({ url: GAME }); }
async function requestSnapshot() {
  const tabs = await gameTabs();
  for (const t of tabs) chrome.tabs.sendMessage(t.id, { type: "request-snapshot" }).catch((e) => log(`tab ${t.id}: no bridge script answering (${e && e.message}); it is injected again when the extension starts, or reload the game`));
  return tabs.length;
}
function tabInfo(tab, m) {
  const st = gameState.get(tab.id) || {};
  st.url = tab.url || st.url;
  if (m.server) st.server = m.server;
  if (m.version) st.version = m.version;
  if (m.helper) st.helper = m.helper;
  if (m.gameVersion) st.gameVersion = m.gameVersion;
  if (m.type === "city" && m.kind === "visited") { st.visiting = { id: cityKey(m), name: m.player || "" }; st.map = "OtherPlayer"; st.conflict = false; }
  else if (m.type === "city") { st.lastCity = m.ts || Date.now(); st.noSignature = !m.signature; st.signature = m.signature || st.signature; st.map = m.map ?? st.map; st.player = m.player || st.player; st.reason = m.reason; st.prepMs = m.prepMs; st.conflict = false; }
  if (m.type === "map") { st.map = m.map ?? st.map; if (m.map !== "OtherPlayer") st.visiting = null; }
  if (m.type === "status") { st.status = m.status; st.statusTs = Date.now(); st.conflict = !!m.conflict; }
  gameState.set(tab.id, st);
  sendTabs();
  if (st.signature && st.gameVersion) noteGameVersion(st.signature, st.gameVersion);
}

/**
 * The client version goes with the definitions it uses: when a tab knows both (signature
 * of its city, client version) the stored definitions with that signature get it, also
 * those stored before the version was read. A client update that keeps the same
 * definitions adds its version to the list (gameVersions, oldest first, last 5).
 */
const notedVersions = new Set();
async function noteGameVersion(signature, version) {
  const key = signature + "|" + version;
  if (notedVersions.has(key)) return;
  notedVersions.add(key);
  try {
    if (!(await hasDefinitions(signature))) { notedVersions.delete(key); return; }   // not stored yet: tried again later
    const d = await db();
    const v = await req(d.transaction("index").objectStore("index").get(signature));
    if (!v) { notedVersions.delete(key); return; }
    const list = v.gameVersions || (v.gameVersion ? [v.gameVersion] : []);
    if (list.includes(version)) return;
    v.gameVersions = [...list, version].slice(-5);
    v.gameVersion = version;
    const t = d.transaction("index", "readwrite");
    t.objectStore("index").put(v);
    await new Promise((ok) => { t.oncomplete = ok; t.onerror = ok; });
    const stored = await storedList();
    for (const [p, st] of ports) if (st.kind === "monitor") send(p, { type: "stored", list: stored });
  } catch (e) { notedVersions.delete(key); log("could not note the game version: " + (e && e.message)); }
}
let tabsTimer = null;
/** Game tabs → monitors (grouped: at most every 300 ms). */
function sendTabs() {
  clearTimeout(tabsTimer);
  tabsTimer = setTimeout(async () => {
    const list = await tabsReport();
    for (const [p, st] of ports) if (st.kind === "monitor") send(p, { type: "tabs", list, pages: pagesReport() });
  }, 300);
}
async function tabsReport() {
  const open = await gameTabs();
  const ids = new Set(open.map(t => t.id));
  for (const id of [...gameState.keys()]) if (!ids.has(id)) gameState.delete(id);
  return open.map(t => ({ tab: t.id, url: t.url, incognito: t.incognito, ...(gameState.get(t.id) || {}) }));
}
function pagesReport() {
  const c = { tool: 0, monitor: 0, other: 0 };
  for (const st of ports.values()) c[st.kind === "tool" || st.kind === "monitor" ? st.kind : "other"]++;
  return c;
}
chrome.tabs.onRemoved.addListener((id) => { if (gameState.delete(id)) sendTabs(); });

/** Cuts at about every PART characters, never between the two halves of a surrogate pair
 *  (an emoji cut in two would become "�" on the way). */
function cut(text) {
  const out = [];
  for (let i = 0; i < text.length;) {
    let j = Math.min(i + PART, text.length);
    if (j < text.length) { const c = text.charCodeAt(j - 1); if (c >= 0xD800 && c <= 0xDBFF) j--; }
    out.push(text.slice(i, j)); i = j;
  }
  return out;
}
async function sendDefinitions(port, signature, text) {
  const pieces = cut(text);
  log(`sending the definitions to a page (${ports.get(port)?.kind || "?"}): ${pieces.length} parts`);
  for (let i = 0; i < pieces.length; i++)
    if (!send(port, { type: "definitions", source: "extension", signature, part: i, parts: pieces.length, text: pieces[i] })) return false;
  return true;
}

/** Definitions on their way from the game: signature → { askedAt, parts[], arrived, waiting: Map(port → last snapshot) } */
const incoming = new Map();
const ASK_AGAIN_MS = 60000;

/** Ask the game for the definitions (once a minute at most per signature). */
function askGame(signature, tab) {
  let a = incoming.get(signature);
  if (!a) { a = { askedAt: 0, parts: null, arrived: 0, waiting: new Map() }; incoming.set(signature, a); }
  if (tab == null || Date.now() - a.askedAt < ASK_AGAIN_MS) return a;
  a.askedAt = Date.now();
  chrome.tabs.sendMessage(tab, { type: "request-definitions", signature }).catch((e) => log("asking the game for definitions failed: " + (e && e.message)));
  for (const [p, st] of ports) if (st.kind === "monitor") send(p, { type: "status", status: `new definitions (${short(signature)}): asked the game once (sent in the background, in small slices)` });
  return a;
}

/** Game snapshot → the pages, preceded by the definitions if the page wants them and lacks them.
 *  `tool: false` = not to FoE Optimizer (city switched off or world paused: the monitor still
 *  gets it); `only` = just these pages (stored visited cities sent to one page). */
async function deliver(msg, { tool = true, only = null } = {}) {
  const S = msg.signature;
  if (!S) {
    // no reliable signature (see game-main.js): the city goes to the monitor, no definitions
    log(`snapshot from ${msg.server} without a definitions signature: nothing stored, FoE Optimizer cannot import it`);
    for (const [port, st] of ports) if (st.kind === "monitor" && (!only || only.includes(port))) send(port, msg);
    return;
  }
  log(`${msg.kind === "visited" ? "visited city" : "snapshot"} from ${msg.server} (${msg.player || "?"}, ${msg.reason}, ${(msg.json.length / 1024).toFixed(0)} KB, signature ${short(S)})${tool ? "" : ", NOT for FoE Optimizer (switched off or paused)"}, connected pages: ${ports.size}`);
  let text = null, looked = false;
  for (const [port, st] of [...ports]) {
    if (only && !only.includes(port)) continue;
    if (st.kind !== "monitor" && !tool) continue;
    if (st.known === S) { send(port, msg); continue; }
    // the page wants the definitions of another world only, or none for now
    if ((st.only && st.only !== S) || st.noDefinitions) { send(port, msg); continue; }
    if (!looked) { text = await readDefinitions(S); looked = true; }
    if (text) {
      if (await sendDefinitions(port, S, text)) { st.known = S; send(port, msg); }
    } else askGame(S, msg.tab).waiting.set(port, msg);
  }
  // get them ready anyway (once per game version), even if no page wants them now
  if (!(await hasDefinitions(S)) && !looked) askGame(S, msg.tab);
}

const MAX_PARTS = 128;              // 2 MB parts: room for definitions four times today's size
const MAX_PART_CHARS = 16 * 1024 * 1024;
/** signature → time of the last immediate re-ask after a broken text (once a minute at most) */
const retriedBad = new Map();
async function partFromGame(m, tab) {
  // only well-formed parts of definitions the extension asked for (any script in the game
  // page could send messages: they must not fill the worker's memory or the store)
  if (typeof m.signature !== "string" || !m.signature || m.signature.length > 300
      || !Number.isInteger(m.parts) || m.parts < 1 || m.parts > MAX_PARTS
      || !Number.isInteger(m.part) || m.part < 0 || m.part >= m.parts
      || typeof m.text !== "string" || m.text.length > MAX_PART_CHARS) { log("definitions part refused: malformed"); return; }
  const a = incoming.get(m.signature);
  if (!a || !a.askedAt) { log(`definitions part refused: not asked (${short(m.signature)})`); return; }
  log(`definitions part ${m.part + 1}/${m.parts} from the game`);
  // a new transmission (game reloaded, helper changed…) starts over: parts of two are never mixed
  const tx = typeof m.tx === "string" ? m.tx : "";
  if (!a.parts || a.parts.length !== m.parts || a.tx !== tx) { a.parts = new Array(m.parts).fill(null); a.arrived = 0; a.tx = tx; a.total = null; }
  if (a.parts[m.part] == null) { a.parts[m.part] = m.text; a.arrived++; }
  if (m.gameVersion) a.gameVersion = m.gameVersion;
  if (Number.isInteger(m.total)) a.total = m.total;
  if (a.arrived !== m.parts) return;
  incoming.delete(m.signature);
  const text = a.parts.join("");
  const toMonitors = (status) => { for (const [p, st] of ports) if (st.kind === "monitor") send(p, { type: "status", status }); };
  // complete and from one transmission (tx): the length must be the one the game declared.
  // No JSON.parse here: ~700 ms of worker and +120 MB of memory for 63 MB, once per game
  // version; the pages parse the text anyway when they use it.
  const bad = text[0] !== "{" || text[text.length - 1] !== "}" ? "the parts do not form a JSON object"
    : a.total != null && text.length !== a.total ? `length ${text.length} instead of ${a.total}` : null;
  if (bad) {
    // a broken text reaches nobody: not the store, not the pages waiting for it. They keep
    // waiting: the game is asked again at once (once a minute at most, so a game that always
    // sends broken text cannot make a loop) and the new transmission goes to them.
    const again = tab != null && Date.now() - (retriedBad.get(m.signature) || 0) > ASK_AGAIN_MS;
    toMonitors("definitions NOT stored and NOT passed on: " + bad + (again ? " (asked the game again)" : ""));
    if (again) {
      retriedBad.set(m.signature, Date.now());
      const b = askGame(m.signature, tab);
      for (const [port, msg] of a.waiting) b.waiting.set(port, msg);
    }
    return;
  }
  try {
    await storeDefinitions(m.signature, text, a.gameVersion);
    toMonitors(`definitions stored in the extension (${(text.length / 1e6).toFixed(1)} MB)`);
  } catch (e) { toMonitors("definitions NOT stored (the pages get them anyway): " + (e && e.message)); }
  for (const [port, msg] of a.waiting) {
    const st = ports.get(port);
    if (st && await sendDefinitions(port, m.signature, text)) { st.known = m.signature; send(port, msg); }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "foe-bridge") return;
  ports.set(port, { kind: "?", known: null, noDefinitions: false, only: null });
  port.onDisconnect.addListener(() => { ports.delete(port); sendTabs(); });
  port.onMessage.addListener(async (m) => {
    const st = ports.get(port);
    if (!m || !st) return;
    if (m.type === "hello" || m.type === "request") {
      if (m.kind) st.kind = m.kind;
      st.known = m.signature || null;
      st.noDefinitions = !!m.noDefinitions;
      st.only = m.only || null;
      log(`${m.type} from a page (${st.kind}; definitions it has: ${m.signature ? short(m.signature) : "none"}${st.only ? "; wants " + short(st.only) : ""}${st.noDefinitions ? "; no definitions wanted" : ""})`);
      const n = await requestSnapshot();
      send(port, { type: "game-tabs", n });
      sendTabs();
      // the visited cities switched on are not in the games: they come from the store
      if (st.kind !== "monitor" && st.noDefinitions) sendVisits([port]);
    } else if (m.type === "ping") {
      send(port, { type: "pong", gameTabs: (await gameTabs()).length });
    } else if (m.type === "stored") {
      send(port, { type: "stored", list: await storedList() });
    } else if (m.type === "clear") {
      await clearStored();
      log("stored definitions cleared: fresh snapshot asked to the open games");
      send(port, { type: "stored", list: [] });
      requestSnapshot();   // the cities come back at once and the games send the definitions again
    } else if (m.type === "tabs") {
      send(port, { type: "tabs", list: await tabsReport(), pages: pagesReport() });
    }
  });
  send(port, { type: "welcome", version: VERSION });
});

/** Worlds seen in the game (for the menu): server → { url, player, helper, signature, ts } (signature = the definitions it uses). Writes in a queue (two worlds at once must not overwrite each other). */
let worldsQueue = Promise.resolve();
function rememberWorld(m, tab) {
  if (!tab || !tab.url || !m.server) return;
  worldsQueue = worldsQueue.then(async () => {
    try {
      const u = new URL(tab.url);
      const { worlds = {} } = await chrome.storage.local.get("worlds");
      const prev = worlds[m.server] || {};
      worlds[m.server] = { url: u.origin + u.pathname, player: m.player || prev.player || null, helper: (m.helper && m.helper.n) || prev.helper || null, signature: m.signature || prev.signature || null, ts: Date.now() };
      await chrome.storage.local.set({ worlds });
    } catch (e) { log("could not remember the world: " + (e && e.message)); }
  });
}

// ── Switches: which cities go to FoE Optimizer (0.10.0) ─────────────────────
// storage.local "sync": server → { paused, own: { id → { name, on, ts } },
//   visited: [{ id, name, avatar, ts, on }] (most recent first) }
// storage.local "visit:<server>:<id>": last package of a visited city.
// id = the player id (the name if the helper gives no id).
const MAX_VISITED = 10;
const cityKey = (m) => String(m.playerId ?? m.player ?? "");
const pkgKey = (server, id) => "visit:" + server + ":" + id;
let syncQueue = Promise.resolve();
/** Changes "sync" in a queue (one change at a time). `f(sync)` returns [result, changed]. */
function syncEdit(f) {
  const p = syncQueue.then(async () => {
    const { sync = {} } = await chrome.storage.local.get("sync");
    const [r, changed] = await f(sync);
    if (changed) await chrome.storage.local.set({ sync });
    return r;
  });
  syncQueue = p.catch((e) => log("switches: " + (e && e.message)));
  return p;
}
const worldOf = (sync, server) => (sync[server] ||= { paused: false, own: {}, visited: [] });

/** A city from the game: remembered (visited: with its package, at the top of the list).
 *  Resolves to true if it goes to FoE Optimizer (switch on, world not paused). */
function noteCity(m) {
  const id = cityKey(m);
  if (!m.server || !id) return Promise.resolve(m.kind !== "visited");
  return syncEdit(async (sync) => {
    const w = worldOf(sync, m.server);
    if (m.kind === "visited") {
      const i = w.visited.findIndex(v => v.id === id);
      const prev = i >= 0 ? w.visited.splice(i, 1)[0] : null;
      const v = { id, name: m.player || (prev && prev.name) || "?", avatar: m.avatar || (prev && prev.avatar) || null, ts: m.ts || Date.now(), on: prev ? !!prev.on : false };
      w.visited.unshift(v);
      const pkg = { ...m }; delete pkg.tab; delete pkg.from; delete pkg.toTool;
      await chrome.storage.local.set({ [pkgKey(m.server, id)]: pkg });
      // over the limit: the oldest switched-off cities go, with their package (those on stay)
      const gone = [];
      while (w.visited.length > MAX_VISITED) {
        let j = -1;
        for (let k = w.visited.length - 1; k >= 0; k--) if (!w.visited[k].on) { j = k; break; }
        if (j < 0) break;
        gone.push(w.visited.splice(j, 1)[0]);
      }
      if (gone.length) { await chrome.storage.local.remove(gone.map(x => pkgKey(m.server, x.id))); log(`visited cities forgotten (over ${MAX_VISITED}): ${gone.map(x => x.name).join(", ")}`); }
      return [!w.paused && v.on, true];
    }
    const prev = w.own[id];
    const changed = !prev || (m.player && prev.name !== m.player);
    w.own[id] = { name: m.player || (prev && prev.name) || "?", on: prev ? !!prev.on : true, ts: prev && !changed ? prev.ts : (m.ts || Date.now()) };
    return [!w.paused && w.own[id].on, changed];
  });
}

/** Stored visited cities switched on (worlds not paused) → FoE Optimizer pages (`targets`:
 *  those pages; null = all of them). Only one world / one city with `server` / `id`. */
async function sendVisits(targets, server = null, id = null) {
  try {
    const { sync = {} } = await chrome.storage.local.get("sync");
    const keys = [];
    for (const [s, w] of Object.entries(sync)) {
      if (w.paused || (server && s !== server)) continue;
      for (const v of w.visited || []) if (v.on && (!id || v.id === id)) keys.push(pkgKey(s, v.id));
    }
    if (!keys.length) return;
    const got = await chrome.storage.local.get(keys);
    const only = targets || [...ports].filter(([, st]) => st.kind !== "monitor").map(([p]) => p);
    for (const k of keys) if (got[k] && typeof got[k].json === "string") await deliver({ ...got[k], reason: "stored" }, { only });
  } catch (e) { log("could not send the stored visited cities: " + (e && e.message)); }
}

/** Menu: pause of a world, switch of a city, ✕ of a visited city. */
async function setSwitch(m) {
  const what = await syncEdit((sync) => {
    const w = worldOf(sync, m.server);
    if (m.type === "sync-pause") { const was = w.paused; w.paused = !!m.paused; return [was && !w.paused ? "resume" : null, was !== w.paused]; }
    if (m.type === "sync-own") {
      const c = w.own[m.id]; if (!c) return [null, false];
      const was = c.on; c.on = !!m.on;
      return [!was && c.on && !w.paused ? "own" : null, was !== c.on];
    }
    if (m.type === "sync-visited") {
      const v = w.visited.find(x => x.id === m.id); if (!v) return [null, false];
      const was = v.on; v.on = !!m.on;
      return [!was && v.on && !w.paused ? "visit" : null, was !== v.on];
    }
    if (m.type === "sync-forget") {
      const i = w.visited.findIndex(x => x.id === m.id); if (i < 0) return [null, false];
      w.visited.splice(i, 1);
      return ["forget", true];
    }
    return [null, false];
  });
  log(`menu: ${m.type} ${m.server}${m.id ? " " + m.id : ""}${"on" in m ? " → " + (m.on ? "on" : "off") : ""}${"paused" in m ? " → " + (m.paused ? "paused" : "live") : ""}`);
  if (what === "forget") await chrome.storage.local.remove(pkgKey(m.server, m.id));
  // back on: the own city is asked to the game, the visited ones come from the store
  if (what === "resume") { requestSnapshot(); sendVisits(null, m.server); }
  if (what === "own") requestSnapshot();
  if (what === "visit") sendVisits(null, m.server, m.id);
}

/** Badge on the icon: how many cities the extension remembers (own + visited, all worlds). */
async function updateBadge() {
  try {
    const { sync = {} } = await chrome.storage.local.get("sync");
    let n = 0;
    for (const w of Object.values(sync)) n += Object.keys(w.own || {}).length + (w.visited || []).length;
    await chrome.action.setBadgeBackgroundColor({ color: "#475569" });
    if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: "#ffffff" });
    await chrome.action.setBadgeText({ text: n <= 0 ? "" : n > 9 ? "9+" : String(n) });
  } catch { /* no badge: not important */ }
}
chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch.sync) updateBadge(); });
updateBadge();

/**
 * ✕ in the menu: forgets a world and the data kept for it. The definitions are per game
 * version, not per world: those still used by another remembered world or by an open
 * game tab stay. With the last world gone, every stored definition not in use goes, so
 * the extension is clean as just installed. Worlds remembered by the early prototypes have no
 * signature: while one of them remains, no definitions are deleted (they could be its).
 */
function forgetWorld(server) {
  const done = worldsQueue.then(async () => {
    const { worlds = {} } = await chrome.storage.local.get("worlds");
    delete worlds[server];
    await chrome.storage.local.set({ worlds });
    // its switches and the visited cities remembered for it
    const old = await syncEdit((sync) => { const w = sync[server]; delete sync[server]; return [w, !!w]; });
    if (old) await chrome.storage.local.remove((old.visited || []).map(v => pkgKey(server, v.id)));
    const rest = Object.values(worlds);
    const inUse = new Set(rest.map(w => w.signature).filter(Boolean));
    const open = new Set((await gameTabs()).map(t => t.id));
    for (const [id, st] of gameState) if (open.has(id) && st.signature) inUse.add(st.signature);
    let removed = [];
    if (!rest.some(w => !w.signature)) {
      removed = (await storedList()).map(v => v.signature).filter(s => !inUse.has(s));
      if (removed.length) {
        const t = (await db()).transaction(["definitions", "index"], "readwrite");
        for (const s of removed) { t.objectStore("definitions").delete(s); t.objectStore("index").delete(s); }
        await new Promise((ok) => { t.oncomplete = ok; t.onerror = ok; });
      }
    }
    const list = await storedList();
    log(`world ${server} forgotten from the menu` + (removed.length ? `, definitions removed: ${removed.map(short).join(", ")}` : ", no definitions removed") + ` (${rest.length} worlds and ${list.length} definitions left)`);
    for (const [p, st] of ports) if (st.kind === "monitor") send(p, { type: "stored", list });
    return { removed: removed.length };
  });
  worldsQueue = done.catch(() => {});
  return done;
}

/** A message from one of the extension's own pages (menu, monitor), not from a web page. */
const fromExtension = (sender) => !!sender && typeof sender.url === "string" && sender.url.startsWith(chrome.runtime.getURL(""));

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (!m) return;
  // ✕ in the menu
  // switches in the menu
  // (only from the extension's own pages: never from a game page, which any script there could imitate)
  if (typeof m.type === "string" && m.type.startsWith("sync-") && typeof m.server === "string" && fromExtension(sender)) {
    setSwitch(m).then(() => reply({ ok: true }), (e) => { log("switch not changed: " + (e && e.message)); reply({ error: true }); });
    return true;
  }
  if (m.type === "forget-world" && typeof m.server === "string") {
    forgetWorld(m.server).then(reply, (e) => { log("could not forget the world: " + (e && e.message)); reply({ error: true }); });
    return true;
  }
  // the menu asks for the state of the game tabs
  if (m.type === "popup-status") {
    (async () => {
      let list = await tabsReport();
      // after a restart of the service worker the state is empty: ask the games and wait a moment
      if (list.some(t => !t.server)) { await requestSnapshot(); await new Promise(r => setTimeout(r, 700)); list = await tabsReport(); }
      reply({ version: VERSION, list, pages: pagesReport() });
    })();
    return true;   // answer asynchronously
  }
  if (m.from !== "game" || !sender.tab) return;
  const tab = sender.tab.id;
  if (m.type === "city") {
    tabInfo(sender.tab, m);
    if (m.kind !== "visited") rememberWorld(m, sender.tab);
    // FoE Optimizer gets it only with its switch on and the world not paused (the monitor always)
    noteCity(m).catch(() => m.kind !== "visited").then((toTool) => deliver({ ...m, tab, toTool }, { tool: toTool }));
  }
  else if (m.type === "map") tabInfo(sender.tab, m);
  else if (m.type === "definitions") partFromGame(m, tab);
  else if (m.type === "status") { tabInfo(sender.tab, m); for (const [p, st] of ports) if (st.kind === "monitor") send(p, { ...m, tab }); }
});

// click on the extension icon: the menu (popup.html)

// ── Tabs already open when the extension starts ──────────────────────────────
// Content scripts enter a page only when it loads: after enabling, updating or
// reloading the extension, already open game and FoE Optimizer tabs would stay
// without the bridge until reloaded (the tool showed OFF). Once per extension
// start (storage.session is emptied when the extension is disabled, reloaded,
// updated and when the browser restarts) the scripts are injected into them.
// The scripts handle a second copy themselves (the newest or the alive one wins).
async function injectIntoOpenTabs() {
  try {
    const { injected } = await chrome.storage.session.get("injected");
    if (injected) return;
    await chrome.storage.session.set({ injected: true });
    for (const t of await chrome.tabs.query({ url: GAME })) {
      chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["game-relay.js"] }).catch(() => {});
      chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["game-main.js"], world: "MAIN" }).catch(() => {});
    }
    for (const t of await chrome.tabs.query({})) {
      let u; try { u = new URL(t.url || ""); } catch { continue; }
      if (!((u.protocol === "https:" && u.hostname === "foe-optimizer.com") || (u.protocol === "http:" && u.hostname === "localhost"))) continue;
      chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["tool.js"] }).catch(() => {});
    }
  } catch { /* not important: a reload of the tab does the same */ }
}
injectIntoOpenTabs();
