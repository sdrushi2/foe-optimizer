// ─────────────────────────────────────────────────────────────────────────────
//  planner/catene.ts — Edifici a catena nel Planner (ottobre 2026)
//
//  Dati: catene.json (2.0: public/data/, scaricato all'avvio) (generato da catene.py nella pipeline dati:
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

import { datiGioco } from "../data/datiGioco";
import type { PlannerBuilding, PlannerProblem } from "./engine";

const dati = datiGioco().catene;

interface InfoCatena { catena: string; ruolo: "inizio" | "anello"; aggancio: number[][] }
const EDIFICI = (dati as unknown as { edifici: Record<string, InfoCatena> }).edifici;

/** Set di edifici a bonus di adiacenza (catene.json "set"): il Planner NON li
 *  gestisce (decisione dell'utente: set vecchi), mostra solo un avviso.
 *  Entità → nome del set. */
export const SET_DI_EDIFICI: ReadonlyMap<string, string> = new Map(
  Object.entries((dati as unknown as { set?: Record<string, { edifici: string[] }> }).set ?? {})
    .flatMap(([nome, s]) => s.edifici.map(e => [e, nome] as const)),
);

/** Nomi degli anelli di catena rimasti senza nessun inizio della loro catena
 *  (es. tolto l'unico inizio con "Modifica città"): il Planner li tratta come
 *  edifici normali. */
export function anelliSenzaInizio(edifici: ReadonlyArray<{ entityId: string; name: string }>): string[] {
  const inizi = new Set<string>(), anelli = new Map<string, string[]>();
  for (const b of edifici) {
    const info = EDIFICI[b.entityId];
    if (!info) continue;
    if (info.ruolo === "inizio") inizi.add(info.catena);
    else anelli.set(info.catena, [...(anelli.get(info.catena) ?? []), b.name]);
  }
  return [...anelli].filter(([c]) => !inizi.has(c)).flatMap(([, n]) => [...new Set(n)]);
}

/** Prefisso dell'id dei blocchi (id = prefisso + id dell'inizio). */
const PREFISSO_BLOCCO = "catena:";

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
  /** Edifici del problema prima del raggruppamento (forme dei pezzi assorbiti). */
  originali: ReadonlyMap<string, PlannerBuilding>;
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

/** Voce del problema e blocco di una catena montata (pezzi normalizzati,
 *  l'inizio per primo). */
function blocco(catena: string, pezzi: Pezzo[]): { voce: PlannerBuilding; blocco: Blocco } {
  const testa = pezzi[0]!.b;
  const w = Math.max(...pezzi.map(p => p.x + p.b.w)), h = Math.max(...pezzi.map(p => p.y + p.b.h));
  const id = PREFISSO_BLOCCO + testa.id;
  return {
    voce: {
      id, entityId: testa.entityId, name: `${testa.name} + ${pezzi.length - 1}× ${pezzi[1]!.b.name}`, w, h,
      roadLevel: Math.max(...pezzi.map(p => p.b.roadLevel)), isTownhall: false, isMilitary: false,
      origX: testa.origX, origY: testa.origY,
      // solo l'inizio della catena conta per la strada
      zonaStrada: { x: pezzi[0]!.x, y: pezzi[0]!.y, w: testa.w, h: testa.h },
    },
    blocco: { id, catena, membri: pezzi.map(p => ({ id: p.b.id, dx: p.x, dy: p.y })) },
  };
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
      const { voce, blocco: bl } = blocco(catena, pezzi);
      nuovi.push(voce);
      blocchi.set(voce.id, bl);
      for (const p of pezzi) assorbiti.add(p.b.id);
    }
  }
  const originali = new Map(problem.buildings.map(b => [b.id, b]));
  if (!blocchi.size) return { problem, blocchi, originali };
  return { problem: { ...problem, buildings: [...problem.buildings.filter(b => !assorbiti.has(b.id)), ...nuovi] }, blocchi, originali };
}

/** Anelli in parti uguali fra gli inizi (i primi ne prendono uno in più). */
function parti(_catena: string, nInizi: number, nAnelli: number): number[] {
  return Array.from({ length: nInizi }, (_, i) => Math.floor(nAnelli / nInizi) + (i < nAnelli % nInizi ? 1 : 0));
}

