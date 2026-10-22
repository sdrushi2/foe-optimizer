// ─────────────────────────────────────────────────────────────────────────────
//  planner/VideoTutorial.tsx — Pannello col video tutorial del Planner
//
//  Aperto dal pulsante "VIDEO TUTORIAL" a destra nella barra del Planner.
//  Il video (public/planner-ita.mp4, solo in italiano) si carica solo quando
//  si apre il pannello (preload="metadata": niente download a vuoto).
//  Chiusura: X, Esc, click sullo sfondo (useModalDismiss).
// ─────────────────────────────────────────────────────────────────────────────

import { t, type UiLang } from "../data/ui-strings";
import { useModalDismiss } from "../utils/useModalDismiss";

export default function VideoTutorial({ onClose, uiLang }: { onClose: () => void; uiLang: UiLang }) {
  const backdrop = useModalDismiss(true, onClose);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" {...backdrop}>
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-base font-bold text-rose-300">🎬 {t("plannerVideoTitle", uiLang)}</h2>
          <button type="button" onClick={onClose} aria-label={t("closeAriaLabel", uiLang)}
            className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-100">✕</button>
        </div>
        <div className="bg-black">
          <video controls autoPlay playsInline preload="metadata" poster="planner-ita.jpg"
            className="block max-h-[80vh] w-full" title={t("plannerVideoTitle", uiLang)}>
            <source src="planner-ita.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  );
}
