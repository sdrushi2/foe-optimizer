import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Versione automatica: v1.<giorno dell'anno>
const now = new Date();
const startOfYear = new Date(now.getFullYear(), 0, 1);
const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;

// Versione VISIBILE nell'header dell'app: leggibile, stabile per giorno (es. v1.178).
const BUILD_VERSION = `v1.${dayOfYear}`;

// Versione del NOME CACHE del service worker: deve essere unica ad OGNI build,
// non solo ogni giorno, altrimenti due build nello stesso giorno avrebbero lo
// stesso nome cache e il SW non invaliderebbe la cache vecchia (gli utenti
// resterebbero su una versione obsoleta). Aggiungiamo il timestamp di build.
const SW_CACHE_VERSION = `v1.${dayOfYear}-${now.getTime()}`;
const BUILD_DATE = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

// Plugin: genera dist/sw.js dal template sw-template.js, iniettando la versione
// di build nel nome della cache. Cosi' ad ogni nuova build la cache vecchia viene
// invalidata (il SW rileva il nome cache diverso e cancella la precedente).
// Il template NON sta in public/ apposta, per non essere copiato as-is non-versionato.
// Plugin: aggiorna <lastmod> in dist/sitemap.xml con la data di build.
function sitemapPlugin(date: string): Plugin {
  return {
    name: "foe-sitemap",
    apply: "build",
    closeBundle() {
      const outPath = path.resolve(__dirname, "dist", "sitemap.xml");
      if (!fs.existsSync(outPath)) {
        this.warn("dist/sitemap.xml non trovato: lastmod non aggiornato.");
        return;
      }
      const content = fs.readFileSync(outPath, "utf-8");
      const updated = content.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}<\/lastmod>`);
      fs.writeFileSync(outPath, updated, "utf-8");
    },
  };
}

function serviceWorkerPlugin(version: string): Plugin {
  return {
    name: "foe-service-worker",
    apply: "build",
    closeBundle() {
      const templatePath = path.resolve(__dirname, "sw-template.js");
      const outPath = path.resolve(__dirname, "dist", "sw.js");
      if (!fs.existsSync(templatePath)) {
        this.warn("sw-template.js non trovato: sw.js non generato.");
        return;
      }
      const template = fs.readFileSync(templatePath, "utf-8");
      const output = template.replace(/__SW_VERSION__/g, version);
      fs.writeFileSync(outPath, output, "utf-8");
    },
  };
}

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(), // meglio come ultimo plugin
    serviceWorkerPlugin(SW_CACHE_VERSION),
    sitemapPlugin(BUILD_DATE),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Preact come drop-in replacement di React (~4KB vs ~300KB).
      // Per tornare a React, rimuovi le tre righe seguenti e npm uninstall preact.
      "react": "preact/compat",
      "react-dom": "preact/compat",
      "react-dom/client": "preact/compat/client",
    },
  },
});
