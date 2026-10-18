import { act, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE, GAP } from '../layout';
import { MapBottomLeft } from './MapBottomLeft';

const CARD = { width: 220, height: 56 };

beforeEach(() => useMapChrome.setState(INITIAL_MAP_CHROME));

describe('MapBottomLeft', () => {
  it('holds only the center card, bottom left', async () => {
    await renderWithProviders(<MapBottomLeft panel={null} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
    expect(screen.getByTestId('map-bottom-left').children).toEqual([screen.getByTestId('center-card')]);
  });

  it('sits on the bottom row beside your card in landscape', async () => {
    const { width } = Dimensions.get('window');
    await renderWithProviders(<MapBottomLeft panel={null} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE, maxWidth: width - 2 * EDGE - CARD.width - GAP });
  });

  it('stays visible right of a left drawer', async () => {
    await renderWithProviders(<MapBottomLeft panel={{ side: 'left', size: 360 }} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: 360 + EDGE, bottom: EDGE });
  });
});
