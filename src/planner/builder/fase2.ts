// ─────────────────────────────────────────────────────────────────────────────
//  planner/builder/fase2.ts — Port TypeScript dell'algoritmo di fase2.py
//
//  Il builder NON esegue più fase 2 dopo fase 1 (richiesta dell'utente: gli
//  edifici senza strada intralciavano le nuove disposizioni lungo la
//  verticale); genera_mapgrid e runFase2 sono stati rimossi. Resta fillMask,
//  usato dal completamento (fase B e fase C di completion.ts) su qualunque
//  maschera di celle libere: 6 strategie di partizionamento (righe 2/3/4 settori, rettangoli
//     massimali, ghigliottina mv=2/3), per ciascuna backtracking a forme per
//     rettangolo (cap 3000 nodi, +4096 di raffinamento dopo il primo 100%) e
//     rifinitura dei buchi coi pezzi a lato 1; vince la copertura maggiore,
//     poi meno pezzi piccoli, poi meno edifici.
//
//  Differenze VOLUTE rispetto al Python: le bitmask di riga (interi Python a
//  precisione arbitraria) sono sostituite da controlli cella per cella
//  equivalenti; l'ultimo spareggio fra strategie (il TEMPO di esecuzione, non
//  deterministico) è sostituito dall'ordine delle strategie.
// ─────────────────────────────────────────────────────────────────────────────

/** Edificio del pool di fillMask (solo quelli con road_requirement 0 vengono usati). */
export interface PoolItem { id: string; name: string; width: number; length: number; road_requirement: number }

// ── fase2 ────────────────────────────────────────────────────────────────────
const DIM_MINIMA_RETTANGOLO = 3;
const MAX_NODI_RIFINITURA = 200_000;

interface PB { id: string; name: string; width: number; length: number }
export interface Fase2Placed extends PB { x: number; y: number; w: number; l: number; daRifinitura?: boolean }
type Rect = [number, number, number, number];
type Mask = number[][];

function normalizzaPool(raw: PoolItem[]): [PB[], PB[]] {
  const disp: PB[] = [], picc: PB[] = [];
  raw.forEach((b, idx) => {
    const w = b.width || 0, l = b.length || 0;
    if ((b.road_requirement ?? 0) !== 0) return;
    const nb: PB = { id: b.id || String(idx + 1), name: b.name || `Edificio #${b.id || idx + 1}`, width: b.width, length: b.length };
    if (w > 1 && l > 1) disp.push(nb);
    else if ((w === 1 || l === 1) && w <= 4 && l <= 4) picc.push(nb);
  });
  return [disp, picc];
}

interface Shape { w: number; l: number; area: number; items: PB[]; count: number }
function shapesOf(pool: PB[]): Shape[] {
  const map = new Map<string, Shape>();
  for (const b of pool) {
    const k = `${b.width}x${b.length}`;
    let s = map.get(k);
    if (!s) { s = { w: b.width, l: b.length, area: b.width * b.length, items: [], count: 0 }; map.set(k, s); }
    s.items.push(b);
  }
  const arr = [...map.values()].sort((a, b) => b.area - a.area);
  for (const s of arr) s.count = s.items.length;
  return arr;
}

interface RisBT { nodeCount: number; bestCov: number; placed: Fase2Placed[]; capRaggiunto: boolean }

