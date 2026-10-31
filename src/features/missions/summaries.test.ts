import { firstValueFrom } from 'rxjs';

import { placePoint } from '@/features/map-items/commands';
import { appSchema, Tables } from '@/lib/db/schema';
import { makeTestContext } from '@/lib/db/test-database';

import { createMission, markMissionOpened, saveMissionCamera } from './commands';
import { observeCountsByMission, observeMissionSummaries, parseCamera, parseSnapshot } from './repository';

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

describe('schema', () => {
  it('has a text snapshot column on mission_view_state', () => {
    const table = appSchema.tables.find((t) => t.name === Tables.missionViewState);
    expect(table?.columns.find((c) => c.name === 'snapshot')?.type).toBe('TEXT');
  });
});

describe('parseSnapshot / parseCamera', () => {
  it('parses valid JSON and rejects corrupt or invalid values', () => {
    expect(parseSnapshot(JSON.stringify({ uri: 'file:///a.jpg', takenAt: 5 }))).toEqual({ uri: 'file:///a.jpg', takenAt: 5 });
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('{not json')).toBeNull();
    expect(parseSnapshot(JSON.stringify({ uri: '', takenAt: 5 }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ uri: 'file:///a.jpg', takenAt: 'x' }))).toBeNull();
    const camera = { center: at, zoom: 12, bearing: 0 };
    expect(parseCamera(JSON.stringify(camera))).toEqual(camera);
    expect(parseCamera('nope')).toBeNull();
  });
});

describe('observeMissionSummaries', () => {
  it('includes the camera and snapshot (null when absent)', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    if (!iron.ok) throw new Error('setup');
    let list = await firstValueFrom(observeMissionSummaries(ctx.db));
    expect(list[0]).toMatchObject({ camera: null, snapshot: null });
    await markMissionOpened(ctx, iron.value.id);
    await saveMissionCamera(ctx, iron.value.id, { center: at, zoom: 12, bearing: 0 });
    list = await firstValueFrom(observeMissionSummaries(ctx.db));
    expect(list[0].camera).toEqual({ center: at, zoom: 12, bearing: 0 });
  });
});

describe('observeCountsByMission', () => {
  it('maps each mission id to its category counts, and is empty for no ids', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!iron.ok || !cobra.ok) throw new Error('setup');
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    const counts = await firstValueFrom(observeCountsByMission(ctx.db, [iron.value.id, cobra.value.id]));
    expect(counts.get(iron.value.id)).toEqual({ units: 1, points: 0, lines: 0, polygons: 0 });
    expect(counts.get(cobra.value.id)).toEqual({ units: 0, points: 0, lines: 0, polygons: 0 });
    expect((await firstValueFrom(observeCountsByMission(ctx.db, []))).size).toBe(0);
  });
});
