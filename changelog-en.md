# FoE Optimizer Changelog

## Version 2.031 (28/11/2026)
### New
- Settlements › Mughals, Optimize diplomacy: choose the level to unlock in the Embassy bar, like in the game, and the tool finds the quickest way to get there. It removes as few large buildings as possible, does as little work as possible and only builds Water Canals and Alleys, counting the chain bonuses too

### Update
- Settlements › Mughals, Optimize: it works like in the Planner (Optimize, Pause, resumes where it was) and shows every solution found. It never suggests more roads than you can buy or solutions that produce less than now
- Settlements › Mughals: new Lock the Embassy option, on by default, so the optimizers don't move it
- Settlements: Reset brings the settlement back to how it is in the game (from the extension or the last import) instead of the empty scenario
- FoE Optimizer Bridge extension: the visited cities switched on in the extension arrive in any tab of the tool, without changing the selected city

### Bug Fixes
- Settlements with the FoE Optimizer Bridge extension: after reloading the page the settlement started from the empty layout. Now it is imported right away

---

## Version 2.030 (27/11/2026)
### New
- The FoE Optimizer Bridge extension is on the Chrome Web Store (also for Edge, Brave and Opera, Firefox coming soon): it brings your city here by itself while you play. If you don't have it, the OFF indicator next to the wand explains what it does and where to install it
- City menu: each city can be downloaded as JSON, complete or map only, and all cities can be deleted at once
- Database › Tools › Editor: opens the empty city editor, with Import JSON and Save JSON
- Import from JSON recognises the complete city, with inventory and allies

### Update
- FoE Optimizer Bridge extension 0.10: the visited cities you switch on in the extension menu arrive too
- Settlements › Mughals, Optimize: it also uses Chhatri, Baldachin and Chahar Bagh when unlocked
- Options › Backup: Export backup and Restore backup save and restore everything, cities and settings
- Downloaded files start with the city name and the JSON files include avatar and world

### Bug Fixes
- Fixes to importing JSON files in the Planner and to the Map JSON

---

## Version 2.029 (26/11/2026)
### New
- Settlements › Mughals: comparison between the game map and the new one, with a summary of what to remove, move and build
- Settlements: total diplomacy next to POP
- Allies: View group to hide columns, and Sum goods like in the building tables

### Update
- FoE Optimizer Bridge extension: switching back to LIVE after a pause reimports everything

---

## Version 2.028 (25/11/2026)
### New
- Settlements: new Mughal settlement, with import, expansions, unlocked buildings and Rupees
- Settlements › Mughals: Optimize (first version) looks for the layout with the most rupees and the fewest roads
- Settlements: with the FoE Optimizer Bridge extension the settlement updates by itself while you play
- Settlements: the building legend is a table with size, population, diplomacy and currency

### Update
- On phones and tablets the wand no longer appears, since it can't work there

---

## Version 2.027 (24/11/2026)
### New
- FoE Optimizer Bridge, first version of the extension that links the game to the tool: your city updates by itself at every change, without the wand. Next to the wand the LIVE / PAUSED / OFF indicator

---

## Version 2.026 (23/11/2026)
### Update
- GB Calculator: favourite Great Buildings per world (with your imported cities), short name and spots to include in the text to copy, editable text and GOLD 50% chat
- Planner: video tutorial in English too

### Bug Fixes
- Planner, Connectors: with small cities in a large area the search didn't start

---

## Version 2.025 (22/11/2026)
### Update
- Database, City and Inventory: GB Calc. button in the Tools group

---

## Version 2.024 (21/11/2026)
### Update
- Planner: better scenarios with two-lane roads (Connectors and Pinwheel), fewer roads and fewer buildings left out in large cities
- Planner: warning and switches for chain links detached from their chains, and Smooth also moves links between chains
- The site opens faster, especially on phones

### Bug Fixes
- Planner: after changing the chains in the editor the search didn't restart

---

## Version 2.023 (20/11/2026)
### New
- Database: Era selector, to see buildings with the values of any era

### Update
- Building tables: the page opens and responds much faster

---

## Version 2.022 (19/11/2026)
### Update
- Planner: list of the buildings not placed yet
- City menu: bar showing the browser space used

### Bug Fixes
- Planner: much faster start in cities with many identical small buildings, and better two-lane roads
- Wand: a neighbour's city not yet loaded by FoE Helper is no longer saved empty

---

## Version 2.021 (18/11/2026)
### Update
- Building tables: Sum goods merges the goods of the three eras into one column
- Planner: "vertical comb" for cities with many horizontal buildings, with many fewer roads