function backtrackRiempimento(grid: Mask, buildings: PB[], targetCov: number, raffinamento: number, maxNodi: number, fast = false): RisBT {
  const R = grid.length, C = R ? grid[0]!.length : 0;
  const board = new Int8Array(R * C);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) board[r * C + c] = grid[r]![c] === 1 ? 0 : -1;
  const shapes = shapesOf(buildings);
  const rectFree = (sr: number, sc: number, w: number, l: number) => {
    for (let i = sr; i < sr + l; i++) for (let j = sc; j < sc + w; j++) if (board[i * C + j] !== 0) return false;
    return true;
  };
  const canPlace = (r: number, c: number, w: number, l: number) => r + l <= R && c + w <= C && rectFree(r, c, w, l);
  const cand: Array<Array<[number, number, Shape]>> = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const list: Array<[number, number, Shape]> = [];
    for (const st of shapes) {
      for (let dr = 0; dr < st.l; dr++) {
        const sr = r - dr;
        if (sr < 0 || sr + st.l > R) continue;
        for (let dc = 0; dc < st.w; dc++) {
          const sc = c - dc;
          if (sc < 0 || sc + st.w > C) continue;
          list.push([sr, sc, st]);
        }
      }
    }
    cand.push(list);
  }
  const coverable = (idx: number) => {
    for (const [sr, sc, st] of cand[idx]!) if (st.count > 0 && rectFree(sr, sc, st.w, st.l)) return true;
    return false;
  };
  const morte = new Uint8Array(R * C);
  let nMorte = 0;
  for (let i = 0; i < R * C; i++) if (board[i] === 0 && !coverable(i)) { morte[i] = 1; nMorte++; }
  const target = targetCov ? Math.max(0, targetCov - nMorte) : targetCov;
  const maxW = shapes.reduce((m, s) => Math.max(m, s.w), 1), maxL = shapes.reduce((m, s) => Math.max(m, s.l), 1);
  const hasUncoverable = (r: number, c: number, w: number, l: number) => {
    if (!fast) {
      for (let i = 0; i < R * C; i++) if (board[i] === 0 && !morte[i] && !coverable(i)) return true;
      return false;
    }
    // Modalità veloce (solo completamento del Planner, maschere grandi): controlla
    // solo le celle i cui rettangoli candidati possono toccare il pezzo appena posato.
    for (let i = Math.max(0, r - maxL + 1); i < Math.min(R, r + l + maxL - 1); i++)
      for (let j = Math.max(0, c - maxW + 1); j < Math.min(C, c + w + maxW - 1); j++) {
        const idx = i * C + j;
        if (board[idx] === 0 && !morte[idx] && !coverable(idx)) return true;
      }
    return false;
  };
  const place = (r: number, c: number, w: number, l: number, v: 0 | 1) => {
    for (let i = r; i < r + l; i++) for (let j = c; j < c + w; j++) board[i * C + j] = v;
  };
  const st: RisBT = { nodeCount: 0, bestCov: 0, placed: [], capRaggiunto: false };
  let bestCount = 0;
  let primo100: number | null = null;
  let stop = false;
  const placed: Fase2Placed[] = [];
  const bt = (cellIdx: number, cov: number): void => {
    if (stop) return;
    st.nodeCount++;
    if (primo100 !== null) {
      if (raffinamento === 0 || st.nodeCount - primo100 > raffinamento) { stop = true; return; }
    }
    if (primo100 === null && maxNodi && st.nodeCount >= maxNodi) { st.capRaggiunto = true; stop = true; return; }
    if (cov > st.bestCov || (cov === st.bestCov && placed.length < bestCount)) {
      st.bestCov = cov; bestCount = placed.length; st.placed = placed.slice();
      if (target && st.bestCov >= target && primo100 === null) primo100 = st.nodeCount;
    }
    let r = -1, c = -1;
    for (let i = cellIdx; i < R * C; i++) if (board[i] === 0) { r = Math.floor(i / C); c = i % C; cellIdx = i; break; }
    if (r === -1) return;
    for (const s of shapes) {
      if (s.count > 0 && canPlace(r, c, s.w, s.l)) {
        const item = s.items[s.count - 1]!;
        place(r, c, s.w, s.l, 1);
        if (hasUncoverable(r, c, s.w, s.l)) { place(r, c, s.w, s.l, 0); continue; }
        s.count--;
        placed.push({ ...item, x: c, y: r, w: s.w, l: s.l });
        bt(cellIdx + 1, cov + s.area);
        placed.pop();
        s.count++;
        place(r, c, s.w, s.l, 0);
        if (stop) return;
      }
    }
    bt(cellIdx + 1, cov);
  };
  bt(0, 0);
  return st;
}

