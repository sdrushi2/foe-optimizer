// ─────────────────────────────────────────────────────────────────────────────
//  planner/ModificaCitta.tsx — Pannello "Modifica città" del Planner
//
//  Prima di ottimizzare: togliere edifici della città e aggiungerne altri
//  dall'inventario (solo quelli posseduti, fino alle copie disponibili) o dal
//  database (tutto il catalogo, con la scelta del livello). Riepilogo delle
//  celle, elenco delle modifiche (ognuna annullabile) e avvisi. Le modifiche
//  sono temporanee: vivono nel Planner aperto (Reset le azzera). Logica pura
//  in modificheCitta.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import type { CityMapBuilding } from "../data/cityMap";
import { t, type UiKey, type UiLang } from "../data/ui-strings";
import { FALLBACK_ERA, ageName } from "../data/ages";
import { formatDecimal, formatInt } from "../utils/format";
import * as I from "../assets/icons";
import { MAP_COLOR_GREAT_BUILDING, MAP_COLOR_MILITARY, MAP_COLOR_NO_ROAD_REQUIRED, MAP_COLOR_ROAD2_REQUIRED, MAP_COLOR_ROAD_REQUIRED } from "../components/cityMapPng";
import { anelliSenzaInizio } from "./catene";
import { CAMPI_PERCENTUALI, contaModifiche, deltaModifiche, NESSUNA_MODIFICA, riepilogoCelle, type Aggiunto, type CampoDelta, type CandidatiPlanner, type CandidatoPlanner, type FamigliaPlanner, type Modifiche } from "./modificheCitta";

interface Props {
  /** Città vera (senza modifiche). */
  citta: readonly CityMapBuilding[];
  /** Città con le modifiche (quella su cui lavora il Planner). */
  cittaModificata: readonly CityMapBuilding[];
  modifiche: Modifiche;
  setModifiche: (m: Modifiche) => void;
  candidati: CandidatiPlanner;
  celleSbloccate: number;
  /** Ricerca in corso (non in pausa): niente modifiche. */
  bloccato: boolean;
  /** Planner avviato (anche in pausa): cambiare la città lo riavvia. */
  inCorsa: boolean;
  onChiudi: () => void;
  uiLang: UiLang;
}

/** Quadratino col colore della mappa (strada / due corsie / senza strada / GE / militare). */
function Colore({ c }: { c: Pick<CandidatoPlanner, "roadLevel" | "isGreatBuilding" | "isMilitary"> }) {
  const col = c.isGreatBuilding ? MAP_COLOR_GREAT_BUILDING : c.isMilitary ? MAP_COLOR_MILITARY
    : c.roadLevel >= 2 ? MAP_COLOR_ROAD2_REQUIRED : c.roadLevel > 0 ? MAP_COLOR_ROAD_REQUIRED : MAP_COLOR_NO_ROAD_REQUIRED;
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: col }} />;
}

/** Colonne della tabella delle differenze: icona ed etichetta (quelle dei confronti fra ere);
 *  `gruppo` = prima colonna di un gruppo (bordo a sinistra, come nella tabella degli edifici). */
