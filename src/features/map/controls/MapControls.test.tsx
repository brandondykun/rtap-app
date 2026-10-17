import { act, fireEvent, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE } from '../layout';
import { MapControls } from './MapControls';

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  useMapChrome.setState(INITIAL_MAP_CHROME);
});

function handlers() {
  return { onNorthUp: jest.fn(), onZoomIn: jest.fn(), onZoomOut: jest.fn(), onRecenter: jest.fn() };
}

describe('MapControls', () => {
  it('calls the camera actions', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter {...h} panel={null} landscape={false} />);
    await fireEvent.press(screen.getByLabelText('North up'));
    await fireEvent.press(screen.getByLabelText('Zoom in'));
    await fireEvent.press(screen.getByLabelText('Zoom out'));
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(h.onNorthUp).toHaveBeenCalledTimes(1);
    expect(h.onZoomIn).toHaveBeenCalledTimes(1);
    expect(h.onZoomOut).toHaveBeenCalledTimes(1);
    expect(h.onRecenter).toHaveBeenCalledTimes(1);
  });

  it('rotates the needle against the map bearing', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} />);
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 30 }));
    expect(StyleSheet.flatten(screen.getByTestId('north-needle').props.style).transform).toEqual([{ rotate: '-30deg' }]);
  });

  it('shows follow state on your grid card', async () => {
    await renderWithProviders(<MapControls following canRecenter {...handlers()} panel={null} landscape={false} />);
    expect(screen.getByLabelText('Recenter on me')).toBeSelected();
  });

  it('disables recenter without a fix', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter={false} {...h} panel={null} landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(h.onRecenter).not.toHaveBeenCalled();
  });

  it('hides zoom and lifts your grid card above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} landscape={false} />);
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('map-controls-bottom').props.style).bottom).toBe(320 + EDGE);
  });

  it('hides your grid card when a full sheet leaves no room for it', async () => {
    const size = Dimensions.get('window').height - 100;
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size }} landscape={false} />);
    expect(screen.queryByLabelText('Recenter on me')).toBeNull();
  });

  it('puts your grid card under zoom in landscape, with no GPS toggle', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape />);
    expect(screen.queryByLabelText('GPS')).toBeNull();
    expect(screen.getByTestId('map-controls-bottom')).toContainElement(screen.getByTestId('gps-readout'));
    expect(screen.getByLabelText('Recenter on me')).toBe(screen.getByTestId('gps-readout'));
  });

  it('puts your grid card bottom left in portrait, lined up with the crosshair readout', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} />);
    expect(screen.getByTestId('map-controls-bottom')).not.toContainElement(screen.getByTestId('gps-readout'));
    expect(screen.getByTestId('self-card-left')).toContainElement(screen.getByTestId('gps-readout'));
    expect(screen.getByTestId('self-card-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
  });

  it('keeps the portrait card above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} landscape={false} />);
    expect(screen.getByTestId('self-card-left')).toHaveStyle({ bottom: 320 + EDGE });
  });

  it('reports the card size for the bottom bars, and zero once it hides', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} />);
    await fireEvent(screen.getByTestId('self-card-slot'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 250, height: 64 } } });
    expect(useMapChrome.getState().selfCard).toEqual({ width: 250, height: 64 });
    await screen.unmount();
    expect(useMapChrome.getState().selfCard).toEqual({ width: 0, height: 0 });
  });
});
