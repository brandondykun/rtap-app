import { type ReactNode, useEffect, useId, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { useInteraction } from '@/stores/interaction';
import { useMapChrome } from '@/stores/map-chrome';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { CONTROL_SIZE, EDGE, GAP, HINT_BAR_HEIGHT as BAR_HEIGHT, roomAboveSheet } from '../layout';
import { MapButton } from './MapButton';
import { ReadoutDock } from './ReadoutDock';

type Props = {
  following: boolean;
  canRecenter: boolean;
  /** Opens setting the location by hand from the ME readout. */
  onSetLocation: () => void;
  onNorthUp: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  panel: PanelFrame | null;
  landscape: boolean;
  /** A tap-mode action bar (placing, drawing, measuring): in portrait in the dock's place or over it, in landscape over the dock. */
  bar?: ReactNode;
  /** In portrait, float the bar centered over the dock instead of in its place (every tap mode but drawing a line). */
  barOverDock?: boolean;
  /** The center grid: the dock's CTR row (over ME). */
  showCenter?: boolean;
  /** False hides north-up even while the map is rotated (OP mode, where it cannot move the camera). */
  showNorthUp?: boolean;
  /** Shown in place of the zoom buttons, always (OP mode's eye height slider). */
  side?: ReactNode;
};

/** Height of the dock before it is first laid out: one row, or two with the divider. */
const DOCK_ROW_HEIGHT = 50;
const DOCK_HEIGHT = 2 * DOCK_ROW_HEIGHT + 1;
/** Space between the buttons and the card under them (gap-3). */
const STACK_GAP = 12;
/** Zoom in and zoom out, with the divider between them. */
const ZOOM_HEIGHT = 2 * CONTROL_SIZE + 1;
/** In portrait, a bottom menu taller than this share of the screen hides the readout dock. */
export const TALL_SHEET_FRACTION = 0.5;

/**
 * Map controls: north-up under the toolbar (only while the map is rotated), and at the bottom, also while a panel is open:
 * - portrait: zoom (shown per Settings) on the right, over the full-width dock (CTR over ME; tap ME to recenter);
 * - landscape: zoom over the same dock bottom right, as wide as its content, each row's details on one line (or none,
 *   with the Minimal grids in landscape setting).
 * An action bar is always shown. In portrait it takes the dock's place (centered) or floats centered over it. In landscape
 * both grids stay: the bar sits over the dock, left of the zoom buttons when they show, else flush right.
 */
export function MapControls({ following, canRecenter, onSetLocation, onNorthUp, onZoomIn, onZoomOut, onRecenter, panel, landscape, bar, barOverDock = false, showCenter = false, showNorthUp = true, side }: Props) {
  const insets = useSafeAreaInsets();
  const right = insets.right + EDGE;
  const { width, height } = useWindowDimensions();
  const showZoom = useSettings((s) => s.showZoomButtons);
  const minimal = useSettings((s) => s.minimalLandscapeGrids);
  const toolbar = useToolbarHeight();
  const bottom = (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE;
  // The last measured height, kept while hidden so the room check below cannot flip back and forth.
  const [dockHeight, setDockHeight] = useState<number | null>(null);
  const [barHeight, setBarHeight] = useState(BAR_HEIGHT);
  // A tall bottom sheet can leave too little room below north-up: the buttons give way first, then the cards.
  const room = roomAboveSheet(height, panel, insets.top, toolbar);
  // A menu pulled up past half the screen hides the CTR / ME readouts, leaving the map above it to see.
  const sheetTall = panel?.side === 'bottom' && panel.size > height * TALL_SHEET_FRACTION;
  // Something in the zoom buttons' place (OP mode's eye height) shrinks to stay under the toolbar, never over it.
  const sideTop = side ? { top: insets.top + EDGE + toolbar + GAP } : null;
  const zoom = (
    <View testID="zoom-group" className="overflow-hidden rounded-2xl bg-surface-glass">
      <MapButton grouped label="Zoom in" icon="plus" onPress={onZoomIn} />
      <View className="h-px bg-border" style={{ width: CONTROL_SIZE }} />
      <MapButton grouped label="Zoom out" icon="minus" onPress={onZoomOut} />
    </View>
  );

  if (!landscape) {
    const dockSize = dockHeight ?? (showCenter ? DOCK_HEIGHT : DOCK_ROW_HEIGHT);
    // The action bar always shows: it is how the user finishes the mode. Floating over the dock, it leaves the dock less room.
    const over = bar && barOverDock;
    const docked = bar && !over ? (
      <SelfCardSlot>
        <View testID="bar-in-dock" pointerEvents="box-none" className="items-center">
          {bar}
        </View>
      </SelfCardSlot>
    ) : sheetTall || room < dockSize + (over ? barHeight + STACK_GAP : 0) ? null : (
      <SelfCardSlot onHeight={setDockHeight}>
        <ReadoutDock showCenter={showCenter} following={following} disabled={!canRecenter} onRecenter={onRecenter} onSetLocation={onSetLocation} />
      </SelfCardSlot>
    );
    const below = (docked ? dockSize + STACK_GAP : 0) + (over ? barHeight + STACK_GAP : 0);
    return (
      <>
        {showNorthUp ? <NorthUpButton top={insets.top + EDGE + toolbar + GAP} right={right} onPress={onNorthUp} /> : null}
        <View
          testID="map-controls-bottom"
          pointerEvents="box-none"
          className="absolute justify-end gap-3"
          style={{ bottom, left: insets.left + EDGE, right, ...sideTop }}>
          <View pointerEvents="box-none" className={`items-end gap-3 ${side ? 'flex-1' : ''}`}>
            {side ?? (showZoom && room >= ZOOM_HEIGHT + below ? zoom : null)}
          </View>
          {over ? (
            <View testID="bar-over-dock" pointerEvents="box-none" className="items-center" onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
              {bar}
            </View>
          ) : null}
          {docked}
        </View>
      </>
    );
  }

  // The dock keeps clear of a drawer; past that its grids shrink to fit.
  const maxWidth = width - right - Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) - EDGE;
  const dockSize = dockHeight ?? (showCenter ? DOCK_HEIGHT : DOCK_ROW_HEIGHT);
  const card =
    room < dockSize ? null : (
      <SelfCardSlot onHeight={setDockHeight}>
        <ReadoutDock inline minimal={minimal} showCenter={showCenter} maxWidth={maxWidth} following={following} disabled={!canRecenter} onRecenter={onRecenter} onSetLocation={onSetLocation} />
      </SelfCardSlot>
    );
  const below = card ? dockSize + STACK_GAP : 0;
  const buttons = side ? (
    <View pointerEvents="box-none" className="flex-1 items-end">
      {side}
    </View>
  ) : !showZoom || room < ZOOM_HEIGHT + below ? null : (
    zoom
  );
  // The action bar always shows: it is how the user finishes the mode. Over the dock, so both grids stay in view.
  const top = bar ? (
    <View testID="bar-over-dock" pointerEvents="box-none" className="flex-row items-end gap-3" style={{ maxWidth }}>
      <View pointerEvents="box-none" className="shrink">
        {bar}
      </View>
      {buttons}
    </View>
  ) : (
    buttons
  );
  return (
    <>
      {showNorthUp ? <NorthUpButton top={insets.top + EDGE + toolbar + GAP} right={right} onPress={onNorthUp} /> : null}
      <View
        testID="map-controls-bottom"
        pointerEvents="box-none"
        className="absolute items-end justify-end gap-3"
        style={{ bottom, right, ...sideTop }}>
        {top}
        {card}
      </View>
    </>
  );
}

/** Reports the size of what fills your card's spot (your card or an action bar) to the controls that keep clear of it, and zero once it hides. */
function SelfCardSlot({ onHeight, children }: { onHeight?: (height: number) => void; children: ReactNode }) {
  const id = useId();
  useEffect(() => () => useMapChrome.getState().clearSelfCard(id), [id]);
  return (
    <View
      testID="self-card-slot"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        useMapChrome.getState().setSelfCard({ width, height }, id);
        onHeight?.(height);
      }}>
      {children}
    </View>
  );
}

