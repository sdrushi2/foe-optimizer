import type { RawAlly, InventoryItem } from "./bookmarklet";
import { LANGUAGES, type Lang } from "./languages";

export interface Ally {
  id: string;
  /** Nomi per lingua, letti dinamicamente dalle colonne Nome* del CSV (vedi
   *  languages.ts). L'inglese è garantito presente (fallback all'id). */
  names: Partial<Record<Lang, string>>;
  rarity: number;
  /** Livello massimo dal CSV. Oggi è sempre 100 e NESSUN consumer lo legge
   *  (i maxLevel visibili in App.tsx sono dei Grandi Edifici): tenuto
   *  deliberatamente perché Inno potrebbe variarlo in futuro — non è una
   *  dimenticanza. */
  maxLevel: number;
  val1: number;
  general: [number, number, number, number];
  gbg: [number, number, number, number];
  sped: [number, number, number, number];
  iq: [number, number, number, number];
  /** Descrizione testuale dell'abilità speciale dell'alleato, per lingua
   *  (colonne abilityIta/abilityEng del CSV). Vuota per la maggior parte
   *  degli alleati (solo alcuni hanno un'abilità speciale documentata).
   *  CONTRATTO CON LA PIPELINE: il rendering (AllyRarityName in App.tsx)
   *  mostra abilityIta per lingua "it" SENZA fallback su abilityEng — regge
   *  perché è allies.py (RECUPERO DATI) a garantire che abilityIta sia
   *  sempre valorizzata quando esiste l'inglese (fallback fatto lato
   *  pipeline). Se si tocca quella logica, questo è il punto che si rompe. */
  abilityIta: string;
  abilityEng: string;
}

export interface ImportedAlly {
  jsonId: number;
  allyId: string;
  rarity: number;
  level: number;
  isPlaced: boolean;
  isFragment: boolean;
  fragmentCount: number;
  /** entityId dell'edificio in città dove è posizionato l'alleato (da CityMapData). */
  placedInEntityId?: string;
  /** Id grezzo dell'istanza sulla mappa (chiave in CityMapData/cityMap), NON il
   *  tipo di edificio: permette di distinguere QUALE copia specifica, tra più
   *  istanze dello stesso cityEntityId, ospita questo alleato. */
  placedInMapEntityId?: string;
}

// Statistiche calcolate di un alleato (incluse le ereditarietà di rarità inferiore)
export interface ComputedAllyStats {
  computedGeneral: [number, number, number, number];
  computedGbg: [number, number, number, number];
  computedSped: [number, number, number, number];
  computedIq: [number, number, number, number];
}

