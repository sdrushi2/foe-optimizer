/**
 * Algoritmo di ottimizzazione inventario
 *
 * Input:  kit.json (buildingUpgrades + selectionKits) + l'inventario importato
 *         dal bookmarklet (le mappe invUpg/invSel/invBld costruite da App.tsx;
 *         l'inventario.csv era l'input della versione standalone storica).
 * Output: per ogni "famiglia" (root building), la lista di edifici costruibili
 *         con quantità, livello, e dettaglio dei kit necessari.
 *
 * ── Sui "tier" (regular/silver/golden/platinum) ─────────────────────────────
 * Questa versione NON usa più nomi di tier hardcoded. La nozione di "tier" è
 * derivata interamente dai DATI di kit.json: per una data famiglia, ordiniamo
 * i selection kit posseduti in una catena di "livelli" 0..L confrontando gli
 * insiemi `options` (per inclusione). Se golden_selection_kit_X.options ⊇
 * silver_selection_kit_X.options ⊇ selection_kit_X.options, otteniamo una
 * catena di 3 livelli — indipendentemente da come si chiamano i kit, e anche
 * se in futuro Inno introducesse 10 livelli con nomi mai visti, purché ogni
 * livello "includa" le opzioni del livello precedente (il pattern FoE usato
 * finora). Vedi `computeLevels()` per i dettagli.
 */

import { type Lang, FALLBACK_LANG } from "./languages";

// ── Tipi ───────────────────────────────────────────────────────────────────

export interface KitDataRaw {
  buildingUpgrades: Record<string, KitDef>;
  selectionKits: Record<string, KitDef>;
}

interface KitDef {
  /** Nomi localizzati del kit (almeno `en`, sempre presente dalla beta;
   *  `it` quando il server live italiano lo ha già tradotto). Coerente con il
   *  campo `names` di Building/Ally. La risoluzione lingua→nome avviene in
   *  `initKitData` tramite `kitDisplayName`. */
  names: Partial<Record<Lang, string>>;
  /** Per buildingUpgrades: catena di step; ogni step può essere un singolo
   *  cityEntityId o un array di alternative (multi-variant, es. 11a/11b). */
  steps: Array<string | string[]>;
  /** Per selectionKits: array di cityEntityId/kit producibili dal kit. */
  options?: string[];
}

/** Risolve il nome di un kit nella lingua scelta: lingua richiesta → inglese
 *  (sempre presente) → stringa vuota (il chiamante userà il kit_id come
 *  fallback). Stesso schema di fallback di translateName. */
function kitDisplayName(names: Partial<Record<Lang, string>> | undefined, lang: Lang): string {
  if (!names) return "";
  return names[lang] ?? names[FALLBACK_LANG] ?? "";
}

/** Un segmento di catena: quale kit copre un certo range di step. */
interface PathSegment {
  kit_id: string;
  steps: Array<string | string[]>;
}

/** Un livello appiattito nella catena: quali id ci sono a questo livello. */
interface FlatLevel {
  ids: string[];
}

/** Unità di inventario già presente (INV) — arriva da un building già in
 *  inventario, eventualmente upgradato con kit diretti. */
interface InvUnit {
  qty: number;
  id: string;
  level: number;
  sourceId: string;
  sourceLv: number;
  kitsUsed: string[];
  is_max: boolean;
}

/** Unità costruita "da zero" usando kit di selezione. */
interface FreshUnit {
  level: number;
  qty: number;
  ids: string[];
  is_max: boolean;
  kitsUsed: string[];
}

export interface FamilyResult {
  root: string;
  name: string;
  output: FreshUnit[];
  invRows: InvUnit[];
}

// ── Inizializzazione (da chiamare UNA volta dopo aver caricato kit.json) ───

let BU: Record<string, KitDef> | null = null;
let SK: Record<string, KitDef> | null = null;
let BU_IDS: Set<string> | null = null;
let ALL_BLDS: Set<string> | null = null;
let FIRST_TO_CHAINS: Map<string, Array<{ kit_id: string; name: string; steps: Array<string | string[]> }>> | null = null;
let LAST_TO_CHAINS: Map<string, string[]> | null = null;
let TRUE_ROOTS: string[] | null = null;

// ── Indici inversi (costruiti una volta) per evitare scan O(allSK)/O(roots) ──
// buildingId (a qualsiasi livello di catena) → root della sua mega-catena.
let BLD_TO_ROOT: Map<string, string> | null = null;
// kitId (upgrade o selection) → insieme dei root delle famiglie che il kit tocca.
let KIT_TO_ROOTS: Map<string, Set<string>> | null = null;
// buildingId → selection kit che lo producono come edificio base (per familyName).
let SK_BLDS_BY_BLD: Map<string, string[]> | null = null;
// resourceId (option) → elenco di selection kit le cui `options` includono quel
// resourceId. Indice statico (dipende solo da kit.json), usato in optimizeFamily
// per raccogliere SOLO i selection kit rilevanti per la famiglia corrente invece
// di scorrere l'intero inventario per ogni famiglia (vedi skInfos).
let SK_BY_OPTION: Map<string, string[]> | null = null;
// selection kit → opzioni "STANDALONE": edifici che non compaiono in NESSUNA
// catena di kit.json (né upgrade kit né livelli). Per questi non esiste una
// famiglia-catena, quindi computeAllFamilies emette una famiglia SINTETICA a
// livello singolo per il kit (vedi il blocco dedicato lì). Senza questo indice,
// 26 selection kit reali (set decorativi, kit-scelta di pezzi evento come
// selection_kit_ANNI24CD) risultavano completamente invisibili in tab Inventario.
let SK_STANDALONE_OPTIONS: Map<string, string[]> | null = null;
// Cache dei nomi di famiglia (root → nome), calcolati una volta sola.
let FAMILY_NAME_CACHE: Map<string, string> | null = null;

// Lingua con cui sono stati risolti i nomi all'ultima initKitData. Usata dai
// calcoli di nome-famiglia, che risolvono names→stringa nella lingua corrente.
let KIT_LANG: Lang = "it";

