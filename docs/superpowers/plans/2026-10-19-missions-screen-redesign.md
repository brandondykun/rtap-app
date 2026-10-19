# Missions Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the missions list as the mockups show: a pinned last-opened card with a map picture, smaller cards with thumbnails, sort chips, search, and a two-column landscape layout, with map pictures captured from the live mission map.

**Architecture:** Pictures are taken with `MapView.takeSnap()` when a mission screen blurs, when the app backgrounds, and (awaited, at most 1 s) before "Switch mission"; they are downscaled to a 720 px JPEG in `documents/mission-snapshots/` and recorded on the device-local `mission_view_state` row (new `snapshot` column, schema v2). The list is pure functions (`mission-list.ts`) for sort/filter/pin/labels plus small presentational components under `src/features/missions/list/`; `MissionsScreen` composes them.

**Tech Stack:** Expo SDK 57, React Native 0.86, WatermelonDB, @rnmapbox/maps 10.3.8, expo-image, expo-file-system (`File`/`Directory`/`Paths`), expo-image-manipulator (`ImageManipulator.manipulate`), Zustand, NativeWind, jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-19-missions-screen-redesign-design.md`

## Global Constraints

- Picture: 720 px wide, JPEG quality 0.7, at `<documentDirectory>/mission-snapshots/<missionId>.jpg`, overwritten on each capture.
- `mission_view_state.snapshot`: nullable string, JSON `{ uri, takenAt }`; schema version 2 with an append-only migration.
- Leaving via "Switch mission" waits for the capture at most 1000 ms; a failed or slow capture never blocks navigation and keeps the previous picture.
- Sorts: Recent (last opened desc, never-opened last, then name), Name (case-insensitive A–Z), Most items (total desc, ties by Recent). Default Recent, persisted in settings.
- Headings: EARLIER / BY NAME / MOST ITEMS. Search hides the pinned card and the heading.
- Copy: "N missions · N units plotted" (singular for 1), "Last opened", "Resume", "Empty — nothing plotted yet", "No missions match “…”", "Swipe a mission for edit & delete".
- Dependencies only via `npx expo install expo-image-manipulator expo-file-system` (new native module → new development build).
- Commits: Conventional Commits, single quotes, **no attribution trailers of any kind** (no Co-Authored-By).
- Lint must report 0 problems (`npx expo lint`); `npx tsc --noEmit` clean. Never run prettier. Use `npx`, not `bunx`.
- Keep: swipe Edit/Delete with confirmation, accessibility actions Rename/Delete, accessibility label `Open <name>`, the empty state, the `__DEV__` "Seed 5k" button.

## Review Focus

- A capture finishing after the mission was deleted would recreate its view-state row and a stray file: `saveMissionSnapshot` must not write for a missing mission (test in Task 2).
- Two captures racing (blur and background at once, or Switch mission then blur) must not run twice in parallel: single in-flight capture (test in Task 3).
- A whitespace-only search must list every mission, not "No missions match" (test in Task 4).
- A pinned mission must not also appear in the list below it (test in Task 6).
- A corrupt `snapshot` JSON must show the placeholder, not crash (test in Task 1).

---

### Task 1: Snapshot column, schema v2, and richer summaries

**Files:**
- Modify: `src/lib/db/schema.ts` (version 2, `snapshot` column)
- Modify: `src/lib/db/migrations.ts`
- Modify: `src/lib/db/models/MissionViewState.ts`
- Modify: `src/features/missions/repository.ts`
- Modify: `src/features/missions/commands.ts` (`upsertViewState` create sets `snapshot = null`)
- Test: `src/features/missions/summaries.test.ts` (create)

**Interfaces:**
- Produces: `type MissionSnapshot = { uri: string; takenAt: number }`; `parseSnapshot(json: string | null): MissionSnapshot | null`; `parseCamera(json: string | null): MissionCamera | null`; `MissionSummary` gains `camera: MissionCamera | null` and `snapshot: MissionSnapshot | null`; `type CategoryCounts = { units: number; points: number; lines: number; polygons: number }`; `observeCountsByMission(db: Database, ids: readonly string[]): Observable<ReadonlyMap<string, CategoryCounts>>`; `MissionViewState.snapshot: string | null`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/missions/summaries.test.ts`:

```ts
import { firstValueFrom } from 'rxjs';

import { placePoint } from '@/features/map-items/commands';
import { migrations } from '@/lib/db/migrations';
import { schema, Tables } from '@/lib/db/schema';
import { makeTestContext } from '@/lib/db/test-database';

import { createMission, markMissionOpened, saveMissionCamera } from './commands';
import { observeCountsByMission, observeMissionSummaries, parseCamera, parseSnapshot } from './repository';

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

describe('schema v2', () => {
  it('adds the nullable snapshot column to mission_view_state with a migration', () => {
    expect(schema.version).toBe(2);
    expect(schema.tables[Tables.missionViewState].columns.snapshot).toEqual({ name: 'snapshot', type: 'string', isOptional: true });
    expect(migrations.maxVersion).toBe(2);
    expect(migrations.sortedMigrations[0].steps).toEqual([
      { type: 'add_columns', table: Tables.missionViewState, columns: [{ name: 'snapshot', type: 'string', isOptional: true }] },
    ]);
  });
});

describe('parseSnapshot / parseCamera', () => {
  it('parses valid JSON and rejects corrupt or invalid values', () => {
    expect(parseSnapshot(JSON.stringify({ uri: 'file:///a.jpg', takenAt: 5 }))).toEqual({ uri: 'file:///a.jpg', takenAt: 5 });
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('{not json')).toBeNull();
    expect(parseSnapshot(JSON.stringify({ uri: '', takenAt: 5 }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ uri: 'file:///a.jpg', takenAt: 'x' }))).toBeNull();
    const camera = { center: at, zoom: 12, bearing: 0 };
    expect(parseCamera(JSON.stringify(camera))).toEqual(camera);
    expect(parseCamera('nope')).toBeNull();
  });
});

describe('observeMissionSummaries', () => {
  it('includes the camera and snapshot (null when absent)', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    if (!iron.ok) throw new Error('setup');
    let list = await firstValueFrom(observeMissionSummaries(ctx.db));
    expect(list[0]).toMatchObject({ camera: null, snapshot: null });
    await markMissionOpened(ctx, iron.value.id);
    await saveMissionCamera(ctx, iron.value.id, { center: at, zoom: 12, bearing: 0 });
    list = await firstValueFrom(observeMissionSummaries(ctx.db));
    expect(list[0].camera).toEqual({ center: at, zoom: 12, bearing: 0 });
  });
});

describe('observeCountsByMission', () => {
  it('maps each mission id to its category counts, and is empty for no ids', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!iron.ok || !cobra.ok) throw new Error('setup');
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    const counts = await firstValueFrom(observeCountsByMission(ctx.db, [iron.value.id, cobra.value.id]));
    expect(counts.get(iron.value.id)).toEqual({ units: 1, points: 0, lines: 0, polygons: 0 });
    expect(counts.get(cobra.value.id)).toEqual({ units: 0, points: 0, lines: 0, polygons: 0 });
    expect((await firstValueFrom(observeCountsByMission(ctx.db, []))).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/missions/summaries.test.ts`
Expected: FAIL (`parseSnapshot`/`observeCountsByMission` not exported; schema version 1).

- [ ] **Step 3: Implement**

`src/lib/db/schema.ts`: set `version: 2` and add to the `missionViewState` columns, after `camera`:

```ts
        { name: 'snapshot', type: 'string', isOptional: true },
```

`src/lib/db/migrations.ts`:

```ts
import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

import { Tables } from './schema';

// Append-only. Never edit a migration that has shipped; add a new one and bump schema.version.
export const migrations = schemaMigrations({
  migrations: [
    {
      // Map pictures for the missions list (local to the device, like the camera).
      toVersion: 2,
      steps: [addColumns({ table: Tables.missionViewState, columns: [{ name: 'snapshot', type: 'string', isOptional: true }] })],
    },
  ],
});
```

`src/lib/db/models/MissionViewState.ts`: add below `camera`:

```ts
  /** JSON `MissionSnapshot` (this device's map picture) or null. */
  @field('snapshot') snapshot!: string | null;
```

`src/features/missions/commands.ts`, in `upsertViewState`'s create branch, after `s.camera = null;`:

```ts
        s.snapshot = null;
```

`src/features/missions/repository.ts`:
- Add `of` to the rxjs import: `import { combineLatest, map, of, type Observable } from 'rxjs';`
- Add after `MissionCamera`:

```ts
/** A picture of the mission map stored on this device. */
export type MissionSnapshot = { uri: string; takenAt: number };

export type CategoryCounts = { units: number; points: number; lines: number; polygons: number };
```

