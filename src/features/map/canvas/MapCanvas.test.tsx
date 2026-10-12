import { act, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Text } from 'react-native';

import { MAP_IMAGES } from '@/features/map/images/map-images';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { WORLD_CAMERA } from './camera';
import { MapCanvas } from './MapCanvas';

jest.mock('@rnmapbox/maps');

const rafQueue: (() => void)[] = [];
beforeEach(() => {
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
});
