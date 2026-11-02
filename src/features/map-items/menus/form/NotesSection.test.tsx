import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Keyboard, Platform, TextInput } from 'react-native';

import { ANDROID_FOCUS_DELAY_MS } from '@/components/menu/MgrsInput';

import { PanelScrollContext } from '@/components/menu/panel-header-slot';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { renderWithProviders } from '@/test-utils/render';

import { NotesSection } from './NotesSection';

beforeEach(() => useDraft.setState(INITIAL_DRAFT));
afterEach(() => jest.restoreAllMocks());

describe('NotesSection', () => {
  it('always shows the notes field under a Notes label, inviting notes while empty', async () => {
    await renderWithProviders(<NotesSection />);
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull();
    expect(screen.getByLabelText('Notes')).toHaveProp('placeholder', 'Add notes');
    await fireEvent.changeText(screen.getByLabelText('Notes'), 'dug in');
    expect(useDraft.getState().notes).toBe('dug in');
  });

  it('is read-only while viewing, saying there are no notes when empty', async () => {
    await act(async () => useDraft.setState({ locked: true }));
    await renderWithProviders(<NotesSection />);
    expect(screen.getByLabelText('Notes')).toHaveProp('editable', false);
    expect(screen.getByLabelText('Notes')).toHaveProp('placeholder', 'No notes');
  });

  /** Renders the field opened from the view's notes, in a panel; returns the panel's scroll and a way to show the keyboard. */
  async function openFromView() {
    const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
    let showKeyboard = () => {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, cb) => {
      if (name === 'keyboardDidShow') showKeyboard = () => (cb as (e: unknown) => void)({});
      return { remove: () => {} } as ReturnType<typeof Keyboard.addListener>;
    });
    const scrollToEnd = jest.fn();
    await act(async () => useDraft.getState().editNotes());
    await renderWithProviders(
      <PanelScrollContext.Provider value={{ scrollToEnd, scrollToTop: jest.fn() }}>
        <NotesSection />
      </PanelScrollContext.Provider>,
    );
    return { focus, scrollToEnd, showKeyboard: () => showKeyboard() };
  }

  it('opened from the view, focuses itself and leaves the scrolling to the panel once the keyboard is up', async () => {
    jest.useFakeTimers();
    try {
      const f = await openFromView();
      expect(f.focus).toHaveBeenCalledTimes(1);
      // The request is taken: a later form doesn't grab focus again.
      expect(useDraft.getState().focusNotes).toBe(false);
      await act(async () => f.showKeyboard());
      await act(async () => jest.advanceTimersByTime(1500 + 100));
      expect(f.scrollToEnd).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('on Android, focuses after a short wait, so the keyboard opens', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const wait = jest.spyOn(global, 'setTimeout');
    const f = await openFromView();
    expect(wait).toHaveBeenCalledWith(expect.any(Function), ANDROID_FOCUS_DELAY_MS);
    await waitFor(() => expect(f.focus).toHaveBeenCalledTimes(1));
  });

  it('scrolls to the bottom after a wait when no keyboard shows (a hardware keyboard)', async () => {
    jest.useFakeTimers();
    try {
      const f = await openFromView();
      // The wait, then the frame the scroll waits for.
      await act(async () => jest.advanceTimersByTime(1500 + 100));
      expect(f.scrollToEnd).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not take focus when opened by Edit', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
    focus.mockClear();
    await renderWithProviders(<NotesSection />);
    expect(focus).not.toHaveBeenCalled();
  });
});
