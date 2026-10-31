import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';

import { type AppDb, fromPowerSync } from './app-db';
import { appSchema } from './schema';

const open: { db: PowerSyncDatabase; dir: string }[] = [];

function openDb(): AppDb {
  const dir = mkdtempSync(join(tmpdir(), 'rtap-db-'));
  // One read worker, not the default five: opening workers is most of a test database's cost.
  const db = new PowerSyncDatabase({ schema: appSchema, database: { dbFilename: 'test.db', dbLocation: dir, readWorkerCount: 1 } });
  open.push({ db, dir });
  return fromPowerSync(db);
}

/**
 * Fresh, empty database per call: PowerSync's Node SDK (the same core extension as on device) on a file in a new
 * temp folder. A file, not `:memory:`, because the SDK reads and writes through separate connections. Opened on
 * first use, so tests that never touch it (most screens get a context by default) do not pay for it. Test use only;
 * every database is closed after each test (registered below).
 */
export function createSqlTestDb(): AppDb {
  let db: AppDb | null = null;
  const get = () => (db ??= openDb());
  return {
    getAll: (sql, params) => get().getAll(sql, params),
    getOptional: (sql, params) => get().getOptional(sql, params),
    execute: (sql, params) => get().execute(sql, params),
    writeTransaction: (fn) => get().writeTransaction(fn),
    watch: (sql, params, tables) => get().watch(sql, params, tables),
  };
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

// Only test code imports this module, so it cleans up after every test itself instead of each test file doing it.
if (typeof afterEach === 'function') afterEach(closeSqlTestDbs);