/** round() di Python 3 (arrotondamento bancario). */
function pyRound(x: number): number {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function costoTaglio(grid: Mask, t: number, colonne: number): number {
  const r1 = t - 1 >= 0 && t - 1 < grid.length ? grid[t - 1]! : [];
  const r2 = t >= 0 && t < grid.length ? grid[t]! : [];
  let costo = 0;
  for (let c = 0; c < colonne; c++) {
    if (c < r1.length && r1[c] === 1) costo++;
    if (c < r2.length && r2[c] === 1) costo++;
  }
  return costo;
}
function calcolaConfini(grid: Mask, nRighe: number, nSettori0: number, colonne: number): number[] {
  const nSettori = Math.max(1, Math.min(nSettori0, nRighe));
  if (nSettori === 1) return [0, nRighe];
  const base = nRighe / nSettori;
  const finestra = Math.max(1, Math.floor(base / 2));
  const confini = new Set([0, nRighe]);
  for (let i = 1; i < nSettori; i++) {
    const ideale = pyRound(base * i);
    let mt = ideale, mc = Infinity, md = Infinity;
    for (let t = Math.max(1, ideale - finestra); t <= Math.min(nRighe - 1, ideale + finestra); t++) {
      if (confini.has(t)) continue;
      const costo = costoTaglio(grid, t, colonne), dist = Math.abs(t - ideale);
      if (costo < mc || (costo === mc && dist < md)) { mc = costo; md = dist; mt = t; }
    }
    confini.add(mt);
  }
  return [...confini].sort((a, b) => a - b);
}

const truthy = (v: number | boolean | undefined) => !!v;

function bboxMaschera(m: Mask, x0: number, y0: number, x1: number, y1: number): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = y0; y < y1; y++) {
    const row = y < m.length ? m[y]! : [];
    for (let x = x0; x < x1; x++) if (x < row.length && truthy(row[x])) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return minX === Infinity ? null : [minX, minY, maxX + 1, maxY + 1];
}

function rettangoloMassimoIn(m: Mask, x0: number, y0: number, x1: number, y1: number): Rect | null {
  const hLoc = y1 - y0, wLoc = x1 - x0;
  if (hLoc <= 0 || wLoc <= 0) return null;
  const alt = new Array<number>(wLoc).fill(0);
  let best: [number, number, number, number, number] | null = null;
  for (let y = y0; y < y1; y++) {
    const row = y < m.length ? m[y]! : [];
    for (let xi = 0; xi < wLoc; xi++) {
      const x = x0 + xi;
      alt[xi] = x < row.length && truthy(row[x]) ? alt[xi]! + 1 : 0;
    }
    const stack: Array<[number, number]> = [];
    for (let xi = 0; xi <= wLoc; xi++) {
      const h = xi < wLoc ? alt[xi]! : 0;
      let start = xi;
      while (stack.length && stack[stack.length - 1]![1] > h) {
        const [idx, sh] = stack.pop()!;
        const p = sh * (xi - idx);
        if (best === null || p > best[0]) best = [p, x0 + idx, y - sh + 1, x0 + xi, y + 1];
        start = idx;
      }
      stack.push([start, h]);
    }
  }
  return best === null ? null : [best[1], best[2], best[3], best[4]];
}

function rettangoliMassimali(maschera: Mask, x0: number, y0: number, x1: number, y1: number): Rect[] {
  const m = maschera.map(r => r.slice());
  const out: Rect[] = [];
  for (;;) {
    const r = rettangoloMassimoIn(m, x0, y0, x1, y1);
    if (r === null) break;
    const [rx0, ry0, rx1, ry1] = r;
    if (rx1 <= rx0 || ry1 <= ry0) break;
    if (rx1 - rx0 < DIM_MINIMA_RETTANGOLO || ry1 - ry0 < DIM_MINIMA_RETTANGOLO) break;
    out.push([rx0, ry0, rx1, ry1]);
    for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) m[y]![x] = 0;
  }
  const bb = bboxMaschera(m, x0, y0, x1, y1);
  if (bb) out.push(bb);
  return out;
}

