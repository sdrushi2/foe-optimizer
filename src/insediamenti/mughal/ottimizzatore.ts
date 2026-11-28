/**
 * Ottimizzatore della disposizione dei Mughal (25/11/2026, prima fase: disposizione iniziale).
 *
 * Regole (dall'utente, come la città principale):
 * - le strade (Sentiero 1×1, 200 rupie l'una) partono dai bordi dell'Ambasciata e ogni pezzo
 *   deve restare collegato all'Ambasciata attraverso altre strade;
 * - un edificio è collegato se almeno una sua casella tocca (di lato) una strada collegata;
 * - manifatture dei beni e diplomatici con popolazione: SEMPRE collegati;
 * - residenze: collegate producono rupie, staccate danno solo popolazione;
 * - produttori (27/11/2026: Chhatri, Baldacchino, Chahar bagh): producono rupie se collegati
 *   ma CONSUMANO popolazione; quanti metterne lo decide l'ottimizzatore (vedi `valuta`);
 * - Canale d'acqua e Vialetto: niente strada (non ancora usati qui);
 * - popolazione mai negativa; nessuna rotazione; l'Ambasciata si può spostare.
 * Obiettivo: più rupie dalle residenze collegate, meno strade. Le due cose si contraddicono,
 * quindi il risultato è un elenco di tentativi, il migliore per ogni numero di strade
 * (solo quelli che producono più di tutti i tentativi con meno strade).
 *
 * Ricerca (niente schemi di partenza, a differenza del Planner della città):
 * 1. tutte le posizioni dell'Ambasciata (metà se l'area è simmetrica: la disposizione
 *    riflessa vale uguale, e senza rotazioni un w×h riflesso resta w×h);
 * 2. per ogni posizione le strade crescono una casella alla volta (la migliore fra quelle
 *    di bordo) e per ogni numero di strade una ricerca locale sposta pezzi di strada
 *    (ricottura simulata) tenendo la rete collegata;
 * 3. ogni rete si valuta mettendo prima le manifatture (che devono toccare la strada) e poi
 *    le residenze collegate (scelta golosa pesata sulle sovrapposizioni), infine le
 *    residenze staccate che servono alla popolazione.
 * Modulo puro (nessun React): gira nel worker e nel banco di prova (node).
 */

export interface TipoOttimizzatore {
  id: string;
  /** Larghezza (colonne) e altezza (righe) in caselle: fisse, niente rotazioni. */
  w: number;
  h: number;
  /** Popolazione data (>0) o richiesta (<0). */
  pop: number;
  /** Rupie all'ora se collegato (residenze); 0 per gli altri. */
  rupieOra: number;
}

export interface RichiestaOttimizzatore {
  righe: number;
  colonne: number;
  /** righe×colonne, 1 = casella utilizzabile (blocco sbloccato, niente ostacolo). */
  libere: Uint8Array | number[];
  ambasciata: { w: number; h: number };
  /** Edifici nel numero scelto dall'utente: manifatture e diplomatici con popolazione (sempre
   *  collegati); `senzaStrada` per Canale d'acqua e Vialetto (dove resta posto). */
  fisse: Array<{ tipo: TipoOttimizzatore; quante: number; senzaStrada?: boolean }>;
  /** Residenze sbloccate da usare. */
  residenze: TipoOttimizzatore[];
  /** (27/11/2026) Produttori sbloccati (rupie se collegati, popolazione negativa): il loro
   *  numero lo sceglie l'ottimizzatore, insieme alle residenze. */
  produttori?: TipoOttimizzatore[];
  /** Tempo massimo (ms); il banco di prova lo usa, il worker anche. */
  tempoMs: number;
  seme?: number;
  /** Solo queste posizioni dell'Ambasciata (per dividere il lavoro fra i worker). */
  posizioni?: Array<{ row: number; col: number }>;
  /** Strade massime da provare. (28/11/2026) Il planner ci mette le strade già costruite più
   *  quelle che le rupie permettono di comprare: i tentativi oltre non si registrano. */
  maxStrade?: number;
  /** Strade già costruite: non si eliminano mai, quindi in un tentativo che ne usa meno quelle
   *  in più vanno parcheggiate in caselle vuote (se non ci stanno, il tentativo non vale). */
  stradeEsistenti?: number;
  /** "Continua" (26/11/2026): reti dei tentativi già trovati, da cui la ricerca riparte. */
  partenze?: Array<{ ambasciata: { row: number; col: number }; strade: Array<{ row: number; col: number }> }>;
}

