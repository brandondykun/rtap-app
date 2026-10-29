import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Trailing = { icon: IconName; label: string; onPress: () => void; /** Draws the icon in the accent color (an "on" state). */ active?: boolean };

/** A list row: leading visual, title, subtitle; the row and an optional secondary and trailing icon buttons are separate tap targets. */
export function MenuListItem({ title, subtitle, leading, onPress, secondary, trailing, dimmed = false }: { title: string; subtitle?: string; leading?: ReactNode; onPress: () => void; secondary?: Trailing; trailing?: Trailing; dimmed?: boolean }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-border bg-surface-raised pr-1">
      <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} onPress={onPress} className={`active:opacity-60 flex-1 flex-row items-center gap-3 py-2 pl-3 ${dimmed ? 'opacity-50' : ''}`}>
        {leading}
        <View className="flex-1">
          <Text numberOfLines={1} className="font-mono text-base text-text">
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="font-mono text-xs text-text-muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {secondary ? (
        <Pressable accessibilityRole="button" accessibilityLabel={secondary.label} onPress={secondary.onPress} hitSlop={6} className="active:opacity-60 h-11 w-11 items-center justify-center">
          <Icon name={secondary.icon} size={22} color={secondary.active ? colors.accent : colors.text} />
        </Pressable>
      ) : null}
      {trailing ? (
        <Pressable accessibilityRole="button" accessibilityLabel={trailing.label} onPress={trailing.onPress} hitSlop={6} className="active:opacity-60 h-11 w-11 items-center justify-center">
          <Icon name={trailing.icon} size={22} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}
