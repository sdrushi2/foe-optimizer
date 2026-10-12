// ─────────────────────────────────────────────────────────────────────────────
//  planner/builder/index.ts — Adattatore FoE City Builder → Planner
//
//  Esegue fase1 (entrambi i raccordi, 3 e 4 celle) e fase2 sul problema del
//  Planner e restituisce, per ciascuna variante, la sequenza di "tappe"
//  (istantanee dopo ogni passo di fase1 e dopo ogni edificio di fase2) da
//  animare, più lo stato finale da cui il motore del Planner riparte per gli
//  edifici rimasti. La variante proposta è quella con meno buchi (fase1), poi
//  più area coperta.
// ─────────────────────────────────────────────────────────────────────────────

import type { PlannerProblem } from "../engine";
import { runFase1, unkey, type BuilderInput, type Snapshot } from "./fase1";
import { runFase2 } from "./fase2";

export interface BuilderStage {
  label: string;
  placements: Map<string, { x: number; y: number }>;
  roads: Set<string>;
}
export interface BuilderVariant {
  name: "r3" | "r4";
  stages: BuilderStage[];
  /** Lati di strada non sfruttati a fine fase1 (metrica del builder). */
  holes: number;
  fase1Count: number;
  fase2Count: number;
  fase2Strategy: string | null;
  fase2Coverage: number;
  fase2Area: number;
  /** Strada verticale e riga del raccordo est (coordinate di gioco). */
  geometry: { stradaVX: number; eastMidY: number };
  /** Edifici attorno al municipio messi da fase 1 (angoli, riempimento
   *  centrale, blocco adiacente): già ottimizzati, non vanno MAI spostati. */
  fissi: string[];
}
export interface BuilderOutcome {
  variants: BuilderVariant[];
  /** Vero se la compattazione a ovest ha spostato il blocco (altrimenti il
   *  risultato coincide con quello standard). */
  compattato: boolean;
  best: "r3" | "r4";
}

/** Input del builder dal problema del Planner (stesso formato dell'export JSON della mappa). */
function toBuilderInput(problem: PlannerProblem): BuilderInput {
  return {
    buildings: problem.buildings.map(b => ({
      id: b.id, cityentity_id: b.entityId, name: b.name, width: b.w, length: b.h,
      x: b.origX, y: b.origY, road_requirement: b.roadLevel,
    })),
    // Le celle sbloccate come aree 1×1: stessa griglia delle aree originali.
    unlocked_areas: [...problem.cells].map(k => { const [x, y] = unkey(k); return { x, y, width: 1, length: 1 }; }),
  };
}

/** Tipi di piazzamento di fase 1 attorno al municipio (passi 2-4). */
const KIND_FISSI = new Set(["angolo", "riempimento", "blocco_muni"]);

export function runBuilder(problem: PlannerProblem, compattaOvest = true): BuilderOutcome | null {
  const f1 = runFase1(toBuilderInput(problem), { compattaOvest });
  if (!f1) return null;
  const townhallId = problem.buildings.find(b => b.isTownhall)?.id ?? null;
  const toStage = (s: Snapshot): BuilderStage => {
    const placements = new Map<string, { x: number; y: number }>();
    if (townhallId) placements.set(townhallId, { x: s.th.x, y: s.th.y });
    for (const p of s.placed) placements.set(p.id, { x: p.x, y: p.y });
    return { label: s.label, placements, roads: new Set(s.roads) };
  };
  const variants: BuilderVariant[] = (["r3", "r4"] as const).map(name => {
    const v = f1[name];
    const stages = v.trace.map(toStage);
    const f2 = runFase2(v.checkpoint);
    if (f2) {
      const last = stages[stages.length - 1]!;
      const placements = new Map(last.placements);
      for (const p of f2.placed) {
        placements.set(p.id, { x: p.x, y: p.y });
        stages.push({ label: `Fase 2 · ${f2.vincitore.nome}`, placements: new Map(placements), roads: last.roads });
      }
    }
    return {
      name, stages, holes: v.riepilogo.celle_buco_totali,
      fase1Count: v.riepilogo.n_edifici, fase2Count: f2?.placed.length ?? 0,
      fase2Strategy: f2?.vincitore.nome ?? null,
      fase2Coverage: f2?.vincitore.copertura ?? 0, fase2Area: f2?.areaTotale ?? 0,
      geometry: v.geometry,
      fissi: (v.trace[v.trace.length - 1]?.placed ?? []).filter(p => KIND_FISSI.has(p.kind)).map(p => p.id),
    };
  });
  const score = (v: BuilderVariant) => [v.holes, -(v.fase1Count + v.fase2Count)];
  const [a, b] = variants as [BuilderVariant, BuilderVariant];
  const sa = score(a), sb = score(b);
  const best = sb[0]! < sa[0]! || (sb[0] === sa[0] && sb[1]! < sa[1]!) ? "r4" : "r3";
  return { variants, best, compattato: f1.compattato };
}