export function initKitData(kit: KitDataRaw, lang: Lang = "it"): void {
  KIT_LANG = lang;
  BU = kit.buildingUpgrades;
  SK = kit.selectionKits;
  BU_IDS = new Set(Object.keys(BU));

  ALL_BLDS = new Set<string>();
  for (const kd of Object.values(BU)) {
    for (const item of kd.steps) {
      if (Array.isArray(item)) item.forEach(b => ALL_BLDS!.add(b));
      else ALL_BLDS.add(item);
    }
  }

  FIRST_TO_CHAINS = new Map();
  for (const [kit_id, kd] of Object.entries(BU)) {
    const first = kd.steps[0];
    const roots = Array.isArray(first) ? first : [first];
    for (const r of roots) {
      if (!FIRST_TO_CHAINS.has(r)) FIRST_TO_CHAINS.set(r, []);
      FIRST_TO_CHAINS.get(r)!.push({ kit_id, name: kitDisplayName(kd.names, lang), steps: kd.steps });
    }
  }

  LAST_TO_CHAINS = new Map();
  for (const [kit_id, kd] of Object.entries(BU)) {
    const last = kd.steps[kd.steps.length - 1];
    const lasts = Array.isArray(last) ? last : [last];
    for (const l of lasts) {
      if (!LAST_TO_CHAINS.has(l)) LAST_TO_CHAINS.set(l, []);
      LAST_TO_CHAINS.get(l)!.push(kit_id);
    }
  }

  TRUE_ROOTS = [...FIRST_TO_CHAINS.keys()].filter(b => !LAST_TO_CHAINS!.has(b));

  // ── Indici inversi per il pre-filtro delle famiglie toccate dall'inventario ──
  // Per ogni root, esploriamo una volta la sua mega-catena (BFS) registrando:
  //  - ogni building che vi compare → BLD_TO_ROOT
  //  - ogni kit che vi compare      → KIT_TO_ROOTS
  // Così, dato l'inventario, sappiamo in O(1) quali root vale la pena ottimizzare.
  BLD_TO_ROOT = new Map();
  KIT_TO_ROOTS = new Map();
  const addKitRoot = (kitId: string, root: string) => {
    let s = KIT_TO_ROOTS!.get(kitId);
    if (!s) { s = new Set(); KIT_TO_ROOTS!.set(kitId, s); }
    s.add(root);
  };
  for (const root of TRUE_ROOTS) {
    // BFS sui building della mega-catena, evitando ri-visite.
    const seen = new Set<string>([root]);
    const queue: string[] = [root];
    BLD_TO_ROOT.set(root, root);
    while (queue.length) {
      const cur = queue.pop()!;
      for (const { kit_id, steps } of FIRST_TO_CHAINS.get(cur) ?? []) {
        addKitRoot(kit_id, root);
        for (const step of steps) {
          const ids = Array.isArray(step) ? step : [step];
          for (const id of ids) {
            if (!BLD_TO_ROOT!.has(id)) BLD_TO_ROOT!.set(id, root);
            if (!seen.has(id)) { seen.add(id); queue.push(id); }
          }
        }
      }
    }
  }

  // Selection kit → root toccati, e indice base-building → selection kit.
  SK_BLDS_BY_BLD = new Map();
  SK_BY_OPTION = new Map();
  SK_STANDALONE_OPTIONS = new Map();
  for (const [sk_id, skd] of Object.entries(SK)) {
    // Opzioni fuori da ogni catena: alimentano le famiglie sintetiche.
    const standalone = (skd.options ?? []).filter(o => !BU_IDS!.has(o) && !ALL_BLDS!.has(o));
    if (standalone.length > 0) SK_STANDALONE_OPTIONS.set(sk_id, standalone);
    for (const o of skd.options ?? []) {
      // Indice resourceId → selection kit (per il filtro mirato in optimizeFamily).
      let byOpt = SK_BY_OPTION.get(o);
      if (!byOpt) { byOpt = []; SK_BY_OPTION.set(o, byOpt); }
      byOpt.push(sk_id);

      if (BU_IDS.has(o)) {
        // È un upgrade kit prodotto dal selection kit: eredita i suoi root.
        const roots = KIT_TO_ROOTS.get(o);
        if (roots) for (const r of roots) addKitRoot(sk_id, r);
      } else if (ALL_BLDS.has(o)) {
        // È un edificio base producibile dal selection kit.
        const root = BLD_TO_ROOT.get(o);
        if (root) addKitRoot(sk_id, root);
        let arr = SK_BLDS_BY_BLD.get(o);
        if (!arr) { arr = []; SK_BLDS_BY_BLD.set(o, arr); }
        arr.push(sk_id);
      }
    }
  }

  FAMILY_NAME_CACHE = new Map();
}

// ── Nome famiglia ──────────────────────────────────────────────────────────

function familyName(root: string): string {
  if (!SK_BLDS_BY_BLD || !SK || !FAMILY_NAME_CACHE || !FIRST_TO_CHAINS) throw new Error("initKitData not called");
  const cached = FAMILY_NAME_CACHE.get(root);
  if (cached !== undefined) return cached;

  // Selection kit che producono direttamente `root` come edificio base.
  // Il candidato "più basilare" è quello con MENO opzioni (i selection kit di
  // tier alto includono come opzioni anche quelle dei tier bassi, quindi ne
  // hanno sempre di più) — nessun bisogno di conoscere i "tier" per nome.
  let best: { totalOpts: number; name: string } | null = null;
  for (const sk_id of SK_BLDS_BY_BLD.get(root) ?? []) {
    const skd = SK[sk_id];
    const cand = { totalOpts: skd.options!.length, name: kitDisplayName(skd.names, KIT_LANG) };
    if (!best || cand.totalOpts < best.totalOpts) best = cand;
  }
  if (best) {
    FAMILY_NAME_CACHE.set(root, best.name);
    return best.name;
  }
  // Fallback: nessun selection kit produce `root` direttamente (raro). Usa il
  // nome del kit di upgrade con PIÙ step — il kit "principale" che copre la
  // salita regolare è tipicamente quello con la catena più lunga.
  const chains = FIRST_TO_CHAINS.get(root) ?? [];
  let mainChain = chains[0];
  for (const c of chains) if (c.steps.length > (mainChain?.steps.length ?? 0)) mainChain = c;
  const name = mainChain?.name ?? root;
  FAMILY_NAME_CACHE.set(root, name);
  return name;
}

// ── Costruzione mega-catena ────────────────────────────────────────────────

