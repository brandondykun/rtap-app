import { act, fireEvent, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { PanelScrollToEnd } from '@/components/menu/panel-header-slot';

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

  it('opened from the view, focuses itself and scrolls the menu to it', async () => {
    jest.useFakeTimers();
    try {
      const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
      const scrollToEnd = jest.fn();
      await act(async () => useDraft.getState().editNotes());
      await renderWithProviders(
        <PanelScrollToEnd.Provider value={scrollToEnd}>
          <NotesSection />
        </PanelScrollToEnd.Provider>,
      );
      expect(focus).toHaveBeenCalledTimes(1);
      // The request is taken: a later form doesn't grab focus again.
      expect(useDraft.getState().focusNotes).toBe(false);
      // No keyboard shows in tests, so it scrolls after the wait.
      await act(async () => jest.advanceTimersByTime(1500));
      expect(scrollToEnd).toHaveBeenCalledTimes(1);
      focus.mockRestore();
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
