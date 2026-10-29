# Unit Range Rings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Artillery units get a threat ring distance (m). Air defense units get a horizontal range (m) and a vertical
range (ft). A unit with a ring distance can show a geodesic ring on the map, toggled one unit at a time or all at once
from Layers.

**Architecture:** The three ranges are new optional columns on the synced `map_items` table. Ring on/off is a new
optional `show_ring` column on the local-only `item_view_state` table. Pure helpers in `unit-ranges.ts` decide which
fields apply to a SIDC, and parse and validate input. Commands stay the only write path. A new `RingsLayer` draws rings
from snapshots through a cached selector, the same way `PolygonsLayer` does.

**Tech Stack:** Expo / React Native, WatermelonDB (LokiJS in tests), zustand, @rnmapbox/maps, geographiclib (via
`circleRing`), jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-28-unit-range-rings-design.md`

## Global Constraints

- Ring distances (threat ring, horizontal range): whole meters, `0 < v <= MAX_RADIUS_M` (500,000 m, from `polygon-types.ts`).
- Vertical range: whole feet, `0 < v <= 100_000`, stored in feet and never converted.
- Input accepts a comma as the decimal separator and rounds to a whole number. Empty means "no range".
- Field labels, exactly: `Threat ring`, `Horizontal range`, `Vertical range`. The switch reads `Show ring on map`. The Layers buttons read `Show all rings` and `Hide all rings`.
- Rings start off. Adding or editing a range never turns a ring on.
- Clearing a unit's ring distance resets its `show_ring` to off in the same write.
- Data-layer rules (`.claude/skills/data-layer/SKILL.md`): new columns are `isOptional`, the migration is append-only, view state stays local-only, and UI never imports WatermelonDB.
- Styling rules (`.claude/skills/styling/SKILL.md`): semantic tokens only, and map colors come from `colors` (`useTheme`).
- Commits carry **no** `Co-Authored-By` or any other trailer.
- Before finishing: `npx tsc --noEmit`, `npx expo lint` and `npx jest` all pass.

## Review Focus

1. **Type change while a ring is on** (artillery with ring on → infantry, or → air defense with no horizontal range): the range is cleared and the ring is reset to off, so re-entering a range later does not bring the ring back. Pinned in Task 3.
2. **Odd input** (`0`, `-5`, `abc`, `12,6`, ` 800 `, `500001`, `100001` ft): invalid input disables Save instead of saving garbage. A comma rounds. Pinned in Task 2 and Task 4.
3. **A unit with its ring on is hidden, moved or deleted:** a hidden unit's ring is not drawn, a moved unit's ring follows it, and a deleted unit leaves no orphan ring. Pinned in Task 3 (delete) and Task 7 (hidden, moved).
4. **Hide all rings with a search typed:** it still covers every unit in the tab. Pinned in Task 6.
5. **Opening a unit's details while its ring is on:** the ring stays visible. `excludeId` must not apply to rings. Pinned in Task 7.

---

### Task 1: Schema v4: range columns and `show_ring`

**Files:**
- Modify: `src/lib/db/schema.ts`, `src/lib/db/migrations.ts`, `src/lib/db/models/MapItem.ts`, `src/lib/db/models/ItemViewState.ts`
- Modify: `src/features/map-items/repository.ts` (snapshot type, `snapshot()`, both `observeWithColumns` lists)
- Test: `src/lib/db/db.test.ts`

**Interfaces:**
- Produces: these columns on `map_items`: `threat_range_m`, `horizontal_range_m`, `vertical_range_ft`, all `number`, optional. On `item_view_state`: `show_ring` (`boolean`, optional).
- Produces: model fields `MapItem.threatRangeM`, `horizontalRangeM`, `verticalRangeFt` (`number | null`) and `ItemViewState.showRing` (`boolean | null`).
- Produces: `MapItemSnapshot` gains `threatRangeM: number | null; horizontalRangeM: number | null; verticalRangeFt: number | null`.

- [ ] **Step 1: Write the failing test.** In `db.test.ts`, replace the migration-3 test's version assertions with a new test, and keep the migration-3 step assertion:

```ts
it('adds unit ranges to map items and show_ring to view state, in migration 4', () => {
  expect(schema.version).toBe(4);
  expect(migrations.maxVersion).toBe(4);
  const cols = schema.tables[Tables.mapItems].columns;
  for (const name of ['threat_range_m', 'horizontal_range_m', 'vertical_range_ft']) expect(cols[name]).toEqual({ name, type: 'number', isOptional: true });
  expect(schema.tables[Tables.itemViewState].columns.show_ring).toEqual({ name: 'show_ring', type: 'boolean', isOptional: true });
  expect(migrations.sortedMigrations.find((m) => m.toVersion === 4)?.steps).toEqual([
    { type: 'add_columns', table: Tables.mapItems, columns: [
      { name: 'threat_range_m', type: 'number', isOptional: true },
      { name: 'horizontal_range_m', type: 'number', isOptional: true },
      { name: 'vertical_range_ft', type: 'number', isOptional: true },
    ] },
    { type: 'add_columns', table: Tables.itemViewState, columns: [{ name: 'show_ring', type: 'boolean', isOptional: true }] },
  ]);
});
```

- [ ] **Step 2: Run it.** `npx jest src/lib/db/db.test.ts`. Expected: FAIL, because the version is 3.
- [ ] **Step 3: Implement.** Bump the version to 4 and add the columns to `schema.ts`. Append a `toVersion: 4` migration with the comment `// Artillery / air defense ranges (shared) and per-device range-ring visibility.`. Add the model fields with doc comments that name the unit (m / ft). Add the three fields to the snapshot. Add `'threat_range_m', 'horizontal_range_m', 'vertical_range_ft'` to both `observeWithColumns` lists in `repository.ts`, and add `'elevation_m'` to `observeItem`'s list while there.
- [ ] **Step 4: Run.** `npx jest src/lib/db src/features/map-items`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: schema v4 with unit range columns and show_ring view state"`

