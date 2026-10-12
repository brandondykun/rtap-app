import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';

import { deleteItem, placePoint, toggleItemVisibility, updateItem } from './commands';
import { pointCoord } from './geometry';
import { findItem, getMissionItemNames, observeHiddenItemIds, observeMissionItems, suggestPointName } from './repository';

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

describe('map items', () => {
  it('places a point stamped with the actor', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1', notes: 'dug in' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const item = await findItem(ctx.db, r.value.id);
    expect(item).not.toBeNull();
    expect(item?.kind).toBe('point');
    expect(item?.missionId).toBe('m1');
    expect(item?.createdBy).toBe('device-test');
    expect(item?.updatedBy).toBe('device-test');
    expect(item?.notes).toBe('dug in');
    expect(pointCoord(item!.geometry)).toEqual(at);
  });

  it.each([
    [{ lat: 91, lon: 0 }],
    [{ lat: Number.NaN, lon: 0 }],
  ])('rejects invalid coordinate %p', async (coord) => {
    const ctx = makeTestContext();
    expect(await placePoint(ctx, { missionId: 'm1', coord, sidc: HOSTILE_INF, name: 'x' })).toMatchObject({
      ok: false,
      error: 'invalid_coordinate',
    });
  });

  it('rejects a blank name', async () => {
    const ctx = makeTestContext();
    expect(await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: '  ' })).toMatchObject({
      ok: false,
      error: 'invalid_name',
    });
  });

  it('observes only the mission’s items', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    await placePoint(ctx, { missionId: 'm2', coord: at, sidc: HOSTILE_INF, name: 'B' });
    const items = await firstValueFrom(observeMissionItems(ctx.db, 'm1'));
    expect(items.map((i) => i.name)).toEqual(['A']);
    expect(items[0]).toMatchObject({ kind: 'point', sidc: HOSTILE_INF, notes: null });
    expect(typeof items[0].updatedAt).toBe('number');
  });

  it('updates fields and the editor stamp', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    const moved = { lat: 39, lon: -77 };
    expect(await updateItem(ctx, r.value.id, { name: 'OBJ IRON', coord: moved, notes: null })).toEqual({
      ok: true,
      value: undefined,
    });
    const item = await findItem(ctx.db, r.value.id);
    expect(item?.name).toBe('OBJ IRON');
    expect(pointCoord(item!.geometry)).toEqual(moved);
  });

  it('reports not_found for unknown ids', async () => {
    const ctx = makeTestContext();
    expect(await updateItem(ctx, 'nope', { name: 'x' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await deleteItem(ctx, 'nope')).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('deletes with a sync tombstone and drops it from queries', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    expect(await deleteItem(ctx, r.value.id)).toEqual({ ok: true, value: undefined });
    expect(await firstValueFrom(observeMissionItems(ctx.db, 'm1'))).toEqual([]);
    expect(await getMissionItemNames(ctx.db, 'm1')).toEqual([]);
  });

  it('toggles visibility as local view state', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    expect(await toggleItemVisibility(ctx, r.value.id)).toEqual({ ok: true, value: { hidden: true } });
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([r.value.id]);
    expect(await toggleItemVisibility(ctx, r.value.id)).toEqual({ ok: true, value: { hidden: false } });
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]);
  });

  it('suggests names from existing, non-deleted points', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-4' });
    const five = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-5' });
    if (!five.ok) throw new Error('setup failed');
    await deleteItem(ctx, five.value.id);
    await placePoint(ctx, { missionId: 'm2', coord: at, sidc: HOSTILE_INF, name: 'HOS-9' });
    expect(await suggestPointName(ctx.db, 'm1', 'hostile')).toBe('HOS-5');
  });

  it('treats deleted items as not found', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    await deleteItem(ctx, r.value.id);
    expect(await findItem(ctx.db, r.value.id)).toBeNull();
    expect(await updateItem(ctx, r.value.id, { name: 'B' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await deleteItem(ctx, r.value.id)).toMatchObject({ ok: false, error: 'not_found' });
  });
});
