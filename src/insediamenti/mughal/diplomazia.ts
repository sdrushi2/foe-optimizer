/**
 * Ottimizzatore della diplomazia dei Mughal (28/11/2026).
 *
 * Per sbloccare i livelli dell'incursione serve una diplomazia totale ≥ una soglia (102 … 1260).
 * Regole (dall'utente):
 * - si possono togliere senza penalità le manifatture e le Bhavan; togliere uno Shanti costa,
 *   togliere un Haveli costa di più (gli edifici grandi sono lunghi da ricostruire);
 * - nessuna residenza nuova: la popolazione viene solo da quelle che restano (anche staccate
 *   dalla strada) e non deve mai essere negativa;
 * - si costruiscono Canali d'acqua, Vialetti e diplomatici (Chhatri, Baldacchino, Chahar bagh),
 *   solo quelli sbloccati; i diplomatici danno diplomazia anche senza strada;
 * - le strade non si tolgono mai: si mettono dove capita negli spazi che avanzano;
 * - l'Ambasciata e tutto il resto si possono spostare;
 * - (28/11/2026, utente) l'obiettivo è il minimo indispensabile: una volta sbloccato il livello
 *   si demolisce tutto, quindi niente margine. A parità di Haveli e Shanti tolti vince chi fa
 *   meno lavori (edifici tolti + nuovi + spostati, strade e Ambasciata comprese); la tabella
 *   mostra ogni compromesso non dominato fra grandi tolti e lavori.
 *
 * Catene (dalle definizioni del gioco, ChainStartAbility / ChainLinkAbility "chain_mughals"):
 * l'Ambasciata (6×9) ha tre attacchi: sopra (Canale 3×2 sopra le colonne 2–4), sotto (Canale
 * 3×2 sotto le colonne 2–4) e a destra (Vialetto 2×3 accanto alle righe 4–6). I Canali si
 * impilano in verticale, i Vialetti si mettono in fila verso destra. Bonus per posizione nella
 * catena: Canale +10/+20/+30, Vialetto +5/+10/+15/+20/+25; oltre, la catena si allunga senza
 * bonus (resta la diplomazia base).
 *
 * Ricerca a intervento minimo (prima di tutto, con l'Ambasciata dov'è): tutto resta al suo posto,
 * si aggiungono Canali, Vialetti e diplomatici negli spazi vuoti e, se non basta, si toglie un
 * edificio alla volta (manifatture, Bhavan, poi Shanti e Haveli nei limiti della combinazione)
 * scegliendo sempre la mossa con più diplomazia per lavoro; arrivati alla soglia si tolgono le
 * aggiunte che non servono e si rimettono gli edifici tolti che ci stanno ancora.
 *
 * Ricerca completa (riorganizza tutto): per ogni posizione dell'Ambasciata e per ogni combinazione di residenze tenute
 * (Haveli, Shanti, Bhavan) si dispone tutto con un riempimento goloso: si prenotano le caselle
 * delle catene, si mettono le residenze tenute (prima nei loro posti di adesso, se liberi), poi i
 * diplomatici più densi che la popolazione regge, le catene, e si riempie il resto con Canali,
 * Vialetti e Chhatri, lasciando sempre abbastanza caselle libere per tutte le strade. Il
 * risultato: per ogni combinazione di Haveli e Shanti tolti, la diplomazia più alta trovata.
 * Modulo puro (nessun React): gira nel worker e nel banco di prova (node).
 */

export interface TipoDipl {
  id: string;
  w: number;
  h: number;
  /** Popolazione data (>0, residenze) o richiesta (<0, diplomatici). */
  pop: number;
  /** Diplomazia base. */
  dipl: number;
}

export interface RichiestaDiplomazia {
  righe: number;
  colonne: number;
  /** righe×colonne, 1 = casella utilizzabile. */
  libere: Uint8Array | number[];
  ambasciata: { w: number; h: number };
  /** Diplomazia da raggiungere. */
  soglia: number;
  /** Strade da rimettere tutte (1×1). */
  strade: number;
  /** Residenze presenti, con le loro posizioni di adesso (si prova a lasciarle lì). `peso`:
   *  costo di toglierne una (0 = libera, 1 = Shanti, 2 = Haveli). */
  residenze: Array<{ tipo: TipoDipl; peso: 0 | 1 | 2; posizioni: Array<{ row: number; col: number }> }>;
  /** Diplomatici sbloccati (Chhatri, Baldacchino, Chahar bagh) con le posizioni di quelli già costruiti. */
  diplomatici: Array<{ tipo: TipoDipl; posizioni: Array<{ row: number; col: number }> }>;
  /** Canale d'acqua e Vialetto, se sbloccati. */
  canale?: TipoDipl;
  vialetto?: TipoDipl;
  /** Posizione dell'Ambasciata adesso (si prova per prima). */
  ambasciataOra?: { row: number; col: number };
  tempoMs: number;
  seme?: number;
  /** Solo queste posizioni dell'Ambasciata (per dividere il lavoro fra i worker). */
  posizioni?: Array<{ row: number; col: number }>;
  /** Disposizione di adesso, strade comprese (Ambasciata esclusa): per contare i lavori e per la
   *  ricerca a intervento minimo. `pop` e `dipl` servono anche per le manifatture. */
  ora?: Array<PezzoDipl & { pop: number; dipl: number }>;
  /** Id della strada (nella disposizione di adesso). */
  idStrada?: string;
}

