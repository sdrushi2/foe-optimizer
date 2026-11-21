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
//  (21/11/2026, PageSpeed) Come si trova la disposizione: le disposizioni
//  possibili sono una SEQUENZA (da tutti L a tutti I, un gruppo alla volta
//  nell'ordine sopra). Si disegnano tutti i gruppi in L, poi in M, S, C e I e
//  ogni volta si misura la larghezza di ciascuno (5 misure); poi si sceglie a
//  conti fatti la prima disposizione della sequenza che sta. Prima si provava
//  un passo alla volta: fino a 50 misure all'avvio, ognuna con la pagina da
//  reimpaginare. (Una bisezione sulla sequenza non va: chiudere un gruppo in C
//  può allargarlo rispetto a S, quindi la larghezza non scende sempre.)
//  SCHERMO BASSO (21/11/2026, telefono in orizzontale, altezza ≤ 500 px): il
//  nastro alto 98 px con i gruppi chiusi alti 60 px e la riga vuota dei nomi
//  prendeva un terzo dello schermo. Lì i gruppi sono sempre chiusi, in una riga
//  sola alta 40 px: pulsanti alti 28 px con icona e nome affiancati (C) o, se non stanno,
//  solo icona (I).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, X } from "lucide-react";

/** L grande, M medio, S piccolo, C chiuso (icona + nome, apre un pannello),
 *  I chiuso con la sola icona (telefono in verticale: il nome resta nel suggerimento). */
export type ModoGruppo = "L" | "M" | "S" | "C" | "I";

export type RibbonItem =
  | {
      kind: "button";
      id: string;
      icon: LucideIcon;
      /** Icona PNG del gioco al posto di `icon` (es. la strada di "Richiede strada"). */
      img?: string;
      /** `img` nel pulsante grande alla grandezza del file (es. badge_pirates) invece di 24×24. */
      imgReale?: boolean;
      label: string;
      /** Numero dopo il nome, in oro: "Gettoni (70)". */
      badge?: string;
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

/** Il "?" dell'etichetta di un gruppo: spiegazione nel suggerimento al
 *  passaggio del mouse e, con un tocco/clic, in un fumetto (sul telefono il
 *  suggerimento non si vede). Il fumetto è `fixed`, dentro lo schermo; si
 *  chiude toccando fuori, con Esc o scorrendo la pagina. */
function Aiuto({ testo }: { testo?: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const rif = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pos) return;
    const chiudi = (e: Event) => { if (!rif.current?.contains(e.target as Node)) setPos(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const via = () => setPos(null);
    const t = setTimeout(() => document.addEventListener("pointerdown", chiudi));
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", via, true);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", chiudi); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", via, true); };
  }, [pos]);
  if (!testo) return null;
  const apri = () => {
    if (pos) { setPos(null); return; }
    const r = rif.current!.getBoundingClientRect(), L = 260;
    setPos({ left: Math.max(4, Math.min(r.left + r.width / 2 - L / 2, window.innerWidth - L - 4)), top: r.bottom + 6 });
  };
  return (
    <>
      <button ref={rif} type="button" onClick={apri} title={testo} aria-label={testo} aria-expanded={!!pos}
        className="ml-1 inline-flex h-3 w-3 cursor-help items-center justify-center rounded-full border border-slate-600 align-[1px] text-[8px] leading-none font-bold text-slate-400 hover:border-sky-500 hover:text-sky-300">?</button>
      {pos && (
        <span role="tooltip" style={{ left: pos.left, top: pos.top, width: 260 }}
          className="fixed z-[80] rounded-md border border-slate-700 bg-slate-900 px-2.5 py-2 text-left text-[12px] leading-snug whitespace-normal text-slate-200 shadow-xl">{testo}</span>
      )}
    </>
  );
}

