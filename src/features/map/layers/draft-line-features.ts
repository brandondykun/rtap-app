import { segmentLengths } from '@/features/map-items/line-measure';
import { lineLabel, lineTypeInfo, type LineType } from '@/features/symbology/line-types';
import { formatDistance } from '@/lib/geo/format/measure';
import { inverse, midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

type Role = 'line' | 'segment' | 'vertex' | 'label' | 'end';
type Props = { role: Role; label?: string; number?: string; index?: number; selected?: boolean; dash?: string; width?: string; decoration?: string; bearing?: number };
type Feature =
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: Props }
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Props };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

/** The line being drawn: its line, distance chips, numbered vertices and the name chip at the end. */
export function draftLineFeatures(d: { vertices: LatLon[]; selected: number | null; lineType: LineType; name: string; showDistances?: boolean }): { type: 'FeatureCollection'; features: Feature[] } {
  const { vertices } = d;
  const features: Feature[] = [];
  if (vertices.length >= 2) {
    const info = lineTypeInfo(d.lineType);
    features.push({ type: 'Feature', id: 'line', geometry: { type: 'LineString', coordinates: vertices.map(lonLat) }, properties: { role: 'line', dash: info.dash, width: info.width, decoration: info.decoration } });
    if (d.showDistances !== false) {
      segmentLengths(vertices).forEach((m, i) =>
        features.push({
          type: 'Feature',
          id: `segment-${i}`,
          geometry: { type: 'Point', coordinates: lonLat(midpoint(vertices[i], vertices[i + 1])) },
          properties: { role: 'segment', label: formatDistance(m) },
        }),
      );
    }
  }
  if (vertices.length >= 2 && lineTypeInfo(d.lineType).endArrow) {
    const last = vertices.length - 1;
    features.push({
      type: 'Feature',
      id: 'end',
      geometry: { type: 'Point', coordinates: lonLat(vertices[last]) },
      properties: { role: 'end', bearing: inverse(vertices[last - 1], vertices[last]).azimuthTrue ?? 0 },
    });
  }
  vertices.forEach((v, i) =>
    features.push({ type: 'Feature', id: `vertex-${i}`, geometry: { type: 'Point', coordinates: lonLat(v) }, properties: { role: 'vertex', number: String(i + 1), index: i, selected: d.selected === i } }),
  );
  if (vertices.length >= 2 && d.name.trim()) {
    features.push({ type: 'Feature', id: 'label', geometry: { type: 'Point', coordinates: lonLat(vertices[vertices.length - 1]) }, properties: { role: 'label', label: lineLabel(d.lineType, d.name) } });
  }
  return { type: 'FeatureCollection', features };
}
