// ─────────────────────────────────────────────────────────────────────────────
//  data/insediamenti.ts — Configurazione degli insediamenti culturali (25/11/2026)
//
//  Il planner degli insediamenti (insediamenti/PlannerInsediamento.tsx, nato per i Pirati)
//  serve a tutti gli insediamenti: cambia solo questa configurazione (edifici, municipio, forma
//  della mappa, id del gioco per l'import, testi). Il gioco tiene UN insediamento
//  attivo in CityMap.cultural_outpost e la bacchetta lo copia in `pirateOutpost`
//  qualunque sia la civiltà.
//
//  Mughal (dati dal JSON reale RECUPERO DATI/mughal.txt, nomi inglesi dal
//  MainParser della beta; mappa delle espansioni dallo screenshot del gioco con il
//  perimetro massimo, verificata sull'import: 43 blocchi, ogni blocco chiuso ha un
//  ostacolo). Differenza importante dai Pirati: quasi tutti gli edifici chiedono la
//  strada (S_Mughals_Street1, qui "Sentiero" 1×1) e gli edifici della diplomazia
//  fanno catena con l'Ambasciata: il Risolvi dei Pirati non ne tiene conto, quindi
//  per i Mughal è spento (solver: false) finché non avrà le sue regole.
// ─────────────────────────────────────────────────────────────────────────────

import type { UiKey } from "./ui-strings";
import { type BuildingType, type Placement, INITIAL_BUILDINGS, MUNICIPIO, MUNICIPIO_INITIAL_PLACEMENT, BASE_UNLOCKED_BLOCK_KEYS,
  ALLOWED_BLOCK_KEYS, BASE_BLOCK_ROWS, BASE_BLOCK_COLS } from "./piratiBuildings";
import type { ImportaConfig } from "./importCulturalOutpost";

export type IdInsediamento = "pirati" | "mughal";

interface ConfigInsediamento {
  id: IdInsediamento;
  municipio: BuildingType;
  municipioIniziale: Placement;
  edifici: BuildingType[];
  categorie: Array<{ titolo: UiKey; ids: string[] }>;
  /** Blocchi aperti all'inizio ("riga:colonna") e tutti quelli possibili. */
  baseBlocchi: string[];
  blocchiPermessi: string[];
  baseRighe: number;
  baseColonne: number;
  importa: ImportaConfig;
  /** Il Risolvi automatico vale per questo insediamento? */
  solver: boolean;
  /**
   * Valuta dell'insediamento (Pirati: Dobloni, Mughal: Rupie), mostrata accanto ad AREA e POP
   * e come colonna della legenda. `risorsa` è la chiave nelle risorse della città (pacchetto
   * della bacchetta, `resources`) e nei costi degli edifici (CityEntities →
   * requirements.cost.resources); prezzi e produzioni di partenza in `BuildingType.currency`.
   */
  valuta?: { risorsa: string; etichetta: UiKey; titolo: UiKey; iniziale?: number; titoloIniziale?: UiKey };
  /**
   * Sblocchi degli edifici (src/insediamenti/sblocchi.ts): casella nella legenda per ogni
   * edificio con un cityentityId, tranne `partenza` (sbloccati da subito, sempre spuntati) e
   * `senzaCasella` (la strada). `prefisso` riconosce gli advancements di questa civiltà.
   */
  sblocchi?: { prefisso: string; partenza: string[]; senzaCasella: string[] };
  /**
   * Ottimizzatore della disposizione (src/insediamenti/mughal/ottimizzatore.ts): le residenze
   * (collegamento facoltativo, rupie), gli edifici senza strada e la strada. Tutto il resto
   * con un numero > 0 nella legenda è "fisso" e sempre collegato. `produttori` (27/11/2026):
   * edifici che producono rupie consumando popolazione; se sbloccati l'ottimizzatore sceglie
   * quanti metterne, insieme alle residenze.
   */
  ottimizzatore?: { residenze: string[]; produttori: string[]; senzaStrada: string[]; strada: string; diplomazia: string[] };
  testi: { comeImportare: UiKey; visitaPrima: UiKey; helperNonSupportato: UiKey; nessunMunicipio: UiKey };
}

