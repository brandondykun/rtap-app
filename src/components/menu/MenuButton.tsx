import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Secondary button: icon (an icon name or a custom glyph) + label on a raised surface (Center, Map, notes). `active` marks a mode that is on; `iconOnly` drops the visible text (the label stays for accessibility); `compact` trims the padding for bars over the map. */
export function MenuButton({
  label,
  icon,
  onPress,
  disabled = false,
  active = false,
  iconOnly = false,
  compact = false,
}: {
  label: string;
  icon: IconName | ReactElement;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  iconOnly?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      // Compact buttons stay small on screen but at least 40pt, with a touch target grown to about 48pt
      // (only 3pt sideways so neighbors in a row never overlap).
      hitSlop={compact ? { top: 4, bottom: 4, left: 3, right: 3 } : undefined}
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
      className={`flex-row items-center justify-center border ${compact ? 'min-h-10 min-w-10 gap-1.5 rounded-lg px-3 py-2' : 'gap-2 rounded-xl px-4 py-3'} ${active ? 'border-accent bg-accent-subtle' : 'border-border bg-surface-raised'} ${disabled ? 'opacity-40' : ''}`}>
      {typeof icon === 'string' ? <Icon name={icon} size={compact ? 16 : 18} color={active ? colors.accent : colors.text} /> : icon}
      {iconOnly ? null : <Text className={`${compact ? 'text-sm' : ''} font-semibold ${active ? 'text-accent' : 'text-text'}`}>{label}</Text>}
    </Pressable>
  );
}
