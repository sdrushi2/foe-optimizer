// ─────────────────────────────────────────────────────────────────────────────
//  planner/roadEff.ts — Efficienza stradale degli edifici (idea dell'utente)
//
//  Per ogni edificio con strada: road_eff = celle di strada che toccano il suo
//  perimetro − min(larghezza, altezza). Un edificio dovrebbe toccare la strada
//  col lato corto: 6×4 su una strada verticale = 4 celle → 0. Attaccato col
//  lato lungo: +2. Un 6×6 su una sola cella di fine strada: −5. Un 4×4
//  nell'angolo di un incrocio: 8 − 4 = +4. Gli edifici con road_eff > 0
//  "sprecano" strada: la ricerca minimizza il loro numero (num_road_eff_pos)
//  e, a parità, la loro somma (sum_road_eff_pos). Non può essere zero (agli
//  incroci c'è sempre qualcosa), ma meglio metterci pezzi piccoli.
//  Eccezione (regola dell'utente): i GRANDI (lato corto >= 5) attaccati a 2
//  o più celle di strada sono problematici (road_eff = celle − 1): il loro
//  posto è un fine strada con una sola cella.
// ─────────────────────────────────────────────────────────────────────────────

import { perimetroCoda, type PlannerBuilding } from "./engine";

/** Edificio "grande" (regola dell'utente): entrambi i lati >= 5. */
export const LATO_GRANDE = 5;

/** Mostra in ogni mappa del Planner l'elenco degli edifici con road_eff > 0,
 *  num_road_eff_pos e sum_road_eff_pos. */
export const DEBUG_PLANNER = false;

/** Edifici piccoli negli angoli (regola dell'utente): gli 1×1 non contano mai
 *  e i 2×2 non contano quando stanno nell'angolo di un incrocio (toccano una
 *  strada su un lato nord/sud E su un lato est/ovest): lì sono già ottimi,
 *  anzi è proprio negli angoli che vanno messi. */
export const piccoloDaAngolo = (b: { w: number; h: number }) => (b.w === 1 && b.h === 1) || (b.w === 2 && b.h === 2);
export function esclusoDaRoadEff(b: { w: number; h: number }, x: number, y: number, isRoad: (x: number, y: number) => boolean): boolean {
  if (b.w === 1 && b.h === 1) return true;
  if (b.w !== 2 || b.h !== 2) return false;
  let ns = false, eo = false;
  for (let d = 0; d < 2; d++) {
    if (isRoad(x + d, y - 1) || isRoad(x + d, y + 2)) ns = true;
    if (isRoad(x - 1, y + d) || isRoad(x + 2, y + d)) eo = true;
  }
  return ns && eo;
}

/** road_eff di un edificio in (x, y): celle di strada toccate − connessione
 *  "necessaria". La necessaria è il lato corto min(w, h) (regola dell'utente)
 *  ma, se l'edificio tocca strade su PIÙ lati, non più della connessione più
 *  piccola fra quei lati: basta quella, il resto è strada sprecata. Esempio
 *  (Beta r3): un 6×6 fine strada collegato da 1 cella della verticale e con
 *  la dorsale lungo tutto il lato nord: 7 − 1 = +6 (prima 7 − 6 = +1). */
export function roadEffDi(x: number, y: number, w: number, h: number, isRoad: (x: number, y: number) => boolean): { strade: number; eff: number } {
  let n = 0, s = 0, o = 0, e = 0;
  for (let dx = 0; dx < w; dx++) { if (isRoad(x + dx, y - 1)) n++; if (isRoad(x + dx, y + h)) s++; }
  for (let dy = 0; dy < h; dy++) { if (isRoad(x - 1, y + dy)) o++; if (isRoad(x + w, y + dy)) e++; }
  const strade = n + s + o + e;
  const corto = w < h ? w : h;
  // Grandi (lato corto >= 5, regola dell'utente): vanno ai fini strada con UNA
  // sola cella; attaccati a 2 o più celle sono "problematici": road_eff =
  // celle − 1 (un 6×6 lungo la verticale, 6 celle, vale +5).
  if (corto >= LATO_GRANDE) return { strade, eff: strade >= 2 ? strade - 1 : 0 };
  // (senza array: è nel ciclo caldo della ricerca)
  let k = 0, minLato = corto;
  if (n > 0) { k++; if (n < minLato) minLato = n; }
  if (s > 0) { k++; if (s < minLato) minLato = s; }
  if (o > 0) { k++; if (o < minLato) minLato = o; }
  if (e > 0) { k++; if (e < minLato) minLato = e; }
  return { strade, eff: strade - (k >= 2 ? minLato : corto) };
}

