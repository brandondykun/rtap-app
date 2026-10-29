import type { MapItemSnapshot } from './repository';
import { createLineFeatureSelector } from './line-selectors';

function line(id: string, updatedAt: number, overrides: Partial<MapItemSnapshot> = {}): MapItemSnapshot {
  return {
    id,
    kind: 'line',
    geometry: JSON.stringify({ type: 'LineString', coordinates: [[-77, 38.9], [-77, 38.91]] }),
    sidc: null,
    style: '{"lineType":"route"}',
    name: 'RED',
    notes: null,
    elevationM: null,
    threatRangeM: null,
    horizontalRangeM: null,
    verticalRangeFt: null,
    updatedAt,
    ...overrides,
  };
}

describe('createLineFeatureSelector', () => {
  it('builds line features with style properties and end labels with outward bearings', () => {
    const { lines, ends } = createLineFeatureSelector()([line('a', 1)]);
    expect(lines.features[0].properties).toEqual({
      id: 'a', name: 'RED', label: 'RTE RED', lineType: 'route', dash: 'solid', width: 'normal', endArrow: true, decoration: 'none',
    });
    expect(ends.features.map((f) => [f.properties.end, f.properties.label, f.properties.endArrow])).toEqual([
      ['start', 'RTE RED', true],
      ['end', 'RTE RED', true],
    ]);
    expect(ends.features[1].properties.bearing).toBeCloseTo(0, 0); // heading north at the end
    expect(ends.features[0].properties.bearing).toBeCloseTo(180, 0); // pointing south out of the start
  });

  it('skips points and unreadable lines, and reuses unchanged features', () => {
    const select = createLineFeatureSelector();
    const point = { ...line('p', 1), kind: 'point' as const, sidc: 'SHGPUCI--------', style: null };
    const bad = line('b', 1, { geometry: 'nope' });
    const first = select([line('a', 1), point, bad]);
    expect(first.lines.features.map((f) => f.id)).toEqual(['a']);
    const second = select([line('a', 1)]);
    expect(second.lines.features[0]).toBe(first.lines.features[0]);
    expect(select([line('a', 2)]).lines.features[0]).not.toBe(first.lines.features[0]);
  });
});
