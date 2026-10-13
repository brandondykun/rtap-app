import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { Toolbar } from './Toolbar';

function style() {
  return StyleSheet.flatten(screen.getByTestId('toolbar').props.style);
}

describe('Toolbar', () => {
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
});
