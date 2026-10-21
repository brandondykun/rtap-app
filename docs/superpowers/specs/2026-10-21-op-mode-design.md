# OP mode

## Goal

Let a user stand at an observation post (OP) and look at the 3D map as if they were there. The camera
stays fixed at the OP; swipes turn the view, a pinch magnifies it, and taps on map items still open
their menus. One tap leaves OP mode and the map works as before.

Validated on device by the throwaway `spike/op-mode` branch (free camera, swipe-to-look, ground
refresh, haze range). This spec turns that spike into the real feature on `main`.

## What the user sees

### Starting OP mode

- **OP** is always in the toolbar (icon `binoculars`, label `OP`), after `3D`. It is a tool: it
  highlights while choosing an OP and while in OP mode. Pressing it while active cancels picking or
  exits OP mode.
- Pressing it closes any open menu and ends measuring, placing and quick plot, like UNIT/POINT.
- The map then waits for the OP, with the same bar UNIT/POINT use (`PlaceBar`: "Tap map", CTR,
  Cancel). The OP is set by:
  - **CTR**: the crosshair (map center).
  - **A tap on the map**: the tapped spot.
  - **A tap on a map item**: a unit or point stakes at the item itself; a line or polygon at the tapped
    spot.
  - **A tap on the user's location icon**: the user's position at that moment.
- Setting the OP turns 3D on if it is off, and enters OP mode.

### In OP mode

- The camera sits at the OP, **eye height** above the ground as drawn (default 10 m), looking the way
  the map faced, tilted 80°.
- **One-finger swipe** turns the view: right turns right, down looks up (tilt 0–85°; Mapbox cannot look
  above the horizon). The camera never leaves the OP.
- **Pinch** magnifies the view 1×–3×, like binoculars: the OP does not move and the crosshair stays
  centered. It enlarges what Mapbox drew, so it softens past about 2×. (Mapbox has no field-of-view
  setting; moving the eye forward would move the OP and can push it into a hill.)
- Map pan, pinch-zoom, rotate and two-finger tilt are off.
- **Taps on map items open their menu** as usual; nothing moves the camera while in OP mode (panel
  padding, draft follow, fits, recenter, North).
