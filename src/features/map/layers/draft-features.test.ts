import { midpoint } from '@/lib/geo/measure/geodesic';

import { draftFeatureCollection } from './draft-features';

const SELF = { lat: 38.8977, lon: -77.0365 };
const DRAFT = { lat: 38.905, lon: -77.03 };

describe('draftFeatureCollection', () => {
  it('is empty without a draft', () => {
    expect(draftFeatureCollection(null).features).toEqual([]);
  });

  it('has only the draft point without a fix', () => {
    const fc = draftFeatureCollection({ coord: DRAFT, sidc: 'SHGPU----------', label: 'HOS-4 · NEW', self: null, rangeLabel: null });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]).toMatchObject({
      geometry: { type: 'Point', coordinates: [DRAFT.lon, DRAFT.lat] },
      properties: { role: 'draft', sidc: 'SHGPU----------', label: 'HOS-4 · NEW', category: 'unit' },
    });
  });

  it('adds a range line from the user and a label at its midpoint', () => {
    const fc = draftFeatureCollection({ coord: DRAFT, sidc: 'SHGPU----------', label: 'HOS-4 · NEW', self: SELF, rangeLabel: '1.15 km · 103°' });
    const line = fc.features.find((f) => f.properties.role === 'range');
    const label = fc.features.find((f) => f.properties.role === 'range-label');
    expect(line?.geometry).toEqual({ type: 'LineString', coordinates: [[SELF.lon, SELF.lat], [DRAFT.lon, DRAFT.lat]] });
    const mid = midpoint(SELF, DRAFT);
    expect(label?.geometry).toEqual({ type: 'Point', coordinates: [mid.lon, mid.lat] });
    expect(label?.properties.label).toBe('1.15 km · 103°');
  });

  it('draws the range line without a label when none is given (a selected item)', () => {
    const fc = draftFeatureCollection({ coord: DRAFT, sidc: 'SHGPU----------', label: 'HOS-4', self: SELF, rangeLabel: null });
    expect(fc.features.find((f) => f.properties.role === 'range')?.geometry).toEqual({ type: 'LineString', coordinates: [[SELF.lon, SELF.lat], [DRAFT.lon, DRAFT.lat]] });
    expect(fc.features.find((f) => f.properties.role === 'range-label')).toBeUndefined();
  });
});
