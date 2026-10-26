import { draftPolygonFeatures } from './draft-polygon-features';

const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 + (n % 2) / 100 });
const base = { polygonShape: 'points' as const, vertices: [], selected: null, center: null, radiusM: null, polygonType: 'objective' as const, fill: 'light' as const, name: 'IRON', showDistances: true };

describe('draftPolygonFeatures', () => {
  it('closes a points polygon with a fill, a chip per side and the label', () => {
    const fc = draftPolygonFeatures({ ...base, vertices: [p(0), p(1), p(2)], selected: 2 });
    expect(fc.features.map((f) => f.properties.role)).toEqual(['fill', 'outline', 'segment', 'segment', 'segment', 'vertex', 'vertex', 'vertex', 'label']);
    expect(fc.features.find((f) => f.properties.role === 'label')!.properties.label).toBe('OBJ IRON');
    expect(fc.features.filter((f) => f.properties.role === 'vertex').map((f) => f.properties.selected)).toEqual([false, false, true]);
  });

  it('draws an open line for 2 points and no chips when distances are off', () => {
    const fc = draftPolygonFeatures({ ...base, vertices: [p(0), p(1)], showDistances: false });
    expect(fc.features.map((f) => f.properties.role)).toEqual(['outline', 'vertex', 'vertex']);
  });

  it('draws a circle: center only, then ring, fill and radius chip', () => {
    const c = { lat: 38.9, lon: -77 };
    expect(draftPolygonFeatures({ ...base, polygonShape: 'circle', center: c }).features.map((f) => f.properties.role)).toEqual(['center']);
    const fc = draftPolygonFeatures({ ...base, polygonShape: 'circle', center: c, radiusM: 500 });
    expect(fc.features.map((f) => f.properties.role)).toEqual(['fill', 'outline', 'center', 'radius', 'label']);
    expect(fc.features.find((f) => f.properties.role === 'radius')!.properties.label).toBe('r 500 m');
    expect((fc.features.find((f) => f.properties.role === 'outline')!.geometry.coordinates as unknown[]).length).toBe(65);
  });

  it('colors the fill and outline by type: friendly, or hostile for an impact area', () => {
    const colors = (polygonType: 'objective' | 'impact-area') =>
      draftPolygonFeatures({ ...base, polygonType, vertices: [p(0), p(1), p(2)] })
        .features.filter((f) => f.properties.role === 'fill' || f.properties.role === 'outline')
        .map((f) => f.properties.color);
    expect(colors('objective')).toEqual(['friendly', 'friendly']);
    expect(colors('impact-area')).toEqual(['hostile', 'hostile']);
    expect(draftPolygonFeatures({ ...base, polygonType: 'impact-area', vertices: [p(0), p(1)] }).features[0].properties.color).toBe('hostile');
  });
});
