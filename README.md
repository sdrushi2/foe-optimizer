# FoE Optimizer

A free web app for **Forge of Empires** players: building database, city imports,
weighted efficiency scoring, an inventory optimizer that calculates every buildable
combination of kits, levels, and upgrades, and an automatic **city planner** that
rearranges your buildings with as few roads as possible.

🔗 **[foe-optimizer.com](https://foe-optimizer.com)**

## Features

- **Building database** — every building in the game, with combat boosts, goods
  production, Forge Points, Quantum Incursions stats, and more.
- **City import** — import your city with the bookmarklet (FoE Helper or Forge
  Hammer) or from a JSON file, to see real, era-accurate stats instead of catalog
  defaults; export it back to JSON.
- **Inventory import** — import your inventory and let the optimizer work out every
  buildable combo, including partial upgrades and selection kits.
- **City planner** — starting from your imported city, it searches several layouts in
  parallel for the arrangement with the fewest roads, with two-lane roads, building
  chains and military buildings handled; built-in editor, PNG/JSON export
  ([overview](https://foe-optimizer.com/planner.html)).
- **Weighted efficiency scoring** — rank buildings by attack/defense weight, tile size,
  and your own priorities (PvP, GBG, Guild Expedition, Quantum Incursions).
- **Allies manager** — track owned allies and rarity, with database comparison and an
  ally advisor.
- **Pirate Settlement planner** — a dedicated building placement solver for the
  in-game Pirate Settlement map.
- **Saved cities** — your own cities, visited ones and JSON imports, all stored
  locally in your browser.
- **Light and dark theme**, Italian and English interface.
- **Installable PWA** — works offline once installed, with instant loading on repeat
  visits.

## Tech stack

- [Preact](https://preactjs.com/) (as a React drop-in) + TypeScript
- [Vite](https://vitejs.dev/) (multi-file build; game data in `public/data/`, loaded
  at startup and checked at build time)
- Tailwind CSS
- A custom service worker for offline support and cache-first loading
- Zero backend, no cookies, no analytics, no third-party scripts — everything runs
  client-side, data stays in your browser's `localStorage`

## Local development

```bash
npm install
npm run dev        # start the dev server
npm run build      # production build (outputs to dist/)
npm run typecheck  # TypeScript check, no emit
npm run lint       # ESLint
npm run knip       # unused files/exports/dependencies (informative)
```

## Deployment

Pushing to `main` triggers a GitHub Actions workflow that builds the project and
publishes it to GitHub Pages automatically — no manual build step required.

## Documentation

For a deep dive into the architecture, data flow, and every module's internals, see
[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) (in Italian).

## Privacy

FoE Optimizer has zero backend: everything runs client-side, your data never leaves
your browser. See [PRIVACY.md](PRIVACY.md) for the full policy (Italian/English).

## License

This is a free, fan-made tool for Forge of Empires. Not affiliated with InnoGames.
Forge of Empires is a trademark of InnoGames GmbH.