// Diplomazia e dobloni dei Pirati (25/11/2026, dalle CityEntities del gioco): per la legenda.
// Produzioni [quantità, secondi]: residenziali una sola, le imbarcazioni da 5 minuti a 20 ore.
const PROD_6 = (q: number[]): Array<[number, number]> => q.map((v, i) => [v, [300, 900, 3600, 18000, 36000, 72000][i]!]);
const EXTRA_PIRATI: Record<string, Pick<BuildingType, "diplomacy" | "currency">> = {
  amaca: { currency: { prod: [[129, 18000]] } },
  capanno: { currency: { prod: [[543, 36000]] } },
  baracca: { currency: { prod: [[2165, 72000]] } },
  molo: { diplomacy: 8 }, molo_lungo: { diplomacy: 48 }, molo_largo: { diplomacy: 48 }, grande_molo: { diplomacy: 216 },
  imbarcazione: { diplomacy: 32, currency: { prod: PROD_6([21, 50, 150, 399, 598, 1195]) } },
  brigantino: { diplomacy: 192, currency: { prod: PROD_6([84, 201, 601, 1601, 2401, 4802]) } },
  galeone: { diplomacy: 360, currency: { prod: PROD_6([120, 288, 863, 2301, 3451, 6901]) } },
};

const PIRATI: ConfigInsediamento = {
  id: "pirati",
  municipio: MUNICIPIO,
  municipioIniziale: MUNICIPIO_INITIAL_PLACEMENT,
  edifici: INITIAL_BUILDINGS.map((b) => ({ ...b, ...EXTRA_PIRATI[b.id] })),
  categorie: [
    { titolo: "piratiCategoryResidential", ids: ["amaca", "capanno", "baracca"] },
    { titolo: "piratiCategoryGoods", ids: ["pescatore", "spezie", "rum", "cannoni"] },
    // Ex unico gruppo "Diplomazia", separato in due (agosto 2026, su richiesta
    // esplicita): le tre imbarcazioni producono anche Dobloni oltre a Diplomazia
    // (pop negativo più alto), i quattro moli danno solo Diplomazia pura.
    { titolo: "piratiCategoryDiplomacyDoubloons", ids: ["imbarcazione", "brigantino", "galeone"] },
    { titolo: "piratiCategoryDiplomacyOnly", ids: ["molo", "molo_lungo", "molo_largo", "grande_molo"] },
  ],
  baseBlocchi: BASE_UNLOCKED_BLOCK_KEYS,
  blocchiPermessi: ALLOWED_BLOCK_KEYS,
  baseRighe: BASE_BLOCK_ROWS,
  baseColonne: BASE_BLOCK_COLS,
  importa: {
    municipio: "H_Pirates_Townhall",
    ostacoli: ["I_Pirates_Impediment1", "I_Pirates_Impediment2"],
    ostacoloVerticale: "I_Pirates_Impediment1",
    ignorati: ["V_Pirates_Blackmarket", "Y_Pirates_Ship1"],
    baseBlocchi: BASE_UNLOCKED_BLOCK_KEYS,
    ancora: "pirati",
  },
  solver: true,
  valuta: { risorsa: "doubloons", etichetta: "piratiDoubloonsLabel", titolo: "piratiDoubloonsTitle" },
  testi: {
    comeImportare: "piratiImportHowToHintPrefix",
    visitaPrima: "piratiImportVisitOutpostFirst",
    helperNonSupportato: "piratiImportHelperUnsupported",
    nessunMunicipio: "piratiImportNoTownhall",
  },
};

// ── Mughal ──────────────────────────────────────────────────────────────────
// Mappa: righe 0..6, colonne 0..6 (blocchi 4×4). Base di 11 blocchi: il rettangolo righe 1-4 ×
// colonne 1-3 SENZA il blocco in alto a destra (1:3), che è la prima espansione (25/11/2026,
// utente con lo screenshot della partenza; il JSON reale aveva 3 espansioni: 1:3, 0:1 e 5:1);
// colonna 0 sempre; a destra la mappa si allarga a gradini.
const RIGHE_MUGHAL: Array<[riga: number, da: number, a: number]> = [
  [0, 0, 4], [1, 0, 5], [2, 0, 6], [3, 0, 6], [4, 0, 6], [5, 0, 5], [6, 0, 4],
];
const BASE_MUGHAL = [1, 2, 3, 4].flatMap(r => [1, 2, 3].map(c => `${r}:${c}`)).filter(k => k !== "1:3");
const PERMESSI_MUGHAL = RIGHE_MUGHAL.flatMap(([r, da, a]) => Array.from({ length: a - da + 1 }, (_, i) => `${r}:${da + i}`));

