import { act, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Text } from 'react-native';

import { MAP_IMAGES } from '@/features/map/images/map-images';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_OP, useOp } from '@/stores/op';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { useToast } from '@/stores/toast';
import { FLAT_2D_EXAGGERATION } from '@/features/map/terrain/three-d';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MIN_ZOOM, WORLD_CAMERA } from './camera';
import { BASEMAP_STYLE_URLS } from './mapbox';
import { MapCanvas } from './MapCanvas';

jest.mock('@rnmapbox/maps');

const rafQueue: (() => void)[] = [];
beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useInteraction.setState(INITIAL_INTERACTION);
  useOp.setState(INITIAL_OP);
  rafQueue.length = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
    rafQueue.push(() => cb(0));
    return rafQueue.length;
  });
});

async function renderCanvas(overrides: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
  const props = {
    cameraRef: createRef<never>(),
    initialCamera: { center: { lat: 38.8977, lon: -77.0365 }, zoom: 13, bearing: 0 },
    onCameraIdle: jest.fn(),
    onUserGesture: jest.fn(),
    panel: null,
    symbolImages: {},
    onSymbolMissing: jest.fn(),
    ...overrides,
  };
  await renderWithProviders(
    <MapCanvas {...props}>
      <Text>layer</Text>
    </MapCanvas>,
  );
  return props;
}

