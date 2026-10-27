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
    it: "Clic: importa la città copiata dal segnalibro · Trascinala nella barra dei preferiti per creare il segnalibro da usare nel gioco",
    en: "Click: import the city copied by the bookmark · Drag it to the bookmarks bar to create the bookmark to use in the game",
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

  // ── Tab di navigazione ────────────────────────────────────────────────
  // ── FoE Optimizer 2.0: schede e nastro (ui/Testata.tsx, ui/nastri.tsx) ──
  r2CityUpdated: { it: (n: string) => `Aggiornata ${n}`, en: (n: string) => `${n} updated` },
  r2CityAdded: { it: (n: string) => `Aggiunta la tua città ${n}`, en: (n: string) => `Your city ${n} added` },
  r2CityAddedVisited: { it: (n: string) => `Aggiunta la città di ${n}`, en: (n: string) => `${n}'s city added` },
  r2MyCities: { it: "Le tue città", en: "Your cities" },
  r2JsonCities: { it: "Città importate da JSON", en: "Cities imported from JSON" },
  r2VisitedCities: { it: "Città visitate", en: "Visited cities" },
  r2VisitedCity: { it: "Città visitata", en: "Visited city" },
  r2GrpPlayer: { it: "Giocatore", en: "Player" },
  r2NoCitiesYet: { it: "Nessuna città: importala con la bacchetta verde in alto.", en: "No cities yet: import one with the green magic wand at the top." },
  r2DeleteCity: { it: "Elimina", en: "Delete" },
  r2DeleteAsk: { it: (n: string) => `Eliminare ${n}?`, en: (n: string) => `Delete ${n}?` },
  r2DeleteMine: {
    it: "Verranno tolti mappa, inventario, alleati e insediamenti di questa città. Fai prima un backup da Opzioni se vuoi conservarli.",
    en: "Map, inventory, allies and settlements of this city will be removed. Make a backup from Options first if you want to keep them.",
  },
  r2DeleteVisited: {
    it: "Verrà tolta la mappa di questa città visitata. Potrai reimportarla quando vuoi.",
    en: "The map of this visited city will be removed. You can import it again at any time.",
  },
  r2Cancel: { it: "Annulla", en: "Cancel" },
  r2OnlyMine: { it: "Disponibile solo per le tue città", en: "Only available for your cities" },
  r2GrpSavedCities: { it: "Città salvate", en: "Saved cities" },
  r2GrpBackup: { it: "Backup", en: "Backup" },
  r2Manage: { it: "Gestisci", en: "Manage" },
  r2DeleteAll: { it: "Elimina tutte", en: "Delete all" },
  r2GrpReset: { it: "Azzera", en: "Reset" },
  r2ResetAll: { it: "Cancella tutto", en: "Erase everything" },
  r2ResetAllTitle: { it: "Cancella tutti i dati e le impostazioni salvati da questo sito nel browser (città, pesi, tema, lingua…) e ricarica la pagina", en: "Erase all data and settings this site saved in the browser (cities, weights, theme, language…) and reload the page" },
  r2ResetAllConfirm: { it: "Cancellare TUTTI i dati e le impostazioni salvati (città, pesi, tema, lingua e qualunque altra cosa)?\n\nNon si può annullare: se vuoi tenerli, prima fai \"Esporta tutto\".", en: "Erase ALL saved data and settings (cities, weights, theme, language and anything else)?\n\nThis cannot be undone: to keep them, use \"Export all\" first." },
  r2ExportAll: { it: "Esporta tutto", en: "Export all" },
  r2Restore: { it: "Ripristina", en: "Restore" },
  r2TabDatabase: { it: "Database", en: "Database" },
  r2TabCity: { it: "Città", en: "City" },
  r2TabInventory: { it: "Inventario", en: "Inventory" },
  r2TabPlanner: { it: "Planner", en: "Planner" },
  r2TabAllies: { it: "Alleati", en: "Allies" },
  r2TabSettlements: { it: "Insediamenti", en: "Settlements" },
  r2TabOptions: { it: "Opzioni", en: "Options" },
  r2TabHelp: { it: "Guida", en: "Help" },
  r2GrpCatalog: { it: "Catalogo", en: "Catalog" },
  r2GrpSearch: { it: "Ricerca", en: "Search" },
  r2GrpCity: { it: "Città", en: "City" },
  r2GrpTools: { it: "Strumenti", en: "Tools" },
  r2GrpSource: { it: "Sorgente", en: "Source" },
  r2GrpTheme: { it: "Tema", en: "Theme" },
  r2GrpLearn: { it: "Impara", en: "Learn" },
  r2GrpInfo: { it: "Info", en: "Info" },
  r2Buildings: { it: "Edifici", en: "Buildings" },
  r2AlliesCat: { it: "Alleati", en: "Allies" },
  r2GreatBuildings: { it: "Grandi edifici", en: "Great buildings" },
  r2Soon: { it: "In arrivo", en: "Coming soon" },
  r2Map: { it: "Mappa", en: "Map" },
  r2SelectedCity: { it: "Città selezionata", en: "Selected city" },
  r2ImportJson: { it: "Importa JSON", en: "Import JSON" },
  r2Dark: { it: "Scuro", en: "Dark" },
  r2Light: { it: "Chiaro", en: "Light" },
  r2Guide: { it: "Guida", en: "Guide" },
  r2ImportHow: { it: "Come importare la città", en: "How to import your city" },
  r2PlannerHow: { it: "Come usare il planner", en: "How to use the planner" },
  r2PlannerHowIntro: {
    it: "Il video tutorial mostra passo passo come usare il Planner.",
    en: "The video tutorial shows step by step how to use the Planner (video in Italian).",
  },
  r2ImpIntro: {
    it: "La bacchetta magica porta qui la tua città dal gioco con due clic: un segnalibro copia i dati mentre giochi, la bacchetta li legge e li importa. Si prepara una volta sola.",
    en: "The magic wand brings your city here from the game in two clicks: a bookmark copies the data while you play, the wand reads and imports it. You only set it up once.",
  },
  r2ImpSteps: { it: "I passi", en: "Steps" },
  r2ImpStep1: { it: "Installa FoE Helper o Forge Hammer", en: "Install FoE Helper or Forge Hammer" },
  r2ImpStep1Body: {
    it: "Sono estensioni gratuite del browser, non fanno parte di questo progetto: leggono i dati di Forge of Empires mentre giochi. Ne basta una.",
    en: "These are free browser extensions, not part of this project: they read Forge of Empires data while you play. One is enough.",
  },
  r2ImpStep2: { it: "Trascina la bacchetta nella barra dei preferiti", en: "Drag the wand to your bookmarks bar" },
  r2ImpStep2Body: {
    it: "Tieni premuto sul pulsante verde (questo qui o quello in alto, accanto al nome del tool) e lascialo nella barra dei preferiti: diventa un segnalibro, che puoi rinominare come vuoi.",
    en: "Press and hold the green button (this one or the one at the top, next to the tool's name) and drop it on your bookmarks bar: it becomes a bookmark you can rename as you like.",
  },
  r2ImpStep2Tip: {
    it: "La barra dei preferiti non si vede? Mostrala con Ctrl+Maiusc+B (Cmd+Maiusc+B su Mac).",
    en: "Can't see the bookmarks bar? Show it with Ctrl+Shift+B (Cmd+Shift+B on Mac).",
  },
  r2ImpDragTitle: { it: "Trascinami nella barra dei preferiti", en: "Drag me to the bookmarks bar" },
  r2ImpStep3: { it: "Nel gioco, clicca il segnalibro", en: "In the game, click the bookmark" },
  r2ImpStep3Body: {
    it: "Con Forge of Empires aperto e l'estensione attiva, clicca il segnalibro: copia in silenzio i dati negli appunti del computer. Se qualcosa non va, compare un messaggio.",
    en: "With Forge of Empires open and the extension active, click the bookmark: it silently copies the data to your computer's clipboard. If something goes wrong, a message appears.",
  },
  r2ImpStep4: { it: "Torna qui e clicca la bacchetta", en: "Come back here and click the wand" },
  r2ImpStep4Body: {
    it: "FoE Optimizer legge gli appunti e importa la città. La prima volta il browser può chiederti il permesso di leggere gli appunti: concedilo.",
    en: "FoE Optimizer reads the clipboard and imports the city. The first time, your browser may ask for permission to read the clipboard: allow it.",
  },
  r2ImpUpdateTitle: { it: "Per aggiornare:", en: "To update:" },
  r2ImpUpdateBody: {
    it: "ripeti i passi 3 e 4. La città viene riconosciuta dall'id del giocatore e aggiornata, senza crearne una copia.",
    en: "repeat steps 3 and 4. The city is recognised by the player id and updated, without creating a copy.",
  },
  r2ImpVideo: { it: "Video tutorial", en: "Video tutorial" },
  r2ImpVideoNote: {
    it: "Il video mostra l'interfaccia della versione 1: i passi sono gli stessi.",
    en: "The video shows the version 1 interface: the steps are the same.",
  },
  r2ImpWhat: { it: "Cosa viene importato", en: "What gets imported" },
  r2ImpWhatMine: { it: "La tua città:", en: "Your city:" },
  r2ImpWhatMineBody: {
    it: "mappa ed edifici, inventario, alleati e magazzino.",
    en: "map and buildings, inventory, allies and storage.",
  },
  r2ImpWhatVisited: { it: "La città di un altro giocatore:", en: "Another player's city:" },
  r2ImpWhatVisitedBody: {
    it: "clicca il segnalibro mentre la visiti; entra come città visitata (solo la mappa: il gioco non mostra inventario e alleati degli altri).",
    en: "click the bookmark while visiting it; it is added as a visited city (map only: the game doesn't show other players' inventory and allies).",
  },
  r2ImpWhatPirates: { it: "L'Insediamento dei Pirati:", en: "The Pirate Settlement:" },
  r2ImpWhatPiratesBody: {
    it: "se l'hai aperto nella sessione di gioco, arriva insieme alla città e lo trovi nella scheda Insediamenti.",
    en: "if you opened it during the game session, it comes along with the city and you'll find it in the Settlements tab.",
  },
  r2ImpOther: { it: "Altri modi", en: "Other ways" },
  r2ImpOtherJson: { it: "Da un file JSON:", en: "From a JSON file:" },
  r2ImpOtherJsonBody: {
    it: "Opzioni › Importa da JSON (o dal selettore delle città) legge l'export di FoE Optimizer o il piano di Forge Hammer.",
    en: "Options › Import from JSON (or the city selector) reads a FoE Optimizer export or a Forge Hammer plan.",
  },
  r2ImpOtherBackup: { it: "Backup:", en: "Backup:" },
  r2ImpOtherBackupBody: {
    it: "Opzioni › Esporta tutto salva tutte le città in un file; Ripristina le riporta qui, anche su un altro computer.",
    en: "Options › Export all saves every city to a file; Restore brings them back, even on another computer.",
  },
  r2ImpPrivacy: {
    it: "Il segnalibro copia solo i dati che l'estensione mette a disposizione, e solo negli appunti del tuo computer: non viene inviato nulla a nessun server.",
    en: "The bookmark copies only the data the extension provides, and only to your computer's clipboard: nothing is sent to any server.",
  },
  r2About: { it: "Informazioni", en: "About" },
  r2WhatsNew: { it: "Novità", en: "What's new" },
  r2WhatsNewIntro: {
    it: "Le novità di FoE Optimizer, dalla più recente.",
    en: "What's new in FoE Optimizer, latest first.",
  },
  r2WhatsNewLatest: { it: "ultima", en: "latest" },
  r2InfoProject: { it: "Il progetto", en: "The project" },
  r2InfoAmateur: {
    it: "FoE Optimizer è un progetto amatoriale e gratuito, nato e sviluppato nel tempo libero da un giocatore di Forge of Empires per gli altri giocatori.",
    en: "FoE Optimizer is a free hobby project, built in spare time by a Forge of Empires player for other players.",
  },
  r2InfoNotAffiliated: {
    it: "Non è affiliato, sponsorizzato né approvato da InnoGames GmbH. Forge of Empires, i suoi nomi, le immagini e i marchi appartengono a InnoGames GmbH.",
    en: "It is not affiliated with, sponsored or endorsed by InnoGames GmbH. Forge of Empires, its names, images and trademarks belong to InnoGames GmbH.",
  },
  r2InfoLocal: {
    it: "Funziona interamente nel tuo browser: non c'è nessun server che riceva i tuoi dati, e le città importate restano salvate solo sul tuo computer.",
    en: "It runs entirely in your browser: no server receives your data, and imported cities are saved only on your computer.",
  },
  r2InfoData: {
    it: "I dati del gioco vengono aggiornati con regolarità, ma possono contenere errori: segnalazioni e suggerimenti sono sempre benvenuti.",
    en: "Game data is updated regularly but may contain mistakes: reports and suggestions are always welcome.",
  },
  r2InfoContacts: { it: "Contatti", en: "Contact" },
  r2InfoEmailNote: { it: "Segnalazioni, idee, domande", en: "Bug reports, ideas, questions" },
  r2InfoSourcePrivacy: { it: "Codice sorgente e privacy", en: "Source code and privacy" },
  r2InfoSourceNote: { it: "Codice sorgente pubblico su GitHub", en: "Public source code on GitHub" },
  r2InfoSourceV2: { it: "Codice della versione 2.0", en: "Version 2.0 source code" },
  r2InfoPrivacyNote: { it: "Quali dati usa il tool e come", en: "Which data the tool uses and how" },
  r2Search: { it: "Cerca…", en: "Search…" },
  r2SearchHelp: {
    it: "Come cercare:\n• Per nome: scrivi una parte del nome (maiuscole e minuscole sono uguali), es. \"boutique\".\n• Per id: metti \"\\\" davanti, es. \"\\W_MultiAge_SUM24\".\n• Più ricerche insieme: separale con la virgola, es. \"boutique, provviste\" mostra gli edifici che contengono l'una o l'altra.\n  Vale anche per gli id: \"\\W_A, W_B\".",
    en: "How to search:\n• By name: type part of the name (case doesn't matter), e.g. \"boutique\".\n• By id: put \"\\\" in front, e.g. \"\\W_MultiAge_SUM24\".\n• Several searches at once: separate them with a comma, e.g. \"boutique, supplies\" shows the buildings matching either.\n  Works for ids too: \"\\W_A, W_B\".",
  },
  r2SearchHelpAllies: {
    it: "Come cercare:\n• Scrivi una parte del nome dell'alleato (maiuscole e minuscole sono uguali).\n• Più ricerche insieme: separale con la virgola, es. \"falco, regina\" mostra gli alleati che contengono l'una o l'altra.",
    en: "How to search:\n• Type part of the ally's name (case doesn't matter).\n• Several searches at once: separate them with a comma, e.g. \"falcon, queen\" shows the allies matching either.",
  },
  // Nastro Database (2.0): Filtri, Visualizza; Opzioni: Pesi statistiche
  r2GrpFilters: { it: "Filtri", en: "Filters" },
  r2GrpView: { it: "Visualizza", en: "View" },
  r2GrpViewRarity: { it: "Visualizza rarità", en: "Show rarity" },
  r2GrpWeights: { it: "Pesi statistiche", en: "Stat weights" },
  r2CatSettlements: { it: "Premi insediamenti", en: "Settlement prizes" },
  r2CatGbg: { it: "Premi dei campi", en: "GBG prizes" },
  r2CatQi: { it: "Premi delle IQ", en: "QI prizes" },
  r2CatFragments: { it: "Producono frammenti", en: "Produce fragments" },
  r2AllEvents: { it: "Tutti gli eventi", en: "All events" },
  r2Production: { it: "Produzione", en: "Production" },
  r2ProdFilterTitle: {
    it: "Mostra solo gli edifici che producono le risorse scelte",
    en: "Show only buildings producing the chosen resources",
  },
  r2ProdModeTitle: {
    it: "Almeno una delle risorse scelte, oppure tutte",
    en: "At least one of the chosen resources, or all of them",
  },
  r2ProdOr: { it: "Almeno una", en: "Any" },
  r2ProdAnd: { it: "Tutte", en: "All" },
  r2ProdNone: { it: "Nessuna", en: "None" },
  r2EffMin: { it: "Eff. min", en: "Min eff." },
  r2Reset: { it: "Azzera", en: "Reset" },
  r2NonRush: { it: "Non accelerabili", en: "Not rushable" },
  r2NonRushTitle: {
    it: "Mostra gli edifici che non si possono accelerare (🚫)",
    en: "Show buildings that cannot be rushed (🚫)",
  },
  r2AutoAge: { it: "Auto aggiornabili", en: "Self-upgrading" },
  r2AutoAgeTitle: {
    it: "Mostra gli edifici che passano da soli all'era successiva (^)",
    en: "Show buildings that move up to the next era on their own (^)",
  },
  r2Limited: { it: "Limitati / Ascesi", en: "Limited / Ascended" },
  r2LimitedTitle: {
    it: "Mostra gli edifici a tempo e la colonna ⏱",
    en: "Show limited buildings and the ⏱ column",
  },
  r2ProdDetail: { it: "Produzioni", en: "Productions" },
  r2ProdDetailTitle: { it: "Mostra le colonne delle produzioni", en: "Show the production columns" },
  r2Sums: { it: "Somma %", en: "Sum %" },
  r2Export: { it: "Export", en: "Export" },
  r2SumsTitle: {
    it: "Mostra le colonne con la somma delle statistiche (Generale + Campi, e Generale + Spedizioni)",
    en: "Show the columns with the summed stats (General + GBG, and General + Expeditions)",
  },
  r2IqProd: { it: "IQ mon/mat", en: "QI coins/supp." },
  r2Pop: { it: "Popolazione", en: "Population" },
  r2Fel: { it: "Felicità", en: "Happiness" },
  // Pesi statistiche (2.0, solo testo)
  r2WDefIs: { it: "Difesa vale", en: "Defense is" },
  r2WOfAtk: { it: "dell'attacco", en: "of attack" },
  r2WIncludeGe: { it: "Conta anche le spedizioni", en: "Include expeditions" },
  r2WSplit: { it: "Campi / Sped.", en: "GBG / GE" },
  r2HowItWorks: { it: "Come si calcola", en: "How it works" },
  // Nastro Città (2.0)
  r2GrpStats: { it: "Statistiche", en: "Statistics" },
  r2GrpHide: { it: "Nascondi", en: "Hide" },
  r2GrpHideShow: { it: "Nascondi / Mostra solo", en: "Hide / Show only" },
  r2TriAll: { it: "tutti (clic: nascondi)", en: "all (click: hide)" },
  r2TriHidden: { it: "nascosti (clic: mostra solo questi)", en: "hidden (click: show only these)" },
  r2TriOnly: { it: "solo questi (clic: tutti)", en: "only these (click: all)" },
  r2PlusInv: { it: "+ Inventario", en: "+ Inventory" },
  r2Upgradable: { it: "Aggiornabili", en: "Upgradable" },
  r2Sped: { it: "Spedizioni", en: "Expeditions" },
  r2SpedTitle: { it: "Mostra o nasconde le colonne Spedizioni nella tabella", en: "Shows or hides the Expeditions columns in the table" },
  r2SpedNotWeighted: {
    it: "⚠️ Le spedizioni non contano nell'efficienza: attivale in Opzioni › Pesi statistiche",
    en: "⚠️ Expeditions don't count towards efficiency: enable them in Options › Stat weights",
  },
  r2UpgradableTitle: {
    it: "Edifici della città che puoi aggiornare con i kit e i frammenti che hai",
    en: "City buildings you can upgrade with the kits and fragments you own",
  },
  r2StatRoads: { it: "Efficienza strade", en: "Road efficiency" },
  r2StatProd: { it: "Produzione", en: "Production" },
  r2StatMil: { it: "Valori militari", en: "Military values" },
  r2StatEra: { it: "Cambio era", en: "Era change" },
  r2HideIq: { it: "Utili per IQ", en: "QI useful" },
  r2HideIqTitle: { it: "Nascondi gli edifici utili per le IQ", en: "Hide buildings useful for QI" },
  r2HideAlly: { it: "Slot alleato", en: "Ally slot" },
  r2HideAid: { it: "Fr. auto-aiuto", en: "Mass aid fr." },
  r2HideStore: { it: "Fr. immagazzina", en: "Store bld. fr." },
  r2Debug: { it: "Debug", en: "Debug" },
  r2ExportCityJson: { it: "Esporta JSON città", en: "Export city JSON" },
  r2ExportCityJsonTitle: {
    it: "Scarica la città in JSON, come il pulsante JSON della Mappa",
    en: "Downloads the city as JSON, like the Map's JSON button",
  },
  r2Outdated: { it: "Edifici vecchi", en: "Outdated" },
  r2Declassable: { it: "Declassabili", en: "Downgradable" },
  r2ReadyOnly: { it: "Solo pronti", en: "Ready only" },
  // Alleati (2.0)
  r2AllyTypeMil: { it: "Militari", en: "Military" },
  r2AllyTypeSci: { it: "Scienza", en: "Science" },
  // Nastro Insediamenti (2.0)
  r2GrpSettlement: { it: "Insediamento", en: "Settlement" },
  r2Pirates: { it: "Pirati", en: "Pirates" },
  r2GrpCalc: { it: "Calcolo", en: "Calculation" },
  r2GrpExpansions: { it: "Espansioni", en: "Expansions" },
  r2PiSolve: { it: "Risolvi", en: "Solve" },
  r2PiStop: { it: "Stop", en: "Stop" },
  r2PiAuto: { it: "Auto", en: "Auto" },
  r2PiUndo: { it: "Annulla", en: "Undo" },
  r2PiReset: { it: "Reset", en: "Reset" },
  r2PiAddExp: { it: "Aggiungi", en: "Add" },
  r2PiRemoveExp: { it: "Rimuovi", en: "Remove" },
  // Nastro Planner (2.0)
  r2GrpCurrentStats: { it: "Statistiche attuali", en: "Current stats" },
  r2StWithRoad: { it: "Con strada", en: "With road" },
  r2StNoRoad: { it: "Senza strada", en: "Without road" },
  r2StRoads: { it: "Strade (caselle)", en: "Roads (tiles)" },
  r2StChains: { it: "A catena", en: "Chain" },
  r2StSets: { it: "Set", en: "Sets" },
  r2PlMilitaryRoad: { it: "Edifici militari da collegare a strada:", en: "Military buildings to connect to a road:" },
  r2GrpLayout: { it: "Disposizione", en: "Layout" },
  r2GrpCpu: { it: "Processore", en: "Processor" },
  r2GrpHelp: { it: "Aiuto", en: "Help" },
  r2PlOptimize: { it: "Ottimizza", en: "Optimize" },
  r2PlPause: { it: "Pausa", en: "Pause" },
  r2PlSmooth: { it: "Smussa", en: "Smooth" },
  r2PlComplete: { it: "Completa", en: "Complete" },
  r2PlUndoComplete: { it: "Annulla completamento", en: "Undo completion" },
  r2PlUndoManual: { it: "Annulla modifiche", en: "Undo edits" },
  r2PlReset: { it: "Reset", en: "Reset" },
  r2PlEditCity: { it: "Modifica", en: "Edit" },
  r2PlVideo: { it: "Video tutorial", en: "Video tutorial" },
  r2ImportCityJson: { it: "Importa da JSON", en: "Import from JSON" },
  r2ImportCityJsonTitle: {
    it: "Aggiunge una città da un file JSON (Esporta JSON città, Planner, Forge Hammer). Città ridotta: mappa e Grandi Edifici completi, statistiche degli edifici dal catalogo, niente inventario né alleati",
    en: "Adds a city from a JSON file (Export city JSON, Planner, Forge Hammer). Reduced city: full map and Great Buildings, building stats from the catalogue, no inventory or allies",
  },
  r2PlJsonClose: { it: "Chiudi il JSON importato", en: "Close the imported JSON" },
  r2PlJsonTitle: {
    it: "Carica la città da un file JSON (esportato da MAPPA o mandato da un altro giocatore). Non viene salvata.",
    en: "Load the city from a JSON file (exported from MAP or sent by another player). It is not saved.",
  },
  r2PlNoSource: {
    it: "Scegli la città da ottimizzare: importa una città con la bacchetta oppure carica un file JSON con \"Importa JSON\".",
    en: "Choose the city to optimize: import a city with the magic wand or load a JSON file with \"Import JSON\".",
  },
  r2AllyFragments: { it: "Frammenti", en: "Fragments" },
  r2AllyFragmentsTitle: { it: "Mostra gli alleati di cui hai solo frammenti", en: "Show allies you only have fragments of" },
  r2Level100: { it: "Livello 100", en: "Level 100" },
  r2Level100Title: {
    it: "Statistiche dei tuoi alleati come se fossero portati a livello 100",
    en: "Stats of your allies as if they were raised to level 100",
  },
  r2AllyMilTitle: { it: "Mostra gli alleati militari", en: "Show military allies" },
  r2AllySciTitle: { it: "Mostra gli alleati scienza", en: "Show science allies" },
  r2GrpTableOptions: { it: "Opzioni", en: "Options" },
  r2GrpAnalysis: { it: "Analisi", en: "Analysis" },
  r2Advisor: { it: "Potenziale e gettoni", en: "Potential & tokens" },
  r2AdvisorTitle: {
    it: "Quali alleati far crescere e quali vendere, con pergamene e gettoni valore che hai",
    en: "Which allies to grow and which to sell, with the scrolls and value tokens you have",
  },
  r2AdvisorNeedWand: {
    it: "Serve un import con la bacchetta aggiornata (magazzino risorse)",
    en: "Needs an import with the updated magic wand (resource stock)",
  },
  r2NoCity: { it: "Nessuna città", en: "No city" },
  r2NeedCity: { it: "Importa prima una città", en: "Import a city first" },
  r2VersionTitle: { it: "Versione di FoE Optimizer", en: "FoE Optimizer version" },
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
  tabPirates: {
    it: "Pirati",
    en: "Pirates",
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
    it: "Sei sicuro di voler eliminare TUTTE le città salvate (anche quelle importate da JSON) e il JSON caricato nel Planner?",
    en: "Are you sure you want to delete ALL saved cities (including those imported from JSON) and the JSON loaded in the Planner?",
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
    it: "Ripartizione del peso tra Campi di battaglia e Spedizioni",
    en: "Weight split between Guild Battlegrounds and Expeditions",
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
  hideNoRushLabel: {
    it: "Nascondi",
    en: "Hide",
  },
  hideNoRushTitle: {
    it: "Nascondi tutti gli edifici NoRush",
    en: "Hide all NoRush buildings",
  },
  hideNoRushActiveTitle: {
    it: "Mostra di nuovo gli edifici NoRush",
    en: "Show NoRush buildings again",
  },
  hideEraMutableLabel: {
    it: "Nascondi",
    en: "Hide",
  },
  hideEraMutableTitle: {
    it: "Nascondi tutti gli edifici che si aggiornano automaticamente",
    en: "Hide all auto-aging buildings",
  },
  hideEraMutableActiveTitle: {
    it: "Mostra di nuovo gli edifici che si aggiornano automaticamente",
    en: "Show auto-aging buildings again",
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
  prodMedals: {
    it: "Medaglie",
    en: "Medals",
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
  prodGoodsSpecial: {
    it: "Beni Speciali",
    en: "Special Goods",
  },
  prodGoodsSpecialBoost: {
    it: "Beni Speciali Boost",
    en: "Special Goods Boost",
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
    it: "Frammenti di Termina produzione speciale",
    en: "Fragments of Finish Special Production",
  },
  prodRushMaterials: {
    it: "Frammenti di Termina tutte le produzioni di materiali",
    en: "Fragments of Finish All Supply Productions",
  },
  prodRushGoods: {
    it: "Frammenti di Termina produzione di beni",
    en: "Fragments of Finish Goods Production",
  },
  prodMassAid: {
    it: "Frammenti di Kit auto-aiuto di massa",
    en: "Fragments of Mass Self-Aid Kit",
  },
  prodOneUpKit: {
    it: "Frammenti di Kit modernizzatore",
    en: "Fragments of One Up Kit",
  },
  prodOneDownKit: {
    it: "Kit Invecchiatore",
    en: "One Down Kit",
  },
  prodReversionKit: {
    it: "Kit di Inversione",
    en: "Reversion Kit",
  },
  prodRenovationKit: {
    it: "Frammenti di Kit rinnovamento",
    en: "Fragments of Renovation Kit",
  },
  prodStoreBuilding: {
    it: "Frammenti di Immagazzina edificio",
    en: "Fragments of Store Building",
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
    it: "Truppe IQ iniziali aggiuntive",
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
  /** Tooltip del badge slot alleato (⭐ militare / 🔬 scienza, vedi App.tsx
   *  getAllySlotIcon). "military"/"science" è il valore grezzo di
   *  allyType (M/S -> nome esteso), non serve una label pre-risolta: la
   *  frase è la stessa per le due lingue, cambia solo il tipo interpolato. */
  historicalAllySlotTitleMilitary: {
    it: "L'edificio può ospitare un Alleato Storico (militare)",
    en: "The building can host a Historical Ally (military)",
  },
  historicalAllySlotTitleScience: {
    it: "L'edificio può ospitare un Alleato Storico (scienza)",
    en: "The building can host a Historical Ally (science)",
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
  colAlly: {
    it: "Alleato",
    en: "Ally",
  },

  // ── Barra "Calcola efficienza a livello" (tab Alleati) ────────────────
  calcEfficiencyAtLevel: {
    it: "Efficienza calcolata a livello 100",
    en: "Efficiency calculated at level 100",
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
  debugUnmatchedBuildingsTitle: {
    it: "Edifici sconosciuti: non sono né nel catalogo né tra gli edifici fuori catalogo (di solito edifici appena usciti, non ancora aggiunti)",
    en: "Unknown buildings: neither in the catalog nor among the off-catalog buildings (usually brand-new buildings not added yet)",
  },
  debugExtraBuildings: {
    it: "Fuori catalogo",
    en: "Off catalog",
  },
  debugExtraBuildingsTitle: {
    it: "Edifici riconosciuti ma non presenti nel catalogo degli edifici (militari, fabbriche di beni, alcuni premi come la Tana dei furfanti): il tool ne conosce dimensioni e strada, non le statistiche",
    en: "Buildings recognised but not in the building catalog (military, goods factories, some prizes like the Rogue Den): the tool knows their size and road, not their stats",
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
  // Prima il testo consigliava "Prova l'export SVG": il pulsante SVG è stato
  // rimosso l'11 agosto 2026 (restano PNG e JSON). Il caso "profilo senza aree
  // sbloccate salvate", che si risolve solo reimportando, ha un messaggio suo.
  exportPngFailedAlert: {
    it: "Impossibile esportare la mappa in PNG (dettagli nella console del browser).",
    en: "Unable to export the map as PNG (details in the browser console).",
  },
  exportPngNeedsReimportAlert: {
    it: "Per esportare la mappa in PNG reimporta la città con la bacchetta magica: questo profilo è stato salvato prima che il tool memorizzasse le espansioni sbloccate.",
    en: "To export the map as PNG, re-import your city with the magic wand: this profile was saved before the tool stored the unlocked expansions.",
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
  legendRoadRequired: {
    it: "Richiede strada",
    en: "Requires road",
  },
  legendRoad2Required: {
    it: "Richiede strada a 2 corsie",
    en: "Requires 2-lane road",
  },
  legendNoRoadRequired: {
    it: "Non richiede strada",
    en: "Doesn't require road",
  },
  legendNeedlesslyConnected: {
    it: "Connessi inutilmente",
    en: "Needlessly connected",
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
  showOnlyOldBuildingsTitle: {
    it: "Mostra solo edifici di ere precedenti",
    en: "Show only buildings from previous ages",
  },
  outdatedSummaryTitle: {
    it: "SE AGGIORNI TUTTI GLI EDIFICI VECCHI",
    en: "IF YOU UPGRADE ALL OLD BUILDINGS",
  },
  outdatedSummaryFallbackTitle: {
    it: "SE AGGIORNI TUTTI GLI EDIFICI IN CITTÀ",
    en: "IF YOU UPGRADE ALL BUILDINGS IN YOUR CITY",
  },
  outdatedSummaryCount: {
    it: (copies: number) => `(${copies} IN TOTALE)`,
    en: (copies: number) => `(${copies} IN TOTAL)`,
  },
  outdatedSummaryToCurrentEra: {
    it: "ALL'ERA CORRENTE:",
    en: "TO THE CURRENT AGE:",
  },
  outdatedSummaryToMaxEra: {
    it: "ALL'ERA MASSIMA:",
    en: "TO THE LATEST AGE:",
  },
  outdatedSummaryButtonTitle: {
    it: "Riepilogo: cosa cambia aggiornando tutti gli edifici vecchi (era attuale ed era massima)",
    en: "Summary: what changes if you upgrade all old buildings (current age and latest age)",
  },
  outdatedSummaryEmpty: {
    it: "Tutti gli edifici della città sono già aggiornati all'era corrente.",
    en: "All buildings in the city are already up to date with the current age.",
  },
  outdatedSummaryAlreadyAtMax: {
    it: "Sei già all'ultima era gestita: nessun confronto aggiuntivo.",
    en: "You're already at the latest supported age: no extra comparison.",
  },
  outdatedSummaryUnchangedTitle: {
    it: "Statistiche invariate",
    en: "Unchanged stats",
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
  /** Tooltip del badge 🔒 (noRush(b), derivato da b.flags): testo ufficiale
   *  mostrato dal gioco stesso sull'edificio ("Instant production finish
   *  disabled"), non una parafrasi nostra. */
  noRushBadgeTitle: {
    it: "Completa istantaneamente produzione disabilitato",
    en: "Instant production finish disabled",
  },
  /** Tooltip del badge ciano (isEraMutable(b), derivato da b.flags bit 2):
   *  l'edificio si aggiorna automaticamente all'era corrente della città,
   *  senza bisogno di un kit di aggiornamento manuale. */
  eraMutableBadgeTitle: {
    it: "Si aggiorna automaticamente alla tua era",
    en: "Automatically upgrades to your age",
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
  // Solo edifici: il campo min EFF esiste nella tabella edifici (tab Info, Città,
  // Inventario), non nelle tabelle Alleati (prima il testo diceva "edifici o alleati").
  effHelpStep3Body: {
    it: "Nell'header della colonna EFF della tabella edifici (tab Info, Città, Inventario) puoi inserire una soglia minima (min EFF): scrivendo, ad esempio, 80, vedrai solo gli edifici con efficienza superiore a 80, calcolata con i pesi attuali.",
    en: "In the EFF column header of the buildings table (Info, City, Inventory tabs) you can enter a minimum threshold (min EFF): by typing, for example, 80, you'll only see buildings with an efficiency above 80, based on the current weights.",
  },
  gotItButton: {
    it: "Ho capito",
    en: "Got it",
  },

  // ── Modale "Profili e Bacchetta Magica" ───────────────────────────────

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
  diffMedals: {
    it: "Medaglie",
    en: "Medals",
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
  diffGoodsSpecial: {
    it: "Beni Speciali",
    en: "Special Goods",
  },
  diffGoodsSpecialBoost: {
    it: "Beni Speciali Boost",
    en: "Special Goods Boost",
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
    it: "Dati non validi: per importare la città consulta la Guida alla Bacchetta magica.",
    en: "Invalid data: to import your city, see the Magic Wand Guide.",
  },
  clipboardNotJsonScript: {
    it: "Dati non validi: negli appunti c'è il codice del bookmarklet, non i dati della città. Il bookmarklet va CLICCATO dalla barra dei preferiti mentre sei nel gioco, non copiato. Se lo hai creato incollando il codice a mano, ricrealo trascinando nei preferiti la bacchetta verde in alto a sinistra.",
    en: "Invalid data: the clipboard contains the bookmarklet code, not the city data. The bookmarklet must be CLICKED from the bookmarks bar while you are in the game, not copied. If you created it by pasting the code by hand, recreate it by dragging the green magic wand (top left) to your bookmarks bar.",
  },
  clipboardNotJsonTruncated: {
    it: (n: number) => `Dati non validi: negli appunti ci sono i dati del bookmarklet, ma incompleti o rovinati (${n.toLocaleString("it-IT")} caratteri). Chiudi il browser, riapri sia il gioco sia il tool e importa di nuovo la città (bookmarklet nel gioco, poi subito la bacchetta magica).`,
    en: (n: number) => `Invalid data: the clipboard contains the bookmarklet data, but incomplete or damaged (${n.toLocaleString("en-US")} characters). Close the browser, reopen both the game and the tool and import the city again (bookmarklet in the game, then the magic wand right away).`,
  },
  clipboardNotJsonUrl: {
    it: "Dati non validi: negli appunti c'è un indirizzo web, non i dati della città: il bookmarklet non ha copiato niente. Vai sulla pagina del gioco (con FoE Helper o Forge Hammer attivo), clicca il bookmarklet dalla barra dei preferiti e poi subito la bacchetta magica.",
    en: "Invalid data: the clipboard contains a web address, not the city data: the bookmarklet did not copy anything. Go to the game page (with FoE Helper or Forge Hammer active), click the bookmarklet from the bookmarks bar and then the magic wand right away.",
  },
  clipboardNotJsonOther: {
    it: (n: number) => `Dati non validi: negli appunti c'è un altro testo (${n.toLocaleString("it-IT")} caratteri), non i dati di gioco. Per importare la città consulta la Guida alla Bacchetta magica.`,
    en: (n: number) => `Invalid data: the clipboard contains some other text (${n.toLocaleString("en-US")} characters), not the game data. To import your city, see the Magic Wand Guide.`,
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
  // ── Consigliere Gettoni Valore (tab Alleati, bacchetta v6) ──────────────
  allyMatrixSortTitle: { it: (r: string) => `Ordina per EFF ${r}`, en: (r: string) => `Sort by ${r} EFF` },
  allyMatrixOwnedTitle: {
    it: (r: string, n: number, u: number) => `${r}: possiedi ${n} ${n === 1 ? "copia" : "copie"}${u > 0 ? ` (${u} non posizionat${u === 1 ? "a" : "e"})` : ""}`,
    en: (r: string, n: number, u: number) => `${r}: you own ${n} ${n === 1 ? "copy" : "copies"}${u > 0 ? ` (${u} not placed)` : ""}`,
  },
  allyAdvisorTitle: { it: "Potenziale alleati e Gettoni Valore", en: "Ally potential and Valor Tokens" },
  allyAdvisorLegend: {
    it: "Celle: EFF al livello 100 per rarità, dal rosso (più bassa) al verde (più alta) su tutta la matrice. Riquadro bianco = rarità posseduta. Badge #n = posizione nella coda dei Gettoni Valore, sulla rarità di arrivo (verde = lo puoi già pagare con i gettoni posseduti). Bordo tratteggiato = rarità saltata da un'evoluzione multipla. Clicca sul nome per il dettaglio dei boost.",
    en: "Cells: level-100 EFF per rarity, from red (lowest) to green (highest) across the matrix. White frame = owned rarity. Badge #n = position in the Valor Token queue, on the target rarity (green = you can already afford it with your tokens). Dashed border = rarity skipped by a multi-step evolution. Click a name for the boost details.",
  },
  allyAdvisorStepTitle: {
    it: (rank: number, from: string, to: string, cost: string, gain: string, ratio: string) => `#${rank}: ${from} → ${to} — ${cost} gettoni, EFF +${gain}, ${ratio} EFF/gettone`,
    en: (rank: number, from: string, to: string, cost: string, gain: string, ratio: string) => `#${rank}: ${from} → ${to} — ${cost} tokens, EFF +${gain}, ${ratio} EFF/token`,
  },
  allyAdvisorBestNow: {
    it: (rank: number, name: string, cost: string) => `Con i gettoni attuali il passo migliore è il #${rank}, ${name} (${cost} gettoni); i badge verdi sono quelli che puoi già pagare.`,
    en: (rank: number, name: string, cost: string) => `With your current tokens the best step is #${rank}, ${name} (${cost} tokens); green badges are the ones you can already afford.`,
  },
  allyAdvisorColNext: { it: "Prossima evoluzione", en: "Next evolution" },
  allyAdvisorSortPriorityTitle: { it: "Ordina per priorità nella coda dei Gettoni Valore", en: "Sort by priority in the Valor Token queue" },
  allyAdvisorExpandTitle: { it: "Mostra/nascondi il dettaglio delle evoluzioni e dei boost", en: "Show/hide evolution and boost details" },
  allyAdvisorTokensShort: { it: "gettoni", en: "tokens" },
  allyAdvisorNoNext: { it: "— nessuna evoluzione utile", en: "— no useful evolution" },
  allyAdvisorValorOwned: { it: "Gettoni Valore posseduti", en: "Valor Tokens owned" },
  allyAdvisorIntro: {
    it: (maxR: string) => `Ogni alleato militare posseduto è valutato al livello 100 (prima o poi verrà maxato), fino alla rarità ${maxR}: slot e Pergamene Eroiche non sono considerati vincoli, solo i Gettoni Valore. Le copie identiche (stesso alleato e rarità) sono una sola riga. L'efficienza usa gli stessi pesi della colonna EFF.`,
    en: (maxR: string) => `Every owned military ally is evaluated at level 100 (it will be maxed sooner or later), up to ${maxR} rarity: slots and Heroic Scrolls are not treated as constraints, only Valor Tokens. Identical copies (same ally and rarity) are a single row. Efficiency uses the same weights as the EFF column.`,
  },
  allyAdvisorQueueNext: {
    it: (name: string, missing: string) => `Prossimo obiettivo: ${name} (mancano ${missing} gettoni).`,
    en: (name: string, missing: string) => `Next target: ${name} (${missing} tokens missing).`,
  },
  allyAdvisorQueueAllAffordable: { it: "Hai gettoni sufficienti per tutta la coda.", en: "You have enough tokens for the whole queue." },
  allyAdvisorColAlly: { it: "Alleato", en: "Ally" },
  allyAdvisorColStep: { it: "Evoluzione", en: "Evolution" },
  allyAdvisorColTokens: { it: "Gettoni", en: "Tokens" },
  allyAdvisorColGain: { it: "EFF +", en: "EFF +" },
  allyAdvisorColRatio: { it: "EFF/gettone", en: "EFF/token" },
  allyAdvisorDeltaNote: { it: "Δ boost al livello 100 dopo l'evoluzione", en: "Δ boosts at level 100 after evolving" },
  allyAdvisorMultiStep: {
    it: (n: number) => `(${n} evoluzioni insieme: il passo intermedio da solo rende meno)`,
    en: (n: number) => `(${n} evolutions together: the intermediate step alone returns less)`,
  },
  allyAdvisorScienceTitle: { it: "Non valutati (alleati scienza)", en: "Not evaluated (science allies)" },
  allyAdvisorScienceNote: {
    it: "Il tool valuta solo le statistiche militari: per questi alleati solo dati di fatto, nessun consiglio.",
    en: "The tool only evaluates military stats: for these allies, facts only, no advice.",
  },
  allyAdvisorScienceFacts: {
    it: (pf: string, beni: string, beniP: string) => `al livello 100: ${pf} PF, ${beni} beni, ${beniP} beni era precedente.`,
    en: (pf: string, beni: string, beniP: string) => `at level 100: ${pf} FP, ${beni} goods, ${beniP} previous-age goods.`,
  },
  allyAdvisorFootnote: {
    it: (n: number) => `${n} alleati militari distinti valutati. Esclusi gli alleati frammentati (non ancora completi). La scelta di vendere un alleato è lasciata a te.`,
    en: (n: number) => `${n} distinct military allies evaluated. Fragmented allies (not yet complete) are excluded. Whether to sell an ally is up to you.`,
  },
  // v5: l'import è riuscito ma lo script non ha trovato alcune sezioni nell'helper.
  bookmarkletWarningsAlert: {
    it: (sections: string, helper: string) => `Importazione completata, ma l'helper (${helper}) non ha fornito alcune sezioni: ${sections}.\n\nPotrebbe essere cambiata la sua struttura dopo un aggiornamento: i dati importati sono incompleti. Segnalalo allo sviluppatore indicando helper e versione.`,
    en: (sections: string, helper: string) => `Import completed, but the helper (${helper}) did not provide some sections: ${sections}.\n\nIts structure may have changed after an update: the imported data is incomplete. Please report it to the developer, mentioning helper and version.`,
  },
  // ── Modale "Bacchetta magica obsoleta" (bookmarklet v1/v2 in uso) ─────
  bookmarkletOutdatedModalTitle: {
    it: "Bacchetta magica obsoleta",
    en: "Outdated magic wand",
  },
  bookmarkletOutdatedModalIntro: {
    it: "Import riuscito, ma hai usato una versione precedente della bacchetta magica: alcuni dati potrebbero mancare o non essere aggiornati.",
    en: "Import successful, but you used an older version of the magic wand: some data may be missing or outdated.",
  },
  bookmarkletOutdatedModalBody: {
    it: "La nuova bacchetta magica resiste agli aggiornamenti di FoE Helper e Forge Hammer (segnala se un helper non fornisce qualche dato), supporta entrambi e funziona anche sulle città di altri giocatori: basta visitare la loro città e cliccarla per importarla (senza inventario né alleati, che il gioco non mostra mai per un altro giocatore).",
    en: "The new magic wand copes with FoE Helper and Forge Hammer updates (it reports when a helper does not provide some data), supports both, and also works on other players' cities: just visit their city and click it to import it (without inventory or allies, which the game never shows for another player).",
  },
  bookmarkletOutdatedModalSteps: {
    it: "Per aggiornarla: elimina la vecchia bacchetta magica dalla barra dei preferiti, poi trascina di nuovo quella qui sopra per sostituirla.",
    en: "To update it: delete the old magic wand from your bookmarks bar, then drag the one above again to replace it.",
  },
  bookmarkletOutdatedModalButton: {
    it: "Ho capito",
    en: "Got it",
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
  // ── Guida › Informazioni (prima modale "Chi sono · Contatti") ─────────────────────────────────────────────────────
  aboutServerItLabel: {
    it: "Server Italiano",
    en: "Italian Server",
  },
  aboutServerBetaLabel: {
    it: "Server Beta",
    en: "Beta Server",
  },
  // Testi alternativi degli avatar nell'AboutModal (prima fissi in italiano,
  // con "--" al posto del trattino lungo).
  aboutAvatarItAlt: {
    it: "Sdrushi — server italiano",
    en: "Sdrushi — Italian server",
  },
  aboutAvatarBetaAlt: {
    it: "Sdrushi — server beta",
    en: "Sdrushi — beta server",
  },
  aboutWorldLabel: {
    it: "Mondo",
    en: "World",
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
  noCityImportedYet: {
    it: "Nessuna città importata. Usa la bacchetta magica in alto a sinistra",
    en: "No city imported yet. Use the magic wand in the top left",
  },
  noInventoryImportedYet: {
    it: "Nessun inventario importato. Usa la bacchetta magica in alto a sinistra",
    en: "No inventory imported yet. Use the magic wand in the top left",
  },
  noImportedYetSuffix: {
    it: "per importare i tuoi dati da Forge of Empires.",
    en: "to import your data from Forge of Empires.",
  },
  /** Import riuscito ma l'inventario di gioco è davvero vuoto (comune a inizio
   *  partita) — distinto da noInventoryImportedYet (mai importato). Nessun
   *  CTA verso la bacchetta magica: qui l'azione giusta non è re-importare. */
  inventoryEmpty: {
    it: "Il tuo inventario è vuoto.",
    en: "Your inventory is empty.",
  },
  noAlliesFound: {
    it: "Nessun alleato trovato con questa ricerca.",
    en: "No allies found for this search.",
  },
  fabChoiceLabel: {
    it: "Scelta:",
    en: "Choice:",
  },
  r2JsonCityTip: { it: "Città importata da JSON", en: "City imported from JSON" },
  r2AvatarJson: { it: "Città da file JSON: l'avatar non è salvato nel file", en: "City from a JSON file: the avatar is not stored in the file" },
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

  // ── Tab Pirati: toolbar (components/PiratiTool.tsx) ──────────────────
  piratiSolveLabel: { it: "Risolvi", en: "Solve" },
  piratiStopLabel: { it: "Stop", en: "Stop" },
  piratiAutoLabel: { it: "AUTO", en: "AUTO" },
  piratiAutoTitle: {
    it: "AUTO: quando aggiungi un edificio che non trova subito posto, prova a risolvere da sola; se non riesce, toglie quell'edificio.",
    en: "AUTO: when you add a building that doesn't immediately find a spot, it tries to solve automatically; if it still fails, it removes that building.",
  },
  piratiUndoLabel: { it: "Undo", en: "Undo" },
  piratiUndoTitle: {
    it: "Torna allo stato subito dopo l'ultimo import (o allo stato vuoto se non hai ancora importato)",
    en: "Revert to the state right after the last import (or the empty state if you haven't imported yet)",
  },
  piratiResetLabel: { it: "Reset", en: "Reset" },
  piratiResetTitle: {
    it: "Riporta tutto alla situazione di partenza, cancellando anche i dati importati",
    en: "Reset everything to the starting state, also discarding imported data",
  },
  piratiAddExpLabel: { it: "+ EXP", en: "+ EXP" },
  piratiRemoveExpLabel: { it: "− EXP", en: "− EXP" },
  piratiAddExpTitle: {
    it: "Sblocca una nuova espansione (area 4x4) dell'Insediamento",
    en: "Unlock a new expansion (4x4 area) of the Outpost",
  },
  piratiAddExpNoneTitle: {
    it: "Nessuna nuova espansione disponibile da sbloccare",
    en: "No new expansion available to unlock",
  },
  piratiRemoveExpTitle: {
    it: "Richiudi un'espansione (area 4x4) già sbloccata",
    en: "Close a previously unlocked expansion (4x4 area)",
  },
  piratiRemoveExpNoneTitle: {
    it: "Nessuna espansione richiudibile al momento",
    en: "No expansion can be closed right now",
  },
  piratiStepsLabel: { it: "Stati", en: "States" },
  piratiStepsCountLabel: {
    it: (n: number) => `${n.toLocaleString()} passi`,
    en: (n: number) => `${n.toLocaleString()} steps`,
  },
  piratiAreaLabel: { it: "Area", en: "Area" },
  piratiAreaOccupiedTitle: { it: "Area occupata", en: "Occupied area" },
  piratiAreaOccupiedWithObstaclesTitle: {
    it: (n: number) => `Area occupata (-${n} per ostacoli)`,
    en: (n: number) => `Occupied area (-${n} for obstacles)`,
  },
  piratiPopLabel: { it: "Pop", en: "Pop" },
  piratiPopOccupiedTitle: { it: "Popolazione occupata", en: "Occupied population" },
  piratiTimedOutMessage: {
    it: "Tempo massimo superato, nessuna soluzione trovata",
    en: "Maximum time exceeded, no solution found",
  },
  piratiInterruptedMessage: { it: "Ricerca interrotta", en: "Search interrupted" },
  piratiSolverCrashed: {
    it: "Errore imprevisto durante la ricerca: ripristinata l'ultima disposizione valida (dettagli nella console del browser)",
    en: "Unexpected error during the search: restored the last valid layout (details in the browser console)",
  },
  piratiRestoredLastSolutionMessage: {
    it: "Nessuna soluzione trovata: ripristinata l'ultima disposizione valida",
    en: "No solution found: restored the last valid layout",
  },
  piratiImportBlockedWhileSolving: {
    it: "Attendi la fine della ricerca (o premi Stop) prima di importare",
    en: "Wait for the search to finish (or press Stop) before importing",
  },
  piratiRestoredLastSolutionCutoffMessage: {
    it: "Nessuna soluzione trovata entro il limite di tentativi (potrebbe comunque esisterne una): ripristinata l'ultima disposizione valida",
    en: "No solution found within the attempt limit (one may still exist): restored the last valid layout",
  },
  piratiAreaExcessiveMessage: { it: "Area eccessiva", en: "Area exceeded" },
  piratiPopInsufficientMessage: { it: "Popolazione insufficiente", en: "Insufficient population" },

  // ── Tab Pirati: import (bacchetta magica, esiti runImport) ───────────
  piratiImportInvalidJson: {
    it: "JSON non valido: controlla di aver copiato tutto il testo dal bookmarklet.",
    en: "Invalid JSON: make sure you copied all the text from the bookmarklet.",
  },
  piratiImportInvalidStructure: {
    it: "Il JSON non ha la struttura attesa (servono i campi 'areas' e 'entities').",
    en: "The JSON doesn't have the expected structure (the 'areas' and 'entities' fields are required).",
  },
  piratiImportUnknownError: {
    it: "Errore sconosciuto durante l'import.",
    en: "Unknown error during import.",
  },
  piratiImportOutdatedBookmarklet: {
    it: "Stai usando una bacchetta magica vecchia. Cancellala dalla barra dei preferiti e ricreala.",
    en: "You're using an old magic wand bookmarklet. Delete it from your bookmarks bar and recreate it.",
  },
  piratiImportHelperUnsupported: {
    it: (helper: string) => `L'helper in uso (${helper}) non espone i dati dell'Insediamento dei Pirati: probabilmente la sua struttura è cambiata dopo un aggiornamento. Segnalalo allo sviluppatore indicando helper e versione.`,
    en: (helper: string) => `The helper in use (${helper}) does not expose the Pirate Outpost data: its structure has probably changed after an update. Please report it to the developer, mentioning helper and version.`,
  },
  piratiImportVisitOutpostFirst: {
    it: "Devi prima visitare il tuo Insediamento dei Pirati almeno una volta in questa sessione di gioco, poi riprova.",
    en: "You need to visit your Pirate Outpost at least once in this game session first, then try again.",
  },
  // Spezzata in prefix/suffix (invece di un'unica stringa) per incorniciare
  // l'icona Wand2 nel flusso della frase, stesso pattern di noCityImportedYet
  // + noImportedYetSuffix in App.tsx ("...in alto a sinistra [icona] per...").
  piratiImportHowToHintPrefix: {
    it: "Apri FoE, visita l'Insediamento dei Pirati, poi usa la bacchetta magica",
    en: "Open FoE, visit your Pirate Outpost, then use the magic wand",
  },
  piratiImportHowToHintSuffix: {
    it: "in alto a sinistra per importare i dati.",
    en: "in the top left to import your data.",
  },
  piratiImportUnsupportedFaction: {
    it: (faction: string) => `L'insediamento importato (${faction}) non è supportato: questo tool gestisce solo l'Insediamento dei Pirati.`,
    en: (faction: string) => `The imported outpost (${faction}) is not supported: this tool only handles the Pirate Outpost.`,
  },
  piratiImportNoTownhall: {
    it: "Nessun municipio dei Pirati (H_Pirates_Townhall) trovato nel payload: assicurati di essere sulla schermata dell'Insediamento dei Pirati quando usi la bacchetta.",
    en: "No Pirate townhall (H_Pirates_Townhall) found in the payload: make sure you're on the Pirate Outpost screen when using the wand.",
  },
  piratiImportSuccess: {
    it: (buildings: number, obstacles: number, expansions: number) =>
      `Importati ${buildings} edifici, ${obstacles} celle ostacolo, ${expansions} espansioni extra.`,
    en: (buildings: number, obstacles: number, expansions: number) =>
      `Imported ${buildings} buildings, ${obstacles} obstacle cells, ${expansions} extra expansions.`,
  },
  piratiImportUnrecognizedNote: {
    it: (count: number, ids: string) => ` (${count} tipo/i non riconosciuto/i: ${ids})`,
    en: (count: number, ids: string) => ` (${count} unrecognized type(s): ${ids})`,
  },

  // ── Tab Pirati: griglia/tooltip ────────────────────────────────────────
  piratiCellRemoveObstacleTitle: { it: "Clicca per rimuovere", en: "Click to remove" },
  piratiCellAddObstacleTitle: { it: "Clicca per segnare come ostacolo", en: "Click to mark as obstacle" },
  piratiMoveTownhallTitle: {
    it: "Trascina in un area libera per spostare",
    en: "Drag to a free area to move",
  },
  piratiMoveOrSwapTitle: {
    it: "Trascina per spostare o scambiare",
    en: "Drag to move or swap",
  },
  piratiDeleteBuildingTitle: { it: "Elimina edificio", en: "Delete building" },
  piratiExpansionObstacleTitle: {
    it: "Ostacolo presente in questa espansione (da un import)",
    en: "Obstacle present in this expansion (from an import)",
  },
  piratiExpansionAdd4x4: { it: "+ 4x4", en: "+ 4x4" },
  piratiExpansionRemoveLabel: { it: "Rimuovi", en: "Remove" },
  piratiExpansionLockedLabel: { it: "Vincolo", en: "Locked" },
  piratiExpansionLockedTitle: {
    it: "Rimuoverla isolerebbe altre espansioni dal resto della mappa.",
    en: "Removing it would isolate other expansions from the rest of the map.",
  },
  piratiExpansionLockedTownhallTitle: {
    it: "Contiene il Municipio: spostalo altrove prima di rimuovere questa espansione.",
    en: "It contains the Townhall: move it elsewhere before removing this expansion.",
  },
  // Esiti di removeExpansion quando il blocco richiuso conteneva edifici (vedi
  // layoutAfterBlockRemoval in PiratiTool.tsx): spostati in uno spazio libero,
  // oppure usciti dalla mappa perché non c'era posto (conteggi invariati).
  piratiExpansionRemovedRelocated: {
    it: (n: number) => n === 1
      ? "Espansione rimossa: l'edificio al suo interno è stato spostato in uno spazio libero."
      : `Espansione rimossa: i ${n} edifici al suo interno sono stati spostati in uno spazio libero.`,
    en: (n: number) => n === 1
      ? "Expansion removed: the building inside it was moved to a free spot."
      : `Expansion removed: the ${n} buildings inside it were moved to free spots.`,
  },
  piratiExpansionRemovedUnplaced: {
    it: (n: number) => n === 1
      ? "Espansione rimossa: un edificio al suo interno non ha più posto ed è uscito dalla mappa (il conteggio resta). Premi Risolvi per ridisporre tutto."
      : `Espansione rimossa: ${n} edifici al suo interno non hanno più posto e sono usciti dalla mappa (i conteggi restano). Premi Risolvi per ridisporre tutto.`,
    en: (n: number) => n === 1
      ? "Expansion removed: a building inside it no longer fits and left the map (its count is kept). Press Solve to rearrange everything."
      : `Expansion removed: ${n} buildings inside it no longer fit and left the map (their counts are kept). Press Solve to rearrange everything.`,
  },
  piratiAddExpansionHint: {
    it: "Seleziona col mouse uno slot 4x4 verde per sbloccarlo. Le ❌ semitrasparenti mostrano gli ostacoli già presenti in quell'area (da un import).",
    en: "Click a green 4x4 slot to unlock it. The semi-transparent ❌ show obstacles already present in that area (from an import).",
  },
  piratiRemoveExpansionHint: {
    it: "Seleziona col mouse un'espansione rossa per rimuoverla.",
    en: "Click a red expansion to remove it.",
  },

  // ── Tab Pirati: pannello edifici (categorie) ──────────────────────────
  piratiCategoryResidential: { it: "🏠 Edifici residenziali", en: "🏠 Residential buildings" },
  piratiCategoryGoods: { it: "🛢️ Edifici per i beni", en: "🛢️ Goods buildings" },
  piratiCategoryDiplomacyDoubloons: { it: "🤝 Diplomazia e Dobloni", en: "🤝 Diplomacy and Doubloons" },
  piratiCategoryDiplomacyOnly: { it: "🤝 Solo Diplomazia", en: "🤝 Diplomacy only" },

  // ── Tab Pirati: nomi edifici (nome completo / etichetta breve in griglia) ──
  // shortName è pensato per restare leggibile dentro la cella della griglia
  // (spazio minimo): non è sempre la prima parola del nome completo, a
  // differenza del vecchio comportamento (name.split(" ")[0]) — scelto a
  // mano per lingua così anche l'inglese resta riconoscibile.
  piratiBuildingMunicipioName: { it: "Municipio", en: "Townhall" },
  piratiBuildingMunicipioShort: { it: "Municipio", en: "Townhall" },
  piratiBuildingPescatoreName: { it: "Pesci", en: "Fish" },
  piratiBuildingPescatoreShort: { it: "Pesci", en: "Fish" },
  piratiBuildingSpezieName: { it: "Spezie", en: "Spices" },
  piratiBuildingSpezieShort: { it: "Spezie", en: "Spices" },
  piratiBuildingRumName: { it: "Rum", en: "Rum" },
  piratiBuildingRumShort: { it: "Rum", en: "Rum" },
  piratiBuildingCannoniName: { it: "Cannoni", en: "Cannons" },
  piratiBuildingCannoniShort: { it: "Cannoni", en: "Cannons" },
  piratiBuildingAmacaName: { it: "Amaca", en: "Hammock" },
  piratiBuildingAmacaShort: { it: "Amaca", en: "Hammock" },
  piratiBuildingCapannoName: { it: "Capanno", en: "Small Shed" },
  piratiBuildingCapannoShort: { it: "Capanno", en: "Small Shed" },
  piratiBuildingBaraccaName: { it: "Baracca", en: "Barrack" },
  piratiBuildingBaraccaShort: { it: "Baracca", en: "Barrack" },
  piratiBuildingMoloName: { it: "Molo Piccolo", en: "Small Pier" },
  piratiBuildingMoloShort: { it: "Molo", en: "S. Pier" },
  piratiBuildingMoloLungoName: { it: "Molo Lungo", en: "Long Pier" },
  piratiBuildingMoloLungoShort: { it: "M. Lungo", en: "Long Pier" },
  piratiBuildingMoloLargoName: { it: "Molo Largo", en: "Wide Pier" },
  piratiBuildingMoloLargoShort: { it: "M. Largo", en: "W. Pier" },
  piratiBuildingGrandeMoloName: { it: "Grande Molo", en: "Big Pier" },
  piratiBuildingGrandeMoloShort: { it: "Gr. Molo", en: "Big Pier" },
  piratiBuildingImbarcazioneName: { it: "Imbarcazione", en: "Small Cutter" },
  piratiBuildingImbarcazioneShort: { it: "Imbarc.", en: "Small Cutter" },
  piratiBuildingBrigantinoName: { it: "Brigantino", en: "Red Sailed Brig" },
  piratiBuildingBrigantinoShort: { it: "Brigantino", en: "Red Sailed Brig" },
  piratiBuildingGaleoneName: { it: "Galeone", en: "Galleon" },
  piratiBuildingGaleoneShort: { it: "Galeone", en: "Galleon" },
  // ── Planner (PlannerView, editorPonte, dueCorsie) ───────────────────
  plannerExperimental: { it: "sperimentale", en: "experimental" },
  plannerOptimize: { it: "▶ Ottimizza", en: "▶ Optimize" },
  plannerResumeTitle: {
    it: "La ricerca continua a cercare disposizioni migliori partendo da quelle mostrate (anche modificate a mano nell'editor o smussate)",
    en: "The search keeps looking for better layouts starting from the ones shown (also edited by hand in the editor or smoothed)",
  },
  plannerPause: { it: "⏸ Pausa", en: "⏸ Pause" },
  plannerPauseTitle: {
    it: "Mette in pausa la ricerca: puoi modificare le mappe nell'editor (✏ Modifica), smussare i bordi o completare",
    en: "Pauses the search: you can edit the maps in the editor (✏ Edit), smooth the edges or complete",
  },
  plannerSmooth: { it: "✨ Smussa", en: "✨ Smooth" },
  plannerSmoothTitle: {
    it: "Solo con la ricerca in pausa: sposta e scambia gli edifici con strada (strade invariate) per ridurre gli angoli di 90° del contorno e i buchi: il riempimento finale incastra meglio i pezzi piccoli. Continua finché non lo metti in pausa",
    en: "Only while the search is paused: moves and swaps road buildings (roads unchanged) to reduce the 90° corners of the outline and the holes, so the final fill fits small pieces better. Runs until you pause it",
  },
  plannerComplete: { it: "⏭ COMPLETA", en: "⏭ COMPLETE" },
  plannerCompleteTitle: {
    it: "Solo con la ricerca in pausa: chiude la ricerca su TUTTE le mappe (ciascuna tiene quella mostrata) e passa al riempimento con gli edifici senza strada",
    en: "Only while the search is paused: ends the search on ALL maps (each keeps the one shown) and moves on to filling with the buildings that need no road",
  },
  plannerFillResumeTitle: { it: "Riprende il riempimento", en: "Resumes the filling" },
  plannerFillPauseTitle: {
    it: "Mette in pausa il riempimento: nell'editor (✏ Modifica) puoi spostare gli edifici (le strade restano dove sono)",
    en: "Pauses the filling: in the editor (✏ Edit) you can move buildings (roads stay where they are)",
  },
  plannerUndoComplete: { it: "↩ Annulla completamento", en: "↩ Undo completion" },
  plannerUndoCompleteTitle: {
    it: "Interrompe il completamento e torna alla ricerca in pausa, con le disposizioni che c'erano quando hai premuto COMPLETA",
    en: "Stops the completion and goes back to the paused search, with the layouts there were when you pressed COMPLETE",
  },
  plannerUndoManual: { it: "↶ Annulla modifiche manuali", en: "↶ Undo manual edits" },
  plannerUndoManualTitle: {
    it: "Ripristina, sulle mappe modificate a mano, l'ultima disposizione trovata dall'ottimizzatore o dallo smussatore",
    en: "Restores, on the maps edited by hand, the last layout found by the optimizer or by the smoother",
  },
  plannerReset: { it: "↺ Reset", en: "↺ Reset" },
  plannerCpuGroup: { it: "Potenza del processore", en: "Processor power" },
  plannerCpuTitle: {
    it: (core: number, n: number, semi: number, lav: number, perc: number) => `Potenza del processore usata dal Planner: MAX ≈ 100%, MED ≈ 50%, MIN ≈ 25%.\nCore visti dal browser: ${core} · scenari: ${n} · ricerche per scenario: ${semi} · lavoro di ogni ricerca: ${lav}% → ricerche su ${perc}% dei core (più i thread del browser, es. la raccolta della memoria)`,
    en: (core: number, n: number, semi: number, lav: number, perc: number) => `Processor power used by the Planner: MAX ≈ 100%, MED ≈ 50%, MIN ≈ 25%.\nCores seen by the browser: ${core} · scenarios: ${n} · searches per scenario: ${semi} · work of each search: ${lav}% → searches on ${perc}% of the cores (plus the browser's threads, e.g. garbage collection)`,
  },
  plannerCityInfo: {
    it: (b: number, r: number) => `${b} edifici · ${r} strade`,
    en: (b: number, r: number) => `${b} buildings · ${r} roads`,
  },
  plannerMirrorChain: {
    it: "Non disponibile: in città ci sono edifici a catena in questa direzione (specchiati resterebbero scollegati dalla strada)",
    en: "Not available: the city has chain buildings in this direction (mirrored, they would be cut off from the road)",
  },
  plannerEditCity: { it: "✎ Modifica città", en: "✎ Edit city" },
  plannerEditCityTitle: {
    it: "Prima di ottimizzare: togli edifici della città e aggiungine altri dall'inventario o dal database. Le modifiche sono temporanee (Reset le azzera).",
    en: "Before optimizing: remove buildings from the city and add others from the inventory or the database. Changes are temporary (Reset clears them).",
  },
  plannerEditCityLocked: { it: "Metti in pausa o azzera il Planner per modificare la città.", en: "Pause or reset the Planner to edit the city." },
  plannerEditCityIntro: {
    it: "Togli edifici e aggiungine altri: il Planner disporrà la città modificata. Modifiche temporanee.",
    en: "Remove buildings and add others: the Planner will lay out the edited city. Temporary changes.",
  },
  plannerEditCityRestore: { it: "↺ Ripristina città", en: "↺ Restore city" },
  plannerEditCityRestarts: { it: "Cambiare la città riavvia il Planner.", en: "Changing the city restarts the Planner." },
  plannerEditRemoved: { it: "Tolti:", en: "Removed:" },
  plannerEditAdded: { it: "Aggiunti:", en: "Added:" },
  plannerEditCells: { it: "celle", en: "cells" },
  plannerEditFree: { it: "Celle libere per le strade:", en: "Cells left for roads:" },
  plannerEditFreeNow: {
    it: (l: number, s: number) => `(oggi ${l}; la città usa ${s} strade)`,
    en: (l: number, s: number) => `(now ${l}; the city uses ${s} roads)`,
  },
  plannerEditWarnGe: {
    it: "Hai tolto un Grande Edificio: nel gioco non torna in inventario, eliminarlo è definitivo.",
    en: "You removed a Great Building: in the game it does not go back to the inventory, deleting it is permanent.",
  },
  plannerEditWarnChain: {
    it: (n: string) => `Anelli di catena senza il loro inizio (verranno trattati come edifici normali): ${n}.`,
    en: (n: string) => `Chain links without their start (they will be treated as normal buildings): ${n}.`,
  },
  plannerEditWarnNoSpace: {
    it: "Non c'è spazio: gli edifici occupano tutte le celle sbloccate.",
    en: "No space: the buildings take up all the unlocked cells.",
  },
  plannerEditWarnSpace: {
    it: (s: number, l: number, d: number) => `Spazio stretto: oggi la città usa ${s} strade, dopo le modifiche restano ${l} celle libere. Il Planner dovrebbe risparmiare almeno ${d} strade: non è detto che ci riesca, alcuni edifici potrebbero restare fuori.`,
    en: (s: number, l: number, d: number) => `Tight space: the city uses ${s} roads now, ${l} free cells are left after the changes. The Planner would have to save at least ${d} roads: it may not manage, some buildings may not fit.`,
  },
  plannerEditWarnMaybe: {
    it: (l: number, s: number) => `Sulla carta c'è spazio (${l} celle libere per le strade, oggi la città ne usa ${s}), ma non è detto che gli edifici aggiunti ci stiano: dipende da quanto il Planner riesce a ottimizzare.`,
    en: (l: number, s: number) => `On paper there is room (${l} free cells for roads, the city uses ${s} now), but the added buildings may not fit: it depends on how well the Planner can optimize.`,
  },
  plannerEditUndo: { it: "Annulla questa modifica", en: "Undo this change" },
  plannerEditInCity: { it: "In città", en: "In the city" },
  plannerEditSearch: { it: "Cerca…", en: "Search…" },
  plannerEditSortName: { it: "per nome", en: "by name" },
  plannerEditSortEff: { it: "meno efficienti prima", en: "least efficient first" },
  plannerEditSortEffBest: { it: "più efficienti prima", en: "most efficient first" },
  plannerEditRemove: { it: "Togli un edificio", en: "Remove one building" },
  plannerEditAdd: { it: "Aggiungi", en: "Add" },
  plannerEditFromInventory: { it: "Inventario", en: "Inventory" },
  plannerEditFromDatabase: { it: "Database", en: "Database" },
  plannerEditNoResults: { it: "Nessun edificio trovato.", en: "No buildings found." },
  plannerEditNoInventory: {
    it: "Inventario vuoto: importalo con la bacchetta magica.",
    en: "Empty inventory: import it with the magic wand.",
  },
  plannerEditLeft: { it: "Rimasti in città", en: "Left in the city" },
  plannerEditAvailable: { it: "Copie disponibili", en: "Available copies" },
  plannerEditAddOne: { it: "Aggiungi un edificio", en: "Add one building" },
  plannerEditTypeToSearch: {
    it: "Scrivi almeno 2 lettere per cercare nel database (anche Grandi Edifici, eventi, negozi).",
    en: "Type at least 2 letters to search the database (Great Buildings, events, shops too).",
  },
  plannerEditMoreResults: {
    it: (n: number) => `…e altri ${n}: affina la ricerca.`,
    en: (n: number) => `…and ${n} more: refine the search.`,
  },
  plannerPngChangesTitle: { it: "Modifiche alla città", en: "City changes" },
  plannerPngRemovedTitle: {
    it: (n: number, c: number) => `Tolti: ${n} ${n === 1 ? "edificio" : "edifici"} (−${c} celle)`,
    en: (n: number, c: number) => `Removed: ${n} ${n === 1 ? "building" : "buildings"} (−${c} cells)`,
  },
  plannerPngAddedTitle: {
    it: (n: number, c: number) => `Aggiunti: ${n} ${n === 1 ? "edificio" : "edifici"} (+${c} celle)`,
    en: (n: number, c: number) => `Added: ${n} ${n === 1 ? "building" : "buildings"} (+${c} cells)`,
  },
  plannerPngChangesNote: {
    it: "Sulla mappa gli edifici aggiunti hanno il bordo bianco.",
    en: "On the map, added buildings have a white border.",
  },
  plannerLevel: { it: (n: number) => `Liv. ${n}`, en: (n: number) => `Lv. ${n}` },
  plannerVideo: { it: "🎬 VIDEO TUTORIAL", en: "🎬 VIDEO TUTORIAL" },
  plannerVideoTitle: { it: "Video tutorial del Planner", en: "Planner video tutorial (in Italian)" },
  plannerImportJson: { it: "📂 Importa JSON", en: "📂 Import JSON" },
  plannerImportJsonTitle: {
    it: "Carica l'export JSON della mappa di un'altra città (pulsante JSON del pannello MAPPA) per provarci il Planner. Non viene salvato.",
    en: "Loads the JSON map export of another city (JSON button of the MAP panel) to try the Planner on it. It is not saved.",
  },
  plannerImportedTitle: { it: "Il Planner sta usando questa città importata", en: "The Planner is using this imported city" },
  plannerProfileCity: { it: "↩ Città del profilo", en: "↩ Profile city" },
  plannerJsonIgnored: {
    it: (n: number, ids: string) => `⚠️ ${n} ${n === 1 ? "pezzo saltato" : "pezzi saltati"} perché non ne conosco le dimensioni: ${ids}`,
    en: (n: number, ids: string) => `⚠️ ${n} ${n === 1 ? "piece" : "pieces"} skipped (unknown size): ${ids}`,
  },
  plannerInvalidJson: { it: (m: string) => `JSON non valido: ${m}`, en: (m: string) => `Invalid JSON: ${m}` },
  plannerUnsuitable: {
    it: "City Builder: città non adatta (servono almeno 4 edifici con strada e spazio attorno al municipio) — uso il motore semplice.",
    en: "City Builder: city not suitable (at least 4 road buildings and space around the town hall are needed) — using the simple engine.",
  },
  plannerSetsTitle: { it: "Set di edifici non gestiti.", en: "Building sets not supported." },
  plannerSetsBody: {
    it: (n: number) => `La città ha ${n === 1 ? "un edificio" : `${n} edifici`} di vecchi set a bonus di adiacenza (il bonus cresce con i pezzi diversi del set che si toccano): il Planner non li tiene vicini fra loro, quindi ${n === 1 ? "verrà disposto" : "verranno disposti"} come edifici normali e il bonus del set può andare perso.`,
    en: (n: number) => `Your city has ${n === 1 ? "a building" : `${n} buildings`} from old adjacency-bonus sets (the bonus grows with the different set pieces touching each other): the Planner does not keep them together, so ${n === 1 ? "it will be placed" : "they will be placed"} as normal buildings and the set bonus may be lost.`,
  },
  plannerSetsList: { it: "Edifici:", en: "Buildings:" },
  plannerClose: { it: "Chiudi", en: "Close" },
  plannerCloseNotice: { it: "Chiudi avviso", en: "Close notice" },
  plannerMilitaryTitle: { it: "Edifici militari.", en: "Military buildings." },
  plannerMilitaryIn: { it: "In città c'è", en: "Your city has" },
  plannerAnd: { it: "e", en: "and" },
  plannerMilitaryBody: {
    it: "che produce ogni 24 ore le truppe di un edificio militare anche se non è collegato alla strada. Scegli quali edifici militari collegare comunque alla strada (gli altri vengono trattati come edifici senza strada); cambiare una scelta riavvia il Planner.",
    en: "which produces the units of a military building every 24 hours even if it is not connected to a road. Choose which military buildings to connect to the road anyway (the others are treated as buildings without road); changing a choice restarts the Planner.",
  },
  plannerSwitchLocked: { it: "Ferma o azzera il Planner per cambiare", en: "Pause or reset the Planner to change it" },
  plannerSwitchOn: { it: "Collegato alla strada", en: "Connected to the road" },
  plannerSwitchOff: { it: "Senza strada", en: "No road" },
  plannerTwoLaneTag: { it: " (due corsie)", en: " (two lanes)" },
  plannerTwoLaneRoad: { it: "Strada asfaltata", en: "Two-lane road" },
  plannerScenarioConnector: { it: (n: number) => `Raccordo a ${n}`, en: (n: number) => `Connector ${n}` },
  plannerScenarioCurrent: { it: "Configurazione attuale", en: "Current layout" },
  plannerScenarioPinwheel: { it: "Girandola", en: "Pinwheel" },
  plannerScenarioPinwheel2: { it: "Girandola 2", en: "Pinwheel 2" },
  plannerStatsPlaced: { it: "Con strada", en: "With road" },
  plannerStatsNoRoad: { it: "Senza strada", en: "Without road" },
  plannerStatsRoads: { it: "Strade", en: "Roads" },
  plannerStatsCorners: { it: "Angoli", en: "Corners" },
  plannerStatsCornersTitle: {
    it: "Angoli di 90° del contorno di edifici e strade (esclusi quelli contro il bordo della mappa): meno angoli, riempimento più facile",
    en: "90° corners of the outline of buildings and roads (excluding those against the map border): fewer corners, easier filling",
  },
  plannerStatsLayouts: { it: "prove", en: "attempts" },
  plannerMoveAllTitle: { it: "Sposta l'intera città (edifici e strade) di una cella", en: "Moves the whole city (buildings and roads) by one cell" },
  plannerMirror: { it: "Specchia", en: "Mirror" },
  plannerMirrorTitle: {
    it: "Specchia l'intera città (edifici e strade): i collegamenti restano gli stessi",
    en: "Mirrors the whole city (buildings and roads): connections stay the same",
  },
  plannerMirrorH: { it: "Specchia in orizzontale (destra ↔ sinistra)", en: "Mirror horizontally (right ↔ left)" },
  plannerMirrorV: { it: "Specchia in verticale (alto ↔ basso)", en: "Mirror vertically (top ↔ bottom)" },
  plannerEdit: { it: "✏ Modifica", en: "✏ Edit" },
  plannerEditTitle: {
    it: "Apre la mappa nell'editor (nuova scheda): sposta e togli edifici e strade, poi \"Applica al Planner\"",
    en: "Opens the map in the editor (new tab): move and remove buildings and roads, then \"Apply to Planner\"",
  },
  plannerEditLockedTitle: {
    it: "Metti in pausa il Planner (⏸ Pausa) per modificare la mappa nell'editor",
    en: "Pause the Planner (⏸ Pause) to edit the map in the editor",
  },
  plannerJsonTitle: {
    it: "Scarica la soluzione in JSON (formato del bookmarklet: CityMapData / CityEntities / UnlockedAreas, strade comprese)",
    en: "Downloads the solution as JSON (bookmarklet format: CityMapData / CityEntities / UnlockedAreas, roads included)",
  },
  plannerDeleteTitle: {
    it: "Elimina questo scenario: la sua ricerca si ferma e le altre proseguono",
    en: "Deletes this scenario: its search stops and the others continue",
  },
  plannerPopupBlocked: {
    it: "Il browser ha bloccato la finestra dell'editor: consenti i popup per questo sito.",
    en: "The browser blocked the editor window: allow popups for this site.",
  },
  plannerEditorRestarted: {
    it: "Il Planner è stato azzerato o riavviato dopo l'apertura dell'editor: riaprilo con ✏ Modifica.",
    en: "The Planner was reset or restarted after the editor was opened: open it again with ✏ Edit.",
  },
  plannerEditorPauseFirst: {
    it: "Metti in pausa il Planner (⏸ Pausa) prima di applicare le modifiche.",
    en: "Pause the Planner (⏸ Pause) before applying the changes.",
  },
  plannerAppliedTo: { it: (n: string) => `Applicata a ${n}`, en: (n: string) => `Applied to ${n}` },
  // errori delle modifiche dall'editor (editorPonte.ts, dueCorsie.ts)
  plannerErrInvalidData: { it: (m: string) => `Dati non validi: ${m}`, en: (m: string) => `Invalid data: ${m}` },
  plannerErrNewBuilding: {
    it: (n: string) => `${n}: edificio nuovo o duplicato (il Planner usa solo gli edifici della città)`,
    en: (n: string) => `${n}: new or duplicated building (the Planner only uses the city's buildings)`,
  },
  plannerErrTownHallRemoved: { it: "Il municipio non si può togliere.", en: "The town hall cannot be removed." },
  plannerErrChainBroken: {
    it: (n: string) => `${n}: catena spezzata, sposta o togli tutti i suoi pezzi insieme.`,
    en: (n: string) => `${n}: broken chain, move or remove all its pieces together.`,
  },
  plannerErrRoad: { it: "strada", en: "road" },
  plannerErrOthers: { it: (n: number) => ` e altri ${n}`, en: (n: number) => ` and ${n} more` },
  plannerErrOutside: { it: (l: string) => `Fuori dall'area sbloccata: ${l}.`, en: (l: string) => `Outside the unlocked area: ${l}.` },
  plannerErrOverlap: { it: (l: string) => `Sovrapposti: ${l}.`, en: (l: string) => `Overlapping: ${l}.` },
  plannerErrFillRoads: {
    it: "Durante il completamento le strade devono restare dove sono.",
    en: "During the completion the roads must stay where they are.",
  },
  plannerErrFillTownHall: {
    it: "Durante il completamento il municipio deve restare dov'è.",
    en: "During the completion the town hall must stay where it is.",
  },
  plannerErrFillMissing: {
    it: "Durante il completamento gli edifici con strada si possono spostare ma non togliere o aggiungere.",
    en: "During the completion road buildings can be moved but not removed or added.",
  },
  plannerErrDetached: {
    it: (l: string) => `Edifici con strada non attaccati a una strada: ${l}.`,
    en: (l: string) => `Road buildings not attached to a road: ${l}.`,
  },
  plannerErrTwoLaneMisaligned: {
    it: "Strade a due corsie sfalsate: due blocchi 2×2 che si toccano devono essere allineati.",
    en: "Misaligned two-lane roads: two touching 2×2 blocks must be aligned.",
  },
  plannerErrTwoLaneDisconnected: {
    it: "Strade a due corsie non collegate al municipio (direttamente o tramite altri blocchi 2×2 allineati).",
    en: "Two-lane roads not connected to the town hall (directly or through other aligned 2×2 blocks).",
  },
  plannerErrTwoLaneDetached: {
    it: (l: string) => `Edifici che richiedono due corsie senza una strada 2×2 collegata accanto: ${l}.`,
    en: (l: string) => `Buildings requiring two lanes without a connected 2×2 road next to them: ${l}.`,
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
