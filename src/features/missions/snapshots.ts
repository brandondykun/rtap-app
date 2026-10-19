import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { CommandContext } from '@/lib/db/command-context';
import { err, ok, type Result } from '@/lib/result';

import { recordMissionSnapshot } from './commands';
import { findMission, type MissionSnapshot } from './repository';
import { deleteQuietly, snapshotDir, snapshotFile } from './snapshot-files';

export const SNAPSHOT_WIDTH = 720;
export const SNAPSHOT_QUALITY = 0.7;

/** Downscales a captured map image, stores it as the mission's picture and records it. Never throws. */
export async function saveMissionSnapshot(
  ctx: CommandContext,
  missionId: string,
  sourceUri: string,
): Promise<Result<MissionSnapshot, 'not_found' | 'write_failed'>> {
  // A capture can finish after the mission was deleted: do not bring back its row or file.
  if (!(await findMission(ctx.db, missionId))) return err('not_found', `No mission ${missionId}`);
  try {
    const context = ImageManipulator.manipulate(sourceUri);
    context.resize({ width: SNAPSHOT_WIDTH, height: null });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: SNAPSHOT_QUALITY });
    snapshotDir().create({ intermediates: true, idempotent: true });
    const destination = snapshotFile(missionId);
    await new File(saved.uri).move(destination, { overwrite: true });
    const snapshot = { uri: destination.uri, takenAt: ctx.now() };
    const recorded = await recordMissionSnapshot(ctx, missionId, snapshot);
    if (!recorded.ok) return err('write_failed', recorded.message);
    return ok(snapshot);
  } catch (e) {
    return err('write_failed', String(e));
  } finally {
    deleteQuietly(new File(sourceUri));
  }
}
