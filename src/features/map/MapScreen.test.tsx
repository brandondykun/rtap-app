import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createMission } from '@/features/missions/commands';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MapScreen } from './MapScreen';

jest.mock('@rnmapbox/maps');

let mockToken: string | null = 'pk.test';
jest.mock('@/config/env', () => ({ getMapboxToken: () => mockToken }));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'pk.test';
});

describe('MapScreen', () => {
  it('opens a mission on its map with the shell around it', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);

    expect(await screen.findByTestId('map-view')).toBeTruthy();
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByTestId('readout-coordinate')).toBeTruthy();
    expect(screen.getByLabelText('Recenter on me')).toBeTruthy();
    expect(mapboxMock().__props.ShapeSource.points).toBeDefined();
    expect(mapboxMock().__props.ShapeSource.self).toBeDefined();
  });

  it('sends a stale mission link back to the list', async () => {
    await renderWithProviders(<MapScreen missionId="deleted-or-unknown" />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByTestId('map-view')).toBeNull();
  });

  it('shows a setup error without a Mapbox token', async () => {
    mockToken = null;
    await renderWithProviders(<MapScreen missionId="any" />);
    expect(screen.getByText('Mapbox token missing')).toBeTruthy();
  });

  it('switches mission from the toolbar menu button', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('Menu'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
