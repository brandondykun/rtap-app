import { PowerSyncDatabase } from '@powersync/react-native';

import { type AppDb, fromPowerSync } from './app-db';
import { appSchema } from './schema';

let instance: AppDb | null = null;

/**
 * The app's on-device database (PowerSync over op-sqlite, local-only tables). Created on the first call, then the
 * same instance every time; PowerSync initialises in the background and queries wait for it.
 */
export function createPowerSyncAppDb(): AppDb {
  if (!instance) {
    instance = fromPowerSync(new PowerSyncDatabase({ schema: appSchema, database: { dbFilename: 'rtap.db' } }));
  }
  return instance;
}
