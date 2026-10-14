// ─────────────────────────────────────────────────────────────────────────────
//  planner/builder/fase1.ts — Port TypeScript di foe-builder/fase1.py
//
//  Port FEDELE (ottobre 2026) della pipeline "triangolo" di FoE City Builder
//  (D:\FOE\foe-builder): passi 1-7 una volta, poi fork raccordo 3/4 con passi
//  8-9-10 + retry del Passo 9 + riepilogo/checkpoint (senza rendering).
//  Stessi criteri, stessi spareggi (ordinamenti stabili, primo massimo/minimo
//  come max()/min() di Python, ordine di itertools.combinations/permutations).
//  Validato con test differenziale sugli output Python di beta.json.
//
//  Differenze VOLUTE rispetto al Python (nessun effetto sui risultati):
//   - nessun rendering/log; il grafo N/S/E/O (strada_grafo) non è mantenuto:
//     le sue chiavi coincidono sempre con connected_road e serviva solo ai
//     validatori diagnostici;
//   - connected_road è un Set JS (ordine di inserimento) invece di un set
//     Python (ordine di hash): conta solo dove l'ordine fa da spareggio
//     (Counter.most_common a pari conteggio, prima cella-buco del retry);
//   - tetto di sicurezza alle combinazioni del Passo 3 (il Python non ne ha:
//     su città patologiche girerebbe per ore).
//  Ogni passo registra un'istantanea (trace) per l'animazione nel Planner.
// ─────────────────────────────────────────────────────────────────────────────

interface BuilderBuilding {
  id: string;
  cityentity_id: string;
  name: string;
  width: number;
  length: number;
  x?: number;
  y?: number;
  road_requirement?: number;
}
interface BuilderArea { x?: number; y?: number; width?: number; length?: number }
export interface BuilderInput { buildings: BuilderBuilding[]; unlocked_areas: BuilderArea[] }

type B = Required<Pick<BuilderBuilding, "id" | "cityentity_id" | "name" | "width" | "length" | "road_requirement">>;
type PlacedKind = "angolo" | "riempimento" | "blocco_muni" | "fine_strada" | "riempimento_rettangolo" | "colonna_ovest";
interface Placed { x: number; y: number; w: number; l: number; name: string; id: string; kind: PlacedKind }
interface TownHall { width: number; length: number; x: number; y: number }

export interface Snapshot {
  label: string;
  th: TownHall;
  placed: Placed[];
  roads: string[];
}

interface Riepilogo {
  n_edifici: number;
  n_celle_strada: number;
  isolate: number;
  zero_buchi: boolean;
  celle_buco_totali: number;
  celle_buco_coordinate: Array<[number, number]>;
  grandi_rimasti: number;
  piccoli_rimasti: number;
  piccolissimi_rimasti: number;
  medi_rimasti: number;
  salti_profilo_ovest: number;
  salti_profilo_ovest_utili: number;
}

type PoolEntry = Pick<B, "id" | "cityentity_id" | "name" | "width" | "length" | "road_requirement">;
interface CheckpointPlaced {
  id: string; cityentity_id: string; name: string;
  x: number; y: number; width: number; length: number;
  road_requirement: number; kind: string;
}
interface Checkpoint {
  buildings_placed: CheckpointPlaced[];
  town_hall: TownHall;
  connected_road: Array<{ x: number; y: number }>;
  buildings_remaining: PoolEntry[];
  pool_iniziale_con_strada: PoolEntry[];
  pool_iniziale_senza_strada: PoolEntry[];
  unlocked_areas: BuilderArea[];
  rect_nord_ids: string[];
  rect_sud_ids: string[];
}
interface VariantResult {
  riepilogo: Riepilogo;
  checkpoint: Checkpoint;
  trace: Snapshot[];
  /** Geometria finale (coordinate di gioco): colonna della strada verticale e
   *  riga del raccordo est del municipio (usate dal completamento del Planner). */
  geometry: { stradaVX: number; eastMidY: number };
}
export interface Fase1Result {
  r3: VariantResult; r4: VariantResult;
}

const MAX_CANDIDATI_RIEMPIMENTO_CENTRALE = 50;
const MAX_VALUTAZIONI_RIEMPIMENTO_CENTRALE = 200_000;
/** Tetto di sicurezza (assente nel Python) alle combinazioni enumerate dal Passo 3. */
const MAX_COMBINAZIONI_SICUREZZA = 20_000_000;
const DISTANZE_BORDO_VIETATE = new Set([1, 2, 3]);
const SOGLIA_GRANDE = 5;

const key = (x: number, y: number) => `${x},${y}`;
export const unkey = (k: string): [number, number] => {
  const i = k.indexOf(",");
  return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
};
const isGE = (b: { cityentity_id: string }) => b.cityentity_id.startsWith("X_");

// ── Griglia ──────────────────────────────────────────────────────────────────
interface Grid { cells: Uint8Array; x0: number; y0: number; W: number; H: number }

/** Stessa normalizzazione di run()/ricostruisci_griglia: x/y mancanti = 0, lati mancanti = 4. */
function buildGrid(areasRaw: readonly BuilderArea[]): Grid {
  const areas = areasRaw.map(a => ({ x: a.x || 0, y: a.y || 0, width: a.width || 4, length: a.length || 4 }));
  const x0 = Math.min(...areas.map(a => a.x));
  const y0 = Math.min(...areas.map(a => a.y));
  const x1 = Math.max(...areas.map(a => a.x + a.width));
  const y1 = Math.max(...areas.map(a => a.y + a.length));
  const W = x1 - x0, H = y1 - y0;
  const cells = new Uint8Array(W * H);
  for (const a of areas) {
    for (let yy = a.y - y0; yy < a.y - y0 + a.length; yy++)
      for (let xx = a.x - x0; xx < a.x - x0 + a.width; xx++)
        if (yy >= 0 && yy < H && xx >= 0 && xx < W) cells[yy * W + xx] = 1;
  }
  return { cells, x0, y0, W, H };
}

/** Tabelle O(1): distanza libera nelle 4 direzioni + summed-area table. */
class LandTables {
  readonly dE: Int32Array; readonly dW: Int32Array; readonly dS: Int32Array; readonly dN: Int32Array;
  readonly psum: Int32Array;
  constructor(readonly g: Grid) {
    const { W, H, cells } = g;
    this.dE = new Int32Array(W * H); this.dW = new Int32Array(W * H);
    this.dS = new Int32Array(W * H); this.dN = new Int32Array(W * H);
    for (let gy = 0; gy < H; gy++) {
      for (let gx = W - 1; gx >= 0; gx--) {
        const f = cells[gy * W + gx]!;
        this.dE[gy * W + gx] = f ? (gx + 1 < W ? 1 + this.dE[gy * W + gx + 1]! : 1) : 0;
      }
      for (let gx = 0; gx < W; gx++) {
        const f = cells[gy * W + gx]!;
        this.dW[gy * W + gx] = f ? (gx - 1 >= 0 ? 1 + this.dW[gy * W + gx - 1]! : 1) : 0;
      }
    }
    for (let gx = 0; gx < W; gx++) {
      for (let gy = H - 1; gy >= 0; gy--) {
        const f = cells[gy * W + gx]!;
        this.dS[gy * W + gx] = f ? (gy + 1 < H ? 1 + this.dS[(gy + 1) * W + gx]! : 1) : 0;
      }
      for (let gy = 0; gy < H; gy++) {
        const f = cells[gy * W + gx]!;
        this.dN[gy * W + gx] = f ? (gy - 1 >= 0 ? 1 + this.dN[(gy - 1) * W + gx]! : 1) : 0;
      }
    }
    this.psum = new Int32Array((W + 1) * (H + 1));
    for (let gy = 0; gy < H; gy++) {
      let acc = 0;
      for (let gx = 0; gx < W; gx++) {
        acc += cells[gy * W + gx]!;
        this.psum[(gy + 1) * (W + 1) + gx + 1] = this.psum[gy * (W + 1) + gx + 1]! + acc;
      }
    }
  }
  inLand(x: number, y: number): boolean {
    const gx = x - this.g.x0, gy = y - this.g.y0;
    return gx >= 0 && gx < this.g.W && gy >= 0 && gy < this.g.H && this.g.cells[gy * this.g.W + gx] === 1;
  }
  /** distanza_libera: solo direzioni cardinali (le uniche usate dal Python). */
  dist(x: number, y: number, dx: number, dy: number): number {
    const gx = x - this.g.x0, gy = y - this.g.y0;
    if (!(gx >= 0 && gx < this.g.W && gy >= 0 && gy < this.g.H)) return 0;
    const i = gy * this.g.W + gx;
    if (dx === 1) return this.dE[i]!;
    if (dx === -1) return this.dW[i]!;
    if (dy === 1) return this.dS[i]!;
    return this.dN[i]!;
  }
  rectInLand(x: number, y: number, w: number, l: number): boolean {
    const gx = x - this.g.x0, gy = y - this.g.y0;
    if (gx < 0 || gy < 0 || gx + w > this.g.W || gy + l > this.g.H) return false;
    const W1 = this.g.W + 1, p = this.psum;
    const area = p[(gy + l) * W1 + gx + w]! - p[gy * W1 + gx + w]! - p[(gy + l) * W1 + gx]! + p[gy * W1 + gx]!;
    return area === w * l;
  }
}

