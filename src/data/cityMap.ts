/**
 * Tipi relativi alla visualizzazione della mappa della città.
 */

export interface CityMapBuilding {
  entityId: string;
  name: string;
  x: number;
  y: number;
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
}

export interface CityMapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
