# Polygons — design

**Status:** approved in conversation 2026-10-13; awaiting written-spec review.
**Builds on:** `2026-10-12-tactical-map-architecture-design.md`, `2026-10-13-lines-design.md`.

## 1. Intent

Users draw military areas — objectives, assembly areas, engagement areas, fire-control areas —
either point by point (like a line, but closed) or as a circle from a center and a radius. Each
has a name and one of 10 types, can be viewed, edited, hidden, found in Layers and deleted, in the
same panel style as units, points and lines.

Success: a user draws "OBJ IRON" from five typed grids, and "NFA 1" as a 500 m circle around a
tapped center, saves both, finds them in Layers and edits the circle's radius later.

## 2. Decisions (from the conversation)

| Topic | Decision |
|---|---|
| Types | Balanced 10 (table §3.1). |
| Shapes | Any type can be **Points** (≥ 3 points, closed) or **Circle** (center + radius), chosen with a Shape switch in the menu. |
| Look | Friendly blue outline with a dark halo (like lines) plus a light translucent blue fill; fire-control areas dashed; label chip at the center. |
| Circle input | Center like a point (map tap, Center, typed MGRS); radius typed (m/km) or set by tapping the map at the edge. |
| Storage | One kind `polygon`; geometry is always a real closed GeoJSON Polygon (a circle is stored as a 64-sided ring); the circle's exact center and radius are kept in `style`. No schema change. |
| Tapping | The outline and the label open a saved polygon; taps inside the fill reach the map (a big area never blocks the units inside it). |

## 3. Data

### 3.1 Polygon types — `src/features/symbology/polygon-types.ts`

```ts
export type PolygonType = 'assembly-area' | 'objective' | 'battle-position' | 'engagement-area'
  | 'named-area-of-interest' | 'target-area-of-interest' | 'free-fire-area' | 'no-fire-area'
  | 'restrictive-fire-area' | 'airspace-coordination-area';
export const POLYGON_TYPES: readonly { id: PolygonType; label: string; prefix: string; dash: 'solid' | 'dashed' }[];
export function polygonLabel(type: PolygonType, name: string): string; // "OBJ IRON" (prefix not repeated)
```

| id | label | prefix | outline |
|---|---|---|---|
| assembly-area | Assembly area | AA | solid |
| objective | Objective | OBJ | solid |
| battle-position | Battle position | BP | solid |
| engagement-area | Engagement area | EA | solid |
| named-area-of-interest | Named area of interest | NAI | solid |
| target-area-of-interest | Target area of interest | TAI | solid |
| free-fire-area | Free fire area | FFA | dashed |
| no-fire-area | No fire area | NFA | dashed |
| restrictive-fire-area | Restrictive fire area | RFA | dashed |
| airspace-coordination-area | Airspace coordination area | ACA | dashed |

`polygonLabel` follows `lineLabel`'s rule: `"<prefix> <name>"`, or the name alone when it already
starts with the prefix.

### 3.2 Storage

- `MapItemKind` becomes `'point' | 'line' | 'polygon'`; `sidc` null.
- `geometry`: `{"type":"Polygon","coordinates":[[[lon,lat],…,[lon0,lat0]]]}` — one closed outer ring,
  ≥ 4 positions (≥ 3 distinct points). `geometry.ts` gains `polygonGeometry(points)` (closes the
  ring) and `parsePolygonGeometry(json): LatLon[] | null` (the open ring: distinct points, null for
  < 3, bad JSON or an invalid position).
- `style`: `{"polygonType":"objective","shape":"points"}` or
  `{"polygonType":"no-fire-area","shape":"circle","center":{"lat":…,"lon":…},"radiusM":500}`.
  `polygonStyleOf(style)` parses it (unknown type → `objective`; a circle with a bad center or a
  radius ≤ 0 falls back to `shape: 'points'` using the stored ring).
- Circle ring: 64 points from `destination(center, 360·i/64, radiusM)`.
- Name required, no auto-names (as lines).

### 3.3 Measurement — `src/features/map-items/polygon-measure.ts`

