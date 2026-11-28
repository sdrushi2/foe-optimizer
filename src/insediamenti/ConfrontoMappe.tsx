/**
 * Confronto fra la disposizione attuale (l'insediamento come nel gioco, ultimo import) e
 * quella nuova del planner (26/11/2026, solo Mughal, richiesta utente).
 *
 * - `confrontaDisposizioni`: per ogni edificio di prima e di dopo dice se resta dov'è, se si
 *   sposta, se si toglie (prima) o se è nuovo (dopo). Lavora in coordinate ASSOLUTE (blocco
 *   minimo × 4 + cella), perché le due disposizioni possono avere espansioni diverse e quindi
 *   ancore diverse. Gli spostamenti si accoppiano per tipo, il più vicino per primo.
 * - `MappaSolaLettura`: la mappa di sinistra, uguale nell'aspetto a quella del planner ma
 *   senza interazioni, con il bordo rosso sugli edifici da togliere e azzurro su quelli da spostare.
 * - `RiepilogoConfronto`: la freccia e l'elenco delle variazioni fra le due mappe.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { buildingColorStyle, CELL_SIZE_PX, type BuildingType, type Placement } from "../data/piratiBuildings";
import { t, type UiLang } from "../data/ui-strings";
import { formatInt } from "../utils/format";

export type StatoConfronto = "uguale" | "spostato" | "tolto" | "nuovo";

/** Piazzamento con l'origine assoluta (per confrontare mappe con espansioni diverse). */
export interface PiazzamentoAssoluto { p: Placement; r: number; c: number }

export function confrontaDisposizioni(prima: PiazzamentoAssoluto[], dopo: PiazzamentoAssoluto[]) {
  const statoPrima = new Map<Placement, StatoConfronto>();
  const statoDopo = new Map<Placement, StatoConfronto>();
  const chiave = (x: PiazzamentoAssoluto) => `${x.p.buildingId}@${x.r},${x.c}`;
  const restiPrima = new Map<string, PiazzamentoAssoluto[]>();
  const posPrima = new Map<string, PiazzamentoAssoluto[]>();
  for (const x of prima) { const k = chiave(x); posPrima.set(k, [...(posPrima.get(k) ?? []), x]); }
  // 1. stessi edifici nello stesso posto
  for (const x of dopo) {
    const l = posPrima.get(chiave(x));
    if (l && l.length) { statoPrima.set(l.pop()!.p, "uguale"); statoDopo.set(x.p, "uguale"); }
  }
  for (const x of prima) if (!statoPrima.has(x.p)) restiPrima.set(x.p.buildingId, [...(restiPrima.get(x.p.buildingId) ?? []), x]);
  // 2. per tipo: coppie spostate (la più vicina), il resto tolto o nuovo
  for (const x of dopo) {
    if (statoDopo.has(x.p)) continue;
    const l = restiPrima.get(x.p.buildingId);
    if (l && l.length) {
      let bi = 0, bd = Infinity;
      l.forEach((y, i) => { const d = Math.abs(y.r - x.r) + Math.abs(y.c - x.c); if (d < bd) { bd = d; bi = i; } });
      const y = l.splice(bi, 1)[0]!;
      statoPrima.set(y.p, "spostato"); statoDopo.set(x.p, "spostato");
    } else statoDopo.set(x.p, "nuovo");
  }
  for (const l of restiPrima.values()) for (const y of l) statoPrima.set(y.p, "tolto");
  return { statoPrima, statoDopo };
}

interface PropsMappa {
  righe: number;
  colonne: number;
  /** [riga][colonna] = casella sbloccata */
  maschera: boolean[][];
  /** chiavi "riga,colonna" degli ostacoli */
  ostacoli: Set<string>;
  piazzamenti: Placement[];
  edificio: (id: string) => BuildingType | undefined;
  stato: Map<Placement, StatoConfronto>;
  titolo: string;
  uiLang: UiLang;
}

