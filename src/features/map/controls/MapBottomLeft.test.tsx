import { act, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { CONTROL_SIZE, EDGE, GAP } from '../layout';
import { MapBottomLeft } from './MapBottomLeft';

beforeEach(() => useSettings.setState(DEFAULT_SETTINGS));

describe('MapBottomLeft', () => {
  it('sits bottom-left with the crosshair readout card', async () => {
    await renderWithProviders(<MapBottomLeft />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
    expect(screen.getByTestId('readout-card')).toBeTruthy();
    expect(screen.queryByTestId('gps-readout')).toBeNull();
  });

  it('stacks the GPS readout, in its own box, on top of the readout card while the toggle is on', async () => {
    await renderWithProviders(<MapBottomLeft />);
    await act(async () => useSettings.getState().toggleShowGps());
    const children = screen.getByTestId('map-readouts').children;
    expect(children).toEqual([screen.getByTestId('gps-readout'), screen.getByTestId('readout-card')]);
  });

  it('puts a footer under the readouts, stretched to the zoom column', async () => {
    await renderWithProviders(<MapBottomLeft footer={<View testID="footer" />} />);
    expect(screen.getByTestId('map-bottom-left').children).toEqual([screen.getByTestId('map-readouts'), screen.getByTestId('footer')]);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ right: EDGE + CONTROL_SIZE + GAP });
  });

  it('puts a footer beside the readouts (landscape), in the room left before the recenter button', async () => {
    await renderWithProviders(<MapBottomLeft footer={<View testID="footer" />} footerBeside />);
    const [readouts, slot] = screen.getByTestId('map-bottom-left').children;
    expect(readouts).toEqual(screen.getByTestId('map-readouts'));
    expect(slot).toEqual(screen.getByTestId('map-bottom-footer'));
    expect(screen.getByTestId('map-bottom-footer').children).toEqual([screen.getByTestId('footer')]);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ right: EDGE + CONTROL_SIZE + GAP, flexDirection: 'row', alignItems: 'flex-end' });
  });
});
