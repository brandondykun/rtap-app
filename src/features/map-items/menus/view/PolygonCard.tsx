import { Platform, Text, View } from 'react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { useReadoutOrigin } from '@/features/map/interaction/use-readout-origin';
import { formatDistance } from '@/lib/geo/format/measure';
import { describeVector } from '@/lib/geo/vector';
import { useSettings } from '@/stores/settings';

import { formatArea } from '../../polygon-measure';
import { DataCell, NO_VALUE } from './DataCell';
import type { PolygonSummary } from './polygon-summary';

/** Long-press to copy the coordinate (iOS only: see the coordinate's Text). */
const COPYABLE = Platform.OS === 'ios';

/** The polygon's center and its range from the OP / you, its perimeter (radius for a circle) and area. */
export function PolygonCard({ summary }: { summary: PolygonSummary }) {
  const { from } = useReadoutOrigin();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const vector = from ? describeVector(from, summary.center, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
  const circle = summary.kind === 'circle';
  const size = circle ? summary.radiusM : summary.perimeterM;
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-surface-input">
      <View className="flex-row items-center gap-3 border-b border-border px-3 py-2.5">
        <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">{coordinateFormat === 'mgrs' ? 'CENTER' : 'LAT/LON'}</Text>
        <Text
          testID="coordinate-value"
          // Android draws selectable text with a different native view, which sits it higher than the label beside it.
          selectable={COPYABLE}
          numberOfLines={1}
          adjustsFontSizeToFit
          className="shrink font-mono-bold text-xl text-text">
          {formatCoordinate(summary.center, coordinateFormat)}
        </Text>
      </View>
      <View className="flex-row">
        <DataCell label="TO CENTER" value={vector?.distanceLabel ?? NO_VALUE} accent />
        <DataCell label={circle ? 'RADIUS' : 'PERIMETER'} value={size === null ? NO_VALUE : formatDistance(size)} />
        <DataCell label="AREA" value={formatArea(summary.areaM2)} last />
      </View>
    </View>
  );
}
