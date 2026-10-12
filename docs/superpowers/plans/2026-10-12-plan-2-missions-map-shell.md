# Plan 2 — Missions & Map Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app opens on a missions list, creates and opens missions, and shows each
mission's map: satellite basemap, saved points with label chips, the user's heading-aware
position, an always-visible crosshair with an MGRS readout, map controls and the top toolbar.

**Architecture:** Thin Expo Router routes compose feature screens. Screens read through
repository observables (`useObservable`) and write through commands, with the
`CommandContext` supplied by a React provider so tests inject an in-memory database. The map is
uncontrolled: `MapCanvas` owns the native camera and feeds a throttled camera snapshot into a
Zustand `interaction` store; only the readout and the north-up needle subscribe to it.
Location is a hook writing to a `presence` store; layers render from stores and observables
through `ShapeSource` + `SymbolLayer`.

**Tech Stack:** Expo SDK 57, RN 0.86, Expo Router (typed routes), NativeWind 4,
`@rnmapbox/maps` 10.3, WatermelonDB 0.28, Zustand 5, rxjs 7, `expo-location`,
`@expo/vector-icons` (MaterialCommunityIcons), `@expo-google-fonts/jetbrains-mono`, Jest +
React Native Testing Library 14.

**Spec:** `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md` (Sections 4,
5.4, 7, 8.1–8.4, 8.6, 8.6a, 8.7, 8.8, 9, 10, 12, 13, 15, 16). Mockups:
`docs/design/mockups/portrait-map-idle.png`, `landscape-map-idle.png`. Device gate results:
`docs/superpowers/notes/2026-10-12-native-gate.md` (iOS passed; Android deferred).

### Roadmap (this plan is 2 of 3)

| Plan | Delivers |
|------|----------|
| 1 — Foundation | done (merged) |
| **2 — Missions & map shell** (this) | missions screens + navigation, `MapCanvas`, `SelfLayer`, `PointsLayer` + label chips, crosshair + readout, map controls, toolbar, fonts/icons, location, offline `TilePackService` (no UI), 5k-point seed, `map-performance` skill |
| 3 — Menus & points | `Panel`, menu registry/stack/host, menu primitives, `app.root` / `settings` / `point.add` / `point.edit`, draft store + `DraftLayer`, camera padding, long-press, item selection, `menus` + `map-item-kinds` skills |

Out of scope here (Plan 3): any menu or panel, POINT tool behavior, settings UI, long-press,
tapping points, camera padding. In this plan the POINT and gear buttons render **disabled**,
and the hamburger temporarily performs "Switch mission" (back to the list).

## Global Constraints

