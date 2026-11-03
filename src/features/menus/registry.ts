import { addLineMenu } from '@/features/map-items/menus/AddLineMenu';
import { addPointMenu } from '@/features/map-items/menus/AddPointMenu';
import { addPolygonMenu } from '@/features/map-items/menus/AddPolygonMenu';
import { addUnitMenu } from '@/features/map-items/menus/AddUnitMenu';
import { editLineMenu } from '@/features/map-items/menus/EditLineMenu';
import { editPointMenu } from '@/features/map-items/menus/EditPointMenu';
import { editPolygonMenu } from '@/features/map-items/menus/EditPolygonMenu';
import { editUnitMenu } from '@/features/map-items/menus/EditUnitMenu';
import { layersMenu } from '@/features/map-items/menus/LayersMenu';
import { overlaysMenu } from '@/features/overlays/OverlaysMenu';

import type { MenuDefinition } from './define-menu';
import { appRootMenu } from './menus/AppRootMenu';
import { settingsMenu } from './menus/SettingsMenu';
import type { MenuId } from './params';

/** Every menu, registered once by id. */
export type MenuRegistry = { [I in MenuId]: MenuDefinition<I> };

export const MENU_REGISTRY: MenuRegistry = {
  'app.root': appRootMenu,
  layers: layersMenu,
  overlays: overlaysMenu,
  'line.add': addLineMenu,
  'line.edit': editLineMenu,
  'point.add': addPointMenu,
  'point.edit': editPointMenu,
  'polygon.add': addPolygonMenu,
  'polygon.edit': editPolygonMenu,
  settings: settingsMenu,
  'unit.add': addUnitMenu,
  'unit.edit': editUnitMenu,
};
