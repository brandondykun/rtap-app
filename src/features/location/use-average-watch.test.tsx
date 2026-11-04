import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';

import { INITIAL_GPS_AVERAGE, useGpsAverage } from '@/stores/gps-average';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';

import { loadAccelerometer } from './motion';
import { useAverageWatch } from './use-average-watch';
import { useSelfLocation } from './use-self-location';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}));
jest.mock('./motion', () => ({
  ...jest.requireActual('./motion'),
  loadAccelerometer: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Accelerometer, __emit } = require('expo-sensors');
const actualLoad = jest.requireActual('./motion').loadAccelerometer;

let now = 1_000_000;
let appStateCb: ((s: AppStateStatus) => void) | null = null;

/** Lets the hook's async availability check settle. */
const flush = () => act(async () => {});

/** Steady readings, then a shaken phone long enough to count as carried. */
async function carry() {
  for (let i = 0; i < 25; i++) {
    now += 100;
    await act(async () => __emit({ x: 0, y: 0, z: i % 2 ? 1.6 : 0.4 }));
  }
}

beforeEach(async () => {
  jest.clearAllMocks();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.mocked(loadAccelerometer).mockImplementation(actualLoad);
  appStateCb = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
    appStateCb = cb as (s: AppStateStatus) => void;
    return { remove: () => { appStateCb = null; } } as never;
  });
  await act(async () => useGpsAverage.setState(INITIAL_GPS_AVERAGE));
});
afterEach(() => jest.restoreAllMocks());

describe('useAverageWatch', () => {
  it('pauses when the phone is carried, with a warning haptic', async () => {
    await renderHook(() => useAverageWatch());
    await act(async () => useGpsAverage.getState().start());
    await flush();
    await carry();
    expect(useGpsAverage.getState().phase).toBe('paused');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
  });

  it('does not listen to the accelerometer unless averaging', async () => {
    await renderHook(() => useAverageWatch());
    await flush();
    expect(Accelerometer.addListener).not.toHaveBeenCalled();
    await act(async () => useGpsAverage.getState().start());
    await flush();
    expect(Accelerometer.addListener).toHaveBeenCalledTimes(1);
    await carry();
    expect(useGpsAverage.getState().phase).toBe('paused');
    Accelerometer.addListener.mockClear();
    await carry();
    expect(Accelerometer.addListener).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('pauses when the app goes to the background', async () => {
    await renderHook(() => useAverageWatch());
    await act(async () => useGpsAverage.getState().start());
    await flush();
    await act(async () => appStateCb?.('background'));
    expect(useGpsAverage.getState().phase).toBe('paused');
  });

  it('keeps working with GPS alone when the accelerometer cannot load', async () => {
    jest.mocked(loadAccelerometer).mockReturnValue(null);
    await renderHook(() => useAverageWatch());
    await act(async () => useGpsAverage.getState().start());
    await flush();
    expect(Accelerometer.addListener).not.toHaveBeenCalled();
    expect(useGpsAverage.getState().phase).toBe('averaging');
    jest.mocked(loadAccelerometer).mockReturnValue({} as never);
    await act(async () => useGpsAverage.getState().stop());
    await act(async () => useGpsAverage.getState().start());
    await flush();
    expect(useGpsAverage.getState().phase).toBe('averaging');
  });

  it('keeps the screen awake only while averaging', async () => {
    await renderHook(() => useAverageWatch());
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
    await act(async () => useGpsAverage.getState().start());
    await flush();
    expect(activateKeepAwakeAsync).toHaveBeenCalledWith('gps-average');
    await act(async () => useGpsAverage.getState().pause(now));
    expect(deactivateKeepAwake).toHaveBeenCalledWith('gps-average');
    jest.mocked(deactivateKeepAwake).mockClear();
    await act(async () => useGpsAverage.getState().start());
    await flush();
    await act(async () => useGpsAverage.getState().stop());
    expect(deactivateKeepAwake).toHaveBeenCalledWith('gps-average');
  });

  it('buzzes when GPS alone pauses averaging', async () => {
    await renderHook(() => useAverageWatch());
    await act(async () => useGpsAverage.getState().start());
    await flush();
    await act(async () => useGpsAverage.getState().pause(now));
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('useAverageWatch with useSelfLocation', () => {
  type PositionCb = (loc: { coords: { latitude: number; longitude: number; accuracy: number; altitude: null }; timestamp: number }) => void;
  let onPosition: PositionCb = () => {};
  let lastFixAt = 0;
  const fix = (latitude: number, timestamp: number) => onPosition({ coords: { latitude, longitude: -77, accuracy: 4, altitude: null }, timestamp });

  /** Both hooks mounted, averaging, with an averaged position published as me. */
  async function averaging() {
    await act(async () => usePresence.setState(INITIAL_PRESENCE));
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: 'granted', granted: true } as never);
    jest.mocked(Location.watchPositionAsync).mockImplementation(async (_opts, cb) => {
      onPosition = cb as unknown as PositionCb;
      return { remove: jest.fn() };
    });
    await renderHook(() => {
      useSelfLocation();
      useAverageWatch();
    });
    await act(async () => useGpsAverage.getState().start());
    await flush();
    await act(async () => fix(38.9, now - 2000));
    lastFixAt = now - 1000;
    await act(async () => fix(38.9000002, lastFixAt));
    expect(usePresence.getState().selfPosition?.averaged).toBe(true);
  }

  const expectLivePlain = () => {
    expect(useGpsAverage.getState().phase).toBe('paused');
    expect(usePresence.getState().selfPosition).toEqual({ position: { lat: 38.9000002, lon: -77 }, accuracyM: 4, timestamp: lastFixAt, altitudeM: null });
  };

  it('shows the live fix, plain, as soon as carrying the phone pauses averaging', async () => {
    await averaging();
    await carry();
    expectLivePlain();
  });

  it('shows the live fix, plain, as soon as leaving the app pauses averaging', async () => {
    await averaging();
    await act(async () => appStateCb?.('background'));
    expectLivePlain();
  });
});
