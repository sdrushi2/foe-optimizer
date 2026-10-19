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
//  IMPORT (`leggiCittaJson`, usato dal Planner): accetta questo formato,
//  l'intero payload del bookmarklet (anche dentro "data") e il VECCHIO
//  formato semplificato (buildings / roads / unlocked_areas), usato dalle
//  città del banco di prova (planner-test).
// ─────────────────────────────────────────────────────────────────────────────

import type { CityMapBuilding } from "./cityMap";
import type { CityEntityDefinition, UnlockedArea } from "./bookmarklet";
import { BuildingModel } from "../models/BuildingModel";
import { isGreatBuildingId, isInactiveBuildingId, isMilitaryBuildingId } from "./buildingClassification";

interface MapEntryJson { id: number | string; cityentity_id: string; type: string; x: number; y: number }
interface EntityJson { id: string; name: string; type: string; width: number; length: number; requirements?: { street_connection_level: number } }
export interface CityMapJson {
  CityMapData: Record<string, MapEntryJson>;
  CityEntities: Record<string, EntityJson>;
  UnlockedAreas: UnlockedArea[];
}

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
export function esportaCittaJson(buildings: readonly CityMapBuilding[], aree: readonly UnlockedArea[], idMap?: Map<string, string>): CityMapJson {
  const CityMapData: Record<string, MapEntryJson> = {};
  const CityEntities: Record<string, EntityJson> = {};
  let prossimo = Math.max(0, ...buildings.map(b => (/^\d+$/.test(b.mapEntityId) ? Number(b.mapEntityId) : 0))) + 1;
  for (const b of buildings) {
    const id = /^\d+$/.test(b.mapEntityId) ? Number(b.mapEntityId) : prossimo++;
    CityMapData[String(id)] = { id, cityentity_id: b.entityId, type: b.type, x: b.x, y: b.y };
    idMap?.set(String(id), b.mapEntityId);
    if (!CityEntities[b.entityId]) {
      const e: EntityJson = { id: b.entityId, name: b.name, type: b.type, width: b.w, length: b.h };
      const lv = b.type === "street" ? 0 : (b.roadLevel ?? 0);
      if (lv > 0) e.requirements = { street_connection_level: lv };
      CityEntities[b.entityId] = e;
    }
  }
  return { CityMapData, CityEntities, UnlockedAreas: areeBookmarklet(aree) };
}

/** Città letta da un JSON esterno. `strade` = celle di strada originali. */
export interface CittaJson { buildings: CityMapBuilding[]; cells: Set<string>; strade: number }

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

/** Legge l'export JSON della mappa (nuovo o vecchio formato) o il payload del bookmarklet. */
export function leggiCittaJson(testo: string): CittaJson {
  return leggiCittaDati(JSON.parse(testo));
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
        type === "street" || type === "main_building" ? 0 : BuildingModel.requiredRoadLevel(e)));
    }
  } else {
    const v = d as {
      buildings?: Array<{ id?: unknown; cityentity_id?: unknown; name?: unknown; width?: unknown; length?: unknown; x?: unknown; y?: unknown; road_requirement?: unknown }>;
      roads?: { single?: unknown; two_lane?: unknown };
      unlocked_areas?: UnlockedArea[];
    };
    if (!Array.isArray(v.buildings) || !Array.isArray(v.unlocked_areas)) throw new Error("mancano 'CityMapData' o 'buildings'/'unlocked_areas'");
    cells = celle(v.unlocked_areas);
    buildings = v.buildings.map((b, i) => {
      const entityId = String(b.cityentity_id ?? "");
      return edificio(entityId, String(b.id ?? `ext-${i}`), String(b.name ?? entityId), Number(b.x ?? 0), Number(b.y ?? 0),
        Number(b.width ?? 1), Number(b.length ?? 1), entityId.startsWith("H_") ? "main_building" : "building", Number(b.road_requirement ?? 0));
    });
    const strade = Number(v.roads?.single ?? 0) + Number(v.roads?.two_lane ?? 0) * 4;
    if (!buildings.some(b => b.type === "main_building")) throw new Error("manca il municipio (cityentity_id H_…)");
    return { buildings, cells, strade };
  }
  if (!buildings.some(b => b.type === "main_building")) throw new Error("manca il municipio");
  const strade = buildings.filter(b => b.type === "street").reduce((t, b) => t + b.w * b.h, 0);
  return { buildings, cells, strade };
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
