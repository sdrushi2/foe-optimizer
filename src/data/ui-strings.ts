/** Lingue supportate dalla GUI: solo it/en per ora (a differenza del tipo
 *  Lang usato per i dati di gioco, che ne ammette 5). */
export type UiLang = "it" | "en";

/** Elenco delle lingue GUI disponibili, nell'ordine in cui appaiono nel
 *  selettore. Per aggiungerne una in futuro (es. tedesco): allargare
 *  UiLang, aggiungere una riga qui con il suo nome nativo, aggiungere la sua
 *  bandiera SVG in App.tsx (FlagXX) e mapparla in FLAG_BY_LANG. Nessun'altra
 *  modifica al componente del selettore è necessaria: itera questa lista. */
export const UI_LANGUAGES: ReadonlyArray<{ code: UiLang; nativeName: string }> = [
  { code: "it", nativeName: "Italiano" },
  { code: "en", nativeName: "English" },
];

/**
 * Stringhe statiche della GUI (etichette, tooltip, messaggi, help).
 *
 * Diverso da translations.ts: quello traduce DATI di gioco (nomi di edifici,
 * alleati, kit, ere), questo traduce il TESTO dell'interfaccia stessa.
 *
 * Fallback: lingua richiesta -> inglese -> chiave stessa (mai un buco
 * visibile se manca una entry). Le parole identiche in italiano e inglese
 * (prestiti comuni come "kit", "export", sigle come "LIGHT"/"FULL") non
 * vanno duplicate: si scrivono una sola volta in UI_STRINGS_SHARED.
 *
 * Le chiavi sono nominate per CONTENUTO ("profileDelete"), non per
 * posizione nella UI ("header.row2.btn3"): il layout cambia più spesso del
 * significato di una stringa, quindi i nomi per contenuto richiedono meno
 * manutenzione nel tempo.
 */

