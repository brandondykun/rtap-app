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

/** The ring's ranges as text; null for units that cannot have a ring. */
export function ringSummary(item: Pick<MapItemSnapshot, 'sidc' | 'threatRangeM' | 'horizontalRangeM' | 'verticalRangeFt'>): string | null {
  const fields = rangeFieldsForSidc(item.sidc);
  if (fields.length === 0) return null;
  const radius = ringRadiusM(item);
  if (fields.length === 1) return radius === null ? NO_RANGE : `${radius} m`;
  const parts = [radius === null ? null : `↔ ${radius} m`, item.verticalRangeFt === null ? null : `↕ ${item.verticalRangeFt} ft ceiling`].filter(Boolean);
  return parts.length ? parts.join(' · ') : NO_RANGE;
}

const NO_RANGE = 'No range set — Edit to add';
