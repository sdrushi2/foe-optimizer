#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  scripts/confronta-calcolatore-ge.cjs — Calcolatore GE contro FoE Helper e
//  Forge Hammer (23/11/2026)
//
//  Confronta, per tutti i GE e tutti i livelli di public/data/mecenati-dati.js:
//   - costo del livello e numero di posti;
//   - premio di ogni posto;
//   - "da versare" con le chat Rame 90/95/100, Oro 20/25/50 e tre percentuali
//     personalizzate (85, 92, 29);
//   - per coprire, pericolo, chi chiude il livello e PF finali del proprietario,
//     senza esterni e con 1-3 esterni casuali (3 prove per percentuale).
//
//  Usa il codice dei due tool così com'è (js/web/greatbuildings/js/greatbuildings.js
//  di ognuno) e il nostro calcola() preso da public/calcolatore/calcolatore.js.
//  La copertura dei posti di FoE Helper (Parts.CalcBody, part-calc.js) è riportata
//  qui sotto riga per riga (helperBody): se cambia da loro va aggiornata a mano.
//  Forge Hammer ha lo stesso ciclo (in più solo i posti bloccati a mano).
//
//  Ipotesi: FoE Helper ricava i costi dai primi 10 livelli dei dati del gioco; qui
//  sono i nostri livelli 1-10 (wiki). Tier Oro dal livello 101, GE solo Rame fino al 200.
//
//  Differenza nota (23/11/2026, 7.548 prove, livelli fino al 117): sui posti con premio
//  0 FoE Helper e Forge Hammer mettono gli ultimi PF del proprietario nella colonna
//  "per coprire" del primo posto con premio 0, noi in "PF finali"; totale uguale.
//  Lo script la conta a parte ("premio 0") e non come errore.
//
//  Uso (dalla cartella del progetto):
//    node scripts/confronta-calcolatore-ge.cjs [cartella FoE Helper] [cartella Forge Hammer]
//  Predefinite: D:/foe-helfer-extension-beta e D:/forge-hammer.
//  Esce con codice 1 se trova differenze vere; l'elenco completo in
//  confronta-calcolatore-ge.json nella cartella temporanea del sistema (non nel repo).
// ─────────────────────────────────────────────────────────────────────────────
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const os = require("os");

const APP = path.resolve(__dirname, "..");
const HELPER = process.argv[2] || "D:/foe-helfer-extension-beta";
const HAMMER = process.argv[3] || "D:/forge-hammer";
const leggi = f => fs.readFileSync(f, "utf8");

// ── dati e calcola() del nostro Calcolatore GE ───────────────────────────────
const ctxD = { window: {} };
vm.createContext(ctxD);
vm.runInContext(leggi(path.join(APP, "public/data/mecenati-dati.js")), ctxD);
const DATI = ctxD.window.MECENATI.edifici;

const src = leggi(path.join(APP, "public/calcolatore/calcolatore.js"));
const pezzo = (da, a) => {
  const i = src.indexOf(da), j = src.indexOf(a, i);
  if (i < 0 || j < 0) throw new Error(`calcolatore.js: non trovo "${da.trim()}"`);
  return src.slice(i, j);
};
const costi = {}, datiOro = {};
for (const id in DATI) { costi[id] = DATI[id].costi; datiOro[id] = !!DATI[id].oro; }
const NOSTRO = new Function("costi", "datiOro", `
  ${pezzo("  const FASCE =", "  const CHIAVE =")}
  ${pezzo("  const CHAT =", "\n")}
  ${pezzo("  const numero =", "\n")}
  const oro = id => !!datiOro[id];
  const S = { ge: "", livello: 1, custom: "", chat: {}, versati: "", esterni: [] };
  const maxLiv = () => costi[S.ge].length;
  const livOk = v => Math.min(maxLiv(), Math.max(1, parseInt(v) || 1));
  ${pezzo("  function calcola() {", "\n  // righe della tabella")}
  return (ge, livello, perc, esterni) => {
    Object.assign(S, { ge, livello, chat: { rame: "custom", oro: "custom" }, custom: String(perc), esterni: esterni.map(String), versati: "" });
    return calcola();
  };
`)(costi, datiOro);