const UI_STRINGS = {
  // ── Barra profili (header) ────────────────────────────────────────────
  profileDelete: {
    it: "Elimina profilo",
    en: "Delete profile",
  },
  wandTitle: {
    it: "Trascina nella barra indirizzi per creare un bookmark da premere sul gioco · Click per importare tutti i dati della città in un nuovo profilo",
    en: "Drag to the bookmarks bar to create a bookmark you can click in-game · Click to import all city data into a new profile",
  },
  exportNoProfiles: {
    it: "Nessun profilo da salvare",
    en: "No profiles to save",
  },
  exportProfiles: {
    it: "Salva profili",
    en: "Save profiles",
  },
  importProfiles: {
    it: "Carica profili",
    en: "Load profiles",
  },
  deleteAllProfiles: {
    it: "Elimina tutti i profili",
    en: "Delete all profiles",
  },
  deleteAllNoProfiles: {
    it: "Nessun profilo da eliminare",
    en: "No profiles to delete",
  },
  profileHelpTitle: {
    it: "Guida ai profili e all'importazione della città",
    en: "Guide to profiles and city import",
  },

  // ── Tab di navigazione ────────────────────────────────────────────────
  tabCity: {
    it: "Città",
    en: "City",
  },
  tabInventory: {
    it: "Inventario",
    en: "Inventory",
  },
  tabAllies: {
    it: "Alleati",
    en: "Allies",
  },
  tabHelp: {
    it: "Guida",
    en: "Help",
  },
  tabHelpTitle: {
    it: "Apri la guida",
    en: "Open the guide",
  },

  // ── Switch vista LIGHT/FULL ───────────────────────────────────────────
  lightFullTitle: {
    it: "LIGHT: solo edifici principali · FULL: tutti, inclusi livelli intermedi. Ha effetto sulla tab Info.",
    en: "LIGHT: main buildings only · FULL: all buildings, including intermediate levels. Affects the Info tab.",
  },

  // ── Selettore lingua GUI ──────────────────────────────────────────────
  languageSwitchTitle: {
    it: "Cambia lingua dell'interfaccia",
    en: "Change interface language",
  },

  // ── Modale Importa Profili ───────────────────────────────────────────
  importModalTitle: {
    it: "Importa profili",
    en: "Import profiles",
  },
  closeAriaLabel: {
    it: "Chiudi",
    en: "Close",
  },
  importModalAddedNotice: {
    it: "I profili importati verranno aggiunti a quelli attuali.",
    en: "Imported profiles will be added to your current ones.",
  },
  importModalDropLabel: {
    it: "Carica il file foe-optimizer-YYYY-MM-DD.json",
    en: "Upload the foe-optimizer-YYYY-MM-DD.json file",
  },
  importInvalidFile: {
    it: "⚠️ Il file selezionato non è valido.",
    en: "⚠️ The selected file is not valid.",
  },
  importPartialHeavy: {
    it: "⚠️ Profili importati parzialmente: alcuni dati pesanti non sono stati salvati (quota localStorage esaurita). Prova a svuotare i dati di altri profili.",
    en: "⚠️ Profiles partially imported: some large data wasn't saved (localStorage quota exceeded). Try clearing data from other profiles.",
  },
  importPartialKeys: {
    it: (n: number) => `⚠️ Profili importati parzialmente: ${n} chiavi non salvate per quota esaurita nel LocalStorage.`,
    en: (n: number) => `⚠️ Profiles partially imported: ${n} keys not saved because the LocalStorage quota was exceeded.`,
  },
  importSuccessMessage: {
    it: "✅ Profili importati con successo.",
    en: "✅ Profiles imported successfully.",
  },
  importGenericError: {
    it: "Errore durante l'import.",
    en: "An error occurred during import.",
  },
  importReadFileError: {
    it: "Impossibile leggere il file.",
    en: "Unable to read the file.",
  },

  // ── Conferma eliminazione di un singolo profilo ───────────────────────
  defaultProfileName: {
    it: (n: number) => `Profilo ${n}`,
    en: (n: number) => `Profile ${n}`,
  },
  genericProfileFallback: {
    it: "questo profilo",
    en: "this profile",
  },
  confirmDeleteProfile: {
    it: (name: string) => `Sei sicuro di voler eliminare il profilo "${name}"?\n\nTutti i dati associati (città, inventario, alleati) verranno persi.`,
    en: (name: string) => `Are you sure you want to delete the profile "${name}"?\n\nAll associated data (city, inventory, allies) will be lost.`,
  },

  // ── Conferma eliminazione di tutti i profili ─────────────────────────
  confirmDeleteAllProfiles: {
    it: "Sei sicuro di voler eliminare TUTTI i profili esistenti?",
    en: "Are you sure you want to delete ALL existing profiles?",
  },

  // ── Barra filtri (ricerca, categoria, evento, pesi) ──────────────────
  searchPlaceholder: {
    it: "Cerca...",
    en: "Search...",
  },
  searchInputLabel: {
    it: "Cerca edificio",
    en: "Search building",
  },
  spedizioniAttackSliderLabel: {
    it: "Bilanciamento attacco/difesa Spedizioni",
    en: "Expeditions attack/defense balance",
  },
  resetFiltersTitle: {
    it: "Reimposta tutti i filtri e l'ordinamento ai valori predefiniti",
    en: "Reset all filters and sorting to default values",
  },
  weightAtk: {
    it: "Att",
    en: "Atk",
  },
  weightDef: {
    it: "Dif",
    en: "Def",
  },
  weightGbg: {
    it: "CAM",
    en: "GBG",
  },
  weightGe: {
    it: "SPE",
    en: "GE",
  },
  spedizioniToggleLabel: {
    it: "Attiva/disattiva peso Spedizioni",
    en: "Toggle Expeditions weight",
  },
  categoryFilterTitle: {
    it: "Filtro categoria",
    en: "Category filter",
  },
  catAll: {
    it: "⚙️ Tutti",
    en: "⚙️ All",
  },
  catIq: {
    it: "✊🏾 Utili per IQ",
    en: "✊🏾 Useful for QI",
  },
  catAlly: {
    it: "⭐ Slot alleato",
    en: "⭐ Ally slot",
  },
  catSettlements: {
    it: "🏘️ Insediamenti",
    en: "🏘️ Settlements",
  },
  catBattlegroundsPrizes: {
    it: "🔰 Premi Campi",
    en: "🔰 GBG prizes",
  },
  catQiPrizes: {
    it: "✊🏾 Premi IQ",
    en: "✊🏾 QI prizes",
  },
  eventFilterTitle: {
    it: "Filtro evento",
    en: "Event filter",
  },
  eventsDefaultOption: {
    it: "📅 Eventi",
    en: "📅 Events",
  },
  efficiencyHelpTitle: {
    it: "Guida: come funziona l'efficienza e i pesi",
    en: "Guide: how efficiency and weights work",
  },
  sigmaShowTitle: {
    it: "Nascondi colonne somma Sigma",
    en: "Hide Sigma sum columns",
  },
  sigmaHideTitle: {
    it: "Mostra colonne somma Gen+Campi (e Gen+Sped)",
    en: "Show Gen+GBG sum columns (and Gen+GE)",
  },
  timeColumnShowTitle: {
    it: "Nascondi edifici limitati e colonna Tempo",
    en: "Hide limited buildings and Time column",
  },
  timeColumnHideTitle: {
    it: "Mostra edifici limitati e colonna Tempo",
    en: "Show limited buildings and Time column",
  },
  popColumnShowTitle: {
    it: "Nascondi Popolazione",
    en: "Hide Population",
  },
  popColumnHideTitle: {
    it: "Mostra Popolazione",
    en: "Show Population",
  },
  felColumnShowTitle: {
    it: "Nascondi Felicità",
    en: "Hide Happiness",
  },
  felColumnHideTitle: {
    it: "Mostra Felicità",
    en: "Show Happiness",
  },
  iqProdColumnsTitle: {
    it: "Mostra/nascondi monete/materiali quantistici",
    en: "Show/hide quantum coins/supplies",
  },
  prodColumnsShowTitle: {
    it: "Nascondi Produzioni",
    en: "Hide Productions",
  },
  prodColumnsHideTitle: {
    it: "Mostra Produzioni",
    en: "Show Productions",
  },
  filterLabel: {
    it: "Filtra",
    en: "Filter",
  },
  hideBuildingsLabel: {
    it: "Nascondi edifici →",
    en: "Hide buildings →",
  },
  showInventoryInCityButton: {
    it: "MOSTRA ANCHE INVENTARIO",
    en: "SHOW INVENTORY TOO",
  },
  showInventoryInCityTitle: {
    it: "Aggiunge alla tabella anche gli edifici disponibili in Inventario (stesso elenco della tab Inventario), evidenziati con uno sfondo verde. Non sono istanze piazzate: filtri e badge specifici della città (obsoleto, declassabile, disconnesso, slot alleato) non si applicano a queste righe.",
    en: "Adds the buildings available in Inventory to the table too (same list as the Inventory tab), highlighted with a green background. These are not placed instances: city-specific filters and badges (outdated, declassable, disconnected, ally slot) don't apply to these rows.",
  },
  hideInventoryInCityTitle: {
    it: "Nasconde di nuovo gli edifici da Inventario",
    en: "Hide the Inventory buildings again",
  },

  // ── Titoli delle icone produzione (colonne + filtro) ─────────────────
  staleDataWarning: {
    it: "Importa nuovamente i dati per vedere questi valori",
    en: "Re-import your data to see these values",
  },
  prodCoins: {
    it: "Monete",
    en: "Coins",
  },
  prodMaterials: {
    it: "Materiali",
    en: "Supplies",
  },
  prodForgePoints: {
    it: "Punti Forge",
    en: "Forge Points",
  },
  prodForgePointsBoost: {
    it: "Punti Forge Boost",
    en: "Forge Points Boost",
  },
  prodRogues: {
    it: "Furfanti",
    en: "Rogues",
  },
  prodUnitsCurrentEra: {
    it: "Truppe dell'era corrente",
    en: "Current era units",
  },
  prodUnitsNextEra: {
    it: "Truppe dell'era successiva",
    en: "Next era units",
  },
  prodGoodsCurrent: {
    it: "Beni era attuale",
    en: "Current era goods",
  },
  prodGoodsPrevious: {
    it: "Beni era precedente",
    en: "Previous era goods",
  },
  prodGoodsNext: {
    it: "Beni era successiva",
    en: "Next era goods",
  },
  prodGoodsBoost: {
    it: "Beni Boost",
    en: "Goods Boost",
  },
  prodGuildGoods: {
    it: "Beni Gilda",
    en: "Guild Goods",
  },
  prodBlueprints: {
    it: "Progetti",
    en: "Blueprints",
  },
  prodRushSpecial: {
    it: "Termina prod. speciale",
    en: "Finish Special Production",
  },
  prodRushMaterials: {
    it: "Termina prod. materiali",
    en: "Finish All Supply Productions",
  },
  prodRushGoods: {
    it: "Termina prod. beni",
    en: "Finish Goods Production",
  },
  prodMassAid: {
    it: "Auto-aiuto di massa",
    en: "Mass Self-Aid Kit",
  },
  prodOneUpKit: {
    it: "Kit modernizzatore",
    en: "One Up Kit",
  },
  prodOneDownKit: {
    it: "Kit epoca precedente",
    en: "One Down Kit",
  },
  prodReversionKit: {
    it: "Kit di ripristino",
    en: "Reversion Kit",
  },
  prodRenovationKit: {
    it: "Kit rinnovamento",
    en: "Renovation Kit",
  },
  prodStoreBuilding: {
    it: "Immagazzina edificio",
    en: "Store Building",
  },

  // ── Nomi brevi di sezione (senza emoji), usati dentro boostTitle() ───
  sectionGeneral: {
    it: "Generale",
    en: "General",
  },
  sectionGbg: {
    it: "Campi",
    en: "GBG",
  },
  sectionGe: {
    it: "Spedizioni",
    en: "GE",
  },
  sectionGenPlusGbg: {
    it: "Gen+Campi",
    en: "Gen+GBG",
  },
  sectionGenPlusGe: {
    it: "Gen+Sped",
    en: "Gen+GE",
  },
  sectionQi: {
    it: "IQ",
    en: "QI",
  },

  // ── Titoli di gruppo header tabella (Generale/Campi/Spedizioni) ──────
  groupGenerals: {
    it: "⚔️ Generali",
    en: "⚔️ Generals",
  },
  groupGbg: {
    it: "🔰 Campi",
    en: "🔰 GBG-Only",
  },
  groupGenPlusGbg: {
    it: "⚔️ GEN + 🔰 CAMPI",
    en: "⚔️ GEN + 🔰 GBG",
  },
  groupGe: {
    it: "⚡ Spedizioni",
    en: "⚡ GE-Only",
  },
  groupGenPlusGe: {
    it: "⚔️ GEN + ⚡ SPED.",
    en: "⚔️ GEN + ⚡ GE",
  },
  groupIq: {
    it: "✊🏾 Incursioni",
    en: "✊🏾 Incursions",
  },
  groupProductions: {
    it: "📦 Produzioni",
    en: "📦 Productions",
  },

  // ── Colonne scalari IQ (Beni/Truppe/Azioni/CAP quantistici) ──────────
  iqCoinsBoost: {
    it: "Boost % monete IQ",
    en: "Quantum Coins Boost %",
  },
  iqMaterialsBoost: {
    it: "Boost % materiali IQ",
    en: "Quantum Supplies Boost %",
  },
  iqCoinsStart: {
    it: "Monete IQ iniziali aggiuntive",
    en: "Quantum Start Coins",
  },
  iqMaterialsStart: {
    it: "Materiali IQ iniziali aggiuntivi",
    en: "Quantum Start Supplies",
  },
  iqGoods: {
    it: "Beni IQ iniziali aggiuntivi",
    en: "Quantum Start Goods",
  },
  iqUnits: {
    it: "Truppe QI iniziali aggiuntive",
    en: "Quantum Start Units",
  },
  iqActions: {
    it: "Azioni quantistiche aggiuntive",
    en: "Quantum Actions per Recharge Cycle",
  },
  iqCap: {
    it: "Capacità azioni quantistiche",
    en: "Quantum Actions Capacity",
  },

  // ── Colonne base tabella (Edificio/Eff/Size/Strada/Pop/Fel) ──────────
  selectAllTitle: {
    it: "Seleziona/deseleziona tutto",
    en: "Select/deselect all",
  },
  selectBuildingLabel: {
    it: (name: string) => `Seleziona ${name}`,
    en: (name: string) => `Select ${name}`,
  },
  minEffInputLabel: {
    it: "Efficienza minima",
    en: "Minimum efficiency",
  },
  colBuilding: {
    it: "Edificio",
    en: "Building",
  },
  colSize: {
    it: "Dimensione edificio",
    en: "Building size",
  },
  colRoad: {
    it: "Fabbisogno stradale",
    en: "Road requirement",
  },
  colPop: {
    it: "Popolazione fornita/sottratta",
    en: "Population provided/required",
  },
  colFel: {
    it: "Felicità fornita/sottratta",
    en: "Happiness provided/required",
  },
  buildingsVisualizedCount: {
    it: "Edifici visualizzati",
    en: "Buildings shown",
  },
  alliesVisualizedCount: {
    it: "Alleati visualizzati",
    en: "Allies shown",
  },

  // ── Badge/tooltip celle tabella edifici ───────────────────────────────
  unresolvedValuesTitle: {
    it: "I valori di questo edificio non sono disponibili",
    en: "This building's values are not available",
  },
  disconnectedFromRoadTitle: {
    it: "Edificio non connesso a strade",
    en: "Building not connected to roads",
  },
  disconnectedFromRoadBadge: {
    it: "NON CONNESSO A STRADE",
    en: "NO ROAD CONNECTION",
  },
  needlesslyConnectedTitle: {
    it: "Edificio connesso inutilmente a una strada",
    en: "Building needlessly connected to a road",
  },
  needlesslyConnectedBadge: {
    it: (n: number) => n > 1 ? `${n}x CONNESSI INUTILMENTE` : "CONNESSO INUTILMENTE",
    en: (n: number) => n > 1 ? `${n}x NEEDLESSLY CONNECTED` : "NEEDLESSLY CONNECTED",
  },
  historicalAllySlotTitle: {
    it: "L'edificio può ospitare un Alleato Storico",
    en: "The building can host a Historical Ally",
  },
  wonInGbgTitle: {
    it: "L'edificio si vince nei Campi",
    en: "The building is won in GBG",
  },
  wonInQiTitle: {
    it: "L'edificio si vince nelle IQ",
    en: "The building is won in QI",
  },

  // ── Nomi insediamenti (tooltip icona, tab Città/Inventario) ───────────
  settlementVikings: {
    it: "Insediamento Vichinghi",
    en: "Vikings Settlement",
  },
  settlementJapan: {
    it: "Insediamento Giappone",
    en: "Japan Settlement",
  },
  settlementEgyptians: {
    it: "Insediamento Egizi",
    en: "Egypt Settlement",
  },
  settlementAztecs: {
    it: "Insediamento Aztechi",
    en: "Aztecs Settlement",
  },
  settlementMughals: {
    it: "Insediamento Mughal",
    en: "Mughals Settlement",
  },
  settlementPolynesia: {
    it: "Insediamento Polinesia",
    en: "Polynesia Settlement",
  },
  settlementPirates: {
    it: "Insediamento Pirati",
    en: "Pirates Settlement",
  },

  // ── Badge/tooltip celle tabella alleati ───────────────────────────────
  fragmentsCountTitle: {
    it: (n: number) => `${n} frammenti`,
    en: (n: number) => `${n} fragments`,
  },
  fragmentsBadge: {
    it: (n: number) => `${n} FRAMMENTI`,
    en: (n: number) => `${n} FRAGMENTS`,
  },
  allyPlacedTitle: {
    it: "Posizionato in città",
    en: "Placed in the city",
  },
  allyNotPlacedTitle: {
    it: "Non posizionato in città",
    en: "Not placed in the city",
  },
  allyNotPlacedBadge: {
    it: "NON POSIZIONATO",
    en: "NOT PLACED",
  },
  allyHasUnplacedCopyTitle: {
    it: "Hai una copia non posizionata in città",
    en: "You have an unplaced copy in your city",
  },
  ally1stLevelValueTitle: {
    it: "Valore a livello 1",
    en: "Level 1 value",
  },
  colAlly: {
    it: "Alleato",
    en: "Ally",
  },

  // ── Barra "Calcola efficienza a livello" (tab Alleati) ────────────────
  calcEfficiencyAtLevel: {
    it: "Calcola efficienza a livello",
    en: "Calculate efficiency at level",
  },
  importAlliesFirstTitle: {
    it: "Importa prima i tuoi alleati",
    en: "Import your allies first",
  },
  showFullDatabaseTitle: {
    it: "Mostra tutto il database",
    en: "Show the full database",
  },
  showOnlyOwnedTitle: {
    it: "Mostra solo gli alleati posseduti",
    en: "Show only owned allies",
  },
  onlyOwnedLabel: {
    it: "Solo posseduti",
    en: "Only owned",
  },

  // ── Modale "Edifici aggiornabili/ascendibili" (breakdown kit) ────────
  inventoryRequiredTitle: {
    it: "Inventario richiesto",
    en: "Inventory required",
  },
  inventoryRequiredBody: {
    it: "Per calcolare queste tabelle serve anche l'inventario importato nella tab Inventario.",
    en: "To calculate these tables, you also need inventory data imported in the Inventory tab.",
  },
  noUpgradableFound: {
    it: "Nessun edificio aggiornabile o ascendibile individuato con i dati attuali.",
    en: "No upgradable or ascendable buildings found with the current data.",
  },
  upgradableBuildingsTitle: {
    it: "Edifici aggiornabili",
    en: "Upgradable buildings",
  },
  ascendableBuildingsTitle: {
    it: "Edifici ascendibili",
    en: "Ascendable buildings",
  },
  colInCity: {
    it: "In città",
    en: "In City",
  },
  colCurrentLevel: {
    it: "Liv. attuale",
    en: "Curr lvl",
  },
  colMaxLevel: {
    it: "Liv. max",
    en: "Max lvl",
  },
  colAvailableKits: {
    it: "Kit disponibili (selezione / aggiornamento)",
    en: "Available kits (selection / upgrade)",
  },

  // ── Pannello PROD + STAT (riepilogo produzioni/statistiche tab Città) ─
  prodColumnLabel: {
    it: "Produzione",
    en: "Production",
  },
  prodColInStock: {
    it: "in inv.",
    en: "in inv.",
  },
  prodColFragmentsPerDay: {
    it: "framm/g",
    en: "frag/d",
  },
  prodColKitsPerMonth: {
    it: "kit/mese",
    en: "kit/mo",
  },
  prodColKitsPerYear: {
    it: "kit/anno",
    en: "kit/yr",
  },
  dailyQuantityLabel: {
    it: "Quantità giornaliera",
    en: "Daily quantity",
  },

  // ── Pannello efficienza strade (tab Città) ──────────────────────────
  roadEfficiencyTitle: {
    it: "Efficienza strade",
    en: "Road efficiency",
  },
  roadEfficiencyFormula: {
    it: "Efficienza = Fabbisogno Stradale Edifici Collegati ÷ Area Totale delle Strade × 100",
    en: "Efficiency = Connected Buildings Road Requirement ÷ Total Road Area × 100",
  },
  roadEfficiencyConnectedArea: {
    it: "Fabbisogno stradale edifici collegati",
    en: "Connected buildings road requirement",
  },
  roadEfficiencyRoadArea: {
    it: "Area totale delle strade",
    en: "Total road area",
  },
  roadEfficiencyResult: {
    it: "Efficienza strade",
    en: "Road efficiency",
  },
  roadEfficiencyDisconnectedWarning: {
    it: "In città ci sono edifici scollegati dalla strada.\nSe venissero collegati, senza costruire altre strade, l'efficienza cambierebbe:",
    en: "There are buildings disconnected from the road network.\nIf they were connected, without building any more roads, efficiency would change to:",
  },
  roadEfficiencyDisconnectedArea: {
    it: "Fabbisogno stradale edifici scollegati (potenziale)",
    en: "Disconnected buildings road requirement (potential)",
  },
  roadEfficiencyHypothetical: {
    it: "Efficienza se tutti collegati",
    en: "Efficiency if all connected",
  },
  statRowGlobal: {
    it: "Globale",
    en: "Global",
  },
  statColLabel: {
    it: "Statistica",
    en: "Statistic",
  },
  statColFromBuildings: {
    it: "da edifici",
    en: "from buildings",
  },
  statColFromGB: {
    it: "da GE",
    en: "from GB",
  },
  statColFromAllies: {
    it: "da alleati",
    en: "from allies",
  },
  statColTotal: {
    it: "totale",
    en: "total",
  },
  statTotalsFootnote: {
    it: "* Nei totali non sono considerate alcune produzioni extra (Castello, Emissari, ecc.)",
    en: "* Some additional production sources (Castle, Emissaries, etc.) are not included in the totals",
  },

  // ── Pannelli Debug (tab Città e Inventario) ──────────────────────────
  debugMatchedBuildings: {
    it: "Edifici matchati",
    en: "Matched buildings",
  },
  debugGreatBuildings: {
    it: "Grandi Edifici",
    en: "Great Buildings",
  },
  debugUnmatchedBuildings: {
    it: "Edifici senza match",
    en: "Unmatched buildings",
  },
  debugSelectionKits: {
    it: "Kit di selezione",
    en: "Selection kits",
  },
  debugUpgradeKits: {
    it: "Kit di aggiornamento",
    en: "Upgrade kits",
  },
  tierPlatinum: {
    it: "Platino",
    en: "Platinum",
  },
  tierGold: {
    it: "Oro",
    en: "Gold",
  },
  tierSilver: {
    it: "Argento",
    en: "Silver",
  },
  tierNormal: {
    it: "Base",
    en: "Base",
  },
  onlyReadyBuildings: {
    it: "Solo edifici pronti",
    en: "Only ready buildings",
  },
  onlyReadyBuildingsTitle: {
    it: "Mostra solo gli edifici già presenti in inventario",
    en: "Show only buildings already in inventory",
  },

  // ── Mappa città (CityMapView.tsx) ────────────────────────────────────
  mapViewTitle: {
    it: "Vista Mappa",
    en: "Map View",
  },
  mapViewVertical: {
    it: "Verticale",
    en: "Vertical",
  },
  mapViewIsometric: {
    it: "Isometrica",
    en: "Isometric",
  },
  zoomOutTitle: {
    it: "Riduci zoom",
    en: "Zoom out",
  },
  zoomInTitle: {
    it: "Aumenta zoom",
    en: "Zoom in",
  },
  exportPngFailedAlert: {
    it: "Impossibile esportare la mappa in PNG. Prova l'export SVG.",
    en: "Unable to export the map as PNG. Try the SVG export instead.",
  },
  mapLegendTitle: {
    it: "Legenda Mappa",
    en: "Map Legend",
  },
  legendTownHall: {
    it: "Municipio",
    en: "Town Hall",
  },
  legendGreatBuildings: {
    it: "Grandi Edifici",
    en: "Great Buildings",
  },
  legendMilitaryBuildings: {
    it: "Edifici militari",
    en: "Military buildings",
  },
  legendTotalBuildings: {
    it: "Edifici totali",
    en: "Total buildings",
  },
  legendNeedlesslyConnected: {
    it: "Connessi inutilmente",
    en: "Needlessly connected",
  },
  legendSuppliesProducers: {
    it: "Produce materiali",
    en: "Supply producers",
  },
  legendInactive: {
    it: "Inattivi",
    en: "Inactive",
  },
  legendStreets: {
    it: "Strade",
    en: "Streets",
  },
  legendFreeSpace: {
    it: "Spazio libero",
    en: "Free space",
  },
  legendUnavailableSpace: {
    it: "Spazio non disponibile",
    en: "Unavailable space",
  },
  mapLegendFootnote: {
    it: "La mappa mostra l'ingombro reale basato sulle espansioni sbloccate nel gioco.",
    en: "The map shows the actual footprint based on the expansions unlocked in the game.",
  },

  // ── Tooltip "Frammenti / Kit prodotti da" ─────────────────────────────
  // Niente emoji 🧩 nel testo: il chiamante antepone iconFragment (icona
  // ufficiale Inno) come <img>, coerente col badge in tabella.
  fragmentsProducedByTitle: {
    it: "Frammenti prodotti da:",
    en: "Fragments produced by:",
  },
  inCityBadge: {
    it: "CITTÀ",
    en: "CITY",
  },

  // ── Riga filtri tab Città (era, debug, download, mappa, vecchi, GB) ──
  profileEraTitle: {
    it: (era: string) => `Tutti i dati del profilo visualizzato corrispondono all'era: ${era}`,
    en: (era: string) => `All data for the displayed profile corresponds to the age: ${era}`,
  },
  downloadCityListTitle: {
    it: "Scarica la lista completa degli edifici in città",
    en: "Download the full list of city buildings",
  },
  showOnlyOldBuildingsTitle: {
    it: "Mostra solo edifici di ere precedenti",
    en: "Show only buildings from previous ages",
  },
  upgradableBuildingsButton: {
    it: "EDIFICI AGGIORNABILI",
    en: "UPGRADABLE BUILDINGS",
  },
  showQiUsefulTitle: {
    it: "Nascondi edifici utili per le IQ",
    en: "Hide buildings useful for QI",
  },
  hideQiUsefulTitle: {
    it: "Mostra edifici utili per le IQ",
    en: "Show buildings useful for QI",
  },
  hideHistoricalAllyBuildingsTitle: {
    it: "Nascondi edifici che possono ospitare Alleati Storici",
    en: "Hide buildings with room for Historical Allies",
  },
  showHistoricalAllyBuildingsTitle: {
    it: "Mostra edifici che possono ospitare Alleati Storici",
    en: "Show buildings with room for Historical Allies",
  },
  hideMassAidBuildingsTitle: {
    it: "Nascondi edifici che producono frammenti di Auto-aiuto di massa",
    en: "Hide buildings that produce Mass Self-Aid fragments",
  },
  showMassAidBuildingsTitle: {
    it: "Mostra edifici che producono frammenti di Auto-aiuto di massa",
    en: "Show buildings that produce Mass Self-Aid fragments",
  },
  hideStoreBuildingBuildingsTitle: {
    it: "Nascondi edifici che producono frammenti di Immagazzina edificio",
    en: "Hide buildings that produce Store Building fragments",
  },
  showStoreBuildingBuildingsTitle: {
    it: "Mostra edifici che producono frammenti di Immagazzina edificio",
    en: "Show buildings that produce Store Building fragments",
  },
  hideGreatBuildingsTitle: {
    it: "Nascondi Grandi Edifici",
    en: "Hide Great Buildings",
  },
  showGreatBuildingsTitle: {
    it: "Mostra Grandi Edifici",
    en: "Show Great Buildings",
  },
  greatBuildingBadge: {
    it: "GE",
    en: "GB",
  },
  daySuffix: {
    it: "g",
    en: "d",
  },
  viewOnWikiTitle: {
    it: (name: string, lang: string) => `Vedi ${name} su FoE Wiki (${lang})`,
    en: (name: string, lang: string) => `View ${name} on FoE Wiki (${lang})`,
  },
  // Placeholder nel popup immagine (👁️/? in cella nome) quando manca
  // l'hash: alcuni livelli intermedi di set a gradazione riusano lo sprite
  // di un livello precedente e non hanno un hash proprio nel CSV.
  noImageAvailable: {
    it: "Nessuna immagine disponibile",
    en: "No image available",
  },
  ownedAlliesCount: {
    it: "Alleati posseduti",
    en: "Owned allies",
  },
  // Niente emoji 🧩: il chiamante antepone iconFragment come <img>.
  fragmentsProducedTitle: {
    it: "Produce frammenti di:",
    en: "Produces fragments of:",
  },
  selectionKitOptionsTitle: {
    it: "Opzioni del kit di selezione:",
    en: "Selection kit options:",
  },
  requiredKits: {
    it: "Kit necessari:",
    en: "Required kits:",
  },
  upgradableBadge: {
    it: "AGGIORNABILE",
    en: "UPGRADABLE",
  },

  // ── Modale "Efficienza e Pesi" ────────────────────────────────────────
  effHelpTitle: {
    it: "⚖️ Efficienza e Pesi",
    en: "⚖️ Efficiency and Weights",
  },
  effHelpStep1Title: {
    it: "Come viene calcolata l'efficienza?",
    en: "How is efficiency calculated?",
  },
  effHelpStep1Intro: {
    it: "Per ogni edificio o alleato viene calcolato un punteggio di efficienza usando questa formula:",
    en: "For each building or ally, an efficiency score is calculated using this formula:",
  },
  effHelpFormula: {
    it: "Efficienza = (somma dei bonus pesati) ÷ (spazio occupato + strade)",
    en: "Efficiency = (sum of weighted bonuses) ÷ (occupied space + roads)",
  },
  effHelpBonusesIntro: {
    it: "I bonus considerati sono:",
    en: "The bonuses taken into account are:",
  },
  effHelpBonusGeneral: {
    it: "bonus validi in modo generale",
    en: "bonuses that apply generally",
  },
  effHelpBonusGbg: {
    it: "bonus specifici per i campi di battaglia",
    en: "bonuses specific to battlegrounds",
  },
  effHelpBonusGe: {
    it: "bonus per le Spedizioni di Gilda (opzionale)",
    en: "bonuses for Guild Expeditions (optional)",
  },
  effHelpStep1Footnote: {
    it: (buildings: string, allies: string) => `Il meccanismo è lo stesso sia per gli ${buildings} (tab Info, Città, Inventario) sia per gli ${allies} (tab Alleati): i pesi che modifichi nella toolbar si applicano a entrambi.`,
    en: (buildings: string, allies: string) => `The mechanism is the same for both ${buildings} (Info, City, Inventory tabs) and ${allies} (Allies tab): the weights you change in the toolbar apply to both.`,
  },
  effHelpBuildingsWord: {
    it: "edifici",
    en: "buildings",
  },
  effHelpAlliesWord: {
    it: "alleati",
    en: "allies",
  },
  effHelpStep2Title: {
    it: "I pesi che puoi modificare",
    en: "The weights you can change",
  },
  effHelpAtkTitle: {
    it: (atk: string) => `⚔️ ${atk} (Attacco)`,
    en: (atk: string) => `⚔️ ${atk} (Attack)`,
  },
  effHelpAtkBody: {
    it: "Il peso dell'Attacco è fisso a 1,0: è il riferimento rispetto al quale si calibra il peso della Difesa.",
    en: "The Attack weight is fixed at 1.0: it's the reference against which the Defense weight is calibrated.",
  },
  effHelpDefTitle: {
    it: (def: string) => `🛡️ ${def} (Difesa — 0,8 / 1,0)`,
    en: (def: string) => `🛡️ ${def} (Defense — 0.8 / 1.0)`,
  },
  effHelpDefBody: {
    it: "Decide quanto peso dare ai bonus di Difesa rispetto all'Attacco. Il valore predefinito è 0,8: i bonus difensivi contano un po' meno di quelli offensivi nel calcolo finale.",
    en: "Decides how much weight to give Defense bonuses relative to Attack. The default value is 0.8: defensive bonuses count a bit less than offensive ones in the final calculation.",
  },
  effHelpCamTitle: {
    it: (cam: string) => `🔰 ${cam} (riquadro Att/Dif risultanti)`,
    en: (cam: string) => `🔰 ${cam} (resulting Atk/Def box)`,
  },
  effHelpCamBody: {
    it: "Mostra i due pesi Attacco e Difesa effettivamente usati nel calcolo, dopo aver tolto la quota riservata alle Spedizioni (se attive). Non è modificabile direttamente: si aggiorna in base agli altri controlli.",
    en: "Shows the two Attack and Defense weights actually used in the calculation, after removing the share reserved for Expeditions (if enabled). It cannot be edited directly: it updates based on the other controls.",
  },
  effHelpSigmaBody: {
    it: "Mostra colonne aggiuntive con la somma Generale+Campi (e Generale+Spedizioni, se attive) per ogni edificio o alleato — utile per confrontare il bonus complessivo senza fare i calcoli a mente.",
    en: "Shows additional columns with the General+Battlegrounds sum (and General+Expeditions, if enabled) for each building or ally — useful for comparing the overall bonus without doing the math mentally.",
  },
  effHelpSpeTitle: {
    it: (spe: string) => `⚡ ${spe} (Spedizioni — on/off + slider)`,
    en: (spe: string) => `⚡ ${spe} (Expeditions — on/off + slider)`,
  },
  effHelpSpeBody: {
    it: "Se vuoi considerare anche le Spedizioni di Gilda nel calcolo, attiva questo switch. Lo slider decide quanto \"peso\" dare alle Spedizioni rispetto ai Campi. A 0,20 (default), il 20% dei bonus va alle Spedizioni e l'80% ai Campi.",
    en: "If you also want to factor Guild Expeditions into the calculation, turn on this switch. The slider decides how much \"weight\" to give Expeditions relative to Battlegrounds. At 0.20 (default), 20% of the bonus weight goes to GE and 80% to GBG.",
  },
  effHelpStep3Title: {
    it: "Filtrare per soglia di efficienza",
    en: "Filtering by efficiency threshold",
  },
  effHelpStep3Body: {
    it: "Nell'header della colonna EFF della tabella puoi inserire una soglia minima (min EFF): scrivendo, ad esempio, 80, vedrai solo gli edifici o alleati con efficienza superiore a 80, calcolata con i pesi attuali.",
    en: "In the EFF column header you can enter a minimum threshold (min EFF): by typing, for example, 80, you'll only see buildings or allies with an efficiency above 80, based on the current weights.",
  },
  gotItButton: {
    it: "Ho capito",
    en: "Got it",
  },

  // ── Modale "Profili e Bacchetta Magica" ───────────────────────────────
  profileHelpModalTitle: {
    it: "Profili e Bacchetta magica",
    en: "Profiles and Magic Wand",
  },
  profileHelpStep1Title: {
    it: "Cosa sono i Profili?",
    en: "What are Profiles?",
  },
  profileHelpStep1Intro: {
    it: "Un profilo è come una scheda personale: contiene la città, l'inventario e gli alleati di un giocatore. Puoi crearne quanti vuoi.",
    en: "A profile is like a personal save file: it stores a player's city, inventory, and allies. You can create as many profiles as you like.",
  },
  profileHelpIndependent: {
    it: "Ogni profilo è indipendente; i dati di un profilo non influenzano gli altri.",
    en: "Each profile is independent; data in one profile does not affect the others.",
  },
  profileHelpDoubleClick: {
    it: "Doppio click sul nome di un profilo per rinominarlo (es. \"Live\", \"Beta\").",
    en: "Double-click a profile's name to rename it (e.g. \"Live\", \"Beta\").",
  },
  profileHelpSingleClick: {
    it: "Click singolo per passare da un profilo all'altro.",
    en: "Click a profile's name to switch to it.",
  },
  profileHelpDeleteOne: {
    it: "Click sulla × accanto al nome per cancellare quel profilo e tutti i suoi dati.",
    en: "The × next to the name deletes that profile and all its data.",
  },
  profileHelpDeleteAllBody: {
    it: "Il pulsante elimina tutti i profili dopo una conferma. La barra torna vuota, pronta per un nuovo import con la bacchetta.",
    en: "The button deletes all profiles after a confirmation. The bar becomes empty again, ready for a new import with the wand.",
  },
  profileHelpStep2Title: {
    it: "La Bacchetta Magica",
    en: "The Magic Wand",
  },
  profileHelpStep2Intro: {
    it: "La bacchetta magica importa tutti i dati di gioco - città, inventario e alleati storici - con un solo click.",
    en: "The magic wand imports all your game data - city, inventory, and historical allies - in one step.",
  },
  profileHelpVideoTitle: {
    it: "Tutorial: come importare la città",
    en: "Tutorial: how to import your city",
  },
  profileHelpStep2_1Title: {
    it: "Installa FoE Helper nel tuo browser",
    en: "Install FoE Helper in your browser",
  },
  profileHelpStep2_1Body: {
    it: "È un'estensione gratuita per il browser che legge i dati di Forge of Empires mentre giochi.",
    en: "It's a free browser extension that reads Forge of Empires data while you play.",
  },
  profileHelpStep2_2Title: {
    it: "Trascina nella barra dei preferiti",
    en: "Drag it to your bookmarks bar",
  },
  profileHelpStep2_2Body: {
    it: "Tieni premuto il pulsante bacchetta e trascinalo nella barra dei preferiti. Verrà creato un segnalibro speciale che puoi rinominare come vuoi.",
    en: "Click and hold the wand button, then drag it up to your browser's bookmarks bar. A new bookmark will be created (you can rename it if you wish).",
  },
  profileHelpBookmarkHint: {
    it: "← vedrai questo \"indirizzo\"",
    en: "← you'll see this \"address\"",
  },
  profileHelpStep2_3Title: {
    it: "Vai nel gioco e clicca quel segnalibro",
    en: "Go to the game and click that bookmark",
  },
  profileHelpStep2_3Body: {
    it: "Con Forge of Empires aperto nel browser e FoE Helper funzionante clicca il segnalibro che hai creato. Lui copierà in silenzio tutti i dati di gioco negli appunti del computer.",
    en: "While the game is open and FoE Helper is active, click that bookmark. It will silently copy your data to your computer’s clipboard.",
  },
  profileHelpStep2_4Title: {
    it: "Torna qui e clicca",
    en: "Come back here and click",
  },
  profileHelpStep2_4Body: {
    it: "FoE Optimizer leggerà gli appunti, creerà automaticamente un nuovo profilo e importerà città, inventario e alleati in un colpo solo. I profili già esistenti non verranno mai toccati.",
    en: "FoE Optimizer will read the clipboard, automatically create a new profile, and import your city, inventory, and allies in one go. Existing profiles are never touched.",
  },
  profileHelpUpdateNote: {
    it: (action: string) => `${action} basta ripetere i passi 3 e 4: viene creato un profilo nuovo con i dati aggiornati senza sovrascrivere i profili esistenti.`,
    en: (action: string) => `${action} simply repeat steps 3 and 4: a new profile is created with the latest data without overwriting existing profiles.`,
  },
  profileHelpUpdateNoteEmphasis: {
    it: "Ogni volta che vuoi aggiornare i dati",
    en: "Every time you want to refresh your data,",
  },
  profileHelpStep3Title: {
    it: "Pulsanti SAVE e LOAD",
    en: "SAVE and LOAD buttons",
  },
  profileHelpSaveBody: {
    it: "Esporta tutti i profili in un file JSON. Utile come backup o per trasferire i dati tra diversi dispositivi (es. da un PC a un tablet).",
    en: "Exports all profiles to a JSON file. Use this for backups or to transfer data between devices (e.g., from PC to tablet).",
  },
  profileHelpLoadBody: {
    it: "Importa i profili da un file JSON precedentemente salvato e li aggiunge a quelli esistenti senza sovrascrivere i profili esistenti.",
    en: "Imports profiles from a previously saved JSON file. These will be added to your current list without overwriting existing profiles.",
  },
  gotItExclamationButton: {
    it: "Ho capito!",
    en: "Got it!",
  },

  // ── Pulsante Download Inventario (gemello di downloadCityListTitle) ──
  downloadInventoryListTitle: {
    it: "Scarica la lista completa dell'inventario",
    en: "Download the full inventory list",
  },

  // ── Contatore "Alleati posseduti" (riga header tabella alleati) ──────
  alliesPlacedInCity: {
    it: "posizionati in città,",
    en: "placed in the city,",
  },
  alliesInInventory: {
    it: "in inventario e",
    en: "in inventory and",
  },
  alliesFragmented: {
    it: "frammentati)",
    en: "fragmented)",
  },
  allyLevelTitle: {
    it: "Livello alleato",
    en: "Ally level",
  },

  // ── Tooltip "edificio vecchio" (confronto era-su-era) ────────────────
  oldBuildingSingular: {
    it: "edificio vecchio",
    en: "old building",
  },
  oldBuildingPlural: {
    it: "edifici vecchi",
    en: "old buildings",
  },
  upgradeToEraTitle: {
    it: (era: string) => `✨ Se aggiorni a ${era}:`,
    en: (era: string) => `✨ If you upgrade to ${era}:`,
  },
  copySingular: {
    it: "copia",
    en: "copy",
  },
  copyPlural: {
    it: "copie",
    en: "copies",
  },
  fromEraWord: {
    it: "da",
    en: "from",
  },
  eraDiffSingular: {
    it: "-1 era",
    en: "-1 era",
  },
  eraDiffPlural: {
    it: (n: number) => `-${n} ere`,
    en: (n: number) => `-${n} eras`,
  },
  noProductionChanges: {
    it: "Nessuna variazione nelle produzioni.",
    en: "No production changes.",
  },
  goodsEraChangeNote: {
    it: (currentEra: string, oldEra: string) => `📦 I Beni prodotti saranno di ${currentEra} invece che di ${oldEra}.`,
    en: (currentEra: string, oldEra: string) => `📦 Goods produced will be from ${currentEra} instead of ${oldEra}.`,
  },
  upgradeKitsAvailable: {
    it: "Kit per aggiornare:",
    en: "Kits to upgrade:",
  },
  inInventoryCount: {
    it: (n: number) => `${n} in inventario`,
    en: (n: number) => `${n} in inventory`,
  },
  upgradableLabel: {
    it: "Aggiornabile",
    en: "Upgradable",
  },
  upgradeTargetLabel: {
    it: "Target:",
    en: "Target:",
  },
  upgradeBody: {
    it: "Puoi aggiornarlo con i kit di aggiornamento che hai in inventario.",
    en: "You can upgrade it with the upgrade kits you have in your inventory.",
  },
  upgradeAutoEraNote: {
    it: "passa automaticamente all'era attuale",
    en: "automatically moves to the current era",
  },

  // ── Secondo tooltip "Aggiornabile a:" (kit selection, edifici città) ─
  upgradableToLabel: {
    it: "Aggiornabile a:",
    en: "Upgradable to:",
  },
  kitsInInventoryLabel: {
    it: "Kit in inventario:",
    en: "Kits in inventory:",
  },

  // ── DIFF_FIELDS: etichette compatte del confronto era-su-era ─────────
  diffPopulation: {
    it: "Popolazione",
    en: "Population",
  },
  diffHappiness: {
    it: "Felicità",
    en: "Happiness",
  },
  diffGenAtkAtk: {
    it: "Att. attaccante",
    en: "Atk attacker",
  },
  diffGenDefAtk: {
    it: "Dif. attaccante",
    en: "Def attacker",
  },
  diffGenAtkDef: {
    it: "Att. difensore",
    en: "Atk defender",
  },
  diffGenDefDef: {
    it: "Dif. difensore",
    en: "Def defender",
  },
  diffGbgAtkAtk: {
    it: "Campi att. att.",
    en: "GBG atk atk.",
  },
  diffGbgDefAtk: {
    it: "Campi dif. att.",
    en: "GBG def atk.",
  },
  diffGbgAtkDef: {
    it: "Campi att. dif.",
    en: "GBG atk def.",
  },
  diffGbgDefDef: {
    it: "Campi dif. dif.",
    en: "GBG def def.",
  },
  diffGeAtkAtk: {
    it: "Sped. att. att.",
    en: "GE atk atk.",
  },
  diffGeDefAtk: {
    it: "Sped. dif. att.",
    en: "GE def atk.",
  },
  diffGeAtkDef: {
    it: "Sped. att. dif.",
    en: "GE atk def.",
  },
  diffGeDefDef: {
    it: "Sped. dif. dif.",
    en: "GE def def.",
  },
  diffIqAtkAtk: {
    it: "IQ att. att.",
    en: "QI atk atk.",
  },
  diffIqDefAtk: {
    it: "IQ dif. att.",
    en: "QI def atk.",
  },
  diffIqAtkDef: {
    it: "IQ att. dif.",
    en: "QI atk def.",
  },
  diffIqDefDef: {
    it: "IQ dif. dif.",
    en: "QI def def.",
  },
  diffIqCoinsBoost: {
    it: "IQ Monete %",
    en: "QI Coins %",
  },
  diffIqMaterialsBoost: {
    it: "IQ Materiali %",
    en: "QI Supplies %",
  },
  diffIqCoins: {
    it: "IQ Monete",
    en: "QI Coins",
  },
  diffIqMaterials: {
    it: "IQ Materiali",
    en: "QI Supplies",
  },
  diffIqGoods: {
    it: "IQ Beni",
    en: "QI Goods",
  },
  diffIqUnits: {
    it: "IQ Truppe",
    en: "QI Units",
  },
  diffIqActions: {
    it: "IQ Azioni",
    en: "QI Actions",
  },
  diffIqCapacity: {
    it: "IQ Capacità",
    en: "QI Capacity",
  },
  diffCoins: {
    it: "Monete",
    en: "Coins",
  },
  diffMaterials: {
    it: "Materiali",
    en: "Supplies",
  },
  diffForgePoints: {
    it: "Punti Forge",
    en: "Forge Points",
  },
  diffForgePointsBoost: {
    it: "Boost PF",
    en: "FP Boost",
  },
  diffRogues: {
    it: "Furfanti",
    en: "Rogues",
  },
  diffUnits: {
    it: "Truppe",
    en: "Units",
  },
  diffUnitsNextEra: {
    it: "Truppe era succ.",
    en: "Next era units",
  },
  diffGoods: {
    it: "Beni",
    en: "Goods",
  },
  diffGoodsPreviousEra: {
    it: "Beni era prec.",
    en: "Prev. era goods",
  },
  diffGoodsNextEra: {
    it: "Beni era succ.",
    en: "Next era goods",
  },
  diffGoodsBoost: {
    it: "Boost Beni",
    en: "Goods Boost",
  },
  diffTreasuryGoods: {
    it: "Beni tesoreria",
    en: "Treasury Goods",
  },
  diffBlueprints: {
    it: "Progetti",
    en: "Blueprints",
  },
  diffMassAid: {
    it: "Aiuto di massa",
    en: "Mass Self-Aid",
  },
  diffOneUpKit: {
    it: "Kit modernizz.",
    en: "One Up Kit",
  },
  diffRenovationKit: {
    it: "Kit rinnovo",
    en: "Renovation Kit",
  },
  diffStoreBuilding: {
    it: "Immagazzina",
    en: "Store",
  },

  // ── Alert (bacchetta magica, export) ──────────────────────────────────
  unknownErrorFallback: {
    it: "errore sconosciuto",
    en: "unknown error",
  },
  exportErrorAlert: {
    it: (msg: string) => `Errore durante l'export: ${msg}`,
    en: (msg: string) => `Error during export: ${msg}`,
  },
  clipboardEmptyAlert: {
    it: "Dati non validi: la clipboard è vuota. Se hai appena cliccato la bacchetta magica e hai visto un errore JavaScript sulla pagina del gioco, il tuo bookmarklet è una versione precedente: trascinane uno nuovo dai pulsanti profilo qui sopra, poi riprova.",
    en: "Invalid data: the clipboard is empty. If you just clicked the magic wand and saw a JavaScript error on the game page, your bookmarklet is an older version: drag a new one from the profile buttons above, then try again.",
  },
  clipboardNotJsonAlert: {
    it: "Dati non validi: il contenuto della clipboard non è JSON valido. Se hai appena cliccato la bacchetta magica e hai visto un errore JavaScript sulla pagina del gioco, il tuo bookmarklet è una versione precedente: trascinane uno nuovo dai pulsanti profilo qui sopra, poi riprova.",
    en: "Invalid data: the clipboard content is not valid JSON. If you just clicked the magic wand and saw a JavaScript error on the game page, your bookmarklet is an older version: drag a new one from the profile buttons above, then try again.",
  },
  clipboardPermissionDeniedAlert: {
    it: "Import fallito: il browser ha negato a questo sito il permesso di leggere gli appunti. Alcuni browser (es. Vivaldi, Brave) lo bloccano di default. Prova a: 1) ricaricare la pagina e riprovare; 2) controllare le autorizzazioni del sito nelle impostazioni del browser (di solito in Impostazioni > Privacy/Sicurezza > Autorizzazioni sito, voce \"Appunti\") e abilitare manualmente l'accesso per foe-optimizer.com; 3) ricaricare e riprovare.",
    en: "Import failed: your browser denied this site permission to read the clipboard. Some browsers (e.g. Vivaldi, Brave) block it by default. Try: 1) reloading the page and trying again; 2) checking the site's permissions in your browser settings (usually under Settings > Privacy/Security > Site permissions, \"Clipboard\") and manually allowing access for foe-optimizer.com; 3) reload and retry.",
  },
  clipboardReadErrorAlert: {
    it: "Dati non validi: impossibile leggere la clipboard.",
    en: "Invalid data: unable to read the clipboard.",
  },
  bookmarkletInvalidFormat: {
    it: "Dati non validi: formato non riconosciuto.",
    en: "Invalid data: unrecognized format.",
  },
  bookmarkletMissingFields: {
    it: (fields: string) => `Dati non validi: mancano i campi ${fields}.`,
    en: (fields: string) => `Invalid data: missing fields ${fields}.`,
  },
  importErrorAlert: {
    it: (detail: string) => `Errore durante l'importazione dei dati. Il profilo non è stato creato.\n\nDettaglio: ${detail}`,
    en: (detail: string) => `Error while importing data. The profile was not created.\n\nDetail: ${detail}`,
  },
  bookmarkletOutdatedAlert: {
    it: "Import riuscito, ma il bookmarklet che hai usato è una versione precedente: alcuni dati potrebbero mancare o non essere aggiornati. Trascina di nuovo la bacchetta magica nella barra dei preferiti per aggiornarla, poi riprova l'import.",
    en: "Import successful, but the bookmarklet you used is an older version: some data may be missing or outdated. Drag the magic wand to your bookmarks bar again to update it, then try importing again.",
  },
  bookmarkletAnnouncementTitle: {
    it: "FoE Helper ha aggiornato la gestione degli alleati",
    en: "FoE Helper updated how allies are handled",
  },
  bookmarkletAnnouncementBody: {
    it: "Se dopo aver cliccato la bacchetta magica 🪄 sul gioco vedi un errore JavaScript (es. su \"allyList\"), il tuo bookmarklet è una versione precedente: trascinane uno nuovo dai pulsanti profilo qui sopra.",
    en: "If clicking the magic wand 🪄 on the game shows a JavaScript error (e.g. about \"allyList\"), your bookmarklet is an older version: drag a new one from the profile buttons above.",
  },

  // ── Modale "Aggiornamento richiesto" (dati salvati obsoleti) ─────────
  outdatedModalTitle: {
    it: "Aggiornamento richiesto",
    en: "Update required",
  },
  outdatedModalIntro: {
    it: "È stata rilevata una versione obsoleta dei dati salvati.",
    en: "An outdated version of the saved data was detected.",
  },
  outdatedModalBody: {
    it: (action: string) => `A causa di un aggiornamento strutturale dell'applicazione, ${action} per garantire il corretto funzionamento.`,
    en: (action: string) => `Due to a structural update of the application, ${action} to ensure everything works correctly.`,
  },
  outdatedModalBodyEmphasis: {
    it: "tutti i profili attuali verranno rimossi",
    en: "all current profiles will be removed",
  },
  outdatedModalDetail: {
    it: "I dati della versione precedente non sono compatibili con questa versione e verranno rimossi. Dovrai reimportare i tuoi dati dal gioco tramite la bacchetta magica.",
    en: "Data from the previous version is not compatible with this version and will be removed. You'll need to re-import your game data using the magic wand.",
  },
  outdatedModalButton: {
    it: "Ho capito, pulisci tutto",
    en: "Got it, clear everything",
  },

  // ── Filtro rarità alleati (toggle Comune/Raro/Epico/Leggendario/ecc.) ─
  hideRarityTitle: {
    it: (rarity: string) => `Nascondi ${rarity}`,
    en: (rarity: string) => `Hide ${rarity}`,
  },
  showRarityTitle: {
    it: (rarity: string) => `Mostra ${rarity}`,
    en: (rarity: string) => `Show ${rarity}`,
  },
  fromInventoryLabel: {
    it: "Da inventario:",
    en: "From inventory:",
  },
  // ── Modale "Chi sono · Contatti" ─────────────────────────────────────────────────────
  aboutTitle: {
    it: "Chi sono · Contatti",
    en: "About · Contact",
  },
  aboutContactLabel: {
    it: "Trovami su FoE:",
    en: "Find me on FoE:",
  },
  aboutServerItLabel: {
    it: "Server Italiano",
    en: "Italian Server",
  },
  aboutServerBetaLabel: {
    it: "Server Beta",
    en: "Beta Server",
  },
  aboutWorldLabel: {
    it: "Mondo",
    en: "World",
  },
  aboutGithubLabel: {
    it: "Codice sorgente",
    en: "Source code",
  },
  aboutPrivacyLabel: {
    it: "Informativa sulla privacy",
    en: "Privacy policy",
  },
  emptyAllySlotBadgeTitle: {
    it: "Slot alleato libero",
    en: "Empty ally slot",
  },
  filledAllySlotBadgeTitle: {
    it: (allyDisplayName: string) => `Alleato: ${allyDisplayName}`,
    en: (allyDisplayName: string) => `Ally: ${allyDisplayName}`,
  },
  showOnlyWithAllySlotTitle: {
    it: "Mostra solo gli edifici con uno slot alleato",
    en: "Show only buildings with an ally slot",
  },
  showOnlyWithFragmentsTitle: {
    it: "Mostra solo gli edifici che producono frammenti di edifici o di kit di selezione/aggiornamento",
    en: "Show only buildings that produce fragments of buildings or selection/upgrade kits",
  },
  showOnlyDeclassableTitle: {
    it: "Mostra solo gli edifici che possono essere declassati senza conseguenze (stesse stat. militari, meno popolazione)",
    en: "Show only the buildings that can be downgraded without consequences (same military stats, less population)",
  },
  declassableTooltipHeader: {
    it: "Edificio declassabile",
    en: "Downgradable building",
  },
  declassablePopGainLabel: {
    it: "Risparmio",
    en: "Savings",
  },
  declassableKitSection: {
    it: "Kit necessario",
    en: "Required kit",
  },

  // ── Tabella edifici: export e placeholder ────────────────────────────
  exportSelectFirstTitle: {
    it: "Seleziona almeno un edificio",
    en: "Select at least one building",
  },
  exportSelectedCsvTitle: {
    it: (n: number) => `Esporta ${n} edifici in CSV`,
    en: (n: number) => `Export ${n} buildings to CSV`,
  },
  noBuildingsFound: {
    it: "Nessun edificio trovato.",
    en: "No buildings found.",
  },
  noAlliesFound: {
    it: "Nessun alleato trovato con questa ricerca.",
    en: "No allies found for this search.",
  },
  fabChoiceLabel: {
    it: "Scelta:",
    en: "Choice:",
  },
  avatarOutdatedTitle: {
    it: "Avatar non disponibile: stai usando una versione vecchia della bacchetta magica. Aggiorna il bookmarklet e reimporta i dati per vedere il tuo avatar.",
    en: "Avatar not available: you are using an old version of the magic wand. Update the bookmarklet and re-import your data to see your avatar.",
  },

  // ── Header gruppo Produzioni, tab Città ──────────────────────────────
  // Chiarisce che i valori delle righe si riferiscono all'era corrente del
  // giocatore (anche per le copie di ere precedenti — comportamento voluto,
  // il dettaglio per-era sta nel tooltip del triangolo "obsoleto").
  prodValuesOfEra: {
    it: (era: string) => `valori di ${era}`,
    en: (era: string) => `${era} values`,
  },

  // ── Avviso aggiornamento service worker (vedi src/registerSW.ts) ─────
  // Solo informativo: il reload è automatico, nessun pulsante di conferma.
  swUpdateAvailable: {
    it: "Nuova versione disponibile — aggiornamento in corso…",
    en: "New version available — updating…",
  },
} as const;

