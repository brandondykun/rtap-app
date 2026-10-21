import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useOp } from '@/stores/op';
import { useTheme } from '@/theme/ThemeProvider';

/** Width of the tape in points; it shows `VIEW_DEG` degrees of the horizon. */
export const COMPASS_WIDTH = 300;
const VIEW_DEG = 120;
const PX_PER_DEG = COMPASS_WIDTH / VIEW_DEG;
const CENTER = COMPASS_WIDTH / 2;
const TICK_STEP = 5;
const LABELS: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

/**
 * Every mark the tape can show, drawn once: half a view either side of 0–360°, so any heading has marks across the
 * whole tape and wrapping past north needs no redraw.
 */
const MARKS = Array.from({ length: (360 + VIEW_DEG) / TICK_STEP + 1 }, (_, i) => -VIEW_DEG / 2 + i * TICK_STEP);

/** Where the mark for `deg` sits on the tape while facing `bearing` (both true degrees; `deg` may be outside 0–360). */
export function markX(deg: number, bearing: number): number {
  return CENTER + (deg - bearing) * PX_PER_DEG;
}

/**
 * OP mode only: a compass tape under the toolbar that slides as the view turns, so the direction being faced (true
 * north based, like the camera) is always over the amber caret. The marks are drawn once; turning only moves them on
 * the UI thread, so swiping does not re-render anything here.
 */
export function OpCompass({ top }: { top: number }) {
  const { colors } = useTheme();
  const on = useOp((s) => s.phase === 'on');
  const shift = useSharedValue(-useOp.getState().bearing * PX_PER_DEG);
  useEffect(
    () =>
      useOp.subscribe((s, prev) => {
        if (s.bearing !== prev.bearing) shift.set(-s.bearing * PX_PER_DEG);
      }),
    [shift],
  );
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }));
  if (!on) return null;

  return (
    <View testID="op-compass" pointerEvents="none" className="absolute left-0 right-0 items-center" style={{ top }}>
      <View className="h-8 overflow-hidden rounded-xl border border-border bg-surface-chrome" style={{ width: COMPASS_WIDTH }}>
        <Animated.View testID="compass-tape" className="absolute inset-0" style={slide}>
          {MARKS.map((deg) => {
            const label = LABELS[(deg + 360) % 360];
            return (
              // A zero-width anchor at the mark's spot (facing north); the tick and letter center on it.
              <View key={deg} testID={label ? `compass-label-${label}` : undefined} className="absolute top-0 items-center" style={{ left: markX(deg, 0), width: 0 }}>
                <View className={deg % 15 === 0 ? 'h-2.5 w-px bg-text' : 'h-1.5 w-px bg-text-muted'} />
                {label ? <Text className="w-8 text-center font-mono text-[11px] font-semibold text-text">{label}</Text> : null}
              </View>
            );
          })}
        </Animated.View>
        {/* An amber caret on the bottom edge, so it never covers a letter. */}
        <View
          testID="compass-marker"
          className="absolute bottom-0"
          style={{ left: CENTER - 5, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.accent }}
        />
      </View>
    </View>
  );
}
