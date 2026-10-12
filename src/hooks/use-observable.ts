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
