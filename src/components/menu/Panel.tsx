import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { detentHeights, drawerWidth, snapIndex, type Detent, type PanelFrame } from './panel-geometry';

type Props = {
  landscape: boolean;
  /** Allowed bottom-sheet detents (portrait). Landscape is a fixed-width full-height drawer. */
  detents: readonly Detent[];
  initialDetent: Detent;
  /** Space a full-height sheet leaves free at the top (safe area + toolbar). */
  topReserved: number;
  onFrameChange: (frame: PanelFrame) => void;
  children: ReactNode;
};

/**
 * The one container for every menu: a bottom sheet in portrait, a left drawer in landscape. It has
 * no backdrop — the map stays interactive. The element tree is identical in both orientations, so
 * rotating never remounts the menu (a half-typed form survives).
 */
export function Panel({ landscape, detents, initialDetent, topReserved, onFrameChange, children }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = { width, height, insets, topReserved };
  const heights = detentHeights(metrics);
  const ordered = [...detents].sort((a, b) => heights[a] - heights[b]);
  const stops = ordered.map((d) => heights[d]);
  const [detent, setDetent] = useState<Detent>(initialDetent);
  const target = landscape ? drawerWidth(metrics) : heights[detent];
  const size = useSharedValue(0);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    size.set(withTiming(target, { duration: 220 }));
    onFrameChange({ side: landscape ? 'left' : 'bottom', size: target });
  }, [target, landscape, onFrameChange, size]);

  // Keep a focused field visible: the sheet opens fully while the keyboard is up.
  useEffect(() => {
    if (landscape || !detents.includes('full')) return;
    let before: Detent | null = null;
    const show = Keyboard.addListener('keyboardWillShow', () =>
      setDetent((current) => {
        before = current;
        return 'full';
      }),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () => {
      if (before) setDetent(before);
      before = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [landscape, detents]);

  const pan = Gesture.Pan()
    .enabled(!landscape)
    .onBegin(() => {
      dragStart.set(size.get());
    })
    .onUpdate((e) => {
      size.set(Math.min(stops[stops.length - 1], Math.max(stops[0], dragStart.get() - e.translationY)));
    })
    .onEnd((e) => {
      const i = snapIndex(size.get(), -e.velocityY, stops);
      size.set(withTiming(stops[i], { duration: 180 }));
      runOnJS(setDetent)(ordered[i]);
    });

  const animated = useAnimatedStyle(
    () => (landscape ? { width: size.value, height: '100%' } : { width: '100%', height: size.get() }),
    [landscape],
  );

  return (
    <Animated.View
      testID="menu-panel"
      style={[{ position: 'absolute', left: 0, bottom: 0 }, animated]}
      className={landscape ? 'border-r border-border bg-surface' : 'rounded-t-3xl border-t border-border bg-surface'}>
      <View style={{ flex: 1, paddingLeft: landscape ? insets.left : 0, paddingTop: landscape ? insets.top : 0 }}>
        {landscape ? null : (
          <GestureDetector gesture={pan}>
            <View testID="menu-panel-handle" accessibilityLabel="Resize panel" className="items-center py-3">
              <View className="h-1 w-10 rounded-full bg-border" />
            </View>
          </GestureDetector>
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingTop: landscape ? 12 : 0 }}>
          {children}
        </ScrollView>
      </View>
    </Animated.View>
  );
}
