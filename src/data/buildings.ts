import { LANGUAGES, type Lang } from "./languages";
import { isGreatBuildingId, isMilitaryBuildingId, isInactiveBuildingId, isGoodsFactoryId } from "./buildingClassification";

export interface Building {
  id: string;
  name: string;
  /** Nomi per lingua, letti dinamicamente dalle colonne Nome* del CSV (vedi
   *  languages.ts). È la fonte di verità per i nomi: aggiungere una lingua
   *  non richiede toccare questa interfaccia. Il campo `name` qui sopra resta
   *  come nome "grezzo" di fallback (italiano se presente, altrimenti inglese,
   *  altrimenti l'id) usato quando serve un nome senza passare per la
   *  traduzione localizzata via displayName(). */
  names: Partial<Record<Lang, string>>;
  /** Hash/nome-file dell'asset immagine dal CSV. Due formati: hex puro
   *  (es. "026325675") o nome file completo con "-" (es.
   *  "L_AllAge_CupBonus1-2b911bbae"). Interpretato da getImageUrl(). Vuoto
   *  per gli edifici senza immagine (es. i "Dummy"). */
  hash: string;
  /** true se l'edificio fa parte del set "principale" (823 edifici storici,
   *  Lin=1 nel CSV); false per i livelli intermedi/varianti aggiunti dopo.
   *  Usato dallo switch LIGHT/FULL nella tab Info. */
  lin: boolean;
  time: number;
  size: string; // es. "3x5" (solo per visualizzazione)
  area: number; // es. 15 (per ordinamento e logica)
  road: number;
  pop: number;
  fel: number;
  general: [number, number, number, number];
  gbg: [number, number, number, number];
  sped: [number, number, number, number];
  iq: [number, number, number, number];
  /** Boost % monete IQ (Incursioni Quantistiche), es. 0.04 = +4%. */
  iqMonB: number;
  /** Boost % materiali IQ, es. 0.02 = +2%. */
  iqMatB: number;
  /** Monete prodotte nella sezione IQ. */
  iqMon: number;
  /** Materiali prodotti nella sezione IQ. */
  iqMat: number;
  iqBeni: number;
  iqTruppe: number;
  iqAzioni: number;
  iqCap: number;
  ally: number;
  fp: number;
  fpb: number;
  fur: number;
  tr: number;
  trne: number;
  beni: number;
  benip: number;
  benis: number;
  benib: number;
  benig: number;
  /** Monete prodotte giornalmente (produzione generica, non IQ). */
  mon: number;
  /** Materiali prodotti giornalmente (produzione generica, non IQ). */
  mat: number;
  bp: number;
  fsp: number;
  tpm: number;
  tpb: number;
  adm: number;
  mod: number;
  rin: number;
  imm: number;
  cityEntityId: string;
  isGreatBuilding?: boolean;
  /** True se l'edificio è attualmente "inattivo" (W_*Decoration nell'id):
   *  un edificio normale del catalogo, censito qui con tutte le sue
   *  statistiche, che il gioco ha declassato a puro ornamento dopo la fine
   *  di un evento a tempo. Non è una decorazione vera (quelle hanno
   *  prefisso D_, possono essere nel CSV o no a seconda della versione, e
   *  non sono mai in questo stato "inattivo"). */
  isInactive?: boolean;
  isFallback?: boolean;
  isMilitary?: boolean;
  /** True se l'edificio è una fabbrica di beni (prefisso "G_"). */
  isGoods?: boolean;
  /** true solo se nessuna fonte (CSV né CityEntities) ha fornito dati reali:
   *  l'edificio è un placeholder vuoto con tutti i valori a 0. Mostra badge
   *  UNKNOWN. Distinto da isFallback (che vale anche per building da CityEntities
   *  la cui struttura produzione non è ancora estratta). */
  isUnresolved?: boolean;
  fragments: string;
}

// Funzioni di utilità per il parsing del CSV
function parseCsvNumber(value: string): number {
  if (!value) return 0;
  // Il CSV usa la virgola come separatore decimale (es. "1,5") e NON usa
  // separatori delle migliaia. Se in futuro i dati contenessero migliaia
  // (es. "1.234,5" all'italiana o "1,234.5" all'inglese), questa logica
  // andrebbe rivista: qui assumiamo al massimo un separatore decimale.
  let cleaned = value.trim();
  // Normalizza la virgola decimale in punto. Sostituiamo solo l'ultima
  // occorrenza per non corrompere eventuali separatori delle migliaia.
  const lastComma = cleaned.lastIndexOf(",");
  if (lastComma >= 0) {
    cleaned = cleaned.slice(0, lastComma).replace(/[.,]/g, "") + "." + cleaned.slice(lastComma + 1);
  }
  return parseFloat(cleaned) || 0;
}

