// ─────────────────────────────────────────────────────────────────────────────
//  planner/modificheCitta.ts — "Modifica città" prima di ottimizzare
//
//  L'utente toglie edifici della città e ne aggiunge altri (dall'inventario o
//  dal database) PRIMA di avviare il Planner: "se togliessi questo GE e due
//  edifici e mettessi questi 5 dell'inventario, come verrebbe la città?".
//  Le modifiche sono TEMPORANEE (vivono nel Planner aperto; Reset le azzera)
//  e non toccano il profilo. Il Planner lavora su `applicaModifiche(città)`:
//  gli edifici tolti spariscono, quelli aggiunti diventano CityMapBuilding
//  con mapEntityId "nuovo:<uid>" e nessuna posizione (la sceglie il Planner;
//  "Configurazione attuale" li salta e li piazza la ricerca).
// ─────────────────────────────────────────────────────────────────────────────

import type { Building } from "../data/buildings";
import type { CityMapBuilding } from "../data/cityMap";

/** Edificio che si può aggiungere (una riga dell'inventario o un livello del database). */
export interface CandidatoPlanner {
  entityId: string;
  name: string;
  w: number;
  h: number;
  /** Livello di strada richiesto (0, 1, 2). */
  roadLevel: number;
  isGreatBuilding: boolean;
  isMilitary: boolean;
  /** Livello nella catena di upgrade (1 = base), se l'edificio ne ha una. */
  level?: number;
  /** Inventario: copie disponibili. */
  qty?: number;
}

/** Famiglia del database: un edificio con tutti i suoi livelli (catena di upgrade). */
export interface FamigliaPlanner {
  key: string;
  name: string;
  /** In ordine di livello; un solo elemento se l'edificio non ha livelli. */
  livelli: CandidatoPlanner[];
  isGreatBuilding: boolean;
}

/** Fonti degli edifici aggiungibili (preparate da App.tsx). */
export interface CandidatiPlanner {
  inventario: CandidatoPlanner[];
  database: FamigliaPlanner[];
  /** Efficienza per entityId (ordinamento della colonna "In città"). */
  efficienza: ReadonlyMap<string, number>;
  /** (11/11/2026) Valori di un edificio per la tabella delle differenze: in città
   *  all'era della copia, dall'inventario all'era della riga, dal database all'era
   *  del giocatore se nota (altrimenti quelli del catalogo, all'era massima). */
  valori?: (entityId: string, fonte: FonteValori, era?: string) => ValoriEdificio | null;
  /** Alleati ospitati per mapEntityId (gli edifici tolti li perdono). */
  alleati?: ReadonlyMap<string, number>;
  /** Il giocatore è all'era massima del catalogo (i valori del database sono giusti)? */
  eraMassima?: boolean;
}

type FonteValori = "citta" | "inv" | "db";
/** eraMassima: valori del catalogo (era massima), quelli all'era del giocatore non ci sono. */
export interface ValoriEdificio { b: Building; eraMassima?: boolean }

/** Colonne della tabella delle differenze (stesso ordine della tabella degli edifici). */
const CAMPI_DELTA = [
  "area", "road", "pop", "fel",
  "general0", "general1", "general2", "general3", "gbg0", "gbg1", "gbg2", "gbg3",
  "sped0", "sped1", "sped2", "sped3", "iq0", "iq1", "iq2", "iq3",
  "iqMon", "iqMonB", "iqMat", "iqMatB", "iqBeni", "iqTruppe", "iqAzioni", "iqCap",
  "mon", "monb", "mat", "matb", "fp", "fpb", "med", "medb",
  "beni", "benib", "benip", "benis", "benisp", "benispb", "benig", "fur", "tr", "trne",
  "bp", "fsp", "tpm", "tpb", "adm", "mod", "rin", "imm",
] as const;
export type CampoDelta = typeof CAMPI_DELTA[number];
/** Campi in percentuale (boost: frazioni, 0,05 = 5%). */
export const CAMPI_PERCENTUALI: ReadonlySet<CampoDelta> = new Set(["iqMonB", "iqMatB", "monb", "matb", "fpb", "medb", "benib", "benispb"]);

