import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { placePoint } from '@/features/map-items/commands';
import { makeTestContext } from '@/lib/db/test-database';
import { renderWithProviders } from '@/test-utils/render';

import { createMission, markMissionOpened } from './commands';
import { findMission } from './repository';
import { MissionsScreen } from './MissionsScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => (jest.requireActual('react') as typeof import('react')).useEffect(effect, [effect]),
}));

const mockSeed = jest.fn(async (..._args: unknown[]) => ({ ok: true as const, value: { missionId: 'seeded' } }));
jest.mock('@/features/dev/commands', () => ({ PERF_SEED_COUNT: 5000, seedPerformanceMission: (...a: unknown[]) => mockSeed(...a) }));

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

// The swipeable's library gesture callbacks are only workletized by the app's Metro build, not in
// Jest; ignore that one test-environment warning and keep every other console error visible.
const consoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Some of the callbacks in the gesture are worklets')) return;
    consoleError(...args);
  });
});

beforeEach(() => jest.clearAllMocks());

describe('MissionsScreen', () => {
  it('shows an empty state that opens the create sheet', async () => {
    await renderWithProviders(<MissionsScreen />);
    expect(await screen.findByText('No missions yet')).toBeTruthy();
    expect(screen.queryByText('Swipe a mission left to delete it.')).toBeNull();
    await fireEvent.press(screen.getByText('Create mission'));
    expect(mockRouter.push).toHaveBeenCalledWith('/missions/new');
  });

  it('lists missions, last opened first, with item counts', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!iron.ok || !cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });

    await renderWithProviders(<MissionsScreen />, ctx);

    expect(await screen.findByText('2 items · Never opened')).toBeTruthy();
    expect(screen.getByText(/^0 items · Opened /)).toBeTruthy();
    const names = screen.getAllByText(/^Op /).map((node) => node.props.children);
    expect(names).toEqual(['Op Cobra', 'Op Iron']);
  });

  it('opens a mission and offers New when the list is not empty', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    if (!iron.ok) throw new Error('setup');
    await renderWithProviders(<MissionsScreen />, ctx);

    await fireEvent.press(await screen.findByLabelText('Open Op Iron'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/missions/[missionId]',
      params: { missionId: iron.value.id },
    });
    expect(screen.getByText('Swipe a mission left to delete it.')).toBeTruthy();
    await fireEvent.press(screen.getByText('+ New'));
    expect(mockRouter.push).toHaveBeenCalledWith('/missions/new');
  });

  it('seeds a 5k performance mission in development builds', async () => {
    await renderWithProviders(<MissionsScreen />);
    await fireEvent.press(await screen.findByText('Seed 5k'));
    expect(mockSeed).toHaveBeenCalledWith(expect.anything(), { count: 5000 });
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/missions/[missionId]', params: { missionId: 'seeded' } });
  });

  describe('deleting', () => {
    async function setup() {
      const ctx = makeTestContext();
      const iron = await createMission(ctx, { name: 'Op Iron' });
      const cobra = await createMission(ctx, { name: 'Op Cobra' });
      if (!iron.ok || !cobra.ok) throw new Error('setup');
      await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
      await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });
      await renderWithProviders(<MissionsScreen />, ctx);
      await screen.findByText('2 items · Never opened');
      return { ctx, ironId: iron.value.id };
    }

    it('confirms before deleting a mission from its swipe action', async () => {
      const { ctx, ironId } = await setup();
      await fireEvent.press(screen.getByLabelText('Delete Op Iron'));
      expect(screen.getByText("Delete Op Iron and its 2 items? This can't be undone.")).toBeTruthy();
      expect(await findMission(ctx.db, ironId)).not.toBeNull();

      await fireEvent.press(screen.getByLabelText('Delete'));
      await waitFor(() => expect(screen.queryByLabelText('Open Op Iron')).toBeNull());
      expect(await findMission(ctx.db, ironId)).toBeNull();
      expect(screen.getByLabelText('Open Op Cobra')).toBeTruthy();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
      expect(screen.queryByText(/This can't be undone/)).toBeNull();
    });

    it('keeps the mission when the confirmation is cancelled', async () => {
      const { ctx, ironId } = await setup();
      await fireEvent.press(screen.getByLabelText('Delete Op Iron'));
      await fireEvent.press(screen.getByText('Cancel'));
      expect(screen.queryByText(/This can't be undone/)).toBeNull();
      expect(await findMission(ctx.db, ironId)).not.toBeNull();
      expect(screen.getByLabelText('Open Op Iron')).toBeTruthy();
    });

    it('offers Delete as an accessibility action on the row', async () => {
      await setup();
      await fireEvent(screen.getByLabelText('Open Op Iron'), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
      expect(screen.getByText("Delete Op Iron and its 2 items? This can't be undone.")).toBeTruthy();
    });
  });
});
