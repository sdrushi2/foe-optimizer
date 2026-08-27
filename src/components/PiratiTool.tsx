// ─────────────────────────────────────────────────────────────────────────────
//  Tool Insediamento dei Pirati (planner di piazzamento)
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
import { Wand2 } from "lucide-react";
import { isLegacyBookmarkletPayload, validateBookmarkletPirateOutpostData } from "../data/bookmarklet";
import { importCulturalOutpostPayload, ImportCulturalOutpostFailure } from "../data/importCulturalOutpost";
import { t, type UiLang } from "../data/ui-strings";
import {
  type BuildingType,
  type Placement,
  type EditMode,
  type Baseline,
  buildingColorStyle,
  storageCell,
  displayCell,
  BLOCK_SIZE,
  BASE_BLOCK_ROWS,
  BASE_BLOCK_COLS,
  CELL_SIZE_PX,
  ALLOWED_BLOCK_KEYS,
  ALLOWED_BLOCK_SET,
  DIRECTIONS,
  SMALL_CUTOFF,
  BIG_THRESHOLD,
  SOLVE_TIME_LIMIT_MS,
  MUNICIPIO,
  MUNICIPIO_INITIAL_PLACEMENT,
  INITIAL_BUILDINGS,
  INITIAL_PLACEMENTS,
  blockKey,
  cellKey,
  parseBlockKey,
  parseCellKey,
  displayToStorageCell,
  storageToDisplayCell,
  layoutStatus,
  buildUnlockedBlockSet,
  isRemovableExpansion,
} from "../data/piratiBuildings";

