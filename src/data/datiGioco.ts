// ─────────────────────────────────────────────────────────────────────────────
//  data/datiGioco.ts — Dati di gioco scaricati all'avvio (FoE Optimizer 2.0)
//
//  Nella 1.x i dati (buildings.csv, kit.json…) erano dentro il bundle
//  (import `?raw`, build single-file). Nella 2.0 sono file veri in
//  public/data/, pubblicati così come sono: aggiornare un CSV non tocca il
//  codice e il browser riscarica solo il file cambiato.
//
//  Avvio (main.tsx): `caricaDatiGioco()` legge /data/manifest.json (generato
//  dalla build, con l'hash di ogni file) e scarica i file con `?v=<hash>`,
//  così la cache HTTP e il service worker non servono mai un file vecchio.
//  SOLO DOPO main.tsx importa (import dinamico) il resto dell'app: i moduli
//  che analizzano i dati al caricamento (ages.ts, uniqueBuildings.ts,
//  catene.ts, App.tsx) leggono `datiGioco()` in modo sincrono, come prima
//  leggevano l'import `?raw`.
//
//  Regola: nessun modulo importato STATICAMENTE da main.tsx deve dipendere
//  (anche indirettamente) da questi dati, altrimenti verrebbe eseguito prima
//  del caricamento e `datiGioco()` lancerebbe un errore.
// ─────────────────────────────────────────────────────────────────────────────

/** File di public/data/ (stessi nomi di src/assets/ della 1.x). */
const FILE_DATI = ["ages.csv", "buildings.csv", "allies.csv", "events.csv", "unique.csv", "kit.json", "catene.json"] as const;
type FileDati = typeof FILE_DATI[number];

export interface DatiGioco {
  ages: string;
  buildings: string;
  allies: string;
  events: string;
  unique: string;
  /** kit.json già analizzato (forma: KitDataRaw di inventoryOptimizer.ts). */
  kit: unknown;
  /** catene.json già analizzato (forma: vedi planner/catene.ts). */
  catene: unknown;
}

/** /data/manifest.json: hash (corto) del contenuto di ogni file. */
interface Manifest { versione: string; file: Partial<Record<FileDati, string>> }

let dati: DatiGioco | null = null;
/** Manifest letto all'avvio: serve anche ai file scaricati solo quando servono. */
let manifestAvvio: { file?: Partial<Record<string, string>> } = {};
let extra: Promise<string> | null = null;

/** buildings_extra.csv (2.0): edifici fuori catalogo (militari, fabbriche di
 *  beni, municipi, strade, porti...), stesse colonne di buildings.csv.
 *  Scaricato SOLO quando serve (Importa JSON del Planner), una volta sola;
 *  stringa vuota se manca o non si scarica (si usa solo il catalogo). */
export function caricaBuildingsExtra(): Promise<string> {
  if (!extra) {
    const h = manifestAvvio.file?.["buildings_extra.csv"];
    extra = scarica(h ? `/data/buildings_extra.csv?v=${h}` : "/data/buildings_extra.csv")
      .then(r => r.text()).catch(() => { extra = null; return ""; });
  }
  return extra;
}

/** Dati caricati. Lancia un errore se chiamata prima di `caricaDatiGioco()`. */
export function datiGioco(): DatiGioco {
  if (!dati) throw new Error("datiGioco(): dati non ancora caricati (vedi main.tsx)");
  return dati;
}

async function scarica(url: string, init?: RequestInit): Promise<Response> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r;
}

/** Scarica tutti i file di dati (in parallelo). Una sola volta all'avvio. */
export async function caricaDatiGioco(): Promise<void> {
  if (dati) return;
  // Il manifest va sempre chiesto alla rete (no-cache = rivalida): è lui a
  // dire quale versione di ogni file usare. Offline ci pensa il service worker.
  let manifest: Manifest = { versione: "", file: {} };
  try {
    manifest = await (await scarica("/data/manifest.json", { cache: "no-cache" })).json() as Manifest;
  } catch { /* senza manifest (non dovrebbe succedere): file senza versione */ }
  manifestAvvio = manifest;
  const url = (f: FileDati) => {
    const h = manifest.file?.[f];
    return h ? `/data/${f}?v=${h}` : `/data/${f}`;
  };
  const testo = async (f: FileDati) => (await scarica(url(f))).text();
  const json = async (f: FileDati) => (await scarica(url(f))).json() as Promise<unknown>;
  const [ages, buildings, allies, events, unique, kit, catene] = await Promise.all([
    testo("ages.csv"), testo("buildings.csv"), testo("allies.csv"), testo("events.csv"), testo("unique.csv"),
    json("kit.json"), json("catene.json"),
  ]);
  dati = { ages, buildings, allies, events, unique, kit, catene };
}
