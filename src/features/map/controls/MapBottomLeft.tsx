import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GpsReadout } from '@/features/location/GpsReadout';
import { useSettings } from '@/stores/settings';

import { CONTROL_SIZE, EDGE, GAP } from '../layout';
import { ReadoutCard } from './ReadoutCard';

/**
 * Bottom-left stack: the GPS readout (while its toggle is on) above the crosshair readout card, then
 * `footer` under them at full width, or with `footerBeside` (landscape) centered beside them, before
 * the recenter button.
 */
export function MapBottomLeft({ footer, footerBeside = false }: { footer?: ReactNode; footerBeside?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showGps = useSettings((s) => s.showGps);
  return (
    <View
      testID="map-bottom-left"
      pointerEvents="box-none"
      className="absolute gap-2"
      // Never reach under the zoom/recenter column on the right.
      style={{
        left: insets.left + EDGE,
        bottom: insets.bottom + EDGE,
        // A footer (the place bar) takes the full width; the readouts stay their own size.
        ...(footer ? { right: insets.right + EDGE + CONTROL_SIZE + GAP } : { maxWidth: width - insets.left - insets.right - 2 * EDGE - CONTROL_SIZE - GAP }),
        ...(footer && footerBeside ? { flexDirection: 'row', alignItems: 'flex-end' } : {}),
      }}>
      <View testID="map-readouts" className="items-start gap-2" pointerEvents="box-none">
        {showGps ? <GpsReadout /> : null}
        <ReadoutCard />
      </View>
      {footer && footerBeside ? (
        <View testID="map-bottom-footer" className="flex-1 items-center" pointerEvents="box-none">
          {footer}
        </View>
      ) : (
        footer
      )}
    </View>
  );
}
