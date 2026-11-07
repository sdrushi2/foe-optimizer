// ─────────────────────────────────────────────────────────────────────────────
//  ui/FiltriEdifici.tsx — Gruppo "Filtri" del nastro per le tabelle edifici
//  (FoE Optimizer 2.0: Database; poi Città e Inventario)
//
//  Solo i comandi che RIDUCONO la lista degli edifici:
//   - colonna sinistra: evento, produzione (menu con le 22 produzioni e
//     And/Or), efficienza minima, azzera;
//   - a destra le caselle di categoria, combinate in OR (decisione utente):
//     spuntando Premi campi + Premi IQ si vedono tutti i premi;
//   - in fondo le eventuali caselle della scheda (`extra`, es. Città: Da
//     aggiornare, Declassabili), in AND con il resto.
//  I menu sono `position: fixed`: il nastro ha overflow hidden.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";

/** Caselle di categoria (OR tra quelle spuntate; nessuna = tutti). */
/** (2.0: "Slot alleato", "Utili per IQ" e "Producono frammenti" sono nel gruppo Nascondi / Mostra solo.) */
export type Categoria = "insediamenti" | "premi_campi" | "premi_iq";

const CATEGORIE: Array<{ id: Categoria; chiave: Parameters<typeof t>[0] }> = [
  { id: "insediamenti", chiave: "r2CatSettlements" },
  { id: "premi_campi", chiave: "r2CatGbg" },
  { id: "premi_iq", chiave: "r2CatQi" },
];

export interface OpzioneProduzione { key: string; icon: ReactNode; title: string }
interface VoceEvento { id: string; nome: string; gruppo: boolean }

export interface StatoFiltri {
  uiLang: UiLang;
  eventi: VoceEvento[];
  evento: string;
  setEvento: (id: string) => void;
  produzioni: OpzioneProduzione[];
  /** Produzioni "sì" (verde) e "no" (rosso): un clic sì, due no, tre niente. */
  prodSel: ReadonlySet<string>;
  prodNo: ReadonlySet<string>;
  /** Pulsante ALL: tutte le produzioni verdi ("si"), rosse ("no") o nessun filtro (null). */
  tuttiProd: (stato: "si" | "no" | null) => void;
  toggleProd: (key: string) => void;
  azzeraProd: () => void;
  prodModo: "AND" | "OR";
  setProdModo: (m: "AND" | "OR") => void;
  effMin: string;
  setEffMin: (v: string) => void;
  categorie: ReadonlySet<Categoria>;
  toggleCategoria: (c: Categoria) => void;
  azzera: () => void;
  /** Caselle in più della scheda (es. Città: Da aggiornare, Declassabili):
   *  filtri a sé, in AND con il resto, in una colonna separata. */
  extra?: Array<{ id: string; label: string; title?: string; checked: boolean; toggle: () => void; disabled?: boolean }>;
  /** Inventario: era degli edifici posseduti (null = tutte), tra quelle presenti. */
  era?: { valore: number | null; opzioni: Array<{ id: number; nome: string }>; imposta: (id: number | null) => void };
  /** Inventario: edifici posseduti che producono beni di quest'era (null = tutti). */
  beniEra?: { valore: number | null; opzioni: Array<{ id: number; nome: string }>; imposta: (id: number | null) => void };
}

/** Rientro degli eventi sotto l'anno nel menu (spazi non separabili). */
const RIENTRO = String.fromCharCode(160).repeat(3);

/** Filtro attivo (evento, produzione, eff. min): evidenziato in verde, così
 *  si vede subito che la lista è filtrata. */
const ATTIVO = "!border-emerald-500 !bg-emerald-950/70 !text-emerald-200";

/** Casella di spunta dei filtri: stesso disegno di quelle della tabella
 *  edifici (quadratino con angoli arrotondati, vuoto su sfondo scuro), ma
 *  verde quando è spuntata, come gli altri filtri attivi. */
