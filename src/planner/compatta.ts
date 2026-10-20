// ─────────────────────────────────────────────────────────────────────────────
//  planner/compatta.ts — Compattazione della città prima del riempimento
//
//  Segnalazioni dell'utente (città di stefcape, ottobre 2026):
//   1. i blocchi di catena finivano lungo una strada, con gli ANELLI (che non
//      richiedono strada) attaccati alla strada: strade sprecate;
//   2. fra due strade orizzontali restavano fasce libere alte UNA riga, che
//      nessun edificio vero (lati >= 2) può riempire. Spesso basta alzare o
//      abbassare di 1 una strada con tutti gli edifici attaccati (o un gruppo
//      di strade parallele insieme) per chiudere la fessura.
//
//  Si lavora sulla disposizione degli edifici CON strada a ricerca finita,
//  prima degli edifici senza strada (completion.ts, dopo la ricerca):
//   - fasce: per ogni tratto di strada orizzontale (e verticale) le celle
//     senza strade perpendicolari si spostano di ±1..±3 insieme agli edifici
//     che le toccano (anche più tratti paralleli consecutivi insieme); la
//     mossa si tiene solo se resta tutto collegato e i BUCHI (celle libere
//     che nessun edificio senza strada con lati >= 2 può coprire)
//     diminuiscono. Le strade non cambiano di numero;
//   - catene: un blocco con strade accanto agli anelli si sposta in un posto
//     libero in cui la strada tocca l'inizio e NON gli anelli (a parità: meno
//     buchi, più contatto con il resto della città);
//   - doppi angoli: due tratti paralleli sfalsati di 1-3 righe e uniti da un
//     breve raccordo ("Z") diventano un tratto solo (strade in meno);
//   - buchi in fondo: gli edifici ai lati di un ramo si impilano verso la
//     radice e la punta rimasta senza edifici si accorcia (col tappo);
//   - potatura: celle di strada in punta che non servono più a nessun
//     edificio vengono tolte.
//  Municipio e edifici fissi (fase 1 del builder) non si spostano mai.
// ─────────────────────────────────────────────────────────────────────────────

import { perimetroCoda, perimetroZona, toccaStradaZona, type PlannerBuilding, type PlannerProblem } from "./engine";

type Pos = { x: number; y: number };
export interface Compattazione {
  placements: Map<string, Pos>;
  roads: Set<string>;
  /** Doppi angoli raddrizzati, mosse di fasce applicate, blocchi di catena spostati, strade potate. */
  raddrizzati: number;
  fasce: number;
  /** Buchi (celle che nessun edificio senza strada con lati >= 2 può coprire) prima e dopo. */
  buchiPrima: number;
  buchiDopo: number;
  catene: number;
  /** Rami di strada accorciati portando i buchi in fondo (2b). */
  scorsi: number;
  potate: number;
}

const key = (x: number, y: number) => `${x},${y}`;

/** Passate massime della compattazione (vedi compattaCitta). */
const MAX_PASSATE = 4;
/**
 * Compattazione ripetuta finché toglie strade o buchi (al massimo
 * MAX_PASSATE): una passata non arriva sempre al punto fermo, perché uno
 * stadio può aprire una mossa a uno stadio precedente (caso dell'utente su
 * Sdrushi3, Girandola: dopo fasce e potatura restavano 2 buchi sopra la
 * strada est, chiusi dallo scambio di 2b solo alla passata successiva; la
 * pagina restava ferma a 70 strade invece di 69).
 */
export function compattaCitta(problem: PlannerProblem, placements0: ReadonlyMap<string, Pos>, roads0: ReadonlySet<string>, fissi: ReadonlySet<string>): Compattazione {
  const somma = (a: Compattazione, n: Compattazione): Compattazione => ({ ...n, raddrizzati: a.raddrizzati + n.raddrizzati, fasce: a.fasce + n.fasce, catene: a.catene + n.catene, scorsi: a.scorsi + n.scorsi, potate: a.potate + n.potate, buchiPrima: a.buchiPrima });
  const fermo = (a: Compattazione) => a.raddrizzati + a.fasce + a.catene + a.scorsi + a.potate === 0;
  let cur = compattaUnaVolta(problem, placements0, roads0, fissi);
  let mig = cur;
  // si ripete finché una passata cambia qualcosa (anche senza guadagno: può
  // aprire la mossa della passata dopo); si tiene la migliore (strade, buchi)
  for (let i = 1; i < MAX_PASSATE && !fermo(cur); i++) {
    const n = compattaUnaVolta(problem, cur.placements, cur.roads, fissi);
    cur = somma(cur, n);
    if (n.roads.size < mig.roads.size || (n.roads.size === mig.roads.size && n.buchiDopo < mig.buchiDopo)) mig = cur;
    if (fermo(n)) break;
  }
  return mig;
}

