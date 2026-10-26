// ─────────────────────────────────────────────────────────────────────────────
//  ui/SelettoreCitta.tsx — Selettore della città nella testata (2.0)
//
//  Al posto della barra dei profili: un pulsante con la città attiva che apre
//  l'elenco delle città salvate, divise in "Le tue città" e "Città visitate",
//  ognuna con il cestino (conferma nel menu stesso, testo diverso per tipo),
//  (si importa con la bacchetta verde della testata; 2.0: in fondo al menu
//  anche "Importa da JSON", città ridotta). Il menu è `position: fixed` così
//  non viene tagliato dalla riga delle schede (overflow hidden).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Building2, ChevronDown, Eye, FileJson, Trash2 } from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";
import type { TipoCitta } from "../data/citta";

export interface VoceCitta { id: string; nome: string; tipo: TipoCitta; avatar?: string | null;
  /** 2.0: città "ridotta" importata da un file JSON (sezione a parte nel menu). */
  daJson?: boolean }

/** Mini-avatar del giocatore (16 px) o, se manca, l'icona del tipo di città. */
function Miniatura({ c, size = 16 }: { c: VoceCitta | undefined; size?: number }) {
  if (c?.avatar) return <img src={c.avatar} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-sm object-cover" />;
  const I = c?.tipo === "visitata" ? Eye : Building2;
  return <I size={14} strokeWidth={1.75} className="shrink-0 text-sky-300" aria-hidden="true" />;
}

interface Props {
  citta: VoceCitta[];
  attiva: string;
  onSeleziona: (id: string) => void;
  onElimina: (id: string) => void;
  /** 2.0: aggiunge una città da un file JSON (come Opzioni › Importa da JSON). */
  onImportaJson?: () => void;
  uiLang: UiLang;
  /** Avatar del giocatore della città attiva (mini-foto nel pulsante). */
  avatar?: string | null;
  /** Larghezza massima del pulsante (la testata si stringe). */
  maxW: number;
}

export default function SelettoreCitta({ citta, attiva, onSeleziona, onElimina, onImportaJson, uiLang, maxW, avatar }: Props) {
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const [daEliminare, setDaEliminare] = useState<VoceCitta | null>(null);
  const rifMenu = useRef<HTMLDivElement>(null);
  const rifPulsante = useRef<HTMLButtonElement>(null);
  const corrente = citta.find(c => c.id === attiva);

  useEffect(() => {
    if (!menu) return;
    // Il clic sul pulsante stesso non conta come "fuori": lo gestisce apri()
    // (che chiude il menu se è aperto). Prima il mousedown lo chiudeva e il
    // click subito dopo lo riapriva: il menu sembrava non chiudersi mai.
    const fuori = (e: MouseEvent) => {
      const n = e.target as Node;
      if (rifMenu.current?.contains(n) || rifPulsante.current?.contains(n)) return;
      setMenu(null); setDaEliminare(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(null); setDaEliminare(null); } };
    const tm = setTimeout(() => document.addEventListener("mousedown", fuori));
    document.addEventListener("keydown", esc);
    return () => { clearTimeout(tm); document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const apri = (e: MouseEvent) => {
    if (menu) { setMenu(null); return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ left: Math.max(4, Math.min(r.left, window.innerWidth - 284)), top: r.bottom + 4 });
    setDaEliminare(null);
  };

  const riga = (c: VoceCitta) => {
    return (
      <div key={c.id} className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${c.id === attiva ? "bg-sky-950/70 text-slate-50" : "text-slate-200 hover:bg-slate-800"}`}
        onClick={() => { onSeleziona(c.id); setMenu(null); }}>
        <Miniatura c={c} />
        <span className="min-w-0 flex-1 truncate">{c.nome}</span>
        <button type="button" title={t("r2DeleteCity", uiLang)} aria-label={t("r2DeleteCity", uiLang)}
          onClick={(e) => { e.stopPropagation(); setDaEliminare(c); }}
          className="rounded p-0.5 text-slate-500 hover:bg-red-950/60 hover:text-red-400"><Trash2 size={14} /></button>
      </div>
    );
  };
  const mie = citta.filter(c => c.tipo === "mia" && !c.daJson), visitate = citta.filter(c => c.tipo === "visitata" && !c.daJson);
  const daJson = citta.filter(c => c.daJson);

  return (
    <>
      <button ref={rifPulsante} type="button" onClick={(e) => apri(e as unknown as MouseEvent)} title={corrente?.nome ?? t("r2NoCity", uiLang)}
        style={{ maxWidth: maxW }}
        // Stesso aspetto della scheda selezionata (bordo sopra e ai lati,
        // sfondo del nastro, appoggiata al nastro): la città si legge come
        // "Database" (richiesta utente).
        className="mr-2 flex h-8 shrink-0 items-center gap-1.5 self-end -mb-px overflow-hidden rounded-t-md border border-b-0 border-slate-700 bg-slate-950 px-3 text-slate-50 hover:text-white">
        <Miniatura c={corrente && { ...corrente, avatar: corrente.avatar ?? avatar }} />
        <span className="truncate">{corrente?.nome ?? t("r2NoCity", uiLang)}</span>
        <ChevronDown size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
      </button>
      {menu && (
        <div ref={rifMenu} style={{ left: menu.left, top: menu.top }}
          className="fixed z-[60] w-[280px] rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-[12px] whitespace-normal shadow-xl">
          {daEliminare ? (
            <div className="p-1.5">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-red-400"><AlertTriangle size={14} />{t("r2DeleteAsk", uiLang, daEliminare.nome)}</div>
              <div className="mb-2.5 text-slate-400">{t(daEliminare.tipo === "mia" ? "r2DeleteMine" : "r2DeleteVisited", uiLang)}</div>
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setDaEliminare(null)} className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-200 hover:bg-slate-800">{t("r2Cancel", uiLang)}</button>
                <button type="button" onClick={() => { onElimina(daEliminare.id); setDaEliminare(null); setMenu(null); }}
                  className="rounded-md border border-red-500 bg-red-800 px-2.5 py-1 text-white hover:bg-red-700">{t("r2DeleteCity", uiLang)}</button>
              </div>
            </div>
          ) : (
            <>
              {mie.length > 0 && <div className="px-2 pt-1 pb-0.5 text-[11px] text-slate-500">{t("r2MyCities", uiLang)}</div>}
              {mie.map(riga)}
              {visitate.length > 0 && <div className="px-2 pt-1.5 pb-0.5 text-[11px] text-slate-500">{t("r2VisitedCities", uiLang)}</div>}
              {visitate.map(riga)}
              {daJson.length > 0 && <div className="px-2 pt-1.5 pb-0.5 text-[11px] text-slate-500">{t("r2JsonCities", uiLang)}</div>}
              {daJson.map(riga)}
              {citta.length === 0 && <div className="px-2 py-1.5 text-slate-400">{t("r2NoCitiesYet", uiLang)}</div>}
              {onImportaJson && (
                <button type="button" title={t("r2ImportCityJsonTitle", uiLang)}
                  onClick={() => { setMenu(null); onImportaJson(); }}
                  className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-slate-800 px-2 py-1.5 text-left text-slate-300 hover:bg-slate-800 hover:text-slate-50">
                  <FileJson size={14} strokeWidth={1.75} className="shrink-0 text-sky-300" aria-hidden="true" />
                  {t("r2ImportCityJson", uiLang)}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