export interface Ricomposizione {
  /** Composizione nuova: stesso problema se gli anelli sono solo passati da
   *  una catena a un'altra della stessa forma, altrimenti un problema nuovo
   *  (catene con un numero di anelli diverso). */
  rag: Raggruppamento;
  /** Angolo in alto a sinistra delle voci riconosciute (id di `rag.problem`). */
  placements: Map<string, { x: number; y: number }>;
  /** Voci del problema di partenza gestite qui (gli altri controlli le saltano). */
  voci: Set<string>;
  /** Nomi degli anelli non attaccati a nessun inizio. */
  staccati: string[];
  /** Nomi degli inizi con una catena montata che non è un rettangolo pieno. */
  forme: string[];
  /** Nomi degli anelli tolti senza nessun inizio della loro catena tolto. */
  tolti: string[];
}

/**
 * Catene riconosciute dalla GEOMETRIA (ritorno dall'editor, "Configurazione
 * attuale"): da ogni inizio si seguono i rettangoli di aggancio fino agli
 * anelli della stessa catena. Richieste dell'utente: un anello si può
 * spostare da una catena a un'altra e una catena può avere più o meno anelli
 * delle altre.
 *  - Se ogni catena montata ha la forma di una voce del problema (stessi
 *    anelli e disposizione; prima la voce con lo stesso inizio) il problema
 *    resta quello: cambia solo quali edifici reali compongono ogni blocco.
 *  - Altrimenti le voci di quella catena si rifanno dalle catene montate
 *    (problema nuovo: la ricerca dello scenario riparte da qui). Pezzi tolti:
 *    gli anelli tolti agli inizi tolti, in parti uguali (la ricerca li può
 *    rimettere); anelli tolti senza inizi tolti: edifici sciolti.
 * Solo catene con un'unica forma di inizio e anelli tutti uguali (non
 * l'Ippodromo con le teste di chiusura: lì vale il controllo rigido).
 * `tollera` (città reale): anelli staccati e forme strane non sono errori, i
 * loro pezzi si trattano come tolti.
 */
