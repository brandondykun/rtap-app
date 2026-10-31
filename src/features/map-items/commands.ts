import { isKnownSidc } from '@/features/symbology/categories';
import { lineStyle, type LineType } from '@/features/symbology/line-types';
import { DEFAULT_POLYGON_FILL, MAX_RADIUS_M, polygonStyle, polygonStyleOf, type PolygonFill, type PolygonType } from '@/features/symbology/polygon-types';
import type { AppDbTx } from '@/lib/db/app-db';
import type { CommandContext } from '@/lib/db/command-context';
import { insertRows, updateRow, type SqlValue } from '@/lib/db/insert-rows';
import { newId } from '@/lib/db/new-id';
import { Tables } from '@/lib/db/schema';
import type { LatLon } from '@/lib/geo/types';
import { err, ok, type Result } from '@/lib/result';

import { isValidLatLon, lineGeometry, pointGeometry, polygonGeometry } from './geometry';
import { circleRing } from './polygon-measure';
import { findItem, findItemViewState, type MapItemKind } from './repository';
import { isValidRange, normalizeRanges, rangeFieldsForSidc, ringRadiusM, type RangeField, type UnitRanges } from './unit-ranges';

const RANGE_FIELDS: readonly RangeField[] = ['threatRangeM', 'horizontalRangeM', 'verticalRangeFt'];
const allValid = (r: UnitRanges) => RANGE_FIELDS.every((f) => isValidRange(f, r[f]));

type NewItem = { missionId: string; kind: MapItemKind; geometry: string; sidc: string | null; name: string; notes: string | null; style: string | null } & Partial<UnitRanges> & { elevationM?: number | null };

/** Inserts one item with every column set; returns its id. */
async function insertItem(ctx: CommandContext, item: NewItem): Promise<string> {
  const id = newId();
  const actor = ctx.actorId();
  const now = ctx.now();
  await insertRows(ctx.db, Tables.mapItems, [
    {
      id,
      mission_id: item.missionId,
      kind: item.kind,
      geometry: item.geometry,
      sidc: item.sidc,
      name: item.name,
      notes: item.notes,
      style: item.style,
      elevation_m: item.elevationM ?? null,
      threat_range_m: item.threatRangeM ?? null,
      horizontal_range_m: item.horizontalRangeM ?? null,
      vertical_range_ft: item.verticalRangeFt ?? null,
      created_by: actor,
      updated_by: actor,
      created_at: now,
      updated_at: now,
    },
  ]);
  return id;
}

/** Sets the given columns plus the edit stamp (updated_by / updated_at). */
function updateItemRow(ctx: CommandContext, db: AppDbTx, id: string, fields: Record<string, SqlValue>): Promise<void> {
  return updateRow(db, Tables.mapItems, id, { ...fields, updated_by: ctx.actorId(), updated_at: ctx.now() });
}

const bit = (b: boolean) => (b ? 1 : 0);

export type PlacePointInput = {
  missionId: string;
  coord: LatLon;
  sidc: string;
  name: string;
  notes?: string | null;
  /** Ground elevation in meters; omitted or null when unknown. */
  elevationM?: number | null;
  /** Ranges that do not apply to the symbol's unit type are dropped. */
  ranges?: Partial<UnitRanges>;
};