/** Lavori per passare dalla disposizione di adesso a quella del tentativo. */
export interface Lavori { tolti: number; nuovi: number; spostati: number }
export const totaleLavori = (l: Lavori) => l.tolti + l.nuovi + l.spostati;

export interface PezzoDipl { id: string; row: number; col: number; w: number; h: number }

export interface TentativoDipl {
  haveliTolti: number;
  shantiTolti: number;
  diplomazia: number;
  popolazione: number;
  ambasciata: { row: number; col: number };
  /** Tutti gli edifici tranne l'Ambasciata e le strade. */
  edifici: PezzoDipl[];
  strade: Array<{ row: number; col: number }>;
  /** Edifici per tipo (strade escluse). */
  conti: Record<string, number>;
  /** Edifici tolti, nuovi e spostati (strade e Ambasciata comprese) rispetto ad adesso. */
  lavori: Lavori;
}

/** Bonus delle catene per posizione (1°, 2°, …); oltre, niente bonus. */
export const BONUS_CANALE = [10, 20, 30];
export const BONUS_VIALETTO = [5, 10, 15, 20, 25];
/** Soglie dei livelli dell'incursione (dall'utente). */
export const SOGLIE_DIPLOMAZIA = [102, 214, 307, 400, 540, 700, 870, 1050, 1260];

/** Attacchi delle catene rispetto all'angolo dell'Ambasciata 6×9 (definizioni del gioco). */
const ATTACCO_SOPRA = { dc: 1, dr: -2 };     // Canale, poi in su di 2 righe
const ATTACCO_DESTRA = { dc: 6, dr: 3 };     // Vialetto, poi a destra di 2 colonne

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Diplomazia di una disposizione qualsiasi: base di ogni edificio + bonus delle catene che
 * partono dall'Ambasciata. Usata anche dal planner per la pillola DIPL.
 */
export function diplomaziaDisposizione(
  pezzi: Array<{ id: string; row: number; col: number; w: number; h: number }>,
  ambasciata: { row: number; col: number; h: number } | null,
  base: (id: string) => number,
  ids: { canale: string; vialetto: string },
): number {
  let tot = 0;
  const pos = new Map<string, string>();
  for (const p of pezzi) { tot += base(p.id); pos.set(p.row + ":" + p.col, p.id); }
  if (!ambasciata) return tot;
  const catena = (r0: number, c0: number, dr: number, dc: number, id: string, bonus: number[]) => {
    let r = r0, c = c0;
    for (let i = 0; pos.get(r + ":" + c) === id; i++, r += dr, c += dc) tot += bonus[i] ?? 0;
  };
  catena(ambasciata.row + ATTACCO_SOPRA.dr, ambasciata.col + ATTACCO_SOPRA.dc, -2, 0, ids.canale, BONUS_CANALE);
  catena(ambasciata.row + ambasciata.h, ambasciata.col + ATTACCO_SOPRA.dc, 2, 0, ids.canale, BONUS_CANALE);
  catena(ambasciata.row + ATTACCO_DESTRA.dr, ambasciata.col + ATTACCO_DESTRA.dc, 0, 2, ids.vialetto, BONUS_VIALETTO);
  return tot;
}

// ── disposizione golosa per una posizione dell'Ambasciata e un insieme di residenze ──

interface Esito { dipl: number; pop: number; pezzi: PezzoDipl[]; strade: number[]; fermi: number }

/** Posizioni valide dell'Ambasciata (tutte: le catene non sono simmetriche). */
export function posizioniAmbasciataDipl(req: Pick<RichiestaDiplomazia, "righe" | "colonne" | "libere" | "ambasciata">): Array<{ row: number; col: number }> {
  const { righe: R, colonne: C, libere: L, ambasciata: A } = req;
  const out: Array<{ row: number; col: number }> = [];
  for (let r = 0; r + A.h <= R; r++) for (let c = 0; c + A.w <= C; c++) {
    let ok = true;
    for (let i = 0; i < A.h && ok; i++) for (let j = 0; j < A.w; j++) if (!L[(r + i) * C + c + j]) { ok = false; break; }
    if (ok) out.push({ row: r, col: c });
  }
  return out;
}

