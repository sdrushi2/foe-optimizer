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
│   ├── format.ts              # Formattatori numerici puri (+ localDateStamp per i nomi file)
│   ├── storage.ts             # Persistenza localStorage + versioning + profili
│   └── useModalDismiss.ts     # Hook: chiusura modali con Esc e click sullo sfondo
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

**v3 (agosto 2026) — bookmarklet "universale".** Riscritto per supportare **sia FoE
Helfer che Forge Hammer** con lo stesso script, e per supportare l'import della
**città di un altro giocatore in visita**, non solo della propria. Punti chiave:

- **Rilevamento dell'helper**: `S = typeof MainParser!=='undefined' ? MainParser :
  (typeof FH!=='undefined' ? FH.Main : null)`. Se nessuno dei due esiste (né
  `MainParser` né `FH`), lo script si ferma subito con un alert (`'No supported
  helper found (FoE Helfer or Forge Hammer required)'`) invece di lasciar esplodere
  un TypeError criptico.
- **Rilevamento città propria vs. in visita**: `V = (ActiveMap ?? FH.ActiveMap) ===
  'OtherPlayer'`. Se `V` è vero, si legge da `CityMap.OtherPlayer` invece che da
  `CityMap.Main` per mappa e aree sbloccate.
- **Inventario e alleati azzerati in visita**: `inventory: V ? [] : Object.values(S.Inventory)`,
  `allies: V ? {} : (Allies ?? S.Allies).allyList`. Non è un limite del bookmarklet:
  il gioco stesso non espone MAI inventario/alleati per un giocatore diverso da sé
  stessi, quindi in visita questi due campi sono sempre vuoti per costruzione.
- **Nome e avatar del giocatore visitato**: quando `V` è vero, si legge il nome da
  `CityMap.OtherPlayer.name` e l'avatar da `Profile.otherPlayer.other_player.avatar`
  (FoE Helfer) — popolati dallo stesso handler `visitPlayer` che popola
  `CityMap.OtherPlayer`. Quando `V` è falso (città propria), nome e avatar vengono da
  `ExtPlayerName`/`ExtPlayerAvatar` (FoE Helfer) o da `FH.Player.Name`/`FH.Player.Avatar`
  (Forge Hammer) — percorsi diversi per i due helper, entrambi provati.
- **Alleati**: legge solo da `Allies.allyList` (percorso globale, versioni recenti di
  FoE Helfer) o `S.Allies.allyList` (fallback, versioni meno recenti / Forge Hammer).
  Nessun'altra retrocompatibilità oltre queste due.

⚠️ **Superato da v4.1/v4.2 (agosto/settembre 2026), vedi i commenti versione in
cima a `bookmarklet.ts` per lo storico completo**: lo script HA ORA un
`try/catch` esterno con `alert('Magic wand error: '+e.message)` (v4.1), e ogni
campo annidato letto dal client di gioco ha un fallback prima di essere
usato — incluso l'accesso `allyList` stesso (v4.2, dopo un bug reale
segnalato da un utente: il fallback della v4.1 proteggeva solo il
*risultato* di `Allies.allyList`/`S.Allies.allyList`, non l'*accesso* quando
`Allies`/`S.Allies` stesso è `undefined` — vedi il commento v4.2 in
bookmarklet.ts per l'analisi completa). La diagnosi di un campo mancante non
è più delegata solo all'app via `validateBookmarkletData` (§6.3): un errore
nella costruzione del payload ora mostra comunque un alert diretto nella
pagina di gioco, PRIMA che l'utente tenti di incollare qualcosa nell'app.

**v4.3 (ottobre 2026) — Forge Hammer 1.8.0 rinomina i contenitori delle mappe.**
In `CityMap` le mappe secondarie sono ora indicizzate per id mappa:
`CulturalOutpost` → `cultural_outpost` (stessa forma `{data, areas}`),
`EraOutpost` → `era_outpost`, `QI` → `guild_raids`, più il nuovo `stellar_city`.
Con la vecchia chiave il blocco Pirati veniva saltato e l'app diceva "visita prima
l'Insediamento". Lo script legge `CityMap.cultural_outpost||CityMap.CulturalOutpost`
(nuovo nome, vecchio come ripiego per FoE Helper e FH < 1.8). Stesso `_v: 4`: gli
utenti devono riscaricare la bacchetta. Se FH rinomina di nuovo, il sintomo è lo
stesso: diagnosi in console con
`Object.entries(CityMap).forEach(([k,v])=>console.log(k,Object.keys(v||{})))`.

**v6 (ottobre 2026) — magazzino risorse.** Campo `resources` con l'intero
`ResourceStock` (FoE Helper) o `FH.RessourceStock` (Forge Hammer, sic; ripiego
`FH.ResourceStock`): ~344 chiavi, ~7 KB, importato tutto per non cambiare di nuovo
la bacchetta. Assente in visita; warning `resources` se l'helper non l'ha popolato
(FoE Helper inizializza `ResourceStock = []`). L'app lo sanitizza
(`sanitizeResources`: nomi `[A-Za-z0-9_.-]`, valori numerici finiti ≥ 0, max 5000
chiavi, niente `__proto__`) e lo salva nel nuovo slot profilo `resources`
(`PROFILE_SLOTS` in storage.ts: include cleanup ed export/import profili). Slot
assente = profilo importato con bacchetta < v6 → il Consigliere Gettoni Valore
(§14bis) non compare; un re-import con bacchetta vecchia cancella lo slot.

**v5 (ottobre 2026) — bacchetta a prova di aggiornamenti dell'helper.** Forge Hammer
si aggiorna da solo (la 1.8.0 ha già rotto due letture), quindi `_v` sale a 5 e lo
script diventa difensivo: (1) il guard iniziale richiede solo l'helper; (2) campo
diagnostico `helper: {n, v}` (nome/versione) e `warn: string[]` con le sezioni NON
trovate (`allies`, `inventory`, `map`, `entities`, `areas`, `avatar`, `outpost`):
l'app, dopo l'import, mostra un alert se mancano dati importanti
(`readPayloadDiagnostics`, whitelist dei codici) e la tab Pirati dice «l'helper non
espone l'Insediamento» invece di «visitalo»; (3) avatar in `try/catch` proprio;
(4) coordinate normalizzate `x||0`, `y||0` (il **gioco omette le coordinate = 0**:
prima il pirata scartava le entità senza `x`/`y` e rifiutava aree senza `y`, e due
punti di App.tsx — griglia occupazione e «strade inutili» — saltavano gli edifici a
x=0/y=0); l'import tollera comunque i payload v4 senza coordinate; (5)
`pirateOutpost` incluso solo con almeno un'area. **Soglia pirata**:
`MIN_PIRATE_BOOKMARKLET_VERSION = 4` (il blocco non ha cambiato forma) — i payload
v4 con Insediamento restano importabili; `isLegacyBookmarkletPayload` usa la stessa
soglia. Chi ha una bacchetta < 5 vede il modale «obsoleta» dopo l'import città.

Costruisce un oggetto JSON e lo copia negli appunti (con fallback su `execCommand`
per i browser senza `navigator.clipboard`).

**Ottimizzazione delle aree:** per ridurre la dimensione del payload, le aree sbloccate
standard (4×4, la grande maggioranza) vengono compresse rimuovendo i campi `width`,
`length` (ricostruibili al default 4) e `__class__`.

**Versionamento del bookmarklet (`CURRENT_BOOKMARKLET_VERSION`, attualmente **5**).**
Il payload include un campo `_v` la cui versione corrente è la costante esportata
`CURRENT_BOOKMARKLET_VERSION`, **interpolata** direttamente dentro `BOOKMARKLET_JS`
(nessun numero duplicato da tenere sincronizzato a mano). All'import, dopo
`handleImportAll`, si confronta il `_v` del payload con la versione corrente (`_v`
assente = versione pre-versionamento, trattata come 0): se è inferiore, si apre il
**modale "Bacchetta magica obsoleta"** (`isBookmarkletOutdatedModalOpen`, §24.3) che
spiega il nuovo supporto Forge Hammer + import città altrui e guida l'utente a
ri-trascinare il bookmarklet aggiornato nei preferiti. Si incrementa quando cambia il
MODO in cui il bookmarklet legge i dati dal gioco, non per modifiche cosmetiche.
- **v2** (luglio 2026): lo spostamento di `Allies` fuori da `MainParser` in FoE
  Helfer — la lettura è cambiata (con fallback, quindi retrocompatibile), la
  struttura del payload no.
- **v3** (agosto 2026): riscrittura universale descritta sopra — supporto Forge
  Hammer, import città altrui, rimozione del `try/catch` esterno.
- **v4** (agosto 2026): cattura UNIFICATA città + Insediamento dei Pirati in un
  solo payload (vedi §6bis) — sostituisce il branch v3.1 con `return`
  anticipato che catturava solo l'uno o l'altro a seconda della mappa attiva.
- **v4.1** (agosto 2026, stesso `_v: 4`): hardening completo — `try/catch`
  esterno su tutta la costruzione del payload (prima assente, un campo
  mancante lanciava un `TypeError` non gestito e lo script moriva
  silenziosamente) + fallback su ogni campo annidato letto dal client di
  gioco. Nessun cambio di struttura dati, solo robustezza. Dettagli
  completi in `docs/SKILL.md`.

L'annuncio one-off dismissibile usato per v2 (`BOOKMARKLET_V2_ANNOUNCEMENT_ID`,
persistito in `DISMISSED_ANNOUNCEMENTS_KEY`) è stato **rimosso interamente** insieme a
tutto il meccanismo generico di annunci dismissibili, sostituito per v3 dal modale
dedicato sopra descritto (più informativo, non serve più un meccanismo generico).

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
> 2. *Nomi dei file scaricati* — es. `foe-map-YYYY-MM-DD.png/.json` (CityMapView; data
>    locale via `localDateStamp()`, non quella UTC di `toISOString`), header
>    del CSV di debug (`CityEntityID;name;num`). Sono identificatori di file, non UI
>    mostrata: si tengono in inglese neutro a prescindere da `uiLang`, evitando di
>    introdurre `t()` in punti che altrimenti non ne avrebbero bisogno.

> **Messaggi del bookmarklet.** I due `alert()` DENTRO `BOOKMARKLET_JS` (`'Copy failed:
> …'`, `'Magic wand error: …'`) sono in inglese fisso. Girano nella pagina di Forge of
> Empires, fuori dal contesto dell'app, quindi non hanno accesso a `t()`/`uiLang`; si
> attivano solo in casi d'errore rari (copia clipboard fallita). Si possono modificare
> liberamente — vedi la precisazione sull'invariante in §6.1. Il branch
> `cultural_outpost` aggiunto in v3.1 (agosto 2026, vedi §6bis) ha un terzo `alert()`
> dello stesso tipo (`'Errore: '+e.message`, in italiano nel branch storico portato dal
> tool Pirati) — stessa logica: gira in pagina, fuori da `t()`.

---

## 6bis. Tab "Pirati": planner Insediamento dei Pirati (agosto 2026)

Quinta tab di navigazione (icona `Anchor`, tra "Alleati" e "Guida") che monta il tool
standalone "foe-pirati" come modulo integrato: calcola il piazzamento ottimale degli
edifici nell'Insediamento dei Pirati (mappa di gioco `cultural_outpost`), con un solver
a backtracking (Zobrist hashing per la memoization, stesso stile del progetto
`foe-city-builder`).

**File**: `src/data/piratiBuildings.ts` (dominio puro: tipi, costanti griglia/solver,
i 14 edifici con `cityentityId` reali — nessuna dipendenza React), `src/data/
importCulturalOutpost.ts` (converte il payload assoluto del bookmarklet in coordinate
relative del tool), `src/components/PiratiTool.tsx` (il componente: state, solver,
drag&drop, JSX — montato con `forwardRef`, espone `importFromClipboardText` via
`useImperativeHandle`).

**Bookmarklet condiviso, cattura UNIFICATA (v4)**: `BOOKMARKLET_JS` in
`bookmarklet.ts` cattura SEMPRE il payload città/inventario (`BookmarkletData`, come
v3) e, in più, se l'utente ha visitato il proprio Insediamento nella sessione di gioco
corrente (`CityMap.CulturalOutpost` popolato, e non in visita da un altro giocatore),
annida anche i dati Pirati in `d.pirateOutpost` nello STESSO payload — un solo click,
un solo JSON. Sostituisce la v3.1 (storico: branch `cultural_outpost` anteposto con un
`return` anticipato, che catturava SOLO l'uno o l'altro a seconda della mappa attiva e
rompeva l'import città se lo si tentava mentre si era sull'Insediamento). Non esiste
una seconda bacchetta magica: `PiratiTool` non ha alcun pulsante bookmarklet proprio.
`handleWandClick` nell'header globale fa branching su `activeTab`: su `"pirati"`
importa nel planner (via `piratiToolRef.current.importFromClipboardText`, che estrae
`payload.pirateOutpost` dal payload unificato), altrimenti crea un profilo
città/inventario come prima (che ignora `pirateOutpost`, non tra i campi validati da
`validateBookmarkletData`).

**i18n completa (agosto 2026)**: `PiratiTool` riceve `uiLang` come prop e traduce
tutto — toolbar, messaggi di stato/errore/import, tooltip, nomi edifici — con lo
stesso `t()`/`UI_STRINGS` del resto dell'app (prefisso chiavi `pirati*`). Ogni
edificio ha `nameKey` (nome completo) e `shortNameKey` (etichetta breve per la cella
della griglia, scelta a mano per lingua, non derivata da `name.split(" ")[0]`). Gli
errori di `importCulturalOutpostPayload` usano un `code` stabile
(`ImportCulturalOutpostFailure.detail`, pattern identico a
`BookmarkletValidationError`) invece di un messaggio già scritto in una lingua.

Dettagli completi (coordinate a due spazi Storage/Display, layout responsive senza
vincolo di altezza, montaggio nel layout `<main><section>`) in `docs/SKILL.md`,
sezione "Tab 'Pirati'".

