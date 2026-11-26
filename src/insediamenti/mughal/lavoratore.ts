/**
 * Worker dell'ottimizzatore dei Mughal (25/11/2026): riceve una RichiestaOttimizzatore (con
 * le sue posizioni dell'Ambasciata), manda i tentativi man mano e alla fine.
 */
import { ottimizza, type RichiestaOttimizzatore } from "./ottimizzatore";

self.onmessage = (e: MessageEvent<RichiestaOttimizzatore>) => {
  let ultimo = 0;
  const tentativi = ottimizza(e.data, (t) => {
    const ora = Date.now();
    if (ora - ultimo < 400) return;   // al massimo 2-3 aggiornamenti al secondo
    ultimo = ora;
    self.postMessage({ tipo: "progresso", tentativi: t });
  });
  self.postMessage({ tipo: "fine", tentativi });
};
