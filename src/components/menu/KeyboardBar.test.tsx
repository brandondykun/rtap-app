import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { FocusedInputEvents, KeyboardController } from 'react-native-keyboard-controller';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { KeyboardBar } from './KeyboardBar';

const bar = (landscape = false) => (
  <ThemeProvider theme="dark">
    <KeyboardBar landscape={landscape} />
  </ThemeProvider>
);
const renderBar = () => render(bar());

afterEach(() => jest.restoreAllMocks());

describe('KeyboardBar', () => {
  it('moves to the previous and next field, and Done closes the keyboard', async () => {
    const setFocusTo = jest.spyOn(KeyboardController, 'setFocusTo');
    const dismiss = jest.spyOn(KeyboardController, 'dismiss');
    let focusDidSet: (e: { current: number; count: number }) => void = () => {};
    jest.spyOn(FocusedInputEvents, 'addListener').mockImplementation((_name, cb) => {
      focusDidSet = cb;
      return { remove: () => {} } as ReturnType<typeof FocusedInputEvents.addListener>;
    });
    await renderBar();
    await act(async () => focusDidSet({ current: 1, count: 3 }));
    await fireEvent.press(screen.getByLabelText('Previous field'));
    await fireEvent.press(screen.getByLabelText('Next field'));
    expect(setFocusTo.mock.calls).toEqual([['prev'], ['next']]);
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(dismiss).toHaveBeenCalled();
  });

  it('disables the arrow with no field that way', async () => {
    let focusDidSet: (e: { current: number; count: number }) => void = () => {};
    jest.spyOn(FocusedInputEvents, 'addListener').mockImplementation((_name, cb) => {
      focusDidSet = cb;
      return { remove: () => {} } as ReturnType<typeof FocusedInputEvents.addListener>;
    });
    await renderBar();
    await act(async () => focusDidSet({ current: 0, count: 2 }));
    expect(screen.getByLabelText('Previous field')).toBeDisabled();
    expect(screen.getByLabelText('Next field')).not.toBeDisabled();
    await act(async () => focusDidSet({ current: 1, count: 2 }));
    expect(screen.getByLabelText('Previous field')).not.toBeDisabled();
    expect(screen.getByLabelText('Next field')).toBeDisabled();
  });

  it('fits its buttons, at the right, not across the screen; in portrait further in and higher above the keyboard', async () => {
    const { rerender } = await renderBar();
    const portrait = screen.getByTestId('keyboard-bar').props;
    expect(StyleSheet.flatten(portrait.style).left).toBeUndefined();
    await rerender(bar(true));
    const landscape = screen.getByTestId('keyboard-bar').props;
    expect(StyleSheet.flatten(landscape.style).left).toBeUndefined();
    expect(StyleSheet.flatten(portrait.style).right).toBeGreaterThan(StyleSheet.flatten(landscape.style).right);
    expect(portrait.offset.opened).toBeLessThan(landscape.offset.opened);
  });
});