// ── FoE Helper e Forge Hammer ────────────────────────────────────────────────
const round = v => Math.round(v + (v >= 0 ? 1e-6 : -1e-6)); // MainParser.round / FH.Main.round
const meta = {};
for (const id in DATI) meta[id] = { strategy_points_for_upgrade: DATI[id].costi.slice(0, 10), bonuses: [{}], maxTier: DATI[id].oro ? "gold" : "copper" };
const ctxH = {
  FoEproxy: { addHandler() {}, addFoeHelperHandler() {}, addWsHandler() {}, triggerFoeHelperHandler() {} },
  MainParser: { CityEntities: meta, round, GetGBTierRanges: m => ({ starts: { copper: 1, gold: 101 }, ends: { copper: m.maxTier === "gold" ? 100 : 200 } }) },
  $: () => ({ length: 0 }), console,
};
vm.createContext(ctxH);
vm.runInContext(leggi(path.join(HELPER, "js/web/greatbuildings/js/greatbuildings.js")) + "\n;this.GreatBuildings = GreatBuildings;", ctxH);
const HG = ctxH.GreatBuildings;

const ctxF = { FH: { Main: { round }, proxy: { addHandler() {}, addWsHandler() {} } }, $: () => ({ length: 0 }), console };
vm.createContext(ctxF);
vm.runInContext(leggi(path.join(HAMMER, "js/web/greatbuildings/js/greatbuildings.js")) + "\n;this.GreatBuildings = GreatBuildings;", ctxF);
const FG = ctxF.GreatBuildings;

// Copertura dei posti di FoE Helper (Parts.CalcBody, livello futuro), opzioni
// predefinite: LockExistingPlaces = true, TrustExistingPlaces = false, nessun PF proprio.
function helperBody(FPRewards, Exts, Total, PlaceCount) {
  const Maezens = Array(PlaceCount).fill(0), Eigens = [], Danger = [], Levelt = [];
  let Rest = Total, ExtTotal = 0;
  for (const e of Exts) if (e > 0) Maezens[Maezens.length] = e;
  Maezens.sort((a, b) => b - a);
  for (let i = 0; i < Maezens.length; i++) {
    if (Maezens[i] === 0) { Maezens.length = Math.max(i, PlaceCount); break; }
    ExtTotal += Maezens[i];
  }
  Rest -= ExtTotal;
  for (let i = 0; i < PlaceCount; i++) {
    if (FPRewards[i] <= Maezens[i] || Rest <= Maezens[i]) {
      const Next = Maezens[i + 1] !== undefined ? Maezens[i + 1] : 0;
      Eigens[i] = Math.max(Math.ceil(Rest + Next - Maezens[i]), 0);
      Rest -= Eigens[i];
      continue;
    }
    Eigens[i] = Math.ceil(Rest + Maezens[i] - 2 * FPRewards[i]);
    if (Eigens[i] < 0) { Danger[i] = Math.floor(0 - Eigens[i] / 2); Eigens[i] = 0; }
    for (let j = Maezens.length - 1; j >= i; j--) if (Maezens[j] > 0) Maezens[j + 1] = Maezens[j];
    Maezens[i] = FPRewards[i];
    if (Maezens[i] >= Rest) { Levelt[i] = true; if (Danger[i] > 0) Danger[i] -= Maezens[i] - Rest; Maezens[i] = Rest; }
    Rest -= Eigens[i] + Maezens[i];
  }
  const n = PlaceCount, a = (arr, f) => Array.from({ length: n }, (_, i) => f(arr[i]));
  // (il pericolo negativo FoE Helper non lo mostra: sotto la sua soglia di 5 PF)
  return { E: a(Eigens, v => v || 0), D: a(Danger, v => Math.max(0, v || 0)), L: a(Levelt, v => !!v), P: Maezens.slice(0, n).map(v => v | 0), F: Rest > 0 ? Rest : 0 };
}
const nostraCopertura = r => ({
  E: r.righe.map(x => x.assicura || 0), D: r.righe.map(x => x.pericolo || 0), L: r.righe.map(x => !!x.chiude),
  P: r.righe.map(x => (x.stato === "libero" ? x.paga : x.stato === "esterno" ? x.esterno : 0)), F: r.finale,
});
const totale = c => c.E.reduce((s, v) => s + v, 0) + c.F;
// differenza nota: solo sui posti con premio 0, stesso totale, stessi posti, pericoli e chiusure
const soloPremio0 = (r, a, b) => totale(a) === totale(b)
  && JSON.stringify([a.D, a.L, a.P]) === JSON.stringify([b.D, b.L, b.P])
  && a.E.every((v, i) => v === b.E[i] || (r.righe[i].versa === 0 && r.righe[i].stato === "libero"));

