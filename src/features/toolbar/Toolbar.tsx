import { useState, type ReactNode } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { EDGE } from '@/features/map/layout';
import { useTheme } from '@/theme/ThemeProvider';

import { useToolbarHeight } from './use-toolbar-height';
import { ToolButton } from './ToolButton';

export type ToolId = 'unit' | 'point' | 'line' | 'polygon' | 'measure' | 'layers' | 'plot';

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
  onSettings?: () => void;
  /** The LABELS toggle, the last tool: a label icon while map labels show, a crossed-out one while hidden. */
  labelsOn?: boolean;
  onLabels?: () => void;
};

/**
 * Top bar in both orientations: full width in portrait, top-right (content width) in landscape
 * so a left panel never covers it. Tools scroll horizontally in portrait if they overflow.
 */
export function Toolbar({ landscape, activeTool, onMenu, onUnit, onPoint, onLine, onPolygon, onMeasure, onLayers, onPlot, onSettings, labelsOn = true, onLabels }: Props) {
  const insets = useSafeAreaInsets();
  const height = useToolbarHeight();
  const overflow = useOverflow();
  const position = landscape
    ? { top: insets.top + EDGE, right: insets.right + EDGE }
    : { top: insets.top + EDGE, left: insets.left + EDGE, right: insets.right + EDGE };

  const tools = (
    <>
      <ToolButton icon="rhombus-outline" label="UNIT" active={activeTool === 'unit'} onPress={onUnit} />
      <ToolButton icon="map-marker-outline" label="POINT" active={activeTool === 'point'} onPress={onPoint} />
      <ToolButton icon="vector-polyline" label="LINE" active={activeTool === 'line'} onPress={onLine} />
      <ToolButton icon="pentagon-outline" label="POLYGON" active={activeTool === 'polygon'} onPress={onPolygon} />
      <ToolButton icon="ruler" label="MEASURE" active={activeTool === 'measure'} onPress={onMeasure} />
      <ToolButton icon="layers-outline" label="LAYERS" active={activeTool === 'layers'} onPress={onLayers} />
      <ToolButton icon="target" label="PLOT" active={activeTool === 'plot'} onPress={onPlot} />
      {/* A toggle, not a tool: its icon shows the state, with no highlight. */}
      <ToolButton icon={labelsOn ? 'label-outline' : 'label-off-outline'} label="LABELS" toggled={labelsOn} onPress={onLabels} />
    </>
  );

  return (
    <View
      testID="toolbar"
      style={[position, { height }]}
      className="absolute flex-row items-center rounded-3xl border border-border bg-surface-chrome px-2">
      <BarIcon icon="menu" label="Menu" onPress={onMenu} />
      <Divider side="start" flush={!landscape} lit={!landscape && overflow.hiddenStart} />
      {landscape ? (
        <View className="flex-row items-center gap-1">{tools}</View>
      ) : (
        <ToolScroller overflow={overflow}>{tools}</ToolScroller>
      )}
      <Divider side="end" flush={!landscape} lit={!landscape && overflow.hiddenEnd} />
      <BarIcon icon="cog-outline" label="Settings" onPress={onSettings} />
    </View>
  );
}

/** Allowance for subpixel offsets, so a scroller resting at an end shows no shade there. */
const SLACK = 1;
const SHADE_WIDTH = 20;

type Overflow = ReturnType<typeof useOverflow>;

/** Whether the portrait tools are scrolled out of sight at either end, and the scroller props that track it. */
function useOverflow() {
  const [width, setWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const hiddenStart = offset > SLACK;
  const hiddenEnd = width > 0 && offset + width < contentWidth - SLACK;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    // Only re-render when a shade would appear or disappear.
    if (x > SLACK !== hiddenStart || x + width < contentWidth - SLACK !== hiddenEnd) setOffset(x);
  };
  return { hiddenStart, hiddenEnd, setWidth, setContentWidth, onScroll };
}

/**
 * The portrait tools, scrolling sideways. While tools are scrolled out of sight behind a divider, a shade
 * fades them out against that divider (which also turns bright) to show more are hidden there.
 */
function ToolScroller({ overflow, children }: { overflow: Overflow; children: ReactNode }) {
  const { colors } = useTheme();
  const { hiddenStart, hiddenEnd, setWidth, setContentWidth, onScroll } = overflow;
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
        experimental_backgroundImage: `linear-gradient(to ${side === 'start' ? 'right' : 'left'}, ${colors['surface-chrome']}, transparent)`,
      }}
    />
  );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        testID="toolbar-tools"
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        onScroll={onScroll}
        contentContainerStyle={{ alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
        {children}
      </ScrollView>
      {hiddenStart ? shade('start') : null}
      {hiddenEnd ? shade('end') : null}
    </View>
  );
}

function BarIcon({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }): ReactNode {
  const { colors } = useTheme();
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={`h-10 w-10 items-center justify-center ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

/**
 * `flush` drops the margin on the tools' side, so the portrait scroller clips right at the line;
 * the scroller's own padding keeps the first and last tool off the line at rest. `lit` turns the line bright
 * white while tools are scrolled out of sight behind it.
 */
function Divider({ side, flush, lit }: { side: 'start' | 'end'; flush: boolean; lit: boolean }) {
  const margin = !flush ? 'mx-1.5' : side === 'start' ? 'ml-1.5' : 'mr-1.5';
  return <View testID={`divider-${side}`} className={`${margin} h-7 w-px ${lit ? 'bg-text' : 'bg-border'}`} />;
}
