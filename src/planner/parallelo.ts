// ─────────────────────────────────────────────────────────────────────────────
//  planner/parallelo.ts — L'ottimizzatore in un Web Worker (ottobre 2026)
//
//  Stessa interfaccia di runCompletion / scegliGirandola, ma il lavoro gira
//  in un worker (lavoratore.ts), uno per chiamata: gli scenari del Planner
//  vanno davvero in parallelo (un core ciascuno) invece di dividersi il
//  thread della pagina. I callback restano nella pagina:
//   - le funzioni di comando (shouldStop, shouldFinishSearch, isPaused,
//     shouldStopFill) sono lette qui ogni FLAG_MS e mandate al worker solo
//     quando cambiano ("flag"); la ricerca le legge dal worker;
//   - onFrame / onPaused / onSearchActive / onFillActive / onProgress
//     arrivano come messaggi;
//   - waitResume: il worker chiede ("attendi"), la pagina risponde
//     ("riprendi") con la disposizione modificata a mano (o null).
//   - adotta (squadra di ricerca): letta qui ogni FLAG_MS; una disposizione
//     da adottare va al worker col messaggio "adotta".
//  Mappe e insiemi passano col clone strutturato.
// ─────────────────────────────────────────────────────────────────────────────

import type { CompletionOptions } from "./completion";
import type { PlannerFrame, PlannerProblem } from "./engine";
import type { BaseGirandola } from "./girandola";
import type { AvvioCompletion, AvvioScelta } from "./lavoratore";
import Lavoratore from "./lavoratore?worker&inline";

/** Ogni quanto si rileggono i comandi della pagina (pausa, stop, COMPLETA…). */
const FLAG_MS = 25;

type Flag = { stop: boolean; finish: boolean; paused: boolean; stopFill: boolean };

function avvia<T>(
  messaggio: AvvioCompletion | AvvioScelta,
  leggiFlag: () => Flag,
  gestisci: (m: { tipo: string; [k: string]: unknown }, w: Worker) => void,
  adotta?: () => unknown,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const w = new Lavoratore();
    let ultimo = JSON.stringify(messaggio.flag);
    const timer = setInterval(() => {
      const f = leggiFlag(), s = JSON.stringify(f);
      if (s !== ultimo) { ultimo = s; w.postMessage({ tipo: "flag", flag: f }); }
      const a = adotta?.();
      if (a) w.postMessage({ tipo: "adotta", stato: a });
    }, FLAG_MS);
    const chiudi = () => { clearInterval(timer); w.terminate(); };
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { tipo: string; [k: string]: unknown };
      if (m.tipo === "fine") { chiudi(); resolve(m.r as T); return; }
      if (m.tipo === "errore") { chiudi(); reject(new Error(String(m.msg))); return; }
      gestisci(m, w);
    };
    w.onerror = (e: ErrorEvent) => { chiudi(); reject(new Error(e.message || "errore nel worker dell'ottimizzatore")); };
    w.postMessage(messaggio);
  });
}

/** runCompletion in un worker (stessa interfaccia). */
export function runCompletionParallela(problem: PlannerProblem, opts: CompletionOptions): Promise<PlannerFrame> {
  const leggiFlag = (): Flag => ({
    stop: opts.shouldStop(), finish: opts.shouldFinishSearch?.() ?? false,
    paused: opts.isPaused?.() ?? false, stopFill: opts.shouldStopFill?.() ?? false,
  });
  const messaggio: AvvioCompletion = {
    tipo: "completion", problem,
    opts: {
      delayMs: opts.delayMs, initial: opts.initial, geometry: opts.geometry,
      ...(opts.limiteValutate !== undefined ? { limiteValutate: opts.limiteValutate } : {}),
      ...(opts.fissi ? { fissi: opts.fissi } : {}),
      ...(opts.girandola ? { girandola: opts.girandola } : {}),
      ...(opts.soloRicerca ? { soloRicerca: opts.soloRicerca } : {}),
      ...(opts.riprendiDa ? { riprendiDa: opts.riprendiDa } : {}),
      ...(opts.seme !== undefined ? { seme: opts.seme } : {}),
    },
    ha: {
      adotta: !!opts.adotta,
      finish: !!opts.shouldFinishSearch, stopFill: !!opts.shouldStopFill, paused: !!opts.isPaused, wait: !!opts.waitResume,
      onPaused: !!opts.onPaused, onSearchActive: !!opts.onSearchActive, onFillActive: !!opts.onFillActive,
    },
    flag: leggiFlag(),
  };
  return avvia<PlannerFrame>(messaggio, leggiFlag, (m, w) => {
    if (m.tipo === "frame") opts.onFrame(m.f as PlannerFrame);
    else if (m.tipo === "pausa") opts.onPaused?.(m.p as boolean);
    else if (m.tipo === "ricerca") opts.onSearchActive?.(m.a as boolean);
    else if (m.tipo === "riempimento") opts.onFillActive?.(m.a as boolean);
    else if (m.tipo === "attendi") {
      const p = opts.waitResume ? opts.waitResume() : Promise.resolve(null);
      void p.then(stato => w.postMessage({ tipo: "riprendi", stato }));
    }
  }, opts.adotta);
}

/** scegliGirandola in un worker (stessa interfaccia). */
export function scegliGirandolaParallela(problem: PlannerProblem, opts: {
  shouldStop: () => boolean; valutazioni?: number; onProgress?: (i: number, n: number) => void; onFrame?: (f: PlannerFrame) => void;
}): Promise<BaseGirandola[]> {
  const leggiFlag = (): Flag => ({ stop: opts.shouldStop(), finish: false, paused: false, stopFill: false });
  const messaggio: AvvioScelta = { tipo: "scegli", problem, ...(opts.valutazioni !== undefined ? { valutazioni: opts.valutazioni } : {}), flag: leggiFlag() };
  return avvia<BaseGirandola[]>(messaggio, leggiFlag, m => {
    if (m.tipo === "frame") opts.onFrame?.(m.f as PlannerFrame);
    else if (m.tipo === "progresso") opts.onProgress?.(m.i as number, m.n as number);
  });
}
