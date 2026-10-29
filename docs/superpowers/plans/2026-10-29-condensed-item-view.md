# Condensed Unit and Point View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Units and points open as a compact summary (identity, location card, action row, notes) and expand into a denser paired form only when editing or adding.

**Architecture:** `EditItemPanel` keeps owning load/save/delete, but for the `unit` and `point` categories it renders a new
view body (`menus/view/`) while locked and the form only while editing; lines and polygons keep today's locked-form flow.
The view's header is the panel's one `MenuHeader`, given a custom `summary` in place of its title. Edit-form changes
are layout only (paired columns, a ring box, a two-line location status) on the existing draft store.

**Tech Stack:** Expo / React Native, NativeWind, zustand (draft store), WatermelonDB behind commands, jest-expo +
@testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-10-29-condensed-item-view-design.md` (mockups in `docs/design/mockups/condensed-item/`; ignore their Armor ring and read their vertical range as ft).

## Global Constraints

- Work in `map/` on branch `feat/condensed-item-view`. Never add Co-Authored-By or any trailer to commits.
- Only artillery (threat range, m) and air defense (horizontal range m, vertical ceiling **ft**) have rings; every other unit type has none.
- No copy button, and no new dependencies.
- Commands are the only write path (`src/features/map-items/commands.ts`); the UI never imports WatermelonDB.
- Semantic color tokens only; `active:opacity-60` on every Pressable; colors in JS from `useTheme().colors`.
- One `MenuHeader` per menu; shared UI pieces go in `src/components/menu/`.
- Lines and polygons keep today's locked-form view, Hidden toggle and Delete button unchanged.
- Carry over unchanged: auto-naming, stale-link category hand-over, "That … no longer exists." handling, ring switch reset when a range is cleared, range rounding after save, Delete's second-tap confirm (`ARM_TIMEOUT_MS` 4000).
- Verification for every task: `npx tsc --noEmit -p .` clean, `npm run -s lint` clean, the task's tests pass; the final task runs the full `npx jest`.
- Don't reformat whole files with prettier; edit in place, matching the surrounding style (long single-line JSX is normal here).

## Review Focus

1. A long name or long subtitle ("Unknown · Air defense · Battalion") must truncate on one line and never push Edit off the header — Task 3 test.
2. The Coordinates setting on lat/lon: the location card's label reads `LAT/LON` and shows the lat/lon text — Task 3 test.
3. Saving an edit returns to the view showing the new values (renamed header, new subtitle, new ring row) — Task 4 test.
4. Air defense with only the vertical range set: Ring button disabled (no ring radius) and the ring row shows only `↕ 900 ft ceiling` — Task 3 test.
5. In OP mode DIST/DIR are measured from the OP, not from you — Task 3 test.

---

### Task 1: Menu primitives

**Files:**
- Modify: `src/components/menu/MenuHeader.tsx`, `src/components/menu/MenuActions.tsx`
- Create: `src/components/menu/use-armed.ts`, `src/components/menu/MenuTileButton.tsx`, `src/components/menu/MenuColumns.tsx`
- Test: `src/components/menu/primitives.test.tsx`

**Interfaces:**
- Produces:
  - `MenuHeaderProps` gains `summary?: ReactNode`. When set, `MenuHeaderRow` draws it left-aligned and growing (`flex-1`) in place of the centered title text. `title` stays the accessible header name: render it as an `accessibilityRole="header"` label on the summary's wrapper.
  - `MenuHeaderAction.iconOnly` also works for `leading`: a square outlined button, 44×44, icon only, with `label` as its accessible name.
  - `useArmed(): { armed: boolean; arm: () => void; disarm: () => void }`. It disarms by itself after `ARM_TIMEOUT_MS`. Move the timer logic out of `MenuActions` into this hook and keep `MenuActions` working as it does today.
  - `MenuTileButton({ label, icon, onPress, tone = 'default', active = false, disabled = false })`:
    - A flex-1 tile with the icon above the label, bordered with `rounded-xl`.
    - `tone`: `'default' | 'danger'`. `danger` uses a danger border and text, and becomes `bg-danger` with on-accent text while `active` (armed).
    - In the default tone, `active` shows `border-accent bg-accent-subtle` with an accent icon and text.
    - Accessible as a button named `label`, with `accessibilityState={{ selected: active, disabled }}`.
  - `MenuColumns({ children })`: lays its children out in equal flex-1 columns with `gap-3`, each child wrapped in `<View className="flex-1">`.

- [ ] **Step 1: Write failing tests** in `primitives.test.tsx`:
  - `MenuHeader with a summary draws it in place of the title, keeping the title as the header name`: render `<MenuHeader title="HOS-4" summary={<Text>SUMMARY</Text>} leading={{ label: 'Close', icon: 'close', iconOnly: true, onPress }} trailing={{ label: 'Edit', icon: 'pencil', onPress: edit }} />`. Expect `getByText('SUMMARY')`, `getByRole('header', { name: 'HOS-4' })`, `queryByText('Close')` null, and that pressing `getByLabelText('Close')` calls `onPress`.
  - `MenuTileButton is a labelled button with active and disabled states`: `getByRole('button', { name: 'Ring' })` is selected when `active`, and disabled presses don't call `onPress`.
  - `useArmed via MenuActions still needs a second tap and disarms after ARM_TIMEOUT_MS`: the existing MenuActions tests must stay green unchanged.
  - `MenuColumns puts each child in an equal column`: two children render inside two `flex-1` wrappers.
- [ ] **Step 2: Run** `npx jest src/components/menu/primitives` and expect the new tests to FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** `npx jest src/components/menu` and expect PASS, then run tsc and lint.
- [ ] **Step 5: Commit** `feat: menu header summary, icon-only leading, tile button, columns, useArmed`

### Task 2: Draft `focusItem` (Center on the viewed item)

**Files:**
- Modify: `src/stores/draft.ts`
- Test: `src/stores/draft.test.ts`

**Interfaces:**
- Produces: `focusItem(): void` on the draft store. While `coord` is set, it bumps `coordRev` and sets `coordSource: 'item'` without changing `coord`, and it works while `locked`. With no `coord` it does nothing. `MissionMap`'s draft subscription already moves the camera on a `coordRev` bump whose source is not `crosshair` or `draw`, so no map change is needed.

- [ ] **Step 1: Failing test** `focusItem re-centers on the draft's coord while locked`: start an edit draft with a coord, set it locked, call `focusItem()`. Expect `coordRev` to go up by 1, `coordSource` to be `'item'` and `coord` to be unchanged. With `coord` null, nothing changes.
- [ ] **Step 2: Run** `npx jest src/stores/draft` and expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it again and expect PASS. Then add one assertion to an existing MissionMap/MapScreen camera test if one already checks the draft-follow path, or skip that if none does.
- [ ] **Step 5: Commit** `feat: draft focusItem recenters the map on the item being viewed`

