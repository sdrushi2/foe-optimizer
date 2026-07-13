# Informativa sulla Privacy

**Ultimo aggiornamento:** 13 luglio 2026

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

Questa funzione è **opzionale** e richiede l'estensione del browser di terze parti
**[FoE Helper](https://foe-helper.com/)** ([Chrome Web Store](https://chromewebstore.google.com/detail/foe-helper/bkagcmloachflbbkfmfiggipaelfamdf),
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/foe-helper/)),
**non sviluppata da Sdrushi e non parte di questo progetto**. Il tool fornisce un
**bookmarklet**: uno script che, trascinato nella barra dei preferiti ed eseguito
mentre sei loggato su Forge of Empires con FoE Helper attivo, estrae un **piccolo
sottoinsieme di dati** messi a disposizione da FoE Helper:

- gli edifici presenti nella tua città;
- i tuoi alleati;
- il tuo inventario;
- l'URL dell'avatar del tuo giocatore.

- Questi dati **non vengono mai inviati a un server esterno**: bookmarklet e tool
  elaborano tutto localmente, nel tuo browser.
- Se scegli di salvare un profilo, i dati vengono scritti (in forma compressa) **solo
  nel `localStorage` del tuo browser**, sul tuo dispositivo.
- Nessuno — incluso lo sviluppatore del tool — ha accesso a questi dati: non transitano
  da nessuna parte se non nel tuo browser.
- Puoi cancellarli in qualunque momento eliminando i profili dall'interfaccia del tool,
  oppure cancellando i dati del sito dalle impostazioni del tuo browser.
- FoE Helper è un prodotto indipendente con una propria informativa e un proprio
  trattamento dei dati: per informazioni su come FoE Helper stesso opera, fai
  riferimento al sito ufficiale dell'estensione.

### 2. Account, login, dati anagrafici

Il tool **non richiede né supporta** registrazione, login, email, username o qualunque
altro dato personale identificativo. Non esiste alcun sistema di autenticazione.

### 3. Analisi del traffico del sito (Cloudflare Web Analytics)

Il sito usa **Cloudflare Web Analytics** (RUM — Real User Monitoring) per capire, in
forma aggregata, come viene usato il sito (es. tempi di caricamento pagina, pagine più
visitate). Per dichiarazione dello stesso fornitore (Cloudflare):

- non usa cookie, non accede a `localStorage`/`sessionStorage` del browser;
- non traccia individualmente i singoli visitatori tra sessioni diverse;
- l'indirizzo IP del visitatore viene scartato dal data center Cloudflare più vicino e
  non viene salvato in log o database permanenti.

I dati aggregati (non riconducibili a te) sono visibili solo al gestore del sito
tramite la dashboard Cloudflare. Informativa completa di Cloudflare:
https://www.cloudflare.com/privacypolicy/

### 4. Hosting e sicurezza (GitHub Pages + Cloudflare)

Il sito è pubblicato tramite **GitHub Pages** e servito attraverso la rete
**Cloudflare** (CDN, protezione da bot/scanner automatici, cache). Come qualunque
infrastruttura web, questi fornitori registrano automaticamente log tecnici standard
delle richieste HTTP (es. indirizzo IP, user agent, timestamp) per finalità di sicurezza
e funzionamento del servizio — ad esempio per bloccare scanner automatici malevoli
prima che raggiungano il sito. Questi log tecnici:

- sono gestiti da Cloudflare/GitHub secondo le rispettive informative;
- **non sono accessibili né utilizzati dallo sviluppatore del tool per identificare
  singoli utenti**; vengono consultati solo in forma aggregata per analisi generali di
  traffico o per capire eventuali abusi/attacchi.

Informative dei fornitori:
- Cloudflare: https://www.cloudflare.com/privacypolicy/
- GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement

### 5. Cookie

Il tool **non installa cookie propri**. Non ci sono cookie di profilazione, marketing o
di terze parti.

