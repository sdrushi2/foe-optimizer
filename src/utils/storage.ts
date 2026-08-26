import * as pako from "pako";
import type { InventoryStore } from "../data/inventory";
import type { ImportedAlly } from "../data/allies";
import type { CityStore } from "../data/cityStore";

export type Profile = { id: string; name: string };

// Versione del formato di storage. Incrementarla (key rotation) invalida
// automaticamente tutte le chiavi delle versioni precedenti: i dati vecchi
// non vengono più letti e vengono ripuliti da cleanupOrphanedKeys().
const STORAGE_FORMAT_VERSION = 2;
const V = `v${STORAGE_FORMAT_VERSION}`;

export const PROFILES_KEY = `foe_global_profiles_${V}`;
export const ACTIVE_PROFILE_KEY = `foe_global_active_profile_${V}`;
export const DEFENSE_KEY = `foe_global_defense_${V}`;
export const SPED_ENABLED_KEY = `foe_global_spedizioni_enabled_${V}`;
export const SPED_ATTACK_KEY = `foe_global_spedizioni_attack_${V}`;
export const SIGMA_KEY = `foe_global_sigma_enabled_${V}`;
export const POP_COLUMN_KEY = `foe_global_show_pop_column_${V}`;
export const FEL_COLUMN_KEY = `foe_global_show_fel_column_${V}`;
export const IQ_PROD_COLUMNS_KEY = `foe_global_show_iq_prod_columns_${V}`;
export const PROD_COLUMNS_KEY = `foe_global_show_prod_columns_${V}`;
export const SHOW_CITY_MAP_KEY = `foe_global_show_city_map_${V}`;
// Vista database tab Info: "light" (solo edifici principali, Lin=1) o "full".
export const DB_VIEW_KEY = `foe_global_db_view_${V}`;
// Lingua della GUI (etichette/tooltip statici, vedi data/ui-strings.ts).
// Diversa da gameLang: quella è rilevata dal payload importato, questa è una
// scelta esplicita dell'utente, indipendente dal profilo attivo.
export const UI_LANG_KEY = `foe_global_ui_lang_${V}`;

