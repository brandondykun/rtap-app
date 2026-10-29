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
    // Scroll once the keyboard is up, so the field ends up above it (or after a wait, if none shows). Where the keyboard
    // already scrolls the focused field into view, scrolling again would move the content twice: leave it to the keyboard.
    let done = false;
    const scroll = (keyboard: boolean) => {
      if (done) return;
      done = true;
      shown.remove();
      if (!(keyboard && panel?.keyboardRevealsFocus)) panel?.scrollToEnd();
    };
    const shown = Keyboard.addListener('keyboardDidShow', () => scroll(true));
    const timer = setTimeout(() => scroll(false), KEYBOARD_WAIT_MS);
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
