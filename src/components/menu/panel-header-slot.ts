import { createContext } from 'react';

import type { MenuHeaderProps } from './MenuHeader';

/** Set by the Panel: a menu's header is drawn there, pinned above the scrolling content. Null outside a Panel. */
export const PanelHeaderSlot = createContext<((header: MenuHeaderProps | null) => void) | null>(null);

export type PanelScroll = {
  /** Scrolls the content to the end (a field at the bottom of a menu bringing itself into view). */
  scrollToEnd: () => void;
  /** Jumps back to the top (a menu swapping a long form for a short view). */
  scrollToTop: () => void;
  /**
   * The panel keeps its size while the keyboard opens (iOS, the landscape drawer), and iOS starts its own small scroll to
   * the cursor as it opens. A field revealing itself then scrolls as the keyboard starts to show, so the two run together
   * as one movement, instead of after it is up (a second movement).
   */
  scrollAsKeyboardShows: boolean;
};

/** Set by the Panel. Null outside a Panel. */
export const PanelScrollContext = createContext<PanelScroll | null>(null);
