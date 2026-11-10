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
- PowerSync (local-only tables on SQLite) for missions and map items
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

3. The app uses native modules, so it runs in a **development build** (the **RTAP (D)** app), not Expo Go. Build
   one and install it on your phone (see [Making builds](#making-builds)):

   ```bash
   npx eas-cli@latest build --profile development --platform ios
   ```

4. Start the dev server, then open RTAP (D) on your phone and pick the server, or scan the QR code with the
   camera:

   ```bash
   npx expo start --dev-client
   ```

   The phone must be on the same Wi-Fi as your Mac. Code changes reload instantly. Useful variations:

   ```bash
   npx expo start --dev-client --clear    # after changing .env or when Metro acts stale: clear its cache
   npx expo start --dev-client --tunnel   # when the phone can't reach your Mac over Wi-Fi
   ```

   You only need a new development build when native code changes (see [Build or update?](#build-or-update)).

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
| `src/lib/db/` | PowerSync schema, the AppDb SQL seam, command context and sync configuration |
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
- Deletes are real deletes on the device; tombstones will live on the server.
- Missions and map items are the synced tables (`src/lib/db/sync-config.ts`). Per-phone state (hidden items, the
  saved camera, mission pictures) stays local.
- Schema changes only add columns. Item types and style details from a newer app version are ignored or kept, never
  overwritten.
- Live positions are kept in memory (`stores/presence`), never in the database.
- The callsign lives in the on-phone profile, not in records. Records carry ids, and names are looked up from them.

## Builds, updates and releases

Everything is built in the cloud with EAS (no Xcode needed). Run every command below from the repo root.

### The three apps

Each build profile makes its own app with its own bundle id, so all three install side by side on one phone. Each
keeps its own data: missions in RTAP (D) never show up in RTAP (P) or RTAP.

| Profile / channel | App on the phone | Bundle id | What it's for |
| --- | --- | --- | --- |
| `development` | RTAP (D) | `com.eratas.rtap.dev` | Day-to-day coding. Loads JS from your Mac's dev server. |
| `preview` | RTAP (P) | `com.eratas.rtap.preview` | Testing a real, standalone build before release. Gets OTA updates. |
| `production` | RTAP | `com.eratas.rtap` | The App Store app. Gets OTA updates. |

The About page shows which channel and update the app is running: `preview · built-in` means the code that came with
the build, `preview · update 01a175db` means a downloaded update. The development app shows just `built-in`.

### Build or update?

- **Only JavaScript/TypeScript, styles or images changed** → publish an **over-the-air (OTA) update**. Takes a
  couple of minutes; phones pick it up without reinstalling.
- **Native code changed** → make a **new build** and reinstall. That means: a package added with native code, an
  Expo SDK upgrade, anything in `app.json` / `app.config.ts` (plugins, permissions, icon, name), `eas.json`, the
  `patches/` folder, or even the `scripts` block of `package.json`.

You don't have to guess. The app's runtime version is a **fingerprint** of its native code, and an update only
reaches builds with the same fingerprint. `scripts/ota-update.sh` checks this and refuses with "Native code has changed"
when a new build is needed.

### Making builds

Commit your changes, then run `scripts/build.sh`. It asks for the profile and platform (press 1, 2 or 3) and an
optional message, shows the command and starts the build once you confirm. Along the way it:

- Refuses to run with uncommitted changes, like the update script, so every build matches a commit.
- Compares your code's fingerprint with the latest finished build of that profile and platform. If they match, the
  build would install the same native app, so it warns and asks before using up a build (ship JS changes with
  `scripts/ota-update.sh` instead).
- For production, asks whether to submit the build to the store when it finishes (`--auto-submit`).

The commands it runs:

```bash
npx eas-cli@latest build --profile development --platform ios   # RTAP (D)
npx eas-cli@latest build --profile preview --platform ios       # RTAP (P)
npx eas-cli@latest build --profile production --platform ios    # RTAP, for the App Store
```

- Run these in your own terminal: the first build of each app asks you to sign in to Apple to create its App ID and
  provisioning profile.
- To put the phone on a development or preview build, open the install link (or QR code) EAS prints at the end on the
  phone. A phone must be registered with the Apple account to install these internal builds; add one with
  `npx eas-cli@latest device:create` and then build again.
- Production builds go to the App Store, not straight to a phone. Send the latest one to App Store Connect / TestFlight
  with `npx eas-cli@latest submit --platform ios --latest`.
- Build numbers count up automatically (`appVersionSource: remote`). Change the version shown in the store (`1.0.0`)
  in `app.json`.
- Builds take their environment variables from EAS, never from your `.env` (see
  [Environment variables](#environment-variables)).

### Publishing an over-the-air update

Commit your changes, then:

```bash
scripts/ota-update.sh preview "Fix the grid readout"       # to RTAP (P)
scripts/ota-update.sh production "Fix the grid readout"    # to the App Store app
```

`scripts/ota-update.sh` does it in this order, and stops at the first problem:

1. Checks you gave a message and have no uncommitted changes, so every update matches a commit.
2. Compares your code's fingerprint with the latest build on that channel. If they differ, it stops and tells you to
   build instead, because no phone could run the update.
3. **`eas update --channel <channel> --environment <channel> --platform ios`** bundles the app into `dist/` and
   publishes it. The channel decides which app receives it; the environment supplies that app's EAS variables
   (`APP_VARIANT`, Mapbox token, Sentry DSN). They must always match, or the update gets the wrong fingerprint and
   silently reaches nobody. The script guarantees that.
4. **`eas env:exec <channel> 'npx sentry-expo-upload-sourcemaps dist'`** uploads the source maps from that
   `dist/` to Sentry, so crash reports from this update show your real file names and line numbers instead of
   minified code. `env:exec` runs the command with the channel's EAS variables, which is how it gets
   `SENTRY_AUTH_TOKEN` without the token ever being on your machine. (Builds upload their own source maps; only
   updates need this step.)

**Getting it onto the phone:** apps check for an update when they open and download it in the background. It runs on
the next launch. So: force-quit the app and open it (it downloads), then force-quit and open it again (it runs). The
About page then shows `update <id>`.

**Test on preview first.** Publish to preview, check it on RTAP (P), then publish the same commit to production.

### Release branches

The store app is built and updated only from a release branch; new work (the cloud version) happens on `main`.
`scripts/build.sh` and `scripts/ota-update.sh` refuse production from any other branch.

| Branch | What goes there | Ships to |
| --- | --- | --- |
| `main` | New features | development, preview |
| `feat/<name>` (optional) | One larger feature while it is unfinished | development, preview |
| `release/1.x` | Fixes for the app in the store | production (and preview, to test a fix) |

Changes only flow towards `main`: feature branches into `main`, release fixes into `main`. Nothing goes from `main`
into a release branch once that version has shipped.

**New features.** Small changes can be committed straight to `main`. A larger one (several days, or broken along the
way) goes on `git switch -c feat/<name>` from `main` and merges back fast-forward when done (rebase it on `main`
first if `main` has moved), so `main` always works and can be published to preview.

**Shipping a version.** Until a version first ships, everything on `main` is meant for it, so bring the release branch
up to date right before the build: `git switch release/1.x && git merge main`. Make the production build there, then tag
the commit it was built from, e.g. `git tag v1.0.0`. A tag marks every commit that became a store build. From then on,
`main` moves on to the next version and the release branch only gets fixes.

**Fixing a bug in the store app.**

1. `git switch release/1.x`, fix it and commit.
2. Publish to preview and check it on RTAP (P), then publish the same commit to production (see above).
3. Bring the fix into `main`: `git switch main && git merge --no-ff release/1.x`. This is a merge commit, not a
   fast-forward (`main` has moved on), so git knows the fix is in `main` and the history shows where it came from.
   Fix on the release branch first, never the other way round, so `main`'s new work never ends up in the store app
   by accident.

A fix that needs native code is a new build: raise `version` in `app.json` (1.0.0 → 1.0.1) on the release branch,
build, tag `v1.0.1`.

**Testing a fix on preview.** A fix reaches only builds with its fingerprint. While `main` has the same native code as
the release, RTAP (P) gets release fixes. Once `main` adds native code, make a preview build from `release/1.x` before
testing a fix there (RTAP (P) then runs the release until you build preview from `main` again).

**The next version.** When `main` is ready to ship (e.g. 2.0 with sync), branch `release/2.x` from it and build
production there. Fixes for 1.x stop then: 2.0 adds native code (accounts, purchases), so its updates can't reach 1.x phones, which get
2.0 from the store.

**Pushing.** Push the release branch and tags along with `main`: `git push -u origin main release/1.x --tags`.

### Undoing a bad update

```bash
npx eas-cli@latest update:list --branch production --platform ios        # find the group id of the last good update
npx eas-cli@latest update:republish --group <group-id> --message "Roll back"   # make it the newest again
npx eas-cli@latest update:roll-back-to-embedded --channel production --platform ios   # or go back to the build's own code
```

Phones pick up a rollback the same way as any update (two launches).

### Environment variables

Builds and updates read these from **EAS** (expo.dev → project → Environment variables), set separately for each
environment. Your local `.env` is only for the dev server and is git-ignored.

| Variable | Environments | What it does |
| --- | --- | --- |
| `APP_VARIANT` | each env = its own name | Picks the app's name and bundle id in `app.config.ts`. Never change it. |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | all, and `.env` | The map. Missing → "missing token" screen. |
| `EXPO_PUBLIC_SENTRY_DSN` | all, and `.env` | Where crash reports go. Public, safe in the app. |
| `SENTRY_AUTH_TOKEN` | all (sensitive) | Lets builds and `env:exec` upload source maps. Never in `.env` or code. |

### Crash reporting (Sentry)

Preview and production apps report crashes and errors to the `rtap` project in the `eratas-software-llc` Sentry
org. RTAP (D) reports nothing. Reports are split by environment (`preview` / `production`) and tagged with
`expo-update-id`, so you can tell which update an error came from. They never carry personal data or positions: no
session replay or console logs are sent, and grids and lat/longs in messages are replaced with `[grid]` and `[coord]`
(`src/lib/monitoring`). The Sentry project setting **Prevent Storing of IP Addresses** must stay on; otherwise
Sentry works out a city from each report's IP address.

### Command cheat sheet

| I want to… | Run |
| --- | --- |
| Start coding | `npx expo start --dev-client` |
| Start with a clean cache | `npx expo start --dev-client --clear` |
| Build the dev / preview / store app | `scripts/build.sh` |
| Ship JS changes to testers | `scripts/ota-update.sh preview "message"` |
| Ship JS changes to the store app | `scripts/ota-update.sh production "message"` |
| Send a store build to App Store Connect | `npx eas-cli@latest submit --platform ios --latest` |
| See recent builds | `npx eas-cli@latest build:list --platform ios` |
| See recent updates | `npx eas-cli@latest update:list --branch <preview\|production>` |
| Register a new iPhone for internal builds | `npx eas-cli@latest device:create` |
| Check EAS variables | `npx eas-cli@latest env:list --environment <development\|preview\|production>` |
| Build locally instead of on EAS | `APP_VARIANT=development npx expo run:ios` (makes RTAP (D)) |

## Conventions

- Small changes go straight to `main`; larger ones on a `feat/<name>` branch off `main`, merged fast-forward only. The
  one exception: release fixes come into `main` as a merge commit (see [Release branches](#release-branches)).
- Commit messages follow Conventional Commits (see `.claude/skills/commits`), with no attribution trailers.
- Use single quotes. Colors come from theme tokens.
- Install packages with `npx expo install <package>`.