// ── Contesto ─────────────────────────────────────────────────────────────────
class Ctx {
  occupied: Uint8Array;
  placed: Placed[] = [];
  road = new Set<string>();
  trace: Snapshot[] = [];
  constructor(readonly g: Grid, readonly land: LandTables, public th: TownHall, readonly b1: B[]) {
    this.occupied = new Uint8Array(g.W * g.H);
  }
  clone(): Ctx {
    const c = new Ctx(this.g, this.land, { ...this.th }, this.b1);
    c.occupied = this.occupied.slice();
    c.placed = this.placed.map(p => ({ ...p }));
    c.road = new Set(this.road);
    c.trace = this.trace.slice();
    return c;
  }
  snap(label: string) {
    this.trace.push({ label, th: { ...this.th }, placed: this.placed.map(p => ({ ...p })), roads: [...this.road] });
  }
  inLand(x: number, y: number) { return this.land.inLand(x, y); }
  isFree(x: number, y: number) {
    return this.inLand(x, y) && this.occupied[(y - this.g.y0) * this.g.W + (x - this.g.x0)] === 0;
  }
  freeRect(x: number, y: number, w: number, l: number): boolean {
    const gx = x - this.g.x0, gy = y - this.g.y0;
    if (gx < 0 || gy < 0 || gx + w > this.g.W || gy + l > this.g.H) return false;
    for (let yy = gy; yy < gy + l; yy++)
      for (let xx = gx; xx < gx + w; xx++)
        if (this.g.cells[yy * this.g.W + xx] !== 1 || this.occupied[yy * this.g.W + xx] !== 0) return false;
    return true;
  }
  setRect(x: number, y: number, w: number, l: number, v: 0 | 1) {
    // Come lo slicing numpy: le parti fuori griglia sono ignorate (indici negativi
    // non si presentano mai nella pipeline).
    const gx = x - this.g.x0, gy = y - this.g.y0;
    for (let yy = Math.max(0, gy); yy < Math.min(this.g.H, gy + l); yy++)
      for (let xx = Math.max(0, gx); xx < Math.min(this.g.W, gx + w); xx++)
        this.occupied[yy * this.g.W + xx] = v;
  }
  mark(x: number, y: number, w: number, l: number) { this.setRect(x, y, w, l, 1); }
  unmark(x: number, y: number, w: number, l: number) { this.setRect(x, y, w, l, 0); }
  touchesMuni(x: number, y: number): boolean {
    const th = this.th;
    if (th.y - 1 <= y && y <= th.y + th.length && (x === th.x - 1 || x === th.x + th.width))
      return th.y - 1 < y && y < th.y + th.length;
    if (th.x - 1 <= x && x <= th.x + th.width && (y === th.y - 1 || y === th.y + th.length))
      return th.x - 1 < x && x < th.x + th.width;
    return false;
  }
  growCell(x: number, y: number): boolean {
    if (this.road.has(key(x, y))) return true;
    if (!this.isFree(x, y)) return false;
    const nb = [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)];
    if (this.touchesMuni(x, y) || nb.some(n => this.road.has(n))) {
      this.road.add(key(x, y));
      this.mark(x, y, 1, 1);
      return true;
    }
    return false;
  }
  growPath(cells: Array<[number, number]>): [Array<[number, number]>, boolean] {
    const added: Array<[number, number]> = [];
    for (const [x, y] of cells) {
      if (this.growCell(x, y)) added.push([x, y]);
      else return [added, false];
    }
    return [added, true];
  }
  place(b: { id: string; name: string }, x: number, y: number, w: number, l: number, kind: PlacedKind) {
    this.mark(x, y, w, l);
    this.placed.push({ x, y, w, l, name: b.name, id: b.id, kind });
  }
}

/** Primo massimo (come max() di Python con key a tupla). */
function firstMax<T>(arr: readonly T[], keyFn: (t: T) => number[]): T | null {
  let best: T | null = null, bestK: number[] | null = null;
  for (const t of arr) {
    const k = keyFn(t);
    if (bestK === null || cmpTuple(k, bestK) > 0) { best = t; bestK = k; }
  }
  return best;
}
function cmpTuple(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}
const sortedBy = <T>(arr: readonly T[], keyFn: (t: T) => number[]) => [...arr].sort((a, b) => cmpTuple(keyFn(a), keyFn(b)));

// ── Passo 1 ──────────────────────────────────────────────────────────────────
function passo1(ctx: Ctx, raccordoEstLen: number): [number, number] {
  const th = ctx.th;
  const northY = th.y - 1;
  ctx.growPath([[th.x, northY]]);
  const southY = th.y + th.length;
  ctx.growPath([[th.x, southY]]);
  const eastX = th.x + th.width;
  const eastMidY = th.y + Math.floor(th.length / 2);
  ctx.growPath(Array.from({ length: raccordoEstLen }, (_, i) => [eastX + i, eastMidY] as [number, number]));
  return [eastX, eastMidY];
}

// ── Passo 2 ──────────────────────────────────────────────────────────────────
function passo2(ctx: Ctx, northY: number, southY: number): { A: B; B: B; eastEdgeX: number } | null {
  const eastEdgeX = ctx.th.x;
  const big = sortedBy(ctx.b1, b => [-b.width * b.length, isGE(b) ? 0 : 1]);
  if (big.length < 2) return null;
  const A = big[0]!, Bb = big[1]!;
  const ax = eastEdgeX - A.width + 1, bx = eastEdgeX - Bb.width + 1;
  const ay = northY - A.length, by = southY + 1;
  const okA = ctx.freeRect(ax, ay, A.width, A.length);
  const okB = ctx.freeRect(bx, by, Bb.width, Bb.length);
  if (okA) ctx.place(A, ax, ay, A.width, A.length, "angolo");
  if (okB) ctx.place(Bb, bx, by, Bb.width, Bb.length, "angolo");
  return { A, B: Bb, eastEdgeX };
}

// ── Passo 3 ──────────────────────────────────────────────────────────────────
function* combinations<T>(items: readonly T[], r: number): Generator<T[]> {
  const n = items.length;
  if (r > n) return;
  const idx = Array.from({ length: r }, (_, i) => i);
  yield idx.map(i => items[i]!);
  for (;;) {
    let i = r - 1;
    while (i >= 0 && idx[i] === i + n - r) i--;
    if (i < 0) return;
    idx[i]!++;
    for (let j = i + 1; j < r; j++) idx[j] = idx[j - 1]! + 1;
    yield idx.map(k => items[k]!);
  }
}
function* permutations<T>(items: readonly T[]): Generator<T[]> {
  const n = items.length;
  const used = new Array<boolean>(n).fill(false);
  const cur: T[] = [];
  function* rec(): Generator<T[]> {
    if (cur.length === n) { yield cur.slice(); return; }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true; cur.push(items[i]!);
      yield* rec();
      cur.pop(); used[i] = false;
    }
  }
  yield* rec();
}

