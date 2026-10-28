# Manual Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user set their position by hand (typed MGRS or chosen on the map), switch between GPS and Manual
themselves, and be told clearly, once on the map and always in Settings, how to manage location.

**Architecture:**
- A new persisted store, `my-location`, holds the source (GPS / Manual), the manual position and whether the location-off
  notice was closed.
- `useSelfLocation` honours the source:
  - With **Manual**, it stops watching GPS and writes the manual position into the presence store's `selfPosition`,
    flagged `manual: true`. Every existing consumer of "me" then uses it unchanged: readouts, range lines, centering,
    recenter, OP staking.
  - Only the places that must mark a manual position read the flag: the self icon, the ME readout, the "from you" texts
    and the banner.
- A new in-memory store, `manual-entry`, drives the Set manually box and its "choose on map" mode. `MissionMap` wires
  that mode into its existing tap routing and bottom bar.

**Tech Stack:** Expo SDK 57, React Native, Zustand (+ `persist` over `expo-sqlite/kv-store`), `@rnmapbox/maps`,
NativeWind, Jest + React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-28-manual-location-design.md`

## Global Constraints

- No new dependencies and no native changes. New images go through `scripts/build-map-images.ts`, so this ships as an
  OTA update.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `test:`…). **No attribution trailers** (no `Co-Authored-By`).
- Run `npx expo lint` and `npx tsc --noEmit` before each commit; the full `npx jest` in the last task.
- Readout text and icons use the existing outline style (`OutlinedText` / `outline` props, no dark backing). Everything
  on the ME row stays friendly blue (`colors.friendly`).
- A CTR action uses `CenterButton` (crosshair glyph + CTR); crosshairs are `CrosshairGlyph`.
- Exact copy (use verbatim):
  - Banner: `Location is off, so your position and range are hidden. You can turn it on any time in Settings.`
  - ME row: `Location is off` / `Manual position not set` / `Tap to set your location` / `MANUAL`
  - Entry box:
    - title: `MY POSITION`;
    - buttons: `Choose on map` / `Adjust on map` / `Set`;
    - hints: `Type your grid, or choose your spot on the map.` / `Edit the grid, or adjust the spot on the map.`
  - Choosing bar hint: `Tap your position`
  - After Set from the map: `Position set by hand. You can change it any time in Settings → Location.`
  - CTR tag while manual: `FROM ME (MAN)`. Quick plot detail suffix: `from you (MAN)`.
  - Settings:
    - notice: `Location is off. Your GPS position is hidden until you turn it on.`, with link `Open Settings`;
    - group `Location`, section `Use my position from` (options `GPS` / `Manual`);
    - section `Manual position`, showing `Not set` or the grid, with buttons `Set` / `Change`.

## Review Focus

- Permission granted (in iOS Settings) while the source is Manual: stays Manual, GPS is not watched. Test in Task 2.
- A stored source of Manual with no position, after a restart: the ME row says `Manual position not set` and tapping it
  opens the box. Tests in Tasks 1 and 5.
- A corrupted stored manual position (NaN, out of range, wrong type): it's ignored, not drawn. Test in Task 1.
- A map tap while the box is open but not choosing: the keyboard closes, the box stays, nothing is saved. Test in Task 8.
- Opening any menu (toolbar tool, item tap, Settings) while choosing: choosing and the box end, and the bar is gone. Test
  in Task 8.

---

### Task 1: `my-location` store

**Files:**
- Create: `src/stores/my-location.ts`
- Test: `src/stores/my-location.test.ts`

**Interfaces:**
- Produces:
  - `type PositionSource = 'gps' | 'manual'`
  - `type MyLocationValues = { source: PositionSource; manual: LatLon | null; offNoticeClosed: boolean }`
  - `DEFAULT_MY_LOCATION: MyLocationValues = { source: 'gps', manual: null, offNoticeClosed: false }`
  - `useMyLocation`, a persisted Zustand store (name `'my-location'`, version 1) with these actions:
    - `setManual(at: LatLon): boolean`: invalid → false, no change; valid → `{ source: 'manual', manual: at }`.
    - `switchToGps(): void`: sets `{ source: 'gps', manual: null }`.
    - `switchToManual(): void`: sets `{ source: 'manual' }` and keeps `manual` as it is (null after `switchToGps`).
    - `closeOffNotice(): void`: sets `{ offNoticeClosed: true }`.

- [ ] **Step 1: Write the failing tests** (pattern: `src/stores/profile.test.ts`)

```ts
const stored = () => JSON.parse(Storage.getItemSync('my-location') ?? '{}').state;
beforeEach(() => useMyLocation.setState(DEFAULT_MY_LOCATION));

