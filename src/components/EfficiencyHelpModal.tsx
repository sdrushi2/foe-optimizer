import { X as XIcon } from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";

interface EfficiencyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLang: UiLang;
}

/** Modale "⚖️ Efficienza e Pesi": spiega la formula di efficienza e i
 *  controlli di peso (Att/Dif/CAM/Σ/SPE) della toolbar. Estratta da App.tsx
 *  in un modulo a parte perché è completamente autocontenuta — non usa
 *  nessuno stato/calcolo di App, solo isOpen/onClose/uiLang. */
export default function EfficiencyHelpModal({ isOpen, onClose, uiLang }: EfficiencyHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h3 className="text-lg font-bold text-amber-400 uppercase tracking-wide">
            {t("effHelpTitle", uiLang)}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label={t("closeAriaLabel", uiLang)}
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-8 text-sm text-slate-200">
          <section>
            <h4 className="text-base font-bold text-amber-400 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">1</span>
              {t("effHelpStep1Title", uiLang)}
            </h4>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50 text-slate-300 leading-relaxed space-y-2">
              <p>{t("effHelpStep1Intro", uiLang)}</p>
              <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-amber-300 border border-slate-700/50 my-3">
                {t("effHelpFormula", uiLang)}
              </div>
              <p>{t("effHelpBonusesIntro", uiLang)}</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-slate-300">
                <li><span className="text-red-400 font-semibold">⚔️ {t("sectionGeneral", uiLang)}:</span> {t("effHelpBonusGeneral", uiLang)}</li>
                <li><span className="text-emerald-400 font-semibold">🔰 {t("sectionGbg", uiLang)}:</span> {t("effHelpBonusGbg", uiLang)}</li>
                <li><span className="text-violet-400 font-semibold">⚡ {t("sectionGe", uiLang)}:</span> {t("effHelpBonusGe", uiLang)}</li>
              </ul>
              <p className="text-slate-400 text-xs">
                {t("effHelpStep1Footnote", uiLang, t("effHelpBuildingsWord", uiLang), t("effHelpAlliesWord", uiLang))}
              </p>
            </div>
          </section>

          <section>
            <h4 className="text-base font-bold text-amber-400 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">2</span>
              {t("effHelpStep2Title", uiLang)}
            </h4>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50 text-slate-300 leading-relaxed space-y-4">
              <div>
                <p className="font-semibold text-slate-100 mb-1">{t("effHelpAtkTitle", uiLang, t("weightAtk", uiLang))}</p>
                <p className="text-slate-400 text-xs">{t("effHelpAtkBody", uiLang)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-100 mb-1">{t("effHelpDefTitle", uiLang, t("weightDef", uiLang))}</p>
                <p className="text-slate-400 text-xs">{t("effHelpDefBody", uiLang)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-100 mb-1">{t("effHelpCamTitle", uiLang, t("weightGbg", uiLang))}</p>
                <p className="text-slate-400 text-xs">{t("effHelpCamBody", uiLang)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-100 mb-1">{t("effHelpSigmaTitle")}</p>
                <p className="text-slate-400 text-xs">{t("effHelpSigmaBody", uiLang)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-100 mb-1">{t("effHelpSpeTitle", uiLang, t("weightGe", uiLang))}</p>
                <p className="text-slate-400 text-xs">{t("effHelpSpeBody", uiLang)}</p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-base font-bold text-amber-400 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">3</span>
              {t("effHelpStep3Title", uiLang)}
            </h4>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50 text-slate-300 leading-relaxed">
              <p className="text-xs text-slate-400">{t("effHelpStep3Body", uiLang)}</p>
            </div>
          </section>
        </div>
        <div className="flex justify-end border-t border-slate-800 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            {t("gotItButton", uiLang)}
          </button>
        </div>
      </div>
    </div>
  );
}
