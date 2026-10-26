import { DEFAULT_POLYGON_FILL, POLYGON_FILLS, POLYGON_TYPES, polygonFillOpacity, polygonLabel, polygonStyle, polygonStyleOf, polygonTypeInfo } from './polygon-types';

describe('polygon types', () => {
  it('has the 11 agreed types with prefixes, dashes and colors', () => {
    expect(POLYGON_TYPES.map((t) => [t.id, t.prefix, t.dash, t.color])).toEqual([
      ['assembly-area', 'AA', 'solid', 'friendly'],
      ['objective', 'OBJ', 'solid', 'friendly'],
      ['battle-position', 'BP', 'solid', 'friendly'],
      ['engagement-area', 'EA', 'solid', 'friendly'],
      ['named-area-of-interest', 'NAI', 'solid', 'friendly'],
      ['target-area-of-interest', 'TAI', 'solid', 'friendly'],
      ['free-fire-area', 'FFA', 'dashed', 'friendly'],
      ['no-fire-area', 'NFA', 'dashed', 'friendly'],
      ['restrictive-fire-area', 'RFA', 'dashed', 'friendly'],
      ['airspace-coordination-area', 'ACA', 'dashed', 'friendly'],
      ['impact-area', 'IA', 'solid', 'hostile'],
    ]);
    expect(polygonTypeInfo('airspace-coordination-area').label).toBe('Airspace coordination area');
    expect(polygonTypeInfo('impact-area').label).toBe('Impact area');
  });

  it('labels with the prefix once', () => {
    expect(polygonLabel('objective', 'IRON')).toBe('OBJ IRON');
    expect(polygonLabel('objective', ' OBJ IRON ')).toBe('OBJ IRON');
    expect(polygonLabel('no-fire-area', '1')).toBe('NFA 1');
    expect(polygonLabel('objective', 'OBJ-2')).toBe('OBJ-2');
  });

  it('offers 5 fills from 0% to 75%, light (15%) by default, and stores only a non-default fill', () => {
    expect(POLYGON_FILLS.map((f) => [f.id, f.label, f.opacity])).toEqual([
      ['none', '0%', 0],
      ['light', '15%', 0.15],
      ['medium', '30%', 0.3],
      ['heavy', '50%', 0.5],
      ['solid', '75%', 0.75],
    ]);
    expect(DEFAULT_POLYGON_FILL).toBe('light');
    expect(polygonFillOpacity('heavy')).toBe(0.5);
    expect(polygonStyle('objective', { kind: 'points' }, 'light')).toBe('{"polygonType":"objective","shape":"points"}');
    expect(polygonStyle('objective', { kind: 'points' }, 'none')).toBe('{"polygonType":"objective","shape":"points","fill":"none"}');
    // Back to the default drops the stored fill; unknown keys are kept.
    expect(polygonStyle('objective', { kind: 'points' }, 'light', '{"fill":"solid","dash":"long"}')).toBe('{"polygonType":"objective","shape":"points","dash":"long"}');
  });

  it('round-trips points and circle styles and falls back sensibly', () => {
    expect(polygonStyleOf(polygonStyle('objective', { kind: 'points' }, 'light'))).toEqual({ polygonType: 'objective', shape: { kind: 'points' }, fill: 'light' });
    const circle = { kind: 'circle' as const, center: { lat: 38.9, lon: -77 }, radiusM: 500 };
    expect(polygonStyleOf(polygonStyle('no-fire-area', circle, 'heavy'))).toEqual({ polygonType: 'no-fire-area', shape: circle, fill: 'heavy' });
    const fallback = { polygonType: 'objective', shape: { kind: 'points' }, fill: 'light' };
    expect(polygonStyleOf(null)).toEqual(fallback);
    expect(polygonStyleOf('nope')).toEqual(fallback);
    expect(polygonStyleOf('{"polygonType":"x","shape":"circle","center":{"lat":99,"lon":0},"radiusM":5,"fill":"x"}')).toEqual(fallback);
    expect(polygonStyleOf('{"polygonType":"no-fire-area","shape":"circle","center":{"lat":1,"lon":1},"radiusM":0}').shape).toEqual({ kind: 'points' });
  });
});
