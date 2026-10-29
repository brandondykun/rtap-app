import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { formatLength } from '@/features/location/gps-format';
import { elevationAt } from '@/features/map/terrain/elevation';
import { sameCoord, useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';

/** Wait for the item to settle before asking the map (typing and dragging move it often). */
const LOOKUP_DELAY_MS = 250;

/**
 * A unit's or point's ground elevation, in the Altitude unit. While adding or moving it follows the item (what Add/Save
 * will store); while viewing it shows the stored value. A dash while unknown or still being looked up.
 */
export function ElevationRow({ inline = false }: { /** One compact `ELEV <value>` text line, for under the location status. */ inline?: boolean }) {
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
  if (inline) {
    return (
      <Text testID="location-elevation" accessibilityLabel={`Elevation ${m === null ? 'unknown' : value}`} className="text-sm text-text-muted">
        {`ELEV ${value}`}
      </Text>
    );
  }
  // Stands out by size and weight alone, like the G-M angle: no border or fill, which would make it look editable.
  return (
    <View accessible accessibilityLabel={`Elevation ${m === null ? 'unknown' : value}`} className="flex-row items-baseline gap-3">
      <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">Elevation</Text>
      <Text className={`font-mono-bold text-lg ${m === null ? 'text-text-muted' : 'text-text'}`}>{value}</Text>
    </View>
  );
}
