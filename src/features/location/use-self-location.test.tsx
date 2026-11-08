import { act, render } from '@testing-library/react-native';
import * as Location from 'expo-location';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AppState, type AppStateStatus } from 'react-native';

import { DEFAULT_MY_LOCATION, useMyLocation } from '@/stores/my-location';
import { INITIAL_GPS_AVERAGE, useGpsAverage } from '@/stores/gps-average';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';

import { useSelfLocation } from './use-self-location';

const mocked = jest.mocked(Location);

function Probe() {
  useSelfLocation();
  return null;
}

type PositionCb = (loc: { coords: { latitude: number; longitude: number; accuracy: number | null; altitude?: number | null }; timestamp: number }) => void;
type HeadingCb = (h: { trueHeading: number; magHeading: number; accuracy: number }) => void;

function grant() {
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
  const removes = { position: jest.fn(), heading: jest.fn() };
  let onPosition: PositionCb = () => {};
  let onHeading: HeadingCb = () => {};
  mocked.watchPositionAsync.mockImplementation(async (_opts, cb) => {
    onPosition = cb as unknown as PositionCb;
    return { remove: removes.position };
  });
  mocked.watchHeadingAsync.mockImplementation(async (cb) => {
    onHeading = cb as unknown as HeadingCb;
    return { remove: removes.heading };
  });
  return { removes, position: (...a: Parameters<PositionCb>) => onPosition(...a), heading: (...a: Parameters<HeadingCb>) => onHeading(...a) };
}

beforeEach(() => {
  jest.clearAllMocks();
  usePresence.setState(INITIAL_PRESENCE);
  useGpsAverage.setState(INITIAL_GPS_AVERAGE);
  useMyLocation.setState(DEFAULT_MY_LOCATION);
  mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false } as never);
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false } as never);
});

