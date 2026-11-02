import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { glassHalo } from '@/components/ui/glass';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The amber-outlined bar for a tap mode: a tap hint, then compact buttons. MapControls shows it in place of
 * your grid card, or centered over the portrait dock while placing a unit or point.
 */
export function MapHintBar({ testID, hint, mono = false, children }: { testID: string; hint: ReactNode; mono?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  return (
    // Concentric with the buttons: the bar's 16 pt corners less its 1 pt border and 7 pt padding are their 8 pt (rounded-lg).
    // The hint gets a bit more room.
    <View testID={testID} className="flex-row items-center gap-2 rounded-2xl border border-accent bg-surface-glass p-[7px] pl-3">
      <Icon name="gesture-tap" size={18} color={colors.accent} style={halo} />
      <Text numberOfLines={2} style={halo} className={`shrink text-sm text-text ${mono ? 'font-mono font-semibold' : ''}`}>
        {hint}
      </Text>
      <View className="ml-1 flex-row gap-1.5">{children}</View>
    </View>
  );
}
