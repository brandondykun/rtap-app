import type { Database } from '@nozbe/watermelondb';

/** Everything a command needs; injected so tests control identity and time. */
export type CommandContext = {
  db: Database;
  /** deviceId now, userId once accounts exist. Stamped on created_by / updated_by. */
  actorId: () => string;
  now: () => number;
};
