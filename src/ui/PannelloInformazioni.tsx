// ─────────────────────────────────────────────────────────────────────────────
//  ui/PannelloInformazioni.tsx — Guida › Informazioni (2.0)
//
//  Prima era un popup (AboutModal); ora è un pannello che si apre e si chiude
//  dal nastro come Statistiche o Debug: stesso riquadro squadrato, titolo in
//  maiuscolo. Tre colonne (una sola su schermi stretti): il progetto, i
//  contatti, codice sorgente e informativa.
// ─────────────────────────────────────────────────────────────────────────────

import { AtSign, ShieldCheck, ExternalLink, GitBranch } from "lucide-react";
import type { ReactNode as ComponentChildren } from "react";
import { t, type UiLang } from "../data/ui-strings";

const AVATAR_IT   = "https://foeit.innogamescdn.com/assets/shared/avatars/portrait_359-bfd78cf37.jpg";
const AVATAR_BETA = "https://foezz.innogamescdn.com/assets/shared/avatars/portrait_847-c8fad0549.jpg";
const GITHUB_URL  = "https://github.com/sdrushi2/foe-optimizer";
const GITHUB_V2   = `${GITHUB_URL}/tree/v2`;
const EMAIL_ADDR  = "info@foe-optimizer.com";
const PRIVACY_URL = `${GITHUB_URL}/blob/main/PRIVACY.md`;

/** Logo GitHub (non c'è in questa versione di lucide-react). */
function GithubIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

/** Sottotitolo di una colonna. */
function Titoletto({ children }: { children: ComponentChildren }) {
  return <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</div>;
}

/** Riga-collegamento (icona, testo, dettaglio). */
function Collegamento({ href, icona, testo, dettaglio, esterno = true }: { href: string; icona: ComponentChildren; testo: string; dettaglio?: string; esterno?: boolean }) {
  return (
    <a href={href} {...(esterno ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group flex items-center gap-2.5 border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-100">
      <span className="shrink-0 text-slate-400 group-hover:text-slate-100">{icona}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{testo}</span>
        {dettaglio && <span className="block truncate text-[11px] text-slate-500">{dettaglio}</span>}
      </span>
      {esterno && <ExternalLink size={12} className="shrink-0 text-slate-600 group-hover:text-slate-400" aria-hidden="true" />}
    </a>
  );
}

/** Scheda di un account di gioco (avatar, nome, server). */
function Account({ avatar, alt, server, coloreServer, mondo, uiLang }: { avatar: string; alt: string; server: string; coloreServer: string; mondo?: string; uiLang: UiLang }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 border border-slate-800 bg-slate-900/60 p-2">
      <img src={avatar} alt={alt} className="h-12 w-12 shrink-0 border border-slate-700 object-cover" />
      <div className="min-w-0 leading-tight">
        <div className="font-bold text-slate-100">Sdrushi</div>
        <div className={`text-[11px] ${coloreServer}`}>{server}</div>
        {mondo && <div className="text-[11px] text-slate-500">{t("aboutWorldLabel", uiLang)}: <span className="text-slate-400">{mondo}</span></div>}
      </div>
    </div>
  );
}

export default function PannelloInformazioni({ uiLang, versione }: { uiLang: UiLang; versione: string }) {
  return (
    <div className="w-full border border-slate-800 bg-slate-950 p-3 text-xs">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-bold uppercase tracking-wide text-slate-200">{t("r2About", uiLang)}</span>
        <span className="font-mono text-[11px] text-slate-500">FoE Optimizer {versione}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Il progetto */}
        <section className="space-y-2 leading-relaxed text-slate-300">
          <Titoletto>{t("r2InfoProject", uiLang)}</Titoletto>
          <p>{t("r2InfoAmateur", uiLang)}</p>
          <p className="border-l-2 border-amber-600/60 pl-2 text-slate-400">{t("r2InfoNotAffiliated", uiLang)}</p>
          <p>{t("r2InfoLocal", uiLang)}</p>
          <p className="text-slate-400">{t("r2InfoData", uiLang)}</p>
        </section>

        {/* Contatti */}
        <section className="space-y-2">
          <Titoletto>{t("r2InfoContacts", uiLang)}</Titoletto>
          <div className="flex gap-2">
            <Account avatar={AVATAR_IT} alt={t("aboutAvatarItAlt", uiLang)} server={t("aboutServerItLabel", uiLang)} coloreServer="text-amber-400" mondo="Fel Dranghyr" uiLang={uiLang} />
            <Account avatar={AVATAR_BETA} alt={t("aboutAvatarBetaAlt", uiLang)} server={t("aboutServerBetaLabel", uiLang)} coloreServer="text-sky-400" uiLang={uiLang} />
          </div>
          <Collegamento href={`mailto:${EMAIL_ADDR}`} esterno={false} icona={<AtSign size={15} />} testo={EMAIL_ADDR} dettaglio={t("r2InfoEmailNote", uiLang)} />
        </section>

        {/* Codice sorgente e informativa */}
        <section className="space-y-2">
          <Titoletto>{t("r2InfoSourcePrivacy", uiLang)}</Titoletto>
          <Collegamento href={GITHUB_URL} icona={<GithubIcon size={15} />} testo="sdrushi2/foe-optimizer" dettaglio={t("r2InfoSourceNote", uiLang)} />
          <Collegamento href={GITHUB_V2} icona={<GitBranch size={15} />} testo={t("r2InfoSourceV2", uiLang)} dettaglio={`${GITHUB_URL.replace("https://", "")}/tree/v2`} />
          <Collegamento href={PRIVACY_URL} icona={<ShieldCheck size={15} />} testo={t("aboutPrivacyLabel", uiLang)} dettaglio={t("r2InfoPrivacyNote", uiLang)} />
        </section>
      </div>
    </div>
  );
}
