import { RotateCcw, Download, Pencil } from "lucide-react";
import type { CityMapBuilding, CityMapBounds } from "../data/cityMap";
import type { UnlockedArea } from "../data/bookmarklet";
import { t, type UiLang } from "../data/ui-strings";
import { parseNumberPair } from "../data/piratiBuildings";
import { localDateStamp } from "../utils/format";
import { esportaCittaJson, scaricaJson } from "../data/cityMapJson";
import { coloreEdificioMappa, renderCityMapPng, MAP_COLOR_GREAT_BUILDING, MAP_COLOR_TOWN_HALL, MAP_COLOR_ROAD_REQUIRED, MAP_COLOR_NO_ROAD_REQUIRED, MAP_COLOR_STREET, MAP_COLOR_MILITARY, MAP_COLOR_INACTIVE, PNG_COLOR_FREE } from "./cityMapPng";


/** Ascoltatore del canale con l'editor aperto dal pannello MAPPA (uno solo alla volta). */
let ascoltoEditorMappa: ((ev: MessageEvent) => void) | null = null;
/** Apre l'editor esterno (public/editor.html) con la città della mappa: quando
 *  l'editor è pronto riceve {tipo:"carica", planner:false} (export JSON +
 *  colori della vista MAPPA). Senza ritorno: dalla MAPPA si salva solo il JSON. */
function apriEditorMappa(buildings: readonly CityMapBuilding[], aree: readonly UnlockedArea[], uiLang: UiLang): void {
  const w = window.open("/editor.html", "foe-editor-mappa");
  if (!w) {
    alert(uiLang === "it" ? "Il browser ha bloccato la finestra dell'editor: consenti i popup per questo sito." : "The browser blocked the editor window: allow pop-ups for this site.");
    return;
  }
  if (ascoltoEditorMappa) window.removeEventListener("message", ascoltoEditorMappa);
  ascoltoEditorMappa = (ev: MessageEvent) => {
    if (ev.origin !== location.origin || ev.source !== w || (ev.data as { tipo?: string } | null)?.tipo !== "pronto") return;
    const idMap = new Map<string, string>();
    const json = esportaCittaJson(buildings, aree, idMap);
    const perId = new Map(buildings.map(b => [b.mapEntityId, b]));
    const colori: Record<string, string> = {};
    for (const [jid, mid] of idMap) {
      const b = perId.get(mid);
      if (b) colori[jid] = coloreEdificioMappa({ ...b, isTownhall: b.type === "main_building", isStreet: b.type === "street" });
    }
    w.postMessage({ tipo: "carica", planner: false, json, colori, nomeMunicipio: t("legendTownHall", uiLang), lang: uiLang }, location.origin);
  };
  window.addEventListener("message", ascoltoEditorMappa);
  w.focus();
}


/** Categoria con cui un edificio viene disegnato nella mappa SVG a schermo:
 *  unica fonte sia per il colore (getBuildingColor) sia per i conteggi della
 *  legenda, così ogni edificio è contato una volta sola, nella voce del colore
 *  con cui appare. Prima i conteggi avevano filtri propri: gli edifici
 *  "collegati senza bisogno" (disegnati a righe) finivano anche in "Non richiede
 *  strada", e quelli senza roadLevel (profili salvati prima del campo) erano
 *  disegnati in verde ma non contati da nessuna parte (bug corretto settembre
 *  2026). Stessa priorità del disegno: prima gli inattivi (viola), poi Grandi
 *  Edifici, militari (a righe se collegati senza bisogno), collegati senza
 *  bisogno, infine strada richiesta sì/no — roadLevel diverso da 0, incluso
 *  undefined, conta come "richiede strada", esattamente come il colore verde. */
type MapCategory = "street" | "townhall" | "inactive" | "great" | "military" | "needless" | "noRoad" | "road";

function mapCategory(b: CityMapBuilding): MapCategory {
  if (b.type === "street") return "street";
  if (b.type === "main_building") return "townhall";
  if (b.isInactive) return "inactive";
  if (b.isGreatBuilding) return "great";
  if (b.isMilitary) return "military";
  if (b.isNeedlessRoad) return "needless";
  return b.roadLevel === 0 ? "noRoad" : "road";
}

export type CityMapDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

