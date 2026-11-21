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

import { toccaStradaZona, type PlannerBuilding, type PlannerFrame, type PlannerProblem } from "./engine";
import { contaAngoliGriglia, esclusoDaRoadEff, roadEffDi } from "./roadEff";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Anelli spostabili fra catene dello stesso tipo (21/11/2026): stessa forma
 *  di StrumentiCatene in catene.ts, che qui non si importa (legge i dati di
 *  gioco, assenti nei worker dove Smussa gira come "scossa"). */
export interface CateneSmussa {
  gruppi: ReadonlyArray<{ catena: string; teste: ReadonlyArray<{ voce: string; testa: string; anelli: readonly string[] }> }>;
  forma: (testa: string, anelli: readonly string[]) => { w: number; h: number; pezzi: Array<{ id: string; x: number; y: number }> } | null;
  ricomponi: (pos: ReadonlyMap<string, { x: number; y: number }>) => { rag: unknown; placements: Map<string, { x: number; y: number }>; voci: ReadonlySet<string> } | null;
}

export interface SmussaOptions {
  /** Edifici da non spostare (fissi di fase 1). Il municipio è sempre fermo. */
  fissi: ReadonlySet<string>;
  onFrame: (f: PlannerFrame) => void;
  shouldStop: () => boolean;
  /** Con le catene: anche la mossa "anello" (l'ultimo anello di una catena, o
   *  gli ultimi 2-3, passa in punta a un'altra catena dello stesso tipo; gli
   *  inizi restano fermi). Quando la migliore ha catene diverse da quelle di
   *  partenza, i fotogrammi hanno gli id del nuovo raggruppamento, comunicato
   *  prima con `onCatene`. */
  catene?: CateneSmussa;
  onCatene?: (rag: unknown) => void;
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
  const rect = (x: number, y: number, w: number, h: number, v: 0 | 1) => {
    // (solo la parte dentro la griglia, senza ricalcolare l'indice cella per cella)
    const i0 = Math.max(0, x - problem.minX), i1 = Math.min(W, x - problem.minX + w), j0 = Math.max(0, y - problem.minY), j1 = Math.min(H, y - problem.minY + h);
    for (let j = j0; j < j1; j++) { const r = j * W; for (let i = i0; i < i1; i++) occ[r + i] = v; }
  };
  for (const [id, q] of start.placements) { const b = byId.get(id); if (!b) continue; pos.set(id, { x: q.x, y: q.y }); rect(q.x, q.y, b.w, b.h, 1); }
  // Catene con anelli spostabili (opts.catene): solo i gruppi con tutti gli
  // inizi piazzati e spostabili. Le voci delle catene sono copie (dimensioni e
  // zona di strada cambiano con gli anelli); gli id restano quelli di partenza
  // fino al fotogramma, dove si ricompongono (catene.ricomponi).
  type Testa = { voce: string; testa: string; anelli: string[]; pezzi: Array<{ id: string; x: number; y: number }> };
  const teste = new Map<string, Testa>();
  const gruppiT: Testa[][] = [];
  if (opts.catene) for (const g of opts.catene.gruppi) {
    if (!g.teste.every(t => pos.has(t.voce) && !opts.fissi.has(t.voce) && byId.get(t.voce)?.roadLevel === 1)) continue;
    const lista: Testa[] = [];
    for (const t of g.teste) {
      const f = opts.catene.forma(t.testa, t.anelli), b = byId.get(t.voce)!;
      if (!f || f.w !== b.w || f.h !== b.h) { lista.length = 0; break; }
      lista.push({ voce: t.voce, testa: t.testa, anelli: [...t.anelli], pezzi: f.pezzi });
    }
    if (lista.length < 2) continue;
    for (const t of lista) {
      const solo = opts.catene.forma(t.testa, [])!;
      const p0 = t.pezzi[0]!;
      byId.set(t.voce, { ...byId.get(t.voce)!, zonaStrada: { x: p0.x, y: p0.y, w: solo.w, h: solo.h } });
      teste.set(t.voce, t);
    }
    gruppiT.push(lista);
  }
  /** Composizione (voce → anelli) per la migliore e per il ripristino. */
  const composizione = () => new Map([...teste.values()].map(t => [t.voce, [...t.anelli]] as const));
  const composizione0 = composizione();
  const firmaComp = (c: ReadonlyMap<string, readonly string[]>) => [...c].map(([v, a]) => `${v}:${a.join(",")}`).join(";");
  const firma0 = firmaComp(composizione0);
  /** Imposta gli anelli di una testa (dimensioni della voce e zona di strada). */
  const componi = (t: Testa, anelli: string[]) => {
    const f = opts.catene!.forma(t.testa, anelli)!;
    const b = byId.get(t.voce)!, p0 = f.pezzi[0]!;
    b.w = f.w; b.h = f.h; b.zonaStrada = { ...b.zonaStrada!, x: p0.x, y: p0.y };
    t.anelli = anelli; t.pezzi = f.pezzi;
  };
  // (mai gli edifici a due corsie: devono restare accanto ai blocchi 2×2 — Smussa
  // ne spostava uno su una strada semplice, segnalazione dell'utente)
  const mobili = [...pos.keys()].map(id => byId.get(id)!).filter(b => !b.isTownhall && b.roadLevel > 0 && b.roadLevel < 2 && !opts.fissi.has(b.id));
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
    const i0 = x - problem.minX, j0 = y - problem.minY;
    if (i0 < 0 || j0 < 0 || i0 + w > W || j0 + h > H) return false;
    for (let dy = 0; dy < h; dy++) { const r = (j0 + dy) * W + i0; for (let dx = 0; dx < w; dx++) if (cell[r + dx] !== 1 || occ[r + dx] === 1) return false; }
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

