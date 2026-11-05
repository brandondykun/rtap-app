import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';

/** Subscribes for the component's lifetime; re-subscribes when `deps` change. */
export function useObservable<T>(factory: () => Observable<T>, initial: T, deps: readonly unknown[]): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = factory().subscribe({
      next: setValue,
      error: (e: unknown) => console.error('[useObservable]', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** The last value seen for each key, per scope (a database: tests, each with their own, never see each other's). */
const remembered = new WeakMap<object, Map<string, unknown>>();

function rememberedIn(scope: object): Map<string, unknown> {
  let store = remembered.get(scope);
  if (!store) {
    store = new Map();
    remembered.set(scope, store);
  }
  return store;
}

/**
 * `useObservable` that starts from the last value seen for `key` in `scope` instead of `initial`: a menu opened again
 * shows what it showed last while its query runs again (a frame or two), instead of flashing empty first. The first time
 * it has nothing to remember and starts from `initial`.
 */
export function useRememberedObservable<T>(scope: object, key: string, factory: () => Observable<T>, initial: T, deps: readonly unknown[]): T {
  const [state, setState] = useState(() => {
    const store = rememberedIn(scope);
    return { key, value: store.has(key) ? (store.get(key) as T) : initial };
  });
  useEffect(() => {
    const store = rememberedIn(scope);
    const sub = factory().subscribe({
      next: (value) => {
        store.set(key, value);
        setState({ key, value });
      },
      error: (e: unknown) => console.error('[useObservable]', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, key, ...deps]);
  if (state.key === key) return state.value;
  // The key changed (another mission): its own remembered value until its query answers.
  const store = rememberedIn(scope);
  return store.has(key) ? (store.get(key) as T) : initial;
}
