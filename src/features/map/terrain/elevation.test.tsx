import { renderHook } from '@testing-library/react-native';

import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';

import { ELEVATION_TIMEOUT_MS, elevationAt, setElevationSource, useElevationSource } from './elevation';

const AT = { lat: 38.8977, lon: -77.0365 };

afterEach(() => {
  setElevationSource(null);
  useSettings.setState(DEFAULT_SETTINGS);
  jest.useRealTimers();
});

describe('elevationAt', () => {
  it('is unknown without a map to ask', async () => {
    expect(await elevationAt(AT)).toBeNull();
  });

  it('asks the map for the ground at a coordinate', async () => {
    const query = jest.fn(async () => 312.4);
    setElevationSource(query);
    expect(await elevationAt(AT)).toBe(312.4);
    expect(query).toHaveBeenCalledWith(AT);
  });

  it('is unknown when the map has no terrain loaded there, answers nonsense, or fails', async () => {
    for (const answer of [null, undefined, NaN]) {
      setElevationSource(async () => answer);
      expect(await elevationAt(AT)).toBeNull();
    }
    setElevationSource(async () => {
      throw new Error('no style');
    });
    expect(await elevationAt(AT)).toBeNull();
  });

  it('gives up as unknown when the map takes too long', async () => {
    jest.useFakeTimers();
    setElevationSource(() => new Promise(() => {}));
    const pending = elevationAt(AT);
    jest.advanceTimersByTime(ELEVATION_TIMEOUT_MS);
    expect(await pending).toBeNull();
  });
});

describe('useElevationSource', () => {
  it('asks the mounted map view ([lon, lat]) until unmounted', async () => {
    const queryTerrainElevation = jest.fn(async () => 120);
    const { unmount } = await renderHook(() => useElevationSource({ current: { queryTerrainElevation } as never }));
    expect(await elevationAt(AT)).toBe(120);
    expect(queryTerrainElevation).toHaveBeenCalledWith([AT.lon, AT.lat]);
    await unmount();
    expect(await elevationAt(AT)).toBeNull();
  });

  it('undoes the 3D height exaggeration, so the elevation stays true', async () => {
    useSettings.setState({ terrain3d: true });
    const queryTerrainElevation = jest.fn(async () => 150);
    await renderHook(() => useElevationSource({ current: { queryTerrainElevation } as never }));
    expect(await elevationAt(AT)).toBe(100);
  });
});