function sottoMascheraPiena(m: Mask, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!truthy(m[y]![x])) return false;
  return true;
}
function bboxAreaLibera(m: Mask, x0: number, y0: number, x1: number, y1: number): [number, number] {
  const bb = bboxMaschera(m, x0, y0, x1, y1);
  return bb ? [bb[2] - bb[0], bb[3] - bb[1]] : [0, 0];
}
function taglioValido(m: Mask, x0: number, y0: number, x1: number, y1: number, tipo: "v" | "h", t: number) {
  const parti = tipo === "v"
    ? [bboxAreaLibera(m, x0, y0, t, y1), bboxAreaLibera(m, t, y0, x1, y1)]
    : [bboxAreaLibera(m, x0, y0, x1, t), bboxAreaLibera(m, x0, t, x1, y1)];
  for (const [w, h] of parti) {
    if (w === 0 && h === 0) continue;
    if (w < DIM_MINIMA_RETTANGOLO || h < DIM_MINIMA_RETTANGOLO) return false;
  }
  return true;
}
function guillotine(m: Mask, x0: number, y0: number, x1: number, y1: number, maxVar: number, prof = 0, maxProf = 12, cache = new Map<string, Rect[]>()): Rect[] {
  const k = `${x0},${y0},${x1},${y1}`;
  const hit = cache.get(k);
  if (hit) return hit;
  let libere = false;
  for (let y = y0; y < y1 && !libere; y++) for (let x = x0; x < x1; x++) if (truthy(m[y]![x])) { libere = true; break; }
  let ris: Rect[];
  if (x1 <= x0 || y1 <= y0 || !libere) ris = [];
  else if (sottoMascheraPiena(m, x0, y0, x1, y1) || prof >= maxProf) ris = [[x0, y0, x1, y1]];
  else {
    let cand: Array<["v" | "h", number]> = [];
    for (let t = x0 + 1; t < x1; t++) {
      for (let y = y0; y < y1; y++) if (m[y]![t - 1] !== m[y]![t]) { cand.push(["v", t]); break; }
    }
    for (let t = y0 + 1; t < y1; t++) {
      for (let x = x0; x < x1; x++) if (m[t - 1]![x] !== m[t]![x]) { cand.push(["h", t]); break; }
    }
    cand = cand.filter(([tipo, t]) => taglioValido(m, x0, y0, x1, y1, tipo, t));
    if (!cand.length) ris = [[x0, y0, x1, y1]];
    else {
      if (cand.length > maxVar) {
        const step = cand.length / maxVar;
        cand = Array.from({ length: maxVar }, (_, i) => cand[Math.floor(i * step)]!);
      }
      let best: Rect[] | null = null;
      for (const [tipo, t] of cand) {
        const tot = tipo === "v"
          ? [...guillotine(m, x0, y0, t, y1, maxVar, prof + 1, maxProf, cache), ...guillotine(m, t, y0, x1, y1, maxVar, prof + 1, maxProf, cache)]
          : [...guillotine(m, x0, y0, x1, t, maxVar, prof + 1, maxProf, cache), ...guillotine(m, x0, t, x1, y1, maxVar, prof + 1, maxProf, cache)];
        if (best === null || tot.length < best.length) best = tot;
      }
      ris = best ?? [[x0, y0, x1, y1]];
    }
  }
  cache.set(k, ris);
  return ris;
}

