import type { Building } from "./buildings";
import type { CityMapEntry } from "./bookmarklet";
import type { CityMapBuilding, CityMapBounds } from "./cityMap";
import type { EraStats, GreatBuilding } from "../models/BuildingModel";

/**
 * Forma serializzata dei dati città salvati nel localStorage del profilo.
 *
 * Tutti i campi Map<K, V> sono serializzati come Array<[K, V]> per
 * compatibilità con JSON; i Set sono serializzati come Array<T>.
 * Il restore avviene tramite reviveMap / reviveSet in App.tsx.
 *
 * Nota architetturale: questa interfaccia importa tipi di dominio
 * (EraStats, GreatBuilding) da models/ per mantenere i tipi vicini
 * alla loro logica di estrazione (BuildingModel.extractEraStats e
 * BuildingModel.fromGreatBuilding). È una dipendenza data/ → models/
 * documentata: il file cityStore.ts è un descrittore di forma
 * persistente, non un processore di dati, quindi la violazione della
 * convenzione "data/ non dipende da models/" è localizzata e accettabile.
 */
export interface CityStore {
  /** entityId → numero di istanze in città (id grezzo dal payload, come da CityMapData) */
  cityEntityIds:           Array<[string, number]>;
  /** entityId → numero di istanze non connesse a strade */
  cityEntityDisconnected:  Array<[string, number]>;
  /** entityId → numero di strade inutili collegate */
  cityEntityNeedlessCount: Array<[string, number]>;
  /** Dati per la mappa visuale della città */
  cityMapBuildings:        CityMapBuilding[];
  /** Bounding box della mappa (null se la mappa è vuota) */
  cityMapBounds:           CityMapBounds | null;
  /** Celle occupate (formato "x,y") */
  cityMapGrid:             string[];
  /** Celle sbloccate dalle UnlockedAreas (formato "x,y") */
  cityMapUnlockedCells:    string[];
  /** Grandi Edifici presenti in città (entityId → GB) */
  greatBuildingsJson:      Array<[string, GreatBuilding]>;
  /** Edifici in città che matchano il CSV */
  matchedJson:             Array<[string, CityMapEntry]>;
  /** Edifici in città NON nel CSV (candidate per fallback) */
  unmatchedJson:           Array<[string, CityMapEntry]>;
  /** Edifici fallback costruiti dai CityEntities non nel CSV */
  fallbackBuildings:       Array<[string, Building]>;
  /** Era corrente del giocatore (estratta dal municipio, es. "ModernEra") */
  currentEra:              string;
  /**
   * Statistiche reali (att/dif, IQ) per era corrente, estratte da
   * CityEntities. Chiave: entityId grezzo dal payload (combacia con il
   * cityEntityId dei Building del CSV, stessa fonte MainParser, stesso case).
   */
  eraStats:                Array<[string, EraStats]>;
  /**
   * Livello minimo in città per ogni entityId (id grezzo dal payload).
   * "level" corrisponde all'era dell'edificio (0=StoneAge ... 22=SpaceAgeSpaceHub).
   */
  entityLevels:            Array<[string, number]>;
  /**
   * Lista completa di tutti i livelli presenti in città per ogni entityId
   * (id grezzo dal payload). Usata nel tooltip "edificio obsoleto" per mostrare
   * quante copie sono indietro di quante ere, invece del solo valore minimo.
   * Es. entityLevelsList["W_MultiAge_foo"] = [18, 19, 21] → una copia era 18,
   * una era 19, una era 21 (= corrente SpaceHub).
   */
  entityLevelsList:        Array<[string, number[]]>;
  /**
   * Per ogni entityId (id grezzo dal payload), le statistiche di produzione
   * raggruppate per era. Usata nel riepilogo "Produzioni e Statistiche" per
   * calcolare i totali esatti quando le copie di un edificio sono in ere diverse.
   * Struttura: [entityId, [[eraAge, count, EraStats], ...]]
   */
  entityInstanceEraStats:  Array<[string, Array<[string, number, EraStats]>]>;
  /**
   * Nomi originali dal gioco (CityEntities.name). Chiave: entityId grezzo
   * dal payload (combacia con il cityEntityId dei Building del CSV, stessa
   * fonte MainParser). Usati per mostrare i nomi nella lingua del client
   * del giocatore.
   */
  gameNames:               Array<[string, string]>;
  /** Lingua rilevata dal gioco (dal nome del municipio). Default "it" se il
   *  rilevamento non riesce. */
  gameLang:                "it" | "en";
}