interface CityMapViewProps {
  cityMapBuildings: CityMapBuilding[];
  cityMapBounds: CityMapBounds | null;
  cityMapUnlockedCells: Set<string>;
  /** Aree sbloccate ORIGINALI (rettangoli x/y/width?/length?), grezze dal
   *  payload — usate SOLO dall'export JSON (mostra i rettangoli reali del
   *  gioco invece delle singole celle di cityMapUnlockedCells, usate invece
   *  per il rendering). Può essere vuoto sui profili salvati prima
   *  dell'introduzione di questo campo (luglio 2026): l'export gestisce
   *  l'array vuoto senza errori, semplicemente non mostra espansioni. */
  cityMapUnlockedAreas: UnlockedArea[];
  cityMapGrid: Set<string>;
  highlightedCityEntityIds: Set<string>;
  cityMapView: "vertical" | "isometric";
  setCityMapView: (v: "vertical" | "isometric") => void;
  cityMapCellSize: number;
  setCityMapCellSize: React.Dispatch<React.SetStateAction<number>>;
  cityMapPan: { x: number; y: number };
  setCityMapPan: (p: { x: number; y: number }) => void;
  cityMapDragStart: CityMapDragState | null;
  setCityMapDragStart: (v: CityMapDragState | null) => void;
  /** Hover su un edificio: riceve entityId, nome e posizione schermo (per il popup immagine). */
  onBuildingHover?: (entityId: string, name: string, clientX: number, clientY: number) => void;
  /** Uscita dal rettangolo di un edificio. */
  onBuildingLeave?: () => void;
  /** Click su un edificio della mappa: riceve il cityEntityId cliccato. */
  onBuildingClick?: (entityId: string) => void;
  uiLang: UiLang;
}

