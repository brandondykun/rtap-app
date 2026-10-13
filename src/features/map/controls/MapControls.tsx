import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { useInteraction } from '@/stores/interaction';
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
  /** The GPS readout toggle, under north-up: independent of the tools and menus, highlighted while on. */
  gpsOn: boolean;
  onGps: () => void;
  panel: PanelFrame | null;
};

/** Right-edge controls: north-up and the GPS toggle under the toolbar; zoom and recenter at the bottom. */
export function MapControls({ following, canRecenter, onNorthUp, onZoomIn, onZoomOut, onRecenter, gpsOn, onGps, panel }: Props) {
  const insets = useSafeAreaInsets();
  const right = insets.right + EDGE;
  const { height } = useWindowDimensions();
  // A tall bottom sheet (full detent) can leave no room below the top buttons (north-up, GPS):
  // hide recenter rather than overlap.
  const noRoom =
    panel?.side === 'bottom' &&
    height - panel.size < insets.top + EDGE + TOOLBAR_HEIGHT + GAP + 2 * (CONTROL_SIZE + GAP) + CONTROL_SIZE + EDGE;
  return (
    <>
      <View className="absolute" style={{ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP, right, gap: GAP }}>
        <MapButton label="North up" onPress={onNorthUp}>
          <NorthNeedle />
        </MapButton>
        <MapButton label="GPS" icon="navigation-outline" active={gpsOn} onPress={onGps} />
      </View>
      <View
        testID="map-controls-bottom"
        className="absolute gap-3"
        style={{ bottom: (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE, right }}>
        {panel ? null : (
          <View className="overflow-hidden rounded-2xl border border-border bg-surface-chrome">
            <MapButton grouped label="Zoom in" icon="plus" onPress={onZoomIn} />
            <View className="h-px bg-border" style={{ width: CONTROL_SIZE }} />
            <MapButton grouped label="Zoom out" icon="minus" onPress={onZoomOut} />
          </View>
        )}
        {noRoom ? null : (
          <MapButton
            label="Recenter on me"
            icon="crosshairs-gps"
            active={following}
            disabled={!canRecenter}
            onPress={onRecenter}
          />
        )}
      </View>
    </>
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
