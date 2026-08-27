import { LANGUAGES, type Lang } from "./languages";
import { isGreatBuildingId, isMilitaryBuildingId, isInactiveBuildingId, isGoodsFactoryId } from "./buildingClassification";
import { isUniqueBuildingId } from "./uniqueBuildings";

/** Bit noti di components.AllAge.flags.flags nel MainParser (agosto 2026),
 *  confermati da Linnun leggendo il codice client minificato (non solo per
 *  deduzione empirica) — vedi buildings.py in RECUPERO DATI (commento sopra
 *  extract_flags()) per la mappa completa e la storia dell'indagine. Solo
 *  ERA_MUTABLE e NO_RUSH sono consumati oggi (vedi getter
 *  `noRush`/`isEraMutable` sotto, che leggono `KNOWN_FLAGS.ERA_MUTABLE`/
 *  `KNOWN_FLAGS.NO_RUSH`); gli altri sono qui pronti per quando servirà un
 *  secondo badge/filtro, senza dover più toccare la pipeline Python né
 *  rigenerare il CSV. bit 0/1/4 sono presenti sulla stragrande maggioranza
 *  degli edifici (99.9%/100%/92.6%): poco utili come discriminanti da soli.
 *  Raggruppati in un oggetto (invece di 6 `const` separate) apposta: TypeScript
 *  segnala errore su una `const` MAI letta da nessuno (non solo un warning
 *  come knip su un `export` inutilizzato) — i 4 bit ancora "di riserva" non
 *  sono letti da nessun punto del codice, quindi come costanti isolate
 *  romperebbero la build. Come proprietà di un oggetto restano vive,
 *  documentate e consultabili (`KNOWN_FLAGS.SELLABLE` ecc.) senza quell'obbligo.
 *  Niente `export`: nessun altro modulo importa questi bit — rimosso durante
 *  la pulizia knip (agosto 2026). Se in futuro serve un secondo badge/filtro
 *  basato su uno di questi bit, va semplicemente riaggiunto `export`. */
const KNOWN_FLAGS = {
  SELLABLE: 1,      // bit 0 — isSellable
  MOVABLE: 2,       // bit 1 — isMovable
  ERA_MUTABLE: 4,   // bit 2 — isEraMutable ("auto-aging")
  PLUNDERABLE: 8,   // bit 3 — isPlunderable
  STORABLE: 16,     // bit 4 — isStorable
  NO_RUSH: 32,      // bit 5 — fspDisabled ("Instant production finish disabled")
} as const;

/** True se `flags` ha il bit `flag` acceso. `flags` undefined (edificio
 *  senza AllAge.flags nel MainParser) → sempre false per qualsiasi bit.
 *  Niente `export`: usata solo all'interno di questo file. */
