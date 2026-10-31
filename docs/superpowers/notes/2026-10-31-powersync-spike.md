# PowerSync spike — 2026-10-31

**Verdict: PASS.** PowerSync opens, writes, watches and persists on iOS and Android release builds (Expo SDK 57, RN 0.86.3,
New Architecture, Hermes, Android R8 on), and `expo-sqlite` still builds alongside it. The spike branch
(`spike/powersync`) is deleted. This file holds everything Task 2 needs to set it up again.

## Device results (EAS `preview` profile = release builds)

All times in ms. iPhone columns: first run / warm "Run again" / after kill and relaunch.

| Measure | iPhone (first) | iPhone (warm) | iPhone (relaunch) | Pixel 7a | Limit |
|---|---|---|---|---|---|
| `open+init` | 36.9 | 9.1 | 29.7 | — | — |
| insert 5,000 rows (chunks of 500, one `writeTransaction`) | 56.0 | — | — | — | — |
| plain `getAll` of 5,000 rows | 21.2 | 52.2 | 28.8 | — | — |
| first `watch` result (5,000 rows) | 21.9 | 28.1 | 22.5 | 63.5 | < 100 |
| re-emission after a 1-row `UPDATE` | 62.6 | 63.6 | 54.9 | **97.1** | < 100 |
| 5,000 rows still there after relaunch, no crash | yes | | yes | yes | |

The Pixel 7a was a real device running a release build with R8 on.

- **Android re-emission is close to the limit (97.1 ms).** The spike re-ran `SELECT *` over all 5,000 rows and every
  column. The app will do the same once per save. Measure it again in the real app in Task 5 (open the perf mission,
  save an edit, check for a hitch). If it is too slow, ways to bring it down: watch fewer columns, raise `throttleMs`,
  or patch the in-memory list on save instead of re-querying.
- The re-emission times include PowerSync's default 30 ms watch throttle (`throttleMs`, left at its default).

## Packages

Install with `npx expo install @powersync/react-native @op-engineering/op-sqlite` (Expo picks op-sqlite 18.x). Add the
test dev dependencies with `npm install -D @powersync/node@^1.2.0 better-sqlite3@^12`.

package.json entries (resolved versions in brackets):

```jsonc
// dependencies
"@op-engineering/op-sqlite": "^18.2.5",   // [18.2.5]
"@powersync/react-native": "^2.3.3",      // [2.3.3] → @powersync/common 2.4.0, @powersync/react 2.1.0, @powersync/shared-internals 1.4.0
// devDependencies
"@powersync/node": "^1.2.0",              // [1.2.0] Jest only
"better-sqlite3": "^12.11.1",             // [12.11.1] Jest only; the driver @powersync/node loads in its worker
```

The spike also installed `@types/better-sqlite3@^9.6.0`, but it is not needed unless a test imports `better-sqlite3`
directly.

- **Keep op-sqlite on `^18`.** `@powersync/react-native@2.3.3` requires `@op-engineering/op-sqlite >=17.1.0 <19.0.0`
  as a peer, while op-sqlite's `latest` tag is 19.0.3. Do not upgrade it to 19 until PowerSync widens that range.
- **Adapter.** The PowerSync docs (Oct 2026) recommend op-sqlite for Expo dev builds. `@powersync/react-native` ships the
  PowerSync core SQLite extension itself (iOS pod `powersync-sqlite-core` 0.5.4, Android
  `com.powersync:powersync-sqlite-core:0.5.3`) and loads it automatically, so no `getDylibPath` or extension code is
  needed. Alternatives looked at and not used:
  - `@powersync/adapter-sql-js`: pure JS, for Expo Go only.
  - `@journeyapps/react-native-quick-sqlite`: the older adapter, now superseded.
  - the standalone `@powersync/op-sqlite`: now part of `@powersync/react-native` 2.x.

## Expo / native config

- No config plugin is needed for PowerSync or op-sqlite (both autolink), and no `"op-sqlite"` block in package.json
  (that block is only for SQLCipher or FTS).
- Metro and Babel need no changes. Expo's default Metro config works without the inline-requires blocklist the README
  mentions for bare RN.
- `expo-sqlite` stays (it backs `expo-sqlite/kv-store`). `prebuild --clean` produces ExpoSQLite 57.0.4, op-sqlite 18.2.5
  and powersync-react-native 2.3.3 side by side. Both ExpoSQLite and op-sqlite compile their own `sqlite3.c`, but the
  EAS iOS build linked without duplicate-symbol errors. On Android each library is its own `.so`.
