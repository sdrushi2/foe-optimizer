// ─────────────────────────────────────────────────────────────────────────────
//  planner/catene.ts — Edifici a catena nel Planner (ottobre 2026)
//
//  Dati: src/assets/catene.json (generato da catene.py nella pipeline dati:
//  per ogni edificio di una catena il ruolo — "inizio" o "anello" — e i
//  rettangoli di aggancio del pezzo successivo, relativi al suo angolo in
//  alto a sinistra, estremi inclusi; x = larghezza, y = altezza).
//
//  Regole (utente):
//   - gli anelli di una catena sono INTERCAMBIABILI (stessa forma, stesso
//     bonus a qualunque posizione) e si possono ridistribuire fra gli inizi
//     della stessa catena (es. 2 Statue all'onore e 10 Strade per la vittoria:
//     3+7 nella città, 5+5 o 0+10 nel Planner);
//   - TUTTI gli anelli vanno collegati, anche quelli scollegati nella città
//     originale.
//  Ogni inizio con i suoi anelli, montato, è un RETTANGOLO (verificato su
//  tutte le catene del gioco: Statua 4×3 + k Strade 2×3 = (4+2k)×3, treno
//  3×7 + k vagoni 3×2 in colonna, …): il Planner lo tratta come UN edificio
//  (blocco) che si sposta intero e non si spezza mai; a fine lavoro il blocco
//  si riscompone negli edifici originali (`espandiCatene`).
//  Ippodromo: due teste diverse (una per estremità) → blocco = testa +
//  rettilinei + eventuale testa di chiusura.
//  Il blocco eredita il fabbisogno di strada dell'inizio (gli anelli non ne
//  hanno) e conta come collegato SOLO se la strada tocca l'inizio
//  (`zonaStrada`, `toccaStradaZona` in engine.ts).
// ─────────────────────────────────────────────────────────────────────────────

import dati from "../assets/catene.json";
import type { PlannerBuilding, PlannerProblem } from "./engine";

interface InfoCatena { catena: string; ruolo: "inizio" | "anello"; aggancio: number[][] }
const EDIFICI = (dati as unknown as { edifici: Record<string, InfoCatena> }).edifici;

/** Prefisso dell'id dei blocchi (id = prefisso + id dell'inizio). */
export const PREFISSO_BLOCCO = "catena:";

export interface Blocco {
  id: string;
  catena: string;
  /** Edifici originali con lo scostamento dall'angolo in alto a sinistra del blocco. */
  membri: Array<{ id: string; dx: number; dy: number }>;
}
export interface Raggruppamento {
  /** Problema con i blocchi al posto degli edifici di catena raggruppati. */
  problem: PlannerProblem;
  blocchi: Map<string, Blocco>;
}

type Pezzo = { b: PlannerBuilding; x: number; y: number };
const sovrapposti = (a: Pezzo, x: number, y: number, w: number, h: number) =>
  a.x < x + w && x < a.x + a.b.w && a.y < y + h && y < a.y + a.b.h;

/** Monta una catena: inizio + anelli (+ testa di chiusura). null se la
 *  geometria non torna (agganci incompatibili o blocco non rettangolare). */
function monta(inizio: PlannerBuilding, anelli: PlannerBuilding[], chiusura: PlannerBuilding | null): Pezzo[] | null {
  const pezzi: Pezzo[] = [{ b: inizio, x: 0, y: 0 }];
  let cur = pezzi[0]!;
  const libero = (x: number, y: number, w: number, h: number) => !pezzi.some(p => sovrapposti(p, x, y, w, h));
  for (const a of anelli) {
    const agg = EDIFICI[cur.b.entityId]?.aggancio ?? [];
    // il rettangolo di aggancio con la forma dell'anello, non ancora occupato
    const r = agg.find(([x1, y1, x2, y2]) => x2! - x1! + 1 === a.w && y2! - y1! + 1 === a.h && libero(cur.x + x1!, cur.y + y1!, a.w, a.h));
    if (!r) return null;
    cur = { b: a, x: cur.x + r[0]!, y: cur.y + r[1]! };
    pezzi.push(cur);
  }
  if (chiusura) {
    // la testa di chiusura si aggancia ALL'INDIETRO all'ultimo pezzo
    const agg = EDIFICI[chiusura.entityId]?.aggancio ?? [];
    const r = agg.find(([x1, y1, x2, y2]) => x2! - x1! + 1 === cur.b.w && y2! - y1! + 1 === cur.b.h
      && libero(cur.x - x1!, cur.y - y1!, chiusura.w, chiusura.h));
    if (r) pezzi.push({ b: chiusura, x: cur.x - r[0]!, y: cur.y - r[1]! });
  }
  // normalizza e verifica che sia un rettangolo pieno
  const x0 = Math.min(...pezzi.map(p => p.x)), y0 = Math.min(...pezzi.map(p => p.y));
  const x1 = Math.max(...pezzi.map(p => p.x + p.b.w)), y1 = Math.max(...pezzi.map(p => p.y + p.b.h));
  const area = pezzi.reduce((t, p) => t + p.b.w * p.b.h, 0);
  if (area !== (x1 - x0) * (y1 - y0)) return null;
  return pezzi.map(p => ({ ...p, x: p.x - x0, y: p.y - y0 }));
}

