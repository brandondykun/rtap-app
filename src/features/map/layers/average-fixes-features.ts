import { circleRing } from '@/features/map-items/polygon-measure';
import { toRad } from '@/lib/geo/units/angle';
import type { LatLon } from '@/lib/geo/types';
import type { AverageFix } from '@/stores/gps-average';

/** Meters per point at zoom 0 on the equator (Mapbox's 512-point world). */
const M_PER_PT_Z0 = 40_075_016.686 / 512;

export type AverageFixFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    /** `accuracyPt0`: the fix's accuracy as a radius in points at zoom 0, which the layer scales with the zoom. */
    properties: { accuracyPt0: number };
  }[];
};

export type AverageRingFeatureCollection = {
  type: 'FeatureCollection';
  features: { type: 'Feature'; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: Record<string, never> }[];
};

/** One point per averaged fix, carrying its accuracy circle's size. */
export function averageFixFeatures(fixes: readonly AverageFix[]): AverageFixFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fixes.map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
      properties: { accuracyPt0: f.accuracyM / (M_PER_PT_Z0 * Math.cos(toRad(f.lat))) },
    })),
  };
}

/** The average's own ± as a ring around it (none without an average). */
export function averageRingFeatures(center: LatLon | null, accuracyM: number | null): AverageRingFeatureCollection {
  if (center === null || accuracyM === null || !(accuracyM > 0)) return { type: 'FeatureCollection', features: [] };
  const ring = circleRing(center, accuracyM).map((p): [number, number] => [p.lon, p.lat]);
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [...ring, ring[0]] }, properties: {} }] };
}