- Expo SDK 57 (`expo ~57.0.28`), React Native 0.86.3, React 19.2.3; React Compiler stays enabled.
- Install packages with `npx expo install <pkg>` (dev deps: `npx expo install <pkg> -- --save-dev`).
- **No packages with native code** in this plan (the user's EAS dev build must keep working without a rebuild). The only new packages are `@expo/vector-icons` and `@expo-google-fonts/jetbrains-mono` (JS + font assets).
- Never create or edit `ios/` or `android/`. Web is not a target.
- Canonical geo forms: positions WGS84 `{ lat, lon }`; bearings true north, decimal degrees. Range/bearing text only via `describeVector`; coordinates only via `@/lib/geo` formatters.
- Mils: NATO 6400 only.
- Only `src/features/map/**` imports `@rnmapbox/maps`. Only `src/lib/db/**`, `src/features/*/repository.ts`, `src/features/*/commands.ts` import `@nozbe/watermelondb`. `src/lib/**` never imports `features/`, `stores/`, `components/`, `app/` (all lint-enforced).
- All writes go through commands taking a `CommandContext`; UI gets it from `useCommandContext()`.
- Routes in `src/app/` only compose features (no logic beyond reading params).
- The map camera is uncontrolled: no React state drives `Camera`; programmatic moves use the camera ref's `setCamera`. No per-item React components on the map. Layer style objects are module constants or memoized per theme.
- Colors: semantic tokens only (`bg-surface`, `text-text-muted`, `useTheme().colors.accent`); no hex literals, no raw palette classes, no opacity modifiers on tokens (see `.agents/skills/styling/SKILL.md`).
- Icons only through `@/components/ui/Icon` (MaterialCommunityIcons names).
- Screen-edge spacing and chrome sizes only from `src/features/map/layout.ts` constants.
- Copy: uppercase tracked labels for tool and section labels (`POINT`, `MISSIONS`); readout text in the mono font (`font-mono`, `font-mono-bold`).
- Tests: React Native Testing Library 14 — `render`, `fireEvent.*`, `act` are **async; always `await` them**. Wrap UI in `renderWithProviders` (Task 1).
- Any test whose imports reach `@rnmapbox/maps` must call `jest.mock('@rnmapbox/maps');` (uses the manual mock `__mocks__/@rnmapbox/maps.tsx` from Task 8). Inspect what layers received via `mapboxMock()` from `@/test-utils/mapbox-mock`.
- After adding or renaming any file under `src/app/`, regenerate typed routes before `tsc`: `npx expo export --platform ios --output-dir /tmp/rtap-typegen > /dev/null` (rewrites `.expo/types/router.d.ts`; also proves the app bundles).
- Commit messages use Conventional Commits (`.agents/skills/commits/SKILL.md`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before declaring any task done: `npx jest`, `npx tsc --noEmit`, `npx expo lint` all pass.

## Review Focus

1. **Double-tapping "Create"** on the new-mission sheet: exactly one mission is created and the app navigates once. → test in Task 4.
2. **Opening a stale or deleted mission** (old deep link, mission soft-deleted later): the user lands back on the missions list; nothing crashes and no empty map shows. → tests in Tasks 2 and 13.
3. **Leaving the app while on the map** (home button, app switcher kill): the last camera is saved when the app goes to the background, so reopening the mission restores where the user was. → test in Task 13.
4. **Compass unavailable or wrapping north** (`trueHeading` −1, heading 359° → 1°): no fake north-pointing arrow when heading is unknown (no-heading icon instead); a 2° change across north counts as 2°, not 358°. → tests in Tasks 6 and 9.
5. **Crosshair outside MGRS coverage or across the antimeridian** (world view, polar pan, Mapbox reporting lon 190): the readout shows lat/lon with a normalized longitude, never blank, `NaN` or an exception. → tests in Tasks 8 and 10.

---

### Task 1: App shell — providers, fonts, icons, env, `useObservable`

**Files:**
- Modify: `package.json` (via `npx expo install`), `tailwind.config.js`, `jest.setup.ts`, `src/app/_layout.tsx`
- Create: `src/config/env.ts`, `src/config/env.test.ts`, `src/hooks/use-observable.ts`, `src/hooks/use-observable.test.tsx`, `src/lib/db/command-context-provider.tsx`, `src/lib/db/command-context-provider.test.tsx`, `src/lib/db/app-command-context.ts`, `src/components/ui/Icon.tsx`, `src/test-utils/render.tsx`

**Interfaces:**
- Consumes: `CommandContext` (`@/lib/db/command-context`), `getAppDatabase()` (`@/lib/db/app-database`), `getDeviceId()` (`@/lib/identity/device-id`), `makeTestContext()` (`@/lib/db/test-database`), `ThemeProvider`, `useTheme()` (`@/theme/ThemeProvider`).
- Produces:
  - `getMapboxToken(raw?: string): string | null` from `@/config/env`
  - `useObservable<T>(factory: () => Observable<T>, initial: T, deps: readonly unknown[]): T` from `@/hooks/use-observable`
  - `CommandContextProvider({ value, children })`, `useCommandContext(): CommandContext` from `@/lib/db/command-context-provider`
  - `getAppCommandContext(): CommandContext` from `@/lib/db/app-command-context`
  - `Icon({ name, size?, color })`, `type IconName` from `@/components/ui/Icon`
  - `renderWithProviders(ui, ctx?) → Promise<RenderResult & { ctx: CommandContext }>` from `@/test-utils/render`
  - Tailwind classes `font-mono` (JetBrains Mono Medium) and `font-mono-bold` (JetBrains Mono Bold)

- [ ] **Step 1: Install the JS-only packages**

```bash
npx expo install @expo/vector-icons @expo-google-fonts/jetbrains-mono
```

- [ ] **Step 2: Write the failing tests**

`src/config/env.test.ts`:

```ts
import { getMapboxToken } from './env';

describe('getMapboxToken', () => {
  it('returns a trimmed token', () => {
    expect(getMapboxToken('  pk.abc  ')).toBe('pk.abc');
  });

  it.each([[undefined], [''], ['   ']])('returns null for %p', (raw) => {
    expect(getMapboxToken(raw)).toBeNull();
  });
});
```

`src/hooks/use-observable.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BehaviorSubject } from 'rxjs';

import { useObservable } from './use-observable';

function Probe({ source }: { source: BehaviorSubject<number> }) {
  const value = useObservable(() => source, -1, [source]);
  return <Text>{`v:${value}`}</Text>;
}

describe('useObservable', () => {
  it('renders emitted values and unsubscribes on unmount', async () => {
    const source = new BehaviorSubject(1);
    const { unmount } = await render(<Probe source={source} />);
    expect(screen.getByText('v:1')).toBeTruthy();
    await act(async () => source.next(2));
    expect(screen.getByText('v:2')).toBeTruthy();
    await unmount();
    expect(source.observed).toBe(false);
  });
});
```

`src/lib/db/command-context-provider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CommandContextProvider, useCommandContext } from './command-context-provider';
import { makeTestContext } from './test-database';

function Probe() {
  return <Text>{useCommandContext().actorId()}</Text>;
}

describe('CommandContextProvider', () => {
  it('provides the command context', async () => {
    await render(
      <CommandContextProvider value={makeTestContext()}>
        <Probe />
      </CommandContextProvider>,
    );
    expect(screen.getByText('device-test')).toBeTruthy();
  });

  it('throws outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow('useCommandContext must be used inside CommandContextProvider');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/config src/hooks src/lib/db/command-context-provider.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`src/config/env.ts`:

```ts
/**
 * Public Mapbox token from `.env` (EXPO_PUBLIC_MAPBOX_TOKEN); null when missing or blank.
 * The default must stay a static `process.env.EXPO_PUBLIC_…` access so Expo inlines it.
 */
export function getMapboxToken(raw: string | undefined = process.env.EXPO_PUBLIC_MAPBOX_TOKEN): string | null {
  const token = raw?.trim();
  return token ? token : null;
}
```

`src/hooks/use-observable.ts`:

```ts
import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';

/** Subscribes for the component's lifetime; re-subscribes when `deps` change. */
export function useObservable<T>(factory: () => Observable<T>, initial: T, deps: readonly unknown[]): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = factory().subscribe({
      next: setValue,
      error: (e: unknown) => console.error('[useObservable]', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
```

`src/lib/db/command-context-provider.tsx`:

```tsx
import { createContext, use, type ReactNode } from 'react';

import type { CommandContext } from './command-context';

const Context = createContext<CommandContext | null>(null);

/** Supplies the database and identity to screens; tests pass an in-memory context. */
export function CommandContextProvider({ value, children }: { value: CommandContext; children: ReactNode }) {
  return <Context value={value}>{children}</Context>;
}

export function useCommandContext(): CommandContext {
  const value = use(Context);
  if (!value) throw new Error('useCommandContext must be used inside CommandContextProvider');
  return value;
}
```

`src/lib/db/app-command-context.ts`:

```ts
import { getDeviceId } from '@/lib/identity/device-id';

import { getAppDatabase } from './app-database';
import type { CommandContext } from './command-context';

let instance: CommandContext | null = null;

/** The app's command context: on-device database, device identity, wall clock. */
export function getAppCommandContext(): CommandContext {
  instance ??= { db: getAppDatabase(), actorId: getDeviceId, now: Date.now };
  return instance;
}
```

`src/components/ui/Icon.tsx`:

```tsx
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** The app's only icon set. Pass a theme color (`useTheme().colors.*`). */
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
```

`src/test-utils/render.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import type { CommandContext } from '@/lib/db/command-context';
import { CommandContextProvider } from '@/lib/db/command-context-provider';
import { makeTestContext } from '@/lib/db/test-database';
import { ThemeProvider } from '@/theme/ThemeProvider';

/** Renders with the dark theme and an in-memory command context (fresh unless given). */
export async function renderWithProviders(ui: ReactElement, ctx: CommandContext = makeTestContext()) {
  const result = await render(
    <CommandContextProvider value={ctx}>
      <ThemeProvider theme="dark">{ui}</ThemeProvider>
    </CommandContextProvider>,
  );
  return { ...result, ctx };
}
```

Add to `jest.setup.ts` (after the existing mocks):

```ts
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
```

In `tailwind.config.js`, add `fontFamily` inside `theme.extend` (keep `colors`):

```js
      fontFamily: {
        mono: ['JetBrainsMono_500Medium'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
```

Replace `src/app/_layout.tsx`:

```tsx
import '../global.css';

import { JetBrainsMono_500Medium, JetBrainsMono_700Bold, useFonts } from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getAppCommandContext } from '@/lib/db/app-command-context';
import { CommandContextProvider } from '@/lib/db/command-context-provider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ JetBrainsMono_500Medium, JetBrainsMono_700Bold });
  // A font failure falls back to the system font rather than blocking the app.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CommandContextProvider value={getAppCommandContext()}>
        <ThemeProvider theme="dark">
          <StatusBar style="light" />
          <ThemedStack />
        </ThemeProvider>
      </CommandContextProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: all pass. (If `fontError` is typed `Error | null` vs `undefined` differently, compare with `!= null`.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add app providers, fonts, icons and observable hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Mission reads for the list — deleted guard and row formatting

**Files:**
- Modify: `src/features/missions/repository.ts` (`findMission`), `src/features/missions/missions.test.ts`
- Create: `src/features/missions/format.ts`, `src/features/missions/format.test.ts`

**Interfaces:**
- Consumes: `findMission(db, id)` (existing).
- Produces:
  - `findMission` now returns `null` for soft-deleted missions.
  - `formatLastOpened(ts: number | null, now: number): string`, `formatItemCount(n: number): string` from `@/features/missions/format`.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/missions/missions.test.ts` inside `describe('missions', …)`:

```ts
  it('treats a soft-deleted mission as missing', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Gone' });
    if (!r.ok) throw new Error('setup');
    const mission = await findMission(ctx.db, r.value.id);
    await ctx.db.write(() => mission!.markAsDeleted());
    expect(await findMission(ctx.db, r.value.id)).toBeNull();
  });
```

`src/features/missions/format.test.ts`:

```ts
import { formatItemCount, formatLastOpened } from './format';

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const MIN = 60_000;

describe('formatLastOpened', () => {
  it.each([
    [null, 'Never opened'],
    [NOW - 30_000, 'Opened just now'],
    [NOW + 5 * MIN, 'Opened just now'], // clock skew: future timestamps never go negative
    [NOW - 5 * MIN, 'Opened 5 min ago'],
    [NOW - 3 * 60 * MIN, 'Opened 3 h ago'],
    [NOW - 2 * 24 * 60 * MIN, 'Opened 2 d ago'],
    [Date.UTC(2026, 8, 1, 8, 0, 0), 'Opened 2026-09-01'],
  ])('%p → %p', (ts, expected) => {
    expect(formatLastOpened(ts, NOW)).toBe(expected);
  });
});

describe('formatItemCount', () => {
  it.each([
    [0, '0 items'],
    [1, '1 item'],
    [5000, '5000 items'],
  ])('%p → %p', (n, expected) => {
    expect(formatItemCount(n)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/missions`
Expected: FAIL — `format` module missing; deleted mission still found.

- [ ] **Step 3: Implement**

In `src/features/missions/repository.ts`, replace `findMission`:

```ts
/** Returns null for unknown ids and for soft-deleted (markAsDeleted) missions. */
export async function findMission(db: Database, id: string): Promise<Mission | null> {
  let mission: Mission;
  try {
    mission = await db.get<Mission>(Tables.missions).find(id);
  } catch {
    return null;
  }
  if (mission._raw._status === 'deleted') return null;
  return mission;
}
```

`src/features/missions/format.ts`:

```ts
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Mission row "last opened" text. Dates older than a week show as YYYY-MM-DD (UTC). */
export function formatLastOpened(ts: number | null, now: number): string {
  if (ts === null) return 'Never opened';
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return 'Opened just now';
  if (diff < HOUR) return `Opened ${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `Opened ${Math.floor(diff / HOUR)} h ago`;
  if (diff < 7 * DAY) return `Opened ${Math.floor(diff / DAY)} d ago`;
  return `Opened ${new Date(ts).toISOString().slice(0, 10)}`;
}

export function formatItemCount(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/features/missions && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/missions
git commit -m "feat: hide deleted missions and format mission rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Missions screen and route skeletons

**Files:**
- Create: `src/features/missions/MissionsScreen.tsx`, `src/features/missions/MissionsScreen.test.tsx`, `src/app/missions/new.tsx` (placeholder), `src/app/missions/[missionId].tsx` (placeholder)
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: `useObservable`, `useCommandContext`, `renderWithProviders` (Task 1); `formatItemCount`, `formatLastOpened` (Task 2); `observeMissionSummaries(db)`, `observeMissionItemCount(db, missionId)`, `MissionSummary` (`./repository`).
- Produces: `MissionsScreen` (no props). Navigation contract used by later tasks: create → `router.push('/missions/new')`; open → `router.push({ pathname: '/missions/[missionId]', params: { missionId } })`.

- [ ] **Step 1: Create the route skeletons and regenerate typed routes**

`src/app/missions/new.tsx` (replaced in Task 4):

```tsx
export default function NewMissionRoute() {
  return null;
}
```

`src/app/missions/[missionId].tsx` (replaced in Task 13):

```tsx
export default function MissionMapRoute() {
  return null;
}
```

Run: `npx expo export --platform ios --output-dir /tmp/rtap-typegen > /dev/null`
Expected: exits 0; `.expo/types/router.d.ts` now mentions `/missions/[missionId]`.

- [ ] **Step 2: Write the failing test**

`src/features/missions/MissionsScreen.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { placePoint } from '@/features/map-items/commands';
import { makeTestContext } from '@/lib/db/test-database';
import { renderWithProviders } from '@/test-utils/render';

import { createMission, markMissionOpened } from './commands';
import { MissionsScreen } from './MissionsScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => jest.clearAllMocks());

describe('MissionsScreen', () => {
  it('shows an empty state that opens the create sheet', async () => {
    await renderWithProviders(<MissionsScreen />);
    expect(await screen.findByText('No missions yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Create mission'));
    expect(mockRouter.push).toHaveBeenCalledWith('/missions/new');
  });

  it('lists missions, last opened first, with item counts', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    const cobra = await createMission(ctx, { name: 'Op Cobra' });
    if (!iron.ok || !cobra.ok) throw new Error('setup');
    await markMissionOpened(ctx, cobra.value.id);
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await placePoint(ctx, { missionId: iron.value.id, coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });

    await renderWithProviders(<MissionsScreen />, ctx);

    expect(await screen.findByText('2 items · Never opened')).toBeTruthy();
    expect(screen.getByText(/^0 items · Opened /)).toBeTruthy();
    const names = screen.getAllByText(/^Op /).map((node) => node.props.children);
    expect(names).toEqual(['Op Cobra', 'Op Iron']);
  });

  it('opens a mission and offers New when the list is not empty', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    if (!iron.ok) throw new Error('setup');
    await renderWithProviders(<MissionsScreen />, ctx);

    await fireEvent.press(await screen.findByLabelText('Open Op Iron'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/missions/[missionId]',
      params: { missionId: iron.value.id },
    });
    await fireEvent.press(screen.getByText('+ New'));
    expect(mockRouter.push).toHaveBeenCalledWith('/missions/new');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/features/missions/MissionsScreen.test.tsx`
Expected: FAIL — `./MissionsScreen` not found.

- [ ] **Step 4: Implement**

`src/features/missions/MissionsScreen.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { formatItemCount, formatLastOpened } from './format';
import { observeMissionItemCount, observeMissionSummaries, type MissionSummary } from './repository';

export function MissionsScreen() {
  const ctx = useCommandContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const missions = useObservable<MissionSummary[] | null>(() => observeMissionSummaries(ctx.db), null, [ctx]);
  const now = Date.now();

  const openCreate = () => router.push('/missions/new');
  const openMission = (missionId: string) =>
    router.push({ pathname: '/missions/[missionId]', params: { missionId } });

  return (
    <View
      className="flex-1 bg-surface"
      style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-4">
        <Text className="text-lg font-semibold uppercase tracking-widest text-text">Missions</Text>
        {missions && missions.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={openCreate} className="rounded-xl bg-accent px-4 py-2">
            <Text className="font-bold text-on-accent">+ New</Text>
          </Pressable>
        ) : null}
      </View>
      {missions === null ? null : missions.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 8 }}
          renderItem={({ item }) => <MissionRow mission={item} now={now} onPress={() => openMission(item.id)} />}
        />
      )}
    </View>
  );
}

function MissionRow({ mission, now, onPress }: { mission: MissionSummary; now: number; onPress: () => void }) {
  const ctx = useCommandContext();
  const count = useObservable(() => observeMissionItemCount(ctx.db, mission.id), 0, [ctx, mission.id]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${mission.name}`}
      onPress={onPress}
      className="rounded-2xl border border-border bg-surface-raised px-4 py-3 active:opacity-80">
      <Text numberOfLines={1} className="text-base font-semibold text-text">
        {mission.name}
      </Text>
      <Text className="mt-1 text-sm text-text-muted">
        {`${formatItemCount(count)} · ${formatLastOpened(mission.lastOpenedAt, now)}`}
      </Text>
    </Pressable>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-lg font-semibold text-text">No missions yet</Text>
      <Text className="text-center text-sm text-text-muted">
        A mission is a map for one operation or training day. Create one to start placing points.
      </Text>
      <Pressable accessibilityRole="button" onPress={onCreate} className="mt-2 rounded-xl bg-accent px-6 py-3">
        <Text className="font-bold text-on-accent">Create mission</Text>
      </Pressable>
    </View>
  );
}
```

Replace `src/app/index.tsx`:

```tsx
import { MissionsScreen } from '@/features/missions/MissionsScreen';

export default function MissionsRoute() {
  return <MissionsScreen />;
}
```

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add missions list screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Create-mission sheet

**Files:**
- Create: `src/features/missions/CreateMissionScreen.tsx`, `src/features/missions/CreateMissionScreen.test.tsx`
- Modify: `src/app/missions/new.tsx`, `src/app/_layout.tsx` (`ThemedStack`)

**Interfaces:**
- Consumes: `createMission(ctx, { name })` (`./commands`), `suggestMissionName(db)` (`./repository`), `useCommandContext`, `useTheme`.
- Produces: `CreateMissionScreen` (no props). On success it calls `router.replace({ pathname: '/missions/[missionId]', params: { missionId } })`.

- [ ] **Step 1: Write the failing test**

`src/features/missions/CreateMissionScreen.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';
import { renderWithProviders } from '@/test-utils/render';

import { createMission } from './commands';
import { CreateMissionScreen } from './CreateMissionScreen';
import { observeMissionSummaries } from './repository';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

describe('CreateMissionScreen', () => {
  it('prefills the next mission name', async () => {
    const ctx = makeTestContext();
    await createMission(ctx, { name: 'A' });
    await createMission(ctx, { name: 'B' });
    await renderWithProviders(<CreateMissionScreen />, ctx);
    expect(await screen.findByDisplayValue('Mission 3')).toBeTruthy();
  });

  it('creates the mission and replaces the sheet with its map', async () => {
    const { ctx } = await renderWithProviders(<CreateMissionScreen />);
    await screen.findByDisplayValue('Mission 1');
    await fireEvent.changeText(screen.getByLabelText('Mission name'), 'Op Iron');
    await fireEvent.press(screen.getByText('Create'));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    const [mission] = await firstValueFrom(observeMissionSummaries(ctx.db));
    expect(mission.name).toBe('Op Iron');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/missions/[missionId]',
      params: { missionId: mission.id },
    });
  });

  it('creates exactly one mission when Create is tapped twice', async () => {
    const { ctx } = await renderWithProviders(<CreateMissionScreen />);
    await screen.findByDisplayValue('Mission 1');
    const create = screen.getByText('Create');
    await fireEvent.press(create);
    await fireEvent.press(create);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(await firstValueFrom(observeMissionSummaries(ctx.db))).toHaveLength(1);
  });

  it('shows an error for a blank name and stays open', async () => {
    await renderWithProviders(<CreateMissionScreen />);
    await screen.findByDisplayValue('Mission 1');
    await fireEvent.changeText(screen.getByLabelText('Mission name'), '   ');
    await fireEvent.press(screen.getByText('Create'));
    expect(await screen.findByText('Enter a mission name.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('cancels back to the list', async () => {
    await renderWithProviders(<CreateMissionScreen />);
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/missions/CreateMissionScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/missions/CreateMissionScreen.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useCommandContext } from '@/lib/db/command-context-provider';
import { useTheme } from '@/theme/ThemeProvider';

import { createMission } from './commands';
import { suggestMissionName } from './repository';

export function CreateMissionScreen() {
  const ctx = useCommandContext();
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: a second tap in the same frame must see the first tap's lock.
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    void suggestMissionName(ctx.db).then((suggestion) => {
      // Only prefill while the field is still empty (the user may already be typing).
      if (live) setName((current) => (current === '' ? suggestion : current));
    });
    return () => {
      live = false;
    };
  }, [ctx]);

  const submit = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    const result = await createMission(ctx, { name });
    if (result.ok) {
      // Stay locked: the sheet is being replaced by the map.
      router.replace({ pathname: '/missions/[missionId]', params: { missionId: result.value.id } });
      return;
    }
    busy.current = false;
    setError(result.error === 'invalid_name' ? 'Enter a mission name.' : 'Could not create the mission. Try again.');
  };

  return (
    <View className="gap-4 bg-surface px-4 pb-8 pt-6">
      <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">New mission</Text>
      <TextInput
        accessibilityLabel="Mission name"
        value={name}
        onChangeText={setName}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        placeholder="Mission name"
        placeholderTextColor={colors['text-muted']}
        className="rounded-xl border border-border bg-surface-input px-4 py-3 text-base text-text"
      />
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="flex-1 items-center rounded-xl border border-border bg-surface-raised py-3">
          <Text className="font-semibold text-text">Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void submit()}
          className="flex-1 items-center rounded-xl bg-accent py-3">
          <Text className="font-bold text-on-accent">Create</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

Replace `src/app/missions/new.tsx`:

```tsx
import { CreateMissionScreen } from '@/features/missions/CreateMissionScreen';

export default function NewMissionRoute() {
  return <CreateMissionScreen />;
}
```

In `src/app/_layout.tsx`, change `ThemedStack` to declare the sheet:

```tsx
function ThemedStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen
        name="missions/new"
        options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }}
      />
    </Stack>
  );
}
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add create-mission sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Interaction and presence stores

**Files:**
- Create: `src/stores/interaction.ts`, `src/stores/interaction.test.ts`, `src/stores/presence.ts`, `src/stores/presence.test.ts`

**Interfaces:**
- Consumes: `LatLon` (`@/lib/geo/types`).
- Produces:
  - `useInteraction` (Zustand) with values `cameraCenter: LatLon | null`, `cameraZoom: number`, `cameraBearing: number`, `followMode: boolean` and actions `setCamera(c: CameraSnapshot)`, `setFollowMode(on: boolean)`, `reset()`; `type CameraSnapshot = { center: LatLon; zoom: number; bearing: number }`; `INITIAL_INTERACTION`.
  - `usePresence` with values `selfPosition: SelfPosition | null`, `selfHeading: number | null` (true degrees), `locationStatus: LocationStatus` and actions `setSelfPosition(p)`, `setSelfHeading(h)`, `setLocationStatus(s)`, `reset()`; `type SelfPosition = { position: LatLon; accuracyM: number | null; timestamp: number }`; `type LocationStatus = 'unknown' | 'granted' | 'denied' | 'unavailable'`; `INITIAL_PRESENCE`.

- [ ] **Step 1: Write the failing tests**

`src/stores/interaction.test.ts`:

```ts
import { INITIAL_INTERACTION, useInteraction } from './interaction';

beforeEach(() => useInteraction.setState(INITIAL_INTERACTION));

describe('interaction store', () => {
  it('starts with no camera and follow off', () => {
    const s = useInteraction.getState();
    expect(s.cameraCenter).toBeNull();
    expect(s.followMode).toBe(false);
  });

  it('records a camera snapshot', () => {
    useInteraction.getState().setCamera({ center: { lat: 1, lon: 2 }, zoom: 12, bearing: 30 });
    const s = useInteraction.getState();
    expect(s.cameraCenter).toEqual({ lat: 1, lon: 2 });
    expect(s.cameraZoom).toBe(12);
    expect(s.cameraBearing).toBe(30);
  });

  it('resets everything', () => {
    useInteraction.getState().setFollowMode(true);
    useInteraction.getState().setCamera({ center: { lat: 1, lon: 2 }, zoom: 12, bearing: 30 });
    useInteraction.getState().reset();
    expect(useInteraction.getState()).toMatchObject(INITIAL_INTERACTION);
  });
});
```

`src/stores/presence.test.ts`:

```ts
import { INITIAL_PRESENCE, usePresence } from './presence';

beforeEach(() => usePresence.setState(INITIAL_PRESENCE));

describe('presence store', () => {
  it('stores a valid fix', () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    expect(usePresence.getState().selfPosition?.position).toEqual({ lat: 38.9, lon: -77 });
  });

  it.each([
    [{ lat: Number.NaN, lon: 0 }],
    [{ lat: 0, lon: Number.POSITIVE_INFINITY }],
    [{ lat: 91, lon: 0 }],
  ])('ignores an invalid fix %p', (position) => {
    usePresence.getState().setSelfPosition({ position, accuracyM: null, timestamp: 1 });
    expect(usePresence.getState().selfPosition).toBeNull();
  });

  it('stores heading and status, and resets', () => {
    usePresence.getState().setSelfHeading(42);
    usePresence.getState().setLocationStatus('granted');
    expect(usePresence.getState().selfHeading).toBe(42);
    expect(usePresence.getState().locationStatus).toBe('granted');
    usePresence.getState().reset();
    expect(usePresence.getState()).toMatchObject(INITIAL_PRESENCE);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/stores/interaction.test.ts src/stores/presence.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/stores/interaction.ts`:

```ts
import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

export type CameraSnapshot = { center: LatLon; zoom: number; bearing: number };

type InteractionValues = {
  /** Map center under the crosshair; fed (throttled) by MapCanvas. Null until the map mounts. */
  cameraCenter: LatLon | null;
  cameraZoom: number;
  /** Map bearing in degrees clockwise from true north (drives the north-up needle). */
  cameraBearing: number;
  /** Camera follows the user's position until the user pans. */
  followMode: boolean;
};

type InteractionActions = {
  setCamera: (camera: CameraSnapshot) => void;
  setFollowMode: (on: boolean) => void;
  reset: () => void;
};

export const INITIAL_INTERACTION: InteractionValues = {
  cameraCenter: null,
  cameraZoom: 0,
  cameraBearing: 0,
  followMode: false,
};

export const useInteraction = create<InteractionValues & InteractionActions>()((set) => ({
  ...INITIAL_INTERACTION,
  setCamera: (camera) => set({ cameraCenter: camera.center, cameraZoom: camera.zoom, cameraBearing: camera.bearing }),
  setFollowMode: (followMode) => set({ followMode }),
  reset: () => set(INITIAL_INTERACTION),
}));
```

`src/stores/presence.ts`:

```ts
import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

export type SelfPosition = { position: LatLon; accuracyM: number | null; timestamp: number };
export type LocationStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

type PresenceValues = {
  selfPosition: SelfPosition | null;
  /** True heading in degrees, or null when the device has no usable compass reading. */
  selfHeading: number | null;
  locationStatus: LocationStatus;
};

type PresenceActions = {
  /** Ignores fixes with non-finite or out-of-range coordinates. */
  setSelfPosition: (fix: SelfPosition) => void;
  setSelfHeading: (heading: number | null) => void;
  setLocationStatus: (status: LocationStatus) => void;
  reset: () => void;
};

export const INITIAL_PRESENCE: PresenceValues = { selfPosition: null, selfHeading: null, locationStatus: 'unknown' };

function isValidPosition(p: LatLon): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** Transient, in-memory presence (own position now, teammates later). Never stored in the DB. */
export const usePresence = create<PresenceValues & PresenceActions>()((set) => ({
  ...INITIAL_PRESENCE,
  setSelfPosition: (fix) => {
    if (isValidPosition(fix.position)) set({ selfPosition: fix });
  },
  setSelfHeading: (selfHeading) => set({ selfHeading }),
  setLocationStatus: (locationStatus) => set({ locationStatus }),
  reset: () => set(INITIAL_PRESENCE),
}));
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/stores && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores
git commit -m "feat: add interaction and presence stores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Own location and heading

**Files:**
- Create: `src/features/location/heading.ts`, `src/features/location/heading.test.ts`, `src/features/location/use-self-location.ts`, `src/features/location/use-self-location.test.tsx`
- Modify: `jest.setup.ts` (global `expo-location` mock)

**Interfaces:**
- Consumes: `usePresence` (Task 5), `useSettings` (`@/stores/settings`), `toTrue` (`@/lib/geo/north/convert`), `normalizeDeg` (`@/lib/geo/units/angle`).
- Produces:
  - `trueHeadingFrom(event: { trueHeading: number; magHeading: number }, position: LatLon | null, date: Date, declinationOverrideDeg: number | null): number | null`
  - `angularDistance(a: number, b: number): number` (degrees, 0–180)
  - `shouldEmitHeading(prev: HeadingSample | null, next: number, now: number): boolean`; `type HeadingSample = { heading: number; at: number }`; `HEADING_MIN_INTERVAL_MS = 100`; `HEADING_MIN_DELTA_DEG = 2`
  - `useSelfLocation(): void` — while mounted, keeps `usePresence` up to date; resets presence on unmount.

- [ ] **Step 1: Add the global expo-location mock**

Append to `jest.setup.ts`:

```ts
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied', granted: false })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  watchHeadingAsync: jest.fn(async () => ({ remove: jest.fn() })),
}));
```

- [ ] **Step 2: Write the failing tests**

`src/features/location/heading.test.ts`:

```ts
import { declination } from '@/lib/geo/north/magnetic';

import { angularDistance, shouldEmitHeading, trueHeadingFrom } from './heading';

const DC = { lat: 38.8977, lon: -77.0365 };
const DATE = new Date('2026-06-01T00:00:00Z');

describe('trueHeadingFrom', () => {
  it('uses the true heading when the device provides it', () => {
    expect(trueHeadingFrom({ trueHeading: 370, magHeading: 5 }, DC, DATE, null)).toBe(10);
  });

  it('converts magnetic heading with the model when true heading is unavailable', () => {
    const h = trueHeadingFrom({ trueHeading: -1, magHeading: 100 }, DC, DATE, null);
    expect(h).toBeCloseTo(100 + declination(DC, DATE), 6);
  });

  it('honours the declination override', () => {
    expect(trueHeadingFrom({ trueHeading: -1, magHeading: 100 }, DC, DATE, 10)).toBeCloseTo(110, 6);
  });

  it.each([
    [{ trueHeading: -1, magHeading: -1 }, DC],
    [{ trueHeading: -1, magHeading: 100 }, null],
    [{ trueHeading: Number.NaN, magHeading: Number.NaN }, DC],
  ])('returns null when no heading is usable (%p)', (event, position) => {
    expect(trueHeadingFrom(event, position, DATE, null)).toBeNull();
  });
});

describe('heading throttle', () => {
  it('measures the short way round north', () => {
    expect(angularDistance(359, 1)).toBe(2);
    expect(angularDistance(1, 359)).toBe(2);
    expect(angularDistance(90, 270)).toBe(180);
  });

  it('always emits the first sample', () => {
    expect(shouldEmitHeading(null, 10, 0)).toBe(true);
  });

  it('drops samples that are too soon or too small', () => {
    expect(shouldEmitHeading({ heading: 10, at: 0 }, 30, 50)).toBe(false);
    expect(shouldEmitHeading({ heading: 10, at: 0 }, 11, 500)).toBe(false);
  });

  it('emits a 2° change across north', () => {
    expect(shouldEmitHeading({ heading: 359, at: 0 }, 1, 200)).toBe(true);
  });
});
```

`src/features/location/use-self-location.test.tsx`:

```tsx
import { act, render } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';

import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';

import { useSelfLocation } from './use-self-location';

const mocked = jest.mocked(Location);

function Probe() {
  useSelfLocation();
  return null;
}

type PositionCb = (loc: { coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number }) => void;
type HeadingCb = (h: { trueHeading: number; magHeading: number; accuracy: number }) => void;

function grant() {
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
  const removes = { position: jest.fn(), heading: jest.fn() };
  let onPosition: PositionCb = () => {};
  let onHeading: HeadingCb = () => {};
  mocked.watchPositionAsync.mockImplementation(async (_opts, cb) => {
    onPosition = cb as unknown as PositionCb;
    return { remove: removes.position };
  });
  mocked.watchHeadingAsync.mockImplementation(async (cb) => {
    onHeading = cb as unknown as HeadingCb;
    return { remove: removes.heading };
  });
  return { removes, position: (...a: Parameters<PositionCb>) => onPosition(...a), heading: (...a: Parameters<HeadingCb>) => onHeading(...a) };
}

beforeEach(() => {
  jest.clearAllMocks();
  usePresence.setState(INITIAL_PRESENCE);
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false } as never);
});

describe('useSelfLocation', () => {
  it('publishes position and heading once permission is granted', async () => {
    const fake = grant();
    await render(<Probe />);
    expect(usePresence.getState().locationStatus).toBe('granted');

    await act(async () => fake.position({ coords: { latitude: 38.9, longitude: -77, accuracy: 4 }, timestamp: 10 }));
    expect(usePresence.getState().selfPosition).toEqual({ position: { lat: 38.9, lon: -77 }, accuracyM: 4, timestamp: 10 });

    await act(async () => fake.heading({ trueHeading: 45, magHeading: 50, accuracy: 3 }));
    expect(usePresence.getState().selfHeading).toBe(45);
  });

  it('clears the heading when the compass becomes unusable', async () => {
    const fake = grant();
    await render(<Probe />);
    await act(async () => fake.heading({ trueHeading: 45, magHeading: 50, accuracy: 3 }));
    await act(async () => fake.heading({ trueHeading: -1, magHeading: -1, accuracy: 0 }));
    expect(usePresence.getState().selfHeading).toBeNull();
  });

  it('marks location denied and does not watch', async () => {
    await render(<Probe />);
    expect(usePresence.getState().locationStatus).toBe('denied');
    expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('marks location unavailable when watching fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
    mocked.watchPositionAsync.mockRejectedValueOnce(new Error('Location services are disabled'));
    await render(<Probe />);
    expect(usePresence.getState().locationStatus).toBe('unavailable');
  });

  it('retries when the app returns to the foreground after a denial', async () => {
    let onChange: (s: AppStateStatus) => void = () => {};
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      onChange = cb as (s: AppStateStatus) => void;
      return { remove: jest.fn() };
    });
    await render(<Probe />);
    expect(usePresence.getState().locationStatus).toBe('denied');

    grant();
    await act(async () => onChange('active'));
    expect(usePresence.getState().locationStatus).toBe('granted');
    spy.mockRestore();
  });

  it('stops watching and clears presence on unmount', async () => {
    const fake = grant();
    const { unmount } = await render(<Probe />);
    await act(async () => fake.position({ coords: { latitude: 38.9, longitude: -77, accuracy: 4 }, timestamp: 10 }));
    await unmount();
    expect(fake.removes.position).toHaveBeenCalled();
    expect(fake.removes.heading).toHaveBeenCalled();
    expect(usePresence.getState().selfPosition).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/features/location`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`src/features/location/heading.ts`:

```ts
import { toTrue } from '@/lib/geo/north/convert';
import type { LatLon } from '@/lib/geo/types';
import { normalizeDeg } from '@/lib/geo/units/angle';

export const HEADING_MIN_INTERVAL_MS = 100; // ≈10 Hz
export const HEADING_MIN_DELTA_DEG = 2;

export type HeadingSample = { heading: number; at: number };

/**
 * True heading from an expo-location heading event. Devices report −1 when a value is
 * unavailable; magnetic headings are converted with the declination model (or the override).
 */
export function trueHeadingFrom(
  event: { trueHeading: number; magHeading: number },
  position: LatLon | null,
  date: Date,
  declinationOverrideDeg: number | null,
): number | null {
  if (Number.isFinite(event.trueHeading) && event.trueHeading >= 0) return normalizeDeg(event.trueHeading);
  if (position === null || !Number.isFinite(event.magHeading) || event.magHeading < 0) return null;
  return toTrue(event.magHeading, 'magnetic', position, { date, declinationOverrideDeg });
}

/** Smallest angle between two headings, 0–180°. */
export function angularDistance(a: number, b: number): number {
  const d = normalizeDeg(a - b);
  return d > 180 ? 360 - d : d;
}

/** Throttles compass updates so the self layer re-renders at most ≈10 Hz and only on ≥2° change. */
export function shouldEmitHeading(prev: HeadingSample | null, next: number, now: number): boolean {
  if (prev === null) return true;
  if (now - prev.at < HEADING_MIN_INTERVAL_MS) return false;
  return angularDistance(prev.heading, next) >= HEADING_MIN_DELTA_DEG;
}
```

`src/features/location/use-self-location.ts`:

```ts
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import { shouldEmitHeading, trueHeadingFrom, type HeadingSample } from './heading';

/**
 * Streams the device position and heading into the presence store while mounted
 * (foreground, when-in-use only). Retries when the app returns to the foreground so
 * enabling location in Settings takes effect without restarting.
 */
export function useSelfLocation(): void {
  useEffect(() => {
    let disposed = false;
    let starting = false;
    let subscriptions: { remove: () => void }[] = [];
    let lastHeading: HeadingSample | null = null;

    const onPosition = (loc: Location.LocationObject) => {
      usePresence.getState().setSelfPosition({
        position: { lat: loc.coords.latitude, lon: loc.coords.longitude },
        accuracyM: loc.coords.accuracy ?? null,
        timestamp: loc.timestamp,
      });
    };

    const onHeading = (event: Location.LocationHeadingObject) => {
      const presence = usePresence.getState();
      const heading = trueHeadingFrom(
        event,
        presence.selfPosition?.position ?? null,
        new Date(),
        useSettings.getState().declinationOverrideDeg,
      );
      if (heading === null) {
        lastHeading = null;
        if (presence.selfHeading !== null) presence.setSelfHeading(null);
        return;
      }
      const now = Date.now();
      if (!shouldEmitHeading(lastHeading, heading, now)) return;
      lastHeading = { heading, at: now };
      presence.setSelfHeading(heading);
    };

    const start = async () => {
      if (starting || subscriptions.length > 0) return;
      starting = true;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (disposed) return;
        if (status !== 'granted') {
          usePresence.getState().setLocationStatus('denied');
          return;
        }
        const position = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
          onPosition,
        );
        if (disposed) {
          position.remove();
          return;
        }
        subscriptions.push(position);
        usePresence.getState().setLocationStatus('granted');
        try {
          const heading = await Location.watchHeadingAsync(onHeading);
          if (disposed) heading.remove();
          else subscriptions.push(heading);
        } catch (e) {
          // No compass: position still works; the self icon shows without a heading.
          console.warn('[location] heading unavailable', e);
        }
      } catch (e) {
        console.warn('[location] unavailable', e);
        if (!disposed) usePresence.getState().setLocationStatus('unavailable');
      } finally {
        starting = false;
      }
    };

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active' && usePresence.getState().locationStatus !== 'granted') void start();
    });
    void start();

    return () => {
      disposed = true;
      appState.remove();
      subscriptions.forEach((s) => s.remove());
      subscriptions = [];
      usePresence.getState().reset();
    };
  }, []);
}
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/features/location && npx tsc --noEmit && npx expo lint`
Expected: PASS. (`render` resolves after mount effects and the mocked promises settle; if a status assertion races, wrap it in `await waitFor(...)`.)

- [ ] **Step 6: Commit**

```bash
git add jest.setup.ts src/features/location
git commit -m "feat: stream own position and heading into presence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Map images — self icon and label chip

**Files:**
- Create: `src/features/map/images/map-image-specs.ts`, `scripts/build-map-images.ts`, `assets/map/*.png` (generated), `src/features/map/images/map-images.ts`, `src/features/map/images/map-images.test.ts`
- Modify: `package.json` (script `build:map-images`)

**Interfaces:**
- Consumes: `mapColors('dark')` (`@/theme/tokens`), `SYMBOL_IMAGES` (`@/features/symbology/symbol-images.generated`).
- Produces:
  - `MAP_IMAGE_IDS = { self: 'self', selfNoHeading: 'self-no-heading', labelChip: 'label-chip' }`
  - `MAP_IMAGES: Record<string, ImageEntry>` — every preset SIDC plus the three ids above (for rnmapbox `<Images images={MAP_IMAGES} />`).
  - `SELF_ICON_SIZE`, `LABEL_CHIP_SPEC`, `LABEL_CHIP_IMAGE_OPTIONS` from `map-image-specs.ts`.

- [ ] **Step 1: Write the specs module**

`src/features/map/images/map-image-specs.ts` (no Mapbox import; the build script uses it too):

```ts
/** Geometry shared by scripts/build-map-images.ts and the runtime image registry. */

/** Self icon canvas at @1x, in px (generated at @1x/@2x/@3x). The icon points north; the layer rotates it. */
export const SELF_ICON_SIZE = 64;

/**
 * Label chip: one image rendered at 3× pixel density. Mapbox stretch/content values are in
 * image pixels, so the chip ships as a single 3× file with `scale: 3` to keep them unambiguous.
 */
export const LABEL_CHIP_SPEC = { sizePx: 72, radiusPx: 12, insetPx: 18, scale: 3 } as const;

const { sizePx, insetPx, scale } = LABEL_CHIP_SPEC;
const inner: [number, number] = [insetPx, sizePx - insetPx];

export const LABEL_CHIP_IMAGE_OPTIONS: {
  scale: number;
  stretchX: [number, number][];
  stretchY: [number, number][];
  content: [number, number, number, number];
} = {
  scale,
  stretchX: [inner],
  stretchY: [inner],
  content: [insetPx, insetPx, sizePx - insetPx, sizePx - insetPx],
};
```

- [ ] **Step 2: Write the build script and generate the PNGs**

`scripts/build-map-images.ts`:

```ts
/**
 * Renders the self-position icons and the map label chip into assets/map/ (colors from theme
 * tokens). Run: npm run build:map-images
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LABEL_CHIP_SPEC, SELF_ICON_SIZE } from '../src/features/map/images/map-image-specs';
import { mapColors } from '../src/theme/tokens';

const OUT_DIR = join(__dirname, '..', 'assets/map');
const colors = mapColors('dark');
const S = SELF_ICON_SIZE;
const C = S / 2;

// View cone: ±25° wedge pointing north, radius 30.
const CONE_R = 30;
const dx = CONE_R * Math.sin((25 * Math.PI) / 180);
const dy = CONE_R * Math.cos((25 * Math.PI) / 180);
const cone = `<path d="M${C} ${C} L${C - dx} ${C - dy} A${CONE_R} ${CONE_R} 0 0 1 ${C + dx} ${C - dy} Z" fill="${colors.self}" fill-opacity="0.35"/>`;
// White-ringed disc (ring uses the primary text color) with a dark north-pointing arrow.
const disc = `<circle cx="${C}" cy="${C}" r="11" fill="${colors.self}" stroke="${colors.text}" stroke-width="3"/>`;
const arrow = `<path d="M${C} ${C - 8} L${C + 6} ${C + 7} L${C} ${C + 3.5} L${C - 6} ${C + 7} Z" fill="${colors['surface-input']}"/>`;
const dot = `<circle cx="${C}" cy="${C}" r="3" fill="${colors['surface-input']}"/>`;

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${body}</svg>`;

function writeScaled(name: string, source: string) {
  for (const scale of [1, 2, 3]) {
    const png = new Resvg(source, { fitTo: { mode: 'zoom', value: scale } }).render().asPng();
    writeFileSync(join(OUT_DIR, `${name}${scale === 1 ? '' : `@${scale}x`}.png`), png);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeScaled('self', svg(cone + disc + arrow));
writeScaled('self-no-heading', svg(disc + dot));

const { sizePx, radiusPx } = LABEL_CHIP_SPEC;
const chip = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radiusPx}" fill="${colors['map-label-bg']}"/></svg>`;
writeFileSync(join(OUT_DIR, 'label-chip.png'), new Resvg(chip).render().asPng());

console.log(`Wrote map images to ${OUT_DIR}`);
```

Add to `package.json` `scripts`: `"build:map-images": "tsx scripts/build-map-images.ts"`.

Run: `npm run build:map-images`
Expected: `assets/map/` contains `self.png`, `self@2x.png`, `self@3x.png`, `self-no-heading.png`, `self-no-heading@2x.png`, `self-no-heading@3x.png`, `label-chip.png`. Open `assets/map/self@3x.png` with the Read tool and confirm: sky-blue disc with a white ring, dark arrow pointing up, translucent cone above.

- [ ] **Step 3: Write the failing test**

`src/features/map/images/map-images.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PRESET_SIDCS } from '@/features/symbology/presets';

import { LABEL_CHIP_IMAGE_OPTIONS, LABEL_CHIP_SPEC } from './map-image-specs';
import { MAP_IMAGE_IDS, MAP_IMAGES } from './map-images';

const ASSETS = join(__dirname, '../../../../assets/map');

describe('map images', () => {
  it('registers every preset symbol and the map images', () => {
    expect(Object.keys(MAP_IMAGES).sort()).toEqual([...PRESET_SIDCS, ...Object.values(MAP_IMAGE_IDS)].sort());
  });

  it('has the generated files on disk', () => {
    for (const name of ['self', 'self-no-heading']) {
      for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `${name}${suffix}.png`))).toBe(true);
    }
    expect(existsSync(join(ASSETS, 'label-chip.png'))).toBe(true);
  });

  it('keeps the chip stretch zone clear of the rounded corners', () => {
    const [[x0, x1]] = LABEL_CHIP_IMAGE_OPTIONS.stretchX;
    expect(x0).toBeGreaterThanOrEqual(LABEL_CHIP_SPEC.radiusPx);
    expect(x1).toBeLessThanOrEqual(LABEL_CHIP_SPEC.sizePx - LABEL_CHIP_SPEC.radiusPx);
    expect(LABEL_CHIP_IMAGE_OPTIONS.stretchY).toEqual(LABEL_CHIP_IMAGE_OPTIONS.stretchX);
  });
});
```

Run: `npx jest src/features/map/images`
Expected: FAIL — `./map-images` not found.

- [ ] **Step 4: Implement the registry**

`src/features/map/images/map-images.ts`:

```ts
import type { ImageEntry } from '@rnmapbox/maps';

