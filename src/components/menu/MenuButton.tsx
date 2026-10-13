import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Secondary button: icon (an icon name or a custom glyph) + label on a raised surface (Center, Map, notes). `active` marks a mode that is on. */
export function MenuButton({ label, icon, onPress, disabled = false, active = false }: { label: string; icon: IconName | ReactElement; onPress: () => void; disabled?: boolean; active?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${active ? 'border-accent bg-accent-subtle' : 'border-border bg-surface-raised'} ${disabled ? 'opacity-40' : ''}`}>
      {typeof icon === 'string' ? <Icon name={icon} size={18} color={active ? colors.accent : colors.text} /> : icon}
      <Text className={`font-semibold ${active ? 'text-accent' : 'text-text'}`}>{label}</Text>
    </Pressable>
  );
}
