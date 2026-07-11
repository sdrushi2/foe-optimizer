// =============================================================================
// Registrazione del Service Worker + avviso "nuova versione" con reload automatico.
// =============================================================================
// Il SW vero e proprio (dist/sw.js, generato dal plugin Vite con la versione
// iniettata) usa una strategia cache-first: l'app si apre istantaneamente dalla
// cache e in background controlla se c'e' un aggiornamento. Il SW chiama
// skipWaiting() da solo all'install (vedi sw-template.js), quindi il nuovo SW
// si attiva subito: qui mostriamo solo un avviso informativo (nessun pulsante,
// scelta esplicita dell'utente) e, quando il nuovo SW prende il controllo
// (controllerchange), ricarichiamo automaticamente dopo un breve ritardo che
// lascia il tempo di leggere l'avviso.
//
// In dev (import.meta.env.DEV) NON registriamo il SW: complica il refresh durante
// lo sviluppo e non serve. Si attiva solo nel build di produzione.
// =============================================================================

import { t, type UiLang } from "./data/ui-strings";
import { UI_LANG_KEY } from "./utils/storage";

/** Lingua GUI per l'avviso: questo modulo vive fuori da React, quindi legge
 *  direttamente la scelta persistita (stessa chiave usata da App.tsx) con lo
 *  stesso fallback sulla lingua del browser di detectBrowserUiLang. */
function toastLang(): UiLang {
  try {
    const stored = localStorage.getItem(UI_LANG_KEY);
    if (stored === "it" || stored === "en") return stored;
  } catch { /* localStorage inaccessibile: si usa il fallback browser */ }
  return navigator.language?.toLowerCase().startsWith("it") ? "it" : "en";
}

/** Avviso puramente informativo (niente pulsanti): il reload e' automatico,
 *  questo serve solo a spiegare il refresh imminente invece di lasciarlo
 *  sembrare un glitch. */
function showUpdateNotice(): void {
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
    "padding:10px 16px",
    "border-radius:10px",
    "background:#1a1a2e",
    "color:#f1f5f9",
    "border:1px solid #f59e0b",
    "box-shadow:0 4px 20px rgba(0,0,0,0.4)",
    "font:600 13px/1.3 system-ui,sans-serif",
    "max-width:calc(100vw - 32px)",
  ].join(";");
  toast.textContent = t("swUpdateAvailable", toastLang());
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
            // (non la prima installazione). Mostriamo l'avviso; il nuovo SW
            // si attivera' da solo (skipWaiting nel SW) e il reload scattera'
            // al controllerchange qui sotto.
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateNotice();
            }
          });
        });
      })
      .catch(() => {
        // Registrazione fallita: l'app funziona comunque senza SW.
      });

    // Quando il nuovo SW prende il controllo, ricarichiamo una volta sola per
    // servire la nuova versione. Il piccolo ritardo lascia visibile l'avviso
    // (che nel frattempo viene mostrato anche qui, nel caso il controllerchange
    // arrivi prima dello statechange "installed").
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      showUpdateNotice();
      setTimeout(() => window.location.reload(), 1200);
    });
  });
}