function disponi(req: RichiestaDiplomazia, amb: { row: number; col: number }, tenute: number[], rng: (() => number) | null, neiPostiDiAdesso: boolean): Esito | null {
  const R = req.righe, C = req.colonne, N = R * C;
  const occ = new Uint8Array(N);       // 1 = occupata / non utilizzabile
  const pren = new Uint8Array(N);      // 1 = prenotata per una catena
  for (let i = 0; i < N; i++) occ[i] = req.libere[i] ? 0 : 1;
  let libere = 0;
  for (let i = 0; i < N; i++) if (!occ[i]) libere++;
  const A = req.ambasciata;
  for (let i = 0; i < A.h; i++) for (let j = 0; j < A.w; j++) occ[(amb.row + i) * C + amb.col + j] = 1;
  libere -= A.w * A.h;
  const pezzi: PezzoDipl[] = [];
  let fermi = req.ambasciataOra && req.ambasciataOra.row === amb.row && req.ambasciataOra.col === amb.col ? 1 : 0;

  const vuoto = (r: number, c: number, w: number, h: number, ancheprenotate: boolean) => {
    if (r < 0 || c < 0 || r + h > R || c + w > C) return false;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      const k = (r + i) * C + c + j;
      if (occ[k] || (!ancheprenotate && pren[k])) return false;
    }
    return true;
  };
  const metti = (t: TipoDipl, r: number, c: number) => {
    for (let i = 0; i < t.h; i++) for (let j = 0; j < t.w; j++) { const k = (r + i) * C + c + j; occ[k] = 1; pren[k] = 0; }
    libere -= t.w * t.h;
    pezzi.push({ id: t.id, row: r, col: c, w: t.w, h: t.h });
  };
  /** Posto per un rettangolo: quello che tocca più bordi e caselle occupate (lascia meno buchi). */
  const cerca = (t: TipoDipl, origini: Array<{ row: number; col: number }> | null): { r: number; c: number; fermo: boolean } | null => {
    if (origini) for (const o of origini) if (vuoto(o.row, o.col, t.w, t.h, false)) return { r: o.row, c: o.col, fermo: true };
    let best = -1, bestS = -Infinity;
    for (let r = 0; r + t.h <= R; r++) for (let c = 0; c + t.w <= C; c++) {
      if (!vuoto(r, c, t.w, t.h, false)) continue;
      let s = 0;
      for (let i = 0; i < t.h; i++) {
        if (c === 0 || occ[(r + i) * C + c - 1] || pren[(r + i) * C + c - 1]) s++;
        if (c + t.w === C || occ[(r + i) * C + c + t.w] || pren[(r + i) * C + c + t.w]) s++;
      }
      for (let j = 0; j < t.w; j++) {
        if (r === 0 || occ[(r - 1) * C + c + j] || pren[(r - 1) * C + c + j]) s++;
        if (r + t.h === R || occ[(r + t.h) * C + c + j] || pren[(r + t.h) * C + c + j]) s++;
      }
      if (rng) s += rng() * 1.5;
      if (s > bestS) { bestS = s; best = r * C + c; }
    }
    return best < 0 ? null : { r: Math.floor(best / C), c: best % C, fermo: false };
  };
  /** Si può mettere un pezzo di quest'area lasciando posto a tutte le strade? */
  const ciStaConStrade = (area: number) => libere - area >= req.strade;

  // 1. prenota le catene (fino all'ultimo bonus): la prima casella occupata le ferma
  const catene: Array<{ tipo: TipoDipl; posti: Array<{ r: number; c: number }>; bonus: number[] }> = [];
  const prenota = (tipo: TipoDipl | undefined, r0: number, c0: number, dr: number, dc: number, bonus: number[]) => {
    if (!tipo) return;
    const posti: Array<{ r: number; c: number }> = [];
    for (let i = 0, r = r0, c = c0; i < bonus.length; i++, r += dr, c += dc) {
      if (!vuoto(r, c, tipo.w, tipo.h, false)) break;
      posti.push({ r, c });
      for (let a = 0; a < tipo.h; a++) for (let b = 0; b < tipo.w; b++) pren[(r + a) * C + c + b] = 1;
    }
    catene.push({ tipo, posti, bonus });
  };
  prenota(req.canale, amb.row + ATTACCO_SOPRA.dr, amb.col + ATTACCO_SOPRA.dc, -2, 0, BONUS_CANALE);
  prenota(req.canale, amb.row + A.h, amb.col + ATTACCO_SOPRA.dc, 2, 0, BONUS_CANALE);
  prenota(req.vialetto, amb.row + ATTACCO_DESTRA.dr, amb.col + ATTACCO_DESTRA.dc, 0, 2, BONUS_VIALETTO);
  let prenotate = 0;
  for (let i = 0; i < N; i++) prenotate += pren[i];

  // 2. residenze tenute (prima le grandi), nei loro posti se liberi
  let pop = 0;
  const ordine = tenute.map((n, i) => ({ i, n })).sort((a, b) => req.residenze[b.i]!.tipo.w * req.residenze[b.i]!.tipo.h - req.residenze[a.i]!.tipo.w * req.residenze[a.i]!.tipo.h);
  for (const { i, n } of ordine) {
    const res = req.residenze[i]!;
    const origini = neiPostiDiAdesso ? res.posizioni.slice() : null;
    for (let k = 0; k < n; k++) {
      // le caselle prenotate per le catene restano libere: se non ci sta altrove, la catena si accorcia
      let p = cerca(res.tipo, origini);
      if (!p) { pren.fill(0); prenotate = 0; for (const ct of catene) ct.posti = []; p = cerca(res.tipo, origini); }
      if (!p) return null;
      if (!ciStaConStrade(res.tipo.w * res.tipo.h)) return null;
      metti(res.tipo, p.r, p.c);
      if (p.fermo) { fermi++; if (origini) origini.splice(origini.findIndex(o => o.row === p.r && o.col === p.c), 1); }
      pop += res.tipo.pop;
    }
  }
  // le catene prenotate devono restare possibili anche con le strade
  const areaCatene = () => catene.reduce((s, ct) => s + ct.posti.length * ct.tipo.w * ct.tipo.h, 0);

  // 3. diplomatici dal più denso, finché la popolazione e lo spazio reggono (catene comprese)
  let dipl = 0;
  const dipls = [...req.diplomatici].sort((a, b) => b.tipo.dipl / (b.tipo.w * b.tipo.h) - a.tipo.dipl / (a.tipo.w * a.tipo.h));
  const posiDip = new Map(dipls.map(d => [d.tipo.id, neiPostiDiAdesso ? d.posizioni.slice() : null]));
  for (const d of dipls) {
    for (;;) {
      if (pop + d.tipo.pop < 0) break;
      const area = d.tipo.w * d.tipo.h;
      if (libere - area - areaCatene() < req.strade) break;
      const orig = posiDip.get(d.tipo.id) ?? null;
      const p = cerca(d.tipo, orig);
      if (!p) break;
      metti(d.tipo, p.r, p.c);
      if (p.fermo && orig) { fermi++; orig.splice(orig.findIndex(o => o.row === p.r && o.col === p.c), 1); }
      pop += d.tipo.pop; dipl += d.tipo.dipl;
    }
  }
  // 4. catene nelle caselle prenotate (se le strade ci stanno ancora)
  for (const ct of catene) {
    for (let i = 0; i < ct.posti.length; i++) {
      const { r, c } = ct.posti[i]!;
      if (!ciStaConStrade(ct.tipo.w * ct.tipo.h)) { ct.posti.length = i; break; }
      metti(ct.tipo, r, c);
      dipl += ct.tipo.dipl + (ct.bonus[i] ?? 0);
    }
  }
  pren.fill(0);
  void prenotate;
  // 5. riempimento: Canali e Vialetti (anche in coda alle catene, stessa diplomazia base), Chhatri
  const riempitivi: TipoDipl[] = [];
  if (req.canale) riempitivi.push(req.canale);
  if (req.vialetto) riempitivi.push(req.vialetto);
  for (const d of dipls) if (d.tipo.w * d.tipo.h <= 4) riempitivi.push(d.tipo);
  for (let giro = true; giro;) {
    giro = false;
    for (const t of riempitivi) {
      if (t.pop < 0 && pop + t.pop < 0) continue;
      if (!ciStaConStrade(t.w * t.h)) continue;
      const p = cerca(t, null);
      if (!p) continue;
      metti(t, p.r, p.c);
      pop += t.pop; dipl += t.dipl;
      giro = true;
    }
  }
  // 6. strade nelle caselle rimaste (prima quelle più chiuse: lasciano spazi più puliti)
  const vuote: Array<{ k: number; s: number }> = [];
  for (let k = 0; k < N; k++) if (!occ[k]) {
    const r = Math.floor(k / C), c = k % C;
    let s = 0;
    if (r === 0 || occ[k - C]) s++;
    if (r === R - 1 || occ[k + C]) s++;
    if (c === 0 || occ[k - 1]) s++;
    if (c === C - 1 || occ[k + 1]) s++;
    vuote.push({ k, s });
  }
  if (vuote.length < req.strade) return null;
  vuote.sort((a, b) => b.s - a.s || a.k - b.k);
  const strade = vuote.slice(0, req.strade).map(v => v.k);
  return { dipl, pop, pezzi, strade, fermi };
}