function passo3(ctx: Ctx, A: B, Bb: B, aY: number, bY: number, eastEdgeX: number) {
  const th = ctx.th;
  const larghezzaMax = Math.max(A.width, Bb.width);
  const gapY0 = aY + A.length;
  const gapH = bY - gapY0;
  const candidati = ctx.b1.filter(b => b.width <= larghezzaMax && b.id !== A.id && b.id !== Bb.id);

  const contornoNumAngoli = (widths: number[], wSopra: number, wSotto: number, eastAngoli: number, eastRiemp: number) => {
    const seqW = [wSopra, ...widths, wSotto];
    const seqE = [eastAngoli, ...widths.map(() => eastRiemp), eastAngoli];
    const bordo = seqE.map((e, i) => e - seqW[i]! + 1);
    let n = 0;
    for (let i = 1; i < bordo.length; i++) if (bordo[i] !== bordo[i - 1]) n++;
    return n;
  };

  const bestSubset = (items0: B[], target: number, wSopra: number, wSotto: number, eastAngoli: number, eastRiemp: number): B[] => {
    let items = items0;
    if (items.length > MAX_CANDIDATI_RIEMPIMENTO_CENTRALE)
      items = sortedBy(items, b => [-(b.width * b.length)]).slice(0, MAX_CANDIDATI_RIEMPIMENTO_CENTRALE);
    const n = items.length;
    let bestCombo: B[] = [];
    let bestDiff = target;
    let bestAngoli: number | null = null;
    let bestArea = 0;
    let bestNGe = -1;
    const MAX_PERM_SIZE = 6;
    let nVal = 0, nComb = 0;
    const lung = items.map(c => c.length).sort((a, b) => a - b);
    let esaurito = false;
    for (let r = 1; r <= n; r++) {
      if (esaurito) break;
      const sMin = lung.slice(0, r).reduce((s, v) => s + v, 0);
      const sMax = lung.slice(-r).reduce((s, v) => s + v, 0);
      const diffPoss = sMin <= target && target <= sMax ? 0 : Math.min(Math.abs(sMin - target), Math.abs(sMax - target));
      if (diffPoss > bestDiff) continue;
      for (const combo of combinations(items, r)) {
        if (++nComb > MAX_COMBINAZIONI_SICUREZZA) { esaurito = true; break; }
        const s = combo.reduce((t, c) => t + c.length, 0);
        const diff = Math.abs(s - target);
        if (diff > bestDiff) continue;
        const area = combo.reduce((t, c) => t + c.width * c.length, 0);
        const nGe = combo.reduce((t, c) => t + (isGE(c) ? 1 : 0), 0);
        const orderings: Iterable<B[]> = r <= MAX_PERM_SIZE
          ? permutations(combo)
          : [sortedBy(combo, c => [c.width]), sortedBy(combo, c => [-c.width])];
        for (const ordered of orderings) {
          nVal++;
          if (nVal > MAX_VALUTAZIONI_RIEMPIMENTO_CENTRALE) { esaurito = true; break; }
          const angoli = contornoNumAngoli(ordered.map(c => c.width), wSopra, wSotto, eastAngoli, eastRiemp);
          if (diff < bestDiff
            || (diff === bestDiff && (bestAngoli === null || angoli < bestAngoli))
            || (diff === bestDiff && angoli === bestAngoli && area > bestArea)
            || (diff === bestDiff && angoli === bestAngoli && area === bestArea && nGe > bestNGe)) {
            bestDiff = diff; bestAngoli = angoli; bestArea = area; bestNGe = nGe; bestCombo = ordered.slice();
          }
        }
        if (esaurito) break;
      }
    }
    return bestCombo;
  };

  const riempEast = th.x - 1;
  if (gapH > 0 && candidati.length) {
    const combo = bestSubset(candidati, gapH, A.width, Bb.width, eastEdgeX, riempEast);
    let cy = gapY0;
    for (const c of combo) {
      const cx = riempEast - c.width + 1;
      if (ctx.freeRect(cx, cy, c.width, c.length)) {
        ctx.place(c, cx, cy, c.width, c.length, "riempimento");
        cy += c.length;
      }
    }
  }
}

// ── Passo 4 ──────────────────────────────────────────────────────────────────
function passo4(ctx: Ctx) {
  const th = ctx.th;
  let cand: B[] = [];
  let larg = th.width - 1;
  const ids = new Set(ctx.placed.map(p => p.id));
  while (larg >= 1 && cand.length < 2) {
    cand = ctx.b1.filter(b => b.width === larg && !ids.has(b.id));
    if (cand.length < 2) larg--;
  }
  const s = sortedBy(cand, b => [-b.length, isGE(b) ? 0 : 1]);
  if (s.length >= 2) {
    const top = s[0]!, bot = s[1]!;
    const bx = th.x + th.width - larg;
    const tY = th.y - top.length, bY = th.y + th.length;
    const okT = ctx.freeRect(bx, tY, top.width, top.length);
    const okB = ctx.freeRect(bx, bY, bot.width, bot.length);
    if (okT) ctx.place(top, bx, tY, top.width, top.length, "blocco_muni");
    if (okB) ctx.place(bot, bx, bY, bot.width, bot.length, "blocco_muni");
  }
}

// ── Passo 5 ──────────────────────────────────────────────────────────────────
function passo5(ctx: Ctx, eastX: number, eastMidY: number, raccordoEstLen: number) {
  const th = ctx.th;
  const top = ctx.placed.filter(p => p.kind === "blocco_muni" && p.y < th.y);
  const bot = ctx.placed.filter(p => p.kind === "blocco_muni" && p.y > th.y);
  const y0 = top.length ? top[0]!.y : th.y;
  const y1 = bot.length ? bot[0]!.y + bot[0]!.l : th.y + th.length;
  const sx = eastX + raccordoEstLen;
  const up: Array<[number, number]> = [];
  for (let yy = eastMidY; yy > y0 - 1; yy--) up.push([sx, yy]);
  const [, okUp] = ctx.growPath(up);
  const down: Array<[number, number]> = [];
  for (let yy = eastMidY; yy < y1; yy++) down.push([sx, yy]);
  const [, okDown] = ctx.growPath(down);
  return { sx, y0, y1, okUp, okDown };
}

// ── Passo 6 ──────────────────────────────────────────────────────────────────
interface Dim { width: number; length: number }
function calcolaPosizioniFineStrada(bordoEst: number, yTerm: number, verso: 1 | -1, cap: Dim, lat: Dim | null): [number, number, number | null, number | null] {
  const xc = bordoEst - cap.width;
  const yc = verso === 1 ? yTerm - cap.length : yTerm + 1;
  if (!lat) return [xc, yc, null, null];
  return [xc, yc, bordoEst, verso === 1 ? yc : yc - 1];
}

function passo6(ctx: Ctx, grandi: B[], sx: number, y0: number, y1: number, okUp: boolean, okDown: boolean) {
  const bordoEst = sx + 1;
  const trovaCoppia = (pool: B[]): [B | null, B | null] => {
    let best: [B | null, B | null] = [null, null];
    let bScarto: number | null = null, bArea = -1, bGe = -1;
    for (const cap of pool) for (const lat of pool) {
      if (cap.id === lat.id) continue;
      const scarto = Math.abs(lat.length - (cap.length + 1));
      const area = cap.width * cap.length + lat.width * lat.length;
      const nGe = (isGE(cap) ? 1 : 0) + (isGE(lat) ? 1 : 0);
      if (bScarto === null || scarto < bScarto || (scarto === bScarto && area > bArea) || (scarto === bScarto && area === bArea && nGe > bGe)) {
        bScarto = scarto; bArea = area; bGe = nGe; best = [cap, lat];
      }
    }
    return best;
  };
  const pool = [...grandi];
  const spazioEst = (yT: number) => {
    let n = 0, x = bordoEst;
    while (ctx.isFree(x, yT) && n < ctx.g.W) { n++; x++; }
    return n;
  };
  const removeFrom = (arr: B[], b: B) => { const i = arr.findIndex(t => t.id === b.id); if (i >= 0) arr.splice(i, 1); };
  const piazza = (yT: number, verso: 1 | -1) => {
    let cap: B | null, lat: B | null;
    const areaGe = (b: B) => [b.width * b.length, isGE(b) ? 1 : 0];
    if (pool.length >= 2) [cap, lat] = trovaCoppia(pool);
    else if (pool.length === 1) {
      cap = pool[0]!;
      const used = new Set(ctx.placed.map(p => p.id)); used.add(cap.id);
      lat = firstMax(ctx.b1.filter(b => !used.has(b.id)), areaGe);
    } else {
      const used = new Set(ctx.placed.map(p => p.id));
      const est = ctx.b1.filter(b => !used.has(b.id));
      [cap, lat] = est.length >= 2 ? trovaCoppia(est) : [null, null];
      if (cap === null && est.length) cap = firstMax(est, areaGe);
    }
    if (cap === null) return;
    if (lat !== null && lat.length < cap.length) [cap, lat] = [lat, cap];
    const [xc, yc, xl, yl] = calcolaPosizioniFineStrada(bordoEst, yT, verso, cap, lat);
    if (ctx.freeRect(xc, yc, cap.width, cap.length)) ctx.place(cap, xc, yc, cap.width, cap.length, "fine_strada");
    removeFrom(pool, cap);
    if (lat === null) return;
    if (ctx.freeRect(xl!, yl!, lat.width, lat.length)) ctx.place(lat, xl!, yl!, lat.width, lat.length, "fine_strada");
    removeFrom(pool, lat);
  };
  if (okUp && okDown) {
    if (spazioEst(y0) >= spazioEst(y1 - 1)) { piazza(y0, 1); piazza(y1 - 1, -1); }
    else { piazza(y1 - 1, -1); piazza(y0, 1); }
  } else if (okUp) piazza(y0, 1);
  else if (okDown) piazza(y1 - 1, -1);
}

