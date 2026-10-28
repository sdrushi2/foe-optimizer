// ─────────────────────────────────────────────────────────────────────────────
//  ui/PannelloInformazioni.tsx — Guida › Informazioni (2.0)
//
//  Prima era un popup (AboutModal); ora è un pannello che si apre e si chiude
//  dal nastro come Statistiche o Debug: stesso riquadro squadrato, titolo in
//  maiuscolo. Due colonne (una sola su schermi stretti): il progetto e i
//  contatti; codice sorgente e informativa
//  stanno sotto il progetto, nella colonna di sinistra.
// ─────────────────────────────────────────────────────────────────────────────

import { AtSign, ShieldCheck, ExternalLink, Check, Coffee } from "lucide-react";
import { useEffect, useState, type ReactNode as ComponentChildren } from "react";
import { t, type UiLang } from "../data/ui-strings";

const AVATAR_IT   = "https://foeit.innogamescdn.com/assets/shared/avatars/portrait_359-bfd78cf37.jpg";
const AVATAR_BETA = "https://foezz.innogamescdn.com/assets/shared/avatars/portrait_847-c8fad0549.jpg";
const GITHUB_URL  = "https://github.com/sdrushi2/foe-optimizer";
const EMAIL_ADDR  = "info@foe-optimizer.com";
const PRIVACY_URL = `${GITHUB_URL}/blob/main/PRIVACY.md`;
// "Offrimi un caffè": semplici link, nessuno script di PayPal o Satispay.
// Il QR Satispay è un'immagine locale (public/satispay.png); su telefono,
// dove non si può inquadrare, al suo posto c'è il link equivalente.
const PAYPAL_URL   = "https://paypal.me/sdrushi";
const SATISPAY_URL = "https://web.satispay.com/download/qrcode/S6Y-SVN--7FD76053-4565-4B48-B756-2041B1E399D9?locale=";
const SATISPAY_QR  = `${import.meta.env.BASE_URL}satispay.png`;
const PAYPAL_LOGO  = `${import.meta.env.BASE_URL}paypal.svg`;   // logo ufficiale (blu: va su fondo bianco)

