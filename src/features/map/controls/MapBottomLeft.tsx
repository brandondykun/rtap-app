import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMapChrome } from '@/stores/map-chrome';

import { EDGE, selfCardClearance } from '../layout';
import { ReadoutCard } from './ReadoutCard';

/**
 * The crosshair readout card. In portrait it sits bottom left with your grid card right above it (lined
 * up); in landscape it sits bottom right under the zoom buttons, with your grid card bottom left. It reports
 * its size so those controls keep clear of it.
 */
export function MapBottomLeft({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { left, right } = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  useEffect(() => () => useMapChrome.getState().clearReadoutCard(), []);
  return (
    <View
      testID="map-bottom-left"
      pointerEvents="box-none"
      className="absolute"
      onLayout={(e) => {
        const { width: w, height } = e.nativeEvent.layout;
        useMapChrome.getState().setReadoutCard({ width: w, height });
      }}
      style={{
        ...(landscape ? { right: insets.right + EDGE } : { left: insets.left + EDGE }),
        bottom: insets.bottom + EDGE,
        maxWidth: width - insets.left - insets.right - 2 * EDGE - (landscape ? left : right),
      }}>
      <ReadoutCard />
    </View>
  );
}
