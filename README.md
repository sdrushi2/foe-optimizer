# FoE Optimizer

A free web app for **Forge of Empires** players: building database, real-time city
imports, weighted efficiency scoring, and an inventory optimizer that calculates every
buildable combination of kits, levels, and upgrades.

🔗 **[foe-optimizer.com](https://foe-optimizer.com)**

## Features

- **Building database** — every building in the game, with combat boosts, goods
  production, Forge Points, Quantum Incursions stats, and more.
- **City import** — paste your city's live data (via a bookmarklet) to see real,
  era-accurate stats instead of catalog defaults.
- **Inventory import** — import your inventory and let the optimizer work out every
  buildable combo, including partial upgrades and selection kits.
- **Weighted efficiency scoring** — rank buildings by attack/defense weight, tile size,
  and your own priorities (PvP, GBG, Guild Expedition, Quantum Incursions).
- **Allies manager** — track owned allies and rarity, with database comparison.
- **Multiple profiles** — keep separate setups for different cities or strategies, all
  stored locally in your browser.
- **Installable PWA** — works offline once installed, with instant loading on repeat
  visits.

## Tech stack

- [Preact](https://preactjs.com/) (as a React drop-in) + TypeScript
- [Vite](https://vitejs.dev/) with [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)
  (the entire app builds to one self-contained `index.html`)
- Tailwind CSS
- A custom service worker for offline support and cache-first loading
- Zero backend — everything runs client-side, data stays in your browser's
  `localStorage`

## Local development

```bash
npm install
npm run dev        # start the dev server
npm run build      # production build (outputs to dist/)
npm run typecheck  # TypeScript check, no emit
npm run lint       # ESLint
```

## Deployment

Pushing to `main` triggers a GitHub Actions workflow that builds the project and
publishes it to GitHub Pages automatically — no manual build step required.

## License

This is a free, fan-made tool for Forge of Empires. Not affiliated with InnoGames.
