// ─────────────────────────────────────────────────────────────────────────────
//  planner/PlannerView.tsx — Modulo Planner della tab Città (SPERIMENTALE)
//
//  Sempre incluso nel tool (il flag di build SHOW_PLANNER è stato tolto il 19 ottobre 2026).
//  Tre mappe (raccordo est a 3 celle, a 4 celle, girandola), eliminabili col
//  cestino, calcolate in parallelo
//  (FoE City Builder fase 1+2, poi ricerca degli edifici con strada e
//  riempimento). Avvia / Pausa-Riprendi / COMPLETA / Reset valgono per
//  entrambe; l'utente sceglie la disposizione che preferisce.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import type { CityMapBuilding } from "../data/cityMap";
import { buildPlannerProblem, runPlaceholderPlanner, tipiMilitari, toccaStradaZona, type PlannerBuilding, type PlannerFrame, type PlannerProblem } from "./engine";
import { runBuilder, type BuilderVariant } from "./builder";
import type { CompletionOptions, StatoManuale } from "./completion";
import { runCompletionParallela, scegliGirandolaParallela } from "./parallelo";
import { calcolaRoadEff, calcolaStradeVuote, contaAngoli, DEBUG_PLANNER } from "./roadEff";
import { smussaBordi } from "./smussa";
import { baseCentrale, type BaseGirandola } from "./girandola";
import { espandiCatene, raggruppaCatene, SET_DI_EDIFICI } from "./catene";
import { coloreEdificioMappa, renderCityMapPng } from "../components/cityMapPng";
import { t, type UiLang } from "../data/ui-strings";
import { localDateStamp } from "../utils/format";
import { esportaCittaJson, leggiCittaJson, scaricaJson, type CittaJson } from "../data/cityMapJson";
import { cittaDaEditor } from "./editorPonte";
import VideoTutorial from "./VideoTutorial";
import ModificaCitta from "./ModificaCitta";
import { applicaModifiche, contaModifiche, eNuovo, NESSUNA_MODIFICA, type CandidatiPlanner, type Modifiche } from "./modificheCitta";
import { celleBlocchi, nucleiDueCorsie, richiedeDueCorsie, verificaDueCorsie, type Nucleo } from "./dueCorsie";

interface Props {
  cityMapBuildings: readonly CityMapBuilding[];
  cityMapUnlockedCells: ReadonlySet<string>;
  /** Edifici aggiungibili con "Modifica città" (inventario, database). */
  candidati: CandidatiPlanner;
  uiLang: UiLang;
}

/** Scenari: raccordo 3/4 celle e girandola. Partono tutti in parallelo;
 *  l'utente può eliminare quelli che non gli servono. (Gli scenari
 *  "compattati" sono stati tolti: si compatta a mano con "Sposta tutto".) */
type VName = "r3" | "r4" | "r5" | "gir" | "gir2" | "att";
const VARIANTI: VName[] = ["r3", "r4", "r5", "gir", "gir2", "att"];
const tutte = <T,>(v: T): Record<VName, T> => ({ r3: v, r4: v, r5: v, gir: v, gir2: v, att: v });
/** Scenario: base del builder (v) oppure "Girandola" (v = null, raccordo 0:
 *  municipio e quattro bracci, vedi girandola.ts). */
interface Scenario {
  id: VName; v: BuilderVariant | null; raccordo: 0 | 3 | 4 | 5; /** girandola: 0 = migliore posizione, 1 = seconda */ gir?: 0 | 1;
  /** "Configurazione attuale": la ricerca parte dalla città così com'è (vedi statoAttuale). */
  attuale?: true;
  /** Raccordi: partenza del builder SENZA margine vietato dal bordo (Passo 7),
   *  se diversa da `v`. All'avvio si confrontano le due con una breve ricerca
   *  e si tiene la migliore (Stralis 150 → 133 strade; Filanush senza margine
   *  lascerebbe fuori edifici con strada). */
  alt?: BuilderVariant;
}
/** Disposizioni della breve ricerca che sceglie la partenza (con o senza margine dal bordo). */
const VALUTATE_SCELTA_MARGINE = 800;
/** Squadra di ricerca (ottobre 2026): ogni scenario fa girare più ricerche con
 *  semi diversi, ognuna nel suo worker. La ricerca locale si blocca presto in
 *  un minimo locale e il risultato dipende molto dal seme (Avito r4 a 15.000
 *  disposizioni: da 166 a 171 strade secondo il seme), quindi più semi in
 *  parallelo valgono più di tante prove su un solo seme. La ricerca
 *  "principale" (seme 12345, quella mostrata, che si mette in pausa e si
 *  completa) adotta la disposizione di un'aiutante appena questa è migliore.
 *  Semi per scenario: core disponibili / scenari, fra 1 e SEMI_MAX; quando
 *  si elimina uno scenario i suoi core passano agli altri (nuove aiutanti). */
const SEMI = [12345, 5, 99, 2024];
/** Entità della strada a due corsie (2×2) quando la città non ne ha ancora una piazzata. */
const STRADA_2X2_DEFAULT = "S_ProgressiveEra_CarStreet1";
const SEMI_MAX = 8;
const seme = (i: number) => SEMI[i] ?? 7919 * i + 13;
/** Potenza della CPU scelta nella toolbar (richiesta dell'utente):
 *  MAX = ricerche ≈ core (100%); MED ≈ metà dei core (~50%); MIN = una
 *  ricerca per scenario (com'era prima della squadra, ~25% con le pause).
 *  Se gli scenari sono più delle ricerche ammesse, le ricerche fanno pause
 *  regolari (dopo ogni fetta di lavoro, lunghe in proporzione) per restare al livello scelto. */
type Potenza = "min" | "med" | "max";
// MED a 0,35 e non 0,5 (prova dell'utente, 16 core): con 8 ricerche il Task
// Manager segnava 75-80%, non 50%. Oltre alle ricerche lavorano i thread del
// browser per ogni worker (raccolta della memoria, molto attiva nella ricerca
// locale che crea mappe e insiemi a ogni tentativo): con 6 ricerche si sta
// attorno al 50% reale. MIN (una ricerca per scenario) era già giusto.
const QUOTA: Record<Potenza, number> = { min: 0.25, med: 0.35, max: 1 };
const CHIAVE_POTENZA = "foe-planner-potenza";
const leggiPotenza = (): Potenza => {
  // default MED (richiesta dell'utente); la scelta salvata ha la precedenza
  try { const v = localStorage.getItem(CHIAVE_POTENZA); return v === "min" || v === "med" || v === "max" ? v : "med"; } catch { return "med"; }
};
/** Ricerche per scenario e pausa (in proporzione al tempo di lavoro), dati scenari attivi e potenza. */
function carico(scenari: number, p: Potenza): { semi: number; riposo: number } {
  const core = coreDisponibili(), n = Math.max(1, scenari);
  // MAX come prima (per difetto, mai pause); MED per eccesso e poi pause, così
  // il carico resta vicino al 50% anche quando core/scenari non è intero
  const quota = (core * QUOTA[p]) / n;
  const semi = p === "min" ? 1 : Math.max(1, Math.min(SEMI_MAX, p === "max" ? Math.floor(quota) : Math.ceil(quota)));
  if (p === "max") return { semi, riposo: 0 }; // MAX: mai pause, come prima
  const lavoro = Math.min(1, (core * QUOTA[p]) / (n * semi)); // frazione di tempo al lavoro di ogni ricerca
  return { semi, riposo: lavoro >= 1 ? 0 : (1 - lavoro) / lavoro }; // pausa = lavoro × riposo
}
/** Core del processore (navigator.hardwareConcurrency, 4 se non noto). */
const coreDisponibili = () => (typeof navigator !== "undefined" && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4);
const CELL = 10; // px per cella (il canvas è poi scalato alla larghezza disponibile)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Velocità fissa: massima (nessuna pausa tra i fotogrammi). */
const delayMs = 0;

/** Edifici con strada non collegati alla rete del municipio (bordo rosso in pausa). */
function scollegati(frame: PlannerFrame, problem: PlannerProblem, byId: Map<string, PlannerBuilding>): Set<string> {
  const k = (x: number, y: number) => `${x},${y}`;
  const per = (x: number, y: number, w: number, h: number) => {
    const out: string[] = [];
    for (let dx = 0; dx < w; dx++) out.push(k(x + dx, y - 1), k(x + dx, y + h));
    for (let dy = 0; dy < h; dy++) out.push(k(x - 1, y + dy), k(x + w, y + dy));
    return out;
  };
  const th = problem.buildings.find(b => b.isTownhall);
  const pth = th && frame.placements.get(th.id);
  const coll = new Set<string>();
  const coda = th && pth ? per(pth.x, pth.y, th.w, th.h).filter(c => frame.roads.has(c)) : [];
  for (const c of coda) coll.add(c);
  while (coda.length) {
    const [x, y] = coda.pop()!.split(",").map(Number) as [number, number];
    for (const n of [k(x + 1, y), k(x - 1, y), k(x, y + 1), k(x, y - 1)]) if (frame.roads.has(n) && !coll.has(n)) { coll.add(n); coda.push(n); }
  }
  const out = new Set<string>();
  for (const [id, p] of frame.placements) {
    const b = byId.get(id);
    // (blocchi di catena: conta solo l'inizio, vedi toccaStradaZona)
    if (b && !b.isTownhall && b.roadLevel > 0 && !toccaStradaZona(b, p.x, p.y, (x, y) => coll.has(k(x, y)))) out.add(id);
  }
  return out;
}

/** Mappa di uno scenario (solo visualizzazione: le modifiche a mano si fanno
 *  nell'editor esterno, pulsante "✏ Modifica"). */
