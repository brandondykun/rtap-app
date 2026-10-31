# Tactical Map — Architecture Design

**Date:** 2026-10-12
**Status:** Approved with mockups (2026-10-12)

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
- User's own location with a heading-aware icon (view cone) (no label).
- Always-visible center crosshair; bottom-left readout card with the crosshair's MGRS and
  range/bearing from the user (tap the bearing to toggle grid ↔ magnetic).
- Top toolbar: app menu, POINT tool, settings. Map controls: north-up, zoom in/out,
  recenter. No scale bar (user decision 2026-10-12: too much screen space).
- Add Point panel (POINT tool or long-press): MGRS entry, Center/Me, affiliation, unit type,
  name, notes → saved to the local database → rendered on the map.
- Select a point → Edit Point panel (same form plus hide and delete).
- Toggle visibility of any map item.
- App menu ("Switch mission", About) and Settings menu (coordinate format, angle unit,
  north reference, declination override).

**Explicitly out of MVP (architecture must accommodate)**
- Offline tile download UI (service layer is built; no UI).
- Lines, polygons, and other map item kinds.
- Remote sync, authentication, paid tier, live teammate locations.
- Runtime rasterization of arbitrary SIDCs.
- Shown in mockups but not designed yet (left out of MVP): LINE, POLYGON and MEASURE
  tools (LAYERS was added after the MVP — Section 11.4); routes; MGRS grid overlay with grid labels; the "Share" toggle; mesh status, GPS
  accuracy, altitude and Zulu-time readouts; callsigns (e.g. "2-1").
- Day and night/red-light themes (MVP ships the mockup dark theme; theming is wired so
  more themes are data-only additions).
- Web. `@rnmapbox/maps` is native-only; template web files are removed.

**Platform baseline:** Expo SDK 57, React Native 0.86 (New Architecture), React 19.2,
React Compiler enabled, Expo Router. Requires a development build (`expo-dev-client`);
Expo Go is not supported because Mapbox and PowerSync's SQLite engine (op-sqlite) ship native code.

## 2. Guiding principles

1. **The map is the product.** Panning, zooming, and placing items must stay smooth with
   thousands of items. Every architectural choice is checked against map performance.
2. **Workflow speed.** The common action (drop a point) is one tap and never waits on a form.
3. **Offline-first, sync-ready.** All data is local; schema and write paths are shaped for a
   future PowerSync sync without migration of existing data.
4. **Clear boundaries.** Small units with one purpose; boundaries enforced by lint.
5. **One source of truth** for geo math, styling tokens, and menus.

## 3. Chosen approach: reactive geo-layer pipeline

```
PowerSync SQLite ──watch──▶ repository ──▶ selector (memoized GeoJSON FeatureCollection)
                                                     │
                                                     ▼
                         Mapbox ShapeSource + SymbolLayer (native, GPU rendered)
                                                     ▲
UI (toolbar, menus, gestures) ──▶ commands ──▶ repository ──▶ AppDb (PowerSync SQLite)
```

- The map never renders one React component per item.
- All writes go through **commands**, the single place sync metadata is stamped.
- Interaction state (selected symbol, selection, follow mode, menu stack) lives in small
  Zustand stores, separate from the database.
- Transient high-frequency data (own and future teammate locations) never goes through
  the database.

Rejected alternatives:
- *Per-item `PointAnnotation`/`MarkerView` components* — degrades at a few hundred items.
- *Event-sourced op log* — strong for merging but premature and overlaps with
  PowerSync's own sync protocol. Can be added beside the current model later.

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
      repository.ts          # watch list (with item counts), get, create
      commands.ts            # createMission, markMissionOpened, saveMissionCamera
    map/
      MapScreen.tsx
      canvas/                # MapCanvas, camera controller, style constants
      layers/                # PointsLayer, LabelsLayer, SelfLayer, DraftLayer
                             # (later TeamLayer, LinesLayer, …)
      controls/              # NorthUpButton, ZoomButtons, RecenterButton, ReadoutCard
      interaction/           # crosshair, readout, long-press, selection
      offline/               # TilePackService interface + Mapbox implementation
    map-items/
      geometry.ts            # GeoJSON geometry (de)serialization
      repository.ts          # watch / query / create / update / delete
      commands.ts            # placePoint, updateItem, deleteItem, toggleItemVisibility
      selectors.ts           # records → GeoJSON FeatureCollection (cached)
      naming.ts              # auto-names (HOS-4, …)
      menus/                 # Unit/Point forms and Add/Edit menus on shared item panels
    toolbar/                 # top toolbar UI
    location/                # self position + heading stream
    symbology/               # presets (affiliation × unit type → SIDC), image registry
    menus/                   # registry, MenuHost, menu definitions
  components/
    ui/                      # shared primitives (buttons, icons)
    menu/                    # menu primitives (Section 11)
  lib/
    geo/                     # pure TypeScript geospatial library (Section 6)
    db/                      # AppDb seam (app-db.ts), PowerSync schema, PowerSync and
                             # test (@powersync/node) implementations, id generator,
                             # sync config, command context
    result.ts                # shared Result<T, E> type (geo, commands)
    identity/                # deviceId now; userId later
  stores/                    # Zustand: interaction, draft, settings, presence, menu
  theme/                     # tokens, themes, mapColors (Section 10)
  config/                    # env access (Mapbox token), constants
