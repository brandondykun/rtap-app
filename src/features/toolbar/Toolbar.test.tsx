import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

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
    await screen.unmount();
    useSettings.getState().setShowToolbarText(false);
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} onUnit={onUnit} />);
    expect(screen.queryByText('UNIT')).toBeNull();
    await fireEvent.press(screen.getByLabelText('UNIT'));
    expect(onUnit).toHaveBeenCalled();
  });

  it('spans the width in portrait', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} />);
    expect(style().left).toBeDefined();
    expect(style().right).toBeDefined();
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
    expect(screen.getByLabelText('Settings')).toBeDisabled();
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
});
