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

/** Formatta numeri interi con il separatore delle migliaia (punto).
 *  La regex genera un warning `security/detect-unsafe-regex` di eslint: è uno
 *  dei 2 FALSI POSITIVI ACCETTATI del progetto (l'input è sempre una stringa
 *  di sole cifre prodotta da toString su un numero, lunghezza limitata —
 *  nessun input utente, nessun rischio ReDoS). Non "correggerlo". */
export function formatInt(value: number): string {
  if (value === 0) return "0";
  const abs = Math.trunc(Math.abs(value)).toString();
  // eslint-disable-next-line security/detect-unsafe-regex -- input sempre una stringa di sole cifre (Math.trunc(Math.abs(value)).toString()), lunghezza limitata: nessun rischio ReDoS reale.
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

/** Data LOCALE nel formato AAAA-MM-GG, per i nomi dei file esportati. Non
 *  `toISOString().slice(0, 10)`, che dà la data UTC: tra mezzanotte e l'1-2 di
 *  notte ora italiana il file prendeva la data del giorno prima (corretto
 *  settembre 2026). */
export function localDateStamp(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Prefisso dei file esportati dal nome del giocatore (2.0): minuscolo, solo
 *  lettere/cifre/`_`/`-` (accenti tolti, il resto diventa `-`).
 *  Es. "Sdrushi" → "sdrushi"; senza nome → "foe". */
export function prefissoFile(nome: string | null | undefined): string {
  const s = (nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s || "foe";
}

/** Formatta produzioni con valori grandi (es. Monete, Materiali, Medaglie, CAP IQ):
 *  "-" se zero, "M" con un decimale da un milione (10279000 -> "10,3M"), "k"
 *  arrotondato all'intero per valori >= 1000 (es. 632750 -> "633k", non
 *  "632,8k"), altrimenti il numero con separatore delle migliaia. */
/** Valori militari come nel gioco (novembre 2026, utente): da 1000 in su in
 *  migliaia con una cifra decimale ("36,7k", senza ",0"), sotto interi. */
export function formatMilK(value: number): string {
  if (Math.abs(Math.round(value / 100)) >= 10) {
    const k = Math.round(value / 100) / 10;
    return `${Number.isInteger(k) ? k : k.toFixed(1).replace(".", ",")}k`;
  }
  return formatInt(value);
}

export function formatProdK(value: number): string {
  if (value === 0) return "-";
  // Milioni (novembre 2026, utente): "10,3M" invece di "10279k", una cifra
  // decimale con la virgola come formatEff, senza ",0" ("1M"), senza spazio
  // prima di k/M (provato e scartato dall'utente). Soglia sul
  // valore già arrotondato a migliaia, così 999.600 diventa "1M" e non "1000k".
  if (Math.abs(Math.round(value / 1000)) >= 1000) {
    const m = Math.round(value / 100_000) / 10;
    return `${Number.isInteger(m) ? m : m.toFixed(1).replace(".", ",")}M`;
  }
  if (value >= 1000 || value <= -1000) return `${Math.round(value / 1000)}k`;
  return formatInt(value);
}
