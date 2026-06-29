import agesCsv from "../assets/ages.csv?raw";
import { LANGUAGES, FALLBACK_LANG, type Lang } from "./languages";

/** Era del gioco, parsata da ages.csv.
 *  `names` ha una entry per ogni lingua con colonna presente nel CSV
 *  (es. "NomeIta" -> names.it, "NomeEng" -> names.en). L'inglese è
 *  garantito presente (fallback al codice `age` se la colonna manca). */
export interface Age {
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
  // Quali lingue di LANGUAGES hanno davvero una colonna in questo CSV.
  const availableLangs = LANGUAGES.filter(l => colIndex(l.csvColumn) >= 0);

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
      const value = parts[colIndex(lang.csvColumn)]?.trim();
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

// Fail fast se il dataset è corrotto (errore interno, non testo per l'utente)
if (AGES.length === 0) throw new Error("ages.csv is empty or failed to parse");

/** Era massima: quella con l'id più alto presente nel CSV. */
const MAX_AGE: Age = AGES[AGES.length - 1];

/** FALLBACK ERA: codice dell'era massima, usato ovunque serva un'era di default. */
export const FALLBACK_ERA: string = MAX_AGE.age;

/** Mappa id era -> Age. Lookup per id (non per posizione nell'array):
 *  robusto anche se gli id non fossero contigui o l'array non fosse
 *  ordinato (AGES[lvl] assumerebbe indice === id, fragile a modifiche di
 *  ages.csv). */
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