it('starts on GPS with no manual position and the notice not yet closed', () => {
  expect(useMyLocation.getState()).toMatchObject({ source: 'gps', manual: null, offNoticeClosed: false });
});
it('setting a position by hand switches to Manual and remembers it', () => {
  expect(useMyLocation.getState().setManual({ lat: 38.9, lon: -77 })).toBe(true);
  expect(stored()).toMatchObject({ source: 'manual', manual: { lat: 38.9, lon: -77 } });
});
it('rejects an impossible position and changes nothing', () => {
  expect(useMyLocation.getState().setManual({ lat: 91, lon: 0 })).toBe(false);
  expect(useMyLocation.getState().setManual({ lat: NaN, lon: 0 })).toBe(false);
  expect(useMyLocation.getState()).toMatchObject({ source: 'gps', manual: null });
});
it('switching to GPS clears the manual position; switching back starts unset', () => {
  useMyLocation.getState().setManual({ lat: 38.9, lon: -77 });
  useMyLocation.getState().switchToGps();
  expect(useMyLocation.getState()).toMatchObject({ source: 'gps', manual: null });
  useMyLocation.getState().switchToManual();
  expect(useMyLocation.getState()).toMatchObject({ source: 'manual', manual: null });
});
it('remembers that the location-off notice was closed', () => {
  useMyLocation.getState().closeOffNotice();
  expect(stored()).toMatchObject({ offNoticeClosed: true });
});
it('ignores stored values that are not valid', async () => {
  Storage.setItemSync('my-location', JSON.stringify({ state: { source: 'radio', manual: { lat: 'x', lon: 200 }, offNoticeClosed: 'yes' }, version: 1 }));
  await useMyLocation.persist.rehydrate();
  expect(useMyLocation.getState()).toMatchObject(DEFAULT_MY_LOCATION);
});
it('keeps a stored Manual source with no position (unset after a restart)', async () => {
  Storage.setItemSync('my-location', JSON.stringify({ state: { source: 'manual', manual: null, offNoticeClosed: false }, version: 1 }));
  await useMyLocation.persist.rehydrate();
  expect(useMyLocation.getState()).toMatchObject({ source: 'manual', manual: null });
});
```

- [ ] **Step 2: Run** `npx jest src/stores/my-location.test.ts`. Expected: FAIL, because the module can't be found.
- [ ] **Step 3: Implement `src/stores/my-location.ts`.** Mirror `profile.ts`: the same `syncStorage`, a `mergePersisted`
  that validates field by field (`source` is one of the two values; `manual` is null or a finite lat/lon within ±90/±180;
  `offNoticeClosed` is a boolean), and a `partialize` of the three values.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `git add src/stores/my-location.* && git commit -m "feat: store the position source and manual position"`

### Task 2: Location hook honours the source

**Files:**
- Modify: `src/stores/presence.ts`:
  - add `manual?: boolean` to `SelfPosition`;
  - add the action `clearSelfPosition(): void`.
- Modify: `src/features/location/use-self-location.ts`
- Test: `src/features/location/use-self-location.test.tsx` (add tests), `src/stores/presence.test.ts` (one test)

**Interfaces:**
- Consumes: `useMyLocation` (Task 1).
- Produces:
  - `usePresence().selfPosition` is `{ position, accuracyM: null, timestamp, altitudeM: null, manual: true }` while the
    source is Manual with a position, and `null` while Manual without one.
  - `selfHeading` is `null` while Manual.
  - `locationStatus` still means permission: `'granted' | 'denied' | 'unavailable' | 'unknown'`.

- [ ] **Step 1: Write the failing tests** (add `getForegroundPermissionsAsync` to the existing mocks; reset
  `useMyLocation` to `DEFAULT_MY_LOCATION` in `beforeEach`)

```ts
it('with Manual chosen, does not ask for or watch location, and publishes the manual position', async () => {
  useMyLocation.getState().setManual({ lat: 38.9, lon: -77 });
  mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false } as never);
  await render(<Probe />);
  expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
  expect(usePresence.getState().selfPosition).toMatchObject({ position: { lat: 38.9, lon: -77 }, accuracyM: null, altitudeM: null, manual: true });
  expect(usePresence.getState()).toMatchObject({ selfHeading: null, locationStatus: 'denied' });
});
it('stops GPS when switched to Manual, and starts it again when switched back', async () => {
  const fake = grant();
  await render(<Probe />);
  await act(async () => useMyLocation.getState().setManual({ lat: 1, lon: 2 }));
  expect(fake.removes.position).toHaveBeenCalled();
  expect(fake.removes.heading).toHaveBeenCalled();
  expect(usePresence.getState().selfPosition?.manual).toBe(true);
  await act(async () => fake.position({ coords: { latitude: 9, longitude: 9, accuracy: 3 }, timestamp: 5 }));
  expect(usePresence.getState().selfPosition?.position).toEqual({ lat: 1, lon: 2 });
  await act(async () => useMyLocation.getState().switchToGps());
  expect(mocked.watchPositionAsync).toHaveBeenCalledTimes(2);
  expect(usePresence.getState().selfPosition).toBeNull();
});
it('stays Manual when permission is granted later (no GPS watch)', async () => {
  useMyLocation.getState().setManual({ lat: 1, lon: 2 });
  mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
  await render(<Probe />);
  await act(async () => appStateListener('active'));
  expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
  expect(usePresence.getState()).toMatchObject({ locationStatus: 'granted', selfPosition: { manual: true } });
});
it('with Manual chosen but no position, publishes no position', async () => {
  useMyLocation.getState().switchToManual();
  mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true } as never);
  await render(<Probe />);
  expect(usePresence.getState().selfPosition).toBeNull();
});
```

(`appStateListener` is captured the way the existing "retries when the app returns to the foreground" test does.)
Presence test: `clearSelfPosition` sets `selfPosition` to null and leaves `locationStatus` alone.

- [ ] **Step 2: Run** `npx jest src/features/location/use-self-location.test.tsx src/stores/presence.test.ts`.
  Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - Split today's `start()` into two paths, chosen by `useMyLocation.getState().source`:
    - `startGps()`: unchanged behaviour. Before it publishes the first fix, it clears any manual position from presence.
    - `applyManual()`:
      - removes subscriptions;
      - sets the heading to null;
      - calls `getForegroundPermissionsAsync()` (it never prompts) to set `locationStatus` to `'granted'` or `'denied'`;
      - publishes the manual fix, or calls `clearSelfPosition()` when the manual position is null.
  - Subscribe to `useMyLocation` (`source` or `manual` changed) and re-run the right path. Unsubscribe in cleanup.
  - The AppState `'active'` handler runs the current path: in Manual it only re-checks permission.
- [ ] **Step 4: Run** the same command. Expected: PASS, including all the existing tests.
- [ ] **Step 5: Commit**: `feat: use the manual position as me and stop GPS while Manual is chosen`

### Task 3: Distinct self icon for a manual position

**Files:**
- Modify: `scripts/build-map-images.ts`: add `writeScaled('self-manual', svg(...))`. The SVG is a hollow ring:
  `<circle cx=C cy=C r=11 fill=colors['surface-input'] fill-opacity=0.6 stroke=colors.self stroke-width=3 stroke-dasharray="5 3"/>`
  plus a centre `<circle r=3 fill=colors.self/>`.
- Create (generated): `assets/map/self-manual.png`, `@2x`, `@3x` (run `npm run build:map-images`, then commit only the
  three new files. The rest must come out unchanged; check with `git status`).
- Modify: `src/features/map/images/map-images.ts`: add `selfManual: 'self-manual'` and its `require`.
- Modify: `src/features/map/layers/self-feature.ts`: `selfFeatureCollection(position, heading, manual = false)`. When
  manual, the icon is `MAP_IMAGE_IDS.selfManual` with heading 0. Widen `SelfIcon`.
- Modify: `src/features/map/layers/SelfLayer.tsx`: pass `usePresence((s) => s.selfPosition?.manual === true)`.
- Test: `self-feature.test.ts`, `map-images.test.ts` (add `self-manual` to the files-on-disk list), `SelfLayer.test.tsx`.

**Interfaces:** Produces `MAP_IMAGE_IDS.selfManual` and the new `selfFeatureCollection` parameter.

- [ ] **Step 1: Write the failing tests**

```ts
it('draws a manual position with its own icon and no heading, even if a heading is known', () => {
  const f = selfFeatureCollection({ lat: 1, lon: 2 }, 90, true).features[0];
  expect(f.properties).toEqual({ icon: MAP_IMAGE_IDS.selfManual, heading: 0 });
});
// SelfLayer.test: with setSelfPosition({ ..., manual: true }), the shape's icon is 'self-manual'.
```

- [ ] **Step 2: Run** `npx jest src/features/map/layers src/features/map/images`. Expected: FAIL.
- [ ] **Step 3: Implement** as listed under Files.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat: draw a manual position with its own self icon`

