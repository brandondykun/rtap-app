import { inverse } from '../measure/geodesic';

import { parseMgrs, splitMgrs, toMgrs } from './mgrs';

describe('toMgrs', () => {
  it.each([
    [38.8977, -77.0365, '18SUJ2339407395'],
    [60.5, 10.5, '32VNN8239508035'],
    [57, 3.5, '32VJJ6609530843'],
    [78, 15, '33XWG0000058369'],
    [0, 0, '31NAA6602100000'],
    [0, -0.0001, '30NZF3396700000'],
  ])('(%p, %p) → %p', (lat, lon, expected) => {
    expect(toMgrs({ lat, lon })).toEqual({ ok: true, value: expected });
  });

  it('truncates to the requested precision', () => {
    expect(toMgrs({ lat: 38.8977, lon: -77.0365 }, 3)).toEqual({ ok: true, value: '18SUJ233073' });
  });

  it.each([
    [84.5, 0],
    [-80.5, 0],
  ])('returns out_of_range for polar latitude %p', (lat, lon) => {
    const r = toMgrs({ lat, lon });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('out_of_range');
  });
});

describe('splitMgrs', () => {
  it('splits compact strings', () => {
    expect(splitMgrs('18SUJ2339407395')).toEqual({
      ok: true,
      value: { zoneBand: '18S', square: 'UJ', easting: '23394', northing: '07395' },
    });
  });

  it('accepts lowercase and spaces', () => {
    expect(splitMgrs('  18s uj 23394 07395 ')).toEqual({
      ok: true,
      value: { zoneBand: '18S', square: 'UJ', easting: '23394', northing: '07395' },
    });
  });

  it.each(['garbage', '18SUJ233', '18SUJ23394073950', '18IUJ2339407395', ''])('rejects %p', (input) => {
    expect(splitMgrs(input).ok).toBe(false);
  });
});

describe('parseMgrs', () => {
  it('parses a 1 m reference to the center of the square', () => {
    const r = parseMgrs('18SUJ2339407395');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.lat).toBeCloseTo(38.8977, 4);
      expect(r.value.lon).toBeCloseTo(-77.0365, 4);
    }
  });

  it('parses spaced, lowercase input', () => {
    const r = parseMgrs(' 18s uj 23394 07395 ');
    expect(r.ok).toBe(true);
  });

  it('parses the four-field form used by the Add Point panel', () => {
    const r = parseMgrs({ zoneBand: '18s', square: 'uj', easting: '23394', northing: '07395' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lat).toBeCloseTo(38.8977, 4);
  });

  it('rejects mismatched easting/northing lengths', () => {
    const r = parseMgrs({ zoneBand: '18S', square: 'UJ', easting: '233', northing: '07395' });
    expect(r).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('rejects empty easting/northing', () => {
    const r = parseMgrs({ zoneBand: '18S', square: 'UJ', easting: '', northing: '' });
    expect(r).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('rejects a band letter that does not match the resulting position', () => {
    // 18T is the band north of 18S; the same square/digits do not fall inside band T.
    const r = parseMgrs('18TUJ2339407395');
    expect(r).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('rejects garbage without throwing', () => {
    expect(parseMgrs('garbage')).toMatchObject({ ok: false, error: 'invalid' });
  });
});

describe('band and zone line round-trips', () => {
  const cases: Array<[number, number]> = [
    [39.9999, -77.03], // S/T band line
    [40.0001, -77.03],
    [38.9, -78.0001], // zone 17/18 line
    [38.9, -77.9999],
    [-32.0, -77.03],
    [63.9999, 5.0], // Norway
    [72.0001, 8.9999], // Svalbard
    [72.0001, 9.0001],
  ];

  it.each(cases)('parses toMgrs output at %p, %p for precisions 1–5', (lat, lon) => {
    for (const precision of [1, 2, 3, 4, 5] as const) {
      const ref = toMgrs({ lat, lon }, precision);
      expect(ref.ok).toBe(true);
      if (!ref.ok) continue;
      const parsed = parseMgrs(ref.value);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      // The parsed centre lies within about one square width of the original point.
      // (The library's forward rounding can put the original just outside its own square.)
      const squareM = 10 ** (5 - precision);
      expect(inverse(parsed.value, { lat, lon }).distanceM).toBeLessThan(squareM * 1.5);
    }
  });

  it('rejects a 32X reference, which does not exist', () => {
    expect(parseMgrs('32XNN0000000000')).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('accepts a reference just south of the S/T band line', () => {
    expect(parseMgrs('18SUK267297').ok).toBe(true);
  });
});

describe('zero-padded zones', () => {
  it('normalizes a leading zero to the bare zone number', () => {
    const r = splitMgrs('08SKG1234512345');
    expect(r.ok && r.value.zoneBand).toBe('8S');
  });

  it('parses a zero-padded reference that matches zone 8', () => {
    const ref = toMgrs({ lat: 38.9, lon: -136.5 }, 5);
    if (!ref.ok) throw new Error('setup failed');
    const padded = `0${ref.value.replace(/^0/, '')}`;
    expect(parseMgrs(padded).ok).toBe(true);
  });
});

describe('reported near-boundary references', () => {
  it.each(['18CWS65', '18JUK0823757763', '18SUK267297'])('accepts %p', (ref) => {
    expect(parseMgrs(ref).ok).toBe(true);
  });
});