const ORDINE: ModoGruppo[] = ["L", "M", "S", "C", "I"];
/** Solo gruppi chiusi (schermo basso). */
const CHIUSI: ModoGruppo[] = ["C", "I"];
/** Schermo basso: telefono in orizzontale. */
const SCHERMO_BASSO = "(max-height: 500px)";

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
      title={it.title ?? (it.badge ? `${it.label} (${it.badge})` : it.label)}
      // (solo icona, modo S: il nome per i lettori di schermo, PageSpeed 21/11/2026)
      aria-label={modo === "S" ? (it.badge ? `${it.label} (${it.badge})` : it.label) : undefined}
      aria-pressed={it.active}
      className={`flex items-center rounded-md border whitespace-nowrap text-[11px] leading-none disabled:cursor-not-allowed disabled:opacity-35 ${stato} ${
        grande ? "h-[60px] min-w-[60px] flex-col justify-center gap-1.5 px-2" : "h-[22px] gap-1.5 px-1.5"
      }`}
    >
      {it.img
        // grandezza originale (24×24) nel pulsante grande; 16 nei compatti, alti 22 px
        ? grande && it.imgReale
          ? <img src={it.img} alt="" className="shrink-0" aria-hidden="true" />
          : <img src={it.img} alt="" width={grande ? 24 : 16} height={grande ? 24 : 16} className="shrink-0" aria-hidden="true" />
        : <Icon size={grande ? 20 : 14} strokeWidth={1.75} className={it.danger ? "text-red-400" : it.success ? "text-emerald-400" : "text-sky-300"} aria-hidden="true" />}
      {modo !== "S" && <span>{it.label}{it.badge && <> (<span className="font-bold text-amber-300">{it.badge}</span>)</>}</span>}
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

/** `aCapo`: nel pannello di un gruppo chiuso i pulsanti vanno a capo invece
 *  di uscire dallo schermo (telefono in verticale). `colonne`: righe di soli
 *  pulsanti più lunghe vanno in una griglia con quelle colonne, righe pari
 *  (8 pulsanti → 4 + 4 invece di 3 + 4 + 1). */
function ContenutoGruppo({ g, modo, aCapo = false, colonne }: { g: RibbonGroup; modo: ModoGruppo; aCapo?: boolean; colonne?: number }) {
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
        if (aCapo && soloPulsanti && colonne && riga.length > colonne) {
          return (
            <div key={i} className="grid justify-center gap-1" style={{ gridTemplateColumns: `repeat(${colonne}, auto)` }}>
              {riga.map((it) => it.kind === "button" && <Pulsante key={it.id} it={it} modo={modo} />)}
            </div>
          );
        }
        return (
          <div key={i} className={`flex items-center gap-1 ${aCapo ? "flex-wrap justify-center" : ""}`}>
            {riga.map((it) => (it.kind === "button" ? <Pulsante key={it.id} it={it} modo={modo} /> : <span key={it.id} className="contents">{it.render(modo)}</span>))}
          </div>
        );
      })}
    </>
  );
}

