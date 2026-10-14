import { quickPlotFeatures } from './quick-plot-features';

const T = { lat: 38.91, lon: -77 };
const ME = { lat: 38.9, lon: -77 };

describe('quickPlotFeatures', () => {
  it('draws the TEMP point, and the range line and chip only with my position', () => {
    expect(quickPlotFeatures(T, null, null).features.map((f) => f.properties.role)).toEqual(['temp']);
    const fc = quickPlotFeatures(T, ME, '1.11 km · 000°');
    expect(fc.features.map((f) => f.properties.role)).toEqual(['range', 'range-label', 'temp']);
    expect(fc.features[2].properties.label).toBe('TEMP');
    expect(fc.features[1].properties.label).toBe('1.11 km · 000°');
  });
});
