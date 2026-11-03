import { writeViewState } from '@/features/missions/commands';
import type { AppDbTx } from '@/lib/db/app-db';
import type { CommandContext } from '@/lib/db/command-context';
import { insertRows, updateRow } from '@/lib/db/insert-rows';
import { newId } from '@/lib/db/new-id';
import { Tables } from '@/lib/db/schema';
import { err, ok, type Result } from '@/lib/result';

/** Long enough for "Phase 2 — Defense", short enough for a chip. */
export const MAX_OVERLAY_NAME = 32;

function cleanName(name: string): string | null {
  const n = name.trim();
  return n.length > 0 && n.length <= MAX_OVERLAY_NAME ? n : null;
}

/** Same name, ignoring case: "phase 1" is "Phase 1". */
const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/**
 * Whether another of the mission's overlays (not `exceptId`) already has the name, or it is Base's. Checked inside the
 * write, so two adds of one name cannot both pass.
 */
async function nameTaken(tx: AppDbTx, missionId: string, name: string, exceptId: string | null): Promise<boolean> {
  if (sameName(name, 'Base')) return true;
  const rows = await tx.getAll<{ id: string; name: string }>('SELECT id, name FROM overlays WHERE mission_id = ?', [missionId]);
  return rows.some((r) => r.id !== exceptId && sameName(r.name, name));
}

class NameTaken extends Error {}

/** A new overlay, shown. Its name must be one no other overlay of the mission has (ignoring case), nor Base. */
export async function createOverlay(
  ctx: CommandContext,
  input: { missionId: string; name: string },
): Promise<Result<{ id: string }, 'invalid_name' | 'name_taken' | 'write_failed'>> {
  const name = cleanName(input.name);
  if (!name) return err('invalid_name', `An overlay name is 1 to ${MAX_OVERLAY_NAME} characters`);
  try {
    const id = newId();
    const now = ctx.now();
    await ctx.db.writeTransaction(async (tx) => {
      if (await nameTaken(tx, input.missionId, name, null)) throw new NameTaken();
      const last = await tx.getOptional<{ n: number | null }>('SELECT MAX(sort_order) AS n FROM overlays WHERE mission_id = ?', [input.missionId]);
      await insertRows(tx, Tables.overlays, [
        { id, mission_id: input.missionId, name, sort_order: (last?.n ?? -1) + 1, created_by: ctx.actorId(), created_at: now, updated_at: now },
      ]);
    });
    return ok({ id });
  } catch (e) {
    if (e instanceof NameTaken) return err('name_taken', `There is already an overlay named ${name}`);
    return err('write_failed', String(e));
  }
}

/** Renames an overlay; like a new one, not to a name another overlay of the mission has (a change of case is fine). */
export async function renameOverlay(ctx: CommandContext, id: string, input: string): Promise<Result<void, 'invalid_name' | 'name_taken' | 'write_failed'>> {
  const name = cleanName(input);
  if (!name) return err('invalid_name', `An overlay name is 1 to ${MAX_OVERLAY_NAME} characters`);
  try {
    await ctx.db.writeTransaction(async (tx) => {
      const overlay = await tx.getOptional<{ mission_id: string }>('SELECT mission_id FROM overlays WHERE id = ?', [id]);
      if (overlay && (await nameTaken(tx, overlay.mission_id, name, id))) throw new NameTaken();
      await updateRow(tx, Tables.overlays, id, { name, updated_at: ctx.now() });
    });
    return ok(undefined);
  } catch (e) {
    if (e instanceof NameTaken) return err('name_taken', `There is already an overlay named ${name}`);
    return err('write_failed', String(e));
  }
}

