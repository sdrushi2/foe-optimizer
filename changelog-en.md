# FoE Optimizer Changelog

## Version 2.012 (09/11/2026)
### New
- Planner: new "Buildings disconnected in the city" box with a switch for each type of building that needs a road but is disconnected in the city (e.g. houses kept for population, factories for the Royal Albert Hall): off they stay without a road in the new layout too, on they get connected
- Planner: when the optimizer stops finding improvements, an 8-second Smooth starts by itself, visible, just like pausing and pressing Smooth; then the search resumes from the smoothed map
- Production panel: the goods reserves of the Royal Albert Hall (Gold tier) go to the ages of the city's goods factories, in proportion to the number of factories of each age (connected or not); without factories they produce nothing
- Production panel: goods with the % bonus are calculated as in the game, rounding each single good of each production and then applying the chance (e.g. Excalibur: 1,410 + 25% of 6,970 = 3,152.5); needs a new city import
- GB Calculator and GB report: level 101 of Gold GBs is still calculated with the Copper chat (the GB is at 100, still Copper); the Gold chat starts at 102
- City: next to the 📊 of Great Buildings there's a calculator icon that opens the GB Calculator on that GB at the level to build
- GB Calculator: new "FP you already paid" and "External" fields (FP already put by other players in each spot). Same calculation as FoE Helper: whoever already paid enough (even less than the price, if the missing FP can't overtake them) keeps the spot, spots at risk are marked "danger", there is the total of FP missing to the level and the text to copy only has the spots for patrons
- Military values and Great Building bonuses: only buildings connected to the road count. A disconnected building gives no values, and a disconnected GB gives neither values nor multiplicative bonuses (ally levels included); allies hosted in a disconnected building don't count either. The same goes for the Production panel, where disconnected buildings appear in red in the details, with "(disconnected)" and in brackets what they would produce

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