export function ricomponiCatene(rag: Raggruppamento, pos: ReadonlyMap<string, { x: number; y: number }>, tollera = false): Ricomposizione {
  const { problem, blocchi, originali } = rag;
  const out: Ricomposizione = { rag, placements: new Map(), voci: new Set(), staccati: [], forme: [], tolti: [] };
  type Voce = { id: string; sig: string; k: number; membri: Blocco["membri"] };
  const firmaVoce = (w: number, h: number, membri: ReadonlyArray<{ dx: number; dy: number }>) =>
    `${w}x${h}|${membri.map(m => `${m.dx},${m.dy}`).join(";")}`;
  const perCatena = new Map<string, Voce[]>();
  for (const b of problem.buildings) {
    if (b.isTownhall) continue;
    const bl = blocchi.get(b.id);
    const info = EDIFICI[b.entityId];
    const catena = bl?.catena ?? (info?.ruolo === "inizio" ? info.catena : undefined);
    if (!catena) continue;
    const membri = bl?.membri ?? [{ id: b.id, dx: 0, dy: 0 }];
    perCatena.set(catena, [...(perCatena.get(catena) ?? []), { id: b.id, sig: firmaVoce(b.w, b.h, membri), k: membri.length - 1, membri }]);
  }
  const riassegnati = new Map<string, Blocco>();
  const tolte = new Set<string>(), nuove: PlannerBuilding[] = [], nuoviBlocchi: Blocco[] = [];
  for (const [catena, voci] of perCatena) {
    const teste = voci.map(v => originali.get(v.membri[0]!.id));
    // (anelli sciolti della catena: tolti a una catena in un ritorno precedente)
    const sciolti = problem.buildings.filter(b => !blocchi.has(b.id) && EDIFICI[b.entityId]?.catena === catena && EDIFICI[b.entityId]?.ruolo === "anello");
    const anelli = [...voci.flatMap(v => v.membri.slice(1).map(m => originali.get(m.id))), ...sciolti];
    if (!anelli.length) continue; // nessun anello: inizi normali
    if (teste.some(b => !b || EDIFICI[b.entityId]?.ruolo !== "inizio") || anelli.some(b => !b || EDIFICI[b.entityId]?.ruolo !== "anello")) continue;
    const t0 = teste[0]!, a0 = anelli[0]!;
    if (teste.some(b => firma(b!) !== firma(t0)) || anelli.some(b => b!.w !== a0.w || b!.h !== a0.h)) continue;
    for (const v of voci) out.voci.add(v.id);
    for (const b of sciolti) out.voci.add(b.id);
    // anelli presenti, per posizione
    const anelloIn = new Map<string, PlannerBuilding>();
    for (const a of anelli) { const p = pos.get(a!.id); if (p) anelloIn.set(`${p.x},${p.y}`, a!); }
    const usati = new Set<string>();
    type Gruppo = { pezzi: Pezzo[]; sig: string; x0: number; y0: number };
    const gruppi: Gruppo[] = [];
    const scartati = new Set<string>(); // (tollera) pezzi di catene di forma strana: come tolti
    for (const testa of teste) {
      const p = pos.get(testa!.id);
      if (!p) continue;
      const pezzi: Pezzo[] = [{ b: testa!, x: p.x, y: p.y }];
      for (;;) {
        const cur = pezzi[pezzi.length - 1]!;
        let dopo: Pezzo | undefined;
        for (const [x1, y1, x2, y2] of EDIFICI[cur.b.entityId]?.aggancio ?? []) {
          const a = anelloIn.get(`${cur.x + x1!},${cur.y + y1!}`);
          if (a && !usati.has(a.id) && a.w === x2! - x1! + 1 && a.h === y2! - y1! + 1) { dopo = { b: a, x: cur.x + x1!, y: cur.y + y1! }; break; }
        }
        if (!dopo) break;
        usati.add(dopo.b.id);
        pezzi.push(dopo);
      }
      const x0 = Math.min(...pezzi.map(q => q.x)), y0 = Math.min(...pezzi.map(q => q.y));
      const w = Math.max(...pezzi.map(q => q.x + q.b.w)) - x0, h = Math.max(...pezzi.map(q => q.y + q.b.h)) - y0;
      if (pezzi.reduce((s, q) => s + q.b.w * q.b.h, 0) !== w * h) {
        if (tollera) { for (const q of pezzi) scartati.add(q.b.id); } else out.forme.push(testa!.name);
        continue;
      }
      gruppi.push({ pezzi, x0, y0, sig: firmaVoce(w, h, pezzi.map(q => ({ dx: q.x - x0, dy: q.y - y0 }))) });
    }
    const staccati = anelli.filter(a => pos.has(a!.id) && !usati.has(a!.id));
    if (!tollera) out.staccati.push(...staccati.map(a => a!.name));
    // pezzi "tolti": non presenti, staccati o scartati (solo con tollera arrivano qui)
    const tolto = (b: PlannerBuilding) => !pos.has(b.id) || scartati.has(b.id) || (EDIFICI[b.entityId]?.ruolo === "anello" && !usati.has(b.id));
    // abbinamento gruppo → voce: prima la voce con lo stesso inizio, poi una qualunque della stessa forma
    const libere = new Set(voci);
    const abbinati = new Map<Gruppo, Voce>();
    for (const g of gruppi) {
      const v = voci.find(q => libere.has(q) && q.membri[0]!.id === g.pezzi[0]!.b.id && q.sig === g.sig);
      if (v) { abbinati.set(g, v); libere.delete(v); }
    }
    for (const g of gruppi) {
      if (abbinati.has(g)) continue;
      const v = voci.find(q => libere.has(q) && q.sig === g.sig);
      if (v) { abbinati.set(g, v); libere.delete(v); }
    }
    const testeTolte = teste.filter(b => tolto(b!)).map(b => b!);
    const anelliTolti = anelli.filter(b => tolto(b!)).map(b => b!);
    if (abbinati.size === gruppi.length && !sciolti.length) {
      // stesse forme: si riassegnano i pezzi alle voci
      const componi = (v: Voce, membri: Blocco["membri"]) => {
        // (un inizio senza anelli rimasto sé stesso non è un blocco)
        const uguale = membri.every((m, i) => m.id === v.membri[i]!.id);
        if (!uguale && (membri.length > 1 || membri[0]!.id !== v.id || blocchi.has(v.id))) riassegnati.set(v.id, { id: v.id, catena, membri });
      };
      for (const [g, v] of abbinati) {
        out.placements.set(v.id, { x: g.x0, y: g.y0 });
        componi(v, g.pezzi.map(q => ({ id: q.b.id, dx: q.x - g.x0, dy: q.y - g.y0 })));
      }
      // voci tolte (non piazzate): si ricompongono coi pezzi rimasti, stessa forma
      // (la ricerca, ripartendo, può rimetterle in città)
      const th = testeTolte.map(b => b.id), an = anelliTolti.map(b => b.id);
      for (const v of libere) componi(v, v.membri.map((m, i) => ({ ...m, id: (i ? an : th).shift() ?? m.id })));
      continue;
    }
    // forme diverse: le voci della catena si rifanno dalle catene montate
    for (const v of voci) tolte.add(v.id);
    for (const b of sciolti) tolte.add(b.id);
    const aggiungi = (pezzi: Pezzo[], x0: number, y0: number, piazzata: boolean) => {
      if (pezzi.length === 1) { nuove.push(pezzi[0]!.b); if (piazzata) out.placements.set(pezzi[0]!.b.id, { x: x0, y: y0 }); return; }
      const { voce, blocco: bl } = blocco(catena, pezzi.map(q => ({ ...q, x: q.x - x0, y: q.y - y0 })));
      nuove.push(voce);
      nuoviBlocchi.push(bl);
      if (piazzata) out.placements.set(voce.id, { x: x0, y: y0 });
    };
    // pezzi tolti: anelli in parti uguali agli inizi tolti (montati come nel Planner)
    const quote = parti(catena, testeTolte.length, testeTolte.length ? anelliTolti.length : 0);
    const perTesta = testeTolte.map((testa, i) => ({ testa, miei: anelliTolti.splice(0, quote[i] ?? 0) }));
    // anelli avanzati (nessun inizio tolto): nell'editor è un errore (anello
    // tolto da solo); nella città reale (anelli staccati) vanno alle catene più
    // corte, che la ricerca ripiazza (tutti gli anelli collegati: regola dell'utente)
    const extra = new Map<Gruppo, PlannerBuilding[]>();
    if (anelliTolti.length && !tollera) out.tolti.push(...anelliTolti.filter(a => !pos.has(a.id)).map(a => a.name)); // (gli staccati hanno già il loro errore)
    else while (anelliTolti.length && gruppi.length) {
      const lun = (g: Gruppo) => g.pezzi.length + (extra.get(g)?.length ?? 0);
      const g = gruppi.reduce((a, b) => (lun(b) < lun(a) ? b : a));
      extra.set(g, [...(extra.get(g) ?? []), anelliTolti.shift()!]);
    }
    for (const g of gruppi) {
      const piu = extra.get(g);
      const pezzi = piu ? monta(g.pezzi[0]!.b, [...g.pezzi.slice(1).map(q => q.b), ...piu], null) : null;
      if (pezzi) aggiungi(pezzi, 0, 0, false);
      else { aggiungi(g.pezzi, g.x0, g.y0, true); if (piu) nuove.push(...piu); }
    }
    for (const { testa, miei } of perTesta) {
      const pezzi = miei.length ? monta(testa, miei, null) : null;
      if (!pezzi) { nuove.push(...miei); aggiungi([{ b: testa, x: 0, y: 0 }], 0, 0, false); continue; }
      aggiungi(pezzi, 0, 0, false);
    }
    nuove.push(...anelliTolti); // (nessuna catena: edifici sciolti, come gli anelli senza inizio)
  }
  if (!riassegnati.size && !tolte.size) return out;
  const nb = new Map(blocchi);
  for (const [id, bl] of riassegnati) nb.set(id, bl);
  for (const id of tolte) nb.delete(id);
  for (const bl of nuoviBlocchi) nb.set(bl.id, bl);
  out.rag = {
    problem: tolte.size ? { ...problem, buildings: [...problem.buildings.filter(b => !tolte.has(b.id)), ...nuove] } : problem,
    blocchi: nb, originali,
  };
  return out;
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
