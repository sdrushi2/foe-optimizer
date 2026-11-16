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
//  Due versi: orario (Sdrushi) e speculare/antiorario (Dani), provati entrambi.
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
  /** Girandola speculare (verso antiorario, come la città di Dani). */
  specchio: boolean;
  placements: Map<string, { x: number; y: number }>;
  roads: Set<string>;
  /** Celle di ciascun braccio (N, W, E, S) dal municipio verso l'esterno. */
  bracci: string[][];
  /** Per il motore: "verticale" = braccio N, riga di riferimento = braccio E. */
  geometry: { stradaVX: number; eastMidY: number };
}

/** Municipio in (tx, ty) e i quattro bracci lunghi fino al bordo. null se il municipio non entra.
 *  @public (usata anche dal banco di prova: gir4.ts, girp.ts) */
export function baseGirandola(problem: PlannerProblem, tx: number, ty: number, specchio = false): BaseGirandola | null {
  const th = problem.buildings.find(b => b.isTownhall);
  if (!th) return null;
  for (let i = 0; i < th.w; i++) for (let j = 0; j < th.h; j++) if (!problem.cells.has(key(tx + i, ty + j))) return null;
  // Verso orario (Sdrushi) o speculare/antiorario (Dani: N dalla colonna
  // sinistra, W dalla riga bassa, E dalla riga alta, S dalla colonna destra).
  const partenze: Array<[number, number, number, number]> = specchio ? [
    [tx, ty - 1, 0, -1],                 // N
    [tx - 1, ty + th.h - 1, -1, 0],      // W
    [tx + th.w, ty, 1, 0],               // E
    [tx + th.w - 1, ty + th.h, 0, 1],    // S
  ] : [
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
    tx, ty, specchio,
    placements: new Map([[th.id, { x: tx, y: ty }]]),
    roads: new Set(bracci.flat()),
    bracci,
    geometry: specchio ? { stradaVX: tx, eastMidY: ty } : { stradaVX: tx + th.w - 1, eastMidY: ty + th.h - 1 },
  };
}

/** Municipio al centro della mappa, verso orario: la prima girandola parte
 *  subito da qui (banco: Sdrushi2 69, Dani 49, Rode 72 — le prove brevi
 *  della scelta non distinguono le posizioni, il centro è una buona base).
 *  null se il municipio non entra. */
export function baseCentrale(problem: PlannerProblem): BaseGirandola | null {
  const th = problem.buildings.find(b => b.isTownhall);
  if (!th) return null;
  const cx = Math.round((problem.minX + problem.maxX + 1 - th.w) / 2), cy = Math.round((problem.minY + problem.maxY + 1 - th.h) / 2);
  return baseGirandola(problem, cx, cy, false);
}

/** Posizioni del municipio da provare per la Girandola 2, ognuna nei due
 *  versi (orario e speculare). L'ordine conta: a parità di voto resta davanti
 *  la prova che viene prima. */
export function proveGirandola(problem: PlannerProblem): Array<[number, number, boolean]> {
  const th = problem.buildings.find(b => b.isTownhall);
  if (!th) return [];
  const cx = Math.round((problem.minX + problem.maxX + 1 - th.w) / 2), cy = Math.round((problem.minY + problem.maxY + 1 - th.h) / 2);
  const W = problem.maxX - problem.minX + 1;
  const passo = Math.max(2, Math.round(W / 24));
  // dal centro verso sinistra (fino a metà della metà sinistra) e un po' a destra, qualche riga su e giù
  const candidati: Array<[number, number]> = [];
  // (anche un po' a destra: la città di Dani ha il municipio a destra del centro)
  for (let k = -4; k <= 6; k++) for (const dy of [0, -3, 3]) candidati.push([cx - k * passo, cy + dy]);
  // anche la posizione attuale del municipio nella città importata
  if (!candidati.some(([x, y]) => x === th.origX && y === th.origY)) candidati.push([th.origX, th.origY]);
  // ogni posizione in tutti e due i versi (orario e speculare)
  return candidati.flatMap(([x, y]) => [[x, y, false], [x, y, true]] as Array<[number, number, boolean]>);
}

/** Voto di una posizione: edifici con strada fuori, deficit di spazio, strade. */
export interface VotoGirandola { fuori: number; deficit: number; strade: number }
interface OpzioniProve {
  shouldStop: () => boolean;
  /** Pausa del Planner (vedi CompletionOptions.attendiInPausa). */
  attendiInPausa?: () => boolean;
  /** Disposizioni provvisorie durante le prove (per mostrare subito qualcosa):
   *  la base appena scelta e i passi della sua breve ricerca. */
  onFrame?: (f: PlannerFrame) => void;
}

/** Valuta un gruppo di posizioni, una dopo l'altra, ognuna con una breve
 *  ricerca di `n` disposizioni esatte; null dove la base non esiste (municipio
 *  fuori dall'area) o dopo uno stop. Ogni valutazione è indipendente e
 *  deterministica: per questo le prove si possono dividere fra più worker
 *  (parallelo.ts) ottenendo gli stessi voti. */
