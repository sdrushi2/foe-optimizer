# Novità di FoE Optimizer

## Versione 2.031 (28/11/2026)
### Aggiornamenti
- Estensione FoE Optimizer Bridge: le città visitate accese nell'estensione arrivano in qualunque scheda del tool, anche nel Planner, e senza cambiare la città selezionata: compaiono nel menu delle città con l'avviso "Aggiunta la città di …" e si aggiornano a ogni visita anche se non le hai aperte
- Insediamenti (Pirati e Mughal): gli edifici sulla mappa hanno un bordo sottile e niente ombra, come le caselle degli ostacoli. Prima il bordo spesso con l'ombra sembrava sfocato
- Insediamenti › Mughal, confronto tra la mappa del gioco e quella nuova: gli edifici spostati non hanno più il bordo azzurro (l'ottimizzatore sposta quasi tutto, erano bordati tutti). Restano il bordo rosso sugli edifici da togliere e quello bianco sui nuovi; il numero degli edifici da spostare resta nelle Variazioni
- Insediamenti, Reset: riporta l'insediamento a com'è nel gioco invece che allo scenario vuoto. Se l'estensione FoE Optimizer Bridge ha l'insediamento di quel mondo riparte dalla sua copia più recente, altrimenti dall'ultimo import con la bacchetta; solo senza nessun import torna allo scenario vuoto. Cancella anche i tentativi dell'ottimizzatore
- Insediamenti › Mughal, tabella dei tentativi più dettagliata: la colonna Rupie (le rupie che restano dopo le strade nuove), una colonna per ogni tipo di edificio collegato (per esempio Bhavan, Shanti, Chhatri) con quanti ce ne sono in più o in meno rispetto alla mappa di partenza, e Prod. /5h con la produzione e la differenza. I numeri di ogni tipo restano nel suggerimento della riga

---

## Versione 2.030 (27/11/2026)
### Novità
- L'estensione FoE Optimizer Bridge è sul Chrome Web Store (va bene anche per Edge, Brave e Opera; Firefox in arrivo): porta qui da sola la tua città, con inventario, alleati e insediamenti, mentre giochi. Se non l'hai installata, l'indicatore OFF accanto alla bacchetta ora si clicca: apre un pannello che spiega cosa fa, cosa serve e dove installarla. Il link c'è anche nel menu delle città vuoto, in Guida › Come importare la città e nelle guide
- Menu delle città: accanto al nome ci sono i pulsanti per scaricare la città in un file JSON. Le tue città ne hanno due: città completa (mappa, inventario, alleati, risorse e Castello: per portarla su un altro computer o darla a chi vuoi) e solo la città (la mappa: per Forge Hammer, un altro planner o un altro giocatore). Le città visitate hanno solo il secondo. A destra del menu (in fondo su schermo stretto) una legenda spiega i pulsanti. I file si chiamano giocatore-completa-data.json e giocatore-citta-data.json
- Menu delle città: in fondo c'è Elimina tutte le città, che toglie tutte le città salvate (tue, visitate e importate) dopo una conferma, lasciando lingua, tema, pesi e le altre impostazioni. Con l'estensione FoE Optimizer Bridge attiva le tue città tornano da sole mentre giochi
- Database › Tools: nuovo pulsante Editor, prima di Calc. GE. Apre l'editor della città vuoto in una nuova scheda
- Editor della città: nuovi pulsanti Importa JSON e Salva JSON. Importa JSON carica una città da un file (completa o solo città: conta la mappa, anche da Forge Hammer o da uno scenario del Planner) solo nell'editor, senza salvarla nel tool, con gli stessi messaggi d'errore del tool. Salva JSON scarica la città modificata come solo città (giocatore-citta-data.json), nello stesso formato del JSON della Mappa. Non ci sono quando l'editor è aperto dal Planner
- Importa da JSON riconosce la città completa: la aggiunge tra le città importate con inventario e alleati, e le schede Inventario e Alleati funzionano come per le tue città. Una città importata completa ha entrambi i pulsanti di export, una con la sola mappa solo il secondo: così si vede subito cosa contiene. Reimportando la stessa città la aggiorni, anche passando da completa a solo città o viceversa

### Aggiornamenti
- Estensione FoE Optimizer Bridge (dalla versione 0.10): arrivano anche le città visitate che accendi nel menu dell'estensione. Entrano tra le Città visitate e si aggiornano a ogni visita; una città visitata nuova non cambia la città selezionata. Se elimini dal tool una città visitata ancora accesa nell'estensione, torna alla visita successiva: il messaggio di conferma lo ricorda
- Insediamenti › Mughal, Ottimizza: se hai sbloccato il Chhatri (o il Baldacchino e il Chahar bagh), l'ottimizzatore lo usa insieme alle residenze e sceglie da solo quanti metterne per avere più rupie con meno strade. Questi edifici producono rupie se toccano la strada ma consumano popolazione: l'ottimizzatore ne mette quanti la popolazione ne regge, aggiungendo se serve residenze staccate. La loro produzione si conta con il tempo da 5 ore (per il Chhatri 182 rupie ogni 5 ore), lo stesso della colonna Produzione
- Opzioni › Backup: i pulsanti ora si chiamano Esporta backup e Ripristina backup, e il backup è completo. Esporta backup apre un pannello che elenca cosa finisce nel file (le tue città con mappa, inventario, alleati, risorse e Castello, le città visitate con la sola mappa, tutte con i nomi, le impostazioni come lingua, tema, pesi, colonne e potenza CPU del Planner, gli edifici sbloccati degli insediamenti) e quanto pesa, ricorda che è un file personale da non dare ad altri giocatori e chiede conferma. Il file si chiama foe-optimizer-backup-AAAA-MM-GG.json. Funziona anche senza città salvate
- Ripristina backup: scelto il file, il pannello mostra cosa contiene (data del backup, città, impostazioni) e avvisa quali città verranno cancellate. Con la conferma sostituisce tutto, città e impostazioni, e ricarica la pagina. Prima le città del backup venivano aggiunte a quelle presenti (ripristinando due volte si duplicavano) e le impostazioni non tornavano. Se il ripristino non riesce, per esempio perché la memoria del browser è piena, i dati di prima restano com'erano. Si possono ripristinare anche i backup fatti con la versione 1 (le città sì, le impostazioni di allora no)
- Ripristina backup: se scegli la mappa di una città invece di un backup, il pannello te lo dice e ti indica Importa da JSON
- Importa da JSON e il Planner leggono i file JSON allo stesso modo: prendono sempre la disposizione del file. Prima, importando tra le città il JSON di uno scenario del Planner, si salvava la città com'è nel gioco invece dello scenario. I messaggi d'errore sono gli stessi nei due posti, nella lingua scelta, e dicono cosa manca (file rotto, nessuna città, espansioni, municipio) o che il file è un backup
- Le città importate da JSON e quelle importate con la bacchetta o il ponte non si mescolano più: un file JSON aggiorna solo una città importata da JSON, e la bacchetta o il ponte solo le loro. Prima la bacchetta poteva trasformare una città da JSON in una tua città
- Importa da JSON: se scegli un file di backup, ti dice di usare Opzioni › Ripristina backup. Il pulsante JSON della Mappa ora salva giocatore-citta-data.json
- Menu delle città senza città: il riquadro è stretto come prima (la legenda c'è solo quando ci sono città) e spiega i tre modi per aggiungerne una: la bacchetta verde, l'estensione FoE Optimizer Bridge e Importa da JSON
- I JSON della città (Mappa, menu delle città, scenari del Planner, editor) contengono anche l'avatar del giocatore e il mondo, come quelli della bacchetta: importandoli con Importa da JSON la città ha la sua foto nel menu e torna con la lettera del mondo (F · Sdrushi), distinta dalle città dello stesso giocatore su altri mondi. Anche i file salvati da un JSON aperto nel Planner o nell'editor hanno la lettera del mondo nel nome. Forge Hammer e gli altri programmi lo ignorano
- Tutti i file scaricati cominciano con il nome della città: dal Planner città-planner-disposizione-data (per esempio f-sdrushi-planner-raccordo3), dalla Mappa città-citta-data anche per il PNG, dall'editor città-editor-data.png e città-citta-data.json. Così i file della stessa città stanno vicini nella cartella dei download
- Tools: il pulsante Export, che scarica in CSV gli edifici selezionati, ora si chiama CSV
- Opzioni: tolto il gruppo Città salvate. Importa da JSON resta in fondo al selettore delle città; le città si eliminano una alla volta con il cestino del selettore, oppure tutte insieme (con le impostazioni) da Azzera › Cancella tutto

### Correzioni
- Planner: se il JSON scelto non si poteva leggere e c'era già una città aperta, non compariva nessun messaggio. Ora l'errore si vede sopra il Planner e si chiude con la X
- Il JSON della Mappa scriveva come giocatore il nome della città con la lettera del mondo (F · Sdrushi): reimportandolo la città diventava "F · F · Sdrushi". Ora il giocatore è scritto senza la lettera
- Importando un JSON nel Planner, gli edifici di cui non si conoscono le dimensioni vengono segnalati anche se il file ha CityMapData (prima sparivano in silenzio)

---

## Versione 2.029 (26/11/2026)
### Novità
- Estensione FoE Optimizer Bridge (beta): rimettendo LIVE dopo la pausa il tool chiede al gioco una copia fresca e reimporta tutto (città, inventario, alleati e insediamenti), come con la bacchetta. Serve da aggiornamento completo se qualcosa non si era aggiornato. Le modifiche fatte a mano nei planner restano protette dal solito avviso
- Mughal: quando cambi la disposizione (a mano o con un tentativo di Ottimizza) vedi affiancate la mappa attuale, com'è nel gioco, e quella nuova, con in mezzo una freccia e il riepilogo delle variazioni: edifici in più e in meno, strade nuove e spostate, edifici da spostare, Ambasciata spostata e rupie ogni 5 ore prima e dopo. Sulle mappe un bordo rosso segna gli edifici da togliere, azzurro quelli da spostare e bianco quelli nuovi. La mappa attuale è solo da guardare; con Annulla torni a una sola mappa
- Alleati (i tuoi e quelli del Database): nuovo gruppo Visualizza nel nastro, dopo Visualizza rarità, con % Militari e Produzioni (accesi di base) per nascondere le colonne che non ti interessano. La scelta resta salvata
- Insediamenti (Pirati e Mughal): tra POP e la valuta c'è la Diplomazia totale degli edifici costruiti (0 di partenza), che serve per gli sblocchi
- Mughal, Ottimizza: nuovo pulsante Continua, che riprende la ricerca dai tentativi trovati e va avanti finché non premi Stop, per migliorarli

### Aggiornamenti
- Alleati (i tuoi e quelli del Database): la tabella non occupa più tutta la larghezza dello schermo ma solo lo spazio che le serve, centrata, così sugli schermi grandi nome e valori restano vicini. Niente viene tagliato: le abilità degli alleati leggendari si leggono per intero
- Alleati (i tuoi e quelli del Database): anche qui c'è Somma beni in Opzioni, con la stessa icona dorata. Unisce i beni dell'era attuale e della precedente in un'unica colonna col totale. L'opzione è la stessa delle tabelle degli edifici: accesa in una, è accesa in tutte
- Mughal, Ottimizza: la tabella mostra solo i 5 tentativi migliori, ordinati per produzione. La X in alto a destra chiude il riquadro dei tentativi (e ferma la ricerca); Continua lo riapre. L'avviso in alto spiega cosa fa oggi il planner dei Mughal, ancora in versione preliminare

---

## Versione 2.028 (25/11/2026)
### Novità
- Insediamenti (Pirati e Mughal): la legenda degli edifici è una tabella con le colonne Dimensioni, Popolazione, Diplomazia, valuta (Dobloni o Rupie: produzione per edificio, con tutte le durate passando il mouse, oppure il costo) e quantità. Accanto ad AREA e POP ci sono anche i Dobloni dei Pirati, come le Rupie dei Mughal
- Insediamenti: nuovo pulsante Mughal accanto a Pirati, con la stessa mappa dei Pirati: import con la bacchetta (dall'insediamento aperto nel gioco), Ambasciata da spostare, espansioni da aggiungere e togliere (solo contigue, con i loro ostacoli), ostacoli, edifici da aggiungere e spostare, AREA e POP, e accanto le Rupie dell'insediamento (dall'import) con quanto costano i Sentieri aggiunti e quante ne restano. Il calcolo automatico per ora c'è solo per i Pirati: nei Mughal gli edifici chiedono la strada. Se importi un insediamento nella scheda sbagliata, il tool ti dice quale aprire
- Insediamenti, per chi prova l'estensione FoE Optimizer Bridge (beta): l'insediamento si aggiorna da solo mentre giochi, senza bacchetta. Con la scheda Insediamenti aperta, ogni volta che sposti, aggiungi o togli qualcosa nell'insediamento del gioco la mappa, AREA, POP e le Rupie (o i Dobloni) si aggiornano in un paio di secondi. Si prende l'insediamento del mondo della città selezionata. Se nel tool hai già fatto modifiche tue, non vengono cancellate: compare un avviso con il pulsante Aggiorna. Se giochi su più mondi ognuno ha il suo insediamento: cambiando città ritrovi quello del suo mondo, con le modifiche che avevi fatto (finché la pagina resta aperta)
- Mughal: nella legenda c'è una casella per ogni edificio, spuntata se è già sbloccato nel gioco. Di partenza sono sbloccati Bhavan, Risaia e Vialetto; gli edifici ancora bloccati sono in grigio ma puoi aggiungerli lo stesso per pianificare. Con la nuova bacchetta (va ricreata) o con l'estensione, se usi FoE Helper le caselle si spuntano da sole all'import; altrimenti spuntale tu. Restano salvate per ogni mondo
- Mughal, nuovo pulsante Ottimizza (prima versione): scegli nella legenda quante manifatture mettere (per esempio 1 Risaia) e il tool cerca per circa 20 secondi la disposizione con più rupie e meno strade, usando solo le residenze sbloccate e spostando anche l'Ambasciata. Propone un tentativo per ogni numero di strade, con le rupie che ti restano e la produzione; cliccandone uno lo vedi sulla mappa e lo puoi ritoccare. Su un insediamento nuovo, con 1 Risaia, trova 20 Bhavan collegate con 12-13 strade. Sulla mappa gli edifici non collegati alla strada sono tratteggiati: le case danno solo popolazione, le manifatture e i diplomatici sono anche cerchiati di rosso perché così non producono. Ogni tentativo mostra la differenza con la mappa di partenza, per esempio 13 (−3) strade e 18 (−5) collegate. L'ottimizzazione di produzione ignora la diplomacia, che avrà la sua: nella legenda i diplomatici non hanno più − / + né casella. Le strade già costruite non si eliminano: se un tentativo ne usa meno, quelle in più vengono parcheggiate in caselle vuote.

### Aggiornamenti
- Da telefono e tablet (Android, iPhone, iPad) la bacchetta magica e l'indicatore del collegamento non compaiono più in alto, perché lì non possono funzionare: resta più spazio per il resto. I messaggi che prima dicevano di usare la bacchetta ora suggeriscono di caricare un file JSON della città

### Correzioni
- Insediamenti: la scelta fra Pirati e Mughal si perdeva ricaricando la pagina. Ora resta
- Estensione FoE Optimizer Bridge (beta): la pausa del collegamento si perdeva ricaricando la pagina. Ora resta

---

## Versione 2.027 (24/11/2026)
### Novità
- FoE Optimizer Bridge, prima versione (in prova con pochi utenti): un'estensione che collega il gioco a FoE Optimizer, per Chrome e gli altri browser basati su Chromium (Edge, Opera, Brave, Vivaldi; Firefox e Safari per ora no). Con l'estensione e FoE Helper o Forge Hammer attivi, la tua città si aggiorna da sola nel tool a ogni modifica nel gioco (un edificio spostato, comprato, messo in magazzino, un alleato assemblato…), senza bacchetta. Funziona con più mondi aperti insieme (per esempio beta e live) e solo per le tue città: quelle che visiti si importano sempre con la bacchetta
- Accanto alla bacchetta c'è l'indicatore del collegamento: LIVE verde quando la città arriva dal gioco, LIVE giallo quando l'estensione aspetta il gioco, PAUSA quando l'hai messo in pausa con un clic (riprendendo si importa subito l'ultima versione) e OFF senza estensione. Con il Planner aperto la città non cambia da sola: se nel gioco è cambiata compare un avviso con il pulsante Aggiorna, che la importa e fa ripartire il Planner dalla città nuova. Per chi non ha l'estensione non cambia nulla: la città si importa con la bacchetta, come sempre

---

## Versione 2.026 (23/11/2026)
### Aggiornamenti
- Calcolatore GE: nel testo da copiare in chat il Grande Edificio ha un nome breve (per esempio "Galassia" invece di "La Galassia blu", "Galaxy" nella versione inglese), in un campo accanto al tuo nome. Puoi cambiarlo: resta salvato per ogni Grande Edificio, e svuotando il campo torna quello di partenza
- Calcolatore GE: a sinistra di ogni posto c'è una casella per scegliere quali posti mettere nel testo da copiare. Se non ne spunti nessuno, il testo li contiene tutti come prima. Le caselle si azzerano cambiando Grande Edificio o livello
- Calcolatore GE: i campi del nome e Copia ora stanno sopra il testo da copiare, tutti su una riga anche da cellulare. Il testo si può modificare prima di copiarlo (per esempio per aggiungere qualcosa); torna quello calcolato quando cambi posti, nomi, Grande Edificio o livello
- Calcolatore GE: nuova chat ORO 50%, accanto a ORO 20% e ORO 25%, con le stesse regole (vale per i livelli Oro, dal 102 in poi)
- Calcolatore GE: i tuoi Grandi Edifici preferiti, divisi per mondo. In cima al calcolatore una riga mostra il mondo scelto e quanti GE ha salvati: toccala per aprire l'elenco, con una scheda per ogni mondo (+ per aggiungerne uno, poi Rinomina ed Elimina) e un pulsante per ogni GE salvato, che lo apre al suo livello
- Calcolatore GE: per salvare un Grande Edificio fra i preferiti del mondo scelto tocca la stella accanto al livello. La stella è dorata se il GE è salvato a quel livello, vuota se non è salvato o è salvato a un altro livello (toccandola si aggiorna); toccando quella dorata lo togli. Non si salva niente da solo: puoi guardare il GE di un altro giocatore senza cambiare i tuoi
- Calcolatore GE: aprendolo da FoE Optimizer (pulsante Calc. GE) le tue città importate con la bacchetta diventano mondi con il nome della città e tutti i loro Grandi Edifici al livello da costruire, aggiornati ogni volta; il mondo della città selezionata è quello scelto. Le città visitate e quelle da JSON non contano. Se non hai città importate restano i preferiti che hai già
- Calcolatore GE: sotto i posti un interruttore P sceglie se scrivere la lettera P davanti ai posti nel testo da copiare (P7(2) oppure 7(2)). La scelta resta salvata
- Calcolatore GE: i quattro riepiloghi ora stanno nel primo riquadro, subito sotto le chat
- Planner: il video tutorial ora c'è anche in inglese (Planner › Aiuto › Video tutorial e Guida › Come usare il planner, con il sito in inglese)

### Correzioni
- Planner, Raccordi a 3/4/5: con città piccole in un'area grande capitava che la prima costruzione mettesse già tutti gli edifici con strada; allora la ricerca non partiva e restava la strada verticale lunga quanto tutta l'area. Ora la ricerca parte anche in questo caso e accorcia la strada (su una città di prova da 60 strade a 8)

---

## Versione 2.025 (22/11/2026)
### Aggiornamenti
- Database, Città e Inventario: nel gruppo Tools c'è il pulsante Calc. GE, che apre il Calcolatore GE in una nuova scheda. Nella Città il pulsante JSON non c'è più: per scaricare la città in JSON usa il pulsante JSON della Mappa

---

## Versione 2.024 (21/11/2026)
### Aggiornamenti
- Planner, Raccordi a 3/4/5 con edifici a due corsie: dopo i blocchi a due corsie la strada ora può proseguire a una corsia sulla stessa riga, con gli edifici normali ai due lati, invece di fermarsi sempre contro un edificio a due corsie messo come fine strada. Il Planner prova entrambe le partenze e tiene la migliore
- Planner, catene: se nella tua città un anello è staccato dalla sua catena (per esempio le Serpent Spikes lontane dalla Feathered Serpent Statue) compare un avviso con un interruttore per ogni tipo di anello. Acceso il Planner lo attacca alla catena, che va poi ricollocata e può costare qualche strada in più, anche nella Configurazione attuale. Spento resta staccato come in città e la Configurazione attuale parte davvero dalla tua città (su una città di prova 84 strade invece di 90)
- Planner, città con edifici a due corsie: all'avvio la pagina non resta più bloccata per qualche secondo prima che partano gli scenari. La preparazione delle strade a due corsie è più veloce (su una città di prova da circa 4 secondi a 1) e gira in parallelo agli scenari, con gli stessi risultati di prima
- Planner, Girandola con edifici a due corsie: la girandola resta una girandola. Il Planner prova anche partenze con 1, 2, 3 o tutti e 4 i bracci a due corsie, lunghi quanto basta per gli edifici a due corsie e poi prolungati a una corsia per gli altri, e tiene la migliore. Prima, quando gli edifici a due corsie non entravano in una sola fila, partiva dalla rete a pettine, che non era più una girandola. Nelle città grandi la ricerca della Girandola ora può aprire strade nuove finché qualche edificio con strada resta fuori: su una città di prova con 125 edifici con strada, dopo la stessa ricerca, da 43 edifici fuori a 0 (con la rete a pettine 14 fuori e 286 strade, ora 202 strade). Le città dove la Girandola faceva già entrare tutti non cambiano
- Planner: mentre uno scenario si prepara (strade a due corsie, scelta della posizione del municipio, prove per scegliere la partenza migliore) sotto il suo nome compare un messaggio che lampeggia piano, così si vede che sta lavorando e non è bloccato. Sparisce quando parte la ricerca
- Planner, Smussa: ora può anche spostare gli anelli fra catene dello stesso tipo (per esempio le code dei Serpenti Piumati da un serpente a un altro), lasciando fermi gli inizi, se così diminuiscono gli angoli. Una catena può diventare più lunga e un'altra restare senza anelli: il suo inizio si sposta poi come un edificio normale. Alla ripresa la ricerca parte dalle catene nuove
- Telefono in orizzontale: il nastro dei comandi ora sta in una riga sola, con i pulsanti dei gruppi bassi e il nome accanto all'icona. Prima occupava quasi un terzo dello schermo con molto spazio vuoto sopra e sotto i pulsanti. Se i pulsanti non stanno tutti, restano solo le icone
- Il sito si apre più in fretta, soprattutto da telefono: la tabella degli edifici all'inizio disegna solo le righe che si vedono e aggiunge le altre scorrendo, e alcune parti (mappa della città, pannelli della Guida, Insediamenti, pannelli degli alleati) si scaricano solo quando le apri

### Correzioni
- Planner: dopo aver cambiato nell'editor il numero di anelli delle catene (per esempio tutte le code dei Serpenti Piumati su un serpente solo) lo scenario non riprendeva più la ricerca e anche Smussa non faceva nulla. Ora riparte dalla disposizione dell'editor

---

## Versione 2.023 (20/11/2026)
### Aggiornamenti
- Tabelle edifici: la pagina si apre molto più in fretta (nelle prove le prime righe compaiono in meno di un secondo invece di 3-4) e risponde molto prima a ordinamenti, filtri, ricerca e selezione (nelle prove su computer da 0,5-2,6 secondi a 0,05-0,2 secondi). La tabella mostra subito le prime righe e aggiunge le altre man mano che scorri. Per trovare un edificio usa la casella Cerca: il Ctrl+F del browser trova solo le righe già mostrate
- Database: nuovo selettore Era (accanto al Catalogo) per vedere gli edifici con i valori di qualsiasi era, dall'Età del Bronzo all'Era Stellare: produzioni, beni, valori militari, popolazione ed efficienza. Di base resta l'era più recente. Per esempio l'Ascended Zhulin Panda Shrine dà 554/304/254 beni all'Era Stellare ma 486/236/186 all'Età Coloniale
- Mappa, PNG, Planner ed editor: gli edifici militari a 2 corsie hanno un marrone più scuro, con la loro voce nella legenda, come il verde scuro degli edifici a 2 corsie. Le strade sono grigie invece che marroni, così non si confondono con i militari. Nel PNG i nomi sugli edifici scuri sono scritti in chiaro

### Correzioni
- Mappa: passando col mouse sugli edifici militari (e sugli altri edifici che non sono nel Database, come le fabbriche di beni) ora compare l'immagine dell'edificio

---

## Versione 2.022 (19/11/2026)
### Aggiornamenti
- Planner: passando col mouse sul numero rosso di "Con strada" o "Senza strada" (ora sottolineato) si apre l'elenco degli edifici non ancora piazzati, con le dimensioni e quante copie mancano
- Il numero di versione in alto a destra apre le Novità (lo stesso pannello di Guida › Novità). Ripremuto le chiude e torna dov'eri
- In fondo all'elenco delle città, una barra mostra lo spazio del browser occupato dal tool: un tratto per città (gialle le tue, azzurre le visitate), passandoci sopra col mouse nome e spazio della città, e una stima di quante città si possono ancora salvare

### Correzioni
- Planner: nelle città con moltissimi edifici piccoli con strada tutti uguali (per esempio decine di Pozzi dei desideri) il Planner restava bloccato più di mezzo minuto prima di partire, con la pagina ferma. Ora parte in un secondo o poco più, con le stesse disposizioni
- Planner, città con molti edifici a due corsie: i raccordi partono di nuovo dalla strada a due corsie sul raccordo, che ora può allungarsi fino al bordo della mappa (prima si fermava a 10 blocchi e un edificio restava fuori). Prima veniva scelta la rete a pettine, con quasi il doppio delle strade, oppure una partenza che lasciava fuori edifici a due corsie, che poi finivano attaccati a una strada normale. Su una città di prova con 10 edifici a due corsie: da 378 a 189-212 strade, tutti collegati a due corsie
- Bacchetta: se FoE Helper non ha ancora i dati della città (capita importando la città di un vicino: nome e avatar ma nessun edificio), la città non viene più creata vuota né sovrascritta, e un messaggio spiega di ricaricare il gioco e riprovare. Se l'import della mappa va in errore, la città torna com'era e l'errore viene mostrato

---

## Versione 2.021 (18/11/2026)
### Aggiornamenti
- Tabelle edifici: le tre colonne dei beni personali (era attuale, precedente e successiva) sono ora vicine, seguite dalla colonna dei beni boost. Nuovo pulsante "Somma beni" (Opzioni) che le unisce in un'unica colonna, con l'icona dei beni dorata, col totale dei beni prodotti. Anche questa colonna si può ordinare
- Planner, Raccordi a 3/4/5: nelle città con molti edifici con strada orizzontali (più larghi che alti) la ricerca prova anche un "pettine verticale": da una strada orizzontale partono più strade verticali, con gli edifici orizzontali impilati ai due lati e attaccati dal lato corto. Gli edifici verticali restano sulle strade orizzontali. Su una città di prova con 81 edifici orizzontali: circa 19 caselle di strada in meno e quasi nessun bordo giallo (da circa 50 a 2-4). Le città con pochi edifici orizzontali non cambiano
- Planner, Girandola e Girandola 2: nelle stesse città il pettine verticale parte dai bracci orizzontali della girandola. Sulla città di prova ora entrano tutti gli edifici con strada (prima ne restavano fuori più di 30)
- Planner: nelle Statistiche attuali gli edifici con strada sono divisi per forma (quadrati, orizzontali, verticali), per capire subito se la città ha soprattutto edifici orizzontali
- Città, Inventario e Database: il pulsante "Export" (CSV degli edifici selezionati) passa dal gruppo Opzioni al gruppo Strumenti
- Città: il pulsante "Mappa" passa dal gruppo Strumenti al gruppo Statistiche città
### Correzioni
- Planner: le strade con un lato fuori dall'area di gioco (per esempio una strada lungo il bordo della mappa) sono segnate col bordo rosso come strade sprecate e la ricerca le evita il più possibile (ognuna conta come una strada in più). Restano solo come ultima risorsa, quando servono a far entrare più edifici
- Planner: non restano più quadrati di 4 strade (2×2), che nessuna fase toglieva: se una delle quattro celle non serve si toglie, se serve solo a un edificio che si può attaccare altrove l'edificio viene spostato, e la ricerca scarta le disposizioni in cui un quadrato resta comunque
- Planner: importando con la bacchetta la città di un altro giocatore mentre sei nella scheda Planner, il nastro mostra subito tutti i comandi (prima restava solo "Sorgente" finché non si cambiava scheda)

---

## Versione 2.020 (17/11/2026)
### Aggiornamenti
- Planner: il completamento e la rifinitura dopo COMPLETA sono più veloci (nelle prove fino a un terzo di tempo in meno), con le stesse disposizioni di prima
- Planner: Smussa prova più mosse nello stesso tempo
- Planner, Girandola 2: la scelta della posizione del municipio usa più core insieme e finisce prima, con la stessa posizione scelta
- Planner: la rifinitura dopo COMPLETA lascia molti meno buchi piccoli sparsi tra gli edifici senza strada: sposta e unisce i buchi, anche usando pezzi un po' più piccoli per incastrare meglio, finché lo spazio libero resta in pochi punti (spesso uno solo)
### Correzioni
- Planner, Ippodromo: Carceres e Sphendone vengono collegate alla strada ENTRAMBE (prima spesso solo una delle due); le piste in mezzo restano senza strada
- Planner: a fine rifinitura non restano più decorazioni 1×1 (e altri pezzi 1×n) sparse o isolate nei posti dove stavano all'inizio: un pezzo resta al suo posto iniziale solo se è ancora ben incastrato, altrimenti viene ripiazzato nei buchi o attaccato agli altri edifici. Lo stesso vale per quelli spostati a mano in pausa: se li lasci ben incastrati restano lì, se restano sparsi la rifinitura li sistema

---

## Versione 2.019 (16/11/2026)
### Aggiornamenti
- Città e Inventario: "Edifici visualizzati" sopra la tabella conta gli edifici veri, cioè tutte le copie (la somma dei ×N), non più le righe della tabella
- Planner: durante la ricerca si ridisegna solo la mappa dello scenario che cambia, non più tutte
### Correzioni
- Planner: PNG e JSON della Configurazione attuale si scaricano con il loro nome (prima "girandola")

---

## Versione 2.018 (15/11/2026)
### Correzioni
- Planner: al completamento non restano più fuori edifici senza strada grandi (per esempio un 4×4) quando lo spazio libero basta; se il solito riempimento non li fa entrare tutti, ne viene provato uno che piazza prima i più grandi
- Planner: durante la rifinitura dopo COMPLETA, le decorazioni 1×1 e 1×N spostate a mano in pausa restano dove le hai messe (prima tornavano al posto di prima); la rifinitura è anche più veloce

---

## Versione 2.016 (13/11/2026)
### Novità
- Città, Inventario e Database: nuova icona accanto agli edifici che si possono fabbricare con i frammenti prodotti da altri edifici; passandoci sopra si vedono i produttori, quanti ne hai in città e in inventario e in quanti giorni arrivi al kit. Nuovo filtro "Da frammenti" in Nascondi / Mostra solo

### Correzioni
- Calcolatore GE: premi e PF da versare arrotondati come il gioco anche nei casi limite (per esempio 1 PF in più ai posti 2 e 3 di Santa Sofia al 122, o con la chat personalizzata al 105%)

---

## Versione 2.014 (11/11/2026)
### Novità
- Calcolatore GE: al posto del selettore del livello, la barra di avanzamento della finestra del GE (uguale da PC e da cellulare) con i PF già versati e il livello da inserire evidenziato; le frecce ±1 / ±10 sono accanto al campo del livello
- Planner, Modifica città: sotto le modifiche una tabella con cosa cambia, colonna per colonna (area, strade, popolazione, felicità, valori militari, Incursioni e produzioni), con gli avvisi per i valori all'era massima del Database e per gli alleati negli edifici tolti
- Calcolatore GE: i PF versati dal proprietario hanno una riga loro sopra la classifica, con un pulsante che cancella tutti i PF inseriti; da cellulare i 4 riquadri restano su una riga

### Correzioni
- Dopo un aggiornamento la pagina poteva restare bianca con la sola scritta "FoE Optimizer": ora il tool si ripara da solo
- Planner: in pausa si fermano anche le prove della posizione del municipio della Girandola 2 e la scelta della partenza degli altri scenari

---

## Versione 2.013 (10/11/2026)
### Novità
- Città, Inventario e Database: menu sopra la tabella per scegliere cosa misura la colonna EFF: efficienza militare, beni, Punti Forge o beni di gilda per casella (in Città e Inventario i boost % contano sulla produzione della città)
- Nuove colonne Boost monete, Boost materiali e Boost medaglie nelle produzioni (Database dopo il prossimo aggiornamento dei dati, Città e Inventario dopo un nuovo import), anche nei filtri Produzione e nell'export CSV; le colonne dei beni ora seguono le medaglie, furfanti e truppe vanno dopo i beni di gilda; tutti i boost % hanno un colore più chiaro, verso l'oro
- Città e Database: "Declassabili" diventa "Invecchiabili": gli edifici che portati all'Età del Bronzo danno gli stessi beni e gli stessi valori militari, per produrre beni di un'era vecchia senza perdere niente (nel Database dopo il prossimo aggiornamento dei dati); gli edifici limitati / ascesi hanno un ⚠, perché riascesi a scadenza tornano all'era più alta
- Pannello Produzione: PF e beni degli alleati scienza piazzati, con i beni dell'era dell'edificio che li ospita
- Calcolatore GE: sotto il livello il selettore del livello della finestra del GE, per ricordare di inserire il livello da fare e non quello attuale; le frecce cambiano il livello di 1 o di 10
- Città: il filtro Invecchiabili mostra anche gli edifici aggiunti con +Inventario
- Inventario: filtro Invecchiabili; "Solo pronti" diventa la voce "Pronti" di Nascondi / Mostra solo, per vedere solo gli edifici pronti o solo quelli da fare con i kit

### Correzioni
- Calcolatore GE aperto dalla scorciatoia dell'app installata: "Torna al tool" non chiude più l'app
- Alleati scienza: PF e beni dei tuoi alleati sono quelli del loro livello, non più sempre quelli del livello 100

---

## Versione 2.012 (09/11/2026)
### Novità
- Planner: interruttori per gli edifici scollegati in città, da lasciare senza strada o da collegare
- Planner: quando l'ottimizzatore si ferma parte da solo uno Smussa di 8 secondi, sempre più distanziato se non trova niente
- Pannello Produzione: le riserve di beni della Royal Albert Hall vanno alle ere delle fabbriche di beni della città
- Pannello Produzione: beni con il bonus % arrotondati come nel gioco (serve un nuovo import)
- Calcolatore GE: il livello 101 si fa ancora a tariffa Rame
- Città: icona della calcolatrice accanto ai Grandi Edifici, apre il Calcolatore GE al livello da costruire
- Calcolatore GE: campi "PF già versati da te" ed "Esterni", con posti presi, posti in pericolo e PF mancanti come in FoE Helper
- Edifici scollegati dalla strada: non contano più nei valori militari, nei bonus dei GE, negli alleati ospitati e nelle produzioni (nei dettagli in rosso)

---

## Versione 2.011 (08/11/2026)
### Novità
- Nuova versione della bacchetta (va ricreata, trascinandola di nuovo nella barra dei preferiti): importa anche il livello del Castello: i Punti Forge e i beni giornalieri del Castello contano nel pannello Produzione, e il suo bonus di attacco e difesa ha una colonna nei Valori militari, compresa nel totale (e quindi moltiplicata dai bonus dei GE)
- Città: nuovi filtri Era e Beni dell'era (gruppo Filtri), come nell'Inventario ma sugli edifici piazzati, una riga per ogni era delle copie con i valori di quell'era; sostituiscono la casella "Edifici vecchi"
- "Auto aggiornabili" diventa "Era automatica": sono edifici che prendono da soli l'era della tua città e non si possono portare a un'era precedente con il Kit Invecchiatore o il Kit di Inversione, come ora spiegano i tooltip
- Città › Statistiche › Produzione: due pannelli, "Produzione frammenti" e "Produzione Punti Forge e beni". Nel secondo i beni sono divisi per era (es. Beni Titano, Beni Hub Spaziale), contando l'era di ogni copia degli edifici e il bonus di produzione dei beni, con il totale in fondo; cliccando su una riga (un frammento, i Punti Forge, i beni gilda, i beni speciali o i beni di un'era) si vedono gli edifici che la producono e quanto dà ognuno

---

## Versione 2.010 (07/11/2026)
### Novità
- Inventario: nuovi filtri Era e Beni dell'era (gruppo Filtri). Il primo mostra gli edifici posseduti di un'era; il secondo quelli che producono beni di un'era, cioè gli edifici di quell'era, quelli dell'era dopo con i beni dell'era precedente e quelli dell'era prima con i beni dell'era successiva, con i valori della loro era e la colonna dei beni evidenziata (serve un nuovo import dell'inventario)
- Catalogo dei Grandi Edifici: con il pulsante 📊 accanto al nome (anche in Città, Inventario e Database, al posto del badge "GE") si apre il report del GE, con i bonus e i costi livello per livello dalla wiki ufficiale, un intervallo di livelli a scelta (dalla Città parte dai prossimi 10 livelli del tuo GE), quanti PF ti costa ogni +1 di bonus con la chat e i grafici a schermo intero
- Report dei Grandi Edifici: nuova sezione "Costo di sblocco", con i set di progetti Rame e Oro, le monete, i materiali, le medaglie e i beni che servono per sbloccare i livelli dell'intervallo scelto

---

## Versione 2.009 (06/11/2026)
### Novità
- Nuovo Calcolatore dei Grandi Edifici (foe-optimizer.com/ge, in inglese foe-optimizer.com/gb; anche da Guida › Calcolatore GE e da Database › Grandi Edifici › Calcolatore): per ogni GE e livello i PF del livello, la ricompensa di ogni posto con la percentuale della chat (Rame 90%, 95%, 100%, Oro 20%, 25% o personalizzata) e quanti PF servono per assicurarlo
- Città: sotto i bonus moltiplicativi dei Grandi Edifici (+N%) c'è il contributo effettivo nella tua città (es. +1.670), che ora conta nell'efficienza del GE
- Città e Inventario: nuovo pulsante Opzioni › Bonus GE, che applica ai valori militari e all'efficienza i bonus moltiplicativi dei Grandi Edifici della città
- Statistiche militari: nuove colonne "bonus GE" e "totale con bonus", con i bonus moltiplicativi dei Grandi Edifici calcolati sul totale
- Alleati: i livelli in più dati da Colosseo e Tempio del Loto (tier Oro) contano nelle statistiche degli alleati e nei pannelli Gettoni e Pergamene
### Aggiornamenti
- Tabelle degli edifici: passando il mouse su un valore compare il nome della sua colonna, utile quando l'intestazione è fuori schermo
- Grandi Edifici: i bonus moltiplicativi del tier Oro compaiono nelle colonne come +N% (non contati nell'efficienza); il +% di produzione dei beni di San Marco e dei beni speciali del Trasportatore spaziale va nelle colonne Boost beni e Boost beni speciali
- Grandi Edifici: tutti gli altri bonus (reliquie, colpo critico, doppio incasso, lancio missilistico, bottino di guerra, ecc.) hanno l'icona del gioco con una spiegazione; i potenziamenti di monete e materiali di San Marco, Royal Albert Hall e Faro di Alessandria ora si vedono anche nelle città importate

---

## Versione 2.008 (05/11/2026)
### Novità
- Database: nuovo catalogo Grandi Edifici, con tutti i GE del gioco nella tabella degli edifici (stesse colonne, efficienza e ordinamenti) e un selettore del livello (1, 101, 201, 301, 401, 500) per vedere come cambiano le statistiche; riga e badge in oro o in rame secondo il tier
### Aggiornamenti
- Database: icone del gioco per i cataloghi Edifici e Alleati
- Grandi Edifici: riga e badge GE in oro per i GE nel tier Oro, in rame per quelli nel tier Rame
- Grandi Edifici con il nuovo tier Oro: i bonus moltiplicativi non vengono più sommati alle colonne e all'efficienza; nella colonna ❔ il simbolo × li elenca, insieme ai +% di produzione di beni e ai boost per gli alleati di Colosseo e Tempio del Loto
- Grandi Edifici con il tier Oro: contano anche i beni di gilda di 3 ere dell'Osservatorio e le riserve di beni della Royal Albert Hall

---

## Versione 2.006 (03/11/2026)
### Novità
- Filtro Produzione: secondo clic su una risorsa = riquadro rosso, mostra gli edifici che NON la producono (es. tutte rosse: gli edifici che non producono nulla)
### Aggiornamenti
- Insediamenti: icona del gioco per i Pirati
- Edifici dei set (Cherry Garden, Piazza, Harvest Farm…): contano anche i bonus del set che mancavano (felicità, monete, materiali, medaglie, attacco e difesa); nella colonna ❔ l'icona del set dice il nome del set e che i bonus sono quelli massimi
- Database: tolti i due municipi del tutorial iniziale, che non sono edifici veri, e gli edifici della colonia dell'Era Stellare
- Tabelle degli edifici: icona del gioco nella colonna dei limitati al posto di ⏱
### Correzioni
- Tabelle: la colonna dell'efficienza dei Grandi Edifici ha lo stesso colore della riga

---

## Versione 2.005 (02/11/2026)
### Novità
- Alleati: nuovo pannello "Pergamene" (gruppo Analisi), che mostra quali alleati far salire di livello, e di quanti livelli, per ottenere la massima efficienza con le Pergamene Eroiche che hai
### Aggiornamenti
- Nuova versione della bacchetta: riconosce il mondo di gioco e avvisa se i dati non sono ancora caricati (va ricreata, trascinandola di nuovo nella barra dei preferiti)
- Città salvate: le città dello stesso giocatore su mondi diversi restano separate invece di sovrascriversi, e il nome mostra davanti il mondo con la sua lettera (es. "L · Sdrushi")
- Città salvate: doppio clic sul nome della città in alto per rinominarla (il nome resta anche reimportandola)
- Telefono in verticale: il nastro dei comandi mostra solo le icone dei gruppi ed è più basso
- Il "?" accanto al nome di un gruppo (es. Ricerca) si apre anche con un tocco
- Planner, "Configurazione attuale": le catene partono come sono montate nella tua città, con i loro anelli
- Alleati: il pulsante "Potenziale e gettoni" diventa "Gettoni" con l'icona del gioco e i Gettoni Valore che hai
- Alleati: "Livello 100" spostato nel gruppo Analisi; icone del gioco per Livello 100, Militari, Scienza e Frammenti
### Correzioni
- Telefono: la pagina non scorre più in orizzontale
- App installata sul telefono: si può di nuovo usare anche in verticale
- Planner, PNG con le modifiche alla città: la nota sul bordo bianco compare solo se ci sono edifici aggiunti
- Planner, modifiche nell'editor: gli anelli delle catene (es. Spuntoni del Serpente) si possono spostare da una Statua all'altra, anche allungando o accorciando le catene, invece di dare "catena spezzata"

---

## Versione 2.001 (29/10/2026)
### Novità
- Nascondi / Mostra solo: nuova voce "Richiede strada"
### Aggiornamenti
- Nascondi / Mostra solo e Visualizza: icone del gioco al posto di quelle generiche
### Correzioni
- Interfaccia su telefono: il nastro dei comandi scorre invece di tagliarsi e i menu dei gruppi restano dentro lo schermo

---

## Versione 2.000 (28/10/2026)
### Novità
- NUOVA VERSIONE 2.0: interfaccia rinnovata, con le schede in alto e un nastro di comandi che si adatta alla larghezza della finestra
- Città salvate: le tue città, quelle visitate e quelle importate da JSON, tutte nel selettore in alto; reimportando una città viene aggiornata invece di crearne una copia
- Importa una città da un file JSON (export di FoE Optimizer, FoE Helper o Forge Hammer) ed esporta la tua città in JSON compatibili con altri tools
- Planner: le città con tanti edifici a strada a due corsie vengono disposte con una nuova rete "a pettine"
- Nuova colonna Medaglie tra le produzioni degli edifici (anche nel filtro Produzione)
- Nascondi / Mostra solo: ogni voce nasconde gli edifici oppure mostra solo quelli
- Catalogo degli alleati nel Database
- Tema chiaro e scuro
- Opzioni › Cancella tutto per azzerare dati e impostazioni
- Informazioni: "Pulito, per scelta" – niente pubblicità, cookie, tracciamento né profilazione
- Informazioni: "Offrimi un caffè o una birra" (PayPal o Satispay), del tutto facoltativo
- Link diretti alle schede, per esempio foe-optimizer.com/#planner
### Aggiornamenti
- Ricerca con più nomi separati da virgola, anche negli alleati, e per ID
- Guida online riscritta per la versione 2.0 (italiano e inglese)
### Correzioni
- Planner, "Configurazione attuale": gli edifici con strada aggiunti con "Modifica città" vengono ora collegati aprendo nuove strade (prima la ricerca restava ferma con un edificio fuori)
- Planner, Completa: niente più buchi sparsi; lo spazio libero rimasto viene raccolto in un unico buco, il più quadrato possibile. In "Configurazione attuale" gli edifici senza strada restano al loro posto se è ancora libero

---

## Versione 1.296 (23/10/2026)
### Novità
- Planner: nuovo scenario "Configurazione attuale"
- "Modifica città" per provare la città togliendo e aggiungendo edifici

---

## Versione 1.295 (22/10/2026)
### Novità
- Video tutorial del Planner

---

## Versione 1.294 (21/10/2026)
### Novità
- Planner: supporto alle strade a due corsie; scelta degli edifici militari da collegare; nuovo scenario Raccordo a 5; scelta della potenza della CPU (MIN/MED/MAX); traduzione in inglese

---

## Versione 1.293 (20/10/2026)
### Aggiornamenti
- Planner: più ricerche in parallelo, meno strade

---

## Versione 1.292 (19/10/2026)
### Novità
- Nuovo EDITOR della città
### Aggiornamenti
- Planner: città più compatta

---

## Versione 1.289 (16/10/2026)
### Novità
- Planner: supporto alle "catene" di edifici

---

## Versione 1.288 (15/10/2026)
### Aggiornamenti
- Planner: nuova rifinitura e correzioni di bug

---

## Versione 1.287 (14/10/2026)
### Novità
- Planner: nuovo layout "girandola", correzioni, nuovo colore dei pulsanti

---

## Versione 1.286 (13/10/2026)
### Aggiornamenti
- Planner: aggiornamenti e correzioni (efficienza stradale, smussatura)

---

## Versione 1.285 (12/10/2026)
### Novità
- PLANNER: nuovo planner di città che calcola il piazzamento degli edifici minimizzando le strade

---

## Versione 1.283 (10/10/2026)
### Novità
- Nuovo pannello "Potenziale alleati e Gettoni Valore" (tab Alleati)
### Aggiornamenti
- Il bookmarklet importa anche il magazzino risorse
### Correzioni
- Correzioni all'ottimizzatore dell'inventario

---

## Versione 1.275 (02/10/2026)
### Aggiornamenti
- Nuova versione del bookmarklet
### Correzioni
- Correzioni all'import dell'Avamposto e allo strumento Pirati

---

## Versione 1.272 (29/09/2026)
### Correzioni
- Correzione al bookmarklet

---

## Versione 1.271 (28/09/2026)
### Aggiornamenti
- Aiuti, guida e informativa privacy aggiornati
### Correzioni
- Correzioni di vari bug

---

## Versione 1.260 (17/09/2026)
### Aggiornamenti
- Ritocchi estetici

---

## Versione 1.255 (12/09/2026)
### Correzioni
- Correzione per gli edifici "AllAge"

---

## Versione 1.247 (04/09/2026)
### Correzioni
- Correzioni di bug e miglioramenti all'ottimizzatore dell'inventario

---

## Versione 1.239 (27/08/2026)
### Novità
- Supporto ai "Beni speciali"
### Correzioni
- Correzioni al layout su smartphone

---

## Versione 1.238 (26/08/2026)
### Aggiornamenti
- Più sicurezza e privacy (bookmarklet e dati salvati nel browser)
- Aggiornamento dati SAD

---

## Versione 1.236 (24/08/2026)
### Novità
- PIRATI: nuovo strumento per pianificare l'Insediamento dei Pirati (import dell'Avamposto Culturale) e correzioni

---

## Versione 1.235 (23/08/2026)
### Novità
- Riconosciuti gli edifici che cambiano con l'era

---

## Versione 1.232 (20/08/2026)
### Novità
- Opzione per nascondere gli elementi 🚫
### Aggiornamenti
- Ritocchi estetici

---

## Versione 1.229 (17/08/2026)
### Aggiornamenti
- Bookmarklet e testi aggiornati

---

## Versione 1.228 (16/08/2026)
### Aggiornamenti
- Edificio "FSB" disattivato

---

## Versione 1.227 (15/08/2026)
### Aggiornamenti
- Kit aggiornati e miglioramenti all'ottimizzatore

---

## Versione 1.226 (14/08/2026)
### Aggiornamenti
- Nuova era "Stellar Age: Discovery" di default

---

## Versione 1.225 (13/08/2026)
### Novità
- Pieno supporto a Forge Hammer (oltre a FoE Helper)
- Nuovo pannello "ERA ->"
### Aggiornamenti
- Guide aggiornate

---

## Versione 1.224 (12/08/2026)
### Aggiornamenti
- Il bookmarklet importa anche il nome del giocatore

---

## Versione 1.223 (11/08/2026)
### Novità
- Export della città in PNG
### Aggiornamenti
- Gestione alleati aggiornata

---

## Versione 1.215 (03/08/2026)
### Aggiornamenti
- Nuovi edifici e kit

---

## Versione 1.212 (31/07/2026)
### Aggiornamenti
- Mappa della città migliorata

---

## Versione 1.210 (29/07/2026)
### Correzioni
- Gestione delle strade corretta

---

## Versione 1.208 (27/07/2026)
### Novità
- Edifici unici (non ottenibili da kit)
- Supporto a SAD
### Aggiornamenti
- Intestazioni delle tab
- Ritocchi estetici

---

## Versione 1.205 (24/07/2026)
### Aggiornamenti
- Ritocchi estetici

---

## Versione 1.204 (23/07/2026)
### Aggiornamenti
- Nuovi edifici e ritocchi estetici

---

## Versione 1.203 (22/07/2026)
### Novità
- La tab Città può mostrare anche l'inventario
- Ordinamento delle colonne
### Correzioni
- Correzioni di stile

---

## Versione 1.202 (21/07/2026)
### Novità
- Badge frammenti (mostra cosa produce un edificio)
- Efficienza delle strade
### Aggiornamenti
- Orientamento orizzontale

---

## Versione 1.201 (20/07/2026)
### Aggiornamenti
- Nuove icone dell'app
### Correzioni
- Correzioni (inventario, ottimizzatore)

---

## Versione 1.200 (19/07/2026)
### Aggiornamenti
- Ritocchi grafici e nuove icone

---

## Versione 1.198 (17/07/2026)
### Aggiornamenti
- Ritocchi all'interfaccia e ai testi

---

## Versione 1.196 (15/07/2026)
### Aggiornamenti
- Nuovo bookmarklet

---

## Versione 1.195 (14/07/2026)
### Aggiornamenti
- Nuova icona per iPhone/iPad

---

## Versione 1.194 (13/07/2026)
### Novità
- Informativa sulla privacy

---

## Versione 1.192 (11/07/2026)
### Correzioni
- Correzioni (inventario, dati degli edifici, aggiornamento dell'app)

---

## Versione 1.190 (09/07/2026)
### Novità
- Guida online (italiano e inglese)
- Pagina di errore 404

---

## Versione 1.188 (07/07/2026)
### Aggiornamenti
- Il filtro sugli edifici viene ora ricordato

---

## Versione 1.183 (02/07/2026)
### Aggiornamenti
- Ritocchi estetici

---

## Versione 1.182 (01/07/2026)
### Novità
- Filtro per slot degli alleati
### Aggiornamenti
- Ricerca più fluida

---

## Versione 1.181 (30/06/2026)
### Novità
- Rilevamento degli edifici "declassabili"
- Avatar del giocatore nella barra della città
### Aggiornamenti
- Migliore gestione degli alleati

---

## Versione 1.180 (29/06/2026)
### Novità
- PRIMA VERSIONE: database degli edifici, import di città e inventario, ottimizzatore dell'inventario, alleati, profili, installabile come app
