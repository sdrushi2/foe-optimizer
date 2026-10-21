// ─────────────────────────────────────────────────────────────────────────────
//  planner/editorPonte.ts — Ritorno dall'editor esterno (public/editor.html)
//
//  La città modificata nell'editor torna al Planner nel formato dell'export
//  JSON (CityMapData / CityEntities / UnlockedAreas). Qui si ricostruisce la
//  disposizione del Planner (placements + celle di strada) e si controlla:
//   - edifici riconosciuti tramite idMap (id del JSON → id della città); copie
//     o edifici nuovi rifiutati (il Planner usa solo gli edifici della città);
//   - catene: un blocco torna solo se tutti i suoi pezzi sono rimasti insieme
//     nella stessa forma (oppure tutti tolti);
//   - municipio presente; tutto dentro l'area sbloccata; niente sovrapposizioni;
//   - completamento in pausa (soloSenzaStrada): strade e municipio fermi;
//     edifici con strada spostabili/scambiabili se restano attaccati a una strada.
// ─────────────────────────────────────────────────────────────────────────────

import { leggiCittaDati, type CittaJson } from "../data/cityMapJson";
import { toccaStradaZona, type PlannerFrame, type PlannerProblem } from "./engine";
import type { Blocco } from "./catene";
import { t, type UiLang } from "../data/ui-strings";

export interface RitornoEditor {
  errori: string[];
  placements: Map<string, { x: number; y: number }>;
  roads: Set<string>;
  /** Strade a due corsie: blocchi 2×2 (angolo in alto a sinistra). */
  blocchi: string[];
}

export function cittaDaEditor(dati: unknown, { problem, blocchi, idMap, frame, soloSenzaStrada, lang = "it" }: {
  problem: PlannerProblem; blocchi: ReadonlyMap<string, Blocco>; idMap: ReadonlyMap<string, string>;
  frame: PlannerFrame; soloSenzaStrada: boolean; lang?: UiLang;
}): RitornoEditor {
  let citta: CittaJson;
  try { citta = leggiCittaDati(dati); } catch (err) { return { errori: [t("plannerErrInvalidData", lang, err instanceof Error ? err.message : String(err))], placements: new Map(), roads: new Set(), blocchi: [] }; }
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  const errori: string[] = [];
  const pos = new Map<string, { x: number; y: number }>();
  const roads = new Set<string>();
  const blocchi2: string[] = [];
  const sovrapposte = new Set<string>();
  for (const b of citta.buildings) {
    if (b.type === "street") {
      if (b.w === 2 && b.h === 2) blocchi2.push(`${b.x},${b.y}`);
      for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) {
        const k = `${b.x + i},${b.y + j}`;
        if (roads.has(k)) sovrapposte.add(t("plannerErrRoad", lang)); else roads.add(k);
      }
      continue;
    }
    const mid = idMap.get(b.mapEntityId);
    if (!mid || mid.startsWith("planner-road") || pos.has(mid)) errori.push(t("plannerErrNewBuilding", lang, b.name));
    else pos.set(mid, { x: b.x, y: b.y });
  }
  // edifici del Planner: i blocchi di catena tornano interi solo se i pezzi sono rimasti insieme
  const pl = new Map<string, { x: number; y: number }>();
  for (const b of problem.buildings) {
    const bl = blocchi.get(b.id);
    if (!bl) {
      const p = pos.get(b.id);
      if (p) pl.set(b.id, p);
      else if (b.isTownhall) errori.push(t("plannerErrTownHallRemoved", lang));
      continue;
    }
    const pezzi = bl.membri.map(m => ({ m, p: pos.get(m.id) }));
    const presenti = pezzi.filter(q => q.p);
    if (!presenti.length) continue;
    const x0 = presenti[0]!.p!.x - presenti[0]!.m.dx, y0 = presenti[0]!.p!.y - presenti[0]!.m.dy;
    if (presenti.length < pezzi.length || presenti.some(q => q.p!.x - q.m.dx !== x0 || q.p!.y - q.m.dy !== y0)) {
      errori.push(t("plannerErrChainBroken", lang, b.name));
      continue;
    }
    pl.set(b.id, { x: x0, y: y0 });
  }
  // dentro l'area sbloccata e senza sovrapposizioni
  const occ = new Map<string, string>();
  const fuori = new Set<string>();
  for (const [id, p] of pl) {
    const b = byId.get(id)!;
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) {
      const k = `${p.x + i},${p.y + j}`;
      if (!problem.cells.has(k)) fuori.add(b.name);
      else if (roads.has(k)) sovrapposte.add(b.name);
      const o = occ.get(k);
      if (o !== undefined && o !== id) { sovrapposte.add(b.name); sovrapposte.add(byId.get(o)!.name); } else occ.set(k, id);
    }
  }
  for (const k of roads) if (!problem.cells.has(k)) fuori.add(t("plannerErrRoad", lang));
  const elenco = (s: Set<string>) => [...s].slice(0, 5).join(", ") + (s.size > 5 ? t("plannerErrOthers", lang, s.size - 5) : "");
  if (fuori.size) errori.push(t("plannerErrOutside", lang, elenco(fuori)));
  if (sovrapposte.size) errori.push(t("plannerErrOverlap", lang, elenco(sovrapposte)));
  // Completamento in pausa: strade ferme; gli edifici con strada si possono
  // spostare o scambiare (richiesta dell'utente: invertire due edifici con
  // strada è lecito) purché restino tutti, ognuno attaccato a una strada, e il
  // municipio resti dov'è; quelli senza strada si muovono liberamente.
  if (soloSenzaStrada) {
    const stesse = roads.size === frame.roads.size && [...roads].every(r => frame.roads.has(r));
    if (!stesse) errori.push(t("plannerErrFillRoads", lang));
    const strada = (x: number, y: number) => roads.has(`${x},${y}`);
    const staccati: string[] = [];
    let mancano = false, municipio = true;
    for (const b of problem.buildings) {
      if (!b.isTownhall && b.roadLevel <= 0) continue;
      const a = frame.placements.get(b.id), c = pl.get(b.id);
      if (b.isTownhall) { if (!a || !c || a.x !== c.x || a.y !== c.y) municipio = false; continue; }
      if (!!a !== !!c) { mancano = true; continue; }
      if (c && (!a || a.x !== c.x || a.y !== c.y) && !toccaStradaZona(b, c.x, c.y, strada)) staccati.push(b.name);
    }
    if (!municipio) errori.push(t("plannerErrFillTownHall", lang));
    if (mancano) errori.push(t("plannerErrFillMissing", lang));
    if (staccati.length) errori.push(t("plannerErrDetached", lang, elenco(new Set(staccati))));
  }
  return { errori, placements: pl, roads, blocchi: blocchi2 };
}
