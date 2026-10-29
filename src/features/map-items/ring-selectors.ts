import { decomposeSidc } from '@/features/symbology/presets';
import type { LatLon } from '@/lib/geo/types';

import { pointCoord } from './geometry';
import { circleRing } from './polygon-measure';
import type { MapItemSnapshot } from './repository';
import { ringRadiusM } from './unit-ranges';

export type RingAffiliation = 'friendly' | 'hostile' | 'neutral' | 'unknown';
export type RingFeature = {
  type: 'Feature';
  id: string;
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  properties: { id: string; affiliation: RingAffiliation };
};
export type RingFeatureCollection = { type: 'FeatureCollection'; features: RingFeature[] };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

function build(item: MapItemSnapshot): RingFeature | null {
  const radiusM = ringRadiusM(item);
  const center = pointCoord(item.geometry);
  const parts = item.sidc ? decomposeSidc(item.sidc) : null;
  if (radiusM === null || !center || !parts) return null;
  const ring = circleRing(center, radiusM).map(lonLat);
  return {
    type: 'Feature',
    id: item.id,
    geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
    properties: { id: item.id, affiliation: parts.affiliation === 'friend' ? 'friendly' : parts.affiliation },
  };
}

/** One range ring per unit that has a ring distance, for RingsLayer; cached per id + updatedAt. */
export function createRingFeatureSelector(): (items: readonly MapItemSnapshot[]) => RingFeatureCollection {
  let cache = new Map<string, { updatedAt: number; feature: RingFeature }>();
  return (items) => {
    const next = new Map<string, { updatedAt: number; feature: RingFeature }>();
    const features: RingFeature[] = [];
    for (const item of items) {
      if (item.kind !== 'point') continue;
      const cached = cache.get(item.id);
      const feature = cached && cached.updatedAt === item.updatedAt ? cached.feature : build(item);
      if (!feature) continue;
      next.set(item.id, { updatedAt: item.updatedAt, feature });
      features.push(feature);
    }
    cache = next;
    return { type: 'FeatureCollection', features };
  };
}
