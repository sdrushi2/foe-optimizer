import { X as XIcon, Info, AtSign } from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";

const AVATAR_IT   = "https://foeit.innogamescdn.com/assets/shared/avatars/portrait_359-bfd78cf37.jpg";
const AVATAR_BETA = "https://foezz.innogamescdn.com/assets/shared/avatars/portrait_847-c8fad0549.jpg";
const GITHUB_URL  = "https://github.com/sdrushi2/foe-optimizer";
const EMAIL_ADDR  = "info@foe-optimizer.com";

/** Logo GitHub (SVG inline -- non disponibile in questa versione di lucide-react) */
function GithubIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLang: UiLang;
}

/** Modale "Chi sono - Contatti": avatar + server FoE + link GitHub.
 *  Autocontenuta -- non usa nessuno stato/calcolo di App, solo isOpen/onClose/uiLang. */
export default function AboutModal({ isOpen, onClose, uiLang }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <Info size={18} /> {t("aboutTitle", uiLang)}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("closeAriaLabel", uiLang)}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-300 leading-relaxed">

          {/* Sezione contatti */}
          <section>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wide mb-3">
              {t("aboutContactLabel", uiLang)}
            </p>
            <div className="flex gap-3">

              {/* Server Italiano */}
              <div className="flex-1 bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex flex-col items-center gap-2 text-center">
                <img
                  src={AVATAR_IT}
                  alt="Sdrushi -- server italiano"
                  className="w-16 h-16 rounded border-2 border-amber-500/50 object-cover"
                />
                <div>
                  <p className="font-bold text-slate-100">Sdrushi</p>
                  <p className="text-xs text-amber-400">{t("aboutServerItLabel", uiLang)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t("aboutWorldLabel", uiLang)}:{" "}
                    <span className="text-slate-400">Fel Dranghyr</span>
                  </p>
                </div>
              </div>

              {/* Server Beta */}
              <div className="flex-1 bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex flex-col items-center gap-2 text-center">
                <img
                  src={AVATAR_BETA}
                  alt="Sdrushi -- server beta"
                  className="w-16 h-16 rounded border-2 border-blue-500/40 object-cover"
                />
                <div>
                  <p className="font-bold text-slate-100">Sdrushi</p>
                  <p className="text-xs text-blue-400">{t("aboutServerBetaLabel", uiLang)}</p>
                </div>
              </div>

            </div>
            <a
              href={`mailto:${EMAIL_ADDR}`}
              className="mt-3 flex items-center gap-3 bg-slate-950/60 rounded-xl p-3 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/60 transition-all group"
            >
              <AtSign size={16} className="text-slate-400 group-hover:text-slate-100 shrink-0 transition-colors" />
              <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">{EMAIL_ADDR}</span>
            </a>
          </section>

          {/* Sezione GitHub */}
          <section>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wide mb-3">
              {t("aboutGithubLabel", uiLang)}
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-slate-950/60 rounded-xl p-3 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/60 transition-all group"
            >
              <GithubIcon size={20} className="text-slate-400 group-hover:text-slate-100 shrink-0 transition-colors" />
              <div className="min-w-0">
                <p className="font-bold text-slate-100 text-sm truncate">sdrushi2/foe-optimizer</p>
                <p className="text-xs text-slate-500 truncate">{GITHUB_URL}</p>
              </div>
            </a>
          </section>

        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            {t("gotItButton", uiLang)}
          </button>
        </div>
      </div>
    </div>
  );
}
