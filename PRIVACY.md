# Informativa sulla Privacy

**Ultimo aggiornamento:** 28 ottobre 2026

*(English version below)*

## Chi siamo

FoE Optimizer è un tool gratuito, amatoriale e non ufficiale per il gioco *Forge of
Empires*. È realizzato e mantenuto da un singolo sviluppatore che si firma **Sdrushi**.
Il progetto **non è affiliato, sponsorizzato o approvato da InnoGames GmbH**, sviluppatore
e proprietario di Forge of Empires.

- Pseudonimo/contatto: **Sdrushi** — info@foe-optimizer.com
- Codice sorgente pubblico: https://github.com/sdrushi2/foe-optimizer

Questo documento vive nel repository GitHub del progetto: la versione qui presente è
sempre quella più aggiornata e canonica.

## Il tool funziona anche senza importare nulla

Prima di tutto: **FoE Optimizer funziona già completamente senza importare alcun
dato**. Nella sua forma base è semplicemente un **database statico consultabile**, con
tutti gli edifici presenti nel gioco — non si appoggia a nessuna estensione del
browser e non interagisce in alcun modo con il gioco. Il database viene aggiornato
costantemente; nonostante questo, potrebbero comunque essere presenti errori o dati
non aggiornatissimi rispetto all'ultima versione del gioco.

L'importazione (opzionale) della tua città, inventario e alleati è una funzione
aggiuntiva, separata, descritta nel dettaglio al punto 1 qui sotto.

## Il principio alla base di questo tool: zero backend

FoE Optimizer è un'applicazione **interamente client-side**: gira solo nel tuo browser.
Non esiste un server applicativo, un database o un account utente che riceva, elabori o
conservi i tuoi dati di gioco. L'intero codice sorgente è pubblico su GitHub, così
chiunque può verificare che quanto descritto qui corrisponda a quanto fa davvero il
codice.

## Quali dati vengono trattati, e come

### 1. Dati di gioco importati (opzionale: città, inventario, alleati, avatar)

Questa funzione è **opzionale** e richiede una delle due estensioni del browser di
terze parti **[FoE Helper](https://foe-helper.com/)** ([Chrome Web Store](https://chromewebstore.google.com/detail/foe-helper/bkagcmloachflbbkfmfiggipaelfamdf),
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/foe-helper/)) oppure
**Forge Hammer** ([Chrome Web Store](https://chromewebstore.google.com/detail/forge-hammer/kmicglnhmpaebfcoiojigbnepklclboa),
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/forge-hammer/)),
**non sviluppate da Sdrushi e non parte di questo progetto**. Il tool fornisce un
**bookmarklet**: uno script che, trascinato nella barra dei preferiti ed eseguito
mentre sei loggato su Forge of Empires con una delle due estensioni attiva, estrae un
**piccolo sottoinsieme di dati** messi a disposizione dall'estensione:

- gli edifici presenti nella tua città;
- i tuoi alleati;
- il tuo inventario;
- il nome del tuo giocatore (usato come nome della città salvata);
- l'URL dell'avatar del tuo giocatore;
- la disposizione del tuo Insediamento dei Pirati (aree sbloccate, edifici, ostacoli),
  se l'hai visitato nella sessione di gioco in corso.

Se usi il bookmarklet mentre visiti la città di un altro giocatore, vengono letti gli
stessi dati di quella città che il gioco ti mostra (edifici, nome e avatar del
giocatore), con le stesse garanzie qui sotto.

Il bookmarklet copia questi dati negli **appunti del tuo computer**; il tool li legge
dagli appunti quando premi la bacchetta (il browser può chiederti il permesso di
leggerli). In alternativa puoi caricare una città da un **file JSON** (export di FoE
Optimizer, FoE Helper o Forge Hammer): il file viene letto nel tuo browser, come i
dati del bookmarklet.

- Questi dati **non vengono mai inviati a un server esterno**: bookmarklet e tool
  elaborano tutto localmente, nel tuo browser.
- Le città importate vengono salvate (in forma compressa) **solo nel `localStorage`
  del tuo browser**, sul tuo dispositivo, insieme alle impostazioni del tool.
