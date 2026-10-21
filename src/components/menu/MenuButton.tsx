import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

import { glassHalo } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Secondary button: icon (an icon name or a custom glyph) + label on a raised surface (Center, Map, notes). `active` marks a mode that is on; `iconOnly` drops the visible text (the label stays for accessibility); `compact` trims the padding for bars over the map; `glass` floats it on its own over the map (see-through, no border); `text` shows shorter visible text than the label (which stays for accessibility). */
export function MenuButton({
  label,
  text = label,
  icon,
  onPress,
  disabled = false,
  active = false,
  iconOnly = false,
  compact = false,
  glass = false,
}: {
  label: string;
  text?: string;
  icon: IconName | ReactElement;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  iconOnly?: boolean;
  compact?: boolean;
  glass?: boolean;
}) {
  const { colors } = useTheme();
  const halo = glass ? glassHalo(colors) : undefined;
  const surface = active ? 'border border-accent bg-accent-subtle' : glass ? 'bg-surface-glass' : 'border border-border bg-surface-raised';
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
      className={`flex-row items-center justify-center ${compact ? 'min-h-10 min-w-10 gap-1.5 rounded-lg px-3 py-2' : 'gap-2 rounded-xl px-4 py-3'} ${surface} ${disabled ? 'opacity-40' : ''}`}>
      {typeof icon === 'string' ? <Icon name={icon} size={compact ? 16 : 18} color={active ? colors.accent : colors.text} style={halo} /> : icon}
      {iconOnly ? null : <Text style={halo} className={`${compact ? 'text-sm' : ''} font-semibold ${active ? 'text-accent' : 'text-text'}`}>{text}</Text>}
    </Pressable>
  );
}