// ── Passo 7 ──────────────────────────────────────────────────────────────────
function passo7(ctx: Ctx, sy0: number, sy1: number): [number, number] {
  const land = ctx.land;
  const W = ctx.g.W;
  const edificiBordo = ctx.placed.filter(p => p.kind === "angolo" || p.kind === "riempimento");
  const vietata = (d: number) => DISTANZE_BORDO_VIETATE.has(d);
  const edificioValido = (p: Placed, dx: number, dy: number) => {
    const x = p.x + dx, y = p.y + dy, w = p.w, l = p.l;
    for (let xx = x; xx < x + w; xx++) if (!land.inLand(xx, y) || !land.inLand(xx, y + l - 1)) return false;
    for (let yy = y; yy < y + l; yy++) if (!land.inLand(x, yy) || !land.inLand(x + w - 1, yy)) return false;
    for (let xx = x; xx < x + w; xx++) {
      if (vietata(land.dist(xx, y - 1, 0, -1))) return false;
      if (vietata(land.dist(xx, y + l, 0, 1))) return false;
    }
    for (let yy = y; yy < y + l; yy++) {
      if (vietata(land.dist(x - 1, yy, -1, 0))) return false;
      if (vietata(land.dist(x + w, yy, 1, 0))) return false;
    }
    return true;
  };
  const dxValido = (dx: number, dy: number) => edificiBordo.every(p => edificioValido(p, dx, dy));
  const distMinOvest = (dx: number, dy: number) => {
    let m: number | null = null;
    for (const p of edificiBordo) for (let yy = p.y + dy; yy < p.y + dy + p.l; yy++) {
      const d = land.dist(p.x + dx - 1, yy, -1, 0);
      if (m === null || d < m) m = d;
    }
    return m ?? 0;
  };

  let dxS = 0, dyS = 0;
  if (edificiBordo.length) {
    let best: [number, number] | null = null;
    for (let dy = -3; dy <= 3; dy++) {
      let dxDy = 0;
      for (let dx = 0; dx >= -W; dx--) {
        if (dxValido(dx, dy)) dxDy = dx; else break;
      }
      const res = distMinOvest(dxDy, dy);
      if (res >= 3) {
        const dxC = dxDy - res;
        if (dxValido(dxC, dy)) dxDy = dxC;
      }
      if (best === null || dxDy < best[0] || (dxDy === best[0] && Math.abs(dy) < Math.abs(best[1]))) best = [dxDy, dy];
    }
    [dxS, dyS] = best ?? [0, 0];
  }

  if (dxS !== 0 || dyS !== 0) {
    for (const p of ctx.placed) { p.x += dxS; p.y += dyS; }
    ctx.th.x += dxS; ctx.th.y += dyS;
    const nr = new Set<string>();
    for (const k of ctx.road) { const [x, y] = unkey(k); nr.add(key(x + dxS, y + dyS)); }
    ctx.road = nr;
    ctx.occupied.fill(0);
    ctx.mark(ctx.th.x, ctx.th.y, ctx.th.width, ctx.th.length);
    for (const p of ctx.placed) ctx.mark(p.x, p.y, p.w, p.l);
    for (const k of ctx.road) { const [x, y] = unkey(k); ctx.mark(x, y, 1, 1); }
  }

  // Inversione Nord<->Sud dei fine_strada in violazione 0-o->=3.
  const violazione = (p: { x: number; y: number; w: number; l: number }) => {
    const { x, y, w, l } = p;
    for (let xx = x; xx < x + w; xx++) {
      if (vietata(land.dist(xx, y - 1, 0, -1))) return true;
      if (vietata(land.dist(xx, y + l, 0, 1))) return true;
    }
    for (let yy = y; yy < y + l; yy++) {
      if (vietata(land.dist(x - 1, yy, -1, 0))) return true;
      if (vietata(land.dist(x + w, yy, 1, 0))) return true;
    }
    return false;
  };
  const th = ctx.th;
  const fsN = ctx.placed.filter(p => p.kind === "fine_strada" && p.y < th.y);
  const fsS = ctx.placed.filter(p => p.kind === "fine_strada" && p.y > th.y);
  if (fsN.length && fsS.length) {
    if (fsN.some(violazione) || fsS.some(violazione)) {
      const capLat = (g: Placed[]): [Placed, Placed | null] => {
        if (g.length === 1) return [g[0]!, null];
        const a = g[0]!, b = g[1]!;
        return a.x < b.x ? [a, b] : [b, a];
      };
      const [capN, latN] = capLat(fsN);
      const [capS, latS] = capLat(fsS);
      const bordo = latN ? latN.x : latS ? latS.x : capN.x + capN.w;
      const yTN = sy0 + dyS;
      const yTS = sy1 - 1 + dyS;
      const dim = (p: Placed): Dim => ({ width: p.w, length: p.l });
      const [xcS, ycS, xlS, ylS] = calcolaPosizioniFineStrada(bordo, yTS, -1, dim(capN), latN ? dim(latN) : null);
      const [xcN, ycN, xlN, ylN] = calcolaPosizioniFineStrada(bordo, yTN, 1, dim(capS), latS ? dim(latS) : null);
      const cand: Array<[Placed, number, number]> = [[capN, xcS, ycS], [capS, xcN, ycN]];
      if (latN) cand.push([latN, xlS!, ylS!]);
      if (latS) cand.push([latS, xlN!, ylN!]);
      for (const [p] of cand) ctx.unmark(p.x, p.y, p.w, p.l);
      let ancora = false, libere = true;
      for (const [p, nx, ny] of cand) {
        if (!ctx.freeRect(nx, ny, p.w, p.l)) { libere = false; break; }
        if (violazione({ x: nx, y: ny, w: p.w, l: p.l })) { ancora = true; break; }
      }
      if (libere && !ancora) {
        for (const [p, nx, ny] of cand) { p.x = nx; p.y = ny; ctx.mark(p.x, p.y, p.w, p.l); }
      } else {
        for (const [p] of cand) ctx.mark(p.x, p.y, p.w, p.l);
      }
    }
  }
  return [dxS, dyS];
}

// ── Biforcazione raccordo 3/4 ────────────────────────────────────────────────
function biforcaRaccordo(ctx: Ctx, sx: number, eastMidY: number, esteso: boolean): number {
  if (!esteso) return sx;
  const [, ok] = ctx.growPath([[sx + 1, eastMidY]]);
  if (!ok) return sx;
  const vecchia: Array<[number, number]> = [];
  for (const k of ctx.road) { const [x, y] = unkey(k); if (x === sx && y !== eastMidY) vecchia.push([x, y]); }
  for (const [x, y] of vecchia) { ctx.road.delete(key(x, y)); ctx.unmark(x, y, 1, 1); }
  for (const [x, y] of vecchia) { ctx.road.add(key(x + 1, y)); ctx.mark(x + 1, y, 1, 1); }
  const fs = ctx.placed.filter(p => p.kind === "fine_strada");
  for (const p of fs) ctx.unmark(p.x, p.y, p.w, p.l);
  for (const p of fs) {
    const nx = p.x + 1;
    if (ctx.freeRect(nx, p.y, p.w, p.l)) { ctx.mark(nx, p.y, p.w, p.l); p.x = nx; }
    else ctx.mark(p.x, p.y, p.w, p.l);
  }
  return sx + 1;
}

