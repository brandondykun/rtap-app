import { midpoint } from '@/lib/geo/measure/geodesic';
import { itemCategory, type ItemCategory } from '@/features/symbology/categories';
import type { LatLon } from '@/lib/geo/types';

export type DraftRole = 'draft' | 'range' | 'range-label';

type DraftFeature =
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: { role: DraftRole; sidc?: string; label?: string; category?: ItemCategory } }
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: { role: DraftRole; sidc?: string; label?: string; category?: ItemCategory } };

export type DraftFeatureCollection = { type: 'FeatureCollection'; features: DraftFeature[] };

export type DraftFeatureInput = { coord: LatLon; sidc: string; label: string; self: LatLon | null; rangeLabel: string | null };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

/** The draft point, plus a range line and its label when the user's position is known. */
export function draftFeatureCollection(input: DraftFeatureInput | null): DraftFeatureCollection {
  if (!input) return { type: 'FeatureCollection', features: [] };
  const features: DraftFeature[] = [
    { type: 'Feature', id: 'draft', geometry: { type: 'Point', coordinates: lonLat(input.coord) }, properties: { role: 'draft', sidc: input.sidc, label: input.label, category: itemCategory({ kind: 'point', sidc: input.sidc }) } },
  ];
  if (input.self && input.rangeLabel) {
    features.push(
      { type: 'Feature', id: 'draft-range', geometry: { type: 'LineString', coordinates: [lonLat(input.self), lonLat(input.coord)] }, properties: { role: 'range' } },
      {
        type: 'Feature',
        id: 'draft-range-label',
        geometry: { type: 'Point', coordinates: lonLat(midpoint(input.self, input.coord)) },
        properties: { role: 'range-label', label: input.rangeLabel },
      },
    );
  }
  return { type: 'FeatureCollection', features };
}