export default function Ribbon({ groups }: { groups: RibbonGroup[] }) {
  const rifNastro = useRef<HTMLDivElement>(null);
  const [aperto, setAperto] = useState<{ indice: number; left: number; top: number } | null>(null);
  /** Colonne della griglia nel pannello del gruppo aperto (vedi ContenutoGruppo). */
  const [colonne, setColonne] = useState(4);
  const rifPannello = useRef<HTMLDivElement>(null);
  const [larghezza, setLarghezza] = useState(0);
  const firma = groups.map((g) => g.id).join("|");
  const firmaPriorita = groups.map((g) => g.priority ?? 0).join("|");
  /** Schermo basso (telefono in orizzontale): nastro in una riga sola, gruppi sempre chiusi. */
  const [basso, setBasso] = useState(() => typeof matchMedia !== "undefined" && matchMedia(SCHERMO_BASSO).matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia(SCHERMO_BASSO), cambia = () => setBasso(mq.matches);
    mq.addEventListener("change", cambia);
    return () => mq.removeEventListener("change", cambia);
  }, []);
  /** Modi da misurare (e possibili): sullo schermo basso solo i gruppi chiusi. */
  const misurabili: readonly ModoGruppo[] = basso ? CHIUSI : ORDINE;
  /** Disposizioni in ordine di compattazione: tutti L, poi un gruppo alla volta
   *  (priorità bassa prima, a parità da destra) a M, a S, a C; infine tutti I
   *  (solo icone: tutti insieme, così il nastro resta uniforme, niente "Filtri"
   *  con il nome in mezzo alle sole icone). */
  const sequenza = useMemo(() => {
    const n = firma ? firma.split("|").length : 0, pr = firmaPriorita.split("|").map(Number);
    const indici = Array.from({ length: n }, (_, i) => i).sort((a, b) => (pr[a] ?? 0) - (pr[b] ?? 0) || b - a);
    if (basso) return n ? [Array.from({ length: n }, (): ModoGruppo => "C"), Array.from({ length: n }, (): ModoGruppo => "I")] : [[]];
    let cur: ModoGruppo[] = Array.from({ length: n }, () => "L");
    const out: ModoGruppo[][] = [cur];
    for (const livello of ORDINE.slice(1, -1)) for (const i of indici) { cur = [...cur]; cur[i] = livello; out.push(cur); }
    if (n) out.push(cur.map(() => "I"));
    return out;
  }, [firma, firmaPriorita, basso]);
  /** Misura in corso (tutti i gruppi nello stesso modo) oppure disposizione scelta (indice in `sequenza`). */
  const [vista, setVista] = useState<{ tutti: ModoGruppo } | { passo: number }>(() => ({ tutti: misurabili[0]! }));
  const modi: ModoGruppo[] = "tutti" in vista ? groups.map(() => vista.tutti) : (sequenza[Math.min(vista.passo, sequenza.length - 1)] ?? []);
  /** Larghezze misurate dei gruppi per modo. */
  const misure = useRef<Partial<Record<ModoGruppo, number[]>>>({});
  /** Larghezza e gruppi su cui è stata scelta la disposizione attuale. */
  const scelta = useRef<{ w: number; firma: string; basso: boolean } | null>(null);
  /** Tutti i gruppi chiusi con la sola icona (telefono in verticale): nastro più basso, senza la riga dei nomi. */
  const tuttiIcona = modi.length > 0 && modi.every((m) => m === "I");

  // si rimisura quando cambiano larghezza o gruppi (non alla prima notifica
  // del ResizeObserver: la larghezza è quella su cui si è appena scelto)
  useLayoutEffect(() => {
    const c = scelta.current;
    if (c && c.firma === firma && c.basso === basso && (larghezza === 0 || larghezza === c.w)) return;
    scelta.current = null;
    misure.current = {};
    setVista({ tutti: misurabili[0]! });
    setAperto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [larghezza, firma, basso]);

  // misura i gruppi in ogni modo, poi sceglie la prima disposizione che sta
  useLayoutEffect(() => {
    const el = rifNastro.current;
    if (!el || modi.length !== groups.length || !groups.length) return;
    if ("tutti" in vista) {
      misure.current[vista.tutti] = [...el.children].map(c => c.getBoundingClientRect().width);
      const dopo = misurabili[misurabili.indexOf(vista.tutti) + 1];
      if (dopo) { setVista({ tutti: dopo }); return; }
      const st = getComputedStyle(el);
      const spazio = el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight) + 1;
      const m = misure.current;
      let passo = sequenza.findIndex(d => d.reduce((t, modo, k) => t + (m[modo]?.[k] ?? Infinity), 0) <= spazio);
      if (passo < 0) passo = sequenza.length - 1;
      scelta.current = { w: el.clientWidth, firma, basso };
      setVista({ passo });
      return;
    }
    // non sta (contenuto cresciuto, o un calcolo appena sbagliato di un pixel):
    // si compatta ancora, un passo alla volta
    if (el.scrollWidth <= el.clientWidth + 1 || vista.passo >= sequenza.length - 1) return;
    setVista({ passo: vista.passo + 1 });
  }, [vista, groups, sequenza, modi.length, firma, basso, misurabili]);

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
  // (21/11/2026) la larghezza si misura con il pannello a sinistra: aperto più a
  // destra si stringeva al posto che restava fino al bordo e i pulsanti andavano
  // su tre righe; se le colonne della griglia non stanno se ne toglie una
  useLayoutEffect(() => {
    const p = rifPannello.current, contenitore = p?.parentElement;
    if (!p || !aperto || !contenitore) return;
    const W = contenitore.clientWidth, margine = 4;
    p.style.left = "0px";
    if (p.scrollWidth > p.clientWidth + 1 && colonne > 1) { setColonne(colonne - 1); return; }
    p.style.left = `${Math.max(margine, Math.min(aperto.left, W - p.offsetWidth - margine))}px`;
  }, [aperto, colonne]);

  const apri = (i: number, e: MouseEvent) => {
    const btn = e.currentTarget as HTMLElement, base = rifNastro.current!.getBoundingClientRect(), r = btn.getBoundingClientRect();
    // righe pari: 8 pulsanti → 4 colonne, 6 → 3, 5 → 3 (poi meno se non stanno)
    const n = Math.max(0, ...groups[i]!.rows.map(rg => rg.length));
    setColonne(n <= 4 ? 4 : Math.ceil(n / Math.ceil(n / 4)));
    setAperto(aperto?.indice === i ? null : { indice: i, left: r.left - base.left, top: r.bottom - base.top + 4 });
  };

  return (
    <div className="relative">
      {/* overflow-x-auto: quando anche tutti i gruppi chiusi non stanno (telefono) il nastro scorre in orizzontale invece di tagliarsi */}
      <div ref={rifNastro} className={`flex ${basso ? "h-[40px] items-center gap-1.5 py-1" : tuttiIcona ? "h-[56px] items-stretch justify-around pt-1.5 pb-1" : "h-[98px] items-stretch pt-1.5 pb-1"} overflow-x-auto overflow-y-hidden [scrollbar-width:thin] border-b border-slate-700 bg-slate-950 px-1 text-[11px]`}>
        {groups.map((g, i) => {
          const modo = modi[i] ?? "L";
          const Icon = g.icon;
          if (basso) return (
            // schermo basso: solo il pulsante del gruppo chiuso, icona e nome affiancati
            <div key={g.id} className="flex flex-none items-center">
              <button type="button" data-apre-gruppo="" aria-expanded={aperto?.indice === i} onClick={(e) => apri(i, e as unknown as MouseEvent)}
                title={modo === "I" ? g.label : undefined} aria-label={g.label}
                className={`flex h-[28px] items-center gap-1.5 rounded-md border border-slate-700 leading-none whitespace-nowrap text-[12px] text-slate-300 hover:bg-slate-800 hover:text-slate-100 ${modo === "I" ? "px-[5px]" : "px-[7px]"}`}>
                <Icon size={16} strokeWidth={1.75} className="text-sky-300" aria-hidden="true" />
                {modo !== "I" && g.label}
                <ChevronDown size={11} aria-hidden="true" />
              </button>
            </div>
          );
          return (
            // Gruppo: area comandi ad altezza fissa (contenuto centrato in
            // verticale) + etichetta in basso, così tutte le etichette stanno
            // sulla stessa riga qualunque sia il contenuto.
            <div key={g.id} className={`flex flex-none flex-col items-center ${tuttiIcona ? "px-0.5" : "border-r border-slate-800 px-2 last:border-r-0"}`}>
              <div className={`flex ${tuttiIcona ? "h-[46px]" : "h-[72px]"} shrink-0 flex-col items-center justify-center gap-[3px]`}>
                {modo === "C" || modo === "I" ? (
                  <button type="button" data-apre-gruppo="" aria-expanded={aperto?.indice === i} onClick={(e) => apri(i, e as unknown as MouseEvent)}
                    title={modo === "I" ? g.label : undefined} aria-label={g.label}
                    className={`flex flex-col items-center justify-center rounded-md border border-slate-700 leading-none whitespace-nowrap text-slate-300 hover:bg-slate-800 hover:text-slate-100 ${
                      modo === "I" ? "h-[44px] min-w-[44px] gap-0.5 px-1.5" : "h-[60px] min-w-[60px] gap-1.5 px-2"}`}>
                    <Icon size={20} strokeWidth={1.75} className="text-sky-300" aria-hidden="true" />
                    {modo === "I"
                      ? <ChevronDown size={11} aria-hidden="true" />
                      : <span className="flex items-center gap-0.5">{g.label}<ChevronDown size={11} aria-hidden="true" /></span>}
                  </button>
                ) : (
                  <ContenutoGruppo g={g} modo={modo} />
                )}
              </div>
              <div className={`${tuttiIcona ? "hidden" : "h-4"} shrink-0 leading-4 whitespace-nowrap text-slate-500`}>{modo === "C" || modo === "I" ? " " : <>{g.label}<Aiuto testo={g.help} /></>}</div>
            </div>
          );
        })}
      </div>
      {aperto && groups[aperto.indice] && (
        <div ref={rifPannello} style={{ left: Math.max(0, aperto.left), top: aperto.top }}
          className="absolute z-50 flex max-w-[calc(100%-8px)] flex-col items-stretch gap-1 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
          {/* (items-stretch, non items-center: un contenuto centrato più largo del
              pannello usciva anche a SINISTRA, dove lo scorrimento non arriva) */}
          <ContenutoGruppo g={groups[aperto.indice]!} modo="L" aCapo colonne={colonne} />
          <div className="text-center text-[11px] text-slate-500">{groups[aperto.indice]!.label}<Aiuto testo={groups[aperto.indice]!.help} /></div>
        </div>
      )}
    </div>
  );
}