### Task 4: Mark ranges measured from a manual position

**Files:**
- Modify: `src/features/map/interaction/use-readout-origin.ts`: it returns `{ from, isOp, isManual }`, where
  `isManual = !isOp && selfPosition?.manual === true`.
- Modify: `src/features/map/controls/ReadoutDock.tsx` (`CenterRow`):
  - when `isManual`, show an `OutlinedText` tag `FROM ME (MAN)` (`testID="readout-from-manual"`) in the same slot and
    style as `FROM OP`;
  - the accessibility "who" becomes `you (manual position)`.
- Modify: `src/features/map/controls/CenterCard.tsx`: when `isManual`, append ` FROM ME (MAN)` to the DIST/DIR line
  (as ` FROM OP` is today). Same accessibility wording.
- Modify: `src/features/quick-plot/QuickPlotEntry.tsx`: the detail ends `from you (MAN)` when
  `selfPosition?.manual`, otherwise `from you`.
- Test: `ReadoutDock.test.tsx`, `CenterCard.test.tsx`, `QuickPlotEntry.test.tsx`, `use-readout-origin` (add a test file if
  none exists).

**Interfaces:** Consumes `SelfPosition.manual` (Task 2). Produces `useReadoutOrigin().isManual`.

- [ ] **Step 1: Write the failing tests**

