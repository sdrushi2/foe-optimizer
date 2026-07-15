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
 * funziona sia con FoE Helper aggiornato sia con versioni precedenti — ma il
 * bump di versione resta comunque utile per intercettare, in futuro, chi sta
 * ancora usando lo script v1 salvato nei preferiti.
 */
export const CURRENT_BOOKMARKLET_VERSION = 2;

/**
 * Codice JavaScript del bookmarklet "bacchetta magica".
 *
 * L'utente lo trascina nella barra dei preferiti del browser; clickandolo
 * mentre Forge of Empires è aperto, raccoglie i 5 oggetti globali del gioco
 * (`MainParser.Inventory`, `Allies.allyList` — con fallback su
 * `MainParser.Allies.allyList` per FoE Helper non aggiornato — `MainParser.CityMapData`,
 * `MainParser.CityEntities`, `CityMap.Main.unlockedAreas`), li serializza in
 * JSON con la forma {@link BookmarkletData} e li copia negli appunti.
 *
 * Le aree sbloccate vengono compresse rimuovendo `__class__` e, per le aree
 * standard 4×4, anche `width`/`length` (sono il valore di default e si possono
 * dedurre lato app).
 */
export const BOOKMARKLET_JS = `javascript:(function(){try{var data={_v:${CURRENT_BOOKMARKLET_VERSION},inventory:Object.values(MainParser.Inventory),allies:typeof Allies!=='undefined'?Allies.allyList:MainParser.Allies.allyList,CityMapData:MainParser.CityMapData,CityEntities:MainParser.CityEntities,UnlockedAreas:CityMap.Main.unlockedAreas.map(o=>o.width==4&&o.length==4?(({width,length,__class__:_,...r})=>r)(o):(({__class__:_,...r})=>r)(o)),portraitUrl:typeof ExtPlayerAvatar!=='undefined'&&typeof srcLinks!=='undefined'?srcLinks.GetPortrait(ExtPlayerAvatar):undefined};var s=JSON.stringify(data);function fb(){try{var t=document.createElement('textarea');t.value=s;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.focus();t.select();document.execCommand('copy');document.body.removeChild(t);}catch(e2){alert('Copy failed: '+e2.message);}}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(s).catch(fb);}else{fb();}}catch(e){alert('Magic wand error: '+e.message);}})();`;

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

/** Una entry di `MainParser.Allies.allyList`: alleato posseduto dal giocatore. */
export interface RawAlly {
  __class__?: string;
  id?: number;
  allyId?: string;
  level?: number;
  rarity?: { value?: string };
  mapEntityId?: string;
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
  inventory: InventoryItem[];
  allies: Record<string, RawAlly>;
  CityMapData: Record<string, CityMapEntry>;
  CityEntities: Record<string, CityEntityDefinition>;
  UnlockedAreas: UnlockedArea[];
  /** URL dell'avatar del giocatore, risolto dal CDN di FoE al momento dell'import.
   *  Presente solo con il bookmarklet aggiornato (versione che cattura ExtPlayerAvatar).
   *  Assente nei payload importati con bookmarklet vecchi. */
  portraitUrl?: string;
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