/** Colonna più frequente fra le celle strada (Counter.most_common: a pari conteggio vince la prima incontrata). */
function colonnaPiuFrequente(cells: Iterable<string>): number {
  const cnt = new Map<number, number>();
  for (const k of cells) { const x = unkey(k)[0]; cnt.set(x, (cnt.get(x) ?? 0) + 1); }
  let bx = 0, bc = -1;
  for (const [x, c] of cnt) if (c > bc) { bx = x; bc = c; }
  return bx;
}

// ── Passo 8 ──────────────────────────────────────────────────────────────────
function passo8(ctx: Ctx): number {
  const land = ctx.land;
  const { W, H } = ctx.g;
  const th = ctx.th;
  const byId = new Map(ctx.placed.map(p => [p.id, p]));
  const sx = colonnaPiuFrequente(ctx.road);
  const ys: number[] = [];
  for (const k of ctx.road) { const [x, y] = unkey(k); if (x === sx) ys.push(y); }
  const top = Math.min(...ys), bot = Math.max(...ys);

  const trasla = (ids: string[], dir: 1 | -1): number => {
    const pezzi = ids.map(i => byId.get(i)).filter((p): p is Placed => !!p);
    if (!pezzi.length) return 0;
    const celle: Array<[number, number]> = [];
    const seen = new Set<string>();
    for (const p of pezzi) for (let xx = p.x; xx < p.x + p.w; xx++) for (let yy = p.y; yy < p.y + p.l; yy++) {
      const k = key(xx, yy); if (!seen.has(k)) { seen.add(k); celle.push([xx, yy]); }
    }
    const colMin = new Map<number, number>(), colMax = new Map<number, number>();
    for (const [x, y] of celle) {
      if (!colMin.has(x) || y < colMin.get(x)!) colMin.set(x, y);
      if (!colMax.has(x) || y > colMax.get(x)!) colMax.set(x, y);
    }
    const valida = (dy: number) => {
      for (const [x, y] of celle) if (!land.inLand(x, y + dy)) return false;
      if (dir < 0) { for (const [x, yMin] of colMin) if (land.dist(x, yMin + dy - 1, 0, -1) === 1) return false; }
      else { for (const [x, yMax] of colMax) if (land.dist(x, yMax + dy + 1, 0, 1) === 1) return false; }
      return true;
    };
    let dyV = 0;
    for (let passo = 1; passo < Math.max(W, H) + 2; passo++) {
      const dy = dir * passo;
      if (valida(dy)) dyV = dy;
    }
    if (dyV === 0) return 0;
    for (const p of pezzi) ctx.unmark(p.x, p.y, p.w, p.l);
    for (const p of pezzi) p.y += dyV;
    for (const p of pezzi) ctx.mark(p.x, p.y, p.w, p.l);
    return dyV;
  };

  const isRect = (p: Placed) => p.kind === "fine_strada" || p.kind === "riempimento_rettangolo";
  const nordIds = ctx.placed.filter(p => isRect(p) && p.y < th.y).map(p => p.id);
  const sudIds = ctx.placed.filter(p => isRect(p) && p.y > th.y).map(p => p.id);
  const fsN = nordIds.filter(i => byId.get(i)?.kind === "fine_strada");
  const fsS = sudIds.filter(i => byId.get(i)?.kind === "fine_strada");
  const dyN = trasla(fsN, -1);
  const dyS = trasla(fsS, 1);
  if (dyN !== 0) for (let y = top + dyN; y < top; y++) ctx.road.add(key(sx, y));
  if (dyS !== 0) for (let y = bot + 1; y <= bot + dyS; y++) ctx.road.add(key(sx, y));
  return sx;
}

