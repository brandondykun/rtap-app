import { itemCategory, type ItemCategory, type ItemRef } from '@/features/symbology/categories';
import { useMenu } from '@/stores/menu';

/** Words the shared item menus use per category. */
export const ITEM_COPY: Record<ItemCategory, { noun: string; title: string }> = {
  unit: { noun: 'unit', title: 'Unit' },
  point: { noun: 'point', title: 'Point' },
  line: { noun: 'line', title: 'Line' },
  polygon: { noun: 'polygon', title: 'Polygon' },
};

/**
 * Open the right view for a map item (tap on the map or a Layers row). `drill` opens it over the
 * current menu, whose Back returns there; otherwise it replaces the open menu.
 */
export function openItemMenu(itemId: string, item: ItemRef, { drill = false }: { drill?: boolean } = {}): void {
  const category = itemCategory(item);
  const id = category === 'point' ? 'point.edit' : category === 'line' ? 'line.edit' : category === 'polygon' ? 'polygon.edit' : 'unit.edit';
  const menu = useMenu.getState();
  if (drill) menu.pushMenu(id, { itemId });
  else menu.openMenu(id, { itemId });
}
