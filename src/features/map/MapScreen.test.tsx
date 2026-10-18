import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AppState, type AppStateStatus } from 'react-native';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { placeLine, placePoint, placePolygon } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { createMission } from '@/features/missions/commands';
import { getMissionCamera } from '@/features/missions/repository';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { INITIAL_MENU, topMenu, useMenu } from '@/stores/menu';
import { INITIAL_PLACING, usePlacing } from '@/stores/placing';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
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
  useMeasure.setState(INITIAL_MEASURE);
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  usePlacing.setState(INITIAL_PLACING);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
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

  it('pads the camera and keeps the readout, without your grid card, while a panel is open', async () => {
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
    // Both cards stay while a panel is open.
    expect(screen.getByTestId('readout-coordinate')).toBeTruthy();
    expect(screen.getByTestId('dock-self')).toBeTruthy();

    await act(async () => useMenu.getState().closeMenu());
    await waitFor(() =>
      expect(mapboxMock().__camera.setCamera).toHaveBeenLastCalledWith(
        expect.objectContaining({ padding: { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 } }),
      ),
    );
    expect(screen.getByTestId('readout-coordinate')).toBeTruthy();
    expect(screen.getByTestId('dock-self')).toBeTruthy();
  });

  it('drops the CTR row when Show center grid is off', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    expect(await screen.findByTestId('dock-center')).toBeTruthy();
    await act(async () => useSettings.getState().setShowCenterGrid(false));
    expect(screen.queryByTestId('dock-center')).toBeNull();
    expect(screen.getByTestId('dock-self')).toBeTruthy();
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
    await fireEvent.press(await screen.findByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('Add at center'));
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
    await fireEvent.press(await screen.findByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('Add at center'));
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
    await fireEvent.press(await screen.findByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('Add at center'));
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

  it('LABELS turns the map labels off and on, independent of the menus', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    expect(await screen.findByLabelText('LABELS')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('LABELS'));
    expect(useSettings.getState().showMapLabels).toBe(false);
    expect(screen.getByLabelText('LABELS')).not.toBeSelected();
    expect(mapboxMock().__props.SymbolLayer['points-labels'].style).toMatchObject({ visibility: 'none' });
    await fireEvent.press(screen.getByLabelText('LABELS'));
    expect(useSettings.getState().showMapLabels).toBe(true);
  });

  it('keeps both cards while a panel is open, and has no GPS toggle', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    expect(await screen.findByTestId('dock-self')).toBeTruthy();
    expect(screen.getByTestId('dock-center')).toBeTruthy();
    expect(screen.queryByLabelText('GPS')).toBeNull();
    await fireEvent.press(screen.getByLabelText('LAYERS'));
    expect(screen.getByLabelText('LAYERS')).toBeSelected();
    expect(screen.getByTestId('dock-self')).toBeTruthy();
    expect(screen.getByTestId('dock-center')).toBeTruthy();
  });

  it('UNIT shows the tap bar and no menu; a map tap opens Add unit at the tap', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('UNIT'));
    expect(screen.getByLabelText('UNIT')).toBeSelected();
    expect(screen.getByText('Tap map')).toBeTruthy();
    // The bar takes the dock's place.
    expect(screen.queryByTestId('readout-dock')).toBeNull();
    expect(screen.queryByTestId('menu-panel')).toBeNull();
    expect(useDraft.getState().mode).toBeNull();
    await act(async () =>
      (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.1, 38.95] }, properties: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    expect(useDraft.getState()).toMatchObject({ mode: 'add', category: 'unit', coord: { lat: 38.95, lon: -77.1 } });
    expect(screen.queryByTestId('place-bar')).toBeNull();
    // The Add unit menu is open: the dock is back.
    expect(screen.getByTestId('dock-self')).toBeTruthy();
    expect(screen.getByTestId('dock-center')).toBeTruthy();
  });

  it('POINT: Add at center opens Add point at the crosshair; switching from UNIT changes the bar', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('POINT'));
    expect(screen.getByLabelText('POINT')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Add at center'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add point');
    expect(useDraft.getState()).toMatchObject({ mode: 'add', category: 'point', coord: useInteraction.getState().cameraCenter, coordSource: 'crosshair' });
  });

  it('a tap on an existing symbol while placing adds there instead of opening the item', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!p.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('POINT'));
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({
        features: [{ properties: { id: p.value.id } }],
        coordinates: { latitude: 38.9001, longitude: -77.0001 },
        point: {},
      }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Add point');
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: { lat: 38.9001, lon: -77.0001 } });
  });

  it('tapping a point opens Point; long-press while viewing it starts a hostile Add unit, not a point', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'GFGPGPPK------X', name: 'CP-1' });
    if (!p.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({
        features: [{ properties: { id: p.value.id, sidc: 'GFGPGPPK------X' } }],
        coordinates: { latitude: 38.9, longitude: -77 },
        point: {},
      }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Point');
    expect(useMenu.getState().stack).toEqual([{ id: 'point.edit', params: { itemId: p.value.id } }]);
    await act(async () =>
      (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.1, 38.95] }, properties: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    expect(useDraft.getState()).toMatchObject({ category: 'unit', affiliation: 'hostile', coord: { lat: 38.95, lon: -77.1 } });
  });

  it('long-press during Add point starts a hostile Add unit instead of moving the point', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('POINT'));
    await fireEvent.press(screen.getByLabelText('Add at center'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add point');
    await act(async () =>
      (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.1, 38.95] }, properties: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    expect(useDraft.getState()).toMatchObject({ category: 'unit', affiliation: 'hostile', coord: { lat: 38.95, lon: -77.1 } });
  });

  it('long-press adds a hostile, unspecified unit even after a friendly armor unit was started from the toolbar', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('Add at center'));
    await fireEvent.press(await screen.findByLabelText('Friendly'));
    await fireEvent.press(screen.getByLabelText('Unit type: Unspecified'));
    await fireEvent.press(screen.getByText('Armor'));
    await fireEvent.press(screen.getByText('Cancel'));
    await act(async () =>
      (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.1, 38.95] }, properties: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    expect(screen.getByLabelText('Hostile')).toBeSelected();
    expect(screen.getByLabelText('Unit type: Unspecified')).toBeTruthy();
    expect(useDraft.getState()).toMatchObject({ affiliation: 'hostile', unitType: 'unspecified' });
  });

  it('ends placing with Cancel, a second UNIT tap, or another tool, and UNIT closes an open Add unit', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(screen.queryByTestId('place-bar')).toBeNull();
    expect(screen.getByLabelText('UNIT')).not.toBeSelected();

    await fireEvent.press(screen.getByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('UNIT'));
    expect(screen.queryByTestId('place-bar')).toBeNull();

    await fireEvent.press(screen.getByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('MEASURE'));
    expect(screen.queryByTestId('place-bar')).toBeNull();
    await fireEvent.press(screen.getByLabelText('UNIT'));
    expect(useMeasure.getState().active).toBe(false);
    await fireEvent.press(screen.getByLabelText('LAYERS'));
    expect(screen.queryByTestId('place-bar')).toBeNull();

    await fireEvent.press(screen.getByLabelText('UNIT'));
    await fireEvent.press(screen.getByLabelText('Add at center'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    expect(screen.getByLabelText('UNIT')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('UNIT'));
    expect(screen.queryByTestId('menu-panel')).toBeNull();
    expect(screen.queryByTestId('place-bar')).toBeNull();
  });

  it('long-press opens Add unit there, and a second long-press moves the draft and the map', async () => {
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

  it('a tap on a blank spot clears the selection, but never while editing or with another menu open', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!p.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    const tapItem = () =>
      act(async () =>
        (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: p.value.id } }], coordinates: {}, point: {} }),
      );
    const tapBlank = () =>
      act(async () =>
        (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.2, 38.7] }, properties: {} }),
      );

    await tapItem();
    await screen.findByDisplayValue('HOS-1');
    // Mapbox delivers a symbol tap only to its source; a blank tap right after it is the same touch on some builds.
    await tapBlank();
    expect(screen.getByDisplayValue('HOS-1')).toBeTruthy();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
    await tapBlank();
    expect(useMenu.getState().stack).toEqual([]);
    expect(useDraft.getState().mode).toBeNull();
    jest.restoreAllMocks();

    // Editing: a blank tap must not throw away the changes.
    await tapItem();
    await fireEvent.press(await screen.findByLabelText('Edit'));
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
    await tapBlank();
    expect(topMenu(useMenu.getState())?.id).toBe('unit.edit');
    jest.restoreAllMocks();

    // Another menu (Layers) is not a selection.
    await act(async () => useMenu.getState().openMenu('layers', {}));
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
    await tapBlank();
    expect(topMenu(useMenu.getState())?.id).toBe('layers');
    jest.restoreAllMocks();
  });

  it('long-press while viewing a unit starts a new unit there', async () => {
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

  it('LINE: map taps add points, a marker tap selects, long-press adds, and a unit tap adds a point there', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const u = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!u.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('LINE'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add line');
    expect(screen.getByLabelText('LINE')).toBeSelected();
    const tap = (lon: number, lat: number) =>
      act(async () => (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }));
    await tap(-77.01, 38.91);
    await tap(-77.02, 38.92);
    expect(useDraft.getState().vertices).toEqual([{ lat: 38.91, lon: -77.01 }, { lat: 38.92, lon: -77.02 }]);
    await act(async () =>
      (mapboxMock().__props.ShapeSource['draft-line'].onPress as (e: unknown) => void)({ features: [{ properties: { role: 'vertex', index: 0 } }], coordinates: {}, point: {} }),
    );
    expect(useDraft.getState().selectedVertex).toBe(0);
    await act(async () => useDraft.getState().selectVertex(0));
    await act(async () =>
      (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.03, 38.93] }, properties: {} }),
    );
    expect(useDraft.getState().vertices).toHaveLength(3);
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: u.value.id, sidc: 'SHGPUCI--------' } }], coordinates: { latitude: 38.9, longitude: -77 }, point: {} }),
    );
    expect(useDraft.getState().vertices).toHaveLength(4);
    expect(screen.getByRole('header')).toHaveTextContent('Add line');
  });

  it('POLYGON: taps add points, a unit tap adds a point, Circle takes center then edge, and a saved fill is not tappable', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const u = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.95, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    const saved = await placePolygon(ctx, { missionId: r.value.id, polygonType: 'objective', name: 'IRON', shape: { kind: 'points', points: [{ lat: 39, lon: -77 }, { lat: 39.01, lon: -77 }, { lat: 39, lon: -76.99 }] } });
    if (!u.ok || !saved.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await waitFor(() => expect(mapboxMock().__props.ShapeSource['polygon-fills']).toBeDefined());
    expect(mapboxMock().__props.ShapeSource['polygon-fills'].onPress).toBeUndefined();
    await fireEvent.press(await screen.findByLabelText('POLYGON'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add polygon');
    expect(screen.getByLabelText('POLYGON')).toBeSelected();
    const tap = (lon: number, lat: number) =>
      act(async () => (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }));
    await tap(-77.01, 38.91);
    await tap(-77.02, 38.92);
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({
        features: [{ properties: { id: u.value.id, sidc: 'SHGPUCI--------' } }],
        coordinates: { latitude: 38.95, longitude: -77 },
        point: {},
      }),
    );
    expect(useDraft.getState().vertices).toHaveLength(3);
    expect(screen.getByRole('header')).toHaveTextContent('Add polygon');
    await fireEvent.press(screen.getByLabelText('Circle'));
    await tap(-77, 38.9);
    expect(useDraft.getState().coord).toEqual({ lat: 38.9, lon: -77 });
    await tap(-77, 38.9045);
    expect(useDraft.getState().circleRadiusM).toBeCloseTo(500, -1);
  });

  it('POLYGON circle: the Map button moves the center instead of setting the edge', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('POLYGON'));
    await fireEvent.press(await screen.findByLabelText('Circle'));
    const tap = (lon: number, lat: number) =>
      act(async () => (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }));
    mapboxMock().__camera.setCamera.mockClear();
    await tap(-77, 38.9);
    // Drawing taps never move the map (the edge the user aims at must stay put).
    expect(mapboxMock().__camera.setCamera.mock.calls.some((c) => (c[0] as { centerCoordinate?: number[] }).centerCoordinate)).toBe(false);
    await tap(-77, 38.9045);
    await fireEvent.press(screen.getByLabelText('Map'));
    await tap(-77.01, 38.95);
    expect(useDraft.getState().coord).toEqual({ lat: 38.95, lon: -77.01 });
    expect(useDraft.getState().circleRadiusM).toBeCloseTo(500, -1);
  });

  describe('quick plot', () => {
    async function openMap() {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.9, lon: -77 }, zoom: 14, bearing: 0 }));
    }
    const plotGrid = async (p: { lat: number; lon: number }) => {
      const g = mgrsFieldsFor(p);
      await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
      await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
      await fireEvent.press(screen.getByLabelText('Plot'));
    };

    it('PLOT closes a menu, plots a temporary point, moves the map, and Save point opens Add point there', async () => {
      await openMap();
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      await fireEvent.press(screen.getByLabelText('PLOT'));
      expect(useMenu.getState().stack).toEqual([]);
      expect(screen.getByTestId('quick-plot-entry')).toBeTruthy();
      expect(screen.getByLabelText('PLOT')).toBeSelected();
      mapboxMock().__camera.setCamera.mockClear();
      await plotGrid({ lat: 38.91, lon: -77 });
      expect(screen.queryByTestId('quick-plot-entry')).toBeNull();
      expect(screen.getByTestId('quick-plot-card')).toBeTruthy();
      const temp = useQuickPlot.getState().temp!;
      const moved = mapboxMock().__camera.setCamera.mock.calls.map((c) => (c[0] as { centerCoordinate?: number[] }).centerCoordinate);
      expect(moved).toContainEqual([temp.lon, temp.lat]);
      await fireEvent.press(screen.getByLabelText('Save point'));
      await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'point.add', params: { at: temp } }]));
      expect(useDraft.getState().coord).toEqual(temp);
      expect(screen.queryByTestId('quick-plot-card')).toBeNull();
    });

    it('ends on a map tap while entering, and when Layers opens or MEASURE starts', async () => {
      await openMap();
      await fireEvent.press(screen.getByLabelText('PLOT'));
      await act(async () =>
        (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77, 38.9] }, properties: {} }),
      );
      expect(screen.queryByTestId('quick-plot-entry')).toBeNull();
      await fireEvent.press(screen.getByLabelText('PLOT'));
      await plotGrid({ lat: 38.91, lon: -77 });
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      expect(useQuickPlot.getState().temp).toBeNull();
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      await fireEvent.press(screen.getByLabelText('PLOT'));
      await plotGrid({ lat: 38.91, lon: -77 });
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      expect(useQuickPlot.getState().temp).toBeNull();
      expect(screen.queryByTestId('quick-plot-card')).toBeNull();
    });
  });

  describe('measure', () => {
    const mapTap = (lon: number, lat: number) =>
      act(async () => (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }));

    async function openMap() {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      const u = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.95, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
      if (!u.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      return { unitId: u.value.id };
    }

    it('MEASURE closes an open menu and toggles the card', async () => {
      await openMap();
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      expect(await screen.findByText('Layers')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      expect(useMenu.getState().stack).toEqual([]);
      expect(screen.getByTestId('measure-bar')).toBeTruthy();
      // The bar takes the dock's place.
      expect(screen.queryByTestId('dock-self')).toBeNull();
      expect(screen.getByLabelText('MEASURE')).toBeSelected();
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      expect(screen.queryByTestId('measure-bar')).toBeNull();
      expect(screen.getByTestId('dock-self')).toBeTruthy();
    });

    it('a map tap sets the start; a unit tap snaps the end without opening the unit; long-press does nothing', async () => {
      const { unitId } = await openMap();
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      await mapTap(-77, 38.9);
      expect(useMeasure.getState().start).toEqual({ lat: 38.9, lon: -77 });
      await act(async () =>
        (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({
          features: [{ properties: { id: unitId, sidc: 'SHGPUCI--------' }, geometry: { type: 'Point', coordinates: [-77, 38.95] } }],
          coordinates: { latitude: 38.9502, longitude: -77.0003 },
          point: {},
        }),
      );
      expect(useMeasure.getState().end).toEqual({ lat: 38.95, lon: -77 });
      expect(useMenu.getState().stack).toEqual([]);
      await act(async () =>
        (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.1, 38.8] }, properties: {} }),
      );
      expect(useMenu.getState().stack).toEqual([]);
      expect(useMeasure.getState().end).toEqual({ lat: 38.95, lon: -77 });
    });

    it('a tap on my marker snaps to my position, and opening a menu stops measuring', async () => {
      await openMap();
      await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 }));
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      await act(async () => (mapboxMock().__props.ShapeSource.self.onPress as (e: unknown) => void)({ features: [{ properties: {} }], coordinates: { latitude: 38.9003, longitude: -77.0002 }, point: {} }));
      expect(useMeasure.getState().start).toEqual({ lat: 38.9, lon: -77 });
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      expect(useMeasure.getState().active).toBe(false);
      expect(screen.queryByTestId('measure-bar')).toBeNull();
    });
  });

  describe('camera padding during panel moves', () => {
    type Stop = { centerCoordinate?: [number, number]; padding?: { paddingBottom: number; paddingLeft: number } };
    const calls = () => mapboxMock().__camera.setCamera.mock.calls.map((c) => c[0] as Stop);
    const fullyPadded = (stop: Stop) => (stop.padding?.paddingBottom ?? 0) + (stop.padding?.paddingLeft ?? 0) > 0;

    it('opening a line fits the camera to it, and a later panel move keeps that fit', async () => {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      const l = await placeLine(ctx, { missionId: r.value.id, points: [{ lat: 38.9, lon: -77 }, { lat: 38.95, lon: -76.95 }], lineType: 'phase-line', name: 'RED' });
      if (!l.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      await act(async () =>
        (mapboxMock().__props.ShapeSource.lines.onPress as (e: unknown) => void)({ features: [{ properties: { id: l.value.id } }], coordinates: { latitude: 38.92, longitude: -76.98 }, point: {} }),
      );
      expect(await screen.findByDisplayValue('RED')).toBeTruthy();
      type FitStop = { bounds?: unknown; centerCoordinate?: [number, number]; zoomLevel?: number; padding?: { paddingBottom: number } };
      const all = () => mapboxMock().__camera.setCamera.mock.calls.map((c) => c[0] as FitStop);
      const isFit = (s: FitStop | undefined) => !!s?.zoomLevel && !!s.centerCoordinate && Math.abs(s.centerCoordinate[0] + 76.975) < 1e-6;
      await waitFor(() => expect(all().some(isFit)).toBe(true));
      mapboxMock().__camera.setCamera.mockClear();
      await act(async () => useMenu.getState().setPanelFrame({ side: 'bottom', size: 380 }));
      // Re-issued with the new panel padding, as a padded center + zoom (never Mapbox \`bounds\`, which drops
      // the padding and puts the camera center — and Move to center — behind the panel).
      const last = all().at(-1);
      expect(isFit(last)).toBe(true);
      expect(last?.padding?.paddingBottom).toBe(useMenu.getState().panelFrame?.size);
      expect(last?.padding?.paddingBottom).toBeGreaterThan(0);
      expect(all().some((s) => s.bounds)).toBe(false);
    });

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
