// ─────────────────────────────────────────────────────────────────────────────
//  ui/PannelloImporta.tsx — Guida › Come importare la città (2.0)
//
//  Prima era un popup (ProfileHelpModal, "Profili e Bacchetta magica"); ora è
//  un pannello che si apre e si chiude dal nastro come Statistiche o Debug,
//  con lo stesso riquadro squadrato. Due colonne (una sola su schermi
//  stretti): a sinistra i quattro passi, a destra video, cosa viene
//  importato, aggiornamenti e altri modi di portare una città nel tool.
//  Il passo 2 ha una bacchetta trascinabile, identica a quella della testata.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from "react";
import { ExternalLink, Wand2, RefreshCw, Building2, Eye, Anchor, FileJson, Download, ShieldCheck, Keyboard } from "lucide-react";
import { BOOKMARKLET_JS } from "../data/bookmarklet";
import { t, type UiLang } from "../data/ui-strings";

const ESTENSIONI = [
  { nome: "FoE Helper", chrome: "https://chromewebstore.google.com/detail/foe-helper/bkagcmloachflbbkfmfiggipaelfamdf", firefox: "https://addons.mozilla.org/en-US/firefox/addon/foe-helper/" },
  { nome: "Forge Hammer", chrome: "https://chromewebstore.google.com/detail/forge-hammer/kmicglnhmpaebfcoiojigbnepklclboa", firefox: "https://addons.mozilla.org/en-US/firefox/addon/forge-hammer/" },
];

/** Bacchetta trascinabile nella barra dei preferiti (come in testata). */
function Bacchetta({ uiLang, grande = false }: { uiLang: UiLang; grande?: boolean }) {
  return (
    <span role="img" aria-label={t("r2ImpDragTitle", uiLang)} draggable title={t("r2ImpDragTitle", uiLang)}
      onDragStart={e => {
        e.dataTransfer.setData("text/uri-list", BOOKMARKLET_JS);
        e.dataTransfer.setData("text/x-moz-url", `${BOOKMARKLET_JS}\nFoE COPY`);
        e.dataTransfer.setData("text/plain", BOOKMARKLET_JS);
      }}
      className={`inline-flex shrink-0 cursor-grab items-center gap-1.5 border border-emerald-500/50 bg-emerald-500/10 font-semibold text-emerald-300 hover:border-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-200 active:cursor-grabbing ${grande ? "px-2.5 py-1.5" : "h-5 w-5 justify-center align-[-4px]"}`}>
      <Wand2 size={grande ? 14 : 11} aria-hidden="true" />
      {grande && <span>FoE COPY</span>}
    </span>
  );
}

/** Un passo numerato. */
function Passo({ n, titolo, children }: { n: number; titolo: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 border border-slate-800 bg-slate-900/60 p-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-amber-500 text-[12px] font-black text-slate-950">{n}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="font-bold text-slate-100">{titolo}</div>
        <div className="space-y-1.5 leading-relaxed text-slate-400">{children}</div>
      </div>
    </div>
  );
}

/** Riga con icona (colonna di destra). */
function Voce({ icona, titolo, children }: { icona: ReactNode; titolo: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 shrink-0 text-slate-500">{icona}</span>
      <div className="min-w-0 leading-relaxed">
        <span className="font-semibold text-slate-200">{titolo}</span>{" "}
        <span className="text-slate-400">{children}</span>
      </div>
    </div>
  );
}

