---
name: menus
description: Use whenever you add or change a menu, panel content, or anything opened from the toolbar, a long-press or a map tap. Menus live in one Panel (bottom sheet in portrait, left drawer in landscape) and compose only the menu primitives.
---

# Menus

## How a menu is built
1. **Params** — add a zod schema under the menu id in `src/features/menus/params.ts`
   (`{}` when there are none). `MenuId` and `MenuParams<I>` come from it.
2. **Component** — `src/features/<feature>/menus/<Name>Menu.tsx`, typed
   `MenuComponentProps<'<id>'>` (`params`, `missionId`). Compose only
   `src/components/menu/*`: `MenuHeader`, `MenuSection`, `MenuRow`, `MenuButton`, `CenterButton`,
   `MenuToggle`, `TextField` (shared, in `src/components/ui`), `MenuSegmented`, `MenuSelect`, `MenuActions`, `MenuListItem`,
   `MenuVertexRow` (one point of a line), `MgrsInput` (backspace in an empty field hops to the previous one).
   No raw colors, no new one-off controls — add a primitive instead.
3. **Definition** — in the same file:
   `export const xMenu = defineMenu({ id, family, title, icon, component })` (`icon`: the toolbar icon, shown on the minimized drawer button).
4. **Register** — add it to `MENU_REGISTRY` in `src/features/menus/registry.ts` (the type
   forces every `MenuId` to be registered).
5. **Open** — `useMenu.getState().openMenu(id, params)` (replaces the stack) or `pushMenu`
   (drill-in, `back()` returns). Invalid params are rejected and logged.

## Conventions
- **The header is pinned.** Inside the Panel, `MenuHeader` is drawn above the scroll view (via `PanelHeaderSlot`), so
  Close / Cancel / Back and the primary action never scroll away. In portrait the header row is also the drag area (no
  grip icon or grip row). Keep one `MenuHeader` per menu, first in its tree.
- **Families:** `app` menus have a leading "Close"; `action` menus have "Cancel" plus one amber
  primary action (`trailing`) that is disabled until the input is valid.
- **Detents are the same for every menu** (`MENU_DETENTS`: peek, half, full; menus open at half). Menus don't pick
  their own, so every sheet drags and snaps alike. In portrait no detent is taller than the content needs
  (`fitToContent`), so a short menu opens just tall enough; the sheet waits for its content to be measured and then
  moves once (never toward a detent and then to the fit). The keyboard still opens the sheet fully. Landscape is always a drawer.
- **Minimizing:** the hide rail (the drawer's right edge in landscape, the sheet's top edge in portrait) slides the
  panel off screen (`panelMinimized` in the menu store) and its reopen button brings it back; nothing else happens and the
  menu stays mounted, also across rotation. Landscape: a floating spine tab on the left, and the Panel reports no frame, so
  the map, crosshair and controls use the whole screen. Portrait: a bar along the very bottom, and the Panel reports that
  bar as its frame, so the grid readouts sit on top of it. Opening, pushing or closing a menu shows the panel again.
- **The map stays interactive.** No backdrop. While a panel is open the camera is padded by
  the panel area, the crosshair centers in the visible map, the location banner hides, and the grid readouts
  stay: the full-width dock (CTR over ME) above a bottom sheet, or in landscape your card bottom
  right and the center card bottom left, right of the drawer (`MapControls`). The zoom buttons follow only their Settings toggle.
- **Acting at the crosshair** (add at center): always `CenterButton`, the crosshair glyph and the text CTR,
  never "Add at center" as visible text (it stays the screen-reader label). Other crosshair actions say CTR
  too (Move to CTR, Set edge at CTR) through `MenuButton`'s `text`.
- **The crosshair** is always `CrosshairGlyph` (`src/components/ui`), sized with `size`: white arms with
  an amber center dot by default, everywhere (the map center, CTR buttons and readouts, guides). Never draw
  a crosshair by hand or pass colors, except where amber would vanish (on an amber button: one dark color).
- **Pressed feedback.** Every `Pressable` dims with `active:opacity-60` while pressed (see the styling skill); the shared primitives already do.
- **Settings are explained on the About page.** A new setting (a toggle, or a section with a choice) gets an entry in `src/features/menus/menus/settings-help.ts`, in menu order: `name` is the toggle's label or the section's label, `choices` the options as shown, `help` one or two plain sentences. `settings-help.test.tsx` fails until it does; removing or renaming a setting updates it too.
- **No system dialogs.** Destructive actions use `MenuActions` (second tap confirms).
- **Writes** go through commands; report failures with `notifyError`, successes with
  `notifySuccess` (`src/features/feedback/feedback.ts`). Lock double taps with a ref.
- **Draft state** (points being added or edited) lives in `stores/draft.ts`, never the DB.
  Clear it in the menu's unmount cleanup.
- **Measure is not a menu.** MEASURE closes the open menu; opening any menu stops measuring
  (MissionMap). Keep it that way so the map stays clear while aiming.
- **Quick plot is not a menu either.** PLOT closes the open menu; any menu opening ends quick plot.
  Save unit / Save point hand over with `openMenu('unit.add' | 'point.add', { at })`.
- Menu content must not depend on orientation for its own state: the Panel keeps it mounted
  across rotation.
- **Drill-in** (`pushMenu`): the pushed menu shows **Back** (`back()`) instead of Close. The Panel
  remembers each entry's scroll position; keep other view state that should survive the round trip
  (search text) in `useMenuEntryState` (`src/features/menus/menu-entry-memory.ts`).

## Tests
Render a menu directly with `renderWithProviders(<XMenu params={…} missionId="m1" />)`, or
through `<MenuHost landscape={false} missionId="m1" />` after `openMenu(…)` to test closing.
Reset `useMenu`, `useDraft`, `useToast` in `beforeEach`.

## Item menus

Units, points, lines and polygons each have an Add and an Edit menu (`unit.add`, `unit.edit`,
`point.add`, `point.edit`, `line.add`, `line.edit`, `polygon.add`, `polygon.edit`). They share `AddItemPanel` / `EditItemPanel`
(header, Add/Save/Cancel, Hidden, Delete) and differ only in the form passed in and the
category's adapter in `ITEM_ADAPTERS` (`item-adapters.ts`: can it save, place, update, load a
saved item into the draft). Open an existing item with `openItemMenu(itemId, { kind, sidc })`,
which picks the right menu by `itemCategory`.

`LineForm` lists the points with `MenuVertexRow` (number, grid, distance, ×, Insert after) and a
typed-point row (`MgrsInput` + an icon-only `MenuButton`). While a line is drawn (`line.add` or an
unlocked `line.edit`), `MissionMap` shows `LineDrawBar` and routes map taps, long-presses and
symbol taps to the line draft.

`PolygonForm` switches between the points list (as `LineForm`) and a circle (`LocationSection` for
the center, a radius field with m/km).
