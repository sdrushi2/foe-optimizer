// ─────────────────────────────────────────────────────────────────────────────
//  data/ponte.ts — Ascolto del "ponte" (estensione FoE Optimizer Bridge)
//
//  L'estensione (facoltativa, caricata a mano dall'utente) legge la città
//  PROPRIA da FoE Helper quando cambia nel gioco e la passa a questa pagina
//  con window.postMessage ({ type: "foe-bridge", event, … }; l'estensione è
//  tutta in inglese, protocollo compreso). Solo lettura:
//  nessuna richiesta al server del gioco. Le città visitate non passano mai
//  dal ponte (per quelle resta la bacchetta).
//
//  Eventi dall'estensione (campo `event`):
//   - "presence": segnale ogni 15 s, con le schede del gioco aperte
//     (`gameTabs`). Senza segnali per PRESENZA_MS il ponte è spento (estensione
//     assente, disattivata o che non risponde) → indicatore OFF.
//   - "game-tabs": schede del gioco aperte (`n`).
//   - "offline": l'estensione è stata disattivata o tolta (lo script nella
//     pagina se ne accorge subito): OFF senza aspettare PRESENZA_MS.
//   - "city": il pacchetto della bacchetta SENZA CityEntities (le definizioni
//     degli edifici, ~63 MB) in `json`, con `server`, `player`, `ts` e la firma
//     delle definizioni (`signature`, versione del gioco).
//   - "definitions": le definizioni a pezzi (`signature`, `part`, `parts`,
//     `text`), solo quando la pagina le chiede (definizioniDalPonte).
//  Richieste della pagina: { type: "foe-bridge-request", what: "presence" |
//  "snapshot" | "definitions", signature? }.
//
//  Un unico ascolto per tutta la pagina (store a livello di modulo): lo usano
//  l'indicatore (usePonte) e l'import di App (pacchettiPonte).
//  Con più giochi aperti (es. beta e live) si tiene l'ultimo pacchetto di
//  OGNI mondo e giocatore, e le definizioni si chiedono per firma.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

/** Impronta dell'ultima città importata dal ponte, per mondo e giocatore (+ "<mondo>_<id>"). */
export const PONTE_ULTIMO_KEY = "foe_global_ponte_ultimo_";

/** Oltre questo tempo senza segnali il ponte è spento (3 segnali persi). */
const PRESENZA_MS = 45_000;

export interface StatoPonte {
  /** L'estensione c'è e risponde. */
  presente: boolean;
  /** Versione dell'estensione (dall'ultimo segnale). */
  versione: string | null;
  /** Schede del gioco aperte (-1 = non ancora noto). */
  schede: number;
  /** Ultima città ricevuta dal gioco (solo i dati per l'indicatore). */
  ultima: { giocatore: string; server: string; ts: number } | null;
  /** Cresce a ogni città ricevuta: fa lampeggiare il pallino e riprova l'import. */
  arrivi: number;
  /** Ponte in pausa (scelta dell'utente, salvata): i pacchetti arrivano ma non si importano. */
  pausa: boolean;
}

/** Ultimo pacchetto della città propria arrivato dal gioco. */
export interface PacchettoPonte {
  /** Pacchetto della bacchetta senza CityEntities, come testo JSON. */
  json: string;
  server: string;
  giocatore: string;
  /** Firma delle definizioni degli edifici (versione del gioco). */
  entitaFirma: string;
  ts: number;
  /** Il pacchetto già letto (con CityEntities vuoto), solo da leggere: calcolato una volta all'arrivo. */
  leggero: Record<string, unknown> | null;
  /** improntaDati del pacchetto, calcolata una volta all'arrivo ("" se illeggibile). */
  impronta: string;
}

/** Pausa del ponte (24/11/2026): resta anche ricaricando il tool, finché non la si toglie. */
const PAUSA_KEY = "foe_global_ponte_pausa";
function leggiPausa(): boolean { try { return localStorage.getItem(PAUSA_KEY) === "1"; } catch { return false; } }

const INIZIALE: StatoPonte = { presente: false, versione: null, schede: -1, ultima: null, arrivi: 0, pausa: false };

/** Messaggio dell'estensione (protocollo in inglese). */
interface MessaggioPonte {
  type?: unknown; event?: unknown; version?: unknown; gameTabs?: unknown; n?: unknown;
  player?: unknown; server?: unknown; ts?: unknown; json?: unknown; signature?: unknown;
  part?: unknown; parts?: unknown; text?: unknown;
}

