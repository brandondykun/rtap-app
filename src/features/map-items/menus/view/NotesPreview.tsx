import { Pressable, Text } from 'react-native';

/** The notes text, or a dashed prompt to add some. Tapping either opens the editor. */
export function NotesPreview({ notes, onEdit }: { notes: string | null; onEdit: () => void }) {
  const has = !!notes && notes.trim() !== '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={has ? `Notes: ${notes}` : 'Add notes'}
      accessibilityHint="Opens the editor"
      onPress={onEdit}
      className={`active:opacity-60 rounded-xl px-3 py-3 ${has ? 'bg-surface-raised' : 'border border-dashed border-border'}`}>
      <Text numberOfLines={6} className={has ? 'text-base text-text' : 'text-base text-text-muted'}>{has ? notes : 'No notes — tap to add'}</Text>
    </Pressable>
  );
}
