# Tactical Map — Architecture Design

**Date:** 2026-10-12
**Status:** Draft — awaiting review

## 1. Purpose and scope

A cross-platform (iOS + Android) interactive tactical map, in the spirit of ATAK, for
training and military-simulation enthusiasts. Not intended for military use.

**Product tiers**
- **Free (MVP track):** solo use, fully local, no account.
- **Paid (post-MVP):** collaborative missions — shared map items and live member locations.

**MVP scope**
- Missions screen (app entry): lists the user's missions/maps, creates a new one, and opens
  one in the map. The map is always entered with a mission selected.
- Map screen for the selected mission, usable in portrait and landscape.
- User's own location with a heading-aware icon.
- Always-visible center crosshair with the MGRS coordinate of the crosshair.
- Range and bearing from the user to the crosshair, in the chosen unit and north reference.
- Top toolbar with: symbol selection, drop point, grid/magnetic toggle, app menu.
- Add a point (crosshair "drop" or long-press) → saved to WatermelonDB → rendered on the map.
- Select a point → properties menu (name, symbol, MGRS, range/bearing, hide, delete).
- Toggle visibility of any map item.
- App menu with settings (coordinate format, angle unit, north reference, theme)
  and "Switch mission" (returns to the missions screen).

**Explicitly out of MVP (architecture must accommodate)**
- Offline tile download UI (service layer is built; no UI).
- Lines, polygons, and other map item kinds.
- Remote sync, authentication, paid tier, live teammate locations.
- Runtime rasterization of arbitrary SIDCs.
- Web. `@rnmapbox/maps` is native-only; template web files are removed.

**Platform baseline:** Expo SDK 57, React Native 0.86 (New Architecture), React 19.2,
React Compiler enabled, Expo Router. Requires a development build (`expo-dev-client`);
Expo Go is not supported because Mapbox and WatermelonDB ship native code.

## 2. Guiding principles

1. **The map is the product.** Panning, zooming, and placing items must stay smooth with
   thousands of items. Every architectural choice is checked against map performance.
2. **Workflow speed.** The common action (drop a point) is one tap and never waits on a form.
3. **Offline-first, sync-ready.** All data is local; schema and write paths are shaped for a
   future WatermelonDB sync without migration of existing data.
4. **Clear boundaries.** Small units with one purpose; boundaries enforced by lint.
5. **One source of truth** for geo math, styling tokens, and menus.

## 3. Chosen approach: reactive geo-layer pipeline

```
WatermelonDB ──observe──▶ repository ──▶ selector (memoized GeoJSON FeatureCollection)
                                                     │
                                                     ▼
                         Mapbox ShapeSource + SymbolLayer (native, GPU rendered)
                                                     ▲
UI (toolbar, menus, gestures) ──▶ commands ──▶ repository ──▶ WatermelonDB
```

- The map never renders one React component per item.
- All writes go through **commands**, the single place sync metadata is stamped.
- Interaction state (selected symbol, selection, follow mode, menu stack) lives in small
  Zustand stores, separate from the database.
- Transient high-frequency data (own and future teammate locations) never goes through
  WatermelonDB.

Rejected alternatives:
- *Per-item `PointAnnotation`/`MarkerView` components* — degrades at a few hundred items.
- *Event-sourced op log* — strong for merging but premature and conflicts with
  WatermelonDB's built-in sync protocol. Can be added beside the current model later.

## 4. Module layout and dependency rules

