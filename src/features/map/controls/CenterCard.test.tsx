import { screen } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { CenterCard } from './CenterCard';

const DC = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('CenterCard', () => {
  it('shows only CTR and the crosshair grid', async () => {
    useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('center-card')).toHaveTextContent(`CTR${formatCoordinate(DC, 'mgrs')}`);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(DC, 'mgrs'));
    expect(screen.getByTestId('readout-coordinate')).not.toHaveStyle({ color: themeColors('dark').danger });
    // The CTR icon is the app's crosshair: white arms, amber dot.
    expect(screen.getByTestId('crosshair-dot')).toHaveStyle({ backgroundColor: themeColors('dark').accent });
    expect(screen.queryByTestId('readout-range')).toBeNull();
    expect(screen.queryByTestId('readout-bearing')).toBeNull();
  });

  it('follows the coordinate format', async () => {
    useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
    useSettings.getState().setCoordinateFormat('latlon');
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(DC, 'latlon'));
  });
});
