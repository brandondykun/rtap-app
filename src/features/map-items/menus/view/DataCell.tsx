import { Text, View } from 'react-native';

import { unitGap } from '@/components/ui/unit-gap';
import { VALUE_TEXT_CLASS, type ValueKind } from '@/theme/value-colors';

export const NO_VALUE = '—';

/** "1.46 km" → ["1.46", "km"]; a value with no unit ("045°", "—") keeps it all as the number. */
function splitUnit(text: string): [string, string] {
  const i = text.lastIndexOf(' ');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}

/**
 * One cell of a data card's bottom row: label over a large number and its small unit, the number in its `kind`'s value
 * color. `last` drops the divider on its right.
 */
export function DataCell({ label, value, kind, last = false }: { label: string; value: string; kind?: ValueKind; last?: boolean }) {
  const [number, unit] = splitUnit(value);
  return (
    <View className={`flex-1 gap-0.5 px-3 py-2 ${last ? '' : 'border-r border-border'}`}>
      <Text className="font-mono text-xs uppercase tracking-widest text-text-muted">{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit className="font-mono-bold text-lg">
        <Text className={value === NO_VALUE ? 'text-text-muted' : kind ? VALUE_TEXT_CLASS[kind] : 'text-text'}>{number}</Text>
        {unit ? (
          <Text className="font-mono text-xs text-text-muted">
            {unitGap(12)}
            {unit}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}
