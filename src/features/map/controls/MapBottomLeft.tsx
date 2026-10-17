import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMapChrome } from '@/stores/map-chrome';

import { EDGE, selfCardClearance } from '../layout';
import { ReadoutCard } from './ReadoutCard';

/**
 * Bottom-left stack: the crosshair readout card, then `footer` under it. In landscape it sits beside your
 * grid card (bottom right); in portrait it sits right above it (bottom left, lined up) and the footer
 * stretches to the zoom column.
 */
export function MapBottomLeft({ footer, landscape }: { footer?: ReactNode; landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { lift, right } = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  return (
    <View
      testID="map-bottom-left"
      pointerEvents="box-none"
      className="absolute gap-2"
      style={{
        left: insets.left + EDGE,
        bottom: insets.bottom + EDGE + lift,
        // A portrait footer (the place bar) takes the full width; otherwise everything keeps its own size.
        ...(footer && !landscape ? { right: insets.right + EDGE + right } : { maxWidth: width - insets.left - insets.right - 2 * EDGE - right }),
      }}>
      <View testID="map-readouts" className="items-start gap-2" pointerEvents="box-none">
        <ReadoutCard />
      </View>
      {footer}
    </View>
  );
}
