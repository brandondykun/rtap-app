import { waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { placeLine, placePoint, placePolygon, setItemHidden } from '@/features/map-items/commands';
import { findItemViewState, observeMissionItems } from '@/features/map-items/repository';
import type { AppDb } from '@/lib/db/app-db';
import { createTestDatabase, makeTestContext } from '@/lib/db/test-database';

import { createMission, deleteMission, markMissionOpened, renameMission, saveMissionCamera } from './commands';
import {
  findMission,
  findMissionViewState,
  getMissionCamera,
  observeMissionCategoryCounts,
  observeMissionSummaries,
  suggestMissionName,
} from './repository';

describe('missions', () => {
  it('a database error while looking up the mission is write_failed, not a rejection', async () => {
    const db: AppDb = { ...createTestDatabase(), getOptional: () => Promise.reject(new Error('disk I/O error')) };
    const ctx = makeTestContext(db);
    await expect(renameMission(ctx, 'm1', { name: 'Op Iron' })).resolves.toMatchObject({ ok: false, error: 'write_failed' });
    await expect(deleteMission(ctx, 'm1')).resolves.toMatchObject({ ok: false, error: 'write_failed' });
  });

  it('creates a mission stamped with the actor', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: ' Op Iron ' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mission = await findMission(ctx.db, r.value.id);
    expect(mission?.name).toBe('Op Iron');
    expect(mission?.createdBy).toBe('device-test');
  });

  it('rejects a blank name', async () => {
    const ctx = makeTestContext();
    expect(await createMission(ctx, { name: '   ' })).toMatchObject({ ok: false, error: 'invalid_name' });
  });

  it('returns null for an unknown mission', async () => {
    const ctx = makeTestContext();
    expect(await findMission(ctx.db, 'nope')).toBeNull();
  });

  it('orders summaries by last opened, never-opened last, then newest created', async () => {
    const ctx = makeTestContext();
    const a = await createMission(ctx, { name: 'A' });
    const b = await createMission(ctx, { name: 'B' });
    const c = await createMission(ctx, { name: 'C' });
    if (!a.ok || !b.ok || !c.ok) throw new Error('setup failed');
    await markMissionOpened(ctx, a.value.id);
    await markMissionOpened(ctx, b.value.id);
    await markMissionOpened(ctx, a.value.id);

    const list = await firstValueFrom(observeMissionSummaries(ctx.db));
    expect(list.map((m) => m.name)).toEqual(['A', 'B', 'C']);
    expect(list[2].lastOpenedAt).toBeNull();
  });

  it('keeps a single view-state row per mission', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    await markMissionOpened(ctx, r.value.id);
    await markMissionOpened(ctx, r.value.id);
    await saveMissionCamera(ctx, r.value.id, { center: { lat: 1, lon: 2 }, zoom: 12, bearing: 0 });
    const rows = await ctx.db.getAll('SELECT id FROM mission_view_state WHERE mission_id = ?', [r.value.id]);
    expect(rows).toHaveLength(1);
  });

  it('saves and restores the camera', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    expect(await getMissionCamera(ctx.db, r.value.id)).toBeNull();
    const camera = { center: { lat: 38.9, lon: -77 }, zoom: 13.5, bearing: 12 };
    expect(await saveMissionCamera(ctx, r.value.id, camera)).toEqual({ ok: true, value: undefined });
    expect(await getMissionCamera(ctx.db, r.value.id)).toEqual(camera);
  });

  it('rejects a non-finite camera', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    const bad = { center: { lat: Number.NaN, lon: 0 }, zoom: 1, bearing: 0 };
    expect(await saveMissionCamera(ctx, r.value.id, bad)).toMatchObject({ ok: false, error: 'invalid_camera' });
  });

  it('counts only that mission’s items', async () => {
    const ctx = makeTestContext();
    const a = await createMission(ctx, { name: 'A' });
    const b = await createMission(ctx, { name: 'B' });
    if (!a.ok || !b.ok) throw new Error('setup failed');
    for (const [i, missionId] of [a.value.id, a.value.id, b.value.id].entries()) {
      await ctx.db.execute(
        `INSERT INTO map_items (id, mission_id, kind, geometry, name, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, 'point', '{"type":"Point","coordinates":[0,0]}', 'x', 'd', 'd', 1, 1)`,
        [`i${i}`, missionId],
      );
    }
    expect(await firstValueFrom(observeMissionCategoryCounts(ctx.db, a.value.id))).toEqual({ units: 2, points: 0, lines: 0, polygons: 0 });
  });

  it('suggests the next mission name', async () => {
    const ctx = makeTestContext();
    expect(await suggestMissionName(ctx.db)).toBe('Mission 1');
    await createMission(ctx, { name: 'Whatever' });
    expect(await suggestMissionName(ctx.db)).toBe('Mission 2');
  });

  it('treats a deleted mission as missing', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Gone' });
    if (!r.ok) throw new Error('setup');
    await ctx.db.execute('DELETE FROM missions WHERE id = ?', [r.value.id]);
    expect(await findMission(ctx.db, r.value.id)).toBeNull();
  });

  describe('deleteMission', () => {
    const at = { lat: 38.8977, lon: -77.0365 };
    const sidc = 'SHGPUCI--------';

    it('removes the mission, its items and its view state, leaving other missions alone', async () => {
      const ctx = makeTestContext();
      const iron = await createMission(ctx, { name: 'Op Iron' });
      const cobra = await createMission(ctx, { name: 'Op Cobra' });
      if (!iron.ok || !cobra.ok) throw new Error('setup');
      const a = await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc, name: 'HOS-1' });
      const b = await placePoint(ctx, { missionId: cobra.value.id, coord: at, sidc, name: 'HOS-1' });
      if (!a.ok || !b.ok) throw new Error('setup');
      await setItemHidden(ctx, a.value.id, true);
      await setItemHidden(ctx, b.value.id, true);
      await markMissionOpened(ctx, iron.value.id);
      await markMissionOpened(ctx, cobra.value.id);

      expect(await deleteMission(ctx, iron.value.id)).toEqual({ ok: true, value: undefined });

      expect(await findMission(ctx.db, iron.value.id)).toBeNull();
      expect((await firstValueFrom(observeMissionSummaries(ctx.db))).map((m) => m.name)).toEqual(['Op Cobra']);
      expect(await firstValueFrom(observeMissionCategoryCounts(ctx.db, iron.value.id))).toEqual({ units: 0, points: 0, lines: 0, polygons: 0 });
      expect(await firstValueFrom(observeMissionCategoryCounts(ctx.db, cobra.value.id))).toEqual({ units: 1, points: 0, lines: 0, polygons: 0 });
      // Hard deletes on the device: the rows are gone, not tombstoned.
      expect(await ctx.db.getAll('SELECT id FROM map_items WHERE id = ?', [a.value.id])).toEqual([]);
      expect(await ctx.db.getAll('SELECT map_item_id FROM item_view_state')).toEqual([{ map_item_id: b.value.id }]);
      expect(await ctx.db.getAll('SELECT mission_id FROM mission_view_state')).toEqual([{ mission_id: cobra.value.id }]);
    });

    it('deleting a mission empties its open items list and removes its view state', async () => {
      const ctx = makeTestContext();
      const iron = await createMission(ctx, { name: 'Op Iron' });
      if (!iron.ok) throw new Error('setup');
      const ids: string[] = [];
      for (const name of ['HOS-1', 'HOS-2', 'HOS-3']) {
        const r = await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc, name });
        if (!r.ok) throw new Error('setup');
        ids.push(r.value.id);
      }
      await setItemHidden(ctx, ids[0], true);
      await markMissionOpened(ctx, iron.value.id);
      const emitted: unknown[][] = [];
      const sub = observeMissionItems(ctx.db, iron.value.id).subscribe((items) => emitted.push(items));
      await waitFor(() => expect(emitted.at(-1)).toHaveLength(3));

      expect(await deleteMission(ctx, iron.value.id)).toEqual({ ok: true, value: undefined });

      await waitFor(() => expect(emitted.at(-1)).toEqual([]));
      sub.unsubscribe();
      expect(await findMissionViewState(ctx.db, iron.value.id)).toBeNull();
      expect(await findItemViewState(ctx.db, ids[0])).toBeNull();
      expect(await ctx.db.getOptional<{ n: number }>('SELECT COUNT(*) AS n FROM map_items')).toEqual({ n: 0 });
    });

    it('deletes an empty mission and reports an unknown or already deleted one', async () => {
      const ctx = makeTestContext();
      const iron = await createMission(ctx, { name: 'Op Iron' });
      if (!iron.ok) throw new Error('setup');
      expect((await deleteMission(ctx, iron.value.id)).ok).toBe(true);
      expect(await deleteMission(ctx, iron.value.id)).toMatchObject({ ok: false, error: 'not_found' });
      expect(await deleteMission(ctx, 'nope')).toMatchObject({ ok: false, error: 'not_found' });
    });
  });

  describe('renameMission', () => {
    it('renames a mission, trimming spaces, and leaves its items alone', async () => {
      const ctx = makeTestContext();
      const iron = await createMission(ctx, { name: 'Op Iron' });
      if (!iron.ok) throw new Error('setup');
      await placePoint(ctx, { missionId: iron.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
      expect(await renameMission(ctx, iron.value.id, { name: '  Op Steel ' })).toEqual({ ok: true, value: undefined });
      expect((await findMission(ctx.db, iron.value.id))?.name).toBe('Op Steel');
      expect(await firstValueFrom(observeMissionCategoryCounts(ctx.db, iron.value.id))).toEqual({ units: 1, points: 0, lines: 0, polygons: 0 });
    });

    it('rejects a blank name and reports an unknown or deleted mission', async () => {
      const ctx = makeTestContext();
      const iron = await createMission(ctx, { name: 'Op Iron' });
      if (!iron.ok) throw new Error('setup');
      expect(await renameMission(ctx, iron.value.id, { name: '   ' })).toMatchObject({ ok: false, error: 'invalid_name' });
      expect((await findMission(ctx.db, iron.value.id))?.name).toBe('Op Iron');
      expect(await renameMission(ctx, 'nope', { name: 'X' })).toMatchObject({ ok: false, error: 'not_found' });
      await deleteMission(ctx, iron.value.id);
      expect(await renameMission(ctx, iron.value.id, { name: 'X' })).toMatchObject({ ok: false, error: 'not_found' });
    });
  });

  it('counts units and points per mission', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    if (!iron.ok) throw new Error('setup');
    await placePoint(ctx, { missionId: iron.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    await placePoint(ctx, { missionId: iron.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'GFGPGPPK------X', name: 'CP-1' });
    await placeLine(ctx, { missionId: iron.value.id, points: [{ lat: 38.9, lon: -77 }, { lat: 38.91, lon: -77 }], lineType: 'phase-line', name: 'RED' });
    await placePolygon(ctx, { missionId: iron.value.id, polygonType: 'objective', name: 'IRON', shape: { kind: 'circle', center: { lat: 38.9, lon: -77 }, radiusM: 500 } });
    expect(await firstValueFrom(observeMissionCategoryCounts(ctx.db, iron.value.id))).toEqual({ units: 1, points: 1, lines: 1, polygons: 1 });
  });
});
