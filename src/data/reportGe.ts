// ─────────────────────────────────────────────────────────────────────────────
//  data/reportGe.ts — Report di un Grande Edificio (novembre 2026)
//
//  Dati: i valori livello per livello della wiki ufficiale
//  (public/data/ge-livelli/<id>.json, RECUPERO DATI/wiki_ge.py, scaricati con
//  datiGioco.caricaLivelliGe solo aprendo il report). Qui: nomi delle colonne
//  (icone della wiki) in italiano/inglese, quali sono percentuali, e la quota
//  del proprietario con la chat (stesse regole del Calcolatore GE,
//  public/calcolatore/calcolatore.js): Rame 100% sui livelli Rame, Oro 20%
//  sui livelli Oro (utente).
// ─────────────────────────────────────────────────────────────────────────────

import type { LivelliGe } from "./datiGioco";
import type { UiLang } from "./ui-strings";

type Nome = [it: string, en: string];

/** icon_great_building_bonus_<x> → nome. */
const RISORSE: Record<string, Nome> = {
  coins: ["Monete", "Coins"], supplies: ["Materiali", "Supplies"], goods: ["Beni", "Goods"],
  guild_goods: ["Beni di gilda", "Guild goods"], guild_goods_adjacent_era: ["Beni di gilda (3 ere)", "Guild goods (3 ages)"],
  forgepoints: ["Punti Forge", "Forge Points"], medals: ["Medaglie", "Medals"], happy: ["Felicità", "Happiness"],
  population: ["Popolazione", "Population"], penal_unit: ["Unità penali", "Penal units"],
  previous_era_good_production: ["Beni dell'era precedente", "Previous age goods"], special_goods: ["Beni speciali", "Special goods"],
  special_goods_production_boost: ["Produzione beni speciali", "Special goods production"], goods_production_boost: ["Produzione beni", "Goods production"],
  age_reserves: ["Riserve di beni", "Goods reserves"],
  contribution_boost: ["Bonus contributo (Rame)", "Contribution bonus (Copper)"], contribution_boost_gold: ["Bonus contributo (Oro)", "Contribution bonus (Gold)"],
  critical_hit_chance: ["Colpo critico", "Critical hit"], all_units_critical_hit_chance: ["Colpo critico (tutte le ere)", "Critical hit (all ages)"],
  helping_hands: ["Mani amiche", "Helping hands"], helping_hands_boosted: ["Mani amiche migliorate", "Improved helping hands"],
  military_ally_boost: ["Livelli alleati militari", "Military ally levels"], science_ally_boost: ["Livelli alleati scienza", "Science ally levels"],
  aid_blueprints: ["Progetti dagli aiuti", "Blueprints from aiding"], aid_goods: ["Beni per bene", "Goods for good"],
  plunder_and_pillage: ["Saccheggio raddoppiato", "Plunder and pillage"], plunder_goods: ["Saccheggia beni", "Plunder goods"],
  plunder_repel: ["Respingi saccheggi", "Plunder repel"], relic_hunt: ["Reliquie", "Relics"], mysterious_shards: ["Schegge misteriose", "Mysterious shards"],
  algorithmic_core: ["Nucleo I.A.", "A.I. Core"], diplomatic_gifts: ["Regali diplomatici", "Diplomatic gifts"],
  double_collect: ["Doppio incasso", "Double collection"], guild_raids_double_collection: ["Doppio incasso IQ", "QI double collection"],
  first_strike: ["Primo colpo", "First strike"], second_strike: ["Secondo colpo", "Second strike"],
  missile_launch: ["Lancio missilistico", "Missile launch"], missile_launch_wave_2: ["Lancio missilistico (2ª ondata)", "Missile launch (2nd wave)"],
  spoils_of_war: ["Bottino di guerra", "Spoils of war"], spoils_of_war_enhanced: ["Bottino di guerra migliorato", "Enhanced spoils of war"],
  scroll: ["Ricompense delle missioni", "Quest rewards"], scroll_2: ["Ricompense Taverna Eroica", "Heroic Tavern rewards"],
};
/** suffissi delle colonne a due valori (wiki: "#" e "%") e simili */
const SUFFISSI: Record<string, Nome> = {
  n: ["numero", "count"], pct: ["percentuale", "percent"], goods: ["beni", "goods"], rare_totem: ["rara", "rare"], rare_reward: ["rara", "rare"],
};
/** Bonus (non militari) espressi in percentuale. */
const PERCENTUALI = new Set(["special_goods_production_boost", "goods_production_boost", "contribution_boost", "contribution_boost_gold",
  "critical_hit_chance", "all_units_critical_hit_chance", "helping_hands", "helping_hands_boosted", "aid_blueprints", "plunder_and_pillage",
  "scroll", "scroll_2"]);

export interface ColonnaGe {
  chiave: string;
  nome: string;
  /** valore in punti percentuali (mostrato con "%") */
  perc: boolean;
  /** moltiplicativo (tier Oro dei GE Prestige): "×" */
  molt: boolean;
}

