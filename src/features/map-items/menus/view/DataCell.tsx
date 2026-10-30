import { Text, View } from 'react-native';

export const NO_VALUE = '—';

/** "1.46 km" → ["1.46", "km"]; a value with no unit ("045°", "—") keeps it all as the number. */
function splitUnit(text: string): [string, string] {
  const i = text.lastIndexOf(' ');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}

/** One cell of a data card's bottom row: label over a large number and its small unit. `last` drops the divider on its right. */
export function DataCell({ label, value, accent = false, last = false }: { label: string; value: string; accent?: boolean; last?: boolean }) {
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
