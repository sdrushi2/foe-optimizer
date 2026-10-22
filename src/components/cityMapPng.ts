// ─────────────────────────────────────────────────────────────────────────────
//  components/cityMapPng.ts — Palette della vista MAPPA ed export PNG
//
//  UNICO codice per l'export PNG della città, usato da: pannello MAPPA
//  (CityMapView), Planner (PlannerView) ed editor esterno (public/editor.html,
//  tramite src/editor/condiviso.ts compilato in /editor-condiviso.js, vedi il
//  plugin editorCondivisoPlugin in vite.config.ts). Nessuna dipendenza da
//  Preact o dalle traduzioni, così il pacchetto dell'editor resta piccolo.
// ─────────────────────────────────────────────────────────────────────────────

import type { UnlockedArea } from "../data/bookmarklet";

/** Edificio o tessera strada da disegnare (CityMapBuilding è compatibile).
 *  `colore` (facoltativo) sostituisce il colore calcolato dalle categorie. */
export interface PngEdificio {
  x: number; y: number; w: number; h: number;
  type: string; name: string;
  isGreatBuilding?: boolean; isMilitary?: boolean; isInactive?: boolean; roadLevel?: number;
  colore?: string;
}

/** Colori per categoria edificio: condivisi tra il render PNG "a griglia"
 *  (renderCityMapPng) e il rendering SVG a schermo (getBuildingColor) —
 *  stessa palette in entrambe le viste, richiesta esplicita dell'utente.
 *  I 3 colori "PNG_*" restano usati solo dal render PNG (sfondo/celle
 *  libere/celle strada, che l'SVG a schermo gestisce diversamente con la
 *  griglia di sfondo e le celle di cityMapUnlockedCells). */
export const MAP_COLOR_GREAT_BUILDING = "#e6542f";
export const MAP_COLOR_TOWN_HALL = "#ffb300";
export const MAP_COLOR_ROAD_REQUIRED = "#5dd15d";
/** Edifici che richiedono una strada a 2 corsie: verde più scuro (ottobre 2026). */
export const MAP_COLOR_ROAD2_REQUIRED = "#237a34";
export const MAP_COLOR_NO_ROAD_REQUIRED = "#7abaff";
export const MAP_COLOR_STREET = "#8B7355";
export const MAP_COLOR_MILITARY = "#92400E";
export const MAP_COLOR_INACTIVE = "rgba(88,28,135,0.45)";
export const PNG_COLOR_FREE = "#fffead";
const PNG_COLOR_UNAVAILABLE = "#000000";

/** Colore "piatto" di un edificio con la palette della vista MAPPA (unica
 *  fonte, richiesta dell'utente: MAPPA, PNG e Planner con gli stessi colori),
 *  stessa priorità di mapCategory ma SENZA la "zebra" dei collegati senza
 *  bisogno (nel PNG e nel Planner restano col colore della loro categoria) e
 *  SENZA il viola degli inattivi (richiesta dell'utente, 19/10/2026): nel PNG,
 *  nel Planner e nell'editor un edificio inattivo è verde o azzurro secondo la
 *  strada richiesta; il viola resta solo nella vista MAPPA (getBuildingColor).
 *  `isInactive` resta nella firma perché gli oggetti passati lo contengono. */
export function coloreEdificioMappa(b: { isTownhall?: boolean; isInactive?: boolean; isGreatBuilding?: boolean; isMilitary?: boolean; roadLevel?: number; isStreet?: boolean }): string {
  if (b.isStreet) return MAP_COLOR_STREET;
  if (b.isTownhall) return MAP_COLOR_TOWN_HALL;
  if (b.isGreatBuilding) return MAP_COLOR_GREAT_BUILDING;
  if (b.isMilitary) return MAP_COLOR_MILITARY;
  if (b.roadLevel === 0) return MAP_COLOR_NO_ROAD_REQUIRED;
  return (b.roadLevel ?? 1) >= 2 ? MAP_COLOR_ROAD2_REQUIRED : MAP_COLOR_ROAD_REQUIRED;
}
const PNG_CELL = 24;

/** Spezza `name` su più righe per stare nella larghezza di un edificio
 *  (in celle), replicando textwrap.fill di render_json.py: circa 2.8
 *  caratteri per cella, minimo 10 caratteri per riga. */
