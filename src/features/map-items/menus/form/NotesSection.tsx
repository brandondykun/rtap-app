import { MenuSection } from '@/components/menu/MenuSection';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/stores/draft';

/** The item's notes, always shown: an open field while editing, read-only while viewing. */
export function NotesSection() {
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);

  return (
    <MenuSection label="Notes">
      <TextField
        editable={!locked}
        accessibilityLabel="Notes"
        value={notes}
        onChangeText={(t) => useDraft.getState().setNotes(t)}
        multiline
        placeholder={locked ? 'No notes' : 'Add notes'}
      />
    </MenuSection>
  );
}
