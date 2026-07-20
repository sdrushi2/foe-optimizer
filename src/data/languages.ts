/**
 * Lingue supportate per i nomi di edifici e alleati (NomeIta/NomeEng/... nei
 * CSV). Vive in un modulo separato — non in translations.ts — perché sia
 * buildings.ts/allies.ts (che leggono le colonne durante il parsing) sia
 * translations.ts (che costruisce le mappe id->nome) devono poterlo
 * importare senza creare un ciclo tra loro.
 *
 * Per aggiungere una lingua (es. tedesco), la ricetta COMPLETA è:
 *  1. una riga in LANGUAGES qui sotto (il codice è già in Lang);
 *  2. la colonna corrispondente (es. "NomeDeu") in TUTTI E TRE i CSV che
 *     leggono LANGUAGES: buildings.csv, allies.csv e ages.csv. Attenzione:
 *     ages.csv si edita a mano (23 righe), ma le colonne di buildings/allies
 *     le genera la PIPELINE di RECUPERO DATI — servono un MainParser_deu.txt
 *     dal server tedesco e l'estensione di buildings.py/allies.py (e di
 *     parse_kit.py per i nomi dei kit in kit.json);
 *  3. nessun'altra modifica di codice lato app: parser e mappe di traduzione
 *     raccolgono la colonna in automatico.
 * Finché la colonna manca da un CSV, quella lingua resta semplicemente
 * assente dalle sue mappe (fallback sull'inglese, poi sull'id grezzo).
 * Nota: la lingua della GUI (UiLang in ui-strings.ts, solo it/en) è un
 * concetto SEPARATO e ha la sua ricetta — vedi UI_LANGUAGES.
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
