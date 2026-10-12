import { isValidLatLon, parsePointGeometry, pointCoord, pointGeometry } from './geometry';

describe('point geometry', () => {
  it('serializes as GeoJSON [lon, lat]', () => {
    expect(JSON.parse(pointGeometry({ lat: 38.9, lon: -77 }))).toEqual({ type: 'Point', coordinates: [-77, 38.9] });
  });

  it('round-trips', () => {
    expect(pointCoord(pointGeometry({ lat: 1.5, lon: 2.5 }))).toEqual({ lat: 1.5, lon: 2.5 });
  });

  it.each(['not json', '{"type":"LineString","coordinates":[]}', '{"type":"Point","coordinates":[1]}', '{"type":"Point","coordinates":["a","b"]}'])(
    'rejects %p',
    (json) => {
      expect(parsePointGeometry(json)).toBeNull();
      expect(pointCoord(json)).toBeNull();
    },
  );

  it.each([
    [{ lat: 0, lon: 0 }, true],
    [{ lat: 90, lon: 180 }, true],
    [{ lat: 90.1, lon: 0 }, false],
    [{ lat: 0, lon: -180.1 }, false],
    [{ lat: Number.NaN, lon: 0 }, false],
  ])('isValidLatLon(%p) → %p', (p, valid) => {
    expect(isValidLatLon(p)).toBe(valid);
  });
});
