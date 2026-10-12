// ─────────────────────────────────────────────────────────────────────────────
//  planner/completion.ts — Completamento dopo FoE City Builder (fase 1+2)
//
//  Il builder lascia libera la parte a EST della strada verticale. Qui:
//
//  A. EDIFICI CON STRADA — RICERCA. Non ci si ferma alla prima disposizione
//     che li inserisce tutti: si valutano molte disposizioni (configurazioni
//     deterministiche + ripartenze casuali) finché l'utente non preme
//     "COMPLETA" (in pausa può modificare la mappa a mano: la ricerca poi
//     continua da lì, vedi cercaDaManuale); ogni miglioramento sostituisce subito quella visualizzata.
//     Si tiene la migliore in ordine lessicografico: meno edifici con strada
//     esclusi, poi meno fini strada mancati, poi MENO CELLE DI STRADA NUOVE, poi area occupata più compatta.
//     Ogni disposizione combina:
//      0. FINE STRADA: gli edifici "grandi" rimasti dopo fase2 (entrambi i lati
//         >= 5). 1-2 grandi → una dorsale; 3-4 → due dorsali distanziate. A
//         ogni estremità est una coppia: L adiacente all'ultima cella di strada
//         (a nord o a sud) e C che ne tocca il lato EST (così anche quel lato è
//         sfruttato). Variano: coppie, ruoli L/C, lato, allineamento (L a filo
//         o sporgente), verso di C, righe e lunghezza delle dorsali. Una
//         disposizione che non riesce a piazzare un fine strada perde;
//      1. dorsale est: strada orizzontale che prosegue il raccordo est del
//         municipio (riga eastMidY) oltre la verticale, edifici su entrambi i
//         lati; senza fine strada la strada si allunga solo fin dove serve;
//      2. lato est della strada verticale (strada esistente, costo zero);
//      3. dorsali secondarie che si diramano dalla verticale verso est, scelte
//         per resa (area servita ÷ strade nuove) o per costo minimo.
//     Variano: ordine degli edifici, scelta del lato, ordine dei passi 1/2,
//     criterio delle dorsali secondarie, lunghezza massima della dorsale.
//     Gli eventuali esclusi → motore Planner (strada a costo minimo).
//  B. Solo DOPO: edifici senza strada → algoritmo di fase2 (partizionamento +
//     backtracking per forme + rifinitura) su tutta l'area libera, modalità
//     veloce; gli ultimi rimasti → primo posto libero.
// ─────────────────────────────────────────────────────────────────────────────

import { runPlaceholderPlanner, type PlannerBuilding, type PlannerFrame, type PlannerProblem } from "./engine";
import { fillMask } from "./builder/fase2";

const key = (x: number, y: number) => `${x},${y}`;

/** Insieme di celle "x,y" su una griglia densa (Uint8Array) con ripiego per
 *  le celle fuori griglia. Stessa interfaccia di Set<string> per has/add/
 *  delete/clear, più hasXY numerico. Ottimizzazione: ogni simulazione copiava
 *  l'intero Set delle celle occupate (migliaia di stringhe); clone() è una
 *  copia di memoria. */
