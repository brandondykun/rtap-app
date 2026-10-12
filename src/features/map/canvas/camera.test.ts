import { cameraFromMapState, clampZoom, toCameraStop, WORLD_CAMERA } from './camera';

function state(center: number[], zoom = 12, heading = 0) {
  return { properties: { center, zoom, heading } };
}

describe('camera helpers', () => {
  it('converts a map state to a mission camera', () => {
    expect(cameraFromMapState(state([-77.0365, 38.8977], 14, 30))).toEqual({
      center: { lat: 38.8977, lon: -77.0365 },
      zoom: 14,
      bearing: 30,
    });
  });

  it('normalizes longitude past the antimeridian and negative headings', () => {
    const c = cameraFromMapState(state([190, 10], 3, -90));
    expect(c?.center.lon).toBeCloseTo(-170, 9);
    expect(c?.bearing).toBe(270);
  });

  it('rejects non-finite state', () => {
    expect(cameraFromMapState(state([Number.NaN, 0]))).toBeNull();
    expect(cameraFromMapState(state([0, 0], Number.NaN))).toBeNull();
  });

  it('builds a camera stop', () => {
    expect(toCameraStop(WORLD_CAMERA)).toEqual({
      centerCoordinate: [WORLD_CAMERA.center.lon, WORLD_CAMERA.center.lat],
      zoomLevel: WORLD_CAMERA.zoom,
      heading: WORLD_CAMERA.bearing,
    });
  });

  it('clamps zoom', () => {
    expect(clampZoom(-1)).toBe(0);
    expect(clampZoom(30)).toBe(22);
    expect(clampZoom(12.5)).toBe(12.5);
  });
});
