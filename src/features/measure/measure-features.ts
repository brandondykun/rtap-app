import type { RangeParts } from '@/features/map/layers/styles';
import { midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

import type { MeasurePoint } from './measure-step';

/** A dot names its `point` (start or end) and whether it is `picked` to move. */
type Props = { role: 'line' | 'dot' | 'chip'; label?: string; point?: MeasurePoint; picked?: boolean } & Partial<RangeParts>;
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
  /** The point picked to move, ringed. */
  editing: MeasurePoint | null = null,
): { type: 'FeatureCollection'; features: Feature[] } {
  const dot = (point: MeasurePoint, at: LatLon): Feature => ({
    type: 'Feature',
    id: point,
    geometry: { type: 'Point', coordinates: lonLat(at) },
    properties: { role: 'dot', point, picked: editing === point },
  });
  if (!start) return { type: 'FeatureCollection', features: [] };
  if (!end) return { type: 'FeatureCollection', features: [dot('start', start)] };
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'line', geometry: { type: 'LineString', coordinates: [lonLat(start), lonLat(end)] }, properties: { role: 'line' } },
      dot('start', start),
      dot('end', end),
      { type: 'Feature', id: 'chip', geometry: { type: 'Point', coordinates: lonLat(midpoint(start, end)) }, properties: { role: 'chip', label, ...parts } },
    ],
  };
}
