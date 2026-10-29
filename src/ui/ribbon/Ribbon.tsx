// ─────────────────────────────────────────────────────────────────────────────
//  ui/ribbon/Ribbon.tsx — Nastro dei comandi in stile Office (FoE Optimizer 2.0)
//
//  Un nastro è una fila di GRUPPI (etichetta in basso, separatore a destra).
//  Ogni gruppo ha una o più righe di elementi: pulsanti (icona + testo) o
//  contenuti liberi (ricerca, menu, caselle di spunta…).
//
//  ADATTIVO, SENZA BARRE DI SCORRIMENTO (come Office): se il nastro non sta
//  nella larghezza disponibile, i gruppi si compattano uno alla volta, a
//  partire da quelli con priorità più bassa (a parità, da destra):
//    L  pulsanti grandi (icona sopra, testo sotto)
//    M  pulsanti piccoli (icona e testo affiancati, su tre righe)
//    S  solo icone (il nome nel suggerimento al passaggio del mouse)
//    C  gruppo chiuso: un pulsante con icona e nome che apre il gruppo
//       completo in un pannello.
//  Ricalcolo a ogni cambio di larghezza (ResizeObserver) o di contenuto.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, X } from "lucide-react";

export type ModoGruppo = "L" | "M" | "S" | "C";

export type RibbonItem =
  | {
      kind: "button";
      id: string;
      icon: LucideIcon;
      /** Icona PNG del gioco al posto di `icon` (es. la strada di "Richiede strada"). */
      img?: string;
      label: string;
      onClick?: () => void;
      /** Pulsante "acceso" (interruttore o scelta attiva). */
      active?: boolean;
      disabled?: boolean;
      /** Pulsante che toglie/nasconde: icona rossa, acceso in rosso. */
      danger?: boolean;
      /** Acceso in verde (es. "Mostra solo" del gruppo Nascondi / Mostra solo). */
      success?: boolean;
      title?: string;
      /** Piccola X nell'angolo in alto a destra (es. chiudere il JSON del Planner). */
      onClose?: () => void;
      closeTitle?: string;
    }
  | {
      kind: "custom";
      id: string;
      /** Contenuto libero; `modo` permette una versione più compatta (es. ricerca come sola icona in S). */
      render: (modo: ModoGruppo) => ReactNode;
    };

export interface RibbonGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  rows: RibbonItem[][];
  /** Spiegazione facoltativa: un "?" accanto all'etichetta, col testo nel suggerimento. */
  help?: string;
  /** Più è alta, più a lungo il gruppo resta grande (predefinita 0). */
  priority?: number;
}

/** Il "?" dell'etichetta di un gruppo: spiegazione nel suggerimento al passaggio del mouse. */
function Aiuto({ testo }: { testo?: string }) {
  if (!testo) return null;
  return (
    <span title={testo} aria-label={testo} role="img"
      className="ml-1 inline-flex h-3 w-3 cursor-help items-center justify-center rounded-full border border-slate-600 align-[1px] text-[8px] leading-none font-bold text-slate-400 hover:border-sky-500 hover:text-sky-300">?</span>
  );
}

const ORDINE: ModoGruppo[] = ["L", "M", "S", "C"];

