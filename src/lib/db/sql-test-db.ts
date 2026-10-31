import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';

import { type AppDb, fromPowerSync } from './app-db';
import { appSchema } from './powersync-schema';

const open: { db: PowerSyncDatabase; dir: string }[] = [];

/**
 * Fresh, empty database per call: PowerSync's Node SDK (the same core extension as on device) on a file in a new
 * temp folder. A file, not `:memory:`, because the SDK reads and writes through separate connections. Test use only;
 * the file needs `@jest-environment node`, and must call `closeSqlTestDbs()` after each test.
 */
export function createSqlTestDb(): AppDb {
  const dir = mkdtempSync(join(tmpdir(), 'rtap-db-'));
  const db = new PowerSyncDatabase({ schema: appSchema, database: { dbFilename: 'test.db', dbLocation: dir } });
  open.push({ db, dir });
  return fromPowerSync(db);
}

/** Closes every database `createSqlTestDb` opened (their worker threads keep Jest alive) and deletes the files. */
export async function closeSqlTestDbs(): Promise<void> {
  const all = open.splice(0);
  await Promise.all(
    all.map(async ({ db, dir }) => {
      await db.close();
      rmSync(dir, { recursive: true, force: true });
    }),
  );
}
