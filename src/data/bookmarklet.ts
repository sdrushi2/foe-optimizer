// ─────────────────────────────────────────────────────────────────────────────
//  Bookmarklet (Bacchetta Magica)
//
//  Tutto ciò che riguarda il payload prodotto dal bookmarklet di Forge of Empires:
//  - lo script JS eseguito sul gioco
//  - il tipo del JSON prodotto e copiato negli appunti
//  - la funzione di validazione del payload
//
//  Convenzione: i nomi dei campi seguono quelli usati dal gioco (camelCase misto
//  a PascalCase) e non vengono normalizzati per restare 1:1 col JSON originale.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versione corrente del formato payload prodotto dal bookmarklet (campo `_v`).
 *
 * Unica fonte di verità: è interpolata direttamente dentro {@link BOOKMARKLET_JS}
 * (niente numero duplicato da tenere sincronizzato a mano) ed è quella con cui
 * l'app confronta il `_v` di un payload importato per capire se il bookmarklet
 * usato è più vecchio dell'attuale (vedi `handleWandClick` in App.tsx).
 *
 * Da incrementare ogni volta che cambia in modo non retrocompatibile il modo in
 * cui il bookmarklet legge i dati dal gioco (es. FoE Helper che ristruttura un
 * oggetto globale) — non per semplici modifiche cosmetiche del payload.
 *
 * v2 (luglio 2026): FoE Helper ha spostato gli alleati da `MainParser.Allies`
 * a un oggetto globale a sé stante `Allies`. Il bookmarklet prova prima il
 * nuovo percorso e ripiega sul vecchio se assente (vedi `allies:` sotto), così
 * funziona sia con FoE Helper aggiornato sia con versioni precedenti.
 *
 * v3 (agosto 2026) — bookmarklet "universale" FoE Helfer + Forge Hammer, e
 * supporto import città di un altro giocatore in visita:
 * - Sorgente dati unificata in `S` = `MainParser` (FoE Helfer) o `FH.Main`
 *   (Forge Hammer, stessa forma dati — `Inventory`/`CityMapData`/
 *   `CityEntities`/`Allies` — dietro un namespace diverso).
 * - Rilevamento città propria vs. in visita tramite `ActiveMap`/`FH.ActiveMap`
 *   (variabile globale con lo stesso nome/semantica in entrambi gli helper):
 *   se vale `'OtherPlayer'`, `CityMapData`/`UnlockedAreas`/`playerName`/
 *   `portraitUrl` vengono dalla città visitata (`CityMap.OtherPlayer` per i
 *   primi due, `Profile.otherPlayer.other_player` per nome/avatar — FoE
 *   Helfer li popola entrambi dallo stesso handler `visitPlayer`), mentre
 *   `inventory`/`allies` restano SEMPRE vuoti (il gioco non espone mai
 *   l'inventario/gli alleati di un altro giocatore).
 * - Guard aggiornato di conseguenza: fallisce se non esiste NÉ `MainParser`
 *   NÉ `FH.Main`, oppure se nessuno dei due percorsi alleati (`Allies`
 *   globale o `Src.Allies`) è disponibile.
 * - `try/catch` esterno rimosso deliberatamente: un errore nella lettura dei
 *   dati non mostra più un alert dedicato, risale silenziosamente — la
 *   diagnosi in quel caso è delegata all'app (vedi `validateBookmarkletData`/
 *   `handleWandClick`), che già copre appunti vuoti, JSON non valido, e
 *   campi mancanti con messaggi propri. Resta invece il `try/catch` interno
 *   alla funzione di fallback clipboard (`c()` sotto), che è meccanica di
 *   copia, non validazione dati.
 *
 * v3.1 (agosto 2026, STORICO — sostituita dalla v4 sotto) — aveva innestato
 * il branch Insediamento dei Pirati (`ActiveMap === 'cultural_outpost'`)
 * come PRIMO controllo dello script, con un `return` anticipato: catturava
 * SOLO `CityMap.CulturalOutpost`, ignorando `MainParser`/`FH.Main` anche se
 * ancora popolati. Corretto per "sei sull'Insediamento, hai cliccato la
 * bacchetta sulla tab Pirati", ma rompeva l'import città se l'utente si
 * trovava sull'Insediamento e voleva importare il profilo città (mancava
 * tutto quello che il branch pirati non catturava — vedi v4 sotto per il
 * fix). Non era un nuovo numero di `_v`: il branch si riconosceva dal campo
 * `activeMap` del payload stesso, non da `_v`.
 *
 * v4 (agosto 2026) — CATTURA UNIFICATA città + Insediamento in un solo
 * click, sostituisce il branch v3.1 col `return` anticipato. Il gioco carica
 * SEMPRE prima la città all'avvio (popolando `MainParser`/`FH.Main`) e poi,
 * se l'utente entra nell'Insediamento, aggiunge `CityMap.CulturalOutpost`
 * SENZA scaricare i dati città — quindi entrambi i set restano disponibili
 * in memoria contemporaneamente. Lo script ora prova SEMPRE a popolare
 * entrambi i blocchi nello stesso payload — `d` (dati città/inventario,
 * come v3, sempre presente se `MainParser`/`FH.Main` esiste) e
 * `d.pirateOutpost` (dati Insediamento, presente in più SOLO se
 * `CityMap.CulturalOutpost` esiste E non si è in visita da un altro
 * giocatore: `V` — il proprio Insediamento non ha senso mentre si guarda
 * la città di qualcun altro). Fallisce con l'alert "helper non trovato"
 * SOLO se manca il blocco città (sempre atteso all'avvio del gioco); il
 * blocco pirati è puramente opzionale e la sua assenza non blocca nulla.
 * Il payload del ramo pirati ha anche lui `_v` (prima assente nella v3.1:
 * il branch si riconosceva da `activeMap`, non serviva) per poter rilevare
 * un bookmarklet vecchio importato nella tab Pirati — vedi
 * `piratiImportOutdatedBookmarklet` in ui-strings.ts e il controllo in
 * `importCulturalOutpostPayload`.
 *
 * v4.1 (agosto 2026, stesso `_v: 4` — solo hardening, nessun cambio di
 * struttura payload) — la v4 costruiva `d` senza `try/catch` esterno né
 * fallback su nessun campo annidato letto dal client di gioco (`S.Inventory`,
 * `S.Allies`/`Allies.allyList`, `S.CityMapData`, `S.CityEntities`,
 * `M.unlockedAreas`, `M` stesso quando `CityMap.Main`/`CityMap.OtherPlayer`
 * fosse assente): se uno qualsiasi di questi campi risultava `undefined` in
 * una variante di FoE Helfer/Forge Hammer non ancora vista, un `.map`/
 * `Object.values` su `undefined` lanciava un `TypeError` non gestito —
 * lo script moriva SILENZIOSAMENTE (niente `alert`, niente clipboard
 * aggiornata), lasciando l'utente senza alcun indizio del problema reale.
 * Fix: (1) ogni campo vulnerabile ha un fallback (`||{}`/`||[]`), incluso
 * `M` stesso; (2) l'intera costruzione+copia del payload città (inclusa la
 * costruzione del blocco pirati) è avvolta in un `try/catch` con
 * `alert('Magic wand error: '+e.message)` — stesso pattern già usato dal
 * branch pirati storico e dalla funzione di copia clipboard `c()`/`f()`,
 * ora applicato coerentemente a TUTTO lo script. Nessun campo del payload è
 * cambiato: un payload v4.1 e uno v4 "puro" sono strutturalmente identici,
 * la differenza è solo la robustezza dello script che li produce.
 */
