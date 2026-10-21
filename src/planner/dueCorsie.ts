// ─────────────────────────────────────────────────────────────────────────────
//  planner/dueCorsie.ts — Strade a due corsie (ottobre 2026, prima versione)
//
//  Regole (concordate con l'utente):
//   - la strada a due corsie è fatta di blocchi 2×2; un blocco vale 4 celle di
//     strada normale (ci si attacca qualsiasi edificio, conta 4 nelle strade)
//     e in più è l'unica strada che va bene per gli edifici a due corsie
//     (roadLevel >= 2);
//   - la rete a due corsie parte dal municipio (un blocco che lo tocca anche
//     con una sola cella); due blocchi sono collegati solo se condividono un
//     lato intero, allineati (mai sfalsati);
//   - la rete a una corsia parte dal municipio o da qualunque blocco;
//   - un edificio a due corsie deve toccare almeno una cella di un blocco
//     collegato.
//  Prima versione: prima della ricerca si costruisce il "nucleo" (una fila
//  dritta di 1..KMAX blocchi che parte dal municipio, con attorno gli edifici
//  a due corsie); il Planner prova più nuclei (angolo / fila lunga, lati
//  diversi) con una breve ricerca e tiene quello con meno strade. Durante la
//  ricerca nucleo ed edifici a due corsie restano fermi (strade "fisse").
// ─────────────────────────────────────────────────────────────────────────────

import type { PlannerBuilding, PlannerProblem } from "./engine";
import { t, type UiLang } from "../data/ui-strings";

type Pos = { x: number; y: number };
const key = (x: number, y: number) => `${x},${y}`;

/** L'edificio richiede una strada a due corsie. */
export const richiedeDueCorsie = (b: { roadLevel: number; isTownhall?: boolean }) => !b.isTownhall && b.roadLevel >= 2;

/** Celle di una lista di blocchi 2×2 (chiave = angolo in alto a sinistra). */
export function celleBlocchi(blocchi: readonly string[]): string[] {
  const out: string[] = [];
  for (const k of blocchi) {
    const i = k.indexOf(","), x = Number(k.slice(0, i)), y = Number(k.slice(i + 1));
    out.push(key(x, y), key(x + 1, y), key(x, y + 1), key(x + 1, y + 1));
  }
  return out;
}

export interface Nucleo {
  /** Descrizione breve (per il log). */
  nome: string;
  placements: Map<string, Pos>;
  roads: Set<string>;
  /** Blocchi 2×2 (angolo in alto a sinistra). */
  blocchi: string[];
  /** Edifici fermi durante la ricerca: quelli della base (meno gli sfrattati) + quelli a due corsie. */
  fissi: string[];
  /** Edifici a due corsie rimasti fuori (nessun posto). */
  fuori: number;
}

const KMAX = 6;

/**
 * Nuclei candidati sulla base `base` (stato di partenza del builder o della
 * girandola): fino a `max` diversi — il migliore in assoluto, il migliore con
 * un solo blocco (angolo) e il migliore con più blocchi (fila lunga), per
 * edifici fuori, poi area di edifici fissi sfrattati, poi strade nuove +
 * area sfrattata / 4. Vuoto se la città non ha edifici a due corsie.
 */
/** `raccordo` (scenari del builder): riga del raccordo est. Si propone sempre
 *  anche il nucleo "sul raccordo" (blocchi sul raccordo e su una riga accanto,
 *  verso est, anche oltre la verticale), come concordato con l'utente: sul
 *  raccordo il builder mette edifici fissi, che altrimenti lo escluderebbero
 *  (su Avito r3 il Planner sceglieva una fila verticale a ovest). */
