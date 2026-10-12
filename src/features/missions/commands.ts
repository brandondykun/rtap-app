import type { CommandContext } from '@/lib/db/command-context';
import type { Mission } from '@/lib/db/models/Mission';
import type { MissionViewState } from '@/lib/db/models/MissionViewState';
import { Tables } from '@/lib/db/schema';
import { err, ok, type Result } from '@/lib/result';

import { findMissionViewState, isValidCamera, type MissionCamera } from './repository';

export async function createMission(
  ctx: CommandContext,
  input: { name: string },
): Promise<Result<{ id: string }, 'invalid_name' | 'write_failed'>> {
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Mission name is required');
  try {
    const mission = await ctx.db.write(() =>
      ctx.db.get<Mission>(Tables.missions).create((m) => {
        m.name = name;
        m.createdBy = ctx.actorId();
      }),
    );
    return ok({ id: mission.id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

async function upsertViewState(
  ctx: CommandContext,
  missionId: string,
  apply: (state: MissionViewState) => void,
): Promise<void> {
  await ctx.db.write(async () => {
    const existing = await findMissionViewState(ctx.db, missionId);
    if (existing) {
      await existing.update(apply);
    } else {
      await ctx.db.get<MissionViewState>(Tables.missionViewState).create((s) => {
        s.missionId = missionId;
        s.lastOpenedAt = ctx.now();
        s.camera = null;
        apply(s);
      });
    }
  });
}

export async function markMissionOpened(ctx: CommandContext, missionId: string): Promise<Result<void, 'write_failed'>> {
  try {
    await upsertViewState(ctx, missionId, (s) => {
      s.lastOpenedAt = ctx.now();
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function saveMissionCamera(
  ctx: CommandContext,
  missionId: string,
  camera: MissionCamera,
): Promise<Result<void, 'invalid_camera' | 'write_failed'>> {
  if (!isValidCamera(camera)) return err('invalid_camera', 'Camera values must be finite numbers');
  try {
    await upsertViewState(ctx, missionId, (s) => {
      s.camera = JSON.stringify(camera);
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
