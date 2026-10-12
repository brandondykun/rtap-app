import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { EDGE, GAP, LOGO_ROW_HEIGHT, TOOLBAR_HEIGHT } from '@/features/map/layout';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { renderWithProviders } from '@/test-utils/render';

import { LocationBanner } from './LocationBanner';

beforeEach(() => usePresence.setState(INITIAL_PRESENCE));

describe('LocationBanner', () => {
  it('is hidden while location is unknown or granted', async () => {
    await renderWithProviders(<LocationBanner landscape={false} />);
    expect(screen.queryByText(/Location is off/)).toBeNull();
  });

  it('offers Settings and can be dismissed when location is denied', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderWithProviders(<LocationBanner landscape={false} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByText(/Location is off/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Settings'));
    expect(open).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText(/Location is off/)).toBeNull();
  });

  it.each([
    [false, EDGE + TOOLBAR_HEIGHT + GAP + LOGO_ROW_HEIGHT],
    [true, EDGE + LOGO_ROW_HEIGHT],
  ])('sits below the Mapbox logo row (landscape=%s)', async (landscape, top) => {
    await renderWithProviders(<LocationBanner landscape={landscape} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    const banner = screen.getByTestId('location-banner');
    expect(banner).toHaveStyle({ top });
  });
});