// ── lavori ───────────────────────────────────────────────────────────────

/** Tolti / nuovi / spostati rispetto a `req.ora` (stesso tipo nello stesso posto = fermo). */
function contaLavori(req: RichiestaDiplomazia, amb: { row: number; col: number }, pezzi: PezzoDipl[], strade: Array<{ row: number; col: number }>): Lavori {
  const prima = new Map<string, Set<number>>(), dopo = new Map<string, number[]>();
  const C = req.colonne;
  for (const p of req.ora ?? []) { let x = prima.get(p.id); if (!x) prima.set(p.id, (x = new Set())); x.add(p.row * C + p.col); }
  const metti = (id: string, k: number) => { let x = dopo.get(id); if (!x) dopo.set(id, (x = [])); x.push(k); };
  for (const p of pezzi) metti(p.id, p.row * C + p.col);
  for (const s of strade) metti(req.idStrada ?? "strada", s.row * C + s.col);
  const l: Lavori = { tolti: 0, nuovi: 0, spostati: 0 };
  for (const id of new Set([...prima.keys(), ...dopo.keys()])) {
    const a = prima.get(id) ?? new Set<number>(), b = dopo.get(id) ?? [];
    const fermi = b.filter((k) => a.has(k)).length;
    l.tolti += Math.max(0, a.size - b.length);
    l.nuovi += Math.max(0, b.length - a.size);
    l.spostati += Math.min(a.size, b.length) - fermi;
  }
  const o = req.ambasciataOra;
  if (o && (o.row !== amb.row || o.col !== amb.col)) l.spostati++;
  return l;
}

/** Diplomazia base per id (residenze 0). */
function basi(req: RichiestaDiplomazia): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of req.ora ?? []) m.set(p.id, p.dipl);
  for (const d of req.diplomatici) m.set(d.tipo.id, d.tipo.dipl);
  if (req.canale) m.set(req.canale.id, req.canale.dipl);
  if (req.vialetto) m.set(req.vialetto.id, req.vialetto.dipl);
  return m;
}
const idsCatene = (req: RichiestaDiplomazia) => ({ canale: req.canale?.id ?? "canale", vialetto: req.vialetto?.id ?? "vialetto" });