export const CURRENT_BOOKMARKLET_VERSION = 4;

/**
 * Codice JavaScript del bookmarklet "bacchetta magica" (versione universale,
 * vedi commento v4/v4.1/v3.1 sopra per lo storico completo delle decisioni).
 *
 * L'utente lo trascina nella barra dei preferiti del browser; clickandolo
 * mentre Forge of Empires è aperto, raccoglie SEMPRE i dati città/inventario
 * ({@link BookmarkletData}) e, se disponibili (utente ha visitato il proprio
 * Insediamento nella stessa sessione), aggiunge anche `pirateOutpost`
 * ({@link BookmarkletPirateOutpostData}) nello stesso payload — un solo
 * click, un solo JSON, usato da entrambe le tab (Città/Inventario/Alleati
 * legge i campi in cima, Pirati legge `pirateOutpost`).
 *
 * Le aree sbloccate vengono compresse rimuovendo `__class__` e, per le aree
 * standard 4×4, anche `width`/`length` (sono il valore di default e si possono
 * dedurre lato app).
 *
 * Robustezza (v4.1): l'intera costruzione del payload città (+ pirati, se
 * presente) è avvolta in un `try/catch` con `alert` diagnostico
 * (`'Magic wand error: '+e.message`), e ogni campo annidato letto dal client
 * di gioco ha un fallback (`||{}`/`||[]`) prima di essere iterato/spreaddato
 * — nessun punto dello script può più lanciare un'eccezione silenziosa che
 * lascia l'utente senza feedback. Unico punto SENZA `try/catch` è il guard
 * iniziale ("helper non trovato"): è un controllo `if`, non un accesso a
 * campo annidato, non può lanciare.
 */
