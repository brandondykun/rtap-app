# Lines — design

**Status:** approved in conversation 2026-10-13; awaiting written-spec review.
**Builds on:** `2026-10-12-tactical-map-architecture-design.md`, `2026-10-13-units-and-points-design.md`.
**Mockup:** "Landscape — Add Line (tap or type points)" (user-supplied, 2026-10-13).

## 1. Intent

Users draw military control lines (phase lines, boundaries, routes, fire control lines) made of
two or more points, give each a name and a line type, and can add, remove, move and insert
points, type points as MGRS grids, view a saved line, edit it, hide it and delete it.

Success: a user can build "PL RED" from four grids by tapping the map or typing, fix one point,
insert a bend, save it, find it in Layers, and delete it — all in the same panel style as units
and points.

## 2. Decisions (from the conversation)

| Topic | Decision |
|---|---|
| Line types | 10: Phase line, Line of departure, Limit of advance, Boundary, Route, Axis of advance, Forward line of own troops, Restrictive fire line, Coordinated fire line, Fire support coordination line. |
| Editing a point | Select, then move: tap its row or its numbered marker; the next map tap / Move to center / corrected grid moves it. No dragging. |
| Inserting | New points append to the end; a selected point offers **Insert after**, and the next point lands right after it. |
| Color | All line types in the friendly blue (`friendly` token) with a dark halo; types differ by style and label prefix. |
| Storage | New item kind `kind = 'line'`, GeoJSON LineString geometry; the line type in the `style` column. No schema change. |
| Paste a list of grids | Out of scope for now. |

## 3. Data

### 3.1 Line types

New module `src/features/symbology/line-types.ts`:

```ts
export type LineType = 'phase-line' | 'line-of-departure' | 'limit-of-advance' | 'boundary' | 'route'
  | 'axis-of-advance' | 'flot' | 'restrictive-fire-line' | 'coordinated-fire-line' | 'fscl';
export type LineDash = 'solid' | 'dashed';
export const LINE_TYPES: readonly {
  id: LineType; label: string; prefix: string | null; dash: LineDash;
  width: 'normal' | 'heavy' | 'wide'; endArrow: boolean; decoration: 'none' | 'flot-arcs';
}[];
export function lineTypeById(id: string | null): LineType | null;
export function lineLabel(type: LineType, name: string): string; // "PL RED"; boundary → "RED"
```

| id | label | prefix | dash | width | end arrow | decoration |
|---|---|---|---|---|---|---|
| phase-line | Phase line | PL | solid | normal | no | none |
| line-of-departure | Line of departure | LD | solid | normal | no | none |
| limit-of-advance | Limit of advance | LOA | solid | normal | no | none |
| boundary | Boundary | — | solid | heavy | no | none |
| route | Route | RTE | solid | normal | yes | none |
| axis-of-advance | Axis of advance | AXIS | solid | wide | yes | none |
| flot | Forward line of own troops | FLOT | solid | normal | no | flot-arcs |
| restrictive-fire-line | Restrictive fire line | RFL | dashed | normal | no | none |
| coordinated-fire-line | Coordinated fire line | CFL | dashed | normal | no | none |
| fscl | Fire support coordination line | FSCL | solid | normal | no | none |

`lineLabel` returns `"<prefix> <name>"`, or just the name when the prefix is null or the name
already starts with the prefix (a user who types "PL RED" gets "PL RED", not "PL PL RED").

### 3.2 Storage

- `MapItemKind` becomes `'point' | 'line'`.
- `geometry`: GeoJSON `{"type":"LineString","coordinates":[[lon,lat],…]}` with ≥ 2 positions.
  `geometry.ts` gains `lineGeometry(points: LatLon[]): string`,
  `parseLineGeometry(json): LatLon[] | null` (null for < 2 valid positions or bad JSON).
- `style`: JSON `{"lineType":"phase-line"}`. Parsed by `lineTypeOf(style: string | null): LineType`,
  which falls back to `'phase-line'` for missing or unknown values.
- `sidc`: null for lines.
- No auto-names: a line's name is required and typed by the user.

### 3.3 Categories

`itemCategory` changes signature to take the item, because a line has no SIDC:

```ts
export type ItemCategory = 'unit' | 'point' | 'line';
export function itemCategory(item: { kind: string; sidc: string | null }): ItemCategory;
```

`kind === 'line'` → `'line'`; otherwise the existing SIDC rule. Every caller passes the item (or
`{ kind, sidc }`); `openItemMenu(itemId, item)` likewise. It remains the only place that decides.

