import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { CALLSIGN_MAX, CALLSIGN_RULE } from '@/lib/identity/callsign';
import { useProfile } from '@/stores/profile';

/** The Settings menu's callsign field: saved when the edit finishes (or the menu closes), shown back as stored. */
export function CallsignSetting() {
  const stored = useProfile((s) => s.callsign);
  const [text, setText] = useState(stored ?? '');
  const [error, setError] = useState(false);
  // Text typed since the last save; closing the menu with the keyboard up still saves it.
  const pending = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (pending.current !== null) useProfile.getState().setCallsign(pending.current);
    },
    [],
  );

  const change = (next: string) => {
    setText(next);
    pending.current = next;
  };

  const commit = () => {
    if (pending.current === null) return;
    pending.current = null;
    const saved = useProfile.getState().setCallsign(text);
    setError(!saved);
    if (saved) setText(useProfile.getState().callsign ?? '');
  };

  return (
    <View className="gap-1">
      <TextField
        accessibilityLabel="Callsign"
        placeholder="e.g. VIPER 6"
        value={text}
        onChangeText={change}
        onSubmitEditing={commit}
        onBlur={commit}
        invalid={error}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CALLSIGN_MAX + 4}
        returnKeyType="done"
      />
      <Text className={`text-sm ${error ? 'text-danger' : 'text-text-muted'}`}>{error ? CALLSIGN_RULE : 'How your team will see you once missions are shared.'}</Text>
    </View>
  );
}
