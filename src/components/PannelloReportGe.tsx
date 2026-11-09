// ─────────────────────────────────────────────────────────────────────────────
//  PannelloReportGe — Report di un Grande Edificio (Catalogo › Grandi Edifici,
//  novembre 2026). Si apre dal pulsante 📊 accanto al nome del GE.
//  - intervallo di livelli ("dal livello A al B" = hai il GE ad A e lo porti
//    a B: si pagano i livelli A+1…B) con pulsanti rapidi;
//  - riepilogo (PF per salire, a carico tuo con la chat, dai mecenati);
//  - costo di sblocco dei livelli A+1…B (set di progetti, monete, materiali,
//    medaglie, beni: datiGioco.caricaSblocchiGe, RECUPERO DATI/sblocchi_ge.py);
//  - cosa guadagni da A a B (PF tuoi per ogni +1 del bonus);
//  - come crescono i bonus (un grafico per bonus) e quanto costa livellare;
//  - tappe; ogni grafico si apre a schermo intero (⛶, Esc per chiudere).
//  Dati: datiGioco.caricaLivelliGe (un file per GE, scaricato solo qui);
//  calcoli: data/reportGe.ts. Stesso aspetto dell'anteprima approvata.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { iconBeni, iconBP, iconBPOro, iconKitInvecchiatore, iconKitInversione, iconMat, iconMed, iconMon } from "../assets/icons";
import { caricaLivelliGe, caricaSblocchiGe, type SblocchiGe } from "../data/datiGioco";
import { preparaReport, type Report } from "../data/reportGe";
import type { UiLang } from "../data/ui-strings";
import { formatInt } from "../utils/format";
import { ageName } from "../data/ages";
import type { Lang } from "../data/languages";