interface EdificioPiazzato {
  id: string;
  row: number;
  col: number;
  w: number;
  h: number;
  collegato: boolean;
}

export interface Tentativo {
  strade: number;
  /** Rupie all'ora delle residenze collegate. */
  rupieOra: number;
  ambasciata: { row: number; col: number };
  celleStrada: Array<{ row: number; col: number }>;
  edifici: EdificioPiazzato[];
  /** Popolazione data − richiesta. */
  popolazione: number;
  /** Residenze e produttori collegati per tipo. */
  collegate: Record<string, number>;
  /** Strade già costruite in più, parcheggiate in caselle vuote (non collegano niente). */
  parcheggiate: Array<{ row: number; col: number }>;
}

// ── utilità ────────────────────────────────────────────────────────────────

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

/** Posizioni valide dell'Ambasciata, ridotte a metà (o a un quarto) se l'area è simmetrica. */
export function posizioniAmbasciata(req: Pick<RichiestaOttimizzatore, "righe" | "colonne" | "libere" | "ambasciata">): Array<{ row: number; col: number }> {
  const { righe: R, colonne: C, libere: L, ambasciata: A } = req;
  const ok = (r: number, c: number) => {
    for (let i = 0; i < A.h; i++) for (let j = 0; j < A.w; j++) if (!L[(r + i) * C + c + j]) return false;
    return true;
  };
  // simmetrie dell'area utilizzabile
  let simV = true, simO = true; // V: sopra/sotto, O: destra/sinistra
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (L[r * C + c] !== L[(R - 1 - r) * C + c]) simV = false;
    if (L[r * C + c] !== L[r * C + (C - 1 - c)]) simO = false;
  }
  const visti = new Set<string>();
  const out: Array<{ row: number; col: number }> = [];
  for (let r = 0; r + A.h <= R; r++) for (let c = 0; c + A.w <= C; c++) {
    if (!ok(r, c)) continue;
    const gemelle = [[r, c]];
    if (simV) gemelle.push([R - A.h - r, c]);
    if (simO) gemelle.push([r, C - A.w - c]);
    if (simV && simO) gemelle.push([R - A.h - r, C - A.w - c]);
    if (gemelle.some(([a, b]) => visti.has(a + ":" + b))) continue;
    visti.add(r + ":" + c);
    out.push({ row: r, col: c });
  }
  return out;
}

// ── valutazione di una rete di strade ──────────────────────────────────────

interface Candidato { tipo: number; r: number; c: number; celle: number[]; }

interface Valutazione {
  valido: boolean;
  rupieOra: number;
  /** Per orientare la ricerca quando non è ancora valida (manifatture non collegabili). */
  bordo: number;
  edifici?: EdificioPiazzato[];
  popolazione?: number;
  /** Produttori messi (collegati) nel riempimento goloso. */
  produttori?: number;
}

