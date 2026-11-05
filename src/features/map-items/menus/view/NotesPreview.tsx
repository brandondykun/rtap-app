import { useContext, useEffect, useRef } from 'react';
import { Platform, Pressable, Text, type TextInput } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';

import { ANDROID_FOCUS_DELAY_MS } from '@/components/menu/MgrsInput';
import { PanelScrollContext } from '@/components/menu/panel-header-slot';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/stores/draft';

/** Give up waiting for the keyboard after this long (a hardware keyboard never shows one). */
const KEYBOARD_WAIT_MS = 1500;

/**
 * The notes text, or a dashed prompt to add some. Tapping either turns it into a field right there (`editNotes`): the
 * menu header offers Cancel / Save meanwhile, and the rest of the view stays as it is, rather than swapping to the form.
 */
export function NotesPreview({ notes, onEdit }: { notes: string | null; onEdit: () => void }) {
  const editing = useDraft((s) => s.notesEditing);
  if (editing) return <NotesEditor />;
  const has = !!notes && notes.trim() !== '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={has ? `Notes: ${notes}` : 'Add notes'}
      accessibilityHint="Edits the notes"
      onPress={onEdit}
      className={`active:opacity-60 rounded-xl px-3 py-3 ${has ? 'bg-surface-raised' : 'border border-dashed border-border'}`}>
      <Text numberOfLines={6} className={has ? 'text-base text-text' : 'text-base text-text-muted'}>{has ? notes : 'No notes — tap to add'}</Text>
    </Pressable>
  );
}

/**
 * The notes being edited in place. It focuses itself as it appears; the panel scrolls it to its top as the keyboard
 * opens. With no keyboard (a hardware one) the panel is asked to after a wait.
 */
function NotesEditor() {
  const notes = useDraft((s) => s.notes);
  const input = useRef<TextInput>(null);
  const panel = useContext(PanelScrollContext);

  useEffect(() => {
    const focus = () => input.current?.focus();
    // Focused as it mounts, Android shows the cursor but never opens the keyboard (see ANDROID_FOCUS_DELAY_MS).
    const focusTimer = Platform.OS === 'android' ? setTimeout(focus, ANDROID_FOCUS_DELAY_MS) : undefined;
    if (Platform.OS !== 'android') focus();
    const shown = KeyboardEvents.addListener('keyboardDidShow', () => clearTimeout(waitTimer));
    const waitTimer = setTimeout(() => {
      shown.remove();
      requestAnimationFrame(() => panel?.scrollFocusedToTop());
    }, KEYBOARD_WAIT_MS);
    return () => {
      shown.remove();
      clearTimeout(focusTimer);
      clearTimeout(waitTimer);
    };
    // Mount only: it focuses once, as it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <TextField ref={input} accessibilityLabel="Notes" value={notes} onChangeText={(t) => useDraft.getState().setNotes(t)} multiline placeholder="Add notes" />;
}
