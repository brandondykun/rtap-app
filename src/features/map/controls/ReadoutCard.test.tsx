import { fireEvent, screen } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { ReadoutCard } from './ReadoutCard';

const DC = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('ReadoutCard', () => {
  it('shows the crosshair coordinate and dashes without a fix', async () => {
    useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
    await renderWithProviders(<ReadoutCard />);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(DC, 'mgrs'));
    expect(screen.getByTestId('readout-range')).toHaveTextContent('— ·');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent('— GRID');
  });

  it('toggles grid and magnetic when the bearing is tapped', async () => {
    useInteraction.getState().setCamera({ center: { lat: 38.905, lon: -77.03 }, zoom: 12, bearing: 0 });
    usePresence.getState().setSelfPosition({ position: DC, accuracyM: 5, timestamp: 1 });
    await renderWithProviders(<ReadoutCard />);
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}° GRID$/);

    await fireEvent.press(screen.getByTestId('readout-bearing'));
    expect(useSettings.getState().northRef).toBe('magnetic');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}° MAG$/);
  });
});
