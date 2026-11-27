# FoE Optimizer Bridge (beta)

*Italiano: [README.md](README.md)*

A small extension, separate from FoE Optimizer. When your city changes in the game
(buildings moved, placed, sold, upgraded, items bought in the shop, allies assembled…)
it reads it from FoE Helper or Forge Hammer and passes it to the connected pages: FoE Optimizer and the
extension's **monitor**.

**Read-only.** It does not modify game functions, does not intercept traffic and sends
no requests to the game server (the only read outside the helpers is the client version,
see Debugging). It only uses the helper extension you already have,
**FoE Helper or Forge Hammer** (only one of them can be active): its internal
events `CityMapUpdated` and `InventoryUpdated` and its response handlers for
`InventoryService` and `AllyService`, then reads the city data (`MainParser` in FoE
Helper, `FH.Main` in Forge Hammer: the same data the magic wand reads). One of the two is
required.

**Visited cities** (from 0.10.0): when you visit another player's city the bridge reads the
game's answer to the visit (`OtherPlayerService.visitPlayer`, the same one FoE Helper and
Forge Hammer read) and turns it into the wand's package of a visited city (map, expansions,
name and avatar; no inventory or allies). The extension remembers the last 10 visited cities
of each world; only those you switch on in the menu go to FoE Optimizer.

## Browsers

Chrome and the other Chromium-based browsers: **Edge, Opera, Brave, Vivaldi** (`-chrome`
zip). **Firefox 140 or later, for testing** (`-firefox` zip: same code, only the manifest
changes, with an event page instead of the service worker and the Firefox id). There an
unsigned extension loads only as temporary from `about:debugging` and goes away every
time Firefox closes; check the site permissions in `about:addons` → FoE Optimizer Bridge →
Permissions. **Not Safari**: it would need a conversion with Apple's tools. Phones are
not supported. FoE Helper or Forge Hammer must be installed in the same browser.

## Installation

1. Unzip into a folder you will not move (for example `D:\FOE\foe-optimizer-bridge`).
2. Open `chrome://extensions` (Edge: `edge://extensions`, Opera: `opera://extensions`,
   Brave: `brave://extensions`, Vivaldi: `vivaldi://extensions`).
3. Turn on **Developer mode** (top right in Chrome; in Edge it is in the left column).
4. **Load unpacked** → choose the `foe-optimizer-bridge` folder.
5. That's it: game and FoE Optimizer tabs that are already open are connected
   automatically (no reload needed).

For a new version: replace the files in the folder and press ↻ on the extension card in
`chrome://extensions`. Open game and FoE Optimizer tabs are reconnected automatically.

## How it works

- **Light snapshots.** One second after the last change the game sends the magic wand
  package without the building definitions (~1 MB, a few ms).
- **Building definitions** (`CityEntities`, ~63 MB, too big for one Chrome message) are
  stored by the extension (IndexedDB, last 3 versions). Their signature is the version
  code of the game's metadata file. The game sends them only when the extension does not
  have them for that version: normally **once per game update**, a few seconds after the
  game loads. They are prepared in small slices (a few milliseconds each, less than a
  frame) when the browser is idle and sent in 2 MB parts: no noticeable freeze (one frame at
  most), it just takes a few seconds in the background. Pages receive them from the extension.
- **FoE Optimizer** shows **LIVE** (green: connected; amber: waiting for the game),
  **PAUSED** (you paused it by clicking the indicator; click again to resume) or **OFF**
  (no extension, disabled or not answering) next to the wand, and imports the city when
  you look at its tab (same import as the wand), asking for the definitions of that
  world only. It keeps them in memory while its tab is open: later imports do not ask
  for them again.
- **No duplicates.** When a game signal changes nothing (identical package) the city is
  not sent again.
- **What goes to FoE Optimizer** is decided by the switches in the menu (below): your city
  (on at the start) and the visited cities you switch on; a paused world sends nothing.
  Visited cities switched on also come from the copy stored in the extension (when the tool
  opens, when resuming from the pause, after "Delete all cities"), without visiting them again.

## The menu

Click the extension icon to open the menu: one card per world, the open ones first. The
menu is in Italian by default; the **IT | EN** switch in the header changes it (the choice
is saved). The monitor and the log stay in English.

- Each card shows the world (F, β for Beta…), the player, the server, the helper and the
  state: **LIVE** with the last update, **WAIT** or **RELOAD** with what is missing,
  **CONFLICT** when FoE Helper and Forge Hammer are both active, **ERROR** when the city
  arrives but the tool cannot import it (the helper no longer points to the definitions
  file: use the wand and send the report), **PLAY** with the last
  game for a world that is not open.
- Click a card: if the game is already open on that world its tab comes to the front,
  otherwise the game opens on that world. Before the first game there is no card (the
  extension cannot know your server and language), only a short note.
- On a world that is not open, the ✕ that appears on hover deletes that world and its data
  from the extension at once: the menu entry and the building definitions no other world
  uses (definitions are per game version: two live worlds usually share them, the Beta
  does not). With the last world all of them go: clicking every ✕ leaves the extension
  empty as just installed. The cities in FoE Optimizer stay (you delete them in the tool).
  The world comes back by itself when you play it again, and the game sends the
  definitions once more, in the background. Open worlds have no ✕: their tab
  keeps them in the menu.
