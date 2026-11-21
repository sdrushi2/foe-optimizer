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
import { valutaGirandole } from "./girandola";
import { nucleiDueCorsie, retePettine } from "./dueCorsie";
import type { PlannerFrame, PlannerProblem } from "./engine";

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
  else if (m.tipo === "valuta") void eseguiValutazioni(m as unknown as AvvioValuta);
  else if (m.tipo === "nuclei") eseguiNuclei(m as unknown as AvvioNuclei);
};

type Ha = { attendiInPausa?: boolean; adotta?: boolean; finish?: boolean; stopFill?: boolean; paused?: boolean; wait?: boolean; onPaused?: boolean; onSearchActive?: boolean; onFillActive?: boolean };
export type AvvioCompletion = {
  tipo: "completion";
  problem: Parameters<typeof runCompletion>[0];
  opts: Pick<CompletionOptions, "delayMs" | "initial" | "geometry" | "limiteValutate" | "fissi" | "girandola" | "soloRicerca" | "riprendiDa" | "seme" | "stradeFisse" | "rami" | "posizioniSenzaStrada">;
  ha: Ha;
  flag: typeof flag;
};
/** Girandola 2: valuta un gruppo di posizioni del municipio (`frame`: manda anche i fotogrammi delle prove). */
export type AvvioValuta = { tipo: "valuta"; problem: PlannerProblem; prove: Array<[number, number, boolean]>; n: number; frame: boolean; flag: typeof flag };

async function eseguiCompletion(m: AvvioCompletion) {
  Object.assign(flag, m.flag);
  try {
    const fr: PlannerFrame = await runCompletion(m.problem, {
      ...m.opts,
      onFrame: f => invia({ tipo: "frame", f }),
      shouldStop: () => flag.stop,
      riposo: () => flag.riposo,
      ...(m.ha.attendiInPausa ? { attendiInPausa: () => flag.paused } : {}),
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

/** Strade a due corsie: nuclei candidati o rete a pettine (dueCorsie.ts), fuori
 *  dalla pagina (21/11/2026: nelle città con edifici a due corsie la pagina
 *  restava bloccata per secondi prima che partissero gli scenari). */
export type AvvioNuclei = {
  tipo: "nuclei"; problem: PlannerProblem; pettine: boolean;
  base: { placements: ReadonlyMap<string, { x: number; y: number }>; roads: ReadonlySet<string> };
  fissi: readonly string[]; max: number; raccordo?: { eastMidY: number }; bracci?: ReadonlyArray<readonly string[]>; flag: typeof flag;
};
function eseguiNuclei(m: AvvioNuclei) {
  try {
    const r = m.pettine ? retePettine(m.problem, m.base, m.max) : nucleiDueCorsie(m.problem, m.base, m.fissi, m.max, m.raccordo, m.bracci);
    invia({ tipo: "fine", r });
  } catch (err) {
    invia({ tipo: "errore", msg: err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err) });
  }
}

async function eseguiValutazioni(m: AvvioValuta) {
  Object.assign(flag, m.flag);
  try {
    const r = await valutaGirandole(m.problem, m.prove, m.n, {
      shouldStop: () => flag.stop,
      attendiInPausa: () => flag.paused,
      ...(m.frame ? { onFrame: (f: PlannerFrame) => invia({ tipo: "frame", f }) } : {}),
    });
    invia({ tipo: "fine", r });
  } catch (err) {
    invia({ tipo: "errore", msg: err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err) });
  }
}
