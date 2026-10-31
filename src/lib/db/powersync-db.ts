import { PowerSyncDatabase } from '@powersync/react-native';

import { type AppDb, fromPowerSync } from './app-db';
import { appSchema } from './powersync-schema';

/**
 * The app's on-device database (PowerSync over op-sqlite, local-only tables). Created on first call; PowerSync
 * initialises in the background and queries wait for it.
 */
export function createPowerSyncAppDb(): AppDb {
  return fromPowerSync(new PowerSyncDatabase({ schema: appSchema, database: { dbFilename: 'rtap.db' } }));
}
