import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { LocationBanner } from '@/features/location/LocationBanner';
import { MeasureCard } from '@/features/measure/MeasureCard';
import { useMeasure } from '@/stores/measure';

import { bannerTop, CONTROL_SIZE, EDGE, GAP, topLeftStackTop } from '../layout';

/** The location-off notice under the Mapbox logo row; a left drawer pushes it right, like the logo. */
export function MapTopLeft({ landscape, panel }: { landscape: boolean; panel: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const drawer = panel?.side === 'left' ? panel.size : 0;
  const top = topLeftStackTop(landscape);
  const measuring = useMeasure((s) => s.active);
  return (
    <View
      testID="map-top-left"
      pointerEvents="box-none"
      className="absolute gap-2"
      style={{
        top: insets.top + top,
        left: Math.max(insets.left, drawer) + EDGE,
        right: insets.right + EDGE + CONTROL_SIZE + GAP,
      }}>
      {measuring ? <MeasureCard /> : null}
      {/* The notice hides while a panel is open. It sits below the toolbar (it would reach under it in landscape). */}
      {panel ? null : <LocationBanner marginTop={Math.max(0, bannerTop(landscape) - top)} />}
    </View>
  );
}
