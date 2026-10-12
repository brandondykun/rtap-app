import type { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Platform } from 'react-native';

import { createDatabase } from './create-database';
import { migrations } from './migrations';
import { schema } from './schema';

let instance: Database | null = null;

/** The app's on-device database (SQLite; JSI on iOS). */
export function getAppDatabase(): Database {
  if (!instance) {
    instance = createDatabase(
      new SQLiteAdapter({
        schema,
        migrations,
        // Android JSI wiring is incompatible with RN 0.86 (JSIModulePackage removed); use the bridge there.
        jsi: Platform.OS === 'ios',
        onSetUpError: (error) => console.error('[db] setup failed', error),
      }),
    );
  }
  return instance;
}
