import { useCallback, useEffect, useState } from 'react';

/** How long the second tap stays armed before the button falls back to its first label. */
export const ARM_TIMEOUT_MS = 4000;

/** Two-tap confirm state: `arm()` on the first tap; it disarms by itself after `ARM_TIMEOUT_MS`. */
export function useArmed() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  const arm = useCallback(() => setArmed(true), []);
  const disarm = useCallback(() => setArmed(false), []);
  return { armed, arm, disarm };
}
