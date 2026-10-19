import { act, render } from '@testing-library/react-native';
import type { MapView } from '@rnmapbox/maps';
import { createRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { makeTestContext } from '@/lib/db/test-database';

import { captureBeforeLeave, createSnapshotCapture, SNAPSHOT_LEAVE_TIMEOUT_MS, useMissionSnapshot } from './mission-snapshot';

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
}));

const mockSave = jest.fn(async (..._args: unknown[]) => ({ ok: true }));
jest.mock('@/features/missions/snapshots', () => ({ saveMissionSnapshot: (...a: unknown[]) => mockSave(...a) }));

beforeEach(() => jest.clearAllMocks());

describe('createSnapshotCapture', () => {
  it('saves the captured image', async () => {
    const save = jest.fn(async () => undefined);
    await createSnapshotCapture(async () => 'file:///s.png', save)();
    expect(save).toHaveBeenCalledWith('file:///s.png');
  });

  it('runs one capture at a time', async () => {
    let resolve: (uri: string) => void = () => {};
    const takeSnap = jest.fn(() => new Promise<string>((r) => (resolve = r)));
    const save = jest.fn(async () => undefined);
    const capture = createSnapshotCapture(takeSnap, save);
    const a = capture();
    const b = capture();
    resolve('file:///s.png');
    await Promise.all([a, b]);
    expect(takeSnap).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('swallows failures and skips a missing image', async () => {
    const save = jest.fn(async () => undefined);
    await expect(createSnapshotCapture(async () => Promise.reject(new Error('gl')), save)()).resolves.toBeUndefined();
    await createSnapshotCapture(async () => null, save)();
    expect(save).not.toHaveBeenCalled();
  });
});

// One context for every render: a new one would recreate the capture and fire the blur cleanup.
const ctx = makeTestContext();

function Harness({ mapRef }: { mapRef: React.RefObject<MapView | null> }) {
  useMissionSnapshot(ctx, 'm1', mapRef);
  return null;
}

function fakeMap(takeSnap: jest.Mock) {
  const ref = createRef<MapView>() as React.MutableRefObject<MapView | null>;
  ref.current = { takeSnap } as unknown as MapView;
  return ref;
}

describe('useMissionSnapshot', () => {
  it('captures when the screen blurs (unmount) and when the app backgrounds', async () => {
    let onChange: (s: AppStateStatus) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
      onChange = cb as (s: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const takeSnap = jest.fn(async () => 'file:///s.png');
    const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
    await act(async () => onChange('background'));
    expect(takeSnap).toHaveBeenCalledWith(true);
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), 'm1', 'file:///s.png');
    takeSnap.mockClear();
    await act(async () => view.unmount());
    expect(takeSnap).toHaveBeenCalledTimes(1);
  });

  it('captureBeforeLeave waits for the open mission, at most the timeout', async () => {
    jest.useFakeTimers();
    const takeSnap = jest.fn(() => new Promise<string>(() => {})); // never resolves
    const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
    let done = false;
    void captureBeforeLeave().then(() => (done = true));
    await act(async () => jest.advanceTimersByTime(SNAPSHOT_LEAVE_TIMEOUT_MS - 1));
    expect(done).toBe(false);
    await act(async () => jest.advanceTimersByTime(1));
    expect(done).toBe(true);
    await act(async () => view.unmount());
    jest.useRealTimers();
    await expect(captureBeforeLeave()).resolves.toBeUndefined(); // no open mission: resolves at once
  });
});
