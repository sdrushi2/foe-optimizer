/**
 * Selettore della soglia di diplomazia dei Mughal (28/11/2026, proposta B scelta dall'utente):
 * nel nastro una mini barra "diplomazia / soglia" con la bolla della soglia scelta; il menu è la
 * barra dell'Ambasciata del gioco (bolle a distanza uguale, riempimento fino alla diplomazia di
 * adesso, stretta di mano col numero). Bolla verde = livello già sbloccato nel gioco (si capisce
 * dagli edifici sbloccati, vedi LIVELLI_DIPLOMAZIA), grigia col numero rosso = ancora bloccato,
 * alone dorato = soglia scelta. Immagini originali del gioco (outpost_embassy_progress_bubble*).
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { t, type UiLang } from "../../data/ui-strings";
import { formatInt } from "../../utils/format";
import { iconDiplomazia, mughalBollaAttiva, mughalBollaInattiva } from "../../assets/icons";

interface Props {
  soglie: number[];
  scelta: number;
  /** Diplomazia della mappa di adesso (pillola DIPL). */
  diplomazia: number;
  /** Per ogni soglia: livello già sbloccato nel gioco. */
  sbloccati: boolean[];
  /** Per ogni soglia: nome dell'edificio che quel livello sblocca (suggerimento della bolla). */
  nomi: string[];
  disabled?: boolean;
  /** Nastro grande (L): barra e numeri; più piccolo: solo la bolla. */
  grande: boolean;
  uiLang: UiLang;
  onScegli: (n: number) => void;
}

function Bolla({ n, attiva, scelta, px }: { n: number; attiva: boolean; scelta: boolean; px: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center bg-contain bg-center bg-no-repeat font-bold leading-none"
      style={{
        width: px, height: px, fontSize: px >= 36 ? 12 : 11, backgroundImage: `url(${attiva ? mughalBollaAttiva : mughalBollaInattiva})`,
        color: attiva ? "#fff" : "#f87171", textShadow: "0 1px 2px #000, 0 0 3px #000",
      }}>
      {formatInt(n)}
      {scelta && <span className="pointer-events-none absolute -inset-1 rounded-full border-2 border-amber-200" style={{ boxShadow: "0 0 8px #fbbf24" }} />}
    </span>
  );
}

export default function SelettoreSoglia({ soglie, scelta, diplomazia, sbloccati, nomi, disabled, grande, uiLang, onScegli }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rifPulsante = useRef<HTMLButtonElement>(null);
  const rifMenu = useRef<HTMLDivElement>(null);
  const LARGHEZZA = 620;
  useEffect(() => {
    if (!pos) return;
    const fuori = (e: MouseEvent) => {
      const n = e.target as Node;
      if (rifPulsante.current?.contains(n) || rifMenu.current?.contains(n)) return;
      setPos(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const chiudi = () => setPos(null);
    document.addEventListener("mousedown", fuori);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", chiudi);
    return () => { document.removeEventListener("mousedown", fuori); document.removeEventListener("keydown", esc); window.removeEventListener("resize", chiudi); };
  }, [pos]);
  useEffect(() => { if (disabled) setPos(null); }, [disabled]);

  const apri = () => {
    if (pos) { setPos(null); return; }
    const r = rifPulsante.current?.getBoundingClientRect();
    if (!r) return;
    const larg = Math.min(LARGHEZZA, window.innerWidth - 16);
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - larg - 8)) });
  };

  const i = soglie.indexOf(scelta);
  const sceltaSbloccata = !!sbloccati[i];
  // bolle a distanza uguale come nel gioco; il verde arriva alla diplomazia di adesso
  const posizione = (k: number) => 4 + (k * 92) / (soglie.length - 1);
  const k = soglie.findIndex((n) => n > diplomazia);
  const riempito = k === 0 ? (posizione(0) * diplomazia) / soglie[0]!
    : k < 0 ? 100
    : posizione(k - 1) + ((posizione(k) - posizione(k - 1)) * (diplomazia - soglie[k - 1]!)) / (soglie[k]! - soglie[k - 1]!);
  const stato = sceltaSbloccata ? t("mughalSogliaSbloccata", uiLang)
    : diplomazia >= scelta ? t("mughalSogliaRaggiunta", uiLang)
    : t("mughalSogliaMancano", uiLang, formatInt(scelta - diplomazia));

  return (
    <>
      <button ref={rifPulsante} type="button" onClick={apri} disabled={disabled} aria-expanded={!!pos} aria-haspopup="dialog"
        title={`${t("r2PiSogliaDiplTitle", uiLang)}: ≥ ${formatInt(scelta)} · ${stato}`}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 py-1 pl-2 pr-1 hover:border-slate-500 disabled:opacity-50">
        {grande && (
          <span className="flex flex-col gap-[3px]">
            <span className="text-left font-mono text-[11px] font-semibold text-slate-200">{formatInt(diplomazia)} / {formatInt(scelta)}</span>
            <span className="relative h-2 w-24 overflow-hidden rounded border border-[#6b4f1d] bg-[#1f2d10]">
              <span className="absolute inset-y-0 left-0 bg-[#5b9a17]" style={{ width: `${Math.min(100, (diplomazia / scelta) * 100)}%` }} />
            </span>
          </span>
        )}
        <Bolla n={scelta} attiva={sceltaSbloccata} scelta={false} px={grande ? 32 : 28} />
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${pos ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {pos && (
        <div ref={rifMenu} role="dialog" aria-label={t("r2PiSogliaDiplTitle", uiLang)}
          style={{ top: pos.top, left: pos.left, width: Math.min(LARGHEZZA, window.innerWidth - 16) }}
          className="fixed z-[60] rounded-lg border-2 border-[#b8913a] bg-[#1b0f1a] px-6 pb-3 pt-10 shadow-2xl">
          <div className="relative h-3.5 rounded-lg border-2 border-[#6b4f1d] bg-[#1f2d10]">
            <div className="absolute inset-y-0 left-0 rounded-md bg-[#5b9a17]" style={{ width: `${riempito}%` }} />
            <div className="absolute -top-[30px] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap text-[12px] font-bold text-white"
              style={{ left: `${riempito}%`, textShadow: "0 1px 2px #000" }}>
              <img src={iconDiplomazia} alt="" width={18} height={18} />{formatInt(diplomazia)}
            </div>
            {/* (28/11/2026, utente) il menu resta aperto dopo la scelta (si chiude cliccando fuori);
                i livelli già sbloccati non si scelgono (aria-disabled e non disabled: così il
                suggerimento col nome dell'edificio si vede lo stesso) */}
            {soglie.map((n, j) => (
              <button key={n} type="button" onClick={() => { if (!sbloccati[j]) onScegli(n); }}
                title={t("mughalSogliaSblocca", uiLang, nomi[j] ?? "")} aria-label={`≥ ${formatInt(n)}: ${t("mughalSogliaSblocca", uiLang, nomi[j] ?? "")}`}
                aria-pressed={n === scelta} aria-disabled={sbloccati[j] || undefined}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform ${sbloccati[j] ? "cursor-default" : "hover:scale-110"}`}
                style={{ left: `${posizione(j)}%` }}>
                <Bolla n={n} attiva={!!sbloccati[j]} scelta={n === scelta} px={40} />
              </button>
            ))}
          </div>
          <div className="mt-7 text-center text-[11.5px] text-slate-300">{t("mughalSogliaPiede", uiLang)}</div>
        </div>
      )}
    </>
  );
}
