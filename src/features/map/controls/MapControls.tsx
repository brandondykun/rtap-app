import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
};

/** Right-edge controls: north-up under the toolbar; zoom and recenter at the bottom. */
export function MapControls({ following, canRecenter, onNorthUp, onZoomIn, onZoomOut, onRecenter }: Props) {
  const insets = useSafeAreaInsets();
  const right = insets.right + EDGE;
  return (
    <>
      <View className="absolute" style={{ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP, right }}>
        <MapButton label="North up" onPress={onNorthUp}>
          <NorthNeedle />
        </MapButton>
      </View>
      <View className="absolute gap-3" style={{ bottom: insets.bottom + EDGE, right }}>
        <View className="overflow-hidden rounded-2xl border border-border bg-surface-chrome">
          <MapButton grouped label="Zoom in" icon="plus" onPress={onZoomIn} />
          <View className="h-px bg-border" style={{ width: CONTROL_SIZE }} />
          <MapButton grouped label="Zoom out" icon="minus" onPress={onZoomOut} />
        </View>
        <MapButton
          label="Recenter on me"
          icon="crosshairs-gps"
          active={following}
          disabled={!canRecenter}
          onPress={onRecenter}
        />
      </View>
    </>
  );
}

/** Red north half, light south half, rotated so it keeps pointing at map north. */
function NorthNeedle() {
  const { colors } = useTheme();
  const bearing = useInteraction((s) => s.cameraBearing);
  const half = { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent' };
  return (
    <View testID="north-needle" style={{ transform: [{ rotate: `${-bearing}deg` }] }} className="items-center">
      <View style={{ ...half, borderBottomWidth: 12, borderBottomColor: colors.danger }} />
      <View style={{ ...half, borderTopWidth: 12, borderTopColor: colors.text }} />
    </View>
  );
}
