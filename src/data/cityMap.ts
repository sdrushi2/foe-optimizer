/**
 * Tipi relativi alla visualizzazione della mappa della città.
 *
 * ⚠️ CONTRATTO DI PERSISTENZA: CityMapBuilding[] viene serializzato COSÌ COM'È
 * nei profili (CityStore.cityMapBuildings) e ripristinato grezzo, senza revive
 * né migrazione (solo un Array.isArray in App.tsx). Conseguenze per chi tocca
 * questa interfaccia:
 *  - AGGIUNGERE un campo è sicuro: nei profili vecchi arriva `undefined`, che
 *    per i booleani è falsy (degradazione dolce: es. niente colore dedicato
 *    finché l'utente non re-importa) e per mapEntityId fa scattare il fallback
 *    aggregato di allySlotsPerBuilding — nessun crash, solo meno precisione.
 *  - RINOMINARE o cambiare il TIPO di un campo rompe silenziosamente i
 *    profili salvati: valutare STORAGE_FORMAT_VERSION (vedi storage.ts).
 */

export interface CityMapBuilding {
  entityId: string;
  /** Id grezzo dell'istanza sulla mappa (chiave in CityMapData), distinto da
   *  entityId (che è il tipo di edificio, uguale per più copie). Permette di
   *  associare una specifica copia al proprio alleato piazzato. */
  mapEntityId: string;
  name: string;
  x: number;
  y: number;
  /** Ingombro in celle: w = asse x, h = asse y della griglia (il produttore in
   *  App.tsx mappa width→w e length→h dai dati di gioco). */
  w: number;
  h: number;
  type: string;
  isGreatBuilding: boolean;
  isMilitary: boolean;
  isNeedlessRoad: boolean;
  /** True se l'edificio è attualmente "inattivo" (declassato a ornamento
   *  dopo la fine di un evento a tempo); non è una decorazione vera. */
  isInactive: boolean;
  isSuppliesProducer: boolean;
  /** Livello di strada richiesto (0/1/2, vedi BuildingModel.requiredRoadLevel)
   *  — usato dall'export JSON della mappa e, dall'11 agosto 2026, anche per il
   *  colore (verde se richiede strada, azzurro se no) nella vista SVG, nel PNG
   *  e nei conteggi della legenda (vedi mapCategory in CityMapView). Nei
   *  profili salvati prima dell'introduzione del campo arriva `undefined`:
   *  colore e legenda lo trattano come "richiede strada", l'export JSON come 0. */
  roadLevel: number;
}

export interface CityMapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