### Task 3: View components

**Files:**
- Create in `src/features/map-items/menus/view/`: `item-summary.ts`, `ItemTitle.tsx`, `LocationCard.tsx`, `ItemActions.tsx`, `NotesPreview.tsx`, `ItemView.tsx`
- Test: `src/features/map-items/menus/view/item-summary.test.ts`, `src/features/map-items/menus/view/ItemView.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`MenuTileButton`, `useArmed`) and Task 2 (`focusItem`); `MapItemSnapshot`, `decomposeSidc`, `UNIT_TYPES`, `ECHELONS`, `typeLabel`, `rangeFieldsForSidc`, `ringRadiusM`, `describeVector`, `formatCoordinate`, `formatLength`, `useReadoutOrigin`, `setItemHidden`, `setItemShowRing`, and `observeHiddenItemIds` / `observeRingItemIds`.
- Produces:
  - `unitSubtitle(sidc: string | null): { affiliation: Affiliation | null; text: string }`:
    - The text is `Affiliation · Unit type · Echelon`, using `AFFILIATION_LABELS` (moved to `src/features/symbology/presets.ts` as an export and used by `UnitForm` too), the `UNIT_TYPES` labels and the `ECHELONS` labels, "Unspecified" included.
    - A SIDC that `decomposeSidc` can't read gives `{ affiliation: null, text: 'Unknown' }`.
  - `pointSubtitle(sidc: string | null): string`: `typeLabel(sidc) ?? 'Unknown'`.
  - `ringSummary(item): string | null`:
    - `null` for non-ring units.
    - Artillery: `800 m`.
    - Air defense: `↔ 1200 m · ↕ 900 ft ceiling`, leaving out whichever part is null.
    - Either type with nothing set: `No range set — Edit to add`.
  - `ItemView({ category, item, onEdit, onDeleted })`: the view body, made of `LocationCard`, `ItemActions` and `NotesPreview`.
    - `onEdit` unlocks the draft.
    - `onDeleted` is called after a successful delete (EditItemPanel closes).
  - `ItemTitle({ category, item, hidden })`: the header summary.
    - The `SymbolImage` of `item.sidc`, the name (`font-mono-bold`, `numberOfLines={1}`), and a subtitle line (`numberOfLines={1}`). In the unit subtitle, the affiliation word takes its affiliation color: friend `colors.friendly`, hostile `colors.danger`, and the existing tokens for neutral and unknown (the implementer picks the existing token each one uses on the map).
    - A `HIDDEN` tag (`testID="hidden-tag"`) when `hidden` is true.
- View content, in the spec's order:
  - **LocationCard**:
    - Label `MGRS` or `LAT/LON` (from `coordinateFormat`), then `formatCoordinate(coord, format)`. Take `coord` from the locked draft.
    - Three cells: `DIST` / `DIR` from `useReadoutOrigin().from` via `describeVector` (angle unit, north reference and declination from settings; DIR shows `bearingLabel` and `refLabel`), and `ELEV` from `formatLength(item.elevationM, altitudeUnit)`. Unknown values show `—`.
    - A ring row (`testID="ring-row"`) with `RING` and `ringSummary(item)` when that isn't null.
  - **ItemActions**:
    - Center calls `focusItem()`.
    - Hide/Show calls `setItemHidden`. It's labelled `Show` and `active` while hidden.
    - Ring, for ring units only, calls `setItemShowRing`. It's `active` while the id is in the ring ids and disabled when `ringRadiusM(item) === null`.
    - Delete uses `tone="danger"` and `useArmed`. Its label is `Delete`, then `Tap again` while armed. It calls `deleteItem`.
    - Errors report as today: `Could not change visibility.`, `Could not change the ring.` and `Could not delete the <noun>.`.
  - **NotesPreview**: the notes text in a plain block, or a dashed `No notes — tap to add` row. It's a button labelled `Notes` or `Add notes`, and tapping it calls `onEdit`.

- [ ] **Step 1: Failing pure tests** in `item-summary.test.ts`, with the spec's values: hostile armor platoon gives `{ affiliation: 'hostile', text: 'Hostile · Armor · Platoon' }`; an unreadable SIDC gives `'Unknown'`; `ringSummary` covers artillery 800 (`'800 m'`), air defense 1200/900 (`'↔ 1200 m · ↕ 900 ft ceiling'`), air defense with only vertical 900 (`'↕ 900 ft ceiling'`), artillery with nothing set (`'No range set — Edit to add'`) and a recon unit (`null`).
- [ ] **Step 2: Failing render tests** in `ItemView.test.tsx`, with the providers and DB setup used by `EditUnitMenu.test.tsx`:
  - The card shows the MGRS of the item, then DIST/DIR/ELEV.
  - With `coordinateFormat: 'latlon'` the label is `LAT/LON` (Review Focus 2).
  - With OP mode on at a known point, DIST matches `describeVector(opAt, coord)` (Review Focus 5).
  - Air defense with only vertical has `Ring` disabled and the ring row reads `RING↕ 900 ft ceiling` (Review Focus 4).
  - Recon has no `Ring` button and no ring row.
  - Hide → the item is hidden and the button reads `Show`. Ring → the item's show_ring is on and the button is selected.
  - Delete needs two taps.
  - Center bumps the draft `coordRev`.
  - Tapping `Add notes` calls `onEdit`.
  - `ItemTitle` with a 40-character name and a long subtitle keeps both at `numberOfLines={1}` (Review Focus 1).
- [ ] **Step 3: Run** `npx jest src/features/map-items/menus/view` and expect FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** the tests again and expect PASS, then tsc and lint.
- [ ] **Step 6: Commit** `feat: condensed item view components (title, location card, actions, notes)`

### Task 4: EditItemPanel switches units and points to the condensed view

**Files:**
- Modify: `src/features/map-items/menus/EditItemPanel.tsx`
- Test: `src/features/map-items/menus/EditUnitMenu.test.tsx`, `EditPointMenu.test.tsx` (update); `EditLineMenu.test.tsx` and `EditPolygonMenu.test.tsx` must pass unchanged

**Interfaces:**
- Consumes: Task 1 (`summary`, icon-only leading) and Task 3 (`ItemView`, `ItemTitle`).

Behavior:
- `category` is `'unit'` or `'point'` and the draft is locked:
  - The header is `MenuHeader title={item.name} summary={<ItemTitle …/>}`. The leading button is icon-only `{ label: 'Close', icon: 'close' }`, or `{ label: 'Back', icon: 'chevron-left' }` when drilled in. The trailing button is `Edit`.
  - The body is `<ItemView>`. The form, the Hidden toggle and `MenuActions` are not rendered.
- Editing (unlocked): the header is unchanged from today (Cancel · `Edit <noun>` · Save). The body is `{form}` only, with no Hidden toggle and no Delete.
- Lines and polygons: exactly today's code path.

- [ ] **Step 1: Update and add tests.**
  - `EditUnitMenu.test.tsx` opens to the view: no `Name` text field, the header button named `Close`, `Edit` present, and the `Hidden on map` toggle gone.
  - Tapping Edit shows the form. Cancel returns to the view.
  - Rename and save: the header shows the new name and the view is back (Review Focus 3).
  - Deleting from the view closes the menu with the existing success path.
  - Opened from Layers (drilled in), the leading button is named `Back`.
  - Rewrite the existing tests that drove the locked form, the Hidden toggle or `MenuActions` against the view's buttons; keep what each one checks.
  - Make the matching changes for points in `EditPointMenu.test.tsx`.
- [ ] **Step 2: Run** `npx jest src/features/map-items/menus` and expect the new tests to FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx jest src/features/map-items src/features/map` and expect PASS, with the line and polygon tests untouched. Then run tsc and lint.
- [ ] **Step 5: Commit** `feat: units and points open condensed and expand into the form to edit`

