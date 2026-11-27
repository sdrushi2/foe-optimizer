# FoE Optimizer Changelog

## Version 2.030 (27/11/2026)
### New
- City menu: next to the name there are buttons to download the city as a JSON file. Your cities have two: full city (map, inventory, allies, resources and Castle: to take it to another computer or give it to whoever you want) and city only (the map: for Forge Hammer, another planner or another player). Visited cities only have the second. On the right of the menu (at the bottom on narrow screens) a legend explains the buttons. The files are called player-completa-date.json and player-citta-date.json
- Database › Tools: new Editor button, before GB Calc. It opens the city editor empty in a new tab
- City editor: new Import JSON and Save JSON buttons. Import JSON loads a city from a file (full or city only: the map counts, also from Forge Hammer or a Planner scenario) in the editor only, without saving it in the tool, with the same error messages as the tool. Save JSON downloads the edited city as city only (player-citta-date.json), in the same format as the Map JSON. They aren't there when the editor is opened from the Planner
- Import from JSON recognises the full city: it adds it to the imported cities with inventory and allies, and the Inventory and Allies tabs work as for your own cities. A full imported city has both export buttons, one with the map only just the second: so you can see at once what it contains. Importing the same city again updates it, also going from full to city only or the other way round

### Update
- Options › Backup: the buttons are now called Export backup and Restore backup, and the backup is complete. Export backup opens a panel listing what goes into the file (your cities with map, inventory, allies, resources and Castle, visited cities with the map only, all with their names, settings such as language, theme, weights, columns and Planner CPU power, unlocked settlement buildings) and how big it is, reminds you that it is a personal file not to give to other players, and asks for confirmation. The file is called foe-optimizer-backup-YYYY-MM-DD.json. It also works with no saved cities
- Restore backup: once you pick the file, the panel shows what it contains (backup date, cities, settings) and warns you which cities will be deleted. When you confirm it replaces everything, cities and settings, and reloads the page. Before, the backup cities were added to the ones already there (restoring twice duplicated them) and the settings did not come back. If the restore fails, for example because the browser storage is full, your previous data stays as it was. Backups made with version 1 can be restored too (the cities yes, the settings of that time no)
- Restore backup: if you pick a city map instead of a backup, the panel tells you and points you to Import from JSON
- Import from JSON and the Planner read JSON files the same way: they always take the file's layout. Before, importing a Planner scenario JSON among the cities saved the city as it is in the game instead of the scenario. Error messages are the same in both places, in the chosen language, and say what is missing (broken file, no city, expansions, town hall) or that the file is a backup
- Cities imported from JSON and those imported with the wand or the bridge no longer mix: a JSON file only updates a city imported from JSON, and the wand or the bridge only theirs. Before, the wand could turn a JSON city into one of your cities
- Import from JSON: if you pick a backup file, it tells you to use Options › Restore backup. The Map's JSON button now saves player-citta-date.json
- City menu with no cities: the box is narrow as before (the legend only appears when there are cities) and explains the three ways to add one: the green magic wand, the FoE Optimizer Bridge extension and Import from JSON
- City JSON files (Map, city menu, Planner scenarios, editor) also contain the player's avatar, like the wand ones: importing them with Import from JSON the city has its picture in the menu. Forge Hammer and the other programs ignore it
- Every downloaded file starts with the city name: from the Planner city-planner-layout-date (for example f-sdrushi-planner-raccordo3), from the Map city-citta-date for the PNG too, from the editor city-editor-date.png and city-citta-date.json. So the files of the same city sit together in the downloads folder
- Tools: the Export button, which downloads the selected buildings as CSV, is now called CSV
- Options: removed the Saved cities group. Import from JSON stays at the bottom of the city selector; cities are deleted one at a time with the selector's bin, or all together (with the settings) from Reset › Erase everything

### Bug Fixes
- Planner: if the chosen JSON couldn't be read while a city was already open, no message appeared. Now the error shows above the Planner and closes with the X
- The Map JSON wrote the city name with the world letter (F · Sdrushi) as the player: importing it again turned the city into "F · F · Sdrushi". Now the player is written without the letter
- Importing a JSON into the Planner, buildings of unknown size are reported even when the file has CityMapData (before they disappeared silently)

---

## Version 2.029 (26/11/2026)
### New
- FoE Optimizer Bridge extension (beta): switching back to LIVE after the pause, the tool asks the game for a fresh copy and imports everything again (city, inventory, allies and settlements), like with the wand. It works as a full refresh if something had not been updated. Changes made by hand in the planners stay protected by the usual notice
- Mughals: when you change the layout (by hand or with an Optimize attempt) you see the current map, as it is in the game, and the new one side by side, with an arrow and the summary of the changes in between: buildings added and removed, new and moved roads, buildings to move, Embassy moved and rupees every 5 hours before and after. On the maps a red border marks the buildings to remove, blue those to move and white the new ones. The current map is view only; Undo goes back to a single map
- Allies (yours and the Database ones): new View group in the ribbon, after Show rarity, with % Military and Productions (on by default) to hide the columns you don't care about. The choice is saved
- Settlements (Pirates and Mughals): between POP and the currency there is the total Diplomacy of the buildings built (0 at the start), needed for unlocks
- Mughals, Optimize: new Continue button, which resumes the search from the attempts found and keeps going until you press Stop, to improve them