function hasFlag(flags: number | undefined, flag: number): boolean {
  return flags !== undefined && (flags & flag) !== 0;
}

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
  /** Numero di slot alleato (0, 1, 2...). Derivato da allyType.length: NON
   *  è una colonna separata nel CSV (evita di duplicare lo stesso dato in
   *  due punti che potrebbero disallinearsi) — vedi allyType. */
  ally: number;
  /** Tipo di ciascuno slot alleato, un carattere per slot, nell'ordine del
   *  gioco: "M" = militare, "S" = scientifico (introdotto con
   *  StellarAgeDiscovery, Steelport Warship). "" se l'edificio non ha slot.
   *  Oggi sempre lunga 0 o 1 carattere (nessun edificio ha più di 1 slot),
   *  ma il formato regge anche edifici futuri a più slot misti (es. "MS").
   *  Colonna CSV "Ally" (stesso nome di sempre, contenuto cambiato da
   *  luglio 2026 numero 0/1 a questa stringa — gemello Python:
   *  buildings.py extract_ally_type). */
  allyType: string;
  fp: number;
  fpb: number;
  fur: number;
  tr: number;
  trne: number;
  beni: number;
  benip: number;
  benis: number;
  /** Beni Speciali (agosto 2026): un bene speciale casuale tra quelli
   *  sbloccati fino all'era corrente (random_special_good_up_to_age nel
   *  MainParser), oppure — su un solo edificio noto (Eternal Market -
   *  Galactic Horizon) — il totale per ciascun bene speciale
   *  (each_special_goods_up_to_age). Colonna CSV "BeniSp". Vedi
   *  buildings.py (RECUPERO DATI), commento su GOODS_KEYS["BeniSp"]. */
  benisp: number;
  /** Boost % beni speciali (agosto 2026): boost city-wide alla produzione di
   *  beni speciali, es. 0.05 = +5%. Colonna CSV "BeniSpB". UNICO edificio
   *  noto: W_MultiAge_SUM25E1 (Queen Anne's Legacy). Mirror di `benib`
   *  (goods_production) ma per il BoostHint "special_goods_production" —
   *  vedi buildings.py (RECUPERO DATI), commento su "special_goods_production"
   *  in _extract_goods_stats(). */
  benispb: number;
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
  /** True se l'edificio è nell'elenco "unique.csv" della pipeline esterna:
   *  non ottenibile da nessun kit di selezione/aggiornamento posseduto (es.
   *  i premi diretti di lega oro/argento degli eventi). Vedi
   *  data/uniqueBuildings.ts per la fonte e i dettagli. */
  unique?: boolean;
  /** Valore intero grezzo di components.AllAge.flags.flags (colonna CSV
   *  "Flags", agosto 2026 — prima della colonna dedicata "NoRush" booleana).
   *  undefined se l'edificio non ha quel campo nel MainParser. Non leggere
   *  direttamente: usare `hasFlag(b.flags, KNOWN_FLAGS.X)` o il getter
   *  `noRush` sotto. Salvare il bitmask completo invece di una singola
   *  colonna derivata permette di gestire altri bit (es.
   *  KNOWN_FLAGS.ERA_MUTABLE) senza toccare più la pipeline Python — vedi
   *  il commento sopra KNOWN_FLAGS a inizio file. */
  flags?: number;
  fragments: string;
}

/** True se la produzione dell'edificio NON può essere terminata all'istante
 *  con un item "Termina produzione" (es. FSP/Frammenti di Termina produzione
 *  speciale) — in game: "Instant production finish disabled". Derivato da
 *  `b.flags` (bit 5/KNOWN_FLAGS.NO_RUSH), non un campo salvato sull'oggetto:
 *  stesso identico comportamento di prima (era un booleano valorizzato una
 *  sola volta al parsing, nessuna logica di override città — vedi
 *  buildings.py extract_flags() per il criterio di derivazione lato
 *  pipeline, validato in game), solo ricalcolato al volo da `flags` invece
 *  di essere precalcolato. Nome mantenuto (non
 *  `hasFlag(b.flags, KNOWN_FLAGS.NO_RUSH)` inline) per non dover toccare
 *  tutti i punti d'uso in App.tsx. */
export function noRush(b: Pick<Building, "flags">): boolean {
  return hasFlag(b.flags, KNOWN_FLAGS.NO_RUSH);
}

/** True se l'edificio segue automaticamente l'era della città ("auto-aging":
 *  si aggiorna da solo quando il giocatore entra in una nuova era, senza
 *  bisogno di kit di aggiornamento manuale). Derivato da `b.flags` (bit 2/
 *  KNOWN_FLAGS.ERA_MUTABLE), stesso pattern di `noRush` sopra — nome
 *  ufficiale confermato da Linnun leggendo il codice client, validato
 *  empiricamente su un campione controllato di 18 edifici auto-aging noti
 *  vs 33 non-auto-aging (zero eccezioni) prima ancora della conferma. */
export function isEraMutable(b: Pick<Building, "flags">): boolean {
  return hasFlag(b.flags, KNOWN_FLAGS.ERA_MUTABLE);
}

