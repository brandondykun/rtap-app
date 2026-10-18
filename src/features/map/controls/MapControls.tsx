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

import { CONTROL_SIZE, EDGE, GAP, roomAboveSheet } from '../layout';
import { GridCard } from './GridCard';
import { MapButton } from './MapButton';

type Props = {
  following: boolean;
  canRecenter: boolean;
  onNorthUp: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  panel: PanelFrame | null;
  landscape: boolean;
  /** A tap-mode action bar (placing, drawing) shown in place of the grid card while it is up. */
  bar?: ReactNode;
};

/** Height of the grid card before it is first laid out (two lines). */
const GRID_CARD_HEIGHT = 56;
/** Zoom in and zoom out, with the divider between them. */
const ZOOM_HEIGHT = 2 * CONTROL_SIZE + 1;

/**
 * Right-edge controls: north-up under the toolbar (only while the map is rotated) and zoom (shown per Settings, also while a panel is open) at the bottom.
 * The grid card (CTR over ME; tap ME to recenter) sits bottom left, also while a panel is open: above a bottom sheet, right of a left drawer.
 * An action bar takes its place while it is up.
 */
export function MapControls({ following, canRecenter, onNorthUp, onZoomIn, onZoomOut, onRecenter, panel, landscape, bar }: Props) {
  const insets = useSafeAreaInsets();
  const right = insets.right + EDGE;
  const { height } = useWindowDimensions();
  const showZoom = useSettings((s) => s.showZoomButtons);
  const toolbar = useToolbarHeight();
  const bottom = (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE;
  // The last measured height, kept while hidden so the room check below cannot flip back and forth.
  const [cardHeight, setCardHeight] = useState(GRID_CARD_HEIGHT);
  // A tall bottom sheet (full detent) can leave no room below north-up: hide zoom and the card rather than overlap.
  const room = roomAboveSheet(height, panel, insets.top, toolbar);
  // The action bar always shows: it is how the user finishes the mode.
  const card = bar ? (
    <SelfCardSlot>{bar}</SelfCardSlot>
  ) : room < cardHeight ? null : (
    <SelfCardSlot onHeight={setCardHeight}>
      <GridCard following={following} disabled={!canRecenter} onRecenter={onRecenter} />
    </SelfCardSlot>
  );
  return (
    <>
      <NorthUpButton top={insets.top + EDGE + toolbar + GAP} right={right} onPress={onNorthUp} />
      <View
        testID="map-controls-bottom"
        className="absolute items-end gap-3"
        style={{ bottom, right }}>
        {!showZoom || room < ZOOM_HEIGHT ? null : (
          <View className="overflow-hidden rounded-2xl border border-border bg-surface-chrome">
            <MapButton grouped label="Zoom in" icon="plus" onPress={onZoomIn} />
            <View className="h-px bg-border" style={{ width: CONTROL_SIZE }} />
            <MapButton grouped label="Zoom out" icon="minus" onPress={onZoomOut} />
          </View>
        )}
      </View>
      {card ? (
        <View
          testID="self-card-left"
          pointerEvents="box-none"
          className="absolute items-start"
          // Clear of a left drawer, and of the zoom column on the right.
          style={{
            bottom,
            left: Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) + EDGE,
            right: insets.right + EDGE + CONTROL_SIZE + GAP,
          }}>
          {card}
        </View>
      ) : null}
    </>
  );
}

/** Reports the size of what fills the card's spot (the grid card or an action bar) to the controls that keep clear of it, and zero once it hides. */
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
