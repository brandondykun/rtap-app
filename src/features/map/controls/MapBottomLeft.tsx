import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMapChrome } from '@/stores/map-chrome';

import { EDGE, selfCardClearance } from '../layout';
import { ReadoutCard } from './ReadoutCard';

/**
 * Bottom-left: the crosshair readout card. In landscape it sits beside your grid card (bottom right); in
 * portrait it sits right above it (bottom left, lined up). An action bar in the card's place counts the same.
 */
export function MapBottomLeft({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { lift, right } = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  return (
    <View
      testID="map-bottom-left"
      pointerEvents="box-none"
      className="absolute"
      style={{
        left: insets.left + EDGE,
        bottom: insets.bottom + EDGE + lift,
        maxWidth: width - insets.left - insets.right - 2 * EDGE - right,
      }}>
      <ReadoutCard />
    </View>
  );
}
