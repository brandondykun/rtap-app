import { act, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Text } from 'react-native';

import { MAP_IMAGES } from '@/features/map/images/map-images';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { useToast } from '@/stores/toast';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { WORLD_CAMERA } from './camera';
import { BASEMAP_STYLE_URLS } from './mapbox';
import { MapCanvas } from './MapCanvas';

jest.mock('@rnmapbox/maps');

const rafQueue: (() => void)[] = [];
beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useInteraction.setState(INITIAL_INTERACTION);
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
    landscape: false,
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
    expect(camera.defaultSettings).toEqual({ centerCoordinate: [-77.0365, 38.8977], zoomLevel: 13, heading: 0 });
    expect(camera.centerCoordinate).toBeUndefined();
    expect(mapboxMock().__props.Images.main.images).toBe(MAP_IMAGES);
    expect(mapboxMock().__props.MapView.main.compassEnabled).toBe(false);
    expect(mapboxMock().__props.MapView.main.scaleBarEnabled).toBe(false);
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
