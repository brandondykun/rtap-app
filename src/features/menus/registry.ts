import type { MenuDefinition } from './define-menu';
import { appRootMenu } from './menus/AppRootMenu';
import type { MenuId } from './params';

/** Every menu, registered once by id. Partial until every menu exists (made total in Task 14). */
export type MenuRegistry = { [I in MenuId]?: MenuDefinition<I> };

export const MENU_REGISTRY: MenuRegistry = {
  'app.root': appRootMenu,
};