/** Mappa di sinistra: sola lettura, rosso = da togliere, azzurro = da spostare. */
export function MappaSolaLettura({ righe, colonne, maschera, ostacoli, piazzamenti, edificio, stato, titolo, uiLang }: PropsMappa) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dim, setDim] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e!.contentRect;
      if (width > 0 && height > 0) setDim({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">{titolo}</div>
      <div ref={ref} className="flex min-h-[200px] min-w-0 flex-1 items-start justify-center">
        <div
          className="pointer-events-none relative grid select-none gap-1 rounded border border-slate-800 bg-slate-900 p-2 opacity-90"
          style={{
            gridTemplateRows: `repeat(${righe}, minmax(0, 1fr))`,
            gridTemplateColumns: `repeat(${colonne}, minmax(0, 1fr))`,
            aspectRatio: `${colonne} / ${righe}`,
            ...(dim
              ? { width: Math.min(CELL_SIZE_PX * colonne, dim.width, dim.height * (colonne / righe)), maxHeight: dim.height }
              : { maxWidth: `${CELL_SIZE_PX * colonne}px`, width: "100%" }),
          }}
        >
          {Array.from({ length: righe }, (_, r) => Array.from({ length: colonne }, (_, c) => {
            const valida = !!maschera[r]?.[c];
            const ostacolo = valida && ostacoli.has(`${r},${c}`);
            return (
              <div key={`${r},${c}`} style={{ gridRow: r + 1, gridColumn: c + 1 }}
                className={valida ? (ostacolo ? "rounded-sm border border-red-500/50 bg-red-950/50 text-[10px] flex items-center justify-center" : "rounded-sm border border-slate-700/40 bg-slate-900/50") : ""}>
                {ostacolo && "❌"}
              </div>
            );
          }))}
          {piazzamenti.map((p) => {
            const b = edificio(p.buildingId);
            if (!b) return null;
            const s = stato.get(p);
            return (
              <div key={`${p.buildingId}-${p.row}-${p.col}`}
                className={[
                  "relative z-10 flex flex-col items-center justify-center rounded border",
                  // (28/11/2026, utente) niente bordo sugli spostati: l'ottimizzatore sposta quasi tutto
                  s === "tolto" ? "outline outline-[3px] outline-red-500" : "",
                ].join(" ")}
                style={{ gridRow: `${p.row + 1} / span ${p.h}`, gridColumn: `${p.col + 1} / span ${p.w}`, padding: "2px", ...buildingColorStyle(b) }}>
                {b.icon && <span className="text-lg md:text-xl drop-shadow-md">{b.icon}</span>}
                {b.icon && (
                  <span className="overflow-hidden whitespace-nowrap px-1 text-center text-[8px] font-black uppercase tracking-tighter text-black/60 md:text-[10px]">
                    {t(b.shortNameKey, uiLang)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface DatiRiepilogo {
  /** tipo → differenza di numero (solo quelli che cambiano), già con il nome */
  numeri: Array<{ nome: string; diff: number }>;
  stradeNuove: number;
  stradeSpostate: number;
  costoStrada: number;
  /** edifici (non strade) da spostare, Ambasciata compresa */
  daSpostare: number;
  ambasciataSpostata: boolean;
  rupiePrima: number;
  rupieDopo: number;
}

/** La freccia fra le due mappe. */
export function FrecciaConfronto() {
  return <ArrowRight size={56} strokeWidth={2.5} className="text-violet-300" aria-hidden="true" />;
}

/** Il riepilogo delle variazioni (sotto la freccia su schermi larghi, sotto le mappe sugli altri). */
export function RiepilogoConfronto({ d, uiLang }: { d: DatiRiepilogo; uiLang: UiLang }) {
  const L = (k: Parameters<typeof t>[0], ...a: unknown[]) => t(k, uiLang, ...a) as string;
  const segno = (n: number) => (n > 0 ? `+${formatInt(n)}` : `−${formatInt(-n)}`);
  const diffRupie = Math.round(d.rupieDopo) - Math.round(d.rupiePrima);
  return (
      <div className="w-full max-w-[260px] rounded border border-violet-400/40 bg-violet-500/10 p-2 text-[11px] text-slate-200">
        <div className="mb-1 font-bold uppercase tracking-wide text-violet-200">{L("confrontoTitolo")}</div>
        <ul className="space-y-0.5">
          {d.numeri.map((n) => (
            <li key={n.nome} className="flex justify-between gap-2">
              <span className="truncate">{n.nome}</span>
              <span className={`font-mono font-bold ${n.diff > 0 ? "text-green-400" : "text-red-400"}`}>{segno(n.diff)}</span>
            </li>
          ))}
          {d.stradeNuove > 0 && (
            <li className="flex justify-between gap-2">
              <span>{L("confrontoStradeNuove")}</span>
              <span className="font-mono font-bold text-amber-300">{d.stradeNuove} <span className="text-red-400">(−{formatInt(d.stradeNuove * d.costoStrada)})</span></span>
            </li>
          )}
          {d.stradeSpostate > 0 && (
            <li className="flex justify-between gap-2"><span>{L("confrontoStradeSpostate")}</span><span className="font-mono font-bold text-amber-300">{d.stradeSpostate}</span></li>
          )}
          {d.daSpostare > 0 && (
            <li className="flex justify-between gap-2"><span>{L("confrontoDaSpostare")}</span><span className="font-mono font-bold text-amber-300">{d.daSpostare}</span></li>
          )}
          {d.ambasciataSpostata && <li className="text-amber-300">{L("confrontoAmbasciata")}</li>}
        </ul>
        <div className="mt-1.5 border-t border-violet-400/30 pt-1.5">
          <div className="text-slate-400">{L("confrontoRupie")}</div>
          <div className="font-mono font-bold text-amber-300">
            {formatInt(Math.round(d.rupiePrima))} → {formatInt(Math.round(d.rupieDopo))}
            {diffRupie !== 0 && <span className={diffRupie > 0 ? "text-green-400" : "text-red-400"}> ({segno(diffRupie)})</span>}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 border-t border-violet-400/30 pt-1.5 text-[10px] text-slate-400">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-500 align-middle" />{L("confrontoLegTolto")}</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-white align-middle" />{L("confrontoLegNuovo")}</span>
        </div>
      </div>
  );
}
