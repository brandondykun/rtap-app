import { polygonFillOpacity, polygonLabel, polygonStyleOf, polygonTypeInfo, type PolygonColor } from '@/features/symbology/polygon-types';
import type { LatLon } from '@/lib/geo/types';

import { parsePolygonGeometry } from './geometry';
import { ringCenter } from './polygon-measure';
import type { MapItemSnapshot } from './repository';

type Ring = [number, number][];
export type PolygonFillFeature = { type: 'Feature'; id: string; geometry: { type: 'Polygon'; coordinates: Ring[] }; properties: { id: string; color: PolygonColor; opacity: number } };
type ShapeProps = { id: string; role: 'outline' | 'label'; dash: 'solid' | 'dashed'; color: PolygonColor; label: string };
export type PolygonShapeFeature =
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: Ring }; properties: ShapeProps }
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: ShapeProps };
export type PolygonFeatures = {
  fills: { type: 'FeatureCollection'; features: PolygonFillFeature[] };
  shapes: { type: 'FeatureCollection'; features: PolygonShapeFeature[] };
};
type Built = { fill: PolygonFillFeature; shapes: PolygonShapeFeature[] };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

function build(item: MapItemSnapshot): Built | null {
  const points = parsePolygonGeometry(item.geometry);
  if (!points) return null;
  const { polygonType, shape, fill } = polygonStyleOf(item.style);
  const ring: Ring = [...points.map(lonLat), lonLat(points[0])];
  const { dash, color } = polygonTypeInfo(polygonType);
  const props = { id: item.id, dash, color, label: polygonLabel(polygonType, item.name) };
  const center = shape.kind === 'circle' ? shape.center : ringCenter(points);
  return {
    fill: { type: 'Feature', id: item.id, geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id: item.id, color, opacity: polygonFillOpacity(fill) } },
    shapes: [
      { type: 'Feature', id: `${item.id}:outline`, geometry: { type: 'LineString', coordinates: ring }, properties: { ...props, role: 'outline' } },
      { type: 'Feature', id: `${item.id}:label`, geometry: { type: 'Point', coordinates: lonLat(center) }, properties: { ...props, role: 'label' } },
    ],
  };
}

/** Saved polygons for PolygonsLayer: fills (not tappable) and outlines + labels; cached per id + updatedAt. */
export function createPolygonFeatureSelector(): (items: readonly MapItemSnapshot[]) => PolygonFeatures {
  let cache = new Map<string, { updatedAt: number; built: Built }>();
  return (items) => {
    const next = new Map<string, { updatedAt: number; built: Built }>();
    const fills: PolygonFillFeature[] = [];
    const shapes: PolygonShapeFeature[] = [];
    for (const item of items) {
      if (item.kind !== 'polygon') continue;
      const cached = cache.get(item.id);
      const built = cached && cached.updatedAt === item.updatedAt ? cached.built : build(item);
      if (!built) continue;
      next.set(item.id, { updatedAt: item.updatedAt, built });
      fills.push(built.fill);
      shapes.push(...built.shapes);
    }
    cache = next;
    return { fills: { type: 'FeatureCollection', features: fills }, shapes: { type: 'FeatureCollection', features: shapes } };
  };
}
