import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Square-ish action tile: icon above the label. `active` marks an "on" state (or, in the danger tone, the armed second tap). */
export function MenuTileButton({
  label,
  icon,
  onPress,
  tone = 'default',
  active = false,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'default' | 'danger';
  active?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const danger = tone === 'danger';
  const surface = danger ? (active ? 'border-danger bg-danger' : 'border-danger bg-surface-raised') : active ? 'border-accent bg-accent-subtle' : 'border-border bg-surface-raised';
  const textClass = danger ? (active ? 'text-on-accent' : 'text-danger') : active ? 'text-accent' : 'text-text';
  const iconColor = danger ? (active ? colors['on-accent'] : colors.danger) : active ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`active:opacity-60 flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-3 ${surface} ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={22} color={iconColor} />
      <Text numberOfLines={1} className={`text-sm font-semibold ${textClass}`}>{label}</Text>
    </Pressable>
  );
}