/** Firma della forma di un inizio (le teste dell'Ippodromo hanno firme diverse). */
const firma = (b: PlannerBuilding) => `${b.w}x${b.h}:${JSON.stringify(EDIFICI[b.entityId]?.aggancio ?? [])}`;

/**
 * Raggruppa gli edifici di catena in blocchi. Distribuzione degli anelli fra
 * gli inizi: `distribuzione(catena, nInizi, nAnelli)` → quanti anelli a
 * ciascun inizio (somma = nAnelli); default: in parti uguali (le catene più
 * corte entrano anche nelle città piccole).
 */
export function raggruppaCatene(
  problem: PlannerProblem,
  distribuzione: (catena: string, nInizi: number, nAnelli: number) => number[] = parti,
): Raggruppamento {
  const perCatena = new Map<string, { inizi: PlannerBuilding[]; anelli: PlannerBuilding[] }>();
  for (const b of problem.buildings) {
    const info = b.isTownhall ? undefined : EDIFICI[b.entityId];
    if (!info) continue;
    const c = perCatena.get(info.catena) ?? { inizi: [], anelli: [] };
    (info.ruolo === "inizio" ? c.inizi : c.anelli).push(b);
    perCatena.set(info.catena, c);
  }
  const blocchi = new Map<string, Blocco>();
  const assorbiti = new Set<string>();
  const nuovi: PlannerBuilding[] = [];
  for (const [catena, { inizi, anelli }] of perCatena) {
    if (!inizi.length || !anelli.length) continue;
    // teste principali (la forma più numerosa) e teste di chiusura (Ippodromo)
    const perForma = new Map<string, PlannerBuilding[]>();
    for (const b of inizi) perForma.set(firma(b), [...(perForma.get(firma(b)) ?? []), b]);
    const forme = [...perForma.values()].sort((a, b) => b.length - a.length);
    const teste = forme[0]!, chiusure = forme.slice(1).flat();
    const quote = distribuzione(catena, teste.length, anelli.length);
    const coda = [...anelli];
    for (const [i, testa] of teste.entries()) {
      const k = quote[i] ?? 0;
      if (k <= 0) continue;
      const miei = coda.splice(0, k);
      const pezzi = monta(testa, miei, chiusure.shift() ?? null);
      if (!pezzi) { coda.unshift(...miei); continue; } // geometria incompatibile: si lasciano separati
      const w = Math.max(...pezzi.map(p => p.x + p.b.w)), h = Math.max(...pezzi.map(p => p.y + p.b.h));
      const id = PREFISSO_BLOCCO + testa.id;
      const nomeAnello = miei[0]!.name;
      nuovi.push({
        id, entityId: testa.entityId, name: `${testa.name} + ${miei.length}× ${nomeAnello}`, w, h,
        roadLevel: Math.max(...pezzi.map(p => p.b.roadLevel)), isTownhall: false, isMilitary: false,
        origX: testa.origX, origY: testa.origY,
        // solo l'inizio della catena conta per la strada
        zonaStrada: { x: pezzi[0]!.x, y: pezzi[0]!.y, w: testa.w, h: testa.h },
      });
      blocchi.set(id, { id, catena, membri: pezzi.map(p => ({ id: p.b.id, dx: p.x, dy: p.y })) });
      for (const p of pezzi) assorbiti.add(p.b.id);
    }
  }
  if (!blocchi.size) return { problem, blocchi };
  return { problem: { ...problem, buildings: [...problem.buildings.filter(b => !assorbiti.has(b.id)), ...nuovi] }, blocchi };
}

/** Anelli in parti uguali fra gli inizi (i primi ne prendono uno in più). */
export function parti(_catena: string, nInizi: number, nAnelli: number): number[] {
  return Array.from({ length: nInizi }, (_, i) => Math.floor(nAnelli / nInizi) + (i < nAnelli % nInizi ? 1 : 0));
}

/** Posizioni degli edifici originali: i blocchi tornano nei loro membri. */
export function espandiCatene(placements: ReadonlyMap<string, { x: number; y: number }>, blocchi: ReadonlyMap<string, Blocco>) {
  if (!blocchi.size) return placements;
  const out = new Map<string, { x: number; y: number }>();
  for (const [id, p] of placements) {
    const bl = blocchi.get(id);
    if (!bl) { out.set(id, p); continue; }
    for (const m of bl.membri) out.set(m.id, { x: p.x + m.dx, y: p.y + m.dy });
  }
  return out;
}
