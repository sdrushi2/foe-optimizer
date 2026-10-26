// ─────────────────────────────────────────────────────────────────────────────
//  ui/nastri.tsx — Gruppi del nastro per ogni scheda (FoE Optimizer 2.0)
//
//  Si completa scheda per scheda; finché una scheda non ha il suo nastro
//  completo, i comandi mancanti restano nelle vecchie barre sotto.
//  Fatto: Database (Catalogo, Ricerca, Filtri, Visualizza), Città (Importa,
//  Ricerca, Filtri, Visualizza, Statistiche, Nascondi, Strumenti), Inventario
//  (Importa, Ricerca, Filtri, Visualizza, Strumenti), catalogo Alleati del
//  Database e scheda Alleati (Filtri Militari/Scienza, Visualizza rarità,
//  Analisi); gruppo "Opzioni" della tabella (Somma statistiche, Export) in tutte le tabelle;
//  Opzioni (Pesi).
// ─────────────────────────────────────────────────────────────────────────────

import { BookOpen, Building, Building2, ChevronsUp, Clock4, Coins, Download, Eye, FileUp, Funnel, Info, Landmark, Map as MapIcon, Moon, Package, Scale, Search, Sigma, Smile, Sun, Trash2, Upload, Users, UsersRound, Wand2, ZapOff, Route, Factory, Swords, TrendingUp, Atom, LifeBuoy, Archive, Bug, PackagePlus, ArrowBigUpDash, ChartColumn, Compass, FileJson, EyeOff, Lightbulb, Anchor, FlaskConical, UserCheck, Puzzle, SlidersHorizontal, UserRound, type LucideIcon } from "lucide-react";
import { BloccoFiltri, type StatoFiltri } from "./FiltriEdifici";
import { BloccoRarita, type StatoAlleati } from "./FiltriAlleati";
import { BloccoGiocatore, type DatiGiocatore } from "./InfoGiocatore";
import { BloccoPesi, type StatoPesi } from "./PesiStatistiche";
import type { RibbonGroup, RibbonItem } from "./ribbon/Ribbon";
import type { Scheda } from "./Testata";
import { t, type UiLang } from "../data/ui-strings";
import type { Tema } from "./theme";

export interface ContestoNastri {
  uiLang: UiLang;
  ricerca: string;
  setRicerca: (s: string) => void;
  haCitta: boolean;
  mappa: boolean;
  onMappa: () => void;
  tema: Tema;
  setTema: (t: Tema) => void;
  onInformazioni: () => void;
  onAiutoBacchetta: () => void;
  onEliminaTutte: () => void;
  /** 2.0: città "ridotta" da un file JSON (nostro export, Planner, Forge Hammer). */
  onImportaCittaJson: () => void;
  onEsporta: () => void;
  onRipristina: () => void;
  haCitteSalvate: boolean;
  /** Filtri delle tabelle edifici (Database). */
  filtri: StatoFiltri;
  /** Interruttori di Visualizza: attivo = mostrato. */
  vista: Record<"dettaglioProd" | "somme" | "iqProd" | "pop" | "fel" | "sped", Interruttore>;
  /** Opzioni › Pesi statistiche: le spedizioni contano nell'efficienza (altrimenti ⚠️ su Visualizza › Spedizioni). */
  spedNeiPesi: boolean;
  /** "Nascondi / Mostra solo": 0 tutti, 1 nascosti (rosso), 2 solo questi (verde). */
  tri: { stati: Record<VoceTri, 0 | 1 | 2>; gira: (v: VoceTri) => void };
  pesi: StatoPesi;
  /** Solo scheda Città. */
  citta: {
    inventario: Interruttore;
    statistiche: Record<"strade" | "produzione" | "militari" | "era" | "aggiornabili", Interruttore>;
    /** Strumenti: stesso export JSON del pannello MAPPA. */
    onEsportaJson: () => void;
    /** Nascondi: attivo = edifici NASCOSTI. */
  };
  /** Scheda Planner: sorgente (città selezionata o JSON) e gruppi dati dal Planner. */
  planner: {
    sorgente: "citta" | "json";
    haCitta: boolean;
    setSorgente: (s: "citta" | "json") => void;
    jsonNome: string | null;
    onImportaJson: () => void;
    /** Chiude il JSON importato (X sul pulsante col nome del file). */
    onChiudiJson: () => void;
    gruppi: RibbonGroup[];
  };
  /** Scheda Insediamenti: gruppi dati dallo strumento Pirati (Calcolo, Espansioni). */
  insediamenti: { gruppi: RibbonGroup[] };
  /** Giocatore della città selezionata (null senza città). */
  giocatore: DatiGiocatore | null;
  /** Export CSV degli edifici selezionati (tabelle edifici). */
  esporta: { n: number; onClick: () => void; titolo: string };
  /** Pannello Debug della scheda (Città o Inventario). */
  debug: Interruttore;
  /** Catalogo del Database. */
  catalogo: "edifici" | "alleati";
  setCatalogo: (c: "edifici" | "alleati") => void;
  alleati: StatoAlleati;
  /** Scheda Alleati: statistiche dei tuoi alleati come a livello 100. */
  livello100: Interruttore;
  /** Scheda Alleati: pannello Potenziale e gettoni valore. */
  consigliere: Interruttore & { disponibile: boolean };
}

