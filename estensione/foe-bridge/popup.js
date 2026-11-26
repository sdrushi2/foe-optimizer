// popup.js — menu opened by clicking the extension icon: one card per game
// world (world, player, helper, state or last update; click = focus its tab if
// open, otherwise open the game on that world; ✕ on hover forgets a world that is not open),
// FoE Optimizer (the tool tab used last, or the site) and the monitor.
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
    lastPlayed: "Ultima partita", gameTab: "Scheda del gioco",
    focusTab: "Porta in primo piano la scheda del gioco", openOn: (s) => `Apri il gioco su ${s}`,
    remove: (n, s) => `Elimina ${n} (${s}) e i suoi dati dall'estensione (le città in FoE Optimizer restano)`,
    empty: "I tuoi mondi compaiono qui dopo che hai giocato con FoE Helper o Forge Hammer attivo.",
    tool: "Apri FoE Optimizer ↗", monitor: "Monitor", langTitle: "Lingua del menu",
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
    lastPlayed: "Last played", gameTab: "Game tab",
    focusTab: "Bring the game tab to the front", openOn: (s) => `Open the game on ${s}`,
    remove: (n, s) => `Delete ${n} (${s}) and its data from the extension (the cities in FoE Optimizer stay)`,
    empty: "Your worlds appear here after you play with FoE Helper or Forge Hammer active.",
    tool: "Open FoE Optimizer ↗", monitor: "Monitor", langTitle: "Menu language",
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

async function show() {
  const VERSION = chrome.runtime.getManifest().version;
  $("version").textContent = "v" + (chrome.runtime.getManifest().version_name || VERSION);
  const { worlds = {}, lang: saved } = await chrome.storage.local.get(["worlds", "lang"]);
  setLang(saved === "en" ? "en" : "it");
  const open = await chrome.tabs.query({ url: GAME });
  draw(worlds, open, null, VERSION);                    // at once with what is stored
  if (open.length) draw(worlds, open, await tabsState(), VERSION); // then with the live state of the game tabs
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
function draw(worlds, open, st, VERSION) {
  const tabs = (st && st.list) || [];
  const openByHost = new Map(open.map(t => [new URL(t.url).host, t]));
  const cards = [];
  const shown = new Set();
  for (const [server, w] of Object.entries(worlds)) {
    const host = new URL(w.url).host;
    const tab = openByHost.get(host);
    const state = tab ? tabs.find(x => x.server === server) || tabs.find(x => x.url && new URL(x.url).host === host) : null;
    if (tab) shown.add(host);
    cards.push({ server, player: w.player, url: w.url, host, open: !!tab, ts: tab && state && state.lastCity ? state.lastCity : w.ts,
                 line: tab ? tabLine(st ? state : null, VERSION) : { cls: "", l2: `${w.helper || T.lastPlayed} · ${timeAgo(w.ts)}`, badge: T.play } });
  }
  // open game tabs of a world not seen yet (no city received so far)
  for (const [host, tab] of openByHost) {
    if (shown.has(host)) continue;
    const state = tabs.find(x => x.url && new URL(x.url).host === host);
    const server = (state && state.server) || host.split(".")[0];
    cards.push({ server, player: state && state.player, url: tab.url, host, open: true, ts: Date.now(), line: tabLine(st ? state : null, VERSION), unknown: true });
  }
  cards.sort((a, b) => (b.open - a.open) || (b.ts - a.ts));

  $("worlds").replaceChildren(...cards.map(c => card(c)));
  if (!cards.length) {
    const p = document.createElement("div");
    p.className = "empty";
    p.textContent = T.empty;
    $("worlds").append(p);
  }
}

function card(c) {
  const name = worldName(c.server);
  const el = document.createElement("div");
  el.className = "card " + c.line.cls;
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.title = c.open ? T.focusTab : T.openOn(c.server);
  const tile = document.createElement("span"); tile.className = "tile"; tile.textContent = name === "Beta" ? "β" : name.slice(0, 2);
  const info = document.createElement("span"); info.className = "info";
  const l1 = document.createElement("div"); l1.className = "l1";
  const srv = document.createElement("span"); srv.className = "srv"; srv.textContent = " · " + c.server;
  l1.append(c.player || T.gameTab, srv);
  const l2 = document.createElement("div"); l2.className = "l2"; l2.textContent = c.line.l2; l2.title = c.line.tip || c.line.l2;
  info.append(l1, l2);
  const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = c.line.badge;
  el.append(tile, info, badge);
  const go = () => focusOrOpen(GAME, c.url, c.host);
  el.addEventListener("click", go);
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  if (!c.open) {
    // ✕: deletes this world and its data from the extension (background.js forgetWorld:
    // the definitions no other world uses; with the last world, all of them). It comes
    // back by itself at the next update from its game. FoE Optimizer's cities stay.
    // Not on open worlds: their tab keeps them in the menu anyway, the ✕ would seem to do nothing.
    const x = document.createElement("button");
    x.className = "forget";
    x.textContent = "✕";
    x.title = x.ariaLabel = T.remove(name, c.server);
    x.addEventListener("click", async (e) => {
      e.stopPropagation();
      x.disabled = true;
      await new Promise((ok) => { try { chrome.runtime.sendMessage({ type: "forget-world", server: c.server }, () => { void chrome.runtime.lastError; ok(); }); } catch { ok(); } });
      show();
    });
    x.addEventListener("keydown", (e) => e.stopPropagation());
    el.append(x);
    el.classList.add("has-x");
  }
  return el;
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
