import { act, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { createMission, saveMissionCamera } from '@/features/missions/commands';
import { getMissionCamera } from '@/features/missions/repository';
import type { CommandContext } from '@/lib/db/command-context';
import { makeTestContext } from '@/lib/db/test-database';

import { CAMERA_SAVE_DEBOUNCE_MS, createCameraSaver, useCameraPersistence, type CameraSaver } from './camera-persistence';

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
}));

const A = { center: { lat: 1, lon: 1 }, zoom: 10, bearing: 0 };
const B = { center: { lat: 2, lon: 2 }, zoom: 11, bearing: 0 };

describe('createCameraSaver', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounces to the latest camera', () => {
    const save = jest.fn();
    const saver = createCameraSaver(save);
    saver.schedule(A);
    saver.schedule(B);
    jest.advanceTimersByTime(CAMERA_SAVE_DEBOUNCE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(B);
  });

  it('flushes a pending camera immediately, once', () => {
    const save = jest.fn();
    const saver = createCameraSaver(save);
    saver.schedule(A);
    saver.flush();
    saver.flush();
    jest.runAllTimers();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('useCameraPersistence', () => {
  it('saves the pending camera when the app goes to the background', async () => {
    let onChange: (s: AppStateStatus) => void = () => {};
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      onChange = cb as (s: AppStateStatus) => void;
      return { remove: jest.fn() };
    });
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');

    let saver: CameraSaver | null = null;
    function Probe({ c }: { c: CommandContext }) {
      saver = useCameraPersistence(c, r.ok ? r.value.id : '');
      return null;
    }
    await render(<Probe c={ctx} />);
    saver!.schedule(B);
    await act(async () => onChange('background'));
    await waitFor(async () => expect(await getMissionCamera(ctx.db, r.value.id)).toEqual(B));
    spy.mockImplementation(() => ({ remove: jest.fn() }));
  });

  it('saves the pending camera on unmount', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await saveMissionCamera(ctx, r.value.id, A);
    let saver: CameraSaver | null = null;
    function Probe() {
      saver = useCameraPersistence(ctx, r.ok ? r.value.id : '');
      return null;
    }
    const { unmount } = await render(<Probe />);
    saver!.schedule(B);
    await unmount();
    await waitFor(async () => expect(await getMissionCamera(ctx.db, r.value.id)).toEqual(B));
  });
});
