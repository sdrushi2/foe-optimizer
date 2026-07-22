/**
 * Regole di classificazione dei CityEntityId in base al prefisso/suffisso
 * del loro id. Vive in un modulo quasi-neutro (un solo `import type`, vedi
 * sotto) — non in BuildingModel.ts — perché anche buildings.ts deve poterlo
 * usare durante il parsing del CSV, e BuildingModel.ts importa già tipi da
 * data/buildings.ts: se l'helper vivesse in BuildingModel.ts, buildings.ts
 * non potrebbe importarlo senza creare un ciclo.
 *
 * L'unico import è `import type { UiKey }` da ui-strings.ts: è una dipendenza
 * di solo-tipo (cancellata a compile-time), serve per tipizzare le chiavi di
 * traduzione dei nomi insediamento. ui-strings.ts non ha import a sua volta,
 * quindi nessun ciclo e nessuna dipendenza runtime: il modulo resta neutro
 * nel codice eseguito.
 *
 * Questo è l'UNICO punto del codice che conosce queste regole sui prefissi
 * ("X_" = Grande Edificio, "M_" = militare, "W_*Decoration" = inattivo,
 * "G_" = fabbrica di beni). Ogni altro punto (parsing CSV, import
 * bookmarklet, costruzione Building, filtri in App.tsx) deve chiamare le
 * funzioni qui sotto invece di ripetere il controllo sulla stringa.
 *
 * IMPORTANTE — "inattivo" non è una decorazione: le decorazioni vere e
 * proprie del gioco hanno prefisso "D_" (centinaia; danno solo un po' di
 * felicità, niente altro). Possono essere presenti o no nel CSV a seconda
 * di come viene generato (es. solo nella versione FULL) — la loro presenza
 * nel CSV non è la regola che li distingue, è solo il prefisso "D_". Un
 * edificio con id "W_*Decoration" invece è un edificio NORMALE, censito nel
 * CSV con tutte le sue statistiche, che dopo un certo numero di giorni
 * dalla fine di un evento viene "declassato" dal gioco a puro ornamento
 * (produzioni azzerate). È uno STATO temporaneo di un edificio altrimenti
 * normale, non una categoria — per questo la funzione si chiama
 * isInactiveBuildingId (non isInactiveDecorationId): la parola "Decoration"
 * compare solo qui, nel commento, come dettaglio implementativo del
 * pattern usato da Inno nell'id, non come concetto di dominio. Stessa
 * ragione per cui il valore di isInactive (booleano su Building) descrive
 * uno stato, non "decoration".
 *
 * Building/CityMapBuilding usano 4 booleani indipendenti (isGreatBuilding,
 * isMilitary, isInactive, isGoods), sparsi in centinaia di punti del codice
 * esistente — non un type unico "categoria", perché in pratica un edificio
 * va spesso controllato su più assi insieme (es. "è un GE E disconnesso"),
 * cosa che booleani indipendenti gestiscono più naturalmente di un singolo
 * valore enum mutuamente esclusivo.
 */

import type { UiKey } from "./ui-strings";

/** Un CityEntityId è un Grande Edificio se inizia con "X_". */
export function isGreatBuildingId(id: string): boolean {
  return id.startsWith("X_");
}

/** Un CityEntityId è un edificio militare se inizia con "M_". */
export function isMilitaryBuildingId(id: string): boolean {
  return id.startsWith("M_");
}

