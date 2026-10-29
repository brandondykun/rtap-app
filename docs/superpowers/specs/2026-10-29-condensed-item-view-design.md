# Condensed unit and point view

## Intent

Tapping a unit or point today opens the full form, locked, so viewing an item costs a whole screen of disabled inputs.
The user wants the menu to **condense in view mode** and **expand into the form only when editing**, to improve the UX
and save screen space, with items "laid out intentionally and smartly". The design comes from the user's portrait and
landscape mockups, saved in `docs/design/mockups/condensed-item/` (the five `portrait-*` and four `landscape-*` shots of
selected and edited units). Where they leave something out, this document fills the gap. **Ignore the threat ring the
mockups show on Armor** (see Non-goals) and read their vertical range as feet.

In the field, the user's first need when tapping a unit is to see its **name, affiliation, unit type and location**
without scrolling. Everything else ranks below those.

This is the first of several menu reworks. Units and points share one view/edit menu (`EditItemPanel`), so both get it
now. Lines and polygons wait for their own rework: **lines and polygons keep today's locked-form flow unchanged**, so
the condensed view and new edit layout apply only to the unit and point categories, and the existing line and polygon
menus and tests must keep working.

## Goals

- View mode is a compact summary: identity at the top, location card, a row of quick actions, then notes.
- Edit mode is a denser form than today's (fields paired side by side), used for both Edit and Add.
- Nothing the current menu can show or do is lost.
- Works in portrait (bottom sheet) and landscape (left drawer).

## Non-goals

- Lines and polygons (later rework).
- New unit data or behavior. Rings stay as they are: **only artillery (threat range) and air defense (horizontal
  range in m, vertical ceiling in ft) have rings.** The mockups showing an 800 m threat ring on Armor are wrong on this
  point (the mockup author did not know the rule).
- Manual elevation entry. Elevation stays looked up automatically.

## Anti-goals

- A view that hides something the user could see before (vertical range, hidden state, notes).
- Text squeezed or clipped on a narrow phone, or a layout whose height jumps as values change.

## View mode (units and points)

Top to bottom:

1. **Header row.** Leading square button: ✕ Close, or ‹ Back when drilled in from another menu (Layers), as today.
   Then the item's symbol, its **name** (large, mono, one line, truncates) and a subtitle. Trailing: **Edit** (amber).
   - Unit subtitle: `Affiliation · Unit type · Echelon`, the affiliation word in its affiliation color.
   - Point subtitle: the point type.
   - A hidden item shows a small **HIDDEN** tag beside the subtitle.
2. **Location card** (one bordered block):
   - Top row: the coordinate-format label (`MGRS`, or `LAT/LON` under the lat/lon setting) and the coordinate. **No copy
     button for now** (the mockups show one): it needs `expo-clipboard`, a native module the app does not have, which
     would need a new development build. The user chose to leave it out.
   - Below, three cells: **DIST** and **DIR** from you (or from the OP in OP mode, as the readouts do), and **ELEV**
     (the stored elevation, in the Altitude unit). Distance and direction follow the angle unit and north reference
     settings. Unknown values show a dash (no GPS fix, no stored elevation).
   - **Ring row** (artillery and air defense only), the bottom row of the card: `RING ↔ 1200 m · ↕ 900 ft ceiling` for
     air defense, `RING 800 m` for artillery. With no range set: `RING No range set — Edit to add`. **This is the only
     place the vertical range is shown in view mode.**
3. **Action row**, equal-width buttons:
   - **Center**: centers the map on the item.
   - **Hide / Show**: toggles hidden on map (works without editing, as today). Reads "Show", in its active style,
     while hidden.
   - **Ring** (artillery and air defense only): toggles the ring on the map; active (amber) while the ring is shown;
     disabled when no range is set.
   - **Delete**: red; first tap arms it ("Tap again"), second tap deletes; disarms after a pause, as today.
   - Points and non-ring units have three buttons; ring units have four.
4. **Notes.** With notes: their text in a plain block. Without: a dashed "No notes — tap to add" row. Tapping either
   enters edit mode.

