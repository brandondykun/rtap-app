import { createContext } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

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

/** What the panel scrolls: its own scroll view, or the list of a menu that scrolls itself. */
export type PanelScrollable = {
  scrollTo: (to: { y: number; animated: boolean }) => void;
  scrollToEnd: (options: { animated: boolean }) => void;
};

/**
 * For a menu that scrolls itself (a long, virtualized list; `ownScroll` in its definition): what the panel's own scroll
 * view would do, for the menu to put on its list — measuring for the sheet height, the header hairline and the scroll
 * memory, keyboard handling and padding, and `ref` so the panel can scroll it. Null outside such a menu.
 */
export type PanelScroller = {
  testID: string;
  ref: (scrollable: PanelScrollable | null) => void;
  onLayout: (e: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  keyboardShouldPersistTaps: 'handled';
  automaticallyAdjustKeyboardInsets: boolean;
  contentContainerStyle: { paddingBottom: number; paddingTop: number };
};

export const PanelScrollerContext = createContext<PanelScroller | null>(null);
