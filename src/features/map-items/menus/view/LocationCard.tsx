import { Text, View } from 'react-native';

import { formatLength } from '@/features/location/gps-format';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { useReadoutOrigin } from '@/features/map/interaction/use-readout-origin';
import { describeVector } from '@/lib/geo/vector';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';

import type { MapItemSnapshot } from '../../repository';
import { ringSummary } from './item-summary';

const NO_VALUE = '—';

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</Text>
      <Text numberOfLines={1} className="font-mono text-base text-text">{value}</Text>
      {sub ? <Text className="text-xs text-text-muted">{sub}</Text> : null}
    </View>
  );
}

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
    <View className="gap-3 rounded-xl border border-border bg-surface-raised p-3">
      <View className="gap-0.5">
        <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">{coordinateFormat === 'mgrs' ? 'MGRS' : 'LAT/LON'}</Text>
        <Text selectable className="font-mono-bold text-lg text-text">{coord ? formatCoordinate(coord, coordinateFormat) : NO_VALUE}</Text>
      </View>
      <View className="flex-row gap-3">
        <Cell label="DIST" value={vector?.distanceLabel ?? NO_VALUE} />
        <Cell label="DIR" value={vector?.bearingLabel ?? NO_VALUE} sub={vector ? vector.refLabel : undefined} />
        <Cell label="ELEV" value={formatLength(item.elevationM, altitudeUnit)} />
      </View>
      {ring ? (
        <View testID="ring-row" className="flex-row items-baseline justify-between gap-3 border-t border-border pt-3">
          <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">RING</Text>
          <Text className="shrink font-mono text-sm text-text">{ring}</Text>
        </View>
      ) : null}
    </View>
  );
}
