import { itemCategory, isKnownSidc, typeLabel, type ItemCategory } from '@/features/symbology/categories';
import { lineTypeInfo, lineTypeOf, type LineType } from '@/features/symbology/line-types';
import { polygonStyleOf, polygonTypeInfo, type PolygonType } from '@/features/symbology/polygon-types';
import { affiliationOf, DEFAULT_SIDC, type Affiliation } from '@/features/symbology/presets';
import type { LatLon } from '@/lib/geo/types';

import { parseLineGeometry, parsePolygonGeometry, pointCoord } from './geometry';
import { totalLength } from './line-measure';
import { areaM2 } from './polygon-measure';
import type { MapItemSnapshot } from './repository';
import { ringRadiusM } from './unit-ranges';

/** The Layers list shows at most this many rows; search narrows the rest. */
export const LAYER_ROW_LIMIT = 100;

/**
 * A name's sort key: lower case without accents, in runs of text and numbers, so HOS-2 sorts before HOS-10. Plain
 * JavaScript, built once per name: on Android Hermes runs every Intl.Collator comparison through Java, and sorting a
 * 5,000-item mission that way held the Layers menu up for seconds.
 */
type SortKey = (string | number)[];

function sortKey(name: string): SortKey {
  // Accents only need stripping off non-ASCII names (normalize is another trip to Java on Android).
  const plain = /[^\x00-\x7f]/.test(name) ? name.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : name;
  return (plain.toLowerCase().match(/\d+|\D+/g) ?? []).map((run) => (/^\d/.test(run) ? Number(run) : run));
}

/** Numbers before text, numbers by value, text by character; a key that is the start of another sorts first. */
function compareKeys(a: SortKey, b: SortKey): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

/** Items in each category: the Layers tab counts, without sorting or building rows. */
export function categoryCounts(items: readonly MapItemSnapshot[]): Record<ItemCategory, number> {
  const counts = { unit: 0, point: 0, line: 0, polygon: 0 };
  for (const i of items) counts[itemCategory(i)]++;
  return counts;
}

export type LayerRow = {
  id: string;
  kind: MapItemSnapshot['kind'];
  name: string;
  /** The symbol to show (DEFAULT_SIDC for unknown codes and for lines). */
  sidc: string;
  hidden: boolean;
  /** Units and points: their location. Lines: null. */
  coord: LatLon | null;
  lineType: LineType | null;
  /** Lines: total length in meters (null when the geometry is unreadable). */
  length: number | null;
  /** Polygons: their type, area (m², null when unreadable) and, for circles, the radius. */
  polygonType: PolygonType | null;
  areaM2: number | null;
  radiusM: number | null;
  /** Units with a ring distance: whether the ring shows on the map. Others: null. */
  ring: boolean | null;
  /** A friendly unit: its grid shows in the friendly blue. */
  friendly: boolean;
};

export type LayerRows = {
  rows: LayerRow[];
  /** Every item matching the search, sorted (rows are the first `limit` of them, built); see layerRow. */
  matches: readonly MapItemSnapshot[];
  /** Items matching the search (may exceed rows.length). */
  matched: number;
  /** Items in the chosen category (all items when none is chosen). */
  total: number;
  units: number;
  points: number;
  lines: number;
  polygons: number;
  /** Hidden items in the chosen category (all categories when none is chosen). */
  hiddenIds: string[];
  /** Shown items in the chosen category (all categories when none is chosen). Like hiddenIds, search does not narrow it. */
  visibleIds: string[];
  /** Items in the chosen category that have a ring distance. Search does not narrow it. */
  ringableIds: string[];
  /** The ringable items whose ring is on. Search does not narrow it. */
  ringOnIds: string[];
};