export function nucleiDueCorsie(problem: PlannerProblem, base: { placements: ReadonlyMap<string, Pos>; roads: ReadonlySet<string> }, fissi: readonly string[], max = 3, raccordo?: { eastMidY: number }): Nucleo[] {
  const lista = problem.buildings.filter(richiedeDueCorsie).sort((a, b) => b.w * b.h - a.w * a.h);
  const th = problem.buildings.find(b => b.isTownhall);
  const pth = th ? base.placements.get(th.id) : undefined;
  if (!lista.length || !th || !pth) return [];
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  const due = new Set(lista.map(b => b.id));
  const fissiS = new Set(fissi);
  // occupazione della base senza gli edifici a due corsie
  const owner = new Map<string, string>();
  for (const [id, p] of base.placements) {
    if (due.has(id)) continue;
    const b = byId.get(id); if (!b) continue;
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) owner.set(key(p.x + i, p.y + j), id);
  }
  const inTh = (x: number, y: number) => x >= pth.x && x < pth.x + th.w && y >= pth.y && y < pth.y + th.h;
  const toccaTh = (x: number, y: number) => inTh(x + 1, y) || inTh(x - 1, y) || inTh(x, y + 1) || inTh(x, y - 1);
  const area = (id: string) => { const b = byId.get(id)!; return b.w * b.h; };

  type Ris = Nucleo & { costo: [number, number, number]; k: number; chiave: string };
  const risultati: Ris[] = [];
  const provaCatena = (blocchi: Pos[]): Ris | null => {
    const strada = new Set<string>();
    for (const b of blocchi) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const x = b.x + dx, y = b.y + dy;
      if (!problem.cells.has(key(x, y)) || inTh(x, y)) return null;
      strada.add(key(x, y));
    }
    const sfrattati = new Set<string>();
    for (const c of strada) { const o = owner.get(c); if (o && o !== th.id) sfrattati.add(o); }
    const messi = new Map<string, Pos>();
    const occ2 = new Set<string>(); // celle degli edifici a due corsie messi
    const occupata = (k: string) => base.roads.has(k) || strada.has(k) || occ2.has(k);
    let fuori = 0;
    const celleStrada = [...strada].map(k => k.split(",").map(Number) as [number, number]);
    // Fine strada (idea dell'utente: "è quasi sempre la soluzione migliore
    // mettere gli edifici più grandi come fine strada"): le due celle oltre la
    // punta della fila; il più grande degli edifici a due corsie ci va per
    // primo, se non sfratta edifici fissi.
    const oltre = new Set<string>();
    if (blocchi.length >= 2) {
      const u = blocchi[blocchi.length - 1]!, v = blocchi[blocchi.length - 2]!;
      const dx = Math.sign(u.x - v.x), dy = Math.sign(u.y - v.y);
      if (dx > 0) oltre.add(key(u.x + 2, u.y)).add(key(u.x + 2, u.y + 1));
      if (dx < 0) oltre.add(key(u.x - 1, u.y)).add(key(u.x - 1, u.y + 1));
      if (dy > 0) oltre.add(key(u.x, u.y + 2)).add(key(u.x + 1, u.y + 2));
      if (dy < 0) oltre.add(key(u.x, u.y - 1)).add(key(u.x + 1, u.y - 1));
    }
    for (const b of lista) {
      let mig: { p: Pos; costo: number; contatto: number; sfr: string[]; capo: boolean } | null = null;
      const primo = b === lista[0];
      // (il fine strada sta OLTRE la punta: tra i candidati anche i rettangoli che coprono quelle celle)
      const candCapo: Pos[] = [];
      if (primo) for (const k of oltre) { const [ox, oy] = k.split(",").map(Number) as [number, number]; for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) candCapo.push({ x: ox - i, y: oy - j }); }
      const viste = new Set<string>();
      for (const [cx, cy] of [...celleStrada, ...(candCapo.length ? [[NaN, NaN] as [number, number]] : [])]) {
        const cand: Pos[] = [];
        if (Number.isNaN(cx)) cand.push(...candCapo);
        else {
          for (let j = 0; j < b.h; j++) { cand.push({ x: cx - b.w, y: cy - j }, { x: cx + 1, y: cy - j }); }
          for (let i = 0; i < b.w; i++) { cand.push({ x: cx - i, y: cy - b.h }, { x: cx - i, y: cy + 1 }); }
        }
        for (const p of cand) {
          const kp = key(p.x, p.y);
          if (viste.has(kp)) continue;
          viste.add(kp);
          let ok = true, costo = 0;
          const sfr: string[] = [];
          for (let i = 0; i < b.w && ok; i++) for (let j = 0; j < b.h && ok; j++) {
            const x = p.x + i, y = p.y + j, k = key(x, y);
            if (!problem.cells.has(k) || inTh(x, y) || occupata(k)) { ok = false; break; }
            const o = owner.get(k);
            if (o && !sfrattati.has(o) && !sfr.includes(o)) { sfr.push(o); costo += (fissiS.has(o) ? 1000 : 1) * area(o); }
          }
          if (!ok) continue;
          let contatto = 0;
          const pieno = (x: number, y: number) => { const k = key(x, y); return !problem.cells.has(k) || occupata(k) || inTh(x, y) || (owner.has(k) && !sfrattati.has(owner.get(k)!) && !sfr.includes(owner.get(k)!)); };
          for (let i = 0; i < b.w; i++) { if (pieno(p.x + i, p.y - 1)) contatto++; if (pieno(p.x + i, p.y + b.h)) contatto++; }
          for (let j = 0; j < b.h; j++) { if (pieno(p.x - 1, p.y + j)) contatto++; if (pieno(p.x + b.w, p.y + j)) contatto++; }
          let capo = false;
          if (primo && oltre.size && costo < 1000) for (let i = 0; i < b.w && !capo; i++) for (let j = 0; j < b.h && !capo; j++) if (oltre.has(key(p.x + i, p.y + j))) capo = true;
          if (!capo && Number.isNaN(cx)) continue; // (i candidati oltre la punta che non la toccano non servono)
          if (!mig || (capo && !mig.capo) || (capo === mig.capo && (costo < mig.costo || (costo === mig.costo && contatto > mig.contatto)))) mig = { p, costo, contatto, sfr, capo };
        }
      }
      if (!mig) { fuori++; continue; }
      messi.set(b.id, mig.p);
      for (const o of mig.sfr) sfrattati.add(o);
      for (let i = 0; i < b.w; i++) for (let j = 0; j < b.h; j++) occ2.add(key(mig.p.x + i, mig.p.y + j));
    }
    let areaFissi = 0, areaSfr = 0;
    for (const o of sfrattati) { areaSfr += area(o); if (fissiS.has(o)) areaFissi += area(o); }
    const nuove = [...strada].filter(k => !base.roads.has(k)).length;
    // Celle libere intrappolate attorno al nucleo: strisce larghe 1 fra il
    // nucleo e ciò che ha accanto (segnalazione dell'utente sul raccordo a 5:
    // la fila spostata di 1 per attaccare un 1×4 lasciava inutilizzato il lato
    // della verticale). Contano nel costo come strade.
    const pieno = (x: number, y: number) => {
      const k = key(x, y);
      if (!problem.cells.has(k) || inTh(x, y) || occupata(k)) return true;
      const o = owner.get(k);
      return !!o && !sfrattati.has(o);
    };
    let intrappolate = 0;
    const viste = new Set<string>();
    const guarda = (x: number, y: number) => {
      const k = key(x, y);
      if (viste.has(k) || pieno(x, y)) return;
      viste.add(k);
      if ((pieno(x - 1, y) && pieno(x + 1, y)) || (pieno(x, y - 1) && pieno(x, y + 1))) intrappolate++;
    };
    const contorno = (x0: number, y0: number, w: number, h: number) => {
      for (let i = 0; i < w; i++) { guarda(x0 + i, y0 - 1); guarda(x0 + i, y0 + h); }
      for (let j = 0; j < h; j++) { guarda(x0 - 1, y0 + j); guarda(x0 + w, y0 + j); }
    };
    for (const b of blocchi) contorno(b.x, b.y, 2, 2);
    for (const [id, p] of messi) { const b = byId.get(id)!; contorno(p.x, p.y, b.w, b.h); }
    const placements = new Map<string, Pos>();
    for (const [id, p] of base.placements) if (!due.has(id) && !sfrattati.has(id)) placements.set(id, p);
    for (const [id, p] of messi) placements.set(id, p);
    const blocchiK = blocchi.map(b => key(b.x, b.y));
    return {
      nome: `${blocchi.length} ${blocchi.length === 1 ? "blocco" : "blocchi"} da ${blocchiK[0]}${sfrattati.size ? `, ${sfrattati.size} spostati` : ""}`,
      placements, roads: new Set([...base.roads, ...strada]), blocchi: blocchiK,
      fissi: [...fissi.filter(id => !sfrattati.has(id) && !due.has(id)), ...messi.keys()],
      fuori, costo: [fuori, areaFissi, nuove + areaSfr / 4 + intrappolate], k: blocchi.length, chiave: [...blocchiK].sort().join(";"),
    };
  };
  const VERSI: Array<[number, number]> = [[2, 0], [-2, 0], [0, 2], [0, -2]];
  for (let bx = pth.x - 2; bx <= pth.x + th.w; bx++) for (let by = pth.y - 2; by <= pth.y + th.h; by++) {
    let tocca = false, dentro = false;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) { if (inTh(bx + dx, by + dy)) dentro = true; if (toccaTh(bx + dx, by + dy)) tocca = true; }
    if (dentro || !tocca) continue;
    for (const [vx, vy] of VERSI) {
      const blocchi: Pos[] = [];
      for (let k = 1; k <= KMAX; k++) {
        blocchi.push({ x: bx + (k - 1) * vx, y: by + (k - 1) * vy });
        const r = provaCatena(blocchi);
        if (!r) break; // fuori mappa o sul municipio: inutile allungare
        risultati.push(r);
        if (r.fuori === 0 && r.costo[1] === 0 && k > 1) break;
      }
    }
  }
  // nuclei sul raccordo est (fuori, poi strade nuove + sfratti: gli edifici fissi del builder si spostano)
  const sulRaccordo: Ris[] = [];
  if (raccordo) for (const by of [raccordo.eastMidY - 1, raccordo.eastMidY]) {
    const blocchi: Pos[] = [];
    let mig: Ris | null = null;
    for (let k = 1; k <= KMAX + 4; k++) { // (sul raccordo anche più lunga: lungo la verticale gli edifici sono già fitti)
      blocchi.push({ x: pth.x + th.w + (k - 1) * 2, y: by });
      const r = provaCatena(blocchi);
      if (!r) break;
      if (!mig || r.costo[0] < mig.costo[0] || (r.costo[0] === mig.costo[0] && r.costo[2] < mig.costo[2])) mig = r;
      if (r.fuori === 0) break;
    }
    if (mig) sulRaccordo.push({ ...mig, nome: `raccordo: ${mig.nome}` });
  }
  const cmp = (a: Ris, b: Ris) => a.costo[0] - b.costo[0] || a.costo[1] - b.costo[1] || a.costo[2] - b.costo[2];
  risultati.sort(cmp);
  // edifici a due corsie fuori: solo i nuclei che ne lasciano fuori il meno possibile
  const minFuori = risultati.length ? risultati[0]!.fuori : 0;
  for (let i = risultati.length - 1; i >= 0; i--) if (risultati[i]!.fuori > minFuori) risultati.splice(i, 1);
  const scelti: Ris[] = [];
  const aggiungi = (r: Ris | undefined) => { if (r && scelti.length < max && !scelti.some(s => s.chiave === r.chiave)) scelti.push(r); };
  // prima i nuclei sul raccordo (se non lasciano fuori più edifici degli altri)
  sulRaccordo.sort(cmp);
  for (const r of sulRaccordo) if (r.fuori <= minFuori && !scelti.some(s => s.chiave === r.chiave)) scelti.push(r);
  aggiungi(risultati[0]);
  aggiungi(risultati.find(r => r.k === 1));
  aggiungi(risultati.find(r => r.k > 1));
  for (const r of risultati) aggiungi(r);
  return scelti.map(({ nome, placements, roads, blocchi, fissi: f, fuori }) => ({ nome, placements, roads, blocchi, fissi: f, fuori }));
}

