// ─────────────────────────────────────────────────────────────────────────────
//  data/citta.ts — Città salvate (FoE Optimizer 2.0, al posto dei "profili")
//
//  Ogni import con la bacchetta crea o AGGIORNA una città. Il tipo lo dice il
//  payload: `activeMap === "OtherPlayer"` = città visitata (solo la mappa),
//  altrimenti città mia (mappa, inventario, alleati, magazzino). La città si
//  riconosce dall'id del giocatore (player_id degli edifici in CityMapData):
//  reimportare la stessa città la aggiorna invece di crearne una nuova.
//
//  Le città restano salvate nella struttura dei profili della 1.x
//  (`Profile` + slot foe_p_<id>_<slot>), con in più tipo e id del giocatore:
//  campi facoltativi, quindi lo storage resta leggibile anche dalla 1.x.
// ─────────────────────────────────────────────────────────────────────────────

import type { BookmarkletData } from "./bookmarklet";
import type { Profile } from "../utils/storage";

export type TipoCitta = "mia" | "visitata";

export interface InfoImport {
  tipo: TipoCitta;
  /** player_id degli edifici (null se il payload non lo contiene). */
  playerId: number | null;
  nome: string | null;
  /** Mondo di gioco (es. "it6"): campo `server` della bacchetta v7+, null se manca o non valido. */
  mondo: string | null;
}

export function infoImport(data: BookmarkletData): InfoImport {
  let playerId: number | null = null;
  for (const e of Object.values(data.CityMapData ?? {})) {
    const p = (e as { player_id?: unknown }).player_id;
    if (typeof p === "number" && Number.isFinite(p)) { playerId = p; break; }
  }
  const nome = typeof data.playerName === "string" && data.playerName.trim() ? data.playerName.trim() : null;
  // (stessa regola della bacchetta sull'indirizzo del gioco: lettere + numero, es. it1, zz1, en23)
  const w = data.server;
  const mondo = typeof w === "string" && /^[a-z]{1,5}\d{1,4}$/.test(w) ? w : null;
  return { tipo: data.activeMap === "OtherPlayer" ? "visitata" : "mia", playerId, nome, mondo };
}

/** Lettere dei mondi: i mondi di un server si chiamano per la prima lettera
 *  del nome (it1 = Arvahall → A, it6 = Fel Dranghyr → F, it11 = Langendorn →
 *  L…), in ordine alfabetico senza la I, ciclando dopo la Z. */
const LETTERE_MONDI = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

/** Lettera con cui i giocatori chiamano un mondo ("it11" → "L"); "Beta" per
 *  il server beta (zz1); null se il codice non è valido. */
function letteraMondo(mondo: string): string | null {
  const m = /^([a-z]+)(\d+)$/.exec(mondo);
  if (!m) return null;
  if (mondo === "zz1") return "Beta";
  const n = parseInt(m[2]!, 10) - 1;
  return n < 0 ? null : LETTERE_MONDI[n % LETTERE_MONDI.length]!;
}

/** Nome di una città: il mondo, se noto, e il giocatore ("L · Sdrushi"). */
export function nomeCitta(nome: string, mondo: string | null): string {
  const l = mondo ? letteraMondo(mondo) : null;
  return l ? `${l} · ${nome}` : nome;
}

/** Città salvate col primo formato della 2.005 ("Sdrushi · L"): il mondo
 *  passa davanti ("L · Sdrushi"). I nomi scelti dall'utente restano. */
export function nomiMondoDavanti(citta: Profile[]): Profile[] {
  let cambiate = false;
  const out = citta.map(c => {
    const l = c.mondo && !c.nomeUtente ? letteraMondo(c.mondo) : null;
    const fine = ` · ${l}`;
    if (!l || !c.name.endsWith(fine) || c.name.length === fine.length) return c;
    cambiate = true;
    return { ...c, name: `${l} · ${c.name.slice(0, -fine.length)}` };
  });
  return cambiate ? out : citta;
}

/** Soglia di somiglianza (vedi `somiglianza` di trovaCitta) oltre la quale
 *  una città salvata SENZA mondo è considerata la stessa dell'import. */
const SOGLIA_STESSA_CITTA = 0.5;

/** Città già salvata che corrisponde all'import.
 *
 *  L'id del giocatore è lo stesso in tutti i mondi di un server (es. lo stesso
 *  account su it6 e it11, segnalato dall'utente): da solo non basta, la
 *  città è giocatore + MONDO (campo `server` della bacchetta v7).
 *  - Import con il mondo: la città dello stesso giocatore e dello stesso
 *    mondo. Se non c'è, una città dello stesso giocatore salvata SENZA mondo
 *    (bacchetta vecchia) solo se è davvero la stessa città: `somiglianza`
 *    (quota di edifici dell'import con stesso tipo e stessa posizione nella
 *    città salvata) almeno 0,5. Altrimenti è un'altra città (altro mondo):
 *    se ne crea una nuova invece di sovrascriverla.
 *  - Import senza mondo (bacchetta vecchia, file JSON): come prima, stesso
 *    giocatore; con più città di quel giocatore, la più simile.
 *  - Città salvate prima della 2.0, senza id: stesso nome. */
export function trovaCitta(citta: readonly Profile[], info: InfoImport, somiglianza?: (c: Profile) => number): Profile | undefined {
  if (info.playerId !== null) {
    const stessoGiocatore = citta.filter(c => c.playerId === info.playerId);
    const piuSimile = (lista: readonly Profile[], soglia: number) => {
      let best: Profile | undefined, bv = -1;
      for (const c of lista) { const v = somiglianza ? somiglianza(c) : 0; if (v > bv) { bv = v; best = c; } }
      return best && bv >= soglia ? best : undefined;
    };
    if (info.mondo) {
      const stessoMondo = stessoGiocatore.find(c => c.mondo === info.mondo);
      if (stessoMondo) return stessoMondo;
      const senzaMondo = piuSimile(stessoGiocatore.filter(c => !c.mondo), SOGLIA_STESSA_CITTA);
      if (senzaMondo) return senzaMondo;
    } else if (stessoGiocatore.length === 1) return stessoGiocatore[0];
    else if (stessoGiocatore.length > 1) return piuSimile(stessoGiocatore, 0) ?? stessoGiocatore[0];
    if (info.mondo) return undefined;
  }
  return info.nome ? citta.find(c => c.playerId === undefined && c.name === info.nome) : undefined;
}

/** Impronta di una città per `somiglianza`: "tipo@x,y" degli edifici (strade escluse). */
export function improntaCitta(edifici: Iterable<{ entityId: string; x: number; y: number; type?: string }>): Set<string> {
  const out = new Set<string>();
  for (const b of edifici) if (b.type !== "street") out.add(`${b.entityId}@${b.x},${b.y}`);
  return out;
}

/** Tipo di una città; per quelle salvate prima della 2.0 (senza tipo): mia se
 *  ha un inventario salvato. */
export function tipoCitta(c: Profile, haInventario: (id: string) => boolean): TipoCitta {
  return c.tipo ?? (haInventario(c.id) ? "mia" : "visitata");
}
