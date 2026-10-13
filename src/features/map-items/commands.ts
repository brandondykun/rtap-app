import { Q } from '@nozbe/watermelondb';

import { KNOWN_SIDCS } from '@/features/symbology/categories';
import { lineStyle, type LineType } from '@/features/symbology/line-types';
import type { CommandContext } from '@/lib/db/command-context';
import type { ItemViewState } from '@/lib/db/models/ItemViewState';
import type { MapItem } from '@/lib/db/models/MapItem';
import { Tables } from '@/lib/db/schema';
import type { LatLon } from '@/lib/geo/types';
import { err, ok, type Result } from '@/lib/result';

import { isValidLatLon, lineGeometry, pointGeometry } from './geometry';
import { findItem, findItemViewState } from './repository';

export type PlacePointInput = {
  missionId: string;
  coord: LatLon;
  sidc: string;
  name: string;
  notes?: string | null;
};

export async function placePoint(
  ctx: CommandContext,
  input: PlacePointInput,
): Promise<Result<{ id: string }, 'invalid_coordinate' | 'invalid_name' | 'invalid_symbol' | 'write_failed'>> {
  if (!isValidLatLon(input.coord)) return err('invalid_coordinate', 'Coordinate is out of range');
  if (!KNOWN_SIDCS.has(input.sidc)) return err('invalid_symbol', `Unknown symbol ${input.sidc}`);
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Name is required');
  try {
    const item = await ctx.db.write(() =>
      ctx.db.get<MapItem>(Tables.mapItems).create((i) => {
        i.missionId = input.missionId;
        i.kind = 'point';
        i.geometry = pointGeometry(input.coord);
        i.sidc = input.sidc;
        i.name = name;
        i.notes = input.notes ?? null;
        i.style = null;
        i.createdBy = ctx.actorId();
        i.updatedBy = ctx.actorId();
      }),
    );
    return ok({ id: item.id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export type UpdateItemPatch = { name?: string; notes?: string | null; sidc?: string; coord?: LatLon };

export async function updateItem(
  ctx: CommandContext,
  id: string,
  patch: UpdateItemPatch,
): Promise<Result<void, 'not_found' | 'invalid_coordinate' | 'invalid_name' | 'invalid_symbol' | 'write_failed'>> {
  if (patch.coord && !isValidLatLon(patch.coord)) return err('invalid_coordinate', 'Coordinate is out of range');
  if (patch.sidc !== undefined && !KNOWN_SIDCS.has(patch.sidc)) return err('invalid_symbol', `Unknown symbol ${patch.sidc}`);
  if (patch.name !== undefined && !patch.name.trim()) return err('invalid_name', 'Name is required');
  const item = await findItem(ctx.db, id);
  if (!item) return err('not_found', `No item ${id}`);
  try {
    await ctx.db.write(() =>
      item.update((i) => {
        if (patch.name !== undefined) i.name = patch.name.trim();
        if (patch.notes !== undefined) i.notes = patch.notes;
        if (patch.sidc !== undefined) i.sidc = patch.sidc;
        if (patch.coord) i.geometry = pointGeometry(patch.coord);
        i.updatedBy = ctx.actorId();
      }),
    );
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function deleteItem(ctx: CommandContext, id: string): Promise<Result<void, 'not_found' | 'write_failed'>> {
  const item = await findItem(ctx.db, id);
  if (!item) return err('not_found', `No item ${id}`);
  try {
    await ctx.db.write(async () => {
      // Tombstone for sync; local-only view state is removed outright.
      await item.markAsDeleted();
      const view = await findItemViewState(ctx.db, id);
      if (view) await view.destroyPermanently();
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function toggleItemVisibility(
  ctx: CommandContext,
  id: string,
): Promise<Result<{ hidden: boolean }, 'write_failed'>> {
  try {
    const hidden = await ctx.db.write(async () => {
      const existing = await findItemViewState(ctx.db, id);
      if (existing) {
        const next = !existing.hidden;
        await existing.update((s) => {
          s.hidden = next;
        });
        return next;
      }
      await ctx.db.get<ItemViewState>(Tables.itemViewState).create((s) => {
        s.mapItemId = id;
        s.hidden = true;
      });
      return true;
    });
    return ok({ hidden });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Sets visibility for several items in one write (e.g. Layers → Show all); idempotent. */
export async function setItemsHidden(ctx: CommandContext, ids: readonly string[], hidden: boolean): Promise<Result<void, 'write_failed'>> {
  if (ids.length === 0) return ok(undefined);
  try {
    await ctx.db.write(async () => {
      const collection = ctx.db.get<ItemViewState>(Tables.itemViewState);
      const existing = await collection.query(Q.where('map_item_id', Q.oneOf([...ids]))).fetch();
      const byItem = new Map(existing.map((v) => [v.mapItemId, v]));
      const writes: ItemViewState[] = [];
      for (const id of new Set(ids)) {
        const view = byItem.get(id);
        if (view) {
          if (view.hidden !== hidden) {
            writes.push(
              view.prepareUpdate((s) => {
                s.hidden = hidden;
              }),
            );
          }
        } else if (hidden) {
          writes.push(
            collection.prepareCreate((s) => {
              s.mapItemId = id;
              s.hidden = true;
            }),
          );
        }
      }
      if (writes.length > 0) await ctx.db.batch(writes);
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Sets per-device visibility (local-only view state). Showing an item with no view state is a no-op. */
export async function setItemHidden(ctx: CommandContext, id: string, hidden: boolean): Promise<Result<void, 'write_failed'>> {
  return setItemsHidden(ctx, [id], hidden);
}

export type PlaceLineInput = { missionId: string; points: LatLon[]; lineType: LineType; name: string; notes?: string | null };

function checkLinePoints(points: LatLon[]): 'invalid_coordinate' | 'too_few_points' | null {
  if (points.length < 2) return 'too_few_points';
  return points.every(isValidLatLon) ? null : 'invalid_coordinate';
}

export async function placeLine(
  ctx: CommandContext,
  input: PlaceLineInput,
): Promise<Result<{ id: string }, 'invalid_coordinate' | 'too_few_points' | 'invalid_name' | 'write_failed'>> {
  const bad = checkLinePoints(input.points);
  if (bad) return err(bad, bad === 'too_few_points' ? 'A line needs at least 2 points' : 'Coordinate is out of range');
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Name is required');
  try {
    const item = await ctx.db.write(() =>
      ctx.db.get<MapItem>(Tables.mapItems).create((i) => {
        i.missionId = input.missionId;
        i.kind = 'line';
        i.geometry = lineGeometry(input.points);
        i.sidc = null;
        i.name = name;
        i.notes = input.notes ?? null;
        i.style = lineStyle(input.lineType);
        i.createdBy = ctx.actorId();
        i.updatedBy = ctx.actorId();
      }),
    );
    return ok({ id: item.id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export type UpdateLinePatch = { points?: LatLon[]; lineType?: LineType; name?: string; notes?: string | null };

export async function updateLine(
  ctx: CommandContext,
  id: string,
  patch: UpdateLinePatch,
): Promise<Result<void, 'not_found' | 'invalid_coordinate' | 'too_few_points' | 'invalid_name' | 'write_failed'>> {
  if (patch.points) {
    const bad = checkLinePoints(patch.points);
    if (bad) return err(bad, bad === 'too_few_points' ? 'A line needs at least 2 points' : 'Coordinate is out of range');
  }
  if (patch.name !== undefined && !patch.name.trim()) return err('invalid_name', 'Name is required');
  const item = await findItem(ctx.db, id);
  if (!item || item.kind !== 'line') return err('not_found', `No line ${id}`);
  try {
    await ctx.db.write(() =>
      item.update((i) => {
        if (patch.points) i.geometry = lineGeometry(patch.points);
        if (patch.lineType) i.style = lineStyle(patch.lineType);
        if (patch.name !== undefined) i.name = patch.name.trim();
        if (patch.notes !== undefined) i.notes = patch.notes;
        i.updatedBy = ctx.actorId();
      }),
    );
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