/** One Layers row, for an item as it is drawn (a long list builds its rows only as they come into view). */
export function layerRow(i: MapItemSnapshot, hidden: ReadonlySet<string>, ringOn: ReadonlySet<string>): LayerRow {
  const isLine = i.kind === 'line';
  const points = isLine ? parseLineGeometry(i.geometry) : null;
  const isPolygon = i.kind === 'polygon';
  const ring = isPolygon ? parsePolygonGeometry(i.geometry) : null;
  const pstyle = isPolygon ? polygonStyleOf(i.style) : null;
  return {
    id: i.id,
    kind: i.kind,
    name: i.name,
    sidc: !isLine && !isPolygon && i.sidc && isKnownSidc(i.sidc) ? i.sidc : DEFAULT_SIDC,
    hidden: hidden.has(i.id),
    coord: isLine || isPolygon ? null : pointCoord(i.geometry),
    lineType: isLine ? lineTypeOf(i.style) : null,
    length: points ? totalLength(points) : null,
    polygonType: pstyle ? pstyle.polygonType : null,
    areaM2: ring ? areaM2(ring) : null,
    radiusM: pstyle && pstyle.shape.kind === 'circle' ? pstyle.shape.radiusM : null,
    ring: ringRadiusM(i) !== null ? ringOn.has(i.id) : null,
    friendly: i.sidc !== null && itemCategory(i) === 'unit' && affiliationOf(i.sidc) === 'friend',
  };
}

/**
 * The last search sorted: the items list is shared while the mission is open, so opening Layers again (or coming Back
 * to it) with nothing changed reuses the order instead of sorting thousands of names again.
 */
let lastSort: { items: readonly MapItemSnapshot[]; category: ItemCategory | null; affiliation: Affiliation | null; query: string; matches: MapItemSnapshot[] } | null = null;

/**
 * Rows for the Layers list: the mission's items (or one category's) matching `query` (name or type
 * label contains, any case),
 * sorted by name with numbers in order (HOS-2 before HOS-10), capped at `limit`.
 */
export function layerRows(
  items: readonly MapItemSnapshot[],
  hiddenIds: readonly string[],
  query: string,
  limit = LAYER_ROW_LIMIT,
  category: ItemCategory | null = null,
  ringIds: readonly string[] = [],
  /** On the Units tab, only units of this affiliation (the filter chips); null for all. */
  affiliation: Affiliation | null = null,
): LayerRows {
  const hidden = new Set(hiddenIds);
  const ringOn = new Set(ringIds);
  const ringable = (i: MapItemSnapshot) => ringRadiusM(i) !== null;
  const inCategory = category ? items.filter((i) => itemCategory(i) === category) : items;
  const inTab = category === 'unit' && affiliation ? inCategory.filter((i) => i.sidc !== null && affiliationOf(i.sidc) === affiliation) : inCategory;
  const q = query.trim().toLowerCase();
  const label = (i: MapItemSnapshot) =>
    i.kind === 'line'
      ? lineTypeInfo(lineTypeOf(i.style)).label
      : i.kind === 'polygon'
        ? polygonTypeInfo(polygonStyleOf(i.style).polygonType).label
        : typeLabel(i.sidc);
  const matchesQuery = (i: MapItemSnapshot) => i.name.toLowerCase().includes(q) || (label(i)?.toLowerCase().includes(q) ?? false);
  const cached = lastSort && lastSort.items === items && lastSort.category === category && lastSort.affiliation === affiliation && lastSort.query === q ? lastSort.matches : null;
  const matches =
    cached ??
    (q ? inTab.filter(matchesQuery) : inTab)
      .map((item) => ({ item, key: sortKey(item.name) }))
      // Names that compare equal ('HOS-1' vs 'hos-1') fall back to id so the order is stable.
      .sort((a, b) => compareKeys(a.key, b.key) || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0))
      .map((m) => m.item);
  lastSort = { items, category, affiliation, query: q, matches };
  const counts = categoryCounts(items);
  return {
    rows: matches.slice(0, limit).map((i) => layerRow(i, hidden, ringOn)),
    matches,
    matched: matches.length,
    total: inTab.length,
    units: counts.unit,
    points: counts.point,
    lines: counts.line,
    polygons: counts.polygon,
    hiddenIds: inTab.filter((i) => hidden.has(i.id)).map((i) => i.id),
    visibleIds: inTab.filter((i) => !hidden.has(i.id)).map((i) => i.id),
    ringableIds: inTab.filter(ringable).map((i) => i.id),
    ringOnIds: inTab.filter((i) => ringable(i) && ringOn.has(i.id)).map((i) => i.id),
  };
}
