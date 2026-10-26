// ─────────────────────────────────────────────────────────────────────────────
//  ui/theme.ts — Tema chiaro / scuro (FoE Optimizer 2.0)
//
//  Il tema è l'attributo data-theme su <html>: "dark" (predefinito, l'aspetto
//  di sempre) o "light". Il tema chiaro sta tutto in CSS (theme-light.css,
//  generato da scripts/genera-tema-chiaro.cjs, + poche variabili in
//  index.css): qui solo la scelta, salvata nel browser.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from "react";

export type Tema = "dark" | "light";
const CHIAVE = "foe2-tema";

function leggiTema(): Tema {
  try {
    return localStorage.getItem(CHIAVE) === "light" ? "light" : "dark";
  } catch {
    return "dark"; // storage non disponibile
  }
}

/** Applica il tema a <html>: da chiamare prima del primo render (niente lampo scuro→chiaro). */
export function applicaTemaSalvato(): void {
  document.documentElement.dataset.theme = leggiTema();
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setStato] = useState<Tema>(leggiTema);
  const setTema = useCallback((t: Tema) => {
    setStato(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(CHIAVE, t); } catch { /* storage non disponibile */ }
  }, []);
  return [tema, setTema];
}