### Task 2: Range rules (pure helpers)

**Files:**
- Create: `src/features/map-items/unit-ranges.ts`
- Test: `src/features/map-items/unit-ranges.test.ts`

**Interfaces:**
- Consumes: `decomposeSidc` (`presets.ts`), `MAX_RADIUS_M` (`polygon-types.ts`), `UnitType`, `MapItemSnapshot`.
- Produces:
  - `type RangeField = 'threatRangeM' | 'horizontalRangeM' | 'verticalRangeFt'`
  - `type UnitRanges = Record<RangeField, number | null>`
  - `const NO_RANGES: UnitRanges` (all null)
  - `const MAX_VERTICAL_RANGE_FT = 100_000`
  - `rangeFieldsFor(unitType: UnitType): readonly RangeField[]`: `artillery` → `['threatRangeM']`, `air-defense` → `['horizontalRangeM', 'verticalRangeFt']`, everything else → `[]`.
  - `rangeFieldsForSidc(sidc: string | null): readonly RangeField[]`: via `decomposeSidc`. Returns `[]` for a null or non-unit SIDC.
  - `normalizeRanges(fields: readonly RangeField[], r: Partial<UnitRanges>): UnitRanges`: keeps only `fields`, and sets everything else to null.
  - `isValidRange(field: RangeField, v: number | null): boolean`: null is valid. Otherwise v is an integer and `0 < v <= max`, where max is `MAX_RADIUS_M` for the meter fields and `MAX_VERTICAL_RANGE_FT` for vertical range.
  - `parseRangeText(text: string): number | null | undefined`: `''` or whitespace → `null`. A finite number (comma treated as a point) → `Math.round`. Anything else → `undefined` (invalid).
  - `formatRangeText(v: number | null): string`: `''` for null, otherwise `String(v)`.
  - `ringRadiusM(item: Pick<MapItemSnapshot, 'sidc' | 'threatRangeM' | 'horizontalRangeM'>): number | null`: threat ring for artillery, horizontal range for air defense, otherwise null.

- [ ] **Step 1: Write failing tests**, one `it` per function, with these cases:
  - `parseRangeText`: `('')→null`, `(' ')→null`, `('800')→800`, `(' 800 ')→800`, `('12,6')→13`, `('abc')→undefined`, `('1e3')→1000`.
  - `isValidRange`: `('threatRangeM', 0)→false`, `(…, -5)→false`, `(…, 500_000)→true`, `(…, 500_001)→false`, `('verticalRangeFt', 100_000)→true`, `(…, 100_001)→false`, `(…, null)→true`, `(…, 1.5)→false`.
  - `normalizeRanges(['threatRangeM'], { threatRangeM: 1, horizontalRangeM: 2, verticalRangeFt: 3 })` → `{ threatRangeM: 1, horizontalRangeM: null, verticalRangeFt: null }`.
  - `rangeFieldsForSidc(composeSidc('hostile','artillery'))` → `['threatRangeM']`; `…'air-defense'` → `['horizontalRangeM','verticalRangeFt']`; `…'infantry'` → `[]`; `null` → `[]`.
  - `ringRadiusM`: artillery with `threatRangeM: 18000` → 18000; air defense with `horizontalRangeM: 8000` → 8000; infantry with `threatRangeM: 5` → null.