class Valutatore {
  readonly R: number; readonly C: number; readonly N: number;
  private base: Uint8Array;          // 1 = occupata (non utilizzabile o Ambasciata)
  private occ: Uint8Array;
  private adj: Uint8Array;
  private segno: Int32Array; private giro = 1;
  private req: RichiestaOttimizzatore; private amb: { row: number; col: number };
  /** Residenze poi produttori: i candidati collegati del riempimento goloso. */
  private tipi: TipoOttimizzatore[]; private nRes: number;
  constructor(req: RichiestaOttimizzatore, amb: { row: number; col: number }) {
    this.req = req; this.amb = amb;
    this.tipi = [...req.residenze, ...(req.produttori ?? [])]; this.nRes = req.residenze.length;
    this.R = req.righe; this.C = req.colonne; this.N = this.R * this.C;
    this.base = new Uint8Array(this.N);
    for (let i = 0; i < this.N; i++) this.base[i] = req.libere[i] ? 0 : 1;
    for (let i = 0; i < req.ambasciata.h; i++) for (let j = 0; j < req.ambasciata.w; j++) this.base[(amb.row + i) * this.C + amb.col + j] = 1;
    this.occ = new Uint8Array(this.N);
    this.adj = new Uint8Array(this.N);
    this.segno = new Int32Array(this.N * (this.tipi.length + 1));
  }
  libera(i: number) { return this.base[i] === 0; }
  /** Caselle rimaste vuote dopo l'ultima valutazione. */
  vuote(): number[] { const out: number[] = []; for (let i = 0; i < this.N; i++) if (!this.occ[i]) out.push(i); return out; }
  /** Casella dell'Ambasciata? */
  ambasciata(i: number) {
    const r = Math.floor(i / this.C), c = i % this.C;
    return r >= this.amb.row && r < this.amb.row + this.req.ambasciata.h && c >= this.amb.col && c < this.amb.col + this.req.ambasciata.w;
  }

