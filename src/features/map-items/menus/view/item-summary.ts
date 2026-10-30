import { typeLabel, type ItemCategory } from '@/features/symbology/categories';
import { AFFILIATION_LABELS, decomposeSidc, ECHELONS, UNIT_TYPES, type Affiliation } from '@/features/symbology/presets';

import type { MapItemSnapshot } from '../../repository';
import { rangeFieldsForSidc, ringRadiusM } from '../../unit-ranges';

const UNKNOWN = 'Unknown';

/** "Hostile · Armor · Platoon", plus the affiliation so the title can color its first word. */
export function unitSubtitle(sidc: string | null): { affiliation: Affiliation | null; text: string } {
  const parts = sidc ? decomposeSidc(sidc) : null;
  if (!parts) return { affiliation: null, text: UNKNOWN };
  const type = UNIT_TYPES.find((t) => t.id === parts.unitType)?.label ?? UNKNOWN;
  const echelon = ECHELONS.find((e) => e.id === parts.echelon)?.label ?? UNKNOWN;
  return { affiliation: parts.affiliation, text: `${AFFILIATION_LABELS[parts.affiliation]} · ${type} · ${echelon}` };
}

export function pointSubtitle(sidc: string | null): string {
  return typeLabel(sidc) ?? UNKNOWN;
}

/** The header's screen-reader name: "FRD-2, Friendly · Armor · Platoon, hidden". */
export function itemAccessibleTitle(category: ItemCategory, item: Pick<MapItemSnapshot, 'name' | 'sidc'>, hidden: boolean): string {
  const subtitle = category === 'unit' ? unitSubtitle(item.sidc).text : pointSubtitle(item.sidc);
  return `${item.name}, ${subtitle}${hidden ? ', hidden' : ''}`;
}

/**
 * The unit's ranges as text, under a title that counts them: `RANGE RINGS` once both of an air defense unit's ranges are
 * set, else `RANGE RING`. Null for units that cannot have a ring.
 */
export function ringSummary(
  item: Pick<MapItemSnapshot, 'sidc' | 'threatRangeM' | 'horizontalRangeM' | 'verticalRangeFt'>,
): { title: 'RANGE RING' | 'RANGE RINGS'; text: string } | null {
  const fields = rangeFieldsForSidc(item.sidc);
  if (fields.length === 0) return null;
  const radius = ringRadiusM(item);
  const parts = fields.length === 1 ? [radius === null ? null : `${radius} m`] : [radius === null ? null : `↔ ${radius} m`, item.verticalRangeFt === null ? null : `↕ ${item.verticalRangeFt} ft`];
  const set = parts.filter((p): p is string => p !== null);
  return { title: set.length > 1 ? 'RANGE RINGS' : 'RANGE RING', text: set.length ? set.join(' · ') : NO_RANGE };
}

const NO_RANGE = 'No range set — Edit to add';
