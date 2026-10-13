import { draftLineFeatures } from './draft-line-features';

const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 });

describe('draftLineFeatures', () => {
  it('has the line, a distance chip per segment, numbered vertices and the label at the end', () => {
    const fc = draftLineFeatures({ vertices: [p(0), p(1), p(2)], selected: 1, lineType: 'phase-line', name: 'RED' });
    const roles = fc.features.map((f) => f.properties.role);
    expect(roles).toEqual(['line', 'segment', 'segment', 'vertex', 'vertex', 'vertex', 'label']);
    const vertices = fc.features.filter((f) => f.properties.role === 'vertex');
    expect(vertices.map((v) => [v.properties.number, v.properties.selected, v.properties.index])).toEqual([
      ['1', false, 0],
      ['2', true, 1],
      ['3', false, 2],
    ]);
    expect(fc.features[1].properties.label).toMatch(/^1\.11 km$/);
    expect(fc.features.at(-1)!.properties.label).toBe('PL RED');
  });

  it('draws a single vertex without a line, and nothing for no points', () => {
    expect(draftLineFeatures({ vertices: [p(0)], selected: null, lineType: 'route', name: '' }).features.map((f) => f.properties.role)).toEqual(['vertex']);
    expect(draftLineFeatures({ vertices: [], selected: null, lineType: 'route', name: '' }).features).toEqual([]);
  });


  it('adds an end feature with the outward bearing for arrowed types, and the decoration on the line', () => {
    const route = draftLineFeatures({ vertices: [p(0), p(1)], selected: null, lineType: 'route', name: '' });
    const end = route.features.find((f) => f.properties.role === 'end')!;
    expect(end.properties.bearing).toBeCloseTo(0, 0);
    expect(end.geometry.coordinates).toEqual([-77, p(1).lat]);
    const flot = draftLineFeatures({ vertices: [p(0), p(1)], selected: null, lineType: 'flot', name: '' });
    expect(flot.features.find((f) => f.properties.role === 'line')!.properties.decoration).toBe('flot-arcs');
    expect(flot.features.some((f) => f.properties.role === 'end')).toBe(false);
  });


  it('leaves out the distance chips when distances are off', () => {
    const fc = draftLineFeatures({ vertices: [p(0), p(1), p(2)], selected: null, lineType: 'phase-line', name: 'RED', showDistances: false });
    expect(fc.features.some((f) => f.properties.role === 'segment')).toBe(false);
    expect(fc.features.filter((f) => f.properties.role === 'vertex')).toHaveLength(3);
  });
});
