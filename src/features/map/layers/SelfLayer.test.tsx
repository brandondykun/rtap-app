import { act } from '@testing-library/react-native';

import { useInteraction } from '@/stores/interaction';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { SelfLayer } from './SelfLayer';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { icon: string; heading: number } }[] };

beforeEach(() => usePresence.setState(INITIAL_PRESENCE));

describe('SelfLayer', () => {
  it('follows the presence store', async () => {
    await renderWithProviders(<SelfLayer />);
    const props = mapboxMock().__props;
    expect((props.ShapeSource.self.shape as Shape).features).toEqual([]);

    await act(async () => {
      usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
      usePresence.getState().setSelfHeading(120);
    });
    expect((props.ShapeSource.self.shape as Shape).features[0].properties).toEqual({ icon: MAP_IMAGE_IDS.self, heading: 120 });
    expect(props.SymbolLayer['self-icon'].style).toMatchObject({ iconRotationAlignment: 'map' });
  });

  it('draws a manual position with the manual icon', async () => {
    await renderWithProviders(<SelfLayer />);
    await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: null, timestamp: 1, manual: true }));
    expect((mapboxMock().__props.ShapeSource.self.shape as Shape).features[0].properties).toEqual({ icon: 'self-manual', heading: 0 });
  });

  it('draws an averaged position with the orange icon', async () => {
    await renderWithProviders(<SelfLayer />);
    await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 3, timestamp: 1, averaged: true }));
    expect((mapboxMock().__props.ShapeSource.self.shape as Shape).features[0].properties).toEqual({ icon: MAP_IMAGE_IDS.selfAveragedNoHeading, heading: 0 });
  });

  it('moves the icon only when a fix would move it on screen', async () => {
    useInteraction.setState({ cameraZoom: 15 });
    const fix = (lat: number) => usePresence.getState().setSelfPosition({ position: { lat, lon: -77 }, accuracyM: 5, timestamp: 1 });
    const drawnLat = () =>
      (mapboxMock().__props.ShapeSource.self.shape as { features: { geometry: { coordinates: number[] } }[] }).features[0].geometry.coordinates[1];
    await renderWithProviders(<SelfLayer />);
    await act(async () => fix(38.9));
    // About 1.5 m: under a point at zoom 15.
    await act(async () => fix(38.9000135));
    expect(drawnLat()).toBe(38.9);
    // Zoomed in, the same shift shows.
    await act(async () => useInteraction.setState({ cameraZoom: 17 }));
    expect(drawnLat()).toBe(38.9000135);
    await act(async () => fix(38.9001));
    expect(drawnLat()).toBe(38.9001);
  });

  it('moves the icon at once to a manual position, however close', async () => {
    useInteraction.setState({ cameraZoom: 15 });
    await renderWithProviders(<SelfLayer />);
    await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 }));
    await act(async () =>
      usePresence.getState().setSelfPosition({ position: { lat: 38.9000135, lon: -77 }, accuracyM: null, timestamp: 2, manual: true }),
    );
    const [f] = (mapboxMock().__props.ShapeSource.self.shape as { features: { geometry: { coordinates: number[] }; properties: { icon: string } }[] })
      .features;
    expect(f.geometry.coordinates[1]).toBe(38.9000135);
    expect(f.properties.icon).toBe('self-manual');
  });

  it('is not tappable unless a press handler is given (it would swallow taps on nearby symbols)', async () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    await renderWithProviders(<SelfLayer />);
    expect(mapboxMock().__props.ShapeSource.self.onPress).toBeUndefined();
  });

  it('reports my position when tapped', async () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    const onPress = jest.fn();
    await renderWithProviders(<SelfLayer onPress={onPress} />);
    await act(async () => (mapboxMock().__props.ShapeSource.self.onPress as () => void)());
    expect(onPress).toHaveBeenCalledWith({ lat: 38.9, lon: -77 });
  });
});
