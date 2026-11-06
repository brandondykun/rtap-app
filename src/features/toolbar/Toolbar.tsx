import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassHalo } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EDGE, TOOL_INSET } from '@/features/map/layout';
import { useMenu } from '@/stores/menu';
import { useTheme } from '@/theme/ThemeProvider';

import { useToolbarHeight } from './use-toolbar-height';
import { ToolButton } from './ToolButton';

export type ToolId = 'unit' | 'point' | 'line' | 'polygon' | 'measure' | 'layers' | 'plot' | 'op';

type Props = {
  landscape: boolean;
  activeTool: ToolId | null;
  onMenu?: () => void;
  onUnit?: () => void;
  onPoint?: () => void;
  onLine?: () => void;
  onPolygon?: () => void;
  onMeasure?: () => void;
  onLayers?: () => void;
  onPlot?: () => void;
  /** The AVG toggle, after PLOT: lit while the position is being averaged. */
  averageOn?: boolean;
  /** Averaging is paused (or away) and holding its average: the toggle shows a pause icon. */
  averageHeld?: boolean;
  onAverage?: () => void;
  /** The LABELS toggle, the last tool: a label icon while map labels show, a crossed-out one while hidden. */
  labelsOn?: boolean;
  onLabels?: () => void;
  /** The 3D toggle, after LABELS: its icon shows whether the map is in 3D. */
  threeDOn?: boolean;
  onThreeD?: () => void;
  /** The OP tool, after 3D: pick a spot to look out over the 3D map from. */
  onOp?: () => void;
  /** Landscape: the width of the menu drawer open on the left (0 when closed or minimized); the toolbar narrows to its right. */
  panelInset?: number;
};

/** The drawer's slide, so the toolbar narrows and widens with it. */
const SQUEEZE_MS = 220;

/**
 * The landscape toolbar's width: its own (`natural`, all tools in a row), or with a drawer open on the left
 * (`panelInset` wide), no wider than the room right of it, EDGE clear of the drawer and of the screen's right edge.
 */
export function landscapeToolbarWidth({ natural, windowWidth, insetRight, panelInset }: { natural: number; windowWidth: number; insetRight: number; panelInset: number }): number {
  if (panelInset <= 0) return natural;
  return Math.min(natural, windowWidth - insetRight - EDGE - (panelInset + EDGE));
}

/**
 * Top bar in both orientations: full width in portrait, top-right (content width) in landscape so a left panel never
 * covers it. Tools scroll horizontally in portrait if they overflow. In landscape, while the menu drawer is open, the
 * bar narrows to the space right of it (with the drawer's slide) and its tools scroll there if they no longer fit.
 */