function buildMegaChain(root: string): PathSegment[][] {
  if (!FIRST_TO_CHAINS) throw new Error("initKitData not called");
  // Stack DFS (pop) invece di queue.shift() O(n): l'ordine non conta perché
  // raccogliamo tutti i path-foglia. I segmenti sono condivisi per riferimento
  // (immutabili) e ogni path estende il padre — evitiamo copie profonde.
  const stack: Array<{ bld: string; path: PathSegment[] }> = [{ bld: root, path: [] }];
  const paths: PathSegment[][] = [];
  while (stack.length) {
    const { bld, path } = stack.pop()!;
    const chainsHere = FIRST_TO_CHAINS.get(bld) ?? [];
    if (!chainsHere.length) { if (path.length) paths.push(path); continue; }
    for (const { kit_id, steps } of chainsHere) {
      const last = steps[steps.length - 1];
      const lasts = Array.isArray(last) ? last : [last];
      const newPath: PathSegment[] = [...path, { kit_id, steps }];
      let continuing = 0;
      for (const l of lasts) {
        if (FIRST_TO_CHAINS.has(l)) { continuing++; stack.push({ bld: l, path: newPath }); }
      }
      // Se almeno una variante finale è terminale, questo path è un endpoint valido.
      if (continuing < lasts.length) paths.push(newPath);
    }
  }
  return paths;
}

/** Lunghezza di un path = numero totale di transizioni (livelli - 1). */
function pathLength(path: PathSegment[]): number {
  let s = 0;
  for (const seg of path) s += seg.steps.length - 1;
  return s;
}

/** "Forma" di un path = sequenza del numero di step per segmento, usata per
 *  individuare path "fratelli" (rami paralleli) — vedi branch handling sotto.
 *  Non dipende dai tier: due segmenti con lo stesso numero di transizioni
 *  hanno la stessa forma indipendentemente da come si chiamano i kit. */
function pathShape(path: PathSegment[]): string {
  return path.map(seg => seg.steps.length - 1).join(",");
}

function flattenPath(path: PathSegment[]): FlatLevel[] {
  const levels: FlatLevel[] = [];
  for (let si = 0; si < path.length; si++) {
    const { steps } = path[si];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const ids: string[] = Array.isArray(step) ? step : [step];
      if (i === 0) { if (si === 0) levels.push({ ids }); }
      else levels.push({ ids });
    }
  }
  return levels;
}

// ── Livelli dinamici dei selection kit ─────────────────────────────────────

/** Capability set di un selection kit posseduto, ristretto alle risorse
 *  rilevanti per la famiglia corrente (R). */
interface SkInfo {
  sk_id: string;
  qty: number;
  cap: Set<string>;
}

interface LevelInfo {
  /** Numero di livelli "annidati" individuati (0..numLevels-1). 0 se nessuno. */
  numLevels: number;
  /** Per ogni livello L (0..numLevels-1): quantità totale di selection kit
   *  "flessibili" a quel livello. Un kit a livello L può coprire qualsiasi
   *  fabbisogno di livello <= L (i livelli alti includono le opzioni dei
   *  livelli bassi, per costruzione). */
  ws: number[];
  wsNames: string[][];
  /** resourceId (upgrade kit o building base) → livello minimo richiesto
   *  per ottenerlo tramite un selection kit "annidato". Assente = nessun
   *  selection kit annidato lo offre (sentinel = numLevels). */
  resourceLevel: Map<string, number>;
  /** Selection kit posseduti la cui capability set NON è "annidata" nella
   *  catena lineare. Questo NON è un caso raro: capita per i set tematici di
   *  FoE che producono più edifici distinti della stessa famiglia (es. il
   *  "Celtic Forest Set" che offre base + un upgrade specifico di un ramo),
   *  generando cap della stessa dimensione ma con contenuti diversi e quindi
   *  non confrontabili per inclusione. Trattati come pool dedicati:
   *  utilizzabili SOLO per le risorse nella loro cap, mai come sostituti
   *  flessibili verso l'alto — scelta conservativa e sempre corretta (un kit
   *  che offre {A,B} non può coprire un fabbisogno {C} che non possiede). */
  dedicatedPools: Map<string, { qty: number; names: string[] }>;
  resourceDedicated: Map<string, string[]>;
  /** Dimensione massima della capability set fra i selection kit POSSEDUTI di
   *  livello 0. Serve a distinguere un vero selection kit "di famiglia" (che
   *  offre base + prima salita, cap.size >= 2) da un kit jolly che offre solo
   *  l'edificio base (cap.size === 1). 0 se non esiste alcun kit di livello 0.
   *  Usato per decidere se applicare l'alias di compatibilità sulla prima
   *  salita senza inventare upgrade fantasma — vedi optimizeFamily. */
  level0MaxCapSize: number;
}

/**
 * Calcola i "livelli" dei selection kit posseduti per questa famiglia,
 * derivandoli ESCLUSIVAMENTE dall'inclusione fra gli insiemi `options`
 * (intersecati con le risorse rilevanti R = upgrade kit della catena +
 * edificio base).
 *
 * Esempio concettuale (nomi a parte): se
 *   options(A) ∩ R = {base, upg1}
 *   options(B) ∩ R = {base, upg1, upg2silver}
 *   options(C) ∩ R = {base, upg1, upg2silver, upg3gold}
 * allora cap(A) ⊊ cap(B) ⊊ cap(C): A=livello0, B=livello1, C=livello2 — una
 * catena di 3 livelli, quale sia il nome di A/B/C. Con una catena di 10
 * selection kit via via più ricchi otterremmo 10 livelli allo stesso modo.
 *
 * Un selection kit di livello L può sempre sostituire un fabbisogno di
 * livello <= L, perché per costruzione cap(L) ⊇ cap(L-1) ⊇ ... ⊇ cap(0).
 */
