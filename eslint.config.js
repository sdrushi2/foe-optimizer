// eslint.config.js — Flat config per ESLint 9+ (testato con ESLint 10).
// Stack: TypeScript + Preact/React (JSX) + Vite, build a più file (2.0).
//
// Filosofia di questa config: rispecchia lo stesso standard già seguito a
// mano nel progetto (zero errori tsc con noUnusedLocals/noUnusedParameters,
// zero dead code). ESLint qui aggiunge principalmente: regole sui Hooks
// (che tsc non può controllare, essendo semantica React/Preact, non tipi),
// e qualche controllo di stile/sicurezza che tsc non copre.
//
// Uso: npm run lint (= eslint src, il gate della GitHub Action). Anche
// "npx eslint ." passa: copre in più gli script Node in scripts/.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";
import globals from "globals";

export default tseslint.config(
  // Cartelle da ignorare del tutto.
  {
    // planner-test/: città di prova locali (non in repo). sw-template.js ha
    // già il suo eslint-disable (è un template, non un modulo).
    ignores: ["dist/**", "node_modules/**", "planner-test/**", "*.config.js", "*.config.ts", "sw-template.js"],
  },

  // Regole base JS consigliate da eslint.
  js.configs.recommended,

  // Regole TypeScript consigliate (non "strict": tsc già fa da rete di
  // sicurezza sui tipi con noUnusedLocals/noUnusedParameters attivi;
  // qui evitiamo di duplicare quei controlli con regole più permissive
  // sull'unused, per non avere due strumenti che segnalano la stessa cosa
  // in modo diverso).
  ...tseslint.configs.recommended,

  // Regole di sicurezza (eslint-plugin-security): controlli statici su
  // pattern rischiosi come require dinamici, regex non letterali, eval,
  // ecc. Rilevante soprattutto per il codice che fa parsing di payload
  // esterni (bookmarklet, CSV) e per le funzioni che costruiscono URL.
  security.configs.recommended,

  // Configurazione specifica per i file del progetto.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        // Project service (type-aware linting): richiesto da regole che hanno
        // bisogno del type-checker, come no-floating-promises sotto. Costo di
        // performance accettabile per le dimensioni di questo progetto.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // ── React/Preact Hooks ──────────────────────────────────────────
      // Queste sono le regole che tsc non può verificare (sono semantiche
      // sull'ordine/condizionalità delle chiamate a Hook, non sui tipi).
      // Più utili da attivare qui perché un bug di dipendenze in un
      // useMemo/useCallback è esattamente il tipo di errore silenzioso
      // che è facile introdurre durante un refactor rapido.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ── Disattivate perché già garantite da tsc ──────────────────────
      // noUnusedLocals/noUnusedParameters in tsconfig.json fanno già
      // fallire la build su variabili inutilizzate; niente di nuovo da
      // ESLint qui, evitiamo solo falsi positivi su pattern come `_` per
      // parametri intenzionalmente ignorati.
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",

      // any esplicito: il progetto ne ha pochi punti deliberati (es.
      // payload grezzo del bookmarklet prima del parsing). Segnaliamo
      // come warning, non error, per non bloccare quei casi legittimi.
      "@typescript-eslint/no-explicit-any": "warn",

      // Import di tipi: tsconfig non lo forza, ma è buona norma separare
      // import di tipo da import di valore (più chiaro a colpo d'occhio,
      // e aiuta i bundler a fare tree-shaking corretto).
      "@typescript-eslint/consistent-type-imports": "warn",

      // Promise non gestite (es. una async function chiamata senza await
      // né .catch): bug silenzioso difficile da notare a revisione.
      "@typescript-eslint/no-floating-promises": "error",

      // == vs === : tsc non lo controlla, ma è un classico bug silenzioso
      // su confronti come `x == null` (voluto) vs `x == "0"` (quasi sempre
      // un errore). Permettiamo solo il pattern `== null` esplicito.
      eqeqeq: ["error", "always", { null: "ignore" }],

      // console.log lasciati per debug: warning, non error, per non
      // bloccare la build durante lo sviluppo ma ricordare di rimuoverli.
      // groupCollapsed/groupEnd/table: distinti da console.log generico,
      // usati deliberatamente per raggruppare diagnostica ricca in console
      // (es. il debug del solver Pirati) senza toccare la UI — non sono un
      // log dimenticato, quindi in whitelist come info/warn/error.
      "no-console": ["warn", { allow: ["info", "warn", "error", "groupCollapsed", "groupEnd", "table"] }],

      // Variabili shadow (es. una `id` interna che ne nasconde una esterna):
      // è esattamente il tipo di bug riscontrato in passato in questo
      // progetto durante i refactor (sostituzioni di massa che lasciano
      // variabili con lo stesso nome a scope diversi).
      "no-shadow": "off", // off di default: troppi falsi positivi con i pattern map/filter del progetto; attivare manualmente per un controllo puntuale se serve

      // ── eslint-plugin-security: disattivazioni mirate ────────────────
      // detect-object-injection segnala QUALSIASI accesso obj[key] con key
      // non letterale, indipendentemente dalla provenienza di key. Nel
      // progetto questo pattern è pervasivo e legittimo (parsing CSV con
      // colonne dinamiche, lookup per chiave calcolata su oggetti chiusi,
      // mai su prototipi globali né da input HTML/eval) — con questa
      // regola attiva genera ~165 warning su BuildingModel.ts da solo,
      // quasi tutti falsi positivi che nascondono i casi reali. Le altre
      // regole del plugin (eval, regex non sicure, require dinamici)
      // restano attive perché individuano pattern realmente rischiosi.
      "security/detect-object-injection": "off",
    },
  },

  // Script Node di supporto (scripts/: controllo dei dati per la build,
  // generatore del tema chiaro): globals di Node; le regole "fs con percorso
  // non letterale" di eslint-plugin-security non hanno senso qui (i percorsi
  // sono costruiti dallo script stesso, mai da input esterno).
  {
    files: ["scripts/**/*.{ts,js,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-object-injection": "off",
    },
  },
  // .cjs = CommonJS: require() è il modo normale di importare.
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