  private libero(r: number, c: number, w: number, h: number) {
    if (r < 0 || c < 0 || r + h > this.R || c + w > this.C) return false;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (this.occ[(r + i) * this.C + c + j]) return false;
    return true;
  }
  private tocca(r: number, c: number, w: number, h: number) {
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (this.adj[(r + i) * this.C + c + j]) return true;
    return false;
  }
  private occupa(r: number, c: number, w: number, h: number) {
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) this.occ[(r + i) * this.C + c + j] = 1;
  }

  /** Valuta una rete. Con i produttori la popolazione può non bastare: allora si cerca (per
   *  bisezione) il numero massimo di produttori con cui il risultato è valido; i posti lasciati
   *  liberi vanno alle residenze, collegate o staccate. */
  valuta(strade: Int32Array | number[], completa: boolean): Valutazione {
    const tutto = this.prova(strade, completa, Infinity);
    const messi = tutto.produttori ?? 0;
    if (tutto.valido || messi === 0) return tutto;
    let lo = 0, hi = messi - 1, migliore = -1, ultima = -1, ris: Valutazione | null = null;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      const v = this.prova(strade, false, m);
      ultima = m;
      if (v.valido) { migliore = m; ris = v; lo = m + 1; } else hi = m - 1;
    }
    if (migliore < 0) return this.prova(strade, completa, 0);
    // completa, o stato interno (caselle vuote) da allineare all'ultima prova
    return completa || ultima !== migliore ? this.prova(strade, completa, migliore) : ris!;
  }

  private prova(strade: Int32Array | number[], completa: boolean, limite: number): Valutazione {
    const { R, C, N } = this;
    this.occ.set(this.base);
    for (const s of strade) this.occ[s] = 1;
    this.adj.fill(0);
    let bordo = 0;
    for (const s of strade) {
      const r = Math.floor(s / C), c = s % C;
      if (r > 0 && !this.occ[s - C] && !this.adj[s - C]) { this.adj[s - C] = 1; bordo++; }
      if (r < R - 1 && !this.occ[s + C] && !this.adj[s + C]) { this.adj[s + C] = 1; bordo++; }
      if (c > 0 && !this.occ[s - 1] && !this.adj[s - 1]) { this.adj[s - 1] = 1; bordo++; }
      if (c < C - 1 && !this.occ[s + 1] && !this.adj[s + 1]) { this.adj[s + 1] = 1; bordo++; }
    }
    const edifici: EdificioPiazzato[] = [];
    let pop = 0;
    // 1. manifatture: la posizione che copre meno caselle di bordo strada (lascia il bordo
    //    alle residenze) e, a parità, tocca più bordi della mappa/Ambasciata/strade
    for (const { tipo, quante, senzaStrada } of this.req.fisse) {
      if (senzaStrada) continue;
      for (let k = 0; k < quante; k++) {
        let best = -1, bestScore = Infinity;
        for (let r = 0; r + tipo.h <= R; r++) for (let c = 0; c + tipo.w <= C; c++) {
          if (!this.libero(r, c, tipo.w, tipo.h) || !this.tocca(r, c, tipo.w, tipo.h)) continue;
          let coperte = 0;
          for (let i = 0; i < tipo.h; i++) for (let j = 0; j < tipo.w; j++) coperte += this.adj[(r + i) * C + c + j];
          let contatto = 0;
          for (let i = 0; i < tipo.h; i++) {
            if (c === 0 || this.occ[(r + i) * C + c - 1]) contatto++;
            if (c + tipo.w === C || this.occ[(r + i) * C + c + tipo.w]) contatto++;
          }
          for (let j = 0; j < tipo.w; j++) {
            if (r === 0 || this.occ[(r - 1) * C + c + j]) contatto++;
            if (r + tipo.h === R || this.occ[(r + tipo.h) * C + c + j]) contatto++;
          }
          const score = coperte * 10 - contatto;
          if (score < bestScore) { bestScore = score; best = r * C + c; }
        }
        if (best < 0) return { valido: false, rupieOra: 0, bordo };
        const r = Math.floor(best / C), c = best % C;
        this.occupa(r, c, tipo.w, tipo.h);
        pop += tipo.pop;
        if (completa) edifici.push({ id: tipo.id, row: r, col: c, w: tipo.w, h: tipo.h, collegato: true });
      }
    }
    // 2. residenze e produttori collegati: insieme indipendente pesato, scelta golosa
    //    valore/(1+sovrapposizioni); al massimo `limite` produttori
    const res = this.tipi;
    let nProd = 0;
    const cand: Candidato[] = [];
    for (let t = 0; t < res.length; t++) {
      const tp = res[t]!;
      for (let r = 0; r + tp.h <= R; r++) for (let c = 0; c + tp.w <= C; c++) {
        if (!this.libero(r, c, tp.w, tp.h) || !this.tocca(r, c, tp.w, tp.h)) continue;
        const celle: number[] = [];
        for (let i = 0; i < tp.h; i++) for (let j = 0; j < tp.w; j++) celle.push((r + i) * C + c + j);
        cand.push({ tipo: t, r, c, celle });
      }
    }
    // candidati per casella → grado (candidati diversi che si sovrappongono)
    const perCella: number[][] = [];
    for (let i = 0; i < N; i++) perCella.push([]);
    cand.forEach((k, idx) => { for (const x of k.celle) perCella[x]!.push(idx); });
    const grado = new Int32Array(cand.length);
    for (let a = 0; a < cand.length; a++) {
      const g = ++this.giro;
      let n = 0;
      for (const x of cand[a]!.celle) for (const b of perCella[x]!) if (b !== a && this.segno[b] !== g) { this.segno[b] = g; n++; }
      grado[a] = n;
    }
    // segno[] riusato per i candidati: serve una mappa per candidato, non per casella
    const vivo = new Uint8Array(cand.length).fill(1);
    let rupie = 0;
    for (;;) {
      let best = -1, bestS = -Infinity;
      for (let a = 0; a < cand.length; a++) {
        if (!vivo[a]) continue;
        if (nProd >= limite && cand[a]!.tipo >= this.nRes) continue;
        const tp = res[cand[a]!.tipo]!;
        const s = tp.rupieOra / (1 + grado[a]! * 0.5) - a * 1e-9;
        if (s > bestS) { bestS = s; best = a; }
      }
      if (best < 0) break;
      const k = cand[best]!, tp = res[k.tipo]!;
      this.occupa(k.r, k.c, tp.w, tp.h);
      rupie += tp.rupieOra; pop += tp.pop;
      if (k.tipo >= this.nRes) nProd++;
      if (completa) edifici.push({ id: tp.id, row: k.r, col: k.c, w: tp.w, h: tp.h, collegato: true });
      // togli i candidati sovrapposti e aggiorna i gradi dei loro vicini
      const g = ++this.giro;
      const morti: number[] = [];
      for (const x of k.celle) for (const b of perCella[x]!) if (vivo[b] && this.segno[b] !== g) { this.segno[b] = g; vivo[b] = 0; morti.push(b); }
      for (const m of morti) {
        const g2 = ++this.giro;
        for (const x of cand[m]!.celle) for (const b of perCella[x]!) if (vivo[b] && this.segno[b] !== g2) { this.segno[b] = g2; grado[b]!--; }
      }
    }
    // 3. edifici senza strada (Canale, Vialetto): nel primo posto libero lontano dalla strada
    for (const { tipo, quante, senzaStrada } of this.req.fisse) {
      if (!senzaStrada) continue;
      for (let k = 0; k < quante; k++) {
        let posto = -1, postoAdj = Infinity;
        for (let r = 0; r + tipo.h <= R && postoAdj > 0; r++) for (let c = 0; c + tipo.w <= C; c++) {
          if (!this.libero(r, c, tipo.w, tipo.h)) continue;
          let a = 0;
          for (let i = 0; i < tipo.h; i++) for (let j = 0; j < tipo.w; j++) a += this.adj[(r + i) * C + c + j];
          if (a < postoAdj) { postoAdj = a; posto = r * C + c; if (a === 0) break; }
        }
        if (posto < 0) return { valido: false, rupieOra: 0, bordo, produttori: nProd };
        const r = Math.floor(posto / C), c = posto % C;
        this.occupa(r, c, tipo.w, tipo.h);
        pop += tipo.pop;
        if (completa) edifici.push({ id: tipo.id, row: r, col: c, w: tipo.w, h: tipo.h, collegato: false });
      }
    }
    // 4. popolazione: residenze staccate dove c'è posto (quella con più pop per casella)
    // solo quante ne servono: se la popolazione basta, il buco resta vuoto (richiesta utente)
    if (pop < 0) {
      const ordinate = [...this.req.residenze].sort((a, b) => b.pop / (b.w * b.h) - a.pop / (a.w * a.h));
      for (const tp of ordinate) {
        for (let r = 0; r + tp.h <= R; r++) for (let c = 0; c + tp.w <= C; c++) {
          if (pop >= 0) break;
          if (!this.libero(r, c, tp.w, tp.h)) continue;
          this.occupa(r, c, tp.w, tp.h);
          pop += tp.pop;
          if (completa) edifici.push({ id: tp.id, row: r, col: c, w: tp.w, h: tp.h, collegato: false });
        }
      }
    }
    if (pop < 0) return { valido: false, rupieOra: rupie, bordo, produttori: nProd };
    return { valido: true, rupieOra: rupie, bordo, edifici: completa ? edifici : undefined, popolazione: pop, produttori: nProd };
  }
}