**Bug mobile risolto (agosto 2026): planner assente/rotto finché non si ruota lo
schermo.** Due cause distinte: (1) la root di `App.tsx` usava `h-screen` (`100vh`
fisso) invece di `h-dvh` (dynamic viewport height) — su Chrome mobile `100vh` include
l'area della barra indirizzi, che appare/scompare, quindi il primo render calcolava
un'altezza sbagliata prima che il browser assestasse la UI; (2) il `ResizeObserver` su
`gridWrapperRef` (in `PiratiTool.tsx`) riportava `{0, 0}` al primo mount, perché
`observer.observe()` invoca il callback subito con le dimensioni correnti — e
`PiratiTool` è montato dentro un div con `display: none` sulle tab diverse da
"pirati", quindi quella prima misurazione era sempre zero, disattivando il fallback
CSS (attivo solo con `gridWrapperSize === null`) e facendo collassare il planner. Fix:
`h-screen` → `h-dvh` sulla root; il callback del `ResizeObserver` ora ignora
esplicitamente misurazioni `0×0`. Vedi `docs/SKILL.md`, sezione "Tab 'Pirati'", per i
dettagli completi (inclusi i sintomi osservati sui 3 screenshot dell'utente). `tsc
--noEmit` e `vite build` puliti dopo il fix.

**Bug mobile landscape risolto (stesso giorno, dopo il fix sopra): scroll ancora
assente.** Il layout a due colonne aveva `overflow-y-auto sm:overflow-hidden`: lo
scroll si disattivava appena la LARGHEZZA superava il breakpoint `sm` (640px), ma un
telefono in landscape lo supera facilmente pur avendo un'altezza reale molto ridotta
— il layout "desktop" si attivava senza avere lo spazio verticale per contenere tutto,
rendendo la parte in eccesso (lista edifici o planner) irraggiungibile. Fix: rimosso
`sm:overflow-hidden`, `overflow-y-auto` sempre attivo — su schermi realmente grandi lo
scroll non scatta mai (nessun impatto), su mobile landscape resta sempre disponibile.
`tsc --noEmit` e `vite build` puliti.

**Bug desktop risolto (stesso giorno, dopo il fix sopra): finestra bassa, ultimi
edifici nascosti, niente scrollbar.** Nel layout affiancato, la colonna planner
(`order-2`) ha `sm:h-full sm:min-h-0` e si ridimensiona internamente entro l'altezza
della riga del grid; la colonna edifici (`order-1`) invece cresceva col proprio
contenuto naturale senza alcun vincolo — quando l'altra colonna della stessa riga di
CSS Grid fissa l'altezza della traccia, una colonna priva di overflow proprio viene
clippata silenziosamente dal grid (nessuno scroll visibile), e lo `overflow-y-auto`
sul contenitore esterno da solo non basta. Fix: aggiunto `sm:h-full sm:min-h-0
sm:overflow-y-auto` anche alla colonna edifici, che ora ha il proprio scroll interno
indipendente dal planner. `tsc --noEmit` e `vite build` puliti.

**Revisione bug (settembre 2026).** Corretti in un unico giro, dettagli e
validazioni in `docs/SKILL.md` (sezione "Tab 'Pirati'"):
- *Messaggi d'errore dell'import*: `isLegacyBookmarkletPayload` ora riconosce una
  bacchetta vecchia da `_v` e non dalla forma (dalla v4 ogni payload è un payload
  città): prima un payload v4 senza `pirateOutpost` diceva "bacchetta vecchia" e la
  v3.1 sull'Insediamento diceva "visita l'Insediamento".
- *Import con espansioni a sinistra della base* (`importCulturalOutpost.ts`):
  l'offset di colonna veniva dal minimo globale delle aree, spostando tutto di un
  blocco con due blocchi fantasma; ora viene dalla riga più in alto, e le celle
  sono ancorate al blocco sbloccato minimo come le `StorageCell` del tool.
- *`lastSolvedRef`* (punto di ripristino dopo un Risolvi fallito/fermato) segue la
  griglia: traslato con le espansioni, ripulito dei piazzamenti persi (blocco
  richiuso, nuovo ostacolo); il ripristino calcola lo stato con `layoutStatus`
  invece di forzare `"success"`.
- *Solver*: il primo tentativo tiene fermo il Municipio nella posizione ATTUALE
  (non più quella di default); il backtracking testa direttamente l'unica
  posizione possibile per classe (angolo in alto a sinistra sull'ancora),
  rimuovendo MRV e punteggio che non influivano — soluzioni e passi identici su
  323 istanze, ~1,55-1,6x più veloce; il messaggio "possibile falso negativo"
  guarda solo l'ultimo tentativo.
- *Interfaccia*: × di eliminazione non più attiva quando invisibile (touch);
  Undo/Reset tornano alla modalità ostacoli; un'espansione che contiene il
  Municipio non è rimovibile; chiudendo un blocco i suoi ostacoli tornano a quelli
  dell'import; `pointercancel` annulla il drag; durante una ricerca la griglia non
  sembra più cliccabile.
- *Rimozione di un'espansione con edifici dentro*: prima svuotava l'intera mappa
  (tranne il Municipio, `clearSolution`); ora si spostano solo gli edifici che
  toccavano il blocco, nella miglior posizione libera rimasta (stessa regola
  dell'auto-piazzamento del '+'), e chi non trova posto esce dalla mappa col
  conteggio invariato, con un messaggio che invita a premere Risolvi.

**Revisione bug degli altri componenti (settembre 2026).** Dettagli in
`docs/SKILL.md` (sezione `components/` e voce `App.tsx`):
- *CityMapView*: l'export PNG disegna le strade a 2 corsie su tutte e 4 le celle
  (prima solo quella in alto a sinistra, le altre uscivano come spazio libero);
  colori e conteggi della legenda vengono da un'unica funzione (`mapCategory`),
  quindi ogni edificio è contato una volta sola nella voce del colore con cui
  appare; messaggio dedicato ("reimporta la città") per i profili senza aree
  sbloccate salvate, e niente più rimando all'export SVG rimosso.
- *Popup immagine* (App.tsx): aprendosi a sinistra finisce prima dell'ancora
  (`anchorLeft`); sulla mappa non copre più il cursore vicino al bordo destro.
- *Modali*: hook `useModalDismiss` (Esc + click sullo sfondo solo se la pressione
  è iniziata sullo sfondo: prima selezionare del testo e rilasciare fuori chiudeva
  il modale) per About, EfficiencyHelp, ProfileHelp e i modali inline di App
  (Import sessione, Edifici aggiornabili, visualizzatore JSON solo con Esc); icone
  SAVE/LOAD del ProfileHelp non più pulsanti finti; testo del filtro min EFF
  corretto (esiste solo per gli edifici); testi alternativi degli avatar tradotti.
- *Nomi dei file esportati* con la data locale (`localDateStamp`), non UTC.
- *PRIVACY.md*: aggiunti Forge Hammer, nome del giocatore, Insediamento dei Pirati
  e il caso della città di un altro giocatore.

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
- `light` — `true` se fa parte del set "principale" (823 edifici storici, `Light=1` nel
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
- `fragments` — stringa descrittiva dei frammenti prodotti (vedi §8.1 per il
  formato esatto dei token e §11 per il parsing).

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
CityEntityId; NomeIta; NomeEng; Hash; Light; Kit; Time; Size; Road; Pop; Fel;
BP; PF; PFB; FUR; TR; TRNE; Beni; BeniP; BeniS; BeniSp; BeniSpB; BeniB; BeniG;
GenAtk_A; GenDef_A; GenAtk_D; GenDef_D;
CampiAtk_A; CampiDef_A; CampiAtk_D; CampiDef_D;
SpedAtk_A; SpedDef_A; SpedAtk_D; SpedDef_D;
IQAtk_A; IQDef_A; IQAtk_D; IQDef_D;
IQBeni; IQTruppe; IQAzioni; IQCap; Ally;
FSP; TPM; TPB; ADM; MOD; RIN; IMM; Fragments
```

`Light` è un flag manuale di riferimento per stabilire gli edifici da includere
nella visualizzazione `Light` delle tabelle.

**`Ally`** (cambiata semantica l'11 agosto 2026): NON è più un booleano 0/1,
ma una stringa con un carattere per ogni slot alleato dell'edificio, "" se
nessuno — "M" = militare, "S" = scientifico (introdotto con StellarAgeDiscovery,
Steelport Warship, gli unici 2 edifici con slot "science" osservati finora).
Il conteggio slot (`Building.ally: number`, usato ovunque nell'app per i
confronti `> 0`) si deriva da `allyType.length` al parsing (`buildings.ts`),
non è più una colonna a sé: il gioco modella `AllyComponent.rooms` come lista
(un edificio POTREBBE avere più slot, anche misti, anche se oggi nessuno ne
ha più di 1), quindi la colonna è pensata per quel caso futuro senza dover
essere ridisegnata. Estratta da `buildings.py::extract_ally_type` (gemello:
`ALLY_TYPE_CODE` in entrambi i lati, fail-fast su un allyType sconosciuto non
mappato — mai una lettera arbitraria silenziosa).

**Fix in `confronta_buildings.py` (11 agosto 2026):** il cambio di semantica
sopra ha rotto silenziosamente il confronto della colonna `Ally` col foglio di
Linnun. Il foglio (`buildings_linnun.csv`) usa ancora il vecchio booleano 0/1
(non è un dato del gioco, lo tiene Linnun a mano); prima del fix `Ally` era
dichiarata `kind="num"` in `SECTIONS`, quindi `pd.to_numeric(..., errors=
"coerce")` collassava silenziosamente sia "M" sia "S" sia "" a `NaN`→`0.0`,
rendendo il confronto sempre "uguale" a prescindere dal valore reale (falso
negativo totale, zero discrepanze rilevate anche quando lo slot alleato non
combaciava). Introdotto un quarto `kind`, `"ally"`: confronta solo PRESENZA
(sheet "1"/numero non-zero vs game allyType non vuoto), non il testo letterale
— il foglio non distingue mai M/S, quindi un mismatch di TIPO (M nel gioco,
S sul foglio) resta invisibile a questo confronto per costruzione, viene
rilevata solo l'assenza/presenza dello slot. Validato sui dati reali: 85/85
righe con slot alleato combaciano esattamente tra foglio e gioco, zero
differenze spurie nella sezione GENERAL del report (prima del fix la
`kind="num"` nascondeva comunque tutto, quindi il "prima" non aveva mai
generato discrepanze visibili — il bug era silenzioso, non rumoroso).

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
PF; Beni; BeniP;
abilityIta; abilityEng
```

`abilityIta`/`abilityEng` sono la descrizione testuale dell'abilità speciale
dell'alleato, per lingua; vuote per la maggior parte degli alleati (solo alcuni hanno
un'abilità speciale documentata).

**`PF`/`Beni`/`BeniP`** (aggiunte l'11 agosto 2026): produzione diretta degli
alleati `allyType="science"` in `Allies.txt`/MainParser (oggi 3 su 41: Fibonacci,
Indradevi, Ernest Shackleton) — a differenza dei 38 alleati "military", questi
non danno boost di combattimento (`rarityBoosts` vuoto su tutte le rarità) ma
producono una risorsa fissa per rarità, identica su tutte le 24 ere del gioco,
letta da `productionReward`. Stesso schema di `buildings.csv`: `PF` = Punti
Forgia, `Beni` = beni dell'era corrente, `BeniP` = beni dell'era PRECEDENTE (mai
osservato un caso "era successiva"/BeniS sui 3 alleati esistenti). Il valore
salvato è quello al **livello massimo (100)** della singola rarità — un valore
GREZZO, non cumulativo: l'ereditarietà fra rarità (vedi §14.3) la somma

> **Catene nel Planner (`src/planner/catene.ts`, 15 ottobre 2026).** Regole dell'utente: gli anelli di una catena sono intercambiabili e si ridistribuiscono fra gli inizi della stessa catena (2 Statue + 10 Strade: 3+7 in città, 5+5 o 0+10 nel Planner); TUTTI gli anelli vanno collegati, anche quelli scollegati nella città originale. `raggruppaCatene(problem, distribuzione = parti)`: per ogni catena con inizi e anelli, ogni inizio con la sua quota di anelli diventa UN blocco rettangolare (`PlannerBuilding` con id `catena:<id inizio>`, nome "Statua … + 5× Strada …", strada dell'inizio) montato seguendo gli agganci di catene.json (`monta`: rettangolo di aggancio con la forma dell'anello e non occupato; testa di chiusura dell'Ippodromo agganciata all'indietro; verifica rettangolo pieno, altrimenti i pezzi restano separati). Teste principali = forma di inizio più numerosa, le altre forme = teste di chiusura. Distribuzione di default `parti` (in parti uguali: le catene corte entrano anche nelle città piccole). `espandiCatene(placements, blocchi)` riscompone i blocchi negli edifici originali (usata dal PNG). PlannerView: `catene = raggruppaCatene(buildPlannerProblem(…))`, `problem = catene.problem`. Banco: `catene_test.ts` (Filanush: treno 3×37, riscomposto nella posizione originale 16/16), unità sintetiche (2 Statue + 10 Strade → due blocchi 14×3; 0+10 → un blocco 24×3 e la statua sola; Ippodromo A + 3 rettilinei + B → 4×10). **Strada solo sull'inizio** (segnalazione dell'utente: il treno di Filanush era attaccato alla strada dal lato dell'ultimo vagone): `PlannerBuilding.zonaStrada` (rettangolo dell'inizio nel blocco); `perimetroZona`/`toccaStradaZona` in engine.ts (contorno della zona fuori dal blocco) usati da `ribasa`, `riparaScollegati`, `attaccaAStrade`, `rifinisciPunte` (movers e posizioni), `runPlaceholderPlanner` (BFS verso la zona), `smussa.ts`, `PlannerView.scollegati()` e dal banco. **Blocchi per primi** (`piazzaBlocchi` in simula, prima di `riempiLatiStrade`; segnalazione: negli scenari a raccordo il treno 3×37 restava fuori perché a fine giro non c'era più spazio): BFS delle strade nuove dalla rete attuale, posizione libera che minimizza `strade nuove − PESO_BORDO_BLOCCO (1,5) × celle sul bordo della mappa`, si scava il percorso fino all'inizio e si piazza. Banco Filanush (`bench.ts` con CATENE=1, 6000): r3 e r4 col treno al bordo destro (65,8), tutti gli edifici con strada piazzati, strade 264 / 274 (originale 276); con peso 0,6 il treno finiva accanto alla verticale e restavano fuori 38 edifici. Città senza catene: firme invariate. **Builder senza blocchi** (segnalazione dell'utente su Stralis, 3 Statue all'onore: nelle fasi 1-2 degli scenari a raccordo le catene erano attaccate alla strada dalla parte dell'ultima Strada per la vittoria): `toBuilderInput` esclude gli edifici con `zonaStrada`, le regole del builder non conoscono la zona dell'inizio; li piazza `piazzaBlocchi` all'inizio del completamento. **Strade sprecate sugli anelli** (segnalazione dell'utente: una Statua + 8 Strade attaccata alla strada per tutta la lunghezza): `perimetroCoda(b, x, y)` (engine.ts) = contorno del blocco fuori dalla zona dell'inizio; le strade lì sono sprecate: contano in `calcolaStradeVuote` (bordo rosso tratteggiato nella mappa) e nelle `stradeVuote` del piano (punteggio della ricerca), e in `piazzaBlocchi` costano `PESO_CODA_BLOCCO` (2) ciascuna. **Niente fine strada ai blocchi**: in `piazzaBlocchi` occupare la cella oltre una punta di strada costa `PESO_PUNTA_BLOCCO` (40): i fine strada restano agli edifici grandi (es. 6×5); la Statua (lato corto 3) va sul lato di una dorsale con gli anelli perpendicolari. Un blocco senza posto va in `riservati` (i lati delle strade non lo prendono). Banco Stralis (CATENE=1, 6000): r3 e r4 con le 3 catene (20×3, 8 Strade ciascuna) tutte collegate dalla Statua, 195/195, strade 139 / 142 (originale 210). Da fare: la distribuzione come parametro della ricerca (oggi fissa in parti uguali).

> **Strade a due corsie, prima versione (21 ottobre 2026).** Regole concordate con l'utente: la strada a due corsie è fatta di blocchi 2×2 (4 celle nel conteggio delle strade, valgono come strada normale per tutti gli edifici e sono l'unica strada per quelli con `roadLevel >= 2`); la rete a due corsie parte dal municipio (un blocco che lo tocca anche con una sola cella) e due blocchi sono collegati solo se condividono un lato intero, allineati (mai sfalsati); la rete a una corsia parte dal municipio o da qualunque blocco; un edificio a due corsie tocca almeno una cella di un blocco collegato. **Nuovo `planner/dueCorsie.ts`**: `richiedeDueCorsie`, `celleBlocchi`, `nucleiDueCorsie(problem, base, fissi)` (nuclei candidati: file dritte di 1..6 blocchi che partono da un blocco che tocca il municipio, nei 4 versi; gli edifici a due corsie, dal più grande, nel posto accanto alla fila che sfratta meno — edifici fissi pesati ×1000 — e più incastrato; costo [fuori, area fissi sfrattati, strade nuove + area sfrattata/4]; restano solo i nuclei col minimo di fuori; fino a 3: il migliore, il migliore con un blocco, il migliore con più blocchi), `verificaDueCorsie` (sfalsati, blocchi non collegati, edifici a due corsie staccati). **Builder**: non riceve più gli edifici a due corsie (`toBuilderInput`). **Ricerca** (completion.ts): `CompletionOptions.stradeFisse` (celle dei blocchi, `fisse`) mai tolte (ribasa passi 1-2, tagli dei bracci della girandola, accorciamento della verticale, foglie della rifinitura); gli edifici a due corsie non sono in `daPiazzare` (li mette solo il nucleo) e restano fermi (in `fissi` del nucleo; dopo una ripresa `fissi` riprende anche `fissiBuilder`); `compattaCitta(..., stradeFisse)` salta fasce/doppi angoli/rami/potature che toccano celle fisse. **PlannerView**: per i raccordi le partenze candidate sono {con margine, senza margine} × nuclei; per le girandole i nuclei sulla base; scelta con breve ricerca (`scegliPartenza`, 800 disposizioni, [fuori, deficit, strade]); tappa animata "Strade a due corsie"; `dueRef` (blocchi per scenario) per il disegno (MapCanvas `due`: blocco 2×2 più scuro) e l'export (`edificiFrame(f, n)`: un'entità strada 2×2 della città per blocco, `planner-road2-…`). Editor dal Planner: i blocchi devono restare uguali (prima versione) e `verificaDueCorsie` sugli edifici. **editor.html**: Shift + doppio clic = strada 2×2 (2×2 della città o definizione 2×2 di tipo strada fra le entità), doppio clic su un 2×2 lo toglie; 2×2 sfalsati che si toccano = bordo rosso. Banco: `due_test.ts Città var NVAL` (nuclei, breve ricerca, ricerca sul migliore, blocchi intatti, `verificaDueCorsie`, fuori; MAPPA=1 disegna). Avito r4 (9 Sintetizzatori 3×3): nucleo di 6 blocchi accanto al municipio verso est, 5 sfrattati; 3000-5000 disposizioni → 206 strade e 5 edifici grandi (4×6) fuori (prima 179 ma coi Sintetizzatori su strade a una corsia, non valido); Avito girandola 90 strade. Limiti noti: nucleo fermo durante la ricerca, sfratti attorno al municipio del builder pesanti; prossimi passi: mosse della ricerca sui blocchi e nucleo pensato dal builder. Città senza edifici a due corsie: firme del banco invariate.
>
> **Planner tradotto in inglese (21 ottobre 2026).** Richiesta dell'utente: con l'interfaccia in inglese le scritte del Planner restavano in italiano. Tutti i testi visibili (toolbar, tooltip, selettore CPU, riquadro dei militari e interruttori, titoli degli scenari — "Connector N", "Pinwheel", "Pinwheel 2" —, statistiche delle mappe, pulsanti delle card, avvisi, messaggi verso l'editor) passano da `t(key, uiLang)` con chiavi `planner…` in `data/ui-strings.ts`; anche gli errori delle modifiche dall'editor (`cittaDaEditor(..., lang)`, `verificaDueCorsie(..., lang)`, default "it"). Restano in italiano solo le etichette interne dei fotogrammi (non mostrate) e il pannello DEBUG_PLANNER. Il banco copia `ui-strings.ts` in /tmp/data (sync.sh) perché dueCorsie.ts lo importa.
>
> **Potenza della CPU, taratura di MED (21 ottobre 2026).** Diagnostica dell'utente: 16 core, 1 scenario, MED = 8 ricerche senza pause (stima 50%) ma Task Manager 78-80% (a tratti 50%). Lo scarto non sono le ricerche ma il lavoro del browser per ogni worker (raccolta della memoria, molto attiva nella ricerca locale che crea Map/Set a ogni tentativo; i thread di V8 girano su altri core). `QUOTA.med` da 0,5 a 0,35 (16 core, 1 scenario: 6 ricerche); MIN già giusto. Il tooltip ora dice "ricerche su X% dei core (più i thread del browser)".
>
> **Potenza della CPU, correzione (21 ottobre 2026).** Prova dell'utente: MIN ≈ 25%, MAX 94%, ma MED 75-80% invece di 50%. La pausa ora è in proporzione al tempo di lavoro appena fatto (`CompletionOptions.riposo()` = fattore, `sleep((now - lastYield) × riposo)`; `carico` restituisce (1 − lavoro)/lavoro) invece di millisecondi fissi per fette supposte da 40 ms. Sul banco le fette durano in media 44-47 ms (max 167-512 ms), quindi la differenza spiega poco: aggiunta una diagnostica nel tooltip del selettore CPU (core visti dal browser, scenari, ricerche per scenario, lavoro di ogni ricerca, carico stimato) per capire sul PC dell'utente da dove viene lo scarto.
>
> **Potenza della CPU: MIN / MED / MAX (21 ottobre 2026).** Richiesta dell'utente: scegliere nella prima toolbar quanta CPU usare (MAX come prima ≈ 100%, MED ≈ 50%, MIN come prima della squadra). PlannerView: `potenza` (salvata in localStorage `foe-planner-potenza`, default MED dal 21 ottobre, prima MAX), `carico(scenari, potenza)` → ricerche per scenario (`semi`) e pausa per fetta (`riposo`): MAX = floor(core/scenari), mai pause; MED = ceil(core·0,5/scenari) e pausa in proporzione perché il carico totale sia core·0,5; MIN = 1 ricerca per scenario e pausa per stare a core·0,25. Pausa: `CompletionOptions.riposoMs()` letta nei tre punti in cui la ricerca cede il controllo ogni ~40 ms (`sleep(riposo)` invece di `sleep(0)`): ricerca, ricerca locale, rifinitura; nei worker arriva coi flag (`Flag.riposo`, `FLAG_MS`). Cambio durante la corsa (`setPotenza`): ricalcola `semiRef`/`riposoRef`; le aiutanti con indice ≥ semi si fermano (`shouldStop`), quelle mancanti partono (`rinforziRef`, aiutanti con `i`/`vivo`); vale anche per il cestino. Esempi (core, scenari → CPU): 16/5 MAX 3 ricerche per scenario 94%, MED 2 + pausa 10 ms 50%, MIN 1 + pausa 10 ms 25%; 8/5 MAX 63% (1 per scenario, come prima), MED 50%, MIN 25%.
>
> **Mosse della ricerca sul nucleo a due corsie (21 ottobre 2026).** Richiesta dell'utente ("Aggiungi!!"). completion.ts: `blocchiCorr` (blocchi correnti, ricavati dalle celle fisse con una partizione 2×2 per righe) e `impostaBlocchi` (aggiorna `fisse`); ogni stato del cammino ricorda i suoi blocchi (`StatoS.bl`, anche la migliore; all'inizio di ogni giro e in `mostraS` si reimpostano quelli dello stato, così compattazione e potatura proteggono i blocchi giusti); i fotogrammi portano `due` (involucro di `opts.onFrame`, e `mostraS` con quelli della migliore). Vicinato "nucleo" (`mossaNucleo`, 12% dei giri della ricerca locale con blocchi): trasla tutto il nucleo di una cella con i suoi edifici a due corsie (50%), accorcia una punta (gli edifici a due corsie che toccavano solo quel blocco arretrano di 2), allunga una punta (il fine strada sopra il nuovo blocco avanza di 2); gli edifici sui nuovi posti tornano in gioco (mai municipio, edifici a due corsie o fissi del builder: mossa annullata), controllo `verificaDueCorsie`, poi ripiazzamento come gli altri vicinati e valutazione anche senza edifici da ripiazzare. Avito r4 (12.000 disposizioni): 24 mosse eseguite su 184 tentate (le altre sbattono su fissi o regole), nessuna ancora accettata: è una prima versione, il ripiazzamento dopo la mossa è lo stesso degli altri vicinati.
>
> **Blocchi a due corsie spostabili a mano (21 ottobre 2026).** Richiesta dell'utente: spostare l'unico blocco 2×2 da sfasato ad allineato al municipio veniva rifiutato. Ora i blocchi stanno nel fotogramma (`PlannerFrame.due`, messo da `setF` di PlannerView) e seguono Sposta tutto / Specchia (`traslato`, `specchiato`), l'editor (`cittaDaEditor` restituisce `blocchi`; controlli solo `verificaDueCorsie`: allineati, collegati al municipio, edifici a due corsie accanto), Annulla modifiche, export e disegno. Alla ripresa `StatoManuale.blocchi` (anche per le aiutanti e per l'annullamento del completamento) diventa il nuovo insieme di strade fisse della ricerca (`fisse` in completion.ts, anche con `riprendiDa`).
>
> **Smussa e due corsie (21 ottobre 2026).** Bug segnalato dall'utente: lo Smussa manuale spostava un edificio a due corsie su una strada semplice (PlannerView gli passa solo `sc.v.fissi`, senza gli edifici del nucleo). smussa.ts: gli edifici con `roadLevel >= 2` non sono mai mobili (né spinti: le spinte usano solo i mobili), qualunque siano i fissi ricevuti. Ricerca, compattazione e Smussa automatico li avevano già fermi (in `fissiBuilder`).
>
> **Nucleo: celle intrappolate (21 ottobre 2026).** Segnalazione dell'utente sul raccordo a 5: la fila a due corsie era spostata di 1 per attaccare un pezzo 1×4 e fra i suoi edifici e la verticale restava una striscia larga 1, inutilizzabile (lato della verticale sprecato). `provaCatena` conta le celle libere attorno al nucleo (blocchi ed edifici a due corsie) chiuse da entrambi i lati in orizzontale o in verticale (`intrappolate`) e le aggiunge al costo come strade (`costo[2]`). Avito r5: la fila verticale ora lascia una striscia di 2 accanto alla verticale (usabile da edifici larghi 2 attaccati alla verticale), mai di 1.
>
> **Scenario "Raccordo a 5" (21 ottobre 2026).** Idea dell'utente su Avito: con il raccordo a 5 celle la colonna a ovest della verticale diventa abbastanza larga da usarla per edifici più grossi (nel raccordo a 4 resta sottoutilizzata). fase1.ts: `variante(esteso)` con `esteso` = celle in più (0/1/2) applica `biforcaRaccordo` `esteso` volte (la verticale e i fine strada si spostano di 1 a ogni passo); `passo9` usa pezzi fino a `3 + esteso`; `forceRetry` solo per r3/r4 (test col Python); `runFase1` restituisce anche `r5`. builder/index.ts: varianti r3/r4/r5 (`best` resta fra r3 e r4, usato solo dai test). PlannerView: `VName` "r5", scenario "Raccordo a 5" (con margine/senza margine e nuclei a due corsie come gli altri). Banco 1500: r3/r4 identici; r5 Beta 82, Sdrushi2 76 (r3 81), Stralis 149; Avito r5 con Area di tiro 197 strade a 3000 (r4 199).
>
> **Fine strada a due corsie (21 ottobre 2026).** Osservazione dell'utente: il militare (Area di tiro 4×6) non finiva mai in fondo al tratto a due corsie, l'ha spostato a mano; "è quasi sempre la soluzione migliore mettere gli edifici più grandi come fine strada". In `provaCatena` (dueCorsie.ts) il più grande degli edifici a due corsie preferisce un posto che copre una delle due celle oltre la punta della fila (`oltre`, dalla direzione degli ultimi due blocchi; candidati in più: i rettangoli che coprono quelle celle), purché non sfratti edifici fissi; poi costo e incastro come prima. Avito r3: Area di tiro in (34,26), subito dopo l'ultimo blocco (32,26), allineata alla fila. Nota: nucleo ed edifici a due corsie restano fermi durante la ricerca, quindi la scelta va fatta qui.
>
> **Nucleo sul raccordo est (21 ottobre 2026).** Domanda dell'utente su Avito r3 (Area di tiro collegata): perché il tratto a due corsie è verticale, a ovest. Le file che partono dal lato est del municipio passano sul raccordo, accanto a edifici fissi del builder (sfratto pesato ×1000) e con 6 blocchi non bastavano per 10 edifici a due corsie: non entravano mai fra i candidati, restavano solo file agli angoli (verticali o oltre l'angolo basso). `nucleiDueCorsie(..., raccordo: { eastMidY })` (passato da PlannerView per i raccordi) propone sempre anche il nucleo "sul raccordo": blocchi sulla riga del raccordo e su quella sopra, verso est anche oltre la verticale, fino a KMAX + 4 = 10 blocchi, il più corto che fa entrare tutti gli edifici a due corsie; vengono messi per primi fra i candidati. Avito r3 con Area di tiro: candidati 7 blocchi sul raccordo (1 o 4 sfrattati) e la fila all'angolo basso; con 800 disposizioni esclusi 12/16/27, con 3000 2/3/5: vince il raccordo.
>
> **Interruttori dei militari (21 ottobre 2026).** Richiesta dell'utente (Avito: l'Area di tiro, a due corsie, va collegata, il Covo dei furfanti no). Con Alcatraz / Nave da guerra stellare (`geRifornimento`) i militari erano tutti senza strada; ora `buildPlannerProblem(..., militariCollegati)` lascia il loro livello di strada originale (anche 2 = due corsie) alle entità scelte. `tipiMilitari(cityMapBuildings)` (engine.ts) elenca i tipi (nome, quanti, livello). PlannerView: stato `militariCollegati` (default vuoto, come prima), un interruttore per tipo nel riquadro informativo azzurro (disattivati mentre il Planner corre non in pausa; cambiare riavvia come un cambio di città). Tolto il riquadro marrone delle strade a due corsie.
>
> **Core degli scenari eliminati (21 ottobre 2026).** Domanda dell'utente: eliminando a mano gli scenari, i core passano agli altri? Prima no (`semiRef` fissato all'avvio = core / scenari). Ora `elimina` ricalcola `semiRef` = core / scenari rimasti (max `SEMI_MAX` = 8; semi oltre i primi 4: `7919·i + 13`) e chiama `rinforziRef[id]` di ogni scenario in ricerca, che avvia le aiutanti mancanti (`avviaAiutante`) dalla disposizione attuale della principale; in pausa si aggiungono alla ripresa (`lanciaAiuti` usa `semiRef`). `adotta` e il `waitResume` della squadra sono ora sempre collegati (anche partendo con una sola ricerca per scenario).
>
> **Vicinato "prolungamento" (21 ottobre 2026).** Osservazione dell'utente su Avito r3 (183 strade dopo 300.000 disposizioni, planner-test/Avito_raccordo3_183.json): la ricerca non provava mai a prolungare la strada a due corsie con un tratto a una corsia. Nella ricerca locale (`cercaDaManuale`), con strade fisse e tutti gli edifici con strada dentro (`S.punti[0] === 0`), nel 15% dei giri: da una cella di strada che prosegue dritta in una cella libera (70% dal tratto a due corsie) si traccia una strada a una corsia di 2-11 celle, si tolgono 1-8 edifici vicini alla punta, si ripiazzano con `latiEsatti` (anche lungo i lati di tutte le strade) tenendo il prolungamento fisso per un attimo, poi `ribasa` pota la parte che non serve. Senza il vincolo sugli edifici fuori il prolungamento diventava una scorciatoia costosa per farli entrare (Avito r3 da 188 a 215-221 strade). Prova (bench/riprendi_test.ts, ripresa dall'export dell'utente, 9000 disposizioni, semi 5/99/2024): con 182/190/187, senza 188/186/184: nessun vantaggio netto per ora, ma il caso viene esplorato (il migliore, 182, è col prolungamento). Città senza due corsie: firme invariate.
>
> **Editor: tolta la duplicazione con Ctrl+trascina (21 ottobre 2026).** Richiesta dell'utente: duplicare edifici viola la regola del Planner (solo gli edifici della città). Tolti il codice (`dup`/`clones` nel trascinamento), la scorciatoia nella legenda IT/EN e "duplica" dalle descrizioni (meta, tooltip del pulsante EDITOR in CityMapView). Il tipo di annullamento `dup` resta per la strada aggiunta col doppio clic.
>
> **Modifiche a mano durante il completamento (21 ottobre 2026).** Segnalazione dell'utente: scambiare due edifici con strada (Didukh ↔ Ironclad) era rifiutato. `cittaDaEditor` (editorPonte.ts) con `soloSenzaStrada`: strade identiche e municipio fermo; gli edifici con strada si possono spostare o scambiare ma non togliere o aggiungere, e ognuno spostato deve toccare una strada (`toccaStradaZona`); messaggi d'errore separati. `rifinisciSenzaStrada` (completion.ts) alla ripresa con modifiche ricolloca prima gli edifici con strada spostati (`togli`/`metti`, aggiornano owner/griglie), poi quelli senza strada.
>
> **Scossa con Smussa quando la ricerca è ferma (20 ottobre 2026).** Osservazione dell'utente: con la ricerca ferma, pausa → Smussa per 2-3 s → Riprendi sblocca spesso la ricerca. Ora è automatico (completion.ts, ricerca locale `cercaDaManuale`): dopo `SCOSSA_DOPO` = 6000 disposizioni senza togliere strade o edifici fuori (`ultimoGuadagno`, aggiornato in `fotografa` solo quando migliorano punti[0] o punti[3], non i criteri secondari) e almeno 6000 dalla scossa precedente, la migliore passa per `smussaBordi` per `SCOSSA_MS` = 1500 ms (stesse strade; fissi: quelli del builder più, fuori dalla Girandola, quelli della ricerca) e il cammino riparte da lì come una ripresa (`scossa`): la migliore mostrata resta la precedente se è meglio e `trovataAl` non cambia. Spenta con `limiteValutate` (ricerche brevi e banco deterministico: firme invariate). Prove a 20.000 disposizioni senza limite (ricerca_s): Stralis r3 142 → 140 strade, Beta r3 76 (buchi 11 → 5), una girandola 68 (buchi 5 → 0), Avito r4 e Sdrushi3 girandola invariate (le prove non sono deterministiche: Smussa usa Math.random).
>
> **Compattazione: buchi in fondo alla strada (20 ottobre 2026).** Regola dell'utente: "se in una strada ci sono dei buchi, sposta gli edifici in modo da mettere quei buchi alla fine della strada; dopo il passo è semplice". compatta.ts, stadio 2b (`tentaRamo`, prima della potatura): per ogni ramo (tratto dritto da una punta fino al primo incrocio, innesto o curva) gli edifici attaccati ai due lati si impilano verso la radice (nell'ordine in cui erano, ognuno nel primo posto libero partendo dalla radice e mai più lontano di dov'era); il tappo (edificio oltre la punta) e i "compagni" (edifici di lato che sporgono oltre la punta) arretrano con la punta; la punta si accorcia del minimo, fra i due lati, delle celle libere dopo i compagni. Se un lato è pieno: un edificio passa dall'altro lato (nei buchi), oppure due edifici di lunghezza diversa si scambiano di lato (esempio dell'utente sulla Girandola: un 3 sopra con un 4 sotto). Si tiene solo se si tolgono strade e `valido()`; lato con un edificio fisso o municipio: niente cambi di lato. Campo `Compattazione.scorsi`. Prove sintetiche (Sdrushi2 girandola, verticale alta): togliendo un 4 a destra e un 3 a sinistra 71 → 68 strade (ottimo); togliendo solo il 4 a destra 71 → 69 (ottimo: 4 buchi su un lato = 2 celle per lato). Caso reale dell'utente (Sdrushi3, Girandola, ferma a 70 strade dopo ~42000 disposizioni; export in planner-test/Sdrushi3_girandola70.json, prova in bench/buchi_test.ts con bench/conv.py che converte il formato di export nel formato del banco): 2 buchi sopra la strada est, sotto pieno → scambio Osservatorio 3×3 (sopra) ↔ Capanna 4×4 (sotto), 70 → 69, anche ripartendo da quella disposizione con la ricerca (riprendiDa) come nell'app. Perché nell'app non succedeva (segnalazione dell'utente, localhost): la compattazione riceveva i `fissi` della ricerca (parte ovest fissata all'ultima ripresa), ma dopo adozioni e riprese alcuni di quegli edifici si trovano a EST della verticale; sulla Girandola di Sdrushi3 il 45081 (4×4) stava sopra la strada est e, fisso, bloccava i cambi di lato (`latoFermo`). Ora `compattaStato` passa solo i fissi ancora a ovest (`idOvest` dello stato da compattare) più quelli del builder. Inoltre `compattaCitta` ripete la passata (`compattaUnaVolta`) finché cambia qualcosa, al massimo `MAX_PASSATE` = 4, tenendo la migliore per strade e buchi (uno stadio può aprire una mossa a uno stadio precedente). Banco Sdrushi3 Girandola, seme 99, 12.000 disposizioni: 70 → 69; firme del banco invariate. Secondo caso dell'utente (Sdrushi3, Girandola 2, ferma a 70: planner-test/Sdrushi3_girandola2_70.json): braccio ovest con 1 buco sotto lungo la strada più la cella sotto il municipio; correzioni: (a) impilando, un edificio può sporgere oltre la radice del ramo (sotto il municipio) purché resti accanto ad almeno una cella del ramo (prima il bordo verso la radice era limitato all'ultima cella del ramo) → 2 buchi in punta; (b) tappo e compagni non solo traslano con la punta: se non c'è posto, ognuno va nel posto libero più vicino (fino a 4 celle per asse) che tocca una strada, provando tutti gli ordini (Progetto Arc si sposta, la Galassia blu scende di 1 accanto alla nuova punta); le celle dei compagni contano come libere nel calcolo di quanto arretrare; (c) Girandola: la compattazione non riceve più i fissi "a ovest" della ricerca (lì la verticale è solo un braccio e il braccio ovest restava tutto fermo). 70 → 69. Terzo caso dell'utente (Girandola 2 ferma anche dopo le smussate automatiche: planner-test/girandola2_101_esilio.json, prova con bench/export_test.ts dopo conv.py): "esilio" — un edificio di lato del ramo va in un buco altrove (`postoEsilio`: posto libero che tocca una strada, che non occupa celle accanto al ramo, il più incastrato cioè con più lati del contorno occupati), poi si impila e si accorcia come sempre; provato per ogni edificio mobile di lato (al massimo 20) prima dei cambi di lato, anche con un lato fermo. Lì: la Statua 2×3 in fondo alla strada est va nel buco 2×3 accanto alla verticale, la Locanda (tappo) scende sotto la strada e la Montagna (compagno) scende di 1 accanto alla nuova punta: 101 → 100. Nelle disposizioni del banco a 1500-4000 disposizioni il caso non si presenta (firme invariate; Avito r4: un ramo con 10 buchi da un lato ma senza spazio per far passare edifici dall'altra parte).
>
> **Squadra di ricerca: più semi in parallelo (20 ottobre 2026).** Segnalazione dell'utente: Avito r4 online (vecchio codice) 166 strade, in locale 168 con il doppio delle disposizioni. Causa: la ricerca locale accetta solo miglioramenti e si blocca in un minimo locale; il risultato dipende dal percorso, cioè dal seme (banco, Avito r4 a 15.000 disposizioni: semi 12345/7/99/2024/31337/5 → 170/170/167/167/171/166). Rimedio: `CompletionOptions.seme` (default 12345, `mulberry32(opts.seme ?? 12345)`) e `CompletionOptions.adotta()` — letta a ogni giro dei due cicli di ricerca (parametrica e locale) e un'ultima volta a fine ricerca (dopo COMPLETA): se restituisce una disposizione, la ricerca la adotta come una ripresa da modifiche manuali (`ripresa` + `adottata`; se ribasa vi trova edifici con strada scollegati la si scarta e si torna alla propria migliore). Protocollo worker: messaggio `adotta` (parallelo.ts la legge ogni FLAG_MS insieme ai flag). PlannerView (`corri`): per ogni scenario, oltre alla ricerca principale (seme 12345: quella mostrata, che va in pausa, si modifica e si completa), `semiRef - 1` aiutanti (`SEMI` = [12345, 5, 99, 2024], `soloRicerca`, worker propri); quanti: core (`navigator.hardwareConcurrency`) / scenari, fra 1 e 4. La principale adotta la disposizione di un'aiutante appena è migliore per [fuori, deficit, strade, buchi] (mai una con `search.scollegate` > 0: campo nuovo dei fotogrammi, insieme a `deficit` della ricerca parametrica). Le aiutanti si fermano a COMPLETA, in pausa e a fine corsa; alla ripresa ripartono (`riprendiDa`) dalla disposizione della principale, con le modifiche a mano. Il contatore delle disposizioni somma tutta la squadra. Banco `squadra.ts` (K ricerche nello stesso processo, ognuna con NVAL disposizioni; non deterministico): K=1 → K=3 a 2000 (Avito r4 a 5000): Avito r4 179 → 166, Stralis r3 150 → 141, Sonia r3 78 → 76, Rode r3 83 → 82, Filanush r4 259 → 258, Dani r3/Sdrushi2 r3/Beta r4/Beta gir/Diviziaco r3 invariate, Beta r3 76 → 77. Con un solo seme (K=1) le firme del banco sono invariate.
>
> **Builder: edifici scollegati nella partenza (20 ottobre 2026).** Trovato con la squadra su Dani r3: nella coppia fine-strada (Passo 6) il laterale è lungo quanto il capolinea (`trovaCoppia` ammette scarto 1 anche per lat.length = cap.length) e tocca la fine della strada solo in diagonale. La ricerca parametrica lo lasciava lì (contava come piazzato), la locale lo toglieva a ogni ribasa. Fix minimo (la scelta delle coppie non cambia; vietare quelle coppie cambiava 5 città con risultati misti): `runBuilder` toglie dalla tappa finale gli edifici con strada che non toccano strade (`togliScollegati`; anche dai `fissi`) e li ripiazza la ricerca. Unica partenza cambiata nel banco: Dani (r3 e r4, con e senza margine); Dani r3 a 1500 da 60 a 59 strade.
>
> **Partenza con o senza margine dal bordo (20 ottobre 2026).** Il Passo 7 del builder (fase1.ts) vieta agli angoli e al riempimento centrale le distanze 1, 2 e 3 dal bordo della mappa (`DISTANZE_BORDO_VIETATE`: margine 0 oppure >= 4). Misure (ricerca 1500, strade r3/r4): senza vincolo Stralis 150/148 → 133/136, Avito r4 179 → 174, ma Filanush lascia fuori 5/4 edifici con strada (anche con 4000-8000 disposizioni: r3 sempre 5 fuori, r4 0 fuori ma 290 strade invece di 259) e Dani r3 60 → 63, Rode 83/77 → 86/79; vietando solo 1-2 risultati intermedi. Scelta (idea concordata con l'utente): `Fase1Options.distanzeVietate` e `runBuilder(problem, { margineLibero })`; il Planner costruisce entrambe le partenze e, se diverse, all'avvio dello scenario (raccordo 3/4) fa una breve ricerca su ciascuna (`VALUTATE_SCELTA_MARGINE` = 800, in parallelo nei worker, `Scenario.alt`) e tiene la migliore: meno edifici con strada fuori, poi meno deficit, poi meno strade (a parità quella col margine). Simulazione sul banco (scelta a 800, ricerca a 1500): Stralis 133/136, Avito r4 174, Filanush/Rode/Sdrushi2 invariate, Dani r3 sceglie male (63 invece di 60: la breve ricerca è rumorosa); in totale −31 strade. Il banco ricerca.ts accetta MARGINE=1 e stampa anche i buchi.

> **Ottimizzatore più veloce + Web Worker (20 ottobre 2026).** Obiettivo dell'utente: più prestazioni nella fase di ottimizzazione (ricerca), il completamento finale escluso. Banco nuovo `planner-test/bench/ricerca.ts` (solo la ricerca, `soloRicerca`, NVAL fisso, stampa strade, tempo e una firma md5 della disposizione: le ottimizzazioni devono lasciare la firma IDENTICA), `ric.sh` (una esecuzione), `ric3.sh` (minimo di 3: il tempo nel sandbox è rumoroso), `cpuprof.py` (riepilogo di `node --cpu-prof`), `lavoratore_test.ts` e `par_test.ts` (worker). Per i profili per riga si transpila con `typescript.transpileModule` in /tmp/pbjs (le righe di --experimental-transform-types non corrispondono al sorgente). Interventi (tutti a risultato identico, verificato su 14 città/scenari a NVAL 1500):
> 1. **`piazzaBlocchi` su griglie numeriche**: BFS con Int32Array (stesso ordine di semi e vicini), celle oltre la punta e celle non libere in somme prefisse (fitsS e punte in O(1)), contorno di zona e coda calcolati in linea senza gli array di perimetroZona/perimetroCoda. Era il 70% del tempo nelle città con catene: Stefcape r3 56 → 8,6 s, Stralis r4 20 → 4,6 s.
> 2. **Strade con griglia**: `roads` (globale e copia per ogni simulazione, `RoadSet.copia()`) è un `RoadSet`; le 16 chiamate `roads.has(key(x, y))` sono `roads.hasXY(x, y)` (niente stringhe). `RoadSet`/`GridSet.hasXY` fuori dalla griglia rispondono falso senza creare stringhe se non ci sono chiavi fuori griglia (`fuoriN`, `fuori.size`).
> 3. `contaBuchi` espone `ultimeLibere`: la simulazione e il punteggio della ricerca locale non ricontano le celle libere. `pending()` ordina il pool una volta (e quando cresce) e poi filtra: stesso ordine (sort stabile). `free`/`fitsS` con accesso diretto alle griglie. `latoEstVerticale`/`dorsaliSecondarie` leggono le chiavi con indexOf (niente split/map/spread), `celleVerticale` è una griglia, la verifica di connessione usa `roads.hasXY` e un ciclo sui 4 vicini senza array.
> Tempi (un core, NVAL 1500): −16…−32% sulle città senza catene (Sdrushi2 r3 2,65 → 1,81 s, Sonia r3 2,82 → 2,01 s), −77…−85% su quelle con catene. Provato e SCARTATO: somme prefisse in `posizioni()` di rifinisciPunte (più lento nelle girandole: troppi ricalcoli). 4. **Web Worker** (`planner/lavoratore.ts` + `planner/parallelo.ts`): ogni chiamata a `runCompletion` / `scegliGirandola` del Planner gira in un worker suo (`runCompletionParallela`, `scegliGirandolaParallela`, stessa interfaccia): prima i 4 scenari si dividevano il thread della pagina, ora ognuno ha un core (sui PC con più core la ricerca di ogni scenario va fino a 4 volte più veloce) e la pagina resta reattiva. Comandi della pagina (shouldStop, shouldFinishSearch, isPaused, shouldStopFill) letti ogni 25 ms e mandati al worker quando cambiano; fotogrammi, pausa, ricerca/riempimento attivi e progresso come messaggi; `waitResume` = "attendi" → "riprendi" con la disposizione (Map/Set col clone strutturato). Worker incorporato nel file unico (`?worker&inline`, Blob URL o data: URL): CSP `worker-src 'self' blob: data:`. Il codice della ricerca ora è SOLO nel worker (il bundle principale non lo contiene più: index.html 1,58 → 1,60 MB). Il banco node usa `runCompletion` diretto come prima. Nel sandbox (1 core effettivo) l'accelerazione dei worker non si può misurare; `lavoratore_test.ts` verifica che il risultato nel worker sia identico e che pausa → attendi → riprendi funzioni. Strade in meno: a parità di disposizioni valutate i risultati sono identici; con più disposizioni nello stesso tempo qualche città migliora (Rode r3: 83 a 1500, 82 a 3000).

> **Compattazione prima del riempimento + catene (19 ottobre 2026, città di stefcape).** Nuovo modulo `src/planner/compatta.ts`, `compattaCitta(problem, placements, roads, fissi)`, parte dell'OTTIMIZZATORE (non di COMPLETA, richiesta dell'utente: COMPLETA deve solo inserire gli edifici senza strada): in `runCompletion` la disposizione migliore della ricerca (piano parametrico `best` e stato `migliore` della ricerca locale) viene compattata con `compattato(chiave, stato, forza)` (cache WeakMap per piano/stato, al massimo ogni `COMPATTA_OGNI_MS` = 1,5 s, sempre in pausa e a fine ricerca); la versione compattata è quella mostrata, quella da cui riparte la ricerca locale dopo la stagnazione, quella modificabile in pausa e quella che COMPLETA applica (al posto di `applica(piano)` / `ribasa(migliore)`). Costo sul banco: Stefcape r3 NVAL 1000 ~40 → ~46 s; risultati invariati. (1) **Fasce**: per ogni tratto di strada orizzontale e verticale (spezzato agli incroci/innesti, cioè alle celle con strade perpendicolari: raccordo del municipio, verticale e dorsale sono tratti diversi) le sue celle e gli edifici con strada che lo toccano si spostano di ±1..±3, da soli o insieme a fino a 3 tratti paralleli successivi nella direzione della mossa; gli edifici non fissi sulla traiettoria vengono SPINTI (max 15, es. i piccoli sul lato della verticale), le strade no; il municipio e i fissi bloccano. Mossa tenuta solo se tutto resta collegato (strade raggiungibili dal municipio, ogni edificio con strada tocca una strada raggiungibile, `toccaStradaZona` per le catene) e i BUCHI (celle libere che nessun edificio senza strada non piazzato con lati >= 2 può coprire, forme minimali come `contaBuchi`) diminuiscono; si ripete finché migliora (max 40 giri). Le strade non cambiano di numero. Misure (NVAL 800-1000, r3/r4): buchi Stefcape 80 → 71 e 91 → 68, Stralis 84 → 69 e 50 → 38, Beta 24 → 3; strade invariate. (2) **Catene**: un blocco con strade accanto agli anelli va, se esiste, in un posto libero dove la strada tocca la testa e non gli anelli (anche in punta a una strada); a parità meno buchi e più contatto. A questo punto della città raramente esiste (tutti i lati di strada sono già usati): nelle prove non è mai scattato. (3) **Potatura**: celle di strada in punta che non servono più a nessun edificio (Avito −2); se una punta serve solo a 1-2 edifici (non fissi), si prova a spostarli di 1-2 celle (anche in diagonale) perché tocchino un'altra strada, e la punta sparisce (segnalazione dell'utente: cella di strada accanto alla punta messa solo per un edificio che poteva attaccarsi alla punta stessa). Stefcape r3 137 → 136; Beta, Sonia, Stralis e le girandole di Sdrushi2/Dani/Rode invariate. (0, prima delle fasce) **Doppi angoli** (segnalazione dell'utente: due strade parallele sfalsate di 1-3 righe, che proseguono in versi opposti, unite da un breve raccordo a "Z"): si prova a portare un tratto, con i suoi edifici e spingendo quelli sulla traiettoria, sulla riga dell'altro, togliendo il raccordo (`sposta(..., togli)`); tenuto se tutto resta collegato (strade sempre in meno), fra le due mosse quella con meno buchi. Stefcape r3: una Z raddrizzata, strade 139 → 137; le altre Z di Stefcape (r3 vicino alla verticale, r4) restano perché bloccate dal bordo della mappa o da altre strade. Nota: la compattazione avviene al COMPLETA; durante la ricerca le Z possono ancora comparire. Altre correzioni: i blocchi di catena sono esclusi dagli scambi "grandi ↔ fine strada" (uno scambio metteva la catena lungo una strada con gli anelli attaccati); `Piano.stradeCoda` (strade accanto agli anelli) entra nel COSTO con `PESO_CODA_COSTO` e anche nel punteggio della ricerca locale. Peso 1 staccava le catene dalle strade ma costava strade (Stefcape 139 → 146, Stralis 150 → 157): scelta dell'utente MENO STRADE → 0,5 (risultati come prima). Banco: `planner-test/Stefcape.json` (vecchio formato, convertito da `stefcape.json`), bench.ts stampa la riga "Compattazione" e le strade accanto agli anelli di ogni blocco, render.py colora i blocchi di catena in viola; sync.sh copia compatta.ts.

> **Inattivi viola solo nella vista MAPPA (19 ottobre 2026).** `coloreEdificioMappa` non usa più `isInactive`: nel PNG, nel Planner e nell'editor un edificio inattivo è verde/azzurro secondo la strada richiesta (di norma azzurro). Il viola (`MAP_COLOR_INACTIVE`) resta solo in `getBuildingColor` della vista MAPPA e nella sua legenda.

> **Edifici che richiedono la strada a 2 corsie in verde scuro (19 ottobre 2026).** Nuovo `MAP_COLOR_ROAD2_REQUIRED = "#237a34"` (cityMapPng.ts); `coloreEdificioMappa` lo usa per `roadLevel >= 2` → vale per PNG, Planner ed editor (colori passati dal tool). Vista MAPPA: categoria `road2` in `mapCategory`/`getBuildingColor` e nuova voce di legenda "Richiede strada a 2 corsie" / "Requires 2-lane road" (`legendRoad2Required`, mostrata solo se ce ne sono) sotto "Richiede strada". Editor aperto da solo: `livelloStrada(e)` al posto di `noRoad(e)`, classe `.road2` (testo chiaro), livello esportato in `street_connection_level` e passato al PNG.

> **Zoom nell'editor (19 ottobre 2026).** Dopo Apri/Salva JSON/Salva PNG: pulsanti − / percentuale / + / reset (100%). `TILE` (lato cella in px) ora variabile, livelli `ZOOM` 4…40 (base 16 px = 100%: è il vecchio 80%, la mappa partiva troppo grande; testo degli edifici al 100% sempre 9 px); `zoomA` riposiziona aree (`areeEl`) ed edifici, ridimensiona la mappa, scala il testo (`--fs` su #map, usato da `.b`) e NON sposta la vista: la cella nell'angolo in alto a sinistra resta lì (prima teneva fermo il centro e la pagina scorreva a destra, header compreso). Layout: body a tutta altezza in colonna, header fisso, scorre solo `<main>` (`overflow:auto`); `<main>` ha sfondo nero come il fuori mappa (niente stacco), l'header resta blu scuro, così l'header non esce più dallo schermo scorrendo in orizzontale. Trascinamento, selezione a rettangolo e doppio clic usano già `TILE`, quindi funzionano a ogni zoom. Ctrl +/−/0 restano lo zoom del browser.

> **Editor in italiano/inglese (19 ottobre 2026).** Testi dell'editor in `TESTI.it`/`TESTI.en` (editor.html) applicati da `applicaLingua` (elementi con `data-t`, scorciatoie in `#hints` generate, testo della mappa vuota via `data-vuoto` + CSS `attr()`, messaggi di stato/alert, `<html lang>`, nome del municipio nel PNG). Lingua: quella del tool nel messaggio `carica` (`lang: uiLang`, da MAPPA e Planner); aperto da solo, `FoeCondiviso.linguaUi()` (src/editor/condiviso.ts: chiave salvata dal tool `foe_global_ui_lang_*` cercata per prefisso — importare utils/storage.ts portava pako e il pacchetto passava da 3 a 20 KB — poi lingua del browser come detectBrowserUiLang). I messaggi d'errore di "Applica" arrivano dal Planner e restano in italiano come il resto del Planner. Meta tag statici (description/og) in italiano.

> **editor.html: meta tag e file del sito (19 ottobre 2026).** Head allineato a guida.html/index.html: charset, viewport, CSP (come prima + `connect-src 'self'`, `img-src blob:`), referrer, description, author, application-name, **robots `noindex, follow`** (senza città caricata la pagina è vuota: si usa dal tool), theme-color `#1a1a2e`, color-scheme dark, format-detection, icone (32, 192, apple-touch), canonical, Open Graph + twitter card con og-image. **Non** in sitemap.xml (coerente con noindex); **non** collegato a site.webmanifest (scope `/` e start_url `/`: "installa" dall'editor installerebbe il tool, e l'editor è già dentro lo scope della PWA); robots.txt invariato (Allow: /); service worker invariato (editor.html come navigazione stale-while-revalidate, editor-condiviso.js cache-first, cache nuova a ogni build); llms.txt: aggiunta una riga sull'editor.

> **Intestazione degli scenari del Planner (19 ottobre 2026).** Tolta la riga viola con il log dello Smussa (stato `statoSmussa` eliminato). I pulsanti dello scenario (Sposta ←↑↓→, Specchia, ✏ Modifica, ⬇ PNG, ⬇ JSON, 🗑) stanno in una riga propria sotto "<scenario> piazzati: … disposizioni".

> **Export PNG con UN SOLO codice per tool ed editor (19 ottobre 2026).** Palette della vista MAPPA ed export PNG spostati da `CityMapView.tsx` nel nuovo modulo `src/components/cityMapPng.ts` (nessuna dipendenza da Preact o traduzioni): `MAP_COLOR_*`/`PNG_COLOR_*` esportati, `coloreEdificioMappa`, `wrapBuildingName`, `renderCityMapPng(canvas, edifici: PngEdificio[], aree, scala, nomeMunicipio)` — l'etichetta del municipio ora è un parametro (il tool passa `t("legendTownHall", uiLang)`), `PngEdificio.colore` facoltativo sostituisce il colore calcolato. Lo usano pannello MAPPA, Planner ed **editor**: `src/editor/condiviso.ts` mette `{ coloreEdificioMappa, renderCityMapPng }` in `window.FoeCondiviso`; l'editor lo carica da `/editor-condiviso.js`. Plugin `editorCondivisoPlugin` (vite.config.ts): in dev `/editor-condiviso.js` → redirect 302 a `/src/editor/condiviso.ts` (compilato da Vite al volo); in build, dopo il bundle principale, una seconda build Vite (libreria ES, `configFile:false`) scrive `dist/editor-condiviso.js` (~3 KB). Nell'editor nuovo pulsante **Salva PNG** dopo Salva JSON (stessa icona di download), nome `foe-editor-<data>.png`; il tool manda anche `nomeMunicipio` nel messaggio `carica`. knip: `src/editor/condiviso.ts` in `ignore` (non importato da nessuno, è un punto d'ingresso). Tolta la scritta "Caricata dal Planner". Test: build reale (dist/editor-condiviso.js generato) e confronto delle chiamate di disegno (canvas finto) fra export del tool e export dell'editor sulla stessa città: 4863 chiamate identiche.

> **Editor anche dal pannello MAPPA + header in stile FoE Optimizer (19 ottobre 2026).** Pulsante **Editor** (icona matita) accanto a PNG/JSON nel pannello MAPPA: `apriEditorMappa` (CityMapView.tsx) apre `/editor.html` (scheda `foe-editor-mappa`) e, al `{tipo:"pronto"}`, manda `{tipo:"carica", planner:false, json, colori}` (export JSON + `coloreEdificioMappa`). Con `planner:false` l'editor nasconde "Applica al Planner" e non mostra dettagli sotto il titolo (solo "Salva JSON"); dal Planner sotto il titolo compare "Planner · <scenario>". Header dell'editor come quello del tool: logo con l'icona lucide "swords" (riquadro 40×40, raggio 14, bordo amber-500/80, ombra ambra), titolo "EDITOR CITTÀ" font-black maiuscolo 20px con sfumatura amber-300→400→500, sfondo slate-950, header slate-900/60 con blur e linea amber-500/10, pulsanti slate-800/700. Fix: `[hidden]{display:none!important}` (prima `.btn{display:inline-flex}` vinceva sull'attributo `hidden` e "Applica al Planner" restava visibile); icona di "Salva JSON" = quella di "Apri JSON" con la freccia in giù; nessun messaggio di stato quando l'editor è aperto dalla MAPPA.

