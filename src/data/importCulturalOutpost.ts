// ─────────────────────────────────────────────────────────────────────────────
//  Import Insediamento dei Pirati (Cultural Outpost)
//
//  Portato 1:1 (agosto 2026) dal tool standalone "foe-pirati" (D:\FOE\pirati),
//  dove era già validato su dati reali. Converte il payload assoluto prodotto
//  dal ramo 'cultural_outpost' del bookmarklet (vedi data/bookmarklet.ts) in
//  coordinate relative del planner Pirati (insediamenti/PlannerInsediamento.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import { MIN_PIRATE_BOOKMARKLET_VERSION, type BookmarkletPirateOutpostData, type BookmarkletPirateEntity } from "./bookmarklet";
import { parseNumberPair } from "./piratiBuildings";

// Dimensione di un blocco di espansione (celle), stessa costante di data/piratiBuildings.ts.
const BLOCK_SIZE = 4;

/**
 * Cosa cambia da un insediamento all'altro nell'import (25/11/2026: Pirati e Mughal,
 * vedi data/insediamenti.ts). Senza configurazione valgono i Pirati.
 */
export interface ImportaConfig {
  /** cityentity_id del municipio (l'ancora dell'insediamento). */
  municipio: string;
  /** Ostacoli (1×2 o 2×1) e quale dei due è verticale (1 colonna, 2 righe). */
  ostacoli: string[];
  ostacoloVerticale: string;
  /** Entità fuori griglia o non piazzabili come edifici: ignorate. */
  ignorati: string[];
  /** Blocchi di base in coordinate blocco del TOOL ("riga:colonna"). */
  baseBlocchi: string[];
  /** Tutti i blocchi possibili: serve all'ancora "generica". */
  blocchiPermessi?: string[];
  /**
   * "pirati": la regola storica (riga più in alto e, in quella riga, il blocco più a
   * sinistra; vale perché nei Pirati nessuna espansione sta sopra la base).
   * "generica": l'unico spostamento per cui tutta la base è aperta e tutte le aree
   * cadono dentro la mappa (per gli insediamenti con espansioni su ogni lato).
   */
  ancora: "pirati" | "generica";
}

// I 5 blocchi sbloccati di base dei Pirati, in coordinate blocco del TOOL (uguali a
// BASE_UNLOCKED_BLOCK_KEYS in data/piratiBuildings.ts): sono l'ancora dell'offset.
const PIRATI: ImportaConfig = {
  municipio: "H_Pirates_Townhall",
  ostacoli: ["I_Pirates_Impediment1", "I_Pirates_Impediment2"],
  ostacoloVerticale: "I_Pirates_Impediment1",
  // cityentity_id non gestiti dal solver di piazzamento (fuori griglia/non piazzabili
  // come edifici normali): vengono ignorati durante l'import.
  ignorati: ["V_Pirates_Blackmarket", "Y_Pirates_Ship1"],
  baseBlocchi: ["0:3", "0:4", "1:2", "1:3", "1:4"],
  ancora: "pirati",
};

type ImportedObstacleCell = { row: number; col: number };
type ImportedBuildingPlacement = { cityentityId: string; row: number; col: number };
type ImportedExpansionBlock = { row: number; col: number };

