import type { Building } from "../data/buildings";

export interface Weights {
  general: [number, number, number, number];
  gbg: [number, number, number, number];
  sped: [number, number, number, number];
  iq: [number, number, number, number];
}

/** Prodotto scalare di due quadruple (Att/Att, Dif/Att, Att/Dif, Dif/Dif). */
function dot4(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

/**
 * Punteggio di efficienza di un edificio: valore militare pesato per unità di
 * spazio occupato. Formula: (Σ bonus·pesi su general+gbg+sped+iq) / (area + road),
 * arrotondato a 1 decimale. Restituisce 0 se lo spazio totale è ≤ 0 (es. edifici
 * senza footprint), evitando una divisione per zero.
 */
export function calculateEfficiency(building: Building, weights: Weights): number {
  const area = building.area;
  const totalSpace = area + (building.road || 0);
  if (totalSpace <= 0) return 0;

  const totalStats =
    dot4(building.general, weights.general) +
    dot4(building.gbg, weights.gbg) +
    dot4(building.sped, weights.sped) +
    dot4(building.iq, weights.iq);

  const raw = totalStats / totalSpace;
  const rounded = Math.round(raw * 10) / 10;
  return rounded;
}

/** (10/11/2026) Tipo di efficienza della colonna EFF (menu sopra la tabella). */
export type TipoEff = "mil" | "beni" | "pf" | "benig";

/**
 * Efficienza di produzione: come calculateEfficiency ma col numeratore della
 * produzione scelta, al giorno: beni (era attuale + precedente + successiva),
 * Punti Forge o beni di gilda. I boost % (BeniB, FPB) contano come beni / PF
 * veri sulla produzione di base della città (`base`, 0 senza città: Database).
 */
export function calculateProductionEfficiency(
  b: Building, tipo: Exclude<TipoEff, "mil">, base: { beni: number; pf: number }
): number {
  const totalSpace = b.area + (b.road || 0);
  if (totalSpace <= 0) return 0;
  const num = tipo === "beni" ? b.beni + b.benip + b.benis + (b.benib || 0) * base.beni
    : tipo === "pf" ? b.fp + (b.fpb || 0) * base.pf
    : b.benig;
  return Math.round((num / totalSpace) * 10) / 10;
}
