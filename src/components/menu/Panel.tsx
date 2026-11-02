import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
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
  fieldTopScrollY,
  focusedFieldScrollY,
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
import { PanelHeaderSlot, PanelScrollContext, PanelScrollerContext, type PanelScroll, type PanelScrollable, type PanelScroller } from './panel-header-slot';

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
  /** The content scrolls itself (a long virtualized list): it gets the panel's scroll props (PanelScrollerContext) instead of a scroll view. */
  ownScroll?: boolean;
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
/**
 * Scrolled further than this shows the header hairline. Android can come to rest a fraction of a point below the
 * top (its offsets are whole pixels), which must still count as the top.
 */
const SCROLLED_MIN = 1;
/** Cast over the content once it scrolls under the header. */
export const HEADER_SHADOW = '0px 6px 14px rgba(0, 0, 0, 0.6)';
/** How far below the header the shadow reaches (its offset and blur), left unclipped. */
const HEADER_SHADOW_REACH = 6 + 14;
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
  ownScroll = false,
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
  // While the keyboard is up the content takes its height as extra room at the end, to scroll a field above it. The
  // panel adds this itself on both platforms: Android draws the app under the keyboard (edge to edge) and gives scroll
  // views no keyboard inset, and iOS's own inset comes too late to scroll the last field (Notes) to the top as it opens.
  const [keyboardInset, setKeyboardInset] = useState(0);
  const keyboardInsetRef = useRef(0);
  useLayoutEffect(() => {
    keyboardInsetRef.current = keyboardInset;
  });
  // The menu's header, drawn pinned above the scroll view (MenuHeader hands it over), and its measured height.
  const [header, setHeader] = useState<MenuHeaderProps | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  // Whether content is scrolled under the header (its hairline and shadow), for the content it was reported by. A report
  // for other content counts for nothing: iOS hands React a scroll after the tap that opened the next menu, so the last
  // menu's "scrolled" can land after the switch. New content opens at the top, or where it was left.
  const [scrollReport, setScrollReport] = useState<{ key: unknown; scrolled: boolean }>({ key: contentKey, scrolled: false });
  const scrolled = scrollReport.key === contentKey ? scrollReport.scrolled : (restoreScrollY ?? 0) > SCROLLED_MIN;
  const scrollKey = useRef(contentKey);
  useLayoutEffect(() => {
    scrollKey.current = contentKey;
  });
  const setScrolled = useCallback((value: boolean) => setScrollReport({ key: scrollKey.current, scrolled: value }), []);
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
  // The drawer is laid out at its full width from the first frame and slides in from the left (transform only, on the
  // UI thread): growing its width instead would re-lay out the menu every frame, its content reflowing as it widens.
  const size = useSharedValue(landscape ? target : 0);
  const dragStart = useSharedValue(0);
  /** Drawer slide: 0 open, -width minimized (and where a new drawer starts, off to the left). */
  const offset = useSharedValue(landscape ? -target : 0);

  // The panel's scroll view, or the list of a menu that scrolls itself.
  const scroller = useRef<PanelScrollable | null>(null);
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
  }, [setScrolled]);
  const panelScroll = useMemo<PanelScroll>(() => ({ scrollToEnd, scrollToTop }), [scrollToEnd, scrollToTop]);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  /** What the content scrolls in, measured to find where a focused field sits in it. */
  const viewport = useRef<View | null>(null);
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

  const onContentSizeChange = useCallback(
    (_w: number, contentHeight: number) => {
      setMeasured({ key: contentKey, height: contentHeight });
      const target = pendingY.current;
      if (target === null) return;
      const reachable = Math.max(0, contentHeight - viewportHeight.current);
      scroller.current?.scrollTo({ y: Math.min(target, reachable), animated: false });
      if (reachable >= target) pendingY.current = null;
    },
    [contentKey],
  );
  // Read when scrolling, so a new callback each render does not give a self-scrolling list new props.
  const onScrollYRef = useRef(onScrollY);
  useEffect(() => {
    onScrollYRef.current = onScrollY;
  });

  useEffect(() => {
    detentRef.current = detent;
    onFrameRef.current = onFrameChange;
  });

  useEffect(() => {
    if (waiting) return;
    // Ease out: the sheet starts moving at once and settles, which reads as quick. The drawer's width is never animated
    // (see `size`): it takes a new width at once, on rotation or a window resize.
    size.set(landscape ? target : withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) }));
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

  // Typing into a field: it scrolls to the top of the panel as the keyboard opens, so what is typed shows above the
  // keyboard (landscape leaves little room). Where it lands depends only on the content, not the sheet's height, so it
  // need not wait for the sheet to grow, only for the room at the end to be laid out. iOS starts as the keyboard starts
  // to open, in one movement with it, and scrolls there again once it is up: the first scroll can fall short (the room
  // not laid out yet, or iOS moving a multiline field to its cursor at the same time). Android reports the keyboard only
  // once it is up.
  const scrollFocusedToTop = useCallback(() => {
    const field = TextInput.State.currentlyFocusedInput() as View | null;
    if (!field) return;
    // Where the field sits in the content does not move with the sheet or the scroll, unlike where it is on screen.
    const content = (scroller.current as { getInnerViewRef?: () => View | null } | null)?.getInnerViewRef?.();
    if (content) {
      // Fails for a field outside the panel (the quick plot box over the map), which leaves the panel where it is.
      field.measureLayout(content, (_x, y) => scroller.current?.scrollTo({ y: fieldTopScrollY(y), animated: true }), () => {});
      return;
    }
    // A menu that scrolls itself (a list) has no content view to measure against: compare where both are on screen.
    const frame = viewport.current;
    if (!frame) return;
    frame.measureInWindow((vx, vy, vw) => {
      field.measureInWindow((fx, fy) => {
        const y = focusedFieldScrollY(scrollY.current, { x: fx, y: fy }, { x: vx, y: vy, width: vw });
        if (y !== null) scroller.current?.scrollTo({ y, animated: true });
      });
    });
  }, []);
  /** The keyboard is opening and the scroll waits for the content's new room to be laid out. */
  const scrollOnceInset = useRef(false);
  useEffect(() => {
    if (!scrollOnceInset.current || keyboardInset === 0) return;
    scrollOnceInset.current = false;
    requestAnimationFrame(scrollFocusedToTop);
  }, [keyboardInset, scrollFocusedToTop]);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const inset = e.endCoordinates.height;
      // The same room as before (shown again without hiding) is already laid out.
      if (inset === keyboardInsetRef.current) requestAnimationFrame(scrollFocusedToTop);
      else {
        scrollOnceInset.current = true;
        setKeyboardInset(inset);
      }
    });
    const settled = Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidShow', () => requestAnimationFrame(scrollFocusedToTop)) : null;
    // Once the keyboard is down: taken away as it closes, the content would shrink under it and jump.
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      scrollOnceInset.current = false;
      setKeyboardInset(0);
    });
    return () => {
      show.remove();
      settled?.remove();
      hide.remove();
    };
  }, [scrollFocusedToTop]);

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

  const headerless = header === null;
  const scrollerProps = useMemo<PanelScroller>(() => {
    const settleHairline = (e: NativeSyntheticEvent<NativeScrollEvent>) => setScrolled(e.nativeEvent.contentOffset.y > SCROLLED_MIN);
    return {
      testID: 'menu-panel-scroll',
      ref: (scrollable) => {
        scroller.current = scrollable;
      },
      onLayout: (e) => {
        viewportHeight.current = e.nativeEvent.layout.height;
      },
      onContentSizeChange,
      onScroll: (e) => {
        const y = e.nativeEvent.contentOffset.y;
        scrollY.current = y;
        setScrolled(y > SCROLLED_MIN);
        onScrollYRef.current?.(y);
      },
      // Where a scroll comes to rest settles the hairline, even when the throttle drops the last scroll event.
      onScrollEndDrag: settleHairline,
      onMomentumScrollEnd: settleHairline,
      scrollEventThrottle: 100,
      keyboardShouldPersistTaps: 'handled',
      // The panel leaves room for the keyboard and scrolls to the field itself (see `keyboardInset`).
      automaticallyAdjustKeyboardInsets: false,
      contentContainerStyle: { paddingBottom: insets.bottom + 16 + keyboardInset, paddingTop: landscape && headerless ? 12 : 0 },
    };
  }, [onContentSizeChange, insets.bottom, keyboardInset, landscape, headerless, setScrolled]);
  const content = (
    <PanelHeaderSlot.Provider value={setHeader}>
      <PanelScrollContext.Provider value={panelScroll}>{children}</PanelScrollContext.Provider>
    </PanelHeaderSlot.Provider>
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
          // Above the content, so its shadow falls over the rows sliding under it. A real (blurred) shadow, not a
          // gradient: on the dark panel a gradient strong enough to see reads as a line. The frame clips it to below
          // the header (it would spill past the drawer's sides), overhanging the content by the shadow's reach without
          // taking its space or its touches.
          <View
            testID="menu-panel-header-frame"
            pointerEvents="box-none"
            style={{ zIndex: 1, overflow: 'hidden', paddingBottom: HEADER_SHADOW_REACH, marginBottom: -HEADER_SHADOW_REACH }}>
            <GestureDetector gesture={pan}>
              {/* Opaque, so the shadow is only cast below it, never seen through it. */}
              <View
                testID="menu-panel-header"
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={{ paddingTop: landscape ? 4 : 0, backgroundColor: colors.surface, boxShadow: scrolled ? HEADER_SHADOW : undefined }}>
                <MenuHeaderRow {...header} />
                {/* A hairline once content scrolls under the header. */}
                <View testID="menu-panel-hairline" className={`h-px bg-border-subtle ${scrolled ? '' : 'opacity-0'}`} />
              </View>
            </GestureDetector>
          </View>
        ) : null}
        {ownScroll ? (
          // The content is its own scroller (a virtualized list inside a scroll view would draw every row).
          <View ref={viewport} testID="menu-panel-scroll-host" style={{ flex: 1 }}>
            <PanelScrollerContext.Provider value={scrollerProps}>{content}</PanelScrollerContext.Provider>
          </View>
        ) : (
          <View ref={viewport} testID="menu-panel-viewport" collapsable={false} style={{ flex: 1 }}>
            <ScrollView {...scrollerProps}>{content}</ScrollView>
          </View>
        )}
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