```
src/
  app/                       # routes only, thin
    _layout.tsx              # providers: Database, GestureHandler, SafeArea, Theme; Stack
    index.tsx                # → <MissionsScreen/>
    missions/
      new.tsx                # → <CreateMissionScreen/> (form sheet)
      [missionId].tsx        # → <MapScreen missionId/>
  features/
    missions/
      MissionsScreen.tsx     # list + empty state + create CTA
      CreateMissionScreen.tsx
      model.ts               # Mission model
      view-state-model.ts    # MissionViewState model (local only)
      repository.ts          # observe list (with item counts), get, create
      commands.ts            # createMission, markMissionOpened, saveMissionCamera
    map/
      MapScreen.tsx
      canvas/                # MapCanvas, camera controller, style constants
      layers/                # PointsLayer, SelfLayer (later TeamLayer, LinesLayer, …)
      interaction/           # crosshair, readout, long-press, selection
      offline/               # TilePackService interface + Mapbox implementation
    map-items/
      model.ts               # MapItem Watermelon model
      view-state-model.ts    # ItemViewState Watermelon model (local only)
      repository.ts          # observe / query / create / update / delete
      commands.ts            # placePoint, updateItem, deleteItem, toggleItemVisibility
      selectors.ts           # records → GeoJSON FeatureCollection (cached)
      presets.ts             # MVP SIDC palette
    toolbar/                 # top toolbar UI
    location/                # self position + heading stream
    symbology/               # SIDC → Mapbox image registry
    menus/                   # registry, MenuHost, menu definitions
  components/
    ui/                      # shared primitives (buttons, icons)
    menu/                    # menu primitives (Section 11)
  lib/
    geo/                     # pure TypeScript geospatial library (Section 6)
    db/                      # schema, migrations, adapter, id generator, sync config
    identity/                # deviceId now; userId later
  stores/                    # Zustand: interaction, settings, presence, menu
  theme/                     # tokens, themes, mapColors (Section 10)
  config/                    # env access (Mapbox token), constants
```

**Dependency rules (ESLint `no-restricted-imports`):**
1. `lib/*` never imports `features/`, `stores/`, `components/`, or `app/`.
2. `lib/geo` imports nothing from `react` or `react-native`.
3. Only `features/*/repository.ts` and `features/*/commands.ts` import WatermelonDB query/write
   APIs. UI reads through hooks built on repository observables.
4. Only `features/map/**` imports `@rnmapbox/maps`.
5. Only `lib/geo/**` imports `mgrs`, `geographiclib-geodesic`, `geomagnetism`, or other
   geodesy libraries.
6. `app/` routes only compose features.
7. Cross-feature imports are deep imports, not barrels (existing repo convention).

## 5. Data model

### 5.1 Tables (schema v1)

```
missions                         # future sharing / collaboration unit
  name          string
  created_by    string
  created_at    number
  updated_at    number

map_items                        # synced (future)
  mission_id    string   indexed
  kind          string   indexed     # 'point' (MVP); 'line' | 'polygon' later
  geometry      string               # GeoJSON geometry JSON, WGS84 [lon, lat(, alt)]
  sidc          string?              # milsymbol SIDC (points)
  name          string
  notes         string?
  style         string?              # JSON, for lines/polygons later
  created_by    string
  updated_by    string
  created_at    number
  updated_at    number

item_view_state                  # LOCAL ONLY — never synced
  map_item_id   string   indexed
  hidden        boolean
  updated_at    number

mission_view_state               # LOCAL ONLY — never synced
  mission_id      string   indexed
  last_opened_at  number             # sorts the missions list
  camera          string?            # JSON { center, zoom, bearing } to restore on open
  updated_at      number
```

### 5.2 Sync-readiness rules
- **IDs:** UUIDv4 generated client-side via WatermelonDB `setGenerator` + `expo-crypto`.
- **Deletes:** `markAsDeleted()` (WatermelonDB sync tombstone). `_status` / `_changed` are
  managed by WatermelonDB.
- **Authorship:** every command stamps `created_by` / `updated_by` from `lib/identity`
  (persistent `deviceId` now, `userId` once accounts exist).
- **Scoping:** every map item belongs to a mission. The user creates or selects a mission on
  the missions screen before entering the map; the active mission is the `missionId` route
  param, passed explicitly to repositories and commands (no global "active mission" store).
- **Local-only tables** are listed in one place (`lib/db/sync-config.ts`) and excluded from
  the future sync push/pull.
