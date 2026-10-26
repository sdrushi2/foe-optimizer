// ─────────────────────────────────────────────────────────────────────────────
//  data/cittaDaJson.ts — Città "ridotta" da un file JSON (FoE Optimizer 2.0)
//
//  Trasforma un JSON della città (nostro export universale, export del Planner,
//  piano di Forge Hammer, vecchio export CityMapData) in un payload come quello
//  della bacchetta (BookmarkletData), così la città entra nel selettore con lo
//  STESSO import (handleImportAll, solo città). Differenze con la bacchetta:
//   - niente inventario, alleati, risorse (la città è "visitata");
//   - CityEntities ridotte (nome, tipo, dimensioni, strada richiesta): le
//     statistiche degli edifici vengono dal catalogo (buildings.csv, a Era
//     Stellare), non per era; i Grandi Edifici hanno i boost veri se il file
//     ha la loro voce del gioco (cityData: level, bonus/bonuses);
//   - l'era di ogni copia (campo `era` di cityData / mapBuildings) diventa il
//     `level` della voce (id dell'era), come nel gioco;
//   - il collegamento alla strada (`connected`) non c'è nei file: si ricalcola
//     (strade raggiungibili dal municipio; livello 2 = strade 2×2 raggiungibili
//     solo da strade 2×2).
//  Quale città: `cityData` (la città reale) se c'è, altrimenti CityMapData,
//  altrimenti mapBuildings (piano di Hammer senza cityData).
// ─────────────────────────────────────────────────────────────────────────────

import type { BookmarkletData, CityEntityDefinition, CityMapEntry, UnlockedArea } from "./bookmarklet";
import { CURRENT_BOOKMARKLET_VERSION } from "./bookmarklet";
import { AGE_BY_CODE } from "./ages";
import { voceCatalogo } from "./cityMapJson";
import { isGreatBuildingId } from "./buildingClassification";

/** Tipi fuori griglia (Hammer li mette in cityData senza posizione). */
const FUORI_GRIGLIA = new Set(["hub_main", "hub_part", "off_grid", "outpost_ship", "friends_tavern"]);

type Voce = Record<string, unknown>;
type Entita = CityEntityDefinition & { id: string; name?: string; type?: string; width?: number; length?: number };

