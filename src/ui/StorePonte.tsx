// ─────────────────────────────────────────────────────────────────────────────
//  ui/StorePonte.tsx — Link agli store dell'estensione FoE Optimizer Bridge
//
//  (27/11/2026) Due "pastiglie": Chrome Web Store (vale anche per Edge, Brave,
//  Opera) e Firefox Add-ons. Finché STORE_PONTE.firefox è vuoto (estensione
//  ancora in revisione su AMO) Firefox resta spento con "in arrivo".
//  Usato dal pannello dell'indicatore OFF e da Guida › Come importare la città.
// ─────────────────────────────────────────────────────────────────────────────

import { ExternalLink } from "lucide-react";
import { STORE_PONTE } from "../data/ponte";
import { t, type UiLang } from "../data/ui-strings";

export default function StorePonte({ uiLang, grandi = false }: { uiLang: UiLang; grandi?: boolean }) {
  const base = `inline-flex items-center gap-1.5 border ${grandi ? "px-2.5 py-1.5 font-semibold" : "px-1.5 py-0.5"}`;
  const voci = [
    { nome: "Chrome Web Store", url: STORE_PONTE.chrome, nota: t("r2PonteStoreChromeNote", uiLang) },
    { nome: "Firefox Add-ons", url: STORE_PONTE.firefox, nota: "" },
  ];
  return (
    <span className="flex flex-wrap gap-1.5">
      {voci.map(v => v.url
        ? <a key={v.nome} href={v.url} target="_blank" rel="noopener noreferrer" title={v.nota || undefined}
            className={`${base} border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-200`}>
            {v.nome} <ExternalLink size={grandi ? 12 : 10} aria-hidden="true" />
          </a>
        : <span key={v.nome} aria-disabled="true" title={t("r2PonteStoreSoonTitle", uiLang)}
            className={`${base} cursor-default border-slate-700 text-slate-500`}>
            {v.nome} <span className="text-[10px] font-normal uppercase tracking-wide">· {t("r2PonteStoreSoon", uiLang)}</span>
          </span>)}
    </span>
  );
}
