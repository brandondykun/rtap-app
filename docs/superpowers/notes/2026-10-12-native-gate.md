# Native dependency gate — 2026-10-12

Device verification was NOT run locally (disk space exhausted). The user built an EAS development client. iOS checks passed on device on 2026-10-12 (spike screen: Mapbox satellite, semantic NativeWind classes, `createMission` against the real app database, relaunch persistence, rotation). Android is still PENDING: the user has no Android device yet, so it is deferred. Re-run the same checks on the first Android build (watch the async-adapter database path).

| Check | iOS | Android |
|-------|-----|---------|
| Builds and launches | PASS (after the two Babel fixes below) | PENDING |
| Mapbox satellite renders | PASS | PENDING |
| NativeWind classes apply | PASS (semantic tokens) | PENDING |
| WatermelonDB decorated field writes/reads | PASS (JSI) | PENDING (async adapter) |
| WatermelonDB persists across relaunch | PASS | PENDING |

Installed versions:

```
@nozbe/watermelondb@0.28.0
@rnmapbox/maps@10.3.8
nativewind@4.2.7 (react-native-css-interop@0.2.7)
tailwindcss@3.4.19
@morrowdigital/watermelondb-expo-plugin@2.3.3
```

Observed locally (iOS `expo run:ios` attempt):
- `npx tsc --noEmit` passed with the spike screen.
- Prebuild succeeded. `pod install` first failed: "multiple dependencies with different sources for `simdjson`" — the WatermelonDB expo plugin adds `pod 'simdjson'` to the Podfile while Expo autolinking also links `@nozbe/simdjson` by a different path.
- Workaround (one fix, applied): `"expo": { "autolinking": { "exclude": ["@nozbe/simdjson"] } }` in package.json. The simdjson conflict was gone on the next run. This is kept in package.json.
- The next `pod install` then failed while extracting React.xcframework with "Write to restore size failed" (disk full, ~300 MB free). This is environmental, not a dependency fault; the native build never completed.

Notes / workarounds:
- `tsc` needed `declare module '*.css';` in `nativewind-env.d.ts` for the side-effect `import '../global.css'` (the nativewind types alone did not cover it).
- `tailwindcss` and the babel plugins moved to devDependencies.
- Mapbox needs `EXPO_PUBLIC_MAPBOX_TOKEN` (public token) in a git-ignored `.env`; also an EAS env var for cloud builds. Mapbox native SDK download may also need `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` (secret, `DOWNLOADS:READ`) at build time.
- Spike screen (inserting a row on mount) was reverted to the placeholder.