  // ── Punteggio incrementale (ottimizzazione): una mossa cambia angoli,
  // perimetro e buchi solo vicino ai rettangoli toccati (posti vecchi e
  // nuovi). Si sommano i contributi locali prima e dopo la mossa.
  /** Angolo all'incrocio (i, j) della griglia (0..W, 0..H): 0, 1 o 2. */
  const angoloPt = (i: number, j: number) => {
    const ga = j > 0 && i > 0 ? (j - 1) * W + i - 1 : -1, gb = j > 0 && i < W ? (j - 1) * W + i : -1;
    const gc = j < H && i > 0 ? j * W + i - 1 : -1, gd = j < H && i < W ? j * W + i : -1;
    const a = ga >= 0 && occ[ga] === 1, b = gb >= 0 && occ[gb] === 1, c = gc >= 0 && occ[gc] === 1, d = gd >= 0 && occ[gd] === 1;
    const k = (a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0) + (d ? 1 : 0);
    if (k === 0 || k === 4) return 0;
    if ((!a && (ga < 0 || cell[ga] !== 1)) || (!b && (gb < 0 || cell[gb] !== 1)) || (!c && (gc < 0 || cell[gc] !== 1)) || (!d && (gd < 0 || cell[gd] !== 1))) return 0;
    if (k === 2) return a === d ? 2 : 0;
    return 1;
  };
  const perimCella = (i: number, j: number) => {
    const g = j * W + i;
    if (occ[g] !== 1) return 0;
    let p = 0;
    if (i > 0 && cell[g - 1] === 1 && occ[g - 1] !== 1) p++;
    if (i < W - 1 && cell[g + 1] === 1 && occ[g + 1] !== 1) p++;
    if (j > 0 && cell[g - W] === 1 && occ[g - W] !== 1) p++;
    if (j < H - 1 && cell[g + W] === 1 && occ[g + W] !== 1) p++;
    return p;
  };
  const liberaC = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && cell[j * W + i] === 1 && occ[j * W + i] !== 1;
  const finestra = (i0: number, j0: number, w: number, h: number) => {
    // (un solo controllo dei bordi per finestra, poi le celle lette direttamente)
    if (i0 < 0 || j0 < 0 || i0 + w > W || j0 + h > H) return false;
    for (let dj = 0; dj < h; dj++) { const g0 = (j0 + dj) * W + i0; for (let di = 0; di < w; di++) if (cell[g0 + di] !== 1 || occ[g0 + di] === 1) return false; }
    return true;
  };
  /** La cella (i, j) è un buco: libera ma nessuna forma minima la copre. */
  const bucoC = (i: number, j: number) => {
    if (!liberaC(i, j)) return 0;
    for (const [w, h] of minime) for (let j0 = j - h + 1; j0 <= j; j0++) for (let i0 = i - w + 1; i0 <= i; i0++) if (finestra(i0, j0, w, h)) return 0;
    return 1;
  };
  const S = minime.reduce((m, [w, h]) => Math.max(m, w, h), 1);
  const timbroP = new Int32Array((W + 1) * (H + 1)), timbroC = new Int32Array(W * H), timbroB = new Int32Array(W * H);
  let timbro = 0;
  /** Contributi locali [angoli, perimetro, buchi] attorno ai rettangoli (coordinate di gioco). */
  // (17/11/2026) I contributi si accumulano in La / Lp / Lb: `locale1` (un solo
  // rettangolo, il caso dei cicli più caldi) non crea nessun oggetto; `locale`
  // resta per i gruppi di rettangoli. Stessi numeri di prima.
  let La = 0, Lp = 0, Lb = 0;
  const accumula = (x: number, y: number, w: number, h: number) => {
    const i0 = x - problem.minX, j0 = y - problem.minY;
    for (let j = Math.max(0, j0); j <= Math.min(H, j0 + h); j++) for (let i = Math.max(0, i0); i <= Math.min(W, i0 + w); i++) {
      const t = j * (W + 1) + i;
      if (timbroP[t] === timbro) continue;
      timbroP[t] = timbro; La += angoloPt(i, j);
    }
    for (let j = Math.max(0, j0 - 1); j <= Math.min(H - 1, j0 + h); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(W - 1, i0 + w); i++) {
      const g = j * W + i;
      if (timbroC[g] === timbro) continue;
      timbroC[g] = timbro; Lp += perimCella(i, j);
    }
    if (minime.length) for (let j = Math.max(0, j0 - S + 1); j <= Math.min(H - 1, j0 + h - 1 + S - 1); j++) for (let i = Math.max(0, i0 - S + 1); i <= Math.min(W - 1, i0 + w - 1 + S - 1); i++) {
      const g = j * W + i;
      if (timbroB[g] === timbro) continue;
      timbroB[g] = timbro; Lb += bucoC(i, j);
    }
  };
  const locale = (rett: Array<[number, number, number, number]>): [number, number, number] => {
    timbro++; La = 0; Lp = 0; Lb = 0;
    for (const [x, y, w, h] of rett) accumula(x, y, w, h);
    return [La, Lp, Lb];
  };
  /** Come `locale` per un solo rettangolo: il risultato resta in La, Lp, Lb. */
  const locale1 = (x: number, y: number, w: number, h: number) => {
    // (un rettangolo solo: nessuna cella può essere contata due volte, quindi niente timbri)
    let a = 0, p = 0, bu = 0;
    const i0 = x - problem.minX, j0 = y - problem.minY;
    for (let j = Math.max(0, j0), j1 = Math.min(H, j0 + h); j <= j1; j++) for (let i = Math.max(0, i0), i1 = Math.min(W, i0 + w); i <= i1; i++) a += angoloPt(i, j);
    for (let j = Math.max(0, j0 - 1), j1 = Math.min(H - 1, j0 + h); j <= j1; j++) for (let i = Math.max(0, i0 - 1), i1 = Math.min(W - 1, i0 + w); i <= i1; i++) p += perimCella(i, j);
    if (minime.length) for (let j = Math.max(0, j0 - S + 1), j1 = Math.min(H - 1, j0 + h - 1 + S - 1); j <= j1; j++) for (let i = Math.max(0, i0 - S + 1), i1 = Math.min(W - 1, i0 + w - 1 + S - 1); i <= i1; i++) bu += bucoC(i, j);
    La = a; Lp = p; Lb = bu;
  };

