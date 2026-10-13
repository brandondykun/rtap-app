import { destination, inverse, midpoint, polygonAreaM2 } from './geodesic';

describe('inverse (WGS84, Karney)', () => {
  it('JFK → CDG matches GeographicLib', () => {
    const r = inverse({ lat: 40.6, lon: -73.8 }, { lat: 49.01666667, lon: 2.55 });
    expect(r.distanceM).toBeCloseTo(5853226.256, 2);
    expect(r.azimuthTrue).toBeCloseTo(53.4702182, 6);
  });

  it('handles nearly antipodal points', () => {
    const r = inverse({ lat: 0, lon: 0 }, { lat: 0.5, lon: 179.5 });
    expect(r.distanceM).toBeCloseTo(19936288.579, 2);
    expect(r.azimuthTrue).toBeCloseTo(25.6718729, 6);
  });

  it('returns a null azimuth for coincident points', () => {
    const p = { lat: 38.8977, lon: -77.0365 };
    expect(inverse(p, p)).toEqual({ distanceM: 0, azimuthTrue: null });
  });

  it('returns azimuths in [0, 360)', () => {
    const r = inverse({ lat: 0, lon: 0 }, { lat: 0, lon: -1 });
    expect(r.azimuthTrue).toBeCloseTo(270, 6);
  });
});

describe('destination', () => {
  it('is the inverse of inverse()', () => {
    const d = destination({ lat: 40.6, lon: -73.8 }, 53.47, 5853226);
    expect(d.lat).toBeCloseTo(49.0168289, 6);
    expect(d.lon).toBeCloseTo(2.5500938, 6);
  });
});

describe('midpoint', () => {
  it('is equidistant along the geodesic', () => {
    const a = { lat: 38.8977, lon: -77.0365 };
    const b = { lat: 38.95, lon: -76.9 };
    const m = midpoint(a, b);
    const total = inverse(a, b).distanceM;
    expect(inverse(a, m).distanceM).toBeCloseTo(total / 2, 3);
    expect(inverse(m, b).distanceM).toBeCloseTo(total / 2, 3);
  });

  it('returns the start for identical points', () => {
    const a = { lat: 10, lon: 20 };
    expect(midpoint(a, a)).toEqual(a);
  });
});

describe('polygonAreaM2', () => {
  it('measures a 0.01° square at the equator in either winding', () => {
    const sq = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }, { lat: 0.01, lon: 0.01 }, { lat: 0.01, lon: 0 }];
    expect(polygonAreaM2(sq)).toBeCloseTo(1_230_907, -2);
    expect(polygonAreaM2([...sq].reverse())).toBeCloseTo(1_230_907, -2);
    expect(polygonAreaM2(sq.slice(0, 2))).toBe(0);
  });
});
