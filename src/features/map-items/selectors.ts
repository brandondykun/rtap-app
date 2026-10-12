import { DEFAULT_SIDC } from '@/features/symbology/presets';

import { parsePointGeometry, type PointGeometry } from './geometry';
import type { MapItemSnapshot } from './repository';

export type PointFeature = {
  type: 'Feature';
  id: string;
  geometry: PointGeometry;
  properties: { id: string; sidc: string; name: string };
};

export type PointFeatureCollection = { type: 'FeatureCollection'; features: PointFeature[] };

/**
 * Returns a selector that turns item snapshots into one FeatureCollection for a single
 * ShapeSource. Features are cached per id + updatedAt so unchanged items are not
 * re-parsed or re-allocated.
 */
export function createPointFeatureSelector(): (items: readonly MapItemSnapshot[]) => PointFeatureCollection {
  let cache = new Map<string, { updatedAt: number; feature: PointFeature }>();

  return (items) => {
    const next = new Map<string, { updatedAt: number; feature: PointFeature }>();
    const features: PointFeature[] = [];
    for (const item of items) {
      if (item.kind !== 'point') continue;
      const cached = cache.get(item.id);
      let feature = cached && cached.updatedAt === item.updatedAt ? cached.feature : null;
      if (!feature) {
        const geometry = parsePointGeometry(item.geometry);
        if (!geometry) continue;
        feature = {
          type: 'Feature',
          id: item.id,
          geometry,
          properties: { id: item.id, sidc: item.sidc ?? DEFAULT_SIDC, name: item.name },
        };
      }
      next.set(item.id, { updatedAt: item.updatedAt, feature });
      features.push(feature);
    }
    cache = next;
    return { type: 'FeatureCollection', features };
  };
}

/** Mapbox layer filter that hides items without rebuilding the source. */
export function hiddenFilter(hiddenIds: readonly string[]): unknown[] {
  return ['!', ['in', ['get', 'id'], ['literal', [...hiddenIds]]]];
}
