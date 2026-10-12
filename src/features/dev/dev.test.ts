import { firstValueFrom } from 'rxjs';

import { observeMissionItems } from '@/features/map-items/repository';
import { pointCoord } from '@/features/map-items/geometry';
import { getMissionCamera } from '@/features/missions/repository';
import { makeTestContext } from '@/lib/db/test-database';
import { inverse } from '@/lib/geo/measure/geodesic';

import { PERF_SEED_CENTER, seedPerformanceMission } from './commands';

function seeded(seed: number) {
  // Deterministic LCG so the test is reproducible.
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('seedPerformanceMission', () => {
  it('creates a mission of stamped points inside the radius, with a camera on them', async () => {
    const ctx = makeTestContext();
    const r = await seedPerformanceMission(ctx, { count: 120, radiusM: 2000, random: seeded(1) });
    if (!r.ok) throw new Error(r.message);

    const items = await firstValueFrom(observeMissionItems(ctx.db, r.value.missionId));
    expect(items).toHaveLength(120);
    for (const item of items) {
      expect(inverse(PERF_SEED_CENTER, pointCoord(item.geometry)!).distanceM).toBeLessThanOrEqual(2000.001);
    }
    expect(new Set(items.map((i) => i.sidc)).size).toBeGreaterThan(1);
    expect(await getMissionCamera(ctx.db, r.value.missionId)).toEqual({ center: PERF_SEED_CENTER, zoom: 12, bearing: 0 });
  });

  it.each([[0], [-5], [1.5], [20001]])('rejects count %p', async (count) => {
    expect(await seedPerformanceMission(makeTestContext(), { count })).toMatchObject({ ok: false, error: 'invalid_count' });
  });
});
