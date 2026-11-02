import { act, render } from '@testing-library/react-native';
import type { MapView } from '@rnmapbox/maps';
import { createRef } from 'react';
import { AppState, Dimensions, Platform, type AppStateStatus } from 'react-native';

import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';

import { createMission } from '@/features/missions/commands';
import { placePoint } from '@/features/map-items/commands';

import { createSnapshotCapture, SNAPSHOT_SETTLE_MS, SNAPSHOT_TAKE_TIMEOUT_MS, useMissionSnapshot, watchMapChanges } from './mission-snapshot';

type BeforeRemove = { preventDefault: () => void; data: { action: { type: string } } };
const mockListeners = new Set<(e: BeforeRemove) => void>();
const mockNavigation = {
  addListener: jest.fn((type: string, cb: (e: BeforeRemove) => void) => {
    if (type !== 'beforeRemove') return () => {};
    mockListeners.add(cb);
    return () => mockListeners.delete(cb);
  }),
  dispatch: jest.fn(),
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

jest.mock('@rnmapbox/maps');

const mockSave = jest.fn(async (..._args: unknown[]) => ({ ok: true }));
jest.mock('@/features/missions/snapshots', () => ({ saveMissionSnapshot: (...a: unknown[]) => mockSave(...a) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  useMenu.setState(INITIAL_MENU);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState(DEFAULT_SETTINGS);
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

  it('swallows failures (logging them) and skips a missing image', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const save = jest.fn(async () => undefined);
    await expect(createSnapshotCapture(async () => Promise.reject(new Error('gl')), save)()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[snapshot] capture failed', expect.any(Error));
    await createSnapshotCapture(async () => null, save)();
    expect(save).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a takeSnap that throws at once does not block later captures', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const takeSnap = jest.fn((): Promise<string> => {
      throw new Error('detached');
    });
    const capture = createSnapshotCapture(takeSnap, jest.fn(async () => undefined));
    await capture();
    await capture();
    expect(takeSnap).toHaveBeenCalledTimes(2);
    warn.mockRestore();
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

// One context per test, the same for every render: a new one would recreate the capture and fire the blur cleanup.
// (Test databases close after each test.)
let ctx: ReturnType<typeof makeTestContext>;
beforeEach(() => {
  ctx = makeTestContext();
});

function Harness({ mapRef }: { mapRef: React.RefObject<MapView | null> }) {
  useMissionSnapshot(ctx, 'm1', mapRef);
  return null;
}

function fakeMap(takeSnap: jest.Mock) {
  const ref = createRef<MapView>() as React.MutableRefObject<MapView | null>;
  ref.current = { takeSnap } as unknown as MapView;
  return ref;
}

const moveCamera = (lat: number) => act(async () => useInteraction.getState().setCamera({ center: { lat, lon: 2 }, zoom: 10, bearing: 0 }));

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
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), 'm1', 'file:///s.png', expect.anything());
    takeSnap.mockClear();
    await act(async () => view.unmount());
    expect(takeSnap).toHaveBeenCalledTimes(1);
  });

  it('pictures the map once it has been still for a moment after the camera moves', async () => {
    jest.useFakeTimers();
    try {
      const takeSnap = jest.fn(async () => 'file:///s.png');
      const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
      await moveCamera(1);
      await act(async () => jest.advanceTimersByTimeAsync(SNAPSHOT_SETTLE_MS - 1));
      // Still moving: the wait starts again.
      await moveCamera(1.5);
      await act(async () => jest.advanceTimersByTimeAsync(SNAPSHOT_SETTLE_MS - 1));
      expect(takeSnap).not.toHaveBeenCalled();
      await act(async () => jest.advanceTimersByTimeAsync(1));
      expect(takeSnap).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledTimes(1);
      await act(async () => view.unmount());
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts writes to the map items, setting changes and camera moves as changes, not what was already there', async () => {
    const r = await createMission(ctx, { name: 'Snap' });
    if (!r.ok) throw new Error('setup');
    const onChange = jest.fn();
    const stop = watchMapChanges(ctx, onChange);
    // The watch's first answer (what was already on the map) changes nothing.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      await placePoint(ctx, { missionId: r.value.id, coord: { lat: 2, lon: 1 }, sidc: 'SHGPUCI--------', name: 'X' });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    useSettings.getState().toggleMapLabels();
    expect(onChange).toHaveBeenCalledTimes(2);
    useInteraction.getState().setCamera({ center: { lat: 1, lon: 2 }, zoom: 10, bearing: 0 });
    expect(onChange).toHaveBeenCalledTimes(3);
    stop();
  });

  it('starts a last picture as the screen is removed, without holding the removal up', async () => {
    const takeSnap = jest.fn(() => new Promise<string>(() => {})); // never finishes
    const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
    let prevented = true;
    await act(async () => {
      prevented = fireBeforeRemove({ type: 'GO_BACK' });
    });
    expect(prevented).toBe(false);
    expect(takeSnap).toHaveBeenCalledTimes(1);
    await act(async () => view.unmount());
  });

  it('records where the open panel covered the map when the picture was taken', async () => {
    useMenu.setState({ ...INITIAL_MENU, panelFrame: { side: 'left', size: 360 } });
    let resolve: (uri: string) => void = () => {};
    const takeSnap = jest.fn(() => new Promise<string>((r) => (resolve = r)));
    const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
    await act(async () => {
      fireBeforeRemove({ type: 'GO_BACK' });
    });
    // The menu closes while the snapshot is still being taken: the picture still shows the drawer.
    useMenu.setState({ panelFrame: null });
    await act(async () => resolve('file:///s.png'));
    const { width, height } = Dimensions.get('window');
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), 'm1', 'file:///s.png', {
      view: { width, height },
      panel: { side: 'left', size: 360 },
    });
    useMenu.setState(INITIAL_MENU);
    await act(async () => view.unmount());
  });

  it('on Android, renders the visible map offscreen centred on the crosshair, with nothing left to crop', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const offscreen = jest.requireMock('@rnmapbox/maps').snapshotManager.takeSnap as jest.Mock;
    offscreen.mockClear();
    useInteraction.setState({ cameraCenter: { lat: 40.3, lon: -80.1 }, cameraZoom: 15, cameraBearing: 10 });
    const takeSnap = jest.fn(async () => 'file:///s.png');
    const { width, height } = Dimensions.get('window');
    try {
      for (const panel of [{ side: 'left', size: 360 }, { side: 'bottom', size: 300 }] as const) {
        useMenu.setState({ ...INITIAL_MENU, panelFrame: panel });
        mockSave.mockClear();
        const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
        await act(async () => {
          fireBeforeRemove({ type: 'GO_BACK' });
        });
        const visible = panel.side === 'left' ? { width: width - 360, height } : { width, height: height - 300 };
        expect(offscreen).toHaveBeenLastCalledWith(expect.objectContaining({ centerCoordinate: [-80.1, 40.3], zoomLevel: 15, heading: 10, ...visible, writeToDisk: true }));
        expect(mockSave).toHaveBeenCalledWith(expect.anything(), 'm1', 'file:///cache/offscreen.png', { view: visible, panel: null });
        await act(async () => view.unmount());
      }
      // The on-screen snapshot is not used there.
      expect(takeSnap).not.toHaveBeenCalled();
    } finally {
      jest.restoreAllMocks();
      useMenu.setState(INITIAL_MENU);
    }
  });

  it('cannot capture on unmount once React has detached the map ref (Android back)', async () => {
    const takeSnap = jest.fn(async () => 'file:///s.png');
    const ref = fakeMap(takeSnap);
    const view = await render(<Harness mapRef={ref} />);
    ref.current = null; // native-stack pop: the class component's ref is detached before the blur cleanup runs
    await act(async () => view.unmount());
    expect(takeSnap).not.toHaveBeenCalled();
  });

  it('logs a failed save, but not a picture a panel covered', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const takeSnap = jest.fn(async () => 'file:///s.png');
    const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
    mockSave.mockResolvedValueOnce({ ok: false, error: 'covered', message: 'covered' } as never);
    await act(async () => {
      fireBeforeRemove({ type: 'GO_BACK' });
    });
    expect(warn).not.toHaveBeenCalled();
    mockSave.mockResolvedValueOnce({ ok: false, error: 'write_failed', message: 'disk' } as never);
    await act(async () => {
      fireBeforeRemove({ type: 'GO_BACK' });
    });
    expect(warn).toHaveBeenCalledWith('[snapshot] save failed', 'write_failed', 'disk');
    warn.mockRestore();
    await act(async () => view.unmount());
  });
});
