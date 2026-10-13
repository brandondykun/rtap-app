import { editPointMenu } from '@/features/map-items/menus/EditPointMenu';
import { addPointMenu } from '@/features/map-items/menus/AddPointMenu';

import type { MenuDefinition } from './define-menu';
import { appRootMenu } from './menus/AppRootMenu';
import { settingsMenu } from './menus/SettingsMenu';
import type { MenuId } from './params';

/** Every menu, registered once by id. */
export type MenuRegistry = { [I in MenuId]: MenuDefinition<I> };

export const MENU_REGISTRY: MenuRegistry = {
  'app.root': appRootMenu,
  'point.add': addPointMenu,
  'point.edit': editPointMenu,
  settings: settingsMenu,
};
