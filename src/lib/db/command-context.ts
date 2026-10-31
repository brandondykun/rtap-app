import type { AppDb } from './app-db';

/** Everything a command needs; injected so tests control identity and time. */
export type CommandContext = {
  db: AppDb;
  /** deviceId now, userId once accounts exist. Stamped on created_by / updated_by. */
  actorId: () => string;
  now: () => number;
};
