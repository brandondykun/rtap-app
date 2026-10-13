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

export type LineGeometry = { type: 'LineString'; coordinates: [number, number][] };

export function lineGeometry(points: LatLon[]): string {
  return JSON.stringify({ type: 'LineString', coordinates: points.map((p) => [p.lon, p.lat]) });
}

/** The line's points, or null for bad JSON, another geometry, an invalid position or fewer than 2 points. */
export function parseLineGeometry(json: string): LatLon[] | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const g = value as Partial<LineGeometry> | null;
  if (!g || g.type !== 'LineString' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return null;
  const points: LatLon[] = [];
  for (const c of g.coordinates) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const p = { lat: Number(c[1]), lon: Number(c[0]) };
    if (!isValidLatLon(p)) return null;
    points.push(p);
  }
  return points;
}

/** Stores a closed ring (first point repeated at the end). */
export function polygonGeometry(points: LatLon[]): string {
  const ring = points.map((p) => [p.lon, p.lat]);
  return JSON.stringify({ type: 'Polygon', coordinates: [[...ring, ring[0]]] });
}

/** The ring's distinct points (closing point dropped), or null for bad JSON, another type, an invalid position or < 3 points. */
export function parsePolygonGeometry(json: string): LatLon[] | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const g = value as { type?: unknown; coordinates?: unknown } | null;
  if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates) || !Array.isArray(g.coordinates[0])) return null;
  const points: LatLon[] = [];
  for (const c of g.coordinates[0] as unknown[]) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const p = { lat: Number(c[1]), lon: Number(c[0]) };
    if (!isValidLatLon(p)) return null;
    points.push(p);
  }
  const last = points[points.length - 1];
  if (points.length > 1 && last.lat === points[0].lat && last.lon === points[0].lon) points.pop();
  return points.length >= 3 ? points : null;
}