// ── ricerca per una posizione dell'Ambasciata ──────────────────────────────

class Rete {
  readonly C: number; readonly R: number;
  strade: number[] = [];
  isStrada: Uint8Array;
  private v: Valutatore;
  constructor(v: Valutatore) { this.v = v; this.R = v.R; this.C = v.C; this.isStrada = new Uint8Array(v.N); }
  clona(): number[] { return this.strade.slice(); }
  imposta(s: number[]) { this.isStrada.fill(0); this.strade = s.slice(); for (const x of s) this.isStrada[x] = 1; }
  private vicini(i: number): number[] {
    const r = Math.floor(i / this.C), c = i % this.C, out: number[] = [];
    if (r > 0) out.push(i - this.C);
    if (r < this.R - 1) out.push(i + this.C);
    if (c > 0) out.push(i - 1);
    if (c < this.C - 1) out.push(i + 1);
    return out;
  }
  /** Caselle libere dove si può aggiungere una strada (attaccate a una strada o all'Ambasciata). */
  frontiera(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.v.N; i++) {
      if (!this.v.libera(i) || this.isStrada[i]) continue;
      if (this.vicini(i).some((n) => this.isStrada[n] || this.v.ambasciata(n))) out.push(i);
    }
    return out;
  }
  /** Tutte le strade restano collegate all'Ambasciata senza `tolta`? */
  collegataSenza(tolta: number): boolean {
    const visto = new Uint8Array(this.v.N);
    const coda: number[] = [];
    for (const s of this.strade) {
      if (s === tolta) continue;
      if (this.vicini(s).some((n) => this.v.ambasciata(n))) { visto[s] = 1; coda.push(s); }
    }
    let n = coda.length;
    while (coda.length) {
      const x = coda.pop()!;
      for (const y of this.vicini(x)) if (y !== tolta && this.isStrada[y] && !visto[y]) { visto[y] = 1; n++; coda.push(y); }
    }
    return n === this.strade.length - 1;
  }
  aggiungi(i: number) { this.strade.push(i); this.isStrada[i] = 1; }
  togli(i: number) { this.strade.splice(this.strade.indexOf(i), 1); this.isStrada[i] = 0; }
}

