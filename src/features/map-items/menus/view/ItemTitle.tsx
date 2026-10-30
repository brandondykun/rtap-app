import type { ItemCategory } from '@/features/symbology/categories';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useTheme } from '@/theme/ThemeProvider';

import type { MapItemSnapshot } from '../../repository';
import { IdentityBlock } from './IdentityBlock';
import { itemAccessibleTitle, pointSubtitle, unitSubtitle } from './item-summary';

/** Top of the view: symbol, name and a one-line type subtitle (the affiliation word in its map color). Read out as one line. */
export function ItemTitle({ category, item, hidden }: { category: ItemCategory; item: Pick<MapItemSnapshot, 'name' | 'sidc'>; hidden: boolean }) {
  const { colors } = useTheme();
  const unit = category === 'unit' ? unitSubtitle(item.sidc) : null;
  const subtitle = unit ? unit.text : pointSubtitle(item.sidc);
  const first = unit?.affiliation ? subtitle.split(' · ')[0] : null;
  const color = unit?.affiliation ? { friend: colors.friendly, hostile: colors.danger, neutral: colors.neutral, unknown: colors.unknown }[unit.affiliation] : undefined;
  return (
    <IdentityBlock
      testID="item-title"
      accessibilityLabel={itemAccessibleTitle(category, item, hidden)}
      icon={item.sidc ? <SymbolImage sidc={item.sidc} width={40} height={40} /> : null}
      name={item.name}
      lead={first}
      leadColor={color}
      rest={first ? subtitle.slice(first.length) : subtitle}
      hidden={hidden}
    />
  );
}
