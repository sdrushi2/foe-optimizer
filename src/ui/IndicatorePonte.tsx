// ─────────────────────────────────────────────────────────────────────────────
//  ui/IndicatorePonte.tsx — Pastiglia LIVE / OFF accanto alla bacchetta
//
//  Stato del ponte (data/ponte.ts):
//   ● LIVE verde  collegato: l'estensione c'è e la città arriva dal gioco
//   ● LIVE ambra  l'estensione c'è ma aspetta il gioco (non aperto, FoE
//                 Helper non attivo o città non ancora caricata)
//   ○ OFF grigio  estensione assente, disattivata o che non risponde (clic:
//                 pannello che spiega l'estensione, con i link agli store)
//   ⏸ PAUSA       estensione presente ma ponte in pausa (clic sull'indicatore:
//                 pausa / ripresa; scelta salvata, vedi impostaPausaPonte)
//  Il pallino verde lampeggia un attimo a ogni aggiornamento. Con poco spazio
//  (`compatta`) resta solo il pallino; la scritta va nel suggerimento.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pause, Plug, X } from "lucide-react";
import { impostaPausaPonte, usePonte } from "../data/ponte";
import { t, type UiLang } from "../data/ui-strings";
import StorePonte from "./StorePonte";

const W_PANNELLO = 360;

/** (27/11/2026) Pannello sotto l'indicatore OFF: cos'è l'estensione, cosa fa,
 *  cosa serve, link agli store. Si chiude con la X, Esc o un clic fuori. */