// Funzioni di utilità per il parsing del CSV
function parseCsvNumber(value: string): number {
  if (!value) return 0;
  // Formato REALE del CSV: decimali col PUNTO (es. "0.5", "1.75") — è la
  // pipeline Python di RECUPERO DATI a scriverli così — e NESSUN separatore
  // delle migliaia. Il ramo virgola qui sotto NON descrive il formato
  // atteso: è una TOLLERANZA deliberata per il caso concreto "CSV aperto e
  // risalvato con Excel in italiano", che converte i decimali in virgole
  // ("0,5"). Verificato empiricamente sul CSV corrente: 807 decimali col
  // punto, zero con la virgola.
  let cleaned = value.trim();
  // Normalizza l'eventuale virgola decimale in punto. Sostituiamo solo
  // l'ultima occorrenza per non corrompere eventuali separatori delle
  // migliaia (che comunque nessuna delle due fonti scrive).
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
    // Stesso filtro applicato alle righe intermedie: una coda di soli ";"
    // in un file senza newline terminale non deve produrre una riga fantasma.
    if (currentRow.some(f => f.trim() !== "")) rows.push(currentRow);
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
    // parts[index] può mancare se questa riga è più corta dell'header
    // (CSV malformato): "" fa collassare parseCsvNumber sul suo default.
    return parseCsvNumber(index >= 0 ? (parts[index] ?? "") : "");
  };

  // Quali lingue di LANGUAGES hanno davvero una colonna in questo CSV.
  // Calcolato una volta: una lingua non ancora aggiunta al CSV (es. "de"
  // prima che esista NomeDeu) viene semplicemente ignorata, zero costo extra.
  const availableLangs = LANGUAGES.filter(l => columnIndex(l.csvColumn) >= 0);

  // Il callback è tipizzato esplicitamente `: Building` (e il return NON usa
  // `as Building`): così tsc verifica strutturalmente il letterale e segnala
  // QUI un eventuale campo mancante quando si aggiunge un campo a Building —
  // questo è il punto 1 della checklist "nuovo campo" e un cast lo
  // nasconderebbe silenziosamente (tutti gli edifici uscirebbero con il campo
  // undefined, come i profili "stale" ma per l'intero catalogo).
  const buildings = rows.slice(1).map((parts, index): Building => {
    const cityEntityId = (parts[0] || "").trim();
    const size = getText(parts, "Size", "1x1");
    // Calcolo area una tantum. Se "size" non contiene "x" (valore CSV
    // malformato, es. solo un numero), lo split produce un solo elemento:
    // wStr resta valido, hStr manca e collassa nel fallback "|| 1" sotto.
    const [wStr, hStr] = size.toLowerCase().split("x");
    const area = (parseInt(wStr ?? "") || 1) * (parseInt(hStr ?? "") || 1);
    
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
      benisp: getNumber(parts, "BeniSp"),
      benispb: getNumber(parts, "BeniSpB"),
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
      ally: getText(parts, "Ally").length,
      allyType: getText(parts, "Ally"),
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
      unique: isUniqueBuildingId(cityEntityId),
      flags: (() => {
        const raw = getText(parts, "Flags");
        if (raw === "") return undefined;
        const n = Number(raw);
        return Number.isFinite(n) ? n : undefined;
      })(),
      isFallback: false,
    };
  });

  // Fail fast su cityEntityId duplicati (stesso schema di ages.ts/allies.ts):
  // un duplicato produrrebbe due righe visibili in tab Database ma un
  // last-wins SILENZIOSO in BUILDING_BY_ID, CSV_ENTITY_IDS_SET e nelle mappe
  // di traduzione. La pipeline non può generarli (le chiavi di CityEntities
  // sono uniche), quindi un duplicato segnala un CSV corrotto/editato a mano.
  // Errore in inglese: diagnostica interna, non testo per l'utente.
  const seen = new Set<string>();
  for (const b of buildings) {
    if (!b.cityEntityId) continue;
    if (seen.has(b.cityEntityId)) throw new Error(`buildings.csv: duplicate CityEntityId ${b.cityEntityId}`);
    seen.add(b.cityEntityId);
  }

  return buildings;
}
