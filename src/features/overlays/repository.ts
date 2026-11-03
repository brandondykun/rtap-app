import { combineLatest, distinctUntilChanged, map, type Observable, shareReplay } from 'rxjs';

import { observeHiddenItemIds } from '@/features/map-items/repository';
import type { AppDb } from '@/lib/db/app-db';
import { Tables } from '@/lib/db/schema';

/** A mission's overlay, how many items are in it, and whether it is hidden on this device. */
export type Overlay = { id: string; missionId: string; name: string; sortOrder: number; hidden: boolean; itemCount: number };

type OverlayRow = { id: string; mission_id: string; name: string; sort_order: number; hidden: number | null; item_count: number };

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** The mission's overlays in order, each with this device's shown or hidden. */
export function observeMissionOverlays(db: AppDb, missionId: string): Observable<Overlay[]> {
  return db
    .watch<OverlayRow>(
      `SELECT o.id, o.mission_id, o.name, o.sort_order, v.hidden,
         (SELECT COUNT(*) FROM map_item_overlays l WHERE l.overlay_id = o.id) AS item_count
       FROM overlays o LEFT JOIN overlay_view_state v ON v.overlay_id = o.id
       WHERE o.mission_id = ? ORDER BY o.sort_order, o.created_at`,
      [missionId],
      [Tables.overlays, Tables.overlayViewState, Tables.mapItemOverlays],
    )
    .pipe(
      map((rows) =>
        rows.map((r) => ({ id: r.id, missionId: r.mission_id, name: r.name, sortOrder: r.sort_order, hidden: r.hidden === 1, itemCount: r.item_count ?? 0 })),
      ),
    );
}

/** The overlays an item is in (none: it is in the base). */
export function observeItemOverlayIds(db: AppDb, itemId: string): Observable<string[]> {
  return db
    .watch<{ overlay_id: string }>('SELECT overlay_id FROM map_item_overlays WHERE map_item_id = ? ORDER BY overlay_id', [itemId], [Tables.mapItemOverlays])
    .pipe(
      map((rows) => rows.map((r) => r.overlay_id)),
      distinctUntilChanged(sameIds),
    );
}

/** The base: not a stored overlay but the mission's items in no overlay, shown first as "Base". */
export const BASE_OVERLAY_ID = 'base';

/** The base as a chip, first among the overlays, with how many items are in it. */
export function baseOverlay(missionId: string, hidden: boolean, itemCount = 0): Overlay {
  return { id: BASE_OVERLAY_ID, missionId, name: 'Base', sortOrder: -1, hidden, itemCount };
}

/** How many of the mission's items are in the base (in no overlay). */
export function observeBaseItemCount(db: AppDb, missionId: string): Observable<number> {
  return db
    .watch<{ n: number }>(
      `SELECT COUNT(*) AS n FROM map_items i
       WHERE i.mission_id = ? AND NOT EXISTS (SELECT 1 FROM map_item_overlays l WHERE l.map_item_id = i.id)`,
      [missionId],
      [Tables.mapItems, Tables.mapItemOverlays],
    )
    .pipe(
      map(([row]) => row?.n ?? 0),
      distinctUntilChanged(),
    );
}

/** Whether this device hides the mission's base. */
export function observeBaseHidden(db: AppDb, missionId: string): Observable<boolean> {
  return db
    .watch<{ base_hidden: number | null }>('SELECT base_hidden FROM mission_view_state WHERE mission_id = ?', [missionId], [Tables.missionViewState])
    .pipe(
      map(([row]) => row?.base_hidden === 1),
      distinctUntilChanged(),
    );
}

/**
 * Items the overlays hide on this device: in no overlay while the base is hidden, or in overlays that are all hidden.
 * An item in several shows while any of them does.
 */
export function observeOverlayHiddenItemIds(db: AppDb, missionId: string): Observable<string[]> {
  return db
    .watch<{ id: string }>(
      `SELECT i.id FROM map_items i
       WHERE i.mission_id = ? AND (
         CASE WHEN EXISTS (SELECT 1 FROM map_item_overlays l WHERE l.map_item_id = i.id)
           THEN NOT EXISTS (
             SELECT 1 FROM map_item_overlays s LEFT JOIN overlay_view_state v ON v.overlay_id = s.overlay_id
             WHERE s.map_item_id = i.id AND COALESCE(v.hidden, 0) = 0
           )
           ELSE COALESCE((SELECT base_hidden FROM mission_view_state WHERE mission_id = i.mission_id), 0) = 1
         END
       )
       ORDER BY i.id`,
      [missionId],
      [Tables.mapItems, Tables.mapItemOverlays, Tables.overlayViewState, Tables.missionViewState],
    )
    .pipe(
      map((rows) => rows.map((r) => r.id)),
      distinctUntilChanged(sameIds),
    );
}

const mapHidden = new WeakMap<AppDb, Map<string, Observable<string[]>>>();

/**
 * Everything the map leaves out: items hidden one by one, and items whose overlays are all hidden. One live query per
 * database and mission, however many map layers watch it.
 */
export function observeMapHiddenItemIds(db: AppDb, missionId: string): Observable<string[]> {
  let byMission = mapHidden.get(db);
  if (!byMission) mapHidden.set(db, (byMission = new Map()));
  let observable = byMission.get(missionId);
  if (!observable) {
    observable = combineLatest([observeHiddenItemIds(db), observeOverlayHiddenItemIds(db, missionId)]).pipe(
      map(([items, overlays]) => (overlays.length === 0 ? items : [...new Set([...items, ...overlays])])),
      distinctUntilChanged(sameIds),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    byMission.set(missionId, observable);
  }
  return observable;
}
