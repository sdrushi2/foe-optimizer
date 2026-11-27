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
//  IMPORT (27/11/2026: un solo lettore, `leggiCitta`, per Importa da JSON,
//  Planner ed editor): accetta questo formato, l'intero payload del bookmarklet
//  (anche dentro "data"), il piano di FORGE HAMMER (mapBuildings / mapData) e il
//  VECCHIO formato semplificato (buildings / roads / unlocked_areas), usato dalle
//  città del banco di prova (planner-test). Errori: `ErroreJsonCitta` con un
//  codice, tradotto per l'utente da data/erroriJson.ts.
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
  /** (27/11/2026) Avatar del giocatore: URL sui server del gioco, come la chiave della
   *  bacchetta (gli altri tool la ignorano; Importa da JSON lo mette alla città). */
  portraitUrl?: string;
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
  /** Avatar del giocatore (URL), scritto in `portraitUrl`. */
  avatar?: string;
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
    ...(m.avatar ? { portraitUrl: m.avatar } : {}),
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
  /** (27/11/2026) Avatar del giocatore del file (portraitUrl). */
  avatar?: string;
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
type VoceCat = { w: number; h: number; lv: number; nome: string };
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
function voceCatalogo(entityId: string): VoceCat | undefined {
  if (!catalogo) {
    catalogo = new Map();
    aggiungi(catalogo, datiGioco().buildings);
    if (testoExtra) aggiungi(catalogo, testoExtra);
  }
  return catalogo.get(entityId);
}

/** Errore di lettura di un JSON della città: `codice` diventa il messaggio per
 *  l'utente (messaggioErroreJson in App / editorPonte), nella sua lingua. */
export type CodiceErroreJson = "json" | "backup" | "senzaCitta" | "senzaEspansioni" | "senzaMunicipio";
export class ErroreJsonCitta extends Error {
  constructor(readonly codice: CodiceErroreJson) { super(codice); this.name = "ErroreJsonCitta"; }
}

/** Un pezzo della città letto dal file (edificio o tessera di strada). */
interface PezzoLetto {
  /** id della copia sulla mappa (chiave di CityMapData, id di mapBuildings…) */
  key: string;
  entityId: string; type: string; nome: string;
  x: number; y: number; w: number; h: number;
  /** livello di strada richiesto (0 = nessuno), dal file o dal catalogo */
  lv: number;
  /** era della copia (codice, es. "ModernEra"), se il file la dice */
  era: string | null;
  /** voce del gioco della copia (cityData o CityMapData: livello e bonus dei GE…) */
  voce: Record<string, unknown>;
}
export interface CittaLetta {
  pezzi: PezzoLetto[];
  aree: UnlockedArea[];
  /** pezzi saltati perché senza dimensioni note (né nel file né nel catalogo) */
  ignorati: string[];
  giocatore: { nome: string; id: number | null } | null;
  currentEra: string | null;
  /** avatar del giocatore (portraitUrl, come la bacchetta), se il file lo ha */
  avatar: string | null;
  /** solo vecchio formato (buildings / roads): celle di strada dichiarate */
  strade?: number;
}