const TESTI = {
  it: {
    eraIndietro: "era indietro", ereIndietro: "ere indietro", tuaEra: "la tua era",
    kitInvecchiatore: "Kit Invecchiatore", kitInversione: "Kit di Inversione",
    inMagazzino: (k: string) => `${k} in magazzino:`,
    ereIndietroT: "Ere fra quella del GE e la tua: per sbloccare i livelli servono i beni dell'era del GE (filtro Inventario › Beni dell'era)",
    prossimi10T: "I prossimi 10 livelli del tuo GE", tutteEre: "Tutte le ere", carico: "Carico i dati del GE…", errore: "Non riesco a scaricare i dati di questo GE.", chiudi: "Chiudi", chiudiEsc: "Chiudi (Esc)",
    dal: "Dal livello", al: "al livello", tutti: "Tutti", intervalloT: "Hai il GE al primo livello e lo porti al secondo: si pagano i livelli in mezzo",
    pfSalire: "PF per salire", tuoi: "A carico tuo (chat)", mecenati: "Dai mecenati", maxDal: "Bonus al massimo dal liv.",
    chatT: "Con la chat Rame 100% sui livelli Rame (e sul 101, che si fa ancora a tariffa Rame) e Oro 20% dal 102, come il Calcolatore GE",
    guadagni: (a: number, b: number) => `Cosa guadagni da ${a} a ${b}`, bonus: "Bonus", liv: "Liv.", guadagno: "Guadagno", perUno: "PF tuoi per +1",
    crescita: "Come crescono i bonus", maxAl: (v: string, l: number) => `max ${v} al liv. ${l}`, tierOro: "tier Oro",
    inattivo: (a: number, b: number, oro: boolean) => `Non attivo fra i livelli ${a} e ${b}${oro ? " (si sblocca dal 101)" : ""}`,
    costi: "Quanto costa livellare", costiTit: "PF del livello e quota tua con la chat", log: "scala logaritmica",
    pfLivello: "PF del livello", tuoiLeg: "tuoi (Rame 100% / Oro 20%)", tappe: "Tappe", tuoiCum: "Tuoi cumulati", tuoiCol: "Tuoi (chat)",
    livello: "Livello", schermo: "Schermo intero", livelli: (a: number, b: number) => `livelli ${a}–${b}`,
    fonte: ["Valori della ", "wiki ufficiale", " di Forge of Empires (aggiornati al ", ")."],
    sblocco: (a: number, b: number) => `Costo di sblocco da ${a} a ${b}`, nessunSblocco: "Nessun costo di sblocco in questo intervallo.",
    sbloccoT: "Per sbloccare ogni livello, prima di poterci mettere PF. Beni: quantità di OGNUNO dei beni richiesti",
    risorse: { set_rame: "Set di progetti Rame", set_oro: "Set di progetti Oro", monete: "Monete", materiali: "Materiali", medaglie: "Medaglie", beni: "Beni (ciascuno)" } as Record<string, string>,
    costiSblocco: "Quanto costa sbloccare", costoLivello: (r: string) => `${r} per sbloccare il livello`, nessunoQui: (a: number, b: number) => `Non serve fra i livelli ${a} e ${b}`,
    fonteSblocchi: ["Costi di sblocco dal foglio pubblico ", "GB Update - PUBLIC", " (letto il ", ")."],
  },
  en: {
    eraIndietro: "age behind", ereIndietro: "ages behind", tuaEra: "your age",
    kitInvecchiatore: "One Down Kit", kitInversione: "Reversion Kit",
    inMagazzino: (k: string) => `${k} in stock:`,
    ereIndietroT: "Ages between the GB's and yours: unlocking levels needs goods of the GB's age (Inventory › Goods of age filter)",
    prossimi10T: "The next 10 levels of your GB", tutteEre: "All ages", carico: "Loading the GB data…", errore: "Couldn't download the data of this GB.", chiudi: "Close", chiudiEsc: "Close (Esc)",
    dal: "From level", al: "to level", tutti: "All", intervalloT: "You have the GB at the first level and take it to the second: you pay the levels in between",
    pfSalire: "FP to level up", tuoi: "Your share (chat)", mecenati: "From patrons", maxDal: "Bonuses maxed from lv.",
    chatT: "With Copper 100% chat on Copper levels (and on 101, still at Copper rate) and Gold 20% from 102, as in the GB Calculator",
    guadagni: (a: number, b: number) => `What you gain from ${a} to ${b}`, bonus: "Bonus", liv: "Lv.", guadagno: "Gain", perUno: "Your FP per +1",
    crescita: "How the bonuses grow", maxAl: (v: string, l: number) => `max ${v} at lv. ${l}`, tierOro: "Gold tier",
    inattivo: (a: number, b: number, oro: boolean) => `Not active between levels ${a} and ${b}${oro ? " (unlocks at 101)" : ""}`,
    costi: "Cost of leveling", costiTit: "Level FP and your share with the chat", log: "log scale",
    pfLivello: "Level FP", tuoiLeg: "yours (Copper 100% / Gold 20%)", tappe: "Milestones", tuoiCum: "Yours, cumulative", tuoiCol: "Yours (chat)",
    livello: "Level", schermo: "Full screen", livelli: (a: number, b: number) => `levels ${a}–${b}`,
    fonte: ["Values from the ", "official Forge of Empires wiki", " (updated ", ")."],
    sblocco: (a: number, b: number) => `Unlock cost from ${a} to ${b}`, nessunSblocco: "No unlock cost in this range.",
    sbloccoT: "To unlock each level, before you can put FP in it. Goods: amount of EACH required good",
    risorse: { set_rame: "Copper blueprint sets", set_oro: "Gold blueprint sets", monete: "Coins", materiali: "Supplies", medaglie: "Medals", beni: "Goods (each)" } as Record<string, string>,
    costiSblocco: "Cost of unlocking", costoLivello: (r: string) => `${r} to unlock the level`, nessunoQui: (a: number, b: number) => `Not needed between levels ${a} and ${b}`,
    fonteSblocchi: ["Unlock costs from the public sheet ", "GB Update - PUBLIC", " (read ", ")."],
  },
};
type Testi = typeof TESTI.it;

const COLORI = ["#60a5fa", "#f87171", "#34d399", "#c084fc", "#f472b6", "#22d3ee", "#a3e635"];
const ORO = "#fbbf24";
const RAPIDI: Array<[number, number]> = [[1, 50], [50, 100], [100, 150], [150, 200], [200, 300], [300, 400], [400, 500]];
/** Icone e colori delle risorse di sblocco (riquadri del costo e grafici). */
const ICONE_SBLOCCO: Record<string, string> = { set_rame: iconBP, set_oro: iconBPOro, monete: iconMon, materiali: iconMat, medaglie: iconMed, beni: iconBeni };
const COLORI_SBLOCCO: Record<string, string> = { set_rame: "#d97706", set_oro: ORO, monete: "#facc15", materiali: "#94a3b8", medaglie: "#c084fc", beni: "#34d399" };
const TAPPE = [10, 25, 50, 80, 100, 101, 150, 200, 250, 300, 400];

interface Serie { nome: string; col: string; val: (i: number) => number; area?: boolean; fmt: (v: number) => string }

/** Grafico a linee in SVG: asse y adattato all'intervallo (min–max mostrati,
 *  +5%), lineare o logaritmico; passando il mouse, linea e valori del livello. */
