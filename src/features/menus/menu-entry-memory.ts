import { useCallback, useState } from 'react';

import { topMenu, useMenu, type MenuEntry } from '@/stores/menu';

/**
 * View state kept per menu-stack entry (scroll position, search text), so a menu drilled out of
 * and back into comes back as it was left. Opening a menu afresh makes a new entry: it starts clean.
 */
const memory = new WeakMap<MenuEntry, Record<string, unknown>>();

export function rememberForEntry(entry: MenuEntry, key: string, value: unknown): void {
  memory.set(entry, { ...memory.get(entry), [key]: value });
}

export function recallForEntry<T>(entry: MenuEntry, key: string): T | undefined {
  return memory.get(entry)?.[key] as T | undefined;
}

/** `useState` that survives the menu being drilled out of and back into (kept on the entry it mounted for). */
export function useMenuEntryState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [entry] = useState(() => topMenu(useMenu.getState()));
  const [value, setValue] = useState<T>(() => (entry ? (recallForEntry<T>(entry, key) ?? initial) : initial));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      if (entry) rememberForEntry(entry, key, next);
    },
    [entry, key],
  );
  return [value, set];
}
