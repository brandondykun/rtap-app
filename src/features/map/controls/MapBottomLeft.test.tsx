import { act, screen } from '@testing-library/react-native';

import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE, GAP } from '../layout';
import { MapBottomLeft } from './MapBottomLeft';

const CARD = { width: 250, height: 64 };

beforeEach(() => useMapChrome.setState(INITIAL_MAP_CHROME));

describe('MapBottomLeft', () => {
  it('sits bottom-left with only the crosshair readout card', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
    expect(screen.getByTestId('map-bottom-left').children).toEqual([screen.getByTestId('readout-card')]);
  });

  it('sits above your grid card in portrait', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ bottom: EDGE + CARD.height + GAP });
  });

  it('sits beside your grid card in landscape', async () => {
    await renderWithProviders(<MapBottomLeft landscape />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ bottom: EDGE });
  });
});
