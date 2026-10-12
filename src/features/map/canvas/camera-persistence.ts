import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { saveMissionCamera } from '@/features/missions/commands';
import type { MissionCamera } from '@/features/missions/repository';
import type { CommandContext } from '@/lib/db/command-context';

export const CAMERA_SAVE_DEBOUNCE_MS = 1000;

export type CameraSaver = {
  schedule: (camera: MissionCamera) => void;
  flush: () => void;
  /** The camera moved since the last save/schedule, so flush() may fall back to the live camera. */
  touch: () => void;
};
/** Latest live camera, used when a flush finds nothing pending (e.g. backgrounded before map idle). */
export type CameraFallback = () => MissionCamera | null;

function sameCamera(a: MissionCamera, b: MissionCamera): boolean {
  return a.center.lat === b.center.lat && a.center.lon === b.center.lon && a.zoom === b.zoom && a.bearing === b.bearing;
}

/** Debounced "save the latest camera"; flush() writes the pending (else, if touched, fallback) camera now. */
export function createCameraSaver(
  save: (camera: MissionCamera) => void,
  delayMs = CAMERA_SAVE_DEBOUNCE_MS,
  fallback?: CameraFallback,
): CameraSaver {
  let pending: MissionCamera | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSaved: MissionCamera | null = null;
  let touched = false;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const camera = pending ?? (touched ? fallback?.() : null) ?? null;
    pending = null;
    touched = false;
    // Blur and unmount both flush; do not write the same camera twice.
    if (camera === null || (lastSaved !== null && sameCamera(lastSaved, camera))) return;
    lastSaved = camera;
    save(camera);
  };

  return {
    schedule: (camera) => {
      pending = camera;
      touched = false;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    touch: () => {
      touched = true;
    },
  };
}

/**
 * Saves the mission camera after the map settles, and immediately when the screen blurs,
 * unmounts, or the app leaves the foreground (so a kill from the app switcher keeps it).
 */
/** `getFallback` should be referentially stable (useCallback); a new one recreates the saver. */
export function useCameraPersistence(ctx: CommandContext, missionId: string, getFallback?: CameraFallback): CameraSaver {
  const saver = useMemo(
    () =>
      createCameraSaver(
        (camera) => {
          void saveMissionCamera(ctx, missionId, camera);
        },
        CAMERA_SAVE_DEBOUNCE_MS,
        getFallback,
      ),
    [ctx, missionId, getFallback],
  );

  useFocusEffect(useCallback(() => () => saver.flush(), [saver]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saver.flush();
    });
    return () => {
      sub.remove();
      saver.flush();
    };
  }, [saver]);

  return saver;
}