// ── confronto ────────────────────────────────────────────────────────────────
const voci = ["costo FH", "costo Helper", "posti", "premi FH", "premi Helper", "versa FH", "versa Helper", "copertura", "copertura con esterni"];
const diff = Object.fromEntries(voci.map(k => [k, []]));
let livelli = 0, prove = 0, proveEsterni = 0, premio0 = 0;
let seme = 12345;
const caso = () => (seme = (seme * 1103515245 + 12345) % 2147483648) / 2147483648;
const PERC = { rame: [90, 95, 100], oro: [20, 25, 50], extra: [85, 92, 29] };

for (const id of Object.keys(DATI)) {
  const C = DATI[id].costi;
  for (let lvl = 1; lvl <= C.length; lvl++) {
    livelli++;
    const idx = lvl - 1, costo = C[idx];
    const cFH = FG.Levels[id]?.FPCosts?.[idx], cHe = HG.GetReworkCosts(id, idx);
    if (cFH !== costo) diff["costo FH"].push(`${id} liv ${lvl}: noi ${costo}, FH ${cFH}`);
    if (cHe !== costo) diff["costo Helper"].push(`${id} liv ${lvl}: noi ${costo}, Helper ${cHe}`);
    const r0 = NOSTRO(id, lvl, 0, []);
    const base = r0.righe.map(r => r.base);
    const bFH = FG.Levels[id] ? FG.GetLevelRewards(id, idx) : null, bHe = HG.GetReworkRewards(id, idx);
    if (!bFH || bFH.join() !== base.join()) diff["premi FH"].push(`${id} liv ${lvl}: noi [${base}], FH [${bFH}]`);
    if (!bHe || bHe.join() !== base.join()) diff["premi Helper"].push(`${id} liv ${lvl}: noi [${base}], Helper [${bHe}]`);
    if ((bHe && bHe.length !== r0.n) || (bFH && bFH.length !== r0.n)) diff.posti.push(`${id} liv ${lvl}: noi ${r0.n}, Helper ${bHe?.length}, FH ${bFH?.length}`);
    for (const p of [...(r0.tier === "oro" ? PERC.oro : PERC.rame), ...PERC.extra]) {
      prove++;
      const r = NOSTRO(id, lvl, p, []), v = r.righe.map(x => x.versa);
      const vFH = FG.GetLevelMaezen(id, idx, p), vHe = HG.ApplyArcBonus(bHe || base, p);
      if (vFH.join() !== v.join()) diff["versa FH"].push(`${id} liv ${lvl} ${p}%: noi [${v}], FH [${vFH}]`);
      if (vHe.join() !== v.join()) diff["versa Helper"].push(`${id} liv ${lvl} ${p}%: noi [${v}], Helper [${vHe}]`);
      const a = nostraCopertura(r), b = helperBody(vHe, [], costo, r.n);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        if (soloPremio0(r, a, b)) premio0++;
        else diff.copertura.push(`${id} liv ${lvl} ${p}%: noi ${JSON.stringify(a)} Helper ${JSON.stringify(b)}`);
      }
      for (let k = 0; k < 3; k++) {
        const est = Array.from({ length: 1 + Math.floor(caso() * 3) }, () => 1 + Math.floor(caso() * Math.max(2, v[Math.floor(caso() * r.n)] * 1.6)));
        if (est.reduce((s, x) => s + x, 0) >= costo) continue;
        proveEsterni++;
        const re = NOSTRO(id, lvl, p, est);
        const ae = nostraCopertura(re), be = helperBody(re.righe.map(x => x.versa), est, costo, re.n);
        if (JSON.stringify(ae) !== JSON.stringify(be)) {
          if (soloPremio0(re, ae, be)) premio0++;
          else diff["copertura con esterni"].push(`${id} liv ${lvl} ${p}% esterni [${est}]: noi ${JSON.stringify(ae)} Helper ${JSON.stringify(be)}`);
        }
      }
    }
  }
}

console.log(`GE ${Object.keys(DATI).length}, livelli ${livelli}, prove "da versare" ${prove}, prove con esterni ${proveEsterni}`);
let errori = 0;
for (const k of voci) {
  errori += diff[k].length;
  console.log(`${diff[k].length ? "✗" : "✓"} ${k}: ${diff[k].length} differenze`);
  diff[k].slice(0, 5).forEach(s => console.log("    " + s));
}
console.log(`  (differenza nota sui posti con premio 0, stesso totale del proprietario: ${premio0} prove)`);
const uscita = path.join(os.tmpdir(), "confronta-calcolatore-ge.json");
fs.writeFileSync(uscita, JSON.stringify({ premio0, ...diff }, null, 1));
console.log(`Elenco completo: ${uscita}`);
process.exit(errori ? 1 : 0);
