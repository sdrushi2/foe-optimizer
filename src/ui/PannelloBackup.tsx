// ─────────────────────────────────────────────────────────────────────────────
//  ui/PannelloBackup.tsx — Opzioni › Backup (27/11/2026)
//
//  Al posto del vecchio popup "Importa sessione" e dell'export immediato:
//  - Esporta backup: elenca cosa finisce nel file (città con i nomi,
//    impostazioni, insediamenti, dimensione), avvisa che è un file personale da
//    non dare ad altri giocatori, e chiede conferma.
//  - Ripristina backup: si sceglie il file, il pannello mostra cosa contiene
//    (data, città, impostazioni) e avverte che le città attuali verranno
//    cancellate e le impostazioni sovrascritte; con la conferma sostituisce
//    tutto e ricarica la pagina.
//  La logica è in utils/backup.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Download, FileUp, Upload, X } from "lucide-react";
import { t, type UiLang } from "../data/ui-strings";
import { localDateStamp } from "../utils/format";
import { leggiBackup, raccogliBackup, riepilogoBackup, ripristinaBackup, testoBackup, type LetturaBackup, type RiepilogoBackup } from "../utils/backup";

type Chiave = Parameters<typeof t>[0];

function dimensione(n: number, lang: UiLang): string {
  const loc = lang === "it" ? "it-IT" : "en-GB";
  return n >= 1_000_000
    ? `${(n / 1_048_576).toLocaleString(loc, { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(n / 1024)).toLocaleString(loc)} KB`;
}

function Voce({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="w-32 shrink-0 font-semibold text-slate-300">{titolo}</span>
      <span className="text-slate-400">{children}</span>
    </li>
  );
}

function Contenuto({ r, L }: { r: RiepilogoBackup; L: (k: Chiave, ...a: unknown[]) => string }) {
  // le tue città hanno tutto; quelle visitate solo la mappa (niente inventario né alleati)
  const gruppo = (tipo: "mia" | "visitata", titolo: Chiave, cosa: Chiave) => {
    const nomi = r.citta.filter(c => c.tipo === tipo).map(c => c.nome);
    return (
      <Voce titolo={`${L(titolo)} (${nomi.length})`}>
        {nomi.length ? <><span className="text-slate-200">{nomi.join(", ")}</span> — {L(cosa)}</> : L("r2BkNessuna")}
      </Voce>
    );
  };
  return (
    <ul className="mb-3 space-y-1">
      {gruppo("mia", "r2BkMie", "r2BkMieCosa")}
      {gruppo("visitata", "r2BkVisitate", "r2BkVisitateCosa")}
      <Voce titolo={L("r2BkImpostazioni")}>{r.impostazioni ? L("r2BkImpostazioniCosa") : L("r2BkNessuna")}</Voce>
      <Voce titolo={L("r2BkInsediamenti")}>{r.insediamenti ? L("r2BkInsediamentiCosa", r.insediamenti) : L("r2BkNessuno")}</Voce>
    </ul>
  );
}

const pulsante = "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const neutro = `${pulsante} border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700`;

