import { useState, useEffect, useMemo, useRef, useDeferredValue, useCallback, memo, type ReactNode } from "react";
import {
  Swords,
  Trash2,
  Search,
  Download,
  X as XIcon,
  RotateCcw,
  Info,
  Home,
  Package,
  Users,
  Upload,
  Check,
  Wand2,
  ChevronDown
} from "lucide-react";

import type { Building } from "./data/buildings";
import { getImageUrl } from "./data/buildings";
import type { Weights } from "./utils/calculator";
import { calculateEfficiency } from "./utils/calculator";
import { formatInt, formatEff, formatDecimal, formatProdNum, formatProdPercent, formatProdK, isStaleField } from "./utils/format";
import * as Allies from "./data/allies";
import { parseInventory, kitTier, type InventoryEntry, type SelectionKitEntry, type UpgradeKitEntry, type SpecialKits, type InventoryStore } from "./data/inventory";
import { parseBuildingsCsv } from "./data/buildings";
import { type CityMapBuilding, type CityMapBounds } from "./data/cityMap";
import type { CityStore } from "./data/cityStore";
import { BOOKMARKLET_JS, validateBookmarkletData, type BookmarkletData, type CityEntityDefinition, type CityMapEntry, type UnlockedArea } from "./data/bookmarklet";
import type {
  Profile} from "./utils/storage";
import { PROFILES_KEY, ACTIVE_PROFILE_KEY, DEFENSE_KEY, SPED_ENABLED_KEY, SPED_ATTACK_KEY, SIGMA_KEY, POP_COLUMN_KEY, FEL_COLUMN_KEY, IQ_PROD_COLUMNS_KEY, PROD_COLUMNS_KEY, SHOW_CITY_MAP_KEY, DB_VIEW_KEY, UI_LANG_KEY,
  profileStorageKey, readStoredJson, writeStoredJson, clearStoredJson, reviveMap, reviveSet,
  initCityStore, initInventoryStore, initAlliesStore, cleanupOrphanedKeys,
  loadProfiles, getActiveProfileId, collectFoeLocalStorage, mergeImportedProfiles,
  isStorageOutdated
} from "./utils/storage";
import buildingsCsv from "./assets/buildings.csv?raw";
import alliesCsv from "./assets/allies.csv?raw";
import { FALLBACK_ERA, ageName, AGES_BY_ID, AGE_BY_CODE } from "./data/ages";
import eventsCsv from "./assets/events.csv?raw";
import kitData from "./assets/kit.json";
import { BuildingModel, type GreatBuilding, type EraStats } from "./models/BuildingModel";
import CityMapView, { type CityMapDragState } from "./components/CityMapView";
import EfficiencyHelpModal from "./components/EfficiencyHelpModal";
import ProfileHelpModal from "./components/ProfileHelpModal";
import AboutModal from "./components/AboutModal";
import { initKitData, computeAllFamilies, type FamilyResult, type KitDataRaw } from "./data/inventoryOptimizer";
import { translateName, getItalianMap, initTranslations, hasTranslation, type Lang } from "./data/translations";
import { t, UI_LANGUAGES, boostTitle, type UiLang, type UiKey } from "./data/ui-strings";
import { isGreatBuildingId, isInactiveBuildingId, isMilitaryBuildingId,
  isBattlegroundsPrizeId, isQuantumIncursionsPrizeId, getSettlementInfo,
  isAscendedUpgradeKit,
  isFragmentBuildingToken, isFragmentKitToken, fragmentBuildingId,
  BUILDING_ROW_COLORS, ROW_DISCONNECTED_OVERLAY, RARITY_FROM_GAME } from "./data/buildingClassification";
import {
  iconSize, iconRoad, iconPop, iconFel, iconFP, iconFPB, iconBeni, iconBeniP, iconBeniS, iconBeniB, iconBeniG,
  iconMon, iconMat,
  iconGenAtk_A as iconGenAtkA, iconGenDef_A as iconGenDefA,
  iconGenAtk_D as iconGenAtkD, iconGenDef_D as iconGenDefD,
  iconCampiAtk_A as iconCampiAtkA, iconCampiDef_A as iconCampiDefA,
  iconCampiAtk_D as iconCampiAtkD, iconCampiDef_D as iconCampiDefD,
  iconSpedAtk_A as iconSpedAtkA, iconSpedDef_A as iconSpedDefA,
  iconSpedAtk_D as iconSpedAtkD, iconSpedDef_D as iconSpedDefD,
  iconIQAtk_A as iconIQAtkA, iconIQDef_A as iconIQDefA,
  iconIQAtk_D as iconIQAtkD, iconIQDef_D as iconIQDefD,
  iconIQMonB, iconIQMatB, iconIQMon, iconIQMat, iconIQProd,
  iconIQBeni, iconIQTruppe, iconIQAzioni, iconIQCap, iconFUR, iconBP, iconTR, iconTRNE,
  iconOneUp, iconImm, iconRinn, iconAiuto, allies_slot_empty, allies_slot_full,
} from "./assets/icons";

// I nomi (NomeIta/NomeEng) sono ora colonne dirette di buildings.csv/allies.csv,
// quindi il parsing non richiede più una mappa di traduzione esterna.
const BUILDINGS_FROM_CSV: Building[] = parseBuildingsCsv(buildingsCsv);
const ALLIES_FROM_CSV: Allies.Ally[] = Allies.parseAlliesCsv(alliesCsv);

// Costruisce le mappe it/en a partire dai nomi appena estratti dai due CSV
// (sostituisce il vecchio traduzioni_edifici.csv, ora eliminato).
initTranslations(BUILDINGS_FROM_CSV, ALLIES_FROM_CSV);

// Mappa italiana di default per i factory (calcoli eff, ecc.) che avvengono
// al boot prima che la lingua del profilo sia nota.
const ITALIAN_NAMES = getItalianMap();

// ────────────────────────────────────────────────────────────────
// FRAMMENTI EDIFICIO: mappa inversa target -> elenco edifici produttori
// Costruita in un singolo passaggio (O(N·F)) dopo aver caricato tutti gli
// edifici dal CSV. Considera solo i frammenti di tipo "building".
// ────────────────────────────────────────────────────────────────
const FRAGMENT_BUILDING_PRODUCERS = new Map<string, string[]>();
// Mappa frammenti kit (selection/upgrade) -> elenco edifici che li producono
const FRAGMENT_KIT_PRODUCERS = new Map<string, string[]>();
for (const b of BUILDINGS_FROM_CSV) {
  if (!b.fragments) continue;
  for (const token of b.fragments.split("|")) {
    const frag = token.trim();
    if (!frag) continue;
    if (isFragmentBuildingToken(frag)) {
      // "building_W_MultiAge_WIN22B1" -> "W_MultiAge_WIN22B1"
      const targetId = fragmentBuildingId(frag);
      const arr = FRAGMENT_BUILDING_PRODUCERS.get(targetId);
      if (arr) arr.push(b.cityEntityId);
      else FRAGMENT_BUILDING_PRODUCERS.set(targetId, [b.cityEntityId]);
    } else if (isFragmentKitToken(frag)) {
      // L'id del kit coincide col token (es. "selection_kit_FELL25BC", "upgrade_kit_ascended_ARCH19A")
      const arr = FRAGMENT_KIT_PRODUCERS.get(frag);
      if (arr) arr.push(b.cityEntityId);
      else FRAGMENT_KIT_PRODUCERS.set(frag, [b.cityEntityId]);
    }
  }
}

// Pre-compute inherited-ally chains once at module load (avoids O(n²) per-render filtering)
const INHERITED_ALLIES_MAP = new Map<string, Allies.Ally[]>();
for (const ally of ALLIES_FROM_CSV) {
  INHERITED_ALLIES_MAP.set(
    `${ally.id}__${ally.rarity}`,
    ALLIES_FROM_CSV.filter(c => c.id === ally.id && c.rarity >= 1 && c.rarity <= ally.rarity),
  );
}

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
    { key: "pop", labelKey: "diffPopulation", icon: icons.iconPop, get: sca("pop") },
    { key: "fel", labelKey: "diffHappiness", icon: icons.iconFel, get: sca("fel") },
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
    // Produzioni
    { key: "mon", labelKey: "diffCoins", icon: icons.iconMon, get: sca("mon") },
    { key: "mat", labelKey: "diffMaterials", icon: icons.iconMat, get: sca("mat") },
    { key: "fp", labelKey: "diffForgePoints", icon: icons.iconFP, get: sca("fp") },
    { key: "fpb", labelKey: "diffForgePointsBoost", icon: icons.iconFPB, get: sca("fpb") },
    { key: "fur", labelKey: "diffRogues", icon: icons.iconFUR, get: sca("fur") },
    { key: "tr", labelKey: "diffUnits", icon: icons.iconTR, get: sca("tr") },
    { key: "trne", labelKey: "diffUnitsNextEra", icon: icons.iconTRNE, get: sca("trne") },
    { key: "beni", labelKey: "diffGoods", icon: icons.iconBeni, get: sca("beni") },
    { key: "benip", labelKey: "diffGoodsPreviousEra", icon: icons.iconBeniP, get: sca("benip") },
    { key: "benis", labelKey: "diffGoodsNextEra", icon: icons.iconBeniS, get: sca("benis") },
    { key: "benib", labelKey: "diffGoodsBoost", icon: icons.iconBeniB, get: sca("benib") },
    { key: "benig", labelKey: "diffTreasuryGoods", icon: icons.iconBeniG, get: sca("benig") },
    { key: "bp", labelKey: "diffBlueprints", icon: icons.iconBP, get: sca("bp") },
    { key: "fsp", labelKey: "prodRushSpecial", emoji: "⏳", get: sca("fsp") },
    { key: "tpm", labelKey: "prodRushMaterials", emoji: "🛠", get: sca("tpm") },
    { key: "tpb", labelKey: "prodRushGoods", emoji: "📦", get: sca("tpb") },
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

