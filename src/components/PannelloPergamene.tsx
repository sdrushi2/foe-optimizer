// ─────────────────────────────────────────────────────────────────────────────
//  PannelloPergamene — Potenziale alleati e Pergamene Eroiche (scheda Alleati,
//  novembre 2026). Stessa cornice del pannello dei Gettoni Valore
//  (AllyAdvisorPanel), con le pergamene possedute a destra
//  (`historical_allies_train_manual_1` del magazzino risorse).
//  Il consiglio (data/pergameneAdvisor.ts): quali alleati militari far salire
//  e di quanti livelli per la massima efficienza con le pergamene possedute;
//  contano tutti gli alleati, quelli non posizionati sono segnalati.
//  Lo mostra o nasconde il pulsante "Pergamene" del nastro (Analisi).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, type ReactNode } from "react";
import type { Ally, ImportedAlly } from "../data/allies";
import { RARITY_DISPLAY, rarityName } from "../data/allies";
import { consigliaPergamene } from "../data/pergameneAdvisor";
import type { Weights } from "../utils/calculator";
import type { Lang } from "../data/languages";
import { t, type UiLang } from "../data/ui-strings";
import { formatInt } from "../utils/format";

interface Props {
  owned: readonly ImportedAlly[];
  byIdRarity: Map<string, Ally>;
  inherited: Map<string, Ally[]>;
  weights: Weights;
  /** Pergamene Eroiche nel magazzino. */
  pergamene: number;
  uiLang: UiLang;
  gameLang: Lang;
  allyName: (id: string, lang: Lang) => string;
  /** Intestazioni GENERALI/CAMPI/SPEDIZIONI e a icone (come il pannello Gettoni). */
  groupHeaders: ReactNode;
  statHeaders: ReactNode;
  /** Celle dei boost (aumenti con il "+"), stesso componente delle altre tabelle. */
  renderBoostCells: (general: number[], gbg: number[], sped: number[]) => ReactNode;
}

type Quattro = [number, number, number, number];
const somma = (l: Quattro[]): Quattro => l.reduce<Quattro>((s, x) => [s[0] + x[0], s[1] + x[1], s[2] + x[2], s[3] + x[3]], [0, 0, 0, 0]);

export default function PannelloPergamene({ owned, byIdRarity, inherited, weights, pergamene, uiLang, gameLang, allyName, groupHeaders, statHeaders, renderBoostCells }: Props) {
  const intero = (n: number) => (uiLang === "en" ? n.toLocaleString("en-US") : formatInt(n));
  const decimale = (n: number) => n.toLocaleString(uiLang === "en" ? "en-US" : "it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const c = useMemo(() => consigliaPergamene(owned, byIdRarity, inherited, weights, pergamene), [owned, byIdRarity, inherited, weights, pergamene]);
  const passi = useMemo(() => [...c.passi].sort((a, b) => b.guadagno - a.guadagno), [c]);
  // riga dei totali: aumento complessivo di ogni colonna
  const tot = useMemo(() => ({
    g: somma(c.passi.map(p => p.dGeneral)), c: somma(c.passi.map(p => p.dGbg)), s: somma(c.passi.map(p => p.dSped)),
  }), [c]);

  return (
    <div className="mb-3 rounded border border-amber-700/50 bg-slate-900/40">
      <div className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-bold uppercase tracking-wider text-amber-300">
        <span>🎖️ {t("allyScrollsTitle", uiLang)}</span>
        <span className="ml-auto normal-case font-normal tracking-normal text-slate-300">
          {t("allyScrollsOwned", uiLang)}: <span className="font-bold text-amber-300">{intero(pergamene)}</span>
        </span>
      </div>
      <div className="space-y-3 border-t border-slate-800 px-3 py-3 text-[13px] text-slate-300">
        <p className="text-slate-400">{t("allyScrollsIntro", uiLang)}</p>
        <p className="text-slate-200">
          {passi.length
            ? t("allyScrollsSummary", uiLang, intero(c.spese), passi.length, decimale(c.guadagno), intero(pergamene - c.spese))
            : c.prossimoCosto ? t("allyScrollsNotEnough", uiLang, intero(c.prossimoCosto)) : t("allyScrollsAllMax", uiLang)}
          {!c.esatto && <span className="ml-1 text-slate-500">{t("allyScrollsApprox", uiLang)}</span>}
        </p>
        {passi.length > 0 && (
          <div className="overflow-x-auto">
            {/* (più aria fra i valori: nelle tabelle grandi la larghezza la danno le colonne) */}
            <table className="building-table w-auto border-collapse text-left [&_td.cell-num]:min-w-[52px] [&_td.cell-num]:px-2 [&_td.cell-num]:text-center [&_th.th-col]:min-w-[52px] [&_th.th-col]:px-2 [&_td]:py-1.5">
              <thead>
                <tr className="bt-thead-row1 border-b border-slate-800 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-2 py-1" colSpan={4}>{t("allyScrollsDeltaNote", uiLang)}</th>
                  {groupHeaders}
                </tr>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-1 pr-4 pl-2">{t("allyAdvisorColAlly", uiLang)}</th>
                  <th className="px-2 py-1 text-center">{t("allyScrollsColLevel", uiLang)}</th>
                  <th className="px-2 py-1 text-right">{t("allyScrollsColScrolls", uiLang)}</th>
                  <th className="px-2 py-1 text-right">{t("allyScrollsColGain", uiLang)}</th>
                  {statHeaders}
                </tr>
              </thead>
              <tbody>
                {passi.map(p => (
                  <tr key={p.imp.jsonId} className="border-b border-slate-800/60">
                    {/* (text-left: .building-table centra le celle del tbody) */}
                    <td className="py-1 pr-4 pl-2 text-left whitespace-nowrap">
                      <span title={rarityName(p.imp.rarity, uiLang as Lang)}
                        className={`mr-1.5 inline-block rounded border px-1 text-[11px] font-bold ${RARITY_DISPLAY[p.imp.rarity]?.badgeOn ?? ""}`}>
                        {RARITY_DISPLAY[p.imp.rarity]?.label ?? p.imp.rarity}
                      </span>
                      <span className="text-slate-100">{allyName(p.imp.allyId, gameLang)}</span>
                      {!p.imp.isPlaced && (
                        <span className="ml-1.5 inline-block rounded border border-red-600 bg-red-950 px-1 py-0.5 font-mono text-[10px] font-bold text-red-400">
                          {t("allyNotPlacedBadge", uiLang)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-center font-mono whitespace-nowrap">
                      {p.da} → <span className="font-bold text-slate-50">{p.a}</span>
                      <span className="ml-1 text-slate-500">(+{p.a - p.da})</span>
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{intero(p.pergamene)}</td>
                    <td className="px-2 py-1 text-right font-mono font-bold text-emerald-400">+{decimale(p.guadagno)}</td>
                    {renderBoostCells(p.dGeneral, p.dGbg, p.dSped)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-700/60 font-bold">
                  <td className="py-1 pr-4 pl-2 text-left text-amber-300">{t("allyScrollsTotal", uiLang)}</td>
                  <td className="px-2 py-1 text-center font-mono text-slate-400">+{c.passi.reduce((s, p) => s + p.a - p.da, 0)}</td>
                  <td className="px-2 py-1 text-right font-mono">{intero(c.spese)}</td>
                  <td className="px-2 py-1 text-right font-mono text-emerald-400">+{decimale(c.guadagno)}</td>
                  {renderBoostCells(tot.g, tot.c, tot.s)}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
