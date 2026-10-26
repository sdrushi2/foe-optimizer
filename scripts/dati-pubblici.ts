// ─────────────────────────────────────────────────────────────────────────────
//  scripts/dati-pubblici.ts — Dati di gioco in public/data/ (FoE Optimizer 2.0)
//
//  Usato da vite.config.ts (plugin datiPlugin):
//   - manifestDati(): hash del contenuto di ogni file → /data/manifest.json.
//     L'app scarica i file con ?v=<hash>: un file cambiato ha un URL nuovo,
//     nessuna cache (HTTP o service worker) può servire quello vecchio;
//   - verificaDati(): controllo dei file PRIMA della build. Nella 1.x un dato
//     malformato faceva fallire la build (i dati erano nel bundle); ora i
//     dati si leggono nel browser, quindi gli stessi controlli dei parser
//     (colonne, righe, duplicati) si fanno qui: se un file non va, la build
//     (e la GitHub Action) si ferma e il sito pubblicato resta quello di prima.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import fs from "fs";
import path from "path";

/** Stessa lista di FILE_DATI in src/data/datiGioco.ts. */
const FILE = ["ages.csv", "buildings.csv", "allies.csv", "events.csv", "unique.csv", "kit.json", "catene.json",
  // 2.0: scaricato solo quando serve (datiGioco.caricaBuildingsExtra), ma con hash come gli altri
  "buildings_extra.csv"] as const;

export interface ManifestDati { versione: string; file: Record<string, string> }

export function manifestDati(dir: string): ManifestDati {
  const file: Record<string, string> = {};
  const tutto = createHash("sha256");
  for (const f of FILE) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    const buf = fs.readFileSync(p);
    file[f] = createHash("sha256").update(buf).digest("hex").slice(0, 10);
    tutto.update(f).update(file[f]);
  }
  return { versione: tutto.digest("hex").slice(0, 10), file };
}

/** Righe di un CSV a ";" (virgolette come parseCsvRows di buildings.ts), senza BOM e righe vuote. */
function righeCsv(testo: string): string[][] {
  const righe: string[][] = [];
  let campo = "", riga: string[] = [], virgolette = false;
  const s = testo.replace(/^\uFEFF/, "");
  const chiudi = () => { riga.push(campo); if (riga.some(c => c.trim() !== "")) righe.push(riga); campo = ""; riga = []; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (virgolette) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') virgolette = false;
      else campo += c;
    } else if (c === '"') virgolette = true;
    else if (c === ";") { riga.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { chiudi(); if (c === "\r" && s[i + 1] === "\n") i++; }
    else campo += c;
  }
  if (campo !== "" || riga.length) chiudi();
  return righe;
}

/** Controlli di un CSV: colonne obbligatorie, nessuna riga più lunga
 *  dell'intestazione, almeno `minRighe` righe, chiave univoca. */
function controllaCsv(nome: string, testo: string, errori: string[], opz: {
  colonne: string[]; minRighe: number; chiave?: (r: string[], col: (n: string) => number) => string;
}): void {
  const righe = righeCsv(testo);
  const intest = (righe[0] ?? []).map(h => h.trim().toLowerCase());
  const col = (n: string) => intest.indexOf(n.toLowerCase());
  const mancanti = opz.colonne.filter(c => col(c) < 0);
  if (mancanti.length) { errori.push(`${nome}: colonne mancanti ${mancanti.join(", ")}`); return; }
  if (righe.length - 1 < opz.minRighe) errori.push(`${nome}: solo ${righe.length - 1} righe (attese almeno ${opz.minRighe})`);
  const visti = new Set<string>();
  righe.slice(1).forEach((r, i) => {
    if (r.length > intest.length) errori.push(`${nome} riga ${i + 2}: ${r.length} campi, l'intestazione ne ha ${intest.length}`);
    if (opz.chiave) {
      const k = opz.chiave(r, col);
      if (visti.has(k)) errori.push(`${nome} riga ${i + 2}: chiave duplicata ${k}`);
      visti.add(k);
    }
  });
}

/** Elenco degli errori trovati nei dati (vuoto = tutto a posto). */
export function verificaDati(dir: string): string[] {
  const errori: string[] = [];
  const leggi = (f: string): string | null => {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) { errori.push(`${f}: file mancante in ${dir}`); return null; }
    return fs.readFileSync(p, "utf-8");
  };
  const campo = (r: string[], i: number) => (r[i] ?? "").trim();

  const ages = leggi("ages.csv");
  if (ages !== null) {
    controllaCsv("ages.csv", ages, errori, { colonne: ["id", "age", "NomeEng"], minRighe: 20, chiave: (r, c) => campo(r, c("age")) });
    // Come ages.ts: id contigui 0..n-1.
    const ids = righeCsv(ages).slice(1).map(r => Number(r[0])).sort((a, b) => a - b);
    if (ids.some((id, i) => id !== i)) errori.push("ages.csv: gli id devono essere contigui 0..n-1");
  }
  const b = leggi("buildings.csv");
  if (b !== null) controllaCsv("buildings.csv", b, errori, {
    colonne: ["CityEntityId", "NomeIta", "NomeEng", "Hash", "Size", "Road", "Flags"], minRighe: 1000,
    chiave: (r, c) => campo(r, c("CityEntityId")),
  });
  const bx = leggi("buildings_extra.csv");
  if (bx !== null) controllaCsv("buildings_extra.csv", bx, errori, {
    colonne: ["CityEntityId", "NomeIta", "NomeEng", "Size", "Road"], minRighe: 100,
    chiave: (r, c) => campo(r, c("CityEntityId")),
  });
  const a = leggi("allies.csv");
  if (a !== null) controllaCsv("allies.csv", a, errori, {
    colonne: ["Id", "NomeIta", "NomeEng", "Rarity", "MaxLevel"], minRighe: 50,
    chiave: (r, c) => `${campo(r, c("Id"))}__${campo(r, c("Rarity"))}`,
  });
  const ev = leggi("events.csv");
  if (ev !== null) controllaCsv("events.csv", ev, errori, { colonne: ["NomeIt", "NomeEng", "ID_LIST"], minRighe: 1 });
  const u = leggi("unique.csv");
  if (u !== null) u.split(/\r?\n/).map(l => l.trim()).forEach((l, i) => {
    if (l && !/^[\w.-]+$/.test(l)) errori.push(`unique.csv riga ${i + 1}: id non valido "${l.slice(0, 40)}"`);
  });

  const json = (f: string, chiavi: string[]) => {
    const t = leggi(f);
    if (t === null) return;
    try {
      const o = JSON.parse(t) as unknown;
      if (!o || typeof o !== "object" || Array.isArray(o)) { errori.push(`${f}: non è un oggetto JSON`); return; }
      const mancanti = chiavi.filter(k => !(k in o));
      if (mancanti.length) errori.push(`${f}: chiavi mancanti ${mancanti.join(", ")}`);
    } catch (e) {
      errori.push(`${f}: JSON non valido (${(e as Error).message})`);
    }
  };
  json("kit.json", ["buildingUpgrades", "selectionKits"]);
  json("catene.json", ["edifici"]);
  return errori;
}
