// ─────────────────────────────────────────────────────────────────────────────
//  ui/Testata.tsx — Testata di FoE Optimizer 2.0: riga delle schede + nastro
//
//  Riga in alto: logo e nome del tool, versione, bacchetta magica, città attiva, schede (Database, Città,
//  Inventario, Planner, Alleati, Insediamenti, Opzioni, Guida) e, sempre
//  visibili a destra, la lingua (il tema è in Opzioni). Sotto, il nastro (Ribbon) della scheda
//  scelta. Le schede che richiedono una città restano visibili ma spente.
//  Quando lo spazio manca il nome del tool sparisce (restano le spade) e le schede si
//  stringono: niente barre di scorrimento.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Anchor, BookOpen, Building2, Check, Database, Map as MapIcon, Package, Settings, Swords, Users, Wand2, X, type LucideIcon } from "lucide-react";
import { BOOKMARKLET_JS } from "../data/bookmarklet";
import Ribbon, { type RibbonGroup } from "./ribbon/Ribbon";
import { t, type UiLang } from "../data/ui-strings";
import SelettoreCitta, { type VoceCitta } from "./SelettoreCitta";
import SelettoreLingua from "./SelettoreLingua";

export type Scheda = "database" | "citta" | "inventario" | "planner" | "alleati" | "insediamenti" | "opzioni" | "guida";

const SCHEDE: Array<{ id: Scheda; chiave: Parameters<typeof t>[0]; icona: LucideIcon }> = [
  { id: "database", chiave: "r2TabDatabase", icona: Database },
  { id: "citta", chiave: "r2TabCity", icona: Building2 },
  { id: "inventario", chiave: "r2TabInventory", icona: Package },
  { id: "planner", chiave: "r2TabPlanner", icona: MapIcon },
  { id: "alleati", chiave: "r2TabAllies", icona: Users },
  { id: "insediamenti", chiave: "r2TabSettlements", icona: Anchor },
  { id: "opzioni", chiave: "r2TabOptions", icona: Settings },
  { id: "guida", chiave: "r2TabHelp", icona: BookOpen },
];

interface Props {
  scheda: Scheda;
  onScheda: (s: Scheda) => void;
  /** Schede spente (con il motivo nel suggerimento). */
  spente: Partial<Record<Scheda, string>>;
  citta: VoceCitta[];
  cittaAttiva: string;
  onSelezionaCitta: (id: string) => void;
  onEliminaCitta: (id: string) => void;
  /** 2.0: "Importa da JSON" in fondo al menu del selettore città. */
  onImportaCittaJson?: () => void;
  onImporta: () => void;
  /** Avviso breve dopo l'import ("Aggiornata …"), sparisce da solo. */
  avviso: string | null;
  onChiudiAvviso: () => void;
  versione: string;
  /** Avatar del giocatore della città attiva (selettore della città). */
  avatar?: string | null;
  gruppi: RibbonGroup[];
  uiLang: UiLang;
  onLingua: (l: UiLang) => void;
}

