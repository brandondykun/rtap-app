import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { LocationBanner } from '@/features/location/LocationBanner';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { useMenu } from '@/stores/menu';
import { useQuickPlot } from '@/stores/quick-plot';

import { bannerTop, CONTROL_SIZE, EDGE, GAP, topLeftStackTop } from '../layout';

/** The location-off notice under the Mapbox logo row; a left drawer pushes it right, like the logo. */
export function MapTopLeft({ panel }: { panel: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const drawer = panel?.side === 'left' ? panel.size : 0;
  const toolbar = useToolbarHeight();
  const top = topLeftStackTop(toolbar);
  // The quick plot entry card sits where the notice would; the notice would cover its fields.
  const plotEntryOpen = useQuickPlot((s) => s.entryOpen);
  // Minimized in portrait the panel still reports its reopen bar, but the menu is out of the way.
  const minimized = useMenu((s) => s.panelMinimized);
  const panelOpen = panel !== null && !minimized;
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
      {/* The notice hides while a panel is open. It sits below the logo row, itself under the toolbar. */}
      {panelOpen || plotEntryOpen ? null : <LocationBanner marginTop={Math.max(0, bannerTop(toolbar) - top)} />}
    </View>
  );
}
