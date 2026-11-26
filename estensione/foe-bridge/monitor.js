// ─────────────────────────────────────────────────────────────────────────────
//  monitor.js — the extension's debug page.
//  - Game tabs: world, helper (FoE Helper / Forge Hammer) and its version, the
//    bridge script version in the tab, active map, last snapshot, last status.
//  - Stored definitions, connected pages.
//  - Cities received: what changed compared with the previous package.
//  - Log (repeated lines become one line with "×N") and a debug report to copy.
// ─────────────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const VERSION = chrome.runtime.getManifest().version;
const cities = new Map();      // key server|player → { m, data, map, changes[], n }
/** Building definitions by signature: only a small id → name map (for the list of
 *  changes), their count and size. Neither the 63 MB text nor the parsed object
 *  is kept. */
const definitions = new Map(); // signature → { parts: string[] | null, arrived, names?, count?, mb? }
let tabs = [], pages = null, stored = [];

/** Address without query and hash (they may carry anything: not in a report to paste). */
const noQuery = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return ""; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kb = (n) => (n / 1024).toFixed(0) + " KB";
const ago = (ts) => {
  if (!ts) return "never";
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 5 ? "just now" : s < 60 ? s + " s ago" : s < 3600 ? Math.round(s / 60) + " min ago" : new Date(ts).toLocaleTimeString();
};

// ── Log ──
/** Log, newest first. The same line repeated in a row becomes one line with "×N". */
const logLines = [];   // { time, text, n }
function log(t) {
  const top = logLines[0];
  if (top && top.text === t) { top.n++; top.time = new Date().toLocaleTimeString(); }
  else { logLines.unshift({ time: new Date().toLocaleTimeString(), text: t, n: 1 }); if (logLines.length > 500) logLines.pop(); }
  $("log").textContent = logLines.map(l => l.time + "  " + l.text + (l.n > 1 ? "  ×" + l.n : "")).join("\n");
}

// ── Cities ──
function buildingMap(data) {
  const out = new Map();
  for (const e of Object.values(data.CityMapData || {})) {
    if (!e || e.id == null) continue;
    out.set(String(e.id), { cid: e.cityentity_id, x: e.x || 0, y: e.y || 0, lvl: e.level ?? null });
  }
  return out;
}
function name(sig, cid) { const e = definitions.get(sig); return (e && e.names && e.names.get(cid)) || cid; }
function differences(before, after, sig) {
  if (!before) return [];
  const rows = [];
  for (const [id, b] of after) {
    const a = before.get(id);
    if (!a) rows.push("+ " + name(sig, b.cid) + " at " + b.x + "," + b.y);
    else {
      if (a.x !== b.x || a.y !== b.y) rows.push("↔ " + name(sig, b.cid) + ": " + a.x + "," + a.y + " → " + b.x + "," + b.y);
      if (a.cid !== b.cid) rows.push("⇧ " + name(sig, a.cid) + " → " + name(sig, b.cid));
      else if (a.lvl !== b.lvl) rows.push("⇧ " + name(sig, b.cid) + ": level " + a.lvl + " → " + b.lvl);
    }
  }
  for (const [id, a] of before) if (!after.has(id)) rows.push("− " + name(sig, a.cid) + " from " + a.x + "," + a.y);
  return rows;
}

