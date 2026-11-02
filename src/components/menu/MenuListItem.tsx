import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Width of each icon column at a row's right edge; column headers (MenuCountButton) line up over it. */
export const LIST_COLUMN_WIDTH = 52;

type Column = { icon: IconName; label: string; onPress: () => void; /** An "on" state: accent icon on an accent-subtle tile. */ active?: boolean };

/**
 * A list row with a thin line above it: leading visual, title, subtitle, then up to two icon columns. The row and each
 * column are separate tap targets. A `secondary` of null keeps its column empty, so the columns line up down the list.
 */
export function MenuListItem({
  title,
  subtitle,
  subtitleContent,
  leading,
  onPress,
  secondary,
  trailing,
  dimmed = false,
}: {
  title: string;
  /** Also the row's screen-reader hint. */
  subtitle?: string;
  /** Shown in place of `subtitle`, for one with its values in their value colors. */
  subtitleContent?: ReactNode;
  leading?: ReactNode;
  onPress: () => void;
  secondary?: Column | null;
  trailing?: Column;
  dimmed?: boolean;
}) {
  return (
    <View className="flex-row items-center border-t border-border">
      <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} onPress={onPress} className={`active:opacity-60 flex-1 flex-row items-center gap-3 py-2.5 ${dimmed ? 'opacity-50' : ''}`}>
        {leading}
        <View className="flex-1">
          <Text numberOfLines={1} className="font-mono text-base text-text">
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="font-mono text-xs text-text-muted">
              {subtitleContent ?? subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {secondary === null ? <View testID="list-column-empty" style={{ width: LIST_COLUMN_WIDTH }} /> : secondary ? <ColumnButton column={secondary} /> : null}
      {trailing ? <ColumnButton column={trailing} muted={dimmed} /> : null}
    </View>
  );
}

function ColumnButton({ column, muted = false }: { column: Column; muted?: boolean }) {
  const { colors } = useTheme();
  const color = column.active ? colors.accent : muted || column.active === false ? colors['text-muted'] : colors.text;
  return (
    <View style={{ width: LIST_COLUMN_WIDTH }} className="items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={column.label}
        onPress={column.onPress}
        hitSlop={4}
        className={`active:opacity-60 h-11 w-11 items-center justify-center rounded-lg ${column.active ? 'bg-accent-subtle' : ''}`}>
        <Icon name={column.icon} size={22} color={color} />
      </Pressable>
    </View>
  );
}