interface RoadEffVoce { id: string; name: string; w: number; h: number; strade: number; eff: number }
export interface RoadEffRiepilogo { voci: RoadEffVoce[]; num: number; sum: number; quad: number }

/** road_eff di tutti gli edifici con strada (municipio escluso) di una disposizione. */
export function calcolaRoadEff(
  buildings: readonly PlannerBuilding[],
  placements: ReadonlyMap<string, { x: number; y: number }>,
  roads: ReadonlySet<string>,
): RoadEffRiepilogo {
  const isRoad = (x: number, y: number) => roads.has(`${x},${y}`);
  const voci: RoadEffVoce[] = [];
  let num = 0, sum = 0, quad = 0;
  for (const b of buildings) {
    if (b.isTownhall || b.roadLevel <= 0) continue;
    const q = placements.get(b.id);
    if (!q || esclusoDaRoadEff(b, q.x, q.y, isRoad)) continue;
    const { strade, eff } = roadEffDi(q.x, q.y, b.w, b.h, isRoad);
    if (eff > 0) { num++; sum += eff; quad += eff * eff; voci.push({ id: b.id, name: b.name, w: b.w, h: b.h, strade, eff }); }
  }
  voci.sort((a, b) => b.eff - a.eff || a.name.localeCompare(b.name));
  return { voci, num, sum, quad };
}

/** strade_vuote (idea dell'utente): celle di strada con almeno un lato
 *  (nord/sud/est/ovest) su una cella sbloccata LIBERA, né edificio né strada.
 *  Sono strade sprecate: il riempimento le minimizza. */
export function calcolaStradeVuote(
  buildings: readonly PlannerBuilding[],
  placements: ReadonlyMap<string, { x: number; y: number }>,
  roads: ReadonlySet<string>,
  cells: ReadonlySet<string>,
): string[] {
  const byId = new Map(buildings.map(b => [b.id, b]));
  const occ = new Set<string>(roads);
  for (const [id, q] of placements) {
    const b = byId.get(id);
    if (b) for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) occ.add(`${q.x + dx},${q.y + dy}`);
  }
  const vuote: string[] = [];
  for (const r of roads) {
    const c = r.indexOf(","), x = Number(r.slice(0, c)), y = Number(r.slice(c + 1));
    for (const n of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
      if (cells.has(n) && !occ.has(n)) { vuote.push(r); break; }
    }
  }
  // Strade accanto agli anelli di una catena (che non richiedono strada):
  // sprecate come quelle su una cella libera (segnalazione dell'utente).
  const gia = new Set(vuote);
  for (const [id, q] of placements) {
    const b = byId.get(id);
    if (!b?.zonaStrada) continue;
    for (const [cx, cy] of perimetroCoda(b, q.x, q.y)) { const k = `${cx},${cy}`; if (roads.has(k) && !gia.has(k)) { gia.add(k); vuote.push(k); } }
  }
  return vuote;
}

const grande = (b: { w: number; h: number }) => b.w >= LATO_GRANDE && b.h >= LATO_GRANDE;

/** fini_strada_errati (regola dell'utente: "i grandi sono i fine strada").
 *  Un fine strada è un edificio collegato da un solo lato con meno celle di
 *  strada del suo lato corto (tipicamente 1: capolinea di una dorsale o della
 *  verticale). È un errore quando un fine strada è un edificio medio (non
 *  grande, lato corto 2-4) mentre un grande tocca 2 o più celle di strada:
 *  scambiandoli il grande non consuma strada. Valore = min(grandi non fine
 *  strada, medi fine strada). Contano solo gli edifici per cui `conta` è vero
 *  (il Planner esclude i fissi e la parte a ovest della verticale). */