export function profileStorageKey(profileId: string, slot: "city" | "inventory" | "allies"): string {
  return `foe_p_${profileId}_${slot}_${V}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  // `i` è vincolato da `i < len` nel for: sempre in range.
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function isCompressedKey(key: string): boolean {
  return key.startsWith("foe_p_");
}

/**
 * Tetto alla dimensione DECOMPRESSA di un blob profilo.
 *
 * ⚠️ Difesa contro le "bombe di decompressione": i blob `foe_p_*` sono
 * gzip+base64 e possono arrivare da un file di import condiviso da terzi (vedi
 * mergeImportedProfiles). Il gzip raggiunge facilmente rapporti di 700:1 —
 * misurato: 253 KB nel file di import producevano 200 MB in memoria. Peggio, il
 * blob viene PERSISTITO: senza limite l'esplosione si ripeteva a ogni
 * caricamento successivo, rendendo l'app inutilizzabile finché l'utente non
 * svuotava lo storage a mano.
 *
 * 32 MB è abbondante per una città reale (i dati veri stanno in poche centinaia
 * di KB decompressi) e blocca comunque qualunque bomba pratica.
 */
const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;

/**
 * L'input viene spinto nel decompressore a FETTE, controllando l'output dopo
 * ognuna: è ciò che rende il limite efficace in memoria e non solo formale.
 * Con un unico `push` di tutto il buffer, pako decomprime comunque l'intero
 * contenuto prima che il controllo possa scattare (misurato: 400 MB allocati
 * lo stesso). A fette da 16 KB l'interruzione avviene in ~70ms senza crescita
 * di heap misurabile.
 */
const INFLATE_SLICE_BYTES = 16 * 1024;

function inflateWithLimit(bytes: Uint8Array): string {
  const inflator = new pako.Inflate();
  const chunks: Uint8Array[] = [];
  let total = 0;
  // `Inflate` (a differenza della funzione pako.inflate) emette Uint8Array:
  // il limite è quindi in BYTE, e la conversione a stringa avviene alla fine,
  // una volta sola, solo se il totale è rientrato nel tetto.
  inflator.onData = (chunk: Uint8Array) => {
    chunks.push(chunk);
    total += chunk.length;
  };

  for (let offset = 0; offset < bytes.length; offset += INFLATE_SLICE_BYTES) {
    const end = Math.min(offset + INFLATE_SLICE_BYTES, bytes.length);
    inflator.push(bytes.subarray(offset, end), end >= bytes.length);
    if (total > MAX_DECOMPRESSED_BYTES) {
      throw new Error("DECOMPRESSED_TOO_LARGE");
    }
    if (inflator.err) throw new Error("INFLATE_ERROR");
  }
  if (inflator.err) throw new Error("INFLATE_ERROR");

  const merged = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    merged.set(chunk, position);
    position += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

export function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    if (isCompressedKey(key)) {
      const binary = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
      return JSON.parse(inflateWithLimit(binary)) as T;
    }
    return JSON.parse(raw) as T;
  } catch (err) {
    // Diagnostica in inglese (non testo per l'utente): senza questo log, un
    // blob rifiutato perché troppo grande sarebbe indistinguibile da un
    // profilo semplicemente vuoto.
    if (err instanceof Error && err.message === "DECOMPRESSED_TOO_LARGE") {
      console.warn(`[FOE] refused to decompress "${key}": exceeds ${MAX_DECOMPRESSED_BYTES} bytes (possible decompression bomb)`);
    }
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): boolean {
  try {
    const json = JSON.stringify(value);
    if (isCompressedKey(key)) {
      const compressed = pako.deflate(json);
      localStorage.setItem(key, uint8ToBase64(compressed));
    } else {
      localStorage.setItem(key, json);
    }
    return true;
  } catch (err) {
    // Non rilanciamo (il chiamante non sempre può gestirlo), ma logghiamo e
    // restituiamo false: tipicamente QuotaExceededError quando il localStorage
    // è pieno. I chiamanti che devono reagire a un salvataggio fallito (es.
    // mergeImportedProfiles con failedKeys) controllano il valore di ritorno;
    // gli altri possono ignorarlo. Senza il log, un salvataggio fallito
    // sarebbe del tutto invisibile in debug.
    // Messaggio in inglese: diagnostica interna, non testo per l'utente.
    console.warn(`[FOE] writeStoredJson failed for key "${key}":`, err);
    return false;
  }
}

export function clearStoredJson(key: string) {
  try {
    localStorage.removeItem(key);
  } catch { /* ignorato: pulizia best-effort */ }
}

export function reviveMap<V>(entries: unknown): Map<string, V> {
  return new Map<string, V>(Array.isArray(entries) ? entries as Array<[string, V]> : []);
}

export function reviveSet(values: unknown): Set<string> {
  return new Set<string>(Array.isArray(values) ? values as string[] : []);
}

export function initCityStore(profileId: string): CityStore | null {
  return readStoredJson<CityStore | null>(profileStorageKey(profileId, "city"), null);
}

export function initInventoryStore(profileId: string): InventoryStore | null {
  return readStoredJson<InventoryStore | null>(profileStorageKey(profileId, "inventory"), null);
}

export function initAlliesStore(profileId: string): ImportedAlly[] {
  return readStoredJson<ImportedAlly[]>(profileStorageKey(profileId, "allies"), []);
}

/**
 * Verifica se nel localStorage sono presenti dati di versioni precedenti dell'app.
 * Utile per avvisare l'utente prima di una pulizia automatica distruttiva.
 */
export function isStorageOutdated(): boolean {
  if (STORAGE_FORMAT_VERSION <= 1) return false;
  // Controlla se esiste la chiave profili di una qualsiasi versione precedente
  for (let v = 1; v < STORAGE_FORMAT_VERSION; v++) {
    if (localStorage.getItem(`foe_global_profiles_v${v}`) !== null) return true;
  }
  return false;
}

/**
 * Chiavi globali RITIRATE: erano scritte da versioni precedenti dell'app con il
 * suffisso della versione di storage CORRENTE, quindi cleanupOrphanedKeys() le
 * considererebbe valide e le lascerebbe lì per sempre. Vanno quindi rimosse
 * esplicitamente, una volta sola, al primo avvio dopo l'aggiornamento.
 *
 * - hide_no_rush / hide_era_mutable (agosto 2026): i due filtri "nascondi 🚫" e
 *   "nascondi ^" non sono più persistenti. Ripartono spenti a ogni caricamento:
 *   sono filtri che RIMUOVONO righe dalla tabella, e ritrovarli attivi da una
 *   sessione precedente faceva sembrare mancanti degli edifici che invece
 *   c'erano — vedi la loro dichiarazione in App.tsx.
 */
const RETIRED_GLOBAL_KEYS = [
  `foe_global_hide_no_rush_${V}`,
  `foe_global_hide_era_mutable_${V}`,
];

export function cleanupOrphanedKeys() {
  const profiles = readStoredJson<Profile[]>(PROFILES_KEY, []);
  const validProfileKeys = new Set<string>();
  profiles.forEach(p => {
    validProfileKeys.add(profileStorageKey(p.id, "city"));
    validProfileKeys.add(profileStorageKey(p.id, "inventory"));
    validProfileKeys.add(profileStorageKey(p.id, "allies"));
  });

  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("foe_")) continue;

    // Ritirate: hanno il suffisso della versione corrente ma non sono più usate
    // dall'app, quindi il controllo generico qui sotto le terrebbe in vita.
    if (RETIRED_GLOBAL_KEYS.includes(key)) {
      toRemove.push(key);
      continue;
    }

    // Proclama come "globale valida" solo se appartiene alla versione corrente
    const isGlobalCurrentVersion = key.startsWith("foe_global_") && key.endsWith(`_${V}`);
    const isValidProfileCurrentVersion = key.startsWith("foe_p_") && validProfileKeys.has(key);

    if (!isGlobalCurrentVersion && !isValidProfileCurrentVersion) {
      toRemove.push(key);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
  if (toRemove.length > 0) {
    console.info(`[FOE] localStorage cleanup: removed ${toRemove.length} orphaned or previous-version keys`, toRemove);
  }
}

export function loadProfiles(): Profile[] {
  return readStoredJson<Profile[]>(PROFILES_KEY, []);
}

export function getActiveProfileId(profiles: Profile[]): string {
  if (profiles.length === 0) return "";
  const saved = localStorage.getItem(ACTIVE_PROFILE_KEY);
  if (saved && profiles.find(p => p.id === saved)) return saved;
  // `profiles.length === 0` gestito dal return anticipato sopra.
  return profiles[0]!.id;
}

export function collectFoeLocalStorage(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith("foe_")) {
      snapshot[key] = localStorage.getItem(key) ?? "";
    }
  }
  return snapshot;
}

/**
 * @param fallbackProfileName nome per i profili importati senza nome, dato il
 *        numero progressivo. storage.ts non ha accesso a uiLang/t(), quindi il
 *        chiamante (App.tsx) passa la versione localizzata (defaultProfileName);
 *        il default "Profilo N" resta solo come rete di sicurezza.
 */
export function mergeImportedProfiles(
  snapshot: Record<string, string>,
  fallbackProfileName: (n: number) => string = (n) => `Profilo ${n}`,
): { ok: boolean; failedKeys: string[]; mergedProfiles: Profile[] } {
  // Il file potrebbe essere stato esportato da una versione di storage diversa
  // (suffisso _vN differente). Cerchiamo la chiave profili in QUALSIASI versione
  // presente nello snapshot, non solo in quella corrente, per non rifiutare a
  // torto i file più vecchi o più recenti.
  const profilesKeyInSnapshot =
    snapshot[PROFILES_KEY] !== undefined
      ? PROFILES_KEY
      : Object.keys(snapshot).find(k => /^foe_global_profiles_v\d+$/.test(k));

  const importedProfiles = profilesKeyInSnapshot
    ? (JSON.parse(snapshot[profilesKeyInSnapshot] ?? "[]") as Profile[])
    : [];
  if (!Array.isArray(importedProfiles) || importedProfiles.length === 0) {
    // Codice d'errore stabile (non testo per l'utente): storage.ts non ha
    // accesso a uiLang/t(), quindi il chiamante (App.tsx) traduce questo
    // messaggio in base alla lingua corrente — vedi importInvalidFile in
    // ui-strings.ts.
    throw new Error("INVALID_IMPORT_FILE");
  }

  const currentProfiles = loadProfiles();
  const usedIds = new Set(currentProfiles.map(p => p.id));

  // Genera un ID univoco di fallback per i profili importati che hanno id
  // mancante o in conflitto con uno già esistente.
  const makeFallbackId = (index: number) =>
    `p_imported_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;

  // idMap: indicizzata sull'index dell'array (sempre univoco), non su profile.id
  // che potrebbe essere "" o undefined per più profili, causando collisioni.
  const idMap = new Map<number, string>();

  const nextProfiles = importedProfiles.map((profile, index) => {
    // Usa l'id originale solo se valido e non in conflitto; altrimenti
    // genera subito un fallback random (no while-loop in caso normale).
    let id = profile.id && !usedIds.has(profile.id) ? profile.id : makeFallbackId(index);
    // Salvaguardia teorica: nuovo random nel caso astronomicamente raro di collisione.
    while (usedIds.has(id)) id = makeFallbackId(index);
    usedIds.add(id);
    idMap.set(index, id);
    return { id, name: profile.name || fallbackProfileName(currentProfiles.length + index + 1) };
  });

  const failedKeys: string[] = [];

  // Cerca un blob profilo nello snapshot indipendentemente dal suffisso di
  // versione: i dati di un profilo esportato da una versione precedente hanno
  // chiavi foe_p_<id>_<slot>_vN con N diverso da quello corrente, quindi il
  // match è su prefisso `foe_p_<id>_<slot>_v` (qualsiasi N).
  //
  // Se l'id originale è vuoto/undefined non c'è modo di recuperare il blob in
  // modo affidabile (cercare "il primo blob di questo slot" assocerebbe dati a
  // caso al profilo sbagliato), quindi si restituisce undefined: il profilo
  // viene creato senza i suoi dati di slot. È un caso degenerato raro (file
  // esportati con profili privi di id) e il fallback "nessun dato" è più sicuro
  // di un possibile mismatch.
  const findProfileBlob = (originalId: string | undefined, slot: "city" | "inventory" | "allies"): string | undefined => {
    if (originalId) {
      // Match esatto su qualsiasi versione: foe_p_<id>_<slot>_vN
      const exactPrefix = `foe_p_${originalId}_${slot}_v`;
      const exactKey = Object.keys(snapshot).find(k => k.startsWith(exactPrefix));
      if (exactKey) return snapshot[exactKey];
    }
    return undefined;
  };

  importedProfiles.forEach((importedProfile, index) => {
    const newId = idMap.get(index);
    if (!newId) return;
    (["city", "inventory", "allies"] as const).forEach((slot) => {
      const value = findProfileBlob(importedProfile.id, slot);
      if (!value) return;
      // Riscrivi SEMPRE con la chiave della versione corrente: i blob compressi
      // restano validi (è solo gzip+base64 di JSON, indipendente dalla versione
      // di storage), ma vengono ricollocati sotto il suffisso _vN attuale.
      // CAVEAT: questo assume che la FORMA interna del JSON (CityStore/
      // InventoryStore) non sia cambiata tra la versione del file e quella
      // corrente. Se un futuro bump di STORAGE_FORMAT_VERSION cambia la forma
      // dei dati profilo (non solo le chiavi), qui andrà aggiunta una
      // migrazione esplicita per-slot prima della riscrittura.
      const newKey = profileStorageKey(newId, slot);
      try {
        localStorage.setItem(newKey, value);
      } catch {
        failedKeys.push(newKey);
      }
    });
  });

  const mergedProfiles = [...currentProfiles, ...nextProfiles];
  // writeStoredJson non lancia mai: cattura internamente e restituisce false
  // (un try/catch qui sarebbe un ramo morto e la scrittura fallita della
  // lista profili passerebbe inosservata con ok=true).
  if (!writeStoredJson(PROFILES_KEY, mergedProfiles)) {
    failedKeys.push(PROFILES_KEY);
  }

  if (!localStorage.getItem(ACTIVE_PROFILE_KEY) && mergedProfiles[0]) {
    try {
      localStorage.setItem(ACTIVE_PROFILE_KEY, mergedProfiles[0].id);
    } catch {
      failedKeys.push(ACTIVE_PROFILE_KEY);
    }
  }

  return { ok: failedKeys.length === 0, failedKeys, mergedProfiles };
}
