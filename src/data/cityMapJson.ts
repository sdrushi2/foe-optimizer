// ─────────────────────────────────────────────────────────────────────────────
//  data/cityMapJson.ts — Export / import JSON della mappa della città
//
//  FORMATO (dal 19 ottobre 2026): un piccolo SOTTOINSIEME del payload del
//  bookmarklet (stesse chiavi e stessa forma del gioco), così il file si apre
//  nei planner che leggono l'intero payload (es. quello di Linnun o l'editor
//  "Planner città" dell'utente) senza conversioni:
//    {
//      "CityMapData":  { "<id>": { id, cityentity_id, type, x, y } },   // edifici E strade
//      "CityEntities": { "<cityentity_id>": { id, name, type, width, length,
//                        requirements: { street_connection_level } } },  // solo quelli in città
//      "UnlockedAreas": [ { x, y, width?, length? } ]                    // come il bookmarklet
//    }
//  Le strade sono voci di CityMapData con type "street" (1×1 o 2×2: la
//  dimensione è in CityEntities). street_connection_level = livello di
//  strada RICHIESTO (BuildingModel.requiredRoadLevel), omesso se 0.
//
//  2.0 (26 ottobre 2026) — JSON "UNIVERSALE": allo stesso file si aggiungono
//  le chiavi del Planner di FORGE HAMMER (version 3, player, region,
//  currentEra, mapBuildings, storedBuildings, deletedBuildings, mapData), così
//  si importa anche in Hammer; Linnun ed editor leggono le chiavi sopra e
//  ignorano le altre. cityData (città reale per il confronto in Hammer) non
//  c'è: nell'export della città coincide con il piano.
//
//  IMPORT (`leggiCittaJson`, usato dal Planner): accetta questo formato,
//  l'intero payload del bookmarklet (anche dentro "data"), l'export del
//  Planner di FORGE HAMMER (2.0: mapBuildings / mapData, vedi `leggiHammer`)
//  e il VECCHIO formato semplificato (buildings / roads / unlocked_areas),
//  usato dalle città del banco di prova (planner-test).
// ─────────────────────────────────────────────────────────────────────────────

import type { CityMapBuilding } from "./cityMap";
import type { CityEntityDefinition, UnlockedArea } from "./bookmarklet";
import { BuildingModel } from "../models/BuildingModel";
import { isGreatBuildingId, isInactiveBuildingId, isMilitaryBuildingId } from "./buildingClassification";
import { datiGioco } from "./datiGioco";
import { parseBuildingsCsv } from "./buildings";

interface MapEntryJson { id: number | string; cityentity_id: string; type: string; x: number; y: number }
interface EntityJson { id: string; name: string; type: string; width: number; length: number; requirements?: { street_connection_level: number } }
/** Pezzo del piano nel formato di Forge Hammer (version 3). */
interface HammerEntry { id: number; metaId: string; x: number; y: number; era?: string; custom: boolean }
/** JSON "universale" (2.0): chiavi di Forge Hammer + chiavi del bookmarklet
 *  (Linnun, editor, Planner). Ogni tool legge le sue e ignora le altre. */
export interface CityMapJson {
  // ── Forge Hammer (importa solo se mapBuildings e storedBuildings sono liste)
  version: 3;
  /** Città reale (formato di Hammer / del gioco): id, cityentity_id, type, x, y,
   *  era; Grandi Edifici con la voce del gioco (level, max_level, bonus...). */
  cityData: Record<string, Record<string, unknown>>;
  player?: { id: number | null; name: string };
  region?: string;
  currentEra?: string;
  mapBuildings: HammerEntry[];
  storedBuildings: HammerEntry[];
  deletedBuildings: HammerEntry[];
  /** Espansioni con width/length sempre esplicite (come i file di Hammer). */
  mapData: Array<{ x: number; y: number; width: number; length: number }>;
  // ── bookmarklet / Linnun / FoE Optimizer
  CityMapData: Record<string, MapEntryJson>;
  CityEntities: Record<string, EntityJson>;
  UnlockedAreas: UnlockedArea[];
}

/** Intestazione per Forge Hammer: giocatore, region (dalla lingua del gioco,
 *  decisione dell'utente) ed era. Impostata da App per la città selezionata;
 *  `esportaCittaJson` la usa se non ne riceve una propria (null = nessuna,
 *  es. Planner con una città da JSON). */
