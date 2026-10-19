import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';

import {
  deleteItem,
  placeLine,
  placePoint,
  placePolygon,
  setItemHidden,
  setItemsHidden,
  toggleItemVisibility,
  updateItem,
  updateLine,
  updatePolygon,
} from './commands';
import { parseLineGeometry, parsePolygonGeometry, pointCoord } from './geometry';
import {
  findItem,
  getMissionItemNames,
  observeHiddenItemIds,
  observeItem,
  observeMissionItems,
  observeMissionSidcs,
  suggestName,
} from './repository';

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

  it('stamps the editor separately from the creator', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    await updateItem({ ...ctx, actorId: () => 'device-2' }, r.value.id, { name: 'B' });
    const item = await findItem(ctx.db, r.value.id);
    expect(item?.updatedBy).toBe('device-2');
    expect(item?.createdBy).toBe('device-test');
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
    // The raw row must survive as a tombstone (not be destroyed permanently) so it can sync.
    const raw = await ctx.db.adapter.find('map_items', r.value.id);
    expect(raw).toMatchObject({ id: r.value.id, _status: 'deleted' });
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
    expect(await suggestName(ctx.db, 'm1', 'HOS')).toBe('HOS-5');
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

  it('observes one item and reports null once it is deleted', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!r.ok) throw new Error('setup');
    expect((await firstValueFrom(observeItem(ctx.db, r.value.id)))?.name).toBe('HOS-1');
    await deleteItem(ctx, r.value.id);
    expect(await firstValueFrom(observeItem(ctx.db, r.value.id))).toBeNull();
    expect(await firstValueFrom(observeItem(ctx.db, 'nope'))).toBeNull();
  });

  it('sets visibility explicitly', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!r.ok) throw new Error('setup');
    await setItemHidden(ctx, r.value.id, true);
    await setItemHidden(ctx, r.value.id, true);
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([r.value.id]);
    await setItemHidden(ctx, r.value.id, false);
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]);
  });

  it('sets visibility for many items in one call, idempotently, leaving others alone', async () => {
    const ctx = makeTestContext();
    const ids: string[] = [];
    for (const name of ['HOS-1', 'HOS-2', 'HOS-3']) {
      const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name });
      if (!r.ok) throw new Error('setup');
      ids.push(r.value.id);
    }
    expect(await setItemsHidden(ctx, [ids[0], ids[1]], true)).toEqual({ ok: true, value: undefined });
    await setItemsHidden(ctx, [ids[0], ids[1]], true);
    expect((await firstValueFrom(observeHiddenItemIds(ctx.db))).sort()).toEqual([ids[0], ids[1]].sort());
    await setItemsHidden(ctx, [ids[0], ids[2]], false);
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([ids[1]]);
    expect(await setItemsHidden(ctx, [], true)).toEqual({ ok: true, value: undefined });
  });

  it('accepts unit and point symbols and rejects unknown ones', async () => {
    const ctx = makeTestContext();
    expect((await placePoint(ctx, { missionId: 'm1', coord: at, sidc: 'GFGPGPPK------X', name: 'CP-1' })).ok).toBe(true);
    expect(await placePoint(ctx, { missionId: 'm1', coord: at, sidc: 'garbage', name: 'X' })).toMatchObject({ ok: false, error: 'invalid_symbol' });
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!r.ok) throw new Error('setup');
    expect(await updateItem(ctx, r.value.id, { sidc: 'garbage' })).toMatchObject({ ok: false, error: 'invalid_symbol' });
  });

  describe('lines', () => {
    const P = [at, { lat: at.lat + 0.01, lon: at.lon }];

    it('places a line with its type in style and reads it back', async () => {
      const ctx = makeTestContext();
      const r = await placeLine(ctx, { missionId: 'm1', points: P, lineType: 'route', name: ' PL RED ' });
      if (!r.ok) throw new Error('setup');
      const item = await findItem(ctx.db, r.value.id);
      expect(item).toMatchObject({ kind: 'line', name: 'PL RED', sidc: null, style: '{"lineType":"route"}' });
      expect(parseLineGeometry(item!.geometry)).toEqual(P);
    });

    it('validates points, name and existence', async () => {
      const ctx = makeTestContext();
      expect(await placeLine(ctx, { missionId: 'm1', points: [at], lineType: 'phase-line', name: 'X' })).toMatchObject({ ok: false, error: 'too_few_points' });
      expect(await placeLine(ctx, { missionId: 'm1', points: [at, { lat: 99, lon: 0 }], lineType: 'phase-line', name: 'X' })).toMatchObject({ ok: false, error: 'invalid_coordinate' });
      expect(await placeLine(ctx, { missionId: 'm1', points: P, lineType: 'phase-line', name: '  ' })).toMatchObject({ ok: false, error: 'invalid_name' });
      expect(await updateLine(ctx, 'nope', { name: 'X' })).toMatchObject({ ok: false, error: 'not_found' });
    });

    it('updates points, type, name and notes', async () => {
      const ctx = makeTestContext();
      const r = await placeLine(ctx, { missionId: 'm1', points: P, lineType: 'phase-line', name: 'RED' });
      if (!r.ok) throw new Error('setup');
      const Q3 = [...P, { lat: at.lat + 0.02, lon: at.lon }];
      expect(await updateLine(ctx, r.value.id, { points: Q3, lineType: 'boundary', name: 'NORTH', notes: 'n' })).toEqual({ ok: true, value: undefined });
      const item = await findItem(ctx.db, r.value.id);
      expect(item).toMatchObject({ name: 'NORTH', notes: 'n', style: '{"lineType":"boundary"}' });
      expect(parseLineGeometry(item!.geometry)).toEqual(Q3);
      expect(await updateLine(ctx, r.value.id, { points: [at] })).toMatchObject({ ok: false, error: 'too_few_points' });
    });
  });

  describe('polygons', () => {
    const tri = [at, { lat: at.lat + 0.01, lon: at.lon }, { lat: at.lat, lon: at.lon + 0.01 }];

    it('places a points polygon and a circle', async () => {
      const ctx = makeTestContext();
      const a = await placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name: ' IRON ', shape: { kind: 'points', points: tri } });
      if (!a.ok) throw new Error('setup');
      const pa = await findItem(ctx.db, a.value.id);
      expect(pa).toMatchObject({ kind: 'polygon', name: 'IRON', sidc: null, style: '{"polygonType":"objective","shape":"points"}' });
      expect(parsePolygonGeometry(pa!.geometry)).toEqual(tri);
      const c = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'circle', center: at, radiusM: 500 } });
      if (!c.ok) throw new Error('setup');
      const pc = await findItem(ctx.db, c.value.id);
      expect(JSON.parse(pc!.style!)).toEqual({ polygonType: 'no-fire-area', shape: 'circle', center: at, radiusM: 500 });
      expect(parsePolygonGeometry(pc!.geometry)).toHaveLength(64);
    });

    it('validates points, radius, name and existence', async () => {
      const ctx = makeTestContext();
      const place = (shape: Parameters<typeof placePolygon>[1]['shape'], name = 'X') => placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name, shape });
      expect(await place({ kind: 'points', points: tri.slice(0, 2) })).toMatchObject({ ok: false, error: 'too_few_points' });
      expect(await place({ kind: 'points', points: [...tri.slice(0, 2), { lat: 99, lon: 0 }] })).toMatchObject({ ok: false, error: 'invalid_coordinate' });
      expect(await place({ kind: 'circle', center: at, radiusM: 0 })).toMatchObject({ ok: false, error: 'invalid_radius' });
      expect(await place({ kind: 'circle', center: at, radiusM: 600_000 })).toMatchObject({ ok: false, error: 'invalid_radius' });
      expect(await place({ kind: 'circle', center: { lat: 99, lon: 0 }, radiusM: 5 })).toMatchObject({ ok: false, error: 'invalid_coordinate' });
      expect(await place({ kind: 'points', points: tri }, '  ')).toMatchObject({ ok: false, error: 'invalid_name' });
      expect(await updatePolygon(ctx, 'nope', { name: 'X' })).toMatchObject({ ok: false, error: 'not_found' });
    });

    it('updates the type alone (keeping the circle) and the shape', async () => {
      const ctx = makeTestContext();
      const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'circle', center: at, radiusM: 500 } });
      if (!r.ok) throw new Error('setup');
      expect(await updatePolygon(ctx, r.value.id, { polygonType: 'free-fire-area', notes: 'n' })).toEqual({ ok: true, value: undefined });
      expect(JSON.parse((await findItem(ctx.db, r.value.id))!.style!)).toEqual({ polygonType: 'free-fire-area', shape: 'circle', center: at, radiusM: 500 });
      await updatePolygon(ctx, r.value.id, { shape: { kind: 'points', points: tri } });
      const item = await findItem(ctx.db, r.value.id);
      expect(item).toMatchObject({ notes: 'n', style: '{"polygonType":"free-fire-area","shape":"points"}' });
      expect(parsePolygonGeometry(item!.geometry)).toEqual(tri);
    });
  });
});

const FRIEND_ARMOR_SIDC = 'SFGPUCA--------';
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('observeMissionSidcs', () => {
  it('emits the sorted, distinct symbols only when the set of symbols changes', async () => {
    const ctx = makeTestContext();
    const placed = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!placed.ok) throw new Error('place failed');
    const emitted: string[][] = [];
    const sub = observeMissionSidcs(ctx.db, 'm1').subscribe((s) => emitted.push(s));
    await settle();
    expect(emitted).toEqual([[HOSTILE_INF]]);

    // A rename or a move does not change the symbols: the map must not re-render for it.
    await updateItem(ctx, placed.value.id, { name: 'B' });
    await updateItem(ctx, placed.value.id, { coord: { lat: 38.9, lon: -77 } });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'C' });
    await settle();
    expect(emitted).toHaveLength(1);

    await updateItem(ctx, placed.value.id, { sidc: FRIEND_ARMOR_SIDC });
    await settle();
    expect(emitted.at(-1)).toEqual([FRIEND_ARMOR_SIDC, HOSTILE_INF].sort());
    expect(emitted).toHaveLength(2);
    sub.unsubscribe();
  });
});
