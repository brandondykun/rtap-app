import { inverse } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

/** Geodesic length of each segment, in meters (empty for fewer than 2 points). */
export function segmentLengths(points: readonly LatLon[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) out.push(inverse(points[i - 1], points[i]).distanceM);
  return out;
}

export function totalLength(points: readonly LatLon[]): number {
  return segmentLengths(points).reduce((a, b) => a + b, 0);
}
