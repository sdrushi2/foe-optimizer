// ─────────────────────────────────────────────────────────────────────────────
//  game-main.js — runs INSIDE the game page (MAIN world), next to FoE Helper or Forge Hammer.
//
//  READ-ONLY. It does not wrap any game function (XMLHttpRequest, fetch,
//  WebSocket), sends no requests to the game server and changes nothing. It
//  only uses the helper extension the player already has, FoE Helper or Forge
//  Hammer. The one read outside the helper is the client version, taken from the
//  game script the browser has already loaded (clientVersion, below). The two can never work together (both install their own proxy on
//  the game's requests; Forge Hammer shows a warning and stops when it finds
//  FoE Helper): if both are in the page the bridge sends nothing and reports
//  the conflict until the player disables one and reloads the game.
//   - its internal events "CityMapUpdated" and "InventoryUpdated"
//     (FoE Helper: FoEproxy.addFoeHelperHandler; Forge Hammer:
//     FH.proxy.addCustomHandler);
//   - its response handlers for InventoryService and AllyService
//     (FoEproxy.addHandler / FH.proxy.addHandler): buying a building in the
//     shop, assembling an ally or selling a building from the inventory do
//     not change the map.
//  One second after the last signal it reads the city data (FoE Helper:
//  MainParser; Forge Hammer: FH.Main) and builds the same package as the FoE
//  Optimizer magic wand (v8, same fields), for the player's OWN city (kind "own").
//
//  Visited cities (0.10.0): the response to OtherPlayerService.visitPlayer (the
//  same data FoE Helper and Forge Hammer read for their city map) becomes the
//  wand's package of a visited city (kind "visited": map, areas, name, avatar;
//  no inventory or allies, as with the wand). The helper's "ActiveMapUpdated"
//  event tells when the player leaves the visited city ("map" message).
//  Whether a city goes on to FoE Optimizer is decided by the extension (the
//  switches in its menu), not here.
//
//  The building definitions (CityEntities, ~63 MB) do not fit in a Chrome
//  message (64 MB limit) and do not change during a session: they are left out
//  of the package and sent separately, in 2 MB parts prepared in small slices
//  when the browser is idle (the game never freezes), only when the extension
//  asks for them (it keeps one copy per game version). Their signature is the
//  version code of the game's metadata file (MainParser.MetaUrls), free to read.
//
//  Messages leave this script as JSON strings in CustomEvents, picked up by
//  game-relay.js.
//
//  The extension may inject this script again into an already open game tab
//  (after being enabled, updated or reloaded): the newest copy takes over and
//  the previous one goes silent (its handlers in the helper stay registered but
//  do nothing), so the game does not need a reload.
// ─────────────────────────────────────────────────────────────────────────────
(() => {
  // the newest copy wins: an older one (previous extension version) stops emitting
  const ME = Math.random().toString(36).slice(2);
  window.__foeOptimizerBridge = ME;
  const active = () => window.__foeOptimizerBridge === ME;

  // the version is added by game-relay.js (it reads the manifest): never a number to update by hand
  const WAND_VERSION = 9;          // same as CURRENT_BOOKMARKLET_VERSION in the tool
  const DELAY_MS = 1000;           // groups close signals (a move sends two)
  const PART = 2 * 1024 * 1024;    // characters per part of the definitions (small: each part is one short slice)
  const EVENT_OUT = "foe-optimizer-bridge:game";
  const EVENT_IN = "foe-optimizer-bridge:relay";

  const emit = (obj) => {
    if (!active()) return;
    // every status says which helper we are hooked to (the menu and the monitor show it)
    if (obj.type === "status" && !obj.helper && hookedName) { const src = source(); obj.helper = { n: hookedName, v: src ? src.version() : null }; }
    document.dispatchEvent(new CustomEvent(EVENT_OUT, { detail: JSON.stringify(obj) }));
  };

  // The helpers' variables are top-level "let" globals (e.g. `let MainParser`,
  // `let CityMap`): they are not on window and can only be reached by name. No
  // eval (the game's CSP may forbid it). Forge Hammer keeps most of its data
  // in the global FH object (globalThis.FH), but shares CityMap, Castle and
  // srcLinks with FoE Helper's names.
  /* global MainParser, FoEproxy, CityMap, Allies, srcLinks, ExtPlayerAvatar, ExtPlayerName, ExtPlayerID, extVersion, ResourceStock, Castle, ActiveMap, Outposts */
  const READERS = {
    MainParser: () => typeof MainParser !== "undefined" ? MainParser : undefined,
    FoEproxy: () => typeof FoEproxy !== "undefined" ? FoEproxy : undefined,
    CityMap: () => typeof CityMap !== "undefined" ? CityMap : undefined,
    Allies: () => typeof Allies !== "undefined" ? Allies : undefined,
    srcLinks: () => typeof srcLinks !== "undefined" ? srcLinks : undefined,
    ExtPlayerAvatar: () => typeof ExtPlayerAvatar !== "undefined" ? ExtPlayerAvatar : undefined,
    ExtPlayerName: () => typeof ExtPlayerName !== "undefined" ? ExtPlayerName : undefined,
    ExtPlayerID: () => typeof ExtPlayerID !== "undefined" ? ExtPlayerID : undefined,
    extVersion: () => typeof extVersion !== "undefined" ? extVersion : undefined,
    ResourceStock: () => typeof ResourceStock !== "undefined" ? ResourceStock : undefined,
    Castle: () => typeof Castle !== "undefined" ? Castle : undefined,
    ActiveMap: () => typeof ActiveMap !== "undefined" ? ActiveMap : undefined,
    Outposts: () => typeof Outposts !== "undefined" ? Outposts : undefined,
    FH: () => (typeof globalThis.FH === "object" && globalThis.FH) || undefined,
  };
  const g = (name) => { try { return READERS[name](); } catch { return undefined; } };

  function serverId() {
    const m = location.hostname.match(/^([a-z]+[1-9]\d*)\.forgeofempires\.com$/);
    return m ? m[1] : null;
  }

  /** The helper extensions, with the same view of their data. */
  function helperFoE() {
    const MP = g("MainParser"), FP = g("FoEproxy");
    if (MP && FP && typeof FP.addFoeHelperHandler === "function") return {
      name: "FoE Helper", S: MP,
      onEvent: (ev, f) => FP.addFoeHelperHandler(ev, f),
      onResponse: typeof FP.addHandler === "function" ? (service, f, method) => (method ? FP.addHandler(service, method, f) : FP.addHandler(service, f)) : null,
      version: () => g("extVersion") ?? null,
      playerName: () => g("ExtPlayerName"), playerId: () => g("ExtPlayerID") ?? null, avatar: () => g("ExtPlayerAvatar"),
      allies: () => g("Allies") || MP.Allies,
      resources: () => g("ResourceStock"),
      map: () => g("ActiveMap") ?? null,
    };
    return null;
  }
  function helperHammer() {
    const FH = g("FH");
    if (FH && FH.Main && FH.proxy && typeof FH.proxy.addCustomHandler === "function") return {
      name: "Forge Hammer", S: FH.Main,
      onEvent: (ev, f) => FH.proxy.addCustomHandler(ev, f),
      onResponse: typeof FH.proxy.addHandler === "function" ? (service, f, method) => (method ? FH.proxy.addHandler(service, method, f) : FH.proxy.addHandler(service, f)) : null,
      version: () => (FH.BaseData && FH.BaseData.extVersion) ?? null,
      playerName: () => FH.Player && FH.Player.Name, playerId: () => (FH.Player && FH.Player.ID) || null, avatar: () => FH.Player && FH.Player.Avatar,
      allies: () => g("Allies") || FH.Main.Allies,
      resources: () => FH.RessourceStock || FH.ResourceStock,
      map: () => FH.ActiveMap ?? null,
    };
    return null;
  }
  /** FoE Helper and Forge Hammer both in the page? (Raw signs, not their data:
   *  Forge Hammer stops before loading its data when it finds FoE Helper.) */
  function conflict() {
    const foe = !!(g("FoEproxy") || g("MainParser") || window.ExtbaseData);
    const FH = g("FH");
    const hammer = !!(FH && (FH.proxy || FH.BaseData));
    return foe && hammer;
  }
  let conflictReported = 0;
  /** Report the conflict (at most once a minute) and say whether there is one. */
  function blockedByConflict() {
    if (!conflict()) return false;
    if (Date.now() - conflictReported > 60000) {
      conflictReported = Date.now();
      emit({ type: "status", status: "conflict: FoE Helper and Forge Hammer are both active, they cannot work together. Disable one in chrome://extensions and reload the game", conflict: true, server: serverId() });
    }
    return true;
  }

  /** The helper we are hooked to: once chosen it stays the same (events and data
   *  must come from the same extension). */
  let hookedName = null;
  function source() {
    if (hookedName === "FoE Helper") return helperFoE();
    if (hookedName === "Forge Hammer") return helperHammer();
    return helperFoE() || helperHammer();
  }

  /** Same package as the wand v8, without CityEntities, always for the OWN city. */
  function collect() {
    const src = source();
    if (!src) return { error: "no helper found (FoE Helper or Forge Hammer)" };
    const S = src.S;
    const N = serverId();
    if (!N) return { error: "unknown game server: " + location.hostname };
    const CM = S.CityMapData || {};
    if (!Object.keys(CM).length || !Object.keys(S.CityEntities || {}).length) return { error: "city data not loaded yet in the helper", retry: true };
    const W = [];
    const C = g("CityMap") || null;
    const M = (C && C.Main) || {};
    const AO = src.allies();
    let A = null;
    try { const sl = g("srcLinks"); if (sl) A = sl.GetPortrait(src.avatar()); } catch { A = null; }
    if (!AO) W.push("allies");
    if (!S.Inventory) W.push("inventory");
    if (!M.unlockedAreas) W.push("areas");
    if (!A) W.push("avatar");
    const d = {
      _v: WAND_VERSION,
      helper: { n: src.name, v: src.version() },
      activeMap: "main",
      server: N,
      inventory: Object.values(S.Inventory || {}),
      allies: (AO || {}).allyList || {},
      CityMapData: CM,
      UnlockedAreas: (M.unlockedAreas || []).map(o => {
        const x = o.x || 0, y = o.y || 0;
        return o.width == 4 && o.length == 4 ? { x, y } : { x, y, width: o.width, length: o.length };
      }),
      portraitUrl: A,
      playerName: src.playerName() || null,
    };
    const o = C && (C.cultural_outpost || C.CulturalOutpost);
    if (o && o.areas && o.areas.length) {
      d.pirateOutpost = {
        _v: WAND_VERSION,
        areas: o.areas.map(a => ({ x: a.x || 0, y: a.y || 0, width: a.width, length: a.length })),
        entities: Object.values(o.data || {}).filter(Boolean).map(e => ({ x: e.x || 0, y: e.y || 0, cityentity_id: e.cityentity_id, type: e.type })),
      };
      // building unlocks of the settlement (FoE Helper keeps them only in memory, after the
      // settlement was opened in this session): {e: unlocked cityentity_id, u: unlocked, r: cost}
      const Z = (g("Outposts") || {}).Advancements;
      if (Array.isArray(Z) && Z.length) {
        d.pirateOutpost.advancements = Z.map(a => {
          const x = (a.rewards || [])[0];
          return { e: typeof x === "string" ? x : (x && x.id) || null, u: !!a.isUnlocked, r: (a.requirements && a.requirements.resources) || {} };
        });
      }
    } else if (!C || (!("cultural_outpost" in C) && !("CulturalOutpost" in C))) W.push("outpost");
    const R = src.resources();
    if (!R || typeof R !== "object" || Array.isArray(R) || !Object.keys(R).length) W.push("resources"); else d.resources = R;
    const Q = (g("Castle") || {}).curLevel || 0;
    if (Q > 0) d.castleLevel = Q; else W.push("castle");
    d.warn = W;
    return { data: d, playerId: src.playerId(), helper: d.helper, map: src.map() };
  }

  /** Definitions signature: the version code of the game's entity metadata file
   *  (the new client has "building_entity_lookup", the old one "city_entities")
   *  plus the number of definitions. Fallback without that URL: number of
   *  definitions + two samples, without turning all 63 MB into text. */
  function definitionsSignature(S) {
    const ent = S.CityEntities || {}, k = Object.keys(ent);
    const mu = S.MetaUrls || {};
    const url = mu.city_entities || mu.building_entity_lookup;
    if (url) { const m = String(url).match(/[?&]id=([^&]+)/); return "url:" + (m ? m[1] : String(url).split("/").pop()) + ":" + k.length; }
    // no address of the metadata file: no reliable signature. Better nothing (the definitions
    // are not stored, the tool does not import and the monitor says why) than a weak one that
    // could keep old definitions in silence.
    return null;
  }

  /** Light snapshot: the wand package WITHOUT the definitions, with their signature. */
  /** Last city sent: a game signal that changed nothing (same package, to the last
   *  character) is not sent again. A request (tool or monitor just opened) always is. */
  let lastJson = null, retries = 0;
  function send(reason) {
    if (blockedByConflict()) return;
    const t0 = performance.now();
    try {
      const r = collect();
      if (r.error) {
        emit({ type: "status", status: r.error, server: serverId() });
        // the helper is still loading (the city is there but not its data yet): try again by
        // itself, every 2 s for half a minute, instead of waiting for the next game signal
        if (r.retry && retries < 15) { retries++; clearTimeout(timer); timer = setTimeout(() => send(reason), 2000); }
        return;
      }
      retries = 0;
      const json = JSON.stringify(r.data);
      if (json === lastJson && reason !== "request" && reason !== "hooked") return;
      lastJson = json;
      emit({
        type: "city", kind: "own", reason, ts: Date.now(),
        server: r.data.server, player: r.data.playerName || "", playerId: r.playerId, avatar: r.data.portraitUrl || null,
        helper: r.helper, map: r.map, ...(clientVerKnown ? { gameVersion: clientVerKnown } : {}),
        signature: definitionsSignature(source().S), prepMs: Math.round(performance.now() - t0), json,
      });
    } catch (e) {
      emit({ type: "status", status: "error while reading the city: " + (e && e.message), server: serverId() });
    }
  }

  /**
   * Client version written by the game at startup ("1.348.aac04d6"). No helper has it: it is
   * a text inside the game's own script (ForgeHX-….js). The script is read again with
   * cache "force-cache": the browser gives the copy it has just loaded; if that copy is gone
   * it downloads the same file again from InnoGames' CDN (static files), never from the
   * game server. The search in its ~26 MB takes a few milliseconds. Once per script (its name changes with every client update); null if the
   * text (form 1.NNN.hash, as tested on 1.348.aac04d6: one match in 26 MB) is not found or
   * found more than once. Only information for the monitor.
   */
  let clientSrc = null, clientVer = Promise.resolve(null);
  /** The version once read: it travels with every city, so the extension gets it back even
   *  after Chrome restarted its service worker (which keeps the tab state in memory only). */
  let clientVerKnown = null;
  function clientVersion() {
    const src = [...document.scripts].map(s => s.src).find(s => /\/ForgeHX[^/]*\.js(\?|$)/.test(s));
    if (!src) return Promise.resolve(null);
    if (src !== clientSrc) {
      clientSrc = src;
      clientVer = fetch(src, { cache: "force-cache", credentials: "omit" })
        .then(r => (r.ok ? r.text() : ""))
        .then(t => { const v = [...new Set(t.match(/\b1\.\d{3,4}\.[0-9a-f]{7}\b/g) || [])]; clientVerKnown = v.length === 1 ? v[0] : null; return clientVerKnown; })
        .catch(() => null);
    }
    return clientVer;
  }

  /**
   * The definitions, in parts: only when the extension asks (it has none for this game
   * version: first start, game update, definitions cleared). ~63 MB of text: turned into
   * JSON in one go it would freeze the game page for about a second (no redraw, no
   * clicks). So it is done in small slices when the browser is idle (requestIdleCallback,
   * at most ~8 ms each, less than a frame) and each 2 MB part is sent as soon as it is
   * ready: the game never stops, the whole thing just takes a few seconds in the background.
   */
  const SLICE_MS = 8;
  let sendingDefinitions = false;
  const idle = () => new Promise((ok) => (window.requestIdleCallback ? requestIdleCallback(ok, { timeout: 200 }) : setTimeout(() => ok(null), 16)));
  async function sendDefinitions() {
    if (blockedByConflict() || sendingDefinitions) return;
    const src = source();
    const S = src && src.S;
    if (!S || !Object.keys(S.CityEntities || {}).length) {
      emit({ type: "status", status: "definitions requested but not loaded yet in the helper", server: serverId() });
      return;
    }
    sendingDefinitions = true;
    try {
      const gameVersion = await clientVersion();
      const t0 = performance.now();
      const signature = definitionsSignature(S);
      if (!signature) { emit({ type: "status", status: "definitions not sent: no signature (address of the game's metadata file not found in the helper)", server: serverId() }); return; }
      // one id per transmission: the extension never mixes the parts of two of them
      const tx = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const ents = S.CityEntities, keys = Object.keys(ents);
      // 1) JSON text in slices, cut into parts of PART characters
      const parts = [];
      let cur = ["{"], curLen = 1, i = 0, busy = 0, slices = 0;
      while (i < keys.length) {
        const dl = await idle();
        if (!active()) return;               // a newer copy of the script took over
        const t = performance.now();
        slices++;
        do {
          const k = keys[i];
          const piece = (i ? "," : "") + JSON.stringify(k) + ":" + JSON.stringify(ents[k]);
          cur.push(piece); curLen += piece.length; i++;
          if (curLen >= PART) { parts.push(cur.join("")); cur = []; curLen = 0; }
        } while (i < keys.length && performance.now() - t < (dl && dl.timeRemaining ? Math.min(SLICE_MS, Math.max(2, dl.timeRemaining())) : SLICE_MS));
        busy += performance.now() - t;
      }
      cur.push("}"); parts.push(cur.join(""));
      // 2) one part per idle moment (each message is copied once more on its way)
      let size = 0;
      for (let p = 0; p < parts.length; p++) {
        await idle();
        if (!active()) return;
        const t = performance.now();
        // the last part carries the total length: the extension checks the joined text against it
        emit({ type: "definitions", signature, tx, gameVersion, part: p, parts: parts.length, text: parts[p], ...(p === parts.length - 1 ? { total: size + parts[p].length } : {}) });
        size += parts[p].length;
        busy += performance.now() - t;
      }
      emit({ type: "status", status: `definitions sent to the extension in the background: ${((performance.now() - t0) / 1000).toFixed(1)} s in total, ${Math.round(busy)} ms of work in ${slices + parts.length} slices (${(size / 1e6).toFixed(1)} MB, ${parts.length} parts)`, server: serverId() });
    } catch (e) {
      emit({ type: "status", status: "error while sending the definitions: " + (e && e.message), server: serverId() });
    } finally {
      sendingDefinitions = false;
    }
  }

  /** Map areas as the wand writes them (4×4 blocks without their size). */
  const areas = (list) => (list || []).map(o => {
    const x = o.x || 0, y = o.y || 0;
    return o.width == 4 && o.length == 4 ? { x, y } : { x, y, width: o.width, length: o.length };
  });

  /**
   * A visit to another player's city (OtherPlayerService.visitPlayer): the same package as
   * the wand clicked while visiting (activeMap "OtherPlayer"), built from the game's answer
   * itself, so it does not depend on when the helper copies it into CityMap.OtherPlayer.
   * Every visit is sent (also the same city twice): the extension keeps the list of the
   * last visits and decides what goes to FoE Optimizer.
   */
  function visited(data) {
    if (!active() || blockedByConflict()) return;
    const t0 = performance.now();
    try {
      const src = source();
      const rd = data && data.responseData;
      const op = rd && rd.other_player, cm = rd && rd.city_map;
      const N = serverId();
      if (!src || !op || !cm || !Array.isArray(cm.entities) || !N) return;
      const signature = definitionsSignature(src.S);
      let A = null;
      try { const sl = g("srcLinks"); if (sl && op.avatar) A = sl.GetPortrait(op.avatar); } catch { A = null; }
      const W = [];
      if (!cm.unlocked_areas) W.push("areas");
      if (!A) W.push("avatar");
      const d = {
        _v: WAND_VERSION,
        helper: { n: src.name, v: src.version() },
        activeMap: "OtherPlayer",
        server: N,
        inventory: [],
        allies: {},
        CityMapData: Object.assign({}, ...cm.entities.map(e => ({ [e.id]: e }))),
        UnlockedAreas: areas(cm.unlocked_areas),
        portraitUrl: A,
        playerName: op.name || null,
        warn: W,
      };
      emit({
        type: "city", kind: "visited", reason: "visit", ts: Date.now(),
        server: N, player: op.name || "", playerId: op.player_id ?? null, avatar: A,
        helper: d.helper, map: "OtherPlayer", ...(clientVerKnown ? { gameVersion: clientVerKnown } : {}),
        signature, prepMs: Math.round(performance.now() - t0), json: JSON.stringify(d),
      });
    } catch (e) {
      emit({ type: "status", status: "error while reading the visited city: " + (e && e.message), server: serverId() });
    }
  }

  let timer = null;
  const schedule = (reason) => { if (!active()) return; clearTimeout(timer); timer = setTimeout(() => send(reason), DELAY_MS); };

  document.addEventListener(EVENT_IN, (e) => {
    if (!active()) return;
    let m = null; try { m = JSON.parse(e.detail); } catch { /* ignore */ }
    if (m && m.request === "snapshot") send("request");
    else if (m && m.request === "definitions") sendDefinitions();
  });

  // the helpers load their scripts after the page: wait for one of them
  let attempts = 0;
  const hook = () => {
    if (!active()) return true;   // replaced by a newer copy: stop waiting
    if (blockedByConflict()) return false;   // keep checking: maybe the player fixes it (it needs a reload anyway)
    const src = source();
    if (!src) {
      ++attempts;
      if (attempts === 30 || attempts % 600 === 0) emit({ type: "status", status: "no helper found yet (FoE Helper or Forge Hammer): still waiting", server: serverId() });
      return false;
    }
    hookedName = src.name;
    src.onEvent("CityMapUpdated", () => schedule("CityMapUpdated"));
    src.onEvent("InventoryUpdated", () => schedule("InventoryUpdated"));
    if (src.onResponse) {
      src.onResponse("InventoryService", () => schedule("InventoryService"));
      src.onResponse("AllyService", () => schedule("AllyService"));
      src.onResponse("OtherPlayerService", (data) => visited(data), "visitPlayer");
    }
    // which map the game shows (main, OtherPlayer, settlements…): the menu marks the city being visited
    src.onEvent("ActiveMapUpdated", () => { if (active()) emit({ type: "map", map: src.map(), server: serverId() }); });
    emit({ type: "status", status: "hooked to " + src.name + (src.version() ? " " + src.version() : ""), helper: { n: src.name, v: src.version() }, server: serverId() });
    // the game client version for the monitor, a little after the startup (not while the game loads)
    setTimeout(() => clientVersion().then(v => { if (v && active()) emit({ type: "status", status: "game client " + v, gameVersion: v, server: serverId() }); }), 10000);
    // the startup signal may already have passed: if the city is there, send it
    if (Object.keys(src.S.CityMapData || {}).length) schedule("hooked");
    return true;
  };
  // looking for the helper: every second for the first minute, then every 5 s (a game tab
  // without FoE Helper or Forge Hammer costs next to nothing)
  if (!hook()) {
    const t0 = Date.now();
    const look = () => { if (!hook()) setTimeout(look, Date.now() - t0 < 60000 ? 1000 : 5000); };
    setTimeout(look, 1000);
  }
})();
