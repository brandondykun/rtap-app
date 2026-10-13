import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { GpsReadout } from '@/features/location/GpsReadout';
import { LocationBanner } from '@/features/location/LocationBanner';
import { useSettings } from '@/stores/settings';

import { bannerTop, CONTROL_SIZE, EDGE, GAP } from '../layout';

/**
 * The top-left stack under the Mapbox logo row: the location-off notice, then the GPS readout.
 * Stacking them means the two never overlap. A left drawer pushes the stack right of it, like the logo.
 */
export function MapTopLeft({ landscape, panel }: { landscape: boolean; panel: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const showGps = useSettings((s) => s.showGps);
  const drawer = panel?.side === 'left' ? panel.size : 0;
  return (
    <View
      testID="map-top-left"
      pointerEvents="box-none"
      className="absolute gap-2"
      style={{
        top: insets.top + bannerTop(landscape),
        left: Math.max(insets.left, drawer) + EDGE,
        right: insets.right + EDGE + CONTROL_SIZE + GAP,
      }}>
      {/* The notice hides while a panel is open, as before; the GPS readout stays. */}
      {panel ? null : <LocationBanner />}
      {showGps ? <GpsReadout /> : null}
    </View>
  );
}
