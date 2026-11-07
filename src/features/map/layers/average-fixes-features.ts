import { circleRing } from '@/features/map-items/polygon-measure';
import type { LatLon } from '@/lib/geo/types';
import type { AverageFix } from '@/stores/gps-average';

export type AverageFixFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: Record<string, never>;
  }[];
};

export type AverageRingFeatureCollection = {
  type: 'FeatureCollection';
  features: { type: 'Feature'; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: Record<string, never> }[];
};

/** One point per averaged fix. */
export function averageFixFeatures(fixes: readonly AverageFix[]): AverageFixFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fixes.map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
      properties: {},
    })),
  };
}

/** The average's own ± as a ring around it (none without an average). */
export function averageRingFeatures(center: LatLon | null, accuracyM: number | null): AverageRingFeatureCollection {
  if (center === null || accuracyM === null || !(accuracyM > 0)) return { type: 'FeatureCollection', features: [] };
  const ring = circleRing(center, accuracyM).map((p): [number, number] => [p.lon, p.lat]);
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [...ring, ring[0]] }, properties: {} }] };
}
