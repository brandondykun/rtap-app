import { act, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { renderWithProviders } from '@/test-utils/render';

import { CONTROL_SIZE, EDGE, GAP } from '../layout';
import { MapBottomLeft } from './MapBottomLeft';

const CARD = { width: 220, height: 56 };

beforeEach(() => useMapChrome.setState(INITIAL_MAP_CHROME));

describe('MapBottomLeft', () => {
  it('holds only the center card, bottom left', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} panel={null} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
    expect(screen.getByTestId('map-bottom-left').children).toEqual([screen.getByTestId('center-card')]);
  });

  it('sits just above the height of your card in portrait, clear of the right column', async () => {
    const { width } = Dimensions.get('window');
    await renderWithProviders(<MapBottomLeft landscape={false} panel={null} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE + CARD.height + GAP, maxWidth: width - 2 * EDGE - CONTROL_SIZE - GAP });
  });

  it('sits on the bottom row beside your card in landscape', async () => {
    const { width } = Dimensions.get('window');
    await renderWithProviders(<MapBottomLeft landscape panel={null} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE, maxWidth: width - 2 * EDGE - CARD.width - GAP });
  });

  it('stays visible above a bottom sheet and right of a left drawer', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} panel={{ side: 'bottom', size: 320 }} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ bottom: 320 + EDGE });
    await screen.unmount();
    await renderWithProviders(<MapBottomLeft landscape panel={{ side: 'left', size: 360 }} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: 360 + EDGE, bottom: EDGE });
  });

  it('hides when a full sheet leaves no room for it', async () => {
    const size = Dimensions.get('window').height - 100;
    await renderWithProviders(<MapBottomLeft landscape={false} panel={{ side: 'bottom', size }} />);
    expect(screen.queryByTestId('center-card')).toBeNull();
  });
});