export function parseAlliesCsv(csv: string): Ally[] {
  // Rimuovi BOM UTF-8 e gestisci sia LF che CRLF (file risalvati da Excel/Sheets
  // usano CRLF: senza questo, l'id della prima colonna manterrebbe un \r finale
  // e tutti i match `id__rarity` fallirebbero silenziosamente).
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(line => line.trim() !== "");
  const header = (lines[0] ?? "").split(";").map(h => h.trim());
  const rows = lines.slice(1);

  // Lookup per nome colonna (non per indice fisso): a prova di riordini o
  // aggiunte future di colonne nel CSV. I nomi (NomeIta/NomeEng/...) sono
  // risolti dinamicamente più sotto via availableLangs/LANGUAGES.
  const colIndex = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const idxId = colIndex("Id");
  // Lingue disponibili in questo CSV: una entry in LANGUAGES (languages.ts)
  // diventa effettiva solo se la sua colonna Nome* esiste nell'header.
  // Aggiungere una lingua non richiede toccare questo parser.
  const availableLangs = LANGUAGES
    .map(l => ({ code: l.code, idx: colIndex(l.csvColumn) }))
    .filter(l => l.idx >= 0);
  const idxRarity = colIndex("Rarity");
  const idxMaxLevel = colIndex("MaxLevel");
  const idxVal1 = colIndex("Val1");
  const idxGenAtkA = colIndex("GenAtk_A");
  const idxGenDefA = colIndex("GenDef_A");
  const idxGenAtkD = colIndex("GenAtk_D");
  const idxGenDefD = colIndex("GenDef_D");
  const idxCampiAtkA = colIndex("CampiAtk_A");
  const idxCampiDefA = colIndex("CampiDef_A");
  const idxCampiAtkD = colIndex("CampiAtk_D");
  const idxCampiDefD = colIndex("CampiDef_D");
  const idxSpedAtkA = colIndex("SpedAtk_A");
  const idxSpedDefA = colIndex("SpedDef_A");
  const idxSpedAtkD = colIndex("SpedAtk_D");
  const idxSpedDefD = colIndex("SpedDef_D");
  // Colonne IQ non ancora presenti nel file: se assenti, default a 0
  // (predisposte per futuri boost IQ degli alleati, categoria guild_raids).
  const idxIQAtkA = colIndex("IQAtk_A");
  const idxIQDefA = colIndex("IQDef_A");
  const idxIQAtkD = colIndex("IQAtk_D");
  const idxIQDefD = colIndex("IQDef_D");
  const idxAbilityIta = colIndex("abilityIta");
  const idxAbilityEng = colIndex("abilityEng");

  // Helper: converte una colonna CSV in numero, restituisce 0 se assente o NaN
  const toNumber = (s: string | undefined) => parseFloat(s || "") || 0;
  const at = (cols: string[], idx: number) => (idx >= 0 ? cols[idx] : undefined);

  // Callback tipizzato `: Ally` (stesso pattern di parseBuildingsCsv): senza,
  // l'assegnazione alla const perderebbe la tipizzazione contestuale e le
  // quadruple diventerebbero number[] invece di [number, number, number, number].
  const allies = rows.map((line): Ally => {
    const cols = line.split(";");
    const id = at(cols, idxId) || "";
    const names: Partial<Record<Lang, string>> = {};
    for (const lang of availableLangs) {
      const value = (at(cols, lang.idx) || "").trim();
      if (value) names[lang.code] = value;
    }
    // L'inglese è garantito: se la colonna manca o è vuota, usa l'id.
    if (!names.en) names.en = id;
    return {
      id,
      names,
      rarity: parseInt(at(cols, idxRarity) || "0", 10),
      maxLevel: parseInt(at(cols, idxMaxLevel) || "0", 10),
      val1: toNumber(at(cols, idxVal1)),
      general: [toNumber(at(cols, idxGenAtkA)), toNumber(at(cols, idxGenDefA)), toNumber(at(cols, idxGenAtkD)), toNumber(at(cols, idxGenDefD))],
      gbg:     [toNumber(at(cols, idxCampiAtkA)), toNumber(at(cols, idxCampiDefA)), toNumber(at(cols, idxCampiAtkD)), toNumber(at(cols, idxCampiDefD))],
      sped:    [toNumber(at(cols, idxSpedAtkA)), toNumber(at(cols, idxSpedDefA)), toNumber(at(cols, idxSpedAtkD)), toNumber(at(cols, idxSpedDefD))],
      iq: idxIQAtkA >= 0
        ? [toNumber(at(cols, idxIQAtkA)), toNumber(at(cols, idxIQDefA)), toNumber(at(cols, idxIQAtkD)), toNumber(at(cols, idxIQDefD))]
        : [0, 0, 0, 0],
      abilityIta: (at(cols, idxAbilityIta) || "").trim(),
      abilityEng: (at(cols, idxAbilityEng) || "").trim(),
    };
  });

  // Fail fast su righe duplicate id+rarity (stesso schema di ages.ts): un
  // duplicato vincerebbe silenziosamente l'ultimo in ALLIES_BY_ID_RARITY ma
  // verrebbe sommato DUE volte nell'ereditarietà (INHERITED_ALLIES_MAP
  // raccoglie tutte le righe con rarity <= r), gonfiando le statistiche
  // senza alcun segnale visibile. Errore in inglese: diagnostica interna.
  const seen = new Set<string>();
  for (const a of allies) {
    const k = `${a.id}__${a.rarity}`;
    if (seen.has(k)) throw new Error(`allies.csv: duplicate row for ${k}`);
    seen.add(k);
  }

  return allies;
}

