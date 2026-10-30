import { nearestFeature } from './nearest-feature';

const pt = (id: string, lon: number, lat: number) => ({ id, geometry: { type: 'Point', coordinates: [lon, lat] } });

describe('nearestFeature', () => {
  it('picks the feature nearest the tap, whatever order they come in', () => {
    const a = pt('a', -77.001, 38.9);
    const b = pt('b', -77.0002, 38.9);
    expect(nearestFeature([a, b], { lat: 38.9, lon: -77 })?.id).toBe('b');
    expect(nearestFeature([b, a], { lat: 38.9, lon: -77.0009 })?.id).toBe('a');
  });

  it('prefers a point feature over one without a point, and keeps the first when none has one', () => {
    const line = { id: 'l', geometry: { type: 'LineString', coordinates: [] } };
    expect(nearestFeature([line, pt('p', -77.01, 38.9)], { lat: 38.9, lon: -77 })?.id).toBe('p');
    expect(nearestFeature([line, { id: 'n', geometry: null }], { lat: 38.9, lon: -77 })?.id).toBe('l');
    expect(nearestFeature([], { lat: 38.9, lon: -77 })).toBeUndefined();
  });
});
