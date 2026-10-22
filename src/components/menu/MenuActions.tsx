import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Destructive = { label: string; confirmLabel: string; onConfirm: () => void };

/** How long the second tap stays armed before the button falls back to its first label. */
export const ARM_TIMEOUT_MS = 4000;

/** Destructive action with an in-panel second tap to confirm (no system dialogs). */
export function MenuActions({ destructive, disabled = false }: { destructive: Destructive; disabled?: boolean }) {
  const { colors } = useTheme();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);
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
            setArmed(true);
            return;
          }
          setArmed(false);
          destructive.onConfirm();
        }}
        className={`active:opacity-60 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${armed ? 'border-danger bg-danger' : 'border-danger bg-surface-raised'} ${disabled ? 'opacity-40' : ''}`}>
        <Icon name="trash-can-outline" size={18} color={armed ? colors['on-accent'] : colors.danger} />
        <Text className={`font-semibold ${armed ? 'text-on-accent' : 'text-danger'}`}>{label}</Text>
      </Pressable>
    </View>
  );
}
