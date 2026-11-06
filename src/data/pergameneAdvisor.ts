// ─────────────────────────────────────────────────────────────────────────────
//  data/pergameneAdvisor.ts — Consigliere Pergamene Eroiche (novembre 2026)
//
//  Regole (utente):
//   - `costo(L)` pergamene portano un alleato dal livello L−1 al livello L,
//     a qualunque rarità; tabella public/data/pergamene.csv
//     (livello;pergamene, livello 1 = 0: un alleato nuovo è sempre al livello 1);
//   - livello massimo 100 (MaxLevel di allies.csv, tetto della tabella);
//   - contano TUTTI gli alleati posseduti (anche quelli in magazzino, che il
//     pannello segnala), con la rarità attuale (i Gettoni sono un pannello a parte).
//
//  Obiettivo: con le pergamene possedute, il massimo guadagno di efficienza
//  (stessa efficienza pesata del consigliere Gettoni, allyAdvisor.ts).
//  È uno zaino a gruppi: per ogni alleato si sceglie QUANTI livelli fare
//  (0…100−L), costo e guadagno cumulati.
//   - Esatto (programmazione dinamica sul budget) se le operazioni stanno
//     sotto LIMITE_OPERAZIONI: con ~6.000 pergamene e qualche decina di
//     alleati sono pochi milioni di passi (millisecondi).
//   - Altrimenti (budget enormi) greedy sull'inviluppo concavo di ogni
//     alleato: il guadagno per livello è quasi costante (statistiche lineari,
//     con il salto doppio al livello di soglia di allies.ts) e il costo cresce,
//     quindi conviene sempre il passo col miglior guadagno per pergamena;
//     l'ultimo segmento che non sta nel budget si prende livello per livello.
// ─────────────────────────────────────────────────────────────────────────────

import { datiGioco } from "./datiGioco";
import { getComputedAllyStats, type Ally, type ImportedAlly } from "./allies";
import { isScienceAlly, weightedEff } from "./allyAdvisor";
import type { Weights } from "../utils/calculator";

/** Oltre questo numero di passi (budget × livelli) si passa al greedy. */
const LIMITE_OPERAZIONI = 60_000_000;
const LIVELLO_MAX = 100;

let tabella: number[] | null = null;
/** Pergamene per arrivare a ogni livello (indice = livello; 0 e 1 = 0). */
function costi(): number[] {
  if (tabella) return tabella;
  const t: number[] = [0, 0];
  for (const riga of datiGioco().pergamene.split(/\r?\n/).slice(1)) {
    const [l, p] = riga.split(";").map(v => Number(v.trim()));
    if (Number.isInteger(l) && l! >= 1 && Number.isFinite(p)) t[l!] = p!;
  }
  tabella = t;
  return t;
}

/** Livello massimo raggiungibile con le pergamene (tetto della tabella). */
function tettoTabella(): number {
  return costi().length - 1;
}

export interface PassoPergamene {
  /** Alleato posseduto (copia) da far salire. */
  imp: ImportedAlly;
  da: number;
  a: number;
  pergamene: number;
  /** Guadagno di efficienza (pesata). */
  guadagno: number;
  /** Aumento dei boost (Att/Att, Dif/Att, Att/Dif, Dif/Dif): Generali, Campi, Spedizioni. */
  dGeneral: Quattro; dGbg: Quattro; dSped: Quattro;
}

type Quattro = [number, number, number, number];

export interface ConsiglioPergamene {
  passi: PassoPergamene[];
  spese: number;
  guadagno: number;
  /** Pergamene per il livello più economico ancora possibile (0 = tutti al massimo). */
  prossimoCosto: number;
  /** true = programmazione dinamica (ottimo), false = greedy (quasi ottimo). */
  esatto: boolean;
}

interface Voce { imp: ImportedAlly; ally: Ally; da: number; cumC: number[]; cumG: number[] }

