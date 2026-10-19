import type { MapView } from '@rnmapbox/maps';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, type RefObject } from 'react';
import { AppState } from 'react-native';

import { saveMissionSnapshot } from '@/features/missions/snapshots';
import type { CommandContext } from '@/lib/db/command-context';

/** Leaving the mission waits this long for the picture at most. */
export const SNAPSHOT_LEAVE_TIMEOUT_MS = 1000;
/** A native snapshot that takes longer is given up, so later captures can run. */
export const SNAPSHOT_TAKE_TIMEOUT_MS = 5000;

type Capture = () => Promise<void>;

/** Resolves when `promise` settles or after `ms`, whichever comes first. */
function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** One capture at a time; failures keep the previous picture. */
export function createSnapshotCapture(takeSnap: () => Promise<string | null>, save: (uri: string) => Promise<unknown>): Capture {
  let inFlight: Promise<void> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        // A hung native snapshot must not wedge every later capture.
        const uri = await settleWithin(takeSnap(), SNAPSHOT_TAKE_TIMEOUT_MS);
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

/** Runs a capture; resolves within the timeout whatever happens. */
export async function captureWithin(capture: Capture, timeoutMs = SNAPSHOT_LEAVE_TIMEOUT_MS): Promise<void> {
  await settleWithin(capture(), timeoutMs);
}

/** Reads the ref only when called (from an event), never during render. */
async function takeMapSnap(mapRef: RefObject<MapView | null>): Promise<string | null> {
  return mapRef.current ? mapRef.current.takeSnap(true) : null;
}

/**
 * Pictures the mission map (symbology included) when the screen is about to be removed (back,
 * Switch mission), when it blurs under another screen, and when the app backgrounds.
 */
export function useMissionSnapshot(ctx: CommandContext, missionId: string, mapRef: RefObject<MapView | null>): void {
  const navigation = useNavigation();
  const capture = useMemo(
    () =>
      createSnapshotCapture(
        () => takeMapSnap(mapRef),
        (uri) => saveMissionSnapshot(ctx, missionId, uri),
      ),
    [ctx, missionId, mapRef],
  );

  // A pop unmounts the screen and detaches the map ref before blur runs: capture while the map is
  // still mounted, then let the removal through (the re-dispatched action passes this listener).
  useEffect(() => {
    let leaving = false;
    return navigation.addListener('beforeRemove', (e) => {
      if (leaving) return;
      leaving = true;
      e.preventDefault();
      void captureWithin(capture).finally(() => {
        navigation.dispatch(e.data.action);
        // If something else kept the screen, the next leave captures again.
        leaving = false;
      });
    });
  }, [navigation, capture]);

  // Pushed under another screen (e.g. About): the map stays mounted.
  useFocusEffect(useCallback(() => () => void capture(), [capture]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void capture();
    });
    return () => sub.remove();
  }, [capture]);
}
