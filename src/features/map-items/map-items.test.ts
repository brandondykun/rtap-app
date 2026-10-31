import { waitFor } from '@testing-library/react-native';
import { defer, firstValueFrom, tap } from 'rxjs';

import { composeSidc } from '@/features/symbology/presets';
import type { AppDb, SqlParams } from '@/lib/db/app-db';
import { createTestDatabase, makeTestContext } from '@/lib/db/test-database';

import {
  deleteItem,
  placeLine,
  placePoint,
  placePolygon,
  setItemHidden,
  setItemShowRing,
  setItemsHidden,
  setItemsShowRing,
  toggleItemVisibility,
  updateItem,
  updateLine,
  updatePolygon,
} from './commands';
import { parseLineGeometry, parsePolygonGeometry, pointCoord, pointGeometry } from './geometry';
import {
  findItem,
  getMissionItemNames,
  observeHiddenItemIds,
  observeItem,
  observeMissionItems,
  observeMissionSidcs,
  observeRingItemIds,
  suggestName,
  type MapItemSnapshot,
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

  it('saves a ground elevation with a point and keeps it unless an update sets one', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A', elevationM: 312.4 });
    if (!r.ok) throw new Error('setup failed');
    expect((await findItem(ctx.db, r.value.id))?.elevationM).toBe(312.4);
    await updateItem(ctx, r.value.id, { name: 'B' });
    expect((await findItem(ctx.db, r.value.id))?.elevationM).toBe(312.4);
    await updateItem(ctx, r.value.id, { coord: { lat: 39, lon: -77 }, elevationM: null });
    expect((await findItem(ctx.db, r.value.id))?.elevationM).toBeNull();
    const unknown = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'C' });
    if (!unknown.ok) throw new Error('setup failed');
    expect((await findItem(ctx.db, unknown.value.id))?.elevationM).toBeNull();
    const [snap] = (await firstValueFrom(observeMissionItems(ctx.db, 'm1'))).filter((i) => i.id === r.value.id);
    expect(snap.elevationM).toBeNull();
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

  it('deletes the row outright and drops it from queries', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    expect(await deleteItem(ctx, r.value.id)).toEqual({ ok: true, value: undefined });
    // Local-only tables: a hard delete, no tombstone on the device (the later sync design keeps those on the server).
    expect(await ctx.db.getAll('SELECT id FROM map_items WHERE id = ?', [r.value.id])).toEqual([]);
    expect(await findItem(ctx.db, r.value.id)).toBeNull();
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

describe('items from a newer version of the app', () => {
  const tri = [at, { lat: at.lat + 0.01, lon: at.lon }, { lat: at.lat, lon: at.lon + 0.01 }];
  // What a sync could bring down from a teammate on a newer version: a kind this app does not know.
  const placeUnknownKind = async (ctx: ReturnType<typeof makeTestContext>) => {
    const id = 'unknown-kind-1';
    await ctx.db.execute(
      `INSERT INTO map_items (id, mission_id, kind, geometry, sidc, name, created_by, updated_by, created_at, updated_at)
       VALUES (?, 'm1', 'text', ?, NULL, 'NOTE', 'other', 'other', 1, 1)`,
      [id, pointGeometry(at)],
    );
    return { id };
  };
  const restyle = (ctx: ReturnType<typeof makeTestContext>, id: string, extra: Record<string, unknown>) =>
    findItem(ctx.db, id).then((item) =>
      ctx.db.execute('UPDATE map_items SET style = ? WHERE id = ?', [JSON.stringify({ ...JSON.parse(item!.style!), ...extra }), id]),
    );

  it('ignores items of a kind this app does not know, so they are never drawn as something else', async () => {
    const ctx = makeTestContext();
    const unknown = await placeUnknownKind(ctx);
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    expect((await firstValueFrom(observeMissionItems(ctx.db, 'm1'))).map((i) => i.name)).toEqual(['HOS-1']);
    expect(await firstValueFrom(observeItem(ctx.db, unknown.id))).toBeNull();
  });

  it('keeps style details it does not know when a line is edited', async () => {
    const ctx = makeTestContext();
    const r = await placeLine(ctx, { missionId: 'm1', lineType: 'phase-line', name: 'RED', points: tri.slice(0, 2) });
    if (!r.ok) throw new Error('setup');
    await restyle(ctx, r.value.id, { dash: 'long' });
    await updateLine(ctx, r.value.id, { lineType: 'boundary' });
    expect(JSON.parse((await findItem(ctx.db, r.value.id))!.style!)).toEqual({ lineType: 'boundary', dash: 'long' });
  });

  it('keeps style details it does not know when a polygon is edited, and still drops the old circle', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'circle', center: at, radiusM: 500 } });
    if (!r.ok) throw new Error('setup');
    await restyle(ctx, r.value.id, { dash: 'long' });
    await updatePolygon(ctx, r.value.id, { polygonType: 'objective', shape: { kind: 'points', points: tri } });
    expect(JSON.parse((await findItem(ctx.db, r.value.id))!.style!)).toEqual({ polygonType: 'objective', shape: 'points', dash: 'long' });
  });
});

