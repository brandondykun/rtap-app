import type { LatLon } from '../types';
import { wrapLon } from '../units/angle';

/** UTM zone number for a position, including the Norway and Svalbard exceptions. */
export function utmZone(p: LatLon): number {
  const lon = wrapLon(p.lon);
  let zone = Math.floor((lon + 180) / 6) + 1;
  if (zone > 60) zone = 60;

  if (p.lat >= 56 && p.lat < 64 && lon >= 3 && lon < 12) return 32;

  if (p.lat >= 72 && p.lat < 84) {
    if (lon >= 0 && lon < 9) return 31;
    if (lon >= 9 && lon < 21) return 33;
    if (lon >= 21 && lon < 33) return 35;
    if (lon >= 33 && lon < 42) return 37;
  }
  return zone;
}

export function centralMeridian(zone: number): number {
  return zone * 6 - 183;
}