function MapCanvas({ frame, problem, byId, ge, pausa, evidenzia, stradeVuote, due }: { frame: PlannerFrame | null; problem: PlannerProblem; byId: Map<string, PlannerBuilding>; ge: ReadonlySet<string>; pausa?: boolean; evidenzia?: ReadonlySet<string>; stradeVuote?: readonly string[]; due?: readonly string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = (problem.maxX - problem.minX + 1) * CELL;
  const height = (problem.maxY - problem.minY + 1) * CELL;
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !Number.isFinite(width)) return;
    const px = (x: number) => (x - problem.minX) * CELL;
    const py = (y: number) => (y - problem.minY) * CELL;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#1e293b";
    for (const k of problem.cells) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      ctx.fillRect(px(x), py(y), CELL - 1, CELL - 1);
    }
    if (!frame) return;
    // strade tutte col colore della vista MAPPA (niente più giallo per le nuove)
    ctx.fillStyle = coloreEdificioMappa({ isStreet: true });
    for (const k of frame.roads) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      ctx.fillRect(px(x), py(y), CELL - 1, CELL - 1);
    }
    // strade a due corsie: un blocco 2×2 unico, più scuro
    if (due?.length) {
      ctx.fillStyle = "#4b3a28";
      for (const k of due) {
        const [x, y] = k.split(",").map(Number) as [number, number];
        if (!frame.roads.has(k)) continue;
        ctx.fillRect(px(x), py(y), 2 * CELL - 1, 2 * CELL - 1);
      }
    }
    for (const [id, p] of frame.placements) {
      const b = byId.get(id);
      if (!b) continue;
      // Palette della vista MAPPA (unica fonte: coloreEdificioMappa), senza la
      // zebra dei collegati senza bisogno.
      ctx.fillStyle = coloreEdificioMappa({ ...b, isGreatBuilding: ge.has(id) });
      ctx.fillRect(px(p.x) + 1, py(p.y) + 1, b.w * CELL - 3, b.h * CELL - 3);
      // aggiunto con "Modifica città": bordo bianco
      if (eNuovo(id)) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.strokeRect(px(p.x) + 2, py(p.y) + 2, b.w * CELL - 5, b.h * CELL - 5); }
    }
    if (evidenzia?.size) {
      // Edifici problematici, road_eff > 0 (bordo giallo tratteggiato).
      ctx.save();
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 2]);
      for (const id of evidenzia) {
        const p = frame.placements.get(id), b = byId.get(id);
        if (p && b) ctx.strokeRect(px(p.x) + 1, py(p.y) + 1, b.w * CELL - 3, b.h * CELL - 3);
      }
      ctx.restore();
    }
    if (stradeVuote?.length) {
      // Strade vuote, con un lato libero (bordo rosso tratteggiato).
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 2]);
      for (const k of stradeVuote) {
        const [x, y] = k.split(",").map(Number) as [number, number];
        ctx.strokeRect(px(x) + 0.5, py(y) + 0.5, CELL - 2, CELL - 2);
      }
      ctx.restore();
    }
    if (frame.probe) {
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 2;
      ctx.strokeRect(px(frame.probe.x), py(frame.probe.y), frame.probe.w * CELL - 1, frame.probe.h * CELL - 1);
    }
    if (pausa) {
      // In pausa: bordo rosso sugli edifici con strada non collegati.
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      for (const id of scollegati(frame, problem, byId)) {
        const p = frame.placements.get(id)!, b = byId.get(id)!;
        ctx.strokeRect(px(p.x) + 1, py(p.y) + 1, b.w * CELL - 3, b.h * CELL - 3);
      }
    }
  }, [frame, problem, byId, ge, width, height, pausa, evidenzia, stradeVuote, due]);
  return (
    <canvas ref={canvasRef} className="block h-auto w-full"
      width={Number.isFinite(width) ? width : 0} height={Number.isFinite(height) ? height : 0} />
  );
}

/** Città esterna importata da un JSON (export JSON del pannello MAPPA, vecchio
 *  o nuovo formato, o payload del bookmarklet), per provare il Planner sulle
 *  città che mandano gli utenti. Non viene salvata da nessuna parte. */
interface CittaEsterna extends CittaJson { nome: string }

