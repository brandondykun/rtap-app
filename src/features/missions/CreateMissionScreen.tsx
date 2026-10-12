import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useCommandContext } from '@/lib/db/command-context-provider';
import { useTheme } from '@/theme/ThemeProvider';

import { createMission } from './commands';
import { suggestMissionName } from './repository';

export function CreateMissionScreen() {
  const ctx = useCommandContext();
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: a second tap in the same frame must see the first tap's lock.
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    void suggestMissionName(ctx.db).then((suggestion) => {
      // Only prefill while the field is still empty (the user may already be typing).
      if (live) setName((current) => (current === '' ? suggestion : current));
    });
    return () => {
      live = false;
    };
  }, [ctx]);

  const submit = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    const result = await createMission(ctx, { name });
    if (result.ok) {
      // Stay locked: the sheet is being replaced by the map.
      router.replace({ pathname: '/missions/[missionId]', params: { missionId: result.value.id } });
      return;
    }
    busy.current = false;
    setError(result.error === 'invalid_name' ? 'Enter a mission name.' : 'Could not create the mission. Try again.');
  };

  return (
    <View className="gap-4 bg-surface px-4 pb-8 pt-6">
      <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">New mission</Text>
      <TextInput
        accessibilityLabel="Mission name"
        value={name}
        onChangeText={setName}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        placeholder="Mission name"
        placeholderTextColor={colors['text-muted']}
        className="rounded-xl border border-border bg-surface-input px-4 py-3 text-base text-text"
      />
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="flex-1 items-center rounded-xl border border-border bg-surface-raised py-3">
          <Text className="font-semibold text-text">Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void submit()}
          className="flex-1 items-center rounded-xl bg-accent py-3">
          <Text className="font-bold text-on-accent">Create</Text>
        </Pressable>
      </View>
    </View>
  );
}