describe('useSelfLocation', () => {
  it('publishes position and heading once permission is granted', async () => {
    const fake = grant();
    await render(<Probe />);
    expect(usePresence.getState().locationStatus).toBe('granted');

    await act(async () => fake.position({ coords: { latitude: 38.9, longitude: -77, accuracy: 4, altitude: 142.4 }, timestamp: 10 }));
    expect(usePresence.getState().selfPosition).toEqual({ position: { lat: 38.9, lon: -77 }, accuracyM: 4, timestamp: 10, altitudeM: 142.4 });
    await act(async () => fake.position({ coords: { latitude: 38.9, longitude: -77, accuracy: 4, altitude: null }, timestamp: 11 }));
    expect(usePresence.getState().selfPosition?.altitudeM).toBeNull();

    await act(async () => fake.heading({ trueHeading: 45, magHeading: 50, accuracy: 3 }));
    expect(usePresence.getState().selfHeading).toBe(45);
  });

  it('clears the heading when the compass becomes unusable', async () => {
    const fake = grant();
    await render(<Probe />);
    await act(async () => fake.heading({ trueHeading: 45, magHeading: 50, accuracy: 3 }));
    await act(async () => fake.heading({ trueHeading: -1, magHeading: -1, accuracy: 0 }));
    expect(usePresence.getState().selfHeading).toBeNull();
  });

  it('marks location denied and does not watch', async () => {
    await render(<Probe />);
    expect(usePresence.getState().locationStatus).toBe('denied');
    expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('marks location unavailable when watching fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
    mocked.watchPositionAsync.mockRejectedValueOnce(new Error('Location services are disabled'));
    await render(<Probe />);
    expect(usePresence.getState().locationStatus).toBe('unavailable');
  });

  it('retries when the app returns to the foreground after a denial', async () => {
    let onChange: (s: AppStateStatus) => void = () => {};
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      onChange = cb as (s: AppStateStatus) => void;
      return { remove: jest.fn() };
    });
    await render(<Probe />);
    expect(usePresence.getState().locationStatus).toBe('denied');

    grant();
    await act(async () => onChange('active'));
    expect(usePresence.getState().locationStatus).toBe('granted');
    // Keep a stub rather than mockRestore(): restoring wipes React Native's own jest mock of AppState.
    spy.mockImplementation(() => ({ remove: jest.fn() }));
  });

  it('stops watching and clears presence on unmount', async () => {
    const fake = grant();
    const { unmount } = await render(<Probe />);
    await act(async () => fake.position({ coords: { latitude: 38.9, longitude: -77, accuracy: 4 }, timestamp: 10 }));
    await unmount();
    expect(fake.removes.position).toHaveBeenCalled();
    expect(fake.removes.heading).toHaveBeenCalled();
    expect(usePresence.getState().selfPosition).toBeNull();
  });

  it('turns the heading with the screen in landscape and upside down', async () => {
    const turn = (ScreenOrientation as unknown as { __emit: (o: number) => void }).__emit;
    const fake = grant();
    await render(<Probe />);
    await act(async () => {});
    await act(async () => fake.heading({ trueHeading: 10, magHeading: 0, accuracy: 1 }));
    expect(usePresence.getState().selfHeading).toBe(10);
    await act(async () => turn(ScreenOrientation.Orientation.LANDSCAPE_RIGHT));
    expect(usePresence.getState().selfHeading).toBe(100);
    await act(async () => turn(ScreenOrientation.Orientation.LANDSCAPE_LEFT));
    expect(usePresence.getState().selfHeading).toBe(280);
    await act(async () => turn(ScreenOrientation.Orientation.PORTRAIT_DOWN));
    expect(usePresence.getState().selfHeading).toBe(190);
    await act(async () => turn(ScreenOrientation.Orientation.PORTRAIT_UP));
    expect(usePresence.getState().selfHeading).toBe(10);
  });

  it('applies the orientation the screen starts in', async () => {
    jest.mocked(ScreenOrientation.getOrientationAsync).mockResolvedValueOnce(ScreenOrientation.Orientation.LANDSCAPE_RIGHT);
    const fake = grant();
    await render(<Probe />);
    await act(async () => {});
    await act(async () => fake.heading({ trueHeading: 350, magHeading: 0, accuracy: 1 }));
    expect(usePresence.getState().selfHeading).toBe(80);
  });

  describe('with Average mode on', () => {
    const fix = (latitude: number, timestamp: number, accuracy = 5) => ({ coords: { latitude, longitude: -77, accuracy, altitude: null }, timestamp });

    it('publishes the averaged position while averaging, marked averaged', async () => {
      const fake = grant();
      await render(<Probe />);
      await act(async () => useGpsAverage.getState().start());
      await act(async () => fake.position(fix(38.9, 1000)));
      await act(async () => fake.position(fix(38.9000002, 2000)));
      expect(usePresence.getState().selfPosition).toMatchObject({ averaged: true, timestamp: 2000 });
      expect(usePresence.getState().selfPosition?.position.lat).toBeCloseTo(38.9, 5);
    });

    it('publishes the live fix until a usable sample is averaged', async () => {
      const fake = grant();
      await render(<Probe />);
      await act(async () => useGpsAverage.getState().start());
      await act(async () => fake.position({ coords: { latitude: 38.9, longitude: -77, accuracy: null }, timestamp: 1000 }));
      const published = usePresence.getState().selfPosition;
      expect(published).toMatchObject({ position: { lat: 38.9, lon: -77 }, accuracyM: null, timestamp: 1000 });
      expect(published?.averaged).toBeUndefined();
    });

    /** Half a minute on the spot, one fix a second: well before any pause's drop-back. */
    const averageHalfAMinute = async (fake: ReturnType<typeof grant>) => {
      await act(async () => useGpsAverage.getState().start());
      for (let i = 0; i <= 30; i++) await act(async () => fake.position(fix(38.9, i * 1000)));
    };

    it('publishes the live fix while paused when the move came too soon to keep anything averaged', async () => {
      const fake = grant();
      await render(<Probe />);
      await act(async () => useGpsAverage.getState().start());
      await act(async () => fake.position(fix(38.9, 1000)));
      await act(async () => useGpsAverage.getState().pause(1000));
      await act(async () => fake.position(fix(38.91, 2000)));
      const published = usePresence.getState().selfPosition;
      expect(published).toMatchObject({ position: { lat: 38.91, lon: -77 }, timestamp: 2000 });
      expect(published?.averaged).toBeUndefined();
    });

    it('holds the average as me while paused, as live fixes keep arriving', async () => {
      const fake = grant();
      await render(<Probe />);
      await averageHalfAMinute(fake);
      await act(async () => useGpsAverage.getState().pause(60_000));
      await act(async () => fake.position(fix(38.91, 61_000)));
      const published = usePresence.getState().selfPosition;
      expect(published).toMatchObject({ averaged: true, timestamp: 61_000 });
      expect(published?.position.lat).toBeCloseTo(38.9, 6);
      // The live fix is still known: Resume and the "you moved" distance use it.
      expect(useGpsAverage.getState().live?.position.lat).toBe(38.91);
    });

    it('holds the average the moment averaging pauses (motion sensor or leaving the app)', async () => {
      const fake = grant();
      await render(<Probe />);
      await averageHalfAMinute(fake);
      // What the accelerometer and the background listener call: no new fix comes with it.
      await act(async () => useGpsAverage.getState().pause(60_000));
      expect(usePresence.getState().selfPosition).toMatchObject({ averaged: true, timestamp: 30_000 });
      expect(usePresence.getState().selfPosition?.position.lat).toBeCloseTo(38.9, 6);
    });

    it('republishes the last live fix, plain, when averaging is turned off', async () => {
      const fake = grant();
      await render(<Probe />);
      await act(async () => useGpsAverage.getState().start());
      await act(async () => fake.position(fix(38.9, 1000)));
      await act(async () => fake.position(fix(38.9000002, 2000)));
      await act(async () => useGpsAverage.getState().stop());
      const published = usePresence.getState().selfPosition;
      expect(published).toMatchObject({ position: { lat: 38.9000002, lon: -77 }, timestamp: 2000 });
      expect(published?.averaged).toBeUndefined();
    });

    it('holds the average, not the far fix, when GPS itself notices the move', async () => {
      const fake = grant();
      await render(<Probe />);
      await averageHalfAMinute(fake);
      for (let i = 0; i < 3; i++) await act(async () => fake.position(fix(38.901, 40_000 + i * 1000)));
      expect(useGpsAverage.getState().phase).toBe('paused');
      const published = usePresence.getState().selfPosition;
      expect(published).toMatchObject({ averaged: true, timestamp: 42_000 });
      expect(published?.position.lat).toBeCloseTo(38.9, 6);
    });

    it('clears me when averaging stops with no live fix to fall back on', async () => {
      grant();
      await render(<Probe />);
      await act(async () => useGpsAverage.getState().start());
      await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 2, timestamp: 1, averaged: true }));
      await act(async () => useGpsAverage.getState().pause(10));
      expect(usePresence.getState().selfPosition).toBeNull();
    });

    it('restarts the GPS watch with distanceInterval 0 and the finest accuracy while Average mode is on (paused too), and back after', async () => {
      const fake = grant();
      await render(<Probe />);
      expect(mocked.watchPositionAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({ accuracy: Location.Accuracy.Highest, distanceInterval: 1, timeInterval: 1000 }),
        expect.any(Function),
      );
      await act(async () => useGpsAverage.getState().start());
      expect(mocked.watchPositionAsync).toHaveBeenCalledTimes(2);
      expect(mocked.watchPositionAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0 }),
        expect.any(Function),
      );
      expect(fake.removes.position).toHaveBeenCalledTimes(1);
      // The compass keeps running.
      expect(mocked.watchHeadingAsync).toHaveBeenCalledTimes(1);
      expect(fake.removes.heading).not.toHaveBeenCalled();
      // Paused, a user standing back on the spot still needs a fresh fix to resume.
      await act(async () => useGpsAverage.getState().pause(1000));
      expect(mocked.watchPositionAsync).toHaveBeenCalledTimes(2);
      await act(async () => useGpsAverage.getState().stop());
      expect(mocked.watchPositionAsync).toHaveBeenCalledTimes(3);
      expect(mocked.watchPositionAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({ accuracy: Location.Accuracy.Highest, distanceInterval: 1 }),
        expect.any(Function),
      );
    });

    it('turns averaging off when the source switches to Manual', async () => {
      grant();
      await render(<Probe />);
      await act(async () => useGpsAverage.getState().start());
      await act(async () => useMyLocation.getState().setManual({ lat: 1, lon: 2 }));
      expect(useGpsAverage.getState().phase).toBe('off');
    });

    it('turns averaging off when location goes off (denied)', async () => {
      useGpsAverage.getState().start();
      await render(<Probe />);
      await act(async () => {});
      expect(usePresence.getState().locationStatus).toBe('denied');
      expect(useGpsAverage.getState().phase).toBe('off');
    });

    it('turns averaging off when location goes off (unavailable)', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
      mocked.watchPositionAsync.mockRejectedValueOnce(new Error('Location services are disabled'));
      useGpsAverage.getState().start();
      await render(<Probe />);
      await act(async () => {});
      expect(usePresence.getState().locationStatus).toBe('unavailable');
      expect(useGpsAverage.getState().phase).toBe('off');
    });
  });

  describe('with Manual chosen', () => {
    it('does not ask for or watch location, and publishes the manual position', async () => {
      useMyLocation.getState().setManual({ lat: 38.9, lon: -77 });
      await render(<Probe />);
      await act(async () => {});
      expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
      expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
      expect(usePresence.getState().selfPosition).toMatchObject({ position: { lat: 38.9, lon: -77 }, accuracyM: null, altitudeM: null, manual: true });
      expect(usePresence.getState()).toMatchObject({ selfHeading: null, locationStatus: 'denied' });
    });

    it('stops GPS when switched to Manual, ignores later fixes, and starts it again when switched back', async () => {
      const fake = grant();
      await render(<Probe />);
      await act(async () => useMyLocation.getState().setManual({ lat: 1, lon: 2 }));
      expect(fake.removes.position).toHaveBeenCalled();
      expect(fake.removes.heading).toHaveBeenCalled();
      expect(usePresence.getState().selfPosition?.manual).toBe(true);
      await act(async () => fake.position({ coords: { latitude: 9, longitude: 9, accuracy: 3 }, timestamp: 5 }));
      expect(usePresence.getState().selfPosition?.position).toEqual({ lat: 1, lon: 2 });
      await act(async () => useMyLocation.getState().switchToGps());
      expect(mocked.watchPositionAsync).toHaveBeenCalledTimes(2);
      expect(usePresence.getState().selfPosition).toBeNull();
    });

    it('stays Manual when permission is granted later (no GPS watch)', async () => {
      let onChange: (s: AppStateStatus) => void = () => {};
      const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
        onChange = cb as (s: AppStateStatus) => void;
        return { remove: jest.fn() };
      });
      useMyLocation.getState().setManual({ lat: 1, lon: 2 });
      await render(<Probe />);
      await act(async () => {});
      expect(usePresence.getState().locationStatus).toBe('denied');
      mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
      await act(async () => onChange('active'));
      expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
      expect(usePresence.getState()).toMatchObject({ locationStatus: 'granted', selfPosition: { manual: true } });
      spy.mockImplementation(() => ({ remove: jest.fn() }));
    });

    it('publishes no position while no manual position is set', async () => {
      useMyLocation.getState().switchToManual();
      mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
      await render(<Probe />);
      await act(async () => {});
      expect(usePresence.getState()).toMatchObject({ selfPosition: null, locationStatus: 'granted' });
    });

    it('reports a permission that can still be asked for (iOS Allow Once expired) as unknown, not denied', async () => {
      useMyLocation.getState().setManual({ lat: 1, lon: 2 });
      mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined', granted: false, canAskAgain: true } as never);
      await render(<Probe />);
      await act(async () => {});
      expect(usePresence.getState().locationStatus).toBe('unknown');
    });
  });
});