export type VoceTri = "nonAcc" | "autoAge" | "limitati" | "iq" | "alleati" | "frammenti" | "aiuto" | "immagazzina" | "ge";

export interface Interruttore { attivo: boolean; cambia: () => void }

/** Nastro della scheda: i gruppi della scheda e, nelle schede della città
 *  (Città, Inventario, Alleati, Planner sulla città selezionata), in testa il
 *  gruppo "Giocatore" (ui/InfoGiocatore.tsx). */
export function costruisciNastri(scheda: Scheda, c: ContestoNastri): RibbonGroup[] {
  const gruppi = gruppiScheda(scheda, c);
  // Planner: giocatore della città selezionata o (2.0) del file JSON (App sceglie quale)
  const conGiocatore = scheda === "citta" || scheda === "inventario" || scheda === "alleati" || scheda === "planner";
  if (!c.giocatore || !conGiocatore) return gruppi;
  const g = c.giocatore;
  return [{ id: "giocatore", label: t("r2GrpPlayer", c.uiLang) as string, icon: UserRound, priority: 2, rows: [[
    { kind: "custom", id: "giocatore", render: (modo) => <BloccoGiocatore g={g} modo={modo} uiLang={c.uiLang} /> },
  ]] }, ...gruppi];
}

function gruppiScheda(scheda: Scheda, c: ContestoNastri): RibbonGroup[] {
  const L = (k: Parameters<typeof t>[0]) => t(k, c.uiLang) as string;
  // (2.0: niente gruppo Importa nelle schede: si importa solo con la
  // bacchetta verde della testata.)
  const campoRicerca: RibbonItem = {
    kind: "custom", id: "ricerca",
    render: (modo) => modo === "S"
      ? <span className="rounded-md border border-slate-700 p-1 text-slate-300" title={L("r2Search")}><Search size={14} /></span>
      : (
        <label className="flex h-[22px] items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-slate-300 hover:border-slate-600 focus-within:border-sky-500">
          <Search size={13} aria-hidden="true" />
          <input type="search" value={c.ricerca} onInput={(e) => c.setRicerca(e.currentTarget.value)} placeholder={L("r2Search")}
            className="w-24 bg-transparent text-[12px] text-slate-100 outline-none placeholder:text-slate-500" />
        </label>
      ),
  };
  // Il "?" spiega come cercare: gli alleati non hanno la ricerca per id con "\".
  const sonoAlleati = scheda === "alleati" || (scheda === "database" && c.catalogo === "alleati");
  const ricerca: RibbonGroup = { id: "ricerca", label: L("r2GrpSearch"), icon: Search, priority: 2,
    help: L(sonoAlleati ? "r2SearchHelpAllies" : "r2SearchHelp"), rows: [[campoRicerca]] };
  const inArrivo = L("r2Soon");
  const interruttore = (k: keyof ContestoNastri["vista"], icon: LucideIcon, etichetta: Parameters<typeof t>[0], titolo?: Parameters<typeof t>[0]): RibbonItem => ({
    kind: "button", id: k, icon, label: L(etichetta), title: titolo ? L(titolo) : undefined,
    active: c.vista[k].attivo, onClick: c.vista[k].cambia,
  });

  const tasto = (id: string, it: Interruttore, icon: LucideIcon, etichetta: Parameters<typeof t>[0], titolo?: Parameters<typeof t>[0], danger?: boolean): RibbonItem => ({
    kind: "button", id, icon, label: L(etichetta), title: titolo ? L(titolo) : undefined, active: it.attivo, onClick: it.cambia, danger,
  });
  const filtri: RibbonGroup = { id: "filtri", label: L("r2GrpFilters"), icon: Funnel, priority: 3, rows: [[
    { kind: "custom", id: "filtri", render: () => <BloccoFiltri s={c.filtri} /> },
  ]] };
  const vistaBase: RibbonItem[] = [
    interruttore("pop", UsersRound, "r2Pop"),
    interruttore("fel", Smile, "r2Fel"),
    interruttore("iqProd", Coins, "r2IqProd", "iqProdColumnsTitle"),
    interruttore("dettaglioProd", Package, "r2ProdDetail", "r2ProdDetailTitle"),
    // Colonne Spedizioni: ⚠️ se in Opzioni le spedizioni non contano nell'efficienza
    { kind: "button", id: "sped", icon: Compass, active: c.vista.sped.attivo, onClick: c.vista.sped.cambia,
      label: c.spedNeiPesi ? L("r2Sped") : `${L("r2Sped")} ⚠️`,
      title: c.spedNeiPesi ? L("r2SpedTitle") : `${L("r2SpedTitle")}\n${L("r2SpedNotWeighted")}` },
  ];
  // Alleati: Filtri = tipo (Militari, Scienza) e, nella scheda Alleati,
  // Frammenti; Visualizza = le 5 rarità.
  const a = c.alleati;
  // Nella scheda Alleati l'etichetta riporta quanti ne hai: "Militari (32)".
  const conta = (it: RibbonItem, n: number | undefined): RibbonItem =>
    n === undefined || it.kind !== "button" ? it : { ...it, label: `${it.label} (${n})` };
  const filtriAlleati: RibbonGroup = { id: "filtri-alleati", label: L("r2GrpFilters"), icon: Funnel, priority: 3, rows: [[
    conta(tasto("militari", { attivo: a.militari, cambia: a.cambiaMilitari }, Swords, "r2AllyTypeMil", "r2AllyMilTitle"), a.conteggi?.militari),
    conta(tasto("scienza", { attivo: a.scienza, cambia: a.cambiaScienza }, FlaskConical, "r2AllyTypeSci", "r2AllySciTitle"), a.conteggi?.scienza),
    ...(a.frammenti ? [conta(tasto("frammenti", a.frammenti, Puzzle, "r2AllyFragments", "r2AllyFragmentsTitle"), a.conteggi?.frammenti)] : []),
  ]] };
  const vistaAlleati: RibbonGroup = { id: "vista-alleati", label: L("r2GrpViewRarity"), icon: Eye, rows: [[
    { kind: "custom", id: "rarita", render: () => <BloccoRarita rarita={a.rarita} /> },
  ]] };
  // Opzioni della tabella (2.0): Somma statistiche; nelle tabelle edifici
  // anche l'Export CSV degli edifici selezionati (grigio senza selezione).
  const opzioniTabella: RibbonGroup = { id: "opzioni-tabella", label: L("r2GrpTableOptions"), icon: SlidersHorizontal, rows: [[
    interruttore("somme", Sigma, "r2Sums", "r2SumsTitle"),
  ]] };
  const opzioniEdifici: RibbonGroup = { ...opzioniTabella, rows: [[...opzioniTabella.rows[0]!,
    { kind: "button", id: "esporta", icon: Download, label: c.esporta.n ? `${L("r2Export")} (${c.esporta.n})` : L("r2Export"),
      title: c.esporta.titolo, onClick: c.esporta.onClick, disabled: c.esporta.n === 0 },
  ]] };
  // "Nascondi / Mostra solo" (2.0): ogni voce gira su tre stati con un clic:
  // tutti → nascosti (rosso) → solo questi (verde) → tutti.
  const tri3 = (v: keyof ContestoNastri["tri"]["stati"], icon: LucideIcon, etichetta: Parameters<typeof t>[0]): RibbonItem => {
    const stato = c.tri.stati[v];
    return {
      kind: "button", id: `tri-${v}`, icon, label: L(etichetta), onClick: () => c.tri.gira(v),
      active: stato !== 0, danger: stato === 1, success: stato === 2,
      title: `${L(etichetta)}: ${L(stato === 1 ? "r2TriHidden" : stato === 2 ? "r2TriOnly" : "r2TriAll")}`,
    };
  };
  const nascondiMostra = (extra: RibbonItem[] = []): RibbonGroup => ({ id: "nascondi", label: L("r2GrpHideShow"), icon: EyeOff, rows: [[
    tri3("nonAcc", ZapOff, "r2NonRush"),
    tri3("autoAge", ChevronsUp, "r2AutoAge"),
    tri3("limitati", Clock4, "r2Limited"),
    tri3("iq", Atom, "r2HideIq"),
    tri3("alleati", Users, "r2HideAlly"),
    tri3("frammenti", Puzzle, "r2CatFragments"),
    ...extra,
  ]] });
  const vista = (extra: RibbonItem[] = []): RibbonGroup => ({ id: "vista", label: L("r2GrpView"), icon: Eye, rows: [[...vistaBase, ...extra]] });

  switch (scheda) {
    case "database": {
      const catalogo: RibbonGroup = { id: "catalogo", label: L("r2GrpCatalog"), icon: Building, priority: 1, rows: [[
        { kind: "button", id: "edifici", icon: Building, label: L("r2Buildings"), active: c.catalogo === "edifici", onClick: () => c.setCatalogo("edifici") },
        { kind: "button", id: "alleati", icon: Users, label: L("r2AlliesCat"), active: c.catalogo === "alleati", onClick: () => c.setCatalogo("alleati") },
        { kind: "button", id: "ge", icon: Landmark, label: L("r2GreatBuildings"), disabled: true, title: inArrivo },
      ]] };
      if (c.catalogo === "alleati") return [catalogo, ricerca, filtriAlleati, vistaAlleati, opzioniTabella];
      return [catalogo, ricerca, filtri, vista(), nascondiMostra(), opzioniEdifici];
    }
    case "citta": {
      const k = c.citta;
      return [
        ricerca,
        filtri,
        vista([
          tasto("inventario", k.inventario, PackagePlus, "r2PlusInv", "showInventoryInCityTitle"),
        ]),
        opzioniEdifici,
        { id: "statistiche", label: L("r2GrpStats"), icon: ChartColumn, priority: 1, rows: [[
          tasto("strade", k.statistiche.strade, Route, "r2StatRoads", "roadEfficiencyTitle"),
          tasto("produzione", k.statistiche.produzione, Factory, "r2StatProd"),
          tasto("militari", k.statistiche.militari, Swords, "r2StatMil"),
          tasto("era", k.statistiche.era, TrendingUp, "r2StatEra", "outdatedSummaryButtonTitle"),
          tasto("aggiornabili", k.statistiche.aggiornabili, ArrowBigUpDash, "r2Upgradable", "r2UpgradableTitle"),
        ]] },
        nascondiMostra([
          tri3("aiuto", LifeBuoy, "r2HideAid"),
          tri3("immagazzina", Archive, "r2HideStore"),
          tri3("ge", Landmark, "r2GreatBuildings"),
        ]),
        { id: "strumenti", label: L("r2GrpTools"), icon: MapIcon, rows: [[
          { kind: "button", id: "mappa", icon: MapIcon, label: L("r2Map"), active: c.mappa, onClick: c.onMappa, disabled: !c.haCitta },
          { kind: "button", id: "esporta-json", icon: FileJson, label: L("r2ExportCityJson"), title: L("r2ExportCityJsonTitle"), onClick: k.onEsportaJson, disabled: !c.haCitta },
          tasto("debug", c.debug, Bug, "r2Debug"),
        ]] },
      ];
    }
    case "inventario":
      return [ricerca, filtri, vista(), nascondiMostra(), opzioniEdifici, { id: "strumenti", label: L("r2GrpTools"), icon: Bug, rows: [[
        tasto("debug", c.debug, Bug, "r2Debug"),
      ]] }];
    case "alleati":
      return [ricerca, filtriAlleati, vistaAlleati, {
        ...opzioniTabella, rows: [[...opzioniTabella.rows[0]!, tasto("livello100", c.livello100, UserCheck, "r2Level100", "r2Level100Title")]],
      }, { id: "analisi", label: L("r2GrpAnalysis"), icon: ChartColumn, rows: [[
        { kind: "button", id: "consigliere", icon: Lightbulb, label: L("r2Advisor"), title: L(c.consigliere.disponibile ? "r2AdvisorTitle" : "r2AdvisorNeedWand"),
          active: c.consigliere.attivo && c.consigliere.disponibile, onClick: c.consigliere.cambia, disabled: !c.consigliere.disponibile },
      ]] }];
    case "insediamenti":
      // Tipo di insediamento: per ora solo i Pirati (gli altri arriveranno).
      return [{ id: "insediamento", label: L("r2GrpSettlement"), icon: Anchor, priority: 1, rows: [[
        { kind: "button", id: "pirati", icon: Anchor, label: L("r2Pirates"), active: true },
      ]] }, ...c.insediamenti.gruppi];
    case "planner": {
      const p = c.planner;
      return [{ id: "sorgente", label: L("r2GrpSource"), icon: Building2, priority: 4, rows: [[
        { kind: "button", id: "citta", icon: Building2, label: L("r2SelectedCity"), active: p.sorgente === "citta",
          disabled: !p.haCitta, title: p.haCitta ? undefined : L("r2NeedCity"), onClick: () => p.setSorgente("citta") },
        // Con un JSON caricato il pulsante ne mostra il nome anche quando si
        // guarda la città selezionata: un clic ci torna (senza riaprire il file);
        // già sul JSON, un clic ne sceglie un altro. La X solo sul JSON attivo.
        { kind: "button", id: "json", icon: FileUp, label: p.jsonNome ?? L("r2ImportJson"),
          active: p.sorgente === "json", title: L("r2PlJsonTitle"),
          onClick: p.jsonNome && p.sorgente !== "json" ? () => p.setSorgente("json") : p.onImportaJson,
          ...(p.jsonNome && p.sorgente === "json" ? { onClose: p.onChiudiJson, closeTitle: L("r2PlJsonClose") } : {}) },
      ]] }, ...p.gruppi];
    }
    case "opzioni":
      return [{ id: "citta", label: L("r2GrpSavedCities"), icon: Building2, priority: 1, rows: [[
        { kind: "button", id: "importa-json", icon: FileJson, label: L("r2ImportCityJson"), title: L("r2ImportCityJsonTitle"), onClick: c.onImportaCittaJson },
        { kind: "button", id: "elimina", icon: Trash2, label: L("r2DeleteAll"), onClick: c.onEliminaTutte, disabled: !c.haCitteSalvate, danger: true },
      ]] }, { id: "backup", label: L("r2GrpBackup"), icon: Download, priority: 1, rows: [[
        { kind: "button", id: "esporta", icon: Download, label: L("r2ExportAll"), onClick: c.onEsporta, disabled: !c.haCitteSalvate },
        { kind: "button", id: "ripristina", icon: Upload, label: L("r2Restore"), onClick: c.onRipristina },
      ]] }, { id: "pesi", label: L("r2GrpWeights"), icon: Scale, priority: 2, rows: [[
        { kind: "custom", id: "pesi", render: () => <BloccoPesi s={c.pesi} /> },
      ]] }, { id: "tema", label: L("r2GrpTheme"), icon: Moon, rows: [[
        { kind: "button", id: "scuro", icon: Moon, label: L("r2Dark"), active: c.tema === "dark", onClick: () => c.setTema("dark") },
        { kind: "button", id: "chiaro", icon: Sun, label: L("r2Light"), active: c.tema === "light", onClick: () => c.setTema("light") },
      ]] }];
    case "guida":
      return [
        { id: "impara", label: L("r2GrpLearn"), icon: BookOpen, rows: [[
          { kind: "button", id: "guida", icon: BookOpen, label: L("r2Guide"), onClick: () => window.open(c.uiLang === "it" ? "/guida.html" : "/guide.html", "_blank", "noopener") },
          { kind: "button", id: "bacchetta", icon: Wand2, label: L("r2Bookmarklet"), onClick: c.onAiutoBacchetta },
        ]] },
        { id: "info", label: L("r2GrpInfo"), icon: Info, rows: [[
          { kind: "button", id: "info", icon: Info, label: L("r2About"), onClick: c.onInformazioni },
        ]] },
      ];
  }
}
