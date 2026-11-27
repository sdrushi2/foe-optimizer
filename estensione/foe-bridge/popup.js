// popup.js — menu opened by clicking the extension icon: one card per game
// world (world, player, helper, state or last update; click = focus its tab if
// open, otherwise open the game on that world; ✕ on hover forgets a world that is not open),
// FoE Optimizer (the tool tab used last, or the site) and the monitor.
// 0.10.0: in each card the LIVE / PAUSED pill (pause of the whole world), the
// player's own city and the last visited cities, each with its switch (what goes
// to FoE Optimizer), a green dot on the city being visited now and a ✕ (with a
// confirmation in the row) that removes a visited city from the extension only.
// The switches live in background.js (storage "sync"); the menu only shows them.
// Italian by default, English with the IT | EN switch in the header.
const $ = (id) => document.getElementById(id);
const GAME = ["https://*.forgeofempires.com/game*"];
const isToolUrl = (u) => {
  try { const x = new URL(u); return (x.protocol === "https:" && x.hostname === "foe-optimizer.com") || (x.protocol === "http:" && x.hostname === "localhost"); }
  catch { return false; }
};
const TOOL_URL = "https://foe-optimizer.com/";
const LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

// ── Language: Italian by default, IT | EN switch in the header (saved) ───────
// Only the menu is translated; the monitor (debug) and the logs stay in English.
const TEXT = {
  it: {
    justNow: "ora", minAgo: (n) => `${n} min fa`, hAgo: (n) => `${n} h fa`, dAgo: (n) => `${n} g fa`,
    checking: "controllo…", reload: "RICARICA", wait: "ATTESA", conflict: "CONFLITTO", play: "GIOCA", error: "ERRORE",
    noSignature: "Città non utilizzabile dal tool",
    noSignatureTip: "L'helper non indica più il file delle definizioni degli edifici del gioco (forse un suo aggiornamento): la città arriva ma FoE Optimizer non la può importare. Usa la bacchetta e manda a Sdrushi il Copy debug report del Monitor",
    notRunning: "Bridge non attivo qui · ricarica il gioco",
    oldScript: (v) => `Script del bridge vecchio (${v}) · ricarica il gioco`,
    conflictShort: "Due helper attivi: tienine uno",
    conflictTip: "FoE Helper e Forge Hammer sono attivi insieme e non possono funzionare insieme. Disattivane uno in chrome://extensions e ricarica il gioco",
    waitHelper: "In attesa di FoE Helper o Forge Hammer",
    notLoaded: (h) => `${h} · città non ancora caricata`,
    updated: (h, t) => `${h} · aggiornata ${t}`,
    lastPlayed: "Ultima partita", gameTab: "Scheda del gioco", world: (n) => `Mondo ${n}`,
    focusTab: "Porta in primo piano la scheda del gioco", openOn: (s) => `Apri il gioco su ${s}`,
    remove: (n, s) => `Elimina ${n} (${s}) e i suoi dati dall'estensione (le città in FoE Optimizer restano)`,
    empty: "I tuoi mondi compaiono qui dopo che hai giocato con FoE Helper o Forge Hammer attivo.",
    tool: "Apri FoE Optimizer ↗", monitor: "Monitor", langTitle: "Lingua del menu",
    live: "LIVE", paused: "PAUSA",
    pauseTip: "Sincronizzazione attiva: clic per mettere in pausa questo mondo. Nessuna sua città va a FoE Optimizer finché non riprendi; gli interruttori restano come sono",
    resumeTip: "In pausa: clic per riprendere. Le città accese tornano subito in FoE Optimizer",
    yourCities: "Le tue città", visitedCities: "Città visitate",
    onTip: (n) => `${n}: sincronizzata con FoE Optimizer. Clic per fermarla (in FoE Optimizer resta com'è)`,
    offTip: (n) => `${n}: non va in FoE Optimizer. Clic per portarla subito e tenerla aggiornata a ogni visita`,
    ownOnTip: (n) => `${n}: sincronizzata con FoE Optimizer a ogni modifica nel gioco. Clic per metterla in pausa`,
    ownOffTip: (n) => `${n}: in pausa, non va in FoE Optimizer. Clic per riprendere`,
    visitingNow: "La stai visitando ora", visitedAgo: (t) => `visitata ${t}`,
    removeCity: (n) => `Togli ${n} dall'estensione (in FoE Optimizer resta)`,
    confirmRemove: (n) => `Togliere ${n} dall'estensione?`, yes: "Togli", no: "Annulla",
    removeAll: "Elimina tutte", removeAllTip: "Toglie tutte le città visitate dall'estensione (in FoE Optimizer restano)",
    confirmRemoveAll: "Togliere tutte le città visitate?",
  },
  en: {
    justNow: "just now", minAgo: (n) => `${n} min ago`, hAgo: (n) => `${n} h ago`, dAgo: (n) => `${n} d ago`,
    checking: "checking…", reload: "RELOAD", wait: "WAIT", conflict: "CONFLICT", play: "PLAY", error: "ERROR",
    noSignature: "City not usable by the tool",
    noSignatureTip: "The helper no longer points to the game's building definitions file (maybe one of its updates): the city arrives but FoE Optimizer cannot import it. Use the wand and send Sdrushi the Copy debug report from the Monitor",
    notRunning: "Bridge not running here · reload the game",
    oldScript: (v) => `Old bridge script (${v}) · reload the game`,
    conflictShort: "Two helpers on: keep only one",
    conflictTip: "FoE Helper and Forge Hammer are both active and cannot work together. Disable one in chrome://extensions and reload the game",
    waitHelper: "Waiting for FoE Helper or Forge Hammer",
    notLoaded: (h) => `${h} · city not loaded yet`,
    updated: (h, t) => `${h} · updated ${t}`,
    lastPlayed: "Last played", gameTab: "Game tab", world: (n) => `World ${n}`,
    focusTab: "Bring the game tab to the front", openOn: (s) => `Open the game on ${s}`,
    remove: (n, s) => `Delete ${n} (${s}) and its data from the extension (the cities in FoE Optimizer stay)`,
    empty: "Your worlds appear here after you play with FoE Helper or Forge Hammer active.",
    tool: "Open FoE Optimizer ↗", monitor: "Monitor", langTitle: "Menu language",
    live: "LIVE", paused: "PAUSED",
    pauseTip: "Sync on: click to pause this world. None of its cities goes to FoE Optimizer until you resume; the switches stay as they are",
    resumeTip: "Paused: click to resume. The cities switched on go back to FoE Optimizer at once",
    yourCities: "Your cities", visitedCities: "Visited cities",
    onTip: (n) => `${n}: synced with FoE Optimizer. Click to stop it (it stays in FoE Optimizer as it is)`,
    offTip: (n) => `${n}: not sent to FoE Optimizer. Click to bring it there now and keep it updated at every visit`,
    ownOnTip: (n) => `${n}: synced with FoE Optimizer at every change in the game. Click to pause it`,
    ownOffTip: (n) => `${n}: paused, not sent to FoE Optimizer. Click to resume`,
    visitingNow: "You are visiting it now", visitedAgo: (t) => `visited ${t}`,
    removeCity: (n) => `Remove ${n} from the extension (it stays in FoE Optimizer)`,
    confirmRemove: (n) => `Remove ${n} from the extension?`, yes: "Remove", no: "Cancel",
    removeAll: "Delete all", removeAllTip: "Removes every visited city from the extension (they stay in FoE Optimizer)",
    confirmRemoveAll: "Remove all visited cities?",
  },
};
let lang = "it";
let T = TEXT.it;