export default function PannelloBackup({ uiLang, modo, versioneApp, onChiudi }: {
  uiLang: UiLang; modo: "esporta" | "ripristina"; versioneApp: string; onChiudi: () => void;
}) {
  const L = (k: Chiave, ...a: unknown[]) => t(k, uiLang, ...(a as [])) as string;
  // dati attuali del browser: letti all'apertura del pannello
  const attuale = useMemo(() => riepilogoBackup(raccogliBackup()), []);
  const [salvato, setSalvato] = useState<string | null>(null);
  const [file, setFile] = useState<{ nome: string; lettura: LetturaBackup } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const esporta = () => {
    const nome = `foe-optimizer-backup-${localDateStamp()}.json`;
    const url = URL.createObjectURL(new Blob([testoBackup(raccogliBackup(), versioneApp)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSalvato(nome);
  };

  const scegli = (f: File) => {
    setErrore(null);
    f.text().then(testo => setFile({ nome: f.name, lettura: leggiBackup(testo) }), () => setErrore(L("r2BkErrLettura")));
  };

  const ripristina = () => {
    if (!file?.lettura.ok) return;
    const esito = ripristinaBackup(file.lettura.storage);
    if (esito.ok) { window.location.reload(); return; }
    setErrore(L(esito.motivo === "spazio" ? "r2BkErrSpazio" : "r2BkErrAltro"));
  };

  const loc = uiLang === "it" ? "it-IT" : "en-GB";
  const letto = file?.lettura.ok ? file.lettura : null;
  const erroreFile = file && !file.lettura.ok ? file.lettura.errore : null;

  return (
    <div className="relative w-full max-w-3xl border border-slate-800 bg-slate-950 p-3 text-xs">
      <button type="button" onClick={onChiudi} title={L("closeAriaLabel")} aria-label={L("closeAriaLabel")}
        className="absolute top-2 right-2 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-100">
        <X size={16} aria-hidden="true" />
      </button>
      <div className="mb-1 pr-6 font-bold uppercase tracking-wide text-slate-200">{L(modo === "esporta" ? "r2ExportAll" : "r2Restore")}</div>

      {modo === "esporta" ? (
        <>
          <p className="mb-2 text-slate-400">{L("r2BkEspIntro")}</p>
          <Contenuto r={attuale} L={L} />
          <p className="mb-3 text-slate-500">{L("r2BkDimensione", dimensione(attuale.dimensione, uiLang))}</p>
          <div className="mb-3 flex gap-2 border border-amber-700/60 bg-amber-950/30 p-2 text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
            <span>{L("r2BkEspAvviso")}</span>
          </div>
          {salvato ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-emerald-400">{L("r2BkEspFatto", salvato)}</span>
              <button type="button" className={neutro} onClick={onChiudi}>{L("closeAriaLabel")}</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={neutro} onClick={onChiudi}>{L("r2BkAnnulla")}</button>
              <button type="button" className={`${pulsante} border-amber-600 bg-amber-600 text-slate-950 hover:bg-amber-500`} onClick={esporta}>
                <Download size={14} aria-hidden="true" /> {L("r2ExportAll")}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-slate-400">{L("r2BkRipIntro")}</p>
          <label className={`${neutro} mb-3 cursor-pointer`}>
            <FileUp size={14} aria-hidden="true" /> {L(file ? "r2BkRipAltroFile" : "r2BkRipScegli")}
            <input type="file" accept=".json,application/json" className="hidden"
              onChange={e => { const f = e.currentTarget.files?.[0]; if (f) scegli(f); e.currentTarget.value = ""; }} />
          </label>

          {erroreFile && (
            <div className="mb-3 border border-red-900/60 bg-red-950/30 p-2 text-red-300">
              <span className="font-semibold">{file!.nome}</span>: {L(erroreFile === "json" ? "r2BkErrJson" : erroreFile === "citta" ? "r2BkErrCitta" : erroreFile === "vuoto" ? "r2BkErrVuoto" : "r2BkErrAltroFile")}
            </div>
          )}

          {letto && (
            <>
              <div className="mb-1 font-semibold text-slate-200">
                {L("r2BkRipContenuto", file!.nome)}
                {letto.data && <span className="font-normal text-slate-400"> — {L("r2BkRipData", letto.data.toLocaleString(loc, { dateStyle: "long", timeStyle: "short" }))}</span>}
                {letto.versioneApp && <span className="font-normal text-slate-500"> ({letto.versioneApp})</span>}
              </div>
              <Contenuto r={letto.riepilogo} L={L} />
              <div className="mb-3 flex gap-2 border border-red-800/70 bg-red-950/40 p-2 text-red-200">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
                <span>
                  {attuale.citta.length
                    ? L("r2BkRipAvvisoCitta", attuale.citta.length, attuale.citta.map(c => c.nome).join(", "))
                    : L("r2BkRipAvvisoVuoto")}
                </span>
              </div>
            </>
          )}

          {errore && <div className="mb-3 border border-red-900/60 bg-red-950/30 p-2 text-red-300">{errore}</div>}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={neutro} onClick={onChiudi}>{L("r2BkAnnulla")}</button>
            <button type="button" disabled={!letto} onClick={ripristina}
              className={`${pulsante} border-red-700 bg-red-700 text-white hover:bg-red-600`}>
              <Upload size={14} aria-hidden="true" /> {L("r2Restore")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
