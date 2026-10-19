import { Directory, File, Paths } from 'expo-file-system';

export function snapshotDir(): Directory {
  return new Directory(Paths.document, 'mission-snapshots');
}

/** Where a mission's map picture lives (one per mission, overwritten on each capture). */
export function snapshotFile(missionId: string): File {
  return new File(snapshotDir(), `${missionId}.jpg`);
}

/** Removes a mission's picture; a missing file is not an error. */
export function deleteMissionSnapshot(missionId: string): void {
  deleteQuietly(snapshotFile(missionId));
}

export function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // Best effort: a leftover file is harmless.
  }
}