import { SYMBOL_IMAGES } from '@/features/symbology/symbol-images.generated';

import { LABEL_CHIP_IMAGE_OPTIONS } from './map-image-specs';

export const MAP_IMAGE_IDS = {
  self: 'self',
  selfNoHeading: 'self-no-heading',
  labelChip: 'label-chip',
} as const;

/** Every image a map layer may reference by name (`iconImage`). Module constant: stable identity. */
export const MAP_IMAGES: Record<string, ImageEntry> = {
  ...SYMBOL_IMAGES,
  [MAP_IMAGE_IDS.self]: require('../../../../assets/map/self.png'),
  [MAP_IMAGE_IDS.selfNoHeading]: require('../../../../assets/map/self-no-heading.png'),
  [MAP_IMAGE_IDS.labelChip]: { image: require('../../../../assets/map/label-chip.png'), ...LABEL_CHIP_IMAGE_OPTIONS },
};
```

(`import type` from `@rnmapbox/maps` is erased at compile time, so this test needs no Mapbox mock.)

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/build-map-images.ts assets/map src/features/map/images
git commit -m "feat: generate self icon and label chip map images

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Map canvas — camera, layout, Mapbox setup, test mock

**Files:**
- Create: `__mocks__/@rnmapbox/maps.tsx`, `src/test-utils/mapbox-mock.ts`, `src/features/map/layout.ts`, `src/features/map/layout.test.ts`, `src/features/map/canvas/camera.ts`, `src/features/map/canvas/camera.test.ts`, `src/features/map/canvas/frame-throttle.ts`, `src/features/map/canvas/frame-throttle.test.ts`, `src/features/map/canvas/mapbox.ts`, `src/features/map/canvas/MapCanvas.tsx`, `src/features/map/canvas/MapCanvas.test.tsx`

**Interfaces:**
- Consumes: `useInteraction` (Task 5), `MAP_IMAGES` (Task 7), `getMapboxToken` (Task 1), `MissionCamera`, `isValidCamera` (`@/features/missions/repository`), `normalizeDeg`, `wrapLon` (`@/lib/geo/units/angle`).
- Produces:
  - `layout.ts`: `EDGE = 12`, `GAP = 8`, `TOOLBAR_HEIGHT = 64`, `CONTROL_SIZE = 52`, `READOUT_HEIGHT = 72`, `LOGO_WIDTH = 96`; `isLandscape(width, height): boolean`; `type Insets`; `ornamentPositions({ landscape, insets })` → `{ logo: { top; left }, attribution: { top; left }, scaleBar: { bottom; left } }`.
  - `camera.ts`: `WORLD_CAMERA: MissionCamera`, `SELF_ZOOM = 15`, `MIN_ZOOM = 0`, `MAX_ZOOM = 22`, `clampZoom(z)`, `cameraFromMapState(state): MissionCamera | null`, `toCameraStop(c): { centerCoordinate: [number, number]; zoomLevel: number; heading: number }`.
  - `frame-throttle.ts`: `createLatestThrottle<T>(fn, schedule?)`.
  - `mapbox.ts`: sets the access token on import; `MAP_STYLE_URL`.
  - `MapCanvas({ cameraRef, initialCamera, onCameraIdle, onUserGesture, landscape, children })`.
  - Test helpers: `mapboxMock()` returning `{ __props, __camera, offlineManager, setAccessToken }`.

- [ ] **Step 1: Write the Mapbox manual mock and helper**

`__mocks__/@rnmapbox/maps.tsx`:

```tsx
/* Manual Jest mock for @rnmapbox/maps. Activate per test file with jest.mock('@rnmapbox/maps'). */
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { View } from 'react-native';