export interface MetaExport {
  player?: { id: number | null; name: string }; region?: string; currentEra?: string;
  /** Città REALE (per `cityData`): negli export del Planner è diversa dal
   *  piano; se manca, cityData = il piano stesso. */
  cittaReale?: readonly CityMapBuilding[];
  /** Voci grezze del gioco dei Grandi Edifici (entityId → voce, con livello e
   *  bonus): finiscono in cityData come nei file di Hammer. */
  grandiEdifici?: ReadonlyMap<string, Record<string, unknown>>;
}
let metaCitta: MetaExport = {};
export function impostaMetaExport(m: MetaExport): void { metaCitta = m; }

/** Aree sbloccate nel formato del bookmarklet (width/length solo se ≠ 4×4). */
function areeBookmarklet(aree: readonly UnlockedArea[]): UnlockedArea[] {
  return aree.map(a => {
    const x = Number(a.x ?? 0), y = Number(a.y ?? 0);
    const w = a.width != null ? Number(a.width) : 4, l = a.length != null ? Number(a.length) : 4;
    return w === 4 && l === 4 ? { x, y } : { x, y, width: w, length: l };
  });
}

/**
 * Costruisce il JSON esportato. `buildings` = edifici E tessere strada
 * (type "street"), come cityMapBuildings. Gli id non numerici (es. le strade
 * tracciate dal Planner) ricevono un id numerico nuovo, oltre il massimo.
 * `idMap` (facoltativa): riempita con id del JSON → mapEntityId (canale
 * Planner ↔ editor, per riconoscere gli edifici al ritorno).
 */
export function esportaCittaJson(buildings: readonly CityMapBuilding[], aree: readonly UnlockedArea[], idMap?: Map<string, string>, meta?: MetaExport | null): CityMapJson {
  const m = meta === undefined ? metaCitta : (meta ?? {});
  const CityMapData: Record<string, MapEntryJson> = {};
  const CityEntities: Record<string, EntityJson> = {};
  const mapBuildings: HammerEntry[] = [];
  const reale = m.cittaReale ?? buildings;
  // era per copia: dal pezzo stesso o, negli export del Planner, dalla città reale
  const eraPerId = new Map(reale.filter(b => b.era).map(b => [b.mapEntityId, b.era!]));
  let prossimo = Math.max(0, ...[...buildings, ...reale].map(b => (/^\d+$/.test(b.mapEntityId) ? Number(b.mapEntityId) : 0))) + 1;
  const idNum = new Map<string, number>();
  const idDi = (b: CityMapBuilding) => {
    let id = idNum.get(b.mapEntityId);
    if (id === undefined) { id = /^\d+$/.test(b.mapEntityId) ? Number(b.mapEntityId) : prossimo++; idNum.set(b.mapEntityId, id); }
    return id;
  };
  const cityData: Record<string, Record<string, unknown>> = {};
  for (const b of reale) {
    const id = idDi(b);
    const raw = b.isGreatBuilding ? m.grandiEdifici?.get(b.entityId) : undefined;
    // come sanitizeCityData di Hammer: niente stato di produzione né player_id
    const { state: _s, next_state_transition_at: _a, next_state_transition_in: _i, connected: _c, player_id: _p, ...pulita } = raw ?? {};
    const era = b.era ?? (b.isGreatBuilding ? m.currentEra : undefined);
    cityData[String(id)] = {
      ...pulita, id, cityentity_id: b.entityId, type: b.type, x: b.x, y: b.y,
      ...(era ? { era } : {}),
      ...(b.livello !== undefined ? { level: b.livello } : {}), ...(b.livelloMax !== undefined ? { max_level: b.livelloMax } : {}),
    };
  }
  for (const b of buildings) {
    const id = idDi(b);
    const era = b.era ?? eraPerId.get(b.mapEntityId) ?? m.currentEra;
    CityMapData[String(id)] = { id, cityentity_id: b.entityId, type: b.type, x: b.x, y: b.y };
    mapBuildings.push({ id, metaId: b.entityId, x: b.x, y: b.y, ...(era ? { era } : {}), custom: false });
    idMap?.set(String(id), b.mapEntityId);
    if (!CityEntities[b.entityId]) {
      const e: EntityJson = { id: b.entityId, name: b.name, type: b.type, width: b.w, length: b.h };
      const lv = b.type === "street" ? 0 : (b.roadLevel ?? 0);
      if (lv > 0) e.requirements = { street_connection_level: lv };
      CityEntities[b.entityId] = e;
    }
  }
  const UnlockedAreas = areeBookmarklet(aree);
  return {
    version: 3,
    ...(m.player ? { player: m.player } : {}),
    ...(m.region ? { region: m.region } : {}),
    ...(m.currentEra ? { currentEra: m.currentEra } : {}),
    cityData, mapBuildings, storedBuildings: [], deletedBuildings: [],
    mapData: UnlockedAreas.map(a => ({ x: Number(a.x ?? 0), y: Number(a.y ?? 0), width: Number(a.width ?? 4), length: Number(a.length ?? 4) })),
    CityMapData, CityEntities, UnlockedAreas,
  };
}