export function consigliaPergamene(
  owned: readonly ImportedAlly[], byIdRarity: Map<string, Ally>, inherited: Map<string, Ally[]>,
  weights: Weights, budget: number,
  /** Livelli in più agli alleati militari dal Colosseo (tier Oro): le
   *  statistiche si calcolano al livello + boost (i livelli da salire no). */
  boost = 0,
): ConsiglioPergamene {
  const c = costi();
  const voci: Voce[] = [];
  for (const imp of owned) {
    if (imp.isFragment || isScienceAlly(imp.allyId, byIdRarity)) continue;
    const a = byIdRarity.get(`${imp.allyId}__${imp.rarity}`);
    if (!a) continue;
    const max = Math.min(a.maxLevel || LIVELLO_MAX, LIVELLO_MAX, tettoTabella());
    const da = Math.max(1, imp.level);
    if (da >= max) continue;
    const eff = (l: number) => weightedEff(getComputedAllyStats(a, l + boost, inherited), weights);
    const e0 = eff(da);
    const cumC = [0], cumG = [0];
    for (let l = da + 1; l <= max; l++) { cumC.push(cumC[cumC.length - 1]! + (c[l] ?? 0)); cumG.push(eff(l) - e0); }
    if (cumG[cumG.length - 1]! <= 1e-9) continue; // nessun guadagno con questi pesi
    voci.push({ imp, ally: a, da, cumC, cumG });
  }
  const totale = voci.reduce((s, v) => s + v.cumC[v.cumC.length - 1]!, 0);
  const B = Math.max(0, Math.min(Math.floor(budget), totale));
  const livelli = voci.reduce((s, v) => s + v.cumC.length - 1, 0);
  const esatto = B * livelli <= LIMITE_OPERAZIONI;
  const scelta = B >= totale ? voci.map(v => v.cumC.length - 1) : esatto ? dinamica(voci, B) : greedy(voci, B);
  const passi: PassoPergamene[] = [];
  let spese = 0, guadagno = 0;
  voci.forEach((v, i) => {
    const k = scelta[i]!;
    if (!k) return;
    const s0 = getComputedAllyStats(v.ally, v.da + boost, inherited), s1 = getComputedAllyStats(v.ally, v.da + k + boost, inherited);
    const d = (x: number[], y: number[]): Quattro => [0, 1, 2, 3].map(j => (y[j] ?? 0) - (x[j] ?? 0)) as Quattro;
    passi.push({
      imp: v.imp, da: v.da, a: v.da + k, pergamene: v.cumC[k]!, guadagno: v.cumG[k]!,
      dGeneral: d(s0.computedGeneral, s1.computedGeneral), dGbg: d(s0.computedGbg, s1.computedGbg), dSped: d(s0.computedSped, s1.computedSped),
    });
    spese += v.cumC[k]!; guadagno += v.cumG[k]!;
  });
  // livello più economico ancora possibile (messaggio "non bastano")
  let prossimo = 0;
  voci.forEach((v, i) => {
    const k = scelta[i]!;
    if (k < v.cumC.length - 1) { const x = v.cumC[k + 1]! - v.cumC[k]!; if (!prossimo || x < prossimo) prossimo = x; }
  });
  return { passi, spese, guadagno, prossimoCosto: prossimo, esatto: esatto || B >= totale };
}

/** Zaino a gruppi esatto: livelli scelti per ogni voce. */
function dinamica(voci: Voce[], B: number): number[] {
  const n = voci.length, W = B + 1;
  let best = new Float64Array(W);
  const scelta = new Uint8Array(n * W);
  for (let i = 0; i < n; i++) {
    const { cumC, cumG } = voci[i]!;
    const nb = new Float64Array(W);
    const base = i * W;
    for (let b = 0; b < W; b++) {
      let v = best[b]!, kk = 0;
      for (let k = 1; k < cumC.length; k++) {
        const cc = cumC[k]!;
        if (cc > b) break;
        const x = best[b - cc]! + cumG[k]!;
        if (x > v + 1e-9) { v = x; kk = k; }
      }
      nb[b] = v;
      scelta[base + b] = kk;
    }
    best = nb;
  }
  const out = new Array<number>(n).fill(0);
  let b = B;
  for (let i = n - 1; i >= 0; i--) {
    const k = scelta[i * W + b]!;
    out[i] = k;
    b -= voci[i]!.cumC[k]!;
  }
  return out;
}

/** Greedy sull'inviluppo concavo (budget molto grandi). */
function greedy(voci: Voce[], B: number): number[] {
  // segmenti dell'inviluppo concavo superiore di ogni voce: [da k, a k]
  const segmenti = voci.map(({ cumC, cumG }) => {
    const h: number[] = [0];
    for (let k = 1; k < cumC.length; k++) {
      while (h.length >= 2) {
        const a = h[h.length - 2]!, b = h[h.length - 1]!;
        // b sotto la retta a→k: non sta sull'inviluppo
        if ((cumG[b]! - cumG[a]!) * (cumC[k]! - cumC[a]!) <= (cumG[k]! - cumG[a]!) * (cumC[b]! - cumC[a]!)) h.pop(); else break;
      }
      h.push(k);
    }
    return h;
  });
  const out = new Array<number>(voci.length).fill(0);
  const pos = new Array<number>(voci.length).fill(0); // indice nell'inviluppo
  const bloccata = new Array<boolean>(voci.length).fill(false);
  let resto = B;
  for (;;) {
    let mig = -1, mr = 0;
    voci.forEach((v, i) => {
      const h = segmenti[i]!, p = pos[i]!;
      if (bloccata[i] || p + 1 >= h.length) return;
      const a = h[p]!, b = h[p + 1]!;
      const r = (v.cumG[b]! - v.cumG[a]!) / (v.cumC[b]! - v.cumC[a]! || 1);
      if (mig < 0 || r > mr) { mig = i; mr = r; }
    });
    if (mig < 0) break;
    const v = voci[mig]!, h = segmenti[mig]!, a = h[pos[mig]!]!, b = h[pos[mig]! + 1]!;
    const costo = v.cumC[b]! - v.cumC[a]!;
    if (costo <= resto) { resto -= costo; out[mig] = b; pos[mig]!++; continue; }
    // segmento troppo caro: livello per livello finché si può, poi la voce si ferma
    let k = a;
    while (k < b && v.cumC[k + 1]! - v.cumC[a]! <= resto) k++;
    resto -= v.cumC[k]! - v.cumC[a]!;
    out[mig] = k;
    bloccata[mig] = true;
  }
  return out;
}