### 3.4 Commands

- `placeLine(ctx, { missionId, points, lineType, name, notes? })` → `Result<{ id }, 'invalid_coordinate' | 'too_few_points' | 'invalid_name' | 'write_failed'>`.
- `updateLine(ctx, id, { points?, lineType?, name?, notes? })` → same errors plus `'not_found'`.
- `deleteItem` and `setItemHidden` / `setItemsHidden` already work for any kind.
- Validation: every point valid (`isValidLatLon`), at least 2 points, non-blank name, known line type.

### 3.5 Measurement

Segment and total lengths use the geodesic `inverse` distance and the existing `formatDistance`
(the same text as the range readout). New helper `src/features/map-items/line-measure.ts`:
`segmentLengths(points): number[]`, `totalLength(points): number`.

## 4. Drawing

### 4.1 Saved lines — `LinesLayer`

One `ShapeSource` (`id="lines"`) built by a cached selector (`createLineFeatureSelector`, cache by
`id + updatedAt`, like points). Each line feature carries `id`, `name`, `label` (`lineLabel`),
`lineType`, `dash`, `width`, `endArrow`, `decoration`. Layers:

| Layer | What |
|---|---|
| `lines-halo` | dark halo under every line (`point-symbol-halo`), width per `width` |
| `lines-solid` / `lines-dashed` | friendly-blue line, filtered by `dash` |
| `lines-arrow` | arrowhead image at the last vertex for `endArrow` lines, rotated to the last segment |
| `lines-flot` | small semicircle images repeated along `flot-arcs` lines (`symbolPlacement: 'line'`) |
| `lines-label-start` / `lines-label-end` | label chips at both ends (point features at the first and last vertex) |

- Hidden lines: the same `hiddenFilter` on every layer.
- The line being edited is left out (`excludeId`), as points are.
- Tapping a line (`onPress` on the source) calls `onItemPress(id, at, { kind: 'line', sidc: null })`.
- Arrowhead and FLOT-arc images: generated in `scripts/build-map-images.ts` (friendly blue with
  halo), registered in `MAP_IMAGES`.
- Line widths (pt): normal 3, heavy 5, wide 7; halo 2 pt wider. Dash pattern `[2, 1.5]`.

### 4.2 Draft line — `DraftLineLayer`

While a line is being added or edited (and while a saved line is viewed read-only):

- the line in its type's style;
- white numbered vertex markers (number text inside a white disc, dark ring);
- a distance chip at each segment's midpoint (`formatDistance`);
- the amber dashed ring (`draft-ring` image) on the selected vertex;
- the label chip at the last vertex;
- tapping a vertex marker selects it (`onVertexPress(index)`).

## 5. Draft store

`stores/draft.ts` gains a line section (only meaningful when `category === 'line'`):

```ts
vertices: LatLon[];
selectedVertex: number | null;   // index into vertices
insertAfter: number | null;      // next added point goes at insertAfter + 1
lineType: LineType;
history: { vertices: LatLon[]; selectedVertex: number | null }[]; // undo stack, max 50
```

Actions (each pushes the previous `{ vertices, selectedVertex }` onto `history`, except select):

| Action | Effect |
|---|---|
| `addVertex(p)` | Inserts at `insertAfter + 1` when set (then selects it and sets `insertAfter` to it, so repeated adds keep inserting in order); otherwise appends. |
| `moveVertex(i, p)` | Replaces vertex i. |
| `removeVertex(i)` | Removes it unless that would leave fewer than 2 **and** the line already had ≥ 2 (while building, removing down to 0 is allowed). Clears/shifts the selection. |
| `selectVertex(i \| null)` | Selects (tapping the selected one again deselects); clears `insertAfter`. |
| `startInsertAfter(i)` | Sets `insertAfter = i`. |
| `undo()` | Pops `history`. |
| `setLineType(t)` | Sets the type (not part of undo). |
| `startAddLine({ at? })`, `startEditLine(item)` | Start a line draft (`category: 'line'`); edit opens locked, as items do. |

The add/move/remove rules live in a pure module `src/features/map-items/line-draft.ts` (tested on
its own); the store calls it.

## 6. Menus and interaction

### 6.1 Menu ids

| id | params | titles |
|---|---|---|
| `line.add` | `{}` | Add line |
| `line.edit` | `{ itemId }` | Line / Edit line |

Both use the existing header/Cancel/Save/Edit/Hidden/Delete pattern. `line.edit` for a non-line
item redirects with `openItemMenu`, and `unit.edit` / `point.edit` for a line do the same.