// ── Passo 9 ──────────────────────────────────────────────────────────────────
function passo9(ctx: Ctx, eastEdgeX: number, sx: number, eastMidY: number, okUp: boolean, okDown: boolean,
  raccordoEsteso: boolean, estNord: number, estSud: number) {
  const th = ctx.th;
  const road = ctx.road;
  const bm = ctx.placed.filter(p => p.kind === "blocco_muni");
  const x0r = bm.length ? Math.min(...bm.map(p => p.x)) + Math.max(...bm.map(p => p.w)) : eastEdgeX;
  const larg = sx - x0r;
  const lim = raccordoEsteso ? 4 : 3;
  const usatiRect = new Set(ctx.placed.map(p => p.id));
  const poolR = ctx.b1.filter(b => !usatiRect.has(b.id) && b.width <= lim && b.length <= lim);
  const MAX_NODI = 1_000_000;

  interface Zona { y0: number; y1: number }
  const riempi = (zone0: Zona[], pool: B[]): boolean => {
    const zone = zone0.filter(z => z.y1 - z.y0 > 0);
    if (!zone.length) return true;
    const aree = zone.map(z => larg * (z.y1 - z.y0));
    const areaTot = aree.reduce((s, v) => s + v, 0);
    const offset: number[] = [];
    let acc = 0;
    for (const z of zone) { offset.push(acc); acc += z.y1 - z.y0; }
    const hTot = acc;
    const locToReal = (rl: number): [number, number] => {
      for (let i = 0; i < zone.length; i++) {
        const z = zone[i]!;
        if (rl < offset[i]! + (z.y1 - z.y0)) return [i, z.y0 + (rl - offset[i]!)];
      }
      throw new Error("riga fuori range");
    };
    const entra = pool.filter(b => b.width <= larg && b.length <= hTot);
    if (larg <= 0) return aree.every(a => a === 0); // (Python: griglia vuota, nessun piazzamento)
    const gr: boolean[][] = Array.from({ length: hTot }, () => new Array<boolean>(larg).fill(true));
    for (let rl = 0; rl < hTot; rl++) {
      const [, yr] = locToReal(rl);
      for (let lx = 0; lx < larg; lx++) if (!ctx.freeRect(x0r + lx, yr, 1, 1)) gr[rl]![lx] = false;
    }
    const confini = zone.map((z, i) => offset[i]! + (z.y1 - z.y0));
    const migliore = { celle: -1, n: -1, piaz: [] as Array<[number, number, B]> };
    const areeOrd = [...new Set(entra.map(b => b.width * b.length))].sort((a, b) => a - b);
    const areaMin = areeOrd.length ? areeOrd[0]! : 1;
    let nodi = 0;
    const primaLibera = (cur: number): [number, number, number] | null => {
      for (let idx = cur; idx < hTot * larg; idx++) {
        const ly = Math.floor(idx / larg), lx = idx % larg;
        if (gr[ly]![lx]) return [lx, ly, idx];
      }
      return null;
    };
    const zonaDi = (ly: number) => { for (let i = 0; i < confini.length; i++) if (ly < confini[i]!) return i; return zone.length - 1; };
    const toccaStrada = (lx: number, ly: number, w: number, h: number, iz: number) => {
      const z = zone[iz]!;
      const gx0 = x0r + lx, gy0 = z.y0 + (ly - offset[iz]!);
      let ns = false, eo = false;
      for (let xx = gx0; xx < gx0 + w && !ns; xx++) if (road.has(key(xx, gy0 - 1)) || road.has(key(xx, gy0 + h))) ns = true;
      for (let yy = gy0; yy < gy0 + h && !eo; yy++) if (road.has(key(gx0 - 1, yy)) || road.has(key(gx0 + w, yy))) eo = true;
      if (w === h) return ns || eo;
      if (w < h) return ns;
      return eo;
    };
    const entraLibera = (lx: number, ly: number, w: number, h: number) => {
      if (lx + w > larg || ly + h > hTot) return false;
      const iz = zonaDi(ly);
      if (ly + h > confini[iz]!) return false;
      for (let yy = ly; yy < ly + h; yy++) for (let xx = lx; xx < lx + w; xx++) if (!gr[yy]![xx]) return false;
      return toccaStrada(lx, ly, w, h, iz);
    };
    const segna = (lx: number, ly: number, w: number, h: number, v: boolean) => {
      for (let yy = ly; yy < ly + h; yy++) for (let xx = lx; xx < lx + w; xx++) gr[yy]![xx] = v;
    };
    const formePool = new Map<string, { area: number; tot: number }>();
    for (const b of entra) {
      const k = key(b.width, b.length);
      const e = formePool.get(k) ?? { area: b.width * b.length, tot: 0 };
      e.tot++; formePool.set(k, e);
    }
    const boundExtra = (libere: number, piaz: Array<[number, number, B]>) => {
      const usati = new Map<string, number>();
      for (const [, , b] of piaz) { const k = key(b.width, b.length); usati.set(k, (usati.get(k) ?? 0) + 1); }
      const dispArea = new Map<number, number>();
      for (const [k, e] of formePool) dispArea.set(e.area, (dispArea.get(e.area) ?? 0) + e.tot - (usati.get(k) ?? 0));
      let res = libere, extra = 0;
      for (const area of areeOrd) {
        if (res < area) continue;
        const disp = dispArea.get(area) ?? 0;
        if (disp <= 0) continue;
        const presi = Math.min(disp, Math.floor(res / area));
        extra += presi; res -= presi * area;
        if (res < areaMin) break;
      }
      return extra;
    };
    const piaz: Array<[number, number, B]> = [];
    const usati = new Set<string>();
    const bt = (coperte: number, libere: number, cursore: number): void => {
      nodi++;
      if (nodi > MAX_NODI) return;
      if (coperte > migliore.celle || (coperte === migliore.celle && piaz.length > migliore.n)) {
        migliore.celle = coperte; migliore.n = piaz.length; migliore.piaz = piaz.slice();
      }
      if (migliore.celle === areaTot) {
        if (coperte + libere < areaTot) return;
        if (piaz.length + boundExtra(libere, piaz) <= migliore.n) return;
      } else if (coperte + libere < migliore.celle) return;
      const cella = primaLibera(cursore);
      if (!cella) return;
      const [lx, ly, nc] = cella;
      const provati = new Set<string>();
      for (const b of entra) {
        if (usati.has(b.id)) continue;
        const d = key(b.width, b.length);
        if (provati.has(d)) continue;
        provati.add(d);
        if (entraLibera(lx, ly, b.width, b.length)) {
          const a = b.width * b.length;
          segna(lx, ly, b.width, b.length, false);
          piaz.push([lx, ly, b]); usati.add(b.id);
          bt(coperte + a, libere - a, nc);
          usati.delete(b.id); piaz.pop();
          segna(lx, ly, b.width, b.length, true);
        }
      }
      gr[ly]![lx] = false;
      bt(coperte, libere - 1, nc);
      gr[ly]![lx] = true;
    };
    entra.sort((a, b) => a.width * a.length - b.width * b.length);
    bt(0, areaTot, 0);
    const areaZona = zone.map(() => 0);
    for (const [lx, ly, b] of migliore.piaz) {
      const [iz, yr] = locToReal(ly);
      const xe = x0r + lx;
      if (!ctx.freeRect(xe, yr, b.width, b.length)) continue;
      ctx.place(b, xe, yr, b.width, b.length, "riempimento_rettangolo");
      const i = pool.findIndex(t => t.id === b.id); if (i >= 0) pool.splice(i, 1);
      areaZona[iz]! += b.width * b.length;
    }
    return zone.every((_, i) => areaZona[i] === aree[i]);
  };

  const bmTop = ctx.placed.find(p => p.kind === "blocco_muni" && p.y < th.y);
  const bmBot = ctx.placed.find(p => p.kind === "blocco_muni" && p.y > th.y);
  const zone: Zona[] = [];
  if (okUp && bmTop) zone.push({ y0: bmTop.y - estNord, y1: eastMidY });
  if (okDown && bmBot) zone.push({ y0: eastMidY + 1, y1: bmBot.y + bmBot.l + estSud });
  if (!riempi(zone, poolR)) {
    const primo = new Set(ctx.placed.filter(p => p.kind === "riempimento_rettangolo").map(p => p.id));
    if (primo.size) {
      for (const p of [...ctx.placed]) if (primo.has(p.id)) {
        ctx.unmark(p.x, p.y, p.w, p.l);
        ctx.placed.splice(ctx.placed.indexOf(p), 1);
      }
    }
    riempi(zone, ctx.b1.filter(b => !usatiRect.has(b.id) && b.width <= lim));
  }
}

