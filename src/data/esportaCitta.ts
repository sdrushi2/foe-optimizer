// ─────────────────────────────────────────────────────────────────────────────
//  data/esportaCitta.ts — Esporta una città salvata dal menu delle città (27/11/2026)
//
//  Due file, scelti dai pulsanti del menu (ui/SelettoreCitta.tsx):
//  - "solo la città": il JSON della mappa (formato di Forge Hammer + quello della
//    bacchetta, vedi data/cityMapJson.ts), lo stesso del pulsante JSON della Mappa.
//    Nome: <giocatore>-citta-<data>.json
//  - "città completa": lo stesso file con in più il blocco `foeOptimizer`, che porta
//    gli slot salvati della città così come sono (città, inventario, alleati,
//    risorse: blob compressi, vedi utils/storage.ts) e i dati del giocatore. Forge
//    Hammer e gli altri planner ignorano il blocco e leggono la mappa.
//    Nome: <giocatore>-completa-<data>.json
//  Gli edifici sbloccati degli insediamenti NON ci sono: si salvano per mondo, non
//  per città, e importarli sovrascriverebbe i propri dello stesso mondo.
//  Import del pacchetto completo: App.tsx (importaCittaCompleta), con leggiPacchettoCompleto.
// ─────────────────────────────────────────────────────────────────────────────

import { esportaCittaJson, type CityMapJson } from "./cityMapJson";
import { initCityStore, profileStorageKey, PROFILE_SLOTS, type Profile, type ProfileSlot } from "../utils/storage";
import { localDateStamp, prefissoFile } from "../utils/format";
import { nomeCitta } from "./citta";

export interface PacchettoCompleto {
  tipo: "completa";
  formato: 1;
  versioneApp: string;
  giocatore: { nome: string; id: number | null; mondo: string | null; avatar: string | null };
  /** slot salvati della città, testo così come sta nel browser */
  slot: Partial<Record<ProfileSlot, string>>;
}

/** Nome del giocatore: quello della città senza la lettera del mondo davanti ("F · Sdrushi" → "Sdrushi"). */
function nomeGiocatore(p: Profile): string {
  const pref = p.mondo ? nomeCitta("", p.mondo) : "";
  return pref && p.name.startsWith(pref) && p.name.length > pref.length ? p.name.slice(pref.length) : p.name;
}

/** Il file da scaricare per una città salvata, o null se la città non ha la mappa. */
export function fileCitta(p: Profile, completa: boolean, versioneApp: string): { nome: string; dati: CityMapJson & { foeOptimizer?: PacchettoCompleto } } | null {
  const s = initCityStore(p.id);
  if (!s?.cityMapBuildings?.length) return null;
  const dati: CityMapJson & { foeOptimizer?: PacchettoCompleto } = esportaCittaJson(s.cityMapBuildings, s.cityMapUnlockedAreas ?? [], undefined, {
    player: { id: p.playerId ?? null, name: nomeGiocatore(p) },
    region: s.gameLang,
    ...(s.currentEra ? { currentEra: s.currentEra } : {}),
    cittaReale: s.cityMapBuildings,
    grandiEdifici: new Map((s.greatBuildingsJson ?? []).map(([id, gb]) => [id, (gb.rawEntry ?? {}) as Record<string, unknown>])),
  });
  if (completa) {
    const slot: Partial<Record<ProfileSlot, string>> = {};
    for (const k of PROFILE_SLOTS) { const v = localStorage.getItem(profileStorageKey(p.id, k)); if (v) slot[k] = v; }
    dati.foeOptimizer = { tipo: "completa", formato: 1, versioneApp,
      giocatore: { nome: nomeGiocatore(p), id: p.playerId ?? null, mondo: p.mondo ?? null, avatar: p.avatar ?? null }, slot };
  }
  return { nome: `${prefissoFile(p.name)}-${completa ? "completa" : "citta"}-${localDateStamp()}.json`, dati };
}

export function scaricaFile(dati: unknown, nome: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dati)], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Il blocco della città completa, ripulito (file di chiunque: dati non fidati), o null. */
export function leggiPacchettoCompleto(d: unknown): PacchettoCompleto | null {
  if (!d || typeof d !== "object") return null;
  const b = (d as { foeOptimizer?: unknown }).foeOptimizer;
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  if (o.tipo !== "completa" || !o.slot || typeof o.slot !== "object") return null;
  const slot: Partial<Record<ProfileSlot, string>> = {};
  for (const k of PROFILE_SLOTS) { const v = (o.slot as Record<string, unknown>)[k]; if (typeof v === "string" && v) slot[k] = v; }
  if (!slot.city) return null;
  const g = (o.giocatore && typeof o.giocatore === "object" ? o.giocatore : {}) as Record<string, unknown>;
  return {
    tipo: "completa", formato: 1, versioneApp: typeof o.versioneApp === "string" ? o.versioneApp.slice(0, 20) : "",
    giocatore: {
      nome: typeof g.nome === "string" && g.nome.trim() ? g.nome.trim().slice(0, 80) : "",
      id: typeof g.id === "number" && Number.isFinite(g.id) ? g.id : null,
      mondo: typeof g.mondo === "string" && g.mondo.length <= 20 ? g.mondo : null,
      avatar: typeof g.avatar === "string" && g.avatar.startsWith("https://") && g.avatar.length <= 300 ? g.avatar : null,
    },
    slot,
  };
}
