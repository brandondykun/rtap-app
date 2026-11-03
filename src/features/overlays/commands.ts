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

/** A new overlay at the end of the mission's list, shown. */
export async function createOverlay(ctx: CommandContext, input: { missionId: string; name: string }): Promise<Result<{ id: string }, 'invalid_name' | 'write_failed'>> {
  const name = cleanName(input.name);
  if (!name) return err('invalid_name', `An overlay name is 1 to ${MAX_OVERLAY_NAME} characters`);
  try {
    const id = newId();
    const now = ctx.now();
    await ctx.db.writeTransaction(async (tx) => {
      const last = await tx.getOptional<{ n: number | null }>('SELECT MAX(sort_order) AS n FROM overlays WHERE mission_id = ?', [input.missionId]);
      await insertRows(tx, Tables.overlays, [
        { id, mission_id: input.missionId, name, sort_order: (last?.n ?? -1) + 1, created_by: ctx.actorId(), created_at: now, updated_at: now },
      ]);
    });
    return ok({ id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function renameOverlay(ctx: CommandContext, id: string, input: string): Promise<Result<void, 'invalid_name' | 'write_failed'>> {
  const name = cleanName(input);
  if (!name) return err('invalid_name', `An overlay name is 1 to ${MAX_OVERLAY_NAME} characters`);
  try {
    await updateRow(ctx.db, Tables.overlays, id, { name, updated_at: ctx.now() });
    return ok(undefined);
  } catch (e) {
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
