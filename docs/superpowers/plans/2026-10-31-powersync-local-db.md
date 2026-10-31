# Replace WatermelonDB with PowerSync (local-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app stores its data in PowerSync's on-device SQLite (local-only tables) instead of WatermelonDB, with no visible change.

**Architecture:** An app-owned SQL seam (`AppDb` in `src/lib/db`) wraps a `PowerSyncDatabase` in the app and a Node SQLite in Jest. Repositories and commands are rewritten on SQL behind their existing exported functions, so the UI, which reads RxJS observables, is untouched. WatermelonDB and its build workarounds are removed at the end.

**Tech Stack:** Expo SDK 57, React Native 0.86.3 (New Architecture, Hermes), `@powersync/react-native` + its native SQLite adapter (exact set from Task 1), RxJS, Jest (`jest-expo`).

**Spec:** `docs/superpowers/specs/2026-10-31-powersync-local-db-design.md` (read it first; its "Settled details" are binding).

## Global Constraints

- Wiping local data is fine: no migration from WatermelonDB, no compatibility code, no cleanup of the old file.
- No sync, no PowerSync service, no network, no accounts. All four tables are `localOnly: true`.
- No UI or behaviour change. Exported repository and command functions keep their names, parameters and results.
- Commands are the only write path; repositories are the only readers; the UI never imports the database library (ESLint enforces it for `@powersync/*`).
- Table and column names stay exactly as today: `missions`, `map_items`, `item_view_state`, `mission_view_state`, same snake_case columns.
- Ids stay UUIDv4 from `expo-crypto` `randomUUID()`.
- Timestamps are ms numbers everywhere outside SQL; booleans are 0/1 in SQL and `boolean` outside.
- `expo-sqlite` stays (it backs `expo-sqlite/kv-store`).
- The repo is not prettier-formatted: never run `prettier --write` on whole files. Semantic tokens only; `active:opacity-60` on every Pressable (no UI is expected to change).
- Never add Co-Authored-By or any other trailer to commits.

## Review Focus

1. Bulk writes (hiding 100 selected items at once): one transaction, and `observeHiddenItemIds` emits once for it, not 100 times. Pinned in Task 3.
2. Deleting a mission: its items and view state go in the same transaction, and an open `observeMissionItems` emits `[]`. Pinned in Task 3.
3. A row of a kind this app doesn't know (from a newer version) is never returned by `observeMissionItems` / `observeItem`. Pinned in Task 3.
4. Optional columns round-trip as `null` (never `undefined`, never the string "null"), and text with quotes (`O'Brien "2"`) round-trips intact through parameter binding. Pinned in Task 3.
5. A development device that still has the old WatermelonDB file launches cleanly on the new build and shows an empty missions list. Pinned in Task 5 (device check).

---

### Task 1: Spike — PowerSync on this build (throwaway)

Proves the spec's gate before any real code. Work on a throwaway branch `spike/powersync` off `feat/powersync`; only the notes file comes back.

**Files:**
- Create (kept): `docs/superpowers/notes/2026-10-31-powersync-spike.md`
- Everything else on `spike/powersync` is thrown away.

**Interfaces:**
- Produces for Tasks 2–5, in the notes: the exact npm packages and versions installed, the Expo config (plugins, `expo-build-properties` if any), Hermes polyfills required and where they are imported, the Jest route chosen (PowerSync Node SDK under `jest-expo`, or `better-sqlite3`) with the exact jest config needed, and the measured numbers.

- [ ] **Step 1:** On `spike/powersync`, install `@powersync/react-native` and the adapter PowerSync currently recommends for Expo development builds (check docs.powersync.com at the time; note alternatives considered). Add any required config plugin and polyfills.
- [ ] **Step 2:** Add a temporary dev screen (or a block in the existing dev tools) that opens a `PowerSyncDatabase` with one `localOnly` table `map_items` (columns as in `src/lib/db/schema.ts`), inserts 5,000 rows in chunks of 500 in one `writeTransaction`, `watch`es `SELECT * FROM map_items WHERE mission_id = ?`, and logs: time to insert, time for the first watch result, time for a re-emission after updating one row.
- [ ] **Step 3:** Confirm `npx expo prebuild --clean` and an iOS build succeed, and an **Android release** build (`npx expo run:android --variant release`, R8 on) compiles. Confirm `expo-sqlite` still builds alongside.
- [ ] **Step 4:** The user runs the iOS dev build on device (and Android emulator/device if available) and reports the logged numbers. Pass: first watch result for 5,000 rows under 100 ms after open, re-emission after a one-row update under 100 ms, no crash on relaunch, data persists across relaunch.
- [ ] **Step 5:** Jest route: in a scratch test file, try PowerSync's Node SDK (`@powersync/node`) under the project's `jest-expo` preset (or a `testEnvironment: node` override for db tests only). If it opens an in-memory/temp database, runs `writeTransaction` and `watch` reliably, choose it; otherwise choose `better-sqlite3`. Record the choice and config.
- [ ] **Step 6:** Write the notes file (packages, config, polyfills, Jest route, numbers, any surprises). If Step 3 or 4 fails, stop here and report to the user: the plan does not continue.
- [ ] **Step 7:** Commit the notes on `feat/powersync`; delete `spike/powersync`.

