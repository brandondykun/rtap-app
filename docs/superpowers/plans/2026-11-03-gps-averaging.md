# GPS Averaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An AVG toolbar toggle that averages GPS fixes while the user stays still and uses the result as "me" everywhere, with movement detection that pauses it and a Resume that checks you are back on the spot.

**Architecture:** Pure averaging and motion math in `src/features/location/` (unit-tested). A small zustand store (`src/stores/gps-average.ts`) holds the phase and samples. `useSelfLocation` routes each GPS fix through the store and publishes either the averaged position (marked `averaged`) or the live fix to the presence store, so every "me" consumer follows. A controller hook adds the accelerometer, background and source/permission rules. The readout, toolbar and a banner read the store.

**Tech Stack:** Expo SDK 57, RN 0.86, zustand, expo-location, expo-sensors (Accelerometer), NativeWind tokens, Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-11-03-gps-averaging-design.md`

## Global Constraints

- Amber is reserved for distances. Averaging's color is **orange-600 (`#ea580c`)**, a **state token named `averaged`**, not a value kind.
- Readout outline standard: readout text and icons are `OutlinedText` / outlined icons with the glass halo, no fill behind them.
- ME grid stays `friendly` (sky blue); ALT stays `value-altitude`; the ± number stays `value-accuracy`.
- Start message, every start, sticky with ×: **"Keep the device still. Averaging gets more accurate over a few minutes."**
- Paused banner: **"You moved — averaging paused"** with **Resume** and **Discard**. Away banner: **"You're not where you were averaging"** with **Start new average here** and **Turn off**.
- While paused or away, ME shows the live fix, plain. Discard / Turn off = Average mode off.
- Averaging is unavailable on the Manual source; switching to Manual turns it off.
- AVG is a toggle beside LABELS/3D (not an `activeTool`), lit (`active`) while on. Picking other tools never ends it. OP mode doesn't end it.
- No elapsed time shown. Map dot look unchanged.
- Builds older than f9afc5a have no expo-sensors native code: never crash, fall back to GPS-only movement detection.
- Foreground only (`watchPositionAsync` stops in the background). The screen is kept awake while averaging (`expo-keep-awake`, already in the build: a direct dependency since this plan, native fingerprint unchanged); locking the phone or leaving the app still pauses. Background location is a future, separate feature (location sharing while locked).
- New theme tokens: add to `tokens.ts` palette + theme, `semantic-token-names.json`; Metro needs `npx expo start -c`.
- Run `npx tsc --noEmit`, `npx expo lint`, and the touched tests before each commit. No commit attribution trailers.

## Review Focus

1. **App backgrounded while averaging** (phone locked on the OP): expect it paused on return, Resume doing the spot check. → Task 5 test `pauses when the app goes to the background`.
2. **Location turned off / permission revoked mid-average:** expect Average mode off, ME showing the location-off state, not a frozen average. → Task 4 test `turns averaging off when location goes off`.
3. **Every fix too poor to use (accuracy > 30 m, deep cover):** expect AVG lit but ME live and plain (no orange) until a usable sample arrives; never an averaged position from nothing. → Task 4 test `publishes the live fix until a usable sample is averaged`.
4. **Feet as the altitude unit:** expect "AVG ±7 ft". → Task 6 test `shows AVG before the accuracy in feet too`.
5. **Toggling AVG off while paused or away:** expect the banner gone and Average mode off. → Task 7 test `turns averaging off from the toolbar while paused`.

---

### Task 1: Averaging math

**Files:**
- Create: `src/features/location/gps-average-math.ts`
- Test: `src/features/location/gps-average-math.test.ts`

