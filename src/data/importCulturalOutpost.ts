// ─────────────────────────────────────────────────────────────────────────────
//  Import Insediamento dei Pirati (Cultural Outpost)
//
//  Portato 1:1 (agosto 2026) dal tool standalone "foe-pirati" (D:\FOE\pirati),
//  dove era già validato su dati reali. Converte il payload assoluto prodotto
//  dal ramo 'cultural_outpost' del bookmarklet (vedi data/bookmarklet.ts) in
//  coordinate relative del planner Pirati (componenti/PiratiTool.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import { CURRENT_BOOKMARKLET_VERSION, type BookmarkletPirateOutpostData, type BookmarkletPirateEntity } from "./bookmarklet";
import { parseNumberPair } from "./piratiBuildings";

// Dimensione di un blocco di espansione (celle), stessa costante di data/piratiBuildings.ts.
const BLOCK_SIZE = 4;

// I 5 blocchi sbloccati di base, in coordinate blocco del TOOL. Da tenere
// sincronizzati con BASE_UNLOCKED_BLOCK_KEYS in data/piratiBuildings.ts: sono l'ancora dell'offset.
const TOOL_BASE_BLOCK_KEYS = ["0:3", "0:4", "1:2", "1:3", "1:4"];

// cityentity_id non gestiti dal solver di piazzamento (fuori griglia/non piazzabili
// come edifici normali): vengono ignorati durante l'import.
const IGNORED_CITYENTITY_IDS = new Set(["V_Pirates_Blackmarket", "Y_Pirates_Ship1"]);

const IMPEDIMENT_CITYENTITY_IDS = new Set(["I_Pirates_Impediment1", "I_Pirates_Impediment2"]);

type ImportedObstacleCell = { row: number; col: number };
type ImportedBuildingPlacement = { cityentityId: string; row: number; col: number };
type ImportedExpansionBlock = { row: number; col: number };

/**
 * Errore di importCulturalOutpostPayload, con un `code` STABILE (non testo
 * localizzato: questo modulo è dati puri, senza accesso a uiLang/t()) invece
 * di un messaggio già scritto in italiano — lo stesso pattern di
 * BookmarkletValidationError in bookmarklet.ts. Il chiamante (PiratiTool.tsx)
 * mappa il code alla stringa tradotta tramite UI_STRINGS.
 */
export type ImportCulturalOutpostError =
  | { code: "OUTDATED_BOOKMARKLET" }
  | { code: "NO_AREAS" }
  | { code: "UNSUPPORTED_FACTION"; faction: string }
  | { code: "NO_TOWNHALL" };

/** Error concreto lanciato da importCulturalOutpostPayload, con il dettaglio
 *  strutturato in `.detail` (oltre al `.message` inglese per i log/diagnostica). */
export class ImportCulturalOutpostFailure extends Error {
  detail: ImportCulturalOutpostError;
  constructor(detail: ImportCulturalOutpostError) {
    super(
      detail.code === "OUTDATED_BOOKMARKLET"
        ? "Bookmarklet used is outdated (no _v field on the cultural_outpost payload)"
        : detail.code === "NO_AREAS"
          ? "No unlocked areas in payload"
          : detail.code === "UNSUPPORTED_FACTION"
            ? `Unsupported faction outpost: ${detail.faction}`
            : "No Pirates townhall found in payload"
    );
    this.name = "ImportCulturalOutpostFailure";
    this.detail = detail;
  }
}

export type ImportResult = {
  /** Blocchi di espansione sbloccati oltre ai 5 di base, in coordinate blocco del tool. */
  expansionBlocks: ImportedExpansionBlock[];
  /** Celle occupate da ostacoli (Impediment), in coordinate cella del tool. Ogni
   * Impediment è 1x2 o 2x1: qui è già espanso in singole celle. */
  obstacleCells: ImportedObstacleCell[];
  /** Municipio: posizione reale nel tool (row/col cella), se presente nel payload. */
  townhall: { row: number; col: number } | null;
  /** Edifici piazzati (non municipio, non ostacoli, non ignorati), con cityentity_id
   * e posizione cella nel tool. Il chiamante mappa cityentity_id -> BuildingType.id. */
  buildings: ImportedBuildingPlacement[];
  /** cityentity_id incontrati nel payload che non corrispondono a nessuna categoria nota
   * (non municipio, non impediment, non ignorati, non nella tabella di mapping fornita). */
  unrecognizedCityentityIds: string[];
};