/**
 * Ricerca completa: toglie gli edifici aggiunti che non servono per stare sopra la soglia (prima
 * quelli che non sono al loro posto di adesso, dai meno diplomatici): meno lavori, stesso scopo.
 */
function pota(req: RichiestaDiplomazia, amb: { row: number; col: number }, e: Esito, base: Map<string, number>): Esito {
  const C = req.colonne, ids = idsCatene(req);
  const ambH = { row: amb.row, col: amb.col, h: req.ambasciata.h };
  const prima = new Map<string, number>(), qui = new Set<string>();
  for (const p of req.ora ?? []) { prima.set(p.id, (prima.get(p.id) ?? 0) + 1); qui.add(p.id + ":" + (p.row * C + p.col)); }
  const residenze = new Set(req.residenze.map((r) => r.tipo.id));
  let pezzi = e.pezzi.slice();
  const conto = new Map<string, number>();
  for (const p of pezzi) conto.set(p.id, (conto.get(p.id) ?? 0) + 1);
  const candidati = pezzi
    .filter((p) => !residenze.has(p.id))
    .sort((a, b) => Number(qui.has(a.id + ":" + (a.row * C + a.col))) - Number(qui.has(b.id + ":" + (b.row * C + b.col))) || (base.get(a.id) ?? 0) - (base.get(b.id) ?? 0));
  let dipl = diplomaziaDisposizione(pezzi, ambH, (id) => base.get(id) ?? 0, ids);
  for (const c of candidati) {
    if ((conto.get(c.id) ?? 0) <= (prima.get(c.id) ?? 0)) continue;   // non è un edificio in più
    const senza = pezzi.filter((p) => p !== c);
    const d = diplomaziaDisposizione(senza, ambH, (id) => base.get(id) ?? 0, ids);
    if (d < req.soglia) continue;
    pezzi = senza; dipl = d; conto.set(c.id, conto.get(c.id)! - 1);
  }
  if (pezzi.length === e.pezzi.length) return e;
  const popDi = new Map<string, number>();
  for (const p of req.ora ?? []) popDi.set(p.id, p.pop);
  for (const r of req.residenze) popDi.set(r.tipo.id, r.tipo.pop);
  for (const d of req.diplomatici) popDi.set(d.tipo.id, d.tipo.pop);
  return { ...e, pezzi, dipl, pop: pezzi.reduce((s, p) => s + (popDi.get(p.id) ?? 0), 0) };
}

// ── ricerca a intervento minimo ──────────────────────────────────────────

interface Pezzo extends PezzoDipl { pop: number; dipl: number; classe: number; nuovo: boolean; vivo: boolean }

/** Tutto resta dov'è; si aggiunge e, se serve, si toglie il minimo. `hMax`/`sMax`: Haveli e Shanti
 *  che si possono togliere. null se non si arriva alla soglia. */
