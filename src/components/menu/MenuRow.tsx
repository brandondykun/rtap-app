import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** A tappable list row: icon, label, optional detail, chevron. */
export function MenuRow({ label, icon, detail, onPress }: { label: string; icon?: IconName; detail?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 active:opacity-60">
      {icon ? <Icon name={icon} size={20} color={colors.text} /> : null}
      <Text className="flex-1 text-base text-text">{label}</Text>
      {detail ? <Text className="text-sm text-text-muted">{detail}</Text> : null}
      <Icon name="chevron-right" size={20} color={colors['text-muted']} />
    </Pressable>
  );
}
