import { pointGeometry } from '@/features/map-items/geometry';
import { createMission, saveMissionCamera } from '@/features/missions/commands';
import { PRESET_SIDCS } from '@/features/symbology/presets';
import type { CommandContext } from '@/lib/db/command-context';
import type { MapItem } from '@/lib/db/models/MapItem';
import { Tables } from '@/lib/db/schema';
import { destination } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';
import { err, ok, type Result } from '@/lib/result';

/** Development only: data for the map-performance check (spec §8.8 rule 6). */
export const PERF_SEED_CENTER: LatLon = { lat: 38.8977, lon: -77.0365 };
export const PERF_SEED_COUNT = 5000;
const MAX_COUNT = 20000;
const BATCH_SIZE = 500;

type SeedOptions = { count: number; center?: LatLon; radiusM?: number; random?: () => number; name?: string };

export async function seedPerformanceMission(
  ctx: CommandContext,
  { count, center = PERF_SEED_CENTER, radiusM = 5000, random = Math.random, name = `Perf ${count}` }: SeedOptions,
): Promise<Result<{ missionId: string }, 'invalid_count' | 'write_failed'>> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return err('invalid_count', `Count must be a whole number from 1 to ${MAX_COUNT}`);
  }
  const mission = await createMission(ctx, { name });
  if (!mission.ok) return err('write_failed', mission.message);
  const missionId = mission.value.id;
  const actor = ctx.actorId();

  try {
    for (let start = 0; start < count; start += BATCH_SIZE) {
      const end = Math.min(count, start + BATCH_SIZE);
      await ctx.db.write(async () => {
        const items = ctx.db.get<MapItem>(Tables.mapItems);
        const records: MapItem[] = [];
        for (let i = start; i < end; i++) {
          // sqrt keeps points evenly spread over the disc instead of bunched at the center.
          const coord = destination(center, random() * 360, radiusM * Math.sqrt(random()));
          records.push(
            items.prepareCreate((item) => {
              item.missionId = missionId;
              item.kind = 'point';
              item.geometry = pointGeometry(coord);
              item.sidc = PRESET_SIDCS[i % PRESET_SIDCS.length];
              item.name = `P-${i + 1}`;
              item.notes = null;
              item.style = null;
              item.createdBy = actor;
              item.updatedBy = actor;
            }),
          );
        }
        await ctx.db.batch(records);
      });
    }
  } catch (e) {
    return err('write_failed', String(e));
  }

  await saveMissionCamera(ctx, missionId, { center, zoom: 12, bearing: 0 });
  return ok({ missionId });
}
