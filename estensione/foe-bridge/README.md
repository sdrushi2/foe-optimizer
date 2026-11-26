# FoE Optimizer Bridge (beta)

*English: [README.en.md](README.en.md)*

Una piccola estensione, separata da FoE Optimizer. Quando la tua città cambia nel gioco
(edifici spostati, piazzati, venduti, migliorati, oggetti comprati nello shop, alleati
assemblati…) la legge da FoE Helper o Forge Hammer e la passa alle pagine collegate:
FoE Optimizer e il **monitor** dell'estensione.

**Solo lettura.** Non modifica le funzioni del gioco, non intercetta il traffico e non
manda richieste al server del gioco (l'unica lettura fuori dagli helper è la versione del
client, vedi Debug). Usa soltanto l'estensione helper che hai già,
**FoE Helper o Forge Hammer** (ne può essere attiva una sola): i suoi eventi interni
`CityMapUpdated` e `InventoryUpdated` e le sue risposte per `InventoryService` e
`AllyService`, poi legge i dati della città (`MainParser` in FoE Helper, `FH.Main` in
Forge Hammer: gli stessi dati che legge la bacchetta). Uno dei due è indispensabile. Le
città visitate non passano mai dal bridge: per quelle si usa la bacchetta.

## Browser

Chrome e gli altri browser basati su Chromium: **Edge, Opera, Brave, Vivaldi** (zip
`-chrome`). **Firefox 140 o più recente, in prova** (zip `-firefox`: stesso codice, cambia
solo il manifest, con la pagina di eventi al posto del service worker e l'id per
Firefox). Lì un'estensione non firmata si carica solo come temporanea da
`about:debugging` e sparisce a ogni chiusura di Firefox; i permessi sui siti vanno
controllati in `about:addons` → FoE Optimizer Bridge → Permessi. **Safari no**: richiederebbe
una conversione con gli strumenti Apple. Dal telefono non funziona. FoE Helper o Forge Hammer devono essere
installati nello stesso browser.

## Installazione

1. Scompatta in una cartella che non sposterai (per esempio `D:\FOE\foe-optimizer-bridge`).
2. Apri `chrome://extensions` (Edge: `edge://extensions`, Opera: `opera://extensions`,
   Brave: `brave://extensions`, Vivaldi: `vivaldi://extensions`).
3. Attiva la **Modalità sviluppatore** (in alto a destra in Chrome; in Edge è nella
   colonna di sinistra).
4. **Carica estensione non pacchettizzata** → scegli la cartella `foe-optimizer-bridge`.
5. Fatto: le schede del gioco e di FoE Optimizer già aperte si collegano da sole (non
   serve ricaricarle).

Per una nuova versione: sostituisci i file nella cartella e premi ↻ sulla scheda
dell'estensione in `chrome://extensions`. Le schede del gioco e di FoE Optimizer aperte
si ricollegano da sole.

## Come funziona

- **Fotografie leggere.** Un secondo dopo l'ultima modifica il gioco manda il pacchetto
  della bacchetta senza le definizioni degli edifici (~1 MB, pochi ms).