const punteggio = (v: Valutazione) => (v.valido ? v.rupieOra : -1e6 + v.bordo);

/** Migliore rete trovata per ogni numero di strade (solo le caselle: il resto si ricalcola). */
type Archivio = Map<number, { rupieOra: number; amb: { row: number; col: number }; strade: number[] }>;

function registra(archivi: Archivio[], amb: { row: number; col: number }, strade: number[], s: number) {
  if (s <= -1e5) return;
  const k = strade.length;
  for (const archivio of archivi) {
    const prec = archivio.get(k);
    if (!prec || s > prec.rupieOra + 1e-9) archivio.set(k, { rupieOra: s, amb, strade: strade.slice() });
  }
}

/** Prima esplorazione di una posizione: le strade crescono una casella alla volta (la
 *  migliore di frontiera) e per ogni numero di strade una breve ricottura sposta pezzi. */
function cresci(req: RichiestaOttimizzatore, amb: { row: number; col: number }, iterPerK: number, rng: () => number, scadenza: number, archivio: Archivio[]): number {
  const v = new Valutatore(req, amb);
  const rete = new Rete(v);
  const maxK = req.maxStrade ?? 60;
  let senzaMiglioramento = 0, migliorePrec = -Infinity, qualita = 0;
  for (let k = 1; k <= maxK; k++) {
    if (Date.now() > scadenza) break;
    const fr = rete.frontiera();
    if (!fr.length) break;
    let bestI = -1, bestS = -Infinity;
    for (const i of fr) {
      rete.aggiungi(i);
      const s = punteggio(v.valuta(rete.strade, false));
      rete.togli(i);
      if (s > bestS || (s === bestS && rng() < 0.3)) { bestS = s; bestI = i; }
    }
    rete.aggiungi(bestI);
    let cur = bestS, best = bestS, bestRete = rete.clona();
    for (let it = 0; it < iterPerK; it++) {
      const T = 6 * (1 - it / iterPerK) + 0.05;
      const via = rete.strade[Math.floor(rng() * rete.strade.length)]!;
      if (!rete.collegataSenza(via)) continue;
      rete.togli(via);
      const f = rete.frontiera().filter((x) => x !== via);
      if (!f.length) { rete.aggiungi(via); continue; }
      const su = f[Math.floor(rng() * f.length)]!;
      rete.aggiungi(su);
      const s = punteggio(v.valuta(rete.strade, false));
      if (s >= cur || rng() < Math.exp((s - cur) / T)) {
        cur = s;
        if (s > best) { best = s; bestRete = rete.clona(); }
      } else { rete.togli(su); rete.aggiungi(via); }
    }
    rete.imposta(bestRete);
    registra(archivio, amb, rete.strade, best);
    if (best > -1e5) {
      // qualità della posizione: rupie meno un costo indicativo delle strade
      qualita = Math.max(qualita, best - 4 * k);
      if (best > migliorePrec + 1e-9) { migliorePrec = best; senzaMiglioramento = 0; }
      else if (++senzaMiglioramento >= 4) break;
    }
  }
  return qualita;
}

