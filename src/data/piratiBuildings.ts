// ─────────────────────────────────────────────────────────────────────────────
//  Dominio Insediamento dei Pirati (tipi, costanti, funzioni pure)
//
//  Portato 1:1 (agosto 2026) dal tool standalone "foe-pirati" (D:\FOE\pirati),
//  dove era già validato. Contiene solo dati/logica pura, senza React/Preact:
//  il componente vero e proprio (state, solver, JSX) vive in
//  components/PiratiTool.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import type { UiKey } from "./ui-strings";

export type BuildingType = {
  id: string;
  /** Chiave i18n (UI_STRINGS) per il nome completo, mostrato nel pannello
   *  contatori. Risolta con t(nameKey, uiLang) dal chiamante — questo modulo
   *  resta senza dipendenza da React/uiLang, solo dal TIPO UiKey. */
  nameKey: UiKey;
  /** Chiave i18n per l'etichetta breve mostrata dentro la cella della
   *  griglia (spazio minimo): scelta a mano per lingua, non derivata
   *  automaticamente dal nome completo (name.split(" ")[0] in inglese
   *  poteva dare parole poco riconoscibili, es. "Long" invece di "Pier"). */
  shortNameKey: UiKey;
  width: number;
  height: number;
  /** Colore di riempimento e di bordo, in esadecimale: unica fonte di verità per il
   * colore dell'edificio, applicato via style inline per il render a schermo
   * (buildingColorStyle). */
  fill: string;
  stroke: string;
  icon: string;
  count: number;
  pop: number;
  /** Id reale dell'edificio in game (CityEntities), usato per riconoscerlo durante l'import. */
  cityentityId?: string;
};

/** ⚠️ Solo style inline, MAI una classe Tailwind arbitrary-value (`bg-[${fill}]`):
 * Tailwind v4 scansiona il sorgente staticamente, quindi una classe costruita a
 * runtime non genera alcun CSS e gli edifici restano senza colore. */
export function buildingColorStyle(building: Pick<BuildingType, "fill" | "stroke">) {
  return { backgroundColor: building.fill, borderColor: building.stroke };
}

export type Placement = {
  buildingId: string;
  row: number;
  col: number;
  w: number;
  h: number;
};

export type EditMode = "obstacle" | "add-expansion" | "remove-expansion";

// Snapshot dello stato "di partenza" a cui torna il Reset: è lo stato iniziale vuoto
// finché non viene fatto un import, dopodiché diventa lo stato subito dopo l'import
// (così il Reset non cancella i dati importati, ma annulla solo le modifiche manuali
// fatte dopo — piazzamenti spostati, edifici aggiunti a mano, ecc.).
export type Baseline = {
  buildings: BuildingType[];
  placements: Placement[];
  obstacles: Set<string>;
  expansions: Set<string>;
  importedExpansions: Set<string>;
  importedObstacleCells: Set<string>;
};

// Niente `export`: usato solo dentro questo modulo (DIRECTIONS, parseBlockKey).
// I consumatori esterni ricevono il tipo per inferenza dal ritorno di
// parseBlockKey, senza doverlo importare.
type BlockPosition = {
  row: number;
  col: number;
};

// Due spazi di coordinate cella, numericamente simili ma NON intercambiabili:
//   - StorageCell: in cui sono salvati obstacles/placements/importedObstacleCells,
//     ancorata a (minUnlockedBlockRow, minUnlockedBlockCol).
//   - DisplayCell: la griglia disegnata, ancorata a (minDisplayBlockRow/Col), che
//     in editMode 'add-expansion' si estende oltre l'area sbloccata.
// Le ancore differiscono SOLO in quella modalità. Il brand `__space` rende lo
// scambio un errore di compilazione invece di un bug silenzioso.
export type StorageCell = { row: number; col: number; readonly __space: "storage" };
export type DisplayCell = { row: number; col: number; readonly __space: "display" };

export function storageCell(row: number, col: number): StorageCell {
  return { row, col, __space: "storage" };
}

export function displayCell(row: number, col: number): DisplayCell {
  return { row, col, __space: "display" };
}

export const BLOCK_SIZE = 4;
export const BASE_BLOCK_ROWS = 2;
export const BASE_BLOCK_COLS = 3;
/** Dimensione ideale (in px) del lato di ogni cella del planner, usata per
 * calcolare la larghezza della griglia in base al numero di celle (vedi il
 * calcolo di gridWrapperSize in PiratiTool.tsx): 690px / 12 colonne della griglia
 * base (5 blocchi sbloccati di default, BASE_BLOCK_COLS+1 * BLOCK_SIZE). */
