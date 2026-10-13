// ─────────────────────────────────────────────────────────────────────────────
//  planner/smussa.ts — "Smussa i bordi" (idea dell'utente)
//
//  Dopo la ricerca degli edifici con strada (in pausa), prima del
//  riempimento: si spostano/scambiano gli edifici con strada per ridurre gli
//  angoli di 90° del contorno della città (contaAngoliGriglia), così il
//  riempimento finale incastra meglio i pezzi piccoli. Ciclo continuo finché
//  l'utente non lo ferma.
//
//  Vincoli rigidi: strade invariate; ogni edificio con strada resta
//  collegato; nessun edificio problematico in più (road_eff degli edifici
//  mossi: né più positivi né somma maggiore); municipio e fissi di fase 1
//  fermi; edifici senza strada fermi.
//  Obiettivo: meno angoli + celle di buco, poi meno perimetro esposto. Buco
//  = cella libera che nessun edificio senza strada (lati >= 2) ancora da
//  piazzare può coprire (es. un 2×1 fra due edifici, segnalato dall'utente su
//  Beta r3: a 37 angoli restava un 2×1 inutilizzabile; scambiando un 4×4 con
//  due 2×3 si avevano 37 angoli senza buco). Il cammino accetta
//  anche mosse a pari punteggio (per uscire dagli stalli); si mostra e si
//  restituisce sempre la migliore.
//  Mosse: scorrimento di 1-3 celle; "spinta" (lo scorrimento sposta anche
//  gli edifici che incontra, fino a 6); scambio di due edifici vicini
//  (allineati a uno degli angoli del posto dell'altro); spostamento nel posto
//  MIGLIORE fra tutti quelli liberi accanto a una strada; spostamento in un
//  posto a caso accanto a una strada. Ogni tanto si accetta una mossa che
//  peggiora di 1-2 angoli (per uscire dai minimi locali: l'utente su Beta r3
//  arrivava a 39 a mano, il cammino "mai peggio" si fermava a 43).
// ─────────────────────────────────────────────────────────────────────────────

import type { PlannerBuilding, PlannerFrame, PlannerProblem } from "./engine";
import { contaAngoliGriglia, esclusoDaRoadEff, roadEffDi } from "./roadEff";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface SmussaOptions {
  /** Edifici da non spostare (fissi di fase 1). Il municipio è sempre fermo. */
  fissi: ReadonlySet<string>;
  onFrame: (f: PlannerFrame) => void;
  shouldStop: () => boolean;
}

