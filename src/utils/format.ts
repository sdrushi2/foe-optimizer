/**
 * Funzioni pure di formattazione per numeri e stringhe.
 * Zero dipendenze esterne.
 */

/** True se il valore manca perché viene da un profilo salvato PRIMA che questo
 *  campo fosse introdotto (vecchio localStorage senza il campo) — non perché
 *  l'edificio produce 0 di quella risorsa. Distinzione: un campo "stale" è
 *  `undefined`/`null` (la chiave non esiste nell'oggetto deserializzato) o
 *  `NaN` (risultato di un'operazione aritmetica — es. una somma `general[i] +
 *  gbg[i]` — su un valore stale propagato a monte); un campo legittimamente
 *  vuoto è `0`. `Building` non ha mai `NaN` come valore di dominio reale (i
 *  parser CSV/estrattori usano sempre un fallback `|| 0`), quindi rilevarlo
 *  qui non rischia falsi positivi su dati genuini. Usare per mostrare un
 *  avviso "importa di nuovo i dati" invece di un risultato NaN/sbagliato
 *  nelle celle formattate. */
export function isStaleField(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "number" && Number.isNaN(value));
}

/** Formatta numeri interi con il separatore delle migliaia (punto) */
export function formatInt(value: number): string {
  if (value === 0) return "0";
  const abs = Math.trunc(Math.abs(value)).toString();
  const formatted = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return value < 0 ? `-${formatted}` : formatted;
}

/** Formatta l'efficienza: intero se possibile, altrimenti 1 decimale con virgola */
export function formatEff(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(".", ",");
}

/** Formatta decimali con virgola e punto delle migliaia.
 *  Gestisce correttamente i valori negativi (es. -0.5 → "-0,5", non "0,5"). */
export function formatDecimal(value: number, digits: number = 1): string {
  if (Number.isInteger(value)) return formatInt(value);
  const fixed = value.toFixed(digits);
  const [intPart, decPart] = fixed.split(".");
  const absInt = formatInt(Math.abs(Number(intPart)));
  const sign = value < 0 ? "-" : "";
  return decPart !== undefined ? `${sign}${absInt},${decPart}` : `${sign}${absInt}`;
}

/** Formatta la produzione numerica (es. Beni, FP): "-" se zero, altrimenti 1 decimale */
export function formatProdNum(value: number): string {
  if (value === 0) return "-";
  return formatDecimal(value, 1);
}

/** Formatta la produzione in percentuale (es. PFB): "-" se zero, altrimenti intero con % */
export function formatProdPercent(value: number): string {
  if (value === 0) return "-";
  const pct = Math.round(value * 100);
  return `${pct}%`;
}

/** Formatta produzioni con valori grandi (es. Monete, Materiali, CAP IQ):
 *  "-" se zero, "k" arrotondato all'intero per valori >= 1000 (es. 632750 ->
 *  "633k", non "632,8k"), altrimenti il numero con separatore delle migliaia. */
export function formatProdK(value: number): string {
  if (value === 0) return "-";
  if (value >= 1000 || value <= -1000) return `${Math.round(value / 1000)}k`;
  return formatInt(value);
}