export default function Testata({ scheda, onScheda, spente, citta, cittaAttiva, onSelezionaCitta, onEliminaCitta, onImportaCittaJson, onImporta, avviso, onChiudiAvviso, versione, gruppi, uiLang, onLingua, avatar }: Props) {
  const nomeCitta = citta.find(c => c.id === cittaAttiva)?.nome ?? null;
  useEffect(() => {
    if (!avviso) return;
    const tm = setTimeout(onChiudiAvviso, 5000);
    return () => clearTimeout(tm);
  }, [avviso, onChiudiAvviso]);
  // Compattazione della riga delle schede, come il nastro: si stringe un
  // passo alla volta finché non sta:
  //   0 tutto; 1 schede più strette; 2 senza titolo (restano
  //   le spade) e città corta; 3 schede come pulsanti con la sola icona (il
  //   nome nel suggerimento); 4 città solo icona; 5 schede in un menu.
  // `giro` riparte da 0 a ogni cambio di larghezza (anche se il livello era
  // già 0: prima la ricompattazione non ripartiva e le ultime schede
  // sparivano oltre il bordo).
  const MAX_LIVELLO = 5;
  const rif = useRef<HTMLDivElement>(null);
  const rifRiga = useRef<HTMLDivElement>(null);
  const [{ livello, giro }, setCompatta] = useState({ livello: 0, giro: 0 });
  useEffect(() => {
    const el = rif.current;
    if (!el) return;
    let ultima = -1;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === ultima) return;
      ultima = el.clientWidth;
      setCompatta(s => ({ livello: 0, giro: s.giro + 1 }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => { setCompatta(s => ({ livello: 0, giro: s.giro + 1 })); }, [nomeCitta, uiLang]);
  useLayoutEffect(() => {
    const el = rifRiga.current;
    if (el && livello < MAX_LIVELLO && el.scrollWidth > el.clientWidth + 1) setCompatta(s => ({ ...s, livello: s.livello + 1 }));
  }, [livello, giro]);
  const stretta = livello >= 1;
  const soloIcone = livello >= 3;

  return (
    <div ref={rif} className="sticky top-0 z-40 bg-slate-950 text-[12px]">
      {/* Riga delle schede, alta 42 px: logo, bacchetta, città e lingua centrati
          in verticale (h-7); le schede (h-8) poggiano sul nastro. */}
      {/* la linea sotto le schede è un'ombra interna (non un bordo): la scheda attiva, con lo
          sfondo del nastro, la copre e si fonde col nastro (col bordo, -mb-px veniva tagliato
          da overflow-hidden e la linea restava visibile) */}
      <div ref={rifRiga} className="flex h-[42px] items-end gap-px overflow-hidden bg-slate-900 px-2 whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-slate-700)]">
        {/* Logo (spade), titolo in ambra, versione e bacchetta magica sempre a
            portata (clic = importa; trascinabile nella barra dei preferiti). */}
        <span className="mr-1 flex shrink-0 items-center gap-2 self-center px-1" title={versione}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[11px] border-[1.5px] border-amber-500/80 bg-slate-950/80 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
            <Swords size={16} strokeWidth={2.5} aria-hidden="true" />
          </span>
          {livello < 2 && (
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-[20px] leading-none font-black tracking-wide text-transparent uppercase">FoE Optimizer</span>
          )}
          <button type="button" onClick={onImporta} draggable title={t("wandTitle", uiLang)} aria-label={t("wandTitle", uiLang)}
            onDragStart={e => {
              e.dataTransfer.setData("text/uri-list", BOOKMARKLET_JS);
              e.dataTransfer.setData("text/x-moz-url", `${BOOKMARKLET_JS}\nFoE COPY`);
              e.dataTransfer.setData("text/plain", BOOKMARKLET_JS);
            }}
            className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-200 active:cursor-grabbing">
            <Wand2 size={14} aria-hidden="true" />
          </button>
        </span>
        <SelettoreCitta citta={citta} attiva={cittaAttiva} onSeleziona={onSelezionaCitta} onElimina={onEliminaCitta} onImportaJson={onImportaCittaJson} avatar={avatar}
          uiLang={uiLang} maxW={livello >= 4 ? 44 : livello >= 2 ? 110 : 190} />
        {livello >= 5 ? (
          <select value={scheda} onChange={(e) => onScheda(e.currentTarget.value as Scheda)}
            className="h-7 self-center rounded-md border border-slate-700 bg-slate-950 px-1 text-slate-50">
            {SCHEDE.map(({ id, chiave }) => <option key={id} value={id} disabled={!!spente[id]}>{t(chiave, uiLang)}</option>)}
          </select>
        ) : SCHEDE.map(({ id, chiave, icona: Icona }) => {
          const motivo = spente[id];
          const sel = scheda === id;
          const nome = t(chiave, uiLang) as string;
          return (
            <button key={id} type="button" disabled={!!motivo} onClick={() => onScheda(id)}
              title={motivo ?? (soloIcone ? nome : "")} aria-label={nome}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 ${soloIcone ? "px-2" : stretta ? "px-2 text-[11px]" : "px-3"} disabled:cursor-not-allowed disabled:opacity-35 ${
                sel ? "relative border-slate-700 bg-slate-950 text-slate-50" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}>
              <Icona size={14} strokeWidth={1.75} className={sel ? "text-sky-300" : ""} aria-hidden="true" />
              {!soloIcone && nome}
            </button>
          );
        })}
        {/* Versione: sempre visibile, in grigio, accanto alla lingua. */}
        <span className="ml-auto flex shrink-0 items-center gap-2 self-center pl-2">
          <span className="font-mono text-[12px] text-slate-500" title={t("r2VersionTitle", uiLang)}>{versione}</span>
          {/* lingua con le bandiere, come nella 1.x */}
          <SelettoreLingua uiLang={uiLang} onLingua={onLingua} />
        </span>
      </div>
      <Ribbon groups={gruppi} />
      {avviso && (
        <div role="status" className="fixed right-4 bottom-4 z-[70] flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-950 px-3 py-2 text-[13px] text-emerald-100 shadow-xl">
          <Check size={15} className="text-emerald-400" aria-hidden="true" />{avviso}
          <button type="button" onClick={onChiudiAvviso} aria-label="OK" className="ml-1 rounded p-0.5 text-emerald-300 hover:bg-emerald-900"><X size={13} /></button>
        </div>
      )}
    </div>
  );
}
