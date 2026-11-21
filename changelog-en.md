# FoE Optimizer Changelog

## Version 2.024 (21/11/2026)
### Update
- Planner, Connector 3/4/5 with two-lane buildings: after the two-lane blocks the road can now continue as a one-lane road on the same row, with normal buildings on both sides, instead of always stopping against a two-lane building used as road end. The Planner tries both starts and keeps the best one
- Planner, chains: if in your city a link is detached from its chain (for example the Serpent Spikes far from the Feathered Serpent Statue) a notice appears with a switch for each kind of link. On, the Planner attaches it to the chain, which then has to be placed again and may cost a few more roads, also in the Current layout. Off, it stays detached as in the city and the Current layout really starts from your city (on a test city 84 roads instead of 90)
- Planner, cities with two-lane buildings: at start the page no longer freezes for a few seconds before the scenarios begin. The two-lane road preparation is faster (on a test city from about 4 seconds to 1) and runs alongside the scenarios, with the same results as before
- Planner, Pinwheel with two-lane buildings: the pinwheel stays a pinwheel. The Planner also tries starts with 1, 2, 3 or all 4 arms as two-lane roads, as long as the two-lane buildings need and then continued as one-lane roads for the others, and keeps the best one. Before, when the two-lane buildings didn't fit in a single row, it started from the comb network, which was no longer a pinwheel. In big cities the Pinwheel search can now open new roads while some buildings that need a road are still out: on a test city with 125 buildings with road, after the same search, from 43 buildings out to 0 (with the comb network 14 out and 286 roads, now 202 roads). Cities where the Pinwheel already fitted everything don't change
- Planner: while a scenario is getting ready (two-lane roads, choosing the town hall position, trials to choose the best start) a softly blinking message appears under its name, so you can see it's working and not stuck. It disappears when the search starts
- Planner, Smooth: it can now also move the links between chains of the same kind (for example the tails of the Feathered Serpents from one serpent to another), keeping the starts in place, when this lowers the corners. A chain can get longer and another one can end up with no links: its start then moves like a normal building. When resumed, the search starts from the new chains

### Bug Fixes
- Planner: after changing the number of links of chains in the editor (for example all the tails of the Feathered Serpents on a single serpent) the scenario no longer resumed the search and Smooth did nothing either. Now it restarts from the editor's layout

---

## Version 2.023 (20/11/2026)
### Update
- Building tables: the page opens much faster (in tests the first rows appear in under a second instead of 3-4) and responds much sooner to sorting, filters, search and selection (in tests on a computer from 0.5-2.6 seconds to 0.05-0.2 seconds). The table shows the first rows right away and adds the others as you scroll. To find a building use the Search box: the browser's Ctrl+F only finds the rows already shown
- Database: new Era selector (next to Catalog) to see the buildings with the values of any era, from Bronze Age to Stellar Age: productions, goods, military values, population and efficiency. The latest era stays the default. For example the Ascended Zhulin Panda Shrine gives 554/304/254 goods at Stellar Age but 486/236/186 at Colonial Age
- Map, PNG, Planner and editor: 2-lane military buildings have a darker brown, with their own legend entry, like the dark green of 2-lane buildings. Roads are gray instead of brown, so they don't get mixed up with military buildings. In the PNG, names on dark buildings are written in a light color

### Fixes
- Map: hovering military buildings (and other buildings that aren't in the Database, like goods buildings) now shows the building's image

---

## Version 2.022 (19/11/2026)
### Update
- Planner: hovering the red "With road" or "Without road" count (now underlined) shows the list of buildings not placed yet, with their size and how many copies are missing
- The version number at the top right opens What's new (the same panel as Help › What's new). Pressed again, it closes them and takes you back where you were
- At the bottom of the city list, a bar shows the browser storage used by the tool: one segment per city (yours in yellow, visited ones in blue), hover a segment for the city's name and size, plus an estimate of how many more cities can be saved

