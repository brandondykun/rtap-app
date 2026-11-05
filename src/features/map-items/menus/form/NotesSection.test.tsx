import { act, fireEvent, screen } from '@testing-library/react-native';

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
});
