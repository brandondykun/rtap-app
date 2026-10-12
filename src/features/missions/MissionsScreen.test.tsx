import { fireEvent, screen } from '@testing-library/react-native';

import { placePoint } from '@/features/map-items/commands';
import { makeTestContext } from '@/lib/db/test-database';
import { renderWithProviders } from '@/test-utils/render';

import { createMission, markMissionOpened } from './commands';
import { MissionsScreen } from './MissionsScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => (jest.requireActual('react') as typeof import('react')).useEffect(effect, [effect]),
}));

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => jest.clearAllMocks());

describe('MissionsScreen', () => {
  it('shows an empty state that opens the create sheet', async () => {
    await renderWithProviders(<MissionsScreen />);
    expect(await screen.findByText('No missions yet')).toBeTruthy();
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
    await fireEvent.press(screen.getByText('+ New'));
    expect(mockRouter.push).toHaveBeenCalledWith('/missions/new');
  });
});
