import { destination, inverse, polygonAreaM2 } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

/** A circle as a closed shape: `segments` points at `radiusM` from the center, clockwise from north. */
export function circleRing(center: LatLon, radiusM: number, segments = 64): LatLon[] {
  return Array.from({ length: segments }, (_, i) => destination(center, (360 * i) / segments, radiusM));
}

/** Closed perimeter in meters (0 for fewer than 3 points). */
export function perimeterM(points: readonly LatLon[]): number {
  if (points.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) total += inverse(points[i], points[(i + 1) % points.length]).distanceM;
  return total;
}

export const areaM2 = polygonAreaM2;

const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "0.42 km²" from 0.01 km² up (2, then 1, then 0 decimals); "8,500 m²" below. */
export function formatArea(m2: number): string {
  const km2 = m2 / 1e6;
  if (km2 < 0.01) return `${group(m2)} m²`;
  if (km2 < 10) return `${km2.toFixed(2)} km²`;
  if (km2 < 100) return `${km2.toFixed(1)} km²`;
  return `${Math.round(km2)} km²`;
}

/** Where a points polygon's label goes: the average of its points. */
export function ringCenter(points: readonly LatLon[]): LatLon {
  const n = points.length;
  return { lat: points.reduce((a, p) => a + p.lat, 0) / n, lon: points.reduce((a, p) => a + p.lon, 0) / n };
}