```bash
git add docs/superpowers/notes/2026-10-31-powersync-spike.md
git commit -m "docs: PowerSync spike results"
```

### Task 2: The `AppDb` seam, PowerSync schema and test database (not yet wired)

Built beside WatermelonDB; nothing uses it yet, so the app and suite stay green.

**Files:**
- Create: `src/lib/db/app-db.ts`, `src/lib/db/powersync-schema.ts`, `src/lib/db/powersync-db.ts`, `src/lib/db/sql-test-db.ts`, `src/lib/db/new-id.ts`
- Test: `src/lib/db/app-db.test.ts`
- Modify: `package.json` (packages from Task 1), `app.json` (plugins from Task 1), app entry for polyfills (from Task 1), Jest config (from Task 1)

**Interfaces:**
- Produces (`app-db.ts`):
  ```ts
  export type SqlParams = readonly (string | number | null)[];
  export type AppDbTx = {
    getAll<T>(sql: string, params?: SqlParams): Promise<T[]>;
    getOptional<T>(sql: string, params?: SqlParams): Promise<T | null>;
    execute(sql: string, params?: SqlParams): Promise<void>;
  };
  export type AppDb = AppDbTx & {
    writeTransaction<R>(fn: (tx: AppDbTx) => Promise<R>): Promise<R>;
    watch<T>(sql: string, params: SqlParams, tables: readonly string[]): Observable<T[]>;
  };
  ```
