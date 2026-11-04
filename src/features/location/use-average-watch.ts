import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { notifyWarning } from '@/features/feedback/feedback';
import { useGpsAverage } from '@/stores/gps-average';

import { ACCEL_INTERVAL_MS, createMotionDetector, loadAccelerometer } from './motion';

const KEEP_AWAKE_TAG = 'gps-average';

/**
 * Keeps GPS averaging honest while it runs: the accelerometer and leaving the app pause it, and the screen stays
 * on. GPS alone still detects movement (the store does that), so a missing accelerometer is not an error.
 */
export function useAverageWatch(): void {
  const averaging = useGpsAverage((s) => s.phase === 'averaging');

  // Any averaging -> paused change buzzes, whether the accelerometer or GPS noticed the move.
  useEffect(
    () =>
      useGpsAverage.subscribe((state, prev) => {
        if (prev.phase === 'averaging' && state.phase === 'paused') notifyWarning();
      }),
    [],
  );

  useEffect(() => {
    if (!averaging) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [averaging]);

  useEffect(() => {
    if (!averaging) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') useGpsAverage.getState().pause(Date.now());
    });
    return () => sub.remove();
  }, [averaging]);

  useEffect(() => {
    if (!averaging) return;
    let cancelled = false;
    let remove: (() => void) | null = null;

    (async () => {
      const accel = loadAccelerometer();
      if (!accel || typeof accel.addListener !== 'function') return;
      try {
        if (!(await accel.isAvailableAsync())) return;
        if (cancelled) return;
        const detector = createMotionDetector();
        accel.setUpdateInterval(ACCEL_INTERVAL_MS);
        const sub = accel.addListener(({ x, y, z }) => {
          const at = Date.now();
          const verdict = detector.push(x, y, z, at);
          if (verdict === 'still') useGpsAverage.getState().markStill(at);
          else if (verdict === 'moving') useGpsAverage.getState().pause(at);
        });
        remove = () => sub.remove();
      } catch {
        // No usable sensor: GPS alone keeps detecting movement.
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [averaging]);
}