export const BOOKMARKLET_JS = `javascript:(function(){var E=(typeof ActiveMap!='undefined'?ActiveMap:(typeof FH!='undefined'?FH.ActiveMap:null))||'main';function c(s){function f(){try{var t=document.createElement('textarea');t.value=s;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.focus();t.select();document.execCommand('copy');document.body.removeChild(t);}catch(e){alert('Copy failed: '+e.message);}}navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(s).catch(f):f();}var S=typeof MainParser!='undefined'?MainParser:(typeof FH!='undefined'?FH.Main:null);if(!S||(typeof Allies=='undefined'&&!S.Allies)){alert('No supported helper found (FoE Helfer or Forge Hammer required)');return;}try{var V=E=='OtherPlayer';var M=(V?CityMap.OtherPlayer:CityMap.Main)||{};var A=typeof srcLinks!='undefined'?srcLinks.GetPortrait((V?(typeof Profile!='undefined'&&Profile.otherPlayer&&Profile.otherPlayer.other_player?Profile.otherPlayer.other_player.avatar:null):(typeof ExtPlayerAvatar!='undefined'?ExtPlayerAvatar:(typeof FH!='undefined'?FH.Player.Avatar:null)))):null;var d={_v:${CURRENT_BOOKMARKLET_VERSION},activeMap:E,inventory:V?[]:Object.values(S.Inventory||{}),allies:V?{}:(typeof Allies!='undefined'?Allies.allyList:S.Allies.allyList)||{},CityMapData:(V?M.mapData:S.CityMapData)||{},CityEntities:S.CityEntities||{},UnlockedAreas:(M.unlockedAreas||[]).map(function(o){return o.width==4&&o.length==4?{x:o.x,y:o.y}:{x:o.x,y:o.y,width:o.width,length:o.length};}),portraitUrl:A,playerName:V?M.name:(typeof ExtPlayerName!='undefined'?ExtPlayerName:(typeof FH!='undefined'?FH.Player.Name:null))};if(!V){var o=CityMap&&CityMap.CulturalOutpost;if(o){d.pirateOutpost={_v:${CURRENT_BOOKMARKLET_VERSION},areas:(o.areas||[]).map(function(a){return{x:a.x,y:a.y,width:a.width,length:a.length};}),entities:Object.values(o.data||{}).filter(Boolean).map(function(e){return{x:e.x,y:e.y,cityentity_id:e.cityentity_id,type:e.type};})};}}c(JSON.stringify(d));}catch(e){alert('Magic wand error: '+e.message);}})();`;

// ─── Tipi del payload ──────────────────────────────────────────────────────

/**
 * Una entry di `CityMapData`: un edificio piazzato in città.
 * I dati sono mantenuti grezzi (così come fornisce il gioco).
 */
export interface CityMapEntry {
  cityentity_id?: string;
  type?: string;
  x?: number;
  y?: number;
  connected?: number;
  level?: number;
  max_level?: number;
  bonuses?: unknown[];
  bonus?: unknown;
  state?: { current_product?: unknown };
  [key: string]: unknown;
}