function Casella({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="peer sr-only" />
      <span aria-hidden="true" className={`relative block h-3 w-3 shrink-0 rounded-[4px] border ${checked
        ? "border-emerald-500 bg-emerald-500"
        : "border-slate-600 bg-slate-950 peer-hover:border-slate-400"} peer-focus-visible:ring-1 peer-focus-visible:ring-emerald-400`}>
        {checked && <Check size={9} strokeWidth={3} className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-950" />}
      </span>
    </>
  );
}

const campo = "h-[22px] rounded-md border border-slate-700 bg-slate-900 px-1.5 text-[11px] text-slate-100 outline-none hover:border-slate-600 focus:border-sky-500";

function MenuProduzione({ s }: { s: StatoFiltri }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const rif = useRef<HTMLDivElement>(null);
  const rifPulsante = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pos) return;
    // il clic sul pulsante Produzione lo gestisce il pulsante stesso (apre/chiude):
    // chiudere qui al mousedown lo farebbe riaprire subito dopo al click
    const fuori = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!rif.current?.contains(n) && !rifPulsante.current?.contains(n)) setPos(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const tm = setTimeout(() => document.addEventListener("mousedown", fuori));
    document.addEventListener("keydown", esc);
    return () => { clearTimeout(tm); document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [pos]);
  const n = s.prodSel.size, nNo = s.prodNo.size;
  // "Produzione (2 · 2 · or)": filtri verdi e rossi in grassetto col loro
  // colore, poi il modo (or / and) se i filtri sono più d'uno
  const modo = s.prodModo.toLowerCase();
  const numeri = [n ? <b key="v" className="text-emerald-400">{n}</b> : null, nNo ? <b key="r" className="text-red-400">{nNo}</b> : null].filter(Boolean);
  const etichetta = numeri.length ? <>{numeri.length === 2 ? <>{numeri[0]} · {numeri[1]}</> : numeri[0]}{n + nNo > 1 ? ` · ${modo}` : ""}</> : null;
  return (
    <>
      <button ref={rifPulsante} type="button" title={t("r2ProdFilterTitle", s.uiLang)} aria-expanded={!!pos}
        onClick={(e) => {
          if (pos) { setPos(null); return; }
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ left: Math.max(4, Math.min(r.left, window.innerWidth - 340)), top: r.bottom + 4 });
        }}
        className={`${campo} flex w-full items-center justify-between gap-1 ${n || nNo ? ATTIVO : ""}`}>
        <span className="truncate whitespace-nowrap">{t("r2Production", s.uiLang)}{etichetta && <> ({etichetta})</>}</span>
        <ChevronDown size={12} className="shrink-0" aria-hidden="true" />
      </button>
      {pos && (
        <div ref={rif} style={{ left: pos.left, top: pos.top }}
          className="fixed z-[60] w-[336px] rounded-lg border border-slate-700 bg-slate-900 p-2 text-[11px] whitespace-normal shadow-xl">
          <div className="grid grid-cols-8 gap-1">
            {s.produzioni.map(({ key, icon, title }) => {
              const si = s.prodSel.has(key), no = s.prodNo.has(key);
              // (stessi colori di "Nascondi / Mostra solo": verde = la produce, rosso = non la produce)
              return (
                <button key={key} type="button" aria-pressed={si || no} onClick={() => s.toggleProd(key)}
                  title={`${title}\n${t(si ? "r2ProdStateYes" : no ? "r2ProdStateNo" : "r2ProdStateOff", s.uiLang)}`}
                  className={`flex h-9 w-9 items-center justify-center rounded border text-lg [&_img]:!h-6 [&_img]:!w-6 ${si
                    ? "border-emerald-500/70 bg-emerald-950/60 text-emerald-100"
                    : no ? "border-red-500/70 bg-red-950/60 text-red-100 [&_img]:opacity-60"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                  {icon}
                </button>
              );
            })}
            {(() => {
              // ALL: stessi tre stati per tutte insieme (verde → rosso → niente)
              const tot = s.produzioni.length;
              const si = tot > 0 && n === tot, no = tot > 0 && nNo === tot;
              return (
                <button type="button" aria-pressed={si || no} onClick={() => s.tuttiProd(si ? "no" : no ? null : "si")}
                  title={`${t("r2ProdAll", s.uiLang)}\n${t(si ? "r2ProdStateYes" : no ? "r2ProdStateNo" : "r2ProdStateOff", s.uiLang)}`}
                  className={`flex h-9 w-9 items-center justify-center rounded border text-[11px] font-black tracking-wide ${si
                    ? "border-emerald-500/70 bg-emerald-950/60 text-emerald-100"
                    : no ? "border-red-500/70 bg-red-950/60 text-red-100"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                  ALL
                </button>
              );
            })()}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="inline-flex overflow-hidden rounded-md border border-slate-700" role="group" title={t("r2ProdModeTitle", s.uiLang)}>
              {(["OR", "AND"] as const).map(m => (
                <button key={m} type="button" aria-pressed={s.prodModo === m} onClick={() => s.setProdModo(m)}
                  className={`px-2 py-0.5 font-bold ${s.prodModo === m ? "bg-emerald-500/25 text-emerald-200" : "text-slate-400 hover:bg-slate-800"}`}>
                  {m === "OR" ? t("r2ProdOr", s.uiLang) : t("r2ProdAnd", s.uiLang)}
                </button>
              ))}
            </span>
            {/* (attivo con almeno un filtro, verde o rosso: ben visibile, prima sembrava spento) */}
            <button type="button" onClick={s.azzeraProd} disabled={!n && !nNo}
              className="rounded-md border border-slate-500 px-2 py-0.5 font-bold text-slate-100 hover:bg-slate-800 disabled:border-slate-700 disabled:font-normal disabled:text-slate-300 disabled:opacity-35">
              {t("r2ProdNone", s.uiLang)}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Contenuto del gruppo Filtri (uguale in tutti i modi del nastro: quando non
 *  c'è spazio il nastro lo chiude in un pannello). */
export function BloccoFiltri({ s }: { s: StatoFiltri }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex w-[150px] flex-col gap-[3px]">
        <select value={s.evento} onChange={(e) => s.setEvento(e.currentTarget.value)} title={t("eventFilterTitle", s.uiLang)}
          className={`${campo} ${s.evento ? ATTIVO : ""}`}>
          {/* le opzioni ereditano lo sfondo del menu: verde solo il menu chiuso, la lista resta normale */}
          <option value="" className="bg-slate-900 text-slate-100">{t("r2AllEvents", s.uiLang)}</option>
          {s.eventi.map(ev => (
            <option key={ev.id} value={ev.id} className={`bg-slate-900 ${ev.gruppo ? "text-slate-400" : "text-slate-100"}`}>{ev.gruppo ? `— ${ev.nome} —` : `${RIENTRO}${ev.nome}`}</option>
          ))}
        </select>
        <MenuProduzione s={s} />
        {/* Eff. min + Azzera: il campo prende lo spazio che resta, così Azzera
            finisce esattamente sul bordo destro dei menu sopra. */}
        <div className="flex w-full items-center gap-1">
          <label className="flex min-w-0 flex-1 items-center gap-1 text-[11px] whitespace-nowrap text-slate-400" title={t("minEffInputLabel", s.uiLang)}>
            {t("r2EffMin", s.uiLang)}
            <input type="text" inputMode="decimal" value={s.effMin} onInput={(e) => s.setEffMin(e.currentTarget.value)}
              className={`${campo} w-0 min-w-0 flex-1 px-0.5 text-center font-mono ${s.effMin ? ATTIVO : ""}`} />
          </label>
          <button type="button" onClick={s.azzera} title={t("resetFiltersTitle", s.uiLang)}
            className="flex h-[22px] shrink-0 items-center gap-1 rounded-md border border-slate-700 px-1.5 text-[11px] text-slate-300 hover:border-red-500/60 hover:bg-red-950/40 hover:text-red-200">
            <RotateCcw size={11} aria-hidden="true" />{t("r2Reset", s.uiLang)}
          </button>
        </div>
      </div>
      <div className="grid grid-flow-col grid-rows-3 gap-x-3 gap-y-[3px]">
        {CATEGORIE.map(({ id, chiave }) => (
          <label key={id} className="flex h-[22px] cursor-pointer items-center gap-1.5 text-[11px] whitespace-nowrap text-slate-200 hover:text-slate-50">
            <Casella checked={s.categorie.has(id)} onChange={() => s.toggleCategoria(id)} />
            {t(chiave, s.uiLang)}
          </label>
        ))}
      </div>
      {s.extra && s.extra.length > 0 && (
        <div className="flex flex-col gap-[3px] border-l border-slate-800 pl-2">
          {s.extra.map(x => (
            <label key={x.id} title={x.title} className={`flex h-[22px] items-center gap-1.5 text-[11px] whitespace-nowrap ${x.disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"} text-slate-200 hover:text-slate-50`}>
              <Casella checked={x.checked} disabled={x.disabled} onChange={x.toggle} />
              {x.label}
            </label>
          ))}
          {s.era && (
            <select value={s.era.valore ?? ""} onChange={(e) => s.era!.imposta(e.currentTarget.value === "" ? null : Number(e.currentTarget.value))}
              title={t("r2EraInvTitle", s.uiLang)} disabled={!s.era.opzioni.length}
              className={`${campo} w-[150px] ${s.era.valore !== null ? ATTIVO : ""} disabled:opacity-35`}>
              <option value="" className="bg-slate-900 text-slate-100">{t("r2EraInvAll", s.uiLang)}</option>
              {s.era.opzioni.map(o => <option key={o.id} value={o.id} className="bg-slate-900 text-slate-100">{o.nome}</option>)}
            </select>
          )}
          {s.beniEra && (
            <select value={s.beniEra.valore ?? ""} onChange={(e) => s.beniEra!.imposta(e.currentTarget.value === "" ? null : Number(e.currentTarget.value))}
              title={t("r2BeniEraInvTitle", s.uiLang)} disabled={!s.beniEra.opzioni.length}
              className={`${campo} w-[150px] ${s.beniEra.valore !== null ? ATTIVO : ""} disabled:opacity-35`}>
              <option value="" className="bg-slate-900 text-slate-100">{t("r2BeniEraInvAll", s.uiLang)}</option>
              {s.beniEra.opzioni.map(o => <option key={o.id} value={o.id} className="bg-slate-900 text-slate-100">{t("r2BeniEraInvVoce", s.uiLang, o.nome)}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
