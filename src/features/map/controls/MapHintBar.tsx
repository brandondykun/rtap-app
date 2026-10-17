import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { Icon } from '@/components/ui/Icon';
import { useMapChrome } from '@/stores/map-chrome';
import { useTheme } from '@/theme/ThemeProvider';

import { EDGE, selfCardClearance } from '../layout';

/**
 * The amber-outlined bar along the bottom of the map for a tap mode: a tap hint on the left, buttons on the right.
 * Positioned above the panel (or the safe area) and your grid card, clear of the zoom column; `panel: 'inline'` leaves the
 * placement to the parent (the bottom-left stack, under the readouts).
 */
export function MapHintBar({ testID, panel, hint, children }: { testID: string; panel: PanelFrame | null | 'inline'; hint: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { lift, right } = selfCardClearance(useMapChrome((s) => s.selfCard), false);
  return (
    <View
      testID={testID}
      className={`${panel === 'inline' ? '' : 'absolute'} flex-row items-center gap-2 rounded-2xl border border-accent bg-surface-chrome p-2`}
      style={
        panel === 'inline'
          ? undefined
          : {
              bottom: (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE + lift,
              left: (panel?.side === 'left' ? panel.size : insets.left) + EDGE,
              right: insets.right + EDGE + right,
            }
      }>
      <Icon name="gesture-tap" size={20} color={colors.accent} />
      <Text numberOfLines={2} className="shrink text-sm text-text">
        {hint}
      </Text>
      <View className="ml-auto flex-row gap-2">{children}</View>
    </View>
  );
}
