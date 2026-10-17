import { type ReactNode, useEffect, useId, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { GpsReadout } from '@/features/location/GpsReadout';
import { useInteraction } from '@/stores/interaction';
import { useMapChrome } from '@/stores/map-chrome';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { CONTROL_SIZE, EDGE, GAP, TOOLBAR_HEIGHT } from '../layout';
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

/** Height of your grid card before it is first laid out (two lines). */
const SELF_CARD_HEIGHT = 56;
/** Zoom in and zoom out, with the divider between them. */
const ZOOM_HEIGHT = 2 * CONTROL_SIZE + 1;

/**
 * Right-edge controls: north-up under the toolbar; zoom (shown per Settings, also while a panel is open) and your grid card (tap to recenter) at the bottom.
 * In portrait the card sits bottom left instead, under the crosshair readout, so both grids line up.
 * An action bar takes the card's place while it is up.
 */
export function MapControls({ following, canRecenter, onNorthUp, onZoomIn, onZoomOut, onRecenter, panel, landscape, bar }: Props) {
  const insets = useSafeAreaInsets();
  const right = insets.right + EDGE;
  const { height } = useWindowDimensions();
  const showZoom = useSettings((s) => s.showZoomButtons);
  const bottom = (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE;
  // The last measured height, kept while hidden so the room check below cannot flip back and forth.
  const [cardHeight, setCardHeight] = useState(SELF_CARD_HEIGHT);
  // A tall bottom sheet (full detent) can leave no room below north-up: hide the card and zoom rather than overlap.
  const room = panel?.side === 'bottom' ? height - panel.size - (insets.top + EDGE + TOOLBAR_HEIGHT + GAP + CONTROL_SIZE + GAP + EDGE) : Infinity;
  // The action bar always shows: it is how the user finishes the mode.
  const noRoom = !bar && room < cardHeight;
  const selfCard = bar ? (
    <SelfCardSlot onHeight={() => {}}>{bar}</SelfCardSlot>
  ) : (
    <SelfCardSlot onHeight={setCardHeight}>
      <GpsReadout following={following} disabled={!canRecenter} onPress={onRecenter} />
    </SelfCardSlot>
  );
  return (
    <>
      <View className="absolute" style={{ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP, right }}>
        <MapButton label="North up" onPress={onNorthUp}>
          <NorthNeedle />
        </MapButton>
      </View>
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
        {landscape && !noRoom ? selfCard : null}
      </View>
      {!landscape && !noRoom ? (
        <View
          testID="self-card-left"
          pointerEvents="box-none"
          className="absolute items-start"
          // Clear of the zoom column on the right.
          style={{ bottom, left: insets.left + EDGE, right: insets.right + EDGE + CONTROL_SIZE + GAP }}>
          {selfCard}
        </View>
      ) : null}
    </>
  );
}

/** Reports the size of what fills the card's spot (your grid card or an action bar) to the controls that keep clear of it, and zero once it hides. */
function SelfCardSlot({ onHeight, children }: { onHeight: (height: number) => void; children: ReactNode }) {
  const id = useId();
  useEffect(() => () => useMapChrome.getState().clearSelfCard(id), [id]);
  return (
    <View
      testID="self-card-slot"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        useMapChrome.getState().setSelfCard({ width, height }, id);
        onHeight(height);
      }}>
      {children}
    </View>
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