- **Migrations:** `schemaMigrations` from v1; released migrations are never edited.

### 5.3 Visibility
Visibility is per-device view state, not item data, so hiding a shared item never hides it
for other users. A row exists in `item_view_state` only for items whose view state was
changed; absence means visible. A future `layer_view_state` table (hide by affiliation,
author, etc.) follows the same pattern.

### 5.4 Missions
- A mission is the user's named map: the container for map items and, in the paid tier,
  the unit that is shared with other users.
- "Last opened" and "last camera" are per-device view state (`mission_view_state`), not
  mission data, for the same reason as item visibility.
- MVP mission operations: list, create (name), open. Rename and delete are small later
  additions through the same repository/commands.

### 5.5 Data kept outside WatermelonDB
- **Presence** (own location now, teammates later): in-memory Zustand store; later fed by
  a realtime channel. Breadcrumb trails may become a table later.
- **Settings** (coordinate format, angle unit, north reference, declination
  override, theme): Zustand persisted to `expo-sqlite/kv-store`. Per-device, never synced.

## 6. Geospatial library (`lib/geo`)

**Canonical forms:** positions are WGS84 `{ lat, lon }` in decimal degrees; bearings are
**true north, decimal degrees**. Conversion to grid/magnetic, mils, and formatted strings
happens only at the edges.

```
lib/geo/
  types.ts             # LatLon, NorthRef ('true'|'grid'|'magnetic'), AngleUnit ('deg'|'mil'),
                       # Result<T>
  coords/mgrs.ts       # toMgrs(p, precision), parseMgrs(str): Result<LatLon>
  coords/utm.ts        # toUtm(p)
  measure/geodesic.ts  # inverse(a, b) → { distanceM, azimuthTrue }; destination(p, az, d)
  north/grid.ts        # gridConvergence(p)
  north/magnetic.ts    # declination(p, date) — wraps `geomagnetism`
  north/convert.ts     # fromTrue(azTrue, ref, p, ctx) / toTrue(az, ref, p, ctx)
  units/angle.ts       # degToMils(deg) / milsToDeg(mils) — NATO 6400 mils per circle
  format/mgrs.ts       # "18S UJ 23480 06470"
  format/bearing.ts    # "1234 mils MAG" / "069° GRID"
  format/distance.ts   # m / km
  vector.ts            # describeVector(from, to, opts) → { distanceM, bearing, unit, ref }
```

- **Libraries:** `geomagnetism` (magnetic declination), `mgrs` (MGRS/UTM),
  `geographiclib-geodesic` (distance and azimuth). Others may be added, always wrapped.
- **North reference:** grid ↔ magnetic is a first-class one-tap toggle in the toolbar
  (`settings.northRef`). True north is available in settings. Readouts display the current
  G-M angle.
- **Declination:** computed offline with the date injected (deterministic tests). Settings
  allow a manual declination override.
- **Mils:** NATO 6400 mils per circle only (`MILS_PER_CIRCLE = 6400`); no other mil systems.
- **`describeVector`** is the only function UI uses for range/bearing, so the crosshair
  readout, item details, and future measuring tools always agree.
- **Errors:** invalid input returns a typed `Result` error (e.g. unparseable MGRS, positions
  outside MGRS coverage). Never silent `NaN`.
- All functions are pure and synchronous, cheap enough to call per camera frame.

## 7. Screens and navigation

```
/                        MissionsScreen    list of missions → tap opens map
/missions/new            CreateMissionScreen (form sheet) → creates, then replaces into map
/missions/[missionId]    MapScreen
```

- **Missions screen:** missions sorted by `last_opened_at` (then `created_at`), each row
  showing name, item count, and last opened. Empty state with a "Create mission" call to
  action. Standard virtualized list; this screen has no map.
- **Create mission:** name field (prefilled, e.g. "Mission 1"); on create, navigates
  (replace) straight into the new mission's map.