/** Stringhe identiche in italiano e inglese: una sola entry, niente da
 *  tradurre due volte (es. termini gaming/tecnici già condivisi). */
const UI_STRINGS_SHARED = {
  tabInfo: "Info",
  debugLabel: "Debug",
  effHelpSigmaTitle: "Σ Sigma",
  inInventoryBadge: "INV",
  zoomResetTitle: "Reset zoom",
} as const;

export type UiKey = keyof typeof UI_STRINGS;
type UiSharedKey = keyof typeof UI_STRINGS_SHARED;

export function t(key: UiSharedKey): string;
export function t(key: UiKey, lang: UiLang, ...args: unknown[]): string;
export function t(key: UiKey | UiSharedKey, lang?: UiLang, ...args: unknown[]): string {
  if (key in UI_STRINGS_SHARED) {
    return UI_STRINGS_SHARED[key as UiSharedKey];
  }
  const entry = UI_STRINGS[key as UiKey];
  const resolved = entry[lang as UiLang] ?? entry.en;
  return typeof resolved === "function"
    ? (resolved as (...a: unknown[]) => string)(...args)
    : resolved;
}

/**
 * Titoli/alt delle colonne bonus militari: seguono tutti lo stesso schema
 * "{Attacco|Difesa} {rosso|blu} (Sezione)", spesso con prefisso "Σ" per le
 * varianti sigma — 16 colonne per il blocco Generale/Campi/Spedizioni, e si
 * ripete identico per le colonne IQ. Componendo i pezzi invece di scrivere
 * ~30 frasi quasi identiche, una correzione (es. di terminologia) si fa in
 * un punto solo.
 */
type BoostSide = "atk" | "def";
type BoostColor = "red" | "blue";

const BOOST_SIDE: Record<BoostSide, Record<UiLang, string>> = {
  atk: { it: "Attacco", en: "Attack" },
  def: { it: "Difesa", en: "Defense" },
};
const BOOST_COLOR: Record<BoostColor, Record<UiLang, string>> = {
  red: { it: "Rosso", en: "Red" },
  blue: { it: "Blu", en: "Blue" },
};

/** Es. boostTitle("it", "atk", "red", "Generale") -> "Attacco Rosso (Generale)"
 *  Es. boostTitle("en", "def", "blue", "GBG", true) -> "Σ Blue Defense (Gen+GBG)" */
export function boostTitle(lang: UiLang, side: BoostSide, color: BoostColor, section: string, sigma = false): string {
  const base = lang === "en"
  ? `${BOOST_COLOR[color][lang]} ${BOOST_SIDE[side][lang]}`
  : `${BOOST_SIDE[side][lang]} ${BOOST_COLOR[color][lang]}`;
  return sigma ? `Σ ${base} (${section})` : `${base} (${section})`;
}