### Task 5: Location status line (layout A)

**Files:**
- Modify: `src/components/menu/MgrsInput.tsx`, `src/features/map-items/menus/form/LocationSection.tsx`, `src/features/map-items/menus/form/ElevationRow.tsx`
- Test: `src/components/menu/MgrsInput.test.tsx`, plus a new `src/features/map-items/menus/form/LocationSection.test.tsx`

**Interfaces:**
- Produces:
  - `MgrsInput` gains `showStatus?: boolean`, default `true`. When `false` it renders only the four fields, so other callers stay unchanged.
  - `LocationSection` renders `MgrsInput showStatus={false}`, then a row with the status text on the left (`flex-1`, two lines) and `CenterButton` and `Map` on the right (compact, not full-width halves).
  - Line 1 (`testID="location-status"`) shows one of:
    - ✓ (success) with `<distance> · <bearing> <ref>` when the fields are valid and you have a position;
    - ✓ with `Valid` when they're valid but you have no position;
    - the MGRS error in danger when they're invalid;
    - nothing when they're empty.
  - Line 2 (`testID="location-elevation"`) shows `ELEV <value>` via `ElevationRow` with a new `inline` variant. Its lookup behavior is unchanged, and it's left out for polygon centers as today.
  - The "Tap the map where the … should go" hint stays under the row.
