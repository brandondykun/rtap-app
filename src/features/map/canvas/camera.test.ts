import { cameraFromMapState, clampZoom, fitBounds, MAX_ZOOM, MIN_ZOOM, toCameraStop, WORLD_CAMERA } from './camera';

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

  it('opens a new mission on the whole world, at the furthest zoom out', () => {
    expect(WORLD_CAMERA.zoom).toBe(MIN_ZOOM);
  });

  it('builds a camera stop', () => {
    expect(toCameraStop(WORLD_CAMERA)).toEqual({
      centerCoordinate: [WORLD_CAMERA.center.lon, WORLD_CAMERA.center.lat],
      zoomLevel: WORLD_CAMERA.zoom,
      heading: WORLD_CAMERA.bearing,
    });
  });

  it('clamps zoom, never further out than the whole Earth about filling the screen', () => {
    expect(MIN_ZOOM).toBe(1.5);
    expect(clampZoom(-1)).toBe(MIN_ZOOM);
    expect(clampZoom(1)).toBe(MIN_ZOOM);
    expect(clampZoom(30)).toBe(22);
    expect(clampZoom(12.5)).toBe(12.5);
  });
});

describe('fitBounds', () => {
  const sw = { lat: 38.9, lon: -77.1 };
  const ne = { lat: 39.0, lon: -76.9 };

  it('centers the bounds and picks the zoom that fits the visible area', () => {
    const { center, zoom } = fitBounds({ sw, ne }, { width: 400, height: 800 });
    expect(center.lon).toBeCloseTo(-77, 6);
    expect(center.lat).toBeGreaterThan(38.9);
    expect(center.lat).toBeLessThan(39.0);
    // 0.2° of longitude across 400 pt: 512 * 2^z * 0.2 / 360 = 400 → z ≈ 10.6
    expect(zoom).toBeCloseTo(Math.log2((400 * 360) / (512 * 0.2)), 1);
  });

  it('zooms out when a panel leaves less room', () => {
    const open = fitBounds({ sw, ne }, { width: 400, height: 800 });
    const narrow = fitBounds({ sw, ne }, { width: 200, height: 800 });
    expect(narrow.zoom).toBeLessThan(open.zoom);
  });

  it('stops at the furthest zoom out for bounds wider than it shows', () => {
    expect(fitBounds({ sw: { lat: -60, lon: -170 }, ne: { lat: 70, lon: 170 } }, { width: 400, height: 800 }).zoom).toBe(MIN_ZOOM);
  });

  it('caps the zoom for a very short line', () => {
    expect(fitBounds({ sw, ne: { lat: 38.9000001, lon: -77.0999999 } }, { width: 400, height: 800 }).zoom).toBeLessThanOrEqual(MAX_ZOOM);
  });
});
