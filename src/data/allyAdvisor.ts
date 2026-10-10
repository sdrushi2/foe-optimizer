// ─────────────────────────────────────────────────────────────────────────────
//  allyAdvisor.ts — Consigliere Gettoni Valore (ottobre 2026)
//
//  Risponde a: "dove spendo i Gettoni Valore?", nel MEDIO-LUNGO periodo.
//  NON consiglia vendite: è una valutazione lasciata all'utente (rimossa su
//  sua richiesta insieme alla "soglia di vendita"). Modulo puro (nessuna dipendenza React).
//
//  Ipotesi concordate con l'utente:
//   - unica risorsa scarsa = Gettoni Valore. Slot in città e Pergamene Eroiche
//     NON sono vincoli (se ne vincono di continuo) → ogni alleato è valutato al
//     LIVELLO 100, mai allo stato attuale;
//   - l'evoluzione conserva il livello, non richiede il livello 100;
//   - rarità massima considerata: Epico (MAX_TARGET_RARITY). Leggendario in
//     stand-by: basta alzare la costante;
//   - solo alleati MILITARI posseduti. Gli scienza sono "non valutati" (solo
//     dati di fatto, nessuna raccomandazione); i frammentati sono esclusi
//     (non si sa quando arriveranno i frammenti mancanti);
//   - misura = la stessa efficienza della colonna EFF (pesi ATT/DIF/contesto).
//
//  Algoritmo:
//   1. effAt(alleato, rarità) = efficienza al livello 100 (stats ereditate
//      dalle rarità inferiori incluse, come getComputedAllyStats).
//   2. Coda: per ogni alleato, dalla rarità corrente, il "salto" verso la
//      rarità di arrivo con il miglior rendimento (guadagno ÷ gettoni del
//      percorso intero). Valutare il PERCORSO e non il singolo passo evita la
//      miopia: un passo debole seguito da uno forte (o un primo passo brillante
//      verso un alleato che da Epico è mediocre) è giudicato sul totale. Si
//      estrae sempre il salto migliore fra tutti gli alleati; l'alleato rientra
//      poi in coda dal nuovo punto (inviluppo convesso, greedy standard).
//   3. Copie identiche: alleati con stesso id e stessa rarità sono UNA sola
//      voce (il livello non conta, tutto è valutato al livello 100). Anche
//      durante la simulazione, se un alleato evolvendo raggiunge una rarità
//      già posseduta da un'altra sua copia, le due voci si fondono: ogni riga
//      della coda è unica per (alleato, rarità di partenza).
// ─────────────────────────────────────────────────────────────────────────────

import { getComputedAllyStats, type Ally, type ImportedAlly } from "./allies";
import type { Weights } from "../utils/calculator";

/** Rarità più alta presa in considerazione (4 = Epico). 5 = Leggendario. */
export const MAX_TARGET_RARITY = 4;
/** Livello a cui si valuta ogni alleato (medio-lungo periodo). */
const ADVISOR_LEVEL = 100;
/** Risorsa di gioco dei Gettoni Valore (chiave di ResourceStock). */
export const VALOR_RESOURCE = "historical_allies_valor_token";

export interface AdvisorStep {
  allyId: string;
  fromRarity: number;
  toRarity: number;
  /** Gettoni dell'intero salto (somma delle evoluzioni intermedie). */
  cost: number;
  /** Guadagno di efficienza al livello 100. */
  gain: number;
  /** gain / cost. */
  ratio: number;
  /** Gettoni cumulativi dall'inizio della coda (incluso questo salto). */
  cumulative: number;
  /** Variazione dei boost al livello 100 (rarità di arrivo − partenza), nello
   *  stesso ordine delle tabelle: [AttAtt, DifAtt, AttDif, DifDif]. */
  dGeneral: [number, number, number, number];
  dGbg: [number, number, number, number];
  dSped: [number, number, number, number];
}

