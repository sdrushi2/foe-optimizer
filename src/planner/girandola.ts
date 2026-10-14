// ─────────────────────────────────────────────────────────────────────────────
//  planner/girandola.ts — Scenario "Girandola" (idea dell'utente)
//
//  Alternativa alla base del builder (fase 1: municipio + verticale +
//  raccordo): il municipio con quattro bracci di strada a girandola, ognuno
//  attaccato a un lato del municipio verso un angolo e diretto in senso
//  rotatorio (come la città dell'utente, 70 strade contro le 75 dello
//  scenario standard):
//    N: colonna destra del municipio, verso l'alto
//    W: riga alta, verso sinistra
//    E: riga bassa, verso destra
//    S: colonna sinistra, verso il basso
//  I bracci partono lunghi fino al bordo: è la ricerca (completion.ts,
//  opzione `girandola`) a tagliarne la punta (Params.tagli) e a riempirne i
//  lati a incastro (Params.latiEsatti). Un braccio può ridursi a 0 o a una
//  cella (fine strada d'angolo con tre edifici).
//  La posizione del municipio si sceglie valutando in fretta alcune
//  posizioni attorno al centro della mappa, spostate soprattutto verso
//  sinistra (preferenza dell'utente: la mappa è più comoda da consultare).
// ─────────────────────────────────────────────────────────────────────────────

import type { PlannerFrame, PlannerProblem } from "./engine";
import { runCompletion } from "./completion";

const key = (x: number, y: number) => `${x},${y}`;

export interface BaseGirandola {
  tx: number; ty: number;
  placements: Map<string, { x: number; y: number }>;
  roads: Set<string>;
  /** Celle di ciascun braccio (N, W, E, S) dal municipio verso l'esterno. */
  bracci: string[][];
  /** Per il motore: "verticale" = braccio N, riga di riferimento = braccio E. */
  geometry: { stradaVX: number; eastMidY: number };
}

/** Municipio in (tx, ty) e i quattro bracci lunghi fino al bordo. null se il municipio non entra.
 *  @public (usata anche dal banco di prova: gir4.ts, girp.ts) */
export function baseGirandola(problem: PlannerProblem, tx: number, ty: number): BaseGirandola | null {
  const th = problem.buildings.find(b => b.isTownhall);
  if (!th) return null;
  for (let i = 0; i < th.w; i++) for (let j = 0; j < th.h; j++) if (!problem.cells.has(key(tx + i, ty + j))) return null;
  const partenze: Array<[number, number, number, number]> = [
    [tx + th.w - 1, ty - 1, 0, -1], // N
    [tx - 1, ty, -1, 0],            // W
    [tx + th.w, ty + th.h - 1, 1, 0], // E
    [tx, ty + th.h, 0, 1],          // S
  ];
  const bracci = partenze.map(([x0, y0, dx, dy]) => {
    const out: string[] = [];
    for (let x = x0, y = y0; problem.cells.has(key(x, y)); x += dx, y += dy) out.push(key(x, y));
    return out;
  });
  if (bracci.every(b => !b.length)) return null;
  return {
    tx, ty,
    placements: new Map([[th.id, { x: tx, y: ty }]]),
    roads: new Set(bracci.flat()),
    bracci,
    geometry: { stradaVX: tx + th.w - 1, eastMidY: ty + th.h - 1 },
  };
}

/** Sceglie la posizione del municipio: alcune posizioni attorno al centro
 *  (soprattutto verso sinistra), ognuna valutata con una breve ricerca
 *  (`valutazioni` disposizioni); vince quella con meno edifici con strada
 *  fuori, poi meno deficit di spazio, poi meno strade, poi più a sinistra;
 *  le 3 migliori sono rivalutate con una ricerca più lunga; vince la prima
 *  (in quell'ordine) il cui completamento piazza tutti gli edifici. */
