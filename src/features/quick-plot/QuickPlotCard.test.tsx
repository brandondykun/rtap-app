import { fireEvent, screen, within } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { CONTROL_SIZE, EDGE, GAP } from '@/features/map/layout';
import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { renderWithProviders } from '@/test-utils/render';

import { QuickPlotCard } from './QuickPlotCard';

const T = { lat: 38.91, lon: -77 };

beforeEach(() => {
  useMapChrome.setState(INITIAL_MAP_CHROME);
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  useMenu.setState(INITIAL_MENU);
  useQuickPlot.getState().plot(T);
});

describe('QuickPlotCard', () => {
  it('shows the grid and discards', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByText(formatCoordinate(T, 'mgrs'))).toBeTruthy();
    expect(screen.getByText('TEMP')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Discard'));
    expect(useQuickPlot.getState().temp).toBeNull();
  });

  it.each([
    ['Save unit', 'unit.add'],
    ['Save point', 'point.add'],
  ] as const)('%s opens %s at the temporary point and ends quick plot', async (label, id) => {
    await renderWithProviders(<QuickPlotCard landscape />);
    await fireEvent.press(screen.getByLabelText(label));
    expect(useMenu.getState().stack).toEqual([{ id, params: { at: T } }]);
    expect(useQuickPlot.getState().temp).toBeNull();
  });


  it.each([[false], [true]])('leaves the zoom column clear (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ right: EDGE + CONTROL_SIZE + GAP });
  });

  it('sits above your grid card in portrait and beside it in landscape', async () => {
    useMapChrome.getState().setSelfCard({ width: 250, height: 64 });
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ bottom: EDGE + 64 + GAP, right: EDGE + CONTROL_SIZE + GAP });
    await screen.unmount();
    await renderWithProviders(<QuickPlotCard landscape />);
    // Landscape: your grid card is bottom left, so the card sits right of it, clear of zoom.
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ bottom: EDGE, left: EDGE + 250 + GAP, right: EDGE + CONTROL_SIZE + GAP });
  });

  it('shows Discard as a trash icon only', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByLabelText('Discard')).toBeTruthy();
    expect(screen.queryByText('Discard')).toBeNull();
  });

  it('puts the grid and the buttons on one line in landscape', async () => {
    await renderWithProviders(<QuickPlotCard landscape />);
    const row = within(screen.getByTestId('quick-plot-card-row'));
    expect(row.getByText(formatCoordinate(T, 'mgrs'))).toBeTruthy();
    for (const label of ['Discard', 'Save unit', 'Save point']) expect(row.getByLabelText(label)).toBeTruthy();
  });


  it.each([[false], [true]])('puts the trash button after Save unit and Save point (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    const order = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(order.filter((l) => ['Discard', 'Save unit', 'Save point'].includes(l))).toEqual(['Save unit', 'Save point', 'Discard']);
  });
});
