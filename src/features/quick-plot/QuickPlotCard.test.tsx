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
    expect(screen.getByText('TEMP POINT')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Clear'));
    expect(useQuickPlot.getState().temp).toBeNull();
  });

  it('offers Clear and Save, then Unit and Point under SAVE TEMP POINT AS, with the grid still showing', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const labels = () => within(screen.getByTestId('quick-plot-card-buttons')).getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels()).toEqual(['Clear', 'Save']);
    expect(screen.getByText('TEMP POINT')).toBeTruthy();
    expect(screen.getByText('not saved')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(labels()).toEqual(['Unit', 'Point']);
    expect(screen.getByText('SAVE TEMP POINT AS')).toBeTruthy();
    expect(screen.queryByText('TEMP POINT')).toBeNull();
    expect(screen.getByText(formatCoordinate(T, 'mgrs'))).toBeTruthy();
    expect(screen.getByTestId('quick-plot-altitude')).toBeTruthy();
    // Still the same point: nothing saved or cleared yet.
    expect(useQuickPlot.getState().temp).toEqual(T);
  });

  it('the header ✕ clears the point, as Clear does', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(within(screen.getByTestId('quick-plot-header')).getByLabelText('Cancel')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(useQuickPlot.getState().temp).toBeNull();
  });

  it('starts again from Save and Clear for a new point', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    await fireEvent.press(screen.getByLabelText('Save'));
    await act(async () => useQuickPlot.getState().plot({ lat: 38.92, lon: -77 }));
    expect(screen.getByLabelText('Save')).toBeTruthy();
    expect(screen.queryByLabelText('Unit')).toBeNull();
  });

  it.each([
    ['Unit', 'unit.add'],
    ['Point', 'point.add'],
  ] as const)('%s opens %s at the temporary point and ends quick plot', async (label, id) => {
    await renderWithProviders(<QuickPlotCard landscape />);
    await fireEvent.press(screen.getByLabelText('Save'));
    await fireEvent.press(screen.getByLabelText(label));
    expect(useMenu.getState().stack).toEqual([{ id, params: { at: T } }]);
    expect(useQuickPlot.getState().temp).toBeNull();
  });


  it('in landscape leaves the zoom column clear', async () => {
    await renderWithProviders(<QuickPlotCard landscape />);
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ right: EDGE + CONTROL_SIZE + GAP });
  });

  it('in landscape sits beside your grid card', async () => {
    useMapChrome.getState().setSelfCard({ width: 250, height: 64 });
    await renderWithProviders(<QuickPlotCard landscape />);
    // Your card is bottom right under zoom, so the card sits left of it.
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ bottom: EDGE, left: EDGE, right: EDGE + 250 + GAP });
  });

  it('in portrait spans the controls\' width as far in as the grid display, up to a tablet\'s max width, centered', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const slot = screen.getByTestId('quick-plot-card-slot');
    // Not positioned itself: MissionMap puts it in the map controls' bar slot.
    expect(slot.props.className).not.toContain('absolute');
    expect(slot.props.className).toMatch(/\bself-stretch\b/);
    expect(slot.props.className).toMatch(/\bitems-center\b/);
    // The grid display's 8 pt margin (mx-2).
    expect(slot.props.className).toMatch(/\bpx-2\b/);
    expect(screen.getByTestId('quick-plot-card')).toHaveStyle({ width: '100%', maxWidth: 520 });
  });

  it('in landscape sits flush bottom left, where the center card goes', async () => {
    await renderWithProviders(<QuickPlotCard landscape />);
    expect(screen.getByTestId('quick-plot-card-slot').props.className).toContain('items-start');
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ left: EDGE, bottom: EDGE });
  });

  it('in landscape keeps right of an open drawer, like the center card', async () => {
    await renderWithProviders(<QuickPlotCard landscape panel={{ side: 'left', size: 320 }} />);
    expect(screen.getByTestId('quick-plot-card-slot')).toHaveStyle({ left: 320 + EDGE });
  });

  it.each([[false], [true]])('shares each row of buttons evenly, under the grid and its altitude (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    const row = within(screen.getByTestId('quick-plot-grid-row'));
    expect(row.getByText(formatCoordinate(T, 'mgrs'))).toBeTruthy();
    expect(row.getByTestId('quick-plot-altitude')).toBeTruthy();
    for (const label of ['Clear', 'Save']) expect(screen.getByLabelText(label).props.className).toMatch(/\bflex-1\b/);
    await fireEvent.press(screen.getByLabelText('Save'));
    for (const label of ['Unit', 'Point']) expect(screen.getByLabelText(label).props.className).toMatch(/\bflex-1\b/);
  });

  it.each([[false], [true]])('sizes its buttons as on the other map cards: 40 pt tall, 8 pt corners (landscape=%s)', async (landscape) => {
    await renderWithProviders(<QuickPlotCard landscape={landscape} />);
    const asOtherCards = (label: string) => expect(screen.getByLabelText(label).props.className).toMatch(/\bh-10\b.*\brounded-lg\b/);
    ['Clear', 'Save'].forEach(asOtherCards);
    await fireEvent.press(screen.getByLabelText('Save'));
    ['Unit', 'Point'].forEach(asOtherCards);
  });

  it('gives every button label the same size, the amber one a weight heavier', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const size = (label: string) => within(screen.getByLabelText(label)).getByText(label).props.className as string;
    expect(size('Save')).toMatch(/\btext-sm\b.*\bfont-bold\b/);
    expect(size('Clear')).toMatch(/\btext-sm\b.*\bfont-semibold\b/);
    await fireEvent.press(screen.getByLabelText('Save'));
    for (const label of ['Unit', 'Point']) expect(size(label)).toMatch(/\btext-sm\b.*\bfont-semibold\b/);
  });

  it('heads the card with an amber strip, its text lined up with the grid, like the Average header', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const header = screen.getByTestId('quick-plot-header').props.className as string;
    expect(header).toMatch(/\bbg-accent-header\b/);
    // Over near-black, so the see-through amber reads a shade darker than accent-subtle.
    expect(screen.getByTestId('quick-plot-header').parent?.props.className).toMatch(/\bborder-b\b.*\bborder-accent-header-line\b.*\bbg-surface-input\b/);
    // 16 pt in, as the grid is (the body's 8 pt plus its own 8 pt).
    expect(header).toMatch(/\bpl-4\b/);
    expect(screen.getByTestId('quick-plot-grid-row').props.className).toMatch(/\bpx-2\b/);
    expect(screen.getByText('TEMP POINT').props.className).toMatch(/\bfont-mono-bold\b.*\btext-xs\b.*\btext-accent\b/);
  });

  it('reads TEMP POINT, then the grid, then its altitude', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByTestId('quick-plot-card')).toHaveTextContent(new RegExp(`TEMP POINTnot saved${formatCoordinate(T, 'mgrs')}ALT`));
  });

  it('shows the ground altitude beside the grid once the terrain answers, a dash until then', async () => {
    jest.useFakeTimers();
    const source = jest.fn(async () => 312.4);
    setElevationSource(source);
    try {
      await renderWithProviders(<QuickPlotCard landscape={false} />);
      expect(screen.getByTestId('quick-plot-altitude')).toHaveTextContent('ALT —');
      await act(async () => jest.advanceTimersByTime(400));
      expect(screen.getByTestId('quick-plot-altitude')).toHaveTextContent('ALT 312 m');
      // ALT muted, the value in the altitude color, as in the readout dock.
      expect(within(screen.getByTestId('quick-plot-altitude')).getByText('312 m').props.className).toContain('text-value-altitude');
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

  it('is see-through, framed in dark grey, not amber, and outlines the grid', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const card = screen.getByTestId('quick-plot-card').props.className as string;
    expect(card).toContain('bg-surface-glass');
    expect(card).toMatch(/\bborder border-border\b/);
    expect(card).not.toContain('border-accent');
    expect(screen.getByText(formatCoordinate(T, 'mgrs'))).toHaveStyle({ textShadowRadius: 3 });
  });

  it('has the other map cards\' 16 pt corners, and an 8 pt inset around its 8 pt buttons, concentric', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    const card = screen.getByTestId('quick-plot-card').props.className as string;
    expect(card).toMatch(/\brounded-2xl\b/);
    expect(card).toMatch(/\boverflow-hidden\b/);
    expect(screen.getByTestId('quick-plot-card-buttons').parent?.props.className).toMatch(/\bp-2\b/);
  });
});