type Config = { nome: string; tipo: "righe"; nSettori: number } | { nome: string; tipo: "massimali" } | { nome: string; tipo: "guillotine"; maxVarianti: number };
const CONFIGURAZIONI: Config[] = [
  { nome: "righe(2 settori)", tipo: "righe", nSettori: 2 },
  { nome: "righe(3 settori)", tipo: "righe", nSettori: 3 },
  { nome: "righe(4 settori)", tipo: "righe", nSettori: 4 },
  { nome: "massimali(area)", tipo: "massimali" },
  { nome: "guillotine(mv=2)", tipo: "guillotine", maxVarianti: 2 },
  { nome: "guillotine(mv=3)", tipo: "guillotine", maxVarianti: 3 },
];

function zoneStrette(m: Mask, R: number, C: number, poolGrande: PB[]): Array<[number, number]> {
  const soglia = poolGrande.length ? Math.min(...poolGrande.map(b => Math.min(b.width, b.length))) : 2;
  if (soglia <= 1) return [];
  const libero = (r0: number, c0: number) => {
    if (r0 + soglia > R || c0 + soglia > C) return false;
    for (let r = r0; r < r0 + soglia; r++) for (let c = c0; c < c0 + soglia; c++) if (!truthy(m[r]![c])) return false;
    return true;
  };
  const cop = Array.from({ length: R }, () => new Array<boolean>(C).fill(false));
  for (let r0 = 0; r0 < R - soglia + 1; r0++) for (let c0 = 0; c0 < C - soglia + 1; c0++) {
    if (!libero(r0, c0)) continue;
    for (let r = r0; r < r0 + soglia; r++) for (let c = c0; c < c0 + soglia; c++) cop[r]![c] = true;
  }
  const out: Array<[number, number]> = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (truthy(m[r]![c]) && !cop[r]![c]) out.push([r, c]);
  return out;
}
function raggruppa(celle: Array<[number, number]>): Array<Array<[number, number]>> {
  const set = new Set(celle.map(([r, c]) => `${r},${c}`));
  const vis = new Set<string>();
  const gruppi: Array<Array<[number, number]>> = [];
  for (const [r, c] of celle) {
    if (vis.has(`${r},${c}`)) continue;
    const g: Array<[number, number]> = [];
    const stack: Array<[number, number]> = [[r, c]];
    vis.add(`${r},${c}`);
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      g.push([cr, cc]);
      for (const [nr, nc] of [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]] as Array<[number, number]>) {
        const k = `${nr},${nc}`;
        if (set.has(k) && !vis.has(k)) { vis.add(k); stack.push([nr, nc]); }
      }
    }
    gruppi.push(g);
  }
  return gruppi;
}

interface Voce { rett: Rect; soloRifinitura: boolean; celle?: Array<[number, number]> }
function rettangoliPerConfig(cfg: Config, mapGrid: Mask, R: number, C: number, poolGrande: PB[]): Voce[] {
  const strette = zoneStrette(mapGrid, R, C, poolGrande);
  let mn = mapGrid;
  if (strette.length) {
    mn = mapGrid.map(r => r.slice());
    for (const [r, c] of strette) mn[r]![c] = 0;
  }
  let norm: Rect[];
  if (cfg.tipo === "massimali") norm = rettangoliMassimali(mn, 0, 0, C, R);
  else if (cfg.tipo === "guillotine") norm = guillotine(mn, 0, 0, C, R, cfg.maxVarianti);
  else {
    const conf = calcolaConfini(mn, R, cfg.nSettori, C);
    norm = conf.slice(0, -1).map((v, i) => [0, v, C, conf[i + 1]!] as Rect);
  }
  const stretti: Voce[] = raggruppa(strette).map(g => {
    const xs = g.map(([, c]) => c), ys = g.map(([r]) => r);
    return { rett: [Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1], celle: g, soloRifinitura: true };
  });
  return [...norm.map(r => ({ rett: r, soloRifinitura: false })), ...stretti];
}

