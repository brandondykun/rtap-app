import { itemCategory, KNOWN_SIDCS, typeLabel } from '@/features/symbology/categories';
import { DEFAULT_SIDC } from '@/features/symbology/presets';
import type { LatLon } from '@/lib/geo/types';

import { pointCoord } from './geometry';
import type { MapItemSnapshot } from './repository';

/** The Layers list shows at most this many rows; search narrows the rest. */
export const LAYER_ROW_LIMIT = 100;

// One shared collator: localeCompare with options rebuilds collation per comparison (slow for 5k names).
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export type LayerRow = { id: string; kind: MapItemSnapshot['kind']; name: string; sidc: string; hidden: boolean; coord: LatLon | null };

export type LayerRows = {
  rows: LayerRow[];
  /** Items matching the search (may exceed rows.length). */
  matched: number;
  /** All units and points in the mission. */
  total: number;
  units: number;
  points: number;
  /** Points in this mission that are hidden. */
  hiddenIds: string[];
};

/**
 * Rows for the Layers list: the mission's units and points matching `query` (name or type label
 * contains, any case),
 * sorted by name with numbers in order (HOS-2 before HOS-10), capped at `limit`.
 */
export function layerRows(items: readonly MapItemSnapshot[], hiddenIds: readonly string[], query: string, limit = LAYER_ROW_LIMIT): LayerRows {
  const hidden = new Set(hiddenIds);
  const points = items.filter((i) => i.kind === 'point');
  const q = query.trim().toLowerCase();
  const matchesQuery = (i: MapItemSnapshot) => i.name.toLowerCase().includes(q) || (typeLabel(i.sidc)?.toLowerCase().includes(q) ?? false);
  const matches = (q ? points.filter(matchesQuery) : [...points]).sort(
    // Names that compare equal ('HOS-1' vs 'hos-1') fall back to id so the order is stable.
    (a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const pointCount = points.filter((i) => itemCategory(i) === 'point').length;
  return {
    rows: matches.slice(0, limit).map((i) => ({
      id: i.id,
      kind: i.kind,
      name: i.name,
      sidc: i.sidc && KNOWN_SIDCS.has(i.sidc) ? i.sidc : DEFAULT_SIDC,
      hidden: hidden.has(i.id),
      coord: pointCoord(i.geometry),
    })),
    matched: matches.length,
    total: points.length,
    units: points.length - pointCount,
    points: pointCount,
    hiddenIds: points.filter((i) => hidden.has(i.id)).map((i) => i.id),
  };
}
