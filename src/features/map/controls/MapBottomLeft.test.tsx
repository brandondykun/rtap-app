import { act, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { renderWithProviders } from '@/test-utils/render';

import { CONTROL_SIZE, EDGE, GAP } from '../layout';
import { MapBottomLeft } from './MapBottomLeft';

const CARD = { width: 250, height: 64 };

beforeEach(() => useMapChrome.setState(INITIAL_MAP_CHROME));

describe('MapBottomLeft', () => {
  it('sits bottom-left with only the crosshair readout card', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
    expect(screen.getByTestId('map-readouts').children).toEqual([screen.getByTestId('readout-card')]);
    expect(screen.queryByTestId('gps-readout')).toBeNull();
  });

  it('sits above your grid card in portrait, with a footer stretched to the zoom column', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} footer={<View testID="footer" />} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left').children).toEqual([screen.getByTestId('map-readouts'), screen.getByTestId('footer')]);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ bottom: EDGE + CARD.height + GAP, right: EDGE + CONTROL_SIZE + GAP });
  });

  it('sits beside your grid card in landscape, the footer under the readouts at its own width', async () => {
    await renderWithProviders(<MapBottomLeft landscape footer={<View testID="footer" />} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    const style = screen.getByTestId('map-bottom-left').props.style;
    expect(style).toMatchObject({ bottom: EDGE, maxWidth: expect.any(Number) });
    expect(style.right).toBeUndefined();
    expect(screen.getByTestId('map-bottom-left').children).toEqual([screen.getByTestId('map-readouts'), screen.getByTestId('footer')]);
  });
});
