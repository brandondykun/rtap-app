import type { AngleUnit } from '@/lib/geo/types';
import { degToMils } from '@/lib/geo/units/angle';

/** Signed east/west angle text: "10.6° W" or "188 mils W" (east positive). */
export function formatEastWest(deg: number | null, unit: AngleUnit): string {
  if (deg === null || !Number.isFinite(deg)) return '—';
  const side = deg >= 0 ? 'E' : 'W';
  const abs = Math.abs(deg);
  return unit === 'mil' ? `${Math.round(degToMils(abs))} mils ${side}` : `${abs.toFixed(1)}° ${side}`;
}