- Nessuno — incluso lo sviluppatore del tool — ha accesso a questi dati: non transitano
  da nessuna parte se non nel tuo browser.
- Puoi cancellarli in qualunque momento: una città alla volta dal selettore delle
  città, tutto insieme con **Opzioni › Cancella tutto**, oppure cancellando i dati del
  sito dalle impostazioni del tuo browser.
- FoE Helper e Forge Hammer sono prodotti indipendenti, ciascuno con una propria
  informativa e un proprio trattamento dei dati: per informazioni su come operano,
  fai riferimento ai siti ufficiali delle estensioni.

### 2. Account, login, dati anagrafici

Il tool **non richiede né supporta** registrazione, login, email, username o qualunque
altro dato personale identificativo. Non esiste alcun sistema di autenticazione.

### 3. Nessuna statistica sulle visite

Il sito **non usa alcuno strumento di analisi del traffico** (niente Google Analytics,
niente Cloudflare Web Analytics, niente pixel dei social) e **nessuno script di terze
parti**: tutto il codice viene dal sito stesso. Lo sviluppatore non sa chi visita il
sito né cosa fa al suo interno.

### 4. Hosting (GitHub Pages)

Il sito è pubblicato tramite **GitHub Pages**. Come qualunque servizio di hosting,
GitHub registra automaticamente log tecnici standard delle richieste HTTP (es.
indirizzo IP, user agent, data e ora) per finalità di sicurezza e funzionamento del
servizio. Questi log sono gestiti da GitHub secondo la sua informativa e **non sono
accessibili allo sviluppatore del tool**.

Informativa di GitHub:
https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement

### 5. Immagini caricate dal CDN di InnoGames

Le immagini degli edifici (e, se hai importato la tua città, l'avatar del giocatore)
non sono copiate dentro il tool: il tuo browser le richiede direttamente al **CDN di
InnoGames** (`*.innogamescdn.com`), lo stesso da cui le carica il gioco. Questo vale
anche se non importi nulla, perché il database consultabile mostra le immagini degli
edifici.

In pratica significa che, come per qualunque immagine caricata da un sito esterno,
InnoGames vede la richiesta e i dati tecnici che l'accompagnano (indirizzo IP, user
agent). Il tool **non invia a InnoGames nessun dato della tua città**: solo il nome del
file immagine da scaricare. Il sito imposta inoltre una `Referrer-Policy` restrittiva,
così l'indirizzo completo della pagina che stai guardando non viene trasmesso.

L'URL dell'avatar viene accettato **solo** se punta a `https://*.innogamescdn.com`:
qualunque altro indirizzo eventualmente presente in un file importato o in un backup
viene scartato e sostituito dall'avatar segnaposto, così un file ricevuto da terzi non
può far contattare al tuo browser un server arbitrario.

### 6. Cookie

Il tool **non installa cookie propri**. Non ci sono cookie di profilazione, marketing o
di terze parti.

### 7. Service Worker / funzionamento offline

Il tool installa un *service worker* per permettere l'uso offline e il caricamento
istantaneo dell'app dopo la prima visita. Il service worker si limita a salvare in
cache, **sul tuo dispositivo**, i file dell'app (HTML/CSS/JS, icone) e il database
degli edifici: non raccoglie né trasmette alcun dato.

### 8. Nessuna pubblicità, nessuna vendita di dati

Il tool non mostra pubblicità e non vende, affitta o condivide alcun dato con terze
parti a fini commerciali — anche perché, come spiegato sopra, non esiste alcun dato
lato server da vendere.

### 9. Link esterni e donazioni facoltative

Il pannello Informazioni contiene dei semplici link verso siti esterni (GitHub e, per
offrire un caffè allo sviluppatore se ti va, PayPal e Satispay). Il logo di PayPal e il
codice QR di Satispay sono immagini salvate nel sito stesso: **nessuno script né
contenuto di questi servizi viene caricato** finché non clicchi un link. Se lo fai, sei
sul loro sito e valgono le loro informative. Le donazioni sono del tutto facoltative e
non cambiano nulla nel funzionamento del tool.