### Fixes
- Planner: in cities with a great many identical small buildings with road (for example dozens of Wishing Wells) the Planner froze for more than half a minute before starting, with the page stuck. It now starts in about a second, with the same layouts
- Planner, cities with many two-lane buildings: the junction layouts start again from the two-lane road on the junction, which can now extend up to the map edge (before it stopped at 10 blocks and one building was left out). Before, the comb network was chosen, with almost twice the roads, or a start that left two-lane buildings out, which then ended up attached to a normal road. On a test city with 10 two-lane buildings: from 378 to 189-212 roads, all connected to two lanes
- Wand: if FoE Helper doesn't have the city data yet (it happens when importing a neighbour's city: name and avatar but no buildings), the city is no longer created empty or overwritten, and a message says to reload the game and try again. If importing the map fails, the city goes back to how it was and the error is shown

---

## Version 2.021 (18/11/2026)
### Update
- Building tables: the three personal goods columns (current, previous and next era) are now side by side, followed by the goods boost column. New "Sum goods" button (Options) that merges them into a single column, with the golden goods icon, showing the total goods produced. This column can be sorted too
- Planner, 3/4/5 Junctions: in cities with many horizontal buildings with road (wider than tall) the search also tries a "vertical comb": several vertical roads branch off a horizontal road, with the horizontal buildings stacked on both sides and attached by their short side. Vertical buildings stay on the horizontal roads. On a test city with 81 horizontal buildings: about 19 fewer road tiles and almost no yellow borders (from about 50 to 2-4). Cities with few horizontal buildings do not change
- Planner, Pinwheel and Pinwheel 2: in the same cities the vertical comb branches off the pinwheel's horizontal arms. On the test city all buildings with road now fit (before, more than 30 were left out)
- Planner: in Current stats the buildings with road are split by shape (square, horizontal, vertical), to see at a glance whether the city has mostly horizontal buildings
- City, Inventory and Database: the "Export" button (CSV of the selected buildings) moves from the Options group to the Tools group
- City: the "Map" button moves from the Tools group to the City statistics group
### Fixes
- Planner: roads with one side outside the play area (for example a road along the edge of the map) are marked with the red border as wasted roads and the search avoids them as much as possible (each counts as one extra road). They are only kept as a last resort, when they let more buildings fit
- Planner: no more squares of 4 roads (2×2) that no step removed: if one of the four tiles is not needed it is removed, if it only serves a building that can attach elsewhere the building is moved, and the search discards layouts where a square remains anyway
- Planner: when importing another player's city with the wand while on the Planner tab, the ribbon shows all its commands right away (before, only "Source" was left until you switched tab)

---

## Version 2.020 (17/11/2026)
### Update
- Planner: completing and the refinement after COMPLETE are faster (in tests up to one third less time), with the same layouts as before
- Planner: Smooth tries more moves in the same time
- Planner, Pinwheel 2: choosing the town hall position uses several cores at once and finishes sooner, with the same position chosen
- Planner: the refinement after COMPLETE leaves far fewer small scattered holes among buildings without roads: it moves and merges the holes, also using slightly smaller pieces for a better fit, until the free space is left in few spots (often just one)
### Fixes
- Planner, Hippodrome: Carceres and Sphendone are BOTH connected to a road (before, often only one of them); the tracks in between still need no road
- Planner: at the end of the refinement no more 1×1 decorations (and other 1×n pieces) are left scattered or isolated where they started: a piece keeps its starting spot only if it still fits snugly, otherwise it is placed again in the holes or next to other buildings. The same goes for pieces moved by hand during pause: if they fit snugly they stay there, if they are left scattered the refinement fixes them

---

## Version 2.019 (16/11/2026)
### Update
- City and Inventory: "Buildings shown" above the table counts the actual buildings, that is every copy (the sum of the ×N badges), no longer the table rows
- Planner: while searching, only the map of the scenario that changes is redrawn, no longer all of them
### Bug Fixes
- Planner: PNG and JSON of the Current layout are downloaded with their own name (before "girandola")

