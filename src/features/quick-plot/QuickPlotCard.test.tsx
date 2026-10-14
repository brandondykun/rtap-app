import { fireEvent, screen } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { CONTROL_SIZE, EDGE, GAP } from '@/features/map/layout';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { renderWithProviders } from '@/test-utils/render';

import { QuickPlotCard } from './QuickPlotCard';

const T = { lat: 38.91, lon: -77 };

beforeEach(() => {
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


  it.each([[false], [true]])('leaves the zoom and recenter column clear (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ right: EDGE + CONTROL_SIZE + GAP });
  });
});
