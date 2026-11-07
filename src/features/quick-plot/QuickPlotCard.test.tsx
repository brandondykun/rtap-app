import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { CONTROL_SIZE, EDGE, GAP } from '@/features/map/layout';
import { setElevationSource } from '@/features/map/terrain/elevation';
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
  it('shows the grid and clears', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByText(formatCoordinate(T, 'mgrs'))).toBeTruthy();
    expect(screen.getByText('TEMP')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Clear'));
    expect(useQuickPlot.getState().temp).toBeNull();
  });

  it('offers just Save and Clear, then only Save unit, Save point and Cancel, Cancel last (far right on one line)', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const labels = () => within(screen.getByTestId('quick-plot-card-buttons')).getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels()).toEqual(['Clear', 'Save']);
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(labels()).toEqual(['Save unit', 'Save point', 'Cancel']);
    // Just the buttons: no TEMP, grid or altitude.
    expect(screen.queryByText('TEMP')).toBeNull();
    expect(screen.queryByText(formatCoordinate(T, 'mgrs'))).toBeNull();
    expect(screen.queryByTestId('quick-plot-altitude')).toBeNull();
    // Still the same point: nothing saved or cleared yet.
    expect(useQuickPlot.getState().temp).toEqual(T);
  });

  it('Cancel clears the point, as Clear does', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Save'));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(useQuickPlot.getState().temp).toBeNull();
  });

  it('starts again from Save and Clear for a new point', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Save'));
    await act(async () => useQuickPlot.getState().plot({ lat: 38.92, lon: -77 }));
    expect(screen.getByLabelText('Save')).toBeTruthy();
    expect(screen.queryByLabelText('Save unit')).toBeNull();
  });

  it.each([
    ['Save unit', 'unit.add'],
    ['Save point', 'point.add'],
  ] as const)('%s opens %s at the temporary point and ends quick plot', async (label, id) => {
    await renderWithProviders(<QuickPlotCard landscape />);
    await fireEvent.press(screen.getByLabelText('Save'));
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

  it('centers in portrait and sits flush bottom left in landscape, where the center card goes', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByTestId('quick-plot-card-slot').props.className).toContain('items-center');
    // Centered on the screen: as far in from the left as the zoom column keeps it from the right.
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ left: EDGE + CONTROL_SIZE + GAP, right: EDGE + CONTROL_SIZE + GAP });
    await screen.unmount();
    await renderWithProviders(<QuickPlotCard landscape />);
    expect(screen.getByTestId('quick-plot-card-slot').props.className).toContain('items-start');
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ left: EDGE, bottom: EDGE });
  });

  it('in landscape keeps right of an open drawer, like the center card', async () => {
    await renderWithProviders(<QuickPlotCard landscape panel={{ side: 'left', size: 320 }} />);
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ left: 320 + EDGE });
  });

  it.each([[false], [true]])('fits its content, its buttons sharing the row under the grid, with nothing beside the grid (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    expect(screen.getByTestId('quick-plot-card').props.style).not.toHaveProperty('width');
    for (const label of ['Clear', 'Save']) expect(screen.getByLabelText(label).props.className).toContain('flex-1');
    // Every button is in the row: the old trash beside the grid is gone.
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText('Save'));
    // Never flex-1 after Save: its zero basis let the labels shrink, and Cancel, alone in a column, stretched tall.
    for (const label of ['Save unit', 'Save point', 'Cancel']) expect(screen.getByLabelText(label).props.className).not.toContain('flex-1');
  });

  /** After Save in portrait, with the three measured `lineWidth` wide on one line. */
  async function savingInPortrait(lineWidth: number) {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Save'));
    // Unseen until measured, so it never shows one layout and then the other.
    expect(screen.getByTestId('quick-plot-card')).toHaveStyle({ opacity: 0 });
    const measure = screen.getByTestId('quick-plot-card-measure', { includeHiddenElements: true });
    await fireEvent(measure, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: lineWidth, height: 40 } } });
    expect(screen.getByTestId('quick-plot-card')).not.toHaveStyle({ opacity: 0 });
  }

  it('in landscape puts all three on one line, Cancel at the far right, never wrapping (that left a gap below)', async () => {
    await renderWithProviders(<QuickPlotCard landscape />);
    await fireEvent.press(screen.getByLabelText('Save'));
    const row = screen.getByTestId('quick-plot-card-buttons');
    expect(row.props.className).toMatch(/\bflex-row\b/);
    expect(row.props.className).not.toContain('flex-wrap');
    expect(within(row).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Save unit', 'Save point', 'Cancel']);
    expect(screen.queryByTestId('quick-plot-card-saves')).toBeNull();
    expect(screen.queryByTestId('quick-plot-card-measure', { includeHiddenElements: true })).toBeNull();
    for (const label of ['Save unit', 'Save point', 'Cancel']) expect(screen.getByLabelText(label).props.className).toMatch(/\bgrow\b/);
  });

  it('in portrait puts all three on one line when they fit', async () => {
    await savingInPortrait(120);
    expect(screen.getByTestId('quick-plot-card-buttons').props.className).toMatch(/\bflex-row\b/);
    expect(screen.queryByTestId('quick-plot-card-saves')).toBeNull();
  });

  it('in portrait puts Cancel below the saves when the line would not fit, across the card but no taller', async () => {
    await savingInPortrait(5000);
    expect(screen.getByTestId('quick-plot-card-buttons').props.className).not.toMatch(/\bflex-row\b/);
    const saves = within(screen.getByTestId('quick-plot-card-saves'));
    for (const label of ['Save unit', 'Save point']) expect(saves.getByLabelText(label)).toBeTruthy();
    expect(saves.queryByLabelText('Cancel')).toBeNull();
    // Stretched across by the column, not grown: growing in a column made it tall.
    expect(screen.getByLabelText('Cancel').props.className).not.toMatch(/\b(grow|flex-1)\b/);
  });

  it.each([[false], [true]])('puts the grid on its own line, above the buttons (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    const buttons = within(screen.getByTestId('quick-plot-card-buttons'));
    for (const label of ['Clear', 'Save']) expect(buttons.getByLabelText(label)).toBeTruthy();
    expect(buttons.queryByText(formatCoordinate(T, 'mgrs'))).toBeNull();
    expect(screen.getByText(formatCoordinate(T, 'mgrs'))).toBeTruthy();
  });

  it.each([[false], [true]])('sizes its buttons as on the other map cards: 40 pt tall, 8 pt corners (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    const asOtherCards = (label: string) => expect(screen.getByLabelText(label).props.className).toMatch(/\bh-10\b.*\brounded-lg\b/);
    ['Clear', 'Save'].forEach(asOtherCards);
    await fireEvent.press(screen.getByLabelText('Save'));
    ['Cancel', 'Save unit', 'Save point'].forEach(asOtherCards);
  });

  it('gives every button label the same size, the amber ones a weight heavier', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const size = (label: string) => within(screen.getByLabelText(label)).getByText(label).props.className as string;
    expect(size('Save')).toMatch(/\btext-sm\b/);
    expect(size('Clear')).toMatch(/\btext-sm\b/);
    await fireEvent.press(screen.getByLabelText('Save'));
    for (const label of ['Save unit', 'Save point', 'Cancel']) {
      expect(size(label)).toMatch(/\btext-sm\b/);
      expect(size(label)).not.toMatch(/\btext-(lg|base|xl)\b/);
    }
    expect(size('Save point')).toMatch(/\bfont-bold\b/);
    for (const label of ['Save unit', 'Cancel']) expect(size(label)).toMatch(/\bfont-semibold\b/);
  });

  it('keeps the grid as far in from the right border as TEMP is from the left', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByTestId('quick-plot-header').props.className).toMatch(/\bpx-2\b/);
  });

  it('reads TEMP, then the grid, then its altitude under it', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByTestId('quick-plot-card')).toHaveTextContent(new RegExp(`^TEMP${formatCoordinate(T, 'mgrs')}ALT`));
  });

  it('shows the ground altitude under the grid once the terrain answers, a dash until then', async () => {
    jest.useFakeTimers();
    const source = jest.fn(async () => 312.4);
    setElevationSource(source);
    try {
      await renderWithProviders(<QuickPlotCard landscape={false} />);
      expect(screen.getByTestId('quick-plot-altitude')).toHaveTextContent('ALT —');
      await act(async () => jest.advanceTimersByTime(400));
      expect(screen.getByTestId('quick-plot-altitude')).toHaveTextContent('ALT 312 m');
      expect(screen.getByTestId('quick-plot-altitude').props.className).toContain('text-value-altitude');
      // Found on the first lookup: no second one.
      await act(async () => jest.advanceTimersByTime(2000));
      expect(source).toHaveBeenCalledTimes(1);
    } finally {
      setElevationSource(null);
      jest.useRealTimers();
    }
  });

  it('looks the altitude up once more when the terrain had not loaded yet', async () => {
    jest.useFakeTimers();
    const source = jest.fn().mockResolvedValueOnce(null).mockResolvedValue(90);
    setElevationSource(source);
    try {
      await renderWithProviders(<QuickPlotCard landscape={false} />);
      await act(async () => jest.advanceTimersByTime(400));
      expect(screen.getByTestId('quick-plot-altitude')).toHaveTextContent('ALT —');
      await act(async () => jest.advanceTimersByTime(1100));
      expect(screen.getByTestId('quick-plot-altitude')).toHaveTextContent('ALT 90 m');
    } finally {
      setElevationSource(null);
      jest.useRealTimers();
    }
  });

  it('is see-through, keeps its amber border and outlines the grid', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const card = screen.getByTestId('quick-plot-card').props.className as string;
    expect(card).toContain('bg-surface-glass');
    expect(card).toContain('border-accent');
    expect(screen.getByText(formatCoordinate(T, 'mgrs'))).toHaveStyle({ textShadowRadius: 3 });
  });

  it('has the other map cards\' 16 pt corners and 8 pt inset (1 pt border, 7 pt padding), concentric with its buttons', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const card = screen.getByTestId('quick-plot-card').props.className as string;
    expect(card).toMatch(/\brounded-2xl\b/);
    expect(card).toMatch(/\bp-\[7px\]/);
    expect(card).toMatch(/\bborder\b/);
  });
});