export const CELL_SIZE_PX = 57.5;
// Niente `export`: usata solo all'interno di questo file (nessun altro modulo
// la importa) — rimosso durante la pulizia knip (agosto 2026). importCulturalOutpost.ts
// ha una propria costante equivalente (TOOL_BASE_BLOCK_KEYS), tenuta sincronizzata a
// mano (vedi commento lì), non un import di questa.
const BASE_UNLOCKED_BLOCK_KEYS = ["0:3", "0:4", "1:2", "1:3", "1:4"];
export const ALLOWED_BLOCK_KEYS = [
  "0:3", "0:4", "0:5",
  "1:2", "1:3", "1:4", "1:5", "1:6",
  "2:0", "2:1", "2:2", "2:3", "2:4", "2:5", "2:6",
  "3:0", "3:1", "3:2", "3:3", "3:4", "3:5", "3:6",
  "4:0", "4:1", "4:2", "4:3", "4:4", "4:5",
];
export const ALLOWED_BLOCK_SET = new Set(ALLOWED_BLOCK_KEYS);
export const DIRECTIONS: BlockPosition[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export const SMALL_CUTOFF = 100000;
export const BIG_THRESHOLD = 6;
// Tetto di tempo complessivo: SMALL_CUTOFF da solo non basta (vale solo dopo aver
// piazzato tutti i pezzi grandi) e una configurazione fitta può girare per minuti.
// Oltre il limite la ricerca si ferma da sola, con messaggio dedicato (timedOutRef).
export const SOLVE_TIME_LIMIT_MS = 150_000; // 2.5 minuti

export const MUNICIPIO: BuildingType = {
  id: "municipio",
  nameKey: "piratiBuildingMunicipioName",
  shortNameKey: "piratiBuildingMunicipioShort",
  width: 4,
  height: 6,
  fill: "#ffc107",
  stroke: "#e0a800",
  icon: "🏛️",
  count: 1,
  pop: 0,
  cityentityId: "H_Pirates_Townhall",
};

// Posizione di default quando non c'è ancora nessun import (il Municipio può essere
// spostato dal giocatore in game, quindi la sua vera posizione non è fissa: viene
// letta dal payload ad ogni import — vedi importCulturalOutpostPayload/runImport).
export const MUNICIPIO_INITIAL_PLACEMENT: Placement = {
  buildingId: MUNICIPIO.id,
  row: 0,
  col: 4,
  w: MUNICIPIO.width,
  h: MUNICIPIO.height,
};

// cityentityId collega ogni tipo di edificio al suo id reale in game (CityEntities),
// usato dall'import del bookmarklet per riconoscere automaticamente cosa è piazzato.
export const INITIAL_BUILDINGS: BuildingType[] = [
  { id: "pescatore", nameKey: "piratiBuildingPescatoreName", shortNameKey: "piratiBuildingPescatoreShort", width: 3, height: 4, fill: "#ff69b4", stroke: "#e05ea0", icon: "🐟", count: 0, pop: -36, cityentityId: "B_Pirates_CulturalGoodsProduction1" },
  { id: "spezie", nameKey: "piratiBuildingSpezieName", shortNameKey: "piratiBuildingSpezieShort", width: 3, height: 3, fill: "#ff69b4", stroke: "#e05ea0", icon: "🧂", count: 0, pop: -45, cityentityId: "B_Pirates_CulturalGoodsProduction2" },
  { id: "rum", nameKey: "piratiBuildingRumName", shortNameKey: "piratiBuildingRumShort", width: 5, height: 3, fill: "#ff69b4", stroke: "#e05ea0", icon: "🥃", count: 0, pop: -27, cityentityId: "B_Pirates_CulturalGoodsProduction3" },
  { id: "cannoni", nameKey: "piratiBuildingCannoniName", shortNameKey: "piratiBuildingCannoniShort", width: 4, height: 4, fill: "#ff69b4", stroke: "#e05ea0", icon: "💣", count: 0, pop: -24, cityentityId: "B_Pirates_CulturalGoodsProduction4" },
  // Tre verdi leggermente diversi per i tre edifici residenziali (agosto 2026,
  // su richiesta esplicita): Amaca e Capanno si sono scambiati il verde che
  // avevano prima; Baracca usa un verde più scuro di quello di Capanno.
  { id: "amaca", nameKey: "piratiBuildingAmacaName", shortNameKey: "piratiBuildingAmacaShort", width: 2, height: 2, fill: "#58d68d", stroke: "#28b463", icon: "🏚️", count: 0, pop: 18, cityentityId: "R_Pirates_Residential1" },
  { id: "capanno", nameKey: "piratiBuildingCapannoName", shortNameKey: "piratiBuildingCapannoShort", width: 3, height: 3, fill: "#2ecc71", stroke: "#27ae60", icon: "🏚️", count: 0, pop: 62, cityentityId: "R_Pirates_Residential2" },
  { id: "baracca", nameKey: "piratiBuildingBaraccaName", shortNameKey: "piratiBuildingBaraccaShort", width: 4, height: 4, fill: "#239b56", stroke: "#1d8348", icon: "🏚️", count: 0, pop: 174, cityentityId: "R_Pirates_Residential3" },
  // Tutti e quattro i moli (gruppo "Solo Diplomazia") usano lo stesso blu
  // chiaro (agosto 2026, su richiesta esplicita, sostituisce la precedente
  // variazione di tonalità per singolo edificio).
  { id: "molo", nameKey: "piratiBuildingMoloName", shortNameKey: "piratiBuildingMoloShort", width: 1, height: 1, fill: "#5dade2", stroke: "#3498db", icon: "⛵", count: 0, pop: 0, cityentityId: "J_Pirates_Diplomacy1" },
  { id: "molo_lungo", nameKey: "piratiBuildingMoloLungoName", shortNameKey: "piratiBuildingMoloLungoShort", width: 3, height: 1, fill: "#5dade2", stroke: "#3498db", icon: "⛵", count: 0, pop: 0, cityentityId: "J_Pirates_Diplomacy2" },
  { id: "molo_largo", nameKey: "piratiBuildingMoloLargoName", shortNameKey: "piratiBuildingMoloLargoShort", width: 1, height: 3, fill: "#5dade2", stroke: "#3498db", icon: "⛵", count: 0, pop: 0, cityentityId: "J_Pirates_Diplomacy3" },
  { id: "grande_molo", nameKey: "piratiBuildingGrandeMoloName", shortNameKey: "piratiBuildingGrandeMoloShort", width: 3, height: 3, fill: "#5dade2", stroke: "#3498db", icon: "⛵", count: 0, pop: 0, cityentityId: "J_Pirates_Diplomacy4" },
  { id: "imbarcazione", nameKey: "piratiBuildingImbarcazioneName", shortNameKey: "piratiBuildingImbarcazioneShort", width: 2, height: 2, fill: "#3498db", stroke: "#2980b9", icon: "⛵", count: 0, pop: -17, cityentityId: "J_Pirates_Diplomacy5" },
  { id: "brigantino", nameKey: "piratiBuildingBrigantinoName", shortNameKey: "piratiBuildingBrigantinoShort", width: 3, height: 4, fill: "#3498db", stroke: "#2980b9", icon: "⛵", count: 0, pop: -51, cityentityId: "J_Pirates_Diplomacy6" },
  { id: "galeone", nameKey: "piratiBuildingGaleoneName", shortNameKey: "piratiBuildingGaleoneShort", width: 3, height: 5, fill: "#3498db", stroke: "#2980b9", icon: "⛵", count: 0, pop: -63, cityentityId: "J_Pirates_Diplomacy7" },
];

export const INITIAL_PLACEMENTS: Placement[] = [
  { buildingId: MUNICIPIO.id, row: MUNICIPIO_INITIAL_PLACEMENT.row, col: MUNICIPIO_INITIAL_PLACEMENT.col, w: MUNICIPIO.width, h: MUNICIPIO.height },
];

export function blockKey(row: number, col: number) {
  return `${row}:${col}`;
}

// `obstacles`/`placements`/`importedObstacleCells` sono sempre salvati in
// StorageCell: cellKey/parseCellKey lavorano esplicitamente in quello spazio,
// così un tentativo di passare una DisplayCell qui (senza prima convertirla)
// è un errore di tipo a compile-time invece che un disallineamento silenzioso.
export function cellKey(cell: StorageCell) {
  // Separatore ',' (non '-'): row/col possono essere negativi (celle importate fuori
  // dall'area sbloccata di base, prima della traslazione locale) e '-' come separatore
  // collide con il segno meno, corrompendo il parsing (es. "9--4" -> split('-') produce
  // ['9','','4'], e col diventava Number('') = 0 invece di -4).
  return `${cell.row},${cell.col}`;
}

// Helper condiviso per il pattern "chiave stringa a due numeri separati da un
// carattere fisso" (block key "row:col", cell key "row,col"). Le chiavi sono
// sempre generate da blockKey()/cellKey() qui sotto (mai da input esterno),
// quindi il formato a 2 componenti è un'invariante interna del modulo, non
// un'ipotesi su dati non fidati — da qui i due `?? 0` sono solo per placare
// noUncheckedIndexedAccess (uno split su una stringa nostra a formato fisso
// produce sempre 2 elementi numerici validi), non una vera gestione errori.
export function parseNumberPair(key: string, separator: string): [number, number] {
  const [a, b] = key.split(separator).map(Number);
  return [a ?? 0, b ?? 0];
}

export function parseBlockKey(key: string): BlockPosition {
  const [row, col] = parseNumberPair(key, ":");
  return { row, col };
}

export function parseCellKey(key: string): StorageCell {
  const [row, col] = parseNumberPair(key, ",");
  return storageCell(row, col);
}

// Conversione tra i due spazi (vedi StorageCell/DisplayCell): delta zero fuori da
// editMode 'add-expansion', dove invece le due ancore differiscono.
export function displayToStorageCell(
  cell: DisplayCell,
  minDisplayBlockRow: number, minDisplayBlockCol: number,
  minUnlockedBlockRow: number, minUnlockedBlockCol: number,
): StorageCell {
  return storageCell(
    cell.row + (minDisplayBlockRow - minUnlockedBlockRow) * BLOCK_SIZE,
    cell.col + (minDisplayBlockCol - minUnlockedBlockCol) * BLOCK_SIZE,
  );
}

export function storageToDisplayCell(
  cell: StorageCell,
  minDisplayBlockRow: number, minDisplayBlockCol: number,
  minUnlockedBlockRow: number, minUnlockedBlockCol: number,
): DisplayCell {
  return displayCell(
    cell.row + (minUnlockedBlockRow - minDisplayBlockRow) * BLOCK_SIZE,
    cell.col + (minUnlockedBlockCol - minDisplayBlockCol) * BLOCK_SIZE,
  );
}

/** 'success' solo se ogni edificio ha esattamente tante istanze piazzate quanto
 * il suo conteggio E la popolazione richiesta è coperta: un '+' può alzare il
 * conteggio senza riuscire a piazzare nulla (auto-piazzamento fallito), e in
 * quel caso Risolvi deve restare abilitato per sistemare il disallineamento. */
export function layoutStatus(buildings: BuildingType[], placements: Placement[]): "success" | "idle" {
  const placed = new Map<string, number>();
  for (const placement of placements) {
    if (placement.buildingId === MUNICIPIO.id) continue;
    placed.set(placement.buildingId, (placed.get(placement.buildingId) ?? 0) + 1);
  }

  let popProvided = 0;
  let popRequired = 0;
  for (const building of buildings) {
    if ((placed.get(building.id) ?? 0) !== building.count) return "idle";
    if (building.pop > 0) popProvided += building.pop * building.count;
    else popRequired += Math.abs(building.pop) * building.count;
  }

  return popRequired <= popProvided ? "success" : "idle";
}

export function buildUnlockedBlockSet(expansions: Set<string>) {
  const unlocked = new Set<string>(BASE_UNLOCKED_BLOCK_KEYS);
  expansions.forEach((key) => unlocked.add(key));
  return unlocked;
}

export function isRemovableExpansion(expansions: Set<string>, targetKey: string) {
  if (!expansions.has(targetKey)) return false;

  const remaining = new Set(expansions);
  remaining.delete(targetKey);

  const unlocked = buildUnlockedBlockSet(remaining);
  const visited = new Set<string>(BASE_UNLOCKED_BLOCK_KEYS);
  const queue = [...BASE_UNLOCKED_BLOCK_KEYS];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { row, col } = parseBlockKey(current);

    for (const direction of DIRECTIONS) {
      const nextKey = blockKey(row + direction.row, col + direction.col);
      if (unlocked.has(nextKey) && !visited.has(nextKey)) {
        visited.add(nextKey);
        queue.push(nextKey);
      }
    }
  }

  return Array.from(remaining).every((key) => visited.has(key));
}
