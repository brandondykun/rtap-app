import { Q } from '@nozbe/watermelondb';
import { firstValueFrom } from 'rxjs';

import type { MapItem } from '@/lib/db/models/MapItem';
import type { MissionViewState } from '@/lib/db/models/MissionViewState';
import { Tables } from '@/lib/db/schema';
import { makeTestContext } from '@/lib/db/test-database';

import { createMission, markMissionOpened, saveMissionCamera } from './commands';
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
});