let stato: StatoPonte = { ...INIZIALE, pausa: leggiPausa() };
/** Ultimo pacchetto per mondo e giocatore ("it6|Sdrushi"). */
const pacchetti = new Map<string, PacchettoPonte>();
const ascoltatori = new Set<() => void>();
let ultimoSegnale = 0;
let avviato = false;
/** Definizioni in arrivo a pezzi (una firma alla volta) e chi le aspetta. */
let pezzi: { firma: string; parti: (string | null)[]; arrivate: number } | null = null;
let attese: Array<{ firma: string; ok: (d: { firma: string; testo: string }) => void }> = [];
/** Definizioni già ricevute, per firma (24/11/2026): finché la scheda del tool è aperta un
 *  nuovo import non se le fa ridare dall'estensione (63 MB letti, passati e ricomposti a
 *  ogni import). Cambiano solo con un aggiornamento del gioco; al massimo due versioni
 *  (live e beta aperte insieme). Chiudendo la scheda si svuota: il primo import dopo la
 *  riapertura le richiede all'estensione, che le ha salvate. */
const DEF_IN_MEMORIA = 2;
const definizioniInMemoria = new Map<string, string>();
function ricordaDefinizioni(firma: string, testo: string) {
  definizioniInMemoria.delete(firma);
  definizioniInMemoria.set(firma, testo);
  while (definizioniInMemoria.size > DEF_IN_MEMORIA) definizioniInMemoria.delete(definizioniInMemoria.keys().next().value!);
}

function aggiorna(nuovo: StatoPonte) { stato = nuovo; ascoltatori.forEach(f => f()); }

function ascolta(e: MessageEvent) {
  if (e.source !== window || e.origin !== location.origin) return;
  const m = e.data as MessaggioPonte | null;
  if (!m || m.type !== "foe-bridge") return;
  if (m.event === "offline") {
    ultimoSegnale = 0;
    pacchetti.clear();
    aggiorna({ ...INIZIALE, ultima: stato.ultima, arrivi: stato.arrivi, pausa: stato.pausa });
    return;
  }
  ultimoSegnale = Date.now();
  const versione = typeof m.version === "string" ? m.version : stato.versione;
  if (m.event === "presence") aggiorna({ ...stato, presente: true, versione, ...(typeof m.gameTabs === "number" ? { schede: m.gameTabs } : {}) });
  else if (m.event === "game-tabs" && typeof m.n === "number") aggiorna({ ...stato, presente: true, versione, schede: m.n });
  else if (m.event === "city" && typeof m.player === "string" && typeof m.server === "string" && typeof m.json === "string") {
    const ts = typeof m.ts === "number" ? m.ts : Date.now();
    let leggero: Record<string, unknown> | null = null, impronta = "";
    try { leggero = { ...(JSON.parse(m.json) as Record<string, unknown>), CityEntities: {} }; impronta = improntaDati(leggero); } catch { /* illeggibile: App lo salta */ }
    pacchetti.set(m.server + "|" + m.player, { json: m.json, server: m.server, giocatore: m.player, entitaFirma: typeof m.signature === "string" ? m.signature : "", ts, leggero, impronta });
    // una città arrivata vuol dire che almeno una scheda del gioco è aperta
    aggiorna({ ...stato, presente: true, versione, schede: Math.max(1, stato.schede), ultima: { giocatore: m.player, server: m.server, ts }, arrivi: stato.arrivi + 1 });
  } else if (m.event === "definitions" && typeof m.signature === "string" && typeof m.part === "number" && typeof m.parts === "number" && typeof m.text === "string") {
    if (!pezzi || pezzi.firma !== m.signature || pezzi.parti.length !== m.parts) pezzi = { firma: m.signature, parti: new Array<string | null>(m.parts).fill(null), arrivate: 0 };
    if (pezzi.parti[m.part] == null) { pezzi.parti[m.part] = m.text; pezzi.arrivate++; }
    if (pezzi.arrivate === m.parts) {
      const fatto = { firma: pezzi.firma, testo: pezzi.parti.join("") };
      pezzi = null;
      ricordaDefinizioni(fatto.firma, fatto.testo);
      const chi = attese.filter(a => a.firma === fatto.firma);
      attese = attese.filter(a => a.firma !== fatto.firma);
      chi.forEach(a => a.ok(fatto));
    }
  } else if (!stato.presente) aggiorna({ ...stato, presente: true, versione });
}

