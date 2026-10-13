import { itemCategory, type ItemCategory, type ItemRef } from '@/features/symbology/categories';
import { useMenu } from '@/stores/menu';

/** Words the shared item menus use per category. */
export const ITEM_COPY: Record<ItemCategory, { noun: string; title: string }> = {
  unit: { noun: 'unit', title: 'Unit' },
  point: { noun: 'point', title: 'Point' },
  line: { noun: 'line', title: 'Line' },
  polygon: { noun: 'polygon', title: 'Polygon' },
};

/** Open the right view for a map item (tap on the map or a Layers row). */
export function openItemMenu(itemId: string, item: ItemRef): void {
  const category = itemCategory(item);
  if (category === 'point') useMenu.getState().openMenu('point.edit', { itemId });
  else if (category === 'line') useMenu.getState().openMenu('line.edit', { itemId });
  else if (category === 'polygon') useMenu.getState().openMenu('polygon.edit', { itemId });
  else useMenu.getState().openMenu('unit.edit', { itemId });
}
