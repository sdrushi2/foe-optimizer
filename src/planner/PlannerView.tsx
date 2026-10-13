// ─────────────────────────────────────────────────────────────────────────────
//  planner/PlannerView.tsx — Modulo Planner della tab Città (SPERIMENTALE)
//
//  Compilato SOLO se il flag di build SHOW_PLANNER (vite.config.ts) è true.
//  Fino a QUATTRO mappe (raccordo 3/4 × compattato/standard), eliminabili col cestino,
//  una per raccordo est a 3 celle e una a 4 celle, calcolate in parallelo
//  (FoE City Builder fase 1+2, poi ricerca degli edifici con strada e
//  riempimento). Avvia / Pausa-Riprendi / COMPLETA / Reset valgono per
//  entrambe; l'utente sceglie la disposizione che preferisce.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { CityMapBuilding } from "../data/cityMap";
import { buildPlannerProblem, runPlaceholderPlanner, type PlannerBuilding, type PlannerFrame, type PlannerProblem } from "./engine";
import { runBuilder, type BuilderVariant } from "./builder";
import { runCompletion, type StatoManuale } from "./completion";
import { calcolaRoadEff, calcolaStradeVuote, contaAngoli, DEBUG_PLANNER } from "./roadEff";
import { smussaBordi } from "./smussa";
import { renderCityMapPng } from "../components/CityMapView";
import type { UiLang } from "../data/ui-strings";
import { localDateStamp } from "../utils/format";

interface Props {
  cityMapBuildings: readonly CityMapBuilding[];
  cityMapUnlockedCells: ReadonlySet<string>;
  uiLang: UiLang;
}

/** Scenari: raccordo 3/4 celle × blocco di fase 1 compattato a ovest (c) o
 *  standard (regola 0-o->=4 anche sul lato ovest). Partono tutti in
 *  parallelo; l'utente può eliminare quelli che non gli servono. */
type VName = "r3c" | "r4c" | "r3" | "r4";
const VARIANTI: VName[] = ["r3c", "r4c", "r3", "r4"];
const tutte = <T,>(v: T): Record<VName, T> => ({ r3c: v, r4c: v, r3: v, r4: v });
interface Scenario { id: VName; v: BuilderVariant; compatto: boolean; raccordo: 3 | 4 }
/** Firma della disposizione finale del builder (per non far girare due scenari identici). */
const firma = (v: BuilderVariant) => {
  const s = v.stages[v.stages.length - 1];
  if (!s) return "";
  return [...s.placements].map(([id, p]) => `${id}@${p.x},${p.y}`).sort().join(";") + "|" + [...s.roads].sort().join(";");
};
const CELL = 10; // px per cella (il canvas è poi scalato alla larghezza disponibile)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Velocità fissa: massima (nessuna pausa tra i fotogrammi). */
const delayMs = 0;

/** Modifiche manuali durante la pausa. */
interface Edit {
  move: (id: string, x: number, y: number) => void;
  remove: (id: string) => void;
  deleteRoad: (k: string) => void;
  /** Nuova cella di strada su una cella libera (solo in pausa durante la ricerca). */
  addRoad: (k: string) => void;
}

/** Edifici con strada non collegati alla rete del municipio (bordo rosso in pausa). */
/** Edifici sovrapposti ad altri edifici (ammessi temporaneamente in pausa,
 *  per poter scambiare due edifici in una città piena): vanno risolti prima
 *  di riprendere. */
function sovrapposti(frame: PlannerFrame | null, byId: Map<string, PlannerBuilding>): Set<string> {
  const out = new Set<string>();
  if (!frame) return out;
  const cella = new Map<string, string>();
  for (const [id, p] of frame.placements) {
    const b = byId.get(id);
    if (b) for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) {
      const k = `${p.x + dx},${p.y + dy}`;
      const o = cella.get(k);
      if (o && o !== id) { out.add(o); out.add(id); } else cella.set(k, id);
    }
  }
  return out;
}

function scollegati(frame: PlannerFrame, problem: PlannerProblem, byId: Map<string, PlannerBuilding>): Set<string> {
  const k = (x: number, y: number) => `${x},${y}`;
  const per = (x: number, y: number, w: number, h: number) => {
    const out: string[] = [];
    for (let dx = 0; dx < w; dx++) out.push(k(x + dx, y - 1), k(x + dx, y + h));
    for (let dy = 0; dy < h; dy++) out.push(k(x - 1, y + dy), k(x + w, y + dy));
    return out;
  };
  const th = problem.buildings.find(b => b.isTownhall);
  const pth = th && frame.placements.get(th.id);
  const coll = new Set<string>();
  const coda = th && pth ? per(pth.x, pth.y, th.w, th.h).filter(c => frame.roads.has(c)) : [];
  for (const c of coda) coll.add(c);
  while (coda.length) {
    const [x, y] = coda.pop()!.split(",").map(Number) as [number, number];
    for (const n of [k(x + 1, y), k(x - 1, y), k(x, y + 1), k(x, y - 1)]) if (frame.roads.has(n) && !coll.has(n)) { coll.add(n); coda.push(n); }
  }
  const out = new Set<string>();
  for (const [id, p] of frame.placements) {
    const b = byId.get(id);
    if (b && !b.isTownhall && b.roadLevel > 0 && !per(p.x, p.y, b.w, b.h).some(c => coll.has(c))) out.add(id);
  }
  return out;
}