function Grafico({ n, serie, da, a, h, log = false, yFmt, uiLang }: {
  n: number; serie: Serie[]; da: number; a: number; h: number; log?: boolean; yFmt: (v: number) => string; uiLang: UiLang;
}) {
  const [cur, setCur] = useState<{ l: number; x: number; y: number } | null>(null);
  const W = 600, ml = 44, mr = 8, mt = 8, mb = 16, iw = W - ml - mr, ih = h - mt - mb;
  const tr = (v: number) => (log ? Math.log10(Math.max(1, v)) : v);
  const tutti = serie.flatMap(s => { const o: number[] = []; for (let l = da; l <= a && l <= n; l++) o.push(tr(s.val(l - 1))); return o; });
  let ymax = Math.max(...tutti), ymin = Math.min(...tutti);
  if (ymin === ymax) { ymin = ymax - (Math.abs(ymax) || 1); ymax += (Math.abs(ymax) || 1) * 0.05; }
  else if (!log) { const m = (ymax - ymin) * 0.05; ymin = Math.max(0, ymin - m); ymax += m; }
  const X = (l: number) => ml + (l - da) / Math.max(1, a - da) * iw;
  const Y = (v: number) => mt + ih - (tr(v) - ymin) / (ymax - ymin || 1) * ih;
  const marche = [100, 200, 300, 400].filter(m => m > da && m < a);
  const passo = Math.max(1, Math.floor((a - da) / 600)); // (al massimo ~600 punti per linea)
  const punti = (s: Serie) => { const p: string[] = []; for (let l = da; l <= a; l += passo) p.push(`${X(l).toFixed(1)},${Y(s.val(l - 1)).toFixed(1)}`); if ((a - da) % passo) p.push(`${X(a).toFixed(1)},${Y(s.val(a - 1)).toFixed(1)}`); return p.join(" "); };
  const T = TESTI[uiLang === "en" ? "en" : "it"];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width * W;
          if (fx < ml || fx > W - mr) { setCur(null); return; }
          setCur({ l: Math.max(da, Math.min(a, Math.round(da + (fx - ml) / iw * (a - da)))), x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => setCur(null)}>
        {[0, 1, 2, 3].map(i => {
          const yy = mt + ih * i / 3, v = ymax - (ymax - ymin) * i / 3;
          return <g key={i}><line x1={ml} x2={W - mr} y1={yy} y2={yy} stroke="#1e293b" /><text x={ml - 4} y={yy + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="ui-monospace,monospace">{yFmt(log ? Math.pow(10, v) : v)}</text></g>;
        })}
        {marche.map(m => <line key={m} x1={X(m)} x2={X(m)} y1={mt} y2={mt + ih} stroke={m === 100 ? "#f59e0b55" : "#33415588"} strokeDasharray="3 3" />)}
        {[da, ...marche, a].map(m => <text key={`t${m}`} x={X(m)} y={h - 3} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="ui-monospace,monospace">{m}</text>)}
        {serie.map(s => (
          <g key={s.nome}>
            {s.area && <polygon fill={`${s.col}22`} points={`${X(da)},${mt + ih} ${punti(s)} ${X(a)},${mt + ih}`} />}
            <polyline fill="none" stroke={s.col} strokeWidth="1.8" points={punti(s)} />
          </g>
        ))}
        {cur && <line x1={X(cur.l)} x2={X(cur.l)} y1={mt} y2={mt + ih} stroke="#e2e8f0" strokeOpacity=".5" />}
      </svg>
      {/* tooltip nel <body> (portale): dentro il pannello, che ha backdrop-blur e
          scorre, "fixed" sarebbe relativo al pannello e scrollando il tooltip
          finirebbe lontano dal cursore */}
      {cur && createPortal((
        <div className="pointer-events-none fixed z-[90] whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[11px] shadow-xl"
          style={{ left: Math.min(window.innerWidth - 240, cur.x + 14), top: Math.min(cur.y + 14, window.innerHeight - 34 - 17 * serie.length) }}>
          <div className="font-bold text-amber-400">{T.livello} {cur.l}</div>
          {serie.map(s => <div key={s.nome}><span style={{ color: s.col }}>■</span> {s.nome}: {s.fmt(s.val(cur.l - 1))}</div>)}
        </div>
      ), document.body)}
    </div>
  );
}

interface Zoom { titolo: string; sotto: string; disegna: (h: number) => ReactNode }

/** Icona del bonus (public/data/ge-icone/<icona>.png, scaricate da wiki_ge.py: le
 *  stesse delle intestazioni della wiki) al posto del titolo del grafico, con il nome
 *  nel tooltip; per le colonne a due valori un piccolo segno ("#" quante volte, "%"
 *  probabilità…). Se l'icona manca, il nome scritto come prima. */
function IconaBonus({ chiave, nome, oro, uiLang, conNome }: { chiave: string; nome: string; oro: boolean; uiLang: UiLang;
  /** anche il nome dopo l'icona (tabella "Cosa guadagni": fa da legenda dei grafici) */
  conNome?: boolean }) {
  // prima l'icona con la chiave intera (es. ..._guild_goods è un'icona sua, non
  // "guild" + "_goods"), poi quella senza il suffisso della sottocolonna, poi il nome
  const [tentativo, setTentativo] = useState(0);
  const m = /^(.+?)_(n|pct|goods|rare_totem|rare_reward|2)$/.exec(chiave);
  const ridotta = m && /^(icon_great_building_bonus_|(att|def|att_def)_boost_)/.test(m[1]!) ? m[1]! : null;
  const candidati = ridotta ? [chiave, ridotta] : [chiave];
  const segni: Record<string, [string, string]> = { n: ["#", "#"], pct: ["%", "%"], goods: ["beni", "goods"], rare_totem: ["rara", "rare"], rare_reward: ["rara", "rare"] };
  const segno = tentativo === 1 && m ? segni[m[2]!]?.[uiLang === "en" ? 1 : 0] : undefined;
  if (tentativo >= candidati.length) return <span className={oro ? "text-amber-300" : ""}>{nome}</span>;
  return (
    <span className={`inline-flex items-center gap-1 ${conNome ? "" : "cursor-help"}`} title={conNome ? undefined : nome}>
      <img key={candidati[tentativo]} src={`/data/ge-icone/${candidati[tentativo]}.png`} alt={nome} className={`${conNome ? "h-5 w-5" : "h-6 w-6"} shrink-0 object-contain`} onError={() => setTentativo(t => t + 1)} />
      {segno && <span className={`text-[11px] font-bold ${oro ? "text-amber-300" : "text-slate-300"}`}>{segno}</span>}
      {conNome && <span className={`ml-1 ${oro ? "text-amber-300" : ""}`}>{nome}</span>}
    </span>
  );
}

/** Campo del livello scritto a mano: testo libero mentre scrivi (niente frecce,
 *  niente correzioni a ogni tasto), il valore si applica con Invio o uscendo dal
 *  campo; un valore non valido torna a quello di prima. */
function CampoLivello({ valore, onCambia }: { valore: number; onCambia: (v: number) => void }) {
  const [testo, setTesto] = useState<string | null>(null);
  const applica = () => {
    const v = Number(testo);
    if (testo !== null && Number.isInteger(v) && v >= 1) onCambia(v);
    setTesto(null);
  };
  return (
    <input type="text" inputMode="numeric" value={testo ?? String(valore)}
      onFocus={e => e.currentTarget.select()}
      onChange={e => setTesto(e.currentTarget.value.replace(/\D/g, ""))}
      onBlur={applica} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { e.stopPropagation(); setTesto(null); } }}
      className="w-16 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-center" />
  );
}