/** "it6" → "F", "zz1" → "Beta" (same rule as FoE Optimizer). */
function worldName(server) {
  if (server === "zz1") return "Beta";
  const m = /^([a-z]+)(\d+)$/.exec(server || "");
  return m && +m[2] > 0 ? LETTERS[(+m[2] - 1) % LETTERS.length] : server;
}
const timeAgo = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 60 ? T.justNow : s < 3600 ? T.minAgo(Math.round(s / 60)) : s < 86400 ? T.hAgo(Math.round(s / 3600)) : T.dAgo(Math.round(s / 86400));
};

/** Focus the first tab matching `patterns` (optionally on `host`), or open `url`. */
async function focusOrOpen(patterns, url, host) {
  const tabs = (await chrome.tabs.query({ url: patterns })).filter(t => !host || new URL(t.url).host === host);
  if (tabs.length) {
    const t = tabs[0];
    await chrome.tabs.update(t.id, { active: true });
    await chrome.windows.update(t.windowId, { focused: true });
  } else await chrome.tabs.create({ url });
  window.close();
}

/** State of the game tabs from the service worker (helper found, last snapshot…). */
function tabsState() {
  return new Promise((ok) => {
    const tm = setTimeout(() => ok(null), 2000);
    try { chrome.runtime.sendMessage({ type: "popup-status" }, (r) => { clearTimeout(tm); ok(chrome.runtime.lastError ? null : r); }); }
    catch { clearTimeout(tm); ok(null); }
  });
}

