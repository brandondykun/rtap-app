import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { MenuActions } from './MenuActions';
import { MenuButton } from './MenuButton';
import { MenuHeader } from './MenuHeader';
import { MenuListItem } from './MenuListItem';
import { MenuRow } from './MenuRow';
import { MenuSection } from './MenuSection';
import { MenuToggle } from './MenuToggle';
import { MenuVertexRow } from './MenuVertexRow';

describe('menu primitives', () => {
  it('MenuHeader shows the title and runs both actions', async () => {
    const cancel = jest.fn();
    const add = jest.fn();
    await renderWithProviders(
      <MenuHeader title="Add point" leading={{ label: 'Cancel', onPress: cancel }} trailing={{ label: 'Add', icon: 'check', onPress: add }} />,
    );
    expect(screen.getByRole('header')).toHaveTextContent('Add point');
    await fireEvent.press(screen.getByText('Cancel'));
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(cancel).toHaveBeenCalled();
    expect(add).toHaveBeenCalled();
  });

  it('MenuHeader disables the primary action', async () => {
    const add = jest.fn();
    await renderWithProviders(<MenuHeader title="Add point" trailing={{ label: 'Add', onPress: add, disabled: true }} />);
    expect(screen.getByLabelText('Add')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(add).not.toHaveBeenCalled();
  });

  it('MenuSection renders its label and children', async () => {
    await renderWithProviders(
      <MenuSection label="Affiliation">
        <Text>child</Text>
      </MenuSection>,
    );
    expect(screen.getByText('Affiliation')).toBeTruthy();
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('MenuButton has a compact variant with less padding for map bars', async () => {
    await renderWithProviders(
      <>
        <MenuButton label="Normal" icon="close" onPress={() => {}} />
        <MenuButton label="Small" icon="close" onPress={() => {}} compact />
      </>,
    );
    expect(screen.getByLabelText('Normal').props.className).toContain('px-4 py-3');
    expect(screen.getByLabelText('Small').props.className).toContain('px-3 py-2');
    expect(screen.getByLabelText('Small').props.className).not.toContain('py-3');
  });

  it('MenuRow and MenuButton are pressable', async () => {
    const row = jest.fn();
    const button = jest.fn();
    await renderWithProviders(
      <>
        <MenuRow label="Switch mission" icon="swap-horizontal" onPress={row} />
        <MenuButton label="Center" icon="crosshairs" onPress={button} />
        <MenuButton label="Me" icon="crosshairs-gps" onPress={button} disabled />
      </>,
    );
    await fireEvent.press(screen.getByText('Switch mission'));
    await fireEvent.press(screen.getByText('Center'));
    expect(row).toHaveBeenCalledTimes(1);
    expect(button).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Me')).toBeDisabled();
  });

  it('MenuToggle reports the new value', async () => {
    const onValueChange = jest.fn();
    await renderWithProviders(<MenuToggle label="Hidden on map" value={false} onValueChange={onValueChange} />);
    await fireEvent(screen.getByLabelText('Hidden on map'), 'valueChange', true);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('MenuActions needs a second tap to confirm', async () => {
    const onConfirm = jest.fn();
    await renderWithProviders(
      <MenuActions destructive={{ label: 'Delete point', confirmLabel: 'Tap again to delete', onConfirm }} />,
    );
    await fireEvent.press(screen.getByText('Delete point'));
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Tap again to delete'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('MenuActions disarms after a pause and after confirming', async () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      await renderWithProviders(
        <MenuActions destructive={{ label: 'Delete point', confirmLabel: 'Tap again to delete', onConfirm }} />,
      );
      await fireEvent.press(screen.getByText('Delete point'));
      expect(screen.getByText('Tap again to delete')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      expect(screen.getByText('Delete point')).toBeTruthy();
      expect(onConfirm).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByText('Delete point'));
      await fireEvent.press(screen.getByText('Tap again to delete'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Delete point')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('MenuListItem has separate row and trailing targets', async () => {
    const onPress = jest.fn();
    const onEye = jest.fn();
    await renderWithProviders(
      <MenuListItem title="HOS-1" subtitle="Hidden · 18S UJ 1 2" onPress={onPress} trailing={{ icon: 'eye-off-outline', label: 'Show HOS-1', onPress: onEye }} dimmed />,
    );
    await fireEvent.press(screen.getByLabelText('Show HOS-1'));
    expect(onEye).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('HOS-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('HOS-1').props.accessibilityHint).toBe('Hidden · 18S UJ 1 2');
  });

  it('MenuVertexRow: row, remove and insert are separate targets; remove can be disabled', async () => {
    const onPress = jest.fn();
    const onRemove = jest.fn();
    const onInsertAfter = jest.fn();
    await renderWithProviders(
      <MenuVertexRow number={2} title="18S UJ 24250 07313" detail="+0.75 km" selected onPress={onPress} onRemove={onRemove} onInsertAfter={onInsertAfter} removeDisabled />,
    );
    expect(screen.getByLabelText('Point 2')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Insert after point 2'));
    expect(onInsertAfter).toHaveBeenCalled();
    expect(screen.getByLabelText('Remove point 2')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Point 2'));
    expect(onPress).toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('MenuSection: shows a trailing note on the label row', async () => {
    await renderWithProviders(
      <MenuSection label="Points · 2" trailing="2.03 km total">
        <Text>row</Text>
      </MenuSection>,
    );
    expect(screen.getByText('2.03 km total')).toBeTruthy();
  });

  it('MenuButton: iconOnly hides the text but keeps the label for accessibility', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<MenuButton label="Undo" icon="undo" iconOnly onPress={onPress} />);
    expect(screen.queryByText('Undo')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(onPress).toHaveBeenCalled();
  });
});
