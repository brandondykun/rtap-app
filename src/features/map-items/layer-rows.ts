import { itemCategory, KNOWN_SIDCS, typeLabel } from '@/features/symbology/categories';
import { lineTypeInfo, lineTypeOf, type LineType } from '@/features/symbology/line-types';
import { DEFAULT_SIDC } from '@/features/symbology/presets';
import type { LatLon } from '@/lib/geo/types';

import { parseLineGeometry, pointCoord } from './geometry';
import { totalLength } from './line-measure';
import type { MapItemSnapshot } from './repository';

/** The Layers list shows at most this many rows; search narrows the rest. */
export const LAYER_ROW_LIMIT = 100;

// One shared collator: localeCompare with options rebuilds collation per comparison (slow for 5k names).
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

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
};

export type LayerRows = {
  rows: LayerRow[];
  /** Items matching the search (may exceed rows.length). */
  matched: number;
  /** All units, points and lines in the mission. */
  total: number;
  units: number;
  points: number;
  lines: number;
  /** Items in this mission that are hidden. */
  hiddenIds: string[];
};

/**
 * Rows for the Layers list: the mission's units, points and lines matching `query` (name or type
 * label contains, any case),
 * sorted by name with numbers in order (HOS-2 before HOS-10), capped at `limit`.
 */
export function layerRows(items: readonly MapItemSnapshot[], hiddenIds: readonly string[], query: string, limit = LAYER_ROW_LIMIT): LayerRows {
  const hidden = new Set(hiddenIds);
  const q = query.trim().toLowerCase();
  const label = (i: MapItemSnapshot) => (i.kind === 'line' ? lineTypeInfo(lineTypeOf(i.style)).label : typeLabel(i.sidc));
  const matchesQuery = (i: MapItemSnapshot) => i.name.toLowerCase().includes(q) || (label(i)?.toLowerCase().includes(q) ?? false);
  const matches = (q ? items.filter(matchesQuery) : [...items]).sort(
    // Names that compare equal ('HOS-1' vs 'hos-1') fall back to id so the order is stable.
    (a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const counts = { unit: 0, point: 0, line: 0, polygon: 0 };
  for (const i of items) counts[itemCategory(i)]++;
  return {
    rows: matches.slice(0, limit).map((i): LayerRow => {
      const isLine = i.kind === 'line';
      const points = isLine ? parseLineGeometry(i.geometry) : null;
      return {
        id: i.id,
        kind: i.kind,
        name: i.name,
        sidc: !isLine && i.sidc && KNOWN_SIDCS.has(i.sidc) ? i.sidc : DEFAULT_SIDC,
        hidden: hidden.has(i.id),
        coord: isLine ? null : pointCoord(i.geometry),
        lineType: isLine ? lineTypeOf(i.style) : null,
        length: points ? totalLength(points) : null,
      };
    }),
    matched: matches.length,
    total: items.length,
    units: counts.unit,
    points: counts.point,
    lines: counts.line,
    hiddenIds: items.filter((i) => hidden.has(i.id)).map((i) => i.id),
  };
}
