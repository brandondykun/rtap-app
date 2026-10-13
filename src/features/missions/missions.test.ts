import { Q } from '@nozbe/watermelondb';
import { firstValueFrom } from 'rxjs';

import { placePoint, setItemHidden } from '@/features/map-items/commands';
import type { ItemViewState } from '@/lib/db/models/ItemViewState';
import type { MapItem } from '@/lib/db/models/MapItem';
import type { MissionViewState } from '@/lib/db/models/MissionViewState';
import { Tables } from '@/lib/db/schema';
import { makeTestContext } from '@/lib/db/test-database';

import { createMission, deleteMission, markMissionOpened, renameMission, saveMissionCamera } from './commands';
import {
  findMission,
  getMissionCamera,
  observeMissionItemCount,
  observeMissionSummaries,
  suggestMissionName,
} from './repository';

describe('missions', () => {
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
    const rows = await ctx.db
      .get<MissionViewState>(Tables.missionViewState)
      .query(Q.where('mission_id', r.value.id))
      .fetch();
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
    await ctx.db.write(async () => {
      for (const missionId of [a.value.id, a.value.id, b.value.id]) {
        await ctx.db.get<MapItem>(Tables.mapItems).create((i) => {
          i.missionId = missionId;
          i.kind = 'point';
          i.geometry = '{"type":"Point","coordinates":[0,0]}';
          i.name = 'x';
          i.createdBy = 'd';
          i.updatedBy = 'd';
        });
      }
    });
    expect(await firstValueFrom(observeMissionItemCount(ctx.db, a.value.id))).toBe(2);
  });

  it('suggests the next mission name', async () => {
    const ctx = makeTestContext();
    expect(await suggestMissionName(ctx.db)).toBe('Mission 1');
    await createMission(ctx, { name: 'Whatever' });
    expect(await suggestMissionName(ctx.db)).toBe('Mission 2');
  });

  it('treats a soft-deleted mission as missing', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Gone' });
    if (!r.ok) throw new Error('setup');
    const mission = await findMission(ctx.db, r.value.id);
    await ctx.db.write(() => mission!.markAsDeleted());
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
      expect(await firstValueFrom(observeMissionItemCount(ctx.db, iron.value.id))).toBe(0);
      expect(await firstValueFrom(observeMissionItemCount(ctx.db, cobra.value.id))).toBe(1);
      const deleted = await ctx.db.get<MapItem>(Tables.mapItems).find(a.value.id);
      expect(deleted._raw._status).toBe('deleted');
      const views = await ctx.db.get<ItemViewState>(Tables.itemViewState).query().fetch();
      expect(views.map((v) => v.mapItemId)).toEqual([b.value.id]);
      const missionViews = await ctx.db.get<MissionViewState>(Tables.missionViewState).query().fetch();
      expect(missionViews.map((v) => v.missionId)).toEqual([cobra.value.id]);
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
      expect(await firstValueFrom(observeMissionItemCount(ctx.db, iron.value.id))).toBe(1);
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
});