export default function CityMapView({
  cityMapBuildings,
  cityMapBounds,
  cityMapUnlockedCells,
  cityMapUnlockedAreas,
  cityMapGrid,
  highlightedCityEntityIds,
  cityMapView,
  setCityMapView,
  cityMapCellSize,
  setCityMapCellSize,
  cityMapPan,
  setCityMapPan,
  cityMapDragStart,
  setCityMapDragStart,
  onBuildingHover,
  onBuildingLeave,
  onBuildingClick,
  uiLang,
}: CityMapViewProps) {
  if (!cityMapBounds || cityMapBuildings.length === 0) return null;

  const { minX, minY, maxX, maxY } = cityMapBounds;
  const cols = maxX - minX;
  const rows = maxY - minY;
  const CELL = cityMapCellSize;

  const BORDER_COLOR = "#1e293b";

  const getBuildingColor = (b: CityMapBuilding): string => {
    switch (mapCategory(b)) {
      case "street": return MAP_COLOR_STREET;
      case "townhall": return MAP_COLOR_TOWN_HALL;
      case "inactive": return MAP_COLOR_INACTIVE;
      case "great": return MAP_COLOR_GREAT_BUILDING;
      case "military": return b.isNeedlessRoad ? "url(#needlessMilitaryPattern)" : MAP_COLOR_MILITARY;
      case "needless": return "url(#needlessPattern)";
      case "noRoad": return MAP_COLOR_NO_ROAD_REQUIRED;
      case "road": return MAP_COLOR_ROAD_REQUIRED;
    }
  };

  // Conteggi della legenda per categoria di disegno (vedi mapCategory).
  const categoryCounts: Record<MapCategory, number> = { street: 0, townhall: 0, inactive: 0, great: 0, military: 0, needless: 0, noRoad: 0, road: 0 };
  cityMapBuildings.forEach((b) => { categoryCounts[mapCategory(b)]++; });

  // Celle libere (sbloccate ma non occupate)
  const freeCells: Array<[number, number]> = [];
  cityMapUnlockedCells.forEach((cellKey) => {
    if (!cityMapGrid.has(cellKey)) {
      const [cx, cy] = parseNumberPair(cellKey, ",");
      freeCells.push([cx, cy]);
    }
  });

  const mapWidth = cols * CELL;
  const mapHeight = rows * CELL;
  const isIsometric = cityMapView === "isometric";
  const ISO_SCALE_X = 1.4;
  const ISO_SCALE_Y = 0.7;
  const ISO_ROTATE_DEG = 45;
  const centerX = mapWidth / 2;
  const centerY = mapHeight / 2;
  const isoTransform = `translate(${centerX} ${centerY}) scale(${ISO_SCALE_X} ${ISO_SCALE_Y}) rotate(${ISO_ROTATE_DEG}) translate(${-centerX} ${-centerY})`;

  const transformPoint = (x: number, y: number) => {
    if (!isIsometric) return { x, y };
    const rad = (ISO_ROTATE_DEG * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = x - centerX;
    const dy = y - centerY;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return {
      x: centerX + rx * ISO_SCALE_X,
      y: centerY + ry * ISO_SCALE_Y,
    };
  };

  const transformedCorners = [
    transformPoint(0, 0),
    transformPoint(mapWidth, 0),
    transformPoint(mapWidth, mapHeight),
    transformPoint(0, mapHeight),
  ];

  // Bounding box del RETTANGOLO contenitore (usato per il caso "vertical",
  // dove non c'è rotazione e i 4 angoli bastano).
  const transformedMinX = Math.min(...transformedCorners.map((p) => p.x));
  const transformedMinY = Math.min(...transformedCorners.map((p) => p.y));
  const transformedMaxX = Math.max(...transformedCorners.map((p) => p.x));
  const transformedMaxY = Math.max(...transformedCorners.map((p) => p.y));

  // In isometrico il rettangolo pieno (0,0)-(mapWidth,mapHeight) ruotato è un
  // rombo che eccede di molto la forma reale della città: gli angoli del rombo
  // non hanno quasi mai edifici. Usare quel bounding box (con offset fissi
  // calibrati a mano) ha tagliato edifici reali su città di forma diversa da
  // quella su cui erano stati calibrati i numeri. Calcoliamo invece il
  // bounding box reale trasformando ogni cella EFFETTIVAMENTE sbloccata E ogni
  // edificio piazzato: si adatta a qualsiasi forma di città, senza offset
  // empirici. Le due fonti possono divergere (un edificio può occupare celle
  // che le aree sbloccate non coprono esattamente), quindi servono entrambe —
  // usare solo le celle sbloccate ha lasciato fuori edifici reali.
  let realMinX = Infinity, realMinY = Infinity, realMaxX = -Infinity, realMaxY = -Infinity;
  const accumulateBounds = (gx: number, gy: number, w: number, h: number) => {
    // Tipizzato esplicitamente come tupla [number, number][]: senza questa
    // annotazione l'array letterale è inferito number[][], e la
    // destrutturazione [px, py] diventerebbe number | undefined nonostante
    // i 4 elementi (i 4 angoli del rettangolo) siano tutti fissi qui sopra.
    const corners: Array<[number, number]> = [[gx, gy], [gx + w, gy], [gx, gy + h], [gx + w, gy + h]];
    for (const [px, py] of corners) {
      const p = transformPoint(px, py);
      if (p.x < realMinX) realMinX = p.x;
      if (p.y < realMinY) realMinY = p.y;
      if (p.x > realMaxX) realMaxX = p.x;
      if (p.y > realMaxY) realMaxY = p.y;
    }
  };
  cityMapUnlockedCells.forEach((cellKey) => {
    const [cx, cy] = parseNumberPair(cellKey, ",");
    accumulateBounds((cx - minX) * CELL, (cy - minY) * CELL, CELL, CELL);
  });
  cityMapBuildings.forEach((b) => {
    accumulateBounds((b.x - minX) * CELL, (b.y - minY) * CELL, b.w * CELL, b.h * CELL);
  });
  // Fallback al rettangolo pieno se non ci sono celle/edifici noti (non
  // dovrebbe succedere con cityMapBuildings.length > 0, ma resta robusto).
  const hasRealBounds = Number.isFinite(realMinX) && Number.isFinite(realMaxX);
  // Margine di respiro fisso e simmetrico (non un offset "indovinato" per
  // forma): mezza cella su ogni lato, più un po' in verticale per le ombre/
  // l'altezza degli edifici che sporgono oltre la loro cella base.
  const PAD = CELL * 0.5;
  const viewMinX = isIsometric ? (hasRealBounds ? realMinX - PAD : transformedMinX) : (transformedMinX - 1);
  const viewMinY = isIsometric ? (hasRealBounds ? realMinY - CELL : transformedMinY) : (transformedMinY - 1);
  const viewWidth = isIsometric ? (hasRealBounds ? (realMaxX - realMinX) + PAD * 2 : (transformedMaxX - transformedMinX)) : (transformedMaxX - transformedMinX + 2);
  const viewHeight = isIsometric ? (hasRealBounds ? (realMaxY - realMinY) + CELL * 1.5 : (transformedMaxY - transformedMinY)) : (transformedMaxY - transformedMinY + 2);

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="lg:w-64 shrink-0 space-y-4">
          {/* Riquadro VISTA MAPPA */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">{t("mapViewTitle", uiLang)}</h4>

            <div className="space-y-3">
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                <button
                  onClick={() => setCityMapView("vertical")}
                  className={`flex-1 px-3 py-1.5 text-[11px] font-bold uppercase transition-colors cursor-pointer ${cityMapView === "vertical" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                >
                  {t("mapViewVertical", uiLang)}
                </button>
                <button
                  onClick={() => setCityMapView("isometric")}
                  className={`flex-1 px-3 py-1.5 text-[11px] font-bold uppercase transition-colors cursor-pointer ${cityMapView === "isometric" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                >
                  {t("mapViewIsometric", uiLang)}
                </button>
              </div>

              {/* Zoom */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCityMapCellSize((prev) => Math.max(4, prev - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-white active:scale-95 transition-all font-bold text-sm cursor-pointer select-none"
                  title={t("zoomOutTitle", uiLang)}
                >
                  -
                </button>
                <input
                  type="range"
                  min="4"
                  max="32"
                  step="1"
                  value={cityMapCellSize}
                  onChange={(e) => setCityMapCellSize(parseInt(e.target.value, 10))}
                  className="h-1.5 flex-1 rounded-lg bg-slate-800 accent-amber-500 cursor-pointer"
                />
                <button
                  onClick={() => setCityMapCellSize((prev) => Math.min(32, prev + 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-white active:scale-95 transition-all font-bold text-sm cursor-pointer select-none"
                  title={t("zoomInTitle", uiLang)}
                >
                  +
                </button>
                <button
                  onClick={() => setCityMapCellSize(9)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-slate-300 active:scale-95 transition-all cursor-pointer select-none"
                  title={t("zoomResetTitle")}
                >
                  <RotateCcw size={13} />
                </button>
              </div>

              {/* gap-1.5/px-2 invece di gap-2/px-3: con 2 pulsanti (PNG/JSON)
                  nel riquadro a larghezza fissa (lg:w-64) il padding largo li
                  faceva andare a capo — ridotto per farli stare sulla stessa
                  riga senza flex-wrap. */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    if (cityMapUnlockedAreas.length === 0) {
                      // Senza aree sbloccate non c'è modo di calcolare la
                      // griglia (bounding box, celle libere/non disponibili):
                      // capita sui profili salvati prima dell'introduzione di
                      // questo campo (luglio 2026) — l'unico rimedio è un
                      // re-import, e il messaggio lo dice (prima era lo stesso
                      // dell'errore generico, che consigliava un export SVG
                      // ormai rimosso).
                      alert(t("exportPngNeedsReimportAlert", uiLang));
                      return;
                    }
                    try {
                      const canvas = document.createElement("canvas");
                      renderCityMapPng(canvas, cityMapBuildings, cityMapUnlockedAreas, 2, t("legendTownHall", uiLang));
                      const link = document.createElement("a");
                      link.download = `foe-map-${localDateStamp()}.png`;
                      link.href = canvas.toDataURL("image/png");
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } catch (err) {
                      console.error("[FOE] PNG export failed:", err);
                      alert(t("exportPngFailedAlert", uiLang));
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-2 text-[11px] font-bold text-slate-300 uppercase transition-colors cursor-pointer"
                >
                  <Download size={13} /> PNG
                </button>
                <button
                  onClick={() => {
                    // Sottoinsieme del payload del bookmarklet (CityMapData /
                    // CityEntities / UnlockedAreas), strade comprese: si apre
                    // nei planner esterni che leggono il payload intero (vedi
                    // data/cityMapJson.ts).
                    scaricaJson(esportaCittaJson(cityMapBuildings, cityMapUnlockedAreas), `foe-map-${localDateStamp()}.json`);
                  }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-2 text-[11px] font-bold text-slate-300 uppercase transition-colors cursor-pointer"
                >
                  <Download size={13} /> JSON
                </button>
                <button
                  onClick={() => apriEditorMappa(cityMapBuildings, cityMapUnlockedAreas, uiLang)}
                  title={uiLang === "it" ? "Apre la città nell'editor (nuova scheda): sposta, duplica, togli edifici e strade, poi salva il JSON" : "Opens the city in the editor (new tab): move, duplicate, remove buildings and roads, then save the JSON"}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-2 text-[11px] font-bold text-slate-300 uppercase transition-colors cursor-pointer"
                >
                  <Pencil size={13} /> Editor
                </button>
              </div>
            </div>
          </div>

          {/* Legenda sotto la vista */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">{t("mapLegendTitle", uiLang)}</h4>
            <div className="space-y-3 text-[11px] text-slate-300">
              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm" style={{ background: MAP_COLOR_TOWN_HALL, borderColor: MAP_COLOR_TOWN_HALL, borderWidth: 1, borderStyle: "solid" }} /> {t("legendTownHall", uiLang)}</div>
              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm" style={{ background: MAP_COLOR_GREAT_BUILDING, borderColor: MAP_COLOR_GREAT_BUILDING, borderWidth: 1, borderStyle: "solid" }} /> {t("legendGreatBuildings", uiLang)} <span className="ml-1 text-xs font-bold text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded">{categoryCounts.great}</span></div>
              {categoryCounts.military > 0 && (
                <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#78350F]" style={{ background: "#92400E" }} /> {t("legendMilitaryBuildings", uiLang)} <span className="ml-1 text-xs font-bold text-amber-600 bg-amber-950/40 px-1.5 py-0.5 rounded">{categoryCounts.military}</span></div>
              )}
              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm" style={{ background: MAP_COLOR_ROAD_REQUIRED, borderColor: MAP_COLOR_ROAD_REQUIRED, borderWidth: 1, borderStyle: "solid" }} /> {t("legendRoadRequired", uiLang)} <span className="ml-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded">{categoryCounts.road}</span></div>
              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm" style={{ background: MAP_COLOR_NO_ROAD_REQUIRED, borderColor: MAP_COLOR_NO_ROAD_REQUIRED, borderWidth: 1, borderStyle: "solid" }} /> {t("legendNoRoadRequired", uiLang)} <span className="ml-1 text-xs font-bold text-sky-400 bg-sky-950/40 px-1.5 py-0.5 rounded">{categoryCounts.noRoad}</span></div>

              {categoryCounts.needless > 0 && (
                <div className="flex items-center gap-3 font-medium">
                  <svg width="16" height="16" className="rounded shadow-sm shrink-0" style={{ border: "1px solid #3B82F6" }}>
                    <defs>
                      <pattern id="needlessLegend" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="8" height="8" fill="#60A5FA" />
                        <rect x="0" y="0" width="4" height="8" fill="#1E40AF" />
                      </pattern>
                    </defs>
                    <rect width="16" height="16" fill="url(#needlessLegend)" />
                  </svg>
                  {t("legendNeedlesslyConnected", uiLang)} <span className="ml-1 text-xs font-bold text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded">{categoryCounts.needless}</span>
                </div>
              )}

              {categoryCounts.inactive > 0 && (
                <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#6B21A8]" style={{ background: "rgba(88,28,135,0.45)" }} /> {t("legendInactive", uiLang)} <span className="ml-1 text-xs font-bold text-violet-400 bg-violet-950/40 px-1.5 py-0.5 rounded">{categoryCounts.inactive}</span></div>
              )}

              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#6B5B45]" style={{ background: "#8B7355" }} /> {t("legendStreets", uiLang)} <span className="ml-1 text-xs font-bold text-stone-400 bg-stone-950/40 px-1.5 py-0.5 rounded">{categoryCounts.street}</span></div>

              {freeCells.length > 0 && (
                <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm" style={{ background: PNG_COLOR_FREE, borderColor: "#a89b3f", borderWidth: 1, borderStyle: "solid" }} /> {t("legendFreeSpace", uiLang)} <span className="ml-1 text-xs font-bold text-amber-200 bg-amber-950/40 px-1.5 py-0.5 rounded">{freeCells.length}</span></div>
              )}

              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-slate-700" style={{ background: "#000000" }} /> {t("legendUnavailableSpace", uiLang)}</div>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-800 text-[10px] text-slate-500 italic leading-relaxed">
              {t("mapLegendFootnote", uiLang)}
            </div>
          </div>
        </div>

        <div
          className={`flex-1 overflow-hidden rounded-xl border border-slate-800 bg-black p-2 shadow-inner h-[70vh] min-h-[420px] flex items-center justify-center select-none ${cityMapDragStart ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setCityMapDragStart({
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              originX: cityMapPan.x,
              originY: cityMapPan.y,
            });
          }}
          onPointerMove={(event) => {
            if (!cityMapDragStart) return;
            setCityMapPan({
              x: cityMapDragStart.originX + event.clientX - cityMapDragStart.startX,
              y: cityMapDragStart.originY + event.clientY - cityMapDragStart.startY,
            });
          }}
          onPointerUp={(event) => {
            if (cityMapDragStart?.pointerId === event.pointerId) {
              event.currentTarget.releasePointerCapture(event.pointerId);
              // preventDefault() su pointerdown sopprime l'evento "click"
              // sintetico che il browser genererebbe normalmente dopo un
              // pointerup — quindi il click sugli edifici NON può fare
              // affidamento sull'onClick nativo del <rect>: lo rileviamo qui,
              // confrontando lo spostamento totale dal punto di partenza.
              // Sotto la soglia = è stato un click (non un drag-pan).
              const movedX = event.clientX - cityMapDragStart.startX;
              const movedY = event.clientY - cityMapDragStart.startY;
              const distance = Math.sqrt(movedX * movedX + movedY * movedY);
              if (distance < 5 && onBuildingClick) {
                // event.target qui è SEMPRE il contenitore che ha fatto
                // setPointerCapture al pointerdown (la capture redirige tutti
                // i pointer event successivi a quell'elemento, non a dove si
                // trova realmente il cursore) — quindi non possiamo leggere
                // l'edificio da event.target. elementFromPoint interroga
                // invece cosa il browser sta visivamente disegnando in quel
                // punto dello schermo, bypassando la capture.
                const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
                const entityId = elementAtPoint?.getAttribute?.("data-entity-id");
                if (entityId) onBuildingClick(entityId);
              }
              setCityMapDragStart(null);
            }
          }}
          onPointerCancel={() => setCityMapDragStart(null)}
        >
          <div
            className="shrink-0"
            style={{
              transform: `translate(${cityMapPan.x}px, ${cityMapPan.y}px)`,
              willChange: "transform",
            }}
          >
            <svg
              className="city-map-svg"
              viewBox={`${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}`}
              width={viewWidth}
              height={viewHeight}
              style={{ maxWidth: "none", height: "auto" }}
              shapeRendering="crispEdges"
            >
              <defs>
                <pattern id="needlessPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="8" height="8" fill="#60A5FA" />
                  <rect x="0" y="0" width="4" height="8" fill="#1E40AF" />
                </pattern>
                <pattern id="needlessMilitaryPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="8" height="8" fill="#780606" />
                  <rect x="0" y="0" width="4" height="8" fill="#4A2007" />
                </pattern>
              </defs>
              <rect x={viewMinX} y={viewMinY} width={viewWidth} height={viewHeight} fill="#000000" />

              <g transform={isIsometric ? isoTransform : undefined}>
                {freeCells.map(([gx, gy]) => (
                  <rect
                    key={`empty-${gx}-${gy}`}
                    className="city-map-building"
                    x={(gx - minX) * CELL}
                    y={(gy - minY) * CELL}
                    width={CELL}
                    height={CELL}
                    fill={PNG_COLOR_FREE}
                    stroke="#a89b3f"
                    strokeWidth={0.1}
                  />
                ))}

                {[...cityMapBuildings]
                  .sort((a, b) => Number(highlightedCityEntityIds.has(a.entityId)) - Number(highlightedCityEntityIds.has(b.entityId)))
                  .map((b, i) => {
                    const isHighlighted = highlightedCityEntityIds.has(b.entityId);
                    const isClickable = b.type !== "street" && b.type !== "main_building" && !!onBuildingClick;
                    const fill = b.isInactive
                      ? "rgba(88,28,135,0.45)"
                      : isHighlighted
                        ? "rgba(251,191,36,0.72)"
                        : getBuildingColor(b);
                    const stroke = isHighlighted ? "#FBBF24" : BORDER_COLOR;
                    const strokeWidth = isHighlighted ? 2 : 1;
                    return (
                      <rect
                        key={`b-${b.entityId}-${b.x}-${b.y}-${i}`}
                        className={`city-map-building${isClickable ? " cursor-pointer" : ""}`}
                        data-entity-id={isClickable ? b.entityId : undefined}
                        x={(b.x - minX) * CELL}
                        y={(b.y - minY) * CELL}
                        width={b.w * CELL}
                        height={b.h * CELL}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        onMouseEnter={(e) => onBuildingHover?.(b.entityId, b.name, e.clientX, e.clientY)}
                        onMouseMove={(e) => onBuildingHover?.(b.entityId, b.name, e.clientX, e.clientY)}
                        onMouseLeave={() => onBuildingLeave?.()}
                      >
                        <title>{b.name}</title>
                      </rect>
                    );
                  })}
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
