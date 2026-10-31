import type { AppDb } from './app-db';
import type { CommandContext } from './command-context';
import { createSqlTestDb } from './sql-test-db';

/** Fresh, empty database per call (SQLite through PowerSync's Node SDK; closed after each test). Test use only. */
export function createTestDatabase(): AppDb {
  return createSqlTestDb();
}

export function makeTestContext(db: AppDb = createTestDatabase()): CommandContext {
  let t = 1_700_000_000_000;
  return { db, actorId: () => 'device-test', now: () => (t += 1000) };
}
