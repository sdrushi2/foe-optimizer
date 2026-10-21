// ─────────────────────────────────────────────────────────────────────────────
//  planner/lavoratore.ts — Web Worker dell'ottimizzatore (ottobre 2026)
//
//  Ogni scenario del Planner (raccordo 3/4, girandola, girandola 2) gira in un
//  worker suo: prima i quattro scenari si dividevano UN solo thread (quello
//  della pagina, a turno a ogni pausa della ricerca); ora ognuno ha un core
//  e la pagina resta reattiva. Il codice della ricerca è lo stesso
//  (runCompletion, scegliGirandola): qui ci sono solo i messaggi.
//  Protocollo: vedi parallelo.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { runCompletion, type CompletionOptions, type StatoManuale } from "./completion";
import { scegliGirandola } from "./girandola";
import type { PlannerFrame } from "./engine";

/** Ambito del worker (tipi minimi: il progetto usa le librerie DOM). */
const ambito = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent) => void) | null };
const invia = (m: unknown) => ambito.postMessage(m);

/** Stato dei comandi della pagina (aggiornato dai messaggi "flag"). */
const flag = { stop: false, finish: false, paused: false, stopFill: false, riposo: 0 };
let attesa: ((s: StatoManuale | null) => void) | null = null;
/** Disposizione migliore della squadra da adottare (messaggio "adotta"). */
let adozione: StatoManuale | null = null;

ambito.onmessage = (e: MessageEvent) => {
  const m = e.data as { tipo: string; [k: string]: unknown };
  if (m.tipo === "flag") { Object.assign(flag, m.flag as typeof flag); return; }
  if (m.tipo === "adotta") { adozione = m.stato as StatoManuale; return; }
  if (m.tipo === "riprendi") { const r = attesa; attesa = null; r?.((m.stato as StatoManuale | null) ?? null); return; }
  if (m.tipo === "completion") void eseguiCompletion(m as unknown as AvvioCompletion);
  else if (m.tipo === "scegli") void eseguiScelta(m as unknown as AvvioScelta);
};

type Ha = { adotta?: boolean; finish?: boolean; stopFill?: boolean; paused?: boolean; wait?: boolean; onPaused?: boolean; onSearchActive?: boolean; onFillActive?: boolean };
export type AvvioCompletion = {
  tipo: "completion";
  problem: Parameters<typeof runCompletion>[0];
  opts: Pick<CompletionOptions, "delayMs" | "initial" | "geometry" | "limiteValutate" | "fissi" | "girandola" | "soloRicerca" | "riprendiDa" | "seme" | "stradeFisse">;
  ha: Ha;
  flag: typeof flag;
};
export type AvvioScelta = { tipo: "scegli"; problem: Parameters<typeof scegliGirandola>[0]; valutazioni?: number; flag: typeof flag };

async function eseguiCompletion(m: AvvioCompletion) {
  Object.assign(flag, m.flag);
  try {
    const fr: PlannerFrame = await runCompletion(m.problem, {
      ...m.opts,
      onFrame: f => invia({ tipo: "frame", f }),
      shouldStop: () => flag.stop,
      riposo: () => flag.riposo,
      ...(m.ha.adotta ? { adotta: () => { const a = adozione; adozione = null; return a; } } : {}),
      ...(m.ha.finish ? { shouldFinishSearch: () => flag.finish } : {}),
      ...(m.ha.stopFill ? { shouldStopFill: () => flag.stopFill } : {}),
      ...(m.ha.paused ? { isPaused: () => flag.paused } : {}),
      ...(m.ha.wait ? { waitResume: () => new Promise<StatoManuale | null>(res => { attesa = res; invia({ tipo: "attendi" }); }) } : {}),
      ...(m.ha.onPaused ? { onPaused: (p: boolean) => invia({ tipo: "pausa", p }) } : {}),
      ...(m.ha.onSearchActive ? { onSearchActive: (a: boolean) => invia({ tipo: "ricerca", a }) } : {}),
      ...(m.ha.onFillActive ? { onFillActive: (a: boolean) => invia({ tipo: "riempimento", a }) } : {}),
    });
    invia({ tipo: "fine", r: fr });
  } catch (err) {
    invia({ tipo: "errore", msg: err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err) });
  }
}

async function eseguiScelta(m: AvvioScelta) {
  Object.assign(flag, m.flag);
  try {
    const r = await scegliGirandola(m.problem, {
      shouldStop: () => flag.stop,
      ...(m.valutazioni !== undefined ? { valutazioni: m.valutazioni } : {}),
      onProgress: (i, n) => invia({ tipo: "progresso", i, n }),
      onFrame: f => invia({ tipo: "frame", f }),
    });
    invia({ tipo: "fine", r });
  } catch (err) {
    invia({ tipo: "errore", msg: err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err) });
  }
}
