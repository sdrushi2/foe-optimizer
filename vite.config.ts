import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build, defineConfig, type Plugin } from "vite";
import { manifestDati, verificaDati } from "./scripts/dati-pubblici.ts";

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
      const updated = content.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${date}<\/lastmod>`);
      fs.writeFileSync(outPath, updated, "utf-8");
    },
  };
}

// Plugin (2.0): dati di gioco in public/data/ (vedi src/data/datiGioco.ts e
// scripts/dati-pubblici.ts).
// - build: prima di tutto controlla i dati (un file malformato ferma la build,
//   come nella 1.x quando i dati erano nel bundle); alla fine scrive
//   dist/data/manifest.json con l'hash di ogni file;
// - dev: /data/manifest.json calcolato al volo a ogni richiesta.
const DIR_DATI = path.resolve(__dirname, "public", "data");
function datiPlugin(): Plugin {
  return {
    name: "foe-dati",
    buildStart() {
      if (process.env.FOE_EDITOR_BUILD) return;
      const errori = verificaDati(DIR_DATI);
      if (errori.length) this.error(`Dati di gioco non validi (public/data):\n  - ${errori.join("\n  - ")}`);
    },
    configureServer(server) {
      server.middlewares.use("/data/manifest.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.end(JSON.stringify(manifestDati(DIR_DATI)));
      });
    },
    // Il codice dell'app (avvio.tsx) si esegue solo dopo i dati, ma si può
    // SCARICARE subito, in parallelo: modulepreload in index.html.
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const chunk = Object.values(ctx.bundle ?? {}).find(c => c.type === "chunk" && c.facadeModuleId?.endsWith("/src/avvio.tsx"));
        return chunk ? [{ tag: "link", attrs: { rel: "modulepreload", crossorigin: true, href: `/${chunk.fileName}` }, injectTo: "head" }] : [];
      },
    },
    closeBundle() {
      if (process.env.FOE_EDITOR_BUILD) return;
      const out = path.resolve(__dirname, "dist", "data", "manifest.json");
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(manifestDati(DIR_DATI)), "utf-8");
    },
  };
}

// Elenco dei file da mettere in cache all'installazione del service worker
// (2.0, build a più file): tutto dist/assets/ (codice e stile con hash, anche
// i pezzi caricati a richiesta come il Planner) e i dati con il loro ?v=hash.
// Senza, la prima visita non resterebbe usabile offline: la prima pagina non
// passa dal service worker, che quindi non vedrebbe quei file.
function filePrecache(): string[] {
  const dirAssets = path.resolve(__dirname, "dist", "assets");
  const assets = fs.existsSync(dirAssets) ? fs.readdirSync(dirAssets).map(f => `/assets/${f}`) : [];
  const { file } = manifestDati(DIR_DATI);
  const dati = Object.entries(file).map(([f, h]) => `/data/${f}?v=${h}`);
  return [...assets, "/data/manifest.json", ...dati];
}

function serviceWorkerPlugin(version: string): Plugin {
  return {
    name: "foe-service-worker",
    apply: "build",
    closeBundle() {
      if (process.env.FOE_EDITOR_BUILD) return;
      const templatePath = path.resolve(__dirname, "sw-template.js");
      const outPath = path.resolve(__dirname, "dist", "sw.js");
      if (!fs.existsSync(templatePath)) {
        this.warn("sw-template.js non trovato: sw.js non generato.");
        return;
      }
      const template = fs.readFileSync(templatePath, "utf-8");
      const output = template
        .replace(/__SW_VERSION__/g, version)
        .replace('"__SW_PRECACHE__"', JSON.stringify(filePrecache()).slice(1, -1));
      fs.writeFileSync(outPath, output, "utf-8");
    },
  };
}

// Plugin: codice del tool condiviso con l'editor esterno (public/editor.html).
// L'editor carica /editor-condiviso.js = src/editor/condiviso.ts compilato
// (export PNG e palette della vista MAPPA: UN SOLO codice per tool ed editor).
// - dev: /editor-condiviso.js è rediretto al sorgente, compilato da Vite al volo;
// - build: compilato a parte (libreria ES, un solo file) in dist/editor-condiviso.js.
function editorCondivisoPlugin(): Plugin {
  const entry = path.resolve(__dirname, "src/editor/condiviso.ts");
  let outDir = path.resolve(__dirname, "dist");
  return {
    name: "foe-editor-condiviso",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use("/editor-condiviso.js", (_req, res) => {
        res.statusCode = 302;
        res.setHeader("Location", "/src/editor/condiviso.ts");
        res.end();
      });
    },
    async closeBundle() {
      if (process.env.FOE_EDITOR_BUILD) return; // nessuna ricorsione
      process.env.FOE_EDITOR_BUILD = "1";
      try {
        await build({
          configFile: false,
          logLevel: "warn",
          build: {
            outDir,
            emptyOutDir: false,
            copyPublicDir: false,
            lib: { entry, formats: ["es"], fileName: () => "editor-condiviso.js" },
          },
        });
      } finally {
        delete process.env.FOE_EDITOR_BUILD;
      }
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
    datiPlugin(),
    serviceWorkerPlugin(SW_CACHE_VERSION),
    sitemapPlugin(BUILD_DATE),
    editorCondivisoPlugin(),
  ],
  // 2.0: il codice principale (App) supera i 500 kB minificati; il Planner
  // è già un pezzo a parte. Soglia dell'avviso alzata di conseguenza.
  build: { chunkSizeWarningLimit: 900 },
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