type Props = Record<string, unknown> & { id?: string; children?: ReactNode };

/** Last props each component received: by component name, then layer/source id ('main' when none). */
export const __props: Record<string, Record<string, Props>> = {
  MapView: {},
  Camera: {},
  Images: {},
  ShapeSource: {},
  SymbolLayer: {},
};
export const __camera = { setCamera: jest.fn() };

export function MapView(props: Props) {
  __props.MapView.main = props;
  return <View testID="map-view">{props.children}</View>;
}

export const Camera = forwardRef(function Camera(props: Props, ref) {
  __props.Camera.main = props;
  useImperativeHandle(ref, () => __camera);
  return null;
});

export function Images(props: Props) {
  __props.Images.main = props;
  return null;
}

export function ShapeSource(props: Props) {
  __props.ShapeSource[props.id ?? 'main'] = props;
  return <>{props.children}</>;
}

export function SymbolLayer(props: Props) {
  __props.SymbolLayer[props.id ?? 'main'] = props;
  return null;
}

export const StyleURL = { Satellite: 'mapbox://styles/mapbox/satellite-v9' };
export const offlineManager = { createPack: jest.fn(), getPacks: jest.fn(async () => []), deletePack: jest.fn() };
export const setAccessToken = jest.fn();

export default { setAccessToken, StyleURL, offlineManager };
```

`src/test-utils/mapbox-mock.ts`:

```ts
type Props = Record<string, unknown>;

export type MapboxMock = {
  __props: Record<'MapView' | 'Camera' | 'Images' | 'ShapeSource' | 'SymbolLayer', Record<string, Props>>;
  __camera: { setCamera: jest.Mock };
  offlineManager: { createPack: jest.Mock; getPacks: jest.Mock; deletePack: jest.Mock };
  setAccessToken: jest.Mock;
};

/** The mocked @rnmapbox/maps module (call jest.mock('@rnmapbox/maps') in the test file). */
export function mapboxMock(): MapboxMock {
  return jest.requireMock('@rnmapbox/maps') as MapboxMock;
}
```

- [ ] **Step 2: Write the failing tests**

`src/features/map/layout.test.ts`:

```ts
import { EDGE, GAP, isLandscape, LOGO_WIDTH, ornamentPositions, READOUT_HEIGHT, TOOLBAR_HEIGHT } from './layout';

const insets = { top: 47, right: 0, bottom: 34, left: 0 };

describe('map layout', () => {
  it('detects landscape', () => {
    expect(isLandscape(844, 390)).toBe(true);
    expect(isLandscape(390, 844)).toBe(false);
  });

  it('keeps the logo below the full-width toolbar in portrait', () => {
    const p = ornamentPositions({ landscape: false, insets });
    expect(p.logo).toEqual({ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP, left: EDGE });
    expect(p.attribution).toEqual({ top: p.logo.top, left: EDGE + LOGO_WIDTH });
  });

  it('puts the logo top-left in landscape (toolbar is top-right)', () => {
    const p = ornamentPositions({ landscape: true, insets: { top: 0, right: 47, bottom: 21, left: 47 } });
    expect(p.logo).toEqual({ top: EDGE, left: 47 + EDGE });
  });

  it('places the scale bar above the readout card', () => {
    const p = ornamentPositions({ landscape: false, insets });
    expect(p.scaleBar).toEqual({ bottom: insets.bottom + EDGE + READOUT_HEIGHT + GAP, left: EDGE });
  });
});
```

`src/features/map/canvas/camera.test.ts`:

```ts
import { cameraFromMapState, clampZoom, toCameraStop, WORLD_CAMERA } from './camera';

function state(center: number[], zoom = 12, heading = 0) {
  return { properties: { center, zoom, heading } };
}

describe('camera helpers', () => {
  it('converts a map state to a mission camera', () => {
    expect(cameraFromMapState(state([-77.0365, 38.8977], 14, 30))).toEqual({
      center: { lat: 38.8977, lon: -77.0365 },
      zoom: 14,
      bearing: 30,
    });
  });

  it('normalizes longitude past the antimeridian and negative headings', () => {
    const c = cameraFromMapState(state([190, 10], 3, -90));
    expect(c?.center.lon).toBeCloseTo(-170, 9);
    expect(c?.bearing).toBe(270);
  });

  it('rejects non-finite state', () => {
    expect(cameraFromMapState(state([Number.NaN, 0]))).toBeNull();
    expect(cameraFromMapState(state([0, 0], Number.NaN))).toBeNull();
  });

  it('builds a camera stop', () => {
    expect(toCameraStop(WORLD_CAMERA)).toEqual({
      centerCoordinate: [WORLD_CAMERA.center.lon, WORLD_CAMERA.center.lat],
      zoomLevel: WORLD_CAMERA.zoom,
      heading: WORLD_CAMERA.bearing,
    });
  });

  it('clamps zoom', () => {
    expect(clampZoom(-1)).toBe(0);
    expect(clampZoom(30)).toBe(22);
    expect(clampZoom(12.5)).toBe(12.5);
  });
});
```

`src/features/map/canvas/frame-throttle.test.ts`:

```ts
import { createLatestThrottle } from './frame-throttle';

describe('createLatestThrottle', () => {
  it('delivers only the latest value once per scheduled frame', () => {
    const queue: (() => void)[] = [];
    const fn = jest.fn();
    const throttled = createLatestThrottle(fn, (cb) => queue.push(cb));

    throttled(1);
    throttled(2);
    throttled(3);
    expect(queue).toHaveLength(1);
    expect(fn).not.toHaveBeenCalled();

    queue.shift()!();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(3);

    throttled(4);
    expect(queue).toHaveLength(1);
    queue.shift()!();
    expect(fn).toHaveBeenLastCalledWith(4);
  });
});
```

`src/features/map/canvas/MapCanvas.test.tsx`:

```tsx
import { act, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Text } from 'react-native';

import { MAP_IMAGES } from '@/features/map/images/map-images';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { WORLD_CAMERA } from './camera';
import { MapCanvas } from './MapCanvas';

jest.mock('@rnmapbox/maps');

const rafQueue: (() => void)[] = [];
beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  rafQueue.length = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
    rafQueue.push(() => cb(0));
    return rafQueue.length;
  });
});

async function renderCanvas(overrides: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
  const props = {
    cameraRef: createRef<never>(),
    initialCamera: { center: { lat: 38.8977, lon: -77.0365 }, zoom: 13, bearing: 0 },
    onCameraIdle: jest.fn(),
    onUserGesture: jest.fn(),
    landscape: false,
    ...overrides,
  };
  await renderWithProviders(
    <MapCanvas {...props}>
      <Text>layer</Text>
    </MapCanvas>,
  );
  return props;
}

describe('MapCanvas', () => {
  it('renders children with an uncontrolled camera and the image registry', async () => {
    await renderCanvas();
    expect(screen.getByText('layer')).toBeTruthy();
    const camera = mapboxMock().__props.Camera.main;
    expect(camera.defaultSettings).toEqual({ centerCoordinate: [-77.0365, 38.8977], zoomLevel: 13, heading: 0 });
    expect(camera.centerCoordinate).toBeUndefined();
    expect(mapboxMock().__props.Images.main.images).toBe(MAP_IMAGES);
    expect(mapboxMock().__props.MapView.main.compassEnabled).toBe(false);
  });

  it('seeds the interaction store with the initial camera', async () => {
    await renderCanvas({ initialCamera: WORLD_CAMERA });
    expect(useInteraction.getState().cameraCenter).toEqual(WORLD_CAMERA.center);
  });

  it('feeds camera changes through one store update per frame', async () => {
    const props = await renderCanvas();
    const onCameraChanged = mapboxMock().__props.MapView.main.onCameraChanged as (s: unknown) => void;
    const move = (lon: number, gesture: boolean) => ({
      properties: { center: [lon, 38.9], zoom: 13, heading: 0 },
      gestures: { isGestureActive: gesture },
    });
    await act(async () => {
      onCameraChanged(move(-77.1, true));
      onCameraChanged(move(-77.2, true));
    });
    expect(rafQueue).toHaveLength(1);
    await act(async () => rafQueue.shift()!());
    expect(useInteraction.getState().cameraCenter).toEqual({ lat: 38.9, lon: -77.2 });
    expect(props.onUserGesture).toHaveBeenCalled();
  });

  it('reports the camera when the map goes idle', async () => {
    const props = await renderCanvas();
    const onMapIdle = mapboxMock().__props.MapView.main.onMapIdle as (s: unknown) => void;
    await act(async () =>
      onMapIdle({ properties: { center: [-77, 38.9], zoom: 11, heading: 10 }, gestures: { isGestureActive: false } }),
    );
    expect(props.onCameraIdle).toHaveBeenCalledWith({ center: { lat: 38.9, lon: -77 }, zoom: 11, bearing: 10 });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/features/map/layout.test.ts src/features/map/canvas`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`src/features/map/layout.ts`:

```ts
/** Spacing and sizes for map chrome (toolbar, controls, readout, Mapbox ornaments), in points. */
export const EDGE = 12;
export const GAP = 8;
export const TOOLBAR_HEIGHT = 64;
export const CONTROL_SIZE = 52;
export const READOUT_HEIGHT = 72;
/** Room reserved for the Mapbox wordmark before the attribution button. */
export const LOGO_WIDTH = 96;

export type Insets = { top: number; right: number; bottom: number; left: number };

export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

/**
 * Mapbox ornament positions. The logo and attribution must stay visible (Mapbox terms), so they
 * sit top-left: under the full-width toolbar in portrait, beside the top-right toolbar in
 * landscape. The scale bar sits just above the readout card.
 */
export function ornamentPositions({ landscape, insets }: { landscape: boolean; insets: Insets }) {
  const left = insets.left + EDGE;
  const top = insets.top + EDGE + (landscape ? 0 : TOOLBAR_HEIGHT + GAP);
  return {
    logo: { top, left },
    attribution: { top, left: left + LOGO_WIDTH },
    scaleBar: { bottom: insets.bottom + EDGE + READOUT_HEIGHT + GAP, left },
  };
}
```

`src/features/map/canvas/camera.ts`:

```ts
import { isValidCamera, type MissionCamera } from '@/features/missions/repository';
import { normalizeDeg, wrapLon } from '@/lib/geo/units/angle';

/** Shown when a mission has no saved camera and there is no position fix yet. */
export const WORLD_CAMERA: MissionCamera = { center: { lat: 20, lon: 0 }, zoom: 1, bearing: 0 };
/** Zoom used when centering on the user (first fix, recenter). */
export const SELF_ZOOM = 15;
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 22;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

type MapStateLike = { properties: { center: number[]; zoom: number; heading: number } };

/** Map state → canonical camera (lon wrapped to [−180, 180], bearing in [0, 360)). Null if not finite. */
export function cameraFromMapState(state: MapStateLike): MissionCamera | null {
  const [lon, lat] = state.properties.center;
  const camera = {
    center: { lat, lon: wrapLon(lon) },
    zoom: state.properties.zoom,
    bearing: normalizeDeg(state.properties.heading),
  };
  return isValidCamera(camera) ? camera : null;
}

export function toCameraStop(camera: MissionCamera) {
  return {
    centerCoordinate: [camera.center.lon, camera.center.lat] as [number, number],
    zoomLevel: camera.zoom,
    heading: camera.bearing,
  };
}
```

(If `wrapLon` or `normalizeDeg` return `NaN` for `NaN` input, `isValidCamera` rejects it — that is the intended path. If `wrapLon(190)` does not return −170, read `src/lib/geo/units/angle.ts` and use it as documented there; do not re-implement wrapping.)

`src/features/map/canvas/frame-throttle.ts`:

```ts
/**
 * Coalesces calls so `fn` runs at most once per scheduled frame, with the latest value.
 * Used for camera updates, which native code can emit faster than React should re-render.
 */
export function createLatestThrottle<T>(
  fn: (value: T) => void,
  schedule: (cb: () => void) => unknown = requestAnimationFrame,
): (value: T) => void {
  let pending = false;
  let latest: T;
  return (value) => {
    latest = value;
    if (pending) return;
    pending = true;
    schedule(() => {
      pending = false;
      fn(latest);
    });
  };
}
```

`src/features/map/canvas/mapbox.ts`:

```ts
import Mapbox from '@rnmapbox/maps';

import { getMapboxToken } from '@/config/env';

// Runs once, on first import, before any MapView mounts. MapScreen shows an error screen
// instead of the map when the token is missing.
const token = getMapboxToken();
if (token) Mapbox.setAccessToken(token);

export const MAP_STYLE_URL: string = Mapbox.StyleURL.Satellite;
```

`src/features/map/canvas/MapCanvas.tsx`:

```tsx
import { Camera, Images, MapView, type MapState } from '@rnmapbox/maps';
import { useEffect, useMemo, type ReactNode, type Ref } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MissionCamera } from '@/features/missions/repository';
import { useInteraction } from '@/stores/interaction';

import { MAP_IMAGES } from '../images/map-images';
import { ornamentPositions } from '../layout';
import { cameraFromMapState, toCameraStop } from './camera';
import { createLatestThrottle } from './frame-throttle';
import { MAP_STYLE_URL } from './mapbox';

type Props = {
  cameraRef: Ref<Camera>;
  /** Applied once at mount (uncontrolled camera); later moves go through cameraRef. */
  initialCamera: MissionCamera;
  onCameraIdle: (camera: MissionCamera) => void;
  /** Called while the user drags/pinches the map (turns follow mode off). */
  onUserGesture: () => void;
  landscape: boolean;
  children?: ReactNode;
};

export function MapCanvas({ cameraRef, initialCamera, onCameraIdle, onUserGesture, landscape, children }: Props) {
  const insets = useSafeAreaInsets();
  const ornaments = ornamentPositions({ landscape, insets });
  const publishCamera = useMemo(() => createLatestThrottle(useInteraction.getState().setCamera), []);

  useEffect(() => {
    // The readout must never be blank: start from the camera the map opens at.
    useInteraction.getState().setCamera(initialCamera);
  }, [initialCamera]);

  const onCameraChanged = (state: MapState) => {
    const camera = cameraFromMapState(state);
    if (camera) publishCamera(camera);
    if (state.gestures.isGestureActive) onUserGesture();
  };

  const onMapIdle = (state: MapState) => {
    const camera = cameraFromMapState(state);
    if (camera) onCameraIdle(camera);
  };

  return (
    <MapView
      style={{ flex: 1 }}
      styleURL={MAP_STYLE_URL}
      compassEnabled={false}
      pitchEnabled={false}
      scaleBarEnabled
      scaleBarPosition={ornaments.scaleBar}
      logoPosition={ornaments.logo}
      attributionPosition={ornaments.attribution}
      onCameraChanged={onCameraChanged}
      onMapIdle={onMapIdle}>
      <Camera ref={cameraRef} defaultSettings={toCameraStop(initialCamera)} />
      <Images images={MAP_IMAGES} />
      {children}
    </MapView>
  );
}
```

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS. If `tsc` rejects `createRef<never>()` in the test, use `createRef<import('@rnmapbox/maps').Camera>()`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add uncontrolled map canvas with throttled camera feed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Points, labels and self layers

**Files:**
- Create: `src/features/map/layers/styles.ts`, `src/features/map/layers/self-feature.ts`, `src/features/map/layers/self-feature.test.ts`, `src/features/map/layers/PointsLayer.tsx`, `src/features/map/layers/PointsLayer.test.tsx`, `src/features/map/layers/SelfLayer.tsx`, `src/features/map/layers/SelfLayer.test.tsx`

**Interfaces:**
- Consumes: `observeMissionItems(db, missionId)`, `observeHiddenItemIds(db)` (`@/features/map-items/repository`); `createPointFeatureSelector()`, `hiddenFilter(ids)` (`@/features/map-items/selectors`); `MAP_IMAGE_IDS` (Task 7); `usePresence` (Task 5); `useObservable`, `useCommandContext`, `useTheme`.
- Produces:
  - `styles.ts`: `MAP_LABEL_FONT: string[]`, `POINT_SYMBOL_STYLE`, `SELF_STYLE` (module constants), `makePointLabelStyle(colors)`.
  - `selfFeatureCollection(position: LatLon | null, heading: number | null)`.
  - `PointsLayer({ missionId })` — source id `points`, layers `points-symbols`, `points-labels`.
  - `SelfLayer()` — source id `self`, layer `self-icon`.

- [ ] **Step 1: Write the failing tests**

`src/features/map/layers/self-feature.test.ts`:

```ts
import { MAP_IMAGE_IDS } from '../images/map-images';
import { selfFeatureCollection } from './self-feature';

describe('selfFeatureCollection', () => {
  it('is empty without a fix', () => {
    expect(selfFeatureCollection(null, 90).features).toEqual([]);
  });

  it('uses the heading icon and rotation when heading is known', () => {
    const [f] = selfFeatureCollection({ lat: 38.9, lon: -77 }, 90).features;
    expect(f.geometry.coordinates).toEqual([-77, 38.9]);
    expect(f.properties).toEqual({ icon: MAP_IMAGE_IDS.self, heading: 90 });
  });

  it('never fakes a north arrow when heading is unknown', () => {
    const [f] = selfFeatureCollection({ lat: 38.9, lon: -77 }, null).features;
    expect(f.properties).toEqual({ icon: MAP_IMAGE_IDS.selfNoHeading, heading: 0 });
  });
});
```

`src/features/map/layers/PointsLayer.test.tsx`:

```tsx
import { act, waitFor } from '@testing-library/react-native';

import { placePoint, toggleItemVisibility } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { PointsLayer } from './PointsLayer';

jest.mock('@rnmapbox/maps');

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

type Shape = { features: { properties: { id: string; name: string } }[] };

describe('PointsLayer', () => {
  it('renders the mission points in one source and hides by filter', async () => {
    const ctx = makeTestContext();
    const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });
    await placePoint(ctx, { missionId: 'm2', coord: at, sidc: HOSTILE_INF, name: 'OTHER' });
    if (!a.ok) throw new Error('setup');

    await renderWithProviders(<PointsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(2));

    await act(async () => {
      await toggleItemVisibility(ctx, a.value.id);
    });
    await waitFor(() => expect(props.SymbolLayer['points-symbols'].filter).toEqual(hiddenFilter([a.value.id])));
    expect(props.SymbolLayer['points-labels'].filter).toEqual(hiddenFilter([a.value.id]));
    // Hiding never rebuilds the source.
    expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(2);
  });

  it('keeps layer styles stable across data updates', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    await renderWithProviders(<PointsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(1));
    const symbolStyle = props.SymbolLayer['points-symbols'].style;
    const labelStyle = props.SymbolLayer['points-labels'].style;

    await act(async () => {
      await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-2' });
    });
    await waitFor(() => expect((props.ShapeSource.points.shape as Shape).features).toHaveLength(2));
    expect(props.SymbolLayer['points-symbols'].style).toBe(symbolStyle);
    expect(props.SymbolLayer['points-labels'].style).toBe(labelStyle);
  });
});
```

`src/features/map/layers/SelfLayer.test.tsx`:

```tsx
import { act } from '@testing-library/react-native';