function avvia() {
  if (avviato || typeof window === "undefined") return;
  avviato = true;
  window.addEventListener("message", ascolta);
  // l'estensione può essersi annunciata prima che la pagina ascoltasse: le si chiede
  window.postMessage({ type: "foe-bridge-request", what: "presence" }, location.origin);
  // e le città dei giochi aperti arrivano appena l'estensione si collega, spesso
  // PRIMA che l'app sia avviata (dati di gioco da scaricare): andavano perse e
  // aprendo il tool dopo il gioco non si creava nulla. Se ne chiede una fotografia
  // nuova adesso (leggera: solo le città, senza definizioni).
  window.postMessage({ type: "foe-bridge-request", what: "snapshot" }, location.origin);
  // (24/11/2026, revisione) Con la scheda nascosta da più di 5 minuti Chrome fa girare i
  // timer al massimo una volta al minuto, anche quelli dell'estensione nella pagina: i
  // segnali di presenza diradano e il controllo dei 45 s dava OFF e BUTTAVA i pacchetti
  // (tornando sul tool non si importava l'ultima modifica). Ora: niente OFF per silenzio
  // mentre la pagina è nascosta; i pacchetti restano (si buttano solo con "offline", cioè
  // estensione disattivata); tornando visibili si chiede subito presenza e fotografia.
  // Finché il ponte non c'è la pagina si ripresenta ogni 10 s: l'estensione resta muta
  // finché una pagina non si presenta (le altre pagine su localhost non ricevono nulla)
  // e, iniettata in una scheda già aperta, aspetta questo segnale.
  let giri = 0;
  setInterval(() => {
    giri++;
    if (!stato.presente && giri % 2 === 0) window.postMessage({ type: "foe-bridge-request", what: "presence" }, location.origin);
    if (document.hidden) return;
    if (ultimoSegnale && Date.now() - ultimoSegnale > PRESENZA_MS) {
      ultimoSegnale = 0;
      aggiorna({ ...INIZIALE, ultima: stato.ultima, arrivi: stato.arrivi, pausa: stato.pausa });
    }
  }, 5_000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (ultimoSegnale) ultimoSegnale = Date.now();   // margine: il primo segnale arriva tra poco
    window.postMessage({ type: "foe-bridge-request", what: "presence" }, location.origin);
    window.postMessage({ type: "foe-bridge-request", what: "snapshot" }, location.origin);
  });
}

/** Stato del ponte per l'indicatore (e per far ripartire l'import a ogni arrivo). */
export function usePonte(): StatoPonte {
  const [s, setS] = useState<StatoPonte>(stato);
  useEffect(() => {
    avvia();
    const f = () => setS(stato);
    ascoltatori.add(f);
    f();
    return () => { ascoltatori.delete(f); };
  }, []);
  return s;
}

/** Ultimo pacchetto di ogni città propria arrivata dal gioco (uno per mondo e giocatore). */
/** Mette in pausa o riprende il ponte (clic sull'indicatore). Riprendendo, App importa l'ultimo pacchetto se è cambiato. */
export function impostaPausaPonte(pausa: boolean) {
  try { if (pausa) localStorage.setItem(PAUSA_KEY, "1"); else localStorage.removeItem(PAUSA_KEY); } catch { /* resta solo per questa sessione */ }
  aggiorna({ ...stato, pausa });
}

export function pacchettiPonte(): PacchettoPonte[] { return [...pacchetti.values()]; }
/** Ultimo pacchetto di quel mondo e giocatore. */
export function pacchettoPonte(server: string, giocatore: string): PacchettoPonte | null { return pacchetti.get(server + "|" + giocatore) ?? null; }

/** Chiede all'estensione le definizioni degli edifici con quella firma (dalla
 *  sua copia salvata: il gioco non si ferma) e le restituisce come testo JSON.
 *  Subito dopo l'estensione manda anche una città fresca di quel mondo. */
