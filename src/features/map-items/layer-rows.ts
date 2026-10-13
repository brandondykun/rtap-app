import { DEFAULT_SIDC, PRESET_SIDCS } from '@/features/symbology/presets';
import type { LatLon } from '@/lib/geo/types';

import { pointCoord } from './geometry';
import type { MapItemSnapshot } from './repository';

/** The Layers list shows at most this many rows; search narrows the rest. */
export const LAYER_ROW_LIMIT = 100;

const KNOWN_SIDCS: ReadonlySet<string> = new Set(PRESET_SIDCS);

export type LayerRow = { id: string; name: string; sidc: string; hidden: boolean; coord: LatLon | null };

export type LayerRows = {
  rows: LayerRow[];
  /** Items matching the search (may exceed rows.length). */
  matched: number;
  /** All points in the mission. */
  total: number;
  /** Points in this mission that are hidden. */
  hiddenIds: string[];
};

/**
 * Rows for the Layers list: the mission's points matching `query` (name contains, any case),
 * sorted by name with numbers in order (HOS-2 before HOS-10), capped at `limit`.
 */
export function layerRows(items: readonly MapItemSnapshot[], hiddenIds: readonly string[], query: string, limit = LAYER_ROW_LIMIT): LayerRows {
  const hidden = new Set(hiddenIds);
  const points = items.filter((i) => i.kind === 'point');
  const q = query.trim().toLowerCase();
  const matches = (q ? points.filter((i) => i.name.toLowerCase().includes(q)) : [...points]).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
  return {
    rows: matches.slice(0, limit).map((i) => ({
      id: i.id,
      name: i.name,
      sidc: i.sidc && KNOWN_SIDCS.has(i.sidc) ? i.sidc : DEFAULT_SIDC,
      hidden: hidden.has(i.id),
      coord: pointCoord(i.geometry),
    })),
    matched: matches.length,
    total: points.length,
    hiddenIds: points.filter((i) => hidden.has(i.id)).map((i) => i.id),
  };
}
