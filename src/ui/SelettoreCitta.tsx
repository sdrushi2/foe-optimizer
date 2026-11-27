// ─────────────────────────────────────────────────────────────────────────────
//  ui/SelettoreCitta.tsx — Selettore della città nella testata (2.0)
//
//  Al posto della barra dei profili: un pulsante con la città attiva che apre
//  l'elenco delle città salvate, divise in "Le tue città" e "Città visitate",
//  ognuna con il cestino (conferma nel menu stesso, testo diverso per tipo),
//  (si importa con la bacchetta verde della testata; 2.0: in fondo al menu
//  anche "Importa da JSON", città ridotta). Il menu è `position: fixed` così
//  non viene tagliato dalla riga delle schede (overflow hidden).
//  Doppio clic sul pulsante (2.005): il nome diventa un campo per rinominare
//  la città (Invio o clic fuori = salva, Esc = annulla).
//  27/11/2026: su ogni riga i pulsanti di export (data/esportaCitta.ts): le tue
//  città "completa" e "solo la città", le visitate solo la seconda, le importate
//  da JSON secondo cosa contengono (i pulsanti dicono già se una città importata
//  è completa: niente simboli dopo il nome). Legenda dei pulsanti a destra del
//  menu su schermo largo, in fondo su schermo stretto.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Building2, ChevronDown, ExternalLink, Eye, FileJson, Map as MapIcon, Package, Trash2 } from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";
import { STORE_PONTE } from "../data/ponte";
import type { TipoCitta } from "../data/citta";
import { LIMITE_STORAGE, occupazioneStorage } from "../utils/storage";
import { senzaEstensioni } from "../utils/dispositivo";

export interface VoceCitta { id: string; nome: string; tipo: TipoCitta; avatar?: string | null;
  /** 2.0: città "ridotta" importata da un file JSON (sezione a parte nel menu). */
  daJson?: boolean;
  /** 27/11/2026: città da JSON importata completa (inventario e alleati). */
  completa?: boolean }

/** Si può esportare completa? Le tue città, e le importate complete. */
const esportabileCompleta = (c: VoceCitta) => (c.daJson ? !!c.completa : c.tipo === "mia");

/** Larghezza del menu: con la legenda a destra da 768 px in su. */
const LARGO = 768, W_STRETTO = 280, W_LARGO = 540;

/** Legenda dei pulsanti. */
function Legenda({ uiLang, stretta }: { uiLang: UiLang; stretta?: boolean }) {
  const riga = (icona: ReactNode, testo: string) => (
    <div className="flex items-start gap-1.5"><span className="mt-px flex shrink-0 items-center">{icona}</span><span>{testo}</span></div>
  );
  return (
    <div className={`space-y-1 text-[11px] leading-snug text-slate-400 ${stretta ? "mt-1 border-t border-slate-800 px-2 pt-1.5" : ""}`}>
      <div className="text-slate-500">{t("r2LegButtons", uiLang)}</div>
      {riga(<Package size={13} strokeWidth={1.75} className="text-slate-300" />, t("r2LegFull", uiLang))}
      {riga(<MapIcon size={13} strokeWidth={1.75} className="text-slate-300" />, t("r2LegCityOnly", uiLang))}
      {riga(<Trash2 size={13} className="text-red-400" />, t("r2LegDelete", uiLang))}
    </div>
  );
}

/** Mini-avatar del giocatore (16 px) o, se manca, l'icona del tipo di città. */
function Miniatura({ c, size = 16 }: { c: VoceCitta | undefined; size?: number }) {
  if (c?.avatar) return <img src={c.avatar} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-sm object-cover" />;
  const I = c?.tipo === "visitata" ? Eye : Building2;
  return <I size={14} strokeWidth={1.75} className="shrink-0 text-sky-300" aria-hidden="true" />;
}

/** Barra dello spazio occupato (19/11/2026, richiesta dell'utente): in fondo al
 *  menu, un tratto per città (gialle le tue, azzurre le visitate, grigie quelle
 *  da JSON), al passaggio del mouse nome e spazio della città; sotto la legenda
 *  e la stima di quante città ci stanno ancora (dimensione media delle salvate). */
