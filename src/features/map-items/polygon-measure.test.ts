import { inverse } from '@/lib/geo/measure/geodesic';

import { areaM2, circleRing, formatArea, perimeterM, ringCenter } from './polygon-measure';

const sq = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }, { lat: 0.01, lon: 0.01 }, { lat: 0.01, lon: 0 }];

describe('polygon measurement', () => {
  it('measures the closed perimeter and the area', () => {
    expect(perimeterM(sq)).toBeCloseTo(4437.9, 0);
    expect(areaM2(sq)).toBeCloseTo(1_230_907, -2);
    expect(perimeterM(sq.slice(0, 2))).toBe(0);
  });

  it('builds a 64-point circle ring at the radius', () => {
    const c = { lat: 38.9, lon: -77 };
    const ring = circleRing(c, 500);
    expect(ring).toHaveLength(64);
    for (const p of ring) expect(inverse(c, p).distanceM).toBeCloseTo(500, 3);
  });

  it('formats areas in km² or m²', () => {
    expect(formatArea(1_230_907)).toBe('1.23 km²');
    expect(formatArea(420_000)).toBe('0.42 km²');
    expect(formatArea(8_500)).toBe('8,500 m²');
    expect(formatArea(45_600_000)).toBe('45.6 km²');
    expect(formatArea(250_000_000)).toBe('250 km²');
  });

  it('centers labels on the average of the points', () => {
    expect(ringCenter(sq)).toEqual({ lat: 0.005, lon: 0.005 });
  });
});
