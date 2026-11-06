// ─────────────────────────────────────────────────────────────────────────────
//  Calcolatore dei GE (novembre 2026): posti mecenate di ogni livello.
//  Codice comune alle due pagine: /ge/ (italiano) e /gb/ (inglese); la lingua
//  è quella di <html lang>, il cambio lingua passa all'altra pagina.
//  Dati: ../data/mecenati-dati.js (RECUPERO DATI/gecosti.py: costi per livello
//  dal calcolatore di Linnun, nomi it/en e tier dai MainParser via ge.json).
//  Regole: quota mecenati per fascia di livello, divisione fra i posti (5 Rame,
//  7 per i GE Oro dal livello 101), montepremi NON arrotondato prima della
//  divisione (come il gioco e FoE Helper), da versare = ricompensa × (1 + %).
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";
  const LINGUA = document.documentElement.lang === "en" ? "en" : "it";

  const T = {
    it: {
      titolo: "Calcolatore GE", torna: "← Torna al tool",
      ge: "Grande Edificio", livello: "Livello in costruzione", livMeno: "Livello precedente", livPiu: "Livello successivo",
      rame: "RAME", oro: "ORO", chatRame: "CHAT RAME", chatOro: "CHAT ORO", custom: "CUSTOM", customAl: "Percentuale personalizzata", customEs: "es. 92",
      customT: "Chat personalizzata: scrivi la percentuale che vuoi (es. 92% per il Rame, 29% per l'Oro)",
      pfLivello: "PF del livello", pfProp: "PF proprietario", pfContr: "PF contribuzioni",
      pfPropT: "PF che restano a carico del proprietario per completare il livello",
      pfContrT: "PF versati in tutto dai mecenati dei posti (con la percentuale della chat)",
      pos: "Pos.", ricompensa: "Ricompensa", versare: "Da versare", coprire: "Per coprire", totale: "Totale per coprire",
      ricompensaT: "Ricompensa del posto in PF, senza bonus dell'Arca",
      versareT: "PF che il mecenate versa per riavere esattamente la ricompensa con la sua percentuale",
      coprireT: "PF del proprietario in più per assicurare questo posto, oltre ai precedenti",
      totaleT: "PF del proprietario in totale per assicurare questo posto (e tutti quelli sopra)",
      sicuro: "sicuro", pieno: "pieno",
      testoAl: "Testo da copiare in chat", nome: "Il tuo nome (facoltativo)", nomeAl: "Il tuo nome nel gioco",
      copia: "Copia", copiato: "Copiato",
      errore: "Non riesco a caricare i dati dei Grandi Edifici (data/mecenati-dati.js). Ricarica la pagina.",
      disclaimer: "Forge of Empires è un marchio di InnoGames GmbH. FoE Optimizer è un progetto amatoriale indipendente, non affiliato a InnoGames.",
    },
    en: {
      titolo: "GB Calculator", torna: "← Back to the tool",
      ge: "Great Building", livello: "Level being built", livMeno: "Previous level", livPiu: "Next level",
      rame: "COPPER", oro: "GOLD", chatRame: "COPPER CHAT", chatOro: "GOLD CHAT", custom: "CUSTOM", customAl: "Custom percentage", customEs: "e.g. 92",
      customT: "Custom chat: type any percentage (e.g. 92% for Copper, 29% for Gold)",
      pfLivello: "Level FP", pfProp: "Owner FP", pfContr: "Contributions FP",
      pfPropT: "FP left to the owner to complete the level",
      pfContrT: "FP paid in total by the patrons of the spots (with the chat percentage)",
      pos: "Pos.", ricompensa: "Reward", versare: "To pay", coprire: "To secure", totale: "Total to secure",
      ricompensaT: "FP reward of the spot, without the Arc bonus",
      versareT: "FP the patron pays to get back exactly the reward with their percentage",
      coprireT: "Extra owner FP to secure this spot, on top of the previous ones",
      totaleT: "Total owner FP to secure this spot (and all the ones above)",
      sicuro: "safe", pieno: "full",
      testoAl: "Text to copy into chat", nome: "Your name (optional)", nomeAl: "Your in-game name",
      copia: "Copy", copiato: "Copied",
      errore: "Couldn't load the Great Building data (data/mecenati-dati.js). Reload the page.",
      disclaimer: "Forge of Empires is a trademark of InnoGames GmbH. FoE Optimizer is an independent fan project, not affiliated with InnoGames.",
    },
  }[LINGUA];

  // Quota dei mecenati sul costo del livello: [ultimo livello della fascia, quota]
  const FASCE = [[9, .25], [39, .30], [69, .40], [100, .25], [200, .15], [300, .10], [400, .07], [500, .05]];
  // Divisione dei premi fra i posti (Rame 5 posti, Oro 7 posti)
  const QUOTE = { 5: [120, 60, 20, 5, 1].map(x => x / 206), 7: [5040, 2520, 840, 210, 42, 7, 1].map(x => x / 8660) };
  const CHIAVE = "foe-optimizer-calcolatore-ge";   // (stesso stato per /ge e /gb)
  const CHAT = { r90: 90, r95: 95, r100: 100, o20: 20, o25: 25 };
  const $ = id => document.getElementById(id);
  // migliaia sempre separate (anche a 4 cifre): punto in italiano, virgola in inglese
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, LINGUA === "en" ? "," : ".");
  const numero = (v, d = 0) => { const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) && x >= 0 ? x : d; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // link all'altra lingua: dal disco (file://) serve index.html esplicito
  const pagina = l => (location.protocol === "file:" ? "../" + l + "/index.html" : "/" + l + "/");

  // ── pagina ──
  const chat = (id, classe, breve, lungo) => `<button type="button" class="${classe}" data-chat="${id}" title="${esc(lungo)}">${esc(breve)}</button>`;
  document.body.innerHTML = `
    <header id="bar">
      <a class="brand" href="/" title="FoE Optimizer">
        <div class="logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m13 19 6-6"/><path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5"/>
            <path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586"/>
            <path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="m5 14 4 4"/><path d="m5 21-2-2"/><path d="M7.5 16.5 4 20"/>
          </svg>
        </div>
        <h1>${esc(T.titolo)}</h1>
      </a>
      <nav class="lingue" aria-label="Lingua / Language">
        <a href="${pagina("ge")}" hreflang="it" lang="it" class="${LINGUA === "it" ? "attiva" : ""}">IT</a><span>/</span>
        <a href="${pagina("gb")}" hreflang="en" lang="en" class="${LINGUA === "en" ? "attiva" : ""}">EN</a>
      </nav>
      <a class="btn" href="/">${esc(T.torna)}</a>
    </header>
    <div class="wrap">
      <p id="errore" hidden></p>
      <div class="card">
        <div class="riga">
          <select id="ge" aria-label="${esc(T.ge)}"></select>
          <div class="liv" title="${esc(T.livello)}">
            <button type="button" id="meno" aria-label="${esc(T.livMeno)}">−</button>
            <input id="livello" type="number" min="1" inputmode="numeric" aria-label="${esc(T.livello)}">
            <button type="button" id="piu" aria-label="${esc(T.livPiu)}">+</button>
          </div>
        </div>
        <div class="chat" id="chat">
          ${chat("r90", "rame", T.rame + " 90%", T.chatRame + " 90%")}
          ${chat("r95", "rame", T.rame + " 95%", T.chatRame + " 95%")}
          ${chat("r100", "rame", T.rame + " 100%", T.chatRame + " 100%")}
          ${chat("o20", "oro", T.oro + " 20%", T.chatOro + " 20%")}
          ${chat("o25", "oro", T.oro + " 25%", T.chatOro + " 25%")}
          <span class="custom" id="customBox" title="${esc(T.customT)}">
            <button type="button" data-chat="custom">${esc(T.custom)}</button>
            <input id="custom" inputmode="decimal" aria-label="${esc(T.customAl)}" placeholder="${esc(T.customEs)}"><span>%</span>
          </span>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">${esc(T.pfLivello)}</div><div class="v" id="totale"></div></div>
        <div class="stat" title="${esc(T.pfPropT)}"><div class="k">${esc(T.pfProp)}</div><div class="v" id="proprietario"></div></div>
        <div class="stat" title="${esc(T.pfContrT)}"><div class="k">${esc(T.pfContr)}</div><div class="v" id="contribuzioni"></div></div>
      </div>
      <div class="card tabella">
        <table>
          <thead><tr>
            <th>${esc(T.pos)}</th>
            <th title="${esc(T.ricompensaT)}">${esc(T.ricompensa)}</th>
            <th title="${esc(T.versareT)}">${esc(T.versare)}</th>
            <th title="${esc(T.coprireT)}">${esc(T.coprire)}</th>
            <th title="${esc(T.totaleT)}">${esc(T.totale)}</th>
          </tr></thead>
          <tbody id="righe"></tbody>
        </table>
      </div>
      <div class="card copia">
        <div id="testo" aria-label="${esc(T.testoAl)}"></div>
        <input id="giocatore" aria-label="${esc(T.nomeAl)}" placeholder="${esc(T.nome)}">
        <button type="button" id="copia">${esc(T.copia)}</button>
      </div>
      <footer><p>${esc(T.disclaimer)}</p></footer>
    </div>`;

  const dati = window.MECENATI && window.MECENATI.edifici;
  if (!dati) { $("errore").hidden = false; $("errore").textContent = T.errore; return; }

  const costi = {};
  for (const id in dati) costi[id] = dati[id].costi;
  const ids = Object.keys(costi);
  // (nome: {it, en}; una stringa = file dei dati di prima, solo italiano)
  const nome = id => { const n = dati[id].nome; return (typeof n === "string" ? n : n && (n[LINGUA] || n.it || n.en)) || id; };
  const oro = id => !!dati[id].oro;
  // chat scelta per tier (livelli Rame 5 posti, livelli Oro 7), validata in calcola()
  const S = { ge: "X_FutureEra_Landmark1", livello: 1, custom: "", giocatore: "", chat: { rame: "r90", oro: "o20" } };
  try { Object.assign(S, JSON.parse(localStorage.getItem(CHIAVE) || "{}")); } catch (e) { /* niente */ }
  if (!costi[S.ge]) S.ge = ids[0];
  if (!S.chat || typeof S.chat !== "object") S.chat = {}; // (salvataggio vecchio o rovinato)
  const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch (e) { /* niente */ } };
  const maxLiv = () => costi[S.ge].length;
  const livOk = v => Math.min(maxLiv(), Math.max(1, parseInt(v) || 1));

  ids.sort((a, b) => nome(a).localeCompare(nome(b), LINGUA));
  for (const id of ids) $("ge").add(new Option(nome(id), id));

  function calcola() {
    const lvl = livOk(S.livello), costo = costi[S.ge][lvl - 1];
    const quota = (FASCE.find(f => lvl <= f[0]) || FASCE[FASCE.length - 1])[1];
    const n = oro(S.ge) && lvl >= 101 ? 7 : 5, tier = n === 7 ? "oro" : "rame";
    // % della chat scelta per questo tier (la stessa per tutti i posti; fattore = 1 + % / 100)
    const valida = tier === "oro" ? ["o20", "o25", "custom"] : ["r90", "r95", "r100", "custom"];
    if (!valida.includes(S.chat[tier])) S.chat[tier] = tier === "oro" ? "o20" : "r90";
    const perc = S.chat[tier] === "custom" ? numero(S.custom, 0) : CHAT[S.chat[tier]];
    // (montepremi NON arrotondato prima della divisione: così fa il gioco, come
    // mostra FoE Helper; Linnun lo arrotonda e sbaglia di 1 PF qua e là, es.
    // Osservatorio 156: posto 2 = 3.801 e non 3.802)
    const premi = costo * quota;
    let somma = 0, prec = 0;
    const righe = [];
    for (let i = 0; i < n; i++) {
      const base = Math.round(premi * QUOTE[n][i]);
      const versa = Math.max(0, Math.round(base * (1 + perc / 100)));
      somma += versa;
      // sicuro quando quello che resta (costo - posti 1..i - i tuoi) non supera questo posto
      const serve = Math.max(0, costo - somma - versa);
      const tuoi = Math.max(prec, serve);
      righe.push({ base, versa, assicura: tuoi - prec, tuoi, pieno: tuoi + somma > costo });
      prec = tuoi;
    }
    // contribuzioni dei posti (mai oltre il costo del livello) e resto al proprietario
    const contribuzioni = Math.min(costo, somma);
    return { costo, n, tier, righe, contribuzioni, proprietario: costo - contribuzioni };
  }

  // righe della tabella (7, le ultime 2 nascoste nel tier Rame)
  const corpo = $("righe");
  for (let i = 0; i < 7; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="pos">' + (i + 1) + '</td><td class="b"></td><td class="c"></td><td class="a"></td><td class="t"></td>';
    corpo.append(tr);
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
    $("contribuzioni").textContent = fmt(r.contribuzioni);
    $("proprietario").textContent = fmt(r.proprietario);
    [...corpo.children].forEach((tr, i) => {
      tr.hidden = i >= r.n;
      if (i >= r.n) return;
      const o = r.righe[i];
      tr.className = o.base > 0 ? "" : "vuoto";
      tr.querySelector(".b").textContent = fmt(o.base);
      tr.querySelector(".c").textContent = fmt(o.versa);
      const a = tr.querySelector(".a"), t = tr.querySelector(".t");
      a.className = "a";
      if (o.pieno) { a.innerHTML = t.innerHTML = '<span class="pieno">' + esc(T.pieno) + '</span>'; }
      else {
        if (o.assicura) a.textContent = fmt(o.assicura); else { a.textContent = T.sicuro; a.classList.add("sicuro"); }
        t.textContent = fmt(o.tuoi);
      }
    });
    // testo per la chat, dall'ultimo posto al primo: "Nome GE: P7(3) P6(6) … P1(4275)"
    const parti = [];
    for (let i = r.n - 1; i >= 0; i--) if (r.righe[i].base > 0) parti.push("P" + (i + 1) + "(" + r.righe[i].versa + ")");
    const chi = String(S.giocatore || "").trim();
    $("testo").textContent = (chi ? chi + " " : "") + nome(S.ge) + (parti.length ? ": " + parti.join(" ") : "");
    salva();
  }

  const sincronizza = () => { S.livello = livOk(S.livello); $("livello").value = S.livello; $("livello").max = maxLiv(); };
  $("ge").addEventListener("change", e => { S.ge = e.target.value; sincronizza(); mostra(); });
  $("livello").addEventListener("input", e => { S.livello = e.target.value; mostra(); });
  $("livello").addEventListener("change", () => { sincronizza(); mostra(); });
  $("meno").addEventListener("click", () => { S.livello = livOk(S.livello) - 1; sincronizza(); mostra(); });
  $("piu").addEventListener("click", () => { S.livello = livOk(S.livello) + 1; sincronizza(); mostra(); });
  // chat: la stessa % in tutti i posti, per il tier del livello mostrato
  const applicaChat = c => { S.chat[calcola().tier] = c; mostra(); };
  document.querySelectorAll("#chat button").forEach(b => b.addEventListener("click", () => applicaChat(b.dataset.chat)));
  $("custom").addEventListener("input", e => { S.custom = e.target.value; applicaChat("custom"); });
  // (toccare la casella della % sceglie già la chat personalizzata)
  $("custom").addEventListener("focus", () => applicaChat("custom"));
  $("giocatore").addEventListener("input", e => { S.giocatore = e.target.value; mostra(); });
  $("copia").addEventListener("click", async () => {
    const el = $("testo");
    try { await navigator.clipboard.writeText(el.textContent); }
    catch (e) { // (senza https o permessi: selezione + copia classica)
      const sel = getSelection(), rng = document.createRange();
      rng.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(rng); document.execCommand("copy");
    }
    $("copia").textContent = T.copiato;
    setTimeout(() => { $("copia").textContent = T.copia; }, 1200);
  });

  $("ge").value = S.ge;
  $("custom").value = S.custom || "";
  $("giocatore").value = S.giocatore || "";
  sincronizza();
  mostra();
})();
