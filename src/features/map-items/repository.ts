import { distinctUntilChanged, map, type Observable, shareReplay } from 'rxjs';

import { isKnownSidc } from '@/features/symbology/categories';
import { DEFAULT_SIDC } from '@/features/symbology/presets';
import type { AppDb, AppDbTx } from '@/lib/db/app-db';
import { Tables } from '@/lib/db/schema';

import { nextNameForPrefix } from './naming';

export type MapItemKind = 'point' | 'line' | 'polygon';
/** The kinds this version of the app can show; a newer version may sync down others, which are left alone. */
export const MAP_ITEM_KINDS: readonly MapItemKind[] = ['point', 'line', 'polygon'];

export type MapItemRecord = {
  id: string;
  missionId: string;
  kind: MapItemKind;
  /** GeoJSON geometry JSON, WGS84 [lon, lat]. */
  geometry: string;
  sidc: string | null;
  name: string;
  notes: string | null;
  /** JSON style for lines/polygons. */
  style: string | null;
  /** Ground elevation in meters above sea level where a unit was placed; null when unknown or not a unit. */
  elevationM: number | null;
  /** Artillery or mortar threat range in meters; null when not set. */
  threatRangeM: number | null;
  /** Air defense horizontal range in meters; null when not set. */
  horizontalRangeM: number | null;
  /** Air defense vertical range (ceiling) in feet; null when not set. */
  verticalRangeFt: number | null;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
};

/** Local-only: per-device visibility of a map item. No row = visible. */
export type ItemViewStateRecord = {
  id: string;
  mapItemId: string;
  hidden: boolean;
  /** Whether this device shows the item's range ring; null = not chosen. */
  showRing: boolean | null;
  updatedAt: number;
};

export type MapItemSnapshot = {
  id: string;
  kind: MapItemKind;
  geometry: string;
  sidc: string | null;
  style: string | null;
  name: string;
  notes: string | null;
  elevationM: number | null;
  threatRangeM: number | null;
  horizontalRangeM: number | null;
  verticalRangeFt: number | null;
  updatedAt: number;
};

type MapItemRow = {
  id: string;
  mission_id: string;
  kind: MapItemKind;
  geometry: string;
  sidc: string | null;
  name: string;
  notes: string | null;
  style: string | null;
  elevation_m: number | null;
  threat_range_m: number | null;
  horizontal_range_m: number | null;
  vertical_range_ft: number | null;
  created_by: string;
  updated_by: string;
  created_at: number;
  updated_at: number;
};

type ItemViewStateRow = { id: string; map_item_id: string; hidden: number | null; show_ring: number | null; updated_at: number };

