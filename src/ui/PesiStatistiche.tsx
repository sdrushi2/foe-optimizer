// ─────────────────────────────────────────────────────────────────────────────
//  ui/PesiStatistiche.tsx — Gruppo "Pesi statistiche" del nastro Opzioni (2.0)
//
//  Tre righe di solo testo (proposta 1 scelta dall'utente):
//   1. "Difesa vale 80% · 100% dell'attacco" (l'attacco pesa sempre 1);
//   2. casella "Conta anche le spedizioni" (+ "?" con la spiegazione);
//   3. "Campi / Sped." con il cursore della ripartizione e i due numeri ai
//      lati (Campi = 100 − Spedizioni); spento se le spedizioni non contano.
//  La logica è invariata: stato in App.tsx (stesse chiavi localStorage),
//  difesa 0,8/1,0, spedAttacco 0–1 a passi di 0,05.
// ─────────────────────────────────────────────────────────────────────────────

import { Check, CircleHelp } from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";

export interface StatoPesi {
  uiLang: UiLang;
  difesa: 0.8 | 1.0;
  setDifesa: (v: 0.8 | 1.0) => void;
  spedizioni: boolean;
  setSpedizioni: (v: boolean) => void;
  spedAttacco: number;
  setSpedAttacco: (v: number) => void;
  onAiuto: () => void;
  /** Pannello "Come si calcola" aperto (il "?" resta acceso). */
  aiutoAperto?: boolean;
}

const riga = "flex h-[22px] items-center gap-2 text-[11px] whitespace-nowrap";
const chiave = "w-[78px] shrink-0 text-slate-400";

export function BloccoPesi({ s }: { s: StatoPesi }) {
  const sped = Math.round(s.spedAttacco * 100);
  return (
    <div className="flex flex-col gap-[3px]">
      <div className={riga}>
        <span className={chiave}>{t("r2WDefIs", s.uiLang)}</span>
        {([0.8, 1.0] as const).map(v => (
          <button key={v} type="button" aria-pressed={s.difesa === v} onClick={() => s.setDifesa(v)}
            className={`px-0.5 ${s.difesa === v ? "text-slate-100 underline decoration-slate-400 underline-offset-[3px]" : "text-slate-500 hover:text-slate-300"}`}>
            {v === 1 ? "100%" : "80%"}
          </button>
        ))}
        <span className="text-slate-500">{t("r2WOfAtk", s.uiLang)}</span>
      </div>
      <div className={riga}>
        <label className="flex cursor-pointer items-center gap-1.5 text-slate-200 hover:text-slate-50">
          <input type="checkbox" checked={s.spedizioni} onChange={() => s.setSpedizioni(!s.spedizioni)} className="peer sr-only" />
          <span aria-hidden="true" className={`relative block h-3 w-3 shrink-0 rounded-[4px] border ${s.spedizioni
            ? "border-emerald-500 bg-emerald-500"
            : "border-slate-600 bg-slate-950 peer-hover:border-slate-400"} peer-focus-visible:ring-1 peer-focus-visible:ring-emerald-400`}>
            {s.spedizioni && <Check size={9} strokeWidth={3} className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-950" />}
          </span>
          {t("r2WIncludeGe", s.uiLang)}
        </label>
        <button type="button" onClick={s.onAiuto} title={t("efficiencyHelpTitle", s.uiLang)} aria-label={t("r2HowItWorks", s.uiLang)}
          aria-pressed={!!s.aiutoAperto} className={`ml-auto hover:text-sky-300 ${s.aiutoAperto ? "text-sky-400" : "text-slate-500"}`}>
          <CircleHelp size={13} aria-hidden="true" />
        </button>
      </div>
      <div className={`${riga} ${s.spedizioni ? "" : "pointer-events-none opacity-35"}`} title={t("spedizioniAttackSliderLabel", s.uiLang)}>
        <span className={chiave}>{t("r2WSplit", s.uiLang)}</span>
        <span className="w-6 text-right font-mono text-slate-100">{s.spedizioni ? 100 - sped : 100}</span>
        <input type="range" min="0" max="1" step="0.05" value={s.spedAttacco} disabled={!s.spedizioni}
          aria-label={t("spedizioniAttackSliderLabel", s.uiLang)}
          onInput={(e) => s.setSpedAttacco(parseFloat(e.currentTarget.value))}
          className="h-1 w-[90px] cursor-pointer accent-slate-400" />
        <span className="w-6 font-mono text-slate-100">{s.spedizioni ? sped : 0}</span>
      </div>
    </div>
  );
}