/**
 * Controllo delle regole sulle due corsie di una disposizione (modifiche
 * dall'editor): blocchi sfalsati che si toccano, blocchi non collegati al
 * municipio, edifici a due corsie che non toccano un blocco collegato.
 */
export function verificaDueCorsie(problem: PlannerProblem, placements: ReadonlyMap<string, Pos>, blocchi: readonly string[], lang: UiLang = "it"): string[] {
  const errori: string[] = [];
  const th = problem.buildings.find(b => b.isTownhall);
  const pth = th ? placements.get(th.id) : undefined;
  const pos = blocchi.map(k => { const i = k.indexOf(","); return { x: Number(k.slice(0, i)), y: Number(k.slice(i + 1)), k }; });
  // sfalsati: due blocchi che si toccano lungo un lato senza essere allineati
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
    const a = pos[i]!, b = pos[j]!;
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    const toccaOrizz = dx === 2 && dy === 1, toccaVert = dy === 2 && dx === 1;
    if (toccaOrizz || toccaVert) { errori.push(t("plannerErrTwoLaneMisaligned", lang)); break; }
  }
  if (!th || !pth) return errori;
  const inTh = (x: number, y: number) => x >= pth.x && x < pth.x + th.w && y >= pth.y && y < pth.y + th.h;
  const toccaTh = (b: Pos) => [[0, 0], [1, 0], [0, 1], [1, 1]].some(([dx, dy]) => { const x = b.x + dx!, y = b.y + dy!; return inTh(x + 1, y) || inTh(x - 1, y) || inTh(x, y + 1) || inTh(x, y - 1); });
  const coll = new Set<string>();
  const coda = pos.filter(toccaTh);
  for (const b of coda) coll.add(b.k);
  while (coda.length) {
    const b = coda.pop()!;
    for (const n of pos) if (!coll.has(n.k) && ((Math.abs(n.x - b.x) === 2 && n.y === b.y) || (Math.abs(n.y - b.y) === 2 && n.x === b.x))) { coll.add(n.k); coda.push(n); }
  }
  if (coll.size < pos.length) errori.push(t("plannerErrTwoLaneDisconnected", lang));
  const celle = new Set(celleBlocchi([...coll]));
  const staccati: string[] = [];
  for (const b of problem.buildings) {
    if (!richiedeDueCorsie(b)) continue;
    const p = placements.get(b.id); if (!p) continue;
    if (!tocca(b, p, celle)) staccati.push(b.name);
  }
  if (staccati.length) errori.push(t("plannerErrTwoLaneDetached", lang, staccati.slice(0, 5).join(", ") + (staccati.length > 5 ? t("plannerErrOthers", lang, staccati.length - 5) : "")));
  return errori;
}

function tocca(b: PlannerBuilding, p: Pos, celle: ReadonlySet<string>): boolean {
  for (let i = 0; i < b.w; i++) if (celle.has(key(p.x + i, p.y - 1)) || celle.has(key(p.x + i, p.y + b.h))) return true;
  for (let j = 0; j < b.h; j++) if (celle.has(key(p.x - 1, p.y + j)) || celle.has(key(p.x + b.w, p.y + j))) return true;
  return false;
}
