import type { AngleUnit, NorthRef } from '../types';
import { MILS_PER_CIRCLE, degToMils, normalizeDeg } from '../units/angle';

const NO_VALUE = '—';

export function formatAngle(deg: number | null, unit: AngleUnit): string {
  if (deg === null) return NO_VALUE;
  if (unit === 'mil') {
    const mils = Math.round(degToMils(deg)) % MILS_PER_CIRCLE;
    return `${String(mils).padStart(4, '0')} mils`;
  }
  const whole = Math.round(normalizeDeg(deg)) % 360;
  return `${String(whole).padStart(3, '0')}°`;
}

export function formatDistance(m: number): string {
  if (m < 999.5) return `${Math.round(m)} m`;
  const km = m / 1000;
  if (km < 9.995) return `${km.toFixed(2)} km`;
  if (km < 99.95) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function refLabel(ref: NorthRef): 'TRUE' | 'GRID' | 'MAG' {
  return ref === 'true' ? 'TRUE' : ref === 'grid' ? 'GRID' : 'MAG';
}