/** Un CityEntityId rappresenta un ACCAMPAMENTO militare vero (es.
 *  "M_OceanicFuture_Military2") — non un edificio-premio che per motivi
 *  storici del gioco usa comunque il prefisso "M_" (es. "Tana dei
 *  furfanti" = M_AllAge_EasterBonus1Small, un premio evento pasquale,
 *  o le statue M_AllAge_LSO25*). Distinzione reale scoperta a luglio 2026
 *  confrontando due città: gli accampamenti veri NON contribuiscono al
 *  fabbisogno stradale nel calcolo di efficienza strade (verificato
 *  empiricamente scollegando in game un M_OceanicFuture_Military2 4×6:
 *  l'efficienza mostrata da FoE Helper non cambia), mentre un edificio
 *  premio con prefisso "M_" come la Tana dei furfanti conta regolarmente
 *  (necessario per tornare all'efficienza esatta su un'altra città).
 *  Approccio conservativo: riconosce POSITIVAMENTE solo "Military" nell'id
 *  (pattern usato da Inno per tutti gli accampamenti standard), invece di
 *  elencare tutte le eccezioni — nuovi edifici premio con prefisso "M_"
 *  continuano a contare normalmente per costruzione. Vedi renderRoadSummary
 *  in App.tsx per l'unico punto d'uso. */
export function isMilitaryCampBuildingId(id: string): boolean {
  return isMilitaryBuildingId(id) && id.includes("Military");
}

/** Un CityEntityId rappresenta un edificio attualmente "inattivo" (un
 *  edificio normale, censito nel CSV, che il gioco ha declassato a puro
 *  ornamento dopo la fine di un evento a tempo) se inizia con "W_" e
 *  termina con "Decoration" — pattern usato da Inno per questi id. Non è
 *  una decorazione vera (quelle hanno prefisso "D_" e non sono in questa
 *  funzione). */
export function isInactiveBuildingId(id: string): boolean {
  return id.startsWith("W_") && id.endsWith("Decoration");
}

/** Un CityEntityId è una fabbrica di beni se inizia con "G_". */
export function isGoodsFactoryId(id: string): boolean {
  return id.startsWith("G_");
}


/**
 * Colori delle righe nelle tabelle edifici, per categoria.
 * Unico punto del codice da modificare per il "tuning cromatico".
 *
 * Solo il colore "normale" della riga — quando l'edificio è disconnesso
 * dalla strada si aggiunge ROW_DISCONNECTED_OVERLAY sopra, senza
 * rimpiazzare il colore della categoria.
 */
export const BUILDING_ROW_COLORS: Record<
  "great" | "military" | "goods" | "inactive" | "fallback" | "normal" | "mergedInventory",
  string
> = {
  // ⚠️ INVARIANTE: ogni colore di riga deve essere OPACO, anche negli stati
  // hover. Le colonne sticky a sinistra (.cell-checkbox/.cell-eye/.cell-name
  // sotto .has-sticky-name, vedi index.css) usano `background-color: inherit`
  // per riflettere il colore di categoria della riga: un colore
  // semi-trasparente ereditato lascia filtrare il testo delle colonne che
  // scorrono sotto (ghosting — bug scoperto due volte a luglio 2026: prima su
  // "normal" senza colore di base, poi su goods/inactive/fallback e
  // sull'hover di normal, che usavano utility /NN semi-trasparenti).
  // great/military sono utility Tailwind opache (hex pieno + hover con filtro
  // brightness, che non tocca l'alpha); le altre categorie usano le classi
  // .row-* definite in index.css, che replicano ESATTAMENTE i vecchi colori
  // semi-trasparenti come compositi opachi via color-mix(in srgb, …) sopra
  // l'ambiente (--bt-ambient-solid).
  great:    "bg-[#191900] hover:brightness-125",
  military: "bg-[#190F05] hover:brightness-125",
  goods:    "row-goods",
  inactive: "row-inactive",
  fallback: "row-fallback",
  normal:   "row-normal",
  // Righe iniettate in tab Città dal toggle "Mostra anche Inventario"
  // (App.tsx, ProcessedBuilding._isMergedInventory): categoria PRIORITARIA
  // su tutte le altre (great/military/goods/...), per distinguere sempre a
  // colpo d'occhio "questo non è un edificio piazzato" indipendentemente
  // dal tipo di edificio sottostante. Verde/emerald per restare in tema con
  // il pulsante che attiva il merge. Stesso pattern .row-* delle altre
  // categorie non-opache: vedi .row-merged-inventory in index.css.
  mergedInventory: "row-merged-inventory",
};