`perimeterM(points)` (geodesic, closed) and `areaM2(points)` (geodesic polygon area via
geographiclib's `Polygon`); `formatArea(m2)` → `"0.42 km²"` (≥ 0.01 km²) or `"8,500 m²"`.

### 3.4 Categories and commands

- `itemCategory({ kind: 'polygon' })` → `'polygon'`; `ITEM_COPY.polygon = { noun: 'polygon', title: 'Polygon' }`.
- `placePolygon(ctx, { missionId, polygonType, name, notes?, shape })` where `shape` is
  `{ kind: 'points', points }` or `{ kind: 'circle', center, radiusM }`; `updatePolygon(ctx, id, patch)`
  with the same fields optional. Errors: `invalid_coordinate`, `too_few_points`, `invalid_radius`
  (≤ 0 or > 500 km), `invalid_name`, `not_found`, `write_failed`.

## 4. Drawing

### 4.1 Saved polygons — `PolygonsLayer`

- A non-touchable `ShapeSource` (`polygons-fill`) with a `FillLayer` (`friendly`, opacity 0.15).
- A touchable `ShapeSource` (`polygons`) with the outline (halo, solid, dashed — same widths and
  dash as normal lines) and the label chip at the ring's center (a point feature at the centroid
  of the ring, or the circle's center).
- Hidden and edited polygons are filtered out as for lines; a tap calls
  `onItemPress(id, at, { kind: 'polygon', sidc: null })`.

### 4.2 Draft — `DraftPolygonLayer`

- Points: the closed shape with fill, the same numbered markers, segment-distance chips (respecting
  **Show point distances**, including the closing segment), selected-point ring.
- Circle: the ring and fill, a center marker, and an `r 500 m` chip on the ring's east edge.

## 5. Draft store

The line draft fields are reused for the Points shape (`vertices`, `selectedVertex`,
`insertAfter`, `history`), with `minVertices` = 2 for lines and 3 for polygons (the `canRemove`
rule takes it). New fields: `polygonType`, `polygonShape: 'points' | 'circle'`,
`circleCenter: LatLon | null`, `circleRadiusM: number | null`, `remembered.polygonType`.
Actions: `startAddPolygon()`, `startEditPolygon(item)`, `setPolygonType`, `setPolygonShape`,
`setCircleCenter(p)`, `setCircleRadius(m)`, `setCircleEdge(p)` (radius = distance center → p).
Switching shape keeps each shape's draft; only the current shape is saved.

## 6. Menus and interaction

- Menu ids `polygon.add` `{}` and `polygon.edit` `{ itemId }`; titles "Add polygon" / "Polygon" /
  "Edit polygon"; an `ITEM_ADAPTERS.polygon` adapter; redirects from/to other item menus as today.
- `PolygonForm`: Name; Polygon type (alphabetical, small shape sample); **Shape** `MenuSegmented`
  (Points | Circle); then
  - Points: `POINTS · N` with `<perimeter> · <area>` on the right, `MenuVertexRow`s (× disabled at
    3 with "A polygon needs at least 3 points"), New point (typed MGRS, Add new point / Move point N);
  - Circle: **Center** (MGRS fields + Center + Map buttons) and **Radius** (number field + m/km
    `MenuSegmented`), area shown;
  - Notes; **Show point distances** (Points only).
- Save requires a name and a valid shape (≥ 3 points, or a center and a radius > 0).
- Toolbar: **UNIT · POINT · LINE · POLYGON · MEASURE · LAYERS**; POLYGON icon `pentagon-outline`.
- `LineDrawBar` serves polygons too: Points prompts as for lines; Circle shows
  "Tap map to set center" (+ **Set center at crosshair**) until a center exists, then
  "Tap map at the edge" (+ **Set edge at crosshair**).
- Map taps / long-press / symbol taps while drawing go to the polygon draft (points: add/move a
  vertex; circle: center first, then edge). Opening a saved polygon fits the camera to it.

## 7. Layers and missions

- Layers rows: a small shape sample (outline in the type's dash, light fill), the name, and
  `<type label> · <area>` (Points) or `<type label> · r <radius>` (Circle). Search by name or type label.
- Summary and mission rows: `"N units · M points · K lines · P polygons"`.

## 8. Testing

- Types and labels; geometry round-trip (closing, < 3 points, bad JSON); circle ring (64 points,
  every point at the radius); style parsing and fallbacks; perimeter/area against known shapes.
- Commands: place/update for both shapes and every error.
- Draft store: shapes kept separately; circle center/edge/radius; 3-point minimum; undo.
- Layers: fill source not touchable, outline/label touchable, filters for hidden/edited, dashed types.
- Menus via `MenuHost`: add a points polygon and a circle; edit the radius; × disabled at 3;
  Shape switch keeps both drafts; redirects.
- Map screen: POLYGON toggles its menu; taps add points / set center then edge; a unit tap while
  drawing adds a point; a tap inside a saved polygon's fill does not open it.
- Layers rows and counts; missions counts.

## 9. Out of scope

Rectangles, sectors and corridors; dragging points; hatch or pattern fills; per-type colors;
holes; importing or pasting coordinates; altitude limits for airspace areas.
