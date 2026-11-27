// ─────────────────────────────────────────────────────────────────────────────
//  editor/lettura.ts — "Importa JSON" e "Salva JSON" dell'editor (27/11/2026)
//
//  Caricato a richiesta da editor/condiviso.ts DOPO i dati del gioco (i moduli
//  del lettore li leggono appena caricati). Stesso lettore del tool (leggiCitta,
//  data/cityMapJson.ts), stessi messaggi d'errore (data/erroriJson.ts), stesso
//  formato dell'export della Mappa.
// ─────────────────────────────────────────────────────────────────────────────

import { ErroreJsonCitta, esportaCittaJson, leggiCittaDati, type MetaExport } from "../data/cityMapJson";
import { messaggioErroreJson } from "../data/erroriJson";
import { localDateStamp, prefissoFile } from "../utils/format";

export { impostaCatalogoExtra } from "../data/cityMapJson";

/** Giocatore ed era della città nell'editor (per il JSON salvato). */
type Meta = { player?: { id: number | null; name: string }; currentEra?: string; avatar?: string };

/** Qualsiasi JSON della città che legge il tool (completa o solo città: conta la
 *  mappa), convertito nel formato dell'export della Mappa, che l'editor disegna. */
export function leggiJson(testo: string, lang: "it" | "en"): { ok: true; json: unknown; ignorati: string[]; nome: string | null } | { ok: false; errore: string } {
  try {
    let dati: unknown;
    try { dati = JSON.parse(testo); } catch { throw new ErroreJsonCitta("json"); }
    const c = leggiCittaDati(dati);
    const meta: MetaExport = {
      ...(c.giocatore ? { player: { id: c.giocatore.id, name: c.giocatore.nome } } : {}),
      ...(c.giocatore?.era ? { currentEra: c.giocatore.era } : {}),
      ...(c.avatar ? { avatar: c.avatar } : {}),
    };
    return { ok: true, json: esportaCittaJson(c.buildings, c.aree, undefined, meta), ignorati: c.ignorati ?? [], nome: c.giocatore?.nome ?? null };
  } catch (err) {
    return { ok: false, errore: messaggioErroreJson(err, lang) };
  }
}

/** Solo la città (la mappa modificata), nel formato dell'export della Mappa;
 *  nome <città>-citta-<data>.json (`nome` = nome della città dal tool o dal file importato,
 *  altrimenti il giocatore del JSON). `json` = esporta() dell'editor. */
export function jsonDaSalvare(json: unknown, meta: Meta, nome?: string | null): { nome: string; testo: string } {
  const c = leggiCittaDati(json);
  const out = esportaCittaJson(c.buildings, c.aree, undefined, { ...meta, cittaReale: c.buildings });
  return { nome: `${prefissoFile(nome || meta.player?.name)}-citta-${localDateStamp()}.json`, testo: JSON.stringify(out, null, 2) };
}