- Extend `MissionSummary` with `camera: MissionCamera | null;` and `snapshot: MissionSnapshot | null;`.
- In `observeMissionSummaries`, observe `['last_opened_at', 'camera', 'snapshot']` and build the summary from the state row:

```ts
    map(([missions, states]) => {
      const byMission = new Map(states.map((s) => [s.missionId, s]));
      return sortMissionSummaries(
        missions.map((m) => {
          const state = byMission.get(m.id);
          return {
            id: m.id,
            name: m.name,
            createdAt: m.createdAt.getTime(),
            lastOpenedAt: state?.lastOpenedAt ?? null,
            camera: parseCamera(state?.camera ?? null),
            snapshot: parseSnapshot(state?.snapshot ?? null),
          };
        }),
      );
    }),
```

- Change `observeMissionCategoryCounts`'s return type to `Observable<CategoryCounts>` and add after it:

```ts
/** Category counts for each mission id (for sorting by size and the units total). */
export function observeCountsByMission(db: Database, ids: readonly string[]): Observable<ReadonlyMap<string, CategoryCounts>> {
  if (ids.length === 0) return of(new Map());
  return combineLatest(ids.map((id) => observeMissionCategoryCounts(db, id))).pipe(
    map((counts) => new Map(ids.map((id, i) => [id, counts[i]]))),
  );
}
```

- Replace the body of `getMissionCamera` with a shared parser and add `parseSnapshot`:

```ts
export function parseCamera(json: string | null): MissionCamera | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return isValidCamera(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseSnapshot(json: string | null): MissionSnapshot | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json) as MissionSnapshot | null;
    return s && typeof s.uri === 'string' && s.uri.length > 0 && typeof s.takenAt === 'number' && Number.isFinite(s.takenAt)
      ? { uri: s.uri, takenAt: s.takenAt }
      : null;
  } catch {
    return null;
  }
}

export async function getMissionCamera(db: Database, missionId: string): Promise<MissionCamera | null> {
  const state = await findMissionViewState(db, missionId);
  return parseCamera(state?.camera ?? null);
}
```

- [ ] **Step 4: Run to verify it passes, plus the missions folder**

Run: `npx jest src/features/missions src/features/map`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db src/features/missions/repository.ts src/features/missions/commands.ts src/features/missions/summaries.test.ts
git commit -m "feat: snapshot column (schema v2) and camera, picture and counts on mission summaries"
```

---

### Task 2: Saving and deleting map pictures

**Files:**
- Run: `npx expo install expo-image-manipulator expo-file-system`
- Create: `__mocks__/expo-file-system.ts`, `__mocks__/expo-image-manipulator.ts`
- Modify: `jest.setup.ts` (register both mocks)
- Create: `src/features/missions/snapshot-files.ts` (paths and file deletion; imports nothing from commands, so commands can use it without an import cycle)
- Create: `src/features/missions/snapshots.ts` (capture → picture → record)
- Modify: `src/features/missions/commands.ts` (`recordMissionSnapshot`; `deleteMission` deletes the file)
- Test: `src/features/missions/snapshots.test.ts` (create)

**Interfaces:**
- Consumes: `MissionSnapshot` (Task 1).
- Produces: `snapshot-files.ts`: `snapshotDir(): Directory`, `snapshotFile(missionId: string): File`, `deleteMissionSnapshot(missionId: string): void`, `deleteQuietly(file: File): void`. `snapshots.ts`: `SNAPSHOT_WIDTH = 720`, `SNAPSHOT_QUALITY = 0.7`; `saveMissionSnapshot(ctx: CommandContext, missionId: string, sourceUri: string): Promise<Result<MissionSnapshot, 'not_found' | 'write_failed'>>`; commands: `recordMissionSnapshot(ctx, missionId, snapshot): Promise<Result<void, 'write_failed'>>`.

- [ ] **Step 1: Install dependencies**

Run: `npx expo install expo-image-manipulator expo-file-system`
Expected: both added to `package.json` dependencies.

- [ ] **Step 2: Add the test mocks**

`__mocks__/expo-file-system.ts`:

```ts
/** In-memory expo-file-system for tests: tracks which file URIs exist. */
export const __files = new Set<string>();

const join = (segments: (string | { uri: string })[]) => segments.map((s) => (typeof s === 'string' ? s : s.uri)).join('/');

export class Directory {
  uri: string;
  constructor(...segments: (string | { uri: string })[]) {
    this.uri = join(segments);
  }
  get exists() {
    return true;
  }
  create = jest.fn();
}

export class File {
  uri: string;
  constructor(...segments: (string | { uri: string })[]) {
    this.uri = join(segments);
  }
  get exists() {
    return __files.has(this.uri);
  }
  delete() {
    __files.delete(this.uri);
  }
  move(destination: { uri: string }) {
    __files.delete(this.uri);
    __files.add(destination.uri);
    this.uri = destination.uri;
  }
}

export const Paths = { document: new Directory('file:///docs') };
```

`__mocks__/expo-image-manipulator.ts`:

```ts
export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } as const;

let saved = 0;

/** Each save "writes" a new cache file; the last resize and save options are recorded for assertions. */
export const __last: { resize?: unknown; save?: unknown } = {};

export const ImageManipulator = {
  manipulate: jest.fn((_uri: string) => ({
    resize(size: unknown) {
      __last.resize = size;
      return this;
    },
    renderAsync: async () => ({
      saveAsync: async (options: unknown) => {
        __last.save = options;
        saved += 1;
        const uri = `file:///cache/manipulated-${saved}.jpg`;
        (jest.requireMock('expo-file-system') as { __files: Set<string> }).__files.add(uri);
        return { uri, width: 720, height: 1560 };
      },
    }),
  })),
};
```

Append to `jest.setup.ts`:

```ts
jest.mock('expo-file-system', () => require('./__mocks__/expo-file-system'));
jest.mock('expo-image-manipulator', () => require('./__mocks__/expo-image-manipulator'));
```

- [ ] **Step 3: Write the failing tests**

`src/features/missions/snapshots.test.ts`:

```ts
import { ImageManipulator } from 'expo-image-manipulator';

import { makeTestContext } from '@/lib/db/test-database';

import { createMission, deleteMission, markMissionOpened } from './commands';
import { findMissionViewState, parseSnapshot } from './repository';
import { deleteMissionSnapshot, snapshotFile } from './snapshot-files';
import { saveMissionSnapshot } from './snapshots';

const fs = jest.requireMock('expo-file-system') as { __files: Set<string> };
const manip = jest.requireMock('expo-image-manipulator') as { __last: { resize?: unknown; save?: unknown } };

beforeEach(() => fs.__files.clear());

async function opened() {
  const ctx = makeTestContext();
  const m = await createMission(ctx, { name: 'Op Iron' });
  if (!m.ok) throw new Error('setup');
  await markMissionOpened(ctx, m.value.id);
  return { ctx, id: m.value.id };
}

describe('saveMissionSnapshot', () => {
  it('downscales to a 720 px JPEG, stores it per mission and records it on the view state', async () => {
    const { ctx, id } = await opened();
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png');
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///cache/snap.png');
    expect(manip.__last.resize).toEqual({ width: 720, height: null });
    expect(manip.__last.save).toEqual({ format: 'jpeg', compress: 0.7 });
    const uri = 'file:///docs/mission-snapshots/' + id + '.jpg';
    expect(result).toEqual({ ok: true, value: { uri, takenAt: ctx.now() } });
    expect(fs.__files.has(uri)).toBe(true);
    const state = await findMissionViewState(ctx.db, id);
    expect(parseSnapshot(state?.snapshot ?? null)?.uri).toBe(uri);
  });

  it('overwrites the previous picture at the same path', async () => {
    const { ctx, id } = await opened();
    await saveMissionSnapshot(ctx, id, 'file:///cache/a.png');
    await saveMissionSnapshot(ctx, id, 'file:///cache/b.png');
    expect([...fs.__files].filter((f) => f.includes('mission-snapshots'))).toEqual([snapshotFile(id).uri]);
  });

  it('does not write for a deleted mission', async () => {
    const { ctx, id } = await opened();
    await deleteMission(ctx, id);
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png');
    expect(result.ok).toBe(false);
    expect(fs.__files.has(snapshotFile(id).uri)).toBe(false);
    expect(await findMissionViewState(ctx.db, id)).toBeNull();
  });

  it('reports a failure without throwing', async () => {
    const { ctx, id } = await opened();
    (ImageManipulator.manipulate as jest.Mock).mockImplementationOnce(() => {
      throw new Error('decode failed');
    });
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/bad.png');
    expect(result).toMatchObject({ ok: false, error: 'write_failed' });
  });
});

