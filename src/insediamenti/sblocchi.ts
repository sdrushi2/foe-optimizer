/**
 * Sblocchi degli edifici di un insediamento (25/11/2026, per ora solo i Mughal).
 *
 * Nel gioco gli edifici dell'insediamento si sbloccano con gli "advancements"
 * (AdvancementService.getAll): 9 voci per i Mughal, in fila, ognuna con
 * - `rewards[0]` = cityentity_id dell'edificio sbloccato (es. "R_Mughals_Residential2");
 * - `isUnlocked` = true se sbloccato (ASSENTE se bloccato: verificato sul beta, insediamento nuovo);
 * - `requirements.resources` = costo in diplomazia e beni (basmati/saree/spices/lotus).
 *   La diplomazia è uguale per tutti, i beni CAMBIANO da giocatore a giocatore (live e beta
 *   diversi): vanno letti dall'import, mai scritti nel codice.
 * FoE Helper li tiene SOLO in memoria (`Outposts.Advancements`, niente localStorage);
 * bacchetta v9 e ponte li copiano in `pirateOutpost.advancements` come {e, u, r}.
 *
 * ⚠️ Il nome dell'advancement non è affidabile: la voce "alley"/"Vialetto" sblocca
 * J_Mughals_Diplomacy1, che nelle definizioni è il Canale d'acqua (3×2); il Vialetto
 * (J_Mughals_Diplomacy2, 2×3) è sbloccato di partenza. Conta solo l'id in `rewards`.
 *
 * Gli edifici di partenza (non presenti fra gli advancements) sono sempre sbloccati.
 * Lo stato si salva per mondo (server del pacchetto): un giocatore ha un solo insediamento
 * attivo per mondo; prima di qualsiasi import si mostra l'ultimo mondo usato.
 */

/** Un advancement come lo copiano bacchetta e ponte (forma compatta). */
export interface Sblocco {
  /** cityentity_id dell'edificio sbloccato. */
  entita: string;
  sbloccato: boolean;
  /** Costo dello sblocco: diplomazia e beni (monete e materiali esclusi: irrisori). */
  requisiti: Record<string, number>;
}

export interface StatoSblocchi {
  /** cityentity_id sbloccati (partenza esclusa: si aggiunge sempre). */
  sbloccati: string[];
  /** Advancements dell'ultimo import che li aveva (ordine del gioco), per l'ottimizzatore. */
  sblocchi?: Sblocco[];
}

import { chiaveGlobale } from "../utils/storage";

const RISORSE_IGNORATE = new Set(["money", "supplies", "coins"]);

/** Legge e ripulisce `pirateOutpost.advancements` (dati non fidati). Tiene solo le voci
 *  dell'insediamento con questo prefisso (es. "_Mughals_"): con un altro insediamento in
 *  memoria nel gioco la lista sarebbe di un'altra civiltà. null = niente di utilizzabile. */
export function leggiSblocchi(raw: unknown, prefisso: string): Sblocco[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) return null;
  const out: Sblocco[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") return null;
    const o = a as Record<string, unknown>;
    if (typeof o.e !== "string" || !o.e.includes(prefisso) || o.e.length > 80) return null;
    const requisiti: Record<string, number> = {};
    if (o.r && typeof o.r === "object" && !Array.isArray(o.r)) {
      for (const [k, v] of Object.entries(o.r as Record<string, unknown>)) {
        if (k === "__class__" || RISORSE_IGNORATE.has(k) || typeof v !== "number" || !Number.isFinite(v) || v < 0) continue;
        if (k.length <= 40) requisiti[k] = v;
      }
    }
    out.push({ entita: o.e, sbloccato: o.u === true, requisiti });
  }
  return out;
}

const chiaveMondo = (insediamento: string, mondo: string) => chiaveGlobale("sblocchi", insediamento, mondo);
const chiaveUltimo = (insediamento: string) => chiaveGlobale("sblocchi", insediamento, "ultimo");

/** Stato salvato del mondo indicato, o dell'ultimo usato se il mondo non è noto. */
export function caricaSblocchi(insediamento: string, mondo?: string | null): { mondo: string | null; stato: StatoSblocchi | null } {
  try {
    const m = mondo ?? localStorage.getItem(chiaveUltimo(insediamento));
    if (!m) return { mondo: null, stato: null };
    const raw = localStorage.getItem(chiaveMondo(insediamento, m));
    if (!raw) return { mondo: m, stato: null };
    const p = JSON.parse(raw) as StatoSblocchi;
    if (!p || !Array.isArray(p.sbloccati) || !p.sbloccati.every((x) => typeof x === "string")) return { mondo: m, stato: null };
    return { mondo: m, stato: { sbloccati: p.sbloccati, sblocchi: Array.isArray(p.sblocchi) ? p.sblocchi : undefined } };
  } catch {
    return { mondo: null, stato: null };
  }
}

export function salvaSblocchi(insediamento: string, mondo: string | null, stato: StatoSblocchi): void {
  if (!mondo) return; // senza un import non c'è un mondo: le caselle valgono solo per la sessione
  try {
    localStorage.setItem(chiaveMondo(insediamento, mondo), JSON.stringify(stato));
    localStorage.setItem(chiaveUltimo(insediamento), mondo);
  } catch { /* storage pieno: resta in memoria */ }
}

/**
 * Stato dopo un import: con gli advancements comanda il gioco (sbloccati = quelli con
 * isUnlocked); senza, restano le caselle salvate. In entrambi i casi gli edifici presenti
 * sulla mappa importata sono sbloccati per forza.
 */
export function statoDopoImport(salvato: StatoSblocchi | null, sblocchi: Sblocco[] | null, presenti: Iterable<string>): StatoSblocchi {
  const s = new Set<string>(sblocchi ? sblocchi.filter((x) => x.sbloccato).map((x) => x.entita) : salvato?.sbloccati ?? []);
  for (const p of presenti) s.add(p);
  return { sbloccati: [...s].sort(), sblocchi: sblocchi ?? salvato?.sblocchi };
}
