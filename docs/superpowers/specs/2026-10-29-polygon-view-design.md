# Condensed polygon view

## Intent

The unit and point menus now open as a compact view and expand into the form only for editing
(`2026-10-29-condensed-item-view-design.md`). This does the same for **polygons**: the view mode is redesigned from the
user's mockups (`docs/design/mockups/polygon-view/portrait-polygon-display-mode.png` and
`landscape-polygon-display-mode.png`; only the menu matters, ignore the rest of each screen). The goal is the same as
for units: better UX and less screen space.

Where the two mockups differ, this document wins: the **landscape mockup is an earlier variant** (its expanded list
with "tap to center", shortened `TO CTR` / `PERIM` labels, subtitle without the point count, and identity in the header
are all superseded). Both orientations use one layout: the header and identity block as below, full labels
(`TO CENTER`, `PERIMETER`), the point count in the subtitle, and the collapsed points row.

**Edit mode stays as it is**, with one exception: its points list gets a new, plainer look (below), shared with lines.

Lines keep today's menu; they get their own rework later.

## Built on

This work sits on the `feat/condensed-item-view` branch (not yet merged) and reuses its pieces: the view's
`ItemTitle`-style identity block, the black data card with dividers (`LocationCard`), `MenuTileButton` actions with
`useArmed` Delete, `NotesPreview` (tap opens Edit with Notes focused), and the scroll-to-top after Save/Cancel.

## View mode (polygons)

Top to bottom:

1. **Header**, exactly like units and points: ✕ Close (‹ Back when drilled in from Layers) · `POLYGON` · Edit.
2. **Identity block** (above the card, like units): the polygon's sample icon (`PolygonSample`, its type's color and
   style), the **name**, and a one-line subtitle:
   - points polygon: `<Type> · <N> points · <fill>% fill`, e.g. `Objective · 7 points · 15% fill`;
   - circle: `<Type> · <fill>% fill`.
   The type word is in the polygon's map color (as the unit's affiliation word is). A hidden polygon shows the same
   HIDDEN tag. Read out as one line by screen readers.
3. **Data card** (black, dividers, like the unit card):
   - Top row: `CENTER` and the center's coordinate in the user's format (`LAT/LON` label under the lat/lon setting). The
     center is the circle's center, or for a points polygon the same center its map label uses (`ringCenter`). **No
     copy button** (no clipboard dependency, as for units).
   - Three cells:
     - `TO CENTER`: distance from you to the center (from the OP in OP mode, like the unit card's DIST), amber. Distance
       only, no direction. A dash with no position.
     - `PERIMETER` (points polygon) or `RADIUS` (circle).
     - `AREA`.
   - Numbers large, units small and muted, as in the unit card (`1.81 km`, `2.87 km`, `0.53 km²`): the existing
     `formatDistance` / `formatArea` text, split at its last space into number and unit the way the unit card's cells
     already do. No new unit rules; the app has no imperial distance setting.
4. **Action row** (`MenuTileButton`s, same size as the unit's):
   - **Fit**: moves the map so the whole polygon is in view (the same fit as opening it). It must work every time, also
     after the user pans away: request it the way opening does (`focusBounds` with a bumped `focusRev`, which the map
     watches), not by re-setting identical state. Works on a hidden polygon too.
   - **Lengths** (points polygons only): the existing **Show point distances** setting (`showLineDistances`, shared
     with lines) — lit (active) while on. Tapping it toggles the setting.
   - **Hide / Show**: as for units.
   - **Delete**: red, two taps, as for units.
   Points polygons have four tiles, circles three (the tiles share the row's width equally, as on units). Lengths is not
   tied to hidden state.
5. **Points** (points polygons only): a collapsed row, **collapsed by default in both portrait and landscape**:
   three small numbered badges (1 2 3), `Points · <N>`, and `View grids ⌄` on the right. Tapping it expands the list
   inline (and collapses it again; the chevron flips). The expanded list:
   - plain rows with a thin separator line between them (no box per row);
   - a small white numbered badge, the point's coordinate, and on the right `start` (first) or `+<distance>` from the
     previous point;
   - **tapping a row centers the map on that point** (the view doesn't change; nothing is selected). Keep the current
     zoom; the move goes through the map's normal camera path (panel padding applied), and like any requested move it
     ends follow mode and any pending fit so the camera doesn't snap back.
   `View grids` is only the row's label (show the points' coordinates, in the user's coordinate format); it offers no
   other formats.
   The open/closed state resets whenever a polygon is opened (my call).
6. **Notes**: the same `NotesPreview` as units.

Circles show no points row and no Lengths tile.

## Edit mode

Unchanged (today's polygon form), except:

- **Points list restyle** (shared `MenuVertexRow`, so **line edit lists get it too**, as the user chose): no border box
  around each row; rows separated by a thin line; the numbered badge a little smaller. Selection, remove, insert-after
  and the "Inserting points" state keep working and stay recognisable (the selected row keeps an accent highlight).
- The **Show point distances** switch at the bottom of the polygon form is removed; the view's Lengths tile replaces it.
  (The line form keeps its switch until the line rework.)

## Unchanged behaviour to carry over

The polygon menu's load/save/delete, "no longer exists" handling, stale-link hand-over, Cancel restoring the saved
polygon, the camera fit on open, auto-naming, and drilled-in Back. EditItemPanel's condensed path (today for units and
points) extends to polygons; lines keep the legacy locked form.

## Constraints

- Same map repo rules as the unit view: semantic tokens only, `active:opacity-60` on every Pressable, commands as the
  only write path, the UI never imports WatermelonDB, no new dependencies, no copy button.
- Never add Co-Authored-By or any trailer to commits.

## Decided by the user

- View from the mockups; header and identity block as in the unit/point menus.
- Circles: RADIUS replaces PERIMETER; no points row; no Lengths.
- Points row collapsed by default in both orientations.
- Lengths = the shared Show point distances setting.
- The new list look applies to both polygon and line edit lists.

## My calls (check these)

- Both orientations use one layout (the landscape mockup's differences are an earlier variant).
- Full card labels (`TO CENTER`, `PERIMETER`) in both orientations; the subtitle always has the point count.

- Fit re-runs the fit the menu does on open.
- TO CENTER is distance only (the mockup shows no direction).
- A points row tap only moves the map; it doesn't select or edit the point.
- The points row's expanded state resets per polygon opened.
- The Show point distances switch leaves the polygon edit form (kept on lines for now).

## Left to the builder

Component boundaries (e.g. a polygon card beside the unit's `LocationCard`), badge size within the app's scale, and
how the camera move for a point tap is requested.