export function contaFiniStradaErrati(
  voci: Iterable<{ b: { w: number; h: number; roadLevel: number; isTownhall?: boolean }; x: number; y: number }>,
  isRoad: (x: number, y: number) => boolean,
): number {
  let grandiLungo = 0, mediCap = 0;
  for (const { b, x, y } of voci) {
    if (b.isTownhall || b.roadLevel <= 0) continue;
    const g = grande(b);
    if (!g && Math.min(b.w, b.h) < 2) continue;
    let n = 0, s = 0, o = 0, e = 0;
    for (let dx = 0; dx < b.w; dx++) { if (isRoad(x + dx, y - 1)) n++; if (isRoad(x + dx, y + b.h)) s++; }
    for (let dy = 0; dy < b.h; dy++) { if (isRoad(x - 1, y + dy)) o++; if (isRoad(x + b.w, y + dy)) e++; }
    const lati = (n > 0 ? 1 : 0) + (s > 0 ? 1 : 0) + (o > 0 ? 1 : 0) + (e > 0 ? 1 : 0);
    if (!lati) continue;
    const cap = lati === 1 && n + s + o + e < Math.min(b.w, b.h);
    if (g && n + s + o + e >= 2) grandiLungo++;
    else if (!g && cap) mediCap++;
  }
  return Math.min(grandiLungo, mediCap);
}

/** Angoli di 90° del contorno della "massa" della città (edifici + strade)
 *  (idea dell'utente: meno angoli → più facile incastrare i pezzi piccoli nel
 *  riempimento finale). Si guarda ogni incrocio della griglia: con 1 o 3 delle
 *  4 celle attorno occupate c'è un angolo (sporgente o rientrante), con 2
 *  occupate in diagonale due. Non contano gli angoli contro il bordo della
 *  mappa: se una delle celle libere attorno all'incrocio è bloccata, lì non
 *  c'è niente da riempire. Griglie: indice j * W + i, 1 = occupata/sbloccata. */
export function contaAngoliGriglia(occ: ArrayLike<number>, cell: ArrayLike<number>, W: number, H: number): number {
  // Versione senza closure (ciclo caldo): per ogni incrocio (i, j) le 4 celle
  // attorno; fuori griglia = libera e bloccata.
  let n = 0;
  for (let j = 0; j <= H; j++) {
    const su = j - 1, giu = j;
    const suOk = su >= 0, giuOk = giu < H;
    for (let i = 0; i <= W; i++) {
      const sx = i - 1, dx = i;
      const sxOk = sx >= 0, dxOk = dx < W;
      const ga = suOk && sxOk ? su * W + sx : -1, gb = suOk && dxOk ? su * W + dx : -1;
      const gc = giuOk && sxOk ? giu * W + sx : -1, gd = giuOk && dxOk ? giu * W + dx : -1;
      const a = ga >= 0 && occ[ga] === 1, b = gb >= 0 && occ[gb] === 1, c = gc >= 0 && occ[gc] === 1, d = gd >= 0 && occ[gd] === 1;
      const k = (a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0) + (d ? 1 : 0);
      if (k === 0 || k === 4) continue;
      // una cella libera bloccata (o fuori mappa) attorno all'incrocio: bordo della mappa
      if ((!a && (ga < 0 || cell[ga] !== 1)) || (!b && (gb < 0 || cell[gb] !== 1)) || (!c && (gc < 0 || cell[gc] !== 1)) || (!d && (gd < 0 || cell[gd] !== 1))) continue;
      if (k === 2) { if (a === d) n += 2; } // diagonale: due angoli; affiancate: lato dritto
      else n++;
    }
  }
  return n;
}

/** contaAngoliGriglia su una disposizione (edifici piazzati + strade). */
export function contaAngoli(
  problem: { cells: ReadonlySet<string>; minX: number; minY: number; maxX: number; maxY: number; buildings: readonly PlannerBuilding[] },
  placements: ReadonlyMap<string, { x: number; y: number }>,
  roads: ReadonlySet<string>,
): number {
  const W = problem.maxX - problem.minX + 1, H = problem.maxY - problem.minY + 1;
  const occ = new Uint8Array(W * H), cell = new Uint8Array(W * H);
  const set = (g: Uint8Array, x: number, y: number) => { const i = x - problem.minX, j = y - problem.minY; if (i >= 0 && j >= 0 && i < W && j < H) g[j * W + i] = 1; };
  for (const k of problem.cells) { const c = k.indexOf(","); set(cell, Number(k.slice(0, c)), Number(k.slice(c + 1))); }
  for (const k of roads) { const c = k.indexOf(","); set(occ, Number(k.slice(0, c)), Number(k.slice(c + 1))); }
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  for (const [id, q] of placements) { const b = byId.get(id); if (b) for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) set(occ, q.x + dx, q.y + dy); }
  return contaAngoliGriglia(occ, cell, W, H);
}
