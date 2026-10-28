import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { DEFAULT_MY_LOCATION, useMyLocation } from '@/stores/my-location';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { renderWithProviders } from '@/test-utils/render';

import { LocationBanner } from './LocationBanner';

const COPY = 'Location is off, so your position and range are hidden. You can turn it on any time in Settings.';

beforeEach(() => {
  usePresence.setState(INITIAL_PRESENCE);
  useMyLocation.setState(DEFAULT_MY_LOCATION);
});

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

  it('is see-through with no border and outlined text', async () => {
    await renderWithProviders(<LocationBanner />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    const banner = screen.getByTestId('location-banner').props.className as string;
    expect(banner).toContain('bg-surface-glass');
    expect(banner).not.toContain('border');
    expect(screen.getByText(/Location is off/)).toHaveStyle({ textShadowRadius: 3 });
  });

  it('says location can be turned on in Settings, and stays closed for good once closed', async () => {
    usePresence.getState().setLocationStatus('denied');
    await renderWithProviders(<LocationBanner />);
    expect(screen.getByText(COPY)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(useMyLocation.getState().offNoticeClosed).toBe(true);
    await screen.unmount();
    await renderWithProviders(<LocationBanner />);
    expect(screen.queryByTestId('location-banner')).toBeNull();
  });

  it('hides while a manual position is set, without counting as closed', async () => {
    usePresence.getState().setLocationStatus('denied');
    useMyLocation.getState().setManual({ lat: 1, lon: 2 });
    await renderWithProviders(<LocationBanner />);
    expect(screen.queryByTestId('location-banner')).toBeNull();
    await act(async () => useMyLocation.getState().switchToGps());
    expect(screen.getByTestId('location-banner')).toBeTruthy();
  });
});