export async function smussaBordi(problem: PlannerProblem, start: { placements: ReadonlyMap<string, { x: number; y: number }>; roads: ReadonlySet<string> }, opts: SmussaOptions): Promise<PlannerFrame> {
  const W = problem.maxX - problem.minX + 1, H = problem.maxY - problem.minY + 1;
  const gi = (x: number, y: number) => { const i = x - problem.minX, j = y - problem.minY; return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
  const cell = new Uint8Array(W * H), road = new Uint8Array(W * H), occ = new Uint8Array(W * H);
  for (const k of problem.cells) { const c = k.indexOf(","), g = gi(Number(k.slice(0, c)), Number(k.slice(c + 1))); if (g >= 0) cell[g] = 1; }
  const roadKeys = [...start.roads];
  for (const k of roadKeys) { const c = k.indexOf(","), g = gi(Number(k.slice(0, c)), Number(k.slice(c + 1))); if (g >= 0) { road[g] = 1; occ[g] = 1; } }
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  const pos = new Map<string, { x: number; y: number }>();
  const rect = (x: number, y: number, w: number, h: number, v: 0 | 1) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { const g = gi(x + dx, y + dy); if (g >= 0) occ[g] = v; } };
  for (const [id, q] of start.placements) { const b = byId.get(id); if (!b) continue; pos.set(id, { x: q.x, y: q.y }); rect(q.x, q.y, b.w, b.h, 1); }
  const mobili = [...pos.keys()].map(id => byId.get(id)!).filter(b => !b.isTownhall && b.roadLevel > 0 && !opts.fissi.has(b.id));
  const mobile = new Set(mobili.map(b => b.id));
  /** Edifici (id) che occupano celle del rettangolo, esclusi quelli in `salta`. */
  const sotto = (x: number, y: number, w: number, h: number, salta: Set<string>): string[] | null => {
    const out: string[] = [];
    for (const [id, q] of pos) {
      if (salta.has(id)) continue;
      const b = byId.get(id)!;
      if (q.x < x + w && q.x + b.w > x && q.y < y + h && q.y + b.h > y) out.push(id);
    }
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (isR(x + dx, y + dy)) return null;
    return out;
  };

  const isR = (x: number, y: number) => { const g = gi(x, y); return g >= 0 && road[g] === 1; };
  const tocca = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) if (isR(x + dx, y - 1) || isR(x + dx, y + h)) return true;
    for (let dy = 0; dy < h; dy++) if (isR(x - 1, y + dy) || isR(x + w, y + dy)) return true;
    return false;
  };
  const libero = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { const g = gi(x + dx, y + dy); if (g < 0 || cell[g] !== 1 || occ[g] === 1) return false; }
    return true;
  };
  const eff = (b: PlannerBuilding, x: number, y: number) => esclusoDaRoadEff(b, x, y, isR) ? 0 : Math.max(0, roadEffDi(x, y, b.w, b.h, isR).eff);
  const perimetro = () => {
    let p = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const g = j * W + i;
      if (occ[g] !== 1) continue;
      if (i > 0 && cell[g - 1] === 1 && occ[g - 1] !== 1) p++;
      if (i < W - 1 && cell[g + 1] === 1 && occ[g + 1] !== 1) p++;
      if (j > 0 && cell[g - W] === 1 && occ[g - W] !== 1) p++;
      if (j < H - 1 && cell[g + W] === 1 && occ[g + W] !== 1) p++;
    }
    return p;
  };
  // Forme minime degli edifici senza strada da piazzare (lati >= 2): una
  // cella coperta da una forma più grande lo è anche da una minima contenuta.
  const forme: Array<[number, number]> = [];
  for (const b of problem.buildings) {
    if (b.isTownhall || b.roadLevel > 0 || start.placements.has(b.id) || b.w < 2 || b.h < 2) continue;
    if (!forme.some(([w, h]) => w === b.w && h === b.h)) forme.push([b.w, b.h]);
  }
  const minime = forme.filter(([w, h]) => !forme.some(([w2, h2]) => (w2 !== w || h2 !== h) && w2 <= w && h2 <= h));
  const W1 = W + 1, pref = new Int32Array(W1 * (H + 1)), diff = new Int32Array(W1 * (H + 1));
  /** Celle libere sbloccate che nessuna forma minima può coprire. */
  const buchi = () => {
    if (!minime.length) return 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const g = j * W + i, v = cell[g] === 1 && occ[g] !== 1 ? 1 : 0;
      pref[(j + 1) * W1 + i + 1] = v + pref[j * W1 + i + 1]! + pref[(j + 1) * W1 + i]! - pref[j * W1 + i]!;
    }
    diff.fill(0);
    for (const [w, h] of minime) for (let j = 0; j + h <= H; j++) for (let i = 0; i + w <= W; i++) {
      const somma = pref[(j + h) * W1 + i + w]! - pref[j * W1 + i + w]! - pref[(j + h) * W1 + i]! + pref[j * W1 + i]!;
      if (somma !== w * h) continue;
      diff[j * W1 + i]!++; diff[j * W1 + i + w]!--; diff[(j + h) * W1 + i]!--; diff[(j + h) * W1 + i + w]!++;
    }
    let n = 0;
    // somma 2D delle differenze in-place (riusa pref come accumulatore)
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = diff[j * W1 + i]! + (i > 0 ? pref[j * W1 + i - 1]! : 0) + (j > 0 ? pref[(j - 1) * W1 + i]! : 0) - (i > 0 && j > 0 ? pref[(j - 1) * W1 + i - 1]! : 0);
      pref[j * W1 + i] = c;
      const g = j * W + i;
      if (cell[g] === 1 && occ[g] !== 1 && c <= 0) n++;
    }
    return n;
  };
  /** [angoli + celle di buco, perimetro, angoli, buchi]: si confrontano i primi due. */
  type Punti = [number, number, number, number];
  const punti = (): Punti => { const a = contaAngoliGriglia(occ, cell, W, H), b = buchi(); return [a + b, perimetro(), a, b]; };
  const cmp = (a: Punti, b: Punti) => a[0] - b[0] || a[1] - b[1];

  /** Prova a spostare gli edifici `mosse` (id → nuova posizione); se valida
   *  e non peggiore di `soglia` la applica e restituisce il punteggio. */
  const prova = (mosse: Array<[PlannerBuilding, number, number]>, soglia: Punti): Punti | null => {
    let effPrima = 0, nPrima = 0;
    for (const [b] of mosse) { const q = pos.get(b.id)!; const e = eff(b, q.x, q.y); effPrima += e; if (e > 0) nPrima++; }
    for (const [b] of mosse) { const q = pos.get(b.id)!; rect(q.x, q.y, b.w, b.h, 0); }
    let ok = true, effDopo = 0, nDopo = 0;
    const fatti: Array<[PlannerBuilding, number, number]> = [];
    for (const [b, x, y] of mosse) {
      if (!libero(x, y, b.w, b.h) || !tocca(x, y, b.w, b.h)) { ok = false; break; }
      rect(x, y, b.w, b.h, 1); fatti.push([b, x, y]);
      const e = eff(b, x, y); effDopo += e; if (e > 0) nDopo++;
    }
    let pt: Punti | null = null;
    if (ok && nDopo <= nPrima && effDopo <= effPrima) { pt = punti(); if (cmp(pt, soglia) > 0) pt = null; }
    if (pt) { for (const [b, x, y] of mosse) pos.set(b.id, { x, y }); return pt; }
    for (const [b, x, y] of fatti) rect(x, y, b.w, b.h, 0);
    for (const [b] of mosse) { const q = pos.get(b.id)!; rect(q.x, q.y, b.w, b.h, 1); }
    return null;
  };

  let corrente = punti();
  let migliore = { pt: corrente, pos: new Map(pos) };
  const iniziale = corrente;
  let tentativi = 0, senzaMigliorare = 0;
  const frame = (stato: string): PlannerFrame => ({
    placements: new Map(migliore.pos), roads: new Set(start.roads), probe: null, lastPath: [],
    placed: migliore.pos.size, unplaced: [], iterations: tentativi, done: false,
    label: `Smussa i bordi · angoli ${migliore.pt[2]} (all'inizio ${iniziale[2]}) · buchi ${migliore.pt[3]} (all'inizio ${iniziale[3]}) · perimetro ${migliore.pt[1]} · ${tentativi.toLocaleString()} tentativi${stato}`,
  });
  const ripristina = (m: Map<string, { x: number; y: number }>) => {
    for (const [id, q] of pos) { const b = byId.get(id)!; rect(q.x, q.y, b.w, b.h, 0); }
    for (const k of roadKeys) { const c = k.indexOf(","), g = gi(Number(k.slice(0, c)), Number(k.slice(c + 1))); if (g >= 0) occ[g] = 1; }
    pos.clear();
    for (const [id, q] of m) { const b = byId.get(id)!; pos.set(id, { x: q.x, y: q.y }); rect(q.x, q.y, b.w, b.h, 1); }
  };
  const rnd = (n: number) => Math.floor(Math.random() * n);
  opts.onFrame(frame(""));
  if (!mobili.length) return { ...frame(" · niente da spostare"), done: true };
  let lastYield = performance.now(), lastShow = performance.now();
  while (!opts.shouldStop()) {
    tentativi++;
    if (++senzaMigliorare > 2000) { ripristina(migliore.pos); corrente = migliore.pt; senzaMigliorare = 0; }
    const b = mobili[rnd(mobili.length)]!;
    const q = pos.get(b.id)!;
    const u = Math.random();
    let pt: Punti | null = null;
    // Di solito non peggiore della corrente; ogni tanto fino a +1/+2 angoli.
    const a = Math.random();
    const soglia: Punti = a < 0.003 ? [corrente[0] + 2, Infinity, 0, 0] : a < 0.02 ? [corrente[0] + 1, Infinity, 0, 0] : corrente;
    if (u < 0.4) {
      // Scorrimento di 1-3 celle in una direzione.
      const d = 1 + rnd(3), dir = rnd(4);
      const [dx, dy] = dir === 0 ? [d, 0] : dir === 1 ? [-d, 0] : dir === 2 ? [0, d] : [0, -d];
      pt = prova([[b, q.x + dx, q.y + dy]], soglia);
    } else if (u < 0.55) {
      // Spinta: lo scorrimento di 1-2 celle sposta anche gli edifici che incontra.
      const d = 1 + rnd(2), dir = rnd(4);
      const [dx, dy] = dir === 0 ? [d, 0] : dir === 1 ? [-d, 0] : dir === 2 ? [0, d] : [0, -d];
      const gruppo = new Set<string>([b.id]);
      const coda = [b.id];
      let ok = true;
      while (coda.length && ok) {
        const id = coda.pop()!, c = byId.get(id)!, p = pos.get(id)!;
        const altri = sotto(p.x + dx, p.y + dy, c.w, c.h, gruppo);
        if (!altri) { ok = false; break; }
        for (const a of altri) {
          if (!mobile.has(a) || gruppo.size >= 6) { ok = false; break; }
          gruppo.add(a); coda.push(a);
        }
      }
      if (ok && gruppo.size > 1) pt = prova([...gruppo].map(id => { const p = pos.get(id)!; return [byId.get(id)!, p.x + dx, p.y + dy] as [PlannerBuilding, number, number]; }), soglia);
    } else if (u < 0.8) {
      // Scambio con un edificio vicino (allineato a un angolo del posto dell'altro).
      const vicini = mobili.filter(c => c !== b && Math.abs(pos.get(c.id)!.x - q.x) + Math.abs(pos.get(c.id)!.y - q.y) <= 14);
      const c = vicini[rnd(vicini.length)];
      if (c) {
        const p = pos.get(c.id)!;
        const angoli = (o: { x: number; y: number }, ow: number, oh: number, w: number, h: number): Array<[number, number]> =>
          [[o.x, o.y], [o.x + ow - w, o.y], [o.x, o.y + oh - h], [o.x + ow - w, o.y + oh - h]];
        let migl: Punti | null = null;
        const prove: Array<[number, number, number, number]> = [];
        for (const [bx, by] of angoli(p, c.w, c.h, b.w, b.h)) for (const [cx, cy] of angoli(q, b.w, b.h, c.w, c.h)) prove.push([bx, by, cx, cy]);
        for (const [bx, by, cx, cy] of prove.sort(() => Math.random() - 0.5).slice(0, 6)) {
          const r = prova([[b, bx, by], [c, cx, cy]], migl ?? soglia);
          if (r) { migl = r; break; }
        }
        pt = migl;
      }
    } else if (u < 0.805) {
      // Ricomposizione: 2-3 edifici vicini (b e i più vicini) tolti e
      // ripiazzati uno alla volta nel posto migliore accanto a una strada
      // entro 10 celle, provando tutti gli ordini (es. un 4×4 che scambia
      // posto con due 2×3: idea dell'utente su Beta r3).
      const k = 2 + rnd(2);
      const cx = q.x + b.w / 2, cy = q.y + b.h / 2;
      const dist = (c: PlannerBuilding) => { const p = pos.get(c.id)!; return Math.abs(p.x + c.w / 2 - cx) + Math.abs(p.y + c.h / 2 - cy); };
      const gruppo = [b, ...mobili.filter(c => c !== b && dist(c) <= 10).sort((c1, c2) => dist(c1) - dist(c2)).slice(0, k - 1)];
      if (gruppo.length >= 2) {
        const orig = gruppo.map(c => ({ c, ...pos.get(c.id)! }));
        let effPrima = 0, nPrima = 0;
        for (const o of orig) { const e = eff(o.c, o.x, o.y); effPrima += e; if (e > 0) nPrima++; }
        for (const o of orig) rect(o.x, o.y, o.c.w, o.c.h, 0);
        const ordini = gruppo.length === 2 ? [[0, 1], [1, 0]] : [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
        let migl: { pt: Punti; posti: Array<[PlannerBuilding, number, number]> } | null = null;
        for (const ord of ordini) {
          const posti: Array<[PlannerBuilding, number, number]> = [];
          for (const i of ord) {
            const c = gruppo[i]!;
            let scelto: { x: number; y: number; pt: Punti } | null = null;
            for (const kr of roadKeys) {
              const ci = kr.indexOf(","), rx = Number(kr.slice(0, ci)), ry = Number(kr.slice(ci + 1));
              if (Math.abs(rx - cx) + Math.abs(ry - cy) > 7) continue;
              const cand: Array<[number, number]> = [];
              for (let o = 0; o < c.w; o++) { cand.push([rx - o, ry + 1], [rx - o, ry - c.h]); }
              for (let o = 0; o < c.h; o++) { cand.push([rx + 1, ry - o], [rx - c.w, ry - o]); }
              for (const [x, y] of cand) {
                if (!libero(x, y, c.w, c.h)) continue;
                rect(x, y, c.w, c.h, 1);
                const pt = punti();
                rect(x, y, c.w, c.h, 0);
                if (!scelto || cmp(pt, scelto.pt) < 0) scelto = { x, y, pt };
              }
            }
            if (!scelto) break;
            rect(scelto.x, scelto.y, c.w, c.h, 1);
            posti.push([c, scelto.x, scelto.y]);
          }
          if (posti.length === gruppo.length) {
            let effDopo = 0, nDopo = 0;
            for (const [c, x, y] of posti) { const e = eff(c, x, y); effDopo += e; if (e > 0) nDopo++; }
            const pt = punti();
            if (nDopo <= nPrima && effDopo <= effPrima && (!migl || cmp(pt, migl.pt) < 0)) migl = { pt, posti: [...posti] };
          }
          for (const [c, x, y] of posti) rect(x, y, c.w, c.h, 0);
        }
        if (migl && cmp(migl.pt, soglia) <= 0 && orig.some(o => { const n = migl!.posti.find(t => t[0] === o.c)!; return n[1] !== o.x || n[2] !== o.y; })) {
          for (const [c, x, y] of migl.posti) { rect(x, y, c.w, c.h, 1); pos.set(c.id, { x, y }); }
          pt = migl.pt;
        } else for (const o of orig) rect(o.x, o.y, o.c.w, o.c.h, 1);
      }
    } else if (u < 0.87) {
      // Il posto MIGLIORE fra tutti quelli liberi accanto a una strada.
      rect(q.x, q.y, b.w, b.h, 0);
      const cand: Array<[number, number]> = [];
      const visti = new Set<number>();
      for (const k of roadKeys) {
        const c = k.indexOf(","), rx = Number(k.slice(0, c)), ry = Number(k.slice(c + 1));
        const add = (x: number, y: number) => { const h = (x - problem.minX + 1) * 100003 + (y - problem.minY + 1); if (!visti.has(h)) { visti.add(h); if (libero(x, y, b.w, b.h)) cand.push([x, y]); } };
        for (let o = 0; o < b.w; o++) { add(rx - o, ry + 1); add(rx - o, ry - b.h); }
        for (let o = 0; o < b.h; o++) { add(rx + 1, ry - o); add(rx - b.w, ry - o); }
      }
      rect(q.x, q.y, b.w, b.h, 1);
      let migl: { pt: Punti; x: number; y: number } | null = null;
      for (const [x, y] of cand) {
        if (x === q.x && y === q.y) continue;
        const r = prova([[b, x, y]], migl ? migl.pt : soglia);
        if (r) {
          migl = { pt: r, x, y };
          // si annulla per provare gli altri: si riapplica il migliore alla fine
          rect(x, y, b.w, b.h, 0); pos.set(b.id, { x: q.x, y: q.y }); rect(q.x, q.y, b.w, b.h, 1);
        }
      }
      if (migl) pt = prova([[b, migl.x, migl.y]], migl.pt);
    } else {
      // Spostamento in un posto libero accanto a una strada qualsiasi.
      const k = roadKeys[rnd(roadKeys.length)]!;
      const c = k.indexOf(","), rx = Number(k.slice(0, c)), ry = Number(k.slice(c + 1));
      const lato = rnd(4);
      const x = lato === 0 ? rx + 1 : lato === 1 ? rx - b.w : rx - rnd(b.w);
      const y = lato === 2 ? ry + 1 : lato === 3 ? ry - b.h : ry - rnd(b.h);
      pt = prova([[b, x, y]], soglia);
    }
    if (pt) {
      corrente = pt;
      if (cmp(pt, migliore.pt) < 0) { migliore = { pt, pos: new Map(pos) }; senzaMigliorare = 0; opts.onFrame(frame("")); lastShow = performance.now(); }
    }
    const now = performance.now();
    if (now - lastShow > 500) { opts.onFrame(frame("")); lastShow = now; }
    if (now - lastYield > 40) { await sleep(0); lastYield = performance.now(); }
  }
  const fin = { ...frame(" · fermata"), done: true };
  opts.onFrame(fin);
  return fin;
}