function roadFromSize(size: string): number {
  const [w, h] = size.toLowerCase().split("x").map(Number);
  if (!w || !h) return 0;
  return Math.min(w, h) / 2;
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentField = "";
  let inQuotes = false;
  let currentRow: string[] = [];

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ";") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\n" || char === "\r") {
        currentRow.push(currentField);
        if (currentRow.some(f => f.trim() !== "")) rows.push(currentRow);
        currentField = "";
        currentRow = [];
        if (char === "\r" && nextChar === "\n") i++;
      } else {
        currentField += char;
      }
    }
  }
  if (currentRow.length > 0 || currentField !== "") {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

/** Base URL del CDN delle immagini statiche degli edifici (path fisso). */
const IMAGE_BASE_URL = "https://foezz.innogamescdn.com/assets/city/buildings/";

/**
 * Costruisce l'URL dell'immagine statica di un edificio a partire dal suo id
 * e dal campo hash del CSV. Gestisce i due formati di hash:
 *
 * 1. Hash "esteso" (contiene "-", es. "L_AllAge_CupBonus1-2b911bbae"): è già
 *    il nome file completo (nomefile-hash), quindi l'URL è semplicemente
 *    base + hash + ".png".
 *
 * 2. Hash "hex" (solo esadecimale, es. "026325675"): il nome file si ricava
 *    dall'id inserendo "_SS" dopo la prima lettera, es. "A_ArcticFuture_Culture1"
 *    diventa "A_SS_ArcticFuture_Culture1", a cui si aggiunge "-" + hash + ".png".
 *
 * Restituisce null se l'hash è assente (edificio senza immagine, es. i "Dummy").
 */
export function getImageUrl(id: string, hash: string): string | null {
  const h = (hash || "").trim();
  if (!h) return null;

  // Inserisce "SS_" dopo il primo "_" nel nome file (es. "R_MultiAge_..." →
  // "R_SS_MultiAge_..."). Vale per entrambi i formati:
  // - Formato esteso (hash con "-"): il nome file è già nell'hash, es.
  //   "R_MultiAge_CulturalBuilding6e-874de2306" → usa quello come base.
  // - Formato hex (hash senza "-"): il nome file è costruito dall'id,
  //   es. id="W_MultiAge_CupBonus1", hash="2b911bbae" →
  //   base = "W_MultiAge_CupBonus1-2b911bbae".
  // In entrambi i casi, SS_ viene iniettato dopo il primo "_".
  const baseName = h.includes("-") ? h : (id ? `${id}-${h}` : null);
  if (!baseName) return null;
  const underscoreIdx = baseName.indexOf("_");
  if (underscoreIdx === -1) return null;
  const fileName = baseName.slice(0, underscoreIdx + 1) + "SS_" + baseName.slice(underscoreIdx + 1);
  return `${IMAGE_BASE_URL}${fileName}.png`;
}

/**
 * Parser del file buildings.csv.
 * Trasforma il database testuale in oggetti Building tipizzati e pronti all'uso.
 *
 * I nomi (NomeIta/NomeEng) sono colonne del CSV stesso: non serve più un file
 * di traduzione separato. NomeEng è sempre presente per costruzione (se un
 * CityEntityId esiste, ha un nome inglese); NomeIta può mancare, nel qual
 * caso si usa NomeEng come fallback.
 */
export function parseBuildingsCsv(csv: string): Building[] {
  const cleanCsv = csv.replace(/^\uFEFF/, "");
  const rows = parseCsvRows(cleanCsv);
  const header = rows[0] ?? [];

  // Mappa nome-colonna (lowercase) -> indice, calcolata UNA volta. Prima si
  // faceva una findIndex sull'header per ogni campo di ogni riga (~40 campi ×
  // migliaia di righe × ~50 colonne): qui diventa un lookup O(1) su Map.
  const colIndexByName = new Map<string, number>();
  header.forEach((value, i) => {
    const key = value.trim().toLowerCase();
    if (!colIndexByName.has(key)) colIndexByName.set(key, i);
  });
  const columnIndex = (name: string) => colIndexByName.get(name.toLowerCase()) ?? -1;

  const getText = (parts: string[], name: string, defaultValue = "") => {
    const index = columnIndex(name);
    return index >= 0 ? (parts[index] || defaultValue).trim() : defaultValue;
  };

  const getNumber = (parts: string[], name: string) => {
    const index = columnIndex(name);
    return parseCsvNumber(index >= 0 ? parts[index] : "");
  };

  // Quali lingue di LANGUAGES hanno davvero una colonna in questo CSV.
  // Calcolato una volta: una lingua non ancora aggiunta al CSV (es. "de"
  // prima che esista NomeDeu) viene semplicemente ignorata, zero costo extra.
  const availableLangs = LANGUAGES.filter(l => columnIndex(l.csvColumn) >= 0);

  return rows.slice(1).map((parts, index) => {
    const cityEntityId = (parts[0] || "").trim();
    const size = getText(parts, "Size", "1x1");
    // Calcolo area una tantum
    const [wStr, hStr] = size.toLowerCase().split("x");
    const area = (parseInt(wStr) || 1) * (parseInt(hStr) || 1);
    
    // Calcolo strada: se l'edificio la richiede (valore > 0 nel CSV), 
    // il valore effettivo è la metà del minimo tra larghezza e altezza.
    const csvRoad = getNumber(parts, "Road");
    const road = csvRoad > 0 ? roadFromSize(size) : 0;

    // Nomi per lingua: una entry in names per ogni colonna Nome* presente nel
    // CSV. L'inglese è garantito (fallback all'id se manca); le altre lingue
    // restano semplicemente assenti dalla mappa se la colonna non c'è.
    const names: Partial<Record<Lang, string>> = {};
    for (const lang of availableLangs) {
      const value = getText(parts, lang.csvColumn);
      if (value) names[lang.code] = value;
    }
    const nameEn = names.en || cityEntityId;
    names.en = nameEn;
    const name = names.it || nameEn; // nome grezzo di fallback: it se presente, altrimenti en

    return {
      id: String(index + 1),
      cityEntityId,
      name,
      names,
      hash: getText(parts, "Hash"),
      lin: getText(parts, "Lin") === "1",
      time: getNumber(parts, "Time"),
      size,
      area,
      road,
      pop: getNumber(parts, "Pop"),
      fel: getNumber(parts, "Fel"),
      fp: getNumber(parts, "PF"),
      fpb: getNumber(parts, "PFB"),
      fur: getNumber(parts, "FUR"),
      tr: getNumber(parts, "TR"),
      trne: getNumber(parts, "TRNE"),
      beni: getNumber(parts, "Beni"),
      benip: getNumber(parts, "BeniP"),
      benis: getNumber(parts, "BeniS"),
      benib: getNumber(parts, "BeniB"),
      benig: getNumber(parts, "BeniG"),
      mon: getNumber(parts, "Mon"),
      mat: getNumber(parts, "Mat"),
      bp: getNumber(parts, "BP"),
      general: [
        getNumber(parts, "GenAtk_A"),
        getNumber(parts, "GenDef_A"),
        getNumber(parts, "GenAtk_D"),
        getNumber(parts, "GenDef_D"),
      ],
      gbg: [
        getNumber(parts, "CampiAtk_A"),
        getNumber(parts, "CampiDef_A"),
        getNumber(parts, "CampiAtk_D"),
        getNumber(parts, "CampiDef_D"),
      ],
      sped: [
        getNumber(parts, "SpedAtk_A"),
        getNumber(parts, "SpedDef_A"),
        getNumber(parts, "SpedAtk_D"),
        getNumber(parts, "SpedDef_D"),
      ],
      iq: [
        getNumber(parts, "IQAtk_A"),
        getNumber(parts, "IQDef_A"),
        getNumber(parts, "IQAtk_D"),
        getNumber(parts, "IQDef_D"),
      ],
      iqMonB: getNumber(parts, "IQmonB"),
      iqMatB: getNumber(parts, "IQmatB"),
      iqMon: getNumber(parts, "IQmon"),
      iqMat: getNumber(parts, "IQmat"),
      iqBeni: getNumber(parts, "IQBeni"),
      iqTruppe: getNumber(parts, "IQTruppe"),
      iqAzioni: getNumber(parts, "IQAzioni"),
      iqCap: getNumber(parts, "IQCap"),
      ally: getNumber(parts, "Ally"),
      fsp: getNumber(parts, "FSP"),
      tpm: getNumber(parts, "TPM"),
      tpb: getNumber(parts, "TPB"),
      adm: getNumber(parts, "ADM"),
      mod: getNumber(parts, "MOD"),
      rin: getNumber(parts, "RIN"),
      imm: getNumber(parts, "IMM"),
      fragments: getText(parts, "Fragments"),
      isGreatBuilding: isGreatBuildingId(cityEntityId),
      isInactive: isInactiveBuildingId(cityEntityId),
      isMilitary: isMilitaryBuildingId(cityEntityId),
      isGoods: isGoodsFactoryId(cityEntityId),
      isFallback: false,
    } as Building;
  });
}