/**
 * Overlay aggiunto alla riga quando l'edificio è disconnesso dalla strada
 * (solo tab Città). Si somma al colore della categoria — non lo sostituisce —
 * perché usa background-image mentre i colori di categoria usano
 * background-color: CSS li applica come livelli separati, quindi un GE
 * disconnesso resta giallo con il tratteggio rosso sopra.
 */
export const ROW_DISCONNECTED_OVERLAY =
  "bg-[image:repeating-linear-gradient(45deg,rgba(180,0,0,0.35)_0_6px,transparent_6px_14px)]";

// ── Regole su pattern specifici di id edificio ────────────────────────────────
// Queste funzioni riconoscono categorie di edificio basandosi su sottostringhe
// dell'id definite da Inno. Se Inno rinomina i pattern, si tocca SOLO qui.

/** Premi del Guild Battlegrounds (GBG): id contengono "GBG" o "Battlegrounds". */
export function isBattlegroundsPrizeId(id: string): boolean {
  return id.includes("GBG") || id.includes("Battlegrounds");
}

/** Premi delle Incursioni Quantistiche (QI): id contengono "MultiAge_GR". */
export function isQuantumIncursionsPrizeId(id: string): boolean {
  return id.includes("MultiAge_GR");
}

// ── Insediamenti ──────────────────────────────────────────────────────────────
// Gli insediamenti hanno due serie di id: la serie "COP24x" (edifici evento
// stagionale 2024) e la serie "CulturalBuilding{N}" (edifici permanenti del
// catalogo). Entrambi vanno riconosciuti come dello stesso insediamento.
// Se Inno aggiunge nuovi insediamenti o rinomina i pattern, si tocca SOLO qui.

// `nameKey` è una CHIAVE di traduzione (non testo localizzato): il nome
// dell'insediamento finisce in un tooltip visibile all'utente, quindi va
// tradotto a render-time. Questo modulo è dati-puro e non ha accesso a
// uiLang/t(), perciò espone la chiave e App.tsx la risolve con t(nameKey, uiLang).
// L'import type di UiKey (in cima al file) è cancellato a compile-time: nessuna
// dipendenza runtime, il modulo resta "neutro". `icon` è un emoji, lingua-neutro.
type SettlementInfo = { nameKey: UiKey; icon: string };

// Tabella insediamenti: ogni voce ha i pattern COP che lo identificano e il
// numero CulturalBuilding{N} associato. Il match su CulturalBuilding usa un
// confine di cifra (\D|fine) DOPO il numero, così "CulturalBuilding2" non
// matcha per errore "CulturalBuilding20"/"CulturalBuilding21" ecc. (gli id
// reali hanno forma "CulturalBuilding{N}{lettera}", es. CulturalBuilding2a).
// Le regex sono letterali e precompilate una volta sola (modulo), non in
// ogni chiamata.
const SETTLEMENTS: ReadonlyArray<{ test: RegExp; info: SettlementInfo }> = [
  { test: /COP24A|CulturalBuilding2(?!\d)/,  info: { nameKey: "settlementVikings",   icon: "🪓" } },
  { test: /COP24B|CulturalBuilding4(?!\d)/,  info: { nameKey: "settlementJapan",     icon: "🏯" } },
  { test: /COP24C|CulturalBuilding5(?!\d)/,  info: { nameKey: "settlementEgyptians", icon: "🐫" } },
  { test: /COP24D|CulturalBuilding8(?!\d)/,  info: { nameKey: "settlementAztecs",    icon: "🛕" } },
  { test: /COP24E|CulturalBuilding10(?!\d)/, info: { nameKey: "settlementMughals",   icon: "🕌" } },
  { test: /COP24J/,                          info: { nameKey: "settlementPolynesia", icon: "🌺" } },
  { test: /COP25K/,                          info: { nameKey: "settlementPirates",   icon: "🏴‍☠️" } },
];

