import { ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, useState } from 'react';

import type { LatLon } from '@/lib/geo/types';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';

import { screenDistance, VISIBLE_MOVE_PT } from '../canvas/camera';
import { selfFeatureCollection } from './self-feature';
import { SELF_STYLE } from './styles';

/** Own position: heading-aware icon from the presence store (teammates will reuse this path). `onPress` gets the position. */
export function SelfLayer({ onPress }: { onPress?: (at: LatLon) => void }) {
  const position = usePresence((s) => s.selfPosition?.position ?? null);
  const heading = usePresence((s) => s.selfHeading);
  const manual = usePresence((s) => s.selfPosition?.manual === true);
  const averaged = usePresence((s) => s.selfPosition?.averaged === true);
  // To the half level, so zooming does not re-render this every frame (the point is off by 20% at most).
  const zoom = useInteraction((s) => Math.round(s.cameraZoom * 2) / 2);
  // The icon stays where it is drawn until a fix would move it visibly (GPS jitter at rest would redraw the map for
  // nothing); a fix appearing or going, or a new kind of position (manual, averaged), always moves it. Only the icon
  // waits: the readouts take every fix.
  const [drawn, setDrawn] = useState(position);
  const [drawnKind, setDrawnKind] = useState({ manual, averaged });
  const kindChanged = drawnKind.manual !== manual || drawnKind.averaged !== averaged;
  const moved = drawn === null || position === null ? drawn !== position : screenDistance(drawn, position, zoom) >= VISIBLE_MOVE_PT;
  if (kindChanged || moved) {
    setDrawn(position);
    if (kindChanged) setDrawnKind({ manual, averaged });
  }
  const shape = useMemo(() => selfFeatureCollection(drawn, heading, manual, averaged), [drawn, heading, manual, averaged]);
  return (
    // Only touchable when asked: a touchable source swallows taps on symbols near it (rnmapbox iOS).
    <ShapeSource id="self" shape={shape} onPress={onPress && position ? () => onPress(position) : undefined}>
      <SymbolLayer id="self-icon" style={SELF_STYLE} />
    </ShapeSource>
  );
}
