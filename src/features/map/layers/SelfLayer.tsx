import { ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo } from 'react';

import { usePresence } from '@/stores/presence';

import { selfFeatureCollection } from './self-feature';
import { SELF_STYLE } from './styles';

/** Own position: heading-aware icon from the presence store (teammates will reuse this path). */
export function SelfLayer() {
  const position = usePresence((s) => s.selfPosition?.position ?? null);
  const heading = usePresence((s) => s.selfHeading);
  const shape = useMemo(() => selfFeatureCollection(position, heading), [position, heading]);
  return (
    <ShapeSource id="self" shape={shape}>
      <SymbolLayer id="self-icon" style={SELF_STYLE} />
    </ShapeSource>
  );
}
