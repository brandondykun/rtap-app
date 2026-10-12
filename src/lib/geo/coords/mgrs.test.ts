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