export async function placePoint(
  ctx: CommandContext,
  input: PlacePointInput,
): Promise<Result<{ id: string }, 'invalid_coordinate' | 'invalid_name' | 'invalid_symbol' | 'invalid_range' | 'write_failed'>> {
  if (!isValidLatLon(input.coord)) return err('invalid_coordinate', 'Coordinate is out of range');
  if (!isKnownSidc(input.sidc)) return err('invalid_symbol', `Unknown symbol ${input.sidc}`);
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Name is required');
  const ranges = normalizeRanges(rangeFieldsForSidc(input.sidc), input.ranges ?? {});
  if (!allValid(ranges)) return err('invalid_range', 'Range is out of bounds');
  try {
    const id = await insertItem(ctx, {
      missionId: input.missionId,
      kind: 'point',
      geometry: pointGeometry(input.coord),
      sidc: input.sidc,
      name,
      notes: input.notes ?? null,
      style: null,
      elevationM: input.elevationM ?? null,
      ...ranges,
    });
    return ok({ id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/**
 * `elevationM` replaces the stored elevation (null: unknown); left out, the stored one stays.
 * `ranges` merges field by field over the stored ranges (null clears one), then drops those the final symbol does not use.
 */
export type UpdateItemPatch = {
  name?: string;
  notes?: string | null;
  sidc?: string;
  coord?: LatLon;
  elevationM?: number | null;
  ranges?: Partial<UnitRanges>;
};

export async function updateItem(
  ctx: CommandContext,
  id: string,
  patch: UpdateItemPatch,
): Promise<Result<void, 'not_found' | 'invalid_coordinate' | 'invalid_name' | 'invalid_symbol' | 'invalid_range' | 'write_failed'>> {
  if (patch.coord && !isValidLatLon(patch.coord)) return err('invalid_coordinate', 'Coordinate is out of range');
  if (patch.sidc !== undefined && !isKnownSidc(patch.sidc)) return err('invalid_symbol', `Unknown symbol ${patch.sidc}`);
  if (patch.name !== undefined && !patch.name.trim()) return err('invalid_name', 'Name is required');
  try {
    const item = await findItem(ctx.db, id);
    if (!item) return err('not_found', `No item ${id}`);
    const sidc = patch.sidc ?? item.sidc;
    const stored: UnitRanges = { threatRangeM: item.threatRangeM ?? null, horizontalRangeM: item.horizontalRangeM ?? null, verticalRangeFt: item.verticalRangeFt ?? null };
    const merged = { ...stored };
    for (const f of RANGE_FIELDS) {
      const v = patch.ranges?.[f];
      if (v !== undefined) merged[f] = v;
    }
    const ranges = normalizeRanges(rangeFieldsForSidc(sidc), merged);
    if (!allValid(ranges)) return err('invalid_range', 'Range is out of bounds');
    await ctx.db.writeTransaction(async (tx) => {
      const fields: Record<string, SqlValue> = {
        threat_range_m: ranges.threatRangeM,
        horizontal_range_m: ranges.horizontalRangeM,
        vertical_range_ft: ranges.verticalRangeFt,
      };
      if (patch.name !== undefined) fields.name = patch.name.trim();
      if (patch.notes !== undefined) fields.notes = patch.notes;
      if (patch.sidc !== undefined) fields.sidc = patch.sidc;
      if (patch.coord) fields.geometry = pointGeometry(patch.coord);
      if (patch.elevationM !== undefined) fields.elevation_m = patch.elevationM;
      await updateItemRow(ctx, tx, id, fields);
      // A ring with no distance cannot be drawn, so it goes back to off.
      if (ringRadiusM({ sidc, ...ranges }) === null) {
        const view = await findItemViewState(tx, id);
        if (view?.showRing === true) {
          await updateRow(tx, Tables.itemViewState, view.id, { show_ring: 0, updated_at: ctx.now() });
        }
      }
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function deleteItem(ctx: CommandContext, id: string): Promise<Result<void, 'not_found' | 'write_failed'>> {
  try {
    const item = await findItem(ctx.db, id);
    if (!item) return err('not_found', `No item ${id}`);
    await ctx.db.writeTransaction(async (tx) => {
      await tx.execute('DELETE FROM map_items WHERE id = ?', [id]);
      await tx.execute('DELETE FROM item_view_state WHERE map_item_id = ?', [id]);
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
    const hidden = await ctx.db.writeTransaction(async (tx) => {
      const existing = await findItemViewState(tx, id);
      if (existing) {
        const next = !existing.hidden;
        await updateRow(tx, Tables.itemViewState, existing.id, { hidden: bit(next), updated_at: ctx.now() });
        return next;
      }
      await insertViewStates(ctx, tx, [id], { hidden: true, showRing: null });
      return true;
    });
    return ok({ hidden });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

function insertViewStates(ctx: CommandContext, db: AppDbTx, ids: readonly string[], { hidden, showRing }: { hidden: boolean; showRing: boolean | null }): Promise<void> {
  const now = ctx.now();
  return insertRows(
    db,
    Tables.itemViewState,
    ids.map((id) => ({ id: newId(), map_item_id: id, hidden: bit(hidden), show_ring: showRing === null ? null : bit(showRing), updated_at: now })),
  );
}

/**
 * Sets `hidden` or `show_ring` on the items' view state, touching only rows that differ. Items with no view state
 * get a row only when the flag is turned on (no row means visible, ring off).
 */
async function setViewStateFlag(ctx: CommandContext, tx: AppDbTx, ids: readonly string[], column: 'hidden' | 'show_ring', on: boolean): Promise<void> {
  const unique = [...new Set(ids)];
  // One JSON parameter instead of one per id, so thousands of ids stay a single bound value.
  const idList = JSON.stringify(unique);
  const inList = 'map_item_id IN (SELECT value FROM json_each(?))';
  const existing = await tx.getAll<{ map_item_id: string }>(`SELECT map_item_id FROM item_view_state WHERE ${inList}`, [idList]);
  await tx.execute(`UPDATE item_view_state SET ${column} = ?, updated_at = ? WHERE ${inList} AND ${column} IS NOT ?`, [bit(on), ctx.now(), idList, bit(on)]);
  if (!on) return;
  const have = new Set(existing.map((r) => r.map_item_id));
  const missing = unique.filter((id) => !have.has(id));
  await insertViewStates(ctx, tx, missing, column === 'hidden' ? { hidden: true, showRing: null } : { hidden: false, showRing: true });
}

/** Sets visibility for several items in one write (e.g. Layers → Show all); idempotent. */
export async function setItemsHidden(ctx: CommandContext, ids: readonly string[], hidden: boolean): Promise<Result<void, 'write_failed'>> {
  if (ids.length === 0) return ok(undefined);
  try {
    await ctx.db.writeTransaction((tx) => setViewStateFlag(ctx, tx, ids, 'hidden', hidden));
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

/** Sets per-device visibility (local-only view state). Showing an item with no view state is a no-op. */
export async function setItemHidden(ctx: CommandContext, id: string, hidden: boolean): Promise<Result<void, 'write_failed'>> {
  return setItemsHidden(ctx, [id], hidden);
}

/** Sets whether this device shows items' range rings, in one write; idempotent. Turning a ring off with no view state is a no-op. */
export async function setItemsShowRing(ctx: CommandContext, ids: readonly string[], show: boolean): Promise<Result<void, 'write_failed'>> {
  if (ids.length === 0) return ok(undefined);
  try {
    await ctx.db.writeTransaction((tx) => setViewStateFlag(ctx, tx, ids, 'show_ring', show));
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function setItemShowRing(ctx: CommandContext, id: string, show: boolean): Promise<Result<void, 'write_failed'>> {
  return setItemsShowRing(ctx, [id], show);
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
    const id = await insertItem(ctx, {
      missionId: input.missionId,
      kind: 'line',
      geometry: lineGeometry(input.points),
      sidc: null,
      name,
      notes: input.notes ?? null,
      style: lineStyle(input.lineType),
    });
    return ok({ id });
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
  try {
    const item = await findItem(ctx.db, id);
    if (!item || item.kind !== 'line') return err('not_found', `No line ${id}`);
    const fields: Record<string, SqlValue> = {};
    if (patch.points) fields.geometry = lineGeometry(patch.points);
    if (patch.lineType) fields.style = lineStyle(patch.lineType, item.style);
    if (patch.name !== undefined) fields.name = patch.name.trim();
    if (patch.notes !== undefined) fields.notes = patch.notes;
    await updateItemRow(ctx, ctx.db, id, fields);
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export type PolygonShapeInput = { kind: 'points'; points: LatLon[] } | { kind: 'circle'; center: LatLon; radiusM: number };
type PolygonShapeError = 'invalid_coordinate' | 'too_few_points' | 'invalid_radius';

/** The stored geometry and style shape for a shape input, or why it is invalid. */
function polygonParts(shape: PolygonShapeInput): { geometry: string; shape: { kind: 'points' } | { kind: 'circle'; center: LatLon; radiusM: number } } | PolygonShapeError {
  if (shape.kind === 'points') {
    if (shape.points.length < 3) return 'too_few_points';
    if (!shape.points.every(isValidLatLon)) return 'invalid_coordinate';
    return { geometry: polygonGeometry(shape.points), shape: { kind: 'points' } };
  }
  if (!isValidLatLon(shape.center)) return 'invalid_coordinate';
  if (!Number.isFinite(shape.radiusM) || shape.radiusM <= 0 || shape.radiusM > MAX_RADIUS_M) return 'invalid_radius';
  return { geometry: polygonGeometry(circleRing(shape.center, shape.radiusM)), shape: { kind: 'circle', center: shape.center, radiusM: shape.radiusM } };
}

const SHAPE_MESSAGES: Record<PolygonShapeError, string> = {
  invalid_coordinate: 'Coordinate is out of range',
  too_few_points: 'A polygon needs at least 3 points',
  invalid_radius: 'Radius must be more than 0 and at most 500 km',
};

export type PlacePolygonInput = { missionId: string; polygonType: PolygonType; fill?: PolygonFill; name: string; notes?: string | null; shape: PolygonShapeInput };

export async function placePolygon(
  ctx: CommandContext,
  input: PlacePolygonInput,
): Promise<Result<{ id: string }, PolygonShapeError | 'invalid_name' | 'write_failed'>> {
  const parts = polygonParts(input.shape);
  if (typeof parts === 'string') return err(parts, SHAPE_MESSAGES[parts]);
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Name is required');
  try {
    const id = await insertItem(ctx, {
      missionId: input.missionId,
      kind: 'polygon',
      geometry: parts.geometry,
      sidc: null,
      name,
      notes: input.notes ?? null,
      style: polygonStyle(input.polygonType, parts.shape, input.fill ?? DEFAULT_POLYGON_FILL),
    });
    return ok({ id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export type UpdatePolygonPatch = { polygonType?: PolygonType; fill?: PolygonFill; name?: string; notes?: string | null; shape?: PolygonShapeInput };

export async function updatePolygon(
  ctx: CommandContext,
  id: string,
  patch: UpdatePolygonPatch,
): Promise<Result<void, 'not_found' | PolygonShapeError | 'invalid_name' | 'write_failed'>> {
  const parts = patch.shape ? polygonParts(patch.shape) : null;
  if (typeof parts === 'string') return err(parts, SHAPE_MESSAGES[parts]);
  if (patch.name !== undefined && !patch.name.trim()) return err('invalid_name', 'Name is required');
  try {
    const item = await findItem(ctx.db, id);
    if (!item || item.kind !== 'polygon') return err('not_found', `No polygon ${id}`);
    const current = polygonStyleOf(item.style ?? null);
    const fields: Record<string, SqlValue> = {
      style: polygonStyle(patch.polygonType ?? current.polygonType, parts ? parts.shape : current.shape, patch.fill ?? current.fill, item.style),
    };
    if (parts) fields.geometry = parts.geometry;
    if (patch.name !== undefined) fields.name = patch.name.trim();
    if (patch.notes !== undefined) fields.notes = patch.notes;
    await updateItemRow(ctx, ctx.db, id, fields);
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
