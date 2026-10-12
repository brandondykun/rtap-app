import * as mgrs from 'mgrs';

import { err, ok, type Result } from '@/lib/result';

import type { LatLon } from '../types';

export type MgrsPrecision = 1 | 2 | 3 | 4 | 5;
export type MgrsError = 'out_of_range' | 'invalid';
export type MgrsParts = { zoneBand: string; square: string; easting: string; northing: string };

/** MGRS covers 80°S to 84°N; polar regions use UPS, which the app does not support. */
const MIN_LAT = -80;
const MAX_LAT = 84;

// Zone 1–60 + band (C–X without I/O), 100 km square (A–Z without I/O), 0–10 digits.
const COMPACT_RE = /^(\d{1,2}[C-HJ-NP-X])([A-HJ-NP-Z]{2})(\d{0,10})$/;

export function toMgrs(p: LatLon, precision: MgrsPrecision = 5): Result<string, MgrsError> {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return err('invalid', 'Position is not a number');
  if (p.lat < MIN_LAT || p.lat > MAX_LAT) return err('out_of_range', 'MGRS covers 80°S to 84°N');
  try {
    return ok(mgrs.forward([p.lon, p.lat], precision));
  } catch (e) {
    return err('invalid', String(e));
  }
}

export function splitMgrs(input: string): Result<MgrsParts, 'invalid'> {
  const compact = input.replace(/\s+/g, '').toUpperCase();
  const m = COMPACT_RE.exec(compact);
  if (!m) return err('invalid', 'Not an MGRS reference');
  const digits = m[3];
  if (digits.length % 2 !== 0) return err('invalid', 'Easting and northing need the same number of digits');
  const half = digits.length / 2;
  return ok({ zoneBand: m[1], square: m[2], easting: digits.slice(0, half), northing: digits.slice(half) });
}

function normalizeParts(parts: MgrsParts): Result<MgrsParts, 'invalid'> {
  const clean = (s: string) => s.replace(/\s+/g, '').toUpperCase();
  const easting = clean(parts.easting);
  const northing = clean(parts.northing);
  if (easting.length === 0 || easting.length > 5 || easting.length !== northing.length) {
    return err('invalid', 'Easting and northing need the same number of digits (1–5)');
  }
  return splitMgrs(`${clean(parts.zoneBand)}${clean(parts.square)}${easting}${northing}`);
}

/** Parses an MGRS reference (string or four fields) to the center of the referenced square. */
export function parseMgrs(input: string | MgrsParts): Result<LatLon, MgrsError> {
  const parts = typeof input === 'string' ? splitMgrs(input) : normalizeParts(input);
  if (!parts.ok) return parts;
  const { zoneBand, square, easting, northing } = parts.value;
  if (easting.length === 0) return err('invalid', 'Easting and northing are required');

  let lon: number;
  let lat: number;
  try {
    [lon, lat] = mgrs.toPoint(`${zoneBand}${square}${easting}${northing}`);
  } catch (e) {
    return err('invalid', String(e));
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return err('invalid', 'Not an MGRS reference');

  // The library resolves northing using the band letter without checking it; a wrong band
  // silently yields a wrong position. Round-trip and require the same zone and band.
  const back = toMgrs({ lat, lon }, 1);
  if (!back.ok || !back.value.startsWith(zoneBand)) {
    return err('invalid', 'Grid zone does not match the square and digits');
  }
  return ok({ lat, lon });
}