/** Restituisce chiave-nome e icona dell'insediamento a cui appartiene
 *  l'edificio, o null se non è un edificio di insediamento. Il chiamante
 *  traduce `nameKey` con t(nameKey, uiLang). */
export function getSettlementInfo(id: string): SettlementInfo | null {
  for (const s of SETTLEMENTS) {
    if (s.test.test(id)) return s.info;
  }
  return null;
}

// ── Regole su pattern di id kit ───────────────────────────────────────────────
// I kit hanno id strutturati come:
//   selection_kit_X          (kit di selezione base)
//   silver_selection_kit_X   (kit di selezione argento)
//   golden_selection_kit_X   (kit di selezione oro)
//   platinum_selection_kit_X (kit di selezione platino)
//   upgrade_kit_ascended_X   (kit di aggiornamento asceso)
//   shrink_kit_X             (kit di rimpicciolimento)
// Se Inno cambia questi prefissi, si tocca SOLO qui.
//
// NOTA sugli shrink kit: sono trattati come normali kit di aggiornamento
// (riducono le dimensioni dell'edificio conservandone la produzione, quindi
// ne aumentano l'efficienza; le loro catene stanno in kit.json come tutte le
// altre). In passato esisteva qui un helper isShrinkKit usato da
// parseInventory per ESCLUDERLI dall'inventario: l'esclusione è stata rimossa
// (vedi la nota storica in inventory.ts) e con essa l'helper, rimasto senza
// consumatori. Se in futuro servisse distinguerli di nuovo, il pattern
// lingua-neutro è `kitId.startsWith("shrink_kit_")`.

/** True se il kit_id corrisponde a un kit di aggiornamento asceso. */
export function isAscendedUpgradeKit(kitId: string): boolean {
  return kitId.startsWith("upgrade_kit_ascended_");
}

// ── Regole su pattern di token frammenti ─────────────────────────────────────
// I frammenti hanno token come "building_W_MultiAge_WIN22B1" o
// "selection_kit_FELL25BC". Se Inno cambia questi pattern, si tocca SOLO qui.

/** True se il token frammento si riferisce a un edificio. */
export function isFragmentBuildingToken(token: string): boolean {
  return token.includes("building");
}

/** True se il token frammento si riferisce a un kit (selezione o upgrade). */
export function isFragmentKitToken(token: string): boolean {
  return token.includes("selection") || token.includes("upgrade");
}

/** Estrae l'entityId edificio da un token frammento di tipo building
 *  (es. "building_W_MultiAge_WIN22B1" → "W_MultiAge_WIN22B1"). */
export function fragmentBuildingId(token: string): string {
  return token.replace(/^building_/, "");
}

// ── Asset name dei consumabili speciali dell'inventario ───────────────────────
// Questi sono gli itemAssetName usati da Inno per identificare i consumabili.
// Se Inno li rinomina, si tocca SOLO qui.

export const CONSUMABLE_ASSET_NAMES = {
  oneUpKit:              "one_up_kit",
  oneDownKit:            "one_down_kit",
  reversionKit:          "reversion_kit",
  renovationKit:         "renovation_kit",
  storeBuilding:         "store_building",
  rushEventBuildings:    "rush_single_event_building_instant",
  rushMassSupplies:      "rush_mass_supply_large",
  rushGoodsBuildings:    "rush_single_goods_instant",
  massSelfAidKit:        "motivate_all",
} as const;

// ── Mappatura rarità dal payload JSON di Inno ai livelli numerici ────────────
// Nel JSON del gioco le rarità arrivano come stringhe inglesi minuscole
// (campo rarity.value). Nel CSV alleati sono numeri da 1 a 5.
// Se Inno aggiunge nuove rarità o rinomina le esistenti, si tocca SOLO qui.

export const RARITY_FROM_GAME: Record<string, number> = {
  common:    1,
  uncommon:  2,
  rare:      3,
  epic:      4,
  legendary: 5,
};
