import type { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import logger from '@nozbe/watermelondb/utils/common/logger';

import type { CommandContext } from './command-context';
import { createDatabase } from './create-database';
import { migrations } from './migrations';
import { schema } from './schema';

let counter = 0;

// Silence WatermelonDB's own "[Loki] ..." info logs in test output (test-only module).
logger.silence();

/** Fresh in-memory database per call. Test use only. */
export function createTestDatabase(): Database {
  counter += 1;
  return createDatabase(
    new LokiJSAdapter({
      schema,
      migrations,
      dbName: `test-${counter}`,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      extraLokiOptions: { autosave: false },
    }),
  );
}

export function makeTestContext(db: Database = createTestDatabase()): CommandContext {
  let t = 1_700_000_000_000;
  return { db, actorId: () => 'device-test', now: () => (t += 1000) };
}
