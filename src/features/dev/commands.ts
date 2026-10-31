import { pointGeometry } from '@/features/map-items/geometry';
import { createMission, saveMissionCamera } from '@/features/missions/commands';
import { PRESET_SIDCS } from '@/features/symbology/presets';
import type { CommandContext } from '@/lib/db/command-context';
import { insertRows, type SqlValue } from '@/lib/db/insert-rows';
import { newId } from '@/lib/db/new-id';
import { Tables } from '@/lib/db/schema';
import { destination } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';
import { err, ok, type Result } from '@/lib/result';

/** Development only: data for the map-performance check (spec §8.8 rule 6). */
export const PERF_SEED_CENTER: LatLon = { lat: 38.8977, lon: -77.0365 };
export const PERF_SEED_COUNT = 5000;
const MAX_COUNT = 20000;

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
  const now = ctx.now();
  const rows: Record<string, SqlValue>[] = [];
  for (let i = 0; i < count; i++) {
    // sqrt keeps points evenly spread over the disc instead of bunched at the center.
    const coord = destination(center, random() * 360, radiusM * Math.sqrt(random()));
    rows.push({
      id: newId(),
      mission_id: missionId,
      kind: 'point',
      geometry: pointGeometry(coord),
      sidc: PRESET_SIDCS[i % PRESET_SIDCS.length],
      name: `P-${i + 1}`,
      notes: null,
      style: null,
      elevation_m: null,
      threat_range_m: null,
      horizontal_range_m: null,
      vertical_range_ft: null,
      created_by: actor,
      updated_by: actor,
      created_at: now,
      updated_at: now,
    });
  }

  try {
    // One transaction; insertRows writes multi-row INSERTs of 500.
    await ctx.db.writeTransaction((tx) => insertRows(tx, Tables.mapItems, rows));
  } catch (e) {
    return err('write_failed', String(e));
  }

  await saveMissionCamera(ctx, missionId, { center, zoom: 12, bearing: 0 });
  return ok({ missionId });
}
