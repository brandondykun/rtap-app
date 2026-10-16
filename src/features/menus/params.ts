import { z } from 'zod';

const latLon = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

/**
 * Typed params for every menu, by id. Kept apart from the menu components so the menu store can
 * validate params without importing UI (the registry imports the components).
 */
export const MENU_PARAMS = {
  'app.root': z.object({}),
  settings: z.object({}),
  layers: z.object({}),
  'line.add': z.object({}),
  'line.edit': z.object({ itemId: z.string().min(1) }),
  'polygon.add': z.object({}),
  'polygon.edit': z.object({ itemId: z.string().min(1) }),
  'point.add': z.object({ at: latLon.optional() }),
  'point.edit': z.object({ itemId: z.string().min(1) }),
  // `enemy`: long-press adds a hostile, unspecified unit, whatever the toolbar's Add unit last used.
  'unit.add': z.object({ at: latLon.optional(), enemy: z.boolean().optional() }),
  'unit.edit': z.object({ itemId: z.string().min(1) }),
} as const;

export type MenuId = keyof typeof MENU_PARAMS;
export type MenuParams<I extends MenuId> = z.infer<(typeof MENU_PARAMS)[I]>;
