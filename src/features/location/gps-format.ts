import type { AltitudeUnit } from '@/stores/settings';

const FEET_PER_METER = 3.28084;

/** A length in meters as whole meters or feet ("142 m", "466 ft"), or "—" when unknown. */
export function formatLength(meters: number | null | undefined, unit: AltitudeUnit): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
  return unit === 'ft' ? `${Math.round(meters * FEET_PER_METER)} ft` : `${Math.round(meters)} m`;
}
