import type { RangeParts } from '@/features/map/layers/styles';
import { midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

type Props = { role: 'line' | 'dot' | 'chip'; label?: string } & Partial<RangeParts>;
type Feature =
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: Props }
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Props };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

/** The measure line, its two dots and the readout chip (only the start dot until the end is set). */
export function measureFeatures(
  start: LatLon | null,
  end: LatLon | null,
  label: string,
  /** The label's distance and bearing, drawn each in its value color. */
  parts?: RangeParts,
): { type: 'FeatureCollection'; features: Feature[] } {
  if (!start) return { type: 'FeatureCollection', features: [] };
  if (!end) return { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'start', geometry: { type: 'Point', coordinates: lonLat(start) }, properties: { role: 'dot' } }] };
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'line', geometry: { type: 'LineString', coordinates: [lonLat(start), lonLat(end)] }, properties: { role: 'line' } },
      { type: 'Feature', id: 'start', geometry: { type: 'Point', coordinates: lonLat(start) }, properties: { role: 'dot' } },
      { type: 'Feature', id: 'end', geometry: { type: 'Point', coordinates: lonLat(end) }, properties: { role: 'dot' } },
      { type: 'Feature', id: 'chip', geometry: { type: 'Point', coordinates: lonLat(midpoint(start, end)) }, properties: { role: 'chip', label, ...parts } },
    ],
  };
}
