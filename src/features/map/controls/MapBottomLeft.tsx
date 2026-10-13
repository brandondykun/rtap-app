import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GpsReadout } from '@/features/location/GpsReadout';
import { useSettings } from '@/stores/settings';

import { CONTROL_SIZE, EDGE, GAP } from '../layout';
import { ReadoutCard } from './ReadoutCard';

/** Bottom-left stack: the GPS readout (while its toggle is on) above the crosshair readout card. */
export function MapBottomLeft() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showGps = useSettings((s) => s.showGps);
  return (
    <View
      testID="map-bottom-left"
      pointerEvents="box-none"
      className="absolute gap-2"
      // Never reach under the zoom/recenter column on the right.
      style={{
        left: insets.left + EDGE,
        bottom: insets.bottom + EDGE,
        maxWidth: width - insets.left - insets.right - 2 * EDGE - CONTROL_SIZE - GAP,
      }}>
      {showGps ? <GpsReadout /> : null}
      <ReadoutCard />
    </View>
  );
}