// ── Passo 10 ─────────────────────────────────────────────────────────────────
function passo10(ctx: Ctx, sx: number) {
  const land = ctx.land;
  const th = ctx.th;
  const road = ctx.road;
  const ys: number[] = [];
  for (const k of road) { const [x, y] = unkey(k); if (x === sx) ys.push(y); }
  const yTop = Math.min(...ys), yBot = Math.max(...ys);
  const occ = new Set<string>(road);
  for (const p of ctx.placed) for (let xx = p.x; xx < p.x + p.w; xx++) for (let yy = p.y; yy < p.y + p.l; yy++) occ.add(key(xx, yy));
  // Anche il municipio (non sta in ctx.placed): senza, un pezzo della colonna
  // ovest poteva sovrapporsi al municipio quando la strada verticale gli passa
  // a una cella (bug reale sulla città dell'utente: 4×3 su un buco 3×3).
  for (let xx = th.x; xx < th.x + th.width; xx++) for (let yy = th.y; yy < th.y + th.length; yy++) occ.add(key(xx, yy));
  const giaPiazzati = new Set(ctx.placed.map(p => p.id));
  const poolCol = ctx.b1.filter(b => !giaPiazzati.has(b.id) && b.road_requirement >= 1
    && Math.min(b.width, b.length) < SOGLIA_GRANDE && b.length !== 1 && b.width >= b.length);
  const largMax = poolCol.reduce((m, b) => Math.max(m, b.width), 0);
  const coperte = new Set<number>();
  for (let yy = yTop; yy <= yBot; yy++)
    for (let xx = sx - Math.max(largMax, 1); xx < sx; xx++) if (occ.has(key(xx, yy))) { coperte.add(yy); break; }
  const daRiempire: number[] = [];
  for (let y = yTop; y <= yBot; y++) if (!coperte.has(y)) daRiempire.push(y);
  const segmenti: Array<[number, number]> = [];
  if (daRiempire.length) {
    let inizio = daRiempire[0]!, prec = daRiempire[0]!;
    for (const y of daRiempire.slice(1)) {
      if (y !== prec + 1) { segmenti.push([inizio, prec]); inizio = y; }
      prec = y;
    }
    segmenti.push([inizio, prec]);
  }
  let wCapN: number | null = null, wCapS: number | null = null;
  const righeCapN = new Set<number>(), righeCapS = new Set<number>();
  for (const p of ctx.placed) {
    if (p.kind === "fine_strada" && p.x + p.w === sx + 1) {
      if (p.y < th.y) wCapN = p.w - 1; else wCapS = p.w - 1;
      for (let r = p.y; r < p.y + p.l; r++) (p.y < th.y ? righeCapN : righeCapS).add(r);
    }
  }
  const usatiCol = new Set<string>();
  const piazzatiCol: Placed[] = [];

  const riempiSegmento = (y0: number, y1: number, poolDisp: B[], vSopra: number | null, vSotto: number | null) => {
    const hTot = y1 - y0 + 1;
    if (hTot <= 0) return;
    const pezzi = poolDisp.filter(b => b.length <= hTot);
    if (!pezzi.length) return;
    const widths = [...new Set(pezzi.map(b => b.width))].sort((a, b) => a - b);
    const bitDi = new Map(widths.map((w, i) => [w, i]));
    const nMask = 1 << widths.length;
    const NEG = -Infinity;
    const dp: number[][] = Array.from({ length: hTot + 1 }, () => new Array<number>(nMask).fill(NEG));
    dp[0]![0] = 0;
    const scelta: Array<Array<[B, number, number] | null>> = Array.from({ length: hTot + 1 }, () => new Array<[B, number, number] | null>(nMask).fill(null));
    for (const b of pezzi) {
      const lung = b.length, area = b.length * b.width, bit = 1 << bitDi.get(b.width)!;
      for (let j = hTot; j > lung - 1; j--) {
        const jp = j - lung;
        for (let m = 0; m < nMask; m++) {
          if (dp[jp]![m] === NEG) continue;
          const mn = m | bit;
          const v = dp[jp]![m]! + area;
          if (v > dp[j]![mn]!) { dp[j]![mn] = v; scelta[j]![mn] = [b, jp, m]; }
        }
      }
    }
    const areaMax = (j: number) => { let best = NEG; for (let m = 0; m < nMask; m++) if (dp[j]![m]! > best) best = dp[j]![m]!; return best; };
    let j = hTot;
    while (j > 0 && areaMax(j) === NEG) j--;
    if (j === 0) return;
    const aMax = areaMax(j);
    const bits = (m: number) => { let c = 0; for (; m; m &= m - 1) c++; return c; };
    const salti = (m: number) => {
      let s = bits(m);
      if (vSopra !== null && bitDi.has(vSopra) && (m & (1 << bitDi.get(vSopra)!))) s--;
      if (vSotto !== null && bitDi.has(vSotto) && (m & (1 << bitDi.get(vSotto)!))) s--;
      return s;
    };
    let mSc = -1, sMin = Infinity;
    for (let m = 0; m < nMask; m++) if (dp[j]![m] === aMax) { const s = salti(m); if (s < sMin) { sMin = s; mSc = m; } }
    const multiset: Array<[B, number]> = [];
    let jj = j, mm = mSc;
    while (jj > 0) {
      const [b, jp, mp] = scelta[jj]![mm]!;
      multiset.push([b, jj - jp]);
      jj = jp; mm = mp;
    }

    const esegui = (seq: Array<[B, number]>) => {
      const qui: Placed[] = [];
      const idQui = new Set<string>();
      let fallback = false;
      let riga = 0;
      const prova = (bb: B): [number, number, number, number] | null => {
        const ww = bb.width, ll = bb.length;
        if (riga + ll > hTot) return null;
        const xe = sx - ww, ye = y0 + riga;
        if (!land.rectInLand(xe, ye, ww, ll)) return null;
        for (let xx = xe; xx < xe + ww; xx++) for (let yy = ye; yy < ye + ll; yy++) if (occ.has(key(xx, yy))) return null;
        if (land.dist(xe - 1, ye, -1, 0) === 1) return null;
        return [xe, ye, ww, ll];
      };
      for (const [b] of seq) {
        const l = b.length;
        const gia = usatiCol.has(b.id) || idQui.has(b.id);
        let ris = gia ? null : prova(b);
        let bSc = b;
        if (ris === null) {
          fallback = true;
          const cv: Array<[number, number, B, [number, number, number, number]]> = [];
          for (const bb of poolDisp) {
            if (usatiCol.has(bb.id) || idQui.has(bb.id) || bb.id === b.id) continue;
            const pos = prova(bb);
            if (pos !== null) cv.push([bb.length === l ? 0 : 1, -bb.width * bb.length, bb, pos]);
          }
          if (cv.length) {
            cv.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
            bSc = cv[0]![2]; ris = cv[0]![3];
          }
        }
        if (ris !== null) {
          const [xe, ye, w, ll] = ris;
          qui.push({ id: bSc.id, name: bSc.name, x: xe, y: ye, w, l: ll, kind: "colonna_ovest" });
          idQui.add(bSc.id);
          riga += ll;
        }
      }
      const righe = qui.reduce((s, p) => s + p.l, 0);
      const ws = qui.map(p => p.w);
      let nSalti = 0;
      for (let i = 1; i < ws.length; i++) if (ws[i - 1] !== ws[i]) nSalti++;
      if (ws.length) {
        if (vSopra !== null && ws[0] !== vSopra) nSalti++;
        if (vSotto !== null && ws[ws.length - 1] !== vSotto) nSalti++;
      }
      return { qui, idQui, fallback, righe, nSalti };
    };

    const gruppi = [...new Set(multiset.map(([b]) => b.width))].sort((a, b) => a - b);
    const ordini: number[][] = [gruppi, [...gruppi].reverse()];
    const inG = (w: number | null) => w !== null && gruppi.includes(w);
    if (inG(vSopra) || inG(vSotto)) {
      const resto = gruppi.filter(w => w !== vSopra && w !== vSotto);
      const ov = [...(inG(vSopra) ? [vSopra!] : []), ...resto, ...(inG(vSotto) ? [vSotto!] : [])];
      ordini.push(ov);
      const ov2 = [...(inG(vSopra) ? [vSopra!] : []), ...[...resto].reverse(), ...(inG(vSotto) ? [vSotto!] : [])];
      if (ov2.join(",") !== ov.join(",")) ordini.push(ov2);
    }
    let best: ReturnType<typeof esegui> | null = null;
    for (const ord of ordini) {
      const rank = new Map(ord.map((w, i) => [w, i]));
      const seq = [...multiset].sort((a, b) => rank.get(a[0].width)! - rank.get(b[0].width)!);
      const r = esegui(seq);
      if (best === null || cmpTuple([r.fallback ? 1 : 0, -r.righe, r.nSalti], [best.fallback ? 1 : 0, -best.righe, best.nSalti]) < 0) best = r;
    }
    piazzatiCol.push(...best!.qui);
    for (const id of best!.idQui) usatiCol.add(id);
  };

  for (const [y0, y1] of segmenti) {
    const libero = poolCol.filter(b => !usatiCol.has(b.id));
    const vS = righeCapN.has(y0 - 1) ? wCapN : null;
    const vT = righeCapS.has(y1 + 1) ? wCapS : null;
    riempiSegmento(y0, y1, libero, vS, vT);
  }
  for (const p of piazzatiCol) ctx.mark(p.x, p.y, p.w, p.l);
  ctx.placed.push(...piazzatiCol);
}