/** Bearings this close to 0/360° count as north up (the camera eases in and can stop a hair off). */
const NORTH_TOLERANCE_DEG = 0.5;

function isNorthUp(bearing: number): boolean {
  const d = ((bearing % 360) + 360) % 360;
  return Math.min(d, 360 - d) < NORTH_TOLERANCE_DEG;
}

/** North-up fades out while the map already points north (so after it is pressed) and back in once rotated. */
function NorthUpButton({ top, right, onPress }: { top: number; right: number; onPress: () => void }) {
  const hidden = useInteraction((s) => isNorthUp(s.cameraBearing));
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(hidden ? 0 : 1, { duration: 500 }) }), [hidden]);
  return (
    <Animated.View
      testID="north-up"
      className="absolute"
      pointerEvents={hidden ? 'none' : 'auto'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[{ top, right }, fade]}>
      <MapButton label="North up" onPress={onPress}>
        <NorthNeedle />
      </MapButton>
    </Animated.View>
  );
}

/** Red north half, light south half, rotated so it keeps pointing at map north. */
function NorthNeedle() {
  const { colors } = useTheme();
  const bearing = useInteraction((s) => s.cameraBearing);
  const half = { width: 0, height: 0, borderLeftWidth: 4.5, borderRightWidth: 4.5, borderLeftColor: 'transparent', borderRightColor: 'transparent' };
  return (
    <View testID="north-needle" style={{ transform: [{ rotate: `${-bearing}deg` }] }} className="items-center">
      <View style={{ ...half, borderBottomWidth: 11, borderBottomColor: colors.danger }} />
      <View style={{ ...half, borderTopWidth: 11, borderTopColor: colors.text }} />
    </View>
  );
}
