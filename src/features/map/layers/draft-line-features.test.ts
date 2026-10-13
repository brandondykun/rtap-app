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
});