- Ruling: polygon circle centers also use `LocationSection`, so they get line 1 too. That only changes layout; their flow is unchanged.

- [ ] **Step 1: Failing tests.**
  - With a valid coord and a self position, `location-status` reads `1.46 km`-style text containing `·`, and `location-elevation` starts with `ELEV`.
  - Invalid fields show the error.
  - With `showStatus` left at its default, `MgrsInput` still renders `mgrs-status`. With `showStatus={false}` it doesn't.
  - CTR and Map are both present and still work (the existing tests).
- [ ] **Step 2: Run** them and expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx jest src/components/menu src/features/map-items` and expect PASS, then tsc and lint.
- [ ] **Step 5: Commit** `feat: location status as two stacked lines beside CTR and Map`

### Task 6: Paired unit and point forms, ring box

**Files:**
- Modify: `src/features/map-items/menus/UnitForm.tsx`, `PointForm.tsx`, `form/UnitRangesSection.tsx`
- Test: `src/features/map-items/menus/AddUnitMenu.test.tsx`, `EditUnitMenu.test.tsx`, `AddPointMenu.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 1 (`MenuColumns`) and Task 3 (`AFFILIATION_LABELS` export).
- Layout:
  - **UnitForm:**
    - `MenuColumns` with Name and Affiliation (the existing icon-only `MenuSegmented`).
    - `LocationSection`.
    - `MenuColumns` with Unit type and Echelon.
    - `UnitRangesSection`.
    - `NotesSection`.
  - **PointForm:** `MenuColumns` with Name and Point type, then `LocationSection`, then `NotesSection`.
  - **UnitRangesSection:**
    - For a ring type it renders one bordered box (`testID="ring-box"`). The header row has a ring icon (`record-circle-outline`), `THREAT RING` and, in edit mode, the existing `RingSwitch` restyled as a compact `Show on map` switch. The switch keeps every one of today's display rules: saved range only, hidden in Add, and the type check.
    - Artillery: one field labelled `Threat range`, with `m` beside it.
    - Air defense: `MenuColumns` with `Horizontal` (m) and `Vertical (ceiling)` (ft).
    - Any other type renders a slim muted strip (`testID="no-ring"`) reading `No threat ring for <Type label> units`, or `No threat ring for this unit type` when the type is Unspecified.
    - Validation and parsing are unchanged.
  - **NotesSection** is unchanged (it's still used by lines and polygons).

- [ ] **Step 1: Failing tests.**
  - In AddUnitMenu: Name and Affiliation render side by side in one `MenuColumns`; for a Recon draft, `no-ring` reads `No threat ring for Recon units`; for air defense, `ring-box` holds both fields and no `Show on map` switch (Add).
  - In EditUnitMenu: an artillery unit with a saved range shows `Show on map` in the ring box while editing, and toggling it updates the ring immediately (today's behavior).
  - In AddPointMenu: Name and Point type share a row.
- [ ] **Step 2: Run** them and expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full `npx jest`, then tsc and lint, and expect all green (except the known MapScreen timeout flake; rerun it alone if it trips).
- [ ] **Step 5: Commit** `feat: paired unit and point forms with a threat ring box`
