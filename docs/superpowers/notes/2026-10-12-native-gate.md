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
