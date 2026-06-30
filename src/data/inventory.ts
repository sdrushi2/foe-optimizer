import type { InventoryItem } from "./bookmarklet";
import { CONSUMABLE_ASSET_NAMES, isShrinkKit } from "./buildingClassification";

export interface InventoryEntry {
  cityEntityId: string;
  name: string;
  inStock: number;
  rawEntry: InventoryItem;
}

export interface SelectionKitEntry {
  kitId: string;
  name: string;
  inStock: number;
  rawEntry: InventoryItem;
}

export interface UpgradeKitEntry {
  kitId: string;
  name: string;
  inStock: number;
  rawEntry: InventoryItem;
}

/** Livello (tier) di un kit di selezione o aggiornamento, derivato dal
 *  prefisso del kitId. I kitId hanno struttura:
 *  - selection_kit_X          → "normal"
 *  - silver_selection_kit_X   → "silver"
 *  - golden_selection_kit_X   → "gold"
 *  - platinum_selection_kit_X → "platinum"
 *  Unico punto del codice che conosce questi prefissi. */
type KitTier = "platinum" | "gold" | "silver" | "normal";

export function kitTier(kitId: string): KitTier {
  if (kitId.startsWith("platinum")) return "platinum";
  if (kitId.startsWith("golden"))   return "gold";
  if (kitId.startsWith("silver"))   return "silver";
  return "normal";
}

/** Chiavi conteggio dei consumabili in SpecialKits (= chiavi di
 *  CONSUMABLE_ASSET_NAMES). Il campo nome associato è `${ConsumableKey}Name`. */
type ConsumableKey = keyof typeof CONSUMABLE_ASSET_NAMES;

/** Mappa inversa itemAssetName → chiave conteggio, costruita una volta dal
 *  modulo. Permette di gestire tutti i consumabili con un singolo lookup
 *  invece di sette confronti di uguaglianza. */
const CONSUMABLE_KEY_BY_ASSET = new Map<string, ConsumableKey>(
  (Object.entries(CONSUMABLE_ASSET_NAMES) as Array<[ConsumableKey, string]>)
    .map(([key, asset]) => [asset, key]),
);

/** Kit speciali letti da itemAssetName (mappatura asset→campo in
 *  CONSUMABLE_ASSET_NAMES, buildingClassification.ts — fonte di verità).
 *  I campi *Name sono opzionali per retrocompatibilità con localStorage
 *  precedente. Se mancanti, i consumer usano un fallback hardcoded. */
export interface SpecialKits {
  oneUpKit:           number;
  oneDownKit:         number;
  reversionKit:       number;
  renovationKit:      number;
  storeBuilding:      number;
  rushEventBuildings: number;
  rushMassSupplies:   number;
  rushGoodsBuildings: number;
  massSelfAidKit:     number;
  // Nomi localizzati (dalla prima occorrenza in inventario)
  oneUpKitName?:           string;
  oneDownKitName?:         string;
  reversionKitName?:       string;
  renovationKitName?:      string;
  storeBuildingName?:      string;
  rushEventBuildingsName?: string;
  rushMassSuppliesName?:   string;
  rushGoodsBuildingsName?: string;
  massSelfAidKitName?:     string;
}

interface ParsedInventory {
  matched: Map<string, InventoryEntry>;
  unmatched: Map<string, InventoryEntry>;
  selectionKits: Map<string, SelectionKitEntry>;
  upgradeKits: Map<string, UpgradeKitEntry>;
  specialKits: SpecialKits;
}

/** Forma serializzata dell'inventario salvata nel localStorage del profilo. */
export interface InventoryStore {
  inventoryMatched: Array<[string, InventoryEntry]>;
  inventoryUnmatched: Array<[string, InventoryEntry]>;
  inventorySelectionKits: Array<[string, SelectionKitEntry]>;
  inventoryUpgradeKits: Array<[string, UpgradeKitEntry]>;
  specialKits?: SpecialKits;
}

/**
 * Parser puro dell'inventario esportato dal bookmarklet.
 *
 * Non tocca stato React né localStorage: riceve gli item grezzi e restituisce
 * le quattro mappe che App.tsx userà per aggiornare stato e persistenza.
 */