### Bug Fixes
- Planner: no more 2×2 squares of roads, and roads on the map edge are avoided

---

## Version 2.020 (17/11/2026)
### Update
- Planner: faster completion and Smooth, and fewer scattered holes after COMPLETE

### Bug Fixes
- Planner: the Hippodrome has both heads connected to the road

---

## Version 2.019 (16/11/2026)
### Update
- City and Inventory: "Buildings shown" counts every copy

---

## Version 2.018 (15/11/2026)
### Bug Fixes
- Planner: at completion large buildings are no longer left out when there is enough space

---

## Version 2.016 (13/11/2026)
### New
- City, Inventory and Database: icon and filter for buildings that can be made from fragments produced by other buildings

---

## Version 2.014 (11/11/2026)
### New
- Planner, Edit city: table of what changes in area, roads, population, military values and production
- GB Calculator: GB progress bar like in the game

### Bug Fixes
- After an update the page could stay blank: now the tool repairs itself

---

## Version 2.013 (10/11/2026)
### New
- City, Inventory and Database: the EFF column can measure military, goods, Forge Points or guild goods per tile
- New Coin boost, Supply boost and Medal boost columns
- "Downgradable" becomes "Ageable", with the filter in the Inventory too

### Bug Fixes
- Science allies: FP and goods are those of their level

---

## Version 2.012 (09/11/2026)
### New
- Planner: switches for buildings disconnected in the city, and automatic Smooth when the optimizer stops
- GB Calculator: FP already invested and spots at risk, like in FoE Helper
- Buildings disconnected from the road no longer count in military values and production

---

## Version 2.011 (08/11/2026)
### New
- New wand (needs to be recreated): it imports the Castle level, which counts in production and military values
- City: Era and Era goods filters
- City › Statistics › Production: goods split by era and detail of who produces what

---

## Version 2.010 (07/11/2026)
### New
- Inventory: Era and Era goods filters
- Great Buildings: report with bonuses, costs and unlock cost level by level

---

## Version 2.009 (06/11/2026)
### New
- New Great Buildings Calculator (foe-optimizer.com/gb)
- City: multiplicative Great Building bonuses applied to military values and efficiency

---

## Version 2.008 (05/11/2026)
### New
- Database: Great Buildings catalog, with level selector and Copper / Gold tier

---

## Version 2.006 (03/11/2026)
### New
- Production filter: second click to see the buildings that do NOT produce a resource

### Update
- Set buildings: all set bonuses are counted

---

## Version 2.005 (02/11/2026)
### New
- Allies: Scrolls panel, telling which allies to level up

### Update
- New wand (needs to be recreated): cities of the same player on different worlds stay separate
- Double-click the city name to rename it

---

## Version 2.001 (29/10/2026)
### New
- Hide / Show only: new "Needs road" entry

---

## Version 2.000 (28/10/2026)
### New
- NEW VERSION 2.0: redesigned interface, with tabs at the top and the command ribbon
- Saved cities: your cities, visited ones and those from JSON in the selector at the top
- City import and export in JSON, compatible with FoE Helper and Forge Hammer
- Planner: "comb" network for cities with many two-lane roads
- Medals column, allies catalog in the Database, light and dark theme
- No ads, cookies or tracking

---

## Version 1.296 (23/10/2026)
### New
- Planner: new "Current layout" scenario
- "Edit city" to try the city removing and adding buildings

---

## Version 1.295 (22/10/2026)
### New
- Planner video tutorial

---

## Version 1.294 (21/10/2026)
### New
- Planner: two-lane road support; choice of military buildings to connect; new Connector 5 scenario; CPU power choice (MIN/MED/MAX); English translation

---

## Version 1.293 (20/10/2026)
### Update
- Planner: more searches in parallel, fewer roads

---

## Version 1.292 (19/10/2026)
### New
- New city EDITOR
### Update
- Planner: more compact city

---

## Version 1.289 (16/10/2026)
### New
- Planner: support for building "chains"

---

## Version 1.288 (15/10/2026)
### Update
- Planner: new finishing step and bug fixes

---

## Version 1.287 (14/10/2026)
### New
- Planner: new "pinwheel" layout, fixes, new button colour

---

## Version 1.286 (13/10/2026)
### Update
- Planner: updates and fixes (road efficiency, smoothing)

---

## Version 1.285 (12/10/2026)
### New
- PLANNER: new city planner that works out building placement with as few roads as possible

---

