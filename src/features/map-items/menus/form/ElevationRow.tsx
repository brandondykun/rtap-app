import { useEffect } from 'react';
import { Text } from 'react-native';

import { formatLength } from '@/features/location/gps-format';
import { elevationAt } from '@/features/map/terrain/elevation';
import { sameCoord, useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';

/** Wait for the unit to settle before asking the map (typing and dragging move it often). */
const LOOKUP_DELAY_MS = 250;

/**
 * A unit's ground elevation, in the Altitude unit. While adding or moving it follows the unit (what Add/Save
 * will store); while viewing it shows the stored value. A dash while unknown or still being looked up.
 */
export function ElevationRow() {
  const coord = useDraft((s) => s.coord);
  const locked = useDraft((s) => s.locked);
  const elevation = useDraft((s) => s.elevation);
  const unit = useSettings((s) => s.altitudeUnit);

  useEffect(() => {
    if (locked || !coord) return;
    const known = useDraft.getState().elevation;
    if (known && sameCoord(known.at, coord)) return;
    const timer = setTimeout(async () => useDraft.getState().setElevation(coord, await elevationAt(coord)), LOOKUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [coord, locked]);

  const m = elevation && sameCoord(elevation.at, coord) ? elevation.m : null;
  return <Text className="font-mono text-sm text-text-muted">{`Elev ${formatLength(m, unit)}`}</Text>;
}
