import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { formatLength } from '@/features/location/gps-format';
import { OP_EYE_RANGE, useOp } from '@/stores/op';
import { useSettings } from '@/stores/settings';

/** Length of the slider's track in points: top is the highest eye, bottom the lowest. */
export const EYE_TRACK_HEIGHT = 160;
const THUMB = 22;
/** Fixed so the panel does not grow as the height goes from one to three digits (fits `250 m` and `820 ft`). */
const PANEL_WIDTH = 64;
const [MIN, MAX] = OP_EYE_RANGE;

/** Eye height (whole metres) for a touch `y` points down the track, clamped to the range. */
function eyeAt(y: number): number {
  const t = Math.min(1, Math.max(0, y / EYE_TRACK_HEIGHT));
  return Math.round(MAX - t * (MAX - MIN));
}

/**
 * OP mode's eye height control, in the zoom buttons' spot bottom right: a vertical track with the eye height over it.
 * Touching anywhere on the track jumps there; dragging follows the finger.
 */
export function OpEyeSlider() {
  const eyeM = useOp((s) => s.eyeM);
  const altitudeUnit = useSettings((s) => s.altitudeUnit);
  const set = (y: number) => useOp.getState().setEye(eyeAt(y));
  const drag = Gesture.Pan()
    .withTestId('op-eye-drag')
    .minDistance(0)
    .runOnJS(true)
    .onBegin((e) => set(e.y))
    .onUpdate((e) => set(e.y));
  // The thumb stays inside the track: flush with the top at the highest eye, the bottom at the lowest.
  const thumbTop = ((MAX - eyeM) / (MAX - MIN)) * (EYE_TRACK_HEIGHT - THUMB);

  return (
    // Only the track takes touches: swipes that start on the panel around it still turn the view.
    <View testID="op-eye-slider" pointerEvents="box-none" className="items-center gap-2 rounded-2xl border border-border bg-surface-chrome py-2.5" style={{ width: PANEL_WIDTH }}>
      <Text testID="op-eye-label" pointerEvents="none" className="font-mono text-xs font-semibold text-text">
        {formatLength(eyeM, altitudeUnit)}
      </Text>
      <GestureDetector gesture={drag}>
        {/* The touch area is wider than the drawn track so it is easy to grab. */}
        <View accessibilityRole="adjustable" accessibilityLabel="Eye height" className="w-11 items-center" style={{ height: EYE_TRACK_HEIGHT }}>
          <View className="h-full w-1 rounded-full bg-border" />
          <View testID="op-eye-thumb" className="absolute rounded-full border-2 border-accent bg-surface-chrome" style={{ top: thumbTop, width: THUMB, height: THUMB }} />
        </View>
      </GestureDetector>
    </View>
  );
}
