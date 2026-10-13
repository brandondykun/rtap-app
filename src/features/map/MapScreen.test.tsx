import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AppState, type AppStateStatus } from 'react-native';

import { placePoint } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { createMission } from '@/features/missions/commands';
import { getMissionCamera } from '@/features/missions/repository';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
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
  useMenu.setState(INITIAL_MENU);
  useDraft.setState(INITIAL_DRAFT);
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

  it('pops a stale mission link back to the existing list', async () => {
    await renderWithProviders(<MapScreen missionId="deleted-or-unknown" />);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId('map-view')).toBeNull();
  });

  it('replaces with the list when a stale link is the stack root', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await renderWithProviders(<MapScreen missionId="deleted-or-unknown" />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockRouter.back).not.toHaveBeenCalled();
    mockRouter.canGoBack.mockReturnValue(true);
  });

  it('shows a setup error without a Mapbox token and goes back from it', async () => {
    mockToken = null;
    await renderWithProviders(<MapScreen missionId="any" />);
    expect(screen.getByText('Mapbox token missing')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('opens the app menu from the toolbar and switches mission from it', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('Menu'));
    await fireEvent.press(await screen.findByText('Switch mission'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('pads the camera and hides the readout while a panel is open', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    mapboxMock().__camera.setCamera.mockClear();

    await fireEvent.press(screen.getByLabelText('Menu'));
    await waitFor(() =>
      expect(mapboxMock().__camera.setCamera).toHaveBeenCalledWith(
        expect.objectContaining({ padding: expect.objectContaining({ paddingBottom: expect.any(Number) }) }),
      ),
    );
    const padded = mapboxMock().__camera.setCamera.mock.calls.at(-1)?.[0] as { padding: { paddingBottom: number } };
    expect(padded.padding.paddingBottom).toBeGreaterThan(0);
    expect(screen.queryByTestId('readout-coordinate')).toBeNull();

    await act(async () => useMenu.getState().closeMenu());
    await waitFor(() =>
      expect(mapboxMock().__camera.setCamera).toHaveBeenLastCalledWith(
        expect.objectContaining({ padding: { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 } }),
      ),
    );
    expect(screen.getByTestId('readout-coordinate')).toBeTruthy();
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

    it('saves the live camera when backgrounded before the map goes idle', async () => {
      const listeners: ((s: AppStateStatus) => void)[] = [];
      const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
        listeners.push(cb as (s: AppStateStatus) => void);
        return { remove: jest.fn() };
      });
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      const { unmount } = await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      const props = mapboxMock().__props.MapView.main as { onCameraChanged: (s: unknown) => void };
      await act(async () => props.onCameraChanged(state(true)));
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      });
      expect(useInteraction.getState().cameraZoom).toBe(11);
      await act(async () => listeners.forEach((l) => l('background')));
      await waitFor(async () =>
        expect(await getMissionCamera(ctx.db, r.value.id)).toEqual({ center: { lat: 38.9, lon: -77 }, zoom: 11, bearing: 10 }),
      );
      spy.mockImplementation(() => ({ remove: jest.fn() }));
      await unmount();
    });
  });

  it('selects the new point in Edit Point after Add, without a second draft on top', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('POINT'));
    await screen.findByDisplayValue('HOS-1');
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(await screen.findByRole('header')).toHaveTextContent('Unit');
    const itemId = useDraft.getState().itemId;
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', locked: true });
    await waitFor(() => expect(mapboxMock().__props.SymbolLayer['points-symbols'].filter).toEqual(hiddenFilter([itemId!])));
  });

  it('Map button: the next map tap moves the draft there and the map follows', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('POINT'));
    await screen.findByDisplayValue('HOS-1');
    const tap = (lon: number, lat: number) =>
      act(async () => (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }));

    const before = useDraft.getState().coord;
    await tap(-77.2, 38.7);
    expect(useDraft.getState().coord).toEqual(before); // not picking: taps do nothing

    await fireEvent.press(screen.getByLabelText('Map'));
    mapboxMock().__camera.setCamera.mockClear();
    await tap(-77.1, 38.95);
    expect(useDraft.getState()).toMatchObject({ coord: { lat: 38.95, lon: -77.1 }, picking: false });
    expect(mapboxMock().__camera.setCamera).toHaveBeenCalledWith(expect.objectContaining({ centerCoordinate: [-77.1, 38.95] }));
  });

  it('Map button: tapping on an existing point places the draft there instead of opening it', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!p.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('POINT'));
    await screen.findByDisplayValue('HOS-2');
    await fireEvent.press(screen.getByLabelText('Map'));
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({
        features: [{ properties: { id: p.value.id } }],
        coordinates: { latitude: 38.9001, longitude: -77.0001 },
        point: {},
      }),
    );
    expect(screen.getByRole('header')).toHaveTextContent('Add unit');
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: { lat: 38.9001, lon: -77.0001 } });
  });

  it('toggles the Layers panel from the toolbar', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('LAYERS'));
    expect(await screen.findByRole('header')).toHaveTextContent('Layers');
    expect(screen.getByLabelText('LAYERS')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('LAYERS'));
    expect(screen.queryByTestId('menu-panel')).toBeNull();
  });

  it('the GPS button shows and hides the GPS readout, independent of the menus', async () => {
    useSettings.setState(DEFAULT_SETTINGS);
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    expect(screen.queryByTestId('gps-readout')).toBeNull();
    await fireEvent.press(await screen.findByLabelText('GPS'));
    expect(screen.getByTestId('gps-readout')).toBeTruthy();
    expect(screen.getByLabelText('GPS')).toBeSelected();
    // A panel hides the bottom-left readouts, GPS included, but never changes the toggle.
    await fireEvent.press(screen.getByLabelText('LAYERS'));
    expect(screen.getByLabelText('LAYERS')).toBeSelected();
    expect(screen.getByLabelText('GPS')).toBeSelected();
    expect(screen.queryByTestId('gps-readout')).toBeNull();
    await fireEvent.press(screen.getByLabelText('LAYERS'));
    expect(screen.getByTestId('gps-readout')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('GPS'));
    expect(screen.queryByTestId('gps-readout')).toBeNull();
    expect(screen.getByLabelText('GPS')).not.toBeSelected();
  });

  it('toggles Add Point from the toolbar', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('POINT'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    expect(screen.getByLabelText('POINT')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('POINT'));
    expect(screen.queryByTestId('menu-panel')).toBeNull();
  });

  it('long-press opens Add Point there, and a second long-press moves the draft and the map', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    const longPress = (lon: number, lat: number) =>
      act(async () =>
        (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {},
        }),
      );

    await longPress(-77.03, 38.9);
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(useDraft.getState().coord).toEqual({ lat: 38.9, lon: -77.03 });
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');

    mapboxMock().__camera.setCamera.mockClear();
    await longPress(-77.1, 38.95);
    expect(useDraft.getState()).toMatchObject({ coord: { lat: 38.95, lon: -77.1 }, name: 'OBJ IRON' });
    expect(mapboxMock().__camera.setCamera).toHaveBeenCalledWith(expect.objectContaining({ centerCoordinate: [-77.1, 38.95] }));
  });

  it('opens Edit Point when a point is tapped', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!p.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: p.value.id } }], coordinates: {}, point: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Unit');
    expect(await screen.findByDisplayValue('HOS-1')).toBeTruthy();
    expect(screen.getByLabelText('Name').props.editable).toBe(false);
  });

  it('long-press while viewing a point starts a new point there', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!p.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: p.value.id } }], coordinates: {}, point: {} }),
    );
    await screen.findByDisplayValue('HOS-1');
    await act(async () =>
      (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.1, 38.95] }, properties: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: { lat: 38.95, lon: -77.1 } });
  });

  describe('camera padding during panel moves', () => {
    type Stop = { centerCoordinate?: [number, number]; padding?: { paddingBottom: number; paddingLeft: number } };
    const calls = () => mapboxMock().__camera.setCamera.mock.calls.map((c) => c[0] as Stop);
    const fullyPadded = (stop: Stop) => (stop.padding?.paddingBottom ?? 0) + (stop.padding?.paddingLeft ?? 0) > 0;

    it('a light haptic confirms tapping a point', async () => {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
      if (!p.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      await act(async () =>
        (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: p.value.id } }], coordinates: {}, point: {} }),
      );
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('tapping a point keeps every camera move fully padded and ends on the item', async () => {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
      if (!p.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      mapboxMock().__camera.setCamera.mockClear();

      await act(async () =>
        (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: p.value.id } }], coordinates: {}, point: {} }),
      );
      expect(await screen.findByDisplayValue('HOS-1')).toBeTruthy();
      await waitFor(() => expect(calls().at(-1)?.centerCoordinate).toEqual([-77, 38.9]));

      const opened = calls().findIndex(fullyPadded);
      expect(opened).toBeGreaterThanOrEqual(0);
      const afterOpen = calls().slice(opened);
      expect(afterOpen.every(fullyPadded)).toBe(true);
      expect(afterOpen.at(-1)?.centerCoordinate).toEqual([-77, 38.9]);
    });

    it('a long-press with no panel open ends on the press point with the panel padding', async () => {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      mapboxMock().__camera.setCamera.mockClear();

      await act(async () =>
        (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-77.03, 38.9] },
          properties: {},
        }),
      );
      expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
      await waitFor(() => expect(calls().at(-1)?.centerCoordinate).toEqual([-77.03, 38.9]));
      expect(fullyPadded(calls().at(-1) as Stop)).toBe(true);
    });

    it('re-centers on the user when a panel opens while following', async () => {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 }));
      await fireEvent.press(screen.getByLabelText('Recenter on me'));
      mapboxMock().__camera.setCamera.mockClear();

      await fireEvent.press(screen.getByLabelText('Settings'));
      await waitFor(() => expect(calls().some(fullyPadded)).toBe(true));
      expect(calls().at(-1)?.centerCoordinate).toEqual([-77, 38.9]);
      expect(fullyPadded(calls().at(-1) as Stop)).toBe(true);
      await act(async () => usePresence.setState(INITIAL_PRESENCE));
    });

    it('a late idle from an earlier move does not cut a draft move short', async () => {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      const longPress = (coordinates: [number, number]) =>
        act(async () =>
          (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties: {} }),
        );
      const idleAt = (center: [number, number]) =>
        act(async () => (mapboxMock().__props.MapView.main.onMapIdle as (s: unknown) => void)({ properties: { center, zoom: 12, heading: 0 }, gestures: { isGestureActive: false } }));
      await longPress([-77.03, 38.9]);
      await screen.findByRole('header');
      await longPress([-77.1, 38.95]);
      await idleAt([-77.03, 38.9]);
      mapboxMock().__camera.setCamera.mockClear();

      await act(async () => useMenu.getState().setPanelFrame({ side: 'bottom', size: 500 }));
      expect(calls().at(-1)?.centerCoordinate).toEqual([-77.1, 38.95]);

      await idleAt([-77.1, 38.95]);
      mapboxMock().__camera.setCamera.mockClear();
      await act(async () => useMenu.getState().setPanelFrame({ side: 'bottom', size: 420 }));
      expect(calls().at(-1)?.centerCoordinate).toBeUndefined();
    });
  });
});