function computeLevels(skInfos: SkInfo[]): LevelInfo {
  const capKey = (c: Set<string>): string => [...c].sort().join("\u0001");
  const isProperSubset = (a: Set<string>, b: Set<string>): boolean => {
    if (a.size >= b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  };

  // Insiemi distinti, ordinati per dimensione crescente.
  const distinct = new Map<string, Set<string>>();
  for (const { cap } of skInfos) distinct.set(capKey(cap), cap);
  const sorted = [...distinct.values()].sort((a, b) => a.size - b.size);

  // Catena annidata: avanza finché cap(prev) ⊊ cap(cur) (o ==).
  // Gli insiemi che non si "incastrano" nella catena (caso anomalo) restano
  // fuori da `levelOf` e diventano pool dedicati più sotto.
  const levelOf = new Map<string, number>();
  let level = -1;
  let prev: Set<string> | null = null;
  for (const cap of sorted) {
    const key = capKey(cap);
    if (prev === null) {
      level = 0;
      levelOf.set(key, level);
      prev = cap;
      continue;
    }
    if (capKey(prev) === key) { levelOf.set(key, level); continue; } // stesso insieme = stesso livello
    if (isProperSubset(prev, cap)) {
      level++;
      levelOf.set(key, level);
      prev = cap;
    }
    // else: outlier, gestito sotto come pool dedicato; la catena continua a
    // confrontarsi con `prev` per i candidati successivi (più grandi).
  }
  const numLevels = level + 1; // 0 se nessun cap valido

  const ws: number[] = new Array(numLevels).fill(0);
  const wsNames: string[][] = Array.from({ length: numLevels }, () => []);
  const resourceLevel = new Map<string, number>();
  const dedicatedPools = new Map<string, { qty: number; names: string[] }>();
  const resourceDedicated = new Map<string, string[]>();

  let level0MaxCapSize = 0;
  for (const { sk_id, qty, cap } of skInfos) {
    const lvl = levelOf.get(capKey(cap));
    if (lvl !== undefined) {
      ws[lvl] += qty;
      for (let i = 0; i < qty; i++) wsNames[lvl].push(sk_id);
      if (lvl === 0 && cap.size > level0MaxCapSize) level0MaxCapSize = cap.size;
      for (const r of cap) {
        const cur = resourceLevel.get(r);
        if (cur === undefined || lvl < cur) resourceLevel.set(r, lvl);
      }
    } else {
      // Outlier: pool dedicato, utilizzabile solo per le risorse nella sua cap.
      dedicatedPools.set(sk_id, { qty, names: new Array(qty).fill(sk_id) as string[] });
      for (const r of cap) {
        if (!resourceDedicated.has(r)) resourceDedicated.set(r, []);
        resourceDedicated.get(r)!.push(sk_id);
      }
    }
  }

  return { numLevels, ws, wsNames, resourceLevel, dedicatedPools, resourceDedicated, level0MaxCapSize };
}

// ── Ottimizzatore principale ──────────────────────────────────────────────

function optimizeFamily(
  root: string,
  invUpg: Map<string, number>,
  invSel: Map<string, number>,
  invBld: Map<string, number> = new Map(),
): FamilyResult | null {
  if (!BU || !SK || !FIRST_TO_CHAINS || !BU_IDS || !ALL_BLDS || !SK_BY_OPTION) throw new Error("initKitData not called");

  const paths = buildMegaChain(root);
  if (!paths.length) return null;

  // Seleziona il path più lungo (più livelli = più upgrade possibili).
  let path = paths[0];
  let bestLen = pathLength(path);
  for (let i = 1; i < paths.length; i++) {
    const len = pathLength(paths[i]);
    if (len > bestLen) { bestLen = len; path = paths[i]; }
  }

  const levels = flattenPath(path);
  const n = levels.length;
  if (n <= 1) return null;

  // ── Branch handling ───────────────────────────────────────────────────
  // Alcune famiglie si diramano su PIÙ segmenti consecutivi in parallelo, es.
  //   lv8 -> silver_a -> lv9a -> golden_a -> lv10a
  //   lv8 -> silver_b -> lv9b -> golden_b -> lv10b
  // `path` ne cattura solo UNO. Ogni altro path con la STESSA "forma"
  // (stesso numero di step per segmento) rappresenta un ramo parallelo: lo
  // stesso inventario può completare l'UNO O L'ALTRO — la scelta avviene al
  // momento del riscatto in-game.
  const kitToTargetId = new Map<string, string>();
  const fromIdToKit = new Map<string, string>();

  const mainShape = pathShape(path);
  const mainFinalId = levels[n - 1].ids[0];

  for (const p of paths) {
    if (p === path) continue;
    if (p.length !== path.length) continue;
    if (pathShape(p) !== mainShape) continue; // non è un ramo parallelo
    const pLevels = flattenPath(p);
    if (pLevels.length !== n) continue;

    // Unisci gli id del livello finale di questo ramo come alternative.
    for (const id of pLevels[n - 1].ids)
      if (!levels[n - 1].ids.includes(id)) levels[n - 1].ids.push(id);

    // Per ogni segmento dove il kit di questo ramo differisce da `path`,
    // registra kit -> id finale di questo ramo, e id sorgente -> kit di
    // questo ramo (se specifico). Registra anche il kit di `path` -> il suo
    // proprio id finale, così un'unità che ha usato il kit di `path` per
    // questo step risolve verso mainFinalId.
    for (let i = 0; i < p.length; i++) {
      const seg = p[i];
      if (i < path.length && seg.kit_id === path[i].kit_id) continue; // segmento condiviso
      kitToTargetId.set(seg.kit_id, pLevels[n - 1].ids[0]);
      const segFrom = Array.isArray(seg.steps[0]) ? seg.steps[0] : [seg.steps[0]];
      for (const f of segFrom) if (!fromIdToKit.has(f)) fromIdToKit.set(f, seg.kit_id);
      if (i < path.length && !kitToTargetId.has(path[i].kit_id)) {
        kitToTargetId.set(path[i].kit_id, mainFinalId);
      }
    }
  }

  // ── stepKitId: per ogni step (0-based, n-1 totali) qual è il kit_id che lo copre ──
  const stepKitId: string[] = [];
  {
    let li = 0;
    for (const { kit_id, steps } of path) {
      for (let i = 0; i < steps.length - 1; i++) stepKitId[li + i] = kit_id;
      li += steps.length - 1;
    }
  }

  // ── Pre-compute: consuma invUpg kits, carica edifici inv non-max ──────
  const { maxInvRows, invUnits } = buildInvRows(levels, stepKitId, fromIdToKit, invUpg, invBld, kitToTargetId);

  // ── Resource pools ────────────────────────────────────────────────────
  const allKitsInPath = new Set([...path.map(s => s.kit_id), ...kitToTargetId.keys()]);
  const baseBldIds = levels[0].ids;

  // R = risorse rilevanti per questa famiglia: tutti gli upgrade kit della
  // catena + l'edificio/i base. Un selection kit è "rilevante" se le sue
  // `options` intersecano R.
  const R = new Set<string>([...allKitsInPath, ...baseBldIds]);

  const skInfos: SkInfo[] = [];
  // Determina con l'indice inverso SK_BY_OPTION quali selection kit POSSEDUTI
  // sono rilevanti per questa famiglia (offrono almeno una risorsa di R), così
  // da NON scorrere l'intero inventario per ogni famiglia. Però costruiamo
  // skInfos iterando invSel.keys() nel suo ordine originale: l'algoritmo a valle
  // è sensibile all'ordine di skInfos, quindi preservarlo garantisce risultati
  // identici alla versione che scorreva tutto l'inventario.
  const relevant = new Set<string>();
  for (const r of R) {
    const kitsOfferingR = SK_BY_OPTION.get(r);
    if (kitsOfferingR) for (const sk_id of kitsOfferingR) relevant.add(sk_id);
  }
  for (const sk_id of invSel.keys()) {
    if (!relevant.has(sk_id)) continue;
    const qty = invSel.get(sk_id) ?? 0;
    if (qty <= 0) continue;
    const opts = SK[sk_id]?.options;
    if (!opts) continue;
    const cap = new Set(opts.filter(o => R.has(o)));
    if (cap.size > 0) skInfos.push({ sk_id, qty, cap });
  }

  const { numLevels, ws, wsNames, resourceLevel, dedicatedPools, resourceDedicated, level0MaxCapSize } = computeLevels(skInfos);

  // Selection kit posseduti la cui capability set include DAVVERO un edificio
  // base: solo questi possono materializzare un edificio nuovo a livello 1.
  // Un kit jolly/epico che offre solo upgrade (es. selection_kit_epic_ASC25,
  // che produce upgrade_kit_ascended_FALL25E ma NON l'edificio base) NON può
  // diventare una base — vedi il blocco T===1 più sotto.
  const baseBldIdSet = new Set(baseBldIds);
  const kitsThatOfferBase = new Set<string>();
  for (const { sk_id, cap } of skInfos) {
    for (const c of cap) if (baseBldIdSet.has(c)) { kitsThatOfferBase.add(sk_id); break; }
  }

  // ── Alias di compatibilità per la salita principale ───────────────────
  // NOTA STORICA (luglio 2026): la causa a monte di questo blocco è stata
  // trovata e CORRETTA in parse_kit.py — esportava `itemAssetName` (il nome
  // dell'ASSET grafico, che Inno riusa tra item diversi: 23 casi reali, es.
  // "upgrade_kit_chocolatery" come asset del vero upgrade_kit_W_MultiAge_WIN22A,
  // o l'asset dei kit GR25C sui kit "legend") invece dell'id reale
  // (`upgradeItemId`/`cityEntityId`). Il kit.json rigenerato non contiene più
  // quegli alias. Questo blocco resta come DIFESA IN PROFONDITÀ contro futuri
  // dati anomali: per convenzione FoE, un VERO selection kit "di famiglia" di
  // livello 0 offre {edificio base, salita regolare principale} — quindi se
  // esiste un livello 0 ma nessuna cap referenzia letteralmente `path[0].kit_id`
  // (la salita regolare principale), lo assegniamo comunque al livello 0.
  //
  // ATTENZIONE: questo vale SOLO se il livello 0 contiene davvero un kit che
  // offre più del solo edificio base (cap.size >= 2). Un selection kit "jolly"
  // (es. epico di evento) che produce SOLO l'edificio base ha cap = {base}
  // (size 1): NON abilita alcuna salita. Applicare l'alias in quel caso
  // inventerebbe upgrade fantasma (es. la "Torre Nera" risultava costruibile a
  // livello 2 con soli kit jolly che offrono unicamente la base). La condizione
  // `level0MaxCapSize >= 2` esclude esattamente questo caso.
  if (numLevels >= 1 && level0MaxCapSize >= 2 && !resourceLevel.has(path[0].kit_id)) {
    resourceLevel.set(path[0].kit_id, 0);
  }
  const sentinel = numLevels; // "nessun ws annidato può coprire questo fabbisogno"

  // bldId → indice di livello in cui compare (lookup O(1) al posto di findIndex annidati).
  const bldLevelIndex = new Map<string, number>();
  for (let li = 0; li < levels.length; li++) {
    for (const id of levels[li].ids) if (!bldLevelIndex.has(id)) bldLevelIndex.set(id, li);
  }
  const stepLevelIndex = (step: string | string[]): number => {
    const ids = Array.isArray(step) ? step : [step];
    for (const id of ids) { const li = bldLevelIndex.get(id); if (li !== undefined) return li; }
    return -1;
  };

  // stepLevels[i] = livello richiesto per lo step i (0-based), derivato da
  // resourceLevel del kit che copre quello step.
  const stepLevels: number[] = stepKitId.map(k => resourceLevel.get(k) ?? sentinel);
  // baseLevel = livello richiesto per piazzare l'edificio base.
  let baseLevel = sentinel;
  for (const id of baseBldIds) {
    const lvl = resourceLevel.get(id);
    if (lvl !== undefined && lvl < baseLevel) baseLevel = lvl;
  }

  // wf[i]    = kit di aggiornamento DIRETTO a singolo step (massima priorità).
  // wfFlex[L] = kit di aggiornamento DIRETTO multi-step, applicabile a
  //             qualsiasi step con stepLevels[i] === L (match esatto: un kit
  //             diretto non ha la "flessibilità di sostituzione verso l'alto"
  //             dei selection kit — copre esattamente gli step per cui è stato
  //             concepito).
  const wf: Record<number, number> = {};
  const wfNames: Record<number, string[]> = {};
  const wfFlex: number[] = new Array(numLevels).fill(0);
  const wfFlexNames: string[][] = Array.from({ length: numLevels }, () => []);

  for (const kit_id of allKitsInPath) {
    const q = invUpg.get(kit_id) ?? 0;
    if (!q) continue;
    const kitSteps = BU[kit_id]?.steps ?? [];
    const nTransitions = kitSteps.length - 1;
    if (nTransitions <= 1) {
      const fromLvIdx = stepLevelIndex(kitSteps[0]);
      const toLvIdx = stepLevelIndex(kitSteps[1]);
      if (fromLvIdx >= 0 && toLvIdx === fromLvIdx + 1) {
        wf[fromLvIdx] = (wf[fromLvIdx] ?? 0) + q;
        (wfNames[fromLvIdx] ??= []).push(...new Array(q).fill(kit_id) as string[]);
      }
    } else {
      const lvl = resourceLevel.get(kit_id);
      if (lvl !== undefined && lvl < numLevels) {
        wfFlex[lvl] += q;
        for (let i = 0; i < q; i++) wfFlexNames[lvl].push(kit_id);
      }
      // Altrimenti: kit multi-step il cui livello non è coperto da alcun
      // selection kit annidato posseduto. Caso limite mai osservato in FoE
      // (i kit multi-step sono sempre "di base"/livello0); ignorato.
    }
  }

  // Early-exit: se non c'è alcun kit utilizzabile (né flessibile, né fisso, né
  // multi-step, né dedicato), non c'è nulla da costruire/aggiornare per questa
  // famiglia. (Gli edifici già al massimo in inventario sono comunque emessi
  // più sotto, indipendentemente da questo controllo.)
  const hasAnyWs = ws.some(c => c > 0);
  let hasAnyWf = wfFlex.some(c => c > 0);
  if (!hasAnyWf) for (const k in wf) { if (wf[k] > 0) { hasAnyWf = true; break; } }
  const hasAnyDedicated = [...dedicatedPools.values()].some(p => p.qty > 0);
  if (!hasAnyWs && !hasAnyWf && !hasAnyDedicated && maxInvRows.length === 0 && invUnits.size === 0) return null;

  // ── Algorithm core ────────────────────────────────────────────────────
  const wb: number[] = new Array(n + 1).fill(0);
  const freshUnits = new Map<number, Array<{ kitsUsed: string[] }>>();

  for (const [lv, units] of invUnits) wb[lv] += units.length;

  /**
   * Risolve il fabbisogno per una risorsa (uno o più id alternativi, es. per
   * basi multi-variante) al livello dato:
   *  1. Pool dedicati (outlier) che coprono esattamente questa risorsa.
   *  2. Altrimenti, accumula in needByLevel[min(level, sentinel)] per il
   *     pagamento "flessibile" da ws più sotto.
   * `simDedicated`/`needByLevel` sono mutati in place (sia per la simulazione
   * di hasEnough sia per il pagamento reale di doPay).
   */
  function tryResource(
    resourceIds: string[], level: number,
    simDedicated: Map<string, number>, needByLevel: number[],
    usedNames: string[] | null,
  ): void {
    for (const rid of resourceIds) {
      for (const sk_id of resourceDedicated.get(rid) ?? []) {
        const c = simDedicated.get(sk_id) ?? 0;
        if (c > 0) {
          simDedicated.set(sk_id, c - 1);
          if (usedNames) usedNames.push(sk_id);
          return;
        }
      }
    }
    needByLevel[Math.min(level, sentinel)]++;
  }

  // Variante a singolo id: stessa logica di tryResource ma senza allocare un
  // array wrapper [id]. È il caso comune (un solo stepKitId per step), invocato
  // decine di migliaia di volte nel while-loop principale.
  function tryResourceSingle(
    rid: string, level: number,
    simDedicated: Map<string, number>, needByLevel: number[],
    usedNames: string[] | null,
  ): void {
    for (const sk_id of resourceDedicated.get(rid) ?? []) {
      const c = simDedicated.get(sk_id) ?? 0;
      if (c > 0) {
        simDedicated.set(sk_id, c - 1);
        if (usedNames) usedNames.push(sk_id);
        return;
      }
    }
    needByLevel[Math.min(level, sentinel)]++;
  }

  // Buffer riutilizzabili per hasEnough/doPay: pre-allocati una volta per
  // famiglia e resettati in-place a ogni chiamata, invece di riallocare 4
  // strutture per ognuna delle decine di migliaia di chiamate nel while-loop
  // principale (riduce drasticamente la pressione sul GC su inventari grandi).
  const simWsBuf = new Array<number>(numLevels);
  const simWfFlexBuf = new Array<number>(numLevels);
  const needByLevelBuf = new Array<number>(sentinel + 1);
  const simDedicatedBuf = new Map<string, number>();

  // hasEnough: verifica (in simulazione) se i kit disponibili coprono gli
  // step [srcStep, tgtStep) (+ eventuale base), senza mutare lo stato reale.
  const hasEnough = (srcStep: number, tgtStep: number, needBase: boolean): boolean => {
    const simWs = simWsBuf;
    for (let i = 0; i < numLevels; i++) { simWs[i] = ws[i]; simWfFlexBuf[i] = wfFlex[i]; }
    const simWfFlex = simWfFlexBuf;
    const simDedicated = simDedicatedBuf;
    simDedicated.clear();
    for (const [k, v] of dedicatedPools) simDedicated.set(k, v.qty);
    const needByLevel = needByLevelBuf;
    needByLevel.fill(0);

    for (let i = srcStep; i < tgtStep; i++) {
      if ((wf[i] ?? 0) > 0) continue; // coperto da kit fisso a quello step (non simulato: sempre disponibile qui)
      const lvl = stepLevels[i];
      if (lvl < numLevels && simWfFlex[lvl] > 0) { simWfFlex[lvl]--; continue; }
      tryResourceSingle(stepKitId[i], lvl, simDedicated, needByLevel, null);
    }
    if (needBase) tryResource(baseBldIds, baseLevel, simDedicated, needByLevel, null);

    // Paga i fabbisogni di livello più alto per primi, con il kit più
    // economico sufficiente (L >= req più basso disponibile). Generalizza
    // "platino→oro→argento→base, ciascuno coperto da quel tier o superiore".
    for (let req = sentinel; req >= 0; req--) {
      for (let c = 0; c < needByLevel[req]; c++) {
        let paid = false;
        for (let L = req; L < numLevels; L++) {
          if (simWs[L] > 0) { simWs[L]--; paid = true; break; }
        }
        if (!paid) return false;
      }
    }
    return true;
  };

  // doPay: come hasEnough, ma muta lo stato reale e registra i nomi dei kit
  // consumati in `usedNames`.
  const doPay = (srcStep: number, tgtStep: number, needBase: boolean, usedNames: string[]): void => {
    const simDedicated = simDedicatedBuf;
    simDedicated.clear();
    for (const [k, v] of dedicatedPools) simDedicated.set(k, v.qty);
    const needByLevel = needByLevelBuf;
    needByLevel.fill(0);

    for (let i = srcStep; i < tgtStep; i++) {
      if ((wf[i] ?? 0) > 0) { wf[i]--; if (wfNames[i]?.length) usedNames.push(wfNames[i].pop()!); continue; }
      const lvl = stepLevels[i];
      if (lvl < numLevels && wfFlex[lvl] > 0) { wfFlex[lvl]--; if (wfFlexNames[lvl].length) usedNames.push(wfFlexNames[lvl].pop()!); continue; }
      tryResourceSingle(stepKitId[i], lvl, simDedicated, needByLevel, usedNames);
    }
    if (needBase) tryResource(baseBldIds, baseLevel, simDedicated, needByLevel, usedNames);

    // Applica i consumi dai pool dedicati simulati allo stato reale.
    // (Tutti gli elementi di pool.names sono identici a sk_id, quindi
    // troncare l'array al nuovo `remaining` è equivalente a "pop" ripetuto.)
    for (const [sk_id, remaining] of simDedicated) {
      const pool = dedicatedPools.get(sk_id)!;
      pool.qty = remaining;
      pool.names.length = remaining;
    }

    for (let req = sentinel; req >= 0; req--) {
      for (let c = 0; c < needByLevel[req]; c++) {
        for (let L = req; L < numLevels; L++) {
          if (ws[L] > 0) { ws[L]--; if (wsNames[L].length) usedNames.push(wsNames[L].pop()!); break; }
        }
      }
    }
  };

  for (let T = n; T >= 1; T--) {
    for (let src = T - 1; src >= 1; src--) {
      while (wb[src] > 0 && hasEnough(src - 1, T - 1, false)) {
        wb[src]--; wb[T]++;
        if ((invUnits.get(src)?.length ?? 0) > 0) {
          const u = invUnits.get(src)!.pop()!;
          const usedNames: string[] = [];
          doPay(src - 1, T - 1, false, usedNames);
          u.kitsUsed = [...u.kitsUsed, ...usedNames];
          if (!invUnits.has(T)) invUnits.set(T, []);
          invUnits.get(T)!.push(u);
          continue;
        }
        doPay(src - 1, T - 1, false, []);
      }
    }
    if (T === 1) {
      // I selection kit flessibili rimasti diventano edifici base (lv1) — ma
      // SOLO quelli che offrono davvero l'edificio base nella loro cap. Un kit
      // che produce esclusivamente upgrade (es. un epico che offre solo
      // upgrade_kit_ascended_*) NON può materializzare una base: lasciarlo
      // diventare un edificio lv1 creerebbe edifici fantasma. Quei kit restano
      // semplicemente inutilizzati (non c'è nulla a cui applicarli a T=1).
      for (let L = 0; L < numLevels; L++) {
        if (ws[L] <= 0) continue;
        // Ripartiziona wsNames[L]: tieni i kit che NON offrono la base (restano
        // disponibili/inutilizzati), consuma quelli che la offrono.
        const names = wsNames[L];
        const keep: string[] = [];
        for (const nm of names) {
          if (kitsThatOfferBase.has(nm)) {
            wb[1]++;
            if (!freshUnits.has(1)) freshUnits.set(1, []);
            freshUnits.get(1)!.push({ kitsUsed: [nm] });
          } else {
            keep.push(nm);
          }
        }
        // Aggiorna contatore e nomi: restano solo i kit non convertibili in base.
        ws[L] = keep.length;
        wsNames[L] = keep;
      }
    } else {
      while (hasEnough(0, T - 1, true)) {
        const usedNames: string[] = [];
        doPay(0, T - 1, true, usedNames);
        wb[T]++;
        if (!freshUnits.has(T)) freshUnits.set(T, []);
        freshUnits.get(T)!.push({ kitsUsed: usedNames });
      }
    }
  }

  function resolveFinalIds(kitsUsed: string[]): string[] {
    for (let i = kitsUsed.length - 1; i >= 0; i--)
      if (kitToTargetId.has(kitsUsed[i])) return [kitToTargetId.get(kitsUsed[i])!];
    return levels[n - 1].ids;
  }
  const branching = kitToTargetId.size > 0;

  // Collassa unità inv max level: chiave include kitsUsed per non fondere
  // unità con kit diversi (es. 6 già-Platino + 1 Gold-upgradato-a-Platino).
  const maxInvGrouped = new Map<string, InvUnit>();
  for (const u of maxInvRows) {
    const key = `${u.id}|${u.kitsUsed.join(",")}`;
    if (!maxInvGrouped.has(key)) maxInvGrouped.set(key, { ...u, qty: 0 });
    maxInvGrouped.get(key)!.qty++;
  }

  const output: FreshUnit[] = [];
  const finalInvRows: InvUnit[] = [...maxInvGrouped.values()];

  for (let lv = 1; lv <= n; lv++) {
    const units = invUnits.get(lv) ?? [];
    const freshQty = wb[lv] - units.length;
    if (freshQty > 0) {
      const freshAtLv = freshUnits.get(lv) ?? [];
      if (lv === n && branching) {
        const groups = new Map<string, { ids: string[]; kitsUsed: string[]; qty: number }>();
        for (const u of freshAtLv) {
          const ids = resolveFinalIds(u.kitsUsed);
          const key = ids.join(",");
          if (!groups.has(key)) groups.set(key, { ids, kitsUsed: [], qty: 0 });
          const g = groups.get(key)!;
          g.qty++;
          g.kitsUsed.push(...u.kitsUsed);
        }
        for (const g of groups.values())
          output.push({ level: lv, qty: g.qty, ids: g.ids, is_max: true, kitsUsed: g.kitsUsed });
      } else {
        const kitsUsed = freshAtLv.flatMap(u => u.kitsUsed);
        output.push({ level: lv, qty: freshQty, ids: levels[lv - 1].ids, is_max: lv === n, kitsUsed });
      }
    }

    const grouped = new Map<string, InvUnit>();
    for (const u of units) {
      const id = (lv === n && branching) ? resolveFinalIds(u.kitsUsed)[0] : levels[lv - 1].ids[0];
      const row: InvUnit = { ...u, id, level: lv, is_max: lv === n };
      const key = `${row.sourceId}|${row.sourceLv}|${row.level}|${row.id}|${row.kitsUsed.join(",")}`;
      if (!grouped.has(key)) grouped.set(key, { ...row, qty: 0 });
      grouped.get(key)!.qty++;
    }
    finalInvRows.push(...grouped.values());
  }

  return (output.length || finalInvRows.length) ? { root, name: familyName(root), output, invRows: finalInvRows } : null;
}

// ── buildInvRows (estratta per chiarezza) ──────────────────────────────────

function buildInvRows(
  levels: FlatLevel[],
  stepKitId: string[],
  fromIdToKit: Map<string, string>,
  invUpg: Map<string, number>,
  invBld: Map<string, number>,
  kitToTargetId: Map<string, string>,
): { maxInvRows: InvUnit[]; invUnits: Map<number, InvUnit[]> } {
  const lastStep = levels.length - 2;

  const maxInvRows: InvUnit[] = [];
  const invUnits = new Map<number, InvUnit[]>();

  for (let lv = 0; lv < levels.length; lv++) {
    for (const id of levels[lv].ids) {
      const qty = invBld.get(id) ?? 0;
      if (!qty) continue;
      for (let u = 0; u < qty; u++) {
        let tgt = lv;
        let curId = id;
        const kitsUsed: string[] = [];
        while (tgt < levels.length - 1) {
          const kitId = (tgt === lastStep && fromIdToKit.has(curId))
            ? fromIdToKit.get(curId)!
            : stepKitId[tgt];
          if ((invUpg.get(kitId) ?? 0) > 0) {
            invUpg.set(kitId, invUpg.get(kitId)! - 1);
            kitsUsed.push(kitId);
            curId = kitToTargetId.get(kitId) ?? levels[tgt + 1].ids[0];
            tgt++;
          } else break;
        }
        const unit: InvUnit = {
          qty: 1, sourceId: id, sourceLv: lv + 1, kitsUsed,
          id: curId, level: tgt + 1, is_max: tgt === levels.length - 1,
        };
        if (unit.is_max) {
          maxInvRows.push(unit);
        } else {
          if (!invUnits.has(tgt + 1)) invUnits.set(tgt + 1, []);
          invUnits.get(tgt + 1)!.push(unit);
        }
      }
    }
  }

  return { maxInvRows, invUnits };
}

// ── Funzione principale ────────────────────────────────────────────────────

/**
 * ⚠️ CONTRATTO DI MUTAZIONE: `invUpg` viene CONSUMATA (mutata in place) durante
 * l'ottimizzazione — buildInvRows decrementa le quantità dei kit di upgrade man
 * mano che vengono applicati agli edifici in inventario, e il consumo si
 * propaga tra famiglie successive nello stesso giro. `invSel` e `invBld` sono
 * invece solo lette. Il chiamante deve quindi passare Map COSTRUITE FRESCHE ad
 * ogni chiamata (come fa il useMemo `familyResults` in App.tsx), mai una Map
 * condivisa con lo stato React o riusata tra chiamate: riusarla produrrebbe
 * risultati diversi al secondo giro con lo stesso inventario.
 */
export function computeAllFamilies(
  invUpg: Map<string, number>,
  invSel: Map<string, number>,
  invBld: Map<string, number> = new Map(),
): FamilyResult[] {
  if (!TRUE_ROOTS || !BLD_TO_ROOT || !KIT_TO_ROOTS || !SK_STANDALONE_OPTIONS) throw new Error("initKitData not called");

  // ── Early-exit: ottimizza SOLO le famiglie effettivamente toccate ──────────
  // dall'inventario, invece di scorrere tutti i TRUE_ROOTS (centinaia).
  // Una famiglia è "toccata" se l'inventario contiene un suo edificio, un suo
  // upgrade kit, o un selection kit che la produce.
  const touchedRoots = new Set<string>();
  for (const id of invBld.keys()) {
    const root = BLD_TO_ROOT.get(id);
    if (root) touchedRoots.add(root);
  }
  for (const kitId of invUpg.keys()) {
    const roots = KIT_TO_ROOTS.get(kitId);
    if (roots) for (const r of roots) touchedRoots.add(r);
  }
  for (const kitId of invSel.keys()) {
    const roots = KIT_TO_ROOTS.get(kitId);
    if (roots) for (const r of roots) touchedRoots.add(r);
  }

  const results: FamilyResult[] = [];
  for (const root of touchedRoots) {
    const res = optimizeFamily(root, invUpg, invSel, invBld);
    if (res) results.push(res);
  }

  // ── Famiglie SINTETICHE per le opzioni "standalone" dei selection kit ──────
  // Un selection kit può offrire edifici che non appartengono a NESSUNA catena
  // (es. selection_kit_ANNI24CD → Arboreto dei Fiori / Dirigibile Etereo): per
  // loro non esiste una famiglia-catena e il ramo sopra non li mostrerebbe mai.
  // Qui si emette una famiglia per KIT posseduto, con un unico output a
  // livello 1 (is_max: un edificio senza catena è già al massimo) e TUTTE le
  // opzioni in `ids`: il consumer (App) crea una riga per opzione con la
  // quantità piena — stessa convenzione "potenziale per famiglia/opzione" dei
  // kit epici (3 kit → 3 Arboreti E 3 Dirigibili mostrati; l'utente sa che
  // ogni copia del kit produce UNA sola delle opzioni). `root` = id del kit:
  // non collide mai con i root-edificio delle famiglie vere. Le opzioni
  // in-catena dello stesso kit continuano a passare dal ramo normale (un kit
  // misto compare in entrambi i posti, come gli epici).
  for (const [sk_id, qty] of invSel) {
    if (qty <= 0) continue;
    const standalone = SK_STANDALONE_OPTIONS.get(sk_id);
    if (!standalone) continue;
    results.push({
      root: sk_id,
      name: kitDisplayName(SK![sk_id]?.names, KIT_LANG) || sk_id,
      output: [{
        level: 1,
        qty,
        ids: [...standalone],
        is_max: true,
        kitsUsed: new Array(qty).fill(sk_id) as string[],
      }],
      invRows: [],
    });
  }

  // Ordinamento: livello massimo desc, poi quantità totale desc.
  // Pre-calcoliamo le chiavi una volta sola (evita lo spread ripetuto nel comparatore).
  const sortKey = new Map<FamilyResult, { maxLv: number; total: number }>();
  for (const f of results) {
    let maxLv = 0, total = 0;
    for (const o of f.output) { if (o.level > maxLv) maxLv = o.level; total += o.qty; }
    for (const o of f.invRows) { if (o.level > maxLv) maxLv = o.level; total += o.qty; }
    sortKey.set(f, { maxLv, total });
  }
  results.sort((a, b) => {
    const ka = sortKey.get(a)!, kb = sortKey.get(b)!;
    return kb.maxLv - ka.maxLv || kb.total - ka.total;
  });
  return results;
}
