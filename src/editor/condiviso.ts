// ─────────────────────────────────────────────────────────────────────────────
//  editor/condiviso.ts — Codice del tool usato anche dall'editor esterno
//
//  public/editor.html è una pagina statica: per usare lo STESSO codice del
//  tool (export PNG, palette della vista MAPPA) carica /editor-condiviso.js,
//  che è questo file compilato:
//   - in sviluppo (npm run dev) /editor-condiviso.js viene rediretto a questo
//     sorgente, che Vite compila al volo;
//   - nella build (npm run build) viene compilato in dist/editor-condiviso.js
//     (plugin editorCondivisoPlugin in vite.config.ts).
//  Così una modifica all'export PNG del tool vale anche per l'editor.
//  27/11/2026: anche "Importa JSON" e "Salva JSON" dell'editor passano da qui:
//  stesso lettore del tool (leggiCitta, data/cityMapJson.ts), stessi messaggi
//  d'errore (data/erroriJson.ts), stesso formato dell'export della Mappa.
// ─────────────────────────────────────────────────────────────────────────────

import { coloreEdificioMappa, renderCityMapPng } from "../components/cityMapPng";
import { caricaBuildingsExtra, caricaDatiGioco } from "../data/datiGioco";
import { prefissoFile } from "../utils/format";

/** Lingua del tool per l'editor aperto da solo (dal tool la lingua arriva nel
 *  messaggio "carica"): la scelta salvata dal tool (chiave UI_LANG_KEY di
 *  utils/storage.ts, `foe_global_ui_lang_v<N>`: cercata per prefisso per non
 *  importare storage.ts, che porterebbe con sé pako) e, se manca, la lingua
 *  del browser, come detectBrowserUiLang in App.tsx. */
function linguaUi(): "it" | "en" {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("foe_global_ui_lang_")) continue;
      const l = localStorage.getItem(k);
      if (l === "it" || l === "en") return l;
    }
  } catch { /* localStorage inaccessibile */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some(l => l?.toLowerCase().startsWith("it")) ? "it" : "en";
}

/** Lettore e scrittore dei JSON (editor/lettura.ts), caricati a richiesta: i loro
 *  moduli (ere, catalogo) leggono i dati del gioco appena caricati, quindi prima
 *  si scaricano i dati (come main.tsx prima dell'app), poi si importa il codice. */
async function lettura() {
  await caricaDatiGioco();
  const m = await import("./lettura");
  m.impostaCatalogoExtra(await caricaBuildingsExtra());
  return m;
}
/** Importa JSON dell'editor: vedi editor/lettura.ts. */
async function leggiJson(testo: string, lang: "it" | "en") {
  return (await lettura()).leggiJson(testo, lang);
}
/** Salva JSON dell'editor: vedi editor/lettura.ts. */
async function jsonDaSalvare(json: unknown, meta: { player?: { id: number | null; name: string }; currentEra?: string; avatar?: string }, nome?: string | null) {
  return (await lettura()).jsonDaSalvare(json, meta, nome);
}

const condiviso = { coloreEdificioMappa, renderCityMapPng, linguaUi, leggiJson, jsonDaSalvare, prefissoFile };

declare global {
  interface Window { FoeCondiviso?: typeof condiviso }
}

window.FoeCondiviso = condiviso;
