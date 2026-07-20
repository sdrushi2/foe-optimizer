import agesCsv from "../assets/ages.csv?raw";
import { LANGUAGES, FALLBACK_LANG, type Lang } from "./languages";

/** Era del gioco, parsata da ages.csv.
 *  `names` ha una entry per ogni lingua con colonna presente nel CSV
 *  (es. "NomeIta" -> names.it, "NomeEng" -> names.en). L'inglese è
 *  garantito presente (fallback al codice `age` se la colonna manca). */
export interface Age {
  /** Id numerico dell'era (0=StoneAge ... n-1=era massima).
   *  ⚠️ INVARIANTE CRITICA, non modificare la numerazione: coincide con il
   *  `level` grezzo che il gioco assegna alle istanze in CityMapData —
   *  App.tsx fa AGES_BY_ID.get(level) per tutta la logica edifici
   *  obsoleti/declassabili e per le statistiche per-era. Se gli id del CSV
   *  divergessero dalla numerazione interna di Inno, quella logica si
   *  romperebbe in modo silenzioso. La contiguità 0..n-1 è validata al
   *  load (vedi sotto). */
  id: number;
  age: string; // codice inglese, es. "SpaceAgeSpaceHub"
  names: Partial<Record<Lang, string>>;
}

/**
 * Parser di ages.csv (formato: id;age;NomeIta;NomeEng;...).
 * Eseguito UNA VOLTA SOLA al caricamento del modulo (avvio del tool).
 * Stesso schema di colonne Nome* usato da buildings.ts/allies.ts: per
 * aggiungere una lingua basta aggiungere la colonna qui e il codice in
 * LANGUAGES (languages.ts), nessun'altra modifica necessaria.
 */
function parseAgesCsv(csvText: string): Age[] {
  // Rimuovi BOM UTF-8 se presente (es. file salvati da Excel)
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const ages: Age[] = [];

  const header = lines[0].split(";").map(h => h.trim().toLowerCase());
  const colIndex = (name: string) => header.indexOf(name.toLowerCase());
  const idCol = colIndex("id");
  const ageCol = colIndex("age");
  // Quali lingue di LANGUAGES hanno davvero una colonna in questo CSV, con
  // l'indice di colonna precomputato una volta (stesso pattern di allies.ts):
  // evita di rifare indexOf sull'header per ogni riga × lingua nel loop sotto.
  const availableLangs = LANGUAGES
    .map(l => ({ code: l.code, idx: colIndex(l.csvColumn) }))
    .filter(l => l.idx >= 0);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(";");
    const idStr = idCol >= 0 ? parts[idCol] : parts[0];
    const age = (ageCol >= 0 ? parts[ageCol] : parts[1])?.trim();
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id) || !age) continue;

    const names: Partial<Record<Lang, string>> = {};
    for (const lang of availableLangs) {
      const value = parts[lang.idx]?.trim();
      if (value) names[lang.code] = value;
    }
    // L'inglese è garantito: se la colonna manca o è vuota, usa il codice era.
    if (!names.en) names.en = age;

    ages.push({ id, age, names });
  }

  return ages;
}

/** Lista completa delle ere, ordinate per id crescente. Non esportata: nessun
 *  consumer esterno itera l'array direttamente — usano AGES_BY_ID/AGE_BY_CODE
 *  (lookup) o ageName() (nome localizzato). Se in futuro serve iterare tutte
 *  le ere in ordine (es. un selettore "scegli era"), esportarla di nuovo. */
const AGES: Age[] = parseAgesCsv(agesCsv).sort((a, b) => a.id - b.id); // ID sono 0,1,2...22

// Fail fast se il dataset è corrotto (errore interno, non testo per l'utente).
if (AGES.length === 0) throw new Error("ages.csv is empty or failed to parse");
// Id contigui 0..n-1 (quindi anche niente duplicati: l'array è ordinato per
// id, un doppione farebbe fallire il confronto con la posizione): i
// consumatori CONTANO su questa forma — BuildingModel ricava l'era precedente
// con id-1, il tooltip "se aggiorni" fa aritmetica sulle differenze di id, e
// AGES_BY_ID.get(level) usa il level di gioco come id (vedi commento su Age).
// Senza questo check, un duplicato vincerebbe silenziosamente l'ultimo nelle
// due Map qui sotto e un buco nella numerazione romperebbe i calcoli a valle.
AGES.forEach((a, i) => {
  if (a.id !== i) throw new Error(`ages.csv: ids must be contiguous 0..n-1 (found id ${a.id} at position ${i})`);
});
if (new Set(AGES.map(a => a.age)).size !== AGES.length) {
  throw new Error("ages.csv: duplicate era codes");
}

/** Era massima: quella con l'id più alto presente nel CSV. */
const MAX_AGE: Age = AGES[AGES.length - 1];

/** FALLBACK ERA: codice dell'era massima, usato ovunque serva un'era di default. */
export const FALLBACK_ERA: string = MAX_AGE.age;

/** Mappa id era -> Age. Lookup per id invece di AGES[lvl] diretto: più
 *  esplicito e indipendente dall'ordinamento dell'array. NOTA: la contiguità
 *  0..n-1 degli id NON è un'ipotesi da cui questo modulo si difende — è una
 *  INVARIANTE validata al load (vedi sopra), perché i consumatori fanno
 *  aritmetica sugli id (id-1 per l'era precedente, differenze per "quante
 *  ere indietro"). */
export const AGES_BY_ID: Map<number, Age> = new Map(
  AGES.map(a => [a.id, a])
);

/** Mappa codice era -> Age completa. Evita AGES.find(a => a.age === X)
 *  ripetuti (lookup O(n)) sparsi nel codice: usare AGE_BY_CODE.get(X). */
export const AGE_BY_CODE: Map<string, Age> = new Map(
  AGES.map(a => [a.age, a])
);

/** Nome leggibile di un'era nella lingua richiesta, con fallback a
 *  FALLBACK_LANG e infine al codice era grezzo se non tradotta. */
export function ageName(ageCode: string, lang: Lang): string {
  const age = AGE_BY_CODE.get(ageCode);
  if (!age) return ageCode;
  return age.names[lang] ?? age.names[FALLBACK_LANG] ?? age.age;
}
