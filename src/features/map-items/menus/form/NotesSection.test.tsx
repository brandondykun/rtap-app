import { act, fireEvent, screen } from '@testing-library/react-native';
import { Keyboard, TextInput } from 'react-native';

import { PanelScrollContext } from '@/components/menu/panel-header-slot';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { renderWithProviders } from '@/test-utils/render';

import { NotesSection } from './NotesSection';

beforeEach(() => useDraft.setState(INITIAL_DRAFT));

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
  async function openFromView(keyboardRevealsFocus: boolean) {
    const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
    let showKeyboard = () => {};
    const listen = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, cb) => {
      if (event === 'keyboardDidShow') showKeyboard = () => (cb as (e: unknown) => void)({});
      return { remove: () => {} } as ReturnType<typeof Keyboard.addListener>;
    });
    const scrollToEnd = jest.fn();
    await act(async () => useDraft.getState().editNotes());
    await renderWithProviders(
      <PanelScrollContext.Provider value={{ scrollToEnd, keyboardRevealsFocus }}>
        <NotesSection />
      </PanelScrollContext.Provider>,
    );
    return { focus, scrollToEnd, showKeyboard: () => showKeyboard(), restore: () => (focus.mockRestore(), listen.mockRestore()) };
  }

  it('opened from the view, focuses itself and scrolls the menu to it once the keyboard is up', async () => {
    const f = await openFromView(false);
    expect(f.focus).toHaveBeenCalledTimes(1);
    // The request is taken: a later form doesn't grab focus again.
    expect(useDraft.getState().focusNotes).toBe(false);
    expect(f.scrollToEnd).not.toHaveBeenCalled();
    await act(async () => f.showKeyboard());
    expect(f.scrollToEnd).toHaveBeenCalledTimes(1);
    f.restore();
  });

  it('leaves the scroll to the keyboard where it reveals the focused field itself (landscape drawer), so the content moves once', async () => {
    const f = await openFromView(true);
    await act(async () => f.showKeyboard());
    expect(f.scrollToEnd).not.toHaveBeenCalled();
    f.restore();
  });

  it('scrolls after a wait when no keyboard shows (a hardware keyboard), even where the keyboard would have', async () => {
    jest.useFakeTimers();
    try {
      const f = await openFromView(true);
      await act(async () => jest.advanceTimersByTime(1500));
      expect(f.scrollToEnd).toHaveBeenCalledTimes(1);
      f.restore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not take focus when opened by Edit', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
    await renderWithProviders(<NotesSection />);
    expect(focus).not.toHaveBeenCalled();
    focus.mockRestore();
  });
});
