import { itemCategory, type ItemCategory } from '@/features/symbology/categories';
import { useMenu } from '@/stores/menu';

/** Words the shared item menus use per category. */
export const ITEM_COPY: Record<ItemCategory, { noun: string; title: string }> = {
  unit: { noun: 'unit', title: 'Unit' },
  point: { noun: 'point', title: 'Point' },
};

/** Open the right view for a map item (tap on the map or a Layers row). */
export function openItemMenu(itemId: string, sidc: string | null): void {
  if (itemCategory(sidc) === 'point') useMenu.getState().openMenu('point.edit', { itemId });
  else useMenu.getState().openMenu('unit.edit', { itemId });
}