function Titoletto({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</div>;
}

export default function PannelloImporta({ uiLang }: { uiLang: UiLang }) {
  const L = (k: Parameters<typeof t>[0]) => t(k, uiLang) as string;
  return (
    <div className="w-full border border-slate-800 bg-slate-950 p-3 text-xs">
      <div className="mb-1 font-bold uppercase tracking-wide text-slate-200">{L("r2ImportHow")}</div>
      <p className="mb-3 text-slate-400">{L("r2ImpIntro")}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ── I quattro passi ── */}
        <section className="space-y-2">
          <Titoletto>{L("r2ImpSteps")}</Titoletto>
          <Passo n={1} titolo={L("r2ImpStep1")}>
            <p>{L("r2ImpStep1Body")}</p>
            <div className="flex flex-wrap gap-1.5">
              {ESTENSIONI.flatMap(e => [
                <a key={`${e.nome}-c`} href={e.chrome} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:border-slate-500 hover:text-slate-100">
                  {e.nome} · Chrome <ExternalLink size={10} aria-hidden="true" />
                </a>,
                <a key={`${e.nome}-f`} href={e.firefox} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:border-slate-500 hover:text-slate-100">
                  {e.nome} · Firefox <ExternalLink size={10} aria-hidden="true" />
                </a>,
              ])}
            </div>
          </Passo>
          <Passo n={2} titolo={L("r2ImpStep2")}>
            <div className="flex flex-wrap items-center gap-3">
              <Bacchetta uiLang={uiLang} grande />
              <span className="min-w-0 flex-1">{L("r2ImpStep2Body")}</span>
            </div>
            <p className="flex items-start gap-1.5 text-slate-500">
              <Keyboard size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {L("r2ImpStep2Tip")}
            </p>
          </Passo>
          <Passo n={3} titolo={L("r2ImpStep3")}>
            <p>{L("r2ImpStep3Body")}</p>
          </Passo>
          <Passo n={4} titolo={<>{L("r2ImpStep4")} <Bacchetta uiLang={uiLang} /></>}>
            <p>{L("r2ImpStep4Body")}</p>
          </Passo>
          <div className="flex gap-2.5 border border-amber-600/40 bg-amber-500/10 p-2.5 leading-relaxed text-slate-300">
            <RefreshCw size={14} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
            <span><span className="font-bold text-amber-300">{L("r2ImpUpdateTitle")}</span> {L("r2ImpUpdateBody")}</span>
          </div>
        </section>

        {/* ── Video e dettagli ── */}
        <section className="space-y-4">
          <div>
            <Titoletto>{L("r2ImpVideo")}</Titoletto>
            {/* due video diversi per lingua; il cambio lingua ricarica la pagina */}
            <video controls preload="none" playsInline className="block w-full border border-slate-800 bg-black"
              poster={uiLang === "it" ? "tutorial-it.jpg" : "tutorial-eng.jpg"} title={L("r2ImpVideo")}>
              <source src={uiLang === "it" ? "tutorial-it.mp4" : "tutorial-eng.mp4"} type="video/mp4" />
            </video>
            <p className="mt-1 text-[11px] text-slate-500">{L("r2ImpVideoNote")}</p>
          </div>

          <div className="space-y-2">
            <Titoletto>{L("r2ImpWhat")}</Titoletto>
            <Voce icona={<Building2 size={14} />} titolo={L("r2ImpWhatMine")}>{L("r2ImpWhatMineBody")}</Voce>
            <Voce icona={<Eye size={14} />} titolo={L("r2ImpWhatVisited")}>{L("r2ImpWhatVisitedBody")}</Voce>
            <Voce icona={<Anchor size={14} />} titolo={L("r2ImpWhatPirates")}>{L("r2ImpWhatPiratesBody")}</Voce>
          </div>

          <div className="space-y-2">
            <Titoletto>{L("r2ImpOther")}</Titoletto>
            <Voce icona={<FileJson size={14} />} titolo={L("r2ImpOtherJson")}>{L("r2ImpOtherJsonBody")}</Voce>
            <Voce icona={<Download size={14} />} titolo={L("r2ImpOtherBackup")}>{L("r2ImpOtherBackupBody")}</Voce>
          </div>

          <div className="flex gap-2.5 border-t border-slate-800 pt-3 leading-relaxed text-slate-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{L("r2ImpPrivacy")}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
