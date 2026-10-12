import { centralMeridian, utmZone } from '../coords/utm';
import type { LatLon } from '../types';
import { toDeg, toRad, wrapLon } from '../units/angle';

/**
 * Angle from true north to UTM grid north, east positive.
 * grid azimuth = true azimuth − convergence.
 */
export function gridConvergence(p: LatLon): number {
  const dLon = toRad(wrapLon(p.lon - centralMeridian(utmZone(p))));
  return toDeg(Math.atan(Math.tan(dLon) * Math.sin(toRad(p.lat))));
}