### Update
- Allies (yours and the Database ones): the table no longer takes the whole screen width but only the space it needs, centered, so on large screens names and values stay close. Nothing is cut: the abilities of legendary allies can be read in full
- Allies (yours and the Database ones): Sum goods is in Options here too, with the same golden icon. It merges current and previous era goods into a single column with the total. It is the same option as in the building tables: on in one, on in all
- Mughals, Optimize: the table shows only the 5 best attempts, sorted by production. The X at the top right closes the attempts box (and stops the search); Continue reopens it. The notice at the top explains what the Mughal planner does today, still a preliminary version

---

## Version 2.028 (25/11/2026)
### New
- Settlements (Pirates and Mughals): the building legend is a table with the columns Size, Population, Diplomacy, currency (Doubloons or Rupees: production per building, with all durations on hover, or the cost) and amount. Next to AREA and POP there are also the Pirates' Doubloons, like the Mughals' Rupees
- Settlements: new Mughals button next to Pirates, with the same map as the Pirates: import with the wand (with the settlement open in the game), Embassy you can move, expansions to add and remove (adjacent only, with their obstacles), obstacles, buildings to add and move, AREA and POP, and next to them the settlement's Rupees (from the import) with what the added Groomed Paths cost and how many are left. Automatic solving is for the Pirates only for now: in the Mughal settlement buildings need a road. If you import a settlement in the wrong tab, the tool tells you which one to open
- Settlements, for those testing the FoE Optimizer Bridge extension (beta): the settlement updates by itself while you play, with no wand. With the Settlements tab open, every time you move, add or remove something in the game's settlement the map, AREA, POP and the Rupees (or Doubloons) update within a couple of seconds. The settlement taken is the one from the selected city's world. If you have already made changes of your own in the tool, they are not overwritten: a notice appears with the Update button. If you play on several worlds each one has its own settlement: switching city you find the one of its world, with the changes you had made (as long as the page stays open)
- Mughals: the legend has a checkbox for each building, ticked if it is already unlocked in the game. Bhavan, Rice and Alley are unlocked from the start; buildings still locked are greyed out but you can still add them to plan ahead. With the new wand (it must be created again) or with the extension, if you use FoE Helper the boxes are ticked by themselves on import; otherwise tick them yourself. They are saved for each world
- Mughals, new Optimize button (first version): choose in the legend how many factories to place (for example 1 Rice) and the tool searches for about 20 seconds for the layout with the most rupees and the fewest roads, using only unlocked residences and also moving the Embassy. It suggests one attempt for each number of roads, with the rupees you have left and the production; click one to see it on the map and adjust it. On a new settlement, with 1 Rice, it finds 20 connected Bhavan with 12-13 roads. On the map buildings not connected to a road are dashed: houses give population only, factories and diplomacy buildings are also circled in red because they won't produce like this. Each attempt shows the difference with the starting map, for example 13 (−3) roads and 18 (−5) connected. The production optimization ignores diplomacy, which will get its own: in the legend diplomacy buildings no longer have − / + or a checkbox. Roads already built are never removed: if an attempt uses fewer, the extra ones are parked in empty cells.

### Update
- On phones and tablets (Android, iPhone, iPad) the magic wand and the connection indicator no longer appear at the top, because they cannot work there: more room for the rest. The messages that used to say to use the wand now suggest loading a JSON file of the city

### Bug Fixes
- Settlements: the choice between Pirates and Mughals was lost when reloading the page. Now it is kept
- FoE Optimizer Bridge extension (beta): the connection pause was lost when reloading the page. Now it is kept

---

## Version 2.027 (24/11/2026)
### New
- FoE Optimizer Bridge, first version (being tested by a few users): an extension that connects the game to FoE Optimizer, for Chrome and the other Chromium-based browsers (Edge, Opera, Brave, Vivaldi; not Firefox or Safari for now). With the extension and FoE Helper or Forge Hammer active, your city updates by itself in the tool at every change in the game (a building moved, bought, put in the inventory, an ally assembled…), without the wand. It works with several worlds open together (for example beta and live) and only for your own cities: the cities you visit are still imported with the wand
- Next to the wand there is the connection indicator: green LIVE when the city comes from the game, yellow LIVE when the extension is waiting for the game, PAUSED when you paused it with a click (resuming imports the latest version right away) and OFF without the extension. With the Planner open the city doesn't change by itself: if it changed in the game a notice appears with an Update button, which imports it and restarts the Planner from the new city. If you don't have the extension nothing changes: you import your city with the wand, as always

