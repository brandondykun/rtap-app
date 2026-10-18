import { act, screen } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { ReadoutDock } from './ReadoutDock';

const DC = { lat: 38.8977, lon: -77.0365 };
const CENTER = { lat: 38.905, lon: -77.03 };

const fix = (altitudeM: number | null) => usePresence.getState().setSelfPosition({ position: DC, accuracyM: 4.6, timestamp: 1, altitudeM });

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('ReadoutDock', () => {
  it('puts ME (your grid, altitude over accuracy) over CTR (the crosshair grid, distance over bearing from you)', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock showCenter />);
    const rows = (screen.getByTestId('readout-dock').children as { props: { testID?: string } }[]).map((c) => c.props.testID);
    expect(rows).toEqual(['dock-self', 'dock-divider', 'dock-center']);
    expect(screen.getByTestId('dock-self')).toHaveTextContent(/ME18S UJ \d{5} \d{5}142 m±5 m$/);
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('142 m');
    expect(screen.getByTestId('gps-accuracy')).toHaveTextContent('±5 m');
    expect(screen.getByTestId('dock-center')).toHaveTextContent(/CTR/);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(CENTER, 'mgrs'));
    expect(screen.getByTestId('readout-range')).toHaveTextContent('987 m');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}°$/);
  });

  it('leaves the CTR row out when the center grid is not shown', async () => {
    fix(10);
    await renderWithProviders(<ReadoutDock showCenter={false} />);
    expect(screen.queryByTestId('dock-center')).toBeNull();
    expect(screen.queryByTestId('dock-divider')).toBeNull();
    expect(screen.getByTestId('dock-self')).toBeTruthy();
  });

  it('waits for GPS without a fix, with dashes for distance and bearing', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    await renderWithProviders(<ReadoutDock showCenter />);
    expect(screen.getByTestId('dock-self')).toHaveTextContent(/Waiting for GPS…/);
    expect(screen.queryByTestId('gps-altitude')).toBeNull();
    expect(screen.getByTestId('readout-range')).toHaveTextContent('—');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent('—');
  });

  it('says location is off when it is denied', async () => {
    await renderWithProviders(<ReadoutDock showCenter />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('dock-self')).toHaveTextContent(/Location is off/);
  });

  it('shows altitude and accuracy in the altitude unit, and a dash for an unknown altitude', async () => {
    useSettings.getState().setAltitudeUnit('ft');
    fix(null);
    await renderWithProviders(<ReadoutDock showCenter={false} />);
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('—');
    expect(screen.getByTestId('gps-accuracy')).toHaveTextContent('±15 ft');
  });
});
