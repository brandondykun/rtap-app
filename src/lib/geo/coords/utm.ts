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

const A = 6_378_137; // WGS84 semi-major axis, m
const E2 = 0.00669438; // eccentricity squared (as the MGRS library uses, so grid lines match the readouts)
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const FALSE_EASTING = 500_000;
const FALSE_NORTHING_SOUTH = 10_000_000;
const RAD = Math.PI / 180;

/** Distance along the central meridian from the equator to `lat` (radians), m. */
function meridianArc(lat: number): number {
  return (
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * lat -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * lat) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * lat))
  );
}

/**
 * UTM easting and northing (m) of `p`, measured in `zone` (which may be a neighbour of the position's own zone).
 * Southern positions get the 10,000 km false northing. Same series as the MGRS library.
 */
export function toUtm(p: LatLon, zone: number): { easting: number; northing: number } {
  const lat = p.lat * RAD;
  const n = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
  const t = Math.tan(lat) ** 2;
  const c = EP2 * Math.cos(lat) ** 2;
  const a = Math.cos(lat) * (wrapLon(p.lon - centralMeridian(zone)) * RAD);
  const easting = K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120) + FALSE_EASTING;
  const northing =
    K0 * (meridianArc(lat) + n * Math.tan(lat) * ((a * a) / 2 + ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 + ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720));
  return { easting, northing: p.lat < 0 ? northing + FALSE_NORTHING_SOUTH : northing };
}

/** The position at a UTM easting and northing in `zone`; `south` when the northing carries the southern false northing. */
export function fromUtm(utm: { easting: number; northing: number }, zone: number, south: boolean): LatLon {
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const x = utm.easting - FALSE_EASTING;
  const y = south ? utm.northing - FALSE_NORTHING_SOUTH : utm.northing;
  const mu = y / K0 / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 =
    mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2);
  const t1 = Math.tan(phi1) ** 2;
  const c1 = EP2 * Math.cos(phi1) ** 2;
  const r1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5;
  const d = x / (n1 * K0);
  const lat =
    phi1 - ((n1 * Math.tan(phi1)) / r1) * ((d * d) / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4) / 24 + ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon = (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5) / 120) / Math.cos(phi1);
  return { lat: lat / RAD, lon: wrapLon(centralMeridian(zone) + lon / RAD) };
}
