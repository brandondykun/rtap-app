import { POLYGON_TYPES, polygonLabel, polygonStyle, polygonStyleOf, polygonTypeInfo } from './polygon-types';

describe('polygon types', () => {
  it('has the 10 agreed types with prefixes and dashes', () => {
    expect(POLYGON_TYPES.map((t) => [t.id, t.prefix, t.dash])).toEqual([
      ['assembly-area', 'AA', 'solid'],
      ['objective', 'OBJ', 'solid'],
      ['battle-position', 'BP', 'solid'],
      ['engagement-area', 'EA', 'solid'],
      ['named-area-of-interest', 'NAI', 'solid'],
      ['target-area-of-interest', 'TAI', 'solid'],
      ['free-fire-area', 'FFA', 'dashed'],
      ['no-fire-area', 'NFA', 'dashed'],
      ['restrictive-fire-area', 'RFA', 'dashed'],
      ['airspace-coordination-area', 'ACA', 'dashed'],
    ]);
    expect(polygonTypeInfo('airspace-coordination-area').label).toBe('Airspace coordination area');
  });

  it('labels with the prefix once', () => {
    expect(polygonLabel('objective', 'IRON')).toBe('OBJ IRON');
    expect(polygonLabel('objective', ' OBJ IRON ')).toBe('OBJ IRON');
    expect(polygonLabel('no-fire-area', '1')).toBe('NFA 1');
  });

  it('round-trips points and circle styles and falls back sensibly', () => {
    expect(polygonStyleOf(polygonStyle('objective', { kind: 'points' }))).toEqual({ polygonType: 'objective', shape: { kind: 'points' } });
    const circle = { kind: 'circle' as const, center: { lat: 38.9, lon: -77 }, radiusM: 500 };
    expect(polygonStyleOf(polygonStyle('no-fire-area', circle))).toEqual({ polygonType: 'no-fire-area', shape: circle });
    expect(polygonStyleOf(null)).toEqual({ polygonType: 'objective', shape: { kind: 'points' } });
    expect(polygonStyleOf('nope')).toEqual({ polygonType: 'objective', shape: { kind: 'points' } });
    expect(polygonStyleOf('{"polygonType":"x","shape":"circle","center":{"lat":99,"lon":0},"radiusM":5}')).toEqual({ polygonType: 'objective', shape: { kind: 'points' } });
    expect(polygonStyleOf('{"polygonType":"no-fire-area","shape":"circle","center":{"lat":1,"lon":1},"radiusM":0}').shape).toEqual({ kind: 'points' });
  });
});
