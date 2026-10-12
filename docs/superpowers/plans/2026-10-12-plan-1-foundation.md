# Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the native stack works, then build every non-visual foundation the map MVP
depends on: the geospatial library, the sync-ready data layer, theme tokens, settings,
symbol presets and images, lint-enforced boundaries, and the agent skills that keep later
work aligned.

**Architecture:** Pure TypeScript layers (`lib/geo`, `lib/db`, `features/*/repository|commands|selectors`)
built test-first with Jest, behind ESLint import boundaries. WatermelonDB runs on SQLite (JSI)
in the app and LokiJS in-memory in tests. Theme tokens are the single source of truth for UI
(NativeWind CSS variables), Mapbox styles, and generated symbol images.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript strict, Jest (`jest-expo`),
WatermelonDB 0.28, `@rnmapbox/maps` 10.3, NativeWind 4 + Tailwind CSS 3.4, Zustand 5,
`mgrs` 2.2, `geographiclib-geodesic` 2.2, `geomagnetism` 0.2 (bundles WMM2025),
`milsymbol` 3, `@resvg/resvg-js`.

**Spec:** `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md`
(mockups in `docs/design/mockups/`).

### Roadmap (this plan is 1 of 3)

| Plan | Delivers | Written |
|------|----------|---------|
| **1 — Foundation** (this) | native gate, `lib/geo`, data layer, theme tokens, settings, symbology, lint boundaries, skills | now |
| **2 — Missions & map shell** | missions screens + navigation, `MapCanvas`, `SelfLayer`, `PointsLayer` + label chips, crosshair + readout card, map controls, toolbar, fonts, offline `TilePackService` (no UI), 5k-point seed, `map-performance` skill | after Plan 1 (uses gate outcomes) |
| **3 — Menus & points** | `Panel`, menu registry/stack/host, menu primitives, `point.add` / `point.edit`, draft store + `DraftLayer`, camera padding, app/settings menus, `menus` + `map-item-kinds` skills | after Plan 2 |

## Global Constraints

- Expo SDK 57 (`expo ~57.0.27`), React Native 0.86.3, React 19.2.3; React Compiler stays enabled.
- Install packages with `npx expo install <pkg>` (dev deps: `npx expo install <pkg> -- --save-dev`); never bump the Expo SDK by hand.
- Development build required (`expo-dev-client`); Expo Go is unsupported. Never create or edit `ios/` or `android/` by hand.
- Web is not a target; template web files are removed.
- Canonical geo forms: positions WGS84 `{ lat, lon }` decimal degrees; bearings true north, decimal degrees. Convert only at edges.
- Mils: NATO 6400 only (`MILS_PER_CIRCLE = 6400`).
- Only `src/lib/geo/**` imports `mgrs`, `geographiclib-geodesic`, `geomagnetism`.
- Only `src/lib/db/**`, `src/features/*/repository.ts`, `src/features/*/commands.ts` import `@nozbe/watermelondb`.
- Only `src/features/map/**` imports `@rnmapbox/maps`.
- `src/lib/**` never imports `src/features/**`, `src/stores/**`, `src/components/**`, `src/app/**`.
- `src/lib/geo/**` imports nothing from `react` or `react-native`.
- IDs are client-generated UUIDv4. Local-only tables: `item_view_state`, `mission_view_state`.
- Colors: Tailwind palette values only, defined in `src/theme/`; no hex literals or raw palette classes elsewhere.
- Cross-feature imports are deep imports, never barrels (`index.ts` re-exports are not created).
- Commit messages use Conventional Commits (`.agents/skills/commits/SKILL.md`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before declaring any task done: `npx jest`, `npx tsc --noEmit`, `npx expo lint` all pass.

## Review Focus

1. **User standing on the crosshair** (distance ≈ 0): bearing is undefined — expect `bearing: null` and label `—`, never a fake `180°`. → test in Task 7.
2. **Hand-typed MGRS** with lowercase, spaces, odd digit counts, mismatched easting/northing lengths, wrong band letter, or polar latitudes: valid input parses regardless of case/spacing; everything else returns a typed error, never a wrong position or a throw. → tests in Task 4.
3. **Bearings that cross north** after grid/magnetic correction (e.g. true 1° with +2° convergence) and values that round up to 360°/6400 mils: always shown in `[0, 360)` / `[0, 6400)`, e.g. `000°`, `0000 mils`. → tests in Tasks 3, 6, 7.
4. **Device clock outside the WMM2025 window** (wrong date, or app still used after 2029): declination still returns a number from the nearest model rather than crashing the readout. → test in Task 6.
5. **Auto-naming with renamed and deleted points** (e.g. `HOS-4` renamed `OBJ IRON`, `HOS-5` deleted, lowercase `hos-7`): the next name is one more than the highest *existing* number for that prefix, matched case-insensitively; unrelated names are ignored. → tests in Task 14.

---

### Task 1: Test tooling, template cleanup, shared `Result`

**Files:**
- Modify: `package.json`, `app.json`, `src/app/_layout.tsx`, `src/app/index.tsx`
- Create: `jest.setup.ts`, `src/lib/result.ts`, `src/lib/result.test.ts`
- Delete: `src/app/explore.tsx`, `src/components/` (all files), `src/hooks/` (all files), `src/constants/theme.ts`, `src/global.css`, `scripts/reset-project.js`, `assets/images/tutorial-web.png`, `assets/images/react-logo*.png`, `assets/images/expo-logo.png`, `assets/images/expo-badge*.png`, `assets/images/logo-glow.png`, `assets/images/favicon.png`, `assets/images/tabIcons/`

**Interfaces:**
- Produces: `Result<T, E extends string = string>`, `ok(value)`, `err(error, message)` from `@/lib/result`.

- [ ] **Step 1: Install test tooling**

```bash
npx expo install jest-expo jest @types/jest @testing-library/react-native -- --save-dev
npm uninstall react-native-web react-dom expo-web-browser
```

- [ ] **Step 2: Configure Jest and scripts in `package.json`**

Replace the `scripts` block and add a `jest` block:

```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "lint": "expo lint",
  "test": "jest",
  "typecheck": "tsc --noEmit"
},
"jest": {
  "preset": "jest-expo",
  "setupFiles": ["<rootDir>/jest.setup.ts"],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@nozbe/.*|@rnmapbox/.*|nativewind|react-native-css-interop|geographiclib-geodesic|mgrs|geomagnetism|milsymbol)"
  ]
}
```

Create `jest.setup.ts` (mocks are added by later tasks):

```ts
// Global Jest setup. Native module mocks live here so every test sees the same fakes.
export {};
```

- [ ] **Step 3: Remove template files and web config**

```bash
git rm -r -q src/app/explore.tsx src/components src/hooks src/constants/theme.ts src/global.css scripts/reset-project.js \
  assets/images/tutorial-web.png assets/images/react-logo.png assets/images/react-logo@2x.png assets/images/react-logo@3x.png \
  assets/images/expo-logo.png assets/images/expo-badge.png assets/images/expo-badge-white.png assets/images/logo-glow.png \
  assets/images/favicon.png assets/images/tabIcons
```

In `app.json`: set `"orientation": "default"`, set `"name": "Tactical Map"`, and delete the whole `"web"` block.

- [ ] **Step 4: Replace the root layout and index with minimal placeholders**

`src/app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`src/app/index.tsx`:

```tsx
import { Text, View } from 'react-native';

// Placeholder until Plan 2 adds the missions screen.
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Tactical Map</Text>
    </View>
  );
}
```

- [ ] **Step 5: Write the failing test for `Result`**

`src/lib/result.test.ts`:

```ts
import { err, ok, type Result } from './result';

