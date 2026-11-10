import { useState, useEffect, useMemo, useRef, useDeferredValue, useCallback, memo, lazy, Suspense, Fragment, type ReactNode } from "react";
import {
  X as XIcon,
  RotateCcw,
  Upload,
  Check,
  Wand2,
  ChartColumn,
  ChevronRight,
  Calculator,
} from "lucide-react";

import type { Building } from "./data/buildings";
import { getImageUrl, noRush, isEraMutable } from "./data/buildings";
import type { Weights } from "./utils/calculator";
import { calculateEfficiency } from "./utils/calculator";
import { formatInt, formatEff, formatDecimal, formatProdNum, formatProdPercent, formatProdK, formatMilK, isStaleField, localDateStamp, prefissoFile } from "./utils/format";
import * as Allies from "./data/allies";
import { parseInventory, kitTier, type InventoryEntry, type SelectionKitEntry, type UpgradeKitEntry, type SpecialKits, type InventoryStore } from "./data/inventory";
import { parseBuildingsCsv } from "./data/buildings";
import { type CityMapBuilding, type CityMapBounds } from "./data/cityMap";
import type { CityStore } from "./data/cityStore";
import { CURRENT_BOOKMARKLET_VERSION, diagnosiClipboard, validateBookmarkletData, readPayloadDiagnostics, sanitizeCastleLevel, sanitizePortraitUrl, sanitizeResources, type BookmarkletData, type CityEntityDefinition, type CityMapEntry, type UnlockedArea } from "./data/bookmarklet";
import type {
  Profile} from "./utils/storage";
import { PROFILES_KEY, ACTIVE_PROFILE_KEY, DEFENSE_KEY, SPED_ENABLED_KEY, SPED_ATTACK_KEY, SPED_COLUMNS_KEY, SIGMA_KEY, BONUS_GE_KEY, POP_COLUMN_KEY, FEL_COLUMN_KEY, IQ_PROD_COLUMNS_KEY, PROD_COLUMNS_KEY, SHOW_CITY_MAP_KEY, UI_LANG_KEY,
  profileStorageKey, readStoredJson, writeStoredJson, clearStoredJson, reviveMap, reviveSet,
  initCityStore, initInventoryStore, initAlliesStore, cleanupOrphanedKeys,
  loadProfiles, getActiveProfileId, collectFoeLocalStorage, mergeImportedProfiles,
  isStorageOutdated, PROFILE_SLOTS
} from "./utils/storage";

import { caricaBuildingsExtra, caricaGe, datiGioco, caricaCastello, type LivelloCastello } from "./data/datiGioco";
import { leggiGe, statisticheGe, type DatiGe } from "./data/geBonus";
import { FALLBACK_ERA, ageName, AGES_BY_ID, AGE_BY_CODE } from "./data/ages";
import { BuildingModel, countSpecialGoodEras, type GreatBuilding, type EraStats } from "./models/BuildingModel";
import CityMapView, { type CityMapDragState } from "./components/CityMapView";
import { esportaCittaJson, scaricaJson } from "./data/cityMapJson";
import PannelloEfficienza from "./ui/PannelloEfficienza";
import PannelloImporta from "./ui/PannelloImporta";
import PannelloNovita from "./ui/PannelloNovita";
import VideoTutorial from "./planner/VideoTutorial";
import PannelloInformazioni from "./ui/PannelloInformazioni";
import { PERGAMENE_RESOURCE, VALOR_RESOURCE } from "./data/allyAdvisor";
import { setEdificio } from "./data/setEdifici";
import { improntaCitta, infoImport, nomeCitta, nomiMondoDavanti, tipoCitta, trovaCitta, type TipoCitta } from "./data/citta";
import Testata, { type Scheda } from "./ui/Testata";
import { costruisciNastri } from "./ui/nastri";
import { useTema } from "./ui/theme";
import type { RibbonGroup } from "./ui/ribbon/Ribbon";
import type { CittaEsterna } from "./planner/PlannerView";
import { impostaCatalogoExtra, impostaMetaExport, leggiCittaJson } from "./data/cityMapJson";
import { cittaDaJson } from "./data/cittaDaJson";

/** Nessun edificio evidenziato (Mappa della città da JSON nel Planner). */
const NESSUN_ID = new Set<string>();
/** Città vuota passata al Planner con la sorgente JSON: costanti STABILI. Un
 *  array / Set nuovo a ogni render di App ricalcolava il problema del Planner
 *  e il suo effetto di reset cancellava gli scenari appena avviati
 *  (bug: "Ottimizza" con un JSON mostrava i riquadri e poi spariva tutto). */
const NESSUN_EDIFICIO: CityMapBuilding[] = [];
const NESSUNA_CELLA = new Set<string>();
import type { Categoria, OpzioneProduzione } from "./ui/FiltriEdifici";
import { useModalDismiss } from "./utils/useModalDismiss";
import AllyAdvisorPanel from "./components/AllyAdvisorPanel";
import PannelloPergamene from "./components/PannelloPergamene";
import { dimensioniDaSize, senzaLivello, type CandidatiPlanner, type CandidatoPlanner, type FamigliaPlanner } from "./planner/modificheCitta";
import PiratiTool, { type PiratiToolHandle } from "./components/PiratiTool";
import { initKitData, computeAllFamilies, type FamilyResult, type KitDataRaw } from "./data/inventoryOptimizer";
import { translateName, getItalianMap, initTranslations, hasTranslation, type Lang } from "./data/translations";
import { t, boostTitle, type UiLang, type UiKey } from "./data/ui-strings";
import { isGreatBuildingId, isInactiveBuildingId, isMilitaryBuildingId, isMilitaryCampBuildingId,
  isBattlegroundsPrizeId, isQuantumIncursionsPrizeId, getSettlementInfo,
  isAscendedUpgradeKit, isAllAgeBuildingId,
  isFragmentBuildingToken, isFragmentKitToken, fragmentBuildingId,
  BUILDING_ROW_COLORS, ROW_DISCONNECTED_OVERLAY, RARITY_FROM_GAME } from "./data/buildingClassification";
import {
  iconSize, iconRoad, iconPop, iconFel, iconFP, iconFPB, iconBeni, iconBeniP, iconBeniS, iconBeniB, iconBeniG,
  iconMon, iconMat, iconLimitati, allies_military, allies_science, iconReliquie, iconCritico, iconCriticoOro, iconRespingi, iconManiAmiche, iconManiAmicheOro, iconContributo, iconContributoOro, iconProgettiAiuti, iconSaccheggio, iconNucleoIA, iconRegaliDiplomatici, iconMissili, iconMissiliOro, iconSchegge, iconSaccheggiaBeni, iconBeniAiuti, iconColpo, iconColpoOro, iconMissioni, iconMissioniOro, iconBottino, iconBottinoOro, iconRaccoltaDoppia, iconRaccoltaDoppiaOro, iconSword, iconCampi, iconIQ, iconProduzioni, iconSpedizioni,
  iconGenAtk_A as iconGenAtkA, iconGenDef_A as iconGenDefA,
  iconGenAtk_D as iconGenAtkD, iconGenDef_D as iconGenDefD,
  iconCampiAtk_A as iconCampiAtkA, iconCampiDef_A as iconCampiDefA,
  iconCampiAtk_D as iconCampiAtkD, iconCampiDef_D as iconCampiDefD,
  iconSpedAtk_A as iconSpedAtkA, iconSpedDef_A as iconSpedDefA,
  iconSpedAtk_D as iconSpedAtkD, iconSpedDef_D as iconSpedDefD,
  iconIQAtk_A as iconIQAtkA, iconIQDef_A as iconIQDefA,
  iconIQAtk_D as iconIQAtkD, iconIQDef_D as iconIQDefD,
  iconIQMonB, iconIQMatB, iconIQMon, iconIQMat, 
  iconIQBeni, iconIQTruppe, iconIQAzioni, iconIQCap, iconFUR, iconBP, iconTR, iconTRNE,
  iconOneUp, iconImm, iconRinn, iconAiuto, iconFragment, allies_slot_empty, allies_slot_full,
  iconBeniSp, iconBeniSpB, iconFSP, iconTPM, iconTPB, iconMed,
} from "./assets/icons";

// I nomi (NomeIta/NomeEng) sono ora colonne dirette di buildings.csv/allies.csv,
// quindi il parsing non richiede più una mappa di traduzione esterna.
// Dati di gioco: scaricati da main.tsx PRIMA di importare questo modulo
// (2.0: public/data/, vedi data/datiGioco.ts).
// Planner (motore, editor, Modifica città): caricato solo quando lo si apre
// (2.0, build a più file: un pezzo di codice a parte).
const PlannerView = lazy(() => import("./planner/PlannerView"));
// Report di un GE (Catalogo › Grandi Edifici, pulsante 📊): a parte, scaricato solo aprendolo
const PannelloReportGe = lazy(() => import("./components/PannelloReportGe"));

const { buildings: buildingsCsv, allies: alliesCsv, events: eventsCsv, kit: kitData } = datiGioco();
const BUILDINGS_FROM_CSV: Building[] = parseBuildingsCsv(buildingsCsv);
const ALLIES_FROM_CSV: Allies.Ally[] = Allies.parseAlliesCsv(alliesCsv);

// Costruisce le mappe it/en a partire dai nomi appena estratti dai due CSV
// (sostituisce il vecchio traduzioni_edifici.csv, ora eliminato).
initTranslations(BUILDINGS_FROM_CSV, ALLIES_FROM_CSV);

// Mappa italiana di default per i factory (calcoli eff, ecc.) che avvengono
// al boot prima che la lingua del profilo sia nota.
const ITALIAN_NAMES = getItalianMap();

// ────────────────────────────────────────────────────────────────
// FRAMMENTI (colonna Fragments del CSV), costruiti in un singolo passaggio:
// - FRAGMENTS_PRODUCED: cityEntityId -> lista di ciò di cui l'edificio PRODUCE
//   frammenti. Ogni token è "<fid>:<amount>" (amount = quanti frammenti dà
//   QUESTA raccolta, stabile per coppia edificio+kit — assente solo per dati
//   storici pre-agosto-2026 senza amount, fallback undefined). Token
//   "building_<id>" = un edificio (es. building_W_MultiAge_WIN22B1); ogni
//   altro token è l'id di un kit così com'è (selection/upgrade, inclusi i
//   tier silver_/golden_, es. selection_kit_WIN23EF + silver_upgrade_kit_WIN23A).
//   Un edificio può produrre PIÙ kit/edifici diversi contemporaneamente (es.
//   W_MultiAge_CARE26A8: golden_upgrade_kit_CARE26A + selection_kit_CARE26BC),
//   da cui il tipo lista invece di un singolo valore.
//   Alimenta il badge 🧩 in tabella, che mostra la lista completa dei prodotti.
//   (La vecchia mappa inversa "chi produce frammenti di questo edificio" è
//   stata rimossa insieme al vecchio significato del badge: quell'informazione
//   vive già nella modale Edifici Aggiornabili.)
// - FRAGMENT_KIT_PRODUCERS: mappa inversa kit -> edifici produttori, usata
//   dalla modale Edifici Aggiornabili ("frammenti prodotti da").
// ────────────────────────────────────────────────────────────────
type FragmentProduced = { kind: "building" | "kit"; id: string; amountPerCollection?: number };
const FRAGMENTS_PRODUCED = new Map<string, FragmentProduced[]>();
const FRAGMENT_KIT_PRODUCERS = new Map<string, string[]>();
for (const b of BUILDINGS_FROM_CSV) {
  if (!b.fragments) continue;
  const produced: FragmentProduced[] = [];
  for (const rawToken of b.fragments.split("|")) {
    const token = rawToken.trim();
    if (!token) continue;
    // "<fid>:<amount>" — il separatore ":" non compare mai dentro un fid
    // (pattern lingua-neutro validati in buildingClassification.ts), quindi
    // uno split semplice basta. Dati storici senza ":" restano supportati
    // (amountPerCollection undefined, il tooltip non mostra il conteggio).
    const sepIdx = token.lastIndexOf(":");
    const frag = sepIdx === -1 ? token : token.slice(0, sepIdx);
    const amountStr = sepIdx === -1 ? undefined : token.slice(sepIdx + 1);
    const amountPerCollection = amountStr !== undefined && amountStr !== "" ? Number(amountStr) : undefined;
    if (isFragmentBuildingToken(frag)) {
      // "building_W_MultiAge_WIN22B1" -> "W_MultiAge_WIN22B1". Per i pochi
      // frammenti "limited" il cui cityEntityId reale NON coincide con lo
      // strip naive (es. "building_limited_daunting_tower_active" -> reale
      // "W_MultiAge_HalloweenBonus22b"), KIT_RAW.fragmentBuildingId (da
      // parse_kit.py, letto da assembledReward.subType nel MainParser) è
      // consultato PRIMA come fallback esplicito.
      const naiveId = fragmentBuildingId(frag);
      const realId = (kitData as unknown as KitDataRaw).fragmentBuildingId?.[naiveId] ?? naiveId;
      produced.push({ kind: "building", id: realId, amountPerCollection });
    } else if (isFragmentKitToken(frag)) {
      // L'id del kit coincide col token (es. "selection_kit_FELL25BC", "upgrade_kit_ascended_ARCH19A")
      produced.push({ kind: "kit", id: frag, amountPerCollection });
      const arr = FRAGMENT_KIT_PRODUCERS.get(frag);
      if (arr) arr.push(b.cityEntityId);
      else FRAGMENT_KIT_PRODUCERS.set(frag, [b.cityEntityId]);
    }
  }
  if (produced.length > 0) FRAGMENTS_PRODUCED.set(b.cityEntityId, produced);
}

// Pre-compute inherited-ally chains once at module load (avoids O(n²) per-render filtering)
const INHERITED_ALLIES_MAP = new Map<string, Allies.Ally[]>();
for (const ally of ALLIES_FROM_CSV) {
  INHERITED_ALLIES_MAP.set(
    `${ally.id}__${ally.rarity}`,
    ALLIES_FROM_CSV.filter(c => c.id === ally.id && c.rarity >= 1 && c.rarity <= ally.rarity),
  );
}

// Database alleati: efficienza SEMPRE al livello 100 (ottobre 2026: il campo
// modificabile è stato rimosso; stessa ipotesi "prima o poi maxato" del
// pannello Potenziale alleati).
const ALLY_DB_LEVEL = 100;

// O(1) lookup for processedImportedAllies: avoid .find() O(n) per imported ally
const ALLIES_BY_ID_RARITY = new Map<string, Allies.Ally>();
for (const ally of ALLIES_FROM_CSV) {
  ALLIES_BY_ID_RARITY.set(`${ally.id}__${ally.rarity}`, ally);
}

// Pre-computed CSV entity IDs — buildings is BUILDINGS_FROM_CSV (stable module constant),
// so these never change and don't need to live inside useMemo
const CSV_ENTITY_IDS: string[] = BUILDINGS_FROM_CSV.map((b: Building) => b.cityEntityId).filter(Boolean) as string[];
const CSV_ENTITY_IDS_SET = new Set(CSV_ENTITY_IDS);
// Lookup id -> Building, per risolvere l'hash immagine dato un
// entityId della mappa città (che non porta con sé il campo hash).
const BUILDING_BY_ID = new Map(BUILDINGS_FROM_CSV.map(b => [b.cityEntityId, b]));

function allyName(id: string, lang: Lang = "it"): string {
  return translateName(id, lang);
}

// Estrae un messaggio leggibile da un errore di tipo unknown (catch).
const errMessage = (err: unknown, fallback = "unknown error"): string =>
  err instanceof Error ? err.message : (typeof err === "string" ? err : fallback);

/** Revive difensivo di declassableBuildings dal CityStore serializzato:
 *  valida la forma della prima entry (deve essere [string, oggetto]) prima
 *  di fidarsi dell'intero array — profili salvati da versioni precedenti
 *  potrebbero avere una forma diversa. Usato sia dall'initializer dello
 *  useState sia da loadProfileData (stessa logica, un solo punto). */
function reviveDeclassableMap(raw: unknown): Map<string, { popCurr: number; popBronze: number; statsBronze: EraStats }> {
  try {
    if (!Array.isArray(raw) || raw.length === 0) return new Map();
    const first = raw[0] as [string, unknown];
    if (!first || typeof first[1] !== "object" || Array.isArray(first[1]) || first[1] === null) return new Map();
    return reviveMap<{ popCurr: number; popBronze: number; statsBronze: EraStats }>(raw as Array<[string, { popCurr: number; popBronze: number; statsBronze: EraStats }]>);
  } catch { return new Map(); }
}

// Lingua di default della GUI quando l'utente non ha mai scelto esplicitamente
// (nessuna chiave in localStorage): italiano se il browser è in italiano
// (qualsiasi variante, es. "it-IT"), altrimenti inglese. Solo it/en sono
// lingue GUI supportate (vedi UI_LANGUAGES in ui-strings.ts), quindi non ha
// senso rilevare altre lingue del browser: per chiunque non sia italiano,
// l'inglese è il fallback più universale.
const detectBrowserUiLang = (): UiLang => {
  const langs = navigator.languages && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
  const isItalian = langs.some((l) => l?.toLowerCase().startsWith("it"));
  return isItalian ? "it" : "en";
};

// ── Confronto statistiche per "se aggiorni all'era corrente" ────────────────
// Una voce di differenza tra l'era vecchia e quella corrente di un edificio.
type EraDiffEntry = { key: string; icon: string; emoji?: string; labelKey: UiKey; from: number; to: number };

// Campi con valori potenzialmente molto larghi (5-6+ cifre: pop/fel/mon/mat)
// che nel popup "edificio vecchio" occupano sempre una riga intera
// (col-span-full) invece di condividere una colonna stretta con gli altri
// campi — condivisa tra il calcolo della larghezza del popup e il rendering
// della griglia, altrimenti la larghezza veniva calcolata sul conteggio
// totale dei campi invece che sul massimo di colonne davvero affiancate
// (bug segnalato luglio 2026: popup troppo largo su "Mercantile
// Waystation"). "fel" incluso insieme a pop/mon/mat (non solo per la
// larghezza dei suoi valori, che restano contenuti, ma per lasciare le
// colonne strette libere ai campi realmente compatti come "beni" — bug
// segnalato luglio 2026 su "Capy's Winter Holiday Spa", dove fel occupava
// la 4a colonna della riga militare al posto di beni).
const isWideDiffKey = (key: string): boolean => key === "pop" || key === "fel" || key === "mon" || key === "mat" || key === "med";

// Definizione dei campi confrontabili: come leggerli da EraStats (vecchia era) e
// da un Building (era corrente, già popolato da applyEraStats). I boost sono
// array di 4 [Atk_A, Def_A, Atk_D, Def_D]. Icone immagine o emoji per i reward.
type DiffField = {
  key: string;
  labelKey: UiKey;
  icon?: string;   // URL icona immagine
  emoji?: string;  // fallback emoji per reward speciali
  get: (s: { [k: string]: unknown }) => number;
};

// Costruita lazy dentro al componente perché le icone sono import di modulo.
// Qui definiamo solo le chiavi/label/getter; le icone vengono iniettate al volo.
const buildDiffFields = (icons: Record<string, string>): DiffField[] => {
  const arr = (field: string, idx: number) => (s: { [k: string]: unknown }) => {
    const v = s[field];
    return Array.isArray(v) ? (Number(v[idx]) || 0) : 0;
  };
  const sca = (field: string) => (s: { [k: string]: unknown }) => Number(s[field]) || 0;
  return [
    // Statistiche militari PRIMA di tutto il resto (richiesto luglio 2026):
    // nel popup "edificio vecchio" le variazioni di attacco/difesa contano
    // più delle risorse per decidere se aggiornare, quindi vengono mostrate
    // per prime. L'ordine qui è quello con cui viene popolato cmp.diffs
    // (itera DIFF_FIELDS filtrando solo i campi effettivamente cambiati).
    // Boost generali (esercito) — indici 0..3
    { key: "general0", labelKey: "diffGenAtkAtk", icon: icons.iconGenAtkA, get: arr("general", 0) },
    { key: "general1", labelKey: "diffGenDefAtk", icon: icons.iconGenDefA, get: arr("general", 1) },
    { key: "general2", labelKey: "diffGenAtkDef", icon: icons.iconGenAtkD, get: arr("general", 2) },
    { key: "general3", labelKey: "diffGenDefDef", icon: icons.iconGenDefD, get: arr("general", 3) },
    // Campi di battaglia di gilda
    { key: "gbg0", labelKey: "diffGbgAtkAtk", icon: icons.iconCampiAtkA, get: arr("gbg", 0) },
    { key: "gbg1", labelKey: "diffGbgDefAtk", icon: icons.iconCampiDefA, get: arr("gbg", 1) },
    { key: "gbg2", labelKey: "diffGbgAtkDef", icon: icons.iconCampiAtkD, get: arr("gbg", 2) },
    { key: "gbg3", labelKey: "diffGbgDefDef", icon: icons.iconCampiDefD, get: arr("gbg", 3) },
    // Spedizione di gilda
    { key: "sped0", labelKey: "diffGeAtkAtk", icon: icons.iconSpedAtkA, get: arr("sped", 0) },
    { key: "sped1", labelKey: "diffGeDefAtk", icon: icons.iconSpedDefA, get: arr("sped", 1) },
    { key: "sped2", labelKey: "diffGeAtkDef", icon: icons.iconSpedAtkD, get: arr("sped", 2) },
    { key: "sped3", labelKey: "diffGeDefDef", icon: icons.iconSpedDefD, get: arr("sped", 3) },
    // Incursioni quantistiche
    { key: "iq0", labelKey: "diffIqAtkAtk", icon: icons.iconIQAtkA, get: arr("iq", 0) },
    { key: "iq1", labelKey: "diffIqDefAtk", icon: icons.iconIQDefA, get: arr("iq", 1) },
    { key: "iq2", labelKey: "diffIqAtkDef", icon: icons.iconIQAtkD, get: arr("iq", 2) },
    { key: "iq3", labelKey: "diffIqDefDef", icon: icons.iconIQDefD, get: arr("iq", 3) },
    { key: "iqMon", labelKey: "diffIqCoins", icon: icons.iconIQMon, get: sca("iqMon") },
    { key: "iqMonB", labelKey: "diffIqCoinsBoost", icon: icons.iconIQMonB, get: sca("iqMonB") },
    { key: "iqMat", labelKey: "diffIqMaterials", icon: icons.iconIQMat, get: sca("iqMat") },
    { key: "iqMatB", labelKey: "diffIqMaterialsBoost", icon: icons.iconIQMatB, get: sca("iqMatB") },
    { key: "iqBeni", labelKey: "diffIqGoods", icon: icons.iconIQBeni, get: sca("iqBeni") },
    { key: "iqTruppe", labelKey: "diffIqUnits", icon: icons.iconIQTruppe, get: sca("iqTruppe") },
    { key: "iqAzioni", labelKey: "diffIqActions", icon: icons.iconIQAzioni, get: sca("iqAzioni") },
    { key: "iqCap", labelKey: "diffIqCapacity", icon: icons.iconIQCap, get: sca("iqCap") },
    // Popolazione/felicità e produzioni: dopo tutte le statistiche militari.
    { key: "pop", labelKey: "diffPopulation", icon: icons.iconPop, get: sca("pop") },
    { key: "fel", labelKey: "diffHappiness", icon: icons.iconFel, get: sca("fel") },
    { key: "mon", labelKey: "diffCoins", icon: icons.iconMon, get: sca("mon") },
    { key: "mat", labelKey: "diffMaterials", icon: icons.iconMat, get: sca("mat") },
    { key: "fp", labelKey: "diffForgePoints", icon: icons.iconFP, get: sca("fp") },
    { key: "fpb", labelKey: "diffForgePointsBoost", icon: icons.iconFPB, get: sca("fpb") },
    { key: "med", labelKey: "diffMedals", icon: icons.iconMed, get: sca("med") },
    { key: "fur", labelKey: "diffRogues", icon: icons.iconFUR, get: sca("fur") },
    { key: "tr", labelKey: "diffUnits", icon: icons.iconTR, get: sca("tr") },
    { key: "trne", labelKey: "diffUnitsNextEra", icon: icons.iconTRNE, get: sca("trne") },
    { key: "beni", labelKey: "diffGoods", icon: icons.iconBeni, get: sca("beni") },
    { key: "benip", labelKey: "diffGoodsPreviousEra", icon: icons.iconBeniP, get: sca("benip") },
    { key: "benis", labelKey: "diffGoodsNextEra", icon: icons.iconBeniS, get: sca("benis") },
    { key: "benisp", labelKey: "diffGoodsSpecial", icon: icons.iconBeniSp, get: sca("benisp") },
    { key: "benispb", labelKey: "diffGoodsSpecialBoost", icon: icons.iconBeniSpB, get: sca("benispb") },
    { key: "benib", labelKey: "diffGoodsBoost", icon: icons.iconBeniB, get: sca("benib") },
    { key: "benig", labelKey: "diffTreasuryGoods", icon: icons.iconBeniG, get: sca("benig") },
    { key: "bp", labelKey: "diffBlueprints", icon: icons.iconBP, get: sca("bp") },
    { key: "fsp", labelKey: "prodRushSpecial", icon: icons.iconFSP, get: sca("fsp") },
    { key: "tpm", labelKey: "prodRushMaterials", icon: icons.iconTPM, get: sca("tpm") },
    { key: "tpb", labelKey: "prodRushGoods", icon: icons.iconTPB, get: sca("tpb") },
    { key: "adm", labelKey: "diffMassAid", icon: icons.iconAiuto, get: sca("adm") },
    { key: "mod", labelKey: "diffOneUpKit", icon: icons.iconOneUp, get: sca("mod") },
    { key: "rin", labelKey: "diffRenovationKit", icon: icons.iconRinn, get: sca("rin") },
    { key: "imm", labelKey: "diffStoreBuilding", icon: icons.iconImm, get: sca("imm") },
  ];
};

// Nome visualizzato di un edificio: prova translateName (nomi da
// buildings.csv/allies.csv) nella lingua data, poi il fallback passato, poi
// l'id grezzo. Default italiano.
const displayName = (cityEntityId: string, fallback: string, lang: Lang = "it") => {
  const translated = translateName(cityEntityId, lang);
  return translated === cityEntityId ? (fallback !== cityEntityId ? fallback : cityEntityId) : translated;
};

// Etichetta della colonna ⏱ (edifici a tempo limitato/ascesi): "Ng" con
// suffisso localizzato. A LIVELLO MODULO, non dentro App: è pura e viene
// passata come prop a BuildingRow (memoizzato) — definita nel corpo di App
// verrebbe ricreata ad ogni render, cambiando identità e rompendo la
// shallow-compare di memo() per TUTTE le righe (invariante #11).
const getPropDisplay = (b: Building, lang: UiLang): string => {
  if (b.time > 0) return `${b.time}${t("daySuffix", lang)}`;
  return "";
};

// Fallback STABILI per le prop-array di BuildingRow. Un `?? []` inline nel
// call-site creerebbe un NUOVO array ad ogni render di App per ogni riga
// senza dati (la maggioranza), rompendo la shallow-compare di memo()
// (invariante #11): ogni setState di App (tooltip, popup immagine, modal)
// ri-renderizzerebbe tutte le righe. Stessa ragione per cui getPropDisplay
// è a livello modulo.
const EMPTY_ERA_GROUPS: Array<[string, number, EraStats]> = [];
const EMPTY_FRAGMENTS: FragmentProduced[] = [];

// Fabbisogno stradale del municipio (min(larghezza,lunghezza)/2): il municipio
// è SEMPRE 7×6 in ogni era del gioco (confermato dall'utente — non può
// variare: la mappa città è già disegnata/collegata attorno a quella tile
// fissa, un cambio di dimensione all'avanzamento di era romperebbe la
// disposizione di tutti gli altri edifici). Costante invece di ricalcolarla
// da CityEntities a ogni import: il municipio ha prefisso "H_" (fuori da
// ALLOWED_PREFIXES, mai in cityEntityIds/cityBuildings) ma richiede sempre
// strada — va sommato a parte nel calcolo dell'efficienza strade
// (renderRoadSummary). Vedi anche BuildingModel.computeRoad per la formula.
const TOWNHALL_ROAD = 3; // min(7,6)/2

// ────────────────────────────────────────────────────────────────
// KIT DI AGGIORNAMENTO / SELEZIONE (kit.json)
// ────────────────────────────────────────────────────────────────
// KitDataRaw importato da inventoryOptimizer — singola sorgente di verità
const KIT_RAW = kitData as unknown as KitDataRaw;

// Inizializza l'optimizer (una volta sola a livello modulo)
initKitData(KIT_RAW);

// Nomi leggibili dei kit: id -> mappa nomi localizzati ({it?, en}).
// La risoluzione lingua→stringa avviene in kitName(), coerente con
// displayName/allyName: lingua richiesta -> en -> kit_id.
const KIT_NAMES = new Map<string, Partial<Record<Lang, string>>>();
for (const [id, entry] of Object.entries(KIT_RAW.buildingUpgrades)) {
  KIT_NAMES.set(id, entry.names);
}
for (const [id, entry] of Object.entries(KIT_RAW.selectionKits)) {
  KIT_NAMES.set(id, entry.names);
}

// Reverse lookup: upgradeKitId -> elenco dei selectionKit che lo producono
const SELECTION_KITS_BY_UPGRADE = new Map<string, string[]>();
for (const [selKitId, entry] of Object.entries(KIT_RAW.selectionKits)) {
  const opts = entry.options ?? [];
  for (const produced of opts) {
    const arr = SELECTION_KITS_BY_UPGRADE.get(produced);
    if (arr) arr.push(selKitId);
    else SELECTION_KITS_BY_UPGRADE.set(produced, [selKitId]);
  }
}

/** Nome leggibile di un'opzione di selection kit: l'id può essere un edificio
 *  base o un upgrade kit — sono scelte ALTERNATIVE distinte nel gioco (es.
 *  selection_kit_GR25D offre "W_MultiAge_GR25D1" (l'edificio livello 1) *o*
 *  "upgrade_kit_GR25D" (il kit di aggiornamento), come mostra la finestra di
 *  scelta in gioco) — mai un altro selection kit (non annidati in kit.json).
 *  Se è un upgrade kit, mostra il SUO nome (kitName, quello vero mostrato in
 *  gioco), non l'edificio a cui porta: risolvere la catena fondeva le due
 *  opzioni in una sola etichetta, perdendo la distinzione reale del kit. */
function selectionOptionDisplayName(optionId: string, lang: Lang): string {
  if (KIT_RAW.buildingUpgrades[optionId]) return kitName(optionId, lang);
  return displayName(optionId, ITALIAN_NAMES.get(optionId) ?? optionId, lang);
}

/** Elenco leggibile di TUTTE le opzioni scelte da un selection kit (kit.json).
 *  Usato dal tooltip 🧩 per mostrare cosa si può ottenere da un kit di
 *  selezione, dato che il solo nome del kit spesso non lo chiarisce. */
function selectionKitOptionNames(selKitId: string, lang: Lang): string[] {
  const entry = KIT_RAW.selectionKits[selKitId];
  if (!entry) return [];
  return (entry.options ?? []).map((optionId) => selectionOptionDisplayName(optionId, lang));
}

// Lookup: buildingId -> elenco opzioni di upgrade { kit richiesto, edifici target }
const BUILDING_UPGRADE_OPTIONS = new Map<string, Array<{ requiredKitId: string; targets: string[] }>>();
for (const [kitId, entry] of Object.entries(KIT_RAW.buildingUpgrades)) {
  const chain = entry.steps;
  for (let i = 0; i < chain.length - 1; i++) {
    const step = chain[i];
    const sourceIds = Array.isArray(step) ? step : [step];
    const next = chain[i + 1];
    const targets = Array.isArray(next) ? next : [next];
    for (const id of sourceIds) {
      const opts = BUILDING_UPGRADE_OPTIONS.get(id);
      if (opts) opts.push({ requiredKitId: kitId, targets });
      else BUILDING_UPGRADE_OPTIONS.set(id, [{ requiredKitId: kitId, targets }]);
    }
  }
}

// Funzione di utilità per ottenere il nome leggibile di un kit nella lingua
// scelta. Fallback: lingua richiesta -> inglese -> kit_id (coerente con
// displayName/allyName).
const kitName = (kitId: string, lang: Lang = "it"): string => {
  const names = KIT_NAMES.get(kitId);
  return names?.[lang] ?? names?.en ?? kitId;
};

type KitLike = { kitId: string; name: string; inStock: number };

type UpgradeChain = Array<string | string[]>;
type BuildingChainEntry = { kit_id: string; local_index: number; chain_length: number; chain: UpgradeChain };

// ── Logica tradotta da inventario.html (standalone testato) ───────────────
const BLD_ALL_CHAINS = new Map<string, BuildingChainEntry[]>();
for (const [kit_id, entry] of Object.entries(KIT_RAW.buildingUpgrades)) {
  const chain = entry.steps;
  for (let i = 0; i < chain.length; i++) {
    const item = chain[i];
    const ids = Array.isArray(item) ? item : [item];
    for (const bld of ids) {
      if (!BLD_ALL_CHAINS.has(bld)) BLD_ALL_CHAINS.set(bld, []);
      BLD_ALL_CHAINS.get(bld)!.push({ kit_id, local_index: i, chain_length: chain.length, chain });
    }
  }
}

const CHAIN_OFFSET_CACHE = new Map<UpgradeChain, number>();

function chainOffset(chain: UpgradeChain): number {
  if (CHAIN_OFFSET_CACHE.has(chain)) return CHAIN_OFFSET_CACHE.get(chain)!;
  CHAIN_OFFSET_CACHE.set(chain, 0); // prevenzione cicli, come nello standalone
  const firstItem = chain[0];
  const firstIds = Array.isArray(firstItem) ? firstItem : [firstItem];
  let maxOffset = 0;
  for (const fid of firstIds) {
    for (const e of (BLD_ALL_CHAINS.get(fid) ?? [])) {
      if (e.local_index === e.chain_length - 1 && e.chain !== chain) {
        const o = chainOffset(e.chain) + e.chain_length - 1;
        if (o > maxOffset) maxOffset = o;
      }
    }
  }
  CHAIN_OFFSET_CACHE.set(chain, maxOffset);
  return maxOffset;
}

/** Primo edificio (livello 1) della catena di upgrade che contiene `id`,
 *  risalendo anche le catene concatenate (l'ultimo livello di una è il primo
 *  della successiva): chiave della "famiglia" nel Planner (Modifica città). */
const RADICE_CACHE = new Map<string, string>();
function radiceCatena(id: string): string {
  const c = RADICE_CACHE.get(id);
  if (c) return c;
  RADICE_CACHE.set(id, id); // (prevenzione cicli)
  const primo = (chain: UpgradeChain) => { const s = chain[0]; return Array.isArray(s) ? s[0] : s; };
  let r = id;
  const tutte = BLD_ALL_CHAINS.get(id) ?? [];
  // catena in cui id NON è il primo (la più lunga): si risale al suo primo
  const dentro = tutte.filter(e => e.local_index > 0).sort((a, b) => b.chain_length - a.chain_length)[0];
  if (dentro) { const p = primo(dentro.chain); if (p && p !== id) r = radiceCatena(p); }
  RADICE_CACHE.set(id, r);
  return r;
}

function chainInfo(cityEntityId: string): { kit_id: string; level: number; max_level: number } | null {
  const all = BLD_ALL_CHAINS.get(cityEntityId);
  if (!all) return null;
  const enriched = all.map((e) => {
    const offset = chainOffset(e.chain);
    return {
      kit_id: e.kit_id,
      level: offset + e.local_index + 1,
      max_level: offset + e.chain_length,
    };
  });
  const upgradable = enriched.filter((e) => e.level < e.max_level);
  if (!upgradable.length) return enriched[0] ?? null;
  return upgradable.reduce((best, e) => (e.level > best.level ? e : best));
}

// Calcola le info sul badge AGGIORNABILE per un edificio della città.
// Restituisce null se non è aggiornabile con i kit attualmente in inventario.
function computeUpgradeBadge(
  cityEntityId: string,
  invUpgradeKits: Map<string, KitLike>,
  invSelectionKits: Map<string, KitLike>,
  lang: Lang = "it",
): { targets: string[]; kits: Array<{ name: string; count: number }> } | null {
  const options = BUILDING_UPGRADE_OPTIONS.get(cityEntityId);
  if (!options) return null;

  const targetIds = new Set<string>();
  const kitInfo = new Map<string, { name: string; count: number }>(); // kitId -> {nome, qty}

  for (const opt of options) {
    const found: KitLike[] = [];

    // 1) Kit di aggiornamento diretto in inventario
    const directKit = invUpgradeKits.get(opt.requiredKitId);
    if (directKit) found.push(directKit);

    // 2) Kit di selezione in inventario che producono il kit richiesto
    const producers = SELECTION_KITS_BY_UPGRADE.get(opt.requiredKitId) ?? [];
    for (const selId of producers) {
      const selKit = invSelectionKits.get(selId);
      if (selKit) found.push(selKit);
    }

    if (found.length > 0) {
      opt.targets.forEach((t) => targetIds.add(t));
      found.forEach((k) => kitInfo.set(k.kitId, { name: k.name, count: k.inStock }));
    }
  }

  if (kitInfo.size === 0) return null;

  return {
    targets: Array.from(targetIds).map((id) => displayName(id, ITALIAN_NAMES.get(id) ?? id, lang)),
    kits: Array.from(kitInfo.values()),
  };
}

const isSettlementPrize = (cityEntityId: string): boolean => getSettlementInfo(cityEntityId) !== null;

type EventEntry = { id: string; names: Partial<Record<UiLang, string>>; tokens: string[]; isGroup: boolean };

/** Nome di un evento nella lingua scelta: lingua richiesta -> inglese -> id.
 *  Stesso schema di fallback usato per kit/edifici/alleati. */
const eventName = (event: EventEntry, lang: UiLang): string =>
  event.names[lang] ?? event.names.en ?? event.id;

// Eventi esattamente nell'ordine del CSV (NomeIt;NomeEng;ID_LIST), senza
// raggruppamenti automatici. Ogni entry ha un id univoco formato da
// Nome(inglese, lingua-neutro per l'id) + Anno corrente.
const EVENTS_LIST: EventEntry[] = (() => {
  let currentYear = "";
  const entries: EventEntry[] = [];
  eventsCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(1) // salta la riga di header "NomeIt;NomeEng;ID_LIST"
    .forEach((line) => {
      const [nameItRaw, nameEnRaw, tokensRaw] = line.split(";");
      const tokens = (tokensRaw || "")
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
      const nameIt = (nameItRaw || "").trim();
      const nameEn = (nameEnRaw || "").trim();
      // Righe "[ 2026 ]" (uguali in entrambe le colonne) sono header-gruppo:
      // usano TUTTI i token della riga.
      const groupMatch = nameEn.match(/\[\s*(\d+)\s*\]/);
      if (groupMatch) {
        currentYear = groupMatch[1];
        entries.push({ id: `group-${currentYear}`, names: { it: currentYear, en: currentYear }, tokens, isGroup: true });
        return;
      }
      if (nameEn.length === 0) return;
      const names: Partial<Record<UiLang, string>> = { en: nameEn };
      if (nameIt) names.it = nameIt;
      entries.push({ id: `${nameEn}-${currentYear || "x"}`, names, tokens, isGroup: false });
    });
  return entries;
})();

// Due tipi di token in events.csv (generati da events.py in RECUPERO DATI):
//  - sottostringa (es. "D24A1"): match con includes, case-insensitive;
//  - "=" + ID intero (es. "=A_MULTIAGE_BONUS1"): match ESATTO — è il fallback
//    usato quando nessuna sottostringa è esclusiva dell'evento, e il match
//    esatto evita i falsi positivi sui prefissi (BONUS1 non deve matchare
//    BONUS10). I token senza "=" degli events.csv precedenti restano validi
//    (semantica substring invariata).
const buildingMatchesEvent = (cityEntityId: string, event: EventEntry | null | undefined): boolean => {
  if (!event || event.tokens.length === 0) return false;
  const idUpper = cityEntityId.toUpperCase();
  return event.tokens.some((token) =>
    token.startsWith("=")
      ? idUpper === token.slice(1).toUpperCase()
      : idUpper.includes(token.toUpperCase())
  );
};

// --- HELPER COMPONENTS ---

const SortableHeader = memo(function SortableHeader({
  label,
  onClick,
  active,
  order,
  className = "",
  title,
  sortKey,
  noGap = false,
}: {
  label: React.ReactNode;
  onClick: (() => void) | null;
  active: boolean;
  order: "asc" | "desc";
  className?: string;
  title?: string;
  sortKey?: string;
  /** Rimuove il gap-1 tra icona e freccia di ordinamento. Usato SOLO dalle
   *  colonne della sezione Produzioni (20 colonne strette da 36px, dove il
   *  gap sommato su tutta la sezione la allarga inutilmente); le altre
   *  colonne mantengono il gap di default. */
  noGap?: boolean;
}) {
  const clickable = onClick !== null;
  return (
    <th
      onClick={onClick ?? undefined}
      title={title}
      data-sort-key={sortKey}
      className={`${className} ${clickable ? "cursor-pointer select-none hover:text-amber-400 transition-colors" : ""} ${active ? "!text-amber-400" : ""}`}
    >
      <span className={`inline-flex items-center${noGap ? "" : " gap-1"}`}>
        {label}
        {clickable && (
          <span className="text-[9px] opacity-70">
            {active ? (order === "desc" ? "▼" : "▲") : "⇅"}
          </span>
        )}
      </span>
    </th>
  );
});

/** Badge quantità per i pannelli Debug (Città/Inventario): "×N" col colore
 *  della sezione, omesso quando N === 1 (es. i Grandi Edifici sono sempre
 *  univoci, non serve mostrare "×1" su ognuno). */
function DebugQtyBadge({ qty, colorClass }: { qty: number; colorClass: string }) {
  if (qty === 1) return null;
  return <span className={colorClass}> ×{qty}</span>;
}

/** Elenco kit del pannello Debug inventario, raggruppato per tier
 *  (Platino/Oro/Argento/Normale). Il blocco era duplicato identico nei due
 *  riquadri Selection/Upgrade kit — fattorizzato qui: tra i due cambia solo
 *  la sorgente e il colore del badge quantità. "-" se la lista è vuota,
 *  come i riquadri Matched/Unmatched. */
function DebugKitsByTier({ kits, qtyColorClass, uiLang, onSelect }: {
  kits: Array<{ kitId: string; name: string; inStock: number; rawEntry?: unknown }>;
  qtyColorClass: string;
  uiLang: UiLang;
  onSelect: (title: string, rawEntry: unknown) => void;
}) {
  if (kits.length === 0) return <>-</>;
  const categorized = kits.map(e => ({ ...e, tier: kitTier(e.kitId) }));
  const TIERS = [
    { tier: "platinum", labelKey: "tierPlatinum", color: "text-cyan-300" },
    { tier: "gold",     labelKey: "tierGold",     color: "text-amber-300" },
    { tier: "silver",   labelKey: "tierSilver",   color: "text-slate-300" },
    { tier: "normal",   labelKey: "tierNormal",   color: "text-violet-300" },
  ] as const;
  return (
    <>
      {TIERS.map(({ tier, labelKey, color }) => {
        const items = categorized.filter(e => e.tier === tier).sort((a, b) => a.name.localeCompare(b.name));
        if (items.length === 0) return null;
        return (
          <div key={tier} className="mb-2">
            <div className={`mb-1 text-[11px] font-bold uppercase tracking-wide border-b border-slate-800/50 ${color}`}>
              {t(labelKey, uiLang).toUpperCase()}
            </div>
            {items.map(e => (
              <div key={e.kitId} className="mt-0.5">
                <button onClick={() => onSelect(e.kitId, e.rawEntry)} className="debug-panel-entry">
                  {e.name}<DebugQtyBadge qty={e.inStock} colorClass={qtyColorClass} />
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

/** Colonne (Att/Att, Dif/Att, Att/Dif, Dif/Dif) dei bonus militari dei GE,
 *  per i moltiplicativi IQ nelle colonne IQ (come GB_MILITARY_SLOTS di BuildingModel). */
const GB_SLOT_IQ: Record<string, number[]> = {
  military_boost: [0, 1], fierce_resistance: [2, 3], advanced_tactics: [0, 1, 2, 3],
  attack_boost: [0], attacker_defense_boost: [1], defender_attack_boost: [2], defense_boost: [3],
};

/** Somma colonna per colonna di due quaterne di moltiplicativi (vuote = 0). */
function somma4(a?: readonly number[], b?: readonly number[]): number[] {
  return [0, 1, 2, 3].map(i => (a?.[i] ?? 0) + (b?.[i] ?? 0));
}

/** GE (Prestige): i moltiplicativi di Campi/Spedizioni/IQ (mostrati come "+N%" nelle
 *  colonne) contano nell'ordinamento come spareggio dopo il valore normale:
 *  valore + N/1000 (i valori militari sono interi, N < 100). */
function moltOrd(b: Building, modalita: string, slot: number): number {
  let n = 0;
  for (const m of b.gbMoltiplicativi ?? []) if (m.modalita === modalita && GB_SLOT_IQ[m.tipo]?.includes(slot)) n += m.valore;
  return n / 1000;
}

/** Cella militare di un GE con un bonus moltiplicativo: "+N%" in giallo; se la
 *  colonna ha anche un valore normale, il valore sopra e il moltiplicativo
 *  sotto, stessa grandezza (utente: bonus molto potente). Senza moltiplicativo: BoostCell normale. */
function CellaMolt({ value, molt, color, first, uiLang, segno, ge, contributo }: { value: number; molt: number; color: "red" | "blue"; first: boolean; uiLang?: UiLang; segno?: boolean; ge?: number;
  /** Scheda Città: contributo effettivo del moltiplicativo (% × totale della città), sotto il +N%. */
  contributo?: number }) {
  if (!molt) return <BoostCell value={value} color={color} className={first ? "section-divider" : ""} uiLang={uiLang} segno={segno} ge={ge} />;
  const tit = uiLang ? (contributo ? `${t("gbMultSpedTitle", uiLang)}\n${t("gbContribCellTitle", uiLang, molt, contributo)}` : t("gbMultSpedTitle", uiLang)) : undefined;
  const contr = contributo ? <span className={`block text-[10px] leading-tight cell-${color}`}>+{formatInt(contributo)}</span> : null;
  if (!value) return <td className={`cell-num${first ? " section-divider" : ""}`} title={tit}><span className="text-amber-300">+{molt}%</span>{contr}</td>;
  return (
    <td className={`cell-num cell-${color}${ge ? ` cell-${color}-ge` : ""}${first ? " section-divider" : ""}`} title={ge && uiLang ? `${t("gbBonusCellTitle", uiLang, ge)}\n${tit ?? ""}` : tit}>
      {segno && value > 0 ? "+" : ""}{formatInt(value)}
      <span className="block text-amber-300">+{molt}%</span>
      {contr}
    </td>
  );
}

/** Titolo di un gruppo di colonne (riga alta dell'intestazione) con l'icona
 *  del gioco davanti (novembre 2026: al posto delle emoji ⚔️🔰⚡✊🏾📦). */
function TitoloGruppo({ icona, testo }: { icona: string; testo: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <img src={icona} alt="" aria-hidden="true" className="inline-block h-4 w-4 object-contain" />
      {testo}
    </span>
  );
}

const TableHeaderIcon = memo(function TableHeaderIcon({ src, alt, className = "", spostata = true }: { src: string; alt: string; className?: string;
  /** false = senza "relative top-[1px]" (es. icona dei limitati). */
  spostata?: boolean }) {
  if (!src) {
    return <span title={alt || undefined} className="text-[11px] font-bold uppercase">{alt}</span>;
  }
  return <img src={src} alt={alt} title={alt || undefined} className={`inline-block h-[24px] w-auto ${spostata ? "relative top-[1px] " : ""}${className}`} />;
});



const BoostCell = memo(function BoostCell({ value, color, className = "", suffix = "", uiLang, segno, ge }: { value: number; color: "red" | "blue"; className?: string; suffix?: string; uiLang?: UiLang;
  /** "+" davanti ai valori positivi (aumenti, es. pannello Pergamene). */
  segno?: boolean;
  /** % dei bonus moltiplicativi dei GE già applicata al valore (Opzioni › Bonus GE): colore diverso + tooltip. */
  ge?: number }) {
  if (isStaleField(value)) {
    return <td className={className ? `cell-num ${className}` : "cell-num"} title={uiLang ? t("staleDataWarning", uiLang) : undefined}>⚠️</td>;
  }
  if (value === 0) {
    return <td className={className ? `cell-num ${className}` : "cell-num"}>-</td>;
  }
  const conGe = !!ge && !segno;
  const classe = conGe ? `cell-${color} cell-${color}-ge` : `cell-${color}`;
  return (
    <td className={className ? `cell-num ${classe} ${className}` : `cell-num ${classe}`} title={conGe && uiLang ? t("gbBonusCellTitle", uiLang, ge) : undefined}>
      {segno && value > 0 ? "+" : ""}{formatInt(value)}{suffix}
    </td>
  );
});

/** Cella generica per uno scalare di Building che potrebbe MANCARE su un
 *  profilo salvato prima dell'introduzione di quel campo (vecchio
 *  localStorage senza la chiave: il valore arriva `undefined`, non `0`).
 *  Se il valore è "stale" (vedi isStaleField), mostra un'icona di avviso con
 *  tooltip invece di propagare un NaN nella cella; altrimenti renderizza
 *  `children` (già formattato dal chiamante con formatProdK/formatProdPercent/
 *  ecc., dato che la formattazione corretta varia per colonna). Riusabile per
 *  qualunque campo futuro esposto allo stesso problema, non solo Mon/Mat/IQ. */
function StaleFieldCell({ value, className = "cell-num cell-white", uiLang, children }: { value: unknown; className?: string; uiLang: UiLang; children: ReactNode }) {
  if (isStaleField(value)) {
    return <td className={className} title={t("staleDataWarning", uiLang)}>⚠️</td>;
  }
  return <td className={className}>{children}</td>;
}

/** Le 4 celle [AttAtt rosso, DifAtt rosso, AttDif blu, DifDif blu] di un singolo
 *  blocco di bonus (Generale, Campi, Spedizioni...). I colori sono sempre
 *  nello stesso ordine fisso: questo pattern si ripete 3 volte dentro
 *  MilitaryBoostCells (general/gbg/sped), qui factorizzato una volta. */
function Boost4({ values, uiLang, segno, molt, ge, contributo }: { values: [number, number, number, number]; uiLang?: UiLang; segno?: boolean;
  /** Scheda Città: contributo effettivo dei moltiplicativi per colonna. */
  contributo?: readonly number[];
  /** GE (Prestige): moltiplicativi per colonna, mostrati come "+N%" in giallo (fuori dall'efficienza). */
  molt?: readonly number[];
  /** % dei bonus GE già applicata per colonna (Opzioni › Bonus GE). */
  ge?: readonly number[] }) {
  if (molt && molt.some(v => v)) return <>{([0, 1, 2, 3] as const).map(i => <CellaMolt key={i} value={values[i]} molt={molt[i] ?? 0} color={i < 2 ? "red" : "blue"} first={i === 0} uiLang={uiLang} segno={segno} ge={ge?.[i]} contributo={contributo?.[i]} />)}</>;
  return (
    <>
      <BoostCell value={values[0]} color="red" className="section-divider" uiLang={uiLang} segno={segno} ge={ge?.[0]} />
      <BoostCell value={values[1]} color="red" uiLang={uiLang} segno={segno} ge={ge?.[1]} />
      <BoostCell value={values[2]} color="blue" uiLang={uiLang} segno={segno} ge={ge?.[2]} />
      <BoostCell value={values[3]} color="blue" uiLang={uiLang} segno={segno} ge={ge?.[3]} />
    </>
  );
}

/** Le 8/12 celle dei bonus Generale + Campi/Σ + Spedizioni/Σ: stesso blocco
 *  ripetuto identico (a parte la fonte dati) nelle 3 tabelle (edifici, alleati
 *  posseduti, database alleati). `general`/`gbg`/`sped` sono i 4 valori
 *  [AttAtt, DifAtt, AttDif, DifDif] della rispettiva fonte (Building.general
 *  o ComputedAllyStats.computedGeneral, ecc.). */
type TabType = "database" | "alleati" | "propria_citta" | "inventario";

// Link diretti alle schede (2.0): nome nell'hash → scheda. In inglese per i
// link pubblici (foe-optimizer.com/#planner), con gli alias italiani.
const HASH_SCHEDA: Record<string, Scheda> = {
  database: "database", city: "citta", inventory: "inventario", planner: "planner",
  allies: "alleati", settlements: "insediamenti", options: "opzioni", help: "guida",
  citta: "citta", inventario: "inventario", alleati: "alleati", insediamenti: "insediamenti", opzioni: "opzioni", guida: "guida",
};

/** Voci a tre stati del gruppo "Nascondi / Mostra solo". */
type VoceTri = "nonAcc" | "autoAge" | "limitati" | "iq" | "alleati" | "frammenti" | "strada" | "aiuto" | "immagazzina" | "ge" | "pronti";
type StatoTri = 0 | 1 | 2;
const TRI_ZERO: Record<VoceTri, StatoTri> = { nonAcc: 0, autoAge: 0, limitati: 0, iq: 0, alleati: 0, frammenti: 0, strada: 0, aiuto: 0, immagazzina: 0, ge: 0, pronti: 0 };
/** true = riga da scartare: stato 1 scarta chi ha la caratteristica, stato 2 chi non ce l'ha. */
const scartaTri = (stato: StatoTri, ha: boolean) => (stato === 1 ? ha : stato === 2 ? !ha : false);

type TabFilters = {
  /** Caselle di categoria del nastro (2.0): OR tra quelle spuntate, vuoto = tutti. */
  categorie: Set<Categoria>;
  showEventFilter: string;
  /** "Nascondi / Mostra solo" del nastro (2.0): 0 tutti, 1 nascosti, 2 solo questi. */
  tri: Record<VoceTri, StatoTri>;
  /** Produzioni "sì" (riquadro verde): almeno una / tutte, secondo prodFilterMode. */
  prodFilter: Set<string>;
  prodFilterMode: "AND" | "OR";
  /** Produzioni "no" (riquadro rosso, 2.006): l'edificio non deve produrne nessuna. */
  prodNo: Set<string>;
  minEff: string;
};

/** Copie possedute di un edificio a una certa era (filtri Era / Beni dell'era di
 *  Città e Inventario), con le statistiche a quell'era se note. */
interface CopiaEra { era: number; n: number; stats?: EraStats }
/** Ere di cui le copie producono beni: della loro era, della precedente (benip,
 *  un'era sopra), della successiva (benis, un'era sotto). */
function ereDeiBeni(copie: Map<string, CopiaEra[]>): number[] {
  const ere = new Set<number>();
  copie.forEach(c => c.forEach(({ era, stats }) => {
    if (!stats) return;
    if (stats.beni > 0) ere.add(era);
    if (stats.benip > 0 && era > 0) ere.add(era - 1);
    if (stats.benis > 0) ere.add(era + 1);
  }));
  return [...ere].filter(e => AGES_BY_ID.has(e)).sort((a, b) => a - b);
}

/** Building "elaborato" per la tabella: aggiunge l'efficienza calcolata e i
 *  campi usati per ricerca/ordinamento/provenienza-da-kit. Tipo modulo-level
 *  (non locale ad App) cosi' da poter essere usato anche da BuildingRow. */
type ProcessedBuilding = Building & {
  currentEff: number;
  searchName: string;
  /** Opzioni › Bonus GE (Città/Inventario): % dei moltiplicativi dei GE già
   *  applicate ai valori militari, per colonna (0 = valore invariato). */
  _bonusGe?: { gen: number[]; gbg: number[]; sped: number[]; iq: number[] };
  /** Scheda Città, GE con bonus moltiplicativi: contributo effettivo per colonna
   *  (% × totale della città di quella statistica), contato nell'efficienza. */
  _contribGe?: { gen: number[]; gbg: number[]; sped: number[]; iq: number[] };
  /** Città / Inventario, filtri Era / Beni dell'era: era della copia posseduta mostrata
   *  (kitCount = quante copie a quell'era). */
  _eraCopia?: number;
  /** Inventario › Beni dell'era: colonna che dà i beni dell'era scelta (evidenziata). */
  _beniEvid?: "beni" | "benip" | "benis";
  isFromKit?: boolean;
  kitCount?: number;
  /** true SOLO per le righe iniettate nella tab Città dal toggle "Mostra
   *  anche Inventario" (vedi showInventoryInCity in App). Non sono istanze
   *  reali piazzate in città: nessuna azione/filtro Città-specifico
   *  (selezione, obsoleti, declassabili, disconnessi, slot alleato,
   *  evidenziazione) deve applicarsi a queste righe, anche se il loro
   *  cityEntityId coincide per caso con un'istanza reale in città. Il colore
   *  di riga (categoria "mergedInventory" in BUILDING_ROW_COLORS) le
   *  distingue visivamente; i badge KIT/INV/🧩 restano quelli già calcolati
   *  da processedInventoryKitBuildings (_invBadge), non toccati da questo flag. */
  _isMergedInventory?: boolean;
};

/** ProcessedBuilding con i campi extra usati solo nella tab Inventario
 *  (badge di provenienza, kit usati per il fabbricato, livello raggiunto). */
interface InventoryRowBuilding extends ProcessedBuilding {
  _inventoryOrder?: number;
  _invBadge?: "INV" | "INV_UPGRADED" | "FAB";
  _fabKitsUsed?: string[];
  _fabSourceId?: string;
  _fabSourceLv?: number;
  _invLevel?: number;
  _invIsMax?: boolean;
  _familyName?: string;
  _fabChoices?: string[] | null;
}

/** Opzioni › Bonus GE: % da evidenziare per colonna (solo dove il valore c'è). */
function evidGe(v: readonly number[], pct: readonly number[]): number[] {
  return [0, 1, 2, 3].map(i => (v[i] ? pct[i] ?? 0 : 0));
}
/** Come evidGe per le colonne Σ (Generali + Campi/Spedizioni): la % della
 *  parte che ha cambiato il valore (quella della modalità se c'è, se no i globali). */
function evidGeSomma(g: readonly number[], pg: readonly number[], m: readonly number[], pm: readonly number[]): number[] {
  return [0, 1, 2, 3].map(i => (m[i] && pm[i] ? pm[i]! : g[i] && pg[i] ? pg[i]! : 0));
}

/** Copia di un edificio con le statistiche di un'era (EraStats da CityEntities):
 *  usata dall'override dell'era corrente (applyEraStats) e dai filtri Era / Beni
 *  dell'era dell'Inventario (valori all'era della copia posseduta). */
function conStatsEra<T extends Building>(b: T, stats: EraStats): T {
  return {
    ...b,
    pop: stats.pop, fel: stats.fel, general: stats.general, gbg: stats.gbg, sped: stats.sped, iq: stats.iq,
    iqMonB: stats.iqMonB, iqMatB: stats.iqMatB, iqMon: stats.iqMon, iqMat: stats.iqMat, iqBeni: stats.iqBeni,
    iqTruppe: stats.iqTruppe, iqAzioni: stats.iqAzioni, iqCap: stats.iqCap,
    bp: stats.bp, fp: stats.fp, fpb: stats.fpb, med: stats.med, fur: stats.fur, tr: stats.tr, trne: stats.trne,
    beni: stats.beni, benip: stats.benip, benis: stats.benis, benisp: stats.benisp, benispb: stats.benispb,
    benib: stats.benib, benig: stats.benig, mon: stats.mon, mat: stats.mat,
    fsp: stats.fsp, tpm: stats.tpm, tpb: stats.tpb, adm: stats.adm, mod: stats.mod, rin: stats.rin, imm: stats.imm,
  };
}

/** Efficienza contando anche il contributo dei moltiplicativi di un GE (_contribGe). */
function effConContributo(b: ProcessedBuilding, weights: Weights): number {
  const c = b._contribGe;
  if (!c) return calculateEfficiency(b, weights);
  const add = (v: number[], d: number[]) => v.map((x, i) => x + (d[i] ?? 0));
  return calculateEfficiency({ ...b, general: add(b.general, c.gen) as Building["general"], gbg: add(b.gbg, c.gbg) as Building["gbg"],
    sped: add(b.sped, c.sped) as Building["sped"], iq: add(b.iq, c.iq) as Building["iq"] }, weights);
}

/** Opzioni › Bonus GE: valori militari moltiplicati per le % dei GE (arrotondati
 *  all'intero). null = nessun valore cambia. */
function conBonusGe<T extends ProcessedBuilding>(b: T, pct: NonNullable<ProcessedBuilding["_bonusGe"]>, weights: Weights): T | null {
  const mul = (v: number[], p: number[]) => v.map((x, i) => (p[i] && x ? Math.round(x * (1 + p[i]! / 100)) : x));
  const toccato = (v: number[], p: number[]) => v.some((x, i) => x && p[i]);
  if (!toccato(b.general, pct.gen) && !toccato(b.gbg, pct.gbg) && !toccato(b.sped, pct.sped) && !toccato(b.iq, pct.iq)) return null;
  const nb = { ...b,
    general: mul(b.general, pct.gen) as Building["general"], gbg: mul(b.gbg, pct.gbg) as Building["gbg"],
    sped: mul(b.sped, pct.sped) as Building["sped"], iq: mul(b.iq, pct.iq) as Building["iq"], _bonusGe: pct };
  return { ...nb, currentEff: effConContributo(nb, weights) };
}

/** Tabella degli edifici (utente, 06/11): scorrendo in basso l'intestazione non
 *  si vede più, quindi passando il mouse su una cella compare come tooltip il
 *  nome della sua colonna (lo stesso dell'intestazione, es. "Attacco
 *  attaccante – Campi"). UN solo gestore sulla <table> (delega): niente
 *  attributi su migliaia di celle né lavoro in più nei ridisegni di React.
 *  Il title viene messo solo sulla cella sotto il mouse e ricalcolato ogni
 *  volta (le colonne cambiano con Pop/Fel/Σ/Spedizioni…); le celle col LORO
 *  tooltip (bonus GE, contributi, ⚠️…) restano come sono: le riconosce perché
 *  il loro title non è quello messo qui (data-col-auto). */
function titoloColonna(e: React.MouseEvent<HTMLTableElement>) {
  const td = (e.target as HTMLElement).closest?.("td");
  if (!td || td.colSpan > 1) return;
  const tr = td.parentElement as HTMLTableRowElement | null;
  const intest = e.currentTarget.tHead?.rows[1];
  if (!tr || !intest || tr.cells.length !== intest.cells.length) return;
  const th = intest.cells[td.cellIndex];
  if (!th || th.matches(".cell-checkbox, .cell-eye, .cell-name")) return;
  if (td.title && td.title !== td.dataset.colAuto) return; // tooltip suo
  const img = th.querySelector("img");
  const nome = th.title || img?.alt || th.textContent?.trim() || "";
  if (!nome || nome === "❔") return; // (colonna dei bonus: le icone hanno già il loro tooltip)
  td.title = nome;
  td.dataset.colAuto = nome;
}

const MilitaryBoostCells = memo(function MilitaryBoostCells({
  general,
  gbg,
  sped,
  showSigmaColumns,
  spedizioniEnabled,
  uiLang,
  segno,
  moltSped,
  moltGbg,
  moltGen,
  bonusGe,
  contribGe,
}: {
  general: number[];
  gbg: number[];
  sped: number[];
  showSigmaColumns: boolean;
  spedizioniEnabled: boolean;
  uiLang?: UiLang;
  segno?: boolean;
  /** GE (Prestige): moltiplicativi delle Spedizioni per colonna (Att/Att, Dif/Att, Att/Dif, Dif/Dif). */
  moltSped?: readonly number[];
  /** GE (Prestige): moltiplicativi dei Campi per colonna. */
  moltGbg?: readonly number[];
  /** GE (Prestige): moltiplicativi "ovunque" (Sifone) per colonna. */
  moltGen?: readonly number[];
  /** Opzioni › Bonus GE: % già applicate per colonna. */
  bonusGe?: ProcessedBuilding["_bonusGe"];
  /** Scheda Città: contributo effettivo dei moltiplicativi del GE. */
  contribGe?: ProcessedBuilding["_contribGe"];
}) {
  const sigmaGbg: [number, number, number, number] = [
    showSigmaColumns ? general[0] + gbg[0] : gbg[0],
    showSigmaColumns ? general[1] + gbg[1] : gbg[1],
    showSigmaColumns ? general[2] + gbg[2] : gbg[2],
    showSigmaColumns ? general[3] + gbg[3] : gbg[3],
  ];
  const sigmaSped: [number, number, number, number] = [
    showSigmaColumns ? general[0] + sped[0] : sped[0],
    showSigmaColumns ? general[1] + sped[1] : sped[1],
    showSigmaColumns ? general[2] + sped[2] : sped[2],
    showSigmaColumns ? general[3] + sped[3] : sped[3],
  ];
  return (
    <>
      {/* moltiplicativi "ovunque" (Sifone): nei Generali; con Σ, che nasconde i
          Generali, nelle colonne Gen + Campi e Gen + Spedizioni */}
      {!showSigmaColumns && <Boost4 values={general as [number, number, number, number]} uiLang={uiLang} segno={segno} molt={moltGen} ge={bonusGe && evidGe(general, bonusGe.gen)} contributo={contribGe?.gen} />}
      <Boost4 values={sigmaGbg} uiLang={uiLang} segno={segno} molt={showSigmaColumns || contribGe ? somma4(moltGbg, moltGen) : moltGbg}
        contributo={contribGe && (showSigmaColumns ? somma4(contribGe.gen, contribGe.gbg) : contribGe.gbg)}
        ge={bonusGe && (showSigmaColumns ? evidGeSomma(general, bonusGe.gen, gbg, bonusGe.gbg) : evidGe(gbg, bonusGe.gbg))} />
      {spedizioniEnabled && <Boost4 values={sigmaSped} uiLang={uiLang} segno={segno} molt={showSigmaColumns || contribGe ? somma4(moltSped, moltGen) : moltSped}
        contributo={contribGe && (showSigmaColumns ? somma4(contribGe.gen, contribGe.sped) : contribGe.sped)}
        ge={bonusGe && (showSigmaColumns ? evidGeSomma(general, bonusGe.gen, sped, bonusGe.sped) : evidGe(sped, bonusGe.sped))} />}
    </>
  );
});

/** Celle Produzioni (PF/Beni/BeniP) per una riga della tabella Alleati —
 *  equivalente di MilitaryBoostCells per la sezione "📦 PRODUZIONI".
 *  Solo 3 colonne (non le ~20 della tabella edifici): sono le uniche
 *  produzioni che gli alleati "science" hanno oggi (vedi Ally.pf/beni/beniP
 *  in allies.ts) — 0 per i normali alleati "military", quindi la cella
 *  mostra "-" in quel caso, stesso trattamento di formatProdNum per un
 *  valore a zero. */
const AllyProductionCells = memo(function AllyProductionCells({
  pf, beni, beniP,
}: {
  pf: number;
  beni: number;
  beniP: number;
}) {
  return (
    <>
      <td className={`cell-num section-divider${pf > 0 ? " cell-prod" : ""}`}>{formatProdNum(pf)}</td>
      <td className={`cell-num${beni > 0 ? " cell-prod" : ""}`}>{formatProdNum(beni)}</td>
      <td className={`cell-num${beniP > 0 ? " cell-prod" : ""}`}>{formatProdNum(beniP)}</td>
    </>
  );
});

/** Props di una singola riga BuildingRow. I valori derivati da Map/Set dello
 *  stato di App (isSelected, isHighlighted, disconnectedCount, ecc.) sono
 *  già "risolti" per questo specifico edificio dal genitore: questo evita di
 *  passare intere Map/Set come prop (che cambierebbero identità ad ogni
 *  render e vanificherebbero la memo) mantenendo lo stesso identico
 *  comportamento di lookup che la riga aveva prima dell'estrazione. */
/** Popup anteprima immagine (vedi imagePopup in App). `x` è il bordo DESTRO
 *  dell'ancora (elemento che lo apre, o cursore + margine sulla mappa): il popup
 *  si apre a destra di `x`. `anchorLeft` è il bordo SINISTRO dell'ancora, usato
 *  quando a destra non c'è spazio e il popup va aperto a sinistra: deve finire
 *  prima di `anchorLeft`, altrimenti copre l'ancora stessa (assente = `x`). */
type ImagePopupState = { x: number; y: number; url: string; name: string; id?: string; subtitle?: string; anchorLeft?: number };

interface BuildingRowProps {
  b: ProcessedBuilding;
  activeTab: TabType;
  uiLang: UiLang;
  gameLang: Lang;
  currentEraId: number;
  showSigmaColumns: boolean;
  spedizioniEnabled: boolean;
  showPopColumn: boolean;
  showFelColumn: boolean;
  showIqProdColumns: boolean;
  showProdColumns: boolean;
  specialKits: SpecialKits;
  DIFF_FIELDS: DiffField[];
  isSelected: boolean;
  isHighlighted: boolean;
  disconnectedCount: number;
  needlessCount: number;
  importedCount: number;
  greatBuildingInfo: GreatBuilding | undefined;
  gameDisplayName: string | undefined;
  upgradeBadge: { targets: string[]; kits: Array<{ name: string; count: number }> } | undefined;
  isOutdated: boolean;
  /** Zebra striping: true per la seconda/quarta/sesta... riga VISIBILE
   *  (indice dispari nell'array già filtrato/ordinato) — aggiunge .row-even
   *  alla classe di categoria già presente. Calcolato dal chiamante
   *  dall'indice in filteredBuildings.map, quindi segue automaticamente
   *  qualunque filtro/ordinamento attivo senza bisogno di ricalcolo
   *  dedicato: l'indice nell'array già filtrato è sempre quello giusto. */
  isEven: boolean;
  /** Catalogo › Grandi Edifici: niente cella dei limitati. */
  senzaLimitati?: boolean;
  /** Apre il report del GE (pulsante 📊 accanto al nome, al posto del vecchio badge "GE"). */
  onReport?: (id: string) => void;
  /** Catalogo › Grandi Edifici: niente celle delle produzioni delle Incursioni. */
  senzaIq?: boolean;
  isDeclassable: boolean;
  allySlots: Array<{ filled: boolean; allyDisplayName?: string }> | undefined;
  declassablePopData: { popCurr: number; popBronze: number; statsBronze: EraStats } | undefined;
  setDeclassableTooltip: (v: { x: number; y: number; eraAge: string; diffs: EraDiffEntry[]; popSavings: number; oneDownKit: number; oneDownKitName?: string; reversionKit: number; reversionKitName?: string } | null) => void;
  minLevel: number;
  allLevelsForEntity: number[] | undefined;
  instanceEraStats: Array<[string, number, EraStats]>;
  fragmentsProduced: FragmentProduced[];
  handleCityRowClick: (building: ProcessedBuilding) => void;
  toggleSelect: (id: string) => void;
  getPropDisplay: (b: Building, lang: UiLang) => string;
  setImagePopup: (v: ImagePopupState | null) => void;
  scheduleImagePopupClose: () => void;
  setUpgradeTooltip: (v: { x: number; y: number; targets: string[]; kits: Array<{ name: string; count: number }> } | null) => void;
  setOutdatedTooltip: (v: { x: number; y: number; minLevel: number; allLevels: number[]; currentEraId: number; oneUpKit: number; renovationKit: number; oneUpKitName?: string; renovationKitName?: string; isUpgradable: boolean; upgradableTargets: string[]; upgradableKits: Array<{ name: string; count: number }>; eraComparisons: Array<{ eraId: number; eraName: string; count: number; diffs: EraDiffEntry[]; goodsInvolved: boolean }> } | null) => void;
  setFragmentTooltip: (v: { x: number; y: number; produced: Array<{ name: string; options?: string[]; producedAmount?: number; requiredAmount?: number }> } | null) => void;
  setFabTooltip: (v: { x: number; y: number; kitsUsed: string[]; sourceId?: string; sourceLv?: number; choices?: string[] } | null) => void;
}

/** Riga della tabella principale edifici: estratta come componente
 *  memoizzato per evitare che le centinaia di righe vengano ri-renderizzate
 *  ad ogni cambio di stato di App (es. apertura di un modal) che non le
 *  riguarda. Le prop derivate (isSelected, isHighlighted, ecc.) sono valori
 *  primitivi/stabili: cambiano identità solo per la riga davvero coinvolta,
 *  cosi' un singolo click su un checkbox non forza il re-render di tutte le
 *  altre righe. Nessuna modifica alla logica originale: solo trasloco di
 *  codice + lookup nelle Map fatti dal genitore invece che qui dentro. */
const BuildingRow = memo(function BuildingRow({
  b, activeTab, uiLang, gameLang, currentEraId, showSigmaColumns, spedizioniEnabled,
  showPopColumn, showFelColumn, showIqProdColumns, showProdColumns,
  specialKits, DIFF_FIELDS, isSelected, isHighlighted, disconnectedCount, needlessCount, importedCount,
  greatBuildingInfo, gameDisplayName, upgradeBadge, isOutdated, isEven, senzaLimitati, onReport, senzaIq, isDeclassable, allySlots, declassablePopData, setDeclassableTooltip, minLevel, allLevelsForEntity,
  instanceEraStats, fragmentsProduced,
  handleCityRowClick, toggleSelect, getPropDisplay,
  setImagePopup, scheduleImagePopupClose, setUpgradeTooltip, setOutdatedTooltip, setFragmentTooltip, setFabTooltip,
}: BuildingRowProps) {
  // icone della colonna ❔ (BONUS nel catalogo dei GE): 24 px nel catalogo dei GE, 16 px nelle altre tabelle (utente)
  const dimIcona = senzaLimitati ? "h-6 w-6" : "h-4 w-4";
  // GE (Prestige): colonne di produzione con valore solo dal tier Oro in oro
  const classeProd = (col: string) => (b._beniEvid === col ? " cell-prod cell-beni-evid" : b.gbColonneOro?.includes(col) ? " cell-prod-gold" : " cell-prod");
  return (
    <tr
      key={b.id}
      onClick={() => handleCityRowClick(b)}
      className={`${
        activeTab === "propria_citta" && isHighlighted && !b.isFallback
          // Niente outline: la riga selezionata (click riga o edificio in
          // mappa) deve cambiare SOLO lo sfondo (row-highlighted, vedi
          // index.css), non il bordo — il bordo giallo era percepito come
          // "troppo" e non richiesto (bug segnalato luglio 2026).
          ? "row-highlighted relative z-10"
          : (() => {
              // isInactive scoped a propria_citta: segnala un'istanza
              // PIAZZATA in città che è scaduta ("Non attivo") — utile lì
              // per capire a colpo d'occhio quali edifici vanno sostituiti.
              // In tab Database (dove b.isInactive marca semplicemente la
              // VARIANTE "Non attivo" del building nel catalogo, non
              // un'istanza reale del giocatore) evidenziarla non serve e
              // confondeva con lo stile "errore/urgente" — bug segnalato
              // luglio 2026.
              const cat = b._isMergedInventory ? "mergedInventory"
                // (novembre 2026, utente: GE senza sfondo colorato, il tier è nel
                // colore del nome. Per tornare allo sfondo oro/rame: "great" qui sotto
                // e la riga " row-copper" più giù)
                // : b.isGreatBuilding ? "great"
                : b.isMilitary ? "military"
                : b.isGoods ? "goods"
                : (b.isInactive && activeTab === "propria_citta") ? "inactive"
                : b.isFallback ? "fallback"
                : "normal";
              const disconnected = activeTab === "propria_citta" && !b._isMergedInventory && (disconnectedCount) > 0;
              const notInCsv = b.cityEntityId && !CSV_ENTITY_IDS_SET.has(b.cityEntityId);
              return BUILDING_ROW_COLORS[cat]
                // GE nel tier Rame: tinta rame invece dell'oro (Prestige) — disattivato con lo sfondo dei GE
                // + (cat === "great" && b.gbTier === "rame" ? " row-copper" : "")
                + (isEven ? " row-even" : "")
                + (disconnected ? " " + ROW_DISCONNECTED_OVERLAY : "")
                // shadow inset invece di border-left: un vero border
                // partecipa al box model e su table con
                // border-collapse sposta di 1-2px il contenuto
                // delle righe che lo hanno rispetto a quelle senza
                // (il bordo "ruba" spazio solo dove è presente).
                // Lo shadow inset disegna lo stesso indicatore senza
                // alterare le dimensioni della riga.
                + (notInCsv ? " shadow-[inset_2px_0_0_0_theme(colors.red.700)]" : "");
            })()
      } transition-colors ${activeTab === "propria_citta" && !b.isFallback ? "cursor-pointer" : ""}`}
    >
      {!senzaLimitati && <td className="cell-checkbox">
        <label className="inline-flex cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(b.id)}
            aria-label={t("selectBuildingLabel", uiLang, b.name)}
            className="peer sr-only"
          />
          <span
            className={`relative top-px block box-border h-3 w-3 shrink-0 rounded-[4px] border ${
              isSelected
                ? "bg-amber-500 border-amber-500"
                : "bg-transparent border-slate-600 peer-hover:border-slate-400"
            }`}
          >
            {isSelected && (
              <Check
                size={9}
                strokeWidth={3}
                className="text-slate-950 pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            )}
          </span>
        </label>
      </td>}
      <td className="cell-eye">
        {(() => {
          const isGameTab = activeTab === "propria_citta" || activeTab === "inventario";
          // La wiki FoE ha un sottodominio per ogni lingua del gioco: la
          // lingua corrente si usa direttamente, nessun collasso necessario.
          const wikiLang: Lang = isGameTab ? gameLang : uiLang;
          const hasItName = isGameTab || ITALIAN_NAMES.has(b.cityEntityId);
          const displayedName = isGameTab
            ? (gameDisplayName ?? b.name)
            : displayName(b.cityEntityId, b.name, uiLang);
          const imgUrl = getImageUrl(b.cityEntityId, b.hash);
          // Niente `if (!imgUrl) return`: molti livelli intermedi di set a
          // gradazione (es. "Momiji Stop - Lv. 6") riusano lo sprite di un
          // livello precedente e nel MainParser non hanno un hash immagine
          // proprio — buildings.py lascia quindi il campo Hash vuoto in CSV
          // per quell'entry (verificato: solo Lv. 1/5/8 di quel set hanno
          // hash, i livelli 2-4/6-7 no). Aprire comunque il popup (senza
          // immagine, vedi imagePopup più sotto) permette di leggere almeno
          // il CityEntityId anche per quei livelli — bug segnalato luglio
          // 2026 ("Lv. 6 non ha né immagine né ID"). */
          const showImagePopup = (e: { currentTarget: HTMLElement }) => {
            const r = e.currentTarget.getBoundingClientRect();
            setImagePopup({ x: r.right, y: r.top, url: imgUrl ?? "", name: displayedName, id: b.cityEntityId, anchorLeft: r.left });
          };
          if (hasItName) {
            return (
              <a
                href={BuildingModel.wikiUrl(displayedName, wikiLang)}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={showImagePopup}
                onMouseLeave={scheduleImagePopupClose}
                title={t("viewOnWikiTitle", uiLang, displayedName, wikiLang.toUpperCase())}
                className="inline-flex items-center justify-center text-[13px] leading-none hover:scale-125 transition-transform -translate-x-[3px]"
              >
                👁️
              </a>
            );
          }
          // Nessuna traduzione nota per la lingua GUI corrente (edifici
          // nuovi non ancora tradotti, tab Database): niente link wiki
          // affidabile da costruire, ma l'ID/immagine restano comunque
          // utili per controllo "da debug" (richiesto dall'utente luglio
          // 2026) — "?" al posto di 👁️ per segnalare visivamente che qui
          // non c'è un link cliccabile, solo l'hover informativo con lo
          // stesso popup. Nessun title/tooltip: è volutamente "silenzioso",
          // il popup all'hover è già autoesplicativo (luglio 2026).
          return (
            <span
              onMouseEnter={showImagePopup}
              onMouseLeave={scheduleImagePopupClose}
              className="inline-flex items-center justify-center text-[11px] font-bold text-slate-500 hover:text-slate-300 cursor-help leading-none transition-colors -translate-x-[3px]"
            >
              ?
            </span>
          );
        })()}
      </td>
      <td
        className={`cell-name${activeTab === "database" && b.unique ? " unique" : ""}`}
      >
        {/* (contenitore flex: la <td> resta una cella di tabella, così è centrata in verticale come le altre) */}
        <div className="cell-name-flex">
        {/* Wrapper truncabile SOLO sul testo nome: .cell-name (index.css) è ora
            un flex row, non più un blocco con `truncate` diretto — così i
            badge fratelli dopo questo span (es. 🧩 frammenti) restano
            flex-shrink-0 e non vengono mai tagliati via insieme all'ellissi
            quando il nome da solo satura i 260px della colonna (bug
            segnalato luglio 2026 su "Centro di Riabilitazione Elefanti -
            Livello 9"). `min-w-0` è necessario perché un figlio flex di
            default non si restringe sotto il proprio content-width.
            ⚠️ NIENTE `flex-1` (flex-grow): con nomi corti tipo "Trincea
            Bellica - Livello 2" uno span flex-1 si espande comunque a
            riempire tutto lo spazio libero della cella, spingendo i badge
            fratelli (es. GE, 🧩) fino al bordo destro invece di lasciarli
            subito dopo il testo — bug segnalato luglio 2026. Solo `shrink`
            (senza grow, flex-basis auto di default): lo span parte dalla
            sua larghezza naturale e si comprime SOLO quando testo+badge
            insieme non ci stanno nei 260px.
            Tooltip col nome completo SPOSTATO QUI (agosto 2026, era sulla
            <td> intera): un title sull'intera cella faceva apparire il
            tooltip anche passando sopra i badge dopo il nome (frammenti,
            ×N, GE...), coprendo i LORO popup — segnalato dall'utente come
            fastidioso. Il browser mostra comunque il tooltip nativo SOLO
            quando il mouse è sopra questo span (non sui badge fratelli,
            che sono elementi separati fuori da questo tag) — non serve
            calcolare se il testo è realmente troncato: già di fatto non
            appare più fuori dal nome. Ricalcola lo stesso displayNameText
            usato più sotto: duplicazione minima, ma evita di sollevare lo
            stato fuori dalla IIFE. Per le Grandi Opere include anche
            " - X/Y" (stessa stringa del ramo isGreatBuilding più sotto):
            è spesso proprio quella parte, non il nome, a restare tagliata
            dal truncate — bug segnalato luglio 2026 su "Cancello di Saturno
            VI IDRA - Lv. 100/100". */}
        <span
          className="truncate min-w-0 shrink"
          title={(() => {
            const isGameTab = activeTab === "propria_citta" || activeTab === "inventario";
            const nameText = isGameTab
              ? (gameDisplayName ?? displayName(b.cityEntityId, b.name, gameLang))
              : displayName(b.cityEntityId, b.name, uiLang);
            if (b.isGreatBuilding && greatBuildingInfo) {
              return `${nameText} - ${greatBuildingInfo.level}/${greatBuildingInfo.maxLevel}`;
            }
            return nameText;
          })()}
        >
          {(() => {
            const isGameTab = activeTab === "propria_citta" || activeTab === "inventario";
            // Tab gioco: nome originale del gioco (gameNames) > traduzione
            // localizzata nella lingua del profilo > fallback CSV.
            // Tab database: traduzione nella lingua scelta per la GUI.
            const displayNameText = isGameTab
              ? (gameDisplayName ?? displayName(b.cityEntityId, b.name, gameLang))
              : displayName(b.cityEntityId, b.name, uiLang);
            // Evidenzia in italic i nomi non tradotti: se siamo in game-tab
            // la traduzione manca se anche la lingua del profilo non la
            // possiede; in tab database la traduzione manca se non esiste
            // una entry diretta per uiLang (si ricade sul fallback inglese).
            const hasIt = isGameTab
              ? (gameDisplayName !== undefined) || ITALIAN_NAMES.has(b.cityEntityId)
              : hasTranslation(b.cityEntityId, uiLang);
            if (b.isGreatBuilding) {
              return (
                <>
                  {/* nome in oro (tier Oro) o rame (tier Rame) */}
                  <span className={`${hasIt ? "font-bold" : "font-bold italic"} ${b.gbTier === "rame" ? "ge-name-copper" : "ge-name-gold"}`}>
                    {displayNameText}
                  </span>
                  {(() => {
                    const gb = greatBuildingInfo;
                    return gb ? <span className={`font-normal ${b.gbTier === "rame" ? "ge-name-copper" : "ge-name-gold"}`}> - {gb.level}/{gb.maxLevel}</span> : null;
                  })()}
                </>
              );
            }
            // Testo rosso scoped a propria_citta, stessa ragione dello
            // sfondo riga sopra: in tab Database b.isInactive marca solo
            // la variante di catalogo, non un'istanza scaduta reale.
            if (b.isInactive && activeTab === "propria_citta") {
              return (
                <span className={hasIt ? "font-bold text-red-400" : "font-bold text-red-400 italic"}>
                  {displayNameText}
                </span>
              );
            }
            const isInventarioInv = (activeTab === "inventario" || b._isMergedInventory) && (b as InventoryRowBuilding)._invBadge === "INV";
            return (
              <span className={hasIt ? (isInventarioInv ? "text-emerald-400 font-semibold" : "") : (isInventarioInv ? "text-emerald-400 font-semibold italic" : "italic")}>
                {displayNameText}
              </span>
            );
          })()}
        </span>
        {onReport && b.isGreatBuilding && (
          <button type="button" onClick={e => { e.stopPropagation(); onReport(b.cityEntityId); }}
            className="ml-1.5 inline-flex flex-shrink-0 items-center rounded border border-slate-700 bg-slate-900 px-1 py-px text-amber-300 hover:border-amber-500"
            title={t("gbReportOpen", uiLang)} aria-label={t("gbReportOpen", uiLang)}>
            <ChartColumn size={13} />
          </button>
        )}
        {/* scheda Città: il Calcolatore GE su questo GE, al livello da costruire (livello attuale + 1;
            anche se non ancora sbloccato: max_level del gioco è il livello sbloccato, non il massimo) */}
        {activeTab === "propria_citta" && !b._isMergedInventory && b.isGreatBuilding && greatBuildingInfo && greatBuildingInfo.level < (greatBuildingInfo.tierMax === "copper" ? 200 : 500) && (() => {
          // (niente PF già messi: il totale della città è di tutti i giocatori, e la classifica
          // del GE costerebbe un import a ogni GE aperto; utente 09/11)
          const titolo = t("gbCalcOpen", uiLang, greatBuildingInfo.level + 1);
          return (
            <a href={`/${uiLang === "it" ? "ge" : "gb"}/?ge=${encodeURIComponent(b.cityEntityId)}&livello=${greatBuildingInfo.level + 1}`}
              target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
              className="ml-1 inline-flex flex-shrink-0 items-center rounded border border-slate-700 bg-slate-900 px-1 py-px text-sky-300 hover:border-sky-500"
              title={titolo} aria-label={titolo}>
              <Calculator size={13} />
            </a>
          );
        })()}
        {noRush(b) && (
          <span className="ml-1 inline-flex flex-shrink-0 cursor-help relative top-px" title={t("noRushBadgeTitle", uiLang)}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#7f1d1d" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />
            </svg>
          </span>
        )}
        {isEraMutable(b) && (
          <span className="ml-1 inline-flex flex-shrink-0 cursor-help relative top-px" title={t("eraMutableBadgeTitle", uiLang)}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#0e7490" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="8 14 12 10 16 14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {(activeTab === "inventario" || b._isMergedInventory) && b.isUnresolved && (
          <span className="ml-1.5 inline-block flex-shrink-0 text-[11px] font-mono font-bold px-1 rounded bg-red-950/60 text-red-400 border border-red-900 cursor-help" title={t("unresolvedValuesTitle", uiLang)}>
            UNKNOWN
          </span>
        )}
        {activeTab === "propria_citta" && !b._isMergedInventory && (() => {
          if (b.isGreatBuilding) return null;
          const count = importedCount;
          if (count <= 1) return null;
          // mr-1 SOLO se seguono slot alleati (stessa condizione con cui
          // vengono renderizzati più sotto): quel margine serve a dare
          // respiro prima della prima stellina, ma se il badge ×N è
          // l'ultimo elemento della cella lascia solo spazio vuoto inutile
          // prima del bordo — bug segnalato luglio 2026.
          const hasAllySlots = activeTab === "propria_citta" && !b._isMergedInventory && !!allySlots && allySlots.length > 0;
          return (
            <span className={`ml-1.5 ${hasAllySlots ? "mr-1" : ""} inline-block flex-shrink-0 text-xs font-mono font-bold px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900`}>
              ×{count}
            </span>
          );
        })()}
        {activeTab === "propria_citta" && !b._isMergedInventory && (() => {
          if (!b.cityEntityId) return null;
          const disconnCount = disconnectedCount;
          if (disconnCount <= 0) return null;
          return (
            <span className="ml-1.5 inline-block flex-shrink-0 text-[10px] font-mono font-bold px-1 rounded bg-red-950 text-red-400 border border-red-600" title={t("disconnectedFromRoadTitle", uiLang)}>
              {t("disconnectedFromRoadBadge", uiLang)}
            </span>
          );
        })()}
        {activeTab === "propria_citta" && !b._isMergedInventory && (() => {
          if (b.isGreatBuilding || b.isInactive) return null;
          if (!b.cityEntityId) return null;
          if (needlessCount <= 0) return null;
          return (
            <span className="ml-1.5 inline-block flex-shrink-0 text-[10px] font-mono font-bold px-1 rounded bg-amber-950 text-amber-400 border border-amber-600" title={t("needlesslyConnectedTitle", uiLang)}>
              {t("needlesslyConnectedBadge", uiLang, needlessCount)}
            </span>
          );
        })()}
        {activeTab === "propria_citta" && !b._isMergedInventory && (() => {
          if (b.isGreatBuilding || b.isInactive) return null;
          const badge = upgradeBadge;
          if (!badge) return null;
          return (
            <span
              className="ml-1.5 inline-block flex-shrink-0 text-[10px] font-mono font-bold px-1 rounded bg-sky-950 text-sky-300 border border-sky-700 cursor-help"
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setUpgradeTooltip({ x: r.left, y: r.bottom, targets: badge.targets, kits: badge.kits });
              }}
              onMouseLeave={() => setUpgradeTooltip(null)}
            >
              {t("upgradableBadge", uiLang)}
            </span>
          );
        })()}
        {activeTab === "propria_citta" && !b._isMergedInventory && (() => {
          if (b.isGreatBuilding || b.isInactive || b.isMilitary || !b.cityEntityId) return null;
          if (!isOutdated) return null;
          const minLvl = minLevel;
          return (
            <span
              className="ml-2 inline-block flex-shrink-0 cursor-help "
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                // Confronto "se aggiorni": per ogni era obsoleta in cui possiedo
                // copie, calcolo i campi che cambierebbero passando ai valori
                // dell'era corrente (b ha già i valori correnti via applyEraStats).
                const groups = instanceEraStats;
                const bRec = b as unknown as { [k: string]: unknown };
                const goodsFields = ["beni", "benip", "benis", "benib", "benig"];
                const eraComparisons = groups
                  .filter(([eraAge]) => {
                    const eraId = AGE_BY_CODE.get(eraAge)?.id ?? -1;
                    return eraId >= 0 && eraId < currentEraId; // solo ere più vecchie
                  })
                  .map(([eraAge, count, stats]) => {
                    const oldRec = stats as unknown as { [k: string]: unknown };
                    const diffs: EraDiffEntry[] = [];
                    let goodsInvolved = false; // beni>0 in una delle due ere → il tipo di bene cambia comunque con l'era
                    for (const f of DIFF_FIELDS) {
                      const from = f.get(oldRec);
                      const to = f.get(bRec);
                      if (goodsFields.includes(f.key) && (from > 0 || to > 0)) goodsInvolved = true;
                      if (from !== to) {
                        diffs.push({ key: f.key, icon: f.icon ?? "", emoji: f.emoji, labelKey: f.labelKey, from, to });
                      }
                    }
                    const eraId = AGE_BY_CODE.get(eraAge)?.id ?? -1;
                    return { eraId, eraName: ageName(eraAge, gameLang), count, diffs, goodsInvolved };
                  })
                  .sort((a, b2) => a.eraId - b2.eraId);
                setOutdatedTooltip({
                  x: r.left,
                  y: r.bottom,
                  minLevel: minLvl,
                  allLevels: allLevelsForEntity ?? [minLvl],
                  currentEraId,
                  oneUpKit: specialKits.oneUpKit,
                  renovationKit: specialKits.renovationKit,
                  oneUpKitName: specialKits.oneUpKitName,
                  renovationKitName: specialKits.renovationKitName,
                  isUpgradable: !!upgradeBadge,
                  upgradableTargets: upgradeBadge?.targets ?? [],
                  upgradableKits: upgradeBadge?.kits ?? [],
                  eraComparisons,
                });
              }}
              onMouseLeave={() => setOutdatedTooltip(null)}
            >
              <svg viewBox="0 0 8 8" width="8" fill="#D35"><path d="M0 0l4 8 4-8H0z"/></svg>
            </span>
          );
        })()}
        {activeTab === "propria_citta" && !b._isMergedInventory && (() => {
          if (b.isGreatBuilding || b.isInactive || b.isMilitary || !b.cityEntityId) return null;
          if (!isDeclassable) return null;
          return (
            <span
              className="ml-2 inline-block flex-shrink-0 cursor-help"
              onMouseEnter={(e) => {
                if (!declassablePopData) return;
                const r = e.currentTarget.getBoundingClientRect();
                const bRec = b as unknown as { [k: string]: unknown };
                const bronzeRec = declassablePopData.statsBronze as unknown as { [k: string]: unknown };
                const diffs: EraDiffEntry[] = [];
                for (const f of DIFF_FIELDS) {
                  const from = f.get(bRec);
                  const to = f.get(bronzeRec);
                  if (from !== to) diffs.push({ key: f.key, icon: f.icon ?? "", emoji: f.emoji, labelKey: f.labelKey, from, to });
                }
                setDeclassableTooltip({
                  x: r.left, y: r.bottom,
                  eraAge: AGES_BY_ID.get(minLevel)?.age ?? "",
                  diffs,
                  popSavings: declassablePopData.popBronze - declassablePopData.popCurr,
                  oneDownKit: specialKits.oneDownKit,
                  oneDownKitName: specialKits.oneDownKitName,
                  reversionKit: specialKits.reversionKit,
                  reversionKitName: specialKits.reversionKitName,
                });
              }}
              onMouseLeave={() => setDeclassableTooltip(null)}
            >
              <svg viewBox="0 0 8 8" width="8" fill="#2a6"><path d="M0 0l4 8 4-8H0z"/></svg>
            </span>
          );
        })()}
        {activeTab === "propria_citta" && !b._isMergedInventory && allySlots && allySlots.map((slot, i) => (
          <span
            // Le icone non hanno un id stabile proprio (sono slot posizionali
            // "pieno/vuoto" per copia, non entità con identità); l'ordine è
            // ricalcolato ad ogni render da allySlotsPerBuilding, quindi
            // l'indice di posizione è la chiave corretta qui.
            key={i}
            // Il primo slot ha bisogno di più margine (ml-1.5, come prima
            // della riduzione generale) SOLO quando non è preceduto dal
            // badge quantità (×N, stessa condizione con cui viene generato
            // più sopra: isGreatBuilding→null, count<=1→null) — quel badge
            // ha già un mr-1 proprio che dà spazio a sufficienza. Senza
            // badge quantità in mezzo, ml-0.5 lasciava il primo slot troppo
            // attaccato al nome (bug segnalato luglio 2026 su "Piazza
            // Yukitomo"). Gli slot successivi restano sempre ml-0.5.
            className={`${i === 0 && (b.isGreatBuilding || importedCount <= 1) ? "ml-1.5" : "ml-0.5"} inline-block flex-shrink-0 cursor-help`}
            title={slot.filled
              ? t("filledAllySlotBadgeTitle", uiLang, slot.allyDisplayName ?? "?")
              : t("emptyAllySlotBadgeTitle", uiLang)}
          >
            <img
              src={slot.filled ? allies_slot_full : allies_slot_empty}
              alt=""
              // align-middle (non inline-block "nudo"): un'immagine
              // inline-block resta ancorata al baseline del testo, che la fa
              // apparire un po' più in basso del centro verticale reale
              // della riga (percepibile ora che .cell-name è flex
              // items-center, vedi index.css) — bug segnalato luglio 2026
              // sulle icone slot alleati (span.ml-1...cursor-help).
              // -translate-y-[1px]: rifinitura residua, l'icona restava
              // ~3-4px più in basso del centro reale della riga anche con
              // align-middle — misurato via getBoundingClientRect e
              // corretto a occhio (bug segnalato luglio 2026, seconda
              // passata).
              className="h-4 w-4 object-contain inline-block align-middle -translate-y-[1px]"
            />
          </span>
        ))}
        {(() => {
          // Icona frammenti (iconFragment, ufficiale Inno) = questo edificio
          // PRODUCE frammenti (colonna Fragments del CSV): il tooltip elenca
          // di cosa (edifici e/o kit, anche più di uno). Per i kit di
          // SELEZIONE (non gli upgrade kit: quelli producono un solo
          // edificio, già chiaro dal nome) aggiunge anche le opzioni scelte
          // dal kit — il nome del kit da solo spesso non lo chiarisce.
          if (fragmentsProduced.length === 0) return null;
          return (
            <span
              className="ml-1 inline-block flex-shrink-0 self-start cursor-help relative w-4 h-px align-top"
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setFragmentTooltip({
                  x: r.left,
                  y: r.bottom,
                  produced: fragmentsProduced.map((f) => ({
                    name: f.kind === "building"
                      ? displayName(f.id, ITALIAN_NAMES.get(f.id) ?? f.id, uiLang)
                      : kitName(f.id, uiLang),
                    options: f.kind === "kit" && KIT_RAW.selectionKits[f.id]
                      ? selectionKitOptionNames(f.id, uiLang)
                      : undefined,
                    // "(prodotti/richiesti)": entrambi opzionali — producedAmount
                    // manca solo su dati storici pre-agosto-2026 senza ":amount"
                    // nel token; requiredAmount manca per i kit/edifici non
                    // ottenibili per frammenti (es. solo acquisto/evento).
                    // Mostrato SOLO se entrambi presenti: un singolo numero
                    // isolato ("4/?" o "?/15") sarebbe più confuso che utile.
                    // Due fonti diverse per requiredAmount a seconda del kind:
                    // kit -> KIT_RAW (selectionKits/buildingUpgrades); building
                    // -> requiredFragmentsByBuilding (un edificio che assembla
                    // un altro edificio, es. W_MultiAge_FALL23F2 -> frammenti
                    // di W_MultiAge_FALL23D2, non copribile da kit.json).
                    producedAmount: f.amountPerCollection,
                    requiredAmount: f.kind === "kit"
                      ? (KIT_RAW.selectionKits[f.id]?.requiredFragments ?? KIT_RAW.buildingUpgrades[f.id]?.requiredFragments)
                      : KIT_RAW.requiredFragmentsByBuilding?.[f.id],
                  })),
                });
              }}
              onMouseLeave={() => setFragmentTooltip(null)}
            >
              {/* L'immagine è `position:absolute` DENTRO uno span-ancora
                  ALTO 1px (`h-px`, non 16px): un'immagine assolutizzata non
                  contribuisce MAI all'altezza della riga, ma lo SPAN che la
                  contiene sì se ha un'altezza propria — misurato
                  empiricamente (browser reale, getBoundingClientRect) che
                  uno span 16×16 (anche con align-top/middle sull'IMG)
                  allarga comunque la riga di 1-3px: è il BOX DELLO SPAN
                  stesso a "spingere" il line-height, non l'allineamento
                  dell'img al suo interno. Riducendo lo span a un'ancora di
                  altezza minima (1px, larghezza 16px per l'hitbox
                  orizzontale) e lasciando che sia l'img absolute a portare
                  le dimensioni/posizione reali (inset-0 + top-[3px] per lo
                  spostamento voluto), la riga torna esattamente all'altezza
                  di quando qui c'era l'emoji 🧩 — verificato: 0.00px di
                  differenza, contro 1.38px con lo span 16×16.
                  `align-top` sullo SPAN (non "middle"): con uno span 1px,
                  "middle" lo centra sull'x-height del testo spostando
                  l'intera ancora (e quindi l'img) troppo in basso
                  (verificato: icona che sporge fuori dalla cella); "top"
                  allinea l'ancora al bordo superiore della riga, dando un
                  punto di riferimento stabile da cui il `top-[3px]`
                  sull'img sposta esattamente come atteso (verificato: 7.5px
                  sopra / 1.5px sotto, contro il 4.5/4.5 simmetrico senza
                  offset — coerente col +3px voluto). */}
              <img src={iconFragment} alt="" className="absolute inset-0 top-[3px] h-4 w-4 object-contain" />
            </span>
          );
        })()}
        {(activeTab === "inventario" || b._isMergedInventory) && (() => {
          const ib = b as InventoryRowBuilding;
          const badge = ib._invBadge;
          const qty = b.kitCount ?? 1;
          const kitsUsed: string[] = ib._fabKitsUsed ?? [];
          const sourceId: string | undefined = ib._fabSourceId;
          const sourceLv: number | undefined = ib._fabSourceLv;
          const choices: string[] | undefined = ib._fabChoices ?? undefined;

          // Badge quantità: mostra solo se qty > 1
          const qtyBadge = qty > 1 ? (
            <span className="ml-1.5 inline-block flex-shrink-0 text-xs font-mono font-bold px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
              ×{qty}
            </span>
          ) : null;

          if (badge === "INV") {
            return <>{qtyBadge}</>;
          }
          if (badge === "INV_UPGRADED") {
            // Edificio da inventario upgradato con kit diretti
            const kitCountMap = new Map<string, number>();
            for (const k of kitsUsed) kitCountMap.set(k, (kitCountMap.get(k) ?? 0) + 1);
             return (
               <>{qtyBadge}
                  <span
                    className="ml-1.5 inline-block flex-shrink-0 text-[11px] font-mono font-bold px-1 rounded bg-sky-950/60 text-sky-300 border border-sky-800 cursor-help"
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setFabTooltip({ x: r.left, y: r.bottom, kitsUsed, sourceId, sourceLv, choices });
                    }}
                    onMouseLeave={() => setFabTooltip(null)}
                  >
                    INV + KIT
                  </span>
                </>
              );
            }
            if (badge === "FAB") {
              const kitCountMap = new Map<string, number>();
              for (const k of kitsUsed) kitCountMap.set(k, (kitCountMap.get(k) ?? 0) + 1);
              return (
                <>{qtyBadge}
                  <span
                    className="ml-1.5 inline-block flex-shrink-0 text-[11px] font-mono font-bold px-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/40 cursor-help"
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setFabTooltip({ x: r.left, y: r.bottom, kitsUsed, choices });
                    }}
                    onMouseLeave={() => setFabTooltip(null)}
                  >
                    KIT
                  </span>
                </>
              );
            }
            // badge undefined = edificio raw (modalità "Solo Edifici Pronti"):
            // mostra solo la quantità, senza badge colorati
            return <>{qtyBadge}</>;
         })()}
        </div>
      </td>
      {/* Colonna ⏱ (limitati / ascesi): 2.0, sempre visibile tranne nel catalogo dei GE. */}
      {!senzaLimitati && <td>
        {(() => {
          const propDisplay = getPropDisplay(b, uiLang);
          if (!propDisplay) return null;
          return (
            <span className="badge-value badge-value-purple">
              {propDisplay}
            </span>
          );
        })()}
      </td>}
      <td className="cell-icons">
        <div className="flex flex-row flex-nowrap items-center justify-center gap-0.5">
          {/* Un'icona per carattere di allyType (oggi sempre 0 o 1 carattere,
              ma l'edificio potrebbe avere più slot misti in futuro — vedi
              data/buildings.ts). "M" -> ⭐ militare, "S" -> 🔬 scienza; un
              carattere non riconosciuto (mai osservato) non produce icona. */}
          {[...b.allyType].map((kind, i) =>
            // (novembre 2026: icone del gioco al posto di ⭐/🔬)
            kind === "M" ? (
              <img key={`ally-${i}`} src={allies_military} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("historicalAllySlotTitleMilitary", uiLang)} />
            ) : kind === "S" ? (
              <img key={`ally-${i}`} src={allies_science} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("historicalAllySlotTitleScience", uiLang)} />
            ) : null
          )}
          {/* (icone dei gruppi Campi / Incursioni dell'intestazione al posto di 🔰/✊🏾) */}
          {isBattlegroundsPrizeId(b.cityEntityId) && (
            <img src={iconCampi} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("wonInGbgTitle", uiLang)} />
          )}
          {isQuantumIncursionsPrizeId(b.cityEntityId) && (
            <img src={iconIQ} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("wonInQiTitle", uiLang)} />
          )}
          {(() => {
            const info = getSettlementInfo(b.cityEntityId);
            return info ? <span title={t(info.nameKey, uiLang)}>{info.icon}</span> : null;
          })()}
          {(() => {
            // GE (Prestige): bonus non ancora gestiti nelle colonne (moltiplicativi
            // di Campi/Spedizioni, +% di produzione, boost alleati). Quelli IQ
            // e Spedizioni moltiplicativi stanno già nelle loro colonne: qui non si ripetono.
            const daMostrare = (b.gbMoltiplicativi ?? []).filter(m => !((m.modalita === "guild_raids" || m.modalita === "battleground" || m.modalita === "all" || (m.modalita === "guild_expedition" && spedizioniEnabled)) && GB_SLOT_IQ[m.tipo]));
            // boost agli alleati (Colosseo, Tempio del Loto): icona dell'alleato al posto del ×
            const alleati = daMostrare.filter(m => m.tipo === "military_ally_boost" || m.tipo === "science_ally_boost");
            const altri = daMostrare.filter(m => !alleati.includes(m));
            return (
              <>
                {alleati.map(m => (
                  <img key={m.tipo} src={m.tipo === "military_ally_boost" ? allies_military : allies_science} alt=""
                    className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbMultLine", uiLang, m.tipo, m.modalita, m.valore).replace(/^• /, "")} />
                ))}
                {altri.length > 0 && (altri.every(m => m.modalita === "guild_expedition")
                  // (solo bonus delle Spedizioni, con quelle colonne spente: icona delle Spedizioni)
                  ? <img src={iconSpedizioni} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`}
                      title={[t("gbMultTitle", uiLang), ...altri.map(m => t("gbMultLine", uiLang, m.tipo, m.modalita, m.valore))].join("\n")} />
                  : <span className="cursor-help font-black text-amber-300"
                      title={[t("gbMultTitle", uiLang), ...altri.map(m => t("gbMultLine", uiLang, m.tipo, m.modalita, m.valore))].join("\n")}>×</span>
                )}
              </>
            );
          })()}
          {b.gbReliquie && (
            // Tempio delle Reliquie: probabilità di reliquie nelle Spedizioni
            <img src={iconReliquie} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`}
              title={t("gbRelicsTitle", uiLang, b.gbReliquie.probabilita, b.gbReliquie.rara)} />
          )}
          {b.gbCritico?.rame ? (
            <img src={iconCritico} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbCritCopperTitle", uiLang, b.gbCritico.rame)} />
          ) : null}
          {b.gbCritico?.oro ? (
            <img src={iconCriticoOro} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbCritGoldTitle", uiLang, b.gbCritico.oro)} />
          ) : null}
          {b.gbSaccheggio && (
            <img src={iconSaccheggio} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbPillageTitle", uiLang, b.gbSaccheggio.probabilita)} />
          )}
          {b.gbRaccoltaDoppia?.rame && (
            <img src={iconRaccoltaDoppia} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbDoubleCollectTitle", uiLang, b.gbRaccoltaDoppia.rame.probabilita, b.gbRaccoltaDoppia.rame.edifici)} />
          )}
          {b.gbRaccoltaDoppia?.oro && (
            <img src={iconRaccoltaDoppiaOro} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbDoubleCollectGoldTitle", uiLang, b.gbRaccoltaDoppia.oro.probabilita, b.gbRaccoltaDoppia.oro.edifici)} />
          )}
          {b.gbBottino?.rame && (
            <img src={iconBottino} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbSpoilsTitle", uiLang, b.gbBottino.rame.probabilita, b.gbBottino.rame.battaglie)} />
          )}
          {b.gbBottino?.oro && (
            <img src={iconBottinoOro} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbSpoilsGoldTitle", uiLang, b.gbBottino.oro.probabilita, b.gbBottino.oro.battaglie)} />
          )}
          {b.gbColpo?.rame && (
            <img src={iconColpo} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbStrikeTitle", uiLang, b.gbColpo.rame.probabilita, b.gbColpo.rame.battaglie)} />
          )}
          {b.gbColpo?.oro && (
            <img src={iconColpoOro} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbStrikeGoldTitle", uiLang, b.gbColpo.oro.probabilita, b.gbColpo.oro.battaglie)} />
          )}
          {b.gbMissili?.rame && (
            <img src={iconMissili} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbMissileTitle", uiLang, b.gbMissili.rame.probabilita, b.gbMissili.rame.battaglie)} />
          )}
          {b.gbMissili?.oro && (
            <img src={iconMissiliOro} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbMissileGoldTitle", uiLang, b.gbMissili.oro.probabilita, b.gbMissili.oro.battaglie)} />
          )}
          {b.gbSchegge && (
            <img src={iconSchegge} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbShardsTitle", uiLang, b.gbSchegge.probabilita, b.gbSchegge.rara)} />
          )}
          {b.gbRegaliDiplomatici && (
            <img src={iconRegaliDiplomatici} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbDiploGiftsTitle", uiLang, b.gbRegaliDiplomatici.probabilita, b.gbRegaliDiplomatici.negoziazioni)} />
          )}
          {b.gbSaccheggiaBeni && (
            <img src={iconSaccheggiaBeni} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbPlunderGoodsTitle", uiLang, b.gbSaccheggiaBeni.beni, b.gbSaccheggiaBeni.volte)} />
          )}
          {b.gbBeniAiuti && (
            <img src={iconBeniAiuti} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbAidGoodsTitle", uiLang, b.gbBeniAiuti.beni, b.gbBeniAiuti.volte)} />
          )}
          {b.gbMissioni?.rame ? (
            <img src={iconMissioni} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbQuestTitle", uiLang, b.gbMissioni.rame)} />
          ) : null}
          {b.gbMissioni?.oro ? (
            <img src={iconMissioniOro} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbQuestGoldTitle", uiLang, b.gbMissioni.oro)} />
          ) : null}
          {b.gbBoostRaccolte?.monete && (
            <img src={iconMon} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbCoinBoostTitle", uiLang, b.gbBoostRaccolte.monete.percentuale, b.gbBoostRaccolte.monete.raccolte)} />
          )}
          {b.gbBoostRaccolte?.materiali && (
            <img src={iconMat} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbSupplyBoostTitle", uiLang, b.gbBoostRaccolte.materiali.percentuale, b.gbBoostRaccolte.materiali.raccolte)} />
          )}
          {b.gbNucleoIA && (
            <img src={iconNucleoIA} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbAiCoreTitle", uiLang, b.gbNucleoIA.percentuale, b.gbNucleoIA.raccolte)} />
          )}
          {b.gbProgettiAiuti ? (
            <img src={iconProgettiAiuti} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbAidBlueprintsTitle", uiLang, b.gbProgettiAiuti)} />
          ) : null}
          {b.gbContributo?.rame ? (
            <img src={iconContributo} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbContribCopperTitle", uiLang, b.gbContributo.rame)} />
          ) : null}
          {b.gbContributo?.oro ? (
            <img src={iconContributoOro} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbContribGoldTitle", uiLang, b.gbContributo.oro)} />
          ) : null}
          {b.gbManiAmiche?.rame ? (
            <img src={iconManiAmiche} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbHelpCopperTitle", uiLang, b.gbManiAmiche.rame)} />
          ) : null}
          {b.gbManiAmiche?.oro ? (
            <img src={iconManiAmicheOro} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`} title={t("gbHelpGoldTitle", uiLang, b.gbManiAmiche.oro)} />
          ) : null}
          {b.gbRespingi && (
            // Torre di Galata: respingi saccheggi
            <img src={iconRespingi} alt="" className={`inline-block ${dimIcona} cursor-help object-contain`}
              title={t("gbRepelTitle", uiLang, b.gbRespingi.probabilita, b.gbRespingi.tentativi)} />
          )}
          {b.gbAltri && b.gbAltri.length > 0 && (
            // GE del Catalogo: bonus senza colonna (meccaniche di battaglia, aiuti…)
            <span className="cursor-help font-black text-sky-300" title={[t("gbOtherTitle", uiLang), ...b.gbAltri].join("\n")}>✦</span>
          )}
          {(() => {
            // edificio di un set (2.006): i bonus in tabella sono quelli massimi
            // (icona del gioco del set, 🧩 se non ancora scaricata: icone_set.py)
            const set = setEdificio(b.cityEntityId, uiLang);
            if (!set) return null;
            const titolo = t("setBuildingTitle", uiLang, set.nome);
            return set.icona
              ? <img src={set.icona} alt={set.nome} title={titolo} className={`inline-block ${dimIcona} cursor-help object-contain`} />
              : <span className="cursor-help" title={titolo}>🧩</span>;
          })()}
        </div>
      </td>
      <td className={`cell-eff ${
        activeTab === "propria_citta" && !b._isMergedInventory && (disconnectedCount) > 0
          ? b.isGreatBuilding
            ? "bg-[#351605]"
            : "bg-[#2d0a0a]"
          // (GE: niente sfondo proprio, si vede quello della riga — .row-great,
          // schiarito sulle righe pari — invece di un #191900 fisso diverso dalla riga)
          : b.isGreatBuilding
          ? ""
          // isInactive scoped a propria_citta: stessa ragione della cella
          // nome/riga più sopra, niente evidenziazione in tab Database.
          : (b.isInactive && activeTab === "propria_citta")
          ? "bg-[#2d0a0a]"
          : ""
      }`}>
        <span className="text-amber-400 text-sm">{formatEff(b.currentEff)}</span>
      </td>
      <td className="cell-num section-divider cell-white">{b.size}</td>
      <td>
        {!b.isInactive && b.road > 0 ? (
          <span className="badge-value badge-value-red">
            {formatDecimal(b.road)}
          </span>
        ) : null}
      </td>
       {showPopColumn && (
         <StaleFieldCell value={b.pop} className="" uiLang={uiLang}>
           {b.pop !== 0 ? (
             <span className={`badge-value ${b.pop < 0 ? "badge-value-red" : "badge-value-green"}`}>
               {formatInt(b.pop)}
             </span>
           ) : null}
         </StaleFieldCell>
       )}
       {showFelColumn && (
         <StaleFieldCell value={b.fel} className="" uiLang={uiLang}>
           {b.fel !== 0 ? (
             <span className={`badge-value ${b.fel < 0 ? "badge-value-red" : "badge-value-green"}`}>
               {formatInt(b.fel)}
             </span>
           ) : null}
         </StaleFieldCell>
       )}

      {(() => {
        // GE (Prestige): moltiplicativi di Campi e Spedizioni nelle loro colonne come "+N%"
        const moltSped = [0, 0, 0, 0], moltGbg = [0, 0, 0, 0], moltGen = [0, 0, 0, 0];
        for (const m of b.gbMoltiplicativi ?? []) {
          const dest = m.modalita === "guild_expedition" ? moltSped : m.modalita === "battleground" ? moltGbg : m.modalita === "all" ? moltGen : null;
          if (dest) for (const i of GB_SLOT_IQ[m.tipo] ?? []) dest[i] += m.valore;
        }
        return <MilitaryBoostCells general={b.general} gbg={b.gbg} sped={b.sped} showSigmaColumns={showSigmaColumns} spedizioniEnabled={spedizioniEnabled} uiLang={uiLang} moltSped={moltSped} moltGbg={moltGbg} moltGen={moltGen} bonusGe={b._bonusGe} contribGe={b._contribGe} />;
      })()}


      {(() => {
        // GE (Prestige): i bonus IQ moltiplicativi del tier Oro nelle colonne IQ
        // come "+N%" in oro (come nel gioco, che li distingue con lo sfondo),
        // fuori dall'efficienza; gli altri come sempre
        const molt = [0, 0, 0, 0];
        for (const m of b.gbMoltiplicativi ?? []) {
          if (m.modalita !== "guild_raids") continue;
          for (const i of GB_SLOT_IQ[m.tipo] ?? []) molt[i] += m.valore;
        }
        return ([0, 1, 2, 3] as const).map(i => molt[i]
          ? <td key={i} className={`cell-num${i === 0 ? " section-divider" : ""}`} title={b._contribGe?.iq[i] ? `${t("gbMultIqTitle", uiLang)}\n${t("gbContribCellTitle", uiLang, molt[i]!, b._contribGe.iq[i]!)}` : t("gbMultIqTitle", uiLang)}>
              <span className="text-amber-300">+{molt[i]}%</span>
              {b._contribGe?.iq[i] ? <span className={`block text-[10px] leading-tight cell-${i < 2 ? "red" : "blue"}`}>+{formatInt(b._contribGe.iq[i]!)}</span> : null}
            </td>
          : <BoostCell key={i} value={b.iq[i]} color={i < 2 ? "red" : "blue"} className={i === 0 ? "section-divider" : ""} uiLang={uiLang} ge={b.iq[i] ? b._bonusGe?.iq[i] : 0} />);
      })()}
      {/* produzioni delle Incursioni: non nel catalogo dei GE (nessun GE le ha) */}
      {!senzaIq && <>
      {showIqProdColumns && (
        <>
          <StaleFieldCell value={b.iqMon} className="cell-num cell-white border-l border-slate-800" uiLang={uiLang}>
            {formatProdK(b.iqMon)}
          </StaleFieldCell>
          <StaleFieldCell value={b.iqMonB} uiLang={uiLang}>
            {formatProdPercent(b.iqMonB)}
          </StaleFieldCell>
          <StaleFieldCell value={b.iqMat} uiLang={uiLang}>
            {formatProdK(b.iqMat)}
          </StaleFieldCell>
          <StaleFieldCell value={b.iqMatB} uiLang={uiLang}>
            {formatProdPercent(b.iqMatB)}
          </StaleFieldCell>
        </>
      )}
      <StaleFieldCell value={b.iqBeni} className={`cell-num cell-white${showIqProdColumns ? "" : " border-l border-slate-800"}`} uiLang={uiLang}>
        {b.iqBeni === 0 ? "-" : b.iqBeni}
      </StaleFieldCell>
      <StaleFieldCell value={b.iqTruppe} uiLang={uiLang}>
        {b.iqTruppe === 0 ? "-" : b.iqTruppe}
      </StaleFieldCell>
      <StaleFieldCell value={b.iqAzioni} uiLang={uiLang}>
        {b.iqAzioni === 0 ? "-" : b.iqAzioni}
      </StaleFieldCell>
      <StaleFieldCell value={b.iqCap} uiLang={uiLang}>
        {formatProdK(b.iqCap)}
      </StaleFieldCell>
      </>}
      {showProdColumns && (
        <>
          <StaleFieldCell value={b.mon} className={`cell-num section-divider${b.mon > 0 ? classeProd("mon") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdK(b.mon)}
          </StaleFieldCell>
          <StaleFieldCell value={b.mat} className={`cell-num${b.mat > 0 ? classeProd("mat") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdK(b.mat)}
          </StaleFieldCell>
          <StaleFieldCell value={b.fp} className={`cell-num${b.fp > 0 ? classeProd("fp") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.fp)}
          </StaleFieldCell>
          <StaleFieldCell value={b.fpb} className={`cell-num${b.fpb > 0 ? classeProd("fpb") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdPercent(b.fpb)}
          </StaleFieldCell>
          <StaleFieldCell value={b.med} className={`cell-num${b.med > 0 ? classeProd("med") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdK(b.med)}
          </StaleFieldCell>
          <StaleFieldCell value={b.fur} className={`cell-num${b.fur > 0 ? classeProd("fur") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.fur)}
          </StaleFieldCell>
          <StaleFieldCell value={b.tr} className={`cell-num${b.tr > 0 ? classeProd("tr") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.tr)}
          </StaleFieldCell>
          <StaleFieldCell value={b.trne} className={`cell-num${b.trne > 0 ? classeProd("trne") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.trne)}
          </StaleFieldCell>
          <StaleFieldCell value={b.beni} className={`cell-num${b.beni > 0 ? classeProd("beni") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.beni)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benib} className={`cell-num${b.benib > 0 ? classeProd("benib") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdPercent(b.benib)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benip} className={`cell-num${b.benip > 0 ? classeProd("benip") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.benip)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benis} className={`cell-num${b.benis > 0 ? classeProd("benis") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.benis)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benisp} className={`cell-num${b.benisp > 0 ? classeProd("benisp") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.benisp)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benispb} className={`cell-num${b.benispb > 0 ? classeProd("benispb") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdPercent(b.benispb)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benig} className={`cell-num${b.benig > 0 ? classeProd("benig") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.benig)}
          </StaleFieldCell>
          {/* progetti, frammenti e kit: non nel catalogo dei GE (nessun GE li produce) */}
          {!senzaIq && <>
          <StaleFieldCell value={b.bp} className={`cell-num${b.bp > 0 ? classeProd("bp") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.bp)}
          </StaleFieldCell>
          <StaleFieldCell value={b.fsp} className={`cell-num${b.fsp > 0 ? classeProd("fsp") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.fsp)}
          </StaleFieldCell>
          <StaleFieldCell value={b.tpm} className={`cell-num${b.tpm > 0 ? classeProd("tpm") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.tpm)}
          </StaleFieldCell>
          <StaleFieldCell value={b.tpb} className={`cell-num${b.tpb > 0 ? classeProd("tpb") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.tpb)}
          </StaleFieldCell>
          <StaleFieldCell value={b.adm} className={`cell-num${b.adm > 0 ? classeProd("adm") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.adm)}
          </StaleFieldCell>
          <StaleFieldCell value={b.mod} className={`cell-num${b.mod > 0 ? classeProd("mod") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.mod)}
          </StaleFieldCell>
          <StaleFieldCell value={b.rin} className={`cell-num${b.rin > 0 ? classeProd("rin") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.rin)}
          </StaleFieldCell>
          <StaleFieldCell value={b.imm} className={`cell-num${b.imm > 0 ? classeProd("imm") : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.imm)}
          </StaleFieldCell>
          </>}
        </>
      )}
    </tr>
  );
});


/** Nome alleato colorato per rarità + badge rarità (nome + stelle): le prime
 *  due righe della cella nome sono identiche tra le due tabelle alleati
 *  (posseduti e database); cambia solo cosa segue (frammenti/posizionamento). */
function AllyRarityName({ id, rarity, lang }: { id: string; rarity: number; lang: Lang }) {
  // Descrizione dell'abilità speciale (colonne abilityIta/abilityEng del
  // CSV): vuota per la maggior parte degli alleati, quindi non renderizzata
  // affatto in quel caso (nessuno spazio/separatore residuo). La lingua di
  // visualizzazione (gameLang o uiLang a seconda del chiamante) segue lo
  // stesso criterio del nome: "it" mostra abilityIta, ogni altra lingua
  // (inclusa "en") ricade su abilityEng, coerente con l'assenza di
  // traduzioni dedicate per de/es/fr.
  const ally = ALLIES_BY_ID_RARITY.get(`${id}__${rarity}`);
  const abilityText = ally ? (lang === "it" ? ally.abilityIta : ally.abilityEng) || "" : "";
  return (
    <>
      <span className={Allies.RARITY_DISPLAY[rarity]?.textColor ?? ""}>
        {allyName(id, lang)}
      </span>
      <span className={`ml-1.5 inline-block text-[10px] font-mono font-bold px-1 py-0.5 rounded border bg-slate-950/70 text-slate-100 ${Allies.RARITY_DISPLAY[rarity]?.borderColor ?? "border-slate-400"}`}>
        {Allies.rarityName(rarity, lang)}{Allies.RARITY_DISPLAY[rarity]?.stars ?? ""}
      </span>
      {abilityText && (
        <span className="ml-2 text-xs italic text-slate-400">
          {abilityText}
        </span>
      )}
    </>
  );
}

// ── Tipi di ordinamento (a livello modulo: usati anche da compareAllies) ──
type SortKey =
  | "name" | "size" | "road" | "pop" | "fel" | "eff" | "ally_level"
  | "gen_atk_a" | "gen_def_a" | "gen_atk_d" | "gen_def_d"
  | "gbg_atk_a" | "gbg_def_a" | "gbg_atk_d" | "gbg_def_d"
  | "sped_atk_a" | "sped_def_a" | "sped_atk_d" | "sped_def_d"
  | "sig_gen_campi_atk_a" | "sig_gen_campi_def_a" | "sig_gen_campi_atk_d" | "sig_gen_campi_def_d"
  | "sig_gen_sped_atk_a" | "sig_gen_sped_def_a" | "sig_gen_sped_atk_d" | "sig_gen_sped_def_d"
  | "iq_mon_b" | "iq_mat_b" | "iq_mon" | "iq_mat" | "iq_atk_a" | "iq_def_a" | "iq_atk_d" | "iq_def_d" | "iq_beni" | "iq_truppe" | "iq_azioni" | "iq_cap"
  | "mon" | "mat" | "fp" | "fpb" | "med" | "fur" | "tr" | "trne" | "beni" | "benip" | "benis" | "benisp" | "benispb" | "benib" | "benig" | "bp" | "fsp" | "tpm" | "tpb" | "adm" | "mod" | "rin" | "imm";
type SortCriterion = { key: SortKey; order: "asc" | "desc" };
// Ambito di ordinamento indipendente: le 3 viste della tabella edifici
// (Database/Città/Inventario, distinte da TabType) più le 2 tabelle Alleati
// (posseduti e database), che condividono la stessa TabType "alleati" ma
// sono due <table> distinte nello stesso schermo — non riducibili a TabType.
type SortScope = "database" | "propria_citta" | "inventario" | "alleati_own" | "alleati_db";

// ── Comparatore alleati condiviso ─────────────────────────────────────────
// Forma minima dei dati che il sort degli alleati legge. Usata sia da
// filteredAllies sia da processedImportedAllies per evitare di duplicare il
// blocco switch di ~30 case (che altrimenti rischierebbe di divergere).
type SortableAlly = {
  id: string;
  level: number;
  currentEff: number;
  computedGeneral: number[];
  computedGbg: number[];
  computedSped: number[];
  /** Produzione diretta degli alleati "science" (vedi Ally.pf/beni/beniP in
   *  allies.ts). Riusa le SortKey "fp"/"beni"/"benip" già esistenti per gli
   *  edifici (stesso concetto, stessa colonna concettuale) invece di
   *  introdurne di nuove. */
  computedPf: number;
  computedBeni: number;
  computedBeniP: number;
};

// Restituisce il valore di ordinamento per una data chiave; null se la chiave
// non è gestita dagli alleati (il chiamante tratta null come "0", come prima).
function allySortValue(a: SortableAlly, key: SortKey, getName: (id: string) => string): number | string | null {
  switch (key) {
    case "name": return getName(a.id);
    case "ally_level": return a.level;
    case "eff": return a.currentEff;
    case "gen_atk_a": return a.computedGeneral[0];
    case "gen_def_a": return a.computedGeneral[1];
    case "gen_atk_d": return a.computedGeneral[2];
    case "gen_def_d": return a.computedGeneral[3];
    case "gbg_atk_a": return a.computedGbg[0];
    case "gbg_def_a": return a.computedGbg[1];
    case "gbg_atk_d": return a.computedGbg[2];
    case "gbg_def_d": return a.computedGbg[3];
    case "sped_atk_a": return a.computedSped[0];
    case "sped_def_a": return a.computedSped[1];
    case "sped_atk_d": return a.computedSped[2];
    case "sped_def_d": return a.computedSped[3];
    case "sig_gen_campi_atk_a": return a.computedGeneral[0] + a.computedGbg[0];
    case "sig_gen_campi_def_a": return a.computedGeneral[1] + a.computedGbg[1];
    case "sig_gen_campi_atk_d": return a.computedGeneral[2] + a.computedGbg[2];
    case "sig_gen_campi_def_d": return a.computedGeneral[3] + a.computedGbg[3];
    case "sig_gen_sped_atk_a": return a.computedGeneral[0] + a.computedSped[0];
    case "sig_gen_sped_def_a": return a.computedGeneral[1] + a.computedSped[1];
    case "sig_gen_sped_atk_d": return a.computedGeneral[2] + a.computedSped[2];
    case "sig_gen_sped_def_d": return a.computedGeneral[3] + a.computedSped[3];
    case "fp": return a.computedPf;
    case "beni": return a.computedBeni;
    case "benip": return a.computedBeniP;
    default: return null;
  }
}

// Confronta due alleati secondo i criteri di ordinamento. Ritorna un numero
// stile Array.sort (negativo/zero/positivo). Non applica criteri secondari:
// quelli restano a carico del chiamante.
function compareAllies(
  a: SortableAlly,
  b: SortableAlly,
  criteria: ReadonlyArray<{ key: SortKey; order: "asc" | "desc" }>,
  getName: (id: string) => string,
): number {
  for (const criterion of criteria) {
    const va = allySortValue(a, criterion.key, getName) ?? 0;
    const vb = allySortValue(b, criterion.key, getName) ?? 0;
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    if (cmp !== 0) return criterion.order === "desc" ? -cmp : cmp;
  }
  return 0;
}

export default function App() {
  // ── Profili ──────────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    // (2.005: "Sdrushi · L" → "L · Sdrushi", vedi nomiMondoDavanti)
    const salvate = loadProfiles(), p = nomiMondoDavanti(salvate);
    if (p !== salvate) writeStoredJson(PROFILES_KEY, p);
    return p;
  });
  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    getActiveProfileId(loadProfiles())
  );

  // ── Export/Import Sessione ──────────────────────────────────────────────
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  // (2.0: lo stato "in corso" di export/import non è più mostrato: i pulsanti
  // sono in Opzioni → Backup.)
  const [, setExportLoading] = useState(false);
  const [, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string>("");
  const [importSuccess, setImportSuccess] = useState<string>("");

  // Carica dati del profilo attivo in tutti gli stati della città
  const loadProfileData = (profileId: string) => {
    const ck = profileStorageKey(profileId, "city");
    const ik = profileStorageKey(profileId, "inventory");
    const ak = profileStorageKey(profileId, "allies");
    const city = readStoredJson<CityStore | null>(ck, null);
    const inv = readStoredJson<InventoryStore | null>(ik, null);
    const allies = readStoredJson<Allies.ImportedAlly[] | null>(ak, null);

    setCityEntityIds(reviveMap<number>(city?.cityEntityIds));
    setCityEntityDisconnected(reviveMap<number>(city?.cityEntityDisconnected));
    setIstanzeScollegate(Array.isArray(city?.istanzeScollegate) ? city.istanzeScollegate : null);
    setCityEntityNeedlessCount(reviveMap<number>(city?.cityEntityNeedlessCount));
    setCityMapBuildings(Array.isArray(city?.cityMapBuildings) ? city.cityMapBuildings : []);
    setCityMapBounds(city?.cityMapBounds ?? null);
    setCityMapGrid(reviveSet(city?.cityMapGrid));
    setCityMapUnlockedCells(reviveSet(city?.cityMapUnlockedCells));
    setCityMapUnlockedAreas(city?.cityMapUnlockedAreas ?? []);
    setGreatBuildingsJson(reviveMap<GreatBuilding>(city?.greatBuildingsJson));
    setMatchedJson(reviveMap<CityMapEntry>(city?.matchedJson));
    setUnmatchedJson(reviveMap<CityMapEntry>(city?.unmatchedJson));
    setFallbackBuildings(reviveMap<Building>(city?.fallbackBuildings));
    // CURRENT_ERA: carica l'era del municipio salvata per questo profilo
    setCurrentEra(
      typeof city?.currentEra === "string" && city.currentEra.length > 0
        ? city.currentEra
        : FALLBACK_ERA
    );
    setEraStats(reviveMap<EraStats>(city?.eraStats));
    setEntityLevels(reviveMap<number>(city?.entityLevels));
    setEntityLevelsList(reviveMap<number[]>(city?.entityLevelsList));
    setDeclassableBuildings(reviveDeclassableMap(city?.declassableBuildings));
    const rawIES = city?.entityInstanceEraStats ?? [];
    setEntityInstanceEraStats(new Map(rawIES.map(([k, v]: [string, Array<[string, number, EraStats]>]) => [k, v])));
    setGameNames(reviveMap<string>(city?.gameNames));
    setGameLang(city?.gameLang === "it" || city?.gameLang === "en" ? city.gameLang : "it");
    // sanitizePortraitUrl anche in rilettura da localStorage: un profilo può
    // essere stato importato da un file di terzi prima che il filtro esistesse.
    setPortraitUrl(sanitizePortraitUrl(city?.portraitUrl));
    setLivelloCastello(sanitizeCastleLevel(city?.castleLevel));
    setInventoryMatched(reviveMap<InventoryEntry>(inv?.inventoryMatched));
    setInventoryUnmatched(reviveMap<InventoryEntry>(inv?.inventoryUnmatched));
    setInventorySelectionKits(reviveMap<SelectionKitEntry>(inv?.inventorySelectionKits));
    setInventoryUpgradeKits(reviveMap<UpgradeKitEntry>(inv?.inventoryUpgradeKits));
    setSpecialKits(inv?.specialKits ?? { oneUpKit: 0, oneDownKit: 0, reversionKit: 0, renovationKit: 0, storeBuilding: 0, rushEventBuildings: 0, rushMassSupplies: 0, rushGoodsBuildings: 0, massSelfAidKit: 0 });
    setImportedAllies(Array.isArray(allies) ? allies : []);
    setPlayerResources(sanitizeResources(readStoredJson<unknown>(profileStorageKey(profileId, "resources"), null)));
    setSelectedIds(new Set());
    setSelectedJsonEntry(null);
    bumpStorage();
  };

  const switchProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
    loadProfileData(profileId);
  };

  /** Rinomina di una città (doppio clic sul selettore, 2.005): il nome resta
   *  anche ai reimport successivi (`nomeUtente`). */
  const rinominaCitta = (profileId: string, nome: string) => {
    const n = nome.trim();
    if (!n) return;
    const updated = profiles.map(p => (p.id === profileId ? { ...p, name: n, nomeUtente: true as const } : p));
    setProfiles(updated);
    writeStoredJson(PROFILES_KEY, updated);
  };

  /** `chiedi` false: la conferma l'ha già data il selettore della città (2.0). */
  const deleteProfile = (profileId: string, chiedi = true) => {
    const profile = profiles.find(p => p.id === profileId);
    const name = profile?.name ?? t("genericProfileFallback", uiLang);
    if (chiedi && !confirm(t("confirmDeleteProfile", uiLang, name))) {
      return;
    }
    const updated = profiles.filter(p => p.id !== profileId);
    writeStoredJson(PROFILES_KEY, updated);
    clearStoredJson(profileStorageKey(profileId, "city"));
    clearStoredJson(profileStorageKey(profileId, "inventory"));
    clearStoredJson(profileStorageKey(profileId, "allies"));
    clearStoredJson(profileStorageKey(profileId, "resources"));
    setProfiles(updated);
    if (activeProfileId === profileId) {
      if (updated.length > 0) {
        switchProfile(updated[0].id);
      } else {
        // Nessun profilo rimasto: stato vuoto
        setActiveProfileId("");
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
        loadProfileData("");
      }
    } else {
      bumpStorage();
    }
  };

  const deleteAllProfiles = () => {
    if (!confirm(t("confirmDeleteAllProfiles", uiLang))) {
      return;
    }

    Object.keys(localStorage)
      .filter((key) => key.startsWith("foe_p_"))
      .forEach((key) => localStorage.removeItem(key));

    writeStoredJson(PROFILES_KEY, []);
    localStorage.removeItem(ACTIVE_PROFILE_KEY);

    // Nessun profilo ricreato: si torna allo stato vuoto iniziale
    setProfiles([]);
    setActiveProfileId("");
    loadProfileData("");
    // 2.0: via anche la città importata da JSON nel Planner
    setPlannerJson(null);
    setPlannerErrore(null);
  };



  const [activeTab, setActiveTab] = useState<"database" | "alleati" | "propria_citta" | "inventario" | "pirati">("database");
  const buildingTableWrapperRef = useRef<HTMLDivElement | null>(null);
  const buildingTableScrollRef = useRef<HTMLDivElement | null>(null);
  const buildingTableFloatingScrollRef = useRef<HTMLDivElement | null>(null);
  // Sincronizzazione tabella ↔ barra orizzontale fissa in basso: "guida"
  // l'elemento su cui l'utente ha agito per ultimo (mouse, rotella, tocco,
  // tastiera); l'altro lo segue e i suoi eventi di scroll (solo eco) sono ignorati.
  const guidaScrollTabella = useRef<"table" | "floating" | null>(null);
  const [buildingTableScrollMetrics, setBuildingTableScrollMetrics] = useState({
    scrollWidth: 0,
    clientWidth: 0,
    left: 0,
  });
  const [isBuildingTableVisible, setIsBuildingTableVisible] = useState(false);

  // Cache delle letture iniziali da localStorage — ogni slot viene decompresso una
  // sola volta per ciascun profilo. La cache è invalidata se activeProfileId cambia:
  // questo protegge da StrictMode (doppio mount in dev) e da hot reload, dove i
  // ref sopravvivono ma lo stato React no — senza il check sull'id si tornerebbero
  // dati del profilo sbagliato.
  const _initCity = useRef<{ id: string; data: CityStore | null } | undefined>(undefined);
  const _initInv = useRef<{ id: string; data: InventoryStore | null } | undefined>(undefined);
  const _initAllies = useRef<{ id: string; data: Allies.ImportedAlly[] } | undefined>(undefined);
  const getInitCity = (): CityStore | null => {
    if (_initCity.current?.id !== activeProfileId) {
      _initCity.current = { id: activeProfileId, data: initCityStore(activeProfileId) };
    }
    return _initCity.current.data;
  };
  const getInitInv = (): InventoryStore | null => {
    if (_initInv.current?.id !== activeProfileId) {
      _initInv.current = { id: activeProfileId, data: initInventoryStore(activeProfileId) };
    }
    return _initInv.current.data;
  };
  const getInitAllies = (): Allies.ImportedAlly[] => {
    if (_initAllies.current?.id !== activeProfileId) {
      _initAllies.current = { id: activeProfileId, data: initAlliesStore(activeProfileId) };
    }
    return _initAllies.current.data;
  };

  const [cityEntityIds, setCityEntityIds] = useState<Map<string, number>>(() => reviveMap<number>(getInitCity()?.cityEntityIds));
  const [cityEntityDisconnected, setCityEntityDisconnected] = useState<Map<string, number>>(() => reviveMap<number>(getInitCity()?.cityEntityDisconnected));
  // Istanze scollegate (chiave mappa, entityId, era); null = profilo importato prima del 09/11/2026
  const [istanzeScollegate, setIstanzeScollegate] = useState<Array<[string, string, number]> | null>(() => {
    const v = getInitCity()?.istanzeScollegate;
    return Array.isArray(v) ? v : null;
  });
  const [cityEntityNeedlessCount, setCityEntityNeedlessCount] = useState<Map<string, number>>(() => reviveMap<number>(getInitCity()?.cityEntityNeedlessCount));

  const [cityMapBuildings, setCityMapBuildings] = useState<CityMapBuilding[]>(() => { const s = getInitCity(); return Array.isArray(s?.cityMapBuildings) ? s.cityMapBuildings : []; });
  const [cityMapBounds, setCityMapBounds] = useState<CityMapBounds | null>(() => getInitCity()?.cityMapBounds ?? null);
  const [cityMapGrid, setCityMapGrid] = useState<Set<string>>(() => reviveSet(getInitCity()?.cityMapGrid));
  const [cityMapUnlockedCells, setCityMapUnlockedCells] = useState<Set<string>>(() => reviveSet(getInitCity()?.cityMapUnlockedCells));
  // Aree sbloccate ORIGINALI (rettangoli grezzi, non le celle già espanse):
  // solo per l'export JSON della mappa (CityMapView) — vedi commento su
  // CityStore.cityMapUnlockedAreas per il perché di questo campo separato.
  const [cityMapUnlockedAreas, setCityMapUnlockedAreas] = useState<UnlockedArea[]>(() => getInitCity()?.cityMapUnlockedAreas ?? []);
  const [showCityMap, setShowCityMap] = useState<boolean>(() => localStorage.getItem(SHOW_CITY_MAP_KEY) === "true");
  // Planner città (sempre disponibile dal 19 ottobre 2026): non persistente.
  const [showPlanner, setShowPlanner] = useState(false);
  // 2.0: sorgente del Planner (scheda Planner, gruppo Sorgente del nastro):
  // la città selezionata o una città da file JSON (temporanea, non salvata).
  const [plannerSorgente, setPlannerSorgente] = useState<"citta" | "json">("citta");
  const [plannerJson, setPlannerJson] = useState<{ citta: CittaEsterna; n: number } | null>(null);
  const [plannerErrore, setPlannerErrore] = useState<string | null>(null);
  const plannerFileRef = useRef<HTMLInputElement>(null);
  /** 2.0: file JSON da importare come città "ridotta" (Opzioni › Città salvate). */
  const cittaJsonRef = useRef<HTMLInputElement>(null);
  // Gruppi del nastro consegnati dal Planner (Ricerca, Disposizione, …).
  const [gruppiPlanner, setGruppiPlanner] = useState<RibbonGroup[]>([]);
  // Gruppi del nastro consegnati dallo strumento Pirati (Calcolo, Espansioni).
  const [gruppiPirati, setGruppiPirati] = useState<RibbonGroup[]>([]);
  // (2.0: il Planner resta aperto anche senza città: usa la sorgente JSON.)
  // (08/11/2026: la casella "Edifici vecchi" della Città è sostituita dai filtri
  // Era e Beni dell'era, come nell'Inventario: eraCitta / beniEraCitta)
  // Filtra gli edifici declassabili all'Era del Bronzo nella tab Città
  const [showOnlyDeclassable, setShowOnlyDeclassable] = useState(false);
  // Database › Invecchiabili: colonna Invecchiabile di buildings.csv (pipeline)
  const [soloInvecchiabiliDb, setSoloInvecchiabiliDb] = useState(false);
  // Merge Città+Inventario: quando attivo, la tabella Città mostra anche le
  // righe dell'ottimizzatore inventario (stesso identico set che si vede in
  // tab Inventario), marcate con ProcessedBuilding._isMergedInventory per
  // colore riga diverso e per disattivare azioni/filtri Città-specifici su
  // di esse (vedi filterSourceBuildings/handleCityRowClick più sotto). Non
  // persistito, stesso pattern di showOnlyDeclassable.
  const [showInventoryInCity, setShowInventoryInCity] = useState(false);
  // 2.0: "solo con slot alleato" e "solo che producono frammenti" sono ora le
  // caselle di categoria "alleati"/"frammenti" (TabFilters.categorie).
  // Filtra nella tab Inventario: mostra solo gli edifici fisicamente già in inventario
  // (10/11/2026) "Solo pronti" è ora la voce "Pronti" di Nascondi / Mostra solo dell'Inventario
  // (a tre stati, più sotto, dopo tabFilters): mostra solo = sorgente "raw" come prima,
  // nascondi = vista con i kit senza le righe INV (già in inventario, pronte da piazzare).
  // Inventario › Invecchiabili (al posto di "Solo pronti" nei Filtri)
  const [soloInvecchiabiliInv, setSoloInvecchiabiliInv] = useState(false);
  // Inventario: solo gli edifici posseduti di un'era (id di ages.csv; null = tutte)
  const [eraInventario, setEraInventario] = useState<number | null>(null);
  // Inventario: edifici posseduti che producono beni di un'era (della loro era,
  // dell'era precedente se sono un'era sopra, della successiva se sono un'era sotto)
  const [beniEraInventario, setBeniEraInventario] = useState<number | null>(null);
  // Città: gli stessi due filtri, sulle copie piazzate in città (era di ogni copia)
  const [eraCitta, setEraCitta] = useState<number | null>(null);
  const [beniEraCitta, setBeniEraCitta] = useState<number | null>(null);
  const [cityMapCellSize, setCityMapCellSize] = useState(9);
  const [cityMapView, setCityMapView] = useState<"vertical" | "isometric">("isometric");
  const [cityMapPan, setCityMapPan] = useState({ x: 0, y: 0 });
  const [cityMapDragStart, setCityMapDragStart] = useState<CityMapDragState | null>(null);

  type DebugJsonEntry = {
    title: string;
    rawEntry: unknown;
  };
  const [greatBuildingsJson, setGreatBuildingsJson] = useState<Map<string, GreatBuilding>>(() => reviveMap<GreatBuilding>(getInitCity()?.greatBuildingsJson));
  const [matchedJson, setMatchedJson] = useState<Map<string, CityMapEntry>>(() => reviveMap<CityMapEntry>(getInitCity()?.matchedJson));
  const [unmatchedJson, setUnmatchedJson] = useState<Map<string, CityMapEntry>>(() => reviveMap<CityMapEntry>(getInitCity()?.unmatchedJson));
  const [fallbackBuildings, setFallbackBuildings] = useState<Map<string, Building>>(() => reviveMap<Building>(getInitCity()?.fallbackBuildings));
  // CURRENT_ERA: l'era vera del municipio della città importata, specifica per profilo.
  // Cambia quando importi una città di era diversa; persiste in localStorage.
  const [currentEra, setCurrentEra] = useState<string>(() => {
    const stored = getInitCity()?.currentEra;
    return (typeof stored === "string" && stored.length > 0) ? stored : FALLBACK_ERA;
  });
  // ERA STATS: statistiche reali (att/dif, IQ) per era corrente, estratte da
  // CityEntities all'import. Chiave: cityEntityId normalizzato. Usate dalle tab
  // Città e Inventario per sovrascrivere i valori del CSV (basato su era massima).
  const [eraStats, setEraStats] = useState<Map<string, EraStats>>(() => reviveMap<EraStats>(getInitCity()?.eraStats));
  // entityLevels: mappa entityId NORMALIZZATO → livello minimo presente in città.
  // "level" corrisponde all'era dell'edificio (0=StoneAge … 22=SpaceAgeSpaceHub).
  const [entityLevels, setEntityLevels] = useState<Map<string, number>>(() => reviveMap<number>(getInitCity()?.entityLevels));
  const [entityLevelsList, setEntityLevelsList] = useState<Map<string, number[]>>(() => reviveMap<number[]>(getInitCity()?.entityLevelsList));
  const [declassableBuildings, setDeclassableBuildings] = useState<Map<string, { popCurr: number; popBronze: number; statsBronze: EraStats }>>(
    () => reviveDeclassableMap(getInitCity()?.declassableBuildings)
  );
  const [entityInstanceEraStats, setEntityInstanceEraStats] = useState<Map<string, Array<[string, number, EraStats]>>>(() => {
    const raw = getInitCity()?.entityInstanceEraStats ?? [];
    return new Map(raw.map(([k, v]: [string, Array<[string, number, EraStats]>]) => [k, v]));
  });
  // gameNames: nomi originali dal gioco (CityEntities.name) salvati durante l'import.
  // Chiave: entityId normalizzato. Usati nelle tab Città e Inventario.
  const [gameNames, setGameNames] = useState<Map<string, string>>(() => reviveMap<string>(getInitCity()?.gameNames));
  const [gameLang, setGameLang] = useState<Lang>(() => {
    const s = getInitCity()?.gameLang;
    return s === "it" || s === "en" ? s : "it";
  });
  const [portraitUrl, setPortraitUrl] = useState<string>(() => sanitizePortraitUrl(getInitCity()?.portraitUrl));
  // Livello del Castello (bacchetta v8); null = non importato
  const [livelloCastello, setLivelloCastello] = useState<number | null>(() => sanitizeCastleLevel(getInitCity()?.castleLevel));
  // Livelli del Castello (castello.json), scaricati solo se il livello è noto
  const [livelliCastello, setLivelliCastello] = useState<LivelloCastello[] | null>(null);
  useEffect(() => {
    if (livelloCastello === null || livelliCastello) return;
    let vivo = true;
    void caricaCastello().then(l => { if (vivo) setLivelliCastello(l); });
    return () => { vivo = false; };
  }, [livelloCastello, livelliCastello]);
  const [selectedJsonEntry, setSelectedJsonEntry] = useState<DebugJsonEntry | null>(null);
  const [upgradeTooltip, setUpgradeTooltip] = useState<{ x: number; y: number; targets: string[]; kits: Array<{ name: string; count: number }> } | null>(null);
  // Popup anteprima immagine edificio: posizione + url + nome (alt/titolo).
  // Attivato dall'hover su 👁️ in tabella e dall'hover sugli edifici in
  // mappa città; scompare all'uscita del mouse in entrambi i casi.
  const [imagePopup, setImagePopupRaw] = useState<ImagePopupState | null>(null);
  // Timer di chiusura ritardata del popup immagine: permette al mouse di
  // attraversare lo spazio tra il trigger (👁️/edificio mappa/🏠) e il
  // pannello senza chiuderlo, e di restare sul pannello per copiare
  // nome/ID. Il pannello stesso cancella il timer on-enter e lo richiude
  // on-leave; vedi invocazioni di scheduleImagePopupClose/cancelImagePopupClose.
  const imagePopupCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelImagePopupClose = useCallback(() => {
    if (imagePopupCloseTimer.current !== null) {
      clearTimeout(imagePopupCloseTimer.current);
      imagePopupCloseTimer.current = null;
    }
  }, []);
  // Wrapper che cancella sempre un'eventuale chiusura pendente quando si
  // apre/aggiorna un popup con un valore non-null. Necessario perché
  // passando velocemente da un trigger 👁️/🏠 all'altro, il mouseEnter del
  // nuovo trigger può scattare prima che il timer di chiusura schedulato
  // dal vecchio trigger scada: senza questa cancellazione, quel timer
  // "vecchio" chiuderebbe comunque (dopo, in ritardo) il popup appena
  // aperto per il nuovo trigger, anche se il mouse ci sta sopra.
  const setImagePopup = useCallback((v: ImagePopupState | null | ((prev: typeof imagePopup) => typeof imagePopup)) => {
    if (typeof v === "function") {
      setImagePopupRaw(prev => {
        const next = v(prev);
        if (next !== null) cancelImagePopupClose();
        return next;
      });
      return;
    }
    if (v !== null) cancelImagePopupClose();
    setImagePopupRaw(v);
  }, [cancelImagePopupClose]);
  const scheduleImagePopupClose = useCallback(() => {
    cancelImagePopupClose();
    imagePopupCloseTimer.current = setTimeout(() => {
      setImagePopupRaw(null);
      imagePopupCloseTimer.current = null;
    }, 150);
  }, [cancelImagePopupClose]);
  const [outdatedTooltip, setOutdatedTooltip] = useState<{ x: number; y: number; minLevel: number; allLevels: number[]; currentEraId: number; oneUpKit: number; renovationKit: number; oneUpKitName?: string; renovationKitName?: string; isUpgradable: boolean; upgradableTargets: string[]; upgradableKits: Array<{ name: string; count: number }>; eraComparisons: Array<{ eraId: number; eraName: string; count: number; diffs: EraDiffEntry[]; goodsInvolved: boolean }> } | null>(null);
  const [declassableTooltip, setDeclassableTooltip] = useState<{ x: number; y: number; eraAge: string; diffs: EraDiffEntry[]; popSavings: number; oneDownKit: number; oneDownKitName?: string; reversionKit: number; reversionKitName?: string } | null>(null);
  const [fragmentTooltip, setFragmentTooltip] = useState<{ x: number; y: number; produced: Array<{ name: string; options?: string[]; producedAmount?: number; requiredAmount?: number }> } | null>(null);
  const [kitProducersTooltip, setKitProducersTooltip] = useState<{ x: number; y: number; producers: Array<{ id: string; name: string }> } | null>(null);
  const [fabTooltip, setFabTooltip] = useState<{ x: number; y: number; kitsUsed: string[]; sourceId?: string; sourceLv?: number; choices?: string[] } | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isInventoryDebugOpen, setIsInventoryDebugOpen] = useState(false);
  const [isEfficiencyHelpOpen, setIsEfficiencyHelpOpen] = useState(false);
  // 2.0: pannelli della scheda Guida (aperti dal nastro, come Statistiche e Debug)
  const [pannelloGuida, setPannelloGuida] = useState<"info" | "importa" | "planner" | "novita" | null>(null);
  // 2.0: scheda Opzioni/Guida aperta (solo nastro), tema chiaro/scuro
  const [schedaExtra, setSchedaExtra] = useState<"opzioni" | "guida" | null>(null);
  // 2.0: catalogo scelto nel Database. Il catalogo Alleati usa la vista
  // alleati di sempre (activeTab "alleati") in modalità database
  // (alleatiDaDb): niente pannello consigliere né tabella dei posseduti.
  const [catalogo, setCatalogoStato] = useState<"edifici" | "alleati" | "ge">("edifici");
  // Catalogo › Grandi Edifici: livello del selettore e dati (ge.json, scaricato
  // la prima volta che si apre il catalogo)
  const [livelloGe, setLivelloGe] = useState<number>(201);
  // GE di cui è aperto il report (null = chiuso): pulsante 📊 accanto al nome, in tutte le tabelle
  const [reportGe, setReportGe] = useState<string | null>(null);
  /** Filtro per tier massimo: tutti, solo Rame, con anche l'Oro. */
  const [tierGe, setTierGe] = useState<"tutti" | "copper" | "gold">("tutti");
  const [datiGe, setDatiGe] = useState<DatiGe | null>(null);
  useEffect(() => {
    // (anche per il report di un GE aperto da Città / Inventario / Database)
    if ((catalogo !== "ge" && !reportGe) || datiGe) return;
    let vivo = true;
    void caricaGe().then(d => { if (vivo) setDatiGe(leggiGe(d)); });
    return () => { vivo = false; };
  }, [catalogo, datiGe, reportGe]);
  const [alleatiDaDb, setAlleatiDaDb] = useState(false);
  // Tipi di alleato mostrati (colonna Tipo di allies.csv; "" = come militare).
  const [mostraMilitari, setMostraMilitari] = useState(true);
  const [mostraScienza, setMostraScienza] = useState(true);
  // Pannello "Potenziale e gettoni" (AllyAdvisorPanel) nella scheda Alleati:
  // spento di default, lo accende il pulsante del nastro (Analisi).
  const [mostraConsigliere, setMostraConsigliere] = useState(false);
  /** Pannello "Potenziale alleati e Pergamene Eroiche" (per ora segnaposto). */
  const [mostraPergamene, setMostraPergamene] = useState(false);
  /** Avviso dopo l'import ("Aggiornata …", "Aggiunta …"), mostrato dalla testata. */
  const [avvisoCitta, setAvvisoCitta] = useState<string | null>(null);
  const [tema, setTema] = useTema();
  const [isProdSummaryOpen, setIsProdSummaryOpen] = useState(false);
  // Pannello Produzione: righe aperte nel dettaglio per edificio (clic sulla riga,
  // anche più di una: "fr-<frammento>", "fp", "benig", "benisp", "era-<id>")
  const [righeProdAperte, setRigheProdAperte] = useState<ReadonlySet<string>>(() => new Set());
  const [isRoadSummaryOpen, setIsRoadSummaryOpen] = useState(false);
  // 2.0: seconda metà del vecchio PROD + STAT (valori militari), pannello a sé.
  const [isMilSummaryOpen, setIsMilSummaryOpen] = useState(false);
  const [isOutdatedSummaryOpen, setIsOutdatedSummaryOpen] = useState(false);
  const [isCityUpgradeableOpen, setIsCityUpgradeableOpen] = useState(false);
  const [isOutdatedModalOpen, setIsOutdatedModalOpen] = useState(false);
  const [isBookmarkletOutdatedModalOpen, setIsBookmarkletOutdatedModalOpen] = useState(false);

  // Esc (e, dove c'era già, click sullo sfondo) per i modali dichiarati inline
  // qui in App: vedi useModalDismiss — il click sullo sfondo non chiude più il
  // modale durante una selezione di testo. Non per i due avvisi a z-200
  // (storage obsoleto, bacchetta obsoleta): richiedono il loro pulsante.
  const closeImportModal = useCallback(() => setIsImportModalOpen(false), []);
  const closeJsonEntry = useCallback(() => setSelectedJsonEntry(null), []);
  const importModalBackdrop = useModalDismiss(isImportModalOpen, closeImportModal);
  // Solo Esc: questo modale non si chiudeva col click sullo sfondo e resta così.
  useModalDismiss(selectedJsonEntry !== null, closeJsonEntry);

  const [storageVersion, setStorageVersion] = useState(0);
  const bumpStorage = () => setStorageVersion(v => v + 1);

  const [inventoryMatched, setInventoryMatched] = useState<Map<string, InventoryEntry>>(() => reviveMap<InventoryEntry>(getInitInv()?.inventoryMatched));
  const [inventoryUnmatched, setInventoryUnmatched] = useState<Map<string, InventoryEntry>>(() => reviveMap<InventoryEntry>(getInitInv()?.inventoryUnmatched));
  const [inventorySelectionKits, setInventorySelectionKits] = useState<Map<string, SelectionKitEntry>>(() => reviveMap<SelectionKitEntry>(getInitInv()?.inventorySelectionKits));
  const [inventoryUpgradeKits, setInventoryUpgradeKits] = useState<Map<string, UpgradeKitEntry>>(() => reviveMap<UpgradeKitEntry>(getInitInv()?.inventoryUpgradeKits));
  const [specialKits, setSpecialKits] = useState<SpecialKits>(() => {
    const s = getInitInv()?.specialKits;
    return s ?? { oneUpKit: 0, oneDownKit: 0, reversionKit: 0, renovationKit: 0, storeBuilding: 0, rushEventBuildings: 0, rushMassSupplies: 0, rushGoodsBuildings: 0, massSelfAidKit: 0 };
  });

  const importedCityEntityLookup = useMemo(() => {
    const map = new Map<string, number>();
    cityEntityIds.forEach((count, id) => {
      map.set(id, count);
    });
    return map;
  }, [cityEntityIds]);

  // csvCityEntityIds was a useMemo but buildings === BUILDINGS_FROM_CSV (stable module constant)
  // so CSV_ENTITY_IDS and CSV_ENTITY_IDS_SET are pre-computed at module level instead.

  const matchedCityEntityIds = useMemo(() => {
    return Array.from(cityEntityIds.keys()).filter((id) =>
      CSV_ENTITY_IDS_SET.has(id) && !isGreatBuildingId(id)
    );
  }, [cityEntityIds]);

  // 2.0: id di buildings_extra.csv (militari, fabbriche di beni, premi come la
  // Tana dei furfanti…): edifici che il tool conosce anche se non sono nel
  // catalogo. Scaricati solo quando si apre il Debug.
  const [idsExtra, setIdsExtra] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!isDebugOpen || idsExtra) return;
    let vivo = true;
    void caricaBuildingsExtra().then(testo => {
      if (!vivo) return;
      const ids = new Set<string>();
      for (const riga of testo.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
        const id = riga.slice(0, riga.indexOf(";")).trim();
        if (id) ids.add(id);
      }
      setIdsExtra(ids);
    });
    return () => { vivo = false; };
  }, [isDebugOpen, idsExtra]);

  const unmatchedAll = useMemo(() => {
    return Array.from(cityEntityIds.keys()).filter((id) =>
      !CSV_ENTITY_IDS_SET.has(id) &&
      !isGreatBuildingId(id)
    );
  }, [cityEntityIds]);
  /** Fuori catalogo ma riconosciuti (in buildings_extra.csv). */
  const extraCityEntityIds = useMemo(() => (idsExtra ? unmatchedAll.filter(id => idsExtra.has(id)) : []), [unmatchedAll, idsExtra]);
  /** Davvero sconosciuti: né nel catalogo né in buildings_extra.csv. */
  const unmatchedCityEntityIds = useMemo(() => (idsExtra ? unmatchedAll.filter(id => !idsExtra.has(id)) : unmatchedAll), [unmatchedAll, idsExtra]);

  const greatBuildingIds = useMemo(() => {
    return Array.from(greatBuildingsJson.keys());
  }, [greatBuildingsJson]);

  // ── Funzioni Export/Import Sessione (file locale) ────────────────────────
  const handleExportSession = () => {
    setExportLoading(true);
    try {
      const storage = collectFoeLocalStorage();
      const sessionData = {
        app: "foe-optimizer",
        version: "1.1",
        exportedAt: new Date().toISOString(),
        profileId: activeProfileId,
        storage,
      };
      const jsonString = JSON.stringify(sessionData, null, 0);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = localDateStamp();
      a.href = url;
      a.download = `foe-optimizer-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(t("exportErrorAlert", uiLang, errMessage(err, t("unknownErrorFallback", uiLang))));
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportSession = (file: File) => {
    setImportLoading(true);
    setImportError("");
    setImportSuccess("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const sessionData = JSON.parse(text);
        if (!sessionData.app || sessionData.app !== "foe-optimizer") {
          throw new Error(t("importInvalidFile", uiLang));
        }
        if (!sessionData.storage || typeof sessionData.storage !== "object") {
          throw new Error(t("importInvalidFile", uiLang));
        }

        const { ok, failedKeys, mergedProfiles } = mergeImportedProfiles(
          sessionData.storage,
          (n) => t("defaultProfileName", uiLang, n),
        );
        const restoredActiveId = getActiveProfileId(mergedProfiles);
        setProfiles(mergedProfiles);
        setActiveProfileId(restoredActiveId);
        loadProfileData(restoredActiveId);

        if (!ok) {
          const heavyKeys = failedKeys.filter((k) => k.includes("map") || k.includes("inv"));
          const msg = heavyKeys.length > 0
            ? t("importPartialHeavy", uiLang)
            : t("importPartialKeys", uiLang, failedKeys.length);
          setImportError(msg);
        } else {
          setImportSuccess(t("importSuccessMessage", uiLang));
          setTimeout(() => setIsImportModalOpen(false), 1000);
        }
      } catch (err: unknown) {
        const rawMessage = errMessage(err, t("importGenericError", uiLang));
        setImportError(rawMessage === "INVALID_IMPORT_FILE" ? t("importInvalidFile", uiLang) : rawMessage);
      } finally {
        setImportLoading(false);
      }
    };
    reader.onerror = () => {
      setImportError(t("importReadFileError", uiLang));
      setImportLoading(false);
    };
    reader.readAsText(file);
  };
  


  const handleImportCityMap = async (preloadedData: BookmarkletData, targetProfileId?: string) => {
    const pid = targetProfileId ?? activeProfileId;
    const cityKey = profileStorageKey(pid, "city");
    if (!preloadedData) return;
    
    try {
      const cityMap: Record<string, CityMapEntry> = preloadedData.CityMapData;
      if (!cityMap || typeof cityMap !== "object") {
        return;
      }

      // Estrae CURRENT_ERA (l'era vera del municipio). Il municipio esiste sempre
      // nel gioco (id=1), quindi era sarà una stringa valida.
      const currentEra = BuildingModel.extractPlayerEraFromCityMap(cityMap);

      // ── Rilevamento lingua del gioco ────────────────────────────────────────
      // (dichiarazione qui, valore calcolato dopo cityEntities)
      let gameLang: "it" | "en" = "it";

      const ALLOWED_PREFIXES = new Set(["A_", "D_", "G_", "L_", "M_", "P_", "R_", "T_", "W_", "X_", "Z_"]);
      
      const ids = new Map<string, number>();
      const gbs = new Map<string, GreatBuilding>();
      const matched = new Map<string, CityMapEntry>();
      const unmatched = new Map<string, CityMapEntry>();
      const disconnected = new Map<string, number>();
      const istanzeScollegateImp: Array<[string, string, number]> = [];
      const needlessRoadKeys = new Set<string>();
      const needlessCountByEntity = new Map<string, number>();

      // preloadedData è già validato da validateBookmarkletData(): il cast è sicuro.
      const cityEntities: Record<string, CityEntityDefinition> = preloadedData.CityEntities;

      // Rilevamento lingua del gioco: guarda il nome del municipio in CityEntities.
      const townhallEntityId = currentEra ? `H_${currentEra}_Townhall` : null;
      const townhallCityEntity = townhallEntityId ? cityEntities[townhallEntityId] : undefined;
      if (townhallCityEntity?.name) {
        const thName = String(townhallCityEntity.name).toLowerCase();
        if (thName.includes("municipio")) {
          gameLang = "it";
        } else {
          gameLang = "en";
        }
      }

      // Set (non array) per lookup O(1) nel loop sotto: con .includes() su array
      // questo diventerebbe O(N·m) sul numero di edifici della città.
      const suppliesProducerIds = new Set(
        [...new Set(Object.values(cityMap).map((b: CityMapEntry) => b?.cityentity_id).filter(Boolean))]
          .filter(eid => cityEntities[eid as string]?.type === "production")
      );
      const getEntitySize = (entityId: string): [number, number] => {
        const entity = cityEntities?.[entityId] ?? {};
        const width = entity?.width ?? entity?.components?.AllAge?.placement?.size?.x ?? 1;
        const length = entity?.length ?? entity?.components?.AllAge?.placement?.size?.y ?? 1;
        return [Number(width) || 1, Number(length) || 1];
      };

      const grid = new Map<string, string>();
      for (const key in cityMap) {
        const entry = cityMap[key];
        if (!entry || typeof entry !== "object") continue;
        // Il gioco omette le coordinate uguali a 0: x/y assenti = 0, non "senza posizione".
        const ex = Number(entry.x ?? 0);
        const ey = Number(entry.y ?? 0);
        const entityId = entry.cityentity_id ? String(entry.cityentity_id) : null;
        if (!entityId) continue;
        const [w, l] = getEntitySize(entityId);
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < l; dy++) {
            grid.set(`${ex + dx},${ey + dy}`, String(entry.type ?? ""));
          }
        }
      }

      for (const key in cityMap) {
        const entry = cityMap[key];
        if (!entry || typeof entry !== "object") continue;
        const ex = Number(entry.x ?? 0); // x/y assenti = 0 (vedi sopra)
        const ey = Number(entry.y ?? 0);
        const entityId = entry.cityentity_id ? String(entry.cityentity_id) : null;
        if (!entityId) continue;
        const entity = cityEntities?.[entityId] ?? {};
        // Skip edifici che richiedono strada: il check "needless road" vale solo per quelli che NON la richiedono.
        // (2.0: anche le CityEntities ridotte delle città da JSON, con width ma senza components)
        if ((!entity?.components && entity?.width == null) || BuildingModel.requiresRoad(entity)) continue;
        const [w, l] = getEntitySize(entityId);
        let touchesStreet = false;
        for (let dx = 0; dx < w && !touchesStreet; dx++) {
          for (let dy = 0; dy < l && !touchesStreet; dy++) {
            const x = ex + dx;
            const y = ey + dy;
            const neighbors: Array<[number, number]> = [[-1,0],[1,0],[0,-1],[0,1]];
            for (const [ox, oy] of neighbors) {
              if (grid.get(`${x + ox},${y + oy}`) === "street") {
                touchesStreet = true;
                break;
              }
            }
          }
        }
        if (touchesStreet) {
          needlessRoadKeys.add(key);
          needlessCountByEntity.set(entityId, (needlessCountByEntity.get(entityId) ?? 0) + 1);
        }
      }

      // entityLevels: per ogni entityId, il livello minimo trovato in città.
      // entityLevelsList: lista completa di tutti i livelli per ogni entityId
      // (una entry per ogni istanza), usata nel tooltip per mostrare la
      // distribuzione delle copie obsolete invece del solo valore minimo.
      const entityLevels = new Map<string, number>();
      const entityLevelsList = new Map<string, number[]>();

      for (const key in cityMap) {
        const entry = cityMap[key];
        if (!entry || typeof entry !== "object") continue;

        const id = entry.cityentity_id ? String(entry.cityentity_id) : null;
        if (!id) continue;

        const prefix = id.substring(0, 2);
        if (!ALLOWED_PREFIXES.has(prefix)) continue;

        ids.set(id, (ids.get(id) ?? 0) + 1);

        // Traccia il livello minimo di ogni entityId (ignora GE, decorazioni, militari).
        // Chiave: id grezzo, coerente con b.cityEntityId dal CSV (stessa fonte MainParser).
        if (!isGreatBuildingId(id) && !isInactiveBuildingId(id) && !isMilitaryBuildingId(id)) {
          const lvl = typeof entry.level === "number" ? entry.level : -1;
          if (lvl >= 0) {
            const prev = entityLevels.get(id);
            if (prev === undefined || lvl < prev) entityLevels.set(id, lvl);
            // Accumula tutti i livelli per il tooltip dettagliato
            const list = entityLevelsList.get(id);
            if (list) list.push(lvl);
            else entityLevelsList.set(id, [lvl]);
          }
        }

        const connectedLevel = Number(entry.connected ?? 0);
        const isMissingFromCsv = !CSV_ENTITY_IDS_SET.has(id);

        if (!isMissingFromCsv && !matched.has(id)) {
          matched.set(id, entry);
        }

        // L'edificio richiede un LIVELLO di strada (0 = nessuna, 1 = una
        // corsia, 2 = due corsie — vedi BuildingModel.requiredRoadLevel).
        // È scollegato non solo se connectedLevel è 0, ma anche se è
        // collegato a una corsia MA ne richiede due: nel gioco un edificio
        // che richiede 2 corsie non è considerato connesso se la strada
        // adiacente è a 1 corsia sola (bug corretto luglio 2026 — prima si
        // trattava "connesso a qualunque livello" come sempre sufficiente,
        // ignorando il caso raro ma reale del livello 2). Viceversa un
        // edificio che richiede 1 corsia ed è collegato a una strada a 2
        // corsie resta correttamente connesso (connectedLevel 2 >= 1).
        const cityEntityForId = cityEntities?.[id];
        const requiredRoadLevel = BuildingModel.requiredRoadLevel(cityEntityForId);

        if (requiredRoadLevel > 0 && connectedLevel < requiredRoadLevel) {
          disconnected.set(id, (disconnected.get(id) ?? 0) + 1);
          istanzeScollegateImp.push([key, id, typeof entry.level === "number" ? entry.level : -1]);
        }

        // I GE sono riconosciuti dal solo prefisso "X_" (stessa regola di
        // buildings.ts), non più dall'assenza dal CSV: ora che buildings.csv
        // include anche i GE con i loro hash immagine, isMissingFromCsv per
        // un GE può essere false, ma resta comunque un Grande Edificio.
        const isGe = isGreatBuildingId(id);
        if (isGe && !gbs.has(id)) {
          const level = entry.level ?? 0;
          const maxLevel = entry.max_level ?? 0;
          const [w, l] = getEntitySize(id);
          const tierMax = (cityEntities[id] as { maxTier?: { value?: unknown } } | undefined)?.maxTier?.value;
          gbs.set(id, { entityId: id, name: "", level, maxLevel, width: w, length: l, rawEntry: entry, ...(typeof tierMax === "string" ? { tierMax } : {}) });
        } else if (isMissingFromCsv && !unmatched.has(id)) {
          // Edificio non presente nel CSV ma presente in città: lo salvo per creare un fallback
          unmatched.set(id, entry);
        }
      }

      // Costruisci dati per la mappa visuale della città
      const mapBuildings: CityMapBuilding[] = [];
      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      const occupiedCells = new Set<string>();

      for (const key in cityMap) {
        const entry = cityMap[key];
        if (!entry || typeof entry !== "object") continue;
        const entityId = entry.cityentity_id ? String(entry.cityentity_id) : "";
        const entryType = String(entry.type ?? "");
        const prefix = entityId.substring(0, 2);
        
        if (!ALLOWED_PREFIXES.has(prefix) && entryType !== "street" && entryType !== "main_building" && prefix !== "H_" && prefix !== "S_") continue;

        const [w, l] = getEntitySize(entityId);
        const x = Number(entry.x ?? 0);
        const y = Number(entry.y ?? 0);
        const entity = cityEntities?.[entityId] ?? {};
        const entityName = entity?.name ?? displayName(entityId, ITALIAN_NAMES.get(entityId) ?? entityId, gameLang);
        const isGE = isGreatBuildingId(entityId);
        const isMilitary = isMilitaryBuildingId(entityId);
        const isNeedless = needlessRoadKeys.has(key);
        const isInactiveBuilding = isInactiveBuildingId(entityId);
        const isSuppliesProducer = suppliesProducerIds.has(entityId);
        // roadLevel: solo per edifici "veri" (entityId presente in CityEntities).
        // Le strade stesse (type "street") e il municipio (prefisso "H_", che
        // non ha una entry propria in requiredRoadLevel) non hanno un livello
        // di RICHIESTA di strada — restano a 0, coerente col fatto che l'export
        // JSON tratta le strade in una sezione a parte (vedi CityMapView).
        const roadLevel = BuildingModel.requiredRoadLevel(entity);
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < l; dy++) {
            occupiedCells.add(`${x + dx},${y + dy}`);
          }
        }
        bMinX = Math.min(bMinX, x); bMinY = Math.min(bMinY, y);
        bMaxX = Math.max(bMaxX, x + w); bMaxY = Math.max(bMaxY, y + l);
        // 2.0: era della copia (level = id dell'era) e, per i Grandi Edifici,
        // livello/livello massimo: servono all'export JSON (Forge Hammer, città ridotta).
        const livelloVoce = typeof entry.level === "number" ? entry.level : undefined;
        const eraCopia = !isGE && livelloVoce !== undefined ? AGES_BY_ID.get(livelloVoce)?.age : undefined;
        mapBuildings.push({ entityId, mapEntityId: key, name: entityName, x, y, w, h: l, type: entryType, isGreatBuilding: isGE, isMilitary, isNeedlessRoad: isNeedless, isInactive: isInactiveBuilding, isSuppliesProducer, roadLevel,
          ...(eraCopia ? { era: eraCopia } : {}),
          ...(isGE && livelloVoce !== undefined ? { livello: livelloVoce, ...(typeof entry.max_level === "number" ? { livelloMax: entry.max_level } : {}) } : {}) });
      }

      const unlockedCells = new Set<string>();
      const unlockedAreas = preloadedData.UnlockedAreas;
      unlockedAreas.forEach((area: UnlockedArea) => {
        const ax = Number(area.x ?? 0);
        const ay = Number(area.y ?? 0);
        const aw = Number(area.width ?? 4);
        const al = Number(area.length ?? 4);
        if (!isNaN(ax) && !isNaN(ay) && aw > 0 && al > 0) {
          for (let dx = 0; dx < aw; dx++) {
            for (let dy = 0; dy < al; dy++) {
              unlockedCells.add(`${ax + dx},${ay + dy}`);
            }
          }
          bMinX = Math.min(bMinX, ax); bMinY = Math.min(bMinY, ay);
          bMaxX = Math.max(bMaxX, ax + aw); bMaxY = Math.max(bMaxY, ay + al);
        }
      });

      // Aggiungi 1 cella di padding per evitare crop ai bordi
      const nextCityMapBounds = bMinX < Infinity ? { minX: bMinX - 1, minY: bMinY - 1, maxX: bMaxX + 1, maxY: bMaxY + 1 } : null;

      setCityMapBuildings(mapBuildings);
      setCityMapBounds(nextCityMapBounds);
      setCityMapGrid(occupiedCells);
      setCityMapUnlockedCells(unlockedCells);
      setCityMapUnlockedAreas(unlockedAreas);

      setCityEntityIds(ids);
      setCityEntityDisconnected(disconnected);
      setIstanzeScollegate(istanzeScollegateImp);
      setCityEntityNeedlessCount(needlessCountByEntity);
      setGreatBuildingsJson(gbs);
      setMatchedJson(matched);
      setUnmatchedJson(unmatched);
      // Crea fallback buildings per gli edifici non presenti nel CSV
      const fallbacks = new Map<string, Building>();
      unmatched.forEach((_, id) => {
        // Salta i GE, che hanno già il loro trattamento
        if (isGreatBuildingId(id)) return;

        const cityEntity = cityEntities[id];
        if (!cityEntity) return;

        // Fallback creati con CURRENT_ERA: i valori mostrati sono quelli reali
        // dell'era della città importata.
        const fallback = BuildingModel.fromCityEntity(id, cityEntity, currentEra, ITALIAN_NAMES);
        if (fallback) {
          fallbacks.set(id, fallback);
        }
      });

      // ── Fallback per edifici in INVENTARIO non presenti nel CSV ────────────
      // Edifici come il "Laghetto Lunare" possono stare in inventario (o essere
      // costruibili dall'optimizer a livelli superiori) senza essere né in città
      // né nel CSV. Senza un fallback finirebbero come placeholder vuoti (badge
      // UNKNOWN). I loro dati reali (dimensioni, pop, felicità, boost att/dif/IQ)
      // sono però in CityEntities. Raccogliamo: (a) gli id edificio presenti in
      // inventario e (b) tutti i livelli delle loro catene di upgrade (da
      // kit.json), perché l'optimizer può produrre livelli superiori il cui id
      // non è fisicamente in inventario. Per ognuno, se esiste un CityEntity con
      // components, creiamo il fallback completo (produzioni escluse — non
      // ancora gestite). Chiave: id grezzo, coerente con fallbacks/unmatched.
      const inventoryItems = preloadedData.inventory;
      const inventoryBuildingIds = new Set<string>();
      for (const item of inventoryItems) {
        if (item?.item?.__class__ !== "BuildingItemPayload") continue;
        const cid = item.item?.cityEntityId ? String(item.item.cityEntityId) : null;
        if (cid) inventoryBuildingIds.add(cid);
      }
      // Espandi con tutti i livelli delle catene che toccano questi edifici.
      // Uno step di catena può essere un singolo id o un array di varianti.
      const chainLevelIds = new Set<string>(inventoryBuildingIds);
      for (const baseId of inventoryBuildingIds) {
        for (const entry of (BLD_ALL_CHAINS.get(baseId) ?? [])) {
          for (const step of entry.chain) {
            if (Array.isArray(step)) step.forEach(s => chainLevelIds.add(s));
            else chainLevelIds.add(step);
          }
        }
      }

      // Aggiungi anche i root degli edifici costruibili SOLO da kit (senza edificio
      // fisico in inventario). Per gli upgrade kit il root è steps[0]; per i
      // selection kit sono le options[] (che possono includere edifici base o altri
      // upgrade kit, da cui deriviamo ulteriori root). Poi espandiamo ogni root con
      // tutta la sua catena come sopra, così tutti i livelli raggiungibili (es. il
      // livello target di un FAB) ottengono il loro fallback da CityEntities.
      const addChainFrom = (rootId: string | string[]) => {
        const ids = Array.isArray(rootId) ? rootId : [rootId];
        for (const id of ids) {
          if (chainLevelIds.has(id)) continue;
          chainLevelIds.add(id);
          for (const entry of (BLD_ALL_CHAINS.get(id) ?? [])) {
            for (const step of entry.chain) {
              if (Array.isArray(step)) step.forEach(s => chainLevelIds.add(s));
              else chainLevelIds.add(step);
            }
          }
        }
      };
      for (const item of inventoryItems) {
        const upgradeKitId = item?.item?.upgradeItemId ? String(item.item.upgradeItemId) : null;
        if (upgradeKitId) {
          const upgradeEntry = KIT_RAW.buildingUpgrades[upgradeKitId];
          if (upgradeEntry?.steps?.length) {
            addChainFrom(upgradeEntry.steps[0] as string | string[]);
          }
        }
        const selectionKitId = item?.item?.selectionKitId ? String(item.item.selectionKitId) : null;
        if (selectionKitId) {
          const selectionEntry = KIT_RAW.selectionKits[selectionKitId];
          if (selectionEntry?.options?.length) {
            for (const opt of selectionEntry.options) {
              const optUpgrade = KIT_RAW.buildingUpgrades[opt];
              if (optUpgrade?.steps?.length) {
                addChainFrom(optUpgrade.steps[0] as string | string[]);
              } else {
                addChainFrom(opt);
              }
            }
          }
        }
      }
      for (const id of chainLevelIds) {
        if (fallbacks.has(id)) continue; // già creato (era in città)
        if (isGreatBuildingId(id)) continue;
        if (CSV_ENTITY_IDS_SET.has(id)) continue; // nel CSV: ha già i dati
        // fromCityEntity gestisce sia components[ERA] sia entity_levels[]+abilities[].
        // Il vecchio guard "!cityEntity?.components" escludeva silenziosamente tutti
        // gli edifici con struttura entity_levels (es. Casa degli Orrori, edifici
        // residenziali speciali). Ora accettiamo qualsiasi struttura che abbia
        // almeno una fonte di dati da cui estrarre dimensioni, pop o boost.
        const cityEntity = cityEntities[id];
        if (!cityEntity) continue;
        if (!cityEntity.components && !cityEntity.entity_levels?.length && !cityEntity.abilities?.length) continue;
        const fallback = BuildingModel.fromCityEntity(id, cityEntity, currentEra, ITALIAN_NAMES);
        if (fallback) fallbacks.set(id, fallback);
      }

      setFallbackBuildings(fallbacks);
      setCurrentEra(currentEra);

      // ── ERA STATS ────────────────────────────────────────────────────────
      // Per TUTTI gli edifici (città + qualsiasi entità che matcha il CSV,
      // così copriamo anche l'inventario), estraiamo le statistiche reali
      // dell'era corrente da CityEntities. Le tab Città e Inventario useranno
      // questi valori al posto di quelli del CSV (costruito sull'era massima).
      // Chiave: cityEntityId normalizzato (per matchare i Building del CSV).
      const eraStatsMap = new Map<string, EraStats>();
      // gameNames: nome originale dal gioco (CityEntities.name) per ogni entityId
      // presente in città o matched nel CSV. Chiave normalizzata per evitare
      // case mismatch con b.cityEntityId provenienti dal CSV.
      const gameNames = new Map<string, string>();
      for (const entityId in cityEntities) {
        const isInCity = ids.has(entityId);
        const isInCsv = CSV_ENTITY_IDS_SET.has(entityId);
        const isInventoryChain = chainLevelIds.has(entityId);
        if (!isInCity && !isInCsv && !isInventoryChain) continue;
        const entityDef = cityEntities[entityId];
        if (entityDef?.components || entityDef?.entity_levels?.length || entityDef?.abilities?.length) {
          eraStatsMap.set(entityId, BuildingModel.extractEraStats(entityDef, currentEra || FALLBACK_ERA));
        }
        if (entityDef?.name) {
          gameNames.set(entityId, String(entityDef.name));
        }
      }
      setEraStats(eraStatsMap);
      setGameNames(gameNames);
      setGameLang(gameLang);
      setPortraitUrl(sanitizePortraitUrl(preloadedData.portraitUrl));
      setLivelloCastello(sanitizeCastleLevel(preloadedData.castleLevel));
      setEntityLevels(entityLevels);
      setEntityLevelsList(entityLevelsList);

      // ── entityInstanceEraStats ────────────────────────────────────────────
      // Pre-calcola le EraStats per era distinta, per gli edifici con copie in
      // ere diverse. Serve a due scopi:
      // (1) il riepilogo produzioni (somma count × stats per era) — rilevante
      //     quando ci sono ere miste;
      // (2) il popup "se aggiorni" — rilevante per qualsiasi copia in un'era più
      //     vecchia di quella corrente.
      // Quindi includiamo l'entità se ha almeno un'era diversa dalla corrente
      // (ere miste OPPURE tutte le copie in un'unica era obsoleta).
      const entityInstanceEraStats = new Map<string, Array<[string, number, EraStats]>>();
      for (const [entityId, levels] of entityLevelsList) {
        const countByEra = new Map<string, number>();
        for (const lvl of levels) {
          const eraAge = AGES_BY_ID.get(lvl)?.age;
          if (!eraAge) continue;
          countByEra.set(eraAge, (countByEra.get(eraAge) ?? 0) + 1);
        }
        // Salta solo se l'unica era presente è esattamente quella corrente
        // (nessuna copia obsoleta e nessuna era mista → niente da pre-calcolare).
        const onlyCurrentEra = countByEra.size === 1 && countByEra.has(currentEra);
        if (onlyCurrentEra) continue;
        const entityDef = cityEntities[entityId];
        const groups: Array<[string, number, EraStats]> = [];
        for (const [eraAge, count] of countByEra) {
          const stats = eraAge === currentEra
            ? (eraStatsMap.get(entityId) ?? BuildingModel.extractEraStats(entityDef ?? {}, eraAge))
            : BuildingModel.extractEraStats(entityDef ?? {}, eraAge);
          groups.push([eraAge, count, stats]);
        }
        entityInstanceEraStats.set(entityId, groups);
      }
      setEntityInstanceEraStats(entityInstanceEraStats);

      // ── declassableBuildings = "Invecchiabili" (10/11/2026, utente) ──────
      // Edifici che portati all'Età del Bronzo (con i kit) danno la STESSA
      // quantità di beni (era attuale, precedente e successiva) e gli stessi
      // valori militari dell'era attuale: servono a produrre beni di un'era
      // vecchia (per sbloccare i livelli dei GE di quell'era) senza perdere
      // niente. Le produzioni calano in modo progressivo con l'era (utente),
      // quindi basta il confronto era attuale ↔ Bronzo. Solo edifici che
      // producono beni; esclusi GE, militari, edifici di tutte le ere ed edifici
      // a era automatica (non si invecchiano con i kit). (Prima "Declassabili":
      // stessi valori militari e meno popolazione.)
      const declassableMap = new Map<string, { popCurr: number; popBronze: number; statsBronze: EraStats }>();
      for (const [entityId] of ids) {
        if (isMilitaryBuildingId(entityId) || isGreatBuildingId(entityId) || isAllAgeBuildingId(entityId)) continue;
        const csv = BUILDING_BY_ID.get(entityId);
        if (csv && isEraMutable(csv)) continue;
        const entityDef = cityEntities[entityId];
        if (!entityDef) continue;
        const statsCurr = eraStatsMap.get(entityId) ?? BuildingModel.extractEraStats(entityDef, currentEra || FALLBACK_ERA);
        const statsBronze = BuildingModel.extractEraStats(entityDef, "BronzeAge");
        const popCurr = statsCurr.pop;
        const popBronze = statsBronze.pop;
        if (statsCurr.beni + statsCurr.benip + statsCurr.benis <= 0) continue;
        if (statsCurr.beni !== statsBronze.beni || statsCurr.benip !== statsBronze.benip || statsCurr.benis !== statsBronze.benis) continue;
        if (
          !statsCurr.general.every((v, i) => v === statsBronze.general[i]) ||
          !statsCurr.gbg.every((v, i) => v === statsBronze.gbg[i]) ||
          !statsCurr.sped.every((v, i) => v === statsBronze.sped[i]) ||
          !statsCurr.iq.every((v, i) => v === statsBronze.iq[i])
        ) continue;
        declassableMap.set(entityId, { popCurr, popBronze, statsBronze });
      }
      setDeclassableBuildings(declassableMap);

      writeStoredJson(cityKey, {
        cityEntityIds: Array.from(ids.entries()),
        cityEntityDisconnected: Array.from(disconnected.entries()),
        istanzeScollegate: istanzeScollegateImp,
        cityEntityNeedlessCount: Array.from(needlessCountByEntity.entries()),
        cityMapBuildings: mapBuildings,
        cityMapBounds: nextCityMapBounds,
        cityMapGrid: Array.from(occupiedCells),
        cityMapUnlockedCells: Array.from(unlockedCells),
        cityMapUnlockedAreas: unlockedAreas,
        greatBuildingsJson: Array.from(gbs.entries()),
        matchedJson: Array.from(matched.entries()),
        unmatchedJson: Array.from(unmatched.entries()),
        fallbackBuildings: Array.from(fallbacks.entries()),
        currentEra,
        eraStats: Array.from(eraStatsMap.entries()),
        entityLevels: Array.from(entityLevels.entries()),
        entityLevelsList: Array.from(entityLevelsList.entries()),
        entityInstanceEraStats: Array.from(entityInstanceEraStats.entries()),
        declassableBuildings: Array.from(declassableMap.entries()),
        gameNames: Array.from(gameNames.entries()),
        gameLang,
        // Filtrato PRIMA di essere persistito: così un URL ostile non resta
        // nemmeno salvato nel profilo (vedi sanitizePortraitUrl).
        portraitUrl: sanitizePortraitUrl(preloadedData.portraitUrl) || undefined,
        bookmarkletVersion: typeof preloadedData._v === "number" ? preloadedData._v : 0,
        ...(sanitizeCastleLevel(preloadedData.castleLevel) ? { castleLevel: sanitizeCastleLevel(preloadedData.castleLevel)! } : {}),
        // `satisfies CityStore`: writeStoredJson accetta `unknown`, quindi senza
        // questa verifica strutturale un campo dimenticato o con typo
        // compilerebbe e persisterebbe profili incompleti in silenzio (il
        // reader farebbe revive di un campo assente → dati persi al reload).
      } satisfies CityStore);
      setIsDebugOpen(false);
      bumpStorage();
    } catch (err) {
      console.error("Error importing city map:", err);
    }
  };

  // Processa un JSON già validato dalla bacchetta magica nell'ordine logico:
  // 1) UnlockedAreas → spazio disponibile in città
  // 2) CityEntities → definizioni di tutte le entità del gioco
  // 3) CityMapData → edifici piazzati in città
  // 4) allies → alleati posseduti (placement letto da CityEntities/CityMapData)
  // 5) inventory → oggetti, kit e frammenti in inventario
  const handleImportAll = async (parsed: BookmarkletData, targetProfileId?: string, soloCitta = false) => {
    const pid = targetProfileId ?? activeProfileId;
    const inventoryKey = profileStorageKey(pid, "inventory");
    const alliesKey = profileStorageKey(pid, "allies");

    // ── Fase Città: UnlockedAreas + CityEntities + CityMapData ──────────────
    // handleImportCityMap processa i 3 blocchi insieme (sono interdipendenti)
    await handleImportCityMap(parsed, pid);
    // 2.0: città visitata = solo la mappa (inventario, alleati e magazzino della
    // città, se è una città mia, restano quelli che c'erano)
    if (soloCitta) { bumpStorage(); return; }

    // ── Fase Alleati ────────────────────────────────────────────────────────
    const allImportedAllies: Allies.ImportedAlly[] = [];
    const alliesFromGame = Allies.parseAllyData(parsed.allies, RARITY_FROM_GAME, parsed.CityMapData as Record<string, { cityentity_id?: unknown }>);
    allImportedAllies.push(...alliesFromGame);

    // ── Fase Inventario ─────────────────────────────────────────────────────
    const items = parsed.inventory;
    const { matched, unmatched, selectionKits, upgradeKits, specialKits: parsedSpecialKits } = parseInventory(
      items,
      CSV_ENTITY_IDS_SET,
    );

    // statistiche di ogni copia d'inventario alla SUA era (filtri Era / Beni dell'era)
    const entitaGioco = (parsed.CityEntities ?? {}) as Record<string, CityEntityDefinition>;
    for (const mappa of [matched, unmatched]) mappa.forEach(e => {
      const def = entitaGioco[e.cityEntityId];
      if (!def || !e.ere) return;
      const st: Record<number, EraStats> = {};
      for (const k of Object.keys(e.ere)) { const a = AGES_BY_ID.get(Number(k)); if (a) st[Number(k)] = BuildingModel.extractEraStats(def, a.age); }
      e.statsEra = st;
    });

    setInventoryMatched(matched);
    setInventoryUnmatched(unmatched);
    setInventorySelectionKits(selectionKits);
    setInventoryUpgradeKits(upgradeKits);
    setSpecialKits(parsedSpecialKits);
    writeStoredJson(inventoryKey, {
      inventoryMatched: Array.from(matched.entries()),
      inventoryUnmatched: Array.from(unmatched.entries()),
      inventorySelectionKits: Array.from(selectionKits.entries()),
      inventoryUpgradeKits: Array.from(upgradeKits.entries()),
      specialKits: parsedSpecialKits,
      // Verifica strutturale: stesso razionale del `satisfies CityStore`
      // nella scrittura della città (writeStoredJson accetta `unknown`).
    } satisfies InventoryStore);
    setIsInventoryDebugOpen(false);

    // Estrai i frammenti di alleati che sono dentro l'inventario (richiede inventory già parsato)
    const allyFragments = Allies.parseAllyFragments(items, RARITY_FROM_GAME);
    allImportedAllies.push(...allyFragments);

    // Aggiorna sempre, anche con array vuoto: se si re-importa un account senza
    // alleati né frammenti, i dati del vecchio import devono sparire da UI e
    // storage (coerente con come si comportano città e inventario qui sopra).
    setImportedAllies(allImportedAllies);
    writeStoredJson(alliesKey, allImportedAllies);

    // ── Fase Risorse (bacchetta v6) ─────────────────────────────────────────
    // Salvate solo se presenti e valide; altrimenti lo slot viene cancellato,
    // così un re-import con una bacchetta più vecchia nasconde di nuovo il
    // pannello consigliere invece di lasciare scorte ormai non aggiornate.
    const resources = sanitizeResources(parsed.resources);
    const resourcesKey = profileStorageKey(pid, "resources");
    if (resources) writeStoredJson(resourcesKey, resources);
    else clearStoredJson(resourcesKey);
    setPlayerResources(resources);

    bumpStorage();
  };

  const [generalDefense, setGeneralDefense] = useState<0.8 | 1.0>(() => {
    const saved = localStorage.getItem(DEFENSE_KEY);
    return (saved === "1" ? 1.0 : saved === "0.8" ? 0.8 : 0.8) as 0.8 | 1.0;
  });
  const [spedizioniEnabled, setSpedizioniEnabled] = useState<boolean>(() => {
    return localStorage.getItem(SPED_ENABLED_KEY) === "true";
  });
  // 2.0: colonne Spedizioni della tabella edifici (Visualizza), separate dal
  // peso nell'efficienza (Opzioni). Senza valore salvato si parte come il peso.
  const [showSpedColumnsPref, setShowSpedColumns] = useState<boolean>(() => {
    // (senza preferenza salvata, prima apertura o dopo Cancella tutto: accese; utente 07/11)
    const v = localStorage.getItem(SPED_COLUMNS_KEY);
    return v === null ? true : v === "true";
  });
  const [spedizioniAttack, setSpedizioniAttack] = useState<number>(() => {
    const saved = localStorage.getItem(SPED_ATTACK_KEY);
    if (!saved) return 0.2;
    const val = parseFloat(saved);
    return !isNaN(val) && val >= 0 && val <= 1 ? val : 0.2;
  });
  // Pulsante Σ: somma General+Campi (e General+Spedizioni se abilitate)
  const [showSigmaColumns, setShowSigmaColumns] = useState<boolean>(() => localStorage.getItem(SIGMA_KEY) === "true");
  // Opzioni › Bonus GE (Città/Inventario): valori militari ed efficienza con i moltiplicativi dei GE
  const [bonusGeTabella, setBonusGeTabella] = useState<boolean>(() => localStorage.getItem(BONUS_GE_KEY) === "true");
  // Colonne Pop/Fel/IQ-Mon-Mat: globali (non per-tab) come Sigma, di default
  // nascoste. Prima erano dentro TabFilters (per-tab); rese globali su
  // richiesta esplicita dell'utente.
  const [showPopColumn, setShowPopColumn] = useState<boolean>(() => localStorage.getItem(POP_COLUMN_KEY) === "true");
  const [showFelColumn, setShowFelColumn] = useState<boolean>(() => localStorage.getItem(FEL_COLUMN_KEY) === "true");
  const [showIqProdColumns, setShowIqProdColumns] = useState<boolean>(() => localStorage.getItem(IQ_PROD_COLUMNS_KEY) === "true");
  // Toggle "Produzioni" (mostra/nasconde le colonne Mon/Mat + le altre
  // produzioni): globale come Sigma/Pop/Fel, non per-tab. Prima era dentro
  // TabFilters (showProdColumns), quindi (a) veniva azzerato da
  // resetFilters() insieme ai filtri veri e propri, e (b) non sopravviveva
  // al reload. I filtri sulle produzioni associati (prodFilter,
  // prodFilterMode) restano invece dentro TabFilters/DEFAULT_FILTERS: solo
  // la visibilità del pannello è resa globale e persistente, non la
  // selezione dei filtri al suo interno.
  // (senza preferenza salvata, prima apertura o dopo Cancella tutto: accese; utente 07/11)
  const [showProdColumnsPref, setShowProdColumns] = useState<boolean>(() => localStorage.getItem(PROD_COLUMNS_KEY) !== "false");
  // Catalogo › Grandi Edifici: Spedizioni e Produzioni sempre visibili (utente, 06/11; niente pulsanti nel nastro)
  const catalogoGeAperto = activeTab === "database" && catalogo === "ge";
  const showProdColumns = showProdColumnsPref || catalogoGeAperto;
  const showSpedColumns = showSpedColumnsPref || catalogoGeAperto;
  // (2.0: "Non accelerabili" e "Auto aggiornabili" sono voci a tre stati di
  // TabFilters.tri; come prima non persistenti: ripartono da "tutti".)
  // Lingua della GUI (etichette/tooltip statici): scelta esplicita
  // dell'utente, persistente, indipendente da gameLang (che segue invece i
  // dati del profilo importato). Il cambio fa un reload: centinaia di
  // stringhe statiche sono sparse nella UI, un reload evita di doverle
  // ri-renderizzare tutte a runtime con lo stesso risultato di un refresh.
  //
  // Se l'utente non ha mai scelto esplicitamente (nessuna chiave valida in
  // localStorage), il default segue la lingua del browser: italiano se il
  // browser è in italiano, altrimenti inglese. Una volta che l'utente
  // sceglie (handleUiLangChange), quella scelta sovrasta sempre il default.
  const [uiLang] = useState<UiLang>(() => {
    const stored = localStorage.getItem(UI_LANG_KEY);
    if (stored === "en" || stored === "it") return stored;
    return detectBrowserUiLang();
  });
  const handleUiLangChange = (lang: UiLang) => {
    if (lang === uiLang) return;
    localStorage.setItem(UI_LANG_KEY, lang);
    window.location.reload();
  };

  const DEFAULT_FILTERS: TabFilters = {
    categorie: new Set(),
    showEventFilter: "",
    tri: TRI_ZERO,
    prodFilter: new Set(),
    prodFilterMode: "OR",
    prodNo: new Set(),
    minEff: "",
  };

  const [tabFilters, setTabFilters] = useState<Record<TabType, TabFilters>>({
    database: { ...DEFAULT_FILTERS },
    alleati: { ...DEFAULT_FILTERS },
    propria_citta: { ...DEFAULT_FILTERS },
    inventario: { ...DEFAULT_FILTERS },
  });
  const statoPronti = tabFilters.inventario.tri.pronti ?? 0;
  const showOnlyReadyBuildings = statoPronti === 2;

  // "pirati" non ha filtri propri (pagina placeholder, non ancora
  // integrata) e non fa parte di TabType/tabFilters: fallback a
  // DEFAULT_FILTERS quando activeTab è "pirati", così currentFilters
  // resta sempre un TabFilters valido senza dover toccare TabType.
  const currentFilters = activeTab === "pirati" ? DEFAULT_FILTERS : tabFilters[activeTab];
  const currentEventFilter: EventEntry | null = useMemo(
    () => currentFilters.showEventFilter
      ? EVENTS_LIST.find((event) => event.id === currentFilters.showEventFilter) ?? null
      : null,
    [currentFilters.showEventFilter],
  );

  const updateFilter = <K extends keyof TabFilters>(key: K, value: TabFilters[K]) => {
    // updateFilter è chiamata solo da controlli UI presenti esclusivamente
    // nelle tab con filtri reali (mai renderizzati in "pirati", pagina
    // placeholder priva di TabFilters) — il cast è sicuro per costruzione.
    const tab = activeTab as TabType;
    setTabFilters(prev => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        [key]: value
      }
    }));
  };

  // Voce a tre stati: tutti → nascosti → solo questi → tutti.
  const giraTri = (voce: VoceTri) => {
    const tab = activeTab as TabType;
    setTabFilters(prev => {
      const stato = ((prev[tab].tri[voce] + 1) % 3) as StatoTri;
      const tri = { ...prev[tab].tri, [voce]: stato };
      return { ...prev, [tab]: { ...prev[tab], tri } };
    });
  };

  const toggleProdFilter = (key: string) => {
    // Stesso ragionamento di updateFilter sopra: mai chiamata da "pirati".
    const tab = activeTab as TabType;
    // tre stati come "Nascondi / Mostra solo": niente → sì (verde) → no (rosso) → niente
    setTabFilters(prev => {
      const si = new Set(prev[tab].prodFilter), no = new Set(prev[tab].prodNo);
      if (si.has(key)) { si.delete(key); no.add(key); } else if (no.has(key)) no.delete(key); else si.add(key);
      return { ...prev, [tab]: { ...prev[tab], prodFilter: si, prodNo: no } };
    });
  };

  const toggleCategoria = (c: Categoria) => {
    const tab = activeTab as TabType;
    setTabFilters(prev => {
      const current = new Set(prev[tab].categorie);
      if (current.has(c)) current.delete(c); else current.add(c);
      return { ...prev, [tab]: { ...prev[tab], categorie: current } };
    });
  };

  const resetFilters = () => {
    setEraInventario(null);
    setBeniEraInventario(null);
    setTabFilters({
      database: { ...DEFAULT_FILTERS, prodFilter: new Set(), prodNo: new Set(), categorie: new Set() },
      alleati: { ...DEFAULT_FILTERS, prodFilter: new Set(), prodNo: new Set(), categorie: new Set() },
      propria_citta: { ...DEFAULT_FILTERS, prodFilter: new Set(), prodNo: new Set(), categorie: new Set() },
      inventario: { ...DEFAULT_FILTERS, prodFilter: new Set(), prodNo: new Set(), categorie: new Set() },
    });
    setAllyRarityFilters({
      1: true, 2: true, 3: true, 4: true, 5: true,
    });
    setSortCriteriaByScope({
      database: [{ key: "eff", order: "desc" }],
      propria_citta: [{ key: "eff", order: "desc" }],
      inventario: [{ key: "eff", order: "desc" }],
      alleati_own: [{ key: "eff", order: "desc" }],
      alleati_db: [{ key: "eff", order: "desc" }],
    });
    setManualSortTabs({
      database: false,
      alleati: false,
      propria_citta: false,
      inventario: false,
    });
    setSearchTerm("");
    // Svuota anche selectedIds: le righe evidenziate in tab Città
    // (row-highlighted) derivano da selectedIds tramite
    // highlightedCityEntityIds — senza questo, il reset filtri lasciava le
    // righe cliccate ancora evidenziate (bug segnalato luglio 2026).
    setSelectedIds(new Set());
  };



  const weights: Weights = useMemo(() => {
    const def = generalDefense;
    const spdAtk = spedizioniEnabled ? spedizioniAttack : 0;
    return {
      general: [1.0, def, 1.0, def],
      gbg: [1.0 - spdAtk, def * (1 - spdAtk), 1.0 - spdAtk, def * (1 - spdAtk)],
      sped: [spdAtk, spdAtk * def, spdAtk, spdAtk * def],
      iq: [0, 0, 0, 0],
    };
  }, [generalDefense, spedizioniEnabled, spedizioniAttack]);

  const [searchTerm, setSearchTerm] = useState("");
  // Debounce esplicito (oltre a useDeferredValue) sul valore usato per il
  // filtro pesante: con ~2000 edifici, digitando velocemente una parola
  // (es. "Azalea") ogni lettera intermedia ("a", "az", "aza", ...) farebbe
  // comunque scattare un ricalcolo/re-render della tabella filtrata non
  // appena React trova un momento libero — percepito come "scatti" o lag
  // durante la digitazione, anche se l'input in sé resta reattivo. Il
  // debounce ritarda l'aggiornamento del valore effettivo di filtro di
  // qualche centinaio di ms dall'ultima battuta: se l'utente continua a
  // scrivere, i valori intermedi vengono scartati e il filtro scatta una
  // sola volta, alla fine (o durante una pausa nella digitazione).
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const prevSearchTermRef = useRef("");
  useEffect(() => {
    // Cancellare caratteri (o svuotare la ricerca) allarga il set di
    // risultati: l'utente si aspetta di vederlo subito, non ha senso
    // fargli aspettare un debounce pensato per l'opposto (digitare in
    // avanti, dove il set si restringe e i risultati intermedi sono
    // sprecati). Applica il ritardo solo quando la stringa si allunga o
    // resta della stessa lunghezza (sostituzione/selezione+digitazione);
    // se si accorcia, aggiorna subito.
    const isShrinking = searchTerm.length < prevSearchTermRef.current.length;
    prevSearchTermRef.current = searchTerm;
    if (isShrinking) {
      setDebouncedSearchTerm(searchTerm);
      return;
    }
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const deferredSearch = useDeferredValue(debouncedSearchTerm);

  // Alleati importati dal gioco
  const [importedAllies, setImportedAllies] = useState<Allies.ImportedAlly[]>(() => { const s = getInitAllies(); return Array.isArray(s) ? s as Allies.ImportedAlly[] : []; });
  // Magazzino risorse del profilo (bacchetta v6). null = profilo importato con
  // una bacchetta precedente: il pannello consigliere alleati resta nascosto.
  // Sanitizzato anche in rilettura (il profilo può venire da un file di terzi).
  const [playerResources, setPlayerResources] = useState<Record<string, number> | null>(
    () => sanitizeResources(readStoredJson<unknown>(profileStorageKey(activeProfileId, "resources"), null)));

  const [allyRarityFilters, setAllyRarityFilters] = useState<Record<number, boolean>>({
    1: true, 2: true, 3: true, 4: true, 5: true,
  });
  // 2.0: scheda Alleati = solo i tuoi alleati (il database è nel catalogo
  // Alleati del Database). Opzione "Livello 100": statistiche dei tuoi alleati
  // come se fossero portati a livello 100 (stesso livello del database).
  const [alleatiLivello100, setAlleatiLivello100] = useState(false);
  // Conteggi dei tuoi alleati per i pulsanti dei Filtri (scheda Alleati):
  // militari e scienza (copie intere) e frammentati, indipendenti dai filtri.
  const conteggiAlleati = useMemo(() => {
    let militari = 0, scienza = 0, frammenti = 0;
    for (const imp of importedAllies) {
      const csv = ALLIES_BY_ID_RARITY.get(`${imp.allyId}__${imp.rarity}`);
      if (!csv) continue;
      if (imp.isFragment) frammenti++;
      else if (csv.allyType === "S") scienza++;
      else militari++;
    }
    return { militari, scienza, frammenti };
  }, [importedAllies]);
  // Filtro Frammenti (scheda Alleati): mostra/nasconde gli alleati frammentati.
  const [mostraFrammentiAlleati, setMostraFrammentiAlleati] = useState(true);
  const toggleRarityFilter = (rarity: number) => {
    setAllyRarityFilters((prev) => {
      // L'utente può nascondere anche tutte le rarità (tabella vuota): è una
      // scelta legittima, non la blocchiamo.
      return { ...prev, [rarity]: !prev[rarity] };
    });
  };


  // Per ogni cityEntityId con slot alleato (b.ally > 0) e presente in città,
  // un array con uno slot PER COPIA posseduta: { filled, allyDisplayName }.
  // Pieni prima (con nome alleato risolto per il tooltip), poi vuoti — vedi
  // badge 🖼️ allies_slot_full/allies_slot_empty in BuildingRow.
  // Match per istanza specifica via mapEntityId (cityMapBuildings <->
  // placedInMapEntityId dell'alleato), NON solo per tipo: così, con più copie
  // dello stesso edificio, ogni icona riflette la copia reale a cui è
  // associata. Se per qualche istanza manca il dato di mappa (dovrebbe
  // essere raro, mappa e alleati vengono dalla stessa importazione), si
  // ricade su un conteggio aggregato: N icone coerenti col totale posseduto,
  // le prime "piazzati" come piene (senza garanzia di quale copia esatta),
  // il resto vuote — non si perde mai la riga, solo l'attribuzione precisa.
  const allySlotsPerBuilding = useMemo(() => {
    const result = new Map<string, Array<{ filled: boolean; allyDisplayName?: string }>>();
    if (!cityEntityIds.size) return result;

    // mapEntityId (istanza) -> alleato piazzato lì, se presente.
    const allyByMapEntityId = new Map<string, Allies.ImportedAlly>();
    for (const a of importedAllies) {
      if (a.isPlaced && a.placedInMapEntityId) {
        allyByMapEntityId.set(a.placedInMapEntityId, a);
      }
    }
    // cityEntityId (tipo) -> lista di mapEntityId (istanze reali sulla mappa).
    const instancesByEntity = new Map<string, string[]>();
    for (const mb of cityMapBuildings) {
      if (!mb.entityId) continue;
      const list = instancesByEntity.get(mb.entityId);
      if (list) list.push(mb.mapEntityId);
      else instancesByEntity.set(mb.entityId, [mb.mapEntityId]);
    }
    // Conteggio aggregato di alleati piazzati per tipo (fallback quando le
    // istanze mappa non coprono tutte le copie possedute).
    const placedCountByEntity = new Map<string, number>();
    for (const a of importedAllies) {
      if (a.isPlaced && a.placedInEntityId) {
        placedCountByEntity.set(a.placedInEntityId, (placedCountByEntity.get(a.placedInEntityId) ?? 0) + 1);
      }
    }

    // Anche i fallback (edifici in città non ancora nel CSV): da settembre
    // 2026 BuildingModel.fromCityEntity ricava ally/allyType da CityEntities
    // come fa il Python per il CSV. Nessun doppione: un fallback esiste solo
    // per id ASSENTI dal CSV.
    for (const b of [...BUILDINGS_FROM_CSV, ...fallbackBuildings.values()]) {
      if (b.ally <= 0 || !b.cityEntityId) continue;
      const totalInstances = cityEntityIds.get(b.cityEntityId) ?? 0;
      if (totalInstances <= 0) continue;

      const mapInstances = instancesByEntity.get(b.cityEntityId) ?? [];
      const slots: Array<{ filled: boolean; allyDisplayName?: string }> = [];

      if (mapInstances.length >= totalInstances) {
        // Caso normale: un'istanza mappa per copia, match esatto per-istanza.
        for (const mapEntityId of mapInstances) {
          const ally = allyByMapEntityId.get(mapEntityId);
          slots.push(ally
            ? { filled: true, allyDisplayName: allyName(ally.allyId, gameLang) }
            : { filled: false });
        }
      } else {
        // Fallback aggregato: mancano dati di mappa per qualche copia.
        const placedTotal = placedCountByEntity.get(b.cityEntityId) ?? 0;
        // Nomi noti degli alleati piazzati su QUESTO tipo (da mapInstances,
        // se ce ne sono alcune) per non perdere l'informazione se disponibile.
        const knownNames = mapInstances
          .map(id => allyByMapEntityId.get(id))
          .filter((a): a is Allies.ImportedAlly => !!a)
          .map(a => allyName(a.allyId, gameLang));
        for (let i = 0; i < totalInstances; i++) {
          if (i < placedTotal) {
            slots.push({ filled: true, allyDisplayName: knownNames[i] });
          } else {
            slots.push({ filled: false });
          }
        }
      }

      // Pieni prima, poi vuoti (ordine deciso, non necessariamente quello
      // fisico sulla mappa).
      slots.sort((s1, s2) => (s2.filled ? 1 : 0) - (s1.filled ? 1 : 0));
      result.set(b.cityEntityId, slots);
    }
    return result;
  }, [cityEntityIds, cityMapBuildings, importedAllies, gameLang, fallbackBuildings]);

  // Criteri di ordinamento INDIPENDENTI per ambito (SortScope): prima era un
  // unico array condiviso da tutte e 5 le tabelle (edifici Database/Città/
  // Inventario + Alleati posseduti/database), quindi ordinare una tabella
  // per una colonna qualunque si propagava a tutte le altre. Ogni scope ha
  // ora il proprio array, inizializzato a "Eff" decrescente come prima.
  const DEFAULT_SORT_CRITERIA: SortCriterion[] = [{ key: "eff", order: "desc" }];
  const [sortCriteriaByScope, setSortCriteriaByScope] = useState<Record<SortScope, SortCriterion[]>>({
    database: [...DEFAULT_SORT_CRITERIA],
    propria_citta: [...DEFAULT_SORT_CRITERIA],
    inventario: [...DEFAULT_SORT_CRITERIA],
    alleati_own: [...DEFAULT_SORT_CRITERIA],
    alleati_db: [...DEFAULT_SORT_CRITERIA],
  });
  const [manualSortTabs, setManualSortTabs] = useState<Record<TabType, boolean>>({
    database: false,
    alleati: false,
    propria_citta: false,
    inventario: false,
  });

  // handleSort ora richiede lo scope esplicito: le due tabelle Alleati
  // vivono sotto la stessa TabType "alleati" ma sono scope diversi, quindi
  // activeTab da solo non basta a distinguerle (a differenza delle 3 viste
  // della tabella edifici, dove scope coincide con TabType).
  const makeHandleSort = (scope: SortScope) => (key: SortKey) => {
    if (scope === "database" || scope === "propria_citta" || scope === "inventario") {
      setManualSortTabs((previous) => ({ ...previous, [scope]: true }));
    }
    setSortCriteriaByScope((previousByScope) => {
      const previous = previousByScope[scope];
      const existingIndex = previous.findIndex((criterion) => criterion.key === key);

      let next: SortCriterion[];
      if (existingIndex === 0) {
        const current = previous[0];
        next = [
          { key, order: current.order === "desc" ? "asc" : "desc" },
          ...previous.slice(1),
        ];
      } else {
        const previousOrder = existingIndex > -1 ? previous[existingIndex].order : "desc";
        const remaining = previous.filter((criterion) => criterion.key !== key);
        next = [{ key, order: previousOrder }, ...remaining];
      }
      return { ...previousByScope, [scope]: next };
    });
  };

  // Scorciatoie per la tabella edifici (scope coincide con activeTab).
  const sortCriteria = sortCriteriaByScope[
    activeTab === "database" || activeTab === "propria_citta" || activeTab === "inventario" ? activeTab : "database"
  ];
  const sortBy = sortCriteria[0]?.key ?? "eff";
  const sortOrder = sortCriteria[0]?.order ?? "desc";
  const handleSort = makeHandleSort(
    activeTab === "database" || activeTab === "propria_citta" || activeTab === "inventario" ? activeTab : "database"
  );

  // Scorciatoie dedicate alle due tabelle Alleati (usate negli header
  // inline di quelle due <table>, non tramite renderMilitaryHeaders che è
  // invece parametrizzata esplicitamente con lo scope).
  const sortCriteriaAlleatiOwn = sortCriteriaByScope.alleati_own;
  const sortByAlleatiOwn = sortCriteriaAlleatiOwn[0]?.key ?? "eff";
  const sortOrderAlleatiOwn = sortCriteriaAlleatiOwn[0]?.order ?? "desc";
  const handleSortAlleatiOwn = makeHandleSort("alleati_own");

  const sortCriteriaAlleatiDb = sortCriteriaByScope.alleati_db;
  const sortByAlleatiDb = sortCriteriaAlleatiDb[0]?.key ?? "eff";
  const sortOrderAlleatiDb = sortCriteriaAlleatiDb[0]?.order ?? "desc";
  const handleSortAlleatiDb = makeHandleSort("alleati_db");

  // Sezione "📦 PRODUZIONI" delle due tabelle Alleati (posseduti + database):
  // solo 3 colonne (PF/Beni/BeniP), a differenza delle ~20 della tabella
  // edifici — sono le uniche produzioni che gli alleati "science" hanno oggi
  // (vedi Ally.pf/beni/beniP in allies.ts). Riusa le SortKey "fp"/"beni"/
  // "benip" già esistenti per gli edifici (stesso concetto), quindi
  // allySortValue in compareAllies non richiede chiavi nuove.
  const renderAllyProductionGroupHeader = () => (
    <th className="py-2 px-2 text-center group-header-orange text-orange-400/80 whitespace-nowrap" colSpan={3}>
      <TitoloGruppo icona={iconProduzioni} testo={t("groupProductions", uiLang)} />
    </th>
  );
  const renderAllyProductionHeaders = (scope: SortScope) => {
    const criteria = sortCriteriaByScope[scope];
    const activeSortBy = criteria[0]?.key ?? "eff";
    const activeSortOrder = criteria[0]?.order ?? "desc";
    const onSort = makeHandleSort(scope);
    return (
      <>
        <SortableHeader noGap label={<TableHeaderIcon src={iconFP} alt={t("prodForgePoints", uiLang)} />} sortKey="fp" onClick={() => onSort("fp")} active={activeSortBy === "fp"} order={activeSortOrder} className="th-col section-divider" title={t("prodForgePoints", uiLang)} />
        <SortableHeader noGap label={<TableHeaderIcon src={iconBeni} alt={t("prodGoodsCurrent", uiLang)} />} sortKey="beni" onClick={() => onSort("beni")} active={activeSortBy === "beni"} order={activeSortOrder} className="th-col" title={t("prodGoodsCurrent", uiLang)} />
        <SortableHeader noGap label={<TableHeaderIcon src={iconBeniP} alt={t("prodGoodsPrevious", uiLang)} />} sortKey="benip" onClick={() => onSort("benip")} active={activeSortBy === "benip"} order={activeSortOrder} className="th-col" title={t("prodGoodsPrevious", uiLang)} />
      </>
    );
  };

  // Riga dei titoli di gruppo (⚔️ Generali / 🔰 Campi / ⚡ Spedizioni) sopra le
  // colonne icona: stesso blocco identico nelle 3 tabelle, un livello sopra
  // renderMilitaryHeaders. Anche questo legge solo state già in scope.
  const renderMilitaryGroupHeaders = (sped: boolean = showSpedColumns) => (
    <>
      {!showSigmaColumns && <th className="py-2 px-2 text-center group-header-amber text-amber-400/80" colSpan={4}><TitoloGruppo icona={iconSword} testo={t("groupGenerals", uiLang)} /></th>}
      <th className="py-2 px-2 text-center group-header-emerald text-emerald-400/80" colSpan={4}>
        {showSigmaColumns
          ? <><TitoloGruppo icona={iconSword} testo={t("groupGenShort", uiLang)} /> + <TitoloGruppo icona={iconCampi} testo={t("groupGbgShort", uiLang)} /></>
          : <TitoloGruppo icona={iconCampi} testo={t("groupGbg", uiLang)} />}
      </th>
      {sped && <th className="py-2 px-2 text-center group-header-violet text-violet-400/80" colSpan={4}>
        {showSigmaColumns
          ? <><TitoloGruppo icona={iconSword} testo={t("groupGenShort", uiLang)} /> + <TitoloGruppo icona={iconSpedizioni} testo={t("groupGeShort", uiLang)} /></>
          : <TitoloGruppo icona={iconSpedizioni} testo={t("groupGe", uiLang)} />}
      </th>}
    </>
  );

  // Variante NON ordinabile delle intestazioni a icone (stesse colonne, stessi
  // Σ/Spedizioni), per il Consigliere Gettoni Valore: lì le colonne mostrano
  // variazioni dei boost, ordinarle non ha senso e agganciare uno SortScope
  // esistente riordinerebbe un'altra tabella.
  const renderMilitaryIconHeaders = (sped: boolean = showSpedColumns) => {
    type Col = [string, "atk" | "def", "red" | "blue"];
    const block = (icons: [string, string, string, string], section: string, sigma: boolean) => {
      const cols: Col[] = [[icons[0], "atk", "red"], [icons[1], "def", "red"], [icons[2], "atk", "blue"], [icons[3], "def", "blue"]];
      return cols.map(([src, kind, side], i) => {
        const title = boostTitle(uiLang, kind, side, section, sigma);
        return <th key={`${section}-${i}`} className={`th-col ${i === 0 ? "section-divider" : ""}`} title={title}><TableHeaderIcon src={src} alt={title} /></th>;
      });
    };
    return (
      <>
        {!showSigmaColumns && block([iconGenAtkA, iconGenDefA, iconGenAtkD, iconGenDefD], t("sectionGeneral", uiLang), false)}
        {block([iconCampiAtkA, iconCampiDefA, iconCampiAtkD, iconCampiDefD], showSigmaColumns ? t("sectionGenPlusGbg", uiLang) : t("sectionGbg", uiLang), showSigmaColumns)}
        {sped && block([iconSpedAtkA, iconSpedDefA, iconSpedAtkD, iconSpedDefD], showSigmaColumns ? t("sectionGenPlusGe", uiLang) : t("sectionGe", uiLang), showSigmaColumns)}
      </>
    );
  };

  // Header delle colonne Generale/Campi/Spedizioni: identico nelle 3 tabelle
  // (edifici, alleati posseduti, database alleati), ma ognuna ha il proprio
  // SortScope indipendente — quindi la funzione ora richiede lo scope
  // esplicito invece di leggere sortBy/sortOrder/handleSort dallo scope
  // chiuso di App (che oggi rappresentano solo la tabella edifici).
  const renderMilitaryHeaders = (scope: SortScope, sped: boolean = showSpedColumns) => {
    const criteria = sortCriteriaByScope[scope];
    const activeSortBy = criteria[0]?.key ?? "eff";
    const activeSortOrder = criteria[0]?.order ?? "desc";
    const onSort = makeHandleSort(scope);
    return (
    <>
      {!showSigmaColumns && (
        <>
          <SortableHeader label={<TableHeaderIcon src={iconGenAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGeneral", uiLang))} />} sortKey="gen_atk_a" onClick={() => onSort("gen_atk_a")} active={activeSortBy === "gen_atk_a"} order={activeSortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGeneral", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconGenDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGeneral", uiLang))} />} sortKey="gen_def_a" onClick={() => onSort("gen_def_a")} active={activeSortBy === "gen_def_a"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGeneral", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconGenAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGeneral", uiLang))} />} sortKey="gen_atk_d" onClick={() => onSort("gen_atk_d")} active={activeSortBy === "gen_atk_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGeneral", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconGenDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGeneral", uiLang))} />} sortKey="gen_def_d" onClick={() => onSort("gen_def_d")} active={activeSortBy === "gen_def_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGeneral", uiLang))} />
        </>
      )}

      {showSigmaColumns ? (
        <>
          {/* Σ Gen + Campi/GBG: icone Campi (rosse/blu) */}
          <SortableHeader label={<TableHeaderIcon src={iconCampiAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGenPlusGbg", uiLang), true)} />} sortKey="sig_gen_campi_atk_a" onClick={() => onSort("sig_gen_campi_atk_a")} active={activeSortBy === "sig_gen_campi_atk_a"} order={activeSortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGenPlusGbg", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGenPlusGbg", uiLang), true)} />} sortKey="sig_gen_campi_def_a" onClick={() => onSort("sig_gen_campi_def_a")} active={activeSortBy === "sig_gen_campi_def_a"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGenPlusGbg", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGenPlusGbg", uiLang), true)} />} sortKey="sig_gen_campi_atk_d" onClick={() => onSort("sig_gen_campi_atk_d")} active={activeSortBy === "sig_gen_campi_atk_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGenPlusGbg", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGenPlusGbg", uiLang), true)} />} sortKey="sig_gen_campi_def_d" onClick={() => onSort("sig_gen_campi_def_d")} active={activeSortBy === "sig_gen_campi_def_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGenPlusGbg", uiLang), true)} />
        </>
      ) : (
        <>
          <SortableHeader label={<TableHeaderIcon src={iconCampiAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGbg", uiLang))} />} sortKey="gbg_atk_a" onClick={() => onSort("gbg_atk_a")} active={activeSortBy === "gbg_atk_a"} order={activeSortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGbg", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGbg", uiLang))} />} sortKey="gbg_def_a" onClick={() => onSort("gbg_def_a")} active={activeSortBy === "gbg_def_a"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGbg", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGbg", uiLang))} />} sortKey="gbg_atk_d" onClick={() => onSort("gbg_atk_d")} active={activeSortBy === "gbg_atk_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGbg", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGbg", uiLang))} />} sortKey="gbg_def_d" onClick={() => onSort("gbg_def_d")} active={activeSortBy === "gbg_def_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGbg", uiLang))} />
        </>
      )}

      {sped && !showSigmaColumns && (
        <>
          <SortableHeader label={<TableHeaderIcon src={iconSpedAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGe", uiLang))} />} sortKey="sped_atk_a" onClick={() => onSort("sped_atk_a")} active={activeSortBy === "sped_atk_a"} order={activeSortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGe", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGe", uiLang))} />} sortKey="sped_def_a" onClick={() => onSort("sped_def_a")} active={activeSortBy === "sped_def_a"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGe", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGe", uiLang))} />} sortKey="sped_atk_d" onClick={() => onSort("sped_atk_d")} active={activeSortBy === "sped_atk_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGe", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGe", uiLang))} />} sortKey="sped_def_d" onClick={() => onSort("sped_def_d")} active={activeSortBy === "sped_def_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGe", uiLang))} />
        </>
      )}
      {sped && showSigmaColumns && (
        <>
          {/* Σ Gen + Sped/GE: icone Spedizioni (rosse/blu) */}
          <SortableHeader label={<TableHeaderIcon src={iconSpedAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGenPlusGe", uiLang), true)} />} sortKey="sig_gen_sped_atk_a" onClick={() => onSort("sig_gen_sped_atk_a")} active={activeSortBy === "sig_gen_sped_atk_a"} order={activeSortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGenPlusGe", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGenPlusGe", uiLang), true)} />} sortKey="sig_gen_sped_def_a" onClick={() => onSort("sig_gen_sped_def_a")} active={activeSortBy === "sig_gen_sped_def_a"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGenPlusGe", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGenPlusGe", uiLang), true)} />} sortKey="sig_gen_sped_atk_d" onClick={() => onSort("sig_gen_sped_atk_d")} active={activeSortBy === "sig_gen_sped_atk_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGenPlusGe", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGenPlusGe", uiLang), true)} />} sortKey="sig_gen_sped_def_d" onClick={() => onSort("sig_gen_sped_def_d")} active={activeSortBy === "sig_gen_sped_def_d"} order={activeSortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGenPlusGe", uiLang), true)} />
        </>
      )}
    </>
    );
  };

  const getSortValue = (b: Building & { currentEff: number }, key: SortKey): number | string => {
    switch (key) {
      case "name": return b.name;
      case "size": return b.area;
      case "road": return b.road;
      case "pop": return b.pop;
      case "fel": return b.fel;
      case "eff": return b.currentEff;
      case "ally_level": return 0;
      case "gen_atk_a": return b.general[0] + moltOrd(b, "all", 0);
      case "gen_def_a": return b.general[1] + moltOrd(b, "all", 1);
      case "gen_atk_d": return b.general[2] + moltOrd(b, "all", 2);
      case "gen_def_d": return b.general[3] + moltOrd(b, "all", 3);
      case "gbg_atk_a": return b.gbg[0] + moltOrd(b, "battleground", 0);
      case "gbg_def_a": return b.gbg[1] + moltOrd(b, "battleground", 1);
      case "gbg_atk_d": return b.gbg[2] + moltOrd(b, "battleground", 2);
      case "gbg_def_d": return b.gbg[3] + moltOrd(b, "battleground", 3);
      case "sped_atk_a": return b.sped[0] + moltOrd(b, "guild_expedition", 0);
      case "sped_def_a": return b.sped[1] + moltOrd(b, "guild_expedition", 1);
      case "sped_atk_d": return b.sped[2] + moltOrd(b, "guild_expedition", 2);
      case "sped_def_d": return b.sped[3] + moltOrd(b, "guild_expedition", 3);
      case "sig_gen_campi_atk_a": return b.general[0] + b.gbg[0] + moltOrd(b, "battleground", 0) + moltOrd(b, "all", 0);
      case "sig_gen_campi_def_a": return b.general[1] + b.gbg[1] + moltOrd(b, "battleground", 1) + moltOrd(b, "all", 1);
      case "sig_gen_campi_atk_d": return b.general[2] + b.gbg[2] + moltOrd(b, "battleground", 2) + moltOrd(b, "all", 2);
      case "sig_gen_campi_def_d": return b.general[3] + b.gbg[3] + moltOrd(b, "battleground", 3) + moltOrd(b, "all", 3);
      case "sig_gen_sped_atk_a": return b.general[0] + b.sped[0] + moltOrd(b, "guild_expedition", 0) + moltOrd(b, "all", 0);
      case "sig_gen_sped_def_a": return b.general[1] + b.sped[1] + moltOrd(b, "guild_expedition", 1) + moltOrd(b, "all", 1);
      case "sig_gen_sped_atk_d": return b.general[2] + b.sped[2] + moltOrd(b, "guild_expedition", 2) + moltOrd(b, "all", 2);
      case "sig_gen_sped_def_d": return b.general[3] + b.sped[3] + moltOrd(b, "guild_expedition", 3) + moltOrd(b, "all", 3);
      case "iq_mon_b": return b.iqMonB;
      case "iq_mat_b": return b.iqMatB;
      case "iq_mon": return b.iqMon;
      case "iq_mat": return b.iqMat;
      case "iq_atk_a": return b.iq[0] + moltOrd(b, "guild_raids", 0);
      case "iq_def_a": return b.iq[1] + moltOrd(b, "guild_raids", 1);
      case "iq_atk_d": return b.iq[2] + moltOrd(b, "guild_raids", 2);
      case "iq_def_d": return b.iq[3] + moltOrd(b, "guild_raids", 3);
      case "iq_beni": return b.iqBeni;
      case "iq_truppe": return b.iqTruppe;
      case "iq_azioni": return b.iqAzioni;
      case "iq_cap": return b.iqCap;
      case "mon": return b.mon;
      case "mat": return b.mat;
      case "fp": return b.fp;
      case "fpb": return b.fpb;
      case "med": return b.med;
      case "fur": return b.fur;
      case "tr": return b.tr;
      case "trne": return b.trne;
      case "beni": return b.beni;
      case "benip": return b.benip;
      case "benis": return b.benis;
      case "benisp": return b.benisp;
      case "benispb": return b.benispb;
      case "benib": return b.benib;
      case "benig": return b.benig;
      case "bp": return b.bp;
      case "fsp": return b.fsp;
      case "tpm": return b.tpm;
      case "tpb": return b.tpb;
      case "adm": return b.adm;
      case "mod": return b.mod;
      case "rin": return b.rin;
      case "imm": return b.imm;
    }
  };


  useEffect(() => {
    localStorage.setItem(DEFENSE_KEY, generalDefense.toString());
    localStorage.setItem(SPED_ENABLED_KEY, spedizioniEnabled.toString());
    localStorage.setItem(SPED_ATTACK_KEY, spedizioniAttack.toString());
    localStorage.setItem(SIGMA_KEY, showSigmaColumns.toString());
    localStorage.setItem(BONUS_GE_KEY, bonusGeTabella.toString());
    localStorage.setItem(POP_COLUMN_KEY, showPopColumn.toString());
    localStorage.setItem(FEL_COLUMN_KEY, showFelColumn.toString());
    localStorage.setItem(IQ_PROD_COLUMNS_KEY, showIqProdColumns.toString());
    localStorage.setItem(PROD_COLUMNS_KEY, showProdColumnsPref.toString());
    localStorage.setItem(SPED_COLUMNS_KEY, showSpedColumnsPref.toString());
  }, [generalDefense, spedizioniEnabled, spedizioniAttack, showSigmaColumns, bonusGeTabella, showPopColumn, showFelColumn, showIqProdColumns, showProdColumnsPref, showSpedColumnsPref]);

  // Pulizia chiavi orfane al mount (una volta sola)
  useEffect(() => {
    if (isStorageOutdated()) {
      setIsOutdatedModalOpen(true);
    } else {
      cleanupOrphanedKeys();
    }
  }, []);

  // Handle imperativo del planner Pirati (vedi PiratiToolHandle): permette a
  // handleWandClick di smistare l'import lì quando activeTab === "pirati",
  // invece di creare un profilo città/inventario — un solo pulsante bacchetta
  // in tutta l'app, nessuna icona duplicata dentro PiratiTool.
  const piratiToolRef = useRef<PiratiToolHandle | null>(null);

  const handleWandClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    // Ramo Pirati: se siamo sulla tab "pirati", la bacchetta popola SOLO il
    // planner dell'Insediamento (nessun profilo città/inventario creato/
    // toccato). Lettura appunti dedicata: il payload cultural_outpost non
    // passa da validateBookmarkletData (schema diverso, vedi bookmarklet.ts).
    if (activeTab === "pirati") {
      let text: string;
      try {
        text = await navigator.clipboard.readText();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "NotAllowedError") {
          alert(t("clipboardPermissionDeniedAlert", uiLang));
        } else {
          alert(t("clipboardReadErrorAlert", uiLang));
        }
        return;
      }
      if (!text) {
        alert(t("clipboardEmptyAlert", uiLang));
        return;
      }
      // Esito (successo/errore) mostrato SOLO dal toast interno di PiratiTool
      // (importMessage, testo colorato nella toolbar): nessun alert() qui,
      // sarebbe un doppione dello stesso messaggio.
      piratiToolRef.current?.importFromClipboardText(text);
      return;
    }

    // 1) Legge e valida i dati dalla clipboard PRIMA di creare il profilo.
    //    Se manca anche solo uno dei 5 blocchi attesi, mostra un alert e termina
    //    senza toccare i profili esistenti.
    let parsed: unknown;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        alert(t("clipboardEmptyAlert", uiLang));
        return;
      }
      try {
        parsed = JSON.parse(text);
      } catch {
        // Causa precisa (senza mostrare il contenuto degli appunti): vedi diagnosiClipboard.
        const tipo = diagnosiClipboard(text);
        alert(
          tipo === "script" ? t("clipboardNotJsonScript", uiLang)
          : tipo === "troncato" ? t("clipboardNotJsonTruncated", uiLang, text.length)
          : tipo === "url" ? t("clipboardNotJsonUrl", uiLang)
          : t("clipboardNotJsonOther", uiLang, text.length)
        );
        return;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        alert(t("clipboardPermissionDeniedAlert", uiLang));
      } else {
        alert(t("clipboardReadErrorAlert", uiLang));
      }
      return;
    }

    const validationError = validateBookmarkletData(parsed);
    if (validationError) {
      alert(
        validationError.code === "MISSING_FIELDS"
          ? t("bookmarkletMissingFields", uiLang, validationError.missingFields.join(", "))
          : t("bookmarkletInvalidFormat", uiLang)
      );
      return;
    }
    // A questo punto `parsed` rispetta lo schema BookmarkletData (validato sopra).
    await importaPayload(parsed as BookmarkletData);
  };

  /** Crea o aggiorna una città dal payload (bacchetta o, 2.0, file JSON:
   *  `daJson` = città "ridotta", vedi data/cittaDaJson.ts). */
  const importaPayload = async (data: BookmarkletData, daJson = false) => {
    // 2) Dati validi (2.0): crea o AGGIORNA la città (data/citta.ts). Stessa
    // città = stesso player_id (o, per quelle salvate prima della 2.0, stesso
    // nome): si aggiorna invece di crearne una nuova. Città visitata = solo la
    // mappa; se corrisponde a una città MIA (es. la propria città vista da un
    // altro giocatore), si aggiorna solo la mappa e resta "mia".
    const info = infoImport(data);
    // Città da JSON (città "ridotta"): aggiorna solo un'altra città da JSON
    // dello stesso giocatore, mai una città importata con la bacchetta.
    // Somiglianza con una città salvata (stessi edifici negli stessi posti):
    // distingue le città dello stesso giocatore su mondi diversi quando una
    // delle due non ha ancora il mondo (vedi trovaCitta).
    const impronta = improntaCitta(Object.values(data.CityMapData ?? {}).map(e => ({ entityId: String(e.cityentity_id ?? ""), x: Number(e.x ?? 0), y: Number(e.y ?? 0), type: e.type })));
    const somiglianza = (c: Profile) => {
      if (!impronta.size) return 0;
      const salvata = improntaCitta(initCityStore(c.id)?.cityMapBuildings ?? []);
      let comuni = 0;
      for (const k of impronta) if (salvata.has(k)) comuni++;
      return comuni / impronta.size;
    };
    const trovata = trovaCitta(profiles, info, somiglianza);
    const esistente = daJson && trovata && trovata.origine !== "json" ? undefined : trovata;
    const haInventario = (pid: string) => !!localStorage.getItem(profileStorageKey(pid, "inventory"));
    const tipoFinale: TipoCitta = !daJson && esistente && tipoCitta(esistente, haInventario) === "mia" ? "mia" : info.tipo;
    const soloCitta = info.tipo === "visitata";
    const id = esistente?.id ?? `p_${Date.now()}`;
    let name: string;
    // nome = lettera del mondo · giocatore ("L · Sdrushi"), se il mondo è noto;
    // un nome scelto dall'utente (rinominaCitta) resta
    const nomeInfo = info.nome ? nomeCitta(info.nome, info.mondo ?? esistente?.mondo ?? null) : null;
    if (esistente) name = esistente.nomeUtente ? esistente.name : nomeInfo ?? esistente.name;
    else if (nomeInfo) {
      // collisione col nome di un'altra città: "Nome 2", "Nome 3", ...
      const existingNames = new Set(profiles.map(p => p.name));
      name = nomeInfo;
      for (let suffix = 2; existingNames.has(name); suffix++) name = `${nomeInfo} ${suffix}`;
    } else name = t("defaultProfileName", uiLang, profiles.length + 1);
    const newProfile: Profile = { id, name, tipo: tipoFinale, ...(daJson ? { origine: "json" as const } : {}), ...(esistente?.nomeUtente ? { nomeUtente: true as const } : {}),
      ...(info.playerId !== null ? { playerId: info.playerId } : esistente?.playerId !== undefined ? { playerId: esistente.playerId } : {}),
      ...(info.mondo ? { mondo: info.mondo } : esistente?.mondo ? { mondo: esistente.mondo } : {}),
      ...(() => { const a = sanitizePortraitUrl(data.portraitUrl) || esistente?.avatar; return a ? { avatar: a } : {}; })() };
    const updated = esistente ? profiles.map(p => (p.id === id ? newProfile : p)) : [...profiles, newProfile];
    // copia degli slot di una città esistente, per ripristinarla se l'import fallisce
    const slotPrima = esistente ? PROFILE_SLOTS.map(slot => [slot, localStorage.getItem(profileStorageKey(id, slot))] as const) : null;
    setProfiles(updated);
    writeStoredJson(PROFILES_KEY, updated);
    // Ricorda il profilo precedente per il rollback in caso di errore.
    const previousProfileId = activeProfileId;
    setActiveProfileId(id);
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    loadProfileData(id);

    // 3) Importa nel nuovo profilo nell'ordine: città → alleati → inventario.
    try {
      await handleImportAll(data, id, soloCitta);
      setAvvisoCitta(esistente ? t("r2CityUpdated", uiLang, name) : t(tipoFinale === "visitata" ? "r2CityAddedVisited" : "r2CityAdded", uiLang, name));
      // Import riuscito: se il bookmarklet usato è più vecchio di quello
      // attuale (_v assente = versione "pre-versionamento", trattata come 0),
      // mostriamo un modale (non un semplice alert, dalla v3 in poi: c'è
      // abbastanza da spiegare — supporto Forge Hammer, città di altri
      // giocatori — da meritare lo stesso trattamento del modale "Aggiornamento
      // richiesto" invece di un alert nativo del browser) che spiega di
      // eliminare la vecchia bacchetta e trascinarne una nuova.
      const usedVersion = typeof data._v === "number" ? data._v : 0;
      if (daJson) {
        // città da JSON: niente avvisi sulla bacchetta
      } else if (usedVersion < CURRENT_BOOKMARKLET_VERSION) {
        setIsBookmarkletOutdatedModalOpen(true);
      } else {
        // v5+: l'helper non ha esposto alcune sezioni (struttura cambiata dopo un
        // suo aggiornamento): l'import è andato a buon fine ma è incompleto.
        // 'avatar' (cosmetico), 'outpost' (riguarda solo la tab Pirati) e 'castle'
        // (l'helper può non aver ancora ricevuto i dati del castello) esclusi.
        const diag = readPayloadDiagnostics(data);
        const missing = diag.warnings.filter((w) => w !== "avatar" && w !== "outpost" && w !== "castle");
        if (missing.length > 0) {
          const helper = [diag.helperName, diag.helperVersion].filter(Boolean).join(" ") || "?";
          alert(t("bookmarkletWarningsAlert", uiLang, missing.join(", "), helper));
        }
      }
    } catch (err) {
      // L'import ha fallito DOPO che il profilo era già stato creato: può
      // capitare in caso di dati parziali che superano la validazione iniziale
      // ma che causano errori durante il processing (es. formato inventory
      // inatteso). Facciamo rollback: rimuoviamo il profilo appena creato e
      // ripristiniamo quello precedente, così lo stato non resta a metà.
      console.error("[FOE] Errore durante l'import, rollback profilo:", err);
      const rolledBack = profiles; // `profiles` è ancora quello pre-creazione (closure)
      setProfiles(rolledBack);
      writeStoredJson(PROFILES_KEY, rolledBack);
      // Città nuova: via le chiavi parziali. Città esistente: si rimettono i suoi dati di prima.
      PROFILE_SLOTS.forEach(slot => {
        try { localStorage.removeItem(profileStorageKey(id, slot)); } catch { /* ignorato: pulizia best-effort */ }
      });
      slotPrima?.forEach(([slot, v]) => { if (v !== null) try { localStorage.setItem(profileStorageKey(id, slot), v); } catch { /* best-effort */ } });
      // Ripristina il profilo precedente
      setActiveProfileId(previousProfileId);
      if (previousProfileId) {
        localStorage.setItem(ACTIVE_PROFILE_KEY, previousProfileId);
        loadProfileData(previousProfileId);
      } else {
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
      }
      alert(t("importErrorAlert", uiLang, (err instanceof Error ? err.message : String(err))));
    }
  };


  // 2.0: elenco delle città per il selettore (tipo dedotto per quelle salvate prima della 2.0)
  const vociCitta = useMemo(() => profiles.map(p => ({ id: p.id, nome: p.name, daJson: p.origine === "json",
    tipo: tipoCitta(p, (pid) => !!localStorage.getItem(profileStorageKey(pid, "inventory"))),
    avatar: sanitizePortraitUrl(p.avatar) || null })),
  // storageVersion: il tipo legge localStorage (non reattivo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [profiles, storageVersion]);
  const chiudiAvviso = useCallback(() => setAvvisoCitta(null), []);
  // Città salvate prima di questa versione: l'avatar non è nell'elenco. Quando
  // la città è aperta (avatar letto dal suo slot) lo si copia nell'elenco.
  useEffect(() => {
    if (!portraitUrl) return;
    const p = profiles.find(x => x.id === activeProfileId);
    if (!p || p.avatar === portraitUrl) return;
    const updated = profiles.map(x => (x.id === p.id ? { ...x, avatar: portraitUrl } : x));
    setProfiles(updated);
    writeStoredJson(PROFILES_KEY, updated);
  }, [portraitUrl, activeProfileId, profiles]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // selectedIds è condiviso tra tutte le tab (Città/Inventario/Database): un
  // singolo Set di id selezionati, non scoped per tab. Senza questo reset,
  // una selezione fatta in una tab resterebbe visibile (e nel conteggio del
  // pulsante Export) anche passando a un'altra tab dove quegli id non hanno
  // alcun significato. Si azzera sempre, ad ogni cambio tab.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const visibleIds = filteredBuildings.map(b => b.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      }
    });
  };

  const handleCityRowClick = useCallback((building: ProcessedBuilding) => {
    if (activeTab !== "propria_citta") return;
    if (!building.cityEntityId) return;
    // Righe iniettate dal toggle "Mostra anche Inventario": non sono
    // istanze reali piazzate in città, il click di selezione (usato per il
    // confronto era) non ha senso su di esse.
    if (building._isMergedInventory) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(building.id)) next.delete(building.id);
      else next.add(building.id);
      return next;
    });
  }, [activeTab]);

  const exportSelectedAsCsv = () => {
    const selectedBuildings = filteredBuildings.filter(b => selectedIds.has(b.id));
    if (selectedBuildings.length === 0) return;

    const header = [
      "CityEntityId", "Building", "Eff", "Size", "Road", "Pop", "Fel",
      "GenAtk_A", "GenDef_A", "GenAtk_D", "GenDef_D",
      "CampiAtk_A", "CampiDef_A", "CampiAtk_D", "CampiDef_D",
      "SpedAtk_A", "SpedDef_A", "SpedAtk_D", "SpedDef_D",
      "IQAtk_A", "IQDef_A", "IQAtk_D", "IQDef_D",
      "IQmon", "IQmonB", "IQmat", "IQmatB",
      "IQBeni", "IQTruppe", "IQAzioni", "IQCap",
      "Mon", "Mat", "PF", "PFB", "Med", "FUR", "TR", "TRNE", "Beni", "BeniP", "BeniS", "BeniSp", "BeniSpB", "BeniB", "BeniG", "BP", "FSP", "TPM", "TPB", "ADM", "MOD", "RIN", "IMM",
    ];
    const rows = selectedBuildings.map(b => [
      b.cityEntityId, b.name, b.currentEff, b.size, b.road, b.pop, b.fel,
      b.general[0], b.general[1], b.general[2], b.general[3],
      b.gbg[0], b.gbg[1], b.gbg[2], b.gbg[3],
      b.sped[0], b.sped[1], b.sped[2], b.sped[3],
      b.iq[0], b.iq[1], b.iq[2], b.iq[3],
      b.iqMon, b.iqMonB, b.iqMat, b.iqMatB,
      b.iqBeni, b.iqTruppe, b.iqAzioni, b.iqCap,
      b.mon, b.mat, b.fp, b.fpb, b.med, b.fur, b.tr, b.trne, b.beni, b.benip, b.benis, b.benisp, b.benispb, b.benib, b.benig, b.bp, b.fsp, b.tpm, b.tpb, b.adm, b.mod, b.rin, b.imm,
    ]);

    const escapeCsv = (val: string | number) => {
      let s: string;
      if (typeof val === "number") {
        s = Number.isInteger(val) ? val.toString() : val.toString().replace(".", ",");
      } else {
        s = String(val ?? "");
      }
      if (s.includes(";") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvText = [header, ...rows]
      .map(row => row.map(escapeCsv).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `foe-export-${localDateStamp()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  // Cache dei searchName nella lingua corrente della GUI. Si invalida solo al
  // cambio lingua (uiLang), non ad ogni render — evita di ricalcolare
  // centinaia di toLowerCase() ad ogni spostamento degli slider di weights.
  const buildingSearchNames = useMemo(
    () => new Map(BUILDINGS_FROM_CSV.map(b => [b.cityEntityId, displayName(b.cityEntityId, b.name, uiLang).toLowerCase()])),
    [uiLang]
  );

  // ── Override ERA CORRENTE per Città e Inventario ──────────────────────────
  // Sostituisce TUTTI i valori (boost militari/IQ, pop/fel e ogni produzione:
  // FP, beni, monete, materiali, reward speciali...) con quelli reali dell'era
  // corrente del giocatore, estratti da CityEntities all'import. I dettagli
  // sono nel commento dentro la funzione.
  const applyEraStats = useCallback(function <T extends Building>(b: T): T {
    if (eraStats.size === 0 || !b.cityEntityId) return b;
    // GE e fallback hanno già i valori corretti (dai dati di gioco). Le
    // decorazioni invece NON sono escluse: alcune (i placeholder "edificio
    // non attivo", es. W_*Decoration) hanno Fel/Pop reali in CityEntities e
    // devono ricevere lo stesso override di qualsiasi altro edificio. Le
    // vere decorazioni decorative (nessun dato in CityEntities) non hanno
    // un'entry in eraStats: il "if (!stats) return b" sotto le lascia
    // correttamente a zero (valore base già nel CSV), senza bisogno di
    // un'esclusione esplicita.
    if (b.isGreatBuilding || b.isFallback) return b;
    const stats = eraStats.get(b.cityEntityId);
    if (!stats) return b;
    // Override COMPLETO con i valori dell'era corrente del giocatore: boost,
    // popolazione/felicità e tutte le produzioni (beni, FP, truppe, blueprint,
    // reward speciali). Il CSV resta usato solo per la scheda Info. Le produzioni
    // estratte da CityEntities sostituiscono quelle del CSV (che sono fissate a
    // FALLBACK_ERA, oggi Stellar Age: Discovery) così le ere intermedie sono precise.
    return conStatsEra(b, stats);
  }, [eraStats]);

  const processedBuildings = useMemo<ProcessedBuilding[]>(() => {
    // I Grandi Edifici (X_*) sono presenti anche in buildings.csv, ma la
    // fonte autoritativa per loro resta processedGreatBuildings: usa le
    // statistiche reali da greatBuildingsJson (livello, FP, bonus) invece di
    // quelle "di catalogo" del CSV. Includerli anche qui creerebbe un
    // duplicato visibile in tabella.
    // Le decorazioni (W_*Decoration) invece sono ora trattate come edifici
    // normali del catalogo: tutte le loro righe nel CSV hanno valori a zero
    // (sono "non attive" per definizione), quindi non serve più una fonte
    // separata con placeholder.
    return BUILDINGS_FROM_CSV.filter(b => !b.isGreatBuilding).map(b => ({
      ...b,
      currentEff: calculateEfficiency(b, weights),
      searchName: buildingSearchNames.get(b.cityEntityId) ?? "",
    }));
  }, [weights, buildingSearchNames]);

  // Catalogo › Grandi Edifici: una riga per GE (forma, strada, immagine e nomi
  // da buildings.csv) con le statistiche al livello scelto (geBonus.statisticheGe).
  const processedGeCatalogo = useMemo<ProcessedBuilding[]>(() => {
    if (!datiGe) return [];
    return BUILDINGS_FROM_CSV.filter(b => b.isGreatBuilding && datiGe.edifici[b.cityEntityId]).map(b => {
      const s = statisticheGe(datiGe.edifici[b.cityEntityId]!, livelloGe, uiLang);
      const { livello: _l, tier, ...stat } = s;
      const gb: Building = { ...b, ...stat, gbTier: tier,
        ...(stat.gbMoltiplicativi.length ? {} : { gbMoltiplicativi: undefined }), ...(stat.gbAltri.length ? {} : { gbAltri: undefined }) };
      return { ...gb, currentEff: calculateEfficiency(gb, weights), searchName: buildingSearchNames.get(b.cityEntityId) ?? "" };
    });
  }, [datiGe, livelloGe, uiLang, weights, buildingSearchNames]);

  const processedGreatBuildings = useMemo<ProcessedBuilding[]>(() => {
    return Array.from(greatBuildingsJson.values())
      .map(gb => {
        // L'hash immagine dei GE vive nel CSV (buildings.csv), non nel JSON
        // importato: lo recuperiamo dalla stessa lookup usata per l'hover
        // mappa, così getImageUrl funziona identico a qualsiasi altro edificio.
        const csvHash = BUILDING_BY_ID.get(gb.entityId)?.hash ?? "";
        return BuildingModel.fromGreatBuilding(gb, ITALIAN_NAMES, csvHash);
      })
      .map((b) => ({
        ...b,
        currentEff: calculateEfficiency(b, weights),
        // searchName iniziale nella lingua GUI: per la tab database questo è
        // il valore finale; per le tab gioco viene comunque sovrascritto da
        // eraAdjustedSource con gameLang (vedi quel useMemo per i dettagli).
        searchName: displayName(b.cityEntityId, b.name, uiLang).toLowerCase(),
      }));
  }, [greatBuildingsJson, weights, uiLang]);

  const processedFallbackBuildings = useMemo<ProcessedBuilding[]>(() => {
    return Array.from(fallbackBuildings.values()).map(b => ({
      ...b,
      currentEff: calculateEfficiency(b, weights),
      searchName: displayName(b.cityEntityId, b.name, uiLang).toLowerCase(),
    }));
  }, [fallbackBuildings, weights, uiLang]);

  const processedBuildingsMap = useMemo(() => {
    const map = new Map<string, ProcessedBuilding>();
    processedBuildings.forEach(b => { if (b.cityEntityId) map.set(b.cityEntityId, b); });
    return map;
  }, [processedBuildings]);

  // ── NUOVO: FamilyResult dall'optimizer (rimpiazza la vecchia logica KIT SEL.) ──
  const familyResults = useMemo<FamilyResult[]>(() => {
    const hasData = inventoryMatched.size > 0 || inventoryUnmatched.size > 0 ||
      inventorySelectionKits.size > 0 || inventoryUpgradeKits.size > 0;
    if (!hasData) return [];

    // Re-inizializza gli indici dei kit nella lingua corrente, così i nomi di
    // famiglia (derivati dai nomi dei kit) sono localizzati. initKitData è
    // idempotente e poco costoso (~2ms); viene rieseguito solo quando cambia
    // l'inventario o la lingua, non a ogni render.
    initKitData(KIT_RAW, gameLang);

    // invBld: edifici "fisici" in inventario (matched + unmatched dal gioco)
    const invBld = new Map<string, number>();
    inventoryMatched.forEach((e) => invBld.set(e.cityEntityId, e.inStock));
    inventoryUnmatched.forEach((e) => invBld.set(e.cityEntityId, e.inStock));

    // invUpg/invSel: kit con quantità
    const invUpg = new Map<string, number>();
    inventoryUpgradeKits.forEach((e) => invUpg.set(e.kitId, e.inStock));
    const invSel = new Map<string, number>();
    inventorySelectionKits.forEach((e) => invSel.set(e.kitId, e.inStock));

    return computeAllFamilies(invUpg, invSel, invBld);
  }, [inventoryMatched, inventoryUnmatched, inventorySelectionKits, inventoryUpgradeKits, gameLang]);

  // Estensione di ProcessedBuilding con i metadati usati solo nella tab Inventario.
  // Helper: building placeholder per edifici non presenti nel CSV.
  const placeholderBuilding = useCallback((bldId: string, name: string): InventoryRowBuilding => {
    return {
      id: `placeholder-${bldId}`, name, names: { it: name, en: name }, hash: "", cityEntityId: bldId,
      time: 0, size: "?", area: 0, road: 0, roadLvl: 0, pop: 0, fel: 0,
      general: [0,0,0,0], gbg: [0,0,0,0], sped: [0,0,0,0], iq: [0,0,0,0],
      iqMonB: 0, iqMatB: 0, iqMon: 0, iqMat: 0,
      iqBeni: 0, iqTruppe: 0, iqAzioni: 0, iqCap: 0, ally: 0, allyType: "",
      fp: 0, fpb: 0, med: 0, fur: 0, tr: 0, trne: 0,
      beni: 0, benip: 0, benis: 0, benisp: 0, benispb: 0, benib: 0, benig: 0, mon: 0, mat: 0,
      bp: 0, fsp: 0, tpm: 0, tpb: 0, adm: 0, mod: 0, rin: 0, imm: 0,
      fragments: "", isGreatBuilding: false, isInactive: false,
      isFallback: true, isUnresolved: true, isMilitary: false,
      currentEff: 0, searchName: name.toLowerCase(),
    };
  }, []);

  // Risolve la "base" di una riga inventario nell'ordine: (1) edificio dal CSV
  // se presente; (2) fallback costruito da CityEntities all'import (dati reali
  // dell'era: dimensioni, pop, felicità, boost att/dif/IQ — produzioni escluse);
  // (3) placeholder vuoto (badge UNKNOWN) solo se nessuna delle precedenti.
  // Risolve il problema degli edifici come il Laghetto Lunare, presenti solo in
  // inventario e non nel CSV, che prima mostravano sempre UNKNOWN.
  const resolveInventoryBase = useCallback((bldId: string, name: string): InventoryRowBuilding => {
    const csvBase = processedBuildingsMap.get(bldId);
    if (csvBase) return { ...csvBase };
    const fb = fallbackBuildings.get(bldId);
    if (fb) {
      // fb proviene da fromCityEntity: ha già dati completi (boost + produzioni
      // per l'era corrente) e isFallback=false, quindi niente "?" nelle celle.
      return {
        ...fb,
        name: fb.name || name,
        currentEff: calculateEfficiency(fb, weights),
        searchName: (fb.name || name).toLowerCase(),
      };
    }
    return placeholderBuilding(bldId, name);
  }, [processedBuildingsMap, fallbackBuildings, weights, placeholderBuilding]);

  // Appiattisce i FamilyResult in ProcessedBuilding[] per la tabella inventario.
  // Include anche gli elementi in inventario (matched + unmatched) che non fanno
  // parte di una catena (es. santuari, torri, pozzi, GE).
  const processedInventoryKitBuildings = useMemo<ProcessedBuilding[]>(() => {
    const rows: InventoryRowBuilding[] = [];
    const consumedInvIds = new Set<string>();
    const rowKeys = new Set<string>();
    let inventoryOrder = 0;

    const pushInventoryRow = (row: InventoryRowBuilding, key: string) => {
      if (rowKeys.has(key)) return;
      rowKeys.add(key);
      row._inventoryOrder = inventoryOrder++;
      rows.push(row);
    };
    const kitKey = (kits: string[]) => {
      const counts = new Map<string, number>();
      kits.forEach((kitId) => counts.set(kitId, (counts.get(kitId) ?? 0) + 1));
      return Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kitId, count]) => `${kitId}x${count}`)
        .join("+");
    };

    for (const family of familyResults) {
      // invRows: edifici già in inventario (con o senza upgrade già applicati)
      for (const row of family.invRows) {
        consumedInvIds.add(row.sourceId);
        const bldId = row.id;
        const name = ITALIAN_NAMES.get(bldId) ?? bldId;
        const b: InventoryRowBuilding = resolveInventoryBase(bldId, name);
        const rowKey = `row|${family.root}|${bldId}|${row.sourceId}|${row.sourceLv}|${row.level}|${kitKey(row.kitsUsed)}`;
        b.id = rowKey;
        b.isFromKit = row.kitsUsed.length > 0;
        b.kitCount = row.qty;
        b._invBadge = row.kitsUsed.length === 0 ? "INV" : "INV_UPGRADED";
        b._fabKitsUsed = row.kitsUsed;
        b._fabSourceId = row.sourceId;
        b._fabSourceLv = row.sourceLv;
        b._invLevel = row.level;
        b._invIsMax = row.is_max;
        b._familyName = family.name;
        pushInventoryRow(b, rowKey);
      }
      // output: edifici costruibili da zero (o upgrading da inventory non-max)
      for (const out of family.output) {
        for (const bldId of out.ids) {
          const name = ITALIAN_NAMES.get(bldId) ?? bldId;
          const b: InventoryRowBuilding = resolveInventoryBase(bldId, name);
          const rowKey = `out|${family.root}|${bldId}|${out.level}|${out.ids.join(",")}|${kitKey(out.kitsUsed)}`;
          b.id = rowKey;
          b.isFromKit = true;
          b.kitCount = out.qty;
          b._invBadge = "FAB";
          b._fabKitsUsed = out.kitsUsed;
          b._invLevel = out.level;
          b._invIsMax = out.is_max;
          b._fabChoices = out.ids.length > 1 ? out.ids : null;
          b._familyName = family.name;
          pushInventoryRow(b, rowKey);
        }
      }
    }

    // Aggiungi gli item normali presenti in inventario che non fanno parte
    // di una catena gestita dall'optimizer.
    const addStandaloneInv = (entry: InventoryEntry) => {
      const bldId = entry.cityEntityId;
      if (consumedInvIds.has(bldId)) return;
      const name = entry.name ?? (ITALIAN_NAMES.get(bldId) ?? bldId);
      const b: InventoryRowBuilding = resolveInventoryBase(bldId, name);
      const rowKey = `std|${bldId}`;
      b.id = rowKey;
      b.isFromKit = false;
      b.kitCount = entry.inStock;
      b._invBadge = "INV";
      pushInventoryRow(b, rowKey);
    };

    inventoryMatched.forEach(addStandaloneInv);
    inventoryUnmatched.forEach(addStandaloneInv);

    return rows;
  }, [familyResults, inventoryMatched, inventoryUnmatched, resolveInventoryBase]);

  // Lista "raw": edifici così come sono nell'inventario, senza ottimizzazione kit.
  // Usata quando "SOLO EDIFICI PRONTI" è attivo.
  // ── Planner, "Modifica città": edifici aggiungibili ────────────────────────
  // Inventario: le righe della tab Inventario (edifici posseduti e costruibili
  // dai kit, al livello calcolato dall'ottimizzatore), una per edificio con le
  // copie sommate. Database: tutto il catalogo raggruppato per famiglia (catena
  // di upgrade di kit.json → livelli). Strada: dal catalogo (richiede / non
  // richiede); "due corsie" solo se lo stesso edificio in città lo dice (il
  // catalogo non ha il livello di strada).
  const plannerCandidati = useMemo<CandidatiPlanner>(() => {
    const dueCorsie = new Map<string, number>();
    for (const b of cityMapBuildings) if ((b.roadLevel ?? 0) >= 2) dueCorsie.set(b.entityId, b.roadLevel ?? 2);
    const roadDi = (id: string, road: number) => dueCorsie.get(id) ?? (road > 0 ? 1 : 0);
    const militare = (id: string, flag?: boolean) => !!flag || id.startsWith("M_");
    const inv = new Map<string, CandidatoPlanner>();
    for (const b of processedInventoryKitBuildings as InventoryRowBuilding[]) {
      const d = dimensioniDaSize(b.size);
      if (!d || !b.cityEntityId || b.isUnresolved) continue;
      const q = b.kitCount ?? 1;
      const c = inv.get(b.cityEntityId);
      if (c) { c.qty = (c.qty ?? 0) + q; continue; }
      inv.set(b.cityEntityId, {
        entityId: b.cityEntityId, name: displayName(b.cityEntityId, b.name, gameLang), ...d, roadLevel: roadDi(b.cityEntityId, b.road),
        isGreatBuilding: !!b.isGreatBuilding, isMilitary: militare(b.cityEntityId, b.isMilitary), qty: q,
        ...(b._invLevel ? { level: b._invLevel } : {}),
      });
    }
    const famiglie = new Map<string, FamigliaPlanner>();
    for (const b of BUILDINGS_FROM_CSV) {
      const id = b.cityEntityId;
      if (!id || id.startsWith("H_") || id.startsWith("S_")) continue;
      const d = dimensioniDaSize(b.size);
      if (!d) continue;
      const level = chainInfo(id)?.level;
      const c: CandidatoPlanner = {
        entityId: id, name: displayName(id, b.name, uiLang), ...d, roadLevel: roadDi(id, b.road),
        isGreatBuilding: !!b.isGreatBuilding, isMilitary: militare(id, b.isMilitary), ...(level ? { level } : {}),
      };
      const key = level ? radiceCatena(id) : id;
      const f = famiglie.get(key);
      if (f) f.livelli.push(c);
      else famiglie.set(key, { key, name: "", livelli: [c], isGreatBuilding: c.isGreatBuilding });
    }
    for (const f of famiglie.values()) {
      f.livelli.sort((a, b) => (a.level ?? 1) - (b.level ?? 1) || a.name.localeCompare(b.name));
      f.name = senzaLivello(f.livelli[f.livelli.length - 1]!.name);
    }
    const efficienza = new Map<string, number>();
    for (const b of [...processedBuildings, ...processedGreatBuildings]) if (b.cityEntityId) efficienza.set(b.cityEntityId, b.currentEff);
    return {
      inventario: [...inv.values()].sort((a, b) => a.name.localeCompare(b.name)),
      database: [...famiglie.values()].sort((a, b) => a.name.localeCompare(b.name)),
      efficienza,
    };
  }, [cityMapBuildings, processedInventoryKitBuildings, processedBuildings, processedGreatBuildings, gameLang, uiLang]);

  const processedInventoryRawBuildings = useMemo<ProcessedBuilding[]>(() => {
    const rows: InventoryRowBuilding[] = [];
    const addRaw = (entry: InventoryEntry) => {
      const bldId = entry.cityEntityId;
      const name = entry.name ?? (ITALIAN_NAMES.get(bldId) ?? bldId);
      const b: InventoryRowBuilding = resolveInventoryBase(bldId, name);
      b.id = `raw-${bldId}`;
      b.isFromKit = false;
      b.kitCount = entry.inStock;
      // Nessuno _invBadge: l'edificio appare normalmente senza evidenziazione verde
      rows.push(b);
    };
    inventoryMatched.forEach(addRaw);
    inventoryUnmatched.forEach(addRaw);
    return rows;
  }, [inventoryMatched, inventoryUnmatched, resolveInventoryBase]);

  // Inventario › filtri Era e Beni dell'era: le copie possedute per edificio
  // (InventoryEntry.ere da item.level, con le statistiche alla loro era).
  // (era 1 = Età del bronzo esclusa: sono edifici di tutte le ere, utente 07/11)
  const copieInventario = useMemo(() => {
    const m = new Map<string, CopiaEra[]>();
    const aggiungi = (e: InventoryEntry) => {
      const c = Object.entries(e.ere ?? {}).map(([k, n]) => ({ era: Number(k), n, stats: e.statsEra?.[Number(k)] })).filter(x => x.era !== 1);
      if (c.length) m.set(e.cityEntityId, c);
    };
    inventoryMatched.forEach(aggiungi);
    inventoryUnmatched.forEach(aggiungi);
    return m;
  }, [inventoryMatched, inventoryUnmatched]);
  const ereInventario = useMemo(() => [...new Set([...copieInventario.values()].flatMap(c => c.map(x => x.era)))].sort((a, b) => a - b), [copieInventario]);
  /** Colonna di beni di una copia (all'era `era`) che dà beni dell'era `x`, o null. */
  const colonnaBeniEra = (s0: Pick<EraStats, "beni" | "benip" | "benis"> | undefined, era: number, x: number): "beni" | "benip" | "benis" | null =>
    !s0 ? null : era === x && s0.beni > 0 ? "beni" : era === x + 1 && s0.benip > 0 ? "benip" : era === x - 1 && s0.benis > 0 ? "benis" : null;
  const ereBeniInventario = useMemo(() => ereDeiBeni(copieInventario), [copieInventario]);
  // Città: le copie piazzate per edificio, per era (entityLevelsList), con le
  // statistiche di quell'era (entityInstanceEraStats; se tutte le copie sono
  // all'era attuale, eraStats). Esclusi GE (il "livello" è quello del GE), edifici
  // di tutte le ere, militari, ed era 1 come nell'Inventario.
  const copieCitta = useMemo(() => {
    const m = new Map<string, CopiaEra[]>();
    entityLevelsList.forEach((livelli, id) => {
      if (isGreatBuildingId(id) || isAllAgeBuildingId(id) || isMilitaryBuildingId(id)) return;
      const perEra = new Map<number, number>();
      for (const l of livelli) if (l !== 1 && AGES_BY_ID.has(l)) perEra.set(l, (perEra.get(l) ?? 0) + 1);
      if (!perEra.size) return;
      const gruppi = entityInstanceEraStats.get(id);
      m.set(id, [...perEra].map(([era, n]) => {
        const age = AGES_BY_ID.get(era)?.age;
        const g = gruppi?.find(([a]) => a === age);
        return { era, n, stats: g ? g[2] : age === currentEra ? eraStats.get(id) : undefined };
      }));
    });
    return m;
  }, [entityLevelsList, entityInstanceEraStats, eraStats, currentEra]);
  const ereCitta = useMemo(() => [...new Set([...copieCitta.values()].flatMap(c => c.map(x => x.era)))].sort((a, b) => a - b), [copieCitta]);
  const ereBeniCitta = useMemo(() => ereDeiBeni(copieCitta), [copieCitta]);
  useEffect(() => { if (eraCitta !== null && !ereCitta.includes(eraCitta)) setEraCitta(null); }, [ereCitta, eraCitta]);
  useEffect(() => { if (beniEraCitta !== null && !ereBeniCitta.includes(beniEraCitta)) setBeniEraCitta(null); }, [ereBeniCitta, beniEraCitta]);
  // (un'era sparita dopo un nuovo import: il filtro torna a "tutte")
  useEffect(() => { if (eraInventario !== null && !ereInventario.includes(eraInventario)) setEraInventario(null); }, [ereInventario, eraInventario]);
  useEffect(() => { if (beniEraInventario !== null && !ereBeniInventario.includes(beniEraInventario)) setBeniEraInventario(null); }, [ereBeniInventario, beniEraInventario]);

  const allProcessedBuildings = useMemo<ProcessedBuilding[]>(
    () => [...processedBuildings, ...processedGreatBuildings, ...processedFallbackBuildings],
    [processedBuildings, processedGreatBuildings, processedFallbackBuildings]
  );

  // outdatedBuildings: entityId originale → presente se almeno un esemplare
  // in città ha un livello (era) inferiore all'era corrente del giocatore.
  // Dichiarato PRIMA di filteredBuildings che lo usa come dipendenza.
  const currentEraId = useMemo(
    () => AGE_BY_CODE.get(currentEra)?.id ?? -1,
    [currentEra]
  );
  const outdatedBuildings = useMemo(() => {
    const out = new Set<string>();
    if (currentEraId < 0) return out;
    entityLevels.forEach((minLvl, id) => {
      if (isMilitaryBuildingId(id)) return;
      // Edifici "Tutte le ere" (un solo componente AllAge nel MainParser,
      // es. Fiamma rituale/Insediamento Sentinelle/Faro di guardia): non
      // hanno alcuna progressione per era, quindi il "livello" letto dal
      // cityMap del client non è un'era confrontabile con currentEraId —
      // segnalarli come vecchi/aggiornabili è un falso positivo (bug
      // segnalato settembre 2026, vedi isAllAgeBuildingId).
      if (isAllAgeBuildingId(id)) return;
      if (minLvl < currentEraId) out.add(id);
    });
    return out;
  }, [entityLevels, currentEraId]);

  // Sorgente base per la tab attiva. Separata dal filtro così l'override era
  // (sotto) non dipende da activeTab in modo opaco.
  const filterSourceBuildings = useMemo<ProcessedBuilding[]>(() => {
    if (activeTab === "propria_citta") {
      if (!showInventoryInCity) return allProcessedBuildings;
      // Merge Città+Inventario: stesso identico set di righe già calcolato
      // per la tab Inventario (nessun secondo giro dell'ottimizzatore — le
      // Map processedInventoryKitBuildings/processedInventoryRawBuildings
      // sono già dei useMemo indipendenti da activeTab, quindi qui si
      // riusa il risultato già pronto), marcate _isMergedInventory perché
      // il resto della pipeline (filtri, click, colore riga) le tratti
      // diversamente dalle istanze reali in città.
      const inventorySource = showOnlyReadyBuildings ? processedInventoryRawBuildings : processedInventoryKitBuildings;
      const mergedInventory = inventorySource.map(b => ({ ...b, _isMergedInventory: true as const }));
      return [...allProcessedBuildings, ...mergedInventory];
    }
    if (activeTab === "inventario") {
      // filtri Era / Beni dell'era: sempre gli edifici posseduti così come sono
      // (nella vista con i kit un edificio aggiornabile compare solo come
      // risultato dell'aggiornamento, non con la sua copia d'inventario)
      if (eraInventario !== null || beniEraInventario !== null) return processedInventoryRawBuildings;
      return showOnlyReadyBuildings ? processedInventoryRawBuildings : processedInventoryKitBuildings;
    }
    if (activeTab === "database" && catalogo === "ge") return processedGeCatalogo;
    return processedBuildings;
  }, [activeTab, allProcessedBuildings, processedInventoryRawBuildings, processedInventoryKitBuildings, processedBuildings, showOnlyReadyBuildings, showInventoryInCity, catalogo, processedGeCatalogo, eraInventario, beniEraInventario]);

  // Applica UNA VOLTA l'override era corrente (stats + nome + efficienza) per le
  // tab Città/Inventario, indipendentemente dalla ricerca. Prima questo lavoro
  // (applyEraStats + calculateEfficiency + displayName per ogni edificio) veniva
  // rifatto dentro il loop di filtro a OGNI battitura nella ricerca; ora dipende
  // solo dai dati che lo influenzano davvero. Ogni elemento porta con sé il
  // proprio `searchName` già minuscolizzato per il match della ricerca.
  // Opzioni › Bonus GE: % dei moltiplicativi dei GE della città per colonna
  // (somma dei GE dello stesso tipo): Generali × globali, Campi e Spedizioni ×
  // modalità + globali, IQ × IQ (utente, 06/11: i Generali solo coi globali)
  // Valori militari e bonus (09/11/2026, utente): un edificio che richiede la strada
  // e NON è collegato non dà nulla, né i valori fissi né (GE) i bonus moltiplicativi.
  // Copie collegate = in città − scollegate (cityEntityDisconnected conta solo chi
  // richiede strada); GE: rawEntry.connected assente = scollegato (vedi efficienza strade).
  const copieCollegate = useCallback((id: string) => Math.max(0, (cityEntityIds.get(id) || 0) - (cityEntityDisconnected.get(id) ?? 0)), [cityEntityIds, cityEntityDisconnected]);
  const geCollegato = useCallback((gb: { cityEntityId: string; road: number }) =>
    cityEntityIds.has(gb.cityEntityId) && (gb.road <= 0 || Number(greatBuildingsJson.get(gb.cityEntityId)?.rawEntry?.connected ?? 0) >= 1), [cityEntityIds, greatBuildingsJson]);
  // Alleato che conta (utente, 09/11): piazzato, non frammento, e ospitato in un edificio
  // collegato. Con i profili importati prima del 09/11 (istanzeScollegate assente) si sa
  // solo quante copie sono scollegate: l'alleato non conta se lo sono TUTTE.
  const chiaviScollegate = useMemo(() => new Set((istanzeScollegate ?? []).map(x => x[0])), [istanzeScollegate]);
  const alleatoAttivo = useCallback((a: { isPlaced: boolean; isFragment?: boolean; placedInEntityId?: string; placedInMapEntityId?: string }) => {
    if (!a.isPlaced || a.isFragment) return false;
    if (istanzeScollegate) return !(a.placedInMapEntityId && chiaviScollegate.has(a.placedInMapEntityId));
    return !(a.placedInEntityId && cityEntityIds.has(a.placedInEntityId) && copieCollegate(a.placedInEntityId) === 0);
  }, [istanzeScollegate, chiaviScollegate, cityEntityIds, copieCollegate]);

  const pctBonusGe = useMemo<ProcessedBuilding["_bonusGe"] | null>(() => {
    const p = { all: [0, 0, 0, 0], battleground: [0, 0, 0, 0], guild_expedition: [0, 0, 0, 0], guild_raids: [0, 0, 0, 0] } as Record<string, number[]>;
    for (const gb of processedGreatBuildings) {
      if (!geCollegato(gb)) continue;
      for (const m of gb.gbMoltiplicativi ?? []) { const d = p[m.modalita]; if (d) for (const i of GB_SLOT_IQ[m.tipo] ?? []) d[i]! += m.valore; }
    }
    const r = { gen: p.all!, gbg: somma4(p.battleground, p.all), sped: somma4(p.guild_expedition, p.all), iq: p.guild_raids! };
    return [...r.gen, ...r.gbg, ...r.sped, ...r.iq].some(v => v) ? r : null;
  }, [processedGreatBuildings, geCollegato]);

  // Totali militari della città per colonna, come il pannello Valori militari
  // (edifici + fallback + GE + alleati piazzati al livello reale + boost dei GE),
  // per il contributo dei moltiplicativi dei GE nella scheda Città
  const totaliMilCitta = useMemo(() => {
    type K = "general" | "gbg" | "sped" | "iq";
    const tot: Record<K, number[]> = { general: [0, 0, 0, 0], gbg: [0, 0, 0, 0], sped: [0, 0, 0, 0], iq: [0, 0, 0, 0] };
    const somma = (b: Building, n: number) => { for (const k of ["general", "gbg", "sped", "iq"] as K[]) for (let i = 0; i < 4; i++) tot[k][i]! += (b[k][i] ?? 0) * n; };
    for (const b of BUILDINGS_FROM_CSV) {
      if (b.isInactive || b.isGreatBuilding || !cityEntityIds.has(b.cityEntityId)) continue;
      somma(applyEraStats(b), copieCollegate(b.cityEntityId));
    }
    for (const b of fallbackBuildings.values()) if (cityEntityIds.has(b.cityEntityId)) somma(b, copieCollegate(b.cityEntityId));
    let boostMil = 0, boostSci = 0;
    for (const gb of processedGreatBuildings) {
      if (!geCollegato(gb)) continue;
      somma(gb, 1);
      for (const m of gb.gbMoltiplicativi ?? []) { if (m.tipo === "military_ally_boost") boostMil += m.valore; else if (m.tipo === "science_ally_boost") boostSci += m.valore; }
    }
    for (const imp of importedAllies) {
      if (!alleatoAttivo(imp)) continue;
      const a = ALLIES_BY_ID_RARITY.get(`${imp.allyId}__${imp.rarity}`);
      if (!a) continue;
      const s = Allies.getComputedAllyStats(a, imp.level + (a.allyType === "S" ? boostSci : boostMil), INHERITED_ALLIES_MAP);
      for (let i = 0; i < 4; i++) { tot.general[i]! += s.computedGeneral[i] ?? 0; tot.gbg[i]! += s.computedGbg[i] ?? 0; tot.sped[i]! += s.computedSped[i] ?? 0; tot.iq[i]! += s.computedIq[i] ?? 0; }
    }
    return tot;
  }, [cityEntityIds, applyEraStats, fallbackBuildings, processedGreatBuildings, importedAllies, copieCollegate, geCollegato, alleatoAttivo]);

  /** Contributo dei moltiplicativi di un GE (utente, 06/11): Generali = %
   *  globale × totale Generali; Campi / Spedizioni = % della modalità × (Generali +
   *  modalità) + % globale × modalità (così il Sifone conta anche su Campi e
   *  Spedizioni senza contare due volte i Generali); IQ = % IQ × totale IQ. */
  const contributoGe = useCallback((b: ProcessedBuilding): ProcessedBuilding => {
    // (GE scollegato dalla strada: nessun contributo)
    if (!b.isGreatBuilding || !b.gbMoltiplicativi?.length || !geCollegato(b)) return b;
    const m: Record<string, number[]> = { all: [0, 0, 0, 0], battleground: [0, 0, 0, 0], guild_expedition: [0, 0, 0, 0], guild_raids: [0, 0, 0, 0] };
    for (const x of b.gbMoltiplicativi) { const d = m[x.modalita]; if (d) for (const i of GB_SLOT_IQ[x.tipo] ?? []) d[i]! += x.valore; }
    const T = totaliMilCitta, r = (v: number) => Math.round(v / 100);
    const c = {
      gen: [0, 1, 2, 3].map(i => r(m.all![i]! * T.general[i]!)),
      gbg: [0, 1, 2, 3].map(i => r(m.battleground![i]! * (T.general[i]! + T.gbg[i]!) + m.all![i]! * T.gbg[i]!)),
      sped: [0, 1, 2, 3].map(i => r(m.guild_expedition![i]! * (T.general[i]! + T.sped[i]!) + m.all![i]! * T.sped[i]!)),
      iq: [0, 1, 2, 3].map(i => r(m.guild_raids![i]! * T.iq[i]!)),
    };
    if (![...c.gen, ...c.gbg, ...c.sped, ...c.iq].some(v => v)) return b;
    const nb = { ...b, _contribGe: c };
    return { ...nb, currentEff: effConContributo(nb, weights) };
  }, [totaliMilCitta, weights, geCollegato]);

  const eraAdjustedSource = useMemo<ProcessedBuilding[]>(() => {
    const isGameTab = activeTab === "propria_citta" || activeTab === "inventario";
    if (!isGameTab) {
      // Tab database: nessun override era; il nome di ricerca segue la lingua
      // scelta per la GUI (uiLang), non quella del profilo importato.
      return filterSourceBuildings.map(b => {
        const searchName = displayName(b.cityEntityId, b.name, uiLang).toLowerCase();
        return searchName === b.searchName ? b : { ...b, searchName };
      });
    }
    const pct = bonusGeTabella ? pctBonusGe : null;
    const base = filterSourceBuildings.map(b => {
      const overridden = applyEraStats(b);
      const gameName = b.cityEntityId ? gameNames.get(b.cityEntityId) : undefined;
      const resolvedName = gameName ?? displayName(b.cityEntityId, b.name, gameLang);
      if (overridden !== b || resolvedName !== b.name) {
        return {
          ...(overridden !== b ? overridden : b),
          name: resolvedName,
          searchName: resolvedName.toLowerCase(),
          currentEff: overridden !== b ? calculateEfficiency(overridden, weights) : b.currentEff,
        };
      }
      // Nessun override: assicura comunque che searchName rifletta il nome visibile.
      const searchName = resolvedName.toLowerCase();
      return searchName === b.searchName ? b : { ...b, searchName };
    });
    // scheda Città: contributo dei moltiplicativi dei GE (prima del Bonus GE, sui valori base)
    const conContributo = activeTab === "propria_citta" ? base.map(contributoGe) : base;
    const finale = pct ? conContributo.map(b => conBonusGe(b, pct, weights) ?? b) : conContributo;
    // Inventario › filtri Era / Beni dell'era: solo edifici POSSEDUTI (righe raw- di
    // Solo pronti o badge INV; quelli fatti con i kit nascono all'era attuale), una
    // riga per ogni era delle copie che soddisfa i filtri, con i valori di quell'era
    // (stessa cosa nella Città, sulle copie piazzate: una riga per era, ×N copie di quell'era)
    const inCitta = activeTab === "propria_citta";
    if (!inCitta && activeTab !== "inventario") return finale;
    const fEra = inCitta ? eraCitta : eraInventario, fBeni = inCitta ? beniEraCitta : beniEraInventario;
    if (fEra === null && fBeni === null) return finale;
    const copie = inCitta ? copieCitta : copieInventario;
    const out: ProcessedBuilding[] = [];
    for (const b of finale) {
      if (inCitta ? b._isMergedInventory : !b.id.startsWith("raw-")) continue; // (Inventario: sorgente processedInventoryRawBuildings, vedi filterSourceBuildings)
      for (const c of copie.get(b.cityEntityId) ?? []) {
        if (fEra !== null && c.era !== fEra) continue;
        const col = fBeni !== null ? colonnaBeniEra(c.stats, c.era, fBeni) : null;
        if (fBeni !== null && !col) continue;
        const nb = c.stats ? conStatsEra(b, c.stats) : b;
        out.push({ ...nb, id: `${b.id}@${c.era}`, kitCount: c.n, currentEff: c.stats ? calculateEfficiency(nb, weights) : b.currentEff,
          _eraCopia: c.era, ...(col ? { _beniEvid: col } : {}) });
      }
    }
    return out;
  }, [filterSourceBuildings, activeTab, applyEraStats, gameNames, gameLang, uiLang, weights, bonusGeTabella, pctBonusGe, contributoGe, eraInventario, beniEraInventario, copieInventario, eraCitta, beniEraCitta, copieCitta]);

  const filteredBuildings = useMemo(() => {
    const sourceBuildings: ProcessedBuilding[] = eraAdjustedSource;

    const isIdSearch = deferredSearch.startsWith("\\");
    const deferredSearchLower = isIdSearch
      ? deferredSearch.slice(1).toLowerCase()
      : deferredSearch.toLowerCase();
    // Più ricerche separate da virgola (OR): "boutique, provviste" mostra gli
    // edifici che contengono l'una O l'altra (per confrontarli). Vale anche per
    // gli id: "\W_A, \W_B" (il "\" davanti a ogni parte è facoltativo).
    const searchTerms = deferredSearchLower.split(",").map(t => t.trim().replace(/^\\/, "")).filter(Boolean);
    const prodFilterKeys = currentFilters.prodFilter.size > 0 ? [...currentFilters.prodFilter] : null;
    const prodNoKeys = currentFilters.prodNo.size > 0 ? [...currentFilters.prodNo] : null;

    // Pre-compute minEff once outside the loop
    const minEffVal = currentFilters.minEff
      ? parseFloat(currentFilters.minEff.replace(",", "."))
      : NaN;
    const hasMinEff = !isNaN(minEffVal);

    // Pre-compute boolean flags once to avoid repeated property access in the hot loop
    const isPropriacitta = activeTab === "propria_citta";
    const isInventario = activeTab === "inventario";
    // Caselle di categoria (2.0): basta soddisfarne UNA (OR); nessuna = tutti.
    const categorie = currentFilters.categorie;
    const hasEventFilter = !!(currentFilters.showEventFilter && currentEventFilter);
    const isAndMode = currentFilters.prodFilterMode === "AND";

    // Single-pass filter — avoids 4 intermediate arrays from chained .filter()
    const filtered: ProcessedBuilding[] = [];
    for (const b of sourceBuildings) {
      // (2.0: niente più LIGHT/FULL, il Database mostra tutti gli edifici.)


      // 1. Tab-specific membership check
      if (isPropriacitta) {
        // Le righe iniettate dal toggle "Mostra anche Inventario" non sono
        // istanze piazzate: saltano il check di appartenenza alla città
        // (altrimenti verrebbero escluse qui, prima ancora di arrivare ai
        // filtri sotto — sono già pre-filtrate dall'optimizer, stesso
        // ramo "else if (isInventario)" qui sotto).
        if (!b._isMergedInventory && !b.isGreatBuilding) {
          if (!b.cityEntityId || !importedCityEntityLookup.has(b.cityEntityId)) continue;
        }
      } else if (isInventario) {
        // Tutti i building in processedInventoryKitBuildings sono già pre-filtrati
        // dall'optimizer: non serve ulteriore membership check.
        // (filtri Era / Beni dell'era: già applicati in eraAdjustedSource)
        // Nascondi › Pronti: via le righe già in inventario (INV), restano quelle da fare con i kit
        if (statoPronti === 1 && (b as InventoryRowBuilding)._invBadge === "INV") continue;
        // Filtri › Invecchiabili: colonna del CSV (pipeline) o calcolo della città
        if (soloInvecchiabiliInv && !(b.invecchiabile || (!!b.cityEntityId && declassableBuildings.has(b.cityEntityId)))) continue;
      }

      // L'override era e il nome visibile sono già stati applicati in
      // eraAdjustedSource; `b.searchName` riflette già il nome mostrato.
      const visibleNameForSearch = b.searchName;

      // 2. Search: per nome (default) o per CityEntityId (prefisso \).
      if (searchTerms.length) {
        const testo = isIdSearch ? (b.cityEntityId?.toLowerCase() ?? "") : visibleNameForSearch;
        if (!searchTerms.some(t => testo.includes(t))) continue;
      }

      // 3. Declassabili (solo tab Città). Le righe merged da Inventario non sono
      // istanze piazzate, quindi vengono escluse quando il filtro è attivo.
      if (isPropriacitta && showOnlyDeclassable && (b._isMergedInventory || (b.cityEntityId && !declassableBuildings.has(b.cityEntityId)))) continue;
      // Database › Invecchiabili (catalogo Edifici)
      if (activeTab === "database" && catalogo !== "ge" && soloInvecchiabiliDb && !b.invecchiabile) continue;
      // Catalogo › Grandi Edifici: solo la ricerca (niente filtri né Nascondi /
      // Mostra solo, che restano impostati per il catalogo Edifici)
      // (solo nel Database: il catalogo scelto resta "ge" anche andando in Città/Inventario)
      if (activeTab === "database" && catalogo === "ge") {
        if (tierGe === "tutti" || datiGe?.edifici[b.cityEntityId]?.tierMax === tierGe) filtered.push(b);
        continue;
      }
      // "Nascondi / Mostra solo" (2.0, tre stati): non accelerabili 🚫 e
      // auto aggiornabili ^.
      const tri = currentFilters.tri;
      if (scartaTri(tri.nonAcc, noRush(b))) continue;
      if (scartaTri(tri.autoAge, isEraMutable(b))) continue;
      // Filtri slot alleati / frammenti: disponibili anche in tab Inventario
      // (pulsanti presenti in entrambe le barre), non solo in Città.

      // 4. Limited ascended filter
      if (scartaTri(tri.limitati, b.time > 0)) continue;

      // 5. Toggle filters (no array spread — direct property checks)
      const hasIQ = b.iq[0] !== 0 || b.iq[1] !== 0 || b.iq[2] !== 0 || b.iq[3] !== 0 || b.iqMonB !== 0 || b.iqMatB !== 0 || b.iqMon !== 0 || b.iqMat !== 0 || b.iqBeni !== 0 || b.iqTruppe !== 0 || b.iqAzioni !== 0 || b.iqCap !== 0;
      if (scartaTri(tri.iq, hasIQ)) continue;
      // Slot alleato: in Città/Inventario gli slot reali dell'edificio
      // (allySlotsPerBuilding), nel Database la colonna Ally del CSV.
      if (scartaTri(tri.alleati, (isPropriacitta || isInventario) ? !!b.cityEntityId && allySlotsPerBuilding.has(b.cityEntityId) : b.ally > 0)) continue;
      if (scartaTri(tri.frammenti, !!b.cityEntityId && FRAGMENTS_PRODUCED.has(b.cityEntityId))) continue;
      // Richiede strada (fabbisogno stradale della colonna "strada" > 0)
      if (scartaTri(tri.strada, b.road > 0)) continue;
      if (scartaTri(tri.aiuto, b.adm > 0)) continue;
      if (scartaTri(tri.immagazzina, b.imm > 0)) continue;
      if (scartaTri(tri.ge, !!b.isGreatBuilding)) continue;

      // 6. Advanced filters
      if (hasMinEff && b.currentEff <= minEffVal) continue;

      if (categorie.size > 0 && !(
        (categorie.has("insediamenti") && isSettlementPrize(b.cityEntityId)) ||
        (categorie.has("premi_campi") && isBattlegroundsPrizeId(b.cityEntityId)) ||
        (categorie.has("premi_iq") && isQuantumIncursionsPrizeId(b.cityEntityId))
      )) continue;
      if (hasEventFilter && !buildingMatchesEvent(b.cityEntityId, currentEventFilter)) continue;

      // Filtri produzione (2.006): ogni riquadro è una condizione, verde =
      // "la produce", rosso = "non la produce"; Almeno un filtro = OR, Tutti i
      // filtri = AND (tutti rossi + Tutti i filtri = edifici che non producono nulla di quelle).
      if (prodFilterKeys || prodNoKeys) {
        const produce = (k: string) => { const v = b[k as keyof typeof b]; return typeof v === "number" && v > 0; };
        const prodMatch = isAndMode
          ? (prodFilterKeys ?? []).every(produce) && !(prodNoKeys ?? []).some(produce)
          : (prodFilterKeys ?? []).some(produce) || (prodNoKeys ?? []).some(k => !produce(k));
        if (!prodMatch) continue;
      }

      filtered.push(b);
    }

    // In-place sort — avoids the triple map()→sort()→map() pattern (2 extra array allocations)
    const isDecSort = isPropriacitta && !manualSortTabs.propria_citta;
    filtered.sort((a, b) => {
      if (isDecSort) {
        const rankDiff = Number(!!b.isInactive) - Number(!!a.isInactive);
        if (rankDiff !== 0) return rankDiff;
      }
      for (let i = 0; i < sortCriteria.length; i++) {
        const criterion = sortCriteria[i];
        const va = getSortValue(a, criterion.key);
        const vb = getSortValue(b, criterion.key);
        let cmp: number;
        if (typeof va === "string") {
          cmp = (va as string).localeCompare(vb as string);
        } else {
          cmp = (va as number) - (vb as number);
        }
        if (cmp !== 0) return criterion.order === "desc" ? -cmp : cmp;
      }
      return 0;
    });

    return filtered;
  }, [eraAdjustedSource, deferredSearch, sortCriteria, currentFilters, currentEventFilter, activeTab, importedCityEntityLookup, manualSortTabs, showOnlyDeclassable, declassableBuildings, soloInvecchiabiliDb, statoPronti, soloInvecchiabiliInv, allySlotsPerBuilding, catalogo, tierGe, datiGe]);

  // Direzione mappa -> tabella della stessa corrispondenza biunivoca di
  // handleCityRowClick. A differenza di quella, qui NON si esclude
  // GE/militari/inattivi: in mappa sono comunque cliccabili (decisione
  // esplicita, diversa dal comportamento del click sulla riga). Un singolo
  // cityEntityId può corrispondere a più righe (copie multiple): selezioniamo
  // o deselezioniamo TUTTE insieme, così il risultato è prevedibile anche
  // con più copie dello stesso edificio.
  const handleMapBuildingClick = useCallback((entityId: string) => {
    const matchingIds = filteredBuildings
      .filter((b) => b.cityEntityId === entityId)
      .map((b) => b.id);
    if (matchingIds.length === 0) return;
    setSelectedIds((prev) => {
      const allSelected = matchingIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        matchingIds.forEach((id) => next.delete(id));
      } else {
        matchingIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [filteredBuildings]);

  // 2.0 (fix scorrimento a scatti): prima il blocco anti-rimbalzo durava un
  // solo frame, ma l'evento di scroll "di ritorno" dell'altro elemento arriva
  // spesso dopo: riscriveva la posizione vecchia sulla barra mentre la si
  // trascinava (movimento a scatti) e interrompeva lo scorrimento animato del
  // clic sulla parte vuota della barra (solo un piccolo spostamento). Ora
  // guida l'elemento su cui l'utente ha agito per ultimo (pointerdown, rotella,
  // tocco, tasti: vedi guidaScroll), senza timer: un timer scaduto a metà di
  // uno scorrimento animato lasciava passare l'eco e la barra non arrivava
  // più in fondo / all'inizio. Gli eventi dell'altro elemento sono solo eco.
  const syncBuildingTableScroll = (source: "table" | "floating") => {
    const tableScroller = buildingTableScrollRef.current;
    const floatingScroller = buildingTableFloatingScrollRef.current;
    if (!tableScroller || !floatingScroller) return;
    if (guidaScrollTabella.current === null) guidaScrollTabella.current = source;
    if (guidaScrollTabella.current !== source) return; // eco dell'altro elemento
    const [da, a] = source === "table" ? [tableScroller, floatingScroller] : [floatingScroller, tableScroller];
    if (Math.abs(a.scrollLeft - da.scrollLeft) >= 1) a.scrollLeft = da.scrollLeft;
  };
  /** Eventi che dicono su quale elemento l'utente sta agendo: quello diventa la guida. */
  const guidaScroll = (source: "table" | "floating") => {
    const prendi = () => { guidaScrollTabella.current = source; };
    return { onPointerDown: prendi, onWheel: prendi, onTouchStart: prendi, onKeyDown: prendi };
  };

  useEffect(() => {
    const tableScroller = buildingTableScrollRef.current;
    if (!tableScroller) return;

    const updateMetrics = () => {
      const rect = tableScroller.getBoundingClientRect();
      const nextMetrics = {
        scrollWidth: tableScroller.scrollWidth,
        clientWidth: tableScroller.clientWidth,
        left: rect.left,
      };
      setBuildingTableScrollMetrics((previous) => {
        if (
          previous.scrollWidth === nextMetrics.scrollWidth &&
          previous.clientWidth === nextMetrics.clientWidth &&
          Math.round(previous.left) === Math.round(nextMetrics.left)
        ) {
          return previous;
        }
        return nextMetrics;
      });
      if (buildingTableFloatingScrollRef.current) {
        buildingTableFloatingScrollRef.current.scrollLeft = tableScroller.scrollLeft;
      }
    };

    updateMetrics();
    const rafId = requestAnimationFrame(updateMetrics);
    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(tableScroller);
    if (tableScroller.firstElementChild) resizeObserver.observe(tableScroller.firstElementChild);
    window.addEventListener("resize", updateMetrics);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [
    activeTab,
    filteredBuildings.length,
    showProdColumns,
    showPopColumn,
    showFelColumn,
    showSpedColumns,
    // Anche questi due cambiano il numero di colonne (e quindi scrollWidth):
    // il ResizeObserver sul <table> coprirebbe comunque il cambio di
    // larghezza, ma tenerli allineati agli altri toggle di colonne evita
    // di dipendere solo dall'observer (e da buildingTableNeedsScroll deriva
    // lo sticky: meglio due segnali che uno).
    showSigmaColumns,
    showIqProdColumns,
    // (catalogo dei GE: colonne diverse)
    catalogo,
  ]);

  // Verticale su mobile: niente sticky sulla colonna nome anche se lo
  // scroll orizzontale servirebbe — in verticale lo spazio è già così
  // stretto che il blocco fisso (checkbox+occhio+nome, ~260px) copre gran
  // parte dello schermo e lascia vedere pochissime colonne dati (segnalato
  // dall'utente: "in verticale non si vede praticamente niente"). Rilevato
  // via aspect ratio (viewport più alto che largo), non un breakpoint in
  // px: un telefono ruotato in landscape ha innerWidth grande ma resta lo
  // stesso schermo piccolo — l'aspect ratio è invariante rispetto alla
  // rotazione fisica, un breakpoint px no. matchMedia + listener "change"
  // invece di un resize handler dedicato: il browser notifica solo quando
  // il valore booleano cambia davvero (nessun throttling da gestire a
  // mano, a differenza del ResizeObserver sopra che legge px esatti).
  const [isPortraitNarrow, setIsPortraitNarrow] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(orientation: portrait)").matches
  );
  useEffect(() => {
    const mql = window.matchMedia("(orientation: portrait)");
    const update = () => setIsPortraitNarrow(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const wrapper = buildingTableWrapperRef.current;
    if (!wrapper) {
      setIsBuildingTableVisible(false);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsBuildingTableVisible(entry.isIntersecting);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [activeTab]);

  const highlightedCityEntityIds = useMemo(() => {
    if (activeTab !== "propria_citta") return new Set<string>();
    const set = new Set<string>();
    filteredBuildings.forEach((building) => {
      if (selectedIds.has(building.id) && building.cityEntityId) {
        set.add(building.cityEntityId);
      }
    });
    return set;
  }, [activeTab, filteredBuildings, selectedIds]);

  const filteredAllies = useMemo(() => {
    // Come per gli edifici: più ricerche separate da virgola (OR).
    const searchParts = deferredSearch.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    const result: Array<Allies.ComputedAllyStats & typeof ALLIES_FROM_CSV[0] & { level: number; currentEff: number }> = [];

    for (const ally of ALLIES_FROM_CSV) {
      // Search filter (hoisted out of inner loops)
      if (searchParts.length) {
        const nome = allyName(ally.id, gameLang).toLowerCase();
        if (!searchParts.some(s => nome.includes(s))) continue;
      }

      // Rarity filter
      if (allyRarityFilters[ally.rarity] === false) continue;

      // Tipo (2.0): militare / scienza
      if (ally.allyType === "S" ? !mostraScienza : !mostraMilitari) continue;


      const level = ALLY_DB_LEVEL;
      const { computedGeneral, computedGbg, computedSped, computedIq, computedPf, computedBeni, computedBeniP } = Allies.getComputedAllyStats(ally, level, INHERITED_ALLIES_MAP);

      // Nessun filtro "zero-stats": rimosso deliberatamente (agosto 2026).
      // Escludeva silenziosamente gli alleati "science" (Fibonacci, Indradevi,
      // Ernest Shackleton — allyType="science" in Allies.txt/MainParser) le cui
      // colonne Gen/Campi/Sped/IQ sono TUTTE vuote nel CSV: la loro abilità
      // reale non è ancora estratta dalla pipeline (probabilmente legata a
      // StellarAgeDiscovery), ma questo non è un motivo per nasconderli dal
      // database — l'utente vuole vedere tutti gli alleati del gioco, punto.

      // Inline efficiency — avoids a second getComputedAllyStats call inside calculateAllyEfficiency
      const currentEff =
        computedGeneral[0] * weights.general[0] + computedGeneral[1] * weights.general[1] +
        computedGeneral[2] * weights.general[2] + computedGeneral[3] * weights.general[3] +
        computedGbg[0] * weights.gbg[0] + computedGbg[1] * weights.gbg[1] +
        computedGbg[2] * weights.gbg[2] + computedGbg[3] * weights.gbg[3] +
        computedSped[0] * weights.sped[0] + computedSped[1] * weights.sped[1] +
        computedSped[2] * weights.sped[2] + computedSped[3] * weights.sped[3] +
        computedIq[0] * weights.iq[0] + computedIq[1] * weights.iq[1] +
        computedIq[2] * weights.iq[2] + computedIq[3] * weights.iq[3];

      result.push({ ...ally, level, computedGeneral, computedGbg, computedSped, computedIq, computedPf, computedBeni, computedBeniP, currentEff });
    }

    // Cache locale dei nomi alleati per evitare O(N log N) chiamate a allyName
    // durante il sort. Ogni id viene risolto una sola volta per render.
    const nameCache = new Map<string, string>();
    const getName = (id: string) => {
      let n = nameCache.get(id);
      if (n === undefined) { n = allyName(id, gameLang); nameCache.set(id, n); }
      return n;
    };

    result.sort((a, b) => compareAllies(a, b, sortCriteriaAlleatiDb, getName));

    return result;
  }, [deferredSearch, sortCriteriaAlleatiDb, weights, allyRarityFilters, mostraMilitari, mostraScienza, gameLang]);



  // Boost agli alleati dei GE della città (Prestige, tier Oro): livelli in più
  // per tutti gli alleati militari (Colosseo) e scienza (Tempio del Loto), anche
  // oltre il 100 (utente: +10 = un alleato al 100 vale come al 110)
  const boostAlleati = useMemo(() => {
    let militari = 0, scienza = 0;
    for (const b of processedGreatBuildings) if (geCollegato(b)) for (const m of b.gbMoltiplicativi ?? []) {
      if (m.tipo === "military_ally_boost") militari += m.valore;
      else if (m.tipo === "science_ally_boost") scienza += m.valore;
    }
    return { militari, scienza };
  }, [processedGreatBuildings, geCollegato]);

  const processedImportedAllies = useMemo(() => {
    if (importedAllies.length === 0) return [];

    const searchParts = deferredSearch.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);

    const result: Array<
      Allies.ComputedAllyStats & typeof ALLIES_FROM_CSV[0] & {
        jsonId: number;
        level: number;
        isPlaced: boolean;
        isFragment: boolean;
        fragmentCount: number;
        currentEff: number;
        placedInEntityId?: string;
        placedInMapEntityId?: string;
        /** Livelli in più dai GE (Colosseo / Tempio del Loto), già nelle statistiche. */
        boostLivello: number;
      }
    > = [];
    for (const imp of importedAllies) {
      const csvAlly = ALLIES_BY_ID_RARITY.get(`${imp.allyId}__${imp.rarity}`);
      if (!csvAlly) continue;

      // Search filter (hoisted — avoids .toLowerCase() per ally inside .filter())
      const nameLC = allyName(csvAlly.id, gameLang).toLowerCase();
      const idLC = csvAlly.id.toLowerCase();
      if (searchParts.length && !searchParts.some(s => nameLC.includes(s) || idLC.includes(s))) continue;

      // Rarity filter
      if (allyRarityFilters[csvAlly.rarity] !== true) continue;
      // Tipo (2.0): militare / scienza; Frammenti: alleati frammentati
      if (csvAlly.allyType === "S" ? !mostraScienza : !mostraMilitari) continue;
      if (imp.isFragment && !mostraFrammentiAlleati) continue;

      // Opzione "Livello 100" (2.0): statistiche come a livello massimo.
      const livello = alleatiLivello100 ? ALLY_DB_LEVEL : imp.level;
      // statistiche al livello + boost dei GE (Colosseo / Tempio del Loto)
      const boost = csvAlly.allyType === "S" ? boostAlleati.scienza : boostAlleati.militari;
      const { computedGeneral, computedGbg, computedSped, computedIq, computedPf, computedBeni, computedBeniP } = Allies.getComputedAllyStats(csvAlly, livello + boost, INHERITED_ALLIES_MAP);

      // Inline efficiency — avoids second getComputedAllyStats call inside calculateAllyEfficiency
      const currentEff =
        computedGeneral[0] * weights.general[0] + computedGeneral[1] * weights.general[1] +
        computedGeneral[2] * weights.general[2] + computedGeneral[3] * weights.general[3] +
        computedGbg[0] * weights.gbg[0] + computedGbg[1] * weights.gbg[1] +
        computedGbg[2] * weights.gbg[2] + computedGbg[3] * weights.gbg[3] +
        computedSped[0] * weights.sped[0] + computedSped[1] * weights.sped[1] +
        computedSped[2] * weights.sped[2] + computedSped[3] * weights.sped[3] +
        computedIq[0] * weights.iq[0] + computedIq[1] * weights.iq[1] +
        computedIq[2] * weights.iq[2] + computedIq[3] * weights.iq[3];

      // Zero-stats filter (skip non-fragments with all-zero stats — include
      // computedIq E computedPf/Beni/BeniP: un alleato "science" posseduto
      // come Fibonacci non deve sparire solo perché non ha boost di
      // combattimento — produce PF/Beni, non zero).
      const isFragment = imp.isFragment ?? false;
      if (!isFragment) {
        if (
          computedGeneral[0] === 0 && computedGeneral[1] === 0 && computedGeneral[2] === 0 && computedGeneral[3] === 0 &&
          computedGbg[0] === 0 && computedGbg[1] === 0 && computedGbg[2] === 0 && computedGbg[3] === 0 &&
          computedSped[0] === 0 && computedSped[1] === 0 && computedSped[2] === 0 && computedSped[3] === 0 &&
          computedIq[0] === 0 && computedIq[1] === 0 && computedIq[2] === 0 && computedIq[3] === 0 &&
          computedPf === 0 && computedBeni === 0 && computedBeniP === 0
        ) continue;
      }

      result.push({
        ...csvAlly,
        jsonId: imp.jsonId,
        level: livello,
        boostLivello: boost,
        isPlaced: imp.isPlaced,
        isFragment,
        fragmentCount: imp.fragmentCount ?? 0,
        currentEff,
        placedInEntityId: imp.placedInEntityId,
        placedInMapEntityId: imp.placedInMapEntityId,
        computedGeneral,
        computedGbg,
        computedSped,
        computedIq,
        computedPf,
        computedBeni,
        computedBeniP,
      });
    }

    // Cache locale dei nomi alleati per evitare O(N log N) chiamate a allyName
    // durante il sort. Ogni id viene risolto una sola volta per render.
    const nameCache = new Map<string, string>();
    const getName = (id: string) => {
      let n = nameCache.get(id);
      if (n === undefined) { n = allyName(id, gameLang); nameCache.set(id, n); }
      return n;
    };

    result.sort((a, b) => {
      const primary = compareAllies(a, b, sortCriteriaAlleatiOwn, getName);
      if (primary !== 0) return primary;
      // Criterio secondario: ordina per rarità (Comune → … → Leggendario)
      const rankA = a.rarity;
      const rankB = b.rarity;
      return rankA - rankB;
    });

    return result;
  }, [importedAllies, deferredSearch, sortCriteriaAlleatiOwn, weights, allyRarityFilters, mostraMilitari, mostraScienza, mostraFrammentiAlleati, alleatiLivello100, gameLang, boostAlleati]);

  // Larghezza minima della tabella edifici in base alle colonne attive.
  // Con table-fixed il browser può comprimere le colonne sotto il loro min-w
  // se la tabella stessa non ha una larghezza minima sufficiente — specialmente
  // su tablet/mobile dove il viewport è più stretto. Calcolandola dinamicamente
  // forziamo la scrollbar orizzontale invece di schiacciare la colonna nome.
  // Campi confrontabili per il popup "se aggiorni": icone iniettate una volta.
  const DIFF_FIELDS = useMemo(() => buildDiffFields({
    iconPop, iconFel, iconGenAtkA, iconGenDefA, iconGenAtkD, iconGenDefD,
    iconCampiAtkA, iconCampiDefA, iconCampiAtkD, iconCampiDefD,
    iconSpedAtkA, iconSpedDefA, iconSpedAtkD, iconSpedDefD,
    iconIQAtkA, iconIQDefA, iconIQAtkD, iconIQDefD,
    iconIQMonB, iconIQMatB, iconIQMon, iconIQMat,
    iconIQBeni, iconIQTruppe, iconIQAzioni, iconIQCap,
    iconMon, iconMat, iconFP, iconFPB, iconMed, iconFUR, iconTR, iconTRNE,
    iconBeni, iconBeniP, iconBeniS, iconBeniB, iconBeniG, iconBP,
    iconOneUp, iconImm, iconRinn, iconAiuto,
    iconBeniSp, iconBeniSpB, iconFSP, iconTPM, iconTPB,
  }), []);

  // Riepilogo aggregato "se TUTTI gli edifici vecchi venissero aggiornati":
  // stesso identico calcolo per-edificio del tooltip "SE AGGIORNI A [Era]"
  // (righe 1297-1320 sopra), ma sommato su OGNI edificio di outdatedBuildings
  // invece di uno solo, e senza raggruppare per era di provenienza — qui
  // interessa solo il totale per campo su tutta la città (scelta esplicita
  // dell'utente: un numero solo per statistica, non un blocco per era).
  // Parametrizzata sul "to" (i valori target): due varianti richieste
  // dall'utente, "era corrente del giocatore" e "ultima era gestita dal
  // tool" (FALLBACK_ERA, oggi Stellar Age: Discovery — si aggiorna da sola
  // aggiungendo una riga in ages.csv, nessun hardcoding). Per l'era corrente il "to" è quello
  // già in b (allProcessedBuildings, via applyEraStats). Per FALLBACK_ERA il
  // "to" viene invece da BUILDING_BY_ID: i valori grezzi del CSV sono per
  // costruzione quelli dell'ultima era gestita (BOOST_ERA lato pipeline
  // Python) — nessun ricalcolo, nessuna nuova struttura dati/stato persistito
  // (idea dell'utente: "i valori della tab Database sono già quelli dell'era
  // massima, basta confrontare gli ID").
  // Arrotondamento a 2 decimali sui totali PESATI (from/to * count sommati su
  // molte copie): senza di esso valori frazionari (es. boost % non interi)
  // accumulano rumore floating-point visibile (es. "1.2000000000000002"),
  // difetto che il tooltip per-edificio non ha mai (lì somma sempre UNA sola
  // istanza alla volta, valori "puliti" dal JSON).
  const round2 = (v: number) => Math.round(v * 100) / 100;
  // useCallback (non una semplice funzione locale): serve un riferimento
  // stabile tra render per poterla mettere nelle deps di outdatedSummary
  // sotto senza invalidare il useMemo a ogni render (altrimenti l'eslint
  // warning "missing dependency" andrebbe silenziato ignorandolo, oppure
  // buildOutdatedSummary ricreata ogni volta romperebbe la memoizzazione).
  const buildOutdatedSummary = useCallback((targetEraId: number, getTo: (b: ProcessedBuilding) => { [k: string]: unknown }) => {
    if (targetEraId < 0 || outdatedBuildings.size === 0) {
      return {
        totalBuildings: 0, totalCopies: 0,
        totals: [] as Array<{ field: DiffField; from: number; to: number }>,
        unchanged: [] as Array<{ field: DiffField; from: number; to: number }>,
      };
    }
    const sums = new Map<string, { from: number; to: number }>();
    let totalCopies = 0;
    for (const b of allProcessedBuildings) {
      if (!b.cityEntityId || !outdatedBuildings.has(b.cityEntityId)) continue;
      const groups = entityInstanceEraStats.get(b.cityEntityId);
      if (!groups) continue;
      const bRec = getTo(b);
      // ⚠️ "to" è il valore FISSO di questo edificio all'era target (uguale
      // per ogni copia, non varia per gruppo era di provenienza) — va
      // moltiplicato per il TOTALE delle copie obsolete dell'edificio e
      // sommato UNA sola volta, non una volta per ogni gruppo era del loop
      // sotto. Bug reale corretto in questo giro: sommare "to * count"
      // dentro il loop sui gruppi faceva contare "to" più volte per gli
      // edifici con copie sparse su più ere diverse (es. 3 copie a IronAge +
      // 2 a BronzeAge → "to" sommato 2 volte invece di 1), gonfiando il
      // totale rispetto alla somma reale delle singole righe in tabella
      // (bug segnalato dall'utente: campo FSP con totale "to" più alto della
      // somma dei 5 edifici visibili in città).
      let buildingCopies = 0;
      for (const [eraAge, count] of groups) {
        const eraId = AGE_BY_CODE.get(eraAge)?.id ?? -1;
        if (eraId < 0 || eraId >= targetEraId) continue; // solo copie di ere più vecchie del target
        buildingCopies += count;
      }
      if (buildingCopies === 0) continue;
      totalCopies += buildingCopies;
      // Somma SEMPRE "from" per ogni campo (nessun filtro from!==to qui):
      // stesso pattern di fullCitySummaryToFallback, per poter poi separare
      // i campi che cambiano da quelli che restano invariati (richiesta
      // esplicita dell'utente: mostrare anche le statistiche che NON
      // variano, in una sezione a parte del pannello).
      for (const [eraAge, count, stats] of groups) {
        const eraId = AGE_BY_CODE.get(eraAge)?.id ?? -1;
        if (eraId < 0 || eraId >= targetEraId) continue;
        const oldRec = stats as unknown as { [k: string]: unknown };
        for (const f of DIFF_FIELDS) {
          const from = f.get(oldRec);
          const entry = sums.get(f.key) ?? { from: 0, to: 0 };
          entry.from += from * count; // "from" varia per gruppo era: corretto sommarlo per ciascuno
          sums.set(f.key, entry);
        }
      }
      // "to" sommato una sola volta per edificio, pesato sul totale copie.
      for (const f of DIFF_FIELDS) {
        const to = f.get(bRec);
        const entry = sums.get(f.key) ?? { from: 0, to: 0 };
        entry.to += to * buildingCopies;
        sums.set(f.key, entry);
      }
    }
    const allTotals = DIFF_FIELDS
      .filter(f => sums.has(f.key))
      .map(f => {
        const s = sums.get(f.key)!;
        return { field: f, from: round2(s.from), to: round2(s.to) };
      });
    // l'arrotondamento può azzerare differenze residue di solo rumore
    const totals = allTotals.filter(x => Math.abs(x.from - x.to) > 1e-6);
    const unchanged = allTotals.filter(x => Math.abs(x.from - x.to) <= 1e-6 && (x.from !== 0 || x.to !== 0));
    return { totalBuildings: outdatedBuildings.size, totalCopies, totals, unchanged };
  }, [outdatedBuildings, allProcessedBuildings, entityInstanceEraStats, DIFF_FIELDS]);
  // ⚠️ allProcessedBuildings è la fonte CSV GREZZA (valori statici a
  // FALLBACK_ERA, oggi Stellar Age: Discovery), MAI override-ata: l'override
  // "valori dell'era del giocatore" avviene SOLO dentro eraAdjustedSource via
  // applyEraStats, e quello dipende da activeTab. Qui serve applicarlo
  // esplicitamente — bug reale corretto in questo stesso giro: senza questa
  // chiamata il "to" di outdatedSummary e il "from" di
  // fullCitySummaryToFallback leggevano entrambi gli stessi valori CSV
  // statici, dando from===to quasi ovunque (sintomo osservato: card MAX con
  // "N → 0" su ogni campo, perché i pochi campi che DIFFERISCONO dal CSV
  // grezzo — quelli assenti a FALLBACK_ERA — avevano "from" letto anch'esso
  // dal CSV invece che dai veri valori dell'era del giocatore).
  const outdatedSummary = useMemo(
    () => buildOutdatedSummary(currentEraId, (b) => applyEraStats(b) as unknown as { [k: string]: unknown }),
    [currentEraId, applyEraStats, buildOutdatedSummary]
  );
  const fallbackEraId = useMemo(() => AGE_BY_CODE.get(FALLBACK_ERA)?.id ?? -1, []);

  // Rendering condiviso dalle due sezioni del panel "+ERA" (era corrente /
  // ultima era gestita), affiancate in una griglia a 2 colonne come le
  // sezioni del pannello Debug (EDIFICI MATCHATI / GRANDI EDIFICI / SENZA
  // MATCH) — non due panel separati. Estratta per evitare di duplicare il
  // JSX tra i due target: l'unica differenza è la fonte dati (outdatedSummary,
  // solo edifici obsoleti, vs fullCitySummaryToFallback, TUTTA la città) e
  // il titolo/nome era mostrati. Ogni card occupa metà larghezza
  // (grid-cols-2 lg:grid-cols-3 per i valori, non grid-cols-6 come quando il
  // panel era full-width su tutta la toolbar).
  const renderOutdatedSummaryCard = (
    summary: {
      totalBuildings: number; totalCopies: number;
      totals: Array<{ field: DiffField; from: number; to: number }>;
      unchanged: Array<{ field: DiffField; from: number; to: number }>;
    },
    titleKey: "outdatedSummaryTitle" | "outdatedSummaryFallbackTitle",
    toEraKey: "outdatedSummaryToCurrentEra" | "outdatedSummaryToMaxEra",
    targetEraName: string
  ) => {
    const { totalCopies, totals, unchanged } = summary;
    // Campi sempre interi per convenzione: pop/fel/mon/mat/iqMon/iqMat/fp non
    // hanno mai senso con decimali, anche se la somma pesata su molte copie
    // può produrre un residuo (es. ",50" per mon/mat sommando edifici con
    // boost frazionari) — formatInt tronca i decimali invece di mostrarli.
    // fpb/benib/iqMonB/iqMatB sono percentuali di boost (stesso set formattato
    // con formatProdPercent nelle celle della tabella principale, righe
    // 1625/1631/1659/1680): il valore grezzo è una frazione (0,03 = 3%), va
    // moltiplicato per 100 e mostrato con "%" invece che come decimale nudo.
    const percentFields = ["fpb", "benib", "benispb", "iqMonB", "iqMatB"];
    const fmtField = (field: DiffField, v: number) => {
      if (percentFields.includes(field.key)) return formatProdPercent(v);
      if (["pop", "fel", "mon", "mat", "med", "iqMon", "iqMat", "fp"].includes(field.key)) return formatInt(Math.round(v));
      // Sopra le 1000 unità i decimali sono solo rumore visivo (es. "1.510,758"):
      // arrotondati a intero. Sotto restano a 1 decimale, dove può essere
      // l'unica differenza visibile tra from/to (2 decimali erano eccessivi).
      return Math.abs(v) >= 1000 ? formatInt(Math.round(v)) : formatDecimal(v, 1);
    };
    return (
      <div className="flex flex-col bg-slate-950 border border-red-500/20">
        <div className="px-3 pt-2 pb-1.5 border-b border-slate-800 flex items-baseline gap-1 flex-wrap uppercase">
          <span className="text-xs font-bold text-red-400">{t(titleKey, uiLang)}</span>
          <span className="text-xs font-bold text-white">{t("outdatedSummaryCount", uiLang, totalCopies)}</span>
          <span className="text-xs font-bold text-red-400">{t(toEraKey, uiLang)}</span>
          <span className="text-xs font-bold text-emerald-400">{targetEraName}</span>
        </div>
        <div className="px-3 pt-2 pb-2.5">
          {totals.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">{t("outdatedSummaryEmpty", uiLang)}</p>
          ) : (
            <div className="grid gap-x-3 gap-y-1 grid-cols-2 lg:grid-cols-4">
              {[...totals].sort((a, b) => Number(isWideDiffKey(a.field.key)) - Number(isWideDiffKey(b.field.key))).map(({ field, from, to }) => {
                const up = to > from;
                const delta = to - from;
                const fmt = (v: number) => fmtField(field, v);
                return (
                  <div key={field.key} className={`flex items-center gap-1 font-mono text-xs ${isWideDiffKey(field.key) ? "col-span-2 lg:col-span-4" : ""}`} title={t(field.labelKey, uiLang)}>
                    {field.icon
                      ? <img src={field.icon} alt={t(field.labelKey, uiLang)} className="h-4 w-4 shrink-0 object-contain" />
                      : <span className="w-4 shrink-0 text-center">{field.emoji}</span>}
                    <span className="text-slate-400 tabular-nums">{fmt(from)}</span>
                    <span className="text-slate-600">→</span>
                    <span className={`tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>{fmt(to)}</span>
                    <span className={`font-bold tabular-nums ${up ? "text-emerald-500/70" : "text-red-500/70"}`}>
                      ({up ? "+" : ""}{fmt(delta)})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {unchanged.length > 0 && (
            <>
              <div className="mt-2.5 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-white uppercase">{t("outdatedSummaryUnchangedTitle", uiLang)}</span>
              </div>
              <div className="mt-1.5 grid gap-x-3 gap-y-1 grid-cols-2 lg:grid-cols-4">
                {[...unchanged].sort((a, b) => Number(isWideDiffKey(a.field.key)) - Number(isWideDiffKey(b.field.key))).map(({ field, from }) => {
                  const fmt = (v: number) => fmtField(field, v);
                  return (
                    <div key={field.key} className={`flex items-center gap-1 font-mono text-xs ${isWideDiffKey(field.key) ? "col-span-2 lg:col-span-4" : ""}`} title={t(field.labelKey, uiLang)}>
                      {field.icon
                        ? <img src={field.icon} alt={t(field.labelKey, uiLang)} className="h-4 w-4 shrink-0 object-contain" />
                        : <span className="w-4 shrink-0 text-center">{field.emoji}</span>}
                      <span className="text-slate-400 tabular-nums">{fmt(from)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ⚠️ INVARIANTE: questo valore deve essere la somma ESATTA delle larghezze
  // del <colgroup> della tabella principale (con 260 per la colonna nome, il
  // suo valore in modalità sticky — scelto per far stare interi quasi tutti
  // i nomi, es. "Mercato Eterno - Orizzonte Galattico" = 243px; il massimo
  // assoluto del database è ~331px ma riguarda una manciata di nomi). Non "circa": con table-fixed, se minWidth
  // supera la somma delle <col>, il browser RIDISTRIBUISCE l'eccesso su tutte
  // le colonne (proporzionalmente), e le posizioni/larghezze reali divergono
  // dai px del colgroup. Le celle sticky sono pinnate a left 0/32/46 e width
  // 260 ESATTI: con colonne "gonfiate" dalla ridistribuzione, la posizione
  // naturale (a scrollLeft 0) non coincide più con quella pinnata → al primo
  // scroll le colonne occhio e nome saltavano ~1px a sinistra e la colonna
  // nome si restringeva di ~1px (bug segnalato luglio 2026; causato da un
  // +50 stale nel base — residuo della colonna ⏱ diventata condizionale — e
  // dal caso sigma+spedizioni che contava 4 colonne invece di 8).
  // Sottostimare invece è innocuo (la tabella si allarga comunque alla somma
  // delle col), ma tenere la somma esatta protegge anche il breakpoint
  // buildingTableNeedsScroll da falsi positivi. Quando si tocca il colgroup
  // (vedi invariante #12 in docs/SKILL.md), aggiornare anche qui.
  // Catalogo › Grandi Edifici: niente colonna dei limitati (nessun GE è a tempo)
  const senzaLimitati = activeTab === "database" && catalogo === "ge";
  // ...e niente colonne delle Incursioni (nessun GE ha bonus IQ da colonna:
  // quelli Oro sono moltiplicativi, nel tooltip ×) né il "IQ mon/mat" del nastro
  // (stesso flag: niente progetti, frammenti e kit — le ultime 8 colonne delle
  // Produzioni, BP/FSP/TPM/TPB/aiuti/1-up/rinnovo/immagazzina — che nessun GE produce)
  const senzaIq = senzaLimitati;
  const tableMinWidth = useMemo(() => {
    const base = (senzaLimitati ? 26 : 32 + 14) + 320 + /* nome: 320 (era 260, utente 06/11: GE troncati) */ (senzaLimitati ? 56 : 32) + 50 + 48 + 44; // checkbox+occhio+nome+❔ (BONUS da 56 nel catalogo dei GE: icone da 24 px)+eff+size+road
    const time = senzaLimitati ? 0 : 50; // colonna ⏱ (2.0; non nel catalogo dei GE)
    const pop = showPopColumn ? 66 : 0;
    const fel = showFelColumn ? 66 : 0;
    const milCols = showSigmaColumns ? (showSpedColumns ? 8 : 4) : (showSpedColumns ? 12 : 8); // gen+gbg+(sped) | sig-gc+(sig-gs)
    const iq = senzaIq ? 4 * 42 : (showIqProdColumns ? 12 : 8) * 42; // (IQmonB/IQmatB/IQmon/IQmat +) IQAtk/Def + IQBeni+IQTruppe+IQAzioni + IQCap
    // (catalogo dei GE: l'ultima colonna, i beni di gilda, è da 56 px: un valore
    // lungo come "15.555" che sbordava dal bordo destro faceva credere alla
    // tabella di dover scorrere, col nome bloccato a 260 px; le altre restano da 36)
    const prod = showProdColumns ? (senzaIq ? 14 * 36 + 56 : 23 * 36) : 0; // Mon+Mat+Med + le 20 colonne esistenti (incl. BeniSp, BeniSpB)
    return base + time + pop + fel + milCols * 42 + iq + prod;
  }, [showSigmaColumns, showSpedColumns, showPopColumn, showFelColumn, showIqProdColumns, showProdColumns, senzaLimitati, senzaIq]);

  // Sticky solo quando serve DAVVERO lo scroll orizzontale (scrollWidth >
  // clientWidth, stesso confronto già usato per la scrollbar flottante
  // sotto): con poche colonne visualizzate e finestra ampia, la tabella
  // può stare tutta nel contenitore senza scroll — in quel caso vogliamo
  // che la colonna nome torni ELASTICA (riempie lo spazio libero, com'era
  // prima di introdurre lo sticky) invece di restare fissa a 260px con
  // tutto lo spazio in eccesso distribuito sulle altre colonne strette
  // (comportamento segnalato come "dilatato", non voluto). Se invece lo
  // scroll è necessario, la colonna nome resta sticky e a larghezza FISSA
  // (260px): è l'unico modo per evitare il bug di sovrapposizione/bordo
  // instabile risolto in precedenza (vedi note su .has-sticky-name in
  // index.css) — un ibrido "sticky ma elastica" non è possibile in modo
  // affidabile con table-fixed + border-collapse. ECCEZIONE: mai sticky in
  // verticale su mobile (isPortraitNarrow sotto), anche se lo scroll
  // servirebbe — vedi commento su isPortraitNarrow.
  const buildingTableNeedsScroll = buildingTableScrollMetrics.scrollWidth > buildingTableScrollMetrics.clientWidth && !isPortraitNarrow;

  // minWidth dedicato per le tabelle alleati: colonne nome+LV1+EFF+GEN+CAMPI+SPED,
  // niente colonne edificio (size/road/pop/fel/IQ/produzioni) che non esistono qui.
  // Riusare tableMinWidth gonfierebbe la larghezza minima ben oltre il contenuto
  // reale, lasciando un vuoto a destra prima che lo scroll orizzontale serva.
  // Colonne reali (vedi colgroup tabella alleati): GEN(4, solo se !sigma) +
  // GBG/CAMPI(4, sempre) + SPED(4, solo se enabled) — sigma qui fonde GEN dentro
  // CAMPI ma non tocca SPED, a differenza della tabella edifici.
  // Base 264 copre il caso più largo delle due tabelle alleati: quella "database
  // completo" (nome+LV1+EFF = 240+50+50... ma qui usiamo l'effettiva colgroup
  // dell'altra tabella, "alleati importati", che ha una colonna extra rarità
  // 64px al posto di LV1/EFF separati: nome(240)+rarità(64)+50+50 = 404. Usiamo
  // il valore più alto delle due come base comune, comunque solo un minimo:
  // se sottostimato la tabella si allarga lo stesso al contenuto reale via
  // table-fixed + col width, non si tronca nulla.
  const alliesTableMinWidth = useMemo(() => {
    const base = 240 + 64 + 50; // nome + Lvl (solo tab Posseduti) + EFF (max delle due tabelle)
    const genCols = showSigmaColumns ? 0 : 4;
    const gbgCols = 4;
    const spedCols = 4; // 2.0: le tabelle alleati mostrano sempre le Spedizioni
    const prodCols = 3; // sezione 📦 PRODUZIONI: PF/Beni/BeniP, sempre visibile
    return base + (genCols + gbgCols + spedCols + prodCols) * 42;
  }, [showSigmaColumns]);

  // Memoize city buildings list — avoids O(n) filter on every render
  // I valori att/dif riflettono l'era corrente (override da eraStats).
  // Le decorazioni sono escluse dai totali produzione: sono edifici "non
  // attivi" (W_*Decoration) con valori a zero per definizione nel CSV,
  // escluderle qui resta solo per chiarezza concettuale.
  const cityBuildings = useMemo(
    () => BUILDINGS_FROM_CSV.filter(b => cityEntityIds.has(b.cityEntityId) && !b.isInactive && !b.isGreatBuilding).map(applyEraStats),
    [cityEntityIds, applyEraStats],
  );

  // Sezione "MAX" del panel +ERA: a differenza di outdatedSummary (solo gli
  // edifici OBSOLETI rispetto all'era del giocatore), qui interessa TUTTA la
  // città — richiesta esplicita dell'utente: anche un edificio già
  // "aggiornato" all'era corrente cambierebbe ulteriormente arrivando a
  // FALLBACK_ERA (oggi Stellar Age: Discovery).
  // ⚠️ Riusa cityBuildings/cityFallbacks — le STESSE fonti già validate da
  // renderProdSummary/PROD+STAT (sopra) — non allProcessedBuildings. Bug
  // reale corretto in questo giro: la prima versione iterava
  // allProcessedBuildings (= BUILDINGS_FROM_CSV filtrato solo per
  // !isGreatBuilding, cioè l'INTERO catalogo statico, non gli edifici
  // realmente posseduti) e ricalcolava applyEraStats a mano — risultato
  // verificato sbagliato dall'utente (FSP: 15,80 calcolato vs 27,8 reale,
  // confermato dal totale PROD+STAT, la fonte già validata). cityBuildings è
  // invece già filtrato a "solo ciò che è davvero in città"
  // (cityEntityIds.has) ED esclude !isInactive (le decorazioni "non attive"
  // non vanno contate — stesso trattamento di PROD+STAT), e cityFallbacks
  // copre gli edifici fuori catalogo CSV con bonus reali. Usando la stessa
  // coppia di fonti si ottiene per costruzione lo stesso totale "from" che
  // PROD+STAT mostra già corretto — non serve un algoritmo diverso, serve la
  // stessa fonte dati. Dichiarata DOPO cityBuildings (non prima, come nel
  // primo tentativo): è una const dichiarata a livello di componente, usarla
  // prima della sua riga di dichiarazione nello stesso render è un errore di
  // temporal dead zone.
  const fullCitySummaryToFallback = useMemo(() => {
    if (fallbackEraId < 0 || cityEntityIds.size === 0) {
      return {
        totalBuildings: 0, totalCopies: 0,
        totals: [] as Array<{ field: DiffField; from: number; to: number }>,
        unchanged: [] as Array<{ field: DiffField; from: number; to: number }>,
      };
    }
    const sums = new Map<string, { from: number; to: number }>();
    let totalBuildings = 0;
    let totalCopies = 0;
    const cityFallbacksForSummary = Array.from(fallbackBuildings.values()).filter(b => cityEntityIds.has(b.cityEntityId));
    for (const b of [...cityBuildings, ...cityFallbacksForSummary]) {
      if (!b.cityEntityId || isMilitaryBuildingId(b.cityEntityId)) continue; // stessa esclusione di outdatedBuildings
      const count = cityEntityIds.get(b.cityEntityId);
      if (!count) continue;
      const csvBuilding = BUILDING_BY_ID.get(b.cityEntityId);
      if (!csvBuilding) continue; // i fallback senza corrispondenza CSV non hanno un "to" a FALLBACK_ERA da confrontare
      totalBuildings += 1;
      totalCopies += count;
      const bRec = b as unknown as { [k: string]: unknown }; // già a valori correnti (cityBuildings applica applyEraStats, i fallback sono dati di gioco reali)
      const toRec = csvBuilding as unknown as { [k: string]: unknown };
      // Somma SEMPRE from/to di OGNI edificio per OGNI campo (richiesta
      // esplicita dell'utente: il totale per campo deve essere la somma su
      // tutta la città, non solo sugli edifici che individualmente
      // cambiano) — nessun filtro qui. La decisione "mostra questo campo
      // nell'elenco" avviene DOPO, solo sul totale aggregato finale (vedi
      // sotto): un edificio invariato contribuisce comunque al totale (con
      // from===to per la sua quota), ma se la somma finale del campo su
      // tutta la città non cambia, il campo semplicemente non compare —
      // niente filtro per-edificio che potrebbe escludere silenziosamente
      // un contributo legittimo.
      for (const f of DIFF_FIELDS) {
        const from = f.get(bRec);
        const to = f.get(toRec);
        const entry = sums.get(f.key) ?? { from: 0, to: 0 };
        entry.from += from * count;
        entry.to += to * count;
        sums.set(f.key, entry);
      }
    }
    const allTotals = DIFF_FIELDS
      .filter(f => sums.has(f.key))
      .map(f => {
        const s = sums.get(f.key)!;
        return { field: f, from: round2(s.from), to: round2(s.to) };
      });
    // ⚠️ Confronto con tolleranza, NON "from !== to" esatto: sui totali
    // AGGREGATI (somma di molti edifici) il rumore floating point residuo
    // di ciascun edificio si accumula, quindi anche un campo dove NESSUN
    // edificio cambia davvero può risultare con un residuo dell'ordine di
    // 1e-10/1e-12 dopo il round2 — bug gemello di quello già trovato nel
    // confronto per-edificio (vedi commento storico più sopra sul log
    // "[DEBUG fsp]": Corriere Northwind 5.1000000000000005 vs 5.1, Sogni
    // Didukh 1.2000000000000002 vs 1.2). round2 già arrotonda a 2
    // decimali, quindi qui la tolleranza può essere stretta.
    const totals = allTotals.filter(x => Math.abs(x.from - x.to) > 1e-6);
    // Campi presenti ma invariati tra le due ere (richiesta esplicita
    // dell'utente: mostrarli in una sezione separata del pannello, per poter
    // verificare a colpo d'occhio che il tool non li abbia "persi" — es. i
    // premi truppe era_unit#.../genb_random_unit_chest... che restano
    // identici da un'era all'altra per molti edifici). Esclusi i campi
    // completamente a zero in entrambi i valori: non pertinenti per
    // l'edificio/la città, mostrarli sarebbe solo rumore.
    const unchanged = allTotals.filter(x => Math.abs(x.from - x.to) <= 1e-6 && (x.from !== 0 || x.to !== 0));
    return { totalBuildings, totalCopies, totals, unchanged };
  }, [fallbackEraId, cityEntityIds, cityBuildings, fallbackBuildings, DIFF_FIELDS]);

  // Badge AGGIORNABILE per gli edifici della città aggiornabili con i kit in inventario
  const cityUpgradeBadges = useMemo(() => {
    const map = new Map<string, { targets: string[]; kits: Array<{ name: string; count: number }> }>();
    if (inventoryUpgradeKits.size === 0 && inventorySelectionKits.size === 0) return map;
    cityEntityIds.forEach((_count, id) => {
      const info = computeUpgradeBadge(id, inventoryUpgradeKits, inventorySelectionKits, gameLang);
      if (info) map.set(id, info);
    });
    return map;
  }, [cityEntityIds, inventoryUpgradeKits, inventorySelectionKits, gameLang]);

  // Inventario ricostruito in formato equivalente a inventario.csv dello standalone
  const inventoryCsvLike = useMemo(() => {
    const result = new Map<string, { name: string; qty: number }>();
    const addItem = (id: string, name: string, qty: number) => {
      const existing = result.get(id);
      if (existing) existing.qty += qty;
      else result.set(id, { name, qty });
    };

    inventoryMatched.forEach((e) => addItem(e.cityEntityId, e.name, e.inStock));
    inventoryUnmatched.forEach((e) => addItem(e.cityEntityId, e.name, e.inStock));
    inventorySelectionKits.forEach((e) => addItem(e.kitId, e.name, e.inStock));
    inventoryUpgradeKits.forEach((e) => addItem(e.kitId, e.name, e.inStock));

    return result;
  }, [inventoryMatched, inventoryUnmatched, inventorySelectionKits, inventoryUpgradeKits]);

  const cityUpgradeableData = useMemo(() => {
    type UpgradeRow = {
      bld_id: string;
      name: string;
      qty: number;
      current_level: number;
      max_level: number;
      kit_id: string;
      breakdown: Array<{ id: string; name: string; qty: number; producers: string[] }>;
      avail: number;
      ascendable: boolean;
    };

    const rows: UpgradeRow[] = [];
    cityEntityIds.forEach((qty, bld_id) => {
      const info = chainInfo(bld_id);
      if (!info) return;
      if (info.level === info.max_level) return;

      const breakdownIds = [info.kit_id, ...(SELECTION_KITS_BY_UPGRADE.get(info.kit_id) ?? [])];
      const breakdown = breakdownIds.map((id) => {
        const inv = inventoryCsvLike.get(id);
        return {
          id,
          name: kitName(id, uiLang),
          qty: inv?.qty ?? 0,
          producers: FRAGMENT_KIT_PRODUCERS.get(id) ?? [],
        };
      });
      const avail = breakdown.reduce((sum, k) => sum + k.qty, 0);
      const ascendable = isAscendedUpgradeKit(info.kit_id);

      rows.push({
        bld_id,
        name: displayName(bld_id, ITALIAN_NAMES.get(bld_id) ?? bld_id, uiLang),
        qty,
        current_level: info.level,
        max_level: info.max_level,
        kit_id: info.kit_id,
        breakdown,
        avail,
        ascendable,
      });
    });

    rows.sort((a, b) => (Number(b.avail > 0) - Number(a.avail > 0)) || a.kit_id.localeCompare(b.kit_id));

    return {
      upgradable: rows.filter((r) => !r.ascendable),
      ascendable: rows.filter((r) => r.ascendable),
      hasInventoryData: inventoryCsvLike.size > 0,
    };
  }, [cityEntityIds, inventoryCsvLike, uiLang]);

  const renderRoadSummary = () => {
    if (cityEntityIds.size === 0) return null;

    // Efficienza strade — formula REALE del gioco (reverse-engineered a
    // luglio 2026 confrontando con l'efficienza mostrata in-game, non
    // documentata ufficialmente da Inno). La formula visualizzata
    // "Area Edifici Collegati / (Area Totale Strade × 4) × 100" ha un
    // numeratore che NON è l'area fisica (larghezza×lunghezza) degli
    // edifici: è la somma del loro FABBISOGNO STRADALE (b.road =
    // min(larghezza,lunghezza)/2) moltiplicato per 4. Il ×4 si elide col
    // ×4 del denominatore, quindi la formula si riduce a:
    //   Efficienza = Σ(road degli edifici collegati) / Area Totale Strade × 100
    // Prova decisiva: scollegando un GE 7×5 (road=2.5) O un edificio
    // normale 5×6 (road=2.5, area 30≠35) l'efficienza cala ESATTAMENTE
    // uguale nei due casi — impossibile se il peso fosse l'area fisica
    // (35 vs 30), ma coerente se il peso è road (identico, 2.5, per
    // entrambi). Verificato al centesimo esatto su un caso reale:
    // Σroad(13 edifici normali)=66,5 + Σroad(12 GE)=25 + Σroad(militare
    // fallback)=1 + road(municipio)=3 → totale 95,5; ×4=382 = numeratore
    // atteso, con area strade=74 → 382/(74×4)×100=129,05% (confermato
    // dal gioco). Include quindi: edifici normali (cityBuildings +
    // cityFallbacksForRoad, stesso trattamento di cityFallbacks in
    // renderProdSummary), i Grandi Edifici (processedGreatBuildings, via
    // BuildingModel.fromGreatBuilding → road = getRoadForGreatBuildingSize)
    // e il municipio (TOWNHALL_ROAD, costante fissa: prefisso "H_" fuori da
    // ALLOWED_PREFIXES quindi mai in cityEntityIds, ma dimensione 7×6
    // invariante in ogni era — vedi il commento sulla costante). Solo le copie
    // EFFETTIVAMENTE collegate contribuiscono (cityEntityIds -
    // cityEntityDisconnected per gli edifici normali; rawEntry.connected
    // per i GE, che hanno sempre una sola istanza).
    // Area totale delle strade: tessere REALI piazzate in città
    // (type === "street" in cityMapBuildings, ciascuna 1x1 o 2x2 — MAI
    // frazionaria), sommando le aree w×h di quelle tessere.
    // ESCLUSIONI dal numeratore (edifici che richiedono strada per
    // funzionare ma NON contano nell'efficienza mostrata dal gioco):
    // veri accampamenti militari (isMilitaryCampBuildingId). Verificato
    // empiricamente due volte in game su una seconda città (scollegando E
    // poi eliminando del tutto un accampamento vero): l'efficienza mostrata
    // da FoE Helper non cambia in nessuno dei due casi.
    // ⚠️ Ipotesi SCARTATA (luglio 2026): si era creduto che anche gli edifici
    // "Culture" (__class__ === "CityEntityCultureBuilding", es. Algae
    // Airship) non contassero — un residuo di 2,70 punti percentuale nel
    // confronto con FoE Helper sembrava spiegato esattamente da 4×Algae
    // Airship (road 1,5 cad. = 6,0). Un secondo confronto più preciso sulla
    // STESSA città (103,27% calcolato escludendo Algae Airship vs 108,88%
    // reale di FoE Helper) ha mostrato che il numero REALE combacia solo
    // includendo Algae Airship normalmente: l'ipotesi era sbagliata, il gap
    // dei 2,70 punti nel test precedente aveva un'altra causa (non ancora
    // identificata). Gli edifici Culture contano quindi normalmente, come
    // qualunque altro edificio con road > 0. Non reintrodurre l'esclusione
    // basata su __class__ senza nuove prove dirette.
    const cityFallbacksForRoad = Array.from(fallbackBuildings.values()).filter(b => cityEntityIds.has(b.cityEntityId));
    let connectedRoadNeed = 0;
    let disconnectedRoadNeed = 0;
    for (const b of [...cityBuildings, ...cityFallbacksForRoad]) {
      if (b.road <= 0) continue;
      // Gli ACCAMPAMENTI militari veri (es. M_OceanicFuture_Military2) non
      // contribuiscono al fabbisogno stradale — verificato empiricamente
      // scollegandone uno in game: l'efficienza reale non cambia. Gli
      // edifici-premio con prefisso "M_" ma non accampamenti (es. Tana dei
      // furfanti = M_AllAge_EasterBonus1Small) continuano a contare
      // normalmente. Vedi isMilitaryCampBuildingId.
      if (isMilitaryCampBuildingId(b.cityEntityId)) continue;
      const total = cityEntityIds.get(b.cityEntityId) ?? 0;
      const disconnectedCount = cityEntityDisconnected.get(b.cityEntityId) ?? 0;
      const connectedCount = Math.max(0, total - disconnectedCount);
      connectedRoadNeed += b.road * connectedCount;
      disconnectedRoadNeed += b.road * disconnectedCount;
    }
    for (const gb of processedGreatBuildings) {
      if (gb.road <= 0) continue;
      // Come per gli edifici normali: il campo "connected" nel payload grezzo
      // NON è booleano/0-1 sempre presente — quando un GE è SCOLLEGATO il
      // campo è del tutto ASSENTE (mai "connected": 0), quando è collegato
      // vale 1. Il default va quindi verso "assente = scollegato" (?? 0),
      // NON verso "assente = collegato" come si pensava in origine (bug
      // scoperto luglio 2026: scollegando in game TUTTE le 15 GE di una
      // città, il default ?? 1 le contava comunque come collegate, dando
      // un'efficienza di 35,38% invece del 2,83% reale mostrato da FoE
      // Helper — confermato con export raw MainParser.txt prima/dopo aver
      // ricollegato 3 GE: "connected" assente quando scollegata, "connected":
      // 1 quando collegata, mai "connected": 0).
      const isConnected = Number(greatBuildingsJson.get(gb.cityEntityId)?.rawEntry?.connected ?? 0) >= 1;
      if (isConnected) connectedRoadNeed += gb.road;
      else disconnectedRoadNeed += gb.road;
    }
    // Il municipio richiede sempre strada e non ha un flag "connected"
    // separato tracciato dall'app (è sempre il punto di partenza della
    // rete stradale in FoE): contato sempre come collegato.
    connectedRoadNeed += TOWNHALL_ROAD;
    const roadArea = cityMapBuildings.reduce((sum, mb) => sum + (mb.type === "street" ? mb.w * mb.h : 0), 0);
    const efficiency = roadArea > 0 ? (connectedRoadNeed / roadArea) * 100 : 0;
    const hasDisconnected = disconnectedRoadNeed > 0;
    // Efficienza ipotetica: gli edifici scollegati diventano collegati SENZA
    // costruire altre strade → area strade invariata, fabbisogno aumenta.
    const hypotheticalEfficiency = hasDisconnected && roadArea > 0
      ? ((connectedRoadNeed + disconnectedRoadNeed) / roadArea) * 100
      : efficiency;
    // Efficienza sempre a 2 decimali, ma se dopo l'arrotondamento sono ",00"
    // vanno omessi (mostra l'intero secco): formatDecimal decide "intero o
    // no" PRIMA di arrotondare, quindi un valore come 99,995 arrotonderebbe
    // a "100,00" invece di "100" — si arrotonda qui prima di delegare.
    const formatEfficiency = (value: number): string => formatDecimal(Math.round(value * 100) / 100, 2);

    // 2.0: pannello nel riquadro della città (aperto da Statistiche → Efficienza
    // strade nel nastro), non più a comparsa sotto un pulsante.
    return (
      <>
        {isRoadSummaryOpen && (
          <div className="border border-slate-800 bg-slate-950 p-2 space-y-2 text-xs w-max min-w-[420px] max-w-full overflow-x-auto">
            <div className="font-bold text-slate-200 uppercase tracking-wide">{t("roadEfficiencyTitle", uiLang)}</div>
            <div className="border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-slate-400 italic">
              {t("roadEfficiencyFormula", uiLang)}
            </div>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-slate-800/50">
                  <td className="py-1 px-1 text-slate-300">{t("roadEfficiencyConnectedArea", uiLang)}</td>
                  <td className="py-1 px-1 text-right font-mono text-slate-200">{formatDecimal(connectedRoadNeed, 2)}</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-1 px-1 text-slate-300">{t("roadEfficiencyRoadArea", uiLang)}</td>
                  <td className="py-1 px-1 text-right font-mono text-slate-200">{formatDecimal(roadArea, 2)}</td>
                </tr>
                <tr className="bg-amber-950/30">
                  <td className="py-1.5 px-1 font-bold text-amber-300">{t("roadEfficiencyResult", uiLang)}</td>
                  <td className="py-1.5 px-1 text-right font-mono font-bold text-amber-300">{formatEfficiency(efficiency)}%</td>
                </tr>
              </tbody>
            </table>
            {hasDisconnected && (
              <div className="border-t border-slate-800 pt-1.5 space-y-1.5">
                <div className="whitespace-pre-line text-red-300">{t("roadEfficiencyDisconnectedWarning", uiLang)}</div>
                <table className="w-full">
                  <tbody>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-1 px-1 text-slate-300">{t("roadEfficiencyDisconnectedArea", uiLang)}</td>
                      <td className="py-1 px-1 text-right font-mono text-slate-200">{formatDecimal(disconnectedRoadNeed, 2)}</td>
                    </tr>
                    <tr className="bg-emerald-950/30">
                      <td className="py-1.5 px-1 font-bold text-emerald-300">{t("roadEfficiencyHypothetical", uiLang)}</td>
                      <td className="py-1.5 px-1 text-right font-mono font-bold text-emerald-300">{formatEfficiency(hypotheticalEfficiency)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  const renderProdSummary = () => {
    if (cityEntityIds.size === 0) return null;

    const prodTypes = [
      { key: "fsp", name: t("prodRushSpecial", uiLang),    icon: <img src={iconFSP} alt="" className="icon-16" />, cost: 30, invKey: "rushEventBuildings"    as keyof SpecialKits },
      { key: "tpm", name: t("prodRushMaterials", uiLang),  icon: <img src={iconTPM} alt="" className="icon-16" />, cost: 15, invKey: "rushMassSupplies"      as keyof SpecialKits },
      { key: "tpb", name: t("prodRushGoods", uiLang),      icon: <img src={iconTPB} alt="" className="icon-16" />, cost: 30, invKey: "rushGoodsBuildings"    as keyof SpecialKits },
      { key: "adm", name: t("prodMassAid", uiLang),         icon: <img src={iconAiuto} alt="" className="icon-16" />, cost: 30, invKey: "massSelfAidKit"        as keyof SpecialKits },
      { key: "mod", name: t("prodOneUpKit", uiLang),        icon: <img src={iconOneUp} alt="" className="icon-16" />, cost: 30, invKey: "oneUpKit"              as keyof SpecialKits },
      { key: "rin", name: t("prodRenovationKit", uiLang),   icon: <img src={iconRinn} alt="" className="icon-16" />, cost: 30, invKey: "renovationKit"         as keyof SpecialKits },
      { key: "imm", name: t("prodStoreBuilding", uiLang),   icon: <img src={iconImm} alt="" className="icon-16" />, cost: 15, invKey: "storeBuilding"         as keyof SpecialKits },
    ];
    // (solo gli alleati ospitati in un edificio collegato alla strada, vedi alleatoAttivo)
    const placedAllies = processedImportedAllies.filter(alleatoAttivo);

    // (solo i GE collegati alla strada: uno scollegato non dà valori né bonus moltiplicativi)
    const filteredGBs = processedGreatBuildings.filter(geCollegato);
    // Edifici fallback presenti in città (creati al volo perché non nel CSV):
    // i loro bonus militari reali vanno inclusi nei totali, altrimenti le
    // statistiche risultano sottostimate.
    const cityFallbacks = Array.from(fallbackBuildings.values()).filter(b => cityEntityIds.has(b.cityEntityId));
    // (solo le copie collegate alla strada, vedi copieCollegate)
    const getBuildingSum = (idx: number, key: "general" | "gbg" | "sped" | "iq") =>
      cityBuildings.reduce((s, b) => s + b[key][idx] * copieCollegate(b.cityEntityId), 0) +
      cityFallbacks.reduce((s, b) => s + b[key][idx] * copieCollegate(b.cityEntityId), 0);
    const getGESum = (idx: number, key: "general" | "gbg" | "sped" | "iq") =>
      filteredGBs.reduce((s, gb) => s + gb[key][idx], 0);
    const getAllySum = (idx: number, key: "computedGeneral" | "computedGbg" | "computedSped" | "computedIq") =>
      placedAllies.reduce((s, a) => { const arr = a[key] as unknown as number[] | undefined; return s + (arr ? arr[idx] : 0); }, 0);

    // GE (Prestige): % moltiplicativi per modalità e slot (Att/Dif rosso, Att/Dif blu)
    const moltGe = (modalita: string, slot: number) => filteredGBs.reduce((s, gb) => s
      + (gb.gbMoltiplicativi ?? []).reduce((t, m) => t + (m.modalita === modalita && GB_SLOT_IQ[m.tipo]?.includes(slot) ? m.valore : 0), 0), 0);
    const statsRows = [
      { label: t("statRowGlobal", uiLang), color: "red" as const, modalita: "all",
        bA: getBuildingSum(0, "general"), bD: getBuildingSum(1, "general"),
        gA: getGESum(0, "general"), gD: getGESum(1, "general"),
        aA: getAllySum(0, "computedGeneral"), aD: getAllySum(1, "computedGeneral") },
      { label: t("statRowGlobal", uiLang), color: "blue" as const, modalita: "all",
        bA: getBuildingSum(2, "general"), bD: getBuildingSum(3, "general"),
        gA: getGESum(2, "general"), gD: getGESum(3, "general"),
        aA: getAllySum(2, "computedGeneral"), aD: getAllySum(3, "computedGeneral") },
      { label: t("sectionGbg", uiLang), color: "red" as const, modalita: "battleground",
        bA: getBuildingSum(0, "gbg"), bD: getBuildingSum(1, "gbg"),
        gA: getGESum(0, "gbg"), gD: getGESum(1, "gbg"),
        aA: getAllySum(0, "computedGbg"), aD: getAllySum(1, "computedGbg"),
        extraA: getBuildingSum(0, "general") + getGESum(0, "general") + getAllySum(0, "computedGeneral"),
        extraD: getBuildingSum(1, "general") + getGESum(1, "general") + getAllySum(1, "computedGeneral") },
      { label: t("sectionGbg", uiLang), color: "blue" as const, modalita: "battleground",
        bA: getBuildingSum(2, "gbg"), bD: getBuildingSum(3, "gbg"),
        gA: getGESum(2, "gbg"), gD: getGESum(3, "gbg"),
        aA: getAllySum(2, "computedGbg"), aD: getAllySum(3, "computedGbg"),
        extraA: getBuildingSum(2, "general") + getGESum(2, "general") + getAllySum(2, "computedGeneral"),
        extraD: getBuildingSum(3, "general") + getGESum(3, "general") + getAllySum(3, "computedGeneral") },
      { label: t("sectionGe", uiLang), color: "red" as const, modalita: "guild_expedition",
        bA: getBuildingSum(0, "sped"), bD: getBuildingSum(1, "sped"),
        gA: getGESum(0, "sped"), gD: getGESum(1, "sped"),
        aA: getAllySum(0, "computedSped"), aD: getAllySum(1, "computedSped"),
        extraA: getBuildingSum(0, "general") + getGESum(0, "general") + getAllySum(0, "computedGeneral"),
        extraD: getBuildingSum(1, "general") + getGESum(1, "general") + getAllySum(1, "computedGeneral") },
      { label: t("sectionGe", uiLang), color: "blue" as const, modalita: "guild_expedition",
        bA: getBuildingSum(2, "sped"), bD: getBuildingSum(3, "sped"),
        gA: getGESum(2, "sped"), gD: getGESum(3, "sped"),
        aA: getAllySum(2, "computedSped"), aD: getAllySum(3, "computedSped"),
        extraA: getBuildingSum(2, "general") + getGESum(2, "general") + getAllySum(2, "computedGeneral"),
        extraD: getBuildingSum(3, "general") + getGESum(3, "general") + getAllySum(3, "computedGeneral") },
      { label: t("sectionQi", uiLang), color: "red" as const, modalita: "guild_raids",
        bA: getBuildingSum(0, "iq"), bD: getBuildingSum(1, "iq"),
        gA: getGESum(0, "iq"), gD: getGESum(1, "iq"),
        aA: getAllySum(0, "computedIq"), aD: getAllySum(1, "computedIq") },
      { label: t("sectionQi", uiLang), color: "blue" as const, modalita: "guild_raids",
        bA: getBuildingSum(2, "iq"), bD: getBuildingSum(3, "iq"),
        gA: getGESum(2, "iq"), gD: getGESum(3, "iq"),
        aA: getAllySum(2, "computedIq"), aD: getAllySum(3, "computedIq") },
    ];

    // 2.0: il vecchio PROD + STAT diviso in due pannelli nel riquadro della
    // città, aperti da Statistiche nel nastro: Produzione (kit e produzioni
    // giornaliere) e Valori militari (totali per sezione).
    return (
      <>
        {isProdSummaryOpen && (() => {
          // Calcola il totale esatto di un campo di produzione per un edificio,
          // tenendo conto delle copie in ere diverse (se presenti).
          // Per gli edifici con tutte le copie alla stessa era usa count × valore
          // corrente (come prima). Per quelli con copie in ere diverse usa la
          // somma dei (count_per_era × valore_per_era) precalcolata all'import.
          // (09/11/2026, utente) Le copie scollegate dalla strada non producono: ogni
          // gruppo per era si divide in copie collegate (on) e scollegate (off). L'era delle
          // scollegate viene da istanzeScollegate; nei profili importati prima si sa solo
          // quante sono, e si tolgono prima dall'era attuale, poi dalle altre.
          const scollegatePerEra = new Map<string, Map<string, number>>();
          for (const [, id, lvl] of istanzeScollegate ?? []) {
            const age = AGES_BY_ID.get(lvl)?.age ?? (currentEra || FALLBACK_ERA);
            const m = scollegatePerEra.get(id) ?? new Map<string, number>();
            scollegatePerEra.set(id, m);
            m.set(age, (m.get(age) ?? 0) + 1);
          }
          type GruppoCopie = { age: string; on: number; off: number; s: Record<string, unknown> };
          const gruppiCopie = (b: Building & { cityEntityId: string }): GruppoCopie[] => {
            const groups: Array<[string, number, Record<string, unknown>]> = (entityInstanceEraStats.get(b.cityEntityId) as Array<[string, number, Record<string, unknown>]> | undefined)
              // (tutte all'era attuale: le sue statistiche dall'import, con beniParti, se ci sono)
              ?? [[currentEra || FALLBACK_ERA, cityEntityIds.get(b.cityEntityId) || 0, (eraStats.get(b.cityEntityId) ?? b) as unknown as Record<string, unknown>]];
            const perEra = scollegatePerEra.get(b.cityEntityId);
            let resto = istanzeScollegate ? 0 : cityEntityDisconnected.get(b.cityEntityId) ?? 0;
            const ordinati = istanzeScollegate ? groups : [...groups].sort((x, y) => (y[0] === currentEra ? 1 : 0) - (x[0] === currentEra ? 1 : 0));
            return ordinati.map(([age, n, s]) => {
              let off = Math.min(n, perEra?.get(age) ?? 0);
              if (resto > 0) { const k = Math.min(n - off, resto); off += k; resto -= k; }
              return { age, on: n - off, off, s };
            });
          };
          // Beni con il bonus % (09/11/2026, utente: Excalibur 1.410 + 25% × 6.970 = 3.152,5 e non
          // 3.154): il gioco applica il bonus e arrotonda per singolo bene di ogni produzione
          // (all_goods_of_age 850 = 5 × 170 → 5 × round(170 × 1,66) = 1.410), poi la
          // probabilità. Con EraStats.beniParti (import dal 09/11) si fa così; se mancano, o non
          // tornano col totale, come prima: arrotondato per eccesso sul totale della copia.
          const beniConBonus = (s: Record<string, unknown>, field: "beni" | "benip" | "benis", boost: number): number => {
            const tot = (s[field] as number) || 0, i = field === "beni" ? 0 : field === "benip" ? 1 : 2;
            const parti = (s.beniParti as EraStats["beniParti"])?.filter(p => p[0] === i);
            if (parti?.length && Math.abs(parti.reduce((a, p) => a + p[1] * p[2], 0) - tot) < 1e-6) {
              return parti.reduce((a, [, v, prob, n]) => a + Math.round((v / n) * (1 + boost)) * n * prob, 0);
            }
            return Math.ceil(tot * (1 + boost));
          };
          const exactBuildingSum = (b: Building & { cityEntityId: string }, field: keyof EraStats & keyof Building, quali: "on" | "off" = "on"): number =>
            gruppiCopie(b).reduce((s, g) => s + ((g.s[field] as number) || 0) * g[quali], 0);

          // Unico edificio noto (agosto 2026) che usa each_special_goods_up_to_age:
          // il suo campo `benisp` NON è un valore-per-bene ma un totale già
          // pre-moltiplicato per countSpecialGoodEras(era) dentro BuildingModel.ts/
          // buildings.py (vedi goodsValue()/_goods_value()) — il gioco arrotonda
          // (ceil) la produzione boostata per SINGOLO bene speciale, non sul
          // totale ×9 già assemblato. Per applicare il ceil nel punto giusto va
          // scomposto: valore_unitario = benisp / countSpecialGoodEras(era), poi
          // ceil(valore_unitario × (1+boost)) × countSpecialGoodEras(era). Hardcoded
          // (non generalizzato ad "ogni edificio each + ogni boost"): è l'unico
          // incrocio noto tra un edificio "each" (LTE24A11) e un boost
          // special_goods_production (SUM25E1) — se in futuro comparisse un secondo
          // caso, va rivisto qui.
          const EACH_SPECIAL_GOOD_BUILDING_ID = "W_MultiAge_LTE24A11";

          // Somma "boostata" di un campo produzione, con ceil applicato PER
          // GRUPPO (istanza/copia a una data era) prima di sommare — non sul
          // totale aggregato. Il gioco arrotonda per singola produzione, non
          // sul totale città: con boost 5% e 2 copie di un edificio da 90,
          // il valore reale è ceil(90×1.05)×2 = 95×2 = 190, NON
          // ceil(90×2×1.05) = ceil(189) = 189. Stessa struttura di
          // exactBuildingSum (gruppi per era mista vs count×valore corrente),
          // ma con Math.ceil(valore × (1+boost)) applicato a ogni gruppo — o,
          // per EACH_SPECIAL_GOOD_BUILDING_ID, scomposto prima in valore
          // unitario × countSpecialGoodEras (vedi commento sopra).
          const boostedExactBuildingSum = (b: Building & { cityEntityId: string }, field: keyof EraStats & keyof Building, boost: number, quali: "on" | "off" = "on"): number => {
            const ceilBoosted = (value: number, era: string): number => {
              if (b.cityEntityId === EACH_SPECIAL_GOOD_BUILDING_ID && field === "benisp") {
                const eraId = AGE_BY_CODE.get(era)?.id;
                const mult = eraId !== undefined ? countSpecialGoodEras(eraId) : 0;
                if (mult > 0) return Math.ceil((value / mult) * (1 + boost)) * mult;
              }
              return Math.ceil(value * (1 + boost));
            };
            return gruppiCopie(b).reduce((s, g) => s + (field === "beni" || field === "benip" || field === "benis"
              ? beniConBonus(g.s, field, boost) : ceilBoosted((g.s[field] as number) || 0, g.age)) * g[quali], 0);
          };
          // (GE scollegati: non producono; restano nei dettagli in rosso)
          const geProd = processedGreatBuildings.filter(geCollegato);
          const geSpenti = processedGreatBuildings.filter(g => cityEntityIds.has(g.cityEntityId) && !geCollegato(g));

          const totalPFNormal = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "fp"), 0);
          const totalPFGB = geProd.reduce((sum, b) => sum + b.fp, 0);
          const totalPFB = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "fpb"), 0);
          // (senza le riserve della Royal Albert Hall: vanno alle ere delle fabbriche, vedi sotto)
          const totalBeniGB = geProd.reduce((sum, b) => sum + b.beni - (b.gbRiserve ?? 0), 0);
          const totalBeniPGB = geProd.reduce((sum, b) => sum + b.benip, 0);
          const totalBeniSGB = geProd.reduce((sum, b) => sum + b.benis, 0);
          // BeniSp (Beni Speciali): boost applicato tramite totalBeniSpB
          // (special_goods_production, agosto 2026) — separato da totalBeniB
          // (goods_production), che boosta solo Beni/BeniP/BeniS "normali".
          const totalBeniSpGB = geProd.reduce((sum, b) => sum + b.benisp, 0);
          const totalBeniSpB = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "benispb"), 0);
          const totalBeniB = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "benib"), 0);
          // Beni/BeniP/BeniS/BeniSp "boostati": ceil per-gruppo (vedi
          // boostedExactBuildingSum sopra), poi sommati su tutti gli edifici
          // città, poi sommata la quota Grandi Edifici (senza ceil aggiuntivo:
          // i GE non ricevono boost, il loro valore è già finale).
          const totalBeniBoosted = cityBuildings.reduce((sum, b) => sum + boostedExactBuildingSum(b, "beni", totalBeniB), 0) + totalBeniGB;
          const totalBeniPBoosted = cityBuildings.reduce((sum, b) => sum + boostedExactBuildingSum(b, "benip", totalBeniB), 0) + totalBeniPGB;
          const totalBeniSBoosted = cityBuildings.reduce((sum, b) => sum + boostedExactBuildingSum(b, "benis", totalBeniB), 0) + totalBeniSGB;
          const totalBeniSpBoosted = cityBuildings.reduce((sum, b) => sum + boostedExactBuildingSum(b, "benisp", totalBeniSpB), 0) + totalBeniSpGB;
          const totalBeniG = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "benig"), 0)
            + geProd.reduce((sum, b) => sum + b.benig, 0);

          // Beni per era (08/11/2026): ogni copia dà beni della sua era (beni),
          // dell'era prima (benip) e dell'era dopo (benis), con il bonus % dei beni
          // (ceil per gruppo, come boostedExactBuildingSum); i GE all'era del
          // giocatore. Edifici di tutte le ere: il loro "livello" non è un'era,
          // contano all'era attuale. Un'era inesistente (prima della prima o dopo
          // l'ultima) resta su quella della copia.
          const eraAttuale = AGE_BY_CODE.get(currentEra || FALLBACK_ERA)?.id ?? -1;
          const beniPerEra = new Map<number, number>();
          // dettaglio per edificio: era → id → nome, copie che danno quei beni, quantità
          // dettaglio per edificio: era → id → nome, copie, quantità (spento = copie scollegate:
          // v è quello che darebbero, mostrato a 0 in rosso)
          type VoceBeni = { nome: string; copie: number; v: number; spento?: boolean };
          const dettaglioBeni = new Map<number, Map<string, VoceBeni>>();
          const aggiungiBeni = (era: number, delta: number, v: number, chi?: { id: string; nome: string; copie: number; spento?: boolean }) => {
            if (v <= 0) return;
            const e = AGES_BY_ID.has(era + delta) ? era + delta : era;
            if (!chi?.spento) beniPerEra.set(e, (beniPerEra.get(e) ?? 0) + v);
            if (!chi) return;
            const m = dettaglioBeni.get(e) ?? new Map<string, VoceBeni>();
            dettaglioBeni.set(e, m);
            const k = chi.spento ? `${chi.id}#off` : chi.id;
            const x = m.get(k);
            if (x) { x.copie += chi.copie; x.v += v; } else m.set(k, { nome: chi.nome, copie: chi.copie, v, spento: chi.spento });
          };
          for (const b of cityBuildings) {
            const tutteLeEre = isAllAgeBuildingId(b.cityEntityId);
            const nome = gameNames.get(b.cityEntityId) ?? b.name;
            for (const g of gruppiCopie(b)) {
              const era = tutteLeEre ? eraAttuale : AGE_BY_CODE.get(g.age)?.id ?? eraAttuale;
              for (const [n, spento] of [[g.on, false], [g.off, true]] as const) {
                if (n <= 0) continue;
                const chi = { id: b.cityEntityId, nome, copie: n, spento };
                aggiungiBeni(era, 0, beniConBonus(g.s, "beni", totalBeniB) * n, chi);
                aggiungiBeni(era, -1, beniConBonus(g.s, "benip", totalBeniB) * n, chi);
                aggiungiBeni(era, 1, beniConBonus(g.s, "benis", totalBeniB) * n, chi);
              }
            }
          }
          // Riserve della Royal Albert Hall (Oro, age_reserves; utente 09/11): a ogni raccolta un
          // bene a caso fra le fabbriche di beni (G_) della città, collegate o no, ognuna con lo
          // stesso peso: valore atteso diviso fra le ere delle fabbriche (era dall'id, es.
          // G_IndustrialAge_… → Età industriale). Senza fabbriche non producono niente.
          const fabbriche = new Map<number, number>();
          cityEntityIds.forEach((n, id) => {
            if (!id.startsWith("G_")) return;
            const e = AGE_BY_CODE.get(id.split("_")[1] ?? "")?.id;
            if (e !== undefined && n > 0) fabbriche.set(e, (fabbriche.get(e) ?? 0) + n);
          });
          const nFabbriche = [...fabbriche.values()].reduce((s, n) => s + n, 0);
          for (const g of [...geProd, ...geSpenti]) {
            const chi = { id: g.cityEntityId, nome: gameNames.get(g.cityEntityId) ?? g.name, copie: 1, spento: !geCollegato(g) };
            const riserve = g.gbRiserve ?? 0;
            aggiungiBeni(eraAttuale, 0, g.beni - riserve, chi);
            if (riserve > 0 && nFabbriche > 0) fabbriche.forEach((n, e) => aggiungiBeni(e, 0, riserve * n / nFabbriche, chi));
            aggiungiBeni(eraAttuale, -1, g.benip, chi);
            aggiungiBeni(eraAttuale, 1, g.benis, chi);
          }
          // Castello (bacchetta v8 + castello.json): ricompensa giornaliera del suo livello,
          // PF e beni a caso dell'era attuale e della precedente (senza bonus % dei beni)
          const castello = livelloCastello !== null ? livelliCastello?.find(l => l.livello === livelloCastello) ?? null : null;
          const voceCastello = castello ? { id: "__castello", nome: t("prodCastle", uiLang, castello.livello), copie: 1 } : null;
          if (castello && voceCastello) {
            aggiungiBeni(eraAttuale, 0, castello.beni, voceCastello);
            aggiungiBeni(eraAttuale, -1, castello.beniPrec, voceCastello);
          }
          const ereBeni = [...beniPerEra].filter(([, v]) => v > 0).sort((x, y) => y[0] - x[0]);
          const totaleBeniEre = ereBeni.reduce((s, [, v]) => s + v, 0);
          const nomeBeniEra = (id: number) => {
            const a = AGES_BY_ID.get(id), n = a ? ageName(a.age, uiLang as Lang) : String(id);
            return uiLang === "en" ? `${n} goods` : `Beni ${n}`;
          };
          // (nel pannello dei frammenti il nome senza "Frammenti di" / "Fragments of")
          const senzaFrammenti = (s: string) => s.replace(/^(Frammenti di |Fragments of )/, "");
          const titoloPannello = (s: string) => <div className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-amber-400">{s}</div>;

          // Dettaglio per edificio (clic su una riga; restano aperte tutte quelle cliccate: righeProdAperte):
          // nome di gioco, ×copie, quantità al giorno (già con i bonus), dal più produttivo.
          // (spento: copie scollegate dalla strada, v = quanto darebbero; in fondo, in rosso, a 0)
          type VoceDett = { nome: string; copie: number; v: number; spento?: boolean };
          const ordina = (l: VoceDett[]) => [
            ...l.filter(x => !x.spento && x.v > 0).sort((x, y) => y.v - x.v || x.nome.localeCompare(y.nome)),
            ...l.filter(x => x.spento && x.v > 0).sort((x, y) => y.v - x.v || x.nome.localeCompare(y.nome)),
          ];
          const perEdificio = (val: (b: (typeof cityBuildings)[number], quali: "on" | "off") => number, ge?: (g: (typeof processedGreatBuildings)[number]) => number, altre: VoceDett[] = []): VoceDett[] => ordina([
            ...cityBuildings.flatMap(b => {
              const nome = gameNames.get(b.cityEntityId) ?? b.name, gr = gruppiCopie(b);
              const on = gr.reduce((s, g) => s + g.on, 0), off = gr.reduce((s, g) => s + g.off, 0);
              return [
                ...(on ? [{ nome, copie: on, v: val(b, "on") }] : []),
                ...(off ? [{ nome, copie: off, v: val(b, "off"), spento: true }] : []),
              ];
            }),
            ...(ge ? geProd.map(g => ({ nome: gameNames.get(g.cityEntityId) ?? g.name, copie: 1, v: ge(g) })) : []),
            ...(ge ? geSpenti.map(g => ({ nome: gameNames.get(g.cityEntityId) ?? g.name, copie: 1, v: ge(g), spento: true })) : []),
            ...altre,
          ]);
          const apri = (k: string) => setRigheProdAperte(s => { const n = new Set(s); if (!n.delete(k)) n.add(k); return n; });
          const freccia = (aperta: boolean | null) => aperta === null
            ? <span className="w-3 shrink-0" />
            : <ChevronRight size={12} strokeWidth={2.5} className={`shrink-0 text-slate-500 transition-transform duration-150 ${aperta ? "rotate-90 text-amber-400" : ""}`} />;
          /** Righe del dettaglio sotto una riga aperta: `celle` colonne, valore nella colonna `colValore` (0 = la prima). */
          const righeDettaglio = (k: string, elenco: VoceDett[], celle: number, colValore: number) => elenco.map(x => (
            <tr key={`${k}-${x.nome}-${x.spento ? "off" : "on"}`} className="border-b border-slate-800/30 bg-slate-900/40 text-[11px]"
              title={x.spento ? t("prodDisconnectedTitle", uiLang, formatInt(x.v)) : undefined}>
              <td className={`py-0.5 pl-8 pr-1 ${x.spento ? "text-red-400" : "text-slate-400"}`}>
                <span className="whitespace-nowrap">{x.nome}</span>
                {x.copie > 1 && <span className={`ml-1 font-mono ${x.spento ? "text-red-400" : "text-emerald-400"}`}>×{x.copie}</span>}
                {x.spento && <span className="ml-1 italic">{t("prodDisconnected", uiLang)}</span>}
              </td>
              {Array.from({ length: celle - 1 }, (_, i) => (
                <td key={i} className={`py-0.5 px-1 text-right font-mono ${x.spento ? "text-red-400" : "text-slate-300"}`}>{i + 1 === colValore ? (x.spento ? `(${formatInt(x.v)})` : formatInt(x.v)) : ""}</td>
              ))}
            </tr>
          ));
          const rigaGiornaliera = (key: string, icona: string, nome: string, valore: number, opz?: { evid?: boolean; ultima?: boolean; titolo?: string; dettaglio?: VoceDett[] }) => {
            const apribile = !!opz?.dettaglio?.length, aperta = apribile && righeProdAperte.has(key);
            return (
              <Fragment key={key}>
                <tr className={`${opz?.ultima ? "" : "border-b border-slate-800/50"} ${apribile ? "cursor-pointer hover:bg-slate-800/40" : ""} ${aperta ? "bg-slate-800/30" : ""}`}
                  onClick={apribile ? () => apri(key) : undefined} title={opz?.titolo ?? (apribile ? t("prodGoodsDetailTitle", uiLang) : undefined)}>
                  <td className="py-1 px-1 flex items-center gap-1">
                    {freccia(apribile ? aperta : null)}
                    <TableHeaderIcon src={icona} alt={nome} className="!h-4 !w-4 object-contain" />
                    <span className={`whitespace-nowrap ${opz?.evid ? "font-bold text-slate-100" : "text-slate-300"}`}>{nome}</span>
                  </td>
                  <td className={`py-1 px-1 text-right font-mono ${opz?.evid ? "font-bold text-amber-200" : "text-amber-300"}`}>{formatInt(valore)}</td>
                </tr>
                {aperta && righeDettaglio(key, opz!.dettaglio!, 2, 1)}
              </Fragment>
            );
          };

          return (
            <>
            {/* 2.011: due pannelli, frammenti e PF/beni (con i beni divisi per era); ogni riga si apre nel dettaglio per edificio */}
            <div className="border border-slate-800 bg-slate-950 p-2 text-xs w-max max-w-full overflow-x-auto">
              {titoloPannello(t("prodFragmentsPanel", uiLang))}
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="py-1 px-1 text-left">{t("prodColumnLabel", uiLang)}</th>
                    <th className="py-1 px-1 text-right">{t("prodColInStock", uiLang)}</th>
                    <th className="py-1 px-1 text-right">{t("prodColFragmentsPerDay", uiLang)}</th>
                    <th className="py-1 px-1 text-right">{t("prodColKitsPerMonth", uiLang)}</th>
                    <th className="py-1 px-1 text-right">{t("prodColKitsPerYear", uiLang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {prodTypes.map(pt => {
                    const campo = pt.key as keyof EraStats & keyof Building;
                    const totalFrPerDay = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, campo), 0);
                    const kitsPerYear = totalFrPerDay / pt.cost * 365;
                    const kitsPerMonth = kitsPerYear / 12;
                    const qty = (specialKits[pt.invKey] as number) ?? 0;
                    // (apribile anche se tutti i produttori sono scollegati: si vedono in rosso)
                    const dett = perEdificio((b, q) => exactBuildingSum(b, campo, q));
                    const k = `fr-${pt.key}`, aperta = righeProdAperte.has(k), apribile = dett.length > 0;
                    return (
                      <Fragment key={pt.key}>
                        <tr className={`border-b border-slate-800/50 ${apribile ? "cursor-pointer hover:bg-slate-800/40" : ""} ${aperta ? "bg-slate-800/30" : ""}`}
                          onClick={apribile ? () => apri(k) : undefined} title={pt.name}>
                          <td className="py-1 px-1 flex items-center gap-1">{freccia(apribile ? aperta : null)}<span className="text-sm">{pt.icon}</span><span className="text-slate-300 whitespace-nowrap">{senzaFrammenti(pt.name)}</span></td>
                          <td className={`py-1 px-1 text-right font-mono font-bold ${qty > 0 ? "text-emerald-300" : "text-slate-600"}`}>{formatInt(qty)}</td>
                          <td className="py-1 px-1 text-right font-mono text-amber-300">{formatInt(totalFrPerDay)}</td>
                          <td className="py-1 px-1 text-right font-mono text-emerald-300">{formatInt(kitsPerMonth)}</td>
                          <td className="py-1 px-1 text-right font-mono text-blue-300">{formatInt(kitsPerYear)}</td>
                        </tr>
                        {/* (frammenti al giorno di ogni edificio, nella colonna framm/g) */}
                        {aperta && righeDettaglio(k, dett, 5, 2)}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border border-slate-800 bg-slate-950 p-2 text-xs w-max min-w-[260px] max-w-full overflow-x-auto">
              {titoloPannello(t("prodFpGoodsPanel", uiLang))}
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="py-1 px-1 text-left">{t("prodColumnLabel", uiLang)}</th>
                    <th className="py-1 px-1 text-right">{t("dailyQuantityLabel", uiLang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* (dettagli: stessi calcoli dei totali, edificio per edificio) */}
                  {rigaGiornaliera("fp", iconFP, t("prodForgePoints", uiLang), (totalPFNormal * (1 + totalPFB)) + totalPFGB + (castello?.pf ?? 0),
                    { dettaglio: perEdificio((b, q) => exactBuildingSum(b, "fp", q) * (1 + totalPFB), g => g.fp, castello && voceCastello ? [{ nome: voceCastello.nome, copie: 1, v: castello.pf }] : []) })}
                  {rigaGiornaliera("benig", iconBeniG, t("prodGuildGoods", uiLang), totalBeniG,
                    { dettaglio: perEdificio((b, q) => exactBuildingSum(b, "benig", q), g => g.benig) })}
                  {rigaGiornaliera("benisp", iconBeniSp, t("prodGoodsSpecial", uiLang), totalBeniSpBoosted,
                    { dettaglio: perEdificio((b, q) => boostedExactBuildingSum(b, "benisp", totalBeniSpB, q), g => g.benisp) })}
                  {/* beni divisi per era, dalla più recente (con il dettaglio delle copie a quell'era); in fondo il totale */}
                  {ereBeni.map(([id, v]) => rigaGiornaliera(`era-${id}`, id === eraAttuale ? iconBeni : id < eraAttuale ? iconBeniP : iconBeniS, nomeBeniEra(id), v,
                    { dettaglio: ordina([...(dettaglioBeni.get(id)?.values() ?? [])]) }))}
                  {rigaGiornaliera("beni-tot", iconBeni, t("prodGoodsTotal", uiLang), totaleBeniEre, { evid: true, ultima: true,
                    // (tooltip: le tre quote rispetto alla tua era, come nel vecchio pannello, e il bonus % applicato)
                    titolo: `${t("prodGoodsCurrent", uiLang)}: ${formatInt(totalBeniBoosted)} · ${t("prodGoodsPrevious", uiLang)}: ${formatInt(totalBeniPBoosted)} · ${t("prodGoodsNext", uiLang)}: ${formatInt(totalBeniSBoosted)}`
                      + (totalBeniB > 0 ? `\n${t("prodGoodsBoostTitle", uiLang, Math.round(totalBeniB * 100))}` : "") })}
                </tbody>
              </table>
            </div>
            </>
          );
        })()}
        {isMilSummaryOpen && (() => {
          // Castello (bacchetta v8 + castello.json): +X% attacco e difesa all'esercito
          // attaccante / difensore, bonus permanente del livello
          const lc = livelloCastello !== null ? livelliCastello?.find(l => l.livello === livelloCastello) : undefined;
          const bonusCastello = lc ? { livello: lc.livello, att: lc.bonus.att_def_boost_attacker ?? 0, dif: lc.bonus.att_def_boost_defender ?? 0 } : null;
          return (
            <div className="border border-slate-800 bg-slate-950 p-2 space-y-2 text-xs w-max min-w-[420px] max-w-full overflow-x-auto">
              <div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="py-1 px-1 text-left">{t("statColLabel", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("statColFromBuildings", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("statColFromGB", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("statColFromAllies", uiLang)}</th>
                      {bonusCastello && <th className="py-1 px-1 text-right" title={t("statColCastleTitle", uiLang)}>{t("statColCastle", uiLang, bonusCastello.livello)}</th>}
                      <th className="py-1 px-1 text-right">{t("statColTotal", uiLang)}</th>
                      <th className="py-1 px-1 text-right" title={t("statColGbBonusTitle", uiLang)}>{t("statColGbBonus", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("statColTotalWithBonus", uiLang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsRows.map((row, idx) => {
                      const extraA = (row as { extraA?: number }).extraA ?? 0;
                      const extraD = (row as { extraD?: number }).extraD ?? 0;
                      // Castello: punti percentuali su attacco e difesa (righe rosse: esercito
                      // attaccante, blu: difensore), nel totale PRIMA dei moltiplicativi dei GE; non nelle IQ
                      const cas = !bonusCastello || row.modalita === "guild_raids" ? 0 : row.color === "red" ? bonusCastello.att : bonusCastello.dif;
                      const totalA = row.bA + row.gA + row.aA + extraA + cas;
                      const totalD = row.bD + row.gD + row.aD + extraD + cas;
                      const colorClass = row.color === "red" ? "text-red-400" : "text-blue-400";
                      // Bonus moltiplicativi dei GE sul totale: quelli della modalità
                      // più quelli globali (tranne nelle IQ, dove i boost globali della
                      // città non contano), sommati fra loro (ipotesi: additivi)
                      const s0 = row.color === "red" ? 0 : 2;
                      const pct = (slot: number) => moltGe(row.modalita, slot) + (row.modalita !== "all" && row.modalita !== "guild_raids" ? moltGe("all", slot) : 0);
                      const pA = pct(s0), pD = pct(s0 + 1);
                      const bonA = Math.round(totalA * pA / 100), bonD = Math.round(totalD * pD / 100);
                      // come nel gioco: "36,7k / 34,1k" (IQ: numeri piccoli, interi)
                      const fm = (a: number, d: number) => row.modalita === "guild_raids" ? `${formatInt(a)} / ${formatInt(d)}` : `${formatMilK(a)} / ${formatMilK(d)}`;
                      return (
                        <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                          <td className={`py-0.5 px-1 font-semibold ${colorClass}`}>{row.label}</td>
                          <td className="py-0.5 px-1 text-right font-mono">{fm(row.bA, row.bD)}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-amber-400/80">{fm(row.gA, row.gD)}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-slate-400">{fm(row.aA, row.aD)}</td>
                          {bonusCastello && <td className="py-0.5 px-1 text-right font-mono text-violet-300">{cas ? fm(cas, cas) : <span className="text-slate-600">{fm(0, 0)}</span>}</td>}
                          <td className={`py-0.5 px-1 text-right font-mono font-bold cursor-help ${colorClass}`} title={`${formatInt(totalA)} / ${formatInt(totalD)}`}>{fm(totalA, totalD)}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-amber-300" title={t("statGbBonusCellTitle", uiLang, pA, pD)}>
                            {pA || pD ? <>{fm(bonA, bonD)} <span className="text-[10px] text-amber-300/70">(+{pA}%/+{pD}%)</span></> : <span className="text-slate-600">{fm(0, 0)}</span>}
                          </td>
                          <td className={`py-0.5 px-1 text-right font-mono font-bold cursor-help ${colorClass}`} title={`${formatInt(totalA + bonA)} / ${formatInt(totalD + bonD)}`}>{fm(totalA + bonA, totalD + bonD)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-[9px] text-slate-400 italic text-center pt-0.5">{t("statTotalsFootnote", uiLang)}</p>
            </div>
          );
        })()}
      </>
    );
  };

  const renderCityUpgradeableTable = (
    title: string,
    rows: typeof cityUpgradeableData.upgradable,
    maxLevelClass: string,
  ) => {
    if (rows.length === 0) return null;

    return (
      <div className="overflow-hidden border border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950/40 px-4 py-2">
          <h4 className="text-sm font-black uppercase tracking-[0.15em] text-amber-400">{title}</h4>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-1.5 text-[10px] font-bold text-slate-400">
            {rows.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-950/60 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                <th className="px-3 py-2 text-left">{t("colBuilding", uiLang)}</th>
                <th className="px-2 py-2 text-center">{t("colInCity", uiLang)}</th>
                <th className="px-2 py-2 text-center">{t("colCurrentLevel", uiLang)}</th>
                <th className="px-2 py-2 text-center">{t("colMaxLevel", uiLang)}</th>
                <th className="px-3 py-2 text-left">{t("colAvailableKits", uiLang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rows.map((r) => (
                <tr key={`${title}-${r.bld_id}-${r.kit_id}`} className="hover:bg-slate-950/40 transition-colors">
                  <td className="px-3 py-2 align-middle">
                    <div className="font-semibold text-slate-200">{r.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-600">{r.bld_id}</div>
                  </td>
                  <td className="px-2 py-2 text-center align-middle">
                    <span className="inline-flex min-w-8 items-center justify-center rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-sm font-bold text-slate-300">
                      ×{r.qty}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center align-middle">
                    <span className="inline-flex rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs font-bold text-amber-300">
                      {r.current_level}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center align-middle">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-bold ${maxLevelClass}`}>
                      {r.max_level}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="space-y-1">
                      {r.breakdown.map((k) => {
                        const hasProducers = k.producers.length > 0;
                        return (
                          <div key={`${r.bld_id}-${r.kit_id}-${k.id}`} className="flex items-center gap-2 border border-slate-800/80 bg-slate-950/40 px-2 py-1">
                            <div className="min-w-0 flex-1 truncate">
                              {hasProducers ? (
                                <span
                                  className="text-sm font-medium text-emerald-300 truncate cursor-help underline decoration-dotted decoration-emerald-500/40 underline-offset-2"
                                  onMouseEnter={(e) => {
                                    const r2 = e.currentTarget.getBoundingClientRect();
                                    setKitProducersTooltip({
                                      x: r2.left,
                                      y: r2.bottom,
                                      producers: k.producers.map((id) => ({ id, name: displayName(id, ITALIAN_NAMES.get(id) ?? id, uiLang) })),
                                    });
                                  }}
                                  onMouseLeave={() => setKitProducersTooltip(null)}
                                >
                                  {k.name}
                                </span>
                              ) : (
                                <div className="text-sm font-medium text-slate-300 truncate">{k.name}</div>
                              )}
                            </div>
                            <div className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold ${k.qty > 0 ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-slate-900 text-slate-600 border border-slate-800"}`}>
                              {k.qty > 0 ? `×${k.qty}` : "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // I 5 pulsanti azione profilo (🪄 💾 📤 🗑️ ?). Estratti in una funzione per
  // riusarli sia nella riga del logo (mobile) sia nella barra profili (desktop)
  // senza duplicare il markup.
  // ── FoE Optimizer 2.0: testata a schede + nastro (ui/Testata.tsx) ──────────
  // Le schede guidano lo stato di sempre (activeTab, showPlanner); Opzioni e
  // Guida hanno solo il nastro (il contenuto sotto resta quello dell'ultima
  // scheda di lavoro). Le vecchie barre restano sotto finché ogni scheda non
  // avrà il suo nastro completo.
  const schedaCorrente: Scheda = schedaExtra ?? (activeTab === "database" ? "database"
    : activeTab === "propria_citta" ? (showPlanner ? "planner" : "citta")
    : activeTab === "inventario" ? "inventario" : activeTab === "alleati" ? (alleatiDaDb ? "database" : "alleati") : "insediamenti");
  const scegliScheda = (sc: Scheda) => {
    if (sc === "opzioni" || sc === "guida") { setSchedaExtra(sc); return; }
    setSchedaExtra(null);
    if (sc === "database") {
      if (catalogo === "alleati") { setAlleatiDaDb(true); setActiveTab("alleati"); } else setActiveTab("database");
    }
    else if (sc === "citta") { setActiveTab("propria_citta"); setShowPlanner(false); }
    else if (sc === "planner") { setActiveTab("propria_citta"); setShowPlanner(true); }
    else if (sc === "inventario") setActiveTab("inventario");
    else if (sc === "alleati") { setAlleatiDaDb(false); setActiveTab("alleati"); }
    else setActiveTab("pirati");
  };
  // Link diretti alle schede (#planner, #city, …): all'avvio e quando l'hash
  // cambia si apre la scheda indicata (nomi inglesi o italiani), poi l'hash
  // si toglie dall'indirizzo (replaceState). Cambiando scheda l'indirizzo NON
  // cambia (scelta dell'autore). Una scheda spenta (es. #city senza città) la
  // gestisce l'effetto "schedaSpenta" più sotto.
  useEffect(() => {
    const daHash = () => {
      const sc = HASH_SCHEDA[window.location.hash.slice(1).toLowerCase()];
      if (!sc) return;
      scegliScheda(sc);
      history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    daHash();
    window.addEventListener("hashchange", daHash);
    return () => window.removeEventListener("hashchange", daHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setCatalogo = (c: "edifici" | "alleati" | "ge") => {
    setCatalogoStato(c);
    if (c === "alleati") { setAlleatiDaDb(true); setActiveTab("alleati"); } else { setAlleatiDaDb(false); setActiveTab("database"); }
  };
  const haCitta = cityMapBuildings.length > 0;
  // Intestazione Forge Hammer dei JSON esportati (player, region dalla lingua
  // del gioco, era): quella della città selezionata.
  useEffect(() => {
    const p = profiles.find(x => x.id === activeProfileId);
    impostaMetaExport(haCitta ? {
      player: { id: p?.playerId ?? null, name: p?.name ?? "" },
      region: gameLang,
      ...(currentEra ? { currentEra } : {}),
      cittaReale: cityMapBuildings,
      grandiEdifici: new Map([...greatBuildingsJson].map(([id, gb]) => [id, (gb.rawEntry ?? {}) as Record<string, unknown>])),
    } : {});
  }, [haCitta, profiles, activeProfileId, gameLang, currentEra, cityMapBuildings, greatBuildingsJson]);
  // Planner: tipi militari con almeno una copia collegata alla strada in città
  // (valore iniziale degli interruttori "Edifici militari da collegare a strada").
  const militariCollegatiOra = useMemo(() => {
    const out = new Set<string>();
    for (const b of cityMapBuildings) {
      if (!b.isMilitary || out.has(b.entityId)) continue;
      const tot = cityEntityIds.get(b.entityId) ?? 0;
      if (tot - (cityEntityDisconnected.get(b.entityId) ?? 0) > 0) out.add(b.entityId);
    }
    return out;
  }, [cityMapBuildings, cityEntityIds, cityEntityDisconnected]);
  // Planner: istanze che richiedono strada ma in città sono scollegate (interruttori
  // "Edifici scollegati in città"). Dall'import con istanzeScollegate (dal 09/11); nei
  // profili importati prima si sa solo quante: le si prendono solo se lo sono tutte.
  const scollegatiOra = useMemo(() => {
    if (istanzeScollegate) return new Set(istanzeScollegate.map(x => x[0]));
    const out = new Set<string>();
    for (const b of cityMapBuildings) {
      if (b.type === "street" || b.isGreatBuilding) continue;
      const tot = cityEntityIds.get(b.entityId) ?? 0, off = cityEntityDisconnected.get(b.entityId) ?? 0;
      if (tot > 0 && off >= tot) out.add(b.mapEntityId);
    }
    return out;
  }, [istanzeScollegate, cityMapBuildings, cityEntityIds, cityEntityDisconnected]);
  // Il Planner può usare la città selezionata solo se ha mappa e aree sbloccate.
  const haCittaPlanner = haCitta && cityMapUnlockedCells.size > 0;
  // 2.0: Mappa della città importata da JSON nel Planner (stessi dati che
  // CityMapView riceve per la città selezionata, calcolati dal file).
  const mappaJson = useMemo(() => {
    if (!plannerJson) return null;
    const { buildings, cells, aree } = plannerJson.citta;
    const grid = new Set<string>();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of buildings) {
      for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) grid.add(`${b.x + dx},${b.y + dy}`);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    }
    for (const c of cells) {
      const [x, y] = c.split(",").map(Number) as [number, number];
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y + 1);
    }
    const bounds = minX < Infinity ? { minX: minX - 1, minY: minY - 1, maxX: maxX + 1, maxY: maxY + 1 } : null;
    return { buildings, cells, aree, grid, bounds, nome: plannerJson.citta.nome };
  }, [plannerJson]);
  /** 2.0: città "ridotta" da un file JSON → nel selettore come città visitata. */
  const importaCittaJson = async (file: File) => {
    let conv: ReturnType<typeof cittaDaJson>;
    try {
      impostaCatalogoExtra(await caricaBuildingsExtra());
      conv = cittaDaJson(await file.text());
    } catch (err) {
      alert(t("plannerInvalidJson", uiLang, err instanceof Error ? err.message : String(err)));
      return;
    }
    // senza nome del giocatore nel file: il nome del file
    if (!conv.data.playerName) conv.data.playerName = file.name.replace(/\.json$/i, "");
    await importaPayload(conv.data, true);
    if (conv.ignorati.length) {
      const ids = [...new Set(conv.ignorati)];
      alert(t("plannerJsonIgnored", uiLang, conv.ignorati.length, ids.join(", ")));
    }
  };
  const importaJsonPlanner = async (file: File) => {
    try {
      // catalogo degli edifici fuori Database (militari, municipi, strade...):
      // serve ai file senza CityEntities, es. l'export di Forge Hammer
      impostaCatalogoExtra(await caricaBuildingsExtra());
      const citta = { nome: file.name.replace(/\.json$/i, ""), ...leggiCittaJson(await file.text()) };
      setPlannerJson(prev => ({ citta, n: (prev?.n ?? 0) + 1 }));
      setPlannerSorgente("json");
      setPlannerErrore(null);
    } catch (err) {
      setPlannerErrore(t("plannerInvalidJson", uiLang, err instanceof Error ? err.message : String(err)));
    }
  };
  const importaDaNastro = () => { void handleWandClick({ preventDefault() {} } as unknown as React.MouseEvent); };
  // Schede spente (2.0): senza città restano Database (con il catalogo
  // Alleati), Planner (con la sorgente JSON), Insediamenti (l'avamposto si
  // importa a parte), Opzioni e Guida; città visitata = solo mappa (niente
  // Inventario e Alleati).
  const tipoAttiva = vociCitta.find(c => c.id === activeProfileId)?.tipo;
  const soloMie = t("r2OnlyMine", uiLang), serveCitta = t("r2NeedCity", uiLang);
  const spente: Partial<Record<Scheda, string>> = !haCitta
    ? { citta: serveCitta, inventario: serveCitta, alleati: serveCitta }
    : tipoAttiva === "visitata" ? { inventario: soloMie, alleati: soloMie } : {};
  // se la scheda aperta si spegne (città eliminata, città visitata scelta) si torna su Città o Database
  const schedaSpenta = !!spente[schedaCorrente];
  useEffect(() => {
    if (schedaSpenta) scegliScheda(haCitta ? "citta" : "database");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedaSpenta]);
  // Le 23 produzioni filtrabili (nastro: menu Produzione; vecchia barra: icone).
  const opzioniProduzione: OpzioneProduzione[] = [
    { key: "mon", icon: <img src={iconMon} alt={t("prodCoins", uiLang)} className="icon-16" />, title: t("prodCoins", uiLang) },
    { key: "mat", icon: <img src={iconMat} alt={t("prodMaterials", uiLang)} className="icon-16" />, title: t("prodMaterials", uiLang) },
    { key: "fp", icon: <img src={iconFP} alt={t("prodForgePoints", uiLang)} className="icon-16" />, title: t("prodForgePoints", uiLang) },
    { key: "fpb", icon: <img src={iconFPB} alt={t("prodForgePointsBoost", uiLang)} className="icon-16" />, title: t("prodForgePointsBoost", uiLang) },
    { key: "med", icon: <img src={iconMed} alt={t("prodMedals", uiLang)} className="icon-16" />, title: t("prodMedals", uiLang) },
    { key: "fur", icon: <img src={iconFUR} alt={t("prodRogues", uiLang)} className="icon-16" />, title: t("prodRogues", uiLang) },
    { key: "tr", icon: <img src={iconTR} alt={t("prodUnitsCurrentEra", uiLang)} className="icon-16" />, title: t("prodUnitsCurrentEra", uiLang) },
    { key: "trne", icon: <img src={iconTRNE} alt={t("prodUnitsNextEra", uiLang)} className="icon-16" />, title: t("prodUnitsNextEra", uiLang) },
    { key: "beni", icon: <img src={iconBeni} alt={t("prodGoodsCurrent", uiLang)} className="icon-16" />, title: t("prodGoodsCurrent", uiLang) },
    { key: "benib", icon: <img src={iconBeniB} alt={t("prodGoodsBoost", uiLang)} className="icon-16" />, title: t("prodGoodsBoost", uiLang) },
    { key: "benip", icon: <img src={iconBeniP} alt={t("prodGoodsPrevious", uiLang)} className="icon-16" />, title: t("prodGoodsPrevious", uiLang) },
    { key: "benis", icon: <img src={iconBeniS} alt={t("prodGoodsNext", uiLang)} className="icon-16" />, title: t("prodGoodsNext", uiLang) },
    { key: "benisp", icon: <img src={iconBeniSp} alt={t("prodGoodsSpecial", uiLang)} className="icon-16" />, title: t("prodGoodsSpecial", uiLang) },
    { key: "benispb", icon: <img src={iconBeniSpB} alt={t("prodGoodsSpecialBoost", uiLang)} className="icon-16" />, title: t("prodGoodsSpecialBoost", uiLang) },
    { key: "benig", icon: <img src={iconBeniG} alt={t("prodGuildGoods", uiLang)} className="icon-16" />, title: t("prodGuildGoods", uiLang) },
    { key: "bp", icon: <img src={iconBP} alt={t("prodBlueprints", uiLang)} className="icon-16" />, title: t("prodBlueprints", uiLang) },
    { key: "fsp", icon: <img src={iconFSP} alt={t("prodRushSpecial", uiLang)} className="icon-16" />, title: t("prodRushSpecial", uiLang) },
    { key: "tpm", icon: <img src={iconTPM} alt={t("prodRushMaterials", uiLang)} className="icon-16" />, title: t("prodRushMaterials", uiLang) },
    { key: "tpb", icon: <img src={iconTPB} alt={t("prodRushGoods", uiLang)} className="icon-16" />, title: t("prodRushGoods", uiLang) },
    { key: "adm", icon: <img src={iconAiuto} alt={t("prodMassAid", uiLang)} className="icon-16" />, title: t("prodMassAid", uiLang) },
    { key: "mod", icon: <img src={iconOneUp} alt={t("prodOneUpKit", uiLang)} className="icon-16" />, title: t("prodOneUpKit", uiLang) },
    { key: "rin", icon: <img src={iconRinn} alt={t("prodRenovationKit", uiLang)} className="icon-16" />, title: t("prodRenovationKit", uiLang) },
    { key: "imm", icon: <img src={iconImm} alt={t("prodStoreBuilding", uiLang)} className="icon-16" />, title: t("prodStoreBuilding", uiLang) },
    
  ];

  const gruppiNastro = costruisciNastri(schedaCorrente, {
    uiLang, ricerca: searchTerm, setRicerca: setSearchTerm,
    onEliminaTutte: deleteAllProfiles, onImportaCittaJson: () => cittaJsonRef.current?.click(), onEsporta: () => { void handleExportSession(); }, onRipristina: () => { setImportError(""); setImportSuccess(""); setIsImportModalOpen(true); },
    haCitteSalvate: profiles.length > 0,
    haCitta, mappa: showCityMap,
    onMappa: () => { const v = !showCityMap; setShowCityMap(v); localStorage.setItem(SHOW_CITY_MAP_KEY, String(v)); },
    tema, setTema, informazioni: { attivo: pannelloGuida === "info", cambia: () => setPannelloGuida(p => (p === "info" ? null : "info")) },
    comeImportare: { attivo: pannelloGuida === "importa", cambia: () => setPannelloGuida(p => (p === "importa" ? null : "importa")) },
    novita: { attivo: pannelloGuida === "novita", cambia: () => setPannelloGuida(p => (p === "novita" ? null : "novita")) },
    comeUsarePlanner: { attivo: pannelloGuida === "planner", cambia: () => setPannelloGuida(p => (p === "planner" ? null : "planner")) },
    filtri: {
      uiLang,
      eventi: EVENTS_LIST.map(ev => ({ id: ev.id, nome: eventName(ev, uiLang), gruppo: ev.isGroup })),
      evento: currentFilters.showEventFilter, setEvento: (id) => updateFilter("showEventFilter", id),
      produzioni: opzioniProduzione, prodSel: currentFilters.prodFilter, prodNo: currentFilters.prodNo, toggleProd: toggleProdFilter,
      azzeraProd: () => { updateFilter("prodFilter", new Set()); updateFilter("prodNo", new Set()); },
      tuttiProd: (stato) => {
        const tutte = new Set(opzioniProduzione.map(o => o.key));
        updateFilter("prodFilter", stato === "si" ? tutte : new Set());
        updateFilter("prodNo", stato === "no" ? tutte : new Set());
      },
      prodModo: currentFilters.prodFilterMode, setProdModo: (m) => updateFilter("prodFilterMode", m),
      effMin: currentFilters.minEff, setEffMin: (v) => updateFilter("minEff", v),
      categorie: currentFilters.categorie, toggleCategoria,
      azzera: resetFilters,
      extra: schedaCorrente === "citta" ? [
        { id: "declassabili", label: t("r2Declassable", uiLang), title: t("showOnlyDeclassableTitle", uiLang), checked: showOnlyDeclassable,
          toggle: () => setShowOnlyDeclassable(v => !v), disabled: declassableBuildings.size === 0 && !showOnlyDeclassable },
      ] : schedaCorrente === "database" && catalogo !== "ge" ? [
        { id: "invecchiabili", label: t("r2Declassable", uiLang), title: t("showOnlyDeclassableDbTitle", uiLang), checked: soloInvecchiabiliDb,
          toggle: () => setSoloInvecchiabiliDb(v => !v), disabled: !BUILDINGS_FROM_CSV.some(b => b.invecchiabile) && !soloInvecchiabiliDb },
      ] : schedaCorrente === "inventario" ? [
        { id: "invecchiabili", label: t("r2Declassable", uiLang), title: t("showOnlyDeclassableDbTitle", uiLang), checked: soloInvecchiabiliInv,
          toggle: () => setSoloInvecchiabiliInv(v => !v) },
      ] : undefined,
      era: schedaCorrente === "inventario" ? {
        valore: eraInventario, imposta: setEraInventario,
        opzioni: ereInventario.map(id => { const a = AGES_BY_ID.get(id); return { id, nome: a ? ageName(a.age, uiLang as Lang) : String(id) }; }),
      } : schedaCorrente === "citta" ? {
        valore: eraCitta, imposta: setEraCitta,
        opzioni: ereCitta.map(id => { const a = AGES_BY_ID.get(id); return { id, nome: a ? ageName(a.age, uiLang as Lang) : String(id) }; }),
      } : undefined,
      beniEra: schedaCorrente === "inventario" ? {
        valore: beniEraInventario, imposta: setBeniEraInventario,
        opzioni: ereBeniInventario.map(id => { const a = AGES_BY_ID.get(id); return { id, nome: a ? ageName(a.age, uiLang as Lang) : String(id) }; }),
      } : schedaCorrente === "citta" ? {
        valore: beniEraCitta, imposta: setBeniEraCitta,
        opzioni: ereBeniCitta.map(id => { const a = AGES_BY_ID.get(id); return { id, nome: a ? ageName(a.age, uiLang as Lang) : String(id) }; }),
      } : undefined,
    },
    catalogo, setCatalogo,
    livelloGe: { valore: livelloGe, imposta: setLivelloGe },
    tierGe: { valore: tierGe, imposta: setTierGe },
    alleati: {
      rarita: Allies.RARITY_LEVELS.map(rarity => {
        const d = Allies.RARITY_DISPLAY[rarity]!;
        const attiva = allyRarityFilters[rarity] !== false;
        return {
          id: rarity, etichetta: d.label, attiva, classiOn: d.badgeOn, classiOff: d.badgeOff, cambia: () => toggleRarityFilter(rarity),
          titolo: attiva ? t("hideRarityTitle", uiLang, Allies.rarityName(rarity, uiLang)) : t("showRarityTitle", uiLang, Allies.rarityName(rarity, uiLang)),
        };
      }),
      militari: mostraMilitari, cambiaMilitari: () => setMostraMilitari(v => !v),
      scienza: mostraScienza, cambiaScienza: () => setMostraScienza(v => !v),
      frammenti: schedaCorrente === "alleati" ? { attivo: mostraFrammentiAlleati, cambia: () => setMostraFrammentiAlleati(v => !v) } : undefined,
      conteggi: schedaCorrente === "alleati" ? conteggiAlleati : undefined,
    },
    livello100: { attivo: alleatiLivello100, cambia: () => setAlleatiLivello100(v => !v) },
    consigliere: {
      attivo: mostraConsigliere, cambia: () => setMostraConsigliere(v => !v),
      disponibile: !!playerResources && importedAllies.some(a => !a.isFragment),
      gettoni: playerResources ? playerResources[VALOR_RESOURCE] ?? 0 : null,
    },
    pergamene: {
      attivo: mostraPergamene, cambia: () => setMostraPergamene(v => !v),
      n: playerResources ? playerResources[PERGAMENE_RESOURCE] ?? 0 : null,
    },
    planner: {
      sorgente: plannerSorgente === "json" || !haCittaPlanner ? "json" : "citta",
      haCitta: haCittaPlanner,
      setSorgente: (v: "citta" | "json") => { if (v === "json" && !plannerJson) plannerFileRef.current?.click(); else setPlannerSorgente(v); },
      jsonNome: plannerJson?.citta.nome ?? null,
      onImportaJson: () => plannerFileRef.current?.click(),
      // X sul nome del file: si chiude il JSON e si torna alla città selezionata (se c'è)
      onChiudiJson: () => { setPlannerJson(null); setPlannerErrore(null); if (haCittaPlanner) setPlannerSorgente("citta"); },
      gruppi: gruppiPlanner,
    },
    insediamenti: { gruppi: gruppiPirati },
    giocatore: (() => {
      // Planner con un JSON: il giocatore del file (se lo ha: nostro export, Hammer)
      if (schedaCorrente === "planner" && plannerSorgente === "json") {
        const g = plannerJson?.citta.giocatore;
        return g ? { nome: g.nome, avatar: null, era: g.era ? ageName(g.era, gameLang) : null, id: g.id, visitata: false, daJson: true } : null;
      }
      if (!haCitta) return null;
      const p = profiles.find(x => x.id === activeProfileId);
      return {
        nome: p?.name ?? "",
        avatar: portraitUrl || null,
        era: currentEra ? ageName(currentEra, gameLang) : null,
        id: p?.playerId ?? null,
        // città da JSON: è "visitata" per il modello, ma nel suggerimento si dice che viene da un file
        visitata: tipoAttiva === "visitata" && p?.origine !== "json",
        daJson: p?.origine === "json",
      };
    })(),
    tri: { stati: currentFilters.tri, gira: giraTri },
    bonusGe: { attivo: bonusGeTabella, cambia: () => setBonusGeTabella(v => !v), disponibile: !!pctBonusGe },
    esporta: {
      n: selectedIds.size, onClick: exportSelectedAsCsv,
      titolo: selectedIds.size === 0 ? t("exportSelectFirstTitle", uiLang) : t("exportSelectedCsvTitle", uiLang, selectedIds.size),
    },
    debug: schedaCorrente === "inventario"
      ? { attivo: isInventoryDebugOpen, cambia: () => setIsInventoryDebugOpen(v => !v) }
      : { attivo: isDebugOpen, cambia: () => setIsDebugOpen(v => !v) },
    citta: {
      inventario: { attivo: showInventoryInCity, cambia: () => setShowInventoryInCity(v => !v) },
      // stesso export JSON del pulsante JSON del pannello MAPPA (CityMapView)
      onEsportaJson: () => scaricaJson(esportaCittaJson(cityMapBuildings, cityMapUnlockedAreas), `${prefissoFile(profiles.find(x => x.id === activeProfileId)?.name)}-map-${localDateStamp()}.json`),
      statistiche: {
        aggiornabili: { attivo: isCityUpgradeableOpen, cambia: () => setIsCityUpgradeableOpen(v => !v) },
        strade: { attivo: isRoadSummaryOpen, cambia: () => setIsRoadSummaryOpen(v => !v) },
        produzione: { attivo: isProdSummaryOpen, cambia: () => setIsProdSummaryOpen(v => !v) },
        militari: { attivo: isMilSummaryOpen, cambia: () => setIsMilSummaryOpen(v => !v) },
        era: { attivo: isOutdatedSummaryOpen, cambia: () => setIsOutdatedSummaryOpen(v => !v) },
      },
    },
    vista: {
      dettaglioProd: { attivo: showProdColumnsPref, cambia: () => setShowProdColumns(v => !v) },
      somme: { attivo: showSigmaColumns, cambia: () => setShowSigmaColumns(v => !v) },
      iqProd: { attivo: showIqProdColumns, cambia: () => setShowIqProdColumns(v => !v) },
      pop: { attivo: showPopColumn, cambia: () => setShowPopColumn(v => !v) },
      fel: { attivo: showFelColumn, cambia: () => setShowFelColumn(v => !v) },
      sped: { attivo: showSpedColumnsPref, cambia: () => setShowSpedColumns(v => !v) },
    },
    spedNeiPesi: spedizioniEnabled,
    pesi: {
      uiLang, difesa: generalDefense, setDifesa: setGeneralDefense,
      spedizioni: spedizioniEnabled, setSpedizioni: setSpedizioniEnabled,
      spedAttacco: spedizioniAttack, setSpedAttacco: setSpedizioniAttack,
      onAiuto: () => setIsEfficiencyHelpOpen(v => !v), aiutoAperto: isEfficiencyHelpOpen,
    },
  });

  return (
    // h-dvh/overflow-hidden SOLO sulla tab Pirati: è il primo anello della
    // catena di vincolo di altezza reale che il planner (PiratiTool) ha
    // bisogno per ridimensionarsi correttamente — con min-h-screen (le altre
    // tab, scroll pagina naturale) il div poteva sempre crescere oltre il
    // viewport per accomodare il contenuto, quindi anche con min-h-0/
    // overflow-hidden su main/section il planner finiva comunque per far
    // scrollare l'INTERA pagina invece di ridimensionarsi internamente.
    // ⚠️ h-dvh (dynamic viewport height), non h-screen (100vh fisso): su
    // Chrome mobile, 100vh include l'area coperta dalla barra indirizzi (che
    // appare/scompare durante lo scroll/al caricamento), quindi il primo
    // render calcolava un'altezza sbagliata prima che il browser assestasse
    // la UI — bug segnalato dall'utente (screenshot): aprendo la tab Pirati
    // da mobile in verticale il planner non appariva affatto (altezza reale
    // collassata a ~0 dall'overflow-hidden a cascata), appariva ma senza
    // scroll ruotando in orizzontale (un vero resize forzava un ricalcolo),
    // e tornava a funzionare correttamente ruotando di nuovo in verticale
    // (secondo resize reale). h-dvh si aggiorna in base alla viewport
    // EFFETTIVAMENTE visibile in ogni momento, incluse le barre browser
    // mobile — nessun bisogno di listener aggiuntivi su resize/
    // orientationchange, il browser lo ricalcola da solo ad ogni frame.
    <div className={`bg-slate-950 text-slate-100 flex flex-col font-sans ${activeTab === "pirati" ? "h-dvh overflow-hidden" : "min-h-screen"}`}>
      <Testata scheda={schedaCorrente} onScheda={scegliScheda}
        spente={spente}
        citta={vociCitta} cittaAttiva={activeProfileId} onSelezionaCitta={switchProfile}
        onEliminaCitta={(id) => deleteProfile(id, false)} onRinominaCitta={rinominaCitta} onImportaCittaJson={() => cittaJsonRef.current?.click()} onImporta={importaDaNastro}
        avviso={avvisoCitta} onChiudiAvviso={chiudiAvviso}
        versione={__BUILD_VERSION__} gruppi={gruppiNastro}
        uiLang={uiLang} onLingua={handleUiLangChange} avatar={portraitUrl || null} />
      <input ref={plannerFileRef} type="file" accept=".json,application/json" className="hidden"
        onChange={e => { const f = e.currentTarget.files?.[0]; if (f) void importaJsonPlanner(f); e.currentTarget.value = ""; }} />
      <input ref={cittaJsonRef} type="file" accept=".json,application/json" className="hidden"
        onChange={e => { const f = e.currentTarget.files?.[0]; if (f) void importaCittaJson(f); e.currentTarget.value = ""; }} />

      {/* 2.0: la vecchia barra (Light/Full, ricerca, categoria, eventi, pesi,
          colonne, produzioni) non c'è più: Database, Città e Inventario hanno il
          nastro, i pesi sono in Opzioni. */}

      {/* 2.0: la vecchia barra degli alleati (ricerca, pesi, Σ, rarità) è nel
          nastro (Filtri alleati, Visualizza) e in Opzioni (pesi). */}

      {/* min-h-0/overflow-hidden SOLO sulla tab Pirati: il planner (dentro
          PiratiTool) ha bisogno di un vincolo di altezza REALE propagato
          dall'alto per potersi ridimensionare (vedi commento su gridWrapperSize
          in PiratiTool.tsx) — le altre tab restano scrollabili come sempre
          (nessun min-h-0/overflow-hidden), quindi la classe è condizionale. */}
      <main className={`flex-1 px-2 ${activeTab === "database" || activeTab === "propria_citta" || activeTab === "inventario" || (activeTab === "alleati" && alleatiDaDb) ? "pt-0" : "pt-1"} pb-4 flex flex-col gap-4 ${activeTab === "pirati" ? "min-h-0 overflow-hidden" : ""}`}>

        <section className={`flex-1 flex flex-col gap-2 ${activeTab === "pirati" ? "min-h-0 overflow-hidden" : ""}`}>

          {/* 2.0: pannelli della Guida (sopra il contenuto dell'ultima scheda di lavoro) */}
          {/* 2.0: Opzioni › Pesi statistiche › "?": come si calcola l'efficienza (prima era un popup) */}
          {schedaCorrente === "opzioni" && isEfficiencyHelpOpen && (
            <div className="px-3 py-2">
              <PannelloEfficienza uiLang={uiLang} difesa={generalDefense} spedizioni={spedizioniEnabled} spedAttacco={spedizioniAttack} onChiudi={() => setIsEfficiencyHelpOpen(false)} />
            </div>
          )}
          {schedaCorrente === "guida" && pannelloGuida !== null && (
            <div className="px-3 py-2">
              {pannelloGuida === "info" ? <PannelloInformazioni uiLang={uiLang} versione={__BUILD_VERSION__} />
                : pannelloGuida === "importa" ? <PannelloImporta uiLang={uiLang} />
                : pannelloGuida === "novita" ? <PannelloNovita uiLang={uiLang} />
                : <VideoTutorial uiLang={uiLang} />}
            </div>
          )}
          
          {/* 2.0: avatar ed era sono nel gruppo "Giocatore" del nastro; il riquadro
              compare solo con un pannello aperto (Statistiche, Debug, Cambio era). */}
          {activeTab === "propria_citta" && !showPlanner && cityEntityIds.size > 0 && (isRoadSummaryOpen || isProdSummaryOpen || isMilSummaryOpen || isDebugOpen || isOutdatedSummaryOpen || isCityUpgradeableOpen) && (
            // 2.0: niente riquadro esterno, resta solo il margine (px-3 py-2)
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
              {(isRoadSummaryOpen || isProdSummaryOpen || isMilSummaryOpen) && (
                <div className="flex w-full flex-wrap items-start gap-2">
                  {renderRoadSummary()}
                  {renderProdSummary()}
                </div>
              )}
              {isDebugOpen && (
                <div className="w-full mt-2">
                    <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-emerald-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-emerald-400">
                        {t("debugMatchedBuildings", uiLang).toUpperCase()} ({matchedCityEntityIds.length})
                      </span>
                      <div className="debug-panel-list">
                        {matchedCityEntityIds.length === 0 ? "-" : matchedCityEntityIds
                          .map((id) => ({ id, name: displayName(id, id, gameLang) }))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(({ id, name }, i) => (
                          <div key={id} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: id, rawEntry: matchedJson.get(id) })} className="debug-panel-entry">
                              {name}<DebugQtyBadge qty={cityEntityIds.get(id) ?? 1} colorClass="text-emerald-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-amber-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-amber-400">
                        {t("debugGreatBuildings", uiLang).toUpperCase()} ({greatBuildingIds.length})
                      </span>
                      <div className="debug-panel-list">
                        {greatBuildingsJson.size === 0 ? "-" : Array.from(greatBuildingsJson.values())
                          .map((gb) => ({ gb, name: displayName(gb.entityId, gb.entityId, gameLang) }))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(({ gb, name }, i) => (
                          <div key={gb.entityId} className={i > 0 ? "mt-1" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: gb.entityId, rawEntry: gb.rawEntry })} className="debug-panel-entry">
                              {name} - Lv. {gb.level}/{gb.maxLevel}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-sky-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-sky-400" title={t("debugExtraBuildingsTitle", uiLang)}>
                        {t("debugExtraBuildings", uiLang).toUpperCase()} ({idsExtra ? extraCityEntityIds.length : "…"})
                      </span>
                      <div className="debug-panel-list">
                        {extraCityEntityIds.length === 0 ? "-" : extraCityEntityIds
                          .map((id) => ({ id, name: displayName(id, fallbackBuildings.get(id)?.name ?? id, gameLang) }))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(({ id, name }, i) => (
                          <div key={id} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: id, rawEntry: unmatchedJson.get(id) })} className="debug-panel-entry">
                              {name}<DebugQtyBadge qty={cityEntityIds.get(id) ?? 1} colorClass="text-sky-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-red-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-red-400" title={t("debugUnmatchedBuildingsTitle", uiLang)}>
                        {t("debugUnmatchedBuildings", uiLang).toUpperCase()} ({unmatchedCityEntityIds.length})
                      </span>
                      <div className="debug-panel-list">
                        {unmatchedCityEntityIds.length === 0 ? "-" : unmatchedCityEntityIds
                          .map((id) => ({ id, name: displayName(id, fallbackBuildings.get(id)?.name ?? id, gameLang) }))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(({ id, name }, i) => (
                          <div key={id} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: id, rawEntry: unmatchedJson.get(id) })} className="debug-panel-entry">
                              {name}<DebugQtyBadge qty={cityEntityIds.get(id) ?? 1} colorClass="text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {isOutdatedSummaryOpen && cityEntityIds.size > 0 && (
                <div className="w-full mt-2 grid gap-2 md:grid-cols-2">
                  {renderOutdatedSummaryCard(outdatedSummary, "outdatedSummaryTitle", "outdatedSummaryToCurrentEra", ageName(currentEra, gameLang))}
                  {fallbackEraId !== currentEraId
                    ? renderOutdatedSummaryCard(fullCitySummaryToFallback, "outdatedSummaryFallbackTitle", "outdatedSummaryToMaxEra", ageName(FALLBACK_ERA, gameLang))
                    : (
                      <div className="flex flex-col bg-slate-950 border border-slate-700/20 items-center justify-center px-3 py-4">
                        <p className="text-[11px] text-slate-500 italic">{t("outdatedSummaryAlreadyAtMax", uiLang)}</p>
                      </div>
                    )}
                </div>
              )}
              {/* 2.0: Aggiornabili è un pannello di Statistiche (era un popup) */}
              {isCityUpgradeableOpen && (
                <div className="w-full mt-2 space-y-4">
                {!cityUpgradeableData.hasInventoryData ? (
                  <div className="border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                    <div className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300">{t("inventoryRequiredTitle", uiLang)}</div>
                    <p className="mt-2 text-xs text-slate-400">
                      {t("inventoryRequiredBody", uiLang)}
                    </p>
                  </div>
                ) : cityUpgradeableData.upgradable.length === 0 && cityUpgradeableData.ascendable.length === 0 ? (
                  <div className="border border-slate-800 bg-slate-950/40 p-6 text-center text-slate-400 text-xs">
                    {t("noUpgradableFound", uiLang)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {renderCityUpgradeableTable(
                      t("upgradableBuildingsTitle", uiLang),
                      cityUpgradeableData.upgradable,
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                    )}
                    {renderCityUpgradeableTable(
                      t("ascendableBuildingsTitle", uiLang),
                      cityUpgradeableData.ascendable,
                      "border-violet-500/30 bg-violet-500/10 text-violet-300",
                    )}
                  </div>
                )}
                </div>
              )}
            </div>
          )}

          {/* 2.0: avatar ed era nel gruppo "Giocatore" del nastro; qui solo il Debug. */}
          {activeTab === "inventario" && inventoryMatched.size > 0 && isInventoryDebugOpen && (
            <div className="flex flex-wrap items-center gap-2 rounded border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs">
              {isInventoryDebugOpen && (() => {
                const allSelectionKits = Array.from(inventorySelectionKits.values());

                return (
                <div className="w-full mt-2">
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-emerald-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-emerald-400">
                        {t("debugMatchedBuildings", uiLang).toUpperCase()} ({inventoryMatched.size})
                      </span>
                      <div className="debug-panel-list">
                        {Array.from(inventoryMatched.values())
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((e, i) => (
                          <div key={e.cityEntityId} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: e.cityEntityId, rawEntry: { cityEntityId: e.cityEntityId, name: e.name, inStock: e.inStock, ...(e.rawEntry ?? {}) } })} className="debug-panel-entry">
                              {e.name}<DebugQtyBadge qty={e.inStock} colorClass="text-emerald-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-red-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-red-400">
                        {t("debugUnmatchedBuildings", uiLang).toUpperCase()} ({inventoryUnmatched.size})
                      </span>
                      <div className="debug-panel-list">
                        {inventoryUnmatched.size === 0 ? "-" : Array.from(inventoryUnmatched.values())
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((e, i) => (
                          <div key={e.cityEntityId} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: e.cityEntityId, rawEntry: { cityEntityId: e.cityEntityId, name: e.name, inStock: e.inStock, ...(e.rawEntry ?? {}) } })} className="debug-panel-entry">
                              {e.name}<DebugQtyBadge qty={e.inStock} colorClass="text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-violet-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-violet-400">
                        {t("debugSelectionKits", uiLang).toUpperCase()} ({allSelectionKits.length})
                      </span>
                      <div className="debug-panel-list">
                        <DebugKitsByTier
                          kits={allSelectionKits}
                          qtyColorClass="text-violet-400"
                          uiLang={uiLang}
                          onSelect={(title, rawEntry) => setSelectedJsonEntry({ title, rawEntry })}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-sky-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-sky-400">
                        {t("debugUpgradeKits", uiLang).toUpperCase()} ({inventoryUpgradeKits.size})
                      </span>
                      <div className="debug-panel-list">
                        <DebugKitsByTier
                          kits={Array.from(inventoryUpgradeKits.values())}
                          qtyColorClass="text-sky-400"
                          uiLang={uiLang}
                          onSelect={(title, rawEntry) => setSelectedJsonEntry({ title, rawEntry })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          {/* Solo con una città importata (dopo l'eliminazione del profilo o di
              tutti i profili sparisce); key = profilo: cambiando profilo il
              Planner riparte da zero (si fermano le ricerche dell'altro). */}
          {/* Mappa della città: scheda Città e (2.0) scheda Planner con la città
              selezionata (pulsante Mappa del gruppo Città del nastro del Planner). */}
          {(() => {
          // 2.0: nel Planner con la sorgente JSON la mappa mostra la città del file
          const mj = showPlanner && plannerSorgente === "json" ? mappaJson : null;
          if (!(activeTab === "propria_citta" && showCityMap && (mj || !showPlanner || (plannerSorgente === "citta" && haCittaPlanner)))) return null;
          return (
            <CityMapView
              cityMapBuildings={mj ? mj.buildings : cityMapBuildings}
              cityMapBounds={mj ? mj.bounds : cityMapBounds}
              cityMapUnlockedCells={mj ? mj.cells : cityMapUnlockedCells}
              cityMapUnlockedAreas={mj ? mj.aree : cityMapUnlockedAreas}
              cityMapGrid={mj ? mj.grid : cityMapGrid}
              highlightedCityEntityIds={mj ? NESSUN_ID : highlightedCityEntityIds}
              cityMapView={cityMapView}
              setCityMapView={setCityMapView}
              cityMapCellSize={cityMapCellSize}
              setCityMapCellSize={setCityMapCellSize}
              cityMapPan={cityMapPan}
              setCityMapPan={setCityMapPan}
              cityMapDragStart={cityMapDragStart}
              setCityMapDragStart={setCityMapDragStart}
              onBuildingHover={(entityId, name, clientX, clientY) => {
                cancelImagePopupClose();
                // Ancora = il cursore, con 16 px di margine per lato: il popup si
                // apre a destra (da clientX + 16) o, vicino al bordo destro della
                // finestra, a sinistra FINENDO prima di clientX - 16. Prima
                // anchorLeft non c'era e aprendosi a sinistra il popup copriva il
                // cursore: smetteva di seguire il mouse e intercettava il click
                // sull'edificio (bug corretto settembre 2026).
                setImagePopup(prev => {
                  // Stesso edificio (mouse che si muove dentro lo stesso
                  // rettangolo): aggiorna solo la posizione, evita di
                  // rifare lookup + getImageUrl ad ogni mousemove.
                  if (prev && prev.name === name) {
                    return { ...prev, x: clientX + 16, y: clientY, anchorLeft: clientX - 16 };
                  }
                  const b = BUILDING_BY_ID.get(entityId);
                  const url = b ? getImageUrl(b.cityEntityId, b.hash) : null;
                  if (!url) return null;
                  return { x: clientX + 16, y: clientY, url, name, id: entityId, anchorLeft: clientX - 16 };
                });
              }}
              onBuildingLeave={scheduleImagePopupClose}
              onBuildingClick={mj ? undefined : handleMapBuildingClick}
              uiLang={uiLang}
              nomeGiocatore={mj ? mj.nome : profiles.find(x => x.id === activeProfileId)?.name}
            />
          );
          })()}

          {/* Planner (2.0: scheda a sé). Sorgente: città selezionata o JSON
              importato dal nastro; key = sorgente: cambiandola il Planner
              riparte da zero (si fermano le ricerche dell'altra). */}
          {activeTab === "propria_citta" && showPlanner && (() => {
            const usaJson = plannerSorgente === "json" || !haCittaPlanner;
            if (usaJson && !plannerJson) {
              return (
                <div className="px-4 py-6 text-center text-[13px] text-slate-300">
                  {t("r2PlNoSource", uiLang)}
                  {plannerErrore && <div className="mt-2 text-red-400">{plannerErrore}</div>}
                </div>
              );
            }
            const ignorati = usaJson ? plannerJson!.citta.ignorati : undefined;
            return (
              <Suspense fallback={<div className="avvio" style={{ minHeight: 200 }}><div className="avvio-rotella" /></div>}>
                {/* Import da Forge Hammer: pezzi senza dimensioni note (non nel catalogo) */}
                {ignorati && ignorati.length > 0 && (
                  <div className="px-3 pt-2 text-[12px] text-amber-300" title={[...new Set(ignorati)].join("\n")}>
                    {t("plannerJsonIgnored", uiLang, ignorati.length, [...new Set(ignorati)].join(", "))}
                  </div>
                )}
                <PlannerView
                  key={usaJson ? `json-${plannerJson!.n}` : `citta-${activeProfileId}`}
                  cityMapBuildings={usaJson ? NESSUN_EDIFICIO : cityMapBuildings}
                  cityMapUnlockedCells={usaJson ? NESSUNA_CELLA : cityMapUnlockedCells}
                  esterna={usaJson ? plannerJson!.citta : null}
                  candidati={plannerCandidati}
                  uiLang={uiLang}
                  onNastro={setGruppiPlanner}
                  militariCollegatiIniziali={usaJson ? undefined : militariCollegatiOra}
                  scollegatiIniziali={usaJson ? undefined : scollegatiOra}
                  mappa={{ attiva: showCityMap, cambia: () => { const v = !showCityMap; setShowCityMap(v); localStorage.setItem(SHOW_CITY_MAP_KEY, String(v)); } }}
                />
              </Suspense>
            );
          })()}


          {/* (Catalogo › Grandi Edifici: stessa tabella degli edifici, righe da processedGeCatalogo) */}
          {(activeTab === "database" || (activeTab === "propria_citta" && !showPlanner) || activeTab === "inventario") && (
            <>
              {/* 2.0: in Database, Città e Inventario la tabella va da bordo a bordo
                  (annulla il px-2 di <main>) con spigoli vivi. */}
              <div ref={buildingTableWrapperRef} className="-mx-2 bg-slate-900/20 border-y border-slate-800/80 overflow-hidden">
                <div
                  ref={buildingTableScrollRef}
                  onScroll={() => syncBuildingTableScroll("table")} {...guidaScroll("table")}
                  className="overflow-x-auto"
                >
                  <table className={`building-table has-name-divider w-full table-fixed text-left border-collapse ${buildingTableNeedsScroll ? "has-sticky-name" : ""}${senzaLimitati ? " senza-selezione" : ""}`} style={{ minWidth: tableMinWidth }} onMouseOver={titoloColonna}>
                    <colgroup>
                      {!senzaLimitati && <col className="w-[32px]" />}
                      <col className={senzaLimitati ? "w-[26px]" : "w-[14px]"} />
                      <col className={buildingTableNeedsScroll ? "w-[320px]" : "w-full min-w-[320px]"} />
                      {!senzaLimitati && <col className="w-[50px]" />}
                      <col className={senzaLimitati ? "w-[56px]" : "w-[32px]"} />
                      <col className="w-[50px]" />
                      <col className="w-[48px]" />
                      <col className="w-[44px]" />
                      {showPopColumn && <col className="w-[66px]" />}
                      {showFelColumn && <col className="w-[66px]" />}
                       {!showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`gen-${i}`} className="w-[42px]" />)}
                       {!showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`gbg-${i}`} className="w-[42px]" />)}
                       {showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`sig-gc-${i}`} className="w-[42px]" />)}
                       {!showSigmaColumns && showSpedColumns && Array.from({ length: 4 }).map((_, i) => <col key={`sped-${i}`} className="w-[42px]" />)}
                       {showSigmaColumns && showSpedColumns && Array.from({ length: 4 }).map((_, i) => <col key={`sig-gs-${i}`} className="w-[42px]" />)}
                       {Array.from({ length: 4 }).map((_, i) => <col key={`iq-ad-${i}`} className="w-[42px]" />)}
                       {!senzaIq && <>
                       {showIqProdColumns && Array.from({ length: 4 }).map((_, i) => <col key={`iq-mm-${i}`} className="w-[42px]" />)}
                       {Array.from({ length: 3 }).map((_, i) => <col key={`iq-extra-${i}`} className="w-[42px]" />)}
                       <col className="w-[42px]" />
                       </>}
                       {showProdColumns && Array.from({ length: senzaIq ? 15 : 23 }).map((_, i) => <col key={`prod-${i}`} className={senzaIq && i === 14 ? "w-[56px]" : "w-[36px]"} />)}
                    </colgroup>
                    <thead>
                      <tr className="bt-thead-row1 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        {/* Sticky + sfondo opaco vivono in index.css (th-export-summary /
                            th-name-summary, scoped sotto .has-sticky-name): niente più stili
                            inline condizionali qui. */}
                        <th className="th-export-summary py-1 px-1 text-center" colSpan={senzaLimitati ? 1 : 2}>
                          {/* 2.0: Export degli edifici selezionati → nastro, Opzioni. */}
                        </th>
                        <th className="th-name-summary py-2 px-2 text-center font-normal text-xs text-slate-400 italic truncate">
                          {t("buildingsVisualizedCount", uiLang)}: <span className="font-bold text-slate-300">{filteredBuildings.length}</span>/<span className="text-slate-400">{activeTab === "propria_citta" ? cityEntityIds.size + (showInventoryInCity ? (showOnlyReadyBuildings ? processedInventoryRawBuildings : processedInventoryKitBuildings).length : 0) : activeTab === "inventario" ? (showOnlyReadyBuildings ? processedInventoryRawBuildings : processedInventoryKitBuildings).length : catalogo === "ge" ? processedGeCatalogo.length : processedBuildings.length}</span>
                        </th>
                        <th className="py-2 px-0" colSpan={(senzaLimitati ? 4 : 5) + (showPopColumn ? 1 : 0) + (showFelColumn ? 1 : 0)}>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                            <div style={{ minWidth: "82px" }} />
                            {/* 2.0: l'efficienza minima è nel nastro (Filtri). */}
                          </div>
                        </th>
                        {renderMilitaryGroupHeaders()}
                        <th className="py-2 px-2 text-center group-header-blue text-blue-400/80" colSpan={senzaIq ? 4 : showIqProdColumns ? 12 : 8}><TitoloGruppo icona={iconIQ} testo={t("groupIq", uiLang)} /></th>
                        {showProdColumns && (
                          <th className="relative text-center group-header-orange text-orange-400/80" colSpan={senzaIq ? 15 : 23}>
                            {/* 2.0: Nascondi 🚫/^ sono nel nastro (Visualizza: Non accelerabili, Auto aggiornabili). */}
                            <TitoloGruppo icona={iconProduzioni} testo={t("groupProductions", uiLang)} />
                            {/* Database: nessun override, è l'UNICA tab dove eraAdjustedSource
                                salta applyEraStats (isGameTab è falso), quindi i valori sono
                                SEMPRE quelli del CSV statico all'era MASSIMA (BOOST_ERA/
                                FALLBACK_ERA) — esplicitarlo evita di scambiarli per quelli
                                dell'era del giocatore.
                                Città E Inventario: eraAdjustedSource applica applyEraStats a
                                ENTRAMBE (isGameTab = "propria_citta" || "inventario"). In
                                teoria l'override per riga dipende da eraStats.has(cityEntityId)
                                (vedi quella Map in App.tsx: costruita da TUTTI gli entityId di
                                cityEntities con isInCity||isInCsv||isInventoryChain — isInCsv
                                da solo è già vero per la stragrande maggioranza degli edifici
                                del gioco), quindi in pratica l'override scatta per quasi ogni
                                riga indipendentemente dal possesso reale. Verificato dal vivo
                                (luglio 2026) con un badge diagnostico temporaneo su
                                eraStats.has(cityEntityId) per ogni riga di Inventario: ZERO
                                righe mancavano l'override su un profilo reale con inventario
                                pieno — da qui la decisione di mostrare la dicitura anche in
                                Inventario. Il caso "riga rimasta a FALLBACK_ERA" resta
                                teoricamente possibile (un cityEntityId assente sia dal CSV sia
                                da cityEntities) ma è un'eccezione più unica che rara, non la
                                norma: non usare più "Inventario ha valori misti" come premessa
                                di design altrove nel codice. */}
                            {/* (catalogo dei GE: le produzioni dei GE non dipendono dall'era) */}
                            {activeTab === "database" && catalogo !== "ge" && (
                              <span className="ml-1.5 font-normal normal-case text-orange-300/70">
                                ({t("prodValuesOfEra", uiLang, ageName(FALLBACK_ERA, uiLang))})
                              </span>
                            )}
                            {(activeTab === "propria_citta" || activeTab === "inventario") && currentEra && (
                              <span className="ml-1.5 font-normal normal-case text-orange-300/70">
                                ({t("prodValuesOfEra", uiLang, ageName(currentEra, gameLang))})
                              </span>
                            )}
                          </th>
                        )}
                      </tr>
                      <tr className="bt-thead-row2 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        {!senzaLimitati && <th className="cell-checkbox py-0.5 px-1 w-[32px] text-center">
                          {(() => {
                            const allSelected = filteredBuildings.length > 0 && filteredBuildings.every(b => selectedIds.has(b.id));
                            return (
                              <label className="inline-flex cursor-pointer" title={t("selectAllTitle", uiLang)}>
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  onChange={toggleSelectAll}
                                  aria-label={t("selectAllTitle", uiLang)}
                                  className="peer sr-only"
                                />
                                <span
                                  className={`relative top-px block box-border h-3 w-3 shrink-0 rounded-[4px] border ${
                                    allSelected
                                      ? "bg-amber-500 border-amber-500"
                                      : "bg-transparent border-slate-600 peer-hover:border-slate-400"
                                  }`}
                                >
                                  {allSelected && (
                                    <Check
                                      size={9}
                                      strokeWidth={3}
                                      className="text-slate-950 pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                                    />
                                  )}
                                </span>
                              </label>
                            );
                          })()}
                        </th>}
                        <th className="cell-eye py-0.5 px-1 text-center w-[14px]"></th>
                        {/* className STATICA, senza larghezze condizionali: la larghezza della
                            colonna nome è già interamente governata dal <col> del colgroup
                            (table-fixed) in entrambi i rami. La versione precedente cambiava
                            classe (w-[240px] ↔ w-full min-w-[240px]) insieme al toggle dello
                            sticky: questo th era l'UNICA cella sticky con attributo class
                            mutevole nella transizione, e il doppio invalidamento (classe
                            propria + classe della tabella) nello stesso frame in cui il layer
                            compositato sticky viene smontato faceva a volte saltare il
                            repaint dello sfondo su Chrome (solo questo th, a caso). */}
                        <SortableHeader label={t("colBuilding", uiLang)} sortKey="name" onClick={() => handleSort("name")} active={sortBy === "name"} order={sortOrder} className="cell-name py-0.5 px-2 text-left" />
                        
                        {!senzaLimitati && <th className="pt-1 pb-0 px-1 text-center w-[50px]" title={t("r2Limited", uiLang)}><TableHeaderIcon src={iconLimitati} alt={t("r2Limited", uiLang)} spostata={false} /></th>}
                        <th className={`py-0.5 px-1 text-center ${senzaLimitati ? "w-[56px]" : "w-[32px]"}`}>{senzaLimitati ? "BONUS" : "❔"}</th>
                        <SortableHeader label="Eff" sortKey="eff" onClick={() => handleSort("eff")} active={sortBy === "eff"} order={sortOrder} className="th-eff" />
                        <SortableHeader label={<TableHeaderIcon src={iconSize} alt={t("colSize", uiLang)} />} sortKey="size" onClick={() => handleSort("size")} active={sortBy === "size"} order={sortOrder} className="pt-1 pb-0 px-1.5 text-center w-[48px] section-divider" title={t("colSize", uiLang)} />
                        <SortableHeader label={<TableHeaderIcon src={iconRoad} alt={t("colRoad", uiLang)} />} sortKey="road" onClick={() => handleSort("road")} active={sortBy === "road"} order={sortOrder} className="pt-1 pb-0 px-1.5 text-center w-[44px]" title={t("colRoad", uiLang)} />
                        {showPopColumn && (
                          <SortableHeader label={<TableHeaderIcon src={iconPop} alt={t("colPop", uiLang)} />} sortKey="pop" onClick={() => handleSort("pop")} active={sortBy === "pop"} order={sortOrder} className="pt-1 pb-0 px-1.5 text-center w-[66px]" title={t("colPop", uiLang)} />
                        )}
                        {showFelColumn && (
                          <SortableHeader label={<TableHeaderIcon src={iconFel} alt={t("colFel", uiLang)} />} sortKey="fel" onClick={() => handleSort("fel")} active={sortBy === "fel"} order={sortOrder} className="pt-1 pb-0 px-1.5 text-center w-[66px]" title={t("colFel", uiLang)} />
                        )}
                        
                        {renderMilitaryHeaders(activeTab === "database" || activeTab === "propria_citta" || activeTab === "inventario" ? activeTab : "database")}

                        <SortableHeader label={<TableHeaderIcon src={iconIQAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionQi", uiLang))} />} sortKey="iq_atk_a" onClick={() => handleSort("iq_atk_a")} active={sortBy === "iq_atk_a"} order={sortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionQi", uiLang))} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQDefA} alt={boostTitle(uiLang, "def", "red", t("sectionQi", uiLang))} />} sortKey="iq_def_a" onClick={() => handleSort("iq_def_a")} active={sortBy === "iq_def_a"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionQi", uiLang))} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionQi", uiLang))} />} sortKey="iq_atk_d" onClick={() => handleSort("iq_atk_d")} active={sortBy === "iq_atk_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionQi", uiLang))} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionQi", uiLang))} />} sortKey="iq_def_d" onClick={() => handleSort("iq_def_d")} active={sortBy === "iq_def_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionQi", uiLang))} />
                        {!senzaIq && <>
                        {showIqProdColumns && (
                          <>
                            <SortableHeader label={<TableHeaderIcon src={iconIQMon} alt={t("iqCoinsStart", uiLang)} />} sortKey="iq_mon" onClick={() => handleSort("iq_mon")} active={sortBy === "iq_mon"} order={sortOrder} className="th-col border-l border-slate-800" title={t("iqCoinsStart", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconIQMonB} alt={t("iqCoinsBoost", uiLang)} />} sortKey="iq_mon_b" onClick={() => handleSort("iq_mon_b")} active={sortBy === "iq_mon_b"} order={sortOrder} className="th-col" title={t("iqCoinsBoost", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconIQMat} alt={t("iqMaterialsStart", uiLang)} />} sortKey="iq_mat" onClick={() => handleSort("iq_mat")} active={sortBy === "iq_mat"} order={sortOrder} className="th-col" title={t("iqMaterialsStart", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconIQMatB} alt={t("iqMaterialsBoost", uiLang)} />} sortKey="iq_mat_b" onClick={() => handleSort("iq_mat_b")} active={sortBy === "iq_mat_b"} order={sortOrder} className="th-col" title={t("iqMaterialsBoost", uiLang)} />
                          </>
                        )}
                        <SortableHeader label={<TableHeaderIcon src={iconIQBeni} alt={t("iqGoods", uiLang)} />} sortKey="iq_beni" onClick={() => handleSort("iq_beni")} active={sortBy === "iq_beni"} order={sortOrder} className={`th-col${showIqProdColumns ? "" : " border-l border-slate-800"}`} title={t("iqGoods", uiLang)} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQTruppe} alt={t("iqUnits", uiLang)} />} sortKey="iq_truppe" onClick={() => handleSort("iq_truppe")} active={sortBy === "iq_truppe"} order={sortOrder} className="th-col" title={t("iqUnits", uiLang)} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQAzioni} alt={t("iqActions", uiLang)} />} sortKey="iq_azioni" onClick={() => handleSort("iq_azioni")} active={sortBy === "iq_azioni"} order={sortOrder} className="th-col" title={t("iqActions", uiLang)} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQCap} alt={t("iqCap", uiLang)} />} sortKey="iq_cap" onClick={() => handleSort("iq_cap")} active={sortBy === "iq_cap"} order={sortOrder} className="th-col" title={t("iqCap", uiLang)} />
                        </>}
                        {showProdColumns && (
                          <>
                            <SortableHeader noGap label={<TableHeaderIcon src={iconMon} alt={t("prodCoins", uiLang)} />} sortKey="mon" onClick={() => handleSort("mon")} active={sortBy === "mon"} order={sortOrder} className="th-col section-divider" title={t("prodCoins", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconMat} alt={t("prodMaterials", uiLang)} />} sortKey="mat" onClick={() => handleSort("mat")} active={sortBy === "mat"} order={sortOrder} className="th-col" title={t("prodMaterials", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconFP} alt={t("prodForgePoints", uiLang)} />} sortKey="fp" onClick={() => handleSort("fp")} active={sortBy === "fp"} order={sortOrder} className="th-col" title={t("prodForgePoints", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconFPB} alt={t("prodForgePointsBoost", uiLang)} />} sortKey="fpb" onClick={() => handleSort("fpb")} active={sortBy === "fpb"} order={sortOrder} className="th-col" title={t("prodForgePointsBoost", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconMed} alt={t("prodMedals", uiLang)} />} sortKey="med" onClick={() => handleSort("med")} active={sortBy === "med"} order={sortOrder} className="th-col" title={t("prodMedals", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconFUR} alt={t("prodRogues", uiLang)} />} sortKey="fur" onClick={() => handleSort("fur")} active={sortBy === "fur"} order={sortOrder} className="th-col" title={t("prodRogues", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconTR} alt={t("prodUnitsCurrentEra", uiLang)} />} sortKey="tr" onClick={() => handleSort("tr")} active={sortBy === "tr"} order={sortOrder} className="th-col" title={t("prodUnitsCurrentEra", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconTRNE} alt={t("prodUnitsNextEra", uiLang)} />} sortKey="trne" onClick={() => handleSort("trne")} active={sortBy === "trne"} order={sortOrder} className="th-col" title={t("prodUnitsNextEra", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconBeni} alt={t("prodGoodsCurrent", uiLang)} />} sortKey="beni" onClick={() => handleSort("beni")} active={sortBy === "beni"} order={sortOrder} className="th-col" title={t("prodGoodsCurrent", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconBeniB} alt={t("prodGoodsBoost", uiLang)} />} sortKey="benib" onClick={() => handleSort("benib")} active={sortBy === "benib"} order={sortOrder} className="th-col" title={t("prodGoodsBoost", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconBeniP} alt={t("prodGoodsPrevious", uiLang)} />} sortKey="benip" onClick={() => handleSort("benip")} active={sortBy === "benip"} order={sortOrder} className="th-col" title={t("prodGoodsPrevious", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconBeniS} alt={t("prodGoodsNext", uiLang)} />} sortKey="benis" onClick={() => handleSort("benis")} active={sortBy === "benis"} order={sortOrder} className="th-col" title={t("prodGoodsNext", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconBeniSp} alt={t("prodGoodsSpecial", uiLang)} />} sortKey="benisp" onClick={() => handleSort("benisp")} active={sortBy === "benisp"} order={sortOrder} className="th-col" title={t("prodGoodsSpecial", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconBeniSpB} alt={t("prodGoodsSpecialBoost", uiLang)} />} sortKey="benispb" onClick={() => handleSort("benispb")} active={sortBy === "benispb"} order={sortOrder} className="th-col" title={t("prodGoodsSpecialBoost", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconBeniG} alt={t("prodGuildGoods", uiLang)} />} sortKey="benig" onClick={() => handleSort("benig")} active={sortBy === "benig"} order={sortOrder} className="th-col" title={t("prodGuildGoods", uiLang)} />
                            {!senzaIq && <>
                            <SortableHeader noGap label={<TableHeaderIcon src={iconBP} alt={t("prodBlueprints", uiLang)} />} sortKey="bp" onClick={() => handleSort("bp")} active={sortBy === "bp"} order={sortOrder} className="th-col" title={t("prodBlueprints", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconFSP} alt={t("prodRushSpecial", uiLang)} />} sortKey="fsp" onClick={() => handleSort("fsp")} active={sortBy === "fsp"} order={sortOrder} className="th-col" title={t("prodRushSpecial", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconTPM} alt={t("prodRushMaterials", uiLang)} />} sortKey="tpm" onClick={() => handleSort("tpm")} active={sortBy === "tpm"} order={sortOrder} className="th-col" title={t("prodRushMaterials", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconTPB} alt={t("prodRushGoods", uiLang)} />} sortKey="tpb" onClick={() => handleSort("tpb")} active={sortBy === "tpb"} order={sortOrder} className="th-col" title={t("prodRushGoods", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconAiuto} alt={t("prodMassAid", uiLang)} />} sortKey="adm" onClick={() => handleSort("adm")} active={sortBy === "adm"} order={sortOrder} className="th-col text-sm" title={t("prodMassAid", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconOneUp} alt={t("prodOneUpKit", uiLang)} />} sortKey="mod" onClick={() => handleSort("mod")} active={sortBy === "mod"} order={sortOrder} className="th-col text-sm" title={t("prodOneUpKit", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconRinn} alt={t("prodRenovationKit", uiLang)} />} sortKey="rin" onClick={() => handleSort("rin")} active={sortBy === "rin"} order={sortOrder} className="th-col text-sm" title={t("prodRenovationKit", uiLang)} />
                            <SortableHeader noGap label={<TableHeaderIcon src={iconImm} alt={t("prodStoreBuilding", uiLang)} />} sortKey="imm" onClick={() => handleSort("imm")} active={sortBy === "imm"} order={sortOrder} className="th-col text-sm" title={t("prodStoreBuilding", uiLang)} />
                            </>}
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
                      {filteredBuildings.map((b, rowIndex) => (
                        <BuildingRow
                          key={b.id}
                          b={b}
                          isEven={rowIndex % 2 === 1}
                          senzaLimitati={senzaLimitati}
                          onReport={setReportGe}
                          senzaIq={senzaIq}
                          activeTab={activeTab}
                          uiLang={uiLang}
                          gameLang={gameLang}
                          currentEraId={currentEraId}
                          showSigmaColumns={showSigmaColumns}
                          spedizioniEnabled={showSpedColumns}
                          showPopColumn={showPopColumn}
                          showFelColumn={showFelColumn}
                          showIqProdColumns={showIqProdColumns}
                          showProdColumns={showProdColumns}
                          specialKits={specialKits}
                          DIFF_FIELDS={DIFF_FIELDS}
                          isSelected={selectedIds.has(b.id)}
                          // Righe merged da Inventario (b._isMergedInventory): valori neutri
                          // per le props Città-specifiche, così anche un'eventuale guardia
                          // dimenticata in BuildingRow non mostra dati fuorvianti presi da
                          // un'istanza reale che condivide per caso lo stesso cityEntityId.
                          isHighlighted={!b._isMergedInventory && highlightedCityEntityIds.has(b.cityEntityId)}
                          disconnectedCount={b._isMergedInventory ? 0 : cityEntityDisconnected.get(b.cityEntityId) ?? 0}
                          needlessCount={b._isMergedInventory ? 0 : cityEntityNeedlessCount.get(b.cityEntityId) ?? 0}
                          importedCount={b._isMergedInventory ? 0 : b._eraCopia !== undefined ? (b.kitCount ?? 1) : importedCityEntityLookup.get(b.cityEntityId) ?? 0}
                          greatBuildingInfo={activeTab === "database" && catalogo === "ge"
                            // (Catalogo › GE: livello del selettore, non quello della tua città)
                            ? { entityId: b.cityEntityId, name: "", level: Math.min(livelloGe, datiGe?.edifici[b.cityEntityId]?.tierMax === "gold" ? livelloGe : 200), maxLevel: datiGe?.edifici[b.cityEntityId]?.tierMax === "gold" ? 500 : 200, width: 0, length: 0, rawEntry: {} as GreatBuilding["rawEntry"] }
                            : greatBuildingsJson.get(b.cityEntityId)}
                          gameDisplayName={gameNames.get(b.cityEntityId)}
                          upgradeBadge={b._isMergedInventory ? undefined : cityUpgradeBadges.get(b.cityEntityId)}
                          isOutdated={!b._isMergedInventory && outdatedBuildings.has(b.cityEntityId) && (b._eraCopia === undefined || b._eraCopia < currentEraId)}
                          isDeclassable={!b._isMergedInventory && declassableBuildings.has(b.cityEntityId)}
                          allySlots={b._isMergedInventory ? undefined : allySlotsPerBuilding.get(b.cityEntityId)}
                          declassablePopData={b._isMergedInventory ? undefined : declassableBuildings.get(b.cityEntityId)}
                          setDeclassableTooltip={setDeclassableTooltip}
                          minLevel={entityLevels.get(b.cityEntityId) ?? -1}
                          allLevelsForEntity={entityLevelsList.get(b.cityEntityId)}
                          instanceEraStats={entityInstanceEraStats.get(b.cityEntityId) ?? EMPTY_ERA_GROUPS}
                          fragmentsProduced={FRAGMENTS_PRODUCED.get(b.cityEntityId) ?? EMPTY_FRAGMENTS}
                          handleCityRowClick={handleCityRowClick}
                          toggleSelect={toggleSelect}
                          getPropDisplay={getPropDisplay}
                          setImagePopup={setImagePopup}
                          scheduleImagePopupClose={scheduleImagePopupClose}
                          setUpgradeTooltip={setUpgradeTooltip}
                          setOutdatedTooltip={setOutdatedTooltip}
                          setFragmentTooltip={setFragmentTooltip}
                          setFabTooltip={setFabTooltip}
                        />
                      ))}
 
                      {filteredBuildings.length === 0 && (() => {
                        // Messaggio dedicato quando la tab è vuota per MANCANZA DI IMPORT
                        // (nessun profilo caricato), non per filtri troppo stringenti: il
                        // generico "Nessun edificio trovato" non guida un utente nuovo verso
                        // l'azione giusta (usare la bacchetta magica). Scoped a Città/Inventario
                        // — in Database filteredBuildings vuoto è sempre un caso di filtri.
                        const noCityImported = activeTab === "propria_citta" && cityEntityIds.size === 0;
                        // Inventario vuoto per mancanza di import (mai fatto girare la bacchetta
                        // magica) vs inventario DAVVERO vuoto (import fatto, ma l'inventario di
                        // gioco non contiene ancora nulla — capita normalmente a inizio partita).
                        // Distinzione: se la città NON è mai stata importata, cityEntityIds è
                        // vuoto anch'esso (stesso identico import popola entrambi); se invece
                        // cityEntityIds ha dati, un profilo è stato importato con successo e
                        // l'inventario vuoto è un fatto legittimo di gioco, non un "manca il CTA".
                        const noInventoryImportedAtAll = activeTab === "inventario" &&
                          inventoryMatched.size === 0 && inventoryUnmatched.size === 0 &&
                          inventorySelectionKits.size === 0 && inventoryUpgradeKits.size === 0 &&
                          cityEntityIds.size === 0;
                        const inventoryImportedButEmpty = activeTab === "inventario" &&
                          inventoryMatched.size === 0 && inventoryUnmatched.size === 0 &&
                          inventorySelectionKits.size === 0 && inventoryUpgradeKits.size === 0 &&
                          cityEntityIds.size > 0;
                        const showWandCta = noCityImported || noInventoryImportedAtAll;
                        const emptyMessagePrefix = noCityImported
                          ? t("noCityImportedYet", uiLang)
                          : noInventoryImportedAtAll
                          ? t("noInventoryImportedYet", uiLang)
                          : inventoryImportedButEmpty
                          ? t("inventoryEmpty", uiLang)
                          : t("noBuildingsFound", uiLang);
                        return (
                          <tr>
                            <td colSpan={28 - (senzaLimitati ? 1 : 0) - (showSigmaColumns ? 4 : 0) - (showIqProdColumns ? 0 : 4) - (senzaIq ? (showIqProdColumns ? 8 : 4) : 0) - (senzaLimitati ? 1 : 0) + (showPopColumn ? 1 : 0) + (showFelColumn ? 1 : 0) + (showSpedColumns ? 4 : 0) + (showProdColumns ? (senzaIq ? 15 : 23) : 0)} className="text-center py-12 text-slate-400 font-semibold">
                              <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                                <span>{emptyMessagePrefix}</span>
                                {/* SOLO riferimento visivo al pulsante reale della toolbar
                                    (stesso stile/icona), NON cliccabile, incorporato nel
                                    flusso della frase ("...in alto a sinistra [icona] per
                                    importare..."): un secondo elemento interattivo in mezzo
                                    alla tabella, con lo stesso drag&drop del bookmarklet,
                                    risultava confuso ("sembra un secondo pulsante ufficiale")
                                    — l'utente ha chiesto di lasciare solo l'indicazione visiva,
                                    senza duplicare l'azione (luglio 2026). */}
                                {showWandCta && (
                                  <span
                                    className="relative inline-flex items-center justify-center w-7 h-7 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shrink-0"
                                    aria-hidden="true"
                                  >
                                    <Wand2 size={13} />
                                  </span>
                                )}
                                {showWandCta && <span>{t("noImportedYetSuffix", uiLang)}</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                {isBuildingTableVisible && buildingTableScrollMetrics.scrollWidth > buildingTableScrollMetrics.clientWidth && filteredBuildings.length > 0 && (
                  <div
                    className="fixed bottom-0 z-[80] border-t border-slate-700/80 bg-slate-950/95 shadow-[0_-8px_20px_rgba(0,0,0,0.35)] backdrop-blur"
                    style={{ left: buildingTableScrollMetrics.left, width: buildingTableScrollMetrics.clientWidth }}
                  >
                    <div
                      ref={buildingTableFloatingScrollRef}
                      onScroll={() => syncBuildingTableScroll("floating")} {...guidaScroll("floating")}
                      className="building-floating-scrollbar h-4 overflow-x-auto overflow-y-hidden"
                    >
                      <div style={{ width: buildingTableScrollMetrics.scrollWidth, height: 1 }} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "alleati" && (
            <>
            {/* Potenziale alleati + Gettoni Valore (pannello unico): SOLO per profili importati con la
                bacchetta v6 (magazzino risorse presente). Con bacchette più
                vecchie l'utente vede il solito modale "bacchetta obsoleta". */}
            {!alleatiDaDb && mostraConsigliere && playerResources && importedAllies.some(a => !a.isFragment) && (
              <AllyAdvisorPanel
                owned={importedAllies}
                byIdRarity={ALLIES_BY_ID_RARITY}
                inherited={INHERITED_ALLIES_MAP}
                weights={weights}
                boostLivelli={boostAlleati.militari}
                resources={playerResources}
                uiLang={uiLang}
                gameLang={gameLang}
                allyName={allyName}
                groupHeaders={renderMilitaryGroupHeaders(true)}
                statHeaders={renderMilitaryIconHeaders(true)}
                renderBoostCells={(g, c, sp) => (
                  <MilitaryBoostCells general={g} gbg={c} sped={sp} showSigmaColumns={showSigmaColumns} spedizioniEnabled uiLang={uiLang} />
                )}
              />
            )}
            {!alleatiDaDb && mostraPergamene && playerResources && (
              <PannelloPergamene owned={importedAllies} byIdRarity={ALLIES_BY_ID_RARITY} inherited={INHERITED_ALLIES_MAP} weights={weights}
                pergamene={playerResources[PERGAMENE_RESOURCE] ?? 0} boostLivelli={boostAlleati.militari} uiLang={uiLang} gameLang={gameLang} allyName={allyName}
                groupHeaders={renderMilitaryGroupHeaders(true)} statHeaders={renderMilitaryIconHeaders(true)}
                renderBoostCells={(g, c, sp) => (
                  <MilitaryBoostCells general={g} gbg={c} sped={sp} showSigmaColumns={showSigmaColumns} spedizioniEnabled uiLang={uiLang} segno />
                )} />
            )}
            {/* Tabella alleati importati (solo scheda Alleati, non nel catalogo del Database) */}
            {!alleatiDaDb && processedImportedAllies.length > 0 && (
              <div className="bg-slate-900/20 border border-slate-800/80 rounded overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="building-table w-full table-fixed text-left border-collapse" style={{ minWidth: alliesTableMinWidth }}>
                    <colgroup>
                      <col className="w-full min-w-[240px]" />
                      <col className="w-[64px]" />
                      <col className="w-[50px]" />
                      {!showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`gen-${i}`} className="w-[42px]" />)}
                      {Array.from({ length: 4 }).map((_, i) => <col key={`gbg-${i}`} className="w-[42px]" />)}
                      {Array.from({ length: 4 }).map((_, i) => <col key={`sped-${i}`} className="w-[42px]" />)}
                      {Array.from({ length: 3 }).map((_, i) => <col key={`prod-${i}`} className="w-[42px]" />)}
                    </colgroup>
                    <thead>
                      <tr className="bt-thead-row1 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <th className="py-2 px-2 text-center" colSpan={3}>
                          {/* 2.0: i conteggi per tipo (militari, scienza, frammentati)
                              sono nei pulsanti dei Filtri del nastro. */}
                          <span className="text-[11px] font-normal normal-case text-slate-400">
                            {t("alliesVisualizedCount", uiLang)}: <span className="font-bold text-slate-300">{processedImportedAllies.length}</span>
                          </span>
                        </th>
                        {renderMilitaryGroupHeaders(true)}
                        {renderAllyProductionGroupHeader()}
                      </tr>
                      <tr className="bt-thead-row2 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <SortableHeader label={t("colAlly", uiLang)} sortKey="name" onClick={() => handleSortAlleatiOwn("name")} active={sortByAlleatiOwn === "name"} order={sortOrderAlleatiOwn} className="py-0.5 px-2 w-full min-w-[240px] text-left" />
                        <SortableHeader label="Lvl" sortKey="ally_level" onClick={() => handleSortAlleatiOwn("ally_level")} active={sortByAlleatiOwn === "ally_level"} order={sortOrderAlleatiOwn} className="py-0.5 px-1 text-center w-[64px]" title={t("allyLevelTitle", uiLang)} />
                        <SortableHeader label="Eff" sortKey="eff" onClick={() => handleSortAlleatiOwn("eff")} active={sortByAlleatiOwn === "eff"} order={sortOrderAlleatiOwn} className="th-eff" />
                        {renderMilitaryHeaders("alleati_own", true)}
                        {renderAllyProductionHeaders("alleati_own")}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
                      {processedImportedAllies.map((a) => (
                        <tr
                          key={a.isFragment ? `frag-${a.id}-${a.rarity}` : `inst-${a.jsonId}`}
                          className="hover:bg-slate-900/40 transition-colors"
                        >
                          <td className="cell-name">
                            <AllyRarityName id={a.id} rarity={a.rarity} lang={gameLang} />
                            {a.isFragment ? (
                              <>
                                <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-600" title={t("fragmentsCountTitle", uiLang, a.fragmentCount)}>
                                  {t("fragmentsBadge", uiLang, a.fragmentCount)}
                                </span>
                                <div className="mt-1 w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (a.fragmentCount / 1000) * 100)}%` }} />
                                </div>
                              </>
                            ) : a.isPlaced ? (
                              <span
                                className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 cursor-help"
                                title={t("allyPlacedTitle", uiLang)}
                                onMouseEnter={(e) => {
                                  const entityId = a.placedInEntityId;
                                  if (!entityId) return;
                                  const r = e.currentTarget.getBoundingClientRect();
                                  const building = processedBuildingsMap.get(entityId);
                                  const bName = gameNames.get(entityId) ?? translateName(entityId, gameLang);
                                  setImagePopup({ x: r.right, y: r.top, url: getImageUrl(entityId, building?.hash ?? "") ?? "", name: bName, id: entityId, subtitle: t("allyPlacedTitle", uiLang), anchorLeft: r.left });
                                }}
                                onMouseLeave={scheduleImagePopupClose}
                              >🏠</span>
                            ) : (
                              <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-red-950 text-red-400 border border-red-600" title={t("allyNotPlacedTitle", uiLang)}>{t("allyNotPlacedBadge", uiLang)}</span>
                            )}
                          </td>
                          <td className="cell-px-md">
                            {a.isFragment ? (
                              <span className="inline-block w-12 rounded border border-slate-700 bg-slate-950/70 px-1 py-0.5 text-center font-mono text-sm text-amber-400">
                                0
                              </span>
                            ) : (
                              <span className="inline-block w-12 rounded border border-slate-700 bg-slate-950/70 px-1 py-0.5 text-center font-mono text-sm text-slate-400">
                                {a.level}
                              </span>
                            )}
                            {/* + livelli dei GE (Colosseo / Tempio del Loto): statistiche calcolate al livello più questo */}
                            {!a.isFragment && a.boostLivello > 0 && (
                              <span className="ml-1 font-mono text-[12px] font-bold text-amber-300" title={t("allyBoostLevelTitle", uiLang, a.boostLivello, a.level + a.boostLivello)}>+{a.boostLivello}</span>
                            )}
                          </td>
                          <td className="cell-eff">
                            <span className="text-amber-400 text-sm">{formatEff(a.currentEff)}</span>
                          </td>
                          <MilitaryBoostCells general={a.computedGeneral} gbg={a.computedGbg} sped={a.computedSped} showSigmaColumns={showSigmaColumns} spedizioniEnabled />
                          <AllyProductionCells pf={a.computedPf} beni={a.computedBeni} beniP={a.computedBeniP} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabella database alleati completo: solo nel catalogo Alleati del
                Database (2.0; la scheda Alleati mostra solo i tuoi alleati) */}
            {alleatiDaDb && (
            // 2.0: catalogo Alleati del Database da bordo a bordo, spigoli vivi
            <div ref={buildingTableWrapperRef} className="-mx-2 bg-slate-900/20 border-y border-slate-800/80 overflow-hidden">
              <div
                ref={buildingTableScrollRef}
                onScroll={() => syncBuildingTableScroll("table")} {...guidaScroll("table")}
                className="overflow-x-auto"
              >
              <table className="building-table w-full table-fixed text-left border-collapse" style={{ minWidth: alliesTableMinWidth }}>
                  <colgroup>
                    <col className="w-full min-w-[240px]" />
                    <col className="w-[50px]" />
                    {!showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`gen-${i}`} className="w-[42px]" />)}
                    {Array.from({ length: 4 }).map((_, i) => <col key={`gbg-${i}`} className="w-[42px]" />)}
                    {Array.from({ length: 4 }).map((_, i) => <col key={`sped-${i}`} className="w-[42px]" />)}
                    {Array.from({ length: 3 }).map((_, i) => <col key={`prod-${i}`} className="w-[42px]" />)}
                  </colgroup>
                  <thead>
                    <tr className="bt-thead-row1 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      <th className="py-2 px-2 text-center" colSpan={2}>
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-slate-400 uppercase tracking-wider">{t("calcEfficiencyAtLevel", uiLang)}</span>
                          <div className="h-4 w-[1px] bg-slate-800 mx-2" />
                          <span className="text-slate-400 text-[11px] normal-case font-normal">{t("alliesVisualizedCount", uiLang)}: <span className="font-bold text-slate-300">{filteredAllies.length}</span></span>
                        </div>
                      </th>
                      {renderMilitaryGroupHeaders(true)}
                      {renderAllyProductionGroupHeader()}
                    </tr>
                    <tr className="bt-thead-row2 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      <SortableHeader label={t("colAlly", uiLang)} sortKey="name" onClick={() => handleSortAlleatiDb("name")} active={sortByAlleatiDb === "name"} order={sortOrderAlleatiDb} className="py-0.5 px-2 w-full min-w-[240px] text-left" />
                      <SortableHeader label="Eff" sortKey="eff" onClick={() => handleSortAlleatiDb("eff")} active={sortByAlleatiDb === "eff"} order={sortOrderAlleatiDb} className="th-eff" />

                        {renderMilitaryHeaders("alleati_db", true)}
                        {renderAllyProductionHeaders("alleati_db")}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
                    {filteredAllies.map((a) => {
                      return (
                      <tr
                        key={a.id + a.rarity}
                        className="transition-colors hover:bg-slate-900/40"
                      >
                        <td className="cell-name">
                          <AllyRarityName id={a.id} rarity={a.rarity} lang={uiLang} />
                        </td>
                        <td className="cell-eff">
                          <span className="text-amber-400 text-sm">{formatEff(a.currentEff)}</span>
                        </td>

                        <MilitaryBoostCells general={a.computedGeneral} gbg={a.computedGbg} sped={a.computedSped} showSigmaColumns={showSigmaColumns} spedizioniEnabled />
                        <AllyProductionCells pf={a.computedPf} beni={a.computedBeni} beniP={a.computedBeniP} />
                      </tr>
                    );
                    })}

                    {filteredAllies.length === 0 && (
                      <tr>
                        {/* nome+eff (2) + militari effettive: 4 con Σ, 8 senza, +4 se Spedizioni + 3 produzioni */}
                        <td colSpan={2 + (showSigmaColumns ? 4 : 8) + 4 + 3} className="text-center py-12 text-slate-400 font-semibold">
                          {t("noAlliesFound", uiLang)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {isBuildingTableVisible && buildingTableScrollMetrics.scrollWidth > buildingTableScrollMetrics.clientWidth && filteredAllies.length > 0 && (
                <div
                  className="fixed bottom-0 z-[80] border-t border-slate-700/80 bg-slate-950/95 shadow-[0_-8px_20px_rgba(0,0,0,0.35)] backdrop-blur"
                  style={{ left: buildingTableScrollMetrics.left, width: buildingTableScrollMetrics.clientWidth }}
                >
                  <div
                    ref={buildingTableFloatingScrollRef}
                    onScroll={() => syncBuildingTableScroll("floating")} {...guidaScroll("floating")}
                    className="building-floating-scrollbar h-4 overflow-x-auto overflow-y-hidden"
                  >
                    <div style={{ width: buildingTableScrollMetrics.scrollWidth, height: 1 }} />
                  </div>
                </div>
              )}
            </div>
            )}
          </>
          )}

          {/* SEMPRE montato (mai smontato/rimontato al cambio tab), nascosto con
              `hidden` (display:none) quando non è la tab attiva — a differenza di
              tutte le altre sezioni qui sopra, che invece sono condizionate con
              `{activeTab === "..." && (...)}` e quindi smontate quando non attive.
              Motivo: PiratiTool tiene tutto il suo stato (edifici piazzati, import,
              baseline, ecc.) in useState locali al componente. Smontare/rimontare
              su ogni cambio tab distruggeva quello stato: importare l'Insediamento,
              passare a un'altra tab e tornare su Pirati perdeva l'import. Tenerlo
              sempre montato lo mantiene vivo senza serializzare nulla su
              localStorage — `display:none` rimuove il nodo dal flusso di layout,
              quindi non interferisce con le altre tab quando non è quella attiva.
              Tool Insediamento dei Pirati, portato dal progetto standalone
              "foe-pirati" (agosto 2026) e montato come modulo separato: vedi
              data/piratiBuildings.ts, data/importCulturalOutpost.ts e il branch
              'cultural_outpost' di data/bookmarklet.ts. Dentro <main><section>,
              come tutte le altre tab (non più fuori), con lo stesso padding verso
              l'header (pt-1 di main). h-full/min-h-0/flex-col: propaga il vincolo
              di altezza reale di <main> (reso min-h-0/overflow-hidden solo su
              questa tab, vedi sopra) fino a PiratiTool, che ne ha bisogno per il
              ridimensionamento del planner (gridWrapperSize). */}
          <div className={activeTab === "pirati" ? "h-full min-h-0 flex flex-col" : "hidden"}>
            <PiratiTool ref={piratiToolRef} uiLang={uiLang} onNastro={setGruppiPirati} />
          </div>

        </section>
      </main>


      {/* ── Modale Import Sessione ────────────────────────────────────────── */}
      {isImportModalOpen && (
        <div
          className="modal-overlay"
          {...importModalBackdrop}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide flex items-center gap-2">
                <Upload size={16} />
                {t("importModalTitle", uiLang).toUpperCase()}
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label={t("closeAriaLabel", uiLang)}
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {importSuccess ? (
                <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-3 text-emerald-400 text-sm text-center flex items-center justify-center gap-2">
                  <Check size={16} />
                  {importSuccess}
                </div>
              ) : (
                <>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {t("importModalAddedNotice", uiLang)}
                  </p>
                  
                  <div className="space-y-3">
                    <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/30 p-6 cursor-pointer hover:border-amber-500/40 hover:bg-slate-800/50 transition-all">
                      <Upload size={24} className="text-slate-500" />
                      <span className="text-xs font-semibold text-slate-400">{t("importModalDropLabel", uiLang)}</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImportSession(f);
                        }}
                      />
                    </label>

                    {importError && (
                      <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-red-400 text-xs">
                        ⚠️ {importError}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {selectedJsonEntry && (
        <div className="modal-overlay">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="font-bold text-amber-400 uppercase tracking-wide">
                {selectedJsonEntry.title}
              </h3>
              <button 
                onClick={() => setSelectedJsonEntry(null)}
                className="text-slate-400 hover:text-white"
              >
                {t("closeAriaLabel", uiLang)}
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                {JSON.stringify(selectedJsonEntry.rawEntry, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {reportGe && datiGe?.edifici[reportGe] && (() => {
        const g = datiGe.edifici[reportGe]!, b = BUILDING_BY_ID.get(reportGe);
        // GE "AllAge" (Osservatorio, Oracolo, Tempio delle Reliquie): nel gioco sono
        // dell'Età del bronzo, e i beni per sbloccarne i livelli sono di quell'era (utente)
        const eraGe = g.era === "AllAge" ? "BronzeAge" : g.era;
        return (
          <Suspense fallback={null}>
            <PannelloReportGe id={reportGe} nome={displayName(reportGe, g.nome[uiLang === "en" ? "en" : "it"], uiLang)} nomeEn={g.nome.en} oro={g.tierMax === "gold"}
              era={eraGe} w={g.w} h={g.h} immagine={b ? getImageUrl(reportGe, b.hash) : null} uiLang={uiLang} onClose={() => setReportGe(null)}
              livello={activeTab === "propria_citta" ? greatBuildingsJson.get(reportGe)?.level : undefined}
              kitEra={activeTab === "propria_citta" ? { invecchiatore: specialKits.oneDownKit, inversione: specialKits.reversionKit, nomeInvecchiatore: specialKits.oneDownKitName, nomeInversione: specialKits.reversionKitName } : undefined}
              ereIndietro={activeTab === "propria_citta" && currentEraId >= 0 && AGE_BY_CODE.has(eraGe) ? Math.max(0, currentEraId - AGE_BY_CODE.get(eraGe)!.id) : undefined} />
          </Suspense>
        );
      })()}

      {imagePopup && (
        <div
          className="pointer-events-auto fixed z-[120] rounded-lg border border-amber-700/50 bg-slate-900 p-2 shadow-2xl shadow-black/60"
          style={(() => {
            // Larghezza REALE del pannello: 224 immagine (w-56) + 16 padding
            // (p-2 per lato) + 2 bordo. Prima era 232 ("224 + 8 padding"): 10 px
            // in meno, e aprendosi a sinistra il pannello finiva sopra l'ancora.
            const W = 242;
            const GAP = 8;
            const anchorLeft = imagePopup.anchorLeft ?? imagePopup.x;
            const showLeft = imagePopup.x + GAP + W > window.innerWidth;
            // A sinistra: il pannello deve FINIRE prima del bordo sinistro
            // dell'ancora (vedi ImagePopupState), non del destro — sulla mappa
            // l'ancora è il cursore, e coprirlo bloccava hover e click.
            const left = showLeft ? Math.max(8, anchorLeft - GAP - W) : imagePopup.x + GAP;
            const top = Math.min(imagePopup.y, window.innerHeight - 260);
            return { left, top: Math.max(8, top) };
          })()}
          onMouseEnter={cancelImagePopupClose}
          onMouseLeave={scheduleImagePopupClose}
        >
          {imagePopup.subtitle && (
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">{imagePopup.subtitle}</div>
          )}
          {imagePopup.url ? (
            <img
              src={imagePopup.url}
              alt={imagePopup.name}
              className="h-56 w-56 object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            // Nessun hash immagine per questo livello (vedi showImagePopup
            // in App.tsx): niente <img src=""> — un placeholder testuale al
            // posto dello sprite mancante, il popup resta comunque utile
            // per leggere l'ID qui sotto (bug segnalato luglio 2026).
            <div className="flex h-56 w-56 items-center justify-center text-[11px] text-slate-600 italic">
              {t("noImageAvailable", uiLang)}
            </div>
          )}
          <div className="mt-1 max-w-56 truncate text-center text-[11px] text-slate-300 select-text">{imagePopup.name}</div>
          {imagePopup.id && (
            <div className="max-w-56 truncate text-center text-[10px] font-mono text-slate-500 select-text">{imagePopup.id}</div>
          )}
        </div>
      )}
      {outdatedTooltip && (() => {
        const currentEraName = ageName(currentEra, gameLang);
        const { oneUpKit, renovationKit, oneUpKitName, renovationKitName, isUpgradable, upgradableTargets, upgradableKits, currentEraId, allLevels, eraComparisons } = outdatedTooltip;
        // Copie più vecchie dell'era corrente (per il conteggio nell'header).
        const outdatedCopies = allLevels.filter(lvl => lvl < currentEraId);
        // Colonne della griglia diff: non serve riservare 4 colonne larghe se il
        // blocco con più differenze ne ha solo 1, 2 o 3. Il popup si restringe
        // di conseguenza invece di apparire sproporzionato per pochi valori.
        // ⚠️ Conta solo i campi "stretti" (non isWideDiffKey, vedi sotto): i
        // campi pop/mon/mat vanno sempre a riga intera (col-span-full) quindi
        // non contribuiscono al numero di colonne affiancate — contarli qui
        // faceva calcolare un popup più largo del necessario (es. 4 colonne
        // anche quando solo 2 campi stavano davvero fianco a fianco, bug
        // segnalato luglio 2026 su "Mercantile Waystation").
        const maxDiffs = eraComparisons.reduce((m, c) => Math.max(m, c.diffs.filter(d => !isWideDiffKey(d.key)).length), 0);
        const diffCols = Math.max(1, Math.min(4, maxDiffs));
        const colWidthPx = 110; // larghezza stimata per colonna (icona + due numeri)
        // Minimo alto a sufficienza da non far andare a capo titoli/testi (es.
        // "SE AGGIORNI A [Era]", nomi kit, "N copie da [Era] (-N ere)").
        const popupWidthPx = Math.max(280, diffCols * colWidthPx + 24);
        const gridColsClass = diffCols === 1 ? "grid-cols-1" : diffCols === 2 ? "grid-cols-2" : diffCols === 3 ? "grid-cols-3" : "grid-cols-4";
        return (
          <div
            className="fixed-tooltip max-h-[80vh] overflow-y-auto border border-red-700/60"
            style={(() => {
              // Le righe di diff sono su diffCols colonne.
              const diffRows = eraComparisons.reduce((s, c) => s + Math.ceil(c.diffs.length / diffCols) + 1, 0);
              const TOOLTIP_H = Math.min(window.innerHeight * 0.8, 200 + diffRows * 18);
              const spaceBelow = window.innerHeight - outdatedTooltip.y;
              const showAbove = spaceBelow < TOOLTIP_H + 12;
              const width = Math.min(window.innerWidth * 0.92, popupWidthPx);
              return {
                width,
                left: Math.min(outdatedTooltip.x, window.innerWidth - width - 8),
                ...(showAbove
                  ? { bottom: window.innerHeight - outdatedTooltip.y + 6 }
                  : { top: outdatedTooltip.y + 6 }),
              };
            })()}
          >
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-red-400">
              {outdatedCopies.length} {outdatedCopies.length === 1 ? t("oldBuildingSingular", uiLang) : t("oldBuildingPlural", uiLang)}
            </div>
            {eraComparisons.length > 0 && (
              <div className="mt-1 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                  {t("upgradeToEraTitle", uiLang, currentEraName)}
                </p>
                {eraComparisons.map((cmp) => (
                  <div key={cmp.eraId} className="rounded border border-slate-700/40 bg-slate-950/40 px-1.5 py-1">
                    <p className="mb-1 text-[10px] text-slate-400">
                      <span className="font-semibold text-red-300">{cmp.count} {cmp.count === 1 ? t("copySingular", uiLang) : t("copyPlural", uiLang)}</span>
                      {" "}{t("fromEraWord", uiLang)} <span className="text-slate-300">{cmp.eraName}</span>
                      {" "}<span className="text-slate-400">({currentEraId - cmp.eraId === 1 ? t("eraDiffSingular", uiLang) : t("eraDiffPlural", uiLang, currentEraId - cmp.eraId)})</span>
                    </p>
                    <div className={`grid ${gridColsClass} gap-x-0.5 gap-y-0.5`}>
                      {/* Riordina SOLO per la visualizzazione (non tocca
                          cmp.diffs altrove, es. nel calcolo di goodsInvolved):
                          tutti i campi "stretti" prima, quelli "larghi"
                          (col-span-full: pop/mon/mat) dopo. Con CSS Grid
                          auto-placement, un col-span-full incontrato IN MEZZO
                          a campi stretti chiude subito la riga corrente anche
                          se non è piena — es. attacco+difesa+incursioni (3
                          stretti, 4a colonna libera) seguiti da pop
                          (col-span-full) sprecavano quella 4a colonna e
                          spingevano il campo stretto successivo (fel) su una
                          riga a parte invece che affiancato — bug segnalato
                          luglio 2026 su "Capy's Winter Holiday Spa". Mettendo
                          tutti gli stretti in sequenza PRIMA di qualsiasi
                          largo, il grid li raggruppa naturalmente riempiendo
                          ogni riga prima di passare ai col-span-full. */}
                      {[...cmp.diffs].sort((a, b) => Number(isWideDiffKey(a.key)) - Number(isWideDiffKey(b.key))).map((d) => {
                        const up = d.to > d.from;
                        const useFormatInt = ["pop", "fel", "mon", "mat", "med", "iqMon", "iqMat"].includes(d.key);
                        // isWideDiffKey (definita fuori dal componente): Pop/
                        // Mon/Mat possono arrivare a 5-6+ cifre (es. "106.290
                        // → 235.290", "15.890 → 27.890") — condividendo una
                        // colonna stretta (~110px, stimata per numeri corti
                        // come attacco/difesa) con le altre celle della
                        // griglia, il testo veniva troncato/coperto dalla
                        // colonna successiva o sbordava dal popup (bug
                        // segnalato luglio 2026 su "Mercantile Waystation").
                        // col-span-full: riga propria a piena larghezza.
                        return (
                          <div key={d.key} className={`flex items-center gap-1 text-xs font-mono ${isWideDiffKey(d.key) ? "col-span-full" : ""}`} title={t(d.labelKey, uiLang)}>
                            {d.icon
                              ? <img src={d.icon} alt={t(d.labelKey, uiLang)} className="h-4 w-4 shrink-0 object-contain" />
                              : <span className="w-4 shrink-0 text-center">{d.emoji}</span>}
                            <span className="text-slate-400 tabular-nums">{useFormatInt ? formatInt(d.from) : d.from}</span>
                            <span className="text-slate-600">→</span>
                            <span className={`font-bold tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>{useFormatInt ? formatInt(d.to) : d.to}</span>
                          </div>
                        );
                      })}
                    </div>
                    {cmp.diffs.length === 0 && !cmp.goodsInvolved && (
                      <p className="text-[10px] text-slate-400 italic">{t("noProductionChanges", uiLang)}</p>
                    )}
                    {cmp.goodsInvolved && (
                      <p className="text-[10px] text-amber-400/80">
                        {t("goodsEraChangeNote", uiLang, currentEraName, cmp.eraName)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2.5 space-y-1.5 border-t border-slate-700/60 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("upgradeKitsAvailable", uiLang)}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1"><img src={iconOneUp} alt="" className="h-3.5 w-3.5 object-contain" /> {oneUpKitName ?? t("prodOneUpKit", gameLang === "it" ? "it" : "en")}</span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${oneUpKit > 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/40 text-red-400"}`}>
                  {t("inInventoryCount", uiLang, oneUpKit)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1"><img src={iconRinn} alt="" className="h-3.5 w-3.5 object-contain" /> {renovationKitName ?? t("prodRenovationKit", gameLang === "it" ? "it" : "en")}</span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${renovationKit > 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/40 text-red-400"}`}>
                  {t("inInventoryCount", uiLang, renovationKit)}
                </span>
              </div>
            </div>
            {isUpgradable && (
              <div className="mt-2.5 rounded-lg border border-sky-600/50 bg-sky-950/60 p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-300">
                  <span>✨</span> {t("upgradableLabel", uiLang)}
                </div>
                {upgradableTargets.length > 0 && (
                  <p className="mb-1 text-[11px] text-sky-200/80">
                    {t("upgradeTargetLabel", uiLang)} <span className="font-semibold">{upgradableTargets.join(", ")}</span>
                  </p>
                )}
                <p className="text-xs text-slate-200">
                  {t("upgradeBody", uiLang)}{" "}
                  <span className="font-semibold text-sky-300">{t("upgradeAutoEraNote", uiLang)}</span>.
                </p>
                {upgradableKits.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[11px] text-sky-200/80">
                    {upgradableKits.map((k, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-sky-400">•</span>
                        <span className="flex-1">{k.name}</span>
                        <span className="shrink-0 rounded bg-sky-900/60 px-1 font-mono font-bold text-sky-200">×{k.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {upgradeTooltip && (
        <div
          className="fixed-tooltip w-64 border border-sky-700/60"
          style={(() => {
            const TOOLTIP_H = 160;
            const spaceBelow = window.innerHeight - upgradeTooltip.y;
            const showAbove = spaceBelow < TOOLTIP_H + 12;
            return {
              left: Math.min(upgradeTooltip.x, window.innerWidth - 264),
              ...(showAbove
                ? { bottom: window.innerHeight - upgradeTooltip.y + 6 }
                : { top: upgradeTooltip.y + 6 }),
            };
          })()}
        >
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-sky-300">
            {t("upgradableToLabel", uiLang)}
          </div>
          <div className="mb-2 text-xs font-semibold text-slate-100">
            {upgradeTooltip.targets.join(", ")}
          </div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {t("kitsInInventoryLabel", uiLang)}
          </div>
          <ul className="space-y-0.5 text-xs text-slate-200">
            {upgradeTooltip.kits.map((k, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-sky-400">•</span>
                <span className="flex-1">{k.name}</span>
                <span className="shrink-0 rounded bg-sky-900/60 px-1 font-mono font-bold text-sky-200">×{k.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {declassableTooltip && (() => {
        const { eraAge, diffs, popSavings, oneDownKit, oneDownKitName, reversionKit, reversionKitName } = declassableTooltip;
        const fromEraName = eraAge ? ageName(eraAge, gameLang) : "—";
        const bronzeEraName = ageName("BronzeAge", gameLang);
        const cols = diffs.length > 3 ? 2 : 1;
        const gridColsClass = cols === 2 ? "grid-cols-2" : "grid-cols-1";
        const minW = cols === 2 ? 340 : 260;
        return (
          <div
            className="fixed-tooltip border border-emerald-700/60"
            style={(() => {
              const TOOLTIP_H = 200 + Math.ceil(diffs.length / cols) * 20;
              const spaceBelow = window.innerHeight - declassableTooltip.y;
              const showAbove = spaceBelow < TOOLTIP_H + 12;
              const w = Math.min(window.innerWidth * 0.92, minW);
              return {
                width: w,
                left: Math.min(declassableTooltip.x, window.innerWidth - w - 8),
                ...(showAbove
                  ? { bottom: window.innerHeight - declassableTooltip.y + 6 }
                  : { top: declassableTooltip.y + 6 }),
              };
            })()}
          >
            {/* Header */}
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
              <svg viewBox="0 0 8 8" width="8" fill="#2a6"><path d="M0 0l4 8 4-8H0z"/></svg>
              {t("declassableTooltipHeader", uiLang)}
            </div>
            {/* Era subtitle */}
            <p className="mb-2 text-[10px] font-semibold text-slate-400">{fromEraName} → {bronzeEraName}</p>
            {/* Diffs grid */}
            {diffs.length > 0 && (
              <div className="rounded border border-slate-700/40 bg-slate-950/40 px-1.5 py-1 mb-2">
              <div className={`grid ${gridColsClass} gap-x-0.5 gap-y-0.5`}>
                {diffs.map((d) => {
                  const up = d.to > d.from;
                  const useFormatInt = ["pop", "fel", "mon", "mat", "med", "iqMon", "iqMat"].includes(d.key);
                  return (
                    <div key={d.key} className="flex items-center gap-1 text-xs font-mono" title={t(d.labelKey, uiLang)}>
                      {d.icon
                        ? <img src={d.icon} alt={t(d.labelKey, uiLang)} className="h-4 w-4 shrink-0 object-contain" />
                        : <span className="w-4 shrink-0 text-center text-[10px]">{d.emoji}</span>}
                      <span className="text-slate-400 tabular-nums font-mono">{useFormatInt ? formatInt(d.from) : d.from}</span>
                      <span className="text-slate-600">→</span>
                      <span className={`font-bold tabular-nums font-mono ${up ? "text-emerald-400" : "text-red-400"}`}>{useFormatInt ? formatInt(d.to) : d.to}</span>
                    </div>
                  );
                })}
              </div>
              </div>
            )}
            {/* Invecchiabile: stessi beni e valori militari (sopra, cosa cambia invece) */}
            <p className="border-t border-slate-700/60 pt-1.5 pb-2 text-xs text-emerald-300">
              {t("declassableSame", uiLang, bronzeEraName)}
              {popSavings > 0 && <span className="ml-1 text-slate-400">· <img src={iconPop} alt="" className="inline h-3.5 w-3.5 object-contain align-[-2px]" /> +{formatInt(popSavings)}</span>}
            </p>
            {/* Kit */}
            <div className="border-t border-slate-700/60 pt-2">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("declassableKitSection", uiLang)}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{oneDownKitName ?? t("prodOneDownKit", gameLang === "it" ? "it" : "en")}</span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${oneDownKit > 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/40 text-red-400"}`}>
                  {t("inInventoryCount", uiLang, oneDownKit)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-slate-300">{reversionKitName ?? t("prodReversionKit", gameLang === "it" ? "it" : "en")}</span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${reversionKit > 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/40 text-red-400"}`}>
                  {t("inInventoryCount", uiLang, reversionKit)}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {fragmentTooltip && (
        <div
          className="fixed-tooltip max-h-[70vh] w-80 overflow-y-auto border border-emerald-700/60"
          style={(() => {
            const TOOLTIP_H = window.innerHeight * 0.7;
            const spaceBelow = window.innerHeight - fragmentTooltip.y;
            const showAbove = spaceBelow < TOOLTIP_H + 12;
            return {
              left: Math.min(fragmentTooltip.x, window.innerWidth - 304),
              ...(showAbove
                ? { bottom: window.innerHeight - fragmentTooltip.y + 6 }
                : { top: fragmentTooltip.y + 6 }),
            };
          })()}
        >
          <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
            <img src={iconFragment} alt="" className="icon-16" />
            {t("fragmentsProducedTitle", uiLang)}
          </div>
          <ul className="space-y-1.5 text-xs text-slate-200">
            {fragmentTooltip.produced.map((item, i) => (
              <li key={i}>
                <div className="flex items-start gap-1.5">
                  <span className="text-emerald-400">•</span>
                  <span className="flex-1">
                    {item.name}
                    {/* "(prodotti/richiesti)": mostrato SOLO se entrambi i numeri
                        sono noti — un singolo valore isolato confonderebbe più
                        che aiutare (vedi commento nel call-site di setFragmentTooltip). */}
                    {item.producedAmount !== undefined && item.requiredAmount !== undefined && (
                      <span className="ml-1 font-mono text-slate-400">
                        ({item.producedAmount}/{item.requiredAmount})
                      </span>
                    )}
                  </span>
                </div>
                {/* Selection kit: mostra anche cosa si può scegliere (il nome
                    del kit spesso non lo chiarisce) — kit.json come sorgente. */}
                {item.options && item.options.length > 0 && (
                  <div className="ml-4 mt-1 rounded border border-violet-800/40 bg-violet-950/20 px-2 py-1">
                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                      {t("selectionKitOptionsTitle", uiLang)}
                    </div>
                    <ul className="space-y-0.5">
                      {item.options.map((opt, j) => (
                        <li key={j} className="flex items-start gap-1">
                          <span className="text-violet-400">•</span>
                          <span className="flex-1 text-slate-300">{opt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {fabTooltip && (
        <div
          className="fixed-tooltip max-w-xs overflow-y-auto border border-amber-700/50"
          style={(() => {
            const TOOLTIP_H = 220;
            const spaceBelow = window.innerHeight - fabTooltip.y;
            const showAbove = spaceBelow < TOOLTIP_H + 12;
            return {
              left: Math.min(fabTooltip.x, window.innerWidth - 320),
              ...(showAbove
                ? { bottom: window.innerHeight - fabTooltip.y + 6 }
                : { top: fabTooltip.y + 6 }),
            };
          })()}
        >
          {fabTooltip.sourceId && (
            <div className="mb-2 pb-1.5 border-b border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wide text-sky-300 mb-0.5">{t("fromInventoryLabel", uiLang)}</div>
              <div className="text-xs text-slate-200">
                {displayName(fabTooltip.sourceId, ITALIAN_NAMES.get(fabTooltip.sourceId) ?? fabTooltip.sourceId, gameLang)}
              </div>
            </div>
          )}
          {fabTooltip.choices && fabTooltip.choices.length > 1 && (
            <div className="mb-2 pb-1.5 border-b border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wide text-violet-300 mb-0.5">{t("fabChoiceLabel", uiLang)}</div>
              <ul className="space-y-0.5 text-xs text-slate-200">
                {fabTooltip.choices.map((id, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-violet-400 shrink-0">•</span>
                    <span>{ITALIAN_NAMES.get(id) ?? id}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fabTooltip.kitsUsed.length > 0 && (() => {
            const kitCountMap = new Map<string, number>();
            for (const k of fabTooltip.kitsUsed) kitCountMap.set(k, (kitCountMap.get(k) ?? 0) + 1);
            return (
              <>
                <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300 mb-1">{t("requiredKits", uiLang)}</div>
                <ul className="space-y-1 text-xs text-slate-200">
                  {Array.from(kitCountMap.entries()).map(([kitId, n], i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-amber-400 shrink-0">•</span>
                      <span className="flex-1">{kitName(kitId, gameLang)}</span>
                      <span className="shrink-0 rounded bg-amber-900/60 px-1 font-mono font-bold text-amber-200">×{n}</span>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
        </div>
      )}

      {kitProducersTooltip && (
        <div
          className="fixed-tooltip max-h-[70vh] w-72 overflow-y-auto border border-emerald-700/60"
          style={(() => {
            const TOOLTIP_H = window.innerHeight * 0.7;
            const spaceBelow = window.innerHeight - kitProducersTooltip.y;
            const showAbove = spaceBelow < TOOLTIP_H + 12;
            return {
              left: Math.min(kitProducersTooltip.x, window.innerWidth - 296),
              ...(showAbove
                ? { bottom: window.innerHeight - kitProducersTooltip.y + 6 }
                : { top: kitProducersTooltip.y + 6 }),
            };
          })()}
        >
          <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
            <img src={iconFragment} alt="" className="icon-16" />
            {t("fragmentsProducedByTitle", uiLang)}
          </div>
          <ul className="space-y-1 text-xs text-slate-200">
            {kitProducersTooltip.producers.map((p, i) => {
              const inCity = cityEntityIds.has(p.id);
              const inInv = inventoryMatched.has(p.id);
              return (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="text-emerald-400">•</span>
                  <span className="flex-1">{p.name}</span>
                  {inCity && <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{t("inCityBadge", uiLang)}</span>}
                  {inInv && <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">{t("inInventoryBadge")}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Modale Avviso Versione Outdated ─────────────────────────────── */}
      {isOutdatedModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="flex w-full max-w-md flex-col rounded-2xl border border-red-500/30 bg-slate-900 p-8 shadow-2xl">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <RotateCcw size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">{t("outdatedModalTitle", uiLang)}</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                {t("outdatedModalIntro", uiLang)}{" "}
                {t("outdatedModalBody", uiLang, t("outdatedModalBodyEmphasis", uiLang))}
              </p>
              <div className="mt-4 rounded-lg bg-red-500/5 border border-red-500/20 p-3 text-xs text-red-400">
                {t("outdatedModalDetail", uiLang)}
              </div>
            </div>
            
            <button
              onClick={() => {
                cleanupOrphanedKeys();
                setIsOutdatedModalOpen(false);
              }}
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20 active:scale-[0.98]"
            >
              {t("outdatedModalButton", uiLang)}
            </button>
          </div>
        </div>
      )}
      {/* ── Modale Avviso Bacchetta Magica Obsoleta ─────────────────────── */}
      {isBookmarkletOutdatedModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="flex w-full max-w-md flex-col rounded-2xl border border-amber-500/30 bg-slate-900 p-8 shadow-2xl">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                <Wand2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">{t("bookmarkletOutdatedModalTitle", uiLang)}</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                {t("bookmarkletOutdatedModalIntro", uiLang)}
              </p>
              <div className="mt-4 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-400">
                {/* testo con il grassetto su "elimina" e, al posto di {bacchetta}, il pulsante verde della testata (stesso aspetto) */}
                {t("bookmarkletOutdatedModalSteps", uiLang).split(/(\{elimina\}.*?\{\/elimina\}|\{bacchetta\})/).map((parte, i) =>
                  parte === "{bacchetta}"
                    ? <span key={i} className="mx-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500/50 bg-emerald-500/10 align-middle text-emerald-300"><Wand2 size={13} aria-hidden="true" /></span>
                    : parte.startsWith("{elimina}")
                      ? <strong key={i} className="text-amber-300">{parte.slice(9, -10)}</strong>
                      : parte)}
              </div>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">{t("bookmarkletOutdatedModalReimport", uiLang)}</p>
            </div>

            <button
              onClick={() => setIsBookmarkletOutdatedModalOpen(false)}
              className="w-full rounded-xl bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/20 active:scale-[0.98]"
            >
              {t("bookmarkletOutdatedModalButton", uiLang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
