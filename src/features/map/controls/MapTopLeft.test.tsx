import { act, screen } from '@testing-library/react-native';

import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { renderWithProviders } from '@/test-utils/render';

import { bannerTop, EDGE, topLeftStackTop } from '../layout';
import { MapTopLeft } from './MapTopLeft';

beforeEach(() => usePresence.setState(INITIAL_PRESENCE));

describe('MapTopLeft', () => {
  it.each([[false], [true]])('places the location notice below the logo row and the toolbar (landscape=%s)', async (landscape) => {
    await renderWithProviders(<MapTopLeft landscape={landscape} panel={null} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('map-top-left')).toHaveStyle({ top: topLeftStackTop(landscape), left: EDGE });
    expect(screen.getByTestId('location-banner')).toHaveStyle({ marginTop: bannerTop(landscape) - topLeftStackTop(landscape) });
  });

  it('hides the notice while a panel is open and moves right of a left drawer', async () => {
    const { rerender } = await renderWithProviders(<MapTopLeft landscape panel={null} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('location-banner')).toBeTruthy();
    await rerender(<MapTopLeft landscape panel={{ side: 'left', size: 320 }} />);
    expect(screen.queryByTestId('location-banner')).toBeNull();
    expect(screen.getByTestId('map-top-left')).toHaveStyle({ left: 320 + EDGE });
  });
});