function Pulsante({ it, modo }: { it: Extract<RibbonItem, { kind: "button" }>; modo: ModoGruppo }) {
  const Icon = it.icon;
  const grande = modo === "L";
  // Stessa forma per tutti i pulsanti (acceso o spento cambia solo il colore):
  // il nastro resta omogeneo anche con molti interruttori accesi.
  const stato = it.active
    ? it.danger
      ? "border-red-500/70 bg-red-950/60 text-red-100"
      : it.success
        ? "border-emerald-500/70 bg-emerald-950/60 text-emerald-100"
        : "border-sky-500/70 bg-sky-950/70 text-slate-50"
    : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/70 hover:text-slate-100";
  const pulsante = (
    <button
      type="button"
      disabled={it.disabled}
      onClick={it.onClick}
      title={it.title ?? it.label}
      aria-pressed={it.active}
      className={`flex items-center rounded-md border whitespace-nowrap text-[11px] leading-none disabled:cursor-not-allowed disabled:opacity-35 ${stato} ${
        grande ? "h-[60px] min-w-[60px] flex-col justify-center gap-1.5 px-2" : "h-[22px] gap-1.5 px-1.5"
      }`}
    >
      {it.img
        // grandezza originale (24×24) nel pulsante grande; 16 nei compatti, alti 22 px
        ? <img src={it.img} alt="" width={grande ? 24 : 16} height={grande ? 24 : 16} className="shrink-0" aria-hidden="true" />
        : <Icon size={grande ? 20 : 14} strokeWidth={1.75} className={it.danger ? "text-red-400" : it.success ? "text-emerald-400" : "text-sky-300"} aria-hidden="true" />}
      {modo !== "S" && <span>{it.label}</span>}
    </button>
  );
  if (!it.onClose) return pulsante;
  // La X sta FUORI dal pulsante (niente pulsante dentro un pulsante), sopra il suo angolo.
  return (
    <span className="relative inline-flex">
      {pulsante}
      <button type="button" onClick={it.onClose} title={it.closeTitle} aria-label={it.closeTitle}
        className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-400 hover:border-red-500/70 hover:bg-red-950 hover:text-red-200">
        <X size={10} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </span>
  );
}

function ContenutoGruppo({ g, modo }: { g: RibbonGroup; modo: ModoGruppo }) {
  return (
    <>
      {g.rows.map((riga, i) => {
        const soloPulsanti = riga.every((it) => it.kind === "button");
        // in M/S i pulsanti vanno in colonne da tre righe (come Office)
        if (soloPulsanti && modo !== "L") {
          return (
            <div key={i} className="grid grid-flow-col grid-rows-3 gap-x-1 gap-y-[3px]">
              {riga.map((it) => it.kind === "button" && <Pulsante key={it.id} it={it} modo={modo} />)}
            </div>
          );
        }
        return (
          <div key={i} className="flex items-center gap-1">
            {riga.map((it) => (it.kind === "button" ? <Pulsante key={it.id} it={it} modo={modo} /> : <span key={it.id} className="contents">{it.render(modo)}</span>))}
          </div>
        );
      })}
    </>
  );
}

