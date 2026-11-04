# GPS averaging (Average mode) — design

Date: 2026-11-03. Single repo (`map/`).

## Intent

On a stationary observation post, the phone's GPS fix wanders by a few meters (more under trees or near buildings). The
user's position is the origin of every bearing and distance the app shows to a target, so each jump changes those
numbers although nothing moved. Average mode gives a steady, more accurate origin while the user stays put: it averages
the GPS fixes over time and uses the result as "me" everywhere.

Steadiness matters as much as accuracy: a position that settles and stops twitching is the main win, even where the
accuracy gain is only a meter or two.

## Goals

- A toolbar tool turns Average mode on and off.
- While averaging, the averaged position replaces the live GPS position everywhere "me" is used: the ME readout (grid,
  altitude, accuracy), the distance and bearing from you to the crosshair or a target, the top-left GPS readout, and the
  self dot on the map.
- The readout shows clearly that ME is averaged.
- A conservative, honest accuracy estimate for the averaged position.
- Movement is detected; averaging pauses and the user chooses Resume or Discard.

## Non-goals

- No elapsed-time display (user: not for now).
- No change to the self dot's look on the map (user: keep it the same). It moves to the averaged position; that is all.
- No "plot averaged position" button or saving an averaged point (Option B was not chosen).
- No raw GNSS measurements (Android's raw API); the fused fixes the app already receives are enough.
- No background averaging; foreground only, screen on.
- The Panel keyboard rework on `react-native-keyboard-controller` is a separate project (the library is installed, f9afc5a).

## Anti-goals (would make it a failure even if it "works")

- Showing an averaged position after the user has moved: bearings from a stale origin are the dangerous case.
- Mixing readings taken while moving into the average.
- Claiming precision it doesn't have (e.g. ±0.3 m from √N of correlated fixes).

## Constraints

- Expo SDK 57, RN 0.86. `expo-location` already watches position (highest accuracy) in
  `src/features/location/use-self-location.ts`, publishing `SelfPosition` to the presence store
  (`src/stores/presence.ts`). Everything that uses "me" reads `selfPosition` from there (`use-me-state`,
  `use-readout-origin`, `SelfLayer`, `MissionMap`, `QuickPlotEntry`).
- Manual location source exists: it publishes a hand-set position marked `manual`. Averaging is unavailable while the
  source is Manual.
- `expo-sensors` is installed (f9afc5a) for movement detection; the iOS motion permission text says what it is for.
  Builds older than f9afc5a lack its native code: there, fall back to GPS-only movement detection (never crash).
- Value colors (map/AGENTS.md): amber is reserved for distances. Averaging gets its own color, orange-600, as a
  **state** token (e.g. `averaged`), not a new value kind: it marks that ME is averaged, it doesn't color a value.
  Added to the palette/tokens and documented in AGENTS.md next to the Value colors table as reserved for Average mode.
  (Builder-check call.)
- Readout outline standard: readout text and icons get a 1px outline, no dark backing (like OP mode's amber binoculars
  and "OP").

## What the user decided

- **Start:** a toolbar tool. Starting shows the message "Keep the device still. Averaging gets more accurate over a
  few minutes." every time, closable each time (×), staying up until closed. Averaging starts at once; the message is
  a notice, not a confirmation.
- **Indicator:** while averaging, the ME row's navigation triangle and "ME" tag turn orange (orange-600), outlined with
  no fill (readout outline standard, as OP mode recolors its lead), and the accuracy reads "AVG ±2 m" with "AVG" bold
  in the same orange. The grid stays friendly blue and ALT stays white (value colors unchanged). Works in both the
  portrait (two-line) and landscape (one-line) dock without changing the row's size.
- **Moving:** when movement is detected, averaging **pauses** and the user chooses **Resume** or **Discard**.
  - Readings that could be bad are thrown out: on pause, drop the fixes from just before detection as well.
  - While paused, ME shows the **current live location** (plain ME, no orange).
  - **Discard** shuts Average mode off completely (back to live GPS; start again to average again).
  - **Resume** keeps the cleaned samples and carries on.
- **Map dot:** unchanged in look; it shows the averaged position while averaging, the live one otherwise.
- **Dependencies:** new native build with `expo-sensors` (and `react-native-keyboard-controller`), done.

## How it works (decided in conversation, details left to the builder where noted)

### Averaging

- Each GPS fix while averaging (not paused) is a sample: lat, lon, altitude, reported accuracy, time.
- Reject outliers: fixes with no accuracy or a very large one, and fixes far from the running center (relative to their
  accuracy). Thresholds are the builder's call.
- Weighted mean with weight 1/accuracy² for lat/lon (in a local metric frame), and likewise for altitude where present.

### Accuracy estimate (conservative)

- GPS errors are time-correlated, so fixes are treated as roughly independent only about once a minute: effective
  sample count ≈ minutes of averaging (at least 1).
- Estimate = weighted typical reported accuracy ÷ √(effective count), never below a floor of about 1.5–2 m, and never
  tighter than the actual spread of the accepted samples (if they scatter wider, show the wider number).
- Shown in the accuracy gray as "±N m" after the orange bold "AVG".
- Exact constants (correlation time, floor) are the builder's call within these bounds.

### Movement detection

- Accelerometer (`expo-sensors`) while averaging: sustained motion beyond hand-holding jitter means moving.
- GPS: several consecutive fixes well outside the sample cluster, or a sustained reported speed above about 0.5 m/s.
- Either signal pauses averaging. On pause, drop samples back to the last moment the phone was confirmed still
  (accelerometer), or about the last 15 s when that isn't known.
- If the accelerometer is unavailable (old build, no sensor, permission refused), use GPS alone.
- Thresholds and debouncing are the builder's call; holding the phone in hand must not trigger a pause.

### Paused state

- Haptic plus a sticky banner: "You moved — averaging paused", with Resume and Discard.
- ME shows live GPS, plain (no orange) until Resume.

### Where it plugs in

- The presence store's `selfPosition` is the single source of "me". While averaging (not paused), what is published
  there is the averaged position, its estimated accuracy and averaged altitude, marked as averaged (e.g. `averaged:
  true`, alongside the existing `manual`), so every consumer follows without changes beyond reading that flag for the
  indicator. While paused or off, the live fix is published as today.
- Average-mode state (off / averaging / paused, samples) lives in its own small store; the averaging math is pure
  functions with unit tests.

### Toolbar and other modes (calls made after the builder check)

- AVG is a **toggle that runs alongside the tools** (like LABELS and 3D), not an exclusive `activeTool`: picking
  POINT, MEASURE, PLOT and so on must not end averaging, since a steady origin is what those need. Unlike LABELS/3D it
  is lit while on, so its state is visible.
- **OP mode:** averaging keeps running. While OP is on, the ME row shows the OP as today (no AVG indicator there);
  leaving OP mode brings the averaged ME row back.
- **Switching the location source to Manual** turns Average mode off.

## Left to the builder

- Toolbar icon and label (short, fits the toolbar, e.g. "AVG"); its active look follows the other tools.
- Exact outlier, motion and accuracy constants within the bounds above.
- Wording of the paused banner beyond the gist above, and of the toolbar help entry; About screen gets a short
  explanation of Average mode.
- Whether the top-left GPS readout (portrait card) shows the same orange "AVG" treatment as the dock (it should agree
  with the dock).
- What happens if the app goes to the background while averaging (pausing is the safe default).
