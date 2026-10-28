// ─────────────────────────────────────────────────────────────────────────────
//  planner/VideoTutorial.tsx — "Come usare il planner" (2.0)
//
//  Prima era un popup; ora è un pannello come Statistiche o Debug (riquadro
//  squadrato, titolo in maiuscolo), aperto e chiuso da due pulsanti:
//  Planner › Aiuto › Video tutorial e Guida › Come usare il planner.
//  Il video (public/video/planner-ita.mp4, solo in italiano; /video/* passa da
//  functions/video/[[file]].js per poter saltare a un punto) si scarica solo quando
//  si apre il pannello (preload="metadata").
// ─────────────────────────────────────────────────────────────────────────────

import { t, type UiLang } from "../data/ui-strings";

export default function VideoTutorial({ uiLang }: { uiLang: UiLang }) {
  return (
    <div className="w-full border border-slate-800 bg-slate-950 p-3 text-xs">
      <div className="mb-1 font-bold uppercase tracking-wide text-slate-200">{t("r2PlannerHow", uiLang)}</div>
      <p className="mb-3 text-slate-400">{t("r2PlannerHowIntro", uiLang)}</p>
      <video controls autoPlay playsInline preload="metadata" poster="planner-ita.jpg"
        className="block max-h-[70vh] w-full max-w-5xl border border-slate-800 bg-black" title={t("plannerVideoTitle", uiLang)}>
        <source src="/video/planner-ita.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