const buildingMatchesEvent = (cityEntityId: string, event: EventEntry | null | undefined): boolean => {
  if (!event || event.tokens.length === 0) return false;
  const idUpper = cityEntityId.toUpperCase();
  return event.tokens.some((token) => idUpper.includes(token.toUpperCase()));
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
}: {
  label: React.ReactNode;
  onClick: (() => void) | null;
  active: boolean;
  order: "asc" | "desc";
  className?: string;
  title?: string;
  sortKey?: string;
}) {
  const clickable = onClick !== null;
  return (
    <th
      onClick={onClick ?? undefined}
      title={title}
      data-sort-key={sortKey}
      className={`${className} ${clickable ? "cursor-pointer select-none hover:text-amber-400 transition-colors" : ""} ${active ? "!text-amber-400" : ""}`}
    >
      <span className="inline-flex items-center gap-1">
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

/** Bandiera italiana, SVG vettoriale (non emoji: rendering coerente su ogni
 *  sistema/browser). Tre bande verticali, angoli leggermente arrotondati. */
const FlagIT = memo(function FlagIT({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 24 17.3" className="rounded-[2px] shadow-sm shrink-0">
      <rect width="24" height="17.3" rx="2" fill="#F4F9FF" />
      <path d="M2 0h6v17.3H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z" fill="#008C45" />
      <rect x="16" width="8" height="17.3" fill="#CD212A" />
      <path d="M16 0h6a2 2 0 0 1 2 2v13.3a2 2 0 0 1-2 2h-6Z" fill="#CD212A" />
      <rect width="24" height="17.3" rx="2" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
    </svg>
  );
});

/** Bandiera del Regno Unito, SVG vettoriale semplificato ma riconoscibile
 *  (Union Jack: croci di San Giorgio + Sant'Andrea su fondo blu navy). */
const FlagGB = memo(function FlagGB({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 24 17.3" className="rounded-[2px] shadow-sm shrink-0">
      <defs>
        <clipPath id="flagGbClip"><rect width="24" height="17.3" rx="2" /></clipPath>
      </defs>
      <g clipPath="url(#flagGbClip)">
        <rect width="24" height="17.3" fill="#012169" />
        <path d="M0 0 24 17.3 M24 0 0 17.3" stroke="#FFFFFF" strokeWidth="3.4" />
        <path d="M0 0 24 17.3 M24 0 0 17.3" stroke="#C8102E" strokeWidth="1.3" />
        <path d="M12 0v17.3 M0 8.65h24" stroke="#FFFFFF" strokeWidth="5.7" />
        <path d="M12 0v17.3 M0 8.65h24" stroke="#C8102E" strokeWidth="3.4" />
      </g>
      <rect width="24" height="17.3" rx="2" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
    </svg>
  );
});

/** Bandiera corrispondente a ciascun codice lingua GUI. Mappa centralizzata:
 *  aggiungere una lingua significa aggiungere una entry qui (oltre a
 *  UI_LANGUAGES in ui-strings.ts) — il dropdown sotto non cambia. */
const FLAG_BY_LANG: Record<UiLang, React.ComponentType<{ size?: number }>> = {
  it: FlagIT,
  en: FlagGB,
};

/** Selettore lingua GUI: un solo pulsante con la bandiera attiva (grande,
 *  ben visibile) che apre un piccolo menu con tutte le lingue disponibili.
 *  A differenza di due bandiere affiancate, la larghezza dell'header non
 *  cresce se in futuro si aggiungono altre lingue — cresce solo il menu,
 *  che è verticale e scrollabile se necessario. Si chiude al click fuori
 *  o su Escape. */
const LanguageSwitch = memo(function LanguageSwitch({ uiLang, onChange }: { uiLang: UiLang; onChange: (lang: UiLang) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ActiveFlag = FLAG_BY_LANG[uiLang];

  // position:fixed con coordinate calcolate dal pulsante, invece di
  // position:absolute nel normale flusso del documento: il pulsante vive
  // dentro una barra con overflow-x-auto (la barra profili), che taglierebbe
  // un menu absolute non appena uscisse dall'area visibile scrollabile.
  // Fixed invece non viene mai tagliato dagli antenati con overflow, ed è
  // lo stesso pattern già usato altrove nel progetto per tooltip/popup
  // (fabTooltip, imagePopup) per la stessa ragione.
  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setIsOpen((v) => !v);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        title={t("languageSwitchTitle", uiLang)}
        aria-label={t("languageSwitchTitle", uiLang)}
        aria-expanded={isOpen}
        className="flex h-7 items-center gap-1 rounded border border-slate-700/60 bg-slate-800/40 px-1 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all"
      >
        <ActiveFlag size={24} />
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && menuPos && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
          className="z-50 min-w-[190px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60"
        >
          {UI_LANGUAGES.map(({ code, nativeName }) => {
            const Flag = FLAG_BY_LANG[code];
            const isActive = code === uiLang;
            return (
              <button
                key={code}
                onClick={() => { setIsOpen(false); onChange(code); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                  isActive ? "bg-amber-500/10 text-amber-300 font-semibold" : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Flag size={18} />
                {nativeName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

/** Badge quantità per i pannelli Debug (Città/Inventario): "×N" col colore
 *  della sezione, omesso quando N === 1 (es. i Grandi Edifici sono sempre
 *  univoci, non serve mostrare "×1" su ognuno). */
function DebugQtyBadge({ qty, colorClass }: { qty: number; colorClass: string }) {
  if (qty === 1) return null;
  return <span className={colorClass}> ×{qty}</span>;
}

const TableHeaderIcon = memo(function TableHeaderIcon({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  if (!src) {
    return <span title={alt || undefined} className="text-[11px] font-bold uppercase">{alt}</span>;
  }
  return <img src={src} alt={alt} title={alt || undefined} className={`inline-block h-[24px] w-auto relative top-[1px] ${className}`} />;
});



const BoostCell = memo(function BoostCell({ value, color, className = "", suffix = "", uiLang }: { value: number; color: "red" | "blue"; className?: string; suffix?: string; uiLang?: UiLang }) {
  if (isStaleField(value)) {
    return <td className={className ? `cell-num ${className}` : "cell-num"} title={uiLang ? t("staleDataWarning", uiLang) : undefined}>⚠️</td>;
  }
  if (value === 0) {
    return <td className={className ? `cell-num ${className}` : "cell-num"}>-</td>;
  }
  return (
    <td className={className ? `cell-num cell-${color} ${className}` : `cell-num cell-${color}`}>
      {formatInt(value)}{suffix}
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
function Boost4({ values, uiLang }: { values: [number, number, number, number]; uiLang?: UiLang }) {
  return (
    <>
      <BoostCell value={values[0]} color="red" className="section-divider" uiLang={uiLang} />
      <BoostCell value={values[1]} color="red" uiLang={uiLang} />
      <BoostCell value={values[2]} color="blue" uiLang={uiLang} />
      <BoostCell value={values[3]} color="blue" uiLang={uiLang} />
    </>
  );
}

/** Le 8/12 celle dei bonus Generale + Campi/Σ + Spedizioni/Σ: stesso blocco
 *  ripetuto identico (a parte la fonte dati) nelle 3 tabelle (edifici, alleati
 *  posseduti, database alleati). `general`/`gbg`/`sped` sono i 4 valori
 *  [AttAtt, DifAtt, AttDif, DifDif] della rispettiva fonte (Building.general
 *  o ComputedAllyStats.computedGeneral, ecc.). */
type TabType = "database" | "alleati" | "propria_citta" | "inventario";
type FilterType = "all" | "incursioni" | "alleati" | "insediamenti" | "premi_campi" | "premi_iq";

type TabFilters = {
  showOnlyFilter: FilterType;
  showEventFilter: string;
  showIncursionBuildings: boolean;
  showAllyBuildings: boolean;
  showMassAidBuildings: boolean;
  showStoreBuildingBuildings: boolean;
  showGreatBuildings: boolean;
  showLimitedAscended: boolean;
  showTimeColumn: boolean;
  prodFilter: Set<string>;
  prodFilterMode: "AND" | "OR";
  minEff: string;
};

/** Building "elaborato" per la tabella: aggiunge l'efficienza calcolata e i
 *  campi usati per ricerca/ordinamento/provenienza-da-kit. Tipo modulo-level
 *  (non locale ad App) cosi' da poter essere usato anche da BuildingRow. */
type ProcessedBuilding = Building & {
  currentEff: number;
  searchName: string;
  isFromKit?: boolean;
  kitCount?: number;
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

const MilitaryBoostCells = memo(function MilitaryBoostCells({
  general,
  gbg,
  sped,
  showSigmaColumns,
  spedizioniEnabled,
  uiLang,
}: {
  general: number[];
  gbg: number[];
  sped: number[];
  showSigmaColumns: boolean;
  spedizioniEnabled: boolean;
  uiLang?: UiLang;
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
      {!showSigmaColumns && <Boost4 values={general as [number, number, number, number]} uiLang={uiLang} />}
      <Boost4 values={sigmaGbg} uiLang={uiLang} />
      {spedizioniEnabled && <Boost4 values={sigmaSped} uiLang={uiLang} />}
    </>
  );
});

/** Props di una singola riga BuildingRow. I valori derivati da Map/Set dello
 *  stato di App (isSelected, isHighlighted, disconnectedCount, ecc.) sono
 *  già "risolti" per questo specifico edificio dal genitore: questo evita di
 *  passare intere Map/Set come prop (che cambierebbero identità ad ogni
 *  render e vanificherebbero la memo) mantenendo lo stesso identico
 *  comportamento di lookup che la riga aveva prima dell'estrazione. */
interface BuildingRowProps {
  b: ProcessedBuilding;
  activeTab: TabType;
  uiLang: UiLang;
  gameLang: Lang;
  currentEraId: number;
  currentFilters: TabFilters;
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
  isDeclassable: boolean;
  allySlots: Array<{ filled: boolean; allyDisplayName?: string }> | undefined;
  declassablePopData: { popCurr: number; popBronze: number; statsBronze: EraStats } | undefined;
  setDeclassableTooltip: (v: { x: number; y: number; eraAge: string; diffs: EraDiffEntry[]; popSavings: number; oneDownKit: number; oneDownKitName?: string; reversionKit: number; reversionKitName?: string } | null) => void;
  minLevel: number;
  allLevelsForEntity: number[] | undefined;
  instanceEraStats: Array<[string, number, EraStats]>;
  fragmentProducers: string[];
  fragmentSelectionKits: string[];
  handleCityRowClick: (building: ProcessedBuilding) => void;
  toggleSelect: (id: string) => void;
  getPropDisplay: (b: Building, lang: UiLang) => string;
  setImagePopup: (v: { x: number; y: number; url: string; name: string; id?: string; subtitle?: string } | null) => void;
  scheduleImagePopupClose: () => void;
  setUpgradeTooltip: (v: { x: number; y: number; targets: string[]; kits: Array<{ name: string; count: number }> } | null) => void;
  setOutdatedTooltip: (v: { x: number; y: number; minLevel: number; allLevels: number[]; currentEraId: number; oneUpKit: number; renovationKit: number; oneUpKitName?: string; renovationKitName?: string; isUpgradable: boolean; upgradableTargets: string[]; upgradableKits: Array<{ name: string; count: number }>; eraComparisons: Array<{ eraId: number; eraName: string; count: number; diffs: EraDiffEntry[]; goodsInvolved: boolean }> } | null) => void;
  setFragmentTooltip: (v: { x: number; y: number; producers: string[]; selectionKits: string[] } | null) => void;
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
  b, activeTab, uiLang, gameLang, currentEraId, currentFilters, showSigmaColumns, spedizioniEnabled,
  showPopColumn, showFelColumn, showIqProdColumns, showProdColumns,
  specialKits, DIFF_FIELDS, isSelected, isHighlighted, disconnectedCount, needlessCount, importedCount,
  greatBuildingInfo, gameDisplayName, upgradeBadge, isOutdated, isDeclassable, allySlots, declassablePopData, setDeclassableTooltip, minLevel, allLevelsForEntity,
  instanceEraStats, fragmentProducers, fragmentSelectionKits,
  handleCityRowClick, toggleSelect, getPropDisplay,
  setImagePopup, scheduleImagePopupClose, setUpgradeTooltip, setOutdatedTooltip, setFragmentTooltip, setFabTooltip,
}: BuildingRowProps) {
  return (
    <tr
      key={b.id}
      onClick={() => handleCityRowClick(b)}
      className={`${
        activeTab === "propria_citta" && isHighlighted && !b.isFallback
          ? "outline outline-1 outline-amber-400 bg-amber-500/10 relative z-10"
          : (() => {
              const cat = b.isGreatBuilding ? "great"
                : b.isMilitary ? "military"
                : b.isGoods ? "goods"
                : b.isInactive ? "inactive"
                : b.isFallback ? "fallback"
                : "normal";
              const disconnected = activeTab === "propria_citta" && (disconnectedCount) > 0;
              const notInCsv = b.cityEntityId && !CSV_ENTITY_IDS_SET.has(b.cityEntityId);
              return BUILDING_ROW_COLORS[cat]
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
      <td className="cell-checkbox">
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleSelect(b.id)}
          aria-label={t("selectBuildingLabel", uiLang, b.name)}
          className="accent-amber-500 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-slate-900 focus:ring-offset-slate-950 cursor-pointer h-3 w-3 relative -top-[-1px]"
        />
      </td>
      <td>
        {(() => {
          const isGameTab = activeTab === "propria_citta" || activeTab === "inventario";
          // La wiki FoE ha un sottodominio per ogni lingua del gioco: la
          // lingua corrente si usa direttamente, nessun collasso necessario.
          const wikiLang: Lang = isGameTab ? gameLang : uiLang;
          const showWikiLink = isGameTab || ITALIAN_NAMES.has(b.cityEntityId);
          const displayedName = isGameTab
            ? (gameDisplayName ?? b.name)
            : displayName(b.cityEntityId, b.name, uiLang);
          if (!showWikiLink) return null;
          const imgUrl = getImageUrl(b.cityEntityId, b.hash);
          return (
            <a
              href={BuildingModel.wikiUrl(displayedName, wikiLang)}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) => {
                if (!imgUrl) return;
                const r = e.currentTarget.getBoundingClientRect();
                setImagePopup({ x: r.right, y: r.top, url: imgUrl, name: displayedName, id: b.cityEntityId });
              }}
              onMouseLeave={scheduleImagePopupClose}
              title={t("viewOnWikiTitle", uiLang, displayedName, wikiLang.toUpperCase())}
              className="inline-flex items-center justify-center text-[13px] leading-none hover:scale-125 transition-transform"
            >
              👁️
            </a>
          );
        })()}
      </td>
      <td className={`cell-name ${b.isGreatBuilding ? "text-slate-100" : ""}`}>
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
                <span className={hasIt ? "font-bold" : "font-bold italic"}>
                  {displayNameText}
                </span>
                {(() => {
                  const gb = greatBuildingInfo;
                  return gb ? <span className="font-normal text-slate-400"> - Lv. {gb.level}/{gb.maxLevel}</span> : null;
                })()}
              </>
            );
          }
          if (b.isInactive) {
            return (
              <span className={hasIt ? "font-bold text-red-400" : "font-bold text-red-400 italic"}>
                {displayNameText}
              </span>
            );
          }
          const isInventarioInv = activeTab === "inventario" && (b as InventoryRowBuilding)._invBadge === "INV";
          return (
            <span className={hasIt ? (isInventarioInv ? "text-emerald-400 font-semibold" : "") : (isInventarioInv ? "text-emerald-400 font-semibold italic" : "italic")}>
              {displayNameText}
            </span>
          );
        })()}
        {b.isGreatBuilding && (
          <span className="ml-1.5 inline-block text-xs font-mono font-bold px-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/40 relative -top-[1px]">
            {t("greatBuildingBadge", uiLang)}
          </span>
        )}
        {activeTab === "inventario" && b.isUnresolved && (
          <span className="ml-1.5 inline-block text-[11px] font-mono font-bold px-1 rounded bg-red-950/60 text-red-400 border border-red-900 relative -top-[1px] cursor-help" title={t("unresolvedValuesTitle", uiLang)}>
            UNKNOWN
          </span>
        )}
        {activeTab === "propria_citta" && (() => {
          if (b.isGreatBuilding) return null;
          const count = importedCount;
          if (count <= 1) return null;
          return (
            <span className="ml-1.5 inline-block text-xs font-mono font-bold px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
              ×{count}
            </span>
          );
        })()}
        {activeTab === "propria_citta" && (() => {
          if (!b.cityEntityId) return null;
          const disconnCount = disconnectedCount;
          if (disconnCount <= 0) return null;
          return (
            <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1 rounded bg-red-950 text-red-400 border border-red-600 relative -top-[2px]" title={t("disconnectedFromRoadTitle", uiLang)}>
              {t("disconnectedFromRoadBadge", uiLang)}
            </span>
          );
        })()}
        {activeTab === "propria_citta" && (() => {
          if (b.isGreatBuilding || b.isInactive) return null;
          if (!b.cityEntityId) return null;
          if (needlessCount <= 0) return null;
          return (
            <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1 rounded bg-amber-950 text-amber-400 border border-amber-600 relative -top-[2px]" title={t("needlesslyConnectedTitle", uiLang)}>
              {t("needlesslyConnectedBadge", uiLang, needlessCount)}
            </span>
          );
        })()}
        {activeTab === "propria_citta" && (() => {
          if (b.isGreatBuilding || b.isInactive) return null;
          const badge = upgradeBadge;
          if (!badge) return null;
          return (
            <span
              className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1 rounded bg-sky-950 text-sky-300 border border-sky-700 cursor-help relative -top-[1px]"
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
        {activeTab === "propria_citta" && (() => {
          if (b.isGreatBuilding || b.isInactive || b.isMilitary || !b.cityEntityId) return null;
          if (!isOutdated) return null;
          const minLvl = minLevel;
          return (
            <span
              className="ml-2 inline-block cursor-help "
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
        {activeTab === "propria_citta" && (() => {
          if (b.isGreatBuilding || b.isInactive || b.isMilitary || !b.cityEntityId) return null;
          if (!isDeclassable) return null;
          return (
            <span
              className="ml-2 inline-block cursor-help"
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
        {activeTab === "propria_citta" && allySlots && allySlots.map((slot, i) => (
          <span
            // Le icone non hanno un id stabile proprio (sono slot posizionali
            // "pieno/vuoto" per copia, non entità con identità); l'ordine è
            // ricalcolato ad ogni render da allySlotsPerBuilding, quindi
            // l'indice di posizione è la chiave corretta qui.
            key={i}
            className="ml-1 inline-block cursor-help"
            title={slot.filled
              ? t("filledAllySlotBadgeTitle", uiLang, slot.allyDisplayName ?? "?")
              : t("emptyAllySlotBadgeTitle", uiLang)}
          >
            <img
              src={slot.filled ? allies_slot_full : allies_slot_empty}
              alt=""
              className="h-4 w-4 object-contain inline-block"
            />
          </span>
        ))}
        {(() => {
          const producers = fragmentProducers;
          const selectionKits = fragmentSelectionKits;
          if (producers.length === 0 && selectionKits.length === 0) return null;
          return (
            <span
              className="ml-1.5 inline-block text-xs cursor-help"
              title=""
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setFragmentTooltip({
                  x: r.left,
                  y: r.bottom,
                  producers: producers.map((id) => displayName(id, ITALIAN_NAMES.get(id) ?? id, uiLang)),
                  selectionKits,
                });
              }}
              onMouseLeave={() => setFragmentTooltip(null)}
            >
              🧩
            </span>
          );
        })()}
        {activeTab === "inventario" && (() => {
          const ib = b as InventoryRowBuilding;
          const badge = ib._invBadge;
          const qty = b.kitCount ?? 1;
          const kitsUsed: string[] = ib._fabKitsUsed ?? [];
          const sourceId: string | undefined = ib._fabSourceId;
          const sourceLv: number | undefined = ib._fabSourceLv;
          const choices: string[] | undefined = ib._fabChoices ?? undefined;

          // Badge quantità: mostra solo se qty > 1
          const qtyBadge = qty > 1 ? (
            <span className="ml-1.5 inline-block text-xs font-mono font-bold px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
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
                    className="ml-1.5 inline-block text-[11px] font-mono font-bold px-1 rounded bg-sky-950/60 text-sky-300 border border-sky-800 relative -top-[1px] cursor-help"
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
                    className="ml-1.5 inline-block text-[11px] font-mono font-bold px-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/40 relative -top-[1px] cursor-help"
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
      </td>
      {currentFilters.showTimeColumn && (
        <td className="section-divider">
          {(() => {
            const propDisplay = getPropDisplay(b, uiLang);
            if (!propDisplay) return null;
            return (
              <span className="badge-value badge-value-purple">
                {propDisplay}
              </span>
            );
          })()}
        </td>
      )}
      <td className={`cell-icons ${currentFilters.showTimeColumn ? "" : "section-divider"}`}>
        <div className="flex flex-col items-center justify-center gap-0.5">
          {b.ally > 0 && (
            <span title={t("historicalAllySlotTitle", uiLang)}>⭐</span>
          )}
          {isBattlegroundsPrizeId(b.cityEntityId) && (
            <span title={t("wonInGbgTitle", uiLang)}>🔰</span>
          )}
          {isQuantumIncursionsPrizeId(b.cityEntityId) && (
            <span title={t("wonInQiTitle", uiLang)}>✊🏾</span>
          )}
          {(() => {
            const info = getSettlementInfo(b.cityEntityId);
            return info ? <span title={t(info.nameKey, uiLang)}>{info.icon}</span> : null;
          })()}
        </div>
      </td>
      <td className={`cell-eff ${
        activeTab === "propria_citta" && (disconnectedCount) > 0
          ? b.isGreatBuilding
            ? "bg-[#351605]"
            : "bg-[#2d0a0a]"
          : b.isGreatBuilding
          ? "bg-[#191900]"
          : b.isInactive
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

      <MilitaryBoostCells general={b.general} gbg={b.gbg} sped={b.sped} showSigmaColumns={showSigmaColumns} spedizioniEnabled={spedizioniEnabled} uiLang={uiLang} />


      <BoostCell value={b.iq[0]} color="red" className="section-divider" uiLang={uiLang} />
      <BoostCell value={b.iq[1]} color="red" uiLang={uiLang} />
      <BoostCell value={b.iq[2]} color="blue" uiLang={uiLang} />
      <BoostCell value={b.iq[3]} color="blue" uiLang={uiLang} />
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
      {showProdColumns && (
        <>
          <StaleFieldCell value={b.mon} className={`cell-num section-divider${b.mon > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdK(b.mon)}
          </StaleFieldCell>
          <StaleFieldCell value={b.mat} className={`cell-num${b.mat > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdK(b.mat)}
          </StaleFieldCell>
          <StaleFieldCell value={b.fp} className={`cell-num${b.fp > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.fp)}
          </StaleFieldCell>
          <StaleFieldCell value={b.fpb} className={`cell-num${b.fpb > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdPercent(b.fpb)}
          </StaleFieldCell>
          <StaleFieldCell value={b.fur} className={`cell-num${b.fur > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.fur)}
          </StaleFieldCell>
          <StaleFieldCell value={b.tr} className={`cell-num${b.tr > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.tr)}
          </StaleFieldCell>
          <StaleFieldCell value={b.trne} className={`cell-num${b.trne > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.trne)}
          </StaleFieldCell>
          <StaleFieldCell value={b.beni} className={`cell-num${b.beni > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.beni)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benip} className={`cell-num${b.benip > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.benip)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benis} className={`cell-num${b.benis > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.benis)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benib} className={`cell-num${b.benib > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdPercent(b.benib)}
          </StaleFieldCell>
          <StaleFieldCell value={b.benig} className={`cell-num${b.benig > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.benig)}
          </StaleFieldCell>
          <StaleFieldCell value={b.bp} className={`cell-num${b.bp > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.bp)}
          </StaleFieldCell>
          <StaleFieldCell value={b.fsp} className={`cell-num${b.fsp > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.fsp)}
          </StaleFieldCell>
          <StaleFieldCell value={b.tpm} className={`cell-num${b.tpm > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.tpm)}
          </StaleFieldCell>
          <StaleFieldCell value={b.tpb} className={`cell-num${b.tpb > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.tpb)}
          </StaleFieldCell>
          <StaleFieldCell value={b.adm} className={`cell-num${b.adm > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.adm)}
          </StaleFieldCell>
          <StaleFieldCell value={b.mod} className={`cell-num${b.mod > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.mod)}
          </StaleFieldCell>
          <StaleFieldCell value={b.rin} className={`cell-num${b.rin > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.rin)}
          </StaleFieldCell>
          <StaleFieldCell value={b.imm} className={`cell-num${b.imm > 0 ? " cell-prod" : ""}`} uiLang={uiLang}>
            {b.isFallback ? <span className="font-bold text-slate-400">?</span> : formatProdNum(b.imm)}
          </StaleFieldCell>
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
  | "mon" | "mat" | "fp" | "fpb" | "fur" | "tr" | "trne" | "beni" | "benip" | "benis" | "benib" | "benig" | "bp" | "fsp" | "tpm" | "tpb" | "adm" | "mod" | "rin" | "imm";
type SortCriterion = { key: SortKey; order: "asc" | "desc" };

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
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    getActiveProfileId(loadProfiles())
  );
  const [renamingProfileId, setRenamingProfileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Export/Import Sessione ──────────────────────────────────────────────
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
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
    setCityEntityNeedlessCount(reviveMap<number>(city?.cityEntityNeedlessCount));
    setCityMapBuildings(Array.isArray(city?.cityMapBuildings) ? city.cityMapBuildings : []);
    setCityMapBounds(city?.cityMapBounds ?? null);
    setCityMapGrid(reviveSet(city?.cityMapGrid));
    setCityMapUnlockedCells(reviveSet(city?.cityMapUnlockedCells));
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
    {
      const raw = city?.declassableBuildings;
      try {
        if (!Array.isArray(raw) || raw.length === 0) { setDeclassableBuildings(new Map()); }
        else {
          const first = (raw[0] as [string, unknown]);
          if (!first || typeof first[1] !== "object" || Array.isArray(first[1]) || first[1] === null)
            setDeclassableBuildings(new Map());
          else
            setDeclassableBuildings(reviveMap<{ popCurr: number; popBronze: number; statsBronze: EraStats }>(raw));
        }
      } catch { setDeclassableBuildings(new Map()); }
    }
    const rawIES = city?.entityInstanceEraStats ?? [];
    setEntityInstanceEraStats(new Map(rawIES.map(([k, v]: [string, Array<[string, number, EraStats]>]) => [k, v])));
    setGameNames(reviveMap<string>(city?.gameNames));
    setGameLang(city?.gameLang === "it" || city?.gameLang === "en" ? city.gameLang : "it");
    setPortraitUrl(typeof city?.portraitUrl === "string" ? city.portraitUrl : "");
    setInventoryMatched(reviveMap<InventoryEntry>(inv?.inventoryMatched));
    setInventoryUnmatched(reviveMap<InventoryEntry>(inv?.inventoryUnmatched));
    setInventorySelectionKits(reviveMap<SelectionKitEntry>(inv?.inventorySelectionKits));
    setInventoryUpgradeKits(reviveMap<UpgradeKitEntry>(inv?.inventoryUpgradeKits));
    setSpecialKits(inv?.specialKits ?? { oneUpKit: 0, oneDownKit: 0, reversionKit: 0, renovationKit: 0, storeBuilding: 0, rushEventBuildings: 0, rushMassSupplies: 0, rushGoodsBuildings: 0, massSelfAidKit: 0 });
    setImportedAllies(Array.isArray(allies) ? allies : []);
    setSelectedIds(new Set());
    setSelectedJsonEntry(null);
    bumpStorage();
  };

  const switchProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
    loadProfileData(profileId);
  };

  const deleteProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    const name = profile?.name ?? t("genericProfileFallback", uiLang);
    if (!confirm(t("confirmDeleteProfile", uiLang, name))) {
      return;
    }
    const updated = profiles.filter(p => p.id !== profileId);
    writeStoredJson(PROFILES_KEY, updated);
    clearStoredJson(profileStorageKey(profileId, "city"));
    clearStoredJson(profileStorageKey(profileId, "inventory"));
    clearStoredJson(profileStorageKey(profileId, "allies"));
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
    setRenamingProfileId(null);
    setRenameValue("");
  };

  const commitRename = (profileId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) { setRenamingProfileId(null); return; }
    const updated = profiles.map(p => p.id === profileId ? { ...p, name: trimmed } : p);
    setProfiles(updated);
    writeStoredJson(PROFILES_KEY, updated);
    setRenamingProfileId(null);
  };

  const [activeTab, setActiveTab] = useState<"database" | "alleati" | "propria_citta" | "inventario">("database");
  const buildingTableWrapperRef = useRef<HTMLDivElement | null>(null);
  const buildingTableScrollRef = useRef<HTMLDivElement | null>(null);
  const buildingTableFloatingScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingBuildingTableScroll = useRef(false);
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
  const [cityEntityNeedlessCount, setCityEntityNeedlessCount] = useState<Map<string, number>>(() => reviveMap<number>(getInitCity()?.cityEntityNeedlessCount));

  const [cityMapBuildings, setCityMapBuildings] = useState<CityMapBuilding[]>(() => { const s = getInitCity(); return Array.isArray(s?.cityMapBuildings) ? s.cityMapBuildings : []; });
  const [cityMapBounds, setCityMapBounds] = useState<CityMapBounds | null>(() => getInitCity()?.cityMapBounds ?? null);
  const [cityMapGrid, setCityMapGrid] = useState<Set<string>>(() => reviveSet(getInitCity()?.cityMapGrid));
  const [cityMapUnlockedCells, setCityMapUnlockedCells] = useState<Set<string>>(() => reviveSet(getInitCity()?.cityMapUnlockedCells));
  const [showCityMap, setShowCityMap] = useState<boolean>(() => localStorage.getItem(SHOW_CITY_MAP_KEY) === "true");
  // Filtra gli edifici vecchi nella tab Città
  const [showOnlyOutdated, setShowOnlyOutdated] = useState(false);
  // Filtra gli edifici declassabili all'Era del Bronzo nella tab Città
  const [showOnlyDeclassable, setShowOnlyDeclassable] = useState(false);
  const [showOnlyWithAllySlot, setShowOnlyWithAllySlot] = useState(false);
  // Filtra nella tab Inventario: mostra solo gli edifici fisicamente già in inventario
  const [showOnlyReadyBuildings, setShowOnlyReadyBuildings] = useState(false);
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
  const [declassableBuildings, setDeclassableBuildings] = useState<Map<string, { popCurr: number; popBronze: number; statsBronze: EraStats }>>(() => {
    const raw = getInitCity()?.declassableBuildings;
    try {
      if (!Array.isArray(raw) || raw.length === 0) return new Map();
      const first = (raw[0] as [string, unknown]);
      if (!first || typeof first[1] !== "object" || Array.isArray(first[1]) || first[1] === null) return new Map();
      return reviveMap<{ popCurr: number; popBronze: number; statsBronze: EraStats }>(raw);
    } catch { return new Map(); }
  });
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
  const [portraitUrl, setPortraitUrl] = useState<string>(() => getInitCity()?.portraitUrl ?? "");
  const [selectedJsonEntry, setSelectedJsonEntry] = useState<DebugJsonEntry | null>(null);
  const [upgradeTooltip, setUpgradeTooltip] = useState<{ x: number; y: number; targets: string[]; kits: Array<{ name: string; count: number }> } | null>(null);
  // Popup anteprima immagine edificio: posizione + url + nome (alt/titolo).
  // Attivato dall'hover su 👁️ in tabella e dall'hover sugli edifici in
  // mappa città; scompare all'uscita del mouse in entrambi i casi.
  const [imagePopup, setImagePopupRaw] = useState<{ x: number; y: number; url: string; name: string; id?: string; subtitle?: string } | null>(null);
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
  const setImagePopup = useCallback((v: { x: number; y: number; url: string; name: string; id?: string; subtitle?: string } | null | ((prev: typeof imagePopup) => typeof imagePopup)) => {
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
  const [fragmentTooltip, setFragmentTooltip] = useState<{ x: number; y: number; producers: string[]; selectionKits: string[] } | null>(null);
  const [kitProducersTooltip, setKitProducersTooltip] = useState<{ x: number; y: number; producers: Array<{ id: string; name: string }> } | null>(null);
  const [fabTooltip, setFabTooltip] = useState<{ x: number; y: number; kitsUsed: string[]; sourceId?: string; sourceLv?: number; choices?: string[] } | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isInventoryDebugOpen, setIsInventoryDebugOpen] = useState(false);
  const [isEfficiencyHelpOpen, setIsEfficiencyHelpOpen] = useState(false);
  const [isProfileHelpOpen, setIsProfileHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isProdSummaryOpen, setIsProdSummaryOpen] = useState(false);
  const [isCityUpgradeableOpen, setIsCityUpgradeableOpen] = useState(false);
  const [isOutdatedModalOpen, setIsOutdatedModalOpen] = useState(false);

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

  const totalCityEntityInstances = useMemo(() => {
    let total = 0;
    cityEntityIds.forEach((count) => { total += count; });
    return total;
  }, [cityEntityIds]);

  const totalInventoryInstances = useMemo(() => {
    let total = 0;
    inventoryMatched.forEach((e) => { total += e.inStock; });
    inventoryUnmatched.forEach((e) => { total += e.inStock; });
    return total;
  }, [inventoryMatched, inventoryUnmatched]);

  // csvCityEntityIds was a useMemo but buildings === BUILDINGS_FROM_CSV (stable module constant)
  // so CSV_ENTITY_IDS and CSV_ENTITY_IDS_SET are pre-computed at module level instead.

  const matchedCityEntityIds = useMemo(() => {
    return Array.from(cityEntityIds.keys()).filter((id) =>
      CSV_ENTITY_IDS_SET.has(id) && !isGreatBuildingId(id)
    );
  }, [cityEntityIds]);

  const unmatchedCityEntityIds = useMemo(() => {
    return Array.from(cityEntityIds.keys()).filter((id) =>
      !CSV_ENTITY_IDS_SET.has(id) &&
      !isGreatBuildingId(id)
    );
  }, [cityEntityIds]);

  const greatBuildingIds = useMemo(() => {
    return Array.from(greatBuildingsJson.keys());
  }, [greatBuildingsJson]);

  const downloadDebugList = (title: string, entries: Array<{ id: string; name: string; count: number }>) => {
    if (entries.length === 0) return;
    const csvContent = "\uFEFFCityEntityID;name;num\n" + 
      entries.map(e => `${e.id};${e.name};${e.count}`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = title === "city"
      ? "city.csv"
      : title === "inventory" || title === "all-inventory"
        ? "inventory.csv"
        : `${title}-list.csv`;
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
      const date = new Date().toISOString().slice(0, 10);
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

        const { ok, failedKeys, mergedProfiles } = mergeImportedProfiles(sessionData.storage);
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
      const needlessRoadKeys = new Set<string>();
      const needlessCountByEntity = new Map<string, number>();

      // preloadedData è già validato da validateBookmarkletData(): il cast è sicuro.
      const cityEntities: Record<string, CityEntityDefinition> = preloadedData.CityEntities;

      // Rilevamento lingua del gioco: guarda il nome del municipio in CityEntities.
      const townhallEntityId = currentEra ? `H_${currentEra}_Townhall` : null;
      if (townhallEntityId && cityEntities[townhallEntityId]?.name) {
        const thName = String(cityEntities[townhallEntityId].name).toLowerCase();
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
        if (entry.x == null || entry.y == null) continue;
        const entityId = entry.cityentity_id ? String(entry.cityentity_id) : null;
        if (!entityId) continue;
        const [w, l] = getEntitySize(entityId);
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < l; dy++) {
            grid.set(`${Number(entry.x) + dx},${Number(entry.y) + dy}`, String(entry.type ?? ""));
          }
        }
      }

      for (const key in cityMap) {
        const entry = cityMap[key];
        if (!entry || typeof entry !== "object") continue;
        if (entry.x == null || entry.y == null) continue;
        const entityId = entry.cityentity_id ? String(entry.cityentity_id) : null;
        if (!entityId) continue;
        const entity = cityEntities?.[entityId] ?? {};
        // Skip edifici che richiedono strada: il check "needless road" vale solo per quelli che NON la richiedono.
        if (!entity?.components || BuildingModel.requiresRoad(entity)) continue;
        const [w, l] = getEntitySize(entityId);
        let touchesStreet = false;
        for (let dx = 0; dx < w && !touchesStreet; dx++) {
          for (let dy = 0; dy < l && !touchesStreet; dy++) {
            const x = Number(entry.x) + dx;
            const y = Number(entry.y) + dy;
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

        const isConnected = Number(entry.connected ?? 0) >= 1;
        const isMissingFromCsv = !CSV_ENTITY_IDS_SET.has(id);

        if (!isMissingFromCsv && !matched.has(id)) {
          matched.set(id, entry);
        }

        // L'edificio richiede strada se lo dice CityEntities (logica unificata con il fallback)
        const cityEntityForId = cityEntities?.[id];
        const needsRoad = BuildingModel.requiresRoad(cityEntityForId);

        if (needsRoad && !isConnected) {
          disconnected.set(id, (disconnected.get(id) ?? 0) + 1);
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
          gbs.set(id, { entityId: id, name: "", level, maxLevel, width: w, length: l, rawEntry: entry });
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
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < l; dy++) {
            occupiedCells.add(`${x + dx},${y + dy}`);
          }
        }
        bMinX = Math.min(bMinX, x); bMinY = Math.min(bMinY, y);
        bMaxX = Math.max(bMaxX, x + w); bMaxY = Math.max(bMaxY, y + l);
        mapBuildings.push({ entityId, mapEntityId: key, name: entityName, x, y, w, h: l, type: entryType, isGreatBuilding: isGE, isMilitary, isNeedlessRoad: isNeedless, isInactive: isInactiveBuilding, isSuppliesProducer });
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

      setCityEntityIds(ids);
      setCityEntityDisconnected(disconnected);
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
      setPortraitUrl(typeof preloadedData.portraitUrl === "string" ? preloadedData.portraitUrl : "");
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

      // ── declassableBuildings ─────────────────────────────────────────────
      // Edifici in città con pop negativa in entrambe le ere (corrente e
      // BronzeAge) ma con statistiche militari invariate tra le due ere:
      // declassarli al'Era del Bronzo fa risparmiare popolazione senza perdere boost.
      const declassableMap = new Map<string, { popCurr: number; popBronze: number; statsBronze: EraStats }>();
      for (const [entityId] of ids) {
        if (isMilitaryBuildingId(entityId)) continue;
        const entityDef = cityEntities[entityId];
        if (!entityDef) continue;
        const statsCurr = eraStatsMap.get(entityId) ?? BuildingModel.extractEraStats(entityDef, currentEra || FALLBACK_ERA);
        const statsBronze = BuildingModel.extractEraStats(entityDef, "BronzeAge");
        const popCurr = statsCurr.pop;
        const popBronze = statsBronze.pop;
        if (!(popCurr < 0 && popBronze < 0 && popCurr !== popBronze)) continue;
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
        cityEntityNeedlessCount: Array.from(needlessCountByEntity.entries()),
        cityMapBuildings: mapBuildings,
        cityMapBounds: nextCityMapBounds,
        cityMapGrid: Array.from(occupiedCells),
        cityMapUnlockedCells: Array.from(unlockedCells),
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
        portraitUrl: typeof preloadedData.portraitUrl === "string" ? preloadedData.portraitUrl : undefined,
        bookmarkletVersion: typeof preloadedData._v === "number" ? preloadedData._v : 0,
      });
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
  const handleImportAll = async (parsed: BookmarkletData, targetProfileId?: string) => {
    const pid = targetProfileId ?? activeProfileId;
    const inventoryKey = profileStorageKey(pid, "inventory");
    const alliesKey = profileStorageKey(pid, "allies");

    // ── Fase Città: UnlockedAreas + CityEntities + CityMapData ──────────────
    // handleImportCityMap processa i 3 blocchi insieme (sono interdipendenti)
    await handleImportCityMap(parsed, pid);

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
    });
    setIsInventoryDebugOpen(false);

    // Estrai i frammenti di alleati che sono dentro l'inventario (richiede inventory già parsato)
    const allyFragments = Allies.parseAllyFragments(items, RARITY_FROM_GAME);
    allImportedAllies.push(...allyFragments);

    // Aggiorna sempre, anche con array vuoto: se si re-importa un account senza
    // alleati né frammenti, i dati del vecchio import devono sparire da UI e
    // storage (coerente con come si comportano città e inventario qui sopra).
    setImportedAllies(allImportedAllies);
    writeStoredJson(alliesKey, allImportedAllies);

    bumpStorage();
  };

  const [generalDefense, setGeneralDefense] = useState<0.8 | 1.0>(() => {
    const saved = localStorage.getItem(DEFENSE_KEY);
    return (saved === "1" ? 1.0 : saved === "0.8" ? 0.8 : 0.8) as 0.8 | 1.0;
  });
  const [spedizioniEnabled, setSpedizioniEnabled] = useState<boolean>(() => {
    return localStorage.getItem(SPED_ENABLED_KEY) === "true";
  });
  const [spedizioniAttack, setSpedizioniAttack] = useState<number>(() => {
    const saved = localStorage.getItem(SPED_ATTACK_KEY);
    if (!saved) return 0.2;
    const val = parseFloat(saved);
    return !isNaN(val) && val >= 0 && val <= 1 ? val : 0.2;
  });
  // Pulsante Σ: somma General+Campi (e General+Spedizioni se abilitate)
  const [showSigmaColumns, setShowSigmaColumns] = useState<boolean>(() => localStorage.getItem(SIGMA_KEY) === "true");
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
  const [showProdColumns, setShowProdColumns] = useState<boolean>(() => localStorage.getItem(PROD_COLUMNS_KEY) === "true");
  // Vista database tab Info: false = LIGHT (solo edifici principali Lin=1,
  // default), true = FULL (tutti, inclusi livelli intermedi/varianti).
  const [dbViewFull, setDbViewFull] = useState<boolean>(() => localStorage.getItem(DB_VIEW_KEY) === "full");
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
    showOnlyFilter: "all",
    showEventFilter: "",
    showIncursionBuildings: true,
    showAllyBuildings: true,
    showMassAidBuildings: true,
    showStoreBuildingBuildings: true,
    showGreatBuildings: true,
    showLimitedAscended: true,
    showTimeColumn: true,
    prodFilter: new Set(),
    prodFilterMode: "OR",
    minEff: "",
  };

  const [tabFilters, setTabFilters] = useState<Record<TabType, TabFilters>>({
    database: { ...DEFAULT_FILTERS },
    alleati: { ...DEFAULT_FILTERS },
    propria_citta: { ...DEFAULT_FILTERS },
    inventario: { ...DEFAULT_FILTERS },
  });

  const currentFilters = tabFilters[activeTab];
  const currentEventFilter: EventEntry | null = useMemo(
    () => currentFilters.showEventFilter
      ? EVENTS_LIST.find((event) => event.id === currentFilters.showEventFilter) ?? null
      : null,
    [currentFilters.showEventFilter],
  );

  const updateFilter = <K extends keyof TabFilters>(key: K, value: TabFilters[K]) => {
    // ⏱ è globale: si sincronizza su tutte le tab contemporaneamente.
    // 📦 (showProdColumns) è ora un useState globale indipendente (vedi
    // sopra), non passa più da qui.
    if (key === "showTimeColumn") {
      setTabFilters(prev => ({
        database:      { ...prev.database,      [key]: value },
        alleati:       { ...prev.alleati,        [key]: value },
        propria_citta: { ...prev.propria_citta,  [key]: value },
        inventario:    { ...prev.inventario,     [key]: value },
      }));
      return;
    }
    setTabFilters(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [key]: value
      }
    }));
  };

  const toggleProdFilter = (key: string) => {
    setTabFilters(prev => {
      const current = new Set(prev[activeTab].prodFilter);
      if (current.has(key)) current.delete(key); else current.add(key);
      return { ...prev, [activeTab]: { ...prev[activeTab], prodFilter: current } };
    });
  };

  const resetFilters = () => {
    setTabFilters({
      database: { ...DEFAULT_FILTERS, prodFilter: new Set() },
      alleati: { ...DEFAULT_FILTERS, prodFilter: new Set() },
      propria_citta: { ...DEFAULT_FILTERS, prodFilter: new Set() },
      inventario: { ...DEFAULT_FILTERS, prodFilter: new Set() },
    });
    setAllyRarityFilters({
      1: true, 2: true, 3: true, 4: true, 5: true,
    });
    setSortCriteria([{ key: "eff", order: "desc" }]);
    setManualSortTabs({
      database: false,
      alleati: false,
      propria_citta: false,
      inventario: false,
    });
    setSearchTerm("");
  };



  const getPropDisplay = (b: Building, lang: UiLang): string => {
    if (b.time > 0) return `${b.time}${t("daySuffix", lang)}`;
    return "";
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
  const [globalAllyLevel, setGlobalAllyLevel] = useState<number>(100);

  // Alleati importati dal gioco
  const [importedAllies, setImportedAllies] = useState<Allies.ImportedAlly[]>(() => { const s = getInitAllies(); return Array.isArray(s) ? s as Allies.ImportedAlly[] : []; });

  const [allyRarityFilters, setAllyRarityFilters] = useState<Record<number, boolean>>({
    1: true, 2: true, 3: true, 4: true, 5: true,
  });
  const [showOnlyOwnedAllies, setShowOnlyOwnedAllies] = useState(false);
  const [isMyAlliesTableOpen, setIsMyAlliesTableOpen] = useState(true);
  const toggleRarityFilter = (rarity: number) => {
    setAllyRarityFilters((prev) => {
      // L'utente può nascondere anche tutte le rarità (tabella vuota): è una
      // scelta legittima, non la blocchiamo.
      return { ...prev, [rarity]: !prev[rarity] };
    });
  };

  const ownedAllyLookup = useMemo(() => {
    const set = new Set<string>();
    importedAllies.forEach((ally) => {
      set.add(`${ally.allyId}__${ally.rarity}`);
    });
    return set;
  }, [importedAllies]);


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

    for (const b of BUILDINGS_FROM_CSV) {
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
  }, [cityEntityIds, cityMapBuildings, importedAllies, gameLang]);

  const unplacedAllyLookup = useMemo(() => {
    const set = new Set<string>();
    importedAllies.forEach((ally) => {
      // Priorità: solo non posizionati NON frammentati
      if (!ally.isPlaced && !ally.isFragment) set.add(`${ally.allyId}__${ally.rarity}`);
    });
    return set;
  }, [importedAllies]);

  const fragmentAllyLookup = useMemo(() => {
    const set = new Set<string>();
    const countMap = new Map<string, number>();
    importedAllies.forEach((ally) => {
      if (ally.isFragment) {
        const key = `${ally.allyId}__${ally.rarity}`;
        set.add(key);
        countMap.set(key, (countMap.get(key) ?? 0) + ally.fragmentCount);
      }
    });
    return { set, countMap };
  }, [importedAllies]);

  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([
    { key: "eff", order: "desc" },
  ]);
  const [manualSortTabs, setManualSortTabs] = useState<Record<TabType, boolean>>({
    database: false,
    alleati: false,
    propria_citta: false,
    inventario: false,
  });
  const sortBy = sortCriteria[0]?.key ?? "eff";
  const sortOrder = sortCriteria[0]?.order ?? "desc";

  const handleSort = (key: SortKey) => {
    setManualSortTabs((previous) => ({ ...previous, [activeTab]: true }));
    setSortCriteria((previous) => {
      const existingIndex = previous.findIndex((criterion) => criterion.key === key);

      if (existingIndex === 0) {
        const current = previous[0];
        return [
          { key, order: current.order === "desc" ? "asc" : "desc" },
          ...previous.slice(1),
        ];
      }

      const previousOrder = existingIndex > -1 ? previous[existingIndex].order : "desc";
      const remaining = previous.filter((criterion) => criterion.key !== key);
      return [{ key, order: previousOrder }, ...remaining];
    });
  };

  // Riga dei titoli di gruppo (⚔️ Generali / 🔰 Campi / ⚡ Spedizioni) sopra le
  // colonne icona: stesso blocco identico nelle 3 tabelle, un livello sopra
  // renderMilitaryHeaders. Anche questo legge solo state già in scope.
  const renderMilitaryGroupHeaders = () => (
    <>
      {!showSigmaColumns && <th className="py-2 px-2 text-center section-divider text-amber-400/80" colSpan={4}>{t("groupGenerals", uiLang)}</th>}
      <th className="py-2 px-2 text-center section-divider text-emerald-400/80" colSpan={4}>{showSigmaColumns ? t("groupGenPlusGbg", uiLang) : t("groupGbg", uiLang)}</th>
      {spedizioniEnabled && <th className="py-2 px-2 text-center section-divider text-violet-400/80" colSpan={4}>{showSigmaColumns ? t("groupGenPlusGe", uiLang) : t("groupGe", uiLang)}</th>}
    </>
  );

  // Header delle colonne Generale/Campi/Spedizioni: identico nelle 3 tabelle
  // (edifici, alleati posseduti, database alleati). Dipende solo da state già
  // nello scope di App (sortBy/sortOrder/showSigmaColumns/spedizioniEnabled),
  // quindi è una funzione interna senza props — non un componente a parte.
  const renderMilitaryHeaders = () => (
    <>
      {!showSigmaColumns && (
        <>
          <SortableHeader label={<TableHeaderIcon src={iconGenAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGeneral", uiLang))} />} sortKey="gen_atk_a" onClick={() => handleSort("gen_atk_a")} active={sortBy === "gen_atk_a"} order={sortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGeneral", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconGenDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGeneral", uiLang))} />} sortKey="gen_def_a" onClick={() => handleSort("gen_def_a")} active={sortBy === "gen_def_a"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGeneral", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconGenAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGeneral", uiLang))} />} sortKey="gen_atk_d" onClick={() => handleSort("gen_atk_d")} active={sortBy === "gen_atk_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGeneral", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconGenDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGeneral", uiLang))} />} sortKey="gen_def_d" onClick={() => handleSort("gen_def_d")} active={sortBy === "gen_def_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGeneral", uiLang))} />
        </>
      )}

      {showSigmaColumns ? (
        <>
          {/* Σ Gen + Campi/GBG: icone Campi (rosse/blu) */}
          <SortableHeader label={<TableHeaderIcon src={iconCampiAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGenPlusGbg", uiLang), true)} />} sortKey="sig_gen_campi_atk_a" onClick={() => handleSort("sig_gen_campi_atk_a")} active={sortBy === "sig_gen_campi_atk_a"} order={sortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGenPlusGbg", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGenPlusGbg", uiLang), true)} />} sortKey="sig_gen_campi_def_a" onClick={() => handleSort("sig_gen_campi_def_a")} active={sortBy === "sig_gen_campi_def_a"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGenPlusGbg", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGenPlusGbg", uiLang), true)} />} sortKey="sig_gen_campi_atk_d" onClick={() => handleSort("sig_gen_campi_atk_d")} active={sortBy === "sig_gen_campi_atk_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGenPlusGbg", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGenPlusGbg", uiLang), true)} />} sortKey="sig_gen_campi_def_d" onClick={() => handleSort("sig_gen_campi_def_d")} active={sortBy === "sig_gen_campi_def_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGenPlusGbg", uiLang), true)} />
        </>
      ) : (
        <>
          <SortableHeader label={<TableHeaderIcon src={iconCampiAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGbg", uiLang))} />} sortKey="gbg_atk_a" onClick={() => handleSort("gbg_atk_a")} active={sortBy === "gbg_atk_a"} order={sortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGbg", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGbg", uiLang))} />} sortKey="gbg_def_a" onClick={() => handleSort("gbg_def_a")} active={sortBy === "gbg_def_a"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGbg", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGbg", uiLang))} />} sortKey="gbg_atk_d" onClick={() => handleSort("gbg_atk_d")} active={sortBy === "gbg_atk_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGbg", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconCampiDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGbg", uiLang))} />} sortKey="gbg_def_d" onClick={() => handleSort("gbg_def_d")} active={sortBy === "gbg_def_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGbg", uiLang))} />
        </>
      )}

      {spedizioniEnabled && !showSigmaColumns && (
        <>
          <SortableHeader label={<TableHeaderIcon src={iconSpedAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGe", uiLang))} />} sortKey="sped_atk_a" onClick={() => handleSort("sped_atk_a")} active={sortBy === "sped_atk_a"} order={sortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", `${t("sectionGe", uiLang)} A`)} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGe", uiLang))} />} sortKey="sped_def_a" onClick={() => handleSort("sped_def_a")} active={sortBy === "sped_def_a"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGe", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGe", uiLang))} />} sortKey="sped_atk_d" onClick={() => handleSort("sped_atk_d")} active={sortBy === "sped_atk_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGe", uiLang))} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedDefD} alt={boostTitle(uiLang, "def", "red", t("sectionGe", uiLang))} />} sortKey="sped_def_d" onClick={() => handleSort("sped_def_d")} active={sortBy === "sped_def_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGe", uiLang))} />
        </>
      )}
      {spedizioniEnabled && showSigmaColumns && (
        <>
          {/* Σ Gen + Sped/GE: icone Spedizioni (rosse/blu) */}
          <SortableHeader label={<TableHeaderIcon src={iconSpedAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionGenPlusGe", uiLang), true)} />} sortKey="sig_gen_sped_atk_a" onClick={() => handleSort("sig_gen_sped_atk_a")} active={sortBy === "sig_gen_sped_atk_a"} order={sortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionGenPlusGe", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedDefA} alt={boostTitle(uiLang, "def", "red", t("sectionGenPlusGe", uiLang), true)} />} sortKey="sig_gen_sped_def_a" onClick={() => handleSort("sig_gen_sped_def_a")} active={sortBy === "sig_gen_sped_def_a"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionGenPlusGe", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionGenPlusGe", uiLang), true)} />} sortKey="sig_gen_sped_atk_d" onClick={() => handleSort("sig_gen_sped_atk_d")} active={sortBy === "sig_gen_sped_atk_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionGenPlusGe", uiLang), true)} />
          <SortableHeader label={<TableHeaderIcon src={iconSpedDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionGenPlusGe", uiLang), true)} />} sortKey="sig_gen_sped_def_d" onClick={() => handleSort("sig_gen_sped_def_d")} active={sortBy === "sig_gen_sped_def_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionGenPlusGe", uiLang), true)} />
        </>
      )}
    </>
  );

  const getSortValue = (b: Building & { currentEff: number }, key: SortKey): number | string => {
    switch (key) {
      case "name": return b.name;
      case "size": return b.area;
      case "road": return b.road;
      case "pop": return b.pop;
      case "fel": return b.fel;
      case "eff": return b.currentEff;
      case "ally_level": return 0;
      case "gen_atk_a": return b.general[0];
      case "gen_def_a": return b.general[1];
      case "gen_atk_d": return b.general[2];
      case "gen_def_d": return b.general[3];
      case "gbg_atk_a": return b.gbg[0];
      case "gbg_def_a": return b.gbg[1];
      case "gbg_atk_d": return b.gbg[2];
      case "gbg_def_d": return b.gbg[3];
      case "sped_atk_a": return b.sped[0];
      case "sped_def_a": return b.sped[1];
      case "sped_atk_d": return b.sped[2];
      case "sped_def_d": return b.sped[3];
      case "sig_gen_campi_atk_a": return b.general[0] + b.gbg[0];
      case "sig_gen_campi_def_a": return b.general[1] + b.gbg[1];
      case "sig_gen_campi_atk_d": return b.general[2] + b.gbg[2];
      case "sig_gen_campi_def_d": return b.general[3] + b.gbg[3];
      case "sig_gen_sped_atk_a": return b.general[0] + b.sped[0];
      case "sig_gen_sped_def_a": return b.general[1] + b.sped[1];
      case "sig_gen_sped_atk_d": return b.general[2] + b.sped[2];
      case "sig_gen_sped_def_d": return b.general[3] + b.sped[3];
      case "iq_mon_b": return b.iqMonB;
      case "iq_mat_b": return b.iqMatB;
      case "iq_mon": return b.iqMon;
      case "iq_mat": return b.iqMat;
      case "iq_atk_a": return b.iq[0];
      case "iq_def_a": return b.iq[1];
      case "iq_atk_d": return b.iq[2];
      case "iq_def_d": return b.iq[3];
      case "iq_beni": return b.iqBeni;
      case "iq_truppe": return b.iqTruppe;
      case "iq_azioni": return b.iqAzioni;
      case "iq_cap": return b.iqCap;
      case "mon": return b.mon;
      case "mat": return b.mat;
      case "fp": return b.fp;
      case "fpb": return b.fpb;
      case "fur": return b.fur;
      case "tr": return b.tr;
      case "trne": return b.trne;
      case "beni": return b.beni;
      case "benip": return b.benip;
      case "benis": return b.benis;
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
    localStorage.setItem(POP_COLUMN_KEY, showPopColumn.toString());
    localStorage.setItem(FEL_COLUMN_KEY, showFelColumn.toString());
    localStorage.setItem(IQ_PROD_COLUMNS_KEY, showIqProdColumns.toString());
    localStorage.setItem(PROD_COLUMNS_KEY, showProdColumns.toString());
    localStorage.setItem(DB_VIEW_KEY, dbViewFull ? "full" : "light");
  }, [generalDefense, spedizioniEnabled, spedizioniAttack, showSigmaColumns, showPopColumn, showFelColumn, showIqProdColumns, showProdColumns, dbViewFull]);

  // Pulizia chiavi orfane al mount (una volta sola)
  useEffect(() => {
    if (isStorageOutdated()) {
      setIsOutdatedModalOpen(true);
    } else {
      cleanupOrphanedKeys();
    }
  }, []);

  const handleWandClick = async (e: React.MouseEvent) => {
    e.preventDefault();

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
        alert(t("clipboardNotJsonAlert", uiLang));
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
    const data = parsed as BookmarkletData;

    // 2) Dati validi: crea il nuovo profilo, lo attiva e svuota gli stati.
    const id = `p_${Date.now()}`;
    const name = t("defaultProfileName", uiLang, profiles.length + 1);
    const newProfile = { id, name };
    const updated = [...profiles, newProfile];
    setProfiles(updated);
    writeStoredJson(PROFILES_KEY, updated);
    // Ricorda il profilo precedente per il rollback in caso di errore.
    const previousProfileId = activeProfileId;
    setActiveProfileId(id);
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    loadProfileData(id);

    // 3) Importa nel nuovo profilo nell'ordine: città → alleati → inventario.
    try {
      await handleImportAll(data, id);
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
      // Rimuovi le eventuali chiavi parziali del profilo fallito
      (["city", "inventory", "allies"] as const).forEach(slot => {
        try { localStorage.removeItem(profileStorageKey(id, slot)); } catch { /* ignorato: pulizia best-effort */ }
      });
      // Ripristina il profilo precedente
      setActiveProfileId(previousProfileId ?? null);
      if (previousProfileId) {
        localStorage.setItem(ACTIVE_PROFILE_KEY, previousProfileId);
        loadProfileData(previousProfileId);
      } else {
        localStorage.removeItem(ACTIVE_PROFILE_KEY);
      }
      alert(t("importErrorAlert", uiLang, (err instanceof Error ? err.message : String(err))));
    }
  };

  const profileDataCache = useMemo(() => {
    const cache = new Map<string, boolean>();
    profiles.forEach(p => {
      const hasCity = !!localStorage.getItem(profileStorageKey(p.id, "city"));
      const hasInv = !!localStorage.getItem(profileStorageKey(p.id, "inventory"));
      cache.set(p.id, hasCity || hasInv);
    });
    return cache;
    // activeProfileId e storageVersion non sono usati nel corpo ma fungono da
    // trigger: il memo legge da localStorage (non reattivo), quindi va ricalcolato
    // quando cambia il profilo attivo o quando storageVersion segnala una modifica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, activeProfileId, storageVersion]);

  const totalStorageStr = useMemo(() => {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("foe_")) {
        totalBytes += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
      }
    }
    if (totalBytes === 0) return "";
    if (totalBytes >= 1024 * 1024) return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(totalBytes / 1024)} KB`;
    // storageVersion è un trigger per rileggere localStorage (non reattivo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageVersion]);

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
      "Mon", "Mat", "PF", "PFB", "FUR", "TR", "TRNE", "Beni", "BeniP", "BeniS", "BeniB", "BeniG", "BP", "FSP", "TPM", "TPB", "ADM", "MOD", "RIN", "IMM",
    ];
    const rows = selectedBuildings.map(b => [
      b.cityEntityId, b.name, b.currentEff, b.size, b.road, b.pop, b.fel,
      b.general[0], b.general[1], b.general[2], b.general[3],
      b.gbg[0], b.gbg[1], b.gbg[2], b.gbg[3],
      b.sped[0], b.sped[1], b.sped[2], b.sped[3],
      b.iq[0], b.iq[1], b.iq[2], b.iq[3],
      b.iqMon, b.iqMonB, b.iqMat, b.iqMatB,
      b.iqBeni, b.iqTruppe, b.iqAzioni, b.iqCap,
      b.mon, b.mat, b.fp, b.fpb, b.fur, b.tr, b.trne, b.beni, b.benip, b.benis, b.benib, b.benig, b.bp, b.fsp, b.tpm, b.tpb, b.adm, b.mod, b.rin, b.imm,
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
    link.download = `foe-export-${new Date().toISOString().slice(0, 10)}.csv`;
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
  // Sostituisce i valori di attacco/difesa (general, gbg, sped, iq) e IQ
  // (iqBeni, iqAzioni, iqCap) con quelli reali dell'era corrente estratti da
  // CityEntities all'import. Le produzioni restano quelle del CSV (non sono
  // gestite via CityEntities); per gli edifici non nel CSV restano i "?".
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
    // SpaceHub) così le ere intermedie sono precise.
    return {
      ...b,
      pop: stats.pop,
      fel: stats.fel,
      general: stats.general,
      gbg: stats.gbg,
      sped: stats.sped,
      iq: stats.iq,
      iqMonB: stats.iqMonB,
      iqMatB: stats.iqMatB,
      iqMon: stats.iqMon,
      iqMat: stats.iqMat,
      iqBeni: stats.iqBeni,
      iqTruppe: stats.iqTruppe,
      iqAzioni: stats.iqAzioni,
      iqCap: stats.iqCap,
      bp: stats.bp,
      fp: stats.fp,
      fpb: stats.fpb,
      fur: stats.fur,
      tr: stats.tr,
      trne: stats.trne,
      beni: stats.beni,
      benip: stats.benip,
      benis: stats.benis,
      benib: stats.benib,
      benig: stats.benig,
      mon: stats.mon,
      mat: stats.mat,
      fsp: stats.fsp,
      tpm: stats.tpm,
      tpb: stats.tpb,
      adm: stats.adm,
      mod: stats.mod,
      rin: stats.rin,
      imm: stats.imm,
    };
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
      id: `placeholder-${bldId}`, name, names: { it: name, en: name }, hash: "", lin: false, cityEntityId: bldId,
      time: 0, size: "?", area: 0, road: 0, pop: 0, fel: 0,
      general: [0,0,0,0], gbg: [0,0,0,0], sped: [0,0,0,0], iq: [0,0,0,0],
      iqMonB: 0, iqMatB: 0, iqMon: 0, iqMat: 0,
      iqBeni: 0, iqTruppe: 0, iqAzioni: 0, iqCap: 0, ally: 0,
      fp: 0, fpb: 0, fur: 0, tr: 0, trne: 0,
      beni: 0, benip: 0, benis: 0, benib: 0, benig: 0, mon: 0, mat: 0,
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
      if (minLvl < currentEraId) out.add(id);
    });
    return out;
  }, [entityLevels, currentEraId]);

  // ── Override ERA CORRENTE per Città e Inventario ──────────────────────────
  // Sostituisce i valori di attacco/difesa (general, gbg, sped, iq) e IQ
  // (iqBeni, iqAzioni, iqCap) con quelli reali dell'era corrente estratti da
  // CityEntities all'import. Le produzioni restano quelle del CSV (non sono
  // gestite via CityEntities); per gli edifici non nel CSV restano i "?".

  // Sorgente base per la tab attiva. Separata dal filtro così l'override era
  // (sotto) non dipende da activeTab in modo opaco.
  const filterSourceBuildings = useMemo<ProcessedBuilding[]>(() => {
    if (activeTab === "propria_citta") return allProcessedBuildings;
    if (activeTab === "inventario") {
      return showOnlyReadyBuildings ? processedInventoryRawBuildings : processedInventoryKitBuildings;
    }
    return processedBuildings;
  }, [activeTab, allProcessedBuildings, processedInventoryRawBuildings, processedInventoryKitBuildings, processedBuildings, showOnlyReadyBuildings]);

  // Applica UNA VOLTA l'override era corrente (stats + nome + efficienza) per le
  // tab Città/Inventario, indipendentemente dalla ricerca. Prima questo lavoro
  // (applyEraStats + calculateEfficiency + displayName per ogni edificio) veniva
  // rifatto dentro il loop di filtro a OGNI battitura nella ricerca; ora dipende
  // solo dai dati che lo influenzano davvero. Ogni elemento porta con sé il
  // proprio `searchName` già minuscolizzato per il match della ricerca.
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
    return filterSourceBuildings.map(b => {
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
  }, [filterSourceBuildings, activeTab, applyEraStats, gameNames, gameLang, uiLang, weights]);

  const filteredBuildings = useMemo(() => {
    const sourceBuildings: ProcessedBuilding[] = eraAdjustedSource;

    const isIdSearch = deferredSearch.startsWith("\\");
    const deferredSearchLower = isIdSearch
      ? deferredSearch.slice(1).toLowerCase()
      : deferredSearch.toLowerCase();
    const prodFilterKeys = currentFilters.prodFilter.size > 0 ? [...currentFilters.prodFilter] : null;

    // Pre-compute minEff once outside the loop
    const minEffVal = currentFilters.minEff
      ? parseFloat(currentFilters.minEff.replace(",", "."))
      : NaN;
    const hasMinEff = !isNaN(minEffVal);

    // Pre-compute boolean flags once to avoid repeated property access in the hot loop
    const isPropriacitta = activeTab === "propria_citta";
    const isInventario = activeTab === "inventario";
    const showOnlyIncursioni = currentFilters.showOnlyFilter === "incursioni";
    const showOnlyAlleati = currentFilters.showOnlyFilter === "alleati";
    const showOnlyInsediamenti = currentFilters.showOnlyFilter === "insediamenti";
    const showOnlyPremiCampi = currentFilters.showOnlyFilter === "premi_campi";
    const showOnlyPremiIq = currentFilters.showOnlyFilter === "premi_iq";
    const hasEventFilter = !!(currentFilters.showEventFilter && currentEventFilter);
    const isAndMode = currentFilters.prodFilterMode === "AND";

    // Single-pass filter — avoids 4 intermediate arrays from chained .filter()
    const filtered: ProcessedBuilding[] = [];
    const isDatabase = activeTab === "database";
    for (const b of sourceBuildings) {
      // 0. Vista LIGHT (solo tab Info/database): mostra solo gli edifici
      // "principali" (lin=true, i 823 storici), nascondendo livelli intermedi
      // e varianti. In FULL si vedono tutti. Negli altri tab non si applica:
      // lì la lista è già ristretta agli edifici effettivamente posseduti.
      if (isDatabase && !dbViewFull && !b.lin) continue;

      // 1. Tab-specific membership check
      if (isPropriacitta) {
        if (!b.isGreatBuilding) {
          if (!b.cityEntityId || !importedCityEntityLookup.has(b.cityEntityId)) continue;
        }
      } else if (isInventario) {
        // Tutti i building in processedInventoryKitBuildings sono già pre-filtrati
        // dall'optimizer: non serve ulteriore membership check.
      }

      // L'override era e il nome visibile sono già stati applicati in
      // eraAdjustedSource; `b.searchName` riflette già il nome mostrato.
      const visibleNameForSearch = b.searchName;

      // 2. Search: per nome (default) o per CityEntityId (prefisso \).
      if (deferredSearchLower && (
        isIdSearch
          ? !b.cityEntityId?.toLowerCase().includes(deferredSearchLower)
          : !visibleNameForSearch.includes(deferredSearchLower)
      )) continue;

      // 3. Filtered outdated (solo tab Città)
      if (isPropriacitta && showOnlyOutdated && b.cityEntityId && !outdatedBuildings.has(b.cityEntityId)) continue;
      if (isPropriacitta && showOnlyDeclassable && b.cityEntityId && !declassableBuildings.has(b.cityEntityId)) continue;
      if (isPropriacitta && showOnlyWithAllySlot && b.cityEntityId && !allySlotsPerBuilding.has(b.cityEntityId)) continue;

      // 4. Limited ascended filter
      if (!currentFilters.showLimitedAscended && b.time > 0) continue;

      // 5. Toggle filters (no array spread — direct property checks)
      const hasIQ = b.iq[0] !== 0 || b.iq[1] !== 0 || b.iq[2] !== 0 || b.iq[3] !== 0 || b.iqMonB !== 0 || b.iqMatB !== 0 || b.iqMon !== 0 || b.iqMat !== 0 || b.iqBeni !== 0 || b.iqTruppe !== 0 || b.iqAzioni !== 0 || b.iqCap !== 0;
      if (!currentFilters.showIncursionBuildings && hasIQ) continue;
      if (!currentFilters.showAllyBuildings && b.ally > 0) continue;
      if (!currentFilters.showMassAidBuildings && b.adm > 0) continue;
      if (!currentFilters.showStoreBuildingBuildings && b.imm > 0) continue;
      if (!currentFilters.showGreatBuildings && b.isGreatBuilding) continue;

      // 6. Advanced filters
      if (hasMinEff && b.currentEff <= minEffVal) continue;

      if (showOnlyIncursioni && !hasIQ) continue;
      if (showOnlyAlleati && b.ally <= 0) continue;
      if (showOnlyInsediamenti && !isSettlementPrize(b.cityEntityId)) continue;
      if (showOnlyPremiCampi && !isBattlegroundsPrizeId(b.cityEntityId)) continue;
      if (showOnlyPremiIq && !isQuantumIncursionsPrizeId(b.cityEntityId)) continue;
      if (hasEventFilter && !buildingMatchesEvent(b.cityEntityId, currentEventFilter)) continue;

      if (prodFilterKeys) {
        const prodMatch = isAndMode
          ? prodFilterKeys.every(k => {
              const v = b[k as keyof typeof b];
              return typeof v === "number" && v > 0;
            })
          : prodFilterKeys.some(k => {
              const v = b[k as keyof typeof b];
              return typeof v === "number" && v > 0;
            });
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
  }, [eraAdjustedSource, deferredSearch, sortCriteria, currentFilters, currentEventFilter, activeTab, importedCityEntityLookup, manualSortTabs, showOnlyOutdated, outdatedBuildings, showOnlyDeclassable, declassableBuildings, showOnlyWithAllySlot, allySlotsPerBuilding, dbViewFull]);

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

  const syncBuildingTableScroll = (source: "table" | "floating") => {
    const tableScroller = buildingTableScrollRef.current;
    const floatingScroller = buildingTableFloatingScrollRef.current;
    if (!tableScroller || !floatingScroller || isSyncingBuildingTableScroll.current) return;

    isSyncingBuildingTableScroll.current = true;
    if (source === "table") {
      floatingScroller.scrollLeft = tableScroller.scrollLeft;
    } else {
      tableScroller.scrollLeft = floatingScroller.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingBuildingTableScroll.current = false;
    });
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
    currentFilters.showTimeColumn,
    spedizioniEnabled,
  ]);

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
    const searchLower = deferredSearch.toLowerCase();
    const result: Array<Allies.ComputedAllyStats & typeof ALLIES_FROM_CSV[0] & { level: number; currentEff: number }> = [];

    for (const ally of ALLIES_FROM_CSV) {
      // Search filter (hoisted out of inner loops)
      if (!allyName(ally.id, gameLang).toLowerCase().includes(searchLower)) continue;

      // Rarity filter
      if (allyRarityFilters[ally.rarity] === false) continue;

      // Owned-only filter
      if (showOnlyOwnedAllies && !ownedAllyLookup.has(`${ally.id}__${ally.rarity}`)) continue;

      const level = globalAllyLevel;
      const { computedGeneral, computedGbg, computedSped, computedIq } = Allies.getComputedAllyStats(ally, level, INHERITED_ALLIES_MAP);

      // Zero-stats filter — no spread array allocation (include computedIq:
      // un alleato con solo boost IQ non deve essere filtrato via)
      if (
        computedGeneral[0] === 0 && computedGeneral[1] === 0 && computedGeneral[2] === 0 && computedGeneral[3] === 0 &&
        computedGbg[0] === 0 && computedGbg[1] === 0 && computedGbg[2] === 0 && computedGbg[3] === 0 &&
        computedSped[0] === 0 && computedSped[1] === 0 && computedSped[2] === 0 && computedSped[3] === 0 &&
        computedIq[0] === 0 && computedIq[1] === 0 && computedIq[2] === 0 && computedIq[3] === 0
      ) continue;

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

      result.push({ ...ally, level, computedGeneral, computedGbg, computedSped, computedIq, currentEff });
    }

    // Cache locale dei nomi alleati per evitare O(N log N) chiamate a allyName
    // durante il sort. Ogni id viene risolto una sola volta per render.
    const nameCache = new Map<string, string>();
    const getName = (id: string) => {
      let n = nameCache.get(id);
      if (n === undefined) { n = allyName(id, gameLang); nameCache.set(id, n); }
      return n;
    };

    result.sort((a, b) => compareAllies(a, b, sortCriteria, getName));

    return result;
  }, [deferredSearch, sortCriteria, weights, globalAllyLevel, allyRarityFilters, showOnlyOwnedAllies, ownedAllyLookup, gameLang]);



  const processedImportedAllies = useMemo(() => {
    if (importedAllies.length === 0) return [];

    const searchLower = deferredSearch.toLowerCase();

    const result: Array<
      Allies.ComputedAllyStats & typeof ALLIES_FROM_CSV[0] & {
        jsonId: number;
        level: number;
        isPlaced: boolean;
        isFragment: boolean;
        fragmentCount: number;
        currentEff: number;
        placedInEntityId?: string;
      }
    > = [];
    for (const imp of importedAllies) {
      const csvAlly = ALLIES_BY_ID_RARITY.get(`${imp.allyId}__${imp.rarity}`);
      if (!csvAlly) continue;

      // Search filter (hoisted — avoids .toLowerCase() per ally inside .filter())
      const nameLC = allyName(csvAlly.id, gameLang).toLowerCase();
      const idLC = csvAlly.id.toLowerCase();
      if (!nameLC.includes(searchLower) && !idLC.includes(searchLower)) continue;

      // Rarity filter
      if (allyRarityFilters[csvAlly.rarity] !== true) continue;

      const { computedGeneral, computedGbg, computedSped, computedIq } = Allies.getComputedAllyStats(csvAlly, imp.level, INHERITED_ALLIES_MAP);

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

      // Zero-stats filter (skip non-fragments with all-zero stats — include computedIq)
      const isFragment = imp.isFragment ?? false;
      if (!isFragment) {
        if (
          computedGeneral[0] === 0 && computedGeneral[1] === 0 && computedGeneral[2] === 0 && computedGeneral[3] === 0 &&
          computedGbg[0] === 0 && computedGbg[1] === 0 && computedGbg[2] === 0 && computedGbg[3] === 0 &&
          computedSped[0] === 0 && computedSped[1] === 0 && computedSped[2] === 0 && computedSped[3] === 0 &&
          computedIq[0] === 0 && computedIq[1] === 0 && computedIq[2] === 0 && computedIq[3] === 0
        ) continue;
      }

      result.push({
        ...csvAlly,
        jsonId: imp.jsonId,
        level: imp.level,
        isPlaced: imp.isPlaced,
        isFragment,
        fragmentCount: imp.fragmentCount ?? 0,
        currentEff,
        placedInEntityId: imp.placedInEntityId,
        computedGeneral,
        computedGbg,
        computedSped,
        computedIq,
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
      const primary = compareAllies(a, b, sortCriteria, getName);
      if (primary !== 0) return primary;
      // Criterio secondario: ordina per rarità (Comune → … → Leggendario)
      const rankA = a.rarity;
      const rankB = b.rarity;
      return rankA - rankB;
    });

    return result;
  }, [importedAllies, deferredSearch, sortCriteria, weights, allyRarityFilters, gameLang]);

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
    iconMon, iconMat, iconFP, iconFPB, iconFUR, iconTR, iconTRNE,
    iconBeni, iconBeniP, iconBeniS, iconBeniB, iconBeniG, iconBP,
    iconOneUp, iconImm, iconRinn, iconAiuto,
  }), []);

  const tableMinWidth = useMemo(() => {
    const base = 32 + 28 + 200 + 32 + 50 + 48 + 44 + 50; // checkbox+wiki+nome+road+size+pop+fel+eff
    const time = currentFilters.showTimeColumn ? 50 : 0;
    const pop = showPopColumn ? 76 : 0;
    const fel = showFelColumn ? 76 : 0;
    const milCols = showSigmaColumns ? 4 : (spedizioniEnabled ? 12 : 8); // gen+gbg+(sped)
    const iq = (showIqProdColumns ? 12 : 8) * 42; // (IQmonB/IQmatB/IQmon/IQmat +) IQAtk/Def + IQBeni+IQTruppe+IQAzioni + IQCap
    const prod = showProdColumns ? 20 * 36 : 0; // Mon+Mat + le 18 colonne esistenti
    return base + time + pop + fel + milCols * 42 + iq + prod;
  }, [currentFilters, showSigmaColumns, spedizioniEnabled, showPopColumn, showFelColumn, showIqProdColumns, showProdColumns]);

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
    const base = 240 + 64 + 50 + 50; // nome + rarità/LV1 + LV1/EFF + EFF (max delle due tabelle)
    const genCols = showSigmaColumns ? 0 : 4;
    const gbgCols = 4;
    const spedCols = spedizioniEnabled ? 4 : 0;
    return base + (genCols + gbgCols + spedCols) * 42;
  }, [showSigmaColumns, spedizioniEnabled]);

  // Memoize city buildings list — avoids O(n) filter on every render
  // I valori att/dif riflettono l'era corrente (override da eraStats).
  // Le decorazioni sono escluse dai totali produzione: sono edifici "non
  // attivi" (W_*Decoration) con valori a zero per definizione nel CSV,
  // escluderle qui resta solo per chiarezza concettuale.
  const cityBuildings = useMemo(
    () => BUILDINGS_FROM_CSV.filter(b => cityEntityIds.has(b.cityEntityId) && !b.isInactive && !b.isGreatBuilding).map(applyEraStats),
    [cityEntityIds, applyEraStats],
  );

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

  const renderProdSummary = () => {
    if (cityEntityIds.size === 0) return null;

    const prodTypes = [
      { key: "fsp", name: t("prodRushSpecial", uiLang),    icon: "⏳", cost: 30, invKey: "rushEventBuildings"    as keyof SpecialKits },
      { key: "tpm", name: t("prodRushMaterials", uiLang),  icon: "🛠", cost: 15, invKey: "rushMassSupplies"      as keyof SpecialKits },
      { key: "tpb", name: t("prodRushGoods", uiLang),      icon: "📦", cost: 30, invKey: "rushGoodsBuildings"    as keyof SpecialKits },
      { key: "adm", name: t("prodMassAid", uiLang),         icon: <img src={iconAiuto} alt="" className="icon-16" />, cost: 30, invKey: "massSelfAidKit"        as keyof SpecialKits },
      { key: "mod", name: t("prodOneUpKit", uiLang),        icon: <img src={iconOneUp} alt="" className="icon-16" />, cost: 30, invKey: "oneUpKit"              as keyof SpecialKits },
      { key: "rin", name: t("prodRenovationKit", uiLang),   icon: <img src={iconRinn} alt="" className="icon-16" />, cost: 30, invKey: "renovationKit"         as keyof SpecialKits },
      { key: "imm", name: t("prodStoreBuilding", uiLang),   icon: <img src={iconImm} alt="" className="icon-16" />, cost: 15, invKey: "storeBuilding"         as keyof SpecialKits },
    ];
    const placedAllies = processedImportedAllies.filter(a => a.isPlaced && !a.isFragment);

    const filteredGBs = processedGreatBuildings.filter(gb => cityEntityIds.has(gb.cityEntityId));
    // Edifici fallback presenti in città (creati al volo perché non nel CSV):
    // i loro bonus militari reali vanno inclusi nei totali, altrimenti le
    // statistiche risultano sottostimate.
    const cityFallbacks = Array.from(fallbackBuildings.values()).filter(b => cityEntityIds.has(b.cityEntityId));
    const getBuildingSum = (idx: number, key: "general" | "gbg" | "sped" | "iq") =>
      cityBuildings.reduce((s, b) => s + b[key][idx] * (cityEntityIds.get(b.cityEntityId) || 0), 0) +
      cityFallbacks.reduce((s, b) => s + b[key][idx] * (cityEntityIds.get(b.cityEntityId) || 0), 0);
    const getGESum = (idx: number, key: "general" | "gbg" | "sped" | "iq") =>
      filteredGBs.reduce((s, gb) => s + gb[key][idx], 0);
    const getAllySum = (idx: number, key: "computedGeneral" | "computedGbg" | "computedSped" | "computedIq") =>
      placedAllies.reduce((s, a) => { const arr = a[key] as unknown as number[] | undefined; return s + (arr ? arr[idx] : 0); }, 0);

    const statsRows = [
      { label: t("statRowGlobal", uiLang), color: "red" as const,
        bA: getBuildingSum(0, "general"), bD: getBuildingSum(1, "general"),
        gA: getGESum(0, "general"), gD: getGESum(1, "general"),
        aA: getAllySum(0, "computedGeneral"), aD: getAllySum(1, "computedGeneral") },
      { label: t("statRowGlobal", uiLang), color: "blue" as const,
        bA: getBuildingSum(2, "general"), bD: getBuildingSum(3, "general"),
        gA: getGESum(2, "general"), gD: getGESum(3, "general"),
        aA: getAllySum(2, "computedGeneral"), aD: getAllySum(3, "computedGeneral") },
      { label: t("sectionGbg", uiLang), color: "red" as const,
        bA: getBuildingSum(0, "gbg"), bD: getBuildingSum(1, "gbg"),
        gA: getGESum(0, "gbg"), gD: getGESum(1, "gbg"),
        aA: getAllySum(0, "computedGbg"), aD: getAllySum(1, "computedGbg"),
        extraA: getBuildingSum(0, "general") + getGESum(0, "general") + getAllySum(0, "computedGeneral"),
        extraD: getBuildingSum(1, "general") + getGESum(1, "general") + getAllySum(1, "computedGeneral") },
      { label: t("sectionGbg", uiLang), color: "blue" as const,
        bA: getBuildingSum(2, "gbg"), bD: getBuildingSum(3, "gbg"),
        gA: getGESum(2, "gbg"), gD: getGESum(3, "gbg"),
        aA: getAllySum(2, "computedGbg"), aD: getAllySum(3, "computedGbg"),
        extraA: getBuildingSum(2, "general") + getGESum(2, "general") + getAllySum(2, "computedGeneral"),
        extraD: getBuildingSum(3, "general") + getGESum(3, "general") + getAllySum(3, "computedGeneral") },
      { label: t("sectionGe", uiLang), color: "red" as const,
        bA: getBuildingSum(0, "sped"), bD: getBuildingSum(1, "sped"),
        gA: getGESum(0, "sped"), gD: getGESum(1, "sped"),
        aA: getAllySum(0, "computedSped"), aD: getAllySum(1, "computedSped"),
        extraA: getBuildingSum(0, "general") + getGESum(0, "general") + getAllySum(0, "computedGeneral"),
        extraD: getBuildingSum(1, "general") + getGESum(1, "general") + getAllySum(1, "computedGeneral") },
      { label: t("sectionGe", uiLang), color: "blue" as const,
        bA: getBuildingSum(2, "sped"), bD: getBuildingSum(3, "sped"),
        gA: getGESum(2, "sped"), gD: getGESum(3, "sped"),
        aA: getAllySum(2, "computedSped"), aD: getAllySum(3, "computedSped"),
        extraA: getBuildingSum(2, "general") + getGESum(2, "general") + getAllySum(2, "computedGeneral"),
        extraD: getBuildingSum(3, "general") + getGESum(3, "general") + getAllySum(3, "computedGeneral") },
      { label: t("sectionQi", uiLang), color: "red" as const,
        bA: getBuildingSum(0, "iq"), bD: getBuildingSum(1, "iq"),
        gA: getGESum(0, "iq"), gD: getGESum(1, "iq"),
        aA: getAllySum(0, "computedIq"), aD: getAllySum(1, "computedIq") },
      { label: t("sectionQi", uiLang), color: "blue" as const,
        bA: getBuildingSum(2, "iq"), bD: getBuildingSum(3, "iq"),
        gA: getGESum(2, "iq"), gD: getGESum(3, "iq"),
        aA: getAllySum(2, "computedIq"), aD: getAllySum(3, "computedIq") },
    ];

    return (
      <div className="relative h-7 border border-slate-700 rounded text-[11px] shrink-0 w-auto">
        <button
          onClick={() => setIsProdSummaryOpen(v => !v)}
          className="h-full px-2.5 font-bold text-orange-400 uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:text-orange-300 hover:bg-slate-800/60 transition-colors"
        >
          PROD + STAT
        </button>
        {isProdSummaryOpen && (() => {
          // Calcola il totale esatto di un campo di produzione per un edificio,
          // tenendo conto delle copie in ere diverse (se presenti).
          // Per gli edifici con tutte le copie alla stessa era usa count × valore
          // corrente (come prima). Per quelli con copie in ere diverse usa la
          // somma dei (count_per_era × valore_per_era) precalcolata all'import.
          const exactBuildingSum = (b: Building & { cityEntityId: string }, field: keyof EraStats & keyof Building): number => {
            const groups = entityInstanceEraStats.get(b.cityEntityId);
            if (groups) {
              // Somma esatta: ogni gruppo ha già (eraAge, count, stats)
              return groups.reduce((s, [, count, stats]) => s + (stats[field] as number ?? 0) * count, 0);
            }
            // Nessuna era mista: count totale × valore corrente
            const count = cityEntityIds.get(b.cityEntityId) || 0;
            return ((b[field] as number) || 0) * count;
          };

          const totalPFNormal = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "fp"), 0);
          const totalPFGB = processedGreatBuildings.reduce((sum, b) => sum + b.fp, 0);
          const totalPFB = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "fpb"), 0);
          const totalBeniNormal = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "beni"), 0);
          const totalBeniGB = processedGreatBuildings.reduce((sum, b) => sum + b.beni, 0);
          const totalBeniPNormal = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "benip"), 0);
          const totalBeniPGB = processedGreatBuildings.reduce((sum, b) => sum + b.benip, 0);
          const totalBeniSNormal = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "benis"), 0);
          const totalBeniSGB = processedGreatBuildings.reduce((sum, b) => sum + b.benis, 0);
          const totalBeniB = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "benib"), 0);
          const totalBeniG = cityBuildings.reduce((sum, b) => sum + exactBuildingSum(b, "benig"), 0)
            + processedGreatBuildings.reduce((sum, b) => sum + b.benig, 0);

          return (
            <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-max min-w-[420px] rounded border border-slate-800 bg-slate-950 p-2 shadow-2xl space-y-2">
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
                    const totalFrPerDay = cityBuildings.reduce((sum, b) => {
                      return sum + exactBuildingSum(b, pt.key as keyof EraStats & keyof Building);
                    }, 0);
                    const kitsPerYear = totalFrPerDay / pt.cost * 365;
                    const kitsPerMonth = kitsPerYear / 12;
                    const qty = (specialKits[pt.invKey] as number) ?? 0;
                    return (
                      <tr key={pt.key} className="border-b border-slate-800/50 last:border-0">
                        <td className="py-1 px-1 flex items-center gap-1"><span className="text-sm">{pt.icon}</span><span className="text-slate-300 whitespace-nowrap">{pt.name}</span></td>
                        <td className={`py-1 px-1 text-right font-mono font-bold ${qty > 0 ? "text-emerald-300" : "text-slate-600"}`}>{formatInt(qty)}</td>
                        <td className="py-1 px-1 text-right font-mono text-amber-300">{formatInt(totalFrPerDay)}</td>
                        <td className="py-1 px-1 text-right font-mono text-emerald-300">{formatInt(kitsPerMonth)}</td>
                        <td className="py-1 px-1 text-right font-mono text-blue-300">{formatInt(kitsPerYear)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-slate-800 pt-1.5">
                <table className="w-full">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="py-1 px-1 text-left">{t("prodColumnLabel", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("dailyQuantityLabel", uiLang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-1 px-1 flex items-center gap-1"><TableHeaderIcon src={iconFP} alt={t("prodForgePoints", uiLang)} className="!h-4 !w-4 object-contain" /><span className="text-slate-300 whitespace-nowrap">{t("prodForgePoints", uiLang)}</span></td>
                      <td className="py-1 px-1 text-right font-mono text-amber-300">{formatInt((totalPFNormal * (1 + totalPFB)) + totalPFGB)}</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-1 px-1 flex items-center gap-1"><TableHeaderIcon src={iconBeni} alt={t("prodGoodsCurrent", uiLang)} className="!h-4 !w-4 object-contain" /><span className="text-slate-300 whitespace-nowrap">{t("prodGoodsCurrent", uiLang)}</span></td>
                      <td className="py-1 px-1 text-right font-mono text-amber-300">{formatInt((totalBeniNormal * (1 + totalBeniB)) + totalBeniGB)}</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-1 px-1 flex items-center gap-1"><TableHeaderIcon src={iconBeniP} alt={t("prodGoodsPrevious", uiLang)} className="!h-4 !w-4 object-contain" /><span className="text-slate-300 whitespace-nowrap">{t("prodGoodsPrevious", uiLang)}</span></td>
                      <td className="py-1 px-1 text-right font-mono text-amber-300">{formatInt((totalBeniPNormal * (1 + totalBeniB)) + totalBeniPGB)}</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-1 px-1 flex items-center gap-1"><TableHeaderIcon src={iconBeniS} alt={t("prodGoodsNext", uiLang)} className="!h-4 !w-4 object-contain" /><span className="text-slate-300 whitespace-nowrap">{t("prodGoodsNext", uiLang)}</span></td>
                      <td className="py-1 px-1 text-right font-mono text-amber-300">{formatInt((totalBeniSNormal * (1 + totalBeniB)) + totalBeniSGB)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-1 flex items-center gap-1"><TableHeaderIcon src={iconBeniG} alt={t("prodGuildGoods", uiLang)} className="!h-4 !w-4 object-contain" /><span className="text-slate-300 whitespace-nowrap">{t("prodGuildGoods", uiLang)}</span></td>
                      <td className="py-1 px-1 text-right font-mono text-amber-300">{formatInt(totalBeniG)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-800 pt-1.5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="py-1 px-1 text-left">{t("statColLabel", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("statColFromBuildings", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("statColFromGB", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("statColFromAllies", uiLang)}</th>
                      <th className="py-1 px-1 text-right">{t("statColTotal", uiLang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsRows.map((row, idx) => {
                      const extraA = (row as { extraA?: number }).extraA ?? 0;
                      const extraD = (row as { extraD?: number }).extraD ?? 0;
                      const totalA = row.bA + row.gA + row.aA + extraA;
                      const totalD = row.bD + row.gD + row.aD + extraD;
                      const colorClass = row.color === "red" ? "text-red-400" : "text-blue-400";
                      return (
                        <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                          <td className={`py-0.5 px-1 font-semibold ${colorClass}`}>{row.label}</td>
                          <td className="py-0.5 px-1 text-right font-mono">{formatInt(row.bA)}/{formatInt(row.bD)}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-amber-400/80">{formatInt(row.gA)}/{formatInt(row.gD)}</td>
                          <td className="py-0.5 px-1 text-right font-mono text-slate-400">{formatInt(row.aA)}/{formatInt(row.aD)}</td>
                          <td className={`py-0.5 px-1 text-right font-mono font-bold ${colorClass}`}>{formatInt(totalA)}/{formatInt(totalD)}</td>
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
      </div>
    );
  };

  const renderCityUpgradeableTable = (
    title: string,
    rows: typeof cityUpgradeableData.upgradable,
    maxLevelClass: string,
  ) => {
    if (rows.length === 0) return null;

    return (
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
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
                          <div key={`${r.bld_id}-${r.kit_id}-${k.id}`} className="flex items-center gap-2 rounded border border-slate-800/80 bg-slate-950/40 px-2 py-1">
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
  const renderProfileButtons = () => (
    <>
      <button
        onClick={handleWandClick}
        draggable
        onDragStart={e => {
          e.dataTransfer.setData("text/uri-list", BOOKMARKLET_JS);
          e.dataTransfer.setData("text/x-moz-url", `${BOOKMARKLET_JS}\nFoE COPY`);
          e.dataTransfer.setData("text/plain", BOOKMARKLET_JS);
        }}
        className="relative flex items-center justify-center w-7 h-7 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-400/70 transition-all shrink-0 cursor-grab active:cursor-grabbing"
        title={t("wandTitle", uiLang)}
      >
        <Wand2 size={13} />
      </button>
      <button
        onClick={handleExportSession}
        disabled={exportLoading || profiles.length === 0}
        className="flex items-center justify-center w-7 h-7 rounded border border-slate-600 bg-slate-700/20 text-slate-400 hover:bg-slate-700/40 hover:text-slate-100 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700/20 disabled:hover:text-slate-400"
        title={profiles.length === 0 ? t("exportNoProfiles", uiLang) : t("exportProfiles", uiLang)}
      >
        {exportLoading ? <RotateCcw size={13} className="animate-spin" /> : <Download size={13} />}
      </button>
      <button
        onClick={() => { setImportError(""); setImportSuccess(""); setIsImportModalOpen(true); }}
        disabled={importLoading}
        className="flex items-center justify-center w-7 h-7 rounded border border-slate-600 bg-slate-700/20 text-slate-400 hover:bg-slate-700/40 hover:text-slate-100 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        title={t("importProfiles", uiLang)}
      >
        {importLoading ? <RotateCcw size={13} className="animate-spin" /> : <Upload size={13} />}
      </button>
      <button
        onClick={deleteAllProfiles}
        className="flex items-center justify-center w-7 h-7 rounded border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 hover:border-red-400/60 transition-all shrink-0"
        title={t("deleteAllProfiles", uiLang)}
      >
        <Trash2 size={13} />
      </button>
      <button
        onClick={() => setIsProfileHelpOpen(true)}
        className="flex items-center justify-center w-7 h-7 rounded border border-slate-600 bg-slate-700/20 text-slate-400 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/50 transition-all shrink-0 font-bold text-xs"
        title={t("profileHelpTitle", uiLang)}
      >
        ?
      </button>
      <LanguageSwitch uiLang={uiLang} onChange={handleUiLangChange} />
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* HEADER */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-amber-500/10 sticky top-0 z-40 pl-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between">
        {/* Riga superiore mobile: logo + Export/Import. Su desktop: solo logo */}
        <div className="flex items-center justify-between gap-3 md:justify-start md:shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-amber-500/80 bg-slate-950/80 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <Swords size={22} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-lg md:text-xl font-black uppercase text-transparent bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text leading-tight tracking-wide">
                FOE OPTIMIZER
              </h1>
              <p className="text-[10px] md:text-[11px] font-bold italic tracking-wide text-slate-400 leading-tight">
                <button
                  onClick={() => setIsAboutOpen(true)}
                  title={t("aboutTitle", uiLang)}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >BY SDRUSHI</button>
                {totalStorageStr ? <span className="ml-1.5 not-italic font-normal text-slate-400">{totalStorageStr}</span> : null}
                <span className="ml-1.5 not-italic font-mono text-[9px] tracking-tighter text-amber-500/80">{__BUILD_VERSION__}</span>
              </p>
            </div>
          </div>

          {/* Pulsanti azione profilo — solo mobile, spinti a destra dal justify-between */}
          <div className="flex items-center gap-1 md:hidden">
            {renderProfileButtons()}
          </div>

        </div>

        {/* ── Barra profili ─────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 px-2 gap-0.5">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {renderProfileButtons()}
          </div>
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            const isRenaming = renamingProfileId === profile.id;
            const hasData = profileDataCache.get(profile.id) ?? false;
            return (
              <div
                key={profile.id}
                onClick={() => !isRenaming && switchProfile(profile.id)}
                onDoubleClick={() => { setRenamingProfileId(profile.id); setRenameValue(profile.name); }}
                className={`flex items-center gap-1.5 h-7 px-2.5 rounded border text-xs font-semibold cursor-pointer whitespace-nowrap transition-all select-none shrink-0 ${
                  isActive
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-slate-600 bg-slate-700/20 text-slate-300 hover:bg-slate-700/40 hover:text-slate-100"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasData ? "bg-emerald-400" : "bg-slate-700"}`} />
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(profile.id, renameValue)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitRename(profile.id, renameValue);
                      if (e.key === "Escape") setRenamingProfileId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    className="bg-slate-700/80 text-slate-100 text-xs rounded px-2 py-1 w-24 outline-none border border-slate-600"
                  />
                ) : (
                  <span>{profile.name}</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); deleteProfile(profile.id); }}
                  className="ml-0.5 text-slate-600 hover:text-red-400 transition-colors"
                  title={t("profileDelete", uiLang)}
                >
                  <XIcon size={11} />
                </button>
              </div>
            );
          })}
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-transparent w-full md:w-auto md:min-w-0 overflow-x-auto no-scrollbar md:shrink py-1 pr-[10px]">
           <button
             onClick={() => setActiveTab("database")}
             className={`flex-1 md:flex-none relative px-3 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
               activeTab === "database"
                 ? "bg-slate-900/80 border border-amber-500/60 text-amber-400 shadow-lg shadow-amber-500/5"
                 : "text-slate-400 hover:text-slate-300 border border-slate-500"
             }`}
           >
             <Info size={16} className={activeTab === "database" ? "text-amber-400" : "text-slate-500"} />
             {t("tabInfo")}
           </button>
           <button
             onClick={() => setActiveTab("propria_citta")}
             className={`flex-1 md:flex-none relative px-3 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
               activeTab === "propria_citta"
                 ? "bg-slate-900/80 border border-amber-500/60 text-amber-400 shadow-lg shadow-amber-500/5"
                 : "text-slate-400 hover:text-slate-300 border border-slate-500"
             }`}
           >
             <Home size={16} className={activeTab === "propria_citta" ? "text-amber-400" : "text-slate-500"} />
             {t("tabCity", uiLang)}
            {totalCityEntityInstances > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-none text-slate-950 ring-1 ring-slate-950">
                {totalCityEntityInstances}
              </span>
            )}
          </button>
           <button
             onClick={() => setActiveTab("inventario")}
             className={`flex-1 md:flex-none relative px-3 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
               activeTab === "inventario"
                 ? "bg-slate-900/80 border border-amber-500/60 text-amber-400 shadow-lg shadow-amber-500/5"
                 : "text-slate-400 hover:text-slate-300 border border-slate-500"
             }`}
           >
             <Package size={16} className={activeTab === "inventario" ? "text-amber-400" : "text-slate-500"} />
             {t("tabInventory", uiLang)}
            {totalInventoryInstances > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-none text-slate-950 ring-1 ring-slate-950">
                {totalInventoryInstances}
              </span>
            )}
          </button>

           <button
             onClick={() => setActiveTab("alleati")}
             className={`relative flex-1 md:flex-none px-3 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
               activeTab === "alleati"
                 ? "bg-slate-900/80 border border-amber-500/60 text-amber-400 shadow-lg shadow-amber-500/5"
                 : "text-slate-400 hover:text-slate-300 border border-slate-500"
             }`}
           >
             <Users size={16} className={activeTab === "alleati" ? "text-amber-400" : "text-slate-500"} />
             {t("tabAllies", uiLang)}
            {importedAllies.length > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-none text-slate-950 ring-1 ring-slate-950">
                {importedAllies.length}
              </span>
            )}
          </button>
        </nav>
      </header>

      {(activeTab === "database" || activeTab === "propria_citta" || activeTab === "inventario") && (
         <div className="flex flex-wrap items-start px-2 pt-2 pb-1">
           <section className="flex flex-wrap items-center gap-1.5 text-xs flex-1">
             <div className="flex w-full items-center gap-1.5 md:w-auto md:contents">
             <div className="inline-flex h-7 shrink-0 overflow-hidden rounded border border-slate-700/60" role="group" title={t("lightFullTitle", uiLang)}>
               <button
                 onClick={() => setDbViewFull(false)}
                 className={`px-2 h-full text-[11px] font-bold transition-colors ${!dbViewFull ? "bg-amber-500/90 text-slate-950" : "bg-slate-800/40 text-slate-400 hover:bg-amber-500/15 hover:text-amber-300"}`}
               >
                 LIGHT
               </button>
               <button
                 onClick={() => setDbViewFull(true)}
                 className={`px-2 h-full text-[11px] font-bold transition-colors border-l border-slate-700/60 ${dbViewFull ? "bg-amber-500/90 text-slate-950" : "bg-slate-800/40 text-slate-400 hover:bg-amber-500/15 hover:text-amber-300"}`}
               >
                 FULL
               </button>
             </div>
             <div className="relative flex h-7 min-w-0 flex-1 items-center rounded border border-slate-700/60 bg-slate-800/40 px-2.5 md:w-[130px] md:flex-none hover:border-slate-600 transition-colors">
               <Search size={13} className="absolute left-2.5 text-slate-500 shrink-0" />
               <input
                 type="text"
                 placeholder={t("searchPlaceholder", uiLang)}
                 aria-label={t("searchInputLabel", uiLang)}
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full bg-transparent pl-6 pr-1 text-xs text-slate-100 outline-none placeholder:text-slate-400"
                />
              </div>

              <button
                onClick={resetFilters}
                title={t("resetFiltersTitle", uiLang)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:bg-red-500/20 hover:text-red-200 hover:border-red-400/60 transition-all"
              >
                <RotateCcw size={13} />
              </button>

              <div className="flex h-7 flex-1 items-center rounded border border-slate-700/60 bg-slate-800/40 px-2 md:h-7 md:w-auto md:flex-none hover:border-slate-600 transition-colors" title={t("categoryFilterTitle", uiLang)}>
                <select
                  value={currentFilters.showOnlyFilter}
                  onChange={(e) => updateFilter("showOnlyFilter", e.target.value as FilterType)}
                  aria-label={t("categoryFilterTitle", uiLang)}
                  className="w-full bg-transparent text-slate-200 text-xs outline-none cursor-pointer hover:text-slate-100 py-0"
                >
                  <option value="all" className="bg-slate-800">{t("catAll", uiLang)}</option>
                  <option value="incursioni" className="bg-slate-800">{t("catIq", uiLang)}</option>
                  <option value="alleati" className="bg-slate-800">{t("catAlly", uiLang)}</option>
                  <option value="insediamenti" className="bg-slate-800">{t("catSettlements", uiLang)}</option>
                  <option value="premi_campi" className="bg-slate-800">{t("catBattlegroundsPrizes", uiLang)}</option>
                  <option value="premi_iq" className="bg-slate-800">{t("catQiPrizes", uiLang)}</option>
                </select>
              </div>

              <div className="flex h-7 flex-1 items-center rounded border border-slate-700/60 bg-slate-800/40 px-1 md:h-7 md:w-auto md:flex-none hover:border-slate-600 transition-colors" title={t("eventFilterTitle", uiLang)}>
                <select
                  value={currentFilters.showEventFilter}
                  onChange={(e) => updateFilter("showEventFilter", e.target.value)}
                  aria-label={t("eventFilterTitle", uiLang)}
                  className="w-full bg-transparent text-slate-200 text-xs outline-none cursor-pointer hover:text-slate-100 py-0"
                >
                  <option value="" className="bg-slate-800">{t("eventsDefaultOption", uiLang)}</option>
                  {EVENTS_LIST.map((event) => (
                    event.isGroup ? (
                      <option key={event.id} value={event.id} className="bg-slate-800 font-bold text-amber-300">🗓️ {eventName(event, uiLang)}</option>
                    ) : (
                      <option key={event.id} value={event.id} className="bg-slate-800">  {eventName(event, uiLang)}</option>
                    )
                  ))}
                </select>
              </div>
            </div>

          <div className="flex h-7 items-center gap-1.5 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400">{t("weightAtk", uiLang)}</span>
            <span className="font-mono text-xs font-bold text-red-400">1,0</span>
          </div>

          <div className="flex h-7 items-center gap-1.5 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400">{t("weightDef", uiLang)}</span>
            <div className="flex gap-0.5">
              {([0.8, 1.0] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setGeneralDefense(val)}
                  className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                    generalDefense === val ? "bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-sm" : "bg-slate-800/50 text-slate-400 hover:text-blue-300 border border-transparent hover:bg-slate-700"
                  }`}
                >
                  {val.toFixed(1).replace(".", ",")}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsEfficiencyHelpOpen(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-600 bg-slate-700/20 text-slate-400 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/50 transition-all font-bold text-xs"
            title={t("efficiencyHelpTitle", uiLang)}
          >
            ?
          </button>

          <div className="flex h-7 items-center gap-1 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400">{t("weightGbg", uiLang)}</span>
            <span className="font-mono text-xs font-bold text-red-400">{(1.0 - (spedizioniEnabled ? spedizioniAttack : 0)).toFixed(2).replace(".", ",")}</span>
            <span className="text-xs text-slate-600">/</span>
            <span className="font-mono text-xs font-bold text-blue-400">{(generalDefense * (1 - (spedizioniEnabled ? spedizioniAttack : 0))).toFixed(2).replace(".", ",")}</span>
          </div>

          {/* Pulsante Sigma - mostra colonne somma Gen+Campi (e Gen+Sped se SPED acceso) */}
          <button
            onClick={() => setShowSigmaColumns(v => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded border transition-all text-base font-bold leading-none ${
              showSigmaColumns
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-sm"
                : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
            }`}
            title={showSigmaColumns ? t("sigmaShowTitle", uiLang) : t("sigmaHideTitle", uiLang)}
          >
            Σ
          </button>

          <div className="flex h-7 items-center gap-1.5 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400">{t("weightGe", uiLang)}</span>
            <button
              onClick={() => setSpedizioniEnabled(prev => !prev)}
              aria-label={t("spedizioniToggleLabel", uiLang)}
              role="switch"
              aria-checked={spedizioniEnabled}
              className={`relative w-7 h-3.5 rounded-full transition-colors shrink-0 ${
                spedizioniEnabled ? "bg-amber-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${
                  spedizioniEnabled ? "translate-x-3.5" : ""
                }`}
              />
            </button>
            {spedizioniEnabled && (
              <>
                <input
                  type="range"
                  aria-label={t("spedizioniAttackSliderLabel", uiLang)}
                  min="0"
                  max="1"
                  step="0.05"
                  value={spedizioniAttack}
                  onChange={(e) => setSpedizioniAttack(parseFloat(e.target.value))}
                  className="h-1 w-10 appearance-none rounded bg-slate-800 accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-xs font-bold text-amber-400">{spedizioniAttack.toFixed(2).replace(".", ",")}</span>
              </>
            )}
          </div>

             {/* Colonna Tempo (⏱) - Nasconde/mostra sia la colonna che gli edifici limitati */}
             <button
               onClick={() => {
                 const newVal = !currentFilters.showTimeColumn;
                 updateFilter("showTimeColumn", newVal);
                 updateFilter("showLimitedAscended", newVal);
               }}
               className={`flex h-7 w-7 items-center justify-center rounded border transition-all text-xl leading-none ${
                 currentFilters.showTimeColumn
                   ? "border-violet-500/50 bg-violet-500/15 text-violet-300 shadow-sm"
                   : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
               }`}
               title={currentFilters.showTimeColumn ? t("timeColumnShowTitle", uiLang) : t("timeColumnHideTitle", uiLang)}
             >
               ⏱
             </button>

             {/* Popolazione Toggle */}
             <button
               onClick={() => setShowPopColumn(v => !v)}
               className={`flex h-7 w-7 items-center justify-center rounded border transition-all ${
                 showPopColumn
                   ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-sm"
                   : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
               }`}
               title={showPopColumn ? t("popColumnShowTitle", uiLang) : t("popColumnHideTitle", uiLang)}
             >
               <TableHeaderIcon src={iconPop} alt="" />
             </button>

             {/* Felicità Toggle */}
             <button
               onClick={() => setShowFelColumn(v => !v)}
               className={`flex h-7 w-7 items-center justify-center rounded border transition-all ${
                 showFelColumn
                   ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-sm"
                   : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
               }`}
               title={showFelColumn ? t("felColumnShowTitle", uiLang) : t("felColumnHideTitle", uiLang)}
             >
               <TableHeaderIcon src={iconFel} alt="" />
             </button>

             {/* IQ Monete/Materiali Toggle: globale, off di default, colori Sigma */}
             <button
               onClick={() => setShowIqProdColumns(v => !v)}
               className={`flex h-7 w-7 items-center justify-center rounded border transition-all ${
                 showIqProdColumns
                   ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-sm"
                   : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
               }`}
               title={t("iqProdColumnsTitle", uiLang)}
             >
               <TableHeaderIcon src={iconIQProd} alt="" />
             </button>

              <button
                  onClick={() => setShowProdColumns(v => !v)}
                  className={`flex h-7 w-7 items-center justify-center rounded border transition-all text-[19px] leading-none ${
                    showProdColumns
                      ? "border-orange-500/50 bg-orange-500/15 text-orange-300 shadow-sm"
                      : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
                  }`}
                  title={showProdColumns ? t("prodColumnsShowTitle", uiLang) : t("prodColumnsHideTitle", uiLang)}
                >
                  📦
                </button>

              {showProdColumns && (
                <>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase whitespace-nowrap">{t("filterLabel", uiLang)}</span>
                  {([
                    { key: "mon", icon: <img src={iconMon} alt={t("prodCoins", uiLang)} className="icon-16" />, title: t("prodCoins", uiLang) },
                    { key: "mat", icon: <img src={iconMat} alt={t("prodMaterials", uiLang)} className="icon-16" />, title: t("prodMaterials", uiLang) },
                    { key: "fp", icon: <img src={iconFP} alt={t("prodForgePoints", uiLang)} className="icon-16" />, title: t("prodForgePoints", uiLang) },
                    { key: "fpb", icon: <img src={iconFPB} alt={t("prodForgePointsBoost", uiLang)} className="icon-16" />, title: t("prodForgePointsBoost", uiLang) },
                    { key: "fur", icon: <img src={iconFUR} alt={t("prodRogues", uiLang)} className="icon-16" />, title: t("prodRogues", uiLang) },
                    { key: "tr", icon: <img src={iconTR} alt={t("prodUnitsCurrentEra", uiLang)} className="icon-16" />, title: t("prodUnitsCurrentEra", uiLang) },
                    { key: "trne", icon: <img src={iconTRNE} alt={t("prodUnitsNextEra", uiLang)} className="icon-16" />, title: t("prodUnitsNextEra", uiLang) },
                    { key: "beni", icon: <img src={iconBeni} alt={t("prodGoodsCurrent", uiLang)} className="icon-16" />, title: t("prodGoodsCurrent", uiLang) },
                    { key: "benip", icon: <img src={iconBeniP} alt={t("prodGoodsPrevious", uiLang)} className="icon-16" />, title: t("prodGoodsPrevious", uiLang) },
                    { key: "benis", icon: <img src={iconBeniS} alt={t("prodGoodsNext", uiLang)} className="icon-16" />, title: t("prodGoodsNext", uiLang) },
                    { key: "benib", icon: <img src={iconBeniB} alt={t("prodGoodsBoost", uiLang)} className="icon-16" />, title: t("prodGoodsBoost", uiLang) },
                    { key: "benig", icon: <img src={iconBeniG} alt={t("prodGuildGoods", uiLang)} className="icon-16" />, title: t("prodGuildGoods", uiLang) },
                    { key: "bp", icon: <img src={iconBP} alt={t("prodBlueprints", uiLang)} className="icon-16" />, title: t("prodBlueprints", uiLang) },
                    { key: "fsp", icon: "⏳", title: t("prodRushSpecial", uiLang) },
                    { key: "tpm", icon: "🛠", title: t("prodRushMaterials", uiLang) },
                    { key: "tpb", icon: "📦", title: t("prodRushGoods", uiLang) },
                    { key: "adm", icon: <img src={iconAiuto} alt={t("prodMassAid", uiLang)} className="icon-16" />, title: t("prodMassAid", uiLang) },
                    { key: "mod", icon: <img src={iconOneUp} alt={t("prodOneUpKit", uiLang)} className="icon-16" />, title: t("prodOneUpKit", uiLang) },
                    { key: "rin", icon: <img src={iconRinn} alt={t("prodRenovationKit", uiLang)} className="icon-16" />, title: t("prodRenovationKit", uiLang) },
                    { key: "imm", icon: <img src={iconImm} alt={t("prodStoreBuilding", uiLang)} className="icon-16" />, title: t("prodStoreBuilding", uiLang) },
                  ] as Array<{ key: string; icon: React.ReactNode; title: string; iconClass?: string }>).map(({ key, icon, title, iconClass }) => {
                    const active = currentFilters.prodFilter.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleProdFilter(key)}
                        title={title}
                        className={`flex h-6 w-6 items-center justify-center rounded border text-sm transition-all ${
                          active
                            ? "border-orange-500/50 bg-orange-500/20 text-orange-300 shadow-sm"
                            : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        <span className={`text-sm ${iconClass ?? ""}`}>{icon}</span>
                      </button>
                    );
                  })}
                  <div className="flex items-center rounded border border-slate-700/50 bg-slate-900/40 p-0.5 text-[10px] font-bold">
                    <button
                      onClick={() => updateFilter("prodFilterMode", "AND")}
                      className={`px-1.5 py-0.5 rounded transition-all ${currentFilters.prodFilterMode === "AND" ? "bg-orange-500/20 text-orange-300" : "text-slate-400 hover:text-slate-300"}`}
                    >
                      AND
                    </button>
                    <button
                      onClick={() => updateFilter("prodFilterMode", "OR")}
                      className={`px-1.5 py-0.5 rounded transition-all ${currentFilters.prodFilterMode === "OR" ? "bg-orange-500/20 text-orange-300" : "text-slate-400 hover:text-slate-300"}`}
                    >
                      OR
                    </button>
                  </div>
                </>
              )}

           </section>

         </div>
       )}

      {activeTab === "alleati" && (
         <section className="flex flex-wrap items-center gap-1.5 px-2 pt-2 pb-1 text-xs">
           <div className="relative flex h-7 min-w-0 items-center rounded border border-slate-700/60 bg-slate-800/40 px-2.5 md:w-[130px] hover:border-slate-600 transition-colors">
             <Search size={13} className="absolute left-2.5 text-slate-500 shrink-0" />
             <input
               type="text"
               placeholder={t("searchPlaceholder", uiLang)}
               aria-label={t("searchInputLabel", uiLang)}
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-transparent pl-6 pr-1 text-xs text-slate-100 outline-none placeholder:text-slate-400"
             />
           </div>

          <button
            onClick={resetFilters}
            title={t("resetFiltersTitle", uiLang)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:bg-slate-700/40 hover:text-amber-400 hover:border-amber-500/40 transition-all"
          >
            <RotateCcw size={13} />
          </button>

          <div className="flex h-7 items-center gap-1.5 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400">{t("weightAtk", uiLang)}</span>
            <span className="font-mono text-xs font-bold text-red-400">1,0</span>
          </div>

          <div className="flex h-7 items-center gap-1.5 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400">{t("weightDef", uiLang)}</span>
            <div className="flex gap-0.5">
              {([0.8, 1.0] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setGeneralDefense(val)}
                  className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                    generalDefense === val ? "bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-sm" : "bg-slate-800/50 text-slate-400 hover:text-blue-300 border border-transparent hover:bg-slate-700"
                  }`}
                >
                  {val.toFixed(1).replace(".", ",")}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsEfficiencyHelpOpen(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-600 bg-slate-700/20 text-slate-400 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/50 transition-all font-bold text-xs"
            title={t("efficiencyHelpTitle", uiLang)}
          >
            ?
          </button>

          <div className="flex h-7 items-center gap-1 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400">{t("weightGbg", uiLang)}</span>
            <span className="font-mono text-xs font-bold text-red-400">{(1.0 - (spedizioniEnabled ? spedizioniAttack : 0)).toFixed(2).replace(".", ",")}</span>
            <span className="text-xs text-slate-600">/</span>
            <span className="font-mono text-xs font-bold text-blue-400">{(generalDefense * (1 - (spedizioniEnabled ? spedizioniAttack : 0))).toFixed(2).replace(".", ",")}</span>
          </div>

          {/* Pulsante Sigma - mostra colonne somma Gen+Campi (e Gen+Sped se SPED acceso) */}
          <button
            onClick={() => setShowSigmaColumns(v => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded border transition-all text-base font-bold leading-none ${
              showSigmaColumns
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-sm"
                : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
            }`}
            title={showSigmaColumns ? t("sigmaShowTitle", uiLang) : t("sigmaHideTitle", uiLang)}
          >
            Σ
          </button>

          <div className="flex h-7 items-center gap-1.5 rounded border border-slate-700/60 bg-slate-800/40 px-2.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400">{t("weightGe", uiLang)}</span>
            <button
              onClick={() => setSpedizioniEnabled(prev => !prev)}
              aria-label={t("spedizioniToggleLabel", uiLang)}
              role="switch"
              aria-checked={spedizioniEnabled}
              className={`relative w-7 h-3.5 rounded-full transition-colors shrink-0 ${
                spedizioniEnabled ? "bg-amber-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${
                  spedizioniEnabled ? "translate-x-3.5" : ""
                }`}
              />
            </button>
            {spedizioniEnabled && (
              <>
                <input
                  type="range"
                  aria-label={t("spedizioniAttackSliderLabel", uiLang)}
                  min="0"
                  max="1"
                  step="0.05"
                  value={spedizioniAttack}
                  onChange={(e) => setSpedizioniAttack(parseFloat(e.target.value))}
                  className="h-1 w-10 appearance-none rounded bg-slate-800 accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-xs font-bold text-amber-400">{spedizioniAttack.toFixed(2).replace(".", ",")}</span>
              </>
            )}
          </div>

          {Allies.RARITY_LEVELS.map((rarity) => {
            const active = allyRarityFilters[rarity];
            const d = Allies.RARITY_DISPLAY[rarity];
            return (
              <button
                key={rarity}
                onClick={() => toggleRarityFilter(rarity)}
                className={`flex h-7 items-center justify-center rounded border px-2 text-xs font-bold uppercase transition-all ${active ? d.badgeOn : d.badgeOff}`}
                title={active ? t("hideRarityTitle", uiLang, Allies.rarityName(rarity, uiLang)) : t("showRarityTitle", uiLang, Allies.rarityName(rarity, uiLang))}
              >
                {d.label}
              </button>
            );
          })}
        </section>
      )}

      <main className="flex-1 px-2 pt-1 pb-4 flex flex-col gap-4">

        <section className="flex-1 flex flex-col gap-2">
          
          {activeTab === "propria_citta" && cityEntityIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs">
              <>
                {portraitUrl ? (
                  <img
                    src={portraitUrl}
                    alt=""
                    className="h-7 w-7 rounded object-cover border border-amber-500/40 shrink-0"
                  />
                ) : (
                  <img
                    src="https://foezz.innogamescdn.com/assets/shared/avatars/portrait_unknown-9d9c1d859.jpg"
                    alt=""
                    className="h-7 w-7 rounded object-cover border border-slate-600/60 shrink-0 opacity-50"
                    title="Avatar non disponibile: stai usando una versione vecchia della bacchetta magica. Aggiorna il bookmarklet e reimporta i dati per vedere il tuo avatar."
                  />
                )}
                {currentEra && (
                  <span
                    className="flex items-center h-7 px-2.5 rounded border border-amber-500/30 bg-amber-500/8 text-amber-400/90 font-semibold cursor-default select-none whitespace-nowrap"
                    title={t("profileEraTitle", uiLang, ageName(currentEra, gameLang))}
                  >
                    {ageName(currentEra, gameLang)}
                  </span>
                )}
                <button
                  onClick={() => setIsDebugOpen((open) => !open)}
                  className={`flex items-center gap-1 rounded border px-2.5 py-1 font-semibold transition-all h-7 ${
                    isDebugOpen
                      ? "border-slate-500 bg-slate-700/40 text-slate-200"
                      : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  {t("debugLabel")}
                </button>
                <button
                  onClick={() => {
                    const entries: Array<{ id: string; name: string; count: number }> = [];
                    cityEntityIds.forEach((count, id) => {
                      if (!greatBuildingsJson.has(id)) {
                        entries.push({ id, name: displayName(id, id, gameLang), count });
                      }
                    });
                    downloadDebugList("city", entries);
                  }}
                  className="flex items-center justify-center rounded border border-slate-700 bg-slate-950/40 px-2.5 py-1 text-slate-400 hover:bg-slate-800/60 hover:text-slate-300 transition-all h-7"
                  title={t("downloadCityListTitle", uiLang)}
                >
                  <Download size={13} />
                </button>
                {cityMapBuildings.length > 0 && cityMapBounds && (
                  <button
                    onClick={() => {
                      const newVal = !showCityMap;
                      setShowCityMap(newVal);
                      localStorage.setItem(SHOW_CITY_MAP_KEY, String(newVal));
                    }}
                    className={`flex items-center gap-1 rounded border px-2.5 py-1 font-semibold transition-all h-7 ${
                      showCityMap
                        ? "border-slate-500 bg-slate-700/40 text-slate-200"
                        : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800/60"
                    }`}
                  >
                    MAP
                  </button>
                )}
                {outdatedBuildings.size > 0 && (
                  <button
                    onClick={() => setShowOnlyOutdated(v => !v)}
                    className={`flex items-center justify-center rounded border h-7 w-8 ${
                      showOnlyOutdated
                        ? "border-red-500 bg-red-950/40 text-red-300"
                        : "border-slate-700 bg-slate-950/40 hover:bg-slate-800/60"
                    }`}
                    title={t("showOnlyOldBuildingsTitle", uiLang)}
                  >
                    <svg viewBox="0 0 8 8" width="8" fill="#D35"><path d="M0 0l4 8 4-8H0z"/></svg>
                  </button>
                )}
                {declassableBuildings.size > 0 && (
                  <button
                    onClick={() => setShowOnlyDeclassable(v => !v)}
                    className={`flex items-center justify-center rounded border h-7 w-8 ${
                      showOnlyDeclassable
                        ? "border-green-500 bg-green-950/40 text-green-300"
                        : "border-slate-700 bg-slate-950/40 hover:bg-slate-800/60"
                    }`}
                    title={t("showOnlyDeclassableTitle", uiLang)}
                  >
                    <svg viewBox="0 0 8 8" width="8" fill="#2a6"><path d="M0 0l4 8 4-8H0z"/></svg>
                  </button>
                )}
                <button
                  onClick={() => setShowOnlyWithAllySlot(v => !v)}
                  className={`flex items-center justify-center rounded border h-7 w-8 ${
                    showOnlyWithAllySlot
                      ? "border-amber-500 bg-amber-950/40 text-amber-300"
                      : "border-slate-700 bg-slate-950/40 hover:bg-slate-800/60"
                  }`}
                  title={t("showOnlyWithAllySlotTitle", uiLang)}
                >
                  <img src={allies_slot_full} alt="" className="h-5 w-5 object-contain" />
                </button>
                <button
                  onClick={() => setIsCityUpgradeableOpen(true)}
                  className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950/40 px-2.5 py-1 font-semibold text-slate-300 hover:bg-slate-800/60 transition-all h-7"
                >
                  {t("upgradableBuildingsButton", uiLang)}
                </button>
                {renderProdSummary()}

                <span className="text-xs font-semibold text-slate-300 uppercase whitespace-nowrap">{t("hideBuildingsLabel", uiLang)}</span>
                <button
                  onClick={() => updateFilter("showIncursionBuildings", !currentFilters.showIncursionBuildings)}
                  className={`flex h-7 w-7 items-center justify-center rounded border transition-all text-xs ${
                    currentFilters.showIncursionBuildings
                      ? "border-blue-500/50 bg-blue-500/15 text-blue-300 shadow-sm"
                      : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
                  }`}
                  title={currentFilters.showIncursionBuildings ? t("showQiUsefulTitle", uiLang) : t("hideQiUsefulTitle", uiLang)}
                >
                  ✊🏾
                </button>
                <button
                  onClick={() => updateFilter("showAllyBuildings", !currentFilters.showAllyBuildings)}
                  className={`flex h-7 w-7 items-center justify-center rounded border transition-all text-xs ${
                    currentFilters.showAllyBuildings
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-sm"
                      : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
                  }`}
                  title={currentFilters.showAllyBuildings ? t("hideHistoricalAllyBuildingsTitle", uiLang) : t("showHistoricalAllyBuildingsTitle", uiLang)}
                >
                  ⭐
                </button>
                <button
                  onClick={() => updateFilter("showMassAidBuildings", !currentFilters.showMassAidBuildings)}
                  className={`flex h-7 w-7 items-center justify-center rounded border transition-all text-xs ${
                    currentFilters.showMassAidBuildings
                      ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-300 shadow-sm"
                      : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
                  }`}
                  title={currentFilters.showMassAidBuildings ? t("hideMassAidBuildingsTitle", uiLang) : t("showMassAidBuildingsTitle", uiLang)}
                >
                  <img src={iconAiuto} alt={t("prodMassAid", uiLang)} className="icon-16" />
                </button>
                <button
                  onClick={() => updateFilter("showStoreBuildingBuildings", !currentFilters.showStoreBuildingBuildings)}
                  className={`flex h-7 w-7 items-center justify-center rounded border transition-all text-xs ${
                    currentFilters.showStoreBuildingBuildings
                      ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-300 shadow-sm"
                      : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
                  }`}
                  title={currentFilters.showStoreBuildingBuildings ? t("hideStoreBuildingBuildingsTitle", uiLang) : t("showStoreBuildingBuildingsTitle", uiLang)}
                >
                  <img src={iconImm} alt={t("prodStoreBuilding", uiLang)} className="icon-16" />
                </button>
                <button
                  onClick={() => updateFilter("showGreatBuildings", !currentFilters.showGreatBuildings)}
                  className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-bold transition-all ${
                    currentFilters.showGreatBuildings
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-sm"
                      : "border-slate-700/50 bg-slate-700/20 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40"
                  }`}
                  title={currentFilters.showGreatBuildings ? t("hideGreatBuildingsTitle", uiLang) : t("showGreatBuildingsTitle", uiLang)}
                >
                  {t("greatBuildingBadge", uiLang)}
                </button>
              </>
              {isDebugOpen && (
                <div className="w-full mt-2">
                    <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-emerald-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-emerald-400">
                        {t("debugMatchedBuildings", uiLang).toUpperCase()} ({matchedCityEntityIds.length})
                      </span>
                      <div className="max-h-60 overflow-y-auto px-3 pb-2 text-xs font-mono text-slate-300">
                        {matchedCityEntityIds.length === 0 ? "-" : matchedCityEntityIds.map((id, i) => (
                          <div key={id} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: id, rawEntry: matchedJson.get(id) })} className="text-left hover:underline text-slate-300">
                              {displayName(id, id, gameLang)}<DebugQtyBadge qty={cityEntityIds.get(id) ?? 1} colorClass="text-emerald-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-amber-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-amber-400">
                        {t("debugGreatBuildings", uiLang).toUpperCase()} ({greatBuildingIds.length})
                      </span>
                      <div className="max-h-60 overflow-y-auto px-3 pb-2 text-xs font-mono text-slate-300">
                        {greatBuildingsJson.size === 0 ? "-" : Array.from(greatBuildingsJson.values()).map((gb, i) => (
                          <div key={gb.entityId} className={i > 0 ? "mt-1" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: gb.entityId, rawEntry: gb.rawEntry })} className="text-left hover:underline text-slate-300">
                              {displayName(gb.entityId, gb.entityId, gameLang)} - Lv. {gb.level}/{gb.maxLevel}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-red-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-red-400">
                        {t("debugUnmatchedBuildings", uiLang).toUpperCase()} ({unmatchedCityEntityIds.length})
                      </span>
                      <div className="max-h-60 overflow-y-auto px-3 pb-2 text-xs font-mono text-slate-300">
                        {unmatchedCityEntityIds.length === 0 ? "-" : unmatchedCityEntityIds.map((id, i) => (
                          <div key={id} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: id, rawEntry: unmatchedJson.get(id) })} className="text-left hover:underline text-slate-300">
                              {displayName(id, fallbackBuildings.get(id)?.name ?? id, gameLang)}<DebugQtyBadge qty={cityEntityIds.get(id) ?? 1} colorClass="text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "inventario" && inventoryMatched.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs">
              {currentEra && (
                <span
                  className="flex items-center h-7 px-2.5 rounded border border-amber-500/30 bg-amber-500/8 text-amber-400/90 font-semibold cursor-default select-none whitespace-nowrap"
                  title={t("profileEraTitle", uiLang, ageName(currentEra, gameLang))}
                >
                  {ageName(currentEra, gameLang)}
                </span>
              )}
              <button
                onClick={() => setIsInventoryDebugOpen(open => !open)}
                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950/40 px-2.5 py-1 font-semibold text-slate-300 hover:bg-slate-800/60 transition-all h-7"
              >
                Debug
              </button>
              <button
                onClick={() => {
                  const all = [
                    ...Array.from(inventoryMatched.values()),
                    ...Array.from(inventoryUnmatched.values()),
                    ...Array.from(inventorySelectionKits.values()).map(k => ({ cityEntityId: k.kitId, name: k.name, inStock: k.inStock })),
                    ...Array.from(inventoryUpgradeKits.values()).map(k => ({ cityEntityId: k.kitId, name: k.name, inStock: k.inStock })),
                  ];
                  downloadDebugList("all-inventory", all.map(e => ({ id: e.cityEntityId, name: e.name, count: e.inStock })));
                }}
                className="flex items-center justify-center rounded border border-slate-700 bg-slate-950/40 px-2.5 py-1 text-slate-400 hover:bg-slate-800/60 hover:text-slate-300 transition-all h-7"
                title={t("downloadInventoryListTitle", uiLang)}
              >
                <Download size={13} />
              </button>
              <button
                onClick={() => setShowOnlyReadyBuildings(v => !v)}
                className={`flex items-center gap-1 rounded border px-2.5 py-1 font-semibold transition-all h-7 ${
                  showOnlyReadyBuildings
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-slate-700 bg-slate-950/40 text-slate-300 hover:bg-slate-800/60"
                }`}
                title={t("onlyReadyBuildingsTitle", uiLang)}
              >
                {t("onlyReadyBuildings", uiLang).toUpperCase()}
              </button>
              {isInventoryDebugOpen && (() => {
                const allSelectionKits = Array.from(inventorySelectionKits.values());

                return (
                <div className="w-full mt-2">
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-emerald-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-emerald-400">
                        {t("debugMatchedBuildings", uiLang).toUpperCase()} ({inventoryMatched.size})
                      </span>
                      <div className="max-h-60 overflow-y-auto px-3 pb-2 text-xs font-mono text-slate-300">
                        {Array.from(inventoryMatched.values())
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((e, i) => (
                          <div key={e.cityEntityId} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: e.cityEntityId, rawEntry: { cityEntityId: e.cityEntityId, name: e.name, inStock: e.inStock, ...(e.rawEntry ?? {}) } })} className="text-left hover:underline text-slate-300">
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
                      <div className="max-h-60 overflow-y-auto px-3 pb-2 text-xs font-mono text-slate-300">
                        {inventoryUnmatched.size === 0 ? "-" : Array.from(inventoryUnmatched.values())
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((e, i) => (
                          <div key={e.cityEntityId} className={i > 0 ? "mt-0.5" : ""}>
                            <button onClick={() => setSelectedJsonEntry({ title: e.cityEntityId, rawEntry: { cityEntityId: e.cityEntityId, name: e.name, inStock: e.inStock, ...(e.rawEntry ?? {}) } })} className="text-left hover:underline text-slate-300">
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
                      <div className="max-h-60 overflow-y-auto px-3 pb-2 text-xs font-mono text-slate-300">
                        {(() => {
                          if (allSelectionKits.length === 0) return "-";
                          const categorized = allSelectionKits.map(e => ({ ...e, simplified: e.name, tier: kitTier(e.kitId) }));
                          const platino = categorized.filter(e => e.tier === "platinum").sort((a, b) => a.simplified.localeCompare(b.simplified));
                          const oro = categorized.filter(e => e.tier === "gold").sort((a, b) => a.simplified.localeCompare(b.simplified));
                          const argento = categorized.filter(e => e.tier === "silver").sort((a, b) => a.simplified.localeCompare(b.simplified));
                          const normali = categorized.filter(e => e.tier === "normal").sort((a, b) => a.simplified.localeCompare(b.simplified));

                          const categoryColor = (tier: string) => {
                            if (tier === "platinum") return "text-cyan-300";
                            if (tier === "gold") return "text-amber-300";
                            if (tier === "silver") return "text-slate-300";
                            return "text-violet-300";
                          };

                          const renderGroup = (tier: string, label: string, items: typeof categorized) => (
                            items.length > 0 && (
                              <div className="mb-2">
                                <div className={`mb-1 text-[11px] font-bold uppercase tracking-wide border-b border-slate-800/50 ${categoryColor(tier)}`}>{label}</div>
                                {items.map(e => (
                                  <div key={e.kitId} className="mt-0.5">
                                    <button onClick={() => setSelectedJsonEntry({ title: e.kitId, rawEntry: e.rawEntry })} className="text-left hover:underline text-slate-300">
                                      {e.simplified}<DebugQtyBadge qty={e.inStock} colorClass="text-violet-400" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )
                          );

                          return (
                            <>
                              {renderGroup("platinum", t("tierPlatinum", uiLang).toUpperCase(), platino)}
                              {renderGroup("gold", t("tierGold", uiLang).toUpperCase(), oro)}
                              {renderGroup("silver", t("tierSilver", uiLang).toUpperCase(), argento)}
                              {renderGroup("normal", t("tierNormal", uiLang).toUpperCase(), normali)}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-lg bg-slate-950 border border-sky-500/20">
                      <span className="px-3 pt-2 pb-1 text-xs font-bold text-sky-400">
                        {t("debugUpgradeKits", uiLang).toUpperCase()} ({inventoryUpgradeKits.size})
                      </span>
                      <div className="max-h-60 overflow-y-auto px-3 pb-2 text-xs font-mono text-slate-300">
                        {(() => {
                          if (inventoryUpgradeKits.size === 0) return "-";
                          const categorized = Array.from(inventoryUpgradeKits.values()).map(e => ({ ...e, simplified: e.name, tier: kitTier(e.kitId) }));
                          const platino = categorized.filter(e => e.tier === "platinum").sort((a, b) => a.simplified.localeCompare(b.simplified));
                          const oro = categorized.filter(e => e.tier === "gold").sort((a, b) => a.simplified.localeCompare(b.simplified));
                          const argento = categorized.filter(e => e.tier === "silver").sort((a, b) => a.simplified.localeCompare(b.simplified));
                          const normali = categorized.filter(e => e.tier === "normal").sort((a, b) => a.simplified.localeCompare(b.simplified));

                          const categoryColor = (tier: string) => {
                            if (tier === "platinum") return "text-cyan-300";
                            if (tier === "gold") return "text-amber-300";
                            if (tier === "silver") return "text-slate-300";
                            return "text-violet-300";
                          };

                          const renderGroup = (tier: string, label: string, items: typeof categorized) => (
                            items.length > 0 && (
                              <div className="mb-2">
                                <div className={`mb-1 text-[11px] font-bold uppercase tracking-wide border-b border-slate-800/50 ${categoryColor(tier)}`}>{label}</div>
                                {items.map(e => (
                                  <div key={e.kitId} className="mt-0.5">
                                    <button onClick={() => setSelectedJsonEntry({ title: e.kitId, rawEntry: e.rawEntry })} className="text-left hover:underline text-slate-300">
                                      {e.simplified}<DebugQtyBadge qty={e.inStock} colorClass="text-sky-400" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )
                          );

                          return (
                            <>
                              {renderGroup("platinum", t("tierPlatinum", uiLang).toUpperCase(), platino)}
                              {renderGroup("gold", t("tierGold", uiLang).toUpperCase(), oro)}
                              {renderGroup("silver", t("tierSilver", uiLang).toUpperCase(), argento)}
                              {renderGroup("normal", t("tierNormal", uiLang).toUpperCase(), normali)}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          {activeTab === "propria_citta" && showCityMap && (
            <CityMapView
              cityMapBuildings={cityMapBuildings}
              cityMapBounds={cityMapBounds}
              cityMapUnlockedCells={cityMapUnlockedCells}
              cityMapGrid={cityMapGrid}
              highlightedCityEntityIds={highlightedCityEntityIds}
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
                setImagePopup(prev => {
                  // Stesso edificio (mouse che si muove dentro lo stesso
                  // rettangolo): aggiorna solo la posizione, evita di
                  // rifare lookup + getImageUrl ad ogni mousemove.
                  if (prev && prev.name === name) {
                    return { ...prev, x: clientX + 16, y: clientY };
                  }
                  const b = BUILDING_BY_ID.get(entityId);
                  const url = b ? getImageUrl(b.cityEntityId, b.hash) : null;
                  if (!url) return null;
                  return { x: clientX + 16, y: clientY, url, name, id: entityId };
                });
              }}
              onBuildingLeave={scheduleImagePopupClose}
              onBuildingClick={handleMapBuildingClick}
              uiLang={uiLang}
            />
          )}

          {(activeTab === "database" || activeTab === "propria_citta" || activeTab === "inventario") && (
            <>
              <div ref={buildingTableWrapperRef} className="bg-slate-900/20 border border-slate-800/80 rounded overflow-hidden">
                <div
                  ref={buildingTableScrollRef}
                  onScroll={() => syncBuildingTableScroll("table")}
                  className="overflow-x-auto"
                >
                  <table className="building-table w-full table-fixed text-left border-collapse" style={{ minWidth: tableMinWidth }}>
                    <colgroup>
                      <col className="w-[32px]" />
                      <col className="w-[28px]" />
                      <col className="w-full min-w-[240px]" />
                      {currentFilters.showTimeColumn && <col className="w-[50px]" />}
                      <col className="w-[32px]" />
                      <col className="w-[50px]" />
                      <col className="w-[48px]" />
                      <col className="w-[44px]" />
                      {showPopColumn && <col className="w-[76px]" />}
                      {showFelColumn && <col className="w-[76px]" />}
                       {!showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`gen-${i}`} className="w-[42px]" />)}
                       {!showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`gbg-${i}`} className="w-[42px]" />)}
                       {showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`sig-gc-${i}`} className="w-[42px]" />)}
                       {!showSigmaColumns && spedizioniEnabled && Array.from({ length: 4 }).map((_, i) => <col key={`sped-${i}`} className="w-[42px]" />)}
                       {showSigmaColumns && spedizioniEnabled && Array.from({ length: 4 }).map((_, i) => <col key={`sig-gs-${i}`} className="w-[42px]" />)}
                       {Array.from({ length: 4 }).map((_, i) => <col key={`iq-ad-${i}`} className="w-[42px]" />)}
                       {showIqProdColumns && Array.from({ length: 4 }).map((_, i) => <col key={`iq-mm-${i}`} className="w-[42px]" />)}
                       {Array.from({ length: 3 }).map((_, i) => <col key={`iq-extra-${i}`} className="w-[42px]" />)}
                       <col className="w-[42px]" />
                       {showProdColumns && Array.from({ length: 20 }).map((_, i) => <col key={`prod-${i}`} className="w-[36px]" />)}
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-900/80 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <th className="py-1 px-2 text-center" colSpan={2}>
                          <button
                            onClick={exportSelectedAsCsv}
                            disabled={selectedIds.size === 0}
                            title={selectedIds.size === 0 ? "Seleziona almeno un edificio" : `Esporta ${selectedIds.size} edifici in CSV`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Download size={11} />
                            Export
                            {selectedIds.size > 0 && <span className="ml-0.5 text-amber-400">({selectedIds.size})</span>}
                          </button>
                        </th>
                        <th className="py-2 px-2 text-center font-normal text-xs text-slate-400 italic">
                          {t("buildingsVisualizedCount", uiLang)}: <span className="font-bold text-slate-300">{filteredBuildings.length}</span>/<span className="text-slate-400">{activeTab === "propria_citta" ? cityEntityIds.size : activeTab === "inventario" ? processedInventoryKitBuildings.length : processedBuildings.length}</span>{activeTab === "propria_citta" && totalCityEntityInstances > cityEntityIds.size}
                        </th>
                        <th className="py-2 px-0 border-l border-slate-800" colSpan={4 + (currentFilters.showTimeColumn ? 1 : 0) + (showPopColumn ? 1 : 0) + (showFelColumn ? 1 : 0)}>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                            <div style={{ minWidth: `calc(${currentFilters.showTimeColumn ? '50px' : '0px'} + 32px)` }} />
                            <input
                              type="text"
                              value={currentFilters.minEff}
                              onChange={(e) => updateFilter("minEff", e.target.value)}
                              aria-label={t("minEffInputLabel", uiLang)}
                              className="w-12 h-5 rounded border border-slate-700 bg-slate-900/80 px-1 text-center font-mono text-[11px] text-amber-400 outline-none focus:border-amber-500"
                            />
                            <span>min EFF</span>
                          </div>
                        </th>
                        {renderMilitaryGroupHeaders()}
                        <th className="py-2 px-2 text-center section-divider text-blue-400/80" colSpan={showIqProdColumns ? 12 : 8}>{t("groupIq", uiLang)}</th>
                        {showProdColumns && (
                          <th className="text-center section-divider text-orange-400/80" colSpan={20}>{t("groupProductions", uiLang)}</th>
                        )}
                      </tr>
                      <tr className="bg-slate-900/60 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <th className="py-0.5 px-1 w-[32px] text-center">
                          <input
                            type="checkbox"
                            checked={filteredBuildings.length > 0 && filteredBuildings.every(b => selectedIds.has(b.id))}
                            onChange={toggleSelectAll}
                            title={t("selectAllTitle", uiLang)}
                            aria-label={t("selectAllTitle", uiLang)}
                            className="accent-amber-500 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-slate-900 focus:ring-offset-slate-950 cursor-pointer h-3 w-3 relative -top-[-1px]"
                          />
                        </th>
                        <th className="py-0.5 px-1 text-center w-[28px]"></th>
                        <SortableHeader label={t("colBuilding", uiLang)} sortKey="name" onClick={() => handleSort("name")} active={sortBy === "name"} order={sortOrder} className="py-0.5 px-2 w-full min-w-[240px] text-left" />
                        
                        {currentFilters.showTimeColumn && (
                          <th className="py-0.5 px-1 text-center text-amber-400/80 border-l border-slate-800 w-[50px] text-xl">⏱</th>
                        )}
                        <th className={`py-0.5 px-1 text-center w-[32px] ${currentFilters.showTimeColumn ? "" : "border-l border-slate-800"}`}>❔</th>
                        <SortableHeader label="Eff" sortKey="eff" onClick={() => handleSort("eff")} active={sortBy === "eff"} order={sortOrder} className="th-eff" />
                        <SortableHeader label={<TableHeaderIcon src={iconSize} alt={t("colSize", uiLang)} />} sortKey="size" onClick={() => handleSort("size")} active={sortBy === "size"} order={sortOrder} className="pt-1 pb-0 px-1.5 text-center w-[48px]" title={t("colSize", uiLang)} />
                        <SortableHeader label={<TableHeaderIcon src={iconRoad} alt={t("colRoad", uiLang)} />} sortKey="road" onClick={() => handleSort("road")} active={sortBy === "road"} order={sortOrder} className="pt-1 pb-0 px-1.5 text-center w-[44px]" title={t("colRoad", uiLang)} />
                        {showPopColumn && (
                          <SortableHeader label={<TableHeaderIcon src={iconPop} alt={t("colPop", uiLang)} />} sortKey="pop" onClick={() => handleSort("pop")} active={sortBy === "pop"} order={sortOrder} className="pt-1 pb-0 px-1.5 text-center w-[76px]" title={t("colPop", uiLang)} />
                        )}
                        {showFelColumn && (
                          <SortableHeader label={<TableHeaderIcon src={iconFel} alt={t("colFel", uiLang)} />} sortKey="fel" onClick={() => handleSort("fel")} active={sortBy === "fel"} order={sortOrder} className="pt-1 pb-0 px-1.5 text-center w-[76px]" title={t("colFel", uiLang)} />
                        )}
                        
                        {renderMilitaryHeaders()}

                        <SortableHeader label={<TableHeaderIcon src={iconIQAtkA} alt={boostTitle(uiLang, "atk", "red", t("sectionQi", uiLang))} />} sortKey="iq_atk_a" onClick={() => handleSort("iq_atk_a")} active={sortBy === "iq_atk_a"} order={sortOrder} className="th-col section-divider" title={boostTitle(uiLang, "atk", "red", t("sectionQi", uiLang))} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQDefA} alt={boostTitle(uiLang, "def", "red", t("sectionQi", uiLang))} />} sortKey="iq_def_a" onClick={() => handleSort("iq_def_a")} active={sortBy === "iq_def_a"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "red", t("sectionQi", uiLang))} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQAtkD} alt={boostTitle(uiLang, "atk", "blue", t("sectionQi", uiLang))} />} sortKey="iq_atk_d" onClick={() => handleSort("iq_atk_d")} active={sortBy === "iq_atk_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "atk", "blue", t("sectionQi", uiLang))} />
                        <SortableHeader label={<TableHeaderIcon src={iconIQDefD} alt={boostTitle(uiLang, "def", "blue", t("sectionQi", uiLang))} />} sortKey="iq_def_d" onClick={() => handleSort("iq_def_d")} active={sortBy === "iq_def_d"} order={sortOrder} className="th-col" title={boostTitle(uiLang, "def", "blue", t("sectionQi", uiLang))} />
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
                        {showProdColumns && (
                          <>
                            <SortableHeader label={<TableHeaderIcon src={iconMon} alt={t("prodCoins", uiLang)} />} sortKey="mon" onClick={() => handleSort("mon")} active={sortBy === "mon"} order={sortOrder} className="th-col section-divider" title={t("prodCoins", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconMat} alt={t("prodMaterials", uiLang)} />} sortKey="mat" onClick={() => handleSort("mat")} active={sortBy === "mat"} order={sortOrder} className="th-col" title={t("prodMaterials", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconFP} alt={t("prodForgePoints", uiLang)} />} sortKey="fp" onClick={() => handleSort("fp")} active={sortBy === "fp"} order={sortOrder} className="th-col" title={t("prodForgePoints", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconFPB} alt={t("prodForgePointsBoost", uiLang)} />} sortKey="fpb" onClick={() => handleSort("fpb")} active={sortBy === "fpb"} order={sortOrder} className="th-col" title={t("prodForgePointsBoost", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconFUR} alt={t("prodRogues", uiLang)} />} sortKey="fur" onClick={() => handleSort("fur")} active={sortBy === "fur"} order={sortOrder} className="th-col" title={t("prodRogues", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconTR} alt={t("prodUnitsCurrentEra", uiLang)} />} sortKey="tr" onClick={() => handleSort("tr")} active={sortBy === "tr"} order={sortOrder} className="th-col" title={t("prodUnitsCurrentEra", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconTRNE} alt={t("prodUnitsNextEra", uiLang)} />} sortKey="trne" onClick={() => handleSort("trne")} active={sortBy === "trne"} order={sortOrder} className="th-col" title={t("prodUnitsNextEra", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconBeni} alt={t("prodGoodsCurrent", uiLang)} />} sortKey="beni" onClick={() => handleSort("beni")} active={sortBy === "beni"} order={sortOrder} className="th-col" title={t("prodGoodsCurrent", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconBeniP} alt={t("prodGoodsPrevious", uiLang)} />} sortKey="benip" onClick={() => handleSort("benip")} active={sortBy === "benip"} order={sortOrder} className="th-col" title={t("prodGoodsPrevious", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconBeniS} alt={t("prodGoodsNext", uiLang)} />} sortKey="benis" onClick={() => handleSort("benis")} active={sortBy === "benis"} order={sortOrder} className="th-col" title={t("prodGoodsNext", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconBeniB} alt={t("prodGoodsBoost", uiLang)} />} sortKey="benib" onClick={() => handleSort("benib")} active={sortBy === "benib"} order={sortOrder} className="th-col" title={t("prodGoodsBoost", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconBeniG} alt={t("prodGuildGoods", uiLang)} />} sortKey="benig" onClick={() => handleSort("benig")} active={sortBy === "benig"} order={sortOrder} className="th-col" title={t("prodGuildGoods", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconBP} alt={t("prodBlueprints", uiLang)} />} sortKey="bp" onClick={() => handleSort("bp")} active={sortBy === "bp"} order={sortOrder} className="th-col" title={t("prodBlueprints", uiLang)} />
                            <SortableHeader label="⏳" sortKey="fsp" onClick={() => handleSort("fsp")} active={sortBy === "fsp"} order={sortOrder} className="th-col text-sm" title={t("prodRushSpecial", uiLang)} />
                            <SortableHeader label="🛠" sortKey="tpm" onClick={() => handleSort("tpm")} active={sortBy === "tpm"} order={sortOrder} className="th-col text-sm" title={t("prodRushMaterials", uiLang)} />
                            <SortableHeader label="📦" sortKey="tpb" onClick={() => handleSort("tpb")} active={sortBy === "tpb"} order={sortOrder} className="th-col text-sm" title={t("prodRushGoods", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconAiuto} alt={t("prodMassAid", uiLang)} />} sortKey="adm" onClick={() => handleSort("adm")} active={sortBy === "adm"} order={sortOrder} className="th-col text-sm" title={t("prodMassAid", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconOneUp} alt={t("prodOneUpKit", uiLang)} />} sortKey="mod" onClick={() => handleSort("mod")} active={sortBy === "mod"} order={sortOrder} className="th-col text-sm" title={t("prodOneUpKit", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconRinn} alt={t("prodRenovationKit", uiLang)} />} sortKey="rin" onClick={() => handleSort("rin")} active={sortBy === "rin"} order={sortOrder} className="th-col text-sm" title={t("prodRenovationKit", uiLang)} />
                            <SortableHeader label={<TableHeaderIcon src={iconImm} alt={t("prodStoreBuilding", uiLang)} />} sortKey="imm" onClick={() => handleSort("imm")} active={sortBy === "imm"} order={sortOrder} className="th-col text-sm" title={t("prodStoreBuilding", uiLang)} />
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
                      {filteredBuildings.map((b) => (
                        <BuildingRow
                          key={b.id}
                          b={b}
                          activeTab={activeTab}
                          uiLang={uiLang}
                          gameLang={gameLang}
                          currentEraId={currentEraId}
                          currentFilters={currentFilters}
                          showSigmaColumns={showSigmaColumns}
                          spedizioniEnabled={spedizioniEnabled}
                          showPopColumn={showPopColumn}
                          showFelColumn={showFelColumn}
                          showIqProdColumns={showIqProdColumns}
                          showProdColumns={showProdColumns}
                          specialKits={specialKits}
                          DIFF_FIELDS={DIFF_FIELDS}
                          isSelected={selectedIds.has(b.id)}
                          isHighlighted={highlightedCityEntityIds.has(b.cityEntityId)}
                          disconnectedCount={cityEntityDisconnected.get(b.cityEntityId) ?? 0}
                          needlessCount={cityEntityNeedlessCount.get(b.cityEntityId) ?? 0}
                          importedCount={importedCityEntityLookup.get(b.cityEntityId) ?? 0}
                          greatBuildingInfo={greatBuildingsJson.get(b.cityEntityId)}
                          gameDisplayName={gameNames.get(b.cityEntityId)}
                          upgradeBadge={cityUpgradeBadges.get(b.cityEntityId)}
                          isOutdated={outdatedBuildings.has(b.cityEntityId)}
                          isDeclassable={declassableBuildings.has(b.cityEntityId)}
                          allySlots={allySlotsPerBuilding.get(b.cityEntityId)}
                          declassablePopData={declassableBuildings.get(b.cityEntityId)}
                          setDeclassableTooltip={setDeclassableTooltip}
                          minLevel={entityLevels.get(b.cityEntityId) ?? -1}
                          allLevelsForEntity={entityLevelsList.get(b.cityEntityId)}
                          instanceEraStats={entityInstanceEraStats.get(b.cityEntityId) ?? []}
                          fragmentProducers={FRAGMENT_BUILDING_PRODUCERS.get(b.cityEntityId) ?? []}
                          fragmentSelectionKits={SELECTION_KITS_BY_UPGRADE.get(b.cityEntityId) ?? []}
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
 
                      {filteredBuildings.length === 0 && (
                        <tr>
                          <td colSpan={27 - (showSigmaColumns ? 4 : 0) - (showIqProdColumns ? 0 : 4) + (currentFilters.showTimeColumn ? 1 : 0) + (showPopColumn ? 1 : 0) + (showFelColumn ? 1 : 0) + (spedizioniEnabled ? 4 : 0) + (showProdColumns ? 20 : 0)} className="text-center py-12 text-slate-400 font-semibold">
                            Nessun edificio trovato.
                          </td>
                        </tr>
                      )}
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
                      onScroll={() => syncBuildingTableScroll("floating")}
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
            {/* Tabella alleati importati */}
            {processedImportedAllies.length > 0 && (
              <div className="bg-slate-900/20 border border-slate-800/80 rounded overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="building-table w-full table-fixed text-left border-collapse" style={{ minWidth: alliesTableMinWidth }}>
                    <colgroup>
                      <col className="w-full min-w-[240px]" />
                      <col className="w-[64px]" />
                      <col className="w-[50px]" />
                      <col className="w-[50px]" />
                      {!showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`gen-${i}`} className="w-[42px]" />)}
                      {Array.from({ length: 4 }).map((_, i) => <col key={`gbg-${i}`} className="w-[42px]" />)}
                      {spedizioniEnabled && Array.from({ length: 4 }).map((_, i) => <col key={`sped-${i}`} className="w-[42px]" />)}
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-900/80 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <th className="py-2 px-2 text-center cursor-pointer hover:text-slate-300 transition-colors" colSpan={4} onClick={() => setIsMyAlliesTableOpen(v => !v)}>
                          {(() => {
                            const placed = processedImportedAllies.filter(a => a.isPlaced).length;
                            const inventory = processedImportedAllies.filter(a => !a.isPlaced && !a.isFragment).length;
                            const fragments = processedImportedAllies.filter(a => a.isFragment).length;
                            return (
                              <>
                                <span className="mr-2">{isMyAlliesTableOpen ? "▼" : "▶"}</span>
                                {t("ownedAlliesCount", uiLang)}: <span className="font-bold text-slate-100">{processedImportedAllies.length}</span>
                                <span className="text-slate-400"> (</span>
                                <span className="font-bold text-emerald-300">{placed}</span>
                                <span className="text-slate-400"> {t("alliesPlacedInCity", uiLang)} </span>
                                <span className="font-bold text-red-400">{inventory}</span>
                                <span className="text-slate-400"> {t("alliesInInventory", uiLang)} </span>
                                <span className="font-bold text-amber-400">{fragments}</span>
                                <span className="text-slate-400"> {t("alliesFragmented", uiLang)}</span>
                              </>
                            );
                          })()}
                        </th>
                        {renderMilitaryGroupHeaders()}
                      </tr>
                      <tr className="bg-slate-900/60 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <SortableHeader label={t("colAlly", uiLang)} sortKey="name" onClick={() => handleSort("name")} active={sortBy === "name"} order={sortOrder} className="py-0.5 px-2 w-full min-w-[240px] text-left" />
                        <SortableHeader label="Lvl" sortKey="ally_level" onClick={() => handleSort("ally_level")} active={sortBy === "ally_level"} order={sortOrder} className="py-0.5 px-1 text-center w-[64px]" title={t("allyLevelTitle", uiLang)} />
                        <th className="py-0.5 px-1 text-center w-[50px]" title={t("ally1stLevelValueTitle", uiLang)}>lv1</th>
                        <SortableHeader label="Eff" sortKey="eff" onClick={() => handleSort("eff")} active={sortBy === "eff"} order={sortOrder} className="th-eff" />
                        {renderMilitaryHeaders()}
                      </tr>
                    </thead>
                    {isMyAlliesTableOpen && (
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
                                  setImagePopup({ x: r.right, y: r.top, url: getImageUrl(entityId, building?.hash ?? "") ?? "", name: bName, id: entityId, subtitle: t("allyPlacedTitle", uiLang) });
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
                          </td>
                          <td className="cell-num w-[50px] text-slate-300">
                            {formatDecimal(a.val1, 2)}
                          </td>
                          <td className="cell-eff">
                            <span className="text-amber-400 text-sm">{formatEff(a.currentEff)}</span>
                          </td>
                          <MilitaryBoostCells general={a.computedGeneral} gbg={a.computedGbg} sped={a.computedSped} showSigmaColumns={showSigmaColumns} spedizioniEnabled={spedizioniEnabled} />
                        </tr>
                      ))}
                    </tbody>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* Tabella database alleati completo */}
            <div ref={buildingTableWrapperRef} className="bg-slate-900/20 border border-slate-800/80 rounded overflow-hidden">
              <div
                ref={buildingTableScrollRef}
                onScroll={() => syncBuildingTableScroll("table")}
                className="overflow-x-auto"
              >
              <table className="building-table w-full table-fixed text-left border-collapse" style={{ minWidth: alliesTableMinWidth }}>
                  <colgroup>
                    <col className="w-full min-w-[240px]" />
                    <col className="w-[50px]" />
                    <col className="w-[50px]" />
                    {!showSigmaColumns && Array.from({ length: 4 }).map((_, i) => <col key={`gen-${i}`} className="w-[42px]" />)}
                    {Array.from({ length: 4 }).map((_, i) => <col key={`gbg-${i}`} className="w-[42px]" />)}
                    {spedizioniEnabled && Array.from({ length: 4 }).map((_, i) => <col key={`sped-${i}`} className="w-[42px]" />)}
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-900/80 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      <th className="py-2 px-2 text-center" colSpan={3}>
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-slate-400 uppercase tracking-wider">{t("calcEfficiencyAtLevel", uiLang)}</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={globalAllyLevel}
                            onChange={(e) => setGlobalAllyLevel(Number(e.target.value))}
                            className="w-14 h-7 rounded border border-slate-700 bg-slate-950/80 px-1 text-center font-mono text-sm text-amber-400 outline-none focus:border-amber-500"
                          />
                          <div className="h-4 w-[1px] bg-slate-800 mx-2" />
                          <span className="text-slate-400 text-[11px] normal-case font-normal">{t("alliesVisualizedCount", uiLang)}: <span className="font-bold text-slate-300">{filteredAllies.length}</span></span>
                          <button
                            onClick={() => setShowOnlyOwnedAllies((value) => !value)}
                            disabled={importedAllies.length === 0}
                            className={`inline-flex h-7 items-center rounded-lg border px-2 text-[10px] font-bold uppercase transition-all disabled:cursor-not-allowed disabled:opacity-35 ${
                              showOnlyOwnedAllies
                                ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                                : "border-slate-700 bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            }`}
                            title={importedAllies.length === 0 ? t("importAlliesFirstTitle", uiLang) : showOnlyOwnedAllies ? t("showFullDatabaseTitle", uiLang) : t("showOnlyOwnedTitle", uiLang)}
                          >
                            {t("onlyOwnedLabel", uiLang)}
                          </button>
                        </div>
                      </th>
                      {renderMilitaryGroupHeaders()}
                    </tr>
                    <tr className="bg-slate-900/60 text-[13px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      <SortableHeader label={t("colAlly", uiLang)} sortKey="name" onClick={() => handleSort("name")} active={sortBy === "name"} order={sortOrder} className="py-0.5 px-2 w-full min-w-[240px] text-left" />
                      <th className="py-0.5 px-1 text-center w-[50px]" title={t("ally1stLevelValueTitle", uiLang)}>lv1</th>
                      <SortableHeader label="Eff" sortKey="eff" onClick={() => handleSort("eff")} active={sortBy === "eff"} order={sortOrder} className="th-eff" />
                      
                        {renderMilitaryHeaders()}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 text-sm">
                    {filteredAllies.map((a) => {
                      const hasUnplaced = showOnlyOwnedAllies && unplacedAllyLookup.has(`${a.id}__${a.rarity}`);
                      return (
                      <tr
                        key={a.id + a.rarity}
                        className={`transition-colors ${hasUnplaced ? "bg-red-950/30 hover:bg-red-950/50" : "hover:bg-slate-900/40"}`}
                      >
                        <td className="cell-name">
                          <AllyRarityName id={a.id} rarity={a.rarity} lang={uiLang} />
                          {hasUnplaced ? (
                            <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-red-950 text-red-400 border border-red-600" title={t("allyHasUnplacedCopyTitle", uiLang)}>{t("allyNotPlacedBadge", uiLang)}</span>
                          ) : showOnlyOwnedAllies && fragmentAllyLookup.set.has(`${a.id}__${a.rarity}`) && (
                            <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-600" title={t("fragmentsCountTitle", uiLang, fragmentAllyLookup.countMap.get(`${a.id}__${a.rarity}`) ?? 0)}>
                              {t("fragmentsBadge", uiLang, fragmentAllyLookup.countMap.get(`${a.id}__${a.rarity}`) ?? 0)}
                            </span>
                          )}
                        </td>
                          <td className="cell-num w-[50px] text-slate-300">
                            {formatDecimal(a.val1, 2)}
                          </td>
                        <td className="cell-eff">
                          <span className="text-amber-400 text-sm">{formatEff(a.currentEff)}</span>
                        </td>
                        
                        <MilitaryBoostCells general={a.computedGeneral} gbg={a.computedGbg} sped={a.computedSped} showSigmaColumns={showSigmaColumns} spedizioniEnabled={spedizioniEnabled} />
                      </tr>
                    );
                    })}
                    
                    {filteredAllies.length === 0 && (
                      <tr>
                        <td colSpan={(spedizioniEnabled ? 19 : 15) - (showSigmaColumns ? 4 : 0)} className="text-center py-12 text-slate-400 font-semibold">
                          Nessun alleato trovato con questa ricerca.
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
                    onScroll={() => syncBuildingTableScroll("floating")}
                    className="building-floating-scrollbar h-4 overflow-x-auto overflow-y-hidden"
                  >
                    <div style={{ width: buildingTableScrollMetrics.scrollWidth, height: 1 }} />
                  </div>
                </div>
              )}
            </div>
          </>
          )}

        </section>
      </main>

      {/* ── Modale Help Profili & Bacchetta Magica ──────────────────────── */}
      {/* ── Modale Chi sono · Contatti ───────────────────────────────────── */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        uiLang={uiLang}
      />

      <ProfileHelpModal
        isOpen={isProfileHelpOpen}
        onClose={() => setIsProfileHelpOpen(false)}
        uiLang={uiLang}
      />

      {/* ── Modale Import Sessione ────────────────────────────────────────── */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setIsImportModalOpen(false)}
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

      <EfficiencyHelpModal
        isOpen={isEfficiencyHelpOpen}
        onClose={() => setIsEfficiencyHelpOpen(false)}
        uiLang={uiLang}
      />

      {selectedJsonEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="font-bold text-amber-400 uppercase tracking-wide">
                {selectedJsonEntry.title}
              </h3>
              <button 
                onClick={() => setSelectedJsonEntry(null)}
                className="text-slate-400 hover:text-white"
              >
                Chiudi
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

      {imagePopup && (
        <div
          className="pointer-events-auto fixed z-[120] rounded-lg border border-amber-700/50 bg-slate-900 p-2 shadow-2xl shadow-black/60"
          style={(() => {
            const W = 232; // 224 immagine + 8 padding
            const showLeft = imagePopup.x + W + 8 > window.innerWidth;
            const left = showLeft ? Math.max(8, imagePopup.x - W - 8) : imagePopup.x + 8;
            const top = Math.min(imagePopup.y, window.innerHeight - 260);
            return { left, top: Math.max(8, top) };
          })()}
          onMouseEnter={cancelImagePopupClose}
          onMouseLeave={scheduleImagePopupClose}
        >
          {imagePopup.subtitle && (
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">{imagePopup.subtitle}</div>
          )}
          <img
            src={imagePopup.url}
            alt={imagePopup.name}
            className="h-56 w-56 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
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
        const maxDiffs = eraComparisons.reduce((m, c) => Math.max(m, c.diffs.length), 0);
        const diffCols = Math.max(1, Math.min(4, maxDiffs));
        const colWidthPx = 110; // larghezza stimata per colonna (icona + due numeri)
        // Minimo alto a sufficienza da non far andare a capo titoli/testi (es.
        // "SE AGGIORNI A [Era]", nomi kit, "N copie da [Era] (-N ere)").
        const popupWidthPx = Math.max(280, diffCols * colWidthPx + 24);
        const gridColsClass = diffCols === 1 ? "grid-cols-1" : diffCols === 2 ? "grid-cols-2" : diffCols === 3 ? "grid-cols-3" : "grid-cols-4";
        return (
          <div
            className="pointer-events-none fixed z-[110] max-h-[80vh] overflow-y-auto rounded-lg border border-red-700/60 bg-slate-900 p-3 text-left shadow-2xl shadow-black/60"
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
              <span> </span> {outdatedCopies.length} {outdatedCopies.length === 1 ? t("oldBuildingSingular", uiLang) : t("oldBuildingPlural", uiLang)}
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
                      {cmp.diffs.map((d) => {
                        const up = d.to > d.from;
                        const useFormatInt = ["pop", "fel", "mon", "mat", "iqMon", "iqMat"].includes(d.key);
                        return (
                          <div key={d.key} className="flex items-center gap-1 text-xs font-mono" title={t(d.labelKey, uiLang)}>
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
          className="pointer-events-none fixed z-[110] w-64 rounded-lg border border-sky-700/60 bg-slate-900 p-3 text-left shadow-2xl shadow-black/60"
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
            className="pointer-events-none fixed z-[110] rounded-lg border border-emerald-700/60 bg-slate-900 p-3 text-left shadow-2xl shadow-black/60"
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
                  const useFormatInt = ["pop", "fel", "mon", "mat", "iqMon", "iqMat"].includes(d.key);
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
            {/* Pop savings summary */}
            <div className="flex items-center justify-between border-t border-slate-700/60 pt-1.5 pb-2 text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <img src={iconPop} alt="" className="h-3.5 w-3.5 object-contain" />
                {t("declassablePopGainLabel", uiLang)}
              </span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">+{formatInt(popSavings)}</span>
            </div>
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
          className="pointer-events-none fixed z-[110] max-h-[70vh] w-72 overflow-y-auto rounded-lg border border-emerald-700/60 bg-slate-900 p-3 text-left shadow-2xl shadow-black/60"
          style={(() => {
            const TOOLTIP_H = window.innerHeight * 0.7;
            const spaceBelow = window.innerHeight - fragmentTooltip.y;
            const showAbove = spaceBelow < TOOLTIP_H + 12;
            return {
              left: Math.min(fragmentTooltip.x, window.innerWidth - 296),
              ...(showAbove
                ? { bottom: window.innerHeight - fragmentTooltip.y + 6 }
                : { top: fragmentTooltip.y + 6 }),
            };
          })()}
        >
          {fragmentTooltip.producers.length > 0 && (
            <>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                {t("buildingsThatProduceIt", uiLang)}
              </div>
              <ul className="space-y-0.5 text-xs text-slate-200">
                {fragmentTooltip.producers.map((name, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-400">•</span>
                    <span className="flex-1">{name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {fragmentTooltip.selectionKits.length > 0 && (
            <>
              <div className={`mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-300 ${fragmentTooltip.producers.length > 0 ? "mt-2.5 border-t border-slate-800 pt-2" : ""}`}>
                {t("selectionKitsThatProduceIt", uiLang)}
              </div>
              <ul className="space-y-0.5 text-xs text-slate-200">
                {fragmentTooltip.selectionKits.map((kitId, i) => {
                  const inv = inventoryCsvLike.get(kitId);
                  return (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-sky-400">•</span>
                      <span className="flex-1">{kitName(kitId, gameLang)}</span>
                      {inv && <span className="shrink-0 rounded bg-sky-900/60 px-1 font-mono font-bold text-sky-200">×{inv.qty}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {fabTooltip && (
        <div
          className="pointer-events-none fixed z-[110] max-w-xs overflow-y-auto rounded-lg border border-amber-700/50 bg-slate-900 p-3 text-left shadow-2xl shadow-black/60"
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
              <div className="text-[11px] font-bold uppercase tracking-wide text-violet-300 mb-0.5">Scelta:</div>
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
          className="pointer-events-none fixed z-[110] max-h-[70vh] w-72 overflow-y-auto rounded-lg border border-emerald-700/60 bg-slate-900 p-3 text-left shadow-2xl shadow-black/60"
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
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
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

      {isCityUpgradeableOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setIsCityUpgradeableOpen(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsCityUpgradeableOpen(false)}
              className="absolute -right-3 -top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              aria-label={t("closeAriaLabel", uiLang)}
            >
              <XIcon size={14} />
            </button>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {!cityUpgradeableData.hasInventoryData ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                  <div className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300">{t("inventoryRequiredTitle", uiLang)}</div>
                  <p className="mt-2 text-xs text-slate-400">
                    {t("inventoryRequiredBody", uiLang)}
                  </p>
                </div>
              ) : cityUpgradeableData.upgradable.length === 0 && cityUpgradeableData.ascendable.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-center text-slate-400 text-xs">
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
          </div>
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
    </div>
  );
}
