import { createPolygonFeatureSelector } from './polygon-selectors';
import type { MapItemSnapshot } from './repository';

const ring = [[-77, 38.9], [-76.99, 38.9], [-76.99, 38.91], [-77, 38.9]];

function poly(id: string, updatedAt: number, overrides: Partial<MapItemSnapshot> = {}): MapItemSnapshot {
  return {
    id,
    kind: 'polygon',
    geometry: JSON.stringify({ type: 'Polygon', coordinates: [ring] }),
    sidc: null,
    style: '{"polygonType":"no-fire-area","shape":"points"}',
    name: '1',
    notes: null,
    elevationM: null,
    threatRangeM: null,
    horizontalRangeM: null,
    verticalRangeFt: null,
    updatedAt,
    ...overrides,
  };
}

describe('createPolygonFeatureSelector', () => {
  it('builds a fill, a dashed outline and a centered label', () => {
    const { fills, shapes } = createPolygonFeatureSelector()([poly('a', 1)]);
    expect(fills.features).toHaveLength(1);
    expect(fills.features[0].properties).toEqual({ id: 'a', color: 'friendly', opacity: 0.15 });
    const outline = shapes.features.find((f) => f.properties.role === 'outline')!;
    expect(outline.properties).toMatchObject({ id: 'a', dash: 'dashed', color: 'friendly' });
    expect(outline.geometry.coordinates).toHaveLength(4); // closed
    const label = shapes.features.find((f) => f.properties.role === 'label')!;
    expect(label.properties.label).toBe('NFA 1');
  });

  it('gives each fill its own opacity from the stored fill', () => {
    const { fills } = createPolygonFeatureSelector()([poly('a', 1, { style: '{"polygonType":"objective","shape":"points","fill":"heavy"}' }), poly('b', 1, { style: '{"polygonType":"objective","shape":"points","fill":"none"}' })]);
    expect(fills.features.map((f) => f.properties.opacity)).toEqual([0.5, 0]);
  });

  it('colors an impact area hostile red, fill and outline', () => {
    const { fills, shapes } = createPolygonFeatureSelector()([poly('a', 1, { style: '{"polygonType":"impact-area","shape":"points"}' })]);
    expect(fills.features[0].properties.color).toBe('hostile');
    expect(shapes.features.find((f) => f.properties.role === 'outline')!.properties).toMatchObject({ dash: 'solid', color: 'hostile' });
  });

  it('puts a circle label at its exact center, skips unreadable polygons and other kinds, and caches', () => {
    const select = createPolygonFeatureSelector();
    const circle = poly('c', 1, { style: '{"polygonType":"objective","shape":"circle","center":{"lat":38.905,"lon":-76.995},"radiusM":500}' });
    const first = select([poly('a', 1), circle, poly('b', 1, { geometry: 'nope' }), { ...poly('l', 1), kind: 'line' }]);
    expect(first.fills.features.map((f) => f.id)).toEqual(['a', 'c']);
    expect(first.shapes.features.find((f) => f.properties.id === 'c' && f.properties.role === 'label')!.geometry.coordinates).toEqual([-76.995, 38.905]);
    const second = select([poly('a', 1), circle]);
    expect(second.fills.features[0]).toBe(first.fills.features[0]);
    expect(select([poly('a', 2)]).fills.features[0]).not.toBe(first.fills.features[0]);
  });
});
