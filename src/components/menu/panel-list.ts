import type { FlashListRef } from '@shopify/flash-list';
import { useContext, useMemo } from 'react';

import { PanelScrollerContext, type PanelScroller } from './panel-header-slot';

export type PanelListProps<T> = Omit<PanelScroller, 'ref'> & { ref: (list: FlashListRef<T> | null) => void };

/**
 * The panel's scroll props for a FlashList, in a menu defined with `ownScroll`: spread them onto the list. Its `ref`
 * lets the panel scroll the list (back to the top, to a remembered position). Null outside such a menu.
 */
export function usePanelListProps<T>(): PanelListProps<T> | null {
  const scroller = useContext(PanelScrollerContext);
  return useMemo(() => {
    if (!scroller) return null;
    return {
      ...scroller,
      ref: (list: FlashListRef<T> | null) =>
        scroller.ref(
          list && {
            scrollTo: ({ y, animated }) => list.scrollToOffset({ offset: y, animated }),
            scrollToEnd: ({ animated }) => list.scrollToEnd({ animated }),
          },
        ),
    };
  }, [scroller]);
}
