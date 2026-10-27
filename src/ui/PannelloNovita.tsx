// ─────────────────────────────────────────────────────────────────────────────
//  ui/PannelloNovita.tsx — Guida › Novità (2.0)
//
//  Legge changelog-it.md / changelog-en.md (alla radice del progetto, inclusi
//  nel codice alla build con "?raw": niente download, sempre allineati alla
//  versione). Formato, sul modello del changelog di Forge Hammer, dalla
//  versione più recente:
//
//    ## Versione 2.001 (27/10/2026)     ← versione e data (gg/mm/aaaa)
//    ### Novità                          ← Novità / Aggiornamenti / Correzioni
//    - Una voce per riga                    (New / Update / Bug Fixes in inglese)
//    - Planner: a; b; c                  ← "Titolo:" in grassetto, "; " = sotto-voci
//    ---                                 ← separatore (facoltativo, ignorato)
//
//  Le righe che non seguono il formato (titolo "#", righe vuote) sono ignorate.
// ─────────────────────────────────────────────────────────────────────────────

import changelogIt from "../../changelog-it.md?raw";
import changelogEn from "../../changelog-en.md?raw";
import { t, type UiLang } from "../data/ui-strings";

interface Gruppo { titolo: string; righe: string[] }
interface Versione { versione: string; data: string | null; gruppi: Gruppo[] }

/** Le versioni del changelog, dalla più recente. */
function leggiChangelog(testo: string): Versione[] {
  const versioni: Versione[] = [];
  for (const grezza of testo.split(/\r?\n/)) {
    const riga = grezza.trim();
    const v = /^## \S+ (\d+\.\d+)/.exec(riga);
    if (v && !riga.startsWith("###")) {
      versioni.push({ versione: v[1]!, data: /\(([^)]*)\)/.exec(riga)?.[1] ?? null, gruppi: [] });
      continue;
    }
    const ultima = versioni[versioni.length - 1];
    if (!ultima) continue;
    if (riga.startsWith("### ")) ultima.gruppi.push({ titolo: riga.slice(4).trim(), righe: [] });
    else if (riga.startsWith("- ")) {
      if (!ultima.gruppi.length) ultima.gruppi.push({ titolo: "", righe: [] });
      ultima.gruppi[ultima.gruppi.length - 1]!.righe.push(riga.slice(2).trim());
    }
  }
  return versioni;
}

const CHANGELOG: Record<UiLang, Versione[]> = { it: leggiChangelog(changelogIt), en: leggiChangelog(changelogEn) };

/** Colore del titoletto: novità verde, aggiornamenti azzurro, correzioni ambra. */
function coloreGruppo(titolo: string): string {
  const s = titolo.toLowerCase();
  if (s.startsWith("nov") || s.startsWith("new")) return "text-emerald-400";
  if (s.startsWith("corr") || s.includes("fix")) return "text-amber-400";
  return "text-sky-400";
}

/** "Planner: a; b; c" → "Planner" in grassetto e sotto-voci a, b, c. */
function Riga({ testo }: { testo: string }) {
  const parti = testo.split(/;\s+/);
  const m = /^([^:]{2,30}):\s+(.*)$/.exec(parti[0]!);
  const evidenza = /^[A-ZÀ-Ü][A-ZÀ-Ü\s.0-9]{3,}[:\s]/.test(testo); // "NUOVA VERSIONE 2.0: …", "PLANNER: …"
  return (
    <li className={evidenza ? "text-amber-300" : ""}>
      {m ? <><span className={`font-semibold ${evidenza ? "" : "text-slate-100"}`}>{m[1]}:</span> {m[2]}</> : parti[0]}
      {parti.length > 1 && (
        <ul className="mt-0.5 list-[circle] space-y-0.5 pl-4 text-slate-400">
          {parti.slice(1).map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}
    </li>
  );
}

export default function PannelloNovita({ uiLang }: { uiLang: UiLang }) {
  const versioni = CHANGELOG[uiLang];
  return (
    <div className="w-full border border-slate-800 bg-slate-950 p-3 text-xs">
      <div className="mb-1 font-bold uppercase tracking-wide text-slate-200">{t("r2WhatsNew", uiLang)}</div>
      <p className="mb-3 text-slate-400">{t("r2WhatsNewIntro", uiLang)}</p>
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <ol className="relative border-l border-slate-800">
          {versioni.map((v, i) => (
            <li key={v.versione} className="mb-4 ml-4 last:mb-0">
              <span className={`absolute -left-[5px] mt-1 h-2.5 w-2.5 border ${i === 0 ? "border-amber-400 bg-amber-500" : v.versione.startsWith("2.") ? "border-sky-400 bg-sky-600" : "border-slate-600 bg-slate-800"}`} aria-hidden="true" />
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="border border-sky-700/70 bg-sky-950/50 px-1.5 font-mono text-[11px] text-sky-300">v{v.versione}</span>
                {v.data && <span className={`font-semibold ${i === 0 ? "text-amber-300" : "text-slate-300"}`}>{v.data}</span>}
                {i === 0 && <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500">{t("r2WhatsNewLatest", uiLang)}</span>}
              </div>
              {v.gruppi.map((g, j) => (
                <div key={j} className="mt-1">
                  {g.titolo && <div className={`text-[10px] font-bold uppercase tracking-wide ${coloreGruppo(g.titolo)}`}>{g.titolo}</div>}
                  <ul className="list-disc space-y-1 pl-4 leading-relaxed text-slate-300 marker:text-slate-600">
                    {g.righe.map((r, k) => <Riga key={k} testo={r} />)}
                  </ul>
                </div>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