function MapCanvas({ frame, problem, byId, ge, edit, soloSenzaStrada, evidenzia, stradeVuote }: { frame: PlannerFrame | null; problem: PlannerProblem; byId: Map<string, PlannerBuilding>; ge: ReadonlySet<string>; edit?: Edit; soloSenzaStrada?: boolean; evidenzia?: ReadonlySet<string>; stradeVuote?: readonly string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = (problem.maxX - problem.minX + 1) * CELL;
  const height = (problem.maxY - problem.minY + 1) * CELL;
  /** Trascinamento in corso: edificio, presa (offset nella cella) e posizione fantasma. */
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number; x: number; y: number } | null>(null);
  /** Cella → id dell'edificio che la occupa. */
  const cellaEdificio = useMemo(() => {
    const m = new Map<string, string>();
    if (frame) for (const [id, p] of frame.placements) {
      const b = byId.get(id);
      if (b) for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) m.set(`${p.x + dx},${p.y + dy}`, id);
    }
    return m;
  }, [frame, byId]);
  /** Posizione di rilascio: "libera", "sopra" (sovrapposta ad altri edifici:
   *  ammessa temporaneamente, per gli scambi in città piene) o null (fuori
   *  dall'area sbloccata o su una strada: non ammessa). */
  const valido = (id: string, x: number, y: number): "libera" | "sopra" | null => {
    const b = byId.get(id);
    if (!b || !frame) return null;
    let sopra = false;
    for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) {
      const c = `${x + dx},${y + dy}`;
      if (!problem.cells.has(c) || frame.roads.has(c)) return null;
      const o = cellaEdificio.get(c);
      if (o && o !== id) sopra = true;
    }
    return sopra ? "sopra" : "libera";
  };
  const cella = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.floor(((e.clientX - r.left) / r.width) * (width / CELL)) + problem.minX,
      y: Math.floor(((e.clientY - r.top) / r.height) * (height / CELL)) + problem.minY,
    };
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!edit || !frame || e.button !== 0) return;
    const { x, y } = cella(e);
    const c = `${x},${y}`;
    const id = cellaEdificio.get(c);
    if (id) {
      if (byId.get(id)?.isTownhall) return;
      if (soloSenzaStrada && (byId.get(id)?.roadLevel ?? 0) > 0) return; // fase di completamento: solo edifici senza strada
      const p = frame.placements.get(id)!;
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
      setDrag({ id, ox: x - p.x, oy: y - p.y, x: p.x, y: p.y });
    } else if (frame.roads.has(c)) { if (!soloSenzaStrada) edit.deleteRoad(c); }
    else if (!soloSenzaStrada && problem.cells.has(c)) edit.addRoad(c);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const { x, y } = cella(e);
    const nx = x - drag.ox, ny = y - drag.oy;
    if (nx !== drag.x || ny !== drag.y) setDrag({ ...drag, x: nx, y: ny });
  };
  const onPointerUp = () => {
    if (!drag || !edit || !frame) { setDrag(null); return; }
    const p = frame.placements.get(drag.id);
    if (p && (p.x !== drag.x || p.y !== drag.y) && valido(drag.id, drag.x, drag.y) !== null) edit.move(drag.id, drag.x, drag.y);
    setDrag(null);
  };
  const onContextMenu = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!edit || !frame) return;
    e.preventDefault();
    const id = cellaEdificio.get(`${cella(e).x},${cella(e).y}`);
    if (id && !byId.get(id)?.isTownhall && !(soloSenzaStrada && (byId.get(id)?.roadLevel ?? 0) > 0)) edit.remove(id);
  };
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !Number.isFinite(width)) return;
    const px = (x: number) => (x - problem.minX) * CELL;
    const py = (y: number) => (y - problem.minY) * CELL;
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#1e293b";
    for (const k of problem.cells) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      ctx.fillRect(px(x), py(y), CELL - 1, CELL - 1);
    }
    if (!frame) return;
    const lastPath = new Set(frame.lastPath);
    for (const k of frame.roads) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      ctx.fillStyle = lastPath.has(k) ? "#facc15" : "#94a3b8";
      ctx.fillRect(px(x), py(y), CELL - 1, CELL - 1);
    }
    for (const [id, p] of frame.placements) {
      const b = byId.get(id);
      if (!b) continue;
      // Grandi Edifici in rosso, come nella mappa del pannello MAPPA.
      ctx.fillStyle = b.isTownhall ? "#d97706" : ge.has(id) ? "#dc2626" : b.isMilitary ? "#92400e" : b.roadLevel > 0 ? "#15803d" : "#0e7490";
      ctx.fillRect(px(p.x) + 1, py(p.y) + 1, b.w * CELL - 3, b.h * CELL - 3);
    }
    if (evidenzia?.size) {
      // DEBUG_PLANNER: edifici con road_eff > 0 (bordo giallo tratteggiato).
      ctx.save();
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 2]);
      for (const id of evidenzia) {
        const p = frame.placements.get(id), b = byId.get(id);
        if (p && b) ctx.strokeRect(px(p.x) + 1, py(p.y) + 1, b.w * CELL - 3, b.h * CELL - 3);
      }
      ctx.restore();
    }
    if (stradeVuote?.length) {
      // DEBUG_PLANNER: strade con un lato libero (bordo rosso tratteggiato).
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 2]);
      for (const k of stradeVuote) {
        const [x, y] = k.split(",").map(Number) as [number, number];
        ctx.strokeRect(px(x) + 0.5, py(y) + 0.5, CELL - 2, CELL - 2);
      }
      ctx.restore();
    }
    if (frame.probe) {
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 2;
      ctx.strokeRect(px(frame.probe.x), py(frame.probe.y), frame.probe.w * CELL - 1, frame.probe.h * CELL - 1);
    }
    if (edit) {
      // In pausa: bordo rosso sugli edifici con strada non collegati.
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      for (const id of scollegati(frame, problem, byId)) {
        const p = frame.placements.get(id)!, b = byId.get(id)!;
        ctx.strokeRect(px(p.x) + 1, py(p.y) + 1, b.w * CELL - 3, b.h * CELL - 3);
      }
      // Edifici sovrapposti (spostamento temporaneo): riquadro rosso pieno.
      ctx.lineWidth = 3;
      for (const id of sovrapposti(frame, byId)) {
        const p = frame.placements.get(id)!, b = byId.get(id)!;
        ctx.fillStyle = "rgba(239,68,68,0.35)";
        ctx.fillRect(px(p.x), py(p.y), b.w * CELL - 1, b.h * CELL - 1);
        ctx.strokeRect(px(p.x) + 1, py(p.y) + 1, b.w * CELL - 3, b.h * CELL - 3);
      }
    }
    if (drag) {
      const b = byId.get(drag.id);
      if (b) {
        const v = valido(drag.id, drag.x, drag.y);
        ctx.fillStyle = v === "libera" ? "rgba(52,211,153,0.55)" : v === "sopra" ? "rgba(249,115,22,0.6)" : "rgba(100,116,139,0.6)";
        ctx.fillRect(px(drag.x), py(drag.y), b.w * CELL - 1, b.h * CELL - 1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, problem, byId, ge, width, height, drag, edit, evidenzia, stradeVuote]);
  return (
    <canvas ref={canvasRef} className={`block h-auto w-full ${edit ? (drag ? "cursor-grabbing" : "cursor-pointer") : ""}`}
      style={edit ? { touchAction: "none" } : undefined}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}
      onContextMenu={onContextMenu}
      width={Number.isFinite(width) ? width : 0} height={Number.isFinite(height) ? height : 0} />
  );
}

