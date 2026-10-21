// ─────────────────────────────────────────────────────────────────────────────
//  planner/builder/index.ts — Adattatore FoE City Builder → Planner
//
//  Esegue fase1 (entrambi i raccordi, 3 e 4 celle) sul problema del Planner e
//  restituisce, per ciascuna variante, la sequenza di "tappe" (istantanee dopo
//  ogni passo di fase1) da animare, più lo stato finale da cui il motore del
//  Planner riparte per gli edifici rimasti. La variante proposta è quella con
//  meno buchi, poi più edifici.
//
//  Fase 2 (riempimento con gli edifici SENZA strada) NON si esegue più
//  (richiesta dell'utente): gli edifici senza strada intralciavano le nuove
//  disposizioni lungo la verticale; li piazza tutti il completamento finale
//  (fase B + fase C di completion.ts). runFase2 resta in fase2.ts per i test
//  differenziali col Python; fillMask è usato dal completamento.
// ─────────────────────────────────────────────────────────────────────────────

import type { PlannerProblem } from "../engine";
import { runFase1, unkey, type BuilderInput, type Snapshot } from "./fase1";

interface BuilderStage {
  label: string;
  placements: Map<string, { x: number; y: number }>;
  roads: Set<string>;
}
export interface BuilderVariant {
  name: "r3" | "r4" | "r5";
  stages: BuilderStage[];
  /** Lati di strada non sfruttati a fine fase1 (metrica del builder). */
  holes: number;
  fase1Count: number;
  /** Strada verticale e riga del raccordo est (coordinate di gioco). */
  geometry: { stradaVX: number; eastMidY: number };
  /** Edifici attorno al municipio messi da fase 1 (angoli, riempimento
   *  centrale, blocco adiacente): già ottimizzati, non vanno MAI spostati. */
  fissi: string[];
}
export interface BuilderOutcome {
  variants: BuilderVariant[];
  best: "r3" | "r4" | "r5";
}

/** Input del builder dal problema del Planner (stesso formato dell'export JSON della mappa). */
function toBuilderInput(problem: PlannerProblem): BuilderInput {
  return {
    // I blocchi di catena (catene.ts) NON passano dal builder: le sue regole
    // di piazzamento non sanno che solo l'inizio della catena (la Statua, la
    // locomotiva) va attaccato alla strada e li attaccava dalla parte
    // dell'ultimo anello (segnalazione dell'utente su Stralis). Li piazza il
    // completamento per primi (piazzaBlocchi).
    // Gli edifici a due corsie li piazza il nucleo (dueCorsie.ts), non il builder.
    buildings: problem.buildings.filter(b => !b.zonaStrada && b.roadLevel < 2).map(b => ({
      id: b.id, cityentity_id: b.entityId, name: b.name, width: b.w, length: b.h,
      x: b.origX, y: b.origY, road_requirement: b.roadLevel,
    })),
    // Le celle sbloccate come aree 1×1: stessa griglia delle aree originali.
    unlocked_areas: [...problem.cells].map(k => { const [x, y] = unkey(k); return { x, y, width: 1, length: 1 }; }),
  };
}

/** Tipi di piazzamento di fase 1 attorno al municipio (passi 2-4). */
const KIND_FISSI = new Set(["angolo", "riempimento", "blocco_muni"]);

/** `margineLibero`: Passo 7 senza le distanze dal bordo vietate (vedi Fase1Options.distanzeVietate). */
export function runBuilder(problem: PlannerProblem, opzioni: { margineLibero?: boolean } = {}): BuilderOutcome | null {
  const f1 = runFase1(toBuilderInput(problem), opzioni.margineLibero ? { distanzeVietate: new Set<number>() } : {});
  if (!f1) return null;
  const townhallId = problem.buildings.find(b => b.isTownhall)?.id ?? null;
  const toStage = (s: Snapshot): BuilderStage => {
    const placements = new Map<string, { x: number; y: number }>();
    if (townhallId) placements.set(townhallId, { x: s.th.x, y: s.th.y });
    for (const p of s.placed) placements.set(p.id, { x: p.x, y: p.y });
    return { label: s.label, placements, roads: new Set(s.roads) };
  };
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  /** Edifici con strada che non toccano nessuna strada (es. il laterale di
   *  una coppia fine-strada lungo quanto il capolinea: tocca la fine della
   *  strada solo in diagonale; Dani r3, ottobre 2026). Tolti dalla tappa
   *  finale: li ripiazza la ricerca come gli altri rimasti fuori (prima la
   *  ricerca locale li toglieva comunque, ma la parametrica li lasciava lì). */
  const togliScollegati = (s: BuilderStage) => {
    for (const [id, q] of [...s.placements]) {
      const b = byId.get(id);
      if (!b || b.isTownhall || b.roadLevel <= 0) continue;
      let ok = false;
      for (let i = 0; i < b.w && !ok; i++) ok = s.roads.has(`${q.x + i},${q.y - 1}`) || s.roads.has(`${q.x + i},${q.y + b.h}`);
      for (let j = 0; j < b.h && !ok; j++) ok = s.roads.has(`${q.x - 1},${q.y + j}`) || s.roads.has(`${q.x + b.w},${q.y + j}`);
      if (!ok) s.placements.delete(id);
    }
  };
  const variants: BuilderVariant[] = (["r3", "r4", "r5"] as const).map(name => {
    const v = f1[name];
    const stages = v.trace.map(toStage);
    if (stages.length) togliScollegati(stages[stages.length - 1]!);
    return {
      name, stages, holes: v.riepilogo.celle_buco_totali,
      fase1Count: v.riepilogo.n_edifici,
      geometry: v.geometry,
      fissi: (v.trace[v.trace.length - 1]?.placed ?? []).filter(p => KIND_FISSI.has(p.kind) && stages[stages.length - 1]!.placements.has(p.id)).map(p => p.id),
    };
  });
  const score = (v: BuilderVariant) => [v.holes, -v.fase1Count];
  // (r5 non entra nella scelta "best", usata solo dai test: resta fra r3 e r4)
  const [a, b] = variants as [BuilderVariant, BuilderVariant];
  const sa = score(a), sb = score(b);
  const best = sb[0]! < sa[0]! || (sb[0] === sa[0] && sb[1]! < sa[1]!) ? "r4" : "r3";
  return { variants, best };
}