// ── Drawing ──
function drawTabs() {
  $("tabs").innerHTML = tabs.length ? `<table><tr><th>World</th><th>Helper</th><th>Script</th><th>Map</th><th>Last snapshot</th><th>Last status</th></tr>` + tabs.map(t => {
    const old = t.version && t.version !== VERSION;
    const helper = t.conflict ? '<span class="no" title="Both are active: they cannot work together. Disable one and reload the game">FoE Helper + Forge Hammer</span>'
      : t.helper ? `${esc(t.helper.n)} ${esc(t.helper.v || "")}` : '<span class="wait">not found yet</span>';
    return `<tr title="${esc(t.url)}"><td>${esc(t.server || "?")}${t.incognito ? " (incognito)" : ""}${t.player ? " · " + esc(t.player) : ""}${t.gameVersion ? `<div class="dim">game ${esc(t.gameVersion)}</div>` : ""}</td><td>${helper}</td>`
      + `<td>${t.version ? (old ? `<span class="no" title="Different from the extension (${esc(VERSION)}): reload the game">${esc(t.version)}</span>` : esc(t.version)) : '<span class="no" title="No bridge script answering in this tab: reload the game">none</span>'}</td>`
      + `<td>${esc(t.map ?? "")}</td><td>${t.lastCity ? ago(t.lastCity) + (t.reason ? " (" + esc(t.reason) + (t.prepMs != null ? ", " + esc(t.prepMs) + " ms" : "") + ")" : "") : "never"}</td>`
      + `<td>${t.status ? esc(t.status) + " · " + ago(t.statusTs) : ""}</td></tr>`;
  }).join("") + "</table>" : "No game tab open.";
  $("pages").textContent = pages ? `Connected pages: FoE Optimizer ${pages.tool}, monitor ${pages.monitor}${pages.other ? ", other " + pages.other : ""}` : "";
}
/** "game 1.348.aac04d6, " (or "game 1.348.aac04d6 / 1.349.…, " when a client update kept the same definitions). */
function gameOf(v) {
  const list = v.gameVersions && v.gameVersions.length ? v.gameVersions : v.gameVersion ? [v.gameVersion] : [];
  return list.length ? "game " + list.join(" / ") + ", " : "";
}
function drawStored() {
  $("stored").textContent = stored.length
    ? stored.map(v => `${v.signature} — ${gameOf(v)}${v.mb} MB, ${new Date(v.ts).toLocaleString()}`).join("\n")
    : "None.";
  $("stored").style.whiteSpace = "pre-wrap";
}
function draw() {
  $("cities").innerHTML = [...cities.values()].map((c) => {
    const d = c.data, e = definitions.get(c.m.signature);
    const def = e && e.names ? `definitions: ${e.count} building types (${e.mb} MB)` : `definitions: waiting (${e && e.parts ? e.arrived + "/" + e.parts.length + " parts" : "not arrived yet"})`;
    return `<div class="card"><h2>${esc(c.m.player || "?")} <span class="dim">· ${esc(c.m.server)}${c.m.helper ? " · " + esc(c.m.helper.n) : ""}</span></h2>
      <div class="num">Buildings: <b>${c.map.size}</b> · inventory: ${(d.inventory || []).length} · allies: ${Object.keys(d.allies || {}).length}
      · package ${kb(c.m.json.length)} · prepared in ${esc(c.m.prepMs)} ms</div>
      <div class="dim">${esc(def)}</div>
      <div class="dim">Last update ${new Date(c.m.ts).toLocaleTimeString()} (${esc(c.m.reason)}) · packages received: ${c.n}${(d.warn || []).length ? " · missing: " + esc(d.warn.join(", ")) : ""}</div>
      <div class="dim">signature: ${esc(String(c.m.signature))}</div>
      ${c.changes.length ? "<ul>" + c.changes.slice(0, 30).map(r => "<li>" + esc(r) + "</li>").join("") + (c.changes.length > 30 ? `<li class="dim">… ${c.changes.length - 30} more</li>` : "") + "</ul>" : ""}</div>`;
  }).join("") || '<div class="dim">No city received yet. Open the game (with FoE Helper or Forge Hammer active) and wait for the city to load.</div>';
}
// relative times ("2 min ago") stay current
setInterval(drawTabs, 5000);


/** Signature of definitions already joined (the most recent), or null. */
function knownSignature() { let f = null; for (const [k, e] of definitions) if (e.names) f = k; return f; }

// ── Connection ──
let port = null;
function connect() {
  if (port) return;
  try { port = chrome.runtime.connect({ name: "foe-bridge" }); }
  catch (e) { $("status").className = "no"; $("status").textContent = "Extension not available (" + (e && e.message) + "): reload this page."; return; }
  port.onMessage.addListener((m) => {
    if (m.type === "welcome") {
      $("version").textContent = "v" + (chrome.runtime.getManifest().version_name || m.version);
      $("status").className = "ok"; $("status").textContent = "Connected to the extension.";
      port.postMessage({ type: "stored" });
    }
    else if (m.type === "game-tabs") log(m.n ? "Open game tabs: " + m.n + " (light snapshot requested)" : "No game tab open.");
    else if (m.type === "tabs") { tabs = m.list; pages = m.pages; drawTabs(); }
    else if (m.type === "status") { log((m.tab != null ? "Game" + (m.server ? " " + m.server : "") : "Extension") + ": " + m.status); port.postMessage({ type: "stored" }); }
    else if (m.type === "log") log("· " + m.text);
    else if (m.type === "stored") { stored = m.list; drawStored(); }
    else if (m.type === "definitions") {
      log(`· definitions part ${m.part + 1}/${m.parts} (${m.source || "game"})`);
      let e = definitions.get(m.signature);
      if (!e || !e.parts || e.parts.length !== m.parts) { e = { parts: new Array(m.parts).fill(null), arrived: 0 }; definitions.set(m.signature, e); }
      if (e.parts[m.part] == null) { e.parts[m.part] = m.text; e.arrived++; }
      if (e.arrived === m.parts && !e.names) {
        const t0 = performance.now();
        const text = e.parts.join(""); e.parts = null;
        let obj;
        try { obj = JSON.parse(text); } catch { log("Unreadable definitions"); definitions.delete(m.signature); return; }
        e.count = Object.keys(obj).length; e.mb = (text.length / 1e6).toFixed(1);
        e.names = new Map(Object.entries(obj).map(([id, v]) => [id, (v && v.name) || id]));
        log(`Definitions received ${m.source === "extension" ? "from the extension" : "from the game"}: ${m.parts} parts, ${(text.length / 1e6).toFixed(1)} MB, ${e.count} building types (joined in ${Math.round(performance.now() - t0)} ms)`);
        draw();
      }
    }
    else if (m.type === "city") {
      let data; try { data = JSON.parse(m.json); } catch { log("Unreadable package"); return; }
      const k = m.server + "|" + (m.playerId ?? m.player);
      const prev = cities.get(k);
      const map = buildingMap(data);
      const changes = differences(prev && prev.map, map, m.signature);
      cities.set(k, { m, data, map, changes: changes.length ? changes : (prev ? prev.changes : []), n: (prev ? prev.n : 0) + 1 });
      log(`${m.player || "?"} (${m.server}): ${m.reason}, ${map.size} buildings, ${kb(m.json.length)}${prev ? ", " + changes.length + " changes" : ""}`);
      draw();
    }
  });
  port.onDisconnect.addListener(() => {
    port = null;
    $("status").className = "wait"; $("status").textContent = "Reconnecting… (Chrome puts the extension to sleep every 30 s or so: this is normal)";
    setTimeout(connect, 1000);
  });
  port.postMessage({ type: "hello", kind: "monitor", signature: knownSignature() });
  port.postMessage({ type: "tabs" });
}

