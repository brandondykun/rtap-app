import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { placePoint } from '@/features/map-items/commands';
import { makeTestContext } from '@/lib/db/test-database';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
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

const mockDims = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims }));

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

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockDims, { width: 390, height: 844 });
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('MissionsScreen', () => {
  it('shows an empty state that opens the create sheet', async () => {
    await renderWithProviders(<MissionsScreen />);
    expect(await screen.findByText('No missions yet')).toBeTruthy();
    expect(screen.queryByText('Swipe a mission for edit & delete')).toBeNull();
    await fireEvent.press(screen.getByText('Create mission'));
    expect(mockRouter.push).toHaveBeenCalledWith('/missions/new');
  });

  it('pins the last-opened mission and lists the rest under EARLIER with counts', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!iron.ok || !cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });

    await renderWithProviders(<MissionsScreen />, ctx);

    expect(await screen.findByText('2 missions · 2 units plotted')).toBeTruthy();
    expect(screen.getByText('Last opened')).toBeTruthy();
    expect(screen.getByLabelText('Resume Op Cobra')).toBeTruthy();
    expect(screen.getByText('EARLIER')).toBeTruthy();
    expect(await screen.findByLabelText('2 units · 0 points · 0 lines · 0 polygons')).toBeTruthy();
    expect(screen.getByText('Never opened')).toBeTruthy();
    // The pinned mission is not listed again.
    expect(screen.getAllByLabelText('Open Op Cobra')).toHaveLength(1);
  });

  it('Resume opens the pinned mission', async () => {
    const ctx = makeTestContext();
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await renderWithProviders(<MissionsScreen />, ctx);
    await fireEvent.press(await screen.findByLabelText('Resume Op Cobra'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/missions/[missionId]', params: { missionId: cobra.value.id } });
  });

  it('sorts with the chips and remembers the choice', async () => {
    const ctx = makeTestContext();
    for (const name of ['bravo', 'Alpha', 'charlie']) await createMission(ctx, { name });
    const big = await createMission(ctx, { name: 'zulu' });
    if (!big.ok) throw new Error('setup');
    await placePoint(ctx, { missionId: big.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await renderWithProviders(<MissionsScreen />, ctx);
    const order = () => screen.getAllByLabelText(/^Open /).map((n) => n.props.accessibilityLabel);

    await screen.findByText('EARLIER');
    expect(order()).toEqual(['Open Alpha', 'Open bravo', 'Open charlie', 'Open zulu']);
    await fireEvent.press(screen.getByLabelText('Most items'));
    expect(screen.getByText('MOST ITEMS')).toBeTruthy();
    await waitFor(() => expect(order()[0]).toBe('Open zulu'));
    await fireEvent.press(screen.getByLabelText('Name'));
    expect(screen.getByText('BY NAME')).toBeTruthy();
    expect(useSettings.getState().missionSort).toBe('name');
  });

  it('searches by name: hides the pinned card, filters, and says when nothing matches', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!iron.ok || !cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await renderWithProviders(<MissionsScreen />, ctx);

    await fireEvent.press(await screen.findByLabelText('Search missions'));
    expect(screen.queryByText('Last opened')).toBeNull();
    expect(screen.queryByText('EARLIER')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('Search by name'), 'iron');
    expect(screen.getByLabelText('Open Op Iron')).toBeTruthy();
    expect(screen.queryByLabelText('Open Op Cobra')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('Search by name'), 'zzz');
    expect(screen.getByText('No missions match “zzz”')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByText('Last opened')).toBeTruthy();
  });

  it('puts the pinned card in its own column in landscape', async () => {
    Object.assign(mockDims, { width: 844, height: 390 });
    const ctx = makeTestContext();
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    await createMission(ctx, { name: 'Op Iron' });
    if (!cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await renderWithProviders(<MissionsScreen />, ctx);
    expect(await screen.findByTestId('pinned-column')).toBeTruthy();
    expect(screen.getByText('Last opened')).toBeTruthy();
    expect(screen.getByLabelText('Open Op Iron')).toBeTruthy();
  });

  it('lets the landscape list scroll to the bottom edge; only the pinned card keeps a bottom margin', async () => {
    Object.assign(mockDims, { width: 844, height: 390 });
    const ctx = makeTestContext();
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    await createMission(ctx, { name: 'Op Iron' });
    if (!cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await renderWithProviders(<MissionsScreen />, ctx);
    const pinnedColumn = await screen.findByTestId('pinned-column');
    // The row holding both columns reaches the bottom of the screen.
    expect(StyleSheet.flatten(screen.getByTestId('landscape-columns').props.style)?.paddingBottom ?? 0).toBe(0);
    expect(StyleSheet.flatten(pinnedColumn.props.style).paddingBottom).toBeGreaterThan(0);
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
    expect(screen.getByText('Swipe a mission for edit & delete')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('New mission'));
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
      await screen.findByLabelText('2 units · 0 points · 0 lines · 0 polygons');
      return { ctx, ironId: iron.value.id };
    }

    it('confirms before deleting a mission from its swipe action', async () => {
      const { ctx, ironId } = await setup();
      await fireEvent.press(screen.getByLabelText('Delete Op Iron'));
      expect(screen.getByText("Delete Op Iron and its 2 units, 0 points, 0 lines and 0 polygons? This can't be undone.")).toBeTruthy();
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
      expect(screen.getByText("Delete Op Iron and its 2 units, 0 points, 0 lines and 0 polygons? This can't be undone.")).toBeTruthy();
    });
  });

  describe('renaming', () => {
    async function setup() {
      const ctx = makeTestContext();
      const iron = await createMission(ctx, { name: 'Op Iron' });
      if (!iron.ok) throw new Error('setup');
      await renderWithProviders(<MissionsScreen />, ctx);
      await screen.findByLabelText('Open Op Iron');
      return iron.value.id;
    }
    const renameRoute = (missionId: string) => ({ pathname: '/missions/rename/[missionId]', params: { missionId } });

    it('opens the rename sheet from the swipe Edit button', async () => {
      const id = await setup();
      await fireEvent.press(screen.getByLabelText('Edit Op Iron'));
      expect(mockRouter.push).toHaveBeenCalledWith(renameRoute(id));
    });

    it('offers Rename as an accessibility action on the row', async () => {
      const id = await setup();
      await fireEvent(screen.getByLabelText('Open Op Iron'), 'accessibilityAction', { nativeEvent: { actionName: 'rename' } });
      expect(mockRouter.push).toHaveBeenCalledWith(renameRoute(id));
    });
  });
});
