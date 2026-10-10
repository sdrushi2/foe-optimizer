// ─────────────────────────────────────────────────────────────────────────────
//  AllyAdvisorPanel — Potenziale degli alleati + Consigliere Gettoni Valore
//  (tab Alleati, ottobre 2026). Pannello UNICO: la matrice del potenziale è la
//  vista principale e la coda dei Gettoni Valore è disegnata sopra di essa.
//
//  - Una riga per ogni alleato MILITARE posseduto (copie e livelli ignorati),
//    una colonna per ognuna delle 5 rarità: EFF al livello 100, sfondo a
//    gradiente rosso → verde su tutta la matrice, riquadro bianco sulle
//    rarità possedute.
//  - Ogni passo della coda (data/allyAdvisor.ts) è un badge "#n" sulla cella
//    della rarità di ARRIVO (verde se già coperto dai gettoni posseduti);
//    le rarità saltate da un passo multiplo hanno il bordo tratteggiato.
//  - Colonna "Prossima evoluzione" + ordinamento "Priorità gettoni".
//  - Click sul nome: riga espansa con i passi di quell'alleato e le variazioni
//    dei boost Generali/Campi/Spedizioni (stesse colonne delle altre tabelle).
//  - In fondo: alleati scienza "non valutati" (solo fatti).
//  Mostrato da App.tsx SOLO con il magazzino risorse della bacchetta v6.
// ─────────────────────────────────────────────────────────────────────────────

import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { Ally, ImportedAlly } from "../data/allies";
import { RARITY_DISPLAY, rarityName } from "../data/allies";
import { computeAllyAdvice, allyEffAt100, isScienceAlly, VALOR_RESOURCE, MAX_TARGET_RARITY, type AdvisorStep } from "../data/allyAdvisor";
import type { Weights } from "../utils/calculator";
import type { Lang } from "../data/languages";
import { t, type UiLang } from "../data/ui-strings";
import { ALLY_ADVISOR_OPEN_KEY } from "../utils/storage";

interface Props {
  owned: readonly ImportedAlly[];
  byIdRarity: Map<string, Ally>;
  inherited: Map<string, Ally[]>;
  weights: Weights;
  resources: Record<string, number>;
  uiLang: UiLang;
  gameLang: Lang;
  allyName: (id: string, lang: Lang) => string;
  /** Intestazioni GENERALI/CAMPI/SPEDIZIONI (rispettano Σ e Spedizioni). */
  groupHeaders: ReactNode;
  /** Intestazioni a icone dei boost (non ordinabili). */
  statHeaders: ReactNode;
  /** Celle dei boost con lo stesso componente delle altre tabelle. */
  renderBoostCells: (general: number[], gbg: number[], sped: number[]) => ReactNode;
}

const TIERS = [1, 2, 3, 4, 5] as const;
type SortKey = "priority" | "name" | (typeof TIERS)[number];

interface OwnedTier { copies: number; unplaced: number }
interface Row {
  allyId: string;
  eff: (number | null)[]; // indice 0..4 = rarità 1..5
  owned: Map<number, OwnedTier>;
  unplaced: number;
  /** Passi in coda di questo alleato, con la posizione (1-based). */
  steps: Array<{ rank: number; step: AdvisorStep }>;
}

const fmt0 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmt1 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmt3 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });

/** Rosso (0) → giallo → verde (1), scuro per restare leggibile sul tema. */
function heat(x: number): string {
  const h = Math.round(Math.max(0, Math.min(1, x)) * 120);
  return `hsla(${h}, 70%, 32%, 0.75)`;
}