- **R8.** This project does not turn on minification today (`android.enableMinifyInReleaseBuilds` defaults to false in
  the Expo template). The spike turned it on to test PowerSync under R8, by adding
  `"enableMinifyInReleaseBuilds": true` under `expo-build-properties` → `android` in app.json. The release build ran
  fine with it, and no ProGuard keep rules were needed. Task 2 does not have to keep it on; whether to ship R8 is a
  separate decision.
- The spike also added `"android": { "buildType": "apk" }` to the `preview` profile in eas.json so the build could be
  installed directly. That change is not needed for Tasks 2–5.

## Polyfills

None needed. The app uses `init`, `execute`, `get`/`getAll`, `writeTransaction`, and the **callback** form of
`watch(sql, params, { onResult, onError }, { signal, tables?, throttleMs? })`, with an `AbortController` signal (React
Native provides `AbortController`). Only the async-iterator form of `watch` (and `getCrudTransactions()`) needs
`@azure/core-asynciterator-polyfill` imported at app entry plus `@babel/plugin-transform-async-generator-functions`.
Use the callback form and skip both. The device runs showed no runtime polyfill errors.

## Usage that worked on device (spike code, for reference)

```ts
import { column, PowerSyncDatabase, Schema, Table } from '@powersync/react-native';

const map_items = new Table(
  {
    mission_id: column.text, kind: column.text, geometry: column.text, sidc: column.text, name: column.text,
    notes: column.text, style: column.text, elevation_m: column.real, threat_range_m: column.real,
    horizontal_range_m: column.real, vertical_range_ft: column.real, created_by: column.text, updated_by: column.text,
    created_at: column.integer, updated_at: column.integer,
  },
  { localOnly: true, indexes: { mission: ['mission_id'], kind: ['kind'] } },
);
const db = new PowerSyncDatabase({ schema: new Schema({ map_items }), database: { dbFilename: 'ps-spike.db' } });
await db.init();

// Seed: one writeTransaction, multi-row INSERTs of 500 rows (16 columns incl. `id` → 8,000 bound params per statement).
await db.writeTransaction(async (tx) => {
  await tx.execute(`INSERT INTO map_items (id, mission_id, …) VALUES (?,?,…),(?,?,…)…`, params);
});

const ac = new AbortController();
db.watch('SELECT * FROM map_items WHERE mission_id = ?', [missionId], {
  onResult: (res) => res.rows?._array ?? [],
  onError: (e) => {},
}, { signal: ac.signal });
// unsubscribe: ac.abort()
```

- `id` is implicit (PowerSync adds it as a text column). Column types are `text`, `integer` and `real` only, so booleans
  are stored as 0/1 integers.
- `db.get(sql, params)` returns one row (it throws if there is none). `db.getAll` returns an array. Use
  `res.rows?._array` (or `res.rows.length`) on watch results.

## Jest route — decision: PowerSync Node SDK under `jest-expo`

`@powersync/node` runs under the project's `jest-expo` preset when the test file uses the `node` environment. Its
default driver is `better-sqlite3` in a worker thread with **the real PowerSync core extension loaded**. It ships macOS,
Linux and Windows binaries, so local-only tables and views, `writeTransaction` and `watch` behave as they do on device.
The scratch test passed 7 out of 7 runs, including with `--no-cache` and `--detectOpenHandles` (no open handles after
`db.close()`). The full suite (169 suites) still passed with this config. There is no need for the hand-rolled
`better-sqlite3` fallback.

### Exact Jest config (package.json `jest`)

```jsonc
"transformIgnorePatterns": [
  // existing allowlist + "@powersync/.*|comlink|" (both ship ESM only)
  "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@nozbe/.*|@powersync/.*|comlink|@rnmapbox/.*|nativewind|react-native-css-interop|geographiclib-geodesic|mgrs|geomagnetism|milsymbol)"
],
"moduleNameMapper": {
  "^(.*/assets/map/label-chip(?:-accent|-square)?)\\.png$": "$1@3x.png",
  // @powersync/node only exports the "import"/"module-sync" conditions, which Jest's CJS resolver can't see.
  "^@powersync/node$": "<rootDir>/node_modules/@powersync/node/lib/index.js"
}
```