- [ ] **Step 2: Run.** `npx jest src/features/map-items/unit-ranges.test.ts`. Expected: FAIL, because the module is missing.
- [ ] **Step 3: Implement** `unit-ranges.ts` with the signatures above.
- [ ] **Step 4: Run.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: unit range rules"`

### Task 3: Commands: save ranges, ring visibility, reset on clear

**Files:**
- Modify: `src/features/map-items/commands.ts`, `src/features/map-items/repository.ts`
- Test: `src/features/map-items/map-items.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers. Task 1 columns.
- Produces:
  - `PlacePointInput.ranges?: Partial<UnitRanges>` and `UpdateItemPatch.ranges?: Partial<UnitRanges>`. Both commands gain the error `'invalid_range'`.
  - `setItemsShowRing(ctx, ids: readonly string[], show: boolean): Promise<Result<void, 'write_failed'>>`, mirroring `setItemsHidden`. A created row sets `hidden = false`. Hiding with no row is a no-op.
  - `setItemShowRing(ctx, id: string, show: boolean)`, which calls the plural version.
  - `observeRingItemIds(db): Observable<string[]>` in `repository.ts`, using `Q.where('show_ring', true)`, observed on `['show_ring']`.
- Behavior:
  - `placePoint` stores `normalizeRanges(rangeFieldsForSidc(sidc), ranges ?? {})`. Any kept value that fails `isValidRange` returns `invalid_range`.
  - `updateItem` works out the final SIDC (`patch.sidc ?? item.sidc`). The ranges come from `patch.ranges`, or from the stored ones when the patch has none. It then normalizes and validates them, and writes all three columns.
  - In the same `db.write`, if `ringRadiusM` of the result is null and a view-state row has `showRing === true`, set it to false.

- [ ] **Step 1: Write failing tests:**
  - `places an artillery unit with a threat ring and drops ranges that do not apply`: place hostile artillery with `{ threatRangeM: 18000, verticalRangeFt: 9 }` → snapshot `threatRangeM 18000`, `verticalRangeFt null`.
  - `rejects an out-of-range value`: `{ threatRangeM: 500_001 }` → `error 'invalid_range'`. Air defense `{ verticalRangeFt: 100_001 }` → `invalid_range`.
  - `ring visibility is off by default and set per item and in bulk`: `observeRingItemIds` first emits `[]`. After `setItemShowRing(id, true)` it emits `[id]`. `setItemsShowRing([a, b], false)` empties it. `setItemsHidden` then still works on the same rows, so `hidden` and `show_ring` are independent.
  - `changing type away from artillery clears the range and turns the ring off`: artillery with a range, ring on, then `updateItem(id, { sidc: composeSidc('hostile','infantry') })` → `threatRangeM null`, and the ring ids no longer contain the id. A later `updateItem` back to artillery with `{ threatRangeM: 100 }` leaves the ring off.
  - `artillery → air defense without a horizontal range turns the ring off`.
  - `emptying the threat ring turns the ring off`: `updateItem(id, { ranges: { threatRangeM: null } })`.
  - `deleting a unit with its ring on leaves no ring id`.
- [ ] **Step 2: Run.** `npx jest src/features/map-items/map-items.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** as specified above.
- [ ] **Step 4: Run.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: save unit ranges and toggle range rings"`

### Task 4: Draft store and unit adapter

**Files:**
- Modify: `src/stores/draft.ts`, `src/features/map-items/menus/item-adapters.ts`
- Test: `src/stores/draft.test.ts`, `src/features/map-items/menus/item-adapters.test.ts` (create it if absent; otherwise extend the existing adapter coverage in `AddUnitMenu.test.tsx`)

