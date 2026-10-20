// ─────────────────────────────────────────────────────────────────────────────
//  planner/engine.ts — Motore del Planner città (SEGNAPOSTO, ottobre 2026)
//
//  Sempre incluso nel tool (il flag di build SHOW_PLANNER è stato tolto il 19 ottobre 2026).
//
//  Obiettivo finale: la disposizione della città che minimizza le strade
//  (problema NP-hard). Questo file definisce il CONTRATTO del motore
//  (problema → sequenza di fotogrammi animati) e un primo algoritmo semplice,
//  "greedy con strade a costo minimo", utile solo per avere qualcosa da vedere
//  e da misurare. Andrà sostituito/affiancato da motori veri.
//
//  Algoritmo segnaposto:
//   1. Municipio fermo nella sua posizione attuale: è la radice della rete
//      stradale (le strade partono dal suo perimetro).
//   2. Edifici che richiedono strada, dal più grande: per ogni posizione libera
//      si misura (BFS multi-sorgente dalla rete esistente) quante strade nuove
//      servono per collegarlo; si provano le posizioni dalla più economica e si
//      accetta la prima che NON soffoca la rete: dopo averla piazzata, l'area
//      libera ancora raggiungibile dalla rete deve bastare agli edifici con
//      strada rimanenti (altrimenti il greedy murava il municipio al primo giro
//      e lasciava fuori metà degli edifici). Poi si "scava" il percorso.
//   3. Edifici senza strada, dal più grande: primo posto libero.
//  Limiti noti: strade sempre 1×1 (anche per chi chiede la 2×2), nessuna
//  ottimizzazione globale, nessun backtracking.
// ─────────────────────────────────────────────────────────────────────────────

import type { CityMapBuilding } from "../data/cityMap";
import { isMilitaryBuildingId } from "../data/buildingClassification";

export interface PlannerBuilding {
  /** Id dell'istanza (mapEntityId): unico per copia. */
  id: string;
  entityId: string;
  name: string;
  w: number;
  h: number;
  /** 0 = nessuna strada, 1 = strada 1×1, 2 = strada 2×2. */
  roadLevel: number;
  isTownhall: boolean;
  /** Edificio militare (colore marrone sulle mappe del Planner). */
  isMilitary?: boolean;
  /** Inattivo nella città (colore viola, come nella vista MAPPA). */
  isInactive?: boolean;
  /** Posizione nella città reale (per il municipio fisso). */
  origX: number;
  origY: number;
  /** Blocco di una catena (catene.ts): solo questa parte (l'inizio della
   *  catena, relativa all'angolo in alto a sinistra) conta per il
   *  collegamento alla strada. Assente = tutto l'edificio. */
  zonaStrada?: { x: number; y: number; w: number; h: number };
}

/** L'edificio b in (x, y) tocca una strada? Con `zonaStrada` (blocchi di
 *  catena) conta solo il contorno della zona dell'inizio, fuori dal blocco:
 *  una catena attaccata alla strada dalla parte dell'ultimo anello NON è
 *  collegata (segnalazione dell'utente sul treno di Filanush). */
export function toccaStradaZona(b: PlannerBuilding, x: number, y: number, isRoad: (x: number, y: number) => boolean): boolean {
  return perimetroZona(b, x, y).some(([cx, cy]) => isRoad(cx, cy));
}

/** Contorno esterno di un blocco di catena FUORI dalla zona dell'inizio
 *  (accanto agli anelli, che non richiedono strada): una strada qui è
 *  sprecata (segnalazione dell'utente). Vuoto per gli edifici normali. */
export function perimetroCoda(b: PlannerBuilding, x: number, y: number): Array<[number, number]> {
  if (!b.zonaStrada) return [];
  const zona = new Set(perimetroZona(b, x, y).map(([cx, cy]) => cx + "," + cy));
  const out: Array<[number, number]> = [];
  const add = (cx: number, cy: number) => { if (!zona.has(cx + "," + cy)) out.push([cx, cy]); };
  for (let d = 0; d < b.w; d++) { add(x + d, y - 1); add(x + d, y + b.h); }
  for (let d = 0; d < b.h; d++) { add(x - 1, y + d); add(x + b.w, y + d); }
  return out;
}

/** Celle esterne da cui l'edificio b in (x, y) si collega alla strada: il
 *  contorno della `zonaStrada` (o di tutto l'edificio) fuori dall'edificio. */