/** Città letta da un JSON esterno. `strade` = celle di strada originali;
 *  `aree` = espansioni sbloccate (per la Mappa e l'export della città JSON). */
export interface CittaJson {
  buildings: CityMapBuilding[]; cells: Set<string>; strade: number; aree: UnlockedArea[];
  /** Pezzi saltati perché senza dimensioni note (solo import da Forge Hammer). */
  ignorati?: string[];
  /** Giocatore del file (player / currentEra di Hammer e del nostro export):
   *  il gruppo "Giocatore" del nastro del Planner con la sorgente JSON. */
  giocatore?: { nome: string; id: number | null; era: string | null };
}

function celle(aree: ReadonlyArray<{ x?: unknown; y?: unknown; width?: unknown; length?: unknown }>): Set<string> {
  const cells = new Set<string>();
  for (const a of aree) {
    const x = Number(a.x ?? 0), y = Number(a.y ?? 0), w = Number(a.width ?? 4), l = Number(a.length ?? 4);
    for (let i = 0; i < w; i++) for (let j = 0; j < l; j++) cells.add(`${x + i},${y + j}`);
  }
  return cells;
}

function edificio(entityId: string, mapEntityId: string, name: string, x: number, y: number, w: number, h: number, type: string, roadLevel: number): CityMapBuilding {
  return {
    entityId, mapEntityId, name, x, y, w, h, type,
    isGreatBuilding: isGreatBuildingId(entityId), isMilitary: isMilitaryBuildingId(entityId),
    isNeedlessRoad: false, isInactive: isInactiveBuildingId(entityId), isSuppliesProducer: false, roadLevel,
  };
}

/** Dimensioni e strada dal catalogo, per i file senza CityEntities (export
 *  di Forge Hammer): buildings.csv + buildings_extra.csv (militari, fabbriche
 *  di beni, municipi, strade... caricato da `impostaCatalogoExtra` prima
 *  dell'import). ATTENZIONE: la colonna Size è "lunghezza x larghezza"
 *  (buildings.py scrive f"{size_y}x{size_x}"), quindi width = secondo numero.
 *  Livello di strada: colonna RoadLvl (0/1/2); se manca (CSV vecchi) chi
 *  richiede la strada (Road > 0) ha livello 1. */
export type VoceCat = { w: number; h: number; lv: number; nome: string };
let catalogo: Map<string, VoceCat> | null = null;
let testoExtra = "";
function aggiungi(m: Map<string, VoceCat>, csv: string) {
  for (const b of parseBuildingsCsv(csv)) {
    const [l, w] = b.size.toLowerCase().split("x").map(n => parseInt(n, 10));
    if (w! > 0 && l! > 0 && !m.has(b.cityEntityId)) m.set(b.cityEntityId, { w: w!, h: l!, lv: b.roadLvl > 0 ? b.roadLvl : b.road > 0 ? 1 : 0, nome: b.name });
  }
}
/** Testo di buildings_extra.csv (vedi datiGioco.caricaBuildingsExtra). */
export function impostaCatalogoExtra(csv: string): void {
  if (!csv || csv === testoExtra) return;
  testoExtra = csv;
  catalogo = null;
}
export function voceCatalogo(entityId: string): VoceCat | undefined {
  if (!catalogo) {
    catalogo = new Map();
    aggiungi(catalogo, datiGioco().buildings);
    if (testoExtra) aggiungi(catalogo, testoExtra);
  }
  return catalogo.get(entityId);
}