const MUNICIPIO_MUGHAL: BuildingType = {
  id: "municipio", nameKey: "mughalBuildingEmbassyName", shortNameKey: "mughalBuildingEmbassyShort",
  width: 6, height: 9, fill: "#ffc107", stroke: "#e0a800", icon: "🏛️", count: 1, pop: 0, cityentityId: "H_Mughals_Townhall",
};

const VERDE: Pick<BuildingType, "fill" | "stroke"> = { fill: "#2ecc71", stroke: "#27ae60" };
const ROSA: Pick<BuildingType, "fill" | "stroke"> = { fill: "#ff69b4", stroke: "#e05ea0" };
const BLU: Pick<BuildingType, "fill" | "stroke"> = { fill: "#3498db", stroke: "#2980b9" };
const AZZURRO: Pick<BuildingType, "fill" | "stroke"> = { fill: "#5dade2", stroke: "#3498db" };

const EDIFICI_MUGHAL: BuildingType[] = [
  { id: "bhavan", nameKey: "mughalBuildingBhavanName", shortNameKey: "mughalBuildingBhavanShort", width: 2, height: 2, fill: "#58d68d", stroke: "#28b463", icon: "🏠", count: 0, pop: 16, cityentityId: "R_Mughals_Residential1", currency: { prod: [[66, 18000]] } },
  { id: "shanti", nameKey: "mughalBuildingShantiName", shortNameKey: "mughalBuildingShantiShort", width: 3, height: 3, ...VERDE, icon: "🏠", count: 0, pop: 59, cityentityId: "R_Mughals_Residential2", currency: { prod: [[272, 36000]] } },
  { id: "haveli", nameKey: "mughalBuildingHaveliName", shortNameKey: "mughalBuildingHaveliShort", width: 3, height: 4, fill: "#239b56", stroke: "#1d8348", icon: "🏠", count: 0, pop: 113, cityentityId: "R_Mughals_Residential3", currency: { prod: [[744, 72000]] } },
  { id: "risaia", nameKey: "mughalBuildingRiceName", shortNameKey: "mughalBuildingRiceShort", width: 3, height: 4, ...ROSA, icon: "🌾", count: 0, pop: -36, cityentityId: "B_Mughals_CulturalGoodsProduction1" },
  { id: "sari", nameKey: "mughalBuildingSareeName", shortNameKey: "mughalBuildingSareeShort", width: 3, height: 3, ...ROSA, icon: "🧵", count: 0, pop: -45, cityentityId: "B_Mughals_CulturalGoodsProduction2" },
  { id: "spezie", nameKey: "mughalBuildingSpiceName", shortNameKey: "mughalBuildingSpiceShort", width: 3, height: 4, ...ROSA, icon: "🌶️", count: 0, pop: -36, cityentityId: "B_Mughals_CulturalGoodsProduction3" },
  { id: "loto", nameKey: "mughalBuildingLotusName", shortNameKey: "mughalBuildingLotusShort", width: 5, height: 3, ...ROSA, icon: "🪷", count: 0, pop: -27, cityentityId: "B_Mughals_CulturalGoodsProduction4" },
  { id: "canale", nameKey: "mughalBuildingCanalName", shortNameKey: "mughalBuildingCanalShort", width: 3, height: 2, ...AZZURRO, icon: "💧", count: 0, pop: 0, cityentityId: "J_Mughals_Diplomacy1", diplomacy: 24 },
  { id: "vialetto", nameKey: "mughalBuildingAlleyName", shortNameKey: "mughalBuildingAlleyShort", width: 2, height: 3, ...AZZURRO, icon: "🌳", count: 0, pop: 0, cityentityId: "J_Mughals_Diplomacy2", diplomacy: 24 },
  { id: "chhatri", nameKey: "mughalBuildingChhatriName", shortNameKey: "mughalBuildingChhatriShort", width: 2, height: 2, ...BLU, icon: "🛕", count: 0, pop: -23, cityentityId: "J_Mughals_Diplomacy3", diplomacy: 16, currency: { prod: PROD_6([10, 23, 68, 182, 272, 544]) } },
  { id: "baldacchino", nameKey: "mughalBuildingBaldachinName", shortNameKey: "mughalBuildingBaldachinShort", width: 3, height: 3, ...BLU, icon: "🛕", count: 0, pop: -51, cityentityId: "J_Mughals_Diplomacy4", diplomacy: 63, currency: { prod: PROD_6([25, 60, 178, 475, 712, 1423]) } },
  { id: "charbagh", nameKey: "mughalBuildingCharbaghName", shortNameKey: "mughalBuildingCharbaghShort", width: 3, height: 5, ...BLU, icon: "🌺", count: 0, pop: -84, cityentityId: "J_Mughals_Diplomacy5", diplomacy: 150, currency: { prod: PROD_6([55, 131, 393, 1046, 1569, 3138]) } },
  { id: "sentiero", nameKey: "mughalBuildingPathName", shortNameKey: "mughalBuildingPathShort", width: 1, height: 1, fill: "#a8a29e", stroke: "#78716c", icon: "", count: 0, pop: 0, cityentityId: "S_Mughals_Street1", currency: { cost: 200 } },
];