**Interfaces:**
- Produces:
  - `type AverageSample = { lat: number; lon: number; altitudeM: number | null; accuracyM: number; at: number }`
  - `MAX_SAMPLE_ACCURACY_M = 30`, `ACCURACY_FLOOR_M = 2`, `CORRELATION_S = 60`, `OUTLIER_FACTOR = 3`, `MOVED_FIXES = 3`, `MOVED_SPEED_MPS = 0.5`, `ON_SPOT_MIN_M = 10`
  - `sampleFromFix(fix: SelfPosition): AverageSample | null` — null when accuracy is null, non-finite or > `MAX_SAMPLE_ACCURACY_M`.
  - `weightedCenter(samples: readonly AverageSample[]): { position: LatLon; altitudeM: number | null } | null` — weights 1/accuracy²; lat/lon averaged in a local metric frame (equirectangular around the first sample is enough at these distances); altitude over samples that have one, else null.
  - `spreadM(samples): number` — weighted RMS distance of samples from the center (0 for one sample).
  - `estimateAccuracyM(samples): number` — `max(ACCURACY_FLOOR_M, pooled / sqrt(max(1, durationS / CORRELATION_S)), spreadM)`, where `pooled = 1 / sqrt(mean(1/accuracy²))` and `durationS` is last.at − first.at in seconds.
  - `isOutlier(samples, s: AverageSample): boolean` — only with ≥ 5 samples: distance from center > `OUTLIER_FACTOR * max(s.accuracyM, estimateAccuracyM(samples))`.
  - `isFarFromCluster(samples, s: AverageSample): boolean` — distance from center > `max(ON_SPOT_MIN_M, 2 * s.accuracyM, 2 * spreadM(samples))` (used for GPS movement and the spot check).
  - `isOnSpot(samples, live: AverageSample): boolean` — false when `live.accuracyM > MAX_SAMPLE_ACCURACY_M` or samples empty; else `!isFarFromCluster`.
  - `trimFrom(samples, cutoffAt: number): AverageSample[]` — keeps samples with `at < cutoffAt`.
  - Distances use the existing `inverse(a, b).distanceM` in `src/lib/geo/measure/geodesic.ts` (don't add a new one).

- [ ] **Step 1: Write the failing tests** — `gps-average-math.test.ts`:
  - `sampleFromFix rejects fixes with no accuracy or worse than 30 m` (null accuracy → null; 31 → null; 5 → sample with the fix's lat/lon/altitude/timestamp).
  - `weightedCenter leans toward the more accurate fixes` (two fixes 10 m apart, accuracies 2 and 8 → center within 1 m of the accurate one).
  - `estimateAccuracyM never goes below 2 m` (300 fixes at ±3 m over 10 min, all identical → 2).
  - `estimateAccuracyM shrinks with minutes, not fix count` (60 fixes at ±6 m over 1 min → ≈6; same accuracy over 4 min → ≈3).
  - `estimateAccuracyM is never tighter than the spread` (fixes ±3 m scattered ~8 m → ≥ 8 × 0.9).
  - `isOutlier ignores the first four samples, then rejects a fix far outside` (40 m jump at ±4 m → true; 2 m → false).
  - `isOnSpot is true back at the cluster, false 50 m away, false when the live fix is worse than 30 m`.
  - `trimFrom drops samples at and after the cutoff`.
- [ ] **Step 2:** `npx jest src/features/location/gps-average-math.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement the functions above.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(location): GPS averaging math`.

### Task 2: Motion detector and accelerometer loader

**Files:**
- Create: `src/features/location/motion.ts`
- Test: `src/features/location/motion.test.ts`
- Modify: `jest.setup.ts` (mock `expo-sensors`)

**Interfaces:**
- Produces:
  - `MOTION_WINDOW_MS = 1000`, `MOVING_STD_G = 0.06`, `STILL_STD_G = 0.03`, `MOVING_FOR_MS = 1500`, `ACCEL_INTERVAL_MS = 100`
  - `createMotionDetector(): { push(x: number, y: number, z: number, at: number): 'still' | 'moving' | null }` — magnitude √(x²+y²+z²) in g; std dev over the last `MOTION_WINDOW_MS`; returns `'moving'` once std > `MOVING_STD_G` has held for `MOVING_FOR_MS` (once per episode), `'still'` when std < `STILL_STD_G` (each time), else null. Constants are first guesses, tuned on device.
  - `type AccelerometerLike = { addListener(cb: (m: { x: number; y: number; z: number }) => void): { remove(): void }; setUpdateInterval(ms: number): void; isAvailableAsync(): Promise<boolean> }`
  - `loadAccelerometer(): AccelerometerLike | null` — `require('expo-sensors').Accelerometer` inside try/catch (a build without the native module throws at load): null on failure.

- [ ] **Step 1: Write the failing tests:**
  - `stays quiet for a phone held still` (1 g ± 0.01 noise for 5 s → never `'moving'`, reports `'still'`).
  - `reports moving once walking has lasted 1.5 s` (±0.2 g swings → `'moving'` between 1.5 s and 2.5 s, only once).
  - `a single bump is not movement` (one 0.5 g spike → never `'moving'`).
  - `loadAccelerometer returns null when expo-sensors can't load` (`jest.doMock('expo-sensors', () => { throw new Error('no native module'); })` with `jest.isolateModules`).
- [ ] **Step 2:** `npx jest src/features/location/motion.test.ts` → FAIL.
- [ ] **Step 3:** Implement; add a global `expo-sensors` mock in `jest.setup.ts` with an `Accelerometer` whose `addListener` stores the callback (exported for tests to drive), `setUpdateInterval: jest.fn()`, `isAvailableAsync: async () => true`.
- [ ] **Step 4:** Same command → PASS; `npx jest` (whole suite still green with the global mock).
- [ ] **Step 5:** Commit `feat(location): motion detector for GPS averaging`.

### Task 3: Average-mode store

**Files:**
- Create: `src/stores/gps-average.ts`
- Test: `src/stores/gps-average.test.ts`

**Interfaces:**
- Consumes: Task 1 functions and `AverageSample`.
- Produces:
  - `type AveragePhase = 'off' | 'averaging' | 'paused' | 'away'`
  - `DROP_BACK_MS = 15000`
  - `INITIAL_GPS_AVERAGE`, `useGpsAverage` with state `{ phase: AveragePhase; samples: AverageSample[]; lastStillAt: number | null; farSince: number | null; farCount: number }` and actions:
    - `start(): void` → phase `averaging`, samples cleared.
    - `stop(): void` → `INITIAL_GPS_AVERAGE`.
    - `addFix(fix: SelfPosition, speedMps: number | null): SelfPosition | null` — only while `averaging`. Returns the position to publish: the averaged `SelfPosition` (`position`, `altitudeM` from `weightedCenter`, `accuracyM` from `estimateAccuracyM`, `timestamp: fix.timestamp`, `averaged: true`) once ≥ 1 sample is accepted, else null (caller publishes the live fix). GPS movement: a fix `isFarFromCluster` or with `speedMps > MOVED_SPEED_MPS` bumps `farCount` (recording `farSince` on the first); `MOVED_FIXES` in a row → `pause(farSince)` and return null; any other fix resets `farCount`. Outliers (Task 1) are not added. Usable non-outlier fixes are appended.
    - `markStill(at: number): void` → `lastStillAt = at`.
    - `pause(detectedAt: number): void` — only from `averaging`: `cutoff = Math.min(detectedAt, lastStillAt ?? detectedAt - DROP_BACK_MS)`; samples = `trimFrom(samples, cutoff)`; phase `paused`.
    - `resume(live: SelfPosition | null): 'resumed' | 'away'` — from `paused`: `isOnSpot(samples, sampleFromFix(live))` (no live fix or unusable → away) → phase `averaging` or `away`.
    - `restartHere(): void` → like `start()`.
- [ ] **Step 1: Write the failing tests** (`gps-average.test.ts`, reset with `useGpsAverage.setState(INITIAL_GPS_AVERAGE)`):
  - `returns nothing to publish until a usable fix is averaged` (first fix ±40 m → null; then ±5 m → averaged with `averaged: true`).
  - `averages fixes and reports the conservative accuracy`.
  - `pauses after three fixes far from the cluster, dropping the readings from before it was noticed` (10 still fixes, then 3 at 60 m → phase `paused`, samples before `farSince − 15 s` only).
  - `uses the last still moment from the motion sensor as the cutoff when known`.
  - `resumes on the spot, and goes away when elsewhere or without a usable fix`.
  - `restartHere starts fresh; stop clears everything`.
  - `ignores fixes while paused or away` (`addFix` returns null, samples unchanged).
- [ ] **Step 2:** `npx jest src/stores/gps-average.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(location): Average mode store`.

### Task 4: Location pipeline publishes the average

**Files:**
- Modify: `src/stores/presence.ts` (`SelfPosition` gains `averaged?: boolean`)
- Modify: `src/features/location/use-self-location.ts`
- Test: `src/features/location/use-self-location.test.tsx`

**Interfaces:**
- Consumes: `useGpsAverage` (Task 3).
- Produces: `SelfPosition.averaged?: boolean` — set only on averaged positions. `watchOptions(averaging: boolean)` in `use-self-location.ts`: `{ accuracy: BestForNavigation, distanceInterval: averaging ? 0 : 1, timeInterval: 1000 }`.

- [ ] **Step 1: Write the failing tests** (in the existing test file's style, driving the mocked `watchPositionAsync` callback):
  - `publishes the averaged position while averaging, marked averaged`.
  - `publishes the live fix until a usable sample is averaged` (Review Focus 3).
  - `publishes the live fix, plain, while paused`.
  - `restarts the GPS watch with distanceInterval 0 while averaging, and 1 after`.
  - `turns averaging off when the source switches to Manual`.
  - `turns averaging off when location goes off` (status denied/unavailable) (Review Focus 2).
- [ ] **Step 2:** `npx jest src/features/location/use-self-location.test.tsx` → FAIL.
- [ ] **Step 3:** In `onPosition`, build the live `SelfPosition` as today; when `useGpsAverage.getState().phase === 'averaging'`, publish `addFix(live, loc.coords.speed ?? null) ?? live`, else `live`. Subscribe to `useGpsAverage` phase changes (averaging ↔ not) to restart the watch with `watchOptions`. Where the source switches to Manual and where location status becomes denied/unavailable, call `useGpsAverage.getState().stop()`.
- [ ] **Step 4:** → PASS; also `npx jest src/features/map` (consumers of `selfPosition` unaffected).
- [ ] **Step 5:** Commit `feat(location): publish the averaged position as me`.

### Task 5: Average controller (accelerometer, background, keep awake)

**Files:**
- Create: `src/features/location/use-average-watch.ts`
- Modify: `src/features/map/MissionMap.tsx` (call `useAverageWatch()` once)
- Test: `src/features/location/use-average-watch.test.tsx`

**Interfaces:**
- Consumes: Task 2 `createMotionDetector`, `loadAccelerometer`, `ACCEL_INTERVAL_MS`; Task 3 store.
- Produces: `useAverageWatch(): void` — while phase is `averaging`: subscribe the accelerometer (if `loadAccelerometer()` and `isAvailableAsync()`), feed `createMotionDetector`; `'still'` → `markStill(at)`; `'moving'` → `pause(at)` plus `Haptics.notificationAsync(Warning)`. Unsubscribe otherwise. `AppState` change to `background` while averaging → `pause(Date.now())`. Keep the screen awake while phase is `averaging` (`activateKeepAwakeAsync('gps-average')` / `deactivateKeepAwake('gps-average')` from `expo-keep-awake`, tag `'gps-average'`), released on paused, away and off. GPS-detected pauses (Task 3) also get the haptic: fire it on any phase change `averaging → paused`, not in the accelerometer path only.

- [ ] **Step 1: Write the failing tests** (`renderHook`, drive the `expo-sensors` mock from Task 2):
  - `pauses when the phone is carried, with a warning haptic`.
  - `does not listen to the accelerometer unless averaging`.
  - `pauses when the app goes to the background` (Review Focus 1).
  - `keeps working with GPS alone when the accelerometer can't load` (`loadAccelerometer` → null: no throw, store untouched).
  - `keeps the screen awake only while averaging` (mock `expo-keep-awake`: activated on start with tag `gps-average`, deactivated on pause and on stop).
- [ ] **Step 2:** `npx jest src/features/location/use-average-watch.test.tsx` → FAIL.
- [ ] **Step 3:** Implement; mount in `MissionMap` next to the other app-wide hooks.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(location): pause averaging on movement or leaving the app, screen kept awake`.

### Task 6: `averaged` color and the readout indicator

**Files:**
- Modify: `src/theme/tokens.ts` (palette `'orange-600': '#ea580c'`; theme `averaged: 'orange-600'` with a doc comment: Average mode's state color, reserved, not a value), `src/theme/semantic-token-names.json`
- Modify: `src/features/map/controls/ReadoutDock.tsx` (`SelfRow`)
- Modify: `AGENTS.md` (under Value colors: a line that orange `averaged` marks Average mode on the ME row and is reserved for it; never a value)
- Test: `src/features/map/controls/ReadoutDock.test.tsx`

**Interfaces:**
- Consumes: `SelfPosition.averaged` (Task 4).
- Produces: in `SelfRow`, when `shown.averaged`: `me-icon` and the `ME` tag use `colors.averaged`; the accuracy detail renders bold `AVG` in `colors.averaged` then ` ±N` in `value-accuracy`, accessibility label `Averaged accuracy ±N m`. Inline reserve template while averaged: `'AVG ±0000 m'` / `'AVG ±00000 ft'` (the landscape dock may widen by those characters only while averaging).

- [ ] **Step 1: Write the failing tests:**
  - `colors the ME icon and tag orange while averaged, keeping the grid friendly blue and ALT white`.
  - `shows AVG before the accuracy while averaged` (text `AVG`, `±2 m`; label `Averaged accuracy ±2 m`).
  - `shows AVG before the accuracy in feet too` (Review Focus 4).
  - `looks as before when not averaged` (no `AVG`, friendly tag).
  - `theme tokens` test still passes (orange-600 is a Tailwind color).
- [ ] **Step 2:** `npx jest src/features/map/controls/ReadoutDock.test.tsx src/theme` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(readout): orange ME and AVG accuracy while averaging`.

### Task 7: AVG toolbar toggle and start message

**Files:**
- Modify: `src/features/toolbar/Toolbar.tsx` (props `averageOn?: boolean`, `onAverage?: () => void`; tool `'avg'` placed after PLOT, before LABELS: `<ToolButton icon="crosshairs-gps" label="AVG" active={averageOn} toggled={averageOn} onPress={onAverage} />`)
- Modify: `src/features/toolbar/toolbar-help.ts` (`{ group: 'read', label: 'AVG', icon: 'crosshairs-gps', help: 'Average your GPS position while you stay still, for a steadier, more accurate ME. It pauses if you move.' }`, after MEASURE)
- Modify: `src/features/map/MissionMap.tsx` (wire `averageOn = phase !== 'off'`, `onAverage`)
- Test: `src/features/toolbar/Toolbar.test.tsx`, `src/features/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: `useGpsAverage` (Task 3), `useMyLocation` source, toast store `show(message, 'info', { sticky: true })`.
- Produces: `onAverage` behavior — off → if source is Manual: `notifyInfo('Averaging needs GPS. Switch your location to GPS first.')` and stay off; else `start()` and the sticky start toast (Global Constraints copy). On (any phase) → `stop()`.

- [ ] **Step 1: Write the failing tests:**
  - Toolbar: `shows AVG lit while averaging, between PLOT and LABELS`.
  - MapScreen: `starts averaging from AVG and shows the keep-still message, closable` (toast sticky with the exact copy).
  - MapScreen: `turns averaging off from the toolbar while paused` (Review Focus 5).
  - MapScreen: `does not average on the Manual source, and says why`.
  - MapScreen: `keeps averaging when another tool is picked` (press POINT → phase still `averaging`).
  - `toolbar-help` test (every toolbar button has help) passes with AVG.
- [ ] **Step 2:** `npx jest src/features/toolbar src/features/map/MapScreen.test.tsx` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(toolbar): AVG toggle starts GPS averaging`.

### Task 8: Paused and away banner

**Files:**
- Create: `src/features/location/AverageBanner.tsx`
- Modify: `src/features/map/controls/MapTopLeft.tsx` (render `AverageBanner` in the stack, above `LocationBanner`; shown even while a panel is open)
- Test: `src/features/location/AverageBanner.test.tsx`

**Interfaces:**
- Consumes: `useGpsAverage` (`phase`, `resume`, `restartHere`, `stop`), `usePresence.getState().selfPosition` for the live fix on Resume. Note: while paused the presence store holds the live fix (Task 4), so it is the right input to `resume`.
- Produces: `AverageBanner()` — null unless phase is `paused` or `away`. Paused: "You moved — averaging paused", buttons Resume (`resume(live)`) and Discard (`stop()`). Away: "You're not where you were averaging", buttons Start new average here (`restartHere()` plus the start toast) and Turn off (`stop()`). Style like `LocationBanner` (solid card, orange-600 `averaged` border, readable over the map); buttons use the existing compact menu button component.

- [ ] **Step 1: Write the failing tests:**
  - `shows nothing while averaging or off`.
  - `paused: Resume carries on when back on the spot`.
  - `paused: Resume elsewhere switches to the away message`.
  - `paused: Discard turns Average mode off`.
  - `away: Start new average here restarts, Turn off stops`.
- [ ] **Step 2:** `npx jest src/features/location/AverageBanner.test.tsx` → FAIL.
- [ ] **Step 3:** Implement; mount in `MapTopLeft`.
- [ ] **Step 4:** → PASS; then full `npx jest`, `npx tsc --noEmit`, `npx expo lint`.
- [ ] **Step 5:** Commit `feat(location): paused and away banner for GPS averaging`.

### After the tasks: on-device check (user)

On the new dev build: start AVG standing still for 3–5 min (ME orange, AVG ± shrinking to a floor of 2 m); hold the phone in hand (no pause); walk a few steps (pause within ~2 s, banner, live ME); Resume on the spot vs 50 m away; lock the phone and return (paused). Tune Task 2's motion constants if needed.
