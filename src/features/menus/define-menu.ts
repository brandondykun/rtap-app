import type { ComponentType } from 'react';

import type { IconName } from '@/components/ui/Icon';

import type { MenuId, MenuParams } from './params';

/** `app` menus close with "Close"; `action` menus have Cancel plus a primary action. */
export type MenuFamily = 'app' | 'action';

export type MenuComponentProps<I extends MenuId> = { params: MenuParams<I>; missionId: string };

export type MenuDefinition<I extends MenuId> = {
  id: I;
  family: MenuFamily;
  title: string;
  /** The toolbar icon for this menu; shown on the minimized drawer's button. */
  icon: IconName;
  component: ComponentType<MenuComponentProps<I>>;
  /** The menu scrolls itself (a long virtualized list): the panel hands it its scroll props (usePanelListProps) instead of wrapping it in a scroll view. */
  ownScroll?: boolean;
  /** Portrait: the sheet fitted to the content only ever grows while the menu is open (Layers: switching tabs never shrinks it). */
  growOnly?: boolean;
};

/** Declares a menu once; its params schema lives in `params.ts` under the same id. */
export function defineMenu<I extends MenuId>(definition: MenuDefinition<I>): MenuDefinition<I> {
  return definition;
}
