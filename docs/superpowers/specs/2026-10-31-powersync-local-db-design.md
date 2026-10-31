# Replace WatermelonDB with PowerSync (local-only first)

## Intent

WatermelonDB is effectively unmaintained (no stable release since 0.28.0 in April 2025, nothing merged in the last
year) and 0.28.0 does not build on React Native 0.88 / Expo SDK 58, the app's next upgrade. The research behind this
decision is in `../../../../reports/WatermelonDB production readiness.md` (umbrella repo) and the follow-up
discussion: the app will need **immediate** multi-user updates, orders and free-text messages later, which a sync
engine that streams from Postgres (PowerSync) gives without building it ourselves.

This change swaps the on-device database to **PowerSync's SQLite client, used local-only**: no PowerSync service, no
backend, no network. Sync is a later, separate project (see "Later: turning on sync"). The app must look and behave
exactly as it does today.

## Decided by the user

- PowerSync on the device, with **local-only tables for now** ("option 2"): nothing queues for upload while there is
  no backend; on the first sign-in, a later release switches the shared tables to synced ones and copies the data
  across once.
- **Wiping all local data is fine.** The app is unpublished and only on development devices. No migration from the
  WatermelonDB file, no compatibility code.
- PowerSync will be self-hosted later (App Platform or a Droplet, undecided). Live location will go over WebSockets
  (Django Channels), not through sync. Neither is part of this change.

## Goals

- Every feature works as today: missions list (with pictures and per-mission camera), map items of every kind,
  hide/show, range rings, naming, edit/cancel/delete, the dev performance seed.
- The layering stays: **commands are the only write path; repositories are the only readers; the UI never imports
  the database library** (it reads RxJS observables through `useObservable`, as now). ESLint keeps enforcing it,
  now for `@powersync/*` instead of `@nozbe/*`.
- The test suite keeps running in plain Jest (Node), with no device or simulator, against **real SQLite**.
- Android and iOS both use the fast native SQLite path (the Android JSI gap goes away with WatermelonDB).
- WatermelonDB and everything that existed only for it leave the project: the package, its Expo config plugin, the
  `@nozbe/simdjson` autolinking exclusion, LokiJS, the model classes, the decorator Babel plugins if nothing else
  needs them, and the `@nozbe/.*` Jest transform entry.

## Non-goals

- No sync, PowerSync service, backend endpoints, accounts or auth.
- No data migration from WatermelonDB.
- No UI or behaviour change.
- No new shared data (orders, messages): those come with sync.

## Design

### The database seam (`src/lib/db`)

An app-owned interface, so features never depend on PowerSync's API directly and tests can supply their own
implementation:

```ts
type AppDb = {
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  /** All writes inside run atomically; a throw rolls them back. */
  writeTransaction<R>(fn: (tx: AppDbTx) => Promise<R>): Promise<R>;
  /** Re-runs the query whenever any of `tables` changes; emits its rows (first emission at subscribe). */
  watch<T>(sql: string, params: unknown[], tables: readonly string[]): Observable<T[]>;
};
```

(`AppDbTx` has `getAll` / `getOptional` / `execute`.) `CommandContext.db` becomes `AppDb`. The production
implementation wraps a `PowerSyncDatabase`. The exact shape may be adjusted by the builder, but it stays small,
SQL-based and library-neutral.

### Schema

A PowerSync `Schema` with the four existing tables, **all `localOnly: true`**, same names and columns as today:
`missions`, `map_items`, `item_view_state`, `mission_view_state`. Column types map to PowerSync's `text`,
`integer` and `real`: strings → text, timestamps (ms) and booleans (0/1) → integer, meters/feet → real. Indexes as
today: `map_items(mission_id)`, `map_items(kind)`, `item_view_state(map_item_id)`,
`mission_view_state(mission_id)`. `id` is PowerSync's text primary key; ids stay UUIDv4 from `expo-crypto`
(the server will accept client-created ids as-is).

`sync-config.ts` keeps its split (`missions`, `map_items` will sync; the two view-state tables stay local forever).
Name the tables so the later switch is the documented PowerSync local-only → synced pattern (view names stay the
SQL names used everywhere).

There is **no migrations file**. PowerSync applies schema changes itself (local-only rows are stored as JSON under
the views), so adding an optional column is a schema edit. `migrations.ts` and schema `version` go away.

### Repositories and commands

Rewritten on SQL, same exported functions and the same observable outputs (`observeMissionItems`, `observeItem`,
`observeHiddenItemIds`, `observeRingItemIds`, `observeMissionSidcs`, `observeMissionSummaries`, and the rest), so
the UI is untouched.

- Model classes go. In their place, plain row types plus mappers in the repositories. Lookups such as `findItem`
  and `findMission` return a plain record with **the same camelCase field names the models had** (`missionId`,
  `geometry`, `notes`, `createdAt` as ms, ...), so callers and most tests keep working.
- `created_at` / `updated_at` are set by commands from `ctx.now()` (WatermelonDB did this itself); `created_by` /
  `updated_by` from `ctx.actorId()` as now.
- Deletes are real `DELETE`s (local-only: no tombstones on the device; the later sync design owns tombstones on
  the server). Deleting a mission still deletes its items and view state, in one transaction.
