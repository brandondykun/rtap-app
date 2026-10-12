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
