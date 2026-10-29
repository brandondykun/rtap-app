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

/** "1.46 km" → ["1.46", "km"]; a value with no unit ("045°", "—") keeps it all as the number. */
function splitUnit(text: string): [string, string] {
  const i = text.lastIndexOf(' ');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}

/** One cell of the card's bottom row: label over a large number and its small unit. `last` drops the divider on its right. */
function Cell({ label, value, accent = false, last = false }: { label: string; value: string; accent?: boolean; last?: boolean }) {
  const [number, unit] = splitUnit(value);
  return (
    <View className={`flex-1 gap-0.5 px-3 py-2 ${last ? '' : 'border-r border-border'}`}>
      <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit className="font-mono-bold text-lg">
        <Text className={value === NO_VALUE ? 'text-text-muted' : accent ? 'text-accent' : 'text-text'}>{number}</Text>
        {unit ? <Text className="font-mono text-xs text-text-muted">{` ${unit}`}</Text> : null}
      </Text>
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
    // Black like the inputs, with thin lines between its parts (the mockup's grid card).
    <View className="overflow-hidden rounded-xl border border-border bg-surface-input">
      <View className="flex-row items-center gap-3 border-b border-border px-3 py-2.5">
        <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">{coordinateFormat === 'mgrs' ? 'MGRS' : 'LAT/LON'}</Text>
        <Text selectable numberOfLines={1} adjustsFontSizeToFit className="shrink font-mono-bold text-xl text-text">{coord ? formatCoordinate(coord, coordinateFormat) : NO_VALUE}</Text>
      </View>
      <View className="flex-row">
        <Cell label="DIST" value={vector?.distanceLabel ?? NO_VALUE} accent />
        <Cell label={vector ? `DIR (${vector.refLabel})` : 'DIR'} value={vector?.bearingLabel ?? NO_VALUE} accent />
        <Cell label="ELEV" value={formatLength(item.elevationM, altitudeUnit)} last />
      </View>
      {ring ? (
        <View testID="ring-row" className="flex-row items-baseline gap-3 border-t border-border px-3 py-2">
          <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">RING</Text>
          <Text className="shrink font-mono text-base text-text">{ring}</Text>
        </View>
      ) : null}
    </View>
  );
}