/**
 * Converte il payload assoluto del bookmarklet in coordinate relative del tool,
 * usando le `areas` come ancora (allineate a blocchi 4x4, a differenza degli
 * edifici che possono stare a cavallo di più blocchi).
 * `known`: cityentity_id -> BuildingType.id (municipio/impediment esclusi).
 */
export function importCulturalOutpostPayload(
  payload: BookmarkletPirateOutpostData,
  known: Map<string, string>
): ImportResult {
  // Il ramo 'cultural_outpost' del bookmarklet porta `_v` solo dalla v4 in poi
  // (vedi commento v4 in bookmarklet.ts): un payload senza `_v` viene da un
  // bookmarklet v3.1 "vecchio". Controllo PRIMA di ogni altra validazione,
  // perché un bookmarklet vecchio è la causa più probabile di qualunque altro
  // problema di struttura a valle (non solo aree assenti/fazione sbagliata).
  const usedVersion = typeof payload._v === "number" ? payload._v : 0;
  if (usedVersion < CURRENT_BOOKMARKLET_VERSION) {
    throw new ImportCulturalOutpostFailure({ code: "OUTDATED_BOOKMARKLET" });
  }

  if (payload.areas.length === 0) {
    throw new ImportCulturalOutpostFailure({ code: "NO_AREAS" });
  }

  // Scarta le entità malformate invece di lasciarle propagare NaN in toToolCell:
  // dati reali di gioco possono avere singoli impediment senza 'y', e un ostacolo
  // perso non giustifica il fallimento dell'intero import (a differenza di
  // townhall/aree malformati, che restano errori espliciti: sono l'ancora).
  const entities = payload.entities.filter(
    (e): e is BookmarkletPirateEntity => !!e && typeof e.x === "number" && typeof e.y === "number" && typeof e.cityentity_id === "string"
  );

  // Un payload strutturalmente valido può appartenere a un'ALTRA fazione (il gioco
  // espone più CulturalOutpost e il bookmarklet cattura quello attivo). Senza
  // questo controllo l'import "riusciva" con un municipio di fallback e tutti gli
  // edifici scartati come non riconosciuti; la fazione si legge dal prefisso del
  // cityentity_id (es. "H_Vikings_Townhall" -> "Vikings").
  const hasPiratesTownhall = entities.some((entity) => entity.cityentity_id === "H_Pirates_Townhall");
  if (!hasPiratesTownhall) {
    const foreignTownhall = entities.find((entity) => /^H_[A-Za-z]+_Townhall$/.test(entity.cityentity_id));
    const factionMatch = foreignTownhall?.cityentity_id.match(/^H_([A-Za-z]+)_Townhall$/);
    const factionName = factionMatch?.[1];
    if (factionName) {
      throw new ImportCulturalOutpostFailure({ code: "UNSUPPORTED_FACTION", faction: factionName });
    }
    throw new ImportCulturalOutpostFailure({ code: "NO_TOWNHALL" });
  }

  // 1. Offset a blocco: allinea il blocco più in alto/a sinistra del payload al
  // corrispondente TOOL_BASE_BLOCK_KEYS (le 5 aree di base sono uguali in ogni città).
  const gameAreaBlocks = payload.areas.map((a) => ({
    rowBlock: Math.floor(a.y / BLOCK_SIZE),
    colBlock: Math.floor(a.x / BLOCK_SIZE),
  }));

  const gameMinRowBlock = Math.min(...gameAreaBlocks.map((b) => b.rowBlock));
  const gameMinColBlock = Math.min(...gameAreaBlocks.map((b) => b.colBlock));

  const toolBaseBlocks = TOOL_BASE_BLOCK_KEYS.map((key) => {
    const [row, col] = parseNumberPair(key, ":");
    return { row, col };
  });
  const toolMinRowBlock = Math.min(...toolBaseBlocks.map((b) => b.row));
  const toolMinColBlock = Math.min(...toolBaseBlocks.map((b) => b.col));

  const rowBlockOffset = gameMinRowBlock - toolMinRowBlock;
  const colBlockOffset = gameMinColBlock - toolMinColBlock;

  // Le CELLE in piratiBuildings.ts sono LOCALI: (0,0) è l'angolo del blocco base più
  // in alto/a sinistra, non la cella assoluta 0. I block-key delle espansioni restano
  // invece assoluti (sono usati letteralmente come chiavi del Set unlocked).
  const rowCellOffset = rowBlockOffset * BLOCK_SIZE + toolMinRowBlock * BLOCK_SIZE;
  const colCellOffset = colBlockOffset * BLOCK_SIZE + toolMinColBlock * BLOCK_SIZE;

  const toToolCell = (gameX: number, gameY: number) => ({
    row: gameY - rowCellOffset,
    col: gameX - colCellOffset,
  });

  // 2. Espansioni: blocchi del payload non presenti nei 5 di base.
  const baseBlockKeySet = new Set(TOOL_BASE_BLOCK_KEYS);
  const expansionBlockSet = new Map<string, ImportedExpansionBlock>();
  gameAreaBlocks.forEach((b) => {
    const toolRowBlock = b.rowBlock - rowBlockOffset;
    const toolColBlock = b.colBlock - colBlockOffset;
    const key = `${toolRowBlock}:${toolColBlock}`;
    if (!baseBlockKeySet.has(key)) {
      expansionBlockSet.set(key, { row: toolRowBlock, col: toolColBlock });
    }
  });

  // 3. Entità: separa municipio, ostacoli, ignorati, riconosciuti, non riconosciuti.
  let townhall: { row: number; col: number } | null = null;
  const obstacleCells: ImportedObstacleCell[] = [];
  const buildings: ImportedBuildingPlacement[] = [];
  const unrecognizedSet = new Set<string>();

  const expandObstacle = (entity: BookmarkletPirateEntity, topLeft: { row: number; col: number }) => {
    // Il payload non porta width/length per gli Impediment: l'orientamento si deduce
    // dall'id (Impediment1 = 1x2 verticale, Impediment2 = 2x1 orizzontale).
    const isVertical = entity.cityentity_id === "I_Pirates_Impediment1";
    if (isVertical) {
      obstacleCells.push({ row: topLeft.row, col: topLeft.col });
      obstacleCells.push({ row: topLeft.row + 1, col: topLeft.col });
    } else {
      obstacleCells.push({ row: topLeft.row, col: topLeft.col });
      obstacleCells.push({ row: topLeft.row, col: topLeft.col + 1 });
    }
  };

  entities.forEach((entity) => {
    if (IGNORED_CITYENTITY_IDS.has(entity.cityentity_id)) return;

    const cell = toToolCell(entity.x, entity.y);

    if (entity.cityentity_id === "H_Pirates_Townhall") {
      townhall = cell;
      return;
    }

    if (IMPEDIMENT_CITYENTITY_IDS.has(entity.cityentity_id)) {
      expandObstacle(entity, cell);
      return;
    }

    if (known.has(entity.cityentity_id)) {
      buildings.push({ cityentityId: entity.cityentity_id, row: cell.row, col: cell.col });
      return;
    }

    unrecognizedSet.add(entity.cityentity_id);
  });

  return {
    expansionBlocks: Array.from(expansionBlockSet.values()),
    obstacleCells,
    townhall,
    buildings,
    unrecognizedCityentityIds: Array.from(unrecognizedSet),
  };
}