/** Last state drawn (redrawn when the switches change while the menu is open). */
let last = null;
/** A ✕ waiting for its confirmation ("server|id"): no redraw while it is open. */
let confirming = null;

async function show() {
  const VERSION = chrome.runtime.getManifest().version;
  $("version").textContent = "v" + (chrome.runtime.getManifest().version_name || VERSION);
  const { worlds = {}, sync = {}, lang: saved } = await chrome.storage.local.get(["worlds", "sync", "lang"]);
  setLang(saved === "en" ? "en" : "it");
  const open = await chrome.tabs.query({ url: GAME });
  last = { worlds, sync, open, st: last && last.st, VERSION };
  draw(worlds, sync, open, last.st, VERSION);                         // at once with what is stored
  if (open.length) { last.st = await tabsState(); draw(worlds, sync, open, last.st, VERSION); } // then with the live state of the game tabs
}
// a new visit or a switch changed while the menu is open
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local" || !ch.sync || !last || confirming) return;
  last.sync = ch.sync.newValue || {};
  draw(last.worlds, last.sync, last.open, last.st, last.VERSION);
});

/** Tells the extension (background.js) to change a switch, then redraws. */
async function toBackground(m) {
  await new Promise((ok) => { try { chrome.runtime.sendMessage(m, () => { void chrome.runtime.lastError; ok(); }); } catch { ok(); } });
  show();
}

/** State of one open game tab → class (live / wait / no), second line, badge. */
function tabLine(t, VERSION) {
  if (!t) return { cls: "wait", l2: T.checking, badge: "…" };
  if (!t.version) return { cls: "wait", l2: T.notRunning, badge: T.reload };
  if (t.version !== VERSION) return { cls: "wait", l2: T.oldScript(t.version), badge: T.reload };
  if (t.conflict) return { cls: "no", l2: T.conflictShort, tip: T.conflictTip, badge: T.conflict };
  if (!t.helper) return { cls: "wait", l2: T.waitHelper, badge: T.wait };
  if (!t.lastCity) return { cls: "wait", l2: T.notLoaded(t.helper.n), badge: T.wait };
  if (t.noSignature) return { cls: "no", l2: T.noSignature, tip: T.noSignatureTip, badge: T.error };
  return { cls: "live", l2: T.updated(t.helper.n, timeAgo(t.lastCity)), badge: "LIVE" };
}

