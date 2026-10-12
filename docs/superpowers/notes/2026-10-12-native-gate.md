# Native dependency gate — 2026-10-12

Device verification was NOT run locally (disk space exhausted; the user will build a dev client with EAS). All device checks are PENDING.

| Check | iOS | Android |
|-------|-----|---------|
| Builds and launches | PENDING (EAS dev build by user) | PENDING (EAS dev build by user) |
| Mapbox satellite renders | PENDING (EAS dev build by user; needs Mapbox token) | PENDING (EAS dev build by user; needs Mapbox token) |
| NativeWind classes apply | PENDING (EAS dev build by user) | PENDING (EAS dev build by user) |
| WatermelonDB decorated field writes/reads | PENDING (EAS dev build by user) | PENDING (EAS dev build by user) |
| WatermelonDB persists across relaunch | PENDING (EAS dev build by user) | PENDING (EAS dev build by user) |

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
