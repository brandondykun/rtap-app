import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { useMapChrome } from '@/stores/map-chrome';

import { EDGE, selfCardClearance } from '../layout';
import { CenterCard } from './CenterCard';

/**
 * Landscape: the center card bottom left, beside your card (bottom right), also while a drawer is open (right of it).
 * An action bar in your card's place counts the same.
 */
export function MapBottomLeft({ panel }: { panel: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { right } = selfCardClearance(useMapChrome((s) => s.selfCard), true);
  const left = Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) + EDGE;
  return (
    <View
      testID="map-bottom-left"
      pointerEvents="box-none"
      className="absolute items-start"
      style={{ left, bottom: insets.bottom + EDGE, maxWidth: width - left - insets.right - EDGE - right }}>
      <CenterCard />
    </View>
  );
}
