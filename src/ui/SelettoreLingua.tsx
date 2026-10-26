// ─────────────────────────────────────────────────────────────────────────────
//  ui/SelettoreLingua.tsx — Lingua dell'interfaccia con le bandiere (2.0)
//
//  Come nella 1.x (LanguageSwitch di App.tsx): un pulsante con la bandiera
//  della lingua attiva che apre un piccolo menu con tutte le lingue. Il menu è
//  `position: fixed`, così non lo taglia la riga delle schede (overflow
//  hidden). Si chiude al clic fuori o con Esc.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { ChevronDown } from "lucide-react";
import { t, UI_LANGUAGES, type UiLang } from "../data/ui-strings";

/** Bandiera italiana (SVG, non emoji: uguale su ogni sistema). */
function FlagIT({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 24 17.3" className="shrink-0 rounded-[2px] shadow-sm" aria-hidden="true">
      <rect width="24" height="17.3" rx="2" fill="#F4F9FF" />
      <path d="M2 0h6v17.3H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Z" fill="#008C45" />
      <rect x="16" width="8" height="17.3" fill="#CD212A" />
      <path d="M16 0h6a2 2 0 0 1 2 2v13.3a2 2 0 0 1-2 2h-6Z" fill="#CD212A" />
      <rect width="24" height="17.3" rx="2" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
    </svg>
  );
}

/** Bandiera del Regno Unito (Union Jack semplificata). */
function FlagGB({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 24 17.3" className="shrink-0 rounded-[2px] shadow-sm" aria-hidden="true">
      <defs><clipPath id="flagGbClip2"><rect width="24" height="17.3" rx="2" /></clipPath></defs>
      <g clipPath="url(#flagGbClip2)">
        <rect width="24" height="17.3" fill="#012169" />
        <path d="M0 0 24 17.3 M24 0 0 17.3" stroke="#FFFFFF" strokeWidth="3.4" />
        <path d="M0 0 24 17.3 M24 0 0 17.3" stroke="#C8102E" strokeWidth="1.3" />
        <path d="M12 0v17.3 M0 8.65h24" stroke="#FFFFFF" strokeWidth="5.7" />
        <path d="M12 0v17.3 M0 8.65h24" stroke="#C8102E" strokeWidth="3.4" />
      </g>
      <rect width="24" height="17.3" rx="2" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
    </svg>
  );
}

/** Bandiera di ogni lingua (nuova lingua = una voce qui e in UI_LANGUAGES). */
const BANDIERA: Record<UiLang, ComponentType<{ size?: number }>> = { it: FlagIT, en: FlagGB };

export default function SelettoreLingua({ uiLang, onLingua }: { uiLang: UiLang; onLingua: (l: UiLang) => void }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rifPulsante = useRef<HTMLButtonElement>(null);
  const rifMenu = useRef<HTMLDivElement>(null);
  const Attiva = BANDIERA[uiLang];

  useEffect(() => {
    if (!pos) return;
    const fuori = (e: MouseEvent) => {
      const n = e.target as Node;
      if (rifPulsante.current?.contains(n) || rifMenu.current?.contains(n)) return;
      setPos(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [pos]);

  const apri = () => {
    if (pos) { setPos(null); return; }
    const r = rifPulsante.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  return (
    <>
      <button ref={rifPulsante} type="button" onClick={apri} aria-expanded={!!pos}
        title={t("languageSwitchTitle", uiLang)} aria-label={t("languageSwitchTitle", uiLang)}
        className="flex h-7 items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-1.5 hover:border-slate-600">
        <Attiva size={22} />
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${pos ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {pos && (
        <div ref={rifMenu} style={{ top: pos.top, right: pos.right }}
          className="fixed z-[60] min-w-[170px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 p-1 text-[12px] shadow-xl">
          {UI_LANGUAGES.map(({ code, nativeName }) => {
            const Bandiera = BANDIERA[code];
            const attiva = code === uiLang;
            return (
              <button key={code} type="button" onClick={() => { setPos(null); onLingua(code); }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left ${attiva ? "bg-sky-950/70 font-semibold text-slate-50" : "text-slate-200 hover:bg-slate-800"}`}>
                <Bandiera size={18} />
                {nativeName}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
