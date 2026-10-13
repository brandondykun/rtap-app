import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Secondary button: icon (an icon name or a custom glyph) + label on a raised surface (Center, Me, notes). */
export function MenuButton({ label, icon, onPress, disabled = false }: { label: string; icon: IconName | ReactElement; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-3 ${disabled ? 'opacity-40' : ''}`}>
      {typeof icon === 'string' ? <Icon name={icon} size={18} color={colors.text} /> : icon}
      <Text className="font-semibold text-text">{label}</Text>
    </Pressable>
  );
}