function intervento(req: RichiestaDiplomazia, hMax: number, sMax: number, base: Map<string, number>): { e: Esito; h: number; s: number; lavori: Lavori } | null {
  const amb = req.ambasciataOra;
  if (!amb || !req.ora) return null;
  const R = req.righe, C = req.colonne, A = req.ambasciata, ids = idsCatene(req);
  const ambH = { row: amb.row, col: amb.col, h: A.h };
  const occ = new Int32Array(R * C);   // -1 non utilizzabile / Ambasciata / strada, 0 libera, k+1 pezzo k
  for (let i = 0; i < R * C; i++) occ[i] = req.libere[i] ? 0 : -1;
  for (let i = 0; i < A.h; i++) for (let j = 0; j < A.w; j++) occ[(amb.row + i) * C + amb.col + j] = -1;
  const pesi = new Map(req.residenze.map((r) => [r.tipo.id, r.peso]));
  const fissi = new Set([...req.diplomatici.map((d) => d.tipo.id), ids.canale, ids.vialetto]);
  const pezzi: Pezzo[] = [];
  const strade: Array<{ row: number; col: number }> = [];
  const segna = (p: Pezzo, v: number) => { for (let i = 0; i < p.h; i++) for (let j = 0; j < p.w; j++) { const r = p.row + i, c = p.col + j; if (r >= 0 && c >= 0 && r < R && c < C) occ[r * C + c] = v; } };
  let pop = 0;
  for (const o of req.ora) {
    if (o.id === req.idStrada) { strade.push({ row: o.row, col: o.col }); if (o.row < R && o.col < C) occ[o.row * C + o.col] = -1; continue; }
    // classe: 0 manifattura, 1 residenza libera, 2 Shanti, 3 Haveli, 9 non si toglie (diplomazia)
    const peso = pesi.get(o.id);
    const p: Pezzo = { ...o, classe: fissi.has(o.id) ? 9 : peso === undefined ? 0 : peso === 0 ? 1 : peso + 1, nuovo: false, vivo: true };
    pezzi.push(p); segna(p, pezzi.length); pop += o.pop;
  }
  const vivi = () => pezzi.filter((p) => p.vivo);
  const totale = () => diplomaziaDisposizione(vivi(), ambH, (id) => base.get(id) ?? 0, ids);
  let dipl = totale();
  const tipi: TipoDipl[] = [...req.diplomatici.map((d) => d.tipo), ...(req.canale ? [req.canale] : []), ...(req.vialetto ? [req.vialetto] : [])];
  // caselle d'attacco delle catene: solo lì l'aggiunta può valere più della base
  const attacchi = new Set<string>();
  for (let i = 0; i < BONUS_CANALE.length; i++) {
    attacchi.add(ids.canale + ":" + ((amb.row + ATTACCO_SOPRA.dr - 2 * i) * C + amb.col + ATTACCO_SOPRA.dc));
    attacchi.add(ids.canale + ":" + ((amb.row + A.h + 2 * i) * C + amb.col + ATTACCO_SOPRA.dc));
  }
  for (let i = 0; i < BONUS_VIALETTO.length; i++) attacchi.add(ids.vialetto + ":" + ((amb.row + ATTACCO_DESTRA.dr) * C + amb.col + ATTACCO_DESTRA.dc + 2 * i));
  const vuoto = (r: number, c: number, w: number, h: number) => {
    if (r < 0 || c < 0 || r + h > R || c + w > C) return false;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (occ[(r + i) * C + c + j]) return false;
    return true;
  };
  const aggiungi = (t: TipoDipl, r: number, c: number): Pezzo => {
    const p: Pezzo = { id: t.id, row: r, col: c, w: t.w, h: t.h, pop: t.pop, dipl: t.dipl, classe: 9, nuovo: true, vivo: true };
    pezzi.push(p); segna(p, pezzi.length); pop += t.pop;
    return p;
  };
  const togli = (p: Pezzo) => { p.vivo = false; segna(p, 0); pop -= p.pop; };
  const rimetti = (p: Pezzo) => { p.vivo = true; segna(p, pezzi.indexOf(p) + 1); pop += p.pop; };
  /** Miglior aggiunta (più diplomazia; a parità, il posto che lascia meno buchi), dentro `zona` se data. */
  const migliore = (zona: Pezzo | null): { t: TipoDipl; r: number; c: number; g: number } | null => {
    let best: { t: TipoDipl; r: number; c: number; g: number } | null = null, bestS = -1;
    for (const t of tipi) {
      if (pop + t.pop < 0) continue;
      const r0 = zona ? Math.max(0, zona.row - t.h + 1) : 0, r1 = zona ? Math.min(R - t.h, zona.row + zona.h - 1) : R - t.h;
      const c0 = zona ? Math.max(0, zona.col - t.w + 1) : 0, c1 = zona ? Math.min(C - t.w, zona.col + zona.w - 1) : C - t.w;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (!vuoto(r, c, t.w, t.h)) continue;
        let g = t.dipl;
        if (attacchi.has(t.id + ":" + (r * C + c))) { const p = aggiungi(t, r, c); g = totale() - dipl; togli(p); pezzi.pop(); }
        if (best && g < best.g) continue;
        let sc = 0;
        for (let i = 0; i < t.h; i++) { if (c === 0 || occ[(r + i) * C + c - 1]) sc++; if (c + t.w === C || occ[(r + i) * C + c + t.w]) sc++; }
        for (let j = 0; j < t.w; j++) { if (r === 0 || occ[(r - 1) * C + c + j]) sc++; if (r + t.h === R || occ[(r + t.h) * C + c + j]) sc++; }
        if (!best || g > best.g || sc > bestS) { best = { t, r, c, g }; bestS = sc; }
      }
    }
    return best;
  };
  let h = 0, s = 0;
  for (let giri = 0; dipl < req.soglia && giri < 500; giri++) {
    // A: aggiungere e basta (1 lavoro)
    const a = migliore(null);
    let scelta: { rapporto: number; fai: () => void } | null = null;
    if (a && a.g > 0) {
      // se una sola aggiunta basta, è la mossa giusta
      if (dipl + a.g >= req.soglia) { const p = aggiungi(a.t, a.r, a.c); void p; dipl = totale(); break; }
      scelta = { rapporto: a.g, fai: () => { aggiungi(a.t, a.r, a.c); } };
    }
    // B: togliere gli edifici sotto un posto (anche più d'uno, es. due Bhavan per un Vialetto),
    //    costruirci e riempire il resto dello spazio liberato (tolti + 1 + k lavori)
    const visti = new Set<string>();
    for (const t of tipi) for (let r = 0; r + t.h <= R; r++) for (let c = 0; c + t.w <= C; c++) {
      const sotto = new Set<Pezzo>();
      let ok = true;
      for (let i = 0; i < t.h && ok; i++) for (let j = 0; j < t.w; j++) {
        const v = occ[(r + i) * C + c + j]!;
        if (v < 0) { ok = false; break; }
        if (v > 0) sotto.add(pezzi[v - 1]!);
      }
      if (!ok || sotto.size === 0) continue;
      let dh = 0, ds = 0, dpop = 0;
      for (const p of sotto) {
        if (p.nuovo || p.classe === 9) { ok = false; break; }
        if (p.classe === 2) ds++;
        if (p.classe === 3) dh++;
        dpop += p.pop;
      }
      if (!ok || s + ds > sMax || h + dh > hMax || pop - dpop + t.pop < 0) continue;
      const firma = t.id + ":" + r + ":" + c;
      if (visti.has(firma)) continue;
      visti.add(firma);
      const tolti = [...sotto];
      for (const p of tolti) togli(p);
      const messi: Pezzo[] = [aggiungi(t, r, c)];
      let g = totale() - dipl;
      // riquadro dello spazio liberato
      const zona = { row: Math.min(...tolti.map((p) => p.row)), col: Math.min(...tolti.map((p) => p.col)), w: 0, h: 0 } as Pezzo;
      zona.h = Math.max(...tolti.map((p) => p.row + p.h)) - zona.row;
      zona.w = Math.max(...tolti.map((p) => p.col + p.w)) - zona.col;
      while (dipl + g < req.soglia) {
        const m = migliore(zona);
        if (!m || m.g <= 0) break;
        messi.push(aggiungi(m.t, m.r, m.c)); g = totale() - dipl;
      }
      const rapporto = g / (tolti.length + messi.length) - tolti.reduce((x, p) => x + p.classe, 0) * 0.01;
      const piano = messi.map((x) => ({ t: tipi.find((tt) => tt.id === x.id)!, r: x.row, c: x.col }));
      for (const x of messi.reverse()) { togli(x); pezzi.splice(pezzi.indexOf(x), 1); }
      for (const p of tolti) rimetti(p);
      if (g > 0 && (!scelta || rapporto > scelta.rapporto)) {
        scelta = { rapporto, fai: () => { for (const p of tolti) { togli(p); if (p.classe === 2) s++; if (p.classe === 3) h++; } for (const x of piano) aggiungi(x.t, x.r, x.c); } };
      }
    }
    if (!scelta) return null;
    scelta.fai();
    dipl = totale();
  }
  if (dipl < req.soglia) return null;
  // pulizia: via le aggiunte che non servono (dalle meno utili), poi si rimette ciò che ci sta ancora
  for (const p of pezzi.filter((x) => x.nuovo && x.vivo).sort((x, y) => x.dipl - y.dipl)) {
    if (pop - p.pop < 0) continue;
    togli(p);
    const d = totale();
    if (d >= req.soglia) dipl = d; else rimetti(p);
  }
  for (const p of pezzi.filter((x) => !x.nuovo && !x.vivo).sort((x, y) => y.classe - x.classe)) {
    if (!vuoto(p.row, p.col, p.w, p.h) || pop + p.pop < 0) continue;
    rimetti(p);
    if (p.classe === 2) s--; if (p.classe === 3) h--;
  }
  dipl = totale();
  const restano = vivi();
  const e: Esito = { dipl, pop, pezzi: restano.map(({ id, row, col, w, h: hh }) => ({ id, row, col, w, h: hh })), strade: strade.map((x) => x.row * C + x.col), fermi: 0 };
  const lavori = { tolti: pezzi.filter((p) => !p.nuovo && !p.vivo).length, nuovi: pezzi.filter((p) => p.nuovo && p.vivo).length, spostati: 0 };
  return { e, h, s, lavori };
}