### 6.2 LineForm

Matches the mockup:

- **Name** (required, mono, uppercase) and **Line type** (`MenuSelect` with a short line sample
  icon per type) on one row.
- **POINTS · N** with the total length on the right.
- One row per vertex (new primitive `MenuVertexRow`): number badge, MGRS, `start` or `+<segment>`,
  and a × button. The selected row is highlighted (amber border). A selected row also shows an
  **Insert after** button. × is disabled when removing would leave fewer than 2 points on a line
  that has 2+; the hint "A line needs at least 2 points" shows then.
- **Type a point:** the shared `MgrsInput` + a **+** button (becomes **✓** when a point is
  selected: it moves the selected point). Return in the last field submits. Invalid or partial
  grids cannot be submitted (same evaluation as the point form). After adding, the fields clear.
- **Notes** button and field, as on the other forms.
- Read-only (locked) disables everything; the list and lengths stay visible.

### 6.3 Bottom bar — `LineDrawBar`

Shown above the bottom-left readouts while `line.add` or an unlocked `line.edit` is open:

- Nothing selected: **"Tap map to add point N"** · **Add at center** · **Undo**.
- Inserting: **"Tap map to insert point N"** · **Add at center** · **Undo**.
- Point selected: **"Tap map to move point i"** · **Move to center** · **Done**.
- Undo is disabled when history is empty.

### 6.4 Map events while drawing

- Map tap → add (or insert, or move the selected vertex).
- Tap on a draft vertex marker → select it.
- Long-press → same as a map tap (adds a point) while `line.add` or an unlocked `line.edit` is
  open; otherwise unchanged (last-used unit/point Add).
- The camera eases to a point added or moved by typing a grid; it does not move for map taps or
  Add/Move to center (those points are already in view).
- Saved points/units tapped while drawing do not open their menus (the tap adds a point there).

### 6.5 Toolbar

**UNIT · POINT · LINE · LAYERS**. LINE icon: `vector-polyline`. Highlighted while `line.add` is on top.

## 7. Layers and missions

- Layers list rows for lines: a line-sample icon in the line's style, title = name, subtitle =
  `<type label> · <total length>` (plus "Hidden · " when hidden). Row tap: fit the camera to the
  line's bounds (with panel padding) and open `line.edit`.
- Summary: `"<n> units · <m> points · <k> lines · <h> hidden"`.
- Search matches the name or the line type label.
- Mission rows and delete confirmation: `"<n> units · <m> points · <k> lines"`
  (`observeMissionCategoryCounts` returns `{ units, points, lines }`, counting lines by `kind`
  and units as point-kind items that are not points).

## 8. Docs and skills

- Architecture spec: a "Lines" subsection pointing here.
- `map-item-kinds` skill: lines as the worked example of a second kind (geometry, selector,
  layer, draft, menus).
- `menus` skill: `line.add` / `line.edit`, `MenuVertexRow`, `LineDrawBar`.
- Native gate rows: drawing by tap and center, typing grids, select/move/insert/remove/undo,
  the 2-point rule, each line type's look on Satellite/Topo/Dark, labels at both ends, arrows,
  Layers row tap fitting the line, hide, delete.

## 9. Testing

- `line-types`: ids, prefixes, `lineLabel` (prefix rules, boundary).
- Geometry: LineString round-trip; < 2 points and bad JSON → null.
- `line-draft`: add, insert-after (repeated), move, remove (2-point rule; building down to 0),
  select toggling, undo after each action, history cap.
- Commands: `placeLine` / `updateLine` validation and writes; delete/hide for lines.
- Selector: cache by `id + updatedAt`, properties per type, hidden filter, `excludeId`.
- `LinesLayer` / `DraftLineLayer`: layer props via `mapboxMock()` (filters, styles stable,
  vertex press → select).
- Menus via `MenuHost`: Add line (name + 2 points → Save enabled; typed point; × disabled at 2;
  Insert after; Save → read-only Line view), Edit line (Edit/Save/Cancel restores, Hidden,
  Delete), wrong-category redirects both ways.
- Map screen: LINE toggles the menu; map tap adds; vertex tap selects; long-press adds while
  drawing; tapping a unit while drawing adds a point instead of opening it.
- Layers: line rows, summary, search by type label, row tap opens `line.edit`.
- Missions: counts with lines.

## 10. Out of scope

Polygons; measure tool; freehand drawing; dragging markers; pasting a list of grids; curved or
smoothed lines; per-type colors; echelon markings on boundaries; labels repeated along long lines.
