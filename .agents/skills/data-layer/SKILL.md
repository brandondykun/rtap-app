---
name: data-layer
description: Use whenever you read or write app data, add a WatermelonDB table, column, model, migration, repository function or command, or touch anything sync-related. Defines the sync-ready rules every change must keep.
---

# Data layer (WatermelonDB)

## Where things live
- `src/lib/db/` — `schema.ts`, `migrations.ts`, `models/`, adapters (`app-database.ts`,
  `test-database.ts`), `sync-config.ts`, `command-context.ts`.
- `src/features/<feature>/repository.ts` — reads: observables and fetches returning plain
  snapshots or models.
- `src/features/<feature>/commands.ts` — **the only write path.** Every write goes through a
  command taking a `CommandContext` and returning a `Result`.
- UI never imports `@nozbe/watermelondb` (lint enforced).

## Rules
1. **IDs** are UUIDv4 (installed by `createDatabase`). Never set ids by hand.
2. **Authorship:** commands stamp `created_by` / `updated_by` from `ctx.actorId()` on every
   create/update of synced tables.
3. **Deletes** of synced records use `markAsDeleted()` (sync tombstone), never
   `destroyPermanently()`. Local-only rows may be destroyed. `Collection.find` still returns
   soft-deleted records — repository `find*` helpers must return null when
   `_raw._status === 'deleted'`.
4. **Scope by mission.** Every map item has `mission_id`. Queries for the map are always
   mission-scoped; the active mission comes from the route param, not a global store.
5. **Shared data vs view state.** Anything that is one user's view (hidden, last opened,
   camera, pinned) goes in a local-only table and is listed in `LOCAL_ONLY_TABLES`.
   Never add a view-state column to a synced table.
6. **Migrations are append-only.** To change the schema: bump `schema.version`, add a
   migration step in `migrations.ts`, never edit a shipped step. New columns are
   `isOptional: true` unless every existing row can be backfilled.
7. **Commands validate and return errors** (`Result`), they don't throw into UI.
8. **Map reads** go through snapshots + `createPointFeatureSelector` (cached by
   `id + updatedAt`). Observe with `observeWithColumns([...])` listing the columns the map
   renders.
9. **High-frequency data** (live positions, presence) never goes in WatermelonDB.

## Adding a table or column
1. Update `schema.ts` (+ migration if the app has shipped), add/extend the model in
   `src/lib/db/models/`, register new models in `create-database.ts`.
2. Classify the table in `sync-config.ts` (the db test fails otherwise).
3. Add repository reads and commands in the owning feature.
4. Test with `makeTestContext()` (LokiJS in-memory): ids, stamps, scoping, error results.
