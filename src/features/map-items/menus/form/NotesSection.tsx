import { useContext, useEffect, useRef } from 'react';
import { Keyboard, type TextInput } from 'react-native';

import { MenuSection } from '@/components/menu/MenuSection';
import { PanelScrollToEnd } from '@/components/menu/panel-header-slot';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/stores/draft';

/** Give up waiting for the keyboard after this long (a hardware keyboard never shows one). */
const KEYBOARD_WAIT_MS = 1500;

/**
 * The item's notes, always shown: an open field while editing, read-only while viewing. Opened from the view's notes
 * (`editNotes`), it focuses itself and scrolls to the bottom of the menu, where it sits, once the keyboard is up.
 */
export function NotesSection() {
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);
  const input = useRef<TextInput>(null);
  const scrollToEnd = useContext(PanelScrollToEnd);

  useEffect(() => {
    if (useDraft.getState().locked || !useDraft.getState().takeNotesFocus()) return;
    input.current?.focus();
    // The keyboard shrinks the panel; scroll once it is up, so the field ends up above it (or after a wait, if none shows).
    let done = false;
    const scroll = () => {
      if (done) return;
      done = true;
      shown.remove();
      scrollToEnd?.();
    };
    const shown = Keyboard.addListener('keyboardDidShow', scroll);
    const timer = setTimeout(scroll, KEYBOARD_WAIT_MS);
    return () => {
      shown.remove();
      clearTimeout(timer);
    };
    // Mount only: the request is taken once, when the form appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MenuSection label="Notes">
      <TextField
        ref={input}
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
