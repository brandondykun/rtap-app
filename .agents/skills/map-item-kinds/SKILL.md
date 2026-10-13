---
name: map-item-kinds
description: Use when adding a new kind of map item (line, polygon, route, range ring…) or changing how an existing kind is stored, drawn, created or edited. End-to-end recipe from geometry to menu.
---

# Adding a map item kind

Points are the reference implementation; follow the same path for each new kind.

1. **Kind and geometry** — add the value to `MapItemKind` (`src/lib/db/models/MapItem.ts`; no
   schema change: `kind` and `geometry` are strings). Add (de)serializers and validation to
   `src/features/map-items/geometry.ts` (GeoJSON, WGS84 `[lon, lat]`), with tests.
2. **Commands** — `placeX` in `src/features/map-items/commands.ts`: validate, stamp
   `createdBy`/`updatedBy`, return a `Result`. Reuse `updateItem`, `deleteItem`,
   `setItemHidden`. Use the `data-layer` skill.
3. **Selector** — a cached FeatureCollection builder in `selectors.ts` (cache by
   `id + updatedAt`, one selector per layer instance), with tests.
4. **Layer** — `src/features/map/layers/<Kind>Layer.tsx`: one `ShapeSource`, `LineLayer` /
   `FillLayer` / `SymbolLayer` with module-constant or theme-memoized styles in `styles.ts`,
   hidden items via `hiddenFilter`, `onPress` → open the edit menu. Follow the
   `map-performance` skill.
5. **Images** — generate any icons in `scripts/build-map-images.ts` and register them in
   `MAP_IMAGES`. Stretch values are in points (rnmapbox multiplies by `scale`).
6. **Tool** — add a `ToolId` and a `ToolButton` in `src/features/toolbar/Toolbar.tsx`; the
   active tool is the one whose menu is open.
7. **Draft** — extend `stores/draft.ts` (e.g. a vertex list) and draw it in a draft layer;
   the map follows draft changes from typing/Me/long-press, never from panning.
8. **Menus** — `x.add` / `x.edit` params + components + registry (use the `menus` skill);
   share one form component between add and edit.
9. **Naming** — extend `naming.ts` if the kind gets auto-names.
10. **Tests** — geometry, commands, selector cache, layer props via `mapboxMock()`, menus
    through `MenuHost`, and one `MapScreen` integration test for the tool.

## Categories within the point kind

Units and points share `kind = 'point'`. `itemCategory(sidc)` decides which; never test SIDC
prefixes elsewhere. To add a point type: add a row to `POINT_TYPES` (id, label, prefix, SIDC),
run `npm run build:symbols` (a custom SVG in `scripts/build-symbols.ts` if milsymbol cannot draw
it; point images are padded so the symbol's anchor is the image center), and extend
`point-types.test.ts`. Add/Edit menus are `AddItemPanel` / `EditItemPanel` with a category and a
form (`UnitForm`, `PointForm`) built from `form/LocationSection` and `useAutoName`.

## Worked example: lines

Lines (`kind = 'line'`) follow the recipe end to end: `line-types.ts` (types and styles),
`geometry.ts` (`lineGeometry` / `parseLineGeometry`), `placeLine` / `updateLine`,
`line-selectors.ts` (cached features + end features), `LinesLayer` (halo, solid, dashed, arrows,
FLOT bumps, labels), images in `build-map-images.ts`, `line-draft.ts` + the draft store's
vertices/undo, `DraftLineLayer`, `LineDrawBar`, and `ITEM_ADAPTERS.line` so `AddItemPanel` /
`EditItemPanel` host `LineForm`. New kinds add an adapter rather than new panels.
