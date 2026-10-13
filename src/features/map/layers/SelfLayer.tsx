import { ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo } from 'react';

import type { LatLon } from '@/lib/geo/types';
import { usePresence } from '@/stores/presence';

import { selfFeatureCollection } from './self-feature';
import { SELF_STYLE } from './styles';

/** Own position: heading-aware icon from the presence store (teammates will reuse this path). `onPress` gets the position. */
export function SelfLayer({ onPress }: { onPress?: (at: LatLon) => void }) {
  const position = usePresence((s) => s.selfPosition?.position ?? null);
  const heading = usePresence((s) => s.selfHeading);
  const shape = useMemo(() => selfFeatureCollection(position, heading), [position, heading]);
  return (
    // Only touchable when asked: a touchable source swallows taps on symbols near it (rnmapbox iOS).
    <ShapeSource id="self" shape={shape} onPress={onPress && position ? () => onPress(position) : undefined}>
      <SymbolLayer id="self-icon" style={SELF_STYLE} />
    </ShapeSource>
  );
}
