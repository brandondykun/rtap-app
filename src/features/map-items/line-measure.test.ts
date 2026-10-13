import { inverse } from '@/lib/geo/measure/geodesic';

import { segmentLengths, totalLength } from './line-measure';

describe('line measurement', () => {
  const pts = [
    { lat: 38.9, lon: -77 },
    { lat: 38.91, lon: -77 },
    { lat: 38.91, lon: -76.99 },
  ];

  it('measures each segment and the total geodesically', () => {
    const segs = segmentLengths(pts);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toBeCloseTo(inverse(pts[0], pts[1]).distanceM, 6);
    expect(totalLength(pts)).toBeCloseTo(segs[0] + segs[1], 6);
  });

  it('is empty / zero for fewer than 2 points', () => {
    expect(segmentLengths([pts[0]])).toEqual([]);
    expect(totalLength([])).toBe(0);
  });
});