export default function PlannerView({ cityMapBuildings: cittaProfilo, cityMapUnlockedCells: celleProfilo, candidati, uiLang }: Props) {
  const [esterna, setEsterna] = useState<CittaEsterna | null>(null);
  const [erroreImport, setErroreImport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Città vera (profilo o JSON esterno) e modifiche temporanee ("Modifica città"):
   *  il Planner lavora sulla città modificata. */
  const cittaVera: readonly CityMapBuilding[] = esterna?.buildings ?? cittaProfilo;
  const [modifiche, setModifiche] = useState<Modifiche>(NESSUNA_MODIFICA);
  const [pannelloModifica, setPannelloModifica] = useState(false);
  const cityMapBuildings = useMemo(() => applicaModifiche(cittaVera, modifiche), [cittaVera, modifiche]);
  /** Entità militari da collegare comunque alla strada con Alcatraz / Nave
   *  (interruttori nel riquadro informativo; di default nessuna). */
  const [militariCollegati, setMilitariCollegati] = useState<ReadonlySet<string>>(new Set());
  // Edifici a catena (catene.ts): ogni inizio con i suoi anelli diventa UN
  // blocco rettangolare che il Planner sposta intero; tutti gli anelli
  // collegati (regola dell'utente). `catene.blocchi` serve a riscomporre i
  // blocchi negli edifici originali (PNG).
  const catene = useMemo(() => {
    if (!esterna) return raggruppaCatene(buildPlannerProblem(cityMapBuildings, celleProfilo, militariCollegati));
    // L'export JSON non ha le posizioni delle strade, solo il loro numero.
    return raggruppaCatene({ ...buildPlannerProblem(cityMapBuildings, esterna.cells, militariCollegati), originalRoadCells: esterna.strade });
  }, [esterna, cityMapBuildings, celleProfilo, militariCollegati]);
  const militariTipi = useMemo(() => tipiMilitari(cityMapBuildings), [cityMapBuildings]);
  const problem = catene.problem;
  /** Scenario "Configurazione attuale" (richiesta dell'utente): strade ed
   *  edifici con strada (catene e militari scelti compresi) dove sono ora in
   *  città. Una catena entra solo se i suoi pezzi sono montati come il blocco
   *  del Planner (stessa distribuzione degli anelli), altrimenti la ripiazza la
   *  ricerca. null se la città non ha strade (es. export JSON senza strade). */
  const statoAttuale = useMemo((): { placements: Map<string, { x: number; y: number }>; roads: Set<string>; blocchi: string[] } | null => {
    const roads = new Set<string>(), blocchi: string[] = [];
    const pos = new Map<string, { x: number; y: number }>();
    for (const b of cityMapBuildings) {
      // (gli edifici aggiunti con "Modifica città" non hanno posizione: li piazza la ricerca)
      if (b.type !== "street") { if (!eNuovo(b.mapEntityId)) pos.set(b.mapEntityId, { x: b.x, y: b.y }); continue; }
      if (b.w === 2 && b.h === 2) blocchi.push(`${b.x},${b.y}`);
      for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) roads.add(`${b.x + i},${b.y + j}`);
    }
    if (!roads.size) return null;
    const placements = new Map<string, { x: number; y: number }>();
    for (const b of problem.buildings) {
      if ((!b.isTownhall && b.roadLevel <= 0) || eNuovo(b.id)) continue;
      const bl = catene.blocchi.get(b.id);
      if (!bl) { placements.set(b.id, { x: b.origX, y: b.origY }); continue; }
      const m0 = bl.membri[0]!, p0 = pos.get(m0.id);
      if (!p0) continue;
      const x0 = p0.x - m0.dx, y0 = p0.y - m0.dy;
      if (bl.membri.every(m => { const p = pos.get(m.id); return p && p.x - m.dx === x0 && p.y - m.dy === y0; })) placements.set(b.id, { x: x0, y: y0 });
    }
    return { placements, roads, blocchi };
  }, [cityMapBuildings, problem, catene]);
  const [frames, setFrames] = useState<Record<VName, PlannerFrame | null>>(tutte(null));
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  /** Blocchi 2×2 a due corsie (angolo in alto a sinistra) di ogni scenario: fissi per la corsa. */
  const dueRef = useRef<Record<VName, string[]>>(tutte([]));
  /** Ricerche per scenario (squadra di ricerca, vedi SEMI). */
  const semiRef = useRef(1);
  /** Potenza della CPU (MIN/MED/MAX, salvata nel browser) e pausa per fetta delle ricerche. */
  const [potenza, setPotenzaS] = useState<Potenza>(leggiPotenza);
  const potenzaRef = useRef<Potenza>(potenza);
  const riposoRef = useRef(0);
  /** Per scenario in ricerca: aggiunge aiutanti fino a semiRef (core liberati da uno scenario eliminato). */
  const rinforziRef = useRef<Partial<Record<VName, () => void>>>({});
  const finishRef = useRef(false); // "COMPLETA": chiude la ricerca degli edifici con strada (entrambe le mappe)
  const [searching, setSearching] = useState<Record<VName, boolean>>(tutte(false));
  /** Fase C (dopo COMPLETA): rifinitura continua degli edifici senza strada, fino a FERMA. */
  const stopFillRef = useRef(false);
  const [filling, setFilling] = useState<Record<VName, boolean>>(tutte(false));
  /** Scenari calcolati dal builder (undefined = non calcolati, null = città non adatta). */
  const [outcome, setOutcome] = useState<Scenario[] | null | undefined>(undefined);
  /** Scenari eliminati dall'utente (cestino): la loro corsa si ferma. */
  const [eliminati, setEliminati] = useState<Set<VName>>(new Set());
  const eliminatiRef = useRef<Set<VName>>(new Set());
  const [computing, setComputing] = useState(false);
  /** Ultimo avanzamento della ricerca per mappa (resta visibile anche dopo). */
  const [ricerca, setRicerca] = useState<Record<VName, NonNullable<PlannerFrame["search"]> | null>>(tutte(null));
  /** Ripiego quando il City Builder non si applica: una sola mappa col motore segnaposto. */
  const [soloFrame, setSoloFrame] = useState<PlannerFrame | null>(null);
  /** Pausa ("Ferma" → "Riprendi"): la ricerca attende e le mappe in pausa sono modificabili a mano. */
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [inPausa, setInPausa] = useState<Record<VName, boolean>>(tutte(false));
  const inPausaRef = useRef<Record<VName, boolean>>(tutte(false));
  inPausaRef.current = inPausa;
  /** Risolutori delle attese di ripresa, per mappa. */
  const resumeRef = useRef<Partial<Record<VName, (s: StatoManuale | null) => void>>>({});
  /** Mappe modificate a mano durante la pausa. */
  const modRef = useRef<Record<VName, boolean>>(tutte(false));
  /** "Annulla modifiche manuali" (richiesta dell'utente): ultimo fotogramma
   *  prodotto dall'ottimizzatore o dallo smussatore, per mappa; `smussato`
   *  dice se viene dallo smussatore (conta come modifica per la ripresa). */
  const autoRef = useRef<Record<VName, { f: PlannerFrame; smussato: boolean } | null>>(tutte(null));
  /** "Annulla completamento": stato di ogni mappa a COMPLETA e richiesta di annullamento (vedi completa()). */
  const primaRef = useRef<Record<VName, { f: PlannerFrame; valutate: number } | null>>(tutte(null));
  const annullaRef = useRef<Record<VName, boolean>>(tutte(false));
  /** Mappe con modifiche a mano dopo l'ultimo fotogramma automatico. */
  const [manuali, setManuali] = useState<Record<VName, boolean>>(tutte(false));
  const framesRef = useRef(frames);
  framesRef.current = frames;
  /** Generazione della corsa: i fotogrammi di una corsa annullata (Reset) vengono ignorati. */
  const genRef = useRef(0);
  // Città cambiata (re-import nello stesso profilo): si ferma la corsa in atto
  // e si riparte da zero, così non restano mappe o ricerche della città vecchia.
  const primoProblem = useRef(true);
  useEffect(() => {
    setOutcome(undefined);
    if (primoProblem.current) { primoProblem.current = false; return; }
    stopRef.current = true;
    genRef.current++;
    pausedRef.current = false;
    setPaused(false);
    for (const r of Object.values(resumeRef.current)) r?.(null);
    resumeRef.current = {};
    setCompletando(false);
    setSearching(tutte(false));
    setFilling(tutte(false));
    setInPausa(tutte(false));
    framesRef.current = tutte(null);
    setFrames(tutte(null)); setSoloFrame(null); setRicerca(tutte(null));
    autoRef.current = tutte(null); setManuali(tutte(false));
    primaRef.current = tutte(null); annullaRef.current = tutte(false);
  }, [problem]);
  useEffect(() => () => { stopRef.current = true; for (const r of Object.values(resumeRef.current)) r?.(null); }, []);

  const byId = useMemo(() => new Map(problem.buildings.map(b => [b.id, b])), [problem]);
  /** Edifici militari della città (senza strada se c'è Alcatraz / Nave da guerra stellare). */
  const militari = useMemo(() => problem.buildings.filter(b => b.isMilitary).length, [problem]);
  /** Avviso militari chiuso con la X: solo stato del componente (NON salvato),
   *  quindi ricompare a ogni apertura del Planner e a ogni cambio di città. */
  const [avvisoMilitariChiuso, setAvvisoMilitariChiuso] = useState(false);
  /** Edifici dei vecchi set a bonus di adiacenza (non gestiti: solo avviso). */
  const edificiSet = useMemo(() => problem.buildings.filter(b => SET_DI_EDIFICI.has(b.entityId)), [problem]);
  const [avvisoSetChiuso, setAvvisoSetChiuso] = useState(false);
  const [videoAperto, setVideoAperto] = useState(false);
  // (non a ogni interruttore dei militari: il riquadro resta aperto mentre si sceglie)
  useEffect(() => { setAvvisoMilitariChiuso(false); setAvvisoSetChiuso(false); }, [cityMapBuildings]);
  /** Grandi Edifici (colorati in rosso come nella mappa). */
  const grandiEdifici = useMemo(() => new Set(cityMapBuildings.filter(b => b.isGreatBuilding).map(b => b.mapEntityId)), [cityMapBuildings]);
  const importaJson = async (file: File) => {
    try {
      setEsterna({ nome: file.name.replace(/\.json$/i, ""), ...leggiCittaJson(await file.text()) });
      setErroreImport(null);
    } catch (err) {
      setErroreImport(t("plannerInvalidJson", uiLang, err instanceof Error ? err.message : String(err)));
    }
  };

  /** Riprende tutte le mappe in pausa, passando le disposizioni modificate a mano. */
  const riprendi = () => {
    pausedRef.current = false;
    setPaused(false);
    for (const v of VARIANTI) {
      const res = resumeRef.current[v];
      if (!res) continue;
      delete resumeRef.current[v];
      const f = framesRef.current[v];
      if (modRef.current[v] && f?.due) dueRef.current = { ...dueRef.current, [v]: [...f.due] };
      res(modRef.current[v] && f ? { placements: f.placements, roads: f.roads, ...(f.due ? { blocchi: f.due } : {}) } : null);
      modRef.current[v] = false;
    }
    setManuali(tutte(false));
  };
  /** Ripristina, sulle mappe modificate a mano, l'ultimo stato trovato
   *  dall'ottimizzatore o dallo smussatore. */
  const annullaManuali = () => {
    for (const v of VARIANTI) {
      const a = autoRef.current[v];
      if (!manuali[v] || !a) continue;
      framesRef.current = { ...framesRef.current, [v]: a.f };
      setFrames(prev => ({ ...prev, [v]: a.f }));
      if (a.f.due) dueRef.current = { ...dueRef.current, [v]: [...a.f.due] };
      modRef.current[v] = a.smussato;
    }
    setManuali(tutte(false));
  };
  const pausa = () => { pausedRef.current = true; setPaused(true); };

  /** "Smussa i bordi" (idea dell'utente, solo in pausa): sulle mappe in pausa
   *  si spostano/scambiano gli edifici con strada per ridurre gli angoli di 90°
   *  del contorno, finché l'utente non lo ferma. Il risultato conta come
   *  modifica a mano: Riprendi o COMPLETA ripartono da lì. */
  const [smussando, setSmussando] = useState(false);
  /** Fase 3 avviata (COMPLETA premuto): il suo pulsante diventa Pausa/Riprendi. */
  const [completando, setCompletando] = useState(false);
  const stopSmussaRef = useRef(false);
  const smussa = async () => {
    stopSmussaRef.current = false;
    setSmussando(true);
    const gen = genRef.current;
    // Tutte le mappe ancora in ricerca devono essere ferme in pausa (ognuna ci
    // arriva al suo passo successivo): si aspetta fino a 3 s, così nessuna
    // resta esclusa e nessuna sovrascrive la mappa che si sta smussando.
    const inRicerca = visibili.filter(sc => searching[sc.id]);
    for (let t = 0; t < 60 && inRicerca.some(sc => !inPausaRef.current[sc.id]); t++) await sleep(50);
    await Promise.all(visibili.filter(sc => inPausaRef.current[sc.id] && framesRef.current[sc.id]).map(async sc => {
      const f0 = framesRef.current[sc.id]!;
      await smussaBordi(problem, f0, {
        fissi: new Set(sc.v?.fissi ?? []),
        shouldStop: () => stopSmussaRef.current || stopRef.current || gen !== genRef.current || eliminatiRef.current.has(sc.id),
        onFrame: f => {
          if (gen !== genRef.current) return;
          const nf: PlannerFrame = { ...f, lastPath: f0.lastPath, done: false };
          framesRef.current = { ...framesRef.current, [sc.id]: nf };
          setFrames(prev => ({ ...prev, [sc.id]: nf }));
          modRef.current[sc.id] = true;
          autoRef.current[sc.id] = { f: nf, smussato: true };
          setManuali(m => (m[sc.id] ? { ...m, [sc.id]: false } : m));
        },
      });
    }));
    setSmussando(false);
  };

  /** "Sposta l'intera città" (richiesta dell'utente, solo in pausa): edifici,
   *  municipio e strade traslati in blocco di (dx, dy); conta come modifica a
   *  mano. Null se qualche cella uscirebbe dall'area sbloccata. */
  const traslato = (f: PlannerFrame, dx: number, dy: number): PlannerFrame | null => {
    const sp = (k: string) => { const i = k.indexOf(","); return `${Number(k.slice(0, i)) + dx},${Number(k.slice(i + 1)) + dy}`; };
    const pl = new Map<string, { x: number; y: number }>();
    for (const [id, p] of f.placements) {
      const b = byId.get(id);
      if (!b) continue;
      for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) if (!problem.cells.has(`${p.x + dx + i},${p.y + dy + j}`)) return null;
      pl.set(id, { x: p.x + dx, y: p.y + dy });
    }
    const rd = new Set<string>();
    for (const k of f.roads) { const n = sp(k); if (!problem.cells.has(n)) return null; rd.add(n); }
    const due = f.due?.map(sp); // blocchi a due corsie traslati
    return { ...f, placements: pl, roads: rd, lastPath: f.lastPath.map(sp), probe: null, ...(due ? { due } : {}) };
  };
  /** Città specchiata (richiesta dell'utente, solo in pausa): ribaltata in
   *  orizzontale ("h") o in verticale ("v") attorno al rettangolo che
   *  contiene edifici e strade; i contatti fra edifici e strade restano
   *  gli stessi. Null se qualche cella uscirebbe dall'area sbloccata. */
  /** Specchio vietato dalle catene: il blocco si sposta rigido (gli anelli
   *  restano dal lato giusto, il gioco non li accetta specchiati), ma la sua
   *  zona di strada (l'inizio) finirebbe dal lato opposto della strada
   *  specchiata e la catena resterebbe scollegata. Vietato sull'asse in cui
   *  l'inizio non è centrato nel blocco: catene orizzontali → specchio
   *  orizzontale, verticali → verticale, entrambe → entrambi. */
  const specchioCatene = useMemo(() => {
    const no = { h: false, v: false };
    for (const b of problem.buildings) {
      const z = b.zonaStrada;
      if (!z || b.roadLevel <= 0) continue;
      if (z.x !== b.w - z.x - z.w) no.h = true;
      if (z.y !== b.h - z.y - z.h) no.v = true;
    }
    return no;
  }, [problem]);
  const specchiato = (f: PlannerFrame, asse: "h" | "v"): PlannerFrame | null => {
    if (specchioCatene[asse]) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [id, p] of f.placements) { const b = byId.get(id); if (!b) continue; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + b.w - 1); y1 = Math.max(y1, p.y + b.h - 1); }
    for (const k of f.roads) { const i = k.indexOf(","), x = Number(k.slice(0, i)), y = Number(k.slice(i + 1)); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x0 > x1) return null;
    const mx = (x: number, w: number) => (asse === "h" ? x0 + x1 - x - w + 1 : x), my = (y: number, h: number) => (asse === "v" ? y0 + y1 - y - h + 1 : y);
    const sp = (k: string) => { const i = k.indexOf(","); return `${mx(Number(k.slice(0, i)), 1)},${my(Number(k.slice(i + 1)), 1)}`; };
    const pl = new Map<string, { x: number; y: number }>();
    for (const [id, p] of f.placements) {
      const b = byId.get(id);
      if (!b) continue;
      const q = { x: mx(p.x, b.w), y: my(p.y, b.h) };
      for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) if (!problem.cells.has(`${q.x + i},${q.y + j}`)) return null;
      pl.set(id, q);
    }
    const rd = new Set<string>();
    for (const k of f.roads) { const n = sp(k); if (!problem.cells.has(n)) return null; rd.add(n); }
    // blocchi a due corsie: angolo in alto a sinistra del 2×2 specchiato
    const due = f.due?.map(k => { const i = k.indexOf(","); return `${mx(Number(k.slice(0, i)), 2)},${my(Number(k.slice(i + 1)), 2)}`; });
    return { ...f, placements: pl, roads: rd, lastPath: f.lastPath.map(sp), probe: null, ...(due ? { due } : {}) };
  };
  const applicaManuale = (v: VName, nf: PlannerFrame | null) => {
    if (!nf) return;
    framesRef.current = { ...framesRef.current, [v]: nf };
    setFrames(prev => ({ ...prev, [v]: nf }));
    modRef.current[v] = true;
    setManuali(m => (m[v] ? m : { ...m, [v]: true }));
  };
  const spostaTutto = (v: VName, dx: number, dy: number) => {
    const f = framesRef.current[v];
    const nf = f && traslato(f, dx, dy);
    if (!nf) return;
    framesRef.current = { ...framesRef.current, [v]: nf };
    setFrames(prev => ({ ...prev, [v]: nf }));
    modRef.current[v] = true;
    setManuali(m => (m[v] ? m : { ...m, [v]: true }));
  };
  /** "Annulla completamento" (richiesta dell'utente): disposizione e
   *  disposizioni valutate di ogni mappa quando si è premuto COMPLETA; con
   *  `annullaRef` la corsa in completamento si ferma e ne riparte una che
   *  riprende la ricerca (in pausa) da quella disposizione. */
  const completa = () => {
    for (const sc of visibili) {
      const f = framesRef.current[sc.id];
      primaRef.current[sc.id] = f && searching[sc.id] ? { f, valutate: ricerca[sc.id]?.valutate ?? 0 } : null;
    }
    finishRef.current = true;
    setCompletando(true);
    riprendi();
  };
  const annullaCompletamento = () => {
    for (const sc of visibili) if (primaRef.current[sc.id]) annullaRef.current[sc.id] = true;
    finishRef.current = false;
    setCompletando(false);
    pausedRef.current = true;
    setPaused(true);
    // le corse ferme in pausa nel completamento ripartono e vedono l'annullamento
    for (const v of VARIANTI) {
      const res = resumeRef.current[v];
      if (res && annullaRef.current[v]) { delete resumeRef.current[v]; res(null); }
    }
  };
  /** Anima le tappe del builder per una variante, poi completamento + ricerca. */
  const eseguiVariante = async (sc: Scenario) => {
    const { id } = sc;
    let v = sc.v;
    const fermato = () => stopRef.current || eliminatiRef.current.has(id);
    const gen = genRef.current;
    const setF = (f0: PlannerFrame) => {
      if (gen !== genRef.current || annullaRef.current[id]) return;
      const f: PlannerFrame = f0.due ? f0 : { ...f0, due: dueRef.current[id] };
      framesRef.current = { ...framesRef.current, [id]: f };
      setFrames(prev => ({ ...prev, [id]: f }));
      autoRef.current[id] = { f, smussato: false };
      setManuali(m => (m[id] ? { ...m, [id]: false } : m));
      if (f.search) setRicerca(prev => ({ ...prev, [id]: f.search! }));
    };
    const opzioni = {
      delayMs, onFrame: setF, shouldStop: () => fermato() || annullaRef.current[id],
      riposo: () => riposoRef.current,
      shouldFinishSearch: () => finishRef.current,
      onSearchActive: (a: boolean) => setSearching(s => ({ ...s, [id]: a })),
      shouldStopFill: () => stopFillRef.current,
      onFillActive: (a: boolean) => setFilling(s => ({ ...s, [id]: a })),
      isPaused: () => pausedRef.current,
      waitResume: () => new Promise<StatoManuale | null>(res => {
        // ripresa già avvenuta, oppure "Annulla completamento": quel pulsante mette
        // in pausa, e un riempimento che arriva ora alla pausa restava fermo per
        // sempre (la corsa non finiva, non ripartiva la ricerca: completati ancora
        // visibili e Smussa spento — segnalazione dell'utente)
        if (fermato() || !pausedRef.current || annullaRef.current[id]) { res(null); return; }
        resumeRef.current[id] = res;
      }),
      onPaused: (p: boolean) => { inPausaRef.current = { ...inPausaRef.current, [id]: p }; setInPausa(s => ({ ...s, [id]: p })); },
    };
    /** Ricerca + completamento; se il completamento viene annullato si
     *  riparte (ricerca in pausa) dalla disposizione di prima di COMPLETA. */
    const corri = async (args: Pick<CompletionOptions, "initial" | "geometry" | "fissi" | "girandola" | "stradeFisse">, partenza?: StatoManuale) => {
      let riprendiDa: { stato: StatoManuale; valutate: number } | undefined = partenza ? { stato: partenza, valutate: 0 } : undefined;
      for (;;) {
        // ── Squadra di ricerca (vedi SEMI): aiutanti con altri semi, solo
        // ricerca. Si fermano a COMPLETA, a Ferma (pausa) e a fine corsa; alla
        // ripresa ripartono dalla disposizione della principale (con le
        // eventuali modifiche a mano). La principale adotta la migliore.
        let principale: PlannerFrame | null = null;
        const aiuti: Array<{ f: PlannerFrame | null; inviato: PlannerFrame | null; i: number; vivo: boolean }> = [];
        let corsa = 0, chiusa = false, passate = 0;
        const basta = () => chiusa || fermato() || annullaRef.current[id] || finishRef.current || gen !== genRef.current;
        const avviaAiutante = (i: number, g: number, da?: StatoManuale) => {
          const a: (typeof aiuti)[number] = { f: null, inviato: null, i, vivo: true };
          aiuti.push(a);
          runCompletionParallela(problem, {
            ...args, delayMs: 0, soloRicerca: true, seme: seme(i),
            onFrame: f => { if (g === corsa) a.f = f; },
            // (potenza abbassata: le aiutanti oltre il numero ammesso si fermano)
            shouldStop: () => basta() || pausedRef.current || g !== corsa || i >= semiRef.current,
            riposo: () => riposoRef.current,
            ...(da ? { riprendiDa: { stato: da, valutate: 0 } } : {}),
          }).catch(() => {}).finally(() => { a.vivo = false; }); // un aiutante che fallisce non ferma lo scenario
        };
        const lanciaAiuti = (da?: StatoManuale) => {
          const g = ++corsa;
          for (const a of aiuti) passate += a.f?.search?.valutate ?? 0; // disposizioni delle corse precedenti
          aiuti.length = 0;
          for (let i = 1; i < semiRef.current; i++) avviaAiutante(i, g, da);
        };
        // core liberati (scenario eliminato, potenza alzata): altre aiutanti dalla disposizione attuale
        rinforziRef.current[id] = () => {
          if (basta() || pausedRef.current) return;
          const f = principale, da = f ? { placements: f.placements, roads: f.roads, ...(f.due ? { blocchi: f.due } : {}) } : undefined;
          for (let i = 1; i < semiRef.current; i++) if (!aiuti.some(a => a.vivo && a.i === i)) avviaAiutante(i, corsa, da);
        };
        /** Voto di una disposizione mostrata: fuori → deficit → strade → buchi. */
        const voto = (f: PlannerFrame) => [f.search?.esclusi ?? 99, f.search?.deficit ?? 0, f.roads.size, f.search?.buchi ?? 0];
        const meglio = (a: PlannerFrame, b: PlannerFrame) => {
          const [x, y] = [voto(a), voto(b)];
          for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! < y[i]!;
          return false;
        };
        const adotta = (): StatoManuale | null => {
          if (!principale?.search || basta() || pausedRef.current) return null;
          let mig: (typeof aiuti)[number] | null = null;
          for (const a of aiuti) {
            const f = a.f;
            if (!f?.search || f === a.inviato || (f.search.scollegate ?? 0) > 0) continue;
            if (meglio(f, mig?.f ?? principale)) mig = a;
          }
          if (!mig?.f) return null;
          mig.inviato = mig.f;
          // (con i blocchi a due corsie dell'aiutante: può averli spostati; senza,
          // la principale teneva i suoi e il 2×2 si vedeva come 4 strade semplici)
          return { placements: mig.f.placements, roads: mig.f.roads, ...(mig.f.due ? { blocchi: mig.f.due } : {}) };
        };
        const somma = (f: PlannerFrame): PlannerFrame => {
          principale = f;
          if (!f.search || !aiuti.length) return f;
          // disposizioni provate da tutta la squadra
          let n = f.search.valutate + passate;
          for (const a of aiuti) n += a.f?.search?.valutate ?? 0;
          return { ...f, search: { ...f.search, valutate: n } };
        };
        if (semiRef.current > 1) lanciaAiuti(riprendiDa?.stato);
        try {
          // in un Web Worker (parallelo.ts): ogni ricerca su un core suo
          await runCompletionParallela(problem, {
            ...opzioni, ...args, ...(riprendiDa ? { riprendiDa } : {}),
            onFrame: f => setF(somma(f)),
            adotta,
            waitResume: () => opzioni.waitResume().then(s => {
              const f = principale;
              if (!basta() && semiRef.current > 1) lanciaAiuti(s ?? (f ? { placements: f.placements, roads: f.roads, ...(f.due ? { blocchi: f.due } : {}) } : undefined));
              return s;
            }),
          });
        } finally {
          chiusa = true;
          delete rinforziRef.current[id];
        }
        const prima = primaRef.current[id];
        if (!annullaRef.current[id] || !prima || fermato() || gen !== genRef.current) break;
        annullaRef.current[id] = false;
        primaRef.current[id] = null;
        modRef.current[id] = false;
        setFilling(s => ({ ...s, [id]: false }));
        setF({ ...prima.f, done: false });
        riprendiDa = { stato: { placements: prima.f.placements, roads: prima.f.roads, ...(prima.f.due ? { blocchi: prima.f.due } : {}) }, valutate: prima.valutate };
      }
      annullaRef.current[id] = false;
    };
    /** Partenze alternative (margine dal bordo, nuclei a due corsie): breve
     *  ricerca su ognuna, in parallelo nei worker, e si tiene la migliore:
     *  meno edifici con strada fuori, poi meno deficit di spazio, poi meno
     *  strade (a parità la prima). */
    const scegliPartenza = async (cand: Array<Pick<CompletionOptions, "initial" | "geometry" | "fissi" | "girandola" | "stradeFisse">>): Promise<number> => {
      if (cand.length < 2) return 0;
      const ris = await Promise.all(cand.map(c => runCompletionParallela(problem, {
        ...c, delayMs: 0, onFrame: () => {}, shouldStop: fermato, limiteValutate: VALUTATE_SCELTA_MARGINE, soloRicerca: true, riposo: () => riposoRef.current,
      })));
      const voto = (f: PlannerFrame) => [f.search?.esclusi ?? 99, f.search?.deficit ?? 0, f.roads.size];
      let mig = 0;
      ris.forEach((f, i) => { const [a, b] = [voto(f), voto(ris[mig]!)]; if ((a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!) < 0) mig = i; });
      return mig;
    };
    const conNucleo = (n: Nucleo | undefined) => {
      dueRef.current = { ...dueRef.current, [id]: n ? n.blocchi : [] };
    };
    if (sc.attuale) {
      // Configurazione attuale: la città com'è è la base (anche della ricerca
      // parametrica) e la disposizione da cui riparte la ricerca locale, come
      // dopo una modifica nell'editor. Verticale "fuori mappa" (stradaVX a
      // sinistra di tutto): nessun edificio è nella parte ovest intoccabile.
      const st = statoAttuale;
      const th = problem.buildings.find(b => b.isTownhall);
      if (!st || !th) return;
      dueRef.current = { ...dueRef.current, [id]: st.blocchi };
      setF({ placements: new Map(st.placements), roads: new Set(st.roads), probe: null, lastPath: [], placed: st.placements.size, unplaced: [], iterations: 0, done: false, label: t("plannerScenarioCurrent", uiLang) });
      const due = problem.buildings.filter(b => richiedeDueCorsie(b) && st.placements.has(b.id)).map(b => b.id);
      await corri({
        initial: { placements: st.placements, roads: st.roads },
        geometry: { stradaVX: problem.minX - 1, eastMidY: th.origY + Math.floor(th.h / 2) },
        fissi: due, ...(st.blocchi.length ? { stradeFisse: celleBlocchi(st.blocchi) } : {}),
      }, st);
      setSearching(s => ({ ...s, [id]: false }));
      return;
    }
    if (!v) {
      // Girandola: scelta della posizione del municipio (brevi ricerche), poi
      // ricerca e completamento come gli altri scenari.
      const vuoto = (label: string): PlannerFrame => ({ placements: new Map(), roads: new Set(), probe: null, lastPath: [], placed: 0, unplaced: [], iterations: 0, done: false, label });
      // Prima girandola: municipio al centro, parte subito. Seconda: la
      // posizione migliore delle prove brevi (diversa dal centro).
      let base: BaseGirandola | null | undefined;
      if (sc.gir !== 1) base = baseCentrale(problem);
      else {
        setF(vuoto("Girandola 2: scelta della posizione del municipio…"));
        // Le prove si vedono subito (municipio, bracci e la loro breve ricerca),
        // senza le statistiche della ricerca (ripartono a ogni posizione).
        let fase = "Girandola 2: scelta della posizione del municipio…";
        const centro = baseCentrale(problem);
        const scelte = await scegliGirandolaParallela(problem, {
          shouldStop: fermato,
          onProgress: (i, n) => { fase = `Girandola 2: prova della posizione del municipio ${i + 1}/${n}`; },
          onFrame: f => setF({ ...f, search: undefined, done: false, label: fase }),
        });
        base = scelte.find(b => !centro || b.tx !== centro.tx || b.ty !== centro.ty || b.specchio !== centro.specchio);
      }
      if (!base || fermato()) return;
      // Strade a due corsie: nuclei candidati attorno al municipio (dueCorsie.ts)
      const nuclei = nucleiDueCorsie(problem, base, []);
      const opz = (n?: Nucleo) => ({
        initial: n ? { placements: n.placements, roads: n.roads } : { placements: base.placements, roads: base.roads },
        geometry: base.geometry, fissi: n ? n.fissi : [], girandola: { bracci: base.bracci },
        ...(n ? { stradeFisse: celleBlocchi(n.blocchi) } : {}),
      });
      let nucleo: Nucleo | undefined;
      if (nuclei.length) {
        setF({ placements: base.placements, roads: base.roads, probe: null, lastPath: [], placed: base.placements.size, unplaced: [], iterations: 0, done: false, label: "Scelta delle strade a due corsie…" });
        nucleo = nuclei[await scegliPartenza(nuclei.map(n => opz(n)))];
        if (fermato()) return;
      }
      conNucleo(nucleo);
      await corri(opz(nucleo));
      setSearching(s => ({ ...s, [id]: false }));
      return;
    }
    // Partenze candidate: con o senza margine vietato dal bordo (sc.alt) e,
    // se la città ha edifici a due corsie, i nuclei di ognuna (dueCorsie.ts).
    const fine = (b: BuilderVariant) => b.stages[b.stages.length - 1]!;
    const candidati: Array<{ b: BuilderVariant; n?: Nucleo }> = [];
    for (const b of sc.alt ? [v, sc.alt] : [v]) {
      const nuclei = nucleiDueCorsie(problem, fine(b), b.fissi, 3, b.geometry);
      if (nuclei.length) for (const n of nuclei) candidati.push({ b, n }); else candidati.push({ b });
    }
    const opzB = (c: { b: BuilderVariant; n?: Nucleo }) => ({
      initial: c.n ? { placements: c.n.placements, roads: c.n.roads } : { placements: fine(c.b).placements, roads: fine(c.b).roads },
      geometry: c.b.geometry, fissi: c.n ? c.n.fissi : c.b.fissi,
      ...(c.n ? { stradeFisse: celleBlocchi(c.n.blocchi) } : {}),
    });
    let scelto = candidati[0]!;
    if (candidati.length > 1) {
      setF({ ...fine(v), probe: null, lastPath: [], placed: fine(v).placements.size, unplaced: [], iterations: 0, done: false,
        label: "Scelta della partenza (margine dal bordo, strade a due corsie)…" });
      scelto = candidati[await scegliPartenza(candidati.map(opzB))]!;
      if (fermato()) return;
      v = scelto.b;
    }
    conNucleo(scelto.n);
    let prev: BuilderVariant["stages"][number] | null = null;
    for (const [i, s] of v.stages.entries()) {
      if (fermato()) return;
      const nuovi = [...s.placements.keys()].filter(id => !prev?.placements.has(id));
      const nb = nuovi.length === 1 ? byId.get(nuovi[0]!) : undefined;
      const np = nb ? s.placements.get(nb.id)! : null;
      setF({
        placements: s.placements, roads: s.roads,
        probe: nb && np ? { x: np.x, y: np.y, w: nb.w, h: nb.h } : null,
        lastPath: [...s.roads].filter(r => !prev?.roads.has(r)),
        placed: s.placements.size, unplaced: [], iterations: i, done: false, label: s.label,
      });
      prev = s;
      await sleep(0);
    }
    if (!prev || fermato()) return;
    if (scelto.n) {
      setF({ placements: scelto.n.placements, roads: scelto.n.roads, probe: null, lastPath: celleBlocchi(scelto.n.blocchi), placed: scelto.n.placements.size, unplaced: [], iterations: v.stages.length, done: false, label: "Strade a due corsie" });
      await sleep(0);
    }
    const o = opzB(scelto);
    await corri({ ...o, initial: { placements: new Map(o.initial.placements), roads: new Set(o.initial.roads) } });
    setSearching(s => ({ ...s, [id]: false }));
  };

  const start = async () => {
    genRef.current++;
    stopRef.current = false;
    finishRef.current = false;
    setCompletando(false);
    stopFillRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setRicerca(tutte(null));
    autoRef.current = tutte(null); setManuali(tutte(false));
    primaRef.current = tutte(null); annullaRef.current = tutte(false);
    setRunning(true);
    let out = outcome;
    if (out === undefined) {
      setComputing(true);
      await sleep(30); // lascia disegnare "calcolo in corso" (il builder è sincrono)
      const os = runBuilder(problem);
      // stessa costruzione senza le distanze dal bordo vietate (Passo 7): se la
      // partenza cambia, all'avvio dello scenario si sceglie la migliore
      const osL = os ? runBuilder(problem, { margineLibero: true }) : null;
      const firma = (b: BuilderVariant) => { const f = b.stages[b.stages.length - 1]!; return JSON.stringify([[...f.placements].sort((p, q) => (p[0] < q[0] ? -1 : 1)), [...f.roads].sort()]); };
      const lista: Scenario[] = (os?.variants ?? []).map(v => {
        const alt = osL?.variants.find(t => t.name === v.name);
        return { id: v.name, v, raccordo: v.name === "r3" ? 3 : v.name === "r4" ? 4 : 5, ...(alt && firma(alt) !== firma(v) ? { alt } : {}) };
      });
      // Scenario "Girandola" (municipio con quattro bracci), sempre in più.
      // Due girandole (richiesta dell'utente), ognuna con la sua ricerca
      // lunga: municipio al centro; municipio nella posizione migliore delle
      // prove brevi.
      if (problem.buildings.some(b => b.isTownhall)) lista.push({ id: "gir", v: null, raccordo: 0, gir: 0 }, { id: "gir2", v: null, raccordo: 0, gir: 1 });
      if (statoAttuale && problem.buildings.some(b => b.isTownhall)) lista.push({ id: "att", v: null, raccordo: 0, attuale: true });
      out = lista.length ? lista : null;
      setOutcome(out);
      setComputing(false);
    }
    eliminatiRef.current = new Set();
    setEliminati(new Set());
    dueRef.current = tutte([]);
    if (out) {
      const c = carico(out.length, potenzaRef.current);
      semiRef.current = c.semi; riposoRef.current = c.riposo;
      // Tutti gli scenari procedono in parallelo (si alternano a ogni pausa).
      await Promise.all(out.map(sc => eseguiVariante(sc)));
    } else if (!stopRef.current) {
      await runPlaceholderPlanner(problem, { delayMs, onFrame: setSoloFrame, shouldStop: () => stopRef.current });
    }
    setRunning(false);
  };
  /** Reset: interrompe anche una corsa in pausa. */
  const reset = () => {
    setCompletando(false);
    stopSmussaRef.current = true;
    stopRef.current = true;
    genRef.current++;
    riprendi();
    setSearching(tutte(false));
    setFilling(tutte(false));
    setInPausa(tutte(false));
    framesRef.current = tutte(null);
    setFrames(tutte(null)); setSoloFrame(null); setRicerca(tutte(null));
    autoRef.current = tutte(null); setManuali(tutte(false));
    primaRef.current = tutte(null); annullaRef.current = tutte(false);
    // come alla prima apertura: niente riquadri degli scenari (si ricalcolano a
    // Ottimizza) e scenari eliminati di nuovo disponibili
    setOutcome(undefined); setComputing(false);
    eliminatiRef.current = new Set(); setEliminati(new Set());
    dueRef.current = tutte([]);
    // avvisi (set non gestiti, militari) di nuovo visibili
    setAvvisoSetChiuso(false); setAvvisoMilitariChiuso(false);
    // città vera: via le modifiche temporanee ("Modifica città")
    setModifiche(NESSUNA_MODIFICA); setPannelloModifica(false);
  };
  /** Scenari visibili (calcolati e non eliminati). */
  const visibili = (outcome ?? []).filter(sc => !eliminati.has(sc.id));
  const anySearching = visibili.some(sc => searching[sc.id]);
  const anyFilling = visibili.some(sc => filling[sc.id]);
  /** Cestino: ferma ed elimina uno scenario (resta almeno uno). */
  /** Potenza della CPU: ricalcola ricerche e pause; si applica subito alla corsa in atto. */
  const setPotenza = (p: Potenza) => {
    setPotenzaS(p);
    potenzaRef.current = p;
    try { localStorage.setItem(CHIAVE_POTENZA, p); } catch { /* storage non disponibile */ }
    const attivi = (outcome ?? []).filter(sc => !eliminatiRef.current.has(sc.id)).length;
    if (!attivi) return;
    const c = carico(attivi, p);
    semiRef.current = c.semi; riposoRef.current = c.riposo;
    for (const f of Object.values(rinforziRef.current)) f?.();
  };
  const elimina = (id: VName) => {
    eliminatiRef.current = new Set([...eliminatiRef.current, id]);
    setEliminati(new Set(eliminatiRef.current));
    const res = resumeRef.current[id];
    if (res) { delete resumeRef.current[id]; res(null); }
    setSearching(s => ({ ...s, [id]: false }));
    setFilling(s => ({ ...s, [id]: false }));
    setInPausa(s => ({ ...s, [id]: false }));
    // i core dello scenario eliminato passano agli altri ancora in ricerca
    const restano = (outcome ?? []).filter(sc => !eliminatiRef.current.has(sc.id)).length;
    if (restano > 0) {
      const c = carico(restano, potenzaRef.current);
      semiRef.current = c.semi; riposoRef.current = c.riposo;
      for (const f of Object.values(rinforziRef.current)) f?.();
    }
  };

  /** Riga di stato di una mappa: edifici CON STRADA piazzati (verde = tutti,
   *  rosso = ne mancano), strade attuali/della città di partenza (verde = meno della città di partenza, rosso = di più)
   *  e disposizioni provate dalla ricerca. */
  const conStrada = useMemo(() => problem.buildings.filter(b => !b.isTownhall && b.roadLevel > 0), [problem]);
  const senzaStrada = useMemo(() => problem.buildings.filter(b => !b.isTownhall && b.roadLevel === 0), [problem]);
  const stats = (f: PlannerFrame | null, valutate?: number) => {
    if (!f) return null;
    const piazzati = conStrada.filter(b => f.placements.has(b.id)).length;
    const piazzatiSenza = senzaStrada.filter(b => f.placements.has(b.id)).length;
    return (
    <span className="text-slate-400">
      {t("plannerStatsPlaced", uiLang)} <b className={piazzati >= conStrada.length ? "text-emerald-400" : "text-red-400"}>{piazzati}/{conStrada.length}</b>
      {" · "}{t("plannerStatsNoRoad", uiLang)} <b className={piazzatiSenza >= senzaStrada.length ? "text-emerald-400" : "text-red-400"}>{piazzatiSenza}/{senzaStrada.length}</b>
      {" · "}{t("plannerStatsRoads", uiLang)} <b className={f.roads.size < problem.originalRoadCells ? "text-emerald-400" : f.roads.size > problem.originalRoadCells ? "text-red-400" : "text-slate-100"}>{f.roads.size}/{problem.originalRoadCells}</b>
      {" · "}<span title={t("plannerStatsCornersTitle", uiLang)}>{t("plannerStatsCorners", uiLang)} <b className="text-slate-100">{contaAngoli(problem, f.placements, f.roads)}</b></span>
      {valutate !== undefined && <>{" · "}{valutate.toLocaleString(uiLang === "en" ? "en-US" : "it-IT")} {t("plannerStatsLayouts", uiLang)}</>}
    </span>
    );
  };

  /** Edifici (catene riscomposte) e strade di una soluzione, come cityMapBuildings. */
  const edificiFrame = (f: PlannerFrame, n?: VName): CityMapBuilding[] => {
    const edifici: CityMapBuilding[] = [];
    const posizioni = espandiCatene(f.placements, catene.blocchi);
    for (const b of cityMapBuildings) {
      if (b.type === "street") continue;
      const p = posizioni.get(b.mapEntityId);
      if (p) edifici.push({ ...b, x: p.x, y: p.y });
    }
    // strade a due corsie: un blocco 2×2 (tipo di strada 2×2 della città) per
    // ogni blocco del nucleo; tutte le altre strade a una corsia (tipo 1×1)
    const s1 = cityMapBuildings.find(b => b.type === "street" && b.w === 1 && b.h === 1);
    // (se la città non ha ancora strade a due corsie piazzate: la Strada asfaltata del gioco)
    const s2 = cityMapBuildings.find(b => b.type === "street" && b.w === 2 && b.h === 2)
      ?? { entityId: STRADA_2X2_DEFAULT, name: t("plannerTwoLaneRoad", uiLang) };
    const blocchi = (f.due ?? (n ? dueRef.current[n] : [])).filter(k => celleBlocchi([k]).every(c => f.roads.has(c)));
    const in2 = new Set(celleBlocchi(blocchi));
    for (const k of blocchi) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      edifici.push({
        entityId: s2.entityId, mapEntityId: `planner-road2-${k}`, name: s2.name, x, y, w: 2, h: 2, type: "street",
        isGreatBuilding: false, isMilitary: false, isNeedlessRoad: false, isInactive: false, isSuppliesProducer: false, roadLevel: 0,
      });
    }
    for (const k of f.roads) {
      if (in2.has(k)) continue;
      const [x, y] = k.split(",").map(Number) as [number, number];
      edifici.push({
        entityId: s1?.entityId ?? "street", mapEntityId: `planner-road-${k}`, name: s1?.name ?? "", x, y, w: 1, h: 1, type: "street",
        isGreatBuilding: false, isMilitary: false, isNeedlessRoad: false, isInactive: false, isSuppliesProducer: false, roadLevel: 0,
      });
    }
    return edifici;
  };
  /** Terreno sbloccato come strisce orizzontali di celle contigue (UnlockedAreas). */
  const areeProblema = () => {
    const aree: Array<{ x: number; y: number; width: number; length: number }> = [];
    const pts = [...problem.cells].map(k => k.split(",").map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [x, y] of pts) {
      const u = aree[aree.length - 1];
      if (u && u.y === y && u.x + u.width === x) u.width++;
      else aree.push({ x, y, width: 1, length: 1 });
    }
    return aree;
  };
  const nomeFile = (n: VName, ext: string) => {
    const sc = outcome?.find(x => x.id === n);
    return sc && !sc.raccordo ? `foe-planner-girandola${sc.gir ? "-2" : ""}-${localDateStamp()}.${ext}`
      : `foe-planner-raccordo${sc?.raccordo ?? 3}-${localDateStamp()}.${ext}`;
  };
  /** Scarica la soluzione come JSON (stesso formato dell'export del pannello MAPPA). */
  const scaricaJsonFrame = (f: PlannerFrame, n: VName) => scaricaJson(esportaCittaJson(edificiFrame(f, n), areeProblema()), nomeFile(n, "json"));
  /** Scarica la mappa come PNG, con lo stesso disegno dell'export del pannello MAPPA (renderCityMapPng). */
  const scaricaPng = (f: PlannerFrame, n: VName) => {
    const edifici = edificiFrame(f, n);
    const aree = areeProblema();
    try {
      const canvas = document.createElement("canvas");
      // "Modifica città": edifici aggiunti col bordo bianco, tolti elencati in basso
      const tolti = cittaVera.filter(b => modifiche.tolti.has(b.mapEntityId)).map(b => b.name);
      const nota = contaModifiche(modifiche)
        ? [modifiche.aggiunti.length ? t("plannerPngAdded", uiLang, modifiche.aggiunti.length) : "", tolti.length ? t("plannerPngRemoved", uiLang, tolti.join(", ")) : ""].filter(Boolean).join(" · ")
        : undefined;
      renderCityMapPng(canvas, edifici.map(b => (eNuovo(b.mapEntityId) ? { ...b, nuovo: true } : b)), aree, 2, t("legendTownHall", uiLang), nota);
      const link = document.createElement("a");
      link.download = nomeFile(n, "png");
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("[FOE] Planner PNG export failed:", err);
    }
  };

  // ── Editor esterno (public/editor.html): canale bidirezionale con postMessage ──
  // "✏ Modifica" apre l'editor in una nuova scheda; l'editor risponde
  // {tipo:"pronto"} e riceve {tipo:"carica"} con la soluzione (formato
  // dell'export JSON + colori della vista MAPPA); "Applica al Planner"
  // rimanda {tipo:"applica"}, il Planner controlla e risponde {tipo:"esito"}.
  // Le modifiche a mano nel Planner (trascina, tasto destro, clic sulle
  // strade) sono state tolte: si modifica solo nell'editor.
  /** Scenario modificabile: in pausa (come le vecchie modifiche a mano) o a corsa finita. */
  const modificabile = (n: VName) => !!frames[n] && !eliminati.has(n) && (!running || (inPausa[n] && paused && !smussando));
  const titoloScenario = (n: VName) => {
    const sc = outcome?.find(x => x.id === n);
    if (sc?.attuale) return t("plannerScenarioCurrent", uiLang);
    return sc?.raccordo ? t("plannerScenarioConnector", uiLang, sc.raccordo) : t(sc?.gir ? "plannerScenarioPinwheel2" : "plannerScenarioPinwheel", uiLang);
  };
  /** Finestre dell'editor aperte: scenario, token dell'apertura, generazione
   *  della corsa all'invio e id del JSON → id degli edifici della città. */
  type InfoEditor = { n: VName; token: number; gen: number; idMap: Map<string, string> };
  const editorRef = useRef(new Map<Window, InfoEditor>());
  const tokenRef = useRef(0);
  const apriEditor = (n: VName) => {
    const w = window.open("/editor.html", `foe-editor-${n}`);
    if (!w) { alert(t("plannerPopupBlocked", uiLang)); return; }
    for (const x of [...editorRef.current.keys()]) if (x.closed) editorRef.current.delete(x);
    editorRef.current.set(w, { n, token: ++tokenRef.current, gen: genRef.current, idMap: new Map() });
    w.focus();
  };
  const inviaAEditor = (w: Window, e: InfoEditor) => {
    const f = framesRef.current[e.n];
    if (!f) return;
    const edifici = edificiFrame(f, e.n);
    e.idMap = new Map();
    e.gen = genRef.current;
    const json = esportaCittaJson(edifici, areeProblema(), e.idMap);
    const perId = new Map(edifici.map(b => [b.mapEntityId, b]));
    const colori: Record<string, string> = {};
    for (const [jid, mid] of e.idMap) {
      const b = perId.get(mid);
      if (b) colori[jid] = coloreEdificioMappa({
        ...b, isTownhall: b.type === "main_building", isStreet: b.type === "street",
        isGreatBuilding: b.isGreatBuilding || grandiEdifici.has(mid), roadLevel: byId.get(mid)?.roadLevel ?? b.roadLevel,
      });
    }
    w.postMessage({ tipo: "carica", token: e.token, titolo: titoloScenario(e.n), json, colori, nomeMunicipio: t("legendTownHall", uiLang), lang: uiLang }, location.origin);
  };
  /** Applica la città rimandata dall'editor; restituisce gli errori (vuoto = applicata). */
  const applicaDaEditor = (e: InfoEditor, dati: unknown): string[] => {
    if (e.gen !== genRef.current) return [t("plannerEditorRestarted", uiLang)];
    if (!modificabile(e.n)) return [t("plannerEditorPauseFirst", uiLang)];
    const f = framesRef.current[e.n]!;
    const r = cittaDaEditor(dati, { problem, blocchi: catene.blocchi, idMap: e.idMap, frame: f, soloSenzaStrada: filling[e.n], lang: uiLang });
    if (r.errori.length) return r.errori;
    // Strade a due corsie: i blocchi 2×2 si possono spostare, aggiungere o
    // togliere (alla ripresa diventano le nuove strade fisse della ricerca),
    // purché allineati e collegati al municipio, con gli edifici a due corsie
    // accanto a un blocco collegato (verificaDueCorsie).
    const err2 = verificaDueCorsie(problem, r.placements, r.blocchi, uiLang);
    if (err2.length) return err2;
    const { placements: pl, roads } = r;
    applicaManuale(e.n, { ...f, placements: pl, roads, due: r.blocchi, lastPath: [...roads].filter(k => !f.roads.has(k)), probe: null, placed: pl.size });
    return [];
  };
  const onMessageRef = useRef<(ev: MessageEvent) => void>(() => {});
  onMessageRef.current = (ev: MessageEvent) => {
    if (ev.origin !== location.origin) return;
    const w = ev.source as Window | null;
    const e = w ? editorRef.current.get(w) : undefined;
    if (!w || !e) return;
    const m = (ev.data ?? {}) as { tipo?: string; token?: number; json?: unknown };
    if (m.tipo === "pronto") inviaAEditor(w, e);
    else if (m.tipo === "applica" && m.token === e.token) {
      const errori = applicaDaEditor(e, m.json);
      w.postMessage({ tipo: "esito", token: e.token, ok: !errori.length, msg: errori.length ? errori.join("\n") : t("plannerAppliedTo", uiLang, titoloScenario(e.n)) }, location.origin);
    }
  };
  useEffect(() => {
    const h = (ev: MessageEvent) => onMessageRef.current(ev);
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, []);

  return (
    <div className="mb-3 rounded border border-fuchsia-700/50 bg-slate-900/40 text-[13px] text-slate-300">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <span className="font-bold uppercase tracking-wider text-fuchsia-300">🧭 Planner</span>
        <span className="mr-2 text-slate-500">{t("plannerExperimental", uiLang)}</span>
        {/* Tre fasi, ciascuna col suo pulsante che fa da avvio, pausa e
            ripresa (richiesta dell'utente): 1. ricerca, 2. smussatura dei
            bordi (solo con la ricerca in pausa), 3. completamento. */}
        {!running ? (
          <button type="button" onClick={() => void start()}
            className="rounded border border-emerald-600 px-3 py-1 font-bold text-emerald-300 hover:bg-emerald-950">{t("plannerOptimize", uiLang)}</button>
        ) : paused && !completando ? (
          <button type="button" onClick={riprendi} disabled={smussando}
            title={t("plannerResumeTitle", uiLang)}
            className="rounded border border-sky-500 bg-sky-950 px-3 py-1 font-bold text-sky-300 hover:bg-sky-900 disabled:opacity-40">{t("plannerOptimize", uiLang)}</button>
        ) : (
          <button type="button" disabled={completando || !anySearching} onClick={pausa}
            title={t("plannerPauseTitle", uiLang)}
            className="rounded border border-red-600 px-3 py-1 font-bold text-red-300 hover:bg-red-950 disabled:opacity-40">{t("plannerPause", uiLang)}</button>
        )}
        {smussando ? (
          <button type="button" onClick={() => { stopSmussaRef.current = true; }}
            className="rounded border border-violet-500 bg-violet-950 px-3 py-1 font-bold text-violet-300 hover:bg-violet-900">{t("plannerPause", uiLang)}</button>
        ) : (
          <button type="button" onClick={() => void smussa()} disabled={!paused || completando || !anySearching}
            title={t("plannerSmoothTitle", uiLang)}
            className="rounded border border-violet-500 px-3 py-1 font-bold text-violet-300 hover:bg-violet-950 disabled:opacity-40">{t("plannerSmooth", uiLang)}</button>
        )}
        {!completando ? (
          <button type="button" disabled={!paused || !anySearching || smussando}
            onClick={completa}
            title={t("plannerCompleteTitle", uiLang)}
            className="rounded border border-amber-500 px-3 py-1 font-bold text-amber-300 hover:bg-amber-950 disabled:opacity-40">{t("plannerComplete", uiLang)}</button>
        ) : paused ? (
          <button type="button" onClick={riprendi}
            title={t("plannerFillResumeTitle", uiLang)}
            className="rounded border border-amber-500 bg-amber-950 px-3 py-1 font-bold text-amber-300 hover:bg-amber-900 disabled:opacity-40">{t("plannerComplete", uiLang)}</button>
        ) : (
          <button type="button" disabled={!anyFilling} onClick={pausa}
            title={t("plannerFillPauseTitle", uiLang)}
            className="rounded border border-amber-500 px-3 py-1 font-bold text-amber-300 hover:bg-amber-950 disabled:opacity-40">{t("plannerPause", uiLang)}</button>
        )}
        {completando && visibili.some(sc => primaRef.current[sc.id]) && (
          <button type="button" onClick={annullaCompletamento}
            title={t("plannerUndoCompleteTitle", uiLang)}
            className="rounded border border-amber-500 px-3 py-1 font-bold text-amber-300 hover:bg-amber-950">{t("plannerUndoComplete", uiLang)}</button>
        )}
        {(paused || !running) && !smussando && visibili.some(sc => manuali[sc.id]) && (
          <button type="button" onClick={annullaManuali}
            title={t("plannerUndoManualTitle", uiLang)}
            className="rounded border border-slate-500 px-3 py-1 font-bold text-slate-200 hover:bg-slate-800">{t("plannerUndoManual", uiLang)}</button>
        )}
        <button type="button" disabled={running && !paused} onClick={reset}
          className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800 disabled:opacity-40">{t("plannerReset", uiLang)}</button>
        {/* Modifica città (prima di ottimizzare): togli / aggiungi edifici */}
        {!esterna && (
          <button type="button" onClick={() => setPannelloModifica(v => !v)} disabled={running && !paused}
            title={t(running && !paused ? "plannerEditCityLocked" : "plannerEditCityTitle", uiLang)}
            className={`rounded border px-3 py-1 font-bold disabled:opacity-40 ${contaModifiche(modifiche) ? "border-amber-400 bg-amber-950 text-amber-200 hover:bg-amber-900" : "border-teal-500 text-teal-300 hover:bg-teal-950"}`}>
            {t("plannerEditCity", uiLang)}{contaModifiche(modifiche) ? ` · ${contaModifiche(modifiche)}` : ""}
          </button>
        )}
        {/* Potenza della CPU (vedi carico): si può cambiare anche durante la corsa */}
        <span className="ml-1 inline-flex overflow-hidden rounded border border-slate-600" role="group" aria-label={t("plannerCpuGroup", uiLang)}
          title={(() => {
            // diagnostica: quanti core vede il browser, ricerche e pause calcolate
            const n = Math.max(1, visibili.length), c = carico(n, potenza), core = coreDisponibili();
            const lavoro = 1 / (1 + c.riposo);
            return t("plannerCpuTitle", uiLang, core, n, c.semi, Math.round(lavoro * 100), Math.round((100 * n * c.semi * lavoro) / core));
          })()}>
          <span className="px-2 py-1 text-[11px] font-bold text-slate-400">CPU</span>
          {(["min", "med", "max"] as const).map(p => (
            <button key={p} type="button" aria-pressed={potenza === p} onClick={() => setPotenza(p)}
              className={`px-2 py-1 text-[11px] font-bold ${potenza === p ? "bg-sky-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{p.toUpperCase()}</button>
          ))}
        </span>
        <span className="ml-2 text-slate-400">
          {t("plannerCityInfo", uiLang, problem.buildings.length, problem.originalRoadCells)}
        </span>
        {/* Città esterna (export JSON del pannello MAPPA di un altro utente):
            strumento di test, visibile solo con DEBUG_PLANNER. */}
        {DEBUG_PLANNER && (<>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            onChange={e => { const f = e.currentTarget.files?.[0]; if (f) void importaJson(f); e.currentTarget.value = ""; }} />
          <button type="button" disabled={running && !paused} onClick={() => fileRef.current?.click()}
            title={t("plannerImportJsonTitle", uiLang)}
            className="rounded border border-slate-600 px-2 py-1 text-[12px] hover:bg-slate-800 disabled:opacity-40">{t("plannerImportJson", uiLang)}</button>
          {esterna && (
            <>
              <span className="rounded bg-violet-900/60 px-2 py-0.5 text-[12px] font-bold text-violet-200" title={t("plannerImportedTitle", uiLang)}>🏙 {esterna.nome}</span>
              <button type="button" disabled={running && !paused} onClick={() => setEsterna(null)}
                className="rounded border border-slate-600 px-2 py-0.5 text-[12px] hover:bg-slate-800 disabled:opacity-40">{t("plannerProfileCity", uiLang)}</button>
            </>
          )}
          {erroreImport && <span className="text-[12px] text-red-400">{erroreImport}</span>}
        </>)}
        {computing && <span className="ml-2 text-amber-300">{t("plannerComputing", uiLang)}</span>}
        {outcome === null && <span className="ml-2 text-red-300">{t("plannerUnsuitable", uiLang)}</span>}
        {/* Video tutorial: sempre a destra, ben visibile */}
        <button type="button" onClick={() => setVideoAperto(true)} title={t("plannerVideoTitle", uiLang)}
          className="ml-auto rounded border border-rose-400 bg-rose-600 px-3 py-1 font-bold text-white shadow hover:bg-rose-500">{t("plannerVideo", uiLang)}</button>
      </div>
      {videoAperto && <VideoTutorial onClose={() => setVideoAperto(false)} uiLang={uiLang} />}
      {pannelloModifica && !esterna && (
        <ModificaCitta citta={cittaVera} cittaModificata={cityMapBuildings} modifiche={modifiche} setModifiche={setModifiche}
          candidati={candidati} celleSbloccate={problem.cells.size} bloccato={running && !paused} inCorsa={running}
          onChiudi={() => setPannelloModifica(false)} uiLang={uiLang} />
      )}
      {edificiSet.length > 0 && !avvisoSetChiuso && (
        // Avviso: i vecchi set a bonus di adiacenza non sono gestiti (decisione dell'utente).
        <div role="alert" className="relative mx-3 mt-3 flex items-start gap-2 rounded border-2 border-amber-500 bg-amber-950/60 py-2 pl-3 pr-9 text-[13px] text-amber-100">
          <button type="button" onClick={() => setAvvisoSetChiuso(true)} title={t("plannerClose", uiLang)} aria-label={t("plannerCloseNotice", uiLang)}
            className="absolute right-1.5 top-1.5 rounded px-1.5 leading-none text-amber-300 hover:bg-amber-900 hover:text-white">✕</button>
          <span className="text-lg leading-none">⚠️</span>
          <span>
            <b className="text-amber-300">{t("plannerSetsTitle", uiLang)}</b>{" "}
            {t("plannerSetsBody", uiLang, edificiSet.length)}{" "}
            {t("plannerSetsList", uiLang)} <b>{[...new Set(edificiSet.map(b => b.name))].sort().join(", ")}</b>.
          </span>
        </div>
      )}
      {problem.geRifornimento.length > 0 && militari > 0 && !avvisoMilitariChiuso && (
        // Avviso informativo con Alcatraz / Nave: i militari non hanno bisogno di
        // strada; con gli interruttori l'utente sceglie quali collegare lo stesso.
        <div role="status" className="relative mx-3 mt-3 flex items-start gap-2 rounded border-2 border-sky-500 bg-sky-950/60 py-2 pl-3 pr-9 text-[13px] text-sky-100">
          <button type="button" onClick={() => setAvvisoMilitariChiuso(true)} title={t("plannerClose", uiLang)} aria-label={t("plannerCloseNotice", uiLang)}
            className="absolute right-1.5 top-1.5 rounded px-1.5 leading-none text-sky-300 hover:bg-sky-900 hover:text-white">✕</button>
          <span className="text-lg leading-none">ℹ️</span>
          <span>
            <b className="text-sky-300">{t("plannerMilitaryTitle", uiLang)}</b>{" "}
            {t("plannerMilitaryIn", uiLang)} <b>{[...new Set(problem.geRifornimento)].join(` ${t("plannerAnd", uiLang)} `)}</b>, {t("plannerMilitaryBody", uiLang)}
            <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {militariTipi.map(m => {
                const on = militariCollegati.has(m.entityId);
                return (
                  <label key={m.entityId} className={`flex items-center gap-1.5 ${running && !paused ? "opacity-50" : "cursor-pointer"}`}
                    title={t(running && !paused ? "plannerSwitchLocked" : on ? "plannerSwitchOn" : "plannerSwitchOff", uiLang)}>
                    <button type="button" role="switch" aria-checked={on} disabled={running && !paused}
                      onClick={() => setMilitariCollegati(prev => { const n = new Set(prev); if (n.has(m.entityId)) n.delete(m.entityId); else n.add(m.entityId); return n; })}
                      className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-slate-600"}`}>
                      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
                    </button>
                    <span>{m.name}{m.n > 1 ? ` ×${m.n}` : ""}{m.roadLevel >= 2 ? t("plannerTwoLaneTag", uiLang) : ""}</span>
                  </label>
                );
              })}
            </span>
          </span>
        </div>
      )}
      <div className="p-3">
          {outcome === null ? (
            <div>
              <div className="mb-1 text-[12px]">{stats(soloFrame)}</div>
              <div className="overflow-hidden rounded border border-slate-800"><MapCanvas frame={soloFrame} problem={problem} byId={byId} ge={grandiEdifici} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Sempre due colonne: una mappa sola resta a metà larghezza (a tutta
                  larghezza diventava troppo alta). */}
              {visibili.map(sc => {
                const n = sc.id;
                const f = frames[n];
                // Bordi tratteggiati (gialli = problematici, rossi = strade vuote):
                // sempre visibili; l'elenco sotto la mappa solo con DEBUG_PLANNER.
                const eff = f ? calcolaRoadEff(problem.buildings, f.placements, f.roads) : null;
                const vuote = f ? calcolaStradeVuote(problem.buildings, f.placements, f.roads, problem.cells) : null;
                return (
                  <div key={n} className="min-w-0 rounded border border-slate-800 p-2">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <b className="text-fuchsia-300">{titoloScenario(n)}</b>
                      <span className="text-[12px]">{stats(f, ricerca[n]?.valutate)}</span>
                    </div>
                    {/* Riga dei pulsanti (sotto il titolo e le statistiche) */}
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {f && inPausa[n] && paused && !smussando && (
                        <span className="flex items-center gap-0.5 text-[12px] text-slate-400" title={t("plannerMoveAllTitle", uiLang)}>
                          {([["←", -1, 0], ["↑", 0, -1], ["↓", 0, 1], ["→", 1, 0]] as const).map(([fr, dx, dy]) => (
                            <button key={fr} type="button" disabled={!traslato(f, dx, dy)} onClick={() => spostaTutto(n, dx, dy)}
                              className="rounded border border-sky-600 px-1.5 font-bold text-sky-300 hover:bg-sky-950 disabled:opacity-30">{fr}</button>
                          ))}
                        </span>
                      )}
                      {f && inPausa[n] && paused && !smussando && (
                        <span className="flex items-center gap-0.5 text-[12px] text-slate-400" title={t("plannerMirrorTitle", uiLang)}>
                          {t("plannerMirror", uiLang)}
                          {([["⇋", "h", "plannerMirrorH"], ["⇵", "v", "plannerMirrorV"]] as const).map(([fr, asse, tit]) => (
                            <button key={asse} type="button" title={specchioCatene[asse] ? t("plannerMirrorChain", uiLang) : t(tit, uiLang)}disabled={!specchiato(f, asse)} onClick={() => applicaManuale(n, specchiato(f, asse))}
                              className="rounded border border-sky-600 px-1.5 font-bold text-sky-300 hover:bg-sky-950 disabled:opacity-30">{fr}</button>
                          ))}
                        </span>
                      )}
                      <button type="button" disabled={!modificabile(n)} onClick={() => apriEditor(n)}
                        title={t(modificabile(n) ? "plannerEditTitle" : "plannerEditLockedTitle", uiLang)}
                        className="ml-auto rounded border border-sky-600 px-2 py-0.5 text-[12px] font-bold text-sky-300 hover:bg-sky-950 disabled:opacity-40">
                        {t("plannerEdit", uiLang)}
                      </button>
                      <button type="button" disabled={!f} onClick={() => f && scaricaPng(f, n)}
                        className="rounded border border-emerald-600 px-2 py-0.5 text-[12px] font-bold text-emerald-300 hover:bg-emerald-950 disabled:opacity-40">
                        ⬇ PNG
                      </button>
                      <button type="button" disabled={!f} onClick={() => f && scaricaJsonFrame(f, n)}
                        title={t("plannerJsonTitle", uiLang)}
                        className="rounded border border-emerald-600 px-2 py-0.5 text-[12px] font-bold text-emerald-300 hover:bg-emerald-950 disabled:opacity-40">
                        ⬇ JSON
                      </button>
                      <button type="button" disabled={visibili.length <= 1} onClick={() => elimina(n)}
                        title={t("plannerDeleteTitle", uiLang)}
                        className="rounded border border-red-700 px-2 py-0.5 text-[12px] text-red-300 hover:bg-red-950 disabled:opacity-40">🗑</button>
                    </div>
                    <div className={`overflow-hidden rounded border ${inPausa[n] ? "border-sky-500" : "border-slate-800"}`}>
                      <MapCanvas frame={f} problem={problem} byId={byId} ge={grandiEdifici} pausa={inPausa[n] && paused} due={f?.due ?? dueRef.current[n]}
                        evidenzia={eff ? new Set(eff.voci.map(v => v.id)) : undefined} stradeVuote={vuote ?? undefined} />
                    </div>
                    {DEBUG_PLANNER && eff && (
                      // DEBUG_PLANNER (roadEff.ts): edifici con road_eff > 0 = celle di strada toccate − lato corto.
                      <div className="mt-1 rounded border border-yellow-700/60 bg-yellow-950/20 px-2 py-1 text-[11px] text-yellow-100">
                        <div className="font-bold text-yellow-300">
                          DEBUG road_eff · num_road_eff_pos <span className="text-white">{eff.num}</span> · sum_road_eff_pos <span className="text-white">{eff.sum}</span>
                          {" · "}<span className="text-red-300">strade_vuote <span className="text-white">{vuote?.length ?? 0}</span></span>
                        </div>
                        {eff.voci.length > 0 && (
                          <div className="mt-0.5 max-h-32 overflow-y-auto">
                            {eff.voci.map(v => (
                              <div key={v.id}>+{v.eff} · {v.name} {v.w}×{v.h} · {v.strade} celle di strada (lato corto {Math.min(v.w, v.h)})</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
