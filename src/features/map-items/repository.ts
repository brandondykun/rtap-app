import { Q, type Database } from '@nozbe/watermelondb';
import { map, type Observable } from 'rxjs';

import type { ItemViewState } from '@/lib/db/models/ItemViewState';
import type { MapItem } from '@/lib/db/models/MapItem';
import { Tables } from '@/lib/db/schema';

import { nextNameForPrefix } from './naming';

export type MapItemSnapshot = {
  id: string;
  kind: 'point';
  geometry: string;
  sidc: string | null;
  name: string;
  notes: string | null;
  updatedAt: number;
};

function snapshot(item: MapItem): MapItemSnapshot {
  return {
    id: item.id,
    kind: item.kind,
    geometry: item.geometry,
    sidc: item.sidc,
    name: item.name,
    notes: item.notes ?? null,
    updatedAt: item.updatedAt.getTime(),
  };
}

function missionQuery(db: Database, missionId: string) {
  return db.get<MapItem>(Tables.mapItems).query(Q.where('mission_id', missionId));
}

export function observeMissionItems(db: Database, missionId: string): Observable<MapItemSnapshot[]> {
  return missionQuery(db, missionId)
    .observeWithColumns(['geometry', 'sidc', 'name', 'notes', 'updated_at'])
    .pipe(map((items) => items.map(snapshot)));
}

/** One item as a snapshot; null when it does not exist or was deleted. */
export function observeItem(db: Database, id: string): Observable<MapItemSnapshot | null> {
  return db
    .get<MapItem>(Tables.mapItems)
    .query(Q.where('id', id))
    .observeWithColumns(['geometry', 'sidc', 'name', 'notes', 'updated_at'])
    .pipe(map((items) => (items[0] ? snapshot(items[0]) : null)));
}

export function observeHiddenItemIds(db: Database): Observable<string[]> {
  return db
    .get<ItemViewState>(Tables.itemViewState)
    .query(Q.where('hidden', true))
    .observeWithColumns(['hidden'])
    .pipe(map((rows) => rows.map((r) => r.mapItemId)));
}

export async function getMissionItemNames(db: Database, missionId: string): Promise<string[]> {
  return (await missionQuery(db, missionId).fetch()).map((i) => i.name);
}

/** Returns null for unknown ids and for soft-deleted (markAsDeleted) items. */
export async function findItem(db: Database, id: string): Promise<MapItem | null> {
  let item: MapItem;
  try {
    item = await db.get<MapItem>(Tables.mapItems).find(id);
  } catch {
    return null;
  }
  if (item._raw._status === 'deleted') return null;
  return item;
}

export async function findItemViewState(db: Database, mapItemId: string): Promise<ItemViewState | null> {
  const rows = await db.get<ItemViewState>(Tables.itemViewState).query(Q.where('map_item_id', mapItemId)).fetch();
  return rows[0] ?? null;
}

export async function suggestName(db: Database, missionId: string, prefix: string): Promise<string> {
  return nextNameForPrefix(prefix, await getMissionItemNames(db, missionId));
}