const FRIEND_ARMOR_SIDC = 'SFGPUCA--------';
// Longer than PowerSync's 30 ms watch throttle, so a re-emission that is coming has arrived.
const settle = () => new Promise((r) => setTimeout(r, 200));

describe('observeMissionSidcs', () => {
  it('emits the sorted, distinct symbols only when the set of symbols changes', async () => {
    const ctx = makeTestContext();
    const placed = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!placed.ok) throw new Error('place failed');
    const emitted: string[][] = [];
    const sub = observeMissionSidcs(ctx.db, 'm1').subscribe((s) => emitted.push(s));
    await waitFor(() => expect(emitted).toEqual([[HOSTILE_INF]]));

    // A rename or a move does not change the symbols: the map must not re-render for it.
    await updateItem(ctx, placed.value.id, { name: 'B' });
    await updateItem(ctx, placed.value.id, { coord: { lat: 38.9, lon: -77 } });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'C' });
    await settle();
    expect(emitted).toHaveLength(1);

    await updateItem(ctx, placed.value.id, { sidc: FRIEND_ARMOR_SIDC });
    await waitFor(() => expect(emitted.at(-1)).toEqual([FRIEND_ARMOR_SIDC, HOSTILE_INF].sort()));
    await settle();
    expect(emitted).toHaveLength(2);
    sub.unsubscribe();
  });
});

