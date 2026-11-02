import { Directory, File, Paths } from 'expo-file-system';

export function snapshotDir(): Directory {
  return new Directory(Paths.document, 'mission-snapshots');
}

/**
 * Where a mission's map picture taken at `takenAt` lives. Each picture gets its own name, so no image cache can show an
 * older one in its place (Android's caches a local file by its path); the mission's previous pictures are deleted.
 */
export function snapshotFile(missionId: string, takenAt: number): File {
  return new File(snapshotDir(), `${missionId}-${takenAt}.jpg`);
}

/** Removes a mission's pictures, all but `keep` if given (also one from before pictures were named by time). */
export function deleteMissionSnapshots(missionId: string, keep?: File): void {
  try {
    const dir = snapshotDir();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (!(entry instanceof File) || entry.uri === keep?.uri) continue;
      if (entry.name === `${missionId}.jpg` || entry.name.startsWith(`${missionId}-`)) deleteQuietly(entry);
    }
  } catch {
    // Best effort: a leftover file is harmless.
  }
}

export function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // Best effort: a leftover file is harmless.
  }
}
