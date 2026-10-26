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
  /** Mondo (es. "it6"): oggi la bacchetta non lo manda (decisione utente), resta sempre null. */
  mondo: string | null;
}

export function infoImport(data: BookmarkletData): InfoImport {
  let playerId: number | null = null;
  for (const e of Object.values(data.CityMapData ?? {})) {
    const p = (e as { player_id?: unknown }).player_id;
    if (typeof p === "number" && Number.isFinite(p)) { playerId = p; break; }
  }
  const nome = typeof data.playerName === "string" && data.playerName.trim() ? data.playerName.trim() : null;
  const w = (data as { world?: unknown }).world;
  const mondo = typeof w === "string" && w.length <= 20 ? w : null;
  return { tipo: data.activeMap === "OtherPlayer" ? "visitata" : "mia", playerId, nome, mondo };
}

/** Città già salvata che corrisponde all'import: stesso giocatore (e stesso
 *  mondo, se noto); per le città salvate prima della 2.0, senza id, stesso nome. */
export function trovaCitta(citta: readonly Profile[], info: InfoImport): Profile | undefined {
  if (info.playerId !== null) {
    const perId = citta.find(c => c.playerId === info.playerId && (!c.mondo || !info.mondo || c.mondo === info.mondo));
    if (perId) return perId;
  }
  return info.nome ? citta.find(c => c.playerId === undefined && c.name === info.nome) : undefined;
}

/** Tipo di una città; per quelle salvate prima della 2.0 (senza tipo): mia se
 *  ha un inventario salvato. */
export function tipoCitta(c: Profile, haInventario: (id: string) => boolean): TipoCitta {
  return c.tipo ?? (haInventario(c.id) ? "mia" : "visitata");
}
