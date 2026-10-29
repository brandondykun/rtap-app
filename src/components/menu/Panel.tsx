import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { EDGE } from '@/features/map/layout';
import { useTheme } from '@/theme/ThemeProvider';

import {
  detentHeights,
  drawerWidth,
  fitToContent,
  MINIMIZED_BAR_HEIGHT,
  MINIMIZED_BAR_MARGIN,
  MINIMIZED_BAR_SIDE,
  minimizedBarSize,
  RAIL_WIDTH,
  SHEET_CHROME_HEIGHT,
  SHEET_EDGE_HEIGHT,
  SHEET_HANDLE_HEIGHT,
  snapIndex,
  type Detent,
  type PanelFrame,
} from './panel-geometry';
import { MenuHeaderRow, type MenuHeaderProps } from './MenuHeader';
import { PanelHeaderSlot, PanelScrollContext, type PanelScroll } from './panel-header-slot';

type Props = {
  landscape: boolean;
  /** Allowed bottom-sheet detents (portrait). Landscape is a fixed-width full-height drawer. */
  detents: readonly Detent[];
  initialDetent: Detent;
  /** Space a full-height sheet leaves free at the top (safe area + toolbar). */
  topReserved: number;
  /** The menu's name, for the reopen tab's screen-reader label. */
  title?: string;
  /** The panel is slid off screen (left in landscape, down in portrait) with only its reopen button showing; the menu stays mounted. */
  minimized?: boolean;
  /** What the minimized button shows: the menu's icon, a label with an amber detail, and their spoken form. */
  minimizedTab?: { icon: IconName; label: string; detail: string | null; spoken: string };
  onMinimizedChange?: (minimized: boolean) => void;
  /** Null while the drawer is minimized (the map, crosshair and controls then use the whole screen); minimized in portrait, the reopen bar. */
  onFrameChange: (frame: PanelFrame | null) => void;
  /** What is shown (one menu-stack entry): new content starts at the top, or at `restoreScrollY`. */
  contentKey?: unknown;
  /** Where to scroll new content to (a menu drilled back into), once it is long enough to get there. */
  restoreScrollY?: number;
  onScrollY?: (y: number) => void;
  children: ReactNode;
};

/** The floating button that shows the minimized drawer again: icon, a vertical label, then a chevron (across the bottom in portrait). */
const TAB_WIDTH = 36;
const TAB_HEIGHT = 180;
/** Room for the vertical label between the icon and the chevron (the label's length before rotating). */
const TAB_LABEL_LENGTH = 104;
const SLIDE_MS = 220;
/** How long a portrait sheet waits for its content to be measured before opening anyway. */
const MEASURE_WAIT_MS = 250;
/** No content given up on yet (distinct from every content key, `undefined` included). */
const NOT_YET = Symbol('not yet');

/**
 * The one container for every menu: a bottom sheet in portrait, a left drawer in landscape. It has
 * no backdrop — the map stays interactive. The element tree is identical in both orientations, so
 * rotating never remounts the menu (a half-typed form survives).
 */
