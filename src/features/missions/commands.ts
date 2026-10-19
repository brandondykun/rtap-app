import { Q } from '@nozbe/watermelondb';

import type { CommandContext } from '@/lib/db/command-context';
import type { ItemViewState } from '@/lib/db/models/ItemViewState';
import type { MapItem } from '@/lib/db/models/MapItem';
import type { Mission } from '@/lib/db/models/Mission';
import type { MissionViewState } from '@/lib/db/models/MissionViewState';
import { Tables } from '@/lib/db/schema';
import { err, ok, type Result } from '@/lib/result';

import { findMission, findMissionViewState, isValidCamera, type MissionCamera, type MissionSnapshot } from './repository';
import { deleteMissionSnapshot } from './snapshot-files';

export async function createMission(
  ctx: CommandContext,
  input: { name: string },
): Promise<Result<{ id: string }, 'invalid_name' | 'write_failed'>> {
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Mission name is required');
  try {
    const mission = await ctx.db.write(() =>
      ctx.db.get<Mission>(Tables.missions).create((m) => {
        m.name = name;
        m.createdBy = ctx.actorId();
      }),
    );
    return ok({ id: mission.id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function renameMission(
  ctx: CommandContext,
  missionId: string,
  input: { name: string },
): Promise<Result<void, 'invalid_name' | 'not_found' | 'write_failed'>> {
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Mission name is required');
  const mission = await findMission(ctx.db, missionId);
  if (!mission) return err('not_found', `No mission ${missionId}`);
  if (mission.name === name) return ok(undefined);
  try {
    await ctx.db.write(() =>
      mission.update((m) => {
        m.name = name;
      }),
    );
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

async function upsertViewState(
  ctx: CommandContext,
  missionId: string,
  apply: (state: MissionViewState) => void,
  { requireMission = false }: { requireMission?: boolean } = {},
): Promise<boolean> {
  return ctx.db.write(async () => {
    // Checked inside the write so a delete cannot land between the check and the upsert.
    if (requireMission && !(await findMission(ctx.db, missionId))) return false;
    const existing = await findMissionViewState(ctx.db, missionId);
    if (existing) {
      await existing.update(apply);
    } else {
      await ctx.db.get<MissionViewState>(Tables.missionViewState).create((s) => {
        s.missionId = missionId;
        s.lastOpenedAt = ctx.now();
        s.camera = null;
        s.snapshot = null;
        apply(s);
      });
    }
    return true;
  });
}

export async function markMissionOpened(ctx: CommandContext, missionId: string): Promise<Result<void, 'write_failed'>> {
  try {
    await upsertViewState(ctx, missionId, (s) => {
      s.lastOpenedAt = ctx.now();
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function saveMissionCamera(
  ctx: CommandContext,
  missionId: string,
  camera: MissionCamera,
): Promise<Result<void, 'invalid_camera' | 'write_failed'>> {
  if (!isValidCamera(camera)) return err('invalid_camera', 'Camera values must be finite numbers');
  try {
    await upsertViewState(ctx, missionId, (s) => {
      s.camera = JSON.stringify(camera);
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Records the mission's picture; a mission deleted meanwhile gets no view state back. */
export async function recordMissionSnapshot(
  ctx: CommandContext,
  missionId: string,
  snapshot: MissionSnapshot,
): Promise<Result<void, 'not_found' | 'write_failed'>> {
  try {
    const recorded = await upsertViewState(
      ctx,
      missionId,
      (s) => {
        s.snapshot = JSON.stringify(snapshot);
      },
      { requireMission: true },
    );
    return recorded ? ok(undefined) : err('not_found', `No mission ${missionId}`);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/**
 * Deletes a mission and every item in it in one write. Synced records are tombstoned (like
 * deleteItem); local-only view state (last opened, camera, item visibility) is removed outright.
 */
export async function deleteMission(ctx: CommandContext, missionId: string): Promise<Result<void, 'not_found' | 'write_failed'>> {
  const mission = await findMission(ctx.db, missionId);
  if (!mission) return err('not_found', `No mission ${missionId}`);
  try {
    await ctx.db.write(async () => {
      const items = await ctx.db.get<MapItem>(Tables.mapItems).query(Q.where('mission_id', missionId)).fetch();
      const itemViews =
        items.length === 0
          ? []
          : await ctx.db
              .get<ItemViewState>(Tables.itemViewState)
              .query(Q.where('map_item_id', Q.oneOf(items.map((i) => i.id))))
              .fetch();
      const missionViews = await ctx.db.get<MissionViewState>(Tables.missionViewState).query(Q.where('mission_id', missionId)).fetch();
      await ctx.db.batch([
        ...items.map((i) => i.prepareMarkAsDeleted()),
        ...itemViews.map((v) => v.prepareDestroyPermanently()),
        ...missionViews.map((v) => v.prepareDestroyPermanently()),
        mission.prepareMarkAsDeleted(),
      ]);
    });
    deleteMissionSnapshot(missionId);
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