$("clearLog").addEventListener("click", () => { logLines.length = 0; $("log").textContent = ""; });
$("clear").addEventListener("click", () => {
  if (!port) return;
  // one click at a time (a held Enter key repeated it many times)
  $("clear").disabled = true;
  setTimeout(() => { $("clear").disabled = false; }, 2000);
  port.postMessage({ type: "clear" });
  // the cities shown carry the old definitions: they go too, and come back at once (the extension asks the games for a snapshot)
  definitions.clear();
  cities.clear();
  draw();
  if (tabs.length) {
    log("Stored definitions cleared: the extension asks the game for them again (sent in the background, once).");
    port.postMessage({ type: "request", kind: "monitor", signature: null });
  } else log("Stored definitions cleared: they will be asked to the game when it is open.");
});
$("report").addEventListener("click", async () => {
  const { worlds = {} } = await chrome.storage.local.get("worlds");
  const lines = [
    "FoE Optimizer Bridge — debug report",
    "Date: " + new Date().toString(),
    "Extension: " + (chrome.runtime.getManifest().version_name || VERSION),
    "Browser: " + navigator.userAgent,
    "",
    "Game tabs:",
    ...(tabs.length ? tabs.map(t => `  ${t.server || "?"} ${noQuery(t.url)}${t.incognito ? " (incognito)" : ""} | game ${t.gameVersion || "?"} | helper ${t.helper ? t.helper.n + " " + (t.helper.v || "") : "not found"} | script ${t.version || "none"} | map ${t.map ?? "?"} | last snapshot ${t.lastCity ? new Date(t.lastCity).toLocaleString() + " (" + t.reason + ", " + t.prepMs + " ms)" : "never"} | last status ${t.status || "-"}`) : ["  none"]),
    pages ? `Connected pages: FoE Optimizer ${pages.tool}, monitor ${pages.monitor}, other ${pages.other}` : "",
    "",
    "Stored definitions:",
    ...(stored.length ? stored.map(v => `  ${v.signature} (${gameOf(v)}${v.mb} MB, ${new Date(v.ts).toLocaleString()})`) : ["  none"]),
    "",
    "Worlds in the menu:",
    ...(Object.keys(worlds).length ? Object.entries(worlds).map(([s, w]) => `  ${s} ${w.url} ${w.player || ""} (${new Date(w.ts).toLocaleString()})`) : ["  none"]),
    "",
    "Cities received:",
    ...([...cities.values()].map(c => `  ${c.m.server} ${c.m.player || "?"}: ${c.map.size} buildings, ${kb(c.m.json.length)}, ${c.n} packages, last ${new Date(c.m.ts).toLocaleString()} (${c.m.reason}), missing: ${(c.data.warn || []).join(", ") || "-"}, signature ${c.m.signature}`)),
    "",
    "Log (newest first):",
    ...logLines.map(l => `  ${l.time}  ${l.text}${l.n > 1 ? "  ×" + l.n : ""}`),
  ];
  try { await navigator.clipboard.writeText(lines.join("\n")); log("Debug report copied to the clipboard."); }
  catch (err) { log("Copy failed: " + (err && err.message)); }
});

connect();
draw();
drawStored();
