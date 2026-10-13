import { POINT_SIDCS, POINT_TYPES, pointTypeForSidc } from './point-types';
import { decomposeSidc, PRESET_SIDCS, UNIT_TYPES } from './presets';

/** Units carry an affiliation and unit type; points are control measures (checkpoint, LZ, …); lines are control lines; polygons are areas. */
export type ItemCategory = 'unit' | 'point' | 'line' | 'polygon';
/** What decides unit vs point vs line vs polygon: the item's kind, then its symbol code. */
export type ItemRef = { kind: string; sidc: string | null };

/** The only place that decides unit vs point vs line vs polygon. Unknown, null and all pre-existing point-kind codes are units. */
export function itemCategory(item: ItemRef): ItemCategory {
  if (item.kind === 'polygon') return 'polygon';
  if (item.kind === 'line') return 'line';
  return pointTypeForSidc(item.sidc) ? 'point' : 'unit';
}

/** Every SIDC the app has an image for; anything else draws as DEFAULT_SIDC. */
export const KNOWN_SIDCS: ReadonlySet<string> = new Set([...PRESET_SIDCS, ...POINT_SIDCS]);

/** The type's display label ("Checkpoint", "Infantry"), or null when the code is unknown. */
export function typeLabel(sidc: string | null): string | null {
  const point = pointTypeForSidc(sidc);
  if (point) return POINT_TYPES.find((t) => t.id === point)!.label;
  const unit = sidc ? decomposeSidc(sidc) : null;
  return unit ? UNIT_TYPES.find((t) => t.id === unit.unitType)!.label : null;
}
