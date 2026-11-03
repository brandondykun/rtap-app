This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

Jest runs with `maxWorkers: "40%"` (package.json). Each test database is a real PowerSync SQLite with its own worker threads, so Jest's default (cores − 1) oversubscribes the CPU: tests time out at random and the suite runs slower. Don't raise it to fix speed.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Value colors

Each kind of value keeps one color everywhere it shows: on the map, in the readouts, cards, forms, lists and bars. Users read a value's kind from its color, and heights are always called ALT or Altitude, never elevation, so a new screen must follow this, and the About page explains it ("Reading the colors").

| Value | Token | Color | Examples |
| --- | --- | --- | --- |
| Friendly grid | `friendly` | sky blue | ME, your manual position, friendly units' grids |
| Any other grid | `text` | white | CTR, the OP, hostile, neutral and unknown units, points, shapes |
| Distance | `value-distance` | amber | range to CTR or an item, measure, line segments and totals, radius, perimeter |
| Direction | `value-bearing` | white | bearings in degrees or mils, with their north reference |
| Altitude | `value-altitude` | white, always prefaced ALT | ALT (yours, the OP's, units' and points'), the OP eye height, ceilings (↕ ft) |
| Accuracy | `value-accuracy` | muted gray | the GPS ± |

- Use the tokens, not the palette: `VALUE_TEXT_CLASS[kind]` / `VALUE_TOKEN[kind]` and `gridTextClass(friendly)` from `src/theme/value-colors.ts`, or `DataCell`'s `kind`, `MenuVertexRow`'s `detailKind`. On the map, chips with both a distance and a bearing carry them as separate `distance`/`bearing` properties so `makeRangeLabelStyle` colors each.
- In cards and forms, color the number only: its label (DIST, ALT) and small unit stay muted. In the readouts, bars and map chips the whole value is colored, its unit and short label (ALT) included. A missing value (—) stays muted. Values not in the table (area, counts, the G-M angle) stay in the normal text color.
- Never use these colors for anything else, and never use an affiliation color (red, green, yellow) for a value. Amber is also the app's highlight (selected tab, active tool, primary buttons), so a distance never sits on an amber fill.
- Labels and units still name every value, so color is never the only cue.
- Changing a color or adding a kind: update `tokens.ts`, `semantic-token-names.json`, `VALUE_COLOR_GUIDE` (the About page) and this table together.
