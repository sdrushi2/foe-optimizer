// Parsing di ages.csv: avviene UNA VOLTA SOLA, come prima cosa al lancio del tool.
// Determina l'era massima (id più alto) usata come FALLBACK_ERA in tutta l'app.
import "./data/ages";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { registerServiceWorker } from "./registerSW";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Cache-first per caricamento istantaneo sulle visite ripetute + supporto offline.
// Solo in produzione (no-op in dev). Vedi src/registerSW.ts e sw-template.js.
registerServiceWorker();