describe('unit ranges and range rings', () => {
  const ARTY = composeSidc('hostile', 'artillery');
  const AD = composeSidc('hostile', 'air-defense');
  const INF = composeSidc('hostile', 'infantry');
  const rings = (ctx: ReturnType<typeof makeTestContext>) => firstValueFrom(observeRingItemIds(ctx.db));

  async function place(ctx: ReturnType<typeof makeTestContext>, sidc: string, ranges = {}) {
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc, name: 'U', ranges });
    if (!r.ok) throw new Error(r.error);
    return r.value.id;
  }
  const snap = async (ctx: ReturnType<typeof makeTestContext>, id: string) => (await firstValueFrom(observeItem(ctx.db, id)))!;

  it('places an artillery unit with a threat ring and drops ranges that do not apply', async () => {
    const ctx = makeTestContext();
    const id = await place(ctx, ARTY, { threatRangeM: 18000, verticalRangeFt: 9 });
    expect(await snap(ctx, id)).toMatchObject({ threatRangeM: 18000, horizontalRangeM: null, verticalRangeFt: null });
  });

  it('rejects an out-of-range value', async () => {
    const ctx = makeTestContext();
    expect(await placePoint(ctx, { missionId: 'm1', coord: at, sidc: ARTY, name: 'U', ranges: { threatRangeM: 500_001 } })).toMatchObject({ ok: false, error: 'invalid_range' });
    expect(await placePoint(ctx, { missionId: 'm1', coord: at, sidc: AD, name: 'U', ranges: { verticalRangeFt: 100_001 } })).toMatchObject({ ok: false, error: 'invalid_range' });
  });

  it('ring visibility is off by default and set per item and in bulk', async () => {
    const ctx = makeTestContext();
    const a = await place(ctx, ARTY, { threatRangeM: 1000 });
    const b = await place(ctx, ARTY, { threatRangeM: 2000 });
    expect(await rings(ctx)).toEqual([]);
    await setItemShowRing(ctx, a, true);
    expect(await rings(ctx)).toEqual([a]);
    await setItemsShowRing(ctx, [a, b], false);
    expect(await rings(ctx)).toEqual([]);
    await setItemsShowRing(ctx, [a, b], true);
    await setItemsHidden(ctx, [a, b], true);
    expect((await rings(ctx)).sort()).toEqual([a, b].sort());
    expect((await firstValueFrom(observeHiddenItemIds(ctx.db))).sort()).toEqual([a, b].sort());
    await setItemsHidden(ctx, [a, b], false);
    expect((await rings(ctx)).sort()).toEqual([a, b].sort());
  });

  it('hiding a ring with no view state row is a no-op', async () => {
    const ctx = makeTestContext();
    const a = await place(ctx, ARTY, { threatRangeM: 1000 });
    await setItemShowRing(ctx, a, false);
    expect(await ctx.db.getOptional('SELECT COUNT(*) AS n FROM item_view_state')).toEqual({ n: 0 });
  });

  it('changing type away from artillery clears the range and turns the ring off', async () => {
    const ctx = makeTestContext();
    const id = await place(ctx, ARTY, { threatRangeM: 18000 });
    await setItemShowRing(ctx, id, true);
    expect(await rings(ctx)).toEqual([id]);
    expect(await updateItem(ctx, id, { sidc: INF })).toEqual({ ok: true, value: undefined });
    expect((await snap(ctx, id)).threatRangeM).toBeNull();
    expect(await rings(ctx)).toEqual([]);
    await updateItem(ctx, id, { sidc: ARTY, ranges: { threatRangeM: 100 } });
    expect((await snap(ctx, id)).threatRangeM).toBe(100);
    expect(await rings(ctx)).toEqual([]);
  });

  it('artillery to air defense without a horizontal range turns the ring off', async () => {
    const ctx = makeTestContext();
    const id = await place(ctx, ARTY, { threatRangeM: 18000 });
    await setItemShowRing(ctx, id, true);
    await updateItem(ctx, id, { sidc: AD });
    expect(await rings(ctx)).toEqual([]);
  });

  it('emptying the threat ring turns the ring off', async () => {
    const ctx = makeTestContext();
    const id = await place(ctx, ARTY, { threatRangeM: 18000 });
    await setItemShowRing(ctx, id, true);
    await updateItem(ctx, id, { ranges: { threatRangeM: null } });
    expect((await snap(ctx, id)).threatRangeM).toBeNull();
    expect(await rings(ctx)).toEqual([]);
  });

  it('merges a partial ranges patch over the stored ranges and keeps the ring on', async () => {
    const ctx = makeTestContext();
    const id = await place(ctx, AD, { horizontalRangeM: 5000, verticalRangeFt: 20000 });
    await setItemShowRing(ctx, id, true);
    await updateItem(ctx, id, { ranges: { verticalRangeFt: 30000 } });
    expect(await snap(ctx, id)).toMatchObject({ horizontalRangeM: 5000, verticalRangeFt: 30000 });
    expect(await rings(ctx)).toEqual([id]);
    expect(await updateItem(ctx, id, { ranges: { horizontalRangeM: 0 } })).toMatchObject({ ok: false, error: 'invalid_range' });
  });

  it('deleting a unit with its ring on leaves no ring id', async () => {
    const ctx = makeTestContext();
    const id = await place(ctx, ARTY, { threatRangeM: 18000 });
    await setItemShowRing(ctx, id, true);
    await deleteItem(ctx, id);
    expect(await rings(ctx)).toEqual([]);
  });
});

/** A test database that counts the live queries started on it (subscriptions to its watch) and their emissions. */
function countingDb(): { db: AppDb; counts: { watches: number; runs: number } } {
  const base = createTestDatabase();
  const counts = { watches: 0, runs: 0 };
  const db: AppDb = {
    ...base,
    watch: <T>(sql: string, params: SqlParams, tables: readonly string[]) =>
      defer(() => {
        counts.watches++;
        return base.watch<T>(sql, params, tables).pipe(tap(() => counts.runs++));
      }),
  };
  return { db, counts };
}

