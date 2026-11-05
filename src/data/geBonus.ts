// ─────────────────────────────────────────────────────────────────────────────
//  data/geBonus.ts — Grandi Edifici dopo il Prestige (novembre 2026)
//
//  Tipi di ge.json (RECUPERO DATI/ge.py) e nomi leggibili dei 61 tipi di bonus
//  dei GE (elenco completo: RECUPERO DATI/GE_PRESTIGE_BONUS.md). I valori
//  esistono solo ai livelli del MainParser (1/101/201/301/401/500 per i GE
//  Oro, 1/101/200 per i solo Rame): mai interpolare, la crescita non è lineare.
// ─────────────────────────────────────────────────────────────────────────────

import type { UiLang } from "./ui-strings";
import { formatInt } from "../utils/format";

export interface BonusGe {
  tipo: string;
  modalita: string;
  moltiplicativo?: boolean;
  produzione?: boolean;
  /** livello → valore (solo i livelli del MainParser) */
  valori: Record<string, number>;
  /** livello → usi (battaglie/raccolte), solo per i bonus a usi limitati */
  usi?: Record<string, number>;
}
export interface Ge {
  nome: { it: string; en: string };
  era: string;
  w: number;
  h: number;
  tierMax: "gold" | "copper";
  tier: { copper?: BonusGe[]; gold?: BonusGe[] };
}
export interface DatiGe { versione: number; edifici: Record<string, Ge> }

/** Controllo minimo della forma di ge.json (null = non valido). */
export function leggiGe(d: unknown): DatiGe | null {
  const o = d as Partial<DatiGe> | null;
  return o && typeof o === "object" && o.edifici && typeof o.edifici === "object" ? o as DatiGe : null;
}

const NOMI: Record<string, [string, string]> = {
  military_boost: ["Attacco e difesa esercito attaccante", "Attacking army attack and defense"],
  fierce_resistance: ["Attacco e difesa esercito in difesa", "Defending army attack and defense"],
  advanced_tactics: ["Attacco e difesa di entrambi gli eserciti", "Attack and defense of both armies"],
  attack_boost: ["Attacco esercito attaccante", "Attacking army attack"],
  attacker_defense_boost: ["Difesa esercito attaccante", "Attacking army defense"],
  defender_attack_boost: ["Attacco esercito in difesa", "Defending army attack"],
  defense_boost: ["Difesa esercito in difesa", "Defending army defense"],
  happiness: ["Felicità", "Happiness"],
  population: ["Popolazione", "Population"],
  strategy_points: ["Punti Forge", "Forge Points"],
  money: ["Monete", "Coins"],
  supplies: ["Materiali", "Supplies"],
  medals: ["Medaglie", "Medals"],
  random_goods: ["Beni casuali", "Random goods"],
  previous_era_goods: ["Beni dell'era precedente", "Previous era goods"],
  special_goods: ["Beni speciali", "Special goods"],
  clan_goods: ["Beni di gilda", "Guild goods"],
  clan_goods_extended: ["Beni di gilda di 3 ere", "Guild goods of 3 eras"],
  age_reserves: ["Riserve di beni", "Goods reserves"],
  penal_unit: ["Unità di galeotti", "Penal units"],
  money_boost: ["Monete in più", "Extra coins"],
  supplies_boost: ["Materiali in più", "Extra supplies"],
  goods_production_boost: ["Produzione di beni", "Goods production"],
  special_goods_production_boost: ["Produzione di beni speciali", "Special goods production"],
  military_ally_boost: ["Alleati militari", "Military allies"],
  science_ally_boost: ["Alleati scienza", "Science allies"],
  contribution_boost: ["Bonus di contributo", "Contribution boost"],
  contribution_boost_gold: ["Bonus di contributo Oro", "Gold contribution boost"],
  aid_boost: ["Aiuti: monete in più", "Aid: extra coins"],
  aid_goods: ["Aiuti: beni", "Aid: goods"],
  helping_hands: ["Mani amiche", "Helping hands"],
  helping_hands_boosted: ["Mani amiche migliorate", "Improved helping hands"],
  critical_hit_chance: ["Colpo critico", "Critical hit"],
  all_units_critical_hit_chance: ["Colpo critico potenziato", "Enhanced critical hit"],
  first_strike: ["Primo colpo", "First strike"],
  second_strike: ["Secondo colpo", "Second strike"],
  missile_launch: ["Lancio di missili", "Missile launch"],
  missile_launch_wave_2: ["Lancio di missili, 2ª ondata", "Missile launch, second wave"],
  double_collection: ["Raccolta doppia", "Double collection"],
  guild_raids_double_collection: ["Raccolta doppia nell'IQ", "QI double collection"],
  spoils_of_war: ["Bottino di guerra", "Spoils of war"],
  spoils_of_war_enhanced: ["Bottino di guerra migliorato", "Enhanced spoils of war"],
  quest_boost: ["Missioni: ricompense in più", "Quests: extra rewards"],
  allies_quest_boost: ["Taverna eroica: ricompense in più", "Heroic Tavern: extra rewards"],
  plunder_and_pillage: ["Saccheggio", "Plunder and pillage"],
  plunder_goods: ["Saccheggio di beni", "Plunder goods"],
  plunder_repel: ["Respingi saccheggi", "Repel plunder"],
  diplomatic_gifts: ["Doni diplomatici", "Diplomatic gifts"],
  totem_drop: ["Totem", "Totems"],
  algorithmic_core: ["Nucleo algoritmico", "Algorithmic core"],
  mysterious_shards: ["Frammenti misteriosi", "Mysterious shards"],
};

