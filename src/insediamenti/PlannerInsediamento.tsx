// ─────────────────────────────────────────────────────────────────────────────
//  Planner degli insediamenti culturali (Pirati, Mughal)
//
//  (28/11/2026) Era components/PiratiTool.tsx: rinominato e spostato qui perché serve a tutti
//  gli insediamenti. Cosa cambia fra l'uno e l'altro lo dice la configurazione `cfg`
//  (data/insediamenti.ts): cfg.solver (Pirati: Risolvi, Auto), cfg.ottimizzatore, cfg.valuta,
//  cfg.sblocchi (Mughal); i motori dei Mughal stanno in insediamenti/mughal/.
//
//  Portato 1:1 (agosto 2026) dal tool standalone "foe-pirati" (D:\FOE\pirati),
//  dove era già validato su dati reali, e montato come componente nella tab
//  "Pirati" di FoE Optimizer. Il dominio (tipi/costanti/funzioni pure) vive in
//  data/piratiBuildings.ts, l'import dei dati di gioco in
//  data/importCulturalOutpost.ts, il bookmarklet condiviso con il resto
//  dell'app in data/bookmarklet.ts (branch 'cultural_outpost').
//
//  Modulo volutamente autocontenuto (icone SVG/helper cx/formatTime propri,
//  invece di riusare quelli di App.tsx) per restare facile da mantenere/
//  aggiornare in blocco insieme al tool standalone di origine.
// ─────────────────────────────────────────────────────────────────────────────

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
// Unica eccezione all'autocontenimento (icone SVG proprie, vedi commento in testa al
// file): Wand2 è importata da lucide-react per riusare l'IDENTICA immagine della
// bacchetta magica mostrata come CTA in App.tsx (tab Città/Inventario, "Nessuna città
// importata...") nella guida rapida in fondo al planner — stesso font/stile, stessa icona.
import { Wand2, Play, Square, Repeat, Undo2, Trash2, SquarePlus, SquareMinus, Construction, Sparkles, FastForward, Handshake, X as IconaChiudi, type LucideIcon } from "lucide-react";
import type { RibbonGroup, RibbonItem } from "../ui/ribbon/Ribbon";
import { iconDiplomazia } from "../assets/icons";
import { isLegacyBookmarkletPayload, readPayloadDiagnostics, validateBookmarkletPirateOutpostData } from "../data/bookmarklet";
import { importCulturalOutpostPayload, ImportCulturalOutpostFailure } from "../data/importCulturalOutpost";
import { t, type UiLang } from "../data/ui-strings";
import { formatInt } from "../utils/format";
import LavoratoreMughal from "./mughal/lavoratore?worker&inline";
import LavoratoreDiplomazia from "./mughal/lavoratoreDiplomazia?worker&inline";
import { diplomaziaDisposizione, posizioniAmbasciataDipl, SOGLIE_DIPLOMAZIA, totaleLavori, unisciDiplomazia, type RichiestaDiplomazia, type TentativoDipl, type TipoDipl } from "./mughal/diplomazia";
import { posizioniAmbasciata, unisciTentativi, type RichiestaOttimizzatore, type Tentativo, type TipoOttimizzatore } from "./mughal/ottimizzatore";
import { confrontaDisposizioni, FrecciaConfronto, MappaSolaLettura, RiepilogoConfronto, type DatiRiepilogo } from "./ConfrontoMappe";
import { caricaSblocchi, leggiSblocchi, salvaSblocchi, statoDopoImport, type StatoSblocchi } from "./sblocchi";
import { INSEDIAMENTI, type IdInsediamento } from "../data/insediamenti";
import { improntaInsediamento, pacchettiPonte } from "../data/ponte";

/** Id del municipio nei piazzamenti: uguale in ogni insediamento (vedi data/insediamenti.ts). */
const ID_MUNICIPIO = "municipio";
import {
  type BuildingType,
  type Placement,
  type EditMode,
  type Baseline,
  buildingColorStyle,
  storageCell,
  displayCell,
  BLOCK_SIZE,
  CELL_SIZE_PX,
  DIRECTIONS,
  SMALL_CUTOFF,
  BIG_THRESHOLD,
  SOLVE_TIME_LIMIT_MS,
  blockKey,
  cellKey,
  parseBlockKey,
  parseCellKey,
  displayToStorageCell,
  storageToDisplayCell,
  layoutStatus,
  buildUnlockedBlockSet as buildUnlockedBlockSetDa,
  isRemovableExpansion as isRemovableExpansionDa,
} from "../data/piratiBuildings";

// Icone SVG inline (stroke, coerenti con lo stile FoE Optimizer: niente libreria
// icone esterna, controllo diretto su stroke/fill invece del glifo con colore pieno).
function IconStop({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function IconCheckCircle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  );
}