  /** Cambia un rettangolo (v = 1 occupa, 0 libera) aggiornando il punteggio
   *  `sc` = [angoli, perimetro, buchi] in modo incrementale. */
  const rettSc = (x: number, y: number, w: number, h: number, v: 0 | 1, sc: [number, number, number]) => {
    locale1(x, y, w, h);
    const a0 = La, p0 = Lp, b0 = Lb;
    rect(x, y, w, h, v);
    locale1(x, y, w, h);
    sc[0] += La - a0; sc[1] += Lp - p0; sc[2] += Lb - b0;
  };
  const comePunti = (sc: [number, number, number]): Punti => [sc[0] + sc[2], sc[1], sc[0], sc[2]];

  /** Prova a spostare gli edifici `mosse` (id → nuova posizione); se valida
   *  e non peggiore di `soglia` la applica e restituisce il punteggio. */
  /** Mosse realmente valutate (posizioni valide, senza nuovi problematici):
   *  i "tentativi" casuali sono molti di più, quasi tutti scartati subito
   *  perché il posto è occupato o non tocca una strada. */
  let valide = 0;
  const prova = (mosse: Array<[PlannerBuilding, number, number]>, soglia: Punti, soloValuta = false): Punti | null => {
    let effPrima = 0, nPrima = 0;
    for (const [b] of mosse) { const q = pos.get(b.id)!; const e = eff(b, q.x, q.y); effPrima += e; if (e > 0) nPrima++; }
    // rettangoli toccati (posti vecchi e nuovi) per il punteggio incrementale
    const rett: Array<[number, number, number, number]> = [];
    for (const [b, x, y] of mosse) { const q = pos.get(b.id)!; rett.push([q.x, q.y, b.w, b.h], [x, y, b.w, b.h]); }
    const prima = locale(rett);
    for (const [b] of mosse) { const q = pos.get(b.id)!; rect(q.x, q.y, b.w, b.h, 0); }
    let ok = true, effDopo = 0, nDopo = 0;
    const fatti: Array<[PlannerBuilding, number, number]> = [];
    for (const [b, x, y] of mosse) {
      if (!libero(x, y, b.w, b.h) || (b.zonaStrada ? !toccaStradaZona(b, x, y, isR) : !tocca(x, y, b.w, b.h))) { ok = false; break; }
      rect(x, y, b.w, b.h, 1); fatti.push([b, x, y]);
      const e = eff(b, x, y); effDopo += e; if (e > 0) nDopo++;
    }
    let pt: Punti | null = null;
    if (ok && nDopo <= nPrima && effDopo <= effPrima) {
      valide++;
      const dopo = locale(rett);
      const a = corrente[2] + dopo[0] - prima[0], bu = corrente[3] + dopo[2] - prima[2];
      pt = [a + bu, corrente[1] + dopo[1] - prima[1], a, bu];
      if (cmp(pt, soglia) > 0) pt = null;
    }
    if (pt && !soloValuta) { for (const [b, x, y] of mosse) pos.set(b.id, { x, y }); return pt; }
    for (const [b, x, y] of fatti) rect(x, y, b.w, b.h, 0);
    for (const [b] of mosse) { const q = pos.get(b.id)!; rect(q.x, q.y, b.w, b.h, 1); }
    return soloValuta ? pt : null;
  };
  /** Le 4 posizioni di un rettangolo w×h allineato agli angoli del posto o (ow×oh). */
  const angoliDi = (o: { x: number; y: number }, ow: number, oh: number, w: number, h: number): Array<[number, number]> =>
    [[o.x, o.y], [o.x + ow - w, o.y], [o.x, o.y + oh - h], [o.x + ow - w, o.y + oh - h]];

