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
  /** Geometria da usare per la ricerca al posto di quella della base (rete a
   *  pettine: la partenza non ha la verticale del builder). */
  geometry?: { stradaVX: number; eastMidY: number };
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

// ─────────────────────────────────────────────────────────────────────────────
//  Rete a pettine (ottobre 2026): città con MOLTI edifici a due corsie (es.
//  Eirene: 55 su 113 edifici con strada), dove la fila dritta del nucleo non
//  basta. Si ridisegna tutta la rete a partire dal solo municipio:
//   - una dorsale parte da un blocco che tocca il municipio (verso l'esterno,
//     oppure lungo il municipio nei due versi) e da essa partono rami
//     perpendicolari;
//   - ogni ramo serve due file di edifici, una per lato, "a scaffale": la
//     distanza dal ramo successivo è la somma delle profondità delle due
//     file che stanno fra loro, quindi non restano strisce vuote;
//   - prima gli edifici a due corsie (rami di blocchi 2×2, su una griglia di
//     passo 2 ancorata al primo blocco: due blocchi che si toccano sono
//     sempre allineati), poi quelli a una corsia (rami larghi 1, più
//     economici); gli avanzi a una corsia vanno dove serve meno strada nuova;
//   - le punte di strada che nessun edificio usa vengono potate.
//  Si provano più radici, orientamenti e regole per le file; si tengono le
//  migliori (meno edifici fuori, poi meno strade). La partenza ha già tutti
//  gli edifici con strada: la ricerca la migliora e poi il completamento
//  mette quelli senza strada (come nella "Configurazione attuale").
// ─────────────────────────────────────────────────────────────────────────────

