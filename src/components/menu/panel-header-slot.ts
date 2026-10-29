import { createContext } from 'react';

import type { MenuHeaderProps } from './MenuHeader';

/** Set by the Panel: a menu's header is drawn there, pinned above the scrolling content. Null outside a Panel. */
export const PanelHeaderSlot = createContext<((header: MenuHeaderProps | null) => void) | null>(null);

export type PanelScroll = {
  /** Scrolls the content to the end (a field at the bottom of a menu bringing itself into view). */
  scrollToEnd: () => void;
  /**
   * The keyboard itself scrolls a focused field into view (iOS, in the landscape drawer, which keeps its size). A field
   * revealing itself then leaves it to the keyboard, or the content would move twice.
   */
  keyboardRevealsFocus: boolean;
};

/** Set by the Panel. Null outside a Panel. */
export const PanelScrollContext = createContext<PanelScroll | null>(null);
