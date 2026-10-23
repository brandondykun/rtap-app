import { StyleSheet, View } from 'react-native';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';

/** The app's crosshair (white, amber dot, outlined to read over snow) at the center of the visible map (beside any open panel). */
export function Crosshair({ panel }: { panel: PanelFrame | null }) {
  const frame = {
    bottom: panel?.side === 'bottom' ? panel.size : 0,
    left: panel?.side === 'left' ? panel.size : 0,
  };
  return (
    <View testID="crosshair-frame" pointerEvents="none" style={[StyleSheet.absoluteFill, frame]} className="items-center justify-center">
      <CrosshairGlyph outline />
    </View>
  );
}
