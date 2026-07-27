import uniqueCsv from "../assets/unique.csv?raw";

/**
 * Elenco degli edifici "unici": edifici W_MultiAge che NON sono ottenibili
 * tramite nessun kit di selezione o di aggiornamento posseduto (quindi non
 * costruibili/potenziabili dall'inventario tramite l'ottimizzatore) — es. i
 * premi diretti di lega oro/argento degli eventi. Generato dalla pipeline
 * esterna (D:\FOE\RECUPERO DATI\unique.py) in src/assets/unique.csv: un
 * cityEntityId per riga, senza intestazione. Vedi quello script per i
 * dettagli e le eccezioni note (whitelist degli 8 id premio-lega a 2 livelli).
 *
 * Stesso pattern di caricamento di EVENTS_LIST in App.tsx: import statico
 * Vite `?raw` (compatibile con vite-plugin-singlefile, niente fetch a
 * runtime) + parsing module-level una tantum, non un useState/useMemo.
 */
export const UNIQUE_BUILDING_IDS: Set<string> = new Set(
  uniqueCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
);

/** True se cityEntityId è nell'elenco degli edifici unici (vedi sopra). */
export function isUniqueBuildingId(cityEntityId: string): boolean {
  return UNIQUE_BUILDING_IDS.has(cityEntityId);
}