export async function scegliGirandola(problem: PlannerProblem, opts: {
  shouldStop: () => boolean; valutazioni?: number; onProgress?: (i: number, n: number) => void;
  /** Disposizioni provvisorie durante le prove (per mostrare subito qualcosa):
   *  la base appena scelta e i passi della sua breve ricerca. */
  onFrame?: (f: PlannerFrame) => void;
}): Promise<BaseGirandola | null> {
  const th = problem.buildings.find(b => b.isTownhall);
  if (!th) return null;
  const cx = Math.round((problem.minX + problem.maxX + 1 - th.w) / 2), cy = Math.round((problem.minY + problem.maxY + 1 - th.h) / 2);
  const W = problem.maxX - problem.minX + 1;
  const passo = Math.max(2, Math.round(W / 24));
  // dal centro verso sinistra (fino a metà della metà sinistra), qualche riga su e giù
  const candidati: Array<[number, number]> = [];
  for (let k = 0; k <= 6; k++) for (const dy of [0, -2, 2, -4]) candidati.push([cx - k * passo, cy + dy]);
  const valuta = async (base: BaseGirandola, n: number) => {
    let valutate = 0;
    opts.onFrame?.({ placements: base.placements, roads: base.roads, probe: null, lastPath: [], placed: base.placements.size, unplaced: [], iterations: 0, done: false });
    const fr = await runCompletion(problem, {
      delayMs: 0, shouldStop: opts.shouldStop,
      onFrame: f => { if (f.search) valutate = f.search.valutate; opts.onFrame?.(f); },
      shouldFinishSearch: () => valutate >= n,
      initial: { placements: base.placements, roads: base.roads }, geometry: base.geometry, fissi: [],
      girandola: { bracci: base.bracci }, soloRicerca: true,
    });
    return { fuori: fr.search?.esclusi ?? 99, deficit: fr.search?.deficit ?? 0, strade: fr.roads.size };
  };
  /** Ricerca breve + completamento (riempimento): edifici rimasti fuori. */
  const completa = async (base: BaseGirandola, n: number) => {
    let valutate = 0, finita = false;
    const fr = await runCompletion(problem, {
      delayMs: 0, shouldStop: opts.shouldStop,
      // si mostra solo la ricerca: il riempimento di prova è fuorviante (utente)
      onFrame: f => { if (f.search) valutate = f.search.valutate; if (!finita) opts.onFrame?.(f); },
      shouldFinishSearch: () => (finita ||= valutate >= n),
      initial: { placements: base.placements, roads: base.roads }, geometry: base.geometry, fissi: [],
      girandola: { bracci: base.bracci },
    });
    return fr.unplaced.length;
  };
  type Voto = { base: BaseGirandola; fuori: number; deficit: number; strade: number };
  // a parità vince la più a sinistra (preferenza dell'utente)
  // (il deficit di spazio per gli edifici senza strada conta prima delle strade, come nella ricerca)
  const meglio = (a: Voto, b: Voto) => a.fuori - b.fuori || a.deficit - b.deficit || a.strade - b.strade || a.base.tx - b.base.tx;
  const n = opts.valutazioni ?? 200;
  const voti: Voto[] = [];
  for (const [i, [tx, ty]] of candidati.entries()) {
    if (opts.shouldStop()) break;
    opts.onProgress?.(i, candidati.length + 6);
    const base = baseGirandola(problem, tx, ty);
    if (!base) continue;
    voti.push({ base, ...(await valuta(base, n)) });
  }
  // le 3 migliori rivalutate con una ricerca 4 volte più lunga
  const finali: Voto[] = [];
  for (const [i, v] of voti.sort(meglio).slice(0, 3).entries()) {
    if (opts.shouldStop()) break;
    opts.onProgress?.(candidati.length + i, candidati.length + 6);
    finali.push({ base: v.base, ...(await valuta(v.base, 4 * n)) });
  }
  // Prova del riempimento (Rode: a parità di strade una posizione lasciava
  // fuori edifici senza strada): nell'ordine, la prima finalista il cui
  // completamento piazza tutti gli edifici; altrimenti quella che ne lascia
  // fuori meno.
  finali.sort(meglio);
  let scelta: BaseGirandola | null = null, minFuori = Infinity;
  for (const [i, v] of finali.entries()) {
    if (opts.shouldStop()) break;
    opts.onProgress?.(candidati.length + 3 + i, candidati.length + 6);
    const fuori = await completa(v.base, 4 * n);
    if (fuori < minFuori) { minFuori = fuori; scelta = v.base; }
    if (fuori === 0) break;
  }
  return scelta ?? finali[0]?.base ?? voti[0]?.base ?? null;
}
