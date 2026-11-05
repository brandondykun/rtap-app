import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform, TextInput } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';

import { ANDROID_FOCUS_DELAY_MS } from '@/components/menu/MgrsInput';
import { PanelScrollContext } from '@/components/menu/panel-header-slot';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { renderWithProviders } from '@/test-utils/render';

import { NotesPreview } from './NotesPreview';

const A = { lat: 38.9, lon: -77 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useDraft.getState().startEdit({ itemId: 'i1', coord: A, category: 'unit', pointType: 'checkpoint', affiliation: 'friend', unitType: 'armor', echelon: 'unspecified', name: 'FRD-1', notes: '' });
});
afterEach(() => jest.restoreAllMocks());

/** The preview in a panel, its notes then opened in place; returns the panel's scroll and a way to show the keyboard. */
async function openInPlace() {
  const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  // React Native's test setup already mocks focus, so calls from earlier tests would count too.
  focus.mockClear();
  let showKeyboard = () => {};
  jest.spyOn(KeyboardEvents, 'addListener').mockImplementation((name, cb) => {
    if (name === 'keyboardDidShow') showKeyboard = () => (cb as (e: unknown) => void)({});
    return { remove: () => {} } as ReturnType<typeof KeyboardEvents.addListener>;
  });
  const scrollFocusedToTop = jest.fn();
  await renderWithProviders(
    <PanelScrollContext.Provider value={{ scrollToEnd: jest.fn(), scrollToTop: jest.fn(), anchorFocus: jest.fn(), scrollFocusedToTop }}>
      <NotesPreview notes={null} onEdit={() => useDraft.getState().editNotes()} />
    </PanelScrollContext.Provider>,
  );
  await fireEvent.press(screen.getByLabelText('Add notes'));
  return { focus, scrollFocusedToTop, showKeyboard: () => showKeyboard() };
}

describe('NotesPreview', () => {
  it('turns into a notes field in place, focused, typing into the draft', async () => {
    const f = await openInPlace();
    expect(screen.queryByLabelText('Add notes')).toBeNull();
    expect(f.focus).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'dug in');
    expect(useDraft.getState().notes).toBe('dug in');
  });

  it('leaves the scrolling to the panel once the keyboard is up', async () => {
    jest.useFakeTimers();
    try {
      const f = await openInPlace();
      await act(async () => f.showKeyboard());
      await act(async () => jest.advanceTimersByTime(1500 + 100));
      expect(f.scrollFocusedToTop).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('asks the panel to bring it to the top after a wait when no keyboard shows (a hardware keyboard)', async () => {
    jest.useFakeTimers();
    try {
      const f = await openInPlace();
      // The wait, then the frame the scroll waits for.
      await act(async () => jest.advanceTimersByTime(1500 + 100));
      expect(f.scrollFocusedToTop).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('on Android, focuses after a short wait, so the keyboard opens', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const wait = jest.spyOn(global, 'setTimeout');
    const f = await openInPlace();
    expect(wait).toHaveBeenCalledWith(expect.any(Function), ANDROID_FOCUS_DELAY_MS);
    // A spied setTimeout reads as fake timers to waitFor, which would then stop waiting at once.
    wait.mockRestore();
    await waitFor(() => expect(f.focus).toHaveBeenCalledTimes(1));
  });
});
