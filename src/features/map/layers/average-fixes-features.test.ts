import { inverse } from '@/lib/geo/measure/geodesic';

import { averageFixFeatures, averageRingFeatures } from './average-fixes-features';

describe('averageFixFeatures', () => {
  it('puts each fix at its position', () => {
    const { features } = averageFixFeatures([
      { lat: 0, lon: 10, accuracyM: 5, at: 0 },
      { lat: 60, lon: 10, accuracyM: 5, at: 1000 },
    ]);
    expect(features.map((f) => f.geometry.coordinates)).toEqual([
      [10, 0],
      [10, 60],
    ]);
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