/** Export del Planner di Forge Hammer (version 3): il piano è `mapBuildings`
 *  ({ metaId, x, y, era, id? }), le espansioni `mapData`; `cityData` (città
 *  reale) serve solo per il tipo. Dimensioni e livello di strada: CityEntities
 *  se c'è (file universale), altrimenti il catalogo (buildings.csv +
 *  buildings_extra.csv); senza extra, ripiego municipio 6×7 e strade 1×1 /
 *  2×2 ("CarStreet"). I pezzi sconosciuti vengono saltati (`ignorati`). */
function leggiHammer(d: Record<string, unknown>): CittaJson {
  const aree = Array.isArray(d.mapData) ? (d.mapData as UnlockedArea[]) : [];
  if (!aree.length) throw new Error("manca 'mapData' (espansioni)");
  const ents = (d.CityEntities ?? {}) as Record<string, CityEntityDefinition & { name?: string; type?: string }>;
  const city = (d.cityData ?? {}) as Record<string, { type?: unknown }>;
  const ignorati: string[] = [];
  const buildings: CityMapBuilding[] = [];
  (d.mapBuildings as Array<{ metaId?: unknown; id?: unknown; x?: unknown; y?: unknown }>).forEach((m, i) => {
    const entityId = String(m?.metaId ?? "");
    if (!entityId) return;
    const id = m.id != null ? String(m.id) : `hammer-${i}`;
    const tipoCitta = m.id != null ? city[String(m.id)]?.type : undefined;
    const pre = entityId.slice(0, 2);
    const type = String(tipoCitta ?? ents[entityId]?.type ?? (pre === "H_" ? "main_building" : pre === "S_" ? "street" : pre === "X_" ? "greatbuilding" : "generic_building"));
    if (["hub_main", "hub_part", "off_grid", "outpost_ship", "friends_tavern"].includes(type)) return;
    let w = 0, h = 0, lv = 0, nome = entityId;
    const e = ents[entityId];
    const c = e ? undefined : voceCatalogo(entityId);
    if (e) {
      [w, h] = BuildingModel.getCityEntitySize(e);
      lv = BuildingModel.requiredRoadLevel(e);
      nome = String(e.name ?? entityId);
    } else if (c) {
      w = c.w; h = c.h; nome = c.nome;
      lv = isGreatBuildingId(entityId) ? 1 : c.lv;
    } else if (type === "main_building") { w = 6; h = 7; }                       // ripiego senza buildings_extra.csv
    else if (type === "street") { w = h = /CarStreet/i.test(entityId) ? 2 : 1; }
    // il municipio tiene il suo livello (come con la bacchetta: requiredRoadLevel = 1)
    if (type === "street") lv = 0;
    else if (type === "main_building" && lv === 0) lv = 1;
    if (!(w > 0 && h > 0)) { ignorati.push(entityId); return; }
    buildings.push(edificio(entityId, id, nome, Number(m.x ?? 0), Number(m.y ?? 0), w, h, type, lv));
  });
  if (!buildings.some(b => b.type === "main_building")) throw new Error("manca il municipio");
  segnaStradeInutili(buildings);
  const strade = buildings.filter(b => b.type === "street").reduce((t, b) => t + b.w * b.h, 0);
  return { buildings, cells: celle(aree), strade, aree: areeBookmarklet(aree), ...(ignorati.length ? { ignorati } : {}) };
}

/** "Connessi inutilmente" (come l'import con la bacchetta, App.tsx): edifici
 *  che NON richiedono strada ma ne toccano una su un lato. Nei file JSON il
 *  dato non c'è: si ricalcola dalla mappa. */
function segnaStradeInutili(buildings: CityMapBuilding[]): void {
  const strada = new Set<string>();
  for (const b of buildings) if (b.type === "street")
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) strada.add(`${b.x + i},${b.y + j}`);
  for (const b of buildings) {
    if (b.type === "street" || b.type === "main_building" || (b.roadLevel ?? 0) > 0) continue;
    let tocca = false;
    for (let i = 0; i < b.w && !tocca; i++) tocca = strada.has(`${b.x + i},${b.y - 1}`) || strada.has(`${b.x + i},${b.y + b.h}`);
    for (let j = 0; j < b.h && !tocca; j++) tocca = strada.has(`${b.x - 1},${b.y + j}`) || strada.has(`${b.x + b.w},${b.y + j}`);
    b.isNeedlessRoad = tocca;
  }
}