## Version 1.283 (10/10/2026)
### New
- New "Ally potential and Valor Tokens" panel (Allies tab)
### Update
- The bookmarklet also imports the resource storage
### Bug Fixes
- Inventory optimizer fixes

---

## Version 1.275 (02/10/2026)
### Update
- New bookmarklet version
### Bug Fixes
- Outpost import and Pirates tool fixes

---

## Version 1.272 (29/09/2026)
### Bug Fixes
- Bookmarklet fix

---

## Version 1.271 (28/09/2026)
### Update
- Help, guide and privacy policy updated
### Bug Fixes
- Various bug fixes

---

## Version 1.260 (17/09/2026)
### Update
- Cosmetic tweaks

---

## Version 1.255 (12/09/2026)
### Bug Fixes
- Fix for "AllAge" buildings

---

## Version 1.247 (04/09/2026)
### Bug Fixes
- Bug fixes and inventory optimizer improvements

---

## Version 1.239 (27/08/2026)
### New
- Support for "Special goods"
### Bug Fixes
- Smartphone layout fixes

---

## Version 1.238 (26/08/2026)
### Update
- More security and privacy (bookmarklet and data saved in the browser)
- SAD data update

---

## Version 1.236 (24/08/2026)
### New
- PIRATES: new tool to plan the Pirate Settlement (Cultural Outpost import) and fixes

---

## Version 1.235 (23/08/2026)
### New
- Buildings that change with the age are now recognised

---

## Version 1.232 (20/08/2026)
### New
- Option to hide 🚫 items
### Update
- Cosmetic tweaks

---

## Version 1.229 (17/08/2026)
### Update
- Bookmarklet and texts updated

---

## Version 1.228 (16/08/2026)
### Update
- "FSB" building disabled

---

## Version 1.227 (15/08/2026)
### Update
- Kits updated and optimizer improvements

---

## Version 1.226 (14/08/2026)
### Update
- New default age "Stellar Age: Discovery"

---

## Version 1.225 (13/08/2026)
### New
- Full Forge Hammer support (besides FoE Helper)
- New "AGE ->" panel
### Update
- Guides updated

---

## Version 1.224 (12/08/2026)
### Update
- The bookmarklet also imports the player name

---

## Version 1.223 (11/08/2026)
### New
- City export to PNG
### Update
- Ally handling updated

---

## Version 1.215 (03/08/2026)
### Update
- New buildings and kits

---

## Version 1.212 (31/07/2026)
### Update
- Improved city map

---

## Version 1.210 (29/07/2026)
### Bug Fixes
- Road handling fixed

---

## Version 1.208 (27/07/2026)
### New
- Unique buildings (not obtainable from kits)
- SAD support
### Update
- Tab headers
- Cosmetic tweaks

---

## Version 1.205 (24/07/2026)
### Update
- Cosmetic tweaks

---

## Version 1.204 (23/07/2026)
### Update
- New buildings and cosmetic tweaks

---

## Version 1.203 (22/07/2026)
### New
- The City tab can also show the inventory
- Column sorting
### Bug Fixes
- Style fixes

---

## Version 1.202 (21/07/2026)
### New
- Fragment badge (shows what a building produces)
- Road efficiency
### Update
- Landscape orientation

---

## Version 1.201 (20/07/2026)
### Update
- New app icons
### Bug Fixes
- Fixes (inventory, optimizer)

---

## Version 1.200 (19/07/2026)
### Update
- Graphic tweaks and new icons

---

## Version 1.198 (17/07/2026)
### Update
- Interface and text tweaks

---

## Version 1.196 (15/07/2026)
### Update
- New bookmarklet

---

## Version 1.195 (14/07/2026)
### Update
- New iPhone/iPad icon

---

## Version 1.194 (13/07/2026)
### New
- Privacy policy

---

## Version 1.192 (11/07/2026)
### Bug Fixes
- Fixes (inventory, building data, app update)

---

## Version 1.190 (09/07/2026)
### New
- Online guide (Italian and English)
- 404 error page

---

## Version 1.188 (07/07/2026)
### Update
- The building filter is now remembered

---

## Version 1.183 (02/07/2026)
### Update
- Cosmetic tweaks

---

## Version 1.182 (01/07/2026)
### New
- Ally slot filter
### Update
- Smoother search

---

## Version 1.181 (30/06/2026)
### New
- Detection of "downgradable" buildings
- Player avatar in the city bar
### Update
- Better ally handling

---

## Version 1.180 (29/06/2026)
### New
- FIRST VERSION: building database, city and inventory import, inventory optimizer, allies, profiles, installable as an app
