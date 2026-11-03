import type { CommandContext } from '@/lib/db/command-context';
import { insertRows, updateRow, type SqlValue } from '@/lib/db/insert-rows';
import { newId } from '@/lib/db/new-id';
import { Tables } from '@/lib/db/schema';
import { err, ok, type Result } from '@/lib/result';

import { findMission, findMissionViewState, isValidCamera, type MissionCamera, type MissionSnapshot } from './repository';
import { deleteMissionSnapshots } from './snapshot-files';

export async function createMission(
  ctx: CommandContext,
  input: { name: string },
): Promise<Result<{ id: string }, 'invalid_name' | 'write_failed'>> {
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Mission name is required');
  try {
    const id = newId();
    const now = ctx.now();
    await insertRows(ctx.db, Tables.missions, [{ id, name, created_by: ctx.actorId(), created_at: now, updated_at: now }]);
    return ok({ id });
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
  try {
    const mission = await findMission(ctx.db, missionId);
    if (!mission) return err('not_found', `No mission ${missionId}`);
    if (mission.name === name) return ok(undefined);
    await updateRow(ctx.db, Tables.missions, missionId, { name, updated_at: ctx.now() });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** The view-state columns a command sets; the rest keep their values (or start at their defaults). */
type ViewStateFields = { last_opened_at?: number; camera?: string; snapshot?: string; base_hidden?: number };

async function upsertViewState(
  ctx: CommandContext,
  missionId: string,
  fields: ViewStateFields,
  { requireMission = false }: { requireMission?: boolean } = {},
): Promise<boolean> {
  return ctx.db.writeTransaction(async (tx) => {
    // Checked inside the write so a delete cannot land between the check and the upsert.
    if (requireMission && !(await findMission(tx, missionId))) return false;
    const existing = await findMissionViewState(tx, missionId);
    const now = ctx.now();
    if (existing) {
      await updateRow(tx, Tables.missionViewState, existing.id, { ...fields, updated_at: now });
    } else {
      const row: Record<string, SqlValue> = { id: newId(), mission_id: missionId, last_opened_at: now, camera: null, snapshot: null, updated_at: now };
      await insertRows(tx, Tables.missionViewState, [{ ...row, ...fields }]);
    }
    return true;
  });
}

/** Shows or hides the mission's base (its items in no overlay) on this device only. */
export async function setBaseHidden(ctx: CommandContext, missionId: string, hidden: boolean): Promise<Result<void, 'write_failed'>> {
  try {
    await upsertViewState(ctx, missionId, { base_hidden: hidden ? 1 : 0 });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function markMissionOpened(ctx: CommandContext, missionId: string): Promise<Result<void, 'write_failed'>> {
  try {
    await upsertViewState(ctx, missionId, { last_opened_at: ctx.now() });
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
    await upsertViewState(ctx, missionId, { camera: JSON.stringify(camera) });
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
    const recorded = await upsertViewState(ctx, missionId, { snapshot: JSON.stringify(snapshot) }, { requireMission: true });
    return recorded ? ok(undefined) : err('not_found', `No mission ${missionId}`);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/**
 * Deletes a mission, every item in it, and their view state (last opened, camera, item visibility) in one write.
 */
export async function deleteMission(ctx: CommandContext, missionId: string): Promise<Result<void, 'not_found' | 'write_failed'>> {
  try {
    const mission = await findMission(ctx.db, missionId);
    if (!mission) return err('not_found', `No mission ${missionId}`);
    await ctx.db.writeTransaction(async (tx) => {
      await tx.execute('DELETE FROM item_view_state WHERE map_item_id IN (SELECT id FROM map_items WHERE mission_id = ?)', [missionId]);
      await tx.execute('DELETE FROM map_item_overlays WHERE mission_id = ?', [missionId]);
      await tx.execute('DELETE FROM overlay_view_state WHERE overlay_id IN (SELECT id FROM overlays WHERE mission_id = ?)', [missionId]);
      await tx.execute('DELETE FROM overlays WHERE mission_id = ?', [missionId]);
      await tx.execute('DELETE FROM map_items WHERE mission_id = ?', [missionId]);
      await tx.execute('DELETE FROM mission_view_state WHERE mission_id = ?', [missionId]);
      await tx.execute('DELETE FROM missions WHERE id = ?', [missionId]);
    });
    deleteMissionSnapshots(missionId);
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
