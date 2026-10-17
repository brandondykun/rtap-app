import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The amber-outlined bar for a tap mode: a tap hint, then compact buttons. MapControls shows it in place of
 * your grid card.
 */
export function MapHintBar({ testID, hint, children }: { testID: string; hint: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} className="flex-row items-center gap-1.5 rounded-2xl border border-accent bg-surface-chrome p-1.5">
      <Icon name="gesture-tap" size={18} color={colors.accent} />
      <Text numberOfLines={2} className="shrink text-sm text-text">
        {hint}
      </Text>
      <View className="flex-row gap-1.5">{children}</View>
    </View>
  );
}