function IconAlertCircle({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

/**
 * Cede il controllo all'event loop (per aggiornare la UI e permettere lo Stop)
 * SENZA pagare il clamp dei timer annidati.
 *
 * ⚠️ Perché non `setTimeout(resolve, 0)`: la spec HTML impone un minimo di 4ms
 * ai timer con più di 5 livelli di annidamento, e una ricerca che cede il
 * controllo in catena li supera dopo poche iterazioni. Il solver perdeva così
 * ~4ms per ogni yield: su una ricerca reale da 472.629 passi (189 yield) erano
 * 0,76s di attesa forzata su 2,85s totali — il 27% del tempo speso ad
 * aspettare, e ~24s su una ricerca da 15 milioni di passi.
 *
 * Ordine di preferenza:
 *  1. `scheduler.yield()` — API nativa pensata esattamente per questo, nessun
 *     clamp, la continuazione ha priorità sui task successivi.
 *  2. `MessageChannel` — fallback classico clamp-free (misurato ~14x più
 *     economico di setTimeout(0) anche a parità di clamp).
 *  3. `setTimeout` — ultima spiaggia, per ambienti che non hanno né l'uno né
 *     l'altro (es. test in Node senza DOM).
 */
function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();

  if (typeof MessageChannel === "function") {
    return new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(undefined);
    });
  }

  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Concatena classi condizionali (niente clsx/tailwind-merge: qui non servono
 * merge di classi Tailwind in conflitto, solo composizione condizionale semplice). */
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatTime(milliseconds: number) {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)}s`;
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/** Disposizione edifici + piazzamenti usata come punto di ripristino (vedi
 *  lastSolvedRef nel componente). */
type SolvedSnapshot = { buildings: BuildingType[]; placements: Placement[] };

/** Trasla dei piazzamenti (coordinate StorageCell) quando cambia il blocco
 *  sbloccato minimo, cioè l'ancora dello spazio storage: stessa traslazione che
 *  addExpansion/removeExpansion applicano a placements, ostacoli e registro import. */
function shiftPlacements(list: Placement[], rowDelta: number, colDelta: number): Placement[] {
  if (rowDelta === 0 && colDelta === 0) return list;
  return list.map((placement) => ({ ...placement, row: placement.row + rowDelta, col: placement.col + colDelta }));
}

/** Toglie da una disposizione i piazzamenti su celle diventate inutilizzabili
 *  (blocco richiuso, nuovo ostacolo), scalando i conteggi dei rispettivi edifici:
 *  il risultato resta una disposizione valida e coerente (stesso principio del
 *  ramo '−' di updateCount: un sottoinsieme di una disposizione valida è valido).
 *  Restituisce null se tra i piazzamenti persi c'è il Municipio, che non si può
 *  togliere: in quel caso il chiamante ripiega sullo stato corrente. */
function withoutLostPlacements(snapshot: SolvedSnapshot, isLost: (placement: Placement) => boolean): SolvedSnapshot | null {
  const lost = snapshot.placements.filter(isLost);
  if (lost.length === 0) return snapshot;
  if (lost.some((placement) => placement.buildingId === ID_MUNICIPIO)) return null;
  const lostCounts = new Map<string, number>();
  for (const placement of lost) {
    lostCounts.set(placement.buildingId, (lostCounts.get(placement.buildingId) ?? 0) + 1);
  }
  return {
    buildings: snapshot.buildings.map((building) => ({
      ...building,
      count: Math.max(0, building.count - (lostCounts.get(building.id) ?? 0)),
    })),
    placements: snapshot.placements.filter((placement) => !isLost(placement)),
  };
}

/** Miglior posizione libera per un edificio width×height, con la regola
 *  dell'auto-piazzamento del '+': il maggior numero di celle a contatto col bordo
 *  dell'area sbloccata, a parità la prima in ordine riga/colonna.
 *  `isUsable(row, col)`: cella sbloccata — deve restituire false anche fuori
 *  griglia, perché è così che si riconoscono le celle di bordo.
 *  `isFree(row, col)`: né ostacolo né edificio (chiamata solo su celle usabili). */
function bestFreePlacement(
  width: number,
  height: number,
  rows: number,
  cols: number,
  isUsable: (row: number, col: number) => boolean,
  isFree: (row: number, col: number) => boolean,
): { row: number; col: number } | null {
  let best: { row: number; col: number } | null = null;
  let bestScore = -1;
  for (let row = 0; row <= rows - height; row++) {
    for (let col = 0; col <= cols - width; col++) {
      let fits = true;
      let edgeTouches = 0;
      for (let dr = 0; dr < height && fits; dr++) {
        for (let dc = 0; dc < width; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (!isUsable(r, c) || !isFree(r, c)) {
            fits = false;
            break;
          }
          if (!isUsable(r - 1, c) || !isUsable(r + 1, c) || !isUsable(r, c - 1) || !isUsable(r, c + 1)) {
            edgeTouches++;
          }
        }
      }
      // `>` stretto: a parità di punteggio resta la prima trovata in ordine
      // riga/colonna, come faceva l'ordinamento stabile dell'auto-piazzamento.
      if (fits && edgeTouches > bestScore) {
        best = { row, col };
        bestScore = edgeTouches;
      }
    }
  }
  return best;
}

/** Disposizione dopo la chiusura di un blocco (removeExpansion). Gli edifici che
 *  toccavano il blocco vengono spostati nella miglior posizione libera della
 *  griglia rimasta (bestFreePlacement), uno alla volta nell'ordine della lista;
 *  quelli che non trovano posto escono dalla mappa col conteggio invariato
 *  (Risolvi li ridispone). Tutti gli altri restano dove sono.
 *  Coordinate in ingresso: spazio storage PRIMA della rimozione; in uscita:
 *  spazio storage DOPO (traslato di rowDelta/colDelta).
 *  Prima removeExpansion passava da clearSolution, che svuotava l'INTERA mappa
 *  (tranne il Municipio) appena un solo edificio toccava il blocco richiuso — bug
 *  segnalato dall'utente a settembre 2026. */
function layoutAfterBlockRemoval(params: {
  placements: Placement[];
  obstacles: Set<string>;
  removedRowStart: number;
  removedColStart: number;
  nextUnlockedBlocks: Set<string>;
  nextMinRow: number;
  nextMinCol: number;
  rowDelta: number;
  colDelta: number;
}): { placements: Placement[]; displaced: number; unplaced: number } {
  const { placements, obstacles, removedRowStart, removedColStart, nextUnlockedBlocks, nextMinRow, nextMinCol, rowDelta, colDelta } = params;
  const touchesRemovedBlock = placements.map((placement) => (
    placement.row < removedRowStart + BLOCK_SIZE &&
    placement.row + placement.h > removedRowStart &&
    placement.col < removedColStart + BLOCK_SIZE &&
    placement.col + placement.w > removedColStart
  ));
  const shifted = shiftPlacements(placements, rowDelta, colDelta);
  const displaced = touchesRemovedBlock.filter(Boolean).length;
  if (displaced === 0) return { placements: shifted, displaced: 0, unplaced: 0 };

  const blocks = Array.from(nextUnlockedBlocks).map(parseBlockKey);
  const rows = (Math.max(...blocks.map((block) => block.row)) - nextMinRow + 1) * BLOCK_SIZE;
  const cols = (Math.max(...blocks.map((block) => block.col)) - nextMinCol + 1) * BLOCK_SIZE;
  const isUsable = (row: number, col: number) =>
    row >= 0 && col >= 0 && row < rows && col < cols &&
    nextUnlockedBlocks.has(blockKey(nextMinRow + Math.floor(row / BLOCK_SIZE), nextMinCol + Math.floor(col / BLOCK_SIZE)));

  const taken = new Set<string>();
  const take = (placement: Placement) => {
    for (let dr = 0; dr < placement.h; dr++) {
      for (let dc = 0; dc < placement.w; dc++) {
        taken.add(cellKey(storageCell(placement.row + dr, placement.col + dc)));
      }
    }
  };
  obstacles.forEach((obstacleKey) => {
    const { row, col } = parseCellKey(obstacleKey);
    taken.add(cellKey(storageCell(row + rowDelta, col + colDelta)));
  });
  // Prima TUTTI gli edifici che restano, poi i ricollocamenti: uno spostato non
  // deve finire sopra un edificio che viene dopo di lui nella lista.
  shifted.forEach((placement, index) => {
    if (!touchesRemovedBlock[index]) take(placement);
  });

  let unplaced = 0;
  const result: Placement[] = [];
  shifted.forEach((placement, index) => {
    if (!touchesRemovedBlock[index]) {
      result.push(placement);
      return;
    }
    const spot = bestFreePlacement(placement.w, placement.h, rows, cols, isUsable, (row, col) => !taken.has(cellKey(storageCell(row, col))));
    if (!spot) {
      unplaced++;
      return;
    }
    const moved = { ...placement, row: spot.row, col: spot.col };
    take(moved);
    result.push(moved);
  });
  return { placements: result, displaced, unplaced };
}

/**
 * Handle imperativo esposto a App.tsx: la bacchetta magica dell'header
 * globale (handleWandClick) è l'UNICO pulsante bacchetta nell'app — quando
 * l'utente si trova sulla tab Pirati, invece di creare un profilo città/
 * inventario, importa direttamente nel planner qui sotto tramite questo
 * metodo (niente pulsante/icona duplicati dentro PlannerInsediamento stesso).
 */
export type PlannerInsediamentoHandle = {
  /** Importa un payload cultural_outpost dal testo (già letto dagli appunti
   *  dal chiamante). Restituisce l'esito per il messaggio da mostrare
   *  all'utente, sullo stesso modello di runImport/importMessage interni. */
  importFromClipboardText: (rawText: string) => { kind: "success" | "error"; text: string };
  /** (25/11/2026) Ci sono modifiche fatte a mano dopo l'ultimo import (o dalla partenza)?
   *  Il ponte importa da solo solo se no; altrimenti chiede con un avviso. */
  haModifiche: () => boolean;
  /** (25/11/2026) Mondo (server) dell'insediamento mostrato: quello dell'ultimo import, null
   *  prima di un import (Reset svuota il planner ma resta di quel mondo). Un planner per mondo: App fotografa lo stato prima di
   *  passare a un altro mondo e lo rimette tornando indietro. */
  mondo: () => string | null;
  /** Sta risolvendo: niente cambio di mondo finché non finisce. */
  occupato: () => boolean;
  fotografia: () => FotoPlanner;
  ripristina: (f: FotoPlanner) => void;
};

/** Stato completo del planner di un mondo (in memoria, finché la pagina resta aperta). */
export type FotoPlanner = {
  mondo: string | null;
  buildings: BuildingType[];
  saldoValuta: number | null;
  costiValuta: Record<string, number>;
  sblocchi: { mondo: string | null; stato: StatoSblocchi };
  placements: Placement[];
  obstacles: Set<string>;
  expansions: Set<string>;
  importedExpansions: Set<string>;
  importedObstacleCells: Set<string>;
  baseline: Baseline;
  hasImportedCity: boolean;
  lastSolved: SolvedSnapshot;
  stats: { steps: number; time: number } | null;
  /** Modifiche a mano rispetto all'ultimo import al momento della foto. */
  modificato: boolean;
};

type PlannerInsediamentoProps = {
  uiLang: UiLang;
  /** (25/11/2026) Quale insediamento: stessa mappa e stessi comandi, cambia la
   *  configurazione (data/insediamenti.ts). Predefinito: Pirati. */
  insediamento?: IdInsediamento;
  /** 2.0: i comandi (Calcolo, Espansioni) stanno nel nastro: PlannerInsediamento
   *  consegna qui i suoi gruppi a ogni cambio di stato. */
  onNastro?: (gruppi: RibbonGroup[]) => void;
};

/** Edifici che vorrebbero la strada e non toccano una strada collegata all'Ambasciata
 *  (strade collegate = raggiungibili da quelle attaccate all'Ambasciata). */
/** (27/11/2026) Rupie all'ora di un edificio collegato. Le residenze hanno un solo tempo; i
 *  produttori della diplomazia ne hanno sei: si conta quello da 5 ore (`ORE_RACCOLTA`), lo stesso
 *  ritmo della colonna Produzione dei tentativi ("/5h"). */
const ORE_RACCOLTA = 5;
/** (28/11/2026) Soglia scelta per l'ottimizzatore della diplomazia (Mughal). */
const CHIAVE_SOGLIA_DIPL = "foe2_mughal_soglia_diplomazia";
function rupieOraDi(b: { currency?: { prod?: Array<[number, number]> } } | undefined): number {
  const prod = b?.currency?.prod;
  if (!prod?.length) return 0;
  const p = prod.find(([, sec]) => sec === ORE_RACCOLTA * 3600) ?? prod[0]!;
  return p[0] / (p[1] / 3600);
}

function nonCollegati(placements: Placement[], opt: { strada: string; senzaStrada: string[] } | undefined): Set<Placement> {
  const out = new Set<Placement>();
  if (!opt) return out;
  const amb = placements.find((p) => p.buildingId === ID_MUNICIPIO);
  if (!amb) return out;
  const strade = new Set(placements.filter((p) => p.buildingId === opt.strada).map((p) => p.row + ":" + p.col));
  const tocca = (r: number, c: number, x: Placement) => r >= x.row - 1 && r <= x.row + x.h && c >= x.col - 1 && c <= x.col + x.w &&
    !(r >= x.row && r < x.row + x.h && c >= x.col && c < x.col + x.w) && (r === x.row - 1 || r === x.row + x.h ? c >= x.col && c < x.col + x.w : r >= x.row && r < x.row + x.h);
  const collegate = new Set<string>();
  const coda: Array<[number, number]> = [];
  for (const k of strade) { const [r, c] = k.split(":").map(Number) as [number, number]; if (tocca(r, c, amb)) { collegate.add(k); coda.push([r, c]); } }
  while (coda.length) {
    const [r, c] = coda.pop()!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const k = (r + dr) + ":" + (c + dc);
      if (strade.has(k) && !collegate.has(k)) { collegate.add(k); coda.push([r + dr, c + dc]); }
    }
  }
  for (const p of placements) {
    if (p.buildingId === ID_MUNICIPIO || p.buildingId === opt.strada || opt.senzaStrada.includes(p.buildingId)) continue;
    let ok = false;
    for (const k of collegate) { const [r, c] = k.split(":").map(Number) as [number, number]; if (tocca(r, c, p)) { ok = true; break; } }
    if (!ok) out.add(p);
  }
  return out;
}

const PlannerInsediamento = forwardRef<PlannerInsediamentoHandle, PlannerInsediamentoProps>(function PlannerInsediamento({ uiLang, onNastro, insediamento = "pirati" }, ref) {
  // configurazione dell'insediamento: stessi nomi delle costanti dei Pirati di prima,
  // così il resto del componente non cambia
  const cfg = INSEDIAMENTI[insediamento];
  const MUNICIPIO = cfg.municipio;
  const MUNICIPIO_INITIAL_PLACEMENT = cfg.municipioIniziale;
  const INITIAL_BUILDINGS = cfg.edifici;
  const INITIAL_PLACEMENTS: Placement[] = [{ buildingId: ID_MUNICIPIO, row: MUNICIPIO_INITIAL_PLACEMENT.row, col: MUNICIPIO_INITIAL_PLACEMENT.col, w: MUNICIPIO.width, h: MUNICIPIO.height }];
  const ALLOWED_BLOCK_KEYS = cfg.blocchiPermessi;
  const ALLOWED_BLOCK_SET = useMemo(() => new Set(cfg.blocchiPermessi), [cfg]);
  const BASE_BLOCK_ROWS = cfg.baseRighe;
  const BASE_BLOCK_COLS = cfg.baseColonne;
  const buildUnlockedBlockSet = useCallback((e: Set<string>) => buildUnlockedBlockSetDa(e, cfg.baseBlocchi), [cfg]);
  const isRemovableExpansion = useCallback((e: Set<string>, k: string) => isRemovableExpansionDa(e, k, cfg.baseBlocchi), [cfg]);
  const [buildings, setBuildings] = useState<BuildingType[]>(INITIAL_BUILDINGS);
  // (25/11/2026) valuta dell'insediamento (Mughal: Rupie): saldo dall'import e prezzi per edificio
  const [saldoValuta, setSaldoValuta] = useState<number | null>(cfg.valuta?.iniziale ?? null);
  const [costiValuta, setCostiValuta] = useState<Record<string, number>>(() =>
    Object.fromEntries(cfg.edifici.filter((b) => b.currency?.cost).map((b) => [b.id, b.currency!.cost!])));
  // (25/11/2026) sblocchi degli edifici (solo se cfg.sblocchi): caselle della legenda, salvate
  // per mondo; prima di un import si mostra l'ultimo mondo usato
  const [sblocchi, setSblocchi] = useState<{ mondo: string | null; stato: StatoSblocchi }>(() => {
    const c = cfg.sblocchi ? caricaSblocchi(cfg.id) : { mondo: null, stato: null };
    return { mondo: c.mondo, stato: c.stato ?? { sbloccati: [] } };
  });
  const sbloccato = (cityentityId: string | undefined) =>
    !cfg.sblocchi || !cityentityId || cfg.sblocchi.partenza.includes(cityentityId) || sblocchi.stato.sbloccati.includes(cityentityId);
  const cambiaSblocco = (cityentityId: string, si: boolean) => {
    setSblocchi((prec) => {
      const s = new Set(prec.stato.sbloccati);
      if (si) s.add(cityentityId); else s.delete(cityentityId);
      const stato = { ...prec.stato, sbloccati: [...s].sort() };
      salvaSblocchi(cfg.id, prec.mondo, stato);
      return { mondo: prec.mondo, stato };
    });
  };
  const [placements, setPlacements] = useState<Placement[]>(INITIAL_PLACEMENTS);
  const [obstacles, setObstacles] = useState<Set<string>>(new Set());
  const [expansions, setExpansions] = useState<Set<string>>(new Set());
  // Espansioni provenienti da un import: non rimovibili con "Rimuovi EXP" (non
  // rispecchierebbe più lo stato reale della città), a differenza di quelle manuali.
  const [importedExpansions, setImportedExpansions] = useState<Set<string>>(new Set());
  // Registro permanente degli ostacoli dell'ultimo import, mai ripulito: serve a
  // mostrare l'anteprima anche su un blocco richiuso. `obstacles` è invece lo stato
  // vivo ed editabile, e viene ripulito dai blocchi rimossi per non lasciare orfani.
  const [importedObstacleCells, setImportedObstacleCells] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState<EditMode>("obstacle");
  const [isSolving, setIsSolving] = useState(false);
  // AUTO: toggle persistente (non salvato, riparte sempre spento). Attivo, un
  // '+' su un edificio che non trova subito posto lancia Risolvi da solo; se
  // anche Risolvi fallisce, quell'edificio viene tolto (vedi updateCount).
  const [autoMode, setAutoMode] = useState(false);
  // Niente stato "failed": da quando lastSolvedRef non è mai vuoto (vedi sotto),
  // un fallimento del solver ripristina SEMPRE l'ultima disposizione valida e
  // torna quindi a "success", spiegando l'accaduto con un toast temporaneo
  // invece che con uno stato persistente di errore.
  const [status, setStatus] = useState<"idle" | "solving" | "success" | "interrupted">("success");
  // `null` finché non è stata eseguita almeno una ricerca in questa sessione:
  // la pillola passi/tempo non ha senso prima (mostrava "0 passi · 0ms" al primo
  // caricamento) né dopo un import/Undo/Reset, dove resterebbero i numeri di una
  // ricerca precedente, riferiti a una disposizione che non è più quella a schermo.
  const [stats, setStats] = useState<{ steps: number; time: number } | null>(null);
  const [draggedPlacement, setDraggedPlacement] = useState<Placement | null>(null);
  const [dragOffset, setDragOffset] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [dragTargetCell, setDragTargetCell] = useState<{ row: number; col: number } | null>(null);
  // Toast temporaneo per l'esito dell'import via bacchetta magica (non c'è un
  // pannello dedicato: appare vicino al pulsante e sparisce da solo, vedi
  // l'useEffect subito sotto la dichiarazione di questo state).
  const [importMessage, setImportMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Stato a cui torna il Reset: inizialmente lo stato vuoto di partenza, poi aggiornato
  // a ogni import riuscito (vedi runImport) così Reset riporta ai dati importati
  // invece che cancellarli.
  const [baseline, setBaseline] = useState<Baseline>({
    buildings: INITIAL_BUILDINGS,
    placements: INITIAL_PLACEMENTS,
    obstacles: new Set(),
    expansions: new Set(),
    importedExpansions: new Set(),
    importedObstacleCells: new Set(),
  });

  // true dopo un import riuscito, false all'inizio e dopo aver premuto Reset:
  // pilota solo lo stile/abilitazione del pulsante Reset (stesso schema del
  // cestino "elimina tutti i profili" nell'header: rosso scuro e disabilitato
  // quando non c'è niente da cancellare, rosso più chiaro e abilitato quando
  // c'è un import da cui tornare indietro).
  const [hasImportedCity, setHasImportedCity] = useState(false);
  // mondo (server) dell'ultimo import: un planner per mondo, vedi FotoPlanner
  const [mondo, setMondo] = useState<string | null>(null);
  // (25/11/2026) ottimizzatore della disposizione (solo se cfg.ottimizzatore): tentativi, uno
  // per numero di strade; quello mostrato sulla mappa; ricerca in corso e secondi passati
  const [tentativi, setTentativi] = useState<Tentativo[]>([]);
  const [tentativoScelto, setTentativoScelto] = useState<number | null>(null);
  const [ottimizzando, setOttimizzando] = useState(false);
  const [secondiOtt, setSecondiOtt] = useState(0);
  const [partenzaOtt, setPartenzaOtt] = useState<{ strade: number; collegate: number; rupieOra: number; perTipo: Record<string, number> } | null>(null);
  // "Continua" (26/11/2026): ricerca senza limite di tempo che riparte dai tentativi trovati;
  // vale solo se la richiesta (area, manifatture, residenze) è la stessa dell'ultima ricerca
  const [ottInfinito, setOttInfinito] = useState(false);
  // X del riquadro Tentativi (26/11/2026): lo nasconde (e ferma la ricerca); i tentativi restano
  // per Continua, e il riquadro torna con Ottimizza o Continua
  const [tentativiChiusi, setTentativiChiusi] = useState(false);
  const ultimaRichiestaRef = useRef<{ req: RichiestaOttimizzatore; firma: string } | null>(null);
  const lavoratoriRef = useRef<Worker[]>([]);
  // (28/11/2026) Ottimizzatore della diplomazia (Mughal): soglia scelta (salvata), quale dei due
  // ottimizzatori sta girando o ha riempito il riquadro, i suoi tentativi (uno per numero di
  // Haveli e Shanti tolti) e la partenza (la mappa quando si è premuto il pulsante)
  const [sogliaDipl, setSogliaDipl] = useState<number>(() => {
    try { const n = Number(localStorage.getItem(CHIAVE_SOGLIA_DIPL)); return SOGLIE_DIPLOMAZIA.includes(n) ? n : SOGLIE_DIPLOMAZIA[4]!; } catch { return SOGLIE_DIPLOMAZIA[4]!; }
  });
  const [modoOtt, setModoOtt] = useState<"produzione" | "diplomazia">("produzione");
  const [tentativiDipl, setTentativiDipl] = useState<TentativoDipl[]>([]);
  const [sceltoDipl, setSceltoDipl] = useState<string | null>(null);
  const [partenzaDipl, setPartenzaDipl] = useState<{ perTipo: Record<string, number>; diplomazia: number; soglia: number } | null>(null);

  // Ultima disposizione "risolta" nota (indipendente dalla baseline, che
  // cambia solo con import/Reset/Undo, anche se le due coincidono sempre
  // subito dopo uno di quei tre eventi): aggiornata a ogni successo del
  // solver O quando una modifica manuale (+/-) produce comunque un layout
  // valido, usata per riportare buildings+placements allo stato coerente
  // precedente quando un Risolvi successivo NON trova soluzione — altrimenti
  // la mappa resterebbe quella vecchia ma i conteggi edifici (già modificati
  // dall'utente prima di premere Risolvi) risulterebbero disallineati dalla
  // disposizione mostrata a schermo. Mai null dopo il mount: lo stato vuoto
  // iniziale è "risolto" per definizione (nessun edificio da piazzare oltre
  // al municipio), stesso principio dell'import/Reset/Undo più sotto.
  // ⚠️ Vive nello stesso spazio StorageCell di placements: ogni volta che la
  // griglia cambia (ancora traslata da addExpansion/removeExpansion, blocco
  // richiuso, nuovo ostacolo) va aggiornato anche lui, altrimenti il prossimo
  // ripristino rimette edifici sfalsati o su celle non più utilizzabili (bug
  // corretto settembre 2026: dopo un'espansione a sinistra, un Risolvi fallito o
  // fermato rimetteva tutto un blocco più a sinistra, su aree non sbloccate).
  const lastSolvedRef = useRef<SolvedSnapshot>({
    buildings: INITIAL_BUILDINGS.map((b) => ({ ...b })),
    placements: INITIAL_PLACEMENTS.map((p) => ({ ...p })),
  });

  const stopSolvingRef = useRef(false);
  // true quando la ricerca si è fermata da sola per aver superato il tempo
  // massimo (vedi SOLVE_TIME_LIMIT_MS), non perché l'utente ha premuto Stop:
  // serve a distinguere i due casi nel messaggio mostrato all'utente.
  const timedOutRef = useRef(false);
  const suppressClickAfterDragRef = useRef(false);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [displaySteps, setDisplaySteps] = useState(0);

  // Misurato via ResizeObserver perché il solo CSS non basta: con max-width +
  // max-height + aspect-ratio il browser clampa solo l'altezza e deforma le celle
  // invece di ricalcolare la larghezza. Con le dimensioni reali del wrapper
  // calcoliamo esplicitamente il lato che rispetta entrambi i vincoli.
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const [gridWrapperSize, setGridWrapperSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = gridWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      // ⚠️ Ignora misurazioni 0×0: ResizeObserver.observe() invoca il
      // callback SUBITO con le dimensioni correnti al momento della
      // chiamata — se il wrapper è dentro un antenato "hidden" (App.tsx
      // nasconde questo componente con display:none sulle tab diverse da
      // "pirati", vedi il div che avvolge <PlannerInsediamento>) al primo mount,
      // quella prima invocazione riporta 0×0. Senza questo guard,
      // gridWrapperSize passava da null a {0,0}, disattivando il fallback
      // CSS (attivo solo quando gridWrapperSize === null, vedi sotto) e
      // facendo collassare il planner a dimensione zero — bug segnalato
      // dall'utente su mobile: aprendo la tab Pirati in verticale il
      // planner non appariva affatto. Un vero resize successivo (rotazione
      // schermo, o — dopo il fix qui sotto — semplicemente il layout che si
      // stabilizza) sostituisce comunque questa misurazione con una reale.
      if (width === 0 || height === 0) return;
      setGridWrapperSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const unlockedBlocks = useMemo(() => buildUnlockedBlockSet(expansions), [expansions, buildUnlockedBlockSet]);
  const unlockedBlockPositions = useMemo(() => Array.from(unlockedBlocks).map(parseBlockKey), [unlockedBlocks]);

  const candidateExpansionBlocks = useMemo(() => {
    return ALLOWED_BLOCK_KEYS.map(parseBlockKey).filter(({ row, col }) => {
      const key = blockKey(row, col);
      if (unlockedBlocks.has(key)) return false;
      return DIRECTIONS.some((direction) => unlockedBlocks.has(blockKey(row + direction.row, col + direction.col)));
    });
  }, [unlockedBlocks, ALLOWED_BLOCK_KEYS]);

  const displayBlockPositions = editMode === "add-expansion"
    ? [...unlockedBlockPositions, ...candidateExpansionBlocks]
    : unlockedBlockPositions;

  const minUnlockedBlockRow = Math.min(...unlockedBlockPositions.map((block) => block.row));
  const minUnlockedBlockCol = Math.min(...unlockedBlockPositions.map((block) => block.col));
  const minDisplayBlockRow = Math.min(...displayBlockPositions.map((block) => block.row));
  const minDisplayBlockCol = Math.min(...displayBlockPositions.map((block) => block.col));
  const maxDisplayBlockRow = Math.max(...displayBlockPositions.map((block) => block.row));
  const maxDisplayBlockCol = Math.max(...displayBlockPositions.map((block) => block.col));

  const displayBlockRows = Math.max(BASE_BLOCK_ROWS, maxDisplayBlockRow - minDisplayBlockRow + 1);
  const displayBlockCols = Math.max(BASE_BLOCK_COLS, maxDisplayBlockCol - minDisplayBlockCol + 1);

  const gridRows = displayBlockRows * BLOCK_SIZE;
  const gridCols = displayBlockCols * BLOCK_SIZE;

  const gridMask = useMemo(
    () =>
      Array.from({ length: gridRows }, (_, row) =>
        Array.from({ length: gridCols }, (_, col) =>
          unlockedBlocks.has(blockKey(minDisplayBlockRow + Math.floor(row / BLOCK_SIZE), minDisplayBlockCol + Math.floor(col / BLOCK_SIZE)))
        )
      ),
    [gridRows, gridCols, minDisplayBlockRow, minDisplayBlockCol, unlockedBlocks]
  );

  const canAddExpansion = (blockRow: number, blockCol: number) => {
    const key = blockKey(blockRow, blockCol);
    if (!ALLOWED_BLOCK_SET.has(key)) return false;
    if (unlockedBlocks.has(key)) return false;

    // Un'espansione e sbloccabile se tocca lateralmente una qualsiasi area gia posseduta.
    // Questo vale in tutte e 4 le direzioni, non solo destra/basso.
    return DIRECTIONS.some((direction) => unlockedBlocks.has(blockKey(blockRow + direction.row, blockCol + direction.col)));
  };

  // Blocchi (chiavi assolute) coperti dal Municipio nella sua posizione attuale.
  // Un'espansione che lo contiene non è rimovibile: il Municipio non si toglie
  // dalla mappa né si sposta da solo (a differenza degli altri edifici, vedi
  // layoutAfterBlockRemoval), e prima restava disegnato sopra un'area non più
  // sbloccata (bug corretto settembre 2026).
  const municipioBlockKeys = useMemo(() => {
    const keys = new Set<string>();
    const municipio = placements.find((placement) => placement.buildingId === MUNICIPIO.id);
    if (!municipio) return keys;
    for (let dr = 0; dr < municipio.h; dr++) {
      for (let dc = 0; dc < municipio.w; dc++) {
        keys.add(blockKey(
          minUnlockedBlockRow + Math.floor((municipio.row + dr) / BLOCK_SIZE),
          minUnlockedBlockCol + Math.floor((municipio.col + dc) / BLOCK_SIZE),
        ));
      }
    }
    return keys;
  }, [placements, minUnlockedBlockRow, minUnlockedBlockCol, MUNICIPIO.id]);

  const removableExpansionKeys = useMemo(() => {
    const removable = new Set<string>();
    expansions.forEach((key) => {
      // Le espansioni importate riflettono lo stato reale della città in game: non
      // devono essere rimovibili dal tool, altrimenti si andrebbe fuori sincro.
      if (importedExpansions.has(key)) return;
      if (municipioBlockKeys.has(key)) return;
      if (isRemovableExpansion(expansions, key)) {
        removable.add(key);
      }
    });
    return removable;
  }, [expansions, importedExpansions, municipioBlockKeys, isRemovableExpansion]);

  const nonRemovableExpansionKeys = useMemo(() => {
    const blocked = new Set<string>();
    expansions.forEach((key) => {
      if (!removableExpansionKeys.has(key)) blocked.add(key);
    });
    return blocked;
  }, [expansions, removableExpansionKeys]);

  // Gating unico per ogni interazione che legge/scrive obstacles o placements in
  // coordinate storage: fuori da 'obstacle' le due ancore differiscono (vedi
  // StorageCell/DisplayCell) e quelle coordinate non sono valide. Centralizzato
  // apposta: sparso per i vari punti di interazione era facile dimenticarlo.
  const canEditGrid = editMode === "obstacle" && !isSolving;

  // Gli ostacoli rappresentano gli Impediment reali della città, popolati
  // dall'import: dopo un import ha senso poterli solo rimuovere (mai
  // aggiungerne di "finti" a mano, andrebbero fuori sincro con la città
  // vera). Prima di un import invece non c'è nessun dato reale da
  // rispettare, quindi l'utente può marcare/smarcare liberamente celle
  // come ostacolo per pianificare a mano (vedi toggleObstacle sotto).
  const removeObstacle = (row: number, col: number) => {
    if (!canEditGrid || !gridMask[row]?.[col]) return;

    setObstacles((previous) => {
      const key = cellKey(storageCell(row, col));
      if (!previous.has(key)) return previous;
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
  };

  // Solo nello stato di default (nessun import): aggiunge o rimuove un
  // ostacolo su una cella libera, per permettere di pianificare a mano prima
  // di importare l'insediamento reale. Una cella occupata da un edificio già
  // piazzato (incluso il Municipio) non può diventare ostacolo.
  const toggleObstacle = (row: number, col: number) => {
    if (!canEditGrid || hasImportedCity || !gridMask[row]?.[col]) return;

    const storage = storageCell(row, col);
    const coversCell = (placement: Placement) => (
      storage.row >= placement.row &&
      storage.row < placement.row + placement.h &&
      storage.col >= placement.col &&
      storage.col < placement.col + placement.w
    );
    if (placements.some(coversCell)) return;

    const key = cellKey(storage);
    const isAddingObstacle = !obstacles.has(key);
    setObstacles((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

    // Il nuovo ostacolo è libero nella disposizione a schermo, ma può cadere su
    // una cella usata dall'ultima soluzione valida quando le due non coincidono
    // (es. edificio eliminato o spostato mentre lo stato era "idle"): senza
    // questo, il prossimo ripristino rimetterebbe un edificio sopra l'ostacolo.
    // Se a perdersi fosse il Municipio si ripiega sullo stato a schermo, che
    // l'ostacolo per costruzione non tocca.
    if (isAddingObstacle) {
      lastSolvedRef.current = withoutLostPlacements(lastSolvedRef.current, coversCell) ?? {
        buildings: buildings.map((building) => ({ ...building })),
        placements,
      };
    }
  };

  const addExpansion = (blockRow: number, blockCol: number) => {
    if (isSolving || !canAddExpansion(blockRow, blockCol)) return;

    const nextExpansions = new Set(expansions);
    nextExpansions.add(blockKey(blockRow, blockCol));
    const nextUnlockedBlocks = buildUnlockedBlockSet(nextExpansions);
    const nextUnlockedPositions = Array.from(nextUnlockedBlocks).map(parseBlockKey);
    const nextMinRow = Math.min(...nextUnlockedPositions.map((block) => block.row));
    const nextMinCol = Math.min(...nextUnlockedPositions.map((block) => block.col));
    const rowDelta = (minUnlockedBlockRow - nextMinRow) * BLOCK_SIZE;
    const colDelta = (minUnlockedBlockCol - nextMinCol) * BLOCK_SIZE;

    if (rowDelta !== 0 || colDelta !== 0) {
      setPlacements((previous) => shiftPlacements(previous, rowDelta, colDelta));
      // Stesso spazio storage di placements (vedi lastSolvedRef): va traslato insieme.
      lastSolvedRef.current = {
        buildings: lastSolvedRef.current.buildings,
        placements: shiftPlacements(lastSolvedRef.current.placements, rowDelta, colDelta),
      };
    }
    // Ripristina gli ostacoli importati per il blocco appena sbloccato (nel caso fossero
    // stati ripuliti da una precedente removeExpansion su questo stesso blocco), poi
    // applica lo shift di coordinate se il blocco minimo sbloccato è cambiato.
    setObstacles((previous) => {
      const merged = new Set(previous);
      for (let subRow = 0; subRow < BLOCK_SIZE; subRow++) {
        for (let subCol = 0; subCol < BLOCK_SIZE; subCol++) {
          const storageRow = (blockRow - minUnlockedBlockRow) * BLOCK_SIZE + subRow;
          const storageCol = (blockCol - minUnlockedBlockCol) * BLOCK_SIZE + subCol;
          const key = cellKey(storageCell(storageRow, storageCol));
          if (importedObstacleCells.has(key)) merged.add(key);
        }
      }
      if (rowDelta === 0 && colDelta === 0) return merged;
      const shifted = new Set<string>();
      merged.forEach((key) => {
        const { row, col } = parseCellKey(key);
        shifted.add(cellKey(storageCell(row + rowDelta, col + colDelta)));
      });
      return shifted;
    });
    // Il registro permanente è nello stesso sistema di coordinate locali di `obstacles`:
    // va shiftato allo stesso modo, altrimenti l'anteprima nei blocchi candidati andrebbe
    // fuori sincro dopo che il blocco minimo sbloccato cambia.
    if (rowDelta !== 0 || colDelta !== 0) {
      setImportedObstacleCells((previous) => {
        const shifted = new Set<string>();
        previous.forEach((key) => {
          const { row, col } = parseCellKey(key);
          shifted.add(cellKey(storageCell(row + rowDelta, col + colDelta)));
        });
        return shifted;
      });
    }

    setExpansions(nextExpansions);
    setEditMode("obstacle");
  };

  const removeExpansion = (blockRow: number, blockCol: number) => {
    if (isSolving) return;

    const key = blockKey(blockRow, blockCol);
    if (!removableExpansionKeys.has(key)) return;

    const removedRowStart = (blockRow - minUnlockedBlockRow) * BLOCK_SIZE;
    const removedRowEnd = removedRowStart + BLOCK_SIZE;
    const removedColStart = (blockCol - minUnlockedBlockCol) * BLOCK_SIZE;
    const removedColEnd = removedColStart + BLOCK_SIZE;
    const isCellInRemovedBlock = (row: number, col: number) =>
      row >= removedRowStart && row < removedRowEnd && col >= removedColStart && col < removedColEnd;
    const overlapsRemovedBlock = (placement: Placement) => (
      placement.row < removedRowEnd &&
      placement.row + placement.h > removedRowStart &&
      placement.col < removedColEnd &&
      placement.col + placement.w > removedColStart
    );

    const nextExpansions = new Set(expansions);
    nextExpansions.delete(key);
    const nextUnlockedBlocks = buildUnlockedBlockSet(nextExpansions);
    const nextUnlockedPositions = Array.from(nextUnlockedBlocks).map(parseBlockKey);
    const nextMinRow = Math.min(...nextUnlockedPositions.map((block) => block.row));
    const nextMinCol = Math.min(...nextUnlockedPositions.map((block) => block.col));
    const rowDelta = (minUnlockedBlockRow - nextMinRow) * BLOCK_SIZE;
    const colDelta = (minUnlockedBlockCol - nextMinCol) * BLOCK_SIZE;

    // Solo gli edifici che toccano il blocco richiuso si spostano (in uno spazio
    // libero, o fuori dalla mappa se non c'è posto): vedi layoutAfterBlockRemoval.
    // Mai il Municipio: il blocco che lo contiene non è rimovibile (municipioBlockKeys).
    const { placements: nextPlacements, displaced, unplaced } = layoutAfterBlockRemoval({
      placements,
      obstacles,
      removedRowStart,
      removedColStart,
      nextUnlockedBlocks,
      nextMinRow,
      nextMinCol,
      rowDelta,
      colDelta,
    });

    // Ultima soluzione valida (vedi lastSolvedRef). Se gli edifici spostati hanno
    // trovato tutti posto e la disposizione risultante è completa, diventa lei la
    // nuova ultima soluzione valida. Altrimenti si tiene la precedente, tolti i
    // piazzamenti che cadevano nel blocco richiuso (conteggi scalati) e traslata
    // come placements; se tra quelli persi ci fosse il Municipio (solo se spostato a
    // mano dopo l'ultima soluzione valida) si ripiega sullo stato a schermo dopo la
    // rimozione, che per costruzione non usa il blocco richiuso.
    if (displaced > 0 && layoutStatus(buildings, nextPlacements) === "success") {
      lastSolvedRef.current = { buildings: buildings.map((building) => ({ ...building })), placements: nextPlacements };
    } else {
      const survivingLastSolved = withoutLostPlacements(lastSolvedRef.current, overlapsRemovedBlock);
      lastSolvedRef.current = survivingLastSolved
        ? { buildings: survivingLastSolved.buildings, placements: shiftPlacements(survivingLastSolved.placements, rowDelta, colDelta) }
        : { buildings: buildings.map((building) => ({ ...building })), placements: nextPlacements };
    }

    setExpansions(nextExpansions);
    setObstacles((previous) => {
      // Le celle del blocco richiuso tornano esattamente agli ostacoli dell'import
      // (registro importedObstacleCells): via quelli aggiunti a mano, di nuovo presenti
      // quelli importati eventualmente rimossi a mano. Gli ostacoli fuori dal blocco
      // (es. anteprime in altri blocchi candidati) restano intatti. Simmetrico ad
      // addExpansion, che alla riapertura ripristina gli stessi ostacoli importati:
      // aggiungere e poi rimuovere la stessa espansione riporta `obstacles` identico a
      // prima (bug corretto settembre 2026: prima venivano cancellati anche gli
      // ostacoli importati, che la baseline contiene, e Undo restava abilitato senza
      // alcuna differenza visibile).
      const next = new Set<string>();
      previous.forEach((obstacleKey) => {
        const { row, col } = parseCellKey(obstacleKey);
        if (!isCellInRemovedBlock(row, col)) next.add(obstacleKey);
      });
      importedObstacleCells.forEach((obstacleKey) => {
        const { row, col } = parseCellKey(obstacleKey);
        if (isCellInRemovedBlock(row, col)) next.add(obstacleKey);
      });
      if (rowDelta === 0 && colDelta === 0) return next;
      const shifted = new Set<string>();
      next.forEach((obstacleKey) => {
        const { row, col } = parseCellKey(obstacleKey);
        shifted.add(cellKey(storageCell(row + rowDelta, col + colDelta)));
      });
      return shifted;
    });
    if (displaced > 0 || rowDelta !== 0 || colDelta !== 0) {
      setPlacements(nextPlacements);
    }
    if (rowDelta !== 0 || colDelta !== 0) {
      // Il registro permanente non va mai ripulito dal blocco rimosso (deve restare
      // disponibile per l'anteprima), ma va comunque shiftato insieme al resto quando
      // cambia il blocco minimo sbloccato, per restare nello stesso sistema di coordinate.
      setImportedObstacleCells((previous) => {
        const shifted = new Set<string>();
        previous.forEach((obstacleKey) => {
          const { row, col } = parseCellKey(obstacleKey);
          shifted.add(cellKey(storageCell(row + rowDelta, col + colDelta)));
        });
        return shifted;
      });
    }
    if (displaced > 0) {
      // "idle" se qualcuno è rimasto fuori dalla mappa (Risolvi abilitato per
      // ridisporlo), altrimenti lo stato che la disposizione aveva già. Il toast
      // spiega perché un edificio si è spostato o è sparito dalla mappa.
      setStatus(layoutStatus(buildings, nextPlacements));
      setImportMessage(
        unplaced > 0
          ? { kind: "error", text: t("piratiExpansionRemovedUnplaced", uiLang, unplaced) }
          : { kind: "success", text: t("piratiExpansionRemovedRelocated", uiLang, displaced) }
      );
    }
    setEditMode("obstacle");
  };

  // Import dati: chiamato da App.tsx tramite l'handle imperativo esposto
  // sotto (useImperativeHandle), quando l'utente clicca la bacchetta magica
  // dell'header globale mentre si trova sulla tab Pirati. Non c'è più un
  // pulsante bacchetta dentro PlannerInsediamento stesso — un solo pulsante nell'app,
  // che qui riceve solo il testo già letto dagli appunti dal chiamante.
  const runImport = (rawText: string): { kind: "success" | "error"; text: string } => {
    // Guard critico: runImport è raggiungibile dalla bacchetta magica nell'header
    // globale (App.tsx), che non sa nulla dello stato isSolving interno a questo
    // componente. Senza questo controllo, un import durante una ricerca in corso
    // sovrascriverebbe buildings/placements/obstacles mentre solve() sta ancora
    // lavorando su uno snapshot precedente catturato nella sua closure — al termine
    // della ricerca, il risultato (calcolato su dati ormai superati) sovrascriverebbe
    // di nuovo lo stato, vanificando l'import appena fatto in modo silenzioso.
    if (isSolving) {
      const message = { kind: "error" as const, text: t("piratiImportBlockedWhileSolving", uiLang) };
      setImportMessage(message);
      return message;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawText);
    } catch {
      const message = { kind: "error" as const, text: t("piratiImportInvalidJson", uiLang) };
      setImportMessage(message);
      return message;
    }

    // Dal bookmarklet v4 in poi il payload negli appunti è SEMPRE quello unificato
    // città/inventario (BookmarkletData): i dati Pirati, quando presenti, sono
    // annidati in payload.pirateOutpost (vedi commento v4 in bookmarklet.ts — prima
    // catturava SOLO l'uno o l'altro con un `return` anticipato, rompendo l'import
    // città quando ci si trovava sull'Insediamento). Estraiamo quel blocco prima di
    // validarlo come BookmarkletPirateOutpostData.
    const isObjectPayload = !!payload && typeof payload === "object" && !Array.isArray(payload);
    const pirateOutpostPayload = isObjectPayload
      ? (payload as Record<string, unknown>).pirateOutpost
      : undefined;

    if (!validateBookmarkletPirateOutpostData(pirateOutpostPayload)) {
      // Tre casi distinti, nell'ordine in cui vanno controllati:
      // 1. Bacchetta PRECEDENTE alla v4 (`_v` assente o < CURRENT_BOOKMARKLET_VERSION,
      //    vedi isLegacyBookmarkletPayload): v3 "pura" (payload città senza alcun
      //    supporto Pirati) o v3.1 cliccata sull'Insediamento ({areas, entities} in
      //    cima, senza `_v`). Non avrà mai pirateOutpost: l'unica azione utile è
      //    ricreare la bacchetta.
      // 2. Payload v4+ senza pirateOutpost: l'Insediamento non è ancora in memoria in
      //    questa sessione di gioco, o la bacchetta è stata usata in visita da un altro
      //    giocatore (V, pirateOutpost mai catturato in quel caso). Non è "bacchetta
      //    vecchia": dirlo sarebbe fuorviante, l'azione giusta è visitare il proprio
      //    Insediamento e riprovare.
      // 3. pirateOutpost presente ma malformato, o JSON che non è un oggetto — generico.
      // ⚠️ Il caso 1 si riconosce da `_v`, non dalla forma: dalla v4 OGNI payload è un
      // payload città, e il vecchio controllo solo-forma dava "bacchetta vecchia" anche
      // nei casi 2 e 3, e "visita l'Insediamento" alla v3.1 (bug corretto settembre 2026).
      const text = isLegacyBookmarkletPayload(payload)
        ? t("piratiImportOutdatedBookmarklet", uiLang)
        : isObjectPayload && pirateOutpostPayload === undefined
          ? (() => {
              // v5: lo script segnala 'outpost' quando l'helper non espone
              // proprio l'oggetto dell'Insediamento (struttura cambiata dopo un
              // suo aggiornamento): "visitalo" non servirebbe a nulla.
              const diag = readPayloadDiagnostics(payload);
              if (diag.warnings.includes("outpost")) {
                const helper = [diag.helperName, diag.helperVersion].filter(Boolean).join(" ") || "?";
                return t(cfg.testi.helperNonSupportato, uiLang, helper);
              }
              return t(cfg.testi.visitaPrima, uiLang);
            })()
          : t("piratiImportInvalidStructure", uiLang);
      const message = { kind: "error" as const, text };
      setImportMessage(message);
      return message;
    }

    const known = new Map<string, string>();
    buildings.forEach((building) => {
      if (building.cityentityId) known.set(building.cityentityId, building.id);
    });

    let result;
    try {
      result = importCulturalOutpostPayload(pirateOutpostPayload, known, cfg.importa);
    } catch (error) {
      let text: string;
      if (error instanceof ImportCulturalOutpostFailure) {
        // NO_AREAS in pratica significa quasi sempre "non hai mai visitato
        // l'Insediamento in questa sessione": CityMap.CulturalOutpost può esistere
        // come oggetto (bookmarklet.ts lo cattura comunque, vedi commento v4) ma con
        // `areas: []` finché non lo si apre almeno una volta — un Insediamento
        // davvero visitato ha sempre almeno i 5 blocchi base sbloccati. Stesso
        // messaggio del caso "pirateOutpost assente del tutto" (validazione sopra),
        // invece del generico "il payload non contiene aree sbloccate".
        text = error.detail.code === "OUTDATED_BOOKMARKLET"
          ? t("piratiImportOutdatedBookmarklet", uiLang)
          : error.detail.code === "NO_AREAS"
            ? t(cfg.testi.visitaPrima, uiLang)
            : error.detail.code === "UNSUPPORTED_FACTION"
              ? t("piratiImportUnsupportedFaction", uiLang, error.detail.faction)
              : t(cfg.testi.nessunMunicipio, uiLang);
      } else {
        text = t("piratiImportUnknownError", uiLang);
      }
      const message = { kind: "error" as const, text };
      setImportMessage(message);
      return message;
    }

    // Espansioni: unione dei blocchi extra trovati (i 5 di base sono sempre impliciti).
    const nextExpansions = new Set<string>(result.expansionBlocks.map((b) => blockKey(b.row, b.col)));

    // Ostacoli: celle segnalate dagli Impediment.
    const nextObstacles = new Set<string>(result.obstacleCells.map((c) => cellKey(storageCell(c.row, c.col))));

    // Municipio: usa la posizione reale se presente nel payload, altrimenti quella di default.
    const townhallPlacement: Placement = result.townhall
      ? { buildingId: MUNICIPIO.id, row: result.townhall.row, col: result.townhall.col, w: MUNICIPIO.width, h: MUNICIPIO.height }
      : MUNICIPIO_INITIAL_PLACEMENT;

    // Edifici riconosciuti: un placement per istanza + conteggio per tipo.
    const counts = new Map<string, number>();
    const nextBuildingPlacements: Placement[] = result.buildings.map((b) => {
      const buildingId = known.get(b.cityentityId)!;
      counts.set(buildingId, (counts.get(buildingId) ?? 0) + 1);
      const type = buildings.find((building) => building.id === buildingId)!;
      return { buildingId, row: b.row, col: b.col, w: type.width, h: type.height };
    });

    // I nomi restano sempre quelli hardcodati in INITIAL_BUILDINGS/buildings: l'import
    // aggiorna solo i conteggi, non prova più a risolvere il nome reale dal gioco
    // (funzionalità rimossa su richiesta esplicita dell'utente per semplicità).
    const nextBuildings = buildings.map((building) => ({
      ...building,
      count: counts.get(building.id) ?? 0,
    }));
    const nextPlacements = [townhallPlacement, ...nextBuildingPlacements];

    setBuildings(nextBuildings);
    setExpansions(nextExpansions);
    setObstacles(nextObstacles);
    setPlacements(nextPlacements);
    setStatus("success");
    // Le statistiche dell'eventuale ricerca precedente si riferivano a un'altra
    // città: azzerate insieme al resto, la pillola passi/tempo sparisce finché
    // non viene lanciata una nuova ricerca su questi dati.
    setStats(null);
    // La griglia cambia completamente forma con l'import: se l'utente era in
    // "Aggiungi/Rimuovi EXP" quelle modalità non hanno più senso sui blocchi
    // appena importati. Stesso ritorno a 'obstacle' che fanno addExpansion e
    // removeExpansion al termine.
    setEditMode("obstacle");
    // Tutte le espansioni dopo un import sono considerate "reali" (sbloccate in game):
    // non devono poter essere rimosse con "Rimuovi EXP", altrimenti il tool andrebbe
    // fuori sincro con lo stato vero della città.
    setImportedExpansions(nextExpansions);
    // Registro permanente: non viene mai toccato da add/removeExpansion, così l'anteprima
    // ostacoli nei blocchi candidati resta corretta anche dopo sblocca+richiudi.
    setImportedObstacleCells(nextObstacles);

    // Il Reset deve tornare qui, non allo stato vuoto di partenza: da questo momento
    // "posizione iniziale" significa "subito dopo questo import".
    setBaseline({
      buildings: nextBuildings,
      placements: nextPlacements,
      obstacles: nextObstacles,
      expansions: nextExpansions,
      importedExpansions: nextExpansions,
      importedObstacleCells: nextObstacles,
    });
    // Un import riuscito è "risolto" per definizione (rispecchia la città
    // reale del giocatore): diventa subito l'ultima soluzione valida, così
    // anche un primissimo Risolvi fallito (prima di qualsiasi successo del
    // solver in questa sessione) ha comunque un posto coerente dove tornare,
    // invece di lasciare lo stato "failed" senza alcun ripristino possibile.
    lastSolvedRef.current = { buildings: nextBuildings.map((b) => ({ ...b })), placements: nextPlacements };
    setHasImportedCity(true);
    setTentativi([]);
    setTentativiDipl([]);
    setTentativoScelto(null);
    {
      const server = (payload as { server?: unknown }).server;
      const m = typeof server === "string" && /^[a-z]{2,4}[0-9]{1,3}$/.test(server) ? server : null;
      setMondo(m);
      // (28/11/2026) per Reset: si riparte da qui se il ponte non ha l'insediamento
      ultimoImportRef.current = { testo: rawText, mondo: m };
    }
    // valuta dell'insediamento: saldo dalle risorse della città, prezzi dalle definizioni del gioco
    if (cfg.valuta) {
      const v = cfg.valuta;
      const p = payload as { resources?: Record<string, unknown>; CityEntities?: Record<string, { requirements?: { cost?: { resources?: Record<string, unknown> } } }> };
      const saldo = p.resources?.[v.risorsa];
      setSaldoValuta(typeof saldo === "number" ? saldo : null);
      const costi: Record<string, number> = Object.fromEntries(INITIAL_BUILDINGS.filter((b) => b.currency?.cost).map((b) => [b.id, b.currency!.cost!]));
      for (const b of INITIAL_BUILDINGS) {
        const c = b.cityentityId ? p.CityEntities?.[b.cityentityId]?.requirements?.cost?.resources?.[v.risorsa] : undefined;
        if (typeof c === "number") costi[b.id] = c;
      }
      setCostiValuta(costi);
    }
    // sblocchi: dagli advancements del gioco se la bacchetta/il ponte li hanno portati,
    // altrimenti le caselle salvate; in ogni caso sbloccato ciò che è già sulla mappa
    if (cfg.sblocchi) {
      const p = payload as { server?: unknown };
      const mondo = typeof p.server === "string" && /^[a-z]{2,4}[0-9]{1,3}$/.test(p.server) ? p.server : null;
      const adv = leggiSblocchi((pirateOutpostPayload as { advancements?: unknown }).advancements, cfg.sblocchi.prefisso);
      const stato = statoDopoImport(caricaSblocchi(cfg.id, mondo).stato, adv, result.buildings.map((b) => b.cityentityId));
      salvaSblocchi(cfg.id, mondo, stato);
      setSblocchi({ mondo, stato });
    }

    const unrecognizedNote = result.unrecognizedCityentityIds.length > 0
      ? t("piratiImportUnrecognizedNote", uiLang, result.unrecognizedCityentityIds.length, result.unrecognizedCityentityIds.join(", "))
      : "";
    const message = {
      kind: "success" as const,
      text: t("piratiImportSuccess", uiLang, nextBuildingPlacements.length, result.obstacleCells.length, result.expansionBlocks.length) + unrecognizedNote,
    };
    setImportMessage(message);
    return message;
  };

  useImperativeHandle(ref, () => ({
    importFromClipboardText: (rawText: string) => runImport(rawText),
    haModifiche: () => hasChangesFromBaseline,
    mondo: () => mondo,
    occupato: () => isSolving || ottimizzando,
    fotografia: () => ({
      mondo, buildings, saldoValuta, costiValuta, sblocchi, placements, obstacles, expansions,
      importedExpansions, importedObstacleCells, baseline, hasImportedCity, lastSolved: lastSolvedRef.current, stats,
      modificato: hasChangesFromBaseline,
    }),
    ripristina: (f: FotoPlanner) => {
      setMondo(f.mondo);
      setBuildings(f.buildings);
      setSaldoValuta(f.saldoValuta);
      setCostiValuta(f.costiValuta);
      setSblocchi(f.sblocchi);
      setPlacements(f.placements);
      setObstacles(f.obstacles);
      setExpansions(f.expansions);
      setImportedExpansions(f.importedExpansions);
      setImportedObstacleCells(f.importedObstacleCells);
      setBaseline(f.baseline);
      setHasImportedCity(f.hasImportedCity);
      lastSolvedRef.current = f.lastSolved;
      setStats(f.stats);
      setStatus("success");
      setEditMode("obstacle");
      setImportMessage(null);
      setTentativi([]);
      setTentativiDipl([]);
      setTentativoScelto(null);
    },
  }));

  // Il toast di esito import sparisce da solo dopo qualche secondo, non
  // essendoci più un pannello con un pulsante "Annulla" da cliccare.
  useEffect(() => {
    if (!importMessage) return;
    const timeoutMs = importMessage.kind === "success" ? 5000 : 7000;
    const timer = setTimeout(() => setImportMessage(null), timeoutMs);
    return () => clearTimeout(timer);
  }, [importMessage]);

  // `buildingsOverride`: usato da AUTO in updateCount, che chiama solve() nello
  // stesso tick di un setBuildings(nextBuildings) — React non ha ancora applicato
  // quell'update, quindi la `buildings` catturata da questa closure sarebbe
  // ancora quella VECCHIA (senza l'edificio appena aggiunto). Passare
  // esplicitamente lo stato che il chiamante già conosce evita di risolvere sui
  // dati sbagliati invece di aspettare un re-render.
  const solve = useCallback(async (buildingsOverride?: BuildingType[]): Promise<boolean> => {
    if (isSolving) {
      // Questa chiamata è in realtà lo "Stop": stesso pulsante di Risolvi, che
      // durante una ricerca significa "fermati". Non è un fallimento.
      stopSolvingRef.current = true;
      return true;
    }

    setIsSolving(true);
    setStatus("solving");
    // `placements` NON va svuotato qui: la ricerca lavora su variabili locali, e
    // azzerarlo cancellerebbe la disposizione attuale anche quando poi non se ne
    // trova una migliore o si interrompe. Solo un successo la sostituisce.
    stopSolvingRef.current = false;
    timedOutRef.current = false;
    setDisplaySteps(0);

    // Riporta buildings+placements all'ultima disposizione valida nota (vedi
    // lastSolvedRef) e restituisce lo stato che le corrisponde: layoutStatus, MAI
    // "success" fisso. lastSolvedRef può contenere di proposito una disposizione
    // incompleta (ramo '−' di updateCount, piazzamenti persi con un blocco
    // richiuso o un nuovo ostacolo): marcata "success", Risolvi restava
    // disabilitato con edifici contati ma non piazzati (bug corretto settembre 2026).
    const restoreLastSolved = () => {
      const snapshot = lastSolvedRef.current;
      setBuildings(snapshot.buildings.map((b) => ({ ...b })));
      setPlacements(snapshot.placements.map((p) => ({ ...p })));
      return layoutStatus(snapshot.buildings, snapshot.placements);
    };

    // try/catch/finally: senza questo, QUALUNQUE eccezione lanciata durante la
    // ricerca (es. il RangeError da superamento del limite di 2^24 elementi di
    // un Set, vedi FAILED_STATES_CAP) lasciava isSolving a true per sempre —
    // il tool restava bloccato sul pulsante "Stop" e l'unica via d'uscita era
    // ricaricare la pagina. Ora l'uscita è garantita in ogni caso.
    try {

      const startTime = performance.now();
      let steps = 0;
      // Intervallo minimo tra due cessioni del controllo all'event loop: ~20
      // aggiornamenti al secondo del contatore passi, abbastanza fluidi per
      // l'utente e abbastanza radi da non frammentare il lavoro della CPU.
      const YIELD_INTERVAL_MS = 50;
      let lastYieldTime = startTime;

      const cellCount = gridRows * gridCols;
      const sourceBuildings = buildingsOverride ?? buildings;

      // Municipio da tenere fermo nel primo tentativo: la sua posizione ATTUALE
      // (import, trascinamento, soluzione precedente). Prima era sempre la
      // posizione di default MUNICIPIO_INITIAL_PLACEMENT: Risolvi provava per
      // prima cosa a riportarci il Municipio importato o spostato a mano, e dopo
      // un'espansione a sinistra quella posizione (coordinate storage fisse,
      // mai traslate) cadeva su un blocco non sbloccato, quindi il tentativo
      // falliva sempre subito e il Municipio veniva spostato (bug corretto
      // settembre 2026). Il fallback non scatta mai in pratica: placements
      // contiene sempre il Municipio.
      const pinnedMunicipio: Placement =
        placements.find((placement) => placement.buildingId === MUNICIPIO.id) ?? MUNICIPIO_INITIAL_PLACEMENT;

      // true se l'ULTIMO tentativo eseguito si è fermato almeno una volta per aver
      // superato SMALL_CUTOFF (tentativi nella fase "solo piccoli") invece che per
      // aver davvero esaurito le alternative: un fallimento finale in quel caso è
      // un possibile FALSO NEGATIVO. Conta solo l'ultimo tentativo perché, quando
      // la ricerca fallisce, l'ultimo è sempre quello col Municipio libero, il cui
      // spazio di ricerca contiene tutto quello del tentativo col Municipio fermo:
      // se lui fallisce senza toccare il cutoff il problema è davvero insolubile,
      // anche se il primo tentativo il cutoff l'aveva toccato (prima un unico flag
      // condiviso mostrava in quel caso "potrebbe comunque esisterne una").
      let lastRunHitSmallCutoff = false;

      // ⚠️ V8 impone un tetto fisso di 2^24 (16.777.216) elementi per Set: oltre,
      // .add() lancia RangeError e la ricerca crasha lasciando il tool bloccato su
      // "Stop". Un caso reale è arrivato a 15,75M passi, cioè a un soffio. Al cap
      // il Set si svuota: la memoization diventa una finestra scorrevole invece di
      // coprire tutta la ricerca, ma non può più crashare.
      const FAILED_STATES_CAP = 4_000_000;

      // Metriche di debug (console.debug a fine ricerca, MAI in UI): utili per
      // distinguere "esaurimento reale" da "limite euristico raggiunto" senza
      // dover indovinare dal conteggio edifici sulla mappa — vedi il gruppo
      // console alla fine di questa funzione.
      const debugInfo = {
        runs: [] as Array<{
          keepMunicipioInPlace: boolean;
          result: "found" | "no-solution" | "stopped";
          steps: number;
          smallBacktracksFinal: number;
          hitSmallCutoff: boolean;
          maxFailedStatesSize: number;
          failedStatesCapHit: boolean;
          enteredSmallOnlyPhase: boolean;
        }>,
      };

      const runSearch = async (keepMunicipioInPlace: boolean): Promise<Placement[] | null> => {
        let smallBacktracks = 0;
        let hitSmallCutoff = false;
        let maxFailedStatesSize = 0;
        let failedStatesCapHit = false;
        let enteredSmallOnlyPhase = false;
        const stepsAtStart = steps;
        // Il valore di un tentativo precedente non deve sopravvivere a questo
        // (vedi lastRunHitSmallCutoff), anche se questo termina prima di cercare.
        lastRunHitSmallCutoff = false;

        // ── CLASSI DI FORMA ─────────────────────────────────────────────────
        // La ricerca ragiona per FOOTPRINT, non per tipo di edificio: due tipi
        // con la stessa larghezza×altezza (es. Amaca e Imbarcazione, entrambi
        // 2x2; Spezie/Capanno/Grande Molo, tutti 3x3) sono geometricamente
        // intercambiabili, e il backtracking guarda solo la geometria (`pop` e
        // gli altri attributi non entrano mai qui dentro).
        //
        // Trattarli come tipi distinti faceva esplodere la ricerca su simmetrie
        // inutili: la chiave Zobrist include i conteggi residui PER TIPO, quindi
        // due stati con le stesse celle occupate ma tipi scambiati producevano
        // hash diversi e venivano riesplorati entrambi. Il numero di questi
        // duplicati è il coefficiente multinomiale della ripartizione — con 8
        // pezzi 2x2 divisi 2+6 sono C(8,2)=28 varianti per ogni layout, divisi
        // 1+7 sono C(8,1)=8: è la ragione per cui aggiungere un'Amaca costava
        // ~470k passi e aggiungere un'Imbarcazione ~350k, a parità di forma.
        //
        // Raggruppando, quelle varianti collassano in un unico stato. I tipi
        // concreti vengono riassegnati alla fine (assignConcreteTypes), quando
        // la geometria è già decisa: qualunque assegnazione che rispetti i
        // conteggi è valida per costruzione.
        type ShapeClass = {
          width: number;
          height: number;
          area: number;
          /** Residuo della classe, mutato/ripristinato dal backtracking. */
          count: number;
          /** Totale iniziale: dimensiona la tabella Zobrist dei conteggi. */
          initialCount: number;
          /** Tipi concreti che compongono la classe, con il rispettivo
           *  conteggio: NON mutati durante la ricerca, servono a valle. Il
           *  Municipio resta comunque una classe a sé (chiave dedicata in
           *  addToPool), mai fuso con altri tipi. */
          members: { id: string; count: number }[];
        };

        // Municipio tenuto fermo nella posizione attuale (primo tentativo, vedi
        // pinnedMunicipio): non entra nel pool, viene riaccodato dopo la ricerca.
        const seededPlacements: Placement[] = keepMunicipioInPlace ? [{ ...pinnedMunicipio }] : [];

        const buildingPool: ShapeClass[] = [];
        const classByKey = new Map<string, ShapeClass>();
        const addToPool = (source: { id: string; width: number; height: number; count: number }, isMunicipio: boolean) => {
          const key = isMunicipio ? "municipio" : `${source.width}x${source.height}`;
          let shapeClass = classByKey.get(key);
          if (!shapeClass) {
            shapeClass = {
              width: source.width,
              height: source.height,
              area: source.width * source.height,
              count: 0,
              initialCount: 0,
              members: [],
            };
            classByKey.set(key, shapeClass);
            buildingPool.push(shapeClass);
          }
          shapeClass.count += source.count;
          shapeClass.initialCount += source.count;
          shapeClass.members.push({ id: source.id, count: source.count });
        };

        if (!keepMunicipioInPlace) addToPool(MUNICIPIO, true);
        sourceBuildings.filter((building) => building.count > 0).forEach((building) => addToPool(building, false));
        buildingPool.sort((a, b) => b.area - a.area);

        // Dalla geometria ai tipi concreti: le posizioni trovate dalla ricerca
        // portano solo l'indice della classe, qui vengono distribuite tra i tipi
        // che la compongono rispettandone i conteggi. Si parte da `members`
        // (mai mutato) e non da `count`, che dopo un successo resta a metà
        // svolgimento — la ricorsione ritorna senza ripristinarlo.
        const assignConcreteTypes = (placed: Array<{ classIndex: number; row: number; col: number; w: number; h: number }>): Placement[] => {
          const remaining = buildingPool.map((shapeClass) => shapeClass.members.map((member) => ({ ...member })));
          const result: Placement[] = [...seededPlacements];
          for (const placement of placed) {
            const members = remaining[placement.classIndex];
            const member = members?.find((candidate) => candidate.count > 0);
            // `member` è sempre definito: la ricerca non piazza mai più istanze
            // di quante ne dichiari la classe. Il fallback evita comunque un
            // crash silenzioso se quell'invariante venisse infranta in futuro.
            if (!member) continue;
            member.count--;
            result.push({ buildingId: member.id, row: placement.row, col: placement.col, w: placement.w, h: placement.h });
          }
          return result;
        };

        const currentPlacements: Array<{ classIndex: number; row: number; col: number; w: number; h: number }> = [];

        const hasBigRemaining = () => buildingPool.some((shapeClass) => shapeClass.count > 0 && shapeClass.area > BIG_THRESHOLD);

        const occupied = new Uint8Array(cellCount);
        let freeCells = 0;

        for (let row = 0; row < gridRows; row++) {
          for (let col = 0; col < gridCols; col++) {
            const index = row * gridCols + col;
            if (!gridMask[row][col] || obstacles.has(cellKey(storageCell(row, col)))) {
              occupied[index] = 1;
            } else {
              freeCells++;
            }
          }
        }

        if (keepMunicipioInPlace) {
          for (let dr = 0; dr < pinnedMunicipio.h; dr++) {
            for (let dc = 0; dc < pinnedMunicipio.w; dc++) {
              const row = pinnedMunicipio.row + dr;
              const col = pinnedMunicipio.col + dc;
              const index = row * gridCols + col;
              if (row < 0 || col < 0 || row >= gridRows || col >= gridCols || occupied[index]) return null;
              occupied[index] = 1;
              freeCells--;
            }
          }
        }

        // Celle (indici in `occupied`) di un'istanza della classe con l'angolo in
        // alto a sinistra in (row, col), o null se esce dalla griglia o tocca una
        // cella già occupata.
        function cellsAt(shapeClass: ShapeClass, row: number, col: number): number[] | null {
          if (row + shapeClass.height > gridRows || col + shapeClass.width > gridCols) return null;
          const cells: number[] = [];
          for (let dr = 0; dr < shapeClass.height; dr++) {
            const rowStart = (row + dr) * gridCols + col;
            for (let dc = 0; dc < shapeClass.width; dc++) {
              if (occupied[rowStart + dc]) return null;
              cells.push(rowStart + dc);
            }
          }
          return cells;
        }

        // Controllo di fattibilità iniziale una tantum (non dentro il backtracking):
        // se una classe con count>0 non ha NESSUNA posizione valida in tutta la
        // griglia, la ricerca fallisce subito, senza nemmeno iniziare.
        const hasAnyPlacement = (shapeClass: ShapeClass) => {
          for (let row = 0; row + shapeClass.height <= gridRows; row++) {
            for (let col = 0; col + shapeClass.width <= gridCols; col++) {
              if (cellsAt(shapeClass, row, col)) return true;
            }
          }
          return false;
        };
        if (buildingPool.some((shapeClass) => shapeClass.count > 0 && !hasAnyPlacement(shapeClass))) return null;

        // Zobrist hashing per la chiave di memoization: ogni cella e ogni coppia
        // (tipo, count) ha un valore casuale a 64 bit fissato una volta, XORato
        // dentro/fuori quando cambia. Così la chiave è O(1) incrementale invece di
        // ricostruire una stringa lunga quanto la griglia ad ogni nodo.
        let seed = 0x9e3779b9;
        function nextRandomUint32() {
          // xorshift32: basta un PRNG ben distribuito, non serve sicurezza.
          seed ^= seed << 13; seed |= 0;
          seed ^= seed >>> 17;
          seed ^= seed << 5; seed |= 0;
          return seed >>> 0;
        }

        const cellHashLo = new Uint32Array(cellCount);
        const cellHashHi = new Uint32Array(cellCount);
        for (let index = 0; index < cellCount; index++) {
          cellHashLo[index] = nextRandomUint32();
          cellHashHi[index] = nextRandomUint32();
        }

        // Il count di una classe può solo diminuire dal valore iniziale (mai
        // salire oltre): la tabella copre [0, initialCount] per ogni classe.
        const countHashLo = buildingPool.map((shapeClass) => {
          const table = new Uint32Array(shapeClass.initialCount + 1);
          for (let c = 0; c <= shapeClass.initialCount; c++) table[c] = nextRandomUint32();
          return table;
        });
        const countHashHi = buildingPool.map((shapeClass) => {
          const table = new Uint32Array(shapeClass.initialCount + 1);
          for (let c = 0; c <= shapeClass.initialCount; c++) table[c] = nextRandomUint32();
          return table;
        });

        // Hash corrente, mantenuto incrementale per tutta la durata della ricerca.
        let hashLo = 0;
        let hashHi = 0;
        for (let index = 0; index < cellCount; index++) {
          if (occupied[index]) { hashLo ^= cellHashLo[index]; hashHi ^= cellHashHi[index]; }
        }
        for (let typeIndex = 0; typeIndex < buildingPool.length; typeIndex++) {
          hashLo ^= countHashLo[typeIndex][buildingPool[typeIndex].count];
          hashHi ^= countHashHi[typeIndex][buildingPool[typeIndex].count];
        }

        function toggleCellHash(index: number) {
          hashLo ^= cellHashLo[index];
          hashHi ^= cellHashHi[index];
        }
        function toggleCountHash(typeIndex: number, count: number) {
          hashLo ^= countHashLo[typeIndex][count];
          hashHi ^= countHashHi[typeIndex][count];
        }
        function currentHashKey() {
          return (hashHi >>> 0) * 4294967296 + (hashLo >>> 0);
        }

        // FAILED_STATES_CAP dichiarato fuori da runSearch (vedi sopra): usato
        // anche nel blocco di log a fine solve().
        let failedStates = new Set<number>();

        // Area ancora da piazzare, mantenuta incrementale invece di ricalcolata con
        // un reduce su tutti i tipi ad ogni nodo (viene letta una volta per nodo).
        let remainingArea = buildingPool.reduce((total, shapeClass) => total + shapeClass.count * shapeClass.area, 0);

        // Prima cella libera in ordine row-major: è l'ancora a cui restringere i
        // candidati di piazzamento. La scansione parte da `from` invece che da 0
        // perché un piazzamento valido non può contenere celle prima dell'ancora
        // del nodo padre (erano già occupate), quindi nel figlio la prima cella
        // libera è sempre > dell'ancora del padre.
        function firstFreeIndex(from: number): number {
          for (let index = from; index < cellCount; index++) {
            if (!occupied[index]) return index;
          }
          return -1;
        }

        // Branching ancorato alla prima cella libera (idx0): per ogni classe c'è al
        // più UN candidato, quello con l'angolo in alto a sinistra proprio su idx0
        // (vedi il commento sui candidati qui sotto) — è ciò che tiene sotto
        // controllo il branching factor. Le classi si provano nell'ordine del pool
        // (area decrescente); se falliscono tutte, idx0 resta vuota per sempre e si
        // prosegue (gli edifici non devono coprire tutta l'area).
        async function backtrack(availableCells: number, isSmallOnlyPhase: boolean, scanFrom: number): Promise<boolean> {
          if (isSmallOnlyPhase && smallBacktracks > SMALL_CUTOFF) {
            hitSmallCutoff = true;
            return false;
          }
          if (stopSolvingRef.current) return false;

          steps++;
          // Yield a TEMPO, non a numero di passi. Prima si cedeva il controllo
          // ogni 2500 passi: su una griglia con nodi economici significava
          // migliaia di interruzioni, ognuna delle quali costava il clamp dei
          // timer annidati (vedi yieldToEventLoop). Ora si lavora ininterrotti
          // per lotti di ~50ms, il che tiene comunque la UI reattiva (20
          // aggiornamenti al secondo, più di quanto l'occhio segua su un
          // contatore che scorre) e riduce le interruzioni di ordini di
          // grandezza.
          //
          // La lettura dell'orologio è protetta da un controllo economico sul
          // contatore: performance.now() a ogni nodo avrebbe un costo proprio
          // non trascurabile su milioni di nodi, mentre un AND bit a bit no.
          if ((steps & 1023) === 0) {
            const now = performance.now();
            if (now - lastYieldTime > YIELD_INTERVAL_MS) {
              lastYieldTime = now;
              setDisplaySteps(steps);
              await yieldToEventLoop();
              if (stopSolvingRef.current) return false;
            }
            // Tetto massimo di tempo (vedi SOLVE_TIME_LIMIT_MS): controllato qui,
            // dove l'orologio è già stato letto, così non costa nulla in più.
            if (now - startTime > SOLVE_TIME_LIMIT_MS) {
              timedOutRef.current = true;
              stopSolvingRef.current = true;
              return false;
            }
          }

          const areaLeft = remainingArea;
          if (areaLeft === 0) return true;
          if (areaLeft > availableCells) return false;

          const stateKey = currentHashKey();
          if (failedStates.has(stateKey)) return false;

          const idx0 = firstFreeIndex(scanFrom);
          if (idx0 === -1) return areaLeft === 0;
          const anchorRow = Math.floor(idx0 / gridCols);
          const anchorCol = idx0 % gridCols;

          const stillHasBig = hasBigRemaining();
          const enteringSmallOnly = !stillHasBig && !isSmallOnlyPhase;
          const nextIsSmallOnly = isSmallOnlyPhase || enteringSmallOnly;

          if (enteringSmallOnly) {
            smallBacktracks = 0;
            enteredSmallOnlyPhase = true;
          }

          // Candidati: tutte le celle prima di idx0 (ordine row-major) sono già
          // occupate, quindi un rettangolo che copre idx0 partendo più in alto o più
          // a sinistra ne includerebbe per forza una. L'UNICA posizione possibile per
          // una classe è quella con l'angolo in alto a sinistra su idx0: basta
          // testare quella. Una classe che lì non entra non fa fallire il nodo.
          // (Prima si generavano tutte le posizioni che coprono idx0 e le si
          // ordinava per MRV e punteggio euristico — angoli, bordi, posizione del
          // Municipio: con al più un candidato per classe l'ordine era sempre
          // quello del pool e il punteggio non influiva mai. Rimossi a settembre
          // 2026: stesse soluzioni e stessi passi, verificati con un test
          // differenziale, solo meno lavoro per nodo.)
          for (let typeIndex = 0; typeIndex < buildingPool.length; typeIndex++) {
            if (stopSolvingRef.current) break;
            const shapeClass = buildingPool[typeIndex];
            if (shapeClass.count <= 0) continue;
            if (nextIsSmallOnly && shapeClass.area > BIG_THRESHOLD) continue;
            const cells = cellsAt(shapeClass, anchorRow, anchorCol);
            if (!cells) continue;

            // L'hash del count va aggiornato in coppia: XOR fuori il valore vecchio,
            // decrementa, XOR dentro il valore nuovo (idem all'incremento sotto).
            toggleCountHash(typeIndex, shapeClass.count);
            shapeClass.count--;
            remainingArea -= shapeClass.area;
            toggleCountHash(typeIndex, shapeClass.count);

            for (const index of cells) { occupied[index] = 1; toggleCellHash(index); }
            // Solo la geometria: il tipo concreto viene deciso a fine ricerca
            // da assignConcreteTypes (vedi il commento sulle classi di forma).
            currentPlacements.push({ classIndex: typeIndex, row: anchorRow, col: anchorCol, w: shapeClass.width, h: shapeClass.height });

            if (await backtrack(availableCells - cells.length, nextIsSmallOnly, idx0 + 1)) return true;

            currentPlacements.pop();
            for (const index of cells) { occupied[index] = 0; toggleCellHash(index); }

            if (nextIsSmallOnly) smallBacktracks++;

            toggleCountHash(typeIndex, shapeClass.count);
            shapeClass.count++;
            remainingArea += shapeClass.area;
            toggleCountHash(typeIndex, shapeClass.count);
          }

          // Nessun tipo/candidato copre idx0 (o tutti i tentativi hanno fallito):
          // l'unica opzione rimasta è lasciare la cella vuota per sempre.
          occupied[idx0] = 1;
          toggleCellHash(idx0);
          const res = await backtrack(availableCells - 1, nextIsSmallOnly, idx0 + 1);
          occupied[idx0] = 0;
          toggleCellHash(idx0);

          if (res) return true;
          if (nextIsSmallOnly) smallBacktracks++;
          // Vedi commento su FAILED_STATES_CAP più sopra: evita il crash da
          // superamento del limite massimo del Set svuotandolo prima di raggiungerlo.
          if (failedStates.size >= FAILED_STATES_CAP) {
            failedStatesCapHit = true;
            failedStates = new Set<number>();
          }
          failedStates.add(stateKey);
          if (failedStates.size > maxFailedStatesSize) maxFailedStatesSize = failedStates.size;
          return false;
        }

        const initialSmallOnly = !hasBigRemaining();
        // La ricerca ha lavorato per classi di forma: qui la geometria trovata
        // viene tradotta in edifici concreti (e riaccodata al Municipio già
        // piazzato, quando questo tentativo lo teneva fermo).
        const result = (await backtrack(freeCells, initialSmallOnly, 0)) ? assignConcreteTypes(currentPlacements) : null;
        lastRunHitSmallCutoff = hitSmallCutoff;
        debugInfo.runs.push({
          keepMunicipioInPlace,
          result: stopSolvingRef.current ? "stopped" : result ? "found" : "no-solution",
          steps: steps - stepsAtStart,
          smallBacktracksFinal: smallBacktracks,
          hitSmallCutoff,
          maxFailedStatesSize,
          failedStatesCapHit,
          enteredSmallOnlyPhase,
        });
        return result;
      };

      const solvedPlacements = (await runSearch(true)) ?? (stopSolvingRef.current ? null : await runSearch(false));
      const found = solvedPlacements !== null;
      const endTime = performance.now();

      // Debug ricco SOLO in console (mai in UI, per non appesantire l'interfaccia):
      // permette di distinguere a colpo d'occhio "esaurimento reale" (nessuna fase
      // small-only raggiunta, o raggiunta ma senza toccare SMALL_CUTOFF) da "limite
      // euristico toccato" (hitSmallCutoff) o "memoization saturata e svuotata"
      // (failedStatesCapHit) — invece di doverlo dedurre dal conteggio edifici
      // sulla mappa. Apri la Console di Chrome (F12) subito dopo un Risolvi/AUTO.
      console.groupCollapsed(
        `%c[Pirati Solver] ${found ? "✅ soluzione trovata" : stopSolvingRef.current ? "⏸️ interrotta" : "❌ nessuna soluzione"} — ${steps} passi totali in ${Math.round(endTime - startTime)}ms`,
        "font-weight: bold;"
      );
      console.info("Esito:", found ? "trovata" : stopSolvingRef.current ? (timedOutRef.current ? "interrotta (timeout)" : "interrotta (stop manuale)") : "nessuna soluzione");
      console.info("Falso negativo possibile (SMALL_CUTOFF toccato nell'ultimo tentativo):", lastRunHitSmallCutoff);
      console.table(
        debugInfo.runs.map((run, i) => ({
          tentativo: i + 1,
          "municipio fisso": run.keepMunicipioInPlace,
          esito: run.result,
          passi: run.steps,
          "fase small-only raggiunta": run.enteredSmallOnlyPhase,
          "backtracks small-only finali": run.smallBacktracksFinal,
          // Flag esplicito, non più `smallBacktracksFinal > SMALL_CUTOFF`: il
          // contatore si azzera a ogni nuovo ingresso nella fase small-only, quindi
          // il valore finale poteva essere basso anche dopo aver toccato il cutoff.
          "cutoff SMALL_CUTOFF toccato": run.hitSmallCutoff,
          "max stati memorizzati (failedStates)": run.maxFailedStatesSize,
          "cap memoization (4M) toccato": run.failedStatesCapHit,
        }))
      );
      console.info("Edifici richiesti in questa ricerca:", sourceBuildings.filter((b) => b.count > 0).map((b) => `${b.id} ×${b.count} (${b.width}×${b.height}=${b.width * b.height})`));
      console.info(`BIG_THRESHOLD=${BIG_THRESHOLD} · SMALL_CUTOFF=${SMALL_CUTOFF} · SOLVE_TIME_LIMIT_MS=${SOLVE_TIME_LIMIT_MS} · FAILED_STATES_CAP=${FAILED_STATES_CAP}`);
      console.groupEnd();

      setDisplaySteps(steps);
      setStats({ steps, time: Math.round(endTime - startTime) });

      const wasInterrupted = stopSolvingRef.current;
      if (wasInterrupted) {
        // Stop manuale (o timeout): la ricerca lavora su variabili locali, non
        // ha mai toccato lo state, quindi la mappa a schermo è già quella di
        // prima — ma i conteggi (buildings) possono essere stati modificati
        // dall'utente subito prima di premere Risolvi. Stesso ripristino del
        // ramo "nessuna soluzione" sotto: si torna sempre interamente
        // (conteggi inclusi) all'ultima soluzione valida nota — lastSolvedRef
        // non è mai vuoto (vedi dichiarazione), quindi il ripristino avviene
        // sempre, invece di lasciare i conteggi nuovi disallineati dalla mappa.
        // Lo stato resta "interrupted" (pillola dedicata, Risolvi abilitato per
        // riprovare) qualunque sia quello della disposizione ripristinata.
        restoreLastSolved();
        setImportMessage({ kind: "error", text: t("piratiRestoredLastSolutionMessage", uiLang) });
        setStatus("interrupted");
        // Un'interruzione manuale (Stop o timeout) NON conta come fallimento per
        // il chiamante AUTO: l'utente ha scelto lui di fermarsi. isSolving e
        // stopSolvingRef vengono azzerati dal `finally` del wrapper, che è
        // l'unico punto di uscita della funzione.
        return true;
      } else if (found) {
        setPlacements(solvedPlacements);
        // Snapshot dell'ultima soluzione valida: sourceBuildings è lo stato
        // edifici effettivamente usato da questa ricerca (buildingsOverride se
        // presente, altrimenti buildings), coerente con solvedPlacements.
        lastSolvedRef.current = { buildings: sourceBuildings.map((b) => ({ ...b })), placements: solvedPlacements };
        // layoutStatus e non "success" fisso: tutti gli edifici sono piazzati per
        // costruzione, ma la ricerca non guarda la popolazione (caso AUTO con un
        // edificio a popolazione negativa), esattamente come '+'/sposta/scambia.
        setStatus(layoutStatus(sourceBuildings, solvedPlacements));
      } else {
        // Nessuna soluzione per i conteggi appena impostati: non lasciare la
        // mappa vecchia con conteggi nuovi disallineati, torna sempre
        // all'ultima soluzione valida nota (lastSolvedRef non è mai vuoto).
        // Niente stato "failed": il ripristino riporta a una disposizione valida
        // (di norma "success", Risolvi disabilitato come in ogni altra situazione
        // stabile; "idle" se quella disposizione era incompleta, vedi
        // restoreLastSolved). Ma il solo cambio di stato non spiegherebbe perché la
        // modifica appena fatta non è comparsa — un toast temporaneo colma il
        // vuoto (stesso meccanismo del toast di import, vedi useEffect su importMessage).
        setStatus(restoreLastSolved());
        // lastRunHitSmallCutoff: distingue un fallimento "pulito" (ogni alternativa
        // provata ed esclusa: la soluzione richiesta non esiste per questi
        // conteggi) da un fallimento dove l'ultimo tentativo si è fermato per il
        // tetto di tentativi SMALL_CUTOFF prima di esaurire davvero le
        // alternative — in quel caso potrebbe esistere una soluzione che la
        // ricerca non ha avuto modo di scoprire, messaggio diverso per non
        // far credere all'utente che il problema sia insolubile per certo.
        setImportMessage({
          kind: "error",
          text: t(lastRunHitSmallCutoff ? "piratiRestoredLastSolutionCutoffMessage" : "piratiRestoredLastSolutionMessage", uiLang),
        });

        // Il ripristino appena fatto rende superfluo qualunque aggiustamento
        // lato chiamante: lo stato è già coerente (buildings+placements tornati
        // all'ultima soluzione valida, che per costruzione NON contiene
        // l'edificio appena aggiunto da un eventuale AUTO).
        return false;
      }

      // Raggiunto solo dal ramo `found` (gli altri due ritornano prima): lo
      // stato a schermo è già quello risolto con successo.
      return true;
    } catch (error) {
      // Errore imprevisto: la ricerca non ha toccato lo state (lavora su
      // variabili locali), quindi basta riportare buildings/placements
      // all'ultima soluzione valida nota, come per un fallimento normale.
      console.error("[Pirati Solver] errore imprevisto durante la ricerca:", error);
      setStatus(restoreLastSolved());
      setImportMessage({ kind: "error", text: t("piratiSolverCrashed", uiLang) });
      return false;
    } finally {
      // Unico punto in cui la ricerca viene chiusa: vale per il ritorno
      // normale, per l'interruzione e per un'eccezione imprevista.
      setIsSolving(false);
      stopSolvingRef.current = false;
    }
  }, [buildings, gridCols, gridMask, gridRows, isSolving, obstacles, placements, uiLang, MUNICIPIO, MUNICIPIO_INITIAL_PLACEMENT]);

  const updateCount = async (id: string, delta: number) => {
    if (isSolving) return;

    const targetBuilding = buildings.find((building) => building.id === id);
    if (!targetBuilding) return;
    if (delta < 0 && targetBuilding.count <= 0) return;

    const nextBuildings = buildings.map((building) =>
      building.id === id ? { ...building, count: Math.max(0, building.count + delta) } : building
    );

    // '−' gestito sempre qui, anche con la sola mappa del Municipio a schermo (es.
    // edifici contati ma non ancora piazzati): prima quel caso passava da
    // clearSolution (ora rimossa), che metteva "idle" anche quando i conteggi
    // tornavano coerenti (es. a zero) e abilitava Risolvi senza motivo.
    if (delta < 0) {
      const nextCount = nextBuildings.find((building) => building.id === id)!.count;
      const placedCount = placements.filter((placement) => placement.buildingId === id).length;
      // Toglie un placement solo se ce n'è davvero uno in eccesso: un '+' può aver
      // alzato il conteggio senza piazzare nulla (auto-piazzamento fallito), e in
      // quel caso il '-' deve solo assorbire il disallineamento, non rimuovere
      // un'istanza vera dell'import.
      let nextPlacements = placements;
      if (placedCount > nextCount) {
        // L'ULTIMA istanza, non la prima: il '+' accoda, quindi togliere la prima
        // rimuoverebbe a caso un'istanza dell'import invece dell'ultima aggiunta.
        // (findLastIndex non è disponibile con il target lib ES2020.)
        let placementIndex = -1;
        for (let i = placements.length - 1; i >= 0; i--) {
          if (placements[i].buildingId === id) { placementIndex = i; break; }
        }

        if (placementIndex >= 0) {
          nextPlacements = placements.filter((_, index) => index !== placementIndex);
        }
      }

      setBuildings(nextBuildings);
      if (nextPlacements !== placements) {
        setPlacements(nextPlacements);
      }

      // Ricalcolato su TUTTI gli edifici: un '+' fallito su un altro edificio
      // lascerebbe un disallineamento che questo ramo non vedrebbe mai
      // (placedCount/nextCount riguardano solo `id`).
      const nextStatus = layoutStatus(nextBuildings, nextPlacements);
      setStatus(nextStatus);
      // A differenza del ramo '+' sotto, qui NON serve che il layout sia
      // completo (nextStatus === "success"): nextPlacements è per costruzione
      // un sottoinsieme di placements, che erano già un layout valido (nessuna
      // sovrapposizione, tutto dentro l'area sbloccata). Un sottoinsieme di una
      // disposizione valida è sempre a sua volta valido — anche se ora manca
      // qualche edificio rispetto al conteggio corrente — quindi diventa
      // comunque la nuova ultima soluzione nota.
      lastSolvedRef.current = { buildings: nextBuildings.map((b) => ({ ...b })), placements: nextPlacements };
      return;
    }

    // Il guard è `canEditGrid` (validità del sistema di coordinate usato da
    // findAutoPlacement), NON l'esistenza di un layout già risolto: richiedere
    // quest'ultima impediva l'auto-piazzamento al primissimo '+' su griglia vuota.
    if (delta > 0 && canEditGrid && targetBuilding) {
      const autoPlacement = findAutoPlacement(targetBuilding);
      const nextTotalArea = nextBuildings.reduce((accumulator, building) => accumulator + building.width * building.height * building.count, 0) + municipioArea;

      setBuildings(nextBuildings);

      if (autoPlacement && nextTotalArea <= maxArea) {
        const nextPlacements = [...placements, autoPlacement];
        setPlacements(nextPlacements);
        const nextStatus = layoutStatus(nextBuildings, nextPlacements);
        setStatus(nextStatus);
        // Auto-piazzamento immediato (senza passare da solve()): se il layout
        // risultante è comunque una soluzione completa e valida (tutti gli
        // edifici piazzati, popolazione coperta), va trattato come un successo
        // del solver a tutti gli effetti — altrimenti un futuro Risolvi fallito
        // non avrebbe questo stato come punto di ripristino, pur essendo valido.
        if (nextStatus === "success") {
          lastSolvedRef.current = { buildings: nextBuildings.map((b) => ({ ...b })), placements: nextPlacements };
        }
      } else {
        setStatus("idle");
        // AUTO: l'auto-piazzamento immediato non ha trovato posto per il nuovo
        // edificio. Proviamo Risolvi su TUTTO lo stato (non solo l'ultimo
        // arrivato: può essere l'unico modo di far combaciare l'intera griglia).
        // Se anche Risolvi fallisce, togliamo esattamente l'edificio appena
        // aggiunto (l'unica cosa che sappiamo per certo essere "di troppo" in
        // questo tentativo) e ci fermiamo lì, senza altri retry a catena.
        if (autoMode) {
          // Nessun aggiustamento dopo la ricerca: se fallisce, solve() riporta
          // già da sé buildings+placements all'ultima disposizione valida (che
          // per costruzione non contiene l'edificio appena aggiunto). Il
          // decremento manuale che si faceva qui prima veniva applicato a uno
          // stato GIÀ ripristinato, sottraendo due volte — era la causa della
          // lista edifici che mostrava una soluzione "più vecchia" della mappa.
          await solve(nextBuildings);
        }
      }

      return;
    }

    // Solo difensivo: '+' fuori da 'obstacle' non è raggiungibile dalla UI (il
    // pulsante è disabilitato, vedi canAddAnother). Alza il conteggio senza
    // piazzare nulla e senza toccare la mappa — prima passava da clearSolution,
    // che avrebbe cancellato l'intera disposizione a schermo.
    setBuildings(nextBuildings);
    setStatus(layoutStatus(nextBuildings, placements));
  };

  const removePlacement = (row: number, col: number) => {
    if (!canEditGrid) return;

    const placement = placements.find(p => p.row === row && p.col === col);
    if (!placement || placement.buildingId === MUNICIPIO.id) return;

    // Stato successivo calcolato esplicitamente (invece di due setState
    // funzionali indipendenti): serve per poter valutare layoutStatus e
    // aggiornare lastSolvedRef in modo coerente, vedi sotto.
    const nextBuildings = buildings.map((building) =>
      building.id === placement.buildingId ? { ...building, count: Math.max(0, building.count - 1) } : building
    );
    const nextPlacements = placements.filter((p) => !(p.row === row && p.col === col));

    setBuildings(nextBuildings);
    setPlacements(nextPlacements);
    // Prima era un `setStatus("success")` fisso: sbagliato se i conteggi erano
    // già disallineati (es. un '+' che non era riuscito a piazzare nulla),
    // perché nascondeva il disallineamento disabilitando Risolvi.
    const nextStatus = layoutStatus(nextBuildings, nextPlacements);
    setStatus(nextStatus);
    if (nextStatus === "success") {
      lastSolvedRef.current = { buildings: nextBuildings.map((b) => ({ ...b })), placements: nextPlacements };
    }
  };

  const canSwapPlacements = (source: Placement | null, target: Placement) => {
    if (!source) return false;
    if (source.row === target.row && source.col === target.col) return false;
    return source.w === target.w && source.h === target.h;
  };

  const canMovePlacementTo = (source: Placement | null, targetRow: number, targetCol: number) => {
    if (!source) return false;
    if (targetRow === source.row && targetCol === source.col) return false;
    if (targetRow < 0 || targetCol < 0 || targetRow + source.h > gridRows || targetCol + source.w > gridCols) return false;

    for (let dr = 0; dr < source.h; dr++) {
      for (let dc = 0; dc < source.w; dc++) {
        const row = targetRow + dr;
        const col = targetCol + dc;
        if (!gridMask[row]?.[col]) return false;
        if (obstacles.has(cellKey(storageCell(row, col)))) return false;

        const blockedByPlacement = placements.some((placement) => {
          if (placement.row === source.row && placement.col === source.col) return false;
          return (
            row >= placement.row &&
            row < placement.row + placement.h &&
            col >= placement.col &&
            col < placement.col + placement.w
          );
        });
        if (blockedByPlacement) return false;
      }
    }

    return true;
  };

  const movePlacementTo = (source: Placement, targetRow: number, targetCol: number) => {
    if (!canMovePlacementTo(source, targetRow, targetCol)) return;

    const nextPlacements = placements.map((placement) =>
      placement.row === source.row && placement.col === source.col
        ? { ...placement, row: targetRow, col: targetCol }
        : placement
    );
    setPlacements(nextPlacements);
    // canMovePlacementTo ha già verificato che la destinazione sia dentro
    // l'area sbloccata, libera da ostacoli e da altri edifici: la disposizione
    // resta valida. Se copre tutti i conteggi, diventa la nuova "ultima
    // soluzione valida" — altrimenti uno spostamento manuale andrebbe perso al
    // primo Risolvi fallito, che ripristinerebbe una disposizione precedente.
    const nextStatus = layoutStatus(buildings, nextPlacements);
    setStatus(nextStatus);
    if (nextStatus === "success") {
      lastSolvedRef.current = { buildings: buildings.map((b) => ({ ...b })), placements: nextPlacements };
    }
  };

  const swapPlacements = (source: Placement, target: Placement) => {
    if (!canSwapPlacements(source, target)) return;

    const nextPlacements = placements.map((placement) => {
      if (placement.row === source.row && placement.col === source.col) {
        return { ...placement, row: target.row, col: target.col };
      }
      if (placement.row === target.row && placement.col === target.col) {
        return { ...placement, row: source.row, col: source.col };
      }
      return placement;
    });
    setPlacements(nextPlacements);
    // Uno scambio avviene solo tra edifici della STESSA dimensione (vedi
    // canSwapPlacements): le celle occupate sono identiche, la disposizione
    // resta valida. Stesso trattamento di movePlacementTo qui sopra.
    const nextStatus = layoutStatus(buildings, nextPlacements);
    setStatus(nextStatus);
    if (nextStatus === "success") {
      lastSolvedRef.current = { buildings: buildings.map((b) => ({ ...b })), placements: nextPlacements };
    }
  };

  const cellFromPointer = (clientX: number, clientY: number) => {
    const container = gridContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const col = Math.floor((relX / rect.width) * gridCols);
    const row = Math.floor((relY / rect.height) * gridRows);

    if (Number.isNaN(col) || Number.isNaN(row)) return null;
    return { row, col };
  };

  const computeTargetTopLeft = (source: Placement, clientX: number, clientY: number) => {
    const cell = cellFromPointer(clientX, clientY);
    if (!cell) return null;
    let row = cell.row - dragOffset.row;
    let col = cell.col - dragOffset.col;
    row = Math.max(0, Math.min(row, gridRows - source.h));
    col = Math.max(0, Math.min(col, gridCols - source.w));
    return { row, col };
  };

  const handlePlacementPointerDown = (event: ReactPointerEvent<HTMLDivElement>, placement: Placement) => {
    if (event.button !== 0) return;
    // In modalità aggiungi/rimuovi espansione la griglia serve solo per quello: spostare,
    // scambiare o rimuovere edifici va disabilitato per evitare click accidentali mentre
    // si sta sbloccando o richiudendo un'area.
    if (!canEditGrid) return;

    const cell = cellFromPointer(event.clientX, event.clientY);
    if (!cell) return;

    const offset = {
      row: Math.max(0, Math.min(placement.h - 1, cell.row - placement.row)),
      col: Math.max(0, Math.min(placement.w - 1, cell.col - placement.col)),
    };

    setDraggedPlacement(placement);
    setDragOffset(offset);
    setDragTargetCell({ row: placement.row, col: placement.col });
    suppressClickAfterDragRef.current = false;

    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handlePlacementPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggedPlacement) return;
    const target = computeTargetTopLeft(draggedPlacement, event.clientX, event.clientY);
    if (target) setDragTargetCell(target);
    suppressClickAfterDragRef.current = true;
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggedPlacement) {
      setDragTargetCell(null);
      return;
    }

    const target = computeTargetTopLeft(draggedPlacement, event.clientX, event.clientY);
    if (target) {
      const overlapping = placements.find(
        (p) =>
          p !== draggedPlacement &&
          !(p.row === draggedPlacement.row && p.col === draggedPlacement.col) &&
          target.row < p.row + p.h &&
          target.row + draggedPlacement.h > p.row &&
          target.col < p.col + p.w &&
          target.col + draggedPlacement.w > p.col
      );

      if (overlapping && canSwapPlacements(draggedPlacement, overlapping)) {
        swapPlacements(draggedPlacement, overlapping);
      } else if (canMovePlacementTo(draggedPlacement, target.row, target.col)) {
        movePlacementTo(draggedPlacement, target.row, target.col);
      }
    }

    setDraggedPlacement(null);
    setDragTargetCell(null);
    window.setTimeout(() => {
      suppressClickAfterDragRef.current = false;
    }, 60);
  };

  // Gesto interrotto dal browser (pointercancel: gesto di sistema, rotazione
  // dello schermo...): il drag va ANNULLATO, non completato. Prima
  // onPointerCancel passava da finishDrag, che spostava comunque l'edificio
  // sull'ultima posizione calcolata dall'evento.
  const cancelDrag = () => {
    setDraggedPlacement(null);
    setDragTargetCell(null);
    window.setTimeout(() => {
      suppressClickAfterDragRef.current = false;
    }, 60);
  };

  const findAutoPlacement = (building: BuildingType): Placement | null => {
    // Chiamata solo con editMode 'obstacle', dove display e storage coincidono e
    // la conversione è a delta 0. Resta esplicita via storageCell così un futuro
    // chiamante fuori da quella modalità non reintroduca il disallineamento.
    const occupied = new Uint8Array(gridRows * gridCols);

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const index = row * gridCols + col;
        const storage = displayToStorageCell(
          displayCell(row, col),
          minDisplayBlockRow, minDisplayBlockCol,
          minUnlockedBlockRow, minUnlockedBlockCol,
        );
        if (!gridMask[row][col] || obstacles.has(cellKey(storage))) {
          occupied[index] = 1;
        }
      }
    }

    for (const placement of placements) {
      for (let dr = 0; dr < placement.h; dr++) {
        for (let dc = 0; dc < placement.w; dc++) {
          occupied[(placement.row + dr) * gridCols + placement.col + dc] = 1;
        }
      }
    }

    // Scelta della posizione con bestFreePlacement: la stessa regola usata per
    // ricollocare gli edifici di un'espansione rimossa (layoutAfterBlockRemoval).
    // Estratta da qui a settembre 2026 senza cambiarne il risultato: gridMask vale
    // false fuori griglia, quindi "vicino non sbloccato" copre già i vecchi
    // controlli espliciti sul bordo della griglia (verificato con un test
    // differenziale vecchio/nuovo).
    const best = bestFreePlacement(
      building.width,
      building.height,
      gridRows,
      gridCols,
      (row, col) => !!gridMask[row]?.[col],
      (row, col) => !occupied[row * gridCols + col],
    );
    return best ? { buildingId: building.id, row: best.row, col: best.col, w: building.width, h: building.height } : null;
  };

  const municipioArea = MUNICIPIO.width * MUNICIPIO.height;
  const totalArea = buildings.reduce((accumulator, building) => accumulator + building.width * building.height * building.count, 0) + municipioArea;
  // Conta solo gli ostacoli effettivamente dentro un blocco sbloccato: un Impediment
  // importato da game può cadere in un'area non ancora sbloccata (blocco non presente
  // in unlockedBlocks), e in tal caso non deve sottrarsi all'area disponibile.
  const obstacleArea = Array.from(obstacles).filter((key) => {
    const { row, col } = parseCellKey(key);
    const blockRow = minUnlockedBlockRow + Math.floor(row / BLOCK_SIZE);
    const blockCol = minUnlockedBlockCol + Math.floor(col / BLOCK_SIZE);
    return unlockedBlocks.has(blockKey(blockRow, blockCol));
  }).length;
  const unlockedArea = unlockedBlocks.size * BLOCK_SIZE * BLOCK_SIZE;
  const maxArea = unlockedArea - obstacleArea;

  const totalPopProvided = buildings.reduce((accumulator, building) => accumulator + (building.pop > 0 ? building.pop * building.count : 0), 0);
  const totalPopRequired = buildings.reduce((accumulator, building) => accumulator + (building.pop < 0 ? Math.abs(building.pop) * building.count : 0), 0);
  const hasStatsWarning = totalArea > maxArea || totalPopRequired > totalPopProvided;
  // (26/11/2026) diplomazia dell'insediamento: somma degli edifici costruiti (0 di partenza)
  // (28/11/2026) Mughal: con i bonus delle catene (Canali sopra e sotto l'Ambasciata, Vialetti a
  // destra), dalla disposizione sulla mappa; gli altri insediamenti: somma della legenda
  const totalDiplomazia = useMemo(() => {
    if (!cfg.ottimizzatore) return buildings.reduce((acc, b) => acc + (b.diplomacy ?? 0) * b.count, 0);
    const base = new Map(buildings.map((b) => [b.id, b.diplomacy ?? 0]));
    const amb = placements.find((p) => p.buildingId === ID_MUNICIPIO);
    return diplomaziaDisposizione(placements.filter((p) => p.buildingId !== ID_MUNICIPIO).map((p) => ({ id: p.buildingId, row: p.row, col: p.col, w: p.w, h: p.h })), amb ? { row: amb.row, col: amb.col, h: amb.h } : null,
      (id) => base.get(id) ?? 0, { canale: "canale", vialetto: "vialetto" });
  }, [cfg, buildings, placements]);

  // Undo deve attivarsi solo se lo stato corrente si è davvero discostato dalla
  // baseline (stato vuoto, o stato subito dopo l'ultimo import riuscito) — altrimenti
  // cliccarlo non farebbe nulla di osservabile. Confronto per VALORE, non per
  // riferimento: `buildings`/`placements` sono nuovi array a ogni edit (anche quando
  // il contenuto torna identico), quindi va serializzato in una forma canonica
  // (ordinata) invece di un semplice `===`. Non include importedExpansions/
  // importedObstacleCells: sono registri derivati dall'import stesso, mai modificati
  // direttamente dall'utente — cambiano solo insieme a expansions/obstacles, già coperti.
  const hasChangesFromBaseline = useMemo(() => {
    const normalizeBuildings = (list: BuildingType[]) =>
      list
        .map((building) => `${building.id}:${building.count}`)
        .sort()
        .join("|");
    const normalizePlacements = (list: Placement[]) =>
      list
        .map((placement) => `${placement.buildingId}:${placement.row}:${placement.col}:${placement.w}:${placement.h}`)
        .sort()
        .join("|");
    const normalizeSet = (set: Set<string>) => Array.from(set).sort().join("|");

    if (normalizeBuildings(buildings) !== normalizeBuildings(baseline.buildings)) return true;
    if (normalizePlacements(placements) !== normalizePlacements(baseline.placements)) return true;
    if (normalizeSet(obstacles) !== normalizeSet(baseline.obstacles)) return true;
    if (normalizeSet(expansions) !== normalizeSet(baseline.expansions)) return true;
    return false;
  }, [buildings, placements, obstacles, expansions, baseline]);

  // ── Undo / Reset (2.0: estratti dai pulsanti, chiamati dal nastro) ──────
  const annulla = () => {
            if (isSolving || !hasChangesFromBaseline) return;
            // 'success' e non 'idle': la baseline è già una disposizione valida
            // (vuota o post-import), quindi Risolvi deve restare disabilitato
            // esattamente come subito dopo una soluzione trovata.
            setStatus("success");
            // Torna allo stato "di partenza": lo stato vuoto se non è mai stato fatto
            // un import, altrimenti lo stato subito dopo l'ultimo import riuscito.
            // (ex "Reset", rinominato "Undo" quando è stato introdotto il vero Reset
            // qui sotto, che invece cancella anche i dati importati.)
            // La baseline è "risolta" per definizione (vuota o subito dopo un
            // import): diventa la nuova ultima soluzione valida, così un
            // Risolvi fallito dopo l'Undo torna qui e non a una disposizione
            // precedente all'Undo stesso.
            lastSolvedRef.current = { buildings: baseline.buildings.map((b) => ({ ...b })), placements: baseline.placements.map((p) => ({ ...p })) };
            // La disposizione a schermo non è più il risultato dell'ultima
            // ricerca: le sue statistiche non la descrivono più (vedi `stats`).
            setStats(null);
            setBuildings(baseline.buildings.map((building) => ({ ...building })));
            setPlacements(baseline.placements.map((placement) => ({ ...placement })));
            setObstacles(new Set(baseline.obstacles));
            setExpansions(new Set(baseline.expansions));
            setImportedExpansions(new Set(baseline.importedExpansions));
            setImportedObstacleCells(new Set(baseline.importedObstacleCells));
            // Come import/addExpansion/removeExpansion: le espansioni cambiano, e
            // restare in "Rimuovi EXP" senza più espansioni rimovibili lasciava il
            // pulsante −EXP disabilitato con la modalità ancora attiva (griglia
            // bloccata, "+" e Risolvi disabilitati — bug corretto settembre 2026).
            setEditMode("obstacle");
  };
  /** (28/11/2026) Ultimo import riuscito (testo e mondo): Reset riparte da qui. */
  const ultimoImportRef = useRef<{ testo: string; mondo: string | null } | null>(null);
  /**
   * Reset (28/11/2026, utente): torna alla situazione iniziale, cioè all'insediamento com'è
   * nel gioco. Prima l'ultimo pacchetto del ponte con questo insediamento (stesso mondo; senza
   * mondo l'unico arrivato), poi l'ultimo import (bacchetta o ponte); solo senza nessuno dei
   * due lo scenario vuoto. Come un import: tentativi, saldo, prezzi e sblocchi da capo.
   */
  const reset = () => {
    if (isSolving) return;
    if (ottimizzando) fermaOttimizzatore();
    const fazione = /^H_([A-Za-z]+)_Townhall$/.exec(cfg.importa.municipio)?.[1];
    const suoi = fazione ? pacchettiPonte().filter((p) => p.tipo === "mia" && p.leggero && improntaInsediamento(p.leggero)?.fazione === fazione) : [];
    const dalPonte = suoi.find((p) => p.server === mondo) ?? (suoi.length === 1 && (!mondo || !hasImportedCity) ? suoi[0] : undefined);
    if (dalPonte && runImport(dalPonte.json).kind === "success") return;
    const u = ultimoImportRef.current;
    if (u && hasImportedCity && u.mondo === mondo && runImport(u.testo).kind === "success") return;
    azzera();
  };
  const azzera = () => {
            if (isSolving) return;
            setTentativi([]);
            setTentativiDipl([]);
            setTentativoScelto(null);
            setPartenzaOtt(null);
            ultimoImportRef.current = null;
            // Reset "vero": a differenza di Undo (sopra), riporta SEMPRE allo stato
            // vuoto iniziale, anche se è già stato fatto un import — e azzera anche
            // baseline stessa, così un Undo successivo non riporterebbe più ai dati
            // del vecchio import (comportamento esplicitamente richiesto dall'utente).
            setStatus("success");
            const emptyBaseline: Baseline = {
              buildings: INITIAL_BUILDINGS,
              placements: INITIAL_PLACEMENTS,
              obstacles: new Set(),
              expansions: new Set(),
              importedExpansions: new Set(),
              importedObstacleCells: new Set(),
            };
            setStats(null);
            setBuildings(INITIAL_BUILDINGS.map((building) => ({ ...building })));
            setPlacements(INITIAL_PLACEMENTS.map((placement) => ({ ...placement })));
            setObstacles(new Set());
            setExpansions(new Set());
            setImportedExpansions(new Set());
            setImportedObstacleCells(new Set());
            setBaseline(emptyBaseline);
            setSaldoValuta(cfg.valuta?.iniziale ?? null);
            // Stesso motivo dell'Undo sopra.
            setEditMode("obstacle");
            // Come per un nuovo import: lo stato vuoto è "risolto" per definizione
            // (nessun edificio da piazzare oltre al municipio), diventa la nuova
            // ultima soluzione valida.
            lastSolvedRef.current = { buildings: INITIAL_BUILDINGS.map((b) => ({ ...b })), placements: INITIAL_PLACEMENTS.map((p) => ({ ...p })) };
            setHasImportedCity(false);
  };

  // ── Ottimizzatore della disposizione (25/11/2026, Mughal) ─────────────────
  // Le manifatture le sceglie l'utente (numero nella legenda); il motore riempie con le
  // residenze sbloccate cercando più rupie e meno strade, e propone un tentativo per ogni
  // numero di strade. Gira in più worker, ognuno con una parte delle posizioni dell'Ambasciata.
  const OTT_TEMPO_MS = 20_000;
  const fermaOttimizzatore = useCallback(() => {
    for (const w of lavoratoriRef.current) w.terminate();
    lavoratoriRef.current = [];
    setOttimizzando(false);
  }, []);
  useEffect(() => () => { for (const w of lavoratoriRef.current) w.terminate(); }, []);
  useEffect(() => {
    if (!ottimizzando) return;
    const t0 = Date.now();
    setSecondiOtt(0);
    const id = setInterval(() => setSecondiOtt(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [ottimizzando]);
  const richiestaOttimizzatore = (): RichiestaOttimizzatore | null => {
    const opt = cfg.ottimizzatore;
    if (!opt) return null;
    const libere = new Uint8Array(gridRows * gridCols);
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      libere[r * gridCols + c] = gridMask[r]?.[c] && !obstacles.has(cellKey(storageCell(r, c))) ? 1 : 0;
    }
    const tipo = (b: BuildingType): TipoOttimizzatore => ({ id: b.id, w: b.width, h: b.height, pop: b.pop, rupieOra: rupieOraDi(b) });
    const req: RichiestaOttimizzatore = {
      righe: gridRows, colonne: gridCols, libere, ambasciata: { w: MUNICIPIO.width, h: MUNICIPIO.height },
      fisse: buildings
        .filter((b) => b.count > 0 && !opt.residenze.includes(b.id) && b.id !== opt.strada && !opt.diplomazia.includes(b.id))
        .map((b) => ({ tipo: tipo(b), quante: b.count, senzaStrada: opt.senzaStrada.includes(b.id) })),
      residenze: buildings.filter((b) => opt.residenze.includes(b.id) && sbloccato(b.cityentityId)).map(tipo),
      // (27/11/2026) Chhatri & co.: quanti metterne lo sceglie l'ottimizzatore
      produttori: buildings.filter((b) => opt.produttori.includes(b.id) && sbloccato(b.cityentityId) && rupieOraDi(b) > 0).map(tipo),
      tempoMs: OTT_TEMPO_MS,
      // strade già costruite nel gioco (import): non si eliminano, al massimo si parcheggiano
      stradeEsistenti: baseline.buildings.find((b) => b.id === opt.strada)?.count ?? 0,
    };
    // (28/11/2026, utente) le rupie fanno da tetto: al massimo le strade già costruite più quelle
    // che si possono comprare con il saldo (tentativi che costano di più non servono)
    const saldo = saldoValuta ?? cfg.valuta?.iniziale ?? null;
    const costo = costiValuta[opt.strada] ?? buildings.find((b) => b.id === opt.strada)?.currency?.cost ?? 0;
    if (saldo !== null && costo > 0) req.maxStrade = (req.stradeEsistenti ?? 0) + Math.max(0, Math.floor(saldo / costo));
    return req;
  };
  const firmaRichiesta = (req: RichiestaOttimizzatore) =>
    [req.righe, req.colonne, Array.from(req.libere).join(""), JSON.stringify(req.fisse), req.residenze.map((r) => r.id).join(","), (req.produttori ?? []).map((r) => r.id).join(","), req.stradeEsistenti, req.maxStrade ?? ""].join("|");
  /** Lancia i worker: `base` = tentativi da cui ripartire (Continua), `infinito` = fino a Stop. */
  const lanciaOttimizzatore = (req: RichiestaOttimizzatore, base: Tentativo[], infinito: boolean) => {
    const posizioni = posizioniAmbasciata(req);
    const quanti = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1, posizioni.length));
    const liste: Tentativo[][] = Array.from({ length: quanti }, () => []);
    let finiti = 0;
    const seme0 = infinito ? (Date.now() % 100000) * 10 : 1;
    const partenze = base.map((tt) => ({ ambasciata: tt.ambasciata, strade: tt.celleStrada }));
    setOttInfinito(infinito);
    setTentativiChiusi(false);
    setOttimizzando(true);
    lavoratoriRef.current = Array.from({ length: quanti }, (_, i) => {
      const w = new LavoratoreMughal();
      w.onmessage = (e: MessageEvent<{ tipo: "progresso" | "fine"; tentativi: Tentativo[] }>) => {
        liste[i] = e.data.tentativi;
        setTentativi(unisciTentativi([base, ...liste]));
        if (e.data.tipo === "fine" && ++finiti === quanti) fermaOttimizzatore();
      };
      w.onerror = () => { if (++finiti === quanti) fermaOttimizzatore(); };
      w.postMessage({ ...req, tempoMs: infinito ? 1e12 : OTT_TEMPO_MS, partenze, posizioni: posizioni.filter((_, j) => j % quanti === i), seme: seme0 + i + 1 });
      return w;
    });
  };
  const avviaOttimizzatore = () => {
    const opt = cfg.ottimizzatore;
    if (!opt || ottimizzando || isSolving || editMode !== "obstacle") return;
    const req = richiestaOttimizzatore();
    if (!req) return;
    // scenario di partenza (la mappa di adesso), per le differenze nella tabella
    let rupieOraPartenza = 0, collegatePartenza = 0;
    const perTipo: Record<string, number> = {};
    for (const p of placements) {
      if (!(opt.residenze.includes(p.buildingId) || opt.produttori.includes(p.buildingId)) || scollegati.has(p)) continue;
      collegatePartenza++;
      perTipo[p.buildingId] = (perTipo[p.buildingId] ?? 0) + 1;
      rupieOraPartenza += rupieOraDi(buildings.find((b) => b.id === p.buildingId));
    }
    setPartenzaOtt({ strade: placements.filter((p) => p.buildingId === opt.strada).length, collegate: collegatePartenza, rupieOra: rupieOraPartenza, perTipo });
    ultimaRichiestaRef.current = { req, firma: firmaRichiesta(req) };
    setModoOtt("produzione");
    setTentativi([]);
    setTentativoScelto(null);
    lanciaOttimizzatore(req, [], false);
  };
  // Continua: stessa richiesta dell'ultima ricerca (se l'area o le manifatture sono cambiate
  // serve un nuovo Ottimizza), riparte dai tentativi trovati e va avanti fino a Stop
  const reqAttuale = cfg.ottimizzatore && tentativi.length > 0 && !ottimizzando ? richiestaOttimizzatore() : null;
  const puoContinuare = modoOtt === "produzione" && !!reqAttuale && !!ultimaRichiestaRef.current && firmaRichiesta(reqAttuale) === ultimaRichiestaRef.current.firma;
  const continuaOttimizzatore = () => {
    const u = ultimaRichiestaRef.current;
    if (!u || ottimizzando || isSolving || !puoContinuare) return;
    lanciaOttimizzatore(u.req, tentativi, true);
  };
  /** Mostra un tentativo sulla mappa (come un Risolvi: Annulla torna all'import). */
  const applicaTentativo = (tt: Tentativo) => {
    const opt = cfg.ottimizzatore;
    if (!opt || isSolving) return;
    const pl: Placement[] = [{ buildingId: ID_MUNICIPIO, row: tt.ambasciata.row, col: tt.ambasciata.col, w: MUNICIPIO.width, h: MUNICIPIO.height }];
    for (const s of [...tt.celleStrada, ...tt.parcheggiate]) pl.push({ buildingId: opt.strada, row: s.row, col: s.col, w: 1, h: 1 });
    for (const e of tt.edifici) pl.push({ buildingId: e.id, row: e.row, col: e.col, w: e.w, h: e.h });
    const conti = new Map<string, number>();
    for (const p of pl) if (p.buildingId !== ID_MUNICIPIO) conti.set(p.buildingId, (conti.get(p.buildingId) ?? 0) + 1);
    const nb = buildings.map((b) => ({ ...b, count: conti.get(b.id) ?? 0 }));
    setBuildings(nb);
    setPlacements(pl);
    setStatus(layoutStatus(nb, pl));
    lastSolvedRef.current = { buildings: nb.map((b) => ({ ...b })), placements: pl.map((p) => ({ ...p })) };
    setTentativoScelto(tt.strade);
  };

  // ── Ottimizzatore della diplomazia (28/11/2026, Mughal) ───────────────────
  // Arrivare alla soglia scelta togliendo meno edifici grandi possibile (Haveli, poi Shanti):
  // manifatture e Bhavan si tolgono senza problemi, nessuna residenza nuova, le strade restano
  // tutte (si rimettono dove capita), tutto si può spostare. Parte dalla mappa di adesso.
  const avviaDiplomazia = () => {
    const opt = cfg.ottimizzatore;
    if (!opt || ottimizzando || isSolving || editMode !== "obstacle") return;
    const libere = new Uint8Array(gridRows * gridCols);
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      libere[r * gridCols + c] = gridMask[r]?.[c] && !obstacles.has(cellKey(storageCell(r, c))) ? 1 : 0;
    }
    const posizioniDi = (id: string) => placements.filter((p) => p.buildingId === id).map((p) => ({ row: p.row, col: p.col }));
    const tipo = (b: BuildingType): TipoDipl => ({ id: b.id, w: b.width, h: b.height, pop: b.pop, dipl: b.diplomacy ?? 0 });
    const presente = (id: string) => placements.some((p) => p.buildingId === id);
    const usabile = (b: BuildingType) => presente(b.id) || sbloccato(b.cityentityId);
    const peso = (id: string): 0 | 1 | 2 => (id === "haveli" ? 2 : id === "shanti" ? 1 : 0);
    const canale = buildings.find((b) => b.id === "canale");
    const vialetto = buildings.find((b) => b.id === "vialetto");
    const amb = placements.find((p) => p.buildingId === ID_MUNICIPIO);
    const req: RichiestaDiplomazia = {
      righe: gridRows, colonne: gridCols, libere, ambasciata: { w: MUNICIPIO.width, h: MUNICIPIO.height },
      soglia: sogliaDipl,
      // le strade non si demoliscono mai: tutte quelle sulla mappa (almeno quelle del gioco)
      strade: Math.max(placements.filter((p) => p.buildingId === opt.strada).length, baseline.buildings.find((b) => b.id === opt.strada)?.count ?? 0),
      residenze: buildings.filter((b) => opt.residenze.includes(b.id) && presente(b.id)).map((b) => ({ tipo: tipo(b), peso: peso(b.id), posizioni: posizioniDi(b.id) })),
      diplomatici: buildings.filter((b) => opt.produttori.includes(b.id) && (b.diplomacy ?? 0) > 0 && usabile(b)).map((b) => ({ tipo: tipo(b), posizioni: posizioniDi(b.id) })),
      ...(canale && usabile(canale) ? { canale: tipo(canale) } : {}),
      ...(vialetto && usabile(vialetto) ? { vialetto: tipo(vialetto) } : {}),
      ...(amb ? { ambasciataOra: { row: amb.row, col: amb.col } } : {}),
      tempoMs: OTT_TEMPO_MS,
      // la mappa di adesso: per contare i lavori e per la ricerca a intervento minimo
      ora: placements.filter((p) => p.buildingId !== ID_MUNICIPIO).map((p) => {
        const b = buildings.find((x) => x.id === p.buildingId);
        return { id: p.buildingId, row: p.row, col: p.col, w: p.w, h: p.h, pop: b?.pop ?? 0, dipl: b?.diplomacy ?? 0 };
      }),
      idStrada: opt.strada,
    };
    const perTipo: Record<string, number> = {};
    for (const p of placements) if (p.buildingId !== ID_MUNICIPIO && p.buildingId !== opt.strada) perTipo[p.buildingId] = (perTipo[p.buildingId] ?? 0) + 1;
    setPartenzaDipl({ perTipo, diplomazia: totalDiplomazia, soglia: sogliaDipl });
    setModoOtt("diplomazia");
    setTentativiDipl([]);
    setSceltoDipl(null);
    const posizioni = posizioniAmbasciataDipl(req);
    const quanti = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1, posizioni.length));
    const liste: TentativoDipl[][] = Array.from({ length: quanti }, () => []);
    let finiti = 0;
    setOttInfinito(false);
    setTentativiChiusi(false);
    setOttimizzando(true);
    lavoratoriRef.current = Array.from({ length: quanti }, (_, i) => {
      const w = new LavoratoreDiplomazia();
      w.onmessage = (e: MessageEvent<{ tipo: "progresso" | "fine"; tentativi: TentativoDipl[] }>) => {
        liste[i] = e.data.tentativi;
        setTentativiDipl(unisciDiplomazia(liste));
        if (e.data.tipo === "fine" && ++finiti === quanti) fermaOttimizzatore();
      };
      w.onerror = () => { if (++finiti === quanti) fermaOttimizzatore(); };
      // la posizione di adesso dell'Ambasciata la prova per prima il worker che la riceve
      const mie = posizioni.filter((_, j) => j % quanti === i);
      w.postMessage({ ...req, posizioni: mie, seme: i + 1 });
      return w;
    });
  };
  /** Mostra un tentativo della diplomazia sulla mappa (come applicaTentativo). */
  const applicaDiplomazia = (tt: TentativoDipl) => {
    const opt = cfg.ottimizzatore;
    if (!opt || isSolving) return;
    const pl: Placement[] = [{ buildingId: ID_MUNICIPIO, row: tt.ambasciata.row, col: tt.ambasciata.col, w: MUNICIPIO.width, h: MUNICIPIO.height }];
    for (const s of tt.strade) pl.push({ buildingId: opt.strada, row: s.row, col: s.col, w: 1, h: 1 });
    for (const e of tt.edifici) pl.push({ buildingId: e.id, row: e.row, col: e.col, w: e.w, h: e.h });
    const conti = new Map<string, number>();
    for (const p of pl) if (p.buildingId !== ID_MUNICIPIO) conti.set(p.buildingId, (conti.get(p.buildingId) ?? 0) + 1);
    const nb = buildings.map((b) => ({ ...b, count: conti.get(b.id) ?? 0 }));
    setBuildings(nb);
    setPlacements(pl);
    setStatus(layoutStatus(nb, pl));
    lastSolvedRef.current = { buildings: nb.map((b) => ({ ...b })), placements: pl.map((p) => ({ ...p })) };
    setSceltoDipl(tt.haveliTolti + ":" + tt.shantiTolti + ":" + totaleLavori(tt.lavori));
  };
  const cambiaSogliaDipl = (n: number) => {
    setSogliaDipl(n);
    try { localStorage.setItem(CHIAVE_SOGLIA_DIPL, String(n)); } catch { /* storage pieno o bloccato */ }
  };

  // (25/11/2026) Edifici che vorrebbero la strada ma non toccano una strada collegata
  // all'Ambasciata (solo con cfg.ottimizzatore): tratteggiati sulla mappa. Le residenze
  // staccate danno solo popolazione, le manifatture e i diplomatici non producono.
  const scollegati = useMemo(() => nonCollegati(placements, cfg.ottimizzatore), [placements, cfg]);

  // (26/11/2026, solo Mughal) Confronto fra l'insediamento nel gioco (baseline = ultimo import,
  // a sinistra, sola lettura) e la disposizione nuova del planner (a destra): freccia, riepilogo
  // delle variazioni e bordi colorati su ciò che si toglie, si sposta o è nuovo. Solo dopo un
  // import, con modifiche e fuori dalle modalità espansione.
  const confronto = useMemo(() => {
    const opt = cfg.ottimizzatore;
    if (!opt || !hasImportedCity || !hasChangesFromBaseline || editMode !== "obstacle") return null;
    const bPos = Array.from(buildUnlockedBlockSet(baseline.expansions)).map(parseBlockKey);
    const bMinR = Math.min(...bPos.map((b) => b.row)), bMinC = Math.min(...bPos.map((b) => b.col));
    const bMaxR = Math.max(...bPos.map((b) => b.row)), bMaxC = Math.max(...bPos.map((b) => b.col));
    const righe = Math.max(BASE_BLOCK_ROWS, bMaxR - bMinR + 1) * BLOCK_SIZE;
    const colonne = Math.max(BASE_BLOCK_COLS, bMaxC - bMinC + 1) * BLOCK_SIZE;
    const sblocc = new Set(bPos.map((b) => blockKey(b.row, b.col)));
    const maschera = Array.from({ length: righe }, (_, r) => Array.from({ length: colonne }, (_, c) =>
      sblocc.has(blockKey(bMinR + Math.floor(r / BLOCK_SIZE), bMinC + Math.floor(c / BLOCK_SIZE)))));
    const prima = baseline.placements.map((p) => ({ p, r: p.row + bMinR * BLOCK_SIZE, c: p.col + bMinC * BLOCK_SIZE }));
    const dopo = placements.map((p) => ({ p, r: p.row + minUnlockedBlockRow * BLOCK_SIZE, c: p.col + minUnlockedBlockCol * BLOCK_SIZE }));
    const { statoPrima, statoDopo } = confrontaDisposizioni(prima, dopo);
    // riepilogo
    const conta = (l: Placement[]) => { const m = new Map<string, number>(); for (const p of l) m.set(p.buildingId, (m.get(p.buildingId) ?? 0) + 1); return m; };
    const cP = conta(baseline.placements), cD = conta(placements);
    const numeri = INITIAL_BUILDINGS
      .filter((b) => b.id !== opt.strada && (cD.get(b.id) ?? 0) !== (cP.get(b.id) ?? 0))
      .map((b) => ({ nome: t(b.nameKey, uiLang) as string, diff: (cD.get(b.id) ?? 0) - (cP.get(b.id) ?? 0) }));
    const rupie5h = (l: Placement[]) => {
      const staccati = nonCollegati(l, opt);
      let tot = 0;
      for (const p of l) {
        if (!(opt.residenze.includes(p.buildingId) || opt.produttori.includes(p.buildingId)) || staccati.has(p)) continue;
        tot += rupieOraDi(INITIAL_BUILDINGS.find((b) => b.id === p.buildingId)) * ORE_RACCOLTA;
      }
      return tot;
    };
    let stradeSpostate = 0, daSpostare = 0, ambasciataSpostata = false;
    for (const [p, st] of statoDopo) {
      if (st !== "spostato") continue;
      if (p.buildingId === opt.strada) stradeSpostate++;
      else { daSpostare++; if (p.buildingId === ID_MUNICIPIO) ambasciataSpostata = true; }
    }
    const riepilogo: DatiRiepilogo = {
      numeri,
      stradeNuove: Math.max(0, (cD.get(opt.strada) ?? 0) - (cP.get(opt.strada) ?? 0)),
      stradeSpostate, daSpostare, ambasciataSpostata,
      costoStrada: costiValuta[opt.strada] ?? INITIAL_BUILDINGS.find((b) => b.id === opt.strada)?.currency?.cost ?? 0,
      rupiePrima: rupie5h(baseline.placements), rupieDopo: rupie5h(placements),
    };
    return { righe, colonne, maschera, statoPrima, statoDopo, riepilogo };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, hasImportedCity, hasChangesFromBaseline, editMode, baseline, placements, minUnlockedBlockRow, minUnlockedBlockCol, uiLang, costiValuta]);

  // ── Nastro (2.0) ────────────────────────────────────────────────────────
  // Come il Planner: i gruppi si ricostruiscono quando cambia lo stato che
  // mostrano (firma); i click passano da azioniRef (funzioni correnti).
  const azioniRef = useRef({ solve, annulla, reset, avviaOttimizzatore, fermaOttimizzatore, continuaOttimizzatore, avviaDiplomazia, cambiaSogliaDipl });
  azioniRef.current = { solve, annulla, reset, avviaOttimizzatore, fermaOttimizzatore, continuaOttimizzatore, avviaDiplomazia, cambiaSogliaDipl };
  const risolviBloccato = (status === "success" || totalArea > maxArea || totalPopRequired > totalPopProvided || editMode !== "obstacle") && !isSolving;
  const firmaNastro = [ottimizzando, modoOtt, sogliaDipl, puoContinuare, isSolving, risolviBloccato, autoMode, hasChangesFromBaseline, hasImportedCity, editMode,
    candidateExpansionBlocks.length, removableExpansionKeys.size, uiLang].join("|");
  const onNastroRef = useRef(onNastro);
  onNastroRef.current = onNastro;
  useEffect(() => {
    const L = (k: Parameters<typeof t>[0]) => t(k, uiLang) as string;
    const b = (id: string, icon: LucideIcon, label: string, onClick: () => void, extra: Partial<Extract<RibbonItem, { kind: "button" }>> = {}): RibbonItem =>
      ({ kind: "button", id, icon, label, onClick, ...extra });
    const a = () => azioniRef.current;
    const gruppi: RibbonGroup[] = [
      { id: "pi-calcolo", label: L("r2GrpCalc"), icon: Play, priority: 3, rows: [[
        // (25/11/2026) Risolvi e Auto solo dove il solver vale (Mughal: strade e catena, non ancora)
        ...(!cfg.solver ? [] : [isSolving
          ? b("risolvi", Square, L("r2PiStop"), () => void a().solve(), { active: true, danger: true })
          : b("risolvi", Play, L("r2PiSolve"), () => void a().solve(), { disabled: risolviBloccato }),
        b("auto", Repeat, L("r2PiAuto"), () => setAutoMode(v => !v), { active: autoMode, disabled: isSolving, title: L("piratiAutoTitle") })]),
        // (25/11/2026) Mughal: ottimizzatore della disposizione al posto di Risolvi
        ...(!cfg.ottimizzatore ? [] : [ottimizzando && modoOtt === "produzione"
          ? b("ottimizza", Square, L("r2PiStop"), () => a().fermaOttimizzatore(), { active: true, danger: true })
          : b("ottimizza", Sparkles, L("r2PiOttimizza"), () => a().avviaOttimizzatore(), { disabled: ottimizzando || isSolving || editMode !== "obstacle", title: L("r2PiOttimizzaTitle") }),
          b("continua", FastForward, L("r2PiContinua"), () => a().continuaOttimizzatore(), { disabled: ottimizzando || !puoContinuare, title: L("r2PiContinuaTitle") })]),
        b("annulla", Undo2, L("r2PiUndo"), () => a().annulla(), { disabled: !hasChangesFromBaseline || isSolving || ottimizzando, title: L("piratiUndoTitle") }),
        b("reset", Trash2, L("r2PiReset"), () => a().reset(), { disabled: (!hasImportedCity && !hasChangesFromBaseline) || isSolving, title: L("piratiResetTitle"), danger: true }),
      ]] },
      // (28/11/2026) Mughal: ottimizzatore della diplomazia, con la soglia da raggiungere
      ...(!cfg.ottimizzatore ? [] : [{ id: "pi-diplomazia", label: L("r2GrpDiplomazia"), icon: Handshake, priority: 2, rows: [[
        ottimizzando && modoOtt === "diplomazia"
          ? b("ottimizza-dipl", Square, L("r2PiStop"), () => a().fermaOttimizzatore(), { active: true, danger: true })
          : b("ottimizza-dipl", Handshake, L("r2PiOttimizzaDipl"), () => a().avviaDiplomazia(), { img: iconDiplomazia, disabled: ottimizzando || isSolving || editMode !== "obstacle", title: L("r2PiOttimizzaDiplTitle") }),
        { kind: "custom", id: "soglia-dipl", render: () => (
          <label className="flex h-[22px] items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-1.5 text-[12px] text-slate-300 hover:border-slate-600" title={L("r2PiSogliaDiplTitle")}>
            <span className="text-slate-400">≥</span>
            <select value={sogliaDipl} disabled={ottimizzando} onChange={(e) => a().cambiaSogliaDipl(Number(e.currentTarget.value))}
              className="bg-slate-900 font-mono text-slate-100 outline-none">
              {SOGLIE_DIPLOMAZIA.map((n) => <option key={n} value={n}>{formatInt(n)}</option>)}
            </select>
          </label>
        ) },
      ]] } satisfies RibbonGroup]),
      { id: "pi-espansioni", label: L("r2GrpExpansions"), icon: SquarePlus, priority: 2, rows: [[
        b("piu", SquarePlus, L("r2PiAddExp"), () => setEditMode(c => (c === "add-expansion" ? "obstacle" : "add-expansion")),
          { active: editMode === "add-expansion", disabled: isSolving || candidateExpansionBlocks.length === 0,
            title: candidateExpansionBlocks.length === 0 ? L("piratiAddExpNoneTitle") : L("piratiAddExpTitle") }),
        b("meno", SquareMinus, L("r2PiRemoveExp"), () => setEditMode(c => (c === "remove-expansion" ? "obstacle" : "remove-expansion")),
          { active: editMode === "remove-expansion", danger: true, disabled: isSolving || removableExpansionKeys.size === 0,
            title: removableExpansionKeys.size === 0 ? L("piratiRemoveExpNoneTitle") : L("piratiRemoveExpTitle") }),
      ]] },
    ];
    onNastroRef.current?.(gruppi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaNastro]);

  // categorie dell'insediamento (data/insediamenti.ts)
  const buildingCategories = cfg.categorie.map((c) => ({ title: t(c.titolo, uiLang), ids: c.ids }));

  return (
    <div className="h-full min-h-0 flex flex-col font-sans">
      {/* Riga statistiche compatta: pulsanti azione (Risolvi/Reset/Bacchetta),
          Area/Popolazione (pillole), Aggiungi/Rimuovi EXP e stato ricerca, tutto
          su una riga sottile in stile toolbar filtri di FoE Optimizer (bordi
          border-slate-700/60, sfondo bg-slate-800/40, h-7, text-xs).
          shrink-0: dimensione naturale, non deve restringersi quando il
          layout sotto (planner) va in pressione verticale. */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-1 text-xs shrink-0">
        {/* 2.0: Risolvi/Stop, Auto, Annulla e Reset sono nel nastro (gruppo
            Calcolo, vedi gruppiNastro più sotto). */}
        {/* Niente bacchetta magica qui: un solo pulsante bacchetta in tutta
            l'app (header globale, App.tsx). Quando l'utente è su questa tab,
            handleWandClick smista l'import qui tramite l'handle imperativo
            esposto sopra (useImperativeHandle) invece di creare un profilo. */}

        {isSolving && (
          <div className="hidden md:flex h-7 items-center gap-1 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="text-slate-400">{t("piratiStepsLabel", uiLang)}</span>
            <span className="font-mono font-bold text-amber-400">{displaySteps.toLocaleString()}</span>
          </div>
        )}

        {/* Pillole AREA/POP con barra di riempimento: un div assoluto dietro al
            testo, largo in percentuale rispetto al massimo, che riempie da
            sinistra come una progress bar. */}
        <div
          className={cx(
            "relative flex h-7 items-center gap-1.5 rounded border px-2.5 overflow-hidden",
            totalArea > maxArea ? "border-red-500/50 bg-red-500/10" : "border-slate-700/60 bg-slate-800/40"
          )}
          title={obstacleArea > 0 ? t("piratiAreaOccupiedWithObstaclesTitle", uiLang, obstacleArea) : t("piratiAreaOccupiedTitle", uiLang)}
        >
          <div
            className={cx("absolute inset-y-0 left-0 transition-all", totalArea > maxArea ? "bg-red-500/25" : "bg-amber-500/20")}
            style={{ width: `${maxArea > 0 ? Math.min(100, (totalArea / maxArea) * 100) : 0}%` }}
          />
          <span className="relative font-semibold uppercase text-slate-400">{t("piratiAreaLabel", uiLang)}</span>
          <span className={cx("relative font-mono font-bold", totalArea > maxArea ? "text-red-400" : "text-amber-400")}>
            {totalArea}/{maxArea}
          </span>
        </div>

        <div
          className={cx(
            "relative flex h-7 items-center gap-1.5 rounded border px-2.5 overflow-hidden",
            totalPopRequired > totalPopProvided ? "border-red-500/50 bg-red-500/10" : "border-slate-700/60 bg-slate-800/40"
          )}
          title={t("piratiPopOccupiedTitle", uiLang)}
        >
          <div
            className={cx("absolute inset-y-0 left-0 transition-all", totalPopRequired > totalPopProvided ? "bg-red-500/25" : "bg-emerald-500/20")}
            style={{ width: `${totalPopProvided > 0 ? Math.min(100, (totalPopRequired / totalPopProvided) * 100) : 0}%` }}
          />
          <span className="relative font-semibold uppercase text-slate-400">{t("piratiPopLabel", uiLang)}</span>
          <span className={cx("relative font-mono font-bold", totalPopRequired > totalPopProvided ? "text-red-400" : "text-emerald-400")}>
            {totalPopRequired}/{totalPopProvided}
          </span>
        </div>

        {/* (26/11/2026) Diplomazia: serve come soglia per gli sblocchi */}
        <div className="flex h-7 items-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/10 px-2.5" title={t("insDiplomaziaTitle", uiLang)}>
          <span className="font-semibold uppercase text-sky-200">{t("insDiplomaziaLabel", uiLang)}</span>
          <span className="font-mono font-bold text-sky-300">{formatInt(totalDiplomazia)}</span>
        </div>

        {/* (25/11/2026) Valuta dell'insediamento (Mughal: Rupie): saldo dall'import, spesa per
            gli edifici aggiunti rispetto all'import (solo quelli con un prezzo nella valuta) e
            quanto resta; rosso se non basta. */}
        {cfg.valuta && (() => {
          const v = cfg.valuta;
          // punto delle migliaia come nel resto del tool (anche 6.200: toLocaleString lo omette sotto 10.000)
          const n = formatInt;
          const contiImport = new Map(baseline.buildings.map((b) => [b.id, b.count]));
          const spesa = buildings.reduce((s, b) => s + Math.max(0, b.count - (contiImport.get(b.id) ?? 0)) * (costiValuta[b.id] ?? 0), 0);
          const resto = saldoValuta === null ? null : saldoValuta - spesa;
          const rosso = resto !== null && resto < 0;
          return (
            <div
              className={cx("flex h-7 items-center gap-1.5 rounded border px-2.5",
                rosso ? "border-red-500/60 bg-red-500/15" : "border-amber-400/60 bg-amber-500/15")}
              title={saldoValuta === null ? t("mughalRupeesNoImport", uiLang)
                : t(!hasImportedCity && v.titoloIniziale ? v.titoloIniziale : v.titolo, uiLang, n(saldoValuta), n(spesa), n(resto ?? 0))}
            >
              <span className="font-semibold uppercase text-amber-200">{t(v.etichetta, uiLang)}</span>
              <span className={cx("font-mono font-bold", rosso ? "text-red-400" : "text-amber-300")}>
                {saldoValuta === null ? "—" : spesa > 0 ? `${n(saldoValuta)} − ${n(spesa)} = ${n(resto ?? 0)}` : n(saldoValuta)}
              </span>
            </div>
          );
        })()}

        {/* (25/11/2026) Insediamento senza calcolo automatico (Mughal): avviso breve sulla
            riga delle pillole, subito dopo la valuta (26/11/2026: prima su una riga sua). */}
        {!cfg.solver && (
          <div role="note" className="flex min-h-7 items-center gap-1.5 rounded border border-violet-400/50 bg-violet-500/15 px-2.5 py-0.5 text-[12px] text-violet-100">
            <Construction size={14} className="shrink-0 text-violet-300" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-violet-200">{t("insediamentoInSviluppoTitolo", uiLang)}</strong>{" "}
              {t("insediamentoInSviluppoTesto", uiLang)}
            </span>
          </div>
        )}

        {/* 2.0: +EXP / −EXP sono nel nastro (gruppo Espansioni). */}

        {/* Condizionata a `stats` (non più a status !== "idle"): le statistiche
            appartengono a UNA ricerca specifica, quindi la pillola compare solo
            dopo che una ricerca è stata eseguita e sparisce quando lo stato a
            schermo non ne è più il risultato (import/Undo/Reset azzerano stats). */}
        {stats && (
          <div className="flex h-7 items-center gap-1.5 rounded border border-slate-700/60 bg-slate-800/40 px-2.5 font-mono text-[11px] text-slate-400">
            <span>{t("piratiStepsCountLabel", uiLang, stats.steps)}</span>
            <span className="text-slate-600">·</span>
            <span>{formatTime(stats.time)}</span>
          </div>
        )}

        {/* Esito import (successo/errore): testo libero che va a capo se
            necessario, senza contenitore a riquadro (un messaggio lungo, es.
            l'errore di fazione non supportata, non va tagliato). */}
        {importMessage && (
          <div
            className={cx(
              "flex items-center gap-1.5 py-1 font-semibold",
              importMessage.kind === "success" ? "text-emerald-400" : "text-red-400"
            )}
          >
            {importMessage.kind === "success" ? <IconCheckCircle size={12} className="shrink-0" /> : <IconAlertCircle size={12} className="shrink-0" />}
            <span>{importMessage.text}</span>
          </div>
        )}

        {status === "interrupted" && (
          <div className="flex h-7 items-center gap-1.5 rounded border border-yellow-500/30 bg-yellow-500/10 px-2.5 text-yellow-400 font-semibold">
            <IconStop size={12} />
            {timedOutRef.current ? t("piratiTimedOutMessage", uiLang) : t("piratiInterruptedMessage", uiLang)}
          </div>
        )}
        {totalArea > maxArea && (
          <div className="flex h-7 items-center gap-1.5 rounded border border-orange-500/30 bg-orange-500/10 px-2.5 text-orange-400 font-semibold">
            <IconAlertCircle size={12} /> {t("piratiAreaExcessiveMessage", uiLang)}
          </div>
        )}
        {totalPopRequired > totalPopProvided && (
          <div className="flex h-7 items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2.5 text-red-400 font-semibold">
            <IconAlertCircle size={12} /> {t("piratiPopInsufficientMessage", uiLang)}
          </div>
        )}
      </div>

      {/* Layout affiancato (colonna edifici + planner) da 'sm' in su.
          h-full/min-h-0 propagano il vincolo di altezza REALE di App.tsx
          (main/section/wrapper tab resi min-h-0+overflow-hidden SOLO sulla
          tab Pirati, vedi App.tsx) fino a qui: senza, gridWrapperRef sotto
          non avrebbe un'altezza affidabile da misurare (si adatterebbe al
          proprio contenuto, la griglia stessa → dipendenza circolare).
          ⚠️ overflow-y-auto SEMPRE attivo, MAI sm:overflow-hidden (rimosso,
          agosto 2026, bug segnalato dall'utente): il breakpoint 'sm' (640px)
          guarda solo la LARGHEZZA, ma un telefono in landscape la supera
          facilmente pur avendo un'altezza reale molto ridotta (es. 915×412)
          — attivava il layout "desktop" a due colonne, pensato per schermi
          con altezza adeguata dove il contenuto si adatta internamente
          (ResizeObserver + min-h-0), disattivando lo scroll: su landscape
          mobile il contenuto in eccesso (parte della lista edifici, o il
          planner) restava tagliato fuori, IRRAGGIUNGIBILE (nessun modo di
          vederlo). Con overflow-y-auto sempre attivo, su schermi realmente
          grandi (desktop/tablet) lo scroll semplicemente non scatta mai
          (il contenuto ci sta già tutto in altezza) — nessuna regressione
          lì, e su mobile landscape resta sempre disponibile come rete di
          sicurezza. */}
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[minmax(0,410px)_1fr] gap-2 pt-1 overflow-y-auto">
        {/* Colonna destra: il planner, cioè la griglia di piazzamento.
            h-full/min-h-0 sm:only: sotto 'sm' (stack verticale) il planner
            occupa l'altezza naturale del contenuto, come la colonna edifici
            sopra di lui — il vincolo rigido vale solo nel layout affiancato.
            flex flex-col: SENZA, questo div non è un flex container, quindi
            gridWrapperRef (primo figlio, sm:h-full) occupava TUTTA l'altezza
            disponibile lasciando zero spazio per gli elementi sotto (hint
            editMode, guida import) — finivano fuori dall'area visibile,
            tagliati dall'overflow-hidden ereditato dalla catena main/section
            (bug segnalato dall'utente: "non lo vedo, è sparito"). Con
            flex-col, gridWrapperRef diventa sm:flex-1 (si adatta allo spazio
            REALMENTE residuo dopo hint/guida, che restano shrink-0) invece
            di sm:h-full fisso. */}
        <div className="order-2 min-w-0 flex flex-col sm:h-full sm:min-h-0">
          {/* (26/11/2026, Mughal) con il confronto: attuale | freccia (+ riepilogo su schermi
              larghi) | nuova, sempre affiancate; sugli schermi più stretti il riepilogo va sotto.
              Senza confronto, "contents" lascia il layout di prima */}
          <div className={confronto ? "flex w-full flex-col gap-2 sm:flex-1 sm:min-h-0" : "contents"}>
          <div className={confronto ? "flex w-full flex-row gap-2 flex-1 min-h-0" : "contents"}>
          {confronto && (
            <MappaSolaLettura righe={confronto.righe} colonne={confronto.colonne} maschera={confronto.maschera}
              ostacoli={baseline.obstacles} piazzamenti={baseline.placements} stato={confronto.statoPrima}
              edificio={(id) => (id === ID_MUNICIPIO ? MUNICIPIO : INITIAL_BUILDINGS.find((b) => b.id === id))}
              titolo={t("confrontoAttuale", uiLang) as string} uiLang={uiLang} />
          )}
          {confronto && (
            <div className="flex shrink-0 flex-col items-center justify-center gap-2 lg:w-[190px]">
              <FrecciaConfronto />
              <div className="hidden w-full lg:flex lg:justify-center"><RiepilogoConfronto d={confronto.riepilogo} uiLang={uiLang} /></div>
            </div>
          )}
          <div className={confronto ? "flex min-h-0 min-w-0 flex-1 flex-col" : "contents"}>
          {confronto && <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-violet-200">{t("confrontoNuova", uiLang)}</div>}
          <div ref={gridWrapperRef} className="flex items-start justify-center w-full sm:flex-1 sm:min-h-0">
            <div
              ref={gridContainerRef}
              className="grid gap-1 bg-slate-900 p-2 rounded border border-slate-800 relative select-none"
              style={{
                gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                // Dimensione di cella costante (~57.5px). La griglia cresce in pixel
                // con le espansioni finché c'è spazio nel wrapper, poi le celle si
                // rimpiccioliscono in entrambe le dimensioni per stare sempre
                // interamente visibile (comportamento del tool standalone).
                // gridWrapperSize.height è un vincolo REALE: App.tsx propaga
                // min-h-0/overflow-hidden da <main> fino a qui SOLO sulla tab
                // Pirati, quindi niente dipendenza circolare.
                // ⚠️ maxHeight esplicito, oltre a width: gridRows/gridCols cambiano
                // ISTANTANEAMENTE al render (es. entrando in editMode
                // 'add-expansion', che include subito i candidateExpansionBlocks
                // in gridRows/gridCols), ma gridWrapperSize arriva un frame dopo
                // dal ResizeObserver (asincrono). In quel frame di transizione
                // width era ancora calcolata sul rapporto aspectRatio vecchio,
                // e il box - pur "matematicamente" corretto a regime - poteva
                // eccedere gridWrapperSize.height per un istante, facendo
                // traboccare il planner fuori dallo spazio visibile invece di
                // rimpicciolirsi. maxHeight clampa il caso limite indipendentemente
                // dal timing del resize observer.
                ...(gridWrapperSize
                  ? {
                      width: Math.min(
                        CELL_SIZE_PX * gridCols,
                        gridWrapperSize.width,
                        gridWrapperSize.height * (gridCols / gridRows)
                      ),
                      maxHeight: gridWrapperSize.height,
                    }
                  : { maxWidth: `${CELL_SIZE_PX * gridCols}px`, width: "100%" }),
                aspectRatio: `${gridCols} / ${gridRows}`,
                touchAction: draggedPlacement ? "none" : "auto",
              }}
              onPointerMove={(event) => {
                if (!draggedPlacement) return;
                event.preventDefault();
                handlePlacementPointerMove(event);
              }}
              onPointerUp={(event) => {
                if (!draggedPlacement) return;
                finishDrag(event);
              }}
              onPointerCancel={() => {
                if (!draggedPlacement) return;
                cancelDrag();
              }}
            >
              {Array.from({ length: gridRows }, (_, row) =>
                Array.from({ length: gridCols }, (_, col) => {
                  const isValid = gridMask[row][col];
                  // Le celle ostacolo sono salvate in coordinate storage (relative al
                  // blocco sbloccato minimo); row/col qui sono invece display (relative
                  // alla griglia visualizzata, che in modalità aggiungi-espansione può
                  // estendersi oltre l'area sbloccata). Vanno riconvertite prima del lookup.
                  const obstacleStorage = displayToStorageCell(
                    displayCell(row, col),
                    minDisplayBlockRow, minDisplayBlockCol,
                    minUnlockedBlockRow, minUnlockedBlockCol,
                  );
                  const isObstacle = isValid && obstacles.has(cellKey(obstacleStorage));

                  const blockRow = minDisplayBlockRow + Math.floor(row / BLOCK_SIZE);
                  const blockCol = minDisplayBlockCol + Math.floor(col / BLOCK_SIZE);
                  const currentBlockKey = blockKey(blockRow, blockCol);
                  const isPotentialExpansionArea = ALLOWED_BLOCK_SET.has(currentBlockKey) && !unlockedBlocks.has(currentBlockKey);
                  const isAddCandidate = candidateExpansionBlocks.some((block) => block.row === blockRow && block.col === blockCol);
                  const isRemovable = removableExpansionKeys.has(currentBlockKey);
                  // Le espansioni importate non vanno evidenziate in "Rimuovi EXP": sono
                  // irremovibili per definizione, non serve segnalarle come un vincolo —
                  // restano visivamente uguali all'area sbloccata normale.
                  const isBlockedExpansion = nonRemovableExpansionKeys.has(currentBlockKey) && !importedExpansions.has(currentBlockKey);

                  // Prima di un import, si può marcare/smarcare liberamente una cella
                  // libera come ostacolo (pianificazione a mano); dopo un import gli
                  // ostacoli rappresentano dati reali e si possono solo rimuovere.
                  // canEditGrid (non solo editMode): durante una ricerca le celle non
                  // devono sembrare cliccabili (cursore/hover/tooltip), visto che il
                  // click viene comunque ignorato — stessa coerenza già applicata a
                  // +/−/× (settembre 2026).
                  const canAddObstacleHere = isValid && !isObstacle && canEditGrid && !hasImportedCity;

                  return (
                    <div
                      key={`${row},${col}`}
                      title={
                        isObstacle && canEditGrid
                          ? t("piratiCellRemoveObstacleTitle", uiLang)
                          : canAddObstacleHere
                            ? t("piratiCellAddObstacleTitle", uiLang)
                            : undefined
                      }
                      style={{
                        gridRow: row + 1,
                        gridColumn: col + 1,
                      }}
                      onClick={() => {
                        if (suppressClickAfterDragRef.current) return;
                        if (!isValid) return;
                        // Prima di un import: toggle libero (aggiunge/rimuove). Dopo un
                        // import: solo rimozione (removeObstacle applica già il gating
                        // canEditGrid al suo interno e non fa nulla se non è un ostacolo).
                        if (!hasImportedCity) toggleObstacle(row, col);
                        else removeObstacle(row, col);
                      }}
                      className={cx(
                        // Niente transition-colors: la key di questa cella è
                        // `${row},${col}` in coordinate DISPLAY, che si spostano
                        // quando si entra/esce da 'add-expansion' (la griglia si
                        // ridimensiona, minDisplayBlockRow/Col cambiano). React
                        // non sa che una cella "è la stessa" tra un render e
                        // l'altro in quel caso, quindi un'animazione di colore
                        // qui appariva applicata alla cella sbagliata per un
                        // istante — un lampo rosso "ostacolo senza X" che si
                        // spostava durante il resize. Cambio di colore istantaneo,
                        // nessuna transizione da animare erroneamente.
                        "rounded-sm border flex items-center justify-center",
                        isValid
                          ? isObstacle
                            // Dopo un import gli ostacoli si possono solo rimuovere: solo le
                            // celle già ostacolo restano cliccabili in modalità 'obstacle'
                            // (e fuori da una ricerca, vedi canEditGrid).
                            // Prima di un import restano cliccabili per lo stesso motivo
                            // (rimuovere il toggle appena aggiunto).
                            ? canEditGrid
                              ? "bg-red-950/50 border-red-500/50 cursor-pointer hover:bg-red-900/60 hover:brightness-110 hover:ring-2 hover:ring-white/40"
                              : "bg-red-950/50 border-red-500/50 pointer-events-none"
                            : canAddObstacleHere
                              ? "bg-slate-900/50 border-slate-700/40 cursor-pointer hover:bg-red-950/40 hover:border-red-500/40 hover:ring-2 hover:ring-white/40"
                              : "bg-slate-900/50 border-slate-700/40 pointer-events-none"
                          : editMode === "add-expansion" && isAddCandidate
                            ? "bg-emerald-500/8 border-emerald-500/15"
                            : editMode === "remove-expansion" && isRemovable
                              ? "bg-rose-500/8 border-rose-500/15"
                              : editMode === "remove-expansion" && isBlockedExpansion
                                ? "bg-amber-500/8 border-amber-500/15"
                                // L'area "potenzialmente sbloccabile" (sfondo tenue) ha senso
                                // Evidenziata solo in "Aggiungi EXP": fuori da lì la griglia
                                // coincide con l'area sbloccata, e una cella non valida va resa
                                // invisibile invece che sembrare "quasi sbloccata".
                                : editMode === "add-expansion" && isPotentialExpansionArea
                                  ? "bg-slate-900/30 border-slate-700/20"
                                  : "bg-transparent border-transparent pointer-events-none"
                      )}
                    >
                      {isValid && !isObstacle && <div className="w-1 h-1 bg-slate-600/25 rounded-full"></div>}
                      {isObstacle && "❌"}
                    </div>
                  );
                })
              )}

              {placements.map((placement) => {
                const building =
                  placement.buildingId === MUNICIPIO.id
                    ? MUNICIPIO
                    : buildings.find((candidate) => candidate.id === placement.buildingId)!;
                const isMunicipio = placement.buildingId === MUNICIPIO.id;
                const renderCell = storageToDisplayCell(
                  storageCell(placement.row, placement.col),
                  minDisplayBlockRow, minDisplayBlockCol,
                  minUnlockedBlockRow, minUnlockedBlockCol,
                );
                const renderRow = renderCell.row;
                const renderCol = renderCell.col;
                const isThisBeingDragged =
                  draggedPlacement &&
                  draggedPlacement.row === placement.row &&
                  draggedPlacement.col === placement.col;
                const canSwapHere = !!draggedPlacement && !isThisBeingDragged && canSwapPlacements(draggedPlacement, placement);
                const uniqueKey = `${placement.buildingId}-${placement.row}-${placement.col}`;
                const staccato = scollegati.has(placement);
                const residenza = !!cfg.ottimizzatore?.residenze.includes(placement.buildingId);
                return (
                  <div
                    key={uniqueKey}
                    onPointerDown={(event) => handlePlacementPointerDown(event, placement)}
                    title={
                      [staccato ? (t(residenza ? "mughalStaccataResidenza" : "mughalStaccatoEdificio", uiLang) as string) : null,
                        !canEditGrid ? null : isMunicipio ? t("piratiMoveTownhallTitle", uiLang) : t("piratiMoveOrSwapTitle", uiLang)]
                        .filter(Boolean).join("\n") || undefined
                    }
                    className={cx(
                      // 'group' abilita group-hover sulla X di rimozione qui sotto: va
                      // sul contenitore (non su un elemento con pointer-events-none)
                      // perché è l'hover su QUESTO div a doverla far comparire.
                      "group relative flex flex-col items-center justify-center z-10 select-none",
                      // (28/11/2026, utente) bordo di 1 px e niente ombra, come le caselle degli ostacoli:
                      // con border-2 + shadow-lg i bordi sembravano spessi e sfocati (antialiasing)
                      "rounded border hover:brightness-110 hover:ring-1 hover:ring-white/30",
                      // canEditGrid e non solo editMode: durante una ricerca il
                      // trascinamento è comunque ignorato, quindi niente cursore "sposta".
                      canEditGrid ? "cursor-move touch-none" : "cursor-default pointer-events-none",
                      canSwapHere && "ring-2 ring-amber-300 brightness-110",
                      isThisBeingDragged && "opacity-30",
                      // non collegato alla strada: tratteggiato e spento (residenze), rosso (gli altri)
                      staccato && "!border-dashed saturate-50 opacity-70",
                      // confronto con l'attuale: bianco = nuovo (28/11/2026: niente bordo sugli spostati,
                      // l'ottimizzatore sposta quasi tutto; il numero resta nelle Variazioni)
                      confronto?.statoDopo.get(placement) === "nuovo" && "outline outline-[3px] outline-white",
                      staccato && !residenza && "ring-2 ring-red-500"
                    )}
                    style={{
                      gridRow: `${renderRow + 1} / span ${placement.h}`,
                      gridColumn: `${renderCol + 1} / span ${placement.w}`,
                      padding: "2px",
                      ...buildingColorStyle(building),
                    }}
                  >
                    {/* senza icona (strade Mughal: un solo tipo) la casella resta vuota, solo il colore */}
                    {building.icon && <span className="text-xl md:text-2xl drop-shadow-md pointer-events-none">{building.icon}</span>}
                    {building.icon && (
                      <span className="text-[8px] md:text-[10px] font-black text-black/60 uppercase tracking-tighter text-center px-1 overflow-hidden whitespace-nowrap pointer-events-none">
                        {t(building.shortNameKey, uiLang)}
                      </span>
                    )}
                    {/* Il corpo dell'edificio serve solo a trascinare (sposta/scambia):
                        l'eliminazione passa esclusivamente da questa X, visibile solo in
                        hover, per evitare rimozioni accidentali con un click distratto.
                        !isSolving: removePlacement ha già il guard su canEditGrid (che
                        include !isSolving) e quindi il click sarebbe comunque no-op, ma
                        senza nascondere la X qui il pulsante restava visibile e cliccabile
                        durante una ricerca in corso — stesso problema di UX del pulsante
                        '-' sui conteggi, corretto per coerenza.
                        ⚠️ pointer-events-none finché non è visibile: Tailwind v4 avvolge
                        group-hover in @media (hover:hover), quindi su touch opacity-0 non
                        diventava mai opacity-100 ma il pulsante restava toccabile — un
                        tap sull'angolo in alto a destra eliminava l'edificio senza che
                        si vedesse nulla (bug corretto settembre 2026). Ora su touch la X
                        non c'è: si elimina col '−' della lista edifici. */}
                    {!isMunicipio && editMode === "obstacle" && !isSolving && (
                      <button
                        type="button"
                        title={t("piratiDeleteBuildingTitle", uiLang)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (suppressClickAfterDragRef.current) return;
                          removePlacement(placement.row, placement.col);
                        }}
                        className="absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 border border-red-300/60 text-white text-xs font-bold leading-none opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-red-500 hover:scale-110 transition-all shadow-md cursor-pointer touch-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}

              {draggedPlacement && dragTargetCell && (() => {
                const target = dragTargetCell;
                const building = draggedPlacement.buildingId === MUNICIPIO.id
                  ? MUNICIPIO
                  : buildings.find((b) => b.id === draggedPlacement.buildingId);
                if (!building) return null;

                const overlapping = placements.find(
                  (p) =>
                    !(p.row === draggedPlacement.row && p.col === draggedPlacement.col) &&
                    target.row < p.row + p.h &&
                    target.row + draggedPlacement.h > p.row &&
                    target.col < p.col + p.w &&
                    target.col + draggedPlacement.w > p.col
                );

                const canMove = canMovePlacementTo(draggedPlacement, target.row, target.col);
                const canSwap = overlapping ? canSwapPlacements(draggedPlacement, overlapping) : false;
                const isValidDrop = canMove || canSwap;

                return (
                  <div
                    className={cx(
                      "pointer-events-none z-20 flex flex-col items-center justify-center rounded-md border-2 shadow-2xl",
                      isValidDrop ? "ring-2 ring-amber-300" : "ring-2 ring-red-400 opacity-80"
                    )}
                    style={{
                      gridRow: `${target.row + 1} / span ${draggedPlacement.h}`,
                      gridColumn: `${target.col + 1} / span ${draggedPlacement.w}`,
                      padding: "2px",
                      ...buildingColorStyle(building),
                    }}
                  >
                    {building.icon && <span className="text-xl md:text-2xl drop-shadow-md">{building.icon}</span>}
                    {building.icon && (
                      <span className="text-[8px] md:text-[10px] font-black text-black/60 uppercase tracking-tighter text-center px-1 overflow-hidden whitespace-nowrap">
                        {t(building.shortNameKey, uiLang)}
                      </span>
                    )}
                  </div>
                );
              })()}

              {editMode === "add-expansion" &&
                candidateExpansionBlocks.map((block) => {
                  // Ostacoli dell'import che ricadono in questo blocco candidato, in
                  // coordinate locali al blocco (0..3). Si usa importedObstacleCells e
                  // non `obstacles`: l'anteprima deve restare corretta anche su un
                  // blocco richiuso, i cui ostacoli vivi sono già stati ripuliti.
                  const blockObstacleCells: { subRow: number; subCol: number }[] = [];
                  for (let subRow = 0; subRow < BLOCK_SIZE; subRow++) {
                    for (let subCol = 0; subCol < BLOCK_SIZE; subCol++) {
                      const storageRow = (block.row - minUnlockedBlockRow) * BLOCK_SIZE + subRow;
                      const storageCol = (block.col - minUnlockedBlockCol) * BLOCK_SIZE + subCol;
                      if (importedObstacleCells.has(cellKey(storageCell(storageRow, storageCol)))) {
                        blockObstacleCells.push({ subRow, subCol });
                      }
                    }
                  }

                  return (
                    <button
                      key={`add-${blockKey(block.row, block.col)}`}
                      onClick={() => addExpansion(block.row, block.col)}
                      className="z-20 rounded-lg border-2 border-dashed border-emerald-400/70 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20 transition-all grid text-[11px] font-bold"
                      style={{
                        gridRow: `${(block.row - minDisplayBlockRow) * BLOCK_SIZE + 1} / span ${BLOCK_SIZE}`,
                        gridColumn: `${(block.col - minDisplayBlockCol) * BLOCK_SIZE + 1} / span ${BLOCK_SIZE}`,
                        gridTemplateRows: `repeat(${BLOCK_SIZE}, 1fr)`,
                        gridTemplateColumns: `repeat(${BLOCK_SIZE}, 1fr)`,
                      }}
                    >
                      {blockObstacleCells.length === 0 ? (
                        <span
                          style={{
                            gridRow: `1 / span ${BLOCK_SIZE}`,
                            gridColumn: `1 / span ${BLOCK_SIZE}`,
                          }}
                          className="flex items-center justify-center"
                        >
                          {t("piratiExpansionAdd4x4", uiLang)}
                        </span>
                      ) : (
                        blockObstacleCells.map(({ subRow, subCol }) => (
                          <span
                            key={`${subRow}-${subCol}`}
                            title={t("piratiExpansionObstacleTitle", uiLang)}
                            style={{ gridRow: subRow + 1, gridColumn: subCol + 1 }}
                            className="flex items-center justify-center opacity-70 text-sm"
                          >
                            ❌
                          </span>
                        ))
                      )}
                    </button>
                  );
                })}

              {editMode === "remove-expansion" &&
                Array.from(removableExpansionKeys).map((key) => {
                  const block = parseBlockKey(key);
                  return (
                    <button
                      key={`remove-${key}`}
                      onClick={() => removeExpansion(block.row, block.col)}
                      className="z-20 rounded-lg border-2 border-dashed border-rose-400/70 bg-rose-500/12 text-rose-200 hover:bg-rose-500/20 transition-all flex items-center justify-center text-[11px] font-bold"
                      style={{
                        gridRow: `${(block.row - minDisplayBlockRow) * BLOCK_SIZE + 1} / span ${BLOCK_SIZE}`,
                        gridColumn: `${(block.col - minDisplayBlockCol) * BLOCK_SIZE + 1} / span ${BLOCK_SIZE}`,
                      }}
                    >
                      {t("piratiExpansionRemoveLabel", uiLang)}
                    </button>
                  );
                })}

              {editMode === "remove-expansion" &&
                Array.from(nonRemovableExpansionKeys)
                  .filter((key) => !importedExpansions.has(key))
                  .map((key) => {
                  const block = parseBlockKey(key);
                  // Due motivi possibili, due spiegazioni: il blocco contiene il
                  // Municipio (vedi municipioBlockKeys), oppure toglierlo isolerebbe
                  // altre espansioni. Niente pointer-events-none (c'era prima): con
                  // quello il tooltip non compariva mai; il div non ha azioni, e sotto
                  // di lui in questa modalità non c'è nulla di cliccabile.
                  return (
                    <div
                      key={`locked-remove-${key}`}
                      title={t(municipioBlockKeys.has(key) ? "piratiExpansionLockedTownhallTitle" : "piratiExpansionLockedTitle", uiLang)}
                      className="z-20 rounded-lg border-2 border-dashed border-amber-400/50 bg-amber-500/10 text-amber-200/80 flex items-center justify-center text-[10px] font-semibold cursor-not-allowed"
                      style={{
                        gridRow: `${(block.row - minDisplayBlockRow) * BLOCK_SIZE + 1} / span ${BLOCK_SIZE}`,
                        gridColumn: `${(block.col - minDisplayBlockCol) * BLOCK_SIZE + 1} / span ${BLOCK_SIZE}`,
                      }}
                    >
                      {t("piratiExpansionLockedLabel", uiLang)}
                    </div>
                  );
                })}
            </div>
          </div>
          </div>
          </div>
          {confronto && <div className="flex justify-center lg:hidden"><RiepilogoConfronto d={confronto.riepilogo} uiLang={uiLang} /></div>}
          </div>

          <p className="text-xs text-slate-400 mt-2 mb-2 sm:mb-0 text-center shrink-0">
            {editMode === "add-expansion" && t("piratiAddExpansionHint", uiLang)}
            {editMode === "remove-expansion" && t("piratiRemoveExpansionHint", uiLang)}
          </p>

          {/* Guida rapida all'import, SUBITO sotto il box griglia (non in fondo a
              tutto il layout a due colonne: con la colonna edifici a sinistra molto
              più lunga della griglia, in fondo al layout finiva troppo in basso
              nella pagina, sotto elenchi visivamente scollegati — segnalato
              dall'utente con uno screenshot). Visibile solo prima del primo import
              (stessa logica del cestino/Reset: hasImportedCity true dopo un import
              riuscito) — dopo, sarebbe solo rumore visivo permanente. Stesso
              font/stile/icona del messaggio "Nessuna città importata..." in App.tsx
              (tab Città/Inventario, tabella vuota): testo text-slate-400
              font-semibold, badge quadrato con Wand2 (stesso bordo/sfondo verde),
              NON cliccabile — solo riferimento visivo al pulsante reale della
              toolbar, incorporato nel flusso della frase. */}
          {!hasImportedCity && (
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 mt-2 text-slate-400 font-semibold text-xs shrink-0">
              <span>{t(cfg.testi.comeImportare, uiLang)}</span>
              <span
                className="relative inline-flex items-center justify-center w-7 h-7 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shrink-0"
                aria-hidden="true"
              >
                <Wand2 size={13} />
              </span>
              <span>{t("piratiImportHowToHintSuffix", uiLang)}</span>
            </div>
          )}
        </div>

        {/* Colonna sinistra: elenco edifici, per categoria, in stile FoE Optimizer
            (bordi sottili border-slate-700/60, meno padding, font più piccolo).
            ⚠️ sm:h-full sm:min-h-0 sm:overflow-y-auto (agosto 2026, bug
            segnalato dall'utente: "in desktop con finestra bassa gli ultimi
            edifici sono sempre nascosti, niente scrollbar"): nel layout
            affiancato la colonna planner (order-2, sopra) ha sm:h-full
            sm:min-h-0 — si ridimensiona internamente entro l'altezza della
            riga del grid, che è vincolata dall'altezza REALE propagata da
            App.tsx. La colonna edifici invece cresceva col proprio
            contenuto naturale (nessun vincolo di altezza): in una riga di
            CSS Grid, quando l'altra colonna FISSA l'altezza della traccia,
            una colonna senza il proprio overflow interno viene clippata
            SILENZIOSAMENTE dal grid (nessuno scroll visibile) invece di far
            scrollare il genitore — lo scroll-y del contenitore esterno
            (overflow-y-auto) non basta, serve un overflow dedicato su
            QUESTA colonna. Con sm:h-full sm:min-h-0 sm:overflow-y-auto,
            la colonna edifici ha ora il proprio scroll interno indipendente
            dal planner, esattamente come già ce l'ha il planner stesso.
            Sotto 'sm' (mobile stack verticale) resta invariato: nessun
            vincolo di altezza, cresce col contenuto come sempre — lì lo
            scroll è già gestito dal contenitore esterno. */}
        <div className="order-1 min-w-0 mt-1 sm:mt-0 sm:h-full sm:min-h-0 sm:overflow-y-auto">
          {/* (25/11/2026) Tentativi dell'ottimizzatore: uno per numero di strade, clic = sulla mappa */}
          {/* (28/11/2026) Tentativi della diplomazia: uno per numero di Haveli e Shanti tolti
              (solo quelli che non si possono fare togliendo meno), clic = sulla mappa */}
          {cfg.ottimizzatore && modoOtt === "diplomazia" && !tentativiChiusi && (ottimizzando || partenzaDipl) && (() => {
            const opt = cfg.ottimizzatore;
            const nomi = new Map(buildings.map((b) => [b.id, t(b.nameKey, uiLang) as string]));
            const corti = new Map(buildings.map((b) => [b.id, t(b.shortNameKey, uiLang) as string]));
            const manifatture = buildings.filter((b) => b.id !== ID_MUNICIPIO && b.id !== opt.strada && !opt.residenze.includes(b.id) && !opt.diplomazia.includes(b.id)).map((b) => b.id);
            const conta = (m: Record<string, number> | undefined, id: string) => (id === "manif" ? manifatture.reduce((a, x) => a + (m?.[x] ?? 0), 0) : m?.[id] ?? 0);
            // colonne: i tipi che cambiano in almeno un tentativo (Haveli e Shanti a parte)
            const candidati = ["bhavan", "manif", ...opt.diplomazia];
            const tipi = candidati.filter((id) => tentativiDipl.some((tt) => conta(tt.conti, id) !== conta(partenzaDipl?.perTipo, id)));
            const titolo = (id: string) => (id === "manif" ? (t("mughalColManifTitle", uiLang) as string) : (t("mughalColTipoTitle", uiLang, nomi.get(id) ?? id) as string));
            const testa = (id: string) => (id === "manif" ? (t("mughalColManif", uiLang) as string) : corti.get(id) ?? id);
            const segno = (d: number) => (d > 0 ? "+" + d : d < 0 ? "−" + -d : "0");
            const soglia = partenzaDipl?.soglia ?? sogliaDipl;
            return (
              <section className="mb-2 rounded border border-sky-400/40 bg-sky-500/10 p-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <Handshake size={14} className="text-sky-300" aria-hidden="true" />
                  <span className="font-bold uppercase tracking-wide text-sky-200">{t("mughalTentativiDiplTitolo", uiLang, formatInt(soglia))}</span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {ottimizzando ? t("mughalTentativiInCorso", uiLang, secondiOtt, OTT_TEMPO_MS / 1000) : t("mughalTentativiClicca", uiLang)}
                  </span>
                  <button type="button" onClick={() => { if (ottimizzando) fermaOttimizzatore(); setTentativiChiusi(true); }}
                    title={t("mughalTentativiChiudiDipl", uiLang)} aria-label={t("mughalTentativiChiudiDipl", uiLang)}
                    className="-mr-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-sky-500/25 hover:text-white">
                    <IconaChiudi size={14} />
                  </button>
                </div>
                {tentativiDipl.length === 0 ? (
                  <div className="py-1 text-slate-400">{ottimizzando ? t("mughalTentativiAttesa", uiLang) : t("mughalDiplNessuno", uiLang, formatInt(soglia))}</div>
                ) : (
                  <table className="w-full border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="text-[10.5px] text-slate-400">
                        <th className="px-1 py-0.5 text-right font-medium" title={t("mughalColToltiTitle", uiLang, nomi.get("haveli") ?? "Haveli")}>{corti.get("haveli")}</th>
                        <th className="px-1 py-0.5 text-right font-medium" title={t("mughalColToltiTitle", uiLang, nomi.get("shanti") ?? "Shanti")}>{corti.get("shanti")}</th>
                        {tipi.map((id) => <th key={id} className="px-1 py-0.5 text-right font-medium" title={titolo(id)}>{testa(id)}</th>)}
                        <th className="px-1 py-0.5 text-right font-medium" title={t("mughalColLavoriTitle", uiLang)}>{t("mughalColLavori", uiLang)}</th>
                        <th className="px-1 py-0.5 text-right font-medium" title={t("mughalColDiplTitle", uiLang)}>{t("mughalColDipl", uiLang)}</th>
                        <th className="px-1 py-0.5 text-right font-medium" title={t("mughalColPopLiberaTitle", uiLang)}>{t("mughalColPopLibera", uiLang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tentativiDipl.slice(0, 10).map((tt) => {
                        const k = tt.haveliTolti + ":" + tt.shantiTolti + ":" + totaleLavori(tt.lavori);
                        const dd = partenzaDipl ? tt.diplomazia - partenzaDipl.diplomazia : 0;
                        return (
                          <tr key={k} onClick={() => applicaDiplomazia(tt)}
                            className={cx("cursor-pointer border-t border-slate-700/50", sceltoDipl === k ? "bg-sky-500/30" : "hover:bg-sky-500/15")}
                            title={Object.entries(tt.conti).map(([id, n]) => `${nomi.get(id) ?? id}: ${n}`).join(" · ")}>
                            <td className={cx("px-1 py-0.5 text-right", tt.haveliTolti ? "text-red-300" : "text-slate-500")}>{tt.haveliTolti ? "−" + tt.haveliTolti : "0"}</td>
                            <td className={cx("px-1 py-0.5 text-right", tt.shantiTolti ? "text-red-300" : "text-slate-500")}>{tt.shantiTolti ? "−" + tt.shantiTolti : "0"}</td>
                            {tipi.map((id) => {
                              const d = conta(tt.conti, id) - conta(partenzaDipl?.perTipo, id);
                              return <td key={id} className={cx("px-1 py-0.5 text-right", d === 0 ? "text-slate-500" : "text-slate-200")}>{segno(d)}</td>;
                            })}
                            <td className="whitespace-nowrap px-1 py-0.5 text-right text-amber-200" title={t("mughalLavoriDettaglio", uiLang, tt.lavori.tolti, tt.lavori.nuovi, tt.lavori.spostati) as string}>
                              {totaleLavori(tt.lavori)}<span className="ml-0.5 text-slate-500">({tt.lavori.tolti}·{tt.lavori.nuovi}·{tt.lavori.spostati})</span>
                            </td>
                            <td className="px-1 py-0.5 text-right text-sky-300">{formatInt(tt.diplomazia)}{dd !== 0 && <span className={cx("ml-0.5", dd > 0 ? "text-green-400/80" : "text-red-400/80")}>({dd > 0 ? "+" : "−"}{formatInt(Math.abs(dd))})</span>}</td>
                            <td className="px-1 py-0.5 text-right text-emerald-300">{formatInt(tt.popolazione)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })()}
          {cfg.ottimizzatore && modoOtt === "produzione" && !tentativiChiusi && (ottimizzando || tentativi.length > 0) && (() => {
            const opt = cfg.ottimizzatore;
            const saldo = saldoValuta ?? cfg.valuta?.iniziale ?? null;
            const giaFatte = baseline.buildings.find((b) => b.id === opt.strada)?.count ?? 0;
            const costo = costiValuta[opt.strada] ?? buildings.find((b) => b.id === opt.strada)?.currency?.cost ?? 0;
            const nomi = new Map(buildings.map((b) => [b.id, t(b.nameKey, uiLang) as string]));
            // (28/11/2026, utente) una colonna per tipo di edificio collegato (residenze e produttori
            // che compaiono nei tentativi o nella partenza, nell'ordine della legenda), con la sola
            // differenza rispetto alla partenza
            // i 10 migliori dalla produzione più alta (28/11/2026: erano 5, troppo pochi con più
            // espansioni); mai quelli che costano più rupie di quante ce ne sono (il motore non li
            // cerca nemmeno: maxStrade) né (28/11/2026, utente) quelli che producono meno di adesso
            const prod5 = (rupieOra: number) => Math.round(rupieOra * 5);
            const visibili = tentativi
              .filter((tt) => (saldo === null || saldo - Math.max(0, tt.strade - giaFatte) * costo >= 0)
                && (!partenzaOtt || prod5(tt.rupieOra) >= prod5(partenzaOtt.rupieOra)))
              .sort((x, y) => y.rupieOra - x.rupieOra || x.strade - y.strade).slice(0, 10);
            const ordineTipi = [...opt.residenze, ...opt.produttori];
            const tipi = ordineTipi.filter((id) => visibili.some((tt) => tt.collegate[id]) || !!partenzaOtt?.perTipo[id]);
            const corti = new Map(buildings.map((b) => [b.id, t(b.shortNameKey, uiLang) as string]));
            return (
              <section className="mb-2 rounded border border-violet-400/40 bg-violet-500/10 p-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-300" aria-hidden="true" />
                  <span className="font-bold uppercase tracking-wide text-violet-200">{t("mughalTentativiTitolo", uiLang)}</span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {ottimizzando
                      ? (ottInfinito ? t("mughalTentativiContinua", uiLang, secondiOtt) : t("mughalTentativiInCorso", uiLang, secondiOtt, OTT_TEMPO_MS / 1000))
                      : t("mughalTentativiClicca", uiLang)}
                  </span>
                  <button type="button" onClick={() => { if (ottimizzando) fermaOttimizzatore(); setTentativiChiusi(true); }}
                    title={t("mughalTentativiChiudi", uiLang)} aria-label={t("mughalTentativiChiudi", uiLang)}
                    className="-mr-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-violet-500/25 hover:text-white">
                    <IconaChiudi size={14} />
                  </button>
                </div>
                {visibili.length === 0 ? (
                  <div className="py-1 text-slate-400">{ottimizzando ? t("mughalTentativiAttesa", uiLang)
                    : tentativi.length > 0 ? t("mughalTentativiNessunoMeglio", uiLang) : t("mughalTentativiNessuno", uiLang)}</div>
                ) : (
                  <table className="w-full border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="text-[10.5px] text-slate-400">
                        <th className="px-1 py-0.5 text-right font-medium">{t("mughalColStrade", uiLang)}</th>
                        <th className="px-1 py-0.5 text-right font-medium" title={t("mughalColRimasteTitle", uiLang)}>{t("mughalColRimaste", uiLang)}</th>
                        {tipi.map((id) => <th key={id} className="px-1 py-0.5 text-right font-medium" title={t("mughalColTipoTitle", uiLang, nomi.get(id) ?? id)}>{corti.get(id) ?? id}</th>)}
                        <th className="px-1 py-0.5 text-right font-medium" title={t("mughalColProduzioneTitle", uiLang)}>{t("mughalColProduzione", uiLang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibili.map((tt) => {
                        const rimaste = saldo === null ? null : saldo - Math.max(0, tt.strade - giaFatte) * costo;
                        const scelto = tentativoScelto === tt.strade;
                        // differenza con lo scenario di partenza (la mappa quando hai premuto Ottimizza)
                        const diff = (n: number, buonoSePiu: boolean) => {
                          if (!partenzaOtt || n === 0) return null;
                          const buono = (n > 0) === buonoSePiu;
                          return <span className={cx("ml-0.5", buono ? "text-green-400/80" : "text-red-400/80")}>({n > 0 ? "+" : "−"}{formatInt(Math.abs(n))})</span>;
                        };
                        return (
                          <tr key={tt.strade} onClick={() => applicaTentativo(tt)}
                            className={cx("cursor-pointer border-t border-slate-700/50", scelto ? "bg-violet-500/30" : "hover:bg-violet-500/15")}
                            title={[Object.entries(tt.collegate).map(([id, n]) => `${nomi.get(id) ?? id}: ${n}`).join(" · "),
                              tt.parcheggiate.length ? (t("mughalParcheggiate", uiLang, tt.parcheggiate.length) as string) : ""].filter(Boolean).join("\n")}>
                            <td className="px-1 py-0.5 text-right text-slate-200">{tt.strade}{partenzaOtt && diff(tt.strade - partenzaOtt.strade, false)}</td>
                            <td className={cx("px-1 py-0.5 text-right", rimaste !== null && rimaste < 0 ? "text-red-400" : "text-amber-300")}>{rimaste === null ? "–" : formatInt(rimaste)}</td>
                            {tipi.map((id) => {
                              // solo la differenza con la partenza (senza partenza: il numero)
                              const n = tt.collegate[id] ?? 0;
                              if (!partenzaOtt) return <td key={id} className="px-1 py-0.5 text-right text-slate-200">{n}</td>;
                              const d = n - (partenzaOtt.perTipo[id] ?? 0);
                              return <td key={id} className={cx("px-1 py-0.5 text-right", d === 0 ? "text-slate-500" : "text-slate-200")}>{d > 0 ? "+" + d : d < 0 ? "−" + -d : "0"}</td>;
                            })}
                            <td className="px-1 py-0.5 text-right text-amber-300">{formatInt(Math.round(tt.rupieOra * 5))}{partenzaOtt && diff(Math.round(tt.rupieOra * 5) - Math.round(partenzaOtt.rupieOra * 5), true)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })()}
          <section
            className={cx(
              "rounded border p-2 transition-colors",
              hasStatsWarning ? "bg-red-950/20 border-red-500/30" : "bg-slate-900/60 border-slate-700/60"
            )}
          >
            {/* (25/11/2026) Legenda come tabella unica: Edificio, Dim., Pop, Dipl., valuta
                (produzione per edificio o costo), N. con − / +. I gruppi sono righe di titolo. */}
            {(() => {
              const valuta = cfg.valuta ? (t(cfg.valuta.etichetta, uiLang) as string) : null;
              const durata = (sec: number) => (sec < 3600 ? `${Math.round(sec / 60)}m` : `${Math.round(sec / 3600)}h`);
              const trattino = <span className="text-slate-600">–</span>;
              return (
                <table className="w-full table-fixed border-collapse text-xs">
                  <colgroup>
                    <col />
                    <col style={{ width: 38 }} />
                    <col style={{ width: 40 }} />
                    <col style={{ width: 40 }} />
                    {valuta && <col style={{ width: 66 }} />}
                    <col style={{ width: 66 }} />
                  </colgroup>
                  <thead>
                    <tr className="text-[10.5px] text-slate-500">
                      <th className="px-1 pb-1 text-left font-medium">{t("piratiColBuilding", uiLang)}</th>
                      <th className="px-1 pb-1 text-right font-medium">{t("piratiColSize", uiLang)}</th>
                      <th className="px-1 pb-1 text-right font-medium">{t("piratiColPop", uiLang)}</th>
                      <th className="px-1 pb-1 text-right font-medium">{t("piratiColDiplomacy", uiLang)}</th>
                      {valuta && <th className="px-1 pb-1 text-right font-medium" title={t("piratiColCurrencyTitle", uiLang, valuta) as string}>{valuta}</th>}
                      <th className="px-1 pb-1 text-right font-medium">{t("piratiColCount", uiLang)}</th>
                    </tr>
                  </thead>
                  {buildingCategories.map((category) => {
                    const categoryBuildings = category.ids
                      .map((id) => buildings.find((building) => building.id === id))
                      .filter((building): building is BuildingType => Boolean(building));
                    return (
                      <tbody key={category.title}>
                        <tr>
                          <td colSpan={valuta ? 6 : 5} className="px-1 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{category.title}</td>
                        </tr>
                        {categoryBuildings.map((building) => {
                          // canEditGrid (non solo !isSolving): aggiungere un edificio può
                          // innescare l'auto-piazzamento (findAutoPlacement), che legge la
                          // griglia in coordinate storage — va quindi bloccato fuori da
                          // editMode 'obstacle' esattamente come le altre azioni sulla griglia.
                          const canAddAnother =
                            canEditGrid &&
                            totalArea + building.width * building.height <= maxArea;
                          const prod = building.currency?.prod;
                          const costo = costiValuta[building.id] ?? building.currency?.cost;
                          const ultima = prod && prod.length ? prod[prod.length - 1]! : null;
                          // sblocchi: casella per gli edifici che si sbloccano; bloccato = riga in grigio
                          // (si può aggiungere lo stesso, per pianificare; l'ottimizzatore no)
                          const id = building.cityentityId;
                          const diplomazia = !!cfg.ottimizzatore?.diplomazia.includes(building.id);
                          const conCasella = !!cfg.sblocchi && !!id && !cfg.sblocchi.senzaCasella.includes(id) && !diplomazia;
                          const diPartenza = !!cfg.sblocchi && !!id && cfg.sblocchi.partenza.includes(id);
                          const spento = !sbloccato(id);
                          return (
                            <tr key={building.id} className={cx("border-t border-slate-700/50", spento && "[&>td:not(:first-child)]:opacity-45")}>
                              <td className="px-1 py-1">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {cfg.sblocchi && (conCasella
                                    ? <input type="checkbox" className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-emerald-500 disabled:cursor-default disabled:opacity-60"
                                        checked={!spento} disabled={diPartenza}
                                        onChange={(e) => cambiaSblocco(id, e.currentTarget.checked)}
                                        title={t(diPartenza ? "sbloccoPartenzaTitle" : spento ? "sbloccoBloccatoTitle" : "sbloccoSbloccatoTitle", uiLang) as string}
                                        aria-label={t("sbloccoAria", uiLang, t(building.nameKey, uiLang)) as string} />
                                    : <span className="inline-block h-3.5 w-3.5 shrink-0" aria-hidden="true" />)}
                                  <span className={cx("flex min-w-0 items-center gap-1.5", spento && "opacity-45")}>
                                  {building.icon
                                    ? <span className="shrink-0 text-sm">{building.icon}</span>
                                    // senza icona: un quadratino del colore dell'edificio, come sulla mappa
                                    : <span className="ml-0.5 mr-0.5 inline-block h-3 w-3 shrink-0 rounded-sm border" style={buildingColorStyle(building)} aria-hidden="true" />}
                                  <span className="truncate font-medium text-white">{t(building.nameKey, uiLang)}</span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-1 py-1 text-right font-mono text-[11px] text-slate-400">{building.width}×{building.height}</td>
                              <td className={cx("px-1 py-1 text-right font-mono text-[11px]", building.pop > 0 ? "text-green-400" : building.pop < 0 ? "text-red-400" : "")}>
                                {building.pop > 0 ? `+${building.pop}` : building.pop < 0 ? building.pop : trattino}
                              </td>
                              <td className="px-1 py-1 text-right font-mono text-[11px] text-sky-300">
                                {building.diplomacy ? `+${building.diplomacy}` : trattino}
                              </td>
                              {valuta && (
                                <td className="px-1 py-1 text-right font-mono text-[11px]"
                                  title={prod && prod.length > 1 ? (t("piratiProdOptionsTitle", uiLang, prod.map(([q, sec]) => `${durata(sec)} ${formatInt(q)}`).join(" · ")) as string) : undefined}>
                                  {costo ? <span className="text-red-400">−{formatInt(costo)}</span>
                                    : ultima ? <span className="text-amber-300">{formatInt(ultima[0])}<span className="text-slate-500">/{durata(ultima[1])}</span></span>
                                    : trattino}
                                </td>
                              )}
                              <td className="px-1 py-1">
                                {diplomazia ? (
                                  // diplomazia: la disporrà la sua ottimizzazione, qui solo quante ce ne sono
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="w-5 text-center font-mono font-bold text-amber-400/70 text-xs">{building.count}</span>
                                    <span className="w-5" aria-hidden="true" />
                                  </div>
                                ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => updateCount(building.id, -1)}
                                    // isSolving: manca dal solo count<=0 usato altrove (updateCount
                                    // già ignora il click con isSolving, ma senza disabled qui il
                                    // pulsante restava visivamente cliccabile durante una ricerca).
                                    disabled={building.count <= 0 || isSolving}
                                    className={cx(
                                      "w-5 h-5 flex items-center justify-center rounded text-xs transition-colors",
                                      building.count <= 0 || isSolving
                                        ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                                        : "bg-slate-700 hover:bg-slate-600 text-white"
                                    )}
                                  >
                                    -
                                  </button>
                                  <span className="w-5 text-center font-mono font-bold text-amber-400 text-xs">{building.count}</span>
                                  <button
                                    onClick={() => updateCount(building.id, 1)}
                                    disabled={!canAddAnother}
                                    className={cx(
                                      "w-5 h-5 flex items-center justify-center rounded text-xs transition-colors",
                                      canAddAnother
                                        ? "bg-slate-700 hover:bg-slate-600 text-white"
                                        : "bg-slate-800 text-slate-600 cursor-not-allowed"
                                    )}
                                  >
                                    +
                                  </button>
                                </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })}
                </table>
              );
            })()}
          </section>
        </div>
      </div>
    </div>
  );
});

export default PlannerInsediamento;
