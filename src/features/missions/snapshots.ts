import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { CommandContext } from '@/lib/db/command-context';
import { err, ok, type Result } from '@/lib/result';

import { recordMissionSnapshot } from './commands';
import { findMission, type MissionSnapshot } from './repository';
import { visibleRect, type MapArea } from './snapshot-crop';
import { deleteQuietly, snapshotDir, snapshotFile } from './snapshot-files';

export const SNAPSHOT_WIDTH = 720;
export const SNAPSHOT_QUALITY = 0.7;

const UNCOVERED: MapArea = { view: { width: 0, height: 0 }, panel: null };

/**
 * Crops away the part of a captured map image that was under an open panel (`area`), downscales it,
 * stores it as the mission's picture and records it. Never throws; 'covered' keeps the previous picture.
 */
export async function saveMissionSnapshot(
  ctx: CommandContext,
  missionId: string,
  sourceUri: string,
  area: MapArea = UNCOVERED,
): Promise<Result<MissionSnapshot, 'not_found' | 'covered' | 'write_failed'>> {
  try {
    // A capture can finish after the mission was deleted: do not bring back its row or file.
    if (!(await findMission(ctx.db, missionId))) return err('not_found', `No mission ${missionId}`);
    // Decode first: the crop is in this image's pixels, whatever the screen's size and density.
    const source = await ImageManipulator.manipulate(sourceUri).renderAsync();
    const rect = visibleRect(source, area);
    if (!rect) return err('covered', 'A panel covered almost all of the map');
    const context = ImageManipulator.manipulate(source);
    context.crop(rect);
    // Never enlarge a small visible part.
    context.resize({ width: Math.min(SNAPSHOT_WIDTH, rect.width), height: null });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: SNAPSHOT_QUALITY });
    snapshotDir().create({ intermediates: true, idempotent: true });
    const destination = snapshotFile(missionId);
    await new File(saved.uri).move(destination, { overwrite: true });
    const snapshot = { uri: destination.uri, takenAt: ctx.now() };
    const recorded = await recordMissionSnapshot(ctx, missionId, snapshot);
    if (!recorded.ok) {
      // Deleted while the picture was processed (or the write failed): leave no stray file.
      deleteQuietly(destination);
      return err(recorded.error, recorded.message);
    }
    return ok(snapshot);
  } catch (e) {
    return err('write_failed', String(e));
  } finally {
    deleteQuietly(new File(sourceUri));
  }
}
