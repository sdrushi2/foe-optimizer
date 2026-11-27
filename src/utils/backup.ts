// ─────────────────────────────────────────────────────────────────────────────
//  utils/backup.ts — Opzioni › Backup: "Esporta backup" / "Ripristina backup"
//
//  27/11/2026 (richiesta dell'utente): il backup è un backup vero.
//  - Esporta: TUTTO quello che il tool salva nel browser (chiavi foe_* più tema e
//    potenza CPU del Planner), tranne le impronte del ponte (servono solo a
//    capire se un pacchetto del gioco è già stato importato).
//  - Ripristina: SOSTITUISCE tutto. Cancella i dati attuali e scrive quelli del
//    file; se la scrittura fallisce (memoria piena) rimette i dati di prima.
//    Le impronte del ponte restano azzerate: alla prima apertura del gioco il
//    ponte aggiorna le città ripristinate.
//  Formato del file: { app: "foe-optimizer", tipo: "backup", formato: 2,
//  versioneApp, exportedAt, storage }. Si leggono anche i backup della 1.x
//  ({ app, version: "1.1", exportedAt, profileId, storage }): i dati delle città
//  passano alle chiavi della versione attuale, le impostazioni di altre versioni
//  di storage no (cleanupOrphanedKeys le cancellerebbe comunque).
// ─────────────────────────────────────────────────────────────────────────────

import {
  PROFILES_KEY, ACTIVE_PROFILE_KEY, PROFILE_SLOTS, VERSIONE_STORAGE, TEMA_KEY, POTENZA_PLANNER_KEY,
  profileStorageKey, type Profile,
} from "./storage";

const CHIAVI_EXTRA: readonly string[] = [TEMA_KEY, POTENZA_PLANNER_KEY];
const nostra = (k: string) => k.startsWith("foe_") || CHIAVI_EXTRA.includes(k);
/** Impronte degli ultimi import del ponte (data/ponte.ts): né esportate né ripristinate. */
const impronta = (k: string) => /^foe_global_ponte_(ultimo|insediamento)_/.test(k);
const chiaveProfili = /^foe_global_profiles_v\d+$/;
const chiaveAttivo = /^foe_global_active_profile_v\d+$/;

/** Le chiavi del tool presenti ora nel browser (impronte del ponte escluse). */
export function raccogliBackup(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && nostra(k) && !impronta(k)) out[k] = localStorage.getItem(k) ?? "";
  }
  return out;
}

export function testoBackup(storage: Record<string, string>, versioneApp: string): string {
  return JSON.stringify({ app: "foe-optimizer", tipo: "backup", formato: 2, versioneApp, exportedAt: new Date().toISOString(), storage });
}

/** La chiave di una versione: quella attuale se c'è, altrimenti la prima di un'altra versione. */
function trova(storage: Record<string, string>, attuale: string, re: RegExp): string | undefined {
  return storage[attuale] !== undefined ? attuale : Object.keys(storage).find(k => re.test(k));
}

/** Profili del file, ripuliti (il file può venire da chiunque: dati non fidati). */
function profiliDi(storage: Record<string, string>): Array<{ originale: string | null; p: Profile }> {
  const k = trova(storage, PROFILES_KEY, chiaveProfili);
  let lista: unknown;
  try { lista = k ? JSON.parse(storage[k] ?? "[]") : []; } catch { lista = []; }
  if (!Array.isArray(lista)) return [];
  const usati = new Set<string>();
  return lista.flatMap((v: unknown, i) => {
    if (!v || typeof v !== "object") return [];
    const o = v as Record<string, unknown>;
    const orig = typeof o.id === "string" && /^[\w-]{1,80}$/.test(o.id) ? o.id : null;
    let id = orig && !usati.has(orig) ? orig : `p_backup_${Date.now()}_${i}`;
    while (usati.has(id)) id += "x";
    usati.add(id);
    const p: Profile = { id, name: typeof o.name === "string" && o.name.trim() ? o.name.slice(0, 80) : `#${i + 1}` };
    if (o.tipo === "mia" || o.tipo === "visitata") p.tipo = o.tipo;
    if (typeof o.playerId === "number" && Number.isFinite(o.playerId)) p.playerId = o.playerId;
    if (typeof o.mondo === "string" && o.mondo.length <= 20) p.mondo = o.mondo;
    if (typeof o.avatar === "string" && o.avatar.startsWith("https://") && o.avatar.length <= 300) p.avatar = o.avatar;
    if (o.origine === "json") p.origine = "json";
    if (o.nomeUtente === true) p.nomeUtente = true;
    if (o.completa === true) p.completa = true;
    // un id rifatto non ritrova i suoi dati: la città resterebbe vuota
    return [{ originale: orig === id ? orig : null, p }];
  });
}

export interface RiepilogoBackup {
  /** tipo: quello salvato o, per le città di prima della 2.0, mia se ha l'inventario (come data/citta.ts) */
  citta: Array<{ nome: string; tipo: "mia" | "visitata" }>;
  /** preferenze (lingua, tema, pesi, colonne, opzioni…) */
  impostazioni: number;
  /** insediamenti con gli edifici sbloccati salvati (per mondo) */
  insediamenti: number;
  /** caratteri (chiavi + valori), come li conta il browser */
  dimensione: number;
}

