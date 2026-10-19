import type { ItemCategory } from '@/features/symbology/categories';
import { sidcForPointType, type PointType } from '@/features/symbology/point-types';
import { composeSidc, type Affiliation, type Echelon, type UnitType } from '@/features/symbology/presets';

/** The symbol a draft stands for: affiliation + unit type for units, the point type for points. */
export function draftSidc(d: { category: ItemCategory; affiliation: Affiliation; unitType: UnitType; echelon: Echelon; pointType: PointType }): string {
  return d.category === 'point' ? sidcForPointType(d.pointType) : composeSidc(d.affiliation, d.unitType, d.echelon);
}
