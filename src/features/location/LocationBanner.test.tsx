import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { renderWithProviders } from '@/test-utils/render';

import { LocationBanner } from './LocationBanner';

beforeEach(() => usePresence.setState(INITIAL_PRESENCE));

describe('LocationBanner', () => {
  it('is hidden while location is unknown or granted', async () => {
    await renderWithProviders(<LocationBanner />);
    expect(screen.queryByText(/Location is off/)).toBeNull();
  });

  it('offers Settings and can be dismissed when location is denied', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderWithProviders(<LocationBanner />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByText(/Location is off/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Settings'));
    expect(open).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText(/Location is off/)).toBeNull();
  });
});