export function riepilogoBackup(storage: Record<string, string>): RiepilogoBackup {
  const chiavi = Object.keys(storage);
  return {
    citta: profiliDi(storage).map(({ originale, p }) => ({
      nome: p.name,
      tipo: p.tipo ?? (originale && chiavi.some(k => k.startsWith(`foe_p_${originale}_inventory_v`)) ? "mia" : "visitata"),
    })),
    impostazioni: chiavi.filter(k => CHIAVI_EXTRA.includes(k) || (k.startsWith("foe_global_") && k.endsWith(`_${VERSIONE_STORAGE}`)
      && !chiaveProfili.test(k) && !chiaveAttivo.test(k) && !k.startsWith("foe_global_sblocchi_") && !impronta(k))).length,
    insediamenti: chiavi.filter(k => k.startsWith("foe_global_sblocchi_") && !k.includes("_ultimo_")).length,
    dimensione: chiavi.reduce((s, k) => s + k.length + (storage[k]?.length ?? 0), 0),
  };
}

export type LetturaBackup =
  | { ok: true; storage: Record<string, string>; data: Date | null; versioneApp: string | null; riepilogo: RiepilogoBackup }
  /** json = non è JSON; citta = è la mappa di una città; altro = non è un backup; vuoto = backup senza dati */
  | { ok: false; errore: "json" | "citta" | "altro" | "vuoto" };

export function leggiBackup(testo: string): LetturaBackup {
  let d: unknown;
  try { d = JSON.parse(testo); } catch { return { ok: false, errore: "json" }; }
  if (!d || typeof d !== "object" || Array.isArray(d)) return { ok: false, errore: "altro" };
  const o = d as Record<string, unknown>;
  if (o.app !== "foe-optimizer" || !o.storage || typeof o.storage !== "object" || Array.isArray(o.storage)) {
    const dentro = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : o;
    return { ok: false, errore: "cityData" in dentro || "CityMapData" in dentro || "mapBuildings" in dentro ? "citta" : "altro" };
  }
  const storage: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.storage as Record<string, unknown>)) if (typeof v === "string" && nostra(k) && !impronta(k)) storage[k] = v;
  const riepilogo = riepilogoBackup(storage);
  if (!riepilogo.citta.length && !riepilogo.impostazioni && !riepilogo.insediamenti) return { ok: false, errore: "vuoto" };
  const t = typeof o.exportedAt === "string" ? new Date(o.exportedAt) : null;
  return {
    ok: true, storage, riepilogo,
    data: t && !Number.isNaN(t.getTime()) ? t : null,
    versioneApp: typeof o.versioneApp === "string" ? o.versioneApp.slice(0, 20) : null,
  };
}

/** Le chiavi da scrivere: città sulle chiavi della versione attuale, impostazioni della versione attuale. */
function daScrivere(storage: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const profili = profiliDi(storage);
  if (profili.length) out[PROFILES_KEY] = JSON.stringify(profili.map(x => x.p));
  for (const { originale, p } of profili) {
    if (!originale) continue;
    for (const slot of PROFILE_SLOTS) {
      const pref = `foe_p_${originale}_${slot}_v`;
      const k = storage[profileStorageKey(originale, slot)] !== undefined ? profileStorageKey(originale, slot) : Object.keys(storage).find(x => x.startsWith(pref));
      if (k) out[profileStorageKey(p.id, slot)] = storage[k]!;
    }
  }
  const ka = trova(storage, ACTIVE_PROFILE_KEY, chiaveAttivo);
  const attivo = ka ? storage[ka] : undefined;
  if (profili.length) out[ACTIVE_PROFILE_KEY] = profili.some(x => x.p.id === attivo) ? attivo! : profili[0]!.p.id;
  for (const [k, v] of Object.entries(storage)) {
    if (k.startsWith("foe_p_") || chiaveProfili.test(k) || chiaveAttivo.test(k) || impronta(k)) continue;
    if (CHIAVI_EXTRA.includes(k) || (k.startsWith("foe_global_") && k.endsWith(`_${VERSIONE_STORAGE}`))) out[k] = v;
  }
  return out;
}

function chiaviNostre(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && nostra(k)) out.push(k);
  }
  return out;
}

/** Sostituisce tutti i dati del tool con quelli del backup. Se una scrittura
 *  fallisce rimette i dati di prima (spazio = memoria del browser piena). */
export function ripristinaBackup(storage: Record<string, string>): { ok: true } | { ok: false; motivo: "spazio" | "altro" } {
  const nuovi = daScrivere(storage);
  const prima: Record<string, string> = {};
  for (const k of chiaviNostre()) prima[k] = localStorage.getItem(k) ?? "";
  try {
    for (const k of Object.keys(prima)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(nuovi)) localStorage.setItem(k, v);
    return { ok: true };
  } catch (e) {
    for (const k of chiaviNostre()) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(prima)) { try { localStorage.setItem(k, v); } catch { /* ci stava prima: non dovrebbe succedere */ } }
    return { ok: false, motivo: e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22) ? "spazio" : "altro" };
  }
}
