// ─────────────────────────────────────────────────────────────────────────────
//  data/setEdifici.ts — Edifici che fanno parte di un set (novembre 2026)
//
//  Dati: sezione "set" di catene.json (pipeline dati, catene.py): per ogni set
//  gli edifici e il nome nel gioco in italiano e inglese. Le tabelle degli
//  edifici mostrano un'icona nella colonna ❔ con il nome del set; i bonus del
//  set nel CSV sono quelli MASSIMI (somma di tutti i livelli di adiacenza,
//  buildings.py), ottenibili solo con gli altri edifici del set accanto.
//  Icone: quelle del gioco (/shared/icons/<setId>.png), scaricate da
//  RECUPERO DATI/icone_set.py in assets/icons/sets/<setId>.png; un set senza
//  icona mostra 🧩.
// ─────────────────────────────────────────────────────────────────────────────

import { datiGioco } from "./datiGioco";
import type { UiLang } from "./ui-strings";

interface InfoSet { edifici: string[]; nome?: { it?: string; en?: string } }

const SET = (datiGioco().catene as { set?: Record<string, InfoSet> }).set ?? {};

/** Entità → id del set. */
const SET_DI: ReadonlyMap<string, string> = new Map(
  Object.entries(SET).flatMap(([id, s]) => s.edifici.map(e => [e, id] as const)),
);

/** Icone dei set (file → url), indicizzate per id del set. */
const ICONE: ReadonlyMap<string, string> = new Map(
  Object.entries(import.meta.glob<string>("../assets/icons/sets/*.png", { eager: true, import: "default" }))
    .map(([file, url]) => [file.slice(file.lastIndexOf("/") + 1, -4), url] as const),
);

/** Set di un edificio: nome nella lingua scelta e icona del gioco (null = non fa parte di un set). */
export function setEdificio(entityId: string, lang: UiLang): { nome: string; icona: string | null } | null {
  const id = SET_DI.get(entityId);
  if (!id) return null;
  const n = SET[id]?.nome;
  return { nome: (lang === "en" ? n?.en ?? n?.it : n?.it ?? n?.en) ?? id, icona: ICONE.get(id) ?? null };
}
