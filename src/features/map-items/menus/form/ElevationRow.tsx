import { useEffect } from 'react';
import { Text } from 'react-native';

import { formatLength } from '@/features/location/gps-format';
import { elevationAt } from '@/features/map/terrain/elevation';
import { sameCoord, useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';
import { VALUE_TEXT_CLASS } from '@/theme/value-colors';

/** Wait for the item to settle before asking the map (typing and dragging move it often). */
const LOOKUP_DELAY_MS = 250;

/**
 * A unit's or point's ground altitude as one compact `ALT <value>` line, in the Altitude unit. While adding or moving it follows the item (what Add/Save
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
  const value = formatLength(m, unit);
  return (
    <Text testID="location-elevation" accessibilityLabel={`Altitude ${m === null ? 'unknown' : value}`} className="text-sm text-text-muted">
      {'ALT '}
      <Text className={m === null ? 'text-text-muted' : VALUE_TEXT_CLASS.altitude}>{value}</Text>
    </Text>
  );
}