import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { SelfLayer } from './SelfLayer';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { icon: string; heading: number } }[] };

beforeEach(() => usePresence.setState(INITIAL_PRESENCE));

describe('SelfLayer', () => {
  it('follows the presence store', async () => {
    await renderWithProviders(<SelfLayer />);
    const props = mapboxMock().__props;
    expect((props.ShapeSource.self.shape as Shape).features).toEqual([]);

    await act(async () => {
      usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
      usePresence.getState().setSelfHeading(120);
    });
    expect((props.ShapeSource.self.shape as Shape).features[0].properties).toEqual({ icon: MAP_IMAGE_IDS.self, heading: 120 });
    expect(props.SymbolLayer['self-icon'].style).toMatchObject({ iconRotationAlignment: 'map' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/map/layers`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/features/map/layers/styles.ts`:

```ts
import type { SymbolLayerStyle } from '@rnmapbox/maps';

import type { SemanticToken } from '@/theme/tokens';

import { MAP_IMAGE_IDS } from '../images/map-images';

/**
 * Font stack for map labels. Glyphs come from the Mapbox style's glyph server; these fonts are
 * available to every account. A monospace stack (JetBrains Mono) needs its glyphs uploaded to
 * the Mapbox account first — tracked in the native gate notes. Every font in a stack must exist,
 * or no labels render.
 */
export const MAP_LABEL_FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

/** Symbol icons: every point always shows; collisions never hide a symbol. */
export const POINT_SYMBOL_STYLE: SymbolLayerStyle = {
  iconImage: ['get', 'sidc'],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

/** Label chips below each symbol; labels may hide each other when crowded (never the symbols). */
export function makePointLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: ['get', 'name'],
    textFont: MAP_LABEL_FONT,
    textSize: 12,
    textColor: colors['map-label-text'],
    textAnchor: 'top',
    textOffset: [0, 1.7],
    iconImage: MAP_IMAGE_IDS.labelChip,
    iconTextFit: 'both',
    iconTextFitPadding: [2, 6, 2, 6],
  };
}

export const SELF_STYLE: SymbolLayerStyle = {
  iconImage: ['get', 'icon'],
  iconRotate: ['get', 'heading'],
  iconRotationAlignment: 'map',
  iconPitchAlignment: 'map',
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};
```

`src/features/map/layers/self-feature.ts`:

```ts
import type { LatLon } from '@/lib/geo/types';

import { MAP_IMAGE_IDS } from '../images/map-images';

type SelfIcon = (typeof MAP_IMAGE_IDS)['self' | 'selfNoHeading'];

export type SelfFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: 'self';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { icon: SelfIcon; heading: number };
  }[];
};

/** One feature for the self icon; the no-heading icon has no arrow or cone to rotate. */
export function selfFeatureCollection(position: LatLon | null, heading: number | null): SelfFeatureCollection {
  if (position === null) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'self',
        geometry: { type: 'Point', coordinates: [position.lon, position.lat] },
        properties:
          heading === null
            ? { icon: MAP_IMAGE_IDS.selfNoHeading, heading: 0 }
            : { icon: MAP_IMAGE_IDS.self, heading },
      },
    ],
  };
}
```

`src/features/map/layers/PointsLayer.tsx`:

```tsx
import { ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { observeHiddenItemIds, observeMissionItems, type MapItemSnapshot } from '@/features/map-items/repository';
import { createPointFeatureSelector, hiddenFilter } from '@/features/map-items/selectors';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useTheme } from '@/theme/ThemeProvider';

import { makePointLabelStyle, POINT_SYMBOL_STYLE } from './styles';

type LayerFilter = ComponentProps<typeof SymbolLayer>['filter'];

const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];

/** All mission points in one ShapeSource; hidden items are filtered out, never removed. */
export function PointsLayer({ missionId }: { missionId: string }) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const select = useMemo(() => createPointFeatureSelector(), []);
  const shape = useMemo(() => select(items), [select, items]);
  const filter = useMemo(() => hiddenFilter(hiddenIds) as LayerFilter, [hiddenIds]);
  const labelStyle = useMemo(() => makePointLabelStyle(colors), [colors]);

  return (
    <ShapeSource id="points" shape={shape}>
      <SymbolLayer id="points-symbols" style={POINT_SYMBOL_STYLE} filter={filter} />
      <SymbolLayer id="points-labels" style={labelStyle} filter={filter} />
    </ShapeSource>
  );
}
```

(If `tsc` rejects `shape={shape}`, pass `shape={shape as GeoJSON.FeatureCollection}`.)

`src/features/map/layers/SelfLayer.tsx`:

```tsx
import { ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo } from 'react';

import { usePresence } from '@/stores/presence';

import { selfFeatureCollection } from './self-feature';
import { SELF_STYLE } from './styles';

/** Own position: heading-aware icon from the presence store (teammates will reuse this path). */
export function SelfLayer() {
  const position = usePresence((s) => s.selfPosition?.position ?? null);
  const heading = usePresence((s) => s.selfHeading);
  const shape = useMemo(() => selfFeatureCollection(position, heading), [position, heading]);
  return (
    <ShapeSource id="self" shape={shape}>
      <SymbolLayer id="self-icon" style={SELF_STYLE} />
    </ShapeSource>
  );
}
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS. If `tsc` rejects an expression literal in a style (e.g. `['get', 'sidc']`), keep the constant annotated as `SymbolLayerStyle` and add `as const` to that array only.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/layers
git commit -m "feat: render mission points, label chips and own position

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Crosshair and readout card

**Files:**
- Create: `src/features/map/interaction/readout.ts`, `src/features/map/interaction/readout.test.ts`, `src/features/map/interaction/Crosshair.tsx`, `src/features/map/controls/ReadoutCard.tsx`, `src/features/map/controls/ReadoutCard.test.tsx`

**Interfaces:**
- Consumes: `toMgrs` (`@/lib/geo/coords/mgrs`), `formatMgrs`, `formatLatLon` (`@/lib/geo/format/coords`), `refLabel` (`@/lib/geo/format/measure`), `describeVector` (`@/lib/geo/vector`), `useInteraction`, `usePresence`, `useSettings` (`toggleGridMagnetic`), `EDGE` (Task 8), `Icon`.
- Produces:
  - `formatCoordinate(p: LatLon, format: CoordinateFormat): string` (MGRS falls back to lat/lon outside MGRS coverage)
  - `describeReadout(center, self, settings: ReadoutSettings, date): ReadoutModel` with `ReadoutModel = { coordinate; distance; bearing; ref }`
  - `Crosshair()` (absolute, centered, non-interactive), `ReadoutCard()`

- [ ] **Step 1: Write the failing tests**

`src/features/map/interaction/readout.test.ts`:

```ts
import { toMgrs } from '@/lib/geo/coords/mgrs';
import { formatLatLon, formatMgrs } from '@/lib/geo/format/coords';
import { describeVector } from '@/lib/geo/vector';

import { describeReadout, formatCoordinate, type ReadoutSettings } from './readout';

const DC = { lat: 38.8977, lon: -77.0365 };
const NEAR = { lat: 38.905, lon: -77.03 };
const DATE = new Date('2026-06-01T00:00:00Z');
const SETTINGS: ReadoutSettings = { coordinateFormat: 'mgrs', angleUnit: 'deg', northRef: 'grid', declinationOverrideDeg: null };

describe('formatCoordinate', () => {
  it('formats MGRS with spaces', () => {
    const m = toMgrs(DC, 5);
    if (!m.ok) throw new Error('setup');
    expect(formatCoordinate(DC, 'mgrs')).toBe(formatMgrs(m.value));
  });

  it('formats lat/lon when selected', () => {
    expect(formatCoordinate(DC, 'latlon')).toBe(formatLatLon(DC));
  });

  it('falls back to lat/lon outside MGRS coverage', () => {
    const polar = { lat: 85, lon: 10 };
    expect(formatCoordinate(polar, 'mgrs')).toBe(formatLatLon(polar));
  });
});

describe('describeReadout', () => {
  it('shows dashes before the map reports a center', () => {
    expect(describeReadout(null, DC, SETTINGS, DATE)).toEqual({ coordinate: '—', distance: '—', bearing: '—', ref: 'GRID' });
  });

  it('shows the crosshair coordinate but no range without a fix', () => {
    expect(describeReadout(NEAR, null, SETTINGS, DATE)).toEqual({
      coordinate: formatCoordinate(NEAR, 'mgrs'),
      distance: '—',
      bearing: '—',
      ref: 'GRID',
    });
  });

  it('describes range and bearing from the user to the crosshair', () => {
    const v = describeVector(DC, NEAR, { date: DATE, declinationOverrideDeg: null, unit: 'deg', ref: 'grid' });
    expect(describeReadout(NEAR, DC, SETTINGS, DATE)).toMatchObject({ distance: v.distanceLabel, bearing: v.bearingLabel });
  });

  it('honours unit and north reference', () => {
    const r = describeReadout(NEAR, DC, { ...SETTINGS, angleUnit: 'mil', northRef: 'magnetic' }, DATE);
    expect(r.bearing).toMatch(/^\d{4} mils$/);
    expect(r.ref).toBe('MAG');
  });
});
```

`src/features/map/controls/ReadoutCard.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { ReadoutCard } from './ReadoutCard';

const DC = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('ReadoutCard', () => {
  it('shows the crosshair coordinate and dashes without a fix', async () => {
    useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
    await renderWithProviders(<ReadoutCard />);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(DC, 'mgrs'));
    expect(screen.getByTestId('readout-range')).toHaveTextContent('— ·');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent('— GRID');
  });

  it('toggles grid and magnetic when the bearing is tapped', async () => {
    useInteraction.getState().setCamera({ center: { lat: 38.905, lon: -77.03 }, zoom: 12, bearing: 0 });
    usePresence.getState().setSelfPosition({ position: DC, accuracyM: 5, timestamp: 1 });
    await renderWithProviders(<ReadoutCard />);
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}° GRID$/);

    await fireEvent.press(screen.getByTestId('readout-bearing'));
    expect(useSettings.getState().northRef).toBe('magnetic');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}° MAG$/);
  });
});
```

(`toHaveTextContent` is built into RNTL 14's Jest matchers. If it is not registered, add `import '@testing-library/react-native/extend-expect';` to `jest.setup.ts`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/map/interaction src/features/map/controls`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/features/map/interaction/readout.ts`:

```ts
import { toMgrs } from '@/lib/geo/coords/mgrs';
import { formatLatLon, formatMgrs } from '@/lib/geo/format/coords';
import { refLabel } from '@/lib/geo/format/measure';
import type { AngleUnit, LatLon, NorthRef } from '@/lib/geo/types';
import { describeVector } from '@/lib/geo/vector';
import type { CoordinateFormat } from '@/stores/settings';

const NO_VALUE = '—';

export type ReadoutSettings = {
  coordinateFormat: CoordinateFormat;
  angleUnit: AngleUnit;
  northRef: NorthRef;
  declinationOverrideDeg: number | null;
};

export type ReadoutModel = { coordinate: string; distance: string; bearing: string; ref: string };

/** Coordinate text in the user's format. MGRS falls back to lat/lon where MGRS is undefined. */
export function formatCoordinate(p: LatLon, format: CoordinateFormat): string {
  if (format === 'mgrs') {
    const mgrs = toMgrs(p, 5);
    if (mgrs.ok) return formatMgrs(mgrs.value);
  }
  return formatLatLon(p);
}

/** Crosshair readout: coordinate of the map center, and range/bearing from the user to it. */
export function describeReadout(
  center: LatLon | null,
  self: LatLon | null,
  settings: ReadoutSettings,
  date: Date,
): ReadoutModel {
  const ref = refLabel(settings.northRef);
  const coordinate = center ? formatCoordinate(center, settings.coordinateFormat) : NO_VALUE;
  if (!center || !self) return { coordinate, distance: NO_VALUE, bearing: NO_VALUE, ref };
  const v = describeVector(self, center, {
    date,
    declinationOverrideDeg: settings.declinationOverrideDeg,
    unit: settings.angleUnit,
    ref: settings.northRef,
  });
  return { coordinate, distance: v.distanceLabel, bearing: v.bearingLabel, ref };
}
```

`src/features/map/interaction/Crosshair.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

const ARM = 14;
const GAP = 5;
const THICKNESS = 1.5;

/** Thin cross with a center dot at the center of the map. Never intercepts touches. */
export function Crosshair() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} className="items-center justify-center">
      <View style={{ width: 2 * (ARM + GAP), height: 2 * (ARM + GAP) }} className="items-center justify-center">
        <View className="absolute bg-text" style={{ width: THICKNESS, height: ARM, top: 0 }} />
        <View className="absolute bg-text" style={{ width: THICKNESS, height: ARM, bottom: 0 }} />
        <View className="absolute bg-text" style={{ height: THICKNESS, width: ARM, left: 0 }} />
        <View className="absolute bg-text" style={{ height: THICKNESS, width: ARM, right: 0 }} />
        <View className="rounded-full bg-text" style={{ width: 4, height: 4 }} />
      </View>
    </View>
  );
}
```

`src/features/map/controls/ReadoutCard.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { describeReadout } from '../interaction/readout';
import { EDGE } from '../layout';