export function retePettine(problem: PlannerProblem, base: { placements: ReadonlyMap<string, Pos> }, max = 3): Nucleo[] {
  const ordine = (a: PlannerBuilding, b: PlannerBuilding) => b.w * b.h - a.w * a.h || b.h - a.h;
  const lista0 = problem.buildings.filter(richiedeDueCorsie).sort(ordine);
  const lista = [...lista0, ...problem.buildings.filter(b => !b.isTownhall && b.roadLevel === 1).sort(ordine)];
  const th = problem.buildings.find(b => b.isTownhall);
  const pth = th ? base.placements.get(th.id) : undefined;
  if (!lista0.length || !th || !pth) return [];
  const byId = new Map(problem.buildings.map(b => [b.id, b]));
  const dueVeri = new Set(lista0.map(b => b.id));
  const inTh = (x: number, y: number) => x >= pth.x && x < pth.x + th.w && y >= pth.y && y < pth.y + th.h;
  const libera = (x: number, y: number) => problem.cells.has(key(x, y)) && !inTh(x, y);
  const bloccoOk = (bx: number, by: number) => libera(bx, by) && libera(bx + 1, by) && libera(bx, by + 1) && libera(bx + 1, by + 1);
  const toccaTh = (bx: number, by: number) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const x = bx + dx, y = by + dy;
      if (inTh(x + 1, y) || inTh(x - 1, y) || inTh(x, y + 1) || inTh(x, y - 1)) return true;
    }
    return false;
  };

  type Cand = { nucleo: Nucleo; costo: [number, number, number, number] };
  const candidati: Cand[] = [];

  // Griglia della mappa (più veloce delle chiavi "x,y"): 1 = non disponibile
  // (fuori dalle aree sbloccate o municipio), 0 = libera.
  const X0 = problem.minX - 1, Y0 = problem.minY - 1, W = problem.maxX - problem.minX + 3, H = problem.maxY - problem.minY + 3;
  const idx = (x: number, y: number) => (x < X0 || y < Y0 || x >= X0 + W || y >= Y0 + H ? -1 : (y - Y0) * W + (x - X0));
  const G0 = new Uint8Array(W * H).fill(1);
  for (const k of problem.cells) { const [x, y] = k.split(",").map(Number) as [number, number]; if (!inTh(x, y)) G0[idx(x, y)] = 0; }
  const LIBERA = 0, STRADA2 = 2, STRADA1 = 3, EDIFICIO = 4;

  /** Pettine "a scaffali": i rami non hanno passo fisso; ognuno serve due
   *  file di edifici (una per lato) e la distanza dal ramo successivo è la
   *  somma delle profondità delle due file che stanno fra loro. Prima gli
   *  edifici a due corsie (rami di blocchi 2×2), poi quelli a una corsia
   *  (rami larghi 1, più economici). Coordinate locali: u lungo la dorsale
   *  (verso l'esterno), v lungo i rami. `bidir`: la dorsale cresce nei due
   *  versi a partire dalla radice. `modo`: profondità di ogni fila = quella
   *  dell'edificio in testa (0) o quella con più area da mettere (2).
   *  `esatta`: in una fila solo edifici della sua profondità (niente buchi
   *  larghi 1 fra le file). */
  const provaScaffali = (rx: number, ry: number, dx: number, dy: number, bidir: boolean, modo: number, esatta: boolean): Cand | null => {
    if (!bloccoOk(rx, ry)) return null;
    const G = G0.slice();
    const libero = (x: number, y: number) => { const i = idx(x, y); return i >= 0 && G[i] === LIBERA; };
    const blocchi = new Map<number, Pos>(); // indice dell'angolo → blocco
    const bloccoDi = new Map<number, number>(); // cella → indice del suo blocco
    const messi = new Map<string, Pos>();
    const rettLibero = (r: Pos, b: PlannerBuilding) => {
      for (let j = 0; j < b.h; j++) { const i0 = idx(r.x, r.y + j); if (i0 < 0 || idx(r.x + b.w - 1, r.y + j) < 0) return false; for (let i = 0; i < b.w; i++) if (G[i0 + i] !== LIBERA) return false; }
      return true;
    };
    const piazza = (b: PlannerBuilding, r: Pos) => { messi.set(b.id, r); for (let j = 0; j < b.h; j++) { const i0 = idx(r.x, r.y + j); for (let i = 0; i < b.w; i++) G[i0 + i] = EDIFICIO; } };
    const metti2 = (r: Pos) => {
      const k = idx(r.x, r.y);
      if (blocchi.has(k)) return;
      blocchi.set(k, r);
      for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) { const i = idx(r.x + a, r.y + c); G[i] = STRADA2; bloccoDi.set(i, k); }
    };
    const prof = (b: PlannerBuilding) => (dx !== 0 ? b.w : b.h), lung = (b: PlannerBuilding) => (dx !== 0 ? b.h : b.w);
    const pool = [...lista].sort((a, b) => (b.roadLevel >= 2 ? 1 : 0) - (a.roadLevel >= 2 ? 1 : 0) || prof(b) - prof(a) || lung(b) - lung(a));
    const togli = (b: PlannerBuilding) => { const i = pool.indexOf(b); if (i >= 0) pool.splice(i, 1); };
    const testa = () => pool[0];
    const profScelta = () => {
      const t = testa(); if (!t) return 0;
      if (modo === 0) return prof(t);
      const tot = new Map<number, number>();
      for (const b of pool) if ((b.roadLevel >= 2) === (t.roadLevel >= 2)) tot.set(prof(b), (tot.get(prof(b)) ?? 0) + lung(b) * prof(b));
      let mig = prof(t), mv = -1;
      for (const [d, v] of tot) if (v > mv || (v === mv && d > mig)) { mig = d; mv = v; }
      return mig;
    };
    /** Fronte di crescita della dorsale in un verso (sd = +1 o -1). Il blocco radice è u, v ∈ {0, 1}. */
    const fronte = (sd: number) => {
      const ddx = dx * sd, ddy = dy * sd, px = -ddy, py = ddx;
      const ox = rx + (ddx < 0 || px < 0 ? 1 : 0), oy = ry + (ddy < 0 || py < 0 ? 1 : 0);
      const gx = (u: number, v: number) => ox + u * ddx + v * px, gy = (u: number, v: number) => oy + u * ddy + v * py;
      const rett = (u0: number, v0: number, du: number, dv: number) => {
        const x1 = gx(u0, v0), x2 = gx(u0 + du - 1, v0 + dv - 1), y1 = gy(u0, v0), y2 = gy(u0 + du - 1, v0 + dv - 1);
        return { x: Math.min(x1, x2), y: Math.min(y1, y2) };
      };
      const okLoc = (U: number, V: number) => { const r = rett(U, V, 2, 2); const i = idx(r.x, r.y); if (i >= 0 && G[i] === STRADA2 && bloccoDi.get(i) === i) return true; return libero(r.x, r.y) && libero(r.x + 1, r.y) && libero(r.x, r.y + 1) && libero(r.x + 1, r.y + 1); };
      const okCella = (u: number, v: number) => { const i = idx(gx(u, v), gy(u, v)); return i >= 0 && (G[i] === LIBERA || G[i] === STRADA1); };
      const metti1 = (u: number, v: number) => { const i = idx(gx(u, v), gy(u, v)); if (G[i] === LIBERA) G[i] = STRADA1; };
      const st = { U: 0, dPrec: 0, fine2: -2, fine1: -1, finito: false, primo: true };
      const dorsaleFino = (U: number, due: boolean) => {
        if (due) { for (let u = st.fine2 + 2; u <= U; u += 2) { if (!okLoc(u, 0)) return false; metti2(rett(u, 0, 2, 2)); } st.fine2 = Math.max(st.fine2, U); return true; }
        for (let u = Math.max(st.fine2 + 2, st.fine1 + 1); u <= U; u++) { if (!okCella(u, 0)) return false; metti1(u, 0); st.fine1 = u; }
        return true;
      };
      const ramo = (U: number, due: boolean) => {
        let vMax = due || U <= st.fine2 + 1 ? 1 : 0, vMin = 0;
        if (due) {
          for (let V = 2; okLoc(U, V); V += 2) { metti2(rett(U, V, 2, 2)); vMax = V + 1; }
          for (let V = -2; okLoc(U, V); V -= 2) { metti2(rett(U, V, 2, 2)); vMin = V; }
        } else {
          for (let v = vMax + 1; okCella(U, v); v++) { metti1(U, v); vMax = v; }
          for (let v = -1; okCella(U, v); v--) { metti1(U, v); vMin = v; }
        }
        return { vMin, vMax, larg: due ? 2 : 1 };
      };
      const fila = (U: number, est: boolean, d: number, ext: { vMin: number; vMax: number; larg: number }, inizio: number) => {
        for (const s of [1, -1]) {
          let cur = s > 0 ? inizio : -1;
          while (pool.length && (s > 0 ? cur <= ext.vMax : cur >= ext.vMin)) {
            let fatto = false;
            for (const solo of esatta ? [true] : [true, false]) {
              for (const b of pool) {
                if (b.roadLevel >= 2 && ext.larg < 2) continue;
                const dp = prof(b), ln = lung(b);
                if (dp > d || (solo && dp !== d)) continue;
                const r = rett(est ? U + ext.larg : U - dp, s > 0 ? cur : cur - ln + 1, dp, ln);
                if (!rettLibero(r, b)) continue;
                piazza(b, r); togli(b); cur += s * ln; fatto = true; break;
              }
              if (fatto) break;
            }
            if (!fatto) cur += s;
          }
        }
      };
      /** Un ramo con le sue file; false se la dorsale non può più crescere. */
      const passo = (): boolean => {
        if (st.finito || !pool.length) return false;
        const due = testa()!.roadLevel >= 2;
        const U = st.U;
        if (!dorsaleFino(U, due)) { st.finito = true; return false; }
        const ext = ramo(U, due);
        const inizio = U <= st.fine2 + 1 ? 2 : 1;
        fila(U, false, st.primo ? profScelta() : st.dPrec, ext, inizio);
        st.primo = false;
        const dE = profScelta();
        fila(U, true, dE, ext, inizio);
        st.dPrec = profScelta();
        let prossimo = U + ext.larg + dE + st.dPrec;
        if (pool.length && testa()!.roadLevel >= 2 && prossimo % 2) prossimo++; // i blocchi stanno su u pari
        st.U = prossimo;
        return true;
      };
      return { passo, st };
    };
    const avanti = fronte(1);
    const indietro = bidir ? fronte(-1) : null;
    avanti.passo(); // ramo radice (con le sue due file)
    if (indietro) {
      // il verso negativo parte oltre la fila "ovest" del ramo radice
      let oltre = 2;
      for (const [id, p] of messi) {
        const b = byId.get(id)!;
        const lontano = dx !== 0 ? (dx > 0 ? rx - p.x : p.x + b.w - 1 - (rx + 1)) : (dy > 0 ? ry - p.y : p.y + b.h - 1 - (ry + 1));
        if (lontano > 0) oltre = Math.max(oltre, 2 + lontano);
      }
      indietro.st.U = oltre + profScelta();
      if (pool.length && testa()!.roadLevel >= 2 && indietro.st.U % 2) indietro.st.U++;
    }
    while (pool.length) {
      const a1 = avanti.passo();
      const a2 = indietro ? indietro.passo() : false;
      if (!a1 && !a2) break;
    }
    // avanzi: a una corsia, dove serve meno strada nuova (scavata dalla rete più vicina)
    let fuori = 0;
    for (const b of [...pool]) {
      if (b.roadLevel >= 2) { fuori++; continue; }
      const dist = new Int32Array(W * H).fill(-1), padre = new Int32Array(W * H).fill(-1);
      const coda: number[] = [];
      for (let i = 0; i < W * H; i++) if (G[i] === STRADA2 || G[i] === STRADA1) { dist[i] = 0; coda.push(i); }
      for (let q = 0; q < coda.length; q++) {
        const i = coda[q]!;
        for (const n of [i + 1, i - 1, i + W, i - W]) {
          if (n < 0 || n >= W * H || dist[n] >= 0 || G[n] !== LIBERA) continue;
          dist[n] = dist[i]! + 1; padre[n] = i; coda.push(n);
        }
      }
      let mig: { p: Pos; costo: number; attacco: number } | null = null;
      for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) {
        const p = { x, y };
        if (!rettLibero(p, b)) continue;
        const prova1 = (cx: number, cy: number) => { const i = idx(cx, cy); if (i < 0) return; const d = dist[i]!; if (d >= 0 && (!mig || d < mig.costo)) mig = { p, costo: d, attacco: i }; };
        for (let i = 0; i < b.w; i++) { prova1(x + i, y - 1); prova1(x + i, y + b.h); }
        for (let j = 0; j < b.h; j++) { prova1(x - 1, y + j); prova1(x + b.w, y + j); }
      }
      const m = mig as { p: Pos; costo: number; attacco: number } | null;
      if (!m) { fuori++; continue; }
      piazza(b, m.p); togli(b);
      for (let c = m.attacco; c >= 0 && G[c] === LIBERA; c = padre[c]!) G[c] = STRADA1;
    }
    // potatura: via i pezzi di strada in punta che nessun edificio usa come unico
    // appoggio. Un blocco a due corsie in punta usato da qualche edificio si toglie
    // lo stesso se quegli edifici possono scivolare di 1-3 celle (anche dentro lo
    // spazio liberato) e restare attaccati alla rete: "accorciare il fine strada"
    // (segnalazione dell'utente su Eirene: blocchi in punta che servivano solo un
    // 3×3, togliendoli e abbassando il 3×3 di due si risparmiano 4 strade per punta).
    const radice = idx(rx, ry);
    /** Appoggi di un edificio in (p): blocchi (indice dell'angolo) o celle a una corsia adatte. */
    const appoggi = (b: PlannerBuilding, p: Pos) => {
      const app = new Set<number>();
      const g = (x: number, y: number) => {
        const i = idx(x, y); if (i < 0) return;
        if (G[i] === STRADA2) app.add(bloccoDi.get(i)!); else if (G[i] === STRADA1 && b.roadLevel < 2) app.add(i);
      };
      for (let i = 0; i < b.w; i++) { g(p.x + i, p.y - 1); g(p.x + i, p.y + b.h); }
      for (let j = 0; j < b.h; j++) { g(p.x - 1, p.y + j); g(p.x + b.w, p.y + j); }
      return app;
    };
    const segna = (b: PlannerBuilding, p: Pos, v: number) => { for (let j = 0; j < b.h; j++) { const i0 = idx(p.x, p.y + j); for (let i = 0; i < b.w; i++) G[i0 + i] = v; } };
    const SPOSTAMENTI: Array<[number, number]> = [];
    for (const t of [1, 2, 3]) SPOSTAMENTI.push([0, t], [0, -t], [t, 0], [-t, 0]);
    for (let cambiato = true; cambiato;) {
      cambiato = false;
      const necessari = new Map<number, string[]>(); // blocco o cella a una corsia → edifici che si appoggiano solo lì
      for (const [id, p] of messi) {
        const app = appoggi(byId.get(id)!, p);
        if (app.size === 1) { const k = [...app][0]!; necessari.set(k, [...(necessari.get(k) ?? []), id]); }
      }
      const strada = (i: number) => i >= 0 && i < W * H && (G[i] === STRADA2 || G[i] === STRADA1);
      for (const [k, r] of [...blocchi]) {
        if (k === radice) continue;
        let vicini = 0;
        const fuoriBlocco = [idx(r.x - 1, r.y), idx(r.x - 1, r.y + 1), idx(r.x + 2, r.y), idx(r.x + 2, r.y + 1), idx(r.x, r.y - 1), idx(r.x + 1, r.y - 1), idx(r.x, r.y + 2), idx(r.x + 1, r.y + 2)];
        const visti = new Set<number>();
        for (const i of fuoriBlocco) if (strada(i)) { const g = G[i] === STRADA2 ? bloccoDi.get(i)! : i; if (!visti.has(g)) { visti.add(g); vicini++; } }
        if (vicini > 1) continue;
        const celleB = ([[0, 0], [1, 0], [0, 1], [1, 1]] as const).map(([a, c]) => idx(r.x + a, r.y + c));
        for (const i of celleB) G[i] = LIBERA;
        const dip = necessari.get(k) ?? [];
        const nuove = new Map<string, Pos>();
        let ok = true;
        for (const id of dip) segna(byId.get(id)!, messi.get(id)!, LIBERA);
        for (const id of dip) {
          const b = byId.get(id)!, p = messi.get(id)!;
          let trovato: Pos | null = null;
          for (const [sx, sy] of SPOSTAMENTI) {
            const q = { x: p.x + sx, y: p.y + sy };
            if (!rettLibero(q, b)) continue;
            if (appoggi(b, q).size === 0) continue;
            trovato = q; break;
          }
          if (!trovato) { ok = false; break; }
          nuove.set(id, trovato);
          segna(b, trovato, EDIFICIO);
        }
        if (!ok) {
          // si torna com'era
          for (const [id, q] of nuove) segna(byId.get(id)!, q, LIBERA);
          for (const id of dip) segna(byId.get(id)!, messi.get(id)!, EDIFICIO);
          for (const i of celleB) G[i] = STRADA2;
          continue;
        }
        for (const [id, q] of nuove) messi.set(id, q);
        blocchi.delete(k);
        for (const i of celleB) bloccoDi.delete(i);
        cambiato = true;
        break; // gli appoggi sono cambiati: si ricalcolano
      }
      if (cambiato) continue;
      for (let i = 0; i < W * H; i++) {
        if (G[i] !== STRADA1 || necessari.has(i)) continue;
        let n = 0;
        for (const j of [i + 1, i - 1, i + W, i - W]) if (strada(j)) n++;
        if (n > 1) continue;
        G[i] = LIBERA; cambiato = true;
      }
    }
    const blocchiK = [...blocchi.values()].map(r => key(r.x, r.y));
    const roads = new Set<string>();
    let n1 = 0;
    for (let i = 0; i < W * H; i++) if (G[i] === STRADA2 || G[i] === STRADA1) { roads.add(key(X0 + (i % W), Y0 + Math.floor(i / W))); if (G[i] === STRADA1) n1++; }
    const placements = new Map<string, Pos>([[th.id, pth], ...messi]);
    return {
      nucleo: {
        nome: `pettine: dorsale ${bidir ? (dx ? "est-ovest" : "nord-sud") : dx ? (dx > 0 ? "est" : "ovest") : (dy > 0 ? "sud" : "nord")} da ${key(rx, ry)}, ${blocchiK.length} blocchi, ${n1} strade a una corsia`,
        placements, roads, blocchi: blocchiK,
        fissi: [...messi.keys()].filter(id => dueVeri.has(id)), fuori,
        geometry: { stradaVX: problem.minX - 1, eastMidY: pth.y + Math.floor(th.h / 2) },
      },
      costo: [fuori, 0, roads.size, blocchiK.length],
    };
  };

  // radici: blocchi che toccano il municipio, uno ogni 2 celle lungo ogni lato; dorsale verso l'esterno
  const radici: Array<[number, number, number, number]> = [];
  for (let x = pth.x - 1; x < pth.x + th.w; x += 2) { radici.push([x, pth.y - 2, 0, -1], [x, pth.y + th.h, 0, 1]); }
  for (let y = pth.y - 1; y < pth.y + th.h; y += 2) { radici.push([pth.x - 2, y, -1, 0], [pth.x + th.w, y, 1, 0]); }
  for (const [rx, ry, dx, dy] of radici) {
    if (!bloccoOk(rx, ry) || !toccaTh(rx, ry)) continue;
    for (const [ddx, ddy, bd] of [[dx, dy, false], [dy, dx, true]] as const) for (const modo of [0, 2]) for (const esatta of [true, false]) {
      const c = provaScaffali(rx, ry, ddx, ddy, bd, modo, esatta);
      if (c) candidati.push(c);
    }
  }
  candidati.sort((a, b) => a.costo[0] - b.costo[0] || a.costo[1] - b.costo[1] || a.costo[2] - b.costo[2] || a.costo[3] - b.costo[3]);
  const scelti: Nucleo[] = [];
  const firme = new Set<string>();
  for (const c of candidati) {
    const f = [...c.nucleo.blocchi].sort().join(";");
    if (firme.has(f)) continue;
    firme.add(f);
    scelti.push(c.nucleo);
    if (scelti.length >= max) break;
  }
  return scelti;
}