export function Toolbar({ landscape, activeTool, onMenu, onUnit, onPoint, onLine, onPolygon, onMeasure, onLayers, onPlot, averageOn = false, averageHeld = false, onAverage, labelsOn = true, onLabels, threeDOn = false, onThreeD, onOp, panelInset = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const height = useToolbarHeight();
  const position = landscape
    ? { top: insets.top + EDGE, right: insets.right + EDGE }
    : { top: insets.top + EDGE, left: insets.left + EDGE, right: insets.right + EDGE };

  // Landscape: the tools always sit in the scroller (nothing remounts as the drawer opens and closes), and the bar is
  // given its width: its own (menu and divider, then every tool), or the room right of an open drawer. The width
  // animates on the UI thread alone. The scroller's view is worked out from the bar's target width, not measured, so
  // the bar is not re-rendered on every frame of the animation.
  const [leadWidth, setLeadWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const natural = leadWidth > 0 && contentWidth > 0 ? TOOL_INSET + leadWidth + contentWidth : 0;
  const target = landscapeToolbarWidth({ natural, windowWidth, insetRight: insets.right, panelInset });
  const overflow = useOverflow(landscape ? Math.max(0, target - TOOL_INSET - leadWidth) : null);
  // Portrait: the full width between the screen's edges.
  const portraitWidth = windowWidth - insets.left - insets.right - 2 * EDGE;
  const width = useSharedValue(landscape ? 0 : portraitWidth);
  // The width last aimed at: aiming at it again (a later render with the same target) must not restart the animation.
  const aimedAt = useRef(0);
  const aim = useCallback(
    (to: number, animated = true) => {
      // Nor at a width under a point off: Android measures the tools a pixel apart at each width, and re-aiming for
      // that wobbled the bar between the two for good.
      if (Math.abs(to - aimedAt.current) < SLACK) return;
      // The first width is set at once, not grown from nothing.
      width.set(aimedAt.current === 0 || !animated ? to : withTiming(to, { duration: SQUEEZE_MS }));
      aimedAt.current = to;
    },
    [width],
  );
  // The width is always the animated value, in portrait too: a width Reanimated has set stays on the view after the
  // animated style is dropped, so turning back to portrait would keep the landscape width (the bar ran off the left edge
  // and could not scroll). Each turn sets the new width at once.
  useEffect(() => {
    if (landscape) return;
    width.set(portraitWidth);
    aimedAt.current = 0;
  }, [landscape, portraitWidth, width]);
  useEffect(() => {
    if (landscape && natural > 0) aim(target);
  }, [landscape, natural, target, aim]);
  // Closing or minimizing the menu snaps the bar back to its width from the tap: growing, its tools trail slowly after
  // the drawer, and waiting for the map to re-render for the drawer width in `panelInset` is a visible delay on Android.
  useEffect(() => {
    if (!landscape || natural === 0) return;
    return useMenu.subscribe((state) => {
      if (state.stack.length === 0 || state.panelMinimized) aim(natural, false);
    });
  }, [landscape, natural, aim]);
  const animatedWidth = useAnimatedStyle(() => ({ width: width.get() }));

  const tool = (id: string, node: ReactNode) => (
    <View key={id} onLayout={(e) => overflow.setToolFrame(id, e.nativeEvent.layout)}>
      {node}
    </View>
  );
  const tools = [
    tool('layers', <ToolButton icon="layers-outline" label="LAYERS" active={activeTool === 'layers'} onPress={onLayers} />),
    tool('unit', <ToolButton icon="rhombus-outline" label="UNIT" active={activeTool === 'unit'} onPress={onUnit} />),
    tool('point', <ToolButton icon="map-marker-outline" label="POINT" active={activeTool === 'point'} onPress={onPoint} />),
    tool('line', <ToolButton icon="vector-polyline" label="LINE" active={activeTool === 'line'} onPress={onLine} />),
    tool('polygon', <ToolButton icon="pentagon-outline" label="POLYGON" active={activeTool === 'polygon'} onPress={onPolygon} />),
    tool('measure', <ToolButton icon="ruler" label="MEASURE" active={activeTool === 'measure'} onPress={onMeasure} />),
    tool('plot', <ToolButton icon="target" label="PLOT" active={activeTool === 'plot'} onPress={onPlot} />),
    tool('avg', <ToolButton icon={averageHeld ? 'pause-circle-outline' : 'crosshairs-gps'} label="AVG" active={averageOn} toggled={averageOn} onPress={onAverage} />),
    // Toggles, not tools: their icons show the state, with no highlight.
    tool('labels', <ToolButton icon={labelsOn ? 'label-outline' : 'label-off-outline'} label="LABELS" toggled={labelsOn} onPress={onLabels} />),
    tool('3d', <ToolButton icon={threeDOn ? 'video-3d' : 'video-3d-off'} label="3D" toggled={threeDOn} onPress={onThreeD} />),
    tool('op', <ToolButton icon="binoculars" label="OP" active={activeTool === 'op'} onPress={onOp} />),
  ];

  // The lit tool stays in view: switching tools, or the bar narrowing, scrolls it in if it was out of sight.
  const { reveal } = overflow;
  useEffect(() => {
    if (activeTool) reveal(activeTool);
  }, [activeTool, reveal]);

  return (
    <Animated.View
      testID="toolbar"
      // Its left end is padded like its top and bottom; the scroller carries the right end's padding.
      // Landscape: hidden for the frame before its width is known.
      style={[position, { height, paddingLeft: TOOL_INSET }, animatedWidth, landscape && natural === 0 ? { opacity: 0 } : null]}
      // Clipped to its rounded ends. The tools run right up to the right end and vanish under its curve (the scroller
      // carries that end's padding), so the shade must follow the curve too.
      className="absolute flex-row items-center overflow-hidden rounded-2xl bg-surface-glass">
      <View testID="toolbar-lead" className="flex-row items-center" onLayout={(e) => setLeadWidth(e.nativeEvent.layout.width)}>
        <BarIcon icon="menu" label="Menu" onPress={onMenu} />
        <Divider flush lit={overflow.hiddenStart} />
      </View>
      <ToolScroller overflow={overflow} onContentWidth={setContentWidth}>
        {tools}
      </ToolScroller>
    </Animated.View>
  );
}

/** Allowance for subpixel offsets, so a scroller resting at an end shows no shade there. */
const SLACK = 1;
const SHADE_WIDTH = 20;
/** The tools' inset from the divider at the scroller's start. */
const SCROLL_INSET = 6;

type Overflow = ReturnType<typeof useOverflow>;

/**
 * Whether the scrolling tools are out of sight at either end, the scroller props that track it, and `reveal`, which
 * scrolls a tool into view.
 */
function useOverflow(viewport: number | null) {
  const [measured, setWidth] = useState(0);
  // Given (landscape, from the bar's target width), or measured from the scroller (portrait).
  const width = viewport ?? measured;
  const [contentWidth, setContentWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const scroller = useRef<ScrollView | null>(null);
  const exactOffset = useRef(0);
  const frames = useRef(new Map<string, { x: number; width: number }>());
  const hiddenStart = offset > SLACK;
  const hiddenEnd = width > 0 && offset + width < contentWidth - SLACK;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    exactOffset.current = x;
    // Only re-render when a shade would appear or disappear.
    if (x > SLACK !== hiddenStart || x + width < contentWidth - SLACK !== hiddenEnd) setOffset(x);
  };
  const setToolFrame = (id: string, frame: { x: number; width: number }) => frames.current.set(id, { x: frame.x, width: frame.width });
  const reveal = useCallback(
    (id: string) => {
      const frame = frames.current.get(id);
      if (!frame || width === 0) return;
      // Clear of the shades at both ends.
      const start = frame.x - SHADE_WIDTH;
      const end = frame.x + frame.width + SHADE_WIDTH - width;
      const x = exactOffset.current;
      if (start < x) scroller.current?.scrollTo({ x: Math.max(0, start), animated: true });
      else if (end > x) scroller.current?.scrollTo({ x: end, animated: true });
    },
    [width],
  );
  return { width, hiddenStart, hiddenEnd, setWidth: viewport === null ? setWidth : undefined, setContentWidth, onScroll, scroller, setToolFrame, reveal, fits: contentWidth <= width + SLACK };
}

/**
 * The tools, scrolling sideways when they do not fit. While tools are scrolled out of sight behind a divider, a shade
 * fades them out against that divider (which also lightens) to show more are hidden there.
 */
function ToolScroller({ overflow, onContentWidth, children }: { overflow: Overflow; onContentWidth?: (width: number) => void; children: ReactNode }) {
  const { colors } = useTheme();
  const { hiddenStart, hiddenEnd, setWidth, setContentWidth, onScroll, scroller, fits } = overflow;
  const shade = (side: 'start' | 'end') => (
    <View
      testID={`toolbar-shade-${side}`}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: SHADE_WIDTH,
        [side === 'start' ? 'left' : 'right']: 0,
        experimental_backgroundImage: `linear-gradient(to ${side === 'start' ? 'right' : 'left'}, ${colors['surface-glass']}, transparent)`,
      }}
    />
  );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroller as RefObject<ScrollView>}
        testID="toolbar-tools"
        horizontal
        // Nothing to scroll while everything fits (no rubber band).
        scrollEnabled={!fits}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={setWidth ? (e) => setWidth(e.nativeEvent.layout.width) : undefined}
        onContentSizeChange={(w) => {
          setContentWidth(w);
          onContentWidth?.(w);
        }}
        onScroll={onScroll}
        contentContainerStyle={{ alignItems: 'center', gap: 4, paddingLeft: SCROLL_INSET, paddingRight: TOOL_INSET }}>
        {children}
      </ScrollView>
      {hiddenStart ? shade('start') : null}
      {hiddenEnd ? shade('end') : null}
    </View>
  );
}

function BarIcon({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }): ReactNode {
  const { colors } = useTheme();
  // Square, TOOL_INSET from the bar's top and bottom like the tools.
  const size = useToolbarHeight() - 2 * TOOL_INSET;
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ width: size, height: size }}
      className={`active:opacity-60 items-center justify-center ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={22} color={colors.text} style={glassHalo(colors)} />
    </Pressable>
  );
}

/**
 * `flush` drops the margin on the tools' side, so the portrait scroller clips right at the line;
 * the scroller's own padding keeps the first and last tool off the line at rest. `lit` fades the line to a
 * brighter white while tools are scrolled out of sight behind it; at rest it is the panel's separator color.
 */
function Divider({ flush, lit }: { flush: boolean; lit: boolean }) {
  const margin = flush ? 'ml-1.5' : 'mx-1.5';
  const { colors } = useTheme();
  const color = useAnimatedStyle(() => ({ backgroundColor: withTiming(lit ? colors['divider-lit'] : colors.divider, { duration: 250 }) }), [lit, colors]);
  return <Animated.View testID="divider-start" className={`${margin} h-7 w-px`} style={color} />;
}
