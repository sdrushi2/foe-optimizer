// ─────────────────────────────────────────────────────────────────────────────
//  Calcolatore dei GE (novembre 2026): posti mecenate di ogni livello.
//  Codice comune alle due pagine: /ge/ (italiano) e /gb/ (inglese); la lingua
//  è quella di <html lang>, il cambio lingua passa all'altra pagina.
//  Dati: ../data/mecenati-dati.js (RECUPERO DATI/gecosti.py: costi per livello
//  dalla wiki ufficiale, wiki_ge.json, nomi it/en e tier dai MainParser via ge.json).
//  Regole: quota mecenati per fascia di livello, divisione fra i posti (5 Rame,
//  7 per i GE Oro dal livello 101), montepremi NON arrotondato prima della
//  divisione (come il gioco e FoE Helper), da versare = ricompensa × (1 + %).
//  (09/11/2026) PF versati dal proprietario e PF già messi da altri giocatori ("Esterni"):
//  posti già presi, pericoli e PF mancanti con lo stesso calcolo di FoE Helper.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";
  const LINGUA = document.documentElement.lang === "en" ? "en" : "it";

  const T = {
    it: {
      titolo: "Calcolatore GE", torna: "← Torna al tool", tornaBreve: "← Tool",
      aiutoLiv: "Selezionare il livello NUOVO (quello a destra) NON il livello attuale",
      ge: "Grande Edificio", livello: "Livello in costruzione", livMeno: "Livello precedente", livPiu: "Livello successivo", livMeno10: "10 livelli indietro", livPiu10: "10 livelli avanti",
      rame: "RAME", oro: "ORO", chatRame: "CHAT RAME", chatOro: "CHAT ORO", custom: "CUSTOM", customAl: "Percentuale personalizzata", customEs: "92",
      customT: "Chat personalizzata: scrivi la percentuale che vuoi (es. 92% per il Rame, 29% per l'Oro)",
      pfLivello: "PF del livello", pfProp: "PF proprietario", pfContr: "Contribuzioni",
      pfPropT: "PF che restano a carico del proprietario per completare il livello",
      pfContrT: "PF versati in tutto dai mecenati dei posti (con la percentuale della chat)",
      pos: "Pos.", ricompensa: "Premio", versare: "Da versare", coprire: "Per coprire", totale: "Tot. x coprire",
      ricompensaT: "Premio del posto in PF (come la colonna Premio del gioco), senza bonus dell'Arc",
      versareT: "PF che il mecenate versa per riavere esattamente la ricompensa con la sua percentuale",
      coprireT: "PF del proprietario in più per assicurare questo posto, oltre ai precedenti",
      totaleT: "PF del proprietario in totale per assicurare questo posto (e tutti quelli sopra)",
      sicuro: "sicuro", pieno: "pieno", preso: "preso",
      versati: "PF già versati dal proprietario", versatiT: "PF che hai messo tu in questo livello: contano per assicurare i posti",
      azzeraT: "Cancella i PF del proprietario e degli esterni",
      esterni: "Esterni", esterniT: "PF già messi da altri giocatori, uno per casella in qualunque ordine: come nella classifica del gioco, il più alto è il primo",
      esterniAl: n => "PF già versati da un altro giocatore (" + n + ")",
      sceltaAl: n => "Metti il posto " + n + " nel testo da copiare",
      sceltaT: "Spunta i posti da mettere nel testo da copiare. Nessuno spuntato: tutti",
      mancanti: "PF mancanti", mancantiT: "PF che mancano per completare il livello (costo − PF versati dal proprietario e dagli altri)",
      esternoT: "Posto già di chi ha versato questi PF: tra parentesi la differenza con quanto si paga il posto",
      chiudeT: "Questo versamento chiude il livello: basta il resto",
      pericolo: v => "pericolo (" + v + ")", pericoloT: "Il premio vale più della metà dei PF che mancano: un altro giocatore può prendersi il posto versando meno del prezzo (tra parentesi quanti PF in meno). Conviene che il mecenate versi subito",
      fuori: v => "Spinti fuori dai posti: " + v, finale: v => "PF finali del proprietario per chiudere il livello: " + v,
      // (23/11/2026) mondi e GE preferiti
      prefT: "I tuoi mondi e i loro Grandi Edifici: tocca per scegliere", mondo1: "Mondo 1", nGe: n => n + " GE",
      prefNuovo: "Nuovo mondo",
      stellaAgg: (g, l, m) => "Salva " + g + " al livello " + l + " fra i GE di " + m,
      stellaAggiorna: (g, l, v) => "Salva " + g + " al livello " + l + " (salvato: " + v + ")",
      stellaTogli: (g, m) => g + " è salvato fra i GE di " + m + ": tocca per toglierlo",
      prefNome: "Nome del mondo (per esempio la lettera del server o il nome della gilda)",
      prefRinomina: "Rinomina mondo", prefElimina: "Elimina mondo", prefElConf: n => "Eliminare il mondo \"" + n + "\" e la sua lista di GE?",
      prefVuoto: "Nessun GE in questo mondo: scegli GE e livello qui sotto e tocca la stella ☆ accanto al livello.",
      testoAl: "Testo da copiare in chat (si può modificare prima di copiarlo)", nome: "Il tuo nome (facoltativo)", nomeAl: "Il tuo nome nel gioco",
      nomeGeAl: "Nome del Grande Edificio nel testo da copiare (si può cambiare)",
      copia: "Copia", copiato: "Copiato",
      errore: "Non riesco a caricare i dati dei Grandi Edifici (data/mecenati-dati.js). Ricarica la pagina.",
      fonte: ["Valori della ", "wiki ufficiale", " di Forge of Empires (aggiornati al ", ")."],
      disclaimer: "Forge of Empires è un marchio di InnoGames GmbH. FoE Optimizer è un progetto amatoriale indipendente, non affiliato a InnoGames.",
    },
    en: {
      titolo: "GB Calculator", torna: "← Back to the tool", tornaBreve: "← Tool",
      aiutoLiv: "Select the NEW level (the one on the right) NOT the current level",
      ge: "Great Building", livello: "Level being built", livMeno: "Previous level", livPiu: "Next level", livMeno10: "10 levels back", livPiu10: "10 levels forward",
      rame: "COPPER", oro: "GOLD", chatRame: "COPPER CHAT", chatOro: "GOLD CHAT", custom: "CUSTOM", customAl: "Custom percentage", customEs: "92",
      customT: "Custom chat: type any percentage (e.g. 92% for Copper, 29% for Gold)",
      pfLivello: "Level FP", pfProp: "Owner FP", pfContr: "Contributions",
      pfPropT: "FP left to the owner to complete the level",
      pfContrT: "FP paid in total by the patrons of the spots (with the chat percentage)",
      pos: "Pos.", ricompensa: "Reward", versare: "To pay", coprire: "To secure", totale: "Tot. to secure",
      ricompensaT: "FP reward of the spot, without the Arc bonus",
      versareT: "FP the patron pays to get back exactly the reward with their percentage",
      coprireT: "Extra owner FP to secure this spot, on top of the previous ones",
      totaleT: "Total owner FP to secure this spot (and all the ones above)",
      sicuro: "safe", pieno: "full", preso: "taken",
      versati: "FP already paid by the owner", versatiT: "FP you already put into this level: they count to secure the spots",
      azzeraT: "Clear the owner's and external FP",
      esterni: "External", esterniT: "FP already put by other players, one per box in any order: as in the game ranking, the highest is first",
      esterniAl: n => "FP already put by another player (" + n + ")",
      sceltaAl: n => "Put spot " + n + " in the text to copy",
      sceltaT: "Tick the spots to put in the text to copy. None ticked: all of them",
      mancanti: "Missing FP", mancantiT: "FP still missing to complete the level (cost − FP paid by the owner and by others)",
      esternoT: "Spot already held by whoever put these FP: in brackets the difference with the spot price",
      chiudeT: "This payment closes the level: the rest is enough",
      pericolo: v => "danger (" + v + ")", pericoloT: "The reward is worth more than half of the missing FP: another player can take the spot paying less than the price (in brackets how many FP less). The patron should pay right away",
      fuori: v => "Pushed out of the spots: " + v, finale: v => "Owner's final FP to close the level: " + v,
      // (23/11/2026) worlds and favourite GBs
      prefT: "Your worlds and their Great Buildings: tap to choose", mondo1: "World 1", nGe: n => n + " GB",
      prefNuovo: "New world",
      stellaAgg: (g, l, m) => "Save " + g + " at level " + l + " in the GBs of " + m,
      stellaAggiorna: (g, l, v) => "Save " + g + " at level " + l + " (saved: " + v + ")",
      stellaTogli: (g, m) => g + " is saved in the GBs of " + m + ": tap to remove it",
      prefNome: "World name (for example the server letter or your guild's name)",
      prefRinomina: "Rename world", prefElimina: "Delete world", prefElConf: n => "Delete the world \"" + n + "\" and its GB list?",
      prefVuoto: "No GB in this world yet: pick GB and level below and tap the star ☆ next to the level.",
      testoAl: "Text to copy into chat (you can edit it before copying)", nome: "Your name (optional)", nomeAl: "Your in-game name",
      nomeGeAl: "Great Building name in the text to copy (you can change it)",
      copia: "Copy", copiato: "Copied",
      errore: "Couldn't load the Great Building data (data/mecenati-dati.js). Reload the page.",
      fonte: ["Values from the ", "official Forge of Empires wiki", " (updated ", ")."],
      disclaimer: "Forge of Empires is a trademark of InnoGames GmbH. FoE Optimizer is an independent fan project, not affiliated with InnoGames.",
    },
  }[LINGUA];

  // Quota dei mecenati sul costo del livello: [ultimo livello della fascia, quota]
  // (in punti percentuali: vedi calcola() per l'ordine dei conti)
  const FASCE = [[9, 25], [39, 30], [69, 40], [100, 25], [200, 15], [300, 10], [400, 7], [500, 5]];
  // Divisione dei premi fra i posti (Rame 5 posti, Oro 7 posti): pesi n!/k!, il posto k vale 1/k! del primo
  const PESI = { 5: [120, 60, 20, 5, 1], 7: [5040, 2520, 840, 210, 42, 7, 1] };
  const SOMMA_PESI = { 5: 206, 7: 8660 };
  // arrotondamento con tolleranza per gli errori dei decimali (come FoE Helper e Forge Hammer):
  // 30 × 2,05 fa 61,4999… in JavaScript, il gioco dà 62
  const arrotonda = v => Math.round(v + (v >= 0 ? 1e-6 : -1e-6));
  const CHIAVE = "foe-optimizer-calcolatore-ge";   // (stesso stato per /ge e /gb)
  const CHAT = { r90: 90, r95: 95, r100: 100, o20: 20, o25: 25, o50: 50 };   // (o50: 23/11/2026)
  // pericolo segnalato solo oltre questi PF (stessa soglia di FoE Helper)
  const PERICOLO_MIN = 5;
  // barra del gioco: larghezza della barra in % dell'immagine (come .bg-fill / .bg-testo in calcolatore.css)
  const LARGH_BARRA = 82.78;
  const $ = id => document.getElementById(id);
  // migliaia sempre separate (anche a 4 cifre): punto in italiano, virgola in inglese
  // eslint-disable-next-line security/detect-unsafe-regex -- (separatore delle migliaia su numeri brevi: nessun rischio)
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, LINGUA === "en" ? "," : ".");
  const numero = (v, d = 0) => { const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) && x >= 0 ? x : d; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // link all'altra lingua: dal disco (file://) serve index.html esplicito
  const pagina = l => (location.protocol === "file:" ? "../" + l + "/index.html" : "/" + l + "/");

  // ── pagina ──
  const chat = (id, classe, breve, lungo) => `<button type="button" class="${classe}" data-chat="${id}" title="${esc(lungo)}">${esc(breve)}</button>`;
  // (20/11/2026) il calcolatore va IN TESTA al body, senza sostituirlo: sotto c'è la sezione
  // #info scritta nell'HTML (titolo, spiegazione, domande frequenti) che Google deve vedere
  // anche dopo aver eseguito lo script; viene spostata dentro <main>, prima del piè di pagina
  document.body.insertAdjacentHTML("afterbegin", `
    <header id="bar">
      <a class="brand" href="/" title="FoE Optimizer">
        <div class="logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m13 19 6-6"/><path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5"/>
            <path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586"/>
            <path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="m5 14 4 4"/><path d="m5 21-2-2"/><path d="M7.5 16.5 4 20"/>
          </svg>
        </div>
        <span class="titolo">${esc(T.titolo)}</span>
      </a>
      <nav class="lingue" aria-label="Lingua / Language">
        <a href="${pagina("ge")}" hreflang="it" lang="it" class="${LINGUA === "it" ? "attiva" : ""}">IT</a><span>/</span>
        <a href="${pagina("gb")}" hreflang="en" lang="en" class="${LINGUA === "en" ? "attiva" : ""}">EN</a>
      </nav>
      <a class="btn" id="torna" href="/" title="${esc(T.torna.replace("← ", ""))}"><span class="lungo">${esc(T.torna)}</span><span class="breve">${esc(T.tornaBreve)}</span></a>
    </header>
    <main class="wrap">
      <p id="errore" hidden></p>
      <div class="card">
        <!-- (23/11/2026) mondi e GE preferiti: una riga chiusa, il pannello si apre al tocco -->
        <div class="pref" id="pref">
          <button type="button" id="prefApri" class="pref-sommario" aria-expanded="false" aria-controls="prefPannello" title="${esc(T.prefT)}"></button>
          <div id="prefPannello" class="pref-pannello" hidden>
            <div class="pref-mondi" id="prefMondi"></div>
            <div class="pref-griglia" id="prefGriglia"></div>
            <div class="pref-azioni">
              <button type="button" id="prefRinomina">${esc(T.prefRinomina)}</button>
              <button type="button" id="prefElimina">${esc(T.prefElimina)}</button>
            </div>
          </div>
        </div>
        <div class="riga">
          <select id="ge" aria-label="${esc(T.ge)}"></select>
          <!-- (frecce del gioco: ±1 e ±10 livelli) -->
          <div class="liv" title="${esc(T.livello)}">
            <!-- (23/11/2026, utente) stella: salva GE e livello fra i GE del mondo attivo -->
            <button type="button" id="prefStella" class="stella-liv" aria-pressed="false"></button>
            <button type="button" class="fr doppia" data-passo="-10" title="${esc(T.livMeno10)}" aria-label="${esc(T.livMeno10)}"></button>
            <button type="button" class="fr singola" data-passo="-1" title="${esc(T.livMeno)}" aria-label="${esc(T.livMeno)}"></button>
            <input id="livello" type="text" inputmode="numeric" maxlength="3" autocomplete="off" aria-label="${esc(T.livello)}">
            <button type="button" class="fr singola dx" data-passo="1" title="${esc(T.livPiu)}" aria-label="${esc(T.livPiu)}"></button>
            <button type="button" class="fr doppia dx" data-passo="10" title="${esc(T.livPiu10)}" aria-label="${esc(T.livPiu10)}"></button>
          </div>
        </div>
        <!-- (11/11/2026, utente) quale livello inserire: la barra di avanzamento della finestra del GE
             (grafica ritagliata dal gioco, scritte tolte), con i PF versati, il livello attuale a
             sinistra e quello da fare a destra, evidenziato; c'è sia da PC sia da cellulare -->
        <div class="aiuto-liv">
          <div class="barra-ge" aria-hidden="true">
            <div class="bg-fill" id="bgFill"></div>
            <div class="bg-testo" id="bgTesto"></div>
            <span class="bg-liv sx" id="livDa"></span>
            <span class="bg-evid"></span>
            <span class="bg-liv dx" id="livA"></span>
          </div>
          <div class="nota-liv">${esc(T.aiutoLiv)}</div>
        </div>
        <div class="chat" id="chat">
          ${chat("r90", "rame", T.rame + " 90%", T.chatRame + " 90%")}
          ${chat("r95", "rame", T.rame + " 95%", T.chatRame + " 95%")}
          ${chat("r100", "rame", T.rame + " 100%", T.chatRame + " 100%")}
          ${chat("o20", "oro", T.oro + " 20%", T.chatOro + " 20%")}
          ${chat("o25", "oro", T.oro + " 25%", T.chatOro + " 25%")}
          ${chat("o50", "oro", T.oro + " 50%", T.chatOro + " 50%")}
          <span class="custom" id="customBox" title="${esc(T.customT)}">
            <button type="button" data-chat="custom">${esc(T.custom)}</button>
            <input id="custom" inputmode="decimal" aria-label="${esc(T.customAl)}" placeholder="${esc(T.customEs)}"><span>%</span>
          </span>
        </div>
        <!-- (23/11/2026, utente) i 4 riepiloghi dentro il riquadro, subito sotto le chat -->
        <div class="stats">
          <div class="stat"><div class="k">${esc(T.pfLivello)}</div><div class="v" id="totale"></div></div>
          <div class="stat" title="${esc(T.pfPropT)}"><div class="k">${esc(T.pfProp)}</div><div class="v" id="proprietario"></div></div>
          <div class="stat" title="${esc(T.pfContrT)}"><div class="k">${esc(T.pfContr)}</div><div class="v" id="contribuzioni"></div></div>
          <div class="stat" title="${esc(T.mancantiT)}"><div class="k">${esc(T.mancanti)}</div><div class="v" id="mancanti"></div></div>
        </div>
      </div>
      <!-- (11/11/2026, utente) PF del proprietario: riga sua, fra i riquadri e la classifica -->
      <label class="versati" title="${esc(T.versatiT)}"><span>${esc(T.versati)}</span>
        <input id="versati" type="text" inputmode="numeric" autocomplete="off">
        <button type="button" id="azzera" class="azzera" title="${esc(T.azzeraT)}" aria-label="${esc(T.azzeraT)}">↺</button></label>
      <div class="card tabella">
        <table>
          <thead><tr>
            <th title="${esc(T.sceltaT)}">${esc(T.pos)}</th>
            <th title="${esc(T.ricompensaT)}">${esc(T.ricompensa)}</th>
            <th title="${esc(T.versareT)}">${esc(T.versare)}</th>
            <th title="${esc(T.coprireT)}">${esc(T.coprire)}</th>
            <th title="${esc(T.totaleT)}">${esc(T.totale)}</th>
            <th title="${esc(T.esterniT)}">${esc(T.esterni)}</th>
          </tr></thead>
          <tbody id="righe"></tbody>
        </table>
        <p id="note" hidden></p>
      </div>
      <div class="card copia">
        <input id="giocatore" aria-label="${esc(T.nomeAl)}" placeholder="${esc(T.nome)}">
        <input id="nomege" aria-label="${esc(T.nomeGeAl)}" title="${esc(T.nomeGeAl)}">
        <button type="button" id="copia">${esc(T.copia)}</button>
        <!-- (23/11/2026, utente) il testo sotto i campi e Copia -->
        <div id="testo" role="textbox" aria-multiline="true" aria-label="${esc(T.testoAl)}" title="${esc(T.testoAl)}" spellcheck="false"></div>
      </div>
      <footer><p id="fonte" hidden></p><p>${esc(T.disclaimer)}</p></footer>
    </main>`);
  { const info = $("info"); if (info) document.querySelector("main.wrap > footer").before(info); }

  const dati = window.MECENATI && window.MECENATI.edifici;
  if (!dati) { $("errore").hidden = false; $("errore").textContent = T.errore; return; }

  const costi = {};
  for (const id in dati) costi[id] = dati[id].costi;
  const ids = Object.keys(costi);
  // (nome: {it, en}; una stringa = file dei dati di prima, solo italiano)
  const nome = id => { const n = dati[id].nome; return (typeof n === "string" ? n : n && (n[LINGUA] || n.it || n.en)) || id; };
  const oro = id => !!dati[id].oro;
  // (23/11/2026) nome breve del GE nel testo da copiare: quello scritto dall'utente
  // (S.brevi[lingua][id]), altrimenti data/ge_abbreviazioni.csv (file statico, aggiornato
  // a mano), altrimenti il nome intero
  const breviFile = {};
  const breveBase = id => (breviFile[id] && breviFile[id][LINGUA]) || nome(id);
  const breve = id => ((S.brevi && S.brevi[LINGUA]) || {})[id] || breveBase(id);
  // chat scelta per tier (livelli Rame 5 posti, livelli Oro 7), validata in calcola()
  // versati: PF del proprietario; esterni: PF di altri giocatori per posto (azzerati cambiando GE o livello)
  const S = { ge: "X_FutureEra_Landmark1", livello: 1, custom: "", giocatore: "", chat: { rame: "r90", oro: "o20" }, versati: "", esterni: [] };
  try { Object.assign(S, JSON.parse(localStorage.getItem(CHIAVE) || "{}")); } catch { /* niente */ }
  if (!costi[S.ge]) S.ge = ids[0];
  if (!S.chat || typeof S.chat !== "object") S.chat = {}; // (salvataggio vecchio o rovinato)
  if (!Array.isArray(S.esterni)) S.esterni = [];
  if (!S.brevi || typeof S.brevi !== "object") S.brevi = {};
  // (23/11/2026) posti spuntati per il testo da copiare (nessuno = tutti); di questo GE e livello
  if (!Array.isArray(S.scelti)) S.scelti = [];
  // (09/11/2026) aperto dalla scheda Città dell'app: ?ge=<id>&livello=<livello da costruire>
  // sceglie quel GE e quel livello (PF del proprietario ed esterni ripartono da zero), con la
  // chat Rame 100% / Oro 20% (le stesse della quota "a carico tuo" del report del GE)
  try {
    const q = new URLSearchParams(location.search), qGe = q.get("ge"), qLiv = parseInt(q.get("livello") || "");
    if (qGe && costi[qGe]) {
      if (qGe !== S.ge || (qLiv && qLiv !== S.livello)) { S.versati = ""; S.esterni = []; S.scelti = []; }
      S.ge = qGe;
      if (qLiv) S.livello = qLiv;
      S.chat = { rame: "r100", oro: "o20" };
    }
  } catch { /* niente */ }
  const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch { /* niente */ } };
  const maxLiv = () => costi[S.ge].length;
  const livOk = v => Math.min(maxLiv(), Math.max(1, parseInt(v) || 1));

  ids.sort((a, b) => nome(a).localeCompare(nome(b), LINGUA));
  for (const id of ids) $("ge").add(new Option(nome(id), id));

  function calcola() {
    const lvl = livOk(S.livello), costo = costi[S.ge][lvl - 1];
    const quota = (FASCE.find(f => lvl <= f[0]) || FASCE[FASCE.length - 1])[1];
    // (7 posti dal 101, ma la chat Oro dal 102: il 101 si fa ancora a tariffa Rame perché
    // il GE è al 100, ancora Rame; utente 09/11, come il calcolatore di Linnun)
    const n = oro(S.ge) && lvl >= 101 ? 7 : 5, tier = n === 7 && lvl > 101 ? "oro" : "rame";
    // % della chat scelta per questo tier (la stessa per tutti i posti; fattore = 1 + % / 100)
    const valida = tier === "oro" ? ["o20", "o25", "o50", "custom"] : ["r90", "r95", "r100", "custom"];
    if (!valida.includes(S.chat[tier])) S.chat[tier] = tier === "oro" ? "o20" : "r90";
    const perc = S.chat[tier] === "custom" ? numero(S.custom, 0) : CHAT[S.chat[tier]];
    // (montepremi NON arrotondato prima della divisione: così fa il gioco, come
    // mostra FoE Helper, es. Osservatorio 156: posto 2 = 3.801 e non 3.802)
    // (13/11/2026) Ordine dei conti come FoE Helper: costo × quota / 100 × (peso / somma).
    // Nei pareggi esatti a ,5 cambia l'arrotondamento: prima Santa Sofia 122, Innovation
    // Tower 108 e Nave da guerra stellare 107 davano 1 PF in meno ai posti 2 e 3
    // (FoE Helper e Forge Hammer concordano); ora uguale a FoE Helper su tutti i 16.100 livelli.
    const righe = [];
    for (let i = 0; i < n; i++) {
      // (le ricompense piccole il gioco le dà pari: 1 → 2 e 3 → 4; verificato
      // sulla Galassia blu 199, posto 7 = 4 e non 3; stessa correzione di Linnun)
      let base = Math.round(costo * quota / 100 * (PESI[n][i] / SOMMA_PESI[n]));
      if (base === 1 || base === 3) base += 1;
      righe.push({ base, versa: Math.max(0, arrotonda(base * (1 + perc / 100))) });
    }
    // PF del proprietario e PF degli altri giocatori: stesso calcolo del calcolatore di
    // FoE Helper, con le sue opzioni predefinite ("sicuro" sì, "fiducia" no) (utente 09/11, Arca 85: chi ha versato 1.440 si è preso P1 anche se il posto
    // "costa" 1.844, perché i 1.287 PF che mancano al livello non bastano a superarlo).
    // I versamenti degli altri, dal più grande, sono la classifica attuale; posto per posto:
    // - se chi c'è già ha versato almeno quanto si paga il posto, o più di quanto manca al
    //   livello, il posto è suo ("esterno"); con "sicuro" il proprietario aggiunge quanto
    //   serve perché il versamento successivo non lo superi;
    // - altrimenti il posto va a un mecenate: il proprietario mette prima (per coprire)
    //   quanto serve perché nessuno possa superarlo; se il margine è negativo il posto è in
    //   pericolo (della metà del margine); un mecenate che chiude il livello paga solo il resto.
    const versati = Math.min(costo, Math.round(numero(S.versati)));
    const M = S.esterni.slice(0, 7).map(v => Math.round(numero(v))).filter(v => v > 0).sort((x, y) => y - x);
    const totEsterni = M.reduce((s, v) => s + v, 0);
    let resto = Math.max(0, costo - versati - totEsterni);
    const mancanti = resto;
    let propri = versati;
    righe.forEach((r, i) => {
      const m = M[i] || 0;
      if (m > 0 && (r.versa <= m || resto <= m)) {
        // posto già preso da chi ha versato m
        const eig = Math.max(0, Math.ceil(resto + (M[i + 1] || 0) - m));
        resto -= eig;
        Object.assign(r, { stato: "esterno", esterno: m, assicura: eig, tuoi: (propri += eig) });
        return;
      }
      // (posto senza ricompensa, ai livelli bassi: nessuno ci versa)
      if (r.versa <= 0) { Object.assign(r, { stato: "libero", paga: 0, chiude: false, pericolo: 0, assicura: 0, tuoi: propri }); return; }
      if (resto <= 0) { Object.assign(r, { stato: "pieno", assicura: 0, tuoi: propri }); return; }
      let eig = Math.ceil(resto + m - 2 * r.versa), pericolo = 0;
      if (eig < 0) { pericolo = Math.floor(-eig / 2); eig = 0; }
      M.splice(i, 0, r.versa); // il mecenate entra qui, chi c'era scende di un posto
      let paga = r.versa, chiude = false;
      if (paga >= resto - eig) { chiude = true; if (pericolo > 0) pericolo = Math.max(0, pericolo - (paga - (resto - eig))); paga = resto - eig; M[i] = paga; }
      resto -= eig + paga;
      Object.assign(r, { stato: "libero", paga, chiude, pericolo, assicura: eig, tuoi: (propri += eig) });
    });
    // quello che resta dopo l'ultimo posto lo mette il proprietario
    const finale = Math.max(0, resto);
    propri += finale;
    // versamenti degli altri spinti fuori dai posti (es. "#6")
    const fuori = M.slice(n).filter(v => v > 0);
    return { costo, n, tier, righe, mancanti, finale, fuori, proprietario: Math.min(costo, propri), contribuzioni: Math.max(0, costo - propri) };
  }

  // righe della tabella (7, le ultime 2 nascoste nel tier Rame)
  const corpo = $("righe");
  for (let i = 0; i < 7; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="pos"><label title="' + esc(T.sceltaT) + '"><input type="checkbox" class="scelta" aria-label="' + esc(T.sceltaAl(i + 1)) + '">' + (i + 1) + '</label></td><td class="b"></td><td class="c"></td><td class="a"></td><td class="t"></td>'
      + '<td class="x"><input type="text" inputmode="numeric" autocomplete="off" aria-label="' + esc(T.esterniAl(i + 1)) + '"></td>';
    const x = tr.querySelector("td.x input"), sc = tr.querySelector("input.scelta");
    sc.checked = !!S.scelti[i];
    sc.addEventListener("change", () => { S.scelti[i] = sc.checked; mostra(); });
    x.value = S.esterni[i] || "";
    x.addEventListener("input", () => { S.esterni[i] = x.value.replace(/\D/g, ""); if (x.value !== S.esterni[i]) x.value = S.esterni[i]; mostra(); });
    corpo.append(tr);
  }

  let testoGenerato = null;
  {
    // testo da copiare modificabile: solo testo semplice (dove il browser non conosce
    // "plaintext-only", modificabile normale)
    const el = $("testo");
    try { el.contentEditable = "plaintext-only"; } catch { el.contentEditable = "true"; }
    if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
  }
  function mostra() {
    const r = calcola();
    // chat Rame solo per i livelli Rame, chat Oro solo per quelli Oro (CUSTOM sempre)
    document.querySelectorAll("#chat button").forEach(b => {
      b.disabled = r.tier === "oro" ? b.classList.contains("rame") : b.classList.contains("oro");
      const attivo = b.dataset.chat === S.chat[r.tier];
      b.classList.toggle("attivo", attivo);
      b.setAttribute("aria-pressed", String(attivo));
    });
    $("customBox").classList.toggle("attivo", S.chat[r.tier] === "custom");
    $("totale").textContent = fmt(r.costo);
    { const l = livOk(S.livello), w = LINGUA === "en" ? "Level" : "Livello";
      $("livDa").textContent = `${w} ${l - 1}`; $("livA").textContent = `${w} ${l}`;
      const fatti = Math.max(0, r.costo - r.mancanti);
      $("bgFill").style.width = `${r.costo > 0 ? Math.min(1, fatti / r.costo) * LARGH_BARRA : 0}%`;
      $("bgTesto").textContent = `${fmt(fatti)}/${fmt(r.costo)}`;
      document.querySelectorAll(".liv .fr").forEach(b => { b.disabled = Number(b.dataset.passo) < 0 ? l <= 1 : l >= maxLiv(); }); }
    $("contribuzioni").textContent = fmt(r.contribuzioni);
    $("proprietario").textContent = fmt(r.proprietario);
    $("mancanti").textContent = fmt(r.mancanti);
    [...corpo.children].forEach((tr, i) => {
      tr.hidden = i >= r.n;
      if (i >= r.n) return;
      const o = r.righe[i];
      tr.className = o.stato === "esterno" ? "preso" : o.base > 0 ? "" : "vuoto";
      tr.querySelector(".b").textContent = fmt(o.base);
      const c = tr.querySelector(".c"), a = tr.querySelector(".a"), t = tr.querySelector(".t");
      a.className = "a"; c.title = a.title = "";
      if (o.stato === "esterno") {
        // chi c'è già: quanto ha versato e la differenza col prezzo del posto
        const d = o.esterno - o.versa;
        c.innerHTML = '<span class="esterno">' + fmt(o.esterno) + '</span> <small class="' + (d < 0 ? "meno" : "piu") + '">(' + (d < 0 ? "−" + fmt(-d) : "+" + fmt(d)) + ")</small>";
        c.title = T.esternoT;
        if (o.assicura) a.textContent = fmt(o.assicura); else a.innerHTML = '<span class="preso">' + esc(T.preso) + "</span>";
        t.textContent = fmt(o.tuoi);
      } else if (o.stato === "pieno") {
        c.textContent = fmt(o.versa);
        a.innerHTML = t.innerHTML = '<span class="pieno">' + esc(T.pieno) + "</span>";
      } else {
        c.textContent = fmt(o.paga);
        if (o.chiude) { c.title = T.chiudeT; c.classList.add("chiude"); } else c.classList.remove("chiude");
        if (o.assicura) a.textContent = fmt(o.assicura);
        // (come FoE Helper: un pericolo di 5 PF o meno non si segnala, utente 11/11 — "pericolo (1)" senza versamenti)
        else if (o.pericolo > PERICOLO_MIN) { a.innerHTML = '<span class="pericolo">' + esc(T.pericolo(fmt(o.pericolo))) + "</span>"; a.title = T.pericoloT; }
        else { a.textContent = T.sicuro; a.classList.add("sicuro"); }
        t.textContent = fmt(o.tuoi);
      }
    });
    // versamenti spinti fuori dai posti e PF finali del proprietario, sotto la tabella
    // (i numeri in bianco, utente 11/11; esc: testo dentro innerHTML)
    const num = v => `<b class="num">${esc(v)}</b>`;
    $("note").innerHTML = [r.fuori.length ? esc(T.fuori("\u0000")).replace("\u0000", r.fuori.map(v => num(fmt(v))).join(", ")) : "", r.finale ? esc(T.finale("\u0000")).replace("\u0000", num(fmt(r.finale))) : ""].filter(Boolean).join(" · ");
    $("note").hidden = !$("note").textContent;
    // testo per la chat, dall'ultimo posto al primo: "Nome GE: P7(3) P6(6) … P1(4275)"
    const parti = [];
    // (solo i posti che vanno ai mecenati, con quanto versare; quelli già presi no)
    // (23/11/2026) con dei posti spuntati solo quelli; nessuno spuntato = tutti. Si
    // spuntano solo i posti che vanno nel testo (liberi, con qualcosa da versare)
    const nelTesto = i => r.righe[i].stato === "libero" && r.righe[i].base > 0 && r.righe[i].paga > 0;
    [...corpo.children].forEach((tr, i) => { if (i < r.n) tr.querySelector("input.scelta").disabled = !nelTesto(i); });
    const spuntati = r.righe.some((_, i) => nelTesto(i) && S.scelti[i]);
    for (let i = r.n - 1; i >= 0; i--) if (nelTesto(i) && (!spuntati || S.scelti[i])) parti.push("P" + (i + 1) + "(" + r.righe[i].paga + ")");
    const chi = String(S.giocatore || "").trim();
    // (senza ":" dopo il nome del GE, utente 11/11)
    // (23/11/2026) il testo si può modificare (non salvato): resta com'è finché il testo
    // calcolato non cambia (altro posto, GE, livello, nome…), poi riparte da quello nuovo
    const generato = (chi ? chi + " " : "") + breve(S.ge) + (parti.length ? " " + parti.join(" ") : "");
    if (generato !== testoGenerato) { testoGenerato = generato; $("testo").textContent = generato; }
    // (il campo mostra il nome in uso; mentre lo si modifica resta com'è scritto, ma
    // cambiando GE si aggiorna sempre)
    const campoGe = $("nomege");
    if (document.activeElement !== campoGe || campoGe.dataset.ge !== S.ge) { campoGe.value = breve(S.ge); campoGe.dataset.ge = S.ge; }
    $("nomege").placeholder = breveBase(S.ge);
    // fonte in calce, solo se i costi di questo GE vengono dalla wiki: link alla sua pagina
    const agg = window.MECENATI.aggiornato, fonte = $("fonte");
    fonte.hidden = !(dati[S.ge].wiki && agg);
    if (!fonte.hidden) {
      const nomeEn = (dati[S.ge].nome && dati[S.ge].nome.en) || nome(S.ge);
      const url = "https://en.wiki.forgeofempires.com/index.php?title=" + encodeURIComponent(nomeEn.replace(/ /g, "_"));
      const data = LINGUA === "en" ? agg : agg.split("-").reverse().join("-");
      fonte.innerHTML = esc(T.fonte[0]) + '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(T.fonte[1]) + "</a>" + esc(T.fonte[2] + data + T.fonte[3]);
    }
    aggiornaPref();
    salva();
  }

  const sincronizza = () => { S.livello = livOk(S.livello); $("livello").value = S.livello; };
  // (altro GE o altro livello: PF già versati e PF degli altri si azzerano, sono di quel livello)
  const azzera = () => { S.versati = ""; S.esterni = []; S.scelti = []; $("versati").value = ""; corpo.querySelectorAll("td.x input").forEach(x => { x.value = ""; }); corpo.querySelectorAll("input.scelta").forEach(x => { x.checked = false; }); };
  // (11/11/2026, utente) pulsante di reset accanto ai PF del proprietario
  $("azzera").addEventListener("click", e => { e.preventDefault(); azzera(); mostra(); });
  const cambiaLivello = v => { const prima = livOk(S.livello); S.livello = v; if (livOk(v) !== prima) azzera(); };
  $("ge").addEventListener("change", e => { S.ge = e.target.value; azzera(); sincronizza(); mostra(); });
  // (campo di testo, niente frecce: solo cifre, al massimo 3)
  // (oltre il livello massimo del GE: subito il massimo, come mostrano barra e tabella)
  $("livello").addEventListener("input", e => { let v = e.target.value.replace(/\D/g, "").slice(0, 3); if (+v > maxLiv()) v = String(maxLiv()); if (v !== e.target.value) e.target.value = v; if (v) cambiaLivello(v); mostra(); });
  $("livello").addEventListener("change", () => { sincronizza(); mostra(); });
  document.querySelectorAll(".liv .fr").forEach(b => b.addEventListener("click", () => {
    cambiaLivello(livOk(livOk(S.livello) + Number(b.dataset.passo))); sincronizza(); mostra();
  }));
  // (11/11/2026, utente) separatore delle migliaie mentre si scrive (punto in italiano,
  // virgola in inglese); il cursore resta allo stesso punto fra le cifre
  $("versati").addEventListener("input", e => {
    const el = e.target, pos = el.selectionStart ?? el.value.length;
    const dopo = el.value.slice(pos).replace(/\D/g, "").length; // cifre a destra del cursore
    S.versati = el.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    el.value = S.versati ? fmt(S.versati) : "";
    let p = el.value.length;
    for (let n = 0; p > 0 && n < dopo; p--) if (/\d/.test(el.value[p - 1])) n++;
    el.setSelectionRange(p, p);
    mostra();
  });
  // chat: la stessa % in tutti i posti, per il tier del livello mostrato
  const applicaChat = c => { S.chat[calcola().tier] = c; mostra(); };
  document.querySelectorAll("#chat button").forEach(b => b.addEventListener("click", () => applicaChat(b.dataset.chat)));
  $("custom").addEventListener("input", e => { S.custom = e.target.value; applicaChat("custom"); });
  // (toccare la casella della % sceglie già la chat personalizzata)
  $("custom").addEventListener("focus", () => applicaChat("custom"));
  $("giocatore").addEventListener("input", e => { S.giocatore = e.target.value; mostra(); });
  // nome breve del GE: salvato per GE e per lingua; vuoto o uguale a quello del file = quello del file
  $("nomege").addEventListener("input", e => {
    const v = e.target.value.trim(), b = (S.brevi[LINGUA] = S.brevi[LINGUA] || {});
    if (v && v !== breveBase(S.ge)) b[S.ge] = v; else delete b[S.ge];
    mostra();
  });
  $("nomege").addEventListener("blur", () => mostra());
  // nomi brevi dal file (link "ge-brevi" della pagina, ?v=hash nella build); senza file restano i nomi interi
  {
    const link = document.getElementById("ge-brevi");
    if (link) fetch(link.href).then(r => (r.ok ? r.text() : "")).then(testo => {
      testo.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1).forEach(riga => {
        const [id, it, en] = riga.split(";").map(x => (x || "").trim());
        if (id && costi[id]) breviFile[id] = { it: it || en, en: en || it };
      });
      mostra();
    }).catch(() => { /* file:// o rete assente: nomi interi */ });
  }
  $("copia").addEventListener("click", async () => {
    const el = $("testo");
    try { await navigator.clipboard.writeText(el.innerText.trim()); }
    catch { // (senza https o permessi: selezione + copia classica)
      const sel = getSelection(), rng = document.createRange();
      rng.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(rng); document.execCommand("copy");
    }
    $("copia").textContent = T.copiato;
    setTimeout(() => { $("copia").textContent = T.copia; }, 1200);
  });

  // "Torna al tool": se il Calcolatore è in una scheda nuova (aperta dall'app, dall'icona
  // della Città o dal nastro), la chiude e si torna alla scheda dell'app, invece di
  // aprire il tool una seconda volta (segnalazione dell'utente, 10/11/2026). Una scheda
  // nuova ha la cronologia lunga 1 e il browser la lascia chiudere; se non la chiude
  // (pagina aperta a mano, cronologia più lunga), il link porta al tool come prima.
  // (10/11/2026, utente) Solo se l'ha aperta l'app (?da=app): aperto dalla scorciatoia
  // dell'app installata (tieni premuta l'icona › Calcolatore GE) la "scheda" è la finestra
  // dell'app stessa, con cronologia lunga 1, e window.close() chiudeva l'app.
  const apertoDallApp = new URLSearchParams(location.search).get("da") === "app";
  $("torna").addEventListener("click", e => {
    if (!apertoDallApp || history.length > 1) return;
    e.preventDefault();
    window.close();
    setTimeout(() => { location.href = "/"; }, 150);
  });

  // ── (23/11/2026) Mondi e GE preferiti ─────────────────────────────────────
  // S.mondi = [{ nome, ge: [{ id, liv }] }], S.mondo = indice del mondo attivo. Il livello
  // di un GE del mondo attivo segue il livello scelto (mostra → aggiornaPref); toccando
  // un GE del pannello il calcolatore passa a quel GE al suo livello.
  const mondi = () => {
    if (!Array.isArray(S.mondi) || !S.mondi.length) S.mondi = [{ nome: T.mondo1, ge: [] }];
    S.mondi.forEach(m => { m.nome = String(m.nome || T.mondo1).slice(0, 30); m.ge = (Array.isArray(m.ge) ? m.ge : []).filter(g => g && costi[g.id]); });
    if (!(S.mondo >= 0 && S.mondo < S.mondi.length)) S.mondo = 0;
    return S.mondi;
  };
  const mondo = () => mondi()[S.mondo];
  const apriPref = v => { $("prefPannello").hidden = !v; $("prefApri").setAttribute("aria-expanded", String(v)); };
  function aggiornaPref() {
    const m = mondo(), cur = m.ge.find(g => g.id === S.ge), lvl = livOk(S.livello);
    // (23/11/2026, utente) il livello NON si salva da solo (guardando il GE di un altro giocatore
    // al 170 si sovrascriveva il proprio al 140): lo salva la stella, piena = salvato a questo livello
    const salvato = !!cur && cur.liv === lvl, stella = $("prefStella");
    stella.textContent = salvato ? "★" : "☆";
    stella.classList.toggle("piena", salvato);
    stella.setAttribute("aria-pressed", String(salvato));
    stella.title = salvato ? T.stellaTogli(breve(S.ge), m.nome) : cur ? T.stellaAggiorna(breve(S.ge), lvl, cur.liv) : T.stellaAgg(breve(S.ge), lvl, m.nome);
    stella.setAttribute("aria-label", stella.title);
    // (utente) "★ F (2 GE) · Fronte 132": il numero di GE è quello del mondo, poi il GE scelto
    $("prefApri").innerHTML = '<span class="stella">★</span><span class="mondo">' + esc(m.nome) + "</span>"
      + '<span class="conta">(' + esc(T.nGe(m.ge.length)) + ")</span>"
      + (cur ? '<span class="dettaglio">· ' + esc(breve(cur.id)) + " " + cur.liv + "</span>" : "")
      + '<span class="freccia">▾</span>';
    $("prefMondi").innerHTML = mondi().map((x, i) => '<button type="button" data-mondo="' + i + '" class="' + (i === S.mondo ? "attivo" : "") + '">' + esc(x.nome) + "</button>").join("")
      + '<button type="button" data-mondo="nuovo" title="' + esc(T.prefNuovo) + '" aria-label="' + esc(T.prefNuovo) + '">+</button>';
    $("prefGriglia").innerHTML = (m.ge.length ? "" : '<p class="pref-vuoto">' + esc(T.prefVuoto) + "</p>")
      + m.ge.map(g => '<button type="button" data-ge="' + esc(g.id) + '" class="' + (g.id === S.ge ? "attivo" : "") + '" title="' + esc(nome(g.id)) + '"><span>' + esc(breve(g.id)) + "</span><b>" + g.liv + "</b></button>").join("");
  }
  $("prefApri").addEventListener("click", () => apriPref($("prefPannello").hidden));
  // (composedPath: il pulsante toccato può essere già stato ridisegnato, quindi fuori dal pannello)
  document.addEventListener("click", e => { if (!e.composedPath().includes($("pref"))) apriPref(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") apriPref(false); });
  $("prefMondi").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.mondo === "nuovo") {
      const n = (prompt(T.prefNome) || "").trim().slice(0, 30);
      if (!n) return;
      mondi().push({ nome: n, ge: [] }); S.mondo = S.mondi.length - 1;
    } else S.mondo = Number(b.dataset.mondo);
    mostra();
  });
  $("prefGriglia").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const m = mondo();
    const g = m.ge.find(x => x.id === b.dataset.ge); if (!g) return;
    if (g.id !== S.ge || g.liv !== livOk(S.livello)) { S.ge = g.id; $("ge").value = g.id; azzera(); S.livello = g.liv; sincronizza(); }
    apriPref(false);
    mostra();
  });
  // stella vuota: salva (o aggiorna) GE e livello nel mondo attivo; piena: lo toglie
  $("prefStella").addEventListener("click", () => {
    const m = mondo(), lvl = livOk(S.livello), i = m.ge.findIndex(g => g.id === S.ge);
    if (i < 0) m.ge.push({ id: S.ge, liv: lvl });
    else if (m.ge[i].liv !== lvl) m.ge[i].liv = lvl;
    else m.ge.splice(i, 1);
    mostra();
  });
  // (23/11/2026, utente) Aperto dall'app: le TUE città importate (non le visitate né quelle da
  // file JSON) diventano mondi con TUTTI i loro GE al livello da costruire (livello attuale + 1,
  // come il pulsante del GE nella scheda Città). Un mondo per città, collegato con l'id della
  // città (campo "citta"): resta collegato anche se lo rinomini, e a ogni apertura dall'app la
  // sua lista si riscrive con i dati veri. Gli altri mondi non cambiano; senza città importate
  // non cambia niente. Lettura dei dati dell'app (stesso sito): elenco in
  // foe_global_profiles_v2, città in foe_p_<id>_city_v2 (JSON compresso zlib + base64, come
  // writeStoredJson in src/utils/storage.ts).
  async function daCittaApp() {
    if (!apertoDallApp || typeof DecompressionStream === "undefined") return;
    let citta = [];
    try { citta = JSON.parse(localStorage.getItem("foe_global_profiles_v2") || "[]"); } catch { return; }
    if (!Array.isArray(citta)) return;
    const attiva = localStorage.getItem("foe_global_active_profile_v2");
    let cambiato = false;
    for (const c of citta) {
      if (!c || !c.id || c.origine === "json") continue;
      const tipo = c.tipo || (localStorage.getItem("foe_p_" + c.id + "_inventory_v2") ? "mia" : "visitata");
      if (tipo !== "mia") continue;
      const grezzo = localStorage.getItem("foe_p_" + c.id + "_city_v2");
      if (!grezzo || grezzo.length > 8e6) continue;
      let dati;
      try {
        const byte = Uint8Array.from(atob(grezzo), x => x.charCodeAt(0));
        dati = JSON.parse(await new Response(new Blob([byte]).stream().pipeThrough(new DecompressionStream("deflate"))).text());
      } catch { continue; }
      const lista = (Array.isArray(dati && dati.greatBuildingsJson) ? dati.greatBuildingsJson : [])
        .filter(([id, g]) => costi[id] && g && Number.isFinite(g.level))
        .map(([id, g]) => ({ id, liv: Math.min(costi[id].length, Math.max(1, g.level + 1)) }))
        .sort((x, y) => nome(x.id).localeCompare(nome(y.id), LINGUA));
      if (!lista.length) continue;
      const tutti = mondi();
      // (il "Mondo 1" vuoto di partenza non serve più)
      if (!cambiato && tutti.length === 1 && !tutti[0].citta && !tutti[0].ge.length) tutti.pop();
      let m = tutti.find(x => x.citta === c.id);
      if (!m) { m = { nome: String(c.name || c.id).slice(0, 30), citta: c.id, ge: [] }; tutti.push(m); }
      m.ge = lista;
      if (c.id === attiva) S.mondo = tutti.indexOf(m);
      cambiato = true;
    }
    if (cambiato) mostra();
  }
  daCittaApp();
  $("prefRinomina").addEventListener("click", () => {
    const n = (prompt(T.prefNome, mondo().nome) || "").trim().slice(0, 30);
    if (n) { mondo().nome = n; mostra(); }
  });
  $("prefElimina").addEventListener("click", () => {
    if (!confirm(T.prefElConf(mondo().nome))) return;
    mondi().splice(S.mondo, 1); S.mondo = Math.max(0, S.mondo - 1);
    mostra();
  });

  $("ge").value = S.ge;
  $("custom").value = S.custom || "";
  $("giocatore").value = S.giocatore || "";
  $("versati").value = S.versati ? fmt(S.versati) : "";
  sincronizza();
  mostra();
})();
