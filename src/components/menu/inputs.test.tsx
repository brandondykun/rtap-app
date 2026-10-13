import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { renderWithProviders } from '@/test-utils/render';

import { MenuSegmented } from './MenuSegmented';
import { MenuSelect } from './MenuSelect';

describe('menu inputs', () => {
  it('TextField passes text through', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<TextField accessibilityLabel="Name" value="HOS-1" onChangeText={onChangeText} />);
    expect(screen.getByDisplayValue('HOS-1')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    expect(onChangeText).toHaveBeenCalledWith('OBJ IRON');
  });

  it('MenuSegmented selects one option', async () => {
    const onChange = jest.fn();
    const options = [
      { value: 'deg', label: 'Degrees' },
      { value: 'mil', label: 'Mils' },
    ] as const;
    await renderWithProviders(<MenuSegmented options={[...options]} value="deg" onChange={onChange} />);
    expect(screen.getByLabelText('Degrees')).toBeSelected();
    expect(screen.getByLabelText('Mils')).not.toBeSelected();
    await fireEvent.press(screen.getByLabelText('Mils'));
    expect(onChange).toHaveBeenCalledWith('mil');
  });

  it('MenuSelect expands, picks and collapses', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <MenuSelect
        label="Unit type"
        options={[
          { value: 'unspecified', label: 'Unspecified' },
          { value: 'infantry', label: 'Infantry' },
        ]}
        value="unspecified"
        onChange={onChange}
      />,
    );
    expect(screen.queryByText('Infantry')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Unit type: Unspecified'));
    await fireEvent.press(screen.getByText('Infantry'));
    expect(onChange).toHaveBeenCalledWith('infantry');
    expect(screen.queryByText('Infantry')).toBeNull();
  });

  it('MenuSelect shows option icons in the list and the selected value', async () => {
    await renderWithProviders(
      <MenuSelect label="Type" options={[{ value: 'a', label: 'Alpha', icon: <Text>ICON-A</Text> }, { value: 'b', label: 'Bravo' }]} value="a" onChange={jest.fn()} />,
    );
    expect(screen.getByText('ICON-A')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Type: Alpha'));
    expect(screen.getAllByText('ICON-A')).toHaveLength(2);
  });
});