- **Opening a mission:** `markMissionOpened` is called; the map restores the saved camera
  if present, otherwise centers on the user's location (or a world view without a fix).
- **Leaving the map:** camera is saved (`saveMissionCamera`) when the screen blurs and on a
  debounced idle after camera moves. "Switch mission" in the app menu navigates back.
- **iOS swipe-back is disabled on the map screen** (`gestureEnabled: false`) so edge pans
  are never stolen from the map.
- An invalid or deleted `missionId` redirects to `/`.

## 8. Map engine and interaction (`features/map`)

### 8.1 Rendering
- `MapCanvas` = `MapView` + `Camera` + layers.
- **The camera is uncontrolled.** The native map owns center/zoom/bearing. Programmatic
  moves (recenter, fly to item, follow) use imperative `cameraRef` calls. No camera values
  are held in React state that drives the map.
- `PointsLayer`: one `ShapeSource` + `SymbolLayer`; `iconImage: ['get', 'sidc']`,
  labels via `textField`, hidden items excluded by a `filter` expression
  (`['!', ['in', ['get', 'id'], ['literal', hiddenIds]]]`). Item taps use the source's
  `onPress`.
- The selector caches serialized features by `id + updatedAt`; only changed records are
  re-serialized.
- Layer style objects are module-level constants (or memoized per theme).
- The map never remounts on orientation change.

### 8.2 Symbology (`features/symbology`)
- **MVP:** a build-time Node script renders the preset SIDCs with `milsymbol` into
  `@2x`/`@3x` PNGs under `assets/symbols/`, registered via rnmapbox `<Images>`.
- **Later:** runtime rasterization (Skia) for arbitrary SIDCs, cached on disk by SIDC.
- Both sit behind `getSymbolImage(sidc)`; layers do not change.

### 8.3 Self and teammate icons
- **Self:** rnmapbox `LocationPuck` with `puckBearing="heading"` and a custom user/chevron
  icon (not a 2525 symbol).
- **Teammates (later):** a `SymbolLayer` over the presence store's GeoJSON with
  `iconRotate: ['get', 'heading']`, `iconRotationAlignment: 'map'`, using the same icon.

### 8.4 Crosshair and readout
- The crosshair and its readout are **always visible**.
- Readout line 1: **MGRS of the crosshair**. Line 2: range and bearing from the user to the
  crosshair in the selected unit and north reference (shows "—" without a position fix),
  plus the G-M angle.
- Only the readout component subscribes to a throttled (~one update per frame)
  `cameraCenter` value fed from `onCameraChanged`. It is initialized from the initial camera
  so it is never blank.
- When a menu panel is open, the map applies camera padding equal to the panel's occupied
  area, and the crosshair moves to the center of the visible map area. The readout always
  describes the point under the crosshair. *(Plan must verify rnmapbox reports the padded
  center; fallback is `getCoordinateFromView` at the crosshair position.)*

### 8.5 Placing items
- **Drop button** → `placePoint(crosshairCoord, activeSidc)`.
- **Long-press on map** → `placePoint(pressCoord, activeSidc)`.
- Both give haptic feedback (`expo-haptics`). The point is created immediately with an
  auto-name (e.g. "Hostile 3"); the `item.properties` menu opens at its `peek` detent for
  optional edits. Ignoring it does not block further placement.

### 8.6 Interaction store
`activeSidc`, `selectedItemId`, `followMode`, `cameraCenter` (throttled). No `crosshairVisible`
— the crosshair is always shown.

### 8.7 Offline tiles (`features/map/offline`)
`TilePackService` interface — `create(bounds, minZoom, maxZoom)`, `list()`, `delete(id)`,
`progress$` — implemented over rnmapbox `offlineManager`. Built and tested; no UI in MVP.
Default tile behavior is online with Mapbox's ambient cache.

