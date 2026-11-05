import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { renderWithProviders } from '@/test-utils/render';

import { MenuSegmented } from './MenuSegmented';
import { filterOptions, MenuSelect, SEARCH_MIN_OPTIONS } from './MenuSelect';
import { PanelScrollContext } from './panel-header-slot';

describe('menu inputs', () => {
  it('shows no suggestion strip over the keyboard unless a field asks for it', async () => {
    await renderWithProviders(
      <>
        <TextField accessibilityLabel="Plain" value="" onChangeText={() => {}} />
        <TextField accessibilityLabel="Prose" value="" onChangeText={() => {}} autoCorrect spellCheck />
      </>,
    );
    expect(screen.getByLabelText('Plain').props).toMatchObject({ autoCorrect: false, spellCheck: false, textContentType: 'none' });
    expect(screen.getByLabelText('Prose').props).toMatchObject({ autoCorrect: true, spellCheck: true });
  });

  it('TextField passes text through', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<TextField accessibilityLabel="Name" value="HOS-1" onChangeText={onChangeText} />);
    expect(screen.getByDisplayValue('HOS-1')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    expect(onChangeText).toHaveBeenCalledWith('OBJ IRON');
  });

  it('a clearable TextField has a clear button only while it has text and is editable', async () => {
    const onChangeText = jest.fn();
    const first = await renderWithProviders(<TextField clearable accessibilityLabel="Name" value="HOS-1" onChangeText={onChangeText} />);
    await fireEvent.press(screen.getByLabelText('Clear Name'));
    expect(onChangeText).toHaveBeenCalledWith('');
    await first.unmount();
    const empty = await renderWithProviders(<TextField clearable accessibilityLabel="Name" value="" onChangeText={onChangeText} />);
    expect(screen.queryByLabelText('Clear Name')).toBeNull();
    await empty.unmount();
    await renderWithProviders(<TextField clearable editable={false} accessibilityLabel="Name" value="HOS-1" onChangeText={onChangeText} />);
    expect(screen.queryByLabelText('Clear Name')).toBeNull();
  });

  it('a TextField with an icon draws it at the left', async () => {
    await renderWithProviders(<TextField icon="magnify" accessibilityLabel="Search" value="" onChangeText={jest.fn()} />);
    expect(screen.getByTestId('text-field-icon')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
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


  const LETTERS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].map((label) => ({ value: label.toLowerCase(), label, keywords: label.slice(0, 2).toUpperCase() + 'X' }));

  it('filters options by label or keywords, ignoring case and spaces', () => {
    expect(filterOptions(LETTERS, '').map((o) => o.label)).toHaveLength(8);
    expect(filterOptions(LETTERS, ' o ').map((o) => o.label)).toEqual(['Bravo', 'Echo', 'Foxtrot', 'Golf', 'Hotel']);
    expect(filterOptions(LETTERS, 'chx').map((o) => o.label)).toEqual(['Charlie']);
    expect(filterOptions(LETTERS, 'zulu')).toEqual([]);
  });

  it('MenuSelect searches a long list only, and starts each opening unfiltered', async () => {
    expect(LETTERS).toHaveLength(SEARCH_MIN_OPTIONS);
    const onChange = jest.fn();
    const first = await renderWithProviders(<MenuSelect label="Letter" options={LETTERS} value="alpha" onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Letter: Alpha'));
    await fireEvent.changeText(screen.getByLabelText('Search letter'), 'ot');
    expect(screen.queryByText('Bravo')).toBeNull();
    expect(screen.getByText('Hotel')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search letter'), 'zulu');
    expect(screen.getByText('No matches')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search letter'), 'fo');
    await fireEvent.press(screen.getByText('Foxtrot'));
    expect(onChange).toHaveBeenCalledWith('foxtrot');
    await fireEvent.press(screen.getByLabelText('Letter: Alpha'));
    expect(screen.getByLabelText('Search letter')).toHaveProp('value', '');
    expect(screen.getByText('Bravo')).toBeTruthy();
    await first.unmount();
    await renderWithProviders(<MenuSelect label="Short" options={LETTERS.slice(0, SEARCH_MIN_OPTIONS - 1)} value="alpha" onChange={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Short: Alpha'));
    expect(screen.queryByLabelText('Search short')).toBeNull();
  });

  it('MenuSelect keeps itself at the panel top while its search has the keyboard, until it closes', async () => {
    const undo = jest.fn();
    const anchorFocus = jest.fn(() => undo);
    await renderWithProviders(
      <PanelScrollContext.Provider value={{ scrollToEnd: jest.fn(), scrollToTop: jest.fn(), anchorFocus }}>
        <MenuSelect label="Letter" options={LETTERS} value="alpha" onChange={jest.fn()} />
      </PanelScrollContext.Provider>,
    );
    expect(anchorFocus).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Letter: Alpha'));
    expect(anchorFocus).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Letter: Alpha'));
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('TextField never switches Android to full-screen text editing in landscape', async () => {
    await renderWithProviders(<TextField accessibilityLabel="Field" value="" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('Field')).toHaveProp('disableFullscreenUI', true);
  });

  it('starts multiline text and its placeholder at the top, single-line text centred', async () => {
    await renderWithProviders(
      <>
        <TextField accessibilityLabel="Notes" multiline placeholder="Add notes" value="" onChangeText={jest.fn()} />
        <TextField accessibilityLabel="Name" value="" onChangeText={jest.fn()} />
      </>,
    );
    expect(screen.getByLabelText('Notes')).toHaveStyle({ textAlignVertical: 'top' });
    expect(screen.getByLabelText('Name')).toHaveStyle({ textAlignVertical: 'center' });
  });

  it('draws a 1 pt border on fields and selects, focused or not (only the colour changes)', async () => {
    const first = await renderWithProviders(<TextField accessibilityLabel="Field" value="" onChangeText={jest.fn()} />);
    const cls = () => String(screen.getByLabelText('Field').props.className);
    expect(cls()).toMatch(/(^| )border( |$)/);
    expect(cls()).not.toContain('border-2');
    await fireEvent(screen.getByLabelText('Field'), 'focus');
    expect(cls()).toContain('border-accent');
    expect(cls()).not.toContain('border-2');
    await first.unmount();
    await renderWithProviders(<MenuSelect label="Unit type" options={[{ value: 'a', label: 'Alpha' }]} value="a" onChange={jest.fn()} />);
    expect(String(screen.getByLabelText('Unit type: Alpha').props.className)).not.toContain('border-2');
  });
});
