import { type ReactNode, useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { GpsReadout } from '@/features/location/GpsReadout';
import { useInteraction } from '@/stores/interaction';
import { INITIAL_MAP_CHROME, useMapChrome } from '@/stores/map-chrome';
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
};

/** Height of your grid card before it is first laid out (two lines). */
const SELF_CARD_HEIGHT = 56;

/**
 * Right-edge controls: north-up under the toolbar; zoom (unless turned off in Settings) and your grid card (tap to recenter) at the bottom.
 * In portrait the card sits bottom left instead, under the crosshair readout, so both grids line up.
 */
export function MapControls({ following, canRecenter, onNorthUp, onZoomIn, onZoomOut, onRecenter, panel, landscape }: Props) {
  const insets = useSafeAreaInsets();
  const right = insets.right + EDGE;
  const { height } = useWindowDimensions();
  const showZoom = useSettings((s) => s.showZoomButtons);
  const bottom = (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE;
  // The last measured height, kept while hidden so the room check below cannot flip back and forth.
  const [cardHeight, setCardHeight] = useState(SELF_CARD_HEIGHT);
  // A tall bottom sheet (full detent) can leave no room below north-up: hide the card rather than overlap.
  const noRoom = panel?.side === 'bottom' && height - panel.size < insets.top + EDGE + TOOLBAR_HEIGHT + GAP + CONTROL_SIZE + GAP + cardHeight + EDGE;
  const selfCard = (
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
        {panel || !showZoom ? null : (
          <View className="overflow-hidden rounded-2xl border border-border bg-surface-chrome">
            <MapButton grouped label="Zoom in" icon="plus" onPress={onZoomIn} />
            <View className="h-px bg-border" style={{ width: CONTROL_SIZE }} />
            <MapButton grouped label="Zoom out" icon="minus" onPress={onZoomOut} />
          </View>
        )}
        {landscape && !noRoom ? selfCard : null}
      </View>
      {!landscape && !noRoom ? (
        <View testID="self-card-left" className="absolute" style={{ bottom, left: insets.left + EDGE }}>
          {selfCard}
        </View>
      ) : null}
    </>
  );
}

/** Reports your grid card's size to the bars that keep clear of it, and zero once it hides. */
function SelfCardSlot({ onHeight, children }: { onHeight: (height: number) => void; children: ReactNode }) {
  const setSelfCard = useMapChrome((s) => s.setSelfCard);
  useEffect(() => () => setSelfCard(INITIAL_MAP_CHROME.selfCard), [setSelfCard]);
  return (
    <View
      testID="self-card-slot"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSelfCard({ width, height });
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
