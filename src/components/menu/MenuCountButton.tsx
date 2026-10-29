import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { LIST_COLUMN_WIDTH } from './MenuListItem';

/**
 * A list column's header: its icon and a short count ("8/9"), as one bordered button that acts on the whole column.
 * At least a column wide, so it sits over the MenuListItem buttons it controls. `accent` draws it amber.
 */
export function MenuCountButton({ icon, text, label, onPress, accent = false }: { icon: IconName; text: string; label: string; onPress: () => void; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minWidth: LIST_COLUMN_WIDTH }}
      className="active:opacity-60 h-11 flex-row items-center justify-center gap-1 rounded-xl border border-border bg-surface-input px-2">
      <Icon name={icon} size={16} color={accent ? colors.accent : colors.text} />
      <Text className={`font-mono text-sm font-semibold ${accent ? 'text-accent' : 'text-text'}`}>{text}</Text>
    </Pressable>
  );
}