/** Bonus espressi in percentuale. */
const PERCENTUALI = new Set([
  "military_boost", "fierce_resistance", "advanced_tactics", "attack_boost", "attacker_defense_boost",
  "defender_attack_boost", "defense_boost", "money_boost", "supplies_boost", "goods_production_boost",
  "special_goods_production_boost", "contribution_boost", "contribution_boost_gold", "critical_hit_chance",
  "all_units_critical_hit_chance", "first_strike", "second_strike", "missile_launch", "missile_launch_wave_2",
  "double_collection", "guild_raids_double_collection", "spoils_of_war", "spoils_of_war_enhanced",
  "quest_boost", "allies_quest_boost",
]);

export function nomeBonusGe(tipo: string, lang: UiLang): string {
  const n = NOMI[tipo];
  return n ? n[lang === "en" ? 1 : 0] : tipo;
}

export function modalitaGe(m: string, lang: UiLang): string {
  const it: Record<string, string> = { battleground: "Campi", guild_expedition: "Spedizioni", guild_raids: "IQ" };
  const en: Record<string, string> = { battleground: "Battlegrounds", guild_expedition: "Expeditions", guild_raids: "QI" };
  return (lang === "en" ? en : it)[m] ?? "";
}

/** Valore leggibile: "×7%" per i moltiplicativi, "320%" per le percentuali,
 *  numero con separatore per le quantità. */
export function valoreGe(b: BonusGe, v: number, lang: UiLang): string {
  // (formatInt: l'italiano di Intl non separa i numeri di 4 cifre)
  const n = lang === "en" ? v.toLocaleString("en-US") : formatInt(v);
  if (b.moltiplicativo) return `×${n}%`;
  return PERCENTUALI.has(b.tipo) ? `${n}%` : n;
}

/** Livelli scelti col selettore del Catalogo (quelli del MainParser). */
export const LIVELLI_GE = [1, 101, 201, 301, 401, 500] as const;

/** Colonne militari: bonus → indici (Att/Att, Dif/Att, Att/Dif, Dif/Dif),
 *  come GB_MILITARY_SLOTS di BuildingModel. */
