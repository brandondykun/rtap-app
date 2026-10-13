import { StyleSheet, View } from 'react-native';

import type { PanelFrame } from '@/components/menu/panel-geometry';

const ARM = 14;
const GAP = 5;
const THICKNESS = 1.5;

/** Thin cross with a center dot at the center of the visible map (beside any open panel). */
export function Crosshair({ panel }: { panel: PanelFrame | null }) {
  const frame = {
    bottom: panel?.side === 'bottom' ? panel.size : 0,
    left: panel?.side === 'left' ? panel.size : 0,
  };
  return (
    <View testID="crosshair-frame" pointerEvents="none" style={[StyleSheet.absoluteFill, frame]} className="items-center justify-center">
      <View style={{ width: 2 * (ARM + GAP), height: 2 * (ARM + GAP) }} className="items-center justify-center">
        <View className="absolute bg-text" style={{ width: THICKNESS, height: ARM, top: 0 }} />
        <View className="absolute bg-text" style={{ width: THICKNESS, height: ARM, bottom: 0 }} />
        <View className="absolute bg-text" style={{ height: THICKNESS, width: ARM, left: 0 }} />
        <View className="absolute bg-text" style={{ height: THICKNESS, width: ARM, right: 0 }} />
        <View className="rounded-full bg-text" style={{ width: 4, height: 4 }} />
      </View>
    </View>
  );
}