/** Città esterna importata da un JSON (formato dell'export JSON del pannello
 *  MAPPA: buildings / roads / unlocked_areas), per provare il Planner sulle
 *  città che mandano gli utenti. Non viene salvata da nessuna parte. */
interface CittaEsterna { nome: string; buildings: CityMapBuilding[]; cells: Set<string>; strade: number }

/** Legge l'export JSON della mappa. Errore leggibile se il formato non torna. */
function leggiCittaJson(nome: string, testo: string): CittaEsterna {
  const d = JSON.parse(testo) as {
    buildings?: Array<{ id?: unknown; cityentity_id?: unknown; name?: unknown; width?: unknown; length?: unknown; x?: unknown; y?: unknown; road_requirement?: unknown }>;
    roads?: { single?: unknown; two_lane?: unknown };
    unlocked_areas?: Array<{ x?: unknown; y?: unknown; width?: unknown; length?: unknown }>;
  };
  if (!Array.isArray(d.buildings) || !Array.isArray(d.unlocked_areas)) throw new Error("mancano 'buildings' o 'unlocked_areas'");
  const cells = new Set<string>();
  for (const a of d.unlocked_areas) {
    const x = Number(a.x ?? 0), y = Number(a.y ?? 0), w = Number(a.width ?? 4), l = Number(a.length ?? 4);
    for (let i = 0; i < w; i++) for (let j = 0; j < l; j++) cells.add(`${x + i},${y + j}`);
  }
  const buildings: CityMapBuilding[] = d.buildings.map((b, i) => {
    const entityId = String(b.cityentity_id ?? "");
    return {
      entityId, mapEntityId: String(b.id ?? `ext-${i}`), name: String(b.name ?? entityId),
      x: Number(b.x ?? 0), y: Number(b.y ?? 0), w: Number(b.width ?? 1), h: Number(b.length ?? 1),
      type: entityId.startsWith("H_") ? "main_building" : "building",
      isGreatBuilding: entityId.startsWith("X_"), isMilitary: entityId.startsWith("M_"),
      isNeedlessRoad: false, isInactive: false, isSuppliesProducer: false,
      roadLevel: Number(b.road_requirement ?? 0),
    };
  });
  if (!buildings.some(b => b.type === "main_building")) throw new Error("manca il municipio (cityentity_id H_…)");
  const strade = Number(d.roads?.single ?? 0) + Number(d.roads?.two_lane ?? 0) * 4;
  return { nome, buildings, cells, strade };
}

