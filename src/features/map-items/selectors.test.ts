import { DEFAULT_SIDC } from '@/features/symbology/presets';

import type { MapItemSnapshot } from './repository';
import { createPointFeatureSelector, hiddenFilter } from './selectors';

function item(id: string, updatedAt: number, overrides: Partial<MapItemSnapshot> = {}): MapItemSnapshot {
  return {
    id,
    kind: 'point',
    geometry: '{"type":"Point","coordinates":[-77,38.9]}',
    sidc: 'SHGPUCI--------',
    name: id.toUpperCase(),
    notes: null,
    updatedAt,
    ...overrides,
  };
}

describe('createPointFeatureSelector', () => {
  it('builds a FeatureCollection with id, sidc and name properties', () => {
    const select = createPointFeatureSelector();
    const fc = select([item('a', 1)]);
    expect(fc).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'a',
          geometry: { type: 'Point', coordinates: [-77, 38.9] },
          properties: { id: 'a', sidc: 'SHGPUCI--------', name: 'A' },
        },
      ],
    });
  });

  it('reuses feature objects for unchanged items', () => {
    const select = createPointFeatureSelector();
    const first = select([item('a', 1), item('b', 1)]);
    const second = select([item('a', 1), item('b', 2, { name: 'B2' })]);
    expect(second.features[0]).toBe(first.features[0]);
    expect(second.features[1]).not.toBe(first.features[1]);
    expect(second.features[1].properties.name).toBe('B2');
  });

  it('drops cache entries for removed items', () => {
    const select = createPointFeatureSelector();
    const first = select([item('a', 1)]);
    select([]);
    const third = select([item('a', 1)]);
    expect(third.features[0]).not.toBe(first.features[0]);
  });

  it('falls back to the default SIDC and skips corrupt geometry', () => {
    const select = createPointFeatureSelector();
    const fc = select([item('a', 1, { sidc: null }), item('b', 1, { geometry: 'garbage' })]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties.sidc).toBe(DEFAULT_SIDC);
  });
});

describe('hiddenFilter', () => {
  it('excludes hidden ids by property', () => {
    expect(hiddenFilter(['a', 'b'])).toEqual(['!', ['in', ['get', 'id'], ['literal', ['a', 'b']]]]);
  });
});
