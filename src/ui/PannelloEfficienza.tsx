// ─────────────────────────────────────────────────────────────────────────────
//  ui/PannelloEfficienza.tsx — Opzioni › Pesi statistiche › "?" (2.0)
//
//  Prima era un popup (EfficiencyHelpModal) che parlava ancora dei vecchi
//  comandi della barra (Att/Dif/CAM/Σ/SPE e filtro EFF). Ora è un pannello
//  come gli altri (si apre e si chiude dal "?") e spiega, con i valori
//  scelti in questo momento, come si calcola l'efficienza:
//   - quali bonus contano (Generale, Campi, Spedizioni; non le IQ);
//   - i pesi (attacco 1, difesa 80% o 100%, divisione Campi / Spedizioni);
//   - lo spazio (area + metà del lato corto di strada; 0 senza strada);
//   - un esempio con i numeri; gli alleati (stessa somma, senza spazio).
//  Formula: utils/calculator.ts (calculateEfficiency) e i pesi di App.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";

function Titoletto({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</div>;
}

const fmt = (n: number, lang: UiLang) => n.toLocaleString(lang === "it" ? "it-IT" : "en-GB", { maximumFractionDigits: 2 });

export default function PannelloEfficienza({ uiLang, difesa, spedizioni, spedAttacco, onChiudi }: {
  uiLang: UiLang; difesa: number; spedizioni: boolean; spedAttacco: number; onChiudi?: () => void;
}) {
  const L = (k: Parameters<typeof t>[0], ...a: unknown[]) => t(k, uiLang, ...(a as [])) as string;
  const s = spedizioni ? spedAttacco : 0;
  const pCampi = 1 - s;
  // pesi in uso: attacco / difesa per ogni gruppo di bonus
  const righe: Array<[string, number, number]> = [
    [L("r2EffGeneral"), 1, difesa],
    [L("r2EffGbg"), pCampi, difesa * pCampi],
    [L("r2EffGe"), s, difesa * s],
  ];
  // esempio: Neo Colosso liv. 11 (4×4 con strada): Generale 64 ×4, Campi 60 ×4, Spedizioni 74 ×4
  const effColosso = (d: number, sp: boolean, q: number) => {
    const qq = sp ? q : 0;
    const somma = (64 + 64 * d) * 2 + (60 + 60 * d) * 2 * (1 - qq) + (74 + 74 * d) * 2 * qq;
    return { somma, eff: Math.round((somma / 18) * 10) / 10 };
  };
  const casi: Array<{ nome: string; d: number; sp: boolean; q: number; tuoi?: boolean }> = [
    { nome: L("r2EffCase1"), d: 0.8, sp: false, q: 0.2 },
    { nome: L("r2EffCase2"), d: 0.8, sp: true, q: 0.2 },
    { nome: L("r2EffCase3"), d: 1, sp: true, q: 0.2 },
    { nome: L("r2EffCaseMine"), d: difesa, sp: spedizioni, q: spedAttacco, tuoi: true },
  ];
  const cella = "border-b border-slate-800/70 px-2 py-1";
  return (
    <div className="relative w-full border border-slate-800 bg-slate-950 p-3 text-xs">
      {onChiudi && (
        <button type="button" onClick={onChiudi} title={L("closeAriaLabel")} aria-label={L("closeAriaLabel")}
          className="absolute top-2 right-2 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-100">
          <X size={16} aria-hidden="true" />
        </button>
      )}
      <div className="mb-1 pr-6 font-bold uppercase tracking-wide text-slate-200">{L("r2EffTitle")}</div>
      <p className="mb-3 text-slate-400">{L("r2EffIntro")}</p>

      <div className="mb-4 border border-amber-600/40 bg-amber-500/5 px-3 py-2 font-mono text-[12px] text-amber-300">
        {L("r2EffFormula")}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 1. I bonus */}
        <section className="space-y-2 leading-relaxed text-slate-300">
          <Titoletto>{L("r2EffWhatTitle")}</Titoletto>
          <p>{L("r2EffWhat")}</p>
          <ul className="list-disc space-y-1 pl-4 marker:text-slate-600">
            <li><span className="font-semibold text-slate-100">{L("r2EffGeneral")}:</span> {L("r2EffGeneralBody")}</li>
            <li><span className="font-semibold text-slate-100">{L("r2EffGbg")}:</span> {L("r2EffGbgBody")}</li>
            <li><span className="font-semibold text-slate-100">{L("r2EffGe")}:</span> {L("r2EffGeBody")}</li>
          </ul>
          <p className="text-slate-400">{L("r2EffArmies")}</p>
          <p className="text-slate-500">{L("r2EffNotCounted")}</p>
        </section>

        {/* 2. I pesi */}
        <section className="space-y-2 leading-relaxed text-slate-300">
          <Titoletto>{L("r2EffWeightsTitle")}</Titoletto>
          <ul className="list-disc space-y-1 pl-4 marker:text-slate-600">
            <li><span className="font-semibold text-slate-100">{L("r2WDefIs")} … {L("r2WOfAtk")}:</span> {L("r2EffDefBody")}</li>
            <li><span className="font-semibold text-slate-100">{L("r2WIncludeGe")}:</span> {L("r2EffGeOnBody")}</li>
            <li><span className="font-semibold text-slate-100">{L("r2WSplit")}:</span> {L("r2EffSplitBody")}</li>
          </ul>
          <div className="text-[11px] text-slate-500">{L("r2EffNowTitle")}</div>
          <table className="w-full border border-slate-800 text-[11px]">
            <thead>
              <tr className="text-slate-500">
                <th className={`${cella} text-left font-semibold`} />
                <th className={`${cella} text-right font-semibold`}>{L("r2EffAtk")}</th>
                <th className={`${cella} text-right font-semibold`}>{L("r2EffDef")}</th>
              </tr>
            </thead>
            <tbody>
              {righe.map(([nome, a, d]) => (
                <tr key={nome} className={a === 0 ? "text-slate-600" : "text-slate-200"}>
                  <td className={cella}>{nome}</td>
                  <td className={`${cella} text-right font-mono`}>{fmt(a, uiLang)}</td>
                  <td className={`${cella} text-right font-mono`}>{fmt(d, uiLang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 3. Lo spazio, un esempio, gli alleati */}
        <section className="space-y-2 leading-relaxed text-slate-300">
          <Titoletto>{L("r2EffSpaceTitle")}</Titoletto>
          <p>{L("r2EffSpace")}</p>
          <Titoletto>{L("r2EffExampleTitle")}</Titoletto>
          <p>{L("r2EffExample")}</p>
          <table className="w-full border border-slate-800 text-[11px]">
            <thead>
              <tr className="text-slate-500">
                <th className={`${cella} text-left font-semibold`}>{L("r2EffCaseWeights")}</th>
                <th className={`${cella} text-right font-semibold`}>{L("r2EffCaseSum")}</th>
                <th className={`${cella} text-right font-semibold`}>EFF</th>
              </tr>
            </thead>
            <tbody>
              {casi.map(c => {
                const r = effColosso(c.d, c.sp, c.q);
                const dett = `${L("r2EffDef")} ${Math.round(c.d * 100)}% · ${c.sp ? `${L("r2WSplit")} ${Math.round((1 - c.q) * 100)}/${Math.round(c.q * 100)}` : L("r2EffNoGe")}`;
                return (
                  <tr key={c.nome} className={c.tuoi ? "text-sky-300" : "text-slate-200"}>
                    <td className={cella}><div className="font-semibold">{c.nome}</div><div className="text-[10px] text-slate-500">{dett}</div></td>
                    <td className={`${cella} text-right font-mono`}>{fmt(r.somma, uiLang)} ÷ 18</td>
                    <td className={`${cella} text-right font-mono font-bold text-amber-300`}>{fmt(r.eff, uiLang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Titoletto>{L("r2EffAlliesTitle")}</Titoletto>
          <p>{L("r2EffAllies")}</p>
          <p className="text-slate-500">{L("r2EffWhere")}</p>
        </section>
      </div>
    </div>
  );
}