## Minori

Forge of Empires può essere giocato anche da utenti minorenni. Per le ragioni sopra
descritte, il tool non raccoglie né richiede deliberatamente alcun dato personale da
nessun utente, indipendentemente dall'età.

## I tuoi diritti

Poiché tutti i dati di gioco che importi restano esclusivamente nel tuo browser, hai il
**controllo completo** su di essi: puoi visualizzarli, esportarli o cancellarli in
qualsiasi momento direttamente dall'interfaccia del tool o dalle impostazioni del tuo
browser, senza bisogno di contattare nessuno.

Per domande su questa informativa, o dubbi sul funzionamento del tool, scrivi a
info@foe-optimizer.com o apri una issue su
[GitHub](https://github.com/sdrushi2/foe-optimizer/issues).

## Modifiche a questa informativa

Questa informativa può essere aggiornata in futuro, ad esempio per riflettere modifiche
tecniche al tool. La versione più aggiornata è sempre quella pubblicata in questo
repository GitHub, alla data indicata in cima al documento.

## Nota

Questa informativa descrive onestamente ciò che il tool fa e non fa, dal punto di vista
tecnico. Non è stata redatta da un legale: per esigenze di conformità specifiche (es.
aziendali) è opportuno consultare un professionista.

---

# Privacy Policy (English)

**Last updated:** October 28, 2026

## Who we are

FoE Optimizer is a free, hobby, unofficial tool for the game *Forge of Empires*. It is
built and maintained by a single developer known as **Sdrushi**. This project is **not
affiliated with, sponsored by, or endorsed by InnoGames GmbH**, the developer and owner
of Forge of Empires.

- Pseudonym/contact: **Sdrushi** — info@foe-optimizer.com
- Public source code: https://github.com/sdrushi2/foe-optimizer

This document lives in the project's GitHub repository: the version here is always the
most up-to-date, canonical one.

## The tool works fully without importing anything

First and foremost: **FoE Optimizer already works completely without importing any
data**. In its base form it's simply a **browsable, static database** of every
building in the game — it does not rely on any browser extension and does not
interact with the game in any way. The database is kept constantly updated; even so,
it may still contain errors or data that isn't perfectly in sync with the latest game
version.

The (optional) import of your city, inventory, and allies is a separate, additional
feature, described in detail in point 1 below.

## The core principle: zero backend

FoE Optimizer is an **entirely client-side** application: it runs only in your browser.
There is no application server, database, or user account that receives, processes, or
stores your game data. The full source code is public on GitHub, so anyone can verify
that what's described here matches what the code actually does.

## What data is processed, and how

### 1. Imported game data (optional: city, inventory, allies, avatar)

This feature is **optional** and requires one of two third-party browser extensions,
**[FoE Helper](https://foe-helper.com/)** ([Chrome Web Store](https://chromewebstore.google.com/detail/foe-helper/bkagcmloachflbbkfmfiggipaelfamdf),
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/foe-helper/)) or
**Forge Hammer** ([Chrome Web Store](https://chromewebstore.google.com/detail/forge-hammer/kmicglnhmpaebfcoiojigbnepklclboa),
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/forge-hammer/)), **not
developed by Sdrushi and not part of this project**. The tool provides a
**bookmarklet**: a script that, when dragged to your bookmarks bar and run while
logged into Forge of Empires with either extension active, extracts a **small subset
of data** made available by the extension:

- the buildings present in your city;
- your allies;
- your inventory;
- your player name (used as the name of the saved city);
- your player avatar's URL;
- the layout of your Pirate Outpost (unlocked areas, buildings, obstacles), if you
  visited it during the current game session.