/** Deletes the overlay. Its items stay; those in no other overlay go back to the base. */
export async function deleteOverlay(ctx: CommandContext, id: string): Promise<Result<void, 'write_failed'>> {
  try {
    await ctx.db.writeTransaction(async (tx) => {
      await tx.execute('DELETE FROM map_item_overlays WHERE overlay_id = ?', [id]);
      await tx.execute('DELETE FROM overlay_view_state WHERE overlay_id = ?', [id]);
      await tx.execute('DELETE FROM overlays WHERE id = ?', [id]);
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Puts an item in an overlay, or takes it out. Already so: nothing changes. */
export async function setItemInOverlay(
  ctx: CommandContext,
  input: { missionId: string; itemId: string; overlayId: string; inOverlay: boolean },
): Promise<Result<void, 'write_failed'>> {
  try {
    await ctx.db.writeTransaction(async (tx) => {
      const link = await tx.getOptional<{ id: string }>('SELECT id FROM map_item_overlays WHERE map_item_id = ? AND overlay_id = ?', [input.itemId, input.overlayId]);
      if (input.inOverlay && !link) {
        await insertRows(tx, Tables.mapItemOverlays, [{ id: newId(), mission_id: input.missionId, map_item_id: input.itemId, overlay_id: input.overlayId, created_at: ctx.now() }]);
      } else if (!input.inOverlay && link) {
        await tx.execute('DELETE FROM map_item_overlays WHERE id = ?', [link.id]);
      }
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Puts a new item in overlays, all at once (none: it stays in the base). */
export async function addItemToOverlays(
  ctx: CommandContext,
  input: { missionId: string; itemId: string; overlayIds: readonly string[] },
): Promise<Result<void, 'write_failed'>> {
  if (input.overlayIds.length === 0) return ok(undefined);
  try {
    const now = ctx.now();
    await ctx.db.writeTransaction(async (tx) => {
      await insertRows(
        tx,
        Tables.mapItemOverlays,
        input.overlayIds.map((overlayId) => ({ id: newId(), mission_id: input.missionId, map_item_id: input.itemId, overlay_id: overlayId, created_at: now })),
      );
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Takes an item out of every overlay: back in the base. */
export async function moveItemToBase(ctx: CommandContext, itemId: string): Promise<Result<void, 'write_failed'>> {
  try {
    await ctx.db.execute('DELETE FROM map_item_overlays WHERE map_item_id = ?', [itemId]);
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Shows or hides an overlay on this device only. */
export async function setOverlayHidden(ctx: CommandContext, overlayId: string, hidden: boolean): Promise<Result<void, 'write_failed'>> {
  try {
    await ctx.db.writeTransaction(async (tx) => {
      const view = await tx.getOptional<{ id: string }>('SELECT id FROM overlay_view_state WHERE overlay_id = ?', [overlayId]);
      if (view) await updateRow(tx, Tables.overlayViewState, view.id, { hidden: hidden ? 1 : 0, updated_at: ctx.now() });
      else await insertRows(tx, Tables.overlayViewState, [{ id: newId(), overlay_id: overlayId, hidden: hidden ? 1 : 0, updated_at: ctx.now() }]);
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Shows or hides every overlay of the mission, Base too, on this device only: in one write, so the map redraws once. */
export async function setAllOverlaysHidden(ctx: CommandContext, missionId: string, hidden: boolean): Promise<Result<void, 'write_failed'>> {
  try {
    const value = hidden ? 1 : 0;
    await ctx.db.writeTransaction(async (tx) => {
      const now = ctx.now();
      await writeViewState(tx, now, missionId, { base_hidden: value });
      const overlays = await tx.getAll<{ id: string; view_id: string | null }>(
        'SELECT o.id, v.id AS view_id FROM overlays o LEFT JOIN overlay_view_state v ON v.overlay_id = o.id WHERE o.mission_id = ?',
        [missionId],
      );
      for (const o of overlays) {
        if (o.view_id) await updateRow(tx, Tables.overlayViewState, o.view_id, { hidden: value, updated_at: now });
      }
      const fresh = overlays.filter((o) => !o.view_id);
      if (fresh.length) await insertRows(tx, Tables.overlayViewState, fresh.map((o) => ({ id: newId(), overlay_id: o.id, hidden: value, updated_at: now })));
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