**Interfaces:**
- Consumes: Task 2 (`RangeField`, `UnitRanges`, `parseRangeText`, `formatRangeText`, `isValidRange`, `rangeFieldsFor`). Task 3 (`ranges` on `placePoint` / `updateItem`).
- Produces:
  - `DraftValues.rangeText: Record<RangeField, string>`, which is all `''` in `INITIAL_DRAFT`.
  - `setRangeText(field: RangeField, text: string)`, which does nothing while `locked`.
  - `startEdit` accepts `ranges?: UnitRanges` and fills `rangeText` with `formatRangeText()`.
  - `draftRanges(d: Pick<DraftValues, 'unitType' | 'rangeText'>): UnitRanges | null`, exported from `draft.ts`. It parses only the fields in `rangeFieldsFor(d.unitType)` and returns null when any of them is invalid (`undefined` from the parser, or `!isValidRange`). The other fields are null.
  - `symbolAdapter`:
    - `canSave` also requires `draftRanges(d) !== null`.
    - `place` and `update` pass `ranges: draftRanges(d)!`.
    - `select` passes `ranges` from the snapshot.
  - Changing the unit type keeps the typed text, because normalization happens at save.

- [ ] **Step 1: Write failing tests:**
  - `draftRanges`: artillery with `threatRangeM '18000'` → `{18000, null, null}`. Artillery with `'0'` → null. Artillery with `'abc'` in `verticalRangeFt` → `{null, null, null}`, because that field doesn't apply. Air defense with `'8000'` / `'15000'` → `{null, 8000, 15000}`.
  - `setRangeText` while locked does nothing.
  - `startEdit` with `ranges` fills `rangeText`.
  - Adapter: `canSave` is false for artillery with `'500001'`. `place` stores the threat ring.
- [ ] **Step 2: Run.** `npx jest src/stores/draft.test.ts src/features/map-items/menus`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: unit ranges in the draft and unit adapter"`

### Task 5: Unit form ranges, ring switch, Hidden without Edit

**Files:**
- Create: `src/features/map-items/menus/form/UnitRangesSection.tsx`
- Modify: `src/features/map-items/menus/UnitForm.tsx` (render `<UnitRangesSection mode={mode} />` between Echelon and Notes), `src/features/map-items/menus/EditItemPanel.tsx` (drop `disabled={locked}` from "Hidden on map")
- Test: `src/features/map-items/menus/AddUnitMenu.test.tsx`, `EditUnitMenu.test.tsx`

**Interfaces:**
- Consumes: Task 4 draft (`rangeText`, `setRangeText`, `unitType`, `locked`, `itemId`). Task 3 (`setItemShowRing`, `observeRingItemIds`, `observeItem`). Task 2 (`rangeFieldsFor`, `ringRadiusM`).
- Produces: `UnitRangesSection({ mode }: { mode: DraftMode })`.
  - It renders one `MenuSection` per field in `rangeFieldsFor(unitType)`, with labels `Threat ring` / `Horizontal range` / `Vertical range`.
  - Each field is a `TextField mono keyboardType="decimal-pad" editable={!locked}`, with a muted `m` or `ft` text beside it.
  - In edit mode it observes the saved item. When `ringRadiusM(item) !== null`, it renders `MenuToggle label="Show ring on map"`, whose value comes from `observeRingItemIds`. The toggle is **never** disabled, and it calls `setItemShowRing`, with `notifyError('Could not change the ring.')` on failure.

- [ ] **Step 1: Write failing tests:**
  - Add menu: choosing Artillery shows `Threat ring` and nothing else. Air defense shows `Horizontal range` and `Vertical range`. Infantry shows none.
  - Add menu: typing `500001` in Threat ring disables Add.
  - Edit menu: a saved artillery unit with a range shows `Show ring on map`, set to off. Pressing it while **locked** adds the id to the ring ids. A unit with no range shows no switch.
  - Edit menu: `Hidden on map` can be pressed while locked and hides the item.
- [ ] **Step 2: Run.** `npx jest src/features/map-items/menus`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: range fields and ring switch on the unit form; Hidden works without Edit"`

### Task 6: Layers menu: all rings and row ring toggle

**Files:**
- Modify: `src/features/map-items/layer-rows.ts`, `src/features/map-items/menus/LayersMenu.tsx`, `src/components/menu/MenuListItem.tsx`
- Test: `src/features/map-items/layer-rows.test.ts`, `src/features/map-items/menus/LayersMenu.test.tsx`

**Interfaces:**
- Consumes: Task 2 `ringRadiusM`. Task 3 `observeRingItemIds`, `setItemsShowRing`, `setItemShowRing`.
- Produces:
  - `layerRows(items, hiddenIds, query, limit?, category?, ringIds: readonly string[] = [])`.
  - `LayerRow.ring: boolean | null`. It is null when the item has no ring distance.
  - `LayerRows.ringableIds` and `ringOnIds` (`string[]`) cover the chosen category and are **not narrowed by search**, like `hiddenIds`.
  - `MenuListItem` gains an optional `secondary?: Trailing`, rendered before `trailing` in the same style.