class GridSet {
  constructor(
    readonly x0: number, readonly y0: number, readonly W: number, readonly H: number,
    readonly g: Uint8Array = new Uint8Array(W * H), readonly fuori: Set<string> = new Set(),
  ) {}
  idx(x: number, y: number): number {
    const i = x - this.x0, j = y - this.y0;
    return i < 0 || j < 0 || i >= this.W || j >= this.H ? -1 : j * this.W + i;
  }
  hasXY(x: number, y: number): boolean { const i = this.idx(x, y); return i < 0 ? this.fuori.has(key(x, y)) : this.g[i] === 1; }
  has(k: string): boolean { const c = k.indexOf(","); return this.hasXY(Number(k.slice(0, c)), Number(k.slice(c + 1))); }
  add(k: string): this {
    const c = k.indexOf(","), i = this.idx(Number(k.slice(0, c)), Number(k.slice(c + 1)));
    if (i < 0) this.fuori.add(k); else this.g[i] = 1;
    return this;
  }
  delete(k: string): boolean {
    const c = k.indexOf(","), i = this.idx(Number(k.slice(0, c)), Number(k.slice(c + 1)));
    if (i < 0) return this.fuori.delete(k);
    const era = this.g[i] === 1; this.g[i] = 0; return era;
  }
  /** Segna (v = 1) o libera (v = 0) un rettangolo, senza passare per le stringhe. */
  setRect(x: number, y: number, w: number, h: number, v: 0 | 1): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const i = this.idx(x + dx, y + dy);
      if (i >= 0) this.g[i] = v;
      else if (v) this.fuori.add(key(x + dx, y + dy)); else this.fuori.delete(key(x + dx, y + dy));
    }
  }
  clear(): void { this.g.fill(0); this.fuori.clear(); }
  clone(): GridSet { return new GridSet(this.x0, this.y0, this.W, this.H, this.g.slice(), new Set(this.fuori)); }
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Tetto di sicurezza della ricerca (di norma la ferma l'utente con "COMPLETA"). */
const SEARCH_MAX_RUNS = 2_000_000;

export interface CompletionOptions {
  delayMs: number;
  onFrame: (f: PlannerFrame) => void;
  shouldStop: () => boolean;
  initial: { placements: ReadonlyMap<string, { x: number; y: number }>; roads: ReadonlySet<string> };
  /** Colonna della strada verticale e riga del raccordo est (dal builder). */
  geometry: { stradaVX: number; eastMidY: number };
  /** true = l'utente ha premuto "COMPLETA": chiude la ricerca e passa
   *  al riempimento con gli edifici senza strada. Senza, la ricerca dura fino
   *  al tetto di sicurezza (usato dai test). */
  shouldFinishSearch?: () => boolean;
  /** Edifici che la ricerca non deve MAI spostare (attorno al municipio, fase 1). */
  fissi?: readonly string[];
  /** Notifica inizio/fine della ricerca (per abilitare il pulsante). */
  onSearchActive?: (active: boolean) => void;
  /** Fase C (dopo COMPLETA): rifinitura continua degli edifici senza strada.
   *  Prosegue finché shouldStopFill() non è vero (o Reset); si può mettere in
   *  pausa (isPaused/waitResume) e modificare a mano gli edifici senza strada.
   *  Senza shouldStopFill la fase C non viene eseguita (banco di prova). */
  shouldStopFill?: () => boolean;
  onFillActive?: (active: boolean) => void;
  /** Pausa della ricerca (pulsante "Ferma" → "Riprendi"): con isPaused() vero
   *  la ricerca mostra la migliore e attende waitResume(), che restituisce la
   *  disposizione modificata a mano dall'utente (o null se non l'ha toccata).
   *  La ricerca riparte da quella disposizione (vedi ribasa). */
  isPaused?: () => boolean;
  waitResume?: () => Promise<StatoManuale | null>;
  onPaused?: (paused: boolean) => void;
}
/** Disposizione completa (edifici + strade) modificata a mano durante la pausa. */
export interface StatoManuale { placements: ReadonlyMap<string, { x: number; y: number }>; roads: ReadonlySet<string> }

/** Un passo della disposizione: un edificio piazzato e le strade nuove che richiede. */
interface Azione { label: string; id: string; x: number; y: number; w: number; h: number; road: string[]; sy?: number; cap?: boolean; from?: { x: number; y: number }; libera?: string }
interface Piano { azioni: Azione[]; altiInterni: number; liberati: string[]; stradeExtra: string[]; scollegate: number; deficit: number; esclusi: string[]; finiStradaMancanti: number; latiLiberi: number; latiLunghi: number; strade: number; buchi: number; spreco: number; compattezza: number }

type Side = "nearest" | "balance" | "north" | "south";
interface Params {
  order: (a: PlannerBuilding, b: PlannerBuilding) => number;
  side: Side;
  vertFirst: boolean;
  secondary: "ratio" | "minRoad" | "snug";
  /** Lunghezza massima della dorsale SENZA fine strada (frazione della lunghezza libera). */
  spineCap: number;
  /** Fine strada: righe delle dorsali (1 o 2), fattore sulla lunghezza stimata
   *  di ciascuna, variante geometrica di partenza, abbinamento dei grandi. */
  rows: number[];
  lenFactor: number[];
  capVariant: number[];
  pairSeed: number | null; // null = abbinamento per area decrescente
  /** "Pettine": numero di dorsali parallele pianificate insieme (0 = no).
   *  Gli edifici più ALTI vanno nelle fasce esterne (a nord della dorsale più
   *  in alto e a sud di quella più in basso), così le dorsali interne restano
   *  vicine. combAnchor = indice della dorsale che sta sulla riga centrale. */
  comb: number;
  /** Pettine pieno: dorsali in più rispetto al minimo calcolato (0-2). */
  combPiu?: number;
  /** Orientamento (regola dell'utente: ogni edificio si attacca col lato
   *  CORTO): il primo riempimento del lato est della verticale prende solo
   *  gli edifici larghi (w >= h); quelli alti vanno sulle dorsali. */
  orient?: boolean;
  /** Scambio con il builder: un edificio grande già piazzato dal builder (es.
   *  il 6×6 in fondo alla verticale) cede il posto a un grande più piccolo
   *  ancora da piazzare e diventa disponibile come fine strada. */
  swapBuilder?: boolean;
  /** Righe lasciate libere sul lato est della verticale sopra/sotto ogni
   *  dorsale futura (default 1). Con 2-3 c'è spazio, all'inizio della dorsale,
   *  per un edificio piccolo (2×2, 2×3) che tocca la dorsale. */
  gapN?: number;
  gapS?: number;
  /** Allungamento della strada verticale del builder (righe, 0 = no) a nord
   *  e a sud: i suoi fini strada (il tappo sulla colonna della strada e il
   *  laterale a est) scivolano fino al bordo e la strada li segue, così si
   *  sfrutta tutta l'altezza della mappa e il lato est guadagna spazio. */
  extN?: number;
  extS?: number;
  /** Città dense: si "rinuncia" ai fini strada della verticale (tappo e
   *  laterale) a nord/sud: tornano fra i da piazzare (il grande può diventare
   *  un fine strada laterale) e lo spazio liberato, con le righe in fondo alla
   *  verticale, è disponibile per le dorsali. */
  liberaN?: boolean;
  liberaS?: boolean;
  /** Alti trattenuti (h >= 6): esclusi dalle dorsali durante la costruzione,
   *  poi messi solo nelle fasce esterne (nord della dorsale più in alto, sud
   *  di quella più in basso), allungandole se serve. */
  riservaAlti?: boolean;
  /** Spunto "alti nelle fasce esterne" (NON un vincolo): se attivo, il
   *  ribilanciamento mette fuori gli alti quando non allunga la strada, gli
   *  alti interni vengono spostati fuori a fine costruzione e il pettine
   *  richiede che le fasce esterne stiano nella mappa. Vince solo se porta a
   *  meno strade (o pari strade e meglio negli spareggi). */
  altiEsterni?: boolean;
  combAnchor: number;
}

/** Edificio "grande": entrambi i lati >= 5 (candidato fine strada). */
const LATO_GRANDE = 5;
/** Varianti geometriche del fine strada orizzontale. L = edificio adiacente
 *  all'ultima cella di strada (a nord o a sud), C = edificio che tocca il lato
 *  EST dell'ultima cella. flush: L finisce sulla colonna dell'ultima cella;
 *  overhang: L inizia su quella colonna (sporge oltre la fine della strada).
 *  cDir: C si estende verso il lato di L o verso quello opposto. */
const CAP_VARIANTS: Array<{ l: 0 | 1; side: "n" | "s"; align: "flush" | "overhang"; cDir: "toward" | "away" }> = [];
for (const l of [0, 1] as const) for (const side of ["n", "s"] as const) {
  CAP_VARIANTS.push({ l, side, align: "flush", cDir: "toward" });
  CAP_VARIANTS.push({ l, side, align: "flush", cDir: "away" });
  CAP_VARIANTS.push({ l, side, align: "overhang", cDir: "away" });
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Peso delle celle sprecate fra le dorsali rispetto a una cella di strada: una
 *  cella vuota può ancora ospitare un edificio senza strada, una strada no. */
const PESO_SPRECO = 0.5;
/** Peso di un lato di cella di strada senza edificio nella scelta delle dorsali secondarie. */
const PESO_LATO_LIBERO = 2;
const LBL_VERTICALE = "lato est della strada verticale";
/** Ordine di merito (l'obiettivo PRINCIPALE è il minimo numero di strade):
 *  1. meno edifici con strada esclusi (tutti devono entrare);
 *  1b. città dense: meno "deficit" di spazio (celle libere che mancano per
 *     gli edifici senza strada); 0 nelle città con spazio;
 *  2. MENO STRADE NUOVE;
 *  2b. a parità di strade: meno BUCHI INTERMEDI (celle libere che nessun
 *     edificio senza strada rimasto può coprire: spazio perso per il
 *     riempimento successivo, vedi contaBuchi);
 *  3. poi: meno fini strada mancati, meno lati di strada liberi
 *     (compreso il lato est della verticale), meno edifici attaccati col lato
 *     lungo, meno celle sprecate fra le dorsali, più compatta.
 *  Una disposizione con più strade non sostituisce MAI una con meno strade. */
const meglio = (a: Piano, b: Piano) =>
  a.scollegate !== b.scollegate ? a.scollegate < b.scollegate
    : a.esclusi.length !== b.esclusi.length ? a.esclusi.length < b.esclusi.length
    : a.deficit !== b.deficit ? a.deficit < b.deficit
    : a.strade !== b.strade ? a.strade < b.strade
    : a.buchi !== b.buchi ? a.buchi < b.buchi
    : a.finiStradaMancanti !== b.finiStradaMancanti ? a.finiStradaMancanti < b.finiStradaMancanti
    : a.latiLiberi !== b.latiLiberi ? a.latiLiberi < b.latiLiberi
    : a.latiLunghi !== b.latiLunghi ? a.latiLunghi < b.latiLunghi
    : a.spreco !== b.spreco ? a.spreco < b.spreco
    : a.altiInterni !== b.altiInterni ? a.altiInterni < b.altiInterni
      : a.compattezza < b.compattezza;

export async function runCompletion(problem: PlannerProblem, opts: CompletionOptions): Promise<PlannerFrame> {
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  const fissi = new Set(opts.fissi ?? []);
  const placements = new Map(opts.initial.placements);
  const roads = new Set(opts.initial.roads);
  const GW = problem.maxX - problem.minX + 1, GH = problem.maxY - problem.minY + 1;
  /** Celle sbloccate su griglia (1 = sbloccata). */
  const cellGrid = new Uint8Array(GW * GH);
  for (const k of problem.cells) { const c = k.indexOf(","); cellGrid[(Number(k.slice(c + 1)) - problem.minY) * GW + Number(k.slice(0, c)) - problem.minX] = 1; }
  /** Indice di griglia di (x, y), -1 se fuori. */
  const gIdx = (x: number, y: number) => { const i = x - problem.minX, j = y - problem.minY; return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : j * GW + i; };
  const inCella = (x: number, y: number) => { const i = x - problem.minX, j = y - problem.minY; return i >= 0 && j >= 0 && i < GW && j < GH && cellGrid[j * GW + i] === 1; };
  const occupied = new GridSet(problem.minX, problem.minY, GW, GH);
  for (const r of roads) occupied.add(r);
  for (const [id, p] of placements) {
    const b = byId.get(id);
    if (b) for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) occupied.add(key(p.x + dx, p.y + dy));
  }
  const isFree = (x: number, y: number) => inCella(x, y) && !occupied.hasXY(x, y);
  const fits = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) if (!isFree(x + dx, y + dy)) return false;
    return true;
  };
  const occupy = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) occupied.add(key(x + dx, y + dy));
  };
  let iterations = 0;
  const emit = async (label: string, probe: PlannerFrame["probe"], lastPath: string[], everyN = 1) => {
    iterations++;
    if (opts.delayMs === 0 && iterations % everyN !== 0) return;
    opts.onFrame({
      placements: new Map(placements), roads: new Set(roads), probe, lastPath,
      placed: placements.size, unplaced: [], iterations, done: false, label,
    });
    await sleep(opts.delayMs > 0 ? opts.delayMs : 0);
  };
  const finalFrame = (): PlannerFrame => {
    const fr: PlannerFrame = {
      placements: new Map(placements), roads: new Set(roads), probe: null, lastPath: [],
      placed: placements.size, unplaced: [], iterations, done: true, label: "Interrotto",
    };
    opts.onFrame(fr);
    return fr;
  };

  // ── A. Ricerca della disposizione degli edifici con strada ─────────────────
  const vx = opts.geometry.stradaVX;
  const sy0 = opts.geometry.eastMidY;
  const x0 = vx + 1;
  const daPiazzare = problem.buildings.filter(b => !b.isTownhall && b.roadLevel > 0 && !placements.has(b.id));
  /** Area degli edifici senza strada ancora da piazzare (per il deficit di spazio). */
  let areaSenzaStrada = problem.buildings.filter(b => !b.isTownhall && b.roadLevel === 0 && !placements.has(b.id)).reduce((t, b) => t + b.w * b.h, 0);
  /** "Buchi intermedi": celle libere che nessun edificio senza strada ancora
   *  da piazzare con entrambi i lati >= 2 può coprire (fessure larghe 1,
   *  angoli, sacche: spazio perso per il riempimento successivo).
   *  Basta considerare le forme MINIMALI (w×h non dominate da una più
   *  piccola in entrambe le dimensioni): una cella coperta da una finestra
   *  libera w×h lo è anche da una più piccola contenuta in essa. */
  let formeMinime: Array<[number, number]> = [];
  const calcolaForme = () => {
    const f = new Map<string, [number, number]>();
    for (const b of problem.buildings) if (!b.isTownhall && b.roadLevel === 0 && !placements.has(b.id)) f.set(`${b.w}x${b.h}`, [b.w, b.h]);
    // Le decorazioni sottili (1×1, 1×N) sono poche e coprirebbero tutto: un
    // buco è una cella che nessun edificio "vero" (lati >= 2) può coprire.
    const veri = [...f.values()].filter(([w, h]) => w >= 2 && h >= 2);
    const tutte = veri.length ? veri : [...f.values()];
    formeMinime = tutte.filter(([w, h]) => !tutte.some(([w2, h2]) => (w2 < w && h2 <= h) || (w2 <= w && h2 < h)));
  };
  calcolaForme();
  const libGrid = new Uint8Array(GW * GH);
  const pref = new Int32Array((GW + 1) * (GH + 1));
  const diff = new Int32Array((GW + 1) * (GH + 1));
  const contaBuchi = (occupata: GridSet): number => {
    let libere = 0;
    const og = occupata.g;
    for (let c = 0; c < GW * GH; c++) { const v = cellGrid[c] === 1 && og[c] !== 1 ? 1 : 0; libGrid[c] = v; libere += v; }
    if (!libere) return 0;
    if (!formeMinime.length) return libere;
    const W1 = GW + 1;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++)
      pref[(j + 1) * W1 + i + 1] = libGrid[j * GW + i]! + pref[j * W1 + i + 1]! + pref[(j + 1) * W1 + i]! - pref[j * W1 + i]!;
    diff.fill(0);
    for (const [w, h] of formeMinime) for (let j = 0; j + h <= GH; j++) for (let i = 0; i + w <= GW; i++) {
      if (pref[(j + h) * W1 + i + w]! - pref[j * W1 + i + w]! - pref[(j + h) * W1 + i]! + pref[j * W1 + i]! !== w * h) continue;
      const a0 = j * W1 + i, a1 = a0 + w, a2 = a0 + h * W1, a3 = a2 + w;
      diff[a0] = diff[a0]! + 1; diff[a1] = diff[a1]! - 1; diff[a2] = diff[a2]! - 1; diff[a3] = diff[a3]! + 1;
    }
    let buchi = 0;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const c = j * W1 + i;
      diff[c] = diff[c]! + (i > 0 ? diff[c - 1]! : 0) + (j > 0 ? diff[c - W1]! : 0) - (i > 0 && j > 0 ? diff[c - W1 - 1]! : 0);
    }
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (libGrid[j * GW + i] && diff[j * W1 + i]! <= 0) buchi++;
    return buchi;
  };
  /** Righe in cui la verticale può diramarsi verso est (cella x0 libera). */
  const righeValide: number[] = [];
  const calcolaRighe = () => {
    righeValide.length = 0;
    for (const r of roads) { const [rx, ry] = r.split(",").map(Number) as [number, number]; if (rx === vx && isFree(x0, ry)) righeValide.push(ry); }
    righeValide.sort((a, b) => a - b);
  };
  calcolaRighe();
  const okRiga = (r: number) => righeValide.includes(r);
  /** Strade del builder: le "strade nuove" mostrate restano relative a queste
   *  anche dopo una ripresa da una disposizione manuale. */
  const stradeIniziali = roads.size;

  /** Ripresa dopo la pausa: la disposizione modificata a mano diventa il nuovo
   *  stato di partenza. Si tolgono le strade non collegate al municipio e i
   *  rami morti (strade che non servono nessun edificio); gli edifici con
   *  strada rimasti senza collegamento (o tolti dall'utente) tornano fra
   *  quelli da piazzare, e la ricerca riparte da qui. */
  /** Ricalcola lo stato derivato (occupate, da piazzare, area senza strada,
   *  righe valide) dopo aver cambiato placements/roads. */
  const ricalcola = () => {
    occupied.clear();
    for (const r of roads) occupied.add(r);
    for (const [id, p] of placements) { const b = byId.get(id)!; occupy(p.x, p.y, b.w, b.h); }
    daPiazzare.length = 0;
    daPiazzare.push(...problem.buildings.filter(b => !b.isTownhall && b.roadLevel > 0 && !placements.has(b.id)));
    areaSenzaStrada = problem.buildings.filter(b => !b.isTownhall && b.roadLevel === 0 && !placements.has(b.id)).reduce((t, b) => t + b.w * b.h, 0);
    calcolaRighe();
    calcolaForme();
  };
  /** Stato di partenza del builder (base della ricerca parametrica). */
  const base0 = { pl: new Map(placements), rd: new Set(roads) };
  /** Parte OVEST (regola dell'utente): gli edifici interamente a ovest della
   *  strada verticale, messi da fase 1 e fase 2, sono già ottimi e
   *  l'ottimizzatore non li modifica MAI (spazio di ricerca ridotto). I fini
   *  strada della verticale (che ne occupano la colonna) restano mobili:
   *  bloccarli peggiorava Avito (r4 da 141 strade / 2 fuori a 201 / 7 fuori).
   *  Dopo una modifica manuale vale la nuova disposizione dell'utente. */
  const idOvest = (pl: ReadonlyMap<string, { x: number; y: number }>) =>
    [...pl].filter(([id, q]) => { const b = byId.get(id); return !!b && !b.isTownhall && q.x + b.w - 1 < vx; }).map(([id]) => id);
  const firmaOvest = (pl: ReadonlyMap<string, { x: number; y: number }>, rd: ReadonlySet<string>) =>
    idOvest(pl).map(id => `${id}@${pl.get(id)!.x},${pl.get(id)!.y}`).sort().join(";") + "|"
    + [...rd].filter(k => Number(k.slice(0, k.indexOf(","))) < vx).sort().join(";");
  const firmaBase0 = firmaOvest(base0.pl, base0.rd);
  for (const id of idOvest(placements)) fissi.add(id);
  /** La ricerca parametrica dalla base del builder resta attiva solo se la
   *  parte ovest della disposizione corrente è ancora quella del builder. */
  let parOvestOk = true;
  /** Torna alla base del builder (senza potature). */
  const ripristinaBase = () => {
    placements.clear(); for (const [id, q] of base0.pl) placements.set(id, q);
    roads.clear(); for (const r of base0.rd) roads.add(r);
    ricalcola();
  };
  const ribasa = (s: StatoManuale) => {
    placements.clear();
    for (const [id, p] of s.placements) if (byId.has(id)) placements.set(id, { x: p.x, y: p.y });
    roads.clear();
    for (const r of s.roads) if (problem.cells.has(r)) roads.add(r);
    const vicini = (k: string) => { const i = k.indexOf(","), x = Number(k.slice(0, i)), y = Number(k.slice(i + 1)); return [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)]; };
    /** Celle (perimetro esterno) che collegano un edificio a una strada. */
    const perimetro = (x: number, y: number, w: number, h: number) => {
      const out: string[] = [];
      for (let dx = 0; dx < w; dx++) out.push(key(x + dx, y - 1), key(x + dx, y + h));
      for (let dy = 0; dy < h; dy++) out.push(key(x - 1, y + dy), key(x + w, y + dy));
      return out;
    };
    const th = problem.buildings.find(b => b.isTownhall);
    const pth = th ? placements.get(th.id) : undefined;
    // 1. Solo le strade raggiungibili dal municipio.
    const coll = new Set<string>();
    const coda = th && pth ? perimetro(pth.x, pth.y, th.w, th.h).filter(k => roads.has(k)) : [];
    for (const k of coda) coll.add(k);
    while (coda.length) for (const n of vicini(coda.pop()!)) if (roads.has(n) && !coll.has(n)) { coll.add(n); coda.push(n); }
    if (th && pth) for (const r of [...roads]) if (!coll.has(r)) roads.delete(r);
    // 2. Rami morti: foglie della rete che non toccano edifici con strada (né il municipio).
    const serve = new Set<string>();
    for (const [id, p] of placements) { const b = byId.get(id)!; if (b.isTownhall || b.roadLevel > 0) for (const k of perimetro(p.x, p.y, b.w, b.h)) serve.add(k); }
    for (let cambiato = true; cambiato;) {
      cambiato = false;
      for (const r of [...roads]) if (!serve.has(r) && vicini(r).filter(n => roads.has(n)).length <= 1) { roads.delete(r); cambiato = true; }
    }
    // 3. Edifici con strada non collegati → di nuovo da piazzare.
    for (const [id, p] of [...placements]) {
      const b = byId.get(id)!;
      if (!b.isTownhall && b.roadLevel > 0 && !perimetro(p.x, p.y, b.w, b.h).some(k => roads.has(k))) placements.delete(id);
    }
    ricalcola();
  };

  /** Esegue UNA disposizione su una copia dello stato (sincrono, nessun effetto). */
  const simula = (p: Params, punte = false): Piano => {
    const occ = occupied.clone();
    const rd = new Set<string>();
    const fatti = new Set<string>();
    const azioni: Azione[] = [];
    /** Edifici con strada da piazzare in questa simulazione (può crescere con lo scambio col builder). */
    const pool = daPiazzare.slice();
    const spostati = new Map<string, { x: number; y: number }>();
    const free = (x: number, y: number) => inCella(x, y) && !occ.hasXY(x, y);
    const fitsS = (x: number, y: number, w: number, h: number, extra?: Set<string>) => {
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) {
        if (!inCella(x + dx, y + dy) || occ.hasXY(x + dx, y + dy)) return false;
        if (extra?.size && extra.has(key(x + dx, y + dy))) return false;
      }
      return true;
    };
    /** Celle degli edifici piazzati in questa simulazione. */
    const edif = new GridSet(problem.minX, problem.minY, GW, GH);
    /** Segna/libera un edificio della simulazione (celle occupate + celle edifici). */
    const rett = (x: number, y: number, w: number, h: number, v: 0 | 1) => { occ.setRect(x, y, w, h, v); edif.setRect(x, y, w, h, v); };
    /** Vero se il rettangolo tocca (perimetro) una strada NUOVA già tracciata:
     *  un edificio non deve toccare due dorsali (lato di strada sprecato). */
    const toccaAltraDorsale = (x: number, y: number, w: number, h: number) => {
      for (let dx = 0; dx < w; dx++) if (rd.has(key(x + dx, y - 1)) || rd.has(key(x + dx, y + h))) return true;
      for (let dy = 0; dy < h; dy++) if (rd.has(key(x - 1, y + dy)) || rd.has(key(x + w, y + dy))) return true;
      return false;
    };
    /** Edifici trattenuti (non disponibili per le dorsali) — vedi riservaAlti. */
    const trattenuti = new Set<string>();
    const pending = () => pool.filter(b => !fatti.has(b.id) && !trattenuti.has(b.id)).sort(p.order);
    /** Edifici riservati ai fine strada (non usati sui lati delle dorsali). */
    const riservati = new Set<string>();
    const place = (label: string, b: PlannerBuilding, x: number, y: number, road: string[], sy?: number, cap?: boolean) => {
      for (const k of road) { occ.add(k); rd.add(k); }
      rett(x, y, b.w, b.h, 1);
      fatti.add(b.id);
      azioni.push({ label, id: b.id, x, y, w: b.w, h: b.h, road, sy, cap, from: spostati.get(b.id) });
    };

    /** Righe in cui una dorsale può diramarsi dalla verticale in questa simulazione. */
    const haVerticale = (r: number) => roads.has(key(vx, r)) || rd.has(key(vx, r));
    const okRigaS = (r: number) => haVerticale(r) && free(x0, r);
    const liberati: string[] = [];
    /** Celle di strada nuove non legate a un edificio (allungamento della verticale senza fini strada). */
    const stradeExtra: string[] = [];
    // Rinuncia ai fini strada della verticale (Params.liberaN/liberaS).
    const liberaFine = (dir: 1 | -1) => {
      const righeV: number[] = [];
      for (const r of roads) { const i = r.indexOf(","); if (Number(r.slice(0, i)) === vx) righeV.push(Number(r.slice(i + 1))); }
      if (!righeV.length) return;
      const yE = dir > 0 ? Math.max(...righeV) : Math.min(...righeV);
      for (const b of problem.buildings) {
        if (b.isTownhall || b.roadLevel === 0 || fissi.has(b.id) || spostati.has(b.id) || !placements.has(b.id)) continue;
        const q = placements.get(b.id)!;
        const copreTappo = vx >= q.x && vx < q.x + b.w && (yE + dir) >= q.y && (yE + dir) < q.y + b.h;
        const laterale = q.x === vx + 1 && yE >= q.y && yE < q.y + b.h && (dir > 0 ? q.y + b.h - 1 > yE : q.y < yE);
        if (!copreTappo && !laterale) continue;
        for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) occ.delete(key(q.x + dx, q.y + dy));
        spostati.set(b.id, { x: q.x, y: q.y });
        liberati.push(b.id);
        pool.push(b);
      }
    };
    if (p.liberaS) liberaFine(1);
    if (p.liberaN) liberaFine(-1);

    // Allungamento della verticale (Params.extN/extS).
    const allunga = (dir: 1 | -1, k: number) => {
      if (k <= 0) return;
      const righeV: number[] = [];
      for (const r of [...roads, ...rd]) { const i = r.indexOf(","); if (Number(r.slice(0, i)) === vx) righeV.push(Number(r.slice(i + 1))); }
      if (!righeV.length) return;
      const yE = dir > 0 ? Math.max(...righeV) : Math.min(...righeV);
      const posOf = (id: string) => azioni.find(a => a.id === id && !a.libera) ?? placements.get(id);
      // Edifici di fine strada: chi copre la cella oltre l'estremità (tappo) e
      // chi, a est, tocca l'ultima cella e sporge oltre (laterale).
      const gruppo: PlannerBuilding[] = [];
      for (const b of problem.buildings) {
        if (b.isTownhall || fissi.has(b.id) || spostati.has(b.id) || !placements.has(b.id)) continue;
        const q = posOf(b.id)!;
        const copreTappo = vx >= q.x && vx < q.x + b.w && (yE + dir) >= q.y && (yE + dir) < q.y + b.h;
        const laterale = q.x === vx + 1 && yE >= q.y && yE < q.y + b.h && (dir > 0 ? q.y + b.h - 1 > yE : q.y < yE);
        if (copreTappo || laterale) gruppo.push(b);
      }
      const celleDi = (x: number, y: number, w: number, h: number) => {
        const out: string[] = [];
        for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) out.push(key(x + dx, y + dy));
        return out;
      };
      const vecchie = new Set<string>();
      for (const b of gruppo) { const q = posOf(b.id)!; for (const c of celleDi(q.x, q.y, b.w, b.h)) vecchie.add(c); }
      // Il passo massimo fattibile fino a k.
      let passo = 0;
      for (let t = 1; t <= k; t++) {
        const okT = gruppo.every(b => { const q = posOf(b.id)!; return celleDi(q.x, q.y + dir * t, b.w, b.h).every(c => problem.cells.has(c) && (!occ.has(c) || vecchie.has(c))); })
          && Array.from({ length: t }, (_, i) => key(vx, yE + dir * (i + 1))).every(c => problem.cells.has(c) && (!occ.has(c) || vecchie.has(c)));
        if (okT) passo = t; else break;
      }
      if (!passo) return;
      for (const c of vecchie) occ.delete(c);
      const strada = Array.from({ length: passo }, (_, i) => key(vx, yE + dir * (i + 1)));
      for (const b of gruppo) {
        const q = posOf(b.id)!;
        spostati.set(b.id, { x: q.x, y: q.y });
        place("allungamento della verticale", b, q.x, q.y + dir * passo, b === gruppo[0] ? strada : []);
      }
      if (!gruppo.length) { for (const c of strada) { occ.add(c); rd.add(c); stradeExtra.push(c); } }
    };
    allunga(1, p.extS ?? 0);
    allunga(-1, p.extN ?? 0);

    // Scambio col builder (vedi Params.swapBuilder): il più grande dei grandi
    // piazzati dal builder lascia il posto al più piccolo dei grandi da
    // piazzare (allineato a uno degli angoli del suo posto, purché tocchi una
    // strada) e torna in gioco: sarà il candidato fine strada più grande.
    if (p.swapBuilder) {
      const piazzatiGrandi = problem.buildings
        .filter(b => !b.isTownhall && !fissi.has(b.id) && b.roadLevel > 0 && b.w >= LATO_GRANDE && b.h >= LATO_GRANDE && placements.has(b.id))
        .sort((a, b) => b.w * b.h - a.w * a.h);
      const daGrandi = pool.filter(b => b.w >= LATO_GRANDE && b.h >= LATO_GRANDE).sort((a, b) => a.w * a.h - b.w * b.h);
      const toccaStrada = (x: number, y: number, w: number, h: number) => {
        for (let dx = 0; dx < w; dx++) if (roads.has(key(x + dx, y - 1)) || roads.has(key(x + dx, y + h))) return true;
        for (let dy = 0; dy < h; dy++) if (roads.has(key(x - 1, y + dy)) || roads.has(key(x + w, y + dy))) return true;
        return false;
      };
      fuori: for (const B of piazzatiGrandi) for (const G of daGrandi) {
        if (spostati.has(B.id)) continue;
        if (G.w * G.h >= B.w * B.h || G.w > B.w || G.h > B.h) continue;
        const pB = placements.get(B.id)!;
        for (const [gx, gy] of [[pB.x, pB.y], [pB.x + B.w - G.w, pB.y], [pB.x, pB.y + B.h - G.h], [pB.x + B.w - G.w, pB.y + B.h - G.h]] as Array<[number, number]>) {
          if (!toccaStrada(gx, gy, G.w, G.h)) continue;
          for (let dx = 0; dx < B.w; dx++) for (let dy = 0; dy < B.h; dy++) occ.delete(key(pB.x + dx, pB.y + dy));
          spostati.set(B.id, { x: pB.x, y: pB.y });
          place("scambio col builder", G, gx, gy, []);
          azioni[azioni.length - 1]!.libera = B.id;
          pool.push(B);
          break fuori;
        }
      }
    }

    type Item = { b: PlannerBuilding; x: number; y: number; cap?: boolean };
    type PianoD = { items: Item[]; roadEnd: number };
    /** Riempie i due lati della dorsale sulla riga sy con gli edifici in
     *  `lista`, da x0 verso est, senza superare la colonna xMax (ultima cella
     *  di strada utilizzabile). `extra` = celle già riservate nel piano. */
    const latiDorsale = (sy: number, xMax: number, lista: PlannerBuilding[], extra: Set<string>, items: Item[], forza?: Map<string, "n" | "s">) => {
      const cursor = { n: x0, s: x0 };
      let alterna: "n" | "s" = "n";
      let roadEnd = x0 - 1;
      for (const b of lista) {
        const firstX = (side: "n" | "s"): number | null => {
          const by = side === "n" ? sy - b.h : sy + 1;
          for (let x = cursor[side]; x <= xMax; x++) if (fitsS(x, by, b.w, b.h, extra) && !toccaAltraDorsale(x, by, b.w, b.h)) return x;
          return null;
        };
        const f = forza?.get(b.id);
        const xn = f === "s" ? null : firstX("n"), xs = f === "n" ? null : firstX("s");
        if (xn === null && xs === null) continue;
        let side: "n" | "s";
        if (xn === null) side = "s";
        else if (xs === null) side = "n";
        else if (p.side === "north") side = "n";
        else if (p.side === "south") side = "s";
        else if (p.side === "balance") { side = alterna; alterna = alterna === "n" ? "s" : "n"; }
        else side = xn <= xs ? "n" : "s";
        const x = side === "n" ? xn! : xs!;
        const by = side === "n" ? sy - b.h : sy + 1;
        items.push({ b, x, y: by });
        for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) extra.add(key(x + dx, by + dy));
        cursor[side] = x + b.w;
        roadEnd = Math.max(roadEnd, x);
      }
      return roadEnd;
    };
    /** Celle libere della riga sy da x0 verso est. La dorsale si ferma dove una
     *  sua cella sarebbe adiacente (nord/sud) a un edificio già piazzato o a
     *  un'altra strada nuova: niente strade affiancate, niente edifici che
     *  toccano due dorsali. */
    const lunghezzaLibera = (sy: number) => {
      let n = 0;
      const bloccata = (x: number, y: number) => edif.has(key(x, y)) || rd.has(key(x, y));
      while (free(x0 + n, sy) && !bloccata(x0 + n, sy - 1) && !bloccata(x0 + n, sy + 1)) n++;
      return n;
    };

    /** Dorsale SENZA fine strada (simulazione): la strada si allunga solo fin dove serve. */
    const pianoDorsale = (sy: number, cap: number, lista?: PlannerBuilding[], forza?: Map<string, "n" | "s">): PianoD => {
      let maxLen = lunghezzaLibera(sy);
      maxLen = Math.max(1, Math.min(maxLen, Math.ceil(maxLen * cap)));
      const items: Item[] = [];
      if (!free(x0, sy)) return { items, roadEnd: x0 - 1 };
      const extra = new Set<string>();
      for (let i = 0; i < maxLen; i++) extra.add(key(x0 + i, sy));
      const roadEnd = latiDorsale(sy, x0 + maxLen - 1, lista ?? pending(), extra, items, forza);
      return { items, roadEnd };
    };

    /** Dorsale CON fine strada: strada di lunghezza fissa len, coppia (L, C)
     *  all'estremità est secondo la variante, poi gli altri edifici sui lati.
     *  null se i due edifici del fine strada non entrano. */
    const provaDorsaleCap = (sy: number, len: number, pair: [PlannerBuilding, PlannerBuilding], vi: number,
      lista?: PlannerBuilding[], forza?: Map<string, "n" | "s">): PianoD | null => {
      const xe = x0 + len - 1;
      const v = CAP_VARIANTS[vi]!;
      const L = pair[v.l], C = pair[1 - v.l]!;
      const lx = v.align === "flush" ? xe - L.w + 1 : xe;
      const ly = v.side === "n" ? sy - L.h : sy + 1;
      const cx = xe + 1;
      const versoL = v.cDir === "toward";
      const cy = (v.side === "n") === versoL ? sy - C.h + 1 : sy;
      // Controlli numerici PRIMA di costruire l'insieme `extra` (ottimizzazione:
      // la maggior parte delle combinazioni lunghezza/variante fallisce qui).
      // Equivalenti a fitsS(..., extra) con extra = strada + L.
      const suStrada = (x: number, y: number, w: number, h: number) => sy >= y && sy < y + h && x <= xe && x + w - 1 >= x0;
      if (suStrada(lx, ly, L.w, L.h) || !fitsS(lx, ly, L.w, L.h) || toccaAltraDorsale(lx, ly, L.w, L.h)) return null;
      const suL = cx < lx + L.w && cx + C.w > lx && cy < ly + L.h && cy + C.h > ly;
      if (suStrada(cx, cy, C.w, C.h) || suL || !fitsS(cx, cy, C.w, C.h) || toccaAltraDorsale(cx, cy, C.w, C.h)) return null;
      const extra = new Set<string>();
      for (let x = x0; x <= xe; x++) extra.add(key(x, sy));
      for (let dx = 0; dx < L.w; dx++) for (let dy = 0; dy < L.h; dy++) extra.add(key(lx + dx, ly + dy));
      for (let dx = 0; dx < C.w; dx++) for (let dy = 0; dy < C.h; dy++) extra.add(key(cx + dx, cy + dy));
      const items: Item[] = [];
      latiDorsale(sy, xe, (lista ?? pending()).filter(b => b.id !== L.id && b.id !== C.id && !riservati.has(b.id)), extra, items, forza);
      items.push({ b: L, x: lx, y: ly, cap: true }, { b: C, x: cx, y: cy, cap: true });
      return { items, roadEnd: xe };
    };
    const pianoDorsaleCap = (sy: number, pair: [PlannerBuilding, PlannerBuilding], fattore: number, v0: number, nDorsali: number,
      lista?: PlannerBuilding[], forza?: Map<string, "n" | "s">, lenStart?: number): PianoD | null => {
      if (!free(x0, sy)) return null;
      const maxLen = lunghezzaLibera(sy);
      const larghezzaAltri = pending().filter(b => !riservati.has(b.id)).reduce((t, b) => t + b.w, 0);
      const stima = lenStart ?? Math.round(larghezzaAltri / (2 * nDorsali) * fattore) + Math.max(pair[0].w, pair[1].w);
      const len0 = Math.min(maxLen, Math.max(1, stima));
      // Si prova la lunghezza stimata, poi via via più corte/lunghe; per
      // ciascuna tutte le varianti geometriche, a partire da quella del piano.
      // fattore <= 0: la dorsale più CORTA in cui la coppia entra.
      for (let t = 0; t < 2 * maxLen; t++) {
        const len = fattore <= 0 ? t + 1 : len0 + (t % 2 ? -(t + 1) / 2 : t / 2);
        if (len < 1 || len > maxLen) continue;
        for (let k = 0; k < CAP_VARIANTS.length; k++) {
          const r = provaDorsaleCap(sy, len, pair, (v0 + k) % CAP_VARIANTS.length, lista, forza);
          if (r) return r;
        }
      }
      return null;
    };
    const applicaDorsale = (sy: number, piano: PianoD, label: string) => {
      let built = x0 - 1;
      for (const it of piano.items) {
        const road: string[] = [];
        const fino = it.cap ? piano.roadEnd : it.x;
        while (built < fino) { built++; road.push(key(built, sy)); }
        place(it.cap ? `${label} · fine strada` : label, it.b, it.x, it.y, road, sy, it.cap);
      }
    };
    /** Lato est della verticale. `evita` = righe delle dorsali ancora da
     *  tracciare: lì non si piazza nulla (la dorsale deve poter partire). Gli
     *  edifici riservati ai fine strada restano fuori. */
    const latoEstVerticale = (evita: number[] = [], soloLarghi = false) => {
      const righe = new Set<number>();
      for (const r of [...roads, ...rd]) { const [rx, ry] = r.split(",").map(Number) as [number, number]; if (rx === vx) righe.add(ry); }
      if (!righe.size) return;
      const yTop = Math.min(...righe), yBot = Math.max(...righe);
      // Prima i più "larghi" (w - h maggiore): sulla verticale si attaccano col
      // lato corto (l'altezza h), che è proprio quello che tocca la strada.
      for (const b of pending().filter(t => !riservati.has(t.id) && (!soloLarghi || t.w >= t.h))
        .sort((a, c) => (c.w - c.h) - (a.w - a.h) || c.w - a.w || c.h - a.h)) {
        let best: number | null = null;
        for (let by = yTop - b.h + 1; by <= yBot; by++) {
          if (evita.some(r => r >= by - (p.gapS ?? 1) && r <= by + b.h - 1 + (p.gapN ?? 1))) continue; // spazio libero attorno alla dorsale futura
          let tocca = false;
          for (let r = by; r < by + b.h && !tocca; r++) if (righe.has(r)) tocca = true;
          if (!tocca || !fitsS(vx + 1, by, b.w, b.h) || toccaAltraDorsale(vx + 1, by, b.w, b.h)) continue;
          if (best === null || Math.abs(by + b.h / 2 - sy0) < Math.abs(best + b.h / 2 - sy0)) best = by;
        }
        if (best !== null) place(LBL_VERTICALE, b, vx + 1, best, []);
      }
    };
    const dorsaliSecondarie = () => {
      for (let giro = 0; giro < 20 && pending().length; giro++) {
        const righe: number[] = [];
        for (const r of [...roads, ...rd]) { const [rx, ry] = r.split(",").map(Number) as [number, number]; if (rx === vx) righe.push(ry); }
        let best: { sy: number; piano: PianoD; score: number } | null = null;
        for (const sy of righe) {
          if (!free(x0, sy)) continue;
          const piano = pianoDorsale(sy, 1);
          if (!piano.items.length) continue;
          const area = piano.items.reduce((s, it) => s + it.b.w * it.b.h, 0);
          const occIt = new Set<string>();
          let yA = Infinity, yB = -Infinity;
          for (const it of piano.items) {
            yA = Math.min(yA, it.y); yB = Math.max(yB, it.y + it.b.h);
            for (let dx = 0; dx < it.b.w; dx++) for (let dy = 0; dy < it.b.h; dy++) occIt.add(key(it.x + dx, it.y + dy));
          }
          // Lati di strada che resterebbero inutilizzati: pesano come 2 strade
          // (una dorsale con un intero lato vuoto non deve mai vincere).
          let liberi = 0;
          for (let xx = x0; xx <= piano.roadEnd; xx++) for (const yy of [sy - 1, sy + 1])
            if (free(xx, yy) && !occIt.has(key(xx, yy))) liberi++;
          const strade = piano.roadEnd - x0 + 1 + PESO_LATO_LIBERO * liberi;
          let score: number;
          if (p.secondary === "ratio") score = area / strade;
          else if (p.secondary === "minRoad") score = -strade / piano.items.length;
          else {
            // "snug": come ratio, ma conta anche le celle che resterebbero vuote
            // fra le fasce di questa dorsale e ciò che c'è già (righe sprecate).
            let vuote = 0;
            for (let yy = yA - 2; yy < yB + 2; yy++) for (let xx = x0; xx <= piano.roadEnd; xx++)
              if (yy !== sy && free(xx, yy) && !occIt.has(key(xx, yy))) vuote++;
            score = area / (strade + PESO_SPRECO * vuote);
          }
          if (!best || score > best.score) best = { sy, piano, score };
        }
        if (!best) break;
        applicaDorsale(best.sy, best.piano, "dorsale secondaria");
      }
    };

    /** "Pettine": K dorsali parallele pianificate insieme. Le fasce sono
     *  2K (nord e sud di ogni dorsale, dall'alto in basso); si riempiono con
     *  gli edifici in ordine di altezza decrescente, PRIMA le due fasce esterne
     *  (nord della prima, sud dell'ultima: lì l'altezza non costa nulla), poi
     *  quelle interne, così gli edifici di altezza simile finiscono nella
     *  stessa fascia. La distanza fra due dorsali = fascia sud della prima +
     *  fascia nord della seconda (+ i fine strada). La dorsale combAnchor sta
     *  sulla riga centrale; se le righe non sono valide si trasla il pettine.
     *  I fine strada vanno sulla prima e sull'ultima dorsale (esterne). */
    const pettine = (Kreq: number, coppieP: Array<[PlannerBuilding, PlannerBuilding]>) => {
      const lista = pending().filter(b => !riservati.has(b.id)).sort((a, b) => b.h - a.h || p.order(a, b));
      const sommaW = lista.reduce((t, b) => t + b.w, 0);
      const fattore = (p.lenFactor[0] ?? 1) > 0 ? p.lenFactor[0]! : 1;
      let K = Kreq, L: number;
      if (Kreq < 0) {
        // Pettine "pieno" (città piccole e dense): ogni fascia lunga quanto lo
        // spazio libero verso est (× fattore ≤ 1), dorsali quante ne servono.
        let libero = 0;
        for (let d = -3; d <= 3; d++) libero = Math.max(libero, lunghezzaLibera(sy0 + d));
        L = Math.max(4, Math.floor(libero * Math.min(1, fattore)));
        K = Math.max(1, Math.min(10, Math.ceil(sommaW / (2 * L)) + (p.combPiu ?? 0)));
      } else L = Math.max(4, Math.ceil(sommaW / (2 * K) * fattore));
      const ordineFasce = [0, 2 * K - 1];
      for (let j = 1; j < 2 * K - 1; j++) ordineFasce.push(j);
      const fasce: PlannerBuilding[][] = Array.from({ length: 2 * K }, () => []);
      const largh = Array.from({ length: 2 * K }, () => 0);
      let fi = 0;
      for (const b of lista) {
        while (fi < ordineFasce.length - 1 && largh[ordineFasce[fi]!]! > 0 && largh[ordineFasce[fi]!]! + b.w > L) fi++;
        const j = ordineFasce[fi]!;
        fasce[j]!.push(b); largh[j]! += b.w;
      }
      const pairOf: Array<[PlannerBuilding, PlannerBuilding] | null> = Array.from({ length: K }, () => null);
      if (coppieP[0]) pairOf[0] = coppieP[0];
      if (coppieP[1]) pairOf[K - 1] = coppieP[1];
      const hFascia = (j: number) => fasce[j]!.reduce((m, b) => Math.max(m, b.h), 0);
      const hCap = (i: number) => (pairOf[i] ? Math.max(pairOf[i]![0].h, pairOf[i]![1].h) : 0);
      const off = [0];
      for (let i = 0; i < K - 1; i++)
        off.push(off[i]! + Math.max(hFascia(2 * i + 1), hCap(i)) + Math.max(hFascia(2 * i + 2), hCap(i + 1)) + 1);
      const a = p.combAnchor < 0 ? Math.floor(K / 2) : Math.min(K - 1, Math.max(0, p.combAnchor % K));
      const base = sy0 - off[a]!;
      let rows: number[] | null = null;
      for (let d = 0; d <= 40 && !rows; d++) for (const sgn of d ? [1, -1] : [1]) {
        const r = off.map(o => o + base + sgn * d);
        // le fasce esterne (con gli alti) devono stare dentro la mappa: le
        // celle sopra la prima dorsale e sotto l'ultima, per tutta l'altezza
        // della fascia, devono esistere (verificato su qualche colonna)
        const hTop = Math.max(hFascia(0), hCap(0)), hBot = Math.max(hFascia(2 * K - 1), hCap(K - 1));
        const dentro = (y: number) => [2, 6, 10].some(dx => problem.cells.has(key(x0 + dx, y)));
        const fasceDentro = !p.altiEsterni || (dentro(r[0]! - hTop) && dentro(r[r.length - 1]! + hBot));
        if (r.every(okRigaS) && fasceDentro) { rows = r; break; }
      }
      if (!rows) return null;
      const rr = rows;
      return {
        rows: rr,
        spine: rr.map((row, i) => {
          const forza = new Map<string, "n" | "s">();
          for (const b of fasce[2 * i]!) forza.set(b.id, "n");
          for (const b of fasce[2 * i + 1]!) forza.set(b.id, "s");
          return { row, pair: pairOf[i], forza, lista: [...fasce[2 * i]!, ...fasce[2 * i + 1]!] };
        }),
      };
    };

    /** Ricompattazione delle dorsali (idea dell'utente: "scambia tutta la fila
     *  rosa con la fila rossa"). Le dorsali orizzontali, dall'alto in basso,
     *  vengono riaccostate: la distanza fra due dorsali diventa esattamente
     *  fascia sud della prima + fascia nord della seconda + 1 (spariscono le
     *  righe vuote fra le fasce) e, per ogni dorsale senza fine strada, si può
     *  SCAMBIARE la fascia nord con la sud (gli edifici mantengono la loro x).
     *  Si provano tutte le combinazioni di scambi (fino a 2^6) e ogni dorsale
     *  come àncora (resta sulla sua riga); vince la combinazione valida con
     *  meno lati di strada liberi, poi meno celle vuote nella zona. Lo spazio
     *  liberato serve poi agli edifici rimasti. true se ha cambiato qualcosa. */
    const ricompatta = (): boolean => {
      const righe = [...new Set(azioni.filter(a => a.sy !== undefined).map(a => a.sy!))].sort((a, b) => a - b);
      const K = righe.length;
      if (K < 2 || K > 8) return false;
      const sp = righe.map(row => {
        const items = azioni.filter(a => a.sy === row);
        const strada: number[] = [];
        for (const k of rd) { const i = k.indexOf(","), rx = Number(k.slice(0, i)), ry = Number(k.slice(i + 1)); if (ry === row && rx >= x0) strada.push(rx); }
        let hN = 0, hS = 0;
        for (const a of items) {
          if (a.y < row) hN = Math.max(hN, row - a.y);
          if (a.y + a.h - 1 > row) hS = Math.max(hS, a.y + a.h - 1 - row);
        }
        return { row, items, strada, hN, hS, fissa: items.some(a => a.cap) };
      });
      // Stato di base: tutto tranne le dorsali (strade e edifici).
      const base = occ.clone();
      for (const s0 of sp) {
        for (const x of s0.strada) base.delete(key(x, s0.row));
        for (const a of s0.items) for (let dx = 0; dx < a.w; dx++) for (let dy = 0; dy < a.h; dy++) base.delete(key(a.x + dx, a.y + dy));
      }
      // Versione numerica (ottimizzazione): celle aggiunte e strade della
      // prova corrente marcate con un timbro su griglia invece che in Set.
      const exG = new Int32Array(GW * GH), stG = new Int32Array(GW * GH);
      let st = 0;
      const liberaB = (x: number, y: number) => { const i = gIdx(x, y); return i >= 0 && cellGrid[i] === 1 && base.g[i] !== 1 && exG[i] !== st; };
      type Prova = { rows: number[]; swap: boolean[]; liberi: number; vuote: number };
      const valuta = (swap: boolean[], anchor: number): Prova | null => {
        st++;
        const hN = sp.map((s0, i) => Math.max(1, swap[i] ? s0.hS : s0.hN));
        const hS = sp.map((s0, i) => Math.max(1, swap[i] ? s0.hN : s0.hS));
        const rows = sp.map(s0 => s0.row);
        for (let i = anchor + 1; i < K; i++) rows[i] = rows[i - 1]! + hS[i - 1]! + hN[i]! + 1;
        for (let i = anchor - 1; i >= 0; i--) rows[i] = rows[i + 1]! - hN[i + 1]! - hS[i]! - 1;
        if (!rows.every(haVerticale)) return null;
        const sx: number[] = [], sy: number[] = [];
        for (let i = 0; i < K; i++) for (const x of sp[i]!.strada) {
          if (!liberaB(x, rows[i]!)) return null;
          const g = gIdx(x, rows[i]!);
          exG[g] = st; stG[g] = st; sx.push(x); sy.push(rows[i]!);
        }
        for (let i = 0; i < K; i++) {
          const s0 = sp[i]!;
          for (const a of s0.items) {
            const ny = a.cap || !swap[i] ? a.y - s0.row + rows[i]! : a.y < s0.row ? rows[i]! + 1 : rows[i]! - a.h;
            for (let dx = 0; dx < a.w; dx++) for (let dy = 0; dy < a.h; dy++) {
              if (!liberaB(a.x + dx, ny + dy)) return null;
              exG[gIdx(a.x + dx, ny + dy)] = st;
            }
            // non deve toccare la strada di un'altra dorsale
            for (let dx = -1; dx <= a.w; dx++) for (let dy = -1; dy <= a.h; dy++) {
              if ((dx === -1 || dx === a.w) === (dy === -1 || dy === a.h)) continue; // solo i 4 lati, niente angoli
              const yy = ny + dy;
              if (yy === rows[i]) continue;
              const g = gIdx(a.x + dx, yy);
              if (g >= 0 && stG[g] === st) return null;
            }
          }
        }
        let liberi = 0;
        for (let t = 0; t < sx.length; t++) {
          if (liberaB(sx[t]!, sy[t]! - 1)) liberi++;
          if (liberaB(sx[t]!, sy[t]! + 1)) liberi++;
        }
        const yA = rows[0]! - hN[0]!, yB = rows[K - 1]! + hS[K - 1]!;
        let vuote = 0, xR = x0;
        for (const s0 of sp) for (const x of s0.strada) xR = Math.max(xR, x);
        for (let yy = yA; yy <= yB; yy++) for (let xx = x0; xx <= xR; xx++) if (liberaB(xx, yy)) vuote++;
        return { rows, swap, liberi, vuote };
      };
      const nonFisse = sp.map((s0, i) => (s0.fissa ? -1 : i)).filter(i => i >= 0).slice(0, 6);
      let migliore: Prova | null = null;
      const attuale = valuta(sp.map(() => false), 0);
      for (let m = 0; m < 1 << nonFisse.length; m++) {
        const swap = sp.map(() => false);
        nonFisse.forEach((i, b) => { if (m & (1 << b)) swap[i] = true; });
        for (let anchor = 0; anchor < K; anchor++) {
          const r = valuta(swap, anchor);
          if (r && (!migliore || r.liberi < migliore.liberi || (r.liberi === migliore.liberi && r.vuote < migliore.vuote))) migliore = r;
        }
      }
      if (!migliore) return false;
      // Confronto con la disposizione attuale (non ricompattata).
      let liberiOra = 0;
      for (const k of rd) { const i = k.indexOf(","), rx = Number(k.slice(0, i)), ry = Number(k.slice(i + 1)); if (free(rx, ry - 1)) liberiOra++; if (free(rx, ry + 1)) liberiOra++; }
      const cambia = migliore.rows.some((r, i) => r !== sp[i]!.row) || migliore.swap.some(Boolean);
      if (!cambia || (attuale && migliore.liberi > liberiOra) || migliore.liberi > liberiOra) return false;
      // Applica: sposta strade ed edifici delle dorsali.
      for (const s0 of sp) {
        for (const x of s0.strada) { occ.delete(key(x, s0.row)); rd.delete(key(x, s0.row)); }
        for (const a of s0.items) rett(a.x, a.y, a.w, a.h, 0);
      }
      sp.forEach((s0, i) => {
        const row = migliore!.rows[i]!;
        for (const x of s0.strada) { occ.add(key(x, row)); rd.add(key(x, row)); }
        for (const a of s0.items) {
          a.y = a.cap || !migliore!.swap[i] ? a.y - s0.row + row : a.y < s0.row ? row + 1 : row - a.h;
          a.road = a.road.map(k => key(Number(k.slice(0, k.indexOf(","))), row));
          a.sy = row;
          rett(a.x, a.y, a.w, a.h, 1);
        }
      });
      return true;
    };

    /** Fini strada più grandi possibile (regola dell'utente): se un edificio
     *  più grande di un fine strada sta altrove (sui lati di una dorsale o
     *  sulla verticale), si scambiano i due posti, mantenendo gli ancoraggi
     *  (L adiacente all'ultima cella di strada, C sul suo lato est; l'altro
     *  allineato alla sua strada). Così la dorsale si libera di spazio. */
    const scambiaFiniStrada = () => {
      const fineStrada = (row: number) => {
        let xe = -Infinity;
        for (const k of rd) { const i = k.indexOf(","); if (Number(k.slice(i + 1)) === row) xe = Math.max(xe, Number(k.slice(0, i))); }
        return xe;
      };
      const libera = (x: number, y: number, w: number, h: number, ignora: Set<string>) => {
        for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) {
          const k = key(x + dx, y + dy);
          if (!problem.cells.has(k) || (occ.has(k) && !ignora.has(k))) return false;
        }
        return true;
      };
      /** Il rettangolo tocca solo strade della propria riga o la verticale? */
      const toccaSoloSua = (x: number, y: number, w: number, h: number, row: number | undefined) => {
        const ok = (k: string) => {
          if (!rd.has(k)) return true;
          return row !== undefined && Number(k.slice(k.indexOf(",") + 1)) === row;
        };
        for (let dx = 0; dx < w; dx++) if (!ok(key(x + dx, y - 1)) || !ok(key(x + dx, y + h))) return false;
        for (let dy = 0; dy < h; dy++) if (!ok(key(x - 1, y + dy)) || !ok(key(x + w, y + dy))) return false;
        return true;
      };
      const celle = (a: { x: number; y: number; w: number; h: number }) => {
        const out: string[] = [];
        for (let dx = 0; dx < a.w; dx++) for (let dy = 0; dy < a.h; dy++) out.push(key(a.x + dx, a.y + dy));
        return out;
      };
      for (const a of azioni.filter(t => t.cap && t.sy !== undefined)) {
        const row = a.sy!, xe = fineStrada(row);
        const ruoloC = a.x === xe + 1;
        const nord = a.y + a.h - 1 < row, sopraC = a.y + a.h - 1 === row; // C: la sua ultima riga è quella della strada
        const flush = a.x + a.w - 1 === xe;
        const altri = azioni.filter(t => !t.cap && t.id !== a.id && t.w * t.h > a.w * a.h
          && (t.label === LBL_VERTICALE || t.sy !== undefined)).sort((p1, p2) => p2.w * p2.h - p1.w * p1.h);
        for (const b of altri) {
          // b nel posto di a
          const bx = ruoloC ? xe + 1 : flush ? xe - b.w + 1 : xe;
          const by = ruoloC ? (sopraC ? row - b.h + 1 : row) : nord ? row - b.h : row + 1;
          // a nel posto di b
          let ax: number, ay: number;
          if (b.label === LBL_VERTICALE) { ax = vx + 1; ay = b.y; }
          else { ax = b.x; ay = b.y < b.sy! ? b.sy! - a.h : b.sy! + 1; }
          const ignora = new Set([...celle(a), ...celle(b)]);
          const nb = { x: bx, y: by, w: b.w, h: b.h }, na = { x: ax, y: ay, w: a.w, h: a.h };
          if (!libera(bx, by, b.w, b.h, ignora) || !libera(ax, ay, a.w, a.h, ignora)) continue;
          const cb = new Set(celle(nb));
          if (celle(na).some(k => cb.has(k))) continue;
          if (!toccaSoloSua(bx, by, b.w, b.h, row) || !toccaSoloSua(ax, ay, a.w, a.h, b.sy)) continue;
          for (const k of ignora) { occ.delete(k); edif.delete(k); }
          for (const k of [...celle(nb), ...celle(na)]) { occ.add(k); edif.add(k); }
          const [aLbl, aSy, aRoad] = [a.label, a.sy, a.road];
          a.x = ax; a.y = ay; a.label = b.label; a.sy = b.sy; a.cap = false; a.road = b.road;
          b.x = bx; b.y = by; b.label = aLbl; b.sy = aSy; b.cap = true; b.road = aRoad;
          break;
        }
      }
    };

    /** Compattazione delle dorsali (idea dell'utente: "ridurre la strada
     *  orizzontale compattando tutto"). Per ogni dorsale: gli edifici di
     *  ciascuna fascia scivolano verso ovest (verso la verticale) fino al primo
     *  posto libero, riempiendo i buchi; poi la coppia di fine strada si
     *  riaccosta (stessa variante) e la strada si accorcia fino all'inizio
     *  dell'ultimo edificio o fino al fine strada. */
    const compattaDorsali = () => {
      const righe = [...new Set(azioni.filter(a => a.sy !== undefined).map(a => a.sy!))];
      const celle = (x: number, y: number, w: number, h: number) => {
        const out: string[] = [];
        for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) out.push(key(x + dx, y + dy));
        return out;
      };
      const libero = (x: number, y: number, w: number, h: number) => fitsS(x, y, w, h);
      const toccaAltre = (x: number, y: number, w: number, h: number, row: number) => {
        const altra = (k: string) => rd.has(k) && Number(k.slice(k.indexOf(",") + 1)) !== row;
        for (let dx = 0; dx < w; dx++) if (altra(key(x + dx, y - 1)) || altra(key(x + dx, y + h))) return true;
        for (let dy = 0; dy < h; dy++) if (altra(key(x - 1, y + dy)) || altra(key(x + w, y + dy))) return true;
        return false;
      };
      /** Ribilanciamento: ridistribuisce gli edifici (non fine strada) della
       *  dorsale fra fascia nord e sud in modo che le due fasce abbiano
       *  lunghezza il più possibile uguale (somma delle larghezze, DP subset
       *  sum; il fine strada L conta sul suo lato), li riposiziona da x0 e
       *  riaccosta il fine strada. Applicato solo se la strada si accorcia. */
      const bilancia = (row: number): boolean => {
        const items = azioni.filter(a => a.sy === row);
        const regs = items.filter(a => !a.cap);
        const caps = items.filter(a => a.cap);
        if (regs.length < 2) return false;
        let oldEnd = -Infinity;
        for (const k of rd) { const i = k.indexOf(","); if (Number(k.slice(i + 1)) === row) oldEnd = Math.max(oldEnd, Number(k.slice(0, i))); }
        if (!Number.isFinite(oldEnd)) return false;
        // Lato e larghezza del fine strada L (quello che non sta a est della strada).
        const L = caps.find(c => c.x <= oldEnd);
        // Regola degli alti: sulla dorsale più in alto gli edifici con h >= 6
        // vanno a nord, su quella più in basso a sud (fasce esterne).
        const ordinate = [...righe].sort((a, b) => a - b);
        const esterno: "n" | "s" | null = ordinate.length < 2 ? null : row === ordinate[0] ? "n" : row === ordinate[ordinate.length - 1] ? "s" : null;
        const forzati = esterno && p.altiEsterni ? regs.filter(a => a.h >= 6) : [];
        const migliora = forzati.some(a => (a.y < row) !== (esterno === "n"));
        const wForzati = forzati.reduce((t, a) => t + a.w, 0);
        const addN = (L && L.y < row ? L.w : 0) + (esterno === "n" ? wForzati : 0);
        const addS = (L && L.y > row ? L.w : 0) + (esterno === "s" ? wForzati : 0);
        const liberi = regs.filter(a => !forzati.includes(a));
        const tot = liberi.reduce((t, a) => t + a.w, 0);
        // DP: somme raggiungibili per la fascia nord.
        const da = new Int32Array(tot + 1).fill(-1); // da[s] = indice dell'ultimo edificio usato per arrivare a s
        const prec = new Int32Array(tot + 1).fill(-1);
        da[0] = liberi.length;
        liberi.forEach((a, i) => {
          for (let t = tot; t >= a.w; t--) if (da[t] === -1 && da[t - a.w] !== -1 && da[t - a.w] !== i) {
            // ogni edificio una sola volta: si scorre t all'indietro
            da[t] = i; prec[t] = t - a.w;
          }
        });
        let bestS = -1, bestCost = Infinity;
        for (let t = 0; t <= tot; t++) if (da[t] !== -1) {
          const c = Math.max(t + addN, tot - t + addS);
          if (c < bestCost) { bestCost = c; bestS = t; }
        }
        if (bestS < 0) return false;
        const nord = new Set<Azione>();
        for (let t = bestS; t > 0; t = prec[t]!) nord.add(liberi[da[t]!]!);
        if (esterno === "n") for (const a of forzati) nord.add(a);
        // Salva lo stato per l'eventuale ripristino.
        const salva = items.map(a => ({ a, x: a.x, y: a.y }));
        const celleDi = (a: { x: number; y: number; w: number; h: number }) => {
          const out: string[] = [];
          for (let dx = 0; dx < a.w; dx++) for (let dy = 0; dy < a.h; dy++) out.push(key(a.x + dx, a.y + dy));
          return out;
        };
        for (const a of items) rett(a.x, a.y, a.w, a.h, 0);
        const altraStrada = (x: number, y: number, w: number, h: number) => {
          const altra = (k: string) => rd.has(k) && Number(k.slice(k.indexOf(",") + 1)) !== row;
          for (let dx = 0; dx < w; dx++) if (altra(key(x + dx, y - 1)) || altra(key(x + dx, y + h))) return true;
          for (let dy = 0; dy < h; dy++) if (altra(key(x - 1, y + dy)) || altra(key(x + w, y + dy))) return true;
          return false;
        };
        const ok = (x: number, y: number, w: number, h: number) => fitsS(x, y, w, h) && !altraStrada(x, y, w, h);
        let maxStart = x0 - 1, riuscito = true;
        // Vincolo degli alti esterni: per metterli fuori la strada può anche
        // allungarsi (fino a 8 celle, se libere).
        const lim = oldEnd; // la strada non si allunga mai per gli alti (era +8: peggiorava il totale)
        const stradaLibera = (t: number) => { for (let x = oldEnd + 1; x <= t; x++) if (!free(x, row)) return false; return true; };
        for (const lato of ["n", "s"] as const) {
          let cur = x0;
          const lista = regs.filter(a => (lato === "n") === nord.has(a)).sort((a, b) => b.h - a.h);
          for (const a of lista) {
            const ny = lato === "n" ? row - a.h : row + 1;
            let x = cur;
            while (x <= lim && !ok(x, ny, a.w, a.h)) x++;
            if (x > lim) { riuscito = false; break; }
            a.x = x; a.y = ny; cur = x + a.w;
            rett(a.x, a.y, a.w, a.h, 1);
            maxStart = Math.max(maxStart, x);
          }
          if (!riuscito) break;
        }
        let xe = -1;
        if (riuscito) {
          if (caps.length === 2) {
            // Nuova estremità t (dalla più corta): tutte le varianti del fine
            // strada (ruoli L/C, lato, a filo/sporgente, verso di C).
            const pair = caps as [Azione, Azione];
            for (let t = Math.max(maxStart, x0); (t < oldEnd || (migliora && t <= lim)) && xe < 0; t++) {
              if (t > oldEnd && !stradaLibera(t)) break;
              // le celle di strada oltre t verranno tolte: contano come libere
              const ok = (x: number, y: number, w: number, h: number) => {
                for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) {
                  const cx = x + dx, cy = y + dy;
                  if (!inCella(cx, cy)) return false;
                  if (occ.hasXY(cx, cy) && !(cy === row && cx > t && rd.has(key(cx, cy)))) return false;
                }
                return !altraStrada(x, y, w, h);
              };
              for (const v of CAP_VARIANTS) {
                const Lc = pair[v.l], Cc = pair[1 - v.l]!;
                const lx = v.align === "flush" ? t - Lc.w + 1 : t;
                const ly = v.side === "n" ? row - Lc.h : row + 1;
                const cy = (v.side === "n") === (v.cDir === "toward") ? row - Cc.h + 1 : row;
                if (!ok(lx, ly, Lc.w, Lc.h)) continue;
                const lCells = new Set(celleDi({ x: lx, y: ly, w: Lc.w, h: Lc.h }));
                if (!ok(t + 1, cy, Cc.w, Cc.h) || celleDi({ x: t + 1, y: cy, w: Cc.w, h: Cc.h }).some(k => lCells.has(k))) continue;
                xe = t; Lc.x = lx; Lc.y = ly; Cc.x = t + 1; Cc.y = cy;
                break;
              }
            }
          } else if (!caps.length && (maxStart < oldEnd || migliora)) {
            const t = Math.max(maxStart, x0);
            if (t <= oldEnd || stradaLibera(t)) xe = t;
          }
        }
        if (xe < 0) {
          // Ripristino.
          for (const a of regs) rett(a.x, a.y, a.w, a.h, 0);
          for (const { a, x, y } of salva) { a.x = x; a.y = y; }
          for (const a of items) rett(a.x, a.y, a.w, a.h, 1);
          return false;
        }
        // prima si accorcia la strada, poi si marcano i fini strada (C può
        // occupare la cella appena liberata oltre la nuova estremità)
        for (let x = xe + 1; x <= oldEnd; x++) { occ.delete(key(x, row)); rd.delete(key(x, row)); }
        for (let x = oldEnd + 1; x <= xe; x++) { occ.add(key(x, row)); rd.add(key(x, row)); stradeExtra.push(key(x, row)); }
        for (const c of caps) rett(c.x, c.y, c.w, c.h, 1);
        for (const a of items) a.road = a.road.filter(k => Number(k.slice(0, k.indexOf(","))) <= xe);
        return true;
      };
      for (const row of righe) {
        if (bilancia(row)) continue;
        const items = azioni.filter(a => a.sy === row);
        let oldEnd = -Infinity;
        for (const k of rd) { const i = k.indexOf(","); if (Number(k.slice(i + 1)) === row) oldEnd = Math.max(oldEnd, Number(k.slice(0, i))); }
        if (!Number.isFinite(oldEnd)) continue;
        const regs = items.filter(a => !a.cap).sort((a, b) => a.x - b.x);
        const caps = items.filter(a => a.cap);
        for (const a of items) rett(a.x, a.y, a.w, a.h, 0);
        let maxStart = x0 - 1;
        for (const a of regs) {
          let nx = a.x;
          for (let x = x0; x < a.x; x++) if (libero(x, a.y, a.w, a.h) && !toccaAltre(x, a.y, a.w, a.h, row)) { nx = x; break; }
          a.x = nx;
          rett(a.x, a.y, a.w, a.h, 1);
          maxStart = Math.max(maxStart, a.x);
        }
        let xe = oldEnd;
        if (caps.length) {
          const rel = caps.map(c => c.x - oldEnd);
          for (let t = Math.max(maxStart, x0); t < oldEnd; t++) {
            const pos = caps.map((c, i) => ({ c, x: t + rel[i]! }));
            const tmp = new Set<string>();
            const ok = pos.every(({ c, x }) => {
              const cs = celle(x, c.y, c.w, c.h);
              const liberaT = (k: string) => !occ.has(k) || (rd.has(k) && Number(k.slice(k.indexOf(",") + 1)) === row && Number(k.slice(0, k.indexOf(","))) > t);
              if (!cs.every(k => problem.cells.has(k) && liberaT(k) && !tmp.has(k)) || toccaAltre(x, c.y, c.w, c.h, row)) return false;
              for (const k of cs) tmp.add(k);
              return true;
            });
            if (ok) { xe = t; for (const { c, x } of pos) c.x = x; break; }
          }
        } else xe = Math.max(maxStart, x0);
        // Accorcia la strada oltre xe, poi marca i fini strada.
        for (let x = xe + 1; x <= oldEnd; x++) { occ.delete(key(x, row)); rd.delete(key(x, row)); }
        for (const c of caps) rett(c.x, c.y, c.w, c.h, 1);
        for (const a of items) a.road = a.road.filter(k => Number(k.slice(0, k.indexOf(","))) <= xe);
      }
    };

    /** Edifici con strada rimasti attaccati a una strada GIÀ esistente (costo
     *  zero): angoli e spazi liberati attorno alla verticale (es. il fine
     *  strada dell'angolo dopo la rinuncia ai fini strada), estremità delle
     *  dorsali. Posizione più "incastrata" (più lati a contatto con edifici,
     *  strade o bordo); mai a contatto con due dorsali diverse. */
    const attaccaAStrade = () => {
      const lista = pending().filter(t => !riservati.has(t.id));
      if (!lista.length) return;
      // Versione numerica (ottimizzazione: era il 25% del tempo della ricerca
      // su Avito): strade su griglia (1 = esistente, 2 = nuova), posizioni già
      // viste con un timbro per edificio, stesso ordine di visita e stesse
      // scelte della versione a stringhe.
      const rg = new Uint8Array(GW * GH);
      const gi = gIdx;
      for (const r of roads) { const c = r.indexOf(","), i = gi(Number(r.slice(0, c)), Number(r.slice(c + 1))); if (i >= 0) rg[i] = 1; }
      for (const r of rd) { const c = r.indexOf(","), i = gi(Number(r.slice(0, c)), Number(r.slice(c + 1))); if (i >= 0) rg[i] = 2; }
      // Solo le celle di strada con almeno un vicino libero (le altre non
      // possono avere edifici nuovi accanto).
      const tx: number[] = [], ty: number[] = [];
      for (const r of [...roads, ...rd]) {
        const i = r.indexOf(","), rx = Number(r.slice(0, i)), ry = Number(r.slice(i + 1));
        if (free(rx + 1, ry) || free(rx - 1, ry) || free(rx, ry + 1) || free(rx, ry - 1)) { tx.push(rx); ty.push(ry); }
      }
      if (!tx.length) return;
      const visti = new Int32Array(GW * GH);
      let timbro = 0;
      /** Forme senza posto: un edificio identico non ne troverà (l'occupazione cresce soltanto). */
      const senzaPosto = new Set<string>();
      for (const b of lista.sort((a, c) => c.w * c.h - a.w * a.h)) {
        const forma = `${b.w}x${b.h}`;
        if (senzaPosto.has(forma)) continue;
        timbro++;
        let bx = 0, by = 0, bs = -1;
        for (let t = 0; t < tx.length; t++) {
          const rx = tx[t]!, ry = ty[t]!;
          // posizioni in cui il rettangolo è adiacente alla cella di strada (rx, ry)
          for (let x = rx - b.w; x <= rx + 1; x++) for (let y = ry - b.h; y <= ry + 1; y++) {
            const vi = gi(x, y);
            if (vi < 0) continue; // fuori griglia: non può entrare
            if (visti[vi] === timbro) continue;
            visti[vi] = timbro;
            if (!fitsS(x, y, b.w, b.h)) continue;
            // tocca una strada? e righe delle dorsali toccate (al più una)
            let tocca = false, riga = NaN, piuRighe = false, contatti = 0;
            const lato = (px: number, py: number) => {
              const pi = gi(px, py);
              const v = pi < 0 ? 0 : rg[pi]!;
              if (v) { tocca = true; if (v === 2 && px !== vx) { if (Number.isNaN(riga)) riga = py; else if (riga !== py) piuRighe = true; } }
              if (!inCella(px, py) || occ.hasXY(px, py)) contatti++;
            };
            for (let dx = 0; dx < b.w; dx++) { lato(x + dx, y - 1); lato(x + dx, y + b.h); }
            for (let dy = 0; dy < b.h; dy++) { lato(x - 1, y + dy); lato(x + b.w, y + dy); }
            if (!tocca || piuRighe) continue;
            if (contatti > bs) { bs = contatti; bx = x; by = y; }
          }
        }
        if (bs >= 0) place("attaccato a una strada esistente", b, bx, by, []);
        else senzaPosto.add(forma);
      }
    };

    /** Rete di sicurezza: ogni edificio con strada piazzato in questa
     *  simulazione deve toccare una strada. Chi non la tocca (dopo scambi e
     *  compattazioni) viene tolto e riattaccato a una strada esistente
     *  (attaccaAStrade); se non c'è posto resta escluso. */
    const riparaScollegati = () => {
      const toccaStrada = (a: Azione) => {
        for (let dx = 0; dx < a.w; dx++) for (const yy of [a.y - 1, a.y + a.h]) { const k = key(a.x + dx, yy); if (roads.has(k) || rd.has(k)) return true; }
        for (let dy = 0; dy < a.h; dy++) for (const xx of [a.x - 1, a.x + a.w]) { const k = key(xx, a.y + dy); if (roads.has(k) || rd.has(k)) return true; }
        return false;
      };
      const staccati = azioni.filter(a => byId.get(a.id)!.roadLevel > 0 && !toccaStrada(a));
      if (!staccati.length) return;
      for (const a of staccati) {
        rett(a.x, a.y, a.w, a.h, 0);
        fatti.delete(a.id);
        if (a.from && !liberati.includes(a.id)) liberati.push(a.id); // edificio del builder spostato: se non torna, va tolto
        // la strada attribuita all'azione resta (passa all'azione precedente, se c'è)
        const i = azioni.indexOf(a);
        if (a.road.length && i > 0) azioni[i - 1]!.road.push(...a.road);
        else if (a.road.length) stradeExtra.push(...a.road);
        azioni.splice(i, 1);
        if (!pool.some(b => b.id === a.id)) pool.push(byId.get(a.id)!);
      }
      attaccaAStrade();
    };

    /** Rifinitura delle punte (idea dell'utente: "si può subito eliminare una
     *  strada e spostare i due edifici sul fine strada"). Per ogni punta di
     *  strada nuova (cella foglia) si prova a togliere le ultime t = 1..3 celle:
     *  gli edifici piazzati qui che resterebbero senza strada (di norma la
     *  coppia di fine strada) vengono ripiazzati — ricerca esaustiva, al più 4
     *  edifici — in posizioni libere che toccano la strada rimasta, preferendo
     *  quelle vicine alla posizione attuale (anche scambiando i ruoli L/C del
     *  fine strada). Se tutti trovano posto la strada si accorcia. */
    const rifinisciPunte = () => {
      const vic = (k: string) => { const i = k.indexOf(","), x = Number(k.slice(0, i)), y = Number(k.slice(i + 1)); return [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)]; };
      const isRoad = (k: string) => rd.has(k) || roads.has(k);
      const perim = (x: number, y: number, w: number, h: number) => {
        const out: string[] = [];
        for (let dx = 0; dx < w; dx++) out.push(key(x + dx, y - 1), key(x + dx, y + h));
        for (let dy = 0; dy < h; dy++) out.push(key(x - 1, y + dy), key(x + w, y + dy));
        return out;
      };
      const celleR = (x: number, y: number, w: number, h: number) => {
        const out: string[] = [];
        for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) out.push(key(x + dx, y + dy));
        return out;
      };
      /** Azione / edificio di partenza che occupa ogni cella. */
      const azioneDi = new Map<string, Azione>();
      for (const a of azioni) for (const k of celleR(a.x, a.y, a.w, a.h)) azioneDi.set(k, a);
      const mossiBase = new Set([...azioni.map(a => a.id), ...liberati, ...azioni.filter(a => a.libera).map(a => a.libera!)]);
      const baseDi = new Map<string, string>();
      for (const [id, q] of placements) if (!mossiBase.has(id)) { const b = byId.get(id)!; for (const k of celleR(q.x, q.y, b.w, b.h)) baseDi.set(k, id); }
      for (let giri = 0; giri < 20; giri++) {
        let fatto = false;
        const foglie = [...rd].filter(k => vic(k).filter(isRoad).length === 1);
        for (const foglia of foglie) {
          // tratto finale: risale dalla foglia lungo la catena (solo strade nuove)
          const catena: string[] = [foglia];
          let prev = "", cur = foglia;
          for (let t = 0; t < 4; t++) {
            const nx = vic(cur).filter(n => isRoad(n) && n !== prev);
            if (nx.length !== 1 || !rd.has(nx[0]!)) break;
            prev = cur; cur = nx[0]!; catena.push(cur);
          }
          for (let t = 1; t <= 3 && t < catena.length; t++) {
            const tratto = new Set(catena.slice(0, t));
            const restaStrada = (k: string) => isRoad(k) && !tratto.has(k);
            // edifici che toccano il tratto e resterebbero senza strada
            const toccano = new Set<string>();
            for (const c of tratto) for (const n of vic(c)) if (occ.has(n) && !isRoad(n)) toccano.add(n);
            const movers = new Set<Azione>();
            let base = false;
            for (const c of toccano) {
              const a = azioneDi.get(c);
              if (a) {
                if (byId.get(a.id)!.roadLevel > 0 && !perim(a.x, a.y, a.w, a.h).some(restaStrada)) movers.add(a);
                continue;
              }
              // edificio di partenza (non spostabile): se perderebbe la strada, niente
              const id = baseDi.get(c);
              if (id) {
                const b = byId.get(id)!, q = placements.get(id)!;
                if (b.roadLevel > 0 && !perim(q.x, q.y, b.w, b.h).some(restaStrada)) { base = true; break; }
              }
            }
            if (base || !movers.size || movers.size > 4) continue;
            const ms = [...movers].sort((a, b) => b.w * b.h - a.w * a.h);
            // libera temporaneamente tratto e movers
            for (const c of tratto) occ.delete(c);
            for (const a of ms) for (const k of celleR(a.x, a.y, a.w, a.h)) occ.delete(k);
            const [fx, fy] = foglia.split(",").map(Number) as [number, number];
            const vicineStrade = [...rd, ...roads].filter(k => !tratto.has(k)).filter(k => {
              const i = k.indexOf(","); return Math.abs(Number(k.slice(0, i)) - fx) + Math.abs(Number(k.slice(i + 1)) - fy) <= 12;
            });
            const candidati = ms.map(a => {
              const set = new Map<string, [number, number]>();
              for (const r of vicineStrade) {
                const i = r.indexOf(","), rx = Number(r.slice(0, i)), ry = Number(r.slice(i + 1));
                for (let dx = 0; dx < a.w; dx++) { set.set(`${rx - dx},${ry - a.h}`, [rx - dx, ry - a.h]); set.set(`${rx - dx},${ry + 1}`, [rx - dx, ry + 1]); }
                for (let dy = 0; dy < a.h; dy++) { set.set(`${rx - a.w},${ry - dy}`, [rx - a.w, ry - dy]); set.set(`${rx + 1},${ry - dy}`, [rx + 1, ry - dy]); }
              }
              return [...set.values()].filter(([x, y]) => fitsS(x, y, a.w, a.h))
                .sort((p1, p2) => Math.abs(p1[0] - a.x) + Math.abs(p1[1] - a.y) - Math.abs(p2[0] - a.x) - Math.abs(p2[1] - a.y));
            });
            const scelta: Array<[number, number]> = [];
            const usate = new Set<string>();
            const prova = (i: number): boolean => {
              if (i === ms.length) return true;
              const a = ms[i]!;
              for (const [x, y] of candidati[i]!) {
                const cc = celleR(x, y, a.w, a.h);
                if (cc.some(k => usate.has(k))) continue;
                for (const k of cc) usate.add(k);
                scelta.push([x, y]);
                if (prova(i + 1)) return true;
                scelta.pop();
                for (const k of cc) usate.delete(k);
              }
              return false;
            };
            if (prova(0)) {
              for (const c of tratto) rd.delete(c);
              ms.forEach((a, i) => {
                for (const k of celleR(a.x, a.y, a.w, a.h)) { edif.delete(k); azioneDi.delete(k); }
                [a.x, a.y] = scelta[i]!;
              });
              for (const a of ms) for (const k of celleR(a.x, a.y, a.w, a.h)) { occ.add(k); edif.add(k); azioneDi.set(k, a); }
              fatto = true;
              break;
            }
            // ripristina
            for (const c of tratto) occ.add(c);
            for (const a of ms) for (const k of celleR(a.x, a.y, a.w, a.h)) occ.add(k);
          }
          if (fatto) break;
        }
        if (!fatto) break;
      }
    };

    /** Edifici molto alti (h >= ALTO) fuori dalle fasce interne (regola
     *  dell'utente): un edificio alto sui lati di una dorsale interna occupa
     *  spazio fra due strade; va a nord della dorsale più in alto o a sud di
     *  quella più in basso, in un posto libero o scambiandosi con un edificio
     *  più basso di quella fascia esterna. */
    const altiFuori = () => {
      const ALTO = 6;
      const righe = [...new Set(azioni.filter(a => a.sy !== undefined).map(a => a.sy!))].sort((a, b) => a - b);
      if (righe.length < 2) return;
      const top = righe[0]!, bot = righe[righe.length - 1]!;
      const fineDi = (row: number) => {
        let xe = -Infinity;
        for (const k of rd) { const i = k.indexOf(","); if (Number(k.slice(i + 1)) === row) xe = Math.max(xe, Number(k.slice(0, i))); }
        return xe;
      };
      const celleDi = (x: number, y: number, w: number, h: number) => {
        const out: string[] = [];
        for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) out.push(key(x + dx, y + dy));
        return out;
      };
      const solaSua = (x: number, y: number, w: number, h: number, row: number) => {
        const altra = (k: string) => rd.has(k) && Number(k.slice(k.indexOf(",") + 1)) !== row;
        for (let dx = 0; dx < w; dx++) if (altra(key(x + dx, y - 1)) || altra(key(x + dx, y + h))) return false;
        for (let dy = 0; dy < h; dy++) if (altra(key(x - 1, y + dy)) || altra(key(x + w, y + dy))) return false;
        return true;
      };
      const esterna = (a: Azione) => (a.sy === top && a.y < top) || (a.sy === bot && a.y > bot);
      const alti = azioni.filter(a => a.sy !== undefined && !a.cap && a.h >= ALTO && !esterna(a)).sort((a, b) => b.h - a.h);
      for (const X of alti) {
        let fatto = false;
        for (const [row, nord] of [[bot, false], [top, true]] as Array<[number, boolean]>) {
          if (fatto) break;
          const xe = fineDi(row);
          const ny = nord ? row - X.h : row + 1;
          const mie = new Set(celleDi(X.x, X.y, X.w, X.h));
          const libera = (k: string, extra?: Set<string>) => problem.cells.has(k) && (!occ.has(k) || mie.has(k) || (extra?.has(k) ?? false));
          // 1) posto libero lungo la fascia esterna
          for (let x = x0; x <= xe && !fatto; x++) {
            if (!celleDi(x, ny, X.w, X.h).every(k => libera(k)) || !solaSua(x, ny, X.w, X.h, row)) continue;
            for (const k of mie) { occ.delete(k); edif.delete(k); }
            X.x = x; X.y = ny; X.sy = row;
            for (const k of celleDi(X.x, X.y, X.w, X.h)) { occ.add(k); edif.add(k); }
            fatto = true;
          }
          // 2) scambio con un edificio più basso della fascia esterna
          if (!fatto) for (const Y of azioni.filter(a => a.sy === row && !a.cap && (nord ? a.y < row : a.y > row) && a.h < X.h)) {
            const sueY = new Set(celleDi(Y.x, Y.y, Y.w, Y.h));
            const lib2 = (k: string) => libera(k, sueY);
            const xNy = nord ? row - X.h : row + 1;
            const yNy = X.y < X.sy! ? X.sy! - Y.h : X.sy! + 1;
            const cX = celleDi(Y.x, xNy, X.w, X.h), cY = celleDi(X.x, yNy, Y.w, Y.h);
            if (Y.x > xe || !cX.every(lib2) || !cY.every(lib2) || cX.some(k => cY.includes(k))) continue;
            if (!solaSua(Y.x, xNy, X.w, X.h, row) || !solaSua(X.x, yNy, Y.w, Y.h, X.sy!)) continue;
            for (const k of [...mie, ...sueY]) { occ.delete(k); edif.delete(k); }
            const [ox, osy] = [X.x, X.sy];
            X.x = Y.x; X.y = xNy; X.sy = row;
            Y.x = ox; Y.y = yNy; Y.sy = osy;
            for (const k of [...cX, ...cY]) { occ.add(k); edif.add(k); }
            fatto = true;
            break;
          }
          // 3) scambio di GRUPPI: gli alti adiacenti della stessa fascia (G)
          //    con una sequenza consecutiva di edifici più bassi della fascia
          //    esterna (H) di larghezza totale almeno pari; G va al posto di
          //    H (allineato alla strada esterna), H al posto di G.
          if (!fatto) fatto = scambioGruppi(X, row, nord, xe);
        }
      }
    };
    const scambioGruppi = (X: Azione, row: number, nord: boolean, xe: number): boolean => {
      const celleDi = (x: number, y: number, w: number, h: number) => {
        const out: string[] = [];
        for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) out.push(key(x + dx, y + dy));
        return out;
      };
      const solaSua = (x: number, y: number, w: number, h: number, r: number) => {
        const altra = (k: string) => rd.has(k) && Number(k.slice(k.indexOf(",") + 1)) !== r;
        for (let dx = 0; dx < w; dx++) if (altra(key(x + dx, y - 1)) || altra(key(x + dx, y + h))) return false;
        for (let dy = 0; dy < h; dy++) if (altra(key(x - 1, y + dy)) || altra(key(x + w, y + dy))) return false;
        return true;
      };
      const sy = X.sy!, nordX = X.y < sy;
      const banda = azioni.filter(a => a.sy === sy && !a.cap && (a.y < sy) === nordX).sort((a, b) => a.x - b.x);
      // G: catena di alti (h >= 6) adiacenti a X
      let i0 = banda.indexOf(X), i1 = i0;
      while (i0 > 0 && banda[i0 - 1]!.h >= 6 && banda[i0 - 1]!.x + banda[i0 - 1]!.w === banda[i0]!.x) i0--;
      while (i1 < banda.length - 1 && banda[i1 + 1]!.h >= 6 && banda[i1]!.x + banda[i1]!.w === banda[i1 + 1]!.x) i1++;
      const G = banda.slice(i0, i1 + 1);
      const wG = G.reduce((t, a) => t + a.w, 0);
      const fuori = azioni.filter(a => a.sy === row && !a.cap && (nord ? a.y < row : a.y > row)).sort((a, b) => a.x - b.x);
      let roadEndX = -Infinity;
      for (const k of rd) { const i = k.indexOf(","); if (Number(k.slice(i + 1)) === sy) roadEndX = Math.max(roadEndX, Number(k.slice(0, i))); }
      for (let i = 0; i < fuori.length; i++) {
        let wH = 0, j = i;
        while (j < fuori.length && wH < wG) { wH += fuori[j]!.w; j++; }
        if (wH < wG) break;
        const H = fuori.slice(i, j);
        if (H.some(a => a.h >= X.h)) continue;
        const tutti = [...G, ...H];
        const vecchie = tutti.map(a => ({ a, x: a.x, y: a.y, sy: a.sy }));
        for (const a of tutti) rett(a.x, a.y, a.w, a.h, 0);
        let ok = true;
        const nuove: Array<{ a: Azione; x: number; y: number; sy: number }> = [];
        let cx = H[0]!.x;
        for (const a of G) {
          const y = nord ? row - a.h : row + 1;
          if (cx > xe) { ok = false; break; }
          nuove.push({ a, x: cx, y, sy: row }); cx += a.w;
        }
        cx = G[0]!.x;
        if (ok) for (const a of H) {
          const y = nordX ? sy - a.h : sy + 1;
          if (cx > roadEndX) { ok = false; break; }
          nuove.push({ a, x: cx, y, sy }); cx += a.w;
        }
        const tmp = new Set<string>();
        if (ok) for (const n of nuove) {
          const cs = celleDi(n.x, n.y, n.a.w, n.a.h);
          if (!cs.every(k => problem.cells.has(k) && !occ.has(k) && !tmp.has(k)) || !solaSua(n.x, n.y, n.a.w, n.a.h, n.sy)) { ok = false; break; }
          for (const k of cs) tmp.add(k);
        }
        if (ok) {
          for (const n of nuove) { n.a.x = n.x; n.a.y = n.y; n.a.sy = n.sy; }
          for (const k of tmp) { occ.add(k); edif.add(k); }
          return true;
        }
        for (const v of vecchie) { v.a.x = v.x; v.a.y = v.y; v.a.sy = v.sy; rett(v.x, v.y, v.a.w, v.a.h, 1); }
      }
      return false;
    };

    /** Alti trattenuti nelle fasce esterne (Params.riservaAlti): nord della
     *  dorsale più in alto, sud di quella più in basso; la dorsale si allunga
     *  (celle libere) se il posto è oltre la sua fine. */
    const piazzaAltiFuori = () => {
      const rs = new Set<number>();
      for (const k of rd) { const i = k.indexOf(","); if (Number(k.slice(0, i)) > vx) rs.add(Number(k.slice(i + 1))); }
      const r = [...rs].sort((a, b) => a - b);
      if (!r.length) return;
      const top = r[0]!, bot = r[r.length - 1]!;
      const fineDi = (row: number) => { let xe = -Infinity; for (const k of rd) { const i = k.indexOf(","); if (Number(k.slice(i + 1)) === row) xe = Math.max(xe, Number(k.slice(0, i))); } return xe; };
      const solaSua = (x: number, y: number, w: number, h: number, row: number) => {
        const altra = (k: string) => rd.has(k) && Number(k.slice(k.indexOf(",") + 1)) !== row;
        for (let dx = 0; dx < w; dx++) if (altra(key(x + dx, y - 1)) || altra(key(x + dx, y + h))) return false;
        for (let dy = 0; dy < h; dy++) if (altra(key(x - 1, y + dy)) || altra(key(x + w, y + dy))) return false;
        return true;
      };
      const alti = pool.filter(b => trattenuti.has(b.id) && !fatti.has(b.id)).sort((a, b) => b.h - a.h || b.w - a.w);
      for (const b of alti) {
        let scelto: { x: number; y: number; row: number; ext: number } | null = null;
        for (const [row, nord] of [[bot, false], [top, true]] as Array<[number, boolean]>) {
          const xe = fineDi(row);
          const y = nord ? row - b.h : row + 1;
          for (let x = x0; x <= xe + 8; x++) {
            if (!fitsS(x, y, b.w, b.h) || !solaSua(x, y, b.w, b.h, row)) continue;
            // strada fino a x (se oltre la fine attuale)
            let ext = 0, okS = true;
            for (let xx = xe + 1; xx <= x; xx++) { if (!free(xx, row)) { okS = false; break; } ext++; }
            if (!okS) continue;
            if (!scelto || ext < scelto.ext) scelto = { x, y, row, ext };
            break;
          }
          if (scelto && scelto.ext === 0) break;
        }
        if (!scelto) continue;
        const xe = fineDi(scelto.row);
        const road: string[] = [];
        for (let xx = xe + 1; xx <= scelto.x; xx++) road.push(key(xx, scelto.row));
        place("alto in fascia esterna", b, scelto.x, scelto.y, road, scelto.row);
      }
    };

    // Fine strada: gli edifici grandi rimasti (entrambi i lati >= 5). 1-2 →
    // una dorsale (centrale), 3-4 → due dorsali; un grande senza compagno è
    // abbinato al più grande degli altri.
    let grandi = pool.filter(b => b.w >= LATO_GRANDE && b.h >= LATO_GRANDE)
      .sort((a, b) => b.w * b.h - a.w * a.h);
    if (p.pairSeed !== null) {
      const r = mulberry32(p.pairSeed);
      grandi = grandi.map(b => [r(), b] as const).sort((a, b) => a[0] - b[0]).map(t => t[1]);
    }
    const coppie: Array<[PlannerBuilding, PlannerBuilding]> = [];
    const nCoppie = p.comb !== 0 ? Math.min(p.comb > 0 ? p.comb : 2, grandi.length >= 3 ? 2 : grandi.length > 0 ? 1 : 0) : p.rows.length;
    for (let i = 0; i < nCoppie && 2 * i < grandi.length; i++) {
      const c = grandi.slice(2 * i, 2 * i + 2);
      if (c.length === 1) {
        const usati = new Set(grandi.map(b => b.id));
        const compagno = pool.filter(b => !usati.has(b.id)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
        if (compagno) c.push(compagno);
      }
      if (c.length === 2) coppie.push([c[0]!, c[1]!]);
    }
    if (p.riservaAlti) for (const b of pool) if (b.h >= 6 && !(b.w >= LATO_GRANDE && b.h >= LATO_GRANDE)) trattenuti.add(b.id);
    let finiStradaMancanti = 0;
    // Prima il lato est della verticale (strada gratis): solo gli edifici che
    // non ci stanno andranno sulle dorsali, che così risultano più corte.
    for (const c of coppie) for (const b of c) riservati.add(b.id);
    const pianoPettine = p.comb !== 0 ? pettine(p.comb, coppie) : null;
    if (pianoPettine) {
      if (p.vertFirst) latoEstVerticale(pianoPettine.rows, p.orient);
      pianoPettine.spine.forEach((sp, i) => {
        const lista = sp.lista.filter(b => !fatti.has(b.id));
        if (sp.pair) {
          for (const b of sp.pair) riservati.delete(b.id);
          const larg = Math.max(...["n", "s"].map(sd => lista.filter(b => sp.forza.get(b.id) === sd).reduce((t, b) => t + b.w, 0)));
          const piano = fatti.has(sp.pair[0].id) || fatti.has(sp.pair[1].id) ? null
            : pianoDorsaleCap(sp.row, sp.pair, 1, p.capVariant[0] ?? 0, 1, lista, sp.forza, larg + Math.max(sp.pair[0].w, sp.pair[1].w));
          if (piano) applicaDorsale(sp.row, piano, `dorsale ${i + 1}`);
          else { finiStradaMancanti++; applicaDorsale(sp.row, pianoDorsale(sp.row, 1, lista, sp.forza), `dorsale ${i + 1}`); }
        } else applicaDorsale(sp.row, pianoDorsale(sp.row, 1, lista, sp.forza), `dorsale ${i + 1}`);
      });
      riservati.clear();
    } else {
    if (p.vertFirst) latoEstVerticale(coppie.length ? p.rows.slice(0, coppie.length) : [sy0], p.orient);
    if (coppie.length) {
      coppie.forEach((pair, i) => {
        const sy = p.rows[i]!;
        for (const b of pair) riservati.delete(b.id);
        const piano = fatti.has(pair[0].id) || fatti.has(pair[1].id) ? null
          : pianoDorsaleCap(sy, pair, p.lenFactor[i] ?? 1, p.capVariant[i] ?? 0, coppie.length);
        if (piano) applicaDorsale(sy, piano, i === 0 ? "dorsale est" : "seconda dorsale");
        else finiStradaMancanti++;
      });
      riservati.clear();
      if (finiStradaMancanti === coppie.length) applicaDorsale(p.rows[0]!, pianoDorsale(p.rows[0]!, p.spineCap), "dorsale est");
    } else applicaDorsale(p.rows[0]!, pianoDorsale(p.rows[0]!, p.spineCap), "dorsale est");
    }
    if (!p.vertFirst) latoEstVerticale();
    if (trattenuti.size) {
      // Prima gli altri (le dorsali secondarie senza gli alti), poi gli alti
      // nelle fasce esterne, poi quel che resta.
      dorsaliSecondarie();
      piazzaAltiFuori();
      trattenuti.clear();
    }
    attaccaAStrade();
    dorsaliSecondarie();
    if (ricompatta()) { latoEstVerticale(); dorsaliSecondarie(); }
    if (p.altiEsterni) altiFuori(); // dopo tutte le dorsali: solo ora si sa quali fasce sono esterne
    scambiaFiniStrada();
    compattaDorsali();
    riparaScollegati();
    if (punte) rifinisciPunte();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const a of azioni) {
      minX = Math.min(minX, a.x); minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x + a.w); maxY = Math.max(maxY, a.y + a.h);
    }
    // Spreco: celle libere rimaste nella zona delle dorsali (da x0 fino
    // all'ultima strada nuova, fra il bordo nord e il bordo sud degli edifici
    // piazzati a est della verticale): righe vuote fra le dorsali, buchi.
    let spreco = 0;
    let xR = -Infinity;
    for (const k of rd) xR = Math.max(xR, Number(k.slice(0, k.indexOf(","))));
    let yA = Infinity, yB = -Infinity;
    // (solo gli edifici delle dorsali: quelli sul lato est della verticale non
    // allargano la zona, altrimenti usare la verticale verrebbe penalizzato)
    for (const a of azioni) if (a.sy !== undefined) { yA = Math.min(yA, a.y); yB = Math.max(yB, a.y + a.h); }
    if (Number.isFinite(xR) && Number.isFinite(yA))
      for (let yy = yA; yy < yB; yy++) for (let xx = x0; xx <= xR; xx++) if (free(xx, yy)) spreco++;
    // Lati di strada inutilizzati: celle delle strade nuove con a nord o a sud
    // una cella libera (né edificio né strada). Una strada con un lato vuoto
    // non deve esistere: è il secondo criterio dopo esclusi e fini strada.
    let latiLiberi = 0;
    // ...e anche il lato EST della strada verticale: non deve avere buchi.
    for (const r of [...roads, ...rd]) {
      const i = r.indexOf(","), rx = Number(r.slice(0, i)), ry = Number(r.slice(i + 1));
      if (rx === vx && free(vx + 1, ry)) latiLiberi++;
    }
    // Edifici attaccati col lato LUNGO: larghi (w > h) su una dorsale
    // orizzontale, alti (h > w) sul lato est della verticale.
    let latiLunghi = 0;
    for (const a of azioni) {
      if (a.label === LBL_VERTICALE) { if (a.h > a.w) latiLunghi++; }
      else if (a.sy !== undefined && !a.cap && a.w > a.h) latiLunghi++;
    }
    for (const k of rd) {
      const i = k.indexOf(","), rx = Number(k.slice(0, i)), ry = Number(k.slice(i + 1));
      if (free(rx, ry - 1)) latiLiberi++;
      if (free(rx, ry + 1)) latiLiberi++;
    }
    // Deficit di spazio: area degli edifici senza strada ancora da piazzare +
    // area degli esclusi (×1,3 per le loro strade) + 5% di margine per la
    // frammentazione, contro le celle libere rimaste.
    let libere = 0;
    for (let c = 0; c < GW * GH; c++) if (cellGrid[c] === 1 && occ.g[c] !== 1) libere++;
    const areaEsclusi = pool.filter(b => !fatti.has(b.id)).reduce((t, b) => t + b.w * b.h, 0);
    // I buchi intermedi non sono spazio utile per gli edifici senza strada.
    const buchi = contaBuchi(occ);
    const deficit = Math.max(0, Math.ceil((areaSenzaStrada + areaEsclusi * 1.3) * 1.05) - (libere - buchi));
    // Riallineamento: le strade applicate (azioni + stradeExtra) devono essere
    // ESATTAMENTE rd, su cui si calcolano le metriche. Alcuni passi successivi
    // (compattazione, scambi) aggiornano rd ma non sempre le strade delle
    // azioni: senza questo, si applicava una strada diversa da quella valutata
    // (bug reale su Beta r4: una cella isolata e un 2×3 senza strada).
    {
      for (const a of azioni) a.road = a.road.filter(k => rd.has(k));
      for (let i = stradeExtra.length - 1; i >= 0; i--) if (!rd.has(stradeExtra[i]!)) stradeExtra.splice(i, 1);
      const coperte = new Set<string>([...stradeExtra, ...azioni.flatMap(a => a.road)]);
      for (const k of rd) if (!coperte.has(k)) stradeExtra.push(k);
    }
    // Connessione: ogni strada nuova deve essere raggiungibile dalla rete esistente.
    const raggiunte = new Set<string>();
    const coda: string[] = [];
    for (const k of rd) {
      const i = k.indexOf(","), x = Number(k.slice(0, i)), y = Number(k.slice(i + 1));
      if ([key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)].some(n => roads.has(n))) { raggiunte.add(k); coda.push(k); }
    }
    while (coda.length) {
      const k = coda.pop()!, i = k.indexOf(","), x = Number(k.slice(0, i)), y = Number(k.slice(i + 1));
      for (const n of [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)]) if (rd.has(n) && !raggiunte.has(n)) { raggiunte.add(n); coda.push(n); }
    }
    let scollegate = rd.size - raggiunte.size;
    // Validazione finale (rete di sicurezza): nessuna sovrapposizione fra gli
    // edifici di partenza (non spostati), quelli piazzati qui e le strade.
    {
      const mossi = new Set([...azioni.map(a => a.id), ...liberati, ...azioni.filter(a => a.libera).map(a => a.libera!)]);
      // Versione numerica (ottimizzazione): si parte dalle celle occupate
      // dello stato di partenza (strade + edifici, che non si sovrappongono),
      // si liberano i posti originali degli edifici mossi e si segnano celle
      // delle azioni e strade nuove: una cella già segnata è un conflitto.
      let conflitti = 0;
      const u = occupied.g.slice();
      const fuoriG = new Set<string>();
      for (const id of mossi) {
        const q = placements.get(id), b = byId.get(id);
        if (q && b) for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) { const g = gIdx(q.x + dx, q.y + dy); if (g >= 0) u[g] = 0; }
      }
      const segna = (x: number, y: number) => {
        const g = gIdx(x, y);
        if (g < 0) { const k = key(x, y); if (fuoriG.has(k)) conflitti++; else fuoriG.add(k); return; }
        if (u[g] === 1) conflitti++; else u[g] = 1;
      };
      for (const a of azioni) for (let dx = 0; dx < a.w; dx++) for (let dy = 0; dy < a.h; dy++) segna(a.x + dx, a.y + dy);
      for (const k of rd) { const c = k.indexOf(","); segna(Number(k.slice(0, c)), Number(k.slice(c + 1))); }
      if (conflitti) scollegate += 1000 + conflitti; // disposizione non valida: non può vincere
      // Rete di sicurezza: gli edifici fissi (parte ovest) non si spostano mai.
      if (fissi.size && [...mossi].some(id => fissi.has(id))) scollegate += 1000;
    }
    // Alti (h >= 6) sui lati delle dorsali che non stanno in una fascia esterna.
    let altiInterni = 0;
    {
      // Righe delle dorsali = righe con strade nuove a est della verticale.
      const rs = new Set<number>();
      for (const k of rd) { const i = k.indexOf(","); if (Number(k.slice(0, i)) > vx) rs.add(Number(k.slice(i + 1))); }
      const r = [...rs].sort((a, b) => a - b);
      if (r.length >= 2) for (const a of azioni) {
        if (a.cap || a.h < 6 || byId.get(a.id)!.roadLevel === 0) continue;
        // a quale dorsale si appoggia (col lato inferiore o superiore)?
        let tocca: "n" | "s" | null = null, riga = 0;
        for (let dx = 0; dx < a.w && !tocca; dx++) {
          if (rs.has(a.y + a.h) && rd.has(key(a.x + dx, a.y + a.h))) { tocca = "n"; riga = a.y + a.h; }
          else if (rs.has(a.y - 1) && rd.has(key(a.x + dx, a.y - 1))) { tocca = "s"; riga = a.y - 1; }
        }
        if (!tocca) continue; // attaccato solo alla verticale o ad altro: non conta
        const fuori = (tocca === "n" && riga === r[0]) || (tocca === "s" && riga === r[r.length - 1]);
        if (!fuori) altiInterni++;
      }
    }
    return {
      azioni, altiInterni, liberati, stradeExtra, scollegate, deficit, esclusi: pool.filter(b => !fatti.has(b.id)).map(b => b.id), finiStradaMancanti, latiLiberi, latiLunghi, strade: rd.size,
      buchi, spreco, compattezza: azioni.length ? (maxX - minX) * (maxY - minY) : 0,
    };
  };

  let best: Piano | null = null;
  let valutate = 0;
  let trovataAl = 0;
  /** Mostra la disposizione migliore finora (stato di partenza + piano). */
  const mostra = (stato: string) => {
    const pl = new Map(placements);
    const rd = new Set(roads);
    const nuove: string[] = [];
    if (best) {
      const rip = new Set(best.azioni.map(a => a.id));
      for (const id of best.liberati) if (!rip.has(id)) pl.delete(id);
      for (const k of best.stradeExtra) { rd.add(k); nuove.push(k); }
      for (const a of best.azioni) {
        if (a.libera && !rip.has(a.libera)) pl.delete(a.libera);
        pl.set(a.id, { x: a.x, y: a.y });
        for (const k of a.road) { rd.add(k); nuove.push(k); }
      }
    }
    const esclusi = best ? best.esclusi.length : daPiazzare.length;
    opts.onFrame({
      placements: pl, roads: rd, probe: null, lastPath: nuove, placed: pl.size, unplaced: best ? [...best.esclusi] : [],
      iterations: valutate, done: false,
      search: { valutate, strade: best?.strade ?? null, spreco: best?.spreco ?? 0, buchi: best?.buchi ?? 0, latiLiberi: best?.latiLiberi ?? 0, altiInterni: best?.altiInterni ?? 0, trovataAl, esclusi, attiva: stato === "" },
      label: `Ricerca edifici con strada · ${valutate.toLocaleString()} disposizioni · migliore: ${best?.strade ?? "—"} strade nuove`
        + ` (trovata alla n. ${trovataAl.toLocaleString()})${stato}`,
    });
  };
  const ordini: Array<Params["order"]> = [
    (a, b) => b.h - a.h || b.w - a.w,
    (a, b) => b.h - a.h || a.w - b.w,
    (a, b) => b.w * b.h - a.w * a.h,
    (a, b) => a.w - b.w || b.h - a.h,
    (a, b) => b.w - a.w || b.h - a.h,
  ];
  const lati: Side[] = ["nearest", "balance", "north", "south"];
  const uno = (n: number) => Array.from({ length: n }, () => 1);
  const zero = (n: number) => Array.from({ length: n }, () => 0);
  const rnd = mulberry32(12345);
  const rigaVicina = (): number => {
    if (rnd() < 0.5) return sy0;
    const cand = [-3, -2, -1, 1, 2, 3].map(d => sy0 + d).filter(okRiga);
    return cand.length ? cand[Math.floor(rnd() * cand.length)]! : sy0;
  };
  /** Parametri casuali (ripartenze): spareggi, lato e lunghezza massima della dorsale casuali. */
  const casuale = (nDors: number, righeCasuali: () => number[]): Params => {
    const jitter = new Map(problem.buildings.map(b => [b.id, rnd()]));
    const base = ordini[Math.floor(rnd() * ordini.length)]!;
    const mescola = rnd() < 0.5;
    return {
      order: mescola ? (a, b) => b.h - a.h || jitter.get(a.id)! - jitter.get(b.id)! : (a, b) => base(a, b) || jitter.get(a.id)! - jitter.get(b.id)!,
      side: lati[Math.floor(rnd() * lati.length)]!,
      vertFirst: rnd() < 0.5,
      secondary: (["ratio", "minRoad", "snug"] as const)[Math.floor(rnd() * 3)]!,
      spineCap: rnd() < 0.5 ? 1 : 0.3 + rnd() * 0.7,
      // La dorsale principale non è vincolata alla riga del raccordo del
      // municipio: metà delle volte la si sposta di 1-3 righe su o giù.
      rows: nDors === 1 ? [rigaVicina()] : righeCasuali(),
      lenFactor: uno(nDors).map(() => (rnd() < 0.25 ? 0 : 0.4 + rnd() * 1.2)),
      capVariant: uno(nDors).map(() => Math.floor(rnd() * CAP_VARIANTS.length)),
      pairSeed: rnd() < 0.3 ? null : Math.floor(rnd() * 1e9),
      ...(() => { const u = rnd(); const K = u < 0.4 ? 0 : u < 0.7 ? -1 : 2 + Math.floor(rnd() * 3); return { comb: K, combPiu: Math.floor(rnd() * 3), combAnchor: K < 0 ? Math.floor(rnd() * 5) - 1 : Math.floor(rnd() * Math.max(1, K)), orient: rnd() < 0.6, swapBuilder: rnd() < 0.5, gapN: rnd() < 0.5 ? 1 : 2 + Math.floor(rnd() * 2), gapS: rnd() < 0.5 ? 1 : 2 + Math.floor(rnd() * 2), extN: rnd() < 0.6 ? 0 : 1 + Math.floor(rnd() * 4), extS: rnd() < 0.6 ? 0 : 1 + Math.floor(rnd() * 4), liberaN: rnd() < 0.15, liberaS: rnd() < 0.15, riservaAlti: rnd() < 0.25, altiEsterni: rnd() < 0.4 }; })(),
    };
  };

  // ── Ricerca parametrica dalla base del builder ──────────────────────────
  /** C'è qualcosa da cercare dalla base del builder? */
  const conPar = daPiazzare.length > 0;
  // Righe delle dorsali con fine strada: con 3+ edifici grandi servono DUE
  // dorsali, abbastanza distanti da far entrare i fini strada (la ricerca
  // prova coppie di righe diverse; una coppia che non ci sta perde).
  const nGrandi = daPiazzare.filter(b => b.w >= LATO_GRANDE && b.h >= LATO_GRANDE).length;
  const opzioniRighe: number[][] = [];
  if (nGrandi >= 3) {
    for (let d = 6; d <= 24; d += 2) {
      for (const c of [[sy0, sy0 + d], [sy0 - d, sy0], [sy0 - Math.floor(d / 2), sy0 + Math.ceil(d / 2)]])
        if (c.every(okRiga)) opzioniRighe.push(c);
    }
    if (!opzioniRighe.length) opzioniRighe.push([sy0]);
  } else opzioniRighe.push([sy0]);
  const nDors = opzioniRighe[0]!.length;
  const configs: Params[] = [];
  for (const lf of [1, 0]) for (const order of ordini) for (const side of lati) for (const vertFirst of [true, false]) for (const secondary of ["ratio", "minRoad", "snug"] as const)
    configs.push({ order, side, vertFirst, secondary, spineCap: 1, rows: opzioniRighe[0]!, lenFactor: uno(nDors).map(() => lf), capVariant: zero(nDors), pairSeed: null, comb: 0, combAnchor: 0, orient: vertFirst });
  // Dorsale principale spostata di ±1..±2 righe rispetto al raccordo.
  if (nDors === 1) for (const d of [-1, 1, -2, 2]) if (okRiga(sy0 + d)) for (const vertFirst of [true, false]) for (const lf of [1, 0])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst, secondary: "snug", spineCap: 1, rows: [sy0 + d], lenFactor: [lf], capVariant: [0], pairSeed: null, comb: 0, combAnchor: 0, orient: vertFirst });
  // Scambio col builder (grande del builder come fine strada), con e senza spostamento della dorsale.
  for (const d of [0, -1, 1]) if (okRiga(sy0 + d)) for (const vertFirst of [true, false]) for (const lf of [1, 0])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst, secondary: "snug", spineCap: 1, rows: [sy0 + d], lenFactor: [lf], capVariant: [0], pairSeed: null, comb: 0, combAnchor: 0, orient: vertFirst, swapBuilder: true });
  // Alti trattenuti e messi solo nelle fasce esterne.
  for (const comb of [0, -1]) for (const vertFirst of [true, false]) for (const lf of [1, 0])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst, secondary: "snug", spineCap: 1, rows: [sy0], lenFactor: [lf], capVariant: [0], pairSeed: null, comb, combAnchor: -1, orient: vertFirst, riservaAlti: true, altiEsterni: true });
  // Rinuncia ai fini strada della verticale (città dense), con pettine pieno e normale.
  for (const [liberaN, liberaS] of [[false, true], [true, false], [true, true]] as const) for (const comb of [0, -1]) for (const vertFirst of [true, false])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst, secondary: "snug", spineCap: 1, rows: [sy0], lenFactor: [1], capVariant: [0], pairSeed: null, comb, combAnchor: -1, orient: vertFirst, liberaN, liberaS, extN: liberaN ? 3 : 0, extS: liberaS ? 3 : 0 });
  // Verticale allungata fino al bordo (nord, sud, entrambi).
  for (const [extN, extS] of [[0, 9], [9, 0], [9, 9]] as const) for (const vertFirst of [true, false]) for (const lf of [1, 0])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst, secondary: "snug", spineCap: 1, rows: [sy0], lenFactor: [lf], capVariant: [0], pairSeed: null, comb: 0, combAnchor: 0, orient: vertFirst, extN, extS });
  // Spazio di 2-3 righe attorno all'inizio della dorsale (edifici piccoli al posto dei buchi).
  for (const [gapN, gapS] of [[2, 1], [1, 2], [2, 2], [3, 1], [1, 3]] as const) for (const d of [0, -1, 1]) if (okRiga(sy0 + d)) for (const lf of [1, 0])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst: true, secondary: "snug", spineCap: 1, rows: [sy0 + d], lenFactor: [lf], capVariant: [0], pairSeed: null, comb: 0, combAnchor: 0, orient: true, swapBuilder: false, gapN, gapS });
  // Pettine: 2-4 dorsali, edifici alti nelle fasce esterne.
  // Pettine pieno: fasce lunghe quanto lo spazio verso est, dorsali quante servono.
  for (const combPiu of [0, 1, 2]) for (const f of [1, 0.85, 0.7]) for (const anchor of [-1, 0, 1]) for (const vertFirst of [true, false])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst, secondary: "snug", spineCap: 1, rows: [sy0], lenFactor: [f], capVariant: [0], pairSeed: null, comb: -1, combAnchor: anchor, combPiu, orient: vertFirst });
  for (const K of [2, 3, 4]) for (let anchor = 0; anchor < K; anchor++) for (const vertFirst of [true, false])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst, secondary: "ratio", spineCap: 1, rows: [sy0], lenFactor: [1], capVariant: [0], pairSeed: null, comb: K, combAnchor: anchor, orient: vertFirst });
  for (const rows of opzioniRighe.slice(1)) for (const vi of [0, 3, 6, 9])
    configs.push({ order: ordini[0]!, side: "nearest", vertFirst: false, secondary: "ratio", spineCap: 1, rows, lenFactor: uno(rows.length), capVariant: rows.map(() => vi), pairSeed: null, comb: 0, combAnchor: 0 });
  let bestParams: Params | null = null;
  /** Margine (strade) entro cui una disposizione è "promettente": solo a
   *  queste si applica la rifinitura delle punte (applicata a tutte costava
   *  il 35% delle disposizioni al secondo, con risultati peggiori a parità di
   *  tempo). simula è deterministica, quindi la si ripete con la rifinitura. */
  const MARGINE_PUNTE = 0;
  const promettente = (q: Piano) => q.scollegate === 0 && (!best || (q.esclusi.length <= best.esclusi.length && q.strade <= best.strade + MARGINE_PUNTE));
  const prova = (p: Params) => {
    let piano = simula(p);
    if (promettente(piano)) piano = simula(p, true);
    valutate++;
    if (!best || meglio(piano, best)) { best = piano; bestParams = p; trovataAl = valutate; return true; }
    return false;
  };
  /** Ricerca locale: piccola modifica dei parametri della disposizione
   *  migliore (riga della dorsale ±1, lunghezza, variante del fine strada,
   *  regola del lato, ordine, scambio col builder, verticale prima/dopo). */
  const muta = (p: Params): Params => {
    const q: Params = { ...p, rows: [...p.rows], lenFactor: [...p.lenFactor], capVariant: [...p.capVariant] };
    const nMosse = 1 + Math.floor(rnd() * 2);
    for (let m = 0; m < nMosse; m++) {
      switch (Math.floor(rnd() * 12)) {
        case 0: { const i = Math.floor(rnd() * q.rows.length); const r = q.rows[i]! + (rnd() < 0.5 ? -1 : 1); if (okRiga(r)) q.rows[i] = r; break; }
        case 1: { const i = Math.floor(rnd() * q.lenFactor.length); q.lenFactor[i] = rnd() < 0.3 ? 0 : Math.max(0.3, (q.lenFactor[i] || 1) * (0.8 + rnd() * 0.4)); break; }
        case 2: { const i = Math.floor(rnd() * q.capVariant.length); q.capVariant[i] = Math.floor(rnd() * CAP_VARIANTS.length); break; }
        case 3: q.side = lati[Math.floor(rnd() * lati.length)]!; break;
        case 4: { const j = new Map(problem.buildings.map(b => [b.id, rnd()])); const o = p.order; q.order = (a, b) => o(a, b) || j.get(a.id)! - j.get(b.id)!; break; }
        case 5: q.swapBuilder = !q.swapBuilder; break;
        case 6: q.vertFirst = !q.vertFirst; q.orient = q.vertFirst; break;
        case 10: if (rnd() < 0.5) q.riservaAlti = !q.riservaAlti; else q.altiEsterni = !q.altiEsterni; break;
        case 9: if (rnd() < 0.5) q.liberaS = !q.liberaS; else q.liberaN = !q.liberaN; break;
        case 8: if (rnd() < 0.5) q.extS = Math.floor(rnd() * 5); else q.extN = Math.floor(rnd() * 5); break;
        case 7: if (rnd() < 0.5) q.gapN = 1 + Math.floor(rnd() * 3); else q.gapS = 1 + Math.floor(rnd() * 3); break;
        default: q.secondary = (["ratio", "minRoad", "snug"] as const)[Math.floor(rnd() * 3)]!; break;
      }
    }
    return q;
  };
  /** Due righe valide distinte almeno 6 (metà delle volte una è quella centrale). */
  const righeCasuali = (): number[] => {
    for (let t = 0; t < 50; t++) {
      const a = rnd() < 0.5 && okRiga(sy0) ? sy0 : righeValide[Math.floor(rnd() * righeValide.length)]!;
      const b = righeValide[Math.floor(rnd() * righeValide.length)]!;
      if (Math.abs(a - b) >= 6) return [Math.min(a, b), Math.max(a, b)];
    }
    return opzioniRighe[0]!;
  };
  /** Un passo della ricerca parametrica: prima le configurazioni fisse, poi
   *  50% mutazioni della migliore e 50% ripartenze casuali. */
  let iPar = 0;
  const passoPar = (): boolean => {
    const i = iPar++;
    if (i < configs.length) return prova(configs[i]!);
    if (bestParams && rnd() < 0.5) return prova(muta(bestParams));
    return prova(casuale(nDors, righeCasuali));
  };

  /** Applica un piano allo stato di partenza (placements / roads / occupied).
   *  Prima si liberano i posti lasciati (edifici liberati o spostati), POI si
   *  marcano strade ed edifici nuovi: le strade possono occupare celle di un
   *  posto liberato (es. la verticale allungata dove c'era il fine strada). */
  const applica = (piano: Piano) => {
    const ripiazzati = new Set(piano.azioni.map(a => a.id));
    for (const id of piano.liberati) if (!ripiazzati.has(id)) {
      const B = byId.get(id)!, pB = placements.get(id);
      if (!pB) continue; // già liberato
      for (let dx = 0; dx < B.w; dx++) for (let dy = 0; dy < B.h; dy++) occupied.delete(key(pB.x + dx, pB.y + dy));
      placements.delete(id);
    }
    for (const a of piano.azioni) {
      // Scambio col builder il cui edificio liberato non è stato ripiazzato:
      // torna fra quelli da piazzare (motore Planner più sotto).
      const pL = a.libera ? placements.get(a.libera) : undefined;
      if (a.libera && pL && !ripiazzati.has(a.libera)) {
        const B = byId.get(a.libera)!, pB = pL;
        for (let dx = 0; dx < B.w; dx++) for (let dy = 0; dy < B.h; dy++) occupied.delete(key(pB.x + dx, pB.y + dy));
        placements.delete(a.libera);
      }
      if (a.from) for (let dx = 0; dx < a.w; dx++) for (let dy = 0; dy < a.h; dy++) occupied.delete(key(a.from.x + dx, a.from.y + dy));
    }
    for (const k of piano.stradeExtra) { roads.add(k); occupied.add(k); }
    for (const a of piano.azioni) {
      for (const k of a.road) { roads.add(k); occupied.add(k); }
      placements.set(a.id, { x: a.x, y: a.y });
      occupy(a.x, a.y, a.w, a.h);
    }
  };

  // ── Ricerca a partire da una disposizione manuale ─────────────────────────
  // Dopo una pausa con modifiche, la disposizione dell'utente è la soluzione
  // corrente S e la ricerca CONTINUA (si completa solo con COMPLETA),
  // alternando: (1) un passo della ricerca parametrica dalla base del builder,
  // che sostituisce S se trova di meglio; (2) un "vicinato" di S: si tolgono
  // gli edifici con strada di un gruppo di 1-10 edifici vicini, oppure quelli
  // lungo la fine di un ramo di strada (le strade rimaste inutili vengono
  // potate da ribasa), e si ripiazzano (3 tentativi con parametri casuali);
  // il risultato sostituisce S se non è peggiore (meno edifici con strada
  // fuori → meno deficit di spazio → meno strade totali).
  type Punti = [number, number, number, number];
  type StatoS = { pl: Map<string, { x: number; y: number }>; rd: Set<string>; punti: Punti };
  /** Stato corrente del cammino (può muoversi fra soluzioni equivalenti). */
  let manuale: StatoS | null = null;
  /** Migliore trovata finora: è quella MOSTRATA e quella che si completa.
   *  Cambia solo con un miglioramento stretto (niente sostituzioni con
   *  soluzioni equivalenti o con più buchi). */
  let migliore: StatoS | null = null;
  /** Tentativi senza migliorare la migliore: oltre STALLO il cammino riparte dalla migliore. */
  let senzaMigliorare = 0;
  const STALLO = 300;
  /** Punteggio dello stato corrente: edifici con strada fuori, deficit di
   *  spazio, strade totali, buchi intermedi. */
  const punteggio = (): Punti => {
    let esc = 0, areaEsc = 0, areaNo = 0, libere = 0;
    for (const b of problem.buildings) if (!b.isTownhall && !placements.has(b.id)) {
      if (b.roadLevel > 0) { esc++; areaEsc += b.w * b.h; } else areaNo += b.w * b.h;
    }
    for (let c = 0; c < GW * GH; c++) if (cellGrid[c] === 1 && occupied.g[c] !== 1) libere++;
    const buchi = contaBuchi(occupied);
    return [esc, Math.max(0, Math.ceil((areaNo + areaEsc * 1.3) * 1.05) - (libere - buchi)), roads.size, buchi];
  };
  const confronta = (a: Punti, b: Punti) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3];
  /** Lo stato globale diventa il corrente; se batte la migliore, anche la migliore. Vero se migliora. */
  const fotografa = (azzera = false, punti?: Punti): boolean => {
    manuale = { pl: new Map(placements), rd: new Set(roads), punti: punti ?? punteggio() };
    if (azzera || !migliore || confronta(manuale.punti, migliore.punti) < 0) {
      migliore = { pl: new Map(manuale.pl), rd: new Set(manuale.rd), punti: manuale.punti };
      senzaMigliorare = 0;
      return !azzera;
    }
    return false;
  };
  const mostraS = (stato: string) => {
    const S = migliore!;
    const fuori = problem.buildings.filter(b => !b.isTownhall && b.roadLevel > 0 && !S.pl.has(b.id)).map(b => b.id);
    opts.onFrame({
      placements: new Map(S.pl), roads: new Set(S.rd), probe: null, lastPath: [...S.rd].filter(r => !opts.initial.roads.has(r)),
      placed: S.pl.size, unplaced: fuori, iterations: valutate, done: false,
      search: { valutate, strade: S.punti[2] - stradeIniziali, spreco: 0, buchi: S.punti[3], latiLiberi: 0, altiInterni: 0, trovataAl, esclusi: S.punti[0], attiva: stato === "" },
      label: `Ricerca dalla disposizione manuale · ${valutate.toLocaleString()} disposizioni · migliore: ${S.punti[2] - stradeIniziali} strade nuove`
        + `${S.punti[0] ? ` · ${S.punti[0]} edifici con strada da piazzare` : ""}${stato}`,
    });
  };
  const vicini4 = (k: string) => { const i = k.indexOf(","), x = Number(k.slice(0, i)), y = Number(k.slice(i + 1)); return [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)]; };
  const cercaDaManuale = async (): Promise<StatoManuale | null> => {
    opts.onSearchActive?.(true);
    let lastYield = performance.now(), lastShow = 0;
    while (!opts.shouldStop() && !opts.shouldFinishSearch?.() && valutate < SEARCH_MAX_RUNS) {
      // Stallo: troppi tentativi senza migliorare → il cammino riparte dalla migliore.
      if (++senzaMigliorare > STALLO) { const M = migliore!; manuale = { pl: new Map(M.pl), rd: new Set(M.rd), punti: M.punti }; senzaMigliorare = 0; }
      const S = manuale!;
      const pl = new Map(S.pl);
      let migliorata = false;
      if (conPar && parOvestOk && rnd() < 0.5) {
        // Metà dei tentativi: la ricerca parametrica dalla base del builder
        // continua; se trova una disposizione migliore di S, la sostituisce.
        ripristinaBase();
        const prima = best;
        if (passoPar() && best && best !== prima && (best as Piano).scollegate === 0) {
          applica(best);
          const pt = punteggio();
          if (confronta(pt, migliore!.punti) < 0 && fotografa(false, pt)) { migliorata = true; trovataAl = valutate; }
        }
      } else {
      const conStrada = [...pl.keys()].filter(id => { const b = byId.get(id)!; return !b.isTownhall && !fissi.has(id) && b.roadLevel > 0; });
      const togli = (id: string) => pl.delete(id);
      const u = rnd();
      if (S.punti[0] > 0 && u < 0.25) {
        // solo i da piazzare
      } else if (u < 0.6 && conStrada.length) {
        // Vicinato "fine di un ramo": dall'ultima cella di un ramo morto si
        // risale per 2-8 celle e si tolgono gli edifici che le toccano; le
        // celle rimaste senza edifici vengono potate (strade risparmiate).
        const foglie = [...S.rd].filter(r => vicini4(r).filter(n => S.rd.has(n)).length === 1);
        if (foglie.length) {
          let cur = foglie[Math.floor(rnd() * foglie.length)]!, prev = "";
          const tratto: string[] = [];
          const m = 2 + Math.floor(rnd() * 7);
          for (let t = 0; t < m; t++) {
            tratto.push(cur);
            const next = vicini4(cur).filter(n => S.rd.has(n) && n !== prev);
            if (next.length !== 1) break;
            prev = cur; cur = next[0]!;
          }
          const ts = new Set(tratto.flatMap(vicini4));
          for (const id of conStrada) {
            const q = pl.get(id)!, b = byId.get(id)!;
            let tocca = false;
            for (let dx = 0; dx < b.w && !tocca; dx++) for (let dy = 0; dy < b.h && !tocca; dy++) if (ts.has(key(q.x + dx, q.y + dy))) tocca = true;
            if (tocca) togli(id);
          }
        }
      } else if (conStrada.length) {
        // Vicinato "gruppo": 1-10 edifici con strada vicini a un edificio a caso.
        const k = 1 + Math.floor(rnd() * 10);
        const c = pl.get(conStrada[Math.floor(rnd() * conStrada.length)]!)!;
        const dist = (id: string) => { const q = pl.get(id)!, b = byId.get(id)!; return Math.abs(q.x + b.w / 2 - c.x) + Math.abs(q.y + b.h / 2 - c.y); };
        for (const id of conStrada.sort((a, b) => dist(a) - dist(b)).slice(0, k)) togli(id);
      }
      ribasa({ placements: pl, roads: S.rd });
      if (daPiazzare.length) {
        // Alcuni tentativi di ripiazzamento sulla stessa base: si applica il migliore.
        let mig: Piano | null = null, migP: Params | null = null;
        for (let t = 0; t < 3; t++) {
          const pp = casuale(1, () => [sy0]);
          const piano = simula(pp);
          valutate++;
          if (!mig || meglio(piano, mig)) { mig = piano; migP = pp; }
        }
        if (mig && migP && mig.scollegate === 0) mig = simula(migP, true);
        if (mig && mig.scollegate === 0) {
          applica(mig);
          const pt = punteggio();
          // Il cammino accetta anche soluzioni equivalenti (per uscire dagli
          // stalli), ma la migliore mostrata cambia solo se migliora davvero.
          if (confronta(pt, S.punti) <= 0 && fotografa(false, pt)) { migliorata = true; trovataAl = valutate; }
        }
      }
      }
      const now = performance.now();
      if (migliorata || now - lastShow > 500) { mostraS(""); lastShow = now; }
      if (now - lastYield > 40) { await sleep(0); lastYield = performance.now(); }
      if (opts.isPaused?.() && opts.waitResume) {
        mostraS(" · in pausa");
        opts.onPaused?.(true);
        const s2 = await opts.waitResume();
        opts.onPaused?.(false);
        lastYield = performance.now();
        if (s2) return s2;
      }
    }
    opts.onSearchActive?.(false);
    mostraS(" · ricerca conclusa");
    return null;
  };
  // Ciclo esterno: si ripete solo quando l'utente riprende da una disposizione
  // modificata a mano durante la pausa (nuovo stato di partenza).
  for (;;) {
  let ripresa: StatoManuale | null = null;
  if (manuale) ripresa = await cercaDaManuale();
  else if (daPiazzare.length) {
    opts.onSearchActive?.(true);
    const ottimo = () => best !== null && best.scollegate === 0 && best.deficit === 0 && best.esclusi.length === 0 && best.strade === 0 && best.finiStradaMancanti === 0 && best.latiLiberi === 0; // non migliorabile
    const continua = () => !ottimo() && valutate < SEARCH_MAX_RUNS && !opts.shouldStop() && !opts.shouldFinishSearch?.();
    // La ricerca prosegue finché l'utente non preme "COMPLETA" (o
    // "Ferma"), oppure trova 0 strade nuove con tutti gli edifici inseriti.
    // Ogni miglioramento sostituisce subito la disposizione visualizzata.
    let lastYield = performance.now(), lastShow = 0;
    while (continua()) {
      const migliorata = passoPar();
      const now = performance.now();
      if (migliorata || now - lastShow > 500) { mostra(""); lastShow = now; }
      if (now - lastYield > 40) { await sleep(0); lastYield = performance.now(); }
      if (opts.isPaused?.() && opts.waitResume) {
        mostra(" · in pausa");
        opts.onPaused?.(true);
        const s = await opts.waitResume();
        opts.onPaused?.(false);
        lastYield = performance.now();
        if (s) { ripresa = s; break; }
      }
    }
    if (!ripresa) {
      opts.onSearchActive?.(false);
      mostra(ottimo() ? " · ottimo: nessuna strada nuova" : " · ricerca conclusa");
    }
  }
  if (!ripresa) break;
  // Ripresa con modifiche manuali: la disposizione dell'utente diventa la
  // soluzione corrente e la ricerca prosegue a partire da lei.
  ribasa(ripresa);
  // La parte ovest (anche se modificata a mano) diventa la nuova parte fissa.
  fissi.clear();
  for (const id of idOvest(placements)) fissi.add(id);
  parOvestOk = firmaOvest(placements, roads) === firmaBase0;
  trovataAl = valutate;
  fotografa(true);
  }
  // Dopo la ricerca dalla disposizione manuale: si riparte dalla migliore trovata.
  if (migliore) { const M = migliore as StatoS; ribasa({ placements: M.pl, roads: M.rd }); best = null; }
  if (opts.shouldStop()) return finalFrame();

  // Applica la disposizione migliore (già visualizzata durante la ricerca).
  const piano = best as Piano | null;
  if (piano) {
    applica(piano);
    await sleep(opts.delayMs > 0 ? 400 : 0);
  }

  // Esclusi dalla ricerca → motore Planner (strada a costo minimo).
  let f = await runPlaceholderPlanner(problem, {
    delayMs: opts.delayMs, onFrame: opts.onFrame, shouldStop: opts.shouldStop,
    initial: { placements, roads }, phase: "road", label: "Completamento · edifici con strada rimasti",
  });
  for (const [id, p] of f.placements) if (!placements.has(id)) {
    placements.set(id, p);
    const b = byId.get(id)!;
    occupy(p.x, p.y, b.w, b.h);
  }
  for (const r of f.roads) if (!roads.has(r)) { roads.add(r); occupied.add(r); }
  const unplacedRoad = f.unplaced;
  if (opts.shouldStop()) return finalFrame();

  // ── B. Edifici senza strada → algoritmo di fase2 su tutta l'area libera ────
  const LBL = "Completamento · edifici senza strada (algoritmo fase 2)";
  const pool = problem.buildings.filter(b => !b.isTownhall && b.roadLevel === 0 && !placements.has(b.id));
  if (pool.length) {
    await emit(LBL + " · calcolo…", null, []);
    const mask: number[][] = [];
    for (let yy = problem.minY; yy <= problem.maxY; yy++) {
      const row: number[] = [];
      for (let xx = problem.minX; xx <= problem.maxX; xx++) row.push(isFree(xx, yy) ? 1 : 0);
      mask.push(row);
    }
    const fm = fillMask(mask, pool.map(b => ({ id: b.id, name: b.name, width: b.w, length: b.h, road_requirement: 0 })), 4096, 3000, true);
    if (fm) {
      const every = Math.max(1, Math.ceil(fm.vincitore.placed.length / 60));
      for (const p of fm.vincitore.placed) {
        if (opts.shouldStop()) break;
        const x = p.x + problem.minX, yy = p.y + problem.minY;
        if (!fits(x, yy, p.w, p.l)) continue; // (difensivo: non dovrebbe mai succedere)
        placements.set(p.id, { x, y: yy });
        occupy(x, yy, p.w, p.l);
        await emit(`${LBL} · ${fm.vincitore.nome}`, { x, y: yy, w: p.w, h: p.l }, [], every);
      }
    }
  }
  if (opts.shouldStop()) return finalFrame();

  // Ultimi rimasti → primo posto libero.
  f = await runPlaceholderPlanner(problem, {
    delayMs: opts.delayMs, onFrame: opts.onFrame, shouldStop: opts.shouldStop,
    initial: { placements, roads }, phase: "noroad", label: "Completamento · ultimi edifici",
  });
  if (opts.shouldStopFill && !opts.shouldStop()) {
    const r = await rifinisciSenzaStrada(problem, f, opts, () => valutate, (n) => { valutate = n; });
    if (r) f = r;
  }
  const last: PlannerFrame = { ...f, unplaced: [...new Set([...unplacedRoad, ...f.unplaced])], done: true };
  opts.onFrame(last);
  return last;
}

