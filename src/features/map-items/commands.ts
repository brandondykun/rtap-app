import type { CommandContext } from '@/lib/db/command-context';
import type { ItemViewState } from '@/lib/db/models/ItemViewState';
import type { MapItem } from '@/lib/db/models/MapItem';
import { Tables } from '@/lib/db/schema';
import type { LatLon } from '@/lib/geo/types';
import { err, ok, type Result } from '@/lib/result';

import { isValidLatLon, pointGeometry } from './geometry';
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
): Promise<Result<{ id: string }, 'invalid_coordinate' | 'invalid_name' | 'write_failed'>> {
  if (!isValidLatLon(input.coord)) return err('invalid_coordinate', 'Coordinate is out of range');
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
): Promise<Result<void, 'not_found' | 'invalid_coordinate' | 'invalid_name' | 'write_failed'>> {
  if (patch.coord && !isValidLatLon(patch.coord)) return err('invalid_coordinate', 'Coordinate is out of range');
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
