// ─────────────────────────────────────────────────────────────────────────────
//  avvio.tsx — Render dell'app, importato da main.tsx DOPO il caricamento dei
//  dati di gioco (vedi data/datiGioco.ts). Tutto ciò che dipende dai dati
//  (App, ere, edifici…) entra da qui.
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerServiceWorker } from "./registerSW";

export function avvia(): void {
  const root = document.getElementById("root")!;
  root.replaceChildren(); // via la schermata di caricamento di index.html
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  // Cache per l'uso offline e aggiornamenti (solo in produzione, no-op in dev).
  // Vedi src/registerSW.ts e sw-template.js.
  registerServiceWorker();
}
