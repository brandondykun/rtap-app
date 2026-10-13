import type { ComponentType } from 'react';

import type { Detent } from '@/components/menu/panel-geometry';

import type { MenuId, MenuParams } from './params';

/** `app` menus close with "Close"; `action` menus have Cancel plus a primary action. */
export type MenuFamily = 'app' | 'action';

export type MenuComponentProps<I extends MenuId> = { params: MenuParams<I>; missionId: string };

export type MenuDefinition<I extends MenuId> = {
  id: I;
  family: MenuFamily;
  title: string;
  /** Bottom-sheet detents in portrait, smallest first. Opens at `half` when listed. */
  detents: readonly Detent[];
  component: ComponentType<MenuComponentProps<I>>;
};

/** Declares a menu once; its params schema lives in `params.ts` under the same id. */
export function defineMenu<I extends MenuId>(definition: MenuDefinition<I>): MenuDefinition<I> {
  return definition;
}