(Once Task 4 removes WatermelonDB, `@nozbe/.*` can come out of the allowlist.)

### Scratch test that passed (setup to reuse for `createSqlTestDb`)

```ts
/**
 * @jest-environment node
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { column, PowerSyncDatabase, Schema, Table } from '@powersync/node';

const schema = new Schema({
  map_items: new Table({ mission_id: column.text, name: column.text, updated_at: column.integer }, { localOnly: true }),
});

let dir: string;
let db: PowerSyncDatabase;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ps-jest-'));
  db = new PowerSyncDatabase({ schema, database: { dbFilename: 'test.db', dbLocation: dir } });
  await db.init();
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('open, writeTransaction, watch', async () => {
  await db.writeTransaction(async (tx) => {
    for (let i = 0; i < 3; i++) {
      await tx.execute('INSERT INTO map_items (id, mission_id, name, updated_at) VALUES (?, ?, ?, ?)', [`i${i}`, 'm1', `n${i}`, i]);
    }
  });
  const seen: number[] = [];
  const ac = new AbortController();
  await new Promise<void>((resolve, reject) => {
    db.watch('SELECT * FROM map_items WHERE mission_id = ?', ['m1'], {
      onResult: (r) => {
        seen.push(r.rows?.length ?? -1);
        if (seen.length === 1) void db.execute("INSERT INTO map_items (id, mission_id, name, updated_at) VALUES ('i9','m1','x',9)");
        if (seen.length === 2) resolve();
      },
      onError: reject,
    }, { signal: ac.signal });
  });
  ac.abort();
  expect(seen).toEqual([3, 4]); // once on subscribe, once after the committed write

  await expect(db.writeTransaction(async (tx) => {
    await tx.execute("INSERT INTO map_items (id, mission_id, name, updated_at) VALUES ('r1','m1','x',1)");
    throw new Error('boom');
  })).rejects.toThrow('boom');
  expect((await db.get<{ n: number }>('SELECT count(*) n FROM map_items')).n).toBe(4); // rolled back
});
```

Notes:
- **Import split.** Tests import `PowerSyncDatabase`, `Schema`, `Table` and `column` from `@powersync/node`; app code
  imports them from `@powersync/react-native`. Both re-export `@powersync/common` (2.4.0, deduped), so the schema and
  the `AbstractPowerSyncDatabase`/`Transaction` types are the same. Define the schema once, importing from
  `@powersync/common`, and share it between app and tests.
- **Builds unaffected.** `import.meta.url` inside `@powersync/node` is handled by babel-preset-expo with no extra
  plugin. Its worker files run as native Node ESM outside Jest's transform. The app bundle never imports
  `@powersync/node`.
- **Cold-cache timeouts.** The first cold run spends about 15 s transforming `@powersync/common`. One cold, fully
  parallel run of the whole suite timed out in several heavy suites (including the db test); every warm run passed. If
  CI starts cold, give db-test `beforeEach` a longer timeout.
- **CI binaries.** CI needs `better-sqlite3`'s prebuilt binary. Node 24 on macOS arm64 installed it fine, and Linux
  prebuilds exist.

## Surprises and build traps

- **Local iOS builds are impossible on this Mac.** Expo SDK 57 needs Xcode 26.4 or later (`expo-doctor` says so, and
  `expo-modules-jsi`'s `Package.swift` needs Swift tools 6.2). The Mac has Xcode 16.2. Build iOS on EAS.
- **Don't attempt local native builds in later tasks.** The local Android release build stopped for lack of disk space:
  it auto-installed NDK 27.1.12297006 (for RN 0.86) and NDK 27.0.12077973 (for expo-updates), about 2.4 GB each, plus
  about 4 GB of Gradle cache. Use EAS for both platforms.
- **Fingerprint trap.** The first EAS builds failed with "Runtime version calculated on local machine not equal…". The
  aborted local Gradle build had left `android/build` and `.cxx` folders inside `node_modules` packages, plus a
  generated `android/` folder, and these changed the local fingerprint (`runtimeVersion.policy: fingerprint`). Fix:
  delete `android/` (and `ios/`), then `rm -rf node_modules && npm ci`, then build again.
- **Commands used:** `npx eas-cli@latest build --profile preview --platform ios` and `--platform android`. Both are
  release builds, internal distribution.
