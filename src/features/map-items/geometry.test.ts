import {
  isValidLatLon,
  lineGeometry,
  parseLineGeometry,
  parsePointGeometry,
  parsePolygonGeometry,
  pointCoord,
  pointGeometry,
  polygonGeometry,
} from './geometry';

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

describe('line geometry', () => {
  const A = { lat: 38.9, lon: -77 };
  const B = { lat: 38.91, lon: -77.01 };

  it('round-trips a LineString in [lon, lat] order', () => {
    const json = lineGeometry([A, B]);
    expect(JSON.parse(json)).toEqual({ type: 'LineString', coordinates: [[-77, 38.9], [-77.01, 38.91]] });
    expect(parseLineGeometry(json)).toEqual([A, B]);
  });

  it('rejects fewer than 2 points, bad JSON and other geometry types', () => {
    expect(parseLineGeometry(JSON.stringify({ type: 'LineString', coordinates: [[-77, 38.9]] }))).toBeNull();
    expect(parseLineGeometry('nope')).toBeNull();
    expect(parseLineGeometry(JSON.stringify({ type: 'Point', coordinates: [-77, 38.9] }))).toBeNull();
    expect(parseLineGeometry(JSON.stringify({ type: 'LineString', coordinates: [[-77, 38.9], [500, 1]] }))).toBeNull();
  });
});

describe('polygon geometry', () => {
  const ring = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }, { lat: 0.01, lon: 0.01 }];

  it('closes the ring when storing and opens it when reading', () => {
    const json = polygonGeometry(ring);
    expect(JSON.parse(json)).toEqual({ type: 'Polygon', coordinates: [[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0]]] });
    expect(parsePolygonGeometry(json)).toEqual(ring);
  });

  it('rejects fewer than 3 points, bad JSON, other types and invalid positions', () => {
    expect(parsePolygonGeometry(JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [0, 1], [0, 0]]] }))).toBeNull();
    expect(parsePolygonGeometry('nope')).toBeNull();
    expect(parsePolygonGeometry(JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [1, 1]] }))).toBeNull();
    expect(parsePolygonGeometry(JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [0, 1], [500, 1], [0, 0]]] }))).toBeNull();
  });
});
