import { squareLetters } from '@/lib/geo/coords/mgrs';
import { fromUtm, toUtm, zoneLonRange } from '@/lib/geo/coords/utm';
import type { LatLon } from '@/lib/geo/types';
import { wrapLon } from '@/lib/geo/units/angle';

/** A map view: its bounds and zoom. */
export type GridView = { sw: LatLon; ne: LatLon; zoom: number };
/** Grid line spacing in metres. */
export type GridStep = 100 | 1_000 | 10_000 | 100_000;

/** A grid zone edge, a 100 km line, or a finer line. */
export type GridLineKind = 'zone' | 'major' | 'minor';
type Position = [number, number];
type LineFeature = {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: Position[] };
  /** `axis`: a line of equal easting ('e') or northing ('n'); `label`: its number, for lines finer than 100 km. */
  properties: { kind: GridLineKind; axis?: 'e' | 'n'; label?: string };
};
type LabelFeature = { type: 'Feature'; geometry: { type: 'Point'; coordinates: Position }; properties: { label: string } };
export type MgrsGrid = {
  lines: { type: 'FeatureCollection'; features: LineFeature[] };
  /** Names placed inside an area: grid zones ('18S') when zoomed far out, 100 km squares ('UJ') at 100 km spacing. */
  labels: { type: 'FeatureCollection'; features: LabelFeature[] };
};

/** Most grid lines drawn; a view that would need more (a tilted 3D view reaching the horizon) gets the next coarser spacing. */
export const GRID_MAX_LINES = 800;

const STEPS: readonly GridStep[] = [100, 1_000, 10_000, 100_000];
/** MGRS covers 80°S to 84°N. */
const MIN_LAT = -80;
const MAX_LAT = 84;
const BANDS = 'CDEFGHJKLMNPQRSTUVWX';
/**
 * Grid lines bend slightly in lat/lon, so each gets a vertex every few line spacings (at most this far apart). That
 * keeps a line within about a thousandth of the spacing of the true line: well under a screen point at its zooms.
 */
const MAX_VERTEX_SPACING_M = 200_000;
/** Points sampled along each edge of an area to find its easting and northing range. */
const EDGE_SAMPLES = 8;

/**
 * Line spacing for a zoom (a few dozen lines across a phone screen), never finer than `finest`, or null to draw only
 * the grid zones.
 */
export function gridStep(zoom: number, finest: GridStep = 100): GridStep | null {
  if (zoom < 5) return null;
  if (zoom < 8) return 100_000;
  if (zoom < 11) return 10_000;
  if (zoom < 14) return 1_000;
  return Math.max(100, finest) as GridStep;
}

/** Drawn lines that must be left past each edge of the screen, in screens, before the grid is drawn again. */
const REDRAW_MARGIN = 0.25;

/**
 * Whether the grid drawn for `drawn` no longer serves `current`: less than a quarter screen of its lines is left past
 * an edge (it draws half a screen), the zoom has reached another line spacing, or it has changed by a whole level.
 * Cheap enough to ask on every frame of a gesture, so new lines are in place before they scroll into view.
 */
export function needsNewGrid(drawn: GridView | null, current: GridView, finest: GridStep = 100): boolean {
  if (!drawn) return true;
  if (gridStep(drawn.zoom, finest) !== gridStep(current.zoom, finest) || Math.abs(current.zoom - drawn.zoom) >= 1) return true;
  const height = drawn.ne.lat - drawn.sw.lat;
  if (current.sw.lat < drawn.sw.lat - height * REDRAW_MARGIN || current.ne.lat > drawn.ne.lat + height * REDRAW_MARGIN) return true;
  const width = lonSpan(drawn);
  // A grid drawn twice as wide as the world already covers every longitude.
  if (width * 2 >= 360) return false;
  // Longitudes measured east from the drawn view's centre, so the antimeridian falls nowhere near.
  const reach = 0.5 + REDRAW_MARGIN;
  const west = wrapLon(current.sw.lon - (drawn.sw.lon + width / 2));
  return west < -width * reach || west + lonSpan(current) > width * reach;
}

const lonSpan = ({ sw, ne }: GridView) => (ne.lon < sw.lon ? ne.lon + 360 : ne.lon) - sw.lon;

type Box = { w: number; s: number; e: number; n: number };

/** One grid zone (zone number × latitude band) cut to the part inside a box. */
type Cell = { zone: number; band: string; south: boolean; box: Box };

/**
 * Grid zone edges, easting and northing lines and their labels for a view and half a screen around it, so a short
 * pan never shows an edge before the next idle redraws it.
 */
