import type { AppDb } from './app-db';
import { createPowerSyncAppDb } from './powersync-db';

let instance: AppDb | null = null;

/** The app's on-device database (PowerSync, local-only tables). */
export function getAppDatabase(): AppDb {
  if (!instance) {
    instance = createPowerSyncAppDb();
    // Queries wait for PowerSync's initialisation, so this first one rejects if setting up the database failed.
    instance.getOptional('SELECT 1').catch((error: unknown) => console.error('[db] setup failed', error));
  }
  return instance;
}
