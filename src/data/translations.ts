/**
 * Traduzioni multilingua dei CityEntityId e degli alleati di Forge of Empires.
 *
 * I nomi sono colonne dirette di buildings.csv e allies.csv (NomeIta,
 * NomeEng, e in futuro altre come NomeDeu): non esiste più un file di
 * traduzione separato (traduzioni_edifici.csv è stato eliminato). Questo
 * modulo costruisce, a partire dai Building/Ally già parsati (campo
 * `names`), una mappa per ogni lingua candidata in languages.ts.
 *
 * Aggiungere una lingua (es. tedesco) non richiede toccare questo file:
 * basta aggiungerla a LANGUAGES in languages.ts e la colonna corrispondente
 * nei CSV. Se la colonna non esiste ancora, quella lingua resta semplicemente
 * assente dalle mappe (fallback su FALLBACK_LANG, poi sull'id grezzo).
 *
 * initTranslations() deve essere chiamata una volta, dopo aver parsato
 * buildings.csv e allies.csv, prima di qualunque uso di translateName/
 * getItalianMap. Viene chiamata da App.tsx subito dopo
 * BUILDINGS_FROM_CSV/ALLIES_FROM_CSV per evitare un ciclo di import
 * (buildings.ts/allies.ts non importano questo modulo).
 */
import type { Building } from "./buildings";
import type { Ally } from "./allies";
import { LANGUAGES, FALLBACK_LANG, type Lang } from "./languages";

export type { Lang };

let CACHE: Map<Lang, Map<string, string>> | null = null;

/**
 * Costruisce, per ogni lingua candidata in LANGUAGES, la mappa id->nome
 * unendo edifici e alleati. Chiamare una sola volta all'avvio dell'app
 * (dopo aver parsato i due CSV).
 */
export function initTranslations(buildings: Building[], allies: Ally[]): void {
  // Fail fast se un id alleato coincidesse con un cityEntityId (stesso schema
  // delle validazioni in ages/allies/buildings): la mappa unica per lingua si
  // regge sulla DISGIUNZIONE dei due spazi di id — una collisione farebbe
  // vincere silenziosamente il nome dell'alleato (inserito per ultimo). Oggi
  // è strutturalmente impossibile (edifici "W_*"/"X_*" ecc., alleati in
  // snake_case minuscolo): il check trasforma l'assunzione, finora solo
  // dichiarata nel commento di testa, in invariante verificata al boot.
  // Errore in inglese: diagnostica interna, non testo per l'utente.
  const buildingIds = new Set(buildings.map(b => b.cityEntityId));
  for (const a of allies) {
    if (buildingIds.has(a.id)) {
      throw new Error(`translations: ally id collides with a building id: ${a.id}`);
    }
  }

  const byLang = new Map<Lang, Map<string, string>>();
  for (const lang of LANGUAGES) {
    const map = new Map<string, string>();
    for (const b of buildings) {
      const name = b.names[lang.code];
      if (name) map.set(b.cityEntityId, name);
    }
    for (const a of allies) {
      const name = a.names[lang.code];
      if (name) map.set(a.id, name);
    }
    if (map.size > 0) byLang.set(lang.code, map);
  }
  CACHE = byLang;
}

function ensure(): Map<Lang, Map<string, string>> {
  if (!CACHE) {
    // Sicurezza: se per qualche motivo translateName/getItalianMap vengono
    // chiamate prima di initTranslations (es. durante un refactor futuro),
    // si torna mappe vuote invece di un crash — i nomi degraderanno all'id
    // grezzo, comportamento comunque visibile e diagnosticabile.
    // Messaggio in inglese: diagnostica interna di programmazione, non testo
    // per l'utente finale (coerente con "initKitData not called" ecc.).
    console.warn("[translations] initTranslations() was not called: names unavailable.");
    CACHE = new Map();
  }
  return CACHE;
}

/**
 * Traduce un id (CityEntityId o ally id) nella lingua scelta.
 * Fallback: lingua richiesta -> FALLBACK_LANG (inglese) -> id grezzo.
 */
export function translateName(id: string, lang: Lang): string {
  const byLang = ensure();
  const direct = byLang.get(lang)?.get(id);
  if (direct) return direct;

  if (lang !== FALLBACK_LANG) {
    const fallback = byLang.get(FALLBACK_LANG)?.get(id);
    if (fallback) return fallback;
  }
  return id;
}

/** Esponi la mappa italiana per i chiamanti che vogliono un accesso O(1) bulk.
 *  ⚠️ Restituisce la mappa INTERNA viva (niente copia difensiva, per non
 *  duplicare ~2000 entry a ogni chiamata): il chiamante deve trattarla come
 *  SOLA LETTURA — l'unico consumer (ITALIAN_NAMES in App.tsx) fa solo
 *  get/has. Se in futuro servisse mutarla, farne una copia lato chiamante. */
export function getItalianMap(): Map<string, string> {
  return ensure().get("it") ?? new Map();
}

/** True se esiste una traduzione DIRETTA (non di fallback) per questo id
 *  nella lingua data. Usato per evidenziare in corsivo i nomi che, in tab
 *  database, ricadono sul fallback inglese perché manca la colonna nella
 *  lingua corrente (es. un nuovo edificio non ancora tradotto). */
export function hasTranslation(id: string, lang: Lang): boolean {
  return ensure().get(lang)?.has(id) ?? false;
}
