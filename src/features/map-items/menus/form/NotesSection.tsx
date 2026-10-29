import { useContext, useEffect, useRef } from 'react';
import { Keyboard, type TextInput } from 'react-native';

import { MenuSection } from '@/components/menu/MenuSection';
import { PanelScrollContext } from '@/components/menu/panel-header-slot';
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
  const panel = useContext(PanelScrollContext);

  useEffect(() => {
    if (useDraft.getState().locked || !useDraft.getState().takeNotesFocus()) return;
    input.current?.focus();
    // Scroll to the bottom, where the field sits, so all of it ends up above the keyboard (after a wait, if none shows).
    // Where the panel keeps its size, scroll as the keyboard starts to open (one movement with iOS's own); in the portrait
    // sheet, once it is up and the sheet has grown.
    let done = false;
    const scroll = () => {
      if (done) return;
      done = true;
      shown.remove();
      // A frame later, so the scroll view has taken the keyboard's inset and the end is above the keyboard.
      requestAnimationFrame(() => panel?.scrollToEnd());
    };
    const shown = Keyboard.addListener(panel?.scrollAsKeyboardShows ? 'keyboardWillShow' : 'keyboardDidShow', scroll);
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
