import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { saveMissionCamera } from '@/features/missions/commands';
import type { MissionCamera } from '@/features/missions/repository';
import type { CommandContext } from '@/lib/db/command-context';

export const CAMERA_SAVE_DEBOUNCE_MS = 1000;

export type CameraSaver = { schedule: (camera: MissionCamera) => void; flush: () => void };

/** Debounced "save the latest camera"; flush() writes a pending camera now. */
export function createCameraSaver(save: (camera: MissionCamera) => void, delayMs = CAMERA_SAVE_DEBOUNCE_MS): CameraSaver {
  let pending: MissionCamera | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending !== null) {
      const camera = pending;
      pending = null;
      save(camera);
    }
  };

  return {
    schedule: (camera) => {
      pending = camera;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}

/**
 * Saves the mission camera after the map settles, and immediately when the screen blurs,
 * unmounts, or the app leaves the foreground (so a kill from the app switcher keeps it).
 */
export function useCameraPersistence(ctx: CommandContext, missionId: string): CameraSaver {
  const saver = useMemo(
    () =>
      createCameraSaver((camera) => {
        void saveMissionCamera(ctx, missionId, camera);
      }),
    [ctx, missionId],
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
