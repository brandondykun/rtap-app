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
    // Landscape: your card is bottom right under zoom, so the card sits left of it.
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ bottom: EDGE, left: EDGE, right: EDGE + 250 + GAP });
  });

  it('shows Discard as a trash icon only', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByLabelText('Discard')).toBeTruthy();
    expect(screen.queryByText('Discard')).toBeNull();
  });

  it.each([[false], [true]])('puts the grid on its own line, above the buttons (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    const buttons = within(screen.getByTestId('quick-plot-card-buttons'));
    for (const label of ['Discard', 'Save unit', 'Save point']) expect(buttons.getByLabelText(label)).toBeTruthy();
    expect(buttons.queryByText(formatCoordinate(T, 'mgrs'))).toBeNull();
    expect(screen.getByText(formatCoordinate(T, 'mgrs'))).toBeTruthy();
  });

  it.each([[false], [true]])('uses compact buttons, like the other map bars (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    for (const label of ['Discard', 'Save unit', 'Save point']) {
      expect(screen.getByLabelText(label).props.className).toContain('py-2');
      expect(screen.getByLabelText(label).props.className).not.toContain('py-3');
    }
  });

  it.each([[false], [true]])('puts the trash button after Save unit and Save point (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    const order = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(order.filter((l) => ['Discard', 'Save unit', 'Save point'].includes(l))).toEqual(['Save unit', 'Save point', 'Discard']);
  });
});