const valoreCampo = (b: Building, k: CampoDelta): number => {
  const m = /^(general|gbg|sped|iq)(\d)$/.exec(k);
  if (m) return b[m[1] as "general" | "gbg" | "sped" | "iq"][Number(m[2])] ?? 0;
  return Number((b as unknown as Record<string, unknown>)[k]) || 0;
};

/** Differenze delle modifiche: aggiunti − tolti, colonna per colonna (area dalle celle vere). */
export function deltaModifiche(citta: readonly CityMapBuilding[], m: Modifiche, valori: NonNullable<CandidatiPlanner["valori"]>) {
  const delta = Object.fromEntries(CAMPI_DELTA.map(k => [k, 0])) as Record<CampoDelta, number>;
  let senzaDati = 0, eraMassima = 0;
  const somma = (v: ValoriEdificio | null, w: number, h: number, segno: 1 | -1) => {
    delta.area += segno * w * h;
    if (!v) { senzaDati++; return; }
    if (v.eraMassima) eraMassima++;
    for (const k of CAMPI_DELTA) if (k !== "area") delta[k] += segno * valoreCampo(v.b, k);
  };
  for (const b of citta) if (m.tolti.has(b.mapEntityId)) somma(valori(b.entityId, "citta", b.era), b.w, b.h, -1);
  for (const a of m.aggiunti) somma(valori(a.c.entityId, a.fonte), a.c.w, a.c.h, 1);
  return { delta, senzaDati, eraMassima };
}

export interface Aggiunto { uid: string; c: CandidatoPlanner; fonte: "inv" | "db" }

export interface Modifiche {
  /** mapEntityId degli edifici della città tolti. */
  tolti: ReadonlySet<string>;
  aggiunti: readonly Aggiunto[];
}

export const NESSUNA_MODIFICA: Modifiche = { tolti: new Set(), aggiunti: [] };

/** Prefisso dell'id degli edifici aggiunti. */
const PREFISSO_NUOVO = "nuovo:";
/** L'edificio (o blocco di catena) è stato aggiunto con "Modifica città"? */
export const eNuovo = (id: string) => id.includes(PREFISSO_NUOVO);

export const contaModifiche = (m: Modifiche) => m.tolti.size + m.aggiunti.length;

/** Città su cui lavora il Planner: tolti fuori, aggiunti dentro (senza posizione). */
export function applicaModifiche(citta: readonly CityMapBuilding[], m: Modifiche): readonly CityMapBuilding[] {
  if (!contaModifiche(m)) return citta;
  return [
    ...citta.filter(b => !m.tolti.has(b.mapEntityId)),
    ...m.aggiunti.map((a): CityMapBuilding => ({
      entityId: a.c.entityId, mapEntityId: PREFISSO_NUOVO + a.uid, name: a.c.name,
      x: 0, y: 0, w: a.c.w, h: a.c.h, type: "planner_new",
      isGreatBuilding: a.c.isGreatBuilding, isMilitary: a.c.isMilitary, isNeedlessRoad: false,
      isInactive: false, isSuppliesProducer: false, roadLevel: a.c.roadLevel,
    })),
  ];
}

/** Dimensioni dal campo `size` del catalogo: "lunghezza x larghezza" (h × w). */
export function dimensioniDaSize(size: string): { w: number; h: number } | null {
  const [h, w] = size.toLowerCase().split("x").map(s => parseInt(s, 10));
  return h && w ? { w, h } : null;
}

/** Nome di famiglia: senza il suffisso del livello ("… - Liv. 8", "… Lv. 3"). */
export const senzaLivello = (nome: string) => nome.replace(/\s*[-–]?\s*\b(Liv|Lv|Lvl|Level|Livello)\.?\s*\d+\s*$/i, "").trim() || nome;

/** Celle: sbloccate, occupate dagli edifici (municipio compreso) e libere per le strade. */
export function riepilogoCelle(citta: readonly CityMapBuilding[], celleSbloccate: number) {
  let edifici = 0, strade = 0;
  for (const b of citta) {
    if (b.type === "street") strade += b.w * b.h;
    else edifici += b.w * b.h;
  }
  return { sbloccate: celleSbloccate, edifici, stradeAttuali: strade, libere: celleSbloccate - edifici };
}