```ts
// ReadoutDock.test
it('marks distance and bearing measured from a manual position', async () => {
  usePresence.getState().setSelfPosition({ position: DC, accuracyM: null, timestamp: 1, manual: true });
  await renderDock();
  expect(screen.getByTestId('readout-from-manual')).toHaveTextContent('FROM ME (MAN)');
  expect(screen.getByLabelText(/^Distance from you \(manual position\)/)).toBeTruthy();
});
// CenterCard.test: the DIST/DIR text ends with ' FROM ME (MAN)'. In OP mode it still ends ' FROM OP' (OP wins).
// QuickPlotEntry.test: with a manual position and a valid grid, the detail text ends 'from you (MAN)'.
```

- [ ] **Step 2: Run** `npx jest src/features/map/controls src/features/quick-plot src/features/map/interaction`.
  Expected: FAIL.
- [ ] **Step 3: Implement** as listed under Files.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat: mark ranges measured from a manual position`

### Task 5: ME readout states and "Tap to set your location"

**Files:**
- Modify: `src/features/map/controls/ReadoutDock.tsx` (`MeRow`), `src/features/map/controls/SelfCard.tsx`,
  `src/features/map/controls/MapControls.tsx` (pass-through)
- Test: `ReadoutDock.test.tsx`, `SelfCard.test.tsx`

**Interfaces:**
- Consumes: `useMyLocation().source` (Task 1), `SelfPosition.manual` (Task 2).
- Produces: a new required prop `onSetLocation: () => void` on `ReadoutDock`, `SelfCard` and `MapControls`.

**The states** (outside OP mode; OP mode is unchanged):

| When | First line | Second line | Tap |
|---|---|---|---|
| `fix?.manual` | the grid | no altitude; `MANUAL` (`testID="gps-manual"`) where the accuracy goes | recenter |
| GPS fix, location not off | unchanged | unchanged | unchanged |
| no fix, location off (`'denied'`/`'unavailable'`) | `Location is off` | `Tap to set your location` (`testID="set-location-hint"`, plain text) | `onSetLocation`, even while `disabled` |
| no fix, source Manual, location not off | `Manual position not set` | `Tap to set your location` | `onSetLocation`, even while `disabled` |
| otherwise | `Waiting for GPS…` | | unchanged |

In the two "Tap to set" states the accessibility label is `Set your location`.

- [ ] **Step 1: Write the failing tests** (in both test files)

```ts
it('with location off, offers to set the location by hand and opens it on tap', async () => {
  usePresence.getState().setLocationStatus('denied');
  const onSetLocation = jest.fn();
  await renderMe({ disabled: true, onSetLocation });
  expect(screen.getByText('Location is off')).toBeTruthy();
  expect(screen.getByTestId('set-location-hint')).toHaveTextContent('Tap to set your location');
  await fireEvent.press(screen.getByLabelText('Set your location'));
  expect(onSetLocation).toHaveBeenCalled();
});
it('says the manual position is not set when Manual is chosen without one', async () => {
  useMyLocation.getState().switchToManual();
  usePresence.getState().setLocationStatus('granted');
  await renderMe({ disabled: true, onSetLocation: jest.fn() });
  expect(screen.getByText('Manual position not set')).toBeTruthy();
});
it('shows a manual position with MANUAL and no altitude, and recenters on tap', async () => {
  usePresence.getState().setLocationStatus('denied');
  usePresence.getState().setSelfPosition({ position: DC, accuracyM: null, timestamp: 1, manual: true });
  const onRecenter = jest.fn();
  await renderMe({ disabled: false, onRecenter, onSetLocation: jest.fn() });
  expect(screen.getByTestId('gps-position')).toBeTruthy();
  expect(screen.getByTestId('gps-manual')).toHaveTextContent('MANUAL');
  expect(screen.queryByTestId('gps-altitude')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Recenter on me'));
  expect(onRecenter).toHaveBeenCalled();
});
```

Update the existing "says location is off when it is denied" tests to the new copy.

- [ ] **Step 2: Run** `npx jest src/features/map/controls`. Expected: FAIL.
- [ ] **Step 3: Implement** the table. Add `onSetLocation` to `MapControls` and pass it to both readouts. Until Task 8,
  `MissionMap` passes a no-op `() => {}`, so the type check stays green.
- [ ] **Step 4: Run** the same command plus `npx tsc --noEmit`. Expected: PASS, no errors.
- [ ] **Step 5: Commit**: `feat: let the ME readout open setting a location by hand`

### Task 6: One-time location-off notice

**Files:**
- Modify: `src/features/location/LocationBanner.tsx`
- Test: `src/features/location/LocationBanner.test.tsx`

**Interfaces:** Consumes `useMyLocation` (`offNoticeClosed`, `closeOffNotice`, `source`, `manual`).

Shows only while all of these hold:
- the status is `'denied'` or `'unavailable'`;
- `!offNoticeClosed`;
- not (`source === 'manual' && manual !== null`).

✕ calls `closeOffNotice()`. Drop the local `dismissed` state. The text uses the spec copy, and the Settings link is
unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
it('says location can be turned on in Settings, and stays closed for good once closed', async () => {
  usePresence.getState().setLocationStatus('denied');
  const first = await renderWithProviders(<LocationBanner />);
  expect(screen.getByText('Location is off, so your position and range are hidden. You can turn it on any time in Settings.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Dismiss'));
  expect(useMyLocation.getState().offNoticeClosed).toBe(true);
  first.unmount();
  await renderWithProviders(<LocationBanner />);
  expect(screen.queryByTestId('location-banner')).toBeNull();
});
it('hides while a manual position is set, without counting as closed', async () => {
  usePresence.getState().setLocationStatus('denied');
  useMyLocation.getState().setManual({ lat: 1, lon: 2 });
  await renderWithProviders(<LocationBanner />);
  expect(screen.queryByTestId('location-banner')).toBeNull();
  await act(async () => useMyLocation.getState().switchToGps());
  expect(screen.getByTestId('location-banner')).toBeTruthy();
});
```

- [ ] **Step 2: Run** `npx jest src/features/location/LocationBanner.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** as described above.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat: show the location-off notice once and hide it while a manual position is set`

### Task 7: Toast that stays until closed

**Files:**
- Modify: `src/stores/toast.ts`:
  - `show(message: string, kind?: ToastKind, opts?: { sticky?: boolean })`;
  - `ToastValue` gets `sticky: boolean`.
- Modify: `src/components/ui/Toast.tsx`. When sticky:
  - no auto-hide timer, and tapping the message does nothing;
  - a ✕ button (`accessibilityLabel="Dismiss"`) calls `hide(id)`.
- Test: `src/stores/toast.test.ts`, `src/components/ui/Toast.test.tsx` (create if missing)

- [ ] **Step 1: Write the failing test**

```ts
it('keeps a sticky toast until its close button is pressed', async () => {
  jest.useFakeTimers();
  await renderWithProviders(<Toast top={0} />);
  await act(async () => useToast.getState().show('Stay', 'info', { sticky: true }));
  await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS * 3));
  expect(screen.getByText('Stay')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Dismiss'));
  expect(screen.queryByText('Stay')).toBeNull();
});
```

- [ ] **Step 2: Run** `npx jest src/stores/toast.test.ts src/components/ui`. Expected: FAIL.
- [ ] **Step 3: Implement** as listed under Files. Existing callers are unchanged (sticky defaults to false).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat: add a toast that stays until it is closed`

### Task 8: Set manually box and choosing on the map

**Files:**
- Create: `src/stores/manual-entry.ts`
- Create: `src/features/location/ManualLocationEntry.tsx`
- Create: `src/features/map/layers/ManualPreviewLayer.tsx`
- Modify: `src/features/map/controls/PlaceBar.tsx`: optional `hint?: string` prop, default `'Tap map'`.
- Modify: `src/features/map/MissionMap.tsx`
- Test: `src/stores/manual-entry.test.ts`, `src/features/location/ManualLocationEntry.test.tsx`,
  `src/features/map/MapScreen.test.tsx` (new `describe('manual location')`)

**Interfaces:**
- Consumes:
  - `useMyLocation.setManual` (Task 1);
  - `useToast.show(…, 'info', { sticky: true })` (Task 7);
  - `onSetLocation` (Task 5).
- Produces:
  - `type ManualEntryPhase = 'closed' | 'entry' | 'choosing'`
  - `useManualEntry` (in memory), values
    `{ phase, origin: 'map' | 'settings', start: LatLon | null, chosen: LatLon | null, pending: LatLon | null }`,
    with `INITIAL_MANUAL_ENTRY` (`phase: 'closed'`, all null, `origin: 'map'`). Actions:
    - `open(origin: 'map' | 'settings', start: LatLon | null)`: goes to `'entry'`, with `chosen: null`.
    - `startChoosing()`: from `'entry'` to `'choosing'`.
    - `choose(at: LatLon)`: goes to `'entry'`, with `chosen: at`.
    - `cancelChoosing()`: from `'choosing'` back to `'entry'`; `chosen` is unchanged.
    - `setPending(at: LatLon | null)`
    - `close()`: back to the initial values.

Behaviour (spec, "Set manually box"):
- **The box** (`ManualLocationEntry`) is laid out like `QuickPlotEntry`, rendered while `phase === 'entry'`:
  - Fields start as `mgrsFieldsFor(chosen ?? start)` when either is set, otherwise `squareFieldsFor(cameraCenter)`. They
    remount (key) when `chosen` changes.
  - A valid grid calls `setPending(coord)`; anything else `setPending(null)`.
  - The button reads `Adjust on map` when `chosen ?? start` is set, otherwise `Choose on map`. Pressing it calls
    `startChoosing()`.
  - `Set` is disabled until the grid is valid. Pressing it:
    - calls `setManual(coord)`;
    - if `origin === 'map'`, shows the sticky info toast with the spec copy;
    - calls `close()`.
  - ✕ (`accessibilityLabel="Close"`) calls `close()`.
- **`ManualPreviewLayer`** draws `pending` with the `self-manual` icon while `phase === 'entry'`.
- **`MissionMap` wiring:**
  - `onSetLocation`: `useManualEntry.getState().open('map', null)`.
  - When `phase` goes from `'closed'` to `'entry'` (subscription), it closes the menu and quick plot, stops measuring and
    placing, and cancels OP picking, as `toggleQuickPlot` does.
  - The existing menu-opening subscription also calls `useManualEntry.getState().close()`.
  - While `phase === 'choosing'`:
    - the bar is `<PlaceBar hint="Tap your position" onAtCenter={() => choose(cameraCenter ?? WORLD_CAMERA.center)} onCancel={cancelChoosing} />`;
    - `barTakesReadoutSpot` and `barOverDock` treat it like `opPicking`.
  - `onMapPress`:
    - `'choosing'`: calls `choose(coord)` and returns, checked first, before OP picking;
    - `'entry'`: calls `Keyboard.dismiss()` and returns.
  - `onItemPress` while `'choosing'`: calls `choose(itemAt ?? at)` and returns.
  - Unmount: `close()`.

- [ ] **Step 1: Write the failing tests**

```ts
// manual-entry.test
it('opens, chooses on the map, comes back with the spot, and cancels without losing it', () => {
  const s = useManualEntry.getState;
  s().open('map', null); s().startChoosing(); expect(s().phase).toBe('choosing');
  s().choose({ lat: 1, lon: 2 }); expect(s()).toMatchObject({ phase: 'entry', chosen: { lat: 1, lon: 2 } });
  s().startChoosing(); s().cancelChoosing(); expect(s()).toMatchObject({ phase: 'entry', chosen: { lat: 1, lon: 2 } });
});

// ManualLocationEntry.test
it('reads Choose on map, then Adjust on map once a spot is chosen, with the grid filled in', …);
it('keeps Set disabled until the grid is valid', …);
it('Set from the map saves the position and shows the sticky message', async () => {
  // open('map', null); choose(DC) → press Set
  expect(useMyLocation.getState()).toMatchObject({ source: 'manual', manual: expect.objectContaining({ lat: expect.closeTo(DC.lat, 4) }) });
  expect(useToast.getState().toast).toMatchObject({ message: 'Position set by hand. You can change it any time in Settings → Location.', sticky: true });
  expect(useManualEntry.getState().phase).toBe('closed');
});
it('Set from Settings saves without the message', …);

// MapScreen.test, describe('manual location')
it('tapping the ME row with location off opens the box; Choose on map hides it until a map tap fills the grid', async () => {
  await openMap(); await act(async () => usePresence.getState().setLocationStatus('denied'));
  await fireEvent.press(screen.getByLabelText('Set your location'));
  expect(screen.getByText('MY POSITION')).toBeTruthy();
  await fireEvent.press(screen.getByText('Choose on map'));
  expect(screen.queryByText('MY POSITION')).toBeNull();
  expect(screen.getByText('Tap your position')).toBeTruthy();
  await mapPress(-77.1, 38.95);
  expect(screen.getByText('Adjust on map')).toBeTruthy();
});
it('CTR on the choosing bar chooses the crosshair', …); // press 'Add at center'
it('a map tap while the box is open (not choosing) keeps the box and saves nothing', async () => {
  // open box → mapPress → box still shown, useMyLocation.manual still null
});
it('opening a menu while choosing ends choosing and closes the box', async () => {
  // open → Choose on map → press toolbar 'Settings' (or openMenu) → no 'Tap your position', phase 'closed'
});
```

(`openMap` / `mapPress` are the existing helpers from the OP mode tests. Lift them to the file scope.)

- [ ] **Step 2: Run** `npx jest src/stores/manual-entry.test.ts src/features/location src/features/map/MapScreen.test.tsx -t "manual"`.
  Expected: FAIL.
- [ ] **Step 3: Implement** the store, the box, the preview layer, the `PlaceBar` hint and the `MissionMap` wiring above.
  Render `<ManualLocationEntry landscape={landscape} />` next to `QuickPlotEntry`, and `<ManualPreviewLayer />` next to
  `SelfLayer`.
- [ ] **Step 4: Run** the same command, then `npx jest src/features/map`. Expected: PASS, with no OP / quick plot
  regressions.
- [ ] **Step 5: Commit**: `feat: set your position by hand by typing a grid or choosing it on the map`

### Task 9: Location in Settings

**Files:**
- Modify: `src/components/menu/MenuSegmented.tsx`: `Option` gets `disabled?: boolean`. A disabled option is greyed
  (`opacity-40`), not pressable, and has `accessibilityState.disabled`.
- Create: `src/features/location/LocationSettings.tsx`. It exports:
  - `LocationOffNotice`: rendered while the status is `'denied'`/`'unavailable'`, with the spec copy and `Open Settings`
    (calls `Linking.openSettings()`), in danger styling as in the mockup;
  - `LocationSettingsGroup`: `MenuGroup title="Location"`, containing:
    - `MenuSection label="Use my position from"` with
      `MenuSegmented<PositionSource>` (`GPS` disabled while location is off; changing calls `switchToGps()` /
      `switchToManual()`);
    - only while `source === 'manual'`, `MenuSection label="Manual position"`, showing the formatted grid
      (`formatCoordinate(manual, coordinateFormat)`) or `Not set`, and a `MenuButton` labelled `Change` / `Set`. The
      button calls `useMenu.getState().closeMenu()` and then `useManualEntry.getState().open('settings', manual)`.
- Modify: `src/features/menus/menus/SettingsMenu.tsx`: render `<LocationOffNotice />` and then `<LocationSettingsGroup />`
  right after `MenuHeader`, before Profile.
- Test: `src/features/location/LocationSettings.test.tsx`, `MenuSegmented` test, `SettingsMenu.test.tsx` (the first
  section is now `Use my position from`; update the existing first-section assertion)

**Interfaces:** Consumes `useMyLocation` (Task 1), `useManualEntry.open` (Task 8), `usePresence().locationStatus`.

- [ ] **Step 1: Write the failing tests**

```ts
it('with location off, shows the notice first, with Open Settings, and GPS greyed out', async () => {
  usePresence.getState().setLocationStatus('denied');
  await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
  expect(screen.getByText('Location is off. Your GPS position is hidden until you turn it on.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Open Settings'));
  expect(Linking.openSettings).toHaveBeenCalled();
  expect(screen.getByLabelText('GPS').props.accessibilityState).toMatchObject({ disabled: true });
});
it('shows the manual position only while Manual is chosen; switching to GPS clears it', async () => {
  await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
  expect(screen.queryByTestId('menu-section-Manual position')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Manual'));
  expect(screen.getByText('Not set')).toBeTruthy();
  await act(async () => useMyLocation.getState().setManual(DC));
  expect(screen.getByText('Change')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('GPS'));
  expect(useMyLocation.getState().manual).toBeNull();
  expect(screen.queryByTestId('menu-section-Manual position')).toBeNull();
});
it('Change closes Settings and opens the box with the saved position', async () => {
  useMyLocation.getState().setManual(DC);
  // … press 'Change'
  expect(useMenu.getState().stack).toHaveLength(0);
  expect(useManualEntry.getState()).toMatchObject({ phase: 'entry', origin: 'settings', start: DC });
});
```

- [ ] **Step 2: Run** `npx jest src/features/location src/components/menu src/features/menus`. Expected: FAIL.
- [ ] **Step 3: Implement** as listed under Files.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat: add Location to Settings with the GPS / Manual switch and location-off notice`

### Task 10: Full verification

- [ ] **Step 1:** Run `npx tsc --noEmit && npx expo lint`. Expected: both exit 0.
- [ ] **Step 2:** Run `npx jest`. Expected: every suite passes. A known flaky test (`SettingsMenu`, `AddPointMenu`,
  `AddUnitMenu`, `MapScreen` under full load) must pass when its file is run alone, and the failure must be reported
  either way.
- [ ] **Step 3:** Run `APP_VARIANT=preview npx expo-updates runtimeversion:resolve --platform ios`. Expected: the
  fingerprint is unchanged from before Task 1, which confirms the change can ship as an OTA update.
- [ ] **Step 4:** Device checks for the user to run on RTAP (D):
  - deny location;
  - the notice shows once, and closing it hides it for good;
  - "Tap to set your location", Choose on map, tap, Adjust on map, Set; the sticky message appears and closes with ✕;
  - the ME row shows MANUAL, the self icon is a dashed ring, and the CTR readout shows FROM ME (MAN);
  - Settings shows the red notice, the Location group, and GPS greyed out;
  - grant permission: the app stays Manual, and the iOS location indicator stays off;
  - switching to GPS clears the manual position and GPS fixes return.