---

## Version 2.018 (15/11/2026)
### Bug Fixes
- Planner: completing no longer leaves out large buildings without road (for example a 4×4) when there is enough free space; if the usual filling cannot fit them all, one that places the largest first is tried
- Planner: during the refinement after COMPLETE, 1×1 and 1×N decorations moved by hand while paused stay where you put them (before they went back to their previous spot); the refinement is also faster

---

## Version 2.016 (13/11/2026)
### New
- City, Inventory and Database: new icon next to buildings you can make from fragments produced by other buildings; hovering shows the producers, how many you have in the city and inventory and how many days to the kit. New "From fragments" filter in Hide / Show only

### Bug Fixes
- GB Calculator: rewards and FP to pay rounded like the game also in edge cases (for example 1 FP more on spots 2 and 3 of Hagia Sophia at 122, or with a 105% custom chat)

---

## Version 2.014 (11/11/2026)
### New
- GB Calculator: instead of the level selector, the progress bar of the GB window (the same on PC and mobile) with the FP already paid and the level to enter highlighted; the ±1 / ±10 arrows are next to the level field
- Planner, Edit city: under the changes a table with what changes, column by column (area, roads, population, happiness, military values, Quantum Incursions and productions), with warnings for Database values at the highest age and for allies in removed buildings
- GB Calculator: the FP paid by the owner have their own row above the ranking, with a button that clears all the FP entered; on mobile the 4 boxes stay on one row

### Bug Fixes
- After an update the page could stay blank with just "FoE Optimizer": the tool now repairs itself
- Planner: pausing now also stops Girandola 2's town hall position trials and the other scenarios' start choice

---

