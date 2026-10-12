import { splitMgrs } from '../coords/mgrs';
import type { LatLon } from '../types';

/** `18SUJ2339407395` → `18S UJ 23394 07395`. Unparseable input is returned unchanged. */
export function formatMgrs(compact: string): string {
  const parts = splitMgrs(compact);
  if (!parts.ok) return compact;
  const { zoneBand, square, easting, northing } = parts.value;
  return [zoneBand, square, easting, northing].filter(Boolean).join(' ');
}

export function formatLatLon(p: LatLon): string {
  const lat = `${Math.abs(p.lat).toFixed(5)}° ${p.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(p.lon).toFixed(5)}° ${p.lon >= 0 ? 'E' : 'W'}`;
  return `${lat} ${lon}`;
}