export default function Ribbon({ groups }: { groups: RibbonGroup[] }) {
  const rifNastro = useRef<HTMLDivElement>(null);
  const [modi, setModi] = useState<ModoGruppo[]>(() => groups.map(() => "L"));
  const [aperto, setAperto] = useState<{ indice: number; left: number; top: number } | null>(null);
  const rifPannello = useRef<HTMLDivElement>(null);
  const [larghezza, setLarghezza] = useState(0);
  const firma = groups.map((g) => g.id).join("|");

  // ricomincia da tutti grandi quando cambiano larghezza o gruppi
  useLayoutEffect(() => {
    setModi(groups.map(() => "L"));
    setAperto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [larghezza, firma]);

  // compatta un passo alla volta finché il nastro non sta nella larghezza
  useLayoutEffect(() => {
    const el = rifNastro.current;
    if (!el || modi.length !== groups.length || el.scrollWidth <= el.clientWidth + 1) return;
    // ordine di compattazione: priorità bassa prima, a parità da destra
    const indici = groups.map((_, i) => i).sort((a, b) => (groups[a]!.priority ?? 0) - (groups[b]!.priority ?? 0) || b - a);
    for (const livello of ORDINE.slice(1)) {
      for (const i of indici) {
        const corrente = modi[i]!;
        if (ORDINE.indexOf(corrente) >= ORDINE.indexOf(livello)) continue;
        const nuovi = [...modi];
        nuovi[i] = livello;
        setModi(nuovi);
        return;
      }
    }
  }, [modi, groups]);

  useEffect(() => {
    const el = rifNastro.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLarghezza(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // pannello del gruppo chiuso: si chiude cliccando fuori o con Esc
  useEffect(() => {
    if (!aperto) return;
    // i pulsanti dei gruppi chiusi gestiscono da soli il clic (apri/chiudi/cambia
    // gruppo): chiudere qui al mousedown farebbe riaprire il pannello al click
    const fuori = (e: MouseEvent) => {
      const el = e.target as Element;
      if (!rifPannello.current?.contains(el) && !el.closest?.("[data-apre-gruppo]")) setAperto(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAperto(null); };
    const t = setTimeout(() => document.addEventListener("mousedown", fuori));
    document.addEventListener("keydown", esc);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [aperto]);

  // il pannello non deve uscire dallo schermo (telefono): se sborda a destra
  // si sposta a sinistra quanto serve; più largo dello schermo → scorre dentro
  useLayoutEffect(() => {
    const p = rifPannello.current, contenitore = p?.parentElement;
    if (!p || !aperto || !contenitore) return;
    const W = contenitore.clientWidth, margine = 4;
    p.style.left = `${Math.max(margine, Math.min(aperto.left, W - p.offsetWidth - margine))}px`;
  }, [aperto]);

  const apri = (i: number, e: MouseEvent) => {
    const btn = e.currentTarget as HTMLElement, base = rifNastro.current!.getBoundingClientRect(), r = btn.getBoundingClientRect();
    setAperto(aperto?.indice === i ? null : { indice: i, left: r.left - base.left, top: r.bottom - base.top + 4 });
  };

  return (
    <div className="relative">
      {/* overflow-x-auto: quando anche tutti i gruppi chiusi non stanno (telefono) il nastro scorre in orizzontale invece di tagliarsi */}
      <div ref={rifNastro} className="flex h-[98px] items-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:thin] border-b border-slate-700 bg-slate-950 px-1 pt-1.5 pb-1 text-[11px]">
        {groups.map((g, i) => {
          const modo = modi[i] ?? "L";
          const Icon = g.icon;
          return (
            // Gruppo: area comandi ad altezza fissa (contenuto centrato in
            // verticale) + etichetta in basso, così tutte le etichette stanno
            // sulla stessa riga qualunque sia il contenuto.
            <div key={g.id} className="flex flex-none flex-col items-center border-r border-slate-800 px-2 last:border-r-0">
              <div className="flex h-[72px] shrink-0 flex-col items-center justify-center gap-[3px]">
                {modo === "C" ? (
                  <button type="button" data-apre-gruppo="" aria-expanded={aperto?.indice === i} onClick={(e) => apri(i, e as unknown as MouseEvent)}
                    className="flex h-[60px] min-w-[60px] flex-col items-center justify-center gap-1.5 rounded-md border border-slate-700 px-2 leading-none whitespace-nowrap text-slate-300 hover:bg-slate-800 hover:text-slate-100">
                    <Icon size={20} strokeWidth={1.75} className="text-sky-300" aria-hidden="true" />
                    <span className="flex items-center gap-0.5">{g.label}<ChevronDown size={11} aria-hidden="true" /></span>
                  </button>
                ) : (
                  <ContenutoGruppo g={g} modo={modo} />
                )}
              </div>
              <div className="h-4 shrink-0 leading-4 whitespace-nowrap text-slate-500">{modo === "C" ? " " : <>{g.label}<Aiuto testo={g.help} /></>}</div>
            </div>
          );
        })}
      </div>
      {aperto && groups[aperto.indice] && (
        <div ref={rifPannello} style={{ left: Math.max(0, aperto.left), top: aperto.top }}
          className="absolute z-50 flex max-w-[calc(100%-8px)] flex-col items-center gap-1 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
          <ContenutoGruppo g={groups[aperto.indice]!} modo="L" />
          <div className="text-[11px] text-slate-500">{groups[aperto.indice]!.label}<Aiuto testo={groups[aperto.indice]!.help} /></div>
        </div>
      )}
    </div>
  );
}