export function mgrsGrid(view: GridView, finest: GridStep = 100): MgrsGrid {
  const cells = paddedBoxes(view).flatMap(cellsIn);
  const lines: LineFeature[] = cells.flatMap(zoneEdges);
  const labels: LabelFeature[] = [];
  let step = gridStep(view.zoom, finest);
  // Zoomed far out there may be a thousand cells, and only their edges are drawn.
  const ranges = step === null ? [] : cells.map(utmRange);
  while (step !== null && ranges.reduce((sum, r) => sum + lineCount(r, step!), 0) > GRID_MAX_LINES) step = coarser(step);

  if (step === null) {
    for (const cell of cells) labels.push(label(`${cell.zone}${cell.band}`, [(cell.box.w + cell.box.e) / 2, (cell.box.s + cell.box.n) / 2]));
    return collections(lines, labels);
  }
  cells.forEach((cell, i) => {
    lines.push(...gridLines(cell, ranges[i], step));
    if (step === 100_000) labels.push(...squareNames(cell, ranges[i]));
  });
  return collections(lines, labels);
}

/**
 * Whether easting lines run north to south at a map bearing, so their numbers read down the screen with their tops
 * toward higher eastings (as northing numbers' tops face higher northings). Past sideways they would read upside
 * down and the lines turn around: at 180°, and at 330° rather than 360°, so a map turned a little left of north-up
 * does not flip them.
 */
export function eastingsRunSouth(bearing: number): boolean {
  const h = ((bearing % 360) + 360) % 360;
  return h <= 180 || h >= 330;
}

/** The lines with each easting line running north to south (`south`) or south to north. */
export function orientEastings(lines: MgrsGrid['lines'], south: boolean): MgrsGrid['lines'] {
  // Generated south to north.
  if (!south) return lines;
  return {
    ...lines,
    features: lines.features.map((f) => (f.properties.axis === 'e' ? { ...f, geometry: { ...f.geometry, coordinates: [...f.geometry.coordinates].reverse() } } : f)),
  };
}

function coarser(step: GridStep): GridStep | null {
  return STEPS[STEPS.indexOf(step) + 1] ?? null;
}

/** The view grown by half its size each way, cut to MGRS coverage and split at the antimeridian. */
function paddedBoxes({ sw, ne }: GridView): Box[] {
  const height = ne.lat - sw.lat;
  let width = ne.lon - sw.lon;
  if (width < 0) width += 360;
  const s = Math.max(sw.lat - height / 2, MIN_LAT);
  const n = Math.min(ne.lat + height / 2, MAX_LAT);
  if (s >= n) return [];
  if (width * 2 >= 360) return [{ w: -180, s, e: 180, n }];
  const w = wrapLon(sw.lon - width / 2);
  const e = w + width * 2;
  return e <= 180 ? [{ w, s, e, n }] : [{ w, s, e: 180, n }, { w: -180, s, e: e - 360, n }];
}

function intersect(a: Box, b: Box): Box | null {
  const box = { w: Math.max(a.w, b.w), s: Math.max(a.s, b.s), e: Math.min(a.e, b.e), n: Math.min(a.n, b.n) };
  return box.w < box.e && box.s < box.n ? box : null;
}

function bandBox(i: number): { s: number; n: number } {
  const s = MIN_LAT + 8 * i;
  return { s, n: BANDS[i] === 'X' ? MAX_LAT : s + 8 };
}

/** The grid zones a box crosses, each cut to the box. */
function cellsIn(box: Box): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < BANDS.length; i++) {
    const { s, n } = bandBox(i);
    if (n <= box.s || s >= box.n) continue;
    for (let zone = 1; zone <= 60; zone++) {
      const lons = zoneLonRange(zone, BANDS[i]);
      const cut = lons && intersect(box, { w: lons[0], s, e: lons[1], n });
      if (cut) cells.push({ zone, band: BANDS[i], south: s < 0, box: cut });
    }
  }
  return cells;
}

/**
 * The cell's west and south edges where they are real zone edges (every edge is some cell's west or south edge),
 * and the north edge of band X, the top of MGRS.
 */
function zoneEdges(cell: Cell): LineFeature[] {
  const i = BANDS.indexOf(cell.band);
  const band = bandBox(i);
  const lons = zoneLonRange(cell.zone, cell.band)!;
  const { w, s, e, n } = cell.box;
  const edges: Position[][] = [];
  if (w === lons[0]) edges.push([[w, s], [w, n]]);
  if (s === band.s) edges.push([[w, s], [e, s]]);
  if (n === MAX_LAT && band.n === MAX_LAT) edges.push([[w, n], [e, n]]);
  return edges.map((coordinates) => line(coordinates, { kind: 'zone' }));
}

type UtmRange = { minE: number; maxE: number; minN: number; maxN: number };

/** Easting and northing range of a cell, from points along its edges (where both are extreme). */
function utmRange(cell: Cell): UtmRange {
  const { w, s, e, n } = cell.box;
  const range = { minE: Infinity, maxE: -Infinity, minN: Infinity, maxN: -Infinity };
  for (let k = 0; k <= EDGE_SAMPLES; k++) {
    const f = k / EDGE_SAMPLES;
    for (const p of [
      { lat: s, lon: w + f * (e - w) },
      { lat: n, lon: w + f * (e - w) },
      { lat: s + f * (n - s), lon: w },
      { lat: s + f * (n - s), lon: e },
    ]) {
      const { easting, northing } = toUtm(p, cell.zone);
      range.minE = Math.min(range.minE, easting);
      range.maxE = Math.max(range.maxE, easting);
      range.minN = Math.min(range.minN, northing);
      range.maxN = Math.max(range.maxN, northing);
    }
  }
  return range;
}

