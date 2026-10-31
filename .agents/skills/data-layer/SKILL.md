---
name: data-layer
description: Use whenever you read or write app data, add a table, column, repository function or command, or touch anything sync-related. Defines the sync-ready rules every change must keep.
---

# Data layer (AppDb over PowerSync)

## Where things live
- `src/lib/db/` — `app-db.ts` (the `AppDb` SQL seam), `schema.ts` (PowerSync `Schema`,
  local-only tables), `powersync-db.ts` / `app-database.ts` (production),
  `sql-test-db.ts` / `test-database.ts` (tests on `@powersync/node`), `new-id.ts`,
  `sync-config.ts`, `command-context.ts`. No migrations file.
- `src/features/<feature>/repository.ts` — reads: SQL through `AppDb` (`getAll`,
  `getOptional`, `watch`) returning plain snapshots.
- SQL lives only in repositories and commands.
- `src/features/<feature>/commands.ts` — **the only write path.** Every write goes through a
  command taking a `CommandContext` and returning a `Result`.
- UI never imports `@powersync/*` or `@op-engineering/op-sqlite` (lint enforced).

## Rules
1. **IDs** are UUIDv4 from `newId()` in `new-id.ts`. Never set ids by hand.
2. **Authorship:** commands stamp `created_by` / `updated_by` from `ctx.actorId()` on every
   create/update of synced tables.
3. **Deletes** are hard `DELETE` statements; there are no tombstone columns. PowerSync
   tracks changes itself once a table is synced.
4. **Scope by mission.** Every map item has `mission_id`. Queries for the map are always
   mission-scoped; the active mission comes from the route param, not a global store.
5. **Shared data vs view state.** Anything that is one user's view (hidden, last opened,
   camera, pinned) goes in a local-only table and is listed in `LOCAL_ONLY_TABLES`.
   Never add a view-state column to a synced table.
6. **Schema changes** go in `schema.ts` (PowerSync creates the tables from it; there is no
   migrations file). Handle existing rows in SQL when adding a column the app already
   shipped without.
7. **Commands validate and return errors** (`Result`), they don't throw into UI.
8. **Map reads** go through snapshots + `createPointFeatureSelector` (cached by
   `id + updatedAt`). Use `AppDb.watch(sql, params, tables)` and select only the columns the
   map renders.
9. **High-frequency data** (live positions, presence) never goes in the database.

## Adding a table or column
1. Add/extend the table in `schema.ts`.
2. Classify the table in `sync-config.ts` (the db test fails otherwise).
3. Add repository reads and commands in the owning feature.
4. Test with `makeTestContext()` (in-memory SQLite via `@powersync/node`): ids, stamps, scoping, error results.