- UI, Units tab only: a second button row holds `MenuButton label="Show all rings"`, which is disabled when every ringable unit's ring is already on, and `label="Hide all rings"`, which is disabled when `ringOnIds` is empty. Each row with `ring !== null` gets `secondary`:
  - icon `radius` when on, `radius-outline` when off (check that both exist in MaterialCommunityIcons' glyph map; `tsc` fails if they don't);
  - label `Hide ring for ${name}` or `Show ring for ${name}`.

- [ ] **Step 1: Write failing tests:**
  - `layerRows`: an artillery unit with a range has `ring: false`, and `true` once its id is in `ringIds`. Infantry has `ring: null`. With a query that matches only one of two ringable units, `ringableIds` still lists both.
  - LayersMenu: `Show all rings` turns on both rings while a search is typed. `Hide all rings` turns them off. The row ring button toggles one ring. The ring buttons don't appear on the Points tab.
- [ ] **Step 2: Run.** `npx jest src/features/map-items/layer-rows.test.ts src/features/map-items/menus/LayersMenu.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: show and hide range rings from Layers"`

### Task 7: Rings on the map

**Files:**
- Create: `src/features/map-items/ring-selectors.ts`, `src/features/map/layers/RingsLayer.tsx`
- Modify: `src/features/map/layers/styles.ts`, `src/features/map/MissionMap.tsx` (render `<RingsLayer missionId={missionId} />` between `PolygonsLayer` and `LinesLayer`)
- Test: `src/features/map-items/ring-selectors.test.ts`, `src/features/map/layers/RingsLayer.test.tsx`, `src/features/map/layers/styles.test.ts`

**Interfaces:**
- Consumes: Task 2 `ringRadiusM`. Task 3 `observeRingItemIds`. `circleRing`, `pointCoord`, `decomposeSidc`, `hiddenFilter`, `observeHiddenItemIds`, `observeMissionItems`.
- Produces:
  - `createRingFeatureSelector(): (items: readonly MapItemSnapshot[]) => FeatureCollection<Polygon>`. There is one feature per item with a ring radius, with a closed ring (first point repeated) and `properties: { id, affiliation }`. Features are cached by `id + updatedAt`.
  - `RING_FILL_OPACITY = 0.12`.
  - `makeRingFillStyle(colors)`: fill color matches the `affiliation` property to the `friendly` / `hostile` / `neutral` / `unknown` tokens, with `fillOpacity` set to `RING_FILL_OPACITY`.
  - `makeRingHaloStyle(colors)`: `point-symbol-halo`, width 4.
  - `makeRingLineStyle(colors)`: the affiliation color, width 2.
  - `RingsLayer({ missionId })`:
    - One `ShapeSource id="rings"` with **no** `onPress`.
    - `FillLayer id="rings-fill"`, `LineLayer id="rings-halo"` and `LineLayer id="rings-line"`, all filtered by `['all', ['in', ['get','id'], ['literal', ringIds]], hiddenFilter(hiddenIds)]`.
    - It takes no `excludeId`, so a unit's ring stays visible while its details are open.

- [ ] **Step 1: Write failing tests:**
  - Selector:
    - Artillery with an 18 km range gives one feature, and every ring vertex is about 18,000 m from the center (within 1 m, via `inverse`).
    - The ring is closed.
    - Infantry gives no feature.
    - The same `updatedAt` returns the same feature object.
    - A moved unit (new geometry and `updatedAt`) gives a ring centered on the new spot.
  - Styles: `makeRingFillStyle(colors).fillOpacity === 0.12`, and the color match maps `hostile` to `colors.hostile`.
  - Layer:
    - The filter contains the ring id only after `setItemShowRing(id, true)`.
    - A hidden unit's id appears in the filter's `hiddenFilter` part.
    - `ShapeSource.rings.onPress` is undefined.
- [ ] **Step 2: Run.** `npx jest src/features/map-items/ring-selectors.test.ts src/features/map/layers`. Expected: FAIL.
- [ ] **Step 3: Implement**, then add the layer to `MissionMap.tsx`.
- [ ] **Step 4: Run** the full checks: `npx tsc --noEmit && npx expo lint && npx jest`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: draw unit range rings on the map"`
- [ ] **Step 6: Device check.** Run the app (`run` skill). Create a hostile artillery unit with an 18,000 m threat ring and turn on its ring. Confirm a red ring with a light tint shows under the symbols and labels and that the imagery reads through it. Tune `RING_FILL_OPACITY` if needed and commit any change.