## Edit mode (Edit and Add, units and points)

Header: Cancel · `EDIT UNIT` / `EDIT POINT` (`ADD UNIT` / `ADD POINT` when adding) · Save. Save stays disabled until the
form is valid, as today. Cancel in edit returns to the view with the saved values; Cancel in Add behaves as Add does
today.

1. **Name** and, beside it:
   - unit: **Affiliation**, four symbol-only buttons (screen readers still hear Friendly / Hostile / Neutral / Unknown);
   - point: **Point type** picker.
2. **Location**: `MGRS · Zone / 100K / Easting / Northing` and the four fields. Under them, **status text on the left,
   always two lines**, with **CTR** and **Map** buttons on the right:
   - line 1: `✓ 1.46 km · 6224 mils` (distance and direction from you), or the MGRS error when the fields are invalid;
   - line 2: `ELEV 126 m` (looked up automatically, as today; a dash while unknown).
   This replaces today's separate Elevation row. While picking on the map, the "Tap the map where the … should go"
   hint shows under it.
3. **Unit only: Unit type** and **Echelon** side by side.
4. **Unit only, ring box**:
   - artillery: a THREAT RING box with the **Show on map** toggle in its header and one threat range field (m);
   - air defense: the same box with **horizontal** (m) and **vertical ceiling** (ft) side by side;
   - any other type: a slim strip, "No threat ring for <type> units".
   Range validation, rounding and clearing behave as today.
5. **Notes**, last.

Hide and Delete are not in edit mode; they live in the view's action row.

## Missing or partial data

- A unit's subtitle uses the same labels as the form's pickers, including their "Unspecified" options; an unparseable
  symbol code shows `Unknown` for the parts it cannot read.
- Points always have a type (the form requires one).
- Add before a valid position: status line 1 shows the MGRS prompt/error as today and line 2 shows `ELEV —`. Add keeps
  today's start (the position comes from where Add was opened, with CTR and Map to move it).

## Ring toggle

The ring's on/off state keeps today's behavior: it is written immediately (not held until Save), both from the view's
Ring button and from the edit box's **Show on map** toggle. The edit toggle appears only once a range is saved, and not
in Add, exactly as `RingSwitch` does today. A hidden item's ring is not drawn (the rings layer already filters hidden
items), but Ring stays enabled and still flips the setting, so it shows again when the item is shown.

## Panel size

The portrait sheet and landscape drawer size to their content as today (`fitToContent`); switching from view to edit
grows the sheet, and Cancel/Save shrinks it back. The two-line status text exists so the edit form's height does not
change as values change, not to stop that view/edit resize.

## Landscape

The same content and order in the left drawer (now 350 pt minimum wide). The mockups show it fits; the paired rows
stay paired.

## Constraints

- Follow the map repo rules: commands are the only write path; the UI never imports WatermelonDB; semantic color
  tokens only; `active:opacity-60` on every Pressable; map colors from `useTheme().colors`; one `MenuHeader` per menu.
- Reuse the existing menu primitives in `src/components/menu/` where they fit; new shared pieces go there too.
- Existing behavior carried over unchanged: auto-naming, the stale-link category hand-over, the "no longer exists"
  handling, ring toggles resetting when a range is cleared, and range rounding after save.

## Decided by the user

- View mode condenses; the form appears only in edit. Priority in view: name, affiliation, unit type, location.
- Rings only for artillery and air defense; vertical range in feet.
- Status line under the MGRS fields: layout A (two stacked lines, buttons right).
- Points get the same treatment now.
- No copy button for now (no new native dependency).
- They expect to iterate on this after seeing it.

## My calls (check these)

- Notes are read in view mode; tapping them opens edit (no separate inline note editor).
- Hide and Delete leave the edit form for the view's action row.
- Add uses the new edit layout.
- HIDDEN tag beside the subtitle; Ring disabled (not hidden) for a ring unit with no range.
- The ring toggle stays immediate, as today (see Ring toggle).
- The sheet resizes between view and edit.

## Left to the builder

Component boundaries, exact spacing within the app's tokens, and how the action buttons size at the narrowest widths.
