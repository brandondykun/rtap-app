import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { TOOLBAR_HEIGHT, TOOLBAR_HEIGHT_ICONS } from '@/features/map/layout';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { Toolbar } from './Toolbar';

function style() {
  return StyleSheet.flatten(screen.getByTestId('toolbar').props.style);
}

beforeEach(() => useSettings.setState(DEFAULT_SETTINGS));

describe('Toolbar', () => {
  it('shows the tool labels, or only icons when toolbar text is off (labels stay for accessibility)', async () => {
    const onUnit = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} onUnit={onUnit} />);
    expect(screen.getByText('UNIT')).toBeTruthy();
    expect(style().height).toBe(TOOLBAR_HEIGHT);
    await screen.unmount();
    useSettings.getState().setShowToolbarText(false);
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} onUnit={onUnit} />);
    expect(screen.queryByText('UNIT')).toBeNull();
    expect(style().height).toBe(TOOLBAR_HEIGHT_ICONS);
    await fireEvent.press(screen.getByLabelText('UNIT'));
    expect(onUnit).toHaveBeenCalled();
  });

  it('spans the width in portrait', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} />);
    expect(style().left).toBeDefined();
    expect(style().right).toBeDefined();
  });

  it('clips the portrait tools right at the divider after Menu: no margin on its inner side', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} />);
    expect(screen.getByTestId('divider-start').props.className).toContain('ml-1.5');
    expect(screen.getByTestId('divider-start').props.className).not.toContain('mr-1.5');
  });

  it('clips its contents to its rounded ends, so the end shade never pokes past the curve', async () => {
    for (const landscape of [false, true]) {
      await renderWithProviders(<Toolbar landscape={landscape} activeTool={null} />);
      expect(screen.getByTestId('toolbar').props.className).toContain('rounded-2xl');
      expect(screen.getByTestId('toolbar').props.className).toContain('overflow-hidden');
    }
  });

  it('rounds like the other map panels, with each tool highlight concentric inside its curve', async () => {
    for (const showText of [true, false]) {
      useSettings.setState({ showToolbarText: showText });
      await renderWithProviders(<Toolbar landscape={false} activeTool="unit" />);
      expect(screen.getByTestId('toolbar').props.className).toContain('rounded-2xl');
      const tool = screen.getByLabelText('UNIT');
      // 4 pt from the bar's top and bottom: the 16 pt bar corner less 4 is the tool's 12 pt (rounded-xl).
      expect(StyleSheet.flatten(tool.props.style).height).toBe(style().height - 8);
      expect(tool.props.className).toContain('rounded-xl');
      await screen.unmount();
    }
  });

  it('pads its ends as much as its top and bottom (4 pt), the portrait tools running under the right end', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} />);
    const bar = screen.getByTestId('toolbar').props.className as string;
    expect(bar).not.toMatch(/\b(px|pl|pr)-/);
    expect(style()).toMatchObject({ paddingLeft: 4 });
    expect(style().paddingRight).toBeUndefined();
    // The right end's padding is inside the scroll content, so the tools scroll right up to the curve.
    expect(screen.getByTestId('toolbar-tools').props.contentContainerStyle).toMatchObject({ paddingLeft: 6, paddingRight: 4 });
  });

  it('pads both ends 4 pt in landscape (nothing scrolls)', async () => {
    await renderWithProviders(<Toolbar landscape activeTool={null} />);
    expect(screen.getByTestId('toolbar').props.className).not.toMatch(/\b(px|pl|pr)-/);
    expect(style()).toMatchObject({ paddingLeft: 4, paddingRight: 4 });
  });

  it('sizes Menu like the tools: 4 pt from the top and bottom', async () => {
    for (const showText of [true, false]) {
      useSettings.setState({ showToolbarText: showText });
      await renderWithProviders(<Toolbar landscape={false} activeTool={null} onMenu={() => {}} />);
      const menu = StyleSheet.flatten(screen.getByLabelText('Menu').props.style);
      expect(menu).toMatchObject({ height: style().height - 8, width: style().height - 8 });
      await screen.unmount();
    }
  });

  it('has no divider at the end: nothing follows the tools', async () => {
    for (const landscape of [false, true]) {
      await renderWithProviders(<Toolbar landscape={landscape} activeTool={null} />);
      expect(screen.queryByTestId('divider-end')).toBeNull();
    }
  });

  /** The divider turns a softer white while tools hide behind it. */
  const lit = () => {
    const color = StyleSheet.flatten(screen.getByTestId('divider-start').props.style).backgroundColor;
    expect([themeColors('dark')['text-muted'], themeColors('dark').border]).toContain(color);
    return color === themeColors('dark')['text-muted'];
  };

  it('shades the hidden side and brightens the divider while tools are scrolled out of sight behind it', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} />);
    const tools = screen.getByTestId('toolbar-tools');
    // Everything fits: no shade.
    await fireEvent(tools, 'layout', { nativeEvent: { layout: { width: 300, height: 40 } } });
    await fireEvent(tools, 'contentSizeChange', 300, 40);
    expect(screen.queryByTestId('toolbar-shade-start')).toBeNull();
    expect(screen.queryByTestId('toolbar-shade-end')).toBeNull();
    expect(lit()).toBe(false);
    // Overflowing at rest: tools hide at the end only.
    await fireEvent(tools, 'contentSizeChange', 500, 40);
    expect(screen.queryByTestId('toolbar-shade-start')).toBeNull();
    expect(screen.getByTestId('toolbar-shade-end')).toBeTruthy();
    expect(lit()).toBe(false);
    const scroll = (x: number) => ({ nativeEvent: { contentOffset: { x, y: 0 }, contentSize: { width: 500, height: 40 }, layoutMeasurement: { width: 300, height: 40 } } });
    // Midway: both sides.
    await fireEvent.scroll(tools, scroll(100));
    expect(screen.getByTestId('toolbar-shade-start')).toBeTruthy();
    expect(screen.getByTestId('toolbar-shade-end')).toBeTruthy();
    expect(lit()).toBe(true);
    // At the end: only the start.
    await fireEvent.scroll(tools, scroll(200));
    expect(screen.getByTestId('toolbar-shade-start')).toBeTruthy();
    expect(screen.queryByTestId('toolbar-shade-end')).toBeNull();
    expect(lit()).toBe(true);
  });

  it('anchors top-right and sizes to content in landscape', async () => {
    await renderWithProviders(<Toolbar landscape activeTool={null} />);
    expect(style().left).toBeUndefined();
    expect(style().right).toBeDefined();
  });

  it('runs handlers and disables tools without one', async () => {
    const onMenu = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} onMenu={onMenu} />);
    await fireEvent.press(screen.getByLabelText('Menu'));
    expect(onMenu).toHaveBeenCalled();
    expect(screen.getByLabelText('POINT')).toBeDisabled();
  });

  it('marks the active tool', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool="point" onPoint={jest.fn()} />);
    expect(screen.getByLabelText('POINT')).toBeSelected();
    expect(screen.getByLabelText('POINT')).not.toBeDisabled();
  });

  it('has a LAYERS tool that runs its handler and shows when active', async () => {
    const onLayers = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="layers" onLayers={onLayers} />);
    expect(screen.getByLabelText('LAYERS')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('LAYERS'));
    expect(onLayers).toHaveBeenCalled();
  });

  it('orders UNIT, POINT, LAYERS and marks the active one', async () => {
    const onUnit = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="unit" onUnit={onUnit} onPoint={jest.fn()} onLayers={jest.fn()} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.filter((l) => ['UNIT', 'POINT', 'LAYERS'].includes(l))).toEqual(['UNIT', 'POINT', 'LAYERS']);
    expect(screen.getByLabelText('UNIT')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('UNIT'));
    expect(onUnit).toHaveBeenCalled();
  });

  it('orders UNIT, POINT, LINE, LAYERS and marks LINE active', async () => {
    const onLine = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="line" onUnit={jest.fn()} onPoint={jest.fn()} onLine={onLine} onLayers={jest.fn()} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.filter((l) => ['UNIT', 'POINT', 'LINE', 'LAYERS'].includes(l))).toEqual(['UNIT', 'POINT', 'LINE', 'LAYERS']);
    expect(screen.getByLabelText('LINE')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('LINE'));
    expect(onLine).toHaveBeenCalled();
  });

  it('orders UNIT, POINT, LINE, MEASURE, LAYERS and marks MEASURE active', async () => {
    const onMeasure = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="measure" onUnit={jest.fn()} onPoint={jest.fn()} onLine={jest.fn()} onMeasure={onMeasure} onLayers={jest.fn()} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.filter((l) => ['UNIT', 'POINT', 'LINE', 'MEASURE', 'LAYERS'].includes(l))).toEqual(['UNIT', 'POINT', 'LINE', 'MEASURE', 'LAYERS']);
    expect(screen.getByLabelText('MEASURE')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('MEASURE'));
    expect(onMeasure).toHaveBeenCalled();
  });

  it('orders UNIT, POINT, LINE, POLYGON, MEASURE, LAYERS and marks POLYGON active', async () => {
    const onPolygon = jest.fn();
    await renderWithProviders(
      <Toolbar landscape={false} activeTool="polygon" onUnit={jest.fn()} onPoint={jest.fn()} onLine={jest.fn()} onPolygon={onPolygon} onMeasure={jest.fn()} onLayers={jest.fn()} />,
    );
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.filter((l) => ['UNIT', 'POINT', 'LINE', 'POLYGON', 'MEASURE', 'LAYERS'].includes(l))).toEqual(['UNIT', 'POINT', 'LINE', 'POLYGON', 'MEASURE', 'LAYERS']);
    expect(screen.getByLabelText('POLYGON')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('POLYGON'));
    expect(onPolygon).toHaveBeenCalled();
  });

  it('ends with PLOT after LAYERS and marks it active', async () => {
    const onPlot = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="plot" onLayers={jest.fn()} onPlot={onPlot} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.filter((l) => ['LAYERS', 'PLOT'].includes(l))).toEqual(['LAYERS', 'PLOT']);
    expect(screen.getByLabelText('PLOT')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('PLOT'));
    expect(onPlot).toHaveBeenCalled();
  });

  it('has a LABELS toggle that swaps its icon, with no highlight', async () => {
    const onLabels = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} onPlot={jest.fn()} labelsOn onLabels={onLabels} />);
    const order = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    // Settings lives in the Menu.
    expect(order.slice(-4)).toEqual(['PLOT', 'LABELS', '3D', 'OP']);
    expect(screen.queryByLabelText('Settings')).toBeNull();
    expect(screen.getByText('LABELS')).toBeTruthy();
    const on = screen.getByLabelText('LABELS');
    expect(on).toBeSelected();
    expect(on.props.className).not.toContain('bg-accent-subtle');
    // Inside the scrolling tools.
    expect(screen.getByTestId('toolbar').children).not.toContain(on);
    await fireEvent.press(on);
    expect(onLabels).toHaveBeenCalled();
    await screen.unmount();
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} labelsOn={false} onLabels={onLabels} />);
    expect(screen.getByLabelText('LABELS')).not.toBeSelected();
  });

  it('ends the tools with a 3D toggle that swaps its icon, with no highlight', async () => {
    const on3d = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} threeDOn onThreeD={on3d} />);
    const button = screen.getByLabelText('3D');
    expect(screen.getByText('3D')).toBeTruthy();
    expect(button).toBeSelected();
    expect(button.props.className).not.toContain('bg-accent-subtle');
    await fireEvent.press(button);
    expect(on3d).toHaveBeenCalled();
    await screen.unmount();
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} threeDOn={false} onThreeD={on3d} />);
    expect(screen.getByLabelText('3D')).not.toBeSelected();
  });

  it('OP comes after 3D and highlights while active', async () => {
    const onOp = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="op" onOp={onOp} />);
    const order = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(order.at(-1)).toBe('OP');
    expect(order.at(-2)).toBe('3D');
    expect(screen.getByLabelText('OP')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('OP'));
    expect(onOp).toHaveBeenCalled();
    await screen.unmount();
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} onOp={onOp} />);
    expect(screen.getByLabelText('OP')).not.toBeSelected();
  });

  it('is see-through with no border, and outlines its labels and icons', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} onUnit={() => {}} />);
    const bar = screen.getByTestId('toolbar').props.className as string;
    expect(bar).toContain('bg-surface-glass');
    expect(bar).not.toContain('border');
    expect(screen.getByText('UNIT')).toHaveStyle({ textShadowRadius: 3 });
  });
});
