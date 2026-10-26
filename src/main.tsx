// ─────────────────────────────────────────────────────────────────────────────
//  main.tsx — Avvio di FoE Optimizer 2.0
//
//  1. tema salvato (niente lampo di colore);
//  2. scarica i dati di gioco da /data/ (data/datiGioco.ts) mentre resta
//     visibile la schermata di caricamento di index.html;
//  3. SOLO ALLORA importa il resto dell'app (avvio.tsx): i moduli che
//     analizzano i dati al caricamento li trovano già pronti.
//  Qui si importano staticamente solo moduli che NON dipendono dai dati.
// ─────────────────────────────────────────────────────────────────────────────

import "./index.css";
import { applicaTemaSalvato } from "./ui/theme";
import { caricaDatiGioco } from "./data/datiGioco";

applicaTemaSalvato();

// Un pezzo di codice caricato a richiesta (es. il Planner) non si trova più:
// è uscita una nuova versione e i file vecchi sono stati sostituiti. Si
// ricarica la pagina (una volta sola ogni 10 s, per non entrare in un ciclo).
window.addEventListener("vite:preloadError", (e) => {
  try {
    const ultimo = Number(sessionStorage.getItem("foe2-ricarica") ?? 0);
    if (Date.now() - ultimo < 10_000) return;
    sessionStorage.setItem("foe2-ricarica", String(Date.now()));
  } catch { /* storage non disponibile: si ricarica comunque */ }
  e.preventDefault();
  window.location.reload();
});

/** Errore di avvio (dati non scaricabili o non validi): messaggio + Riprova. */
function mostraErrore(err: unknown): void {
  const it = navigator.language?.toLowerCase().startsWith("it");
  const root = document.getElementById("root")!;
  root.replaceChildren();
  const box = document.createElement("div");
  box.className = "avvio";
  const titolo = document.createElement("p");
  titolo.className = "avvio-errore";
  titolo.textContent = it ? "Impossibile caricare i dati del tool." : "Unable to load the tool data.";
  const dettaglio = document.createElement("p");
  dettaglio.className = "avvio-dettaglio";
  dettaglio.textContent = String(err instanceof Error ? err.message : err);
  const riprova = document.createElement("button");
  riprova.type = "button";
  riprova.textContent = it ? "Riprova" : "Retry";
  riprova.onclick = () => window.location.reload();
  box.append(titolo, dettaglio, riprova);
  root.append(box);
  console.error(err);
}

caricaDatiGioco()
  .then(() => import("./avvio"))
  .then(({ avvia }) => avvia())
  .catch(mostraErrore);