- **Le definizioni degli edifici** (`CityEntities`, ~63 MB, troppe per un solo messaggio
  di Chrome) le conserva l'estensione (IndexedDB, ultime 3 versioni). La loro firma è il
  codice di versione del file dei metadati del gioco. Il gioco le manda solo quando
  l'estensione non le ha per quella versione: di solito **una volta per aggiornamento del
  gioco**, pochi secondi dopo il caricamento. Le prepara a piccoli pezzi (pochi millisecondi
  l'uno, meno di un fotogramma) nei momenti in cui il browser è libero e le manda in parti
  da 2 MB: nessun blocco percepibile (al massimo un fotogramma), ci vuole solo qualche
  secondo in sottofondo. Le
  pagine le ricevono dall'estensione.
- **FoE Optimizer** mostra accanto alla bacchetta **LIVE** (verde: collegato; giallo: in
  attesa del gioco), **PAUSA** (l'hai messo in pausa cliccando l'indicatore; un altro
  clic lo riprende) oppure **OFF** (estensione assente, disattivata o che non risponde),
  e importa la città quando guardi la sua scheda (lo stesso import della bacchetta),
  chiedendo le definizioni solo di quel mondo. Le tiene in memoria finché la sua scheda è
  aperta: gli import successivi non le richiedono più.
- **Niente doppioni.** Se un segnale del gioco non cambia nulla (pacchetto identico) la
  città non viene rimandata.

## Il menu

Clicca l'icona dell'estensione per aprire il menu: una scheda per ogni mondo, prima
quelli aperti. Il menu è in italiano; il selettore **IT | EN** nella testata lo cambia (la
scelta resta salvata). Il monitor e il log restano in inglese.

- Ogni scheda mostra il mondo (F, β per la Beta…), il giocatore, il server, l'helper e lo
  stato: **LIVE** con l'ultimo aggiornamento, **ATTESA** o **RICARICA** con quello che
  manca, **CONFLITTO** quando FoE Helper e Forge Hammer sono attivi insieme, **ERRORE**
  quando la città arriva ma il tool non la può importare (l'helper non indica più il file
  delle definizioni: si usa la bacchetta e si manda il report), **GIOCA**
  con l'ultima partita per un mondo che non è aperto.
- Clic su una scheda: se il gioco è già aperto su quel mondo la sua scheda del browser
  passa in primo piano, altrimenti il gioco si apre su quel mondo. Prima della prima
  partita non c'è nessuna scheda (l'estensione non può sapere server e lingua), solo una
  breve nota.
- Su un mondo non aperto la ✕ che compare passando il mouse elimina subito quel mondo e i
  suoi dati dall'estensione: la voce del menu e le definizioni degli edifici che non usa
  nessun altro mondo (le definizioni sono per versione del gioco: due mondi live di solito
  le condividono, la Beta no). Con l'ultimo mondo se ne vanno tutte: cliccando tutte le ✕
  l'estensione torna vuota come appena installata. Le città in FoE Optimizer restano (si
  cancellano dal tool). Il mondo torna da solo quando ci giochi di nuovo, e il gioco
  rimanda le definizioni una volta, in sottofondo. I mondi aperti non hanno la
  ✕: la loro scheda del gioco li tiene nel menu.
- **Apri FoE Optimizer ↗**: porta in primo piano la scheda del tool usata per ultima
  (online o su localhost), altrimenti apre il sito. **Monitor**: la pagina di prova.

## Debug

Il menu mostra, sulla scheda di ogni gioco aperto, se il bridge funziona lì, quale helper
usa e quando la città è stata aggiornata l'ultima volta (oppure cosa manca: "ricarica il
gioco", "in attesa di FoE Helper o Forge Hammer"…).

Il **Monitor** (debug, in inglese) mostra:

- **Game tabs**: mondo, helper e sua versione, versione dello script del bridge nella
  scheda (in rosso se diversa dall'estensione: ricarica il gioco), mappa attiva, ultima
  fotografia (motivo, tempo di preparazione), ultimo stato;
- le pagine collegate (FoE Optimizer, monitor);
- **Stored definitions**: le definizioni salvate (firma, versione del gioco, dimensione,
  data). La versione del client (per esempio 1.348.aac04d6, quella scritta all'avvio del
  gioco) non c'è negli helper: si legge dallo script del gioco già caricato, dalla copia
  nella cache del browser, una volta per versione. Se quella copia non c'è più, il browser
  riscarica lo stesso file dal CDN di InnoGames (i file statici del gioco), mai dal server
  del gioco. La ricerca della versione nel file dura pochi millisecondi.
  Va con le definizioni che il gioco usa: si aggiunge anche a quelle salvate prima, e se un
  aggiornamento del client tiene le stesse definizioni compaiono tutte e due (per esempio
  `game 1.348.aac04d6 / 1.349.…`). Compare anche sotto il mondo in **Game tabs**;
- **Cities received**: le città ricevute, con l'elenco delle modifiche a ogni pacchetto;
- il **log** (le righe che iniziano con "·" sono passaggi dell'estensione; le righe
  ripetute diventano una sola riga con "×N").

**Copy debug report** copia tutto questo come testo (versioni, browser, schede del gioco,
definizioni salvate, mondi, città, log) da incollare in una segnalazione.

## Prova con il monitor

1. Apri il gioco con FoE Helper o Forge Hammer attivo e aspetta che la città sia caricata.
2. Clicca l'icona dell'estensione, poi **Monitor**: si apre il **monitor**.
3. Compare la tua città (nome, server, numero di edifici).
4. Sposta, piazza, vendi o migliora un edificio nel gioco: dopo circa un secondo il
   monitor mostra il nuovo pacchetto e l'elenco delle modifiche.
5. Torna sulla scheda di FoE Optimizer: dopo circa 2 secondi la città è aggiornata.
6. **Clear stored definitions** fa rivedere il primo caricamento (spariscono anche le
   città mostrate, che tornano subito con una fotografia nuova); **Clear log** svuota il log.

## Casi particolari

- **FoE Helper e Forge Hammer attivi insieme**: non possono mai funzionare insieme
  (installano entrambi un proprio proxy sulle richieste del gioco; Forge Hammer avvisa e
  si ferma). Il bridge allora non manda nulla e il menu e il monitor lo dicono: disattivane
  uno in `chrome://extensions` e ricarica il gioco.
- **Cambio di helper** durante una sessione (ne disattivi uno, attivi l'altro, ricarichi
  il gioco): il bridge si aggancia a quello attivo; le definizioni salvate restano valide.
- **Città visitate, avamposti, Incursioni Quantiche, CdG**: il bridge legge sempre la tua
  città principale; le altre mappe non passano mai da lì.
- **Più mondi aperti** (per esempio beta e live): ogni scheda manda la sua città; FoE
  Optimizer le tiene separate.
- **Altre pagine su localhost** (un altro progetto in sviluppo): l'estensione entra anche lì
  ma resta muta finché la pagina non si presenta come FoE Optimizer: le pagine che non si
  presentano non ricevono città, nomi o definizioni. Non è un controllo d'accesso (una
  pagina locale che si presentasse apposta riceverebbe tutto): evita solo che le altre
  pagine li ricevano senza saperlo.
- **Finestre in incognito**: l'estensione funziona lì solo se lo permetti
  (`chrome://extensions` → Dettagli → Consenti in modalità in incognito).
- **Aggiornamento del gioco**: le definizioni degli edifici hanno una nuova firma e si
  chiedono di nuovo al gioco, in sottofondo; si tengono le ultime 3 versioni.

## File

- `game-main.js` – nella pagina del gioco, accanto a FoE Helper o Forge Hammer: legge e
  prepara il pacchetto.
- `game-relay.js` – passa i messaggi tra la pagina del gioco e l'estensione.
- `background.js` – inoltra i pacchetti e conserva le definizioni.
- `tool.js` – nella pagina di FoE Optimizer: segnale di presenza, pacchetti via
  `postMessage`.
- `popup.html` / `popup.js` – il menu che si apre dall'icona dell'estensione (italiano e
  inglese).
- `monitor.html` / `monitor.js` – pagina di prova (in inglese).
- `_locales/` – la descrizione dell'estensione in italiano e inglese (in `chrome://extensions`
  compare nella lingua del browser, in italiano per le lingue diverse dall'inglese).
- `icons/` – l'icona di FoE Optimizer (16, 32, 48, 128 px).
- `README.md` (italiano) / `README.en.md` (inglese) – questa guida.
- `istruzioni.txt` – istruzioni brevi per chi prova la beta.