export interface CittaDaJson {
  data: BookmarkletData;
  /** Pezzi saltati: dimensioni sconosciute (né nel file né nel catalogo). */
  ignorati: string[];
  /** Nome del giocatore (se il file lo ha). */
  nome: string | null;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function cittaDaJson(testo: string): CittaDaJson {
  const radice = JSON.parse(testo) as unknown;
  if (!radice || typeof radice !== "object" || Array.isArray(radice)) throw new Error("non è un oggetto JSON");
  let d = radice as Record<string, unknown>;
  if (d.data && typeof d.data === "object" && !Array.isArray(d.data)) d = d.data as Record<string, unknown>;

  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Voce>) : null);
  const cityData = obj(d.cityData), cityMap = obj(d.CityMapData);
  const mapBuildings = Array.isArray(d.mapBuildings) ? (d.mapBuildings as Voce[]) : null;
  // era per copia dal piano (mapBuildings ha l'era anche quando cityData manca)
  const eraPiano = new Map<string, string>();
  mapBuildings?.forEach(m => { if (m && m.id != null && typeof m.era === "string") eraPiano.set(String(m.id), m.era); });

  let voci: Voce[];
  if (cityData && Object.keys(cityData).length) voci = Object.entries(cityData).map(([k, v]) => ({ id: k, ...v }));
  else if (cityMap && Object.keys(cityMap).length) voci = Object.entries(cityMap).map(([k, v]) => ({ id: k, ...v }));
  else if (mapBuildings?.length) voci = mapBuildings.map((m, i) => ({ id: m.id ?? `j${i}`, cityentity_id: m.metaId, x: m.x, y: m.y, era: m.era }));
  else throw new Error("mancano 'cityData', 'CityMapData' o 'mapBuildings'");

  const aree = (Array.isArray(d.UnlockedAreas) ? d.UnlockedAreas : Array.isArray(d.mapData) ? d.mapData : null) as UnlockedArea[] | null;
  if (!aree?.length) throw new Error("mancano le espansioni ('UnlockedAreas' o 'mapData')");

  const entitaFile = (obj(d.CityEntities) ?? {}) as Record<string, Entita>;
  const CityEntities: Record<string, Entita> = {};
  const ignorati: string[] = [];
  const currentEra = typeof d.currentEra === "string" ? d.currentEra : null;

  // 1) voci con dimensioni note
  type Pezzo = { key: string; voce: CityMapEntry; w: number; h: number };
  const pezzi: Pezzo[] = [];
  for (const v of voci) {
    const entityId = String(v.cityentity_id ?? "");
    if (!entityId) continue;
    const pre = entityId.slice(0, 2);
    let e = entitaFile[entityId];
    const cat = voceCatalogo(entityId);
    const type = String(v.type ?? e?.type ?? (pre === "H_" ? "main_building" : pre === "S_" ? "street" : pre === "X_" ? "greatbuilding" : "generic_building"));
    if (FUORI_GRIGLIA.has(type)) continue;
    let w = num(e?.width) ?? 0, h = num(e?.length) ?? 0;
    if (!(w > 0 && h > 0) && cat) { w = cat.w; h = cat.h; }
    if (!(w > 0 && h > 0) && type === "street") w = h = /CarStreet/i.test(entityId) ? 2 : 1;
    if (!(w > 0 && h > 0)) { ignorati.push(entityId); continue; }
    if (!CityEntities[entityId]) {
      const lv = e?.requirements?.street_connection_level ?? (cat ? cat.lv : isGreatBuildingId(entityId) ? 1 : 0);
      e = { id: entityId, name: String(e?.name ?? cat?.nome ?? entityId), type, width: w, length: h,
        ...(type !== "street" && Number(lv) > 0 ? { requirements: { street_connection_level: Number(lv) } } : {}) };
      CityEntities[entityId] = e;
    }
    const key = String(v.id);
    const gb = isGreatBuildingId(entityId);
    // era della copia → level (id dell'era), come nella voce del gioco; i GE tengono il loro livello
    const era = typeof v.era === "string" ? v.era : eraPiano.get(key) ?? currentEra;
    const idEra = era ? AGE_BY_CODE.get(era)?.id : undefined;
    const { era: _era, state: _s, next_state_transition_at: _a, next_state_transition_in: _i, connected: _c, player_id: _p, ...resto } = v;
    const voce: CityMapEntry = {
      ...resto, id: Number(key) || key, cityentity_id: entityId, type,
      x: num(v.x) ?? 0, y: num(v.y) ?? 0,
      ...(gb ? {} : idEra !== undefined ? { level: idEra } : {}),
    };
    pezzi.push({ key, voce, w, h });
  }
  if (!pezzi.some(p => p.voce.type === "main_building")) throw new Error("manca il municipio");

  // 2) collegamento alla strada (il file non lo ha): strade raggiungibili dal municipio
  const strada = new Map<string, 1 | 2>(); // cella → corsie della strada
  for (const p of pezzi) if (p.voce.type === "street")
    for (let i = 0; i < p.w; i++) for (let j = 0; j < p.h; j++) strada.set(`${p.voce.x! + i},${p.voce.y! + j}`, p.w === 2 && p.h === 2 ? 2 : 1);
  const vicini = (p: Pezzo) => {
    const out: string[] = [];
    const x0 = p.voce.x!, y0 = p.voce.y!;
    for (let i = 0; i < p.w; i++) { out.push(`${x0 + i},${y0 - 1}`, `${x0 + i},${y0 + p.h}`); }
    for (let j = 0; j < p.h; j++) { out.push(`${x0 - 1},${y0 + j}`, `${x0 + p.w},${y0 + j}`); }
    return out;
  };
  const raggiungibili = (soloDue: boolean) => {
    const visti = new Set<string>(), coda: string[] = [];
    for (const p of pezzi) if (p.voce.type === "main_building")
      for (const c of vicini(p)) { const l = strada.get(c); if (l && (!soloDue || l === 2) && !visti.has(c)) { visti.add(c); coda.push(c); } }
    while (coda.length) {
      const [x, y] = coda.pop()!.split(",").map(Number) as [number, number];
      for (const c of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
        const l = strada.get(c);
        if (l && (!soloDue || l === 2) && !visti.has(c)) { visti.add(c); coda.push(c); }
      }
    }
    return visti;
  };
  const r1 = raggiungibili(false), r2 = raggiungibili(true);
  const CityMapData: Record<string, CityMapEntry> = {};
  const playerId = num((d.player as { id?: unknown } | undefined)?.id);
  for (const p of pezzi) {
    if (p.voce.type !== "street" && p.voce.type !== "main_building") {
      const v = vicini(p);
      p.voce.connected = v.some(c => r2.has(c)) ? 2 : v.some(c => r1.has(c)) ? 1 : 0;
    }
    // il player_id serve a riconoscere la città a un nuovo import (citta.ts)
    if (playerId !== undefined) p.voce.player_id = playerId;
    CityMapData[p.key] = p.voce;
  }

  const nome = typeof (d.player as { name?: unknown } | undefined)?.name === "string" ? String((d.player as { name: string }).name).trim() || null : null;
  const data: BookmarkletData = {
    _v: CURRENT_BOOKMARKLET_VERSION, activeMap: "OtherPlayer",
    inventory: [], allies: {}, CityMapData, CityEntities, UnlockedAreas: aree,
    ...(nome ? { playerName: nome } : {}),
  };
  return { data, ignorati, nome };
}
