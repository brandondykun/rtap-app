import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useOp } from '@/stores/op';

/** Degrees turned per point dragged sideways, and tilted per point dragged vertically. */
export const OP_TURN_PER_PT = 0.25;
export const OP_TILT_PER_PT = 0.2;

/** Swipe to look while standing at an OP. */
export function OpGestures({ children }: { children: ReactNode }) {
  const on = useOp((s) => s.phase === 'on');
  const gesture = useMemo(() => {
    const { look } = useOp.getState();
    return Gesture.Pan()
      .withTestId('op-pan')
      .enabled(on)
      .maxPointers(1)
      .runOnJS(true)
      .onChange((e) => look(-e.changeX * OP_TURN_PER_PT, e.changeY * OP_TILT_PER_PT));
  }, [on]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
