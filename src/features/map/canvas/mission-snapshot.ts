import { snapshotManager, type MapView } from '@rnmapbox/maps';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, type RefObject } from 'react';
import { AppState, Dimensions, Platform } from 'react-native';

import type { MapArea } from '@/features/missions/snapshot-crop';
import { saveMissionSnapshot } from '@/features/missions/snapshots';
import type { CommandContext } from '@/lib/db/command-context';
import { useInteraction } from '@/stores/interaction';
import { useMenu } from '@/stores/menu';
import { useSettings } from '@/stores/settings';

import { BASEMAP_STYLE_URLS } from './mapbox';


/** The map is pictured once it has been still this long after anything on it changed. */
export const SNAPSHOT_SETTLE_MS = 2500;
/** A native snapshot that takes longer is given up, so later captures can run. */
export const SNAPSHOT_TAKE_TIMEOUT_MS = 5000;
/** Writes to these tables change what the map shows. */
const MAP_TABLES = ['map_items', 'item_view_state'] as const;

type Capture = () => Promise<void>;

/** Resolves when `promise` settles or after `ms`, whichever comes first. */
function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** One capture at a time; failures keep the previous picture (and are logged). */
export function createSnapshotCapture<T>(takeSnap: () => Promise<T | null>, save: (shot: T) => Promise<unknown>): Capture {
  let inFlight: Promise<void> | null = null;
  return () => {
    if (inFlight) return inFlight;
    let finished = false;
    const run = (async () => {
      try {
        // A hung native snapshot must not wedge every later capture.
        const shot = await settleWithin(takeSnap(), SNAPSHOT_TAKE_TIMEOUT_MS);
        if (shot) await save(shot);
      } catch (e) {
        console.warn('[snapshot] capture failed', e);
      } finally {
        finished = true;
        inFlight = null;
      }
    })();
    // A takeSnap that throws at once has already finished this run: never keep it as the one in flight.
    if (!finished) inFlight = run;
    return run;
  };
}

type MapShot = { uri: string; area: MapArea };

/**
 * Reads the ref only when called (from an event), never during render. The map fills the window, and
 * an open menu panel covers part of it: note both as the snapshot starts, so it can be cropped to
 * what was visible even if the panel moves before the snapshot is ready.
 */
async function takeMapSnap(mapRef: RefObject<MapView | null>): Promise<MapShot | null> {
  const map = mapRef.current;
  if (!map) return null;
  const { width, height } = Dimensions.get('window');
  const panel = useMenu.getState().panelFrame;
  if (Platform.OS === 'android') {
    // Rendered at the size of the map left visible, centred on the crosshair: nothing to crop away afterwards.
    const visible = {
      width: panel?.side === 'left' ? width - panel.size : width,
      height: panel?.side === 'bottom' ? height - panel.size : height,
    };
    const uri = await takeOffscreenSnap(visible.width, visible.height);
    return uri ? { uri, area: { view: visible, panel: null } } : null;
  }
  const uri = await map.takeSnap(true);
  return uri ? { uri, area: { view: { width, height }, panel } } : null;
}

/**
 * Android: its on-screen map snapshot comes back empty, and copying the map's surface stalls the map. Render the same
 * view offscreen instead, away from the on-screen map: the basemap only, without the mission's symbols.
 */
async function takeOffscreenSnap(width: number, height: number): Promise<string | null> {
  const { cameraCenter, cameraZoom, cameraBearing } = useInteraction.getState();
  if (!cameraCenter) return null;
  return snapshotManager.takeSnap({
    centerCoordinate: [cameraCenter.lon, cameraCenter.lat],
    zoomLevel: cameraZoom,
    heading: cameraBearing,
    width,
    height,
    styleURL: BASEMAP_STYLE_URLS[useSettings.getState().basemap],
    writeToDisk: true,
    withLogo: false,
  });
}

/**
 * Calls `onChange` whenever something that shows on the map changes: the camera, a setting, or a write to the map items
 * or their view state. Returns the unsubscribe.
 */
export function watchMapChanges(ctx: CommandContext, onChange: () => void): () => void {
  const unsubCamera = useInteraction.subscribe((s, prev) => {
    if (s.cameraCenter !== prev.cameraCenter || s.cameraZoom !== prev.cameraZoom || s.cameraBearing !== prev.cameraBearing) onChange();
  });
  const unsubSettings = useSettings.subscribe(onChange);
  // The first result is what was already on the map; later ones are writes.
  let first = true;
  const items = ctx.db.watch('SELECT 1 AS one', [], MAP_TABLES).subscribe({
    next: () => {
      if (first) first = false;
      else onChange();
    },
    error: (e: unknown) => console.warn('[snapshot] could not watch the map items', e),
  });
  return () => {
    unsubCamera();
    unsubSettings();
    items.unsubscribe();
  };
}

/**
 * Keeps the mission's picture (symbology included) current without ever holding up navigation: the map is pictured
 * once it has been still for a moment after the camera, the map items or a setting changed. Also when the screen blurs
 * under another one (e.g. About) or the app backgrounds. Leaving the mission tries one last picture without waiting
 * for it; the settled one is the fallback.
 */
export function useMissionSnapshot(ctx: CommandContext, missionId: string, mapRef: RefObject<MapView | null>): void {
  const navigation = useNavigation();
  const capture = useMemo(
    () =>
      createSnapshotCapture(
        () => takeMapSnap(mapRef),
        async (shot) => {
          const saved = await saveMissionSnapshot(ctx, missionId, shot.uri, shot.area);
          // Covered: a panel hid almost all of the map, so the previous picture is the better one.
          if (!saved.ok && saved.error !== 'covered') console.warn('[snapshot] save failed', saved.error, saved.message);
        },
      ),
    [ctx, missionId, mapRef],
  );

  useEffect(() => {
    let settle: ReturnType<typeof setTimeout> | undefined;
    const stop = watchMapChanges(ctx, () => {
      clearTimeout(settle);
      settle = setTimeout(() => void capture(), SNAPSHOT_SETTLE_MS);
    });
    return () => {
      clearTimeout(settle);
      stop();
    };
  }, [ctx, capture]);

  // Leaving (back, Switch mission): a pop detaches the map ref before the screen's cleanup runs, so start the picture
  // here while the map is still mounted, and never hold the removal up for it. If the native map goes before the
  // picture is done, the settled picture stays.
  useEffect(() => navigation.addListener('beforeRemove', () => void capture()), [navigation, capture]);

  // Pushed under another screen (e.g. About): the map stays mounted.
  useFocusEffect(useCallback(() => () => void capture(), [capture]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void capture();
    });
    return () => sub.remove();
  }, [capture]);
}