function wrapBuildingName(name: string, widthCells: number): string[] {
  const maxChars = Math.max(10, Math.round(widthCells * 2.8));
  const words = name.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Disegna la mappa città su un canvas già dimensionato, con lo stesso layout
 * "a griglia" di render_json.py (progetto FoE City Builder): sfondo scuro
 * fuori dall'area sbloccata, celle libere bianco crema, strade ed edifici coi
 * colori della vista MAPPA (coloreEdificioMappa: strade a 2 corsie come una
 * tessera 2×2, militari marroni, inattivi viola, niente zebra) con nome a capo
 * al centro. Coordinate SEMPRE quelle reali
 * del payload (nessun ricalcolo/traslazione), stessa filosofia dello script
 * Python: serve una verifica visiva fedele, non un'illustrazione stilizzata
 * (quella resta la vista SVG isometrica/verticale a schermo).
 */
export function renderCityMapPng(
  canvas: HTMLCanvasElement,
  buildings: readonly PngEdificio[],
  unlockedAreas: readonly UnlockedArea[],
  scale: number,
  /** Etichetta del municipio (il tool passa t("legendTownHall", uiLang)). */
  nomeMunicipio: string
): void {
  const areas = unlockedAreas.map((a) => ({
    x: Number(a.x ?? 0),
    y: Number(a.y ?? 0),
    width: Number(a.width ?? 4),
    length: Number(a.length ?? 4),
  }));
  const placedBuildings = buildings.filter((b) => b.type !== "street");
  const roadTiles = buildings.filter((b) => b.type === "street");

  const gridX0 = Math.min(...areas.map((a) => a.x));
  const gridY0 = Math.min(...areas.map((a) => a.y));
  const gridX1 = Math.max(...areas.map((a) => a.x + a.width));
  const gridY1 = Math.max(...areas.map((a) => a.y + a.length));
  const W = gridX1 - gridX0;
  const H = gridY1 - gridY0;

  const CELL = PNG_CELL * scale;
  const PAD = CELL; // mezzo margine di respiro attorno alla griglia
  canvas.width = (W + 2) * CELL + PAD * 2;
  canvas.height = (H + 2) * CELL + PAD * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const toPx = (gx: number, gy: number) => ({
    px: PAD + (gx - gridX0 + 1) * CELL,
    py: PAD + (gy - gridY0 + 1) * CELL,
  });

  // Sfondo: tutto "non disponibile", poi le celle libere sopra.
  ctx.fillStyle = PNG_COLOR_UNAVAILABLE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const occupied = new Set<string>();
  for (const b of placedBuildings) {
    for (let gx = b.x; gx < b.x + b.w; gx++) {
      for (let gy = b.y; gy < b.y + b.h; gy++) {
        occupied.add(`${gx},${gy}`);
      }
    }
  }
  // Celle strada: TUTTE quelle di ogni tessera, non solo l'angolo in alto a
  // sinistra — una strada a 2 corsie è una tessera 2x2. Prima si disegnava una
  // sola cella per tessera e le altre 3 celle di una strada a 2 corsie uscivano
  // color "spazio libero" (bug corretto settembre 2026). Contate anche come
  // occupate, così non vengono prima dipinte come libere.
  for (const road of roadTiles) {
    for (let gx = road.x; gx < road.x + road.w; gx++) {
      for (let gy = road.y; gy < road.y + road.h; gy++) {
        occupied.add(`${gx},${gy}`);
      }
    }
  }

  ctx.strokeStyle = "#a89b3f";
  ctx.lineWidth = 0.5 * scale;
  for (const a of areas) {
    for (let gx = a.x; gx < a.x + a.width; gx++) {
      for (let gy = a.y; gy < a.y + a.length; gy++) {
        if (occupied.has(`${gx},${gy}`)) continue;
        const { px, py } = toPx(gx, gy);
        ctx.fillStyle = PNG_COLOR_FREE;
        ctx.fillRect(px, py, CELL, CELL);
        ctx.strokeRect(px, py, CELL, CELL);
      }
    }
  }

  // Strade come nella vista MAPPA: una tessera per strada (la strada a 2
  // corsie è UNA tessera 2×2, prima si perdeva fra le celle singole), colore
  // e bordo della mappa.
  ctx.lineWidth = 1 * scale;
  for (const road of roadTiles) {
    const { px, py } = toPx(road.x, road.y);
    ctx.fillStyle = MAP_COLOR_STREET;
    ctx.fillRect(px, py, road.w * CELL, road.h * CELL);
    ctx.strokeStyle = "#1e293b";
    ctx.strokeRect(px, py, road.w * CELL, road.h * CELL);
  }

  // Edifici: municipio, poi Grandi Edifici/altri, colore per categoria.
  for (const b of placedBuildings) {
    const { px, py } = toPx(b.x, b.y);
    const w = b.w * CELL;
    const h = b.h * CELL;
    // palette della vista MAPPA (militari marroni, inattivi viola), senza zebra
    const color = b.colore ?? coloreEdificioMappa({ ...b, isTownhall: b.type === "main_building" });
    ctx.fillStyle = color;
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(px, py, w, h);

    const label = b.type === "main_building" ? nomeMunicipio : b.name;
    const fontSize = (b.w >= 3 ? 11 : b.w === 2 ? 9 : 7) * scale;
    ctx.fillStyle = "#000000";
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapBuildingName(label, b.w);
    const lineHeight = fontSize * 1.15;
    const startY = py + h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, px + w / 2, startY + i * lineHeight, w - 2 * scale);
    });
  }

  // Firma in basso a destra, nel margine nero (fuori dalla griglia): fa capire
  // che il PNG è stato generato dal tool. Vale per MAPPA, Planner ed editor.
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = `bold ${Math.round(18 * scale)}px sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("foe-optimizer.com", canvas.width - PAD * 0.5, canvas.height - PAD * 0.5);
}
