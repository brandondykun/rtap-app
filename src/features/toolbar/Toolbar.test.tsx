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
});