export default function AllyAdvisorPanel({
  owned, byIdRarity, inherited, weights, resources, uiLang, gameLang, allyName,
  groupHeaders, statHeaders, renderBoostCells,
}: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(ALLY_ADVISOR_OPEN_KEY) !== "false"; } catch { return true; }
  });
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDesc, setSortDesc] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const lang = uiLang as Lang;
  const valor = resources[VALOR_RESOURCE] ?? 0;

  const advice = useMemo(
    () => computeAllyAdvice(owned, byIdRarity, inherited, weights),
    [owned, byIdRarity, inherited, weights],
  );

  const { rows, min, max } = useMemo(() => {
    const byAlly = new Map<string, Row>();
    for (const imp of owned) {
      if (imp.isFragment) continue;
      if (!byIdRarity.has(`${imp.allyId}__${imp.rarity}`)) continue;
      if (isScienceAlly(imp.allyId, byIdRarity)) continue;
      let row = byAlly.get(imp.allyId);
      if (!row) {
        row = {
          allyId: imp.allyId,
          eff: TIERS.map(r => allyEffAt100(imp.allyId, r, byIdRarity, inherited, weights)),
          owned: new Map(),
          unplaced: 0,
          steps: [],
        };
        byAlly.set(imp.allyId, row);
      }
      const o = row.owned.get(imp.rarity) ?? { copies: 0, unplaced: 0 };
      o.copies++;
      if (!imp.isPlaced) { o.unplaced++; row.unplaced++; }
      row.owned.set(imp.rarity, o);
    }
    advice.queue.forEach((step, i) => byAlly.get(step.allyId)?.steps.push({ rank: i + 1, step }));
    let lo = Infinity, hi = -Infinity;
    for (const r of byAlly.values()) for (const e of r.eff) if (e !== null) { lo = Math.min(lo, e); hi = Math.max(hi, e); }
    return { rows: [...byAlly.values()], min: lo, max: hi };
  }, [owned, byIdRarity, inherited, weights, advice]);

  const sorted = useMemo(() => {
    const names = new Map(rows.map(r => [r.allyId, allyName(r.allyId, gameLang)]));
    const firstRank = (r: Row) => r.steps[0]?.rank ?? Number.MAX_SAFE_INTEGER;
    const arr = [...rows];
    arr.sort((a, b) => {
      let c: number;
      if (sortKey === "name") c = (names.get(a.allyId) ?? "").localeCompare(names.get(b.allyId) ?? "");
      else if (sortKey === "priority") c = firstRank(a) - firstRank(b);
      else c = (a.eff[sortKey - 1] ?? -1) - (b.eff[sortKey - 1] ?? -1);
      if (c === 0) c = (names.get(a.allyId) ?? "").localeCompare(names.get(b.allyId) ?? "");
      return sortDesc ? -c : c;
    });
    return arr;
  }, [rows, sortKey, sortDesc, allyName, gameLang]);

  if (rows.length === 0 && advice.science.length === 0) return null;

  const toggle = () => {
    setOpen(v => {
      try { localStorage.setItem(ALLY_ADVISOR_OPEN_KEY, String(!v)); } catch { /* best-effort */ }
      return !v;
    });
  };
  const sortBy = (k: SortKey) => {
    if (k === sortKey) setSortDesc(d => !d);
    else { setSortKey(k); setSortDesc(typeof k === "number"); }
  };
  const arrow = (k: SortKey) => (k === sortKey ? (sortDesc ? " ▼" : " ▲") : "");
  const toggleRow = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const span = max > min ? max - min : 1;

  // "Alla tua portata" = il SINGOLO passo costa al massimo i gettoni posseduti
  // (non il cumulativo dall'inizio della coda: con 335 gettoni e il #1 da 400
  // nessun badge risultava verde, pur potendo fare subito il #2 da 200).
  const firstMissing = advice.queue.find(s => s.cumulative > valor) ?? null;
  const bestAffordableIdx = advice.queue.findIndex(s => s.cost <= valor);
  const bestAffordable = bestAffordableIdx >= 0 ? advice.queue[bestAffordableIdx] : null;

  const rarityBadge = (r: number) => (
    <span className={`inline-block rounded border px-1 text-[11px] font-bold ${RARITY_DISPLAY[r]?.badgeOn ?? ""}`}>
      {RARITY_DISPLAY[r]?.label ?? r}
    </span>
  );
  const stepTitle = (rank: number, s: AdvisorStep) =>
    t("allyAdvisorStepTitle", uiLang, rank, rarityName(s.fromRarity, lang), rarityName(s.toRarity, lang), fmt0(s.cost), fmt1(s.gain), fmt3(s.ratio));

  return (
    <div className="mb-3 rounded border border-amber-700/50 bg-slate-900/40">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-bold uppercase tracking-wider text-amber-300 hover:bg-slate-800/40"
      >
        <span>{open ? "▼" : "▶"}</span>
        <span>🎖️ {t("allyAdvisorTitle", uiLang)}</span>
        <span className="ml-auto normal-case font-normal tracking-normal text-slate-300">
          {t("allyAdvisorValorOwned", uiLang)}: <span className="font-bold text-amber-300">{fmt0(valor)}</span>
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-800 px-3 py-3 text-[13px] text-slate-300">
          <p className="text-slate-400">{t("allyAdvisorIntro", uiLang, rarityName(MAX_TARGET_RARITY, lang))}</p>
          <p className="text-slate-400">{t("allyAdvisorLegend", uiLang)}</p>
          {advice.queue.length > 0 && (
            <p className="text-slate-200">
              {firstMissing
                ? t("allyAdvisorQueueNext", uiLang, allyName(firstMissing.allyId, gameLang), fmt0(firstMissing.cumulative - valor))
                : t("allyAdvisorQueueAllAffordable", uiLang)}
              {bestAffordable && bestAffordableIdx > 0 && (
                <> {t("allyAdvisorBestNow", uiLang, bestAffordableIdx + 1, allyName(bestAffordable.allyId, gameLang), fmt0(bestAffordable.cost))}</>
              )}
            </p>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto pt-2">
              <table className="w-auto border-collapse text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="cursor-pointer py-1 pr-4 hover:text-slate-200" onClick={() => sortBy("name")}>
                      {t("allyAdvisorColAlly", uiLang)}{arrow("name")}
                    </th>
                    {TIERS.map(r => (
                      <th key={r} className="cursor-pointer px-1 py-1 text-center hover:text-slate-200" onClick={() => sortBy(r)}
                        title={t("allyMatrixSortTitle", uiLang, rarityName(r, lang))}>
                        <span className={`inline-block w-[72px] rounded border px-1 text-center text-[11px] font-bold ${RARITY_DISPLAY[r]?.badgeOn ?? ""}`}>
                          {RARITY_DISPLAY[r]?.label ?? r}{arrow(r)}
                        </span>
                      </th>
                    ))}
                    <th className="cursor-pointer py-1 pl-3 hover:text-slate-200" onClick={() => sortBy("priority")}
                      title={t("allyAdvisorSortPriorityTitle", uiLang)}>
                      {t("allyAdvisorColNext", uiLang)}{arrow("priority")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(row => {
                    const isOpen = expanded.has(row.allyId);
                    // Rarità saltate da un passo multiplo (es. COM → RAR salta UNC).
                    const skipped = new Set<number>();
                    for (const { step } of row.steps) for (let r = step.fromRarity + 1; r < step.toRarity; r++) skipped.add(r);
                    const next = row.steps[0];
                    return (
                      <Fragment key={row.allyId}>
                        <tr className="border-t border-slate-800/60">
                          <td className="py-1 pr-4 whitespace-nowrap">
                            <button type="button" onClick={() => toggleRow(row.allyId)} className="text-left text-slate-100 hover:text-amber-200"
                              title={t("allyAdvisorExpandTitle", uiLang)}>
                              <span className="mr-1 text-slate-500">{row.steps.length > 0 ? (isOpen ? "▾" : "▸") : "·"}</span>
                              {allyName(row.allyId, gameLang)}
                            </button>
                            {row.unplaced > 0 && (
                              <span className="ml-1.5 inline-block text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-red-950 text-red-400 border border-red-600"
                                title={t("allyHasUnplacedCopyTitle", uiLang)}>
                                {t("allyNotPlacedBadge", uiLang)}
                              </span>
                            )}
                          </td>
                          {TIERS.map(r => {
                            const e = row.eff[r - 1];
                            const o = row.owned.get(r);
                            const arrivals = row.steps.filter(s => s.step.toRarity === r);
                            const title = o
                              ? t("allyMatrixOwnedTitle", uiLang, rarityName(r, lang), o.copies, o.unplaced)
                              : rarityName(r, lang);
                            const frame = o
                              ? "ring-2 ring-white/90 font-bold text-white"
                              : skipped.has(r) ? "outline-dashed outline-1 outline-slate-300/70 text-slate-200" : "text-slate-200";
                            return (
                              <td key={r} className="px-1 py-1">
                                <div title={title} className={`relative w-[72px] rounded px-1 py-1 text-center font-mono ${frame}`}
                                  style={{ background: e === null ? "transparent" : heat((e - min) / span) }}>
                                  {e === null ? "-" : fmt1(e)}
                                  {o && o.copies > 1 && <span className="ml-1 text-[10px] font-normal text-white/80">×{o.copies}</span>}
                                  {arrivals.length > 0 && (
                                    <span className="absolute -top-2 -right-2 z-10 flex gap-0.5">
                                      {arrivals.map(({ rank, step }) => (
                                        <span key={rank} title={stepTitle(rank, step)}
                                          className={`rounded-full px-1 text-[10px] font-bold leading-4 shadow ${step.cost <= valor ? "bg-emerald-400 text-emerald-950" : "bg-slate-200 text-slate-900"}`}>
                                          #{rank}
                                        </span>
                                      ))}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="py-1 pl-3 whitespace-nowrap text-slate-300">
                            {next ? (
                              <span title={stepTitle(next.rank, next.step)}>
                                <span className="font-bold text-slate-100">#{next.rank}</span>{" "}
                                {rarityBadge(next.step.fromRarity)} → {rarityBadge(next.step.toRarity)}{" "}
                                <span className="font-mono">{fmt0(next.step.cost)}</span>{" "}
                                <span className="text-slate-500">{t("allyAdvisorTokensShort", uiLang)}</span>{" · "}
                                <span className="font-mono">{fmt3(next.step.ratio)}</span>{" "}
                                <span className="text-slate-500">{t("allyAdvisorColRatio", uiLang)}</span>
                              </span>
                            ) : (
                              <span className="text-slate-500">{t("allyAdvisorNoNext", uiLang)}</span>
                            )}
                          </td>
                        </tr>
                        {isOpen && row.steps.length > 0 && (
                          <tr>
                            <td colSpan={TIERS.length + 2} className="pb-3 pl-6 pt-1">
                              <table className="building-table w-auto border-collapse text-left">
                                <thead>
                                  <tr className="bt-thead-row1 text-[12px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                    <th className="py-1 px-2" colSpan={5}>{t("allyAdvisorDeltaNote", uiLang)}</th>
                                    {groupHeaders}
                                  </tr>
                                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="py-1 px-2">#</th>
                                    <th className="py-1 pr-2">{t("allyAdvisorColStep", uiLang)}</th>
                                    <th className="py-1 pr-2 text-right">{t("allyAdvisorColTokens", uiLang)}</th>
                                    <th className="py-1 pr-2 text-right">{t("allyAdvisorColGain", uiLang)}</th>
                                    <th className="py-1 pr-2 text-right">{t("allyAdvisorColRatio", uiLang)}</th>
                                    {statHeaders}
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.steps.map(({ rank, step }) => (
                                    <tr key={rank} className={`border-b border-slate-800/60 ${step.cost <= valor ? "bg-emerald-900/20" : ""}`}>
                                      <td className="py-1 px-2 text-left text-slate-400">{rank}</td>
                                      <td className="py-1 pr-2 text-left">
                                        {rarityBadge(step.fromRarity)} → {rarityBadge(step.toRarity)}
                                        {step.toRarity - step.fromRarity > 1 && (
                                          <span className="ml-1 text-[11px] text-slate-500">{t("allyAdvisorMultiStep", uiLang, step.toRarity - step.fromRarity)}</span>
                                        )}
                                      </td>
                                      <td className="py-1 pr-2 text-right font-mono">{fmt0(step.cost)}</td>
                                      <td className="py-1 pr-2 text-right font-mono text-emerald-300">+{fmt1(step.gain)}</td>
                                      <td className="py-1 pr-2 text-right font-mono">{fmt3(step.ratio)}</td>
                                      {renderBoostCells(step.dGeneral, step.dGbg, step.dSped)}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Non valutati (scienza) */}
          {advice.science.length > 0 && (
            <section>
              <h4 className="mb-1 font-bold text-slate-100">{t("allyAdvisorScienceTitle", uiLang)}</h4>
              <p className="mb-1 text-slate-400">{t("allyAdvisorScienceNote", uiLang)}</p>
              <ul className="space-y-0.5">
                {advice.science.map(s => (
                  <li key={s.jsonId}>
                    <span className="text-slate-100">{allyName(s.allyId, gameLang)}</span>
                    {s.copies > 1 && <span className="ml-1 text-slate-500">×{s.copies}</span>} {rarityBadge(s.rarity)}{" — "}
                    {t("allyAdvisorScienceFacts", uiLang, fmt0(s.pf), fmt0(s.beni), fmt0(s.beniP))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-[11px] text-slate-500">{t("allyAdvisorFootnote", uiLang, advice.evaluatedCount)}</p>
        </div>
      )}
    </div>
  );
}
