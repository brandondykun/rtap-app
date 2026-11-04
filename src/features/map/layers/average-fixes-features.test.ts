import { inverse } from '@/lib/geo/measure/geodesic';

import { averageFixFeatures, averageRingFeatures } from './average-fixes-features';

describe('averageFixFeatures', () => {
  it('puts each fix at its position with its accuracy as a zoom-0 radius in points', () => {
    const { features } = averageFixFeatures([
      { lat: 0, lon: 10, accuracyM: 5, at: 0 },
      { lat: 60, lon: 10, accuracyM: 5, at: 1000 },
    ]);
    expect(features.map((f) => f.geometry.coordinates)).toEqual([
      [10, 0],
      [10, 60],
    ]);
    // On the equator a point at zoom 0 is ~78 km, so 5 m is ~6.4e-5 pt; at 60° a point covers half as much ground.
    expect(features[0].properties.accuracyPt0).toBeCloseTo(5 / 78_271.517, 9);
    expect(features[1].properties.accuracyPt0).toBeCloseTo(2 * features[0].properties.accuracyPt0, 9);
    // At zoom 18 that ±5 m fix's ring is 5 m over the meters per point there: ~16.7 pt on the equator.
    expect(features[0].properties.accuracyPt0 * 2 ** 18).toBeCloseTo(5 / (78_271.517 / 2 ** 18), 3);
  });
});

describe('averageRingFeatures', () => {
  it('rings the average at its ± and is empty without one', () => {
    const center = { lat: 38.9, lon: -77 };
    const [ring] = averageRingFeatures(center, 4).features;
    const coords = ring.geometry.coordinates;
    expect(coords[0]).toEqual(coords[coords.length - 1]);
    for (const [lon, lat] of coords) expect(inverse(center, { lat, lon }).distanceM).toBeCloseTo(4, 3);
    expect(averageRingFeatures(null, 4).features).toEqual([]);
    expect(averageRingFeatures(center, null).features).toEqual([]);
  });
});