const MUGHAL: ConfigInsediamento = {
  id: "mughal",
  municipio: MUNICIPIO_MUGHAL,
  // posizione di partenza nel gioco (screenshot dell'utente): bordo sinistro della base, dalla
  // seconda riga di blocchi (4 celle sotto l'angolo in alto a sinistra)
  municipioIniziale: { buildingId: "municipio", row: 4, col: 0, w: 6, h: 9 },
  edifici: EDIFICI_MUGHAL,
  categorie: [
    { titolo: "mughalCategoryResidential", ids: ["bhavan", "shanti", "haveli"] },
    { titolo: "mughalCategoryGoods", ids: ["risaia", "sari", "spezie", "loto"] },
    { titolo: "mughalCategoryDiplomacyPop", ids: ["chhatri", "baldacchino", "charbagh"] },
    { titolo: "mughalCategoryDiplomacyFree", ids: ["canale", "vialetto"] },
    { titolo: "mughalCategoryRoads", ids: ["sentiero"] },
  ],
  baseBlocchi: BASE_MUGHAL,
  blocchiPermessi: PERMESSI_MUGHAL,
  baseRighe: 4,
  baseColonne: 3,
  importa: {
    municipio: "H_Mughals_Townhall",
    ostacoli: ["I_Mughals_Impediment1", "I_Mughals_Impediment2"],
    ostacoloVerticale: "I_Mughals_Impediment1",
    ignorati: ["Y_Mughals_Ship1"],
    baseBlocchi: BASE_MUGHAL,
    blocchiPermessi: PERMESSI_MUGHAL,
    ancora: "generica",
  },
  solver: false,
  // (25/11/2026) di partenza: Bhavan, Risaia, Vialetto (J_Mughals_Diplomacy2) e il Sentiero;
  // gli altri 9 si sbloccano con gli advancements (verificato su un insediamento nuovo del beta)
  // diplomazia: esclusa dalla disposizione di produzione (serve solo per gli sblocchi, avrà la
  // sua ottimizzazione); nella legenda niente − / + né casella (25/11/2026, utente)
  // (27/11/2026) Chhatri, Baldacchino e Chahar bagh producono rupie: li dispone l'ottimizzatore
  ottimizzatore: { residenze: ["bhavan", "shanti", "haveli"], produttori: ["chhatri", "baldacchino", "charbagh"], senzaStrada: ["canale", "vialetto"], strada: "sentiero", diplomazia: ["chhatri", "baldacchino", "charbagh", "canale", "vialetto"] },
  sblocchi: {
    prefisso: "_Mughals_",
    partenza: ["R_Mughals_Residential1", "B_Mughals_CulturalGoodsProduction1", "J_Mughals_Diplomacy2", "S_Mughals_Street1"],
    senzaCasella: ["S_Mughals_Street1"],
  },
  // Rupie: nel gioco solo le strade le costano (200 l'una); il resto si paga in monete e merci
  // senza import si parte dalle rupie con cui comincia l'insediamento (6.200, dato dell'utente)
  valuta: { risorsa: "rupees", etichetta: "mughalRupeesLabel", titolo: "mughalRupeesTitle", iniziale: 6200, titoloIniziale: "mughalRupeesStartTitle" },
  testi: {
    comeImportare: "mughalImportHowToHintPrefix",
    visitaPrima: "mughalImportVisitOutpostFirst",
    helperNonSupportato: "mughalImportHelperUnsupported",
    nessunMunicipio: "mughalImportNoTownhall",
  },
};

export const INSEDIAMENTI: Record<IdInsediamento, ConfigInsediamento> = { pirati: PIRATI, mughal: MUGHAL };