export function perimetroZona(b: PlannerBuilding, x: number, y: number): Array<[number, number]> {
  const z = b.zonaStrada ?? { x: 0, y: 0, w: b.w, h: b.h };
  const X = x + z.x, Y = y + z.y;
  const fuori = (cx: number, cy: number) => cx < x || cx >= x + b.w || cy < y || cy >= y + b.h;
  const out: Array<[number, number]> = [];
  for (let d = 0; d < z.w; d++) for (const yy of [Y - 1, Y + z.h]) if (fuori(X + d, yy)) out.push([X + d, yy]);
  for (let d = 0; d < z.h; d++) for (const xx of [X - 1, X + z.w]) if (fuori(xx, Y + d)) out.push([xx, Y + d]);
  return out;
}

export interface PlannerProblem {
  /** Celle sbloccate, chiave "x,y". */
  cells: Set<string>;
  minX: number; minY: number; maxX: number; maxY: number;
  buildings: PlannerBuilding[];
  /** Celle di strada nella città reale (per il confronto). */
  originalRoadCells: number;
  /** Nomi dei GE che riforniscono le truppe degli edifici militari anche
   *  senza strada (Alcatraz, Nave da guerra stellare): se presenti, gli
   *  edifici militari sono trattati come "senza strada". */
  geRifornimento: string[];
}

/** GE che producono ogni 24 ore truppe di un edificio militare della città
 *  anche se l'edificio non è collegato alla strada. */
const GE_RIFORNIMENTO_MILITARE = ["X_ProgressiveEra_Landmark1", "X_SpaceAgeSpaceHub_Landmark1"];

export interface PlannerFrame {
  placements: Map<string, { x: number; y: number }>;
  roads: Set<string>;
  /** Rettangolo che il motore sta valutando in questo momento (per l'animazione). */
  probe: { x: number; y: number; w: number; h: number } | null;
  /** Percorso di strada appena scavato (per l'animazione). */
  lastPath: string[];
  placed: number;
  unplaced: string[];
  iterations: number;
  done: boolean;
  /** Fase in corso (es. "Passo 3 · riempimento centrale"), per la UI. */
  label?: string;
  /** Avanzamento della ricerca degli edifici con strada (completamento). */
  search?: { valutate: number; strade: number | null; spreco: number; buchi?: number; latiLiberi: number; altiInterni?: number; trovataAl: number; esclusi: number; attiva: boolean; deficit?: number;
    /** Edifici con strada non collegati al municipio (ricerca parametrica): una disposizione così non si adotta. */
    scollegate?: number };
}

/** Costruisce il problema dai dati della mappa città già importati. */
export function buildPlannerProblem(cityMapBuildings: readonly CityMapBuilding[], unlockedCells: ReadonlySet<string>): PlannerProblem {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of unlockedCells) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  let originalRoadCells = 0;
  const buildings: PlannerBuilding[] = [];
  const geRifornimento = cityMapBuildings.filter(b => GE_RIFORNIMENTO_MILITARE.includes(b.entityId)).map(b => b.name);
  for (const b of cityMapBuildings) {
    if (b.type === "street") { originalRoadCells += b.w * b.h; continue; }
    // Profili vecchi senza roadLevel: trattati come "richiede strada", come la mappa.
    let roadLevel = b.roadLevel ?? 1;
    // Con Alcatraz / Nave da guerra stellare i militari non hanno bisogno di strada.
    // Militare: flag della mappa oppure prefisso "M_" (profili salvati senza il flag).
    const militare = (b.isMilitary || isMilitaryBuildingId(b.entityId)) && !b.isGreatBuilding;
    if (militare && geRifornimento.length) roadLevel = 0;
    buildings.push({
      id: b.mapEntityId, entityId: b.entityId, name: b.name, w: b.w, h: b.h,
      roadLevel,
      isTownhall: b.type === "main_building",
      isMilitary: militare,
      isInactive: b.isInactive,
      origX: b.x, origY: b.y,
    });
  }
  return { cells: new Set(unlockedCells), minX, minY, maxX, maxY, buildings, originalRoadCells, geRifornimento };
}

const key = (x: number, y: number) => `${x},${y}`;

