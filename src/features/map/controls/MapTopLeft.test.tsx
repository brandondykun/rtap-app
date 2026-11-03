import { act, screen } from '@testing-library/react-native';

import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { renderWithProviders } from '@/test-utils/render';

import { bannerTop, EDGE, topLeftStackTop } from '../layout';
import { MapTopLeft } from './MapTopLeft';

beforeEach(() => {
  usePresence.setState(INITIAL_PRESENCE);
  useMeasure.setState(INITIAL_MEASURE);
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  useMenu.setState(INITIAL_MENU);
});

describe('MapTopLeft', () => {
  it('places the location notice below the logo row and the toolbar', async () => {
    await renderWithProviders(<MapTopLeft panel={null} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('map-top-left')).toHaveStyle({ top: topLeftStackTop(), left: EDGE });
    expect(screen.getByTestId('location-banner')).toHaveStyle({ marginTop: bannerTop() - topLeftStackTop() });
  });

  it('hides the notice while a panel is open and moves right of a left drawer', async () => {
    const { rerender } = await renderWithProviders(<MapTopLeft panel={null} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('location-banner')).toBeTruthy();
    await rerender(<MapTopLeft panel={{ side: 'left', size: 320 }} />);
    expect(screen.queryByTestId('location-banner')).toBeNull();
    expect(screen.getByTestId('map-top-left')).toHaveStyle({ left: 320 + EDGE });
  });

  it('shows the notice while the portrait sheet is minimized to its bottom bar', async () => {
    useMenu.setState({ panelMinimized: true });
    await renderWithProviders(<MapTopLeft panel={{ side: 'bottom', size: 48 }} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('location-banner')).toBeTruthy();
  });

  it('keeps the location notice in place while measuring (the measure bar is at the bottom)', async () => {
    useMeasure.getState().startMeasure();
    await renderWithProviders(<MapTopLeft panel={null} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.queryByTestId('measure-bar')).toBeNull();
    expect(screen.getByTestId('location-banner')).toHaveStyle({ marginTop: bannerTop() - topLeftStackTop() });
  });

  it('hides the location notice while the quick plot entry is up (it would cover the grid fields)', async () => {
    useQuickPlot.getState().open();
    await renderWithProviders(<MapTopLeft panel={null} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.queryByTestId('location-banner')).toBeNull();
  });
});