### 8.8 Performance rules
1. No per-item React components on the map.
2. No camera state in React driving the map.
3. Stable style references.
4. Hide via layer filter, never by rebuilding the source.
5. High-frequency readouts are isolated components subscribing to throttled values.
6. Before merging map changes, check panning with 5,000 seeded points on a physical device.

## 9. Toolbar (`features/toolbar`)
- A **top bar in both portrait and landscape**, absolutely positioned over the map,
  respecting safe-area insets (top in portrait; leading/trailing in landscape).
- MVP buttons: app menu, symbol selector (shows active SIDC, opens `symbol.picker`), drop
  point, grid/magnetic toggle, recenter/follow.
- If buttons exceed the available width, the bar scrolls horizontally or overflows into a
  "more" action. It does not wrap.

## 10. Semantic styling (`src/theme`)
- **NativeWind**, pending a compatibility check against SDK 57 / RN 0.86 in the plan.
- **Token layers in `src/theme/tokens.ts` (single source of truth):**
  1. *Palette* — Tailwind colors defined by hand. Referenced only within `src/theme/`.
  2. *Semantic tokens* — `surface`, `surface-raised`, `surface-overlay`, `text`,
     `text-muted`, `accent`, `danger`, `border`, `readout`, and affiliation colors
     `friendly`, `hostile`, `neutral`, `unknown`.
  3. *Themes* — `day`, `dark` in MVP; `night` (red-light) later.
- Semantic tokens are exposed to NativeWind as CSS variables; components use
  `bg-surface text-text border-border`. Theme switching swaps variables.
- `mapColors(theme)` exports the same semantic values as raw colors for Mapbox layer styles.
- Spacing, radius, and type scale use Tailwind defaults, plus a monospace, tabular-digit
  readout style for MGRS and bearings.
- **Lint:** no hex color literals or raw palette classes outside `src/theme/`.
- Template theming files (`constants/theme.ts`, `themed-*`, `use-theme`, `global.css`
  contents) are replaced.

## 11. Menu system

### 11.1 Panel
- One in-house `Panel` component (Reanimated + Gesture Handler): a **bottom sheet with
  detents in portrait**, a **left drawer in landscape**.
- **No backdrop.** The host uses `pointerEvents="box-none"`; the map remains fully
  interactive (pan, zoom, long-press) while a menu is open.
- The panel publishes its occupied rectangle for camera padding (Section 8.4).
- Detents: `peek`, `half`, `full` (bottom); drawer width fixed per device class (left).
- Keyboard handling for text fields keeps the focused field visible.

### 11.2 Registry and stack
- Every menu is declared once:
  ```ts
  defineMenu({
    id: 'item.properties',
    family: 'action',            // 'app' | 'action'
    title: 'Point',
    params: z.object({ itemId: z.string() }),
    detents: ['peek', 'half', 'full'],
    component: ItemPropertiesMenu,
  })
  ```
- Menu store (Zustand) holds a typed stack: `openMenu(id, params)` (replace stack),
  `pushMenu(id, params)`, `back()`, `closeMenu()`.
- A single `MenuHost` in `MapScreen` renders the top of the stack inside the `Panel`.
- Menus are not Expo Router routes. Routes are reserved for full-screen pages (e.g. About,
  licenses).

### 11.3 Primitives (`components/menu`)
`MenuHeader` (title, back, close), `MenuSection`, `MenuRow`, `MenuToggle`, `MenuTextField`,
`MenuSegmented`, `SymbolGrid`, `MenuActions` (primary / destructive). Menus compose only
these primitives; primitives use only semantic tokens and may wrap `@expo/ui` controls.

### 11.4 MVP menus
- **App family:** `app.root` → "Switch mission", `settings` (coordinate format, angle unit, north reference,
  declination override, theme), `about`.
- **Action family:** `symbol.picker`, `item.properties` (name, symbol, notes, MGRS,
  range/bearing, hide toggle, delete).

### 11.5 Visual design
Mockups will be stored in `docs/design/mockups/` and referenced from UI tasks in the
implementation plan. Token values (Section 10), toolbar layout (Section 9), and panel
appearance (Section 11.1) follow the mockups; the architecture above does not depend on them.