describe('Result', () => {
  it('ok wraps a value', () => {
    const r: Result<number> = ok(3);
    expect(r).toEqual({ ok: true, value: 3 });
  });

  it('err carries a typed code and message', () => {
    const r: Result<number, 'bad'> = err('bad', 'it broke');
    expect(r).toEqual({ ok: false, error: 'bad', message: 'it broke' });
  });

  it('narrows on ok', () => {
    const r: Result<string, 'x'> = Math.random() > 2 ? err('x', '') : ok('yes');
    if (r.ok) {
      expect(r.value.toUpperCase()).toBe('YES');
    } else {
      throw new Error('unreachable');
    }
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx jest src/lib/result.test.ts`
Expected: FAIL — `Cannot find module './result'`.

- [ ] **Step 7: Implement `src/lib/result.ts`**

```ts
/** Success/failure value used by geo functions and commands instead of throwing. */
export type Result<T, E extends string = string> =
  | { ok: true; value: T }
  | { ok: false; error: E; message: string };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function err<E extends string>(error: E, message: string): { ok: false; error: E; message: string } {
  return { ok: false, error, message };
}
```

- [ ] **Step 8: Run all checks**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: 3 tests pass; no type or lint errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: set up jest and strip expo template

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Native dependency gate (WatermelonDB, Mapbox, NativeWind on RN 0.86)

This is the spec's §16 verification gate. **A human with a Mapbox account and an iOS simulator
and Android emulator must run Steps 7–8.** If any check fails, STOP: do not continue to
later tasks; report which check failed with the error output so the spec can be revisited.

**Files:**
- Modify: `package.json`, `app.json`, `tsconfig.json`, `.gitignore`
- Create: `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `src/global.css`, `nativewind-env.d.ts`, `docs/superpowers/notes/2026-10-12-native-gate.md`
- Temporary (reverted in Step 9): `src/app/index.tsx`

**Interfaces:**
- Produces: working Babel (decorators), Metro (NativeWind), and config plugins that all later tasks rely on.

- [ ] **Step 1: Install native and build dependencies**

```bash
npx expo install expo-dev-client @rnmapbox/maps @nozbe/watermelondb expo-location expo-crypto expo-haptics expo-sqlite expo-build-properties nativewind @morrowdigital/watermelondb-expo-plugin
npx expo install tailwindcss@^3.4.17 @babel/plugin-proposal-decorators @babel/plugin-transform-class-properties -- --save-dev
```

- [ ] **Step 2: Configure plugins in `app.json`**

Replace the `plugins` array with:

```json
"plugins": [
  "expo-router",
  ["expo-splash-screen", { "backgroundColor": "#1c1917", "image": "./assets/images/splash-icon.png", "imageWidth": 76 }],
  "@rnmapbox/maps",
  ["expo-location", { "locationWhenInUsePermission": "Tactical Map shows your position and heading on the map." }],
  "@morrowdigital/watermelondb-expo-plugin",
  ["expo-build-properties", { "android": { "packagingOptions": { "pickFirst": ["**/libc++_shared.so"] } } }]
]
```

(`#1c1917` is Tailwind `stone-900`, the theme `surface`; `app.json` is outside `src/` so the hex rule does not apply.)

- [ ] **Step 3: Babel, Metro, Tailwind, TypeScript config**

`babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      // WatermelonDB models use legacy decorators; class fields must not shadow decorated getters.
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
    ],
  };
};
```

`metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './src/global.css' });
```

`tailwind.config.js` (semantic colors added in Task 9):

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
```

`src/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`nativewind-env.d.ts`:

```ts
/// <reference types="nativewind/types" />
```

In `tsconfig.json` add to `compilerOptions`: `"experimentalDecorators": true`.

In `.gitignore` add a line: `.env`.

- [ ] **Step 4: Add the Mapbox token (human)**

Create `.env` (git-ignored) with a public Mapbox token:

```
EXPO_PUBLIC_MAPBOX_TOKEN=pk.your-public-token
```

- [ ] **Step 5: Temporary spike screen**

Replace `src/app/index.tsx` with (this file is reverted in Step 9):

```tsx
import '../global.css';

import { Database, Model, appSchema, tableSchema } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { text } from '@nozbe/watermelondb/decorators';
import Mapbox, { Camera, MapView } from '@rnmapbox/maps';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

class Spike extends Model {
  static table = 'spikes';
  @text('name') name!: string;
}

const db = new Database({
  adapter: new SQLiteAdapter({
    schema: appSchema({ version: 1, tables: [tableSchema({ name: 'spikes', columns: [{ name: 'name', type: 'string' }] })] }),
    jsi: true,
    onSetUpError: (e) => console.error('[gate] db setup failed', e),
  }),
  modelClasses: [Spike],
});

export default function Gate() {
  const [rows, setRows] = useState<string[]>([]);
  const refresh = async () => setRows((await db.get<Spike>('spikes').query().fetch()).map((s) => s.name));
  useEffect(() => {
    refresh();
  }, []);
  const add = async () => {
    await db.write(() => db.get<Spike>('spikes').create((s) => { s.name = `row-${Date.now()}`; }));
    await refresh();
  };
  return (
    <View className="flex-1 bg-stone-900">
      <MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Satellite}>
        <Camera centerCoordinate={[-77.0365, 38.8977]} zoomLevel={12} />
      </MapView>
      <Pressable className="m-4 rounded-xl bg-amber-500 p-4" onPress={add}>
        <Text className="font-bold text-neutral-950">Rows: {rows.length} · last: {rows.at(-1) ?? '—'}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 6: Typecheck the spike**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Build and run on iOS (human)**

Run: `npx expo run:ios`
Check all of:
1. The app builds and launches with no red error screen.
2. Satellite imagery of Washington, DC renders and pans/zooms smoothly.
3. The button is amber with dark text on a stone background (NativeWind works).
4. Tapping the button increments the row count and shows the new name; the `name` value is not `undefined` (decorators work).
5. Kill and relaunch the app: the row count persists (SQLite JSI works).

- [ ] **Step 8: Build and run on Android (human)**

Run: `npx expo run:android`
Check the same five items.

- [ ] **Step 9: Record results and revert the spike**

Write `docs/superpowers/notes/2026-10-12-native-gate.md`:

```markdown
# Native dependency gate — 2026-10-12

| Check | iOS | Android |
|-------|-----|---------|
| Builds and launches | PASS/FAIL | PASS/FAIL |
| Mapbox satellite renders | PASS/FAIL | PASS/FAIL |
| NativeWind classes apply | PASS/FAIL | PASS/FAIL |
| WatermelonDB decorated field writes/reads | PASS/FAIL | PASS/FAIL |
| WatermelonDB persists across relaunch | PASS/FAIL | PASS/FAIL |

Installed versions: (paste `npm ls @nozbe/watermelondb @rnmapbox/maps nativewind tailwindcss`)

Notes: (any warnings or workarounds)
```

Fill it in with the real results. Then restore the placeholder screen:

```bash
git checkout HEAD -- src/app/index.tsx
```

If any check failed: commit the notes file only and STOP (report to the user).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "build: add native deps and verify watermelondb, mapbox, nativewind

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Geo types and angle units

**Files:**
- Create: `src/lib/geo/types.ts`, `src/lib/geo/units/angle.ts`, `src/lib/geo/units/angle.test.ts`

**Interfaces:**
- Produces:
  - `type LatLon = { readonly lat: number; readonly lon: number }`
  - `type NorthRef = 'true' | 'grid' | 'magnetic'`
  - `type AngleUnit = 'deg' | 'mil'`
  - `MILS_PER_CIRCLE = 6400`, `normalizeDeg(deg: number): number` (→ `[0, 360)`), `degToMils(deg: number): number` (→ `[0, 6400)`), `milsToDeg(mils: number): number` (→ `[0, 360)`), `toRad(deg)`, `toDeg(rad)`, `wrapLon(lon)` (→ `[-180, 180)`)

- [ ] **Step 1: Write the failing tests**

`src/lib/geo/units/angle.test.ts`:

```ts
import { MILS_PER_CIRCLE, degToMils, milsToDeg, normalizeDeg, wrapLon } from './angle';

describe('normalizeDeg', () => {
  it.each([
    [0, 0],
    [360, 0],
    [-1, 359],
    [725, 5],
    [359.5, 359.5],
    [-360, 0],
  ])('%p → %p', (input, expected) => {
    expect(normalizeDeg(input)).toBeCloseTo(expected, 10);
  });

  it('never returns -0', () => {
    expect(Object.is(normalizeDeg(-0), 0)).toBe(true);
    expect(Object.is(normalizeDeg(-360), 0)).toBe(true);
  });
});

describe('degToMils (NATO 6400)', () => {
  it('uses 6400 mils per circle', () => {
    expect(MILS_PER_CIRCLE).toBe(6400);
  });

  it.each([
    [0, 0],
    [90, 1600],
    [180, 3200],
    [270, 4800],
    [360, 0],
    [-90, 4800],
    [103, 1831.111],
  ])('%p° → %p mils', (deg, mils) => {
    expect(degToMils(deg)).toBeCloseTo(mils, 3);
  });

  it('stays below 6400 for values just under a full circle', () => {
    expect(degToMils(359.9999999)).toBeLessThan(6400);
  });
});

describe('milsToDeg', () => {
  it.each([
    [1600, 90],
    [3200, 180],
    [6400, 0],
    [-1600, 270],
  ])('%p mils → %p°', (mils, deg) => {
    expect(milsToDeg(mils)).toBeCloseTo(deg, 10);
  });
});

describe('wrapLon', () => {
  it.each([
    [0, 0],
    [180, -180],
    [-180, -180],
    [190, -170],
    [-190, 170],
  ])('%p → %p', (input, expected) => {
    expect(wrapLon(input)).toBeCloseTo(expected, 10);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/geo/units`
Expected: FAIL — `Cannot find module './angle'`.

- [ ] **Step 3: Implement**

`src/lib/geo/types.ts`:

```ts
/** WGS84 position in decimal degrees. */
export type LatLon = { readonly lat: number; readonly lon: number };

/** North reference a bearing is expressed against. */
export type NorthRef = 'true' | 'grid' | 'magnetic';

/** Unit used to display angles. Mils are always NATO 6400. */
export type AngleUnit = 'deg' | 'mil';
```

`src/lib/geo/units/angle.ts`:

```ts
/** NATO mils per full circle. The app supports no other mil system. */
export const MILS_PER_CIRCLE = 6400;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Normalizes any angle in degrees into [0, 360). Never returns -0. */
export function normalizeDeg(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return r === 0 || r === 360 ? 0 : r;
}

/** Normalizes a longitude into [-180, 180). */
export function wrapLon(lon: number): number {
  const r = normalizeDeg(lon + 180) - 180;
  return r === 0 ? 0 : r;
}

export function degToMils(deg: number): number {
  const mils = (normalizeDeg(deg) * MILS_PER_CIRCLE) / 360;
  return mils >= MILS_PER_CIRCLE ? 0 : mils;
}

export function milsToDeg(mils: number): number {
  return normalizeDeg((mils * 360) / MILS_PER_CIRCLE);
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/lib/geo/units`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo
git commit -m "feat: add geo types and NATO mil conversions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: UTM zones, MGRS conversion and MGRS/lat-lon formatting

**Files:**
- Create: `src/lib/geo/coords/utm.ts`, `src/lib/geo/coords/utm.test.ts`, `src/lib/geo/coords/mgrs.ts`, `src/lib/geo/coords/mgrs.test.ts`, `src/lib/geo/format/coords.ts`, `src/lib/geo/format/coords.test.ts`

**Interfaces:**
- Consumes: `LatLon`, `wrapLon` (Task 3); `Result`, `ok`, `err` (Task 1).
- Produces:
  - `utmZone(p: LatLon): number` (1–60, with Norway/Svalbard exceptions), `centralMeridian(zone: number): number`
  - `type MgrsPrecision = 1 | 2 | 3 | 4 | 5`
  - `type MgrsError = 'out_of_range' | 'invalid'`
  - `type MgrsParts = { zoneBand: string; square: string; easting: string; northing: string }`
  - `toMgrs(p: LatLon, precision?: MgrsPrecision): Result<string, MgrsError>` — compact form, e.g. `18SUJ2339407395`
  - `splitMgrs(input: string): Result<MgrsParts, 'invalid'>`
  - `parseMgrs(input: string | MgrsParts): Result<LatLon, MgrsError>`
  - `formatMgrs(compact: string): string` — `18S UJ 23394 07395`
  - `formatLatLon(p: LatLon): string` — `38.89770° N 77.03650° W`

- [ ] **Step 1: Write the failing tests**

`src/lib/geo/coords/utm.test.ts`:

```ts
import { centralMeridian, utmZone } from './utm';

describe('utmZone', () => {
  it.each([
    [38.9, -77, 18],
    [0, 0, 31],
    [0, -0.0001, 30],
    [0, 179.9, 60],
    [0, 180, 1],
    [57, 3.5, 32], // Norway exception
    [60.5, 10.5, 32],
    [78, 8, 31], // Svalbard exceptions
    [78, 10, 33],
    [78, 15, 33],
    [78, 25, 35],
    [78, 35, 37],
  ])('(%p, %p) → zone %p', (lat, lon, zone) => {
    expect(utmZone({ lat, lon })).toBe(zone);
  });
});

describe('centralMeridian', () => {
  it.each([
    [1, -177],
    [18, -75],
    [31, 3],
    [60, 177],
  ])('zone %p → %p°', (zone, cm) => {
    expect(centralMeridian(zone)).toBe(cm);
  });
});
```

`src/lib/geo/coords/mgrs.test.ts`:

```ts
import { parseMgrs, splitMgrs, toMgrs } from './mgrs';

describe('toMgrs', () => {
  it.each([
    [38.8977, -77.0365, '18SUJ2339407395'],
    [60.5, 10.5, '32VNN8239508035'],
    [57, 3.5, '32VJJ6609530843'],
    [78, 15, '33XWG0000058369'],
    [0, 0, '31NAA6602100000'],
    [0, -0.0001, '30NZF3396700000'],
  ])('(%p, %p) → %p', (lat, lon, expected) => {
    expect(toMgrs({ lat, lon })).toEqual({ ok: true, value: expected });
  });

  it('truncates to the requested precision', () => {
    expect(toMgrs({ lat: 38.8977, lon: -77.0365 }, 3)).toEqual({ ok: true, value: '18SUJ233073' });
  });

  it.each([
    [84.5, 0],
    [-80.5, 0],
  ])('returns out_of_range for polar latitude %p', (lat, lon) => {
    const r = toMgrs({ lat, lon });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('out_of_range');
  });
});

describe('splitMgrs', () => {
  it('splits compact strings', () => {
    expect(splitMgrs('18SUJ2339407395')).toEqual({
      ok: true,
      value: { zoneBand: '18S', square: 'UJ', easting: '23394', northing: '07395' },
    });
  });

  it('accepts lowercase and spaces', () => {
    expect(splitMgrs('  18s uj 23394 07395 ')).toEqual({
      ok: true,
      value: { zoneBand: '18S', square: 'UJ', easting: '23394', northing: '07395' },
    });
  });

  it.each(['garbage', '18SUJ233', '18SUJ23394073950', '18IUJ2339407395', ''])('rejects %p', (input) => {
    expect(splitMgrs(input).ok).toBe(false);
  });
});

describe('parseMgrs', () => {
  it('parses a 1 m reference to the center of the square', () => {
    const r = parseMgrs('18SUJ2339407395');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.lat).toBeCloseTo(38.8977, 4);
      expect(r.value.lon).toBeCloseTo(-77.0365, 4);
    }
  });

  it('parses spaced, lowercase input', () => {
    const r = parseMgrs(' 18s uj 23394 07395 ');
    expect(r.ok).toBe(true);
  });

  it('parses the four-field form used by the Add Point panel', () => {
    const r = parseMgrs({ zoneBand: '18s', square: 'uj', easting: '23394', northing: '07395' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lat).toBeCloseTo(38.8977, 4);
  });

  it('rejects mismatched easting/northing lengths', () => {
    const r = parseMgrs({ zoneBand: '18S', square: 'UJ', easting: '233', northing: '07395' });
    expect(r).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('rejects empty easting/northing', () => {
    const r = parseMgrs({ zoneBand: '18S', square: 'UJ', easting: '', northing: '' });
    expect(r).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('rejects a band letter that does not match the resulting position', () => {
    // 18T is the band north of 18S; the same square/digits do not fall inside band T.
    const r = parseMgrs('18TUJ2339407395');
    expect(r).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('rejects garbage without throwing', () => {
    expect(parseMgrs('garbage')).toMatchObject({ ok: false, error: 'invalid' });
  });
});
```

`src/lib/geo/format/coords.test.ts`:

```ts
import { formatLatLon, formatMgrs } from './coords';

describe('formatMgrs', () => {
  it('spaces a compact reference', () => {
    expect(formatMgrs('18SUJ2339407395')).toBe('18S UJ 23394 07395');
  });

  it('spaces a reduced-precision reference', () => {
    expect(formatMgrs('18SUJ233073')).toBe('18S UJ 233 073');
  });

  it('returns unparseable input unchanged', () => {
    expect(formatMgrs('nope')).toBe('nope');
  });
});

describe('formatLatLon', () => {
  it('formats hemispheres', () => {
    expect(formatLatLon({ lat: 38.8977, lon: -77.0365 })).toBe('38.89770° N 77.03650° W');
    expect(formatLatLon({ lat: -33.9, lon: 18.4 })).toBe('33.90000° S 18.40000° E');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/geo/coords src/lib/geo/format`
Expected: FAIL — modules not found.

- [ ] **Step 3: Install `mgrs`**

```bash
npx expo install mgrs
```

- [ ] **Step 4: Implement**

`src/lib/geo/coords/utm.ts`:

```ts
import type { LatLon } from '../types';
import { wrapLon } from '../units/angle';

/** UTM zone number for a position, including the Norway and Svalbard exceptions. */
export function utmZone(p: LatLon): number {
  const lon = wrapLon(p.lon);
  let zone = Math.floor((lon + 180) / 6) + 1;
  if (zone > 60) zone = 60;

  if (p.lat >= 56 && p.lat < 64 && lon >= 3 && lon < 12) return 32;

  if (p.lat >= 72 && p.lat < 84) {
    if (lon >= 0 && lon < 9) return 31;
    if (lon >= 9 && lon < 21) return 33;
    if (lon >= 21 && lon < 33) return 35;
    if (lon >= 33 && lon < 42) return 37;
  }
  return zone;
}

export function centralMeridian(zone: number): number {
  return zone * 6 - 183;
}
```

`src/lib/geo/coords/mgrs.ts`:

```ts
import * as mgrs from 'mgrs';

import { err, ok, type Result } from '@/lib/result';

import type { LatLon } from '../types';

export type MgrsPrecision = 1 | 2 | 3 | 4 | 5;
export type MgrsError = 'out_of_range' | 'invalid';
export type MgrsParts = { zoneBand: string; square: string; easting: string; northing: string };

/** MGRS covers 80°S to 84°N; polar regions use UPS, which the app does not support. */
const MIN_LAT = -80;
const MAX_LAT = 84;

// Zone 1–60 + band (C–X without I/O), 100 km square (A–Z without I/O), 0–10 digits.
const COMPACT_RE = /^(\d{1,2}[C-HJ-NP-X])([A-HJ-NP-Z]{2})(\d{0,10})$/;

export function toMgrs(p: LatLon, precision: MgrsPrecision = 5): Result<string, MgrsError> {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return err('invalid', 'Position is not a number');
  if (p.lat < MIN_LAT || p.lat > MAX_LAT) return err('out_of_range', 'MGRS covers 80°S to 84°N');
  try {
    return ok(mgrs.forward([p.lon, p.lat], precision));
  } catch (e) {
    return err('invalid', String(e));
  }
}

export function splitMgrs(input: string): Result<MgrsParts, 'invalid'> {
  const compact = input.replace(/\s+/g, '').toUpperCase();
  const m = COMPACT_RE.exec(compact);
  if (!m) return err('invalid', 'Not an MGRS reference');
  const digits = m[3];
  if (digits.length % 2 !== 0) return err('invalid', 'Easting and northing need the same number of digits');
  const half = digits.length / 2;
  return ok({ zoneBand: m[1], square: m[2], easting: digits.slice(0, half), northing: digits.slice(half) });
}

function normalizeParts(parts: MgrsParts): Result<MgrsParts, 'invalid'> {
  const clean = (s: string) => s.replace(/\s+/g, '').toUpperCase();
  const easting = clean(parts.easting);
  const northing = clean(parts.northing);
  if (easting.length === 0 || easting.length > 5 || easting.length !== northing.length) {
    return err('invalid', 'Easting and northing need the same number of digits (1–5)');
  }
  return splitMgrs(`${clean(parts.zoneBand)}${clean(parts.square)}${easting}${northing}`);
}

/** Parses an MGRS reference (string or four fields) to the center of the referenced square. */
export function parseMgrs(input: string | MgrsParts): Result<LatLon, MgrsError> {
  const parts = typeof input === 'string' ? splitMgrs(input) : normalizeParts(input);
  if (!parts.ok) return parts;
  const { zoneBand, square, easting, northing } = parts.value;
  if (easting.length === 0) return err('invalid', 'Easting and northing are required');

  let lon: number;
  let lat: number;
  try {
    [lon, lat] = mgrs.toPoint(`${zoneBand}${square}${easting}${northing}`);
  } catch (e) {
    return err('invalid', String(e));
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return err('invalid', 'Not an MGRS reference');

  // The library resolves northing using the band letter without checking it; a wrong band
  // silently yields a wrong position. Round-trip and require the same zone and band.
  const back = toMgrs({ lat, lon }, 1);
  if (!back.ok || !back.value.startsWith(zoneBand)) {
    return err('invalid', 'Grid zone does not match the square and digits');
  }
  return ok({ lat, lon });
}
```

`src/lib/geo/format/coords.ts`:

```ts
import { splitMgrs } from '../coords/mgrs';
import type { LatLon } from '../types';

/** `18SUJ2339407395` → `18S UJ 23394 07395`. Unparseable input is returned unchanged. */
export function formatMgrs(compact: string): string {
  const parts = splitMgrs(compact);
  if (!parts.ok) return compact;
  const { zoneBand, square, easting, northing } = parts.value;
  return [zoneBand, square, easting, northing].filter(Boolean).join(' ');
}

export function formatLatLon(p: LatLon): string {
  const lat = `${Math.abs(p.lat).toFixed(5)}° ${p.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(p.lon).toFixed(5)}° ${p.lon >= 0 ? 'E' : 'W'}`;
  return `${lat} ${lon}`;
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/lib/geo`
Expected: PASS. If the wrong-band test passes for the wrong reason (e.g. `mgrs` throws), that is acceptable as long as the result is `{ ok: false, error: 'invalid' }`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/geo
git commit -m "feat: add MGRS and UTM zone conversion to lib/geo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Geodesic distance, azimuth and destination

**Files:**
- Create: `src/lib/geo/measure/geodesic.ts`, `src/lib/geo/measure/geodesic.test.ts`

**Interfaces:**
- Consumes: `LatLon`, `normalizeDeg`.
- Produces:
  - `MIN_BEARING_DISTANCE_M = 0.5`
  - `inverse(a: LatLon, b: LatLon): { distanceM: number; azimuthTrue: number | null }` — azimuth `null` when closer than `MIN_BEARING_DISTANCE_M`
  - `destination(p: LatLon, azimuthTrue: number, distanceM: number): LatLon`

- [ ] **Step 1: Write the failing tests**

`src/lib/geo/measure/geodesic.test.ts`:

```ts
import { destination, inverse } from './geodesic';

describe('inverse (WGS84, Karney)', () => {
  it('JFK → CDG matches GeographicLib', () => {
    const r = inverse({ lat: 40.6, lon: -73.8 }, { lat: 49.01666667, lon: 2.55 });
    expect(r.distanceM).toBeCloseTo(5853226.256, 2);
    expect(r.azimuthTrue).toBeCloseTo(53.4702182, 6);
  });

  it('handles nearly antipodal points', () => {
    const r = inverse({ lat: 0, lon: 0 }, { lat: 0.5, lon: 179.5 });
    expect(r.distanceM).toBeCloseTo(19936288.579, 2);
    expect(r.azimuthTrue).toBeCloseTo(25.6718729, 6);
  });

  it('returns a null azimuth for coincident points', () => {
    const p = { lat: 38.8977, lon: -77.0365 };
    expect(inverse(p, p)).toEqual({ distanceM: 0, azimuthTrue: null });
  });

  it('returns azimuths in [0, 360)', () => {
    const r = inverse({ lat: 0, lon: 0 }, { lat: 0, lon: -1 });
    expect(r.azimuthTrue).toBeCloseTo(270, 6);
  });
});

describe('destination', () => {
  it('is the inverse of inverse()', () => {
    const d = destination({ lat: 40.6, lon: -73.8 }, 53.47, 5853226);
    expect(d.lat).toBeCloseTo(49.0168289, 6);
    expect(d.lon).toBeCloseTo(2.5500938, 6);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/geo/measure`
Expected: FAIL — module not found.

- [ ] **Step 3: Install and implement**

```bash
npx expo install geographiclib-geodesic
```

`src/lib/geo/measure/geodesic.ts`:

```ts
import { Geodesic } from 'geographiclib-geodesic';

import type { LatLon } from '../types';
import { normalizeDeg } from '../units/angle';

const WGS84 = Geodesic.WGS84;

/** Below this distance a bearing is meaningless (GPS noise, standing on the crosshair). */
export const MIN_BEARING_DISTANCE_M = 0.5;

export function inverse(a: LatLon, b: LatLon): { distanceM: number; azimuthTrue: number | null } {
  const r = WGS84.Inverse(a.lat, a.lon, b.lat, b.lon, Geodesic.DISTANCE | Geodesic.AZIMUTH);
  const distanceM = r.s12 ?? 0;
  if (distanceM < MIN_BEARING_DISTANCE_M || r.azi1 === undefined) return { distanceM, azimuthTrue: null };
  return { distanceM, azimuthTrue: normalizeDeg(r.azi1) };
}

export function destination(p: LatLon, azimuthTrue: number, distanceM: number): LatLon {
  const r = WGS84.Direct(p.lat, p.lon, azimuthTrue, distanceM);
  return { lat: r.lat2 as number, lon: r.lon2 as number };
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/lib/geo/measure && npx tsc --noEmit`
Expected: PASS, no type errors. (If `Direct`'s return type lacks `lat2`/`lon2`, the `as number` casts already cover it.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/geo/measure
git commit -m "feat: add geodesic inverse and destination to lib/geo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: North references — grid convergence, magnetic declination, conversion

**Files:**
- Create: `src/lib/geo/north/grid.ts`, `src/lib/geo/north/magnetic.ts`, `src/lib/geo/north/convert.ts`, and `*.test.ts` for each

**Interfaces:**
- Consumes: `utmZone`, `centralMeridian` (Task 4); `toRad`, `toDeg`, `wrapLon`, `normalizeDeg` (Task 3).
- Produces:
  - `gridConvergence(p: LatLon): number` — degrees from true north to grid north, east positive
  - `declination(p: LatLon, date: Date, altitudeKm?: number): number` — degrees from true north to magnetic north, east positive; never throws for out-of-range dates
  - `type NorthContext = { date: Date; declinationOverrideDeg?: number | null }`
  - `northOffset(ref: NorthRef, p: LatLon, ctx: NorthContext): number`
  - `fromTrue(azTrue: number, ref: NorthRef, p: LatLon, ctx: NorthContext): number` (→ `[0, 360)`)
  - `toTrue(az: number, ref: NorthRef, p: LatLon, ctx: NorthContext): number`
  - `gridMagneticAngle(p: LatLon, ctx: NorthContext): number` — degrees from grid north to magnetic north, east positive

- [ ] **Step 1: Write the failing tests**

`src/lib/geo/north/grid.test.ts`:

```ts
import { gridConvergence } from './grid';

describe('gridConvergence', () => {
  it('is zero on the central meridian', () => {
    expect(gridConvergence({ lat: 45, lon: -75 })).toBeCloseTo(0, 10);
  });

  it('is negative west of the central meridian in the northern hemisphere (Washington, DC)', () => {
    expect(gridConvergence({ lat: 38.8977, lon: -77.0365 })).toBeCloseTo(-1.2791, 3);
  });

  it('is positive east of the central meridian in the northern hemisphere', () => {
    expect(gridConvergence({ lat: 45, lon: -73 })).toBeCloseTo(1.4145, 3);
  });

  it('flips sign in the southern hemisphere (Cape Town, zone 34)', () => {
    expect(gridConvergence({ lat: -33.9, lon: 18.4 })).toBeCloseTo(1.4508, 3);
  });

  it('is zero on the equator', () => {
    expect(gridConvergence({ lat: 0, lon: -72 })).toBeCloseTo(0, 10);
  });
});
```

`src/lib/geo/north/magnetic.test.ts` (expected values are NOAA's WMM2025 test values shipped in the `geomagnetism` package):

```ts
import { declination } from './magnetic';

/** Decimal year → Date, matching the WMM test-value convention. */
function decimalYear(year: number): Date {
  const whole = Math.floor(year);
  const start = Date.UTC(whole, 0, 1);
  return new Date(start + (year - whole) * 365 * 24 * 3600 * 1000);
}

describe('declination (WMM2025)', () => {
  it.each([
    [2025.0, 28, 89, -121, -99.77],
    [2025.0, 65, 43, 93, 0.5],
    [2025.0, 51, -33, 109, -5.49],
    [2025.5, 6, -36, -137, 20.28],
    [2025.5, 63, 26, 81, 0.51],
  ])('%p alt %p km (%p, %p) → %p°', (year, altKm, lat, lon, decl) => {
    expect(declination({ lat, lon }, decimalYear(year), altKm)).toBeCloseTo(decl, 1);
  });

  it('does not throw for dates outside the model window', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const d = declination({ lat: 38.9, lon: -77 }, new Date(Date.UTC(2035, 0, 1)));
    expect(Number.isFinite(d)).toBe(true);
    spy.mockRestore();
  });
});
```

`src/lib/geo/north/convert.test.ts`:

```ts
import { fromTrue, gridMagneticAngle, northOffset, toTrue } from './convert';
import { gridConvergence } from './grid';

const DC = { lat: 38.8977, lon: -77.0365 };
const EAST = { lat: 45, lon: -73 }; // convergence ≈ +1.41°
const date = new Date(Date.UTC(2026, 5, 1));

describe('northOffset', () => {
  it('is zero for true north', () => {
    expect(northOffset('true', DC, { date })).toBe(0);
  });

  it('uses grid convergence for grid north', () => {
    expect(northOffset('grid', DC, { date })).toBeCloseTo(gridConvergence(DC), 10);
  });

  it('prefers a declination override for magnetic north', () => {
    expect(northOffset('magnetic', DC, { date, declinationOverrideDeg: 10 })).toBe(10);
  });

  it('computes declination when there is no override', () => {
    expect(northOffset('magnetic', DC, { date, declinationOverrideDeg: null })).toBeLessThan(-9);
  });
});

describe('fromTrue / toTrue', () => {
  it('wraps across north instead of going negative', () => {
    expect(fromTrue(1, 'grid', EAST, { date })).toBeCloseTo(359.5855, 3);
  });

  it('subtracts an east declination', () => {
    expect(fromTrue(5, 'magnetic', DC, { date, declinationOverrideDeg: 10 })).toBeCloseTo(355, 10);
  });

  it('round-trips', () => {
    for (const ref of ['true', 'grid', 'magnetic'] as const) {
      const ctx = { date, declinationOverrideDeg: 7.5 };
      expect(toTrue(fromTrue(123.4, ref, DC, ctx), ref, DC, ctx)).toBeCloseTo(123.4, 10);
    }
  });
});

describe('gridMagneticAngle', () => {
  it('is declination minus convergence', () => {
    const ctx = { date, declinationOverrideDeg: 10 };
    expect(gridMagneticAngle(DC, ctx)).toBeCloseTo(10 - gridConvergence(DC), 10);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/geo/north`
Expected: FAIL — modules not found.

- [ ] **Step 3: Install and implement**

```bash
npx expo install geomagnetism
```

`src/lib/geo/north/grid.ts`:

```ts
import { centralMeridian, utmZone } from '../coords/utm';
import type { LatLon } from '../types';
import { toDeg, toRad, wrapLon } from '../units/angle';

/**
 * Angle from true north to UTM grid north, east positive.
 * grid azimuth = true azimuth − convergence.
 */
export function gridConvergence(p: LatLon): number {
  const dLon = toRad(wrapLon(p.lon - centralMeridian(utmZone(p))));
  return toDeg(Math.atan(Math.tan(dLon) * Math.sin(toRad(p.lat))));
}
```

`src/lib/geo/north/magnetic.ts`:

```ts
import * as geomagnetism from 'geomagnetism';

import type { LatLon } from '../types';

type Model = ReturnType<typeof geomagnetism.model>;

// Building a model expands coefficients; readouts call this per frame, so cache by UTC day.
let cachedDay = '';
let cachedModel: Model | null = null;

function modelFor(date: Date): Model {
  const day = date.toISOString().slice(0, 10);
  if (cachedModel === null || day !== cachedDay) {
    // Fall back to the nearest model rather than throwing when the date is outside WMM2025.
    cachedModel = geomagnetism.model(date, { allowOutOfBoundsModel: true });
    cachedDay = day;
  }
  return cachedModel;
}

/**
 * Angle from true north to magnetic north, east positive (WMM).
 * magnetic azimuth = true azimuth − declination.
 */
export function declination(p: LatLon, date: Date, altitudeKm = 0): number {
  return modelFor(date).point([p.lat, p.lon, altitudeKm]).decl;
}
```

`src/lib/geo/north/convert.ts`:

```ts
import type { LatLon, NorthRef } from '../types';
import { normalizeDeg } from '../units/angle';
import { gridConvergence } from './grid';
import { declination } from './magnetic';

export type NorthContext = { date: Date; declinationOverrideDeg?: number | null };

/** Angle from true north to the given north reference at p, east positive. */
export function northOffset(ref: NorthRef, p: LatLon, ctx: NorthContext): number {
  switch (ref) {
    case 'true':
      return 0;
    case 'grid':
      return gridConvergence(p);
    case 'magnetic':
      return ctx.declinationOverrideDeg ?? declination(p, ctx.date);
  }
}

export function fromTrue(azTrue: number, ref: NorthRef, p: LatLon, ctx: NorthContext): number {
  return normalizeDeg(azTrue - northOffset(ref, p, ctx));
}

export function toTrue(az: number, ref: NorthRef, p: LatLon, ctx: NorthContext): number {
  return normalizeDeg(az + northOffset(ref, p, ctx));
}

/** G-M angle: from grid north to magnetic north, east positive. */
export function gridMagneticAngle(p: LatLon, ctx: NorthContext): number {
  return northOffset('magnetic', p, ctx) - northOffset('grid', p, ctx);
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/lib/geo/north && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/geo/north
git commit -m "feat: add grid convergence and WMM declination to lib/geo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Angle/distance formatting and `describeVector`

**Files:**
- Create: `src/lib/geo/format/measure.ts`, `src/lib/geo/format/measure.test.ts`, `src/lib/geo/vector.ts`, `src/lib/geo/vector.test.ts`

**Interfaces:**
- Consumes: `inverse`, `destination` (Task 5); `fromTrue`, `NorthContext` (Task 6); `degToMils` (Task 3).
- Produces:
  - `formatAngle(deg: number | null, unit: AngleUnit): string` — `069°`, `1831 mils`, `—`
  - `formatDistance(m: number): string` — `999 m`, `1.15 km`, `12.3 km`, `123 km`
  - `refLabel(ref: NorthRef): 'TRUE' | 'GRID' | 'MAG'`
  - `type VectorOptions = NorthContext & { unit: AngleUnit; ref: NorthRef }`
  - `type Vector = { distanceM: number; bearingDeg: number | null; distanceLabel: string; bearingLabel: string; refLabel: string }`
  - `describeVector(from: LatLon, to: LatLon, opts: VectorOptions): Vector`

- [ ] **Step 1: Write the failing tests**

`src/lib/geo/format/measure.test.ts`:

```ts
import { formatAngle, formatDistance, refLabel } from './measure';

describe('formatAngle', () => {
  it.each([
    [69, '069°'],
    [103.4, '103°'],
    [359.6, '000°'],
    [0.4, '000°'],
  ])('%p° in degrees → %p', (deg, label) => {
    expect(formatAngle(deg, 'deg')).toBe(label);
  });

  it.each([
    [103, '1831 mils'],
    [90, '1600 mils'],
    [359.99, '0000 mils'],
  ])('%p° in mils → %p', (deg, label) => {
    expect(formatAngle(deg, 'mil')).toBe(label);
  });

  it('renders a missing bearing as an em dash', () => {
    expect(formatAngle(null, 'deg')).toBe('—');
    expect(formatAngle(null, 'mil')).toBe('—');
  });
});

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [999.4, '999 m'],
    [999.6, '1.00 km'],
    [1150, '1.15 km'],
    [12345, '12.3 km'],
    [123456, '123 km'],
  ])('%p m → %p', (m, label) => {
    expect(formatDistance(m)).toBe(label);
  });
});

describe('refLabel', () => {
  it('labels each north reference', () => {
    expect(refLabel('true')).toBe('TRUE');
    expect(refLabel('grid')).toBe('GRID');
    expect(refLabel('magnetic')).toBe('MAG');
  });
});
```

`src/lib/geo/vector.test.ts`:

```ts
import { destination } from './measure/geodesic';
import { describeVector } from './vector';

const DC = { lat: 38.8977, lon: -77.0365 };
const target = destination(DC, 103, 1150);
const date = new Date(Date.UTC(2026, 5, 1));

describe('describeVector', () => {
  it('reports true bearing and distance', () => {
    const v = describeVector(DC, target, { unit: 'deg', ref: 'true', date });
    expect(v.distanceM).toBeCloseTo(1150, 3);
    expect(v.bearingDeg).toBeCloseTo(103, 6);
    expect(v.distanceLabel).toBe('1.15 km');
    expect(v.bearingLabel).toBe('103°');
    expect(v.refLabel).toBe('TRUE');
  });

  it('applies grid convergence at the origin', () => {
    const v = describeVector(DC, target, { unit: 'deg', ref: 'grid', date });
    expect(v.bearingDeg).toBeCloseTo(104.2791, 3);
    expect(v.bearingLabel).toBe('104°');
    expect(v.refLabel).toBe('GRID');
  });

  it('formats mils', () => {
    const v = describeVector(DC, target, { unit: 'mil', ref: 'grid', date });
    expect(v.bearingLabel).toBe('1854 mils');
  });

  it('applies a declination override', () => {
    const v = describeVector(DC, target, { unit: 'deg', ref: 'magnetic', date, declinationOverrideDeg: 10 });
    expect(v.bearingLabel).toBe('093°');
    expect(v.refLabel).toBe('MAG');
  });

  it('has no bearing when standing on the target', () => {
    const v = describeVector(DC, DC, { unit: 'deg', ref: 'grid', date });
    expect(v.distanceM).toBe(0);
    expect(v.bearingDeg).toBeNull();
    expect(v.bearingLabel).toBe('—');
    expect(v.distanceLabel).toBe('0 m');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/geo/format/measure src/lib/geo/vector`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/lib/geo/format/measure.ts`:

```ts
import type { AngleUnit, NorthRef } from '../types';
import { MILS_PER_CIRCLE, degToMils, normalizeDeg } from '../units/angle';

const NO_VALUE = '—';

export function formatAngle(deg: number | null, unit: AngleUnit): string {
  if (deg === null) return NO_VALUE;
  if (unit === 'mil') {
    const mils = Math.round(degToMils(deg)) % MILS_PER_CIRCLE;
    return `${String(mils).padStart(4, '0')} mils`;
  }
  const whole = Math.round(normalizeDeg(deg)) % 360;
  return `${String(whole).padStart(3, '0')}°`;
}

export function formatDistance(m: number): string {
  if (m < 999.5) return `${Math.round(m)} m`;
  const km = m / 1000;
  if (km < 9.995) return `${km.toFixed(2)} km`;
  if (km < 99.95) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function refLabel(ref: NorthRef): 'TRUE' | 'GRID' | 'MAG' {
  return ref === 'true' ? 'TRUE' : ref === 'grid' ? 'GRID' : 'MAG';
}
```

`src/lib/geo/vector.ts`:

```ts
import { formatAngle, formatDistance, refLabel } from './format/measure';
import { inverse } from './measure/geodesic';
import { fromTrue, type NorthContext } from './north/convert';
import type { AngleUnit, LatLon, NorthRef } from './types';

export type VectorOptions = NorthContext & { unit: AngleUnit; ref: NorthRef };

export type Vector = {
  distanceM: number;
  /** Bearing in the requested north reference, degrees in [0, 360); null when too close. */
  bearingDeg: number | null;
  distanceLabel: string;
  bearingLabel: string;
  refLabel: string;
};

/**
 * Range and bearing from one position to another in the user's unit and north reference.
 * The only function UI should use for range/bearing so every readout agrees.
 */
export function describeVector(from: LatLon, to: LatLon, opts: VectorOptions): Vector {
  const { distanceM, azimuthTrue } = inverse(from, to);
  const bearingDeg = azimuthTrue === null ? null : fromTrue(azimuthTrue, opts.ref, from, opts);
  return {
    distanceM,
    bearingDeg,
    distanceLabel: formatDistance(distanceM),
    bearingLabel: formatAngle(bearingDeg, opts.unit),
    refLabel: refLabel(opts.ref),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/lib/geo`
Expected: PASS (all geo tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo
git commit -m "feat: add describeVector and measurement formatting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: ESLint import boundaries and the `geo-library` skill

**Files:**
- Modify: `eslint.config.js`
- Create: `.agents/skills/geo-library/SKILL.md`

**Interfaces:**
- Produces: lint errors for every boundary in Global Constraints; later tasks must pass `npx expo lint`.

- [ ] **Step 1: Write a failing boundary check**

Create a temporary violating file:

```bash
mkdir -p src/features/tmp && printf "import * as mgrs from 'mgrs';\nexport const x = mgrs;\n" > src/features/tmp/bad.ts
npx expo lint src/features/tmp/bad.ts; echo "exit=$?"
```

Expected before the change: `exit=0` (no boundary rule yet).

- [ ] **Step 2: Replace `eslint.config.js`**

```js
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const GEO_LIBS = ['mgrs', 'geographiclib-geodesic', 'geomagnetism'];
const WATERMELON = ['@nozbe/watermelondb', '@nozbe/watermelondb/*'];
const MAPBOX = ['@rnmapbox/maps', '@rnmapbox/maps/*'];
const UPPER_LAYERS = ['@/features/*', '@/stores/*', '@/components/*', '@/app/*'];

const msg = {
  geo: 'Geodesy libraries are wrapped by src/lib/geo. Import from @/lib/geo/... instead.',
  db: 'Only src/lib/db and feature repository.ts/commands.ts may use WatermelonDB.',
  mapbox: 'Only src/features/map may import @rnmapbox/maps.',
  upper: 'src/lib must not depend on features, stores, components or routes.',
  react: 'src/lib/geo must stay framework-free (no react / react-native).',
};

/** One no-restricted-imports rule per zone; flat config replaces (not merges) rule options. */
function restrict({ geo = true, db = true, mapbox = true, upper = false, react = false }) {
  const paths = [];
  const patterns = [];
  if (geo) paths.push(...GEO_LIBS.map((name) => ({ name, message: msg.geo })));
  if (db) patterns.push({ group: WATERMELON, message: msg.db });
  if (mapbox) patterns.push({ group: MAPBOX, message: msg.mapbox });
  if (upper) patterns.push({ group: UPPER_LAYERS, message: msg.upper });
  if (react) paths.push({ name: 'react', message: msg.react }, { name: 'react-native', message: msg.react });
  return { 'no-restricted-imports': ['error', { paths, patterns }] };
}

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'scripts/*'] },
  // Order matters: later zones override earlier ones for files they match.
  { files: ['src/**/*.{ts,tsx}'], rules: restrict({}) },
  { files: ['src/lib/**/*.{ts,tsx}'], rules: restrict({ upper: true }) },
  { files: ['src/lib/geo/**/*.{ts,tsx}'], rules: restrict({ geo: false, upper: true, react: true }) },
  { files: ['src/lib/db/**/*.{ts,tsx}'], rules: restrict({ db: false, upper: true }) },
  { files: ['src/features/map/**/*.{ts,tsx}'], rules: restrict({ mapbox: false }) },
  {
    files: ['src/features/*/repository.ts', 'src/features/*/commands.ts', 'src/features/*/*.test.ts'],
    rules: restrict({ db: false }),
  },
]);
```

- [ ] **Step 3: Verify the boundary fires, then remove the probe**

```bash
npx expo lint src/features/tmp/bad.ts; echo "exit=$?"
```

Expected: an error mentioning "Geodesy libraries are wrapped by src/lib/geo", `exit=1`.

```bash
rm -r src/features/tmp
npx expo lint
```

Expected: clean.

- [ ] **Step 4: Write the `geo-library` skill**

`.agents/skills/geo-library/SKILL.md`:

```markdown
---
name: geo-library
description: Use whenever you compute or display coordinates, MGRS, distances, bearings, azimuths, mils, grid convergence or magnetic declination, or add a function to src/lib/geo. Defines the canonical forms, where geo code lives, and the test bar.
---

# Geo library (`src/lib/geo`)

## Rules
1. **Canonical forms.** Positions are WGS84 `{ lat, lon }` decimal degrees (`LatLon`).
   Bearings are **true north, decimal degrees**. Convert to grid/magnetic, mils, or strings
   only at the edge, with `fromTrue` / `formatAngle` / `formatMgrs`.
2. **Features never do trigonometry.** For range/bearing call
   `describeVector(from, to, { unit, ref, date, declinationOverrideDeg })` from
   `@/lib/geo/vector`. Every readout must go through it so they agree.
3. **Libraries are wrapped.** Only `src/lib/geo/**` may import `mgrs`,
   `geographiclib-geodesic`, `geomagnetism` (lint enforced). Add new geodesy libraries the
   same way: wrap them, export our own types.
4. **No React / React Native** in `src/lib/geo` (lint enforced). Functions are pure and
   synchronous; they run on every camera frame.
5. **Errors are values.** Return `Result` (`@/lib/result`) for bad input (unparseable MGRS,
   polar positions). Never throw, never return `NaN`.
6. **Mils are NATO 6400 only** (`MILS_PER_CIRCLE`).
7. **Sign conventions** (east positive): `gridConvergence` = true→grid north,
   `declination` = true→magnetic north. `ref azimuth = true azimuth − offset`.
8. **Dates are injected** (`NorthContext.date`) so tests are deterministic.

## Map of the module
| Need | Function |
|------|----------|
| MGRS string for a position | `toMgrs(p, precision)` → `formatMgrs(...)` |
| Position from typed MGRS | `parseMgrs(stringOrFourFields)` |
| Distance / azimuth | `inverse(a, b)` (`azimuthTrue` is null under 0.5 m) |
| Point at range/bearing | `destination(p, azTrue, m)` |
| Convert north reference | `fromTrue` / `toTrue` / `northOffset` / `gridMagneticAngle` |
| Labels | `formatAngle`, `formatDistance`, `refLabel`, `formatLatLon` |

## Adding a function
1. Put it in the folder for its concern (`coords/`, `measure/`, `north/`, `units/`, `format/`).
2. Write golden-vector tests first, from an authoritative source (GeographicLib, NGA, NOAA
   WMM test values, or a published worked example). Note the source in the test.
3. Cover edges: zone/band boundaries, Norway/Svalbard, the antimeridian, poles/out of range,
   0/360 wrap, zero distance.
4. Run `npx jest src/lib/geo`.
```

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js .agents/skills/geo-library
git commit -m "chore: enforce import boundaries and add geo-library skill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Theme tokens, NativeWind wiring, styling lint and `styling` skill

**Files:**
- Create: `src/theme/semantic-token-names.json`, `src/theme/tokens.ts`, `src/theme/tokens.test.ts`, `src/theme/ThemeProvider.tsx`, `src/theme/ThemeProvider.test.tsx`, `.agents/skills/styling/SKILL.md`
- Modify: `tailwind.config.js`, `eslint.config.js`, `src/app/_layout.tsx`

**Interfaces:**
- Produces:
  - `palette` (Tailwind name → hex), `type PaletteName`
  - `type SemanticToken` (union of the names in `semantic-token-names.json`)
  - `themes: { dark: Record<SemanticToken, TokenValue> }`, `type ThemeName = 'dark'`
  - `themeColors(name: ThemeName): Record<SemanticToken, string>` — CSS color strings (`#rrggbb` or `rgba(...)`)
  - `cssVars(name: ThemeName): Record<string, string>` — `{ '--surface': '#1c1917', ... }`
  - `mapColors(name: ThemeName)` — same as `themeColors`, for Mapbox styles and build scripts
  - `<ThemeProvider theme="dark">`, `useTheme(): { name: ThemeName; colors: Record<SemanticToken, string> }`
  - Tailwind classes: `bg-<token>`, `text-<token>`, `border-<token>` for every semantic token.

- [ ] **Step 1: Write the failing tests**

`src/theme/tokens.test.ts`:

```ts
import names from './semantic-token-names.json';
import { cssVars, mapColors, palette, themeColors, themes } from './tokens';

const tailwindConfig = require('../../tailwind.config.js');

describe('theme tokens', () => {
  it('defines every semantic token in every theme', () => {
    for (const theme of Object.values(themes)) {
      expect(Object.keys(theme).sort()).toEqual([...names].sort());
    }
  });

  it('only uses Tailwind palette colors', () => {
    for (const theme of Object.values(themes)) {
      for (const value of Object.values(theme)) {
        const name = typeof value === 'string' ? value : value.color;
        expect(palette).toHaveProperty(name);
      }
    }
  });

  it('resolves solid and translucent colors', () => {
    const colors = themeColors('dark');
    expect(colors.surface).toBe('#1c1917');
    expect(colors.accent).toBe('#f59e0b');
    expect(colors['surface-chrome']).toBe('rgba(10, 10, 10, 0.9)');
  });

  it('exposes css variables per token', () => {
    expect(cssVars('dark')['--hostile']).toBe('#f87171');
  });

  it('gives map styles the same colors as the UI', () => {
    expect(mapColors('dark')).toEqual(themeColors('dark'));
  });

  it('registers every semantic token as a Tailwind color', () => {
    const colors = tailwindConfig.theme.extend.colors;
    for (const name of names) expect(colors[name]).toBe(`var(--${name})`);
  });
});
```

`src/theme/ThemeProvider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe() {
  const { name, colors } = useTheme();
  return <Text>{`${name}:${colors.accent}`}</Text>;
}

describe('ThemeProvider', () => {
  it('provides theme colors to children', () => {
    render(
      <ThemeProvider theme="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('dark:#f59e0b')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/theme`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement tokens**

`src/theme/semantic-token-names.json`:

```json
[
  "surface",
  "surface-chrome",
  "surface-input",
  "surface-raised",
  "border",
  "text",
  "text-muted",
  "accent",
  "accent-subtle",
  "on-accent",
  "success",
  "danger",
  "friendly",
  "hostile",
  "neutral",
  "unknown",
  "self",
  "map-label-bg",
  "map-label-text"
]
```

`src/theme/tokens.ts`:

```ts
/**
 * Single source of truth for color. Palette entries are Tailwind CSS v3 colors, copied by
 * hand; only this folder may reference them. Everything else uses semantic tokens.
 */
export const palette = {
  'stone-50': '#fafaf9',
  'stone-400': '#a8a29e',
  'stone-700': '#44403c',
  'stone-800': '#292524',
  'stone-900': '#1c1917',
  'neutral-950': '#0a0a0a',
  'amber-500': '#f59e0b',
  'amber-950': '#451a03',
  'green-300': '#86efac',
  'green-500': '#22c55e',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'sky-300': '#7dd3fc',
  'sky-400': '#38bdf8',
  'yellow-300': '#fde047',
} as const;

export type PaletteName = keyof typeof palette;
type TokenValue = PaletteName | { color: PaletteName; alpha: number };

const dark = {
  surface: 'stone-900',
  'surface-chrome': { color: 'neutral-950', alpha: 0.9 },
  'surface-input': 'neutral-950',
  'surface-raised': 'stone-800',
  border: 'stone-700',
  text: 'stone-50',
  'text-muted': 'stone-400',
  accent: 'amber-500',
  'accent-subtle': 'amber-950',
  'on-accent': 'neutral-950',
  success: 'green-500',
  danger: 'red-500',
  friendly: 'sky-300',
  hostile: 'red-400',
  neutral: 'green-300',
  unknown: 'yellow-300',
  self: 'sky-400',
  'map-label-bg': { color: 'neutral-950', alpha: 0.85 },
  'map-label-text': 'stone-50',
} as const satisfies Record<string, TokenValue>;

export type SemanticToken = keyof typeof dark;
export const themes = { dark } as const satisfies Record<string, Record<SemanticToken, TokenValue>>;
export type ThemeName = keyof typeof themes;

function resolve(value: TokenValue): string {
  if (typeof value === 'string') return palette[value];
  const hex = palette[value.color];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${value.alpha})`;
}

export function themeColors(name: ThemeName): Record<SemanticToken, string> {
  const theme: Record<SemanticToken, TokenValue> = themes[name];
  return Object.fromEntries(
    Object.entries(theme).map(([token, value]) => [token, resolve(value)]),
  ) as Record<SemanticToken, string>;
}

export function cssVars(name: ThemeName): Record<string, string> {
  return Object.fromEntries(Object.entries(themeColors(name)).map(([token, color]) => [`--${token}`, color]));
}

/** Raw colors for Mapbox layer styles and build scripts; identical to the UI colors. */
export function mapColors(name: ThemeName): Record<SemanticToken, string> {
  return themeColors(name);
}
```

`tailwind.config.js` (replace):

```js
/** @type {import('tailwindcss').Config} */
const semanticTokens = require('./src/theme/semantic-token-names.json');

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Values come from CSS variables set by ThemeProvider (src/theme/tokens.ts).
      colors: Object.fromEntries(semanticTokens.map((name) => [name, `var(--${name})`])),
    },
  },
  plugins: [],
};
```

`src/theme/ThemeProvider.tsx`:

```tsx
import { vars } from 'nativewind';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { cssVars, themeColors, type SemanticToken, type ThemeName } from './tokens';

type ThemeValue = { name: ThemeName; colors: Record<SemanticToken, string> };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ theme, children }: { theme: ThemeName; children: ReactNode }) {
  const value = useMemo(() => ({ name: theme, colors: themeColors(theme) }), [theme]);
  const style = useMemo(() => [{ flex: 1 }, vars(cssVars(theme))], [theme]);
  return (
    <ThemeContext value={value}>
      <View style={style}>{children}</View>
    </ThemeContext>
  );
}

export function useTheme(): ThemeValue {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
```

`src/app/_layout.tsx` (replace):

```tsx
import '../global.css';

import { Stack } from 'expo-router';

import { ThemeProvider } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return (
    <ThemeProvider theme="dark">
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest src/theme && npx tsc --noEmit`
Expected: PASS. If `nativewind`'s `vars` fails to import under Jest, add to `jest.setup.ts`:
`jest.mock('nativewind', () => ({ vars: (v: Record<string, string>) => v }));` and re-run.

- [ ] **Step 5: Add styling lint rules**

In `eslint.config.js`, add these two entries at the end of the `defineConfig([...])` array:

```js
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'No hex colors outside src/theme. Use a semantic token (className or useTheme().colors).',
        },
        {
          selector:
            'Literal[value=/\\b(?:bg|text|border|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}\\b/]',
          message: 'No raw Tailwind palette classes. Use semantic classes (bg-surface, text-accent, ...).',
        },
      ],
    },
  },
```

Verify:

```bash
mkdir -p src/features/tmp && printf "export const c = '#ff0000';\nexport const k = 'bg-red-500';\n" > src/features/tmp/bad.ts
npx expo lint src/features/tmp/bad.ts; echo "exit=$?"
rm -r src/features/tmp
```

Expected: two errors, `exit=1`.

- [ ] **Step 6: Write the `styling` skill**

`.agents/skills/styling/SKILL.md`:

```markdown
---
name: styling
description: Use whenever you add or change colors, classNames, styles, themes, map layer colors, or UI that should match the mockups in docs/design/mockups. Defines semantic tokens, the Tailwind-only palette rule, and how map styles get colors.
---

# Styling

## Rules
1. **Semantic tokens only.** Components use classes like `bg-surface`, `text-text-muted`,
   `border-border`, `bg-accent text-on-accent`. Never hex values, never raw palette classes
   (`bg-stone-900`). Lint enforces both outside `src/theme/`.
2. **Tailwind palette only.** New colors are added to `palette` in `src/theme/tokens.ts`
   using the exact Tailwind v3 hex value and name. No custom colors.
3. **Adding a token:** add the name to `src/theme/semantic-token-names.json`, add a value
   to every theme in `tokens.ts` (`'stone-800'` or `{ color, alpha }`), run `npx jest src/theme`.
4. **Map layers** cannot use classNames. Use `mapColors(theme)` (or `useTheme().colors`)
   for Mapbox style values, so map and UI share one source.
5. **Themes** are data: a new theme (day, night/red-light) is a new entry in `themes`.
6. **Match the mockups** in `docs/design/mockups/`: dark chrome, amber accent, uppercase
   tracked labels, monospace readouts and map labels.

## Token reference (dark)
| Token | Use |
|-------|-----|
| `surface` | panels and sheets |
| `surface-chrome` | toolbar, map buttons, readout card (translucent) |
| `surface-input` | text fields, segmented controls |
| `surface-raised` | secondary buttons |
| `border` | borders, dividers |
| `text` / `text-muted` | primary / label text |
| `accent` / `accent-subtle` / `on-accent` | primary action, active tool, focus, draft |
| `success` / `danger` | valid input / destructive, invalid |
| `friendly` / `hostile` / `neutral` / `unknown` | affiliation colors (symbols too) |
| `self` | own-position icon |
| `map-label-bg` / `map-label-text` | map label chips |
```

- [ ] **Step 7: Run all checks and commit**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: all pass.

```bash
git add -A
git commit -m "feat: add semantic theme tokens with nativewind and styling lint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Settings store

**Files:**
- Create: `src/stores/settings.ts`, `src/stores/settings.test.ts`
- Modify: `jest.setup.ts`

**Interfaces:**
- Consumes: `AngleUnit`, `NorthRef` (Task 3).
- Produces:
  - `type CoordinateFormat = 'mgrs' | 'latlon'`
  - `DEFAULT_SETTINGS = { coordinateFormat: 'mgrs', angleUnit: 'deg', northRef: 'grid', declinationOverrideDeg: null }`
  - `useSettings` (Zustand hook) with state above plus `setCoordinateFormat(f)`, `setAngleUnit(u)`, `setNorthRef(r)`, `toggleGridMagnetic()`, `setDeclinationOverride(deg: number | null): boolean`
  - `jest.setup.ts` mocks for `expo-sqlite/kv-store` (also used by Task 11)

- [ ] **Step 1: Add the kv-store and crypto mocks to `jest.setup.ts`**

Replace `jest.setup.ts`:

```ts
// Global Jest setup. Native module mocks live here so every test sees the same fakes.

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  const api = {
    getItemSync: (key: string) => store.get(key) ?? null,
    setItemSync: (key: string, value: string) => void store.set(key, value),
    removeItemSync: (key: string) => void store.delete(key),
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
    removeItem: async (key: string) => void store.delete(key),
    clearSync: () => store.clear(),
  };
  return { __esModule: true, default: api, Storage: api };
});
```

- [ ] **Step 2: Write the failing tests**

`src/stores/settings.test.ts`:

```ts
import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_SETTINGS, useSettings } from './settings';

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('settings store', () => {
  it('defaults to MGRS, degrees, grid north, no override', () => {
    const s = useSettings.getState();
    expect(s.coordinateFormat).toBe('mgrs');
    expect(s.angleUnit).toBe('deg');
    expect(s.northRef).toBe('grid');
    expect(s.declinationOverrideDeg).toBeNull();
  });

  it('toggles grid ↔ magnetic', () => {
    useSettings.getState().toggleGridMagnetic();
    expect(useSettings.getState().northRef).toBe('magnetic');
    useSettings.getState().toggleGridMagnetic();
    expect(useSettings.getState().northRef).toBe('grid');
  });

  it('toggles from true north to grid', () => {
    useSettings.getState().setNorthRef('true');
    useSettings.getState().toggleGridMagnetic();
    expect(useSettings.getState().northRef).toBe('grid');
  });

  it('accepts a declination override within ±180°', () => {
    expect(useSettings.getState().setDeclinationOverride(-10.5)).toBe(true);
    expect(useSettings.getState().declinationOverrideDeg).toBe(-10.5);
    expect(useSettings.getState().setDeclinationOverride(null)).toBe(true);
    expect(useSettings.getState().declinationOverrideDeg).toBeNull();
  });

  it.each([Number.NaN, 181, -200, Number.POSITIVE_INFINITY])('rejects override %p', (deg) => {
    expect(useSettings.getState().setDeclinationOverride(deg)).toBe(false);
    expect(useSettings.getState().declinationOverrideDeg).toBeNull();
  });

  it('persists to the kv store', async () => {
    useSettings.getState().setAngleUnit('mil');
    await new Promise((r) => setTimeout(r, 0));
    const raw = await Storage.getItem('settings');
    expect(JSON.parse(raw ?? '{}').state.angleUnit).toBe('mil');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/stores`
Expected: FAIL — module not found.

- [ ] **Step 4: Install and implement**

```bash
npx expo install zustand
```

`src/stores/settings.ts`:

```ts
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AngleUnit, NorthRef } from '@/lib/geo/types';

export type CoordinateFormat = 'mgrs' | 'latlon';

type SettingsValues = {
  coordinateFormat: CoordinateFormat;
  angleUnit: AngleUnit;
  northRef: NorthRef;
  /** Manual declination in degrees (east positive); null = use the WMM model. */
  declinationOverrideDeg: number | null;
};

type SettingsActions = {
  setCoordinateFormat: (format: CoordinateFormat) => void;
  setAngleUnit: (unit: AngleUnit) => void;
  setNorthRef: (ref: NorthRef) => void;
  /** One-tap toggle used by the readout: grid ↔ magnetic (true north goes to grid). */
  toggleGridMagnetic: () => void;
  /** Returns false (and changes nothing) for non-finite values or |deg| > 180. */
  setDeclinationOverride: (deg: number | null) => boolean;
};

export type SettingsState = SettingsValues & SettingsActions;

export const DEFAULT_SETTINGS: SettingsValues = {
  coordinateFormat: 'mgrs',
  angleUnit: 'deg',
  northRef: 'grid',
  declinationOverrideDeg: null,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      setCoordinateFormat: (coordinateFormat) => set({ coordinateFormat }),
      setAngleUnit: (angleUnit) => set({ angleUnit }),
      setNorthRef: (northRef) => set({ northRef }),
      toggleGridMagnetic: () => set({ northRef: get().northRef === 'grid' ? 'magnetic' : 'grid' }),
      setDeclinationOverride: (deg) => {
        if (deg !== null && (!Number.isFinite(deg) || Math.abs(deg) > 180)) return false;
        set({ declinationOverrideDeg: deg });
        return true;
      },
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => Storage),
      partialize: ({ coordinateFormat, angleUnit, northRef, declinationOverrideDeg }) => ({
        coordinateFormat,
        angleUnit,
        northRef,
        declinationOverrideDeg,
      }),
    },
  ),
);
```

- [ ] **Step 5: Run tests and commit**

Run: `npx jest src/stores && npx tsc --noEmit && npx expo lint`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add persisted settings store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Database schema, models, adapters, identity

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/migrations.ts`, `src/lib/db/ids.ts`, `src/lib/db/models/Mission.ts`, `src/lib/db/models/MissionViewState.ts`, `src/lib/db/models/MapItem.ts`, `src/lib/db/models/ItemViewState.ts`, `src/lib/db/create-database.ts`, `src/lib/db/app-database.ts`, `src/lib/db/test-database.ts`, `src/lib/db/sync-config.ts`, `src/lib/db/command-context.ts`, `src/lib/db/db.test.ts`, `src/lib/identity/device-id.ts`, `src/lib/identity/device-id.test.ts`

**Interfaces:**
- Produces:
  - `Tables = { missions, mapItems: 'map_items', itemViewState: 'item_view_state', missionViewState: 'mission_view_state' }`, `schema`, `migrations`
  - Models: `Mission { name, createdBy, createdAt, updatedAt }`, `MissionViewState { missionId, lastOpenedAt, camera, updatedAt }`, `MapItem { missionId, kind, geometry, sidc, name, notes, style, createdBy, updatedBy, createdAt, updatedAt }`, `ItemViewState { mapItemId, hidden, updatedAt }`
  - `createDatabase(adapter: DatabaseAdapter): Database`
  - `getAppDatabase(): Database` (SQLite JSI singleton)
  - `createTestDatabase(): Database` (LokiJS, in-memory)
  - `type CommandContext = { db: Database; actorId: () => string; now: () => number }`
  - `makeTestContext(db?: Database): CommandContext` (in `test-database.ts`)
  - `LOCAL_ONLY_TABLES`, `SYNCED_TABLES`
  - `getDeviceId(): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/db/db.test.ts`:

```ts
import type { Mission } from './models/Mission';
import { schema, Tables } from './schema';
import { LOCAL_ONLY_TABLES, SYNCED_TABLES } from './sync-config';
import { createTestDatabase } from './test-database';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('database', () => {
  it('creates records with UUIDv4 ids and decorated fields', async () => {
    const db = createTestDatabase();
    const mission = await db.write(() =>
      db.get<Mission>(Tables.missions).create((m) => {
        m.name = '  Alpha  ';
        m.createdBy = 'device-1';
      }),
    );
    expect(mission.id).toMatch(UUID_V4);
    expect(mission.name).toBe('Alpha'); // @text trims
    expect(mission.createdBy).toBe('device-1');
    expect(mission.createdAt).toBeInstanceOf(Date);
    expect(mission.updatedAt).toBeInstanceOf(Date);
  });

  it('classifies every table as synced or local-only', () => {
    const tables = Object.keys(schema.tables).sort();
    expect([...SYNCED_TABLES, ...LOCAL_ONLY_TABLES].sort()).toEqual(tables);
  });

  it('keeps view state local', () => {
    expect(LOCAL_ONLY_TABLES).toEqual(expect.arrayContaining([Tables.itemViewState, Tables.missionViewState]));
  });
});
```

`src/lib/identity/device-id.test.ts`:

```ts
import { getDeviceId } from './device-id';

describe('getDeviceId', () => {
  it('returns a stable UUID', () => {
    const first = getDeviceId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(first);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/db src/lib/identity`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement schema, migrations, ids, sync config**

`src/lib/db/schema.ts`:

```ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const Tables = {
  missions: 'missions',
  mapItems: 'map_items',
  itemViewState: 'item_view_state',
  missionViewState: 'mission_view_state',
} as const;

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: Tables.missions,
      columns: [
        { name: 'name', type: 'string' },
        { name: 'created_by', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: Tables.mapItems,
      columns: [
        { name: 'mission_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string', isIndexed: true },
        { name: 'geometry', type: 'string' },
        { name: 'sidc', type: 'string', isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'style', type: 'string', isOptional: true },
        { name: 'created_by', type: 'string' },
        { name: 'updated_by', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: Tables.itemViewState,
      columns: [
        { name: 'map_item_id', type: 'string', isIndexed: true },
        { name: 'hidden', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: Tables.missionViewState,
      columns: [
        { name: 'mission_id', type: 'string', isIndexed: true },
        { name: 'last_opened_at', type: 'number' },
        { name: 'camera', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
```

`src/lib/db/migrations.ts`:

```ts
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Append-only. Never edit a migration that has shipped; add a new one and bump schema.version.
export const migrations = schemaMigrations({ migrations: [] });
```

`src/lib/db/ids.ts`:

```ts
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import * as Crypto from 'expo-crypto';

/** Record ids are UUIDv4 so a future server can accept client-created records as-is. */
export function installUuidGenerator(): void {
  setGenerator(() => Crypto.randomUUID());
}
```

`src/lib/db/sync-config.ts`:

```ts
import { Tables } from './schema';

/** Shared with other users once sync exists. */
export const SYNCED_TABLES = [Tables.missions, Tables.mapItems] as const;

/** Per-device view state. Must be excluded from sync push and pull. */
export const LOCAL_ONLY_TABLES = [Tables.itemViewState, Tables.missionViewState] as const;
```

- [ ] **Step 4: Implement models**

`src/lib/db/models/Mission.ts`:

```ts
import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export class Mission extends Model {
  static table = Tables.missions;

  @text('name') name!: string;
  @field('created_by') createdBy!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
```

`src/lib/db/models/MissionViewState.ts`:

```ts
import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

/** Local-only: when this device last opened a mission and where its camera was. */
export class MissionViewState extends Model {
  static table = Tables.missionViewState;

  @field('mission_id') missionId!: string;
  @field('last_opened_at') lastOpenedAt!: number;
  /** JSON `MissionCamera` or null. */
  @field('camera') camera!: string | null;
  @readonly @date('updated_at') updatedAt!: Date;
}
```

`src/lib/db/models/MapItem.ts`:

```ts
import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

export type MapItemKind = 'point';

export class MapItem extends Model {
  static table = Tables.mapItems;

  @field('mission_id') missionId!: string;
  @field('kind') kind!: MapItemKind;
  /** GeoJSON geometry JSON, WGS84 [lon, lat]. */
  @field('geometry') geometry!: string;
  @field('sidc') sidc!: string | null;
  @text('name') name!: string;
  @field('notes') notes!: string | null;
  /** JSON style for lines/polygons (later). */
  @field('style') style!: string | null;
  @field('created_by') createdBy!: string;
  @field('updated_by') updatedBy!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
```

`src/lib/db/models/ItemViewState.ts`:

```ts
import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

import { Tables } from '../schema';

/** Local-only: per-device visibility of a map item. No row = visible. */
export class ItemViewState extends Model {
  static table = Tables.itemViewState;

  @field('map_item_id') mapItemId!: string;
  @field('hidden') hidden!: boolean;
  @readonly @date('updated_at') updatedAt!: Date;
}
```

- [ ] **Step 5: Implement database factories, command context, identity**

`src/lib/db/create-database.ts`:

```ts
import { Database, type DatabaseAdapter } from '@nozbe/watermelondb';

import { installUuidGenerator } from './ids';
import { ItemViewState } from './models/ItemViewState';
import { MapItem } from './models/MapItem';
import { Mission } from './models/Mission';
import { MissionViewState } from './models/MissionViewState';

export function createDatabase(adapter: DatabaseAdapter): Database {
  installUuidGenerator();
  return new Database({ adapter, modelClasses: [Mission, MissionViewState, MapItem, ItemViewState] });
}
```

`src/lib/db/app-database.ts`:

```ts
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
```

`src/lib/db/command-context.ts`:

```ts
import type { Database } from '@nozbe/watermelondb';

/** Everything a command needs; injected so tests control identity and time. */
export type CommandContext = {
  db: Database;
  /** deviceId now, userId once accounts exist. Stamped on created_by / updated_by. */
  actorId: () => string;
  now: () => number;
};
```

`src/lib/db/test-database.ts`:

```ts
import type { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import type { CommandContext } from './command-context';
import { createDatabase } from './create-database';
import { migrations } from './migrations';
import { schema } from './schema';

let counter = 0;

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
```

`src/lib/identity/device-id.ts`:

```ts
import * as Crypto from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';

const KEY = 'identity.deviceId';

/** Stable per-install id used as the author of records until accounts exist. */
export function getDeviceId(): string {
  const existing = Storage.getItemSync(KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  Storage.setItemSync(KEY, id);
  return id;
}
```

- [ ] **Step 6: Run tests**

Run: `npx jest src/lib/db src/lib/identity && npx tsc --noEmit && npx expo lint`
Expected: PASS.
If `mission.name` is `undefined`, the class-fields Babel issue is back: confirm `babel.config.js` from Task 2 is unchanged and run `npx jest --clearCache`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add sync-ready watermelondb schema, models and identity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Missions repository and commands

**Files:**
- Create: `src/features/missions/repository.ts`, `src/features/missions/commands.ts`, `src/features/missions/missions.test.ts`

**Interfaces:**
- Consumes: `Tables`, `Mission`, `MissionViewState`, `MapItem`, `CommandContext`, `createTestDatabase`, `makeTestContext` (Task 11); `Result`, `ok`, `err` (Task 1); `LatLon` (Task 3).
- Produces:
  - `type MissionCamera = { center: LatLon; zoom: number; bearing: number }`
  - `type MissionSummary = { id: string; name: string; createdAt: number; lastOpenedAt: number | null }`
  - `observeMissionSummaries(db: Database): Observable<MissionSummary[]>` — sorted by `lastOpenedAt` desc (never-opened last), then `createdAt` desc
  - `observeMissionItemCount(db: Database, missionId: string): Observable<number>`
  - `findMission(db: Database, id: string): Promise<Mission | null>`
  - `getMissionCamera(db: Database, missionId: string): Promise<MissionCamera | null>`
  - `suggestMissionName(db: Database): Promise<string>` — `Mission <count + 1>`
  - `createMission(ctx, { name }): Promise<Result<{ id: string }, 'invalid_name' | 'write_failed'>>`
  - `markMissionOpened(ctx, missionId): Promise<Result<void, 'write_failed'>>`
  - `saveMissionCamera(ctx, missionId, camera: MissionCamera): Promise<Result<void, 'invalid_camera' | 'write_failed'>>`

- [ ] **Step 1: Write the failing tests**

`src/features/missions/missions.test.ts`:

```ts
import { Q } from '@nozbe/watermelondb';
import { firstValueFrom } from 'rxjs';

import type { MapItem } from '@/lib/db/models/MapItem';
import type { MissionViewState } from '@/lib/db/models/MissionViewState';
import { Tables } from '@/lib/db/schema';
import { makeTestContext } from '@/lib/db/test-database';

import { createMission, markMissionOpened, saveMissionCamera } from './commands';
import {
  findMission,
  getMissionCamera,
  observeMissionItemCount,
  observeMissionSummaries,
  suggestMissionName,
} from './repository';

describe('missions', () => {
  it('creates a mission stamped with the actor', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: ' Op Iron ' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mission = await findMission(ctx.db, r.value.id);
    expect(mission?.name).toBe('Op Iron');
    expect(mission?.createdBy).toBe('device-test');
  });

  it('rejects a blank name', async () => {
    const ctx = makeTestContext();
    expect(await createMission(ctx, { name: '   ' })).toMatchObject({ ok: false, error: 'invalid_name' });
  });

  it('returns null for an unknown mission', async () => {
    const ctx = makeTestContext();
    expect(await findMission(ctx.db, 'nope')).toBeNull();
  });

  it('orders summaries by last opened, never-opened last, then newest created', async () => {
    const ctx = makeTestContext();
    const a = await createMission(ctx, { name: 'A' });
    const b = await createMission(ctx, { name: 'B' });
    const c = await createMission(ctx, { name: 'C' });
    if (!a.ok || !b.ok || !c.ok) throw new Error('setup failed');
    await markMissionOpened(ctx, a.value.id);
    await markMissionOpened(ctx, b.value.id);
    await markMissionOpened(ctx, a.value.id);

    const list = await firstValueFrom(observeMissionSummaries(ctx.db));
    expect(list.map((m) => m.name)).toEqual(['A', 'B', 'C']);
    expect(list[2].lastOpenedAt).toBeNull();
  });

  it('keeps a single view-state row per mission', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    await markMissionOpened(ctx, r.value.id);
    await markMissionOpened(ctx, r.value.id);
    await saveMissionCamera(ctx, r.value.id, { center: { lat: 1, lon: 2 }, zoom: 12, bearing: 0 });
    const rows = await ctx.db
      .get<MissionViewState>(Tables.missionViewState)
      .query(Q.where('mission_id', r.value.id))
      .fetch();
    expect(rows).toHaveLength(1);
  });

  it('saves and restores the camera', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    expect(await getMissionCamera(ctx.db, r.value.id)).toBeNull();
    const camera = { center: { lat: 38.9, lon: -77 }, zoom: 13.5, bearing: 12 };
    expect(await saveMissionCamera(ctx, r.value.id, camera)).toEqual({ ok: true, value: undefined });
    expect(await getMissionCamera(ctx.db, r.value.id)).toEqual(camera);
  });

  it('rejects a non-finite camera', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    const bad = { center: { lat: Number.NaN, lon: 0 }, zoom: 1, bearing: 0 };
    expect(await saveMissionCamera(ctx, r.value.id, bad)).toMatchObject({ ok: false, error: 'invalid_camera' });
  });

  it('counts only that mission’s items', async () => {
    const ctx = makeTestContext();
    const a = await createMission(ctx, { name: 'A' });
    const b = await createMission(ctx, { name: 'B' });
    if (!a.ok || !b.ok) throw new Error('setup failed');
    await ctx.db.write(async () => {
      for (const missionId of [a.value.id, a.value.id, b.value.id]) {
        await ctx.db.get<MapItem>(Tables.mapItems).create((i) => {
          i.missionId = missionId;
          i.kind = 'point';
          i.geometry = '{"type":"Point","coordinates":[0,0]}';
          i.name = 'x';
          i.createdBy = 'd';
          i.updatedBy = 'd';
        });
      }
    });
    expect(await firstValueFrom(observeMissionItemCount(ctx.db, a.value.id))).toBe(2);
  });

  it('suggests the next mission name', async () => {
    const ctx = makeTestContext();
    expect(await suggestMissionName(ctx.db)).toBe('Mission 1');
    await createMission(ctx, { name: 'Whatever' });
    expect(await suggestMissionName(ctx.db)).toBe('Mission 2');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/missions`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the repository**

`src/features/missions/repository.ts`:

```ts
import { Q, type Database } from '@nozbe/watermelondb';
import { combineLatest, map, type Observable } from 'rxjs';

import type { MapItem } from '@/lib/db/models/MapItem';
import type { Mission } from '@/lib/db/models/Mission';
import type { MissionViewState } from '@/lib/db/models/MissionViewState';
import { Tables } from '@/lib/db/schema';
import type { LatLon } from '@/lib/geo/types';

export type MissionCamera = { center: LatLon; zoom: number; bearing: number };

export type MissionSummary = {
  id: string;
  name: string;
  createdAt: number;
  lastOpenedAt: number | null;
};

export function sortMissionSummaries(list: MissionSummary[]): MissionSummary[] {
  return [...list].sort((a, b) => {
    if (a.lastOpenedAt !== b.lastOpenedAt) {
      if (a.lastOpenedAt === null) return 1;
      if (b.lastOpenedAt === null) return -1;
      return b.lastOpenedAt - a.lastOpenedAt;
    }
    return b.createdAt - a.createdAt;
  });
}

export function observeMissionSummaries(db: Database): Observable<MissionSummary[]> {
  const missions$ = db.get<Mission>(Tables.missions).query().observeWithColumns(['name']);
  const states$ = db
    .get<MissionViewState>(Tables.missionViewState)
    .query()
    .observeWithColumns(['last_opened_at']);
  return combineLatest([missions$, states$]).pipe(
    map(([missions, states]) => {
      const opened = new Map(states.map((s) => [s.missionId, s.lastOpenedAt]));
      return sortMissionSummaries(
        missions.map((m) => ({
          id: m.id,
          name: m.name,
          createdAt: m.createdAt.getTime(),
          lastOpenedAt: opened.get(m.id) ?? null,
        })),
      );
    }),
  );
}

export function observeMissionItemCount(db: Database, missionId: string): Observable<number> {
  return db.get<MapItem>(Tables.mapItems).query(Q.where('mission_id', missionId)).observeCount();
}

export async function findMission(db: Database, id: string): Promise<Mission | null> {
  try {
    return await db.get<Mission>(Tables.missions).find(id);
  } catch {
    return null;
  }
}

export async function findMissionViewState(db: Database, missionId: string): Promise<MissionViewState | null> {
  const rows = await db
    .get<MissionViewState>(Tables.missionViewState)
    .query(Q.where('mission_id', missionId))
    .fetch();
  return rows[0] ?? null;
}

export function isValidCamera(value: unknown): value is MissionCamera {
  const c = value as MissionCamera | null;
  return (
    !!c &&
    typeof c === 'object' &&
    !!c.center &&
    [c.center.lat, c.center.lon, c.zoom, c.bearing].every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

export async function getMissionCamera(db: Database, missionId: string): Promise<MissionCamera | null> {
  const state = await findMissionViewState(db, missionId);
  if (!state?.camera) return null;
  try {
    const parsed: unknown = JSON.parse(state.camera);
    return isValidCamera(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function suggestMissionName(db: Database): Promise<string> {
  const count = await db.get<Mission>(Tables.missions).query().fetchCount();
  return `Mission ${count + 1}`;
}
```

- [ ] **Step 4: Implement the commands**

`src/features/missions/commands.ts`:

```ts
import type { CommandContext } from '@/lib/db/command-context';
import type { Mission } from '@/lib/db/models/Mission';
import type { MissionViewState } from '@/lib/db/models/MissionViewState';
import { Tables } from '@/lib/db/schema';
import { err, ok, type Result } from '@/lib/result';

import { findMissionViewState, isValidCamera, type MissionCamera } from './repository';

export async function createMission(
  ctx: CommandContext,
  input: { name: string },
): Promise<Result<{ id: string }, 'invalid_name' | 'write_failed'>> {
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Mission name is required');
  try {
    const mission = await ctx.db.write(() =>
      ctx.db.get<Mission>(Tables.missions).create((m) => {
        m.name = name;
        m.createdBy = ctx.actorId();
      }),
    );
    return ok({ id: mission.id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

async function upsertViewState(
  ctx: CommandContext,
  missionId: string,
  apply: (state: MissionViewState) => void,
): Promise<void> {
  await ctx.db.write(async () => {
    const existing = await findMissionViewState(ctx.db, missionId);
    if (existing) {
      await existing.update(apply);
    } else {
      await ctx.db.get<MissionViewState>(Tables.missionViewState).create((s) => {
        s.missionId = missionId;
        s.lastOpenedAt = ctx.now();
        s.camera = null;
        apply(s);
      });
    }
  });
}

export async function markMissionOpened(ctx: CommandContext, missionId: string): Promise<Result<void, 'write_failed'>> {
  try {
    await upsertViewState(ctx, missionId, (s) => {
      s.lastOpenedAt = ctx.now();
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function saveMissionCamera(
  ctx: CommandContext,
  missionId: string,
  camera: MissionCamera,
): Promise<Result<void, 'invalid_camera' | 'write_failed'>> {
  if (!isValidCamera(camera)) return err('invalid_camera', 'Camera values must be finite numbers');
  try {
    await upsertViewState(ctx, missionId, (s) => {
      s.camera = JSON.stringify(camera);
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npx jest src/features/missions && npx tsc --noEmit && npx expo lint`
Expected: PASS.

```bash
git add src/features/missions
git commit -m "feat: add missions repository and commands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Symbology presets and generated symbol images

**Files:**
- Create: `src/features/symbology/presets.ts`, `src/features/symbology/presets.test.ts`, `scripts/build-symbols.ts`, `src/features/symbology/symbol-images.generated.ts` (generated), `assets/symbols/*.png` (generated), `src/features/symbology/symbol-images.test.ts`
- Modify: `package.json` (script)

**Interfaces:**
- Consumes: `mapColors` (Task 9).
- Produces:
  - `type Affiliation = 'friend' | 'hostile' | 'neutral' | 'unknown'`, `AFFILIATIONS`
  - `type UnitType = 'unspecified' | 'infantry' | 'armor' | 'recon' | 'medical' | 'observer'`, `UNIT_TYPES: readonly { id: UnitType; label: string }[]`
  - `composeSidc(affiliation, unitType): string` (2525C, 15 chars)
  - `decomposeSidc(sidc): { affiliation: Affiliation; unitType: UnitType } | null`
  - `PRESET_SIDCS: readonly string[]` (24), `DEFAULT_SIDC`
  - `SYMBOL_IMAGES: Record<string, number>` (Metro asset ids keyed by SIDC; image name = SIDC)

- [ ] **Step 1: Write the failing tests**

`src/features/symbology/presets.test.ts`:

```ts
import { AFFILIATIONS, DEFAULT_SIDC, PRESET_SIDCS, UNIT_TYPES, composeSidc, decomposeSidc } from './presets';

describe('SIDC presets (MIL-STD-2525C)', () => {
  it.each([
    ['hostile', 'infantry', 'SHGPUCI--------'],
    ['friend', 'recon', 'SFGPUCR--------'],
    ['neutral', 'armor', 'SNGPUCA--------'],
    ['unknown', 'unspecified', 'SUGPU----------'],
    ['friend', 'medical', 'SFGPUSM--------'],
    ['hostile', 'observer', 'SHGPUCFO-------'],
  ] as const)('%s %s → %s', (affiliation, unitType, sidc) => {
    expect(composeSidc(affiliation, unitType)).toBe(sidc);
    expect(composeSidc(affiliation, unitType)).toHaveLength(15);
  });

  it('round-trips every preset', () => {
    for (const a of AFFILIATIONS) {
      for (const t of UNIT_TYPES) {
        expect(decomposeSidc(composeSidc(a, t.id))).toEqual({ affiliation: a, unitType: t.id });
      }
    }
  });

  it('returns null for unknown codes', () => {
    expect(decomposeSidc('SFGPEVAT-------')).toBeNull();
    expect(decomposeSidc('nope')).toBeNull();
  });

  it('lists 24 unique presets including the default', () => {
    expect(new Set(PRESET_SIDCS).size).toBe(24);
    expect(PRESET_SIDCS).toContain(DEFAULT_SIDC);
  });
});
```

`src/features/symbology/symbol-images.test.ts`:

```ts
import { PRESET_SIDCS } from './presets';
import { SYMBOL_IMAGES } from './symbol-images.generated';

describe('generated symbol images', () => {
  it('has an image for every preset SIDC', () => {
    expect(Object.keys(SYMBOL_IMAGES).sort()).toEqual([...PRESET_SIDCS].sort());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/symbology`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement presets**

`src/features/symbology/presets.ts`:

```ts
export type Affiliation = 'friend' | 'hostile' | 'neutral' | 'unknown';
export const AFFILIATIONS: readonly Affiliation[] = ['friend', 'hostile', 'neutral', 'unknown'];

export type UnitType = 'unspecified' | 'infantry' | 'armor' | 'recon' | 'medical' | 'observer';

/** MVP unit types with their 2525C ground-unit function IDs (6 chars). */
const UNIT_FUNCTIONS: Record<UnitType, { label: string; functionId: string }> = {
  unspecified: { label: 'Unspecified', functionId: 'U-----' },
  infantry: { label: 'Infantry', functionId: 'UCI---' },
  armor: { label: 'Armor', functionId: 'UCA---' },
  recon: { label: 'Reconnaissance', functionId: 'UCR---' },
  medical: { label: 'Medical', functionId: 'USM---' },
  observer: { label: 'Observer', functionId: 'UCFO--' },
};

export const UNIT_TYPES: readonly { id: UnitType; label: string }[] = (
  Object.keys(UNIT_FUNCTIONS) as UnitType[]
).map((id) => ({ id, label: UNIT_FUNCTIONS[id].label }));

const AFFILIATION_CODE: Record<Affiliation, string> = { friend: 'F', hostile: 'H', neutral: 'N', unknown: 'U' };

/** 2525C SIDC: scheme S, affiliation, dimension G (ground), status P, function ID, 5 modifier chars. */
export function composeSidc(affiliation: Affiliation, unitType: UnitType): string {
  return `S${AFFILIATION_CODE[affiliation]}GP${UNIT_FUNCTIONS[unitType].functionId}-----`;
}

export function decomposeSidc(sidc: string): { affiliation: Affiliation; unitType: UnitType } | null {
  for (const affiliation of AFFILIATIONS) {
    for (const unitType of Object.keys(UNIT_FUNCTIONS) as UnitType[]) {
      if (composeSidc(affiliation, unitType) === sidc) return { affiliation, unitType };
    }
  }
  return null;
}

export const PRESET_SIDCS: readonly string[] = AFFILIATIONS.flatMap((a) =>
  UNIT_TYPES.map((t) => composeSidc(a, t.id)),
);

export const DEFAULT_SIDC = composeSidc('unknown', 'unspecified');
```

- [ ] **Step 4: Write the build script**

```bash
npx expo install milsymbol @resvg/resvg-js tsx -- --save-dev
```

`scripts/build-symbols.ts`:

```ts
/**
 * Renders the preset SIDCs with milsymbol into @1x/@2x/@3x PNGs (fill colors from theme
 * tokens) and writes src/features/symbology/symbol-images.generated.ts.
 * Run: npm run build:symbols
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ms from 'milsymbol';

import { decomposeSidc, PRESET_SIDCS, type Affiliation } from '../src/features/symbology/presets';
import { mapColors } from '../src/theme/tokens';

const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets/symbols');
const MODULE = join(ROOT, 'src/features/symbology/symbol-images.generated.ts');
const SYMBOL_SIZE = 30; // milsymbol size ≈ frame height in px at @1x
const colors = mapColors('dark');
const fill: Record<Affiliation, string> = {
  friend: colors.friendly,
  hostile: colors.hostile,
  neutral: colors.neutral,
  unknown: colors.unknown,
};

mkdirSync(OUT_DIR, { recursive: true });

for (const sidc of PRESET_SIDCS) {
  const parts = decomposeSidc(sidc);
  if (!parts) throw new Error(`Unknown preset ${sidc}`);
  const svg = new ms.Symbol(sidc, { size: SYMBOL_SIZE, fillColor: fill[parts.affiliation] }).asSVG();
  for (const scale of [1, 2, 3]) {
    const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale } }).render().asPng();
    const suffix = scale === 1 ? '' : `@${scale}x`;
    writeFileSync(join(OUT_DIR, `${sidc}${suffix}.png`), png);
  }
}

const entries = PRESET_SIDCS.map((sidc) => `  '${sidc}': require('../../../assets/symbols/${sidc}.png'),`).join('\n');
writeFileSync(
  MODULE,
  `// GENERATED by scripts/build-symbols.ts — do not edit.\n` +
    `/* eslint-disable @typescript-eslint/no-require-imports */\n` +
    `export const SYMBOL_IMAGES: Record<string, number> = {\n${entries}\n};\n`,
);
console.log(`Wrote ${PRESET_SIDCS.length * 3} PNGs and ${MODULE}`);
```

In `package.json` `scripts` add: `"build:symbols": "tsx scripts/build-symbols.ts"`.

- [ ] **Step 5: Generate and check the images**

Run: `npm run build:symbols`
Expected: `Wrote 72 PNGs ...`. Open `assets/symbols/SHGPUCI--------@3x.png` and `assets/symbols/SFGPUCR--------@3x.png` and confirm: hostile = red diamond with crossed lines; friendly = light blue rectangle with recon slash.

- [ ] **Step 6: Run tests and commit**

Run: `npx jest src/features/symbology && npx tsc --noEmit && npx expo lint`
Expected: PASS.

```bash
git add -A
git commit -m "feat: add SIDC presets and generated milsymbol images

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Map items — geometry, auto-naming, repository, commands

**Files:**
- Create: `src/features/map-items/geometry.ts`, `src/features/map-items/naming.ts`, `src/features/map-items/repository.ts`, `src/features/map-items/commands.ts`, `src/features/map-items/geometry.test.ts`, `src/features/map-items/naming.test.ts`, `src/features/map-items/map-items.test.ts`

**Interfaces:**
- Consumes: `CommandContext`, `makeTestContext`, `MapItem`, `ItemViewState`, `Tables` (Task 11); `Affiliation` (Task 13); `LatLon`; `Result`.
- Produces:
  - `type PointGeometry = { type: 'Point'; coordinates: [number, number] }`
  - `isValidLatLon(p: LatLon): boolean`, `pointGeometry(p: LatLon): string`, `parsePointGeometry(json: string): PointGeometry | null`, `pointCoord(json: string): LatLon | null`
  - `NAME_PREFIX: Record<Affiliation, 'FRD' | 'HOS' | 'NEU' | 'UNK'>`, `nextAutoName(affiliation, existingNames: readonly string[]): string`
  - `type MapItemSnapshot = { id: string; kind: 'point'; geometry: string; sidc: string | null; name: string; notes: string | null; updatedAt: number }`
  - `observeMissionItems(db, missionId): Observable<MapItemSnapshot[]>`
  - `observeHiddenItemIds(db): Observable<string[]>`
  - `getMissionItemNames(db, missionId): Promise<string[]>`
  - `findItem(db, id): Promise<MapItem | null>`
  - `suggestPointName(db, missionId, affiliation): Promise<string>`
  - `type PlacePointInput = { missionId: string; coord: LatLon; sidc: string; name: string; notes?: string | null }`
  - `placePoint(ctx, input): Promise<Result<{ id: string }, 'invalid_coordinate' | 'invalid_name' | 'write_failed'>>`
  - `type UpdateItemPatch = { name?: string; notes?: string | null; sidc?: string; coord?: LatLon }`
  - `updateItem(ctx, id, patch): Promise<Result<void, 'not_found' | 'invalid_coordinate' | 'invalid_name' | 'write_failed'>>`
  - `deleteItem(ctx, id): Promise<Result<void, 'not_found' | 'write_failed'>>`
  - `toggleItemVisibility(ctx, id): Promise<Result<{ hidden: boolean }, 'write_failed'>>`

- [ ] **Step 1: Write the failing tests**

`src/features/map-items/geometry.test.ts`:

```ts
import { isValidLatLon, parsePointGeometry, pointCoord, pointGeometry } from './geometry';

describe('point geometry', () => {
  it('serializes as GeoJSON [lon, lat]', () => {
    expect(JSON.parse(pointGeometry({ lat: 38.9, lon: -77 }))).toEqual({ type: 'Point', coordinates: [-77, 38.9] });
  });

  it('round-trips', () => {
    expect(pointCoord(pointGeometry({ lat: 1.5, lon: 2.5 }))).toEqual({ lat: 1.5, lon: 2.5 });
  });

  it.each(['not json', '{"type":"LineString","coordinates":[]}', '{"type":"Point","coordinates":[1]}', '{"type":"Point","coordinates":["a","b"]}'])(
    'rejects %p',
    (json) => {
      expect(parsePointGeometry(json)).toBeNull();
      expect(pointCoord(json)).toBeNull();
    },
  );

  it.each([
    [{ lat: 0, lon: 0 }, true],
    [{ lat: 90, lon: 180 }, true],
    [{ lat: 90.1, lon: 0 }, false],
    [{ lat: 0, lon: -180.1 }, false],
    [{ lat: Number.NaN, lon: 0 }, false],
  ])('isValidLatLon(%p) → %p', (p, valid) => {
    expect(isValidLatLon(p)).toBe(valid);
  });
});
```

`src/features/map-items/naming.test.ts`:

```ts
import { nextAutoName } from './naming';

describe('nextAutoName', () => {
  it('starts at 1', () => {
    expect(nextAutoName('hostile', [])).toBe('HOS-1');
    expect(nextAutoName('friend', [])).toBe('FRD-1');
    expect(nextAutoName('neutral', [])).toBe('NEU-1');
    expect(nextAutoName('unknown', [])).toBe('UNK-1');
  });

  it('continues from the highest existing number for the prefix', () => {
    expect(nextAutoName('hostile', ['HOS-1', 'HOS-4', 'UNK-9'])).toBe('HOS-5');
  });

  it('ignores renamed points and unrelated names', () => {
    expect(nextAutoName('hostile', ['OBJ IRON', 'HOS-x', 'HOS-', 'HOS-2 ALT'])).toBe('HOS-1');
  });

  it('matches case-insensitively and tolerates whitespace and leading zeros', () => {
    expect(nextAutoName('hostile', ['hos-7', ' HOS-04 '])).toBe('HOS-8');
  });
});
```

`src/features/map-items/map-items.test.ts`:

```ts
import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';

import { deleteItem, placePoint, toggleItemVisibility, updateItem } from './commands';
import { pointCoord } from './geometry';
import { findItem, getMissionItemNames, observeHiddenItemIds, observeMissionItems, suggestPointName } from './repository';

const HOSTILE_INF = 'SHGPUCI--------';
const at = { lat: 38.8977, lon: -77.0365 };

describe('map items', () => {
  it('places a point stamped with the actor', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1', notes: 'dug in' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const item = await findItem(ctx.db, r.value.id);
    expect(item).not.toBeNull();
    expect(item?.kind).toBe('point');
    expect(item?.missionId).toBe('m1');
    expect(item?.createdBy).toBe('device-test');
    expect(item?.updatedBy).toBe('device-test');
    expect(item?.notes).toBe('dug in');
    expect(pointCoord(item!.geometry)).toEqual(at);
  });

  it.each([
    [{ lat: 91, lon: 0 }],
    [{ lat: Number.NaN, lon: 0 }],
  ])('rejects invalid coordinate %p', async (coord) => {
    const ctx = makeTestContext();
    expect(await placePoint(ctx, { missionId: 'm1', coord, sidc: HOSTILE_INF, name: 'x' })).toMatchObject({
      ok: false,
      error: 'invalid_coordinate',
    });
  });

  it('rejects a blank name', async () => {
    const ctx = makeTestContext();
    expect(await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: '  ' })).toMatchObject({
      ok: false,
      error: 'invalid_name',
    });
  });

  it('observes only the mission’s items', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    await placePoint(ctx, { missionId: 'm2', coord: at, sidc: HOSTILE_INF, name: 'B' });
    const items = await firstValueFrom(observeMissionItems(ctx.db, 'm1'));
    expect(items.map((i) => i.name)).toEqual(['A']);
    expect(items[0]).toMatchObject({ kind: 'point', sidc: HOSTILE_INF, notes: null });
    expect(typeof items[0].updatedAt).toBe('number');
  });

  it('updates fields and the editor stamp', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    const moved = { lat: 39, lon: -77 };
    expect(await updateItem(ctx, r.value.id, { name: 'OBJ IRON', coord: moved, notes: null })).toEqual({
      ok: true,
      value: undefined,
    });
    const item = await findItem(ctx.db, r.value.id);
    expect(item?.name).toBe('OBJ IRON');
    expect(pointCoord(item!.geometry)).toEqual(moved);
  });

  it('reports not_found for unknown ids', async () => {
    const ctx = makeTestContext();
    expect(await updateItem(ctx, 'nope', { name: 'x' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await deleteItem(ctx, 'nope')).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('deletes with a sync tombstone and drops it from queries', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    expect(await deleteItem(ctx, r.value.id)).toEqual({ ok: true, value: undefined });
    expect(await firstValueFrom(observeMissionItems(ctx.db, 'm1'))).toEqual([]);
    expect(await getMissionItemNames(ctx.db, 'm1')).toEqual([]);
  });

  it('toggles visibility as local view state', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'A' });
    if (!r.ok) throw new Error('setup failed');
    expect(await toggleItemVisibility(ctx, r.value.id)).toEqual({ ok: true, value: { hidden: true } });
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([r.value.id]);
    expect(await toggleItemVisibility(ctx, r.value.id)).toEqual({ ok: true, value: { hidden: false } });
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]);
  });

  it('suggests names from existing, non-deleted points', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-4' });
    const five = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-5' });
    if (!five.ok) throw new Error('setup failed');
    await deleteItem(ctx, five.value.id);
    await placePoint(ctx, { missionId: 'm2', coord: at, sidc: HOSTILE_INF, name: 'HOS-9' });
    expect(await suggestPointName(ctx.db, 'm1', 'hostile')).toBe('HOS-5');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/map-items`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement geometry and naming**

`src/features/map-items/geometry.ts`:

```ts
import type { LatLon } from '@/lib/geo/types';

export type PointGeometry = { type: 'Point'; coordinates: [number, number] };

export function isValidLatLon(p: LatLon): boolean {
  return (
    Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
  );
}

export function pointGeometry(p: LatLon): string {
  const geometry: PointGeometry = { type: 'Point', coordinates: [p.lon, p.lat] };
  return JSON.stringify(geometry);
}

export function parsePointGeometry(json: string): PointGeometry | null {
  try {
    const g = JSON.parse(json) as { type?: unknown; coordinates?: unknown };
    if (g.type !== 'Point' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return null;
    const [lon, lat] = g.coordinates;
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;
    return { type: 'Point', coordinates: [lon, lat] };
  } catch {
    return null;
  }
}

export function pointCoord(json: string): LatLon | null {
  const g = parsePointGeometry(json);
  return g ? { lat: g.coordinates[1], lon: g.coordinates[0] } : null;
}
```

`src/features/map-items/naming.ts`:

```ts
import type { Affiliation } from '@/features/symbology/presets';

export const NAME_PREFIX = { friend: 'FRD', hostile: 'HOS', neutral: 'NEU', unknown: 'UNK' } as const satisfies Record<
  Affiliation,
  string
>;

/** `<PREFIX>-<n>` where n is one more than the highest existing number for that prefix. */
export function nextAutoName(affiliation: Affiliation, existingNames: readonly string[]): string {
  const prefix = NAME_PREFIX[affiliation];
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let max = 0;
  for (const name of existingNames) {
    const m = pattern.exec(name.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${max + 1}`;
}
```

- [ ] **Step 4: Implement repository and commands**

`src/features/map-items/repository.ts`:

```ts
import { Q, type Database } from '@nozbe/watermelondb';
import { map, type Observable } from 'rxjs';

import type { Affiliation } from '@/features/symbology/presets';
import type { ItemViewState } from '@/lib/db/models/ItemViewState';
import type { MapItem } from '@/lib/db/models/MapItem';
import { Tables } from '@/lib/db/schema';

import { nextAutoName } from './naming';

export type MapItemSnapshot = {
  id: string;
  kind: 'point';
  geometry: string;
  sidc: string | null;
  name: string;
  notes: string | null;
  updatedAt: number;
};

function snapshot(item: MapItem): MapItemSnapshot {
  return {
    id: item.id,
    kind: item.kind,
    geometry: item.geometry,
    sidc: item.sidc,
    name: item.name,
    notes: item.notes ?? null,
    updatedAt: item.updatedAt.getTime(),
  };
}

function missionQuery(db: Database, missionId: string) {
  return db.get<MapItem>(Tables.mapItems).query(Q.where('mission_id', missionId));
}

export function observeMissionItems(db: Database, missionId: string): Observable<MapItemSnapshot[]> {
  return missionQuery(db, missionId)
    .observeWithColumns(['geometry', 'sidc', 'name', 'notes', 'updated_at'])
    .pipe(map((items) => items.map(snapshot)));
}

export function observeHiddenItemIds(db: Database): Observable<string[]> {
  return db
    .get<ItemViewState>(Tables.itemViewState)
    .query(Q.where('hidden', true))
    .observeWithColumns(['hidden'])
    .pipe(map((rows) => rows.map((r) => r.mapItemId)));
}

export async function getMissionItemNames(db: Database, missionId: string): Promise<string[]> {
  return (await missionQuery(db, missionId).fetch()).map((i) => i.name);
}

export async function findItem(db: Database, id: string): Promise<MapItem | null> {
  try {
    return await db.get<MapItem>(Tables.mapItems).find(id);
  } catch {
    return null;
  }
}

export async function findItemViewState(db: Database, mapItemId: string): Promise<ItemViewState | null> {
  const rows = await db.get<ItemViewState>(Tables.itemViewState).query(Q.where('map_item_id', mapItemId)).fetch();
  return rows[0] ?? null;
}

export async function suggestPointName(db: Database, missionId: string, affiliation: Affiliation): Promise<string> {
  return nextAutoName(affiliation, await getMissionItemNames(db, missionId));
}
```

`src/features/map-items/commands.ts`:

```ts
import type { CommandContext } from '@/lib/db/command-context';
import type { ItemViewState } from '@/lib/db/models/ItemViewState';
import type { MapItem } from '@/lib/db/models/MapItem';
import { Tables } from '@/lib/db/schema';
import type { LatLon } from '@/lib/geo/types';
import { err, ok, type Result } from '@/lib/result';

import { isValidLatLon, pointGeometry } from './geometry';
import { findItem, findItemViewState } from './repository';

export type PlacePointInput = {
  missionId: string;
  coord: LatLon;
  sidc: string;
  name: string;
  notes?: string | null;
};

export async function placePoint(
  ctx: CommandContext,
  input: PlacePointInput,
): Promise<Result<{ id: string }, 'invalid_coordinate' | 'invalid_name' | 'write_failed'>> {
  if (!isValidLatLon(input.coord)) return err('invalid_coordinate', 'Coordinate is out of range');
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Name is required');
  try {
    const item = await ctx.db.write(() =>
      ctx.db.get<MapItem>(Tables.mapItems).create((i) => {
        i.missionId = input.missionId;
        i.kind = 'point';
        i.geometry = pointGeometry(input.coord);
        i.sidc = input.sidc;
        i.name = name;
        i.notes = input.notes ?? null;
        i.style = null;
        i.createdBy = ctx.actorId();
        i.updatedBy = ctx.actorId();
      }),
    );
    return ok({ id: item.id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export type UpdateItemPatch = { name?: string; notes?: string | null; sidc?: string; coord?: LatLon };

export async function updateItem(
  ctx: CommandContext,
  id: string,
  patch: UpdateItemPatch,
): Promise<Result<void, 'not_found' | 'invalid_coordinate' | 'invalid_name' | 'write_failed'>> {
  if (patch.coord && !isValidLatLon(patch.coord)) return err('invalid_coordinate', 'Coordinate is out of range');
  if (patch.name !== undefined && !patch.name.trim()) return err('invalid_name', 'Name is required');
  const item = await findItem(ctx.db, id);
  if (!item) return err('not_found', `No item ${id}`);
  try {
    await ctx.db.write(() =>
      item.update((i) => {
        if (patch.name !== undefined) i.name = patch.name.trim();
        if (patch.notes !== undefined) i.notes = patch.notes;
        if (patch.sidc !== undefined) i.sidc = patch.sidc;
        if (patch.coord) i.geometry = pointGeometry(patch.coord);
        i.updatedBy = ctx.actorId();
      }),
    );
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function deleteItem(ctx: CommandContext, id: string): Promise<Result<void, 'not_found' | 'write_failed'>> {
  const item = await findItem(ctx.db, id);
  if (!item) return err('not_found', `No item ${id}`);
  try {
    await ctx.db.write(async () => {
      // Tombstone for sync; local-only view state is removed outright.
      await item.markAsDeleted();
      const view = await findItemViewState(ctx.db, id);
      if (view) await view.destroyPermanently();
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export async function toggleItemVisibility(
  ctx: CommandContext,
  id: string,
): Promise<Result<{ hidden: boolean }, 'write_failed'>> {
  try {
    const hidden = await ctx.db.write(async () => {
      const existing = await findItemViewState(ctx.db, id);
      if (existing) {
        const next = !existing.hidden;
        await existing.update((s) => {
          s.hidden = next;
        });
        return next;
      }
      await ctx.db.get<ItemViewState>(Tables.itemViewState).create((s) => {
        s.mapItemId = id;
        s.hidden = true;
      });
      return true;
    });
    return ok({ hidden });
  } catch (e) {
    return err('write_failed', String(e));
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npx jest src/features/map-items && npx tsc --noEmit && npx expo lint`
Expected: PASS.

```bash
git add src/features/map-items
git commit -m "feat: add map item commands, auto-naming and visibility

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Map item selectors (GeoJSON with per-item cache, hidden filter)

**Files:**
- Create: `src/features/map-items/selectors.ts`, `src/features/map-items/selectors.test.ts`

**Interfaces:**
- Consumes: `MapItemSnapshot` (Task 14), `parsePointGeometry`, `PointGeometry` (Task 14), `DEFAULT_SIDC` (Task 13).
- Produces:
  - `type PointFeature = { type: 'Feature'; id: string; geometry: PointGeometry; properties: { id: string; sidc: string; name: string } }`
  - `type PointFeatureCollection = { type: 'FeatureCollection'; features: PointFeature[] }`
  - `createPointFeatureSelector(): (items: readonly MapItemSnapshot[]) => PointFeatureCollection`
  - `hiddenFilter(hiddenIds: readonly string[]): unknown[]` — Mapbox filter expression

- [ ] **Step 1: Write the failing tests**

`src/features/map-items/selectors.test.ts`:

```ts
import { DEFAULT_SIDC } from '@/features/symbology/presets';

import type { MapItemSnapshot } from './repository';
import { createPointFeatureSelector, hiddenFilter } from './selectors';

function item(id: string, updatedAt: number, overrides: Partial<MapItemSnapshot> = {}): MapItemSnapshot {
  return {
    id,
    kind: 'point',
    geometry: '{"type":"Point","coordinates":[-77,38.9]}',
    sidc: 'SHGPUCI--------',
    name: id.toUpperCase(),
    notes: null,
    updatedAt,
    ...overrides,
  };
}

describe('createPointFeatureSelector', () => {
  it('builds a FeatureCollection with id, sidc and name properties', () => {
    const select = createPointFeatureSelector();
    const fc = select([item('a', 1)]);
    expect(fc).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'a',
          geometry: { type: 'Point', coordinates: [-77, 38.9] },
          properties: { id: 'a', sidc: 'SHGPUCI--------', name: 'A' },
        },
      ],
    });
  });

  it('reuses feature objects for unchanged items', () => {
    const select = createPointFeatureSelector();
    const first = select([item('a', 1), item('b', 1)]);
    const second = select([item('a', 1), item('b', 2, { name: 'B2' })]);
    expect(second.features[0]).toBe(first.features[0]);
    expect(second.features[1]).not.toBe(first.features[1]);
    expect(second.features[1].properties.name).toBe('B2');
  });

  it('drops cache entries for removed items', () => {
    const select = createPointFeatureSelector();
    const first = select([item('a', 1)]);
    select([]);
    const third = select([item('a', 1)]);
    expect(third.features[0]).not.toBe(first.features[0]);
  });

  it('falls back to the default SIDC and skips corrupt geometry', () => {
    const select = createPointFeatureSelector();
    const fc = select([item('a', 1, { sidc: null }), item('b', 1, { geometry: 'garbage' })]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties.sidc).toBe(DEFAULT_SIDC);
  });
});

describe('hiddenFilter', () => {
  it('excludes hidden ids by property', () => {
    expect(hiddenFilter(['a', 'b'])).toEqual(['!', ['in', ['get', 'id'], ['literal', ['a', 'b']]]]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/features/map-items/selectors`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/map-items/selectors.ts`:

```ts
import { DEFAULT_SIDC } from '@/features/symbology/presets';

import { parsePointGeometry, type PointGeometry } from './geometry';
import type { MapItemSnapshot } from './repository';

export type PointFeature = {
  type: 'Feature';
  id: string;
  geometry: PointGeometry;
  properties: { id: string; sidc: string; name: string };
};

export type PointFeatureCollection = { type: 'FeatureCollection'; features: PointFeature[] };

/**
 * Returns a selector that turns item snapshots into one FeatureCollection for a single
 * ShapeSource. Features are cached per id + updatedAt so unchanged items are not
 * re-parsed or re-allocated.
 */
export function createPointFeatureSelector(): (items: readonly MapItemSnapshot[]) => PointFeatureCollection {
  let cache = new Map<string, { updatedAt: number; feature: PointFeature }>();

  return (items) => {
    const next = new Map<string, { updatedAt: number; feature: PointFeature }>();
    const features: PointFeature[] = [];
    for (const item of items) {
      if (item.kind !== 'point') continue;
      const cached = cache.get(item.id);
      let feature = cached && cached.updatedAt === item.updatedAt ? cached.feature : null;
      if (!feature) {
        const geometry = parsePointGeometry(item.geometry);
        if (!geometry) continue;
        feature = {
          type: 'Feature',
          id: item.id,
          geometry,
          properties: { id: item.id, sidc: item.sidc ?? DEFAULT_SIDC, name: item.name },
        };
      }
      next.set(item.id, { updatedAt: item.updatedAt, feature });
      features.push(feature);
    }
    cache = next;
    return { type: 'FeatureCollection', features };
  };
}

/** Mapbox layer filter that hides items without rebuilding the source. */
export function hiddenFilter(hiddenIds: readonly string[]): unknown[] {
  return ['!', ['in', ['get', 'id'], ['literal', [...hiddenIds]]]];
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npx jest src/features/map-items && npx tsc --noEmit && npx expo lint`
Expected: PASS.

```bash
git add src/features/map-items
git commit -m "feat: add cached GeoJSON selector and hidden-item filter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: `data-layer` skill and repo overview

**Files:**
- Create: `.agents/skills/data-layer/SKILL.md`
- Modify: `.agents/rules/repo-overview.mdc`

**Interfaces:**
- Consumes: the conventions established in Tasks 11–15.

- [ ] **Step 1: Write the `data-layer` skill**

`.agents/skills/data-layer/SKILL.md`:

```markdown
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
   `destroyPermanently()`. Local-only rows may be destroyed.
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
```

- [ ] **Step 2: Update the repo overview rule**

Replace `.agents/rules/repo-overview.mdc` with:

```markdown
---
description: High-level overview of the repo — always on.
alwaysApply: true
---

# Repository overview

Tactical map app (Expo SDK 57, iOS + Android, offline-first). Architecture spec:
`docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md`; mockups:
`docs/design/mockups/`.

Source lives under `src/`, split by concern (`app/` routes, `features/`, `components/`,
`hooks/`, `stores/`, `lib/`, `config/`, `theme/`).

## Conventions

- Feature modules own their screens, repositories (reads) and commands (writes); shared UI
  stays in `components/`. Reach across features by deep import, not via a barrel.
- `lib/` never imports `features/`, `stores/`, `components/` or `app/` (lint enforced).
- Skills: `geo-library` (coordinates, bearings), `data-layer` (WatermelonDB, sync rules),
  `styling` (semantic tokens), `commits` (commit messages).
```

- [ ] **Step 3: Final verification**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add .agents
git commit -m "docs: add data-layer skill and architecture overview rule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
