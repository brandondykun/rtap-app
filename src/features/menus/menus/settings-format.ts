import type { AngleUnit } from '@/lib/geo/types';
import { degToMils } from '@/lib/geo/units/angle';

/** Size of an angle, without its side: "10.6°" or "188 mils". */
export function formatAngleSize(deg: number, unit: AngleUnit): string {
  const abs = Math.abs(deg);
  return unit === 'mil' ? `${Math.round(degToMils(abs))} mils` : `${abs.toFixed(1)}°`;
}

/** True when the angle shows as zero in that unit ("0 mils", "0.0°"). */
export function roundsToZero(deg: number, unit: AngleUnit): boolean {
  const abs = Math.abs(deg);
  return unit === 'mil' ? Math.round(degToMils(abs)) === 0 : Math.round(abs * 10) === 0;
}

/** Signed east/west angle text: "10.6° W" or "188 mils W" (east positive). */
export function formatEastWest(deg: number | null, unit: AngleUnit): string {
  if (deg === null || !Number.isFinite(deg)) return '—';
  return `${formatAngleSize(deg, unit)} ${deg >= 0 ? 'E' : 'W'}`;
}

/** Declination in both units: "10.6° W · 188 mils W". */
export function formatEastWestBoth(deg: number | null): string {
  if (deg === null || !Number.isFinite(deg)) return '—';
  return `${formatEastWest(deg, 'deg')} · ${formatEastWest(deg, 'mil')}`;
}
