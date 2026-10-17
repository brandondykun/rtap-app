import { type ReactNode, useEffect, useId } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { GpsReadout } from '@/features/location/GpsReadout';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { useInteraction } from '@/stores/interaction';
import { useMapChrome } from '@/stores/map-chrome';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { barTakesReadoutSpot, CONTROL_SIZE, EDGE, GAP, roomAboveSheet } from '../layout';
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
  /** A tap-mode action bar (placing, drawing) shown in place of your grid card while it is up. */
  bar?: ReactNode;
};

/** Zoom in and zoom out, with the divider between them. */
const ZOOM_HEIGHT = 2 * CONTROL_SIZE + 1;

/**
 * Right-edge controls: north-up under the toolbar (only while the map is rotated) and zoom (shown per Settings, also while a panel is open) at the bottom.
 * Your grid card (tap to recenter) sits bottom left: in portrait right above the crosshair readout, so both grids line up; in landscape
 * the readout sits under zoom instead. It hides while a panel is open (the readout stays). An action bar takes the card's place while it is up,
 * or the readout's in landscape with a drawer open.
 */
export function MapControls({ following, canRecenter, onNorthUp, onZoomIn, onZoomOut, onRecenter, panel, landscape, bar }: Props) {
  const insets = useSafeAreaInsets();
  const right = insets.right + EDGE;
  const { height } = useWindowDimensions();
  const showZoom = useSettings((s) => s.showZoomButtons);
  const toolbar = useToolbarHeight();
  const bottom = (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE;
  // The crosshair readout (zero while hidden, e.g. under a panel): under your card in portrait, under zoom in landscape.
  const readout = useMapChrome((s) => s.readoutCard);
  const readoutLift = readout.height > 0 ? readout.height + GAP : 0;
  // A tall bottom sheet (full detent) can leave no room below north-up: hide zoom rather than overlap.
  const room = roomAboveSheet(height, panel, insets.top, toolbar);
  // The action bar always shows: it is how the user finishes the mode. Your grid card gives way to an open panel.
  const selfCard = bar ? <SelfCardSlot>{bar}</SelfCardSlot> : panel ? null : (
    <SelfCardSlot>
      <GpsReadout following={following} disabled={!canRecenter} onPress={onRecenter} />
    </SelfCardSlot>
  );
  const underZoom = barTakesReadoutSpot(landscape, panel, !!bar);
  return (
    <>
      <NorthUpButton top={insets.top + EDGE + toolbar + GAP} right={right} onPress={onNorthUp} />
      <View
        testID="map-controls-bottom"
        className="absolute items-end gap-3"
        style={{ bottom: bottom + (landscape ? readoutLift : 0), right }}>
        {!showZoom || room < ZOOM_HEIGHT ? null : (
          <View className="overflow-hidden rounded-2xl border border-border bg-surface-chrome">
            <MapButton grouped label="Zoom in" icon="plus" onPress={onZoomIn} />
            <View className="h-px bg-border" style={{ width: CONTROL_SIZE }} />
            <MapButton grouped label="Zoom out" icon="minus" onPress={onZoomOut} />
          </View>
        )}
        {underZoom ? selfCard : null}
      </View>
      {selfCard && !underZoom ? (
        <View
          testID="self-card-left"
          pointerEvents="box-none"
          className="absolute items-start"
          // Clear of a left drawer, and of the right column (zoom, plus the readout in landscape).
          style={{
            bottom: bottom + (landscape ? 0 : readoutLift),
            left: Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) + EDGE,
            right: insets.right + EDGE + (landscape && readout.width > 0 ? Math.max(CONTROL_SIZE, readout.width) : CONTROL_SIZE) + GAP,
          }}>
          {selfCard}
        </View>
      ) : null}
    </>
  );
}

/** Reports the size of what fills the card's spot (your grid card or an action bar) to the controls that keep clear of it, and zero once it hides. */
function SelfCardSlot({ children }: { children: ReactNode }) {
  const id = useId();
  useEffect(() => () => useMapChrome.getState().clearSelfCard(id), [id]);
  return (
    <View
      testID="self-card-slot"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        useMapChrome.getState().setSelfCard({ width, height }, id);
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
