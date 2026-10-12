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

/** MGRS latitude band letters, south to north (I and O are never used). */
const BANDS = 'CDEFGHJKLMNPQRSTUVWX';

/** Latitude range [min, max] of an MGRS band letter, or null if the letter is not a band. */
export function bandLatRange(letter: string): [number, number] | null {
  const i = letter.length === 1 ? BANDS.indexOf(letter) : -1;
  if (i < 0) return null;
  const min = -80 + 8 * i;
  // X is 12° tall (72°N–84°N); every other band is 8°.
  return letter === 'X' ? [72, 84] : [min, min + 8];
}

/**
 * Longitude range [min, max] covered by a zone within a band, including the Norway and
 * Svalbard exceptions, or null when the zone does not exist in that band.
 */
export function zoneLonRange(zone: number, band: string): [number, number] | null {
  if (!Number.isInteger(zone) || zone < 1 || zone > 60) return null;
  if (band === 'V') {
    if (zone === 31) return [0, 3];
    if (zone === 32) return [3, 12];
  }
  if (band === 'X') {
    if (zone === 31) return [0, 9];
    if (zone === 33) return [9, 21];
    if (zone === 35) return [21, 33];
    if (zone === 37) return [33, 42];
    if (zone === 32 || zone === 34 || zone === 36) return null;
  }
  const min = (zone - 1) * 6 - 180;
  return [min, min + 6];
}
