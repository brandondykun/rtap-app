import type { CommandContext } from '@/lib/db/command-context';

import { markMissionOpened } from './commands';
import { findMission, getMissionCamera, type MissionCamera } from './repository';

export type OpenMissionResult = { status: 'missing' } | { status: 'ready'; name: string; camera: MissionCamera | null };

/** Loads what the map needs before it mounts (so a saved camera applies without a jump). */
export async function openMission(ctx: CommandContext, missionId: string): Promise<OpenMissionResult> {
  try {
    const mission = await findMission(ctx.db, missionId);
    if (!mission) return { status: 'missing' };
    const camera = await getMissionCamera(ctx.db, missionId);
    const opened = await markMissionOpened(ctx, missionId);
    if (!opened.ok) console.warn('[missions] could not record last opened', opened.message);
    return { status: 'ready', name: mission.name, camera };
  } catch (e) {
    console.warn('[missions] open failed', e);
    return { status: 'missing' };
  }
}