/** Ricottura con numero di strade libero: obiettivo rupie − λ·strade; ogni stato valido
 *  visitato aggiorna l'archivio del suo numero di strade. */
function ricuoci(req: RichiestaOttimizzatore, amb: { row: number; col: number }, partenza: number[], lambda: number, iter: number, rng: () => number, scadenza: number, archivio: Archivio[]) {
  const v = new Valutatore(req, amb);
  const rete = new Rete(v);
  rete.imposta(partenza);
  const f = (s: number, k: number) => s - lambda * k;
  let curS = punteggio(v.valuta(rete.strade, false)), cur = f(curS, rete.strade.length);
  for (let it = 0; it < iter; it++) {
    if ((it & 255) === 0 && Date.now() > scadenza) return;
    const T = 12 * (1 - it / iter) + 0.1;
    const m = rng();
    if (m < 0.25 || rete.strade.length < 2) {
      // aggiungi (non oltre le strade che si possono pagare)
      if (req.maxStrade !== undefined && rete.strade.length >= req.maxStrade) continue;
      const fr = rete.frontiera();
      if (!fr.length) continue;
      const su = fr[Math.floor(rng() * fr.length)]!;
      rete.aggiungi(su);
      const s = punteggio(v.valuta(rete.strade, false)), n = f(s, rete.strade.length);
      if (n >= cur || rng() < Math.exp((n - cur) / T)) { cur = n; curS = s; registra(archivio, amb, rete.strade, s); }
      else rete.togli(su);
    } else if (m < 0.5) {
      // togli
      const via = rete.strade[Math.floor(rng() * rete.strade.length)]!;
      if (!rete.collegataSenza(via)) continue;
      rete.togli(via);
      const s = punteggio(v.valuta(rete.strade, false)), n = f(s, rete.strade.length);
      if (n >= cur || rng() < Math.exp((n - cur) / T)) { cur = n; curS = s; registra(archivio, amb, rete.strade, s); }
      else rete.aggiungi(via);
    } else {
      // sposta
      const via = rete.strade[Math.floor(rng() * rete.strade.length)]!;
      if (!rete.collegataSenza(via)) continue;
      rete.togli(via);
      const fr = rete.frontiera().filter((x) => x !== via);
      if (!fr.length) { rete.aggiungi(via); continue; }
      const su = fr[Math.floor(rng() * fr.length)]!;
      rete.aggiungi(su);
      const s = punteggio(v.valuta(rete.strade, false)), n = f(s, rete.strade.length);
      if (n >= cur || rng() < Math.exp((n - cur) / T)) { cur = n; curS = s; registra(archivio, amb, rete.strade, s); }
      else { rete.togli(su); rete.aggiungi(via); }
    }
  }
  void curS;
}

/** Dall'archivio ai tentativi completi (edifici ricalcolati), solo quelli utili. */
function tentativi(req: RichiestaOttimizzatore, archivio: Archivio): Tentativo[] {
  const ord = [...archivio.entries()].sort((a, b) => a[0] - b[0]);
  const out: Tentativo[] = [];
  for (const [k, a] of ord) {
    if (req.maxStrade !== undefined && k > req.maxStrade) continue;   // troppe strade per le rupie
    if (out.length && a.rupieOra <= out[out.length - 1]!.rupieOra + 1e-9) continue;
    const vt = new Valutatore(req, a.amb);
    const val = vt.valuta(a.strade, true);
    if (!val.valido) continue;
    // strade già costruite in più: in caselle vuote, prima quelle lontane dalle strade utili
    const daParcheggiare = Math.max(0, (req.stradeEsistenti ?? 0) - k);
    const vuote = vt.vuote();
    if (vuote.length < daParcheggiare) continue;
    const parcheggiate = vuote.slice(0, daParcheggiare).map((s) => ({ row: Math.floor(s / req.colonne), col: s % req.colonne }));
    const collegate: Record<string, number> = {};
    const conRupie = [...req.residenze, ...(req.produttori ?? [])];
    for (const e of val.edifici!) if (e.collegato && conRupie.some((r) => r.id === e.id)) collegate[e.id] = (collegate[e.id] ?? 0) + 1;
    out.push({
      strade: k, rupieOra: val.rupieOra, ambasciata: a.amb,
      celleStrada: a.strade.map((s) => ({ row: Math.floor(s / req.colonne), col: s % req.colonne })),
      edifici: val.edifici!, popolazione: val.popolazione!, collegate, parcheggiate,
    });
  }
  return out;
}