/**
 * Struttura annidata delle risorse statiche di un edificio.
 * Il doppio livello `resources.resources` rispecchia la struttura originale del gioco.
 */
interface StaticResourcesBlock {
  resources?: {
    resources?: { population?: number };
  };
}

/** Un singolo boost dichiarato in CityEntities (es. att_boost_attacker per battleground). */
export interface BoostHint {
  type?: string;
  value?: number;
  targetedFeature?: string;
  [key: string]: unknown;
}

/**
 * Componente di una specifica era di un edificio (es. components.BronzeAge,
 * components.SpaceAgeSpaceHub) oppure la componente comune components.AllAge.
 * Solo i campi effettivamente letti dall'app sono tipizzati; il resto resta libero.
 */
interface EraComponent {
  boosts?: { boosts?: BoostHint[] };
  placement?: { size?: { x?: number; y?: number } };
  staticResources?: StaticResourcesBlock;
  happiness?: { provided?: number };
  streetConnectionRequirement?: unknown;
  chain?: { config?: { bonuses?: Array<{ boosts?: BoostHint[] }> } };
  [key: string]: unknown;
}

/** Livello legacy di un edificio (sistema pre-components). */
interface EntityLevel {
  era?: string;
  provided_population?: number;
  required_population?: number;
  provided_happiness?: number;
  [key: string]: unknown;
}

/** Abilità di un edificio (ChainLinkAbility, BoostAbility, ecc.). */
interface EntityAbility {
  __class__?: string;
  bonusGiven?: { boost?: Record<string, BoostHint> };
  boostHints?: Array<{ boostHintEraMap?: Record<string, BoostHint> }>;
  [key: string]: unknown;
}

/**
 * Una definizione di `CityEntities`: la "scheda" statica di un edificio,
 * con bonus, dimensioni, requisiti stradali, abilità, livelli ecc.
 * Mantenuta grezza per non perdere informazioni che potremmo voler estrarre
 * in futuro.
 */
