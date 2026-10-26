// ─────────────────────────────────────────────────────────────────────────────
//  ui/FiltriAlleati.tsx — Rarità degli alleati nel nastro (2.0)
//
//  Gruppo Visualizza del catalogo Alleati (Database) e della scheda Alleati:
//  le 5 rarità come pulsanti colorati (colori di RARITY_DISPLAY), accesi =
//  mostrate. I filtri Militari / Scienza / Frammenti sono pulsanti
//  normali del nastro (ui/nastri.tsx).
// ─────────────────────────────────────────────────────────────────────────────

export interface VoceRarita { id: number; etichetta: string; titolo: string; attiva: boolean; classiOn: string; classiOff: string; cambia: () => void }

export interface StatoAlleati {
  rarita: VoceRarita[];
  /** Tipi mostrati (accesi = mostrati; spenti entrambi = nessun alleato). */
  militari: boolean;
  cambiaMilitari: () => void;
  scienza: boolean;
  cambiaScienza: () => void;
  /** Solo scheda Alleati: alleati frammentati mostrati (acceso) o nascosti. */
  frammenti?: { attivo: boolean; cambia: () => void };
  /** Solo scheda Alleati: quanti alleati hai per pulsante, es. "Militari (32)". */
  conteggi?: { militari: number; scienza: number; frammenti: number };
}

export function BloccoRarita({ rarita }: { rarita: VoceRarita[] }) {
  return (
    <div className="grid grid-flow-col grid-rows-3 gap-x-1 gap-y-[3px]">
      {rarita.map(r => (
        <button key={r.id} type="button" onClick={r.cambia} title={r.titolo} aria-pressed={r.attiva}
          className={`flex h-[22px] min-w-[44px] items-center justify-center rounded-md border px-1.5 text-[10px] font-bold uppercase ${r.attiva ? r.classiOn : r.classiOff}`}>
          {r.etichetta}
        </button>
      ))}
    </div>
  );
}
