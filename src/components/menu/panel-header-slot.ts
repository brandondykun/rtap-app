import { createContext } from 'react';

import type { MenuHeaderProps } from './MenuHeader';

/** Set by the Panel: a menu's header is drawn there, pinned above the scrolling content. Null outside a Panel. */
export const PanelHeaderSlot = createContext<((header: MenuHeaderProps | null) => void) | null>(null);

/** Set by the Panel: scrolls its content to the end (a field at the bottom of a menu bringing itself into view). Null outside a Panel. */
export const PanelScrollToEnd = createContext<(() => void) | null>(null);
