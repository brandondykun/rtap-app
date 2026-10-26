import { create } from 'zustand';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { MENU_PARAMS, type MenuId, type MenuParams } from '@/features/menus/params';

export type MenuEntry = { [I in MenuId]: { id: I; params: MenuParams<I> } }[MenuId];

/** `panelMinimized`: the panel is slid off screen (only its reopen button shows, in either orientation); the menu stays open. */
type MenuValues = { stack: MenuEntry[]; panelFrame: PanelFrame | null; panelMinimized: boolean };

type MenuActions = {
  /** Replaces the stack with this menu. Returns false (and changes nothing) for invalid params. */
  openMenu: <I extends MenuId>(id: I, params: MenuParams<I>) => boolean;
  pushMenu: <I extends MenuId>(id: I, params: MenuParams<I>) => boolean;
  back: () => void;
  closeMenu: () => void;
  /** Published by the Panel so the map can pad its camera and move the crosshair. */
  setPanelFrame: (frame: PanelFrame | null) => void;
  /** Hides or shows the landscape drawer without changing the menu. Opening or closing a menu shows it again. */
  setPanelMinimized: (minimized: boolean) => void;
};

export const INITIAL_MENU: MenuValues = { stack: [], panelFrame: null, panelMinimized: false };

function entry(id: MenuId, params: unknown): MenuEntry | null {
  const parsed = MENU_PARAMS[id].safeParse(params);
  if (!parsed.success) {
    console.error(`[menu] invalid params for ${id}`, parsed.error.issues);
    return null;
  }
  return { id, params: parsed.data } as MenuEntry;
}

export const useMenu = create<MenuValues & MenuActions>()((set, get) => ({
  ...INITIAL_MENU,
  openMenu: (id, params) => {
    const next = entry(id, params);
    if (!next) return false;
    set({ stack: [next], panelMinimized: false });
    return true;
  },
  pushMenu: (id, params) => {
    const next = entry(id, params);
    if (!next) return false;
    set({ stack: [...get().stack, next], panelMinimized: false });
    return true;
  },
  back: () => set({ stack: get().stack.slice(0, -1) }),
  closeMenu: () => set({ stack: [], panelMinimized: false }),
  setPanelFrame: (panelFrame) => {
    // Ignore an identical frame: subscribers (the map's camera padding) must not re-render for no change.
    const current = get().panelFrame;
    if (current === panelFrame || (current && panelFrame && current.side === panelFrame.side && current.size === panelFrame.size)) return;
    set({ panelFrame });
  },
  setPanelMinimized: (panelMinimized) => set({ panelMinimized }),
}));

export function topMenu(state: { stack: MenuEntry[] }): MenuEntry | null {
  return state.stack[state.stack.length - 1] ?? null;
}
