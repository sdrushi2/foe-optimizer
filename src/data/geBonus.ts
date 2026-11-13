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

interface BonusGe {
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
  algorithmic_core: ["Beni speciali in più (Nucleo I.A.)", "Extra Special Goods (A.I. Core)"],
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

function nomeBonusGe(tipo: string, lang: UiLang): string {
  const n = NOMI[tipo];
  return n ? n[lang === "en" ? 1 : 0] : tipo;
}

function modalitaGe(m: string, lang: UiLang): string {
  const it: Record<string, string> = { battleground: "Campi", guild_expedition: "Spedizioni", guild_raids: "IQ" };
  const en: Record<string, string> = { battleground: "Battlegrounds", guild_expedition: "Expeditions", guild_raids: "QI" };
  return (lang === "en" ? en : it)[m] ?? "";
}

/** Valore leggibile: "+7%" per i moltiplicativi (come nel gioco), "320%" per le percentuali,
 *  numero con separatore per le quantità. */
function valoreGe(b: BonusGe, v: number, lang: UiLang): string {
  // (formatInt: l'italiano di Intl non separa i numeri di 4 cifre)
  const n = lang === "en" ? v.toLocaleString("en-US") : formatInt(v);
  if (b.moltiplicativo) return `+${n}%`;
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
/** Bonus di produzione → colonna della tabella (per le colonne "solo Oro"). */
const COLONNA: Record<string, string> = {
  happiness: "fel", population: "pop", strategy_points: "fp", random_goods: "beni", age_reserves: "beni",
  previous_era_goods: "benip", special_goods: "benisp", clan_goods: "benig", clan_goods_extended: "benig",
  money: "mon", supplies: "mat", medals: "med", penal_unit: "tr",
  goods_production_boost: "benib", special_goods_production_boost: "benispb",
};
export interface StatisticheGe {
  /** Livello effettivo (i GE solo Rame si fermano al 200). */
  livello: number;
  tier: "oro" | "rame";
  pop: number; fel: number; fp: number; beni: number; benip: number; benig: number; benisp: number;
  mon: number; mat: number; med: number; tr: number;
  /** +% produzione di beni / beni speciali (frazione, come le colonne BeniB / BeniSpB). */
  benib: number; benispb: number;
  general: Quattro; gbg: Quattro; sped: Quattro; iq: Quattro;
  /** Moltiplicativi, +% di produzione, boost alleati (tooltip ×, come in Città). */
  gbMoltiplicativi: Array<{ tipo: string; modalita: string; valore: number }>;
  /** Altri bonus senza colonna (meccaniche: colpo critico, raccolta doppia…), già leggibili. */
  gbAltri: string[];
  /** Colonne di produzione con valore SOLO da bonus Oro (in tabella in oro). */
  gbColonneOro: string[];
  /** Tempio delle Reliquie: % di trovare una reliquia e % che sia rara. */
  gbReliquie?: { probabilita: number; rara: number };
  /** Colpo critico: Rame (stessa era) e Oro (tutte le altre ere). */
  gbCritico?: { rame: number; oro: number };
  /** Torre di Galata: % di respingere un saccheggio e tentativi respingibili. */
  gbRespingi?: { probabilita: number; tentativi: number };
  /** Deposito di sementi: mani amiche (Rame) e migliorate (Oro). */
  gbManiAmiche?: { rame: number; oro: number };
  /** Arca / Sifone: bonus di contributo Rame e Oro. */
  gbContributo?: { rame: number; oro: number };
  /** Progetto Foresta Pluviale: % in più di probabilità di un progetto aiutando. */
  gbProgettiAiuti?: number;
  /** Museo di Atlantide: % di saccheggio raddoppiato e moltiplicatore. */
  gbSaccheggio?: { probabilita: number; moltiplicatore: number };
  /** Nucleo I.A.: % di beni speciali in più per le prime N raccolte. */
  gbNucleoIA?: { percentuale: number; raccolte: number };
  /** San Marco / Royal Albert Hall / Faro: % in più su monete / materiali delle prime N raccolte. */
  gbBoostRaccolte?: { monete?: { percentuale: number; raccolte: number }; materiali?: { percentuale: number; raccolte: number } };
  /** Castello di Himeji: bottino di guerra (Rame) e migliorato (Oro). */
  gbBottino?: { rame?: { probabilita: number; battaglie: number }; oro?: { probabilita: number; battaglie: number } };
  /** Château Frontenac: % in più sulle ricompense delle missioni (Rame) e della Taverna Eroica (Oro). */
  gbMissioni?: { rame: number; oro: number };
  /** Kraken: primo colpo (Rame, 1ª ondata) e secondo colpo (Oro, 2ª ondata). */
  gbColpo?: { rame?: { probabilita: number; battaglie: number }; oro?: { probabilita: number; battaglie: number } };
  /** Torre della tregua: beni casuali per le prime N assistenze. */
  gbBeniAiuti?: { beni: number; volte: number };
  /** Voyager V1: beni casuali in più per i primi N saccheggi. */
  gbSaccheggiaBeni?: { beni: number; volte: number };
  /** Isola volante: % di generare una Scheggia Premio negli insediamenti culturali ogni 4 ore e % che sia rara. */
  gbSchegge?: { probabilita: number; rara: number };
  /** Progetto della Vergine: lancio missilistico nella 1ª ondata (Rame) e nella 2ª (Oro). */
  gbMissili?: { rame?: { probabilita: number; battaglie: number }; oro?: { probabilita: number; battaglie: number } };
  /** Trasportatore spaziale: % di ricompensa casuale nelle prime N negoziazioni riuscite. */
  gbRegaliDiplomatici?: { probabilita: number; negoziazioni: number };
  /** Galassia blu: raccolta doppia in città (Rame) e nell'insediamento IQ (Oro). */
  gbRaccoltaDoppia?: { rame?: { probabilita: number; edifici: number }; oro?: { probabilita: number; edifici: number } };
}

/** Statistiche di un GE a un livello del selettore: somma dei bonus di tutti i
 *  tier attivi (Rame sempre, Oro dal 101), con gli stessi criteri dell'import
 *  della città (BuildingModel.fromGreatBuilding): clan_goods ×5,
 *  clan_goods_extended ×15, age_reserves → Beni, galeotti → truppe. */
export function statisticheGe(ge: Ge, livelloScelto: number, lang: UiLang): StatisticheGe {
  const livello = ge.tierMax === "gold" ? livelloScelto : Math.min(livelloScelto, 200);
  const out: StatisticheGe = {
    livello, tier: ge.tierMax === "gold" && livello >= 101 ? "oro" : "rame",
    pop: 0, fel: 0, fp: 0, beni: 0, benip: 0, benig: 0, benisp: 0, mon: 0, mat: 0, med: 0, tr: 0, benib: 0, benispb: 0,
    general: [0, 0, 0, 0], gbg: [0, 0, 0, 0], sped: [0, 0, 0, 0], iq: [0, 0, 0, 0],
    gbMoltiplicativi: [], gbAltri: [], gbColonneOro: [],
  };
  // colonne di produzione toccate dai bonus Rame e da quelli Oro
  const daRame = new Set<string>(), daOro = new Set<string>();
  const tutti = [...(ge.tier.copper ?? []).map(b => [b, false] as const), ...(ge.tier.gold ?? []).map(b => [b, true] as const)];
  for (const [b, oro] of tutti) {
    const v = b.valori[String(livello)] ?? 0;
    if (!v) continue;
    const col = COLONNA[b.tipo];
    if (col) (oro ? daOro : daRame).add(col);
    const slot = SLOT[b.tipo];
    if (slot && !b.moltiplicativo) {
      const col = b.modalita === "battleground" ? out.gbg : b.modalita === "guild_expedition" ? out.sped
        : b.modalita === "guild_raids" ? out.iq : b.modalita === "all" ? out.general : null;
      if (col) for (const i of slot) col[i] += v;
      continue;
    }
    if (b.tipo === "goods_production_boost") { out.benib += v / 100; continue; }
    if (b.tipo === "special_goods_production_boost") { out.benispb += v / 100; continue; }
    if (slot || b.tipo.endsWith("_ally_boost")) {
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
      // (Tempio delle Reliquie: usi = % di trovare la reliquia, valore = % che sia rara)
      case "totem_drop": out.gbReliquie = { probabilita: b.usi?.[String(livello)] ?? 0, rara: v }; break;
      case "aid_boost": out.gbProgettiAiuti = v; break;
      case "double_collection": if (v) out.gbRaccoltaDoppia = { ...out.gbRaccoltaDoppia, rame: { probabilita: v, edifici: b.usi?.[String(livello)] ?? 0 } }; break;
      case "guild_raids_double_collection": if (v) out.gbRaccoltaDoppia = { ...out.gbRaccoltaDoppia, oro: { probabilita: v, edifici: b.usi?.[String(livello)] ?? 0 } }; break;
      case "diplomatic_gifts": if (v) out.gbRegaliDiplomatici = { probabilita: v, negoziazioni: b.usi?.[String(livello)] ?? 0 }; break;
      case "missile_launch": if (v) out.gbMissili = { ...out.gbMissili, rame: { probabilita: v, battaglie: b.usi?.[String(livello)] ?? 0 } }; break;
      case "missile_launch_wave_2": if (v) out.gbMissili = { ...out.gbMissili, oro: { probabilita: v, battaglie: b.usi?.[String(livello)] ?? 0 } }; break;
      // (Isola volante: usi = % di generare la Scheggia, valore = % che sia rara, come le reliquie)
      case "mysterious_shards": out.gbSchegge = { probabilita: b.usi?.[String(livello)] ?? 0, rara: v }; break;
      case "plunder_goods": if (v) out.gbSaccheggiaBeni = { beni: v, volte: b.usi?.[String(livello)] ?? 0 }; break;
      case "aid_goods": if (v) out.gbBeniAiuti = { beni: v, volte: b.usi?.[String(livello)] ?? 0 }; break;
      case "first_strike": if (v) out.gbColpo = { ...out.gbColpo, rame: { probabilita: v, battaglie: b.usi?.[String(livello)] ?? 0 } }; break;
      case "second_strike": if (v) out.gbColpo = { ...out.gbColpo, oro: { probabilita: v, battaglie: b.usi?.[String(livello)] ?? 0 } }; break;
      case "quest_boost": if (v) out.gbMissioni = { rame: v, oro: out.gbMissioni?.oro ?? 0 }; break;
      case "allies_quest_boost": if (v) out.gbMissioni = { rame: out.gbMissioni?.rame ?? 0, oro: v }; break;
      case "spoils_of_war": if (v) out.gbBottino = { ...out.gbBottino, rame: { probabilita: v, battaglie: b.usi?.[String(livello)] ?? 0 } }; break;
      case "spoils_of_war_enhanced": if (v) out.gbBottino = { ...out.gbBottino, oro: { probabilita: v, battaglie: b.usi?.[String(livello)] ?? 0 } }; break;
      case "money_boost": if (v) out.gbBoostRaccolte = { ...out.gbBoostRaccolte, monete: { percentuale: v, raccolte: b.usi?.[String(livello)] ?? 0 } }; break;
      case "supplies_boost": if (v) out.gbBoostRaccolte = { ...out.gbBoostRaccolte, materiali: { percentuale: v, raccolte: b.usi?.[String(livello)] ?? 0 } }; break;
      case "algorithmic_core": out.gbNucleoIA = { percentuale: v, raccolte: b.usi?.[String(livello)] ?? 0 }; break;
      case "plunder_and_pillage": out.gbSaccheggio = { probabilita: v, moltiplicatore: b.usi?.[String(livello)] ?? 0 }; break;
      case "contribution_boost": out.gbContributo = { rame: v, oro: out.gbContributo?.oro ?? 0 }; break;
      case "contribution_boost_gold": out.gbContributo = { rame: out.gbContributo?.rame ?? 0, oro: v }; break;
      case "helping_hands": out.gbManiAmiche = { rame: v, oro: out.gbManiAmiche?.oro ?? 0 }; break;
      case "helping_hands_boosted": out.gbManiAmiche = { rame: out.gbManiAmiche?.rame ?? 0, oro: v }; break;
      case "plunder_repel": out.gbRespingi = { probabilita: v, tentativi: b.usi?.[String(livello)] ?? 0 }; break;
      case "critical_hit_chance": out.gbCritico = { rame: v, oro: out.gbCritico?.oro ?? 0 }; break;
      case "all_units_critical_hit_chance": out.gbCritico = { rame: out.gbCritico?.rame ?? 0, oro: v }; break;
      default: {
        const u = b.usi?.[String(livello)], mod = modalitaGe(b.modalita, lang);
        out.gbAltri.push(`• ${nomeBonusGe(b.tipo, lang)}${mod ? ` (${mod})` : ""}: ${valoreGe(b, v, lang)}${u !== undefined ? ` (${u})` : ""}`);
      }
    }
  }
  out.gbColonneOro = [...daOro].filter(c => !daRame.has(c));
  return out;
}
