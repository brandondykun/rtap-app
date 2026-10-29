import { inverse } from '@/lib/geo/measure/geodesic';
import { composeSidc } from '@/features/symbology/presets';

import { pointGeometry } from './geometry';
import { createRingFeatureSelector } from './ring-selectors';
import type { MapItemSnapshot } from './repository';

function unit(id: string, updatedAt: number, overrides: Partial<MapItemSnapshot> = {}): MapItemSnapshot {
  return {
    id,
    kind: 'point',
    geometry: pointGeometry({ lat: 38.9, lon: -77 }),
    sidc: composeSidc('hostile', 'artillery'),
    style: null,
    name: 'A',
    notes: null,
    elevationM: null,
    threatRangeM: 18000,
    horizontalRangeM: null,
    verticalRangeFt: null,
    updatedAt,
    ...overrides,
  } as MapItemSnapshot;
}

describe('createRingFeatureSelector', () => {
  it('draws a closed ring 18 km from the unit', () => {
    const { features } = createRingFeatureSelector()([unit('a', 1)]);
    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual({ id: 'a', affiliation: 'hostile' });
    const ring = features[0].geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lon, lat] of ring) expect(Math.abs(inverse({ lat: 38.9, lon: -77 }, { lat, lon }).distanceM - 18000)).toBeLessThan(1);
  });

  it('maps friend to the friendly token', () => {
    const { features } = createRingFeatureSelector()([unit('a', 1, { sidc: composeSidc('friend', 'artillery') })]);
    expect(features[0].properties.affiliation).toBe('friendly');
  });

  it('skips units without a ring radius', () => {
    const { features } = createRingFeatureSelector()([unit('a', 1, { sidc: composeSidc('hostile', 'infantry') })]);
    expect(features).toHaveLength(0);
  });

  it('reuses features while updatedAt is unchanged and recenters a moved unit', () => {
    const select = createRingFeatureSelector();
    const first = select([unit('a', 1)]).features[0];
    expect(select([unit('a', 1)]).features[0]).toBe(first);
    const moved = select([unit('a', 2, { geometry: pointGeometry({ lat: 39.5, lon: -76 }) })]).features[0];
    expect(moved).not.toBe(first);
    const [lon, lat] = moved.geometry.coordinates[0][0];
    expect(Math.abs(inverse({ lat: 39.5, lon: -76 }, { lat, lon }).distanceM - 18000)).toBeLessThan(1);
  });
});