/**
 * Errore di importCulturalOutpostPayload, con un `code` STABILE (non testo
 * localizzato: questo modulo è dati puri, senza accesso a uiLang/t()) invece
 * di un messaggio già scritto in italiano — lo stesso pattern di
 * BookmarkletValidationError in bookmarklet.ts. Il chiamante (PlannerInsediamento.tsx)
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
  /** Celle occupate da ostacoli (Impediment), in coordinate StorageCell del tool
   * (ancorate al blocco sbloccato minimo, base ∪ espansioni: vedi toToolCell). Ogni
   * Impediment è 1x2 o 2x1: qui è già espanso in singole celle. */
  obstacleCells: ImportedObstacleCell[];
  /** Municipio: posizione reale nel tool (row/col StorageCell), se presente nel payload. */
  townhall: { row: number; col: number } | null;
  /** Edifici piazzati (non municipio, non ostacoli, non ignorati), con cityentity_id
   * e posizione StorageCell nel tool. Il chiamante mappa cityentity_id -> BuildingType.id. */
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
  known: Map<string, string>,
  cfg: ImportaConfig = PIRATI
): ImportResult {
  const TOOL_BASE_BLOCK_KEYS = cfg.baseBlocchi;
  const IGNORED_CITYENTITY_IDS = new Set(cfg.ignorati);
  const IMPEDIMENT_CITYENTITY_IDS = new Set(cfg.ostacoli);
  // Il ramo 'cultural_outpost' del bookmarklet porta `_v` solo dalla v4 in poi
  // (vedi commento v4 in bookmarklet.ts): un payload senza `_v` viene da un
  // bookmarklet v3.1 "vecchio". Controllo PRIMA di ogni altra validazione,
  // perché un bookmarklet vecchio è la causa più probabile di qualunque altro
  // problema di struttura a valle (non solo aree assenti/fazione sbagliata).
  const usedVersion = typeof payload._v === "number" ? payload._v : 0;
  // Soglia = MIN_PIRATE_BOOKMARKLET_VERSION (4), NON la versione corrente: il
  // blocco pirateOutpost non ha cambiato forma dalla v4 e rifiutare i v4
  // costringerebbe a riscaricare la bacchetta chi ha già un payload valido.
  if (usedVersion < MIN_PIRATE_BOOKMARKLET_VERSION) {
    throw new ImportCulturalOutpostFailure({ code: "OUTDATED_BOOKMARKLET" });
  }

  if (payload.areas.length === 0) {
    throw new ImportCulturalOutpostFailure({ code: "NO_AREAS" });
  }

  // Scarta le entità malformate invece di lasciarle propagare NaN in toToolCell:
  // dati reali di gioco possono avere singoli impediment senza 'y', e un ostacolo
  // perso non giustifica il fallimento dell'intero import (a differenza di
  // townhall/aree malformati, che restano errori espliciti: sono l'ancora).
  // Il gioco OMETTE le coordinate uguali a 0 (x/y assenti = 0, verificato su dati
  // reali): si normalizzano qui invece di scartare l'entità. Una coordinata
  // presente ma non numerica resta invece un'entità malformata da scartare.
  const coordOk = (v: unknown) => v === undefined || typeof v === "number";
  const entities = payload.entities
    .filter(
      (e): e is BookmarkletPirateEntity => !!e && coordOk(e.x) && coordOk(e.y) && typeof e.cityentity_id === "string"
    )
    .map((e) => ({ ...e, x: e.x ?? 0, y: e.y ?? 0 }));

  // Un payload strutturalmente valido può appartenere a un'ALTRA fazione (il gioco
  // espone più CulturalOutpost e il bookmarklet cattura quello attivo). Senza
  // questo controllo l'import "riusciva" con un municipio di fallback e tutti gli
  // edifici scartati come non riconosciuti; la fazione si legge dal prefisso del
  // cityentity_id (es. "H_Vikings_Townhall" -> "Vikings").
  const hasPiratesTownhall = entities.some((entity) => entity.cityentity_id === cfg.municipio);
  if (!hasPiratesTownhall) {
    const foreignTownhall = entities.find((entity) => /^H_[A-Za-z]+_Townhall$/.test(entity.cityentity_id));
    const factionMatch = foreignTownhall?.cityentity_id.match(/^H_([A-Za-z]+)_Townhall$/);
    const factionName = factionMatch?.[1];
    if (factionName) {
      throw new ImportCulturalOutpostFailure({ code: "UNSUPPORTED_FACTION", faction: factionName });
    }
    throw new ImportCulturalOutpostFailure({ code: "NO_TOWNHALL" });
  }

  // 1. Offset a blocco gioco → tool, calcolato sulle 5 aree di base (uguali in ogni
  // città). Riga: il blocco più in alto del payload è sempre la riga di base più in
  // alto del tool, perché nessuna espansione sta sopra la base (ALLOWED_BLOCK_KEYS in
  // piratiBuildings.ts). Colonna: NON il minimo globale — le espansioni 2:0, 2:1,
  // 3:0, 3:1, 4:0, 4:1 stanno a sinistra della base, e con una di queste sbloccata il
  // minimo globale spostava tutto di un blocco a destra, con due blocchi base
  // "fantasma" (bug corretto settembre 2026). Si usa la riga più in alto: lì il
  // blocco più a sinistra è sempre il blocco base più a sinistra di quella riga
  // (0:3), perché in riga 0 non esiste nessuna espansione alla sua sinistra.
  const gameAreaBlocks = payload.areas.map((a) => ({
    rowBlock: Math.floor((a.y ?? 0) / BLOCK_SIZE),
    colBlock: Math.floor((a.x ?? 0) / BLOCK_SIZE),
  }));

  const gameMinRowBlock = Math.min(...gameAreaBlocks.map((b) => b.rowBlock));
  const gameTopRowMinColBlock = Math.min(
    ...gameAreaBlocks.filter((b) => b.rowBlock === gameMinRowBlock).map((b) => b.colBlock)
  );

  const toolBaseBlocks = TOOL_BASE_BLOCK_KEYS.map((key) => {
    const [row, col] = parseNumberPair(key, ":");
    return { row, col };
  });
  const toolMinRowBlock = Math.min(...toolBaseBlocks.map((b) => b.row));
  const toolTopRowMinColBlock = Math.min(
    ...toolBaseBlocks.filter((b) => b.row === toolMinRowBlock).map((b) => b.col)
  );

  let rowBlockOffset = gameMinRowBlock - toolMinRowBlock;
  let colBlockOffset = gameTopRowMinColBlock - toolTopRowMinColBlock;
  if (cfg.ancora === "generica") {
    // si prova ad allineare ogni area aperta al primo blocco della base: vale lo
    // spostamento per cui tutta la base risulta aperta e nessuna area esce dalla mappa
    const aperte = new Set(gameAreaBlocks.map((b) => `${b.rowBlock}:${b.colBlock}`));
    const permessi = new Set(cfg.blocchiPermessi ?? []);
    const primo = toolBaseBlocks.reduce((m, b) => (b.row < m.row || (b.row === m.row && b.col < m.col) ? b : m), toolBaseBlocks[0]!);
    const trovato = gameAreaBlocks.map((a) => ({ dr: a.rowBlock - primo.row, dc: a.colBlock - primo.col })).find(({ dr, dc }) =>
      toolBaseBlocks.every((b) => aperte.has(`${b.row + dr}:${b.col + dc}`))
      && gameAreaBlocks.every((a) => !permessi.size || permessi.has(`${a.rowBlock - dr}:${a.colBlock - dc}`)));
    if (trovato) { rowBlockOffset = trovato.dr; colBlockOffset = trovato.dc; }
  }

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

  // Le CELLE restituite sono in coordinate StorageCell di PlannerInsediamento: (0,0) è
  // l'angolo del blocco sbloccato più in alto/a sinistra (base ∪ espansioni
  // importate), la stessa ancora (minUnlockedBlockRow/Col) che il tool ricava da
  // buildUnlockedBlockSet — non l'angolo della sola base, che con un'espansione a
  // sinistra non è più il blocco minimo. I block-key delle espansioni restano
  // invece assoluti (sono usati letteralmente come chiavi del Set unlocked).
  const unlockedToolBlocks = [...toolBaseBlocks, ...expansionBlockSet.values()];
  const anchorRowBlock = Math.min(...unlockedToolBlocks.map((b) => b.row));
  const anchorColBlock = Math.min(...unlockedToolBlocks.map((b) => b.col));
  const rowCellOffset = (anchorRowBlock + rowBlockOffset) * BLOCK_SIZE;
  const colCellOffset = (anchorColBlock + colBlockOffset) * BLOCK_SIZE;

  const toToolCell = (gameX: number, gameY: number) => ({
    row: gameY - rowCellOffset,
    col: gameX - colCellOffset,
  });

  // 3. Entità: separa municipio, ostacoli, ignorati, riconosciuti, non riconosciuti.
  let townhall: { row: number; col: number } | null = null;
  const obstacleCells: ImportedObstacleCell[] = [];
  const buildings: ImportedBuildingPlacement[] = [];
  const unrecognizedSet = new Set<string>();

  const expandObstacle = (entity: BookmarkletPirateEntity, topLeft: { row: number; col: number }) => {
    // Il payload non porta width/length per gli Impediment: l'orientamento si deduce
    // dall'id (Impediment1 = 1x2 verticale, Impediment2 = 2x1 orizzontale).
    const isVertical = entity.cityentity_id === cfg.ostacoloVerticale;
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

    if (entity.cityentity_id === cfg.municipio) {
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
