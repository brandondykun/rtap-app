import { act, fireEvent, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, View } from 'react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE, GAP } from '../layout';
import { MapControls } from './MapControls';

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  useMapChrome.setState(INITIAL_MAP_CHROME);
  useSettings.setState(DEFAULT_SETTINGS);
});

function handlers() {
  return { onNorthUp: jest.fn(), onZoomIn: jest.fn(), onZoomOut: jest.fn(), onRecenter: jest.fn() };
}

describe('MapControls', () => {
  it('calls the camera actions', async () => {
    const h = handlers();
    useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 30 });
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

  it('hides north-up while the map points north and brings it back once rotated', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter {...h} panel={null} landscape={false} />);
    expect(screen.queryByLabelText('North up')).toBeNull();
    expect(screen.getByTestId('north-up', { includeHiddenElements: true })).toHaveProp('pointerEvents', 'none');
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 12 }));
    expect(screen.getByLabelText('North up')).toBeTruthy();
    expect(screen.getByTestId('north-up')).toHaveProp('pointerEvents', 'auto');
    // Within a fraction of a degree (either side of 0/360) counts as north.
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 359.8 }));
    expect(screen.queryByLabelText('North up')).toBeNull();
  });

  it('hides the zoom buttons when the setting is off', async () => {
    useSettings.getState().setShowZoomButtons(false);
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape />);
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
    expect(screen.queryByLabelText('Zoom out')).toBeNull();
    expect(screen.getByLabelText('Recenter on me')).toBeTruthy();
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

  it('keeps zoom while a panel is open, lifted above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} landscape={false} />);
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('map-controls-bottom').props.style).bottom).toBe(320 + EDGE);
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'left', size: 360 }} landscape />);
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
  });

  it('hides zoom and your grid card when a full sheet leaves no room for them', async () => {
    const size = Dimensions.get('window').height - 100;
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size }} landscape={false} />);
    expect(screen.queryByLabelText('Recenter on me')).toBeNull();
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
  });

  it('puts your grid card under zoom in landscape, with no GPS toggle', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape />);
    expect(screen.queryByLabelText('GPS')).toBeNull();
    expect(screen.getByTestId('map-controls-bottom')).toContainElement(screen.getByTestId('gps-readout'));
    expect(screen.getByLabelText('Recenter on me')).toBe(screen.getByTestId('gps-readout'));
  });

  it('puts your grid card bottom left in portrait, right above the crosshair readout', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} />);
    expect(screen.getByTestId('map-controls-bottom')).not.toContainElement(screen.getByTestId('gps-readout'));
    expect(screen.getByTestId('self-card-left')).toContainElement(screen.getByTestId('gps-readout'));
    expect(screen.getByTestId('self-card-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
    await act(async () => useMapChrome.getState().setReadoutCard({ width: 200, height: 52 }));
    expect(screen.getByTestId('self-card-left')).toHaveStyle({ bottom: EDGE + 52 + GAP });
  });

  it('keeps the portrait card above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} landscape={false} />);
    expect(screen.getByTestId('self-card-left')).toHaveStyle({ bottom: 320 + EDGE });
  });

  it.each([[true], [false]])('shows an action bar in place of your grid card (landscape=%s)', async (landscape) => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={landscape} bar={<View testID="bar" />} />);
    expect(screen.queryByTestId('gps-readout')).toBeNull();
    const slot = landscape ? screen.getByTestId('map-controls-bottom') : screen.getByTestId('self-card-left');
    expect(slot).toContainElement(screen.getByTestId('bar'));
  });

  it('keeps the action bar even when a full sheet leaves no room for your grid card', async () => {
    const size = Dimensions.get('window').height - 100;
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size }} landscape={false} bar={<View testID="bar" />} />);
    expect(screen.getByTestId('bar')).toBeTruthy();
  });

  it('reports the card size for the bottom bars, and zero once it hides', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} landscape={false} />);
    await fireEvent(screen.getByTestId('self-card-slot'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 250, height: 64 } } });
    expect(useMapChrome.getState().selfCard).toEqual({ width: 250, height: 64 });
    await screen.unmount();
    expect(useMapChrome.getState().selfCard).toEqual({ width: 0, height: 0 });
  });
});
