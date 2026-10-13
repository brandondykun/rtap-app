import { act, screen } from '@testing-library/react-native';

import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE, LOGO_WORDMARK_HEIGHT, ornamentRowTop, topLeftStackTop } from '../layout';
import { MapTopLeft } from './MapTopLeft';

beforeEach(() => {
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('MapTopLeft', () => {
  it.each([[false], [true]])('sits right under the Mapbox wordmark (landscape=%s)', async (landscape) => {
    await renderWithProviders(<MapTopLeft landscape={landscape} panel={null} />);
    expect(topLeftStackTop(landscape)).toBe(ornamentRowTop(landscape) + LOGO_WORDMARK_HEIGHT);
    expect(screen.getByTestId('map-top-left')).toHaveStyle({ top: topLeftStackTop(landscape), left: EDGE });
  });

  it('shows the GPS readout only while the toggle is on', async () => {
    await renderWithProviders(<MapTopLeft landscape={false} panel={null} />);
    expect(screen.queryByTestId('gps-readout')).toBeNull();
    await act(async () => useSettings.getState().toggleShowGps());
    expect(screen.getByTestId('gps-readout')).toBeTruthy();
  });

  it('stacks the location notice above the GPS readout, and drops only the notice while a panel is open', async () => {
    useSettings.setState({ showGps: true });
    const { rerender } = await renderWithProviders(<MapTopLeft landscape={false} panel={null} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    const children = screen.getByTestId('map-top-left').children;
    expect(screen.getByTestId('location-banner')).toBeTruthy();
    expect(children.indexOf(screen.getByTestId('location-banner'))).toBeLessThan(children.indexOf(screen.getByTestId('gps-readout')));
    await rerender(<MapTopLeft landscape={false} panel={{ side: 'bottom', size: 300 }} />);
    expect(screen.queryByTestId('location-banner')).toBeNull();
    expect(screen.getByTestId('gps-readout')).toBeTruthy();
  });

  it('moves right of a left drawer, like the Mapbox logo', async () => {
    useSettings.setState({ showGps: true });
    await renderWithProviders(<MapTopLeft landscape panel={{ side: 'left', size: 320 }} />);
    expect(screen.getByTestId('map-top-left')).toHaveStyle({ left: 320 + EDGE });
  });
});