// ── ricerca ──────────────────────────────────────────────────────────────

/** Chiave di un tentativo: Haveli e Shanti tolti e lavori. */
const chiave = (h: number, s: number, l: number) => h + ":" + s + ":" + l;

/** Ricerca completa (worker o banco): i compromessi migliori fra grandi tolti e lavori. */
export function ottimizzaDiplomazia(req: RichiestaDiplomazia, progresso?: (t: TentativoDipl[]) => void): TentativoDipl[] {
  const rng = mulberry32(req.seme ?? 1);
  const scadenza = Date.now() + req.tempoMs;
  const base = basi(req);
  let pos = req.posizioni ?? posizioniAmbasciataDipl(req);
  // la posizione di adesso per prima (meno spostamenti)
  let haOra = false;
  if (req.ambasciataOra) {
    const o = req.ambasciataOra;
    const i = pos.findIndex(p => p.row === o.row && p.col === o.col);
    if (i >= 0) { haOra = true; pos = [pos[i]!, ...pos.slice(0, i), ...pos.slice(i + 1)]; }
  }
  const res = req.residenze;
  const iH = res.findIndex(r => r.peso === 2), iS = res.findIndex(r => r.peso === 1);
  const nH = iH >= 0 ? res[iH]!.posizioni.length : 0, nS = iS >= 0 ? res[iS]!.posizioni.length : 0;
  // residenze libere (Bhavan): poche varianti del numero tenuto
  const libereIdx = res.map((r, i) => (r.peso === 0 ? i : -1)).filter(i => i >= 0);
  const variantiLibere = (n: number) => [...new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n])];

  const migliori = new Map<string, TentativoDipl>();
  const salva = (h: number, s: number, amb: { row: number; col: number }, e: Esito, lavori: Lavori) => {
    if (e.dipl < req.soglia) return;
    const k = chiave(h, s, totaleLavori(lavori));
    const p = migliori.get(k);
    if (p && p.diplomazia >= e.dipl) return;
    const conti: Record<string, number> = {};
    for (const x of e.pezzi) conti[x.id] = (conti[x.id] ?? 0) + 1;
    migliori.set(k, {
      haveliTolti: h, shantiTolti: s, diplomazia: e.dipl, popolazione: e.pop, ambasciata: amb,
      edifici: e.pezzi, strade: e.strade.map(x => ({ row: Math.floor(x / req.colonne), col: x % req.colonne })),
      conti, lavori,
    });
  };
  const registra = (h: number, s: number, amb: { row: number; col: number }, e0: Esito) => {
    if (e0.dipl < req.soglia) return;
    const e = pota(req, amb, e0, base);
    const strade = e.strade.map(x => ({ row: Math.floor(x / req.colonne), col: x % req.colonne }));
    salva(h, s, amb, e, contaLavori(req, amb, e.pezzi, strade));
  };
  const prova = (h: number, s: number, bh: number[], amb: { row: number; col: number }, casuale: boolean, fermi: boolean) => {
    const tenute = res.map((r, i) => (i === iH ? nH - h : i === iS ? nS - s : r.peso === 0 ? 0 : r.posizioni.length));
    libereIdx.forEach((i, j) => { tenute[i] = bh[j]!; });
    const e = disponi(req, amb, tenute, casuale ? rng : null, fermi);
    if (e) registra(h, s, amb, e);
    return e;
  };
  // combinazioni dalla più leggera (meno Haveli, poi meno Shanti)
  const combinazioni: Array<[number, number]> = [];
  for (let h = 0; h <= nH; h++) for (let s = 0; s <= nS; s++) combinazioni.push([h, s]);
  const varianti = libereIdx.length ? cartesiano(libereIdx.map(i => variantiLibere(res[i]!.posizioni.length))) : [[]];

  // 0. intervento minimo (solo il worker che ha la posizione di adesso dell'Ambasciata)
  if (haOra && req.ora) {
    for (const [hMax, sMax] of combinazioni) {
      const r = intervento(req, hMax, sMax, base);
      if (r) salva(r.h, r.s, req.ambasciataOra!, r.e, r.lavori);
    }
    progresso?.(risultato(migliori));
  }
  // 1. passata deterministica, a giri sulle posizioni (la posizione di adesso per prima): a ogni
  //    giro tutte le combinazioni, così anche quelle con più demolizioni vengono provate presto.
  //    Nei posti di adesso solo con l'Ambasciata dove è ora (altrimenti di rado restano liberi).
  outer: for (const amb of pos) {
    const ora = !!req.ambasciataOra && req.ambasciataOra.row === amb.row && req.ambasciataOra.col === amb.col;
    for (const [h, s] of combinazioni) {
      if (Date.now() > scadenza) break outer;
      for (const bh of varianti) { prova(h, s, bh, amb, false, false); if (ora) prova(h, s, bh, amb, false, true); }
    }
    progresso?.(risultato(migliori));
  }
  // 2. con il tempo che resta: ripartenze casuali sulle combinazioni più promettenti
  while (Date.now() < scadenza && combinazioni.length) {
    const [h, s] = combinazioni[Math.floor(rng() * combinazioni.length)]!;
    const amb = rng() < 0.3 && req.ambasciataOra && haOra ? req.ambasciataOra : pos[Math.floor(rng() * pos.length)]!;
    const bh = varianti[Math.floor(rng() * varianti.length)]!;
    prova(h, s, bh, amb, true, rng() < 0.5);
    if (rng() < 0.02) progresso?.(risultato(migliori));
  }
  return risultato(migliori);
}

