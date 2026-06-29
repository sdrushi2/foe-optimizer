import { RotateCcw, Download } from "lucide-react";
import type { CityMapBuilding, CityMapBounds } from "../data/cityMap";
import { t, type UiLang } from "../data/ui-strings";

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
    if (b.type === "street") return "#8B7355";
    if (b.type === "main_building") return "#F59E0B";
    if (b.isGreatBuilding) return "#DC2626";
    if (b.isMilitary) return b.isNeedlessRoad ? "url(#needlessMilitaryPattern)" : "#92400E";
    if (b.isNeedlessRoad) return "url(#needlessPattern)";
    if (b.isSuppliesProducer) return "#1D4ED8";
    return "#60A5FA";
  };

  // Celle libere (sbloccate ma non occupate)
  const freeCells: Array<[number, number]> = [];
  cityMapUnlockedCells.forEach((cellKey) => {
    if (!cityMapGrid.has(cellKey)) {
      const [cx, cy] = cellKey.split(",").map(Number);
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
    for (const [px, py] of [[gx, gy], [gx + w, gy], [gx, gy + h], [gx + w, gy + h]]) {
      const p = transformPoint(px, py);
      if (p.x < realMinX) realMinX = p.x;
      if (p.y < realMinY) realMinY = p.y;
      if (p.x > realMaxX) realMaxX = p.x;
      if (p.y > realMaxY) realMaxY = p.y;
    }
  };
  cityMapUnlockedCells.forEach((cellKey) => {
    const [cx, cy] = cellKey.split(",").map(Number);
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
    <div className="px-3 pb-4">
      <div className="flex flex-col lg:flex-row gap-6">
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

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const svgEl = document.querySelector<SVGSVGElement>(".city-map-svg");
                    if (!svgEl) return;
                    const serializer = new XMLSerializer();
                    const svgString = serializer.serializeToString(svgEl);
                    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `foe-map-${new Date().toISOString().slice(0, 10)}.svg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 uppercase transition-colors cursor-pointer"
                >
                  <Download size={13} /> SVG
                </button>
                <button
                  onClick={() => {
                    const svgEl = document.querySelector<SVGSVGElement>(".city-map-svg");
                    if (!svgEl) return;
                    const scale = 4;
                    const svgRect = svgEl.getBBox();
                    const w = svgEl.viewBox.baseVal.width || svgRect.width;
                    const h = svgEl.viewBox.baseVal.height || svgRect.height;
                    const canvas = document.createElement("canvas");
                    canvas.width = w * scale;
                    canvas.height = h * scale;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    // Sfondo nero come nella UI: senza questo il PNG ha sfondo
                    // trasparente e i bordi scuri spariscono su sfondo bianco.
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    const serializer = new XMLSerializer();
                    const svgString = serializer.serializeToString(svgEl);
                    const img = new Image();
                    img.onload = () => {
                      try {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const link = document.createElement("a");
                        link.download = `foe-map-${new Date().toISOString().slice(0, 10)}.png`;
                        link.href = canvas.toDataURL("image/png");
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      } catch (err) {
                        // toDataURL lancia se il canvas è "tainted" (es. SVG con
                        // riferimenti esterni). Avvisiamo invece di fallire muti.
                        console.error("[FOE] PNG export failed:", err);
                        alert(t("exportPngFailedAlert", uiLang));
                      }
                    };
                    img.onerror = () => {
                      console.error("[FOE] Loading SVG for PNG export failed.");
                      alert(t("exportPngFailedAlert", uiLang));
                    };
                    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 uppercase transition-colors cursor-pointer"
                >
                  <Download size={13} /> PNG
                </button>
              </div>
            </div>
          </div>

          {/* Legenda sotto la vista */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">{t("mapLegendTitle", uiLang)}</h4>
            <div className="space-y-3 text-[11px] text-slate-300">
              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#D97706]" style={{ background: "#F59E0B" }} /> {t("legendTownHall", uiLang)}</div>
              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#991B1B]" style={{ background: "#DC2626" }} /> {t("legendGreatBuildings", uiLang)} <span className="ml-1 text-xs font-bold text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded">{cityMapBuildings.filter((b) => b.isGreatBuilding).length}</span></div>
              {cityMapBuildings.some((b) => b.isMilitary) && (
                <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#78350F]" style={{ background: "#92400E" }} /> {t("legendMilitaryBuildings", uiLang)} <span className="ml-1 text-xs font-bold text-amber-600 bg-amber-950/40 px-1.5 py-0.5 rounded">{cityMapBuildings.filter((b) => b.isMilitary).length}</span></div>
              )}
              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#3B82F6]" style={{ background: "#60A5FA" }} /> {t("legendTotalBuildings", uiLang)} <span className="ml-1 text-xs font-bold text-sky-400 bg-sky-950/40 px-1.5 py-0.5 rounded">{cityMapBuildings.filter((b) => !b.isGreatBuilding && !b.isMilitary && !b.isInactive && b.type !== "street").length}</span></div>

              {cityMapBuildings.some((b) => b.isNeedlessRoad) && (
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
                  {t("legendNeedlesslyConnected", uiLang)} <span className="ml-1 text-xs font-bold text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded">{cityMapBuildings.filter((b) => b.isNeedlessRoad).length}</span>
                </div>
              )}

              {cityMapBuildings.some((b) => b.isSuppliesProducer) && (
                <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#1E3A8A]" style={{ background: "#1D4ED8" }} /> {t("legendSuppliesProducers", uiLang)} <span className="ml-1 text-xs font-bold text-blue-400 bg-blue-950/40 px-1.5 py-0.5 rounded">{cityMapBuildings.filter((b) => b.isSuppliesProducer).length}</span></div>
              )}

              {cityMapBuildings.some((b) => b.isInactive) && (
                <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#6B21A8]" style={{ background: "rgba(88,28,135,0.45)" }} /> {t("legendInactive", uiLang)} <span className="ml-1 text-xs font-bold text-violet-400 bg-violet-950/40 px-1.5 py-0.5 rounded">{cityMapBuildings.filter((b) => b.isInactive).length}</span></div>
              )}

              <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#6B5B45]" style={{ background: "#8B7355" }} /> {t("legendStreets", uiLang)} <span className="ml-1 text-xs font-bold text-stone-400 bg-stone-950/40 px-1.5 py-0.5 rounded">{cityMapBuildings.filter((b) => b.type === "street").length}</span></div>

              {freeCells.length > 0 && (
                <div className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded shadow-sm border border-[#064e3b]" style={{ background: "#34D399" }} /> {t("legendFreeSpace", uiLang)} <span className="ml-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded">{freeCells.length}</span></div>
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
                    fill="#34D399"
                    stroke="#064e3b"
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