/** Bottom-left card: crosshair MGRS, and range · bearing from the user (tap bearing: grid ↔ mag). */
export function ReadoutCard() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const center = useInteraction((s) => s.cameraCenter);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const toggleGridMagnetic = useSettings((s) => s.toggleGridMagnetic);

  const r = describeReadout(center, self, { coordinateFormat, angleUnit, northRef, declinationOverrideDeg }, new Date());

  return (
    <View
      className="absolute rounded-2xl border border-border bg-surface-chrome px-4 py-3"
      style={{ left: insets.left + EDGE, bottom: insets.bottom + EDGE }}>
      <View className="flex-row items-center gap-2">
        <Icon name="crosshairs" size={18} color={colors['text-muted']} />
        <Text testID="readout-coordinate" className="font-mono-bold text-xl text-text">
          {r.coordinate}
        </Text>
      </View>
      <View className="mt-1 flex-row items-center">
        <Text testID="readout-range" className="font-mono text-sm text-text-muted">{`${r.distance} ·`}</Text>
        <Pressable
          testID="readout-bearing"
          accessibilityRole="button"
          accessibilityLabel={`Bearing ${r.bearing} ${r.ref}. Tap to switch grid or magnetic.`}
          hitSlop={12}
          onPress={toggleGridMagnetic}
          className="ml-1">
          <Text className="font-mono text-sm text-text-muted">{`${r.bearing} ${r.ref}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

The second line reads `1.15 km · 103° GRID`; only the bearing part is the tap target.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/interaction src/features/map/controls
git commit -m "feat: add crosshair and MGRS readout card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Map controls — north-up, zoom, recenter

**Files:**
- Create: `src/features/map/controls/MapButton.tsx`, `src/features/map/controls/MapControls.tsx`, `src/features/map/controls/MapControls.test.tsx`

**Interfaces:**
- Consumes: `useInteraction` (`cameraBearing`), `Icon`, `useTheme`, layout constants (Task 8).
- Produces: `MapControls({ following, canRecenter, onNorthUp, onZoomIn, onZoomOut, onRecenter })`; `MapButton({ icon?, label, onPress, active?, disabled?, children? })`.

- [ ] **Step 1: Write the failing test**

`src/features/map/controls/MapControls.test.tsx`:

```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { renderWithProviders } from '@/test-utils/render';

import { MapControls } from './MapControls';

beforeEach(() => useInteraction.setState(INITIAL_INTERACTION));

function handlers() {
  return { onNorthUp: jest.fn(), onZoomIn: jest.fn(), onZoomOut: jest.fn(), onRecenter: jest.fn() };
}

describe('MapControls', () => {
  it('calls the camera actions', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter {...h} />);
    await fireEvent.press(screen.getByLabelText('North up'));
    await fireEvent.press(screen.getByLabelText('Zoom in'));
    await fireEvent.press(screen.getByLabelText('Zoom out'));
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(h.onNorthUp).toHaveBeenCalledTimes(1);
    expect(h.onZoomIn).toHaveBeenCalledTimes(1);
    expect(h.onZoomOut).toHaveBeenCalledTimes(1);
    expect(h.onRecenter).toHaveBeenCalledTimes(1);
  });

  it('rotates the needle against the map bearing', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} />);
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 0, lon: 0 }, zoom: 3, bearing: 30 }));
    expect(StyleSheet.flatten(screen.getByTestId('north-needle').props.style).transform).toEqual([{ rotate: '-30deg' }]);
  });

  it('shows follow state on the recenter button', async () => {
    await renderWithProviders(<MapControls following canRecenter {...handlers()} />);
    expect(screen.getByLabelText('Recenter on me')).toHaveAccessibilityState({ selected: true });
  });

  it('disables recenter without a fix', async () => {
    const h = handlers();
    await renderWithProviders(<MapControls following={false} canRecenter={false} {...h} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(h.onRecenter).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/map/controls/MapControls.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/map/controls/MapButton.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { CONTROL_SIZE } from '../layout';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  active?: boolean;
  disabled?: boolean;
  /** Bare button (no chrome) for use inside a grouped container. */
  grouped?: boolean;
  children?: ReactNode;
};

export function MapButton({ label, onPress, icon, active = false, disabled = false, grouped = false, children }: Props) {
  const { colors } = useTheme();
  const chrome = grouped ? '' : 'rounded-2xl border border-border bg-surface-chrome';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: CONTROL_SIZE, height: CONTROL_SIZE }}
      className={`items-center justify-center ${chrome} ${disabled ? 'opacity-40' : ''}`}>
      {icon ? <Icon name={icon} size={26} color={active ? colors.accent : colors.text} /> : children}
    </Pressable>
  );
}
```

`src/features/map/controls/MapControls.tsx`:

```tsx
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInteraction } from '@/stores/interaction';
import { useTheme } from '@/theme/ThemeProvider';

import { CONTROL_SIZE, EDGE, GAP, TOOLBAR_HEIGHT } from '../layout';
import { MapButton } from './MapButton';

type Props = {
  following: boolean;
  canRecenter: boolean;
  onNorthUp: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
};

/** Right-edge controls: north-up under the toolbar; zoom and recenter at the bottom. */
export function MapControls({ following, canRecenter, onNorthUp, onZoomIn, onZoomOut, onRecenter }: Props) {
  const insets = useSafeAreaInsets();
  const right = insets.right + EDGE;
  return (
    <>
      <View className="absolute" style={{ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP, right }}>
        <MapButton label="North up" onPress={onNorthUp}>
          <NorthNeedle />
        </MapButton>
      </View>
      <View className="absolute gap-3" style={{ bottom: insets.bottom + EDGE, right }}>
        <View className="overflow-hidden rounded-2xl border border-border bg-surface-chrome">
          <MapButton grouped label="Zoom in" icon="plus" onPress={onZoomIn} />
          <View className="h-px bg-border" style={{ width: CONTROL_SIZE }} />
          <MapButton grouped label="Zoom out" icon="minus" onPress={onZoomOut} />
        </View>
        <MapButton
          label="Recenter on me"
          icon="crosshairs-gps"
          active={following}
          disabled={!canRecenter}
          onPress={onRecenter}
        />
      </View>
    </>
  );
}

/** Red north half, light south half, rotated so it keeps pointing at map north. */
function NorthNeedle() {
  const { colors } = useTheme();
  const bearing = useInteraction((s) => s.cameraBearing);
  const half = { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' };
  return (
    <View testID="north-needle" style={{ transform: [{ rotate: `${-bearing}deg` }] }} className="items-center">
      <View style={{ ...half, borderBottomWidth: 14, borderBottomColor: colors.danger }} />
      <View style={{ ...half, borderTopWidth: 14, borderTopColor: colors.text }} />
    </View>
  );
}
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/controls
git commit -m "feat: add north-up, zoom and recenter map controls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Toolbar

**Files:**
- Create: `src/features/toolbar/ToolButton.tsx`, `src/features/toolbar/Toolbar.tsx`, `src/features/toolbar/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `Icon`, `IconName`, `useTheme`, `EDGE`, `TOOLBAR_HEIGHT` (`@/features/map/layout`).
- Produces: `type ToolId = 'point'`; `Toolbar({ landscape, activeTool, onMenu?, onPoint?, onSettings? })` — a button without a handler renders disabled; `ToolButton({ icon, label, active?, onPress? })`.

- [ ] **Step 1: Write the failing test**

`src/features/toolbar/Toolbar.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { Toolbar } from './Toolbar';

function style() {
  return StyleSheet.flatten(screen.getByTestId('toolbar').props.style);
}

describe('Toolbar', () => {
  it('spans the width in portrait', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} />);
    expect(style().left).toBeDefined();
    expect(style().right).toBeDefined();
  });

  it('anchors top-right and sizes to content in landscape', async () => {
    await renderWithProviders(<Toolbar landscape activeTool={null} />);
    expect(style().left).toBeUndefined();
    expect(style().right).toBeDefined();
  });

  it('runs handlers and disables tools without one', async () => {
    const onMenu = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool={null} onMenu={onMenu} />);
    await fireEvent.press(screen.getByLabelText('Menu'));
    expect(onMenu).toHaveBeenCalled();
    expect(screen.getByLabelText('POINT')).toHaveAccessibilityState({ disabled: true });
    expect(screen.getByLabelText('Settings')).toHaveAccessibilityState({ disabled: true });
  });

  it('marks the active tool', async () => {
    await renderWithProviders(<Toolbar landscape={false} activeTool="point" onPoint={jest.fn()} />);
    expect(screen.getByLabelText('POINT')).toHaveAccessibilityState({ selected: true, disabled: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/toolbar`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/toolbar/ToolButton.tsx`:

```tsx
import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { icon: IconName; label: string; active?: boolean; onPress?: () => void };

/** Icon over an uppercase label. Active: amber on dark amber. No handler: disabled. */
export function ToolButton({ icon, label, active = false, onPress }: Props) {
  const { colors } = useTheme();
  const disabled = !onPress;
  const color = active ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-w-16 items-center rounded-2xl px-3 py-1 ${active ? 'bg-accent-subtle' : ''} ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={24} color={color} />
      <Text style={{ color }} className="mt-0.5 text-xs font-semibold tracking-wider">
        {label}
      </Text>
    </Pressable>
  );
}
```

`src/features/toolbar/Toolbar.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { EDGE, TOOLBAR_HEIGHT } from '@/features/map/layout';
import { useTheme } from '@/theme/ThemeProvider';

import { ToolButton } from './ToolButton';

export type ToolId = 'point';

type Props = {
  landscape: boolean;
  activeTool: ToolId | null;
  onMenu?: () => void;
  onPoint?: () => void;
  onSettings?: () => void;
};

/**
 * Top bar in both orientations: full width in portrait, top-right (content width) in landscape
 * so a left panel never covers it. Tools scroll horizontally in portrait if they overflow.
 */
export function Toolbar({ landscape, activeTool, onMenu, onPoint, onSettings }: Props) {
  const insets = useSafeAreaInsets();
  const position = landscape
    ? { top: insets.top + EDGE, right: insets.right + EDGE }
    : { top: insets.top + EDGE, left: insets.left + EDGE, right: insets.right + EDGE };

  const tools = <ToolButton icon="map-marker-outline" label="POINT" active={activeTool === 'point'} onPress={onPoint} />;

  return (
    <View
      testID="toolbar"
      style={[position, { height: TOOLBAR_HEIGHT }]}
      className="absolute flex-row items-center rounded-3xl border border-border bg-surface-chrome px-2">
      <BarIcon icon="menu" label="Menu" onPress={onMenu} />
      <Divider />
      {landscape ? (
        <View className="flex-row items-center gap-1">{tools}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center', gap: 4 }}>
          {tools}
        </ScrollView>
      )}
      <Divider />
      <BarIcon icon="cog-outline" label="Settings" onPress={onSettings} />
    </View>
  );
}

function BarIcon({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }): ReactNode {
  const { colors } = useTheme();
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={`h-12 w-12 items-center justify-center ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={28} color={colors.text} />
    </Pressable>
  );
}

function Divider() {
  return <View className="mx-2 h-8 w-px bg-border" />;
}
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/toolbar
git commit -m "feat: add top toolbar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Map screen, mission open flow and camera persistence

**Files:**
- Create: `src/features/missions/open-mission.ts`, `src/features/missions/open-mission.test.ts`, `src/features/map/canvas/camera-persistence.ts`, `src/features/map/canvas/camera-persistence.test.tsx`, `src/features/location/LocationBanner.tsx`, `src/features/location/LocationBanner.test.tsx`, `src/features/map/MissingTokenScreen.tsx`, `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.tsx`, `src/features/map/MapScreen.test.tsx`
- Modify: `src/app/missions/[missionId].tsx`, `src/app/_layout.tsx` (`ThemedStack`)

**Interfaces:**
- Consumes: everything from Tasks 1–12; `findMission`, `getMissionCamera` (`./repository`), `markMissionOpened`, `saveMissionCamera` (`./commands`).
- Produces:
  - `openMission(ctx, missionId): Promise<OpenMissionResult>`; `type OpenMissionResult = { status: 'missing' } | { status: 'ready'; name: string; camera: MissionCamera | null }`
  - `createCameraSaver(save, delayMs?)` → `CameraSaver = { schedule(c: MissionCamera): void; flush(): void }`; `CAMERA_SAVE_DEBOUNCE_MS = 1000`; `useCameraPersistence(ctx, missionId): CameraSaver`
  - `LocationBanner()`, `MissingTokenScreen({ onBack })`, `MissionMap({ missionId, savedCamera })`, `MapScreen({ missionId })`

- [ ] **Step 1: Write the failing tests**

`src/features/missions/open-mission.test.ts`:

```ts
import { makeTestContext } from '@/lib/db/test-database';

import { createMission, saveMissionCamera } from './commands';
import { openMission } from './open-mission';
import { findMission, findMissionViewState } from './repository';

describe('openMission', () => {
  it('reports unknown missions as missing', async () => {
    expect(await openMission(makeTestContext(), 'nope')).toEqual({ status: 'missing' });
  });

  it('reports soft-deleted missions as missing', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Gone' });
    if (!r.ok) throw new Error('setup');
    const m = await findMission(ctx.db, r.value.id);
    await ctx.db.write(() => m!.markAsDeleted());
    expect(await openMission(ctx, r.value.id)).toEqual({ status: 'missing' });
  });

  it('returns the saved camera and marks the mission opened', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const camera = { center: { lat: 38.9, lon: -77 }, zoom: 13, bearing: 10 };
    await saveMissionCamera(ctx, r.value.id, camera);

    expect(await openMission(ctx, r.value.id)).toEqual({ status: 'ready', name: 'Op Iron', camera });
    expect((await findMissionViewState(ctx.db, r.value.id))?.lastOpenedAt).toBeGreaterThan(0);
  });

  it('returns a null camera for a new mission', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op New' });
    if (!r.ok) throw new Error('setup');
    expect(await openMission(ctx, r.value.id)).toEqual({ status: 'ready', name: 'Op New', camera: null });
  });
});
```

`src/features/map/canvas/camera-persistence.test.tsx`:

```tsx
import { act, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { createMission, saveMissionCamera } from '@/features/missions/commands';
import { getMissionCamera } from '@/features/missions/repository';
import type { CommandContext } from '@/lib/db/command-context';
import { makeTestContext } from '@/lib/db/test-database';

import { CAMERA_SAVE_DEBOUNCE_MS, createCameraSaver, useCameraPersistence, type CameraSaver } from './camera-persistence';

jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));

const A = { center: { lat: 1, lon: 1 }, zoom: 10, bearing: 0 };
const B = { center: { lat: 2, lon: 2 }, zoom: 11, bearing: 0 };

describe('createCameraSaver', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounces to the latest camera', () => {
    const save = jest.fn();
    const saver = createCameraSaver(save);
    saver.schedule(A);
    saver.schedule(B);
    jest.advanceTimersByTime(CAMERA_SAVE_DEBOUNCE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(B);
  });

  it('flushes a pending camera immediately, once', () => {
    const save = jest.fn();
    const saver = createCameraSaver(save);
    saver.schedule(A);
    saver.flush();
    saver.flush();
    jest.runAllTimers();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('useCameraPersistence', () => {
  it('saves the pending camera when the app goes to the background', async () => {
    let onChange: (s: AppStateStatus) => void = () => {};
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      onChange = cb as (s: AppStateStatus) => void;
      return { remove: jest.fn() };
    });
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');

    let saver: CameraSaver | null = null;
    function Probe({ c }: { c: CommandContext }) {
      saver = useCameraPersistence(c, r.ok ? r.value.id : '');
      return null;
    }
    await render(<Probe c={ctx} />);
    saver!.schedule(B);
    await act(async () => onChange('background'));
    await waitFor(async () => expect(await getMissionCamera(ctx.db, r.value.id)).toEqual(B));
    spy.mockRestore();
  });

  it('saves the pending camera on unmount', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await saveMissionCamera(ctx, r.value.id, A);
    let saver: CameraSaver | null = null;
    function Probe() {
      saver = useCameraPersistence(ctx, r.ok ? r.value.id : '');
      return null;
    }
    const { unmount } = await render(<Probe />);
    saver!.schedule(B);
    await unmount();
    await waitFor(async () => expect(await getMissionCamera(ctx.db, r.value.id)).toEqual(B));
  });
});
```

`src/features/location/LocationBanner.test.tsx`:

```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { renderWithProviders } from '@/test-utils/render';

import { LocationBanner } from './LocationBanner';

beforeEach(() => usePresence.setState(INITIAL_PRESENCE));

describe('LocationBanner', () => {
  it('is hidden while location is unknown or granted', async () => {
    await renderWithProviders(<LocationBanner />);
    expect(screen.queryByText(/Location is off/)).toBeNull();
  });

  it('offers Settings and can be dismissed when location is denied', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderWithProviders(<LocationBanner />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByText(/Location is off/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Settings'));
    expect(open).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText(/Location is off/)).toBeNull();
  });
});
```

`src/features/map/MapScreen.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createMission } from '@/features/missions/commands';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MapScreen } from './MapScreen';

jest.mock('@rnmapbox/maps');

let mockToken: string | null = 'pk.test';
jest.mock('@/config/env', () => ({ getMapboxToken: () => mockToken }));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'pk.test';
});

describe('MapScreen', () => {
  it('opens a mission on its map with the shell around it', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);

    expect(await screen.findByTestId('map-view')).toBeTruthy();
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByTestId('readout-coordinate')).toBeTruthy();
    expect(screen.getByLabelText('Recenter on me')).toBeTruthy();
    expect(mapboxMock().__props.ShapeSource.points).toBeDefined();
    expect(mapboxMock().__props.ShapeSource.self).toBeDefined();
  });

  it('sends a stale mission link back to the list', async () => {
    await renderWithProviders(<MapScreen missionId="deleted-or-unknown" />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByTestId('map-view')).toBeNull();
  });

  it('shows a setup error without a Mapbox token', async () => {
    mockToken = null;
    await renderWithProviders(<MapScreen missionId="any" />);
    expect(screen.getByText('Mapbox token missing')).toBeTruthy();
  });

  it('switches mission from the toolbar menu button', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('Menu'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/missions/open-mission.test.ts src/features/map/canvas/camera-persistence.test.tsx src/features/location/LocationBanner.test.tsx src/features/map/MapScreen.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the mission open flow and camera persistence**

`src/features/missions/open-mission.ts`:

```ts
import type { CommandContext } from '@/lib/db/command-context';

import { markMissionOpened } from './commands';
import { findMission, getMissionCamera, type MissionCamera } from './repository';

export type OpenMissionResult = { status: 'missing' } | { status: 'ready'; name: string; camera: MissionCamera | null };

/** Loads what the map needs before it mounts (so a saved camera applies without a jump). */
export async function openMission(ctx: CommandContext, missionId: string): Promise<OpenMissionResult> {
  try {
    const mission = await findMission(ctx.db, missionId);
    if (!mission) return { status: 'missing' };
    const camera = await getMissionCamera(ctx.db, missionId);
    const opened = await markMissionOpened(ctx, missionId);
    if (!opened.ok) console.warn('[missions] could not record last opened', opened.message);
    return { status: 'ready', name: mission.name, camera };
  } catch (e) {
    console.warn('[missions] open failed', e);
    return { status: 'missing' };
  }
}
```

`src/features/map/canvas/camera-persistence.ts`:

```ts
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { saveMissionCamera } from '@/features/missions/commands';
import type { MissionCamera } from '@/features/missions/repository';
import type { CommandContext } from '@/lib/db/command-context';

export const CAMERA_SAVE_DEBOUNCE_MS = 1000;

export type CameraSaver = { schedule: (camera: MissionCamera) => void; flush: () => void };

/** Debounced "save the latest camera"; flush() writes a pending camera now. */
export function createCameraSaver(save: (camera: MissionCamera) => void, delayMs = CAMERA_SAVE_DEBOUNCE_MS): CameraSaver {
  let pending: MissionCamera | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending !== null) {
      const camera = pending;
      pending = null;
      save(camera);
    }
  };

  return {
    schedule: (camera) => {
      pending = camera;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}

/**
 * Saves the mission camera after the map settles, and immediately when the screen blurs,
 * unmounts, or the app leaves the foreground (so a kill from the app switcher keeps it).
 */
export function useCameraPersistence(ctx: CommandContext, missionId: string): CameraSaver {
  const saver = useMemo(
    () =>
      createCameraSaver((camera) => {
        void saveMissionCamera(ctx, missionId, camera);
      }),
    [ctx, missionId],
  );

  useFocusEffect(useCallback(() => () => saver.flush(), [saver]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saver.flush();
    });
    return () => {
      sub.remove();
      saver.flush();
    };
  }, [saver]);

  return saver;
}
```

- [ ] **Step 4: Implement the banner, error screen, map and route**

`src/features/location/LocationBanner.tsx`:

```tsx
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { CONTROL_SIZE, EDGE, GAP, TOOLBAR_HEIGHT } from '@/features/map/layout';
import { usePresence } from '@/stores/presence';
import { useTheme } from '@/theme/ThemeProvider';

