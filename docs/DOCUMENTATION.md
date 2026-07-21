# FoE Optimizer by Sdrushi — Documentazione Tecnica Completa (v1.0)

> Documentazione di riferimento del progetto **FoE Optimizer**, una webapp client-side
> per analizzare e ottimizzare gli edifici, gli alleati e l'inventario del gioco
> **Forge of Empires (FoE)**.
>
> Questo documento descrive **l'architettura, i dati e tutta la logica** del tool.
> L'interfaccia grafica (layout, stili, componenti visivi) è deliberatamente **fuori
> ambito**: qui si documenta il "motore", non la presentazione.
>
> ⚠️ **REGOLA DI MANUTENZIONE**: questo file e `docs/SKILL.md` vanno tenuti SEMPRE
> allineati al codice — ogni modifica al progetto o alla pipeline che tocca un
> comportamento qui descritto va riflessa nello stesso giro di lavoro. Quando cambia
> `docs/SKILL.md`, la skill installata va ricaricata dalle impostazioni.

---

## Indice

1. [Cos'è il tool e a cosa serve](#1-cosè-il-tool-e-a-cosa-serve)
2. [Filosofia architetturale](#2-filosofia-architetturale)
3. [Stack tecnologico](#3-stack-tecnologico)
4. [Struttura dei file](#4-struttura-dei-file)
5. [Il flusso dei dati: dal gioco alla tabella](#5-il-flusso-dei-dati-dal-gioco-alla-tabella)
6. [Il bookmarklet (bacchetta magica)](#6-il-bookmarklet-bacchetta-magica)
7. [Modello dati centrale: `Building`](#7-modello-dati-centrale-building)
8. [I file di dati statici (`assets/`)](#8-i-file-di-dati-statici-assets)
   - 8bis. [La pipeline dati esterna: RECUPERO DATI](#8bis-la-pipeline-dati-esterna-dfoerecupero-dati)
9. [Sistema multilingua](#9-sistema-multilingua)
10. [Le ere del gioco (`ages.ts`)](#10-le-ere-del-gioco-agests)
11. [Classificazione degli edifici (`buildingClassification.ts`)](#11-classificazione-degli-edifici-buildingclassificationts)
12. [Parsing del CSV edifici (`buildings.ts`)](#12-parsing-del-csv-edifici-buildingsts)
13. [Il modello di dominio (`BuildingModel.ts`)](#13-il-modello-di-dominio-buildingmodelts)
14. [Parsing degli alleati (`allies.ts`)](#14-parsing-degli-alleati-alliests)
15. [Parsing dell'inventario (`inventory.ts`)](#15-parsing-dellinventario-inventoryts)
16. [Il cuore del tool: l'ottimizzatore inventario (`inventoryOptimizer.ts`)](#16-il-cuore-del-tool-lottimizzatore-inventario-inventoryoptimizerts)
17. [I tipi della mappa città (`cityMap.ts`)](#17-i-tipi-della-mappa-città-citymapts)
18. [Lo store serializzato della città (`cityStore.ts`)](#18-lo-store-serializzato-della-città-citystorets)
19. [Calcolo dell'efficienza (`calculator.ts`)](#19-calcolo-dellefficienza-calculatorts)
20. [Formattazione numerica (`format.ts`)](#20-formattazione-numerica-formatts)
21. [Persistenza e localStorage (`storage.ts`)](#21-persistenza-e-localstorage-storagets)
22. [Profili](#22-profili)
23. [Eventi (filtro per evento)](#23-eventi-filtro-per-evento)
24. [Orchestrazione: `App.tsx`](#24-orchestrazione-apptsx)
25. [Configurazione di build](#25-configurazione-di-build)
    - 25bis. [PWA, service worker, cache e deploy](#25bis-pwa-service-worker-cache-e-deploy)
26. [Invarianti e principi da non violare](#26-invarianti-e-principi-da-non-violare)
27. [Glossario dei termini FoE](#27-glossario-dei-termini-foe)

---

## 1. Cos'è il tool e a cosa serve

**FoE Optimizer** è una applicazione web a pagina singola che aiuta un giocatore di
Forge of Empires a prendere decisioni sui propri edifici. Le funzioni principali del
motore sono:

- **Database edifici consultabile**: un catalogo locale di tutti gli edifici del
  gioco, con le loro statistiche (dimensioni, popolazione, felicità, bonus militari,
  bonus di Incursione Quantica, produzioni di beni/punti forge/ecc.).
- **Import della città reale**: tramite un *bookmarklet* eseguito sul gioco, l'utente
  importa la propria città, il proprio inventario e i propri alleati. Il tool li
  elabora e li mostra con le statistiche reali per l'era del giocatore.
- **Calcolo dell'efficienza**: ogni edificio riceve un punteggio di efficienza
  (valore prodotto per cella di spazio occupato), pesato secondo i criteri che
  l'utente ritiene importanti (attacco/difesa generale, Campi di Battaglia,
  Spedizioni, Incursioni Quantiche).
- **L'ottimizzatore dell'inventario** (la funzione distintiva): data la collezione
  di kit e edifici posseduti in inventario, calcola **tutto ciò che è realmente
  costruibile**, a quale livello, e con quali kit. È la caratteristica che distingue
  questo tool da qualunque altro per FoE.
- **Gestione alleati**: mostra gli alleati posseduti, il loro livello, i bonus
  calcolati (incluse le ereditarietà di rarità) e i frammenti raccolti.
- **Profili multipli**: l'utente può tenere città/inventari separati (es. mondo beta
  e mondo live, o account diversi) come profili indipendenti.

Il tool è interamente in **italiano** come lingua predefinita, ma è progettato per
essere multilingua (vedi §9).

---

## 2. Filosofia architetturale

Cinque principi guidano tutta l'architettura. Conoscerli è indispensabile per
modificare il progetto senza romperlo.

### 2.1 Nessun backend, tutto lato client

Il tool **non** si collega ad alcun server o API. Tutto avviene nel browser:

- i dati statici (catalogo edifici, alleati, ere, kit) sono file inclusi nel bundle;
- i dati personali (città, inventario, alleati) arrivano dal bookmarklet via clipboard;
- la persistenza è su `localStorage`.

Conseguenze: il tool è **velocissimo**, funziona **offline**, e si distribuisce come
**un singolo file HTML** autosufficiente (vedi §25). Non c'è nulla da installare né
configurare per l'utente finale.

### 2.2 Una sola sorgente di verità per ogni concetto

Ogni informazione ha **un solo posto** dove vive. Esempi:

- I **tipi del payload di gioco** (`BookmarkletData`, `CityEntityDefinition`,
  `InventoryItem`, `RawAlly`) vivono **solo** in `data/bookmarklet.ts`. Chiunque ne
  abbia bisogno li importa da lì. Non esistono copie locali che potrebbero divergere.
- Le **lingue supportate** vivono **solo** in `data/languages.ts`.
- I **pattern degli ID** (cos'è un Grande Edificio, cos'è un kit di rimpicciolimento,
  ecc.) vivono **solo** in `data/buildingClassification.ts`.
- I **nomi dei consumabili** (`CONSUMABLE_ASSET_NAMES`) vivono **solo** in
  `data/buildingClassification.ts` e sono la fonte da cui `inventory.ts` deriva tutto.

Questo principio elimina intere classi di bug (due definizioni che si disallineano).

### 2.3 I dati provengono tutti dallo stesso parser di gioco

Tutti i dati importati (CSV, payload del bookmarklet) provengono dallo stesso
`MainParser` di Forge of Empires. Questo è un fatto importante con una conseguenza
pratica: **non servono normalizzazioni difensive** (uniformare maiuscole/minuscole
degli ID, "ripulire" formati, ecc.). Un `cityEntityId` nell'inventario è scritto
esattamente come nel CSV, perché entrambi vengono dalla stessa fonte. Il codice si
fida di questo e **non** spreca cicli a normalizzare ID che non possono differire.

Corollario: `width` e `length` (dimensioni delle aree) sono **sempre** numeri nel
payload, mai stringhe. Il codice tratta questi campi come numerici senza conversioni
difensive.

### 2.4 Logica di dominio incapsulata nei "model"

La logica complessa che trasforma i dati grezzi del gioco in `Building` utilizzabili
(estrazione di bonus, popolazione, produzioni dalle strutture annidate di
`CityEntities`) è incapsulata in `BuildingModel` come metodi factory statici
(`fromCityEntity`, `fromGreatBuilding`). Questo tiene `App.tsx` libero da quella
complessità e centralizza in un punto solo la conoscenza del formato di gioco.

### 2.5 Funzioni pure dove possibile

Parser e calcoli sono **funzioni pure**: ricevono input, restituiscono output, non
toccano stato React né `localStorage`. Esempi: `parseInventory`, `parseBuildingsCsv`,
`computeAllFamilies`, `calculateEfficiency`. Questo le rende testabili in isolamento e
prevedibili. Lo stato e gli effetti collaterali sono confinati in `App.tsx` e
`storage.ts`.

---

## 3. Stack tecnologico

| Tecnologia | Ruolo |
|---|---|
| **Preact** (via `preact/compat`) | Libreria UI. È un sostituto drop-in di React (~4KB invece di ~300KB), aliasato in `vite.config.ts`. Il codice è scritto come React standard. |
| **React 19** (API) | Le API React (hook, `StrictMode`) sono quelle a cui il codice si appoggia; Preact le implementa. |
| **TypeScript** | Tipizzazione statica forte. Compilazione con `noUnusedLocals`/`noUnusedParameters` attivi (nessuna variabile morta tollerata). |
| **Vite** | Build tool e dev server. |
| **Tailwind CSS v4** | Stili UI (fuori ambito di questa documentazione). |
| **pako** | Compressione gzip dei dati di profilo prima di salvarli in `localStorage`. |
| **lucide-react** | Alcune icone UI. |
| **vite-plugin-singlefile** | Produce un `dist/foe-optimizer.html` autosufficiente (tutto inline). |
| **ESLint** | Con `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-security`. |
| **knip** | Rilevatore di codice morto / export inutilizzati. |

Output finale: un singolo file `foe-optimizer.html` pubblicato su GitHub Pages.

---

## 4. Struttura dei file

```text
src/
├── assets/                    # Dati statici grezzi (importati da Vite come testo)
│   ├── ages.csv               # Le 23 ere del gioco (id;age;NomeIta;NomeEng)
│   ├── allies.csv             # Catalogo alleati con statistiche base
│   ├── buildings.csv          # Catalogo edifici (sorgente di verità del database)
│   ├── events.csv             # Mappatura eventi → token ID edificio (per il filtro)
│   ├── icons.ts               # Icone PNG inline (data URI) usate nelle tabelle
│   └── kit.json               # Catene di upgrade + selection kit (per l'ottimizzatore)
│
├── data/                      # Tipi e parser di dominio (logica pura)
│   ├── ages.ts                # Parsing ere + lookup + nome localizzato
│   ├── allies.ts              # Tipi alleati + parser CSV/gioco + statistiche derivate
│   ├── bookmarklet.ts         # Bookmarklet JS + tipi del payload di gioco + validazione
│   ├── buildingClassification.ts  # Pattern ID, costanti, classificazioni
│   ├── buildings.ts           # Interfaccia Building + parser CSV edifici
│   ├── cityMap.ts             # Tipi della mappa città (solo tipi)
│   ├── cityStore.ts           # Tipo dello stato città serializzato (solo tipi)
│   ├── inventory.ts           # Tipi inventario + parser puro
│   ├── inventoryOptimizer.ts  # ⭐ L'ottimizzatore: cosa è costruibile dall'inventario
│   ├── languages.ts           # Lingue supportate (configurazione)
│   └── translations.ts        # Costruzione mappe id→nome multilingua
│
├── models/
│   └── BuildingModel.ts       # Logica di dominio: factory di Building da dati di gioco
│
├── utils/
│   ├── calculator.ts          # Efficienza + tipo Weights
│   ├── format.ts              # Formattatori numerici puri
│   └── storage.ts             # Persistenza localStorage + versioning + profili
│
├── components/
│   ├── AboutModal.tsx         # Modale info/crediti (con link a PRIVACY.md)
│   ├── CityMapView.tsx        # Componente mappa città (UI, fuori ambito)
│   ├── EfficiencyHelpModal.tsx # Modale di aiuto sull'efficienza
│   └── ProfileHelpModal.tsx   # Modale di aiuto sui profili
│
├── App.tsx                    # Orchestrazione: stato, wiring, rendering
├── main.tsx                   # Entry point (monta App, inizializza ages)
├── registerSW.ts              # Registrazione service worker + avviso update (§25bis)
├── index.css                  # Stili globali (UI)
└── vite-env.d.ts              # Dichiarazioni tipi Vite
```

Fuori da `src/`, nel repo: `public/` (file statici serviti alla radice, fuori dal
bundle: manifest e icone PWA, `guida.html`/`guide.html` — la guida online IT/EN —
`404.html`, `.well-known/security.txt`, `sitemap.xml`, `robots.txt`, `CNAME`, tutorial
jpg/mp4), `sw-template.js` (template del service worker, §25bis), `PRIVACY.md`
(informativa privacy, linkata da AboutModal), `docs/` (questa documentazione e la
skill), `.github/workflows/deploy.yml` (CI con gate typecheck+lint, §25) e
`check-all.bat` (catena di controllo locale pre-commit, **gitignored**, §25).

### Le tre "cartelle logiche" e la loro gerarchia di dipendenze

- **`data/`** contiene tipi e parser. Dipende al massimo da se stessa e da `models/`
  (solo per i tipi).
- **`models/`** contiene la logica di dominio. Dipende da `data/` (tipi).
- **`utils/`** contiene helper generici (formattazione, calcolo, storage). Dipende da
  `data/` solo per i tipi.

Una regola importante per evitare **cicli di import**: `buildings.ts` e `allies.ts`
**non** importano `translations.ts`. È `translations.ts` che importa i loro tipi. Il
collante (la chiamata `initTranslations`) sta in `App.tsx`, eseguito dopo il parsing
dei CSV. Vedi §9.

---

## 5. Il flusso dei dati: dal gioco alla tabella

Ecco il percorso completo di un dato, dall'avvio dell'app fino alla visualizzazione.

### 5.1 All'avvio (caricamento del modulo)

1. `main.tsx` importa `./data/ages` per primo: questo **parsa `ages.csv`** una volta
   sola, stabilendo le 23 ere e l'era massima (`FALLBACK_ERA`).
2. `App.tsx`, al livello modulo (prima ancora che il componente venga montato):
   - parsa `buildings.csv` → `BUILDINGS_FROM_CSV` (array di `Building`);
   - parsa `allies.csv` → `ALLIES_FROM_CSV` (array di `Ally`);
   - chiama `initKitData(kit.json)` per costruire gli indici dell'ottimizzatore;
   - chiama `initTranslations(...)` per costruire le mappe nome→lingua;
   - costruisce vari indici globali (mappe id→edificio, set di id, ecc.).
3. Il componente `App` viene montato. Legge da `localStorage`: profili, profilo
   attivo, dati del profilo attivo (città/inventario/alleati), impostazioni globali.

### 5.2 Quando l'utente importa con il bookmarklet

1. L'utente esegue il bookmarklet sul gioco: copia negli appunti un JSON con i 5
   blocchi (`inventory`, `allies`, `CityMapData`, `CityEntities`, `UnlockedAreas`).
2. Nel tool, il click sulla "bacchetta magica" legge la clipboard.
3. Il JSON viene validato (`validateBookmarkletData`): se manca un blocco, **alert e
   stop**, nessun profilo viene creato.
4. Se valido: viene creato un nuovo profilo, attivato, e i dati importati nell'ordine
   **città → alleati → inventario**.
5. Se l'import fallisce a metà, viene fatto **rollback** completo (il profilo nuovo è
   rimosso, quello precedente ripristinato).

### 5.3 Elaborazione (dentro `App.tsx`, via `useMemo`)

I dati grezzi vengono trasformati attraverso una catena di `useMemo` che si attivano a
cascata quando le loro dipendenze cambiano. Per ogni edificio della città:

- si cerca l'edificio nel catalogo CSV (`BUILDING_BY_ID`);
- se non c'è, si costruisce un **fallback** da `CityEntities` via
  `BuildingModel.fromCityEntity` (estraendo statistiche reali per l'era del giocatore);
- se è un Grande Edificio, si usa `BuildingModel.fromGreatBuilding`;
- si calcola l'efficienza (`calculateEfficiency`) usando i pesi correnti;
- si applicano i filtri e l'ordinamento scelti dall'utente.

L'inventario, parallelamente, alimenta `computeAllFamilies` (l'ottimizzatore) per
produrre la lista di tutto ciò che è costruibile.

---

## 6. Il bookmarklet (bacchetta magica)

**File:** `src/data/bookmarklet.ts`

È **l'unico** metodo di importazione dati dal gioco. Contiene tre cose:

### 6.1 `BOOKMARKLET_JS`

Una stringa contenente codice JavaScript che l'utente salva tra i preferiti del
browser e clicca mentre è sulla pagina del gioco. Quando eseguito, accede agli oggetti
globali del gioco e raccoglie:

| Sorgente nel gioco | Cosa contiene |
|---|---|
| `MainParser.Inventory` | Tutti gli item dell'inventario (edifici, kit, frammenti, consumabili). |
| `Allies.allyList` (fallback: `MainParser.Allies.allyList`) | Gli alleati posseduti dal giocatore. Da luglio 2026 FoE Helper espone `Allies` come oggetto globale a sé stante; il bookmarklet prova prima il nuovo percorso e ripiega sul vecchio per le versioni non aggiornate. |
| `MainParser.CityMapData` | La disposizione della città (quali edifici, dove, a che livello). |
| `MainParser.CityEntities` | Le definizioni complete delle entità (statistiche per era). |
| `CityMap.Main.unlockedAreas` | Le aree di città sbloccate (spazio disponibile). |
| `ExtPlayerAvatar` + `srcLinks` | URL CDN dell'avatar del giocatore (facoltativo: presente solo se le variabili globali esistono nella pagina di gioco). |

Costruisce un oggetto JSON e lo copia negli appunti (con fallback su `execCommand`
per i browser senza `navigator.clipboard`).

**Guard "FoE Helper è cambiato".** Prima di costruire il payload, lo script verifica
che ALMENO uno dei due percorsi alleati esista (`Allies` globale o legacy
`MainParser.Allies`): se mancano entrambi, si ferma con un alert chiaro che invita a
riscaricare la bacchetta dal sito, invece di lasciar esplodere un TypeError criptico
("Cannot read properties of undefined"). Lezione del passaggio v1→v2: gli utenti con
lo script vecchio nei preferiti vedono solo l'errore del LORO script, quindi il
messaggio utile va predisposto PRIMA della prossima rottura, non dopo.

**Ottimizzazione delle aree:** per ridurre la dimensione del payload, le aree sbloccate
standard (4×4, la grande maggioranza) vengono compresse rimuovendo i campi `width`,
`length` (ricostruibili al default 4) e `__class__`.

**Versionamento del bookmarklet (`CURRENT_BOOKMARKLET_VERSION`).** Il payload include
un campo `_v` la cui versione corrente è la costante esportata
`CURRENT_BOOKMARKLET_VERSION`, **interpolata** direttamente dentro `BOOKMARKLET_JS`
(nessun numero duplicato da tenere sincronizzato a mano). All'import, `handleWandClick`
in App.tsx confronta il `_v` del payload con la versione corrente (`_v` assente =
versione pre-versionamento, trattata come 0): se è inferiore, mostra un alert
(`bookmarkletOutdatedAlert`) che invita a ri-trascinare il bookmarklet aggiornato. Si
incrementa quando cambia il MODO in cui il bookmarklet legge i dati dal gioco (es. FoE
Helper che ristruttura un oggetto globale), non per modifiche cosmetiche. v2 (luglio
2026): lo spostamento di `Allies` fuori da `MainParser` descritto sopra — la lettura
è cambiata (con fallback, quindi retrocompatibile), la struttura del payload no.
Contestualmente, in home è stato mostrato un **annuncio one-off dismissibile**
(`BOOKMARKLET_V2_ANNOUNCEMENT_ID = "bookmarklet-v2-allies-2026-07"`, persistito in
`DISMISSED_ANNOUNCEMENTS_KEY`, vedi §21): l'ID di un annuncio già pubblicato non va
mai cambiato, o riapparirebbe a chi l'ha chiuso.

> **REGOLA CRITICA:** ciò che **non va modificato** è la **struttura dei dati** che il
> bookmarklet raccoglie ed esporta — l'oggetto `data` con i suoi 5 campi obbligatori (`inventory`,
> `allies`, `CityMapData`, `CityEntities`, `UnlockedAreas`) e le loro trasformazioni —
> più il campo opzionale `portraitUrl` (URL avatar, assente nei bookmarklet precedenti,
> retrocompatibile). Quella struttura è il contratto con `validateBookmarkletData` e con il formato dei profili
> salvati: cambiarla romperebbe i bookmarklet già salvati dagli utenti nei preferiti.
>
> **Ciò che invece SI PUÒ modificare liberamente** sono le parti che non toccano i dati:
> in particolare i **messaggi di `alert()`** (testo d'errore). Cambiarli altera sì la
> stringa `BOOKMARKLET_JS`, ma siccome la struttura dati resta identica, **i bookmarklet
> già salvati continuano a funzionare** per l'import — vedrebbero solo il vecchio testo
> d'errore finché l'utente non ri-trascina (cosa non necessaria per il corretto
> funzionamento). Quindi: struttura dati = intoccabile; messaggi e dettagli non-dato =
> modificabili.

### 6.2 I tipi del payload

`bookmarklet.ts` è la **sorgente di verità** dei tipi del payload di gioco:

- `BookmarkletData` — la forma completa del JSON importato. Include i 5 campi
  obbligatori più `portraitUrl?: string` — URL avatar del giocatore sul CDN di FoE
  (es. `"https://foeit.innogamescdn.com/.../portrait_359-xxx.jpg"`). Assente nei
  profili importati con bookmarklet precedenti all'introduzione del campo.
- `CityMapEntry` — una entry della mappa città (un edificio piazzato).
- `CityEntityDefinition` — la definizione di un'entità (con `components`,
  `entity_levels`, `abilities`, ecc.), da cui si estraggono le statistiche.
- `InventoryItem` — un item dell'inventario.
- `RawAlly` — un alleato nel formato grezzo del gioco.
- `UnlockedArea` — un'area sbloccata.
- `BoostHint` — un singolo boost dichiarato in `CityEntities`; esportato perché
  riusato da `BuildingModel` nell'estrazione delle statistiche.

Alcune interfacce di supporto (`StaticResourcesBlock`, `EraComponent`, `EntityLevel`,
`EntityAbility`) sono usate internamente come tipi annidati di `CityEntityDefinition`
e volutamente non esportate.

### 6.3 `validateBookmarkletData`

Verifica che il JSON incollato contenga tutti e 5 i blocchi attesi. È il gate che
impedisce di creare profili da dati incompleti. Restituisce `null` se è tutto a posto,
altrimenti un `BookmarkletValidationError` — un oggetto con un **codice stabile**, non
testo localizzato:

- `{ code: "INVALID_FORMAT" }` — il payload non è nemmeno un oggetto.
- `{ code: "MISSING_FIELDS", missingFields: string[] }` — mancano uno o più dei 5
  blocchi (elencati in `missingFields`).

Il codice è stabile (in inglese, non tradotto) perché `bookmarklet.ts` è un modulo
dati puro senza accesso a `uiLang`/`t()`. È `App.tsx` a mappare il codice alla stringa
tradotta (`bookmarkletInvalidFormat` / `bookmarkletMissingFields` in `ui-strings.ts`).
Stesso pattern usato da `mergeImportedProfiles` in `storage.ts` (`"INVALID_IMPORT_FILE"`):
**i moduli `data/` e `utils/` non producono mai testo localizzato, solo codici** che il
livello UI traduce.

> **Convenzioni su cosa NON tradurre.** Due categorie di stringhe restano sempre in
> inglese fisso, di proposito:
> 1. *Diagnostica interna di programmazione* — `console.warn`/`console.error`/`throw`
>    rivolti allo sviluppatore (es. `"initKitData not called"`, `"[FOE] PNG export
>    failed"`, il fail-fast di `ages.ts`). Non sono testo per l'utente finale, quindi non
>    passano per `t()`.
> 2. *Nomi dei file scaricati* — es. `foe-map-YYYY-MM-DD.svg/.png` (CityMapView), header
>    del CSV di debug (`CityEntityID;name;num`). Sono identificatori di file, non UI
>    mostrata: si tengono in inglese neutro a prescindere da `uiLang`, evitando di
>    introdurre `t()` in punti che altrimenti non ne avrebbero bisogno.

> **Messaggi del bookmarklet.** I due `alert()` DENTRO `BOOKMARKLET_JS` (`'Copy failed:
> …'`, `'Magic wand error: …'`) sono in inglese fisso. Girano nella pagina di Forge of
> Empires, fuori dal contesto dell'app, quindi non hanno accesso a `t()`/`uiLang`; si
> attivano solo in casi d'errore rari (copia clipboard fallita). Si possono modificare
> liberamente — vedi la precisazione sull'invariante in §6.1.

---

## 7. Modello dati centrale: `Building`

**File:** `src/data/buildings.ts`

`Building` è il tipo attorno a cui ruota tutto il tool. Rappresenta un edificio, sia
che provenga dal catalogo CSV, sia che sia un Grande Edificio, sia che sia un fallback
costruito dai dati di gioco. Campi principali:

### Identità e nome
- `id` — identificatore di riga/istanza (progressivo per gli edifici CSV).
- `cityEntityId` — l'**ID di dominio** del gioco (es. `R_MultiAge_FALL16A1`). È la
  chiave usata per i lookup e i match con i dati importati.
- `name` — nome "grezzo" di fallback (italiano se presente, altrimenti inglese,
  altrimenti l'id). Usato quando serve un nome senza passare per la traduzione.
- `names` — mappa lingua→nome (`{ it, en, ... }`). È la **fonte di verità** per i nomi
  localizzati. Aggiungere una lingua non richiede toccare l'interfaccia.

### Immagine
- `hash` — hash/nome-file dell'asset immagine. Due formati possibili: hex puro
  (`"026325675"`) o nome completo con trattino (`"L_AllAge_CupBonus1-2b911bbae"`).
  Interpretato da `getImageUrl()`.

### Dimensioni e spazio
- `size` — stringa tipo `"3x5"` (solo visualizzazione).
- `area` — area numerica (`15` per un 3×5), usata per ordinamento e logica.
- `road` — fabbisogno stradale, calcolato come `min(larghezza, altezza) / 2`.

### Statistiche di base
- `pop` — popolazione fornita.
- `fel` — felicità fornita.
- `lin` — `true` se fa parte del set "principale" (823 edifici storici, `Lin=1` nel
  CSV). Distingue gli edifici principali dai livelli intermedi/varianti. Usato dallo
  switch LIGHT/FULL nella tab Info.

### Bonus militari (4 valori ciascuno: AttAtt, DifAtt, AttDif, DifDif)
- `general` — bonus generali (`[GenAtk_A, GenDef_A, GenAtk_D, GenDef_D]`).
- `gbg` — bonus Campi di Battaglia di Gilda (Guild Battlegrounds).
- `sped` — bonus Spedizioni di Gilda (Guild Expedition).
- `iq` — bonus Incursioni Quantiche (Quantum Incursions / guild_raids).

### Incursioni Quantiche (valori scalari)
- `iqMonB`, `iqMatB` — boost % monete/materiali IQ (es. `0.04` = +4%; stesso
  formato frazionario di `benib`/`fpb`, NON percentuale già moltiplicata).
- `iqMon`, `iqMat` — monete/materiali aggiuntivi iniziali IQ (valori assoluti).
- `iqBeni`, `iqTruppe`, `iqAzioni`, `iqCap` — bonus IQ specifici (beni iniziali,
  truppe iniziali, punti azione raccolti, capacità punti azione).

### Produzioni (valori attesi, vedi §13)
- `mon`, `mat` — monete/materiali prodotti giornalmente (produzione generica, non
  IQ). Estratti da `extractMonMat` per le città importate (vedi §13).
- `fp` — punti forge prodotti.
- `fpb` — boost % alla produzione di punti forge.
- `fur` — furfanti (valore atteso).
- `tr` — truppe dell'era attuale.
- `trne` — truppe dell'era successiva.
- `beni` — beni dell'era attuale.
- `benip` — beni dell'era precedente.
- `benis` — beni dell'era successiva.
- `benib` — boost % alla produzione di beni.
- `benig` — beni di gilda.
- `bp` — blueprint (progetti).
- `ally` — bonus alleati.

### Consumabili / reward speciali (valore atteso frammenti)
- `fsp` — termina produzione speciale (rush event buildings).
- `tpm` — termina produzione materiali (rush mass supplies).
- `tpb` — termina produzione beni (rush goods buildings).
- `adm` — aiuto di massa (mass self aid kit).
- `mod` — kit modernizzatore (one up kit).
- `rin` — kit rinnovamento (renovation kit).
- `imm` — immagazzina edificio (store building).
- `fragments` — stringa descrittiva dei frammenti prodotti.

### Flag di classificazione (tutti opzionali)
- `isGreatBuilding` — è un Grande Edificio (prefisso `X_`).
- `isMilitary` — è un edificio militare (prefisso `M_`).
- `isGoods` — è una fabbrica di beni (prefisso `G_`).
- `isInactive` — è un edificio "inattivo" (id contenente `W_*Decoration`): un edificio
  normale del catalogo che il gioco ha declassato a ornamento dopo la fine di un evento
  a tempo. **Non** è una decorazione vera (quelle hanno prefisso `D_`).
- `isFallback` — costruito da `CityEntities` (ma con dati completi, vedi §13).
- `isUnresolved` — placeholder vuoto: nessuna fonte ha fornito dati reali (badge
  UNKNOWN). Distinto da `isFallback`.

---

## 8. I file di dati statici (`assets/`)

Tutti i file in `assets/` sono importati da Vite come **testo grezzo** (`?raw`) o JSON
e diventano parte del bundle. Sono la base dati immutabile del tool.

### 8.1 `buildings.csv` — il catalogo degli edifici

È la **sorgente di verità del database edifici**. Formato a punto e virgola (`;`) con
intestazione. Contiene ~2050 edifici. Colonne principali:

```text
CityEntityId; NomeIta; NomeEng; Hash; Lin; Kit; Time; Size; Road; Pop; Fel;
BP; PF; PFB; FUR; TR; TRNE; Beni; BeniP; BeniS; BeniB; BeniG;
GenAtk_A; GenDef_A; GenAtk_D; GenDef_D;
CampiAtk_A; CampiDef_A; CampiAtk_D; CampiDef_D;
SpedAtk_A; SpedDef_A; SpedAtk_D; SpedDef_D;
IQAtk_A; IQDef_A; IQAtk_D; IQDef_D;
IQBeni; IQTruppe; IQAzioni; IQCap; Ally;
FSP; TPM; TPB; ADM; MOD; RIN; IMM; Fragments
```

`Lin` è un flag manuale di riferimento per stabilire gli edifici da includere
nella visualizzazione `Light` delle tabelle.

Ogni colonna mappa direttamente su un campo di `Building`. I prefissi degli ID
seguono una convenzione (vedi §11): `R_` residenziali, `P_` produzione/laboratori,
`A_` culturali, `D_` decorazioni, `W_` edifici evento, `T_`/`Z_` casi particolari.
Nota: il catalogo CSV contiene gli edifici "di città"; i Grandi Edifici (`X_`),
militari (`M_`) e fabbriche beni (`G_`) **non** sono nel CSV ma arrivano dai dati di
gioco importati.

### 8.2 `allies.csv` — il catalogo degli alleati

Formato a punto e virgola. Colonne:

```text
Id; NomeIta; NomeEng; Rarity; MaxLevel; Val1;
GenAtk_A; GenDef_A; GenAtk_D; GenDef_D;
CampiAtk_A; CampiDef_A; CampiAtk_D; CampiDef_D;
SpedAtk_A; SpedDef_A; SpedAtk_D; SpedDef_D;
abilityIta; abilityEng
```

`abilityIta`/`abilityEng` sono la descrizione testuale dell'abilità speciale
dell'alleato, per lingua; vuote per la maggior parte degli alleati (solo alcuni hanno
un'abilità speciale documentata).

La colonna `Rarity` è **numerica** (1–5), lingua-neutra:

| Valore | Rarità |
|---|---|
| 1 | Comune (Common) |
| 2 | Non comune (Uncommon) |
| 3 | Raro (Rare) |
| 4 | Epico (Epic) |
| 5 | Leggendario (Legendary) |

`Val1` è il valore base usato per calcolare le statistiche per livello (vedi §14).

### 8.3 `ages.csv` — le ere del gioco

Formato: `id;age;NomeIta;NomeEng`. 23 ere, da id 0 (`StoneAge` / "Età della pietra")
a id 22 (`SpaceAgeSpaceHub`). L'`age` è il codice inglese usato internamente; i nomi
sono per la visualizzazione.

### 8.4 `events.csv` — mappatura eventi → edifici

Formato: `NomeEvento;token1,token2,...`. Ogni riga associa un evento del gioco a una
lista di **token**. Serve al filtro "mostra solo gli edifici di questo evento". Righe
speciali tipo `[ EVENTI 2026 ]` fungono da intestazione-gruppo per un anno.

Due tipi di token (gestiti da `buildingMatchesEvent` in App.tsx):

- **sottostringa** (es. `D24A1`): match con `includes`, case-insensitive;
- **`=` + ID intero** (es. `=A_MULTIAGE_BONUS1`): match **esatto** — è il fallback
  usato quando nessuna sottostringa è esclusiva dell'evento, e il match esatto evita
  i falsi positivi sui prefissi (`BONUS1` non deve matchare `BONUS10`). I token senza
  `=` degli events.csv precedenti restano validi (semantica substring invariata).

Il file è generato da `events.py` nella pipeline RECUPERO DATI (§8bis), lanciato
manualmente ~1 volta al mese; l'output va copiato a mano in `src/assets`. Vedi §23.

### 8.5 `kit.json` — catene di upgrade e selection kit

È il file che alimenta l'ottimizzatore (§16). Ha due sezioni:

- **`buildingUpgrades`**: un dizionario `kitId → { name, steps }`. Ogni `steps` è la
  sequenza completa di ID edificio che descrive l'evoluzione di un edificio attraverso
  i suoi livelli. Es. `upgrade_kit_maypole` ha `steps: [A_MultiAge_MayDayBonus16,
  A_MultiAge_MayDayBonus17, A_MultiAge_MayDayBonus17b]`. Uno step può essere un array
  (es. finale ramificato dove il giocatore sceglie una variante). Ci sono ~443 catene.
- **`selectionKits`**: un dizionario `kitId → { name, options }`. Ogni `options` è la
  lista di ID che quel kit di selezione può produrre. Ci sono ~407 selection kit.

I prefissi dei kit indicano il "tier": `golden_`, `silver_`, `platinum_`, oppure base.
Il tier va riconosciuto SOLO dal prefisso (così fa `kitTier` in inventory.ts): ~31
kit hanno token silver/gold altrove nell'id perché fanno parte del NOME
dell'edificio (`upgrade_kit_golden_crops` = Golden Crops) o di una variante di
livello degli insediamenti (`..._statue_gold`) — un match sul token ovunque li
scambierebbe per kit di tier.
Gli `shrink_kit_` sono kit di rimpicciolimento: riducono le dimensioni dell'edificio
conservandone la produzione, quindi ne aumentano l'efficienza — sono **kit di
aggiornamento a tutti gli effetti** (decisione di dominio, luglio 2026) e le loro 4
catene stanno in `buildingUpgrades` come le altre (una è a 2 step:
Expedition16 → Small → 24Tiny). Gli `selection_kit_epic_` sono kit jolly che offrono
opzioni di molte famiglie diverse.

### 8.6 `icons.ts` — icone inline

Contiene icone PNG codificate come data URI (stringhe base64), usate nelle tabelle
(es. icone per consumabili, frecce di aggiornamento). Essendo inline, non richiedono
richieste di rete e funzionano offline.

---

## 8bis. La pipeline dati esterna: `D:\FOE\RECUPERO DATI`

I file di `assets/` **non si scrivono a mano**: li genera una pipeline Python che vive
in `D:\FOE\RECUPERO DATI`, una cartella **fuori dal repo** dell'app (per lavorarci va
condivisa a parte). Questa sezione documenta la pipeline quanto basta per non violarne
i contratti dal lato app.

### 8bis.1 Le fonti

Con FoE Helper attivo, il gioco espone oggetti globali "lessicali" (dichiarati
`let`/`const`, quindi visibili in console ma NON proprietà di `window`): `MainParser`
(~70 MB, il database principale), `Allies` (da luglio 2026 **staccato** da
`MainParser` come oggetto a sé stante, stessa struttura interna con `meta`/`allyList`)
e `CityMap`. Un **bookmarklet dedicato dell'utente** (diverso dalla bacchetta magica
dell'app) scarica da ogni server i dump come file di testo:

- dal server **beta inglese** (`zz1.forgeofempires.com`): `MainParser.txt`,
  `Allies.txt` e il manifest **`ForgeHX-*.js`** (nome che cambia a ogni release del
  gioco; contiene il FileList con gli **hash immagine** di ~50k asset, da cui la
  colonna `Hash` di buildings.csv e quindi le immagini degli edifici);
- dal server **italiano** (`it6`): `MainParser_ita.txt` e `Allies_ita.txt` (solo per
  i nomi ITA; niente ForgeHX).

### 8bis.2 L'orchestratore: `AGGIORNA_DATI.bat` / `aggiorna_dati.py`

Il flusso normale dell'utente è: bookmarklet su zz1 → bookmarklet su it6 → doppio
click su `AGGIORNA_DATI.bat` (rinominato da `VAI2.bat`/`vai2.py` — il vecchio
`VAI.bat`, flusso manuale senza git, è stato eliminato: non serve più). Lo script:
pesca i file più recenti da `C:\Users\Sdrushi\Downloads` (rifiuta file più vecchi di
24h per non riusare download del giro prima; gestisce i nomi duplicati di Chrome tipo
`MainParser (1).txt`), li sposta in RECUPERO DATI eliminando i ForgeHX obsoleti,
esegue la pipeline con i suoi gate, copia i tre output (`buildings.csv`,
`allies.csv`, `kit.json`) in `src/assets/` del progetto e li archivia in `assets\`,
e infine — **solo se git vede differenze reali** nei tre file dati — fa git add +
commit e **chiede conferma interattiva (`s/N`) prima del push** (mostrando il
`git status --porcelain` delle differenze): se l'utente non conferma, il commit
locale resta ma non c'è push, quindi la GitHub Action di deploy non parte. Se
conferma, il push innesca la GitHub Action di deploy.

### 8bis.3 Gli script

Tutti gli script hanno **gate**: si fermano con errore invece di produrre output
vuoti o parziali (es. `allies.py` esce con errore se trova 0 alleati, invece di
scrivere un CSV vuoto che sembrerebbe un run riuscito).

- **`buildings.py`** — genera `buildings.csv` da MainParser + ForgeHX (nome storico:
  `city_entities_to_csv.py`, ancora citato così nei commenti di `BuildingModel.ts`).
  Il parser del FileList usa una scansione a graffe bilanciate (robusta
  all'annidamento), la stessa tecnica di `getIcons.py`.
- **`allies.py`** — genera `allies.csv` da `Allies.txt`/`Allies_ita.txt`. Il parsing
  tollera tre formati (nuovo `{"Allies":{...}}`, vecchio `MainParser.Allies`, oggetto
  bare — così funziona anche sui file d'archivio) e recupera gli alleati completi
  anche da file troncati.
- **`linnun.py`**, **`lin_inject.py`**, **`confronta_buildings.py`** — modello
  predittivo per la colonna `Lin` (db di training protetto `lin_training.db`); i nomi
  alleati arrivano dagli stessi file Allies.
- **`parse_kit.py`** — genera `kit.json`. ⚠️ Le `options` dei selection kit usano
  l'ID REALE dell'item (`upgradeItemId` per i kit, `cityEntityId` per gli edifici),
  NON `itemAssetName`: l'asset grafico è riusato da Inno tra item diversi e usarlo
  produceva 23 opzioni sbagliate su 20 kit (es. i kit "legend" che sembravano
  offrire kit Lunara/GR25C, o `upgrade_kit_chocolatery` al posto del vero
  `upgrade_kit_W_MultiAge_WIN22A` — era la causa a monte dell'"alias di
  compatibilità" in inventoryOptimizer.ts, oggi mantenuto solo come difesa). Bug
  corretto a luglio 2026: non regredire a `itemAssetName`.
- **`events.py`** — genera `events.csv` (token `=` inclusi, vedi §8.4 e §23). Fuori
  dai flussi automatici: lo lancia l'utente manualmente ~1 volta al mese, e richiede
  un `buildings_linnun_raw.csv` fresco (cioè un run recente di `aggiorna_dati.py`);
  l'output va copiato a mano in `src/assets`.
- **`getIcons.py`** — estrae le icone.

### 8bis.4 Il vincolo di coerenza con l'app

`extractMonMat` in `BuildingModel.ts` (§13) è la **traduzione fedele riga-per-riga**
dell'algoritmo Mon/Mat di `buildings.py`: il CSV statico e la città importata devono
restare coerenti *per costruzione*. Se si modifica l'algoritmo su un lato, va
modificato anche l'altro — non basta rigenerare il CSV.

---

## 9. Sistema multilingua

Il tool è progettato per supportare più lingue per i nomi di edifici, alleati ed ere.
Tre file collaborano.

### 9.1 `languages.ts` — la configurazione

Definisce:

- Il tipo `Lang` — l'unione dei codici lingua supportati (`"it" | "en" | "de" | ...`).
- `LANGUAGES` — l'array delle lingue, ognuna con `code` (es. `"it"`) e `csvColumn`
  (es. `"NomeIta"`): la colonna del CSV da cui leggere il nome in quella lingua.
- `FALLBACK_LANG` — la lingua di ripiego, `"en"` (inglese). Garantita sempre presente
  nei CSV.

**Concetto chiave:** le lingue possono essere *predisposte ma non popolate*. I CSV
attuali hanno solo `NomeIta` e `NomeEng`, quindi solo `it` ed `en` hanno dati reali.
Lingue come `de`/`es`/`fr` possono essere dichiarate in `LANGUAGES` ma, finché non
hanno una colonna nel CSV, restano semplicemente assenti dalle mappe e cadono sul
fallback inglese. Lato **app**, aggiungere una lingua richiede una riga in
`LANGUAGES` e nessun'altra modifica di codice; ma la ricetta COMPLETA coinvolge la
colonna `Nome*` in **tutti e tre** i CSV che leggono `LANGUAGES` — `buildings.csv`,
`allies.csv` e `ages.csv` (quest'ultimo editato a mano; gli altri due li genera la
pipeline di RECUPERO DATI, che a sua volta richiede un `MainParser_<lingua>.txt` dal
server corrispondente e l'estensione di `buildings.py`/`allies.py`, più
`parse_kit.py` per i nomi dei kit in `kit.json`). La lingua della GUI (`UiLang`,
solo it/en) è un concetto separato con la sua ricetta (§9 di ui-strings).

**Perché `Lang` ha 5 valori e non 2.** Il tipo `Lang` (`it|en|de|es|fr`) è "largo" per
DUE motivi distinti, non solo per i nomi CSV futuri:

1. *Nomi localizzati* (CSV) — descritto sopra: oggi solo `it`/`en` popolati.
2. *URL della wiki* — `BuildingModel.wikiUrl(name, lang)` usa il codice lingua
   **direttamente come sottodominio** (`${lang}.wiki.forgeofempires.com`). La wiki di
   FoE ha davvero `it.wiki`, `de.wiki`, `es.wiki`, `fr.wiki`, ecc., quindi tutti e 5 i
   valori sono URL reali e validi — non solo predisposizione.

**Ma a runtime le lingue effettive sono solo `it`/`en`.** Sia `gameLang` (tipizzato
`"it" | "en"` in `cityStore.ts`, clampato a riga ~1046 di `App.tsx`) sia `uiLang`
(tipo `UiLang = "it" | "en"` in `ui-strings.ts`) non assumono mai `de`/`es`/`fr`. Di
conseguenza il sottodominio wiki prodotto è di fatto sempre `it`/`en`: la capacità a 5
lingue è latente, non raggiungibile dall'utente finché non si estendono i clamp e i
dati. Questo spiega perché molte firme hanno `lang: Lang` ma in pratica ricevono solo
2 valori — è estensibilità intenzionale, non incoerenza.

### 9.2 `translations.ts` — la costruzione delle mappe

Espone quattro funzioni (più un re-export di `Lang` da `languages.ts`, importato da
`App.tsx` direttamente da qui):

- `initTranslations(buildings, allies)` — costruisce, per ogni lingua, una mappa
  `id → nome`. Mette edifici e alleati nella **stessa** mappa per lingua (i loro ID
  sono insiemi disgiunti — gli edifici hanno prefissi tipo `R_`, gli alleati nomi
  minuscoli come `alexander` — quindi non collidono). Le lingue senza dati non
  generano mappe vuote (vengono saltate). Va chiamata **una volta** all'avvio.
- `translateName(id, lang)` — traduce un ID nella lingua richiesta. Catena di
  fallback: lingua richiesta → inglese → ID grezzo.
- `getItalianMap()` — restituisce la mappa italiana completa, per accessi bulk O(1).
  Usata per ottenere il nome italiano "grezzo" di fallback degli edifici. ⚠️ È la
  mappa INTERNA viva (niente copia difensiva): sola lettura per contratto — l'unico
  consumer (`ITALIAN_NAMES` in App.tsx) fa solo `get`/`has`.

`initTranslations` VALIDA fail-fast la disgiunzione degli id: edifici e alleati
condividono la stessa mappa per lingua, e una collisione (oggi strutturalmente
impossibile: edifici `W_*`/`X_*`, alleati in snake_case minuscolo) farebbe vincere
silenziosamente il nome dell'alleato, inserito per ultimo. Stesso schema delle
validazioni al load di ages/allies/buildings.
- `hasTranslation(id, lang)` — `true` se esiste una traduzione **diretta** (non di
  fallback) per quell'ID in quella lingua. Usata in tab database per evidenziare in
  **corsivo** i nomi che ricadono sul fallback inglese (es. un edificio nuovo non
  ancora tradotto nella lingua corrente).

Internamente, `ensure()` fa da guardia: se le funzioni vengono chiamate prima di
`initTranslations`, logga un warning (in inglese, è diagnostica di programmazione) e
restituisce mappe vuote — i nomi degradano all'ID grezzo invece di crashare.

### 9.3 Come si lega tutto

In `App.tsx`, al livello modulo: prima si parsano i CSV (`BUILDINGS_FROM_CSV`,
`ALLIES_FROM_CSV`), poi si chiama `initTranslations(...)`. Le funzioni di
visualizzazione (`displayName` per gli edifici, `allyName` per gli alleati) usano
`translateName(id, gameLang)` per ottenere il nome nella lingua corrente.

`gameLang` (lo stato React della lingua) ha default `"it"`. Viene rilevato
automaticamente all'import (dal nome del municipio: se contiene "municipio" → `it`,
altrimenti → `en`). Così, senza città importata l'app è in italiano; importando una
città inglese, nomi di edifici/alleati/ere e rarità passano all'inglese.

> **Regola `gameLang` vs `uiLang` (quale lingua per quale nome).** Sono due lingue
> distinte e non vanno confuse:
> - **`gameLang`** = lingua dei *dati di gioco importati* (edifici, alleati, ere,
>   kit, nomi famiglia, rarità). Usala per qualsiasi nome che proviene dal gioco,
>   incluso nelle tab Città/Inventario/Alleati e nei tooltip che elencano kit/edifici.
>   I nomi-famiglia dell'optimizer sono già generati con `gameLang`
>   (`initKitData(KIT_RAW, gameLang)`), quindi i kit mostrati accanto devono usare la
>   stessa lingua per coerenza.
> - **`uiLang`** = lingua della *GUI* (etichette, tooltip statici, pulsanti, e i nomi
>   nella **tab Database**, che è un catalogo neutro non legato a un import).
>
> Il pattern ricorrente è `const isGameTab = activeTab === "propria_citta" || activeTab
> === "inventario"; ... isGameTab ? gameLang : uiLang`. Quando si aggiunge un nuovo
> punto che mostra un nome di gioco, seguire questa regola: se è un dato importato →
> `gameLang`.

---

## 10. Le ere del gioco (`ages.ts`)

**File:** `src/data/ages.ts`

Parsa `ages.csv` (una volta, all'avvio, perché importato per primo in `main.tsx`) e
costruisce le strutture per lavorare con le ere.

### Tipo `Age`
- `id` — numero progressivo (0–22). ⚠️ INVARIANTE CRITICA: coincide col `level`
  grezzo che il gioco assegna alle istanze in CityMapData — App.tsx fa
  `AGES_BY_ID.get(level)` per tutta la logica obsoleti/declassabili e le
  statistiche per-era. Non modificare la numerazione.
- `age` — codice inglese (es. `"SpaceAgeSpaceHub"`).
- `names` — mappa lingua→nome localizzato.

### Validazione fail-fast al load
Al caricamento del modulo (quindi al boot dell'app) vengono validati: id contigui
0..n-1 (che implica anche nessun duplicato, essendo l'array ordinato) e codici era
unici. I consumatori CONTANO su questa forma: `BuildingModel` ricava l'era
precedente con `id-1` (classificazione TR/TRNE) e il tooltip "se aggiorni" fa
aritmetica sulle differenze di id. Un CSV corrotto fa fallire il boot con un
errore diagnostico, non degradare in silenzio.

### Strutture esportate
- `FALLBACK_ERA` — il codice dell'era massima (id più alto). Usato ovunque serva
  un'era di default (es. per i fallback quando l'era reale non è nota).
- `AGES_BY_ID` — mappa `id → Age`. Lookup per id, più esplicito dell'accesso per
  indice di array; la contiguità NON è un'ipotesi da cui difendersi ma
  un'invariante validata (vedi sopra).
- `AGE_BY_CODE` — mappa `codice → Age`. Evita ricerche lineari sparse nel codice.
- `ageName(ageCode, lang)` — nome localizzato di un'era, con fallback a inglese e poi
  al codice grezzo.

L'utilità di `AGE_BY_CODE`/`AGES_BY_ID` emerge in `BuildingModel`: per classificare
le truppe come "era attuale" (`tr`) vs "era successiva" (`trne`), serve sapere qual è
l'era immediatamente precedente/successiva a quella data — si fa via id (`id-1`,
`id+1`).

Il modulo fa **fail-fast**: se `ages.csv` è vuoto o il parsing fallisce, lancia un
errore all'avvio invece di proseguire con dati corrotti. Il messaggio è in **inglese**
(`"ages.csv is empty or failed to parse"`): è un errore interno di programmazione, non
testo per l'utente finale, quindi segue la convenzione del progetto (come
`"initKitData not called"` in `inventoryOptimizer.ts`) di NON passare per la i18n.

> **Nota anti-regressione (parser).** Il parser NON ha bisogno di una guardia
> `if (lines.length === 0)` dopo lo `split(/\r?\n/)`: in JavaScript lo split di una
> stringa restituisce sempre almeno un elemento (`"".split(/\r?\n/)` → `[""]`), quindi
> quel ramo sarebbe irraggiungibile. Il caso di CSV vuoto è già gestito a valle: header
> degenerato → nessuna colonna trovata → loop che non produce righe → array vuoto →
> fail-fast. Non re-introdurre quella guardia "difensiva".

---

## 11. Classificazione degli edifici (`buildingClassification.ts`)

**File:** `src/data/buildingClassification.ts`

Questo file è la **sorgente di verità per tutti i pattern di ID** e le classificazioni.
Il principio: la conoscenza di "cosa significa un certo ID" vive in un solo posto, così
se Inno cambia una convenzione si tocca solo qui.

### Classificazione per prefisso ID
- `isGreatBuildingId(id)` — `true` se inizia con `X_` (Grande Edificio).
- `isMilitaryBuildingId(id)` — `true` se inizia con `M_` (edificio militare).
- `isGoodsFactoryId(id)` — `true` se inizia con `G_` (fabbrica di beni).
- `isInactiveBuildingId(id)` — `true` se l'id contiene `W_` e termina con `Decoration`
  (edificio evento declassato a ornamento).

Questi operano sull'ID a runtime. I GE/militari/fabbriche non sono nel CSV statico ma
arrivano dai dati di gioco, quindi queste funzioni servono per classificarli al volo.

### Insediamenti (`getSettlementInfo`)
Riconosce gli edifici degli **insediamenti culturali** (Vichinghi, Giappone, Egizi,
Aztechi, Mughal, Polinesia, Pirati) e ne restituisce **chiave-nome e icona**. La logica
usa una tabella di pattern con **regex precompilate** che delimitano i numeri (es.
`/CulturalBuilding2(?!\d)/` per non confondere `CulturalBuilding2` con
`CulturalBuilding20`). Restituisce `null` se non è un edificio di insediamento.

Il nome NON è testo localizzato ma una **chiave di traduzione** (`nameKey: UiKey`, es.
`"settlementVikings"`): finisce in un tooltip visibile, quindi va tradotto a
render-time. `App.tsx` lo risolve con `t(info.nameKey, uiLang)`. Per ottenere questo,
il modulo fa un solo `import type { UiKey }` da `ui-strings.ts` — dipendenza di
solo-tipo, cancellata a compile-time, quindi il modulo resta "neutro" a runtime e non
crea cicli (`ui-strings.ts` non importa nulla). L'`icon` è un emoji, lingua-neutro.

### Premi a tema
- `isBattlegroundsPrizeId(id)` — premio dei Campi di Battaglia di Gilda.
- `isQuantumIncursionsPrizeId(id)` — premio delle Incursioni Quantiche.

### Classificazione dei kit
- `isAscendedUpgradeKit(kitId)` — kit di aggiornamento "asceso"
  (`upgrade_kit_ascended_`).
- NOTA STORICA: esisteva un helper `isShrinkKit(kitId)` (`shrink_kit_`) usato da
  `parseInventory` per ESCLUDERE gli shrink kit dall'inventario, sull'assunto che
  "restringere non è aggiornare". L'esclusione è stata rimossa (luglio 2026: gli
  shrink sono upgrade a tutti gli effetti — riducono le dimensioni conservando la
  produzione) e l'helper con essa, rimasto senza consumatori. Il pattern
  lingua-neutro, se mai servisse di nuovo, è `kitId.startsWith("shrink_kit_")`.

### Frammenti
- `isFragmentBuildingToken(token)` / `isFragmentKitToken(token)` — riconoscono i token
  dei frammenti (di edificio vs di kit).
- `fragmentBuildingId(token)` — estrae l'ID edificio da un token frammento.

### Costanti chiave

**`CONSUMABLE_ASSET_NAMES`** — la mappa dei 9 consumabili dal nome-chiave interno al
nome-asset del gioco. È la fonte da cui `inventory.ts` deriva tutto:

```ts
{
  oneUpKit:           "one_up_kit",
  oneDownKit:         "one_down_kit",
  reversionKit:       "reversion_kit",
  renovationKit:      "renovation_kit",
  storeBuilding:      "store_building",
  rushEventBuildings: "rush_single_event_building_instant",
  rushMassSupplies:   "rush_mass_supply_large",
  rushGoodsBuildings: "rush_single_goods_instant",
  massSelfAidKit:     "motivate_all",
}
```

**`RARITY_FROM_GAME`** — mappa le rarità dal formato stringa del gioco (`common`,
`uncommon`, `rare`, `epic`, `legendary`) ai livelli numerici 1–5. Se Inno aggiunge o
rinomina rarità, si tocca solo qui.

**`BUILDING_ROW_COLORS`** / **`ROW_DISCONNECTED_OVERLAY`** — costanti di colore per le
righe della tabella (presentazione, ma centralizzate qui).

---

## 12. Parsing del CSV edifici (`buildings.ts`)

**File:** `src/data/buildings.ts`

Oltre all'interfaccia `Building` (§7), contiene il parser del CSV. **Solo
`parseBuildingsCsv` e `getImageUrl` sono esportati**; `parseCsvNumber`, `parseCsvRows`
e `roadFromSize` sono helper interni del modulo (più la costante `IMAGE_BASE_URL`).
Funzioni:

### `parseCsvNumber(value)`
Converte una stringa numerica del CSV in `number`. Il formato REALE del CSV è il
**punto decimale** (`"0.5"` — è la pipeline Python a scriverlo così; verificato:
807 decimali col punto, zero con la virgola); la gestione della virgola è una
**tolleranza deliberata**, non il formato atteso:
- virgola come separatore decimale: `"1,5"` → `1.5` (caso "CSV risalvato con
  Excel in italiano", che converte i decimali in virgole);
- separatori delle migliaia: `"1.234,5"` → `1234.5` (nessuna fonte li scrive);
- valori negativi, spazi, e stringhe non numeriche (→ `0`).

### `parseCsvRows(csvText)`
Un parser CSV completo che gestisce correttamente:
- separatori `;` dentro campi tra virgolette (preservati);
- escape delle virgolette (`""` → `"`);
- righe vuote (saltate);
- terminatori di riga sia `\n` sia `\r\n` (CRLF).

### `parseBuildingsCsv(csv)`
Trasforma l'intero CSV in un array di `Building` già pronti. Il callback del `.map()`
è tipizzato `(parts, index): Building` e il return NON usa `as Building`: il cast
(rimosso) disattivava il controllo strutturale di tsc sui campi mancanti proprio nel
punto 1 della checklist "nuovo campo" — con la tipizzazione esplicita, aggiungendo un
campo a `Building` tsc segnala anche questo punto, insieme a `createBaseBuilding` e
`placeholderBuilding`. Non reintrodurre il cast. Valida inoltre **fail-fast i
`cityEntityId` duplicati** (stesso schema di ages.ts/allies.ts): un duplicato
produrrebbe due righe in tab Database ma un last-wins silenzioso in
`BUILDING_BY_ID`/`CSV_ENTITY_IDS_SET`/traduzioni — e siccome la pipeline non può
generarli, segnala un CSV corrotto. Per ogni riga:
- legge i nomi nelle lingue disponibili (colonne `Nome*`) costruendo `names`;
- calcola `area` da `size` una volta sola;
- calcola `road` con `roadFromSize(size)` **solo se** la colonna `Road` del CSV è > 0
  (alcuni edifici non richiedono strada);
- assegna i flag di classificazione via `buildingClassification`;
- legge `Mon`/`Mat` (colonne subito dopo `BeniG` nel CSV, ma mostrate nella TABELLA
  all'inizio della sezione Produzioni — posizione CSV e posizione UI sono scelte
  indipendenti) e `IQmonB`/`IQmatB`/`IQmon`/`IQmat` (colonne subito dopo `IQDef_D`
  nel CSV, mostrate all'inizio della sezione IQ in tabella).

### `getImageUrl(id, hash)`
Costruisce l'URL dell'immagine dell'edificio dai due formati di hash possibili. Se
l'hash contiene un trattino, è già il nome file completo; altrimenti viene combinato
con l'id. Poi inietta `SS_` dopo il primo underscore e antepone l'URL base del CDN di
Inno (`IMAGE_BASE_URL`). Restituisce `null` se non c'è hash o l'id non ha underscore.

---

## 13. Il modello di dominio (`BuildingModel.ts`)

> **Coerenza TS↔Python validata (luglio 2026).** Tutti gli estrattori di questo
> modulo sono traduzioni fedeli riga-per-riga degli algoritmi di `buildings.py`
> (RECUPERO DATI). La coerenza è stata VALIDATA eseguendo `extractEraStats`
> sull'intero MainParser reale e confrontando 2046 edifici × 35 campi a SpaceHub
> col CSV: valori identici (esclusi i MANUAL_OVERRIDES del Python). Il test ha
> scovato e fatto correggere una divergenza reale: mancava in `extractGoods` il
> ramo `entity_levels`/`era_goods` (13 edifici produttivi `P_*` di eventi storici
> mostravano beni=0 in tab Città); aggiunto anche il ramo
> `RandomChestRewardAbility`-beni per fedeltà completa. Qualsiasi modifica agli
> estrattori (di qua o di là) va validata rieseguendo quel confronto.

**File:** `src/models/BuildingModel.ts`

Questo è il file più complesso del progetto dopo l'ottimizzatore. Il suo compito:
trasformare le **strutture annidate e irregolari** dei dati di gioco (`CityEntities`,
entry della mappa) in oggetti `Building` puliti. Forge of Empires rappresenta le
statistiche degli edifici in modi molto diversi a seconda del tipo di edificio e
dell'era, quindi questo modulo contiene molta logica di estrazione difensiva.

### 13.1 Il tipo `EraStats`

Rappresenta le statistiche di un edificio **per una specifica era**. Un edificio nel
gioco ha statistiche diverse a seconda dell'era; `EraStats` cattura quelle per l'era
che interessa (di norma l'era corrente del giocatore). Contiene popolazione, felicità,
i 4 blocchi di bonus militari (general/gbg/sped/iq), i bonus IQ scalari, e tutte le
produzioni (fp, beni, truppe, blueprint, furfanti, reward speciali).

### 13.2 I metodi factory

**`fromCityEntity(entityId, cityEntity, era, italianNames)`** — crea un `Building` da
una definizione di entità del gioco, per l'era specificata. È il percorso usato per gli
edifici della città che non sono nel catalogo CSV (i "fallback"). Estrae **tutte** le
statistiche reali (dimensioni, popolazione, felicità, bonus, e le produzioni — incluse
monete/materiali via `extractMonMat`) dalla struttura `components`/`entity_levels`/
`abilities`. Il flag `isFallback` resta `false` perché i dati sono completi (non è un
placeholder vuoto).

**`fromGreatBuilding(gb, italianNames, hash)`** — crea un `Building` da un Grande
Edificio. I GE hanno una struttura propria (`bonuses`, `state.current_product`). Estrae
i bonus militari (interpretando i tipi `military_boost`, `fierce_resistance`,
`advanced_tactics`) e le produzioni (punti forge, beni di vari tipi, truppe, felicità,
popolazione, monete/materiali). Per monete/materiali, legge
`state.current_product.name` (`"money"` o `"supplies"`) e il relativo
`product.resources.money`/`.supplies` — stesso blocco `forEach` sui `products` che già
gestisce `clan_goods`/`strategy_points`/`previous_era_goods`, un `else if` in più per
ciascuno. **Nota**: ad oggi nessun Grande Edificio ha bonus IQ (i campi
`iqMonB`/`iqMatB`/`iqMon`/`iqMat` restano sempre 0 per i GE, via
`createBaseBuilding`); se in futuro il gioco introducesse GE con questo tipo di bonus,
il punto di estensione è lo stesso (leggere `bonusType` e mappare sul campo IQ
corrispondente, vedi `BOOST_MAP` come riferimento per i nomi) — un commento "NOTA
FUTURA" nel codice, sopra la dichiarazione dei bonus militari, documenta esplicitamente
questo per chi tornerà a lavorarci.

**`createBaseBuilding(id, name)`** (privato) — crea un `Building` con tutti i valori a
zero/default, per evitare duplicazione nei factory.

### 13.3 La logica di estrazione delle produzioni

Questa è la parte più delicata. Il gioco espone le produzioni in **molti posti
diversi** all'interno di una entità, e il modulo li controlla tutti in ordine,
fermandosi al primo che fornisce un dato:

- `components.{era}.production.options` (preferendo l'opzione con durata 24h o quella
  con tempo massimo);
- `abilities` di vario tipo (`ChainLinkAbility`, `AddResourcesAbility`,
  `RandomChestRewardAbility`, ecc.);
- `chain.config.bonuses[].productions`;
- `entity_levels[].production_values` come ulteriore fallback.

**Valore atteso e probabilità (`dropChance`):** quando una produzione è "random" (un
forziere che dà un premio con una certa probabilità), il modulo calcola il **valore
atteso** moltiplicando l'ammontare per la probabilità. Esempio: un premio di 100 punti
forge con 50% di probabilità contribuisce 50. Questo vale per produzioni casuali di
punti forge, beni, e reward speciali.

**Helper di navigazione sicura:** poiché la struttura non è completamente tipizzabile,
il modulo usa helper privati (`asObj`, `asArr`, `num`, `str`) che navigano in sicurezza
strutture `unknown`, restituendo valori di default invece di lanciare errori su dati
mancanti o di forma inattesa.

### 13.4 Estrazione dei bonus militari

Il metodo `extractEraStats` raccoglie i "boost" da tutte le fonti possibili
(`components.{era}.boosts`, le `abilities`, i bonus di catena) e li mappa sulle colonne
giuste tramite `BOOST_MAP`. `BOOST_MAP` traduce i tipi di boost del gioco
(`att_boost_attacker`, `def_boost_defender`, ecc.) e il loro target (`all`,
`battleground`, `guild_expedition`, `guild_raids`) nelle colonne corrette di
general/gbg/sped/iq. Es. un `att_boost_attacker` con target `guild_expedition` va su
`SpedAtk_A`. Quattro entry aggiuntive coprono i boost monete/materiali IQ:
`guild_raids_coins_production`→`IQmonB`, `guild_raids_supplies_production`→`IQmatB`,
`guild_raids_coins_start`→`IQmon`, `guild_raids_supplies_start`→`IQmat` (stesso schema
di `guild_raids_goods_start`→`IQBeni`, target sempre `"all"`).

### 13.5 Altri helper

- `extractPlayerEraFromCityMap(cityMap)` — trova l'era corrente del giocatore leggendo
  l'era del municipio (sempre presente, id=1, con id `H_{era}_Townhall`).
- `computeRoad(cityEntity)` / `requiresRoad(...)` — fabbisogno stradale.
- `getCityEntitySize(...)` — dimensioni `[width, length]`. **Nota:** nel JSON del gioco
  x/y risultano invertiti rispetto alla convenzione della tabella, quindi la stringa
  size prodotta è `"LxW"` (lunghezza × larghezza).
- `wikiUrl(displayName, lang)` — costruisce l'URL della wiki FoE per la lingua data (la
  wiki ha un sottodominio per lingua: `it.wiki...`, `de.wiki...`).
- `extractGoods`, `extractProduction`, `extractRogues`, `extractBlueprints`,
  `extractReward`, `extractTrTrne`, `extractMonMat` — estrazioni specifiche per ogni
  tipo di produzione.

### 13.5bis `extractMonMat`: monete e materiali, traduzione da script esterno

A differenza delle altre funzioni di estrazione (scritte direttamente in TypeScript
seguendo i pattern del modulo), `extractMonMat` è una **traduzione fedele, riga per
riga**, di una funzione Python equivalente (`extract_mon_mat`) che vive in uno script
esterno al progetto: `buildings.py` nella pipeline RECUPERO DATI (§8bis; nome storico
`city_entities_to_csv.py`, ancora citato così nei commenti di `BuildingModel.ts`).
Quello script genera `buildings.csv` partendo da un dump offline del gioco
(`MainParser.txt`); questa funzione TypeScript fa lo stesso lavoro sui dati live del
bookmarklet (`CityEntityDefinition`), per le città importate. Le due fonti (CSV statico, sempre fissato all'era `SpaceAgeSpaceHub`, e città
importata, sull'era reale del giocatore) devono restare coerenti per costruzione: se
l'algoritmo Python cambia, va aggiornata anche questa funzione, e viceversa.

L'algoritmo, in tre passi (eseguiti in ordine, fermandosi al primo che produce un dato):

1. **`components` (stile nuovo).** Per `era`/`AllAge`: filtra le opzioni di produzione
   non `onlyWhenMotivated`, sceglie quella con `time` massimo se ce ne sono più di una,
   normalizza a 24h (`mult = 86400 / time`), somma `money`/`supplies` da
   `playerResources.resources`. Se l'opzione è di tipo `"random"`, itera le sotto-opzioni
   con `dropChance` (valore atteso pesato, stesso principio di `extractProduction`);
   se una sotto-opzione è `"genericReward"`, risolve l'importo tramite `lookup.rewards`
   dell'era (stesso pattern di `bpFromRewardId`).
2. **`entity_levels` (stile vecchio), solo se il passo 1 non trova nulla.** Cerca il
   livello dell'era corrente: se `ResidentialEntityLevel`, legge
   `produced_money`/`produced_supplies` normalizzati a 24h tramite `production_time` di
   `available_products`; se `ProductionEntityLevel`, legge l'ultimo elemento di
   `production_values` (lo slot 24h).
3. **`AddResourcesWhenMotivatedAbility`.** Risorse aggiuntive (es. edifici culturali con
   materiali "motivati") da `additionalResources[era]`, sommate sopra il risultato dei
   passi precedenti (non in alternativa: un edificio può avere sia produzione base che
   bonus da motivazione).

Validata con 9 test sintetici che coprono ogni ramo dell'algoritmo (normalizzazione di
durate diverse da 24h, scelta dell'opzione a tempo massimo, `random`+`dropChance`,
`genericReward` via lookup, entrambi i fallback `entity_levels`, fallback su `AllAge`,
nessuna produzione, `AddResourcesWhenMotivatedAbility`) — tutti passano sui dati reali.

> **Nota anti-regressione.** Il calcolo di area e dimensione esiste in **due** posti con
> scopi diversi e non vanno duplicati "per comodità": `getCityEntitySize` /
> `areaFromCityEntity`-style derivano le dimensioni dal componente `CityEntity` (usato
> nei factory di questo modulo), mentre il parsing della stringa `"WxH"` vive in
> `buildings.ts` (parser CSV). Alcuni helper "di comodo" su `BuildingModel`
> (`areaFromSize`, `isConnected`, `sizeLabelFromCityEntity`, `areaFromCityEntity`) sono
> stati **rimossi perché mai usati**: la connessione strada è calcolata inline dove
> serve (`Number(entry.connected ?? 0) >= 1` in `App.tsx`), e l'area dalla size si
> ricava già nei punti che ne hanno bisogno. Non re-introdurli senza un chiamante reale.


---

## 14. Parsing degli alleati (`allies.ts`)

**File:** `src/data/allies.ts`

Gestisce il catalogo alleati, l'import degli alleati posseduti, e il calcolo delle loro
statistiche.

### 14.1 Tipi

- **`Ally`** — un alleato dal catalogo (`allies.csv`): `id`, `names` (multilingua),
  `rarity` (1–5), `maxLevel` (oggi sempre 100 e non letto da nessun consumer, TENUTO
  deliberatamente perché Inno potrebbe variarlo), `val1` (valore base), i 4 blocchi
  di bonus (general/gbg/sped/iq) e `abilityIta`/`abilityEng` (descrizione
  dell'abilità speciale, vuota per la maggior parte degli alleati; CONTRATTO con la
  pipeline: il rendering mostra abilityIta senza fallback su abilityEng, perché è
  allies.py a garantire che l'italiana sia valorizzata quando esiste l'inglese).
  `parseAlliesCsv` valida fail-fast le righe duplicate `id+rarity`: un duplicato
  vincerebbe silenziosamente l'ultimo in `ALLIES_BY_ID_RARITY` ma verrebbe sommato
  DUE volte nell'ereditarietà, gonfiando le statistiche.
- **`ImportedAlly`** — un alleato posseduto dal giocatore: `jsonId`, `allyId`,
  `rarity`, `level`, `isPlaced` (se è piazzato in città), `isFragment` (se è solo un
  frammento, non ancora un alleato intero), `fragmentCount`, e
  `placedInMapEntityId?` — l'id grezzo dell'**istanza** sulla mappa (chiave in
  CityMapData) che ospita l'alleato: distingue QUALE copia specifica, tra più istanze
  dello stesso `cityEntityId`, e alimenta il filtro alleati per slot in App.tsx (la
  controparte lato mappa è `mapEntityId` in `CityMapBuilding`, §17).
- **`ComputedAllyStats`** — le statistiche calcolate (con ereditarietà): i 4 blocchi
  `computedGeneral/Gbg/Sped/Iq`.

### 14.2 Funzioni di parsing

- **`parseAlliesCsv(csv)`** — trasforma il CSV in array di `Ally`. Legge i nomi nelle
  lingue disponibili e la rarità numerica.
- **`parseAllyData(allyData, rarityMap)`** — parsa gli alleati posseduti dal payload di
  gioco. Usa `rarityMap` (`RARITY_FROM_GAME`) per convertire le rarità da stringa a
  numero. `mapEntityId` nel payload è un NUMERO (tipo `string | number` in `RawAlly`):
  è qui che viene convertito con `String()` nella chiave — stringa — di CityMapData;
  il guard è `!= null` (non `"in"`), così un ipotetico `mapEntityId: null` non produce
  `"null"` né un `isPlaced` spurio.
- **`parseAllyFragments(inventoryItems, rarityMap)`** — estrae gli alleati presenti
  come **frammenti** nell'inventario (non ancora alleati interi). `jsonId` è fisso a 0:
  il campo è richiesto dal tipo ma per i frammenti non è letto da nulla — la chiave
  React in tabella è `frag-${id}-${rarity}` (in passato qui c'era un hash della chiave
  `allyId__rarity`, rimasto orfano quando la key è cambiata e quindi rimosso). Scarta i
  frammenti con `inStock <= 0`.

### 14.3 Calcolo delle statistiche

**`getAllyStatValue(multiplier, ally, level)`** — calcola il valore di una statistica a
un dato livello. La formula riflette una particolarità del gioco: i livelli 1–62
seguono `val1 + level - 1`, mentre dal livello 63 in poi seguono `val1 + level` (Inno
ha introdotto un +1 extra oltre il livello 62, costante `LEVEL_BREAKPOINT = 62`). Il
risultato è `multiplier * baseValue`.

**`getComputedAllyStats(ally, level, inheritedAlliesMap)`** — calcola le statistiche
totali di un alleato includendo le **ereditarietà di rarità inferiore**. In Forge of
Empires, un alleato di rarità alta "eredita" i bonus delle versioni di rarità inferiore
dello stesso alleato. La funzione recupera tutti gli alleati ereditati (da
`inheritedAlliesMap`, indicizzato su `allyId__rarity`) e somma i loro contributi per
ogni categoria e indice.

### 14.4 Costanti di rarità

- **`RARITY_DISPLAY`** — per ogni livello di rarità (1–5), i metadati di
  visualizzazione: nomi (it/en), etichetta (es. "UNC" per non comune), numero di
  stelle, colori. Usato dall'interfaccia.
- **`RARITY_LEVELS`** — `[1, 2, 3, 4, 5]`.
- **`rarityName(rarity, lang)`** — nome localizzato di una rarità.

> **Nota i18n.** I nomi di rarità usano campi `nameIt`/`nameEn` dentro `RARITY_DISPLAY`,
> non chiavi di `ui-strings.ts`. È una scelta consapevole: `RARITY_DISPLAY` è "l'unico
> punto che conosce nomi, colori, stelle ed etichette per rarità", e tenere nome+estetica
> insieme è più coeso che spezzare i nomi verso `ui-strings`. Non viola la regola
> "logica multilingua lingua-neutra" perché la *classificazione* avviene per numero di
> rarità (neutro); solo la *resa* del nome usa nameIt/nameEn (con `lang !== "it"` →
> inglese, che è anche il fallback corretto per de/es/fr). Le sole 5 rarità, stabili nel
> tempo, rendono il guadagno di una migrazione trascurabile.

---

## 15. Parsing dell'inventario (`inventory.ts`)

**File:** `src/data/inventory.ts`

È una **funzione pura** che trasforma gli item grezzi dell'inventario in strutture
classificate. Non tocca React né `localStorage`.

### 15.1 Tipi

- **`InventoryEntry`** — un edificio in inventario: `cityEntityId`, `name`, `inStock`,
  `rawEntry`.
- **`SelectionKitEntry`** / **`UpgradeKitEntry`** — un kit in inventario: `kitId`,
  `name`, `inStock`, `rawEntry`. Sono strutturalmente identici ma tenuti come tipi
  distinti per chiarezza di dominio (un selection kit e un upgrade kit sono concetti
  diversi).
- **`SpecialKits`** — i conteggi dei 9 consumabili, più i loro nomi opzionali (es.
  `oneUpKit: number`, `oneUpKitName?: string`). I 9 campi numerici corrispondono
  esattamente alle chiavi di `CONSUMABLE_ASSET_NAMES`: `oneUpKit`, `oneDownKit`,
  `reversionKit`, `renovationKit`, `storeBuilding`, `rushEventBuildings`,
  `rushMassSupplies`, `rushGoodsBuildings`, `massSelfAidKit`.
- **`ParsedInventory`** — il risultato del parsing: `matched`, `unmatched`,
  `selectionKits`, `upgradeKits`, `specialKits`.
- **`InventoryStore`** — la forma serializzata in `localStorage`.

### 15.2 `parseInventory(items, csvIdsSet)`

Itera gli item dell'inventario e li classifica. La logica procede per tipo:

1. **Consumabili** (riconosciuti dal campo `itemAssetName` che corrisponde a uno dei 7
   in `CONSUMABLE_ASSET_NAMES`): un blocco table-driven somma le quantità nei campi di
   `SpecialKits`. Il nome viene memorizzato alla prima occorrenza. **L'ordine conta:**
   questo controllo viene per primo e usa un match **esatto** (non una sottostringa),
   così un selection kit che ha anch'esso un `itemAssetName` (es. `selection_kit_*`)
   non viene confuso con un consumabile.
2. **Selection kit** (`__class__ === "SelectionKitPayload"`): aggiunti alla mappa
   `selectionKits` con la loro quantità.
3. **Upgrade kit** (`__class__ === "UpgradeKitPayload"`): aggiunti a `upgradeKits`,
   **shrink kit INCLUSI** (sono upgrade a tutti gli effetti: riducono le dimensioni
   conservando la produzione → più efficienza; in passato erano esclusi con un filtro
   `isShrinkKit`, rimosso — vedi nota storica in inventory.ts e §11). Grazie
   all'inclusione l'ottimizzatore li usa nelle fabbricazioni e il modal "Edifici
   aggiornabili" li conta davvero (prima risultavano sempre ×0).
4. **Edifici** (`__class__ === "BuildingItemPayload"`): smistati in `matched` (se l'id
   è nel CSV) o `unmatched` (se no). I due insiemi sono **disgiunti per costruzione**.

**Filtro `stock <= 0` uniforme.** Tutti e quattro i tipi scartano le entry con
quantità ≤ 0: un item non realmente posseduto non va contato. Per i kit questo è
particolarmente importante perché `computeAllFamilies` determina le famiglie "toccate"
guardando le **chiavi** di `invSel`/`invUpg` (non i valori): una entry con quantità 0
farebbe risultare la famiglia costruibile mostrando una riga spuria. Il default per
`inStock` assente è 1 (= "una copia"); solo uno 0/negativo esplicito viene scartato.

---

## 16. Il cuore del tool: l'ottimizzatore inventario (`inventoryOptimizer.ts`)

**File:** `src/data/inventoryOptimizer.ts`

Questa è la funzione **distintiva** del tool, ciò che lo rende unico tra i tool per
FoE: data la collezione di kit e edifici in inventario, calcola **tutto ciò che è
realmente costruibile**, a quale livello massimo, e con quali kit.

### 16.1 Il problema che risolve

In Forge of Empires, un edificio può evolvere attraverso una **catena di livelli**
applicando **kit di aggiornamento** (upgrade kit). Inoltre, i **kit di selezione**
(selection kit) permettono di ottenere un edificio scelto tra varie opzioni, a un certo
"tier" (base, argento, oro, platino). Un giocatore con un inventario pieno di kit
diversi si trova davanti a una domanda non banale: **cosa posso effettivamente
costruire, e fino a che livello?**

La risposta richiede di:
- raggruppare gli edifici in "famiglie" (catene evolutive correlate);
- capire, per ogni famiglia, quali kit posseduti coprono quali livelli;
- allocare i kit in modo da massimizzare il livello raggiungibile;
- gestire correttamente i kit di tier diverso, i set multi-edificio, e i kit jolly.

### 16.2 Concetti fondamentali

**Catena (chain) e step.** Ogni `buildingUpgrades` in `kit.json` descrive una catena:
una sequenza di ID edificio (`steps`) che rappresenta l'evoluzione completa di un
edificio attraverso i suoi livelli. Uno "step" è una transizione da un livello al
successivo.

**Famiglia (mega-chain).** Più catene possono concatenarsi (la fine di una è l'inizio
di un'altra). L'ottimizzatore le unisce in **mega-catene**, ognuna identificata da un
"root" (l'edificio di partenza che non è la fine di nessun'altra catena). Ogni edificio
appartiene a **esattamente una** famiglia (partizionamento deterministico, verificato:
nessun edificio è raggiungibile da più root).

**Tier dei kit.** I selection kit hanno tier: base, argento (`silver_`), oro
(`golden_`), platino (`platinum_`). I tier più alti offrono cumulativamente più
opzioni, formando tipicamente una **catena per inclusione** (le opzioni del base sono
un sottoinsieme di quelle dell'argento, ecc.).

**Capability set.** Per ogni selection kit, l'insieme di ID della famiglia corrente che
quel kit può produrre. La struttura a tier fa sì che queste capability set siano
solitamente annidate, definendo dei "livelli" di copertura.

### 16.3 L'inizializzazione (`initKitData`)

Chiamata una volta all'avvio. Costruisce gli indici globali a partire da `kit.json`:

- **`buildMegaChain`**: un DFS che, partendo da ogni root, esplora tutte le catene
  concatenate per costruire le mega-catene. La struttura dati reale di FoE garantisce
  catene corte e fan-out minimo, quindi questo è veloce e termina sempre (non ci sono
  cicli nel grafo delle catene — verificato).
- **`BLD_TO_ROOT`**: mappa ogni edificio al root della sua famiglia.
- **`KIT_TO_ROOTS`**: mappa ogni kit alle famiglie (root) che tocca. Un kit jolly può
  toccare molte famiglie. Costruita con una BFS che attraversa le catene.
- **`resourceDedicated`** e le strutture per i selection kit per famiglia.

**Nome della famiglia (`familyName`).** Il nome mostrato per ogni famiglia è il **nome
reale del kit**, risolto nella lingua corrente (`KIT_LANG`) via `kitDisplayName`
(stesso schema di fallback di `translateName`: lingua richiesta → inglese → vuoto). Si
sceglie il selection kit che produce il root come base con **meno opzioni** (il più
"basilare": i tier alti includono le opzioni dei bassi, quindi ne hanno di più). Se
nessun selection kit produce il root direttamente, fallback sul nome del kit di upgrade
con la catena più lunga. Il nome viene mostrato **per intero, senza rimuovere prefissi**
(es. "Kit selezione Aeronave", non "Aeronave"): una precedente funzione `cleanName`
toglieva i prefissi italiani hardcoded, ma non era lingua-neutra (i nomi inglesi hanno
"Selection Kit" come suffisso, non prefisso, quindi restavano intatti) — è stata rimossa
in favore del nome reale, coerente in tutte le lingue.

### 16.4 Il calcolo dei livelli (`computeLevels`)

Per una famiglia, prende le capability set dei selection kit rilevanti e le ordina per
dimensione, assegnando un "livello" a ciascuna catena annidata. Quando una capability
set **non** si annida (è della stessa dimensione di un'altra ma con contenuti diversi),
viene trattata come **pool dedicato**.

**I pool dedicati** non sono un caso raro: capitano per i **set tematici multi-edificio**
di FoE (es. il "Celtic Forest Set" che offre più edifici distinti della stessa
famiglia). Questi kit producono capability set non confrontabili per inclusione, e
vengono gestiti in modo conservativo: utilizzabili **solo** per le risorse nella loro
capability set, mai come sostituti flessibili verso l'alto. Questa scelta è sempre
corretta (un kit che offre {A,B} non può coprire un fabbisogno {C} che non possiede).

### 16.5 L'ottimizzazione per famiglia (`optimizeFamily`)

Il cuore algoritmico. Per ogni famiglia, dato l'inventario posseduto, alloca i kit per
costruire il massimo. La strategia è **massimizzare il livello**: prova prima a
costruire gli edifici al livello più alto possibile, poi scende.

Due funzioni interne fanno il lavoro:
- **`hasEnough(srcStep, tgtStep, needBase)`** — verifica (in simulazione, senza mutare
  lo stato) se i kit disponibili coprono le transizioni da `srcStep` a `tgtStep` (più
  l'eventuale base). Paga i fabbisogni di livello più alto per primi, usando il kit più
  economico sufficiente.
- **`doPay(...)`** — come `hasEnough`, ma muta lo stato reale e registra i nomi dei kit
  consumati.

Il loop principale itera i livelli target dal più alto al più basso, e per ciascuno
costruisce quanti più edifici possibile finché ci sono kit (`while hasEnough → doPay`).

**Performance:** per non riallocare strutture a ogni iterazione del loop (che su
inventari grandi può fare decine di migliaia di chiamate), i buffer di lavoro
(`simWs`, `simWfFlex`, `needByLevel`, `simDedicated`) sono **pre-allocati una volta per
famiglia** e resettati in-place. Inoltre `tryResourceSingle` evita di allocare un array
wrapper per il caso comune (un solo ID per step). Queste ottimizzazioni riducono la
pressione sul garbage collector senza cambiare il risultato.

### 16.6 La semantica dei kit (cruciale da capire)

**Upgrade kit = +1 livello per copia.** Un kit di aggiornamento, quando applicato a un
edificio, lo fa salire di **un livello**. La catena `steps` in `kit.json` descrive il
**percorso completo** dell'edificio attraverso i suoi livelli, ma ogni applicazione del
kit (ogni copia posseduta) avanza di una sola transizione. Esempio: un edificio a
livello 1 con 4 copie dello stesso upgrade kit sale a livello 5. Questo riflette
esattamente la meccanica di FoE (gli upgrade kit sono consumabili monouso da +1
livello).

**Conservazione esatta dei kit.** L'ottimizzatore non "inventa" mai kit: il numero di
kit consumati corrisponde sempre a quanti ne sono posseduti, all'interno di ogni
famiglia. Un kit in eccesso (oltre il livello massimo raggiungibile) semplicemente non
viene usato.

**Kit jolly / epici (comportamento voluto).** I kit `selection_kit_epic_*` offrono
opzioni di **molte famiglie diverse**. L'ottimizzatore mostra, per **ogni** famiglia
che il kit tocca, cosa potrebbe produrre lì. Quindi un singolo epic kit appare come
"costruibile" in più famiglie contemporaneamente. **Questo è intenzionale:** il tool
mostra il *potenziale* completo per ogni famiglia, e l'utente sa che un epic kit è una
scelta esclusiva (può usarlo una volta sola, per una famiglia). La conservazione
*per singola famiglia* è sempre rispettata.

### 16.7 L'output e `buildInvRows`

`computeAllFamilies(invUpg, invSel, invBld)` è la funzione pubblica.

> ⚠️ **Contratto di mutazione:** `invUpg` viene **CONSUMATA** (mutata in place) durante
> l'ottimizzazione — `buildInvRows` decrementa le quantità dei kit di upgrade man mano
> che vengono applicati agli edifici in inventario, e il consumo si propaga tra
> famiglie successive nello stesso giro. `invSel` e `invBld` sono invece solo lette.
> Il chiamante deve quindi passare Map **costruite fresche** ad ogni chiamata (come fa
> il `useMemo` `familyResults` in App.tsx), mai una Map condivisa con lo stato React o
> riusata tra chiamate: riusarla produrrebbe risultati diversi al secondo giro con lo
> stesso inventario.

Restituisce un array di `FamilyResult`, uno per famiglia toccata. Ogni risultato
distingue:

- **`output`** — edifici **costruibili da zero** usando i kit (es. da selection kit che
  forniscono la base). Ogni riga ha livello, quantità, gli ID degli edifici prodotti,
  e i kit usati.
- **`invRows`** — edifici **già in inventario** (fisici), eventualmente fatti salire di
  livello usando gli upgrade kit posseduti. `buildInvRows` gestisce la salita di
  livello degli edifici fisici, applicando i kit uno step alla volta finché ce ne sono.

Una riga è marcata `is_max` quando l'edificio ha raggiunto il livello massimo della sua
catena.

### 16.8 Robustezza

L'ottimizzatore gestisce con grazia tutti i casi limite: quantità 0, ID inesistenti
(kit o edifici fantasma), quantità enormi (migliaia di kit), e inventari completi.
Nessun input valido lo manda in crash, e le performance restano nell'ordine delle
decine di millisecondi anche su inventari molto grandi.


---

### 16.x Limiti noti del modello e proprietà validate (audit luglio 2026)

Audit empirico completo sull'ottimizzatore reale con kit.json corrente:

**Proprietà VALIDATE** (property-test): conservazione dei kit per-famiglia e
determinismo su 200 inventari casuali (0 violazioni); "un upgrade kit da solo non
crea mai nulla" su tutti i 457 kit; inventario massimale (282 famiglie) elaborato in
~26ms. Assunzioni strutturali verificate sui dati: nessuna catena inerte (<2 step),
nessun ciclo nel grafo delle catene (`buildMegaChain` non ha guardia anti-ciclo: se
mai servisse, va aggiunta in parse_kit.py lato pipeline, non nell'ottimizzatore),
nessun edificio che apre una catena ed è insieme step intermedio di un'altra.

**Famiglie sintetiche per opzioni "standalone" e "livello finale"** (luglio 2026).
Due tipi di opzione dei selection kit non sono rappresentabili nel ramo delle
famiglie-catena, e vengono gestiti da un blocco dedicato in `computeAllFamilies`
che emette UNA famiglia sintetica per kit posseduto (`root` = id del kit, nome =
nome del kit):

- **standalone** (`SK_STANDALONE_OPTIONS`): edifici fuori da ogni catena (26 kit
  nel censimento: set decorativi, kit-scelta di pezzi evento come
  `selection_kit_ANNI24CD`) → un gruppo `{ level: 1, is_max: true }`;
- **livello finale** (`SK_FINAL_OPTIONS`): edifici che sono l'ULTIMO step di una
  catena e da cui nessuna catena prosegue (`LAST_TO_CHAINS` sì, `FIRST_TO_CHAINS`
  no — es. `celtic_trees` → Salice Liv.2, `FALL24CE/DF` → versioni "Migliori", le
  statue dei golden legend A3/B2) → gruppi al loro livello assoluto (calcolato da
  `depthOf`, risalita memoizzata delle catene), `is_max: true`, senza pagamento di
  step: in gioco il kit dà l'edificio già al massimo.

Ogni gruppo ha `qty` = copie del kit e `kitsUsed = [kitId × qty]`. Il consumer in
App crea una riga per opzione con la quantità piena (3 kit → 3 Salici E 3 Pietre) —
stessa convenzione "potenziale per famiglia/opzione" dei kit epici; il tooltip
"Scelta:" elenca le alternative via `_fabChoices`. Con più gruppi nello stesso kit,
kitsUsed per gruppo è potenziale, NON consumo cumulativo: le famiglie sintetiche
sono esenti dalla proprietà di conservazione per-famiglia (che vale per le famiglie
reali). Le opzioni in-catena non-finali dello stesso kit continuano dal ramo
normale (un kit misto compare in entrambi). Validato con differenziale su 300
inventari casuali: famiglie preesistenti byte-identiche, famiglie extra tutte e
sole quelle sintetiche attese. Nota: le opzioni con prefisso `L_` sono escluse da
buildings.csv → la riga si appoggia al fallback CityEntities (creato all'import via
`addChainFrom(opt)`) o al placeholder UNKNOWN.

**Limite residuo: opzioni "edificio a livello INTERMEDIO"** (livello da cui una
catena PROSEGUE): in `optimizeFamily` l'insieme R contiene solo kit + edifici BASE,
quindi l'opzione non matcha mai (cap vuota), e le famiglie sintetiche la escludono
deliberatamente (materializzarla richiederebbe l'interazione col loop di upgrade —
l'unità creata a livello k potrebbe poi salire con altri kit). Unico caso reale:
l'opzione-statua `M_AllAge_LSO25A2` di `selection_kit_silver_legend_a` (da A2
prosegue la catena golden); le statue dei golden legend (A3/B2) sono livelli FINALI
e funzionano via famiglia sintetica, e l'opzione-kit di tutti e tre i legend
funziona nel ramo normale dopo il fix di parse_kit.py (§8bis). Censimento: 8 kit
senza output solo-run = 7 "solo upgrade kit" (corretti per costruzione) +
silver_legend_a.

Nota sul criterio di misura dell'audit: il test "kit posseduto da solo → zero
output" segnala come silenziosi anche 7 kit che offrono SOLO upgrade kit (es.
`selection_kit_epic_ASC24`/`_ASC25`, i tre `serpent_chain_*`, i due
`*_selection_kit_GR25C`). NON è un problema: è il comportamento corretto per
costruzione (gli upgrade non creano) e in combinazione con l'edificio base quei kit
funzionano e compaiono regolarmente nell'inventario.

---

## 17. I tipi della mappa città (`cityMap.ts`)

**File:** `src/data/cityMap.ts`

Un modulo di **soli tipi** (nessuna logica) per la visualizzazione della mappa città.

- **`CityMapBuilding`** — un edificio piazzato sulla mappa: `entityId`, `name`,
  coordinate `x`/`y`, dimensioni `w`/`h`, `type` (es. `"street"`, `"main_building"`), e
  i flag `isGreatBuilding`, `isMilitary`, `isNeedlessRoad` (strada inutile),
  `isInactive`, `isSuppliesProducer` (produttore di materiali). Questi flag sono
  obbligatori (sempre valorizzati alla costruzione, che avviene in un solo punto).
  Include anche `mapEntityId` — l'id grezzo dell'**istanza** sulla mappa (chiave in
  CityMapData), distinto da `entityId` (che è il tipo di edificio, uguale per più
  copie): permette di associare una specifica copia al proprio alleato piazzato
  (`placedInMapEntityId` in §14).
- **`CityMapBounds`** — i confini della griglia: `minX`, `minY`, `maxX`, `maxY`. Usati
  per dimensionare e posizionare la mappa.

`CityMapBuilding` è una vista distinta da `Building`: ha le coordinate e i flag della
mappa, ma non le decine di statistiche di gioco. Sono due viste diverse dello stesso
dominio, deliberatamente separate.

⚠️ **Contratto di persistenza.** `CityMapBuilding[]` viene serializzato COSÌ COM'È nei
profili (`CityStore.cityMapBuildings`) e ripristinato grezzo, senza revive né
migrazione (solo un `Array.isArray` in App.tsx). Aggiungere un campo è sicuro: nei
profili vecchi arriva `undefined` — falsy per i booleani (degradazione dolce, es.
niente colore dedicato finché non si re-importa), e per `mapEntityId` fa scattare il
fallback aggregato di `allySlotsPerBuilding` (§24). Rinominare un campo o cambiarne
il tipo invece rompe silenziosamente i profili salvati: valutare
`STORAGE_FORMAT_VERSION` (§21).

---

## 18. Lo store serializzato della città (`cityStore.ts`)

**File:** `src/data/cityStore.ts`

Un modulo di **soli tipi**. Descrive la forma di `CityStore`, l'oggetto che viene
serializzato in `localStorage` quando si importa una città. Poiché `Map` e `Set` non
sono serializzabili direttamente in JSON, i campi-mappa sono memorizzati come array di
coppie `[chiave, valore]` (rianimati con `reviveMap` al caricamento).

⚠️ **Contratto di scrittura ed evoluzione.** `writeStoredJson` accetta `unknown`,
quindi il letterale di scrittura in `handleImportCityMap` è verificato con
`satisfies CityStore` (e quello dell'inventario con `satisfies InventoryStore`): senza,
un campo dimenticato o con typo compilerebbe e persisterebbe profili incompleti in
silenzio — mantenere il `satisfies` quando si aggiunge un campo. Aggiungere campi è
sicuro per i profili vecchi (i reader fanno revive con default: campo assente → Map/Set
vuoto); rinominare o cambiare tipo li rompe → valutare `STORAGE_FORMAT_VERSION` (§21).

Campi principali:

- `cityEntityIds` — `entityId → numero di istanze in città`. Le chiavi sono ID grezzi
  dal payload (non normalizzati).
- `cityEntityDisconnected` — edifici scollegati dalla strada.
- `cityEntityNeedlessCount` — edifici con strada inutile.
- `cityMapBuildings` / `cityMapBounds` / `cityMapGrid` / `cityMapUnlockedCells` — i
  dati per il rendering della mappa.
- `greatBuildingsJson` — i Grandi Edifici (`entityId → GreatBuilding`).
- `matchedJson` / `unmatchedJson` — gli edifici della mappa, divisi tra quelli nel CSV
  e quelli no.
- `fallbackBuildings` — gli edifici costruiti da `CityEntities` (non nel CSV).
- `currentEra` — l'era corrente del giocatore.
- `eraStats` — statistiche per era di ogni entità.
- `entityLevels` — livello minimo in città per ogni entità (l'era dell'edificio,
  0–22). Chiavi: ID grezzi.
- `entityLevelsList` — la lista completa di tutti i livelli presenti per ogni entità
  (per mostrare quante copie sono indietro di quante ere).
- `entityInstanceEraStats` — statistiche di produzione raggruppate per era, per
  calcolare totali esatti quando le copie di un edificio sono in ere diverse.
- `gameNames` — nomi originali dal gioco (`entityId → nome`), nella lingua del client
  del giocatore.
- `gameLang` — la lingua rilevata dal gioco (`"it"` o `"en"`; default `"it"` se il
  rilevamento non riesce).
- `declassableBuildings` — array di coppie `[entityId, { popCurr, popBronze,
  statsBronze }]` (serializzato come array per compatibilità JSON; rianimato come
  `Map<string, …>` in `App.tsx` via `reviveMap`). Contiene gli edifici evento (`W_`)
  in città privi di bonus rilevanti, per cui la versione Età del Bronzo equivale in
  output ma costa meno popolazione. Mostrato come badge ▼ in toolbar; attiva il
  filtro `showOnlyDeclassable`; hover apre tooltip con risparmio pop e kit richiesti.
- `portraitUrl?` — URL CDN dell'avatar del giocatore (es.
  `"https://foeit.innogamescdn.com/assets/shared/avatars/portrait_359-xxx.jpg"`).
  Opzionale: assente nei profili importati con bookmarklet precedenti all'introduzione
  del campo. In toolbar mostra l'immagine; se assente mostra un avatar segnaposto con
  tooltip che invita ad aggiornare il bookmarklet.

> **Nota architetturale.** `cityStore.ts` importa `EraStats` e `GreatBuilding` da
> `models/BuildingModel.ts` — una dipendenza `data/ → models/` che va contro la
> convenzione generale ("`data/` non dipende da `models/`"). È una violazione
> **consapevole e localizzata**: `cityStore.ts` è un puro descrittore di forma
> persistente (nessuna logica), e tenere questi tipi vicino alla loro logica di
> estrazione (`extractEraStats`, `fromGreatBuilding`) è preferibile a duplicarli.
> Verificato che **non crea cicli**: `BuildingModel.ts` non importa `cityStore.ts`, la
> dipendenza è unidirezionale.

---

## 19. Calcolo dell'efficienza (`calculator.ts`)

**File:** `src/utils/calculator.ts`

Calcola il punteggio di efficienza di un edificio. È in `utils/` (non in
`buildings.ts`) perché descrive **come valutare** un edificio, non cosa sia.

### Il tipo `Weights`

I pesi che l'utente assegna a ciascuna categoria di bonus militari. Quattro blocchi,
ognuno con 4 valori (corrispondenti a AttAtt, DifAtt, AttDif, DifDif):

- `general` — bonus generali.
- `gbg` — Campi di Battaglia di Gilda.
- `sped` — Spedizioni di Gilda.
- `iq` — Incursioni Quantiche.

### `calculateEfficiency(building, weights)`

La formula:

```text
efficienza = (Σ bonus pesati) / (area + road)
```

dove la somma dei bonus pesati è il **prodotto scalare** di ciascun blocco di bonus
dell'edificio con il corrispondente blocco di pesi, sommato sui 4 blocchi:

```text
totalStats = dot4(general, w.general) + dot4(gbg, w.gbg)
           + dot4(sped, w.sped)     + dot4(iq, w.iq)
```

Il risultato è arrotondato a 1 decimale. Se lo spazio totale (`area + road`) è ≤ 0,
l'efficienza è 0 (evita divisione per zero). L'idea: più valore militare per cella di
spazio occupato = edificio più efficiente.

---

## 20. Formattazione numerica (`format.ts`)

**File:** `src/utils/format.ts`

Funzioni pure di formattazione, zero dipendenze. Tutte rispettano la convenzione
italiana (virgola per i decimali, punto per le migliaia):

- **`isStaleField(value)`** — rileva se un campo manca da un profilo salvato PRIMA
  che fosse introdotto (vecchio `localStorage` senza quella chiave: arriva
  `undefined`/`null` dopo `JSON.parse`, non `0`). Ritorna `true` anche per `NaN`,
  perché un'operazione aritmetica su un valore stale propaga `NaN` senza restare
  `undefined` (es. `general[i] + gbg[i]` nelle colonne "Σ" se `general[i]` è
  stale: il risultato è un `NaN` di tipo `number`, non più `undefined`). **Non**
  considera stale uno `0` legittimo — è la distinzione cruciale: un edificio che
  davvero non produce quella risorsa deve continuare a mostrare "-", non un
  avviso. Usata da `StaleFieldCell` e da `BoostCell` in `App.tsx` (vedi §24) per
  mostrare un'icona di avviso invece di propagare `NaN` visibile in tabella.
- **`formatInt(value)`** — interi con separatore delle migliaia: `1234` → `"1.234"`.
  Gestisce i negativi.
- **`formatEff(value)`** — efficienza: intero se possibile, altrimenti 1 decimale con
  virgola.
- **`formatDecimal(value, digits=1)`** — decimali con virgola e migliaia. Gestisce
  correttamente i negativi (es. `-0.5` → `"-0,5"`, non `"0,5"`).
- **`formatProdNum(value)`** — produzione numerica: `"-"` se zero, altrimenti 1
  decimale.
- **`formatProdPercent(value)`** — percentuale: `"-"` se zero, altrimenti intero con
  `%`.
- **`formatProdK(value)`** — produzioni con valori grandi (Monete, Materiali, CAP/Azioni
  IQ): `"-"` se zero, `"k"` arrotondato all'**intero più vicino** (`Math.round`, non
  troncamento: `632750` → `"633k"`, non `"632k"` né `"632,8k"`) per `|value| ≥ 1000`,
  altrimenti `formatInt`. **Sostituisce l'ex `formatCapActions`** (era usata solo per
  `iqCap`, dava un decimale per i non-multipli di 1000 invece di arrotondare
  all'intero): rimossa dopo aver verificato che tutti i valori reali di `iqCap` nel CSV
  sono multipli esatti di 1000 (quindi `formatProdK` dà lo stesso risultato per i dati
  esistenti). Usata per `iqCap`, `iqMon`, `iqMat`, `mon`, `mat`.

---

## 21. Persistenza e localStorage (`storage.ts`)

**File:** `src/utils/storage.ts`

Tutta la logica di persistenza è centralizzata qui.

### 21.1 Versioning delle chiavi

Esiste una costante `STORAGE_FORMAT_VERSION` (attualmente **2**). Tutte le chiavi
includono il suffisso `_vN`:

```text
foe_global_profiles_v2
foe_global_active_profile_v2
foe_p_<profileId>_city_v2
foe_p_<profileId>_inventory_v2
foe_p_<profileId>_allies_v2
```

Più altre chiavi globali per le impostazioni: difesa, spedizioni
(abilitate/attacco), sigma, colonne pop/fel/IQ-prod/produzioni, mappa aperta, vista
database, lingua UI, e `DISMISSED_ANNOUNCEMENTS_KEY` — chiave **unica** per gli
annunci one-off dismissibili in home: il valore è un array di ID di annuncio già
chiusi dall'utente (più annunci nel tempo condividono questa singola chiave; es.
`bookmarklet-v2-allies-2026-07`, vedi §6.1). L'ID di un annuncio già pubblicato non
va mai cambiato, o riapparirebbe a chi l'ha chiuso.

**Rotazione versione:** incrementare `STORAGE_FORMAT_VERSION` invalida automaticamente
tutte le chiavi delle versioni precedenti. I dati vecchi non vengono più letti e
vengono ripuliti. Questo evita migrazioni silenziose rischiose: si preferisce un
azzeramento pulito e consapevole.

- **`isStorageOutdated()`** — rileva se esistono dati di versioni precedenti (per
  avvisare l'utente prima di una pulizia distruttiva).
- **`cleanupOrphanedKeys()`** — rimuove tutte le chiavi `foe_` che non appartengono né
  alla versione corrente né a un profilo valido corrente.

### 21.2 Compressione

Le chiavi di profilo (`foe_p_...`) contengono dati grossi (città intera con tutte le
statistiche). Vengono **compresse con pako (gzip)** e codificate in base64 prima del
salvataggio. Le chiavi globali (piccole) non vengono compresse.

- **`readStoredJson(key, fallback)`** — legge, decomprime se necessario, fa il parse
  JSON. Restituisce il fallback su qualsiasi errore (chiave assente, JSON corrotto).
- **`writeStoredJson(key, value)`** — serializza, comprime se necessario, salva.
  Ritorna **`boolean`**: non rilancia in caso di errore (tipicamente quota piena), ma
  logga un warning e restituisce `false`. I chiamanti che devono reagire a un
  salvataggio fallito (es. `mergeImportedProfiles` con `failedKeys`) controllano il
  valore di ritorno; gli altri possono ignorarlo.

### 21.3 Rianimazione di strutture

`localStorage` salva solo stringhe; `Map` e `Set` non sopravvivono al JSON. Quindi:

- **`reviveMap(entries)`** — ricostruisce una `Map` da un array di coppie.
- **`reviveSet(values)`** — ricostruisce un `Set` da un array.

### 21.4 Caricamento

- `initCityStore(profileId)`, `initInventoryStore(profileId)`,
  `initAlliesStore(profileId)` — caricano i tre blocchi di un profilo.
- `loadProfiles()` / `getActiveProfileId(profiles)` — caricano la lista profili e
  determinano quello attivo.

### 21.5 Import/Export profili

- **`collectFoeLocalStorage()`** — raccoglie tutte le chiavi `foe_` in uno snapshot
  (per l'export su file JSON).
- **`mergeImportedProfiles(snapshot, fallbackProfileName?)`** — importa profili da uno
  snapshot, fondendoli con quelli esistenti (vedi §22). Il secondo parametro dà il
  nome ai profili importati senza nome: storage.ts non ha accesso a `uiLang`/`t()`,
  quindi il chiamante (App.tsx) passa la versione localizzata (`defaultProfileName`);
  il default `"Profilo N"` resta solo come rete di sicurezza.

---

## 22. Profili

Un **profilo** rappresenta uno stato separato dell'utente (es. mondo beta vs mondo
live, o account diversi). Ogni profilo ha tre blocchi indipendenti: città, inventario,
alleati.

### Comportamento

- All'avvio **non esiste alcun profilo di default**.
- Il primo profilo viene creato solo quando si importa col bookmarklet, oppure quando
  si carica un file JSON di profili.
- Eliminare i profili non ne ricrea uno vuoto.

### Import da file JSON (`mergeImportedProfiles`)

I profili nel file vengono **aggiunti** a quelli correnti (non sostituiti). La funzione
è robusta su diversi fronti:

- **Versione diversa:** cerca la chiave profili in qualsiasi versione presente nello
  snapshot (non solo quella corrente), così non rifiuta file più vecchi/recenti.
- **Collisioni di ID:** se un id importato è mancante o in conflitto con uno esistente,
  ne genera uno nuovo. La mappa di rimappatura è indicizzata sull'**indice dell'array**
  (sempre univoco), non su `profile.id` (che potrebbe essere vuoto/duplicato per più
  profili, causando collisioni).
- **Riscrittura chiavi:** i blob compressi dei profili (gzip+base64 di JSON) restano
  validi indipendentemente dalla versione di storage, e vengono ricollocati sotto il
  suffisso di versione corrente. **Caveat documentato nel codice:** questo assume che
  la *forma interna* del JSON non sia cambiata; se un futuro bump di
  `STORAGE_FORMAT_VERSION` cambiasse la forma dei dati (non solo le chiavi), servirebbe
  una migrazione esplicita.

L'export salva un file `foe-optimizer-YYYY-MM-DD.json`.

---

## 23. Eventi (filtro per evento)

**Dati:** `src/assets/events.csv`. **Logica:** in `App.tsx`.

Il CSV mappa ogni evento del gioco a una lista di **token** (frammenti di ID edificio).
`EVENTS_LIST` viene costruito parsando il CSV: ogni riga diventa una `EventEntry` con
`id` univoco (nome + anno corrente), `name`, `tokens`, e un flag `isGroup`.

Le righe del tipo `[ EVENTI 2026 ]` sono **intestazioni-gruppo**: segnano l'anno
corrente e raccolgono tutti i token di quella riga (così si può filtrare per "tutti gli
edifici del 2026").

`buildingMatchesEvent(cityEntityId, event)` verifica se un edificio appartiene a un
evento, gestendo i **due tipi di token** (vedi §8.4): un token che inizia con `=` è un
confronto **esatto** con l'ID intero (fallback anti-falsi-positivi: `BONUS1` non deve
matchare `BONUS10`), un token senza `=` è un match `includes` case-insensitive come in
passato (retrocompatibile con gli events.csv precedenti). Permette all'utente di
filtrare la tabella per mostrare solo gli
edifici di un certo evento.

---

## 24. Orchestrazione: `App.tsx`

**File:** `src/App.tsx`

È il componente unico che orchestra tutto: stato React, wiring tra parser/storage/
modelli, e rendering (la UI è fuori ambito qui). Contiene un solo grande componente
`App()` con decine di hook.

### 24.1 Inizializzazione a livello modulo

Prima ancora del montaggio del componente, al livello modulo vengono eseguite le
costruzioni costose una volta sola: parsing dei CSV
(`BUILDINGS_FROM_CSV`/`ALLIES_FROM_CSV`), `initKitData`, `initTranslations`, e la
costruzione di vari indici globali (`BUILDING_BY_ID`, `CSV_ENTITY_IDS_SET`,
`INHERITED_ALLIES_MAP`, `ALLIES_BY_ID_RARITY`, `FRAGMENT_*_PRODUCERS`, le strutture dei
kit `KIT_NAMES`/`SELECTION_KITS_BY_UPGRADE`/`BUILDING_UPGRADE_OPTIONS`/`BLD_ALL_CHAINS`,
ecc.). Essendo costanti immutabili, non hanno bisogno di vivere dentro hook.

### 24.2 Helper di dominio top-level

Prima del componente sono definiti vari helper: `displayName`/`allyName`/`kitName`/
`eventName` (localizzazione nomi, tutti con fallback lingua→inglese→id),
`detectBrowserUiLang` (lingua GUI di default dal browser quando localStorage è vuoto),
`chainOffset`/`chainInfo` (calcolo livello/max_level di un edificio nella sua catena,
con memoizzazione e prevenzione cicli), `computeUpgradeBadge` (calcola se un edificio è
aggiornabile coi kit in inventario), `buildDiffFields`, e le funzioni di ordinamento
alleati (`allySortValue`, `compareAllies`).

> **Nota.** I nomi dei kit sono mostrati **per intero** ovunque, inclusi i pannelli
> debug della tab inventario. Una precedente funzione `simplifyKitName` accorciava i
> nomi italiani (es. "Kit selezione X" → "sel. X") ma, come `cleanName` nell'optimizer,
> non era lingua-neutra (riconosceva solo prefissi italiani) — è stata rimossa in favore
> del nome reale, coerente in tutte le lingue.

### 24.3 Lo stato e la catena di `useMemo`

Il componente ha ~73 `useState` (profili, lingua, pesi, filtri, impostazioni, dati
importati, stato UI) e ~40 `useMemo` che trasformano i dati a cascata. I passaggi
chiave della pipeline di trasformazione:

- `processedBuildings` / `processedGreatBuildings` / `processedFallbackBuildings` —
  edifici del catalogo, GE, e fallback, ciascuno arricchito con l'efficienza calcolata.
- `familyResults` — il risultato di `computeAllFamilies` (l'ottimizzatore), memoizzato
  sulle 4 mappe dell'inventario.
- `processedInventoryKitBuildings` — i `FamilyResult` appiattiti in righe di tabella.
- `filterSourceBuildings` / `eraAdjustedSource` / `filteredBuildings` — l'applicazione
  progressiva di filtri, aggiustamento per era, e ordinamento.
- `cityBuildings` / `cityUpgradeBadges` — gli edifici della città reale con i loro
  badge.

Stato aggiuntivo caricato da `CityStore` all'import:
- `declassableBuildings: Map<string, { popCurr, popBronze, statsBronze }>` — calcolato
  durante l'import; identifica gli edifici evento che conviene portare a Età del Bronzo.
  Badge ▼ contatore in toolbar; filtro `showOnlyDeclassable`; tooltip hover con risparmio
  popolazione e kit necessari (`oneDownKit` / `reversionKit`).
- `portraitUrl: string` — URL avatar, mostrato nella toolbar (fallback: segnaposto con
  tooltip che invita ad aggiornare il bookmarklet).

`exactBuildingSum` (definito dentro il rendering della tab statistiche) calcola somme
esatte tenendo conto che le copie di un edificio possono essere in ere diverse.

**Semantica dell'override era (`applyEraStats`) — comportamento voluto.** Nelle tab
Città e Inventario l'override è **totale**: boost militari/IQ, pop, fel e ogni
produzione vengono sostituiti con i valori dell'**era corrente del giocatore**, anche
per le copie di ere precedenti. La riga è quindi il *potenziale alla propria era*; la
precisione per-copia vive nel triangolino "obsoleto" (tooltip col confronto era
vecchia → corrente) e nel riepilogo PROD+STAT (somme esatte per era via
`entityInstanceEraStats`). Per esplicitarlo, l'header di gruppo "📦 PRODUZIONI" nella
sola tab Città mostra "(valori di <era>)" (`prodValuesOfEra` +
`ageName(currentEra, gameLang)`). Non "correggere" la riga per mostrare l'era reale
della copia: la decisione è stata presa consapevolmente con l'utente (luglio 2026).

**Altre aggiunte recenti da conoscere (luglio 2026):**

- **Ricerca con debounce** — `setDebouncedSearchTerm` + `prevSearchTermRef`: il
  filtro testo non rielabora la tabella a ogni tasto.
- **Filtro "Store building"** — `showStoreBuildingBuildings` in `TabFilters`
  (default `true`): se disattivato, esclude gli edifici con `imm > 0`.
- **Filtro alleati per slot** — usa `mapEntityId` (§17) / `placedInMapEntityId`
  (§14) per associare ogni copia specifica al proprio alleato.
- **Pulsante Help** — nella barra tab, apre `/guida.html` o `/guide.html` (guida
  online in `public/`, fuori bundle) secondo `uiLang`.
- **Annunci one-off dismissibili** — `dismissedAnnouncements`/`dismissAnnouncement`,
  persistiti in `DISMISSED_ANNOUNCEMENTS_KEY` (§21.1); esempio reale in §6.1.
- **Avviso bookmarklet obsoleto** — all'import, se `_v` del payload <
  `CURRENT_BOOKMARKLET_VERSION` (§6.1), alert `bookmarkletOutdatedAlert`.
- **Popup immagine con chiusura ritardata** — timer
  `scheduleImagePopupClose`/`cancelImagePopupClose`: il mouse può attraversare lo
  spazio tra trigger e pannello (e copiare nome/ID) senza che il popup si chiuda.
- **`SortableHeader` con prop `noGap`** — rimuove il gap icona/freccia SOLO nelle 20
  colonne strette della sezione Produzioni.

### 24.3bis `BuildingRow`: la riga della tabella principale, estratta e memoizzata

La tabella principale (tab Database/Città/Inventario) può mostrare centinaia di righe
(`filteredBuildings`, fino a ~2000 nel catalogo completo, tipicamente 200-800 dopo i
filtri). Il rendering di ciascuna riga — colore di sfondo per categoria, nome con link
wiki, badge (great building, inventario, disconnesso, kit upgradabile, frammenti,
obsoleto...), celle boost militari/IQ, colonne produzione — è stato estratto dal
`.map()` inline di `App` in un componente modulo-level dedicato, **`BuildingRow`**,
avvolto in `memo()` (stesso pattern di `BoostCell`/`MilitaryBoostCells`, già presenti
nel file prima di questa estrazione).

**Perché esiste come componente separato.** Prima dell'estrazione, l'intero blocco JSX
della riga (~460 righe) viveva inline dentro `App`: qualunque `setState` in `App` (es.
apertura di un modal non legato alla tabella) faceva ri-renderizzare l'intera lista,
anche quando nessun dato della riga era cambiato. Estraendo la riga in un componente
`memo()`-izzato, Preact può saltare il re-render delle righe le cui prop non sono
cambiate per identità/valore.

**La regola delle prop (vedi invariante #11 nella skill).** Perché la `memo()` sia
efficace, le prop NON possono essere le Map/Set di stato di `App` (cambierebbero
identità ad ogni `setState` che le ricrea, es. `setSelectedIds(new Set(...))`).
`BuildingRowProps` riceve invece valori già "risolti" per quel singolo edificio:

- `isSelected: boolean` — al posto di `selectedIds: Set<string>`
- `isHighlighted: boolean` — al posto di `highlightedCityEntityIds: Set<string>`
- `disconnectedCount`, `needlessCount`, `importedCount: number` — al posto delle Map
  corrispondenti (`cityEntityDisconnected`, `cityEntityNeedlessCount`,
  `importedCityEntityLookup`)
- `greatBuildingInfo`, `gameDisplayName`, `upgradeBadge`, `minLevel`,
  `allLevelsForEntity`, `instanceEraStats` — letture puntuali (`.get(b.cityEntityId)`)
  fatte dal genitore, non Map intere
- `fragmentsProduced` — lettura puntuale dalla costante modulo-level
  `FRAGMENTS_PRODUCED` (cityEntityId → lista di ciò di cui l'edificio PRODUCE
  frammenti: edifici e/o kit, dalla colonna Fragments del CSV). Alimenta il
  badge (icona `iconFragment`, asset ufficiale Inno — non più l'emoji 🧩,
  sostituita a luglio 2026 per coerenza visiva col resto delle icone di
  gioco); il tooltip elenca i prodotti (nomi risolti con displayName/kitName
  in uiLang) e ripete la stessa icona nel titolo. ⚠️ Semantica cambiata a luglio 2026: prima il badge mostrava chi
  produce frammenti DI quell'edificio / quali selection kit lo producono —
  informazione già coperta dalla modale Edifici Aggiornabili, quindi
  ribaltata. La vecchia mappa inversa `FRAGMENT_BUILDING_PRODUCERS` è stata
  rimossa; `FRAGMENT_KIT_PRODUCERS` (kit → edifici produttori) resta e serve
  la modale Edifici Aggiornabili.

  **⚠️ Tecnica anti-allargamento-riga per icone `<img>` inline nel testo
  (bug reale corretto, luglio 2026):** sostituire un'emoji con un'icona PNG
  in mezzo a testo di tabella allarga l'altezza della riga di 1-3px, anche
  con `vertical-align`/`line-height` tarati a mano sull'img o sullo span che
  la contiene. Causa reale (misurata empiricamente con
  `getBoundingClientRect` in un browser vero, non a intuito — i primi 3
  tentativi con `align-top`/`align-middle`/`leading-[0]` sull'uno o l'altro
  elemento NON hanno funzionato): un'immagine `position:absolute` non
  contribuisce mai al flusso, ma lo SPAN-ancora (`position:relative`) che la
  contiene sì, se ha un'altezza propria — è il box dello span stesso a
  "spingere" il line-height, indipendentemente da come è allineata l'img al
  suo interno. **Soluzione:** lo span-ancora deve essere alto solo 1px
  (`h-px`, larghezza reale mantenuta per l'hitbox orizzontale del tooltip),
  con `vertical-align: top` (non `middle`: con uno span 1px, "middle" lo
  centra sull'x-height del testo spingendo l'icona fuori dalla cella);
  l'`<img>` dentro è `absolute inset-0` con le dimensioni reali (`h-4 w-4`)
  e un eventuale offset verticale voluto va con `top-[Npx]` sull'IMG, non
  sullo span. Pattern verificato a 0.00px di differenza (badge 🧩→
  `iconFragment` in `BuildingRow`, cella `.cell-name`): riusarlo per
  qualunque icona PNG futura inserita in mezzo a testo di tabella, non
  reintrodurre `align-middle`/`leading-[0]` su span 16×16 pensando che
  bastino.

Le callback (`handleCityRowClick`, `toggleSelect`, `setImagePopup`,
`setUpgradeTooltip`, `setOutdatedTooltip`, `setFragmentTooltip`, `setFabTooltip`,
`getPropDisplay`) restano funzioni passate come prop e sono **tutte a identità
stabile**: i setter di `useState` lo sono per contratto React, le altre sono
`useCallback` o (come `getPropDisplay`, pura) costanti modulo-level.

**⚠️ La trappola dei fallback `?? []` (bug reale trovato e corretto, luglio
2026).** Basta UNA prop a identità instabile per vanificare l'intera `memo()`:
la shallow-compare fallisce e la riga si ri-renderizza comunque. Il call-site
aveva tre fallback `?? []` inline (`instanceEraStats` e le due prop frammenti
di allora) che creavano un array NUOVO ad ogni render per ogni riga senza dati
(la maggioranza), più `getPropDisplay` definita nel corpo di `App` (ricreata
ad ogni render): risultato, ogni `setState` di `App` — aprire un tooltip,
l'hover su 👁️, un modal — ri-renderizzava TUTTE le righe, come se
l'estrazione non esistesse. Fix: `getPropDisplay` spostata a livello modulo e
fallback sostituiti da costanti modulo-level (oggi `EMPTY_ERA_GROUPS` /
`EMPTY_FRAGMENTS`). Validato empiricamente montando l'App instrumentata
(jsdom + contatore di render in `BuildingRow`, tab Database con 822 righe):
prima del fix l'apertura del modal About ri-renderizzava 822 righe (e il mount
iniziale le renderizzava due volte, 1644, per il setState delle metriche di
scroll al primo paint); dopo il fix, 822 render al mount e **0** re-render.
Regola operativa: nel call-site di `<BuildingRow>` niente letterali inline
(`?? []`, `?? {}`, arrow function) — solo lookup, primitivi, costanti modulo o
funzioni stabili.

**Tipi spostati a livello di modulo.** Per poter scrivere la firma di
`BuildingRowProps` fuori da `App`, i tipi `ProcessedBuilding`, `InventoryRowBuilding`
(prima `interface` locale dentro `App`), `TabType`, `FilterType`, `TabFilters` (prima
`type` locali dentro `App`) sono stati spostati a livello di modulo. Sono puri alias di
tipo senza dipendenze da closure, quindi lo spostamento è stato sicuro e non ha
richiesto altre modifiche.

**Cosa NON risolve.** La memoizzazione di `BuildingRow` riduce i re-render *successivi*
al mount (es. un click su un checkbox non tocca più le altre righe), ma non riduce il
costo del **mount iniziale**: la prima creazione di centinaia di nodi `<tr>` resta
comunque cara, perché ogni componente — memoizzato o no — deve essere costruito una
volta. Per intervenire sul Total Blocking Time/tempo di mount andrebbe introdotta la
**virtualizzazione** (rendere solo le righe visibili nello scroll + un buffer), opzione
discussa e per ora scartata: introdurrebbe rischio di micro-scatti durante lo scroll
rapido (priorità esplicita dell'utente sopra il punteggio Lighthouse) su una tabella già
complessa (colonne condizionali, scrollbar orizzontale flottante sincronizzata). Se la
si dovesse rivalutare in futuro, partire da un proof-of-concept isolato, non dalla
tabella reale.

### 24.3ter La struttura tabellare: `<colgroup>`, `colSpan` e header, tre punti
indipendenti che vanno tenuti a mano sincronizzati

La tabella principale ha un'intestazione a due righe (`<thead>` con due `<tr>`): la
prima riga raggruppa le colonne in macro-sezioni colorate con etichetta (es. "GEN",
"INCURSIONS", "PRODUCTIONS") usando `<th colSpan={N}>`; la seconda riga ha l'header
vero di ogni singola colonna (`SortableHeader`). Sopra la tabella, un `<colgroup>`
dichiara la larghezza di ogni colonna con un `<col>` per colonna, nello stesso ordine.

**Sono tre punti del codice completamente indipendenti**, e nessuno dei tre valida gli
altri due automaticamente:

1. Il `colSpan={N}` del `<th>` titolo di sezione nella prima riga `<thead>`.
2. Il numero di `<SortableHeader>`/`<th>` nella seconda riga `<thead>` per quella
   sezione (deve corrispondere a N).
3. Il numero di `<col>` nel `<colgroup>` per quella sezione (deve corrispondere anch'esso
   a N) — righe ~4974-4994 per la tabella principale, generati con
   `Array.from({ length: N }).map(...)` raggruppati per sezione (es. `iq-mm` per le 4
   colonne monete/materiali IQ, `iq-ad` per le 4 atk/def, `iq-extra` per
   beni/truppe/azioni, una `<col>` singola per CAP, `prod-*` per la sezione Produzioni).

**Il bug reale che ha rivelato questo problema** (sessione di aggiunta dei campi
Monete/Materiali): aggiungendo 4 colonne alla sezione IQ e 2 alla sezione Produzioni, i
punti 1 e 2 erano stati aggiornati correttamente (colSpan e header coincidevano, `tsc`
non segnalava nulla), ma il punto 3 (`<colgroup>`) era stato dimenticato. Risultato:
**bug puramente visivo, invisibile a `tsc`/`vite build`/`eslint`** — con meno `<col>`
dichiarati delle colonne reali, il browser assegna le larghezze dichiarate alle prime
colonne e lascia le ultime (tipicamente l'ultima colonna della sezione, es. `iqCap`)
senza una `<col>` propria, con una larghezza di fallback diversa. Visivamente, l'ultima
colonna della sezione sembra "scivolare fuori" dal contenitore colorato del gruppo,
anche se i dati nella cella sono corretti e nella posizione `<td>` giusta — il sintomo
è puramente di layout, non di dati.

**Diagnosi:** se una sezione della tabella appare visivamente "sfasata" (colore di
sfondo del gruppo che non combacia con le colonne sottostanti, una colonna che sembra
appartenere alla sezione successiva), contare a mano `<col>` vs colonne reali per quella
sezione PRIMA di sospettare un errore nel `colSpan` o negli header — è il punto più
facile da dimenticare perché concettualmente "lontano" dalle altre due modifiche
(si trova in una porzione di JSX separata, righe ~4974-4994, lontana dagli header che
si trovano centinaia di righe più sotto). Vedi anche invariante #12 nella skill.

### 24.3quater Colonne con toggle di visibilità, dati "stale", e flag globali

Tre meccanismi distinti aggiunti/estesi nella stessa sessione, documentati insieme
perché interagiscono nello stesso punto della tabella (la sezione IQ).

**Toggle di visibilità con divider mobile.** Il pulsante "IQ Monete/Materiali"
(`showIqProdColumns`, colori Sigma/cyan, off di default) nasconde/mostra le 4 colonne
`iqMon`/`iqMonB`/`iqMat`/`iqMatB`. Quando nascoste, il divider visivo (`border-l
border-slate-800`) che normalmente sta su `iqMon` deve "passare" a `iqBeni` (il nuovo
primo elemento visibile della sezione) — gestito con una className condizionale su
*entrambi* l'header e la cella body di `iqBeni`: `` `th-col${showIqProdColumns ? "" :
" border-l border-slate-800"}` ``. Questo è un **quarto** punto di sincronizzazione
oltre ai tre dell'invariante #12 (colSpan/header/colgroup): quando si aggiunge un
toggle di visibilità a un gruppo di colonne, va sempre verificato se il divider deve
spostarsi, e se sì va aggiornato sia nell'header sia nel body (un punto aggiornato e
l'altro dimenticato produce uno sfasamento visibile solo a metà — nella riga
intestazione o nelle righe dati, non in entrambe).

**Dati "stale" da vecchi profili (`isStaleField`, vedi anche §20).** Aggiungere un
campo a `Building` rompe silenziosamente i profili già in `localStorage`: il campo
manca nell'oggetto deserializzato (`undefined`), e la formattazione aritmetica a valle
produce `NaN` visibile in tabella. Soluzione: `StaleFieldCell` (componente
modulo-level, come `BoostCell`) wrappa una `<td>` e mostra `⚠️` con tooltip
(`t("staleDataWarning", uiLang)`) se `isStaleField(value)`, altrimenti renderizza i
`children` già formattati dal chiamante. `BoostCell` ha lo stesso controllo integrato
direttamente (non delega a `StaleFieldCell`) perché gestisce anche le somme "Σ"
(`general[i] + gbg[i]`): se un addendo è stale, l'addizione produce `NaN` (non
`undefined`), e `isStaleField` riconosce anche questo caso — la propagazione funziona
automaticamente senza bisogno di controlli aggiuntivi nei punti che calcolano
`sigmaGbg`/`sigmaSped` in `MilitaryBoostCells`. Applicato a tutte le ~29 celle
scalari della tabella principale (IQ, Produzioni, Pop, Fel) e ai boost militari/IQ
tramite `BoostCell`/`Boost4`/`MilitaryBoostCells` (tutti estesi con un parametro
opzionale `uiLang?: UiLang` per propagare il tooltip).

**Flag globali invece di per-tab (`showPopColumn`/`showFelColumn`).** Erano dentro
`TabFilters` (stato per-tab); su richiesta esplicita dell'utente sono stati spostati a
`useState` globali dedicati, stesso pattern di `showSigmaColumns`: chiave
`localStorage` propria (`POP_COLUMN_KEY`/`FEL_COLUMN_KEY`/`IQ_PROD_COLUMNS_KEY` in
`storage.ts`), persistiti nello stesso `useEffect` di `showSigmaColumns`. Conseguenza
non ovvia: **`BuildingRow` è un componente modulo-level, non vede le variabili `App`
per closure** — un flag globale nuovo va sempre aggiunto esplicitamente a
`BuildingRowProps`, destrutturato nella firma del componente, e passato nella chiamata
`<BuildingRow .../>` dentro il `.map()`, esattamente come già avviene per
`showSigmaColumns`/`spedizioniEnabled`. Da notare anche un meccanismo preesistente
distinto: `showTimeColumn`/`showProdColumns` restano dentro `TabFilters` ma si
comportano già come "globali mascherati", sincronizzati su tutte le tab tramite un
controllo speciale dentro `updateFilter` (`if (key === "showTimeColumn" || key ===
"showProdColumns")`) — un pattern diverso e più vecchio dello stesso problema, non
unificato con i nuovi `useState` dedicati per scelta (cambiare quello esistente non
era necessario per questa richiesta).

### 24.3quinquies Ricerca per ID (feature di debug nascosta)

Il campo di ricerca supporta una modalità nascosta: se il testo inizia con `\`,
la stringa successiva viene cercata nel `cityEntityId` invece che nel nome.
Es. `\FALL` mostra tutti gli edifici il cui ID contiene `"FALL"`. Non è documentata
nell'UI (il placeholder resta semplicemente `"Cerca..."` / `"Search..."`): è
intenzionalmente nascosta, utile in fase di sviluppo/debug.

### 24.4 Import e gestione errori

Le tre funzioni async (`handleImportCityMap`, `handleImportAll`, `handleWandClick`)
gestiscono l'import. `handleWandClick` ha try/catch annidati (clipboard, parse,
validazione), gestisce specificamente i permessi clipboard negati, e fa **rollback
completo del profilo** se l'import fallisce dopo la creazione.

### 24.5 useEffect

Pochi effetti, tutti con cleanup corretto: persistenza delle impostazioni globali,
pulizia chiavi orfane al mount, e due observer per la scrollbar/visibilità della
tabella (con `ResizeObserver`/`IntersectionObserver` correttamente disconnessi). Un
effetto su `[activeTab]` azzera `selectedIds` ad ogni cambio tab — `selectedIds` è un
unico `Set` globale non scoped per tab, quindi senza questo reset una selezione fatta
in una tab (es. "Città") resterebbe visibile anche nel conteggio del pulsante Export di
un'altra tab (es. "Inventario") dove quegli id non hanno significato. Comportamento
voluto: la selezione si azzera **sempre** cambiando tab, non viene preservata per tab.

---

## 25. Configurazione di build

### `vite.config.ts`

- **Alias Preact:** `react`/`react-dom` sono aliasati a `preact/compat`. Questo riduce
  drasticamente la dimensione del bundle. Per tornare a React puro, basta rimuovere i
  tre alias e disinstallare preact.
- **`viteSingleFile`:** produce un singolo `dist/index.html` con tutto inline (JS, CSS,
  asset). Va per ultimo nella lista plugin (prima del plugin service worker).
- **Due versioni distinte:** `__BUILD_VERSION__` è iniettata come `v1.<giorno dell'anno>`
  ed è quella VISIBILE nell'header dell'app (leggibile, stabile per giorno). Separatamente,
  `SW_CACHE_VERSION` = `v1.<giorno>-<timestamp>` è usata SOLO per il nome cache del service
  worker, e include il timestamp di build per essere unica ad ogni build (vedi sezione 25bis
  per il perché). Non vanno confuse né ricollegate.
- **Plugin `serviceWorkerPlugin`:** in fase `closeBundle` legge `sw-template.js` (nella
  root del progetto), sostituisce `__SW_VERSION__` con `SW_CACHE_VERSION`, e scrive
  `dist/sw.js`. È il motivo per cui `sw.js` non va mai modificato a mano.
- **Alias `@`:** punta a `src/`.

### `package.json` — script

- `dev` — dev server Vite.
- `build` — build + rinomina l'output in `foe-optimizer.html`.
- `typecheck` — `tsc --noEmit`.
- `lint` / `lint:fix` — ESLint.
- `knip` — rilevamento codice morto.

### Ciclo di build e consegna

Il ciclo di lavoro per ogni modifica:

1. modifica del codice;
2. `tsc --noEmit` → 0 errori (con `noUnusedLocals`/`noUnusedParameters` attivi);
3. `vite build` → genera il file singolo;
4. il file finale è `dist/foe-optimizer.html`, pubblicato su GitHub Pages.

Il bundle attuale è circa 1 MB (≈ 296 KB gzippato).

### CI e controlli locali

La GitHub Action di deploy (`.github/workflows/deploy.yml`) esegue **Typecheck
(`tsc --noEmit`) e Lint come gate** prima della build: Vite/esbuild non tipizzano in
fase di build, quindi senza questi step un errore TypeScript finirebbe in produzione.

In locale l'utente usa **`check-all.bat`** (root del repo, **gitignored**): la catena
completa pre-commit — `npm ci` (non `npm install`: riproduce esattamente il lockfile
come fa la CI) → report **informativi non bloccanti** (npm outdated, ncu, npm audit,
knip — knip può fallire per limiti di memoria dell'ambiente senza che sia un problema
del codice) → gate **bloccanti** (madge per i cicli di import, typecheck, lint, build).

### Dipendenze pinnate deliberatamente

- **`typescript` resta sulla 6.x**: `typescript-eslint` dichiara peer dependency
  `typescript >=4.8.4 <6.1.0` — aggiornare a TS 7.x romperebbe il linting type-aware.
  Rivalutare solo quando typescript-eslint pubblicherà il supporto esplicito alla 7.x.
- **`pako` resta sulla 2.x** (major 3 non adottata).

Le altre dipendenze si aggiornano normalmente ai minor/patch (verificando poi il ciclo
di build completo).

### Configurazione ESLint

`eslint.config.js` (flat config) usa `@eslint/js`, `typescript-eslint`,
`eslint-plugin-react-hooks` e `eslint-plugin-security`. Regole chiave:
`react-hooks/rules-of-hooks` (error), `exhaustive-deps` (warn), `eqeqeq` (error),
`no-explicit-any` (warn). La regola `security/detect-object-injection` è disattivata
(genera falsi positivi su accessi `obj[key]` legittimi). Esistono **2 warning di
sicurezza preesistenti** (su regex con argomenti non-letterali in `BuildingModel.ts` e
`format.ts`) che sono **falsi positivi accettati**: gli input sono sempre stringhe
controllate, non input utente.

---

## 25bis. PWA, service worker, cache e deploy

L'app è una PWA installabile (Android, iOS, desktop) con un service worker per
caricamento istantaneo sulle visite ripetute e supporto offline. Questa parte vive
**fuori** dal bundle single-file e ha diverse trappole che hanno richiesto debugging
reale: questa sezione documenta sia il funzionamento sia i problemi incontrati, per non
ripeterli.

### File coinvolti

- **`site.webmanifest`** (root del dominio) — il manifest PWA. Campi: `id` (`/`,
  identificatore stabile), `name`/`short_name`, `description`, `lang`/`dir`, `start_url`,
  `scope`, `display: standalone`, `orientation: any`, `theme_color`/`background_color`
  (entrambi `#1a1a2e`), `categories` (`["games","utilities"]`), `icons`, `screenshots`.
- **`index.html`** (sorgente) — oltre a SEO/OpenGraph/JSON-LD, contiene i meta tag iOS:
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (= `black`),
  `apple-mobile-web-app-title`, `mobile-web-app-capable`. Senza questi, su iPhone l'app
  installata dalla home non parte in modalità standalone "app".
- **`sw-template.js`** (root, NON in `public/`) — il template del service worker.
- **`src/registerSW.ts`** — registra il SW (no-op in dev) e gestisce l'avviso di update.
- **`vite.config.ts`** — il plugin che genera `dist/sw.js` dal template.
- Icone: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (+ varianti
  `-precomposed` e `-120x120`), `favicon.png`/`.ico`, `og-image.png`. Tutte alla radice
  del dominio, fuori dal bundle.
- Altre pagine statiche fuori bundle (in `public/`): `guida.html`/`guide.html` (guida
  online IT/EN, aperta dal pulsante Help), `404.html`, `.well-known/security.txt`,
  `sitemap.xml`, `robots.txt`, tutorial jpg/mp4.

### Icone: `purpose: "any"`, non `"any maskable"`

Le icone nel manifest usano `purpose: "any"`. Si era valutato `"any maskable"`, ma Chrome
lo sconsiglia perché un'icona usata come maskable senza la "safe zone" corretta appare con
padding errato. Poiché le icone del progetto hanno già uno sfondo pieno scuro (coerente con
`background_color`), `"any"` è la scelta giusta: niente cerchio/quadrato bianco su Android,
nessun file aggiuntivo da creare. Non reintrodurre `"any maskable"` per "completezza".

### Service worker: strategia cache-first

`sw-template.js` implementa cache-first con stale-while-revalidate sul documento HTML:
- **Prima visita:** scarica e mette in cache l'app + gli asset statici (icone, manifest).
- **Visite successive:** l'app viene servita ISTANTANEAMENTE dalla cache; in background si
  controlla se c'è una versione nuova.
- **Offline:** l'app funziona comunque (è tutto client-side).
- **Update (flusso attuale, senza pulsanti):** il SW chiama **`skipWaiting()` da solo
  all'install**; `registerSW.ts` mostra solo un avviso informativo bilingue (chiave
  `swUpdateAvailable`; la lingua la legge direttamente da `UI_LANG_KEY`, perché il
  modulo vive fuori da React) e, al `controllerchange`, **ricarica automaticamente**
  dopo ~1,2s — il ritardo lascia il tempo di leggere l'avviso, che altrimenti il
  refresh sembrerebbe un glitch. Il vecchio toast con pulsanti "Ricarica"/"Ignora" e
  il messaggio `SKIP_WAITING` non esistono più: non reintrodurli.
  **Guard `hadController`:** alla prima visita in assoluto non esiste ancora un
  controller, ma `clients.claim()` fa scattare comunque il `controllerchange`
  (null → SW). Il flag `hadController` (catturato al `load`) distingue i due casi:
  senza di esso un visitatore nuovo vedrebbe l'avviso "nuova versione" e un reload
  spurio alla prima apertura. Non rimuoverlo.

Il SW intercetta solo GET same-origin; POST e richieste cross-origin (es. eventuali
chiamate esterne) passano direttamente in rete.

> ⚠️ **Chiave di cache delle navigazioni = URL richiesto, non `/` fisso.** L'app è
> single-file e la root `/` resta il caso principale, ma il sito ha pagine statiche
> indipendenti fuori dal bundle (`/guida.html`, `/guide.html`): quando la chiave era
> fissa a `/`, navigare verso una di queste pagine serviva l'ultima pagina cachata
> sotto `/` (cioè l'app al posto della guida) finché un refresh non aggiornava quella
> chiave. Il SW ora usa `cache.match(request)`/`cache.put(request, ...)`. Non
> "semplificare" tornando alla chiave fissa.

### ⚠️ Trappola 1: la versione cache deve cambiare a OGNI build

Il nome della cache è `foe-optimizer-${VERSION}`, dove `VERSION` è iniettata dal plugin
Vite. **Errore commesso e corretto:** inizialmente `VERSION` era `v1.<giorno>`, uguale a
`__BUILD_VERSION__`. Conseguenza: facendo più build nello stesso giorno, il nome cache non
cambiava, quindi il SW (che in `activate` cancella solo le cache con nome DIVERSO
dall'attuale) non invalidava la cache vecchia → gli utenti restavano bloccati sulla versione
obsoleta. La correzione è stata separare le due versioni: l'header continua a mostrare
`v1.<giorno>` (leggibile), ma il nome cache usa `v1.<giorno>-<timestamp>`, unico ad ogni
build. **Non ricollegare il nome cache a `__BUILD_VERSION__`.**

La logica di pulizia in `activate` è `key.startsWith("foe-optimizer-") && key !== CACHE_NAME`:
robusta, cancella qualsiasi cache vecchia col vecchio formato.

### ⚠️ Trappola 2: Cloudflare cacha il sw.js

Il dominio è dietro Cloudflare (proxy) con GitHub Pages come origin. Cloudflare per default
cacha i file statici, **incluso `sw.js`**. Conseguenza: anche dopo un deploy corretto del
nuovo `sw.js`, Cloudflare serviva agli utenti la versione vecchia dalla sua cache edge.
Sintomo diagnostico: header `cf-cache-status: HIT` + `last-modified` vecchio sul `sw.js`,
mentre l'`index.html` (servito come `DYNAMIC`, non cachato da CF) era già aggiornato.

**Soluzione permanente:** è stata creata una Cache Rule su Cloudflare (Caching → Cache
Rules) con espressione `(http.request.uri.path eq "/sw.js")` e azione **Bypass cache**.
Così ogni deploy del service worker è immediatamente visibile, senza purge manuale. Se in
futuro un deploy del SW non si propaga, controllare PRIMA che questa regola esista ancora,
poi eventualmente fare un purge manuale di `/sw.js` (Caching → Configuration → Purge → Custom
Purge → URL).

### Pipeline di aggiornamento corretta (come deve funzionare end-to-end)

1. `npm run build` → genera un nuovo `dist/sw.js` con `VERSION` unica (timestamp).
2. Deploy su GitHub Pages.
3. Cloudflare serve il `sw.js` fresco (grazie alla Cache Rule di bypass).
4. Il browser dell'utente, al caricamento, scarica il nuovo `sw.js`, lo confronta byte a
   byte col precedente, e installa il nuovo SW.
5. Il nuovo SW in `activate` cancella la cache vecchia (nome diverso) e prende il controllo.
6. L'utente ha la versione aggiornata al **secondo** caricamento (il primo serve ancora la
   cache mentre scarica in background). Questo è il comportamento normale dei SW cache-first,
   non un bug.

### Stato SEO / indicizzazione (già fatto, non rifare)

- Sito già indicizzato su Google (appare con titolo, descrizione, icona corretti).
- Google Search Console verificata come proprietà DOMINIO (`sc-domain:foe-optimizer.com`),
  che copre http/https e sottodomini.
- `sitemap.xml` inviata in Search Console, stato "Riuscita", 1 pagina rilevata (corretto per
  una single-page app).
- `robots.txt` permette indicizzazione completa + punta alla sitemap.
- Redirect http→https attivo (Cloudflare); il canonical punta a https. Google può mostrare
  ancora "http://" come residuo storico: si auto-consolida, non è un problema.
- L'header "FOE OPTIMIZER" è un `<h1>` (non `<h2>`): unico h1 della pagina, segnale SEO del
  tema principale. Il contenuto testuale renderizzato è ricco (~175k caratteri), quindi il
  rendering client-side di Preact non penalizza l'indicizzazione.

---

## 26. Invarianti e principi da non violare

Queste sono le regole d'oro per modificare il progetto in sicurezza:

1. **Non reintrodurre metodi di import manuali.** Il bookmarklet è l'unico flusso
   supportato.

2. **Non modificare la struttura dati di `BOOKMARKLET_JS`** (l'oggetto `data` e i suoi 5
   campi): è il contratto di import, cambiarla rompe i bookmarklet già salvati. I
   dettagli non-dato (es. messaggi di `alert()`) si possono invece modificare — la
   struttura resta valida e i vecchi bookmarklet continuano a funzionare. Quando è il
   GIOCO/FoE Helper a cambiare, il pattern corretto è: lettura col fallback sul vecchio
   percorso + bump di `CURRENT_BOOKMARKLET_VERSION` (esempio reale v2 in §6.1) — mai
   una rottura secca del contratto. Vedi §6.1.

3. **Una sola sorgente di verità.** I tipi del payload stanno solo in `bookmarklet.ts`,
   le lingue solo in `languages.ts`, i pattern ID e i nomi consumabili solo in
   `buildingClassification.ts`. Non creare copie locali.

4. **I dati vengono dallo stesso `MainParser`.** Non aggiungere normalizzazioni
   difensive sugli ID (maiuscole/minuscole, "pulizia"): un id nell'inventario è
   identico al corrispondente nel CSV. `width`/`length` sono sempre numerici.

5. **La logica multilingua usa pattern di ID, non nomi localizzati.** Mai filtrare o
   classificare in base a stringhe tradotte (es. "Kit di restringimento"): usare il
   pattern dell'ID (es. `shrink_kit_`), che è lingua-neutro.

6. **Valutare `STORAGE_FORMAT_VERSION` a ogni cambio di formato di salvataggio.** Se la
   forma dei dati persistiti cambia, incrementare la versione (azzeramento pulito con
   avviso, non migrazione silenziosa).

7. **Non rimuovere i `fallbackBuildings` dallo storage.** Sono essenziali per mostrare
   gli edifici presenti solo in inventario/città e non nel CSV.

8. **`CityEntities` e `buildings.csv` convivono.** Il CSV è il database statico;
   `CityEntities` è il gioco reale importato. Sono complementari.

9. **Preferire fix chirurgici e minimi.** Verificare ogni modifica empiricamente
   (conteggi di output, test differenziali, benchmark) prima di considerarla corretta.

10. **L'ottimizzatore è codice critico.** Qualsiasi modifica alla sua logica va
    validata con test differenziali (output identico su migliaia di inventari casuali)
    prima di essere accettata. Le ottimizzazioni di performance non devono mai cambiare
    il risultato.

11. **Non "correggere" i 2 warning ESLint di sicurezza preesistenti.** Sono falsi
    positivi su regex con input controllati (`BuildingModel.ts` e `format.ts`).

12. **`computeAllFamilies` consuma `invUpg`.** Passare sempre Map costruite fresche
    (vedi §16.7): riusare una Map tra chiamate produce risultati diversi al secondo
    giro con lo stesso inventario.

13. **Tab Città = valori all'era del giocatore.** L'override totale di `applyEraStats`
    (anche per le copie di ere precedenti) è un comportamento deciso consapevolmente,
    esplicitato dall'header "(valori di <era>)" — non è un bug da correggere (§24.3).

---

## 27. Glossario dei termini FoE

| Termine | Significato |
|---|---|
| **GE / Grande Edificio** | Edificio speciale di alto valore, con livelli e progetti (blueprint). Prefisso ID `X_`. |
| **Era** | Lo stadio di avanzamento del giocatore (Età della Pietra → Space Age). 23 ere, id 0–22. |
| **PF / Punti Forge** | Risorsa centrale del gioco (strategy_points). Boostabile. |
| **Blueprint / BP** | Progetti per costruire/potenziare i Grandi Edifici. |
| **Beni** | Risorse di produzione, classificate per era (attuale, precedente, successiva) e di gilda. |
| **Furfanti** | Unità speciali (rogues) prodotte da alcuni edifici. |
| **Campi di Battaglia / GbG** | Guild Battlegrounds: modalità PvP di gilda. I bonus `gbg` si applicano qui. |
| **Spedizioni / GE (Expedition)** | Guild Expedition: modalità PvE di gilda. I bonus `sped` si applicano qui. |
| **Incursioni Quantiche / IQ** | Quantum Incursions (guild_raids): modalità di gilda. Bonus `iq` + IQBeni/IQTruppe/IQAzioni/IQCap. |
| **Insediamento** | Modalità a tema culturale (Vichinghi, Giappone, Egizi, ecc.) con edifici dedicati. |
| **Selection kit / Kit di selezione** | Kit che permette di ottenere un edificio scelto tra varie opzioni. Ha tier (base/argento/oro/platino). |
| **Upgrade kit / Kit di aggiornamento** | Kit che fa salire un edificio di un livello. Monouso. |
| **Shrink kit / Kit di rimpicciolimento** | Kit che riduce la dimensione di un edificio. Non è un kit di aggiornamento. |
| **Frammenti** | Pezzi che, accumulati in numero sufficiente, formano un item intero (edificio, kit, alleato). |
| **Alleato** | Bonus speciale con livelli e rarità (1–5). Le rarità alte ereditano i bonus di quelle inferiori. |
| **Catena (chain)** | La sequenza di livelli/edifici che descrive l'evoluzione di un edificio. |
| **Famiglia** | Un gruppo di catene correlate, identificato da un edificio "root". |

---

## Conclusione

FoE Optimizer è una webapp client-side robusta e ben strutturata:

- **modello dati chiaro** (`Building` al centro, con tipi di supporto ben separati);
- **parser puri per dominio** (edifici, alleati, inventario, ere), testabili in
  isolamento;
- **logica di gioco incapsulata** in `BuildingModel`;
- **un ottimizzatore unico nel suo genere** che mostra tutto ciò che è realmente
  costruibile dall'inventario;
- **persistenza centralizzata** con versioning e compressione;
- **multilingua** predisposto e funzionante;
- **una sola sorgente di verità** per ogni concetto, che previene intere classi di bug.

La base è solida per la manutenzione e per l'aggiunta di nuove funzionalità.

---

*Fine della documentazione tecnica v1.0 di FoE Optimizer by Sdrushi.*
