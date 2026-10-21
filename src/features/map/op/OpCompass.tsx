import { Text, View } from 'react-native';

import { useOp } from '@/stores/op';
import { useTheme } from '@/theme/ThemeProvider';

/** Width of the tape in points; it shows `VIEW_DEG` degrees of the horizon. */
export const COMPASS_WIDTH = 180;
const VIEW_DEG = 90;
const PX_PER_DEG = COMPASS_WIDTH / VIEW_DEG;
const TICK_STEP = 5;
const LABELS: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

/** Signed degrees from `from` to `to`, in (-180, 180]. */
const offset = (to: number, from: number) => ((((to - from) % 360) + 540) % 360) - 180;

/**
 * OP mode only: a compass tape under the toolbar that slides as the view turns, so the direction being faced (true
 * north based, like the camera) is always under the amber center marker.
 */
export function OpCompass({ top }: { top: number }) {
  const { colors } = useTheme();
  const on = useOp((s) => s.phase === 'on');
  const bearing = useOp((s) => s.bearing);
  if (!on) return null;

  const marks = [];
  for (let deg = 0; deg < 360; deg += TICK_STEP) {
    const d = offset(deg, bearing);
    if (Math.abs(d) > VIEW_DEG / 2) continue;
    const label = LABELS[deg];
    const long = deg % 15 === 0;
    marks.push(
      // A zero-width anchor at the mark's spot; the tick and letter center on it.
      <View key={deg} testID={label ? `compass-label-${label}` : undefined} className="absolute top-0 items-center" style={{ left: COMPASS_WIDTH / 2 + d * PX_PER_DEG, width: 0 }}>
        <View className={long ? 'h-2.5 w-px bg-text' : 'h-1.5 w-px bg-text-muted'} />
        {label ? <Text className="w-8 text-center font-mono text-[11px] font-semibold text-text">{label}</Text> : null}
      </View>,
    );
  }

  return (
    <View testID="op-compass" pointerEvents="none" className="absolute left-0 right-0 items-center" style={{ top }}>
      <View className="h-8 overflow-hidden rounded-xl border border-border bg-surface-chrome" style={{ width: COMPASS_WIDTH }}>
        {marks}
        {/* An amber caret on the bottom edge, so it never covers a letter. */}
        <View
          testID="compass-marker"
          className="absolute bottom-0"
          style={{ left: COMPASS_WIDTH / 2 - 5, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.accent }}
        />
      </View>
    </View>
  );
}
