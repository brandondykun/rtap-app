<p align="center">
  <img src="assets/images/icon.png" alt="RTAP app icon" width="128" height="128" />
</p>

# RTAP

**Realtime Team Awareness Platform**: an offline-first tactical map for iOS. Plan missions on satellite,
hybrid or topo maps, place MIL-STD-2525C units and control points, draw lines and areas, read MGRS grids, measure,
and look out from an observation post in 3D.

> Training and simulation only. Not for real-world military use or targeting.

## Stack

- Expo SDK 57 and React Native 0.86, with Expo Router (routes in `src/app/`)
- `@rnmapbox/maps` 10.3.8 (Mapbox Maps SDK 11), patched in `patches/` for OP mode's camera
- WatermelonDB on SQLite for missions and map items
- Zustand for app state; settings and profile saved to `expo-sqlite/kv-store`
- NativeWind (Tailwind) styling over semantic theme tokens in `src/theme/`
- Jest (`jest-expo`) and React Native Testing Library

## Getting started

1. Install dependencies (this also applies the Mapbox patch):

   ```bash
   npm install
   ```

2. Add your Mapbox public token to `.env` (git-ignored):

   ```bash
   EXPO_PUBLIC_MAPBOX_TOKEN=pk.…
   ```

   Without it the map shows a "missing token" screen. After changing it, restart Metro with `npx expo start --clear`.

3. The app uses native modules, so it runs in a development build, not Expo Go. Build one with EAS (or locally with
   `npx expo run:ios`), install it, then start Metro:

   ```bash
   npx eas-cli@latest build --profile development --platform ios
   npx expo start
   ```

   A new development build is needed whenever a native library or native config changes.

## Checks

Run all three before calling a change done:

```bash
npx tsc --noEmit        # typecheck
npx expo lint           # must report 0 problems
npx jest                # the full test suite
```

Do not run Prettier over the repo.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Routes only (Missions, a mission's map, create and rename, About) |
| `src/features/` | Feature code: `map`, `map-items`, `missions`, `menus`, `toolbar`, `measure`, `quick-plot`, `symbology`, `profile`, … |
| `src/components/` | Shared UI (`ui/`) and the menu building blocks (`menu/`) |
| `src/lib/db/` | Database schema, migrations, models, command context and sync configuration |
| `src/lib/geo/` | Coordinates, MGRS, north references and measurement; the only place geodesy libraries may be imported |
| `src/lib/identity/` | The per-install device id and the callsign rules |
| `src/stores/` | Zustand stores (settings, profile, presence, interaction, menus, drafts, …) |
| `src/theme/` | Color palette and semantic tokens; no hex colors anywhere else |
| `docs/superpowers/specs/` | Design specs, starting with the architecture (`2026-10-12-tactical-map-architecture-design.md`) |
| `.claude/skills/` | Project conventions: commits, data layer, menus, styling, map performance and more |

`npm run build:map-images` regenerates the map's position icons and label chip in `assets/map/` from the theme tokens.

## Data and future sharing

The data layer is built so team sharing can be added on top later:

- Records get UUIDs on the phone, and every write goes through a command that stamps who made it and when.
- Deletes keep a tombstone, so they can sync.
- Missions and map items are the synced tables (`src/lib/db/sync-config.ts`). Per-phone state (hidden items, the
  saved camera, mission pictures) stays local.
- Migrations only add steps. Item types and style details from a newer app version are ignored or kept, never
  overwritten.
- Live positions are kept in memory (`stores/presence`), never in the database.
- The callsign lives in the on-phone profile, not in records. Records carry ids, and names are looked up from them.

## Releases and over-the-air updates

Builds use EAS. Each build profile has its own update channel:

| Profile | Channel | Use |
| --- | --- | --- |
| `development` | `development` | Development builds with Metro |
| `preview` | `preview` | Internal test builds |
| `production` | `production` | App Store builds |

The runtime version uses the **fingerprint** policy, so an update only reaches builds with matching native code.
Changes to native code (a new native library, new permissions) need a new build instead.

```bash
npx eas-cli@latest build --profile preview --platform ios                      # internal test build
npx eas-cli@latest update --channel preview --environment preview --message "…"   # ship JS changes to it
npx sentry-expo-upload-sourcemaps dist                                          # then, every time, upload its source maps
```

Phones download updates in the background and apply them the next time the app opens. The About page shows which
channel and update a phone is running. Cloud builds don't read `.env`, so set `EXPO_PUBLIC_MAPBOX_TOKEN` as an EAS
environment variable.

### Crash reporting (Sentry)

Preview and production builds report crashes and errors to the `rtap` project in the `eratas-software-llc` Sentry
org. Development builds report nothing. Reports are grouped by channel (the Sentry environment) and tagged with the
update id, and they never carry personal data or positions: grids and lat/longs in messages are redacted
(`src/lib/monitoring`).

- `EXPO_PUBLIC_SENTRY_DSN` is set in every EAS environment. It's public and safe to ship in the app.
- `SENTRY_AUTH_TOKEN` (one org auth token, sensitive EAS variable, all environments) lets EAS builds upload source
  maps and debug symbols automatically.
- An update's source maps are uploaded by hand: run `npx sentry-expo-upload-sourcemaps dist` right after
  `eas update`, with `SENTRY_AUTH_TOKEN` in your shell. Without it, errors from that update show unreadable stack
  traces.
- If a local release build (`npx expo run:ios --configuration Release`) fails at the Sentry upload step, set
  `SENTRY_AUTH_TOKEN` or `SENTRY_DISABLE_AUTO_UPLOAD=true`.

## Conventions

- Work on a feature branch off `main`. Merges are fast-forward only.
- Commit messages follow Conventional Commits (see `.claude/skills/commits`), with no attribution trailers.
- Use single quotes. Colors come from theme tokens.
- Install packages with `npx expo install <package>`.
