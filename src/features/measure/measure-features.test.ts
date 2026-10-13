import { measureFeatures } from './measure-features';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };

describe('measureFeatures', () => {
  it('draws nothing without a start, only the start dot without an end', () => {
    expect(measureFeatures(null, B, 'x').features).toEqual([]);
    expect(measureFeatures(A, null, 'x').features.map((f) => f.properties.role)).toEqual(['dot']);
  });

  it('draws the line, both dots and the chip at the midpoint', () => {
    const fc = measureFeatures(A, B, '1.11 km · 000° TRUE');
    expect(fc.features.map((f) => f.properties.role)).toEqual(['line', 'dot', 'dot', 'chip']);
    const chip = fc.features[3];
    expect(chip.properties.label).toBe('1.11 km · 000° TRUE');
    expect((chip.geometry.coordinates as number[])[1]).toBeCloseTo(38.905, 3);
  });
});