export interface CityEntityDefinition {
  id?: string;
  name?: string;
  width?: number;
  length?: number;
  type?: string;
  components?: Record<string, EraComponent>;
  abilities?: EntityAbility[];
  entity_levels?: EntityLevel[];
  requirements?: { street_connection_level?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

/** Una entry di `UnlockedAreas`: una porzione 4×4 (o custom) di terreno sbloccato. */
export interface UnlockedArea {
  x: number;
  y: number;
  /** Se assente, il default è 4 (area standard 4×4). */
  width?: number;
  /** Se assente, il default è 4 (area standard 4×4). */
  length?: number;
}

/** Un item dell'inventario del gioco. Forma grezza, normalizzata altrove. */
export interface InventoryItem {
  name?: string;
  inStock?: number;
  item?: {
    __class__?: string;
    cityEntityId?: string;
    selectionKitId?: string;
    upgradeItemId?: string;
    reward?: { assembledReward?: { type?: string; subType?: string; rarity?: { value?: string } } };
    [key: string]: unknown;
  };
  itemAssetName?: string;
  [key: string]: unknown;
}

/** Una entry di `Allies.allyList` (FoE Helper attuale; in passato viveva in
 *  `MainParser.Allies.allyList`, percorso ancora letto in fallback dal
 *  bookmarklet): alleato posseduto dal giocatore. */
export interface RawAlly {
  __class__?: string;
  id?: number;
  allyId?: string;
  level?: number;
  rarity?: { value?: string };
  /** Id dell'istanza edificio sulla mappa che ospita l'alleato. Nel payload
   *  reale è un NUMERO: è parseAllyData a convertirlo con String() nella
   *  chiave (stringa) di CityMapData. Union tipizzata onestamente — il tipo
   *  `string` da solo mentirebbe sul dato che arriva davvero dal gioco. */
  mapEntityId?: string | number;
  [key: string]: unknown;
}

/**
 * Forma del JSON prodotto dal bookmarklet e poi importato dall'app.
 *
 * I 5 blocchi sono tutti obbligatori per considerare un import valido —
 * vedi {@link validateBookmarkletData}.
 */
export interface BookmarkletData {
  /** Versione del bookmarklet. Assente nei payload generati prima dell'introduzione del versionamento. */
  _v?: number;
  /** Mappa attiva al momento della cattura ('main' | 'OtherPlayer'), presente
   *  solo con il bookmarklet v3.1+. Non usato dall'import città/inventario. */
  activeMap?: string;
  inventory: InventoryItem[];
  allies: Record<string, RawAlly>;
  CityMapData: Record<string, CityMapEntry>;
  CityEntities: Record<string, CityEntityDefinition>;
  UnlockedAreas: UnlockedArea[];
  /** URL dell'avatar del giocatore, risolto dal CDN di FoE al momento dell'import.
   *  Presente solo con il bookmarklet aggiornato (versione che cattura ExtPlayerAvatar).
   *  Assente nei payload importati con bookmarklet vecchi. */
  portraitUrl?: string;
  /** Nome del giocatore visitato (CityMap.OtherPlayer.name), usato per proporre
   *  il nome del nuovo profilo all'import. Presente solo con il bookmarklet
   *  aggiornato; assente nei payload importati con bookmarklet vecchi. */
  playerName?: string;
  /** Dati dell'Insediamento dei Pirati (vedi {@link BookmarkletPirateOutpostData}),
   *  presenti in più SOLO dal bookmarklet v4 e SOLO se l'utente ha visitato
   *  il proprio Insediamento nella stessa sessione di gioco (mai in visita da
   *  un altro giocatore). Letto solo da PiratiTool.tsx — il ramo città/
   *  inventario lo ignora del tutto. Vedi commento v4 sopra
   *  CURRENT_BOOKMARKLET_VERSION per il perché della cattura unificata. */
  pirateOutpost?: BookmarkletPirateOutpostData;
}

// ─── Payload Insediamento dei Pirati ───────────────────────────────────────
//
// Ramo separato del bookmarklet (vedi commento v3.1 su BOOKMARKLET_JS): quando
// ActiveMap === 'cultural_outpost' lo script produce questa forma invece di
// BookmarkletData. Tipi/validazione portati 1:1 dal tool standalone
// "foe-pirati" (D:\FOE\pirati\src\bookmarklet.ts).

/** Un'area sbloccata dell'Insediamento (allineata a blocchi 4×4). */
interface BookmarkletPirateArea {
  x: number;
  y: number;
  width: number;
  length: number;
}

/** Un'entità piazzata nell'Insediamento (municipio, ostacolo, edificio). */
export interface BookmarkletPirateEntity {
  x: number;
  y: number;
  cityentity_id: string;
  type: string;
}

/** Forma del JSON prodotto dal ramo 'cultural_outpost' del bookmarklet. */
export interface BookmarkletPirateOutpostData {
  /** Versione del bookmarklet (campo `_v`, vedi CURRENT_BOOKMARKLET_VERSION).
   *  Assente nei payload generati dal bookmarklet v3.1 (prima che questo ramo
   *  avesse `_v`): serve a `PiratiTool` per distinguere "bookmarklet vecchio,
   *  ricrealo" da un generico errore di struttura. */
  _v?: number;
  areas: BookmarkletPirateArea[];
  entities: BookmarkletPirateEntity[];
}

/** Riconosce un payload prodotto da un bookmarklet v3 "puro", PRIMA che la
 *  v3.1 innestasse il branch 'cultural_outpost' (vedi commento v3.1 sopra
 *  CURRENT_BOOKMARKLET_VERSION): quel bookmarklet non ha nessun ramo
 *  Pirati, quindi sull'Insediamento produce comunque il payload città/
 *  inventario (`BookmarkletData`, campi come CityMapData/inventory/allies),
 *  mai `{areas, entities}`. `validateBookmarkletPirateOutpostData` lo
 *  rifiuta già (niente areas/entities), ma con un messaggio generico
 *  "struttura non valida" — questo controllo serve a PiratiTool per
 *  distinguere quel caso specifico e mostrare "bacchetta magica vecchia,
 *  ricreala" invece del generico. */
export function isLegacyBookmarkletPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (Array.isArray(payload.areas) || Array.isArray(payload.entities)) return false;
  return (
    typeof payload.CityMapData === "object" ||
    typeof payload.inventory === "object" ||
    typeof payload.allies === "object" ||
    typeof payload.UnlockedAreas === "object"
  );
}

/**
 * Valida un payload dell'Insediamento dei Pirati. Solo le AREE devono essere
 * tutte ben formate: sono l'ancora dell'offset assoluto→relativo, una
 * malformata renderebbe inaffidabile tutto l'import. Le singole ENTITÀ no:
 * dati reali di gioco possono avere un impediment senza 'y' — vengono
 * filtrate a valle (import Pirati), qui si verifica solo che sia un array.
 */
export function validateBookmarkletPirateOutpostData(value: unknown): value is BookmarkletPirateOutpostData {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (!Array.isArray(payload.areas) || !Array.isArray(payload.entities)) return false;
  return payload.areas.every(
    (a) => a && typeof a === "object" &&
      typeof (a as Record<string, unknown>).x === "number" &&
      typeof (a as Record<string, unknown>).y === "number" &&
      typeof (a as Record<string, unknown>).width === "number" &&
      typeof (a as Record<string, unknown>).length === "number"
  );
}

// ─── Validazione ──────────────────────────────────────────────────────────

/**
 * Esito della validazione del payload. `null` = valido. Altrimenti un oggetto
 * con un `code` STABILE (non testo localizzato: bookmarklet.ts è un modulo dati
 * puro, senza accesso a uiLang/t()). Il chiamante (App.tsx) mappa il code alla
 * stringa tradotta — vedi bookmarkletInvalidFormat / bookmarkletMissingFields
 * in ui-strings.ts. `missingFields` è popolato solo per il code "MISSING_FIELDS".
 */
export type BookmarkletValidationError =
  | { code: "INVALID_FORMAT" }
  | { code: "MISSING_FIELDS"; missingFields: string[] };

/**
 * Valida un payload (tipicamente uscito da `JSON.parse` del contenuto degli
 * appunti) verificando che siano presenti tutti i 5 blocchi attesi e con il
 * tipo corretto.
 *
 * @param parsed payload parsato (qualsiasi cosa, non si fida del tipo in input)
 * @returns `null` se il payload è una {@link BookmarkletData} valida, altrimenti
 *          un {@link BookmarkletValidationError} con codice stabile da tradurre
 *          lato chiamante.
 */
export function validateBookmarkletData(parsed: unknown): BookmarkletValidationError | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { code: "INVALID_FORMAT" };
  }
  const p = parsed as Record<string, unknown>;
  // Normalizzazione, non validazione: il bookmarklet scrive `allies:
  // Allies.allyList` così com'è in game, che per un giocatore senza ancora
  // nessun alleato è `null` (non `{}` — non è il bookmarklet a poterlo
  // sapere/normalizzare, è proprio lo stato del client di gioco). `null` è un
  // caso legittimo ("zero alleati"), non un payload malformato: lo trattiamo
  // qui, PRIMA della validazione sotto, mutando `p.allies` a `{}` così sia il
  // controllo di tipo sia il cast a BookmarkletData più a valle vedono sempre
  // un oggetto valido. Deliberatamente non tocchiamo BOOKMARKLET_JS.
  if (p.allies === null || p.allies === undefined) p.allies = {};
  const missing: string[] = [];
  if (!Array.isArray(p.inventory)) missing.push("inventory");
  if (!p.allies || typeof p.allies !== "object" || Array.isArray(p.allies)) missing.push("allies");
  if (!p.CityMapData || typeof p.CityMapData !== "object" || Array.isArray(p.CityMapData)) missing.push("CityMapData");
  if (!p.CityEntities || typeof p.CityEntities !== "object" || Array.isArray(p.CityEntities)) missing.push("CityEntities");
  if (!Array.isArray(p.UnlockedAreas)) missing.push("UnlockedAreas");
  if (missing.length > 0) {
    return { code: "MISSING_FIELDS", missingFields: missing };
  }
  return null;
}
