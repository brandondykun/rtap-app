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
    // 8pt around the buttons makes the bar's corners concentric with theirs (8 + 8 = 16); the hint gets a bit more room.
    <View testID={testID} className="flex-row items-center gap-2 rounded-2xl border border-accent bg-surface-chrome p-2 pl-3">
      <Icon name="gesture-tap" size={18} color={colors.accent} />
      <Text numberOfLines={2} className="shrink text-sm text-text">
        {hint}
      </Text>
      <View className="ml-1 flex-row gap-1.5">{children}</View>
    </View>
  );
}
