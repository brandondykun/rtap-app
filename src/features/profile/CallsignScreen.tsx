import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { CALLSIGN_MAX, CALLSIGN_RULE, normalizeCallsign } from '@/lib/identity/callsign';
import { useProfile } from '@/stores/profile';
import { useTheme } from '@/theme/ThemeProvider';

const POINTS: { icon: IconName; text: string }[] = [
  {
    icon: 'account-group-outline',
    text: 'Your team will see it next to your position, and on the units, points, lines and areas you add, once missions are shared.',
  },
  { icon: 'cellphone', text: 'Until then it stays on this phone.' },
  {
    icon: 'pencil-outline',
    text: 'You can change it any time in Settings. Missions remember you, not the name, so a new callsign shows everywhere.',
  },
];

/**
 * The callsign sheet (a modal route): opened once on first launch, and from Settings' "About callsigns". Being shown
 * counts as answered, so swiping it away is the same as Not now.
 */
export function CallsignScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [text, setText] = useState(() => useProfile.getState().callsign ?? '');
  const valid = normalizeCallsign(text) !== null;
  const invalid = text.trim() !== '' && !valid;

  useEffect(() => useProfile.getState().dismissCallsignPrompt(), []);

  const save = () => {
    if (!valid) return;
    useProfile.getState().setCallsign(text);
    router.back();
  };

  return (
    <ScrollView
      testID="callsign-screen"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-surface"
      // The sheet spans the screen width in landscape: keep its content clear of the notch side.
      contentContainerStyle={{ paddingTop: 32, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }}>
      <View className="w-full max-w-[560px] gap-6 self-center">
        <Text accessibilityRole="header" className="text-2xl font-semibold text-text">
          Choose your callsign
        </Text>
        <View testID="callsign-explainer" className="gap-4">
          {POINTS.map((p) => (
            <View key={p.icon} className="flex-row items-start gap-3">
              <Icon name={p.icon} size={24} color={colors.accent} />
              <Text className="flex-1 text-base text-text">{p.text}</Text>
            </View>
          ))}
        </View>
        <View className="gap-2">
          <TextField
            accessibilityLabel="Callsign"
            placeholder="e.g. VIPER 6"
            value={text}
            onChangeText={setText}
            onSubmitEditing={save}
            invalid={invalid}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CALLSIGN_MAX + 4}
            returnKeyType="done"
            clearable
          />
          <Text testID="callsign-rule" className={`text-sm ${invalid ? 'text-danger' : 'text-text-muted'}`}>
            {CALLSIGN_RULE}
          </Text>
        </View>
        <View className="flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            className="active:opacity-60 flex-1 items-center rounded-xl border border-border bg-surface-raised py-3">
            <Text className="font-semibold text-text">Not now</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !valid }}
            disabled={!valid}
            onPress={save}
            className={`active:opacity-60 flex-1 items-center rounded-xl bg-accent py-3 ${valid ? '' : 'opacity-40'}`}>
            <Text className="font-bold text-on-accent">Save</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