export function parseAllyData(allyData: Record<string, RawAlly>, rarityMap: Record<string, number>, cityMapData?: Record<string, { cityentity_id?: unknown }>): ImportedAlly[] {
  const allies: ImportedAlly[] = [];
  if (!allyData || typeof allyData !== "object") return allies;
  for (const entry of Object.values(allyData)) {
    if (!entry || entry.__class__ !== "Ally" || !entry.allyId) continue;
    const rarityValue = entry.rarity?.value ?? "";
    const rarity = rarityMap[rarityValue] ?? 0;
    if (!rarity) continue;
    // `!= null` (non `"mapEntityId" in entry`): un ipotetico mapEntityId: null
    // nel payload produrrebbe String(null) === "null" e un isPlaced spurio.
    // Nei dati reali il campo è un numero; String() lo converte alla chiave
    // stringa di CityMapData (le chiavi degli oggetti JSON sono stringhe).
    const rawMapId = entry.mapEntityId != null ? String(entry.mapEntityId) : undefined;
    const placedInEntityId = rawMapId && cityMapData
      ? (cityMapData[rawMapId]?.cityentity_id != null ? String(cityMapData[rawMapId].cityentity_id) : undefined)
      : undefined;
    allies.push({
      jsonId: entry.id ?? 0,
      allyId: String(entry.allyId),
      rarity,
      level: entry.level ?? 0,
      isPlaced: rawMapId !== undefined,
      isFragment: false,
      fragmentCount: 0,
      placedInEntityId,
      placedInMapEntityId: rawMapId,
    });
  }
  return allies;
}

export function parseAllyFragments(inventoryItems: InventoryItem[], rarityMap: Record<string, number>): ImportedAlly[] {
  const fragmentMap = new Map<string, { allyId: string; rarity: number; count: number }>();
  
  for (const item of inventoryItems) {
    if (!item || typeof item !== "object") continue;
    const reward = item.item?.reward;
    if (!reward) continue;
    const assembled = reward.assembledReward;
    if (!assembled || assembled.type !== "ally") continue;
    
    const allyId = assembled.subType;
    const rarityValue = assembled.rarity?.value ?? "";
    const rarity = rarityMap[rarityValue] ?? 0;
    const inStock = Number(item.inStock ?? 0);
    
    if (!allyId || !rarity || inStock <= 0) continue;
    
    const key = `${allyId}__${rarity}`;
    const existing = fragmentMap.get(key);
    if (existing) {
      existing.count += inStock;
    } else {
      fragmentMap.set(key, { allyId, rarity, count: inStock });
    }
  }
  
  // jsonId fisso a 0: il campo è richiesto dal tipo ImportedAlly ma per i
  // frammenti non è letto da nulla — la key di React in tabella è
  // `frag-${id}-${rarity}` (App.tsx), non jsonId. (In passato qui c'era un
  // hash della chiave allyId__rarity, rimasto orfano quando la key è
  // cambiata; nei profili salvati il vecchio valore è inerte.)
  return [...fragmentMap.values()].map((frag) => ({
    jsonId: 0,
    allyId: frag.allyId,
    rarity: frag.rarity,
    level: 0,
    isPlaced: false,
    isFragment: true,
    fragmentCount: frag.count,
  }));
}

/**
 * Informazioni di display per ogni livello di rarità (1-5).
 * Unico punto del codice che conosce nomi localizzati, etichette brevi,
 * colori CSS e stelle per ogni rarità. Se Inno aggiunge nuove rarità o
 * se si vuole cambiare l'estetica, si tocca SOLO qui.
 */
