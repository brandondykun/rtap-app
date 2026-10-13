import { parseMgrs, splitMgrs, toMgrs, type MgrsParts } from '@/lib/geo/coords/mgrs';
import type { LatLon } from '@/lib/geo/types';

export const EMPTY_MGRS: MgrsParts = { zoneBand: '', square: '', easting: '', northing: '' };

export type MgrsFieldStatus =
  | { status: 'empty' }
  | { status: 'incomplete' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; coord: LatLon };

const ZONE_BAND = /^\d{1,2}[C-HJ-NP-X]$/;
const SQUARE = /^[A-HJ-NP-Z]{2}$/;

/**
 * Status of the four MGRS fields while the user types. Only `valid` carries a coordinate; the
 * map and the draft move only then, so partial input never jumps the map.
 */
export function evaluateMgrsFields(parts: MgrsParts): MgrsFieldStatus {
  const zoneBand = parts.zoneBand.replace(/\s+/g, '').toUpperCase();
  const square = parts.square.replace(/\s+/g, '').toUpperCase();
  const easting = parts.easting.replace(/\s+/g, '');
  const northing = parts.northing.replace(/\s+/g, '');
  if (!zoneBand && !square && !easting && !northing) return { status: 'empty' };
  if (/\D/.test(easting) || /\D/.test(northing)) return { status: 'invalid', message: 'Easting and northing are digits only' };
  if (northing.length > easting.length) {
    return { status: 'invalid', message: 'Easting and northing need the same number of digits' };
  }
  if (!ZONE_BAND.test(zoneBand) || !SQUARE.test(square) || easting.length === 0 || northing.length < easting.length) {
    if (zoneBand.length > 3 || square.length > 2 || easting.length > 5) return { status: 'invalid', message: 'Not an MGRS reference' };
    return { status: 'incomplete' };
  }
  const result = parseMgrs({ zoneBand, square, easting, northing });
  return result.ok ? { status: 'valid', coord: result.value } : { status: 'invalid', message: result.message };
}

/** Ten-digit MGRS fields for a coordinate (empty outside MGRS coverage). */
export function mgrsFieldsFor(coord: LatLon): MgrsParts {
  const mgrs = toMgrs(coord, 5);
  if (!mgrs.ok) return EMPTY_MGRS;
  const parts = splitMgrs(mgrs.value);
  return parts.ok ? parts.value : EMPTY_MGRS;
}
