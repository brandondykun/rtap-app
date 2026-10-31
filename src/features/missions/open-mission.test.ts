import { makeTestContext } from '@/lib/db/test-database';

import { createMission, saveMissionCamera } from './commands';
import { openMission } from './open-mission';
import { findMissionViewState } from './repository';

describe('openMission', () => {
  it('reports unknown missions as missing', async () => {
    expect(await openMission(makeTestContext(), 'nope')).toEqual({ status: 'missing' });
  });

  it('reports deleted missions as missing', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Gone' });
    if (!r.ok) throw new Error('setup');
    await ctx.db.execute('DELETE FROM missions WHERE id = ?', [r.value.id]);
    expect(await openMission(ctx, r.value.id)).toEqual({ status: 'missing' });
  });

  it('returns the saved camera and marks the mission opened', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const camera = { center: { lat: 38.9, lon: -77 }, zoom: 13, bearing: 10 };
    await saveMissionCamera(ctx, r.value.id, camera);

    expect(await openMission(ctx, r.value.id)).toEqual({ status: 'ready', name: 'Op Iron', camera });
    expect((await findMissionViewState(ctx.db, r.value.id))?.lastOpenedAt).toBeGreaterThan(0);
  });

  it('returns a null camera for a new mission', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op New' });
    if (!r.ok) throw new Error('setup');
    expect(await openMission(ctx, r.value.id)).toEqual({ status: 'ready', name: 'Op New', camera: null });
  });
});
