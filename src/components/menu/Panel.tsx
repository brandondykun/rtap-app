import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { EDGE } from '@/features/map/layout';
import { useTheme } from '@/theme/ThemeProvider';

import { detentHeights, drawerWidth, snapIndex, type Detent, type PanelFrame } from './panel-geometry';

type Props = {
  landscape: boolean;
  /** Allowed bottom-sheet detents (portrait). Landscape is a fixed-width full-height drawer. */
  detents: readonly Detent[];
  initialDetent: Detent;
  /** Space a full-height sheet leaves free at the top (safe area + toolbar). */
  topReserved: number;
  /** The menu's name, for the reopen tab's screen-reader label. */
  title?: string;
  /** Landscape: the drawer is slid off screen with only its edge tab showing (the menu stays mounted). */
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  /** Null while the drawer is minimized: the map, crosshair and controls then use the whole screen. */
  onFrameChange: (frame: PanelFrame | null) => void;
  children: ReactNode;
};

/** The minimize / reopen tab on the drawer's right edge. */
const TAB_WIDTH = 28;
const TAB_HEIGHT = 64;
const SLIDE_MS = 220;

/**
 * The one container for every menu: a bottom sheet in portrait, a left drawer in landscape. It has
 * no backdrop — the map stays interactive. The element tree is identical in both orientations, so
 * rotating never remounts the menu (a half-typed form survives).
 */
export function Panel({ landscape, detents, initialDetent, topReserved, title, minimized = false, onMinimizedChange, onFrameChange, children }: Props) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = { width, height, insets, topReserved };
  const heights = detentHeights(metrics);
  const ordered = [...detents].sort((a, b) => heights[a] - heights[b]);
  const stops = ordered.map((d) => heights[d]);
  const [chosen, setDetent] = useState<Detent>(initialDetent);
  // MenuHost reuses this Panel when the menu changes: a detent the new menu does not allow (Add at
  // peek → Settings) is replaced by the new menu's initial detent, so it cannot return with a later
  // menu; an allowed one (Add → Edit) stays.
  if (!detents.includes(chosen)) setDetent(initialDetent);
  const detent = detents.includes(chosen) ? chosen : initialDetent;
  const target = landscape ? drawerWidth(metrics) : heights[detent];
  // Only the landscape drawer minimizes; the portrait sheet already drags down to its peek.
  const hidden = landscape && minimized;
  const detentRef = useRef(detent);
  const restore = useRef<Detent | null>(null);
  const onFrameRef = useRef(onFrameChange);
  const size = useSharedValue(0);
  const dragStart = useSharedValue(0);
  /** Drawer slide: 0 open, -width minimized. */
  const offset = useSharedValue(0);

  useEffect(() => {
    detentRef.current = detent;
    onFrameRef.current = onFrameChange;
  });

  useEffect(() => {
    size.set(withTiming(target, { duration: 220 }));
    onFrameRef.current(hidden ? null : { side: landscape ? 'left' : 'bottom', size: target });
  }, [target, landscape, hidden, size]);

  useEffect(() => {
    offset.set(withTiming(hidden ? -target : 0, { duration: SLIDE_MS }));
  }, [hidden, target, offset]);

  // Keep a focused field visible: the sheet opens fully while the keyboard is up.
  useEffect(() => {
    if (landscape || !detents.includes('full')) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => {
      if (restore.current === null) restore.current = detentRef.current;
      setDetent('full');
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      if (restore.current !== null && detents.includes(restore.current)) setDetent(restore.current);
      restore.current = null;
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
    () =>
      landscape
        ? { width: size.get(), height: '100%', transform: [{ translateX: offset.get() }] }
        : { width: '100%', height: size.get() },
    [landscape],
  );
  // Minimized, the tab becomes a floating button just past the notch (never touching the screen edge).
  // A CSS transition slides it along with the drawer.
  const tabFrame = { left: hidden ? Math.max(insets.left, EDGE) : target, width: TAB_WIDTH };

  const drawer = (
    <Animated.View
      testID="menu-panel"
      style={[{ position: 'absolute', left: 0, bottom: 0 }, animated]}
      pointerEvents={hidden ? 'none' : 'auto'}
      // Off screen, its content must not be reachable by VoiceOver/TalkBack either.
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
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
  if (!landscape) return drawer;
  return (
    <>
      {drawer}
      <Animated.View
        testID="menu-panel-tab-frame"
        style={{
          position: 'absolute',
          top: '50%',
          marginTop: -TAB_HEIGHT / 2,
          height: TAB_HEIGHT,
          ...tabFrame,
          transitionProperty: ['left', 'width'],
          transitionDuration: SLIDE_MS,
        }}>
        <Pressable
          testID="menu-panel-tab"
          accessibilityRole="button"
          accessibilityLabel={hidden ? `Show ${title ?? 'menu'}` : 'Hide menu'}
          onPress={() => onMinimizedChange?.(!hidden)}
          hitSlop={{ top: 8, bottom: 8, right: 12 }}
          className={`h-full w-full items-center justify-center border border-border bg-surface active:opacity-70 ${
            // Attached to the open drawer's edge; a free-standing button when minimized.
            hidden ? 'rounded-xl' : 'rounded-r-xl border-l-0'
          }`}>
          <Icon name={hidden ? 'chevron-right' : 'chevron-left'} size={22} color={colors.text} />
        </Pressable>
      </Animated.View>
    </>
  );
}
