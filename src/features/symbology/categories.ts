import { POINT_SIDCS, POINT_TYPES, pointTypeForSidc } from './point-types';
import { decomposeSidc, UNIT_TYPES } from './presets';

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

const POINT_SIDC_SET: ReadonlySet<string> = new Set(POINT_SIDCS);

/** A SIDC the app can draw and edit: any composable ground unit (any echelon) or a point type; anything else draws as DEFAULT_SIDC. */
export function isKnownSidc(sidc: string): boolean {
  return POINT_SIDC_SET.has(sidc) || decomposeSidc(sidc) !== null;
}

/** The type's display label ("Checkpoint", "Infantry"), or null when the code is unknown. */
export function typeLabel(sidc: string | null): string | null {
  const point = pointTypeForSidc(sidc);
  if (point) return POINT_TYPES.find((t) => t.id === point)!.label;
  const unit = sidc ? decomposeSidc(sidc) : null;
  return unit ? UNIT_TYPES.find((t) => t.id === unit.unitType)!.label : null;
}