function rifinisciBuchi(stage: Mask, poolPiccolo: PB[], fast = false): Fase2Placed[] {
  const R = stage.length, C = R ? stage[0]!.length : 0;
  const board: number[][] = stage.map(row => row.map(c => (c === 1 ? 0 : -1)));
  const shapes = shapesOf(poolPiccolo);
  const canPlace = (r: number, c: number, w: number, l: number) => {
    if (r + l > R || c + w > C) return false;
    for (let i = r; i < r + l; i++) for (let j = c; j < c + w; j++) if (board[i]![j] !== 0) return false;
    return true;
  };
  const place = (r: number, c: number, w: number, l: number, v: number) => {
    for (let i = r; i < r + l; i++) for (let j = c; j < c + w; j++) board[i]![j] = v;
  };
  const coverable = (r: number, c: number) => {
    for (const s of shapes) {
      if (s.count <= 0) continue;
      for (let dr = 0; dr < s.l; dr++) {
        const sr = r - dr;
        if (sr < 0 || sr + s.l > R) continue;
        for (let dc = 0; dc < s.w; dc++) {
          const sc = c - dc;
          if (sc < 0 || sc + s.w > C) continue;
          if (canPlace(sr, sc, s.w, s.l)) return true;
        }
      }
    }
    return false;
  };
  const maxW = shapes.reduce((m, s) => Math.max(m, s.w), 1), maxL = shapes.reduce((m, s) => Math.max(m, s.l), 1);
  const hasUncoverable = (pr: number, pc: number, pw: number, pl: number) => {
    const r0 = fast ? Math.max(0, pr - maxL + 1) : 0, r1 = fast ? Math.min(R, pr + pl + maxL - 1) : R;
    const c0 = fast ? Math.max(0, pc - maxW + 1) : 0, c1 = fast ? Math.min(C, pc + pw + maxW - 1) : C;
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) if (board[r]![c] === 0 && !coverable(r, c)) return true;
    return false;
  };
  const uno = (p: Fase2Placed[]) => p.reduce((s, b) => s + (b.w === 1 && b.l === 1 ? 1 : 0), 0);
  let bestCov = 0, bestCount = Infinity, bestOnes = Infinity;
  let bestPlaced: Fase2Placed[] = [];
  let nodi = 0, stop = false;
  const placed: Fase2Placed[] = [];
  const bt = (cellIdx: number, cov: number): void => {
    if (stop) return;
    nodi++;
    if (nodi >= MAX_NODI_RIFINITURA) { stop = true; return; }
    if (cov > bestCov || (cov === bestCov && placed.length < bestCount) || (cov === bestCov && placed.length === bestCount && uno(placed) < bestOnes)) {
      bestCov = cov; bestCount = placed.length; bestOnes = uno(placed); bestPlaced = placed.slice();
    }
    let r = -1, c = -1;
    for (let i = cellIdx; i < R * C; i++) { const tr = Math.floor(i / C), tc = i % C; if (board[tr]![tc] === 0) { r = tr; c = tc; cellIdx = i; break; } }
    if (r === -1) return;
    for (const s of shapes) {
      if (s.count > 0 && canPlace(r, c, s.w, s.l)) {
        const item = s.items[s.count - 1]!;
        place(r, c, s.w, s.l, 1);
        if (hasUncoverable(r, c, s.w, s.l)) { place(r, c, s.w, s.l, 0); continue; }
        s.count--;
        placed.push({ ...item, x: c, y: r, w: s.w, l: s.l });
        bt(cellIdx + 1, cov + s.area);
        placed.pop();
        s.count++;
        place(r, c, s.w, s.l, 0);
        if (stop) return;
      }
    }
    bt(cellIdx + 1, cov);
  };
  bt(0, 0);
  return bestPlaced;
}

export interface StrategyResult {
  nome: string;
  edifici: number;
  edificiPiccoli: number;
  copertura: number;
  nodi: number;
  nRettangoli: number;
  capRaggiunto: boolean;
  placed: Fase2Placed[];
  rettangoli: Rect[];
}