/** Nome leggibile e tipo di una colonna della wiki. */
export function colonnaGe(chiave: string, lang: UiLang): ColonnaGe {
  const L = lang === "en" ? 1 : 0;
  // militari: <att_def|att|def>_boost_<attacker|defender|attacker_defender>[_<gbg|gex|gr>][_multiplier]
  const m = /^(att_def|att|def)_boost_(attacker_defender|attacker|defender)(?:_(gbg|gex|gr))?(_multiplier)?$/.exec(chiave);
  if (m) {
    const tipo: Record<string, Nome> = { att_def: ["Attacco e difesa", "Attack and defense"], att: ["Attacco", "Attack"], def: ["Difesa", "Defense"] };
    const lato: Record<string, Nome> = { attacker: ["attaccante", "attacking army"], defender: ["difensore", "defending army"], attacker_defender: ["entrambi gli eserciti", "both armies"] };
    const modo: Record<string, Nome> = { gbg: ["Campi", "Battlegrounds"], gex: ["Spedizioni", "Expedition"], gr: ["Incursioni", "Quantum Incursions"] };
    const nome = `${tipo[m[1]!]![L]} ${lato[m[2]!]![L]}${m[3] ? ` – ${modo[m[3]]![L]}` : ""}${m[4] ? " (×)" : ""}`;
    return { chiave, nome, perc: true, molt: !!m[4] };
  }
  const r = /^icon_great_building_bonus_(.+)$/.exec(chiave);
  if (r) {
    const x = r[1]!;
    if (RISORSE[x]) return { chiave, nome: RISORSE[x]![L], perc: PERCENTUALI.has(x), molt: false };
    const s = /^(.+?)_(n|pct|goods|rare_totem|rare_reward)$/.exec(x);
    if (s && RISORSE[s[1]!]) return { chiave, nome: `${RISORSE[s[1]!]![L]}: ${SUFFISSI[s[2]!]![L]}`, perc: ["pct", "rare_totem", "rare_reward"].includes(s[2]!), molt: false };
    return { chiave, nome: x.replace(/_/g, " "), perc: false, molt: false };
  }
  return { chiave, nome: chiave.replace(/_/g, " "), perc: false, molt: false };
}

// ── quota del proprietario (come il Calcolatore GE) ──
const FASCE: Array<[number, number]> = [[9, .25], [39, .30], [69, .40], [100, .25], [200, .15], [300, .10], [400, .07], [500, .05]];
const QUOTE: Record<5 | 7, number[]> = { 5: [120, 60, 20, 5, 1].map(x => x / 206), 7: [5040, 2520, 840, 210, 42, 7, 1].map(x => x / 8660) };
/** PF a carico del proprietario per completare il livello `lvl` (costo `costo`)
 *  con la chat: Rame 100% sui livelli Rame, Oro 20% sui livelli Oro (GE Oro: 7 posti dal 101,
 *  ma il 101 si fa ancora a tariffa Rame perché il GE è al 100, ancora Rame; utente 09/11). */
export function pfProprietario(costo: number, lvl: number, oro: boolean): number {
  const quota = (FASCE.find(f => lvl <= f[0]) ?? FASCE[FASCE.length - 1]!)[1];
  const n: 5 | 7 = oro && lvl >= 101 ? 7 : 5, perc = n === 7 && lvl > 101 ? 20 : 100;
  let somma = 0;
  for (const q of QUOTE[n]) {
    let base = Math.round(costo * quota * q);
    if (base === 1 || base === 3) base += 1; // (ricompense piccole pari, come il gioco)
    somma += Math.round(base * (1 + perc / 100));
  }
  return costo - Math.min(costo, somma);
}

export interface LivelloReport { lvl: number; costo: number; tuoi: number; cumTot: number; cumTuoi: number; v: number[] }
export interface Report {
  colonne: ColonnaGe[];
  livelli: LivelloReport[];
  /** per colonna: massimo, livello in cui lo raggiunge, se è un bonus del tier Oro */
  info: Array<{ max: number; lmax: number; oro: boolean }>;
}

/** Livelli con costo, quota tua e cumulati; colonne dei bonus (senza i PF). */
export function preparaReport(d: LivelliGe, geOro: boolean, lang: UiLang): Report | null {
  const ip = d.colonne.indexOf("strategy_points");
  if (ip < 0 || !d.righe.length) return null;
  const idx = d.colonne.map((_, i) => i).filter(i => i !== ip);
  let cumTot = 0, cumTuoi = 0;
  const livelli = d.righe.map((r, i) => {
    const lvl = i + 1, costo = r[ip] ?? 0, tuoi = pfProprietario(costo, lvl, geOro);
    cumTot += costo; cumTuoi += tuoi;
    return { lvl, costo, tuoi, cumTot, cumTuoi, v: idx.map(j => r[j] ?? 0) };
  });
  const colonne = idx.map(j => colonnaGe(d.colonne[j]!, lang));
  const info = colonne.map((_, k) => {
    const vals = livelli.map(l => l.v[k]!);
    const max = Math.max(...vals);
    const lmax = (livelli.find(l => l.v[k] === max) ?? livelli[0]!).lvl;
    // tier Oro: GE Oro e sempre 0 fino al 100
    const oro = geOro && livelli.slice(0, 100).every(l => !l.v[k]) && max > 0;
    return { max, lmax, oro };
  });
  return { colonne, livelli, info };
}
