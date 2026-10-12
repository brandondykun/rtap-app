import { getDeviceId } from '@/lib/identity/device-id';

import { getAppDatabase } from './app-database';
import type { CommandContext } from './command-context';

let instance: CommandContext | null = null;

/** The app's command context: on-device database, device identity, wall clock. */
export function getAppCommandContext(): CommandContext {
  instance ??= { db: getAppDatabase(), actorId: getDeviceId, now: Date.now };
  return instance;
}