- **OP bar** at the bottom (in the bar spot `PlaceBar` uses):
  - Eye height slider, 5–250 m, labeled `Eye 10 m` (in the user's altitude unit).
  - Where the view faces, in the user's angle unit and north reference (e.g. `045° GN`).
  - `2.0×` while magnified above 1×.
  - **Exit**.
- **Readout (CTR row)**: the crosshair's grid as now; distance and direction are measured **from the
  OP** instead of from the user, with `FROM OP` shown so it is clear. When the OP was staked at the
  user's location, that is the same as from the user at the moment of staking. The OP does not follow
  the user afterwards.
- Terrain uses the same height as 3D (see Terrain height). Haze is fixed at the spike's "mid" range,
  `[2, 20]` (normal 3D keeps `[0.8, 8]`).
- The ground under the OP is re-read about once a second while in OP mode and the camera re-placed if
  it changed (terrain detail under the OP changes as tiles load; without this the camera can dip under
  the surface and the terrain flickers).

### Leaving OP mode

- **Exit**, the OP toolbar button, or turning 3D off leaves OP mode: map gestures come back, the
  magnification resets to 1×, and the map eases to normal 3D over the OP (zoom 15, 3D tilt, facing
  where the user was looking). Turning 3D off then flattens it as usual.
- OP mode is never saved: the app always opens in normal mode. The mission camera is not saved
  while in OP mode.

## Terrain height

- New persisted setting `terrainExaggeration: number`, default `1.5`, valid `1`–`3` (finite; invalid
  persisted values keep the default). Not shown in Settings yet; a picker can be added later without
  other changes.
- `terrainExaggeration(threeD)` in `terrain/three-d.ts` becomes `threeD ? setting : 1`, read from the
  settings store. 3D and OP mode both use it.
- Unit elevation lookups keep dividing out the current exaggeration, so saved elevations stay true.
- The OP camera altitude is the **drawn** ground (the raw `queryTerrainElevation` answer, which already
  includes the exaggeration) plus the eye height, so the eye is always that far above the surface the
  user sees.

## Architecture

### Native: free camera (patch to `@rnmapbox/maps`)

Extend `patches/@rnmapbox+maps+10.3.8.patch` (already patched for the attribution tint):

- `src/specs/NativeMapViewModule.ts`: `setFreeCamera(viewRef, values: [lon, lat, altitudeM, pitch,
  bearing])`.
- iOS: `RNMBXMapViewModule.mm` export + `RNMBXMapView.setFreeCameraWithValues` (the spike's code:
  `mapboxMap.freeCameraOptions`, `location`, `altitude`, `setPitchBearingForPitch`).
- Android: `NativeMapViewModule.setFreeCamera` using the Android SDK's `FreeCameraOptions`
  (`setLocation(Point, altitude)`, `setPitchBearing`). Built, not device-tested (Android testing is
  skipped project-wide).

JS wrapper `src/features/map/op/free-camera.ts`: `setFreeCamera(map, { at, altitudeM, pitch, bearing })`
calls the map view's `_runNative('setFreeCamera', …)` and swallows errors from a map that has gone away.
Needs a native rebuild.

### State: `src/stores/op.ts` (memory only)

```ts
type OpPhase = 'off' | 'picking' | 'on';
type OpValues = {
  phase: OpPhase;
  at: LatLon | null;      // the staked OP
  groundM: number | null; // drawn ground at the OP (includes exaggeration)
  eyeM: number;           // 5..250, default 10
  bearing: number;        // 0..360
  pitch: number;          // 0..85, default 80
  zoom: number;           // 1..3 magnification
};
// Actions: startPicking(), cancel(), stake(at, bearing), setGround(m), look(dBearing, dPitch),
// setEye(m), setZoom(z), exit(). All clamp their inputs.
```

### Map wiring

- `src/features/map/op/` holds the OP pieces: `free-camera.ts`, `use-op-camera.ts` (places the camera
  when the view changes, at most once per frame; refreshes the ground each second; reads the ground on
  stake), `OpGestures.tsx` (wraps the map), `OpBar.tsx`.
- **Gestures**: `OpGestures` wraps `MapCanvas` in a `GestureDetector` with a Pan and a Pinch, enabled
  only while `phase === 'on'`. MapCanvas turns its own pan/zoom/rotate/pitch off in OP mode. Because
  the map itself is not covered, its own tap handling (item `ShapeSource` presses, blank-map press,
  the self icon) keeps working. The pinch scales the wrapper (Reanimated) around the screen center;
  touches pass through the transform, so taps still land on the right item.
  - **Fallback** if taps do not reach the map under the wrapper on device: a Tap gesture in
    `OpGestures` that queries the item layers at the (unscaled) point with `queryRenderedFeaturesAtPoint`
    and calls the same item handler.
- **Camera guard**: `moveCamera` and `fitCamera` in `MissionMap` do nothing while `phase === 'on'`.
  On staking, one zero-padding, zero-duration `setCamera` clears panel padding before the free camera
  is set. `onCameraIdle` does not save the mission camera while in OP mode.
- **Picking**: `onMapPress`, `onItemPress` and the self icon's press stake the OP while
  `phase === 'picking'` (checked before placing/measuring, which picking has already ended).
- **Crosshair** stays at the screen center in OP mode (the free camera ignores panel padding).
- **Readout**: `describeReadout(center, from, …)` takes the point to measure from; `ReadoutDock` and
  `CenterCard` pass the OP while in OP mode and show `FROM OP`.
- **MapCanvas**: terrain exaggeration from `terrainExaggeration(threeD)`; Atmosphere range `[2, 20]`
  in OP mode.
- **Toolbar**: `OP` ToolButton after `3D`; `activeTool` gains `'op'`; `TOOLBAR_HELP` gains OP
  ("Look out over the 3D map from a spot you pick.", group `read`).

### Exit

`exit()` sets `phase: 'off'`, `zoom: 1`; `MissionMap` then eases the normal camera to `{ center: OP,
zoom: 15, pitch: THREE_D_PITCH, heading: bearing }`. Turning 3D off while in OP mode exits first.

## Testing

Jest (mapbox mock gains `__map._runNative`, `queryRenderedFeaturesAtPoint`):

- `stores/op`: phases, clamping (eye 5–250, pitch 0–85, zoom 1–3, bearing wraps), exit resets zoom.
- `stores/settings`: `terrainExaggeration` default, persistence, invalid persisted values.
- `terrain/three-d`, `elevation`: exaggeration from the setting; elevation divides it out.
- `use-op-camera`: stake reads the ground and places the camera at drawn ground + eye; look/eye
  changes re-place it; ground refresh re-places only on change; nothing after exit.
- `OpGestures`: pan turns/tilts in the right directions; pinch clamps 1–3; disabled when not on.
- `OpBar`: eye label in m/ft, facing label in deg/mil and north ref, zoom label only above 1×, Exit.
- `readout`: distance/direction from a given point.
- `MapScreen`: OP button → picking bar; CTR, map tap, item tap (unit at the item, line at the tap) and
  self tap each stake; staking turns 3D on; a menu opening in OP mode does not move the camera; item
  tap opens its menu; Exit eases back; 3D off exits; OP button active state.
- Toolbar and help: OP button order and help entry.

On device (iOS): smooth turning, taps open menus, pinch quality, no terrain flicker at 5 m, readout
from the OP, exit back to normal.

## Build order (risk first)

1. Native patch + `setFreeCamera` wrapper + `OpGestures` wrapping the map with taps still reaching items
   — checked on device before the rest (fallback above if taps are swallowed).
2. Store, camera placement, ground refresh, terrain setting.
3. Picking flow and toolbar button.
4. OP bar, readout from the OP, pinch magnification.
5. Exit and guards.

## Out of scope

- A list of saved OPs; an OP that follows the user as they move.
- Line of sight / visibility analysis.
- A Settings picker for terrain height (the setting exists; the UI comes later).
- Looking above the horizon (Mapbox limit).
- Android device testing.

The `spike/op-mode` branch is deleted when implementation starts.
