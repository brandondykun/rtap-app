import { Pressable, Text, View } from 'react-native';

import { TextField } from '@/components/ui/TextField';

type Props = {
  title: string;
  name: string;
  onChangeName: (name: string) => void;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  error: string | null;
};

/** The mission name sheet shared by New mission and Rename mission. */
export function MissionNameForm({ title, name, onChangeName, submitLabel, onSubmit, onCancel, error }: Props) {
  return (
    <View className="gap-4 bg-surface px-4 pb-8 pt-6">
      <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">{title}</Text>
      <TextField
        accessibilityLabel="Mission name"
        value={name}
        onChangeText={onChangeName}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        placeholder="Mission name"
        invalid={error !== null}
      />
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          className="flex-1 items-center rounded-xl border border-border bg-surface-raised py-3">
          <Text className="font-semibold text-text">Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSubmit} className="flex-1 items-center rounded-xl bg-accent py-3">
          <Text className="font-bold text-on-accent">{submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