- "Unknown kind from a newer app" filtering (`MAP_ITEM_KINDS`) stays, in SQL.
- Observables must not re-emit more than today in the places that care (`observeMissionSidcs` already dedupes; the
  map's GeoJSON selectors are memoized). PowerSync's watch already throttles bursts.

### Tests

Tests keep using `makeTestContext()` and run against real SQLite in Node, through the same `AppDb` seam, each test
on a fresh in-memory database. Preferred: PowerSync's Node SDK, so tests exercise the same engine. If it does not
run under Jest (`jest-expo` preset), use a small `AppDb` on `better-sqlite3` with the same schema and a simple
table-change notifier for `watch`. The spike (below) decides. Test code that wrote through WatermelonDB directly
(about six sites: `ctx.db.write`, `record.update`, `markAsDeleted`, `Q`) moves to `ctx.db.execute` with SQL.
`db.test.ts` is rewritten for the new schema (UUID ids, local/synced split, columns present).

### Native setup

`@powersync/react-native` with its recommended native SQLite adapter for Expo development builds (the builder
confirms the current package set, any required polyfills, and the Expo config needed). Expo Go stays unsupported,
as today.

## Spike first

Before rewriting the repositories, a throwaway check on the real app build (development client):

1. PowerSync opens, writes and watches on **iOS and Android** on Expo SDK 57 / RN 0.86.3, New Architecture, with
   an Android **release** build (R8 on) and Hermes.
2. The Jest route: PowerSync Node SDK under `jest-expo`, or the `better-sqlite3` fallback.
3. A 5,000-item mission (the existing perf seed) loads and pans as smoothly as today.

If (1) fails, stop and report: there is no point continuing. The Android device check can wait if no Android
device is available (as for the earlier native gate), but the release build must at least compile.

## Settled details

- **Re-emission.** A repository observable emits only when its output changed: each one ends in a cheap
  `distinctUntilChanged` (items: compare `id` + `updated_at` per row; id lists: compare joined ids), and each watches
  only the tables its query reads (`observeMissionItems` does not watch `item_view_state`, so hide/ring toggles do
  not re-query items). Saving one item re-queries that mission's items once per save, not per frame; that is
  accepted if the spike's numbers hold (below).
- **Spike pass criteria** (on device, release build): opening the 5,000-item perf mission shows it in under 1 s;
  the items query plus mapping takes under 100 ms; saving an edit and toggling hide cause no visible hitch; panning
  is as smooth as on `main`. The spike runs on the current Expo SDK 57 / RN 0.86.3; the SDK 58 upgrade is a separate
  change that this one unblocks. Android: run on an emulator if one is available, otherwise the release build must
  compile and the Android device check is deferred, as for the earlier native gate (no Android device yet).
- **Test fallback.** If the `better-sqlite3` route is used, it is a devDependency; its `watch` emits once on
  subscribe and once after each committed write that touched a watched table. Small timing differences from
  production (PowerSync throttles) are accepted; tests already wait with `waitFor`.
- **expo-sqlite stays.** It backs `expo-sqlite/kv-store` (settings, profile, my-location, device id), unrelated to
  the database. The spike confirms PowerSync's SQLite adapter builds alongside it.
- **Table names.** Plain names now (`localOnly: true`, the view names above). The later sync project performs
  PowerSync's local-only → synced switch; ids and columns are unchanged by it, so it needs no second wipe.
  Server-side bookkeeping (versions, tombstones, `deleted_at`) lives in Postgres, not in the client schema.
- **Types and nulls.** Mappers convert 0/1 to booleans and normalise missing values to `null`. Commands write every
  column on insert (no reliance on defaults). Record types carry timestamps as ms numbers; the only `Date` uses today
  are `.getTime()` calls inside the repositories.
- **Transactions.** Commands never call other commands inside a transaction; reads inside one go through the
  transaction handle. The perf seed inserts in one transaction, in multi-row chunks of 500 (as today), well under
  SQLite's bound-variable limit.
- **Start-up.** `getAppDatabase()` stays synchronous and lazy; queries wait for PowerSync's initialisation
  internally, so the providers and screens are unchanged. Any Hermes polyfills PowerSync needs are installed at app
  entry (the spike lists them).
- **Old database file.** Left in place on development devices (a reinstall removes it); no cleanup code.

## Later: turning on sync (not in this change)

Recorded so this change does not block it: the sync release switches `missions` and `map_items` from local-only
to synced (PowerSync's documented switch, then a one-time copy of local rows into the synced tables on first
sign-in), adds the PowerSync service (self-hosted), DRF write endpoints that receive the upload queue, JWT auth
from Django, sync rules per mission member, orders and messages as synced tables with acknowledgement rows, push
notifications from Django, and live location over Django Channels. Before that work: check `SHOW wal_level;` on
the DigitalOcean managed database and test long-lived connections on the chosen host.

## Constraints

- Map repo rules: semantic tokens, commands as the only write path, the UI never imports the database library.
- No hand-written API types (there is no API in this change).
- Never add Co-Authored-By or any trailer to commits.
- Docs that describe the data layer (`docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md`
  dependency rule 3 and the data sections, AGENTS.md if it mentions WatermelonDB) are updated to match.

## My calls (check these)

- The app-owned `AppDb` seam over SQL, rather than using PowerSync's API (or an ORM such as Drizzle) in features.
- Lookups return plain records with the old model field names, to keep test churn low.
- Hard deletes on the device.
- No migrations file; schema edits only.
- Spike before the rewrite, with an Android release build as part of it.
