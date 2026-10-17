import { act, fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE } from '../layout';
import { MapBottomLeft } from './MapBottomLeft';

const CARD = { width: 250, height: 64 };

beforeEach(() => useMapChrome.setState(INITIAL_MAP_CHROME));

describe('MapBottomLeft', () => {
  it('sits bottom-left with only the crosshair readout card', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
    expect(screen.getByTestId('map-bottom-left').children).toEqual([screen.getByTestId('readout-card')]);
  });

  it('stays at the bottom in portrait, under your grid card', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ bottom: EDGE });
  });

  it('reports its size so your grid card can sit above it, and zero once it hides', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} />);
    await fireEvent(screen.getByTestId('map-bottom-left'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 52 } } });
    expect(useMapChrome.getState().readoutCard).toEqual({ width: 200, height: 52 });
    await screen.unmount();
    expect(useMapChrome.getState().readoutCard).toEqual({ width: 0, height: 0 });
  });

  it('sits bottom right in landscape, under the zoom buttons', async () => {
    await renderWithProviders(<MapBottomLeft landscape />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ right: EDGE, bottom: EDGE });
    expect(screen.getByTestId('map-bottom-left').props.style.left).toBeUndefined();
  });
});
