import { Text, View } from 'react-native';

import type { ItemCategory } from '@/features/symbology/categories';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useTheme } from '@/theme/ThemeProvider';

import type { MapItemSnapshot } from '../../repository';
import { pointSubtitle, unitSubtitle } from './item-summary';

/** Header summary: symbol, name and a one-line type subtitle (the affiliation word in its map color). */
export function ItemTitle({ category, item, hidden }: { category: ItemCategory; item: Pick<MapItemSnapshot, 'name' | 'sidc'>; hidden: boolean }) {
  const { colors } = useTheme();
  const unit = category === 'unit' ? unitSubtitle(item.sidc) : null;
  const subtitle = unit ? unit.text : pointSubtitle(item.sidc);
  const first = unit?.affiliation ? subtitle.split(' · ')[0] : null;
  const color = unit?.affiliation ? { friend: colors.friendly, hostile: colors.danger, neutral: colors.neutral, unknown: colors.unknown }[unit.affiliation] : undefined;
  return (
    <View className="flex-row items-center gap-3">
      {item.sidc ? <SymbolImage sidc={item.sidc} width={40} height={40} /> : null}
      <View className="shrink gap-0.5">
        <Text numberOfLines={1} className="font-mono-bold text-xl text-text">{item.name}</Text>
        <View className="flex-row items-center gap-2">
          <Text testID="item-subtitle" numberOfLines={1} className="shrink text-base text-text-muted">
            {first ? <Text style={{ color }}>{first}</Text> : null}
            {first ? subtitle.slice(first.length) : subtitle}
          </Text>
          {hidden ? <Text testID="hidden-tag" className="rounded border border-border px-1 text-xs font-semibold uppercase text-text-muted">Hidden</Text> : null}
        </View>
      </View>
    </View>
  );
}
