import { fireEvent, screen, within } from '@testing-library/react-native';
import { Platform, TextInput } from 'react-native';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { bannerTop, EDGE, GAP, TOOLBAR_HEIGHT } from '@/features/map/layout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { ONE_LINE_MIN_WIDTH, QuickPlotEntry } from './QuickPlotEntry';

/** A window width for one test (`null`: the real one). */
let mockWindowWidth: number | null = null;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => {
    const window = jest.requireActual('react-native/Libraries/Utilities/Dimensions').default.get('window');
    return mockWindowWidth === null ? window : { ...window, width: mockWindowWidth };
  },
}));

const C = { lat: 38.9, lon: -77 };
const focusedLabels = () => (TextInput.prototype.focus as jest.Mock).mock.contexts.map((c) => (c as { props: { accessibilityLabel: string } }).props.accessibilityLabel);
const T = { lat: 38.91, lon: -77 };

beforeEach(() => {
  mockWindowWidth = null;
  (TextInput.prototype.focus as jest.Mock).mockClear();
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  useQuickPlot.getState().open();
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('QuickPlotEntry', () => {
  it('prefills zone and square from the crosshair, focuses Easting and plots only a valid grid', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    const g = mgrsFieldsFor(T);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue(g.zoneBand);
    expect(screen.getByLabelText('100 km square')).toHaveDisplayValue(g.square);
    expect(screen.getByLabelText('Easting')).toHaveDisplayValue('');
    expect(focusedLabels()).toEqual(['Easting']);
    expect(screen.getByLabelText('Plot')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Easting'), '253');
    await fireEvent.changeText(screen.getByLabelText('Northing'), '05');
    expect(screen.getByLabelText('Plot')).toBeDisabled();
    await fireEvent(screen.getByLabelText('Northing'), 'submitEditing');
    expect(useQuickPlot.getState().temp).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
    await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent(/^Valid$/);
    await fireEvent.press(screen.getByLabelText('Plot'));
    expect(useQuickPlot.getState().temp!.lat).toBeCloseTo(T.lat, 4);
    expect(useQuickPlot.getState().entryOpen).toBe(false);
  });

  it('shows range and bearing from me', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    usePresence.getState().setSelfPosition({ position: C, accuracyM: 5, timestamp: 1 });
    await renderWithProviders(<QuickPlotEntry landscape />);
    const g = mgrsFieldsFor(T);
    await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
    await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Valid · 1.11 km @ 000° TRUE from you');
  });

  it('opens empty on Zone when the crosshair has no position yet', async () => {
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue('');
    expect(focusedLabels()).toEqual(['MGRS zone']);
  });


  it.each([[false], [true]])('has no Clear button, and puts Cancel and Plot side by side below the grid (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotEntry landscape={landscape} />);
    expect(screen.queryByLabelText('Clear grid')).toBeNull();
    const row = within(screen.getByTestId('quick-plot-row'));
    expect(row.queryByLabelText('Plot')).toBeNull();
    const actions = within(screen.getByTestId('quick-plot-actions'));
    expect(actions.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Cancel', 'Plot']);
  });

  describe('on Android in landscape, where the keyboard is taller', () => {
    beforeEach(() => jest.replaceProperty(Platform, 'OS', 'android'));
    afterEach(() => jest.restoreAllMocks());

    const typeValidGrid = async () => {
      useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
      await renderWithProviders(<QuickPlotEntry landscape />);
      const g = mgrsFieldsFor(T);
      await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
      await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    };

    it('puts Cancel and Plot on the grid line when it fits, with the valid line below it all', async () => {
      mockWindowWidth = ONE_LINE_MIN_WIDTH + 2 * EDGE;
      await typeValidGrid();
      const row = within(screen.getByTestId('quick-plot-row'));
      expect(row.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Cancel', 'Plot']);
      expect(row.queryByTestId('mgrs-status')).toBeNull();
      expect(within(screen.getByTestId('quick-plot-entry')).getByTestId('mgrs-status')).toHaveTextContent(/^Valid/);
    });

    it('keeps Cancel and Plot below the grid when the line would not fit', async () => {
      mockWindowWidth = ONE_LINE_MIN_WIDTH + 2 * EDGE - 1;
      await typeValidGrid();
      expect(within(screen.getByTestId('quick-plot-row')).queryByLabelText('Plot')).toBeNull();
      expect(within(screen.getByTestId('quick-plot-row')).getByTestId('mgrs-status')).toHaveTextContent(/^Valid/);
    });

    it('keeps the portrait layout', async () => {
      mockWindowWidth = 2000;
      await renderWithProviders(<QuickPlotEntry landscape={false} />);
      expect(within(screen.getByTestId('quick-plot-row')).queryByLabelText('Plot')).toBeNull();
    });
  });

  it('keeps Cancel and Plot below the grid on iOS in landscape, even with room', async () => {
    mockWindowWidth = 2000;
    await renderWithProviders(<QuickPlotEntry landscape />);
    expect(within(screen.getByTestId('quick-plot-row')).queryByLabelText('Plot')).toBeNull();
  });

  it('Cancel closes the box without plotting', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(useQuickPlot.getState()).toMatchObject({ entryOpen: false, temp: null });
  });

  it('draws Plot like Set in MY POSITION: same height, sharing the row with Cancel', async () => {
    await renderWithProviders(<QuickPlotEntry landscape />);
    const plot = screen.getByLabelText('Plot').props.className as string;
    expect(plot).toMatch(/\bh-10\b/);
    expect(plot).toMatch(/\bflex-1\b/);
  });


  it('has no keyboard Done bar: Plot is the only way to plot', async () => {
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    expect(screen.getByLabelText('Northing').props.returnKeyType).toBeUndefined();
    expect(screen.getByLabelText('Northing').props.onSubmitEditing).toBeUndefined();
  });

  it('is see-through with no border', async () => {
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    const card = screen.getByTestId('quick-plot-entry').props.className as string;
    expect(card).toContain('bg-surface-glass');
    expect(card).not.toContain('border');
  });

  it('nests its fields and Plot concentrically: 16 pt corners less 8 pt padding is their 8 pt', async () => {
    for (const landscape of [false, true]) {
      await renderWithProviders(<QuickPlotEntry landscape={landscape} />);
      const card = screen.getByTestId('quick-plot-entry').props.className as string;
      expect(card).toMatch(/\brounded-2xl\b/);
      expect(card).toMatch(/\bp-2\b/);
      expect(screen.getByLabelText('Plot').props.className).toMatch(/\brounded-lg\b/);
      for (const field of ['MGRS zone', '100 km square', 'Easting', 'Northing']) {
        expect(screen.getByLabelText(field).props.className).toMatch(/\brounded-lg\b/);
        expect(screen.getByLabelText(field).props.className).not.toMatch(/\brounded-xl\b/);
      }
      await screen.unmount();
    }
  });

  it('reads plain "from you" when measuring from a manual position', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    usePresence.getState().setSelfPosition({ position: C, accuracyM: null, timestamp: 1, manual: true });
    await renderWithProviders(<QuickPlotEntry landscape />);
    const g = mgrsFieldsFor(T);
    await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
    await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent(/^Valid · 1\.11 km @ 000° TRUE from you$/);
  });

  it('sits below the Mapbox logo in portrait, and right under the toolbar in landscape', async () => {
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    expect(screen.getByTestId('quick-plot-frame')).toHaveStyle({ top: bannerTop(false) });
    await screen.unmount();

    await renderWithProviders(<QuickPlotEntry landscape />);
    expect(screen.getByTestId('quick-plot-frame')).toHaveStyle({ top: EDGE + TOOLBAR_HEIGHT + GAP });
  });

  it('dims Plot only lightly while the grid is invalid, like Set in MY POSITION', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    const plot = () => screen.getByLabelText('Plot');
    expect(plot()).toBeDisabled();
    expect(plot().props.className).toContain('opacity-70');
    expect(plot().props.className).not.toMatch(/(^|\s)opacity-40\b/);
    const g = mgrsFieldsFor(T);
    await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
    await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    expect(plot().props.className).not.toMatch(/(^|\s)opacity-\d/);
  });
});