// Icone SVG inline (stroke, coerenti con lo stile FoE Optimizer: niente libreria
// icone esterna, controllo diretto su stroke/fill invece del glifo con colore pieno).
function IconPlay({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconStop({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function IconReset({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconAuto({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z" />
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

/**
 * Handle imperativo esposto a App.tsx: la bacchetta magica dell'header
 * globale (handleWandClick) è l'UNICO pulsante bacchetta nell'app — quando
 * l'utente si trova sulla tab Pirati, invece di creare un profilo città/
 * inventario, importa direttamente nel planner qui sotto tramite questo
 * metodo (niente pulsante/icona duplicati dentro PiratiTool stesso).
 */
export type PiratiToolHandle = {
  /** Importa un payload cultural_outpost dal testo (già letto dagli appunti
   *  dal chiamante). Restituisce l'esito per il messaggio da mostrare
   *  all'utente, sullo stesso modello di runImport/importMessage interni. */
  importFromClipboardText: (rawText: string) => { kind: "success" | "error"; text: string };
};

type PiratiToolProps = {
  uiLang: UiLang;
};

const PiratiTool = forwardRef<PiratiToolHandle, PiratiToolProps>(function PiratiTool({ uiLang }, ref) {
  const [buildings, setBuildings] = useState<BuildingType[]>(INITIAL_BUILDINGS);
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
  const lastSolvedRef = useRef<{ buildings: BuildingType[]; placements: Placement[] }>({
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
      // "pirati", vedi il div che avvolge <PiratiTool>) al primo mount,
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

  const unlockedBlocks = useMemo(() => buildUnlockedBlockSet(expansions), [expansions]);
  const unlockedBlockPositions = useMemo(() => Array.from(unlockedBlocks).map(parseBlockKey), [unlockedBlocks]);

  const candidateExpansionBlocks = useMemo(() => {
    return ALLOWED_BLOCK_KEYS.map(parseBlockKey).filter(({ row, col }) => {
      const key = blockKey(row, col);
      if (unlockedBlocks.has(key)) return false;
      return DIRECTIONS.some((direction) => unlockedBlocks.has(blockKey(row + direction.row, col + direction.col)));
    });
  }, [unlockedBlocks]);

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

  const clearSolution = () => {
    setStatus("idle");
    setPlacements((previous) => {
      const municipioPlacement = previous.find((placement) => placement.buildingId === MUNICIPIO.id);
      return [municipioPlacement ?? MUNICIPIO_INITIAL_PLACEMENT];
    });
  };

  const canAddExpansion = (blockRow: number, blockCol: number) => {
    const key = blockKey(blockRow, blockCol);
    if (!ALLOWED_BLOCK_SET.has(key)) return false;
    if (unlockedBlocks.has(key)) return false;

    // Un'espansione e sbloccabile se tocca lateralmente una qualsiasi area gia posseduta.
    // Questo vale in tutte e 4 le direzioni, non solo destra/basso.
    return DIRECTIONS.some((direction) => unlockedBlocks.has(blockKey(blockRow + direction.row, blockCol + direction.col)));
  };

  const removableExpansionKeys = useMemo(() => {
    const removable = new Set<string>();
    expansions.forEach((key) => {
      // Le espansioni importate riflettono lo stato reale della città in game: non
      // devono essere rimovibili dal tool, altrimenti si andrebbe fuori sincro.
      if (importedExpansions.has(key)) return;
      if (isRemovableExpansion(expansions, key)) {
        removable.add(key);
      }
    });
    return removable;
  }, [expansions, importedExpansions]);

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
    const isOccupiedByPlacement = placements.some((placement) => (
      storage.row >= placement.row &&
      storage.row < placement.row + placement.h &&
      storage.col >= placement.col &&
      storage.col < placement.col + placement.w
    ));
    if (isOccupiedByPlacement) return;

    setObstacles((previous) => {
      const key = cellKey(storage);
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
      setPlacements((previous) => previous.map((placement) => ({ ...placement, row: placement.row + rowDelta, col: placement.col + colDelta })));
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
    const hasPlacementInExpansion = placements.some((placement) => {
      return (
        placement.row < removedRowEnd &&
        placement.row + placement.h > removedRowStart &&
        placement.col < removedColEnd &&
        placement.col + placement.w > removedColStart
      );
    });

    const nextExpansions = new Set(expansions);
    nextExpansions.delete(key);
    const nextUnlockedBlocks = buildUnlockedBlockSet(nextExpansions);
    const nextUnlockedPositions = Array.from(nextUnlockedBlocks).map(parseBlockKey);
    const nextMinRow = Math.min(...nextUnlockedPositions.map((block) => block.row));
    const nextMinCol = Math.min(...nextUnlockedPositions.map((block) => block.col));
    const rowDelta = (minUnlockedBlockRow - nextMinRow) * BLOCK_SIZE;
    const colDelta = (minUnlockedBlockCol - nextMinCol) * BLOCK_SIZE;

    setExpansions(nextExpansions);
    setObstacles((previous) => {
      // Rimuove solo gli ostacoli che ricadevano nel blocco appena richiuso: gli altri
      // ostacoli fuori dall'area sbloccata (es. anteprime in altri blocchi candidati non
      // toccati da questa rimozione) devono restare intatti, non venire cancellati.
      const withoutRemovedBlock = new Set(
        Array.from(previous).filter((obstacleKey) => {
          const { row, col } = parseCellKey(obstacleKey);
          const inRemovedBlock =
            row >= removedRowStart && row < removedRowEnd && col >= removedColStart && col < removedColEnd;
          return !inRemovedBlock;
        })
      );
      if (rowDelta === 0 && colDelta === 0) return withoutRemovedBlock;
      const shifted = new Set<string>();
      withoutRemovedBlock.forEach((obstacleKey) => {
        const { row, col } = parseCellKey(obstacleKey);
        shifted.add(cellKey(storageCell(row + rowDelta, col + colDelta)));
      });
      return shifted;
    });
    if (rowDelta !== 0 || colDelta !== 0) {
      setPlacements((previous) => previous.map((placement) => ({ ...placement, row: placement.row + rowDelta, col: placement.col + colDelta })));
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
    if (hasPlacementInExpansion) {
      clearSolution();
    }
    setEditMode("obstacle");
  };

  // Import dati: chiamato da App.tsx tramite l'handle imperativo esposto
  // sotto (useImperativeHandle), quando l'utente clicca la bacchetta magica
  // dell'header globale mentre si trova sulla tab Pirati. Non c'è più un
  // pulsante bacchetta dentro PiratiTool stesso — un solo pulsante nell'app,
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
    const hasPirateOutpostField =
      !!payload && typeof payload === "object" && "pirateOutpost" in (payload as Record<string, unknown>);
    const pirateOutpostPayload = hasPirateOutpostField
      ? (payload as Record<string, unknown>).pirateOutpost
      : undefined;

    if (!validateBookmarkletPirateOutpostData(pirateOutpostPayload)) {
      // Tre casi distinti, in ordine di probabilità/specificità:
      // 1. Il payload sembra dati città "puri" senza NESSUN supporto Pirati (bookmarklet
      //    v3, prima ancora dell'introduzione del blocco pirateOutpost) — bacchetta vecchia.
      // 2. Il payload è un BookmarkletData v4 valido ma senza pirateOutpost popolato:
      //    l'utente non ha ancora visitato il proprio Insediamento in questa sessione di
      //    gioco (i dati non sono ancora in memoria), o ha importato mentre era in visita
      //    da un altro giocatore (V, mai catturato in quel caso). Non è "bacchetta vecchia":
      //    dirlo sarebbe fuorviante, l'azione giusta è visitare l'Insediamento e riprovare.
      // 3. pirateOutpost presente ma strutturalmente malformato — generico.
      const text = isLegacyBookmarkletPayload(payload)
        ? t("piratiImportOutdatedBookmarklet", uiLang)
        : !hasPirateOutpostField || pirateOutpostPayload === undefined
          ? t("piratiImportVisitOutpostFirst", uiLang)
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
      result = importCulturalOutpostPayload(pirateOutpostPayload, known);
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
            ? t("piratiImportVisitOutpostFirst", uiLang)
            : error.detail.code === "UNSUPPORTED_FACTION"
              ? t("piratiImportUnsupportedFaction", uiLang, error.detail.faction)
              : t("piratiImportNoTownhall", uiLang);
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

      type CandidatePlacement = {
        row: number;
        col: number;
        w: number;
        h: number;
        cells: number[];
        score: number;
      };

      const cellCount = gridRows * gridCols;
      const sourceBuildings = buildingsOverride ?? buildings;

      // true se, durante questa ricerca, almeno un ramo si è fermato per aver
      // superato SMALL_CUTOFF (tentativi nella fase "solo piccoli") invece che
      // per aver davvero esaurito le alternative — un fallimento finale in
      // questo caso è un possibile FALSO NEGATIVO: potrebbe esistere una
      // soluzione che la ricerca non ha avuto il tempo di scoprire su quel
      // ramo specifico, a differenza di un fallimento "pulito" dove ogni
      // alternativa è stata davvero provata ed esclusa.
      let hitSmallCutoff = false;

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
          keepMunicipioInitial: boolean;
          result: "found" | "no-solution" | "stopped";
          steps: number;
          smallBacktracksFinal: number;
          maxFailedStatesSize: number;
          failedStatesCapHit: boolean;
          enteredSmallOnlyPhase: boolean;
        }>,
      };

      const runSearch = async (keepMunicipioInitial: boolean): Promise<Placement[] | null> => {
        let smallBacktracks = 0;
        let maxFailedStatesSize = 0;
        let failedStatesCapHit = false;
        let enteredSmallOnlyPhase = false;
        const stepsAtStart = steps;

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
          /** Il Municipio resta una classe a sé (ha un bonus di punteggio
           *  dedicato sulla sua posizione iniziale), mai fuso con altri tipi. */
          isMunicipio: boolean;
          /** Tipi concreti che compongono la classe, con il rispettivo
           *  conteggio: NON mutati durante la ricerca, servono a valle. */
          members: { id: string; count: number }[];
        };

        // Municipio già piazzato (fork "raccordo" con posizione iniziale fissa):
        // non entra nel pool, viene riaccodato dopo la ricerca.
        const seededPlacements: Placement[] = keepMunicipioInitial ? [{ ...MUNICIPIO_INITIAL_PLACEMENT }] : [];

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
              isMunicipio,
              members: [],
            };
            classByKey.set(key, shapeClass);
            buildingPool.push(shapeClass);
          }
          shapeClass.count += source.count;
          shapeClass.initialCount += source.count;
          shapeClass.members.push({ id: source.id, count: source.count });
        };

        if (!keepMunicipioInitial) addToPool(MUNICIPIO, true);
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

        if (keepMunicipioInitial) {
          for (let dr = 0; dr < MUNICIPIO.height; dr++) {
            for (let dc = 0; dc < MUNICIPIO.width; dc++) {
              const row = MUNICIPIO_INITIAL_PLACEMENT.row + dr;
              const col = MUNICIPIO_INITIAL_PLACEMENT.col + dc;
              const index = row * gridCols + col;
              if (row >= gridRows || col >= gridCols || occupied[index]) return null;
              occupied[index] = 1;
              freeCells--;
            }
          }
        }

        // Piazzamenti validi per un tipo, ordinati per punteggio euristico. Con
        // `anchor` restituisce solo quelli che coprono quella cella; senza, scansiona
        // tutta la griglia (solo per il controllo di fattibilità iniziale).
        function scorePlacement(building: ShapeClass, row: number, col: number, edgeTouches: number) {
          const isBig = building.area > BIG_THRESHOLD;
          const bigBonus = isBig ? 100 : 0;
          const cornerBonus = (row === 0 || row + building.height === gridRows) && (col === 0 || col + building.width === gridCols) ? 60 : 0;
          const initialMunicipioBonus = building.isMunicipio && row === MUNICIPIO_INITIAL_PLACEMENT.row && col === MUNICIPIO_INITIAL_PLACEMENT.col ? 500 : 0;
          const edgeBonus = edgeTouches * 4;
          const areaBonus = building.area;
          return bigBonus + initialMunicipioBonus + cornerBonus + edgeBonus + areaBonus;
        }

        function generatePlacements(building: ShapeClass, anchor?: { row: number; col: number }): CandidatePlacement[] {
          const placements: CandidatePlacement[] = [];
          // Vincolare a righe/colonne che possono coprire la cella anchor riduce
          // drasticamente lo spazio da scansionare (da tutta la griglia a al più
          // width*height combinazioni) — vedi il commento più esteso su
          // generatePlacements/firstFreeIndex più sotto, nel backtracking.
          const rowStart = anchor ? Math.max(0, anchor.row - building.height + 1) : 0;
          const rowEnd = anchor ? Math.min(anchor.row, gridRows - building.height) : gridRows - building.height;
          const colStart = anchor ? Math.max(0, anchor.col - building.width + 1) : 0;
          const colEnd = anchor ? Math.min(anchor.col, gridCols - building.width) : gridCols - building.width;

          for (let row = rowStart; row <= rowEnd; row++) {
            for (let col = colStart; col <= colEnd; col++) {
              const cells: number[] = [];
              let valid = true;
              let edgeTouches = 0;

              for (let dr = 0; dr < building.height; dr++) {
                for (let dc = 0; dc < building.width; dc++) {
                  const currentRow = row + dr;
                  const currentCol = col + dc;
                  const index = currentRow * gridCols + currentCol;

                  if (occupied[index]) {
                    valid = false;
                    break;
                  }

                  const touchesEdge =
                    currentRow === 0 ||
                    currentRow === gridRows - 1 ||
                    currentCol === 0 ||
                    currentCol === gridCols - 1 ||
                    !gridMask[currentRow - 1]?.[currentCol] ||
                    !gridMask[currentRow + 1]?.[currentCol] ||
                    !gridMask[currentRow]?.[currentCol - 1] ||
                    !gridMask[currentRow]?.[currentCol + 1];

                  if (touchesEdge) edgeTouches++;
                  cells.push(index);
                }
                if (!valid) break;
              }

              if (valid) {
                placements.push({ row, col, w: building.width, h: building.height, cells, score: scorePlacement(building, row, col, edgeTouches) });
              }
            }
          }

          placements.sort((a, b) => b.score - a.score);
          return placements;
        }

        // Controllo di fattibilità iniziale una tantum (non dentro il backtracking):
        // se un tipo con count>0 non ha NESSUN piazzamento valido in tutta la
        // griglia, la ricerca fallisce subito, senza nemmeno iniziare.
        if (buildingPool.some((building) => building.count > 0 && generatePlacements(building).length === 0)) return null;

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

        // Branching ancorato alla prima cella libera (idx0): i candidati sono solo
        // quelli che la coprono, al più width*height per tipo invece di decine sparsi
        // su tutta la griglia — è ciò che tiene sotto controllo il branching factor.
        // MRV (meno candidati prima) decide solo l'ORDINE di tentativo, non esclude
        // alternative: se tutti i tipi falliscono, idx0 resta vuota per sempre e si
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
          const anchor = { row: Math.floor(idx0 / gridCols), col: idx0 % gridCols };

          const stillHasBig = hasBigRemaining();
          const enteringSmallOnly = !stillHasBig && !isSmallOnlyPhase;
          const nextIsSmallOnly = isSmallOnlyPhase || enteringSmallOnly;

          if (enteringSmallOnly) {
            smallBacktracks = 0;
            enteredSmallOnlyPhase = true;
          }

          // Candidati per OGNI classe di forma che copre idx0, ordinati per MRV
          // (meno candidati prima). Una classe senza candidati per idx0 non fa
          // fallire subito il nodo: potrebbe semplicemente non coprire questa
          // cella specifica pur avendo posizioni valide altrove.
          const typeCandidates: { typeIndex: number; candidates: CandidatePlacement[] }[] = [];
          for (let typeIndex = 0; typeIndex < buildingPool.length; typeIndex++) {
            const shapeClass = buildingPool[typeIndex];
            if (shapeClass.count <= 0) continue;
            if (nextIsSmallOnly && shapeClass.area > BIG_THRESHOLD) continue;
            const candidates = generatePlacements(shapeClass, anchor);
            if (candidates.length > 0) typeCandidates.push({ typeIndex, candidates });
          }
          typeCandidates.sort((a, b) => a.candidates.length - b.candidates.length);

          for (const { typeIndex, candidates } of typeCandidates) {
            const shapeClass = buildingPool[typeIndex];
            // L'hash del count va aggiornato in coppia: XOR fuori il valore vecchio,
            // decrementa, XOR dentro il valore nuovo (idem all'incremento sotto).
            toggleCountHash(typeIndex, shapeClass.count);
            shapeClass.count--;
            remainingArea -= shapeClass.area;
            toggleCountHash(typeIndex, shapeClass.count);

            for (const placement of candidates) {
              if (stopSolvingRef.current) break;

              for (const index of placement.cells) { occupied[index] = 1; toggleCellHash(index); }
              // Solo la geometria: il tipo concreto viene deciso a fine ricerca
              // da assignConcreteTypes (vedi il commento sulle classi di forma).
              currentPlacements.push({ classIndex: typeIndex, row: placement.row, col: placement.col, w: placement.w, h: placement.h });

              if (await backtrack(availableCells - placement.cells.length, nextIsSmallOnly, idx0 + 1)) return true;

              currentPlacements.pop();
              for (const index of placement.cells) { occupied[index] = 0; toggleCellHash(index); }

              if (nextIsSmallOnly) smallBacktracks++;
            }

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
        // piazzato, quando questo fork lo teneva fisso).
        const result = (await backtrack(freeCells, initialSmallOnly, 0)) ? assignConcreteTypes(currentPlacements) : null;
        debugInfo.runs.push({
          keepMunicipioInitial,
          result: stopSolvingRef.current ? "stopped" : result ? "found" : "no-solution",
          steps: steps - stepsAtStart,
          smallBacktracksFinal: smallBacktracks,
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
      console.info("Falso negativo possibile (SMALL_CUTOFF toccato in almeno un tentativo):", hitSmallCutoff);
      console.table(
        debugInfo.runs.map((run, i) => ({
          tentativo: i + 1,
          "municipio fisso": run.keepMunicipioInitial,
          esito: run.result,
          passi: run.steps,
          "fase small-only raggiunta": run.enteredSmallOnlyPhase,
          "backtracks small-only finali": run.smallBacktracksFinal,
          "cutoff (100.000) superato": run.smallBacktracksFinal > SMALL_CUTOFF,
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
        setBuildings(lastSolvedRef.current.buildings.map((b) => ({ ...b })));
        setPlacements(lastSolvedRef.current.placements.map((p) => ({ ...p })));
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
        setStatus("success");
      } else {
        // Nessuna soluzione per i conteggi appena impostati: non lasciare la
        // mappa vecchia con conteggi nuovi disallineati, torna sempre
        // all'ultima soluzione valida nota (lastSolvedRef non è mai vuoto).
        setBuildings(lastSolvedRef.current.buildings.map((b) => ({ ...b })));
        setPlacements(lastSolvedRef.current.placements.map((p) => ({ ...p })));
        // Stato ripristinato = di nuovo una disposizione valida: "success",
        // non "failed", così il pulsante Risolvi torna disabilitato come in
        // ogni altra situazione stabile. Ma "success" da solo sparirebbe il
        // messaggio di errore senza spiegare perché la modifica appena fatta
        // non è comparsa — un toast temporaneo colma il vuoto (stesso
        // meccanismo del toast di import, vedi useEffect su importMessage).
        setStatus("success");
        // hitSmallCutoff: distingue un fallimento "pulito" (ogni alternativa
        // provata ed esclusa: la soluzione richiesta non esiste per questi
        // conteggi) da un fallimento dove almeno un ramo si è fermato per il
        // tetto di tentativi SMALL_CUTOFF prima di esaurire davvero le
        // alternative — in quel caso potrebbe esistere una soluzione che la
        // ricerca non ha avuto modo di scoprire, messaggio diverso per non
        // far credere all'utente che il problema sia insolubile per certo.
        setImportMessage({
          kind: "error",
          text: t(hitSmallCutoff ? "piratiRestoredLastSolutionCutoffMessage" : "piratiRestoredLastSolutionMessage", uiLang),
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
      setBuildings(lastSolvedRef.current.buildings.map((b) => ({ ...b })));
      setPlacements(lastSolvedRef.current.placements.map((p) => ({ ...p })));
      setStatus("success");
      setImportMessage({ kind: "error", text: t("piratiSolverCrashed", uiLang) });
      return false;
    } finally {
      // Unico punto in cui la ricerca viene chiusa: vale per il ritorno
      // normale, per l'interruzione e per un'eccezione imprevista.
      setIsSolving(false);
      stopSolvingRef.current = false;
    }
  }, [buildings, gridCols, gridMask, gridRows, isSolving, obstacles, uiLang]);

  const updateCount = async (id: string, delta: number) => {
    if (isSolving) return;

    const targetBuilding = buildings.find((building) => building.id === id);
    if (!targetBuilding) return;
    if (delta < 0 && targetBuilding.count <= 0) return;

    const nextBuildings = buildings.map((building) =>
      building.id === id ? { ...building, count: Math.max(0, building.count + delta) } : building
    );

    const hasVisibleSolvedLayout = placements.some((placement) => placement.buildingId !== MUNICIPIO.id);

    if (delta < 0 && hasVisibleSolvedLayout && targetBuilding && targetBuilding.count > 0) {
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

    setBuildings(nextBuildings);

    clearSolution();
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

    const candidates: { row: number; col: number; score: number }[] = [];

    for (let row = 0; row <= gridRows - building.height; row++) {
      for (let col = 0; col <= gridCols - building.width; col++) {
        let canFit = true;
        let edgeTouches = 0;

        for (let dr = 0; dr < building.height; dr++) {
          for (let dc = 0; dc < building.width; dc++) {
            const currentRow = row + dr;
            const currentCol = col + dc;
            if (occupied[currentRow * gridCols + currentCol]) {
              canFit = false;
              break;
            }

            if (
              currentRow === 0 ||
              currentRow === gridRows - 1 ||
              currentCol === 0 ||
              currentCol === gridCols - 1 ||
              !gridMask[currentRow - 1]?.[currentCol] ||
              !gridMask[currentRow + 1]?.[currentCol] ||
              !gridMask[currentRow]?.[currentCol - 1] ||
              !gridMask[currentRow]?.[currentCol + 1]
            ) {
              edgeTouches++;
            }
          }
          if (!canFit) break;
        }

        if (canFit) {
          candidates.push({ row, col, score: edgeTouches });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
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

  const buildingCategories = [
    { title: t("piratiCategoryResidential", uiLang), ids: ["amaca", "capanno", "baracca"] },
    { title: t("piratiCategoryGoods", uiLang), ids: ["pescatore", "spezie", "rum", "cannoni"] },
    // Ex unico gruppo "Diplomazia", separato in due (agosto 2026, su richiesta
    // esplicita): le tre imbarcazioni producono anche Dobloni oltre a Diplomazia
    // (pop negativo più alto), i quattro moli danno solo Diplomazia pura.
    { title: t("piratiCategoryDiplomacyDoubloons", uiLang), ids: ["imbarcazione", "brigantino", "galeone"] },
    { title: t("piratiCategoryDiplomacyOnly", uiLang), ids: ["molo", "molo_lungo", "molo_largo", "grande_molo"] },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col font-sans">
      {/* Riga statistiche compatta: pulsanti azione (Risolvi/Reset/Bacchetta),
          Area/Popolazione (pillole), Aggiungi/Rimuovi EXP e stato ricerca, tutto
          su una riga sottile in stile toolbar filtri di FoE Optimizer (bordi
          border-slate-700/60, sfondo bg-slate-800/40, h-7, text-xs).
          shrink-0: dimensione naturale, non deve restringersi quando il
          layout sotto (planner) va in pressione verticale. */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-1 text-xs shrink-0">
        <button
          onClick={() => void solve()}
          // Bloccato fuori da 'obstacle' come le altre azioni sulla griglia (userebbe
          // coordinate display estese, vedi canEditGrid). Non vale con isSolving:
          // lì il bottone significa "Stop", sempre permesso.
          disabled={(status === "success" || totalArea > maxArea || totalPopRequired > totalPopProvided || editMode !== "obstacle") && !isSolving}
          className={cx(
            "flex items-center gap-1.5 h-7 px-3 rounded border font-bold transition-all shrink-0",
            isSolving
              ? "bg-red-950/40 hover:bg-red-900/50 border-red-500/40 text-red-300 animate-pulse"
              : (status === "success" || totalArea > maxArea || totalPopRequired > totalPopProvided || editMode !== "obstacle")
                ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                : "bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/40 text-amber-300"
          )}
        >
          {isSolving ? (
            <>
              <IconStop size={13} />
              {t("piratiStopLabel", uiLang)}
            </>
          ) : (
            <>
              <IconPlay size={13} />
              {t("piratiSolveLabel", uiLang)}
            </>
          )}
        </button>

        <button
          onClick={() => setAutoMode((current) => !current)}
          disabled={isSolving}
          title={t("piratiAutoTitle", uiLang)}
          aria-pressed={autoMode}
          className={cx(
            "flex items-center gap-1.5 h-7 px-3 rounded border font-bold transition-all shrink-0",
            isSolving
              ? "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
              : autoMode
                ? "bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/40 text-cyan-300"
                : "border-slate-600 bg-slate-700/20 text-slate-400 hover:bg-slate-700/40 hover:text-slate-100"
          )}
        >
          <IconAuto size={13} />
          {t("piratiAutoLabel", uiLang)}
        </button>

        <button
          onClick={() => {
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
          }}
          // isSolving: l'onClick già ignora il click con isSolving, ma senza
          // rifletterlo qui il pulsante restava visivamente attivo durante una
          // ricerca in corso (stesso problema visto sui pulsanti +/- e sulla X
          // di eliminazione placement).
          disabled={!hasChangesFromBaseline || isSolving}
          // Attivo solo se lo stato corrente si è discostato dalla baseline (stato
          // vuoto, o stato subito dopo l'ultimo import) — vedi hasChangesFromBaseline.
          className="flex items-center gap-1.5 h-7 px-3 rounded border border-slate-600 bg-slate-700/20 text-slate-400 font-bold hover:bg-slate-700/40 hover:text-slate-100 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700/20 disabled:hover:text-slate-400"
          title={t("piratiUndoTitle", uiLang)}
        >
          <IconReset size={13} />
          {t("piratiUndoLabel", uiLang)}
        </button>

        <button
          onClick={() => {
            if (isSolving || !hasImportedCity) return;
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
            // Come per un nuovo import: lo stato vuoto è "risolto" per definizione
            // (nessun edificio da piazzare oltre al municipio), diventa la nuova
            // ultima soluzione valida.
            lastSolvedRef.current = { buildings: INITIAL_BUILDINGS.map((b) => ({ ...b })), placements: INITIAL_PLACEMENTS.map((p) => ({ ...p })) };
            setHasImportedCity(false);
          }}
          // isSolving: stesso motivo del pulsante Undo sopra.
          disabled={!hasImportedCity || isSolving}
          // Stesso schema colore/stato del cestino "elimina tutti i profili"
          // nell'header (App.tsx): rosso scuro e leggero quando disabilitato
          // (niente importato, o dopo Reset), rosso più chiaro e abilitato
          // dopo un import riuscito — pilotato da hasImportedCity.
          className="flex items-center gap-1.5 h-7 px-3 rounded border border-red-500/30 bg-red-500/10 text-red-300 font-bold hover:bg-red-500/20 hover:text-red-200 hover:border-red-400/60 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-500/10 disabled:hover:text-red-300 disabled:hover:border-red-500/30"
          title={t("piratiResetTitle", uiLang)}
        >
          <IconReset size={13} />
          {t("piratiResetLabel", uiLang)}
        </button>

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

        <div className="inline-flex h-7 shrink-0 overflow-hidden rounded border border-slate-700/60" role="group">
          <button
            onClick={() => setEditMode((current) => (current === "add-expansion" ? "obstacle" : "add-expansion"))}
            disabled={isSolving || candidateExpansionBlocks.length === 0}
            title={candidateExpansionBlocks.length === 0 ? t("piratiAddExpNoneTitle", uiLang) : t("piratiAddExpTitle", uiLang)}
            className={cx(
              "px-2.5 h-full text-[11px] font-bold transition-colors",
              isSolving || candidateExpansionBlocks.length === 0
                ? "bg-slate-900 text-slate-600 cursor-not-allowed"
                : editMode === "add-expansion"
                  ? "bg-emerald-500/90 text-slate-950"
                  : "bg-slate-800/40 text-slate-400 hover:bg-emerald-500/15 hover:text-emerald-300"
            )}
          >
            {t("piratiAddExpLabel", uiLang)}
          </button>
          <button
            onClick={() => setEditMode((current) => (current === "remove-expansion" ? "obstacle" : "remove-expansion"))}
            disabled={isSolving || removableExpansionKeys.size === 0}
            title={removableExpansionKeys.size === 0 ? t("piratiRemoveExpNoneTitle", uiLang) : t("piratiRemoveExpTitle", uiLang)}
            className={cx(
              "px-2.5 h-full text-[11px] font-bold transition-colors border-l border-slate-700/60",
              isSolving || removableExpansionKeys.size === 0
                ? "bg-slate-900 text-slate-600 cursor-not-allowed"
                : editMode === "remove-expansion"
                  ? "bg-rose-500/90 text-slate-950"
                  : "bg-slate-800/40 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
            )}
          >
            {t("piratiRemoveExpLabel", uiLang)}
          </button>
        </div>

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
          proprio contenuto, la griglia stessa → dipendenza circolare). */}
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[minmax(0,270px)_1fr] gap-2 pt-1 overflow-y-auto sm:overflow-hidden">
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
              onPointerCancel={(event) => {
                if (!draggedPlacement) return;
                finishDrag(event);
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
                  const canAddObstacleHere = isValid && !isObstacle && editMode === "obstacle" && !hasImportedCity;

                  return (
                    <div
                      key={`${row},${col}`}
                      title={
                        isObstacle && editMode === "obstacle"
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
                            // celle già ostacolo restano cliccabili in modalità 'obstacle'.
                            // Prima di un import restano cliccabili per lo stesso motivo
                            // (rimuovere il toggle appena aggiunto).
                            ? editMode === "obstacle"
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
                return (
                  <div
                    key={uniqueKey}
                    onPointerDown={(event) => handlePlacementPointerDown(event, placement)}
                    title={
                      editMode !== "obstacle"
                        ? undefined
                        : isMunicipio
                          ? t("piratiMoveTownhallTitle", uiLang)
                          : t("piratiMoveOrSwapTitle", uiLang)
                    }
                    className={cx(
                      // 'group' abilita group-hover sulla X di rimozione qui sotto: va
                      // sul contenitore (non su un elemento con pointer-events-none)
                      // perché è l'hover su QUESTO div a doverla far comparire.
                      "group relative flex flex-col items-center justify-center z-10 select-none",
                      "rounded-md border-2 shadow-lg hover:brightness-110 hover:ring-1 hover:ring-white/30",
                      editMode === "obstacle" ? "cursor-move touch-none" : "cursor-default pointer-events-none",
                      canSwapHere && "ring-2 ring-amber-300 brightness-110",
                      isThisBeingDragged && "opacity-30"
                    )}
                    style={{
                      gridRow: `${renderRow + 1} / span ${placement.h}`,
                      gridColumn: `${renderCol + 1} / span ${placement.w}`,
                      padding: "2px",
                      ...buildingColorStyle(building),
                    }}
                  >
                    <span className="text-xl md:text-2xl drop-shadow-md pointer-events-none">{building.icon}</span>
                    <span className="text-[8px] md:text-[10px] font-black text-black/60 uppercase tracking-tighter text-center px-1 overflow-hidden whitespace-nowrap pointer-events-none">
                      {t(building.shortNameKey, uiLang)}
                    </span>
                    {/* Il corpo dell'edificio serve solo a trascinare (sposta/scambia):
                        l'eliminazione passa esclusivamente da questa X, visibile solo in
                        hover, per evitare rimozioni accidentali con un click distratto.
                        !isSolving: removePlacement ha già il guard su canEditGrid (che
                        include !isSolving) e quindi il click sarebbe comunque no-op, ma
                        senza nascondere la X qui il pulsante restava visibile e cliccabile
                        durante una ricerca in corso — stesso problema di UX del pulsante
                        '-' sui conteggi, corretto per coerenza. */}
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
                        className="absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 border border-red-300/60 text-white text-xs font-bold leading-none opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:scale-110 transition-all shadow-md cursor-pointer touch-none"
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
                    <span className="text-xl md:text-2xl drop-shadow-md">{building.icon}</span>
                    <span className="text-[8px] md:text-[10px] font-black text-black/60 uppercase tracking-tighter text-center px-1 overflow-hidden whitespace-nowrap">
                      {t(building.shortNameKey, uiLang)}
                    </span>
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
                  return (
                    <div
                      key={`locked-remove-${key}`}
                      title={t("piratiExpansionLockedTitle", uiLang)}
                      className="z-20 rounded-lg border-2 border-dashed border-amber-400/50 bg-amber-500/10 text-amber-200/80 flex items-center justify-center text-[10px] font-semibold pointer-events-none"
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
              <span>{t("piratiImportHowToHintPrefix", uiLang)}</span>
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
            (bordi sottili border-slate-700/60, meno padding, font più piccolo). */}
        <div className="order-1 min-w-0 mt-1 sm:mt-0">
          <section
            className={cx(
              "rounded border p-2.5 space-y-3 transition-colors",
              hasStatsWarning ? "bg-red-950/20 border-red-500/30" : "bg-slate-900/60 border-slate-700/60"
            )}
          >
            {buildingCategories.map((category) => {
              const categoryBuildings = category.ids
                .map((id) => buildings.find((building) => building.id === id))
                .filter((building): building is BuildingType => Boolean(building));

              return (
                <div key={category.title} className="space-y-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 px-0.5">{category.title}</h3>
                  <div className="rounded border border-slate-700/60 bg-slate-800/40 divide-y divide-slate-700/60">
                    {categoryBuildings.map((building) => {
                      // canEditGrid (non solo !isSolving): aggiungere un edificio può
                      // innescare l'auto-piazzamento (findAutoPlacement), che legge la
                      // griglia in coordinate storage — va quindi bloccato fuori da
                      // editMode 'obstacle' esattamente come le altre azioni sulla griglia.
                      const canAddAnother =
                        canEditGrid &&
                        totalArea + building.width * building.height <= maxArea;

                      return (
                        <div key={building.id} className="flex items-center justify-between gap-1.5 px-2 py-1 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm shrink-0">{building.icon}</span>
                            <span className="text-white font-medium truncate">{t(building.nameKey, uiLang)}</span>
                            <span className="text-slate-500 shrink-0 text-[11px]">
                              ({building.width}x{building.height}
                              {building.pop !== 0 && (
                                <>
                                  ,<span
                                    className={cx(
                                      "font-medium ml-0.5",
                                      building.pop > 0 ? "text-green-400" : "text-red-400"
                                    )}
                                  >
                                    {building.pop > 0 ? `+${building.pop}` : building.pop}
                                  </span>
                                </>
                              )}
                              )
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => updateCount(building.id, -1)}
                              // isSolving: manca dal solo count<=0 usato altrove (updateCount
                              // già ignora il click con isSolving, ma senza disabled qui il
                              // pulsante restava visivamente cliccabile durante una ricerca,
                              // dando l'impressione di un tool bloccato/non responsivo).
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
                            <span className="w-4 text-center font-mono font-bold text-amber-400 text-xs">{building.count}</span>
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
});

export default PiratiTool;