/** One card per world: the open ones first (with their live state), then the others by last use. */
function draw(worlds, sync, open, st, VERSION) {
  const tabs = (st && st.list) || [];
  const openByHost = new Map(open.map(t => [new URL(t.url).host, t]));
  const cards = [];
  const shown = new Set();
  for (const [server, w] of Object.entries(worlds)) {
    const host = new URL(w.url).host;
    const tab = openByHost.get(host);
    const state = tab ? tabs.find(x => x.server === server) || tabs.find(x => x.url && new URL(x.url).host === host) : null;
    if (tab) shown.add(host);
    cards.push({ server, player: w.player, url: w.url, host, open: !!tab, state, ts: tab && state && state.lastCity ? state.lastCity : w.ts,
                 line: tab ? tabLine(st ? state : null, VERSION) : { cls: "", l2: `${w.helper || T.lastPlayed} · ${timeAgo(w.ts)}`, badge: T.play } });
  }
  // worlds with remembered cities but no entry in the list (only visits so far): their card too,
  // so what the badge counts can always be seen and switched
  for (const [server, w] of Object.entries(sync)) {
    if (worlds[server] || !/^[a-z]{1,5}\d{1,4}$/.test(server)) continue;
    const host = server + ".forgeofempires.com";
    if (openByHost.has(host)) continue;   // its open tab makes its card below
    const ts = Math.max(0, ...(w.visited || []).map(v => v.ts || 0));
    cards.push({ server, player: null, url: `https://${host}/game/index`, host, open: false, state: null, ts,
                 line: { cls: "", l2: T.lastPlayed + " · " + timeAgo(ts || Date.now()), badge: T.play } });
  }
  // open game tabs of a world not seen yet (no city received so far)
  for (const [host, tab] of openByHost) {
    if (shown.has(host)) continue;
    const state = tabs.find(x => x.url && new URL(x.url).host === host);
    const server = (state && state.server) || host.split(".")[0];
    cards.push({ server, player: state && state.player, url: tab.url, host, open: true, state, ts: Date.now(), line: tabLine(st ? state : null, VERSION), unknown: true });
  }
  cards.sort((a, b) => (b.open - a.open) || (b.ts - a.ts));

  // two groups, rows like a table: your cities (one row per world: pause of the world and
  // switch of the city) and the visited cities of every world, most recent first
  const none = { paused: false, own: {}, visited: [] };
  const mine = cards.flatMap(c => ownRows(c, sync[c.server] || none));
  const visits = [];
  for (const c of cards) for (const v of (sync[c.server] || none).visited || []) visits.push({ v, c, paused: !!(sync[c.server] || none).paused });
  visits.sort((a, b) => (b.v.ts || 0) - (a.v.ts || 0));
  const group = (title, rows, extra) => {
    const g = el("section", "group"), head = el("div", "gtitle"), tb = el("div", "table");
    head.append(el("span", "gname", title));
    if (extra) head.append(...extra);
    tb.append(...rows); g.append(head, tb); return g;
  };
  // "Delete all" on the title row of the visited cities (with a confirmation in the same row)
  const all = () => {
    if (confirming === "*all") {
      const yes = el("button", "yes", T.yes), no = el("button", "no", T.no);
      yes.type = no.type = "button";
      yes.addEventListener("click", () => { confirming = null; toBackground({ type: "sync-forget-all" }); });
      no.addEventListener("click", () => { confirming = null; show(); });
      return [el("span", "ask-all", T.confirmRemoveAll), yes, no];
    }
    const b = el("button", "all", T.removeAll);
    b.type = "button";
    b.title = T.removeAllTip;
    b.addEventListener("click", () => { confirming = "*all"; draw(last.worlds, last.sync, last.open, last.st, last.VERSION); });
    return [b];
  };
  const parts = [];
  if (mine.length) parts.push(group(T.yourCities, mine));
  if (visits.length) parts.push(group(T.visitedCities, visits.map(x => visitedRow(x.v, x.c, x.paused)), all()));
  if (!cards.length) parts.push(el("div", "empty", T.empty));
  $("worlds").replaceChildren(...parts);
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** Switch (on / off) for a city. */
function toggle(on, tip, onClick) {
  const b = el("button", "switch" + (on ? " on" : ""));
  b.type = "button";
  b.setAttribute("role", "switch");
  b.setAttribute("aria-checked", String(on));
  b.title = b.ariaLabel = tip;
  b.append(el("span", "knob"));
  b.addEventListener("click", (e) => { e.stopPropagation(); b.disabled = true; onClick(); });
  return b;
}

/** Small picture of a city: the player's avatar, or the first letter. */
function face(avatar, name, fallback) {
  const f = el("span", "face");
  const letter = fallback || (name || "?").slice(0, 1).toUpperCase();
  if (avatar && /^https:\/\/[^/]*innogamescdn\.com\//.test(avatar)) {
    const img = document.createElement("img");
    img.src = avatar; img.alt = ""; img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => { img.remove(); f.textContent = letter; });
    f.append(img);
  } else f.textContent = letter;
  return f;
}

/** Rows of a world in "Your cities": one per own city (one per world, except a second
 *  account), or one without switch while no city has arrived yet. Avatar, player · world,
 *  LIVE / PAUSED (pause of the whole world), switch of the city. Helper and last update in
 *  the tooltip; a second line only for a problem. Click = its game tab. */
function ownRows(c, sw) {
  const name = worldName(c.server);
  const own = Object.entries(sw.own || {});
  return (own.length ? own : [[null, null]]).map(([id, o], i) => {
    const row = el("div", "row " + c.line.cls + (sw.paused ? " paused" : ""));
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.title = [c.line.tip || c.line.l2, c.open ? T.focusTab : T.openOn(c.server)].filter(Boolean).join("\n");
    const pic = face(o && o.avatar, null, name === "Beta" ? "β" : name.slice(0, 2));
    const info = el("span", "info");
    const l1 = el("div", "l1");
    // the world as players call it (A, B… Beta); the server code in the tooltip of the row
    const who = (o && o.name) || c.player;
    if (who) { const w = el("span", "srv", " · " + name); w.title = c.server; l1.append(who, w); }
    else l1.append(c.open ? T.gameTab + " · " + name : T.world(name));
    info.append(l1);
    if (c.line.cls === "wait" || c.line.cls === "no") info.append(el("div", "l2", c.line.l2));
    row.append(pic, info);
    if (i === 0 && !c.open) {
      // ✕: deletes this world and its data from the extension (background.js forgetWorld:
      // the definitions no other world uses; with the last world, all of them; its switches and
      // visited cities). It comes back by itself at the next update from its game.
      // FoE Optimizer's cities stay. Not on open worlds: their tab keeps them in the menu anyway.
      const x = el("button", "forget", "✕");
      x.type = "button";
      x.title = x.ariaLabel = T.remove(name, c.server);
      x.addEventListener("click", async (e) => {
        e.stopPropagation();
        x.disabled = true;
        await new Promise((ok) => { try { chrome.runtime.sendMessage({ type: "forget-world", server: c.server }, () => { void chrome.runtime.lastError; ok(); }); } catch { ok(); } });
        show();
      });
      x.addEventListener("keydown", (e) => e.stopPropagation());
      row.append(x);
    }
    if (i === 0) {
      const pill = el("button", "pill" + (sw.paused ? " paused" : ""), sw.paused ? T.paused : T.live);
      pill.type = "button";
      pill.title = pill.ariaLabel = sw.paused ? T.resumeTip : T.pauseTip;
      pill.setAttribute("aria-pressed", String(!!sw.paused));
      pill.addEventListener("click", (e) => { e.stopPropagation(); pill.disabled = true; toBackground({ type: "sync-pause", server: c.server, paused: !sw.paused }); });
      pill.addEventListener("keydown", (e) => e.stopPropagation());
      row.append(pill);
    } else row.append(el("span", "pill-space"));
    if (o) {
      const sw1 = toggle(!!o.on, o.on ? T.ownOnTip(o.name) : T.ownOffTip(o.name), () => toBackground({ type: "sync-own", server: c.server, id, on: !o.on }));
      sw1.addEventListener("keydown", (e) => e.stopPropagation());
      row.append(sw1);
    } else row.append(el("span", "switch-space"));
    const go = () => focusOrOpen(GAME, c.url, c.host);
    row.addEventListener("click", go);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    return row;
  });
}