function cartesiano(liste: number[][]): number[][] {
  let out: number[][] = [[]];
  for (const l of liste) out = out.flatMap(a => l.map(x => [...a, x]));
  return out;
}

/** Righe della tabella (28/11/2026, utente): sempre i 10 migliori, dai meno lavori. Prima i
 *  tentativi non dominati (nessun altro arriva alla soglia togliendo meno o uguali Haveli e Shanti
 *  con meno o uguali lavori); se sono meno di 10 si completano con gli altri, dai più leggeri. */
const RIGHE_DIPL = 10;
function risultato(m: Map<string, TentativoDipl>): TentativoDipl[] {
  const tutti = [...m.values()].sort((a, b) => a.haveliTolti - b.haveliTolti || a.shantiTolti - b.shantiTolti
    || totaleLavori(a.lavori) - totaleLavori(b.lavori) || b.diplomazia - a.diplomazia);
  const scelti: TentativoDipl[] = [];
  for (const t of tutti) {
    if (!scelti.some(o => o.haveliTolti <= t.haveliTolti && o.shantiTolti <= t.shantiTolti && totaleLavori(o.lavori) <= totaleLavori(t.lavori))) scelti.push(t);
  }
  const perLavori = (a: TentativoDipl, b: TentativoDipl) => totaleLavori(a.lavori) - totaleLavori(b.lavori)
    || a.haveliTolti - b.haveliTolti || a.shantiTolti - b.shantiTolti || b.diplomazia - a.diplomazia;
  scelti.sort(perLavori);
  if (scelti.length < RIGHE_DIPL) {
    const presi = new Set(scelti);
    scelti.push(...tutti.filter((t) => !presi.has(t)).sort((a, b) => 2 * (a.haveliTolti - b.haveliTolti) + (a.shantiTolti - b.shantiTolti) || perLavori(a, b)).slice(0, RIGHE_DIPL - scelti.length));
    scelti.sort(perLavori);
  }
  return scelti.slice(0, RIGHE_DIPL);
}

/** Unisce i risultati di più worker. */
export function unisciDiplomazia(liste: TentativoDipl[][]): TentativoDipl[] {
  const m = new Map<string, TentativoDipl>();
  for (const l of liste) for (const t of l) {
    const k = chiave(t.haveliTolti, t.shantiTolti, totaleLavori(t.lavori));
    const p = m.get(k);
    if (!p || t.diplomazia > p.diplomazia) m.set(k, t);
  }
  return risultato(m);
}
