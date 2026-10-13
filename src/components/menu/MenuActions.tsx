import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Destructive = { label: string; confirmLabel: string; onConfirm: () => void };

/** Destructive action with an in-panel second tap to confirm (no system dialogs). */
export function MenuActions({ destructive }: { destructive: Destructive }) {
  const { colors } = useTheme();
  const [armed, setArmed] = useState(false);
  const label = armed ? destructive.confirmLabel : destructive.label;
  return (
    <View className="px-4 pb-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          if (armed) destructive.onConfirm();
          else setArmed(true);
        }}
        className={`flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${armed ? 'border-danger bg-danger' : 'border-danger bg-surface-raised'}`}>
        <Icon name="trash-can-outline" size={18} color={armed ? colors['on-accent'] : colors.danger} />
        <Text className={`font-semibold ${armed ? 'text-on-accent' : 'text-danger'}`}>{label}</Text>
      </Pressable>
    </View>
  );
}