  /** Permutazioni di 0..n-1 (n <= 4). */
  const permutazioni = (n: number): number[][] => {
    if (n <= 1) return [[0]];
    const out: number[][] = [];
    for (const p of permutazioni(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
    return out;
  };
  /** Ricomposizione: gli edifici del gruppo vengono tolti e ripiazzati uno
   *  alla volta, nell'ordine dato, nel posto migliore accanto a una strada
   *  entro 7 celle da uno dei centri; si prova ogni ordine e si applica la
   *  disposizione migliore se non peggiore di `soglia` (e diversa
   *  dall'attuale). Punteggio incrementale. */
  const ricomponi = (gruppo: PlannerBuilding[], centri: Array<[number, number]>, ordini: number[][], soglia: Punti): Punti | null => {
    const orig = gruppo.map(c => ({ c, ...pos.get(c.id)! }));
    let effPrima = 0, nPrima = 0;
    for (const o of orig) { const e = eff(o.c, o.x, o.y); effPrima += e; if (e > 0) nPrima++; }
    const sc: [number, number, number] = [corrente[2], corrente[1], corrente[3]];
    for (const o of orig) rettSc(o.x, o.y, o.c.w, o.c.h, 0, sc);
    const strade: Array<[number, number]> = [];
    for (const kr of roadKeys) {
      const ci = kr.indexOf(","), rx = Number(kr.slice(0, ci)), ry = Number(kr.slice(ci + 1));
      if (centri.some(([cx, cy]) => Math.abs(rx - cx) + Math.abs(ry - cy) <= 7)) strade.push([rx, ry]);
    }
    let migl: { pt: Punti; posti: Array<[PlannerBuilding, number, number]> } | null = null;
    for (const ord of ordini) {
      const posti: Array<[PlannerBuilding, number, number]> = [];
      for (const i of ord) {
        const c = gruppo[i]!;
        let scelto: { x: number; y: number; pt: Punti } | null = null;
        for (const [rx, ry] of strade) {
          const cand: Array<[number, number]> = [];
          for (let o = 0; o < c.w; o++) { cand.push([rx - o, ry + 1], [rx - o, ry - c.h]); }
          for (let o = 0; o < c.h; o++) { cand.push([rx + 1, ry - o], [rx - c.w, ry - o]); }
          for (const [x, y] of cand) {
            // blocchi di catena: la strada deve toccare l'INIZIO, non gli anelli
            // (Smussa attaccava le Statue del serpente dalla parte degli Anelli)
            if (!libero(x, y, c.w, c.h) || (c.zonaStrada && !toccaStradaZona(c, x, y, isR))) continue;
            locale1(x, y, c.w, c.h);
            const a0 = La, p0 = Lp, b0 = Lb;
            rect(x, y, c.w, c.h, 1);
            locale1(x, y, c.w, c.h);
            rect(x, y, c.w, c.h, 0);
            // (stesso confronto di cmp sui primi due valori, senza creare la terna per i candidati scartati)
            const na = sc[0] + La - a0, np = sc[1] + Lp - p0, nb = sc[2] + Lb - b0, tot = na + nb;
            if (!scelto || tot < scelto.pt[0] || (tot === scelto.pt[0] && np < scelto.pt[1])) scelto = { x, y, pt: [tot, np, na, nb] };
          }
        }
        if (!scelto) break;
        rettSc(scelto.x, scelto.y, c.w, c.h, 1, sc);
        posti.push([c, scelto.x, scelto.y]);
      }
      if (posti.length === gruppo.length) {
        valide++;
        let effDopo = 0, nDopo = 0;
        for (const [c, x, y] of posti) { const e = eff(c, x, y); effDopo += e; if (e > 0) nDopo++; }
        const pt = comePunti(sc);
        if (nDopo <= nPrima && effDopo <= effPrima && (!migl || cmp(pt, migl.pt) < 0)) migl = { pt, posti: [...posti] };
      }
      for (const [c, x, y] of posti) rettSc(x, y, c.w, c.h, 0, sc);
    }
    if (migl && cmp(migl.pt, soglia) <= 0 && orig.some(o => { const n = migl!.posti.find(t => t[0] === o.c)!; return n[1] !== o.x || n[2] !== o.y; })) {
      for (const [c, x, y] of migl.posti) { rect(x, y, c.w, c.h, 1); pos.set(c.id, { x, y }); }
      return migl.pt;
    }
    for (const o of orig) rect(o.x, o.y, o.c.w, o.c.h, 1);
    return null;
  };

  /** Mossa "anello": gli ultimi k anelli di una catena passano in punta a
   *  un'altra dello stesso tipo (inizi fermi, strade invariate). */
  const mossaAnello = (soglia: Punti): Punti | null => {
    const g = gruppiT[rnd(gruppiT.length)]!;
    const conAnelli = g.filter(t => t.anelli.length);
    const A = conAnelli[rnd(conAnelli.length)];
    if (!A) return null;
    const k = 1 + rnd(Math.min(3, A.anelli.length));
    const via = A.anelli.slice(A.anelli.length - k), restoA = A.anelli.slice(0, A.anelli.length - k);
    const altre = g.filter(t => t !== A).sort(() => Math.random() - 0.5);
    for (const B of altre) {
      const nuoviB = [...B.anelli, ...via];
      const fa = opts.catene!.forma(A.testa, restoA), fb = opts.catene!.forma(B.testa, nuoviB);
      if (!fa || !fb) continue;
      tentativi++;
      // posizioni: l'inizio resta dov'è
      const ba = byId.get(A.voce)!, bb = byId.get(B.voce)!, qa = pos.get(A.voce)!, qb = pos.get(B.voce)!;
      const ta = { x: qa.x + A.pezzi[0]!.x, y: qa.y + A.pezzi[0]!.y }, tb = { x: qb.x + B.pezzi[0]!.x, y: qb.y + B.pezzi[0]!.y };
      const na = { x: ta.x - fa.pezzi[0]!.x, y: ta.y - fa.pezzi[0]!.y }, nb = { x: tb.x - fb.pezzi[0]!.x, y: tb.y - fb.pezzi[0]!.y };
      const effPrima = eff(ba, qa.x, qa.y) + eff(bb, qb.x, qb.y), nPrima = (eff(ba, qa.x, qa.y) > 0 ? 1 : 0) + (eff(bb, qb.x, qb.y) > 0 ? 1 : 0);
      const rett: Array<[number, number, number, number]> = [[qa.x, qa.y, ba.w, ba.h], [qb.x, qb.y, bb.w, bb.h], [na.x, na.y, fa.w, fa.h], [nb.x, nb.y, fb.w, fb.h]];
      const prima = locale(rett);
      rect(qa.x, qa.y, ba.w, ba.h, 0); rect(qb.x, qb.y, bb.w, bb.h, 0);
      const vecchiA = A.anelli, vecchiB = B.anelli;
      componi(A, restoA); componi(B, nuoviB);
      let messaA = false, messaB = false;
      if (libero(na.x, na.y, ba.w, ba.h)) { rect(na.x, na.y, ba.w, ba.h, 1); messaA = true; }
      if (messaA && libero(nb.x, nb.y, bb.w, bb.h)) { rect(nb.x, nb.y, bb.w, bb.h, 1); messaB = true; }
      let pt: Punti | null = null;
      if (messaA && messaB && toccaStradaZona(ba, na.x, na.y, isR) && toccaStradaZona(bb, nb.x, nb.y, isR)) {
        const ea = eff(ba, na.x, na.y), eb = eff(bb, nb.x, nb.y);
        if ((ea > 0 ? 1 : 0) + (eb > 0 ? 1 : 0) <= nPrima && ea + eb <= effPrima) {
          valide++;
          const dopo = locale(rett);
          const a = corrente[2] + dopo[0] - prima[0], bu = corrente[3] + dopo[2] - prima[2];
          pt = [a + bu, corrente[1] + dopo[1] - prima[1], a, bu];
          if (cmp(pt, soglia) > 0) pt = null;
        }
      }
      if (pt) { pos.set(A.voce, na); pos.set(B.voce, nb); return pt; }
      if (messaA) rect(na.x, na.y, ba.w, ba.h, 0);
      if (messaB) rect(nb.x, nb.y, bb.w, bb.h, 0);
      componi(A, vecchiA); componi(B, vecchiB);
      rect(qa.x, qa.y, ba.w, ba.h, 1); rect(qb.x, qb.y, bb.w, bb.h, 1);
    }
    return null;
  };

  let corrente = punti();
  let migliore = { pt: corrente, pos: new Map(pos), comp: composizione0 };
  const iniziale = corrente;
  let tentativi = 0, senzaMigliorare = 0;
  /** Ultima ricomposizione mostrata (per non rifarla a ogni fotogramma). */
  let ultimaComp = firma0;
  let ultimaRic: { placements: Map<string, { x: number; y: number }>; voci: ReadonlySet<string> } | null = null;
  /** Posizioni della migliore con gli id giusti: con catene diverse da quelle di
   *  partenza le voci si ricompongono dai pezzi (nuovo raggruppamento). */
  const posMigliore = (): Map<string, { x: number; y: number }> => {
    const f = firmaComp(migliore.comp);
    if (f === firma0) {
      if (ultimaComp !== firma0) { ultimaComp = firma0; ultimaRic = null; opts.onCatene?.(null); }
      return new Map(migliore.pos);
    }
    if (f !== ultimaComp || !ultimaRic) {
      const pezzi = new Map<string, { x: number; y: number }>();
      for (const [voce, anelli] of migliore.comp) {
        const t = teste.get(voce)!, q = migliore.pos.get(voce)!;
        const fo = opts.catene!.forma(t.testa, anelli)!;
        for (const p of fo.pezzi) pezzi.set(p.id, { x: q.x + p.x, y: q.y + p.y });
      }
      const r = opts.catene!.ricomponi(pezzi);
      if (!r) return new Map(migliore.pos); // (non dovrebbe succedere: catene montate da `forma`)
      ultimaComp = f; ultimaRic = r;
      opts.onCatene?.(r.rag);
    }
    const out = new Map<string, { x: number; y: number }>();
    for (const [id, q] of migliore.pos) if (!teste.has(id)) out.set(id, q);
    for (const [id, q] of ultimaRic!.placements) out.set(id, q);
    return out;
  };
  const frame = (stato: string): PlannerFrame => ({
    placements: posMigliore(), roads: new Set(start.roads), probe: null, lastPath: [],
    placed: migliore.pos.size, unplaced: [], iterations: tentativi, done: false,
    label: `Smussa i bordi · angoli ${migliore.pt[2]} (all'inizio ${iniziale[2]}) · buchi ${migliore.pt[3]} (all'inizio ${iniziale[3]}) · perimetro ${migliore.pt[1]} · ${valide.toLocaleString()} mosse valide su ${tentativi.toLocaleString()} tentativi${stato}`,
  });
  const ripristina = (m: Map<string, { x: number; y: number }>, comp?: ReadonlyMap<string, readonly string[]>) => {
    for (const [id, q] of pos) { const b = byId.get(id)!; rect(q.x, q.y, b.w, b.h, 0); }
    for (const k of roadKeys) { const c = k.indexOf(","), g = gi(Number(k.slice(0, c)), Number(k.slice(c + 1))); if (g >= 0) occ[g] = 1; }
    if (comp) for (const [v, a] of comp) componi(teste.get(v)!, [...a]);
    pos.clear();
    for (const [id, q] of m) { const b = byId.get(id)!; pos.set(id, { x: q.x, y: q.y }); rect(q.x, q.y, b.w, b.h, 1); }
  };
  const rnd = (n: number) => Math.floor(Math.random() * n);
  opts.onFrame(frame(""));
  if (!mobili.length) return { ...frame(" · niente da spostare"), done: true };
  let lastYield = performance.now(), lastShow = performance.now();
  while (!opts.shouldStop()) {
    tentativi++;
    if (++senzaMigliorare > 2000) {
      // Bloccato: prima una discesa ESAUSTIVA dalla migliore (tutti gli
      // scambi di coppie, anche lontane, nei 16 allineamenti agli angoli, e
      // tutti gli scorrimenti di 1-3 celle); poi si riparte dalla migliore.
      ripristina(migliore.pos, migliore.comp); corrente = migliore.pt; senzaMigliorare = 0;
      for (let migliorato = true; migliorato && !opts.shouldStop();) {
        migliorato = false;
        let top: { pt: Punti; mosse: Array<[PlannerBuilding, number, number]> } | null = null;
        const valuta = (mosse: Array<[PlannerBuilding, number, number]>) => {
          tentativi++;
          const r = prova(mosse, top ? top.pt : corrente, true);
          if (r && cmp(r, top ? top.pt : corrente) < 0) top = { pt: r, mosse };
        };
        for (let i = 0; i < mobili.length; i++) {
          const b1 = mobili[i]!, p1 = pos.get(b1.id)!;
          for (let d = 1; d <= 3; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]] as const) valuta([[b1, p1.x + dx, p1.y + dy]]);
          for (let j = i + 1; j < mobili.length; j++) {
            const b2 = mobili[j]!, p2 = pos.get(b2.id)!;
            for (const [x1, y1] of angoliDi(p2, b2.w, b2.h, b1.w, b1.h)) for (const [x2, y2] of angoliDi(p1, b1.w, b1.h, b2.w, b2.h)) valuta([[b1, x1, y1], [b2, x2, y2]]);
          }
          if (performance.now() - lastYield > 40) { await sleep(0); lastYield = performance.now(); if (opts.shouldStop()) break; }
        }
        const t = top as { pt: Punti; mosse: Array<[PlannerBuilding, number, number]> } | null;
        if (t && prova(t.mosse, t.pt)) {
          corrente = t.pt; migliorato = true;
          if (cmp(corrente, migliore.pt) < 0) { migliore = { pt: corrente, pos: new Map(pos), comp: composizione() }; opts.onFrame(frame("")); lastShow = performance.now(); }
        }
      }
      // Poi ricomposizioni "lontane" per ~2 s (idea dell'utente su Beta r3:
      // un edificio di una dorsale scambiato con uno di un'altra, con i vicini
      // che si riassestano): b e il suo vicino più prossimo, c (qualsiasi) e
      // il suo vicino più prossimo, ripiazzati in tutti i 24 ordini attorno
      // ai due posti. Si accettano anche le mosse a pari punteggio.
      const fineRic = performance.now() + 2000;
      const vicinoDi = (x: PlannerBuilding, salta: Set<PlannerBuilding>) => {
        const p0 = pos.get(x.id)!;
        let m: PlannerBuilding | null = null, dm = Infinity;
        for (const y of mobili) {
          if (salta.has(y)) continue;
          const p1 = pos.get(y.id)!, d = Math.abs(p1.x + y.w / 2 - p0.x - x.w / 2) + Math.abs(p1.y + y.h / 2 - p0.y - x.h / 2);
          if (d < dm) { dm = d; m = y; }
        }
        return dm <= 10 ? m : null;
      };
      while (performance.now() < fineRic && !opts.shouldStop() && mobili.length >= 2) {
        const b1 = mobili[rnd(mobili.length)]!, c1 = mobili[rnd(mobili.length)]!;
        if (b1 === c1) continue;
        const usati = new Set<PlannerBuilding>([b1, c1]);
        const nb = vicinoDi(b1, usati); if (nb) usati.add(nb);
        const nc = vicinoDi(c1, usati); if (nc) usati.add(nc);
        const gruppo = [...usati];
        const pb = pos.get(b1.id)!, pc = pos.get(c1.id)!;
        tentativi++;
        const r = ricomponi(gruppo, [[pb.x + b1.w / 2, pb.y + b1.h / 2], [pc.x + c1.w / 2, pc.y + c1.h / 2]], permutazioni(gruppo.length), corrente);
        if (r) {
          corrente = r;
          if (cmp(corrente, migliore.pt) < 0) { migliore = { pt: corrente, pos: new Map(pos), comp: composizione() }; opts.onFrame(frame("")); lastShow = performance.now(); }
        }
        if (performance.now() - lastYield > 40) { await sleep(0); lastYield = performance.now(); }
      }
    }
    const b = mobili[rnd(mobili.length)]!;
    const q = pos.get(b.id)!;
    const u = Math.random();
    let pt: Punti | null = null;
    // Di solito non peggiore della corrente; ogni tanto fino a +1/+2 angoli.
    const a = Math.random();
    const soglia: Punti = a < 0.003 ? [corrente[0] + 2, Infinity, 0, 0] : a < 0.02 ? [corrente[0] + 1, Infinity, 0, 0] : corrente;
    // (solo con catene spostabili: senza, nessuna estrazione in più e Smussa resta identico)
    if (gruppiT.length && Math.random() < 0.08) {
      pt = mossaAnello(soglia);
    } else if (u < 0.4) {
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
      // di solito un vicino; una volta su tre chiunque (es. due fini strada di
      // dorsali diverse: idea dell'utente su Beta r3, da 37 a 33 angoli)
      const lontano = Math.random() < 0.33;
      const vicini = mobili.filter(c => c !== b && (lontano || Math.abs(pos.get(c.id)!.x - q.x) + Math.abs(pos.get(c.id)!.y - q.y) <= 14));
      const c = vicini[rnd(vicini.length)];
      if (c) {
        const p = pos.get(c.id)!;
        let migl: Punti | null = null;
        const prove: Array<[number, number, number, number]> = [];
        for (const [bx, by] of angoliDi(p, c.w, c.h, b.w, b.h)) for (const [cx, cy] of angoliDi(q, b.w, b.h, c.w, c.h)) prove.push([bx, by, cx, cy]);
        for (const [bx, by, cx, cy] of prove.sort(() => Math.random() - 0.5).slice(0, 6)) {
          const r = prova([[b, bx, by], [c, cx, cy]], migl ?? soglia);
          if (r) { migl = r; break; }
        }
        pt = migl;
      }
    } else if (u < 0.805) {
      // Ricomposizione: 2-3 edifici vicini (b e i più vicini) tolti e
      // ripiazzati uno alla volta nel posto migliore accanto a una strada
      // (es. un 4×4 che scambia posto con due 2×3: idea dell'utente su Beta r3).
      const k = 2 + rnd(2);
      const cx = q.x + b.w / 2, cy = q.y + b.h / 2;
      const dist = (c: PlannerBuilding) => { const p = pos.get(c.id)!; return Math.abs(p.x + c.w / 2 - cx) + Math.abs(p.y + c.h / 2 - cy); };
      const gruppo = [b, ...mobili.filter(c => c !== b && dist(c) <= 10).sort((c1, c2) => dist(c1) - dist(c2)).slice(0, k - 1)];
      if (gruppo.length >= 2) pt = ricomponi(gruppo, [[cx, cy]], permutazioni(gruppo.length), soglia);
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
      if (cmp(pt, migliore.pt) < 0) { migliore = { pt, pos: new Map(pos), comp: composizione() }; senzaMigliorare = 0; if (performance.now() - lastShow > 150) { opts.onFrame(frame("")); lastShow = performance.now(); } }
    }
    const now = performance.now();
    if (now - lastShow > 500) { opts.onFrame(frame("")); lastShow = now; }
    if (now - lastYield > 40) { await sleep(0); lastYield = performance.now(); }
  }
  const fin = { ...frame(" · fermata"), done: true };
  opts.onFrame(fin);
  return fin;
}