export function parseInventory(
  items: InventoryItem[],
  csvIdsSet: Set<string>,
): ParsedInventory {
  const matched = new Map<string, InventoryEntry>();
  const unmatched = new Map<string, InventoryEntry>();
  const selectionKits = new Map<string, SelectionKitEntry>();
  const upgradeKits = new Map<string, UpgradeKitEntry>();
  const specialKits: SpecialKits = {
    oneUpKit: 0, oneDownKit: 0, reversionKit: 0, renovationKit: 0, storeBuilding: 0,
    rushEventBuildings: 0, rushMassSupplies: 0, rushGoodsBuildings: 0, massSelfAidKit: 0,
  };

  for (const item of items) {
    if (!item || typeof item !== "object") continue;

    // Consumabili speciali identificati da itemAssetName.
    // Il nome viene salvato alla prima occorrenza (lingua del client).
    // Approccio table-driven: la chiave di CONSUMABLE_ASSET_NAMES coincide
    // con il campo conteggio di SpecialKits, e il campo nome è "{chiave}Name"
    // — quindi un solo blocco gestisce tutti e 7 i consumabili senza ripetere
    // (e tenere sincronizzati a mano) sette if accoppiati per posizione.
    const assetName = item.itemAssetName ? String(item.itemAssetName) : "";
    const consumableKey = assetName ? CONSUMABLE_KEY_BY_ASSET.get(assetName) : undefined;
    if (consumableKey) {
      // Coerenza con i building/frammenti: scarta stock <= 0 (un consumabile
      // non posseduto non deve né essere contato né fissare il nome).
      const qty = Number(item.inStock ?? 1);
      if (qty <= 0) continue;
      specialKits[consumableKey] += qty;
      const nameKey = `${consumableKey}Name` as const;
      if (!specialKits[nameKey] && item.name) specialKits[nameKey] = String(item.name);
      continue;
    }

    if (item.item?.__class__ === "SelectionKitPayload" && item.item?.selectionKitId) {
      const kitId = String(item.item.selectionKitId);
      // Coerenza con consumabili/edifici: scarta stock <= 0. Un kit non
      // posseduto non deve né essere contato né far risultare la sua famiglia
      // "toccata" nell'ottimizzatore (computeAllFamilies guarda le chiavi di
      // invSel, non i valori: una entry con quantità 0 produrrebbe una riga
      // spuria).
      const qty = Number(item.inStock ?? 1);
      if (qty <= 0) continue;
      const existing = selectionKits.get(kitId);
      if (existing) existing.inStock += qty;
      else selectionKits.set(kitId, { kitId, name: item.name ?? kitId, inStock: qty, rawEntry: item });
      continue;
    }

    if (item.item?.__class__ === "UpgradeKitPayload" && item.item?.upgradeItemId) {
      const kitId = String(item.item.upgradeItemId);
      // Gli shrink kit (kit di rimpicciolimento) non sono kit di aggiornamento
      // edificio: si escludono. Il filtro usa il pattern dell'id (lingua-neutro),
      // non il nome localizzato — così funziona anche importando una città in
      // inglese o in qualsiasi altra lingua.
      if (isShrinkKit(kitId)) continue;
      // Coerenza con consumabili/edifici: scarta stock <= 0 (vedi blocco
      // selection kit sopra per il razionale).
      const qty = Number(item.inStock ?? 1);
      if (qty <= 0) continue;
      const name = item.name || "";
      const existing = upgradeKits.get(kitId);
      if (existing) existing.inStock += qty;
      else upgradeKits.set(kitId, { kitId, name: name || kitId, inStock: qty, rawEntry: item });
      continue;
    }

    if (item.item?.__class__ !== "BuildingItemPayload") continue;
    const cityEntityId = item.item?.cityEntityId ? String(item.item.cityEntityId) : null;
    if (!cityEntityId) continue;

    // Coerenza con parseAllyFragments: scartiamo gli edifici con stock <= 0.
    // L'assenza del campo (?? 1) significa "una copia", mentre uno stock
    // esplicito di 0 o negativo non rappresenta un edificio realmente posseduto.
    const stock = Number(item.inStock ?? 1);
    if (stock <= 0) continue;

    const entry: InventoryEntry = {
      cityEntityId,
      name: item.name ?? cityEntityId,
      inStock: stock,
      rawEntry: item,
    };

    const target = csvIdsSet.has(cityEntityId) ? matched : unmatched;
    const existing = target.get(cityEntityId);
    if (existing) existing.inStock += entry.inStock;
    else target.set(cityEntityId, entry);
  }

  return { matched, unmatched, selectionKits, upgradeKits, specialKits };
}
