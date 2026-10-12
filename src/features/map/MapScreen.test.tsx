import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createMission } from '@/features/missions/commands';
import { getMissionCamera } from '@/features/missions/repository';
import { usePresence } from '@/stores/presence';
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

  it('keeps the recenter zoom (follow effect does not override it)', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    await act(async () =>
      usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 }),
    );
    mapboxMock().__camera.setCamera.mockClear();
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    const calls = mapboxMock().__camera.setCamera.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1][0]).toHaveProperty('zoomLevel');
  });

  describe('camera persistence', () => {
    const state = (gesture: boolean) => ({
      properties: { center: [-77, 38.9], zoom: 11, heading: 10 },
      gestures: { isGestureActive: gesture },
    });

    it('does not save an untouched camera', async () => {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      const { unmount } = await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      const { onMapIdle } = mapboxMock().__props.MapView.main as { onMapIdle: (s: unknown) => void };
      await act(async () => onMapIdle(state(false)));
      await unmount();
      expect(await getMissionCamera(ctx.db, r.value.id)).toBeNull();
    });

    it('saves a camera the user moved', async () => {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      const { unmount } = await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      const props = mapboxMock().__props.MapView.main as {
        onCameraChanged: (s: unknown) => void;
        onMapIdle: (s: unknown) => void;
      };
      await act(async () => props.onCameraChanged(state(true)));
      await act(async () => props.onMapIdle(state(false)));
      await unmount();
      await waitFor(async () =>
        expect(await getMissionCamera(ctx.db, r.value.id)).toEqual({ center: { lat: 38.9, lon: -77 }, zoom: 11, bearing: 10 }),
      );
    });
  });
});
