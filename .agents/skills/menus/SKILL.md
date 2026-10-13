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
   `src/components/menu/*`: `MenuHeader`, `MenuSection`, `MenuRow`, `MenuButton`,
   `MenuToggle`, `TextField` (shared, in `src/components/ui`), `MenuSegmented`, `MenuSelect`, `MenuActions`, `MenuListItem`,
   `MenuVertexRow` (one point of a line), `MgrsInput`.
   No raw colors, no new one-off controls — add a primitive instead.
3. **Definition** — in the same file:
   `export const xMenu = defineMenu({ id, family, title, detents, component })`.
4. **Register** — add it to `MENU_REGISTRY` in `src/features/menus/registry.ts` (the type
   forces every `MenuId` to be registered).
5. **Open** — `useMenu.getState().openMenu(id, params)` (replaces the stack) or `pushMenu`
   (drill-in, `back()` returns). Invalid params are rejected and logged.

## Conventions
- **Families:** `app` menus have a leading "Close"; `action` menus have "Cancel" plus one amber
  primary action (`trailing`) that is disabled until the input is valid.
- **Detents:** smallest first; menus open at `half` when listed. Landscape is always a drawer.
- **The map stays interactive.** No backdrop. While a panel is open the camera is padded by
  the panel area, the crosshair centers in the visible map, and the readout, zoom buttons and
  location banner hide (`MissionMap`).
- **No system dialogs.** Destructive actions use `MenuActions` (second tap confirms).
- **Writes** go through commands; report failures with `notifyError`, successes with
  `notifySuccess` (`src/features/feedback/feedback.ts`). Lock double taps with a ref.
- **Draft state** (points being added or edited) lives in `stores/draft.ts`, never the DB.
  Clear it in the menu's unmount cleanup.
- Menu content must not depend on orientation for its own state: the Panel keeps it mounted
  across rotation.

## Tests
Render a menu directly with `renderWithProviders(<XMenu params={…} missionId="m1" />)`, or
through `<MenuHost landscape={false} missionId="m1" />` after `openMenu(…)` to test closing.
Reset `useMenu`, `useDraft`, `useToast` in `beforeEach`.

## Item menus

Units and points each have an Add and an Edit menu (`unit.add`, `unit.edit`, `point.add`,
`point.edit`). They share `AddItemPanel` / `EditItemPanel` (header, Add/Save/Cancel, Hidden,
Delete) and differ only in the form passed in. Open an existing item with
`openItemMenu(itemId, sidc)`, which picks the right menu by category.