const COLONNE_DELTA: ReadonlyArray<{ k: CampoDelta; icon: string; label: UiKey; gruppo?: true }> = [
  { k: "area", icon: I.iconSize, label: "plannerEditDeltaArea" }, { k: "road", icon: I.iconRoad, label: "colRoad" },
  { k: "pop", icon: I.iconPop, label: "diffPopulation", gruppo: true }, { k: "fel", icon: I.iconFel, label: "diffHappiness" },
  { k: "general0", icon: I.iconGenAtk_A, label: "diffGenAtkAtk", gruppo: true }, { k: "general1", icon: I.iconGenDef_A, label: "diffGenDefAtk" },
  { k: "general2", icon: I.iconGenAtk_D, label: "diffGenAtkDef" }, { k: "general3", icon: I.iconGenDef_D, label: "diffGenDefDef" },
  { k: "gbg0", icon: I.iconCampiAtk_A, label: "diffGbgAtkAtk", gruppo: true }, { k: "gbg1", icon: I.iconCampiDef_A, label: "diffGbgDefAtk" },
  { k: "gbg2", icon: I.iconCampiAtk_D, label: "diffGbgAtkDef" }, { k: "gbg3", icon: I.iconCampiDef_D, label: "diffGbgDefDef" },
  { k: "sped0", icon: I.iconSpedAtk_A, label: "diffGeAtkAtk", gruppo: true }, { k: "sped1", icon: I.iconSpedDef_A, label: "diffGeDefAtk" },
  { k: "sped2", icon: I.iconSpedAtk_D, label: "diffGeAtkDef" }, { k: "sped3", icon: I.iconSpedDef_D, label: "diffGeDefDef" },
  { k: "iq0", icon: I.iconIQAtk_A, label: "diffIqAtkAtk", gruppo: true }, { k: "iq1", icon: I.iconIQDef_A, label: "diffIqDefAtk" },
  { k: "iq2", icon: I.iconIQAtk_D, label: "diffIqAtkDef" }, { k: "iq3", icon: I.iconIQDef_D, label: "diffIqDefDef" },
  { k: "iqMon", icon: I.iconIQMon, label: "diffIqCoins" }, { k: "iqMonB", icon: I.iconIQMonB, label: "diffIqCoinsBoost" },
  { k: "iqMat", icon: I.iconIQMat, label: "diffIqMaterials" }, { k: "iqMatB", icon: I.iconIQMatB, label: "diffIqMaterialsBoost" },
  { k: "iqBeni", icon: I.iconIQBeni, label: "diffIqGoods" }, { k: "iqTruppe", icon: I.iconIQTruppe, label: "diffIqUnits" },
  { k: "iqAzioni", icon: I.iconIQAzioni, label: "diffIqActions" }, { k: "iqCap", icon: I.iconIQCap, label: "diffIqCapacity" },
  { k: "mon", icon: I.iconMon, label: "diffCoins", gruppo: true }, { k: "monb", icon: I.iconMonB, label: "prodCoinsBoost" },
  { k: "mat", icon: I.iconMat, label: "diffMaterials" }, { k: "matb", icon: I.iconMatB, label: "prodMaterialsBoost" },
  { k: "fp", icon: I.iconFP, label: "diffForgePoints" }, { k: "fpb", icon: I.iconFPB, label: "diffForgePointsBoost" },
  { k: "med", icon: I.iconMed, label: "diffMedals" }, { k: "medb", icon: I.iconMedB, label: "prodMedalsBoost" },
  { k: "beni", icon: I.iconBeni, label: "diffGoods" }, { k: "benib", icon: I.iconBeniB, label: "diffGoodsBoost" },
  { k: "benip", icon: I.iconBeniP, label: "diffGoodsPreviousEra" }, { k: "benis", icon: I.iconBeniS, label: "diffGoodsNextEra" },
  { k: "benisp", icon: I.iconBeniSp, label: "diffGoodsSpecial" }, { k: "benispb", icon: I.iconBeniSpB, label: "diffGoodsSpecialBoost" },
  { k: "benig", icon: I.iconBeniG, label: "diffTreasuryGoods" }, { k: "fur", icon: I.iconFUR, label: "diffRogues" },
  { k: "tr", icon: I.iconTR, label: "diffUnits" }, { k: "trne", icon: I.iconTRNE, label: "diffUnitsNextEra" },
  { k: "bp", icon: I.iconBP, label: "diffBlueprints" }, { k: "fsp", icon: I.iconFSP, label: "prodRushSpecial" },
  { k: "tpm", icon: I.iconTPM, label: "prodRushMaterials" }, { k: "tpb", icon: I.iconTPB, label: "prodRushGoods" },
  { k: "adm", icon: I.iconAiuto, label: "diffMassAid" }, { k: "mod", icon: I.iconOneUp, label: "diffOneUpKit" },
  { k: "rin", icon: I.iconRinn, label: "diffRenovationKit" }, { k: "imm", icon: I.iconImm, label: "diffStoreBuilding" },
];
/** Differenza con il segno: "+1.250", "−0,5", "+5%"; 0 = "–". */
function formatDelta(k: CampoDelta, v: number): string {
  if (CAMPI_PERCENTUALI.has(k)) { const p = Math.round(v * 100); return p ? `${p > 0 ? "+" : "−"}${Math.abs(p)}%` : "–"; }
  const r = Math.round(v * 10) / 10;
  if (!r) return "–";
  return `${r > 0 ? "+" : "−"}${Number.isInteger(r) ? formatInt(Math.abs(r)) : formatDecimal(Math.abs(r), 1)}`;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const LIMITE_RISULTATI = 60;
let contatoreUid = 0;

export default function ModificaCitta({ citta, cittaModificata, modifiche, setModifiche, candidati, celleSbloccate, bloccato, inCorsa, onChiudi, uiLang }: Props) {
  const [cercaCitta, setCercaCitta] = useState("");
  const [ordine, setOrdine] = useState<"nome" | "eff">("eff");
  const [scheda, setScheda] = useState<"inv" | "db">("inv");
  const [cercaAgg, setCercaAgg] = useState("");
  /** Ordine della colonna "Aggiungi": per nome o più efficienti prima. */
  const [ordineAgg, setOrdineAgg] = useState<"nome" | "eff">("eff");
  /** Livello scelto per famiglia del database (indice in `livelli`; default l'ultimo). */
  const [livelloScelto, setLivelloScelto] = useState<ReadonlyMap<string, number>>(new Map());

  // ── Colonna "In città": edifici raggruppati per tipo (municipio e strade esclusi)
  const gruppi = useMemo(() => {
    const m = new Map<string, { entityId: string; name: string; w: number; h: number; ids: string[]; c: Pick<CandidatoPlanner, "roadLevel" | "isGreatBuilding" | "isMilitary"> }>();
    for (const b of citta) {
      if (b.type === "street" || b.type === "main_building") continue;
      const g = m.get(b.entityId);
      if (g) g.ids.push(b.mapEntityId);
      else m.set(b.entityId, { entityId: b.entityId, name: b.name, w: b.w, h: b.h, ids: [b.mapEntityId], c: { roadLevel: b.roadLevel ?? 1, isGreatBuilding: b.isGreatBuilding, isMilitary: b.isMilitary } });
    }
    return [...m.values()];
  }, [citta]);
  const gruppiVisibili = useMemo(() => {
    const q = norm(cercaCitta.trim());
    const eff = (id: string) => candidati.efficienza.get(id) ?? Infinity;
    return gruppi.filter(g => !q || norm(g.name).includes(q))
      .sort((a, b) => (ordine === "eff" ? eff(a.entityId) - eff(b.entityId) : 0) || a.name.localeCompare(b.name));
  }, [gruppi, cercaCitta, ordine, candidati.efficienza]);

  const togli = (ids: string[]) => {
    const id = ids.find(i => !modifiche.tolti.has(i));
    if (id) setModifiche({ ...modifiche, tolti: new Set([...modifiche.tolti, id]) });
  };
  const rimetti = (ids: string[]) => {
    const id = ids.find(i => modifiche.tolti.has(i));
    if (!id) return;
    const tolti = new Set(modifiche.tolti); tolti.delete(id);
    setModifiche({ ...modifiche, tolti });
  };
  const aggiungi = (c: CandidatoPlanner, fonte: Aggiunto["fonte"]) =>
    setModifiche({ ...modifiche, aggiunti: [...modifiche.aggiunti, { uid: `${Date.now().toString(36)}-${++contatoreUid}`, c, fonte }] });
  const togliAggiunto = (uid: string) => setModifiche({ ...modifiche, aggiunti: modifiche.aggiunti.filter(a => a.uid !== uid) });

  // ── Colonna "Aggiungi"
  const usatiInv = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of modifiche.aggiunti) if (a.fonte === "inv") m.set(a.c.entityId, (m.get(a.c.entityId) ?? 0) + 1);
    return m;
  }, [modifiche.aggiunti]);
  const q = norm(cercaAgg.trim());
  /** Efficienza per l'aggiunta: più efficienti prima (senza dato in fondo). */
  const effAgg = (id: string) => candidati.efficienza.get(id) ?? -Infinity;
  const livelloDi = (f: FamigliaPlanner) => Math.min(livelloScelto.get(f.key) ?? f.livelli.length - 1, f.livelli.length - 1);
  const inventario = useMemo(() => {
    const l = candidati.inventario.filter(c => !q || norm(c.name).includes(q));
    return ordineAgg === "eff" ? [...l].sort((a, b) => effAgg(b.entityId) - effAgg(a.entityId) || a.name.localeCompare(b.name)) : l;
  }, [candidati.inventario, q, ordineAgg]); // eslint-disable-line react-hooks/exhaustive-deps
  const database = useMemo(() => {
    if (q.length < 2) return [];
    const l = candidati.database.filter(f => norm(f.name).includes(q) || f.livelli.some(x => norm(x.name).includes(q)));
    const e = (f: FamigliaPlanner) => effAgg(f.livelli[livelloDi(f)]!.entityId);
    return ordineAgg === "eff" ? l.sort((a, b) => e(b) - e(a) || a.name.localeCompare(b.name)) : l;
  }, [candidati.database, q, ordineAgg, livelloScelto]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Riepilogo e avvisi
  const prima = riepilogoCelle(citta, celleSbloccate), dopo = riepilogoCelle(cittaModificata, celleSbloccate);
  const tolti = citta.filter(b => modifiche.tolti.has(b.mapEntityId));
  const celleTolte = tolti.reduce((s, b) => s + b.w * b.h, 0);
  const celleAggiunte = modifiche.aggiunti.reduce((s, a) => s + a.c.w * a.c.h, 0);
  const geTolti = tolti.some(b => b.isGreatBuilding);
  const anelliSoli = useMemo(() => {
    const prima0 = new Set(anelliSenzaInizio(citta));
    return anelliSenzaInizio(cittaModificata).filter(n => !prima0.has(n));
  }, [citta, cittaModificata]);
  const n = contaModifiche(modifiche);
  // Tabella delle differenze (11/11/2026, utente): aggiunti − tolti, colonna per colonna
  const differenze = useMemo(() => (n && candidati.valori ? deltaModifiche(citta, modifiche, candidati.valori) : null), [n, citta, modifiche, candidati.valori]);
  const alleatiTolti = tolti.reduce((s, b) => s + (candidati.alleati?.get(b.mapEntityId) ?? 0), 0);

  const etichettaLivello = (c: CandidatoPlanner) => (c.level ? t("plannerLevel", uiLang, c.level) : "");
  /** Riga delle liste: con modifiche, sfondo tinto e barra a sinistra (rosso = tolti, verde = aggiunti). */
  const riga = (stato?: "tolto" | "aggiunto") => `flex items-center gap-2 rounded border-l-4 px-2 py-1 ${
    stato === "tolto" ? "border-red-500 bg-red-950/40 hover:bg-red-950/60"
    : stato === "aggiunto" ? "border-emerald-500 bg-emerald-950/40 hover:bg-emerald-950/60"
    : "border-transparent hover:bg-slate-800/60"}`;
  /** Edifici aggiunti per entityId (da inventario e database). */
  const aggiuntiPer = new Map<string, number>();
  for (const a of modifiche.aggiunti) aggiuntiPer.set(a.c.entityId, (aggiuntiPer.get(a.c.entityId) ?? 0) + 1);
  const badgeAggiunti = (k: number) => (k ? <span className="rounded bg-emerald-700 px-1 text-[11px] font-bold text-white">+{k}</span> : null);
  const pulsante = "rounded border px-2 leading-5 font-bold disabled:opacity-30";

  return (
    <div className="mx-3 mt-3 rounded border-2 border-teal-600/70 bg-slate-950/70 p-3 text-[13px]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <b className="text-teal-300">{t("plannerEditCity", uiLang)}</b>
        <span className="text-slate-400">{t("plannerEditCityIntro", uiLang)}</span>
        <span className="ml-auto flex gap-2">
          <button type="button" disabled={!n || bloccato} onClick={() => setModifiche(NESSUNA_MODIFICA)}
            className="rounded border border-slate-500 px-2 py-0.5 text-slate-200 hover:bg-slate-800 disabled:opacity-40">{t("plannerEditCityRestore", uiLang)}</button>
          <button type="button" onClick={onChiudi} aria-label={t("plannerClose", uiLang)}
            className="rounded px-2 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
        </span>
      </div>
      {bloccato && <div className="mb-2 text-amber-300">{t("plannerEditCityLocked", uiLang)}</div>}
      {!bloccato && inCorsa && <div className="mb-2 text-sky-300">{t("plannerEditCityRestarts", uiLang)}</div>}

      {/* Riepilogo */}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 rounded bg-slate-900 px-2 py-1.5">
        <span>{t("plannerEditRemoved", uiLang)} <b className="text-red-300">{tolti.length}</b> ({celleTolte ? `−${celleTolte}` : "0"} {t("plannerEditCells", uiLang)})</span>
        <span>{t("plannerEditAdded", uiLang)} <b className="text-emerald-300">{modifiche.aggiunti.length}</b> ({celleAggiunte ? `+${celleAggiunte}` : "0"} {t("plannerEditCells", uiLang)})</span>
        <span>{t("plannerEditFree", uiLang)} <b className={dopo.libere < prima.stradeAttuali ? "text-amber-300" : "text-slate-100"}>{dopo.libere}</b>
          <span className="text-slate-500"> {t("plannerEditFreeNow", uiLang, prima.libere, prima.stradeAttuali)}</span></span>
      </div>

      {/* Avvisi */}
      {/* Spazio (tre livelli): nessuna cella libera → impossibile; meno celle
          delle strade di oggi → il Planner deve risparmiare strade, non è detto
          che ci riesca; città più piena → c'è spazio sulla carta, ma non è
          garantito (dipende da quanto riesce a ottimizzare il Planner). */}
      {(geTolti || anelliSoli.length > 0 || celleAggiunte > celleTolte) && (
        <ul className="mb-2 list-none space-y-0.5 text-amber-200">
          {geTolti && <li>⚠️ {t("plannerEditWarnGe", uiLang)}</li>}
          {anelliSoli.length > 0 && <li>⚠️ {t("plannerEditWarnChain", uiLang, anelliSoli.join(", "))}</li>}
          {dopo.libere <= 0 ? <li className="text-red-300">⛔ {t("plannerEditWarnNoSpace", uiLang)}</li>
            : dopo.libere < prima.stradeAttuali ? <li>⚠️ {t("plannerEditWarnSpace", uiLang, prima.stradeAttuali, dopo.libere, prima.stradeAttuali - dopo.libere)}</li>
            : celleAggiunte > celleTolte && <li className="text-sky-200">ℹ️ {t("plannerEditWarnMaybe", uiLang, dopo.libere, prima.stradeAttuali)}</li>}
        </ul>
      )}

      {/* Elenco delle modifiche, ognuna annullabile */}
      {n > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[...new Map(tolti.map(b => [b.entityId, b])).values()].map(b => {
            const k = tolti.filter(x => x.entityId === b.entityId).length;
            return (
              <span key={`t-${b.entityId}`} className="inline-flex items-center gap-1 rounded border border-red-800 bg-red-950/50 px-1.5 text-red-200">
                − {b.name}{k > 1 ? ` ×${k}` : ""}
                <button type="button" disabled={bloccato} onClick={() => rimetti(tolti.filter(x => x.entityId === b.entityId).map(x => x.mapEntityId))}
                  title={t("plannerEditUndo", uiLang)} className="px-0.5 text-red-300 hover:text-white disabled:opacity-30">×</button>
              </span>
            );
          })}
          {modifiche.aggiunti.map(a => (
            <span key={a.uid} className="inline-flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950/50 px-1.5 text-emerald-200">
              + {a.c.name}
              <button type="button" disabled={bloccato} onClick={() => togliAggiunto(a.uid)}
                title={t("plannerEditUndo", uiLang)} className="px-0.5 text-emerald-300 hover:text-white disabled:opacity-30">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Cosa cambia: una riga di icone e una di differenze (verde = di più, rosso = di meno) */}
      {differenze && (
        <div className="mb-2 rounded border border-slate-800">
          <div className="border-b border-slate-800 px-2 py-1 font-bold text-slate-200">{t("plannerEditDeltaTitle", uiLang)}</div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-[12px]">
              <thead><tr>
                {COLONNE_DELTA.map(c => (
                  <th key={c.k} title={t(c.label, uiLang)} className={`px-1.5 pb-0.5 pt-1 ${c.gruppo ? "border-l border-slate-700" : ""}`}>
                    <img src={c.icon} alt={t(c.label, uiLang)} className="mx-auto h-5 w-5 max-w-none object-contain" />
                  </th>
                ))}
              </tr></thead>
              <tbody><tr>
                {COLONNE_DELTA.map(c => {
                  const v = differenze.delta[c.k], neutro = c.k === "area" || c.k === "road";
                  const testo = formatDelta(c.k, v);
                  return (
                    <td key={c.k} title={t(c.label, uiLang)} className={`whitespace-nowrap px-1.5 pb-1 text-center font-mono ${c.gruppo ? "border-l border-slate-700" : ""} ${
                      testo === "–" ? "text-slate-600" : neutro ? "text-slate-200" : v > 0 ? "text-emerald-400" : "text-red-400"}`}>{testo}</td>
                  );
                })}
              </tr></tbody>
            </table>
          </div>
          {(differenze.eraMassima > 0 || differenze.senzaDati > 0 || alleatiTolti > 0) && (
            <ul className="list-none space-y-0.5 border-t border-slate-800 px-2 py-1 text-amber-200">
              {differenze.eraMassima > 0 && <li>⚠️ {t("plannerEditDeltaEraMax", uiLang, differenze.eraMassima, ageName(FALLBACK_ERA, uiLang))}</li>}
              {differenze.senzaDati > 0 && <li>⚠️ {t("plannerEditDeltaNoData", uiLang, differenze.senzaDati)}</li>}
              {alleatiTolti > 0 && <li>⚠️ {t("plannerEditDeltaAllies", uiLang, alleatiTolti)}</li>}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {/* In città */}
        <div className="min-w-0 rounded border border-slate-800">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-2 py-1.5">
            <b className="text-slate-200">{t("plannerEditInCity", uiLang)}</b>
            <input type="search" value={cercaCitta} onInput={e => setCercaCitta(e.currentTarget.value)} placeholder={t("plannerEditSearch", uiLang)}
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-100" />
            <select value={ordine} onChange={e => setOrdine(e.currentTarget.value as "nome" | "eff")}
              className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-slate-200">
              <option value="nome">{t("plannerEditSortName", uiLang)}</option>
              <option value="eff">{t("plannerEditSortEff", uiLang)}</option>
            </select>
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {gruppiVisibili.map(g => {
              const k = g.ids.filter(i => modifiche.tolti.has(i)).length, restano = g.ids.length - k;
              const eff = candidati.efficienza.get(g.entityId);
              return (
                <div key={g.entityId} className={riga(k ? "tolto" : undefined)}>
                  <Colore c={g.c} />
                  <span className={`min-w-0 flex-1 truncate ${!k ? "text-slate-200" : restano ? "text-red-300" : "text-red-400/70 line-through"}`} title={g.name}>{g.name}</span>
                  {ordine === "eff" && eff !== undefined && <span className="text-[11px] text-amber-400">{eff.toFixed(1)}</span>}
                  <span className="text-[11px] text-slate-500">{g.w}×{g.h}</span>
                  {k > 0 && <span className="rounded bg-red-700 px-1 text-[11px] font-bold text-white">−{k}</span>}
                  <span className="w-8 text-right text-slate-300" title={t("plannerEditLeft", uiLang)}>{restano}</span>
                  <button type="button" disabled={bloccato || !restano} onClick={() => togli(g.ids)} title={t("plannerEditRemove", uiLang)}
                    className={`${pulsante} border-red-700 text-red-300 hover:bg-red-950`}>−</button>
                  <button type="button" disabled={bloccato || !k} onClick={() => rimetti(g.ids)} title={t("plannerEditUndo", uiLang)}
                    className={`${pulsante} border-slate-600 text-slate-300 hover:bg-slate-800`}>↺</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aggiungi */}
        <div className="min-w-0 rounded border border-slate-800">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-2 py-1.5">
            <b className="text-slate-200">{t("plannerEditAdd", uiLang)}</b>
            <span className="inline-flex overflow-hidden rounded border border-slate-600" role="group">
              {(["inv", "db"] as const).map(s => (
                <button key={s} type="button" aria-pressed={scheda === s} onClick={() => setScheda(s)}
                  className={`px-2 py-0.5 text-[12px] font-bold ${scheda === s ? "bg-teal-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
                  {t(s === "inv" ? "plannerEditFromInventory" : "plannerEditFromDatabase", uiLang)}
                </button>
              ))}
            </span>
            <input type="search" value={cercaAgg} onInput={e => setCercaAgg(e.currentTarget.value)} placeholder={t("plannerEditSearch", uiLang)}
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-100" />
            <select value={ordineAgg} onChange={e => setOrdineAgg(e.currentTarget.value as "nome" | "eff")}
              className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-slate-200">
              <option value="nome">{t("plannerEditSortName", uiLang)}</option>
              <option value="eff">{t("plannerEditSortEffBest", uiLang)}</option>
            </select>
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {scheda === "inv" && (inventario.length === 0
              ? <div className="p-2 text-slate-500">{t(candidati.inventario.length ? "plannerEditNoResults" : "plannerEditNoInventory", uiLang)}</div>
              : inventario.map(c => {
                const usati = usatiInv.get(c.entityId) ?? 0, resta = (c.qty ?? 0) - usati;
                return (
                  <div key={c.entityId} className={riga(usati ? "aggiunto" : undefined)}>
                    <Colore c={c} />
                    <span className={`min-w-0 flex-1 truncate ${usati ? "text-emerald-300" : "text-slate-200"}`} title={c.name}>{c.name}</span>
                    {ordineAgg === "eff" && candidati.efficienza.has(c.entityId) && <span className="text-[11px] text-amber-400">{candidati.efficienza.get(c.entityId)!.toFixed(1)}</span>}
                    <span className="text-[11px] text-slate-500">{c.w}×{c.h}</span>
                    {badgeAggiunti(usati)}
                    <span className="w-8 text-right text-slate-300" title={t("plannerEditAvailable", uiLang)}>{resta}</span>
                    <button type="button" disabled={bloccato || resta <= 0} onClick={() => aggiungi(c, "inv")} title={t("plannerEditAddOne", uiLang)}
                      className={`${pulsante} border-emerald-600 text-emerald-300 hover:bg-emerald-950`}>+</button>
                  </div>
                );
              }))}
            {scheda === "db" && (q.length < 2
              ? <div className="p-2 text-slate-500">{t("plannerEditTypeToSearch", uiLang)}</div>
              : database.length === 0 ? <div className="p-2 text-slate-500">{t("plannerEditNoResults", uiLang)}</div>
              : <>
                {database.slice(0, LIMITE_RISULTATI).map(f => {
                  const i = livelloDi(f);
                  const c = f.livelli[i]!;
                  // aggiunti di questa famiglia (qualunque livello)
                  const k = f.livelli.reduce((s, l) => s + (aggiuntiPer.get(l.entityId) ?? 0), 0);
                  return (
                    <div key={f.key} className={riga(k ? "aggiunto" : undefined)}>
                      <Colore c={c} />
                      <span className={`min-w-0 flex-1 truncate ${k ? "text-emerald-300" : "text-slate-200"}`} title={c.name}>{f.name}</span>
                      {badgeAggiunti(k)}
                      {ordineAgg === "eff" && candidati.efficienza.has(c.entityId) && <span className="text-[11px] text-amber-400">{candidati.efficienza.get(c.entityId)!.toFixed(1)}</span>}
                      {f.livelli.length > 1 && (
                        <select value={i} onChange={e => setLivelloScelto(new Map(livelloScelto).set(f.key, Number(e.currentTarget.value)))}
                          className="max-w-[9rem] rounded border border-slate-700 bg-slate-900 px-1 text-[12px] text-slate-200">
                          {f.livelli.map((l, j) => <option key={l.entityId} value={j}>{l.level ? etichettaLivello(l) : l.name}{f.livelli.filter(x => x.level === l.level).length > 1 ? ` · ${l.name}` : ""}</option>)}
                        </select>
                      )}
                      <span className="text-[11px] text-slate-500">{c.w}×{c.h}</span>
                      <button type="button" disabled={bloccato} onClick={() => aggiungi(c, "db")} title={t("plannerEditAddOne", uiLang)}
                        className={`${pulsante} border-emerald-600 text-emerald-300 hover:bg-emerald-950`}>+</button>
                    </div>
                  );
                })}
                {database.length > LIMITE_RISULTATI && <div className="p-2 text-slate-500">{t("plannerEditMoreResults", uiLang, database.length - LIMITE_RISULTATI)}</div>}
              </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