function toRecord(r: MapItemRow): MapItemRecord {
  return {
    id: r.id,
    missionId: r.mission_id,
    kind: r.kind,
    geometry: r.geometry,
    sidc: r.sidc ?? null,
    name: r.name,
    notes: r.notes ?? null,
    style: r.style ?? null,
    elevationM: r.elevation_m ?? null,
    threatRangeM: r.threat_range_m ?? null,
    horizontalRangeM: r.horizontal_range_m ?? null,
    verticalRangeFt: r.vertical_range_ft ?? null,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function snapshot(r: MapItemRow): MapItemSnapshot {
  return {
    id: r.id,
    kind: r.kind,
    geometry: r.geometry,
    sidc: r.sidc ?? null,
    style: r.style ?? null,
    name: r.name,
    notes: r.notes ?? null,
    elevationM: r.elevation_m ?? null,
    threatRangeM: r.threat_range_m ?? null,
    horizontalRangeM: r.horizontal_range_m ?? null,
    verticalRangeFt: r.vertical_range_ft ?? null,
    updatedAt: r.updated_at,
  };
}

const ITEM_COLUMNS = 'id, kind, geometry, sidc, style, name, notes, elevation_m, threat_range_m, horizontal_range_m, vertical_range_ft, updated_at';
// Items of a kind this app does not know (from a newer version) are never shown, so they cannot be drawn as something else.
const KNOWN_KIND = `kind IN (${MAP_ITEM_KINDS.map(() => '?').join(', ')})`;

/** Every edit stamps updated_at, so equal ids and stamps in the same order mean nothing the UI shows changed. */
const sameItems = (a: MapItemSnapshot[], b: MapItemSnapshot[]) =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id && x.updatedAt === b[i].updatedAt);
const sameIds = (a: string[], b: string[]) => a.join('|') === b.join('|');

const shared = new WeakMap<AppDb, Map<string, Observable<unknown>>>();

/**
 * One live query per database and key, however many components subscribe (the map's layers all watch the same
 * mission). Late subscribers get the latest value at once. When the last one unsubscribes the watch stops, and the
 * next subscriber starts a fresh one.
 */
function sharedWatch<T>(db: AppDb, key: string, make: () => Observable<T>): Observable<T> {
  let byKey = shared.get(db);
  if (!byKey) shared.set(db, (byKey = new Map()));
  let observable = byKey.get(key) as Observable<T> | undefined;
  if (!observable) {
    observable = make().pipe(shareReplay({ bufferSize: 1, refCount: true }));
    byKey.set(key, observable);
  }
  return observable;
}

export function observeMissionItems(db: AppDb, missionId: string): Observable<MapItemSnapshot[]> {
  return sharedWatch(db, `items:${missionId}`, () =>
    db
      .watch<MapItemRow>(
        `SELECT ${ITEM_COLUMNS} FROM map_items WHERE mission_id = ? AND ${KNOWN_KIND} ORDER BY created_at, id`,
        [missionId, ...MAP_ITEM_KINDS],
        [Tables.mapItems],
      )
      .pipe(
        map((rows) => rows.map(snapshot)),
        distinctUntilChanged(sameItems),
      ),
  );
}

/**
 * The distinct symbols a mission's items use, sorted. Emits only when that set changes, so a rename or
 * a move (which re-emits every item) does not re-render the map.
 */
export function observeMissionSidcs(db: AppDb, missionId: string): Observable<string[]> {
  return observeMissionItems(db, missionId).pipe(
    map((items) => [...new Set(items.map((i) => (i.sidc && isKnownSidc(i.sidc) ? i.sidc : DEFAULT_SIDC)))].sort().join('|')),
    distinctUntilChanged(),
    map((key) => (key ? key.split('|') : [])),
  );
}

/** One item as a snapshot; null when it does not exist or was deleted. */
export function observeItem(db: AppDb, id: string): Observable<MapItemSnapshot | null> {
  return db
    .watch<MapItemRow>(`SELECT ${ITEM_COLUMNS} FROM map_items WHERE id = ? AND ${KNOWN_KIND}`, [id, ...MAP_ITEM_KINDS], [Tables.mapItems])
    .pipe(
      map((rows) => (rows[0] ? snapshot(rows[0]) : null)),
      distinctUntilChanged((a, b) => a?.id === b?.id && a?.updatedAt === b?.updatedAt),
    );
}

function observeViewStateIds(db: AppDb, column: 'hidden' | 'show_ring'): Observable<string[]> {
  return sharedWatch(db, `view-state:${column}`, () =>
    db
      .watch<{ map_item_id: string }>(`SELECT map_item_id FROM item_view_state WHERE ${column} = 1`, [], [Tables.itemViewState])
      .pipe(
        map((rows) => rows.map((r) => r.map_item_id)),
        distinctUntilChanged(sameIds),
      ),
  );
}

export function observeHiddenItemIds(db: AppDb): Observable<string[]> {
  return observeViewStateIds(db, 'hidden');
}

export function observeRingItemIds(db: AppDb): Observable<string[]> {
  return observeViewStateIds(db, 'show_ring');
}

export async function getMissionItemNames(db: AppDb, missionId: string): Promise<string[]> {
  return (await db.getAll<{ name: string }>('SELECT name FROM map_items WHERE mission_id = ?', [missionId])).map((r) => r.name);
}

/** Returns null for unknown or deleted ids. Takes a transaction handle too, for reads inside a write. */
export async function findItem(db: AppDbTx, id: string): Promise<MapItemRecord | null> {
  const row = await db.getOptional<MapItemRow>('SELECT * FROM map_items WHERE id = ?', [id]);
  return row ? toRecord(row) : null;
}

function toItemViewState(r: ItemViewStateRow): ItemViewStateRecord {
  const showRing = r.show_ring ?? null;
  return { id: r.id, mapItemId: r.map_item_id, hidden: r.hidden === 1, showRing: showRing === null ? null : showRing === 1, updatedAt: r.updated_at };
}

export async function findItemViewState(db: AppDbTx, mapItemId: string): Promise<ItemViewStateRecord | null> {
  const row = await db.getOptional<ItemViewStateRow>('SELECT * FROM item_view_state WHERE map_item_id = ? LIMIT 1', [mapItemId]);
  return row ? toItemViewState(row) : null;
}

export async function suggestName(db: AppDb, missionId: string, prefix: string): Promise<string> {
  return nextNameForPrefix(prefix, await getMissionItemNames(db, missionId));
}
