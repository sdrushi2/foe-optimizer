/**
 * Worker dell'ottimizzatore della diplomazia dei Mughal (28/11/2026): riceve una
 * RichiestaDiplomazia (con le sue posizioni dell'Ambasciata), manda i tentativi man mano e alla fine.
 */
import { ottimizzaDiplomazia, type RichiestaDiplomazia } from "./diplomazia";

self.onmessage = (e: MessageEvent<RichiestaDiplomazia>) => {
  let ultimo = 0;
  const tentativi = ottimizzaDiplomazia(e.data, (t) => {
    const ora = Date.now();
    if (ora - ultimo < 400) return;
    ultimo = ora;
    self.postMessage({ tipo: "progresso", tentativi: t });
  });
  self.postMessage({ tipo: "fine", tentativi });
};
