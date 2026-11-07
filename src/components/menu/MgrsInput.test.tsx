import { act, fireEvent, screen } from '@testing-library/react-native';

import { Platform, TextInput } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { EMPTY_MGRS, evaluateMgrsFields, fieldBefore, mgrsFieldsFor } from './mgrs-fields';
import { ANDROID_FOCUS_DELAY_MS, MgrsInput } from './MgrsInput';

const DC = { lat: 38.8977, lon: -77.0365 };

/** Which fields had focus() called on them (the TextInput mock records the instance). */
const focusedLabels = () => (TextInput.prototype.focus as jest.Mock).mock.contexts.map((c) => (c as { props: { accessibilityLabel: string } }).props.accessibilityLabel);
beforeEach(() => (TextInput.prototype.focus as jest.Mock).mockClear());

describe('MgrsInput', () => {
  it('shows the four fields and a valid status line', async () => {
    const parts = mgrsFieldsFor(DC);
    await renderWithProviders(<MgrsInput value={parts} onChange={jest.fn()} status={evaluateMgrsFields(parts)} validDetail="1.15 km @ 103° GRID" />);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue(parts.zoneBand);
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(parts.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Valid · 1.15 km @ 103° GRID');
    // The distance and direction are white, not muted gray, so they read easily.
    expect(screen.getByTestId('mgrs-status').props.className).toContain('text-text');
    expect(screen.getByTestId('mgrs-status').props.className).not.toContain('text-text-muted');
  });

  it('hides its status line with showStatus={false}', async () => {
    const parts = mgrsFieldsFor(DC);
    await renderWithProviders(<MgrsInput value={parts} onChange={jest.fn()} status={evaluateMgrsFields(parts)} showStatus={false} />);
    expect(screen.queryByTestId('mgrs-status')).toBeNull();
    expect(screen.getByLabelText('Easting')).toBeTruthy();
  });

  it('uppercases letters and strips non-digits', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={onChange} status={{ status: 'empty' }} />);
    await fireEvent.changeText(screen.getByLabelText('100 km square'), 'uj');
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MGRS, square: 'UJ' });
    await fireEvent.changeText(screen.getByLabelText('Easting'), '23 3a9');
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MGRS, easting: '2339' });
  });

  it('spreads a full reference pasted into the zone field', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={onChange} status={{ status: 'empty' }} />);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), '18S UJ 23394 07395');
    expect(onChange).toHaveBeenLastCalledWith({ zoneBand: '18S', square: 'UJ', easting: '23394', northing: '07395' });
  });

  it('explains an invalid reference', async () => {
    await renderWithProviders(
      <MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'invalid', message: 'Grid zone does not match the square and digits' }} />,
    );
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Grid zone does not match the square and digits');
  });

  it('submits from the northing field', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'empty' }} onSubmit={onSubmit} />);
    await fireEvent(screen.getByLabelText('Northing'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows no status line until the grid is valid or wrong', async () => {
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'empty' }} />);
    expect(screen.queryByTestId('mgrs-status')).toBeNull();
    await renderWithProviders(<MgrsInput value={{ ...EMPTY_MGRS, zoneBand: '18S' }} onChange={jest.fn()} status={{ status: 'incomplete' }} />);
    expect(screen.queryByTestId('mgrs-status')).toBeNull();
  });

  it('knows which field backspace hops back to', () => {
    expect(fieldBefore('zone')).toBeNull();
    expect(fieldBefore('square')).toBe('zone');
    expect(fieldBefore('easting')).toBe('square');
    expect(fieldBefore('northing')).toBe('easting');
  });

  it('on Android, focuses a moment after mounting so the keyboard opens too', async () => {
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await renderWithProviders(<MgrsInput value={{ ...EMPTY_MGRS, zoneBand: '18S', square: 'UJ' }} onChange={jest.fn()} status={{ status: 'incomplete' }} autoFocus="easting" />);
      expect(focusedLabels()).toEqual([]);
      await act(async () => jest.advanceTimersByTime(ANDROID_FOCUS_DELAY_MS));
      expect(focusedLabels()).toEqual(['Easting']);
    } finally {
      jest.restoreAllMocks();
      jest.useRealTimers();
    }
  });

  it('wires backspace on empty fields and the requested autofocus', async () => {
    await renderWithProviders(<MgrsInput value={{ ...EMPTY_MGRS, zoneBand: '18S', square: 'UJ' }} onChange={jest.fn()} status={{ status: 'incomplete' }} autoFocus="easting" />);
    // Focused once from code, never through the native autoFocus prop: iOS re-applies that whenever
    // it rebuilds the field's view, which yanked focus to Easting and cancelled the first Plot tap.
    for (const label of ['MGRS zone', '100 km square', 'Easting', 'Northing']) expect(screen.getByLabelText(label).props.autoFocus).toBeFalsy();
    expect(focusedLabels()).toEqual(['Easting']);
    for (const label of ['100 km square', 'Easting', 'Northing']) expect(screen.getByLabelText(label).props.onKeyPress).toEqual(expect.any(Function));
    // No crash on backspace in an empty field (focus moves natively; checked on device).
    await fireEvent(screen.getByLabelText('Easting'), 'keyPress', { nativeEvent: { key: 'Backspace' } });
  });


  it('offers the return key on Android only when the form submits on it', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'empty' }} />);
      expect(screen.getByLabelText('Northing').props.returnKeyType).toBeUndefined();
      await screen.unmount();
      await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'empty' }} onSubmit={jest.fn()} />);
      expect(screen.getByLabelText('Northing')).toHaveProp('returnKeyType', 'done');
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('never gives the iPhone number pad a return key type, which would add React Native\'s own Done toolbar under ours', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'empty' }} onSubmit={jest.fn()} />);
      expect(screen.getByLabelText('Northing').props.returnKeyType).toBeUndefined();
    } finally {
      jest.restoreAllMocks();
    }
  });
});
