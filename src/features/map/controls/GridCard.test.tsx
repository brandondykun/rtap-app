import { act, fireEvent, screen } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { GridCard } from './GridCard';

const DC = { lat: 38.8977, lon: -77.0365 };
const PROPS = { following: false, disabled: false, onRecenter: () => {} };

const fix = (altitudeM: number | null) => usePresence.getState().setSelfPosition({ position: DC, accuracyM: 4.6, timestamp: 1, altitudeM });

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('GridCard', () => {
  it('puts CTR (crosshair grid, range and bearing) on the top line and ME (your grid, ALT and ACC) under it', async () => {
    useInteraction.getState().setCamera({ center: { lat: 38.905, lon: -77.03 }, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<GridCard {...PROPS} />);
    const lines = screen.getByTestId('grid-card').children as unknown[];
    expect(lines[0]).toBe(screen.getByTestId('center-line'));
    expect(lines[1]).toBe(screen.getByTestId('gps-readout'));
    expect(screen.getByTestId('center-line')).toHaveTextContent(/^CTR/);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate({ lat: 38.905, lon: -77.03 }, 'mgrs'));
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}° GRID$/);
    expect(screen.getByTestId('gps-readout')).toHaveTextContent(/ME18S UJ \d{5} \d{5}ALT/);
    expect(screen.getByTestId('gps-position')).toHaveTextContent(/^18S UJ \d{5} \d{5}$/);
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT 142 m · ACC ±5 m');
  });

  it('shows dashes for range and bearing, and waits, without a fix', async () => {
    useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
    await renderWithProviders(<GridCard {...PROPS} />);
    expect(screen.getByTestId('readout-range')).toHaveTextContent('— ·');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent('— GRID');
    expect(screen.getByText('Waiting for GPS…')).toBeTruthy();
    expect(screen.queryByTestId('gps-altitude')).toBeNull();
  });

  it('toggles grid and magnetic when the bearing is tapped, without recentering', async () => {
    const onRecenter = jest.fn();
    useInteraction.getState().setCamera({ center: { lat: 38.905, lon: -77.03 }, zoom: 12, bearing: 0 });
    fix(10);
    await renderWithProviders(<GridCard {...PROPS} onRecenter={onRecenter} />);
    await fireEvent.press(screen.getByTestId('readout-bearing'));
    expect(useSettings.getState().northRef).toBe('magnetic');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}° MAG$/);
    expect(onRecenter).not.toHaveBeenCalled();
  });

  it('shows ALT and ACC in the altitude unit, and a dash for an unknown altitude', async () => {
    await renderWithProviders(<GridCard {...PROPS} />);
    await act(async () => fix(null));
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT — · ACC ±5 m');
    await act(async () => {
      fix(142.4);
      useSettings.getState().setAltitudeUnit('ft');
      useSettings.getState().setCoordinateFormat('latlon');
    });
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT 467 ft · ACC ±15 ft');
    expect(screen.getByTestId('gps-position')).not.toHaveTextContent(/^18S/);
  });

  it('says location is off when it is denied', async () => {
    await renderWithProviders(<GridCard {...PROPS} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByText('Location is off')).toBeTruthy();
  });

  it('recenters from the ME line, shows following, and does nothing while disabled', async () => {
    const onRecenter = jest.fn();
    await renderWithProviders(<GridCard following disabled={false} onRecenter={onRecenter} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Recenter on me')).toBeSelected();
    await screen.unmount();
    await renderWithProviders(<GridCard following={false} disabled onRecenter={onRecenter} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Recenter on me')).not.toBeSelected();
  });

  it('drops the CTR line when Show center grid is off', async () => {
    useSettings.getState().setShowCenterGrid(false);
    await renderWithProviders(<GridCard {...PROPS} />);
    expect(screen.queryByTestId('center-line')).toBeNull();
    expect(screen.getByTestId('gps-readout')).toBeTruthy();
  });
});