describe('on SQL', () => {
  it('shares one live query among everything watching a mission, and starts a fresh one after all left', async () => {
    const { db, counts } = countingDb();
    const ctx = makeTestContext(db);
    const a: MapItemSnapshot[][] = [];
    const b: MapItemSnapshot[][] = [];
    const sidcs: string[][] = [];
    const subs = [
      observeMissionItems(db, 'm1').subscribe((items) => a.push(items)),
      observeMissionItems(db, 'm1').subscribe((items) => b.push(items)),
      observeMissionSidcs(db, 'm1').subscribe((list) => sidcs.push(list)),
    ];
    await waitFor(() => expect([a.length, b.length, sidcs.length]).toEqual([1, 1, 1]));
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await waitFor(() => expect([a.at(-1)?.length, b.at(-1)?.length, sidcs.at(-1)]).toEqual([1, 1, [HOSTILE_INF]]));
    // One query, run once at subscribe and once for the write.
    expect(counts).toEqual({ watches: 1, runs: 2 });
    subs.forEach((s) => s.unsubscribe());

    // Arriving after everyone left: a new live query, not the stopped one.
    const c: MapItemSnapshot[][] = [];
    const sub = observeMissionItems(db, 'm1').subscribe((items) => c.push(items));
    await waitFor(() => expect(c.at(-1)).toHaveLength(1));
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });
    await waitFor(() => expect(c.at(-1)).toHaveLength(2));
    expect(counts.watches).toBe(2);
    sub.unsubscribe();
  });

  it('shares one live query per view-state list', async () => {
    const { db, counts } = countingDb();
    const ctx = makeTestContext(db);
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!r.ok) throw new Error('setup');
    const hidden: string[][] = [];
    const rings: string[][] = [];
    const subs = [
      observeHiddenItemIds(db).subscribe((ids) => hidden.push(ids)),
      observeHiddenItemIds(db).subscribe((ids) => hidden.push(ids)),
      observeRingItemIds(db).subscribe((ids) => rings.push(ids)),
      observeRingItemIds(db).subscribe((ids) => rings.push(ids)),
    ];
    await waitFor(() => expect([hidden.length, rings.length]).toEqual([2, 2]));
    await setItemHidden(ctx, r.value.id, true);
    await waitFor(() => expect(hidden.slice(-2)).toEqual([[r.value.id], [r.value.id]]));
    // Two lists, two queries: each ran at subscribe and once for the write.
    expect(counts).toEqual({ watches: 2, runs: 4 });
    subs.forEach((s) => s.unsubscribe());
  });

  it('a database error while looking up the item is write_failed, not a rejection', async () => {
    const db: AppDb = { ...createTestDatabase(), getOptional: () => Promise.reject(new Error('disk I/O error')) };
    const ctx = makeTestContext(db);
    const failed = { ok: false, error: 'write_failed' };
    await expect(updateItem(ctx, 'i1', { name: 'A' })).resolves.toMatchObject(failed);
    await expect(deleteItem(ctx, 'i1')).resolves.toMatchObject(failed);
    await expect(updateLine(ctx, 'i1', { name: 'A' })).resolves.toMatchObject(failed);
    await expect(updatePolygon(ctx, 'i1', { name: 'A' })).resolves.toMatchObject(failed);
  });

  it('hiding 100 items is one write the hidden-ids list sees once', async () => {
    const ctx = makeTestContext();
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: `HOS-${i}` });
      if (!r.ok) throw new Error('setup');
      ids.push(r.value.id);
    }
    const emitted: string[][] = [];
    const sub = observeHiddenItemIds(ctx.db).subscribe((list) => emitted.push(list));
    await waitFor(() => expect(emitted).toHaveLength(1));
    expect(await setItemsHidden(ctx, ids, true)).toEqual({ ok: true, value: undefined });
    await waitFor(() => expect(emitted.at(-1)).toHaveLength(100));
    await new Promise((r) => setTimeout(r, 200));
    expect(emitted).toHaveLength(2);
    sub.unsubscribe();
  });

  it('never returns an item of an unknown kind', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await ctx.db.execute(
      `INSERT INTO map_items (id, mission_id, kind, geometry, sidc, name, notes, style, elevation_m, threat_range_m,
        horizontal_range_m, vertical_range_ft, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?)`,
      ['circle-1', 'm1', 'circle', pointGeometry(at), 'RING', 'other', 'other', 1, 1],
    );
    expect((await firstValueFrom(observeMissionItems(ctx.db, 'm1'))).map((i) => i.name)).toEqual(['HOS-1']);
    expect(await firstValueFrom(observeItem(ctx.db, 'circle-1'))).toBeNull();
  });

  it('keeps null notes null and quoted names intact', async () => {
    const ctx = makeTestContext();
    const name = 'O\'Brien "2"';
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name });
    if (!r.ok) throw new Error('setup');
    const item = await findItem(ctx.db, r.value.id);
    expect(item?.notes).toBeNull();
    expect(item?.sidc).toBe(HOSTILE_INF);
    expect(item?.name).toBe(name);
  });
});
