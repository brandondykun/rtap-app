import { addLineMenu } from '@/features/map-items/menus/AddLineMenu';
import { addPointMenu } from '@/features/map-items/menus/AddPointMenu';
import { addUnitMenu } from '@/features/map-items/menus/AddUnitMenu';
import { editLineMenu } from '@/features/map-items/menus/EditLineMenu';
import { editPointMenu } from '@/features/map-items/menus/EditPointMenu';
import { editUnitMenu } from '@/features/map-items/menus/EditUnitMenu';
import { layersMenu } from '@/features/map-items/menus/LayersMenu';

import type { MenuDefinition } from './define-menu';
import { appRootMenu } from './menus/AppRootMenu';
import { settingsMenu } from './menus/SettingsMenu';
import type { MenuId } from './params';

/** Every menu, registered once by id. */
export type MenuRegistry = { [I in MenuId]: MenuDefinition<I> };

export const MENU_REGISTRY: MenuRegistry = {
  'app.root': appRootMenu,
  layers: layersMenu,
  'line.add': addLineMenu,
  'line.edit': editLineMenu,
  'point.add': addPointMenu,
  'point.edit': editPointMenu,
  settings: settingsMenu,
  'unit.add': addUnitMenu,
  'unit.edit': editUnitMenu,
};
