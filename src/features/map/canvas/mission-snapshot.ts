import type { MapView } from '@rnmapbox/maps';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, type RefObject } from 'react';
import { AppState } from 'react-native';

import { saveMissionSnapshot } from '@/features/missions/snapshots';
import type { CommandContext } from '@/lib/db/command-context';

/** "Switch mission" waits this long for the picture at most. */
export const SNAPSHOT_LEAVE_TIMEOUT_MS = 1000;

type Capture = () => Promise<void>;

/** One capture at a time; failures keep the previous picture. */
export function createSnapshotCapture(takeSnap: () => Promise<string | null>, save: (uri: string) => Promise<unknown>): Capture {
  let inFlight: Promise<void> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const uri = await takeSnap();
        if (uri) await save(uri);
      } catch {
        // Keep the previous picture.
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}

/** The open mission's capture, for leaving through the menu. */
let active: Capture | null = null;

/** Captures the open mission's map picture; resolves within the timeout whatever happens. */
export async function captureBeforeLeave(timeoutMs = SNAPSHOT_LEAVE_TIMEOUT_MS): Promise<void> {
  const capture = active;
  if (!capture) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([capture(), new Promise<void>((resolve) => (timer = setTimeout(resolve, timeoutMs)))]);
  clearTimeout(timer);
}

/** Reads the ref only when called (from an event), never during render. */
async function takeMapSnap(mapRef: RefObject<MapView | null>): Promise<string | null> {
  return mapRef.current ? mapRef.current.takeSnap(true) : null;
}

/** Pictures the mission map (symbology included) when the screen blurs and when the app backgrounds. */
export function useMissionSnapshot(ctx: CommandContext, missionId: string, mapRef: RefObject<MapView | null>): void {
  const capture = useMemo(
    () =>
      createSnapshotCapture(
        () => takeMapSnap(mapRef),
        (uri) => saveMissionSnapshot(ctx, missionId, uri),
      ),
    [ctx, missionId, mapRef],
  );

  useEffect(() => {
    active = capture;
    return () => {
      if (active === capture) active = null;
    };
  }, [capture]);

  useFocusEffect(useCallback(() => () => void capture(), [capture]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void capture();
    });
    return () => sub.remove();
  }, [capture]);
}
