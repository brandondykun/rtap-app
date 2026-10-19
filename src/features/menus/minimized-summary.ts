import type { DraftValues } from '@/stores/draft';

import type { MenuId } from './params';

/** What the minimized drawer's button says about the open menu: `label`, an amber `detail`, and both for screen readers. */
export type MinimizedSummary = { label: string; detail: string | null; spoken: string };

const ITEM_MENUS: readonly MenuId[] = ['unit.add', 'unit.edit', 'point.add', 'point.edit', 'line.add', 'line.edit', 'polygon.add', 'polygon.edit'];

const count = (n: number, short: string, long: string) => ({ detail: `${n} ${n === 1 ? short : `${short}S`}`, spoken: `${n} ${n === 1 ? long : `${long}s`}` });

/**
 * The item being added or edited (its name, plus the point count for lines and polygons, or CIRCLE),
 * or just the menu's name for any other menu.
 */
export function minimizedSummary(menuId: MenuId, title: string, draft: Pick<DraftValues, 'mode' | 'category' | 'name' | 'vertices' | 'polygonShape'>): MinimizedSummary {
  const name = draft.name.trim();
  // Another menu, or an item without a name yet: the menu's name.
  if (!ITEM_MENUS.includes(menuId) || draft.mode === null || !name) return { label: title.toUpperCase(), detail: null, spoken: title };
  if (draft.category === 'polygon' && draft.polygonShape === 'circle') return { label: name, detail: 'CIRCLE', spoken: `${name}, circle` };
  if (draft.category === 'line' || draft.category === 'polygon') {
    const c = count(draft.vertices.length, 'PT', 'point');
    return { label: name, detail: c.detail, spoken: `${name}, ${c.spoken}` };
  }
  return { label: name, detail: null, spoken: name };
}
