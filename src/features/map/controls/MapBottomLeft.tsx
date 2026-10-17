import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { useMapChrome } from '@/stores/map-chrome';

import { EDGE, roomAboveSheet, selfCardClearance } from '../layout';
import { ReadoutCard } from './ReadoutCard';

/** Height of the readout card before it is first laid out (two lines). */
const READOUT_HEIGHT = 56;

/**
 * The crosshair readout card, also while a panel is open. In portrait it sits bottom left with your grid
 * card right above it (lined up), lifted above a bottom sheet; in landscape it stays bottom right under the
 * zoom buttons, with your grid card bottom left. It reports its size so those controls keep clear of it.
 */
export function MapBottomLeft({ landscape, panel }: { landscape: boolean; panel: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const toolbar = useToolbarHeight();
  // The last measured height, kept while hidden so the room check below cannot flip back and forth.
  const [cardHeight, setCardHeight] = useState(READOUT_HEIGHT);
  // A tall bottom sheet (full detent) can leave no room: hide rather than overlap.
  if (roomAboveSheet(height, panel, insets.top, toolbar) < cardHeight) return null;
  return <Readout landscape={landscape} bottom={(panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE} onHeight={setCardHeight} />;
}

function Readout({ landscape, bottom, onHeight }: { landscape: boolean; bottom: number; onHeight: (height: number) => void }) {
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
        onHeight(height);
      }}
      style={{
        ...(landscape ? { right: insets.right + EDGE } : { left: insets.left + EDGE }),
        bottom,
        maxWidth: width - insets.left - insets.right - 2 * EDGE - (landscape ? left : right),
      }}>
      <ReadoutCard />
    </View>
  );
}
