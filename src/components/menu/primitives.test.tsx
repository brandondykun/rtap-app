import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { MenuActions } from './MenuActions';
import { MenuButton } from './MenuButton';
import { MenuHeader } from './MenuHeader';
import { MenuRow } from './MenuRow';
import { MenuSection } from './MenuSection';
import { MenuToggle } from './MenuToggle';

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
});