### 6. Service Worker / funzionamento offline

Il tool installa un *service worker* per permettere l'uso offline e il caricamento
istantaneo dell'app dopo la prima visita. Il service worker si limita a salvare in
cache, **sul tuo dispositivo**, i file statici dell'app (HTML/CSS/JS, icone): non
raccoglie né trasmette alcun dato.

### 7. Nessuna pubblicità, nessuna vendita di dati

Il tool non mostra pubblicità e non vende, affitta o condivide alcun dato con terze
parti a fini commerciali — anche perché, come spiegato sopra, non esiste alcun dato
lato server da vendere.

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

**Last updated:** July 13, 2026

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

This feature is **optional** and requires the third-party browser extension
**[FoE Helper](https://foe-helper.com/)** ([Chrome Web Store](https://chromewebstore.google.com/detail/foe-helper/bkagcmloachflbbkfmfiggipaelfamdf),
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/foe-helper/)), **not
developed by Sdrushi and not part of this project**. The tool provides a
**bookmarklet**: a script that, when dragged to your bookmarks bar and run while
logged into Forge of Empires with FoE Helper active, extracts a **small subset of
data** made available by FoE Helper:

- the buildings present in your city;
- your allies;
- your inventory;
- your player avatar's URL.

- This data is **never sent to an external server**: the bookmarklet and the tool
  process everything locally, in your browser.
- If you choose to save a profile, the data is written (in compressed form) **only to
  your browser's `localStorage`**, on your device.
- No one — including the tool's developer — has access to this data: it never travels
  anywhere except within your own browser.
- You can delete it at any time from the tool's own interface, or by clearing the
  site's data from your browser settings.
- FoE Helper is an independent product with its own privacy practices and data
  handling: for information on how FoE Helper itself operates, refer to the
  extension's official site.

### 2. Accounts, login, personal identifiers

The tool **does not require or support** registration, login, email, username, or any
other personally identifying data. There is no authentication system whatsoever.

### 3. Site traffic analytics (Cloudflare Web Analytics)

The site uses **Cloudflare Web Analytics** (RUM — Real User Monitoring) to understand,
in aggregate form, how the site is used (e.g. page load times, most visited pages). Per
Cloudflare's own documentation:

- it does not use cookies, and does not access the browser's `localStorage` /
  `sessionStorage`;
- it does not individually track visitors across separate sessions;
- the visitor's IP address is discarded at the nearest Cloudflare data center and is
  not stored in permanent logs or databases.

Aggregated data (not attributable to you) is visible only to the site operator via the
Cloudflare dashboard. Cloudflare's full privacy policy:
https://www.cloudflare.com/privacypolicy/

### 4. Hosting and security (GitHub Pages + Cloudflare)

The site is published via **GitHub Pages** and served through the **Cloudflare**
network (CDN, protection against automated bots/scanners, caching). Like any web
infrastructure, these providers automatically log standard technical data about HTTP
requests (e.g. IP address, user agent, timestamp) for security and service-operation
purposes — for example, to block malicious automated scanners before they reach the
site. These technical logs:

- are managed by Cloudflare/GitHub according to their respective policies;
- **are not accessible to or used by the tool's developer to identify individual
  users**; they are only reviewed in aggregate for general traffic analysis or to
  understand potential abuse/attacks.

Providers' privacy policies:
- Cloudflare: https://www.cloudflare.com/privacypolicy/
- GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement

### 5. Cookies

The tool **does not set any cookies of its own**. There are no profiling, marketing, or
third-party cookies.

### 6. Service worker / offline functionality

The tool installs a *service worker* to enable offline use and instant loading after
the first visit. The service worker only caches the app's static files (HTML/CSS/JS,
icons) **on your device**: it does not collect or transmit any data.

### 7. No advertising, no data sale

The tool shows no advertising and does not sell, rent, or share any data with third
parties for commercial purposes — not least because, as explained above, there is no
server-side data to sell in the first place.

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