/** One dismissible notice when location is denied or unavailable; the map stays fully usable. */
export function LocationBanner() {
  const status = usePresence((s) => s.locationStatus);
  const [dismissed, setDismissed] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (dismissed || (status !== 'denied' && status !== 'unavailable')) return null;
  return (
    <View
      className="absolute flex-row items-center gap-3 rounded-2xl border border-border bg-surface-chrome px-4 py-3"
      style={{
        top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP,
        left: insets.left + EDGE,
        right: insets.right + EDGE + CONTROL_SIZE + GAP,
      }}>
      <Text className="flex-1 text-sm text-text">Location is off. Your position and range are hidden.</Text>
      <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} hitSlop={8}>
        <Text className="font-semibold text-accent">Settings</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => setDismissed(true)} hitSlop={8}>
        <Icon name="close" size={18} color={colors['text-muted']} />
      </Pressable>
    </View>
  );
}
```

`src/features/map/MissingTokenScreen.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';

/** Development-time error: the app was built or started without EXPO_PUBLIC_MAPBOX_TOKEN. */
export function MissingTokenScreen({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface px-8">
      <Text className="text-lg font-semibold text-danger">Mapbox token missing</Text>
      <Text className="text-center text-sm text-text-muted">
        Add EXPO_PUBLIC_MAPBOX_TOKEN to .env and restart Metro with --clear.
      </Text>
      <Pressable accessibilityRole="button" onPress={onBack} className="mt-2 rounded-xl bg-surface-raised px-6 py-3">
        <Text className="font-semibold text-text">Back to missions</Text>
      </Pressable>
    </View>
  );
}
```

`src/features/map/MissionMap.tsx`:

```tsx
import type { Camera } from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { LocationBanner } from '@/features/location/LocationBanner';
import { useSelfLocation } from '@/features/location/use-self-location';
import type { MissionCamera } from '@/features/missions/repository';
import { Toolbar } from '@/features/toolbar/Toolbar';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';

import { clampZoom, SELF_ZOOM, WORLD_CAMERA } from './canvas/camera';
import { useCameraPersistence } from './canvas/camera-persistence';
import { MapCanvas } from './canvas/MapCanvas';
import { MapControls } from './controls/MapControls';
import { ReadoutCard } from './controls/ReadoutCard';
import { Crosshair } from './interaction/Crosshair';
import { PointsLayer } from './layers/PointsLayer';
import { SelfLayer } from './layers/SelfLayer';
import { isLandscape } from './layout';

const EASE = { animationMode: 'easeTo' as const };

export function MissionMap({ missionId, savedCamera }: { missionId: string; savedCamera: MissionCamera | null }) {
  const ctx = useCommandContext();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const landscape = isLandscape(width, height);
  const cameraRef = useRef<Camera>(null);
  const [initialCamera] = useState(() => savedCamera ?? WORLD_CAMERA);
  // With a saved camera the map opens where the user left it; otherwise the first fix centers it.
  const centeredOnSelf = useRef(savedCamera !== null);
  const followMode = useInteraction((s) => s.followMode);
  const setFollowMode = useInteraction((s) => s.setFollowMode);
  const selfPosition = usePresence((s) => s.selfPosition?.position ?? null);
  const saver = useCameraPersistence(ctx, missionId);
  useSelfLocation();

  useEffect(() => () => useInteraction.getState().reset(), []);

  useEffect(() => {
    if (!selfPosition) return;
    const centerCoordinate: [number, number] = [selfPosition.lon, selfPosition.lat];
    if (!centeredOnSelf.current) {
      centeredOnSelf.current = true;
      cameraRef.current?.setCamera({ centerCoordinate, zoomLevel: SELF_ZOOM, animationDuration: 0 });
    } else if (followMode) {
      cameraRef.current?.setCamera({ centerCoordinate, ...EASE, animationDuration: 500 });
    }
  }, [selfPosition, followMode]);

  const onUserGesture = () => {
    if (useInteraction.getState().followMode) setFollowMode(false);
  };
  const zoomBy = (delta: number) => {
    const zoomLevel = clampZoom(useInteraction.getState().cameraZoom + delta);
    cameraRef.current?.setCamera({ zoomLevel, ...EASE, animationDuration: 250 });
  };
  const northUp = () => cameraRef.current?.setCamera({ heading: 0, ...EASE, animationDuration: 300 });
  const recenter = () => {
    if (!selfPosition) return;
    setFollowMode(true);
    const zoomLevel = Math.max(useInteraction.getState().cameraZoom, SELF_ZOOM);
    cameraRef.current?.setCamera({ centerCoordinate: [selfPosition.lon, selfPosition.lat], zoomLevel, ...EASE, animationDuration: 500 });
  };
  // Interim "Switch mission" until Plan 3's app menu.
  const switchMission = () => {
    saver.flush();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View className="flex-1 bg-surface">
      <MapCanvas
        cameraRef={cameraRef}
        initialCamera={initialCamera}
        landscape={landscape}
        onCameraIdle={saver.schedule}
        onUserGesture={onUserGesture}>
        <PointsLayer missionId={missionId} />
        <SelfLayer />
      </MapCanvas>
      <Crosshair />
      <Toolbar landscape={landscape} activeTool={null} onMenu={switchMission} />
      <MapControls
        following={followMode}
        canRecenter={selfPosition !== null}
        onNorthUp={northUp}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onRecenter={recenter}
      />
      <ReadoutCard />
      <LocationBanner />
    </View>
  );
}
```

`src/features/map/MapScreen.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getMapboxToken } from '@/config/env';
import { openMission, type OpenMissionResult } from '@/features/missions/open-mission';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { MissingTokenScreen } from './MissingTokenScreen';
import { MissionMap } from './MissionMap';

/** Loads the mission before the map mounts; unknown or deleted missions return to the list. */
export function MapScreen({ missionId }: { missionId: string }) {
  const ctx = useCommandContext();
  const router = useRouter();
  const [opened, setOpened] = useState<OpenMissionResult | null>(null);

  useEffect(() => {
    let live = true;
    void openMission(ctx, missionId).then((result) => {
      if (live) setOpened(result);
    });
    return () => {
      live = false;
    };
  }, [ctx, missionId]);

  useEffect(() => {
    if (opened?.status === 'missing') router.replace('/');
  }, [opened, router]);

  if (!getMapboxToken()) return <MissingTokenScreen onBack={() => router.replace('/')} />;
  if (opened === null || opened.status === 'missing') return <View className="flex-1 bg-surface" />;
  return <MissionMap missionId={missionId} savedCamera={opened.camera} />;
}
```

Replace `src/app/missions/[missionId].tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';

import { MapScreen } from '@/features/map/MapScreen';

export default function MissionMapRoute() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  return <MapScreen key={missionId} missionId={missionId} />;
}
```

In `src/app/_layout.tsx` `ThemedStack`, add after the `missions/new` screen:

```tsx
      {/* Edge swipes belong to the map, never to navigation. */}
      <Stack.Screen name="missions/[missionId]" options={{ gestureEnabled: false }} />
```

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint && npx expo export --platform ios --output-dir /tmp/rtap-typegen > /dev/null`
Expected: all pass; the iOS bundle builds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add mission map screen with camera persistence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Offline tile packs service (no UI)

**Files:**
- Create: `src/features/map/offline/tile-packs.ts`, `src/features/map/offline/tile-packs.test.ts`

**Interfaces:**
- Consumes: `offlineManager` (`@rnmapbox/maps`), `MAP_STYLE_URL` (Task 8), `randomUUID` (`expo-crypto`), `Result`.
- Produces:
  - `type TilePackBounds = { north: number; south: number; east: number; west: number }`
  - `type TilePackProgress = { id: string; state: 'active' | 'complete' | 'error'; percentage: number; completedResources: number; error?: string }`
  - `type TilePackInfo = { id: string; metadata: Record<string, unknown> | null }`
  - `interface TilePackService { create(bounds, minZoom, maxZoom): Promise<Result<{ id: string }, 'invalid_bounds' | 'create_failed'>>; list(): Promise<TilePackInfo[]>; delete(id): Promise<Result<void, 'delete_failed'>>; progress$: Observable<TilePackProgress> }`
  - `createTilePackService(manager?, styleURL?, newId?): TilePackService`

- [ ] **Step 1: Write the failing test**

`src/features/map/offline/tile-packs.test.ts`:

```ts
import { createTilePackService, type TilePackProgress } from './tile-packs';

jest.mock('@rnmapbox/maps');

const BOUNDS = { north: 39, south: 38.8, east: -76.9, west: -77.1 };

function fakeManager() {
  return { createPack: jest.fn(async () => {}), getPacks: jest.fn(async () => []), deletePack: jest.fn(async () => {}) };
}

describe('TilePackService', () => {
  it('creates a pack with Mapbox bounds order and reports progress', async () => {
    const manager = fakeManager();
    const service = createTilePackService(manager as never, 'style://sat', () => 'pack-1');
    const events: TilePackProgress[] = [];
    service.progress$.subscribe((e) => events.push(e));

    expect(await service.create(BOUNDS, 10, 16)).toEqual({ ok: true, value: { id: 'pack-1' } });
    const [options, onProgress, onError] = manager.createPack.mock.calls[0] as unknown as [
      Record<string, unknown>,
      (pack: unknown, status: { state: string; percentage: number; completedResourceCount: number }) => void,
      (pack: unknown, error: { name: string; message: string }) => void,
    ];
    expect(options).toMatchObject({ name: 'pack-1', styleURL: 'style://sat', bounds: [[-76.9, 39], [-77.1, 38.8]], minZoom: 10, maxZoom: 16 });

    onProgress({}, { state: 'active', percentage: 40, completedResourceCount: 12 });
    onProgress({}, { state: 'complete', percentage: 100, completedResourceCount: 30 });
    onError({}, { name: 'pack-1', message: 'network' });
    expect(events).toEqual([
      { id: 'pack-1', state: 'active', percentage: 40, completedResources: 12 },
      { id: 'pack-1', state: 'complete', percentage: 100, completedResources: 30 },
      { id: 'pack-1', state: 'error', percentage: 0, completedResources: 0, error: 'network' },
    ]);
  });

  it.each([
    [{ ...BOUNDS, north: 38 }, 10, 16],
    [{ ...BOUNDS, west: -76 }, 10, 16],
    [{ ...BOUNDS, north: Number.NaN }, 10, 16],
    [{ ...BOUNDS, north: 95 }, 10, 16],
    [BOUNDS, 16, 10],
    [BOUNDS, -1, 10],
    [BOUNDS, 10, 23],
  ])('rejects invalid bounds or zoom (%p, %p, %p)', async (bounds, minZoom, maxZoom) => {
    const manager = fakeManager();
    const service = createTilePackService(manager as never, 'style://sat', () => 'x');
    expect(await service.create(bounds, minZoom, maxZoom)).toMatchObject({ ok: false, error: 'invalid_bounds' });
    expect(manager.createPack).not.toHaveBeenCalled();
  });

  it('wraps create and delete failures', async () => {
    const manager = fakeManager();
    manager.createPack.mockRejectedValueOnce(new Error('disk full'));
    manager.deletePack.mockRejectedValueOnce(new Error('nope'));
    const service = createTilePackService(manager as never, 'style://sat', () => 'x');
    expect(await service.create(BOUNDS, 10, 12)).toMatchObject({ ok: false, error: 'create_failed' });
    expect(await service.delete('x')).toMatchObject({ ok: false, error: 'delete_failed' });
  });

  it('lists and deletes packs by id', async () => {
    const manager = fakeManager();
    manager.getPacks.mockResolvedValueOnce([{ name: 'pack-1', metadata: { createdAt: 'x' } }] as never);
    const service = createTilePackService(manager as never, 'style://sat', () => 'x');
    expect(await service.list()).toEqual([{ id: 'pack-1', metadata: { createdAt: 'x' } }]);
    expect(await service.delete('pack-1')).toEqual({ ok: true, value: undefined });
    expect(manager.deletePack).toHaveBeenCalledWith('pack-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/map/offline`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/map/offline/tile-packs.ts`:

```ts
import { offlineManager } from '@rnmapbox/maps';
import * as Crypto from 'expo-crypto';
import { Subject, type Observable } from 'rxjs';