interface AdvisorScienceAlly {
  jsonId: number;
  allyId: string;
  rarity: number;
  /** Copie possedute (stesso id e rarità, livello ignorato). */
  copies: number;
  pf: number;
  beni: number;
  beniP: number;
}

interface AdvisorResult {
  queue: AdvisorStep[];
  science: AdvisorScienceAlly[];
  /** Voci militari distinte valutate (copie identiche fuse). */
  evaluatedCount: number;
}

/** Efficienza pesata: stessa formula della colonna EFF in App.tsx. */
function weightedEff(s: { computedGeneral: number[]; computedGbg: number[]; computedSped: number[]; computedIq: number[] }, w: Weights): number {
  let e = 0;
  for (let i = 0; i < 4; i++) {
    e += (s.computedGeneral[i] ?? 0) * (w.general[i] ?? 0)
      + (s.computedGbg[i] ?? 0) * (w.gbg[i] ?? 0)
      + (s.computedSped[i] ?? 0) * (w.sped[i] ?? 0)
      + (s.computedIq[i] ?? 0) * (w.iq[i] ?? 0);
  }
  return e;
}

/** Militare o scienza. Usa la colonna `Tipo` del CSV; con un CSV più vecchio
 *  (colonna assente) ricade sulla presenza di produzioni PF/Beni. */
export function isScienceAlly(allyId: string, byIdRarity: Map<string, Ally>): boolean {
  for (let r = 1; r <= 5; r++) {
    const a = byIdRarity.get(`${allyId}__${r}`);
    if (!a) continue;
    if (a.allyType) return a.allyType === "S"; // "M"/"S" come la colonna Ally di buildings.csv
    if (a.pf > 0 || a.beni > 0 || a.beniP > 0) return true;
  }
  return false;
}