- **LIVE / PAUSED** on the right of the card: pauses (or resumes) the whole world. While
  paused none of its cities goes to FoE Optimizer; the switches stay as they are and, when
  resuming, the cities switched on come back at once.
- **Your city**, with its switch: on at the start, it can be paused.
- **Visited cities**: the last 10 of each world, most recent first, with avatar and "visited
  … ago"; the **green dot** marks the one you are visiting now. The switch (off at the
  start) brings it to FoE Optimizer at once and keeps it updated at every visit; switched
  off, it stays in FoE Optimizer as it is. From the eleventh visit on, the oldest one
  switched off goes (those switched on always stay). The ✕ (on hover, with a confirmation
  in the row) removes it from the extension only: it stays in FoE Optimizer.
- **The number on the icon** is how many cities the extension remembers (yours and
  visited, all worlds): 1 to 9, then "9+"; with no city there is none.
- **Open FoE Optimizer ↗**: brings the tool tab used last to the front (online or on
  localhost), otherwise opens the site. **Monitor**: the test page.

## Debugging

The menu shows, on the card of every open game tab, whether the bridge runs there, which
helper it uses and when the city was last updated (or what is missing: "reload the game",
"waiting for FoE Helper or Forge Hammer"…).

**Monitor** (debug, in English) shows:

- **Game tabs**: world, helper and its version, version of the bridge script in the tab
  (red if different from the extension: reload the game), active map, last snapshot
  (reason, preparation time), last status;
- connected pages (FoE Optimizer, monitor);
- **Stored definitions** (signature, game version, size, date). The client version (for
  example 1.348.aac04d6, the one written when the game starts) is not in the helpers: it
  is read from the game script already loaded, from the browser's cached copy, once per
  version. If that copy is gone, the browser downloads the same file again from
  InnoGames' CDN (the game's static files), never from the game server. Finding the
  version in the file takes a few milliseconds. It goes with the definitions the game uses: it
  is added to those stored before too, and when a client update keeps the same definitions
  both show (for example `game 1.348.aac04d6 / 1.349.…`). It also shows under the world in
  **Game tabs**;
- **Cities received**, with the list of changes at every package;
- the **log** (lines starting with "·" are steps of the extension; repeated lines
  become one line with "×N").

**Copy debug report** copies all of this as text (versions, browser, game tabs, stored
definitions, worlds, cities, log) to paste into a bug report.

## Test with the monitor

1. Open the game with FoE Helper or Forge Hammer active and wait for the city to load.
2. Click the extension icon, then **Monitor**: the **monitor** opens.
3. Your city appears (name, server, number of buildings).
4. Move, place, sell or upgrade a building in the game: after about a second the monitor
   shows the new package and the list of changes.
5. Go back to the FoE Optimizer tab: after about 2 seconds the city is up to date.
6. **Clear stored definitions** lets you see the first load again (the cities shown go too and come back at once with a fresh snapshot); **Clear log** empties the log.

## Special cases

- **FoE Helper and Forge Hammer active together**: they can never work together (both
  install their own proxy on the game's requests; Forge Hammer warns and stops). The
  bridge then sends nothing and the menu and the monitor say so: disable one in
  `chrome://extensions` and reload the game.
- **Switching helper** during a session (disable one, enable the other, reload the
  game): the bridge hooks to the active one; the stored definitions stay valid.
- **Outposts, Quantum Incursions, GBG**: the bridge reads your main city and the cities
  you visit; the other maps do not go through it.
- **Several accounts on the same world**: each has its own row under "Your city",
  recognised by the player id.
- **Several worlds open** (for example beta and live): each tab sends its own city;
  FoE Optimizer keeps them apart.
- **Other pages on localhost** (another project in development): the extension enters them
  too but stays silent until the page introduces itself as FoE Optimizer: pages that do not
  introduce themselves get no cities, names or definitions. It is not an access control (a
  local page introducing itself on purpose would get everything): it only keeps the other
  pages from getting them unknowingly.
- **Incognito windows**: the extension works there only if you allow it
  (`chrome://extensions` → Details → Allow in Incognito).
- **Game update**: the building definitions get a new signature and are asked to the
  game once more, in the background; the last 3 versions are kept.

Lines starting with "·" in the monitor log describe every step of the extension.

## Files

- `game-main.js` – in the game page, next to FoE Helper or Forge Hammer: reads and builds the package.
- `game-relay.js` – passes messages between the game page and the extension.
- `background.js` – forwards packages, stores the definitions, the switches, the last
  visited cities and the number on the icon.
- `tool.js` – on the FoE Optimizer page: presence signal, packages via `postMessage`.
- `popup.html` / `popup.js` – the menu opened by the extension icon (Italian and English).
- `monitor.html` / `monitor.js` – test page.
- `_locales/` – the extension description in Italian and English (`chrome://extensions`
  shows it in the browser's language, in Italian for languages other than English).
- `icons/` – the FoE Optimizer icon (16, 32, 48, 128 px).
- `README.md` (Italian) / `README.en.md` (English) – this guide.
- `istruzioni.txt` – short instructions for beta testers (Italian).
