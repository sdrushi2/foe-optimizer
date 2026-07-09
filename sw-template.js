/* eslint-disable */
// =============================================================================
// Service Worker — FoE Optimizer
// =============================================================================
// Strategia: CACHE-FIRST con aggiornamento in background (stale-while-revalidate
// per il documento HTML).
//
// - Prima visita: scarica e mette in cache l'app (l'index.html single-file e gli
//   asset statici come icone/manifest).
// - Visite successive: l'app viene servita ISTANTANEAMENTE dalla cache, mentre in
//   background si controlla se c'e' una versione nuova. Se c'e', viene scaricata e
//   il nuovo SW si installa; alla visita/refresh successivo l'utente ha la nuova
//   versione. La pagina viene anche notificata (postMessage) cosi' puo' mostrare
//   un avviso "nuova versione disponibile".
// - Offline: l'app funziona comunque (e' tutto client-side).
//
// IL NOME DELLA CACHE INCLUDE LA VERSIONE DI BUILD (__SW_VERSION__, iniettata dal
// plugin Vite a build-time): ad ogni nuova build il nome cambia, quindi la vecchia
// cache viene cancellata in 'activate' e gli utenti non restano bloccati su una
// versione vecchia. Questo risolve la classica "trappola di caching" dei SW.
// =============================================================================

const VERSION = "__SW_VERSION__";
const CACHE_NAME = `foe-optimizer-${VERSION}`;

// Risorse da pre-cachare all'installazione. L'app e' single-file, quindi la root
// "/" (index.html) e' il pezzo fondamentale; gli altri sono asset statici leggeri.
const PRECACHE_URLS = [
  "/",
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
// Gestiamo solo richieste GET same-origin. Tutto il resto (POST, cross-origin
// come le chiamate a Google Sheets della pipeline, ecc.) passa direttamente in
// rete senza intercettazione.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigazioni (richiesta di un documento HTML): STALE-WHILE-REVALIDATE.
  // Serviamo subito la cache (istantaneo), e in parallelo aggiorniamo la cache
  // con la versione di rete per la prossima volta.
  //
  // IMPORTANTE: la chiave di cache usata e' l'URL RICHIESTO (request), non
  // sempre "/". L'app e' single-file quindi la root "/" resta il caso
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
        // Altrimenti (prima visita) aspettiamo la rete.
        return cached || (await networkFetch) || cache.match(request);
      })()
    );
    return;
  }

  // Altri asset same-origin (icone, manifest): CACHE-FIRST con fallback rete.
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

// ── MESSAGE ──────────────────────────────────────────────────────────────────
// La pagina puo' chiedere al SW in attesa di attivarsi immediatamente (quando
// l'utente clicca "ricarica" sull'avviso di aggiornamento).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
