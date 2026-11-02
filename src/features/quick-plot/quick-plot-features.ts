import type { RangeParts } from '@/features/map/layers/styles';
import { midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

type Role = 'temp' | 'range' | 'range-label';
type Feature =
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: { role: Role; label?: string } & Partial<RangeParts> }
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: { role: Role; label?: string } & Partial<RangeParts> };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

/** The temporary point (TEMP chip) and, with my position, the dashed range line and its chip. */
export function quickPlotFeatures(
  temp: LatLon,
  self: LatLon | null,
  rangeLabel: string | null,
  /** The label's distance and bearing, drawn each in its value color. */
  parts?: RangeParts,
): { type: 'FeatureCollection'; features: Feature[] } {
  const features: Feature[] = [];
  if (self && rangeLabel) {
    features.push(
      { type: 'Feature', id: 'range', geometry: { type: 'LineString', coordinates: [lonLat(self), lonLat(temp)] }, properties: { role: 'range' } },
      { type: 'Feature', id: 'range-label', geometry: { type: 'Point', coordinates: lonLat(midpoint(self, temp)) }, properties: { role: 'range-label', label: rangeLabel, ...parts } },
    );
  }
  features.push({ type: 'Feature', id: 'temp', geometry: { type: 'Point', coordinates: lonLat(temp) }, properties: { role: 'temp', label: 'TEMP' } });
  return { type: 'FeatureCollection', features };
}
