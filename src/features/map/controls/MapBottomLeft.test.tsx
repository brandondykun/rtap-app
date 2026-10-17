import { act, fireEvent, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { renderWithProviders } from '@/test-utils/render';

import { EDGE } from '../layout';
import { MapBottomLeft } from './MapBottomLeft';

const CARD = { width: 250, height: 64 };

beforeEach(() => useMapChrome.setState(INITIAL_MAP_CHROME));

describe('MapBottomLeft', () => {
  it('sits bottom-left with only the crosshair readout card', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} panel={null} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: EDGE });
    expect(screen.getByTestId('map-bottom-left').children).toEqual([screen.getByTestId('readout-card')]);
  });

  it('stays at the bottom in portrait, under your grid card', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} panel={null} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ bottom: EDGE });
  });

  it('reports its size so your grid card can sit above it, and zero once it hides', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} panel={null} />);
    await fireEvent(screen.getByTestId('map-bottom-left'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 52 } } });
    expect(useMapChrome.getState().readoutCard).toEqual({ width: 200, height: 52 });
    await screen.unmount();
    expect(useMapChrome.getState().readoutCard).toEqual({ width: 0, height: 0 });
  });

  it('sits bottom right in landscape, under the zoom buttons', async () => {
    await renderWithProviders(<MapBottomLeft landscape panel={null} />);
    await act(async () => useMapChrome.getState().setSelfCard(CARD));
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ right: EDGE, bottom: EDGE });
    expect(screen.getByTestId('map-bottom-left').props.style.left).toBeUndefined();
  });

  it('lifts above a bottom sheet in portrait', async () => {
    await renderWithProviders(<MapBottomLeft landscape={false} panel={{ side: 'bottom', size: 320 }} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ left: EDGE, bottom: 320 + EDGE });
  });

  it('stays bottom right beside a left drawer in landscape', async () => {
    await renderWithProviders(<MapBottomLeft landscape panel={{ side: 'left', size: 360 }} />);
    expect(screen.getByTestId('map-bottom-left')).toHaveStyle({ right: EDGE, bottom: EDGE });
  });

  it('hides when a full sheet leaves no room for it', async () => {
    const size = Dimensions.get('window').height - 100;
    await renderWithProviders(<MapBottomLeft landscape={false} panel={{ side: 'bottom', size }} />);
    expect(screen.queryByTestId('readout-card')).toBeNull();
  });
});
