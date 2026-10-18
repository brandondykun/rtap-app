import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { useMapChrome } from '@/stores/map-chrome';

import { EDGE, roomAboveSheet, selfCardClearance } from '../layout';
import { CenterCard } from './CenterCard';

/** Height of the center card before it is first laid out (one line). */
const CENTER_CARD_HEIGHT = 36;

/**
 * Bottom left: the center card, also while a panel is open (above a bottom sheet, right of a left drawer). In
 * landscape it sits beside your card (bottom right); in portrait there is no room for both on one row, so it
 * sits just above your card's height. An action bar in your card's place counts the same.
 */
export function MapBottomLeft({ landscape, panel }: { landscape: boolean; panel: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const toolbar = useToolbarHeight();
  const { lift, right } = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  // The last measured height, kept while hidden so the room check below cannot flip back and forth.
  const [cardHeight, setCardHeight] = useState(CENTER_CARD_HEIGHT);
  // A tall bottom sheet (full detent) can leave no room: hide rather than overlap.
  if (roomAboveSheet(height, panel, insets.top, toolbar) < lift + cardHeight) return null;
  const left = Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) + EDGE;
  return (
    <View
      testID="map-bottom-left"
      pointerEvents="box-none"
      className="absolute"
      onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
      style={{
        left,
        bottom: (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE + lift,
        maxWidth: width - left - insets.right - EDGE - right,
      }}>
      <CenterCard />
    </View>
  );
}
