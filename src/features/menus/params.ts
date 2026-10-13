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
  'unit.add': z.object({ at: latLon.optional() }),
  'unit.edit': z.object({ itemId: z.string().min(1) }),
} as const;

export type MenuId = keyof typeof MENU_PARAMS;
export type MenuParams<I extends MenuId> = z.infer<(typeof MENU_PARAMS)[I]>;