describe('deleting', () => {
  it('deleteMission removes the picture file; deleting a missing file is fine', async () => {
    const { ctx, id } = await opened();
    await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png');
    await deleteMission(ctx, id);
    expect(fs.__files.has(snapshotFile(id).uri)).toBe(false);
    expect(() => deleteMissionSnapshot('nope')).not.toThrow();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx jest src/features/missions/snapshots.test.ts`
Expected: FAIL (`./snapshots` not found).

- [ ] **Step 5: Implement**

`src/features/missions/commands.ts`: import `type MissionSnapshot` from `./repository` and `{ deleteMissionSnapshot }` from `./snapshot-files`; add after `saveMissionCamera`:

```ts
export async function recordMissionSnapshot(ctx: CommandContext, missionId: string, snapshot: MissionSnapshot): Promise<Result<void, 'write_failed'>> {
  try {
    await upsertViewState(ctx, missionId, (s) => {
      s.snapshot = JSON.stringify(snapshot);
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
```

In `deleteMission`, after the write succeeds and before `return ok(undefined);`:

```ts
    deleteMissionSnapshot(missionId);
```

`src/features/missions/snapshot-files.ts`:

```ts
import { Directory, File, Paths } from 'expo-file-system';

export function snapshotDir(): Directory {
  return new Directory(Paths.document, 'mission-snapshots');
}

/** Where a mission's map picture lives (one per mission, overwritten on each capture). */
export function snapshotFile(missionId: string): File {
  return new File(snapshotDir(), `${missionId}.jpg`);
}

/** Removes a mission's picture; a missing file is not an error. */
export function deleteMissionSnapshot(missionId: string): void {
  deleteQuietly(snapshotFile(missionId));
}

export function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // Best effort: a leftover file is harmless.
  }
}
```

`src/features/missions/snapshots.ts`:

```ts
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { CommandContext } from '@/lib/db/command-context';
import { err, ok, type Result } from '@/lib/result';

import { recordMissionSnapshot } from './commands';
import { findMission, type MissionSnapshot } from './repository';
import { deleteQuietly, snapshotDir, snapshotFile } from './snapshot-files';

export const SNAPSHOT_WIDTH = 720;
export const SNAPSHOT_QUALITY = 0.7;

/** Downscales a captured map image, stores it as the mission's picture and records it. Never throws. */
export async function saveMissionSnapshot(
  ctx: CommandContext,
  missionId: string,
  sourceUri: string,
): Promise<Result<MissionSnapshot, 'not_found' | 'write_failed'>> {
  // A capture can finish after the mission was deleted: do not bring back its row or file.
  if (!(await findMission(ctx.db, missionId))) return err('not_found', `No mission ${missionId}`);
  try {
    const context = ImageManipulator.manipulate(sourceUri);
    context.resize({ width: SNAPSHOT_WIDTH, height: null });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: SNAPSHOT_QUALITY });
    snapshotDir().create({ intermediates: true, idempotent: true });
    const destination = snapshotFile(missionId);
    await new File(saved.uri).move(destination, { overwrite: true });
    const snapshot = { uri: destination.uri, takenAt: ctx.now() };
    const recorded = await recordMissionSnapshot(ctx, missionId, snapshot);
    if (!recorded.ok) return err('write_failed', recorded.message);
    return ok(snapshot);
  } catch (e) {
    return err('write_failed', String(e));
  } finally {
    deleteQuietly(new File(sourceUri));
  }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx jest src/features/missions`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json __mocks__/expo-file-system.ts __mocks__/expo-image-manipulator.ts jest.setup.ts src/features/missions
git commit -m "feat: save mission map pictures as 720 px JPEGs and delete them with the mission"
```

(Use whichever lockfile `npx expo install` changed.)

---

### Task 3: Capturing the map picture

**Files:**
- Modify: `__mocks__/@rnmapbox/maps.tsx` (MapView forwards a ref with `takeSnap`)
- Modify: `src/test-utils/mapbox-mock.ts` (type `__map`)
- Modify: `src/features/map/canvas/MapCanvas.tsx` (`mapRef` prop)
- Create: `src/features/map/canvas/mission-snapshot.ts`
- Modify: `src/features/map/MissionMap.tsx` (wire the hook)
- Modify: `src/features/menus/menus/AppRootMenu.tsx` (await capture before leaving)
- Test: `src/features/map/canvas/mission-snapshot.test.tsx` (create); `src/features/menus/menus/AppRootMenu.test.tsx` (extend)

**Interfaces:**
- Consumes: `saveMissionSnapshot` (Task 2).
- Produces: `SNAPSHOT_LEAVE_TIMEOUT_MS = 1000`; `createSnapshotCapture(takeSnap: () => Promise<string | null>, save: (uri: string) => Promise<unknown>): () => Promise<void>`; `useMissionSnapshot(ctx: CommandContext, missionId: string, mapRef: RefObject<MapView | null>): void`; `captureBeforeLeave(timeoutMs?: number): Promise<void>`; `MapCanvas` prop `mapRef?: Ref<MapView>`.

- [ ] **Step 1: Make the MapView mock take a ref**

In `__mocks__/@rnmapbox/maps.tsx`, replace the `MapView` function:

```tsx
export const __map = { takeSnap: jest.fn(async (_writeToDisk?: boolean) => 'file:///cache/snap.png') };

export const MapView = forwardRef(function MapView(props: Props, ref) {
  __props.MapView.main = props;
  useImperativeHandle(ref, () => __map);
  return <View testID="map-view">{props.children as ReactNode}</View>;
});
```

(Import `ReactNode` if the file does not already; keep the existing `props.children` expression if it already type-checks.) In `src/test-utils/mapbox-mock.ts` add `__map: { takeSnap: jest.Mock };` to `MapboxMock`.

- [ ] **Step 2: Write the failing tests**

`src/features/map/canvas/mission-snapshot.test.tsx`:

```tsx
import { act, render } from '@testing-library/react-native';
import type { MapView } from '@rnmapbox/maps';
import { createRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { makeTestContext } from '@/lib/db/test-database';

import { captureBeforeLeave, createSnapshotCapture, SNAPSHOT_LEAVE_TIMEOUT_MS, useMissionSnapshot } from './mission-snapshot';

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
}));

const mockSave = jest.fn(async (..._args: unknown[]) => ({ ok: true }));
jest.mock('@/features/missions/snapshots', () => ({ saveMissionSnapshot: (...a: unknown[]) => mockSave(...a) }));

beforeEach(() => jest.clearAllMocks());

describe('createSnapshotCapture', () => {
  it('saves the captured image', async () => {
    const save = jest.fn(async () => undefined);
    await createSnapshotCapture(async () => 'file:///s.png', save)();
    expect(save).toHaveBeenCalledWith('file:///s.png');
  });

  it('runs one capture at a time', async () => {
    let resolve: (uri: string) => void = () => {};
    const takeSnap = jest.fn(() => new Promise<string>((r) => (resolve = r)));
    const save = jest.fn(async () => undefined);
    const capture = createSnapshotCapture(takeSnap, save);
    const a = capture();
    const b = capture();
    resolve('file:///s.png');
    await Promise.all([a, b]);
    expect(takeSnap).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('swallows failures and skips a missing image', async () => {
    const save = jest.fn(async () => undefined);
    await expect(createSnapshotCapture(async () => Promise.reject(new Error('gl')), save)()).resolves.toBeUndefined();
    await createSnapshotCapture(async () => null, save)();
    expect(save).not.toHaveBeenCalled();
  });
});

// One context for every render: a new one would recreate the capture and fire the blur cleanup.
const ctx = makeTestContext();

function Harness({ mapRef }: { mapRef: React.RefObject<MapView | null> }) {
  useMissionSnapshot(ctx, 'm1', mapRef);
  return null;
}

function fakeMap(takeSnap: jest.Mock) {
  const ref = createRef<MapView>() as React.MutableRefObject<MapView | null>;
  ref.current = { takeSnap } as unknown as MapView;
  return ref;
}

describe('useMissionSnapshot', () => {
  it('captures when the screen blurs (unmount) and when the app backgrounds', async () => {
    let onChange: (s: AppStateStatus) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
      onChange = cb as (s: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const takeSnap = jest.fn(async () => 'file:///s.png');
    const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
    await act(async () => onChange('background'));
    expect(takeSnap).toHaveBeenCalledWith(true);
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), 'm1', 'file:///s.png');
    takeSnap.mockClear();
    await act(async () => view.unmount());
    expect(takeSnap).toHaveBeenCalledTimes(1);
  });

  it('captureBeforeLeave waits for the open mission, at most the timeout', async () => {
    jest.useFakeTimers();
    const takeSnap = jest.fn(() => new Promise<string>(() => {})); // never resolves
    const view = await render(<Harness mapRef={fakeMap(takeSnap)} />);
    let done = false;
    void captureBeforeLeave().then(() => (done = true));
    await act(async () => jest.advanceTimersByTime(SNAPSHOT_LEAVE_TIMEOUT_MS - 1));
    expect(done).toBe(false);
    await act(async () => jest.advanceTimersByTime(1));
    expect(done).toBe(true);
    await act(async () => view.unmount());
    jest.useRealTimers();
    await expect(captureBeforeLeave()).resolves.toBeUndefined(); // no open mission: resolves at once
  });
});
```

Add a menu test. `src/features/menus/menus/AppRootMenu.test.tsx` already exists: add the `mission-snapshot` mock and this `it` to it, reusing its existing `expo-router` mock and router object if it has one (rename `mockRouter` below to match):

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { AppRootMenu } from './AppRootMenu';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const mockCapture = jest.fn(async () => undefined);
jest.mock('@/features/map/canvas/mission-snapshot', () => ({ captureBeforeLeave: () => mockCapture() }));

it('captures the map picture before switching mission', async () => {
  await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
  await fireEvent.press(screen.getByText('Switch mission'));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(mockCapture).toHaveBeenCalled();
  expect(mockCapture.mock.invocationCallOrder[0]).toBeLessThan(mockRouter.back.mock.invocationCallOrder[0]);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx jest src/features/map/canvas/mission-snapshot.test.tsx src/features/menus/menus/AppRootMenu.test.tsx`
Expected: FAIL (module `./mission-snapshot` not found).

- [ ] **Step 4: Implement**

`src/features/map/canvas/mission-snapshot.ts`:

```ts
import type { MapView } from '@rnmapbox/maps';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, type RefObject } from 'react';
import { AppState } from 'react-native';

import { saveMissionSnapshot } from '@/features/missions/snapshots';
import type { CommandContext } from '@/lib/db/command-context';

/** "Switch mission" waits this long for the picture at most. */
export const SNAPSHOT_LEAVE_TIMEOUT_MS = 1000;

type Capture = () => Promise<void>;

/** One capture at a time; failures keep the previous picture. */
export function createSnapshotCapture(takeSnap: () => Promise<string | null>, save: (uri: string) => Promise<unknown>): Capture {
  let inFlight: Promise<void> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const uri = await takeSnap();
        if (uri) await save(uri);
      } catch {
        // Keep the previous picture.
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}

/** The open mission's capture, for leaving through the menu. */
let active: Capture | null = null;

/** Captures the open mission's map picture; resolves within the timeout whatever happens. */
export async function captureBeforeLeave(timeoutMs = SNAPSHOT_LEAVE_TIMEOUT_MS): Promise<void> {
  const capture = active;
  if (!capture) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([capture(), new Promise<void>((resolve) => (timer = setTimeout(resolve, timeoutMs)))]);
  clearTimeout(timer);
}

/** Pictures the mission map (symbology included) when the screen blurs and when the app backgrounds. */
export function useMissionSnapshot(ctx: CommandContext, missionId: string, mapRef: RefObject<MapView | null>): void {
  const capture = useMemo(
    () =>
      createSnapshotCapture(
        async () => (mapRef.current ? mapRef.current.takeSnap(true) : null),
        (uri) => saveMissionSnapshot(ctx, missionId, uri),
      ),
    [ctx, missionId, mapRef],
  );

  useEffect(() => {
    active = capture;
    return () => {
      if (active === capture) active = null;
    };
  }, [capture]);

  useFocusEffect(useCallback(() => () => void capture(), [capture]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void capture();
    });
    return () => sub.remove();
  }, [capture]);
}
```

`src/features/map/canvas/MapCanvas.tsx`: import `type MapView` usage stays (it is already a value import); add to `Props`:

```ts
  /** The map view, for pictures of the mission (see mission-snapshot). */
  mapRef?: Ref<MapView>;
```

destructure `mapRef` and pass `ref={mapRef}` on `<MapView`.

`src/features/map/MissionMap.tsx`: import `type MapView` from `@rnmapbox/maps` and `useMissionSnapshot` from `./canvas/mission-snapshot`; next to `useCameraPersistence`:

```ts
  const mapRef = useRef<MapView>(null);
  useMissionSnapshot(ctx, missionId, mapRef);
```

and pass `mapRef={mapRef}` to `<MapCanvas`.

`src/features/menus/menus/AppRootMenu.tsx`: import `captureBeforeLeave` and make `switchMission` async:

```ts
  const switchMission = async () => {
    close();
    // The list shows where you left off: take the picture before the map goes away.
    await captureBeforeLeave();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
```

with `onPress={() => void switchMission()}`.

- [ ] **Step 5: Run to verify they pass, then the map folder**

Run: `npx jest src/features/map src/features/menus`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add __mocks__/@rnmapbox src/test-utils/mapbox-mock.ts src/features/map src/features/menus/menus/AppRootMenu.tsx src/features/menus/menus/AppRootMenu.test.tsx
git commit -m "feat: picture the mission map on blur, background and switch mission"
```

---

### Task 4: List logic and the sort setting

**Files:**
- Modify: `src/stores/settings.ts` (`MissionSort`, `missionSort`, `setMissionSort`)
- Create: `src/features/missions/mission-list.ts`
- Test: `src/features/missions/mission-list.test.ts` (create); add one case to the settings test file (`src/stores/settings.test.ts`)

**Interfaces:**
- Consumes: `MissionSummary`, `CategoryCounts` (Task 1).
- Produces (settings): `type MissionSort = 'recent' | 'name' | 'most'`, `MISSION_SORTS`, `missionSort` (default `'recent'`), `setMissionSort(sort: MissionSort)`.
- Produces (`mission-list.ts`): `NO_COUNTS: CategoryCounts`; `totalItems(c: CategoryCounts): number`; `sortMissions(list: readonly MissionSummary[], sort: MissionSort, counts: ReadonlyMap<string, CategoryCounts>): MissionSummary[]`; `filterMissions(list: readonly MissionSummary[], query: string): MissionSummary[]`; `pinnedMission(list: readonly MissionSummary[]): MissionSummary | null`; `mgrsSquare(center: LatLon): string | null`; `formatMissionTotals(missions: number, units: number): string`; `sortHeading(sort: MissionSort): string`.

- [ ] **Step 1: Write the failing tests**

`src/features/missions/mission-list.test.ts`:

```ts
import { filterMissions, formatMissionTotals, mgrsSquare, pinnedMission, sortHeading, sortMissions } from './mission-list';
import type { CategoryCounts, MissionSummary } from './repository';

const m = (id: string, name: string, lastOpenedAt: number | null): MissionSummary => ({ id, name, createdAt: 0, lastOpenedAt, camera: null, snapshot: null });
const c = (units: number, points = 0, lines = 0, polygons = 0): CategoryCounts => ({ units, points, lines, polygons });

const alpha = m('a', 'alpha', 100);
const bravo = m('b', 'Bravo', 300);
const charlie = m('c', 'charlie', null);
const delta = m('d', 'Delta', null);
const list = [alpha, bravo, charlie, delta];
const counts = new Map([
  ['a', c(5)],
  ['b', c(1, 1)],
  ['c', c(5)],
  ['d', c(0)],
]);
const ids = (l: MissionSummary[]) => l.map((x) => x.id);

describe('sortMissions', () => {
  it('Recent: last opened first, never opened last by name', () => {
    expect(ids(sortMissions(list, 'recent', counts))).toEqual(['b', 'a', 'c', 'd']);
  });
  it('Name: case-insensitive A to Z', () => {
    expect(ids(sortMissions(list, 'name', counts))).toEqual(['a', 'b', 'c', 'd']);
  });
  it('Most items: total descending, ties by Recent', () => {
    expect(ids(sortMissions(list, 'most', counts))).toEqual(['a', 'c', 'b', 'd']);
  });
  it('treats missing counts as zero', () => {
    expect(ids(sortMissions([delta, alpha], 'most', new Map()))).toEqual(['a', 'd']);
  });
});

describe('filterMissions', () => {
  it('matches names case-insensitively and ignores surrounding space', () => {
    expect(ids(filterMissions(list, '  BRA '))).toEqual(['b']);
  });
  it('lists every mission for a blank or whitespace query', () => {
    expect(filterMissions(list, '   ')).toHaveLength(4);
  });
});

describe('pinnedMission', () => {
  it('is the most recently opened, or null when none was opened', () => {
    expect(pinnedMission(list)?.id).toBe('b');
    expect(pinnedMission([charlie, delta])).toBeNull();
  });
});

describe('labels', () => {
  it('mgrsSquare gives zone, band and 100 km square', () => {
    expect(mgrsSquare({ lat: 38.8977, lon: -77.0365 })).toBe('18S UJ');
    expect(mgrsSquare({ lat: 89, lon: 0 })).toBeNull();
  });
  it('formatMissionTotals uses singular forms for one', () => {
    expect(formatMissionTotals(3, 43)).toBe('3 missions · 43 units plotted');
    expect(formatMissionTotals(1, 1)).toBe('1 mission · 1 unit plotted');
  });
  it('sortHeading names the list under the pinned card', () => {
    expect([sortHeading('recent'), sortHeading('name'), sortHeading('most')]).toEqual(['EARLIER', 'BY NAME', 'MOST ITEMS']);
  });
});
```

In `src/stores/settings.test.ts` add (match the file's existing persistence test style if it has one):

```ts
  it('defaults the missions sort to Recent and remembers a change', () => {
    expect(useSettings.getState().missionSort).toBe('recent');
    useSettings.getState().setMissionSort('most');
    expect(useSettings.getState().missionSort).toBe('most');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/features/missions/mission-list.test.ts src/stores/settings.test.ts`
Expected: FAIL (`./mission-list` not found; `missionSort` undefined).

- [ ] **Step 3: Implement**

`src/stores/settings.ts`:
- After `LabelSize`, add:

```ts
export type MissionSort = 'recent' | 'name' | 'most';
export const MISSION_SORTS: readonly MissionSort[] = ['recent', 'name', 'most'];
```

- `SettingsValues`: `missionSort: MissionSort;` — `SettingsActions`: `setMissionSort: (sort: MissionSort) => void;`
- `DEFAULT_SETTINGS`: `missionSort: 'recent',`
- `mergePersisted`: `missionSort: pick(p.missionSort, MISSION_SORTS, current.missionSort),`
- store: `setMissionSort: (missionSort) => set({ missionSort }),`
- `partialize`: add `missionSort` to the destructured parameters and the returned object.

`src/features/missions/mission-list.ts`:

```ts
import { splitMgrs, toMgrs } from '@/lib/geo/coords/mgrs';
import type { LatLon } from '@/lib/geo/types';
import type { MissionSort } from '@/stores/settings';

import type { CategoryCounts, MissionSummary } from './repository';

export const NO_COUNTS: CategoryCounts = { units: 0, points: 0, lines: 0, polygons: 0 };

export function totalItems(c: CategoryCounts): number {
  return c.units + c.points + c.lines + c.polygons;
}

const byName = (a: MissionSummary, b: MissionSummary) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Last opened first; never-opened missions last, by name. */
function byRecent(a: MissionSummary, b: MissionSummary): number {
  if (a.lastOpenedAt !== b.lastOpenedAt) {
    if (a.lastOpenedAt === null) return 1;
    if (b.lastOpenedAt === null) return -1;
    return b.lastOpenedAt - a.lastOpenedAt;
  }
  return byName(a, b);
}

export function sortMissions(list: readonly MissionSummary[], sort: MissionSort, counts: ReadonlyMap<string, CategoryCounts>): MissionSummary[] {
  const total = (m: MissionSummary) => totalItems(counts.get(m.id) ?? NO_COUNTS);
  const compare =
    sort === 'name' ? (a: MissionSummary, b: MissionSummary) => byName(a, b) || byRecent(a, b)
    : sort === 'most' ? (a: MissionSummary, b: MissionSummary) => total(b) - total(a) || byRecent(a, b)
    : byRecent;
  return [...list].sort(compare);
}

/** Missions whose name contains the query, ignoring case; a blank query keeps every mission. */
export function filterMissions(list: readonly MissionSummary[], query: string): MissionSummary[] {
  const q = query.trim().toLocaleLowerCase();
  return q ? list.filter((m) => m.name.toLocaleLowerCase().includes(q)) : [...list];
}

/** The most recently opened mission, or null when none has been opened. */
export function pinnedMission(list: readonly MissionSummary[]): MissionSummary | null {
  let best: MissionSummary | null = null;
  for (const m of list) {
    if (m.lastOpenedAt !== null && (best === null || m.lastOpenedAt > (best.lastOpenedAt ?? 0))) best = m;
  }
  return best;
}

/** "18S UJ": the grid zone and 100 km square of a position, or null outside MGRS. */
export function mgrsSquare(center: LatLon): string | null {
  const mgrs = toMgrs(center, 1);
  if (!mgrs.ok) return null;
  const parts = splitMgrs(mgrs.value);
  return parts.ok ? `${parts.value.zoneBand} ${parts.value.square}` : null;
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export function formatMissionTotals(missions: number, units: number): string {
  return `${plural(missions, 'mission')} · ${plural(units, 'unit')} plotted`;
}

export function sortHeading(sort: MissionSort): string {
  return sort === 'name' ? 'BY NAME' : sort === 'most' ? 'MOST ITEMS' : 'EARLIER';
}
```

If lint flags the chained ternary formatting, rewrite `compare` as a `switch` returning the comparator; behavior is the same.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest src/features/missions src/stores`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/settings.ts src/stores/settings.test.ts src/features/missions/mission-list.ts src/features/missions/mission-list.test.ts
git commit -m "feat: missions list sorting, search filter, pinned mission and labels"
```

---

### Task 5: Mission card components

**Files:**
- Create: `src/features/missions/list/MissionThumb.tsx`
- Create: `src/features/missions/list/CategoryCounts.tsx` (`CountsRow`, `StatsRow`)
- Create: `src/features/missions/list/MissionSwipeRow.tsx`
- Create: `src/features/missions/list/PinnedMissionCard.tsx`
- Create: `src/features/missions/list/MissionCard.tsx`
- Test: `src/features/missions/list/cards.test.tsx` (create)

**Interfaces:**
- Consumes: `MissionSummary`, `MissionSnapshot`, `CategoryCounts` (Task 1); `mgrsSquare`, `totalItems` (Task 4); `formatLastOpened`, `formatCategoryCounts` (`../format`).
- Produces: `type CardProps = { mission: MissionSummary; counts: CategoryCounts; now: number; onOpen: () => void; onRename: () => void; onDelete: () => void; onOpenActions: (row: SwipeableMethods) => void }`; `MissionCard(props: CardProps)`; `PinnedMissionCard(props: CardProps & { fill?: boolean })`; `MissionThumb`; `CountsRow({ counts })`; `StatsRow({ counts })`; `MissionSwipeRow`.

- [ ] **Step 1: Write the failing tests**

`src/features/missions/list/cards.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import type { MissionSummary } from '../repository';
import { MissionCard } from './MissionCard';
import { PinnedMissionCard } from './PinnedMissionCard';

const NOW = 1_000_000_000;
const camera = { center: { lat: 38.8977, lon: -77.0365 }, zoom: 12, bearing: 0 };
const mission = (over: Partial<MissionSummary> = {}): MissionSummary => ({
  id: 'm1',
  name: 'FTIG',
  createdAt: 0,
  lastOpenedAt: NOW - 13 * 3_600_000,
  camera,
  snapshot: { uri: 'file:///docs/mission-snapshots/m1.jpg', takenAt: 7 },
  ...over,
});
const counts = { units: 6, points: 3, lines: 3, polygons: 1 };
const handlers = () => ({ onOpen: jest.fn(), onRename: jest.fn(), onDelete: jest.fn(), onOpenActions: jest.fn() });

// See MissionsScreen.test: the swipeable's worklet warning only appears under Jest.
const consoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Some of the callbacks in the gesture are worklets')) return;
    consoleError(...args);
  });
});

describe('MissionCard', () => {
  it('shows the picture, opened time with grid square, and counts', async () => {
    const h = handlers();
    await renderWithProviders(<MissionCard mission={mission()} counts={counts} now={NOW} {...h} />);
    expect(screen.getByText('FTIG')).toBeTruthy();
    expect(screen.getByText('Opened 13 h ago · 18S UJ')).toBeTruthy();
    expect(screen.getByLabelText('6 units · 3 points · 3 lines · 1 polygon')).toBeTruthy();
    expect(screen.getByTestId('mission-thumb')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open FTIG'));
    expect(h.onOpen).toHaveBeenCalled();
  });

  it('shows the placeholder and the empty line for a never-opened empty mission', async () => {
    await renderWithProviders(
      <MissionCard mission={mission({ lastOpenedAt: null, camera: null, snapshot: null })} counts={{ units: 0, points: 0, lines: 0, polygons: 0 }} now={NOW} {...handlers()} />,
    );
    expect(screen.getByText('Never opened')).toBeTruthy();
    expect(screen.getByText('Empty — nothing plotted yet')).toBeTruthy();
    expect(screen.getByTestId('mission-thumb-placeholder')).toBeTruthy();
  });

  it('offers Rename and Delete as accessibility actions and swipe buttons', async () => {
    const h = handlers();
    await renderWithProviders(<MissionCard mission={mission()} counts={counts} now={NOW} {...h} />);
    await fireEvent(screen.getByLabelText('Open FTIG'), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(h.onDelete).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Edit FTIG'));
    expect(h.onRename).toHaveBeenCalled();
  });
});

describe('PinnedMissionCard', () => {
  it('shows LAST OPENED, the grid square, Resume and the four stats', async () => {
    const h = handlers();
    await renderWithProviders(<PinnedMissionCard mission={mission({ name: 'Mission 1', lastOpenedAt: NOW - 60_000 })} counts={counts} now={NOW} {...h} />);
    expect(screen.getByText('Last opened')).toBeTruthy();
    expect(screen.getByText('18S UJ')).toBeTruthy();
    expect(screen.getByText('Opened 1 min ago')).toBeTruthy();
    for (const label of ['UNITS', 'POINTS', 'LINES', 'POLYGONS']) expect(screen.getByText(label)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Resume Mission 1'));
    expect(h.onOpen).toHaveBeenCalled();
  });

  it('hides the grid square without a saved camera', async () => {
    await renderWithProviders(<PinnedMissionCard mission={mission({ camera: null })} counts={counts} now={NOW} {...handlers()} />);
    expect(screen.queryByText('18S UJ')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/missions/list`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/features/missions/list/MissionThumb.tsx`:

```tsx
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import type { MissionSnapshot } from '../repository';

type Props = {
  missionId: string;
  snapshot: MissionSnapshot | null;
  /** Size and shape of the box. */
  className: string;
  style?: StyleProp<ViewStyle>;
  iconSize: number;
  /** Overlays (tags), positioned absolutely by the caller. */
  children?: ReactNode;
};

/** The mission's map picture, or a dashed map placeholder before one was taken. */
export function MissionThumb({ missionId, snapshot, className, style, iconSize, children }: Props) {
  const { colors } = useTheme();
  if (!snapshot) {
    return (
      <View testID="mission-thumb-placeholder" style={style} className={`${className} items-center justify-center border border-dashed border-border bg-surface-input`}>
        <Icon name="map-outline" size={iconSize} color={colors['text-muted']} />
        {children}
      </View>
    );
  }
  return (
    <View style={style} className={`${className} overflow-hidden bg-surface-input`}>
      <Image
        testID="mission-thumb"
        // A new capture overwrites the file; the cache key changes with it.
        source={{ uri: snapshot.uri, cacheKey: `${missionId}-${snapshot.takenAt}` }}
        contentFit="cover"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityIgnoresInvertColors
      />
      {children}
    </View>
  );
}
```

`src/features/missions/list/CategoryCounts.tsx`:

```tsx
import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import type { SemanticToken } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { formatCategoryCounts } from '../format';
import type { CategoryCounts } from '../repository';

const CATEGORIES: readonly { key: keyof CategoryCounts; icon: IconName; label: string; color: SemanticToken }[] = [
  { key: 'units', icon: 'rhombus-outline', label: 'UNITS', color: 'friendly' },
  { key: 'points', icon: 'map-marker-outline', label: 'POINTS', color: 'accent' },
  { key: 'lines', icon: 'vector-polyline', label: 'LINES', color: 'text-muted' },
  { key: 'polygons', icon: 'pentagon-outline', label: 'POLYGONS', color: 'hostile' },
];

/** Compact counts for a list card: icon and number per category. */
export function CountsRow({ counts }: { counts: CategoryCounts }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={formatCategoryCounts(counts)} className="flex-row items-center gap-4">
      {CATEGORIES.map((c) => (
        <View key={c.key} className="flex-row items-center gap-1">
          <Icon name={c.icon} size={16} color={colors[c.color]} />
          <Text className="font-semibold text-text">{counts[c.key]}</Text>
        </View>
      ))}
    </View>
  );
}

/** The pinned card's stats: icon and large number over a spaced label. */
export function StatsRow({ counts }: { counts: CategoryCounts }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={formatCategoryCounts(counts)} className="flex-row">
      {CATEGORIES.map((c) => (
        <View key={c.key} className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Icon name={c.icon} size={18} color={colors[c.color]} />
            <Text className="text-2xl font-bold text-text">{counts[c.key]}</Text>
          </View>
          <Text className="text-xs font-semibold tracking-widest text-text-muted">{c.label}</Text>
        </View>
      ))}
    </View>
  );
}
```

`src/features/missions/list/MissionSwipeRow.tsx` — the swipe wrapper moved out of the old `MissionRow`:

```tsx
import { useRef, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  name: string;
  onPress: () => void;
  onRename: () => void;
  onDelete: () => void;
  onOpenActions: (row: SwipeableMethods) => void;
  /** The card's own look. */
  className: string;
  /** Fill the parent's height (the landscape pinned card). */
  fill?: boolean;
  children: ReactNode;
};

/** A mission card that opens on tap and swipes left for Edit and Delete. */
export function MissionSwipeRow({ name, onPress, onRename, onDelete, onOpenActions, className, fill, children }: Props) {
  const row = useRef<SwipeableMethods>(null);
  const { colors } = useTheme();
  const grow: StyleProp<ViewStyle> = fill ? { flex: 1 } : undefined;
  return (
    <ReanimatedSwipeable
      ref={row}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={grow}
      childrenContainerStyle={grow}
      onSwipeableWillOpen={() => {
        if (row.current) onOpenActions(row.current);
      }}
      renderRightActions={() => (
        <View className="ml-2 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${name}`}
            onPress={onRename}
            className="w-20 items-center justify-center gap-1 rounded-2xl border border-border bg-surface-raised active:opacity-60">
            <Icon name="pencil-outline" size={20} color={colors.text} />
            <Text className="font-semibold text-text">Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${name}`}
            onPress={onDelete}
            className="w-20 items-center justify-center gap-1 rounded-2xl bg-danger active:opacity-60">
            <Icon name="trash-can-outline" size={20} color={colors.text} />
            <Text className="font-bold text-text">Delete</Text>
          </Pressable>
        </View>
      )}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        // Swiping is hard to find with VoiceOver, so Rename and Delete are also accessibility actions.
        accessibilityActions={[
          { name: 'rename', label: 'Rename' },
          { name: 'delete', label: 'Delete' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'rename') onRename();
          if (e.nativeEvent.actionName === 'delete') onDelete();
        }}
        onPress={onPress}
        style={grow}
        className={className}>
        {children}
      </Pressable>
    </ReanimatedSwipeable>
  );
}
```

`src/features/missions/list/MissionCard.tsx`:

```tsx
import { Text, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { formatLastOpened } from '../format';
import { mgrsSquare, totalItems } from '../mission-list';
import type { CategoryCounts, MissionSummary } from '../repository';
import { CountsRow } from './CategoryCounts';
import { MissionSwipeRow } from './MissionSwipeRow';
import { MissionThumb } from './MissionThumb';

export type CardProps = {
  mission: MissionSummary;
  counts: CategoryCounts;
  now: number;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onOpenActions: (row: SwipeableMethods) => void;
};

/** A mission in the list: thumbnail, name, when it was opened and where, and its counts. */
export function MissionCard({ mission, counts, now, onOpen, onRename, onDelete, onOpenActions }: CardProps) {
  const { colors } = useTheme();
  const opened = formatLastOpened(mission.lastOpenedAt, now);
  const square = mission.lastOpenedAt !== null && mission.camera ? mgrsSquare(mission.camera.center) : null;
  return (
    <MissionSwipeRow
      name={mission.name}
      onPress={onOpen}
      onRename={onRename}
      onDelete={onDelete}
      onOpenActions={onOpenActions}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3 active:opacity-80">
      <MissionThumb missionId={mission.id} snapshot={mission.snapshot} className="h-20 w-20 rounded-xl" iconSize={24} />
      <View className="flex-1 gap-1">
        <Text numberOfLines={1} className="text-lg font-bold text-text">
          {mission.name}
        </Text>
        <Text numberOfLines={1} className="text-sm text-text-muted">
          {square ? `${opened} · ${square}` : opened}
        </Text>
        {totalItems(counts) === 0 ? <Text className="text-sm text-text-muted">Empty — nothing plotted yet</Text> : <CountsRow counts={counts} />}
      </View>
      <Icon name="chevron-right" size={24} color={colors['text-muted']} />
    </MissionSwipeRow>
  );
}
```

`src/features/missions/list/PinnedMissionCard.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { formatLastOpened } from '../format';
import { mgrsSquare } from '../mission-list';
import { StatsRow } from './CategoryCounts';
import type { CardProps } from './MissionCard';
import { MissionSwipeRow } from './MissionSwipeRow';
import { MissionThumb } from './MissionThumb';

/** The last-opened mission, pinned above the list: its map picture, Resume and its stats. */
export function PinnedMissionCard({ mission, counts, now, onOpen, onRename, onDelete, onOpenActions, fill }: CardProps & { fill?: boolean }) {
  const { colors } = useTheme();
  const square = mission.camera ? mgrsSquare(mission.camera.center) : null;
  return (
    <MissionSwipeRow
      name={mission.name}
      onPress={onOpen}
      onRename={onRename}
      onDelete={onDelete}
      onOpenActions={onOpenActions}
      fill={fill}
      className="overflow-hidden rounded-2xl border border-accent bg-surface-raised active:opacity-90">
      <MissionThumb
        missionId={mission.id}
        snapshot={mission.snapshot}
        className={fill ? 'flex-1' : 'w-full'}
        style={fill ? undefined : { aspectRatio: 2.5 }}
        iconSize={32}>
        <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-surface-chrome px-3 py-1">
          <View className="h-2 w-2 rounded-full bg-accent" />
          <Text className="text-xs font-bold uppercase tracking-widest text-accent">Last opened</Text>
        </View>
        {square ? (
          <View className="absolute right-3 top-3 rounded-full bg-surface-chrome px-3 py-1">
            <Text className="font-mono text-xs text-text">{square}</Text>
          </View>
        ) : null}
      </MissionThumb>
      <View className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text numberOfLines={1} className="text-2xl font-bold text-text">
              {mission.name}
            </Text>
            <Text className="text-sm text-text-muted">{formatLastOpened(mission.lastOpenedAt, now)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Resume ${mission.name}`}
            onPress={onOpen}
            className="flex-row items-center gap-1 rounded-xl bg-accent px-4 py-2.5 active:opacity-80">
            <Text className="text-base font-bold text-on-accent">Resume</Text>
            <Icon name="chevron-right" size={20} color={colors['on-accent']} />
          </Pressable>
        </View>
        <View className="h-px bg-border" />
        <StatsRow counts={counts} />
      </View>
    </MissionSwipeRow>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/features/missions/list`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/missions/list
git commit -m "feat: pinned and list mission cards with map pictures and counts"
```

---

### Task 6: The missions screen

**Files:**
- Create: `src/features/missions/list/MissionsHeader.tsx`
- Modify: `src/features/missions/MissionsScreen.tsx` (rewrite the layout; keep delete/rename/seed logic)
- Test: `src/features/missions/MissionsScreen.test.tsx` (update)

**Interfaces:**
- Consumes: everything above: `observeMissionSummaries`, `observeCountsByMission`, `sortMissions`, `filterMissions`, `pinnedMission`, `formatMissionTotals`, `sortHeading`, `NO_COUNTS`, `MissionCard`, `PinnedMissionCard`, `useSettings` `missionSort`/`setMissionSort`, `isLandscape` (`@/features/map/layout`).
- Produces: `MissionsHeader({ landscape, subtitle, showControls, sort, onSort, query, onQuery, onNew, extra })`.

- [ ] **Step 1: Update the tests first**

In `src/features/missions/MissionsScreen.test.tsx`:

1. Add near the other mocks, to control orientation:

```tsx
const mockDims = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims }));
```

and in `beforeEach`: `Object.assign(mockDims, { width: 390, height: 844 }); useSettings.setState(DEFAULT_SETTINGS);` (import `DEFAULT_SETTINGS, useSettings` from `@/stores/settings`).

2. Replace the "lists missions" test:

```tsx
  it('pins the last-opened mission and lists the rest under EARLIER with counts', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!iron.ok || !cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });

    await renderWithProviders(<MissionsScreen />, ctx);

    expect(await screen.findByText('2 missions · 2 units plotted')).toBeTruthy();
    expect(screen.getByText('Last opened')).toBeTruthy();
    expect(screen.getByLabelText('Resume Op Cobra')).toBeTruthy();
    expect(screen.getByText('EARLIER')).toBeTruthy();
    expect(await screen.findByLabelText('2 units · 0 points · 0 lines · 0 polygons')).toBeTruthy();
    expect(screen.getByText('Never opened')).toBeTruthy();
    // The pinned mission is not listed again.
    expect(screen.getAllByLabelText('Open Op Cobra')).toHaveLength(1);
  });

  it('Resume opens the pinned mission', async () => {
    const ctx = makeTestContext();
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await renderWithProviders(<MissionsScreen />, ctx);
    await fireEvent.press(await screen.findByLabelText('Resume Op Cobra'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/missions/[missionId]', params: { missionId: cobra.value.id } });
  });

  it('sorts with the chips and remembers the choice', async () => {
    const ctx = makeTestContext();
    for (const name of ['bravo', 'Alpha', 'charlie']) await createMission(ctx, { name });
    const big = await createMission(ctx, { name: 'zulu' });
    if (!big.ok) throw new Error('setup');
    await placePoint(ctx, { missionId: big.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await renderWithProviders(<MissionsScreen />, ctx);
    const order = () => screen.getAllByLabelText(/^Open /).map((n) => n.props.accessibilityLabel);

    await screen.findByText('EARLIER');
    expect(order()).toEqual(['Open Alpha', 'Open bravo', 'Open charlie', 'Open zulu']);
    await fireEvent.press(screen.getByLabelText('Most items'));
    expect(screen.getByText('MOST ITEMS')).toBeTruthy();
    await waitFor(() => expect(order()[0]).toBe('Open zulu'));
    await fireEvent.press(screen.getByLabelText('Name'));
    expect(screen.getByText('BY NAME')).toBeTruthy();
    expect(useSettings.getState().missionSort).toBe('name');
  });

  it('searches by name: hides the pinned card, filters, and says when nothing matches', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!iron.ok || !cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await renderWithProviders(<MissionsScreen />, ctx);

    await fireEvent.press(await screen.findByLabelText('Search missions'));
    expect(screen.queryByText('Last opened')).toBeNull();
    expect(screen.queryByText('EARLIER')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('Search by name'), 'iron');
    expect(screen.getByLabelText('Open Op Iron')).toBeTruthy();
    expect(screen.queryByLabelText('Open Op Cobra')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('Search by name'), 'zzz');
    expect(screen.getByText('No missions match “zzz”')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(screen.getByText('Last opened')).toBeTruthy();
  });

  it('puts the pinned card in its own column in landscape', async () => {
    Object.assign(mockDims, { width: 844, height: 390 });
    const ctx = makeTestContext();
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    await createMission(ctx, { name: 'Op Iron' });
    if (!cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await renderWithProviders(<MissionsScreen />, ctx);
    expect(await screen.findByTestId('pinned-column')).toBeTruthy();
    expect(screen.getByText('Last opened')).toBeTruthy();
    expect(screen.getByLabelText('Open Op Iron')).toBeTruthy();
  });
```

3. In "opens a mission and offers New": replace `'Swipe a mission left to edit or delete it.'` with `'Swipe a mission for edit & delete'`, and press `screen.getByLabelText('New mission')` instead of `getByText('+ New')`. In the empty-state test, use `queryByText('Swipe a mission for edit & delete')`.

4. In both `setup()` helpers of `deleting`, replace the `findByText('2 units · 0 points · 0 lines · 0 polygons · Never opened')` wait with `await screen.findByLabelText('2 units · 0 points · 0 lines · 0 polygons');`.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx jest src/features/missions/MissionsScreen.test.tsx`
Expected: FAIL (no "Last opened", no chips, no search).

- [ ] **Step 3: Implement the header**

`src/features/missions/list/MissionsHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import type { MissionSort } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

const CHIPS: readonly { sort: MissionSort; label: string }[] = [
  { sort: 'recent', label: 'Recent' },
  { sort: 'name', label: 'Name' },
  { sort: 'most', label: 'Most items' },
];

type Props = {
  landscape: boolean;
  subtitle: string;
  /** Sorting, search and New only make sense with missions to show. */
  showControls: boolean;
  sort: MissionSort;
  onSort: (sort: MissionSort) => void;
  /** null when not searching. */
  query: string | null;
  onQuery: (query: string | null) => void;
  onNew: () => void;
  /** Dev-only buttons. */
  extra?: ReactNode;
};

/** Title and totals, search and New, then the sort chips (or the search field while searching). */
export function MissionsHeader({ landscape, subtitle, showControls, sort, onSort, query, onQuery, onNew, extra }: Props) {
  const { colors } = useTheme();
  const searching = query !== null;
  const title = (
    <View className={landscape ? 'flex-1 flex-row items-baseline gap-4' : 'flex-1'}>
      <Text className="text-3xl font-bold uppercase tracking-widest text-text">Missions</Text>
      {showControls ? <Text className="text-base text-text-muted">{subtitle}</Text> : null}
    </View>
  );
  const buttons = showControls ? (
    <>
      {searching ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search missions"
          onPress={() => onQuery('')}
          className="h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-raised active:opacity-80">
          <Icon name="magnify" size={24} color={colors.text} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New mission"
        onPress={onNew}
        className="h-12 flex-row items-center gap-1 rounded-xl bg-accent px-4 active:opacity-80">
        <Icon name="plus" size={22} color={colors['on-accent']} />
        <Text className="text-base font-bold text-on-accent">New</Text>
      </Pressable>
    </>
  ) : null;
  const filters = !showControls ? null : searching ? (
    <View className={`flex-row items-center gap-2 ${landscape ? 'flex-1' : ''}`}>
      <TextInput
        autoFocus
        value={query}
        onChangeText={onQuery}
        placeholder="Search by name"
        placeholderTextColor={colors['text-muted']}
        accessibilityLabel="Search by name"
        returnKeyType="search"
        className="h-11 flex-1 rounded-xl border border-border bg-surface-input px-3 text-base text-text"
      />
      <Pressable accessibilityRole="button" onPress={() => onQuery(null)} hitSlop={8} className="px-2">
        <Text className="text-base font-semibold text-text">Cancel</Text>
      </Pressable>
    </View>
  ) : (
    <View className="flex-row gap-2">
      {CHIPS.map((chip) => {
        const selected = chip.sort === sort;
        return (
          <Pressable
            key={chip.sort}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            accessibilityState={{ selected }}
            onPress={() => onSort(chip.sort)}
            className={`rounded-full border px-4 py-2 ${selected ? 'border-accent bg-accent-subtle' : 'border-border'}`}>
            <Text className={`text-base font-semibold ${selected ? 'text-accent' : 'text-text'}`}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (landscape) {
    return (
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-4">
        {title}
        {extra}
        {filters}
        {buttons}
      </View>
    );
  }
  return (
    <View className="gap-4 px-4 pb-3 pt-4">
      <View className="flex-row items-center gap-3">
        {title}
        {extra}
        {buttons}
      </View>
      {filters}
    </View>
  );
}
```

- [ ] **Step 4: Rewrite the screen**

`src/features/missions/MissionsScreen.tsx` — keep the existing imports for router, ConfirmDialog, seeding, `deleteMission`, `notifySuccess`, `useObservable`, `useCommandContext`, `formatCategoryCounts`; drop `ReanimatedSwipeable` (now in `MissionSwipeRow`), `MissionRow` and `observeMissionCategoryCounts`. New body:

```tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { PERF_SEED_COUNT, seedPerformanceMission } from '@/features/dev/commands';
import { notifySuccess } from '@/features/feedback/feedback';
import { isLandscape } from '@/features/map/layout';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { deleteMission } from './commands';
import { formatCategoryCounts } from './format';
import { MissionCard } from './list/MissionCard';
import { MissionsHeader } from './list/MissionsHeader';
import { PinnedMissionCard } from './list/PinnedMissionCard';
import { filterMissions, formatMissionTotals, NO_COUNTS, pinnedMission, sortHeading, sortMissions } from './mission-list';
import { observeCountsByMission, observeMissionSummaries, type CategoryCounts, type MissionSummary } from './repository';

const NO_COUNT_MAP: ReadonlyMap<string, CategoryCounts> = new Map();

export function MissionsScreen() {
  const ctx = useCommandContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = isLandscape(width, height);
  const missions = useObservable<MissionSummary[] | null>(() => observeMissionSummaries(ctx.db), null, [ctx]);
  const idsKey = (missions ?? []).map((m) => m.id).join(',');
  const counts = useObservable(() => observeCountsByMission(ctx.db, idsKey ? idsKey.split(',') : []), NO_COUNT_MAP, [ctx, idsKey]);
  const countsOf = (id: string) => counts.get(id) ?? NO_COUNTS;
  const sort = useSettings((s) => s.missionSort);
  const setSort = useSettings((s) => s.setMissionSort);
  const [query, setQuery] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const openCreate = () => router.push('/missions/new');
  const openMission = (missionId: string) => router.push({ pathname: '/missions/[missionId]', params: { missionId } });

  // (Keep the existing swipe/rename/delete/seed state and handlers here unchanged, except:)
  // askDelete takes only the mission and reads its counts:
  //   const askDelete = (mission: MissionSummary) => { openRow.current?.close(); setDeleteError(null);
  //     setPending({ id: mission.id, name: mission.name, counts: countsOf(mission.id) }); };

  const all = missions ?? [];
  const pinned = query === null ? pinnedMission(all) : null;
  const listed = sortMissions(filterMissions(all, query ?? ''), sort, counts).filter((m) => m.id !== pinned?.id);
  const units = all.reduce((n, m) => n + countsOf(m.id).units, 0);
  const heading = query === null && listed.length > 0 ? sortHeading(sort) : null;
  const cardProps = (m: MissionSummary) => ({
    mission: m,
    counts: countsOf(m.id),
    now,
    onOpen: () => openMission(m.id),
    onRename: () => openRename(m.id),
    onDelete: () => askDelete(m),
    onOpenActions: rowOpened,
  });

  const list = (
    <FlatList
      data={listed}
      keyExtractor={(m) => m.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          {!landscape && pinned ? (
            <View className="mb-3">
              <PinnedMissionCard {...cardProps(pinned)} />
            </View>
          ) : null}
          {heading ? <Text className="mt-2 text-sm font-bold tracking-widest text-text-muted">{heading}</Text> : null}
        </>
      }
      ListEmptyComponent={
        query?.trim() ? <Text className="py-8 text-center text-base text-text-muted">{`No missions match “${query.trim()}”`}</Text> : null
      }
      ListFooterComponent={<SwipeHint />}
      contentContainerStyle={{ paddingHorizontal: landscape ? 0 : 16, paddingBottom: insets.bottom + 16, gap: 12 }}
      renderItem={({ item }) => <MissionCard {...cardProps(item)} />}
    />
  );

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <MissionsHeader
        landscape={landscape}
        subtitle={formatMissionTotals(all.length, units)}
        showControls={all.length > 0}
        sort={sort}
        onSort={setSort}
        query={query}
        onQuery={setQuery}
        onNew={openCreate}
        extra={
          __DEV__ ? (
            <Pressable accessibilityRole="button" onPress={() => void seed()} hitSlop={8}>
              <Text className="text-xs uppercase tracking-wider text-text-muted">Seed 5k</Text>
            </Pressable>
          ) : null
        }
      />
      {missions === null ? null : missions.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : landscape ? (
        <View className="flex-1 flex-row gap-4 px-4" style={{ paddingBottom: pinned ? insets.bottom + 16 : 0 }}>
          {pinned ? (
            <View testID="pinned-column" className="flex-1">
              <PinnedMissionCard {...cardProps(pinned)} fill />
            </View>
          ) : null}
          <View className="flex-1">{list}</View>
        </View>
      ) : (
        list
      )}
      {/* ConfirmDialog unchanged */}
    </View>
  );
}

function SwipeHint() {
  const { colors } = useTheme();
  return (
    <View className="mt-4 flex-row items-center justify-center gap-2">
      <Icon name="chevron-left" size={18} color={colors['text-muted']} />
      <Text className="text-sm text-text-muted">Swipe a mission for edit & delete</Text>
    </View>
  );
}
```

Write the file out in full (no comment placeholders): carry over `openRow`, `pending`, `deleteError`, `deleting`, `rowOpened`, `openRename`, `confirmDelete`, `seeding`, `seed`, the `ConfirmDialog` element and `EmptyState` verbatim from the current file, with `askDelete` changed as noted. Note `SwipeHint` renders only inside the list, so the empty state never shows it.

- [ ] **Step 5: Run the missions tests, then everything**

Run: `npx jest src/features/missions` then `npx jest`
Expected: PASS (whole suite green).

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors, 0 problems.

- [ ] **Step 7: Commit**

```bash
git add src/features/missions
git commit -m "feat: missions screen with pinned last-opened card, sort chips, search and landscape columns"
```

- [ ] **Step 8: Device check (manual, report results)**

On an iOS development build (new build needed for `expo-image-manipulator`): open a mission, plot something, use Menu → Switch mission; the pinned card shows the picture with symbology. Background the app inside a mission, return to the list; the picture updates. Swipe back from a mission; the picture updates. Rotate to landscape; the pinned card sits in the left column.
