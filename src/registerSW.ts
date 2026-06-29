// =============================================================================
// Registrazione del Service Worker + gestione "nuova versione disponibile".
// =============================================================================
// Il SW vero e proprio (public/sw.js, generato dal plugin Vite con la versione
// iniettata) usa una strategia cache-first: l'app si apre istantaneamente dalla
// cache e in background controlla se c'e' un aggiornamento. Quando il nuovo SW e'
// pronto ("installed" + c'e' gia' un controller attivo), mostriamo un avviso non
// invasivo che invita a ricaricare per avere l'ultima versione.
//
// In dev (import.meta.env.DEV) NON registriamo il SW: complica il refresh durante
// lo sviluppo e non serve. Si attiva solo nel build di produzione.
// =============================================================================

function showUpdateToast(onReload: () => void): void {
  // Evita duplicati se chiamato piu' volte.
  if (document.getElementById("sw-update-toast")) return;

  const toast = document.createElement("div");
  toast.id = "sw-update-toast";
  toast.setAttribute("role", "status");
  toast.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:9999",
    "display:flex",
    "align-items:center",
    "gap:12px",
    "padding:10px 16px",
    "border-radius:10px",
    "background:#1a1a2e",
    "color:#f1f5f9",
    "border:1px solid #f59e0b",
    "box-shadow:0 4px 20px rgba(0,0,0,0.4)",
    "font:600 13px/1.3 system-ui,sans-serif",
    "max-width:calc(100vw - 32px)",
  ].join(";");

  const text = document.createElement("span");
  text.textContent = "Nuova versione disponibile";

  const reloadBtn = document.createElement("button");
  reloadBtn.textContent = "Ricarica";
  reloadBtn.style.cssText = [
    "cursor:pointer",
    "border:none",
    "border-radius:6px",
    "padding:5px 12px",
    "background:#f59e0b",
    "color:#1a1a2e",
    "font:700 13px system-ui,sans-serif",
  ].join(";");
  reloadBtn.addEventListener("click", onReload);

  const dismissBtn = document.createElement("button");
  dismissBtn.setAttribute("aria-label", "Ignora");
  dismissBtn.textContent = "\u2715";
  dismissBtn.style.cssText = [
    "cursor:pointer",
    "border:none",
    "background:transparent",
    "color:#94a3b8",
    "font:700 14px system-ui,sans-serif",
    "padding:2px 4px",
  ].join(";");
  dismissBtn.addEventListener("click", () => toast.remove());

  toast.append(text, reloadBtn, dismissBtn);
  document.body.appendChild(toast);
}

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Quando viene trovato un nuovo SW, ne seguiamo l'installazione.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            // "installed" + esiste gia' un controller = e' un AGGIORNAMENTO
            // (non la prima installazione). Mostriamo l'avviso.
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast(() => {
                // Chiediamo al nuovo SW di attivarsi subito, poi ricarichiamo.
                newWorker.postMessage("SKIP_WAITING");
              });
            }
          });
        });
      })
      .catch(() => {
        // Registrazione fallita: l'app funziona comunque senza SW.
      });

    // Quando il nuovo SW prende il controllo (dopo SKIP_WAITING), ricarichiamo
    // una volta sola per servire la nuova versione.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
