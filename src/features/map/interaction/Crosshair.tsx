import { StyleSheet, View } from 'react-native';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useTheme } from '@/theme/ThemeProvider';

/** Thin cross with a center dot at the center of the visible map (beside any open panel). */
export function Crosshair({ panel }: { panel: PanelFrame | null }) {
  const { colors } = useTheme();
  const frame = {
    bottom: panel?.side === 'bottom' ? panel.size : 0,
    left: panel?.side === 'left' ? panel.size : 0,
  };
  return (
    <View testID="crosshair-frame" pointerEvents="none" style={[StyleSheet.absoluteFill, frame]} className="items-center justify-center">
      <CrosshairGlyph color={colors.text} />
    </View>
  );
}
