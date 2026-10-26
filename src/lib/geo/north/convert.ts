import type { LatLon, NorthRef } from '../types';
import { normalizeDeg } from '../units/angle';
import { gridConvergence } from './grid';
import { declination } from './magnetic';

export type NorthContext = { date: Date; declinationOverrideDeg?: number | null };

/** Returns the value if it is a finite number, otherwise the fallback. */
function finiteOr(value: number | null | undefined, fallback: () => number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback();
}

/** Angle from true north to the given north reference at p, east positive. */
export function northOffset(ref: NorthRef, p: LatLon, ctx: NorthContext): number {
  switch (ref) {
    case 'true':
      return 0;
    case 'grid':
      return gridConvergence(p);
    case 'magnetic':
      return finiteOr(ctx.declinationOverrideDeg, () => declination(p, ctx.date));
  }
}

export function fromTrue(azTrue: number, ref: NorthRef, p: LatLon, ctx: NorthContext): number {
  return normalizeDeg(azTrue - northOffset(ref, p, ctx));
}

export function toTrue(az: number, ref: NorthRef, p: LatLon, ctx: NorthContext): number {
  return normalizeDeg(az + northOffset(ref, p, ctx));
}

/** G-M angle: from grid north to magnetic north, east positive. */
export function gridMagneticAngle(p: LatLon, ctx: NorthContext): number {
  return northOffset('magnetic', p, ctx) - northOffset('grid', p, ctx);
}

export type GmConversion = { gridToMagnetic: 'add' | 'subtract'; magneticToGrid: 'add' | 'subtract' };

/**
 * Whether to add or subtract the G-M angle between grid and magnetic azimuths (the declination diagram's note).
 * Magnetic north west of grid north (negative) adds grid → magnetic; east subtracts. Null when they agree or unknown.
 */
export function gmConversion(gmDeg: number): GmConversion | null {
  if (!Number.isFinite(gmDeg) || gmDeg === 0) return null;
  return gmDeg < 0 ? { gridToMagnetic: 'add', magneticToGrid: 'subtract' } : { gridToMagnetic: 'subtract', magneticToGrid: 'add' };
}
