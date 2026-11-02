import { useContext, useEffect, useRef } from 'react';
import { Keyboard, Platform, type TextInput } from 'react-native';

import { ANDROID_FOCUS_DELAY_MS } from '@/components/menu/MgrsInput';
import { MenuSection } from '@/components/menu/MenuSection';
import { PanelScrollContext } from '@/components/menu/panel-header-slot';
import { TextField } from '@/components/ui/TextField';
import { useDraft } from '@/stores/draft';

/** Give up waiting for the keyboard after this long (a hardware keyboard never shows one). */
const KEYBOARD_WAIT_MS = 1500;

/**
 * The item's notes, always shown: an open field while editing, read-only while viewing. Opened from the view's notes
 * (`editNotes`), it focuses itself; the panel scrolls it to its top once the keyboard is up. With no keyboard (a hardware
 * one), it scrolls to the bottom of the menu, where it sits, after a wait.
 */
export function NotesSection() {
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);
  const input = useRef<TextInput>(null);
  const panel = useContext(PanelScrollContext);

  useEffect(() => {
    if (useDraft.getState().locked || !useDraft.getState().takeNotesFocus()) return;
    const focus = () => input.current?.focus();
    // Focused as it mounts, Android shows the cursor but never opens the keyboard (see ANDROID_FOCUS_DELAY_MS).
    const focusTimer = Platform.OS === 'android' ? setTimeout(focus, ANDROID_FOCUS_DELAY_MS) : undefined;
    if (Platform.OS !== 'android') focus();
    const shown = Keyboard.addListener('keyboardDidShow', () => clearTimeout(waitTimer));
    const waitTimer = setTimeout(() => {
      shown.remove();
      requestAnimationFrame(() => panel?.scrollToEnd());
    }, KEYBOARD_WAIT_MS);
    return () => {
      shown.remove();
      clearTimeout(focusTimer);
      clearTimeout(waitTimer);
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