function Box({ titolo, nota, onZoom, children }: { titolo: ReactNode; nota?: ReactNode; onZoom?: () => void; children: ReactNode }) {
  return (
    <div className="relative rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-2">
      <div className="mb-1 flex gap-2 pr-8 text-[12px] font-bold text-slate-200">{titolo}{nota && <span className="ml-auto text-right font-normal text-slate-400">{nota}</span>}</div>
      {onZoom && <button type="button" onClick={onZoom} className="absolute right-2 top-1.5 rounded border border-slate-700 bg-slate-950 px-1.5 text-[13px] text-slate-400 hover:text-amber-300" aria-label="⛶">⛶</button>}
      {children}
    </div>
  );
}

export default function PannelloReportGe({ id, nome, nomeEn, oro, era, w, h, immagine, livello, ereIndietro, kitEra, uiLang, onClose }: {
  id: string; nome: string;
  /** nome inglese del gioco = titolo della pagina sulla wiki (link della fonte) */
  nomeEn?: string;
  oro: boolean; era: string; w: number; h: number; immagine?: string | null;
  /** Livello attuale del GE nella tua città (aperto dalla scheda Città): intervallo
   *  predefinito livello → livello + 10, con il suo pulsante prima di "Tutti". */
  livello?: number;
  /** Dalla scheda Città: ere fra quella del GE e la tua (0 = la tua era). */
  ereIndietro?: number;
  /** Dalla scheda Città: Kit Invecchiatore e Kit di Inversione in inventario (per
   *  portare un edificio all'era del GE e avere i beni per sbloccarne i livelli). */
  kitEra?: { invecchiatore: number; inversione: number; nomeInvecchiatore?: string; nomeInversione?: string };
  uiLang: UiLang; onClose: () => void;
}) {
  const T: Testi = TESTI[uiLang === "en" ? "en" : "it"];
  const [stato, setStato] = useState<{ r: Report; data: string } | "carico" | "errore">("carico");
  const [zoom, setZoom] = useState<Zoom | null>(null);
  // costi di sblocco: file a parte (uno per tutti i GE); se manca, la sezione non c'è
  const [sblocchi, setSblocchi] = useState<SblocchiGe | null>(null);
  useEffect(() => {
    let vivo = true;
    setSblocchi(null);
    void caricaSblocchiGe(id).then(s => { if (vivo) setSblocchi(s); });
    return () => { vivo = false; };
  }, [id]);
  const [da, setDa] = useState(1);
  const [a, setA] = useState(oro ? 500 : 200);
  useEffect(() => {
    let vivo = true;
    setStato("carico");
    void caricaLivelliGe(id).then(d => {
      if (!vivo) return;
      const r = d ? preparaReport(d, oro, uiLang) : null;
      if (!r || !d) { setStato("errore"); return; }
      setStato({ r, data: d.scaricato });
      const n = r.livelli.length;
      if (livello && livello >= 1 && livello < n) { setDa(livello); setA(Math.min(n, livello + 10)); }
      else { setDa(1); setA(n); }
    });
    return () => { vivo = false; };
  }, [id, oro, uiLang, livello]);
  // Esc: prima chiude lo schermo intero, poi il report
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { if (zoom) setZoom(null); else onClose(); } };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [zoom, onClose]);

  const locale = uiLang === "en" ? "en-US" : "it-IT";
  // migliaia sempre separate, anche a 4 cifre (come il Calcolatore): punto in italiano, virgola in inglese
  const fmt = (v: number) => (uiLang === "en" ? formatInt(Math.round(v)).replace(/\./g, ",") : formatInt(Math.round(v)));
  const dec = (v: number) => (uiLang === "en" ? v.toFixed(1) : v.toFixed(1).replace(".", ","));
  const fk = (v: number) => v >= 1e9 ? `${dec(v / 1e9)}G` : v >= 1e6 ? `${dec(v / 1e6)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}k` : fmt(v);
  const N = typeof stato === "object" ? stato.r.livelli.length : (oro ? 500 : 200);
  const A0 = Math.max(1, Math.min(da, N - 1)), B0 = Math.max(A0 + 1, Math.min(a, N));

  const corpo = useMemo(() => {
    if (typeof stato !== "object") return null;
    const { r } = stato, L = r.livelli, la = L[A0 - 1]!, lb = L[B0 - 1]!;
    const tot = lb.cumTot - la.cumTot, tuoi = lb.cumTuoi - la.cumTuoi;
    const vf = (k: number) => (v: number) => (r.colonne[k]!.perc ? `${fmt(v)}%` : fmt(v));
    const col = (k: number) => (r.info[k]!.oro ? ORO : COLORI[k % COLORI.length]!);
    const perUno = (v: number) => (v < 10 ? v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : fk(v));
    const graficoBonus = (k: number) => (hh: number) => (
      <Grafico n={L.length} da={A0} a={B0} h={hh} uiLang={uiLang}
        serie={[{ nome: r.colonne[k]!.nome, col: col(k), val: i => L[i]!.v[k]!, area: true, fmt: vf(k) }]}
        yFmt={v => (r.colonne[k]!.perc ? `${Math.round(v)}%` : fk(v))} />
    );
    const graficoCosti = (hh: number) => (
      <Grafico n={L.length} da={A0} a={B0} h={hh} log uiLang={uiLang} yFmt={fk}
        serie={[{ nome: T.pfLivello, col: "#94a3b8", val: i => L[i]!.costo, fmt }, { nome: T.tuoiCol, col: ORO, val: i => L[i]!.tuoi, area: true, fmt }]} />
    );
    const tappe = [A0, ...TAPPE.filter(l => l > A0 && l < B0 && l <= N), B0];
    return (
      <>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[[`${T.pfSalire} ${A0} → ${B0}`, fmt(tot), "text-slate-100"], [T.tuoi, fmt(tuoi), "text-amber-300"], [T.mecenati, fmt(tot - tuoi), "text-slate-100"], [T.maxDal, String(Math.max(...r.info.map(i => i.lmax))), "text-slate-100"]].map(([k, v, c], i) => (
            <div key={i} className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-2" title={i === 1 ? T.chatT : undefined}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</div>
              <div className={`font-mono text-[17px] font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>

        {/* costo di sblocco dei livelli A+1…B (riga i della tabella = livello i+1) */}
        {sblocchi && (() => {
          const tot = sblocchi.colonne.map((_, k) => sblocchi.righe.slice(A0, B0).reduce((s, x) => s + (x[k] ?? 0), 0));
          const voci = sblocchi.colonne.map((c, k) => [c, tot[k]!] as const).filter(([, v]) => v > 0);
          return (
            <>
              <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-amber-400" title={T.sbloccoT}>{T.sblocco(A0, B0)}</h3>
              <div className="flex flex-wrap gap-2">
                {voci.length ? voci.map(([c, v]) => (
                  <div key={c} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1.5" title={`${T.risorse[c] ?? c}: ${fmt(v)}`}>
                    <img src={ICONE_SBLOCCO[c] ?? iconBP} alt="" className="h-6 w-6 object-contain" />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{T.risorse[c] ?? c}</span>
                      <span className={`font-mono text-[15px] font-bold ${c === "set_oro" ? "text-amber-300" : "text-slate-100"}`}>{v >= 1e6 ? fk(v) : fmt(v)}</span>
                    </span>
                  </div>
                )) : <p className="text-slate-400">{T.nessunSblocco}</p>}
              </div>
            </>
          );
        })()}

        <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-amber-400">{T.guadagni(A0, B0)}</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1.5">
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400">
              <th className="px-1.5 py-1 text-left font-sans">{T.bonus}</th><th className="px-1.5 py-1 text-right">{T.liv} {A0}</th><th className="px-1.5 py-1 text-right">{T.liv} {B0}</th><th className="px-1.5 py-1 text-right">{T.guadagno}</th><th className="px-1.5 py-1 text-right">{T.perUno}</th>
            </tr></thead>
            <tbody>{r.colonne.map((c, k) => {
              const g = lb.v[k]! - la.v[k]!;
              return (
                <tr key={c.chiave} className="border-t border-slate-800">
                  <td className={`px-1.5 py-1 text-left font-sans ${r.info[k]!.oro ? "text-amber-300" : ""}`}><IconaBonus chiave={c.chiave} nome={c.nome} oro={r.info[k]!.oro} uiLang={uiLang} conNome /></td>
                  <td className="px-1.5 py-1 text-right">{la.v[k] ? vf(k)(la.v[k]!) : "–"}</td>
                  <td className="px-1.5 py-1 text-right">{lb.v[k] ? vf(k)(lb.v[k]!) : "–"}</td>
                  <td className={`px-1.5 py-1 text-right ${g > 0 ? "text-emerald-400" : "text-slate-500"}`}>{g > 0 ? `+${vf(k)(g)}` : "="}</td>
                  <td className="px-1.5 py-1 text-right">{g > 0 ? perUno(tuoi / g) : "–"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>

        <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-amber-400">{T.crescita}</h3>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {r.colonne.map((c, k) => {
            const i = r.info[k]!, nota = `${i.oro ? `${T.tierOro} · ` : ""}${T.maxAl(vf(k)(i.max), i.lmax)}`;
            const attivo = L.slice(A0 - 1, B0).some(l => l.v[k]);
            return (
              <Box key={c.chiave} titolo={<IconaBonus chiave={c.chiave} nome={c.nome} oro={i.oro} uiLang={uiLang} />} nota={nota}
                onZoom={attivo ? () => setZoom({ titolo: c.nome, sotto: T.livelli(A0, B0), disegna: graficoBonus(k) }) : undefined}>
                {attivo ? graficoBonus(k)(90) : <div className="grid h-[90px] place-items-center text-[12px] text-slate-500">{T.inattivo(A0, B0, i.oro)}</div>}
              </Box>
            );
          })}
        </div>

        <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-amber-400">{T.costi}</h3>
        <Box titolo={T.costiTit} nota={T.log} onZoom={() => setZoom({ titolo: T.costiTit, sotto: `${T.livelli(A0, B0)}, ${T.log}`, disegna: graficoCosti })}>
          <div className="mb-1 flex gap-3 text-[11px] text-slate-400">
            <span><i className="mr-1 inline-block h-[3px] w-2.5 rounded align-middle" style={{ background: "#94a3b8" }} />{T.pfLivello}</span>
            <span><i className="mr-1 inline-block h-[3px] w-2.5 rounded align-middle" style={{ background: ORO }} />{T.tuoiLeg}</span>
          </div>
          {graficoCosti(160)}
        </Box>

        {/* un grafico per risorsa di sblocco (costo del singolo livello), come quelli dei bonus */}
        {sblocchi && (() => {
          const S = sblocchi.righe;
          const usate = sblocchi.colonne.map((c, k) => [c, k] as const).filter(([, k]) => S.some(x => x[k]));
          if (!usate.length) return null;
          const grafico = (c: string, k: number) => (hh: number) => (
            <Grafico n={S.length} da={A0} a={B0} h={hh} uiLang={uiLang}
              serie={[{ nome: T.costoLivello(T.risorse[c] ?? c), col: COLORI_SBLOCCO[c] ?? COLORI[k % COLORI.length]!, val: i => S[i]?.[k] ?? 0, area: true, fmt }]}
              yFmt={fk} />
          );
          return (
            <>
              <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-amber-400" title={T.sbloccoT}>{T.costiSblocco}</h3>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {usate.map(([c, k]) => {
                  let max = 0, lmax = 1;
                  S.forEach((x, i) => { if ((x[k] ?? 0) > max) { max = x[k]!; lmax = i + 1; } });
                  const nome = T.risorse[c] ?? c;
                  const attivo = S.slice(A0 - 1, B0).some(x => x[k]);
                  return (
                    <Box key={c} titolo={<span className="inline-flex items-center gap-1.5" title={nome}><img src={ICONE_SBLOCCO[c] ?? iconBP} alt="" className="h-6 w-6 object-contain" />{nome}</span>}
                      nota={T.maxAl(fmt(max), lmax)}
                      onZoom={attivo ? () => setZoom({ titolo: nome, sotto: T.livelli(A0, B0), disegna: grafico(c, k) }) : undefined}>
                      {attivo ? grafico(c, k)(90) : <div className="grid h-[90px] place-items-center text-[12px] text-slate-500">{T.nessunoQui(A0, B0)}</div>}
                    </Box>
                  );
                })}
              </div>
            </>
          );
        })()}

        <h3 className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-amber-400">{T.tappe}</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1.5">
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400">
              <th className="px-1.5 py-1 text-left font-sans">{T.liv}</th><th className="px-1.5 py-1 text-right">{T.pfLivello}</th><th className="px-1.5 py-1 text-right">{T.tuoiCol}</th><th className="px-1.5 py-1 text-right">{T.tuoiCum}</th>
              {r.colonne.map(c => <th key={c.chiave} className="px-1.5 py-1 text-right">{c.nome}</th>)}
            </tr></thead>
            <tbody>{tappe.map(l => {
              const x = L[l - 1]!, massimo = r.info.every((i, k) => x.v[k]! >= i.max);
              return (
                <tr key={l} className={`border-t border-slate-800 ${massimo ? "text-emerald-400" : ""}`}>
                  <td className="px-1.5 py-1 text-left">{l}</td><td className="px-1.5 py-1 text-right">{fmt(x.costo)}</td><td className="px-1.5 py-1 text-right">{fmt(x.tuoi)}</td><td className="px-1.5 py-1 text-right">{fk(x.cumTuoi)}</td>
                  {r.colonne.map((c, k) => <td key={c.chiave} className={`px-1.5 py-1 text-right ${r.info[k]!.oro && !massimo ? "text-amber-300" : ""}`}>{x.v[k] ? vf(k)(x.v[k]!) : "–"}</td>)}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {/* fonte: link alla pagina del GE sulla wiki; data gg-mm-aaaa in italiano */}
        <p className="mt-3 text-[11px] text-slate-500">
          {T.fonte[0]}<a href={`https://en.wiki.forgeofempires.com/index.php?title=${encodeURIComponent((nomeEn || nome).replace(/ /g, "_"))}`}
            target="_blank" rel="noopener noreferrer" className="text-amber-400 underline hover:text-amber-300">{T.fonte[1]}</a>
          {T.fonte[2]}{uiLang === "en" ? stato.data : stato.data.split("-").reverse().join("-")}{T.fonte[3]}
          {sblocchi && <>{" "}{T.fonteSblocchi[0]}<a href={sblocchi.fonte ?? "https://docs.google.com/spreadsheets/d/1Y4nFA5R8MLuWI1ACUHK9AfpWOYAGN3M_1Q5kCdYKDmA"}
            target="_blank" rel="noopener noreferrer" className="text-amber-400 underline hover:text-amber-300">{T.fonteSblocchi[1]}</a>
            {T.fonteSblocchi[2]}{uiLang === "en" ? sblocchi.scaricato : sblocchi.scaricato.split("-").reverse().join("-")}{T.fonteSblocchi[3]}</>}
        </p>
      </>
    );
    // (fmt/fk dipendono solo dalla lingua)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stato, sblocchi, A0, B0, uiLang]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-700 bg-gradient-to-r from-amber-500/10 to-transparent px-4 py-3">
          {immagine ? <img src={immagine} alt="" className="h-12 w-12 rounded-lg border border-slate-700 bg-slate-900 object-contain" /> : null}
          <div className="min-w-0">
            <h2 className={`truncate text-lg font-bold ${oro ? "ge-name-gold" : "ge-name-copper"}`}>{nome}</h2>
            <div className="text-[12px] text-slate-400">
              {era === "AllAge" ? T.tutteEre : ageName(era, uiLang as Lang)}
              {/* (dalla Città: quante ere dietro la tua è il GE, perché lo sblocco dei livelli chiede beni della sua era) */}
              {ereIndietro !== undefined && era !== "AllAge" && (
                <span title={T.ereIndietroT}> ({ereIndietro > 0 ? <><b className="text-amber-300">{ereIndietro}</b> {ereIndietro === 1 ? T.eraIndietro : T.ereIndietro}</> : <b className="text-amber-300">{T.tuaEra}</b>})</span>
              )}
              {" "}· {w}×{h}{" "}
              <span className="gb-badge-copper ml-1 rounded border px-1.5 text-[11px] font-bold">RAME 1–{oro ? 100 : 200}</span>
              {oro && <span className="ml-1 rounded border border-amber-500/60 bg-amber-500/15 px-1.5 text-[11px] font-bold text-amber-300">ORO 101–500</span>}
            </div>
          </div>
          {/* kit per cambiare l'era di un edificio, in inventario (solo dalla Città) */}
          {kitEra && (
            <div className="ml-auto flex shrink-0 items-center gap-3 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-1.5">
              {([[iconKitInvecchiatore, kitEra.invecchiatore, kitEra.nomeInvecchiatore ?? T.kitInvecchiatore], [iconKitInversione, kitEra.inversione, kitEra.nomeInversione ?? T.kitInversione]] as const).map(([ic, n, nm]) => (
                // tooltip nostro (non title): "Kit … in magazzino: N" con N verde se > 0, rosso se 0
                <span key={nm} className="group relative flex cursor-help items-center gap-1">
                  <img src={ic} alt={nm} className="h-6 w-6 object-contain" />
                  <span className={`font-mono text-[13px] font-bold ${n > 0 ? "text-slate-100" : "text-slate-500"}`}>{fmt(n)}</span>
                  <span className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 hidden whitespace-nowrap rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[12px] font-normal text-slate-200 shadow-xl group-hover:block">
                    {T.inMagazzino(nm)} <b className={n > 0 ? "text-emerald-400" : "text-red-400"}>{fmt(n)}</b>
                  </span>
                </span>
              ))}
            </div>
          )}
          <button type="button" onClick={onClose} className={`${kitEra ? "ml-2" : "ml-auto"} text-xl text-slate-400 hover:text-amber-300`} aria-label={T.chiudi}>✕</button>
        </div>
        <div className="px-4 py-3 text-[13px] text-slate-300">
          <div className="mb-3 flex flex-wrap items-center gap-2" title={T.intervalloT}>
            {T.dal} <CampoLivello valore={A0} onCambia={setDa} />
            {T.al} <CampoLivello valore={B0} onCambia={setA} />
            {/* (dalla Città: prima i prossimi 10 livelli del TUO GE, es. 191–201) */}
            {[...(livello && livello < N ? [[livello, Math.min(N, livello + 10)] as [number, number]] : []), [1, N] as [number, number], ...RAPIDI.filter(([, y]) => y <= N)].map(([x, y], i) => (
              <button key={`${x}-${y}-${i}`} type="button" onClick={() => { setDa(x); setA(y); }}
                title={livello && i === 0 && x === livello ? T.prossimi10T : undefined}
                className={`rounded-md border px-2 py-1 text-[12px] font-bold ${A0 === x && B0 === y ? "border-amber-400 bg-amber-400 text-slate-950" : "border-slate-700 bg-slate-800 text-slate-200 hover:border-amber-500"}`}>
                {x === 1 && y === N ? T.tutti : `${x}–${y}`}
              </button>
            ))}
          </div>
          {stato === "carico" && <p className="py-10 text-center text-slate-400">{T.carico}</p>}
          {stato === "errore" && <p className="py-10 text-center text-red-400">{T.errore}</p>}
          {corpo}
        </div>
      </div>
      {zoom && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 p-4" onClick={e => { e.stopPropagation(); setZoom(null); }}>
          <div className="mb-2 flex items-center gap-3 font-bold text-slate-100" onClick={e => e.stopPropagation()}>
            {zoom.titolo} <span className="font-normal text-slate-400">{zoom.sotto}</span>
            <button type="button" onClick={() => setZoom(null)} className="ml-auto rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[12px]">✕ {T.chiudiEsc}</button>
          </div>
          <div className="min-h-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 p-3" onClick={e => e.stopPropagation()}>
            {zoom.disegna(Math.max(260, window.innerHeight - 110))}
          </div>
        </div>
      )}
    </div>
  );
}