/** Ricerca completa (banco di prova o un worker con le sue posizioni). */
export function ottimizza(req: RichiestaOttimizzatore, progresso?: (t: Tentativo[], fatte: number, totali: number) => void): Tentativo[] {
  const rng = mulberry32(req.seme ?? 1);
  const pos = req.posizioni ?? posizioniAmbasciata(req);
  const archivio: Archivio = new Map();
  const scadenza = Date.now() + req.tempoMs;
  // 1. tutte le posizioni, veloce: quali promettono
  const perPos = new Map<{ row: number; col: number }, Archivio>();
  const qualita = pos.map((p) => {
    perPos.set(p, new Map());
    const q = cresci(req, p, 120, rng, scadenza, [archivio, perPos.get(p)!]);
    progresso?.(tentativi(req, archivio), 0, 0);
    return { p, q };
  });
  qualita.sort((a, b) => b.q - a.q);
  // "Continua": le reti già trovate entrano nell'archivio della loro posizione e quelle
  // posizioni passano davanti alle altre
  const daPartenze: Array<{ row: number; col: number }> = [];
  for (const pt of req.partenze ?? []) {
    const p = pos.find((x) => x.row === pt.ambasciata.row && x.col === pt.ambasciata.col);
    if (!p) continue;
    const strade = pt.strade.map((c) => c.row * req.colonne + c.col);
    const val = new Valutatore(req, p).valuta(strade, false);
    registra([archivio, perPos.get(p)!], p, strade, punteggio(val));
    if (!daPartenze.includes(p)) daPartenze.push(p);
  }
  // 2. le migliori, a giri, con ricottura a strade libere e pesi diversi finché c'è tempo
  const migliori = [...daPartenze, ...qualita.slice(0, Math.max(3, Math.ceil(pos.length / 4))).map((x) => x.p).filter((p) => !daPartenze.includes(p))];
  const lambdas = [2, 5, 9, 14, 0.5];
  let giro = 0;
  while (Date.now() < scadenza && migliori.length) {
    const p = migliori[giro % migliori.length]!;
    const lambda = lambdas[Math.floor(giro / migliori.length) % lambdas.length]!;
    // parte dalla migliore rete già trovata per questa posizione (o da una crescita veloce)
    let partenza: number[] | null = null, ps = -Infinity;
    for (const a of perPos.get(p)!.values()) if (a.rupieOra - lambda * a.strade.length > ps) { ps = a.rupieOra - lambda * a.strade.length; partenza = a.strade; }
    if (!partenza) { giro++; continue; }
    ricuoci(req, p, partenza, lambda, 20000, rng, scadenza, [archivio, perPos.get(p)!]);
    giro++;
    progresso?.(tentativi(req, archivio), giro, 0);
  }
  return tentativi(req, archivio);
}

/** Unisce i tentativi di più worker: per ogni numero di strade il migliore, poi solo quelli
 *  che producono più di tutti i tentativi con meno strade. */
export function unisciTentativi(liste: Tentativo[][]): Tentativo[] {
  const perK = new Map<number, Tentativo>();
  for (const l of liste) for (const t of l) {
    const p = perK.get(t.strade);
    if (!p || t.rupieOra > p.rupieOra + 1e-9) perK.set(t.strade, t);
  }
  const out: Tentativo[] = [];
  for (const t of [...perK.values()].sort((a, b) => a.strade - b.strade)) {
    if (!out.length || t.rupieOra > out[out.length - 1]!.rupieOra + 1e-9) out.push(t);
  }
  return out;
}