export function computeAllyAdvice(
  owned: readonly ImportedAlly[],
  byIdRarity: Map<string, Ally>,
  inherited: Map<string, Ally[]>,
  weights: Weights,
  maxRarity: number = MAX_TARGET_RARITY,
): AdvisorResult {
  const effCache = new Map<string, number | null>();
  const effAt = (allyId: string, rarity: number): number | null => {
    const key = `${allyId}__${rarity}`;
    if (!effCache.has(key)) effCache.set(key, allyEffAt100(allyId, rarity, byIdRarity, inherited, weights));
    return effCache.get(key) ?? null;
  };
  /** Gettoni per passare da `from` a `to` (somma di EvoValor delle rarità from..to-1). */
  const pathCost = (allyId: string, from: number, to: number): number | null => {
    let c = 0;
    for (let r = from; r < to; r++) {
      const a = byIdRarity.get(`${allyId}__${r}`);
      if (!a || !(a.evoValor > 0)) return null;
      c += a.evoValor;
    }
    return c;
  };

  const military: ImportedAlly[] = [];
  const seen = new Set<string>(); // "allyId__rarity" già messo in `military` (copie identiche fuse)
  const science: AdvisorScienceAlly[] = [];
  for (const imp of owned) {
    if (imp.isFragment) continue;
    const row = byIdRarity.get(`${imp.allyId}__${imp.rarity}`);
    if (!row) continue;
    if (isScienceAlly(imp.allyId, byIdRarity)) {
      const same = science.find(x => x.allyId === imp.allyId && x.rarity === imp.rarity);
      if (same) { same.copies++; continue; }
      const st = getComputedAllyStats(row, ADVISOR_LEVEL, inherited);
      science.push({
        jsonId: imp.jsonId, allyId: imp.allyId, rarity: imp.rarity, copies: 1,
        pf: st.computedPf, beni: st.computedBeni, beniP: st.computedBeniP
      });
    } else {
      const k = `${imp.allyId}__${imp.rarity}`;
      if (!seen.has(k)) { seen.add(k); military.push(imp); } // copie identiche: una sola voce
    }
  }

  // ── Coda (greedy sull'inviluppo convesso dei percorsi) ──────────────────
  type Cand = { to: number; cost: number; gain: number; ratio: number };
  const bestJump = (allyId: string, from: number): Cand | null => {
    const base = effAt(allyId, from);
    if (base === null) return null;
    let best: Cand | null = null;
    for (let to = from + 1; to <= maxRarity; to++) {
      const e = effAt(allyId, to);
      const cost = pathCost(allyId, from, to);
      if (e === null || cost === null) break;
      const gain = e - base;
      if (gain <= 0) continue;
      const ratio = gain / cost;
      // A parità di rendimento si preferisce il salto più lungo.
      if (!best || ratio > best.ratio + 1e-12 || (Math.abs(ratio - best.ratio) <= 1e-12 && to > best.to)) {
        best = { to, cost, gain, ratio };
      }
    }
    return best;
  };

  const cur = new Map<number, number>(); // jsonId -> rarità corrente simulata
  const cand = new Map<number, Cand>();
  const byJson = new Map<number, ImportedAlly>();
  for (const imp of military) {
    byJson.set(imp.jsonId, imp);
    cur.set(imp.jsonId, imp.rarity);
    const c = bestJump(imp.allyId, imp.rarity);
    if (c) cand.set(imp.jsonId, c);
  }

  const queue: AdvisorStep[] = [];
  let cumulative = 0;
  while (cand.size > 0) {
    let pickId = -1;
    let pick: Cand | null = null;
    for (const [id, c] of cand) {
      if (!pick || c.ratio > pick.ratio + 1e-12) { pick = c; pickId = id; }
    }
    if (!pick) break;
    const imp = byJson.get(pickId)!;
    const from = cur.get(pickId)!;
    const sFrom = getComputedAllyStats(byIdRarity.get(`${imp.allyId}__${from}`)!, ADVISOR_LEVEL, inherited);
    const sTo = getComputedAllyStats(byIdRarity.get(`${imp.allyId}__${pick.to}`)!, ADVISOR_LEVEL, inherited);
    const delta = (a: number[], b: number[]): [number, number, number, number] =>
      [(b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0), (b[2] ?? 0) - (a[2] ?? 0), (b[3] ?? 0) - (a[3] ?? 0)];
    cumulative += pick.cost;
    queue.push({
      allyId: imp.allyId, fromRarity: from, toRarity: pick.to,
      cost: pick.cost, gain: pick.gain, ratio: pick.ratio, cumulative,
      dGeneral: delta(sFrom.computedGeneral, sTo.computedGeneral),
      dGbg: delta(sFrom.computedGbg, sTo.computedGbg),
      dSped: delta(sFrom.computedSped, sTo.computedSped),
    });
    // Se un'altra voce dello stesso alleato è già (o sarà) a questa rarità,
    // le due voci coincidono: si tiene l'altra e si ritira questa.
    let merged = false;
    for (const [otherId, r] of cur) {
      if (otherId !== pickId && r === pick.to && byJson.get(otherId)?.allyId === imp.allyId) { merged = true; break; }
    }
    if (merged) {
      cand.delete(pickId);
      cur.delete(pickId);
      continue;
    }
    cur.set(pickId, pick.to);
    const next = bestJump(imp.allyId, pick.to);
    if (next) cand.set(pickId, next); else cand.delete(pickId);
  }

  return { queue, science, evaluatedCount: military.length };
}

/** Efficienza al livello 100 di un alleato a una data rarità (per la UI). */
export function allyEffAt100(allyId: string, rarity: number, byIdRarity: Map<string, Ally>, inherited: Map<string, Ally[]>, weights: Weights): number | null {
  const a = byIdRarity.get(`${allyId}__${rarity}`);
  return a ? weightedEff(getComputedAllyStats(a, ADVISOR_LEVEL, inherited), weights) : null;
}
