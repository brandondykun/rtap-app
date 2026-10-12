---
name: map-performance
description: Use whenever you add or change anything rendered on the map (layers, sources, images, camera code, map overlays, readouts) or anything that re-renders while the map moves. The map must stay smooth with thousands of items.
---

# Map performance

The map is the product (spec §2, §8.8). Check every map change against these rules.

## Rules
1. **No per-item React components on the map.** Items render through one `ShapeSource` per
   kind with `SymbolLayer`/`LineLayer`s. Never `PointAnnotation` or `MarkerView` per item.
2. **The camera is uncontrolled.** Never pass `centerCoordinate`/`zoomLevel` props to
   `Camera` from React state. Initial camera = `defaultSettings`; moves = `cameraRef.current.setCamera(...)`.
3. **Stable style references.** Layer styles are module constants, or `useMemo` per theme
   (`makePointLabelStyle(colors)`). A new style object every render re-applies native styles.
4. **Hide with filters, not data.** Visibility uses `hiddenFilter(ids)` on the layer `filter`;
   the source's FeatureCollection is not rebuilt to hide items.
5. **Selectors cache features.** `createPointFeatureSelector()` reuses features by
   `id + updatedAt`; create one selector per layer instance (`useMemo`).
6. **High-frequency values are isolated.** Camera center/zoom/bearing flow through
   `createLatestThrottle` into `useInteraction`; only small leaf components (readout, north
   needle) subscribe. Heading updates are throttled (≈10 Hz, ≥2°). Never subscribe a screen
   or layer to `cameraCenter`.
7. **No map remounts.** Orientation changes re-layout chrome only; `MapCanvas` stays mounted.
8. **Images are registered once** (`MAP_IMAGES`, module constant) and referenced by name.

## Before merging map changes
- `npx jest src/features/map` passes (style-stability and filter tests included).
- On a physical device (development build): open **Seed 5k** on the missions screen (dev
  builds only) and pan/zoom/rotate for 30 s in portrait and landscape. Panning must stay
  smooth with no visible hitching; record the result in the PR or gate notes.
