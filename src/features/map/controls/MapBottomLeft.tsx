import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMapChrome } from '@/stores/map-chrome';

import { EDGE, selfCardClearance } from '../layout';
import { ReadoutCard } from './ReadoutCard';

/**
 * Bottom-left: the crosshair readout card. In landscape it sits beside your grid card (bottom right); in
 * portrait your grid card sits right above it (bottom left, lined up), so it reports its size. An action
 * bar in the grid card's place counts the same.
 */
export function MapBottomLeft({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { right } = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
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
        left: insets.left + EDGE,
        bottom: insets.bottom + EDGE,
        maxWidth: width - insets.left - insets.right - 2 * EDGE - right,
      }}>
      <ReadoutCard />
    </View>
  );
}
