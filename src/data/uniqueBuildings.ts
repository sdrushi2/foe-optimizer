import { datiGioco } from "./datiGioco";

/**
 * Elenco degli edifici "unici": edifici W_MultiAge che NON sono ottenibili
 * tramite nessun kit di selezione o di aggiornamento posseduto (quindi non
 * costruibili/potenziabili dall'inventario tramite l'ottimizzatore) — es. i
 * premi diretti di lega oro/argento degli eventi. Generato dalla pipeline
 * esterna (D:\FOE\RECUPERO DATI\unique.py) in unique.csv (2.0: public/data/): un
 * cityEntityId per riga, senza intestazione. Vedi quello script per i
 * dettagli e le eccezioni note (whitelist degli 8 id premio-lega a 2 livelli).
 *
 * Stesso pattern di caricamento di EVENTS_LIST in App.tsx: dati scaricati
 * all'avvio (2.0, data/datiGioco.ts) + parsing module-level una tantum, non un useState/useMemo.
 */
const UNIQUE_BUILDING_IDS: Set<string> = new Set(
  datiGioco().unique
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
);

/** True se cityEntityId è nell'elenco degli edifici unici (vedi sopra). */
export function isUniqueBuildingId(cityEntityId: string): boolean {
  return UNIQUE_BUILDING_IDS.has(cityEntityId);
}