```

**Dependency rules (ESLint `no-restricted-imports`):**
1. `lib/*` never imports `features/`, `stores/`, `components/`, or `app/`.
2. `lib/geo` imports nothing from `react` or `react-native`.
3. Only `features/*/repository.ts` and `features/*/commands.ts` import `@powersync/*` / op-sqlite and
   run SQL, through the `AppDb` seam (`lib/db/app-db.ts`: query, watch, execute, transaction),
   which `lib/db/powersync-db.ts` implements over PowerSync local-only tables. UI reads
   through hooks built on repository watch subscriptions.
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
- **IDs:** UUIDv4 generated client-side via `lib/db/new-id.ts` (`expo-crypto`).
- **Deletes:** hard `DELETE` on the local-only tables. PowerSync tracks changes itself once
  tables become synced, so no tombstone columns are kept.
- **Authorship:** every command stamps `created_by` / `updated_by` from `lib/identity`
  (persistent `deviceId` now, `userId` once accounts exist).
- **Scoping:** every map item belongs to a mission. The user creates or selects a mission on
  the missions screen before entering the map; the active mission is the `missionId` route
  param, passed explicitly to repositories and commands (no global "active mission" store).
- **Local-only tables** are listed in one place (`lib/db/sync-config.ts`) and excluded from
  the future sync push/pull.
- **Schema:** the PowerSync `Schema` in `lib/db/schema.ts` (tables are `localOnly` until the
  sync release); there is no migrations file, PowerSync manages the SQLite tables from it.

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
- MVP mission operations: list, create (name), open, rename, delete. Swiping a mission row left
  shows Edit and Delete. Edit opens the rename sheet (`renameMission`, the same form as New
  mission). Delete (`deleteMission`) asks for confirmation, tombstones the mission and its items,
  and removes their local-only view state.

### 5.4a Units and points
Map symbols are **units** (affiliation + unit type) or **points** (control measures: checkpoint,
observation post, landing zone, start/release/rally/linkup points, TRP). Both are stored as
`kind = 'point'` items; `itemCategory(sidc)` (src/features/symbology/categories.ts) is the only
place that tells them apart. Section 8.5's Add/Edit Point flow is now **Add/Edit Unit**
(`unit.add` / `unit.edit`); points have their own `point.add` / `point.edit` with location, type,
name and notes. Design: `2026-10-13-units-and-points-design.md`.

### 5.4b Lines
Military control lines (10 types) are `kind = 'line'` items: GeoJSON LineString in `geometry`,
`{"lineType": …}` in `style`, no SIDC. `itemCategory({ kind, sidc })` returns `'line'` for them.
Drawing, editing (select/move/insert/remove/undo), the Line menus and Layers rows are specified in
`2026-10-13-lines-design.md`.

### 5.4c Measure
The MEASURE tool is a map mode, not a menu or a stored item: `stores/measure.ts` (start, end or
live at the crosshair), `MeasureLayer`, and `MeasureCard` in the top-left stack. Taps snap to
units, points and the user's marker. See `2026-10-13-measure-design.md`.

### 5.4d Polygons
Military areas (10 types) are `kind = 'polygon'` items: a closed GeoJSON Polygon in `geometry`
(a circle is a 64-point ring) and `{ polygonType, shape, center?, radiusM? }` in `style`. They are
drawn point by point or as a circle (center + radius); only their outline and label are tappable.
See `2026-10-13-polygons-design.md`.

### 5.4e Quick plot
PLOT is a map mode like MEASURE (not a menu, never stored): `stores/quick-plot.ts` holds the entry
state and one temporary point; `QuickPlotEntry` (four MGRS fields under the toolbar),
`QuickPlotLayer` and `QuickPlotCard` (Discard / Save unit / Save point → the Add menus at that
spot). See `2026-10-13-quick-plot-design.md`.

### 5.5 Data kept outside the database
- **Presence** (own location now, teammates later): in-memory Zustand store; later fed by
  a realtime channel. Breadcrumb trails may become a table later.
- **Settings** (coordinate format, angle unit, north reference, declination
  override): Zustand persisted to `expo-sqlite/kv-store`. Per-device, never synced.

## 6. Geospatial library (`lib/geo`)

**Canonical forms:** positions are WGS84 `{ lat, lon }` in decimal degrees; bearings are
**true north, decimal degrees**. Conversion to grid/magnetic, mils, and formatted strings
happens only at the edges.

```
lib/geo/
  types.ts             # LatLon, NorthRef ('true'|'grid'|'magnetic'), AngleUnit ('deg'|'mil')
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
- Symbols render on the device with milsymbol + Skia, cached on disk by SIDC (see docs/superpowers/specs/2026-10-19-runtime-symbols-and-echelon-design.md); both sit behind `getSymbolImage(sidc)`; layers do not change.

### 8.3 Self and teammate icons
- **Look (mockups):** white-ringed `sky-400` disc with a dark navigation arrow, a translucent
  `sky-400` view cone pointing along the heading. No label. Not a 2525 symbol.
- **Self:** `SelfLayer` — a `ShapeSource` with one feature from the presence store (fed by
  `expo-location` position + heading), rendered by a `SymbolLayer` with
  `iconRotate: ['get', 'heading']`, `iconRotationAlignment: 'map'`. Heading updates are
  throttled (≈10 Hz, ≥2° change) to keep source updates cheap.
- **Teammates (later):** the same layer style over the presence store's teammate features,
  so self and teammates share one rendering path.

### 8.4 Crosshair and readout
- The crosshair (thin white cross with a center dot) and its readout are **always visible**.
- The readout is a card at the bottom-left (portrait and landscape).
  Line 1 (large, monospace): crosshair icon + **MGRS of the crosshair**
  (`18S UJ 24000 06000`).
  Line 2 (small): range and bearing from the user to the crosshair in the selected unit and
  north reference, e.g. `1.15 km · 103° GRID` (shows "—" without a position fix). **Tapping
  the bearing toggles grid ↔ magnetic** — this is the one-tap north-reference toggle.
- Only the readout component subscribes to a throttled (~one update per frame)
  `cameraCenter` value fed from `onCameraChanged`. It is initialized from the initial camera
  so it is never blank.
- When a menu panel is open, the map applies camera padding equal to the panel's occupied
  area, and the crosshair moves to the center of the visible map area. The readout always
  describes the point under the crosshair. *(Plan must verify rnmapbox reports the padded
  center; fallback is `getCoordinateFromView` at the crosshair position.)*

### 8.5 Placing items (Add Point flow, from mockups)

> **Since 2026-10-13 (§5.4a):** this section describes what is now **Add/Edit Unit** — read `point.add` / `point.edit` / "point" below as `unit.add` / `unit.edit` / "unit". Control-measure points have their own `point.add` / `point.edit`.
- **Entry:** the POINT tool opens the `point.add` panel with a **draft point** at the
  crosshair. **Long-press** on the map opens it with the draft at the pressed coordinate
  (or moves the draft there if the panel is already open).
- **The draft is not in the database.** It lives in a `draft` Zustand store
  (`coord`, `affiliation`, `unitType`, `name`, `notes`) and is drawn by `DraftLayer`:
  the symbol, a dashed amber selection ring with tick marks, an amber "`HOS-4 · NEW`" label,
  and a dashed amber range line from the user to the draft labeled `1.15 km · 103°`.
- **Map follows the coordinate:** whenever the draft coordinate changes (valid MGRS typed,
  Center, Me, long-press), the camera eases to it, using the panel's camera padding so it
  lands in the center of the visible map area. Panning the map does *not* move the draft.
- **Form:** MGRS split into four fields (zone+band, 100 km square, easting, northing) with
  live validation (`✓ Valid · 1.15 km @ 103°`); **Center** (draft ← crosshair) and **Map**
  (the next tap on the map, or on a point, moves the draft there; user decision 2026-10-12,
  replacing **Me**); affiliation segmented control (friendly / hostile / neutral /
  unknown, shown as frame icons); **Name** (auto, e.g. `HOS-4`, editable); **unit type**
  dropdown; **notes** button that reveals a notes field.
- **Add** → `placePoint({ missionId, coord, sidc, name, notes })`, success haptic, then the
  panel switches to `point.edit` for the new point, shown selected (user decision 2026-10-12:
  no second draft dropped on top of the new point). The next Add Point remembers the last
  affiliation and type, and its name increments. **Cancel** closes the panel and clears the draft.
- **Auto-names:** `<PREFIX>-<n>` with `FRD`, `HOS`, `NEU`, `UNK` prefixes; `n` is one more
  than the highest existing number for that prefix in the mission.
- **SIDC:** built from affiliation × unit type (`symbology/presets.ts`). MVP unit types:
  Unspecified, Infantry, Armor, Reconnaissance, Medical, Engineer (2525C function IDs;
  2525C has no distinct "dismounted infantry" code, so the mockup's example maps to
  Infantry).
- **Editing:** tapping a point (or adding one) opens `point.edit` — the same form component
  prefilled, **read-only** first: title "Point", **Close** and **Edit**, every field, the hide
  toggle and **Delete** disabled, and long-press elsewhere starts a new point (user decision
  2026-10-12: prevents accidental edits). **Edit** unlocks the form ("Edit point", **Cancel** and
  **Save**); **Save** writes and returns to read-only; **Cancel** drops the changes and returns to
  read-only.

### 8.6 Interaction stores
- `interaction`: `selectedItemId`, `followMode`, `cameraCenter` (throttled),
  `cameraBearing` (throttled, for the north-up button).
- `draft`: the in-progress point (above).
- The crosshair is always shown; there is no visibility flag.
- *Implementation note (Plan 3):* the selected (edited) item is `draft.itemId`; `PointsLayer`
  leaves it out while `DraftLayer` draws the edit. While a panel is open the readout card, zoom
  buttons and location banner are hidden; recenter stays.

### 8.6a Map controls (right edge, from mockups)
- **North-up button** under the toolbar: compass needle rotated by `cameraBearing`; tap
  resets bearing to 0.
- **Zoom in / zoom out** stacked buttons and **recenter** (follow user) at the bottom-right.
- **No scale bar** (user decision 2026-10-12: it takes too much screen space; the mockups'
  scale bar is dropped).
- **Basemap:** Mapbox satellite style.

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
  respecting safe-area insets. Rounded, translucent near-black container.
  - **Portrait:** full width.
  - **Landscape:** anchored top-right, sized to its content, so a left panel never
    overlaps it.
- Layout: hamburger (app menu) · divider · tool buttons (icon over uppercase label) ·
  divider · gear (settings menu).
- **Tools:** POINT and LAYERS. LINE, POLYGON and MEASURE are added later through the
  same `ToolButton` component.
- **Active tool:** amber icon and label on a dark amber tinted background (POINT while the
  Add Point panel is open).
- If buttons exceed the available width, the bar scrolls horizontally. It does not wrap.

## 10. Semantic styling (`src/theme`)
- **NativeWind**, pending a compatibility check against SDK 57 / RN 0.86 in the plan.
- **Token layers in `src/theme/tokens.ts` (single source of truth):**
  1. *Palette* — Tailwind colors defined by hand. Referenced only within `src/theme/`.
  2. *Semantic tokens* — `surface`, `surface-raised`, `surface-overlay`, `text`,
     `text-muted`, `accent`, `danger`, `border`, `readout`, and affiliation colors
     `friendly`, `hostile`, `neutral`, `unknown`.
  3. *Themes* — MVP ships one theme, `dark` (the mockups); `day` and `night` (red-light)
     are later data-only additions.
- Semantic tokens are exposed to NativeWind as CSS variables; components use
  `bg-surface text-text border-border`. Theme switching swaps variables.
- `mapColors(theme)` exports the same semantic values as raw colors for Mapbox layer styles
  and for the symbol build script (milsymbol fill colors are overridden with the
  affiliation tokens so map symbols use Tailwind colors too).

**Dark theme (from mockups, Tailwind palette only):**

| Semantic token     | Tailwind     | Used for                                         |
|--------------------|--------------|--------------------------------------------------|
| `surface`          | `stone-900`  | panels/sheets                                    |
| `surface-chrome`   | `neutral-950` @ 90% | toolbar, map control buttons, readout card |
| `surface-input`    | `neutral-950`| text fields, segmented controls                  |
| `surface-raised`   | `stone-800`  | secondary buttons (Center, Me, notes)            |
| `border`           | `stone-700`  | field and button borders, dividers               |
| `text`             | `stone-50`   | primary text                                     |
| `text-muted`       | `stone-400`  | field labels, secondary readout line             |
| `accent`           | `amber-500`  | primary button, active tool, focused field, draft |
| `accent-subtle`    | `amber-950`  | active tool background                           |
| `on-accent`        | `neutral-950`| text on amber                                    |
| `success`          | `green-500`  | "Valid" indicator                                |
| `danger`           | `red-500`    | delete, invalid input                            |
| `friendly`         | `sky-300`    | friendly symbols and selection                   |
| `hostile`          | `red-400`    | hostile symbols, objective outlines              |
| `neutral`          | `green-300`  | neutral symbols                                  |
| `unknown`          | `yellow-300` | unknown symbols                                  |
| `self`             | `sky-400`    | own-position disc and view cone                  |
| `map-label-bg`     | `neutral-950` @ 85% | map label chips                           |
| `map-label-text`   | `stone-50`   | map label text                                   |

**Typography:** system sans for UI; panel titles uppercase with wide tracking; field labels
small uppercase `text-muted` with wide tracking; a bundled monospace font (JetBrains Mono)
for MGRS, readouts and map labels, with tabular digits.

**Map labels:** monospace text on a dark rounded chip (draft label: amber chip with dark
text). Mapbox has no text background, so labels are a separate `SymbolLayer` using a
stretchable chip image with `iconTextFit: 'both'`, offset below the symbol.
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
    id: 'point.edit',
    family: 'action',            // 'app' | 'action'
    title: 'Edit Point',
    params: z.object({ itemId: z.string() }),
    detents: ['peek', 'half', 'full'],
    component: EditPointMenu,
  })
  ```
- Menu store (Zustand) holds a typed stack: `openMenu(id, params)` (replace stack),
  `pushMenu(id, params)`, `back()`, `closeMenu()`.
- A single `MenuHost` in `MapScreen` renders the top of the stack inside the `Panel`.
- Menus are not Expo Router routes. Routes are reserved for full-screen pages (e.g. About,
  licenses).
- *Implementation note (Plan 3):* params schemas live in `src/features/menus/params.ts`, keyed by
  menu id, so the menu store can validate them without importing UI; `defineMenu` therefore takes
  `id, family, title, detents, component`.

### 11.3 Primitives (`components/menu`)
- `MenuHeader` — leading text action (`Cancel` / back), centered uppercase title, trailing
  primary button (amber, e.g. `✓ Add`).
- `MenuSection` — uppercase muted label above content.
- `MenuRow`, `MenuToggle`, `TextField` (shared, in `src/components/ui`), `MenuSegmented`, `MenuSelect` (dropdown),
  `MenuButton` (secondary: icon + label, e.g. Center / Me), `MenuActions`
  (primary / destructive), `MgrsInput` (the four-field MGRS entry with validation line).
- Menus compose only these primitives; primitives use only semantic tokens and may wrap
  `@expo/ui` controls (e.g. Switch, Picker/Menu for `MenuSelect`).

### 11.4 MVP menus
- **App family:**
  - `app.root` (hamburger) → "Switch mission", About.
  - `settings` (gear) → coordinate format, angle unit (degrees / mils), north reference
    (grid / magnetic / true), declination override.
- **Action family:** `unit.add`, `unit.edit`, `point.add`, `point.edit` (Section 8.5; §5.4a).
- **`layers`** (LAYERS tool, app family; added 2026-10-12): basemap choice — Satellite,
  Hybrid (satellite + streets), Topo (Mapbox Outdoors), Dark — one per-device setting
  (`settings.basemap`, default Satellite); and the mission's points: "N points · M hidden",
  **Show all**, name search, rows (symbol, name, coordinate) with an eye toggle that
  hides/shows immediately (view state, no Edit step), tapping a row flies to the point and
  opens it selected (hidden points too). The list shows at most 100 matches, with "Showing
  100 of N — refine your search". Not yet: filters by affiliation, overlays, basemap for
  offline downloads.

### 11.5 Visual design
Mockups live in `docs/design/mockups/` and are the visual reference for MVP UI:
- `portrait-map-idle.png`, `landscape-map-idle.png` — idle map: toolbar, map controls,
  readout card, symbols with label chips, self icon.
- `portrait-add-point.png`, `landscape-add-point.png` — Add Point panel as bottom sheet
  (portrait, ~⅓ height with grab handle) and left panel (landscape, ~40% width, full
  height), with the map auto-panned so the draft sits in the visible center.

Elements in the mockups that are out of MVP scope are listed in Section 1.

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
- **Data layer:** repositories, commands, selectors tested against a real in-memory SQLite database via `@powersync/node`
  (`lib/db/sql-test-db.ts`) (UUIDs, authorship stamps, mission scoping, visibility, feature cache, mission list ordering and item counts).
- **Menu system:** registry typing, stack operations.
- **Add Point flow:** auto-naming, SIDC composition, draft store transitions (Center, Me,
  long-press, Add resets, Cancel clears), MGRS field validation.
- **UI:** focused React Native Testing Library tests for toolbar, readout, menu primitives;
  `@rnmapbox/maps` mocked.
- **Performance:** dev-only seed of 5,000 points; manual device check of panning
  smoothness.

## 14. Tooling
- TypeScript strict; `jest-expo`; ESLint boundary rules (Section 4) and styling rules
  (Section 10).
- `expo-dev-client`; config plugins for `@rnmapbox/maps`, `expo-location` (usage strings),
  PowerSync (`@powersync/react-native` with `@op-engineering/op-sqlite`).
- `app.json`: `orientation: "default"`; web target removed.
- `zod` for typed menu params.
- Packages installed with `npx expo install`.

## 15. Agent skills and rules
Added under `.agents/skills/` (shared by Claude and Cursor via existing symlinks):
1. **`map-performance`** — Section 8.8 rules as a checklist.
2. **`geo-library`** — canonical forms, wrapping libraries, golden-vector tests,
   `describeVector` usage, no trigonometry in features.
3. **`data-layer`** — adding tables/columns/commands; sync stamps, UUIDs, commands as only
   write path, local-only table list, schema rules.
4. **`map-item-kinds`** — end-to-end recipe for a new item kind (geometry, selector, layer,
   tool, menu, command, tests).
5. **`menus`** — adding a menu: registry entry, typed params, primitives only, family
   conventions.
6. **`styling`** — semantic tokens only, adding tokens/themes, `mapColors` for map layers.

`.agents/rules/repo-overview.mdc` gains a short architecture summary linking to this spec.

## 16. Risks and verification gates (first plan steps)
1. **PowerSync on RN 0.86 New Architecture** (op-sqlite) — prove in a throwaway
   dev build before building on it. If it fails, revisit Section 5 before continuing.
2. **NativeWind compatibility** with SDK 57 / RN 0.86 — choose the supported major version;
   if none, fall back to typed tokens + `StyleSheet` with the same semantic names.
3. **`@rnmapbox/maps`** version for RN 0.86; `iconTextFit` label chips and the native scale
   bar render as specified.
4. **`geomagnetism`** covers WMM2025 dates.
5. **Camera padding** center behavior (Section 8.4).
6. **Saved camera restore** on mission open applies before first render without a visible
   jump (initial camera props vs. imperative move).
7. **Map label font:** Mapbox labels need glyphs served by the style; confirm a monospace
   font stack available to the satellite style (or upload JetBrains Mono glyphs to the
   Mapbox account), with a documented fallback.

## 17. Future evolution (informative)
- **Sync:** switch `missions` and `map_items` from local-only to synced tables in
  `lib/db/schema.ts` and connect a PowerSync backend connector, leaving the view-state
  tables local-only; server keyed by UUIDs and mission IDs.
- **Collaboration:** presence store fed by a realtime channel; `TeamLayer`; mission
  membership for the paid tier; `lib/identity` switches to `userId`.
- **Lines/polygons:** new `kind` values, tools, layers, and menus via the
  `map-item-kinds` skill; no schema change required.
- **Offline maps UI:** menus over `TilePackService`.
- **Night/red-light theme:** new theme mapping in `src/theme`.
