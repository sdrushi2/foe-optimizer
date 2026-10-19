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
//   - completamento in pausa (soloSenzaStrada): strade ed edifici con strada
//     fermi, come le vecchie modifiche a mano.
// ─────────────────────────────────────────────────────────────────────────────

import { leggiCittaDati, type CittaJson } from "../data/cityMapJson";
import type { PlannerFrame, PlannerProblem } from "./engine";
import type { Blocco } from "./catene";

export interface RitornoEditor {
  errori: string[];
  placements: Map<string, { x: number; y: number }>;
  roads: Set<string>;
}

export function cittaDaEditor(dati: unknown, { problem, blocchi, idMap, frame, soloSenzaStrada }: {
  problem: PlannerProblem; blocchi: ReadonlyMap<string, Blocco>; idMap: ReadonlyMap<string, string>;
  frame: PlannerFrame; soloSenzaStrada: boolean;
}): RitornoEditor {
  let citta: CittaJson;
  try { citta = leggiCittaDati(dati); } catch (err) { return { errori: [`Dati non validi: ${err instanceof Error ? err.message : String(err)}`], placements: new Map(), roads: new Set() }; }
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  const errori: string[] = [];
  const pos = new Map<string, { x: number; y: number }>();
  const roads = new Set<string>();
  const sovrapposte = new Set<string>();
  for (const b of citta.buildings) {
    if (b.type === "street") {
      for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) {
        const k = `${b.x + i},${b.y + j}`;
        if (roads.has(k)) sovrapposte.add("strada"); else roads.add(k);
      }
      continue;
    }
    const mid = idMap.get(b.mapEntityId);
    if (!mid || mid.startsWith("planner-road-") || pos.has(mid)) errori.push(`${b.name}: edificio nuovo o duplicato (il Planner usa solo gli edifici della città)`);
    else pos.set(mid, { x: b.x, y: b.y });
  }
  // edifici del Planner: i blocchi di catena tornano interi solo se i pezzi sono rimasti insieme
  const pl = new Map<string, { x: number; y: number }>();
  for (const b of problem.buildings) {
    const bl = blocchi.get(b.id);
    if (!bl) {
      const p = pos.get(b.id);
      if (p) pl.set(b.id, p);
      else if (b.isTownhall) errori.push("Il municipio non si può togliere.");
      continue;
    }
    const pezzi = bl.membri.map(m => ({ m, p: pos.get(m.id) }));
    const presenti = pezzi.filter(q => q.p);
    if (!presenti.length) continue;
    const x0 = presenti[0]!.p!.x - presenti[0]!.m.dx, y0 = presenti[0]!.p!.y - presenti[0]!.m.dy;
    if (presenti.length < pezzi.length || presenti.some(q => q.p!.x - q.m.dx !== x0 || q.p!.y - q.m.dy !== y0)) {
      errori.push(`${b.name}: catena spezzata, sposta o togli tutti i suoi pezzi insieme.`);
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
  for (const k of roads) if (!problem.cells.has(k)) fuori.add("strada");
  const elenco = (s: Set<string>) => [...s].slice(0, 5).join(", ") + (s.size > 5 ? ` e altri ${s.size - 5}` : "");
  if (fuori.size) errori.push(`Fuori dall'area sbloccata: ${elenco(fuori)}.`);
  if (sovrapposte.size) errori.push(`Sovrapposti: ${elenco(sovrapposte)}.`);
  // completamento in pausa: si muovono solo gli edifici senza strada (come prima)
  if (soloSenzaStrada) {
    const stesse = roads.size === frame.roads.size && [...roads].every(r => frame.roads.has(r));
    const fermi = problem.buildings.filter(b => b.isTownhall || b.roadLevel > 0).every(b => {
      const a = frame.placements.get(b.id), c = pl.get(b.id);
      return a && c ? a.x === c.x && a.y === c.y : !a && !c;
    });
    if (!stesse || !fermi) errori.push("Durante il completamento si possono spostare o togliere solo gli edifici senza strada: strade ed edifici con strada devono restare dove sono.");
  }
  return { errori, placements: pl, roads };
}
