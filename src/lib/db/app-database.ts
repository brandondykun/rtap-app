import type { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { createDatabase } from './create-database';
import { migrations } from './migrations';
import { schema } from './schema';

let instance: Database | null = null;

/** The app's on-device database (SQLite over JSI). */
export function getAppDatabase(): Database {
  if (!instance) {
    instance = createDatabase(
      new SQLiteAdapter({
        schema,
        migrations,
        jsi: true,
        onSetUpError: (error) => console.error('[db] setup failed', error),
      }),
    );
  }
  return instance;
}
