# Condensed Polygon View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polygons open as a condensed view (identity block, CENTER data card, Fit/Lengths/Hide/Delete, collapsible points list, notes) like units and points, and the shared edit points list gets a plain separator-line look.

**Architecture:** EditItemPanel's condensed path (today `unit` | `point`) extends to `polygon`, rendering a new
`PolygonView` body (in `menus/view/`) while locked; lines keep the legacy path. Shared pieces are pulled out of the unit
view rather than copied (the identity block and the data card's cell). Two small draft requests (`refocus`, `lookAt`)
let the view ask the map to re-fit the polygon or center a point.

**Tech Stack:** Expo / React Native, NativeWind, zustand (draft + settings stores), WatermelonDB behind commands,
jest-expo + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-10-29-polygon-view-design.md` (mockups in `docs/design/mockups/polygon-view/`; where the landscape mockup differs from the spec, the spec wins).

## Global Constraints

- Work in `map/` on branch `feat/polygon-view` (it builds on the unmerged `feat/condensed-item-view`). Never add Co-Authored-By or any trailer to commits.
- No copy button; no new dependencies.
- Semantic color tokens only; `active:opacity-60` on every Pressable; colors in JS from `useTheme().colors`; commands are the only write path; the UI never imports WatermelonDB.
- Lines keep today's locked-form view and keep their Show point distances switch.
- Reuse the unit view's pieces (`MenuTileButton`, `useArmed`, `NotesPreview`, the data-card look); don't copy them.
- Verification for every task: `npx tsc --noEmit -p .` clean, `npm run -s lint` clean, the task's tests pass; the last task runs the full `npx jest` (MapScreen.test.tsx can time out under load — rerun it alone if it alone fails).
- Don't reformat whole files with prettier; match the surrounding style.

## Review Focus

1. A circle polygon: RADIUS in place of PERIMETER, no points row, no Lengths tile, subtitle without a point count — Task 3 test.
2. Fit pressed twice (after panning away) must fit both times — Task 2 test (`refocus` bumps `focusRev` every call).
3. The edit list's selected / inserting states must stay visible without the per-row box — Task 1 test.
4. Hidden polygon: HIDDEN tag shows and the Hide tile reads Show — Task 3 test.
5. Lat/lon coordinate setting: the card's CENTER label reads `LAT/LON` and the points list shows lat/lon — Task 3 test.

---

### Task 1: Plain points list in edit (shared with lines); polygon form loses its distances switch

**Files:**
- Modify: `src/components/menu/MenuVertexRow.tsx`, `src/features/map-items/menus/PolygonForm.tsx`
- Test: `src/components/menu/primitives.test.tsx`, `src/features/map-items/menus/EditPolygonMenu.test.tsx` (and any line/polygon form test asserting the old row box or the polygon switch)

**Interfaces:**
- Produces: `MenuVertexRow` with `onRemove?: () => void` now optional — no remove (×) button when absent (Task 3's view list reuses the row this way). Rows have no border box: a thin top separator (`border-t border-border`, matching `MenuListItem`'s flush rows) and the number badge one step smaller (`h-6 w-6`, `text-sm` number). Selected row: badge `bg-accent` and an `bg-accent-subtle` row background (no border) so selection stays visible.

- [ ] **Step 1: Failing tests** in `primitives.test.tsx`: `MenuVertexRow is a plain row with a separator and no box`: its outer className contains `border-t` and not `rounded-xl`; `MenuVertexRow without onRemove has no remove button`: `queryByLabelText('Remove point 2')` null; the existing MenuVertexRow tests (row/remove/insert targets, "Inserting points" + Done) stay green; selected row still reports `selected` and its className contains `bg-accent-subtle` (Review Focus 3). In the polygon form test: no `Show point distances` switch in the polygon edit form (the line form keeps it — an existing line test must still find it).
- [ ] **Step 2: Run** `npx jest src/components/menu src/features/map-items/menus` — new tests FAIL.
- [ ] **Step 3: Implement** the interface above; remove the polygon form's `MenuToggle` for `showLineDistances` (and its now-unused imports/selectors).
- [ ] **Step 4: Run** the same command — PASS; tsc, lint.
- [ ] **Step 5: Commit** `feat: plain points list (separator lines, smaller badges); polygon form drops its distances switch`

### Task 2: Draft requests: `refocus` (Fit) and `lookAt` (center a point)

**Files:**
- Modify: `src/stores/draft.ts`, `src/features/map/MissionMap.tsx`
- Test: `src/stores/draft.test.ts`

**Interfaces:**
- Produces on the draft store:
  - `refocus(): void` — while `focusBounds` is set, bumps `focusRev` (MissionMap's existing focus subscription re-fits); no-op otherwise. Works while locked.
  - `lookAt(at: LatLon): void` — sets `lookAt: at` and bumps `lookRev` (new fields; `INITIAL_DRAFT` has `lookAt: null, lookRev: 0`, and `startAdd`/`startEdit*` keep the current `lookRev` like they keep `focusRev`).
- MissionMap: a new draft subscription on `lookRev` that does what the coord-follow subscription does for a move — `markMoved()`, ends follow mode, `followTarget.current = lookAt`, `fitTarget.current = null`, `moveCamera({ centerCoordinate, ...EASE, animationDuration: 400 })` (current zoom kept).

- [ ] **Step 1: Failing tests** in `draft.test.ts`: `refocus bumps focusRev each call while a polygon is open` — `startEditPolygon(...)` (circle or points), call `refocus()` twice, `focusRev` up by 2 and `focusBounds` unchanged (Review Focus 2); with no `focusBounds`, `refocus()` changes nothing. `lookAt sets the target and bumps lookRev` — twice with the same point bumps twice.
- [ ] **Step 2: Run** `npx jest src/stores/draft` — FAIL.
- [ ] **Step 3: Implement** both actions and the MissionMap subscription.
- [ ] **Step 4: Run** `npx jest src/stores/draft src/features/map` — PASS; tsc, lint.
- [ ] **Step 5: Commit** `feat: draft refocus and lookAt requests for the polygon view`

### Task 3: Polygon view components

**Files:**
- Create in `src/features/map-items/menus/view/`: `polygon-summary.ts`, `IdentityBlock.tsx`, `DataCell.tsx`, `PolygonCard.tsx`, `PolygonActions.tsx`, `PolygonPoints.tsx`, `PolygonView.tsx`
- Modify: `view/ItemTitle.tsx` (render through `IdentityBlock`), `view/LocationCard.tsx` (use `DataCell`)
- Test: `view/polygon-summary.test.ts`, `view/PolygonView.test.tsx`; existing `view/ItemView.test.tsx` must stay green

**Interfaces:**
- Consumes: Task 1 (`MenuVertexRow` without `onRemove`), Task 2 (`refocus`, `lookAt`); `polygonStyleOf`, `polygonTypeInfo`, `POLYGON_FILLS`, `parsePolygonGeometry`, `ringCenter`, `perimeterM`, `areaM2`, `circleRing`, `formatArea`, `formatDistance`, `describeVector`, `formatCoordinate`, `useReadoutOrigin`, `PolygonSample`, `MenuTileButton`, `useArmed`, `NotesPreview`, `setItemHidden`, `useSettings` (`showLineDistances`, `setShowLineDistances`, `coordinateFormat`).
- Produces:
  - `polygonSummary(item: MapItemSnapshot): { polygonType; kind: 'points' | 'circle'; points: LatLon[]; center: LatLon; perimeterM: number | null; radiusM: number | null; areaM2: number; subtitle: string; typeLabel: string } | null` — null when the geometry/style can't be read. `subtitle`: points `Objective · 7 points · 15% fill`, circle `Objective · 15% fill` (type label from `polygonTypeInfo`, fill label from `POLYGON_FILLS`). `center`: circle center, else `ringCenter(points)`. `areaM2` of the ring (circle: `circleRing(center, radiusM)`).
  - `IdentityBlock({ icon, name, lead, leadColor, rest, hidden, accessibilityLabel, testID })` — the presentational part of today's `ItemTitle` (icon, `font-mono-bold text-xl` name, one-line subtitle whose `lead` word is colored, HIDDEN tag `testID="hidden-tag"`). `ItemTitle` renders through it, unchanged in output and test IDs.
  - `DataCell({ label, value, accent?, last? })` — today's `LocationCard` cell (label over large number + small muted unit, split at the last space, right divider unless `last`), moved out and used by both cards.
  - `PolygonView({ item, hidden, onEditNotes, onDelete })` — top to bottom: identity (`PolygonSample` size 40, name, type word in `colors[polygonTypeInfo(type).color]`, rest of subtitle; `testID="polygon-title"`, accessible label `${name}, ${subtitle}${hidden ? ', hidden' : ''}`), `PolygonCard`, `PolygonActions`, `PolygonPoints` (points polygons only), `NotesPreview`.
  - `PolygonCard` — black card like `LocationCard`: top row `CENTER` (or `LAT/LON` label under the lat/lon setting) + center coordinate; cells `TO CENTER` (from `useReadoutOrigin().from` to center, `distanceLabel`, accent; `—` without a position), `PERIMETER` or `RADIUS` (`formatDistance`), `AREA` (`formatArea`).
  - `PolygonActions` — `Fit` (icon `fit-to-screen-outline`, calls `refocus()`), `Lengths` (points only; icon `vector-polyline`; `active` = `showLineDistances`; toggles it), `Hide`/`Show` (as `ItemActions`), `Delete` (danger, `useArmed`, `onDelete` on the second tap, armed label `Tap again` / accessible `Tap again to delete`). Errors as today: `Could not change visibility.`.
  - `PolygonPoints` — collapsed row (button, accessible label `Points, ${n}`, state `expanded`): three small badges `1 2 3`, `Points · ${n}`, right `View grids` + chevron (`chevron-down` / `chevron-up`). Expanded: `MenuVertexRow` per point without `onRemove`, `detail` `start` / `+${formatDistance(seg)}` (as the form does), title in the coordinate format; pressing a row calls `lookAt(point)`. Local state, starts collapsed.

- [ ] **Step 1: Failing pure tests** (`polygon-summary.test.ts`), with a 4-point square and a circle of radius 500 m: points → `kind 'points'`, `points.length 4`, `perimeterM` > 0, `radiusM` null, subtitle `Objective · 4 points · 15% fill` (default light fill, Objective type); circle → `kind 'circle'`, `radiusM 500`, `perimeterM` null, subtitle `Objective · 15% fill`, center equals the circle center; unreadable geometry → null.
- [ ] **Step 2: Failing render tests** (`PolygonView.test.tsx`, placing polygons via `placePolygon` like the polygon menu tests):
  - points polygon: `polygon-title` has the name and subtitle; card shows `CENTER`, `TO CENTER`, `PERIMETER`, `AREA`; tiles `Fit`, `Lengths`, `Hide`, `Delete`; `Points, 4` collapsed (no `Point 1` row); pressing it shows `Point 1`..`Point 4` and no `Remove point 1`; pressing `Point 2` bumps the draft `lookRev` and sets `lookAt` to that vertex.
  - circle: `RADIUS` and no `PERIMETER`, no `Lengths`, no points row (Review Focus 1).
  - Fit bumps `focusRev` (set up the draft with `startEditPolygon` first).
  - Lengths toggles `showLineDistances` and is `selected` while on.
  - `hidden`: HIDDEN tag shown, tile reads `Show` (Review Focus 4).
  - lat/lon setting: `LAT/LON` label and the expanded rows show lat/lon text (Review Focus 5).
  - Delete calls `onDelete` only on the second tap; tapping `Add notes` calls `onEditNotes`.
- [ ] **Step 3: Run** `npx jest src/features/map-items/menus/view` — new tests FAIL.
- [ ] **Step 4: Implement**, including the `IdentityBlock` / `DataCell` extractions (ItemView tests must stay green unchanged).
- [ ] **Step 5: Run** `npx jest src/features/map-items` — PASS; tsc, lint.
- [ ] **Step 6: Commit** `feat: condensed polygon view components (identity, card, actions, points list)`

### Task 4: EditItemPanel opens polygons condensed

**Files:**
- Modify: `src/features/map-items/menus/EditItemPanel.tsx`
- Test: `src/features/map-items/menus/EditPolygonMenu.test.tsx` (rewrite for the view), plus any LayersMenu/MapScreen test that asserted the polygon's locked form

**Interfaces:**
- Consumes: Task 3 (`PolygonView`, `polygonSummary`).

Behavior: `condensed` becomes `unit | point | polygon`. Locked polygon: header `title={ITEM_COPY.polygon.title}` (`Polygon`), icon-only Close/Back, Edit; body `<PolygonView item hidden onEditNotes={() => useDraft.getState().editNotes()} onDelete={() => void remove()} />` (units/points keep `ItemView`). If `polygonSummary(item)` is null the panel already reports it gone (adapter select fails) — keep that path. Editing: unchanged form with Cancel/Save. Lines: unchanged legacy path. The scroll-to-top after Save/Cancel already applies.

- [ ] **Step 1: Update tests** (`EditPolygonMenu.test.tsx`): opens to the view (`polygon-title`, header text `Polygon`, `Close`, `Edit`, no `Name` field); a circle opens with `RADIUS` and its exact center (keep the existing exact-center/radius assertions, moving the field checks after pressing Edit), and saving a new radius still works and returns to the view showing the new radius; Cancel returns to the view; deleting from the view closes the menu with no "no longer exists" toast; the unreadable/redirect test stays green. Keep every behavior the old tests checked.
- [ ] **Step 2: Run** `npx jest src/features/map-items/menus/EditPolygonMenu` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full `npx jest`, tsc, lint — all green.
- [ ] **Step 5: Commit** `feat: polygons open condensed and expand into the form to edit`