const SLOT: Record<string, number[]> = {
  military_boost: [0, 1], fierce_resistance: [2, 3], advanced_tactics: [0, 1, 2, 3],
  attack_boost: [0], attacker_defense_boost: [1], defender_attack_boost: [2], defense_boost: [3],
};

type Quattro = [number, number, number, number];
export interface StatisticheGe {
  /** Livello effettivo (i GE solo Rame si fermano al 200). */
  livello: number;
  tier: "oro" | "rame";
  pop: number; fel: number; fp: number; beni: number; benip: number; benig: number; benisp: number;
  mon: number; mat: number; med: number; tr: number;
  general: Quattro; gbg: Quattro; sped: Quattro; iq: Quattro;
  /** Moltiplicativi, +% di produzione, boost alleati (tooltip ×, come in Città). */
  gbMoltiplicativi: Array<{ tipo: string; modalita: string; valore: number }>;
  /** Altri bonus senza colonna (meccaniche: colpo critico, raccolta doppia…), già leggibili. */
  gbAltri: string[];
}

/** Statistiche di un GE a un livello del selettore: somma dei bonus di tutti i
 *  tier attivi (Rame sempre, Oro dal 101), con gli stessi criteri dell'import
 *  della città (BuildingModel.fromGreatBuilding): clan_goods ×5,
 *  clan_goods_extended ×15, age_reserves → Beni, galeotti → truppe. */
export function statisticheGe(ge: Ge, livelloScelto: number, lang: UiLang): StatisticheGe {
  const livello = ge.tierMax === "gold" ? livelloScelto : Math.min(livelloScelto, 200);
  const out: StatisticheGe = {
    livello, tier: ge.tierMax === "gold" && livello >= 101 ? "oro" : "rame",
    pop: 0, fel: 0, fp: 0, beni: 0, benip: 0, benig: 0, benisp: 0, mon: 0, mat: 0, med: 0, tr: 0,
    general: [0, 0, 0, 0], gbg: [0, 0, 0, 0], sped: [0, 0, 0, 0], iq: [0, 0, 0, 0],
    gbMoltiplicativi: [], gbAltri: [],
  };
  for (const b of [...(ge.tier.copper ?? []), ...(ge.tier.gold ?? [])]) {
    const v = b.valori[String(livello)] ?? 0;
    if (!v) continue;
    const slot = SLOT[b.tipo];
    if (slot && !b.moltiplicativo) {
      const col = b.modalita === "battleground" ? out.gbg : b.modalita === "guild_expedition" ? out.sped
        : b.modalita === "guild_raids" ? out.iq : b.modalita === "all" ? out.general : null;
      if (col) for (const i of slot) col[i] += v;
      continue;
    }
    if (slot || b.tipo.endsWith("_production_boost") || b.tipo.endsWith("_ally_boost")) {
      out.gbMoltiplicativi.push({ tipo: b.tipo, modalita: b.modalita, valore: v });
      continue;
    }
    switch (b.tipo) {
      case "happiness": out.fel += v; break;
      case "population": out.pop += v; break;
      case "strategy_points": out.fp += v; break;
      case "random_goods": case "age_reserves": out.beni += v; break;
      case "previous_era_goods": out.benip += v; break;
      case "special_goods": out.benisp += v; break;
      case "clan_goods": out.benig += v * 5; break;
      case "clan_goods_extended": out.benig += v * 15; break;
      case "money": out.mon += v; break;
      case "supplies": out.mat += v; break;
      case "medals": out.med += v; break;
      case "penal_unit": out.tr += v; break;
      default: {
        const u = b.usi?.[String(livello)], mod = modalitaGe(b.modalita, lang);
        out.gbAltri.push(`• ${nomeBonusGe(b.tipo, lang)}${mod ? ` (${mod})` : ""}: ${valoreGe(b, v, lang)}${u !== undefined ? ` (${u})` : ""}`);
      }
    }
  }
  return out;
}
