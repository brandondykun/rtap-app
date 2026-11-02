import { useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { glassHalo } from '@/components/ui/glass';
import { formatLength } from '@/features/location/gps-format';
import { OP_EYE_RANGE, useOp } from '@/stores/op';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Length of the slider's track in points (top is the highest eye, bottom the lowest). Where the room up to the toolbar
 * is shorter it shrinks to fit, but never below `EYE_TRACK_MIN`.
 */
export const EYE_TRACK_HEIGHT = 200;
export const EYE_TRACK_MIN = 80;
const THUMB = 22;
/** Fixed so the panel does not grow as the height goes from one to three digits (fits `250 m` and `820 ft`). */
const PANEL_WIDTH = 48;
const [MIN, MAX] = OP_EYE_RANGE;

/** Eye height (whole metres) for a touch `y` points down a track `track` points long, clamped to the range. */
function eyeAt(y: number, track: number): number {
  const t = Math.min(1, Math.max(0, y / track));
  return Math.round(MAX - t * (MAX - MIN));
}

/**
 * OP mode's eye height control, in the zoom buttons' spot bottom right: a vertical track with the eye height over it,
 * shrinking when its parent is short of room. Touching anywhere on the track jumps there; dragging follows the finger.
 */
export function OpEyeSlider() {
  const { colors } = useTheme();
  const eyeM = useOp((s) => s.eyeM);
  const altitudeUnit = useSettings((s) => s.altitudeUnit);
  const [track, setTrack] = useState(EYE_TRACK_HEIGHT);
  const set = (y: number) => useOp.getState().setEye(eyeAt(y, track));
  const drag = Gesture.Pan()
    .withTestId('op-eye-drag')
    .minDistance(0)
    .runOnJS(true)
    .onBegin((e) => set(e.y))
    .onUpdate((e) => set(e.y));
  // The thumb stays inside the track: flush with the top at the highest eye, the bottom at the lowest.
  const thumbTop = ((MAX - eyeM) / (MAX - MIN)) * (track - THUMB);

  return (
    // Only the track takes touches: swipes that start on the panel around it still turn the view.
    <View testID="op-eye-slider" pointerEvents="box-none" className="shrink items-center gap-2 rounded-2xl bg-surface-glass py-2.5" style={{ width: PANEL_WIDTH }}>
      <Text testID="op-eye-label" pointerEvents="none" className="font-mono text-xs font-semibold text-text" style={glassHalo(colors)}>
        {formatLength(eyeM, altitudeUnit)}
      </Text>
      <GestureDetector gesture={drag}>
        {/* The touch area is wider than the drawn track so it is easy to grab. */}
        <View
          testID="op-eye-track"
          accessibilityRole="adjustable"
          accessibilityLabel="Eye height"
          className="w-11 shrink items-center"
          style={{ height: EYE_TRACK_HEIGHT, minHeight: EYE_TRACK_MIN }}
          onLayout={(e) => setTrack(e.nativeEvent.layout.height)}>
          <View className="h-full w-1 rounded-full bg-text-muted" />
          <View testID="op-eye-thumb" className="absolute rounded-full border-2 border-accent bg-surface-chrome" style={{ top: thumbTop, width: THUMB, height: THUMB }} />
        </View>
      </GestureDetector>
    </View>
  );
}
