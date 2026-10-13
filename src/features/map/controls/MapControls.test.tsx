import { act, fireEvent, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE } from '../layout';
import { MapControls } from './MapControls';

beforeEach(() => useInteraction.setState(INITIAL_INTERACTION));

function handlers() {
  return { onNorthUp: jest.fn(), onZoomIn: jest.fn(), onZoomOut: jest.fn(), onRecenter: jest.fn() };
}

describe('MapControls', () => {
  it('calls the camera actions', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter {...h} panel={null} />);
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
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={null} />);
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 30 }));
    expect(StyleSheet.flatten(screen.getByTestId('north-needle').props.style).transform).toEqual([{ rotate: '-30deg' }]);
  });

  it('shows follow state on the recenter button', async () => {
    await renderWithProviders(<MapControls following canRecenter {...handlers()} panel={null} />);
    expect(screen.getByLabelText('Recenter on me')).toBeSelected();
  });

  it('disables recenter without a fix', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter={false} {...h} panel={null} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(h.onRecenter).not.toHaveBeenCalled();
  });

  it('hides zoom and lifts recenter above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} />);
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('map-controls-bottom').props.style).bottom).toBe(320 + EDGE);
  });

  it('hides recenter when a full sheet leaves no room for it', async () => {
    const size = Dimensions.get('window').height - 100;
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size }} />);
    expect(screen.queryByLabelText('Recenter on me')).toBeNull();
  });
});