function compattaUnaVolta(problem: PlannerProblem, placements0: ReadonlyMap<string, Pos>, roads0: ReadonlySet<string>, fissi: ReadonlySet<string>): Compattazione {
  const { minX, minY } = problem;
  const GW = problem.maxX - minX + 1, GH = problem.maxY - minY + 1, N = GW * GH;
  const gi = (x: number, y: number) => { const i = x - minX, j = y - minY; return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : j * GW + i; };
  const cella = new Uint8Array(N);
  for (const k of problem.cells) { const c = k.indexOf(","), g = gi(Number(k.slice(0, c)), Number(k.slice(c + 1))); if (g >= 0) cella[g] = 1; }
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  const pl = new Map(placements0);
  /** occupazione: 0 libera, 1 strada, 2 edificio */
  const occ = new Uint8Array(N);
  const strada = (x: number, y: number) => { const g = gi(x, y); return g >= 0 && occ[g] === 1; };
  const segnaB = (b: PlannerBuilding, p: Pos, v: 0 | 2) => {
    for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) { const g = gi(p.x + dx, p.y + dy); if (g >= 0) occ[g] = v; }
  };
  for (const r of roads0) { const c = r.indexOf(","), g = gi(Number(r.slice(0, c)), Number(r.slice(c + 1))); if (g >= 0) occ[g] = 1; }
  for (const [id, p] of pl) { const b = byId.get(id); if (b) segnaB(b, p, 2); }
  const libera = (x: number, y: number) => { const g = gi(x, y); return g >= 0 && cella[g] === 1 && occ[g] === 0; };
  const rettLibero = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) if (!libera(x + dx, y + dy)) return false;
    return true;
  };
  const th = problem.buildings.find(b => b.isTownhall);
  const conStrada = problem.buildings.filter(b => !b.isTownhall && b.roadLevel > 0);

  /** Tutto collegato: strade raggiungibili dal municipio e ogni edificio con strada piazzato tocca una strada raggiungibile. */
  const vis = new Int32Array(N);
  let timbro = 0;
  const coda = new Int32Array(N);
  const valido = (): boolean => {
    const pth = th ? pl.get(th.id) : undefined;
    if (!th || !pth) return true;
    timbro++;
    let n = 0, nStrade = 0;
    for (let g = 0; g < N; g++) if (occ[g] === 1) nStrade++;
    const parti = (x: number, y: number) => { const g = gi(x, y); if (g >= 0 && occ[g] === 1 && vis[g] !== timbro) { vis[g] = timbro; coda[n++] = g; } };
    for (let d = 0; d < th.w; d++) { parti(pth.x + d, pth.y - 1); parti(pth.x + d, pth.y + th.h); }
    for (let d = 0; d < th.h; d++) { parti(pth.x - 1, pth.y + d); parti(pth.x + th.w, pth.y + d); }
    for (let i = 0; i < n; i++) {
      const g = coda[i]!, x = g % GW, y = (g - x) / GW;
      if (x > 0) { const h = g - 1; if (occ[h] === 1 && vis[h] !== timbro) { vis[h] = timbro; coda[n++] = h; } }
      if (x < GW - 1) { const h = g + 1; if (occ[h] === 1 && vis[h] !== timbro) { vis[h] = timbro; coda[n++] = h; } }
      if (y > 0) { const h = g - GW; if (occ[h] === 1 && vis[h] !== timbro) { vis[h] = timbro; coda[n++] = h; } }
      if (y < GH - 1) { const h = g + GW; if (occ[h] === 1 && vis[h] !== timbro) { vis[h] = timbro; coda[n++] = h; } }
    }
    if (n !== nStrade) return false; // strade staccate dalla rete
    const raggiunta = (x: number, y: number) => { const g = gi(x, y); return g >= 0 && occ[g] === 1 && vis[g] === timbro; };
    for (const b of conStrada) { const p = pl.get(b.id); if (p && !toccaStradaZona(b, p.x, p.y, raggiunta)) return false; }
    return true;
  };

  /** Buchi: celle libere che nessun edificio senza strada (lati >= 2) non ancora piazzato può coprire. */
  const forme = (() => {
    const f = new Map<string, [number, number]>();
    for (const b of problem.buildings) if (!b.isTownhall && b.roadLevel === 0 && !pl.has(b.id) && b.w >= 2 && b.h >= 2) f.set(`${b.w}x${b.h}`, [b.w, b.h]);
    const t = [...f.values()];
    return t.filter(([w, h]) => !t.some(([w2, h2]) => (w2 < w && h2 <= h) || (w2 <= w && h2 < h)));
  })();
  const W1 = GW + 1;
  const pref = new Int32Array(W1 * (GH + 1));
  const diff = new Int32Array(W1 * (GH + 1));
  const buchi = (): number => {
    if (!forme.length) return 0;
    pref.fill(0); diff.fill(0);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const g = y * GW + x, v = cella[g] === 1 && occ[g] === 0 ? 1 : 0;
      pref[(y + 1) * W1 + x + 1] = v + pref[y * W1 + x + 1]! + pref[(y + 1) * W1 + x]! - pref[y * W1 + x]!;
    }
    for (const [w, h] of forme) for (let y = 0; y + h <= GH; y++) for (let x = 0; x + w <= GW; x++) {
      const s = pref[(y + h) * W1 + x + w]! - pref[y * W1 + x + w]! - pref[(y + h) * W1 + x]! + pref[y * W1 + x]!;
      if (s !== w * h) continue;
      diff[y * W1 + x]!++; diff[y * W1 + x + w]!--; diff[(y + h) * W1 + x]!--; diff[(y + h) * W1 + x + w]!++;
    }
    let n = 0;
    const run = new Int32Array(W1);
    for (let y = 0; y < GH; y++) {
      let acc = 0;
      for (let x = 0; x < GW; x++) {
        acc += diff[y * W1 + x]!;
        run[x] = run[x]! + acc;
        const g = y * GW + x;
        if (cella[g] === 1 && occ[g] === 0 && run[x]! <= 0) n++;
      }
    }
    return n;
  };

  // ── 1. Fasce ─────────────────────────────────────────────────────────────
  type Fascia = { pos: number; celle: number[]; edifici: string[] };
  /** Tratti di strada in una direzione: per ogni riga (vert = false) le celle
   *  di strada in fila (>= 2), senza quelle con strade perpendicolari (incroci,
   *  innesti), più gli edifici che le toccano. null se coinvolge un fisso. */
  const fasceDi = (vert: boolean): Fascia[] => {
    const out: Fascia[] = [];
    const A = vert ? GW : GH, B = vert ? GH : GW;
    const at = (a: number, b: number) => (vert ? b * GW + a : a * GW + b); // a = riga/colonna, b = lungo il tratto
    for (let a = 0; a < A; a++) {
      let b = 0;
      while (b < B) {
        if (occ[at(a, b)] !== 1) { b++; continue; }
        let e = b;
        while (e + 1 < B && occ[at(a, e + 1)] === 1) e++;
        if (e > b) {
          // tratti separati dagli incroci/innesti (celle con strade perpendicolari):
          // es. raccordo del municipio | verticale | dorsale sono tre tratti diversi
          const tratti: number[][] = [[]];
          for (let t = b; t <= e; t++) {
            const pp = (a > 0 && occ[at(a - 1, t)] === 1) || (a < A - 1 && occ[at(a + 1, t)] === 1);
            if (pp) { if (tratti[tratti.length - 1]!.length) tratti.push([]); } else tratti[tratti.length - 1]!.push(at(a, t));
          }
          for (const celle of tratti) {
            if (celle.length < 2) continue;
            const set = new Set(celle);
            const edifici: string[] = [];
            let bloccata = false;
            for (const [id, p] of pl) {
              const bb = byId.get(id)!;
              if (bb.roadLevel === 0 && !bb.isTownhall) continue;
              if (perimetroZona(bb, p.x, p.y).some(([cx, cy]) => set.has(gi(cx, cy)))) {
                if (bb.isTownhall || fissi.has(id)) { bloccata = true; break; }
                edifici.push(id);
              }
            }
            if (!bloccata) out.push({ pos: a, celle, edifici });
          }
        }
        b = e + 1;
      }
    }
    return out;
  };
  /** Sposta un gruppo di fasce di (dx, dy): celle di strada ed edifici
   *  traslati insieme (traslazione rigida: fra loro non si sovrappongono).
   *  Gli edifici (non fissi) che si trovano sulla strada vengono SPINTI nella
   *  stessa direzione (es. i piccoli sul lato della verticale fra due fasce),
   *  fino a MAX_SPINTI; le strade non si spingono. Vero se la mossa è valida
   *  e applicata; altrimenti lo stato non cambia. */
  const MAX_SPINTI = 15;
  const sposta = (gruppo: Fascia[], dx: number, dy: number, togli: number[] = []): boolean => {
    const celle = [...new Set(gruppo.flatMap(f => f.celle))];
    const ids = new Set(gruppo.flatMap(f => f.edifici));
    const salva = occ.slice();
    const vecchie = new Map([...pl].filter(([id]) => ids.has(id)));
    // proprietario di ogni cella occupata da un edificio (per le spinte)
    const owner = new Map<number, string>();
    for (const [id, p] of pl) {
      const b = byId.get(id)!;
      for (let ddx = 0; ddx < b.w; ddx++) for (let ddy = 0; ddy < b.h; ddy++) { const g = gi(p.x + ddx, p.y + ddy); if (g >= 0) owner.set(g, id); }
    }
    for (const g of celle) occ[g] = 0;
    for (const g of togli) occ[g] = 0; // celle di strada da togliere (raddrizzamento)
    for (const id of ids) segnaB(byId.get(id)!, pl.get(id)!, 0);
    const bersaglio = (x: number, y: number): string | "ok" | null => {
      const n = gi(x + dx, y + dy);
      if (n < 0 || cella[n] !== 1 || occ[n] === 1) return null;
      if (occ[n] === 0) return "ok";
      const o = owner.get(n);
      if (!o) return null;
      const ob = byId.get(o)!;
      return ob.isTownhall || fissi.has(o) ? null : o;
    };
    let ok = true, spinti = 0;
    for (let cambiato = true; ok && cambiato;) {
      cambiato = false;
      const prove: Array<[number, number]> = [];
      for (const g of celle) prove.push([g % GW + minX, (g - (g % GW)) / GW + minY]);
      for (const id of ids) {
        const b = byId.get(id)!, p = pl.get(id)!;
        for (let ddx = 0; ddx < b.w; ddx++) for (let ddy = 0; ddy < b.h; ddy++) prove.push([p.x + ddx, p.y + ddy]);
      }
      for (const [x, y] of prove) {
        const r = bersaglio(x, y);
        if (r === "ok") continue;
        if (r === null || ++spinti > MAX_SPINTI) { ok = false; break; }
        ids.add(r); vecchie.set(r, pl.get(r)!);
        segnaB(byId.get(r)!, pl.get(r)!, 0);
        cambiato = true;
        break;
      }
    }
    if (ok) {
      for (const g of celle) { const x = g % GW + minX, y = (g - (g % GW)) / GW + minY; occ[gi(x + dx, y + dy)] = 1; }
      for (const id of ids) { const p0 = pl.get(id)!, p = { x: p0.x + dx, y: p0.y + dy }; pl.set(id, p); segnaB(byId.get(id)!, p, 2); }
      if (valido()) return true;
    }
    occ.set(salva);
    for (const [id, p] of vecchie) pl.set(id, p);
    return false;
  };
  const buchiPrima = buchi();

  // ── 0. Doppi angoli (segnalazione dell'utente) ──────────────────────────
  // Due tratti paralleli che proseguono in versi opposti, sfalsati di 1-3
  // righe e uniti da un breve raccordo perpendicolare ("Z"): si porta un
  // tratto (con i suoi edifici, spingendo quelli sulla traiettoria) sulla riga
  // dell'altro e il raccordo sparisce. Strade in meno: sempre accettato se
  // tutto resta collegato (a parità di verso, la mossa con meno buchi).
  let raddrizzati = 0;
  const attaccati = (set: Set<number>): string[] | null => {
    const out: string[] = [];
    for (const [id, p] of pl) {
      const bb = byId.get(id)!;
      if (bb.roadLevel === 0 && !bb.isTownhall) continue;
      if (perimetroZona(bb, p.x, p.y).some(([cx, cy]) => set.has(gi(cx, cy)))) {
        if (bb.isTownhall || fissi.has(id)) return null;
        out.push(id);
      }
    }
    return out;
  };
  for (let giro = 0; giro < 30; giro++) {
    let fatto = false;
    for (const vert of [false, true]) {
      // coordinate astratte: u lungo i tratti, v attraverso (vert = tratti verticali)
      const G = (u: number, v: number) => (vert ? gi(v, u) : gi(u, v));
      const S = (u: number, v: number) => { const g = G(u, v); return g >= 0 && occ[g] === 1; };
      const U0 = vert ? minY : minX, U1 = vert ? problem.maxY : problem.maxX;
      const V0 = vert ? minX : minY, V1 = vert ? problem.maxX : problem.maxY;
      for (let v = V0; v <= V1 && !fatto; v++) for (let u = U0; u <= U1 && !fatto; u++) {
        if (!S(u, v) || S(u, v - 1) || !S(u, v + 1)) continue;
        const sx = S(u - 1, v), dx_ = S(u + 1, v);
        if (sx === dx_) continue;
        const s1 = sx ? -1 : 1;
        let L = 1;
        while (L <= 3 && S(u, v + L) && !S(u - 1, v + L) && !S(u + 1, v + L)) L++;
        if (L > 3 || !S(u, v + L) || S(u, v + L + 1)) continue;
        if (!(S(u - s1, v + L) && !S(u + s1, v + L))) continue; // verso opposto
        const tratto = (vv: number, s: number) => {
          const out: number[] = [];
          for (let k = 1; S(u + s * k, vv) && !S(u + s * k, vv - 1) && !S(u + s * k, vv + 1); k++) out.push(G(u + s * k, vv));
          return out;
        };
        const tA = tratto(v, s1), tB = tratto(v + L, -s1);
        const mosse: Array<{ celle: number[]; togli: number[]; dv: number }> = [
          { celle: tB, togli: Array.from({ length: L }, (_, t) => G(u, v + 1 + t)), dv: -L },   // B sale sulla riga di A
          { celle: tA, togli: Array.from({ length: L }, (_, t) => G(u, v + t)), dv: L },        // A scende sulla riga di B
        ];
        let migl: { occ: Uint8Array; pl: Map<string, Pos>; buchi: number } | null = null;
        for (const m of mosse) {
          if (!m.celle.length) continue;
          const ed = attaccati(new Set([...m.celle, ...m.togli]));
          if (!ed) continue;
          const salva = occ.slice(), vecchie = new Map(pl);
          if (!sposta([{ pos: 0, celle: m.celle, edifici: ed }], vert ? m.dv : 0, vert ? 0 : m.dv, m.togli)) continue;
          const nb = buchi();
          if (!migl || nb < migl.buchi) migl = { occ: occ.slice(), pl: new Map(pl), buchi: nb };
          occ.set(salva); pl.clear(); for (const [id, p] of vecchie) pl.set(id, p);
        }
        if (migl) { occ.set(migl.occ); pl.clear(); for (const [id, p] of migl.pl) pl.set(id, p); raddrizzati++; fatto = true; }
      }
      if (fatto) break;
    }
    if (!fatto) break;
  }

  let fasce = 0;
  let attuali = buchi();
  for (let giro = 0; giro < 40 && attuali > 0; giro++) {
    let migliorata = false;
    for (const vert of [false, true]) {
      const lista = fasceDi(vert).sort((a, b) => a.pos - b.pos);
      for (let i = 0; i < lista.length && !migliorata; i++) {
        for (const d of [1, -1, 2, -2, 3, -3]) {
          if (migliorata) break;
          // la fascia da sola, poi insieme alle fasce parallele successive nella direzione della mossa
          const verso = d > 0 ? 1 : -1;
          for (let k = 0; k < 4 && !migliorata; k++) {
            const j = i + verso * k;
            if (j < 0 || j >= lista.length) break;
            const gruppo = verso > 0 ? lista.slice(i, j + 1) : lista.slice(j, i + 1);
            const salva = occ.slice();
            const vecchie = new Map(pl);
            if (!sposta(gruppo, vert ? d : 0, vert ? 0 : d)) continue;
            const nb = buchi();
            if (nb < attuali) { attuali = nb; fasce++; migliorata = true; }
            else { occ.set(salva); for (const [id, p] of vecchie) pl.set(id, p); }
          }
        }
      }
      if (migliorata) break;
    }
    if (!migliorata) break;
  }

  // ── 2. Catene con strade accanto agli anelli ────────────────────────────
  let catene = 0;
  for (const b of problem.buildings) {
    const p = pl.get(b.id);
    if (!b.zonaStrada || !p || fissi.has(b.id)) continue;
    if (!perimetroCoda(b, p.x, p.y).some(([cx, cy]) => strada(cx, cy))) continue;
    segnaB(b, p, 0);
    const cand: Array<{ x: number; y: number; contatto: number }> = [];
    for (let y = minY; y <= problem.maxY; y++) for (let x = minX; x <= problem.maxX; x++) {
      if (!rettLibero(x, y, b.w, b.h)) continue;
      if (!toccaStradaZona(b, x, y, strada)) continue;
      // (anche in punta a una strada: la testa usa la punta, gli anelli proseguono oltre)
      if (perimetroCoda(b, x, y).some(([cx, cy]) => strada(cx, cy))) continue;
      let contatto = 0;
      const pieno = (cx: number, cy: number) => !libera(cx, cy);
      for (let d = 0; d < b.w; d++) { if (pieno(x + d, y - 1)) contatto++; if (pieno(x + d, y + b.h)) contatto++; }
      for (let d = 0; d < b.h; d++) { if (pieno(x - 1, y + d)) contatto++; if (pieno(x + b.w, y + d)) contatto++; }
      cand.push({ x, y, contatto });
    }
    cand.sort((a, c) => c.contatto - a.contatto);
    let migl: { x: number; y: number; buchi: number; contatto: number } | null = null;
    for (const c of cand.slice(0, 40)) {
      segnaB(b, c, 2);
      const nb = buchi();
      segnaB(b, c, 0);
      if (!migl || nb < migl.buchi || (nb === migl.buchi && c.contatto > migl.contatto)) migl = { ...c, buchi: nb };
    }
    if (migl) { pl.set(b.id, { x: migl.x, y: migl.y }); segnaB(b, migl, 2); catene++; }
    else segnaB(b, p, 2);
  }

  // ── 2b. Buchi in fondo alla strada (regola dell'utente) ──────────────────
  // "Se in una strada ci sono dei buchi, sposta gli edifici in modo da mettere
  // quei buchi alla fine della strada: dopo il passo è semplice." Per ogni
  // ramo (tratto dritto che finisce in una punta) gli edifici attaccati ai due
  // lati si impilano verso la radice (il primo posto libero partendo dalla
  // radice, nell'ordine in cui erano); le celle in punta rimaste senza edifici
  // ai lati si tolgono e l'edificio in testa (il "tappo" oltre la punta)
  // scende con la punta. Se non basta, si prova a scambiare di lato due
  // edifici di lunghezza diversa (Girandola: un 3 sopra con un 4 sotto).
  // Si tiene solo se si tolgono strade e resta tutto collegato.
  let scorsi = 0;
  const VERSI: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const proprietari = (): Map<number, string> => {
    const o = new Map<number, string>();
    for (const [id, p] of pl) {
      const b = byId.get(id)!;
      for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) { const g = gi(p.x + dx, p.y + dy); if (g >= 0) o.set(g, id); }
    }
    return o;
  };
  const tentaRamo = (tx: number, ty: number): boolean => {
    const vers = VERSI.filter(([dx, dy]) => strada(tx + dx, ty + dy));
    if (vers.length !== 1) return false;
    const [rx, ry] = vers[0]!; // verso la radice
    const px = ry !== 0 ? 1 : 0, py = rx !== 0 ? 1 : 0; // perpendicolare
    const ramo: Pos[] = [];
    for (let x = tx, y = ty; ;) {
      if (strada(x + px, y + py) || strada(x - px, y - py)) break; // incrocio, innesto o curva
      ramo.push({ x, y });
      if (!strada(x + rx, y + ry)) break;
      x += rx; y += ry;
    }
    const m = ramo.length;
    if (m < 2) return false;
    const own = proprietari();
    const mobile = (id: string) => { const b = byId.get(id)!; return !b.isTownhall && !fissi.has(id) && b.roadLevel > 0; };
    const tRamo = (c: Pos) => c.x * rx + c.y * ry; // crescente verso la radice
    const tPunta = tRamo(ramo[0]!);
    /** Bordo dell'edificio più lontano dalla radice (in T). */
    const bordoPunta = (id: string) => { const b = byId.get(id)!, p = pl.get(id)!; return rx > 0 ? p.x : rx < 0 ? -(p.x + b.w - 1) : ry > 0 ? p.y : -(p.y + b.h - 1); };
    const lati = new Map<1 | -1, string[]>([[1, []], [-1, []]]);
    const latoFermo = new Set<1 | -1>();
    /** Edifici ai lati che sporgono oltre la punta: scendono con la punta (come il tappo). */
    const compagni: string[] = [];
    for (const c of ramo) for (const s of [1, -1] as const) {
      const id = own.get(gi(c.x + s * px, c.y + s * py));
      if (!id || compagni.includes(id) || lati.get(s)!.includes(id)) continue;
      if (bordoPunta(id) < tPunta) { if (!mobile(id)) return false; compagni.push(id); continue; }
      lati.get(s)!.push(id);
      if (!mobile(id)) latoFermo.add(s);
    }
    const tappo = own.get(gi(tx - rx, ty - ry));
    if (tappo && (lati.get(1)!.includes(tappo) || lati.get(-1)!.includes(tappo))) return false;
    if (tappo && !mobile(tappo)) return false;
    const inPunta = [...new Set([...(tappo ? [tappo] : []), ...compagni])];
    // verso la radice: valore lungo il ramo del bordo dell'edificio più vicino alla radice
    const bordoRadice = (id: string) => { const b = byId.get(id)!, p = pl.get(id)!; return rx > 0 ? p.x + b.w - 1 : rx < 0 ? -p.x : ry > 0 ? p.y + b.h - 1 : -p.y; };
    for (const l of lati.values()) l.sort((a, b) => bordoRadice(b) - bordoRadice(a));
    const R = px ? tx : ty; // coordinata perpendicolare della strada
    const salvaOcc = occ.slice(), salvaPl = new Map(pl);
    const ripristina = (o: Uint8Array, p: Map<string, Pos>) => { occ.set(o); pl.clear(); for (const [id, q] of p) pl.set(id, q); };
    /** Impila i lati (`via`: edifici che passano all'altro lato) e toglie la punta; vero se riuscito (stato applicato). */
    const prova = (via: ReadonlySet<string>): boolean => {
      const assegna = new Map<1 | -1, string[]>();
      for (const s of [1, -1] as const) {
        if (latoFermo.has(s)) continue;
        const l = [...lati.get(s)!.filter(id => !via.has(id)), ...lati.get(s === 1 ? -1 : 1)!.filter(id => via.has(id))];
        assegna.set(s, l.sort((a, b) => bordoRadice(b) - bordoRadice(a)));
      }
      for (const ids of assegna.values()) for (const id of ids) segnaB(byId.get(id)!, pl.get(id)!, 0);
      let ok = true;
      for (const [s, ids] of assegna) {
        for (const id of ids) {
          const b = byId.get(id)!, p0 = pl.get(id)!;
          const spostato = !lati.get(s)!.includes(id);
          const prof = px ? b.w : b.h;
          const perp = spostato ? (s > 0 ? R + 1 : R - prof) : (px ? p0.x : p0.y);
          // bordo verso la radice (in "T", crescente verso la radice): dal più
          // vicino alla radice verso la punta, il primo libero; si può sporgere
          // oltre la radice del ramo (es. sotto il municipio) purché si resti
          // accanto ad almeno una cella del ramo (Sdrushi3, Girandola 2)
          const lungo = px ? b.h : b.w;
          const da = Math.max(tRamo(ramo[m - 1]!) + lungo - 1, spostato ? -Infinity : bordoRadice(id));
          let messo = false;
          for (let T = da; T >= tPunta && !messo; T--) {
            const a = rx > 0 ? T - b.w + 1 : rx < 0 ? -T : ry > 0 ? T - b.h + 1 : -T;
            const q = px ? { x: perp, y: a } : { x: a, y: perp };
            if (!rettLibero(q.x, q.y, b.w, b.h) || !toccaStradaZona(b, q.x, q.y, strada)) continue;
            pl.set(id, q); segnaB(b, q, 2); messo = true;
          }
          if (!messo) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (!ok) { ripristina(salvaOcc, salvaPl); return false; }
      // celle in punta senza edifici ai lati (tappo e compagni scendono con la punta)
      // Tappo e compagni (edifici di lato che sporgono oltre la punta) si
      // ripiazzano dopo l'accorciamento: le loro celle contano come libere.
      // La punta arretra del minimo, fra i due lati, delle celle in fondo con
      // il lato libero.
      const cellePunta = new Set<number>();
      for (const id of inPunta) {
        const b = byId.get(id)!, p = pl.get(id)!;
        for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) cellePunta.add(gi(p.x + dx, p.y + dy));
        segnaB(b, p, 0);
      }
      const liberaLat = (j: number, sl: number) => { const g = gi(ramo[j]!.x + sl * px, ramo[j]!.y + sl * py); return g < 0 || occ[g] !== 2 || cellePunta.has(g); };
      let k = 0;
      while (k < m - 1 && liberaLat(k, 1) && liberaLat(k, -1)) k++;
      const impO = occ.slice(), impP = new Map(pl);
      /** Ripiazza tappo e compagni: prima traslati con la punta; se non va, nel
       *  posto libero più vicino (spostamento fino a RAGGIO per asse) che tocca
       *  una strada, provando i vari ordini (es. Sdrushi3 Girandola 2: il
       *  tappo scende e si sposta, il compagno sopra scende di 1 accanto
       *  alla nuova punta). */
      const RAGGIO = 4;
      const ordini = (a: string[]): string[][] => a.length <= 1 ? [a] : a.flatMap((x, i) => ordini([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));
      const ripiazza = (kk: number, ordine: string[], trasla: boolean): boolean => {
        for (const id of ordine) {
          const b = byId.get(id)!, p = impP.get(id)!;
          if (trasla) {
            const q = { x: p.x + kk * rx, y: p.y + kk * ry };
            if (!rettLibero(q.x, q.y, b.w, b.h)) return false;
            pl.set(id, q); segnaB(b, q, 2); continue;
          }
          let mig: Pos | null = null, md = Infinity;
          for (let dx = -RAGGIO; dx <= RAGGIO; dx++) for (let dy = -RAGGIO; dy <= RAGGIO; dy++) {
            const d = Math.abs(dx) + Math.abs(dy);
            if (d >= md) continue;
            const q = { x: p.x + dx, y: p.y + dy };
            if (rettLibero(q.x, q.y, b.w, b.h) && toccaStradaZona(b, q.x, q.y, strada)) { mig = q; md = d; }
          }
          if (!mig) return false;
          pl.set(id, mig); segnaB(b, mig, 2);
        }
        return true;
      };
      for (let kk = k; kk >= 1; kk--) {
        const tentativi: Array<[string[], boolean]> = [[inPunta, true], ...ordini(inPunta).map(o => [o, false] as [string[], boolean])];
        for (const [ordine, trasla] of tentativi) {
          for (let i = 0; i < kk; i++) { const g = gi(ramo[i]!.x, ramo[i]!.y); occ[g] = 0; }
          if (ripiazza(kk, ordine, trasla) && valido()) return true;
          ripristina(impO, impP);
        }
      }
      ripristina(salvaOcc, salvaPl);
      return false;
    };
    if (prova(new Set())) return true;
    // Un lato pieno e l'altro con buchi: un edificio passa dall'altra parte
    // (nei buchi), oppure due edifici di lunghezza diversa si scambiano di lato
    // (Girandola: un 3 sopra con un 4 sotto). Così i buchi finiscono in fondo
    // su entrambi i lati.
    if (latoFermo.size) return false;
    const lun = (id: string) => (px ? byId.get(id)!.h : byId.get(id)!.w);
    let tentativi = 0;
    for (const a of [...lati.get(1)!, ...lati.get(-1)!]) {
      if (++tentativi > 40) break;
      if (prova(new Set([a]))) return true;
    }
    tentativi = 0;
    for (const a of lati.get(1)!) for (const b of lati.get(-1)!) {
      if (lun(a) === lun(b) || ++tentativi > 60) continue;
      if (prova(new Set([a, b]))) return true;
    }
    return false;
  };
  for (let giro = 0; giro < 60; giro++) {
    let fatto = false;
    for (let g = 0; g < N && !fatto; g++) {
      if (occ[g] !== 1) continue;
      const x = g % GW + minX, y = (g - (g % GW)) / GW + minY;
      if (tentaRamo(x, y)) { scorsi++; fatto = true; }
    }
    if (!fatto) break;
  }

  // ── 3. Potatura delle punte di strada ───────────────────────────────────
  // Una punta (cella di strada con una sola strada vicina) si toglie se non
  // serve a nessuno; se serve solo a 1-2 edifici, si prova a spostarli di una
  // o due celle perché tocchino un'altra strada (segnalazione dell'utente: una
  // cella di strada messa accanto alla punta solo per un edificio che poteva
  // stare attaccato alla punta stessa).
  const SPOSTAMENTI: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  let potate = 0;
  for (let cambiato = true; cambiato;) {
    cambiato = false;
    for (let g = 0; g < N; g++) {
      if (occ[g] !== 1) continue;
      const x = g % GW + minX, y = (g - (g % GW)) / GW + minY;
      const vicine = (strada(x + 1, y) ? 1 : 0) + (strada(x - 1, y) ? 1 : 0) + (strada(x, y + 1) ? 1 : 0) + (strada(x, y - 1) ? 1 : 0);
      if (vicine > 1) continue;
      const salva = occ.slice(), vecchie = new Map(pl);
      occ[g] = 0;
      // edifici con strada che senza questa cella non toccano più nessuna strada
      const orfani = conStrada.filter(b => { const p = pl.get(b.id); return p && !fissi.has(b.id) && !toccaStradaZona(b, p.x, p.y, strada); });
      const fermi = conStrada.some(b => { const p = pl.get(b.id); return p && fissi.has(b.id) && !toccaStradaZona(b, p.x, p.y, strada); });
      let ok = !fermi && orfani.length <= 2;
      for (const b of ok ? orfani : []) {
        const p = pl.get(b.id)!;
        segnaB(b, p, 0);
        const d = SPOSTAMENTI.find(([dx, dy]) => rettLibero(p.x + dx, p.y + dy, b.w, b.h) && toccaStradaZona(b, p.x + dx, p.y + dy, strada));
        if (!d) { ok = false; break; }
        const q = { x: p.x + d[0], y: p.y + d[1] };
        pl.set(b.id, q); segnaB(b, q, 2);
      }
      if (ok && valido()) { potate++; cambiato = true; }
      else { occ.set(salva); pl.clear(); for (const [id, p] of vecchie) pl.set(id, p); }
    }
  }

  const roads = new Set<string>();
  for (let g = 0; g < N; g++) if (occ[g] === 1) { const x = g % GW; roads.add(key(x + minX, (g - x) / GW + minY)); }
  return { placements: pl, roads, raddrizzati, fasce, catene, scorsi, potate, buchiPrima, buchiDopo: buchi() };
}