/**
 * ── C. Rifinitura continua degli edifici senza strada (dopo COMPLETA) ─────
 * Richieste dell'utente: il riempimento non si accontenta della prima
 * soluzione; si possono spostare TUTTI gli edifici senza strada (anche di
 * fase 1 e 2); strade, municipio ed edifici con strada restano fermi.
 * Obiettivi, in ordine:
 *  1. piazzare tutti gli edifici senza strada "veri" (entrambi i lati >= 2);
 *  2. colmare i BUCHI INTERNI (celle libere in zone che non toccano il bordo
 *     dell'area sbloccata), lasciando lo spazio libero fuori dal perimetro
 *     occupato, dove entrano edifici più grandi;
 *  3. minimo PERIMETRO ESPOSTO (lati fra una cella libera e una occupata) →
 *     la massa degli edifici resta compatta;
 *  4. meno zone libere.
 * Prima ancora dei buchi: nessun pezzo STACCATO (edifici senza strada non
 * collegati, attraverso celle occupate, alla massa del municipio).
 * I pezzi con un lato = 1 sono tappabuchi: esclusi dalla ricerca e messi
 * per ultimi (`tappabuchi`) sulla migliore, prima nei buchi interni, poi
 * attaccati alla massa.
 * Mosse: (a) finestra 6-14 × 6-14 attorno a un buco interno o a un pezzo
 * esposto: si tolgono i pezzi che la toccano e si ririempie con loro + i non
 * piazzati (fillMask di fase 2, veloce; può anche sostituire pezzi grandi con
 * altri); (b) "riloca": il pezzo più esposto viene tolto e rimesso nel posto
 * libero (ovunque) dove tocca più celle occupate. Il cammino accetta anche
 * risultati equivalenti; la migliore (mostrata e restituita) cambia solo se
 * migliora. Continua finché non viene interrotta (Reset); si può mettere in
 * pausa e modificare a mano gli edifici senza strada.
 */
