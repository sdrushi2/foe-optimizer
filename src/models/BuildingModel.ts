import type { Building } from "../data/buildings";
// I tipi del payload di gioco vivono in data/bookmarklet.ts (sorgente di verità):
// definirne versioni locali creerebbe duplicati che divergono silenziosamente.
import type { CityMapEntry, CityEntityDefinition, BoostHint } from "../data/bookmarklet";
import { FALLBACK_ERA, AGE_BY_CODE, AGES_BY_ID } from "../data/ages";
import type { Lang } from "../data/languages";
import { isGreatBuildingId, isMilitaryBuildingId, isGoodsFactoryId } from "../data/buildingClassification";

/** Statistiche di un edificio estratte da CityEntities per una specifica era */
export interface EraStats {
  pop: number;
  fel: number;
  general: [number, number, number, number];
  gbg: [number, number, number, number];
  sped: [number, number, number, number];
  iq: [number, number, number, number];
  iqMonB: number;
  iqMatB: number;
  iqMon: number;
  iqMat: number;
  iqBeni: number;
  iqTruppe: number;
  iqAzioni: number;
  iqCap: number;
  // Produzioni (estratte per l'era corrente del giocatore, override completo).
  bp: number;       // blueprint
  fp: number;       // punti forge (strategy_points, boostabili)
  fpb: number;      // boost % produzione FP
  fur: number;      // furfanti (valore atteso)
  tr: number;       // truppe era attuale
  trne: number;     // truppe era successiva
  beni: number;     // beni era attuale
  benip: number;    // beni era precedente
  benis: number;    // beni era successiva
  benib: number;    // boost % beni
  benig: number;    // beni di gilda
  mon: number;      // monete prodotte giornalmente
  mat: number;      // materiali prodotti giornalmente
  fsp: number; tpm: number; tpb: number; adm: number; mod: number; rin: number; imm: number; // reward speciali (valore atteso frammenti)
}

export interface GreatBuilding {
  entityId: string;
  name: string;
  level: number;
  maxLevel: number;
  width: number;
  length: number;
  rawEntry: CityMapEntry;
}

// ── Forma (parziale) del payload grezzo di un GE ────────────────────────────
// Solo i campi effettivamente letti da fromGreatBuilding sono tipizzati; il
// resto del CityMapEntry resta libero. Mantenuti permissivi (campi opzionali)
// perché la struttura del gioco varia tra edifici ed ere.
interface GbBonus {
  type?: string;
  value?: number;
}

interface GbProduct {
  name?: string;
  amount?: number;
  goods?: Array<{ value?: number }>;
  product?: { resources?: Record<string, number> };
}

interface GbCurrentProduct {
  name?: string;
  products?: GbProduct[];
}

// Costanti globali al modulo per ottimizzare le performance (non ricreate ad ogni chiamata)
const BOOST_MAP: Record<string, Record<string, string[]>> = {
  "att_boost_attacker": { "all": ["GenAtk_A"], "battleground": ["CampiAtk_A"], "guild_expedition": ["SpedAtk_A"], "guild_raids": ["IQAtk_A"] },
  "def_boost_attacker": { "all": ["GenDef_A"], "battleground": ["CampiDef_A"], "guild_expedition": ["SpedDef_A"], "guild_raids": ["IQDef_A"] },
  "att_boost_defender": { "all": ["GenAtk_D"], "battleground": ["CampiAtk_D"], "guild_expedition": ["SpedAtk_D"], "guild_raids": ["IQAtk_D"] },
  "def_boost_defender": { "all": ["GenDef_D"], "battleground": ["CampiDef_D"], "guild_expedition": ["SpedDef_D"], "guild_raids": ["IQDef_D"] },
  "att_def_boost_attacker": { "all": ["GenAtk_A", "GenDef_A"], "battleground": ["CampiAtk_A", "CampiDef_A"], "guild_expedition": ["SpedAtk_A", "SpedDef_A"], "guild_raids": ["IQAtk_A", "IQDef_A"] },
  "att_def_boost_defender": { "all": ["GenAtk_D", "GenDef_D"], "battleground": ["CampiAtk_D", "CampiDef_D"], "guild_expedition": ["SpedAtk_D", "SpedDef_D"], "guild_raids": ["IQAtk_D", "IQDef_D"] },
  "att_def_boost_attacker_defender": { "all": ["GenAtk_A", "GenDef_A", "GenAtk_D", "GenDef_D"], "battleground": ["CampiAtk_A", "CampiDef_A", "CampiAtk_D", "CampiDef_D"], "guild_expedition": ["SpedAtk_A", "SpedDef_A", "SpedAtk_D", "SpedDef_D"], "guild_raids": ["IQAtk_A", "IQDef_A", "IQAtk_D", "IQDef_D"] },
  "guild_raids_goods_start": { "all": ["IQBeni"] },
  "guild_raids_units_start": { "all": ["IQTruppe"] },
  "guild_raids_action_points_collection": { "all": ["IQAzioni"] },
  "guild_raids_action_points_capacity": { "all": ["IQCap"] },
  "guild_raids_coins_production": { "all": ["IQmonB"] },
  "guild_raids_supplies_production": { "all": ["IQmatB"] },
  "guild_raids_coins_start": { "all": ["IQmon"] },
  "guild_raids_supplies_start": { "all": ["IQmat"] },
};

// ── Costanti produzioni (tradotte da city_entities_to_csv.py) ───────────────
// Chiavi delle risorse beni per colonna.
const GOODS_KEYS: Record<"beni" | "benip" | "benis", string[]> = {
  beni:  ["random_good_of_age", "all_goods_of_age", "random_good_of_age_1", "random_good_of_age_2", "random_good_of_age_3"],
  benip: ["random_good_of_previous_age", "all_goods_of_previous_age"],
  benis: ["random_good_of_next_age", "all_goods_of_next_age"],
};

// ID base dei reward per le colonne di produzione speciale.
const REWARD_IDS: Record<"fsp" | "tpm" | "tpb" | "adm" | "mod" | "rin" | "imm", string> = {
  fsp: "rush_event_buildings_instant",
  tpm: "rush_mass_supplies_24h",
  tpb: "rush_goods_buildings_instant",
  adm: "mass_self_aid_kit",
  mod: "one_up_kit",
  rin: "renovation_kit",
  imm: "store_building",
};

// Frammenti necessari per assemblare ogni item intero.
const REQUIRED_FRAGMENTS: Record<string, number> = {
  rush_event_buildings_instant: 30,
  rush_mass_supplies_24h: 15,
  rush_goods_buildings_instant: 30,
  mass_self_aid_kit: 30,
  one_up_kit: 30,
  renovation_kit: 30,
  store_building: 15,
};

const BP_BOX_AMOUNTS: Record<string, number> = {
  blueprint_box_2_item: 2, blueprint_box_4_item: 4, blueprint_box_6_item: 6,
};

export class BuildingModel {
  /**
   * Crea un oggetto Building base con tutti i valori inizializzati a zero/default.
   * Utile per evitare duplicazione di codice nei factory methods.
   */
  private static createBaseBuilding(id: string, name: string): Building {
    return {
      id, name, names: { it: name, en: name }, hash: "", lin: false, cityEntityId: id,
      time: 0, size: "1x1", area: 1, road: 0, pop: 0, fel: 0,
      general: [0, 0, 0, 0], gbg: [0, 0, 0, 0], sped: [0, 0, 0, 0], iq: [0, 0, 0, 0],
      iqMonB: 0, iqMatB: 0, iqMon: 0, iqMat: 0,
      iqBeni: 0, iqTruppe: 0, iqAzioni: 0, iqCap: 0, ally: 0, fp: 0, fpb: 0, fur: 0, tr: 0, trne: 0, 
      beni: 0, benip: 0, benis: 0, benib: 0, benig: 0, mon: 0, mat: 0, bp: 0, fsp: 0, tpm: 0, tpb: 0, 
      adm: 0, mod: 0, rin: 0, imm: 0, fragments: ""
    };
  }

