import { MAX_RADIUS_M } from '@/features/symbology/polygon-types';
import { decomposeSidc, type UnitType } from '@/features/symbology/presets';
import type { MapItemSnapshot } from './repository';

export type RangeField = 'threatRangeM' | 'horizontalRangeM' | 'verticalRangeFt';
export type UnitRanges = Record<RangeField, number | null>;

export const NO_RANGES: UnitRanges = { threatRangeM: null, horizontalRangeM: null, verticalRangeFt: null };
export const MAX_VERTICAL_RANGE_FT = 100_000;

export function rangeFieldsFor(unitType: UnitType): readonly RangeField[] {
  if (unitType === 'artillery') return ['threatRangeM'];
  if (unitType === 'air-defense') return ['horizontalRangeM', 'verticalRangeFt'];
  return [];
}

export function rangeFieldsForSidc(sidc: string | null): readonly RangeField[] {
  const parts = sidc ? decomposeSidc(sidc) : null;
  return parts ? rangeFieldsFor(parts.unitType) : [];
}

/** Keeps only `fields`; every other range is null. */
export function normalizeRanges(fields: readonly RangeField[], r: Partial<UnitRanges>): UnitRanges {
  const out: UnitRanges = { ...NO_RANGES };
  for (const f of fields) out[f] = r[f] ?? null;
  return out;
}

export function isValidRange(field: RangeField, v: number | null): boolean {
  if (v === null) return true;
  const max = field === 'verticalRangeFt' ? MAX_VERTICAL_RANGE_FT : MAX_RADIUS_M;
  return Number.isInteger(v) && v > 0 && v <= max;
}

/** '' -> null (no range), number text -> rounded whole number, anything else -> undefined (invalid). */
export function parseRangeText(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

export function formatRangeText(v: number | null): string {
  return v === null ? '' : String(v);
}

export function ringRadiusM(item: Pick<MapItemSnapshot, 'sidc' | 'threatRangeM' | 'horizontalRangeM'>): number | null {
  const parts = item.sidc ? decomposeSidc(item.sidc) : null;
  if (parts?.unitType === 'artillery') return item.threatRangeM;
  if (parts?.unitType === 'air-defense') return item.horizontalRangeM;
  return null;
}