If you run the bookmarklet while visiting another player's city, the same data the
game shows you about that city is read (buildings, the player's name and avatar),
with the same guarantees described below.

The bookmarklet copies this data to **your computer's clipboard**; the tool reads it
from the clipboard when you press the wand (your browser may ask for permission to
read it). Alternatively you can load a city from a **JSON file** (an FoE Optimizer,
FoE Helper or Forge Hammer export): the file is read in your browser, just like the
bookmarklet data.

- This data is **never sent to an external server**: the bookmarklet and the tool
  process everything locally, in your browser.
- Imported cities are saved (in compressed form) **only in your browser's
  `localStorage`**, on your device, together with the tool's settings.
- No one — including the tool's developer — has access to this data: it never travels
  anywhere except within your own browser.
- You can delete it at any time: one city at a time from the city selector,
  everything at once with **Options › Erase everything**, or by clearing the site's
  data from your browser settings.
- FoE Helper and Forge Hammer are independent products, each with its own privacy
  practices and data handling: for information on how they operate, refer to the
  extensions' official sites.

### 2. Accounts, login, personal identifiers

The tool **does not require or support** registration, login, email, username, or any
other personally identifying data. There is no authentication system whatsoever.

### 3. No visitor statistics

The site uses **no traffic analytics tool at all** (no Google Analytics, no Cloudflare
Web Analytics, no social media pixels) and **no third-party scripts**: all the code
comes from the site itself. The developer does not know who visits the site or what
they do on it.

### 4. Hosting (GitHub Pages)

The site is published via **GitHub Pages**. Like any hosting service, GitHub
automatically logs standard technical data about HTTP requests (e.g. IP address, user
agent, date and time) for security and service-operation purposes. These logs are
managed by GitHub according to its own policy and **are not accessible to the tool's
developer**.

GitHub's privacy statement:
https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement

### 5. Images loaded from InnoGames' CDN

Building images (and, if you imported your city, the player's avatar) are not bundled
inside the tool: your browser requests them directly from **InnoGames' CDN**
(`*.innogamescdn.com`), the same one the game itself uses. This happens even if you
import nothing, because the browsable database shows building images.

In practice this means that, as with any image loaded from an external site, InnoGames
sees the request and the technical data that comes with it (IP address, user agent). The
tool **sends InnoGames no data about your city**: only the name of the image file to
download. The site also sets a restrictive `Referrer-Policy`, so the full address of the
page you are viewing is not transmitted.

The avatar URL is accepted **only** if it points to `https://*.innogamescdn.com`: any
other address that might be present in an imported file or a backup is discarded and
replaced by the placeholder avatar, so a file received from someone else cannot make
your browser contact an arbitrary server.

### 6. Cookies

The tool **does not set any cookies of its own**. There are no profiling, marketing, or
third-party cookies.

### 7. Service worker / offline functionality

The tool installs a *service worker* to enable offline use and instant loading after
the first visit. The service worker only caches the app's files (HTML/CSS/JS, icons)
and the building database **on your device**: it does not collect or transmit any data.

### 8. No advertising, no data sale

The tool shows no advertising and does not sell, rent, or share any data with third
parties for commercial purposes — not least because, as explained above, there is no
server-side data to sell in the first place.

### 9. External links and optional donations

The About panel contains plain links to external sites (GitHub and, if you'd like to
buy the developer a coffee, PayPal and Satispay). The PayPal logo and the Satispay QR
code are images stored on the site itself: **no script or content from these services
is loaded** until you click a link. If you do, you are on their site and their
policies apply. Donations are entirely optional and change nothing in how the tool
works.

## Minors

Forge of Empires can also be played by minors. For the reasons described above, the
tool does not deliberately collect or request any personal data from any user,
regardless of age.

## Your rights

Since all the game data you import stays exclusively in your browser, you have
**complete control** over it: you can view, export, or delete it at any time directly
from the tool's interface or your browser's settings, without needing to contact
anyone.

For questions about this policy, or about how the tool works, email
info@foe-optimizer.com or open an issue on
[GitHub](https://github.com/sdrushi2/foe-optimizer/issues).

## Changes to this policy

This policy may be updated in the future, for example to reflect technical changes to
the tool. The most current version is always the one published in this GitHub
repository, dated at the top of the document.

## Note

This policy honestly describes what the tool does and does not do, from a technical
standpoint. It was not drafted by a lawyer: for specific compliance needs (e.g.
business use), please consult a professional.