  /** Estrae CURRENT_ERA (l'era del municipio della città importata).
   *  Il municipio in-game è sempre presente (fissato dal gioco, id=1),
   *  quindi non serve alcun fallback. Se per dati corrotti non lo si trova,
   *  restituisce stringa vuota. */
  static extractPlayerEraFromCityMap(cityMap: Record<string, CityMapEntry>): string {
    for (const key in cityMap) {
      const entry = cityMap[key];
      if (entry?.type === "main_building") {
        const match = String(entry.cityentity_id ?? "").match(/^H_(.+)_Townhall$/);
        if (match) return match[1];
      }
    }
    return "";
  }

  /** Ottiene le dimensioni [w, h] da un componente cityEntity */
  static getCityEntitySize(cityEntity: CityEntityDefinition | undefined): [number, number] {
    const size = cityEntity?.components?.AllAge?.placement?.size;
    const width = Number(size?.x ?? cityEntity?.width ?? 1) || 1;
    const length = Number(size?.y ?? cityEntity?.length ?? 1) || 1;
    return [width, length];
  }

  /** Verifica se un edificio richiede strada */
  static requiresRoad(cityEntity: CityEntityDefinition | undefined): boolean {
    if (!cityEntity) return false;
    // I Grandi Edifici richiedono sempre strada. Il riconoscimento del
    // prefisso vive SOLO in buildingClassification (isGreatBuildingId).
    if (isGreatBuildingId(String(cityEntity.id || ""))) return true;
    if (cityEntity.components?.AllAge?.streetConnectionRequirement) return true;
    if (cityEntity.requirements?.street_connection_level) return true;
    return false;
  }

  /** Calcola il fabbisogno stradale */
  static computeRoad(cityEntity: CityEntityDefinition | undefined): number {
    if (!BuildingModel.requiresRoad(cityEntity)) return 0;
    const [width, length] = BuildingModel.getCityEntitySize(cityEntity);
    return Math.min(width, length) / 2;
  }

  static getRoadForGreatBuildingSize(size: string): number {
    const [w, h] = size.toLowerCase().split("x").map(Number);
    if (!w || !h) return 2;
    return Math.min(w, h) / 2;
  }

  /** La wiki FoE ha un sottodominio per ogni lingua del gioco (it.wiki...,
   *  de.wiki..., es.wiki... ecc.): il codice lingua è usato direttamente come
   *  sottodominio, nessuna whitelist o mappatura necessaria. */
  static wikiUrl(displayName: string, lang: Lang = "it"): string {
    return `https://${lang}.wiki.forgeofempires.com/index.php?title=${encodeURIComponent(displayName.replace(/ /g, "_"))}`;
  }

  /** Crea un Building da un Grande Edificio */
  static fromGreatBuilding(gb: GreatBuilding, italianNames: Map<string, string>, hash = ""): Building {
    const size = `${gb.length}x${gb.width}`;
    const area = gb.length * gb.width;

    // Bonus GE militari
    const allBonuses: GbBonus[] = Array.isArray(gb.rawEntry?.bonuses) ? (gb.rawEntry.bonuses as GbBonus[]) : [];
    const singleBonus = (gb.rawEntry?.bonus ?? null) as GbBonus | null;
    const bonusSource = allBonuses.length > 0 ? allBonuses[0] : singleBonus;
    const bonusType = bonusSource?.type;
    const bonusValue = Number(bonusSource?.value ?? 0);
    let general: [number, number, number, number] = [0, 0, 0, 0];
    if (bonusType === "military_boost") general = [bonusValue, bonusValue, 0, 0];
    else if (bonusType === "fierce_resistance") general = [0, 0, bonusValue, bonusValue];
    else if (bonusType === "advanced_tactics") general = [bonusValue, bonusValue, bonusValue, bonusValue];
    // NOTA FUTURA: al momento nessun Grande Edificio ha bonus IQ (i 4 campi
    // IQmonB/IQmatB/IQmon/IQmat restano sempre 0 per i GE, via
    // createBaseBuilding). Se Inno introducesse un GE con questo tipo di
    // bonus, andrebbe gestito qui con lo stesso pattern: leggere bonusType
    // (es. "guild_raids_coins_production") e assegnare il valore al campo
    // IQ corrispondente, seguendo BOOST_MAP come riferimento per i nomi.

    // Produzioni
    let beniG = 0, beni = 0, beniP = 0, beniS = 0, fp = 0, tr = 0, fel = 0, pop = 0, mon = 0, mat = 0;
    allBonuses.forEach((b) => {
      if (b.type === "happiness") fel += Number(b.value ?? 0);
      else if (b.type === "population") pop += Number(b.value ?? 0);
    });

    const currentProduct = gb.rawEntry?.state?.current_product as GbCurrentProduct | undefined;
    if (currentProduct) {
      const products: GbProduct[] = currentProduct.products || (currentProduct.name ? [currentProduct] : []);
      const sumRes = (res: Record<string, number> | undefined) =>
        Object.values(res || {}).reduce<number>((s, v) => s + Number(v ?? 0), 0);
      products.forEach((p) => {
        const resources = p.product?.resources ?? {};
        if (p.name === "clan_goods") beniG += Array.isArray(p.goods) ? p.goods.reduce((s, g) => s + Number(g.value ?? 0), 0) : 0;
        else if (p.name === "strategy_points") fp += Number(resources.strategy_points ?? 0);
        else if (p.name === "previous_era_goods") beniP += sumRes(resources);
        else if (p.name === "random_goods" || p.name === "current_era_goods" || p.name === "goods") beni += sumRes(resources);
        else if (p.name === "next_era_goods" || p.name === "following_era_goods") beniS += sumRes(resources);
        else if (p.name === "money") mon += Number(resources.money ?? 0);
        else if (p.name === "supplies") mat += Number(resources.supplies ?? 0);
        else if (p.amount) tr += Number(p.amount ?? 0);
      });
    }

    if (beniG === 0) {
      const clanBonus = allBonuses.find((b) => b.type === "clan_goods");
      if (clanBonus) beniG = Number(clanBonus.value ?? 0) * 5;
    }

    return {
      ...BuildingModel.createBaseBuilding(`ge-${gb.entityId}`, italianNames.get(gb.entityId) ?? gb.entityId),
      size, area,
      road: BuildingModel.getRoadForGreatBuildingSize(size),
      pop, fel, general, fp, tr, beni, benip: beniP, benis: beniS, benig: beniG, mon, mat,
      cityEntityId: gb.entityId,
      hash,
      isGreatBuilding: true,
      isInactive: false,
      isFallback: false,
      isMilitary: false,
      isGoods: false
    };
  }