export const RARITY_DISPLAY: Record<number, {
  nameIt: string;
  nameEn: string;
  label: string;
  stars: string;
  textColor: string;
  borderColor: string;
  badgeOn: string;
  badgeOff: string;
}> = {
  1: { nameIt: "Comune",      nameEn: "Common",    label: "COM", stars: " ☆",        textColor: "",                  borderColor: "border-slate-400",   badgeOn: "border-slate-400 bg-slate-500/20 text-slate-200",   badgeOff: "border-slate-700/50 bg-slate-800/30 text-slate-500" },
  2: { nameIt: "Non comune",  nameEn: "Uncommon",  label: "UNC", stars: " ⭐",       textColor: "text-emerald-400",  borderColor: "border-emerald-400", badgeOn: "border-emerald-400 bg-emerald-500/20 text-emerald-200", badgeOff: "border-slate-700/50 bg-slate-800/30 text-slate-500" },
  3: { nameIt: "Raro",        nameEn: "Rare",       label: "RAR", stars: " ⭐⭐",    textColor: "text-blue-400",     borderColor: "border-blue-400",    badgeOn: "border-blue-400 bg-blue-500/20 text-blue-200",     badgeOff: "border-slate-700/50 bg-slate-800/30 text-slate-500" },
  4: { nameIt: "Epico",       nameEn: "Epic",       label: "EPI", stars: " ⭐⭐⭐",  textColor: "text-violet-400",   borderColor: "border-violet-400",  badgeOn: "border-violet-400 bg-violet-500/20 text-violet-200", badgeOff: "border-slate-700/50 bg-slate-800/30 text-slate-500" },
  5: { nameIt: "Leggendario", nameEn: "Legendary",  label: "LEG", stars: " ⭐⭐⭐⭐", textColor: "text-amber-400",    borderColor: "border-amber-400",   badgeOn: "border-amber-400 bg-amber-500/20 text-amber-200",  badgeOff: "border-slate-700/50 bg-slate-800/30 text-slate-500" },
};

/** Lista ordinata dei livelli di rarità (per iterazione UI, filtri, ordinamenti). */
export const RARITY_LEVELS = [1, 2, 3, 4, 5] as const;

/** Nome localizzato di una rarità. */
export function rarityName(rarity: number, lang: Lang): string {
  const d = RARITY_DISPLAY[rarity];
  if (!d) return String(rarity);
  return lang === "it" ? d.nameIt : d.nameEn;
}


// Al livello 63 Inno ha introdotto una discontinuità nella progressione degli alleati:
// i livelli 1-62 seguono val1 + level - 1, dal livello 63 in poi val1 + level
// (effettivamente +1 extra rispetto alla progressione lineare precedente).
const LEVEL_BREAKPOINT = 62;

function getAllyStatValue(multiplier: number, ally: Ally, level: number): number {
  if (!multiplier || level <= 0) return 0;
  const baseValue = level <= LEVEL_BREAKPOINT ? ally.val1 + level - 1 : ally.val1 + level;
  return multiplier * baseValue;
}

export function getComputedAllyStats(ally: Ally, level: number, inheritedAlliesMap: Map<string, Ally[]>): ComputedAllyStats {
  const inherited = inheritedAlliesMap.get(`${ally.id}__${ally.rarity}`) ?? [ally];

  // Helper: somma il valore della categoria `key` all'indice `i` su tutti gli alleati ereditati.
  type StatCategory = "general" | "gbg" | "sped" | "iq";
  const sumCategory = (key: StatCategory, i: number) =>
    inherited.reduce((s, a) => s + getAllyStatValue(a[key][i], a, level), 0);

  const cat = (key: StatCategory): [number, number, number, number] =>
    [sumCategory(key, 0), sumCategory(key, 1), sumCategory(key, 2), sumCategory(key, 3)];

  return {
    computedGeneral: cat("general"),
    computedGbg:     cat("gbg"),
    computedSped:    cat("sped"),
    computedIq:      cat("iq"),
  };
}