// ── Riepilogo + checkpoint (render_soluzione senza disegno) ──────────────────
function riepilogoECheckpoint(ctx: Ctx, grandi: B[], areasRaw: BuilderArea[], sxVariante: number,
  poolCon: PoolEntry[], poolSenza: PoolEntry[]): { riepilogo: Riepilogo; checkpoint: Checkpoint } {
  const th = ctx.th;
  const road = ctx.road;
  const idsFine = new Set(ctx.placed.map(p => p.id));
  const grandiAncora = grandi.filter(b => !idsFine.has(b.id));
  const piccoli = ctx.b1.filter(b => !idsFine.has(b.id) && Math.min(b.width, b.length) < SOGLIA_GRANDE);
  const piccolissimi = piccoli.filter(b => Math.min(b.width, b.length) <= 2);
  const medi = piccoli.filter(b => Math.min(b.width, b.length) >= 3);

  const start: string[] = [];
  for (const k of road) { const [x, y] = unkey(k); if (ctx.touchesMuni(x, y)) start.push(k); }
  const reach = new Set(start);
  const fr = [...start];
  while (fr.length) {
    const [x, y] = unkey(fr.pop()!);
    for (const nb of [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)])
      if (road.has(nb) && !reach.has(nb)) { reach.add(nb); fr.push(nb); }
  }

  let buchi = 0;
  const buchiCoord: Array<[number, number]> = [];
  for (const k of road) {
    const [cx, cy] = unkey(k);
    if (cx > sxVariante) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const vx = cx + dx, vy = cy + dy;
      if (vx > sxVariante) continue;
      if (road.has(key(vx, vy))) continue;
      if (!ctx.inLand(vx, vy)) continue;
      if (ctx.occupied[(vy - ctx.g.y0) * ctx.g.W + (vx - ctx.g.x0)]) continue;
      buchi++;
      buchiCoord.push([cx, cy]);
    }
  }

  const gruppo = (kind: string, yy: number) => {
    if (kind === "angolo" || kind === "blocco_muni" || kind === "riempimento") return "centrale";
    if (kind === "riempimento_rettangolo" || kind === "colonna_ovest") return yy < th.y ? "nord" : "sud";
    return null;
  };
  const profilo = new Map<number, [number, string]>();
  for (const p of ctx.placed) {
    if (p.x + p.w > sxVariante) continue;
    for (let yy = p.y; yy < p.y + p.l; yy++) {
      const cur = profilo.get(yy);
      if (!cur || p.x < cur[0]) profilo.set(yy, [p.x, p.kind]);
    }
  }
  const righe = [...profilo.keys()].sort((a, b) => a - b);
  let saltiTot = 0, saltiUtili = 0;
  for (let i = 1; i < righe.length; i++) {
    const a = righe[i - 1]!, b = righe[i]!;
    if (b !== a + 1) continue;
    const [xa, ka] = profilo.get(a)!, [xb, kb] = profilo.get(b)!;
    if (xa === xb) continue;
    saltiTot++;
    const ga = gruppo(ka, a);
    if (ga === gruppo(kb, b) && ga !== null) saltiUtili++;
  }

  const riepilogo: Riepilogo = {
    n_edifici: ctx.placed.length, n_celle_strada: road.size, isolate: road.size - reach.size,
    zero_buchi: buchi === 0, celle_buco_totali: buchi, celle_buco_coordinate: buchiCoord,
    grandi_rimasti: grandiAncora.length, piccoli_rimasti: piccoli.length,
    piccolissimi_rimasti: piccolissimi.length, medi_rimasti: medi.length,
    salti_profilo_ovest: saltiTot, salti_profilo_ovest_utili: saltiUtili,
  };

  const byId = new Map(ctx.b1.map(b => [b.id, b]));
  const isRect = (p: Placed) => p.kind === "fine_strada" || p.kind === "riempimento_rettangolo";
  const roadSorted = [...road].map(unkey).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const checkpoint: Checkpoint = {
    buildings_placed: ctx.placed.map(p => {
      const b = byId.get(p.id);
      return {
        id: p.id, cityentity_id: b?.cityentity_id ?? "", name: p.name,
        x: p.x, y: p.y, width: p.w, length: p.l,
        road_requirement: b?.road_requirement ?? 1, kind: p.kind,
      };
    }),
    town_hall: { x: th.x, y: th.y, width: th.width, length: th.length },
    connected_road: roadSorted.map(([x, y]) => ({ x, y })),
    buildings_remaining: ctx.b1.filter(b => !idsFine.has(b.id)).map(b => ({
      id: b.id, cityentity_id: b.cityentity_id, name: b.name, width: b.width, length: b.length, road_requirement: b.road_requirement,
    })),
    pool_iniziale_con_strada: poolCon,
    pool_iniziale_senza_strada: poolSenza,
    unlocked_areas: areasRaw,
    rect_nord_ids: ctx.placed.filter(p => isRect(p) && p.y < th.y).map(p => p.id),
    rect_sud_ids: ctx.placed.filter(p => isRect(p) && p.y > th.y).map(p => p.id),
  };
  return { riepilogo, checkpoint };
}

// ── run() ────────────────────────────────────────────────────────────────────
/** Esegue fase1 su una città nel formato dell'export JSON della mappa. null se la città non è adatta. */
export function runFase1(data: BuilderInput, opts: Fase1Options = {}): Fase1Result | null {
  const areasRaw = data.unlocked_areas;
  if (!areasRaw?.length) return null;
  const all: B[] = data.buildings.map(b => ({
    id: String(b.id), cityentity_id: b.cityentity_id ?? "", name: b.name,
    width: b.width, length: b.length, road_requirement: b.road_requirement || 0,
  }));
  const muni = all.find(b => b.cityentity_id.startsWith("H_")) ?? null;
  const noTh = all.filter(b => b !== muni);
  const b1 = noTh.filter(b => b.road_requirement === 1);
  const toPool = (b: B): PoolEntry => ({ id: b.id, cityentity_id: b.cityentity_id, name: b.name, width: b.width, length: b.length, road_requirement: b.road_requirement });
  const poolCon = b1.map(toPool);
  const poolSenza = noTh.filter(b => b.road_requirement === 0).map(toPool);
  if (b1.length < 4) return null;

  const g = buildGrid(areasRaw);
  const thW = muni ? muni.width : 6, thL = muni ? muni.length : 7;
  if (thW > g.W || thL > g.H) return null;
  const th: TownHall = { width: thW, length: thL, x: g.x0 + Math.floor((g.W - thW) / 2), y: g.y0 + Math.floor((g.H - thL) / 2) };
  const ctx = new Ctx(g, new LandTables(g), th, b1);
  ctx.mark(th.x, th.y, th.width, th.length);
  ctx.snap("Municipio");

  const RACCORDO = 3;
  const [eastX, eastMidY0] = passo1(ctx, RACCORDO);
  let eastMidY = eastMidY0;
  ctx.snap("Passo 1 · seme stradale");
  const northY = th.y - 1, southY = th.y + th.length;
  const p2 = passo2(ctx, northY, southY);
  if (!p2) return null;
  ctx.snap("Passo 2 · angoli");
  let eastEdgeX = p2.eastEdgeX;
  passo3(ctx, p2.A, p2.B, northY - p2.A.length, southY + 1, eastEdgeX);
  ctx.snap("Passo 3 · riempimento centrale");
  passo4(ctx);
  ctx.snap("Passo 4 · blocco municipio");
  const ids4 = new Set(ctx.placed.map(p => p.id));
  const grandi = b1.filter(b => !ids4.has(b.id) && Math.min(b.width, b.length) >= SOGLIA_GRANDE);
  const p5 = passo5(ctx, eastX, eastMidY, RACCORDO);
  ctx.snap("Passo 5 · strada verticale");
  passo6(ctx, grandi, p5.sx, p5.y0, p5.y1, p5.okUp, p5.okDown);
  ctx.snap("Passo 6 · fine-strada");
  const [dx, dy] = passo7(ctx, p5.y0, p5.y1);
  ctx.snap("Passo 7 · traslazione al bordo");
  const sx = p5.sx + dx;
  eastEdgeX += dx;
  eastMidY += dy;

  const variante = (esteso: boolean): VariantResult => {
    const c = ctx.clone();
    const sxV = biforcaRaccordo(c, sx, eastMidY, esteso);
    c.snap(esteso ? "Raccordo a 4 celle" : "Raccordo a 3 celle");
    const stradaX = passo8(c);
    c.snap("Passo 8 · allungamento strada");
    const pre9 = c.clone();
    const esegui = (cr: Ctx, eN: number, eS: number) => {
      passo9(cr, eastEdgeX, sxV, eastMidY, p5.okUp, p5.okDown, esteso, eN, eS);
      cr.snap("Passo 9 · rettangoli nord/sud");
      passo10(cr, stradaX);
      cr.snap("Passo 10 · colonna ovest");
      return {
        ...riepilogoECheckpoint(cr, grandi, areasRaw, sxV, poolCon, poolSenza), trace: cr.trace,
        geometry: { stradaVX: stradaX, eastMidY },
      };
    };
    let res = esegui(c, 0, 0);
    if (!res.riepilogo.zero_buchi && res.riepilogo.celle_buco_coordinate.length) {
      // Retry Passo 9 con la zona allargata di 1 riga. Il Python sceglie nord o
      // sud guardando la PRIMA cella-buco nell'ordine di iterazione di un set
      // (arbitrario, non riproducibile): qui si provano entrambe le direzioni in
      // cui ci sono buchi e si tiene il risultato con meno buchi (mai peggio
      // del Python, a volte meglio).
      const thY = c.th.y;
      const forced = opts.forceRetry?.[esteso ? "r4" : "r3"];
      const dirs: Array<[number, number]> = forced ? [forced] : [];
      if (!forced) {
        const cys = res.riepilogo.celle_buco_coordinate.map(([, cy]) => cy);
        if (cys.some(cy => cy < thY)) dirs.push([1, 0]);
        if (cys.some(cy => cy > thY)) dirs.push([0, 1]);
      }
      for (const [eN, eS] of dirs) {
        const retry = esegui(pre9.clone(), eN, eS);
        if (retry.riepilogo.celle_buco_totali < res.riepilogo.celle_buco_totali) res = retry;
      }
    }
    return res;
  };
  return { r3: variante(false), r4: variante(true) };
}

export interface Fase1Options {
  /** Solo per i test differenziali: impone la direzione del retry del Passo 9
   *  ([estensione_nord, estensione_sud]) scelta dal Python. */
  forceRetry?: { r3?: [number, number]; r4?: [number, number] };
}
