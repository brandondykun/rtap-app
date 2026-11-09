import { Platform, Text, View } from 'react-native';

import { tightUnit } from '@/components/ui/unit-gap';
import { formatLength } from '@/features/location/gps-format';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { useReadoutOrigin } from '@/features/map/interaction/use-readout-origin';
import { itemCategory } from '@/features/symbology/categories';
import { affiliationOf } from '@/features/symbology/presets';
import { describeVector } from '@/lib/geo/vector';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';
import { gridTextClass, VALUE_TEXT_CLASS } from '@/theme/value-colors';

import type { MapItemSnapshot } from '../../repository';
import { DataCell, NO_VALUE } from './DataCell';
import { ringSummary } from './item-summary';

/** Long-press to copy the coordinate (iOS only: see the coordinate's Text). */
const COPYABLE = Platform.OS === 'ios';

/** Where the item is: coordinate, range and bearing from the OP / you, elevation, and its ring. */
export function LocationCard({ item }: { item: MapItemSnapshot }) {
  const coord = useDraft((s) => s.coord);
  const { from } = useReadoutOrigin();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const altitudeUnit = useSettings((s) => s.altitudeUnit);
  const vector = coord && from ? describeVector(from, coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
  const ring = ringSummary(item);
  // A friendly unit's grid is in the friendly blue; every other grid is plain.
  const friendly = item.sidc !== null && itemCategory(item) === 'unit' && affiliationOf(item.sidc) === 'friend';
  return (
    // Black like the inputs, with thin lines between its parts (the mockup's grid card).
    <View className="overflow-hidden rounded-xl border border-border bg-surface-input">
      <View className="flex-row items-center gap-3 border-b border-border px-3 py-2.5">
        <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">{coordinateFormat === 'mgrs' ? 'MGRS' : 'LAT/LON'}</Text>
        <Text
          testID="coordinate-value"
          // Android draws selectable text with a different native view, which sits it higher than the label beside it.
          selectable={COPYABLE}
          numberOfLines={1}
          adjustsFontSizeToFit
          className={`shrink font-mono-bold text-xl ${gridTextClass(friendly)}`}>
          {coord ? formatCoordinate(coord, coordinateFormat) : NO_VALUE}
        </Text>
      </View>
      <View className="flex-row">
        <DataCell label="DIST" value={vector?.distanceLabel ?? NO_VALUE} kind="distance" />
        <DataCell label={vector ? `DIR (${vector.refLabel})` : 'DIR'} value={vector?.bearingLabel ?? NO_VALUE} kind="bearing" />
        <DataCell label="ALT" value={formatLength(item.elevationM, altitudeUnit)} kind="altitude" last />
      </View>
      {ring ? (
        <View testID="ring-row" className="flex-row items-baseline gap-3 border-t border-border px-3 py-2">
          <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">{ring.title}</Text>
          <Text testID="ring-text" className="shrink font-mono text-base text-text-muted">
            {ring.parts.length === 0
              ? ring.text
              : ring.parts.map((p, i) => (
                  <Text key={p.kind}>
                    {i > 0 ? ' · ' : ''}
                    <Text className={VALUE_TEXT_CLASS[p.kind]}>{tightUnit(p.text, 16)}</Text>
                  </Text>
                ))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
