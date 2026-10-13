import type { LatLon } from '@/lib/geo/types';

/** A measurement: the start and the end (null until set). */
export type Measure = { start: LatLon | null; end: LatLon | null };

export const EMPTY_MEASURE: Measure = { start: null, end: null };

/** A tap, snap or Set: the first point is the start; every later one sets (or moves) the end. */
export function placePoint(m: Measure, p: LatLon): Measure {
  return m.start === null ? { start: p, end: null } : { start: m.start, end: p };
}

/** From me: the start is always the user's position; the end stays. */
export function fromMe(m: Measure, g: LatLon): Measure {
  return { start: g, end: m.end };
}