function lineCount(r: UtmRange, step: GridStep): number {
  return Math.floor(r.maxE / step) - Math.ceil(r.minE / step) + 1 + Math.floor(r.maxN / step) - Math.ceil(r.minN / step) + 1;
}

/** The kilometres (two digits), or hundreds of metres (three) for 100 m lines, within the 100 km square. */
function lineLabel(value: number, step: GridStep): string {
  const within = Math.round(value) % 100_000;
  return step === 100 ? String(Math.round(within / 100)).padStart(3, '0') : String(Math.round(within / 1000)).padStart(2, '0');
}

function gridLines(cell: Cell, r: UtmRange, step: GridStep): LineFeature[] {
  const out: LineFeature[] = [];
  const along = (from: number, to: number) => {
    const count = Math.max(1, Math.ceil((to - from) / Math.min(MAX_VERTEX_SPACING_M, 5 * step)));
    return Array.from({ length: count + 1 }, (_, k) => from + ((to - from) * k) / count);
  };
  const add = (axis: 'e' | 'n', value: number, points: LatLon[]) => {
    const kind: GridLineKind = value % 100_000 === 0 ? 'major' : 'minor';
    const props = step === 100_000 ? { kind, axis } : { kind, axis, label: lineLabel(value, step) };
    for (const coordinates of clip(points, cell.box)) out.push(line(coordinates, props));
  };
  for (let e = Math.ceil(r.minE / step) * step; e <= r.maxE; e += step) {
    add('e', e, along(r.minN, r.maxN).map((n) => fromUtm({ easting: e, northing: n }, cell.zone, cell.south)));
  }
  for (let n = Math.ceil(r.minN / step) * step; n <= r.maxN; n += step) {
    add('n', n, along(r.minE, r.maxE).map((e) => fromUtm({ easting: e, northing: n }, cell.zone, cell.south)));
  }
  return out;
}

/** Each 100 km square's two letters at its centre, when the centre is in the cell. */
function squareNames(cell: Cell, r: UtmRange): LabelFeature[] {
  const out: LabelFeature[] = [];
  for (let e = Math.floor(r.minE / 100_000) * 100_000; e < r.maxE; e += 100_000) {
    for (let n = Math.floor(r.minN / 100_000) * 100_000; n < r.maxN; n += 100_000) {
      const at = fromUtm({ easting: e + 50_000, northing: n + 50_000 }, cell.zone, cell.south);
      const letters = inside(at, cell.box) ? squareLetters(at) : null;
      if (letters) out.push(label(letters, [at.lon, at.lat]));
    }
  }
  return out;
}

function inside(p: LatLon, box: Box): boolean {
  return p.lon >= box.w && p.lon <= box.e && p.lat >= box.s && p.lat <= box.n;
}

/** The parts of a polyline inside a box (Liang–Barsky on each segment), joined where they meet. */
function clip(points: LatLon[], box: Box): Position[][] {
  const runs: Position[][] = [];
  let run: Position[] | null = null;
  for (let k = 1; k < points.length; k++) {
    const seg = clipSegment(points[k - 1], points[k], box);
    if (!seg) {
      run = null;
      continue;
    }
    const [a, b] = seg;
    if (run && run[run.length - 1][0] === a[0] && run[run.length - 1][1] === a[1]) run.push(b);
    else {
      run = [a, b];
      runs.push(run);
    }
  }
  return runs;
}

function clipSegment(p: LatLon, q: LatLon, box: Box): [Position, Position] | null {
  const dx = q.lon - p.lon;
  const dy = q.lat - p.lat;
  let t0 = 0;
  let t1 = 1;
  for (const [d, dist] of [
    [-dx, p.lon - box.w],
    [dx, box.e - p.lon],
    [-dy, p.lat - box.s],
    [dy, box.n - p.lat],
  ]) {
    if (d === 0) {
      if (dist < 0) return null;
      continue;
    }
    const t = dist / d;
    if (d < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  const at = (t: number): Position => (t === 0 ? [p.lon, p.lat] : t === 1 ? [q.lon, q.lat] : [p.lon + t * dx, p.lat + t * dy]);
  return [at(t0), at(t1)];
}

function line(coordinates: Position[], properties: LineFeature['properties']): LineFeature {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties };
}

function label(text: string, coordinates: Position): LabelFeature {
  return { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: { label: text } };
}

function collections(lines: LineFeature[], labels: LabelFeature[]): MgrsGrid {
  return { lines: { type: 'FeatureCollection', features: lines }, labels: { type: 'FeatureCollection', features: labels } };
}