> **Strade del Planner tutte dello stesso colore (19 ottobre 2026).** `MapCanvas` non colora più di giallo le strade appena tracciate (`frame.lastPath` resta nei dati ma non si disegna): tutte col colore strada della vista MAPPA.

> **Editor esterno della città + canale bidirezionale col Planner (19 ottobre 2026).** `public/editor.html` (editor dell'utente, pubblicato accanto al tool, noindex): apre l'export JSON (nuovo/vecchio formato o payload del bookmarklet), sposta (trascina, anche in gruppo con selezione a rettangolo/Shift), cancella (Canc), annulla (Ctrl+Z), seleziona tutto (Ctrl+A), **doppio clic** su cella libera = nuova strada (tipo di strada 1×1 della città), doppio clic su strada = la toglie; bordo rosso + "Applica" disabilitato se ci sono edifici sovrapposti o fuori dall'area; **⬇ Salva JSON** nello stesso formato dell'export (CityEntities passati tali e quali, copie e strade nuove con id numerico nuovo). Palette della vista MAPPA (terreno #fffead con griglia #a89b3f, fuori mappa nero, bordi #1e293b); unico colore proprio: il tratteggio della selezione. **Canale** (`postMessage`, stessa origine, controllo di `origin` e `source`): nel Planner il pulsante **✏ Modifica** di ogni scenario (attivo in pausa, come le vecchie modifiche a mano, o a corsa finita) apre `/editor.html` in una scheda col nome dello scenario; l'editor manda `{tipo:"pronto"}`, il Planner risponde `{tipo:"carica", token, titolo, json, colori}` (json = `esportaCittaJson` con `idMap` id JSON → id della città; colori = `coloreEdificioMappa` per ogni voce, esatti come nel Planner); "✔ Applica al Planner" manda `{tipo:"applica", token, json}`, il Planner controlla con `cittaDaEditor` (`planner/editorPonte.ts`) e risponde `{tipo:"esito", ok, msg}`. Controlli: edifici riconosciuti via idMap (copie/edifici nuovi rifiutati), catene rimontate in blocco solo se tutti i pezzi sono rimasti insieme nella stessa forma (o tutti tolti), municipio presente, tutto nell'area sbloccata, niente sovrapposizioni, durante il completamento in pausa strade e municipio fermi (edifici con strada spostabili se attaccati a una strada, vedi 21 ottobre); scenario ancora in pausa e stessa corsa (`genRef`). Se va bene → `applicaManuale` (Riprendi/COMPLETA ripartono da lì; "↶ Annulla modifiche manuali" anche a corsa finita). **Tolte le modifiche dirette nel Planner** (trascina, tasto destro, clic su strada, riquadri degli edifici sovrapposti e blocco della ripresa): `MapCanvas` ora solo disegna (bordo rosso degli scollegati in pausa). Restano "Sposta tutto" e "Specchia". Test: harness jsdom sull'editor (carica, applica, doppio clic strada, Ctrl+Z, sovrapposizioni, messaggi da altra origine ignorati) e `cittaDaEditor` su Stralis/Filanush/città reale (catene spezzate, duplicati, fuori area, municipio tolto, completamento).

> **Export JSON della mappa = sottoinsieme del bookmarklet (19 ottobre 2026).** Nuovo modulo `src/data/cityMapJson.ts`. `esportaCittaJson(buildings, aree)` produce `{ CityMapData, CityEntities, UnlockedAreas }` con le stesse chiavi e la stessa forma del payload del bookmarklet, così il file si apre nei planner che leggono il payload intero (editor "Planner città" dell'utente, planner di Linnun): CityMapData = `{id, cityentity_id, type, x, y}` per edifici E strade (type "street", 1×1 o 2×2); CityEntities solo per gli edifici presenti = `{id, name, type, width, length, requirements.street_connection_level}` (livello richiesto, omesso se 0 e per le strade); UnlockedAreas come il bookmarklet (width/length solo se ≠ 4×4). Gli id non numerici (strade del Planner) ricevono un id numerico nuovo. Pulsante JSON del pannello MAPPA e nuovo pulsante **⬇ JSON** accanto a ⬇ PNG in ogni scenario del Planner (catene riscomposte, strade col tipo 1×1 della città, terreno come strisce orizzontali). `leggiCittaJson(testo)` (import del Planner) accetta il nuovo formato, il payload intero del bookmarklet (anche dentro `data`) e il VECCHIO formato `buildings/roads/unlocked_areas` (città del banco planner-test, invariate). Verificato: payload reale → export → reimport identico (439 edifici, 72 strade) e `parse()` dell'editor legge strade, GE, militari e municipio coi colori giusti.

> **Colori unificati MAPPA / PNG / Planner (19 ottobre 2026).** Palette della vista MAPPA come unica fonte: `coloreEdificioMappa(b)` in `CityMapView.tsx` (strada #8B7355, municipio #ffb300, inattivo rgba(88,28,135,0.45), Grande Edificio #e6542f, militare #92400E, con strada #5dd15d, senza strada #7abaff; stessa priorità di `mapCategory`, SENZA la zebra dei "collegati senza bisogno", che resta solo nella MAPPA). PNG (`renderCityMapPng`): edifici con `coloreEdificioMappa` (ora anche militari marroni e inattivi viola), strade disegnate come tessere col colore della mappa (la strada a 2 corsie è una tessera 2×2, prima erano celle grigie singole). Planner (`MapCanvas`): stessi colori per edifici e strade (in giallo restano le strade appena tracciate); `PlannerBuilding.isInactive` nuovo (da `buildPlannerProblem`). Spazio libero invariato: giallino in MAPPA e PNG, scuro nel Planner. Celle fuori mappa nere ovunque; griglia delle celle libere #a89b3f in MAPPA e PNG.

> **catene.json per il Planner (15 ottobre 2026).** Nuovo script `catene.py` (RECUPERO DATI, in `PIPELINE_INFO` di `aggiorna_dati.py`, output in `OPTIONAL_OUTPUTS` → `src/assets/catene.json`, ~24 KB). Non tocca buildings.csv né le tabelle efficienza. Legge i due MainParser (beta e live, uniti per ID: contiene anche i vecchi ID R_/D_ del live) e BuildingChains*/BuildingSets*. Formato: `{versione:1, catene:{chainId:{inizi:[id], anelli:[id]}}, edifici:{id:{catena, ruolo:"inizio"|"anello", aggancio:[[x1,y1,x2,y2],…]}}, set:{setId:{edifici:[id], stessoTipo}}}`. `aggancio` = rettangoli (estremi inclusi) relativi all'angolo in alto a sinistra dell'edificio, coordinate della mappa (x = larghezza, y = altezza, y verso il basso): il pezzo successivo è collegato se occupa esattamente uno di essi. Due formati nel gioco: `components.<era>.chain` (ChainStartConfig/ChainLinkConfig) e il vecchio `abilities` (ChainStartAbility/ChainLinkAbility). Gli inizi NON sono in BuildingChains (solo gli anelli): si trovano scorrendo CityEntities. Esclusi gli insediamenti (H_*, J_*: Moghul). Oggi 10 catene (165 edifici, tutti i livelli) e 13 set. Verifica: treno d'inverno di Filanush, 15 vagoni su 15 riconosciuti collegati seguendo gli agganci. Tutte le catene, montate, formano un RETTANGOLO (es. Statua 4×3 + N Strade 2×3 = (4+2N)×3; treno 3×7 + N vagoni 3×2 in colonna); gli inizi richiedono strada, gli anelli no.

> **ID rinominati sulla beta (15 ottobre 2026).** Dal 13 ottobre la beta ha rinominato i premi dei Campi di battaglia (`R_MultiAge_Battlegrounds1a…3h*`, `D_MultiAge_Battlegrounds2/4`: Statua all'onore, Il Gran elefante, Strada per la vittoria, Giardino iridescente) in `W_MultiAge_Battlegrounds*`, con `asset_id` = vecchio ID; il server italiano (live) usa ancora i vecchi ID. Effetti: `NomeIta` vuoto (il nome italiano si cercava per ID) e, peggio, le 20 righe coi vecchi ID sparite da `buildings.csv` (le città del live con questi edifici non venivano riconosciute). Fix in `buildings.py`: `id_live` = `asset_id` quando l'ID beta manca dal MainParser italiano, l'`asset_id` c'è e non è un altro edificio della beta → `NomeIta` dal vecchio ID e una **riga gemella** col vecchio ID e gli stessi dati (contatore "righe gemelle col vecchio ID" nel log). `src/assets/buildings.csv` corretto a mano allo stesso modo (20 nomi + 20 righe, Light copiata dalla riga W_).

> **Nuovo formato `productionRewardData` (15 ottobre 2026).** Inno ha sostituito `productionReward` ({era: {livello: reward}}) con `productionRewardData` = `{base: {era: reward senza quantità}, levelAmounts: [0, liv1, …, liv110], names: {era: {"<valore>": "<valore> Forge Points"/"… Goods"/"… Previous Age Goods"}}}` (i valori sono già i totali mostrati in gioco). `allies.py` non lo leggeva: Val1 vuoto per i leggendari "rare" con premio truppe (Re Artù, Merlino, Morgana, … valore 6) e PF/Beni/BeniP/Val1 vuoti per gli alleati scienza (Fibonacci, Indradevi). Fix: `_con_produzione(rarity_info)` ricostruisce un `productionReward` nel vecchio formato (prima era, livelli 1..110 da `levelAmounts`, nome da `names[era][str(valore)]`), chiamata all'inizio di `resolve_val1_and_flags` e `resolve_production_columns`. Verificato: l'`allies.csv` rigenerato è identico a quello del giorno prima (`alliesOLD.csv`).

> **Livello 100, non max(chiavi) (ottobre 2026).** Dal 2026 le tabelle `productionReward`/`rarityBoosts`/`limitedBonuses` di `Allies.txt` arrivano al livello **110**, ma il cap reale è **100** (`Allies.rarities[*].maxLevel = 100`, `levelUpCosts` si ferma a 100, nessun alleato posseduto ≥ 100). `allies.py` leggeva l'ultima chiave (110): PF/Beni/BeniP erano quelli del 110 (es. Fibonacci rara 215 invece di 200). Ora `ALLY_MAX_LEVEL_KEY = "100"`. Scoperto perché `confronta_allies.py` era cieco sugli alleati science (confrontava solo boost d'esercito, tutti 0): ora `linnun.py` esporta PF/Beni/BeniP da «Value @100» (tipo dal flag raw 11/13/14) e `confronta_allies.py` li confronta; lo script è in `PIPELINE_INFO` di `aggiorna_dati.py` e legge l'`allies.csv` appena generato. Unica discrepanza residua con Linnun: Fibonacci comune 65 → 60.
`getComputedAllyStats` a runtime, non il CSV. Estratte da
`allies.py::resolve_production_columns`, che distingue i tre casi dal campo
`name` del reward (`"Forge Points"` / `"Previous Age Goods"` / `"Goods"`), e usa
`totalAmount` invece di `amount` quando presente — il reward espone ENTRAMBI i
campi per i Beni (`amount` = quantità di ciascun bene, `totalAmount` = somma su
tutti i beni dell'era, es. amount=26 → totalAmount=130 con 5 beni): il valore
mostrato in game (e quello coerente con `buildings.csv`) è sempre `totalAmount`.
Nessuna colonna valorizzata per i 38 alleati "military" (fail-fast implicito:
se in futuro Inno introduce un quarto tipo di reward non riconosciuto dai tre
pattern di `name`, la funzione ritorna vuoto invece di un valore arbitrario).

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

### 8.4bis `unique.csv` — edifici non ottenibili da kit (luglio 2026)

Formato minimale: un `cityEntityId` per riga, senza intestazione, senza altre
colonne. Elenca gli edifici `W_MultiAge_*` che NON sono ottenibili tramite
nessun kit di selezione o di aggiornamento posseduto — tipicamente i premi
diretti di lega oro/argento degli eventi, che quindi l'ottimizzatore
dell'inventario (§16) non può mai "costruire" a partire da un kit, perché non
sono il risultato di un assemblaggio.

Caricato da `data/uniqueBuildings.ts` con lo stesso pattern `?raw` di
`events.csv` → `EVENTS_LIST` (import statico Vite, `Set<string>` costruito una
tantum a livello di modulo — niente `fetch`/`useState`), che espone
`isUniqueBuildingId(id)`. `buildings.ts` la usa per valorizzare
`Building.unique` al parsing (§7, §12), stesso punto/stile dei flag di
classificazione (`isGreatBuilding`/`isMilitary`/`isGoods`/`isInactive`).

Generato da `unique.py` nella pipeline RECUPERO DATI (§8bis), step
`PIPELINE_INFO` **non bloccante** di `aggiorna_dati.py`, eseguito DOPO
`parse_kit.py` perché legge sia `MainParser.txt` sia `kit.json`: confronta
ogni `building_id` del `MainParser` con `buildingUpgrades.steps` e
`selectionKits.options` di `kit.json` — se non compare in nessuno dei due,
l'edificio è "unico". Include una whitelist esplicita di 8 eccezioni note
(entrambi i livelli di 4 building set — CARE25E, FALL23B, HIS26F, ANNI26E —
dove sia il livello 1 sia il livello 2 sono premi di lega distinti, non un
building normale semplicemente potenziato da un kit qualsiasi; il pattern
dati che li caratterizza non è generalizzabile in automatico, perché è lo
stesso schema di ~180 building set del gioco che *sono* costruiti da kit
normalmente — vedi i commenti in testa a `unique.py` per il dettaglio).

**Uso visivo attuale, SOLO in tab Database** (§24.3bis): il `<td
className="cell-name">` di `BuildingRow` riceve la classe aggiuntiva
`unique` quando `activeTab === "database" && b.unique`, e
`.building-table tbody td.cell-name.unique { color: gold; }` (`index.css`)
colora il testo del nome in oro. Non applicato a Città/Inventario/Alleati.

### 8.4ter `Building.flags` — bitmask grezzo e getter derivati (agosto 2026)

Fino ad agosto 2026 esisteva solo `Building.noRush`, un booleano
precalcolato lato pipeline Python. Refactor: `buildings.py` ora salva nel
CSV il bitmask INTERO di `components.AllAge.flags.flags` (colonna `Flags`,
sostituisce `NoRush`), e l'interpretazione bit-per-bit è delegata
interamente a `data/buildings.ts` — motivazione: poter gestire altri bit
in futuro (es. `isEraMutable`, aggiunto subito dopo questo refactor) senza
più dover toccare la pipeline Python né rigenerare il CSV con una nuova
colonna dedicata per ognuno.

`Building.flags?: number` — valore intero grezzo, `undefined` se
l'edificio non ha quel campo nel MainParser. Costanti bitmask raggruppate
nell'oggetto `KNOWN_FLAGS` in `data/buildings.ts` (non `export`, usate
solo internamente al file — vedi §SKILL.md per il perché del
raggruppamento invece di 6 `const` isolate): `SELLABLE` (bit 0,
isSellable), `MOVABLE` (bit 1 — attenzione, NON è "richiede strada": è la
proprietà `movable` del costruttore client `Mob`/`CityMapEntityPlacement`,
un concetto di piazzamento/collisione fisico generale di cui la strada è
solo un sotto-caso; diverge da `requires_road()`/colonna `Road` su
505/1370 edifici), `ERA_MUTABLE` (bit 2, "auto-aging"), `PLUNDERABLE`
(bit 3, isPlunderable), `STORABLE` (bit 4, isStorable — bug Inno
FOE-96714 su 3 edifici Ascended FALL21/FALL26 con bit4 spento ma resi
storable in game, confermato RISOLTO ad agosto 2026 verificando il
MainParser del 18/8: nessuna eccezione nota residua),
`NO_RUSH` (bit 5, fspDisabled). Nomi/semantiche ufficiali confermate
da Linnun leggendo il codice client minificato, non solo dedotte
empiricamente — vedi buildings.py (commento sopra `extract_flags()`) per
la mappa completa e la storia dell'indagine. Helper generico (anch'esso
non `export`): `hasFlag(flags, KNOWN_FLAGS.X): boolean`.

Getter derivati (non campi salvati sull'oggetto — ricalcolati al volo da
`b.flags`, stesso comportamento della vecchia proprietà booleana
precalcolata, solo senza precalcolo):

- **`noRush(b): boolean`** (bit 5) — indica che la produzione dell'edificio
  NON può essere terminata all'istante con i Frammenti di Termina
  produzione speciale — "Instant production finish disabled" nel gioco
  stesso. Il motivo di gioco: il FSP ha effetto solo sulle produzioni, e
  una raccolta è normalmente disponibile ogni 24h, ma con FSP se ne
  possono fare più d'una in pochi istanti; per gli edifici che producono
  frammenti "pregiati" questo permetterebbe di assemblare più copie di
  edifici top nel giro di pochi minuti — da qui il flag di disabilitazione
  su un sottoinsieme di edifici (non necessariamente solo quelli che
  producono frammenti: verificato che alcuni NoRush non producono nulla,
  es. Forgotten Temple e Ancient Temple, entrambi rushabili in game
  nonostante compaiano come `limited`/`cityLimit`). Criterio bit 5
  validato empiricamente sia sui dati sia IN GAME (dopo due tentativi
  scartati basati su `limited`/`cityLimit`, entrambi smentiti da Forgotten
  Temple/Ancient Temple). Confrontato anche col foglio di Linnun in
  `confronta_buildings.py` (vedi sotto).
- **`isEraMutable(b): boolean`** (bit 2, agosto 2026) — l'edificio si
  aggiorna automaticamente all'era della città ("auto-aging"), senza
  bisogno di un kit di aggiornamento manuale. Validato empiricamente su un
  campione controllato di 18 edifici auto-aging noti vs 33 non-auto-aging
  (zero eccezioni), poi confermato dal nome ufficiale letto nel codice
  client da Linnun.

Entrambi i getter funzionano identicamente per edifici letti dal CSV
Database E per quelli con override città/inventario, perché `flags` non
ha logica di override per-città (proprietà statica dell'edificio, come
`unique`).

**Uso visivo, in TUTTE le tab** (a differenza di `unique`, scoped a
Database): `BuildingRow` renderizza, subito dopo lo `<span>` del nome e
prima del badge `isGreatBuilding`, icone SVG inline (non emoji — dà
controllo diretto su stroke/fill invece del glifo con colore/riempimento
fissi), in sequenza:

1. `noRush(b)` → cerchio + barra diagonale (simbolo "divieto"), stroke
   rosso scuro (`#7f1d1d`), fill trasparente, 12×12px (`viewBox 0 0 24 24`,
   `r=10`, `strokeWidth=2.5`), traslata di 1px in basso (`relative
   top-px`) per allineamento ottico col testo. Iterazioni scartate prima
   di arrivare all'SVG: emoji 🚫 a piena opacità (giudicata troppo
   invasiva/colore troppo acceso), emoji 🔒 (giudicata comunque troppo
   presente su ~118/2100 edifici, spingeva la colonna Time). Tooltip =
   testo ufficiale del gioco, chiave i18n `noRushBadgeTitle` in
   `ui-strings.ts` (it: "Completa istantaneamente produzione disabilitato",
   en: "Instant production finish disabled").
2. `isEraMutable(b)` (agosto 2026) → stesso cerchio identico (stesso
   `viewBox`/`r`/`strokeWidth`/traslazione del divieto, scelto
   deliberatamente per coerenza dimensionale tra i due badge), ma stroke
   ciano scuro (`#0e7490`) e un chevron verso l'alto al posto della barra
   diagonale (`polyline points="8 14 12 10 16 14"`, richiama "sale di
   livello/era da solo"). Tooltip chiave i18n `eraMutableBadgeTitle` (it:
   "Si aggiorna automaticamente alla tua era", en: "Automatically
   upgrades to your age").

**Due pulsanti "Nascondi 🚫"/"Nascondi ^"** (agosto 2026), dentro l'header
di gruppo "📦 PRODUZIONI" della tabella (il `<th colSpan={20}>` che titola
le colonne di produzione — non la toolbar dei toggle sopra la tabella),
affiancati dentro un unico `<div className="absolute left-2 top-1/2
-translate-y-1/2 flex items-center gap-1">` (con `relative` sul `<th>`
stesso). Nascondono rispettivamente le righe con `noRush(b) === true` e
`isEraMutable(b) === true`, in tutte le tab. Stato `hideNoRush`/
`hideEraMutable`, entrambi globali e persistenti come gli altri toggle
della toolbar (chiavi localStorage `HIDE_NO_RUSH_KEY`/
`HIDE_ERA_MUTABLE_KEY`, stesso pattern di `showProdColumns`/
`PROD_COLUMNS_KEY` in `storage.ts`). Applicati dentro il loop di
`filteredBuildings` (`if (hideNoRush && noRush(b)) continue;` e
`if (hideEraMutable && isEraMutable(b)) continue;`), entrambi tra le
dipendenze del `useMemo` — non fanno parte di `TabFilters`/
`currentFilters` perché non sono per-tab. Ogni pulsante riusa lo stesso
SVG inline del badge corrispondente (divieto rosso `#7f1d1d` per NoRush,
cerchio ciano `#0e7490` con chevron per EraMutable, entrambi 12×12px)
anziché un'emoji, con etichetta testuale breve PRIMA dell'icona
(`hideNoRushLabel`/`hideEraMutableLabel`, "Nascondi"/"Hide" poi l'SVG) e
tooltip che cambia in base allo stato (`hideNoRushTitle`/
`hideNoRushActiveTitle` e `hideEraMutableTitle`/
`hideEraMutableActiveTitle`). Stile a riposo allineato a
`.toggle-icon-btn` (`border-slate-700/50`, `bg-transparent`, hover
`border-slate-500`) senza riusare la classe condivisa (dimensioni e
`position: absolute` diversi da quel pattern).

Due reset automatici per ENTRAMBI i toggle (agosto 2026), per evitare che
i filtri restino attivi senza un modo visibile di disattivarli: il
pulsante "Reset filtri" chiama `setHideNoRush(false)` E
`setHideEraMutable(false)` insieme al reset di `TabFilters` (pur essendo
entrambi toggle globali, non per-tab); e l'`onClick` del pulsante 📦
(`setShowProdColumns`) resetta ENTRAMBI a `false` quando la sezione
Produzioni viene nascosta (transizione `true` → `false`), perché
altrimenti i due pulsanti "Nascondi" — che vivono dentro quella sezione —
sparirebbero dalla UI lasciando i filtri attivi senza modo di
disattivarli.

`confronta_buildings.py` (report discrepanze vs foglio Linnun, nuovo
`kind = "presence"`, colonna sheet `Prop` col token `"I"`) non legge
`Flags` direttamente: subito dopo aver caricato il CSV `game` in `main()`,
ricostruisce una colonna `NoRush` ("1"/vuoto) da bit 5 di `Flags`, così la
riga `("NoRush", ..., "presence")` in `SECTIONS` e tutta la logica di
confronto sotto restano invariate, senza dover sapere nulla del bitmask.

⚠️ **Nota per chi rigenera i dati**: il CSV di produzione in
`src/assets/buildings.csv` deve avere la colonna `Flags` (non più
`NoRush`) perché l'app funzioni — va rigenerato con la pipeline completa
(`aggiorna_dati.py` o almeno `buildings.py` + `lin_inject.py`) dopo questo
refactor, altrimenti `b.flags` resta sempre `undefined` e i due badge
spariscono silenziosamente per tutti gli edifici.

### 8.5 `kit.json` — catene di upgrade e selection kit

È il file che alimenta l'ottimizzatore (§16). Ha due sezioni:

- **`buildingUpgrades`**: un dizionario `kitId → { name, steps, requiredFragments? }`.
  Ogni `steps` è la sequenza completa di ID edificio che descrive l'evoluzione di un
  edificio attraverso i suoi livelli. Es. `upgrade_kit_maypole` ha `steps:
  [A_MultiAge_MayDayBonus16, A_MultiAge_MayDayBonus17, A_MultiAge_MayDayBonus17b]`. Uno
  step può essere un array (es. finale ramificato dove il giocatore sceglie una
  variante). Ci sono ~483 catene.
- **`selectionKits`**: un dizionario `kitId → { name, options, requiredFragments? }`.
  Ogni `options` è la lista di ID che quel kit di selezione può produrre. Ci sono ~441
  selection kit.
- **`requiredFragmentsByBuilding`** (agosto 2026): un terzo dizionario a livello
  radice, `cityEntityId → requiredFragments`, per i frammenti che assemblano
  direttamente un EDIFICIO invece di un kit (es. `W_MultiAge_FALL23F2` produce
  frammenti di `W_MultiAge_FALL23D2`, 100 richiesti in totale) — caso a parte perché
  non esiste un blocco `buildingUpgrades`/`selectionKits` indicizzato per
  edificio-obiettivo di frammenti. 15 edifici coperti nel MainParser attuale.

**`requiredFragments`** (agosto 2026, opzionale su entrambe le sezioni): il numero
TOTALE di frammenti necessari per assemblare quel kit tramite raccolta. `parse_kit.py`
lo legge scansionando `CityEntities[*].components[*].lookup.rewards[*]` del MainParser
alla ricerca di blocchi `__class__: "FragmentReward"`, prendendo `requiredAmount`
(stesso blocco da cui, lato `buildings.py`, si legge anche l'`amount` per-raccolta che
finisce nella colonna `Fragments` del CSV — vedi §11). Assente per i kit/edifici non
ottenibili per frammenti (solo acquisto/evento diretto): su 219 kit con dato frammenti
nel MainParser attuale, 15 sono di tipo edificio (`requiredFragmentsByBuilding`), il
resto selection/upgrade kit. Verificato: 0 incoerenze tra le occorrenze dello stesso
kit/edificio ripetute in punti diversi del file (13082 occorrenze totali).

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
  `city_entities_to_csv.py`). Da settembre 2026 estrae anche Pop/Fel/Mon/Mat degli
  edifici standard d'era (dati a livello radice, §13.3) e non va più in errore sui
  livelli senza `value` in `production_values` (KeyError possibile solo girando a
  StoneAge, emerso nel confronto TS↔Python su tutte le ere).
  Il parser del FileList usa una scansione a graffe bilanciate (robusta
  all'annidamento), la stessa tecnica di `getIcons.py`. `BOOST_ERA`/`PREV_ERA`
  (l'era corrente/precedente usate per estrarre boost/statistiche/blueprint,
  ~30 punti nel file) sono lette dinamicamente da `ages.db` invece di essere
  due stringhe hardcoded — vedi §8bis.5.
- **`allies.py`** — genera `allies.csv` da `Allies.txt`/`Allies_ita.txt`. Il parsing
  tollera tre formati (nuovo `{"Allies":{...}}`, vecchio `MainParser.Allies`, oggetto
  bare — così funziona anche sui file d'archivio) e recupera gli alleati completi
  anche da file troncati.
- **`linnun.py`**, **`lin_inject.py`**, **`confronta_buildings.py`** — modello
  predittivo per la colonna `Light` (db di training protetto `lin_training.db`); i nomi
  alleati arrivano dagli stessi file Allies. ⚠️ Il modello usa Pop/Fel/Mon/Mat come
  feature: quando `buildings.py` ha iniziato a riempirle per gli edifici standard d'era
  (settembre 2026), alcuni di questi (es. `P_IronAge_Butcher`) uscivano dal fallback
  "nessuna statistica" ed entravano nel modello, cambiandone il training e quindi il
  `Light` di 17 ALTRI edifici. Per questo `lin_inject.py` ha una regola ferrea
  esplicita (`STANDARD_ERA_RE`: `A_`/`D_`/`P_`/`R_` non MultiAge/AllAge → 0), che
  ripristina esattamente la partizione di prima: verificato, `Light` identico prima e
  dopo. Nota: il `Light` non è riproducibile al 100% tra ambienti diversi
  (GradientBoosting e versioni di scikit-learn): nella sandbox Linux esce un solo
  valore diverso da quello generato su Windows (`W_MultiAge_HAL26F1`).
  **`confronta_buildings.py` confronta TR col totale TR+TRNE del foglio di Linnun**:
  il foglio ha una sola colonna "Units" (mai un vero split TR/TRNE), quindi questo
  script valida solo il totale, non la ripartizione. La ripartizione era comunque
  sbagliata in un caso preciso (settembre 2026), corretta SOLO lato TS
  (Città/Inventario) e non qui: il Database mostra sempre la classificazione
  strutturale, invariata. Vedi §13.3bis.
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

### 8bis.5 Supporto a nuove ere: `ages.db` (luglio 2026)

Quando FoE rilascia una nuova era di gioco (es. ipotetica "Stellar Age
Discovery"), l'app TypeScript la supporta **senza alcuna modifica di
codice**: basta aggiungere una riga a `src/assets/ages.csv` (§7, §10) — il
parsing in `data/ages.ts` è già completamente dinamico (nessuna era è mai
elencata esplicitamente in un array/union type/switch nel frontend).

L'unico punto che richiedeva un aggiornamento manuale era la pipeline Python:
`buildings.py` aveva due costanti hardcoded, `BOOST_ERA = "SpaceAgeSpaceHub"`
e `PREV_ERA = "SpaceAgeTitan"`, usate in ~30 punti per estrarre boost
militari/IQ, statistiche e blueprint "dell'era corrente" dal `MainParser`
(oltre a una regex `SpaceAgeSpaceHub(\d+)` per un reward id "higher age
chest"). Senza aggiornarle a ogni nuova era, lo script avrebbe continuato a
leggere silenziosamente i dati dalla vecchia era (ormai penultima),
producendo un `buildings.csv` con statistiche stagnanti per tutti gli
edifici multi-era.

**Risolto rendendo `BOOST_ERA`/`PREV_ERA` derivate da un file esterno,
`ages.db`** (in RECUPERO DATI, fuori dal repo dell'app): stesso identico
formato/contenuto di `src/assets/ages.csv` (`id;age;NomeIta;NomeEng`),
rinominato apposta in `.db` per non essere cancellato per errore insieme
agli altri `.csv` temporanei della pipeline (§8bis.3). All'avvio,
`_load_boost_and_prev_era()` legge `ages.db`, ordina per `id` e restituisce
`(era_con_id_più_alto, era_precedente)` — fail-fast (`SystemExit`) se il
file manca o contiene meno di 2 righe, per non produrre silenziosamente un
CSV con dati sbagliati. La regex `SpaceAgeSpaceHub(\d+)` diventa
`re.escape(BOOST_ERA) + r"(\d+)"`, costruita a runtime.

**Lato TypeScript**, lo stesso pattern hardcoded esisteva in
`BuildingModel.bpFromRewardId` (§13): una regex `/SpaceAgeSpaceHub(\d+)/`
per lo stesso reward id "higher age chest". Qui non serve leggere un file
a parte: `FALLBACK_ERA` (`data/ages.ts`, §10) è già per definizione "il
codice dell'era con l'id più alto in `ages.csv`" — la regex è quindi
costruita con `new RegExp(\`${FALLBACK_ERA}(\\d+)\`)`, riusando un valore
già importato nel modulo.

**Nota per chi aggiunge una nuova era in futuro**: `ages.db` (Python) e
`ages.csv` (TypeScript) restano DUE file fisicamente distinti — vivono in
due repo separati (pipeline dati esterna vs. app) — e vanno editati
entrambi a mano, con lo stesso id/nome era, esattamente come già avviene
per buildings.csv/allies.csv/kit.json quando cambia qualcosa lato dati. Non
esiste un meccanismo che li tenga sincronizzati automaticamente.

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

**Formato dei token nella colonna `Fragments`** (agosto 2026): ogni token è
`<fid>:<amount>`, dove `<fid>` è l'id building/kit (come prima) e `<amount>`
è quanti frammenti produce QUESTA raccolta specifica — stabile per ogni
coppia edificio+kit, indipendente dall'era (verificato empiricamente:
nessuna variazione tra le 23 ere sull'edificio di test). L'amount era già
nella chiave grezza del reward nel MainParser (es.
`"fragment#selection_kit_CARE26BC#2"`) ma prima veniva scartato da
`extract_fragments` in `buildings.py`; ora viene riletto invece di buttato
via. Un edificio può produrre frammenti di PIÙ kit/edifici diversi
contemporaneamente (token multipli separati da `|`, es.
`W_MultiAge_CARE26A8` → `golden_upgrade_kit_CARE26A:5|selection_kit_CARE26BC:2`).
Dati storici senza `:amount` restano supportati lato parsing (fallback
`amountPerCollection: undefined`).

**Il numero TOTALE richiesto per assemblare** (quante volte va ripetuta la
raccolta) vive in `kit.json`, non nel CSV — tre fonti diverse a seconda del
tipo di frammento, tutte popolate da `parse_kit.py` leggendo `requiredAmount`
dai blocchi `FragmentReward` del MainParser (`CityEntities[*].components[*].lookup.rewards[*]`):
- `KIT_RAW.selectionKits[kitId].requiredFragments` — per i selection kit.
- `KIT_RAW.buildingUpgrades[kitId].requiredFragments` — per gli upgrade kit.
- `KIT_RAW.requiredFragmentsByBuilding[cityEntityId]` — per i frammenti che
  assemblano direttamente un EDIFICIO invece di un kit (es.
  `W_MultiAge_FALL23F2` produce frammenti di `W_MultiAge_FALL23D2`, 100
  richiesti in totale): caso a parte perché non esiste un blocco
  buildingUpgrades/selectionKits indicizzato per edificio-obiettivo.
  Chiave senza il prefisso `building_` (rimosso in `parse_kit.py`).
Tutti e tre i campi sono opzionali: assenti per i kit/edifici non ottenibili
per frammenti (es. solo acquisto/evento diretto) — su 219 kit totali con
dato frammenti nel MainParser attuale, 15 sono di tipo edificio.
Verificato: 0 incoerenze tra le occorrenze dello stesso kit/edificio in punti
diversi del file (13082 occorrenze totali, agosto 2026).

Il tooltip del badge frammenti (§24.3, `fragmentTooltip`) mostra
"(prodotti/richiesti)" accanto al nome SOLO quando entrambi i numeri sono
noti — un singolo valore isolato ("4/?" o "?/15") confonderebbe più che
aiutare.

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
righe della tabella (presentazione, ma centralizzate qui). ⚠️ Invariante: ogni colore
di riga (hover inclusi) deve essere OPACO — le celle sticky della tabella principale
lo ereditano con `background-color: inherit` e un colore semi-trasparente lascia
filtrare il testo delle colonne scrollate (ghosting). Le categorie
goods/inactive/fallback/normal usano le classi `.row-*` di `index.css` (composito
opaco `color-mix(in srgb, …)` sull'ambiente, visivamente identico alle vecchie
utility `/NN`); great/military restano utility Tailwind opache. L'overlay
"disconnesso" è un `background-image` sulla `<tr>`, propagato alle celle sticky con
`background-image: inherit` (vedi `index.css`).

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
  nel CSV, mostrate all'inizio della sezione IQ in tabella);
- assegna `unique: isUniqueBuildingId(cityEntityId)` (luglio 2026), stesso punto/
  stile dei flag di classificazione sopra, ma NON derivato da una colonna del CSV
  edifici: `isUniqueBuildingId` (in `data/uniqueBuildings.ts`) consulta un
  `Set<string>` costruito da un file esterno separato, `assets/unique.csv` (un
  `cityEntityId` per riga, senza intestazione) — vedi §8 per la fonte e §24.3bis
  per l'uso visivo in tabella;
- assegna `noRush: getText(parts, "NoRush") === "1"` (agosto 2026), stesso
  punto/stile, ma QUESTO sì derivato da una colonna del CSV edifici
  (`NoRush`, generata da `calc_no_rush()` in `buildings.py`) — vedi §8.4ter
  per il criterio e l'uso visivo in tabella.

### `getImageUrl(id, hash)`
Costruisce l'URL dell'immagine dell'edificio dai due formati di hash possibili. Se
l'hash contiene un trattino, è già il nome file completo; altrimenti viene combinato
con l'id. Poi inietta `SS_` dopo il primo underscore e antepone l'URL base del CDN di
Inno (`IMAGE_BASE_URL`). Restituisce `null` se non c'è hash o l'id non ha underscore.

---

## 13. Il modello di dominio (`BuildingModel.ts`)

> **Coerenza TS↔Python validata (luglio 2026, estesa a TUTTE le ere a settembre
> 2026).** Tutti gli estrattori di questo modulo sono traduzioni fedeli
> riga-per-riga degli algoritmi di `buildings.py` (RECUPERO DATI). Validazione
> attuale (MainParser del 27/09/2026): (1) `extractEraStats` confrontato col
> Python su **tutte le 2858 entità × tutte le 24 ere × tutti i campi** (il Python
> girato con BOOST_ERA/PREV_ERA/BOOST_ERA_ID impostati via via su ogni era):
> nessuna differenza; (2) TS vs `buildings.csv` all'era massima, 2178 righe × 53
> colonne (statistiche, boost, Road, Size, Time, Ally, Flags): nessuna differenza,
> MANUAL_OVERRIDES inclusi. Storia: il test di luglio (solo era massima) aveva
> fatto aggiungere in `extractGoods` il ramo `entity_levels`/`era_goods` (13
> edifici `P_*` storici con beni=0) e il ramo `RandomChestRewardAbility`-beni;
> quello di settembre (tutte le ere) ha trovato il BP "higher_age" cercato con
> l'era massima invece che con l'era estratta (§13.3). Qualsiasi modifica agli
> estrattori (di qua o di là) va validata rieseguendo il confronto SU TUTTE LE
> ERE: in tab Città/Inventario il TS gira all'era del giocatore, non a quella
> massima come il CSV.
>
> **Correzioni di settembre 2026** (ricerca bug su `BuildingModel.ts`):
> BP "higher_age" con l'era estratta; tabella gemella `MANUAL_OVERRIDES`
> (prima i valori corretti a mano sparivano in Città/Inventario); statistiche
> degli edifici standard d'era (gemelle in `buildings.py`, CSV rigenerato);
> `fromGreatBuilding` con i due formati dei GE e tutti i bonus militari; sette
> divergenze latenti dal Python allineate (0 casi con i dati attuali); il
> fallback `fromCityEntity` ora estrae anche Time/Flags/Ally. Dettagli nei
> paragrafi sotto. ⚠️ Le statistiche per era (`eraStats`, `fallbackBuildings`,
> `entityInstanceEraStats`, `declassableBuildings`) sono calcolate all'import e
> salvate nel profilo: le correzioni degli estrattori si vedono in Città/
> Inventario solo dopo aver **reimportato la città**. I GE invece passano da
> `fromGreatBuilding` a ogni render (dai dati grezzi salvati) e il CSV è nel
> bundle: quelle correzioni valgono subito.

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
placeholder vuoto). Da settembre 2026 estrae anche le colonne "di catalogo" che per gli
edifici del CSV arrivano dal Python, gemelle di `_calc_time()`/`extract_flags()`/
`extract_ally_type()` (tutte su `components.AllAge`): `time` (`limited.config.
expireTime` in giorni), `flags` (`flags.flags`) e `allyType`/`ally` (`ally.rooms[].
allyType` → "M"/"S", un carattere per slot; un tipo sconosciuto viene saltato invece di
far fallire l'import). Prima i fallback non avevano badge limitato/NoRush/auto-aging né
slot alleato; `allySlotsPerBuilding` in App.tsx ora scorre anche `fallbackBuildings`.
Validato: identici al CSV su tutte le 2178 righe (97 con slot alleato, 87 limitati,
1311 con flags).

**`fromGreatBuilding(gb, italianNames, hash)`** — crea un `Building` da un Grande
Edificio. I GE hanno una struttura propria (`bonuses`, `state.current_product`).
**Due formati del payload città** (verificati su due export reali, settembre 2026):
nei mondi col **rework dei GE** (tier rame/argento/oro) `bonuses` è pieno, un elemento
per ogni bonus attivo (passivi + produzione); nei mondi **classici** c'è il solo
`bonus` singolo (il bonus passivo) accanto a `bonuses: []` vuoto. La lista viene
normalizzata come fa FoE Helper (`CityBuildings.getGBBonuses`): conta solo una lista
NON vuota, altrimenti il campo singolo. Bug corretto: prima il campo singolo era letto
solo per il bonus militare, quindi nei mondi classici felicità e popolazione dei GE
risultavano 0 (Oracolo, Colosseo, Santa Sofia, Frauenkirche, Notre Dame, Space Needle,
Atomium, Tempio del Loto, Alcatraz, Statua di Gea; Torre di Babele, Campidoglio,
Innovation Tower, Habitat 67).
**Bonus militari**: si sommano TUTTI i bonus militari della lista (costante
`GB_MILITARY_SLOTS`: `military_boost` = att+dif attaccante, `fierce_resistance` =
att+dif difensore, `advanced_tactics` = tutti e quattro, più i quattro tipi dei tier
argento/oro — `attack_boost` att. attaccante, `attacker_defense_boost` dif. attaccante,
`defender_attack_boost` att. difensore, `defense_boost` dif. difensore, semantica presa
da FoE Helper `unit.js`), ognuno sulla sua modalità (`targetedFeature`: all → general,
battleground → gbg, guild_expedition → sped, guild_raids → iq; assente = all;
sconosciuta → ignorato). Prima si leggeva solo `bonuses[0]` e solo i 3 tipi classici:
col rework dal livello 101/201 i GE aggiungono bonus che andavano persi, compresi il
`military_boost` d'oro del Deposito di sementi e la `fierce_resistance` d'oro della
Galassia blu (non primi nella lista). ⚠️ I valori dei tier argento/oro vanno verificati
in gioco appena un GE supera il livello 100: il MainParser dichiara numeri molto alti
(es. Progetto Arc argento 3040 al liv. 301), che FoE Helper mostra come "%".
**Produzioni**: da `state.current_product` (punti forge, beni di vari tipi, truppe,
monete/materiali, beni di gilda, e da settembre 2026 anche un prodotto
`"special_goods"`), con fallback sui bonus di produzione del formato rework per
`clan_goods` (valore × 5) e `special_goods` — mai sommati, così nel formato rework, che
li porta entrambi, non c'è doppio conteggio. Per monete/materiali legge
`state.current_product.name` (`"money"` o `"supplies"`) e il relativo
`product.resources.money`/`.supplies`. I bonus IQ di produzione/avvio (`iqMonB`/
`iqMatB`/`iqMon`/`iqMat`/...) restano 0 per i GE (nessun GE li ha): i soli bonus IQ dei
GE sono quelli militari su `guild_raids`, gestiti sopra.

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
mancanti o di forma inattesa. Per tradurre fedelmente gli `or` del Python ci sono
`pyTruthy`/`pyOr` (truthiness in stile Python: falsy anche `{}`, `[]`, `0`, `""`) e
`chainFor(cityEntity, era)` (la catena dell'era, altrimenti quella AllAge): `??`
scarterebbe solo null/undefined e divergerebbe in silenzio.

**Edifici standard d'era** (settembre 2026): gli edifici "normali" delle ere
(culturali `A_<Era>_*`, decorazioni `D_<Era>_*`, produzione `P_<Era>_*`, residenziali
`R_<Era>_*`, e in città beni `G_` e militari `M_`) non hanno né `components` né
`entity_levels`: i dati stanno a livello radice. Popolazione fornita in
`staticResources.resources.population`, popolazione richiesta (col segno meno) in
`requirements.cost.resources.population`, felicità in `provided_happiness` (anche
negativa), produzione in `available_products` (l'opzione più lunga, normalizzata a
24h). Prima né il Python né il TS li leggevano: 332 righe del CSV senza Pop/Fel/Mon/Mat
(es. Parco dei divertimenti Fel 5200, Palazzina di periferia Pop 1330 e Mon 7320,
Macellaio Pop −66 e Mat 790). Sono il TERZO passo di `extract_population`/
`extract_happiness` e il passo 2b di `extract_mon_mat` (gemelli in `extractEraStats`/
`extractMonMat`): scattano solo se le fonti precedenti non danno nulla, quindi gli
altri edifici non cambiano (verificato su tutte le ere).

**BP "higher_age"**: il reward `genb_higher_age_blueprints_chest_<Era><N>` porta nel
nome l'era DEL COMPONENTE letto; `bpFromRewardId` cerca quindi `<era estratta><N>`.
Bug corretto settembre 2026: cercava sempre l'era massima (FALLBACK_ERA), quindi a ogni
altra era i Vigneti autunnali (`W_MultiAge_FALL23A9`..`A12`) davano 0 BP invece di
3/6/10/10 in tab Città/Inventario. Nel Python il problema non si vedeva perché
BOOST_ERA è sia l'era estratta sia la massima.

**Override manuali**: la costante `MANUAL_OVERRIDES` è il gemello di quella di
`buildings.py` (stessi 8 id, stessi valori, colonne CSV tradotte nei campi di
`EraStats`) ed è applicata per ultima in `extractEraStats`, come nel `main()` Python.
Bug corretto settembre 2026: le tab Città/Inventario sostituiscono i valori del CSV con
`extractEraStats` (`applyEraStats`), quindi senza il gemello i valori corretti a mano
sparivano proprio lì (Pozzo dei desideri & co. con Beni 9 invece di 0, Rimesse del
bucaniere/dell'uomo morto con PF/BP/MOD/BeniG a 0). Se cambia un lato va aggiornato
anche l'altro.

### 13.3bis TR/TRNE all'ultima era del gioco — Database vs Città (settembre 2026)

`extractTrTrne`/`extract_tr_trne` dividono la produzione di truppe casuali in TR
(truppe dell'era corrente) e TRNE (truppe dell'era successiva) con un'euristica:
quando un reward `random` offre più quantità dello stesso tipo di unità senza un
reward "NextEra" esplicito, l'importo che coincide con quanto darebbe il Titano di
quel tipo come reward NextEra viene classificato TRNE, il resto TR (se una sola
entry, quell'unica è considerata TRNE per default).

Otto edifici segnalati avevano un totale TR+TRNE corretto (verificato: il foglio di
Linnun ha comunque una sola colonna "Units", quindi non distingue mai TR da TRNE — non
c'era nulla da confrontare) ma una ripartizione interna che l'utente ha verificato in
game essere sbagliata all'ULTIMA era del gioco (`StellarAgeDiscovery`, id massimo in
`ages.csv`/`ages.db`): a quell'era "truppe della prossima era" non può esistere per
definizione, e il gioco fa collassare quella quota:
- su truppe dell'era corrente per Neo Voliera Lv.1/2, Giardini di vetro Iride/Ascesa,
  Meridiana del Sole/Ascesa (l'euristica dava TRNE-only o uno split fisso, in
  entrambi i casi errato a quest'era);
- su truppe correnti/Furfanti per Giardino del Sidro/Squisito (il ramo Furfante del
  random non passa comunque da TR/TRNE, quindi qui bastava lo stesso fix).

**⚠️ Prima versione del fix sbagliata, corretta lo stesso giorno**: applicare il
collasso anche in `buildings.py` cancellava l'informazione "dà truppe prossima era"
dal Database per TUTTI i 47 edifici col pattern, non solo per chi ha una città
importata già a SAD — perché `buildings.py` genera `buildings.csv` una volta sola,
sempre a `BOOST_ERA` = ultima era del gioco (per costruzione, non è parametrizzabile
per era). L'utente ha giustamente fatto notare che il Database serve anche a chi
NON ha ancora una città a SAD e vuole sapere quali edifici danno truppe prossima era
in generale.

**Soluzione finale — comportamento intenzionalmente diverso fra Database e
Città/Inventario:**
- **`extract_tr_trne` (Python, `buildings.csv`/Database): NESSUN collasso.** Mostra
  sempre la classificazione strutturale dell'edificio (TR e TRNE separati), utile a
  chi consulta il Database a prescindere dalla propria era.
- **`extractTrTrne` (TS, `BuildingModel.ts`): collassa SOLO quando l'era passata è
  quella con id massimo** (`AGES_BY_ID.size - 1`) — cioè quando si sta calcolando
  per la città REALMENTE importata dall'utente ed è già a SAD. Usato da
  Città/Inventario (`extractEraStats(entityDef, currentEra)`), riflette il
  comportamento reale in game per quel giocatore. Si applica anche quando
  l'euristica aveva già trovato uno split non-zero (confermato in game su Giardini
  di vetro Iride/Ascesa, Meridiana del Sole/Ascesa, non solo sui 2 casi iniziali).

Questo rende TS e Python **intenzionalmente divergenti su tr/trne quando l'era
testata è l'ultima del gioco** — l'unica eccezione all'invariante "gemelli sempre
identici". L'harness di confronto (`compare.js` nello script di validazione, fuori
dal repo) esclude esplicitamente `tr`/`trne` per quell'era con un commento che
rimanda a questa sezione, così un futuro run non lo segnali come falso bug.
Differenziale su tutti gli altri campi/ere: 0 differenze su 2858 entità × 24 ere,
verificato sia col filtro attivo sia isolando esplicitamente la divergenza (confermata
confinata a tr/trne, 47 edifici, solo StellarAgeDiscovery). Il CSV/Database restano
identici a prima di questo fix (verificato: unica differenza residua rispetto alla
versione precedente è `W_MultiAge_HAL26F1` sulla colonna Light, già nota e non
riproducibile al 100% tra ambienti, indipendente da questo fix).

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
di `guild_raids_goods_start`→`IQBeni`, target sempre `"all"`). Il lookup è sulla coppia
(tipo, target) ESATTA, come `BOOST_MAP.get((type, target))` del Python: una modalità
sconosciuta viene ignorata (fino a settembre 2026 ripiegava su `"all"` e sarebbe finita
nei bonus GENERALI alla prima modalità nuova introdotta da Inno). Anche le altre fonti
seguono il Python alla lettera: `ChainLinkAbility.bonusGiven.boost` accettato sia come
oggetto sia come lista, `BoostAbility` con `era_map[era] or era_map["AllAge"]` e solo se
il valore è non nullo.

### 13.5 Altri helper

- `extractPlayerEraFromCityMap(cityMap)` — trova l'era corrente del giocatore leggendo
  l'era del municipio (sempre presente, id=1, con id `H_{era}_Townhall`).
- `computeRoad(cityEntity)` / `requiresRoad(...)` / `requiredRoadLevel(...)` —
  fabbisogno stradale. `requiredRoadLevel` (luglio 2026) è la funzione di
  riferimento: restituisce 0 (nessuna strada), 1 (strada a una corsia, tile
  1×1) o 2 (strada a due corsie, tile 2×2), leggendo il valore NUMERICO reale
  di `components.AllAge.streetConnectionRequirement.requiredLevel` o
  `requirements.street_connection_level` (fallback stile vecchio) — non solo
  la loro presenza. I Grandi Edifici restituiscono sempre 1 (regola di
  dominio fissa, non letta dal JSON — deciso con l'utente di non
  differenziare 1/2 corsie per i GE). `requiresRoad` resta un wrapper
  booleano (`requiredRoadLevel(...) > 0`) per i call-site che si
  preoccupano solo del fabbisogno in tile (es. `computeRoad`), non del
  livello esatto. **Bug corretto (luglio 2026, segnalato dall'utente): il
  badge "NON CONNESSO A STRADA" in App.tsx ignorava il livello richiesto.**
  Sia `CityMapEntry.connected` (dato della città reale) sia
  `requiredLevel`/`street_connection_level` (dato dell'edificio) sono
  livelli numerici (1 o 2), non booleani: un edificio che richiede 2 corsie
  ma è collegato solo a una strada a 1 corsia è SCOLLEGATO secondo il
  gioco, anche se `connected` vale "1" (connesso, ma al livello sbagliato).
  Il vecchio calcolo di `cityEntityDisconnected` (App.tsx, import città)
  confrontava solo `Number(entry.connected ?? 0) >= 1` contro un
  `requiresRoad` booleano, trattando qualunque connessione come
  sufficiente — ignorando il caso. Corretto confrontando `connectedLevel <
  requiredRoadLevel` invece di un semplice booleano. **Correzione del dato
  (settembre 2026)**: il vecchio testo diceva "solo 2 building richiedono
  livello 2", ma contava il solo schema nuovo: nel MainParser del 27/09
  richiedono 2 corsie **258 entità** — 2 via `streetConnectionRequirement.
  requiredLevel` (`W_SpaceAgeJupiterMoon_Residential1`/`Workshop1`) e 256 via
  `requirements.street_connection_level` (gli edifici standard d'era
  dall'Era Progressista in su). ⚠️ **Da verificare in gioco**: FoE Helper e
  Forge Hammer considerano collegato un edificio solo se `connected === 1`,
  qualunque sia il livello richiesto; se il gioco mette 1 anche agli
  edifici a 2 corsie ben collegati, il confronto `connectedLevel <
  requiredRoadLevel` li segnalerebbe scollegati per errore. Le città
  esportate finora non contengono edifici a 2 corsie (in una c'è un
  `connected: 2` su un edificio che non richiede strada e non tocca strade),
  quindi serve un export con un edificio a 2 corsie ben collegato. Se la
  presenza del campo significa "richiede strada" segue la truthiness del
  Python (`requires_road()`): `street_connection_level: 0` = nessuna strada
  (divergenza latente allineata settembre 2026, 0 casi nei dati).
  **`buildings.py` non necessita dello stesso fix**: `requires_road()`/
  `calc_road()` calcolano solo il fabbisogno stradale in tile per il CSV
  statico — nessun concetto di "connesso in una città reale" esiste lato
  Python. Nota aperta: `Road` = min(w,l)/2 anche per gli edifici a 2 corsie,
  mentre FoE Helper stima il doppio (× livello richiesto): scelta di
  modellazione non ancora decisa, identica nei due gemelli.
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
`city_entities_to_csv.py`).
Quello script genera `buildings.csv` partendo da un dump offline del gioco
(`MainParser.txt`); questa funzione TypeScript fa lo stesso lavoro sui dati live del
bookmarklet (`CityEntityDefinition`), per le città importate. Le due fonti (CSV
statico, sempre fissato all'era MASSIMA disponibile — `BOOST_ERA`/`FALLBACK_ERA`,
derivata dinamicamente da `ages.db`/`ages.csv`, non più una stringa hardcoded,
vedi §8bis.5 — e città importata, sull'era reale del giocatore) devono restare
coerenti per costruzione: se l'algoritmo Python cambia, va aggiornata anche
questa funzione, e viceversa.

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
2b. **Edifici standard d'era (settembre 2026), solo se nulla sopra e l'entità non ha né
   `components` né `entity_levels`.** Prende l'opzione di `available_products` con
   `production_time` massimo e la normalizza a 24h (residenziali: monete; produzione:
   materiali, l'opzione da 1 giorno). Vedi §13.3, "Edifici standard d'era".
3. **`AddResourcesWhenMotivatedAbility`.** Risorse aggiuntive (es. edifici culturali con
   materiali "motivati") da `additionalResources[era]`, sommate sopra il risultato dei
   passi precedenti (non in alternativa: un edificio può avere sia produzione base che
   bonus da motivazione). Come nel Python (`if res: ... break`) ci si ferma alla PRIMA
   era (`era`, poi `AllAge`) con risorse non vuote, anche se non contengono monete/
   materiali (divergenza latente allineata settembre 2026: prima il TS proseguiva).

Validata con 9 test sintetici che coprono ogni ramo dell'algoritmo (normalizzazione di
durate diverse da 24h, scelta dell'opzione a tempo massimo, `random`+`dropChance`,
`genericReward` via lookup, entrambi i fallback `entity_levels`, fallback su `AllAge`,
nessuna produzione, `AddResourcesWhenMotivatedAbility`) — tutti passano sui dati reali.

**Esempio recente di questa coerenza gemella (luglio 2026): fix BeniG in
`extractProduction`.** `extractProduction` (funzione privata di `BuildingModel`, non
`extractMonMat` — estrae PF/PFB/BeniG, non Mon/Mat) leggeva `BeniG` (beni di gilda)
SOLO dalla chiave `all_goods_of_age` dentro `guildResources.resources`, in 4 punti
distinti (produzione diretta, produzione `"random"` con `dropChance`,
`AddResourcesToGuildTreasuryAbility`, chain bonuses productions). Bug scoperto
dall'utente su `W_MultiAge_FALL21A10` ("Golden Crops Harvest"): `BeniG` risultava vuoto
nonostante il gioco mostri un bonus di gilda reale. Causa: 3 edifici della famiglia
"Golden Crops" (`W_MultiAge_FALL21A10/11/12`) usano invece la chiave
`random_good_of_age` per lo stesso concetto — verificato su MainParser: 5602
occorrenze di `guildResources` con `all_goods_of_age` nelle vicinanze, contro solo 132
con `random_good_of_age`, tutte riconducibili a questi 3 id (non un problema diffuso).
Corretto lo stesso identico bug in ENTRAMBI i lati (`_extract_production_stats()` in
`buildings.py`, `extractProduction()` in TS), stessi 4 punti in ciascun file,
aggiungendo `random_good_of_age` come fallback quando `all_goods_of_age` è assente —
stessa convenzione già in uso per il campo `Beni` normale (`GOODS_KEYS["Beni"]` in
Python, l'array `beni: [...]` in `BuildingModel.ts`, che trattano da tempo le due
chiavi come sinonimi per quel campo). Il fallback 1b (edifici vecchio stile con
`entity_levels`, che usa il campo `type` letterale `"all_goods_of_age"` — pattern
strutturalmente diverso, non una chiave dentro `guildResources.resources`) è stato
lasciato invariato su entrambi i lati: nessuna prova che i 3 Golden Crops (edifici
moderni con `components`) lo attraversino. Validato: diff mirato sulla sola colonna
`BeniG` tra CSV vecchio e nuovo mostra ESATTAMENTE 3 righe cambiate (120/150/300 per i
tre livelli base/feast/ascended), zero altri edifici o campi toccati.

**Esempio recente #2 (agosto 2026): campo BeniSp aggiunto ex novo, colonna già
presente nel foglio raw di Linnun ma mai selezionata.** L'utente ha segnalato 7
edifici (`W_MultiAge_LTE24A11`, `WIN24E1`, `ANNI25E1`, `WIN25F1`, `COP25K10TEMP`,
`COP25K9`, `WIN24F4`) che producono "Beni Speciali" (concetto diverso da `BeniS` =
"Beni Successivi"/era successiva, chiarito dall'utente dopo un primo fraintendimento
in fase di analisi) mai estratti dal tool. Codificato nel MainParser da due chiavi in
`playerResources.resources`, sempre nei componenti PER-ERA (mai garantito in
`AllAge` — sui due Pirate Treasure Cove vive solo nel componente dell'era
specifica): `random_special_good_up_to_age` (un bene speciale casuale fino all'era
corrente, 6 dei 7 edifici) e `each_special_goods_up_to_age` (totale per ciascun bene
speciale, solo Eternal Market/`LTE24A11`). A differenza del fix BeniG sopra, qui non
c'era un bug nell'estrazione dal MainParser: la colonna semplicemente non esisteva
ancora nel CSV. Ma nel foglio RAW di Linnun (`buildings_linnun_raw.csv`) il dato era
già presente all'indice posizionale 15 (verificato: combacia esattamente coi valori
del MainParser per i 6 edifici "random") — solo mai incluso in
`BUILDINGS_CONFIG["col_select"]` di `linnun.py`, quindi mai propagato né al CSV di
Linnun né (stesso meccanismo di selezione posizionale) al nostro `buildings.csv`. Fix
in tre file della pipeline RECUPERO DATI (`linnun.py`: aggiunto raw index 15 a
`col_select`; `buildings.py`: nuova entry `GOODS_KEYS["BeniSp"]
= ("random_special_good_up_to_age", "each_special_goods_up_to_age")`, raccolta
automaticamente dal ciclo generico esistente di `_extract_goods_stats()`;
`confronta_buildings.py`: nuova riga in `SECTIONS`) più la propagazione completa in
FoE Optimizer seguendo la checklist "campo scalare nuovo" (vedi sezione Campi
Monete/Materiali) — incluso l'override città in `App.tsx`, il punto storicamente più
facile da dimenticare.

**Correzione del moltiplicatore "each" (stesso giorno, dopo verifica in game).** Il
valore raw di `each_special_goods_up_to_age` (90 per `LTE24A11`, sia in `AllAge` sia in
ogni componente per-era) è il valore PER SINGOLO bene speciale, non il totale: va
moltiplicato per il numero di beni speciali sbloccati fino all'era corrente. Il foglio
raw di Linnun mostrava 720 (90 × 8) — un'ipotesi plausibile ma sbagliata: l'utente ha
verificato in game il valore reale, **810** (90 × 9). Il conteggio corretto (9, non 8):
le ere che sbloccano un bene speciale sono, per fatto di dominio del gioco, da
ArcticFuture (id 14) in poi — UNA per era, TRANNE VirtualFuture (id 16), che non ne
sblocca uno. Con l'era finale attuale StellarAgeDiscovery (id 23), le ere 14..23 sono
10, meno la 16 esclusa = 9. Nessun campo del MainParser elenca esplicitamente questa
regola: è conoscenza di dominio, codificata come costanti esplicite
(`SPECIAL_GOOD_FIRST_ERA_ID = 14`, `SPECIAL_GOOD_EXCLUDED_ERA_IDS = {16}`) sia in
`buildings.py` (`_count_special_good_eras()`, applicata da `_goods_value()` nei 5 punti
di `_extract_goods_stats()` che sommano da `GOODS_KEYS`, solo per la chiave "each" — la
chiave "random" resta invariata, è già il valore finale) sia in `BuildingModel.ts`
(`countSpecialGoodEras()`/`goodsValue()`, quest'ultima con un parametro `era` in più
rispetto al gemello Python: un edificio può essere estratto per un'era diversa da
BOOST_ERA quando viene da una città importata a un'era intermedia, non solo dal CSV
statico — risolto in id numerico via `AGE_BY_CODE.get(era)?.id`, nessun moltiplicatore
applicato se l'era non è risolvibile, per non produrre un `NaN` silenzioso).

Validato: CSV rigenerato dal MainParser due volte (prima e dopo il fix del
moltiplicatore), confrontato riga per riga col precedente ad ogni giro — zero
differenze eccetto la nuova colonna `BeniSp`/`Light` al primo giro, e la sola riga
`LTE24A11` (90 → 810) al secondo giro. `tsc --noEmit` e `vite build` puliti dopo
entrambe le modifiche.

**Esempio recente #3 (agosto 2026): campo BeniSpB, stesso giorno, stessa causa radice
di BeniSp.** L'utente ha segnalato che `W_MultiAge_SUM25E1` ("Queen Anne's Legacy") ha
in game un boost del 5% sui beni speciali, chiedendo di verificarne la codifica nel
MainParser. Trovato un `BoostHint` con `type: "special_goods_production"`, `value: 5`
— stesso formato di `goods_production` (che alimenta `BeniB`: valore intero da
dividere per 100) ma per la categoria "beni speciali". Verificato via grep mirato sul
MainParser: **1 sola occorrenza** in tutto il file — SUM25E1 è l'unico edificio con
questo boost. Stessa causa radice di BeniSp: la colonna esisteva già nel foglio raw di
Linnun all'indice posizionale 16 (valore `"0.05"` per SUM25E1), mai incluso in
`col_select` di `linnun.py` (il 15 di `BeniSp` era seguito direttamente dal 14 di
`BeniB`, saltando il 16). L'utente ha scelto di trattarlo come nuova colonna scalare
seguendo la stessa checklist di BeniSp, con una differenza deliberata: qui il boost
**è** applicato nel pannello riepilogo PROD+STAT (`totalBeniSpNormal * (1 +
totalBeniSpB) + totalBeniSpGB`), a differenza della scelta conservativa presa per
BeniSp/BeniB — perché il boost `special_goods_production` è specifico e inequivocabile
per la stessa categoria di beni che modifica (nessuna ambiguità come per l'ipotesi
"il boost % beni normali si applica anche ai beni speciali", mai confermata). Fix
speculare in `linnun.py` (raw index 16), `buildings.py` (nuovo ramo `elif
boost.get("type") == "special_goods_production"` nello stesso ciclo che già legge
`goods_production` per `beni_b`), `confronta_buildings.py`, e propagazione completa in
FoE Optimizer (incluso l'override città in `App.tsx` e l'aggiornamento del pannello
PROD+STAT). Validato: CSV rigenerato, `SUM25E1.BeniSpB = 0.05` confermato, diff
riga-per-riga zero differenze eccetto la nuova colonna. `tsc --noEmit` e `vite build`
puliti.

**Correzione arrotondamento pannello PROD+STAT (stesso giorno, segnalata
dall'utente).** Il boost andava applicato al totale aggregato, non per singola
istanza — ma il gioco arrotonda per eccesso (`ceil`) la produzione boostata PER
EDIFICIO/COPIA, non sul totale città: con 2 copie da 90 e boost 5%, il valore reale è
`ceil(90×1.05)×2 = 190`, non `ceil(90×2×1.05) = 189`. Bug presente anche per
Beni/BeniP/BeniS con `totalBeniB` (mai notato prima perché nessun edificio dava quel
boost con conteggi che ne rivelassero la differenza). Fix: `boostedExactBuildingSum()`
in `App.tsx`, gemella di `exactBuildingSum()` (stessa gestione gruppi per istanze a
era mista) ma con `Math.ceil(valore × (1+boost)) × count` applicato per gruppo prima
di sommare. Usata per i 4 totali con boost city-wide (`totalBeniBoosted`,
`totalBeniPBoosted`, `totalBeniSBoosted`, `totalBeniSpBoosted`); la quota Grandi
Edifici resta sommata senza ceil aggiuntivo (nessun boost, valore già finale).
Validato: `tsc --noEmit` e `vite build` puliti.

**Secondo livello: il caso "each" (`W_MultiAge_LTE24A11`) + boost, stesso giorno.**
Il fix sopra copre il caso generale, ma per LTE24A11 (Eternal Market, l'unico
edificio "each") `benisp` non è un valore-per-produzione: è già `valore_unitario ×
countSpecialGoodEras(era)` (90 × 9 = 810). `ceil(810×1.05) = 851` resta sbagliato: il
gioco arrotonda per singolo bene speciale, non sul totale ×9 già assemblato — il
valore reale con SUM25E1 in città è `ceil(90×1.05)×9 = 95×9 = 855`. Fix: scomposto il
totale nel valore unitario (dividendo per `countSpecialGoodEras(era)`, ora esportata
da `BuildingModel.ts`), applicato il ceil, ripristinato il moltiplicatore —
hardcodato su `EACH_SPECIAL_GOOD_BUILDING_ID = "W_MultiAge_LTE24A11"` (unico incrocio
noto "each" + `special_goods_production`, non generalizzato). Verificato con
simulazione standalone: 855 corretto contro 851 sbagliato. `tsc --noEmit` e
`vite build` puliti.

**Esempio recente #4 (agosto 2026): BeniSp da Grande Edificio,
`X_SpaceAgeAsteroidBelt_Landmark1`.** L'utente ha segnalato che questo GE (Trasportatore
spaziale/Space Carrier) produce beni speciali. Verifica sul MainParser: 1 sola
occorrenza in tutto il file di un bonus GE con `type: "special_goods"` — schema
`bonuses[].bonuses[]` (`GreatBuildingTierBonus`/`GreatBuildingBonus`, il formato
"vecchio stile" dei GE con `entity_levels`), completamente diverso dalle chiavi
`random_special_good_up_to_age`/`each_special_goods_up_to_age` usate dagli edifici
W_MultiAge_* normali (che vivono in `components.*.production`). Valori per livello di
tier (solo `copper`): `[17, 313, 400, 400, 400]`.

Primo tentativo: scrivere il valore base (17) nel CSV statico — corretto dall'utente,
che ha fatto notare la convenzione già consolidata (verificata: 0 dei 49 edifici `X_*`
nel CSV hanno mai Beni/BeniP/BeniS/BeniG popolati, perché la produzione di un GE
dipende dal livello posseduto — diamanti/forgiatura — non da `BOOST_ERA`, quindi non
ha senso un valore "di catalogo" fisso). `buildings.py` NON estrae questo bonus:
resta solo un commento esplicativo. L'unica estrazione reale è in `BuildingModel.ts`
(`fromGreatBuilding()`): il payload città del bookmarklet espone i bonus del GE già
appiattiti al livello posseduto in `gb.rawEntry.bonuses`, quindi
`allBonuses.find(b => b.type === "special_goods")` restituisce direttamente il
valore reale — stesso pattern già in uso per `clan_goods`/`happiness`/`population`.
**Aggiornamento settembre 2026**: il bonus esiste così solo nei mondi col rework dei GE;
nei mondi classici `bonuses` è vuoto (c'è il solo `bonus` passivo). Ora si legge prima
un prodotto `"special_goods"` in `state.current_product` e il bonus fa da fallback
(mai sommati, stesso schema dei `clan_goods`), sulla lista normalizzata
`bonuses`/`bonus` (§13.2).
Validato: CSV verificato invariato rispetto a prima (`BeniSp` vuoto per questo GE,
come tutti gli altri), colonna `Light` intatta (872 edifici). `tsc --noEmit` e
`vite build` puliti.

> **Nota tecnica (merge CSV): attenzione alle terminazioni di riga.** Un primo
> tentativo di merge con `csv.writer`/`newline=''` ha riscritto il file con LF puro
> invece di preservare la terminazione originale, producendo un diff git di 2157 righe
> anche se il contenuto reale cambiava solo su 1 riga. Fix: leggere il destinazione
> come bytes, rilevare la terminazione dominante, modificare solo i campi necessari
> via split/join di stringa, riscrivere preservando la terminazione originale. Un
> `git diff --stat` che mostra "tutte le righe cambiate" dopo un merge CSV è un segnale
> di terminazioni disallineate, non un merge realmente esteso — va sempre verificato
> prima di considerare il merge completo.

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
  di bonus (general/gbg/sped/iq), `pf`/`beni`/`beniP` (produzione diretta degli
  alleati "science" — vedi §8.2 — 0 per i normali alleati "military") e
  `abilityIta`/`abilityEng` (descrizione dell'abilità speciale, vuota per la
  maggior parte degli alleati; CONTRATTO con la pipeline: il rendering mostra
  abilityIta senza fallback su abilityEng, perché è allies.py a garantire che
  l'italiana sia valorizzata quando esiste l'inglese).
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
  `computedGeneral/Gbg/Sped/Iq` più `computedPf`/`computedBeni`/`computedBeniP`
  (somma di `pf`/`beni`/`beniP` sulle rarità ereditate — vedi §14.3 — MA senza il
  moltiplicatore di livello di `getAllyStatValue`: la produzione degli alleati
  "science" è un valore fisso già letto al livello 100, non dipende dal `level`
  passato a `getComputedAllyStats`).

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

`pf`/`beni`/`beniP` (alleati "science") seguono la STESSA logica di ereditarietà
(somma su tutte le rarità ≤ quella corrente) ma con `sumProduction`, un helper
separato da `sumCategory`: niente `getAllyStatValue`/scaling per livello, perché
questi tre campi sono già il valore assoluto al livello 100 letto dal CSV — un
Leggendario possiede quindi anche i PF/Beni delle rarità inferiori, sommati
direttamente, indipendentemente dal `level` con cui è stata chiamata la funzione.

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


### 14bis Consigliere Gettoni Valore (`allyAdvisor.ts`, `AllyAdvisorPanel.tsx`, ottobre 2026)

Pannello richiudibile in cima alla tab Alleati, visibile **solo** se il profilo ha
risorse importate dalla bacchetta v6 e almeno un alleato non frammentato.

**Ipotesi (concordate con l'utente):** unica risorsa scarsa = Gettoni Valore
(`historical_allies_valor_token`); slot e Pergamene Eroiche non sono vincoli, quindi
ogni alleato è valutato al **livello 100**; l'evoluzione conserva il livello; rarità
massima Epico (`MAX_TARGET_RARITY = 4`, Leggendario in stand-by); solo alleati
**militari posseduti** (Tipo da `allies.csv`); scienza = "non valutati" (solo fatti,
nessun consiglio, per non trasmettere opinioni); frammentati esclusi.

**Dati:** `allies.py` aggiunge a `allies.csv` le colonne `Tipo` (M/S, stessa convenzione della colonna `Ally` di buildings.csv),
`EvoValor` (gettoni per passare alla rarità successiva, da `evolutionCost`) e
`VenditaValor` (rimborso, da `disbandReward`; solo gettoni).

**Algoritmo:** `effAt(alleato, rarità)` = EFF al livello 100 (stessi pesi della
colonna EFF, stats ereditate): ogni alleato è ipotizzato maxato prima o poi, il
livello attuale non conta. **Copie identiche** (stesso id e rarità, livello qualsiasi)
sono una sola voce; durante la simulazione, se un alleato evolvendo raggiunge una
rarità già posseduta da un'altra sua copia, le due voci si fondono → ogni riga della
coda è unica per (alleato, rarità di partenza) e mostra "×N" copie possedute. Per
ogni voce, il salto verso la rarità di arrivo con il miglior rendimento (guadagno ÷
gettoni del **percorso intero**: evita la miopia sui passi intermedi); greedy
globale sul salto migliore, la voce rientra in coda dal nuovo punto.

**Niente consigli di vendita** (rimossi su richiesta, ottobre 2026): vendere è una
valutazione dell'utente. Rimossi anche soglia di vendita e "valore di un gettone";
la chiave `foe_global_ally_advisor_mode_vN` è in `RETIRED_GLOBAL_KEYS`. La colonna
`VenditaValor` resta in `allies.csv` (dato del gioco) ma l'app non la usa.

**UI:** coda con, per ogni salto, gettoni, EFF+, EFF/gettone e le **variazioni
dei boost** al livello 100 nelle colonne GENERALI/CAMPI/SPEDIZIONI (`dGeneral`/
`dGbg`/`dSped`), rese da App con gli stessi `renderMilitaryGroupHeaders`,
`renderMilitaryIconHeaders` (variante non ordinabile) e `MilitaryBoostCells` delle
altre tabelle (rispettano Σ e Spedizioni attive). Niente colonna "cumulativi"
(rimossa): il cumulativo resta interno per evidenziare le righe già coperte dai
gettoni posseduti e il "prossimo obiettivo"; sezione "non valutati" per la scienza (solo
produzione al livello 100, copie fuse). Stato aperto/chiuso in `ALLY_ADVISOR_OPEN_KEY`.


### 14ter Pannello unico: matrice del potenziale + coda Gettoni Valore (ottobre 2026)

Il Consigliere e la matrice del potenziale sono **un solo pannello**
(`AllyAdvisorPanel.tsx`; `AllyMatrixPanel.tsx` rimosso, chiave
`foe_global_ally_matrix_open_vN` in `RETIRED_GLOBAL_KEYS`). La matrice è la vista
principale: una riga per alleato **militare** posseduto (copie e livelli ignorati,
frammentati esclusi), colonne COM/UNC/RAR/EPI/LEG (sigle dei filtri, larghezza fissa
72px) con l'EFF al livello 100 (`allyEffAt100`), gradiente HSL rosso→verde su
min/max dell'intera matrice, riquadro bianco sulle rarità possedute ("×N", tooltip
con copie e non posizionate), badge NON POSIZIONATO sul nome.

La coda di `computeAllyAdvice` è disegnata **sulla matrice**: ogni passo è un badge
`#n` (posizione in coda) sulla cella della rarità di ARRIVO, verde se il SINGOLO passo
costa al massimo i gettoni posseduti (non il cumulativo: con 335 gettoni e il #1 da
400 nessun badge risultava verde); in alto anche "con i gettoni attuali il passo
migliore è il #n"; le rarità saltate da un passo multiplo hanno
il bordo tratteggiato. Colonna "Prossima evoluzione" (primo passo in coda
dell'alleato: rarità, gettoni, EFF/gettone). Ordinamento: Priorità gettoni (default,
rango del primo passo), nome, o una rarità. Click sul nome → riga espansa con i passi
dell'alleato e le variazioni dei boost (`groupHeaders`/`statHeaders`/`renderBoostCells`
passati da App, rispettano Σ/Spedizioni). In alto: gettoni posseduti, legenda,
"Prossimo obiettivo"; in fondo: alleati scienza "non valutati".

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

**Livello 0 = kit di famiglia (fix ottobre 2026).** A parità di dimensione, il primo
insieme della catena (livello 0) è quello che offre l'**edificio base**. Prima vinceva
il primo nell'ordine dell'inventario importato: per GR25C, se `golden_selection_kit_GR25C`
({oro a, oro b}) precedeva `selection_kit_GR25C` ({base, kit semplice}), il kit oro
diventava livello 0 e il blocco "alias di compatibilità" di `optimizeFamily` gli faceva
pagare anche gli step semplici 1→8 (un GR25C6 risultava portabile a 10b con un solo kit
semplice). Ora l'alias si applica solo se il livello 0 offre davvero l'edificio base.
Verifica: con l'inventario di test completo, nessun cambiamento con l'ordine del gioco;
con ordine alfabetico cambiavano 3 famiglie (GR25C corretta, FALL24B/C solo kit
equivalenti) e dopo il fix l'esito è identico nei due ordini. La regola "kit più
economico prima" (semplice → argento → oro) resta quella di `hasEnough`/`doPay`.

**Rami paralleli ai livelli intermedi (fix ottobre 2026).** Per le famiglie che si
diramano (es. GR25C: 8 → 9a/9b → 10a/10b) le alternative venivano mostrate solo al
livello finale. Con kit sufficienti solo fino a un livello intermedio (es. kit semplici
+ kit di selezione argento → livello 9) appariva solo il ramo principale (9b). Ora
`altIdsAt` raccoglie gli id di tutti i rami per livello e `resolveIdsAt` li usa per la
visualizzazione: un kit specifico di ramo (argento a) restituisce solo il suo id (9a),
un kit di selezione (scelta al riscatto) tutte le alternative (9a e 9b). `altIdsAt` NON
è unito a `levels`: lì alimenterebbe `wf`/`stepLevelIndex` e metterebbe nello stesso
pool i kit diretti dei due rami (argento a + oro b, combinazione impossibile).
Limite noto non corretto: un edificio di un ramo NON principale già in inventario a un
livello intermedio (es. un GR25C9a) non viene riconosciuto dalla famiglia.

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
  `isInactive`, `isSuppliesProducer` (produttore di materiali — calcolato e
  incluso nel tipo per il contratto di persistenza, ma dal 11 agosto 2026 NON
  più usato per colorare la mappa: quella categoria dedicata è stata rimossa
  su richiesta esplicita dell'utente, vedi nota `roadLevel` sotto). Questi
  flag sono obbligatori (sempre valorizzati alla costruzione, che avviene in
  un solo punto).
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

**`roadLevel: number`** (luglio 2026) — livello di strada richiesto
dall'edificio (0/1/2, vedi `BuildingModel.requiredRoadLevel` §13.5), popolato
in App.tsx nello stesso punto/scope in cui viene costruito `mapBuildings`
(l'oggetto `entity = cityEntities?.[entityId] ?? {}` era già disponibile lì).
Inizialmente usato SOLO dall'export JSON della mappa; dal 11 agosto 2026
è usato ANCHE per colorare gli edifici sia nel rendering SVG a schermo
(`getBuildingColor` in CityMapView.tsx) sia nell'export PNG
(`renderCityMapPng`, vedi sotto): verde (`MAP_COLOR_ROAD_REQUIRED`,
`#5dd15d`) se `roadLevel > 0`, azzurro (`MAP_COLOR_NO_ROAD_REQUIRED`,
`#7abaff`) se `roadLevel === 0` — per gli edifici che non rientrano nelle
altre categorie con colore dedicato (municipio, Grandi Edifici, militari).
Essendo un campo aggiunto dopo l'introduzione di `CityMapBuilding`, nei
profili vecchi arriva `undefined`: sia l'export JSON (`?? 0`) sia il
confronto `roadLevel === 0` nel rendering trattano l'assenza come "non
richiede strada" (degradazione dolce, mai un crash).

**Le espansioni sbloccate nell'export JSON (`unlocked_areas`, luglio 2026)
richiedono un campo NUOVO e SEPARATO da `cityMapUnlockedCells`.**
`cityMapUnlockedCells` (esistente da prima) sono le celle sbloccate GIÀ
ESPANSE una per una (formato `"x,y"`): il codice che le produce
(`unlockedAreas.forEach(...)` in App.tsx, dove `unlockedAreas =
preloadedData.UnlockedAreas`) itera ogni rettangolo originale
(`{x, y, width?, length?}`, default 4×4) e aggiunge OGNI cella al suo
interno al Set — l'informazione sul rettangolo di partenza (dove iniziava,
quanto era largo) va persa in quel momento, non è ricostruibile a ritroso
dalle sole celle senza un algoritmo di raggruppamento euristico. Per un
export JSON fedele ai rettangoli REALI dati dal gioco (invece di migliaia di
celle sciolte, o una ricostruzione approssimata), è stato aggiunto un
secondo campo che salva `preloadedData.UnlockedAreas` COSÌ COM'È, in
parallelo a `cityMapUnlockedCells`: nuovo state `cityMapUnlockedAreas:
UnlockedArea[]` in App.tsx, nuovo campo opzionale `CityStore.
cityMapUnlockedAreas?: UnlockedArea[]` (§18) — popolato/persistito negli
stessi 3 punti di `cityMapUnlockedCells` (import città, switch tra profili
salvati, scrittura `writeStoredJson`). Opzionale per compatibilità: i
profili salvati prima di questa modifica non hanno questo campo, letto con
fallback `?? []` al caricamento — l'export JSON mostra semplicemente
`"unlocked_areas": []`, nessun crash. `CityMapView` riceve il campo come
nuova prop e lo mappa 1:1 nell'export (`width`/`length` inclusi solo se
presenti nel dato originale, per non scrivere valori ridondanti quando
l'area è quella standard 4×4).

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
database, lingua UI.

> Il meccanismo generico di **annunci one-off dismissibili** (chiave
> `DISMISSED_ANNOUNCEMENTS_KEY`, usata per l'annuncio v1→v2 del bookmarklet) è stato
> **rimosso interamente** in agosto 2026, diventato orfano dopo la sostituzione
> dell'annuncio con il modale dedicato "Bacchetta magica obsoleta" (§6.1, §24.3).
> Nessun consumatore residuo: se serve di nuovo un annuncio dismissibile generico va
> reintrodotto da zero.

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

**Semantica dell'override era (`applyEraStats`) — comportamento voluto.** L'override è
**totale** quando scatta: boost militari/IQ, pop, fel e ogni produzione vengono
sostituiti con i valori dell'**era corrente del giocatore**, anche per le copie di ere
precedenti. La riga è quindi il *potenziale alla propria era*; la precisione per-copia
vive nel triangolino "obsoleto" (tooltip col confronto era vecchia → corrente) e nel
riepilogo PROD+STAT (somme esatte per era via `entityInstanceEraStats`). Per
esplicitarlo, l'header di gruppo "📦 PRODUZIONI" nella tab Città mostra "(valori di
<era>)" (`prodValuesOfEra` + `ageName(currentEra, gameLang)`, dove `currentEra` è
l'era del municipio del giocatore). Non "correggere" la riga per mostrare l'era reale
della copia: la decisione è stata presa consapevolmente con l'utente (luglio 2026).

⚠️ **Precisazione importante (luglio 2026): `applyEraStats` è applicato ANCHE in tab
Inventario, non solo in Città.** `eraAdjustedSource` (App.tsx) decide se saltare
l'override con `isGameTab = activeTab === "propria_citta" || activeTab === "inventario"`
— quindi l'unica tab dove l'override è garantito assente è **Database**. In Inventario
(righe INV/FAB/KIT) e nelle righe merged da Inventario in Città (`_isMergedInventory`,
`mergedInventory = inventorySource.map(b => ({ ...b, _isMergedInventory: true }))`,
uno spread puro senza guardie), il valore di partenza viene comunque preso da
`resolveInventoryBase` (CSV/`processedBuildingsMap` in prima battuta, `fallbackBuildings`
come fallback per gli id assenti dal CSV — vedi §13bis) ma **`applyEraStats` viene poi
applicato sopra, indiscriminatamente**. In teoria la discriminante per riga è **se
`eraStats` (Map costruita dalla città importata) ha un'entry per quel `cityEntityId`**:
se sì, il valore CSV viene sovrascritto con `currentEra` — anche per righe
"potenziali" (badge KIT/FAB), perché `applyEraStats` guarda solo `cityEntityId`, non il
tipo di riga; se non c'è un'entry, il valore CSV resta a `FALLBACK_ERA` intatto.

**Ma in pratica questo override scatta per QUASI OGNI riga, indipendentemente dal
possesso reale** — `eraStats` (App.tsx, dove viene popolata) include un'entry per ogni
`entityId` con `isInCity || isInCsv || isInventoryChain` (più dati validi in
`cityEntities`), e **`isInCsv` da sola è già vera per la stragrande maggioranza degli
edifici del gioco** (quasi tutto `buildings.csv`, ~2100 id): non serve possedere
l'edificio in quella città perché scatti l'override, basta che l'id esista nel CSV e
abbia dati nel dizionario di gioco scaricato (`cityEntities`, l'intero MainParser, non
solo la città del giocatore). Verificato dal vivo (luglio 2026) con un badge
diagnostico temporaneo (`⚠️` accanto al nome quando `eraStats.has(cityEntityId)` è
`false` in una tab di gioco) su un profilo reale con inventario pieno: **zero righe**
mostravano il badge su tutta la tab Inventario — cioè nessuna riga era rimasta al
CSV/FALLBACK_ERA. Il caso "riga rimasta a FALLBACK_ERA" resta teoricamente possibile
(un `cityEntityId` assente sia dal CSV sia da `cityEntities`) ma è un'eccezione più
unica che rara, non la norma.

Per questo motivo l'header "📦 PRODUZIONI" mostra "(valori di <era>)" in **tutte e tre
le tab** (`prodValuesOfEra`): Database con `ageName(FALLBACK_ERA, uiLang)` (l'unica
tab senza override, sempre CSV puro — nome dell'era in `uiLang`, non `gameLang`,
coerente col resto della tab Database dove i nomi edificio seguono la lingua della GUI
e non quella del profilo importato; corretto luglio 2026, era rimasto `gameLang` per
copia-incolla dalla versione Città), Città e Inventario entrambe con
`ageName(currentEra, gameLang)` (l'era del municipio del giocatore, lingua del
profilo/gioco importato) — condizione `(activeTab === "propria_citta" ||
activeTab === "inventario") && currentEra`. **Non riprendere l'idea di "Inventario ha
valori misti riga per riga"** come premessa di design altrove nel codice: era
un'ipotesi plausibile in teoria, smentita dalla verifica empirica.

**Altre aggiunte recenti da conoscere (luglio 2026):**

- **Messaggio placeholder dedicato per Città/Inventario senza profilo importato**
  — il vecchio placeholder di riga vuota (`filteredBuildings.length === 0`) mostrava
  sempre il generico `noBuildingsFound` ("Nessun edificio trovato"), lo stesso testo
  sia per "hai importato ma i filtri escludono tutto" sia per "non hai importato
  nulla" — quest'ultimo caso è comune per un utente nuovo che clicca Città/Inventario
  prima di usare la bacchetta magica, e il messaggio generico non lo guidava
  verso l'azione giusta. Distinzione fatta con una IIFE nel punto del placeholder:
  `noCityImported = activeTab === "propria_citta" && cityEntityIds.size === 0`;
  `noInventoryImported = activeTab === "inventario" && inventoryMatched.size === 0 &&
  inventoryUnmatched.size === 0 && inventorySelectionKits.size === 0 &&
  inventoryUpgradeKits.size === 0` (stessa condizione di `hasData` in
  `familyResults`, riscritta qui perché quella è interna a un altro `useMemo`).
  Se una delle due è vera, il testo è composto da TRE chiavi in `ui-strings.ts`
  concatenate nel JSX su una `<div>` flex-wrap (mai una stringa unica, per poter
  incorporare l'icona in mezzo alla frase): `noCityImportedYet`/
  `noInventoryImportedYet` ("Usa la bacchetta magica in alto a sinistra") + il
  **riferimento visivo NON cliccabile** (icona `Wand2`, stesso stile emerald del
  pulsante reale in toolbar, ma uno `<span aria-hidden>` senza `onClick`/
  `draggable` — resa non interattiva su richiesta esplicita dell'utente: un
  secondo elemento cliccabile con lo stesso drag&drop del bookmarklet in mezzo
  alla tabella risultava confuso, letto come "un secondo pulsante ufficiale"
  invece che un rimando visivo al primo) + `noImportedYetSuffix` ("per importare
  i tuoi dati da Forge of Empires."), risultando nella frase completa "Usa la
  bacchetta magica in alto a sinistra [icona] per importare i tuoi dati da Forge
  of Empires." (luglio 2026, iterata più volte sul testo esatto). Altrimenti resta
  `noBuildingsFound` come prima. Scoped a
  Città/Inventario: in Database una tabella vuota è sempre un caso di filtri, mai
  di "dati mancanti" (il CSV è sempre presente). Decisione di design collegata:
  le tab Città/Inventario restano SEMPRE visibili nella barra anche senza alcun
  profilo caricato (non nascoste), per non far percepire l'app come "solo un
  database" a un utente nuovo — l'ottimizzatore/import è la funzione distintiva
  del tool; il problema reale era il messaggio vuoto non informativo, non la
  visibilità delle tab.
- **Ricerca con debounce** — `setDebouncedSearchTerm` + `prevSearchTermRef`: il
  filtro testo non rielabora la tabella a ogni tasto.
- **Filtro "Store building"** — `showStoreBuildingBuildings` in `TabFilters`
  (default `true`): se disattivato, esclude gli edifici con `imm > 0`.
- **Filtro alleati per slot** — usa `mapEntityId` (§17) / `placedInMapEntityId`
  (§14) per associare ogni copia specifica al proprio alleato.
- **Pulsante Help** — nella barra tab, apre `/guida.html` o `/guide.html` (guida
  online in `public/`, fuori bundle) secondo `uiLang`.
- **Modale "Bacchetta magica obsoleta"** (`isBookmarkletOutdatedModalOpen`) — all'import,
  se `_v` del payload < `CURRENT_BOOKMARKLET_VERSION` (§6.1), si apre questo modale
  (icona `Wand2`, bordo/colori ambra — distinto dal modale "Aggiornamento richiesto"
  di §21.1 che usa rosso/`RotateCcw`) con istruzioni step-by-step per ri-trascinare il
  bookmarklet aggiornato. Sostituisce il vecchio `alert(bookmarkletOutdatedAlert)` e
  il meccanismo di annunci dismissibili (rimossi, vedi §21.1).
- **Popup immagine con chiusura ritardata** — timer
  `scheduleImagePopupClose`/`cancelImagePopupClose`: il mouse può attraversare lo
  spazio tra trigger e pannello (e copiare nome/ID) senza che il popup si chiuda.
- **`SortableHeader` con prop `noGap`** — rimuove il gap icona/freccia SOLO nelle 20
  colonne strette della sezione Produzioni.
- **Nome edificio "unico" colorato oro, SOLO in tab Database** (luglio 2026) — il
  `<td className="cell-name">` riceve la classe aggiuntiva `unique` quando
  `activeTab === "database" && b.unique` (`Building.unique`, §7/§8.4bis/§12);
  `.building-table tbody td.cell-name.unique { color: gold; }` in `index.css`
  colora solo il testo. Non applicato a Città/Inventario/Alleati.
- **Badge "divieto" + badge "auto-aging", TUTTE le tab** (agosto 2026) —
  vedi §8.4ter/§12 per `Building.flags` (bitmask grezzo) e i getter
  derivati `noRush(b)`/`isEraMutable(b)`. `BuildingRow` renderizza due
  icone SVG inline in sequenza subito dopo il nome: `noRush(b)` → cerchio
  + barra diagonale, stroke `#7f1d1d`, fill trasparente, 12×12px, tooltip
  `noRushBadgeTitle`; `isEraMutable(b)` → stesso cerchio, stroke `#0e7490`
  con chevron verso l'alto, tooltip `eraMutableBadgeTitle` (entrambe in
  ui-strings.ts).

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

  **Conteggio "(prodotti/richiesti)" nel tooltip** (agosto 2026): ogni voce
  di `FragmentProduced` porta anche `amountPerCollection?: number` (letto dal
  token `<fid>:<amount>` della colonna Fragments, vedi §11). Al passaggio del
  mouse, `setFragmentTooltip` incrocia questo valore col totale richiesto
  (`requiredFragments`/`requiredFragmentsByBuilding` da `kit.json`, §11) e lo
  passa come `producedAmount`/`requiredAmount` a ciascuna voce del tooltip;
  il rendering mostra `(producedAmount/requiredAmount)` accanto al nome SOLO
  se ENTRAMBI sono definiti (kit.json non copre tutti i kit/edifici, e i dati
  storici possono mancare dell'amount) — mai un singolo numero isolato.

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

### 24.3sexies Ordinamento indipendente per tab (`SortScope`, luglio 2026)

Fino a luglio 2026 l'ordinamento (colonna + direzione) era un unico stato
globale (`sortCriteria: SortCriterion[]`) condiviso da tutte le viste
tabellari: ordinare per una colonna in una tab cambiava l'ordinamento mostrato
anche nelle altre tab. È stato reso **indipendente per ciascuna delle 5 viste
ordinabili**:

- **`type SortScope = "database" | "propria_citta" | "inventario" |
  "alleati_own" | "alleati_db"`.** Non coincide con `TabType` (4 valori): le
  due tabelle Alleati (posseduti e database) condividono lo stesso
  `TabType "alleati"` ma sono tabelle distinte con ordinamento proprio, quindi
  servono due scope separati.
- **Stato**: `sortCriteriaByScope: Record<SortScope, SortCriterion[]>`
  sostituisce il vecchio `sortCriteria` singolo. `resetFilters` azzera tutti e
  5 gli scope a `[{ key: "eff", order: "desc" }]`.
- **`makeHandleSort = (scope: SortScope) => (key: SortKey) => {...}`**
  sostituisce il vecchio `handleSort` unico: è una factory che produce
  l'handler per lo scope specifico.
- **Shortcut derivati** per i call-site: per la tabella edifici principale
  (`sortCriteria`/`sortBy`/`sortOrder`/`handleSort`, scoped dinamicamente
  sull'`activeTab` corrente) e uno per ciascuna tabella Alleati
  (`sortCriteriaAlleatiOwn`/`...AlleatiDb`).
- **`renderMilitaryHeaders`** è passato da closure senza parametri a
  `renderMilitaryHeaders(scope: SortScope)`, che calcola `activeSortBy`/
  `activeSortOrder`/`onSort` in base allo scope ricevuto. I 3 call-site
  (tabella principale + le 2 tabelle Alleati) passano lo scope corretto.
- I due `useMemo` che applicano l'ordinamento (`filteredBuildings` per la
  tabella principale, `filteredAllies` per gli alleati database,
  `processedImportedAllies` per gli alleati posseduti) leggono ciascuno il
  proprio scope invece del vecchio `sortCriteria` condiviso, e lo includono
  nelle rispettive dependency array.

Se in futuro si aggiunge una sesta vista ordinabile: nuovo valore di
`SortScope`, nuova entry in `sortCriteriaByScope`, e proprio scope passato a
`renderMilitaryHeaders`/equivalente. Non riusare uno scope esistente.

### 24.3septies Merge Città+Inventario: "MOSTRA ANCHE INVENTARIO" (luglio 2026)

Nella tab Città, un pulsante toggle (stile identico al pulsante "PROD + STAT",
ma in tonalità verde/emerald invece di ambra/ocra) permette di aggiungere alla
tabella Città anche tutte le righe della tabella Inventario, come se fossero
un'unica lista. Le due tabelle condividono esattamente le stesse colonne: il
merge è quindi una semplice concatenazione di righe già elaborate, non
richiede logica di rendering aggiuntiva.

- **Stato**: `showInventoryInCity: boolean`, persistito con lo stesso pattern
  di altre preferenze filtro (es. `showOnlyWithAllySlot`).
- **Flag di riga**: `ProcessedBuilding._isMergedInventory?: boolean`. Marca le
  righe iniettate dall'Inventario. Assente (o `false`) per le normali istanze
  di città.
- **Iniezione**: nel `useMemo` `filterSourceBuildings`, quando
  `activeTab === "propria_citta" && showInventoryInCity`, le righe
  dell'Inventario (stesso `eraAdjustedSource` della tab Inventario) vengono
  concatenate a quelle della città, marcate `_isMergedInventory: true`. Il
  contatore "EDIFICI VISUALIZZATI" riflette il denominatore aggiornato.
- **Distinzione visiva: SOLO colore di riga, MAI un badge** — vincolo esplicito
  dell'utente ("il pulsante deve aggiungere informazione, non nasconderla").
  Nuova categoria `"mergedInventory"` in `BUILDING_ROW_COLORS`
  (`buildingClassification.ts`) → classe `.row-merged-inventory` in
  `index.css`, costruita con lo stesso pattern `color-mix` opaco delle altre
  categorie (§24.3bis più sopra spiega perché un colore di riga NON
  semi-trasparente è un'invariante, non una scelta estetica: lo sticky delle
  prime colonne dipende da un `background-color` reale sulla `<tr>`). Questa
  categoria ha priorità sulle altre (great building/militare/beni/inattivo/
  fallback/normale) nella logica di selezione colore di `BuildingRow`.
- **Tutti i badge propri dell'Inventario restano visibili sulle righe merged**
  (KIT, INV+KIT, frammenti, quantità...). ⚠️ Bug reale corretto: quei badge in
  `BuildingRow` erano condizionati a `activeTab === "inventario"` in 3 punti
  (nome colorato per item "solo INV" senza kit associato; badge UNKNOWN per
  item non risolti nel catalogo; il blocco principale
  KIT/INV_UPGRADED/FAB/quantità). Con il merge attivo l'`activeTab` reale è
  `"propria_citta"`, quindi quel blocco non veniva mai eseguito per nessuna
  riga — le righe merged comparivano col colore giusto ma senza badge. Esteso
  a `(activeTab === "inventario" || b._isMergedInventory)` in tutti e 3 i
  punti. **Non individuato da `tsc`/`vite build`**, solo da verifica dal vivo
  nel browser: qualunque modifica futura a questi 3 blocchi va riverificata
  visivamente con il merge attivo, non solo con `npm run build` verde.
- **Le righe merged non sono istanze piazzate in città**: azioni e filtri
  città-specifici sono disattivati quando `b._isMergedInventory === true`:
  `handleCityRowClick` fa early-return (niente selezione/evidenziazione riga
  al click); badge disconnesso-da-strada, badge "ricollegamento inutile",
  badge upgrade disponibile, triangolo obsoleto, triangolo declassabile, icone
  slot alleato sono tutti soppressi per queste righe (sia dentro `BuildingRow`
  sia, come doppia sicurezza, nel `.map()` del chiamante che neutralizza le
  prop corrispondenti prima di passarle). I filtri toolbar
  `showOnlyOutdated`/`showOnlyDeclassable` escludono esplicitamente le righe
  merged quando attivi (in `App.tsx`: `if (isPropriacitta && showOnlyOutdated
  && (b._isMergedInventory || (b.cityEntityId && !outdatedBuildings.has(...))))
  continue;`, stesso pattern per `showOnlyDeclassable`) — non avrebbe senso
  segnalarle come obsolete/declassabili, non essendo istanze reali. Selezione
  (checkbox) ed export restano invece disponibili anche sulle righe merged.

### 24.3octies Badge slot alleato a due emoji, e sezione Produzioni nella tab Alleati (agosto 2026)

**Badge ⭐/🔬 per tipo di slot alleato.** Il badge sulla tabella edifici che
segnala "questo edificio può ospitare un Alleato Storico" mostrava sempre la
stessa emoji ⭐, indipendentemente dal tipo di alleato ospitabile. Da quando
`Building.allyType` (§7, §12) espone il tipo reale per slot ("M"=militare,
"S"=scienza — introdotto con StellarAgeDiscovery, Steelport Warship), il
badge in `BuildingRow` itera i caratteri di `allyType` (`[...b.allyType].map`)
e mostra un'icona per carattere: ⭐ per "M" (tooltip
`historicalAllySlotTitleMilitary`), 🔬 per "S" (tooltip
`historicalAllySlotTitleScience`) — la vecchia chiave i18n unica
`historicalAllySlotTitle` è stata rimossa. Il formato regge nativamente un
futuro edificio a slot misti (es. "MS" → due icone), senza bisogno di
modifiche: non è un caso speciale, è la conseguenza diretta di iterare la
stringa.

**Sezione "📦 PRODUZIONI" (PF/Beni/BeniP) nelle due tabelle Alleati.** Fino
ad agosto 2026 le due tabelle Alleati (Database e Posseduti) mostravano solo
i boost di combattimento (Generali/Campi/Spedizioni/IQ): i 3 alleati
"science" (Fibonacci, Indradevi, Ernest Shackleton — vedi §8.2, §14.1)
apparivano quindi con tutte le colonne boost a zero, senza alcuna traccia
della loro vera produzione. Aggiunta una sezione dedicata, deliberatamente
**limitata a 3 colonne** (PF/Beni/BeniP) invece di replicare l'intera
sezione Produzioni della tabella edifici (~20 colonne): sono le uniche
produzioni che gli alleati hanno oggi, repliche vuote delle altre 17
colonne sarebbero solo rumore.

- **`AllyProductionCells`** (componente `memo()`, accanto a
  `MilitaryBoostCells`) — 3 `<td>` con `formatProdNum`, stesso trattamento
  visivo delle celle Produzioni della tabella edifici (`cell-prod` quando
  il valore è `> 0`); la prima cella (PF) porta anche `section-divider`
  (separatore verticale che marca l'inizio della sezione, essendo la
  colonna del gruppo).
- **`renderAllyProductionGroupHeader()`** (colSpan 3, testo
  `groupProductions` con `whitespace-nowrap` per non andare a capo) e
  **`renderAllyProductionHeaders(scope: SortScope)`** — riusano il pattern
  già esistente di `renderMilitaryGroupHeaders`/`renderMilitaryHeaders`
  (stesso `SortScope` per scope indipendenti Database/Posseduti, vedi
  §24.3sexies). Le colonne riusano le `SortKey` **già esistenti** per gli
  edifici (`"fp"`/`"beni"`/`"benip"`), senza introdurne di nuove:
  `SortableAlly`/`allySortValue`/`compareAllies` sono estesi con
  `computedPf`/`computedBeni`/`computedBeniP` e i tre nuovi `case` nello
  switch di `allySortValue`.
- **`ComputedAllyStats.computedPf/Beni/BeniP`** (§14.1, §14.3) alimentano
  sia il sort sia le celle: calcolati da `getComputedAllyStats` con la
  stessa ereditarietà fra rarità dei boost di combattimento, ma sommati
  senza scaling di livello (sono valori assoluti già al livello 100).
- **Filtro "zero-stats" esteso**: sia in `filteredAllies` (Database) sia in
  `processedImportedAllies` (Posseduti) il controllo "nascondi alleato con
  tutte le statistiche a zero" includeva solo General/Gbg/Sped/Iq — un
  Fibonacci con boost di combattimento a zero sarebbe stato escluso
  nonostante produca PF/Beni. Esteso a controllare anche
  `computedPf === 0 && computedBeni === 0 && computedBeniP === 0`
  (Database: il filtro "zero-stats" è stato POI rimosso del tutto in
  questa stessa sessione — vedi sotto — quindi oggi si applica solo alla
  tabella Posseduti, dove filtra solo i non-frammenti).
- **Nessun filtro "zero-stats" nel Database Alleati** (rimosso
  deliberatamente, agosto 2026): prima escludeva silenziosamente qualunque
  alleato con Gen/Campi/Sped/IQ tutti a zero, il che nascondeva anche i 3
  alleati "science" (le cui statistiche di combattimento sono SEMPRE zero
  per costruzione — producono altro). L'utente vuole vedere tutti gli
  alleati del gioco nel Database, punto: filtrare per "non ha boost" non è
  un criterio valido quando esiste una categoria intera di alleati che non
  ne ha mai.
- **Colonna "lv1" rimossa da entrambe le tabelle Alleati** (agosto 2026):
  mostrava `a.val1`, il valore grezzo della colonna `Val1` del CSV al
  livello 1 — un dato di **debug interno** (serve a chi tocca la pipeline
  per verificare `resolve_val1_and_flags`, non a un giocatore che deve
  decidere quale alleato usare) diventato ancora più confuso una volta
  introdotte le colonne PF/Beni/BeniP (che invece mostrano il valore al
  livello 100): coesistere le due scale nella stessa riga generava
  ambiguità. Rimossi header, `<td>` body, `<col>` dedicata in entrambi i
  `<colgroup>`, e la chiave i18n `ally1stLevelValueTitle` (ora orfana).
  **Tre `colSpan` erano rimasti a contare la colonna eliminata** (bug
  introdotto dalla rimozione stessa, corretto nello stesso ciclo): il
  `<th colSpan={3}>` "CALCOLA EFFICIENZA A LIVELLO..." del Database
  (nome+lv1+eff → nome+eff, quindi `colSpan={2}`), il
  `<th colSpan={4}>` "ALLEATO ▾ / Alleati posseduti: N" della tabella
  Posseduti (nome+Lvl+lv1+eff → nome+Lvl+eff, quindi `colSpan={3}`), e il
  colSpan del placeholder "nessun alleato trovato" (`3 + ...` → `2 + ...`).
  Il campo `Ally.val1` resta nel tipo: è ancora usato internamente da
  `getAllyStatValue`/`getComputedAllyStats` per il calcolo dei boost, solo
  la sua visualizzazione diretta in tabella è stata tolta.

### 24.3novies Pannello riepilogo "ERA ➜": cosa cambia aggiornando tutti gli edifici (agosto 2026)

Nella tab Città, accanto alla freccetta rossa "mostra solo edifici vecchi"
(`showOnlyOutdated`), un secondo pulsante toggle indipendente — etichetta
"ERA ➜" in giallo, stile identico agli altri toggle-icon-btn-wide ma allargato
al contenuto (`!w-auto px-2 whitespace-nowrap`, non il box fisso 32px) — apre
un pannello full-width con due card affiancate (`grid md:grid-cols-2`), stesso
stile visivo del pannello Debug esistente. Risponde alla domanda che ogni
giocatore si pone dopo un avanzamento di era: "come cambieranno le statistiche
globali della mia città se aggiorno tutto?".

- **Stato**: `isOutdatedSummaryOpen: boolean`. Disaccoppiato da
  `showOnlyOutdated`: i due pulsanti si attivano/disattivano in modo
  indipendente, click separati.
- **Card sinistra — "SE AGGIORNI TUTTI GLI EDIFICI VECCHI (N in totale)
  ALL'ERA CORRENTE"**: copre SOLO gli edifici in `outdatedBuildings` (quelli
  con almeno una copia più vecchia dell'era attuale del giocatore), verso
  `currentEraId`. Calcolata da `buildOutdatedSummary` (`useCallback`, deps
  `[outdatedBuildings, allProcessedBuildings, entityInstanceEraStats,
  DIFF_FIELDS]`), richiamata dentro `outdatedSummary` (`useMemo`, deps
  `[currentEraId, applyEraStats, buildOutdatedSummary]`).
- **Card destra — "SE AGGIORNI TUTTI GLI EDIFICI IN CITTÀ (N in totale)
  ALL'ERA MASSIMA"**: copre invece **tutti** gli edifici posseduti in città
  (`cityEntityIds`, non solo quelli obsoleti — richiesta esplicita
  dell'utente), verso `fallbackEraId` (= `FALLBACK_ERA`, l'era più alta gestita
  dal tool, oggi Stellar Age: Discovery — nessun hardcoding, si aggiorna da
  sola quando si aggiunge una riga a `ages.csv`). Calcolata da `fullCitySummaryToFallback`
  (`useMemo`). Se `fallbackEraId === currentEraId` (il giocatore è già
  all'ultima era gestita), la card è sostituita da un placeholder
  (`outdatedSummaryAlreadyAtMax`): non avrebbe senso un confronto a delta
  zero garantito.
- **Il pattern di somma "sempre from/to, filtro solo sul totale finale"**
  (stesso in entrambe le funzioni, dopo un giro di bugfix): per ogni campo di
  `DIFF_FIELDS` si sommano SEMPRE `from` e `to` pesati sul numero di copie,
  per OGNI edificio idoneo — nessun filtro "salta se questo edificio non
  cambia" dentro il loop. Solo alla fine, sul totale aggregato per campo, si
  decide se il campo va in `totals` (mostrato con delta, `|from-to| > 1e-6`)
  o in `unchanged` (statistica invariata, `|from-to| <= 1e-6` ma valore non
  nullo). Filtrare per-edificio dentro il loop (versione precedente, bacata)
  poteva scartare silenziosamente il contributo legittimo di un edificio che
  individualmente non cambia ma che fa parte di un totale che invece cambia
  — o viceversa, dare un totale sottostimato rispetto alla somma reale
  visibile in tabella. La tolleranza `1e-6` (non uguaglianza esatta) esiste
  per il rumore floating point residuo (es. `5.1000000000000005` vs `5.1`)
  che un confronto `===` non filtrerebbe.
- **`totalBuildings`/`totalCopies`** contano TUTTE le copie idonee per la
  card (obsolete per la sinistra, tutte per la destra), non solo quelle con
  differenza effettiva: devono combaciare col badge "N edifici" della tab
  Città meno il municipio (scelta esplicita dell'utente, per essere
  verificabili a colpo d'occhio contro la tabella).
- **Sezione "STATISTICHE INVARIATE"**, sotto un separatore sottile in fondo a
  ciascuna card: elenca (icona + solo valore, senza freccia/delta, testo
  `text-slate-400` non-bold — stesso stile del valore "from" di sopra) i
  campi il cui totale aggregato non cambia tra le due ere, per rendere
  verificabile che il pannello non li abbia "persi" (es. i premi truppe
  `era_unit#...`/`genb_random_unit_chest...`, spesso identici tra ere
  adiacenti secondo i dati di gioco reali — vedi MainParser). Esclusi i campi
  a zero in entrambi i valori (non pertinenti, sarebbero solo rumore).
- **Formattazione dei valori**: `fpb`/`benib`/`iqMonB`/`iqMatB` sono
  percentuali di boost (stesso set di `formatProdPercent` nella tabella
  principale) e vanno mostrati come `%`, non come frazione decimale grezza.
  `pop`/`fel`/`mon`/`mat`/`iqMon`/`iqMat`/`fp` sono arrotondati a intero
  (`formatInt`, mai senso con decimali anche se la somma pesata produce un
  residuo tipo ",50"). Tutti gli altri campi restano a 2 decimali
  (`formatDecimal`). Il delta tra parentesi è in grassetto, il valore "to" no
  (l'utente ha esplicitamente invertito il grassetto rispetto alla prima
  versione).
- **Header compatto su una riga**: titolo (rosso, es. "SE AGGIORNI TUTTI GLI
  EDIFICI VECCHI") + conteggio in bianco tra parentesi (chiave
  `outdatedSummaryCount`, separata dal titolo per poterla colorare
  diversamente) + "ALL'ERA CORRENTE:"/"ALL'ERA MASSIMA:" in rosso (chiavi
  `outdatedSummaryToCurrentEra`/`outdatedSummaryToMaxEra`) + nome era in
  verde — tutto maiuscolo (`uppercase` sul contenitore).
- **Visibilità del pulsante "ERA ➜"**: condizionata a `cityEntityIds.size > 0`
  (qualunque edificio importato in città), **non** a `outdatedBuildings.size > 0`.
  Scelta esplicita dell'utente: anche un giocatore già interamente aggiornato
  all'era corrente può voler vedere cosa cambierebbe arrivando all'era massima
  gestita dal tool (card destra), quindi il pulsante resta sempre visibile finché
  c'è una città importata, non solo quando esistono edifici da aggiornare.
- **Testo empty state** (`outdatedSummaryEmpty`, mostrato nella card sinistra
  quando `outdatedBuildings` è vuoto ma `cityEntityIds` no): "Tutti gli edifici
  della città sono già aggiornati all'era corrente." — non un'assenza di
  differenze di statistiche (formulazione precedente, fuorviante), ma la
  conseguenza diretta di non avere edifici obsoleti da aggiornare.

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
  Rivalutare solo quando typescript-eslint pubblicherà il supporto esplicito alla 7.x
  (verificato 11 agosto 2026: l'ultima versione pubblicata, 8.67.0, dichiara ancora
  lo stesso range `<6.1.0` — nessuna versione stabile la supera).
- **`pako` è stato aggiornato alla 3.x (11 agosto 2026)**, non più pinnato sulla 2.x.
  La 3.x rinomina l'opzione usata in `storage.ts` (`{ to: "string" }` → `{ toText:
  true }`), non ha più un default export (serve `import * as pako from "pako"`,
  non più `import pako from "pako"`), e sostituisce i tipi community `@types/pako`
  con tipi nativi nel pacchetto (rimossa la devDependency `@types/pako`). Nessun
  cambio nel formato dei dati: pako è un'implementazione zlib/deflate standard
  (RFC 1950, header `0x78 0x9c` identico in 2.x e 3.x), quindi i profili già
  compressi e salvati in `localStorage` con la 2.x restano leggibili senza
  migrazione — verificato empiricamente comprimendo con 2.x e decomprimendo con
  3.x (e viceversa), incluso un caso con caratteri UTF-8 non-ASCII (accenti,
  ideogrammi, emoji): risultato sempre identico byte per byte. `typescript`
  resta invece bloccato sulla 6.x (vedi sopra), nessuna relazione con questo
  aggiornamento.

Le altre dipendenze si aggiornano normalmente ai minor/patch (verificando poi il ciclo
di build completo).

### Configurazione ESLint

`eslint.config.js` (flat config) usa `@eslint/js`, `typescript-eslint`,
`eslint-plugin-react-hooks` e `eslint-plugin-security`. Regole chiave:
`react-hooks/rules-of-hooks` (error), `exhaustive-deps` (warn), `eqeqeq` (error),
`no-explicit-any` (warn). La regola `security/detect-object-injection` è disattivata
(genera falsi positivi su accessi `obj[key]` legittimi). Esistono **3 warning di
sicurezza preesistenti** — 2 `security/detect-non-literal-regexp` in `BuildingModel.ts`
(righe ~775 e ~972: regex costruita da `FALLBACK_ERA` e da `baseId` escaped) e 1
`security/detect-unsafe-regex` in `format.ts` (riga ~29, `formatInt`) — che sono
**falsi positivi accettati**: gli input sono sempre stringhe interne controllate
(codici era, id edificio, numeri convertiti in stringa), mai input utente. Non
"correggerli"; se `npm run lint` riporta un conteggio diverso da 3, è un segnale
che è comparso un warning nuovo da valutare, non un refresh di questa nota.

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
   GIOCO/FoE Helfer/Forge Hammer a cambiare, il pattern corretto è: lettura col
   fallback sul vecchio percorso + bump di `CURRENT_BOOKMARKLET_VERSION` (esempi reali
   v2 e v3 in §6.1) — mai una rottura secca del contratto. Vedi §6.1.

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


## Planner città (SPERIMENTALE, ottobre 2026; sempre visibile dal 19 ottobre 2026)

Obiettivo finale: disposizione automatica della città che minimizza le strade
(NP-hard). Per ora è un **contenitore** con un motore segnaposto.

- **Flag (STORICO, tolto il 19 ottobre 2026: il Planner è sempre incluso e il pulsante PLANNER sempre visibile):** `const SHOW_PLANNER = false` in `vite.config.ts`, iniettato come
  costante globale con `define` (dichiarata in `src/vite-env.d.ts`). Con `false`
  il ramo `if (SHOW_PLANNER)` diventa `if (false)` e Rollup elimina il Planner e
  il suo import: il bundle è identico a prima (verificato: nessuna stringa del
  planner in `dist/index.html`). Con `true` compare il pulsante PLANNER accanto
  a MAP nella tab Città.
- **File:** `src/planner/engine.ts` (contratto del motore + algoritmo segnaposto),
  `src/planner/PlannerView.tsx` (modulo: riepilogo edifici a sinistra, canvas
  animato a destra con Avvia/Ferma/Reset/velocità). Testi solo in italiano, da
  tradurre quando la funzione uscirà dallo stato sperimentale.
- **Contratto:** `buildPlannerProblem(cityMapBuildings, unlockedCells)` →
  `PlannerProblem`; il motore emette `PlannerFrame` (posizionamenti, strade,
  posizione in prova, ultimo percorso scavato, contatori) tramite `onFrame`,
  cedendo il controllo al browser (`scheduler.yield`/`MessageChannel`, come il
  solver Pirati) o con una pausa per l'animazione; `shouldStop` per fermarlo.
- **Algoritmo segnaposto:** municipio fermo (radice della rete); edifici con strada
  dal più grande, posizione con meno strade nuove (BFS multi-sorgente dalla rete),
  accettata solo se lo spazio libero ancora raggiungibile dalla rete basta agli
  edifici con strada rimanenti (×1,5); poi edifici senza strada al primo posto
  libero. Strade sempre 1×1. Test sintetico (griglia 40×40, 61 edifici): 60
  piazzati, nessuna sovrapposizione, tutti collegati, 99 celle di strada.
  Opzione `initial` di `RunOptions`: riparte da uno stato dato (municipio,
  edifici e strade fermi) e piazza solo gli edifici rimasti.

### FoE City Builder integrato (fase 1 + fase 2, port TypeScript)

Port fedele di `D:\FOE\foe-builder` (fase1.py, genera_mapgrid.py + geometria di
fase2_legacy_dlx.py, fase2.py) in `src/planner/builder/`. fase3 esclusa su
richiesta dell'utente: dopo fase2 prosegue il motore del Planner.

- `builder/fase1.ts`: passi 1-7, fork raccordo 3/4, passi 8-9-10, retry del
  Passo 9, riepilogo (buchi, salti) e checkpoint identico a
  `<città>_rX_fase1.json`. Ogni passo registra un'istantanea (`trace`).
- `builder/fase2.ts`: mapgrid (area libera a ovest della strada verticale entro
  i capolinea) + 6 strategie di partizionamento con backtracking per forme e
  rifinitura; vince copertura, poi meno pezzi piccoli, poi meno edifici.
- `builder/index.ts`: `runBuilder(problem)` adatta il `PlannerProblem` (celle
  sbloccate come aree 1×1 = stessa griglia), esegue fase1 + fase2 per r3 e r4,
  restituisce le tappe da animare e la variante consigliata (meno buchi, poi più
  edifici).
- **Differenze volute dal Python:** grafo N/S/E/O non mantenuto (solo
  diagnostica); bitmask di riga sostituite da controlli per cella; il retry del
  Passo 9 prova **entrambe** le direzioni con buchi (il Python ne sceglie una
  dalla prima cella di un `set`, ordine non riproducibile) e tiene il migliore;
  l'ultimo spareggio di fase2 (il tempo) è sostituito dall'ordine delle
  strategie; tetto di sicurezza alle combinazioni del Passo 3.
- **Validazione (test differenziale):** 104 città (beta, city, foe-map,
  Tacito + 100 varianti con sottoinsiemi casuali di edifici): checkpoint fase1
  identici al Python su tutte (imponendo la stessa direzione di retry,
  `Fase1Options.forceRetry`); con la politica "entrambe le direzioni" 4 casi
  migliorano, nessuno peggiora. fase2: mapgrid e risultati di **ognuna** delle 6
  strategie identici (piazzamenti compresi) su 96 varianti. End-to-end sulle 4
  città reali: nessuna sovrapposizione né cella fuori mappa.
- **UI:** motore fisso (City Builder fase 1+2 + completamento) e velocità
  massima. Il selettore Raccordo è stato sostituito da **due mappe affiancate**
  (raccordo a 3 e a 4 celle) calcolate in parallelo: le due esecuzioni sono
  async e si alternano a ogni pausa (`sleep(0)` ogni ~40 ms nella ricerca).
  Avvia / ■ Ferma / ⏭ FERMA E COMPLETA / ↺ Reset agiscono su entrambe (stessi
  `stopRef`/`finishRef`; il pulsante FERMA E COMPLETA è attivo finché almeno
  una delle due sta cercando). Ogni mappa mostra statistiche e fase; a fine
  calcolo "Scegli questa" segna la disposizione preferita (per ora solo
  evidenziata; servirà all'esportazione). Il riepilogo edifici a sinistra è
  stato rimosso: i comandi e il riepilogo edifici/celle/strade attuali stanno
  sulla riga del titolo "🧭 Planner sperimentale"; sotto, le due mappe a tutta
  larghezza, ciascuna con titolo + statistiche (piazzati, strade, non
  piazzati, ✓ finito) sulla stessa riga. Le righe "fase:" e "fase 1/fase 2"
  non sono più mostrate (le etichette restano nei fotogrammi). Se
  il builder non si applica, una sola mappa col motore semplice. Il builder è
  sincrono: 0,5-1,5 s sulle città reali (messaggio "calcolo in corso").
- **Nota:** il builder sposta il municipio (lo centra, poi trasla la città verso
  il bordo), come in foe-builder.

### Completamento dopo fase 2 (`src/planner/completion.ts`, `runCompletion`)

Il builder lascia libera la parte a est della strada verticale. Richiesta
dell'utente: niente strada che parte dal basso e sfrutta un solo lato; la strada
laterale parte dal centro come prosecuzione del raccordo est del municipio, e
gli edifici senza strada vanno disposti con l'algoritmo di fase 2.

1. **Dorsale est** sulla riga `eastMidY` (geometria esportata da `runFase1` in
   `VariantResult.geometry`): edifici con strada su entrambi i lati, per
   altezza decrescente, ciascuno sul lato col primo posto libero più vicino al
   municipio; la strada si allunga solo fino all'inizio dell'ultimo edificio.
2. **Lato est della verticale** (strada già esistente): edifici impilati, dal
   più largo, nella posizione libera più vicina al centro.
3. **Dorsali secondarie**: si simula una dorsale per ogni riga in cui la
   verticale può diramarsi a est e si applica quella con la resa migliore (area
   servita ÷ strade nuove); si ripete.
   **Ricerca (non ci si ferma alla prima soluzione):** i passi 1-3 sono
   simulati su copie dello stato per molte disposizioni — 80 configurazioni
   deterministiche (5 ordinamenti × 4 regole di scelta del lato × ordine dei
   passi 1/2 × criterio delle dorsali secondarie) + ripartenze casuali
   (spareggi casuali, lunghezza massima della dorsale 30-100%). Vince, in
   ordine: meno edifici con strada esclusi, meno celle di strada nuove, area
   occupata più compatta. La ricerca è CONTINUA: ogni miglioramento sostituisce
   subito la disposizione visualizzata (etichetta con disposizioni provate,
   strade nuove della migliore e a quale tentativo è stata trovata) e prosegue
   finché l'utente preme **⏭ FERMA E COMPLETA** (`shouldFinishSearch`, pulsante
   abilitato solo durante la ricerca via `onSearchActive`), oppure trova 0 strade
   nuove con tutti inseriti, oppure raggiunge il tetto di sicurezza (2 milioni).
   "■ Ferma" invece interrompe tutto senza completare.
   Solo DOPO si passa agli edifici senza strada.

   **Fine strada orizzontali (richiesta dell'utente).** Gli edifici con strada
   "grandi" rimasti dopo fase2 (entrambi i lati >= 5, `LATO_GRANDE`) sono i
   candidati fine strada: 1-2 → una dorsale (riga del raccordo est), 3-4 → due
   dorsali distanziate (oltre 4: le prime 4 coppie, gli altri vanno sui lati
   come tutti). Un grande senza compagno è abbinato al più grande degli altri.
   A ogni estremità est: **L** adiacente all'ultima cella di strada a nord o a
   sud, **C** che tocca il lato EST dell'ultima cella (sfrutta il lato prima
   inutilizzato). `CAP_VARIANTS` (12): ruoli L/C × lato × L a filo
   (termina sulla colonna dell'ultima cella) o sporgente (vi inizia) × C verso
   L o opposto. Con fine strada la strada ha lunghezza fissa (stima =
   larghezza degli altri edifici / (2 × dorsali) × fattore + larghezza della
   coppia; si provano lunghezze vicine e tutte le varianti finché la coppia
   entra), poi gli altri edifici riempiono i lati fino all'ultima cella. Nella
   ricerca variano coppie (`pairSeed`), righe delle due dorsali (distanza >= 6),
   fattore di lunghezza (0,4-1,6) e variante iniziale. Ordine di merito: meno
   esclusi, poi meno fini strada mancati (`finiStradaMancanti`), poi meno
   strade, poi compattezza. foe-map (11 grandi rimasti): due dorsali con fine
   strada, 79 strade nuove (83 prima), 127 totali.

   **Lato est della verticale prima delle dorsali (segnalazione dell'utente:
   edifici sulla dorsale mentre la verticale aveva spazio libero).** Con
   `vertFirst` il lato est della verticale (strada gratis) si riempie PRIMA
   delle dorsali, lasciando fuori gli edifici riservati ai fine strada e le
   righe in cui partiranno le dorsali (`latoEstVerticale(evita)`); prima la
   dorsale partiva comunque da quella riga e un edificio la bloccava, quindi
   quelle disposizioni perdevano sempre. Nuova opzione di lunghezza
   `lenFactor = 0`: la dorsale più CORTA in cui la coppia di fine strada entra
   (configurazioni deterministiche + 25% delle ripartenze). Test sintetico (2
   grandi + 18 edifici, verticale libera): 38 → 5 strade nuove, tutti sulla
   verticale e coppia di fine strada a 5 celle dal raccordo.

   **Pettine (regola dell'utente: edifici alti a nord della dorsale più in
   alto o a sud di quella più in basso, per lasciare margine fra le strade).**
   Nuova strategia nella ricerca (`Params.comb` = K dorsali, 2-4,
   `combAnchor` = quale dorsale sta sulla riga centrale): le 2K fasce (nord e
   sud di ogni dorsale) si riempiono con gli edifici in altezza decrescente,
   PRIMA le due esterne, poi le interne (altezze simili nella stessa fascia;
   capacità di fascia = larghezza totale / 2K × fattore). Distanza fra dorsali
   = fascia sud della superiore + fascia nord dell'inferiore (+ fini strada);
   se le righe non sono valide il pettine viene traslato. I fini strada vanno
   sulla prima e sull'ultima dorsale. `latiDorsale` accetta il lato imposto
   per edificio (`forza`). Configurazioni deterministiche K=2..4 × ancora ×
   vertFirst, e metà delle ripartenze casuali. Test sintetico (76 edifici
   misti con 10 alti 3×6): vince un pettine a 2 dorsali con gli alti nella
   fascia nord esterna.

   **Vincoli anti-spreco (segnalazioni dell'utente: righe vuote fra le
   dorsali, edifici che toccano due dorsali, due strade orizzontali
   affiancate).**
   - Un edificio con strada non può toccare (perimetro) una strada NUOVA già
     tracciata da un'altra dorsale (`toccaAltraDorsale`, anche per i fini
     strada e il lato est della verticale).
   - Una dorsale si ferma dove una sua cella sarebbe adiacente (nord/sud) a un
     edificio già piazzato o a un'altra strada nuova (`lunghezzaLibera`): niente
     strade affiancate. Il lato est della verticale lascia libere anche le righe
     adiacenti a quelle delle dorsali future.
   - Nuova metrica `spreco`: celle libere nella zona delle dorsali (da x0
     all'ultima strada nuova, fra il bordo nord e sud degli edifici delle
     dorsali, esclusi quelli sul lato est della verticale). Ordine di merito:
     esclusi → fini strada mancati → `strade + 0,5 × spreco` → compattezza
     (`PESO_SPRECO`: una cella vuota può ancora ospitare un edificio senza
     strada, una strada no).
   - Dorsali secondarie: nuovo criterio `snug` (resa = area / (strade nuove +
     0,5 × celle vuote attorno alle sue fasce)), accanto a `ratio` e `minRoad`.
   Test sintetico (152 edifici con strada): 5 dorsali compatte, nessuna strada
   affiancata, nessun edificio su due dorsali.

   **Lati di strada inutilizzati (regola dell'utente: "non deve esistere
   mai").** `latiLiberi` = celle delle strade nuove con a nord o a sud una cella
   libera (né edificio né strada). È il terzo criterio di merito, PRIMA del
   costo: esclusi → fini strada mancati → `latiLiberi` → strade + 0,5 × spreco →
   compattezza. Anche le dorsali secondarie pesano ogni lato libero come 2
   strade (`PESO_LATO_LIBERO`). Mostrato in rosso nella riga di avanzamento se
   > 0. Test sintetico con altezze miste (118 edifici): 0 lati liberi.

   **Ricompattazione (idea dell'utente: "scambia tutta la fila rosa con la
   fila rossa").** A fine simulazione (`ricompatta`) le dorsali orizzontali,
   dall'alto in basso, vengono riaccostate: distanza fra due dorsali = fascia
   sud della prima + fascia nord della seconda + 1 (minimo 1 per fascia), senza
   righe vuote fra le fasce; per ogni dorsale senza fine strada si può
   SCAMBIARE la fascia nord con la sud (gli edifici mantengono la x). Si
   provano tutte le combinazioni di scambi (fino a 2^6) × ogni dorsale come
   àncora; valida = righe ammesse, nessuna sovrapposizione, nessun edificio che
   tocca la strada di un'altra dorsale. Vince quella con meno lati liberi, poi
   meno celle vuote; si applica solo se non peggiora i lati liberi. Lo spazio
   liberato viene poi usato (lato est della verticale + dorsali secondarie) per
   gli edifici rimasti. `Azione` registra riga della dorsale (`sy`) e `cap`.
   Costo: circa il doppio del tempo per disposizione.

   **Lato corto e verticale senza buchi (regole dell'utente).**
   - `latiLiberi` conta anche le celle del lato EST della strada verticale
     rimaste libere: la verticale non deve avere buchi a est, quindi le
     disposizioni che la riempiono vincono su quelle che allungano le dorsali.
   - Nuovo criterio `latiLunghi` (dopo `latiLiberi`, prima del costo): edifici
     attaccati col lato LUNGO, cioè larghi (w > h) su una dorsale orizzontale o
     alti (h > w) sulla verticale (i fini strada non contano).
   - `latoEstVerticale` mette prima gli edifici più larghi (w − h decrescente);
     con `Params.orient` il primo riempimento della verticale prende solo
     quelli con w ≥ h, gli alti restano alle dorsali. orient = vertFirst nelle
     configurazioni deterministiche, 60% nelle ripartenze.
   Test sintetico mappa grande con pochi edifici (6×4, 5×4 sulla verticale,
   3×6 e 3×5 sulla dorsale): verticale piena, 0 lati liberi, 36 strade.

   **ORDINE DI MERITO DEFINITIVO (segnalazione dell'utente: una soluzione da
   78 strade sostituita da una da 87).** L'obiettivo principale è il minimo
   numero di strade: esclusi → **strade nuove** → fini strada mancati → lati
   liberi → lati lunghi → celle sprecate → compattezza. Gli altri criteri
   valgono solo a parità di strade; una disposizione con più strade non
   sostituisce MAI la migliore visualizzata (il numero di strade mostrato può
   solo scendere). I vincoli di generazione (niente strade affiancate, niente
   edifici su due dorsali) restano. Questo sostituisce gli ordini precedenti
   (lati liberi prima delle strade, costo strade + 0,5 × spreco).

   **Fini strada più grandi + dorsale non vincolata al raccordo.**
   - `scambiaFiniStrada` (a fine simulazione): per ogni fine strada, se un
     edificio più grande (area) sta sui lati di una dorsale o sulla verticale,
     si scambiano i posti mantenendo gli ancoraggi (L adiacente all'ultima
     cella, a filo o sporgente; C sul lato est, allineato in alto o in basso;
     l'altro allineato alla sua strada o alla verticale), se entrambi entrano
     e nessuno tocca strade di altre dorsali. Il fine strada è così sempre il
     più grande possibile e la dorsale si libera di spazio.
   - La dorsale principale non è più vincolata alla riga del raccordo est del
     municipio: configurazioni deterministiche con la dorsale a ±1/±2 righe e,
     nelle ripartenze, metà delle volte uno spostamento di 1-3 righe
     (`rigaVicina`). Serve per creare fasce di altezza utile (es. 2 righe per
     edifici 2×2 / 2×3).
   - **Scambio col builder** (`Params.swapBuilder`): un grande già piazzato dal
     builder (es. il 6×6/5×6 in fondo alla verticale) cede il posto al più
     piccolo dei grandi ancora da piazzare (allineato a un angolo del suo
     posto, purché tocchi una strada) e torna in gioco come candidato fine
     strada. `Azione.from` (posto liberato) e `Azione.libera` (edificio
     liberato: se non viene ripiazzato torna fra i da piazzare).
     Configurazioni deterministiche (riga 0/±1) + 50% delle ripartenze.

   **Compattazione, ribilanciamento e ricerca locale (Rode, raccordo 4).**
   - `compattaDorsali` (a fine simulazione), per ogni dorsale:
     `bilancia` ridistribuisce gli edifici (non fine strada) fra fascia nord e
     sud con un DP subset-sum sulle larghezze (il fine strada L conta sul suo
     lato), li riposiziona da x0 e cerca l'estremità più corta in cui la
     coppia di fine strada entra con UNA QUALSIASI delle 12 varianti; se non
     accorcia la strada si ripristina. Altrimenti gli edifici scivolano verso
     ovest nei buchi e la coppia si riaccosta. Le celle di strada oltre la
     nuova estremità contano come libere per il fine strada, poi la strada
     si accorcia.
   - `Params.gapN/gapS` (1-3): righe lasciate libere sul lato est della
     verticale sopra/sotto la dorsale futura, così all'inizio della dorsale
     entra un edificio piccolo (2×3, 3×3) invece di un buco di 1 riga
     (configurazioni deterministiche + ripartenze + mutazioni).
   - Ricerca locale: dopo le configurazioni fisse, metà dei tentativi è una
     mutazione (1-2 mosse) dei parametri della disposizione migliore (riga
     ±1, lunghezza, variante del fine strada, lato, ordine, scambio col
     builder, verticale prima/dopo, gap), l'altra metà una ripartenza casuale.
   Banco (8 s per raccordo): Rode r3 82 (era 85-86, 0 lati liberi), r4 77 (era
   78); Claudio 76-77; Sonia 76-80 (era 79-82); tutti piazzati, 0 sovrapposizioni.

   **Fase 2 non intoccabile: allungamento della verticale (`Params.extN/extS`).**
   All'inizio della simulazione la strada verticale del builder può essere
   allungata di k righe a nord e/o a sud: i suoi fini strada (il tappo che
   copre la colonna della strada oltre l'estremità e il laterale a est che
   tocca l'ultima cella e sporge) scivolano di k righe verso il bordo (passo
   massimo fattibile ≤ k) e la strada li segue (celle contate come strade
   nuove). Il lato est guadagna spazio e si sfrutta tutta l'altezza. Gli
   edifici spostati sono azioni con `from` (posto liberato); lo scambio col
   builder salta gli edifici già spostati. Configurazioni deterministiche
   (nord, sud, entrambi fino al bordo), 40% delle ripartenze, mutazione. Il
   lato est della verticale nei lati liberi conta anche le celle nuove.
   Sonia r4 dopo 20 s: 75 strade (orig. 84).

   **Città piccole e dense (Avito).**
   - Pettine "pieno" (`comb = -1`): ogni fascia lunga quanto lo spazio libero
     verso est (× fattore ≤ 1), numero di dorsali calcolato (+ `combPiu` 0-2).
     Le fasce si riempiono per altezza decrescente: prima le due esterne
     (alti), poi le interne in coppie consecutive (sud di una dorsale + nord
     della successiva, altezze simili: due file di edifici bassi fra due
     strade, l'idea dell'utente). Configurazioni deterministiche (3 × 3 × 3 ×
     2) + 30% delle ripartenze.
   - Nuovo criterio di merito 0 `deficit`: celle libere che mancherebbero per
     gli edifici senza strada e per gli esclusi (×1,3, +5%); è 0 nelle città
     con spazio.
   - `Params.liberaN/liberaS` (rinuncia ai fini strada della verticale): il
     tappo e il laterale all'estremità della verticale tornano fra i da
     piazzare (il grande può diventare fine strada di una dorsale), lo spazio
     si libera e, con `extN/extS`, la verticale scende nello spazio liberato:
     le dorsali possono partire anche da lì. Le righe valide per pettine e
     ricompattazione sono ora calcolate per simulazione (`okRigaS`,
     `haVerticale`). `Piano.liberati`: chi non viene ripiazzato torna fra i
     da piazzare (motore Planner). Configurazioni deterministiche (nord, sud,
     entrambi × pettine pieno o no × vertFirst), 15% per lato nelle
     ripartenze, mutazione.
   - **Fix strade scollegate** (segnalazione dell'utente): l'allungamento della
     verticale senza fini strada aggiungeva celle di strada non legate ad
     alcuna azione, quindi non venivano applicate né mostrate e la dorsale
     che ne dipendeva risultava staccata. Ora sono in `Piano.stradeExtra`
     (applicate e mostrate). In più, controllo di connessione a fine
     simulazione: `scollegate` = celle di strada nuove non raggiungibili dalla
     rete esistente, **criterio di merito -1** (deve essere 0). Il banco
     controlla anche le strade scollegate nel risultato finale.
   - `attaccaAStrade` (dopo il lato est della verticale, prima delle dorsali
     secondarie): gli edifici con strada rimasti si attaccano a una strada
     GIÀ esistente a costo zero, nella posizione più incastrata (più lati a
     contatto con edifici/strade/bordo), mai a contatto con due dorsali.
     Riempie per esempio il fine strada d'angolo lasciato libero in fondo
     alla verticale.
   Banco (10 s): Avito r3 6 non piazzati (solo 3×3 senza strada), r4 3; Claudio
   74; tutte le città 0 strade scollegate, 0 sovrapposizioni.
   - **Fix edifici non collegati / sovrapposti** (segnalazione dell'utente su
     Avito): nella compattazione (`bilancia` e scorrimento) la strada veniva
     accorciata DOPO aver marcato i fini strada, cancellando dall'occupazione
     la cella del fine strada C appena oltre la nuova estremità; i passi
     successivi (`attaccaAStrade`) potevano poi piazzarci sopra un edificio.
     Ora si accorcia prima e si marca dopo. Reti di sicurezza aggiunte:
     `riparaScollegati` (ogni edificio con strada piazzato deve toccare una
     strada: altrimenti viene tolto e riattaccato a una strada esistente, o
     resta escluso) e una validazione finale delle sovrapposizioni (edifici di
     partenza non spostati + azioni + strade): se ce n'è una la disposizione
     è invalida (`scollegate` += 1000). `DEBUG_SOVRAPPOSIZIONI` stampa i
     conflitti (solo banco). Il banco controlla anche "edifici senza strada".
   Banco dopo il fix (10 s): 0 sovrapposizioni, 0 strade scollegate, 0 edifici
   senza strada su tutte le città; Sonia 75-78, Rode 77-83, Claudio 75-77.
   - `altiFuori` (dopo le dorsali secondarie, prima della ricompattazione):
     gli edifici con h >= 6 sui lati di una dorsale interna vanno nella fascia
     esterna (nord della dorsale più in alto o sud di quella più in basso), in
     un posto libero entro la lunghezza della strada o scambiandosi con un
     edificio più basso di quella fascia; mai a contatto con altre dorsali.
     Su Avito l'effetto è limitato: la fascia esterna sud è bassa (bordo della
     mappa vicino), quindi gli alti entrano solo se la dorsale più in basso
     sale; servirebbe spostare le dorsali insieme agli alti.
   - `altiFuori` spostato DOPO tutte le dorsali (prima girava quando ne
     esistevano solo 1-2, quindi non sapeva quali fasce sarebbero diventate
     interne) e con lo scambio di GRUPPI (catena di alti adiacenti ↔ sequenza
     di edifici più bassi della fascia esterna di larghezza ≥). In `bilancia`
     gli alti (h ≥ 6) sono forzati sul lato esterno della dorsale più in alto
     (nord) / più in basso (sud); il ribilanciamento si applica anche a
     strada invariata se mette fuori almeno un alto.
   - **Fix sovrapposizione strada/edificio**: nell'applicazione del piano le
     celle del posto lasciato dagli edifici liberati/spostati venivano
     liberate DOPO aver marcato le strade nuove (es. la verticale allungata
     dentro il posto del vecchio fine strada), cancellandole; il riempimento
     senza strada ci metteva sopra un 3×3. Ora prima si liberano i posti, poi
     si marcano strade ed edifici.
   - Ordine di merito: gli esclusi tornano PRIMA del deficit di spazio
     (`scollegate → esclusi → deficit → strade → …`): il deficit stimato
     faceva vincere disposizioni con un edificio con strada escluso.
   Banco (Avito 20 s): r3 189 strade, 5 non piazzati (3×3 senza strada); r4
   187 strade, 1 non piazzato (6×6 senza strada). Altre città invariate, 0
   sovrapposizioni/scollegamenti ovunque.
   - **Vincolo "alti sempre esterni" (prova richiesta dall'utente,
     `ALTI_ESTERNI_VINCOLO = true`)**: `altiInterni` = edifici con strada h ≥ 6
     appoggiati (col lato inferiore o superiore) a una dorsale ma non nella
     fascia esterna (nord della più in alto, sud della più in basso); criterio
     di merito subito dopo gli esclusi, PRIMA delle strade. Generazione:
     `Params.riservaAlti` trattiene gli alti durante la costruzione e li mette
     poi solo nelle fasce esterne (`piazzaAltiFuori`, allungando la dorsale se
     serve); `bilancia` può allungare la strada fino a 8 celle per metterli
     fuori; nel pettine le righe sono valide solo se le fasce esterne (alte
     quanto il più alto) stanno dentro la mappa. Mostrato in rosso
     nell'avanzamento ("N alti interni").
     Esito su Avito (30 s): r4 0 alti interni, 188 strade (prima 185-187), ma
     8 edifici senza strada non piazzati (prima 1); r3 1 alto interno, 189
     strade, 14 non piazzati (prima 5). Altre città: invariate (0 alti
     interni già prima). Per tornare indietro: `ALTI_ESTERNI_VINCOLO = false`.
   - **Ritirato il vincolo** (l'utente: "gli spunti devono essere tentativi,
     non regole tassative"; Avito era passato da 179 a 188 strade):
     `ALTI_ESTERNI_VINCOLO = false`, `altiInterni` è solo uno spareggio dopo
     lo spreco. Gli "alti esterni" sono ora uno spunto della ricerca
     (`Params.altiEsterni`, 40% dei tentativi + mutazione): forzatura in
     `bilancia` solo se la strada NON si allunga (niente più +8), `altiFuori`
     e il controllo delle fasce del pettine solo se attivo. `riservaAlti` 25%.
     **Principio**: ogni idea dell'utente diventa un'opzione della ricerca,
     mai un criterio sopra il numero di strade.
   - Prestazioni: `attaccaAStrade` (40% del tempo) considera solo le celle di
     strada con un vicino libero: +75% disposizioni al secondo (Avito 30 s:
     3.900 invece di 2.100).
   Banco (Avito 30 s): r3 187, r4 185 strade (1-4 non piazzati senza
   strada); Sonia 75-79, Claudio 76, Rode 77-85.
   - **Pausa e modifiche manuali ("unire le forze")**: ⏸ Pausa ferma la
     ricerca (diventa ▶ Riprendi); lo stop definitivo è solo ↺ Reset (attivo
     anche in pausa); ⏭ COMPLETA (ex "FERMA E COMPLETA") è l'UNICO comando
     che chiude la ricerca e passa al riempimento. `runCompletion` riceve
     `isPaused` / `waitResume` / `onPaused`: con `isPaused()` vero il ciclo
     mostra la migliore (" · in pausa") e attende `waitResume()`. In pausa la
     mappa (bordo azzurro) è modificabile: trascinare un edificio lo sposta
     (fantasma verde/rosso = valido/non valido: celle sbloccate, niente strade
     né altri edifici; municipio fisso), click su una strada la elimina, tasto
     destro su un edificio lo toglie (lo ripiazza l'ottimizzatore); bordo
     rosso = edificio con strada scollegato (↶ Annulla e messaggio azzurro di pausa poi rimossi su richiesta dell'utente). Mappa non
     toccata → `null`, la ricerca prosegue invariata.
     Con modifiche, `ribasa` normalizza lo `StatoManuale` (solo strade
     raggiungibili dal municipio, rami morti potati, edifici con strada tolti
     o scollegati di nuovo da piazzare; `ricalcola` aggiorna occupate,
     `daPiazzare`, `areaSenzaStrada`, `righeValide`) e questo diventa la
     soluzione corrente S. Da lì **la ricerca CONTINUA** (`cercaDaManuale`)
     finché l'utente non preme COMPLETA, alternando:
     1. 50%: un passo della ricerca parametrica dalla base del builder
        (`ripristinaBase` + `passoPar`: configurazioni fisse, mutazioni della
        migliore, ripartenze casuali — la stessa ricerca di prima della
        pausa, che prosegue); se la sua nuova migliore, applicata, batte S,
        la sostituisce;
     2. 50%: ricerca a vicinati attorno a S: si tolgono da S gli edifici con
        strada di un "vicinato" (un gruppo di 1-10 vicini a un edificio a
        caso, oppure quelli lungo gli ultimi 2-8 metri di un ramo di strada;
        se mancano edifici, a volte solo quelli) — `ribasa` pota le strade
        rimaste inutili — e si ripiazzano (3 tentativi `simula` con parametri
        casuali, si applica il migliore).
     Punteggio di S (`punteggio`): edifici con strada fuori → deficit di
     spazio → strade totali; un risultato non peggiore sostituisce S
     (miglioramento stretto = "trovata alla n."). Le "strade nuove"
     mostrate sono strade totali di S meno quelle del builder. A COMPLETA si
     riparte da S (`ribasa`) e si completa.
     `PlannerView`: `pausedRef`, `resumeRef` (risolutori per mappa), `modRef`,
     `framesRef`, `genRef` (fotogrammi di una corsa
     annullata da Reset ignorati).
     Prova `bench/pause.ts <Città> <r3|r4> <identica|tolti|solostrada> [ms]`
     su Beta (pausa a 3 s, ripresa, seconda pausa senza modifiche, COMPLETA a
     20 s): identica r3 50 → 48, r4 49 → 47; tolti 3 edifici + 1 strada: r3
     50 → 48, r4 49 → 46; solo 1 strada eliminata: r3 50 → 45, r4 49 → 47;
     sempre 131/131 piazzati, 0 sovrapposizioni, 0 edifici senza strada.
   - **Edifici fissi attorno al municipio** (regola dell'utente: "già
     ottimizzati al massimo, non devono mai essere spostati"): gli edifici
     di fase 1 di tipo `angolo`, `riempimento` e `blocco_muni` (passi 2-4)
     sono esportati dal builder in `BuilderVariant.fissi` e passati a
     `runCompletion` (`opts.fissi`). Esclusi da: scambio col builder
     (`swapBuilder`), rinuncia ai fini strada (`liberaFine`), allungamento
     della verticale, vicinati della ricerca dalla disposizione manuale. Rete
     di sicurezza in `simula`: un piano che sposta o libera un fisso è non
     valido (+1000). In pausa l'utente può comunque spostarli a mano. Il
     banco stampa "fissi N, spostati M" (sempre 0 su tutte le città).
   - **Parte ovest fissa** (regola dell'utente: "tutta la parte a ovest
     della dorsale verticale, posizionata da fase 1 e fase 2, è già ottima"):
     tutti gli edifici INTERAMENTE a ovest della strada verticale
     (`x + w - 1 < stradaVX`) si aggiungono ai fissi (`idOvest`): mai
     spostati né liberati dalla ricerca (spazio di ricerca ridotto). I fini
     strada della verticale, che ne occupano la colonna, restano mobili:
     provato a bloccarli (`<=`), Avito r4 passava da 141 strade nuove / 2
     edifici fuori a 201 / 7 fuori, r3 da 0 a 2 fuori; con `<` i risultati
     sono identici a prima. Dopo una ripresa con modifiche manuali i fissi
     diventano gli edifici a ovest della disposizione dell'utente; se la
     parte ovest (edifici + strade, `firmaOvest`) è diversa da quella del
     builder, la ricerca parametrica dalla base del builder si spegne
     (`parOvestOk`) e restano solo i vicinati attorno a S, così la nuova
     disposizione ovest non viene mai rimpiazzata. Il banco stampa "ovest N
     edifici, spostati M" (0 senza modifiche manuali).
   - **Buchi intermedi e stallo** (segnalazione dell'utente: la ricerca
     sostituiva una disposizione con pochi buchi con una equivalente con più
     buchi, e in modalità manuale "spostava edifici senza concludere"):
     - nuova metrica `buchi` (`contaBuchi`): celle libere che nessun
       edificio senza strada rimasto con entrambi i lati >= 2 può coprire
       (fessure larghe 1, angoli, sacche); si usano solo le forme minimali
       (una cella coperta da una finestra libera w×h lo è anche da una più
       piccola contenuta), somme prefisse 2D + array differenze, O(celle ×
       forme). Le decorazioni 1×N sono escluse perché poche e coprirebbero
       tutto. Forme ricalcolate in `ricalcola`.
     - Ordine di merito: subito DOPO le strade (prima di fini strada, lati
       liberi, ecc.): a parità di strade vince chi ha meno buchi.
     - Il deficit di spazio conta come libere solo le celle non-buco.
     - Ricerca dalla disposizione manuale: `punteggio` = fuori → deficit →
       strade → buchi. Separati il cammino (`manuale`, accetta anche
       soluzioni equivalenti per uscire dagli stalli) e la MIGLIORE
       (`migliore`, mostrata, usata in pausa e a COMPLETA): cambia solo con
       un miglioramento stretto. Dopo `STALLO` = 300 tentativi senza
       miglioramenti il cammino riparte dalla migliore.
     - UI: "N buchi intermedi" al posto delle celle sprecate.
     Banco (10 s): Beta 46/46 strade nuove (buchi 15/3), Sonia 21/17,
     Claudio 11/13, Rode 29/15, tutti piazzati; Avito r3 154 strade nuove con
     13 edifici senza strada fuori (prima 152 / 4: cambia la traiettoria
     della ricerca locale, che parte dalla migliore), r4 150 / 1 fuori (prima
     141-149 / 2). `pause.ts` verifica che la migliore mostrata non
     peggiori mai ("peggioramenti mostrati: 0").
   - **Rifinitura delle punte** (`rifinisciPunte`, segnalazione dell'utente:
     "dovrebbe accorgersi che si può subito eliminare una strada e spostare i
     due edifici sul fine strada"): per ogni punta di strada nuova (foglia) si
     prova a togliere le ultime t = 1..3 celle; gli edifici della
     simulazione che resterebbero senza strada (al più 4, di norma la coppia
     di fine strada) vengono ripiazzati con una ricerca esaustiva fra le
     posizioni libere che toccano la strada rimasta entro 12 celle dalla
     punta (preferite quelle vicine alla posizione attuale: così si
     scambiano anche i ruoli L/C del fine strada); se tutti trovano posto la
     strada si accorcia, e si ripete finché migliora. Un edificio di
     partenza che perderebbe la strada blocca la punta. Gira dopo
     `riparaScollegati`, prima delle metriche (il riallineamento finale
     sistema le strade delle azioni).
     Costo: applicata a OGNI simulazione toglieva il 35% delle disposizioni
     al secondo e a parità di tempo i risultati peggioravano; ora
     `simula(p, punte)` la esegue solo sulle disposizioni "promettenti"
     (nessuna strada scollegata, esclusi <= migliore, strade <= migliore +
     `MARGINE_PUNTE` = 0), rieseguendo la simulazione (deterministica) con la
     rifinitura; nella ricerca dalla disposizione manuale sul migliore dei 3
     tentativi. Misurato: su Sonia accorcia la strada in 122 delle 698
     disposizioni promettenti (Beta 5/421); banco 10-20 s: Beta 46/46,
     Claudio 14/17, Sonia 20/17, Rode 33/18, Avito r3 149 (prima 154), r4 146;
     0 sovrapposizioni, 0 strade scollegate, 0 edifici senza strada.
   - **Riga di stato e PNG per mappa** (richiesta dell'utente): dopo
     "Raccordo a N celle" solo `piazzati X/Y` (solo edifici CON strada,
     municipio escluso; verde se tutti, rosso se ne mancano), `strade N/M`
     (M = città di partenza `originalRoadCells`; verde se meno, rosso se di
     più); intestazione del Planner ridotta a "N edifici · M strade" e il numero di disposizioni
     provate; tolti strade nuove, alti interni, lati liberi, buchi, "trovata
     alla n.", "consigliato dal builder", "✓ finito". "Scegli questa" (e lo
     stato `scelta`) sostituito da **⬇ Scarica PNG**: `scaricaPng` costruisce
     i `CityMapBuilding` della disposizione mostrata (edifici originali con
     le nuove coordinate + una tessera "street" 1×1 per cella di strada, aree
     sbloccate come celle 1×1) e chiama `renderCityMapPng` di
     `CityMapView.tsx` (ora esportata), stessa resa (scala 2) dell'export PNG
     del pannello MAPPA; file `foe-planner-raccordo3|4-<data>.png`.
     `PlannerView` riceve `uiLang` da App.tsx (etichetta del municipio).
     Sulle mappe del Planner i Grandi Edifici sono rossi (`#dc2626`, set
     `grandiEdifici` da `isGreatBuilding`), come nella mappa.
   - **Fase C: rifinitura continua degli edifici senza strada**
     (`rifinisciSenzaStrada`, richiesta dell'utente: dopo COMPLETA il
     riempimento non deve accontentarsi della prima soluzione, ma ridurre i
     buchi interni lasciando lo spazio libero fuori dal perimetro occupato,
     dove entrano edifici più grandi; si possono spostare anche gli edifici
     senza strada di fase 1 e 2). Parte dopo il riempimento (fillMask +
     "ultimi rimasti") e continua senza fine (solo Reset la interrompe;
     opzioni `shouldStopFill` / `onFillActive`, senza `shouldStopFill` la
     fase C non gira: banco invariato). Si può mettere in **pausa** (⏸ Pausa
     è attivo anche durante il completamento; niente più pulsante FERMA):
     in pausa si possono trascinare o togliere col tasto destro SOLO gli
     edifici senza strada (`MapCanvas` prop `soloSenzaStrada`: edifici con
     strada e strade bloccati); a ▶ Riprendi le posizioni manuali degli
     edifici senza strada diventano la disposizione corrente e la migliore,
     e la rifinitura riparte da lì (i tolti tornano fra i da piazzare). Prova
     `bench/fillpause.ts` (Beta r4: pausa a 3 s di fase C, tolti 5 edifici
     senza strada, ripresa: 5/5 ripiazzati, 131/131, 0 sovrapposizioni). Strade, municipio ed edifici con
     strada fermi. Ricerca a vicinati: finestra 6-14 × 6-14 centrata su un
     buco interno (70%) o su un edificio senza strada a caso; si tolgono gli
     edifici senza strada che la toccano e si ririempie la maschera (celle
     libere della finestra + celle degli edifici tolti) con loro + i non
     piazzati, con `fillMask(..., 1500, fast)`. Punteggio: area senza strada
     non piazzata → celle dei buchi interni (zone libere che non toccano il
     bordo dell'area sbloccata) → numero di zone libere. Cammino che accetta
     gli equivalenti, migliore (mostrata, restituita) solo con miglioramenti
     stretti, ripartenza dalla migliore dopo 400 tentativi senza
     miglioramenti. Il PNG si può scaricare in ogni momento.
     Banco (`FILL=<ms>`): Beta r4 buchi interni 41 → 11 in 20 s; Avito r3
     non piazzati 7 → 3 (25 s); Sonia, Rode già a 0 buchi interni; tutti 0
     sovrapposizioni.
     **Obiettivi rivisti** (segnalazione dell'utente: pezzi blu staccati dal
     resto, buchi interni da colmare con pezzi di lato >= 2, i pezzi con un
     lato = 1 per ultimi come tappabuchi). Punteggio: area non piazzata dei
     pezzi "veri" (lati >= 2) → area dei pezzi STACCATI (edifici senza strada
     non collegati, attraverso celle occupate, alla massa del municipio) →
     celle dei buchi interni → PERIMETRO ESPOSTO (lati cella libera/cella
     occupata: tiene la massa compatta) → numero di zone libere. I pezzi con
     un lato = 1 sono tolti dalla ricerca e rimessi per ultimi (`tappabuchi`)
     sulla migliore: prima nelle celle dei buchi interni, poi dove toccano più
     celle occupate, mai staccati. Nuova mossa "riloca" (30%): il pezzo
     staccato o più esposto (o un non piazzato) viene rimesso nel posto
     libero con più contatto; la finestra ririempita con fillMask parte da un
     pezzo staccato/esposto o da un buco interno. In pausa i tappabuchi sono
     ricalcolati alla ripresa. Banco (Beta r3, 25 s): buchi interni 8 → 4,
     perimetro esposto 82 → 66; Avito r3: non piazzati 7 → 2, buchi interni
     63 → 45, perimetro 267 → 229; 0 pezzi staccati, 0 sovrapposizioni.
   - **Revisione del codice e ottimizzazioni (ottobre 2026)**. Tutte le
     ottimizzazioni della ricerca sono a risultato IDENTICO (verificato col
     banco a NVAL fisso: stesse strade, stesso "trovata alla n.", stessi
     finali su Beta/Sonia/Rode):
     - `GridSet`: insieme di celle su griglia densa (Uint8Array) con stessa
       interfaccia di Set<string> + `hasXY`/`setRect`; `occupied` è un
       GridSet e ogni simulazione fa `occupied.clone()` (memcpy) invece di
       ricopiare migliaia di stringhe; `edif` idem; `fitsS`/`free`/
       `isFree` numerici (`cellGrid`, `inCella`, `gIdx`); i 14 cicli
       "occ/edif add/delete cella per cella" sostituiti da `rett(x,y,w,h,v)`.
     - `attaccaAStrade` numerica (strade su griglia, posizioni viste con
       timbro, forme senza posto saltate: l'occupazione cresce soltanto).
     - `provaDorsaleCap`: controlli L/C numerici prima di costruire `extra`.
     - `ricompatta`/`valuta`: celle e strade della prova con timbro su
       griglia invece che in Set.
     - `bilancia`: `ok`/`stradaLibera` numerici.
     - Validazione delle sovrapposizioni a fine simulazione: parte dalla
       griglia occupata, libera i posti originali degli edifici mossi e
       segna azioni + strade nuove (prima: Map di TUTTE le celle della
       città a ogni simulazione).
     - `contaBuchi` e il conteggio delle celle libere sulla griglia.
     Effetto (disposizioni in 8 s, raccordo 4): Beta 2.373 → 6.222, Claudio
     3.082 → 7.337, Avito 1.226 → 3.931 (×2,4-3,2).
     - Fase C: `massa` e `analizza` su griglia (`og` aggiornata da
       `metti`/`togli`), buchi interni come indici: Avito 8.241 → 43.435
       tentativi in 15 s (×5).
     - Motore segnaposto, fase "noroad" (ultimi edifici senza strada): ora
       il posto libero che tocca più celle occupate invece del primo libero
       in alto a sinistra (lasciava pezzi isolati, poi da recuperare in fase
       C).
     - Codice morto rimosso: `ALTI_ESTERNI_VINCOLO` (sempre false) e il suo
       ramo in `meglio`, `DEBUG_SOVRAPPOSIZIONI`, una funzione inutilizzata
       in fase C.
   - **Planner e profili** (bug segnalato: dopo l'eliminazione del profilo
     il Planner restava visibile). App.tsx: il Planner è montato solo con
     una città importata (`cityMapBuildings.length > 0` e celle sbloccate),
     `showPlanner` torna false quando la città si svuota, e `key =
     activeProfileId`: cambiando profilo il componente si rimonta (lo
     smontaggio ferma le ricerche e scioglie le pause dell'altro profilo, che
     prima potevano continuare a scrivere sulle mappe). `PlannerView`: se la
     città cambia nello stesso profilo (re-import) la corsa in atto si ferma
     e mappe/ricerca si azzerano.
   - **Avviso strade a due corsie**: se la città ha edifici con
     `roadLevel >= 2`, sotto l'intestazione del Planner compare un avviso
     ambra (non bloccante, `role="alert"`) con il loro numero: il Planner li
     tratta come se bastasse una strada a una corsia e traccia solo strade a
     una corsia, quindi per loro il risultato non è accurato. Senza questi
     edifici l'avviso non compare. Chiudibile con la X (stato non salvato:
     ricompare a ogni apertura del Planner e cambio di città).
   - **Edifici militari**: sulle mappe del Planner sono marroni (`#92400e`,
     come nella mappa città; `PlannerBuilding.isMilitary`, GE esclusi).
     Alcatraz (`X_ProgressiveEra_Landmark1`) e Nave da guerra stellare
     (`X_SpaceAgeSpaceHub_Landmark1`) producono ogni 24 ore le truppe di un
     edificio militare anche se non è collegato alla strada: se uno dei due
     è in città (`GE_RIFORNIMENTO_MILITARE`, `PlannerProblem.geRifornimento`
     in `buildPlannerProblem`) gli edifici militari diventano `roadLevel = 0`
     (trattati come senza strada da builder, ricerca e riempimento) e il
     Planner mostra un avviso informativo azzurro con il nome del GE e il
     numero di militari (chiudibile con la X; stato solo del componente,
     NON salvato: ricompare a ogni apertura del Planner e cambio di città).
     Senza questi GE i militari restano con la loro
     strada (collegati come gli altri edifici con strada). Il PNG scaricato
     usa la resa della mappa città esportata (militari non distinti).
     Militare = flag `isMilitary` della mappa OPPURE prefisso `M_`
     (`isMilitaryBuildingId`), così vale anche per profili salvati senza il
     flag (es. Tana dei furfanti `M_AllAge_EasterBonus1Small`). Verificato
     sull'export della città dell'utente (`planner-test/Sdrushi.json`: Nave
     da guerra stellare + Tana dei furfanti → Tana con roadLevel 0).
   - **Bug fase 1, passo 10 (colonna ovest)**: l'insieme delle celle
     occupate conteneva strade ed edifici piazzati ma NON il municipio (che
     non sta in `ctx.placed`); quando la strada verticale passa a una cella
     dal municipio, un pezzo della colonna ovest poteva sovrapporsi al
     municipio (città dell'utente, `planner-test/Sdrushi.json`: Fattoria
     Terrazzata Oro 4×3 su un buco 3×3). Ora le celle del municipio sono in
     `occ`. `bench/chk.ts <Città>` controlla le sovrapposizioni in ogni tappa
     del builder: 0 su tutte e 6 le città. Da verificare anche in
     `fase1.py` di FoE City Builder (stesso passo).
   - **UI**: rimosse la legenda in fondo al Planner e la X di chiusura
     (prop `onClose`): il Planner si apre e si chiude col pulsante PLANNER.
   - **Blocco compattato a ovest** (richiesta dell'utente su
     `planner-test/Belladonna.json`, città con moltissimi edifici con
     strada): il passo 7 della fase 1 lasciava il blocco a 4 celle dal bordo
     ovest perché la regola "distanza dal bordo 0 o >= 4" valeva anche per gli
     edifici più stretti (Alcatraz 7×10 a filo ⇒ Tempio 6×6 a 1 cella:
     vietato). Nuova opzione `Fase1Options.compattaOvest` (attiva di default
     in `runBuilder`): dopo la scelta normale, il blocco scivola ancora a
     ovest finché tutto (municipio, strade, edifici) resta nell'area
     sbloccata e le regole valgono sui lati nord/sud/est; sul lato ovest sono
     ammesse distanze 1-3 (le fessure si riempiono coi pezzi stretti in fase
     C). Belladonna (12 s): edifici con strada esclusi dalla ricerca 67 → 2,
     non piazzati 66 → 6 (r3) e 31 → 6 (r4); le altre 6 città invariate (il
     blocco era già al bordo); 0 sovrapposizioni in tutte le tappe del
     builder (`bench/chk.ts`). Il banco accetta `COMPATTA=0` per il
     confronto.
   - **Sovrapposizioni temporanee in pausa** (città piene come Belladonna:
     senza spazio libero non si potevano scambiare due edifici): un edificio
     si può rilasciare anche sopra altri edifici (fantasma arancione; verde =
     posto libero; grigio = non ammesso: fuori area o su una strada). Gli
     edifici sovrapposti (`sovrapposti()`) hanno un riquadro rosso pieno; con
     sovrapposizioni ▶ Riprendi e COMPLETA sono disattivati e l'intestazione
     mostra "⚠ N edifici sovrapposti: risolvi prima di riprendere".
     L'edificio spostato passa in cima (delete + set nella Map): è disegnato
     sopra e il click lo seleziona per primo.
   - **Fino a 4 scenari in parallelo**: raccordo 3/4 × blocco di fase 1
     "compattato" (a ovest, `compattaOvest`) o "standard" (regola originale).
     `VName = "r3c" | "r4c" | "r3" | "r4"`, stato per scenario con `tutte()`,
     `Scenario { id, v, compatto, raccordo }`. In `start()` il builder gira
     con `compattaOvest = true`; lo scenario standard si calcola solo se la
     compattazione ha davvero spostato il blocco (`Fase1Result.compattato` /
     `BuilderOutcome.compattato`), altrimenti i due coinciderebbero (verificato
     con `bench/dup.ts`: Belladonna e Rode 4 scenari, le altre 5 città 2). Un
     badge "compattato"/"standard" appare solo quando esistono entrambi per
     lo stesso raccordo. Accanto a "Scarica PNG" il cestino 🗑 elimina uno
     scenario (`elimina`: `eliminatiRef` fa fermare la sua corsa via
     `shouldStop`, la sua eventuale pausa si scioglie); le altre proseguono,
     ne resta sempre almeno una. Pausa / COMPLETA / sovrapposizioni contano
     solo gli scenari visibili; la griglia resta sempre a due colonne (una
     mappa sola a tutta larghezza diventava troppo alta). PNG `foe-planner-raccordoN[-standard]-<data>.png`.
   - **road_eff** (`src/planner/roadEff.ts`, idea dell'utente): per ogni
     edificio con strada (municipio escluso) road_eff = celle di strada che
     toccano il suo perimetro − min(larghezza, altezza) (6×4 attaccato col
     lato corto 0, col lato lungo +2; 6×6 su una cella di fine strada −5;
     4×4 nell'angolo di un incrocio +4). `num_road_eff_pos` = edifici con
     road_eff > 0, `sum_road_eff_pos` = somma. `simula` li calcola sulla
     disposizione finale (`Piano.effNum/effSum`, strade su griglia +
     `stradeAdiacenti`); la ricerca manuale li ha in `punteggio`.
     Posizione nell'ordine di merito: costante `EFF_ORDINE`. Misurato con
     `bench/cmp3.sh` (10 s, Beta, Sonia, Avito, Rode × r3/r4): "prima" delle
     strade riduce num_pos (Beta 6 → 2) ma AUMENTA le strade (Beta 78/76 →
     84/83, Sonia 77 → 81, Avito r3 184 → 187 con 2 edifici in più fuori);
     quindi `EFF_ORDINE = "dopo"`: primo spareggio a parità di strade (prima
     dei buchi), strade invariate, meno edifici con road_eff > 0 (Beta r4 6 →
     4). `DEBUG_PLANNER = true` (roadEff.ts): sotto ogni mappa riquadro
     giallo con num/sum e l'elenco degli edifici con road_eff > 0 (+eff,
     nome, dimensioni, celle di strada, lato corto), che sulla mappa hanno un
     bordo giallo tratteggiato; con false tutto nascosto. Il banco stampa
     "road_eff: num_pos, sum_pos" e accetta `EFF=prima|dopo|no`.
     Edifici 1×1 sempre esclusi dal conteggio e 2×2 esclusi quando sono
     nell'angolo di un incrocio (toccano una strada su un lato nord/sud E su
     uno est/ovest): `esclusoDaRoadEff(b, x, y, isRoad)`, regola dell'utente
     (lì sono già ottimi: niente bordo tratteggiato, non contano). In
     `attaccaAStrade` 1×1 e 2×2 (`piccoloDaAngolo`) preferiscono le
     posizioni che toccano più celle di strada del loro lato (angolo, +100). L'utente ha poi impostato `EFF_ORDINE =
     "prima"`; rimisurato con i 1×1 esclusi (10 s): Beta "dopo" 78/79 strade,
     "prima" 84/83 (num_pos 1/0); Sonia r3 "dopo" 77, "prima" 81: "prima"
     costa ancora 4-7 strade.
   - **strade_vuote** (idea dell'utente): celle di strada con almeno un lato
     (N/S/E/O) su una cella sbloccata libera: strade sprecate.
     `calcolaStradeVuote` (roadEff.ts) per la UI: con `DEBUG_PLANNER` sono
     evidenziate con bordo rosso tratteggiato e il riquadro di debug mostra
     "strade_vuote N". Minimizzate in due punti:
     - ricerca (fase 3): `Piano.stradeVuote` = celle di strada con un lato su
       un BUCO (`stradeVuoteSuBuchi`, subito dopo `contaBuchi`): durante la
       ricerca gli edifici senza strada non sono ancora piazzati, quindi una
       cella libera copribile verrà riempita, un buco no. Criterio subito
       dopo le strade (prima di road_eff "dopo" e dei buchi);
     - fase C: nel punteggio dopo i buchi interni, prima del perimetro
       (`stradeVuote()` numerico sulle celle di strada fisse).
     Banco (EFF=prima come impostato dall'utente, 8 s + 6 s di fase C): Beta
     r4 strade_vuote 12 → 7, r3 11 → 14 (variabilità della traiettoria, stesse
     strade), Sonia 0; strade invariate. Origine tipica su Beta: la riga
     libera lasciata accanto all'inizio di una dorsale (gapN/gapS = 1), dove
     non entra nessun edificio alto almeno 2.
   - **Concentrare i buchi e togliere la punta** (idea dell'utente: spostare
     gli edifici fra due dorsali in modo che i buchi finiscano tutti sulla
     stessa, poi sul fine strada — uno sopra e uno sotto — così l'ultima cella
     si elimina e i due fini strada arretrano). `rifinisciPunte` esteso:
     (1) i pezzi tolti dalla punta possono andare in un posto libero accanto a
     QUALUNQUE strada (prima entro 12 celle), quindi anche nei buchi di
     un'altra dorsale; (2) se non basta e i pezzi da spostare sono al più 2,
     "scambio": uno dei 12 edifici con strada più vicini alla punta cede il
     posto e viene ripiazzato anche lui accanto a una strada (ricerca
     esaustiva su tutti i pezzi). `posizioni` è numerica (celle di strada
     con un vicino libero, timbro per le posizioni viste): la prima versione
     a stringhe costava il 18% del tempo. Misure: sulle stesse prime ~350
     configurazioni (NVAL, senza effetto traiettoria) strade nuove Beta 52 →
     50/51, Rode 27 → 26 e 38 → 36, Belladonna r3 231 → 229; a 20 s Rode r4
     26 → 24, Beta 46/46 → 48/47 (traiettoria diversa della ricerca
     locale), Belladonna 6 → 5 edifici fuori; 0 sovrapposizioni.
   - **Penalità quadratica di road_eff** (segnalazione dell'utente su Beta
     r3: il 6×6 fine strada della verticale toccava 6 celle della dorsale,
     che andava 2-3 righe più su). Il criterio principale dopo esclusi e
     deficit è ora il COSTO = strade + min(`TETTO_EFF_QUAD` = 2,
     `PESO_EFF_QUAD` = 0,1 × Σ road_eff²) (`Piano.effQuad`, edifici di partenza
     compresi, 1×1 e 2×2 d'angolo esclusi; `SOGLIA_EFF_QUAD` = 0), poi le
     strade come spareggio. Il quadrato fa pesare un 6×6 a +6 (36) molto più
     di tanti +1; il TETTO impedisce di pagare più di 2 strade per evitarlo:
     senza tetto (peso 0,1-0,5) Avito r3 passava da 180 strade / 5 fuori a
     188 / 15. Misure (10 s, peso 0 → scelto): Beta r3 81 strade, max
     road_eff 5 → 78, max 3; Beta r4 78 → 79 con road_eff tutti ≤ 0; Rode r3
     87 → 86; Sonia, Sdrushi, Avito, Rode r4 invariati. Anche la ricerca
     dalla disposizione manuale usa lo stesso costo. Il banco accetta
     `PQ`, `QT`, `QC` per peso, soglia e tetto.
   - **road_eff con più lati** (`roadEffDi`, segnalazione dell'utente: su
     Beta r3 il 6×6 Himeji Castle, fine strada della verticale, aveva la
     dorsale lungo tutto il lato nord ma valeva solo +1 = 7 − 6). Ora la
     connessione "necessaria" è il lato corto min(w,h) ma, se l'edificio
     tocca strade su PIÙ lati, non più della connessione più piccola fra quei
     lati (basta quella): Himeji 7 − 1 = +6 → la penalità quadratica (36 ×
     0,1, tetto 2) lo evita. Invariati i casi a un solo lato (6×4 sul lato
     lungo +2) e l'angolo 4×4 (+4). Beta (10 s): Himeji sparisce dall'elenco,
     78/77 strade. Il banco ora costruisce il problema con
     `buildPlannerProblem` come l'app (militari senza strada con
     Alcatraz/Nave), quindi i numeri non sono confrontabili con i
     precedenti; `VOCI=1` stampa l'elenco degli edifici con road_eff > 0.
   - **Aggiungere strade in pausa**: durante la pausa della ricerca un click
     su una cella sbloccata libera aggiunge una cella di strada (`Edit.addRoad`,
     gialla come le strade nuove: entra in `lastPath`); un click su una
     strada la elimina come prima. Non durante il completamento (lì strade
     ed edifici con strada sono bloccati). Alla ripresa `ribasa` tiene solo
     le strade collegate al municipio e pota i rami morti: una cella isolata
     o che non serve nessun edificio sparisce.
   - **Verso le soluzioni dell'utente (Beta r3: 77 → 75 a mano spostando la
     dorsale in basso 2 righe più su)**. Tre aggiunte:
     1. intensificazione: a ogni nuova migliore della ricerca parametrica si
        provano subito le varianti con una riga di dorsale a ±1..±3 (anche con
        lunghezza stimata 0) (`accodaVicini` / `codaVicini`): Beta r3 trova le
        77 strade alla disposizione n. 3.207 invece che alla 19.074;
     2. stagnazione: dopo `STAGNAZIONE` = 4.000 disposizioni senza
        miglioramenti la ricerca passa da sola alla ricerca LOCALE sulla
        migliore (`statoDi(best)` come ripresa; è la stessa di dopo una
        modifica manuale: metà tentativi parametrici, metà vicinati; etichetta
        "Ricerca locale");
     3. vicinato "dorsale intera": si tolgono tutti gli edifici attaccati a una
        dorsale (la strada viene potata) e la si ricostruisce su una riga a
        ±1..±3.
     Banco: Beta r3 77 → 76 strade (30-90 s; le 75 dell'utente non ancora
     raggiunte), Rode r4 78 → 76, Sonia/Sdrushi/Avito invariati, 0
     sovrapposizioni.
     Provato anche (e scartato, nessun effetto su Beta r3, sempre 76 fino a
     160 s): accettare nella ricerca locale passi con 1 strada in più con
     probabilità 2-8% e stagnazione a 1.500. La soluzione da 75 dell'utente
     ha fra le dorsali una colonna accanto alla verticale tutta piena (3×3,
     3×3, 4×3, 2×2, 2×2) e tre 5×5 alla fine della dorsale bassa (L sopra, C a
     est, uno sotto): schema che il generatore non produce ancora.
   - **Importa JSON** (richiesta dell'utente: provare il Planner sulle città
     che mandano gli utenti): nell'intestazione del Planner "📂 Importa JSON"
     carica l'export JSON del pannello MAPPA (`buildings` con cityentity_id /
     width / length / x / y / road_requirement, `roads` {single, two_lane},
     `unlocked_areas`); `leggiCittaJson` lo converte in CityMapBuilding (GE
     da "X_", militari da "M_", municipio da "H_") e celle sbloccate. Il
     problema del Planner usa la città importata (`esterna`) al posto di
     quella del profilo; strade di partenza = single + 4 × two_lane (l'export
     non ha le posizioni delle strade). Etichetta "🏙 nome" e "↩ Città del
     profilo" per tornare indietro; errore leggibile se il JSON non è valido.
     Nulla viene salvato. Il Planner resta visibile solo se il profilo ha una
     città. Prova sul banco con `planner-test/Filanush.json` (172 edifici):
     255-263 strade contro 276, 0 sovrapposizioni.
   - **Riga di stato**: "piazzati: con strada X/Y · senza strada X/Y · strade
     N/M · K disposizioni" (ciascun conteggio verde se completo, rosso se ne
     mancano; municipio escluso).
   - **Bug corretto: strade applicate ≠ strade valutate.** Alcuni passi della
     simulazione (compattazione, scambi) aggiornano `rd` ma non sempre le
     strade delle azioni; si applicava una strada diversa da quella valutata
     (Beta r4, n. 3312: una cella isolata e un 2×3 senza strada). Ora a fine
     `simula` le strade delle azioni + `stradeExtra` vengono riallineate
     ESATTAMENTE a `rd`. `bench.ts` accetta `NVAL=<n>` (ricerca fermata dopo
     n disposizioni: riproducibile). `applica` (ex blocco "Applica la
     disposizione migliore") è ora una funzione, difensiva su edifici già
     liberati.
   - **I grandi sono i fine strada** (segnalazione dell'utente su Diviziaco,
     raccordo 4 compattato: fini strada 4×5 mentre i 6×6 stavano attaccati
     alla verticale). Tre parti:
     1. `Params.liberaGrandi` (configurazioni dedicate, 35% delle casuali,
        mutazione 9): i grandi (lati >= 5, `LATO_GRANDE`, ora esportato da
        roadEff.ts) piazzati dal builder sul lato est della verticale
        (x = x0) tornano nel pool e diventano candidati fine strada.
     2. `contaFiniStradaErrati` (roadEff.ts): fine strada = edificio
        collegato da un solo lato con meno celle di strada del lato corto;
        errore = min(grandi NON fine strada, medi — non grandi, lato corto
        >= 3 — fine strada), solo a est della verticale e non fissi.
        `Piano.finiErrati` è spareggio subito dopo le strade; nel punteggio
        della ricerca locale è l'ultimo (prima dei buchi peggiorava Avito:
        4 edifici senza strada fuori).
     3. Scambio grande ↔ medio fine strada sulla disposizione finale, dopo la
        ricerca e prima della fase B: il grande va sul capolinea del medio
        (stesso lato di strada, almeno una cella di contatto in comune, deve
        restare fine strada), il medio nel rettangolo del grande toccando una
        sua strada con road_eff <= max(1, road_eff del grande) (un 4×5 sulla
        verticale è +1), fra le posizioni quella con meno buchi. Strade
        invariate. Si rinuncia se i buchi crescono più di max(w, h) del
        grande; se il riempimento di fase 2 + primo posto libero lascia fuori
        edifici senza strada, si riprova senza gli scambi e si tiene il
        migliore. Prima versione DENTRO `simula`: cambiava deficit/buchi dei
        piani e quindi il percorso della ricerca (Rode r3 86 → 88 strade su 4
        semi), quindi spostato dopo: le strade trovate sono identiche a
        prima. Misure (NVAL 5000, 4 semi, banco con `SEED`): Diviziaco r4
        fini errati 3/1/1/0 → 0/0/0/0, r3 0 ovunque, tutti piazzati, strade
        invariate (72 / 75-76); Avito r3 stessi edifici fuori che senza
        scambi; Rode, Sdrushi, Beta, Sonia invariati. Limite: durante la
        ricerca la mappa mostrata non ha ancora gli scambi (avvengono a
        COMPLETA).
   - **Bordi gialli e verticale accorciata** (regola dell'utente su
     Diviziaco r4: i problemi di efficienza vengono SOLO dagli edifici col
     bordo giallo, road_eff > 0, attaccati dal lato sbagliato — i 4×5 sul lato
     est della verticale toccano 5 celle. Sono loro a doversi spostare; la
     soluzione ovvia era allungare la dorsale e accorciare la verticale, che
     il builder fissa e non era mai stata toccata). La verticale di Diviziaco
     r4 (y 13–62) è usata in ogni cella dalla colonna ovest di fase 1/2:
     accorciarla richiede di spostare anche pezzi a ovest (concordato con
     l'utente: "ovest mobile alle estremità", mai i fissi di fase 1
     `fissiBuilder` = `opts.fissi`).
     1. Vicinato "bordi gialli" della ricerca locale (15% dei tentativi, fra
        "fine di un ramo" e "gruppo"): si tolgono tutti gli edifici con strada
        con road_eff > 0; metà delle volte anche quelli che occupano le celle
        accanto alle ultime 1-6 celle della verticale (nord o sud, anche a
        ovest e i fini strada). `ribasa` pota la punta rimasta senza edifici,
        `simula` li riattacca (es. sulla dorsale allungata).
     2. Ricerca parametrica: `Params.accN/accS` (verticale accorciata di k
        celle: le celle tolte vanno in `Piano.stradeTolte`, `strade` = nuove −
        tolte; gli edifici che restano senza strada tornano in gioco, anche
        quelli a ovest — eccezione nel controllo dei fissi tramite
        `daAccorcia`; mai un incrocio né i fissi di fase 1) e
        `Params.liberaGialli` (i gialli a est della verticale tornano in
        gioco: utile sulla base della ricerca locale; sulla base del builder
        non ce ne sono). `simula` lavora su una copia locale delle strade di
        partenza (`stradeBase()`); `applica`, `statoDi`, `mostra` tolgono
        `stradeTolte`. 72 configurazioni dedicate, 25% delle casuali, mossa 11
        di `muta`. Da sole non vincono (deficit e strade più alti): il
        guadagno arriva dal vicinato.
     Misure (40 s, r4): Diviziaco 72 → 70 strade, verticale y 13–62 → 20–62
     (accorciata di 7 a nord, la dorsale più lunga con i 4×5 attaccati col
     lato corto); Rode r3, Sdrushi r4, Beta r3, Diviziaco r3 invariati
     (35 s, con/senza `NOACC`). Resta un 5×6 nell'incrocio verticale/dorsale
     a +6 (meno strade comunque).
   - **Niente fase 2 nel builder** (richiesta dell'utente: riempire con gli
     edifici senza strada in fase 1/2 è sbagliato, possono intralciare nuove
     disposizioni lungo la verticale; il riempimento si fa solo alla fine).
     `runBuilder` esegue solo fase 1 (che piazza solo edifici con strada);
     in `fase2.ts` restano `fillMask` e le strategie (usati da fase B e fase C
     del completamento), rimossi `runFase2`, `generaMapgrid`, `MapGrid`,
     `Fase2Result` (il pool di `fillMask` è ora `PoolItem[]`);
     `BuilderVariant` perde `fase2Count/Strategy/Coverage/Area`. Il
     checkpoint di fase 1 conserva `pool_iniziale_senza_strada` (porting
     fedele, non più usato). Misure (30 s): Diviziaco r4 70 → 69 strade
     (road_eff 7/19 → 5/12), Diviziaco r3 75 =, Sdrushi r4 75 =, Rode r3 86 →
     85 ma 1 edificio senza strada fuori, Beta r3 76 → 77-78 (3 semi), Beta
     r4 77 → 78. Il differenziale col Python di fase 2 non è più applicabile
     al builder.
   - **Grandi problematici** (regola dell'utente: anche gli edifici con lato
     corto >= 5 attaccati a 2 o più celle di strada sono "problematici", bordo
     giallo, e vanno spostati sui fini strada con UNA cella, al posto dei
     fini strada con lato corto <= 4). `roadEffDi`: per i grandi road_eff =
     celle − 1 se le celle sono >= 2 (6×6 lungo la verticale: +5), altrimenti
     0. Essendo la stessa funzione, la regola vale ovunque: bordo giallo ed
     elenco di debug in ogni fase, costo della ricerca (Σ road_eff², tetto 2),
     vicinato "bordi gialli", `liberaGialli`, spareggi. Scambio finale
     grande ↔ fine strada: grandi = 2+ celle, il grande deve finire con
     esattamente 1 cella, i "medi" sono ora tutti i non grandi con lato corto
     >= 2 (prima >= 3); `contaFiniStradaErrati` allineato. Misure (30-40 s):
     Diviziaco r4 69 → 67 strade e nessun grande problematico (tutti i fini
     strada sono 6×6/6×5/5×6/5×5), Diviziaco r3 75 = (resta un 5×6 a +4),
     Beta r3 77 (un 5×5 a +4), Rode r3 85 tutti piazzati, Sdrushi r4 75 =,
     Sonia r3 77 = (identico con la regola vecchia), Beta r4 78.
   - **Parte ovest non più intoccabile nella ricerca locale** (idea
     dell'utente: gli edifici di fase 1 sono in linea di massima ottimi, ma a
     volte conviene spostarne alcuni, soprattutto quelli attaccati al lato
     ovest della verticale, es. un 4×4 sostituito da un 3×4 per abbassare
     l'altezza). I vicinati della ricerca locale considerano ora tutti gli
     edifici con strada tranne i fissi di fase 1 attorno al municipio
     (`fissiBuilder`); nuovo vicinato "colonna ovest" (8%): 2-5 edifici
     consecutivi attaccati al lato ovest della verticale (metà delle volte
     anche quelli di fronte, a est) tornano in gioco. La ricerca parametrica
     dalla base del builder continua a non toccare la parte ovest (`fissi` =
     `fissiBuilder` ∪ `idOvest`, salvo accorciamento della verticale). Rete
     di sicurezza in `simula`: invalido se si sposta un fisso di fase 1, o un
     edificio ovest PRESENTE nella base fuori da `daAccorcia` (quelli tolti
     dalla ricerca locale non sono nella base). Misure (30 s, con/senza):
     Diviziaco r4 70 → 68, Rode r3 85 → 86 (1 senza strada fuori), Beta r4 78
     =, Sdrushi r3 81 = (1 fuori in meno): neutro, variabilità ±2.
   - **Diviziaco r4: 67 → 66 come la soluzione dell'utente** (verticale
     corta 17–48 con i fini strada grandi ancora in fondo, una sola dorsale a
     T, lato est della verticale riempito esattamente: 4×4 + 3 × 4×3 + 4×4).
     Tre modifiche:
     1. `accorcia` (Params.accN/accS) ora fa ARRETRARE i fini strada della
        verticale (tappo e laterale) di K insieme alla strada invece di
        liberarli; si liberano gli edifici sotto i loro nuovi posti e quelli
        rimasti senza strada (mai i fissi di fase 1). k fino a 16 per
        estremità (configurazioni accN 0-8 × accS 0-16, casuali e `muta`).
     2. `Params.estEsatto`: lato est della verticale "a incastro": per ogni
        tratto libero, somma di sottoinsieme sulle altezze degli edifici con
        h <= w (copertura massima, poi meno pezzi); gap attorno alla dorsale
        anche 0 (edifici d'angolo che toccano verticale e dorsale:
        `lunghezzaLibera` non si ferma più su `celleVerticale`).
     3. `MARGINE_DEFICIT` 1,05 → 1: senza fase 2 TUTTI gli edifici senza
        strada sono da piazzare e il 5% (≈ 128 celle su Diviziaco) dava
        deficit > 0 a ogni disposizione; il deficit (prima delle strade)
        sceglieva quella con meno buchi, non con meno strade.
     Misure (30-75 s): Diviziaco r4 67 → 66, r3 75 → 70; Avito r3 174 → 167
     tutti piazzati, r4 170 (1 senza strada fuori, come prima); Beta r3 76,
     r4 78; Rode r3 85 tutti piazzati; Sdrushi r4 75 =; Sonia r3 77 → 76.
   - **Ricerca girandola più sistematica e scelta del municipio
     deterministica** (richiesta dell'utente: meno casuale).
     *Causa della casualità trovata*: `scegliGirandola` chiudeva ogni prova
     con `shouldFinishSearch` letto dai fotogrammi, che escono ogni 500 ms:
     il numero di disposizioni valutate (e quindi la posizione scelta)
     dipendeva dal carico della CPU. Nuova opzione
     `CompletionOptions.limiteValutate` (stop esatto nei due cicli di
     ricerca); la scelta del municipio la usa → stessa città, stesso
     risultato (verificato: due corse parallele identiche). Anche i banchi
     gir3/gir4/girf la passano.
     *Ricerca*: configurazioni iniziali = 8 semi + griglia di 256 tagli
     orientati (4 livelli per braccio da `pv`: favoriti 0-30%, sfavoriti
     40-85%, misto se pv ≈ 0,5; angoli a seme 1) + 80 casuali;
     `accodaVicini` girandola = ogni braccio ±1,2,3,4,6,8, una cella fra due
     bracci, ogni angolo (-1 o semi 1..10), lati (semi 1..8); `prova(p,
     inSalita)` con `salita` (discesa dal punto corrente). Ripartenze
     casuali ai minimi locali provate e tolte.
     *Due girandole* (scelta dell'utente): con 150 disposizioni per
     posizione tutte le posizioni valgono quasi uguale (Sdrushi2: tutte 73-74
     strade), la scelta non distingue. Ora due mappe, ognuna con la sua
     ricerca lunga: "Girandola" col municipio al CENTRO della mappa, verso
     orario (`baseCentrale`, parte subito, nessuna scelta); "Girandola 2"
     (`VName` "gir2", `Scenario.gir = 1`) con la posizione migliore delle
     prove brevi diversa dal centro (`scegliGirandola` restituisce le 2
     migliori; a parità vince la più vicina al centro, poi la più a
     sinistra; fra i candidati anche la posizione attuale del municipio
     della città importata). Banco (20000 disposizioni, deterministico):
     centro → Sdrushi2 69, Dani 49, Rode 72, Sdrushi 70. Prima griglia dei
     tagli in ordine "sparso" (passo 97) e i semi a bracci interi dopo.
     `gir3.ts`: GIR=0 (centro, default) o GIR=1 (scelta).
   - **Punte dei bracci rifinite** (utente su Dani: una cella vuota in
     fondo a un braccio si toglieva spostando l'edificio che la toccava).
     `rifinisciPunte` lavorava solo sulle strade nuove (`rd`); i bracci
     della girandola sono strade di partenza (`roads`), quindi le loro punte
     non venivano mai rifinite. Con `opts.girandola` anche le foglie di
     `roads` (mai quelle accanto al municipio: la prima cella di un braccio
     ha una sola strada vicina ma è l'attacco al municipio) e la catena può
     risalire nei bracci; le celle tolte da `roads` vanno in `stradeTolte`.
     Banco (VG=150, 6000): Dani 49 (record di Dani 50), Sdrushi 69, Rode 72;
     nessuna strada staccata né edificio scollegato (`girf.ts` Dani: 0
     fotogrammi con scollegati). Restano edifici senza strada fuori su Dani
     (riempimento finale, da ottimizzare a parte).
   - **Prova del riempimento tolta** dalla scelta del municipio (richiesta
     dell'utente: ora conta solo la disposizione degli edifici con strada; il
     riempimento finale si ottimizzerà a parte). `scegliGirandola` sceglie
     fra le 3 finaliste solo con fuori → deficit → strade → più a sinistra
     (sostituisce la "prova del riempimento" descritta più sotto).
   - **Girandola speculare** (città di Dani, 50 strade, `planner-test/
     Dani.json`): la sua è una girandola in verso antiorario (N dalla colonna
     sinistra del municipio, W dalla riga bassa, E dalla riga alta, S dalla
     colonna destra; N ed E di 2 celle). `baseGirandola(…, specchio)`;
     `scegliGirandola` prova ogni posizione in tutti e due i versi, anche a
     destra del centro (k = -4..6, dy 0/±3: 66 prove da 150 disposizioni,
     poi le 3 migliori da 900 e la prova del riempimento). Gli angoli del
     municipio si ricavano dai bracci (accanto alla prima cella di ognuno,
     dalla parte del municipio), quindi valgono per entrambi i versi. Banco:
     col municipio di Dani (39,18, speculare) 50 strade e tutti gli edifici
     con strada; Dani automatica 50 (prima 51). Restano fuori 3-5 edifici
     senza strada: la città di Dani ha solo 4 celle libere in tutto, quindi
     con 50 strade il riempimento finale deve incastrare quasi alla
     perfezione (20 s di rifinitura nel banco non bastano). Sdrushi 69-70,
     Rode 72. `gir3.ts`: FILL=ms per la rifinitura come nell'app.
   - **Angoli del municipio** (girandola, richiesta dell'utente dopo il suo
     69 su Sdrushi). Diagnosi: con i bracci dell'utente (municipio 30,29;
     N 23, W 8, E 13, S 25, letti dall'immagine con la griglia) il motore
     arrivava a 69 ma lasciava fuori la Nave da guerra stellare 3×5: l'utente
     sotto il municipio, a destra del braccio sud, mette Statua 3×2 +
     Osservatorio 3×3 in pila contro il braccio sud e accanto la Nave che
     sporge sotto il municipio e tocca la prima cella del braccio est; così
     le Montagne 6×4 del braccio sud partono una riga più in basso e il
     braccio si chiude in 25 celle. Il riempimento dei lati (un pezzo alla
     volta lungo una strada) non costruisce mai quel blocco.
     `angoliMunicipio(semi, isR)` in simula, chiamata all'inizio di
     `riempiLatiStrade` con `Params.angoli` (un seme per angolo SE/NE/NW/SW,
     -1 = angolo lasciato ai lati): per ogni angolo, rettangoli 3-7 × 3-7
     attaccati al municipio in ordine casuale (al più 8 provati), riempiti
     ESATTAMENTE con edifici con strada che toccano una strada (DFS sulla
     prima cella libera, forme distinte con quantità, 400 nodi); al primo che
     riesce si piazzano i pezzi ("angolo del municipio"). `angoliCasuali()`
     (un angolo su 4 a -1) nelle configurazioni e in `casuale`; `muta`
     cambia il seme di un angolo; `accodaVicini` per la girandola prova ogni
     braccio ±1..±3 celle attorno a ogni nuova migliore. Tagli orientati: i
     bracci favoriti ora si accorciano di 0-40% uniforme (prima quasi mai
     oltre il 10%). Banco: con i bracci dell'utente forzati 69, 368/368, già
     a 1000 disposizioni (prima 69 con la Nave fuori → 73-77); automatica
     Sdrushi 69 (era 71), 368/368, nessun edificio scollegato in nessun
     fotogramma (`girf.ts`); Rode 72 (invariato), Diviziaco 63-64 (era 65);
     scenari standard identici.
   - **Girandola orientata dalle forme** (idea dell'utente su Sdrushi: 69 a
     mano sviluppando in altezza). Un edificio largo (w > h) si attacca a
     una strada verticale col lato corto, uno alto a una orizzontale.
     `pv` = quota per area dei larghi fra gli edifici con strada da
     piazzare (Sdrushi 0,72); `tagliCasuali()`: metà dei tagli come prima,
     metà orientati (bracci del verso sfavorito accorciati del 30-100%, gli
     altri di poco). Banco: Sdrushi resta 71 (anche con NVAL 20000), Rode
     72. Prova col municipio dell'utente (30,27, letto dall'immagine) e i
     bracci della sua disposizione (N 16, W 8, E 20, S 27, tagli forzati
     con TAGLI=11,18,16,7 nella copia del banco): 71, quindi la differenza
     non è la forma dei bracci ma l'incastro lungo i lati.
   - **Revisione + gruppi di edifici uguali nella rifinitura** (richiesta
     dell'utente: es. 30 piazze degli scacchi tutte vicine). Codice morto:
     nessuna variabile inutilizzata (tsc --noUnusedLocals/Parameters); gli
     export non usati fuori dal file sono tipi usati dal banco. In
     `rifinisciSenzaStrada`: 7° termine del punteggio `gruppi` = per ogni
     tipo (entityId) ripetuto, gruppi di edifici uguali che si toccano lungo
     un lato, meno uno (union-find su una griglia cella → pezzo); è l'ultimo
     criterio, quindi non peggiora mai fuori/staccati/buchi/strade
     vuote/perimetro/zone della migliore. Le mosse di riempimento accettano
     sul cammino col confronto senza gruppi (con i gruppi il cammino
     esplorava meno: Beta perimetro 76 → 89); nuova mossa "scambio per i
     gruppi": un edificio fuori dal gruppo più grande del suo tipo prende il
     posto di uno con la stessa impronta, di tipo diverso, che tocca quel
     gruppo (le celle occupate non cambiano). 25% dei tentativi quando non
     ci sono buchi interni, pezzi fuori o staccati, 3% altrimenti. I
     tappabuchi (lato 1), a parità, vanno accanto a un pezzo uguale. Banco
     (`bench.ts` con FILL=15000, r3, "gruppi sparsi"): Beta 24 → 14,
     Sdrushi 86 → 74 (perimetro 23 → 14), Rode 108 → 100 (90 s: 71; Rode ha
     buchi interni per tutta la rifinitura, quindi scambia di rado); firme
     standard invariate (la rifinitura non è nel confronto `det.sh`).
     Variabilità fra prove alta (rifinitura a tempo).
     knip (eseguito dall'utente): tolto `export` da `key`, `buildGrid`,
     `GE_RIFORNIMENTO_MILITARE` e dai tipi interni di fase1/fase2/builder/
     roadEff; `baseGirandola` resta esportata con `@public` (la usano i
     banchi gir4.ts e girp.ts).
   - **Scenari compattati rimossi** (richiesta dell'utente: con "Sposta
     tutto" la compattazione si fa a mano): tolti gli scenari r3c/r4c, il
     badge compattato/standard, `Fase1Options.compattaOvest` (ramo del passo
     7 in `fase1.ts`) e `BuilderOutcome.compattato`; `runBuilder(problem)`
     segue il passo 7 di fase1.py. Restano tre scenari: raccordo a 3, a 4,
     girandola (`VName = "r3" | "r4" | "gir"`). Nuova base del banco
     (NVAL 12000): Diviziaco r4 67 (compattato era 66), r3 71; Beta r3 76,
     r4 77 (invariati); Rode r3 82 (era 83); Sdrushi r4 75 (invariato).
     Le sezioni più sotto sulla compattazione sono storiche.
   - **↩ Annulla completamento** (richiesta dell'utente): dopo COMPLETA
     (completamento in corso o in pausa) il pulsante interrompe il
     completamento e torna alla ricerca in pausa, su ogni mappa con la
     disposizione mostrata quando si è premuto COMPLETA (comprese le
     modifiche a mano) e il conteggio delle disposizioni proseguito; da lì
     si può ottimizzare, smussare, modificare o completare di nuovo. UI:
     `primaRef`/`annullaRef`, `completa()`, `annullaCompletamento()`,
     `corri()` (rilancia `runCompletion` con `riprendiDa`). Motore:
     `CompletionOptions.riprendiDa { stato, valutate }` prepara la ricerca
     come una ripresa da modifiche manuali. Banco `annulla.ts Città r3|r4`:
     Beta r3, Diviziaco r4, Rode r3 validi (nessun overlap né scollegato);
     la ripresa segue il punteggio della ricerca (prima fuori e deficit, poi
     strade), quindi le strade possono anche salire di una se il deficit
     scende, come in una normale ripresa dalla pausa.
   - **Specchia** (richiesta dell'utente): in pausa, accanto a "Sposta
     tutto", ⇋ (orizzontale) e ⇵ (verticale) ribaltano l'intera disposizione
     attorno al rettangolo che contiene edifici e strade (`specchiato` in
     PlannerView): i contatti edificio-strada restano gli stessi. Pulsante
     disattivato se qualcosa uscirebbe dall'area sbloccata. Conta come
     modifica a mano (`applicaManuale`: annullabile, passata alla ripresa).
     Banco `girp.ts … FLIP=h|v`: Rode (h) e Sdrushi (v) validi dopo la
     ripresa, nessun overlap né scollegato. Il pulsante di download si
     chiama ora "⬇ PNG".
   - **Sposta tutto** (richiesta dell'utente): in pausa, nell'intestazione
     di ogni mappa, quattro frecce spostano l'intera disposizione (edifici,
     municipio, strade) di una cella; una freccia è disattivata se qualcosa
     uscirebbe dall'area sbloccata. Conta come modifica a mano (annullabile
     con ↶, passata alla ripresa). Il motore riparte dallo stato traslato
     (`ribasa`); nella girandola i tagli dei bracci restano innocui (solo
     punte che non servono a edifici). Negli scenari del builder la ricerca
     parametrica dalla base resta spenta dopo lo spostamento (la parte ovest
     non coincide più con la base): continua la ricerca locale. Banco:
     `girp.ts Città tx,ty dx,dy NVAL` e `pause.ts Città r3 sposta`: Rode
     girandola spostata di 2,1 → 72 strade, 367/367, nessun overlap né
     scollegato; Beta r3 e Diviziaco r4 validi.
   - **↶ Annulla modifiche manuali** (richiesta dell'utente): in pausa
     (ricerca, smussatura ferma o completamento), se almeno una mappa è stata
     modificata a mano, il pulsante ripristina su quelle mappe l'ultima
     disposizione trovata dall'ottimizzatore o dallo smussatore (tutti gli
     scenari, girandola compresa). `PlannerView`: `autoRef[v]` (ultimo
     fotogramma automatico, con `smussato`), stato `manuali[v]` (impostato da
     `modifica`, azzerato da ogni fotogramma automatico, da Riprendi, avvio,
     Reset e cambio città). Dopo il ripristino `modRef[v] = smussato`: uno
     stato dello smussatore resta una modifica da passare alla ripresa.
   - **Smussa i bordi** (idea dell'utente: nel riempimento finale meno angoli
     di 90° nel contorno della città = pezzi piccoli più facili da
     incastrare). `contaAngoliGriglia` / `contaAngoli` (roadEff.ts): angoli
     del contorno di edifici + strade, per ogni incrocio della griglia 1 o 3
     celle occupate = 1 angolo, 2 in diagonale = 2; esclusi gli incroci con
     una cella libera BLOCCATA (bordo della mappa). UI: "angoli N" nella riga
     di stato di ogni mappa, in tutte le fasi. `smussa.ts` `smussaBordi`:
     pulsante "✨ Smussa i bordi" (solo in pausa durante la ricerca; diventa
     "⏹ Ferma smussatura"; Riprendi/COMPLETA e modifiche a mano disattivati
     mentre gira). Ciclo continuo su tutte le mappe in pausa: scorrimento di
     1-3 celle, scambio di due edifici vicini (allineati a un angolo del
     posto dell'altro), spostamento accanto a una strada qualsiasi. Vincoli:
     strade invariate, ogni edificio con strada collegato, road_eff degli
     edifici mossi né più positivi né somma maggiore, municipio / fissi di
     fase 1 / edifici senza strada fermi. Punteggio: angoli, poi perimetro
     esposto; il cammino accetta mosse a pari punteggio e riparte dalla
     migliore dopo 2000 tentativi senza migliorare. Il risultato è una
     modifica a mano (`modRef`): Riprendi/COMPLETA ripartono da lì (la
     ricerca locale lo sostituisce solo con un miglioramento stretto). Anche
     `Piano.angoli` = ultimo spareggio della ricerca (prima della
     compattezza; costo trascurabile: Beta r4 27 011 disposizioni in 30 s).
     Banco (`planner-test/bench/smussa_test.ts`: ricerca a NVAL, smussatura
     8 s, poi riempimento con 8 s di fase C con e senza): Beta r4 angoli
     63 → 43, dopo il riempimento buchi interni 21 → 5 (angoli finali 43 →
     24); Diviziaco r4 33 → 29, buchi interni 3 → 4 (variabilità della fase
     C).
     Mosse aggiunte dopo il confronto con l'utente (Beta r3: 39 angoli a
     mano): "spinta" (lo scorrimento di 1-2 celle sposta anche gli edifici
     che incontra, fino a 6), "posto migliore" (tutti i posti liberi accanto
     a una strada, si prende il migliore), e accettazione occasionale di
     mosse peggiori di 1 (2%) o 2 angoli (0,3%) per uscire dai minimi locali
     (si mostra sempre la migliore; dopo 2000 tentativi senza migliorare si
     riparte da lei). Beta r3 (partenza 76 strade, 53 angoli): 43 in 20 s,
     41 in 90 s (la tua da 39 parte da un'altra disposizione a 75 strade).
     Buchi nel punteggio (segnalazione dell'utente: a 37 angoli restava un
     2×1 fra due edifici, inutilizzabile — quasi nessun edificio senza
     strada è 2×1; scambiando un 4×4 con due 2×3 si avevano 37 angoli senza
     buco). Punteggio = [angoli + celle di buco, perimetro]; buco = cella
     libera sbloccata che nessuna forma minima (lati >= 2) degli edifici senza
     strada ancora da piazzare può coprire (prefissi 2D + differenze, come
     `contaBuchi`). Nuova mossa "ricomposizione" (0,5%, costosa): 2-3 edifici
     vicini tolti e ripiazzati uno alla volta nel posto migliore entro 7
     celle, provando tutti gli ordini (il 4×4 ↔ due 2×3). L'etichetta
     mostra angoli e buchi. Beta r3 (55 s, partenza 53 angoli / 10 buchi):
     43 angoli + 9 buchi senza ricomposizione, 47 + 6 con (variabilità del
     caso: Math.random).
   - **Pulsanti del Planner** (richiesta dell'utente): tre fasi, ciascuna
     col suo pulsante che fa da avvio, pausa e ripresa, e che in pausa
     riprende il proprio nome (niente "Riprendi", per non confondersi).
     1. Ricerca: "▶ Ottimizza" → "⏸ Pausa" → "▶ Ottimizza" (riprende)…;
     disattivato durante il completamento. 2. "✨ Smussa" (attivo solo con la
     ricerca in pausa) → "⏸ Pausa" → "✨ Smussa"…. 3. "⏭ COMPLETA" (attivo
     solo con la ricerca in pausa, senza sovrapposizioni né smussatura in
     corso) → "⏸ Pausa" → "⏭ COMPLETA" (riprende il riempimento)…
     (`completando`).
   - **DEBUG_PLANNER = false** (roadEff.ts): niente elenco road_eff sotto le
     mappe e niente "📂 Importa JSON" / "↩ Città del profilo" (strumenti di
     test, visibili solo con DEBUG_PLANNER = true). I bordi tratteggiati
     (gialli = problematici, rossi = strade vuote) restano SEMPRE visibili,
     senza spiegazione (richiesta dell'utente).
   - **Revisione generale (bug, casi particolari, prestazioni)**, a
     risultato IDENTICO verificato con firma md5 del risultato su 7
     scenari (Beta r3/r4, Diviziaco r3/r4, Rode r3, Sonia r4, Avito r3) a
     NVAL fisso. Il banco ora è davvero deterministico: `sync.sh` sostituisce
     `now - lastShow > 500` con un test su `valutate >= NVAL` (prima lo stop
     dipendeva dai fotogrammi a tempo e due corse uguali potevano
     differire). `planner-test/bench/det.sh`-like: firma = md5 di
     `<città>_<var>.out.json`.
     Prestazioni:
     - `ricompatta` → `valuta`: celle vuote della zona con prefissi 2D della
       base + celle marcate dentro la zona (prima un doppio ciclo sull'area
       per ognuna delle fino a 64 × K combinazioni): Filanush ~ +40%
       disposizioni/s.
     - `RoadSet` (Set<string> + griglia parallela): `rd.hasXY` al posto di
       `rd.has(key(...))` nei cicli caldi (toccaAltraDorsale, lunghezzaLibera,
       haVerticale…).
     - `Riserva` (griglia a timbri condivisa) al posto del Set<string>
       `extra` di latiDorsale/fitsS.
     - rifinisciPunte: strade in forma numerica una volta per foglia;
       ricerca esaustiva con griglia di celle usate (niente stringhe).
     - connessione delle strade nuove in simula: BFS numerica a timbri.
     - `Piano.angoli` pigro (getter con cache): calcolato solo se serve allo
       spareggio.
     - roadEff.ts: `roadEffDi` senza array (ciclo caldo), `contaAngoliGriglia`
       senza closure.
     - smussa.ts: punteggio INCREMENTALE (angoli, perimetro e buchi
       ricalcolati solo attorno ai rettangoli toccati, verificato contro il
       calcolo completo: nessuna divergenza), anche nella ricomposizione:
       2,5-4× tentativi al secondo (Beta r3 96k → 234k in 4 s; Avito r4 buchi
       104 → 15).
     Bug / casi particolari:
     - `accorcia`: i fini strada che arretrano non possono più finire sopra il
       municipio o un edificio senza strada (prima il municipio non era
       controllato).
     - Smussatura: una mappa eliminata col cestino durante la smussatura si
       ferma.
     - Verificato con un validatore (`valsm.ts`) che la smussatura non crea
       sovrapposizioni, non stacca edifici dalla strada, non cambia le strade
       e non muove i fissi (Beta, Diviziaco, Rode, Avito, Filanush).
     - Filanush (città piena al 93%: 3991 celle di edifici su 4272, la città
       originale usa 276 strade e resta con 5 celle libere): 7 edifici senza
       strada restano fuori con 264 strade; è un limite del deficit stimato,
       non un errore (né 1,05 né 1 cambiano il risultato).
     `vite build` non si può eseguire nella sandbox Linux (binding nativo di
     rolldown per Windows): tsc ed eslint puliti.
   - **Smussatura: scambi lontani e discesa esaustiva** (segnalazione
     dell'utente su Beta r3: ferma a 43 angoli dopo 23 milioni di tentativi,
     mentre scambiando a mano due edifici lontani si scendeva a 41, poi 37, e
     scambiando due fini strada di dorsali diverse a 33). Causa: lo scambio
     cercava il compagno solo entro 14 celle, quindi due fini strada di
     dorsali diverse non venivano mai provati; e la ricerca casuale non
     esplorava sistematicamente le coppie. Ora: (1) una volta su tre il
     compagno dello scambio è un edificio qualsiasi; (2) quando la ricerca
     è bloccata (2000 tentativi senza migliorare) si fa una discesa
     ESAUSTIVA dalla migliore: tutti gli scambi di coppie (anche lontane)
     nei 16 allineamenti agli angoli e tutti gli scorrimenti di 1-3 celle,
     si applica la mossa migliore e si ripete finché migliora (con pause
     ogni 40 ms per l'interfaccia). (3) L'etichetta mostra "N mosse valide su
     M tentativi": i tentativi casuali sono quasi tutti scartati subito
     (posto occupato o senza strada), le mosse valide sono quelle davvero
     valutate. Beta r3 (partenza 59 angoli): 41 angoli + 7 buchi in 15 s.
     Poi (l'utente: "si ferma a 35, non l'ottimo"; la sua da 33 ha un
     fine strada di una dorsale scambiato con un edificio di un'altra e i
     vicini riassestati): `ricomponi(gruppo, centri, ordini, soglia)` (la
     ricomposizione resa funzione) e, nella fase di blocco, dopo la discesa
     esaustiva, ~2 s di ricomposizioni "lontane": b + il suo vicino più
     prossimo, c qualsiasi + il suo vicino, ripiazzati in tutti i 24 ordini
     nel posto migliore entro 7 celle dai due posti (accettate anche a pari
     punteggio). Beta r3 in 30 s: 31 angoli + 0 buchi (e 33 + 7 in un'altra
     prova: il caso conta), Beta r4: 37 + 1 (partenza 53 + 14). Validatore:
     nessuna sovrapposizione, strade uguali, fissi fermi.
   - **Girandola — passo 1: lati di tutte le strade a incastro**
     (`Params.latiEsatti` = seme, `riempiLatiStrade` in simula, prima dei fini
     strada delle dorsali). Città dell'utente Sdrushi: girandola a 70 strade
     (municipio in 16,28; bracci N colonna destra verso l'alto 22, W riga alta
     verso sinistra 5, E riga bassa verso destra 17, S colonna sinistra verso
     il basso 26), lo scenario standard ne trova 75. Passi:
     1. fini strada PRIMA dei lati: a ogni punta (cella di strada con una
        sola strada vicina e libera davanti; non le punte che danno sul
        municipio) il più grande che entra oltre la punta e, ai due lati, gli
        edifici che toccano la punta sporgendo in avanti (fine strada
        d'angolo: un braccio di una cella regge tre edifici);
     2. per ogni tratto dritto di strada (orizzontale/verticale) e ogni lato,
        le "fessure" libere, dalla più lunga (con un po' di caso dal seme):
        somma di sottoinsieme sulle lunghezze lungo la strada; valore =
        copertura, poi area (profondità per cella), lato corto sulla strada
        (−300/cella altrimenti), scarsità (+60/cella a chi va bene solo in
        quel verso, es. 6×4 su strada verticale), grandi lasciati ai fini
        strada (−2000); posa dal più profondo; poi un ripasso che riempie i
        buchi rimasti col primo edificio che entra.
     Configurazioni: semi 1-16 × vertFirst, 30% delle casuali. Banco
     (`planner-test/bench/gir.ts Città NVAL "tx,ty,N,W,E,S"`: base =
     municipio + 4 bracci, poi runCompletion): coi bracci esatti
     dell'utente restano fuori 2 edifici con strada su 50 (prima 10-13 col
     prototipo); con il braccio E di 20 (+3) TUTTO piazzato: 71 strade
     (alcune celle potate), 368/368 edifici, in 10 s. Scenario standard
     (NVAL 12 000, confronto con la baseline): Beta 76/77 (era 76/78),
     Diviziaco 70/66 (69/66), Rode r3 83 (85), Sdrushi 81/75 =, Sonia r4 72 =.
   - **Girandola — passi 2 e 3: scenario nell'app** (`girandola.ts`).
     `baseGirandola(problem, tx, ty)`: municipio in (tx, ty) e i quattro
     bracci lunghi fino al bordo (N colonna destra verso l'alto, W riga alta
     verso sinistra, E riga bassa verso destra, S colonna sinistra verso il
     basso). `runCompletion` opzione `girandola: { bracci }`: in `simula` si
     spengono accorcia/allunga/libera*/swapBuilder/estEsatto, `latiEsatti`
     sempre attivo, `Params.tagli` toglie le punte dei bracci (`stradeTolte`,
     come l'accorciamento); configurazioni proprie (8 semi coi bracci interi
     + 160 tagli casuali), `casuale` con tagli casuali, `muta` che allunga o
     accorcia un braccio di 1-4 celle (metà delle mosse), ricerca locale senza
     il taglio della verticale. Opzione `soloRicerca`: restituisce subito
     dopo la ricerca (strade, edifici con strada fuori, deficit) senza
     completamento. `scegliGirandola`: 28 posizioni del municipio (dal centro
     verso sinistra a passi di W/24, e ±2/−4 righe), 200 disposizioni
     ciascuna, poi le 3 migliori rivalutate con 800; vince meno fuori → meno
     deficit → meno strade → più a sinistra. PlannerView: scenario "gir"
     (titolo "Girandola", sempre aggiunto agli altri, parte in parallelo;
     durante la scelta mostra subito ogni prova: municipio e bracci della
     posizione in esame e i passi della sua breve ricerca, con etichetta
     "prova della posizione del municipio i/n" e senza statistiche di ricerca
     — `scegliGirandola` opzione `onFrame`); smussatura,
     pausa e completamento come gli altri; PNG "foe-planner-girandola-…".
     Banco (`gir3.ts Città NVAL`): Sdrushi 72 strade, 368/368 (l'utente 70,
     standard 75), municipio scelto in (33,29) in ~18 s; col municipio
     dell'utente (16,28, `gir4.ts`) 71; Diviziaco 65 strade ma 3 senza
     strada fuori (standard 66, tutti dentro); Beta 91 (standard 75): la
     girandola conviene solo ad alcune città, per questo è uno scenario in
     più e non un sostituto.
   - **Sporgenza all'estremo dei tratti** (girandola, idea dell'utente su
     Rode: due buchi alti 2 accanto al municipio): in `riempiLatiStrade`
     ogni fessura che arriva all'estremo di un tratto che non prosegue (es.
     l'inizio di un braccio attaccato al municipio) conta fino a 6 celle
     libere oltre l'estremo (`Fessura.spA/spB`, la cella sull'asse non deve
     essere strada). Il DP copre la lunghezza allungata; la parte sporgente
     (al più lungo−1) va al pezzo più lungo, messo per primo all'estremo
     sporgente, così tocca ancora la strada e la fila si accosta al
     municipio: in fondo al braccio la strada si risparmia. Solo con
     `opts.girandola` (firme standard identiche).
   - **Scelta del municipio con prova del riempimento**: dopo le 3 finaliste
     (ordinate come prima), `scegliGirandola` esegue per ognuna, in ordine,
     ricerca breve + completamento (`completa`) e sceglie la prima che piazza
     tutti gli edifici (altrimenti quella che ne lascia fuori meno): su Rode
     tre posizioni a pari strade, la più a sinistra lasciava fuori 4 edifici
     senza strada. Progresso "i/n" con n = posizioni + 6.
     Di queste prove si mostra solo la ricerca, non il riempimento di prova
     (fuorviante, segnalato dall'utente).
   - Banco (`gir3.ts`, NVAL 4000): Rode 74 → 72 (367/367), Sdrushi 72 → 71,
     Diviziaco 65 con tutti dentro (prima 3 senza strada fuori).
   - **Fix tagli nella ricerca locale** (segnalato dall'utente: bracci
     accorciati con gli edifici rimasti scollegati): `simula` applicava
     `Params.tagli` anche partendo da una disposizione completa (ricerca
     locale `cercaDaManuale`), togliendo celle a cui erano attaccati
     edifici. Ora il taglio parte dalla punta e si ferma alla prima cella
     che serve a un edificio piazzato o che non è più una punta. Banco
     `girf.ts Città NVAL`: controlla ogni frame (scelta + ricerca +
     completamento) e conta quelli con edifici con strada scollegati
     (prima 70 frame su 651 con NVAL 40000, ora 0).
   - **Toccare il municipio NON collega** (corretto dall'utente): un
     edificio con strada deve toccare una strada; il municipio da solo non
     basta. Una prova che trattava i lati del municipio come strade (in
     `riparaScollegati`, `ribasa`, `riempiLatiStrade`, `smussa.ts`,
     `PlannerView.scollegati()`) è stata annullata: piazzava edifici
     attaccati solo al municipio.
   Stato: Avito (151 edifici, 76 con strada da piazzare) resta difficile: 5-9
   edifici non piazzati con 189-230 strade (la città originale li piazza tutti
   con 271). Il banco a 8-20 s ha una variabilità di ±3 strade fra prove.

### Banco di prova del Planner (`planner-test/`, escluso da git)

Città di test dell'utente (export JSON della mappa) in `planner-test/`
(`Avito.json`, `Beta.json`, `Claudio.json`, `Rode.json`, `Sonia.json`; Beta
15 s: r4 46 strade nuove / 78 totali, r3 50 / 81, orig. 106, tutti piazzati).
`bench/pause.ts` prova pausa/modifiche/ripresa; `NVAL=<n>` rende il banco riproducibile. `planner-test/bench/`: `sync.sh`
copia i sorgenti in /tmp/pb con import `.ts`; `bench.ts <Città> [ms] [r3|r4|both]`
esegue builder + completamento (ricerca fermata dopo ms) e stampa strade,
esclusi, lati liberi, spreco, piazzati, non piazzati, sovrapposizioni;
`render.py <Città_rX>` disegna il PNG (strade nuove in giallo, dimensioni sugli
edifici). Risultati (8 s per raccordo, ottobre 2026): Claudio 77 strade (orig.
89, tutti piazzati); Sonia 80-82 (orig. 84, tutti piazzati); Rode 78-86 (orig.
76) con 3-4 edifici senza strada 2×2/2×3 fuori per mancanza di spazio.

   **Avanzamento:** `PlannerFrame.search` (disposizioni valutate, strade nuove
   della migliore, celle sprecate, tentativo in cui è stata trovata, attiva) è
   mostrato sulla riga "Raccordo a N celle" di ogni mappa (🔎 durante la
   ricerca) e resta visibile dopo.
4. Edifici con strada ancora fuori → motore segnaposto (`phase: "road"`).
5. **Edifici senza strada** → `fillMask` (il cuore di fase2 esportato da
   `fase2.ts`) su tutta l'area libera, in modalità `fast` (controllo delle celle
   non copribili solo attorno al pezzo appena posato: su maschere grandi la
   scansione completa era proibitiva). Il fase2 del builder resta in modalità
   esatta (differenziale invariato: 104/104 e 96/96).
6. Ultimi rimasti → motore segnaposto (`phase: "noroad"`, primo posto libero).

Risultati (variante consigliata, ricerca fermata dopo 10 s): beta 131/131 edifici, 88
strade (originale 106; 92 senza ricerca); city 395/395, 65 strade (61; 77 senza
ricerca, ora 0 strade nuove); foe-map 371/371, 131 strade (155; 137 senza ricerca). I miglioramenti arrivano quasi tutti nei primi 50 tentativi (<0,1 s); su foe-map l'ultimo dopo ~0,9 s. Nessuna
sovrapposizione né cella fuori mappa; 0,25-0,75 s.