function eseguiPipeline(nome: string, voci: Voce[], raff: number, maxNodi: number, mapGrid: Mask, R: number, C: number, poolGrande: PB[], poolPiccolo: PB[], fast = false): StrategyResult {
  const used = new Set<string>();
  const usate = Array.from({ length: R }, () => new Array<boolean>(C).fill(false));
  const tot: Fase2Placed[] = [];
  let nodi = 0, cap = false;
  const libera = (ry: number, rx: number) => ry < mapGrid.length && rx < mapGrid[ry]!.length && mapGrid[ry]![rx] === 1 && !usate[ry]![rx];
  const applica = (pl: Fase2Placed[], x0: number, y0: number, rif: boolean) => {
    for (const b of pl) {
      b.x += x0; b.y += y0;
      if (rif) b.daRifinitura = true;
      used.add(b.id);
      for (let yy = b.y; yy < b.y + b.l; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) usate[yy]![xx] = true;
    }
    tot.push(...pl);
  };
  for (const v of voci) {
    const [x0, y0, x1, y1] = v.rett;
    if (v.soloRifinitura) {
      const cg = new Set((v.celle ?? []).map(([r, c]) => `${r},${c}`));
      const stage: Mask = [];
      for (let ry = y0; ry < y1; ry++) {
        const row: number[] = [];
        for (let rx = x0; rx < x1; rx++) row.push(cg.has(`${ry},${rx}`) && libera(ry, rx) ? 1 : 0);
        stage.push(row);
      }
      if (poolPiccolo.length) applica(rifinisciBuchi(stage, poolPiccolo.filter(b => !used.has(b.id)), fast), x0, y0, true);
      continue;
    }
    const stage: Mask = [];
    for (let ry = y0; ry < y1; ry++) {
      const row: number[] = [];
      for (let rx = x0; rx < x1; rx++) row.push(libera(ry, rx) ? 1 : 0);
      stage.push(row);
    }
    const valid = stage.reduce((s, r) => s + r.filter(c => c === 1).length, 0);
    const res = backtrackRiempimento(stage, poolGrande.filter(b => !used.has(b.id)), valid, raff, maxNodi, fast);
    nodi += res.nodeCount;
    if (res.capRaggiunto) cap = true;
    applica(res.placed, x0, y0, false);
    if (res.bestCov < valid && poolPiccolo.length) {
      const st2: Mask = [];
      for (let ry = y0; ry < y1; ry++) {
        const row: number[] = [];
        for (let rx = x0; rx < x1; rx++) row.push(libera(ry, rx) ? 1 : 0);
        st2.push(row);
      }
      applica(rifinisciBuchi(st2, poolPiccolo.filter(b => !used.has(b.id)), fast), x0, y0, true);
    }
  }
  return {
    nome, edifici: tot.length, edificiPiccoli: tot.filter(b => b.daRifinitura).length,
    copertura: tot.reduce((s, b) => s + b.w * b.l, 0), nodi, nRettangoli: voci.length, capRaggiunto: cap,
    placed: tot, rettangoli: voci.map(v => v.rett),
  };
}

/** Il cuore di fase2 su una maschera qualsiasi (1 = cella libera): le 6
 *  strategie e il vincitore. null se il pool non ha pezzi "grandi" (w>1, l>1). */
export function fillMask(grid: Mask, pool: PoolItem[], raffinamento = 4096, maxNodi = 3000, fast = false): { vincitore: StrategyResult; strategie: StrategyResult[] } | null {
  const R = grid.length, C = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const [poolGrande, poolPiccolo] = normalizzaPool(pool);
  if (!poolGrande.length) return null;
  const strategie = CONFIGURAZIONI.map(cfg =>
    eseguiPipeline(cfg.nome, rettangoliPerConfig(cfg, grid, R, C, poolGrande), raffinamento, maxNodi, grid, R, C, poolGrande, poolPiccolo, fast));
  const cmp = (a: StrategyResult, b: StrategyResult) =>
    (b.copertura - a.copertura) || (a.edificiPiccoli - b.edificiPiccoli) || (a.edifici - b.edifici);
  return { vincitore: [...strategie].sort(cmp)[0]!, strategie };
}