  // ── Helper di navigazione per le strutture production (dinamiche) ──────────
  // La struttura production del JSON di gioco non è completamente tipizzabile
  // (products annidati di tipo "random"/"genericReward"/"unit"/"set"...), quindi
  // navighiamo con helper sicuri su Record<string, unknown>.
  private static asObj(v: unknown): Record<string, unknown> {
    return (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {};
  }
  private static asArr(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
  }
  private static num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  private static str(v: unknown): string {
    return typeof v === "string" ? v : "";
  }

  /** Restituisce le opzioni di produzione di un componente era (production.options). */
  private static prodOptions(cityEntity: CityEntityDefinition, eraKey: string): Record<string, unknown>[] {
    const era = BuildingModel.asObj(cityEntity.components?.[eraKey]);
    const prod = BuildingModel.asObj(era.production);
    return BuildingModel.asArr(prod.options).map(BuildingModel.asObj);
  }
  /** Sceglie, tra le opzioni di produzione, quella con il `time` più alto.
   *  Le produzioni FoE elencano più durate (es. 4h/8h/24h); il valore di
   *  riferimento del tool è quello della durata massima. Assume `options` non
   *  vuoto (i chiamanti lo garantiscono). */
  private static maxTimeOption(options: Record<string, unknown>[]): Record<string, unknown> {
    return options.reduce((a, b) => BuildingModel.num(b.time) > BuildingModel.num(a.time) ? b : a);
  }
  private static eraLookup(cityEntity: CityEntityDefinition, eraKey: string): Record<string, unknown> {
    const era = BuildingModel.asObj(cityEntity.components?.[eraKey]);
    return BuildingModel.asObj(BuildingModel.asObj(era.lookup).rewards);
  }

  /** Beni, BeniP, BeniS (produzione beni) e BeniB (boost % beni) per l'era data. */
  private static extractGoods(cityEntity: CityEntityDefinition, era: string): { beni: number; benip: number; benis: number; benib: number } {
    const totals = { beni: 0, benip: 0, benis: 0 };
    let found = false;
    const cols: Array<keyof typeof totals> = ["beni", "benip", "benis"];

    const addFromResources = (res: Record<string, unknown>, mult: number) => {
      for (const col of cols) {
        for (const key of GOODS_KEYS[col]) {
          const v = BuildingModel.num(res[key]);
          if (v) { totals[col] += v * mult; found = true; }
        }
      }
    };

    // 1. components.{era}/AllAge.production.options (preferendo l'opzione 24h)
    const comps = BuildingModel.asObj(cityEntity.components);
    const eraKeysToTry = [era, "AllAge", ...Object.keys(comps).filter(k => k !== era && k !== "AllAge")];
    for (const eraKey of eraKeysToTry) {
      const options = BuildingModel.prodOptions(cityEntity, eraKey);
      const options24h = options.filter(o => BuildingModel.num(o.time) === 86400);
      const useOptions = options24h.length ? options24h : options;
      for (const option of useOptions) {
        for (const p of BuildingModel.asArr(option.products).map(BuildingModel.asObj)) {
          const res = BuildingModel.asObj(BuildingModel.asObj(p.playerResources).resources);
          addFromResources(res, 1);
          if (BuildingModel.str(p.type) === "random") {
            for (const entry of BuildingModel.asArr(p.products).map(BuildingModel.asObj)) {
              const prod = BuildingModel.asObj(entry.product);
              const drop = BuildingModel.num(entry.dropChance);
              const resR = BuildingModel.asObj(BuildingModel.asObj(prod.playerResources).resources);
              addFromResources(resR, drop);
            }
          }
        }
      }
      if (found) break;
    }

    // 2. ChainLinkAbility.bonusGiven.revenue (beni del giocatore)
    for (const ability of BuildingModel.asArr(cityEntity.abilities).map(BuildingModel.asObj)) {
      if (BuildingModel.str(ability.__class__) !== "ChainLinkAbility") continue;
      const revenue = BuildingModel.asObj(BuildingModel.asObj(ability.bonusGiven).revenue);
      for (const eraKey of [era, "AllAge"]) {
        const res = BuildingModel.asObj(BuildingModel.asObj(revenue[eraKey]).resources);
        let eraFound = false;
        for (const col of cols) {
          for (const key of GOODS_KEYS[col]) {
            const v = BuildingModel.num(res[key]);
            if (v) { totals[col] += v; found = true; eraFound = true; }
          }
        }
        if (eraFound) break;
      }
    }

    // 3. components.{era}.chain.config.bonuses[].productions
    const chainEra = BuildingModel.asObj(
      BuildingModel.asObj(comps[era]).chain ?? BuildingModel.asObj(comps.AllAge).chain
    );
    const bonuses = BuildingModel.asArr(BuildingModel.asObj(chainEra.config).bonuses).map(BuildingModel.asObj);
    for (const bonus of bonuses) {
      for (const p of BuildingModel.asArr(bonus.productions).map(BuildingModel.asObj)) {
        const res = BuildingModel.asObj(BuildingModel.asObj(p.playerResources).resources);
        addFromResources(res, 1);
      }
    }

    // 3bis. entity_levels: era_goods (vecchio stile) solo se l'opzione 24h la
    // produce (via available_products). Traduzione fedele del blocco omonimo di
    // _extract_goods_stats in buildings.py: senza questo ramo, 13 edifici reali
    // (produttivi P_* di eventi storici, es. P_MultiAge_CarnivalBonus18)
    // mostravano beni = 0 in tab Città mentre il CSV (generato dal Python)
    // diceva correttamente 10 — divergenza trovata dal test di coerenza
    // TS↔Python sull'intero MainParser. NON gated su `found`, come nel Python.
    // ⚠️ Due formati per l'elemento di available_products (luglio 2026, vedi
    // buildings.py per i dettagli): "vecchio stile" con un prodotto singolo diretto
    // in `product` (oggetto con `resources`), e "nuovo stile" osservato su 44 Grandi
    // Edifici classici (Colosseo, Oracolo di Delfi, ecc.), dove il wrapper ha invece
    // `products` (lista di prodotti, ciascuno col proprio `product.resources`
    // annidato). Si raccolgono le risorse candidate da ENTRAMBI i formati — oggi
    // nessuno dei 44 GE produce beni-era da questo campo, ma senza questa estensione
    // un'eventuale futura opzione beni-era sotto il nuovo schema andrebbe persa
    // silenziosamente, esattamente come nel gemello Python.
    {
      const option24h = BuildingModel.asArr(cityEntity.available_products)
        .map(BuildingModel.asObj)
        .find(p => BuildingModel.num(p.production_time) === 86400);
      if (option24h) {
        const candidateResources: Record<string, unknown>[] = [];
        if ("product" in option24h) {
          candidateResources.push(BuildingModel.asObj(BuildingModel.asObj(option24h.product).resources));
        }
        for (const subProduct of BuildingModel.asArr(option24h.products).map(BuildingModel.asObj)) {
          candidateResources.push(BuildingModel.asObj(BuildingModel.asObj(subProduct.product).resources));
        }
        for (const optResources of candidateResources) {
          for (const resKey of ["era_goods", "random_good_of_age", "all_goods_of_age"]) {
            if (!(resKey in optResources)) continue;
            for (const lvl of BuildingModel.asArr(cityEntity.entity_levels).map(BuildingModel.asObj)) {
              if (BuildingModel.str(lvl.era) !== era) continue;
              for (const pv of BuildingModel.asArr(lvl.production_values).map(BuildingModel.asObj)) {
                if (BuildingModel.str(pv.type) === resKey) {
                  totals.beni += BuildingModel.num(pv.value);
                  found = true;
                }
              }
            }
          }
        }
      }
    }

    // 4. abilities AddResources* (all_goods_of_age del giocatore) se non trovato
    if (!found) {
      for (const ability of BuildingModel.asArr(cityEntity.abilities).map(BuildingModel.asObj)) {
        const cls = BuildingModel.str(ability.__class__);
        if (cls !== "AddResourcesWhenMotivatedAbility" && cls !== "AddResourcesAbility") continue;
        const addRes = BuildingModel.asObj(ability.additionalResources);
        for (const eraKey of [era, "AllAge"]) {
          const res = BuildingModel.asObj(BuildingModel.asObj(addRes[eraKey]).resources);
          let eraFound = false;
          for (const col of cols) {
            for (const key of GOODS_KEYS[col]) {
              const v = BuildingModel.num(res[key]);
              if (v) { totals[col] += v; eraFound = true; }
            }
          }
          if (eraFound) break;
        }
      }
    }

    // 4bis. RandomChestRewardAbility: beni con drop chance (valore atteso), se
    // ancora non trovato. Traduzione fedele del ramo omonimo di buildings.py
    // (id "goods#random#CurrentEra#N", chance in percentuale): nessun caso
    // divergente osservato nel test di coerenza, portato per fedeltà — le due
    // implementazioni devono restare gemelle riga per riga.
    if (!found) {
      outer:
      for (const ability of BuildingModel.asArr(cityEntity.abilities).map(BuildingModel.asObj)) {
        if (BuildingModel.str(ability.__class__) !== "RandomChestRewardAbility") continue;
        const rewards = BuildingModel.asObj(ability.rewards);
        for (const eraKey of [era, "AllAge"]) {
          const eraRewards = BuildingModel.asObj(rewards[eraKey]);
          if (!Object.keys(eraRewards).length) continue;
          for (const pr of BuildingModel.asArr(eraRewards.possible_rewards).map(BuildingModel.asObj)) {
            const rid = BuildingModel.str(BuildingModel.asObj(pr.reward).id);
            if (rid.startsWith("goods#random#CurrentEra#")) {
              const amount = parseInt(rid.split("#").pop() ?? "0", 10);
              if (Number.isFinite(amount)) {
                totals.beni += (BuildingModel.num(pr.drop_chance) / 100) * amount;
                found = true;
              }
            }
          }
          if (found) break outer;
        }
      }
    }

    // BeniB: boost goods_production (valore / 100)
    let benib = 0;
    for (const eraKey of [era, "AllAge"]) {
      const boosts = BuildingModel.asArr(BuildingModel.asObj(BuildingModel.asObj(comps[eraKey]).boosts).boosts).map(BuildingModel.asObj);
      for (const boost of boosts) {
        if (BuildingModel.str(boost.type) === "goods_production") benib += BuildingModel.num(boost.value) / 100;
      }
    }

    return { beni: totals.beni, benip: totals.benip, benis: totals.benis, benib };
  }

  /** PF (strategy_points boostabili), PFB (boost % FP), BeniG (beni di gilda). */
  private static extractProduction(cityEntity: CityEntityDefinition, era: string): { fp: number; fpb: number; benig: number } {
    const comps = BuildingModel.asObj(cityEntity.components);
    let pf = 0, benig = 0;
    let foundPf = false;

    // 1. Produzione: era/AllAge con fallback, opzione con time massimo se multiple
    const eraKeysToTry = [era, "AllAge", ...Object.keys(comps).filter(k => k !== era && k !== "AllAge")];
    for (const eraKey of eraKeysToTry) {
      const eraData = BuildingModel.asObj(comps[eraKey]);
      if (!Object.keys(eraData).length) continue;
      let options = BuildingModel.prodOptions(cityEntity, eraKey);
      if (options.length > 1) {
        const maxOpt = BuildingModel.maxTimeOption(options);
        options = [maxOpt];
      }
      for (const option of options) {
        for (const p of BuildingModel.asArr(option.products).map(BuildingModel.asObj)) {
          const sp = BuildingModel.asObj(BuildingModel.asObj(p.playerResources).resources).strategy_points;
          if (sp != null) { pf += BuildingModel.num(sp); foundPf = true; }
          const ag = BuildingModel.asObj(BuildingModel.asObj(p.guildResources).resources).all_goods_of_age;
          if (ag != null) benig += BuildingModel.num(ag);
          if (BuildingModel.str(p.type) === "random") {
            for (const entry of BuildingModel.asArr(p.products).map(BuildingModel.asObj)) {
              const prod = BuildingModel.asObj(entry.product);
              const drop = BuildingModel.num(entry.dropChance);
              const spR = BuildingModel.asObj(BuildingModel.asObj(prod.playerResources).resources).strategy_points;
              if (spR != null) { pf += BuildingModel.num(spR) * drop; foundPf = true; }
              const agR = BuildingModel.asObj(BuildingModel.asObj(prod.guildResources).resources).all_goods_of_age;
              if (agR != null) benig += BuildingModel.num(agR) * drop;
            }
          }
        }
      }
      if (foundPf || benig !== 0) break;
    }

    // 1b. Fallback entity_levels: ultimo slot di production_values (24h)
    if (!foundPf && benig === 0) {
      const lvl = BuildingModel.asArr(cityEntity.entity_levels).map(BuildingModel.asObj).find(l => BuildingModel.str(l.era) === era);
      if (lvl) {
        const pv = BuildingModel.asArr(lvl.production_values).map(BuildingModel.asObj);
        if (pv.length) {
          const last = pv[pv.length - 1];
          if (BuildingModel.str(last.type) === "strategy_points") { const v = BuildingModel.num(last.value); if (v) { pf = v; foundPf = true; } }
          else if (BuildingModel.str(last.type) === "all_goods_of_age") { const v = BuildingModel.num(last.value); if (v) benig = v; }
        }
      }
    }

    // 2-4. Abilities
    const chainEra = BuildingModel.asObj(BuildingModel.asObj(comps[era]).chain ?? BuildingModel.asObj(comps.AllAge).chain);
    for (const ability of BuildingModel.asArr(cityEntity.abilities).map(BuildingModel.asObj)) {
      const cls = BuildingModel.str(ability.__class__);
      if (cls === "AddResourcesAbility" || cls === "AddResourcesToGuildTreasuryAbility" || cls === "AddResourcesWhenMotivatedAbility") {
        const addRes = BuildingModel.asObj(ability.additionalResources);
        for (const eraKey of [era, "AllAge"]) {
          const res = BuildingModel.asObj(BuildingModel.asObj(addRes[eraKey]).resources);
          if (BuildingModel.num(res.strategy_points)) { pf += BuildingModel.num(res.strategy_points); foundPf = true; break; }
        }
        if (cls === "AddResourcesToGuildTreasuryAbility" && benig === 0) {
          for (const eraKey of [era, "AllAge"]) {
            const ag = BuildingModel.asObj(BuildingModel.asObj(addRes[eraKey]).resources).all_goods_of_age;
            if (ag) { benig = BuildingModel.num(ag); break; }
          }
        }
      } else if (cls === "RandomChestRewardAbility") {
        const rewards = BuildingModel.asObj(ability.rewards);
        const eraReward = BuildingModel.asObj(rewards[era] ?? rewards.AllAge ?? Object.values(rewards)[0]);
        for (const pr of BuildingModel.asArr(eraReward.possible_rewards).map(BuildingModel.asObj)) {
          const reward = BuildingModel.asObj(pr.reward);
          if (BuildingModel.str(reward.subType) === "strategy_points") {
            pf += BuildingModel.num(reward.amount) * BuildingModel.num(pr.drop_chance) / 100;
            foundPf = true;
          }
        }
      } else if (cls === "ChainLinkAbility") {
        const revenue = BuildingModel.asObj(BuildingModel.asObj(ability.bonusGiven).revenue);
        for (const eraKey of [era, "AllAge"]) {
          const res = BuildingModel.asObj(BuildingModel.asObj(revenue[eraKey]).resources);
          if (BuildingModel.num(res.strategy_points)) { pf += BuildingModel.num(res.strategy_points); foundPf = true; }
        }
      }
    }

    // 5. Chain bonuses productions
    for (const bonus of BuildingModel.asArr(BuildingModel.asObj(chainEra.config).bonuses).map(BuildingModel.asObj)) {
      for (const p of BuildingModel.asArr(bonus.productions).map(BuildingModel.asObj)) {
        const sp = BuildingModel.asObj(BuildingModel.asObj(p.playerResources).resources).strategy_points;
        if (sp != null) { pf += BuildingModel.num(sp); foundPf = true; }
        const ag = BuildingModel.asObj(BuildingModel.asObj(p.guildResources).resources).all_goods_of_age;
        if (ag != null) benig += BuildingModel.num(ag);
      }
    }

    // 6. PFB: forge_points_production nei boost (/100)
    let fpb = 0;
    for (const eraKey of [era, "AllAge"]) {
      const boosts = BuildingModel.asArr(BuildingModel.asObj(BuildingModel.asObj(comps[eraKey]).boosts).boosts).map(BuildingModel.asObj);
      for (const boost of boosts) {
        if (BuildingModel.str(boost.type) === "forge_points_production") fpb += BuildingModel.num(boost.value) / 100;
      }
    }

    return { fp: foundPf ? pf : 0, fpb, benig };
  }

  /**
   * Beni (+benip/benis) e fp dagli edifici "bonus per adiacenza di set"
   * (luglio 2026, es. Piazza Set, Harvest Farm, Butterfly Sanctuary, Horror
   * Circus — prefisso "L_", `type: "random_production"`). Traduzione fedele
   * di _extract_set_adjacency_bonus() in buildings.py: la produzione di
   * questi edifici NON vive in available_products/entity_levels come per gli
   * edifici normali — è dichiarata in abilities[].__class__ ==
   * "BonusOnSetAdjacencyAbility", come una lista di bonuses[] (uno per
   * livello di adiacenza raggiunto in game, 1..N vicini dello stesso set),
   * ciascuno con un revenue per era.
   *
   * Convenzione dell'app (come nel CSV): si sommano i bonus di TUTTI i
   * livelli, non solo l'ultimo — a differenza degli edifici a produzione
   * oraria dove si prende la sola opzione da 24h.
   *
   * I bonus in "medals" (Medaglie) sono ignorati deliberatamente: risorsa
   * che il CSV/l'app non gestiscono, per scelta esplicita (non una svista).
   */
  private static extractSetAdjacencyBonus(cityEntity: CityEntityDefinition, era: string): { beni: number; benip: number; benis: number; fp: number } {
    let beni = 0, benip = 0, benis = 0, fp = 0;
    for (const ability of BuildingModel.asArr(cityEntity.abilities).map(BuildingModel.asObj)) {
      if (BuildingModel.str(ability.__class__) !== "BonusOnSetAdjacencyAbility") continue;
      for (const bonus of BuildingModel.asArr(ability.bonuses).map(BuildingModel.asObj)) {
        const revenue = bonus.revenue;
        if (!revenue || typeof revenue !== "object" || Array.isArray(revenue)) continue; // osservato anche come lista vuota []
        const revenueObj = BuildingModel.asObj(revenue);
        for (const eraKey of [era, "AllAge"]) {
          const res = BuildingModel.asObj(revenueObj[eraKey]);
          const resources = BuildingModel.asObj(res.resources);
          const sp = BuildingModel.num(resources.strategy_points);
          if (sp) fp += sp;
          for (const key of GOODS_KEYS.beni) {
            const v = BuildingModel.num(resources[key]);
            if (v) beni += v;
          }
          for (const key of GOODS_KEYS.benip) {
            const v = BuildingModel.num(resources[key]);
            if (v) benip += v;
          }
          for (const key of GOODS_KEYS.benis) {
            const v = BuildingModel.num(resources[key]);
            if (v) benis += v;
          }
        }
      }
    }
    return { beni, benip, benis, fp };
  }

  /** Monete (mon) e materiali (mat) prodotti giornalmente per l'era data.
   *  Traduzione fedele di extract_mon_mat() in city_entities_to_csv.py (lo
   *  script che genera buildings.csv dal MainParser offline): qui la stessa
   *  identica logica viene applicata ai dati CityEntities del bookmarklet,
   *  così CSV e città importata restano coerenti per costruzione.
   *
   *  1. components (nuovo stile): opzioni non motivate, normalizzate a 24h.
   *     Gestisce type=resources e type=random con dropChance.
   *  2. entity_levels (vecchio stile), solo se la parte 1 non trova nulla:
   *     - ResidentialEntityLevel: produced_money/produced_supplies,
   *       normalizzati a 24h tramite production_time in available_products.
   *     - ProductionEntityLevel: production_values[-1] (slot 24h).
   *  3. AddResourcesWhenMotivatedAbility: supplies/money aggiuntivi da
   *     additionalResources[era] (es. edifici culturali con Mat motivato). */
  private static extractMonMat(cityEntity: CityEntityDefinition, era: string): { mon: number; mat: number } {
    let mon = 0, mat = 0;
    const comps = BuildingModel.asObj(cityEntity.components);

    // 1. components (nuovo stile)
    for (const eraKey of [era, "AllAge"]) {
      const eraData = BuildingModel.asObj(comps[eraKey]);
      const lookup = BuildingModel.asObj(BuildingModel.asObj(eraData.lookup).rewards);
      let options = BuildingModel.prodOptions(cityEntity, eraKey).filter(o => !o.onlyWhenMotivated);
      if (options.length > 1) {
        options = [BuildingModel.maxTimeOption(options)];
      }
      for (const option of options) {
        const mult = 86400 / (BuildingModel.num(option.time) || 86400);
        for (const p of BuildingModel.asArr(option.products).map(BuildingModel.asObj)) {
          const res = BuildingModel.asObj(BuildingModel.asObj(p.playerResources).resources);
          mon += BuildingModel.num(res.money) * mult;
          mat += BuildingModel.num(res.supplies) * mult;
          if (BuildingModel.str(p.type) === "random") {
            for (const sub of BuildingModel.asArr(p.products).map(BuildingModel.asObj)) {
              const drop = BuildingModel.num(sub.dropChance);
              const prod = BuildingModel.asObj(sub.product);
              const sres = BuildingModel.asObj(BuildingModel.asObj(prod.playerResources).resources);
              mon += BuildingModel.num(sres.money) * drop * mult;
              mat += BuildingModel.num(sres.supplies) * drop * mult;
              // genericReward: risolvi il valore tramite lookup dell'era
              if (BuildingModel.str(prod.type) === "genericReward") {
                const rid = BuildingModel.str(BuildingModel.asObj(prod.reward).id);
                const resolved = BuildingModel.asObj(lookup[rid]);
                if (BuildingModel.str(resolved.subType) === "money") mon += BuildingModel.num(resolved.amount) * drop * mult;
                else if (BuildingModel.str(resolved.subType) === "supplies") mat += BuildingModel.num(resolved.amount) * drop * mult;
              }
            }
          }
        }
      }
      if (mon || mat) break;
    }

    // 2. entity_levels (vecchio stile), solo se la parte 1 non ha trovato nulla
    if (!mon && !mat) {
      const availableProducts = BuildingModel.asArr(cityEntity.available_products).map(BuildingModel.asObj);
      const prodTime = availableProducts.find(p => BuildingModel.num(p.production_time))?.production_time;
      const mult = 86400 / (BuildingModel.num(prodTime) || 86400);
      const lvl = BuildingModel.asArr(cityEntity.entity_levels).map(BuildingModel.asObj).find(l => BuildingModel.str(l.era) === era);
      if (lvl) {
        const cls = BuildingModel.str(lvl.__class__);
        if (cls === "ResidentialEntityLevel") {
          mon = BuildingModel.num(lvl.produced_money) * mult;
          mat = BuildingModel.num(lvl.produced_supplies) * mult;
        } else if (cls === "ProductionEntityLevel") {
          const pv = BuildingModel.asArr(lvl.production_values).map(BuildingModel.asObj);
          if (pv.length) {
            const last = pv[pv.length - 1];
            if (BuildingModel.str(last.type) === "money") mon = BuildingModel.num(last.value);
            else if (BuildingModel.str(last.type) === "supplies") mat = BuildingModel.num(last.value);
          }
        }
      }
    }

    // 3. AddResourcesWhenMotivatedAbility: supplies/money aggiuntivi
    for (const ability of BuildingModel.asArr(cityEntity.abilities).map(BuildingModel.asObj)) {
      if (BuildingModel.str(ability.__class__) !== "AddResourcesWhenMotivatedAbility") continue;
      const addRes = BuildingModel.asObj(ability.additionalResources);
      for (const eraKey of [era, "AllAge"]) {
        const res = BuildingModel.asObj(BuildingModel.asObj(addRes[eraKey]).resources);
        if (BuildingModel.num(res.money) || BuildingModel.num(res.supplies)) {
          mon += BuildingModel.num(res.money);
          mat += BuildingModel.num(res.supplies);
          break;
        }
      }
    }

    return { mon, mat };
  }

  /** Numero di blueprint per un reward id (BP e BPNE unificati). */
  private static bpFromRewardId(rid: string, lookup: Record<string, unknown>): number {
    const rv = BuildingModel.asObj(lookup[rid]);
    const rtype = BuildingModel.str(rv.type);
    if (rtype === "blueprint") return BuildingModel.num(rv.amount);
    if (BP_BOX_AMOUNTS[rid] !== undefined) return BP_BOX_AMOUNTS[rid];
    if (rtype === "chest" && rid.includes("higher_age")) {
      const m = rid.match(/SpaceAgeSpaceHub(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    }
    return 0;
  }
  private static bpFromProducts(products: Record<string, unknown>[], lookup: Record<string, unknown>): number {
    let bp = 0;
    for (const p of products) {
      const ptype = BuildingModel.str(p.type);
      if (ptype === "genericReward") {
        bp += BuildingModel.bpFromRewardId(BuildingModel.str(BuildingModel.asObj(p.reward).id), lookup);
      } else if (ptype === "random") {
        for (const entry of BuildingModel.asArr(p.products).map(BuildingModel.asObj)) {
          const prod = BuildingModel.asObj(entry.product);
          const chance = BuildingModel.num(entry.dropChance);
          if (BuildingModel.str(prod.type) === "genericReward") {
            bp += BuildingModel.bpFromRewardId(BuildingModel.str(BuildingModel.asObj(prod.reward).id), lookup) * chance;
          }
        }
      }
    }
    return bp;
  }
  /** BP: blueprint prodotti (BP + BPNE unificati) per l'era data. */
  private static extractBlueprints(cityEntity: CityEntityDefinition, era: string): number {
    const lookup = BuildingModel.eraLookup(cityEntity, era);
    const options = BuildingModel.prodOptions(cityEntity, era);
    if (options.length) {
      const opt = BuildingModel.maxTimeOption(options);
      const bp = BuildingModel.bpFromProducts(BuildingModel.asArr(opt.products).map(BuildingModel.asObj), lookup);
      if (bp) return bp;
    }
    // Fallback entity_levels
    const lvl = BuildingModel.asArr(cityEntity.entity_levels).map(BuildingModel.asObj).find(l => BuildingModel.str(l.era) === era);
    if (lvl) {
      const bp = BuildingModel.num(lvl.produced_blueprints_when_motivated);
      if (bp) return bp;
    }
    return 0;
  }

  /** FUR: valore atteso di furfanti prodotti (fissi o pesati per dropChance). */
  private static extractRogues(cityEntity: CityEntityDefinition, era: string): number {
    for (const eraKey of [era, "AllAge"]) {
      const lookup = BuildingModel.eraLookup(cityEntity, eraKey);
      const options = BuildingModel.prodOptions(cityEntity, eraKey);
      if (!options.length) continue;
      const opt = BuildingModel.maxTimeOption(options);
      let fur = 0;
      for (const p of BuildingModel.asArr(opt.products).map(BuildingModel.asObj)) {
        if (BuildingModel.str(p.type) === "unit" && BuildingModel.str(p.unitTypeId) === "rogue") {
          fur += BuildingModel.num(p.amount);
        } else if (BuildingModel.str(p.type) === "random") {
          for (const entry of BuildingModel.asArr(p.products).map(BuildingModel.asObj)) {
            const prod = BuildingModel.asObj(entry.product);
            if (BuildingModel.str(prod.type) === "genericReward") {
              const rv = BuildingModel.asObj(lookup[BuildingModel.str(BuildingModel.asObj(prod.reward).id)]);
              if (BuildingModel.str(rv.subType) === "rogue") fur += BuildingModel.num(rv.amount) * BuildingModel.num(entry.dropChance);
            }
          }
        }
      }
      if (fur) return fur;
    }
    return 0;
  }

  /** Mappa {unit_type: amount} per le unità NextEra nell'era precedente. */
  private static buildPrevNextEraKeys(cityEntity: CityEntityDefinition, prevEra: string): Record<string, number> {
    const prevLookup = BuildingModel.eraLookup(cityEntity, prevEra);
    const ne: Record<string, number> = {};
    for (const rid of Object.keys(prevLookup)) {
      const rv = BuildingModel.asObj(prevLookup[rid]);
      if (rid.includes("NextEra") && BuildingModel.str(rv.type) === "unit") {
        const parts = rid.split("#");
        if (parts.length >= 4) {
          const n = parseInt(parts[3], 10);
          if (Number.isFinite(n)) ne[parts[1]] = n;
        }
      }
    }
    return ne;
  }

  /** (TR, TRNE) da una lista di products. Traduzione di _extract_tr_trne_from_products. */
  private static trTrneFromProducts(products: Record<string, unknown>[], lookup: Record<string, unknown>, neByType: Record<string, number>): [number, number] {
    let tr = 0, trne = 0;
    const explicitNeTypes = new Set<string>();

    // Step 1: NextEra espliciti e chest
    for (const p of products) {
      const ptype = BuildingModel.str(p.type);
      if (ptype === "genericReward") {
        const rid = BuildingModel.str(BuildingModel.asObj(p.reward).id);
        if (rid.includes("NextEra")) {
          trne += BuildingModel.num(BuildingModel.asObj(lookup[rid]).amount);
          const parts = rid.split("#");
          if (parts.length >= 2) explicitNeTypes.add(parts[1]);
        } else if (rid.startsWith("genb_random_next_age_unit_chest")) {
          const m = rid.match(/chest(\d+)/); if (m) trne += parseInt(m[1], 10);
        } else if (rid.startsWith("genb_random_current_age_unit_chest")) {
          const m = rid.match(/chest(\d+)/); if (m) tr += parseInt(m[1], 10);
        } else if (/genb_random_unit_chest\d+$/.test(rid)) {
          const m = rid.match(/chest(\d+)/); if (m) tr += parseInt(m[1], 10);
        } else if (rid === "genb_random_unit_chest") {
          tr += 1;
        }
      } else if (ptype === "random") {
        for (const entry of BuildingModel.asArr(p.products).map(BuildingModel.asObj)) {
          const prod = BuildingModel.asObj(entry.product);
          if (BuildingModel.str(prod.type) !== "genericReward") continue;
          const rid = BuildingModel.str(BuildingModel.asObj(prod.reward).id);
          const chance = entry.dropChance != null ? BuildingModel.num(entry.dropChance) : 1.0;
          if (rid.includes("NextEra")) {
            trne += BuildingModel.num(BuildingModel.asObj(lookup[rid]).amount) * chance;
            const parts = rid.split("#");
            if (parts.length >= 2) explicitNeTypes.add(parts[1]);
          } else if (rid.startsWith("genb_random_next_age_unit_chest")) {
            const m = rid.match(/chest(\d+)/); if (m) trne += parseInt(m[1], 10) * chance;
          }
        }
      }
    }

    // Step 2: raccoglie tutte le entry CurrentEra per tipo
    const allCe: Record<string, Array<[number, number]>> = {};
    const pushCe = (type: string, amt: number, chance: number) => {
      (allCe[type] ??= []).push([amt, chance]);
    };
    for (const p of products) {
      const ptype = BuildingModel.str(p.type);
      if (ptype === "genericReward") {
        const rid = BuildingModel.str(BuildingModel.asObj(p.reward).id);
        if (rid.includes("CurrentEra")) {
          const parts = rid.split("#");
          if (parts.length >= 4) { const n = parseInt(parts[3], 10); if (Number.isFinite(n)) pushCe(parts[1], n, 1.0); }
        }
      } else if (ptype === "random") {
        for (const entry of BuildingModel.asArr(p.products).map(BuildingModel.asObj)) {
          const prod = BuildingModel.asObj(entry.product);
          if (BuildingModel.str(prod.type) !== "genericReward") continue;
          const rid = BuildingModel.str(BuildingModel.asObj(prod.reward).id);
          if (rid.includes("CurrentEra")) {
            const parts = rid.split("#");
            if (parts.length >= 4) { const n = parseInt(parts[3], 10); if (Number.isFinite(n)) pushCe(parts[1], n, entry.dropChance != null ? BuildingModel.num(entry.dropChance) : 1.0); }
          }
        }
      }
    }

    // Step 3: classifica ogni CE come TR o TRNE
    for (const unitType of Object.keys(allCe)) {
      const entries = allCe[unitType];
      if (explicitNeTypes.has(unitType)) {
        for (const [amt, chance] of entries) tr += amt * chance;
      } else if (neByType[unitType] === undefined) {
        for (const [amt, chance] of entries) tr += amt * chance;
      } else {
        const titanNeAmt = neByType[unitType];
        if (entries.length === 1) {
          const [amt, chance] = entries[0];
          trne += amt * chance;
        } else {
          for (const [amt, chance] of entries) {
            if (amt === titanNeAmt) trne += amt * chance;
            else tr += amt * chance;
          }
        }
      }
    }

    return [tr, trne];
  }

  /** (TR, TRNE) per l'era data. prevEra = era immediatamente precedente. */
  private static extractTrTrne(cityEntity: CityEntityDefinition, era: string, prevEra: string): [number, number] {
    const neByType = BuildingModel.buildPrevNextEraKeys(cityEntity, prevEra);
    for (const eraKey of [era, "AllAge"]) {
      const lookup = BuildingModel.eraLookup(cityEntity, eraKey);
      const options = BuildingModel.prodOptions(cityEntity, eraKey);
      if (!options.length) continue;
      const opt = BuildingModel.maxTimeOption(options);
      const [tr, trne] = BuildingModel.trTrneFromProducts(BuildingModel.asArr(opt.products).map(BuildingModel.asObj), lookup, neByType);
      if (tr || trne) return [tr, trne];
    }
    // Fallback: RandomUnitOfAgeWhenMotivatedAbility
    for (const ability of BuildingModel.asArr(cityEntity.abilities).map(BuildingModel.asObj)) {
      if (BuildingModel.str(ability.__class__) === "RandomUnitOfAgeWhenMotivatedAbility") {
        const amt = BuildingModel.num(ability.amount);
        if (amt) return [amt, 0];
      }
    }
    return [0, 0];
  }

  /** Frammenti estratti dall'id del reward (fragment#base_id#N o item intero). */
  private static fragmentsFromRewardId(rewardId: string, baseId: string): number {
    const m = rewardId.match(new RegExp(`fragment#${baseId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#(\\d+)`));
    if (m) return parseInt(m[1], 10);
    if (rewardId === baseId) return REQUIRED_FRAGMENTS[baseId] ?? 1;
    return 0;
  }
  /** Valore atteso di frammenti da una lista di products (doppio random incluso). */
  private static expectedFromProducts(products: Record<string, unknown>[], baseId: string): number {
    let total = 0;
    for (const p of products) {
      const ptype = BuildingModel.str(p.type);
      if (ptype === "genericReward") {
        total += BuildingModel.fragmentsFromRewardId(BuildingModel.str(BuildingModel.asObj(p.reward).id), baseId);
      } else if (ptype === "random") {
        for (const entry of BuildingModel.asArr(p.products).map(BuildingModel.asObj)) {
          const prod = BuildingModel.asObj(entry.product);
          if (BuildingModel.str(prod.type) === "genericReward") {
            const frag = BuildingModel.fragmentsFromRewardId(BuildingModel.str(BuildingModel.asObj(prod.reward).id), baseId);
            if (frag) total += frag * BuildingModel.num(entry.dropChance);
          } else if (BuildingModel.str(prod.type) === "random") {
            for (const subEntry of BuildingModel.asArr(prod.products).map(BuildingModel.asObj)) {
              const subProd = BuildingModel.asObj(subEntry.product);
              if (BuildingModel.str(subProd.type) === "genericReward") {
                const frag = BuildingModel.fragmentsFromRewardId(BuildingModel.str(BuildingModel.asObj(subProd.reward).id), baseId);
                if (frag) total += frag * BuildingModel.num(entry.dropChance) * BuildingModel.num(subEntry.dropChance);
              }
            }
          }
        }
      }
    }
    return total;
  }
  /** Valore atteso per una colonna reward (FSP/TPM/TPB/ADM/MOD/RIN/IMM). */
  private static extractReward(cityEntity: CityEntityDefinition, era: string, col: keyof typeof REWARD_IDS): number {
    const baseId = REWARD_IDS[col];
    const comps = BuildingModel.asObj(cityEntity.components);
    // 1. Produzione standard (opzione con time massimo)
    for (const eraKey of [era, "AllAge"]) {
      const options = BuildingModel.prodOptions(cityEntity, eraKey);
      if (!options.length) continue;
      const opt = BuildingModel.maxTimeOption(options);
      const products = BuildingModel.asArr(opt.products).map(BuildingModel.asObj);
      if (products.length) {
        const total = BuildingModel.expectedFromProducts(products, baseId);
        if (total) return total;
      }
    }
    // 2. Chain bonuses productions
    const chainEra = BuildingModel.asObj(BuildingModel.asObj(comps[era]).chain ?? BuildingModel.asObj(comps.AllAge).chain);
    for (const bonus of BuildingModel.asArr(BuildingModel.asObj(chainEra.config).bonuses).map(BuildingModel.asObj)) {
      const products = BuildingModel.asArr(bonus.productions).map(BuildingModel.asObj);
      if (products.length) {
        const total = BuildingModel.expectedFromProducts(products, baseId);
        if (total) return total;
      }
    }
    return 0;
  }

  /** Estrae le statistiche (pop, fel, bonus militari, IQ) di un CityEntity
   *  per una specifica era. Logica riutilizzata sia dai fallback sia
   *  dall'override per era corrente degli edifici CSV. */
  static extractEraStats(cityEntity: CityEntityDefinition, era: string): EraStats {
    // Popolazione — legge dall'era richiesta con fallback ad AllAge
    let pop = 0;
    for (const eraKey of [era, "AllAge"]) {
      const p = cityEntity.components?.[eraKey]?.staticResources?.resources?.resources?.population;
      if (p != null) { pop = Number(p); break; }
    }
    if (pop === 0) {
      const eraLevel = (cityEntity.entity_levels || []).find((l) => l.era === era);
      if (eraLevel) pop = eraLevel.provided_population ? Number(eraLevel.provided_population) : (eraLevel.required_population ? -Number(eraLevel.required_population) : 0);
    }

    // Felicità
    let fel = 0;
    for (const eraKey of [era, "AllAge"]) {
      const h = cityEntity.components?.[eraKey]?.happiness;
      if (h?.provided != null) { fel = Number(h.provided); break; }
    }
    if (fel === 0) {
      const eraLevel = (cityEntity.entity_levels || []).find((l) => l.era === era);
      if (eraLevel?.provided_happiness != null) fel = Number(eraLevel.provided_happiness);
    }

    // Bonus
    const general: [number, number, number, number] = [0, 0, 0, 0];
    const gbg: [number, number, number, number] = [0, 0, 0, 0];
    const sped: [number, number, number, number] = [0, 0, 0, 0];
    const iq: [number, number, number, number] = [0, 0, 0, 0];
    let iqMonB = 0, iqMatB = 0, iqMon = 0, iqMat = 0;
    let iqBeni = 0, iqTruppe = 0, iqAzioni = 0, iqCap = 0;

    const allBoosts: BoostHint[] = [];
    [era, "AllAge"].forEach(eraKey => {
      const b = cityEntity.components?.[eraKey]?.boosts?.boosts;
      if (Array.isArray(b)) allBoosts.push(...b);
    });
    (cityEntity.abilities || []).forEach((a) => {
      if (a?.__class__ === "ChainLinkAbility") {
        const bd = a?.bonusGiven?.boost;
        if (bd && typeof bd === "object" && !Array.isArray(bd)) allBoosts.push(...Object.values(bd));
      } else if (a?.__class__ === "BoostAbility") {
        (a.boostHints || []).forEach((h) => {
          const b = h?.boostHintEraMap?.[era] ?? h?.boostHintEraMap?.AllAge;
          if (b) allBoosts.push(b);
        });
      }
    });
    const chain = cityEntity.components?.[era]?.chain ?? cityEntity.components?.AllAge?.chain ?? {};
    (chain?.config?.bonuses || []).forEach((bn) => { if (Array.isArray(bn?.boosts)) allBoosts.push(...bn.boosts); });

    allBoosts.forEach(boost => {
      const type = boost?.type, target = boost?.targetedFeature, val = Number(boost?.value ?? 0);
      if (!type || !target || val === 0) return;
      const cols = BOOST_MAP[type]?.[target] ?? BOOST_MAP[type]?.["all"];
      if (cols) cols.forEach(col => {
        if (col === "GenAtk_A") general[0] += val; else if (col === "GenDef_A") general[1] += val; else if (col === "GenAtk_D") general[2] += val; else if (col === "GenDef_D") general[3] += val;
        else if (col === "CampiAtk_A") gbg[0] += val; else if (col === "CampiDef_A") gbg[1] += val; else if (col === "CampiAtk_D") gbg[2] += val; else if (col === "CampiDef_D") gbg[3] += val;
        else if (col === "SpedAtk_A") sped[0] += val; else if (col === "SpedDef_A") sped[1] += val; else if (col === "SpedAtk_D") sped[2] += val; else if (col === "SpedDef_D") sped[3] += val;
        else if (col === "IQAtk_A") iq[0] += val; else if (col === "IQDef_A") iq[1] += val; else if (col === "IQAtk_D") iq[2] += val; else if (col === "IQDef_D") iq[3] += val;
        else if (col === "IQmonB") iqMonB += val / 100; else if (col === "IQmatB") iqMatB += val / 100; else if (col === "IQmon") iqMon += val; else if (col === "IQmat") iqMat += val;
        else if (col === "IQBeni") iqBeni += val; else if (col === "IQTruppe") iqTruppe += val; else if (col === "IQAzioni") iqAzioni += val; else if (col === "IQCap") iqCap += val;
      });
    });

    const goods = BuildingModel.extractGoods(cityEntity, era);
    const prod = BuildingModel.extractProduction(cityEntity, era);
    const monMat = BuildingModel.extractMonMat(cityEntity, era);
    const bp = BuildingModel.extractBlueprints(cityEntity, era);
    const fur = BuildingModel.extractRogues(cityEntity, era);
    // Edifici "bonus per adiacenza di set" (L_*, es. Piazza/Harvest Farm/
    // Butterfly Sanctuary/Horror Circus): sommare il bonus di TUTTI i
    // livelli di adiacenza a Beni/BeniP/BeniS/FP già calcolati sopra (che
    // per questi edifici sono 0 perché non hanno available_products/
    // entity_levels normali). Vedi extractSetAdjacencyBonus().
    const adjBonus = BuildingModel.extractSetAdjacencyBonus(cityEntity, era);
    // Era precedente (per la classificazione TR vs TRNE): era con id
    // immediatamente inferiore. Se `era` non è in AGES o è la prima (id 0),
    // prevEra resta "" e buildPrevNextEraKeys non troverà nulla (ok).
    const eraId = AGE_BY_CODE.get(era)?.id ?? -1;
    const prevEra = eraId > 0 ? (AGES_BY_ID.get(eraId - 1)?.age ?? "") : "";
    const [tr, trne] = BuildingModel.extractTrTrne(cityEntity, era, prevEra);

    return {
      pop, fel, general, gbg, sped, iq, iqMonB, iqMatB, iqMon, iqMat, iqBeni, iqTruppe, iqAzioni, iqCap,
      bp, fp: prod.fp + adjBonus.fp, fpb: prod.fpb, fur, tr, trne,
      beni: goods.beni + adjBonus.beni, benip: goods.benip + adjBonus.benip, benis: goods.benis + adjBonus.benis, benib: goods.benib, benig: prod.benig,
      mon: monMat.mon, mat: monMat.mat,
      fsp: BuildingModel.extractReward(cityEntity, era, "fsp"),
      tpm: BuildingModel.extractReward(cityEntity, era, "tpm"),
      tpb: BuildingModel.extractReward(cityEntity, era, "tpb"),
      adm: BuildingModel.extractReward(cityEntity, era, "adm"),
      mod: BuildingModel.extractReward(cityEntity, era, "mod"),
      rin: BuildingModel.extractReward(cityEntity, era, "rin"),
      imm: BuildingModel.extractReward(cityEntity, era, "imm"),
    };
  }

  /** Crea un Building da un CityEntity grezzo (Fallback).
   *  I bonus, popolazione e felicità vengono letti dall'era specificata
   *  (CURRENT_ERA per gli edifici della città importata). */
  static fromCityEntity(entityId: string, cityEntity: CityEntityDefinition, era: string, italianNames: Map<string, string>): Building {
    const displayName = cityEntity.name ?? italianNames.get(entityId) ?? entityId;
    const [width, length] = BuildingModel.getCityEntitySize(cityEntity);
    // Nel JSON del gioco x/y risultano invertiti rispetto alla convenzione usata in tabella.
    const size = `${length}x${width}`;
    const area = width * length;

    const stats = BuildingModel.extractEraStats(cityEntity, era || FALLBACK_ERA);

    return {
      ...BuildingModel.createBaseBuilding(`fallback-${entityId}`, displayName),
      size, area,
      road: BuildingModel.computeRoad(cityEntity),
      pop: stats.pop, fel: stats.fel,
      general: stats.general, gbg: stats.gbg, sped: stats.sped, iq: stats.iq,
      iqMonB: stats.iqMonB, iqMatB: stats.iqMatB, iqMon: stats.iqMon, iqMat: stats.iqMat,
      iqBeni: stats.iqBeni, iqTruppe: stats.iqTruppe, iqAzioni: stats.iqAzioni, iqCap: stats.iqCap,
      // Produzioni estratte da CityEntities per l'era corrente: ora abbiamo
      // davvero tutti i dati, quindi niente più "?" per questi edifici.
      bp: stats.bp, fp: stats.fp, fpb: stats.fpb, fur: stats.fur, tr: stats.tr, trne: stats.trne,
      beni: stats.beni, benip: stats.benip, benis: stats.benis, benib: stats.benib, benig: stats.benig,
      mon: stats.mon, mat: stats.mat,
      fsp: stats.fsp, tpm: stats.tpm, tpb: stats.tpb, adm: stats.adm, mod: stats.mod, rin: stats.rin, imm: stats.imm,
      cityEntityId: entityId,
      isGreatBuilding: isGreatBuildingId(entityId),
      // isInactive resta false DELIBERATAMENTE, senza chiamare
      // isInactiveBuildingId(entityId): questo factory crea fallback solo per
      // entità ASSENTI dal CSV, mentre gli edifici "inattivi" (W_*Decoration)
      // sono per definizione edifici normali del catalogo, censiti nel CSV con
      // le loro statistiche — quindi non passano mai di qui. Se un giorno Inno
      // producesse un W_*Decoration non ancora nel CSV, apparirebbe come
      // fallback normale (senza il colore viola "inattivo") finché il CSV non
      // viene aggiornato: degradazione accettabile, non un bug.
      isInactive: false,
      // isFallback resta false: i dati produzione sono completi (estratti da
      // CityEntities), quindi le celle non devono mostrare "?". isUnresolved
      // (badge UNKNOWN) era già gestito separatamente e qui non si applica.
      isFallback: false,
      isMilitary: isMilitaryBuildingId(entityId),
      isGoods: isGoodsFactoryId(entityId)
    };
  }
}
