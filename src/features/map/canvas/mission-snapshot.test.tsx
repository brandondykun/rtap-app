import { act, render } from '@testing-library/react-native';
import type { MapView } from '@rnmapbox/maps';
import { createRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { makeTestContext } from '@/lib/db/test-database';

import { captureWithin, createSnapshotCapture, SNAPSHOT_LEAVE_TIMEOUT_MS, SNAPSHOT_TAKE_TIMEOUT_MS, useMissionSnapshot } from './mission-snapshot';

type BeforeRemove = { preventDefault: () => void; data: { action: { type: string } } };
const mockListeners = new Set<(e: BeforeRemove) => void>();
const mockNavigation = {
  addListener: jest.fn((type: string, cb: (e: BeforeRemove) => void) => {
    if (type !== 'beforeRemove') return () => {};
    mockListeners.add(cb);
    return () => mockListeners.delete(cb);
  }),
  dispatch: jest.fn((action: { type: string }) => {
    // Like React Navigation: the re-dispatched action runs the beforeRemove listeners again.
    fireBeforeRemove(action);
  }),
};
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
  useNavigation: () => mockNavigation,
}));

/** Returns whether a listener prevented the removal. */
function fireBeforeRemove(action: { type: string }): boolean {
  let prevented = false;
  const e: BeforeRemove = { preventDefault: () => (prevented = true), data: { action } };
  for (const cb of [...mockListeners]) cb(e);
  return prevented;
}

const mockSave = jest.fn(async (..._args: unknown[]) => ({ ok: true }));
jest.mock('@/features/missions/snapshots', () => ({ saveMissionSnapshot: (...a: unknown[]) => mockSave(...a) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
});

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

  it('releases a hung native snapshot after the timeout so a later capture tries again', async () => {
    jest.useFakeTimers();
    try {
      const takeSnap = jest.fn(() => new Promise<string>(() => {})); // never resolves
      const save = jest.fn(async () => undefined);
      const capture = createSnapshotCapture(takeSnap, save);
      let done = false;
      void capture().then(() => (done = true));
      await jest.advanceTimersByTimeAsync(SNAPSHOT_TAKE_TIMEOUT_MS);
      expect(done).toBe(true);
      void capture();
      expect(takeSnap).toHaveBeenCalledTimes(2);
      expect(save).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
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
    // AppState.addEventListener is already a preset mock: mockRestore would wipe its default
    // implementation, so override only this render's subscription.
    jest.mocked(AppState.addEventListener).mockImplementationOnce((_t, cb) => {
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

  it('cannot capture on unmount once React has detached the map ref (Android back)', async () => {
    const takeSnap = jest.fn(async () => 'file:///s.png');
    const ref = fakeMap(takeSnap);
    const view = await render(<Harness mapRef={ref} />);
    ref.current = null; // native-stack pop: the class component's ref is detached before the blur cleanup runs
    await act(async () => view.unmount());
    expect(takeSnap).not.toHaveBeenCalled();
  });

  it('captures before the screen is removed, then lets the removal through', async () => {
    let resolve: (uri: string) => void = () => {};
    const takeSnap = jest.fn(() => new Promise<string>((r) => (resolve = r)));
    const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
    const action = { type: 'GO_BACK' };
    let prevented = false;
    await act(async () => {
      prevented = fireBeforeRemove(action);
    });
    expect(prevented).toBe(true);
    expect(takeSnap).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    await act(async () => resolve('file:///s.png'));
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), 'm1', 'file:///s.png');
    expect(mockNavigation.dispatch).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(action);
    // The re-dispatched action was not prevented again and did not take a second picture.
    expect(takeSnap).toHaveBeenCalledTimes(1);
    await act(async () => view.unmount());
  });

  it('removes the screen after the leave timeout when the picture hangs', async () => {
    jest.useFakeTimers();
    try {
      const takeSnap = jest.fn(() => new Promise<string>(() => {})); // never resolves
      const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
      await act(async () => {
        fireBeforeRemove({ type: 'GO_BACK' });
      });
      await act(async () => jest.advanceTimersByTimeAsync(SNAPSHOT_LEAVE_TIMEOUT_MS - 1));
      expect(mockNavigation.dispatch).not.toHaveBeenCalled();
      await act(async () => jest.advanceTimersByTimeAsync(1));
      expect(mockNavigation.dispatch).toHaveBeenCalledTimes(1);
      await act(async () => view.unmount());
    } finally {
      jest.useRealTimers();
    }
  });

  it('captureWithin resolves at the timeout whatever the capture does', async () => {
    jest.useFakeTimers();
    try {
      let done = false;
      void captureWithin(() => new Promise<void>(() => {}), 50).then(() => (done = true));
      await jest.advanceTimersByTimeAsync(49);
      expect(done).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(done).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
