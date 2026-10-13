import { act, render } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';

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
});