/** Cede il controllo al browser senza il clamp dei timer (come il solver Pirati). */
function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  if (typeof MessageChannel === "function") {
    return new Promise<void>((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { ch.port1.close(); ch.port2.close(); resolve(); };
      ch.port2.postMessage(undefined);
    });
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RunOptions {
  /** Pausa (ms) tra un fotogramma e il successivo: 0 = massima velocità. */
  delayMs: number;
  onFrame: (f: PlannerFrame) => void;
  shouldStop: () => boolean;
  /** Stato di partenza (es. l'esito del builder fino a fase2): il municipio
   *  prende la posizione indicata qui, gli edifici già piazzati e le strade
   *  restano fermi, il motore piazza solo i rimanenti. */
  initial?: { placements: ReadonlyMap<string, { x: number; y: number }>; roads: ReadonlySet<string> };
  /** Quali edifici piazzare: tutti (default), solo quelli con strada, solo quelli senza. */
  phase?: "all" | "road" | "noroad";
  /** Etichetta dei fotogrammi (default "Motore Planner"). */
  label?: string;
}

/** Esegue il motore segnaposto, emettendo un fotogramma per ogni passo visibile. */
export async function runPlaceholderPlanner(problem: PlannerProblem, opts: RunOptions): Promise<PlannerFrame> {
  const occupied = new Set<string>();
  const roads = new Set<string>();
  const placements = new Map<string, { x: number; y: number }>();
  const unplaced: string[] = [];
  let iterations = 0;
  let lastYield = performance.now();

  const isFree = (x: number, y: number) => problem.cells.has(key(x, y)) && !occupied.has(key(x, y));
  const fits = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) if (!isFree(x + dx, y + dy)) return false;
    return true;
  };
  const occupy = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) occupied.add(key(x + dx, y + dy));
  };
  const perimeter = (x: number, y: number, w: number, h: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let dx = 0; dx < w; dx++) { out.push([x + dx, y - 1], [x + dx, y + h]); }
    for (let dy = 0; dy < h; dy++) { out.push([x - 1, y + dy], [x + w, y + dy]); }
    return out;
  };

  const label = opts.label ?? (opts.initial ? "Motore Planner · edifici rimanenti" : "Motore Planner");
  const phase = opts.phase ?? "all";
  const frame = (probe: PlannerFrame["probe"], lastPath: string[], done = false): PlannerFrame => ({
    placements: new Map(placements), roads: new Set(roads), probe, lastPath,
    placed: placements.size, unplaced: [...unplaced], iterations, done, label,
  });
  const emit = async (f: PlannerFrame) => {
    opts.onFrame(f);
    if (opts.delayMs > 0) await sleep(opts.delayMs);
    else if (performance.now() - lastYield > 16) { await yieldToEventLoop(); lastYield = performance.now(); }
  };

  // 1. Municipio fermo: le sue celle di perimetro libere sono la radice della rete.
  const townhall = problem.buildings.find(b => b.isTownhall);
  const roots: Array<[number, number]> = [];
  if (townhall) {
    const pos = opts.initial?.placements.get(townhall.id) ?? { x: townhall.origX, y: townhall.origY };
    placements.set(townhall.id, pos);
    occupy(pos.x, pos.y, townhall.w, townhall.h);
    roots.push(...perimeter(pos.x, pos.y, townhall.w, townhall.h));
  }
  if (opts.initial) {
    const byId = new Map(problem.buildings.map(b => [b.id, b]));
    for (const [id, p] of opts.initial.placements) {
      const b = byId.get(id);
      if (!b || b.isTownhall) continue;
      placements.set(id, p);
      occupy(p.x, p.y, b.w, b.h);
    }
    for (const r of opts.initial.roads) { roads.add(r); occupied.add(r); }
  }
  await emit(frame(null, []));

  /** BFS multi-sorgente sulle celle libere dalla rete stradale (o dal perimetro
   *  del municipio se non c'è ancora strada): distanza = strade nuove necessarie. */
  const roadDistances = () => {
    const dist = new Map<string, number>();
    const parent = new Map<string, string | null>();
    const queue: Array<[number, number]> = [];
    const seed = (x: number, y: number, d: number) => {
      const k = key(x, y);
      if (dist.has(k)) return;
      dist.set(k, d); parent.set(k, null); queue.push([x, y]);
    };
    for (const r of roads) { const [x, y] = r.split(",").map(Number) as [number, number]; seed(x, y, 0); }
    for (const [x, y] of roots) if (isFree(x, y) && !roads.has(key(x, y))) seed(x, y, 1);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      const d = dist.get(key(x, y))!;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Array<[number, number]>) {
        const nk = key(nx, ny);
        if (dist.has(nk) || !isFree(nx, ny)) continue;
        dist.set(nk, d + 1); parent.set(nk, key(x, y)); queue.push([nx, ny]);
      }
    }
    return { dist, parent };
  };

  const byAreaDesc = (a: PlannerBuilding, b: PlannerBuilding) => b.w * b.h - a.w * a.h;
  const pending = problem.buildings.filter(b => !b.isTownhall && !placements.has(b.id));
  const withRoad = phase === "noroad" ? [] : pending.filter(b => b.roadLevel > 0).sort(byAreaDesc);
  const noRoad = phase === "road" ? [] : pending.filter(b => b.roadLevel === 0).sort(byAreaDesc);
  // Fase "solo senza strada": gli edifici con strada ancora fuori restano non piazzati.
  if (phase === "noroad") for (const b of pending) if (b.roadLevel > 0) unplaced.push(b.id);

  /** Celle libere raggiungibili dalla rete (strade + perimetro del municipio). */
  const reachableFree = (): number => {
    const seen = new Set<string>();
    const queue: Array<[number, number]> = [];
    const push = (x: number, y: number) => { const k = key(x, y); if (!seen.has(k) && isFree(x, y)) { seen.add(k); queue.push([x, y]); } };
    for (const r of roads) {
      const [x, y] = r.split(",").map(Number) as [number, number];
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    for (const [x, y] of roots) push(x, y);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    return seen.size;
  };
  // Area ancora necessaria agli edifici con strada (+50% di margine per le strade).
  let remainingRoadArea = withRoad.reduce((s, b) => s + b.w * b.h, 0);
  const MAX_TRIES = 120;

  // 2. Edifici con strada: posizione più economica che non soffoca la rete.
  for (const b of withRoad) {
    if (opts.shouldStop()) return frame(null, [], true);
    remainingRoadArea -= b.w * b.h;
    const { dist, parent } = roadDistances();
    const cands: Array<{ x: number; y: number; cost: number; via: string }> = [];
    for (let y = problem.minY; y <= problem.maxY; y++) {
      for (let x = problem.minX; x <= problem.maxX; x++) {
        iterations++;
        if (!fits(x, y, b.w, b.h)) continue;
        let best: { cost: number; via: string } | null = null;
        // (blocchi di catena: la strada deve arrivare all'inizio della catena)
        for (const [px, py] of perimetroZona(b, x, y)) {
          const pk = key(px, py);
          const d = dist.get(pk);
          if (d !== undefined && (!best || d < best.cost)) best = { cost: d, via: pk };
        }
        if (best) cands.push({ x, y, ...best });
      }
    }
    cands.sort((a, b2) => a.cost - b2.cost);
    let accepted = false;
    for (const c of cands.slice(0, MAX_TRIES)) {
      iterations++;
      const path: string[] = [];
      for (let k: string | null = c.via; k !== null && !roads.has(k); k = parent.get(k) ?? null) path.push(k);
      // Il percorso non deve passare sotto l'edificio stesso.
      if (path.some(k => { const [px, py] = k.split(",").map(Number) as [number, number]; return px >= c.x && px < c.x + b.w && py >= c.y && py < c.y + b.h; })) continue;
      // Prova: piazza, scava, misura lo spazio raggiungibile rimasto.
      for (const k of path) { roads.add(k); occupied.add(k); }
      occupy(c.x, c.y, b.w, b.h);
      const ok = remainingRoadArea === 0 || reachableFree() >= remainingRoadArea * 1.5;
      if (ok) {
        placements.set(b.id, { x: c.x, y: c.y });
        await emit(frame({ x: c.x, y: c.y, w: b.w, h: b.h }, path));
        accepted = true;
        break;
      }
      // Annulla la prova.
      for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) occupied.delete(key(c.x + dx, c.y + dy));
      for (const k of path) { roads.delete(k); occupied.delete(k); }
      if (opts.delayMs > 0) await emit(frame({ x: c.x, y: c.y, w: b.w, h: b.h }, []));
    }
    if (!accepted) unplaced.push(b.id);
    await emit(frame(null, []));
  }

  // 3. Edifici senza strada: il posto libero che tocca più celle occupate (o
  // fuori mappa), a parità il primo; prima era il primo posto libero in
  // assoluto, che lasciava pezzi isolati lontano dal resto.
  const contatto = (x: number, y: number, w: number, h: number) => {
    let c = 0;
    for (const [px, py] of perimeter(x, y, w, h)) { const k = key(px, py); if (!problem.cells.has(k) || occupied.has(k)) c++; }
    return c;
  };
  for (const b of noRoad) {
    if (opts.shouldStop()) return frame(null, [], true);
    let best: { x: number; y: number; c: number } | null = null;
    for (let y = problem.minY; y <= problem.maxY; y++) {
      for (let x = problem.minX; x <= problem.maxX; x++) {
        iterations++;
        if (!fits(x, y, b.w, b.h)) continue;
        const c = contatto(x, y, b.w, b.h);
        if (!best || c > best.c) best = { x, y, c };
      }
    }
    if (best) { placements.set(b.id, { x: best.x, y: best.y }); occupy(best.x, best.y, b.w, b.h); }
    else unplaced.push(b.id);
    await emit(frame(null, []));
  }

  const last = frame(null, [], true);
  opts.onFrame(last);
  return last;
}