/** Le voci di "Pulito, per scelta". */
const PULITO = ["r2Clean1", "r2Clean2", "r2Clean3", "r2Clean4", "r2Clean5", "r2Clean6", "r2Clean7", "r2Clean8", "r2Clean9", "r2Clean10", "r2Clean11"] as const;

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
  // QR Satispay ingrandito (si chiude con un clic ovunque o con Esc)
  const [qrGrande, setQrGrande] = useState(false);
  useEffect(() => {
    if (!qrGrande) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setQrGrande(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [qrGrande]);
  return (
    <div className="w-full border border-slate-800 bg-slate-950 p-3 text-xs">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-bold uppercase tracking-wide text-slate-200">{t("r2About", uiLang)}</span>
        <span className="font-mono text-[11px] text-slate-500">FoE Optimizer {versione}</span>
      </div>
      {/* "Pulito, per scelta": niente pubblicità, cookie, tracciamento… (richiesta dell'utente) */}
      <section className="mb-4 border border-emerald-700/50 bg-emerald-950/20 px-3 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-300">
            <ShieldCheck size={16} aria-hidden="true" /> {t("r2CleanTitle", uiLang)}
          </span>
          <span className="text-slate-300">{t("r2CleanSubtitle", uiLang)}</span>
        </div>
        <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {PULITO.map(k => (
            <li key={k} className="flex items-start gap-1.5 text-slate-200">
              <Check size={13} strokeWidth={3} className="mt-[2px] shrink-0 text-emerald-400" aria-hidden="true" />
              {t(k, uiLang)}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t("r2CleanNote", uiLang)}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Colonna sinistra: il progetto, poi codice sorgente e informativa */}
        <div className="space-y-4">
          {/* Il progetto */}
          <section className="space-y-2 leading-relaxed text-slate-300">
            <Titoletto>{t("r2InfoProject", uiLang)}</Titoletto>
            <p>{t("r2InfoAmateur", uiLang)}</p>
            <p className="border-l-2 border-amber-600/60 pl-2 text-slate-400">{t("r2InfoNotAffiliated", uiLang)}</p>
            <p>{t("r2InfoData", uiLang)}</p>
          </section>

          {/* Codice sorgente e informativa */}
          <section className="space-y-2">
            <Titoletto>{t("r2InfoSourcePrivacy", uiLang)}</Titoletto>
            <Collegamento href={GITHUB_URL} icona={<GithubIcon size={15} />} testo="sdrushi2/foe-optimizer" dettaglio={t("r2InfoSourceNote", uiLang)} />
            <Collegamento href={PRIVACY_URL} icona={<ShieldCheck size={15} />} testo={t("aboutPrivacyLabel", uiLang)} dettaglio={t("r2InfoPrivacyNote", uiLang)} />
          </section>
        </div>

        {/* Contatti */}
        <section className="space-y-2">
          <Titoletto>{t("r2InfoContacts", uiLang)}</Titoletto>
          {/* Server italiano · server beta · email, su tre colonne */}
          <div className="grid gap-2 sm:grid-cols-3">
            <Account avatar={AVATAR_IT} alt={t("aboutAvatarItAlt", uiLang)} server={t("aboutServerItLabel", uiLang)} coloreServer="text-amber-400" mondo="Fel Dranghyr" uiLang={uiLang} />
            <Account avatar={AVATAR_BETA} alt={t("aboutAvatarBetaAlt", uiLang)} server={t("aboutServerBetaLabel", uiLang)} coloreServer="text-sky-400" uiLang={uiLang} />
            <a href={`mailto:${EMAIL_ADDR}`} className="group flex items-center gap-2.5 border border-slate-800 bg-slate-900/60 p-2 hover:border-slate-600 hover:bg-slate-800/60">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-slate-700 text-slate-400 group-hover:text-slate-100"><AtSign size={22} aria-hidden="true" /></span>
              <span className="min-w-0 leading-tight">
                <span className="block font-bold text-slate-100">Email</span>
                <span className="block break-all text-[11px] text-emerald-400">{EMAIL_ADDR}</span>
                <span className="block text-[11px] text-slate-500">{t("r2InfoEmailNote", uiLang)}</span>
              </span>
            </a>
          </div>

          {/* Offrimi un caffè: facoltativo, solo link e immagini locali (PayPal e Satispay in tutte le lingue) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Coffee size={15} aria-hidden="true" /> {t("r2CoffeeTitle", uiLang)}
            </div>
            <p className="leading-relaxed text-slate-400">{t("r2CoffeeText", uiLang)}</p>
            {/* PayPal e Satispay affiancati, stesse dimensioni (110×132). Su PC il QR
                (clic = ingrandito), su telefono al suo posto il link equivalente. */}
            <div className="flex gap-2">
              <a href={PAYPAL_URL} target="_blank" rel="noopener noreferrer" title="paypal.me/sdrushi"
                className="flex h-[132px] w-[110px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg bg-white ring-2 ring-transparent hover:ring-sky-500">
                <img src={PAYPAL_LOGO} alt="PayPal" width={62} height={58} />
                <span className="text-[10px] font-semibold text-[#003087]">paypal.me/sdrushi</span>
              </a>
              <>
                <button type="button" onClick={() => setQrGrande(true)} title={t("r2CoffeeZoom", uiLang)}
                  className="hidden h-[132px] w-[110px] shrink-0 cursor-zoom-in rounded-lg ring-2 ring-transparent hover:ring-sky-500 sm:block">
                  <img src={SATISPAY_QR} alt={t("r2CoffeeSatispayAlt", uiLang)} width={110} height={132} />
                </button>
                <a href={SATISPAY_URL + uiLang} target="_blank" rel="noopener noreferrer"
                  className="flex h-[132px] w-[110px] shrink-0 items-center justify-center rounded-lg bg-[#ff3a00] text-lg font-bold text-white ring-2 ring-transparent hover:ring-sky-500 sm:hidden">
                  satispay
                </a>
              </>
            </div>
            {qrGrande && (
              <div className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/75 p-4" onClick={() => setQrGrande(false)} role="dialog" aria-label={t("r2CoffeeSatispayAlt", uiLang)}>
                <img src={SATISPAY_QR} alt={t("r2CoffeeSatispayAlt", uiLang)} className="max-h-[85vh] w-[340px] max-w-full" />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