async function rifinisciSenzaStrada(
  problem: PlannerProblem, start: PlannerFrame, opts: CompletionOptions,
  getValutate: () => number, setValutate: (n: number) => void,
): Promise<PlannerFrame | null> {
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  const senzaStrada = problem.buildings.filter(b => !b.isTownhall && b.roadLevel === 0);
  if (!senzaStrada.length) return null;
  const piccolo = (b: PlannerBuilding) => b.w === 1 || b.h === 1;
  const grandi = senzaStrada.filter(b => !piccolo(b));
  const piccoli = senzaStrada.filter(piccolo).sort((a, b) => b.w * b.h - a.w * a.h);
  /** Pezzi mossi dalla ricerca: senza strada con entrambi i lati >= 2. */
  const mobile = (id: string) => { const b = byId.get(id); return !!b && !b.isTownhall && b.roadLevel === 0 && !piccolo(b); };
  const tappo = (id: string) => { const b = byId.get(id); return !!b && !b.isTownhall && b.roadLevel === 0 && piccolo(b); };
  const roads = start.roads;
  const pl = new Map(start.placements);
  for (const id of [...pl.keys()]) if (tappo(id)) pl.delete(id); // i tappabuchi si rimettono alla fine
  /** cella → id dell'edificio (o "#" per la strada). */
  const owner = new Map<string, string>();
  for (const r of roads) owner.set(r, "#");
  const celle = (id: string, q: { x: number; y: number }) => {
    const b = byId.get(id)!, out: string[] = [];
    for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) out.push(key(q.x + dx, q.y + dy));
    return out;
  };
  for (const [id, q] of pl) for (const k of celle(id, q)) owner.set(k, id);
  // Griglia delle celle occupate (ottimizzazione: massa e buchi calcolati a
  // ogni tentativo; con le stringhe erano quasi metà del tempo).
  const GW = problem.maxX - problem.minX + 1, GH = problem.maxY - problem.minY + 1, N = GW * GH;
  const gIdx = (x: number, y: number) => { const i = x - problem.minX, j = y - problem.minY; return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : j * GW + i; };
  const cellG = new Uint8Array(N);
  for (const k of problem.cells) { const j = k.indexOf(","), g = gIdx(Number(k.slice(0, j)), Number(k.slice(j + 1))); if (g >= 0) cellG[g] = 1; }
  const og = new Uint8Array(N);
  const segnaG = (grid: Uint8Array, id: string, q: { x: number; y: number }, v: 0 | 1) => {
    const b = byId.get(id)!;
    for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) { const g = gIdx(q.x + dx, q.y + dy); if (g >= 0) grid[g] = v; }
  };
  for (const r of roads) { const j = r.indexOf(","), g = gIdx(Number(r.slice(0, j)), Number(r.slice(j + 1))); if (g >= 0) og[g] = 1; }
  for (const [id, q] of pl) segnaG(og, id, q, 1);
  const coda = new Int32Array(N);
  const xy = (k: string) => { const j = k.indexOf(","); return [Number(k.slice(0, j)), Number(k.slice(j + 1))] as [number, number]; };
  /** Analisi delle celle libere di uno stato (griglia occupata `oc`): buchi
   *  interni (marcati in `interni`), perimetro esposto, zone libere. */
  const analizza = (oc: Uint8Array) => {
    const visto = new Uint8Array(N);
    const interni = new Uint8Array(N);
    const elenco: number[] = [];
    let perimetro = 0, zone = 0;
    for (let s0 = 0; s0 < N; s0++) {
      if (!cellG[s0] || oc[s0] || visto[s0]) continue;
      zone++;
      let n = 0;
      coda[n++] = s0; visto[s0] = 1;
      let esterna = false;
      for (let i = 0; i < n; i++) {
        const c = coda[i]!, x = c % GW, y = (c - x) / GW;
        for (let d = 0; d < 4; d++) {
          const nx = d === 0 ? x + 1 : d === 1 ? x - 1 : x, ny = d === 2 ? y + 1 : d === 3 ? y - 1 : y;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) { esterna = true; continue; }
          const g = ny * GW + nx;
          if (!cellG[g]) { esterna = true; continue; }
          if (oc[g]) { perimetro++; continue; }
          if (visto[g]) continue;
          visto[g] = 1; coda[n++] = g;
        }
      }
      if (!esterna) for (let i = 0; i < n; i++) { interni[coda[i]!] = 1; elenco.push(coda[i]!); }
    }
    return { interni, elenco, perimetro, zone };
  };
  /** Massa principale: celle occupate (edifici + strade) collegate al
   *  municipio. Gli edifici senza strada fuori da essa sono "staccati". */
  const th = problem.buildings.find(b => b.isTownhall);
  const massa = (): Uint8Array => {
    const vis = new Uint8Array(N);
    let n = 0;
    const pth = th ? pl.get(th.id) : undefined;
    if (pth) { for (let dx = 0; dx < th!.w; dx++) for (let dy = 0; dy < th!.h; dy++) { const g = gIdx(pth.x + dx, pth.y + dy); if (g >= 0 && !vis[g]) { vis[g] = 1; coda[n++] = g; } } }
    for (let i = 0; i < n; i++) {
      const c = coda[i]!, x = c % GW, y = (c - x) / GW;
      for (let d = 0; d < 4; d++) {
        const nx = d === 0 ? x + 1 : d === 1 ? x - 1 : x, ny = d === 2 ? y + 1 : d === 3 ? y - 1 : y;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const g = ny * GW + nx;
        if (og[g] && !vis[g]) { vis[g] = 1; coda[n++] = g; }
      }
    }
    return vis;
  };
  const xyG = (g: number): [number, number] => { const x = g % GW; return [x + problem.minX, (g - x) / GW + problem.minY]; };
  let staccatiIds: string[] = [];
  type Punti = [number, number, number, number, number];
  let buchiInterni: number[] = [];
  const punteggio = (): Punti => {
    let fuori = 0;
    for (const b of grandi) if (!pl.has(b.id)) fuori += b.w * b.h;
    const m = massa();
    let staccati = 0;
    staccatiIds = [];
    for (const [id, q] of pl) if (mobile(id) && !m[gIdx(q.x, q.y)]) { const b = byId.get(id)!; staccati += b.w * b.h; staccatiIds.push(id); }
    const a = analizza(og);
    buchiInterni = a.elenco;
    return [fuori, staccati, a.elenco.length, a.perimetro, a.zone];
  };
  const confronta = (a: Punti, b: Punti) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3] || a[4] - b[4];
  /** Celle libere di contatto con la massa (per scegliere dove rimettere un pezzo). */
  const contatto = (x: number, y: number, w: number, h: number, occ: (k: string) => boolean) => {
    let c = 0;
    for (let dx = 0; dx < w; dx++) { if (occ(key(x + dx, y - 1))) c++; if (occ(key(x + dx, y + h))) c++; }
    for (let dy = 0; dy < h; dy++) { if (occ(key(x - 1, y + dy))) c++; if (occ(key(x + w, y + dy))) c++; }
    return c;
  };
  const libera = (x: number, y: number, w: number, h: number, occ: (k: string) => boolean) => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) { const k = key(x + dx, y + dy); if (!problem.cells.has(k) || occ(k)) return false; }
    return true;
  };
  /** Tappabuchi (pezzi con un lato = 1), per ultimi: prima nei buchi
   *  interni, poi attaccati alla massa (massimo contatto). */
  const tappabuchi = (base: Map<string, { x: number; y: number }>) => {
    const out = new Map(base);
    const occ = new Set<string>(roads);
    for (const [id, q] of base) for (const k of celle(id, q)) occ.add(k);
    const isOcc = (k: string) => occ.has(k);
    const ocG = new Uint8Array(N);
    for (const k of occ) { const j = k.indexOf(","), g = gIdx(Number(k.slice(0, j)), Number(k.slice(j + 1))); if (g >= 0) ocG[g] = 1; }
    let interni = analizza(ocG).interni;
    for (const b of piccoli) {
      let best: [number, number] | null = null, bv = -1, bc = 0;
      for (const k of problem.cells) {
        if (occ.has(k)) continue;
        const [x, y] = xy(k);
        if (!libera(x, y, b.w, b.h, isOcc)) continue;
        let inBuco = 0;
        for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) { const g = gIdx(x + dx, y + dy); if (g >= 0 && interni[g]) inBuco++; }
        const c = contatto(x, y, b.w, b.h, isOcc);
        if (c === 0) continue; // mai pezzi staccati
        const v = inBuco * 100 + c;
        if (v > bv) { bv = v; best = [x, y]; bc = inBuco; }
      }
      if (!best) continue;
      out.set(b.id, { x: best[0], y: best[1] });
      for (const k of celle(b.id, { x: best[0], y: best[1] })) occ.add(k);
      segnaG(ocG, b.id, { x: best[0], y: best[1] }, 1);
      if (bc) interni = analizza(ocG).interni;
    }
    return out;
  };
  let corrente = punteggio();
  let migliore = { pl: new Map(pl), punti: corrente };
  let mostrata = tappabuchi(migliore.pl);
  const rnd = mulberry32(777);
  let valutate = getValutate(), trovataAl = valutate, senzaMigliorare = 0;
  const mostra = (stato: string) => {
    const fuori = senzaStrada.filter(b => !mostrata.has(b.id)).map(b => b.id);
    opts.onFrame({
      placements: new Map(mostrata), roads: new Set(roads), probe: null, lastPath: [],
      placed: mostrata.size, unplaced: fuori, iterations: valutate, done: false,
      search: { valutate, strade: null, spreco: 0, buchi: migliore.punti[2], latiLiberi: 0, trovataAl, esclusi: 0, attiva: stato === "" },
      label: `Rifinitura edifici senza strada · ${valutate.toLocaleString()} tentativi · buchi interni ${migliore.punti[2]} · perimetro ${migliore.punti[3]}`
        + `${migliore.punti[1] ? ` · ${migliore.punti[1]} celle staccate` : ""}`
        + `${fuori.length ? ` · ${fuori.length} non piazzati` : ""}${stato}`,
    });
  };
  const togli = (id: string) => { const q = pl.get(id)!; for (const k of celle(id, q)) owner.delete(k); segnaG(og, id, q, 0); pl.delete(id); };
  const metti = (id: string, q: { x: number; y: number }) => { pl.set(id, q); for (const k of celle(id, q)) owner.set(k, id); segnaG(og, id, q, 1); };
  /** Pezzo mobile più esposto (lati liberi), scelto fra i 5 più esposti. */
  const esposto = (): string | null => {
    // prima i pezzi staccati dalla massa
    if (staccatiIds.length && rnd() < 0.8) return staccatiIds[Math.floor(rnd() * staccatiIds.length)]!;
    const lista: Array<[string, number]> = [];
    for (const [id, q] of pl) {
      if (!mobile(id)) continue;
      const b = byId.get(id)!;
      const liberi = 2 * (b.w + b.h) - contatto(q.x, q.y, b.w, b.h, k => owner.has(k) || !problem.cells.has(k));
      if (liberi > 0) lista.push([id, liberi / (2 * (b.w + b.h))]);
    }
    if (!lista.length) return null;
    lista.sort((a, b) => b[1] - a[1]);
    return lista[Math.floor(rnd() * Math.min(5, lista.length))]![0];
  };
  opts.onFillActive?.(true);
  mostra("");
  let lastYield = performance.now(), lastShow = 0;
  while (!opts.shouldStop() && !opts.shouldStopFill!()) {
    // Stallo: il cammino riparte dalla migliore.
    if (++senzaMigliorare > 400) {
      for (const id of [...pl.keys()]) if (mobile(id)) togli(id);
      for (const [id, q] of migliore.pl) if (mobile(id)) metti(id, q);
      corrente = punteggio();
      senzaMigliorare = 0;
    }
    const tolti = new Map<string, { x: number; y: number }>();
    const messi: string[] = [];
    const u = rnd();
    if (u < 0.3) {
      // (b) riloca il pezzo più esposto nel posto con più contatto (o un non piazzato).
      const fuoriG = grandi.filter(b => !pl.has(b.id));
      const id = fuoriG.length && rnd() < 0.3 ? fuoriG[Math.floor(rnd() * fuoriG.length)]!.id : esposto();
      if (id) {
        if (pl.has(id)) { tolti.set(id, pl.get(id)!); togli(id); }
        const b = byId.get(id)!, isOcc = (k: string) => owner.has(k);
        let best: [number, number] | null = null, bv = -1;
        for (const k of problem.cells) {
          if (owner.has(k)) continue;
          const [x, y] = xy(k);
          if (!libera(x, y, b.w, b.h, isOcc)) continue;
          const v = contatto(x, y, b.w, b.h, k2 => owner.has(k2) || !problem.cells.has(k2));
          if (v > bv || (v === bv && rnd() < 0.3)) { bv = v; best = [x, y]; }
        }
        if (best) { metti(id, { x: best[0], y: best[1] }); messi.push(id); }
      }
    } else {
      // (a) finestra attorno a un buco interno (o a un pezzo esposto) ririempita con fillMask.
      let cx: number, cy: number;
      const e = buchiInterni.length && !staccatiIds.length && rnd() < 0.7 ? null : esposto();
      if (e) { const q = pl.get(e)!; cx = q.x; cy = q.y; }
      else if (buchiInterni.length) [cx, cy] = xyG(buchiInterni[Math.floor(rnd() * buchiInterni.length)]!);
      else break;
      const ww = 6 + Math.floor(rnd() * 9), wh = 6 + Math.floor(rnd() * 9);
      const x0 = cx - Math.floor(ww / 2), y0 = cy - Math.floor(wh / 2);
      for (let x = x0; x < x0 + ww; x++) for (let y = y0; y < y0 + wh; y++) {
        const o = owner.get(key(x, y));
        if (o && o !== "#" && mobile(o) && !tolti.has(o)) tolti.set(o, pl.get(o)!);
      }
      for (const id of tolti.keys()) togli(id);
      const libere = new Set<string>();
      for (let x = x0; x < x0 + ww; x++) for (let y = y0; y < y0 + wh; y++) { const k = key(x, y); if (problem.cells.has(k) && !owner.has(k)) libere.add(k); }
      for (const [id, q] of tolti) for (const k of celle(id, q)) libere.add(k);
      if (libere.size) {
        let mx0 = Infinity, my0 = Infinity, mx1 = -Infinity, my1 = -Infinity;
        for (const k of libere) { const [x, y] = xy(k); mx0 = Math.min(mx0, x); my0 = Math.min(my0, y); mx1 = Math.max(mx1, x); my1 = Math.max(my1, y); }
        const mask: number[][] = [];
        for (let y = my0; y <= my1; y++) { const row: number[] = []; for (let x = mx0; x <= mx1; x++) row.push(libere.has(key(x, y)) ? 1 : 0); mask.push(row); }
        const pool = grandi.filter(b => !pl.has(b.id) && b.w * b.h <= libere.size)
          .map(b => ({ id: b.id, name: b.name, width: b.w, length: b.h, road_requirement: 0 }));
        const fm = pool.length ? fillMask(mask, pool, 4096, 1500, true) : null;
        if (fm) for (const q of fm.vincitore.placed) {
          const x = q.x + mx0, y = q.y + my0;
          if (!mobile(q.id)) continue;
          const cc = celle(q.id, { x, y });
          if (cc.some(k => !libere.has(k) || owner.has(k))) continue; // difensivo
          metti(q.id, { x, y }); messi.push(q.id);
        }
      }
    }
    valutate++;
    let migliorata = false;
    const pt = punteggio();
    if (confronta(pt, corrente) <= 0) {
      corrente = pt;
      if (confronta(pt, migliore.punti) < 0) {
        migliore = { pl: new Map(pl), punti: pt }; mostrata = tappabuchi(migliore.pl);
        migliorata = true; trovataAl = valutate; senzaMigliorare = 0;
      }
    } else {
      for (const id of messi) togli(id);
      for (const [id, q] of tolti) metti(id, q);
      punteggio(); // riallinea l'elenco dei buchi interni
    }
    const now = performance.now();
    if (migliorata || now - lastShow > 500) { mostra(""); lastShow = now; }
    if (now - lastYield > 40) { await sleep(0); lastYield = performance.now(); }
    // Pausa: l'utente può spostare o togliere gli edifici senza strada; alla
    // ripresa la sua disposizione diventa la corrente e la migliore.
    if (opts.isPaused?.() && opts.waitResume) {
      mostra(" · in pausa");
      opts.onPaused?.(true);
      const man = await opts.waitResume();
      opts.onPaused?.(false);
      lastYield = performance.now();
      if (man) {
        for (const id of [...pl.keys()]) if (mobile(id)) togli(id);
        for (const [id, q] of man.placements) {
          if (!mobile(id)) continue;
          const cc = celle(id, q);
          if (cc.some(k => !problem.cells.has(k) || owner.has(k))) continue; // (difensivo)
          metti(id, { x: q.x, y: q.y });
        }
        corrente = punteggio();
        migliore = { pl: new Map(pl), punti: corrente }; mostrata = tappabuchi(migliore.pl);
        senzaMigliorare = 0; trovataAl = valutate;
        mostra("");
      }
    }
  }
  setValutate(valutate);
  opts.onFillActive?.(false);
  mostra(" · rifinitura conclusa");
  const fuori = senzaStrada.filter(b => !mostrata.has(b.id)).map(b => b.id);
  const isNoRoad = (id: string) => mobile(id) || tappo(id);
  return { ...start, placements: mostrata, placed: mostrata.size, unplaced: [...start.unplaced.filter(id => !isNoRoad(id)), ...fuori] };
}