- Produces (`powersync-schema.ts`): `Tables` (same object as today's `schema.ts` exports) and `appSchema` (PowerSync `Schema`, four `localOnly` tables, indexes `map_items(mission_id)`, `map_items(kind)`, `item_view_state(map_item_id)`, `mission_view_state(mission_id)`).
- Produces: `createPowerSyncAppDb(): AppDb` (`powersync-db.ts`, wraps one lazily created `PowerSyncDatabase`; `watch` adapts PowerSync's watch to an RxJS `Observable`, unsubscribing closes it); `createSqlTestDb(): AppDb` (`sql-test-db.ts`, fresh in-memory database per call, same schema, via the Task 1 Jest route); `newId(): string` (`new-id.ts`, `Crypto.randomUUID()`).

- [ ] **Step 1: Write the failing tests** in `app-db.test.ts`, run against `createSqlTestDb()`:
  - `it('round-trips a row with nulls and quotes')`: insert a `map_items` row with `notes = null`, `name = "O'Brien \"2\""`; `getOptional` returns it with `notes === null` and the exact name.
  - `it('watch emits on subscribe and after a write to a watched table')`: subscribe to `SELECT id FROM map_items WHERE mission_id = ?` watching `['map_items']`; first emission `[]`; after an insert, an emission with one row.
  - `it('watch does not re-run for writes to tables it does not watch')`: the same watch; an insert into `item_view_state` causes no new emission (use `waitFor` / a short wait, then assert emission count unchanged).
  - `it('a throwing writeTransaction rolls back every write')`: two inserts then a throw; table is empty after.
  - `it('one transaction of 100 writes emits once')`: watch `item_view_state`; 100 inserts in one `writeTransaction`; exactly one new emission.
  - `it('newId makes UUIDv4s')`: matches `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`.
- [ ] **Step 2:** Run `npx jest src/lib/db/app-db.test.ts` — FAIL (modules missing).
- [ ] **Step 3:** Implement the files above. Column types: strings → `column.text`; `created_at`, `updated_at`, `last_opened_at`, `hidden`, `show_ring` → `column.integer`; `elevation_m`, `threat_range_m`, `horizontal_range_m`, `vertical_range_ft` → `column.real`. `createPowerSyncAppDb` is not called anywhere yet.
- [ ] **Step 4:** `npx jest src/lib/db/app-db.test.ts` PASS; `npx tsc --noEmit`, `npx eslint src/lib/db`, full `npx jest` all green.
- [ ] **Step 5: Commit** — `git commit -m "feat: AppDb seam over PowerSync, with a SQLite test database"`

### Task 3: Move the data layer onto `AppDb`

One cohesive switch: the command context, both features' repositories and commands, the dev seed, and the tests that touched WatermelonDB directly. WatermelonDB packages stay installed until Task 4 but nothing imports them after this task.

**Files:**
- Modify: `src/lib/db/command-context.ts` (`db: AppDb`), `src/lib/db/app-database.ts` (`getAppDatabase(): AppDb` via `createPowerSyncAppDb`, still sync and lazy), `src/lib/db/test-database.ts` (`createTestDatabase(): AppDb` = `createSqlTestDb()`; `makeTestContext` unchanged otherwise), `src/lib/db/sync-config.ts` (import `Tables` from `powersync-schema`)
- Rewrite: `src/features/missions/repository.ts`, `src/features/missions/commands.ts`, `src/features/map-items/repository.ts`, `src/features/map-items/commands.ts`, `src/features/dev/commands.ts`
- Delete: `src/lib/db/models/*`, `src/lib/db/migrations.ts`, `src/lib/db/create-database.ts`, `src/lib/db/ids.ts`, old `src/lib/db/schema.ts` (rename `powersync-schema.ts` → `schema.ts` and fix imports)
- Rewrite test: `src/lib/db/db.test.ts` (UUID ids; every table classified synced/local in `sync-config`; every column of the old schema present in `appSchema`; view-state tables local)
- Modify tests (direct WatermelonDB use → `ctx.db.execute` with SQL): `src/features/missions/missions.test.ts`, `src/features/missions/open-mission.test.ts`, `src/features/map-items/map-items.test.ts`, `src/features/map-items/menus/EditPolygonMenu.test.tsx`, `EditLineMenu.test.tsx`, `EditUnitMenu.test.tsx`

**Interfaces:**
- Consumes: Task 2's `AppDb`, `Tables`, `newId`, `createPowerSyncAppDb`, `createSqlTestDb`.
- Produces (record types, exported from the repositories, replacing the model classes):
  ```ts
  // map-items/repository.ts
  export type MapItemRecord = { id: string; missionId: string; kind: MapItemKind; geometry: string; sidc: string | null;
    name: string; notes: string | null; style: string | null; elevationM: number | null; threatRangeM: number | null;
    horizontalRangeM: number | null; verticalRangeFt: number | null; createdBy: string; updatedBy: string;
    createdAt: number; updatedAt: number };
  export type ItemViewStateRecord = { id: string; mapItemId: string; hidden: boolean; showRing: boolean | null; updatedAt: number };
  // missions/repository.ts
  export type MissionRecord = { id: string; name: string; createdBy: string; createdAt: number; updatedAt: number };
  export type MissionViewStateRecord = { id: string; missionId: string; lastOpenedAt: number; camera: string | null; snapshot: string | null; updatedAt: number };
  ```
  `MapItemKind` and `MAP_ITEM_KINDS` move from the deleted model into `map-items/repository.ts` (re-export where imported today). `findItem` → `MapItemRecord | null`, `findItemViewState` → `ItemViewStateRecord | null`, `findMission` → `MissionRecord | null`, `findMissionViewState` → `MissionViewStateRecord | null`. Every other exported function keeps its signature with `db: AppDb` in place of `Database`.

- [ ] **Step 1: Write the new failing tests** (Review Focus 1–4), in `src/features/map-items/map-items.test.ts` unless noted:
  - `it('hiding 100 items is one write the hidden-ids list sees once')`: place 100 points; subscribe to `observeHiddenItemIds`; after the initial emission, `setItemsHidden(ctx, ids, true)`; `waitFor` the list to have 100 ids; assert exactly one emission after the initial one.
  - `it('never returns an item of an unknown kind')`: `ctx.db.execute` an `INSERT` into `map_items` with `kind = 'circle'` in the mission; `observeMissionItems` first emission excludes it and `observeItem(ctx.db, thatId)` emits `null`.
  - `it('keeps null notes null and quoted names intact')`: `placePoint` with `name: "O'Brien \"2\""`, no notes; `findItem` returns `notes === null`, `sidc` as given, exact name.
  - In `src/features/missions/missions.test.ts`: `it('deleting a mission empties its open items list and removes its view state')`: mission with 3 items, hide one, `markMissionOpened`; subscribe to `observeMissionItems`; `deleteMission`; `waitFor` emission `[]`; `findMissionViewState` and `findItemViewState(...)` are `null`; `SELECT COUNT(*) FROM map_items` is 0.
- [ ] **Step 2:** Run them — FAIL (they need the new layer; some will not compile).
- [ ] **Step 3: Rewrite** the repositories and commands on `AppDb`:
  - Every `observe*` uses `db.watch(sql, params, tables)` with only the tables its SQL reads, maps rows to the existing outputs, and ends in `distinctUntilChanged` keyed on what callers render (items: `id` + `updated_at` per row, in order; id lists: joined ids; counts: the four numbers; summaries: id + name + last_opened_at + camera + snapshot per row).
  - `observeMissionCategoryCounts` becomes one `SELECT` with `SUM(CASE ...)` per category (units = points whose `sidc` is not a point-type SIDC — keep today's rule, which counts `kind = 'point'` minus point-type SIDCs).
  - Commands: every multi-row change in one `writeTransaction`; inserts set every column (`created_at`/`updated_at` from `ctx.now()`, `created_by`/`updated_by` from `ctx.actorId()`, `id` from `newId()`); updates set `updated_at = ctx.now()`; deletes are `DELETE`s (mission delete also deletes its `map_items`, their `item_view_state`, and its `mission_view_state`). Reads inside a transaction use the `tx` handle. Results and error codes unchanged; `'write_failed'` still wraps thrown errors.
  - Dev seed: one transaction, multi-row `INSERT` chunks of 500.
- [ ] **Step 4:** Update the six test files' direct writes to SQL (`UPDATE map_items SET geometry = ? WHERE id = ?`, etc.) and rewrite `db.test.ts`.
- [ ] **Step 5:** `npx jest` — all green, including Step 1's tests; `npx tsc --noEmit`; `npx eslint src` clean. `grep -rn "@nozbe" src` returns nothing.
- [ ] **Step 6: Commit** — `git commit -m "refactor: data layer on AppDb (PowerSync), WatermelonDB no longer imported"`

### Task 4: Remove WatermelonDB from the project

**Files:**
- Modify: `package.json` (remove `@nozbe/watermelondb`, `@morrowdigital/watermelondb-expo-plugin`, the `expo.autolinking.exclude` entry for `@nozbe/simdjson`, and `@nozbe/.*` from Jest `transformIgnorePatterns`), `package-lock.json` (via `npm uninstall`), `app.json` (remove the watermelondb plugin block), `babel.config.js` (remove the decorators/class-properties/private-methods override if `npx expo export` and Jest still pass without it — the comment there says it exists for WatermelonDB models), `eslint.config.js` (`WATERMELON` → `POWERSYNC = ['@powersync/*']` with the same zones and a message naming PowerSync), `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md` (dependency rule 3 and the data-layer sections: describe the `AppDb` seam and PowerSync local-only), `AGENTS.md` (only if it mentions WatermelonDB)

- [ ] **Step 1:** Make the removals. `npm ls @nozbe/watermelondb` reports nothing.
- [ ] **Step 2:** Add an ESLint check: a scratch import of `@powersync/react-native` in a UI file is rejected by `npx eslint` (then remove the scratch import).
- [ ] **Step 3:** `npx tsc --noEmit`, `npx eslint src`, `npx jest` all green; `npx expo prebuild --clean` succeeds; `npx expo export --platform ios` bundles.
- [ ] **Step 4: Commit** — `git commit -m "chore: remove WatermelonDB, its Expo plugin and build workarounds"`

### Task 5: Device verification (user)

- [ ] **Step 1:** Build a new iOS development client (EAS or local) from `feat/powersync`. Android: release build compiles (`npx expo run:android --variant release`), device/emulator run if available, else recorded as deferred.
- [ ] **Step 2:** The user checks on device, against `main` for comparison:
  - The app launches on a phone that still has the old database (Review Focus 5) and shows an empty missions list.
  - Create, rename, open, delete missions; mission pictures and camera restore.
  - Place, edit, cancel, hide/show, ring, delete units, points, lines, polygons; Layers lists them.
  - Relaunch: everything persists.
  - Dev seed 5,000 items: opens in under 1 s, panning as smooth as `main`, saving an edit and toggling hide with no visible hitch.
- [ ] **Step 3:** Record results in `docs/superpowers/notes/2026-10-31-powersync-spike.md` under "Device verification"; commit (`docs: PowerSync device verification`).