import { err, ok, type Result } from '@/lib/result';

import { MAP_STYLE_URL } from '../canvas/mapbox';

export type TilePackBounds = { north: number; south: number; east: number; west: number };
export type TilePackProgress = {
  id: string;
  state: 'active' | 'complete' | 'error';
  percentage: number;
  completedResources: number;
  error?: string;
};
export type TilePackInfo = { id: string; metadata: Record<string, unknown> | null };

export interface TilePackService {
  create(bounds: TilePackBounds, minZoom: number, maxZoom: number): Promise<Result<{ id: string }, 'invalid_bounds' | 'create_failed'>>;
  list(): Promise<TilePackInfo[]>;
  delete(id: string): Promise<Result<void, 'delete_failed'>>;
  progress$: Observable<TilePackProgress>;
}

type OfflineManagerLike = Pick<typeof offlineManager, 'createPack' | 'getPacks' | 'deletePack'>;

const MAX_ZOOM = 22;

function isValidBounds(b: TilePackBounds): boolean {
  const all = [b.north, b.south, b.east, b.west];
  return (
    all.every(Number.isFinite) &&
    b.south >= -90 && b.north <= 90 && b.south < b.north &&
    // No antimeridian crossing in MVP.
    b.west >= -180 && b.east <= 180 && b.west < b.east
  );
}

function isValidZoomRange(min: number, max: number): boolean {
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max <= MAX_ZOOM && min <= max;
}

/** Offline tile downloads over Mapbox's offline manager. Built and tested; no UI in MVP. */
export function createTilePackService(
  manager: OfflineManagerLike = offlineManager,
  styleURL: string = MAP_STYLE_URL,
  newId: () => string = Crypto.randomUUID,
): TilePackService {
  const progress = new Subject<TilePackProgress>();
  return {
    progress$: progress.asObservable(),

    async create(bounds, minZoom, maxZoom) {
      if (!isValidBounds(bounds) || !isValidZoomRange(minZoom, maxZoom)) {
        return err('invalid_bounds', 'Bounds or zoom range are invalid');
      }
      const id = newId();
      try {
        await manager.createPack(
          {
            name: id,
            styleURL,
            bounds: [
              [bounds.east, bounds.north],
              [bounds.west, bounds.south],
            ],
            minZoom,
            maxZoom,
            metadata: { createdAt: new Date().toISOString() },
          },
          (_pack, status) =>
            progress.next({
              id,
              state: status.state === 'complete' ? 'complete' : 'active',
              percentage: status.percentage,
              completedResources: status.completedResourceCount,
            }),
          (_pack, error) => progress.next({ id, state: 'error', percentage: 0, completedResources: 0, error: error.message }),
        );
        return ok({ id });
      } catch (e) {
        return err('create_failed', String(e));
      }
    },

    async list() {
      const packs = await manager.getPacks();
      return packs.map((pack) => ({ id: String(pack.name), metadata: (pack.metadata as Record<string, unknown>) ?? null }));
    },

    async delete(id) {
      try {
        await manager.deletePack(id);
        return ok(undefined);
      } catch (e) {
        return err('delete_failed', String(e));
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/offline
git commit -m "feat: add offline tile pack service

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: 5,000-point performance seed and `map-performance` skill

**Files:**
- Create: `src/features/dev/commands.ts`, `src/features/dev/dev.test.ts`, `.agents/skills/map-performance/SKILL.md`
- Modify: `src/features/missions/MissionsScreen.tsx` (dev-only seed button), `src/features/missions/MissionsScreen.test.tsx`, `.agents/rules/repo-overview.mdc`

**Interfaces:**
- Consumes: `createMission`, `saveMissionCamera` (missions commands), `pointGeometry` (`@/features/map-items/geometry`), `PRESET_SIDCS` (`@/features/symbology/presets`), `destination` (`@/lib/geo/measure/geodesic`).
- Produces: `seedPerformanceMission(ctx, { count, center?, radiusM?, random?, name? }): Promise<Result<{ missionId: string }, 'invalid_count' | 'write_failed'>>`; `PERF_SEED_CENTER`; `PERF_SEED_COUNT = 5000`.

- [ ] **Step 1: Write the failing tests**

`src/features/dev/dev.test.ts`:

```ts
import { firstValueFrom } from 'rxjs';

import { observeMissionItems } from '@/features/map-items/repository';
import { pointCoord } from '@/features/map-items/geometry';
import { getMissionCamera } from '@/features/missions/repository';
import { makeTestContext } from '@/lib/db/test-database';
import { inverse } from '@/lib/geo/measure/geodesic';

import { PERF_SEED_CENTER, seedPerformanceMission } from './commands';

function seeded(seed: number) {
  // Deterministic LCG so the test is reproducible.
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('seedPerformanceMission', () => {
  it('creates a mission of stamped points inside the radius, with a camera on them', async () => {
    const ctx = makeTestContext();
    const r = await seedPerformanceMission(ctx, { count: 120, radiusM: 2000, random: seeded(1) });
    if (!r.ok) throw new Error(r.message);

    const items = await firstValueFrom(observeMissionItems(ctx.db, r.value.missionId));
    expect(items).toHaveLength(120);
    for (const item of items) {
      expect(inverse(PERF_SEED_CENTER, pointCoord(item.geometry)!).distanceM).toBeLessThanOrEqual(2000.001);
    }
    expect(new Set(items.map((i) => i.sidc)).size).toBeGreaterThan(1);
    expect(await getMissionCamera(ctx.db, r.value.missionId)).toEqual({ center: PERF_SEED_CENTER, zoom: 12, bearing: 0 });
  });

  it.each([[0], [-5], [1.5], [20001]])('rejects count %p', async (count) => {
    expect(await seedPerformanceMission(makeTestContext(), { count })).toMatchObject({ ok: false, error: 'invalid_count' });
  });
});
```

Add to `src/features/missions/MissionsScreen.test.tsx` (top-level, beside the other mocks):

```tsx
const mockSeed = jest.fn(async (..._args: unknown[]) => ({ ok: true as const, value: { missionId: 'seeded' } }));
jest.mock('@/features/dev/commands', () => ({ PERF_SEED_COUNT: 5000, seedPerformanceMission: (...a: unknown[]) => mockSeed(...a) }));
```

and a test inside the `describe`:

```tsx
  it('seeds a 5k performance mission in development builds', async () => {
    await renderWithProviders(<MissionsScreen />);
    await fireEvent.press(await screen.findByText('Seed 5k'));
    expect(mockSeed).toHaveBeenCalledWith(expect.anything(), { count: 5000 });
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/missions/[missionId]', params: { missionId: 'seeded' } });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/dev src/features/missions/MissionsScreen.test.tsx`
Expected: FAIL — `./commands` not found; no "Seed 5k" button.

- [ ] **Step 3: Implement**

`src/features/dev/commands.ts`:

```ts
import { pointGeometry } from '@/features/map-items/geometry';
import { createMission, saveMissionCamera } from '@/features/missions/commands';
import { PRESET_SIDCS } from '@/features/symbology/presets';
import type { CommandContext } from '@/lib/db/command-context';
import type { MapItem } from '@/lib/db/models/MapItem';
import { Tables } from '@/lib/db/schema';
import { destination } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';
import { err, ok, type Result } from '@/lib/result';

/** Development only: data for the map-performance check (spec §8.8 rule 6). */
export const PERF_SEED_CENTER: LatLon = { lat: 38.8977, lon: -77.0365 };
export const PERF_SEED_COUNT = 5000;
const MAX_COUNT = 20000;
const BATCH_SIZE = 500;

type SeedOptions = { count: number; center?: LatLon; radiusM?: number; random?: () => number; name?: string };

export async function seedPerformanceMission(
  ctx: CommandContext,
  { count, center = PERF_SEED_CENTER, radiusM = 5000, random = Math.random, name = `Perf ${count}` }: SeedOptions,
): Promise<Result<{ missionId: string }, 'invalid_count' | 'write_failed'>> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return err('invalid_count', `Count must be a whole number from 1 to ${MAX_COUNT}`);
  }
  const mission = await createMission(ctx, { name });
  if (!mission.ok) return err('write_failed', mission.message);
  const missionId = mission.value.id;
  const actor = ctx.actorId();

  try {
    for (let start = 0; start < count; start += BATCH_SIZE) {
      const end = Math.min(count, start + BATCH_SIZE);
      await ctx.db.write(async () => {
        const items = ctx.db.get<MapItem>(Tables.mapItems);
        const records: MapItem[] = [];
        for (let i = start; i < end; i++) {
          // sqrt keeps points evenly spread over the disc instead of bunched at the center.
          const coord = destination(center, random() * 360, radiusM * Math.sqrt(random()));
          records.push(
            items.prepareCreate((item) => {
              item.missionId = missionId;
              item.kind = 'point';
              item.geometry = pointGeometry(coord);
              item.sidc = PRESET_SIDCS[i % PRESET_SIDCS.length];
              item.name = `P-${i + 1}`;
              item.notes = null;
              item.style = null;
              item.createdBy = actor;
              item.updatedBy = actor;
            }),
          );
        }
        await ctx.db.batch(records);
      });
    }
  } catch (e) {
    return err('write_failed', String(e));
  }

  await saveMissionCamera(ctx, missionId, { center, zoom: 12, bearing: 0 });
  return ok({ missionId });
}
```

In `src/features/missions/MissionsScreen.tsx`:
- import `useRef` from `react` and `{ PERF_SEED_COUNT, seedPerformanceMission }` from `@/features/dev/commands`;
- inside `MissionsScreen`, add:

```tsx
  const seeding = useRef(false);
  const seed = async () => {
    if (seeding.current) return;
    seeding.current = true;
    const result = await seedPerformanceMission(ctx, { count: PERF_SEED_COUNT });
    seeding.current = false;
    if (result.ok) openMission(result.value.missionId);
  };
```

- in the header row, wrap the right side so the dev button sits before `+ New` (and shows even when the list is empty):

```tsx
        <View className="flex-row items-center gap-3">
          {__DEV__ ? (
            <Pressable accessibilityRole="button" onPress={() => void seed()} hitSlop={8}>
              <Text className="text-xs uppercase tracking-wider text-text-muted">Seed 5k</Text>
            </Pressable>
          ) : null}
          {missions && missions.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={openCreate} className="rounded-xl bg-accent px-4 py-2">
              <Text className="font-bold text-on-accent">+ New</Text>
            </Pressable>
          ) : null}
        </View>
```

`.agents/skills/map-performance/SKILL.md`:

```markdown
---
name: map-performance
description: Use whenever you add or change anything rendered on the map (layers, sources, images, camera code, map overlays, readouts) or anything that re-renders while the map moves. The map must stay smooth with thousands of items.
---

# Map performance

The map is the product (spec §2, §8.8). Check every map change against these rules.

## Rules
1. **No per-item React components on the map.** Items render through one `ShapeSource` per
   kind with `SymbolLayer`/`LineLayer`s. Never `PointAnnotation` or `MarkerView` per item.
2. **The camera is uncontrolled.** Never pass `centerCoordinate`/`zoomLevel` props to
   `Camera` from React state. Initial camera = `defaultSettings`; moves = `cameraRef.current.setCamera(...)`.
3. **Stable style references.** Layer styles are module constants, or `useMemo` per theme
   (`makePointLabelStyle(colors)`). A new style object every render re-applies native styles.
4. **Hide with filters, not data.** Visibility uses `hiddenFilter(ids)` on the layer `filter`;
   the source's FeatureCollection is not rebuilt to hide items.
5. **Selectors cache features.** `createPointFeatureSelector()` reuses features by
   `id + updatedAt`; create one selector per layer instance (`useMemo`).
6. **High-frequency values are isolated.** Camera center/zoom/bearing flow through
   `createLatestThrottle` into `useInteraction`; only small leaf components (readout, north
   needle) subscribe. Heading updates are throttled (≈10 Hz, ≥2°). Never subscribe a screen
   or layer to `cameraCenter`.
7. **No map remounts.** Orientation changes re-layout chrome only; `MapCanvas` stays mounted.
8. **Images are registered once** (`MAP_IMAGES`, module constant) and referenced by name.

## Before merging map changes
- `npx jest src/features/map` passes (style-stability and filter tests included).
- On a physical device (development build): open **Seed 5k** on the missions screen (dev
  builds only) and pan/zoom/rotate for 30 s in portrait and landscape. Panning must stay
  smooth with no visible hitching; record the result in the PR or gate notes.
```

In `.agents/rules/repo-overview.mdc`, change the skills line to:

```markdown
- Skills: `geo-library` (coordinates, bearings), `data-layer` (WatermelonDB, sync rules),
  `styling` (semantic tokens), `map-performance` (anything on or over the map),
  `commits` (commit messages).
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add 5k-point performance seed and map-performance skill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Device verification checklist (human)

This task needs the user's EAS development build on a physical iPhone; agents prepare the notes
and the user reports results. No new native build is needed (no native packages were added).

**Files:**
- Modify: `docs/superpowers/notes/2026-10-12-native-gate.md`

- [ ] **Step 1: Add the Plan 2 checklist to the gate notes**

Append:

```markdown
## Plan 2 device checks (iOS dev build)

Run `npx expo start --dev-client --clear`, open the app on the device.

| # | Check | Result |
|---|-------|--------|
| 1 | Missions list: empty state → Create mission sheet (keyboard does not cover the field) → lands on the new mission's map | PENDING |
| 2 | Map opens on the user's position (first fix) or world view without a fix; no jump when reopening a mission with a saved camera | PENDING |
| 3 | Fonts: readout MGRS renders in JetBrains Mono | PENDING |
| 4 | Self icon: sky disc, white ring, dark arrow; view cone rotates with the phone; no arrow when the compass is unavailable | PENDING |
| 5 | Crosshair centered; readout MGRS changes while panning; tapping the bearing switches GRID ↔ MAG | PENDING |
| 6 | North-up needle follows map rotation; tap resets north. Zoom ± and recenter work; panning turns follow off | PENDING |
| 7 | Toolbar: full width in portrait, top-right in landscape; POINT and gear dimmed; hamburger returns to missions | PENDING |
| 8 | Mapbox logo/attribution visible top-left; scale bar above the readout | PENDING |
| 9 | Label chips: dark rounded chips under symbols, text readable, corners not distorted (stretch zones work) | PENDING |
| 10 | Map label glyphs load (DIN Pro). Monospace map labels need JetBrains Mono glyphs uploaded to Mapbox — decide | PENDING |
| 11 | Seed 5k → panning/zooming smooth for 30 s in both orientations | PENDING |
| 12 | Background the app on the map, kill it, reopen the mission: same camera | PENDING |
| 13 | Deny location (Settings → RTAP → Location → Never): banner shows, Settings button opens Settings, map still usable | PENDING |

Fallbacks if a check fails:
- 9: drop `stretchX`/`stretchY`/`content` from `LABEL_CHIP_IMAGE_OPTIONS` (whole-image stretch) or render chips at `scale: 1`.
- 10: keep DIN Pro (proportional) until JetBrains Mono glyphs are uploaded; switch `MAP_LABEL_FONT`.
- 2 (visible jump): keep `defaultSettings` and add `animationDuration: 0`; report to the controller.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/notes/2026-10-12-native-gate.md
git commit -m "docs: add Plan 2 device checklist to gate notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Hand off to the user**

Ask the user to run the checklist on their dev build and report each row. Record results in the
table (PASS / FAIL + note), apply listed fallbacks for failures, and commit.