## Version 2.013 (10/11/2026)
### New
- City, Inventory and Database: menu above the table to choose what the EFF column measures: military, goods, Forge Points or guild goods efficiency per tile (in City and Inventory the % boosts count on the city's production)
- New Coins Boost, Supplies Boost and Medals Boost columns in productions (Database after the next data update, City and Inventory after a new import), also in the Production filters and in the CSV export; goods columns now follow medals, rogues and units go after guild goods; all % boosts have a lighter, golden colour
- City and Database: "Downgradable" becomes "Ageable": buildings that, taken to the Bronze Age, give the same goods and the same military values, to produce goods of an old age without losing anything (in the Database after the next data update); limited / ascended buildings get a ⚠, because re-ascended on expiry they go back to the highest age
- Production panel: FP and goods of placed science allies, with the goods of the age of the building hosting them
- GB Calculator: the level selector of the GB window under the level, as a reminder to enter the level being built, not the current one; the arrows change the level by 1 or 10
- City: the Ageable filter also shows buildings added with +Inventory
- Inventory: Ageable filter; "Ready only" becomes the "Ready" item of Hide / Show only, to see only ready buildings or only the ones made with kits

### Bug Fixes
- GB Calculator opened from the installed app's shortcut: "Back to the tool" no longer closes the app
- Science allies: FP and goods of your allies are those of their level, no longer always those of level 100

---

## Version 2.012 (09/11/2026)
### New
- Planner: switches for buildings disconnected in the city, to leave without a road or to connect
- Planner: when the optimizer stalls, an 8-second Smooth starts by itself, spaced further apart when it finds nothing
- Production panel: the Royal Albert Hall goods reserves go to the ages of the city's goods factories
- Production panel: goods with the % bonus rounded as in the game (needs a new import)
- GB Calculator: level 101 is still at Copper rate
- City: calculator icon next to Great Buildings, opens the GB Calculator at the level to build
- GB Calculator: "FP you already paid" and "External" fields, with taken spots, spots in danger and missing FP as in FoE Helper
- Buildings disconnected from the road: no longer counted in military values, GB bonuses, hosted allies and productions (in red in the details)

---

## Version 2.011 (08/11/2026)
### New
- New version of the magic wand (it must be recreated, dragging it again to the bookmarks bar): it also imports the Castle level: the Castle's daily Forge Points and goods count in the Production panel, and its attack and defense bonus has a column in Military values, included in the total (and so multiplied by the GB bonuses)
- City: new Age and Goods of age filters (Filters group), as in the Inventory but on the placed buildings, one row per age of the copies with that age's values; they replace the "Outdated" box
- "Self-upgrading" becomes "Auto age": these buildings take your city's age by themselves and can't be taken back to a previous age with the One Down Kit or the Reversion Kit, as the tooltips now explain
- City › Statistics › Production: two panels, "Fragment production" and "Forge Points and goods production". In the second one goods are split by age (e.g. Space Age Titan goods, Space Age Space Hub goods), counting the age of every building copy and the goods production bonus, with the total at the bottom; clicking a row (a fragment, Forge Points, guild goods, special goods or the goods of an age) shows the buildings producing it and how much each one gives

---

## Version 2.010 (07/11/2026)
### New
- Inventory: new Age and Goods of age filters (Filters group). The first shows the owned buildings of one age; the second those producing goods of one age, i.e. buildings of that age, of the next age with previous age goods and of the previous age with next age goods, with the values of their own age and the goods column highlighted (needs a new inventory import)
- Great Buildings catalog: the 📊 button next to the name (also in City, Inventory and Database, replacing the "GB" badge) opens the GB report, with bonuses and costs level by level from the official wiki, a level range of your choice (from the City it starts with the next 10 levels of your GB), how many FP each +1 of bonus costs you with the chat, and full-screen charts
- Great Buildings report: new "Unlock cost" section, with the Copper and Gold blueprint sets, coins, supplies, medals and goods needed to unlock the levels of the chosen range

---

## Version 2.009 (06/11/2026)
### New
- New Great Building Calculator (foe-optimizer.com/gb, in Italian foe-optimizer.com/ge; also from Guide › GB Calculator and Database › Great Buildings › Calculator): for each GB and level the level's FP, each spot's reward with the chat percentage (Copper 90%, 95%, 100%, Gold 20%, 25% or custom) and how many FP you need to secure it
- City: under the multiplicative Great Building bonuses (+N%) you see their actual contribution in your city (e.g. +1,670), which now counts in the GB's efficiency
- City and Inventory: new Options › GB bonus button, which applies the multiplicative bonuses of the city's Great Buildings to military values and efficiency
- Military statistics: new "GB bonus" and "total with bonus" columns, with the multiplicative Great Building bonuses computed on the total
- Allies: the extra levels from the Colosseum and the Lotus Temple (Gold tier) count in the allies' stats and in the Tokens and Scrolls panels
### Update
- Building tables: hovering a value shows the name of its column, handy when the header is off screen
- Great Buildings: Gold tier multiplicative bonuses appear in the columns as +N% (not counted in efficiency); the goods production +% of St. Mark's Basilica and the special goods +% of the Space Carrier go into the Goods boost and Special goods boost columns
- Great Buildings: all other bonuses (relics, critical hit, double collection, missile launch, spoils of war, etc.) have the game icon with an explanation; the coin and supply boosts of St. Mark's Basilica, Royal Albert Hall and Lighthouse of Alexandria are now shown in imported cities too

---

## Version 2.008 (05/11/2026)
### New
- Database: new Great Buildings catalog, with every GB in the game in the buildings table (same columns, efficiency and sorting) and a level selector (1, 101, 201, 301, 401, 500) to see how the stats change; row and badge in gold or copper depending on the tier
### Update
- Database: game icons for the Buildings and Allies catalogs
- Great Buildings: row and GB badge in gold for GBs in the Gold tier, in copper for those in the Copper tier
- Great Buildings with the new Gold tier: multiplicative bonuses are no longer added to the columns and the efficiency; in the ❔ column the × symbol lists them, together with the goods production +% and the ally boosts of the Colosseum and the Lotus Temple
- Great Buildings with the Gold tier: the Observatory's guild goods of 3 eras and the Royal Albert Hall's goods reserves now count too

---

## Version 2.006 (03/11/2026)
### New
- Production filter: second click on a resource = red box, shows buildings that do NOT produce it (e.g. all red: buildings producing nothing)
### Update
- Settlements: game icon for the Pirates
- Set buildings (Cherry Garden, Piazza, Harvest Farm…): the missing set bonuses now count too (happiness, coins, supplies, medals, attack and defense); in the ❔ column the set icon shows the set name and that the bonuses are the maximum ones
- Database: removed the two town halls of the starting tutorial, which are not real buildings, and the Stellar Age colony buildings
- Building tables: game icon in the limited column instead of ⏱
### Bug Fixes
- Tables: the efficiency column of Great Buildings has the same color as the row

---

## Version 2.005 (02/11/2026)
### New
- Allies: new "Scrolls" panel (Analysis group), showing which allies to level up, and by how many levels, for the highest efficiency with the Heroic Scrolls you have
### Update
- New magic wand version: it recognises the game world and warns if the data is not loaded yet (create it again by dragging it to the bookmarks bar)
- Saved cities: cities of the same player on different worlds stay separate instead of overwriting each other, and the name starts with the world letter (e.g. "L · Sdrushi")
- Saved cities: double-click the city name at the top to rename it (the name is kept when importing it again)
- Phone in portrait: the command ribbon shows only the group icons and is shorter
- The "?" next to a group name (e.g. Search) also opens with a tap
- Planner, "Current layout": chains start as they are assembled in your city, with their links
- Allies: the "Potential & tokens" button becomes "Tokens" with the game icon and the Valor Tokens you have
- Allies: "Level 100" moved to the Analysis group; game icons for Level 100, Military, Science and Fragments
### Bug Fixes
- Phone: the page no longer scrolls sideways
- App installed on the phone: it can be used in portrait again
- Planner, PNG with the city changes: the white border note only appears when buildings were added
- Planner, editor changes: chain links (e.g. Serpent Spikes) can be moved from one Statue to another, even making chains longer or shorter, instead of giving "broken chain"

---

## Version 2.001 (29/10/2026)
### New
- Hide / Show only: new "Needs road" item
### Update
- Hide / Show only and View: game icons instead of generic ones
### Bug Fixes
- Phone layout: the command ribbon scrolls instead of being cut off, and group menus stay inside the screen

---

## Version 2.000 (28/10/2026)
### New
- NEW VERSION 2.0: redesigned interface, with tabs at the top and a command ribbon that adapts to the window width
- Saved cities: your cities, visited ones and those imported from JSON, all in the selector at the top; re-importing a city updates it instead of creating a copy
- Import a city from a JSON file (FoE Optimizer, FoE Helper or Forge Hammer export) and export your city to JSON compatible with other tools
- Planner: cities with many two-lane road buildings are laid out with a new "comb" network
- New Medals column among building productions (also in the Production filter)
- Hide / Show only: each item hides those buildings or shows only them
- Allies catalog in the Database
- Light and dark theme
- Options › Erase everything to reset data and settings
- About: "Clean, by choice" – no ads, cookies, tracking or profiling
- About: "Buy me a coffee or a beer" (PayPal or Satispay), entirely optional
- Direct links to tabs, e.g. foe-optimizer.com/#planner
### Update
- Search for several names separated by commas, in allies too, and by ID
- Online guide rewritten for version 2.0 (Italian and English)
### Bug Fixes
- Planner, "Current layout": road buildings added with "Edit city" are now connected by opening new roads (the search used to get stuck with one building left out)
- Planner, Complete: no more scattered gaps; the remaining free space is gathered into a single gap, as square as possible. In "Current layout" buildings without a road stay where they are if their spot is still free

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