export function definizioniDalPonte(firma: string, attesaMs = 60_000): Promise<{ firma: string; testo: string }> {
  const giaQui = definizioniInMemoria.get(firma);
  if (giaQui !== undefined) { ricordaDefinizioni(firma, giaQui); return Promise.resolve({ firma, testo: giaQui }); }
  return new Promise((ok, ko) => {
    const voce = { firma, ok: (d: { firma: string; testo: string }) => { clearTimeout(tm); ok(d); } };
    const tm = setTimeout(() => { attese = attese.filter(a => a !== voce); ko(new Error("definizioni non arrivate dal ponte")); }, attesaMs);
    attese.push(voce);
    window.postMessage({ type: "foe-bridge-request", what: "definitions", signature: firma }, location.origin);
  });
}

/** Impronta veloce di un testo (FNV-1a): per non reimportare una città identica. */
function improntaTesto(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return s.length + "-" + (h >>> 0).toString(36);
}

/** Impronta di una città dal ponte con SOLO quello che conta per il tool, per
 *  non reimportarla quando cambia altro (24/11/2026, utente: "Aggiornata" di
 *  continuo senza toccare nulla). FoE Helper avvisa anche per produzioni che
 *  partono o finiscono, motivazioni, PF versati nei GE, e il magazzino cambia
 *  sempre: restano fuori `state` e `bonuses` degli edifici, `resources`,
 *  avatar e diagnostica. Dentro: edifici (tipo, posizione, era/livello,
 *  livello massimo, collegamento), espansioni, inventario (oggetto e quantità),
 *  alleati (quale, livello, dove), livello del Castello. */
/**
 * Impronta dell'insediamento (25/11/2026) dentro un pacchetto del ponte: civiltà (dal
 * municipio), aree, edifici con posizione e le valute degli insediamenti (rupie, dobloni).
 * null se nel pacchetto non c'è un insediamento visitato.
 */
export function improntaInsediamento(d: unknown): { fazione: string; impronta: string } | null {
  const o = (d ?? {}) as Record<string, unknown>;
  const po = o.pirateOutpost as { areas?: Array<Record<string, unknown>>; entities?: Array<Record<string, unknown>> } | undefined;
  if (!po || !Array.isArray(po.areas) || !po.areas.length || !Array.isArray(po.entities)) return null;
  let fazione = "";
  for (const e of po.entities) {
    const m = typeof e.cityentity_id === "string" ? /^H_([A-Za-z]+)_Townhall$/.exec(e.cityentity_id) : null;
    if (m) { fazione = m[1]!; break; }
  }
  if (!fazione) return null;
  const aree = po.areas.map(a => [a.x ?? 0, a.y ?? 0]).sort((a, b) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]));
  const edifici = po.entities.map(e => [e.cityentity_id, e.x ?? 0, e.y ?? 0].join(",")).sort();
  const r = (o.resources ?? {}) as Record<string, unknown>;
  return { fazione, impronta: improntaTesto(JSON.stringify([fazione, aree, edifici, r.rupees ?? null, r.doubloons ?? null])) };
}

export function improntaDati(d: unknown): string {
  const o = (d ?? {}) as Record<string, unknown>;
  const edifici = Object.values((o.CityMapData ?? {}) as Record<string, Record<string, unknown>>)
    .map(e => [e.id, e.cityentity_id, e.type, e.x ?? 0, e.y ?? 0, e.level ?? null, e.max_level ?? null, e.connected ?? null, e.decayedFromCityEntityId ?? null])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const inventario = (Array.isArray(o.inventory) ? o.inventory as Array<Record<string, unknown>> : [])
    .map(i => [i.id, i.inStock ?? null]).sort((a, b) => Number(a[0]) - Number(b[0]));
  const alleati: unknown[] = [];
  // allyList: id → alleato (o liste di alleati, per sicurezza)
  for (const v of Object.values((o.allies ?? {}) as Record<string, unknown>))
    for (const a of (Array.isArray(v) ? v : [v]) as Array<Record<string, unknown> | null>)
      if (a && typeof a === "object") alleati.push([a.id, a.allyId, a.level, a.mapEntityId ?? null]);
  alleati.sort((a, b) => Number((a as unknown[])[0]) - Number((b as unknown[])[0]));
  return improntaTesto(JSON.stringify([o.server, edifici, o.UnlockedAreas ?? [], inventario, alleati, o.castleLevel ?? null]));
}

/** La pagina è visibile (scheda in primo piano)? */
export function usePaginaVisibile(): boolean {
  const [v, setV] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const f = () => setV(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  return v;
}
