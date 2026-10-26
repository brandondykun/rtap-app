import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** A titled card holding related `MenuSection`s, so a long menu reads as a few clear groups. */
export function MenuGroup({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View testID={`menu-group-${title}`} className="gap-2 px-4 pb-6">
      <View accessible accessibilityRole="header" className="flex-row items-center gap-2 px-1">
        <Icon name={icon} size={20} color={colors.accent} />
        <Text className="text-lg font-bold text-text">{title}</Text>
      </View>
      <View className="rounded-xl border border-border bg-surface-raised pt-4">{children}</View>
    </View>
  );
}