export function Panel({
  landscape,
  detents,
  initialDetent,
  topReserved,
  title,
  minimized = false,
  minimizedTab,
  onMinimizedChange,
  onFrameChange,
  contentKey,
  restoreScrollY,
  onScrollY,
  children,
}: Props) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = { width, height, insets, topReserved };
  // Measured scroll content: a short menu's sheet opens only as tall as it needs (not while the keyboard is up).
  const [measured, setMeasured] = useState<{ key: unknown; height: number } | null>(null);
  /** The content the measuring wait gave up on (MEASURE_WAIT_MS): its sheet sizes by what is known. */
  const [gaveUpOn, setGaveUpOn] = useState<unknown>(NOT_YET);
  const [keyboardUp, setKeyboardUp] = useState(false);
  // The menu's header, drawn pinned above the scroll view (MenuHeader hands it over), and its measured height.
  const [header, setHeader] = useState<MenuHeaderProps | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const gaveUp = gaveUpOn === contentKey;
  const contentKnown = measured !== null && (measured.key === contentKey || gaveUp) ? measured.height : null;
  const known = contentKnown === null || (header !== null && headerHeight === null && !gaveUp) ? null : contentKnown;
  // Above the content: the edge, then the pinned header (the drag area) or the grip row.
  const chrome = header !== null ? SHEET_EDGE_HEIGHT + (headerHeight ?? 0) : SHEET_CHROME_HEIGHT;
  // Until new content is measured the sheet holds still (closed on first open), then moves once: easing toward a
  // detent and turning to the fitted height halfway looks like a stutter, and moves the map chrome twice.
  const waiting = !landscape && !minimized && !keyboardUp && known === null && !gaveUp;
  const heights = fitToContent(detentHeights(metrics), landscape || keyboardUp ? null : known, chrome);
  const ordered = [...detents].sort((a, b) => heights[a] - heights[b]);
  const stops = ordered.map((d) => heights[d]);
  const [chosen, setDetent] = useState<Detent>(initialDetent);
  // MenuHost reuses this Panel when the menu changes: a detent the new menu does not allow (Add at
  // peek → Settings) is replaced by the new menu's initial detent, so it cannot return with a later
  // menu; an allowed one (Add → Edit) stays.
  if (!detents.includes(chosen)) setDetent(initialDetent);
  const detent = detents.includes(chosen) ? chosen : initialDetent;
  const target = landscape ? drawerWidth(metrics) : heights[detent];
  // Minimizing survives rotation: the drawer slides off to the left, the sheet down past the bottom edge.
  const hidden = minimized;
  const detentRef = useRef(detent);
  const restore = useRef<Detent | null>(null);
  const onFrameRef = useRef(onFrameChange);
  const size = useSharedValue(0);
  const dragStart = useSharedValue(0);
  /** Drawer slide: 0 open, -width minimized. */
  const offset = useSharedValue(0);

  const scroller = useRef<ScrollView>(null);
  const scrollToEnd = useCallback(() => scroller.current?.scrollToEnd({ animated: true }), []);
  const scrollToTop = useCallback(() => {
    // A jump sends no scroll event, so the hairline under the header is cleared here too.
    const top = () => {
      scroller.current?.scrollTo({ y: 0, animated: false });
      setScrolled(false);
    };
    top();
    // Closing the keyboard (it is often still up, from the form) resizes the content's inset and can move it again.
    if (!Keyboard.isVisible()) return;
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      hidden.remove();
      top();
    });
  }, []);
  // In portrait the sheet grows to full when the keyboard shows, so a field must scroll itself into view after.
  const panelScroll = useMemo<PanelScroll>(() => ({ scrollToEnd, scrollToTop, scrollAsKeyboardShows: landscape && Platform.OS === 'ios' }), [scrollToEnd, scrollToTop, landscape]);
  const viewportHeight = useRef(0);
  /** A remembered position not yet reached (the content is still loading). */
  const pendingY = useRef<number | null>(null);
  const shownKey = useRef(contentKey);

  useEffect(() => {
    if (shownKey.current === contentKey) return;
    shownKey.current = contentKey;
    if (restoreScrollY) pendingY.current = restoreScrollY;
    else {
      pendingY.current = null;
      scroller.current?.scrollTo({ y: 0, animated: false });
    }
  }, [contentKey, restoreScrollY]);

  const onContentSizeChange = (_w: number, contentHeight: number) => {
    setMeasured({ key: contentKey, height: contentHeight });
    const target = pendingY.current;
    if (target === null) return;
    const reachable = Math.max(0, contentHeight - viewportHeight.current);
    scroller.current?.scrollTo({ y: Math.min(target, reachable), animated: false });
    if (reachable >= target) pendingY.current = null;
  };

  useEffect(() => {
    detentRef.current = detent;
    onFrameRef.current = onFrameChange;
  });

  useEffect(() => {
    if (waiting) return;
    // Ease out: the panel starts moving at once and settles, which reads as quick.
    size.set(withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) }));
    if (!hidden) onFrameRef.current({ side: landscape ? 'left' : 'bottom', size: target });
    // Minimized in portrait the reopen bar runs along the bottom, under the grid readouts.
    else onFrameRef.current(landscape ? null : { side: 'bottom', size: minimizedBarSize(insets.bottom) });
  }, [target, landscape, hidden, waiting, size, insets.bottom]);

  // A measurement that never comes (nothing to lay out) must not keep the sheet closed.
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setGaveUpOn(() => contentKey), MEASURE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting, contentKey]);

  useEffect(() => {
    offset.set(withTiming(hidden ? (landscape ? -target : target) : 0, { duration: SLIDE_MS }));
  }, [hidden, target, landscape, offset]);

  // Keep a focused field visible: the sheet opens fully while the keyboard is up.
  useEffect(() => {
    if (landscape || !detents.includes('full')) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => {
      if (restore.current === null) restore.current = detentRef.current;
      setKeyboardUp(true);
      setDetent('full');
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      if (restore.current !== null && detents.includes(restore.current)) setDetent(restore.current);
      restore.current = null;
      setKeyboardUp(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [landscape, detents]);

  const pan = Gesture.Pan()
    .enabled(!landscape && !hidden)
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

  // Both orientations set both translations, so a slide left over from the other orientation never strands the panel off screen.
  const animated = useAnimatedStyle(
    () =>
      landscape
        ? { width: size.get(), height: '100%', transform: [{ translateX: offset.get() }, { translateY: 0 }] }
        : { width: '100%', height: size.get(), transform: [{ translateX: 0 }, { translateY: offset.get() }] },
    [landscape],
  );

  const drawer = (
    <Animated.View
      testID="menu-panel"
      style={[{ position: 'absolute', left: 0, bottom: 0 }, animated]}
      pointerEvents={hidden ? 'none' : 'auto'}
      // Off screen, its content must not be reachable by VoiceOver/TalkBack either.
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      className={
        landscape ? 'flex-row border-r border-border bg-surface' : 'border-t border-border bg-surface'
      }>
      {/* Landscape: the content column starts past the notch and is edged there, so dividers end on a line, not in the gap. */}
      <View
        testID="menu-panel-column"
        style={{ flex: 1, marginLeft: landscape ? insets.left : 0, paddingTop: landscape ? insets.top : 0 }}
        className={landscape ? 'border-l border-border-subtle' : undefined}>
        {landscape ? null : (
          <>
            {/* The whole top edge hides the sheet, like the drawer's right-edge rail. */}
            <Pressable
              testID="menu-panel-rail"
              accessibilityRole="button"
              accessibilityLabel="Hide menu"
              onPress={() => onMinimizedChange?.(true)}
              style={{ height: RAIL_WIDTH }}
              className="w-full items-center justify-center border-b border-border bg-surface-raised active:opacity-60">
              <Icon name="chevron-down" size={16} color={colors.text} />
            </Pressable>
            {header === null ? (
              <GestureDetector gesture={pan}>
                <View testID="menu-panel-handle" accessibilityLabel="Resize panel" style={{ height: SHEET_HANDLE_HEIGHT }} className="items-center justify-center">
                  <Icon testID="menu-panel-grip" name="drag-horizontal" size={20} color={colors['text-muted']} />
                </View>
              </GestureDetector>
            ) : null}
          </>
        )}
        {header !== null ? (
          // Pinned: Close / Back and the primary action stay in reach however far the content scrolls. In portrait the
          // row is also the drag area, so the sheet needs no separate handle row.
          <GestureDetector gesture={pan}>
            <View testID="menu-panel-header" onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)} style={{ paddingTop: landscape ? 4 : 0 }}>
              <MenuHeaderRow {...header} />
              {/* A hairline once content scrolls under the header. */}
              <View testID="menu-panel-hairline" className={`h-px bg-border-subtle ${scrolled ? '' : 'opacity-0'}`} />
            </View>
          </GestureDetector>
        ) : null}
        <ScrollView
          testID="menu-panel-scroll"
          ref={scroller}
          onLayout={(e) => {
            viewportHeight.current = e.nativeEvent.layout.height;
          }}
          onContentSizeChange={onContentSizeChange}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setScrolled(y > 0);
            onScrollY?.(y);
          }}
          scrollEventThrottle={100}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingTop: landscape && header === null ? 12 : 0 }}>
          <PanelHeaderSlot.Provider value={setHeader}>
            <PanelScrollContext.Provider value={panelScroll}>{children}</PanelScrollContext.Provider>
          </PanelHeaderSlot.Provider>
        </ScrollView>
      </View>
      {landscape ? (
        // The whole right edge hides the drawer; the menu content gives up this width.
        <Pressable
          testID="menu-panel-rail"
          accessibilityRole="button"
          accessibilityLabel="Hide menu"
          onPress={() => onMinimizedChange?.(true)}
          style={{ width: RAIL_WIDTH }}
          className="h-full items-center justify-center border-l border-border bg-surface-raised active:opacity-60">
          <Icon name="chevron-left" size={16} color={colors.text} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
  if (!hidden) return drawer;
  const spoken = [`Show ${title ?? 'menu'}`, minimizedTab && minimizedTab.spoken !== title ? minimizedTab.spoken : null].filter(Boolean).join(', ');
  if (!landscape) {
    return (
      <>
        {drawer}
        {/* Minimized in portrait: the same button laid across the very bottom, under the grid readouts. */}
        <View
          testID="menu-panel-tab-frame"
          style={{
            position: 'absolute',
            bottom: Math.max(insets.bottom, MINIMIZED_BAR_MARGIN),
            left: insets.left + MINIMIZED_BAR_SIDE,
            right: insets.right + MINIMIZED_BAR_SIDE,
            height: MINIMIZED_BAR_HEIGHT,
          }}>
          <Pressable
            testID="menu-panel-tab"
            accessibilityRole="button"
            accessibilityLabel={spoken}
            onPress={() => onMinimizedChange?.(false)}
            hitSlop={{ top: 8, left: 8, right: 8 }}
            className="h-full w-full flex-row items-center gap-3 rounded-xl border border-accent bg-surface px-3 active:opacity-60">
            <Icon name={minimizedTab?.icon ?? 'menu'} size={20} color={colors.accent} />
            <Text testID="menu-panel-tab-label" numberOfLines={1} className="flex-1 text-center font-mono-bold text-sm text-text">
              {minimizedTab?.label ?? title ?? 'Menu'}
              {minimizedTab?.detail ? <Text className="text-accent">{`  ${minimizedTab.detail}`}</Text> : null}
            </Text>
            <Icon name="chevron-up" size={22} color={colors.accent} />
          </Pressable>
        </View>
      </>
    );
  }
  return (
    <>
      {drawer}
      {/* Minimized: a floating button just past the notch (never touching the screen edge) brings it back. */}
      <View
        testID="menu-panel-tab-frame"
        style={{ position: 'absolute', top: '50%', marginTop: -TAB_HEIGHT / 2, height: TAB_HEIGHT, width: TAB_WIDTH, left: Math.max(insets.left, EDGE) }}>
        <Pressable
          testID="menu-panel-tab"
          accessibilityRole="button"
          accessibilityLabel={spoken}
          onPress={() => onMinimizedChange?.(false)}
          hitSlop={{ top: 8, bottom: 8, right: 12 }}
          className="h-full w-full items-center justify-between rounded-xl border border-accent bg-surface py-3 active:opacity-60">
          <Icon name={minimizedTab?.icon ?? 'menu'} size={20} color={colors.accent} />
          {minimizedTab ? (
            // A spine label: laid out at its length, then turned to read bottom to top.
            <View style={{ height: TAB_LABEL_LENGTH, width: TAB_WIDTH }} className="items-center justify-center">
              <Text
                testID="menu-panel-tab-label"
                numberOfLines={1}
                style={{ width: TAB_LABEL_LENGTH, transform: [{ rotate: '-90deg' }] }}
                className="text-center font-mono-bold text-sm text-text">
                {minimizedTab.label}
                {minimizedTab.detail ? <Text className="text-accent">{`  ${minimizedTab.detail}`}</Text> : null}
              </Text>
            </View>
          ) : null}
          <Icon name="chevron-right" size={22} color={colors.accent} />
        </Pressable>
      </View>
    </>
  );
}