export default function PlannerView({ cityMapBuildings: cittaProfilo, cityMapUnlockedCells: celleProfilo, uiLang }: Props) {
  const [esterna, setEsterna] = useState<CittaEsterna | null>(null);
  const [erroreImport, setErroreImport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cityMapBuildings: readonly CityMapBuilding[] = esterna?.buildings ?? cittaProfilo;
  const problem = useMemo(() => {
    if (!esterna) return buildPlannerProblem(cittaProfilo, celleProfilo);
    // L'export JSON non ha le posizioni delle strade, solo il loro numero.
    return { ...buildPlannerProblem(esterna.buildings, esterna.cells), originalRoadCells: esterna.strade };
  }, [esterna, cittaProfilo, celleProfilo]);
  const [frames, setFrames] = useState<Record<VName, PlannerFrame | null>>(tutte(null));
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  const finishRef = useRef(false); // "COMPLETA": chiude la ricerca degli edifici con strada (entrambe le mappe)
  const [searching, setSearching] = useState<Record<VName, boolean>>(tutte(false));
  /** Fase C (dopo COMPLETA): rifinitura continua degli edifici senza strada, fino a FERMA. */
  const stopFillRef = useRef(false);
  const [filling, setFilling] = useState<Record<VName, boolean>>(tutte(false));
  /** Scenari calcolati dal builder (undefined = non calcolati, null = città non adatta). */
  const [outcome, setOutcome] = useState<Scenario[] | null | undefined>(undefined);
  /** Scenari eliminati dall'utente (cestino): la loro corsa si ferma. */
  const [eliminati, setEliminati] = useState<Set<VName>>(new Set());
  const eliminatiRef = useRef<Set<VName>>(new Set());
  const [computing, setComputing] = useState(false);
  /** Ultimo avanzamento della ricerca per mappa (resta visibile anche dopo). */
  const [ricerca, setRicerca] = useState<Record<VName, NonNullable<PlannerFrame["search"]> | null>>(tutte(null));
  /** Ripiego quando il City Builder non si applica: una sola mappa col motore segnaposto. */
  const [soloFrame, setSoloFrame] = useState<PlannerFrame | null>(null);
  /** Pausa ("Ferma" → "Riprendi"): la ricerca attende e le mappe in pausa sono modificabili a mano. */
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [inPausa, setInPausa] = useState<Record<VName, boolean>>(tutte(false));
  /** Risolutori delle attese di ripresa, per mappa. */
  const resumeRef = useRef<Partial<Record<VName, (s: StatoManuale | null) => void>>>({});
  /** Mappe modificate a mano durante la pausa. */
  const modRef = useRef<Record<VName, boolean>>(tutte(false));
  const framesRef = useRef(frames);
  framesRef.current = frames;
  /** Generazione della corsa: i fotogrammi di una corsa annullata (Reset) vengono ignorati. */
  const genRef = useRef(0);
  // Città cambiata (re-import nello stesso profilo): si ferma la corsa in atto
  // e si riparte da zero, così non restano mappe o ricerche della città vecchia.
  const primoProblem = useRef(true);
  useEffect(() => {
    setOutcome(undefined);
    if (primoProblem.current) { primoProblem.current = false; return; }
    stopRef.current = true;
    genRef.current++;
    pausedRef.current = false;
    setPaused(false);
    for (const r of Object.values(resumeRef.current)) r?.(null);
    resumeRef.current = {};
    setCompletando(false);
    setSearching(tutte(false));
    setFilling(tutte(false));
    setInPausa(tutte(false));
    framesRef.current = tutte(null);
    setFrames(tutte(null)); setSoloFrame(null); setRicerca(tutte(null));
  }, [problem]);
  useEffect(() => () => { stopRef.current = true; for (const r of Object.values(resumeRef.current)) r?.(null); }, []);

  const byId = useMemo(() => new Map(problem.buildings.map(b => [b.id, b])), [problem]);
  /** Edifici che richiedono una strada a due corsie (non gestite: trattati come una corsia). */
  const dueCorsie = useMemo(() => problem.buildings.filter(b => b.roadLevel >= 2).length, [problem]);
  /** Edifici militari della città (senza strada se c'è Alcatraz / Nave da guerra stellare). */
  const militari = useMemo(() => problem.buildings.filter(b => b.isMilitary).length, [problem]);
  /** Avviso militari chiuso con la X: solo stato del componente (NON salvato),
   *  quindi ricompare a ogni apertura del Planner e a ogni cambio di città. */
  const [avvisoMilitariChiuso, setAvvisoMilitariChiuso] = useState(false);
  /** Idem per l'avviso delle strade a due corsie. */
  const [avvisoCorsieChiuso, setAvvisoCorsieChiuso] = useState(false);
  useEffect(() => { setAvvisoMilitariChiuso(false); setAvvisoCorsieChiuso(false); }, [problem]);
  /** Grandi Edifici (colorati in rosso come nella mappa). */
  const grandiEdifici = useMemo(() => new Set(cityMapBuildings.filter(b => b.isGreatBuilding).map(b => b.mapEntityId)), [cityMapBuildings]);
  const importaJson = async (file: File) => {
    try {
      setEsterna(leggiCittaJson(file.name.replace(/\.json$/i, ""), await file.text()));
      setErroreImport(null);
    } catch (err) {
      setErroreImport(`JSON non valido: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /** Riprende tutte le mappe in pausa, passando le disposizioni modificate a mano. */
  const riprendi = () => {
    setSmussaInPausa(false);
    pausedRef.current = false;
    setPaused(false);
    for (const v of VARIANTI) {
      const res = resumeRef.current[v];
      if (!res) continue;
      delete resumeRef.current[v];
      const f = framesRef.current[v];
      res(modRef.current[v] && f ? { placements: f.placements, roads: f.roads } : null);
      modRef.current[v] = false;
    }
  };
  const pausa = () => { pausedRef.current = true; setPaused(true); };

  /** "Smussa i bordi" (idea dell'utente, solo in pausa): sulle mappe in pausa
   *  si spostano/scambiano gli edifici con strada per ridurre gli angoli di 90°
   *  del contorno, finché l'utente non lo ferma. Il risultato conta come
   *  modifica a mano: Riprendi o COMPLETA ripartono da lì. */
  const [smussando, setSmussando] = useState(false);
  /** Smussatura messa in pausa dall'utente (il suo pulsante mostra "Riprendi"). */
  const [smussaInPausa, setSmussaInPausa] = useState(false);
  /** Fase 3 avviata (COMPLETA premuto): il suo pulsante diventa Pausa/Riprendi. */
  const [completando, setCompletando] = useState(false);
  const stopSmussaRef = useRef(false);
  const smussa = async () => {
    stopSmussaRef.current = false;
    setSmussaInPausa(false);
    setSmussando(true);
    const gen = genRef.current;
    await Promise.all(visibili.filter(sc => inPausa[sc.id] && framesRef.current[sc.id]).map(async sc => {
      const f0 = framesRef.current[sc.id]!;
      await smussaBordi(problem, f0, {
        fissi: new Set(sc.v.fissi),
        shouldStop: () => stopSmussaRef.current || stopRef.current || gen !== genRef.current,
        onFrame: f => {
          if (gen !== genRef.current) return;
          const nf: PlannerFrame = { ...f, lastPath: f0.lastPath, done: false };
          framesRef.current = { ...framesRef.current, [sc.id]: nf };
          setFrames(prev => ({ ...prev, [sc.id]: nf }));
          modRef.current[sc.id] = true;
        },
      });
    }));
    setSmussando(false);
  };

  /** Modifica manuale della mappa v (solo in pausa): aggiorna il fotogramma mostrato. */
  const modifica = (v: VName, cambia: (pl: Map<string, { x: number; y: number }>, rd: Set<string>) => void, nuovaStrada?: string) => {
    const f = framesRef.current[v];
    if (!f) return;
    const pl = new Map(f.placements), rd = new Set(f.roads);
    cambia(pl, rd);
    // Le strade aggiunte a mano sono nuove: gialle come le altre strade nuove.
    const lastPath = [...f.lastPath.filter(k => rd.has(k)), ...(nuovaStrada ? [nuovaStrada] : [])];
    const nf: PlannerFrame = { ...f, placements: pl, roads: rd, lastPath, probe: null, placed: pl.size };
    framesRef.current = { ...framesRef.current, [v]: nf };
    setFrames(prev => ({ ...prev, [v]: nf }));
    modRef.current[v] = true;
  };
  const editFor = (v: VName): Edit => ({
    // delete + set: l'edificio spostato va in cima (disegnato e selezionato per primo se sovrapposto)
    move: (id, x, y) => modifica(v, pl => { pl.delete(id); pl.set(id, { x, y }); }),
    remove: (id) => modifica(v, pl => { pl.delete(id); }),
    deleteRoad: (k) => modifica(v, (_pl, rd) => { rd.delete(k); }),
    addRoad: (k) => modifica(v, (_pl, rd) => { rd.add(k); }, k),
  });

  /** Anima le tappe del builder per una variante, poi completamento + ricerca. */
  const eseguiVariante = async (sc: Scenario) => {
    const { id, v } = sc;
    const fermato = () => stopRef.current || eliminatiRef.current.has(id);
    const gen = genRef.current;
    const setF = (f: PlannerFrame) => {
      if (gen !== genRef.current) return;
      framesRef.current = { ...framesRef.current, [id]: f };
      setFrames(prev => ({ ...prev, [id]: f }));
      if (f.search) setRicerca(prev => ({ ...prev, [id]: f.search! }));
    };
    let prev: BuilderVariant["stages"][number] | null = null;
    for (const [i, s] of v.stages.entries()) {
      if (fermato()) return;
      const nuovi = [...s.placements.keys()].filter(id => !prev?.placements.has(id));
      const nb = nuovi.length === 1 ? byId.get(nuovi[0]!) : undefined;
      const np = nb ? s.placements.get(nb.id)! : null;
      setF({
        placements: s.placements, roads: s.roads,
        probe: nb && np ? { x: np.x, y: np.y, w: nb.w, h: nb.h } : null,
        lastPath: [...s.roads].filter(r => !prev?.roads.has(r)),
        placed: s.placements.size, unplaced: [], iterations: i, done: false, label: s.label,
      });
      prev = s;
      await sleep(0);
    }
    if (!prev || fermato()) return;
    await runCompletion(problem, {
      delayMs, onFrame: setF, shouldStop: fermato,
      initial: { placements: new Map(prev.placements), roads: new Set(prev.roads) }, geometry: v.geometry, fissi: v.fissi,
      shouldFinishSearch: () => finishRef.current,
      onSearchActive: (a) => setSearching(s => ({ ...s, [id]: a })),
      shouldStopFill: () => stopFillRef.current,
      onFillActive: (a) => setFilling(s => ({ ...s, [id]: a })),
      isPaused: () => pausedRef.current,
      waitResume: () => new Promise<StatoManuale | null>(res => {
        if (fermato() || !pausedRef.current) { res(null); return; } // ripresa già avvenuta
        resumeRef.current[id] = res;
      }),
      onPaused: (p) => setInPausa(s => ({ ...s, [id]: p })),
    });
    setSearching(s => ({ ...s, [id]: false }));
  };

  const start = async () => {
    genRef.current++;
    stopRef.current = false;
    finishRef.current = false;
    setCompletando(false);
    stopFillRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setRicerca(tutte(null));
    setRunning(true);
    let out = outcome;
    if (out === undefined) {
      setComputing(true);
      await sleep(30); // lascia disegnare "calcolo in corso" (il builder è sincrono)
      const oc = runBuilder(problem, true);
      // Lo scenario standard serve solo se la compattazione ha spostato il blocco.
      const os = oc && !oc.compattato ? null : runBuilder(problem, false);
      const lista: Scenario[] = [];
      for (const v of oc?.variants ?? []) lista.push({ id: v.name === "r3" ? "r3c" : "r4c", v, compatto: true, raccordo: v.name === "r3" ? 3 : 4 });
      for (const v of os?.variants ?? []) {
        // Se il blocco era già al bordo, lo scenario standard coincide con quello compattato: non si duplica.
        const gemello = lista.find(x => x.raccordo === (v.name === "r3" ? 3 : 4));
        if (gemello && firma(gemello.v) === firma(v)) continue;
        lista.push({ id: v.name, v, compatto: false, raccordo: v.name === "r3" ? 3 : 4 });
      }
      out = lista.length ? lista : null;
      setOutcome(out);
      setComputing(false);
    }
    eliminatiRef.current = new Set();
    setEliminati(new Set());
    if (out) {
      // Tutti gli scenari procedono in parallelo (si alternano a ogni pausa).
      await Promise.all(out.map(sc => eseguiVariante(sc)));
    } else if (!stopRef.current) {
      await runPlaceholderPlanner(problem, { delayMs, onFrame: setSoloFrame, shouldStop: () => stopRef.current });
    }
    setRunning(false);
  };
  /** Reset: interrompe anche una corsa in pausa. */
  const reset = () => {
    setCompletando(false);
    stopSmussaRef.current = true;
    stopRef.current = true;
    genRef.current++;
    riprendi();
    setSearching(tutte(false));
    setFilling(tutte(false));
    setInPausa(tutte(false));
    framesRef.current = tutte(null);
    setFrames(tutte(null)); setSoloFrame(null); setRicerca(tutte(null));
  };
  /** Scenari visibili (calcolati e non eliminati). */
  const visibili = (outcome ?? []).filter(sc => !eliminati.has(sc.id));
  const anySearching = visibili.some(sc => searching[sc.id]);
  /** Edifici sovrapposti sulle mappe in pausa: finché ce ne sono non si può riprendere. */
  const nSovrapposti = visibili.reduce((t, sc) => t + (inPausa[sc.id] ? sovrapposti(frames[sc.id], byId).size : 0), 0);
  const anyFilling = visibili.some(sc => filling[sc.id]);
  /** Cestino: ferma ed elimina uno scenario (resta almeno uno). */
  const elimina = (id: VName) => {
    eliminatiRef.current = new Set([...eliminatiRef.current, id]);
    setEliminati(new Set(eliminatiRef.current));
    const res = resumeRef.current[id];
    if (res) { delete resumeRef.current[id]; res(null); }
    setSearching(s => ({ ...s, [id]: false }));
    setFilling(s => ({ ...s, [id]: false }));
    setInPausa(s => ({ ...s, [id]: false }));
  };

  /** Riga di stato di una mappa: edifici CON STRADA piazzati (verde = tutti,
   *  rosso = ne mancano), strade attuali/della città di partenza (verde = meno della città di partenza, rosso = di più)
   *  e disposizioni provate dalla ricerca. */
  const conStrada = useMemo(() => problem.buildings.filter(b => !b.isTownhall && b.roadLevel > 0), [problem]);
  const senzaStrada = useMemo(() => problem.buildings.filter(b => !b.isTownhall && b.roadLevel === 0), [problem]);
  const stats = (f: PlannerFrame | null, valutate?: number) => {
    if (!f) return null;
    const piazzati = conStrada.filter(b => f.placements.has(b.id)).length;
    const piazzatiSenza = senzaStrada.filter(b => f.placements.has(b.id)).length;
    return (
    <span className="text-slate-400">
      piazzati: con strada <b className={piazzati >= conStrada.length ? "text-emerald-400" : "text-red-400"}>{piazzati}/{conStrada.length}</b>
      {" · "}senza strada <b className={piazzatiSenza >= senzaStrada.length ? "text-emerald-400" : "text-red-400"}>{piazzatiSenza}/{senzaStrada.length}</b>
      {" · "}strade <b className={f.roads.size < problem.originalRoadCells ? "text-emerald-400" : f.roads.size > problem.originalRoadCells ? "text-red-400" : "text-slate-100"}>{f.roads.size}/{problem.originalRoadCells}</b>
      {" · "}<span title="Angoli di 90° del contorno di edifici e strade (esclusi quelli contro il bordo della mappa): meno angoli, riempimento più facile">angoli <b className="text-slate-100">{contaAngoli(problem, f.placements, f.roads)}</b></span>
      {valutate !== undefined && <>{" · "}{valutate.toLocaleString()} disposizioni</>}
    </span>
    );
  };

  /** Scarica la mappa come PNG, con lo stesso disegno dell'export del pannello MAPPA (renderCityMapPng). */
  const scaricaPng = (f: PlannerFrame, n: VName) => {
    const edifici: CityMapBuilding[] = [];
    for (const b of cityMapBuildings) {
      if (b.type === "street") continue;
      const p = f.placements.get(b.mapEntityId);
      if (p) edifici.push({ ...b, x: p.x, y: p.y });
    }
    for (const k of f.roads) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      edifici.push({
        entityId: "street", mapEntityId: `planner-road-${k}`, name: "", x, y, w: 1, h: 1, type: "street",
        isGreatBuilding: false, isMilitary: false, isNeedlessRoad: false, isInactive: false, isSuppliesProducer: false, roadLevel: 0,
      });
    }
    const aree = [...problem.cells].map(k => { const [x, y] = k.split(",").map(Number) as [number, number]; return { x, y, width: 1, length: 1 }; });
    try {
      const canvas = document.createElement("canvas");
      renderCityMapPng(canvas, edifici, aree, 2, uiLang);
      const link = document.createElement("a");
      const sc = outcome?.find(x => x.id === n);
      link.download = `foe-planner-raccordo${sc?.raccordo ?? 3}${sc && !sc.compatto ? "-standard" : ""}-${localDateStamp()}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("[FOE] Planner PNG export failed:", err);
    }
  };

  return (
    <div className="mb-3 rounded border border-fuchsia-700/50 bg-slate-900/40 text-[13px] text-slate-300">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <span className="font-bold uppercase tracking-wider text-fuchsia-300">🧭 Planner</span>
        <span className="mr-2 text-slate-500">sperimentale</span>
        {/* Tre fasi, ciascuna col suo pulsante che fa da avvio, pausa e
            ripresa (richiesta dell'utente): 1. ricerca, 2. smussatura dei
            bordi (solo con la ricerca in pausa), 3. completamento. */}
        {!running ? (
          <button type="button" onClick={() => void start()}
            className="rounded border border-emerald-600 px-3 py-1 font-bold text-emerald-300 hover:bg-emerald-950">▶ Avvia</button>
        ) : paused && !completando ? (
          <button type="button" onClick={riprendi} disabled={nSovrapposti > 0 || smussando}
            title={nSovrapposti > 0 ? "Ci sono edifici sovrapposti (riquadro rosso): spostali in un posto libero prima di riprendere"
              : "La ricerca continua a cercare disposizioni migliori partendo da quelle mostrate (anche modificate a mano o smussate)"}
            className="rounded border border-sky-500 bg-sky-950 px-3 py-1 font-bold text-sky-300 hover:bg-sky-900 disabled:opacity-40">▶ Riprendi</button>
        ) : (
          <button type="button" disabled={completando || !anySearching} onClick={pausa}
            title="Mette in pausa la ricerca: puoi spostare gli edifici, eliminare strade e togliere edifici, smussare i bordi o completare"
            className="rounded border border-red-600 px-3 py-1 font-bold text-red-300 hover:bg-red-950 disabled:opacity-40">⏸ Pausa</button>
        )}
        {smussando ? (
          <button type="button" onClick={() => { stopSmussaRef.current = true; setSmussaInPausa(true); }}
            className="rounded border border-violet-500 bg-violet-950 px-3 py-1 font-bold text-violet-300 hover:bg-violet-900">⏸ Pausa</button>
        ) : (
          <button type="button" onClick={() => void smussa()} disabled={!paused || completando || !anySearching || nSovrapposti > 0}
            title="Solo con la ricerca in pausa: sposta e scambia gli edifici con strada (strade invariate) per ridurre gli angoli di 90° del contorno e i buchi: il riempimento finale incastra meglio i pezzi piccoli. Continua finché non lo metti in pausa"
            className="rounded border border-violet-500 px-3 py-1 font-bold text-violet-300 hover:bg-violet-950 disabled:opacity-40">{smussaInPausa ? "▶ Riprendi" : "✨ Smussa i bordi"}</button>
        )}
        {!completando ? (
          <button type="button" disabled={!paused || !anySearching || nSovrapposti > 0 || smussando}
            onClick={() => { finishRef.current = true; setCompletando(true); riprendi(); }}
            title="Solo con la ricerca in pausa: chiude la ricerca su TUTTE le mappe (ciascuna tiene quella mostrata) e passa al riempimento con gli edifici senza strada"
            className="rounded border border-amber-500 px-3 py-1 font-bold text-amber-300 hover:bg-amber-950 disabled:opacity-40">⏭ COMPLETA</button>
        ) : paused ? (
          <button type="button" onClick={riprendi} disabled={nSovrapposti > 0}
            title={nSovrapposti > 0 ? "Ci sono edifici sovrapposti (riquadro rosso): spostali in un posto libero prima di riprendere" : "Riprende il riempimento"}
            className="rounded border border-amber-500 bg-amber-950 px-3 py-1 font-bold text-amber-300 hover:bg-amber-900 disabled:opacity-40">▶ Riprendi</button>
        ) : (
          <button type="button" disabled={!anyFilling} onClick={pausa}
            title="Mette in pausa il riempimento: puoi spostare o togliere gli edifici senza strada"
            className="rounded border border-amber-500 px-3 py-1 font-bold text-amber-300 hover:bg-amber-950 disabled:opacity-40">⏸ Pausa</button>
        )}
        <button type="button" disabled={running && !paused} onClick={reset}
          className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800 disabled:opacity-40">↺ Reset</button>
        <span className="ml-2 text-slate-400">
          {problem.buildings.length} edifici · {problem.originalRoadCells} strade
        </span>
        {/* Città esterna (export JSON del pannello MAPPA di un altro utente):
            strumento di test, visibile solo con DEBUG_PLANNER. */}
        {DEBUG_PLANNER && (<>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            onChange={e => { const f = e.currentTarget.files?.[0]; if (f) void importaJson(f); e.currentTarget.value = ""; }} />
          <button type="button" disabled={running && !paused} onClick={() => fileRef.current?.click()}
            title="Carica l'export JSON della mappa di un'altra città (pulsante JSON del pannello MAPPA) per provarci il Planner. Non viene salvato."
            className="rounded border border-slate-600 px-2 py-1 text-[12px] hover:bg-slate-800 disabled:opacity-40">📂 Importa JSON</button>
          {esterna && (
            <>
              <span className="rounded bg-violet-900/60 px-2 py-0.5 text-[12px] font-bold text-violet-200" title="Il Planner sta usando questa città importata">🏙 {esterna.nome}</span>
              <button type="button" disabled={running && !paused} onClick={() => setEsterna(null)}
                className="rounded border border-slate-600 px-2 py-0.5 text-[12px] hover:bg-slate-800 disabled:opacity-40">↩ Città del profilo</button>
            </>
          )}
          {erroreImport && <span className="text-[12px] text-red-400">{erroreImport}</span>}
        </>)}
        {paused && nSovrapposti > 0 && <span className="ml-2 font-bold text-red-400">⚠ {nSovrapposti} edifici sovrapposti: risolvi prima di riprendere</span>}
        {computing && <span className="ml-2 text-amber-300">City Builder: calcolo in corso…</span>}
        {outcome === null && <span className="ml-2 text-red-300">City Builder: città non adatta (servono almeno 4 edifici con strada e spazio attorno al municipio) — uso il motore semplice.</span>}
      </div>
      {dueCorsie > 0 && !avvisoCorsieChiuso && (
        // Avviso NON bloccante: il Planner traccia solo strade a una corsia.
        <div role="alert" className="relative mx-3 mt-3 flex items-start gap-2 rounded border-2 border-amber-500 bg-amber-950/60 py-2 pl-3 pr-9 text-[13px] text-amber-100">
          <button type="button" onClick={() => setAvvisoCorsieChiuso(true)} title="Chiudi" aria-label="Chiudi avviso"
            className="absolute right-1.5 top-1.5 rounded px-1.5 leading-none text-amber-300 hover:bg-amber-900 hover:text-white">✕</button>
          <span className="text-lg leading-none">⚠️</span>
          <span>
            <b className="text-amber-300">Strade a due corsie NON gestite.</b>{" "}
            La città ha <b>{dueCorsie}</b> {dueCorsie === 1 ? "edificio che richiede" : "edifici che richiedono"} una strada a due corsie:
            il Planner li tratta come se bastasse una strada a una corsia e traccia solo strade a una corsia.
            Puoi usarlo lo stesso, ma per questi edifici il risultato non sarà accurato.
          </span>
        </div>
      )}
      {problem.geRifornimento.length > 0 && militari > 0 && !avvisoMilitariChiuso && (
        // Avviso informativo: con questi GE i militari restano senza strada.
        <div role="status" className="relative mx-3 mt-3 flex items-start gap-2 rounded border-2 border-sky-500 bg-sky-950/60 py-2 pl-3 pr-9 text-[13px] text-sky-100">
          <button type="button" onClick={() => setAvvisoMilitariChiuso(true)} title="Chiudi" aria-label="Chiudi avviso"
            className="absolute right-1.5 top-1.5 rounded px-1.5 leading-none text-sky-300 hover:bg-sky-900 hover:text-white">✕</button>
          <span className="text-lg leading-none">ℹ️</span>
          <span>
            <b className="text-sky-300">Edifici militari senza strada.</b>{" "}
            In città c'è <b>{[...new Set(problem.geRifornimento)].join(" e ")}</b>, che produce ogni 24 ore le truppe di un edificio militare
            anche se non è collegato alla strada: il Planner tratta quindi {militari === 1 ? "l'edificio militare" : <>i <b>{militari}</b> edifici militari</>} come
            edifici senza strada e non {militari === 1 ? "lo collega" : "li collega"} alle strade.
          </span>
        </div>
      )}
      <div className="p-3">
          {outcome === null ? (
            <div>
              <div className="mb-1 text-[12px]">{stats(soloFrame)}</div>
              <div className="overflow-hidden rounded border border-slate-800"><MapCanvas frame={soloFrame} problem={problem} byId={byId} ge={grandiEdifici} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Sempre due colonne: una mappa sola resta a metà larghezza (a tutta
                  larghezza diventava troppo alta). */}
              {visibili.map(sc => {
                const n = sc.id;
                const f = frames[n];
                const eff = DEBUG_PLANNER && f ? calcolaRoadEff(problem.buildings, f.placements, f.roads) : null;
                const vuote = DEBUG_PLANNER && f ? calcolaStradeVuote(problem.buildings, f.placements, f.roads, problem.cells) : null;
                const conGemello = (outcome ?? []).some(x => x.raccordo === sc.raccordo && x.id !== n);
                return (
                  <div key={n} className="min-w-0 rounded border border-slate-800 p-2">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <b className="text-fuchsia-300">Raccordo a {sc.raccordo} celle</b>
                      {conGemello && (
                        <span className={`rounded px-1.5 text-[11px] font-bold ${sc.compatto ? "bg-fuchsia-900/60 text-fuchsia-200" : "bg-slate-700 text-slate-200"}`}
                          title={sc.compatto ? "Blocco di fase 1 spostato fino al bordo ovest (più spazio a est per le strade)" : "Blocco di fase 1 a 0 o almeno 4 celle dal bordo ovest (regola originale)"}>
                          {sc.compatto ? "compattato" : "standard"}
                        </span>
                      )}
                      <span className="text-[12px]">{stats(f, ricerca[n]?.valutate)}</span>
                      <button type="button" disabled={!f} onClick={() => f && scaricaPng(f, n)}
                        className="ml-auto rounded border border-emerald-600 px-2 py-0.5 text-[12px] font-bold text-emerald-300 hover:bg-emerald-950 disabled:opacity-40">
                        ⬇ Scarica PNG
                      </button>
                      <button type="button" disabled={visibili.length <= 1} onClick={() => elimina(n)}
                        title="Elimina questo scenario: la sua ricerca si ferma e le altre proseguono"
                        className="rounded border border-red-700 px-2 py-0.5 text-[12px] text-red-300 hover:bg-red-950 disabled:opacity-40">🗑</button>
                    </div>
                    <div className={`overflow-hidden rounded border ${inPausa[n] ? "border-sky-500" : "border-slate-800"}`}>
                      <MapCanvas frame={f} problem={problem} byId={byId} ge={grandiEdifici} edit={inPausa[n] && paused && !smussando ? editFor(n) : undefined} soloSenzaStrada={filling[n]}
                        evidenzia={eff ? new Set(eff.voci.map(v => v.id)) : undefined} stradeVuote={vuote ?? undefined} />
                    </div>
                    {eff && (
                      // DEBUG_PLANNER (roadEff.ts): edifici con road_eff > 0 = celle di strada toccate − lato corto.
                      <div className="mt-1 rounded border border-yellow-700/60 bg-yellow-950/20 px-2 py-1 text-[11px] text-yellow-100">
                        <div className="font-bold text-yellow-300">
                          DEBUG road_eff · num_road_eff_pos <span className="text-white">{eff.num}</span> · sum_road_eff_pos <span className="text-white">{eff.sum}</span>
                          {" · "}<span className="text-red-300">strade_vuote <span className="text-white">{vuote?.length ?? 0}</span></span>
                        </div>
                        {eff.voci.length > 0 && (
                          <div className="mt-0.5 max-h-32 overflow-y-auto">
                            {eff.voci.map(v => (
                              <div key={v.id}>+{v.eff} · {v.name} {v.w}×{v.h} · {v.strade} celle di strada (lato corto {Math.min(v.w, v.h)})</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
