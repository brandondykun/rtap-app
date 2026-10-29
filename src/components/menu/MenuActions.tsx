import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { useArmed } from './use-armed';

type Destructive = { label: string; confirmLabel: string; onConfirm: () => void };

/** Destructive action with an in-panel second tap to confirm (no system dialogs). */
export function MenuActions({ destructive, disabled = false }: { destructive: Destructive; disabled?: boolean }) {
  const { colors } = useTheme();
  const { armed, arm, disarm } = useArmed();
  const label = armed ? destructive.confirmLabel : destructive.label;
  return (
    <View className="px-4 pb-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          if (!armed) {
            arm();
            return;
          }
          disarm();
          destructive.onConfirm();
        }}
        className={`active:opacity-60 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${armed ? 'border-danger bg-danger' : 'border-danger bg-surface-raised'} ${disabled ? 'opacity-40' : ''}`}>
        <Icon name="trash-can-outline" size={18} color={armed ? colors['on-accent'] : colors.danger} />
        <Text className={`font-semibold ${armed ? 'text-on-accent' : 'text-danger'}`}>{label}</Text>
      </Pressable>
    </View>
  );
}
