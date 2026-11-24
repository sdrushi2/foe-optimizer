// ─────────────────────────────────────────────────────────────────────────────
//  ui/IndicatorePonte.tsx — Pastiglia LIVE / OFF accanto alla bacchetta
//
//  Stato del ponte (data/ponte.ts):
//   ● LIVE verde  collegato: l'estensione c'è e la città arriva dal gioco
//   ● LIVE ambra  l'estensione c'è ma aspetta il gioco (non aperto, FoE
//                 Helper non attivo o città non ancora caricata)
//   ○ OFF grigio  estensione assente, disattivata o che non risponde
//   ⏸ PAUSA       estensione presente ma ponte in pausa (clic sull'indicatore:
//                 pausa / ripresa; scelta salvata, vedi impostaPausaPonte)
//  Il pallino verde lampeggia un attimo a ogni aggiornamento. Con poco spazio
//  (`compatta`) resta solo il pallino; la scritta va nel suggerimento.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Pause } from "lucide-react";
import { impostaPausaPonte, usePonte } from "../data/ponte";
import { t, type UiLang } from "../data/ui-strings";

export default function IndicatorePonte({ uiLang, compatta }: { uiLang: UiLang; compatta?: boolean }) {
  const p = usePonte();
  const pausa = p.presente && p.pausa;
  const live = p.presente && !pausa && p.schede > 0 && p.ultima !== null;
  const attesa = p.presente && !pausa && !live;
  const [lampo, setLampo] = useState(false);
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

  // senza estensione non c'è niente da mettere in pausa: resta un'etichetta
  if (!p.presente) return <span role="status" title={titolo} aria-label={titolo} className={`${base} cursor-default`}>{contenuto}</span>;
  return (
    <button type="button" title={titolo} aria-label={titolo} aria-pressed={pausa}
      onClick={() => impostaPausaPonte(!pausa)}
      className={`${base} cursor-pointer transition-colors hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400`}>
      {contenuto}
    </button>
  );
}
