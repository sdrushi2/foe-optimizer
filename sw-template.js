/* eslint-disable */
// =============================================================================
// Service Worker — FoE Optimizer
// =============================================================================
// Strategia: CACHE-FIRST con aggiornamento in background (stale-while-revalidate
// per il documento HTML).
//
// - Prima visita: scarica e mette in cache l'app (index.html, tutti i file di
//   dist/assets/ con hash, i dati di gioco di /data/ e le icone/manifest).
//   2.0: non più single-file; l'elenco dei file lo inietta la build
//   (__SW_PRECACHE__, plugin serviceWorkerPlugin in vite.config.ts).
// - Visite successive: l'app viene servita ISTANTANEAMENTE dalla cache, mentre in
//   background si controlla se c'e' una versione nuova. Se c'e', il nuovo SW si
//   installa e si attiva subito (skipWaiting + clients.claim); la pagina se ne
//   accorge da sola (updatefound / controllerchange in src/registerSW.ts), mostra
//   l'avviso "nuova versione" e ricarica.
// - Offline: l'app funziona comunque (e' tutto client-side).
//
// IL NOME DELLA CACHE INCLUDE LA VERSIONE DI BUILD (__SW_VERSION__, iniettata dal
// plugin Vite a build-time): ad ogni nuova build il nome cambia, quindi la vecchia
// cache viene cancellata in 'activate' e gli utenti non restano bloccati su una
// versione vecchia. Questo risolve la classica "trappola di caching" dei SW.
// =============================================================================

const VERSION = "__SW_VERSION__";
const CACHE_NAME = `foe-optimizer-${VERSION}`;

// Risorse da pre-cachare all'installazione: la root "/" (index.html), i file
// della build (codice/stile con hash e dati con ?v=hash, iniettati dalla build)
// e gli asset statici leggeri.
const PRECACHE_URLS = [
  "/",
  "__SW_PRECACHE__",
  "/site.webmanifest",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
// Pre-cache delle risorse. skipWaiting() fa si' che il nuovo SW prenda il
// controllo il prima possibile invece di restare "in attesa" indefinitamente.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll fallisce tutto-o-niente: se un asset non esiste, l'install fallirebbe.
      // Usiamo un add() tollerante cosi' un singolo asset mancante non rompe il SW.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch (err) {
            // Asset non disponibile: lo ignoriamo, verra' eventualmente cachato a runtime.
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
// Cancella tutte le cache di versioni precedenti (nome diverso dall'attuale) e
// prende il controllo di tutte le tab aperte (clients.claim()).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("foe-optimizer-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────────
// Gestiamo solo richieste GET same-origin. Tutto il resto (le immagini e gli
// avatar dal CDN di InnoGames, cross-origin) passa direttamente in rete senza
// intercettazione.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Video (tutorial): richieste a intervalli (Range → 206) e file grandi, da
  // non mettere in cache (cache.put rifiuta le 206 e il seek si romperebbe).
  if (request.headers.has("range") || url.pathname.endsWith(".mp4")) return;

  // Navigazioni (richiesta di un documento HTML): STALE-WHILE-REVALIDATE.
  // Serviamo subito la cache (istantaneo), e in parallelo aggiorniamo la cache
  // con la versione di rete per la prossima volta.
  //
  // IMPORTANTE: la chiave di cache usata e' l'URL RICHIESTO (request), non
  // sempre "/". La root "/" (l'app) resta il caso
  // principale, ma il sito ha anche pagine statiche indipendenti fuori dal
  // bundle (es. /guida.html, /guide.html): usare sempre "/" come chiave
  // faceva si' che navigare verso una di queste pagine mostrasse comunque
  // l'ultima pagina cachata sotto "/", finche' un refresh non "sbloccava"
  // l'aggiornamento di quella chiave specifica.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        // Se abbiamo una copia in cache, la serviamo SUBITO (network in background).
        // Altrimenti (prima visita) aspettiamo la rete. Offline e mai visitata
        // con QUESTO indirizzo (es. "/?qualcosa"): la stessa pagina senza
        // parametri, se in cache; altrimenti l'errore di rete del browser.
        return cached || (await networkFetch)
          || (await cache.match(request, { ignoreSearch: true }))
          || Response.error();
      })()
    );
    return;
  }

  // Manifest dei dati (2.0): NETWORK-FIRST, la cache solo offline. E' lui a
  // dire quale versione (?v=hash) di ogni file di dati usare: deve arrivare
  // dalla rete appena c'e', cosi' un dato aggiornato si vede subito.
  if (url.pathname === "/data/manifest.json") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (response && response.ok) cache.put(url.pathname, response.clone());
          return response;
        } catch (err) {
          return (await cache.match(url.pathname)) || Response.error();
        }
      })()
    );
    return;
  }

  // Altri asset same-origin: CACHE-FIRST con fallback rete. Vale anche per i
  // file con hash nel nome (/assets/) e per i dati con ?v=hash: un URL non
  // cambia mai contenuto, un dato aggiornato ha un URL nuovo.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Niente cache e niente rete: lasciamo fallire (il browser gestira' l'errore).
        return Response.error();
      }
    })()
  );
});
