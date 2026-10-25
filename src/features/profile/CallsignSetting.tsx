import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { CALLSIGN_MAX, CALLSIGN_RULE } from '@/lib/identity/callsign';
import { useProfile } from '@/stores/profile';

/**
 * The Settings menu's callsign field: saved when the edit finishes (or the menu closes), shown back as stored. About
 * callsigns opens the callsign sheet, which explains it and can set it too.
 */
export function CallsignSetting() {
  const stored = useProfile((s) => s.callsign);
  const [text, setText] = useState(stored ?? '');
  const [error, setError] = useState(false);
  // Text typed since the last save; closing the menu with the keyboard up still saves it.
  const pending = useRef<string | null>(null);
  // A callsign saved elsewhere (the callsign sheet) shows here, unless an edit is under way.
  const [shown, setShown] = useState(stored);
  if (stored !== shown) {
    setShown(stored);
    if (pending.current === null) setText(stored ?? '');
  }

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
      <Pressable accessibilityRole="button" onPress={() => router.push('/callsign')} hitSlop={8} className="min-h-11 justify-center self-start active:opacity-60">
        <Text className="text-base font-semibold text-accent">About callsigns</Text>
      </Pressable>
    </View>
  );
}
