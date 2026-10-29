# Unit range rings

## Why

Artillery and air defense units have a reach that matters more than where they sit. Today a unit is only a symbol, so
the user has to remember or work out how far each gun or air defense site can shoot. The user wants to enter that reach
on the unit and see it as a ring on the map. Sometimes that's one unit's ring, to plan around a single threat.
Sometimes it's every ring at once, to see coverage and gaps.

Everything is still stored on the device. A backend with sync will come later, and the ranges are information other
users will want to see once it does.

## Goals

- An artillery unit can have a **threat ring** distance, entered in meters.
- An air defense unit can have a **horizontal range** (meters) and a **vertical range** (feet).
- A unit with a ring distance (threat ring or horizontal range) can show a ring on the map with that radius, centered
  on the unit. Each unit's ring is turned on or off by itself.
- One action shows every ring and one action hides every ring.
- "Hidden on map" can be switched without entering edit mode (a small change the user asked for along with this one).

## Non-goals

- Drawing the vertical range. It is shown in the unit's details only.
- Ranges for any unit type other than artillery and air defense.
- Minimum-range (inner) rings, sectors or arcs of fire, terrain masking, or altitude bands.
- A meters/km or feet/meters choice for these fields. Units are fixed as below.
- Sync. The data just has to be ready for it.

## Anti-goals

- A ring that appears without the user turning it on. Adding or editing a range never turns a ring on.
- Rings that hide the map: the tint must stay light enough that imagery and other items read through it.
- One user's ring on/off choices being shared once sync exists. That choice is per device.

## Entering ranges

- The unit form (add and edit) gets a new section right after **Echelon**. It shows only when the unit type is
  Artillery or Air defense:
  - Artillery: **Threat ring**, a number in **meters**.
  - Air defense: **Horizontal range** in **meters** and **Vertical range** in **feet**.
- Each field shows its unit beside the input, and all fields are optional. There is no meters/km toggle, unlike the
  circle radius field.
- Whole numbers only, greater than 0. Builder's call: also accept a comma as the decimal separator and round, the way
  the circle radius field does. Empty means "no range".
- Limits (our call): ring distances (threat ring and horizontal range) up to 500 km, the same as `MAX_RADIUS_M` for
  circle polygons. Vertical range up to 100,000 ft. Out-of-range values disable Save the way an invalid circle radius
  does today.
- If the unit type is changed to anything other than artillery or air defense, its ranges are **cleared on save** (our
  call). Switching between artillery and air defense also clears whichever fields don't apply to the new type. Because
  the ring distance is cleared, the ring goes away with it.
- Whenever a unit's ring distance is cleared (by a type change or by emptying the field), its ring switch is **reset
  to off** in the same save (our call). Otherwise entering a range again later would bring the ring back by itself,
  which breaks the first anti-goal.

## Viewing

- The unit's details (the read-only panel before Edit) show the range values in the same section.
- The vertical range is shown there and nowhere else.

## Turning rings on and off

- **Per unit:** once a unit has a saved ring distance, its details show a **"Show ring on map"** switch below the
  range fields. It works in the read-only details *and* in edit mode. It starts **off**, and entering or changing a
  range never turns it on. Turning it on draws the ring right away.
- **All units:** the **Units tab of the Layers menu** gets **"Show all rings"** and **"Hide all rings"**:
  - Each sets every unit's per-unit switch. It is not a separate override, so after "Hide all rings" every ring is off
    and stays off until turned on again.
  - They apply to every unit in the Units tab, **not narrowed by the search box**. This matches the existing
    Hide all / Show all, which also cover the whole tab, and it fits the user's statement that "Hide all" turns every
    ring off. Units without a ring distance are ignored.
  - Each unit row in that tab that has a ring distance shows whether its ring is on, and tapping that indicator
    toggles it.
- **Hidden on map** in the unit details becomes usable without tapping Edit, for every item kind that has it, not only
  units. It keeps working in edit mode too.
- Ring on/off is per-device view state, like "hidden". It persists across restarts.

## On the map

- A ring is a geodesic circle centered on the unit, with a radius equal to the threat ring distance (artillery) or the
  horizontal range (air defense). Reuse `circleRing` from `polygon-measure.ts`.
- Style (the user picked option A from the mockups): a **solid line in the unit's affiliation color** (the
  `friendly` / `hostile` / `neutral` / `unknown` tokens, the same as the symbols) with a dark halo like polygon outlines,
  and a **light fill of the same color**. Mockups used about 12% opacity. Builder tunes it on a device. Overlapping
  rings simply tint darker where they overlap.
- Rings draw beneath unit and point symbols and labels, so they never cover a symbol. Builder decides where they sit
  relative to polygons and lines.
- A unit that is hidden on the map also hides its ring, whatever the ring switch says.
- A ring follows the unit's saved position. Builder's call whether it also follows the draft position while the unit is
  being moved in edit mode.
- No label on the ring.

## Data

- The three range values are **shared data** stored on the unit (`map_items`), so they sync later. They are new
  optional columns, which means a schema version bump with an append-only migration (rule 6 in the data-layer skill).
  Builder picks the column names and whether they are separate columns or part of `style`. They must say their unit:
  meters for the two ring distances, **feet for vertical range**. Our call: store vertical range in feet, as entered,
  so it never drifts through conversion.
- **Ring on/off** is view state and goes in the local-only `item_view_state` table (rule 5), alongside `hidden`, for
  example a `show_ring` column. No row, or a null value, means off.
- Writes go through commands in `features/map-items/commands.ts`, which extend `placePoint` / `updateItem` for the
  ranges and add commands to set ring visibility for one or many items (mirroring `setItemHidden` /
  `setItemsHidden`).
- The map's `observeWithColumns` lists must include the new columns so rings update when a range changes.

## Left to the builder

- Column names and storage shape (as above).
- The layer order of rings relative to polygons and lines, the exact tint opacity and line width.
- Whether the ring follows the draft position while the unit is being moved.
- The look of the ring indicator on Layers rows. It should be a clear on/off state that's easy to tap.
- Tests, per the repo's existing patterns (schema/migration test, commands, draft store, unit menus, a ring layer
  test).