function PannelloPonte({ uiLang, pos, onChiudi, rifPulsante }: {
  uiLang: UiLang; pos: { left: number; top: number }; onChiudi: () => void;
  rifPulsante: { current: HTMLElement | null };
}) {
  const rif = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // il clic sull'indicatore non conta come "fuori": lo gestisce il suo onClick
    const fuori = (e: MouseEvent) => {
      const n = e.target as Node;
      if (rif.current?.contains(n) || rifPulsante.current?.contains(n)) return;
      onChiudi();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onChiudi(); };
    const tm = setTimeout(() => document.addEventListener("mousedown", fuori));
    document.addEventListener("keydown", esc);
    return () => { clearTimeout(tm); document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [onChiudi, rifPulsante]);
  const punti = [t("r2PonteInfoP1", uiLang), t("r2PonteInfoP2", uiLang), t("r2PonteInfoP3", uiLang)];
  return (
    <div ref={rif} role="dialog" aria-label="FoE Optimizer Bridge" style={{ left: pos.left, top: pos.top, width: W_PANNELLO }}
      className="fixed z-[60] rounded-lg border border-slate-700 bg-slate-900 p-3 text-[12px] font-normal tracking-normal whitespace-normal text-slate-300 shadow-xl">
      <div className="mb-2 flex items-start gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/50 bg-emerald-500/10 text-emerald-300">
          <Plug size={14} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-100">FoE Optimizer Bridge</div>
          <div className="text-[11px] text-slate-500">{t("r2PonteInfoSub", uiLang)}</div>
        </div>
        <button type="button" onClick={onChiudi} aria-label={t("r2PonteInfoClose", uiLang)} title={t("r2PonteInfoClose", uiLang)}
          className="-mt-1 -mr-1 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <p className="mb-2 leading-relaxed">{t("r2PonteInfoIntro", uiLang)}</p>
      <ul className="mb-2 space-y-1">
        {punti.map(p => (
          <li key={p} className="flex gap-1.5 leading-relaxed">
            <Check size={13} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="mb-2.5 leading-relaxed text-slate-400">{t("r2PonteInfoReq", uiLang)}</p>
      <StorePonte uiLang={uiLang} grandi />
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{t("r2PonteEsbNote", uiLang)}</p>
      <p className="mt-2.5 border-t border-slate-800 pt-2 text-[11px] leading-relaxed text-slate-500">
        {t("r2PonteInfoGia", uiLang)}{" "}
        <a href={uiLang === "it" ? "/privacy-bridge.html" : "/privacy-bridge.html#en"} target="_blank" rel="noopener noreferrer"
          className="text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200">{t("r2PonteInfoPrivacy", uiLang)}</a>
      </p>
    </div>
  );
}

export default function IndicatorePonte({ uiLang, compatta }: { uiLang: UiLang; compatta?: boolean }) {
  const p = usePonte();
  const pausa = p.presente && p.pausa;
  const live = p.presente && !pausa && p.schede > 0 && p.ultima !== null;
  const attesa = p.presente && !pausa && !live;
  const [lampo, setLampo] = useState(false);
  const [info, setInfo] = useState<{ left: number; top: number } | null>(null);
  const rifOff = useRef<HTMLButtonElement>(null);
  const chiudiInfo = useCallback(() => setInfo(null), []);
  // se l'estensione si accende col pannello aperto, il pannello non serve più
  useEffect(() => { if (p.presente) setInfo(null); }, [p.presente]);
  useEffect(() => {
    if (!p.arrivi) return;
    setLampo(true);
    const tm = setTimeout(() => setLampo(false), 700);
    return () => clearTimeout(tm);
  }, [p.arrivi]);

  const ora = p.ultima ? new Date(p.ultima.ts).toLocaleTimeString(uiLang === "it" ? "it-IT" : "en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  const titolo = pausa ? t("r2PontePausaTitle", uiLang)
    : live ? t("r2PonteLiveTitle", uiLang, p.ultima!.giocatore, p.ultima!.server, ora) + " · " + t("r2PonteClicPausa", uiLang)
    : attesa ? t("r2PonteWaitTitle", uiLang) + " · " + t("r2PonteClicPausa", uiLang) : t("r2PonteOffTitle", uiLang);
  const etichetta = pausa ? t("r2PontePausa", uiLang) : attesa || live ? "LIVE" : "OFF";

  const colori = pausa
    ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
    : live ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
    : attesa ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-slate-700 bg-slate-950/60 text-slate-500";
  const pallino = live
    ? `bg-emerald-400 ${lampo ? "shadow-[0_0_8px_3px_rgba(52,211,153,0.9)] scale-125" : "shadow-[0_0_6px_rgba(52,211,153,0.6)]"}`
    : attesa ? "bg-amber-400" : "border border-slate-500 bg-transparent";

  const base = `flex h-7 shrink-0 items-center gap-1.5 rounded-md border ${compatta ? "px-1.5" : "px-2"} text-[10px] font-bold tracking-wider select-none ${colori}`;
  const contenuto = <>
    {pausa
      ? <Pause aria-hidden="true" size={10} strokeWidth={3} />
      : <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full transition-all duration-300 ${pallino}`} />}
    {!compatta && etichetta}
  </>;

  // senza estensione non c'è niente da mettere in pausa: il clic apre il
  // pannello che spiega l'estensione e come installarla
  if (!p.presente) return <>
    <button ref={rifOff} type="button" title={titolo} aria-label={titolo} aria-expanded={!!info} aria-haspopup="dialog"
      onClick={e => {
        if (info) { setInfo(null); return; }
        const r = e.currentTarget.getBoundingClientRect();
        setInfo({ left: Math.max(4, Math.min(r.left, window.innerWidth - W_PANNELLO - 4)), top: r.bottom + 4 });
      }}
      className={`${base} cursor-pointer transition-colors hover:border-slate-500 hover:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400`}>
      {contenuto}
    </button>
    {info && <PannelloPonte uiLang={uiLang} pos={info} onChiudi={chiudiInfo} rifPulsante={rifOff} />}
  </>;
  return (
    <button type="button" title={titolo} aria-label={titolo} aria-pressed={pausa}
      onClick={() => impostaPausaPonte(!pausa)}
      className={`${base} cursor-pointer transition-colors hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400`}>
      {contenuto}
    </button>
  );
}