describe('MapCanvas', () => {
  it('renders children with an uncontrolled camera and the image registry', async () => {
    await renderCanvas();
    expect(screen.getByText('layer')).toBeTruthy();
    const camera = mapboxMock().__props.Camera.main;
    expect(camera.defaultSettings).toEqual({ centerCoordinate: [-77.0365, 38.8977], zoomLevel: 13, heading: 0, pitch: 0 });
    expect(camera.centerCoordinate).toBeUndefined();
    expect(mapboxMock().__props.Images.main.images).toBe(MAP_IMAGES);
    expect(mapboxMock().__props.MapView.main.compassEnabled).toBe(false);
    expect(mapboxMock().__props.MapView.main.scaleBarEnabled).toBe(false);
  });

  it('loads Mapbox terrain at true scale for ground elevation, with the map kept flat', async () => {
    await renderCanvas();
    const dem = mapboxMock().__props.RasterDemSource['terrain-dem'];
    expect(dem).toMatchObject({ id: 'terrain-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1' });
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ sourceID: 'terrain-dem', style: { exaggeration: 1 } });
    expect(mapboxMock().__props.MapView.main.pitchEnabled).toBe(false);
    expect(mapboxMock().__props.Atmosphere.main).toBeUndefined();
  });

  it('in 3D, raises the terrain 1.5x, allows tilting, adds a sky and opens tilted', async () => {
    useSettings.setState({ terrain3d: true });
    await renderCanvas();
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: 1.5 } });
    expect(mapboxMock().__props.MapView.main.pitchEnabled).toBe(true);
    expect(mapboxMock().__props.Atmosphere.main).toBeDefined();
    expect(mapboxMock().__props.Camera.main.defaultSettings).toMatchObject({ pitch: 60 });
    await act(() => useSettings.setState({ terrain3d: false }));
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: 1 } });
    expect(mapboxMock().__props.MapView.main.pitchEnabled).toBe(false);
    expect(mapboxMock().__props.Atmosphere.main).toBeUndefined();
  });

  it('in OP mode turns off map pan, zoom, rotate and tilt, and pushes the haze out', async () => {
    useSettings.setState({ terrain3d: true });
    await renderCanvas();
    expect(mapboxMock().__props.MapView.main).toMatchObject({ scrollEnabled: true, zoomEnabled: true, rotateEnabled: true });
    expect(mapboxMock().__props.Atmosphere.main).toMatchObject({ style: { range: [0.8, 8] } });
    await act(() => useOp.setState({ phase: 'on' }));
    expect(mapboxMock().__props.MapView.main).toMatchObject({
      scrollEnabled: false,
      zoomEnabled: false,
      rotateEnabled: false,
      pitchEnabled: false,
    });
    expect(mapboxMock().__props.Atmosphere.main).toMatchObject({ style: { range: [2, 20] } });
  });

  it('with terrain in 2D off, lays the terrain flat in 2D and raises it to the setting in 3D', async () => {
    useSettings.setState({ terrainIn2d: false, terrainExaggeration: 2 });
    await renderCanvas();
    // Not quite 0, so elevation lookups still have ground to read (and divide back out).
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: FLAT_2D_EXAGGERATION } });
    expect(FLAT_2D_EXAGGERATION).toBeGreaterThan(0);
    expect(FLAT_2D_EXAGGERATION).toBeLessThanOrEqual(0.001);
    await act(async () => useSettings.getState().toggleTerrain3d());
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: 2 } });
    await act(async () => useSettings.getState().toggleTerrain3d());
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: FLAT_2D_EXAGGERATION } });
    await act(async () => useSettings.getState().setTerrainIn2d(true));
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: 1 } });
  });

  it('uses the terrain height setting in 3D', async () => {
    useSettings.setState({ terrain3d: true, terrainExaggeration: 2 });
    await renderCanvas();
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: 2 } });
  });

  it('applies a new terrain height at once in 3D, and stays at true scale when flat', async () => {
    useSettings.setState({ terrain3d: true });
    await renderCanvas();
    await act(async () => useSettings.getState().setTerrainExaggeration(3));
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: 3 } });
    await act(async () => useSettings.getState().toggleTerrain3d());
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: 1 } });
    await act(async () => useSettings.getState().setTerrainExaggeration(2));
    expect(mapboxMock().__props.Terrain.main).toMatchObject({ style: { exaggeration: 1 } });
  });

  it('registers symbol images and asks for missing ones', async () => {
    const onSymbolMissing = jest.fn();
    await renderCanvas({ symbolImages: { SFGPU: { url: 'file:///s/SFGPU.png', scale: 3 } }, onSymbolMissing });
    const images = mapboxMock().__props.Images.symbols;
    expect(images.images).toEqual({ SFGPU: { url: 'file:///s/SFGPU.png', scale: 3 } });
    (images.onImageMissing as (k: string) => void)('SHGPU');
    expect(onSymbolMissing).toHaveBeenCalledWith('SHGPU');
  });

  it('keeps the Mapbox logo row right of a left drawer', async () => {
    await renderCanvas({ panel: { side: 'left', size: 400 } });
    const logo = mapboxMock().__props.MapView.main.logoPosition as { left: number };
    expect(logo.left).toBeGreaterThan(400);
  });

  it('stops pinches from zooming out past the furthest zoom out', async () => {
    await renderCanvas();
    expect(mapboxMock().__props.Camera.main.minZoomLevel).toBe(MIN_ZOOM);
  });

  it('seeds the interaction store with the initial camera', async () => {
    await renderCanvas({ initialCamera: WORLD_CAMERA });
    expect(useInteraction.getState().cameraCenter).toEqual(WORLD_CAMERA.center);
  });

  it('feeds camera changes through one store update per frame', async () => {
    const props = await renderCanvas();
    const onCameraChanged = mapboxMock().__props.MapView.main.onCameraChanged as (s: unknown) => void;
    const move = (lon: number, gesture: boolean) => ({
      properties: { center: [lon, 38.9], zoom: 13, heading: 0 },
      gestures: { isGestureActive: gesture },
    });
    await act(async () => {
      onCameraChanged(move(-77.1, true));
      onCameraChanged(move(-77.2, true));
    });
    expect(rafQueue).toHaveLength(1);
    await act(async () => rafQueue.shift()!());
    expect(useInteraction.getState().cameraCenter).toEqual({ lat: 38.9, lon: -77.2 });
    expect(props.onUserGesture).toHaveBeenCalled();
  });

  describe('MGRS grid view', () => {
    const at = (lon: number, zoom = 11) => ({
      properties: { center: [lon, 38.9], zoom, heading: 0, bounds: { ne: [lon + 0.1, 39], sw: [lon - 0.1, 38.8] } },
      gestures: { isGestureActive: true },
    });
    const view = (lon: number, zoom = 11) => ({ sw: { lat: 38.8, lon: lon - 0.1 }, ne: { lat: 39, lon: lon + 0.1 }, zoom });
    const handlers = () => mapboxMock().__props.MapView.main as Record<string, (s: unknown) => void>;
    const frame = () => act(async () => rafQueue.splice(0).forEach((run) => run()));

    beforeEach(() => useSettings.setState({ showMgrsGrid: true }));

    it('moves the grid on mid-gesture, once per frame, only when the drawn lines are about to run out', async () => {
      await renderCanvas();
      await act(async () => handlers().onCameraChanged(at(-77)));
      await frame();
      expect(useInteraction.getState().gridView).toEqual(view(-77));
      // A tenth of a screen: the lines drawn half a screen out still serve.
      await act(async () => handlers().onCameraChanged(at(-76.98)));
      await frame();
      expect(useInteraction.getState().gridView).toEqual(view(-77));
      // A third of a screen: less than a quarter screen of lines is left past the edge.
      await act(async () => handlers().onCameraChanged(at(-76.93)));
      await frame();
      expect(useInteraction.getState().gridView).toEqual(view(-76.93));
    });

    it('moves it on when the map goes idle, if it needs to', async () => {
      await renderCanvas();
      await act(async () => handlers().onMapIdle(at(-77)));
      expect(useInteraction.getState().gridView).toEqual(view(-77));
      const drawn = useInteraction.getState().gridView;
      await act(async () => handlers().onMapIdle(at(-76.98)));
      expect(useInteraction.getState().gridView).toBe(drawn);
    });

    it('does nothing while the grid is off, and draws for the current view when it is switched on', async () => {
      useSettings.setState({ showMgrsGrid: false });
      await renderCanvas();
      await act(async () => handlers().onCameraChanged(at(-77)));
      await frame();
      await act(async () => handlers().onMapIdle(at(-77)));
      expect(useInteraction.getState().gridView).toBeNull();
      await act(async () => useSettings.getState().setShowMgrsGrid(true));
      expect(useInteraction.getState().gridView).toEqual(view(-77));
    });
  });

  it('reports the camera when the map goes idle', async () => {
    const props = await renderCanvas();
    const onMapIdle = mapboxMock().__props.MapView.main.onMapIdle as (s: unknown) => void;
    await act(async () =>
      onMapIdle({ properties: { center: [-77, 38.9], zoom: 11, heading: 10 }, gestures: { isGestureActive: false } }),
    );
    expect(props.onCameraIdle).toHaveBeenCalledWith({ center: { lat: 38.9, lon: -77 }, zoom: 11, bearing: 10 });
  });

  it('uses the basemap from settings and follows changes', async () => {
    await renderCanvas();
    expect(mapboxMock().__props.MapView.main.styleURL).toBe(BASEMAP_STYLE_URLS.satellite);
    await act(async () => useSettings.getState().setBasemap('topo'));
    expect(mapboxMock().__props.MapView.main.styleURL).toBe(BASEMAP_STYLE_URLS.topo);
    expect(new Set(Object.values(BASEMAP_STYLE_URLS)).size).toBe(4);
  });

  it('falls back to Satellite for the session when a basemap style fails to load, and retries when chosen again', async () => {
    useSettings.getState().setBasemap('topo');
    await renderCanvas();
    const fail = (type: string) => act(async () => (mapboxMock().__props.MapView.main.onMapLoadingError as (p: unknown) => void)({ error: 'offline', type }));
    await fail('tile');
    expect(mapboxMock().__props.MapView.main.styleURL).toBe(BASEMAP_STYLE_URLS.topo);
    await fail('style');
    expect(mapboxMock().__props.MapView.main.styleURL).toBe(BASEMAP_STYLE_URLS.satellite);
    expect(useToast.getState().toast?.message).toBe('Topo map is unavailable — showing Satellite.');
    expect(useSettings.getState().basemap).toBe('topo');
    await act(async () => useSettings.getState().setBasemap('dark'));
    await act(async () => useSettings.getState().setBasemap('topo'));
    expect(mapboxMock().__props.MapView.main.styleURL).toBe(BASEMAP_STYLE_URLS.topo);
  });
});
