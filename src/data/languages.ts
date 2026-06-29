/**
 * Lingue supportate per i nomi di edifici e alleati (NomeIta/NomeEng/... nei
 * CSV). Vive in un modulo separato — non in translations.ts — perché sia
 * buildings.ts/allies.ts (che leggono le colonne durante il parsing) sia
 * translations.ts (che costruisce le mappe id->nome) devono poterlo
 * importare senza creare un ciclo tra loro.
 *
 * Per aggiungere una lingua (es. tedesco): aggiungere una riga a LANGUAGES
 * qui sotto, poi aggiungere la colonna corrispondente (es. "NomeDeu") sia in
 * buildings.csv sia in allies.csv. Nessun'altra modifica di codice è
 * necessaria: il parsing e le mappe di traduzione la raccolgono in automatico.
 * Se la colonna non è ancora presente nel CSV, la lingua resta semplicemente
 * assente dalle mappe (fallback sull'inglese, poi sull'id grezzo).
 */

/** Codici lingua candidati. Estendere qui per aggiungerne di nuovi. */
export type Lang = "it" | "en" | "de" | "es" | "fr";

/** Suffisso della colonna CSV per ciascuna lingua (es. "NomeIta" per "it"). */
export const LANGUAGES: ReadonlyArray<{ code: Lang; csvColumn: string }> = [
  { code: "it", csvColumn: "NomeIta" },
  { code: "en", csvColumn: "NomeEng" },
  { code: "de", csvColumn: "NomeDeu" },
  { code: "es", csvColumn: "NomeSpa" },
  { code: "fr", csvColumn: "NomeFra" },
];

/** Lingua di fallback finale prima dell'id grezzo: deve essere sempre presente nel CSV. */
export const FALLBACK_LANG: Lang = "en";
