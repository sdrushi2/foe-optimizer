// ─────────────────────────────────────────────────────────────────────────────
//  data/erroriJson.ts — Messaggio per l'utente di un errore di lettura di un JSON
//  della città (27/11/2026): lo stesso per Importa da JSON, Planner ed editor,
//  nella lingua dell'interfaccia (il lettore, data/cityMapJson.ts, dà solo un codice).
// ─────────────────────────────────────────────────────────────────────────────

import { ErroreJsonCitta } from "./cityMapJson";
import { t, type UiLang } from "./ui-strings";

export function messaggioErroreJson(err: unknown, lang: UiLang): string {
  if (err instanceof ErroreJsonCitta) {
    return t(err.codice === "json" ? "r2JsonErrJson" : err.codice === "backup" ? "r2JsonIsBackup" : err.codice === "senzaEspansioni" ? "r2JsonErrNoAreas"
      : err.codice === "senzaMunicipio" ? "r2JsonErrNoTownHall" : "r2JsonErrNoCity", lang);
  }
  return t("r2JsonErrOther", lang, err instanceof Error ? err.message : String(err));
}
