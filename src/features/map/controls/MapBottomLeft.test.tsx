import { act, screen } from '@testing-library/react-native';

import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE } from '../layout';
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
    const children = screen.getByTestId('map-bottom-left').children;
    expect(children).toEqual([screen.getByTestId('gps-readout'), screen.getByTestId('readout-card')]);
  });
});