function BarraSpazio({ citta, uiLang }: { citta: VoceCitta[]; uiLang: UiLang }) {
  const { totale, perCitta } = useMemo(() => occupazioneStorage(), []);
  const [sopra, setSopra] = useState<{ c: VoceCitta; n: number; x: number } | null>(null);
  const loc = uiLang === "en" ? "en-US" : "it-IT";
  const mil = (n: number) => (n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const pct = (n: number, d = 0) => (n / LIMITE_STORAGE * 100).toLocaleString(loc, { maximumFractionDigits: d });
  const gruppi: Array<[VoceCitta[], string]> = [
    [citta.filter(c => c.tipo === "mia" && !c.daJson), "bg-amber-400"],
    [citta.filter(c => c.tipo === "visitata" && !c.daJson), "bg-sky-400"],
    [citta.filter(c => c.daJson), "bg-slate-400"],
  ];
  const pesi = citta.map(c => perCitta.get(c.id) ?? 0).filter(n => n > 0);
  const media = pesi.length ? pesi.reduce((a, b) => a + b, 0) / pesi.length : 0;
  const libere = media ? Math.max(0, Math.floor((LIMITE_STORAGE - totale) / media)) : null;
  return (
    <div className="mt-1 border-t border-slate-800 px-2 pt-1.5 pb-1">
      <div className="flex justify-between text-[11px] text-slate-500">
        <span title={t("r2StorageTitle", uiLang)}>{t("r2StorageUsed", uiLang)}</span>
        <span className="text-slate-300">{mil(totale)} / {mil(LIMITE_STORAGE)} M · {pct(totale)}%</span>
      </div>
      <div className="relative mt-1">
        <div className="flex h-2.5 gap-px overflow-hidden rounded-sm bg-slate-800">
          {gruppi.flatMap(([lista, colore]) => lista.map(c => {
            const n = perCitta.get(c.id) ?? 0;
            if (!n) return null;
            return <div key={c.id} className={`${colore} shrink-0 hover:brightness-125`} style={{ width: `${n / LIMITE_STORAGE * 100}%` }}
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(), p = e.currentTarget.parentElement!.getBoundingClientRect(); setSopra({ c, n, x: r.left + r.width / 2 - p.left }); }}
              onMouseLeave={() => setSopra(null)} />;
          }))}
        </div>
        {sopra && (
          <div className="pointer-events-none absolute bottom-full mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-slate-600 bg-slate-950 px-1.5 py-0.5 text-[11px] text-slate-200 shadow-lg"
            style={{ left: Math.min(Math.max(sopra.x, 70), 196) }}>
            {sopra.c.nome} · {Math.round(sopra.n / 1024).toLocaleString(loc)} KB · {pct(sopra.n, 1)}%
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-[11px] text-slate-500">
        {gruppi.map(([lista, colore], i) => lista.length > 0 && (
          <span key={i} className="flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-sm ${colore}`} />
            {t(i === 0 ? "r2StorageMine" : i === 1 ? "r2StorageVisited" : "r2StorageJson", uiLang, lista.length)}</span>
        ))}
      </div>
      {libere !== null && <div className="text-right text-[11px] text-slate-500">{t("r2StorageFree", uiLang, libere)}</div>}
    </div>
  );
}

interface Props {
  citta: VoceCitta[];
  attiva: string;
  onSeleziona: (id: string) => void;
  onElimina: (id: string) => void;
  /** 27/11/2026: elimina tutte le città (le preferenze restano). */
  onEliminaTutte?: () => void;
  onRinomina: (id: string, nome: string) => void;
  /** 2.0: aggiunge una città da un file JSON (27/11/2026: unico posto, non più anche in Opzioni). */
  onImportaJson?: () => void;
  /** 27/11/2026: scarica la città (completa = con inventario e alleati). */
  onEsporta?: (id: string, completa: boolean) => void;
  uiLang: UiLang;
  /** Avatar del giocatore della città attiva (mini-foto nel pulsante). */
  avatar?: string | null;
  /** Larghezza massima del pulsante (la testata si stringe). */
  maxW: number;
}

export default function SelettoreCitta({ citta, attiva, onSeleziona, onElimina, onEliminaTutte, onRinomina, onImportaJson, onEsporta, uiLang, maxW, avatar }: Props) {
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  /** Nome in modifica (doppio clic), null = non si sta rinominando. */
  const [nuovoNome, setNuovoNome] = useState<string | null>(null);
  const rifCampo = useRef<HTMLInputElement>(null);
  const [daEliminare, setDaEliminare] = useState<VoceCitta | null>(null);
  const [eliminaTutte, setEliminaTutte] = useState(false);
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
      setMenu(null); setDaEliminare(null); setEliminaTutte(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(null); setDaEliminare(null); setEliminaTutte(false); } };
    const tm = setTimeout(() => document.addEventListener("mousedown", fuori));
    document.addEventListener("keydown", esc);
    return () => { clearTimeout(tm); document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const inModifica = nuovoNome !== null;
  useEffect(() => { if (inModifica) rifCampo.current?.select(); }, [inModifica]);
  const salva = () => {
    if (nuovoNome === null) return;
    const n = nuovoNome.trim();
    if (corrente && n && n !== corrente.nome) onRinomina(corrente.id, n);
    setNuovoNome(null);
  };

  const apri = (e: MouseEvent) => {
    // (secondo clic di un doppio clic: lo gestisce onDoubleClick)
    if (e.detail > 1) return;
    if (menu) { setMenu(null); return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // largo (con la legenda) solo se ci sono città: vuoto basta il riquadro stretto
    const w = window.innerWidth >= LARGO && citta.length > 0 ? W_LARGO : W_STRETTO;
    setMenu({ left: Math.max(4, Math.min(r.left, window.innerWidth - w - 4)), top: r.bottom + 4 });
    setDaEliminare(null); setEliminaTutte(false);
  };

  const tasto = "rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-100";
  const riga = (c: VoceCitta) => {
    return (
      <div key={c.id} className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 ${c.id === attiva ? "bg-sky-950/70 text-slate-50" : "text-slate-200 hover:bg-slate-800"}`}
        onClick={() => { onSeleziona(c.id); setMenu(null); }}>
        <Miniatura c={c} />
        <span className="min-w-0 flex-1 truncate">{c.nome}</span>
        {onEsporta && esportabileCompleta(c) && (
          <button type="button" title={t("r2ExportFull", uiLang)} aria-label={t("r2ExportFull", uiLang)}
            onClick={(e) => { e.stopPropagation(); onEsporta(c.id, true); }} className={tasto}><Package size={14} strokeWidth={1.75} /></button>
        )}
        {onEsporta && (
          <button type="button" title={t("r2ExportCityOnly", uiLang)} aria-label={t("r2ExportCityOnly", uiLang)}
            onClick={(e) => { e.stopPropagation(); onEsporta(c.id, false); }} className={tasto}><MapIcon size={14} strokeWidth={1.75} /></button>
        )}
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
      {nuovoNome !== null && corrente ? (
        <div style={{ maxWidth: maxW }}
          className="mr-2 flex h-8 shrink-0 items-center gap-1.5 self-end -mb-px overflow-hidden rounded-t-md border border-b-0 border-sky-600 bg-slate-950 px-3 text-slate-50">
          <Miniatura c={{ ...corrente, avatar: corrente.avatar ?? avatar }} />
          <input ref={rifCampo} value={nuovoNome} maxLength={60} aria-label={t("r2RenameCity", uiLang)}
            onInput={(e) => setNuovoNome((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === "Enter") salva(); else if (e.key === "Escape") setNuovoNome(null); }}
            onBlur={salva}
            style={{ width: `${Math.max(6, nuovoNome.length + 1)}ch` }}
            className="min-w-0 bg-transparent text-slate-50 outline-none" />
        </div>
      ) : (
      <button ref={rifPulsante} type="button" onClick={(e) => apri(e as unknown as MouseEvent)}
        onDoubleClick={() => { if (!corrente) return; setMenu(null); setDaEliminare(null); setNuovoNome(corrente.nome); }}
        title={corrente ? `${corrente.nome}\n${t("r2RenameCityHint", uiLang)}` : t("r2NoCity", uiLang)}
        style={{ maxWidth: maxW }}
        // Stesso aspetto della scheda selezionata (bordo sopra e ai lati,
        // sfondo del nastro, appoggiata al nastro): la città si legge come
        // "Database" (richiesta utente).
        className="mr-2 flex h-8 shrink-0 items-center gap-1.5 self-end -mb-px overflow-hidden rounded-t-md border border-b-0 border-slate-700 bg-slate-950 px-3 text-slate-50 hover:text-white">
        <Miniatura c={corrente && { ...corrente, avatar: corrente.avatar ?? avatar }} />
        <span className="truncate">{corrente?.nome ?? t("r2NoCity", uiLang)}</span>
        <ChevronDown size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
      </button>
      )}
      {menu && (
        <div ref={rifMenu} style={{ left: menu.left, top: menu.top }}
          className={`fixed z-[60] w-[280px] rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-[12px] whitespace-normal shadow-xl ${citta.length > 0 ? "md:w-[540px]" : ""}`}>
          {eliminaTutte ? (
            <div className="p-1.5">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-red-400"><AlertTriangle size={14} />{t("r2DeleteAllAsk", uiLang)}</div>
              <div className="mb-2.5 text-slate-400">{t("r2DeleteAllBody", uiLang, citta.length)}</div>
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setEliminaTutte(false)} className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-200 hover:bg-slate-800">{t("r2Cancel", uiLang)}</button>
                <button type="button" onClick={() => { onEliminaTutte?.(); setEliminaTutte(false); setMenu(null); }}
                  className="rounded-md border border-red-500 bg-red-800 px-2.5 py-1 text-white hover:bg-red-700">{t("r2DeleteAllCities", uiLang)}</button>
              </div>
            </div>
          ) : daEliminare ? (
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
            <div className={citta.length > 0 ? "md:flex md:gap-3" : ""}>
            <div className={citta.length > 0 ? "md:w-[280px] md:shrink-0" : ""}>
              {mie.length > 0 && <div className="px-2 pt-1 pb-0.5 text-[11px] text-slate-500">{t("r2MyCities", uiLang)}</div>}
              {mie.map(riga)}
              {visitate.length > 0 && <div className="px-2 pt-1.5 pb-0.5 text-[11px] text-slate-500">{t("r2VisitedCities", uiLang)}</div>}
              {visitate.map(riga)}
              {daJson.length > 0 && <div className="px-2 pt-1.5 pb-0.5 text-[11px] text-slate-500">{t("r2JsonCities", uiLang)}</div>}
              {daJson.map(riga)}
              {citta.length === 0 && (senzaEstensioni
                ? <div className="px-2 py-1.5 text-slate-400">{t("r2NoCitiesYetMobile", uiLang)}</div>
                : <div className="px-2 py-1.5 text-slate-400">
                    {t("r2NoCitiesYet", uiLang)}
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      <li>{t("r2NoCitiesWand", uiLang)}</li>
                      {/* (27/11/2026) link al Chrome Web Store; Firefox quando AMO l'approva */}
                      <li>{t("r2NoCitiesBridge", uiLang)}: <a href={STORE_PONTE.chrome} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 whitespace-nowrap text-emerald-300 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-200">
                        {t("r2NoCitiesBridgeLink", uiLang)}<ExternalLink size={10} aria-hidden="true" /></a></li>
                      <li>{t("r2NoCitiesJson", uiLang)}</li>
                    </ul>
                  </div>)}
              {onImportaJson && (
                <button type="button" title={t("r2ImportCityJsonTitle", uiLang)}
                  onClick={() => { setMenu(null); onImportaJson(); }}
                  className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-slate-800 px-2 py-1.5 text-left text-slate-300 hover:bg-slate-800 hover:text-slate-50">
                  <FileJson size={14} strokeWidth={1.75} className="shrink-0 text-sky-300" aria-hidden="true" />
                  {t("r2ImportCityJson", uiLang)}
                </button>
              )}
              {citta.length > 0 && onEliminaTutte && (
                <button type="button" onClick={() => setEliminaTutte(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-red-400 hover:bg-red-950/50 hover:text-red-300">
                  <Trash2 size={14} className="shrink-0" aria-hidden="true" />
                  {t("r2DeleteAllCities", uiLang)}
                </button>
              )}
              {citta.length > 0 && onEsporta && <div className="md:hidden"><Legenda uiLang={uiLang} stretta /></div>}
              {citta.length > 0 && <BarraSpazio citta={citta} uiLang={uiLang} />}
            </div>
            {citta.length > 0 && onEsporta && (
              <div className="hidden min-w-0 flex-1 border-l border-slate-800 py-1 pr-1 pl-3 md:block">
                <Legenda uiLang={uiLang} />
              </div>
            )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
