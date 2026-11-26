# FoE Optimizer Bridge — pubblicazione

Sorgente dell'estensione in `foe-bridge/` (istruzioni d'uso: `foe-bridge/README.md`).

## Creare i pacchetti

```
py estensione/build.py
```

Gli zip finiscono in `estensione/build/` (non va in git):

- `foe-optimizer-bridge-<ver>-store.zip` → Chrome Web Store
- `foe-optimizer-bridge-<ver>-amo.zip` → addons.mozilla.org (Firefox)

Per provare l'estensione mentre la sviluppi non serve uno zip: in Chrome
(`chrome://extensions`, modalità sviluppatore) "Carica estensione non pacchettizzata" e scegli
la cartella `foe-bridge/`. Quella versione accede anche al sito su localhost.

## Pubblicare un aggiornamento

1. Alza `version` (e `version_name`) in `foe-bridge/manifest.json`: gli store rifiutano un
   numero uguale o più basso.
2. `py estensione/build.py`.
3. Chrome: Dashboard per sviluppatori › Pacchetto › Carica nuovo pacchetto (`-store.zip`),
   poi Invia per la revisione.
4. Firefox: addons.mozilla.org › Nuova versione (`-amo.zip`); codice sorgente: No.
5. Non cambiare l'id gecko `bridge@foe-optimizer.com` ed evita permessi nuovi (revisione
   più lunga, estensione disattivata finché l'utente non li accetta).

Privacy: https://foe-optimizer.com/privacy-bridge.html (`public/privacy-bridge.html`).
Immagini delle schede in `store/`.
