import { Geodesic } from 'geographiclib-geodesic';

import type { LatLon } from '../types';
import { normalizeDeg } from '../units/angle';

const WGS84 = Geodesic.WGS84;

/** Below this distance a bearing is meaningless (GPS noise, standing on the crosshair). */
export const MIN_BEARING_DISTANCE_M = 0.5;

export function inverse(a: LatLon, b: LatLon): { distanceM: number; azimuthTrue: number | null } {
  const r = WGS84.Inverse(a.lat, a.lon, b.lat, b.lon, Geodesic.DISTANCE | Geodesic.AZIMUTH);
  const distanceM = r.s12 ?? 0;
  if (distanceM < MIN_BEARING_DISTANCE_M || r.azi1 === undefined) return { distanceM, azimuthTrue: null };
  return { distanceM, azimuthTrue: normalizeDeg(r.azi1) };
}

export function destination(p: LatLon, azimuthTrue: number, distanceM: number): LatLon {
  const r = WGS84.Direct(p.lat, p.lon, azimuthTrue, distanceM);
  return { lat: r.lat2 as number, lon: r.lon2 as number };
}
