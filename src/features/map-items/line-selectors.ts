import { lineLabel, lineTypeInfo, lineTypeOf, type LineType } from '@/features/symbology/line-types';
import { inverse } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

import { parseLineGeometry } from './geometry';
import type { MapItemSnapshot } from './repository';

type LineProps = { id: string; name: string; label: string; lineType: LineType; dash: 'solid' | 'dashed'; width: 'normal' | 'heavy' | 'wide'; endArrow: boolean; decoration: 'none' | 'flot-arcs' };
export type LineFeature = { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: LineProps };
export type LineEndFeature = {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; label: string; end: 'start' | 'end'; endArrow: boolean; bearing: number };
};
export type LineFeatures = {
  lines: { type: 'FeatureCollection'; features: LineFeature[] };
  ends: { type: 'FeatureCollection'; features: LineEndFeature[] };
};

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];
const bearing = (from: LatLon, to: LatLon) => inverse(from, to).azimuthTrue ?? 0;

function build(item: MapItemSnapshot): { line: LineFeature; ends: LineEndFeature[] } | null {
  const points = parseLineGeometry(item.geometry);
  if (!points) return null;
  const lineType = lineTypeOf(item.style);
  const info = lineTypeInfo(lineType);
  const label = lineLabel(lineType, item.name);
  const last = points.length - 1;
  const end = (which: 'start' | 'end'): LineEndFeature => ({
    type: 'Feature',
    id: `${item.id}:${which}`,
    geometry: { type: 'Point', coordinates: lonLat(which === 'start' ? points[0] : points[last]) },
    properties: {
      id: item.id,
      label,
      end: which,
      endArrow: info.endArrow,
      bearing: which === 'start' ? bearing(points[1], points[0]) : bearing(points[last - 1], points[last]),
    },
  });
  return {
    line: {
      type: 'Feature',
      id: item.id,
      geometry: { type: 'LineString', coordinates: points.map(lonLat) },
      properties: { id: item.id, name: item.name, label, lineType, dash: info.dash, width: info.width, endArrow: info.endArrow, decoration: info.decoration },
    },
    ends: [end('start'), end('end')],
  };
}

/** Saved lines for LinesLayer; features are cached per id + updatedAt (like the point selector). */
export function createLineFeatureSelector(): (items: readonly MapItemSnapshot[]) => LineFeatures {
  let cache = new Map<string, { updatedAt: number; built: { line: LineFeature; ends: LineEndFeature[] } }>();
  return (items) => {
    const next = new Map<string, { updatedAt: number; built: { line: LineFeature; ends: LineEndFeature[] } }>();
    const lines: LineFeature[] = [];
    const ends: LineEndFeature[] = [];
    for (const item of items) {
      if (item.kind !== 'line') continue;
      const cached = cache.get(item.id);
      const built = cached && cached.updatedAt === item.updatedAt ? cached.built : build(item);
      if (!built) continue;
      next.set(item.id, { updatedAt: item.updatedAt, built });
      lines.push(built.line);
      ends.push(...built.ends);
    }
    cache = next;
    return { lines: { type: 'FeatureCollection', features: lines }, ends: { type: 'FeatureCollection', features: ends } };
  };
}
