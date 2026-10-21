import { useEffect, useMemo, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useOp } from '@/stores/op';

/** Degrees turned per point dragged sideways, and tilted per point dragged vertically. */
export const OP_TURN_PER_PT = 0.25;
export const OP_TILT_PER_PT = 0.2;

/** Swipe to look and pinch to magnify while standing at an OP; the map under it is magnified by the store zoom. */
export function OpGestures({ children }: { children: ReactNode }) {
  const on = useOp((s) => s.phase === 'on');
  const zoom = useOp((s) => s.zoom);
  const scale = useSharedValue(zoom);
  useEffect(() => {
    scale.value = zoom;
  }, [scale, zoom]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const startZoom = useSharedValue(1);
  const gesture = useMemo(() => {
    const { look, setZoom } = useOp.getState();
    const pan = Gesture.Pan()
      .withTestId('op-pan')
      .enabled(on)
      .maxPointers(1)
      .runOnJS(true)
      .onChange((e) => look(e.changeX * OP_TURN_PER_PT, e.changeY * OP_TILT_PER_PT));
    const pinch = Gesture.Pinch()
      .withTestId('op-pinch')
      .enabled(on)
      .runOnJS(true)
      .onStart(() => {
        startZoom.set(useOp.getState().zoom);
      })
      .onUpdate((e) => setZoom(startZoom.get() * e.scale));
    return Gesture.Simultaneous(pan, pinch);
  }, [on, startZoom]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
