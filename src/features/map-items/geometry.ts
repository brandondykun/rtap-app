import type { LatLon } from '@/lib/geo/types';

export type PointGeometry = { type: 'Point'; coordinates: [number, number] };

export function isValidLatLon(p: LatLon): boolean {
  return (
    Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
  );
}

export function pointGeometry(p: LatLon): string {
  const geometry: PointGeometry = { type: 'Point', coordinates: [p.lon, p.lat] };
  return JSON.stringify(geometry);
}

export function parsePointGeometry(json: string): PointGeometry | null {
  try {
    const g = JSON.parse(json) as { type?: unknown; coordinates?: unknown };
    if (g.type !== 'Point' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return null;
    const [lon, lat] = g.coordinates;
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;
    return { type: 'Point', coordinates: [lon, lat] };
  } catch {
    return null;
  }
}

export function pointCoord(json: string): LatLon | null {
  const g = parsePointGeometry(json);
  return g ? { lat: g.coordinates[1], lon: g.coordinates[0] } : null;
}