/** Legge l'export JSON della mappa (nuovo o vecchio formato), il payload del bookmarklet o l'export di Forge Hammer. */
export function leggiCittaJson(testo: string): CittaJson {
  const dati = JSON.parse(testo) as unknown;
  const citta = leggiCittaDati(dati);
  const d = (dati && typeof dati === "object" ? dati : {}) as { player?: { id?: unknown; name?: unknown }; currentEra?: unknown };
  const nome = typeof d.player?.name === "string" ? d.player.name.trim() : "";
  if (nome) citta.giocatore = {
    nome,
    id: typeof d.player?.id === "number" && Number.isFinite(d.player.id) ? d.player.id : null,
    era: typeof d.currentEra === "string" ? d.currentEra : null,
  };
  return citta;
}

/** Come leggiCittaJson, ma da un oggetto già letto (canale Planner ↔ editor). */
export function leggiCittaDati(dati: unknown): CittaJson {
  if (!dati || typeof dati !== "object") throw new Error("dati della città mancanti");
  let d = dati as Record<string, unknown>;
  if (d.data && typeof d.data === "object") d = d.data as Record<string, unknown>;
  let buildings: CityMapBuilding[];
  let cells: Set<string>;
  if (d.CityMapData && typeof d.CityMapData === "object") {
    const ents = (d.CityEntities ?? {}) as Record<string, CityEntityDefinition & { name?: string; type?: string }>;
    if (!Array.isArray(d.UnlockedAreas)) throw new Error("manca 'UnlockedAreas'");
    cells = celle(d.UnlockedAreas as UnlockedArea[]);
    buildings = [];
    for (const [k, v] of Object.entries(d.CityMapData as Record<string, { id?: unknown; cityentity_id?: unknown; type?: unknown; x?: unknown; y?: unknown }>)) {
      const entityId = String(v?.cityentity_id ?? "");
      const e = ents[entityId];
      const [w, h] = BuildingModel.getCityEntitySize(e);
      if (!e || !(w > 0 && h > 0)) continue;           // senza dimensioni non si può piazzare
      const type = String(v.type ?? e.type ?? "");
      if (["hub_main", "hub_part", "off_grid", "outpost_ship", "friends_tavern"].includes(type)) continue;
      buildings.push(edificio(entityId, String(v.id ?? k), String(e.name ?? entityId), Number(v.x ?? 0), Number(v.y ?? 0), w, h, type,
        type === "street" ? 0 : BuildingModel.requiredRoadLevel(e)));
    }
  } else if (Array.isArray(d.mapBuildings)) {
    return leggiHammer(d);
  } else {
    const v = d as {
      buildings?: Array<{ id?: unknown; cityentity_id?: unknown; name?: unknown; width?: unknown; length?: unknown; x?: unknown; y?: unknown; road_requirement?: unknown }>;
      roads?: { single?: unknown; two_lane?: unknown };
      unlocked_areas?: UnlockedArea[];
    };
    if (!Array.isArray(v.buildings) || !Array.isArray(v.unlocked_areas)) throw new Error("mancano 'CityMapData', 'mapBuildings' (Forge Hammer) o 'buildings'/'unlocked_areas'");
    cells = celle(v.unlocked_areas);
    buildings = v.buildings.map((b, i) => {
      const entityId = String(b.cityentity_id ?? "");
      return edificio(entityId, String(b.id ?? `ext-${i}`), String(b.name ?? entityId), Number(b.x ?? 0), Number(b.y ?? 0),
        Number(b.width ?? 1), Number(b.length ?? 1), entityId.startsWith("H_") ? "main_building" : "building", Number(b.road_requirement ?? 0));
    });
    const strade = Number(v.roads?.single ?? 0) + Number(v.roads?.two_lane ?? 0) * 4;
    if (!buildings.some(b => b.type === "main_building")) throw new Error("manca il municipio (cityentity_id H_…)");
    return { buildings, cells, strade, aree: areeBookmarklet(v.unlocked_areas) };
  }
  if (!buildings.some(b => b.type === "main_building")) throw new Error("manca il municipio");
  segnaStradeInutili(buildings);
  const strade = buildings.filter(b => b.type === "street").reduce((t, b) => t + b.w * b.h, 0);
  return { buildings, cells, strade, aree: areeBookmarklet(d.UnlockedAreas as UnlockedArea[]) };
}

/** Scarica un oggetto come file JSON (indentato). */
export function scaricaJson(dati: unknown, nomeFile: string): void {
  const blob = new Blob([JSON.stringify(dati, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
