// Genera src/theme-light.css (tema chiaro di FoE Optimizer 2.0).
// Uso: node scripts/genera-tema-chiaro.cjs
// Legge le scale di colore di Tailwind e, sotto :root[data-theme="light"],
// assegna a ogni sfumatura il valore della sfumatura "speculare"
// (50↔950, 100↔900, …, 500 fissa; 300/400 più scuri, vedi sotto): il tema scuro attuale diventa chiaro
// senza toccare le classi. "white" diventa quasi nero (testi bianchi).
const fs = require("fs");
const path = require("path");

const tema = fs.readFileSync(path.join(__dirname, "../node_modules/tailwindcss/theme.css"), "utf8");
const scale = {};
for (const m of tema.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) (scale[m[1]] ??= {})[m[2]] = m[3].trim();

// 300 e 400 si usano quasi solo per i TESTI (text-slate-300, text-amber-400…):
// nel tema chiaro vanno uno scalino più scuri del semplice specchio
// (300→800, 400→700 invece di 700/600), altrimenti su sfondo bianco restano
// pallidi e poco leggibili (segnalazione dell'utente, ottobre 2026).
const specchio = { 50: 950, 100: 900, 200: 800, 300: 800, 400: 700, 500: 500, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 };
const palette = ["slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];

let out = `/* ============================================================
   TEMA CHIARO (FoE Optimizer 2.0) — GENERATO, non modificare a mano.
   Inverte ogni scala di colore di Tailwind (50↔950, 100↔900, …, 500
   fisso): gli sfondi scuri diventano chiari, i testi chiari diventano
   scuri, e i colori "tinta" (bg-amber-950/40, text-amber-300…) restano
   leggibili. Così tutte le tabelle e i pannelli esistenti hanno il tema
   chiaro senza riscrivere le classi. "white" diventa quasi nero (testi
   bianchi su sfondi scuri). Rigenerare con scripts/genera-tema-chiaro.cjs.
   ============================================================ */
:root[data-theme="light"] {
  color-scheme: light;
`;
for (const p of palette) {
  const s = scale[p];
  if (!s) continue;
  for (const k of Object.keys(s)) if (s[specchio[k]]) out += `  --color-${p}-${k}: ${s[specchio[k]]};\n`;
}
out += `  --color-white: ${scale.slate[900]};\n}\n`;
fs.writeFileSync(path.join(__dirname, "../src/theme-light.css"), out);
console.log("src/theme-light.css scritto");
