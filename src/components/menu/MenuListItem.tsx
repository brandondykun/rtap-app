import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Trailing = { icon: IconName; label: string; onPress: () => void };

/** A list row: leading visual, title, subtitle; the row and an optional trailing icon button are separate tap targets. */
export function MenuListItem({ title, subtitle, leading, onPress, trailing, dimmed = false }: { title: string; subtitle?: string; leading?: ReactNode; onPress: () => void; trailing?: Trailing; dimmed?: boolean }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-border bg-surface-raised pr-1">
      <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} onPress={onPress} className={`flex-1 flex-row items-center gap-3 py-2 pl-3 ${dimmed ? 'opacity-50' : ''}`}>
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
      {trailing ? (
        <Pressable accessibilityRole="button" accessibilityLabel={trailing.label} onPress={trailing.onPress} hitSlop={6} className="h-11 w-11 items-center justify-center">
          <Icon name={trailing.icon} size={22} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}