EAS dev build findings (iOS):
- Bundling failed: "Class private methods are not enabled" in RN's `GlobalStateObserver.js`. The explicit loose class-properties plugin requires the private-methods transforms in the same mode. Fixed in 260c0a9.
- Runtime red screen: "Cannot assign to read-only property 'NONE'" (RN `Event.js`). Running the decorator/class-properties plugins over node_modules turned Flow-only field declarations into real assignments. Fixed in 49e725b by scoping those plugins to app code (Babel `overrides` with a filename `test`; a RegExp `exclude` breaks Metro's transformer construction).
- Rotation re-layout works with the map mounted.

## Plan 2 device checks (iOS dev build)

Run `npx expo start --dev-client --clear`, open the app on the device.

| # | Check | Result |
|---|-------|--------|
| 1 | Missions list: empty state → Create mission sheet (keyboard does not cover the field) → lands on the new mission's map | PENDING |
| 2 | Map opens on the user's position (first fix) or world view without a fix; no jump when reopening a mission with a saved camera; opening and leaving a mission without moving the map saves nothing (next open still centers on you) | PENDING |
| 3 | Fonts: readout MGRS renders in JetBrains Mono | PENDING |
| 4 | Self icon: sky disc, white ring, dark arrow; view cone rotates with the phone; no arrow when the compass is unavailable | PENDING |
| 5 | Crosshair centered; readout MGRS changes while panning; tapping the bearing switches GRID ↔ MAG | PENDING |
| 6 | North-up needle follows map rotation; tap resets north. Zoom ± and recenter work; panning turns follow off | PENDING |
| 7 | Toolbar: full width in portrait, top-right in landscape; POINT and gear dimmed; hamburger returns to missions | PENDING |
| 8 | Mapbox logo/attribution visible top-left; no scale bar | PENDING |
| 9 | Label chips: dark rounded chips under symbols, text readable, corners not distorted (stretch zones work) | PENDING |
| 10 | Map label glyphs load (DIN Pro). Monospace map labels need JetBrains Mono glyphs uploaded to Mapbox — decide | PENDING |
| 11 | Seed 5k → panning/zooming smooth for 30 s in both orientations | PENDING |
| 12 | Background the app on the map, kill it, reopen the mission: same camera | PENDING |
| 13 | Deny location (Settings → RTAP → Location → Never): banner shows, Settings button opens Settings, map still usable | PENDING |
| 14 | Pan, then within ~1 s swipe to the app switcher and kill the app; reopen the mission: camera is where you left it | PENDING |
| 15 | Pan/rotate, then rotate the device both ways: the camera never jumps back to the opening view | PENDING |
| 16 | Deny location in portrait: banner does not cover the Mapbox logo/attribution | PENDING |
| 17 | Pan above 84°N (lat/lon fallback) in portrait: readout card does not overlap zoom/recenter | PENDING |
| 18 | Follow: tap recenter and walk — camera follows, button highlighted; pinch/pan turns follow off; recenter keeps zoom ≥ 15 | PENDING |
| 19 | Turn the phone through north: the view cone crosses north smoothly (no 358° spin) | PENDING |
| 20 | First launch: grant location on the map → centers once; leave and reopen → opens at that saved view without a jump | PENDING |
| 21 | Android (when un-deferred): deny location once, background/foreground: no double prompt | PENDING |

Fallbacks if a check fails:
- 9: drop `stretchX`/`stretchY`/`content` from `LABEL_CHIP_IMAGE_OPTIONS` (whole-image stretch) or render chips at `scale: 1`.
- 10: keep DIN Pro (proportional) until JetBrains Mono glyphs are uploaded; switch `MAP_LABEL_FONT`.
- 2 (visible jump): keep `defaultSettings` and add `animationDuration: 0`; report to the controller.

Plan 2 device findings (iOS):
- Label chip: rnmapbox multiplies `stretchX`/`stretchY`/`content` by the image entry's `scale` (RNMBXUtils.swift), so they must be given in points. Pixel values triggered "expected stretchX area lies within an image (width 72)". Fixed by expressing them in points.
- Scale bar removed at the user's request (too much screen space).
- Ornament margins: on iOS Mapbox measures logo/attribution margins from the safe area, so adding safe-area insets double-counted them (logo too far right in landscape, too low in portrait). MapCanvas now passes zero insets on iOS. Android is assumed to measure from the map view edges (device insets added) — verify when Android is un-deferred.

## Plan 3 device checks (iOS dev build)

Run `npx expo start --dev-client --clear`, open the app on the device.

| # | Check | Result |
|---|-------|--------|
| 1 | Landscape with location off: the banner sits below the toolbar; Menu is tappable | PENDING |
| 2 | Hamburger opens the app menu; Switch mission returns to the list; About opens and goes back | PENDING |
| 3 | Gear opens Settings; changing coordinate format, mils and north reference updates the readout after closing | PENDING |
| 4 | Manual declination: toggling on starts at the model value; G-M angle is plausible for your area (compare with NOAA's calculator) | PENDING |
| 5 | Panel in portrait: drag the handle between peek / half / full; flings move one step; the map pans and zooms underneath | PENDING |
| 6 | Panel in landscape: left drawer, toolbar fully visible, Mapbox logo visible right of the drawer | PENDING |
| 7 | With a panel open, the crosshair sits in the middle of the visible map and the readout (in the form) describes that point — risk 5: Mapbox reports the padded center. If not, read the center with `getCoordinateFromView` at the crosshair | PENDING |
| 8 | POINT opens Add Point at the crosshair; the draft shows the amber dashed ring, `HOS-n · NEW` chip and, with a fix, the dashed range line and label | PENDING |
| 9 | Typing MGRS: the map moves only when the reference becomes valid; partial input never jumps | PENDING |
| 10 | Center moves the draft to the crosshair; long-press moves the draft and keeps the form (Me was replaced by Map — see row 27) | PENDING |
| 11 | The keyboard never covers the focused field (sheet goes full while typing) | PENDING |
| 12 | Add: success haptic; the panel switches to the new point, selected and read-only (one marker with the ring and its name, no second draft on top); the next POINT keeps the last affiliation/type and the name increments | PENDING |
| 13 | Tap a point: it opens read-only (title "Point", Close + Edit, all fields disabled, Hidden/Delete disabled); Edit unlocks it; Save writes and returns to read-only; Cancel drops changes; Delete (in edit mode) needs a second tap | PENDING |
| 14 | Rotate with Add Point open and a half-typed form: nothing typed is lost | PENDING |
| 15 | Accent chip and draft ring render crisply (no stretched corners) | PENDING |
| 16 | Long-press near a screen edge with no panel open: the panel opens and the draft ends up centered in the visible map (camera move and padding don't fight) | PENDING |
| 17 | Open the app menu, pan the map, tap About, then relaunch and reopen the mission: the camera is where you left it | PENDING |
| 18 | With the keyboard up (sheet full), the recenter button is hidden and never overlaps the toolbar | PENDING |
| 19 | The amber "· NEW" chip sits below the ring without covering its bottom tick | PENDING |
| 20 | With no panel open, tap a point: Edit opens and the draft sits exactly under the crosshair; drag the sheet and it stays aligned | PENDING |
| 21 | Recenter (follow on), tap POINT, wait for several GPS fixes: the crosshair stays over the camera center in the visible map | PENDING |
| 22 | Leave Add Point at peek, then tap gear or hamburger: the menu opens readable at half | PENDING |
| 23 | Settings: type a manual declination and tap Close without pressing return — the value is kept | PENDING |
| 24 | Edit: tap Delete once, wait ~5 s, tap again — it re-arms instead of deleting | PENDING |
| 25 | Add Point / Name inputs: the typed text is vertically centred in each field; the Center button shows the same crosshair as the map | PENDING |
| 26 | Viewing a point read-only: long-press elsewhere starts a new point there; the selected point shows only its name (no "· EDIT") until you tap Edit | PENDING |
| 27 | Add/Edit Point: tap Map (it turns amber with a hint), tap the map — the point moves there and the map eases to it; tapping on an existing point while picking places it there instead of opening that point; tap Map again to cancel | PENDING |
| 28 | Long-press on the map: a firm haptic tap as the new point appears (or as the point being placed/edited moves) | PENDING |
| 29 | LAYERS opens the Layers panel (tool highlighted); tap LAYERS again or Close to dismiss | PASS (iOS, 2026-10-13) |
| 30 | Basemaps: Satellite, Hybrid, Topo and Dark each load; the camera stays put when switching; points, label chips, self icon and the draft all redraw on each; labels stay readable on Topo and Dark | PASS (iOS, 2026-10-13) |
| 31 | Basemap choice survives an app restart | PASS (iOS, 2026-10-13) |
| 32 | Layers list: eye toggles hide/show the point on the map immediately; Show all brings every hidden point back; tapping a row (also a hidden one) flies there and opens it selected | PASS (iOS, 2026-10-13) |
| 33 | Seed 5k mission: the Layers panel opens without a stall, shows "Showing 100 of 5,000", search narrows it smoothly | PENDING |
| 34 | Offline (airplane mode, fresh install or cleared cache): choosing Topo shows the "Topo map is unavailable — showing Satellite." message and the map falls back to Satellite; choosing Topo again after reconnecting loads it | PENDING |
| 35 | Opening Layers closes an open point (the selection clears and Map pick mode ends), because only one panel is open at a time; the basemap switch itself leaves points and the camera alone | PASS (iOS, 2026-10-13; behavior confirmed, row rewritten) |
| 36 | Tapping a Layers row while the search keyboard is up dismisses the keyboard before the point opens | PASS (iOS, 2026-10-13) |
| 37 | Landscape: the basemap segments fit the drawer and the points list scrolls to the last row | PASS (iOS, 2026-10-13) |
| 38 | VoiceOver: rows read the point name, then "Hidden" and the coordinate as the hint; the eye button reads "Hide …"/"Show …" | PENDING |
| 39 | Settings → manual declination: type 200 and tap Close — the old value stays; type -9.5 and tap Close with the keyboard up — -9.5 is kept | PASS (iOS, 2026-10-13) |
| 40 | Drag Add Point to peek, open Settings, close it, tap POINT: Add Point opens at half, not peek | PASS (iOS, 2026-10-13) |
| 41 | Recenter (follow on), then open Settings or Layers: the map re-centers on you above the panel right away, not a second later | PASS (iOS, 2026-10-13) |
| 42 | Long-press one spot, then quickly long-press another while the map is still moving: the map ends with the second spot centered above the panel | N/A (iOS, 2026-10-13): the move ends before a second long-press is possible; covered by the MapScreen test instead |
| 43 | Missions list: swiping a row left reveals a red Delete; swiping another row closes the first; vertical scrolling still works and a tap still opens the mission | PENDING |
| 44 | Delete → confirmation shows the name and item count; Cancel or tapping outside keeps the mission; Delete removes it with a success haptic; the confirmation also works in landscape | PENDING |
| 45 | VoiceOver: on a mission row, swipe up/down to the "Delete" action and activate it — the confirmation opens | PENDING |
| 46 | Missions list: swiping a row left shows Edit (outlined, pencil) and Delete (red, trash); both buttons fit at a comfortable size; hint reads "Swipe a mission left to edit or delete it." | PENDING |
| 47 | Edit opens a sheet titled "Rename mission" with the name prefilled and selected; Save updates the list immediately with a success haptic; a blank name turns the field red with "Enter a mission name."; Cancel and swiping the sheet down keep the old name | PENDING |
| 48 | VoiceOver: a mission row offers "Rename" and "Delete" actions | PENDING |
| 49 | GPS button (navigation arrow) sits right under the north-up button on the right edge; its icon turns amber when on; opening/closing POINT, LAYERS or other menus never changes it; it stays on after an app restart; with a full-height sheet the recenter button still never overlaps it | PENDING |
| 50 | GPS readout sits bottom-left in its own box, stacked just above the crosshair readout card with a small gap; shows the blue navigation arrow, your MGRS (or lat/lon per Settings), and "ALT … · ACC ±…"; position matches the map's self icon and updates as you move | PENDING |
| 51 | Altitude is plausible for your location (iPhone reports height above sea level; compare with a known elevation) and switches between meters and feet from Settings → Altitude | PENDING |
| 52 | With a menu open, the GPS readout hides along with the crosshair readout and returns when the menu closes; the GPS button stays highlighted throughout. Long lat/lon text never runs under the zoom/recenter buttons | PENDING |
| 53 | NEW BUILD (expo-screen-orientation). Face a known landmark: the self icon's view cone points at it in portrait, landscape with the phone's top to the left, and landscape with the top to the right; turning the phone between them re-points the cone at once, without walking | PENDING |
| 54 | Toolbar reads UNIT · POINT · LAYERS; UNIT opens "Add unit" (unchanged form), POINT opens "Add point" (location, Point type with symbols, Name, Notes) | PENDING |
| 55 | Add point: picking a type changes the draft symbol at once and renames CP-1 → LZ-1 etc.; Add shows the point selected as "Point"; Edit/Save/Cancel/Hidden/Delete work | PENDING |
| 56 | Point symbols (blue with dark outline) are readable on Satellite, Hybrid, Topo and Dark; the LZ symbol matches the others; a checkpoint's tip (not its middle) sits on the spot, under the crosshair | PENDING |
| 57 | Long-press after using Add point starts Add point; after Add unit starts Add unit; first launch starts Add unit | PENDING |
| 58 | Layers: summary "N units · M points · K hidden"; searching "checkpoint" or "infantry" finds by type; row taps open Unit or Point to match. Missions list shows "N units · M points" | PENDING |
| 59 | Add point → Point type → Target: TRP-style symbol, default name TGT-1 (TGT-2 next); renaming it to a target number (e.g. AB1001) shows that number in the map label | PENDING |
| 60 | Toolbar reads UNIT · POINT · LINE · LAYERS; LINE opens "Add line" with the draw bar ("Tap map", Add at center, Undo) | PENDING |
| 61 | Draw a 4-point line by tapping and by Add at center; numbered white markers, segment distances and the total match; Undo steps back one change at a time | PENDING |
| 62 | Type grids under "New point" (Add new point and return both add); a partial grid cannot be added; the map eases to typed points | PENDING |
| 63 | Select a point (row or marker): amber ring; map tap / Move to center / corrected grid moves it; Insert after puts the next point right after it; Done returns to adding | PENDING |
| 64 | With 2 points the × buttons are disabled and "A line needs at least 2 points" shows; Save needs a name and 2 points | PENDING |
| 65 | Each line type's look on Satellite, Topo and Dark: dashed RFL/CFL, heavy boundary, wide axis with arrow, route arrow, FLOT bumps; labels "PL RED" at both ends | PENDING |
| 66 | Tap a saved line: the map fits it, "Line" view read-only; Edit/Save/Cancel; Hidden on map; Delete line with a second tap | PENDING |
| 67 | Layers: line rows with a line sample, "Phase line · 2.03 km"; search "phase"; summary and mission rows count lines | PENDING |
| 68 | Line menu "Show point distances" toggle (works while viewing): off hides the segment distance chips on the map, stays off after relaunch | PENDING |
| 69 | Toolbar reads UNIT · POINT · LINE · MEASURE · LAYERS; MEASURE closes an open panel and shows the Measure card ("Set start") | PENDING |
| 70 | Tap the map to set the start; pan: the dashed amber line and the readout follow the crosshair; tap to fix the end (solid); tap again moves the end | PENDING |
| 71 | Tap a unit / point: the end snaps onto the symbol and its menu does not open; tap my blue marker: snaps to me; From me sets the start to my GPS position | PENDING |
| 72 | Readout matches the range/bearing elsewhere (deg/mils, GRID/TRUE/MAG from Settings); chip at the line's middle is readable on Satellite, Topo and Dark | PENDING |
| 73 | Set at crosshair, Restart and × (Stop measuring) behave; opening Layers or Menu stops measuring; long-press does nothing while measuring | PENDING |
