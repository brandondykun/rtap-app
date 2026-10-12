/**
 * Coalesces calls so `fn` runs at most once per scheduled frame, with the latest value.
 * Used for camera updates, which native code can emit faster than React should re-render.
 */
export function createLatestThrottle<T>(
  fn: (value: T) => void,
  schedule: (cb: () => void) => unknown = requestAnimationFrame,
): (value: T) => void {
  let pending = false;
  let latest: T;
  return (value) => {
    latest = value;
    if (pending) return;
    pending = true;
    schedule(() => {
      pending = false;
      fn(latest);
    });
  };
}
