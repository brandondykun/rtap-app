import { segmentLengths } from '@/features/map-items/line-measure';
import { circleRing, ringCenter } from '@/features/map-items/polygon-measure';
import { polygonFillOpacity, polygonLabel, polygonTypeInfo, type PolygonColor, type PolygonFill, type PolygonType } from '@/features/symbology/polygon-types';
import { formatDistance } from '@/lib/geo/format/measure';
import { destination, inverse, midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

type Role = 'fill' | 'outline' | 'segment' | 'vertex' | 'center' | 'radius' | 'label';
type Props = { role: Role; label?: string; number?: string; index?: number; selected?: boolean; dash?: string; color?: PolygonColor; opacity?: number };
type Feature =
  | { type: 'Feature'; id: string; geometry: { type: 'Polygon'; coordinates: [number, number][][] }; properties: Props }
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: Props }
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Props };

export type DraftPolygonInput = {
  polygonShape: 'points' | 'circle';
  vertices: LatLon[];
  selected: number | null;
  center: LatLon | null;
  radiusM: number | null;
  polygonType: PolygonType;
  fill: PolygonFill;
  name: string;
  showDistances: boolean;
};

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];
const pt = (id: string, p: LatLon, properties: Props): Feature => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: lonLat(p) }, properties });

function closedShape(ring: LatLon[], dash: string, color: PolygonColor, opacity: number): Feature[] {
  const coords = [...ring.map(lonLat), lonLat(ring[0])];
  return [
    { type: 'Feature', id: 'fill', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { role: 'fill', color, opacity } },
    { type: 'Feature', id: 'outline', geometry: { type: 'LineString', coordinates: coords }, properties: { role: 'outline', dash, color } },
  ];
}

/** The polygon being drawn: Points (closed from 3, numbered markers, side chips) or Circle (center, ring, radius chip). */
export function draftPolygonFeatures(d: DraftPolygonInput): { type: 'FeatureCollection'; features: Feature[] } {
  const { dash, color } = polygonTypeInfo(d.polygonType);
  const opacity = polygonFillOpacity(d.fill);
  const label = d.name.trim() ? polygonLabel(d.polygonType, d.name) : '';
  const features: Feature[] = [];
  if (d.polygonShape === 'circle') {
    if (!d.center) return { type: 'FeatureCollection', features };
    if (d.radiusM) features.push(...closedShape(circleRing(d.center, d.radiusM), dash, color, opacity));
    features.push(pt('center', d.center, { role: 'center' }));
    if (d.radiusM) {
      features.push(pt('radius', destination(d.center, 90, d.radiusM), { role: 'radius', label: `r ${formatDistance(d.radiusM)}` }));
      if (label) features.push(pt('label', d.center, { role: 'label', label }));
    }
    return { type: 'FeatureCollection', features };
  }
  const v = d.vertices;
  if (v.length >= 3) features.push(...closedShape(v, dash, color, opacity));
  else if (v.length === 2) features.push({ type: 'Feature', id: 'outline', geometry: { type: 'LineString', coordinates: v.map(lonLat) }, properties: { role: 'outline', dash, color } });
  if (d.showDistances && v.length >= 2) {
    const sides = segmentLengths(v).map((m, i) => ({ m, a: v[i], b: v[i + 1] }));
    if (v.length >= 3) sides.push({ m: inverse(v[v.length - 1], v[0]).distanceM, a: v[v.length - 1], b: v[0] });
    sides.forEach((s, i) => features.push(pt(`segment-${i}`, midpoint(s.a, s.b), { role: 'segment', label: formatDistance(s.m) })));
  }
  v.forEach((p, i) => features.push(pt(`vertex-${i}`, p, { role: 'vertex', number: String(i + 1), index: i, selected: d.selected === i })));
  if (v.length >= 3 && label) features.push(pt('label', ringCenter(v), { role: 'label', label }));
  return { type: 'FeatureCollection', features };
}
