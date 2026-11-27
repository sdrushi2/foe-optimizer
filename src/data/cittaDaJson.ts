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
//  27/11/2026: il file lo legge `leggiCitta` (data/cityMapJson.ts), lo stesso
//  lettore del Planner: la città è la disposizione del file (CityMapData, poi
//  mapBuildings…), cityData arricchisce solo le copie (livello e bonus dei GE).
//  Prima qui si prendeva cityData per primo: con l'export di uno scenario del
//  Planner si salvava la città com'è nel gioco invece dello scenario.
// ─────────────────────────────────────────────────────────────────────────────

import type { BookmarkletData, CityEntityDefinition, CityMapEntry } from "./bookmarklet";
import { CURRENT_BOOKMARKLET_VERSION } from "./bookmarklet";
import { AGE_BY_CODE } from "./ages";
import { ErroreJsonCitta, leggiCitta } from "./cityMapJson";
import { isGreatBuildingId } from "./buildingClassification";

type Entita = CityEntityDefinition & { id: string; name?: string; type?: string; width?: number; length?: number };

export interface CittaDaJson {
  data: BookmarkletData;
  /** Pezzi saltati: dimensioni sconosciute (né nel file né nel catalogo). */
  ignorati: string[];
  /** Nome del giocatore (se il file lo ha). */
  nome: string | null;
}

export function cittaDaJson(testo: string): CittaDaJson {
  let dati: unknown;
  try { dati = JSON.parse(testo); } catch { throw new ErroreJsonCitta("json"); }
  const l = leggiCitta(dati);

  // 1) voci del payload: una per pezzo, con l'era della copia come `level` (id dell'era)
  type Pezzo = { key: string; voce: CityMapEntry; w: number; h: number };
  const pezzi: Pezzo[] = [];
  const CityEntities: Record<string, Entita> = {};
  for (const p of l.pezzi) {
    if (!CityEntities[p.entityId]) CityEntities[p.entityId] = { id: p.entityId, name: p.nome, type: p.type, width: p.w, length: p.h,
      ...(p.type !== "street" && p.lv > 0 ? { requirements: { street_connection_level: p.lv } } : {}) };
    const gb = isGreatBuildingId(p.entityId);
    const era = p.era ?? l.currentEra;
    const idEra = era ? AGE_BY_CODE.get(era)?.id : undefined;
    const { era: _era, state: _s, next_state_transition_at: _a, next_state_transition_in: _i, connected: _c, player_id: _p, ...resto } = p.voce;
    const voce: CityMapEntry = {
      ...resto, id: Number(p.key) || p.key, cityentity_id: p.entityId, type: p.type, x: p.x, y: p.y,
      ...(gb ? {} : idEra !== undefined ? { level: idEra } : {}),
    };
    pezzi.push({ key: p.key, voce, w: p.w, h: p.h });
  }

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
  const playerId = l.giocatore?.id ?? undefined;
  for (const p of pezzi) {
    if (p.voce.type !== "street" && p.voce.type !== "main_building") {
      const v = vicini(p);
      p.voce.connected = v.some(c => r2.has(c)) ? 2 : v.some(c => r1.has(c)) ? 1 : 0;
    }
    // il player_id serve a riconoscere la città a un nuovo import (citta.ts)
    if (playerId !== undefined) p.voce.player_id = playerId;
    CityMapData[p.key] = p.voce;
  }

  const nome = l.giocatore?.nome ?? null;
  const data: BookmarkletData = {
    _v: CURRENT_BOOKMARKLET_VERSION, activeMap: "OtherPlayer",
    inventory: [], allies: {}, CityMapData, CityEntities, UnlockedAreas: l.aree,
    ...(nome ? { playerName: nome } : {}),
    // avatar del file: importaPayload lo controlla (sanitizePortraitUrl) e lo mette alla città
    ...(l.avatar ? { portraitUrl: l.avatar } : {}),
  };
  return { data, ignorati: l.ignorati, nome };
}
