import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { CALLSIGN_MAX, CALLSIGN_RULE, normalizeCallsign } from '@/lib/identity/callsign';
import { useProfile } from '@/stores/profile';

/** First launch only: asks for a callsign. Save or Later both answer it for good; Settings can change it after. */
export function CallsignPrompt() {
  const prompted = useProfile((s) => s.callsignPrompted);
  const [text, setText] = useState('');
  if (prompted) return null;
  const valid = normalizeCallsign(text) !== null;
  const showRule = text.trim() !== '' && !valid;
  const save = () => {
    if (valid) useProfile.getState().setCallsign(text);
  };
  return (
    <View testID="callsign-prompt" className="mx-4 mb-3 gap-3 rounded-2xl border border-border bg-surface-raised p-4">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-text">Choose a callsign</Text>
        <Text className="text-sm text-text">It&apos;s how your team will see you. You can change it later in Settings.</Text>
      </View>
      <TextField
        accessibilityLabel="Callsign"
        placeholder="e.g. VIPER 6"
        value={text}
        onChangeText={setText}
        onSubmitEditing={save}
        invalid={showRule}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CALLSIGN_MAX + 4}
        returnKeyType="done"
      />
      {showRule ? <Text className="text-sm text-danger">{CALLSIGN_RULE}</Text> : null}
      <View className="flex-row items-center justify-end gap-4">
        <Pressable accessibilityRole="button" onPress={() => useProfile.getState().dismissCallsignPrompt()} hitSlop={8} className="min-h-11 justify-center px-2 active:opacity-60">
          <Text className="text-base font-semibold text-text">Later</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save callsign"
          accessibilityState={{ disabled: !valid }}
          disabled={!valid}
          onPress={save}
          className={`min-h-11 justify-center rounded-xl bg-accent px-6 active:opacity-60 ${valid ? '' : 'opacity-40'}`}>
          <Text className="font-bold text-on-accent">Save</Text>
        </Pressable>
      </View>
    </View>
  );
}