const FUORI_GRIGLIA = new Set(["hub_main", "hub_part", "off_grid", "outpost_ship", "friends_tavern"]);
type Rec = Record<string, unknown>;
const oggetto = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const numero = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * L'UNICO lettore dei JSON della città (27/11/2026): lo usano Importa da JSON
 * (data/cittaDaJson.ts), il Planner (leggiCittaJson) e il canale con l'editor
 * (leggiCittaDati). Accetta il nostro export (Mappa, menu delle città, Planner),
 * il payload della bacchetta (anche dentro "data"), il piano di Forge Hammer e il
 * vecchio formato buildings / roads / unlocked_areas (banco di prova).
 * La disposizione è SEMPRE quella del file: CityMapData, poi mapBuildings, poi il
 * vecchio formato, e solo se manca tutto cityData. cityData (in Hammer e negli
 * export del Planner è la città com'è nel gioco) serve solo per arricchire le
 * copie con lo stesso id: tipo, era, livello e bonus dei Grandi Edifici.
 * Dimensioni e strada: CityEntities del file, poi il catalogo (buildings.csv +
 * buildings_extra.csv), poi municipio 6×7 e strade 1×1 / 2×2 ("CarStreet").
 */
export function leggiCitta(dati: unknown): CittaLetta {
  const radice = oggetto(dati);
  if (!radice) throw new ErroreJsonCitta("senzaCitta");
  if (radice.app === "foe-optimizer" && radice.storage) throw new ErroreJsonCitta("backup");
  const d = oggetto(radice.data) ?? radice;
  const ents = (oggetto(d.CityEntities) ?? {}) as Record<string, CityEntityDefinition & { name?: string; type?: string }>;
  const cityData = (oggetto(d.cityData) ?? {}) as Record<string, Rec>;
  const pl = oggetto(d.player);
  const giocatore = pl && typeof pl.name === "string" && pl.name.trim() ? { nome: pl.name.trim(), id: numero(pl.id) ?? null } : null;
  const currentEra = typeof d.currentEra === "string" ? d.currentEra : null;
  // (controllo completo dell'indirizzo, host del gioco compreso, all'import: sanitizePortraitUrl)
  const avatar = typeof d.portraitUrl === "string" && d.portraitUrl.startsWith("https://") && d.portraitUrl.length <= 300 ? d.portraitUrl : null;

  // 1) la disposizione: voci grezze { key, entityId, x, y, era?, voce }
  type Grezza = { key: string; entityId: string; x: unknown; y: unknown; era?: unknown; voce: Rec; w?: number; h?: number; lv?: number; nome?: string; tipo?: string };
  let grezze: Grezza[];
  let aree: unknown;
  let strade: number | undefined;
  const cityMap = oggetto(d.CityMapData);
  if (cityMap && Object.keys(cityMap).length) {
    grezze = Object.entries(cityMap).map(([k, v]) => { const o = oggetto(v) ?? {}; const key = String(o.id ?? k);
      return { key, entityId: String(o.cityentity_id ?? ""), x: o.x, y: o.y, era: o.era, voce: { ...(cityData[key] ?? {}), ...o } }; });
    aree = d.UnlockedAreas ?? d.mapData;
  } else if (Array.isArray(d.mapBuildings) && d.mapBuildings.length) {
    grezze = (d.mapBuildings as unknown[]).map((v, i) => { const o = oggetto(v) ?? {}; const key = o.id != null ? String(o.id) : `hammer-${i}`;
      return { key, entityId: String(o.metaId ?? ""), x: o.x, y: o.y, era: o.era, voce: { ...(cityData[key] ?? {}) } }; });
    aree = d.mapData ?? d.UnlockedAreas;
  } else if (Array.isArray(d.buildings) && Array.isArray(d.unlocked_areas)) {
    // vecchio formato: dimensioni e strada nel file
    grezze = (d.buildings as unknown[]).map((v, i) => { const o = oggetto(v) ?? {}; const entityId = String(o.cityentity_id ?? "");
      return { key: String(o.id ?? `ext-${i}`), entityId, x: o.x, y: o.y, voce: {}, w: Number(o.width ?? 1), h: Number(o.length ?? 1),
        lv: Number(o.road_requirement ?? 0), nome: String(o.name ?? entityId), tipo: entityId.startsWith("H_") ? "main_building" : "building" }; });
    aree = d.unlocked_areas;
    const r = oggetto(d.roads);
    strade = Number(r?.single ?? 0) + Number(r?.two_lane ?? 0) * 4;
  } else if (Object.keys(cityData).length) {
    grezze = Object.entries(cityData).map(([k, o]) => { const key = String(o.id ?? k);
      return { key, entityId: String(o.cityentity_id ?? ""), x: o.x, y: o.y, era: o.era, voce: o }; });
    aree = d.UnlockedAreas ?? d.mapData;
  } else throw new ErroreJsonCitta("senzaCitta");
  if (!Array.isArray(aree) || !aree.length) throw new ErroreJsonCitta("senzaEspansioni");

  // 2) dimensioni, tipo, strada
  const pezzi: PezzoLetto[] = [];
  const ignorati: string[] = [];
  for (const g of grezze) {
    const entityId = g.entityId;
    if (!entityId) continue;
    const e = ents[entityId];
    const cat = e ? undefined : voceCatalogo(entityId);
    const pre = entityId.slice(0, 2);
    const type = String(g.tipo ?? g.voce.type ?? e?.type
      ?? (pre === "H_" ? "main_building" : pre === "S_" ? "street" : pre === "X_" ? "greatbuilding" : "generic_building"));
    if (FUORI_GRIGLIA.has(type)) continue;
    let w = g.w ?? 0, h = g.h ?? 0, lv = g.lv ?? 0, nome = g.nome ?? entityId;
    if (g.w === undefined) {
      if (e) { [w, h] = BuildingModel.getCityEntitySize(e); lv = BuildingModel.requiredRoadLevel(e); nome = String(e.name ?? entityId); }
      else if (cat) { w = cat.w; h = cat.h; nome = cat.nome; lv = isGreatBuildingId(entityId) ? Math.max(1, cat.lv) : cat.lv; }
      else if (type === "main_building") { w = 6; h = 7; }
      else if (type === "street") { w = h = /CarStreet/i.test(entityId) ? 2 : 1; }
      else if (isGreatBuildingId(entityId)) lv = 1;
    }
    if (type === "street") lv = 0;
    if (!(w > 0 && h > 0)) { ignorati.push(entityId); continue; }
    const era = typeof g.era === "string" ? g.era : typeof g.voce.era === "string" ? (g.voce.era as string) : null;
    pezzi.push({ key: g.key, entityId, type, nome, x: Number(g.x ?? 0) || 0, y: Number(g.y ?? 0) || 0, w, h, lv, era, voce: g.voce });
  }
  if (!pezzi.some(p => p.type === "main_building")) throw new ErroreJsonCitta("senzaMunicipio");
  return { pezzi, aree: aree as UnlockedArea[], ignorati, giocatore, currentEra, avatar, ...(strade !== undefined ? { strade } : {}) };
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

/** Legge un file JSON della città (testo) per il Planner. */
export function leggiCittaJson(testo: string): CittaJson {
  let dati: unknown;
  try { dati = JSON.parse(testo); } catch { throw new ErroreJsonCitta("json"); }
  return leggiCittaDati(dati);
}

/** Come leggiCittaJson, ma da un oggetto già letto (canale Planner ↔ editor). */
export function leggiCittaDati(dati: unknown): CittaJson {
  const l = leggiCitta(dati);
  const buildings = l.pezzi.map(p => {
    const b = edificio(p.entityId, p.key, p.nome, p.x, p.y, p.w, p.h, p.type,
      // il municipio tiene il suo livello (come con la bacchetta: requiredRoadLevel = 1)
      p.type === "main_building" ? Math.max(1, p.lv) : p.lv);
    if (p.era) b.era = p.era;
    return b;
  });
  segnaStradeInutili(buildings);
  const strade = l.strade ?? buildings.filter(b => b.type === "street").reduce((t, b) => t + b.w * b.h, 0);
  return {
    buildings, cells: celle(l.aree), strade, aree: areeBookmarklet(l.aree),
    ...(l.ignorati.length ? { ignorati: l.ignorati } : {}),
    ...(l.giocatore ? { giocatore: { ...l.giocatore, era: l.currentEra } } : {}),
    ...(l.avatar ? { avatar: l.avatar } : {}),
  };
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
