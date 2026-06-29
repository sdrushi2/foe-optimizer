import {
  X as XIcon,
  UserCog,
  User,
  Pencil,
  MousePointerClick,
  Trash2,
  AlertTriangle,
  Wand2,
  Lightbulb,
  Download,
  Upload,
} from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";

interface ProfileHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLang: UiLang;
}

/** Modale "Profili e Bacchetta Magica": spiega cosa sono i profili, come usare
 *  la bacchetta magica per importare i dati, e i pulsanti SAVE/LOAD. Estratta
 *  da App.tsx in un modulo a parte perché è completamente autocontenuta —
 *  non usa nessuno stato/calcolo di App, solo isOpen/onClose/uiLang. */
export default function ProfileHelpModal({ isOpen, onClose, uiLang }: ProfileHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <UserCog size={18} /> {t("profileHelpModalTitle", uiLang)}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors">
            <XIcon size={18} />
          </button>
        </div>

        {/* Corpo scrollabile */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-slate-300 leading-relaxed">

          {/* Sezione 1 - Profili */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">1</span>
              <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wide">{t("profileHelpStep1Title", uiLang)}</h3>
            </div>
            <p className="mb-3">
              {t("profileHelpStep1Intro", uiLang)}
            </p>
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
              <div className="flex items-start gap-3">
                <User size={16} className="mt-0.5 text-slate-500 shrink-0" />
                <p>{t("profileHelpIndependent", uiLang)}</p>
              </div>
              <div className="flex items-start gap-3">
                <Pencil size={16} className="mt-0.5 text-slate-500 shrink-0" />
                <p>{t("profileHelpDoubleClick", uiLang)}</p>
              </div>
              <div className="flex items-start gap-3">
                <MousePointerClick size={16} className="mt-0.5 text-slate-500 shrink-0" />
                <p>{t("profileHelpSingleClick", uiLang)}</p>
              </div>
              <div className="flex items-start gap-3">
                <Trash2 size={16} className="mt-0.5 text-slate-500 shrink-0" />
                <p>{t("profileHelpDeleteOne", uiLang)}</p>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="mt-0.5 text-red-400 shrink-0" />
                <p>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-red-500/30 bg-red-500/10 text-red-300 mr-1"><Trash2 size={11} /></span>
                  {t("profileHelpDeleteAllBody", uiLang)}
                </p>
              </div>
            </div>
          </section>

          {/* Sezione 2 - Bacchetta Magica */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">2</span>
              <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
                {t("profileHelpStep2Title", uiLang)} <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"><Wand2 size={12} /></span>
              </h3>
            </div>
            <p className="mb-3">
              {t("profileHelpStep2Intro", uiLang)}
            </p>

            {/* Video tutorial: due file separati per lingua (non solo
                sottotitoli/audio diversi, un montaggio diverso). Il cambio
                lingua nell'app fa sempre un reload completo della pagina
                (vedi handleUiLangChange in App.tsx), quindi il <video> viene
                sempre rimontato da zero con la sorgente giusta — non serve
                gestire un cambio di src "a caldo" senza remount. */}
            <div className="mb-4 rounded-xl overflow-hidden border border-slate-800 bg-black">
              <video
                controls
                preload="none"
                playsInline
                poster={uiLang === "it" ? "tutorial-it.jpg" : "tutorial-eng.jpg"}
                className="w-full block"
                title={t("profileHelpVideoTitle", uiLang)}
              >
                <source src={uiLang === "it" ? "tutorial-it.mp4" : "tutorial-eng.mp4"} type="video/mp4" />
              </video>
            </div>

            {/* Come funziona – step */}
            <div className="space-y-3">

              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                <p className="font-bold text-slate-100 mb-1 flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[11px] font-bold text-slate-100">1</span>
                  {t("profileHelpStep2_1Title", uiLang)}
                </p>
                <p className="text-slate-400 text-xs">{t("profileHelpStep2_1Body", uiLang)}</p>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                <p className="font-bold text-slate-100 mb-1 flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[11px] font-bold text-slate-100">2</span>
                  {t("profileHelpStep2_2Title", uiLang)} <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"><Wand2 size={12} /></span>
                </p>
                <p className="text-slate-400 text-xs">{t("profileHelpStep2_2Body", uiLang)}</p>
                <div className="mt-2 flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-slate-500 font-mono truncate">javascript:(function()...</span>
                  <span className="text-[9px] text-amber-400 font-bold shrink-0">{t("profileHelpBookmarkHint", uiLang)}</span>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                <p className="font-bold text-slate-100 mb-1 flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[11px] font-bold text-slate-100">3</span>
                  {t("profileHelpStep2_3Title", uiLang)}
                </p>
                <p className="text-slate-400 text-xs">{t("profileHelpStep2_3Body", uiLang)}</p>
              </div>

              <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/30">
                <p className="font-bold text-amber-300 mb-1 flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[11px] font-bold text-slate-100">4</span>
                  {t("profileHelpStep2_4Title", uiLang)} <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"><Wand2 size={12} /></span>
                </p>
                <p className="text-slate-300 text-xs">{t("profileHelpStep2_4Body", uiLang)}</p>
              </div>

            </div>

            {/* Nota */}
            <div className="mt-4 flex items-start gap-2 bg-slate-800/50 rounded-xl p-3 border border-slate-700/60">
              <Lightbulb size={15} className="shrink-0 mt-0.5 text-amber-400" />
              <p className="text-xs text-slate-400">
                {t("profileHelpUpdateNote", uiLang, t("profileHelpUpdateNoteEmphasis", uiLang))}
              </p>
            </div>
          </section>

          {/* Sezione 3 - Export/Import sessione */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950">3</span>
              <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wide">{t("profileHelpStep3Title", uiLang)}</h3>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-start gap-3">
                <button
                  className="flex items-center justify-center w-7 h-7 rounded border border-slate-600 bg-slate-700/20 text-slate-400 transition-all shrink-0"
                  title={t("exportProfiles", uiLang)}
                >
                  <Download size={13} />
                </button>
                <p className="text-slate-300 text-xs pt-0.5">{t("profileHelpSaveBody", uiLang)}</p>
              </div>
              <div className="flex items-start gap-3">
                <button
                  className="flex items-center justify-center w-7 h-7 rounded border border-slate-600 bg-slate-700/20 text-slate-400 transition-all shrink-0"
                  title={t("importProfiles", uiLang)}
                >
                  <Upload size={13} />
                </button>
                <p className="text-slate-300 text-xs pt-0.5">{t("profileHelpLoadBody", uiLang)}</p>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            {t("gotItExclamationButton", uiLang)}
          </button>
        </div>
      </div>
    </div>
  );
}
