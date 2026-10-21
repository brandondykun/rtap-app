import { act, renderHook } from '@testing-library/react-native';

import { INITIAL_OP, useOp } from '@/stores/op';
import { mapboxMock } from '@/test-utils/mapbox-mock';

import { OP_FIRST_REFRESH_MS, OP_GROUND_REFRESH_MS, useOpCamera } from './use-op-camera';

jest.mock('@rnmapbox/maps');

const AT = { lat: 38.8977, lon: -77.0365 };
const rafQueue: (() => void)[] = [];

const map = () => mapboxMock().__map;
const flushFrames = async () =>
  act(async () => {
    while (rafQueue.length) rafQueue.shift()!();
  });
const placements = () => map()._runNative.mock.calls.filter(([name]) => name === 'setFreeCamera');
const lastValues = () => placements().at(-1)![1] as number[][];

function setup() {
  return renderHook(() => useOpCamera({ current: map() as never }));
}

beforeEach(() => {
  jest.useFakeTimers();
  rafQueue.length = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
    rafQueue.push(() => cb(0));
    return rafQueue.length;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
  useOp.setState(INITIAL_OP);
  map()._runNative.mockClear();
  map().queryTerrainElevation.mockReset();
  map().queryTerrainElevation.mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useOpCamera', () => {
  it('on staking reads the ground and places the eye 10 m above it', async () => {
    map().queryTerrainElevation.mockResolvedValue(300);
    setup();
    await act(async () => useOp.getState().stake(AT, 45));
    await flushFrames();
    expect(map().queryTerrainElevation).toHaveBeenCalledWith([AT.lon, AT.lat]);
    expect(lastValues()).toEqual([[AT.lon, AT.lat, 310, 80, 315]]);
  });

  it('places at 0 m plus the eye when there is no terrain yet, then corrects when the refresh finds ground', async () => {
    setup();
    await act(async () => useOp.getState().stake(AT, 45));
    await flushFrames();
    expect(lastValues()).toEqual([[AT.lon, AT.lat, 10, 80, 315]]);

    map().queryTerrainElevation.mockResolvedValue(300);
    await act(async () => jest.advanceTimersByTime(OP_GROUND_REFRESH_MS));
    await flushFrames();
    expect(lastValues()).toEqual([[AT.lon, AT.lat, 310, 80, 315]]);
  });

  it('re-reads the ground shortly after staking, before the regular refresh', async () => {
    map().queryTerrainElevation.mockResolvedValueOnce(200).mockResolvedValue(300);
    setup();
    await act(async () => useOp.getState().stake(AT, 45));
    await flushFrames();
    expect(lastValues()).toEqual([[AT.lon, AT.lat, 210, 80, 315]]);
    await act(async () => jest.advanceTimersByTime(OP_FIRST_REFRESH_MS));
    await flushFrames();
    expect(lastValues()).toEqual([[AT.lon, AT.lat, 310, 80, 315]]);
  });

  it('keeps the last good ground when a refresh finds none', async () => {
    map().queryTerrainElevation.mockResolvedValue(300);
    setup();
    await act(async () => useOp.getState().stake(AT, 45));
    await flushFrames();
    map()._runNative.mockClear();
    map().queryTerrainElevation.mockResolvedValue(null);
    await act(async () => jest.advanceTimersByTime(OP_GROUND_REFRESH_MS));
    await flushFrames();
    expect(placements()).toHaveLength(0);
    expect(useOp.getState().groundM).toBe(300);
  });

  it('re-places on look and eye changes, once per frame', async () => {
    map().queryTerrainElevation.mockResolvedValue(300);
    setup();
    await act(async () => useOp.getState().stake(AT, 45));
    await flushFrames();
    map()._runNative.mockClear();

    await act(async () => {
      useOp.getState().look(10, 0);
      useOp.getState().look(5, -5);
    });
    await flushFrames();
    expect(placements()).toHaveLength(1);
    expect(lastValues()).toEqual([[AT.lon, AT.lat, 310, 75, 300]]);

    await act(async () => useOp.getState().setEye(50));
    await flushFrames();
    expect(placements()).toHaveLength(2);
    expect(lastValues()[0][2]).toBe(350);
  });

  it('does not re-place on a refresh that finds the same ground', async () => {
    map().queryTerrainElevation.mockResolvedValue(300);
    setup();
    await act(async () => useOp.getState().stake(AT, 45));
    await flushFrames();
    map()._runNative.mockClear();

    await act(async () => jest.advanceTimersByTime(OP_GROUND_REFRESH_MS * 3));
    await flushFrames();
    expect(map().queryTerrainElevation.mock.calls.length).toBeGreaterThan(1);
    expect(placements()).toHaveLength(0);
  });

  it('stops placing and refreshing after exit', async () => {
    map().queryTerrainElevation.mockResolvedValue(300);
    setup();
    await act(async () => useOp.getState().stake(AT, 45));
    await flushFrames();
    await act(async () => useOp.getState().exit());
    map()._runNative.mockClear();
    map().queryTerrainElevation.mockClear();

    await act(async () => jest.advanceTimersByTime(OP_GROUND_REFRESH_MS * 3));
    await flushFrames();
    expect(map().queryTerrainElevation).not.toHaveBeenCalled();
    expect(placements()).toHaveLength(0);
  });
});