export async function valutaGirandole(problem: PlannerProblem, prove: ReadonlyArray<readonly [number, number, boolean]>, n: number, opts: OpzioniProve): Promise<Array<VotoGirandola | null>> {
  const out: Array<VotoGirandola | null> = [];
  for (const [tx, ty, sp] of prove) {
    const base = opts.shouldStop() ? null : baseGirandola(problem, tx, ty, sp);
    if (!base) { out.push(null); continue; }
    opts.onFrame?.({ placements: base.placements, roads: base.roads, probe: null, lastPath: [], placed: base.placements.size, unplaced: [], iterations: 0, done: false });
    const fr = await runCompletion(problem, {
      delayMs: 0, shouldStop: opts.shouldStop,
      ...(opts.attendiInPausa ? { attendiInPausa: opts.attendiInPausa } : {}),
      onFrame: f => opts.onFrame?.(f),
      // deterministico: chiusa a n disposizioni esatte (non dai fotogrammi, che escono a tempo)
      limiteValutate: n,
      initial: { placements: base.placements, roads: base.roads }, geometry: base.geometry, fissi: [],
      girandola: { bracci: base.bracci }, soloRicerca: true,
    });
    out.push({ fuori: fr.search?.esclusi ?? 99, deficit: fr.search?.deficit ?? 0, strade: fr.roads.size });
  }
  return out;
}

type VotoBase = VotoGirandola & { base: BaseGirandola };
/** Posizioni con il loro voto (senza quelle non valutate), nell'ordine delle prove. */
function unisciVoti(problem: PlannerProblem, prove: ReadonlyArray<readonly [number, number, boolean]>, voti: ReadonlyArray<VotoGirandola | null>): VotoBase[] {
  const out: VotoBase[] = [];
  prove.forEach(([tx, ty, sp], i) => {
    const v = voti[i], base = v ? baseGirandola(problem, tx, ty, sp) : null;
    if (v && base) out.push({ base, ...v });
  });
  return out;
}
/** Dalla migliore alla peggiore (ordina sul posto). A parità (con prove brevi
 *  capita quasi sempre) vince la più vicina al centro (bracci lunghi in tutte
 *  le direzioni: Sdrushi2 fa 69 col municipio al centro), poi la più a
 *  sinistra. Il deficit di spazio per gli edifici senza strada conta prima
 *  delle strade, come nella ricerca. */
function ordinaVoti(problem: PlannerProblem, voti: VotoBase[]): VotoBase[] {
  const th = problem.buildings.find(b => b.isTownhall);
  if (!th) return voti;
  const cx = Math.round((problem.minX + problem.maxX + 1 - th.w) / 2), cy = Math.round((problem.minY + problem.maxY + 1 - th.h) / 2);
  const dc = (v: VotoBase) => Math.abs(v.base.tx - cx) + Math.abs(v.base.ty - cy);
  return voti.sort((a, b) => a.fuori - b.fuori || a.deficit - b.deficit || a.strade - b.strade || dc(a) - dc(b) || a.base.tx - b.base.tx);
}

/** Sceglie la posizione del municipio: alcune posizioni attorno al centro
 *  (soprattutto verso sinistra), ognuna valutata con una breve ricerca
 *  (`valutazioni` disposizioni); vince quella con meno edifici con strada
 *  fuori, poi meno deficit di spazio, poi meno strade, poi più a sinistra;
 *  le 3 migliori sono rivalutate con una ricerca 6 volte più lunga;
 *  restituisce le 2 migliori (due mappe girandola).
 *  `valuta` fa le valutazioni: scegliGirandola le fa qui, una dopo l'altra
 *  (valutaGirandole); parallelo.ts ne passa una che le divide fra più worker
 *  (17/11/2026: la scelta durava circa 30 s su un core solo). Stesso
 *  risultato in entrambi i casi. Questa funzione non tocca runCompletion:
 *  la pagina la può usare senza portarsi la ricerca nel suo bundle.
 *  (Niente prova del riempimento: conta solo la disposizione degli edifici con
 *  strada; il riempimento finale si ottimizzerà a parte — utente.) */
export async function scegliGirandolaCon(problem: PlannerProblem,
  valuta: (prove: ReadonlyArray<readonly [number, number, boolean]>, n: number) => Promise<Array<VotoGirandola | null>>,
  opts: { shouldStop: () => boolean; valutazioni?: number }): Promise<BaseGirandola[]> {
  const n = opts.valutazioni ?? 150;
  const prove = proveGirandola(problem);
  if (!prove.length) return [];
  const voti = ordinaVoti(problem, unisciVoti(problem, prove, await valuta(prove, n)));
  // le 3 migliori rivalutate con una ricerca 6 volte più lunga
  const primi: Array<[number, number, boolean]> = opts.shouldStop() ? [] : voti.slice(0, 3).map(v => [v.base.tx, v.base.ty, v.base.specchio]);
  const finali = primi.length ? unisciVoti(problem, primi, await valuta(primi, 6 * n)) : [];
  // Le due migliori (richiesta dell'utente: due girandole, ognuna con la sua ricerca lunga)
  const ord = finali.length ? ordinaVoti(problem, finali) : voti;
  return ord.slice(0, 2).map(v => v.base);
}

/** scegliGirandolaCon con le valutazioni fatte qui, una dopo l'altra (banco di prova). */
export function scegliGirandola(problem: PlannerProblem, opts: OpzioniProve & { valutazioni?: number }): Promise<BaseGirandola[]> {
  return scegliGirandolaCon(problem, (prove, n) => valutaGirandole(problem, prove, n, opts), opts);
}
