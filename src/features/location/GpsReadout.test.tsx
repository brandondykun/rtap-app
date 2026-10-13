import { act, screen } from '@testing-library/react-native';

import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { GpsReadout } from './GpsReadout';

const fix = (altitudeM: number | null) =>
  usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: 4.6, timestamp: 1, altitudeM });

beforeEach(() => {
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('GpsReadout', () => {
  it('waits for the first fix', async () => {
    await renderWithProviders(<GpsReadout />);
    expect(screen.getByText('Waiting for GPS…')).toBeTruthy();
    expect(screen.queryByTestId('gps-altitude')).toBeNull();
  });

  it('shows the position in the coordinate format and altitude and accuracy in the altitude unit', async () => {
    await renderWithProviders(<GpsReadout />);
    await act(async () => fix(142.4));
    expect(screen.getByTestId('gps-position')).toHaveTextContent(/^18S UJ \d{5} \d{5}$/);
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT 142 m · ACC ±5 m');

    await act(async () => {
      useSettings.getState().setAltitudeUnit('ft');
      useSettings.getState().setCoordinateFormat('latlon');
    });
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT 467 ft · ACC ±15 ft');
    expect(screen.getByTestId('gps-position')).not.toHaveTextContent(/^18S/);
  });

  it('shows a dash when the altitude is unknown', async () => {
    await renderWithProviders(<GpsReadout />);
    await act(async () => fix(null));
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT — · ACC ±5 m');
  });

  it('says location is off when it is denied', async () => {
    await renderWithProviders(<GpsReadout />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByText('Location is off')).toBeTruthy();
  });
});