/** Row of a visited city: avatar, player · world (green dot while visiting it), "visited …
 *  ago" (✕ in its place on hover, with a confirmation in the row), switch. Greyed out while
 *  its world is paused. */
function visitedRow(v, c, paused) {
  const row = el("div", "row city" + (paused ? " paused" : ""));
  const key = c.server + "|" + v.id;
  if (confirming === key) {
    row.classList.add("ask");
    const yes = el("button", "yes", T.yes), no = el("button", "no", T.no);
    yes.type = no.type = "button";
    yes.addEventListener("click", () => { confirming = null; toBackground({ type: "sync-forget", server: c.server, id: v.id }); });
    no.addEventListener("click", () => { confirming = null; show(); });
    row.append(el("span", "nm", T.confirmRemove(v.name)), yes, no);
    return row;
  }
  const info = el("span", "info");
  const l1 = el("div", "l1");
  const w = el("span", "srv", " · " + worldName(c.server)); w.title = c.server;
  l1.append(v.name, w);
  if (c.state && c.state.visiting && c.state.visiting.id === v.id) { const dot = el("span", "now"); dot.title = dot.ariaLabel = T.visitingNow; l1.append(dot); }
  info.append(l1);
  const when = el("span", "when", T.visitedAgo(timeAgo(v.ts)));
  const x = el("button", "rm", "✕");
  x.type = "button";
  x.title = x.ariaLabel = T.removeCity(v.name);
  x.addEventListener("click", () => { confirming = key; draw(last.worlds, last.sync, last.open, last.st, last.VERSION); });
  row.append(face(v.avatar, v.name), info, when, x,
    toggle(!!v.on, v.on ? T.onTip(v.name) : T.offTip(v.name), () => toBackground({ type: "sync-visited", server: c.server, id: v.id, on: !v.on })));
  return row;
}

/** Applies the language to the fixed texts and the IT | EN switch. */
function setLang(l) {
  lang = l; T = TEXT[l];
  document.documentElement.lang = l;
  $("tool").textContent = T.tool;
  $("monitor").textContent = T.monitor;
  $("lang").title = $("lang").ariaLabel = T.langTitle;
  for (const b of $("lang").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.lang === l));
}
for (const b of $("lang").querySelectorAll("button"))
  b.addEventListener("click", async () => { await chrome.storage.local.set({ lang: b.dataset.lang }); show(); });

/** Focus the tool tab used last (online or local, any port), or open the site. */
$("tool").addEventListener("click", async () => {
  const tabs = (await chrome.tabs.query({})).filter(t => isToolUrl(t.url))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else await chrome.tabs.create({ url: TOOL_URL });
  window.close();
});
$("monitor").addEventListener("click", async () => {
  const url = chrome.runtime.getURL("monitor.html");
  const ctx = chrome.runtime.getContexts ? await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [url] }) : [];
  if (ctx.length && ctx[0].tabId >= 0) {
    const t = await chrome.tabs.update(ctx[0].tabId, { active: true });
    await chrome.windows.update(t.windowId, { focused: true });
  } else await chrome.tabs.create({ url });
  window.close();
});
show();