## 12. Error handling
- **Location denied / no fix:** map fully usable, no puck, range/bearing shows "—", one
  dismissible banner to enable location.
- **Command failure:** commands return a `Result`; UI shows a toast and error haptic.
- **Missing Mapbox token:** development-time error screen. Token read from
  `EXPO_PUBLIC_MAPBOX_TOKEN` in an uncommitted `.env`.
- **Geo input errors:** typed `Result` errors (Section 6).

## 13. Testing
- **`lib/geo`:** Jest golden-vector tests — GeographicLib test data, NGA MGRS samples
  (including zone/band edges and Norway/Svalbard exceptions), official WMM test values.
  Highest coverage bar in the repo.
- **Data layer:** repositories, commands, selectors tested with WatermelonDB's LokiJS
  in-memory adapter (UUIDs, authorship stamps, mission scoping, visibility, feature cache, mission list ordering and item counts).
- **Menu system:** registry typing, stack operations.
- **UI:** focused React Native Testing Library tests for toolbar, readout, menu primitives;
  `@rnmapbox/maps` mocked.
- **Performance:** dev-only seed of 5,000 points; manual device check of panning
  smoothness.

## 14. Tooling
- TypeScript strict; `jest-expo`; ESLint boundary rules (Section 4) and styling rules
  (Section 10).
- `expo-dev-client`; config plugins for `@rnmapbox/maps`, `expo-location` (usage strings),
  WatermelonDB; Babel decorators configuration for WatermelonDB models.
- `app.json`: `orientation: "default"`; web target removed.
- `zod` for typed menu params.
- Packages installed with `npx expo install`.

## 15. Agent skills and rules
Added under `.agents/skills/` (shared by Claude and Cursor via existing symlinks):
1. **`map-performance`** — Section 8.8 rules as a checklist.
2. **`geo-library`** — canonical forms, wrapping libraries, golden-vector tests,
   `describeVector` usage, no trigonometry in features.
3. **`data-layer`** — adding tables/columns/commands; sync stamps, UUIDs, commands as only
   write path, local-only table list, migration rules.
4. **`map-item-kinds`** — end-to-end recipe for a new item kind (geometry, selector, layer,
   tool, menu, command, tests).
5. **`menus`** — adding a menu: registry entry, typed params, primitives only, family
   conventions.
6. **`styling`** — semantic tokens only, adding tokens/themes, `mapColors` for map layers.

`.agents/rules/repo-overview.mdc` gains a short architecture summary linking to this spec.

## 16. Risks and verification gates (first plan steps)
1. **WatermelonDB on RN 0.86 New Architecture** (JSI SQLite adapter) — prove in a throwaway
   dev build before building on it. If it fails, revisit Section 5 before continuing.
2. **NativeWind compatibility** with SDK 57 / RN 0.86 — choose the supported major version;
   if none, fall back to typed tokens + `StyleSheet` with the same semantic names.
3. **`@rnmapbox/maps`** version for RN 0.86, including `LocationPuck` heading support.
4. **`geomagnetism`** covers WMM2025 dates.
5. **Camera padding** center behavior (Section 8.4).
6. **Saved camera restore** on mission open applies before first render without a visible
   jump (initial camera props vs. imperative move).

## 17. Future evolution (informative)
- **Sync:** implement `synchronize()` pull/push in `lib/db/sync`, excluding local-only
  tables; server keyed by UUIDs and mission IDs.
- **Collaboration:** presence store fed by a realtime channel; `TeamLayer`; mission
  membership for the paid tier; `lib/identity` switches to `userId`.
- **Lines/polygons:** new `kind` values, tools, layers, and menus via the
  `map-item-kinds` skill; no schema change required.
- **Offline maps UI:** menus over `TilePackService`.
- **Night/red-light theme:** new theme mapping in `src/theme`.
