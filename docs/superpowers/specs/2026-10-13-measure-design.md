# Measure tool — design

**Status:** approved in conversation 2026-10-13; awaiting written-spec review.
**Builds on:** `2026-10-12-tactical-map-architecture-design.md`, `2026-10-13-lines-design.md`.
**Mockup:** "Landscape — Map (Measure active)" (user-supplied, 2026-10-13). The "2-1 → HOS-1" names are not needed.

## 1. Intent

A quick, throwaway measurement of distance and direction from one location to another — e.g.
from a friendly (or the user) to a target, or between two targets. Points are set with the
crosshair or by tapping the map; tapping a unit, a point or the user's own marker snaps to its
exact coordinate.

Success: with MEASURE on, a user taps their own marker, then taps HOS-1, and reads
`1.29 km · 039° GRID` (in their angle unit and north reference); tapping HOS-2 next moves the end
there while the start stays on them.

## 2. Decisions (from the conversation)

| Topic | Decision |
|---|---|
| Form | A map mode with a small floating card and a map layer — not a panel menu (the map stays unobstructed). |
| Workflow | Live end at the crosshair: first tap / Set fixes the start; the end then follows the crosshair until a tap / Set fixes it; after that a tap / Set moves the end, the start stays. |
| Snapping | Units, points (any `kind = 'point'` item) and the user's own location marker. Lines do not snap (tap location is used). |
| Direction | From start to end, using the app's angle unit (deg/mil) and north reference (true/grid/magnetic) via `describeVector`. |
| Saved | Never. Nothing is written to the mission. |

## 3. Behavior

### 3.1 Mode

- Toolbar: **UNIT · POINT · LINE · MEASURE · LAYERS**. MEASURE icon `ruler`; highlighted while on.
- Turning MEASURE on closes any open menu (the stack is cleared) and starts an empty measurement.
- Turning it off — MEASURE again or the card's **×** — clears the measurement.
- Opening any menu (another tool, Menu, Settings, a Layers row…) turns measuring off.

### 3.2 Steps

State: `start: LatLon | null`, `end: LatLon | null` (null = following the crosshair).

| State | Map tap / snap at `p` | **Set** (crosshair `c`) | **From me** (GPS `g`) |
|---|---|---|---|
| No start | start = p | start = c | start = g |
| Start, end live | end = p | end = c | start = g |
| Start and end | end = p | end = c | start = g |

- The live end is the camera center (`useInteraction.cameraCenter`), so it follows panning.
- **Restart** clears both points (back to "No start").
- While measuring, a tap on a unit/point or the self marker snaps instead of opening a menu;
  long-press does nothing; line drawing and item menus are not reachable (menus are closed).

### 3.3 Readout

`describeVector(start, end ?? cameraCenter, { unit, ref, declinationOverrideDeg, date })` →
`"<distanceLabel> · <bearingLabel> <refLabel>"`, e.g. `1.29 km · 039° GRID`. With no start the card
reads **Set start** and no line is drawn.

## 4. UI

### 4.1 Card — `MeasureCard`

Top-left in the `MapTopLeft` stack (below the Mapbox logo row, as in the mockup), in the
`surface-chrome` style with an `accent` border:

- Label **MEASURE** (accent, uppercase) and the readout (large, mono) or **Set start**.
- Buttons: **From me** (disabled without a GPS fix), **Restart** (disabled with no start),
  **×** (turns measuring off), and the amber primary **Set** (crosshair glyph; sets the next
  point at the crosshair as in §3.2).
- Accessibility labels: "From me", "Restart", "Stop measuring", "Set at crosshair".

### 4.2 Map — `MeasureLayer`

One `ShapeSource` (`id="measure"`):

- line start → end: `point-symbol-halo` halo under an `accent` line (3 pt); dashed while the end
  is live;
- start and end dots (white disc with a dark ring, the `line-vertex` image);
- a chip at the geodesic midpoint with the readout text (accent background, dark text — a new
  `label-chip-accent`-based style).

### 4.3 Self-marker snapping

`SelfLayer` gains `onPress?: (at: LatLon) => void`, called with the self position when its icon
is tapped; `MissionMap` passes it only while measuring.

## 5. Code shape

| Unit | Responsibility |
|---|---|
| `src/features/measure/measure-step.ts` | Pure rules of §3.2: `placePoint(m, p)`, `fromMe(m, g)`, `restart()`. |
| `src/stores/measure.ts` | `active`, `start`, `end`; `startMeasure()`, `stopMeasure()`, `place(p)`, `setFromMe(g)`, `restart()`. |
| `src/features/measure/measure-readout.ts` | `measureReadout(start, end, settings)` → label text. |
| `src/features/measure/MeasureCard.tsx` | The card. |
| `src/features/map/layers/MeasureLayer.tsx` | The map layer. |
| `MissionMap.tsx` | Toolbar toggle; routes map taps, item taps and self taps to `place()` while measuring; ignores long-press; turns measuring off when a menu opens. |
| `Toolbar.tsx` | `ToolId` adds `'measure'`, `onMeasure`. |

## 6. Testing

- `measure-step`: every row of the §3.2 table; restart.
- Store: start/stop clear state; actions follow the step rules.
- Readout: uses the angle unit and north reference; "Set start" with no start.
- `MeasureLayer`: no features without a start; dashed while live, solid when fixed; chip text.
- `MeasureCard`: buttons call the right actions; From me disabled without GPS; Restart disabled with no start.
- MapScreen: MEASURE toggles on/off and closes an open menu; a map tap sets start then end; a
  unit tap snaps to the unit and does not open its menu; the live end follows the camera; a
  self-marker tap snaps to the self position; opening Layers turns measuring off; long-press
  does nothing while measuring.

## 7. Out of scope

Saving measurements; more than two points / path length; range rings; snapping to lines;
measuring from inside the Line menu; back-azimuth display.
