import { Text, View } from 'react-native';

import { formatLength } from '@/features/location/gps-format';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { useReadoutOrigin } from '@/features/map/interaction/use-readout-origin';
import { describeVector } from '@/lib/geo/vector';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';

import type { MapItemSnapshot } from '../../repository';
import { DataCell, NO_VALUE } from './DataCell';
import { ringSummary } from './item-summary';

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
  return (
    // Black like the inputs, with thin lines between its parts (the mockup's grid card).
    <View className="overflow-hidden rounded-xl border border-border bg-surface-input">
      <View className="flex-row items-center gap-3 border-b border-border px-3 py-2.5">
        <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">{coordinateFormat === 'mgrs' ? 'MGRS' : 'LAT/LON'}</Text>
        <Text selectable numberOfLines={1} adjustsFontSizeToFit className="shrink font-mono-bold text-xl text-text">{coord ? formatCoordinate(coord, coordinateFormat) : NO_VALUE}</Text>
      </View>
      <View className="flex-row">
        <DataCell label="DIST" value={vector?.distanceLabel ?? NO_VALUE} accent />
        <DataCell label={vector ? `DIR (${vector.refLabel})` : 'DIR'} value={vector?.bearingLabel ?? NO_VALUE} accent />
        <DataCell label="ELEV" value={formatLength(item.elevationM, altitudeUnit)} last />
      </View>
      {ring ? (
        <View testID="ring-row" className="flex-row items-baseline gap-3 border-t border-border px-3 py-2">
          <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">{ring.title}</Text>
          <Text className="shrink font-mono text-base text-text">{ring.text}</Text>
        </View>
      ) : null}
    </View>
  );
}