---

## Version 2.026 (23/11/2026)
### Update
- GB Calculator: in the text to copy into the chat the Great Building has a short name (for example "Galaxy" instead of "The Blue Galaxy", "Galassia" in the Italian version), in a field next to your name. You can change it: it stays saved for each Great Building, and clearing the field brings back the default one
- GB Calculator: each spot has a box on its left to choose which spots go in the text to copy. If you tick none, the text has all of them as before. The boxes are cleared when you change Great Building or level
- GB Calculator: the name fields and Copy are now above the text to copy, all on one row on phones too. You can edit the text before copying it (for example to add something); it goes back to the calculated one when you change spots, names, Great Building or level
- GB Calculator: new GOLD 50% chat, next to GOLD 20% and GOLD 25%, with the same rules (it applies to Gold levels, from 102 on)
- GB Calculator: your favourite Great Buildings, split by world. At the top of the calculator a row shows the chosen world and how many GBs it has saved: tap it to open the list, with a tab for each world (+ to add one, then Rename and Delete) and a button for each saved GB, which opens it at its level
- GB Calculator: to save a Great Building in the chosen world's favourites tap the star next to the level. The star is gold if the GB is saved at that level, empty if it isn't saved or is saved at another level (tapping it updates it); tapping the gold one removes it. Nothing is saved on its own: you can look at another player's GB without changing yours
- GB Calculator: when you open it from FoE Optimizer (GB Calc. button) your cities imported with the wand become worlds named after the city, with all their Great Buildings at the level to build, updated every time; the world of the selected city is the chosen one. Visited cities and cities from JSON don't count. If you have no imported cities your favourites stay as they are
- GB Calculator: below the spots a P switch chooses whether to write the letter P before the spots in the text to copy (P7(2) or 7(2)). The choice stays saved
- GB Calculator: the four summaries are now in the first box, right below the chats
- Planner: the video tutorial is now in English too (Planner › Help › Video tutorial and Help › How to use the planner)

### Bug Fixes
- Planner, Connector 3/4/5: with small cities in a large area the first build could already place all the buildings that need a road; then the search didn't start and the vertical road stayed as long as the whole area. Now the search starts in this case too and shortens the road (on a test city from 60 roads to 8)

---

## Version 2.025 (22/11/2026)
### Update
- Database, City and Inventory: the Tools group has a GB Calc. button that opens the GB Calculator in a new tab. The JSON button is gone from City: to download the city as JSON use the Map's JSON button

---

## Version 2.024 (21/11/2026)
### Update
- Planner, Connector 3/4/5 with two-lane buildings: after the two-lane blocks the road can now continue as a one-lane road on the same row, with normal buildings on both sides, instead of always stopping against a two-lane building used as road end. The Planner tries both starts and keeps the best one
- Planner, chains: if in your city a link is detached from its chain (for example the Serpent Spikes far from the Feathered Serpent Statue) a notice appears with a switch for each kind of link. On, the Planner attaches it to the chain, which then has to be placed again and may cost a few more roads, also in the Current layout. Off, it stays detached as in the city and the Current layout really starts from your city (on a test city 84 roads instead of 90)
- Planner, cities with two-lane buildings: at start the page no longer freezes for a few seconds before the scenarios begin. The two-lane road preparation is faster (on a test city from about 4 seconds to 1) and runs alongside the scenarios, with the same results as before
- Planner, Pinwheel with two-lane buildings: the pinwheel stays a pinwheel. The Planner also tries starts with 1, 2, 3 or all 4 arms as two-lane roads, as long as the two-lane buildings need and then continued as one-lane roads for the others, and keeps the best one. Before, when the two-lane buildings didn't fit in a single row, it started from the comb network, which was no longer a pinwheel. In big cities the Pinwheel search can now open new roads while some buildings that need a road are still out: on a test city with 125 buildings with road, after the same search, from 43 buildings out to 0 (with the comb network 14 out and 286 roads, now 202 roads). Cities where the Pinwheel already fitted everything don't change
- Planner: while a scenario is getting ready (two-lane roads, choosing the town hall position, trials to choose the best start) a softly blinking message appears under its name, so you can see it's working and not stuck. It disappears when the search starts
- Planner, Smooth: it can now also move the links between chains of the same kind (for example the tails of the Feathered Serpents from one serpent to another), keeping the starts in place, when this lowers the corners. A chain can get longer and another one can end up with no links: its start then moves like a normal building. When resumed, the search starts from the new chains
- Phone in landscape: the command ribbon now fits in a single row, with short group buttons and the name next to the icon. Before it took almost a third of the screen with a lot of empty space above and below the buttons. If the buttons don't all fit, only the icons remain
- The site opens faster, especially on phones: the buildings table first draws only the rows you can see and adds the others as you scroll, and some parts (city map, Help panels, Settlements, ally panels) are downloaded only when you open them

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
