# Plan 3 — Menus & Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can place, edit, hide and delete points on the map through a first-class
menu system (bottom sheet in portrait, left drawer in landscape, map always interactive), and
reach the app menu and settings from the toolbar.

**Architecture:** One `Panel` (Reanimated + Gesture Handler) hosts the top of a typed menu
stack (`stores/menu.ts`, params validated with zod). Menus are registered once and compose
only the primitives in `src/components/menu/`. The in-progress point lives in a `draft`
Zustand store (never the database) and is drawn by `DraftLayer`; commands write on Add/Save.
While a panel is open the map gets camera padding equal to the panel's area, and the
crosshair sits at the center of the visible map.

**Tech Stack:** Expo SDK 57, RN 0.86, Expo Router, NativeWind 4, `@rnmapbox/maps` 10.3,
WatermelonDB 0.28, Zustand 5, Reanimated 4 + react-native-worklets, Gesture Handler 2,
`expo-haptics`, `zod` (new, JS-only), Jest + RNTL 14.

**Spec:** `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md` (Sections
8.4 camera padding, 8.5, 8.6, 11, 12, 13, 15). Mockups: `docs/design/mockups/portrait-add-point.png`,
`landscape-add-point.png`. Plan 2 decisions that bind here are in
`docs/superpowers/notes/2026-10-12-native-gate.md`.

### Roadmap

| Plan | Delivers |
|------|----------|
| 1 — Foundation | done |
| 2 — Missions & map shell | done |
| **3 — Menus & points** (this) | landscape banner fix, toast/haptics, menu store/registry/host, `Panel`, menu primitives, `MgrsInput`, `app.root` + About, `settings`, panel-aware map chrome + camera padding, draft store + `DraftLayer`, `point.add` (POINT tool, long-press), `point.edit` (tap a point), `menus` + `map-item-kinds` skills |

**Design decisions this plan makes (spec is silent or Plan 2 changed the context):**
- While a panel is open, the readout card, zoom buttons and location banner are hidden; recenter
  stays (lifted above the sheet in portrait). This matches the add-point mockups.
- In landscape the Mapbox logo row shifts right of the drawer so it stays visible (Mapbox terms).
- Menu params are declared in `features/menus/params.ts` (zod) apart from the menu components, so
  the menu store can validate them without importing components (avoids an import cycle).
  `defineMenu` therefore takes `id/family/title/detents/component`; the schema is looked up by id.
- The edited item is "selected" through the draft store (`draft.itemId`); `PointsLayer` hides the
  original symbol while it is being edited so only the draft is shown.
- Delete confirmation is a two-step tap inside the panel (no system dialogs).
- The settings menu shows the G-M angle at the crosshair (spec §6 "Readouts display the current
  G-M angle", which Plan 2 left out).

## Global Constraints

- Expo SDK 57 (`expo ~57.0.28`), React Native 0.86.3, React 19.2.3; React Compiler stays enabled.
- Install packages with `npx expo install <pkg>`. **No new packages with native code** (the user's EAS dev build must keep working). The only new package is `zod` (JS-only).
- Never create or edit `ios/` or `android/`. Web is not a target.
- Canonical geo forms: positions WGS84 `{ lat, lon }`; bearings true north, decimal degrees. Range/bearing text only via `describeVector`; coordinates only via `@/lib/geo` formatters/parsers.
- Mils: NATO 6400 only.
- Only `src/features/map/**` imports `@rnmapbox/maps`. Only `src/lib/db/**`, `src/features/*/repository.ts`, `src/features/*/commands.ts` import `@nozbe/watermelondb`. `src/lib/**` never imports `features/`, `stores/`, `components/`, `app/` (lint-enforced).
- All writes go through commands taking a `CommandContext` (`useCommandContext()` in UI). The draft point is never written to the database before Add/Save.
- The map camera is uncontrolled: programmatic moves and padding go through the camera ref's `setCamera`. No per-item React components on the map; layer styles are module constants or memoized per theme (see `.agents/skills/map-performance/SKILL.md`).
- Menus are not Expo Router routes; routes are only for full-screen pages (About). Menus compose only `src/components/menu/*` primitives; primitives use only semantic tokens.
- No `alert`/`confirm`/`Alert.alert` dialogs; confirmations are built into the panel.
- Colors: semantic tokens only (`bg-surface`, `text-text-muted`, `useTheme().colors.accent`); no hex literals, no raw palette classes, no opacity modifiers on tokens (`.agents/skills/styling/SKILL.md`). Map layer colors via `useTheme().colors` / `mapColors`.
- Icons only through `@/components/ui/Icon` (MaterialCommunityIcons names).
- Map chrome spacing only from `src/features/map/layout.ts` constants.
- Copy: panel titles uppercase with wide tracking (`ADD POINT`); field labels small uppercase muted with wide tracking; MGRS fields and readouts in the mono font.
- Tests: RNTL 14 — `render`, `fireEvent.*`, `act` are async; always `await` them. Wrap UI in `renderWithProviders`. `toHaveAccessibilityState` is not registered — use `toBeSelected()`, `toBeDisabled()`, `toBeEnabled()`. In `jest.mock` factories use `jest.requireActual('react')`, never `require('react')`. Never `mockRestore()` a spy on `AppState.addEventListener`.
- To toggle a `Switch` in tests use `fireEvent(el, 'valueChange', value)`; if that does not reach `onValueChange` in this RNTL version, use `fireEvent(el, 'change', { nativeEvent: { value } })` and note it in the report.
- Any test whose imports reach `@rnmapbox/maps` must call `jest.mock('@rnmapbox/maps');` (manual mock `__mocks__/@rnmapbox/maps.tsx`; read recorded props via `mapboxMock()` from `@/test-utils/mapbox-mock`).
- After adding or renaming any file under `src/app/`, regenerate typed routes before `tsc`: `npx expo export --platform ios --output-dir /tmp/rtap-typegen > /dev/null`.
- Commit messages: Conventional Commits (`.agents/skills/commits/SKILL.md`). **Never add a `Co-Authored-By` trailer or any other attribution line.**
- Before declaring any task done: `npx jest`, `npx tsc --noEmit`, `npx expo lint` (0 problems) all pass.

## Review Focus

1. **Partial or invalid MGRS while typing** (one digit short, mismatched easting/northing, wrong band): the map never jumps, Add is disabled, the draft keeps the last valid coordinate. → tests in Tasks 7 and 13.
2. **Double-tapping Add** (or Save): exactly one write per tap-completion (a ref lock while the write runs); two quick Adds never produce duplicate or empty names. → test in Task 13.
3. **Rotating the phone with a panel open:** the form keeps what the user typed (menu content is not remounted), padding and crosshair follow the new panel side, the Mapbox logo stays visible. → tests in Tasks 4 and 9.
4. **The edited point disappears** (deleted from this panel, deleted elsewhere, or corrupt geometry): the panel closes with a message, nothing crashes, nothing is written. → tests in Task 14.
5. **Long-press while a point panel is open:** moves the draft only; name, affiliation, type and notes are kept, and no second panel opens. → tests in Task 13.

---

### Task 1: Location banner never covers the toolbar

**Files:**
- Modify: `src/features/map/layout.ts`, `src/features/map/layout.test.ts`, `src/features/location/LocationBanner.tsx`, `src/features/location/LocationBanner.test.tsx`

**Interfaces:**
- Consumes: `ornamentRowTop(landscape)`, `LOGO_ROW_HEIGHT`, `EDGE`, `TOOLBAR_HEIGHT`, `GAP` (`layout.ts`).
- Produces: `bannerTop(landscape: boolean): number` — offset from the safe-area top.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/map/layout.test.ts` (import `bannerTop` with the others):

```ts
  it('puts the location banner below both the logo row and the toolbar', () => {
    for (const landscape of [false, true]) {
      expect(bannerTop(landscape)).toBeGreaterThanOrEqual(ornamentRowTop(landscape) + LOGO_ROW_HEIGHT);
      expect(bannerTop(landscape)).toBeGreaterThanOrEqual(EDGE + TOOLBAR_HEIGHT + GAP);
    }
  });
```

In `src/features/location/LocationBanner.test.tsx`, replace the `it.each` placement test with:

```tsx
  it.each([[false], [true]])('sits below the toolbar and logo row (landscape=%s)', async (landscape) => {
    await renderWithProviders(<LocationBanner landscape={landscape} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('location-banner')).toHaveStyle({ top: bannerTop(landscape) });
  });
```

and change its layout import to `import { bannerTop } from '@/features/map/layout';` (drop names no longer used).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/map/layout.test.ts src/features/location/LocationBanner.test.tsx`
Expected: FAIL — `bannerTop` is not exported.

- [ ] **Step 3: Implement**

Add to `src/features/map/layout.ts` (after `ornamentRowTop`):

```ts
/**
 * Location banner top (from the safe area): below the Mapbox logo row and below the toolbar,
 * whichever is lower. In landscape the toolbar is top-right, so the logo row alone is too high.
 */
export function bannerTop(landscape: boolean): number {
  return Math.max(ornamentRowTop(landscape) + LOGO_ROW_HEIGHT, EDGE + TOOLBAR_HEIGHT + GAP);
}
```

In `src/features/location/LocationBanner.tsx`, import `bannerTop` instead of `LOGO_ROW_HEIGHT, ornamentRowTop`, and set the style `top` to `insets.top + bannerTop(landscape),` (update the comment to "Below the Mapbox logo row and the toolbar, both of which must stay visible.").

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/layout.ts src/features/map/layout.test.ts src/features/location
git commit -m "fix: keep the location banner below the landscape toolbar"
```

---

### Task 2: Feedback — toast and haptics

**Files:**
- Create: `src/stores/toast.ts`, `src/stores/toast.test.ts`, `src/components/ui/Toast.tsx`, `src/components/ui/Toast.test.tsx`, `src/features/feedback/feedback.ts`, `src/features/feedback/feedback.test.ts`
- Modify: `jest.setup.ts`, `src/features/map/MissionMap.tsx`

**Interfaces:**
- Produces:
  - `useToast` with `toast: { id: number; message: string; kind: ToastKind } | null`, `show(message: string, kind?: ToastKind): void`, `hide(id?: number): void`; `type ToastKind = 'error' | 'info'`.
  - `Toast({ top }: { top: number })`; `TOAST_DURATION_MS = 3000`.
  - `notifySuccess(): void`, `notifyError(message: string): void`, `notifyInfo(message: string): void` from `@/features/feedback/feedback`.

- [ ] **Step 1: Add the haptics mock**

Append to `jest.setup.ts`:

```ts
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
```

- [ ] **Step 2: Write the failing tests**

`src/stores/toast.test.ts`:

```ts
import { useToast } from './toast';

beforeEach(() => useToast.setState({ toast: null }));

describe('toast store', () => {
  it('shows a toast with a fresh id', () => {
    useToast.getState().show('Boom');
    const first = useToast.getState().toast;
    expect(first).toMatchObject({ message: 'Boom', kind: 'error' });
    useToast.getState().show('Hello', 'info');
    expect(useToast.getState().toast?.id).not.toBe(first?.id);
  });

  it('hides only the toast it was asked to hide', () => {
    useToast.getState().show('Old');
    const old = useToast.getState().toast!.id;
    useToast.getState().show('New');
    useToast.getState().hide(old);
    expect(useToast.getState().toast?.message).toBe('New');
    useToast.getState().hide();
    expect(useToast.getState().toast).toBeNull();
  });
});
```

`src/components/ui/Toast.test.tsx`:

```tsx
import { act, fireEvent, screen } from '@testing-library/react-native';

import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { Toast, TOAST_DURATION_MS } from './Toast';

beforeEach(() => useToast.setState({ toast: null }));
afterEach(() => jest.useRealTimers());

describe('Toast', () => {
  it('renders nothing without a toast', async () => {
    await renderWithProviders(<Toast top={100} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the message and hides itself after the duration', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<Toast top={100} />);
    await act(async () => useToast.getState().show('Could not add the point.'));
    expect(screen.getByText('Could not add the point.')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByText('Could not add the point.')).toBeNull();
  });

  it('hides when tapped', async () => {
    await renderWithProviders(<Toast top={100} />);
    await act(async () => useToast.getState().show('Tap me', 'info'));
    await fireEvent.press(screen.getByText('Tap me'));
    expect(useToast.getState().toast).toBeNull();
  });
});
```

`src/features/feedback/feedback.test.ts`:

```ts
import * as Haptics from 'expo-haptics';

import { useToast } from '@/stores/toast';

import { notifyError, notifyInfo, notifySuccess } from './feedback';

beforeEach(() => {
  jest.clearAllMocks();
  useToast.setState({ toast: null });
});

describe('feedback', () => {
  it('plays a success haptic without a toast', () => {
    notifySuccess();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(useToast.getState().toast).toBeNull();
  });

  it('shows an error toast with an error haptic', () => {
    notifyError('Could not save the point.');
    expect(useToast.getState().toast).toMatchObject({ message: 'Could not save the point.', kind: 'error' });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it('shows an info toast without a haptic', () => {
    notifyInfo('Point hidden');
    expect(useToast.getState().toast).toMatchObject({ kind: 'info' });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/stores/toast.test.ts src/components/ui/Toast.test.tsx src/features/feedback`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`src/stores/toast.ts`:

```ts
import { create } from 'zustand';

export type ToastKind = 'error' | 'info';
type ToastValue = { id: number; message: string; kind: ToastKind };

type ToastState = {
  toast: ToastValue | null;
  show: (message: string, kind?: ToastKind) => void;
  /** Hides the current toast; with an id, only if it is still that toast. */
  hide: (id?: number) => void;
};

let nextId = 1;

export const useToast = create<ToastState>()((set, get) => ({
  toast: null,
  show: (message, kind = 'error') => set({ toast: { id: nextId++, message, kind } }),
  hide: (id) => {
    const current = get().toast;
    if (current && (id === undefined || current.id === id)) set({ toast: null });
  },
}));
```

`src/components/ui/Toast.tsx`:

```tsx
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useToast } from '@/stores/toast';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './Icon';

export const TOAST_DURATION_MS = 3000;

/** One short message at the top of the screen (command failures, confirmations). Tap to dismiss. */
export function Toast({ top }: { top: number }) {
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const { colors } = useTheme();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => hide(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;
  const error = toast.kind === 'error';
  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ top }}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => hide(toast.id)}
        className={`mx-4 flex-row items-center gap-2 rounded-2xl border bg-surface-chrome px-4 py-3 ${error ? 'border-danger' : 'border-border'}`}>
        <Icon name={error ? 'alert-circle-outline' : 'information-outline'} size={18} color={error ? colors.danger : colors.text} />
        <Text className="shrink text-sm text-text">{toast.message}</Text>
      </Pressable>
    </View>
  );
}
```

`src/features/feedback/feedback.ts`:

```ts
import * as Haptics from 'expo-haptics';

import { useToast } from '@/stores/toast';

function haptic(type: Haptics.NotificationFeedbackType): void {
  // Haptics are best-effort (simulators, low-power mode); never surface their failures.
  void Haptics.notificationAsync(type).catch(() => {});
}

/** A write succeeded (Add, Save, Delete). */
export function notifySuccess(): void {
  haptic(Haptics.NotificationFeedbackType.Success);
}

/** A command failed: toast plus error haptic (spec §12). */
export function notifyError(message: string): void {
  useToast.getState().show(message, 'error');
  haptic(Haptics.NotificationFeedbackType.Error);
}

export function notifyInfo(message: string): void {
  useToast.getState().show(message, 'info');
}
```

In `src/features/map/MissionMap.tsx`:
- import `{ useSafeAreaInsets } from 'react-native-safe-area-context'`, `{ Toast } from '@/components/ui/Toast'`, and add `EDGE, GAP, TOOLBAR_HEIGHT` to the `./layout` import;
- inside the component: `const insets = useSafeAreaInsets();`
- render `<Toast top={insets.top + EDGE + TOOLBAR_HEIGHT + GAP} />` as the last child of the root `View`.

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add jest.setup.ts src/stores/toast.ts src/stores/toast.test.ts src/components/ui src/features/feedback src/features/map/MissionMap.tsx
git commit -m "feat: add toast and haptic feedback for commands"
```

---

### Task 3: Menu params and menu store

**Files:**
- Create: `src/features/menus/params.ts`, `src/stores/menu.ts`, `src/stores/menu.test.ts`, `src/components/menu/panel-geometry.ts` (type only in this task)
- Modify: `package.json` (via `npx expo install zod`)

**Interfaces:**
- Produces:
  - `MENU_PARAMS` (zod schemas), `type MenuId = 'app.root' | 'settings' | 'point.add' | 'point.edit'`, `type MenuParams<I extends MenuId>` from `@/features/menus/params`. Params: `app.root` `{}`; `settings` `{}`; `point.add` `{ at?: { lat; lon } }`; `point.edit` `{ itemId: string }`.
  - `type PanelFrame = { side: 'bottom' | 'left'; size: number }` from `@/components/menu/panel-geometry` (size = points the panel occupies from that screen edge).
  - `useMenu` with `stack: MenuEntry[]`, `panelFrame: PanelFrame | null`, `openMenu(id, params): boolean` (replace stack), `pushMenu(id, params): boolean`, `back()`, `closeMenu()`, `setPanelFrame(frame | null)`; `type MenuEntry`; `topMenu(state): MenuEntry | null`; `INITIAL_MENU`.

- [ ] **Step 1: Install zod**

```bash
npx expo install zod
```

- [ ] **Step 2: Write the failing test**

`src/stores/menu.test.ts`:

```ts
import { INITIAL_MENU, topMenu, useMenu } from './menu';

beforeEach(() => useMenu.setState(INITIAL_MENU));

describe('menu store', () => {
  it('opens a menu, replacing the stack', () => {
    useMenu.getState().openMenu('settings', {});
    useMenu.getState().openMenu('point.edit', { itemId: 'a' });
    expect(useMenu.getState().stack).toEqual([{ id: 'point.edit', params: { itemId: 'a' } }]);
  });

  it('pushes and goes back', () => {
    useMenu.getState().openMenu('app.root', {});
    useMenu.getState().pushMenu('settings', {});
    expect(topMenu(useMenu.getState())?.id).toBe('settings');
    useMenu.getState().back();
    expect(topMenu(useMenu.getState())?.id).toBe('app.root');
    useMenu.getState().back();
    expect(topMenu(useMenu.getState())).toBeNull();
  });

  it('closes everything', () => {
    useMenu.getState().openMenu('app.root', {});
    useMenu.getState().pushMenu('settings', {});
    useMenu.getState().closeMenu();
    expect(useMenu.getState().stack).toEqual([]);
  });

  it('accepts an optional press coordinate for point.add', () => {
    expect(useMenu.getState().openMenu('point.add', { at: { lat: 38.9, lon: -77 } })).toBe(true);
    expect(useMenu.getState().openMenu('point.add', {})).toBe(true);
  });

  it.each([
    ['point.edit', { itemId: '' }],
    ['point.add', { at: { lat: 95, lon: 0 } }],
    ['point.edit', {}],
  ] as const)('rejects invalid params for %s and keeps the stack', (id, params) => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    useMenu.getState().openMenu('settings', {});
    expect(useMenu.getState().openMenu(id, params as never)).toBe(false);
    expect(topMenu(useMenu.getState())?.id).toBe('settings');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('stores the panel frame', () => {
    useMenu.getState().setPanelFrame({ side: 'bottom', size: 320 });
    expect(useMenu.getState().panelFrame).toEqual({ side: 'bottom', size: 320 });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/stores/menu.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/features/menus/params.ts`:

```ts
import { z } from 'zod';

const latLon = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

/**
 * Typed params for every menu, by id. Kept apart from the menu components so the menu store can
 * validate params without importing UI (the registry imports the components).
 */
export const MENU_PARAMS = {
  'app.root': z.object({}),
  settings: z.object({}),
  'point.add': z.object({ at: latLon.optional() }),
  'point.edit': z.object({ itemId: z.string().min(1) }),
} as const;

export type MenuId = keyof typeof MENU_PARAMS;
export type MenuParams<I extends MenuId> = z.infer<(typeof MENU_PARAMS)[I]>;
```

`src/components/menu/panel-geometry.ts` (this task adds only the type; Task 4 fills the file):

```ts
/** The screen area a panel occupies: a bottom sheet's height or a left drawer's width, in points. */
export type PanelFrame = { side: 'bottom' | 'left'; size: number };
```

`src/stores/menu.ts`:

```ts
import { create } from 'zustand';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { MENU_PARAMS, type MenuId, type MenuParams } from '@/features/menus/params';

export type MenuEntry = { [I in MenuId]: { id: I; params: MenuParams<I> } }[MenuId];

type MenuValues = { stack: MenuEntry[]; panelFrame: PanelFrame | null };

type MenuActions = {
  /** Replaces the stack with this menu. Returns false (and changes nothing) for invalid params. */
  openMenu: <I extends MenuId>(id: I, params: MenuParams<I>) => boolean;
  pushMenu: <I extends MenuId>(id: I, params: MenuParams<I>) => boolean;
  back: () => void;
  closeMenu: () => void;
  /** Published by the Panel so the map can pad its camera and move the crosshair. */
  setPanelFrame: (frame: PanelFrame | null) => void;
};

export const INITIAL_MENU: MenuValues = { stack: [], panelFrame: null };

function entry(id: MenuId, params: unknown): MenuEntry | null {
  const parsed = MENU_PARAMS[id].safeParse(params);
  if (!parsed.success) {
    console.error(`[menu] invalid params for ${id}`, parsed.error.issues);
    return null;
  }
  return { id, params: parsed.data } as MenuEntry;
}

export const useMenu = create<MenuValues & MenuActions>()((set, get) => ({
  ...INITIAL_MENU,
  openMenu: (id, params) => {
    const next = entry(id, params);
    if (!next) return false;
    set({ stack: [next] });
    return true;
  },
  pushMenu: (id, params) => {
    const next = entry(id, params);
    if (!next) return false;
    set({ stack: [...get().stack, next] });
    return true;
  },
  back: () => set({ stack: get().stack.slice(0, -1) }),
  closeMenu: () => set({ stack: [] }),
  setPanelFrame: (panelFrame) => set({ panelFrame }),
}));

export function topMenu(state: { stack: MenuEntry[] }): MenuEntry | null {
  return state.stack[state.stack.length - 1] ?? null;
}
```

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS. (If the installed zod's types make `MENU_PARAMS[id].safeParse` a union the compiler rejects, annotate `const schema: z.ZodType = MENU_PARAMS[id];` before calling `safeParse`.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/menus/params.ts src/stores/menu.ts src/stores/menu.test.ts src/components/menu/panel-geometry.ts
git commit -m "feat: add typed menu stack with validated params"
```

---

### Task 4: Panel — bottom sheet / left drawer

**Files:**
- Modify: `src/components/menu/panel-geometry.ts`, `jest.setup.ts`
- Create: `src/components/menu/panel-geometry.test.ts`, `src/components/menu/Panel.tsx`, `src/components/menu/Panel.test.tsx`

**Interfaces:**
- Consumes: `PanelFrame` (Task 3).
- Produces:
  - `type Detent = 'peek' | 'half' | 'full'`; `type PanelMetrics = { width; height; insets: { top; right; bottom; left }; topReserved: number }`
  - `detentHeights(m: PanelMetrics): Record<Detent, number>`, `drawerWidth(m: PanelMetrics): number`, `snapIndex(position: number, velocity: number, stops: readonly number[]): number` (worklet), constants `PEEK_HEIGHT`, `MIN_HALF_HEIGHT`, `HALF_FRACTION`, `DRAWER_MIN_WIDTH`, `DRAWER_MAX_WIDTH`, `DRAWER_FRACTION`, `FLING_VELOCITY`.
  - `Panel({ landscape, detents, initialDetent, topReserved, onFrameChange, children })` — testID `menu-panel`; in portrait a drag handle `menu-panel-handle`.

- [ ] **Step 1: Add the Reanimated / Worklets / Gesture Handler Jest mocks**

Append to `jest.setup.ts`:

```ts
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');
```

Run: `npx jest` — Expected: the existing suite still passes.

- [ ] **Step 2: Write the failing tests**

`src/components/menu/panel-geometry.test.ts`:

```ts
import {
  DRAWER_MAX_WIDTH,
  DRAWER_MIN_WIDTH,
  detentHeights,
  drawerWidth,
  FLING_VELOCITY,
  MIN_HALF_HEIGHT,
  PEEK_HEIGHT,
  snapIndex,
} from './panel-geometry';

const phone = { width: 390, height: 844, insets: { top: 47, right: 0, bottom: 34, left: 0 }, topReserved: 123 };
const phoneLandscape = { width: 844, height: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 }, topReserved: 76 };

describe('panel geometry', () => {
  it('computes ascending detents that leave the toolbar visible', () => {
    const h = detentHeights(phone);
    expect(h.full).toBe(844 - 123);
    expect(h.half).toBe(Math.max(MIN_HALF_HEIGHT, Math.round(844 * 0.42)));
    expect(h.peek).toBe(PEEK_HEIGHT + 34);
    expect(h.peek).toBeLessThan(h.half);
    expect(h.half).toBeLessThan(h.full);
  });

  it('never lets half exceed full on short screens', () => {
    const h = detentHeights({ ...phone, height: 360, topReserved: 100 });
    expect(h.half).toBeLessThanOrEqual(h.full);
    expect(h.peek).toBeLessThanOrEqual(h.half);
  });

  it('sizes the drawer from the screen width, including the left inset', () => {
    expect(drawerWidth(phoneLandscape)).toBe(47 + Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, Math.round(844 * 0.4))));
  });

  describe('snapIndex', () => {
    const stops = [130, 354, 721];
    it('snaps to the nearest stop when released slowly', () => {
      expect(snapIndex(200, 0, stops)).toBe(0);
      expect(snapIndex(300, 0, stops)).toBe(1);
      expect(snapIndex(600, 0, stops)).toBe(2);
    });
    it('moves one stop in the fling direction', () => {
      expect(snapIndex(360, FLING_VELOCITY + 1, stops)).toBe(2);
      expect(snapIndex(350, -(FLING_VELOCITY + 1), stops)).toBe(0);
      expect(snapIndex(721, FLING_VELOCITY + 1, stops)).toBe(2);
      expect(snapIndex(130, -(FLING_VELOCITY + 1), stops)).toBe(0);
    });
  });
});
```

`src/components/menu/Panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Dimensions, Text } from 'react-native';

import { Panel } from './Panel';
import { detentHeights, drawerWidth } from './panel-geometry';

const INSETS = { top: 0, right: 0, bottom: 0, left: 0 }; // the global safe-area mock reports zero insets
const TOP_RESERVED = 76;

function metrics() {
  const { width, height } = Dimensions.get('window');
  return { width, height, insets: INSETS, topReserved: TOP_RESERVED };
}

function Probe({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <Text>content</Text>;
}

describe('Panel', () => {
  it('opens a bottom sheet at its initial detent and publishes its frame', async () => {
    const onFrameChange = jest.fn();
    await render(
      <Panel landscape={false} detents={['peek', 'half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>,
    );
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByTestId('menu-panel-handle')).toBeTruthy();
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'bottom', size: detentHeights(metrics()).half });
  });

  it('opens a left drawer in landscape', async () => {
    const onFrameChange = jest.fn();
    await render(
      <Panel landscape detents={['half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Text>content</Text>
      </Panel>,
    );
    expect(screen.queryByTestId('menu-panel-handle')).toBeNull();
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'left', size: drawerWidth(metrics()) });
  });

  it('keeps its content mounted when the orientation changes', async () => {
    const onMount = jest.fn();
    const onFrameChange = jest.fn();
    const ui = (landscape: boolean) => (
      <Panel landscape={landscape} detents={['half', 'full']} initialDetent="half" topReserved={TOP_RESERVED} onFrameChange={onFrameChange}>
        <Probe onMount={onMount} />
      </Panel>
    );
    const { rerender } = await render(ui(false));
    await rerender(ui(true));
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onFrameChange).toHaveBeenLastCalledWith({ side: 'left', size: drawerWidth(metrics()) });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/components/menu`
Expected: FAIL — exports and `./Panel` missing.

- [ ] **Step 4: Implement**

Replace `src/components/menu/panel-geometry.ts`:

```ts
/** The screen area a panel occupies: a bottom sheet's height or a left drawer's width, in points. */
export type PanelFrame = { side: 'bottom' | 'left'; size: number };

export type Detent = 'peek' | 'half' | 'full';

export type PanelMetrics = {
  width: number;
  height: number;
  insets: { top: number; right: number; bottom: number; left: number };
  /** Space at the top a full-height sheet must leave free (safe area + toolbar). */
  topReserved: number;
};

/** Grab handle plus the menu header row. */
export const PEEK_HEIGHT = 96;
export const MIN_HALF_HEIGHT = 300;
export const HALF_FRACTION = 0.42;
export const DRAWER_MIN_WIDTH = 300;
export const DRAWER_MAX_WIDTH = 420;
export const DRAWER_FRACTION = 0.4;
/** Release velocity (points/s) above which the sheet moves one detent in the fling direction. */
export const FLING_VELOCITY = 800;

/** Bottom-sheet heights (including the bottom safe area), ascending: peek ≤ half ≤ full. */
export function detentHeights(m: PanelMetrics): Record<Detent, number> {
  const full = Math.max(PEEK_HEIGHT, m.height - m.topReserved);
  const half = Math.min(full, Math.max(MIN_HALF_HEIGHT, Math.round(m.height * HALF_FRACTION)));
  const peek = Math.min(half, PEEK_HEIGHT + m.insets.bottom);
  return { peek, half, full };
}

/** Left drawer width from the screen's left edge (includes the left safe area). */
export function drawerWidth(m: PanelMetrics): number {
  return m.insets.left + Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, Math.round(m.width * DRAWER_FRACTION)));
}

/**
 * Index of the stop to settle on after a drag. `stops` ascend; `velocity` is positive when the
 * panel is growing. A fling moves one stop in its direction; a slow release picks the nearest.
 */
export function snapIndex(position: number, velocity: number, stops: readonly number[]): number {
  'worklet';
  if (velocity > FLING_VELOCITY) {
    for (let i = 0; i < stops.length; i++) if (stops[i] > position + 1) return i;
    return stops.length - 1;
  }
  if (velocity < -FLING_VELOCITY) {
    for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < position - 1) return i;
    return 0;
  }
  let nearest = 0;
  for (let i = 1; i < stops.length; i++) {
    if (Math.abs(stops[i] - position) < Math.abs(stops[nearest] - position)) nearest = i;
  }
  return nearest;
}
```

`src/components/menu/Panel.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { detentHeights, drawerWidth, snapIndex, type Detent, type PanelFrame } from './panel-geometry';

type Props = {
  landscape: boolean;
  /** Allowed bottom-sheet detents (portrait). Landscape is a fixed-width full-height drawer. */
  detents: readonly Detent[];
  initialDetent: Detent;
  /** Space a full-height sheet leaves free at the top (safe area + toolbar). */
  topReserved: number;
  onFrameChange: (frame: PanelFrame) => void;
  children: ReactNode;
};

/**
 * The one container for every menu: a bottom sheet in portrait, a left drawer in landscape. It has
 * no backdrop — the map stays interactive. The element tree is identical in both orientations, so
 * rotating never remounts the menu (a half-typed form survives).
 */
export function Panel({ landscape, detents, initialDetent, topReserved, onFrameChange, children }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = { width, height, insets, topReserved };
  const heights = detentHeights(metrics);
  const ordered = [...detents].sort((a, b) => heights[a] - heights[b]);
  const stops = ordered.map((d) => heights[d]);
  const [detent, setDetent] = useState<Detent>(initialDetent);
  const target = landscape ? drawerWidth(metrics) : heights[detent];
  const size = useSharedValue(0);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    size.value = withTiming(target, { duration: 220 });
    onFrameChange({ side: landscape ? 'left' : 'bottom', size: target });
  }, [target, landscape, onFrameChange, size]);

  // Keep a focused field visible: the sheet opens fully while the keyboard is up.
  useEffect(() => {
    if (landscape || !detents.includes('full')) return;
    let before: Detent | null = null;
    const show = Keyboard.addListener('keyboardWillShow', () =>
      setDetent((current) => {
        before = current;
        return 'full';
      }),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () => {
      if (before) setDetent(before);
      before = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [landscape, detents]);

  const pan = Gesture.Pan()
    .enabled(!landscape)
    .onBegin(() => {
      dragStart.value = size.value;
    })
    .onUpdate((e) => {
      size.value = Math.min(stops[stops.length - 1], Math.max(stops[0], dragStart.value - e.translationY));
    })
    .onEnd((e) => {
      const i = snapIndex(size.value, -e.velocityY, stops);
      size.value = withTiming(stops[i], { duration: 180 });
      runOnJS(setDetent)(ordered[i]);
    });

  const animated = useAnimatedStyle(
    () => (landscape ? { width: size.value, height: '100%' } : { width: '100%', height: size.value }),
    [landscape],
  );

  return (
    <Animated.View
      testID="menu-panel"
      style={[{ position: 'absolute', left: 0, bottom: 0 }, animated]}
      className={landscape ? 'border-r border-border bg-surface' : 'rounded-t-3xl border-t border-border bg-surface'}>
      <View style={{ flex: 1, paddingLeft: landscape ? insets.left : 0, paddingTop: landscape ? insets.top : 0 }}>
        {landscape ? null : (
          <GestureDetector gesture={pan}>
            <View testID="menu-panel-handle" accessibilityLabel="Resize panel" className="items-center py-3">
              <View className="h-1 w-10 rounded-full bg-border" />
            </View>
          </GestureDetector>
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingTop: landscape ? 12 : 0 }}>
          {children}
        </ScrollView>
      </View>
    </Animated.View>
  );
}
```

(If Reanimated 4 in this project no longer exports `runOnJS`, use `scheduleOnRN` from `react-native-worklets` with the same arguments.)

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add jest.setup.ts src/components/menu
git commit -m "feat: add the menu panel as a bottom sheet and left drawer"
```

---

### Task 5: Menu primitives — header, sections, rows, buttons, toggle, actions

**Files:**
- Create: `src/components/menu/MenuHeader.tsx`, `MenuSection.tsx`, `MenuRow.tsx`, `MenuButton.tsx`, `MenuToggle.tsx`, `MenuActions.tsx`, `src/components/menu/primitives.test.tsx`

**Interfaces:**
- Consumes: `Icon`, `IconName`, `useTheme`.
- Produces:
  - `MenuHeader({ title, leading?, trailing? })` with `type MenuHeaderAction = { label: string; onPress: () => void; disabled?: boolean; icon?: IconName }`. The title renders uppercase (`accessibilityRole="header"`); `trailing` is the amber primary button.
  - `MenuSection({ label?, children })`
  - `MenuRow({ label, icon?, detail?, onPress })`
  - `MenuButton({ label, icon, onPress, disabled? })` — secondary (Center, Me, notes).
  - `MenuToggle({ label, value, onValueChange })`
  - `MenuActions({ destructive: { label, confirmLabel, onConfirm } })` — two-step confirm; the second tap within the armed state calls `onConfirm`.

- [ ] **Step 1: Write the failing test**

`src/components/menu/primitives.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { MenuActions } from './MenuActions';
import { MenuButton } from './MenuButton';
import { MenuHeader } from './MenuHeader';
import { MenuRow } from './MenuRow';
import { MenuSection } from './MenuSection';
import { MenuToggle } from './MenuToggle';

describe('menu primitives', () => {
  it('MenuHeader shows the title and runs both actions', async () => {
    const cancel = jest.fn();
    const add = jest.fn();
    await renderWithProviders(
      <MenuHeader title="Add point" leading={{ label: 'Cancel', onPress: cancel }} trailing={{ label: 'Add', icon: 'check', onPress: add }} />,
    );
    expect(screen.getByRole('header')).toHaveTextContent('Add point');
    await fireEvent.press(screen.getByText('Cancel'));
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(cancel).toHaveBeenCalled();
    expect(add).toHaveBeenCalled();
  });

  it('MenuHeader disables the primary action', async () => {
    const add = jest.fn();
    await renderWithProviders(<MenuHeader title="Add point" trailing={{ label: 'Add', onPress: add, disabled: true }} />);
    expect(screen.getByLabelText('Add')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(add).not.toHaveBeenCalled();
  });

  it('MenuSection renders its label and children', async () => {
    await renderWithProviders(
      <MenuSection label="Affiliation">
        <Text>child</Text>
      </MenuSection>,
    );
    expect(screen.getByText('Affiliation')).toBeTruthy();
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('MenuRow and MenuButton are pressable', async () => {
    const row = jest.fn();
    const button = jest.fn();
    await renderWithProviders(
      <>
        <MenuRow label="Switch mission" icon="swap-horizontal" onPress={row} />
        <MenuButton label="Center" icon="crosshairs" onPress={button} />
        <MenuButton label="Me" icon="crosshairs-gps" onPress={button} disabled />
      </>,
    );
    await fireEvent.press(screen.getByText('Switch mission'));
    await fireEvent.press(screen.getByText('Center'));
    expect(row).toHaveBeenCalledTimes(1);
    expect(button).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Me')).toBeDisabled();
  });

  it('MenuToggle reports the new value', async () => {
    const onValueChange = jest.fn();
    await renderWithProviders(<MenuToggle label="Hidden on map" value={false} onValueChange={onValueChange} />);
    await fireEvent(screen.getByLabelText('Hidden on map'), 'valueChange', true);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('MenuActions needs a second tap to confirm', async () => {
    const onConfirm = jest.fn();
    await renderWithProviders(
      <MenuActions destructive={{ label: 'Delete point', confirmLabel: 'Tap again to delete', onConfirm }} />,
    );
    await fireEvent.press(screen.getByText('Delete point'));
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Tap again to delete'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/menu/primitives.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/components/menu/MenuHeader.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

export type MenuHeaderAction = { label: string; onPress: () => void; disabled?: boolean; icon?: IconName };

/** Leading text action (Cancel / Close), centered uppercase title, trailing amber primary button. */
export function MenuHeader({ title, leading, trailing }: { title: string; leading?: MenuHeaderAction; trailing?: MenuHeaderAction }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center px-4 pb-3">
      <View className="min-w-20 items-start">
        {leading ? (
          <Pressable accessibilityRole="button" onPress={leading.onPress} hitSlop={8}>
            <Text className="text-base text-text-muted">{leading.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text accessibilityRole="header" numberOfLines={1} className="flex-1 text-center text-base font-bold uppercase tracking-widest text-text">
        {title}
      </Text>
      <View className="min-w-20 items-end">
        {trailing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={trailing.label}
            accessibilityState={{ disabled: !!trailing.disabled }}
            disabled={trailing.disabled}
            onPress={trailing.onPress}
            className={`flex-row items-center gap-1 rounded-xl bg-accent px-4 py-2 ${trailing.disabled ? 'opacity-40' : ''}`}>
            {trailing.icon ? <Icon name={trailing.icon} size={18} color={colors['on-accent']} /> : null}
            <Text className="font-bold text-on-accent">{trailing.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
```

`src/components/menu/MenuSection.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Uppercase muted label above its content. */
export function MenuSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View className="gap-2 px-4 pb-4">
      {label ? <Text className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</Text> : null}
      {children}
    </View>
  );
}
```

`src/components/menu/MenuRow.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** A tappable list row: icon, label, optional detail, chevron. */
export function MenuRow({ label, icon, detail, onPress }: { label: string; icon?: IconName; detail?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 active:opacity-80">
      {icon ? <Icon name={icon} size={20} color={colors.text} /> : null}
      <Text className="flex-1 text-base text-text">{label}</Text>
      {detail ? <Text className="text-sm text-text-muted">{detail}</Text> : null}
      <Icon name="chevron-right" size={20} color={colors['text-muted']} />
    </Pressable>
  );
}
```

`src/components/menu/MenuButton.tsx`:

```tsx
import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

/** Secondary button: icon + label on a raised surface (Center, Me, notes). */
export function MenuButton({ label, icon, onPress, disabled = false }: { label: string; icon: IconName; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-3 ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={18} color={colors.text} />
      <Text className="font-semibold text-text">{label}</Text>
    </Pressable>
  );
}
```

`src/components/menu/MenuToggle.tsx`:

```tsx
import { Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export function MenuToggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-base text-text">{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}
```

`src/components/menu/MenuActions.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Destructive = { label: string; confirmLabel: string; onConfirm: () => void };

/** Destructive action with an in-panel second tap to confirm (no system dialogs). */
export function MenuActions({ destructive }: { destructive: Destructive }) {
  const { colors } = useTheme();
  const [armed, setArmed] = useState(false);
  const label = armed ? destructive.confirmLabel : destructive.label;
  return (
    <View className="px-4 pb-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          if (armed) destructive.onConfirm();
          else setArmed(true);
        }}
        className={`flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 ${armed ? 'border-danger bg-danger' : 'border-danger bg-surface-raised'}`}>
        <Icon name="trash-can-outline" size={18} color={armed ? colors['on-accent'] : colors.danger} />
        <Text className={`font-semibold ${armed ? 'text-on-accent' : 'text-danger'}`}>{label}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/menu
git commit -m "feat: add menu header, section, row, button, toggle and action primitives"
```

---

### Task 6: Menu primitives — text field, segmented control, select

**Files:**
- Create: `src/components/menu/MenuTextField.tsx`, `MenuSegmented.tsx`, `MenuSelect.tsx`, `src/components/menu/inputs.test.tsx`

**Interfaces:**
- Produces:
  - `MenuTextField(props: Omit<TextInputProps, 'style'> & { invalid?: boolean; mono?: boolean; ref?: Ref<TextInput> })` — amber border when focused, red when invalid.
  - `MenuSegmented<T extends string>({ options: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void })` — each option is a button labelled by `label`, `selected` state.
  - `MenuSelect<T extends string>({ label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void })` — collapsed field (`accessibilityLabel` `${label}: ${current}`) that expands an inline option list; choosing collapses it.

- [ ] **Step 1: Write the failing test**

`src/components/menu/inputs.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { MenuSegmented } from './MenuSegmented';
import { MenuSelect } from './MenuSelect';
import { MenuTextField } from './MenuTextField';

describe('menu inputs', () => {
  it('MenuTextField passes text through', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<MenuTextField accessibilityLabel="Name" value="HOS-1" onChangeText={onChangeText} />);
    expect(screen.getByDisplayValue('HOS-1')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    expect(onChangeText).toHaveBeenCalledWith('OBJ IRON');
  });

  it('MenuSegmented selects one option', async () => {
    const onChange = jest.fn();
    const options = [
      { value: 'deg', label: 'Degrees' },
      { value: 'mil', label: 'Mils' },
    ] as const;
    await renderWithProviders(<MenuSegmented options={[...options]} value="deg" onChange={onChange} />);
    expect(screen.getByLabelText('Degrees')).toBeSelected();
    expect(screen.getByLabelText('Mils')).not.toBeSelected();
    await fireEvent.press(screen.getByLabelText('Mils'));
    expect(onChange).toHaveBeenCalledWith('mil');
  });

  it('MenuSelect expands, picks and collapses', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <MenuSelect
        label="Unit type"
        options={[
          { value: 'unspecified', label: 'Unspecified' },
          { value: 'infantry', label: 'Infantry' },
        ]}
        value="unspecified"
        onChange={onChange}
      />,
    );
    expect(screen.queryByText('Infantry')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Unit type: Unspecified'));
    await fireEvent.press(screen.getByText('Infantry'));
    expect(onChange).toHaveBeenCalledWith('infantry');
    expect(screen.queryByText('Infantry')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/menu/inputs.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/components/menu/MenuTextField.tsx`:

```tsx
import { useState, type Ref } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Props = Omit<TextInputProps, 'style'> & { invalid?: boolean; mono?: boolean; ref?: Ref<TextInput> };

/** Dark input with an amber border while focused and a red border when invalid. */
export function MenuTextField({ invalid = false, mono = false, ref, onFocus, onBlur, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = invalid ? 'border-danger' : focused ? 'border-accent' : 'border-border';
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors['text-muted']}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className={`rounded-xl border-2 bg-surface-input px-3 py-3 text-lg text-text ${mono ? 'font-mono' : ''} ${border}`}
      {...rest}
    />
  );
}
```

`src/components/menu/MenuSegmented.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

/** One-of-N control. Options with an icon show only the icon; the label is their accessible name. */
export function MenuSegmented<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <View className="flex-row gap-1 rounded-xl border border-border bg-surface-input p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center justify-center rounded-lg border-2 py-2 ${selected ? 'border-accent bg-accent-subtle' : 'border-surface-input'}`}>
            {option.icon ?? <Text className={`text-sm font-semibold ${selected ? 'text-accent' : 'text-text'}`}>{option.label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
```

`src/components/menu/MenuSelect.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type Option<T extends string> = { value: T; label: string };

/** Dropdown field that expands an inline list (no native picker), so it works inside the panel. */
export function MenuSelect<T extends string>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (value: T) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <View className="flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between rounded-xl border-2 border-border bg-surface-input px-3 py-3">
        <Text numberOfLines={1} className="shrink text-lg text-text">
          {current}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors['text-muted']} />
      </Pressable>
      {open ? (
        <View className="mt-1 overflow-hidden rounded-xl border border-border bg-surface-raised">
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="flex-row items-center justify-between px-3 py-3">
              <Text className="text-base text-text">{option.label}</Text>
              {option.value === value ? <Icon name="check" size={18} color={colors.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
```

(`border-surface-input` is a valid semantic class: every token works for border, background and text.)

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/menu
git commit -m "feat: add menu text field, segmented control and select"
```

---

### Task 7: MGRS input

**Files:**
- Create: `src/components/menu/mgrs-fields.ts`, `src/components/menu/mgrs-fields.test.ts`, `src/components/menu/MgrsInput.tsx`, `src/components/menu/MgrsInput.test.tsx`

**Interfaces:**
- Consumes: `toMgrs`, `splitMgrs`, `parseMgrs`, `MgrsParts` (`@/lib/geo/coords/mgrs`); `MenuTextField` (Task 6).
- Produces:
  - `EMPTY_MGRS: MgrsParts`
  - `type MgrsFieldStatus = { status: 'empty' } | { status: 'incomplete' } | { status: 'invalid'; message: string } | { status: 'valid'; coord: LatLon }`
  - `evaluateMgrsFields(parts: MgrsParts): MgrsFieldStatus`
  - `mgrsFieldsFor(coord: LatLon): MgrsParts` (10-digit; `EMPTY_MGRS` outside MGRS coverage)
  - `MgrsInput({ value, onChange, status, validDetail? })` — four fields labelled "MGRS zone", "100 km square", "Easting", "Northing"; status line testID `mgrs-status`.

- [ ] **Step 1: Write the failing tests**

`src/components/menu/mgrs-fields.test.ts`:

```ts
import { splitMgrs, toMgrs } from '@/lib/geo/coords/mgrs';

import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from './mgrs-fields';

const DC = { lat: 38.8977, lon: -77.0365 };

function dcParts() {
  const m = toMgrs(DC, 5);
  if (!m.ok) throw new Error('setup');
  const p = splitMgrs(m.value);
  if (!p.ok) throw new Error('setup');
  return p.value;
}

describe('evaluateMgrsFields', () => {
  it('is empty with no input', () => {
    expect(evaluateMgrsFields(EMPTY_MGRS)).toEqual({ status: 'empty' });
  });

  it('accepts a full reference regardless of case and spacing', () => {
    const p = dcParts();
    const r = evaluateMgrsFields({ ...p, zoneBand: ` ${p.zoneBand.toLowerCase()} `, square: p.square.toLowerCase() });
    expect(r.status).toBe('valid');
    if (r.status !== 'valid') return;
    expect(r.coord.lat).toBeCloseTo(DC.lat, 3);
    expect(r.coord.lon).toBeCloseTo(DC.lon, 3);
  });

  it('accepts lower precision with matching digit counts', () => {
    const p = dcParts();
    expect(evaluateMgrsFields({ ...p, easting: p.easting.slice(0, 3), northing: p.northing.slice(0, 3) }).status).toBe('valid');
  });

  it.each([
    ['zone only', { zoneBand: '18S', square: '', easting: '', northing: '' }],
    ['zone without band', { zoneBand: '18', square: 'UJ', easting: '2', northing: '0' }],
    ['one-letter square', { zoneBand: '18S', square: 'U', easting: '23', northing: '06' }],
    ['northing still being typed', { zoneBand: '18S', square: 'UJ', easting: '23394', northing: '0739' }],
  ])('is incomplete for %s', (_name, parts) => {
    expect(evaluateMgrsFields(parts).status).toBe('incomplete');
  });

  it.each([
    ['more northing than easting digits', { zoneBand: '18S', square: 'UJ', easting: '233', northing: '07395' }],
    ['letters in the digits', { zoneBand: '18S', square: 'UJ', easting: '23A94', northing: '07395' }],
    ['a zone that does not exist', { zoneBand: '61S', square: 'UJ', easting: '23394', northing: '07395' }],
  ])('is invalid for %s', (_name, parts) => {
    expect(evaluateMgrsFields(parts).status).toBe('invalid');
  });

  it('is invalid when the band letter does not match the square', () => {
    const p = dcParts();
    expect(evaluateMgrsFields({ ...p, zoneBand: p.zoneBand.replace(/.$/, 'C') }).status).toBe('invalid');
  });
});

describe('mgrsFieldsFor', () => {
  it('splits a coordinate into ten-digit fields', () => {
    expect(mgrsFieldsFor(DC)).toEqual(dcParts());
  });

  it('is empty outside MGRS coverage', () => {
    expect(mgrsFieldsFor({ lat: 85, lon: 0 })).toEqual(EMPTY_MGRS);
  });
});
```

`src/components/menu/MgrsInput.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from './mgrs-fields';
import { MgrsInput } from './MgrsInput';

const DC = { lat: 38.8977, lon: -77.0365 };

describe('MgrsInput', () => {
  it('shows the four fields and a valid status line', async () => {
    const parts = mgrsFieldsFor(DC);
    await renderWithProviders(<MgrsInput value={parts} onChange={jest.fn()} status={evaluateMgrsFields(parts)} validDetail="1.15 km @ 103° GRID" />);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue(parts.zoneBand);
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(parts.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Valid · 1.15 km @ 103° GRID');
  });

  it('uppercases letters and strips non-digits', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={onChange} status={{ status: 'empty' }} />);
    await fireEvent.changeText(screen.getByLabelText('100 km square'), 'uj');
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MGRS, square: 'UJ' });
    await fireEvent.changeText(screen.getByLabelText('Easting'), '23 3a9');
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MGRS, easting: '2339' });
  });

  it('spreads a full reference pasted into the zone field', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={onChange} status={{ status: 'empty' }} />);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), '18S UJ 23394 07395');
    expect(onChange).toHaveBeenLastCalledWith({ zoneBand: '18S', square: 'UJ', easting: '23394', northing: '07395' });
  });

  it('explains an invalid reference', async () => {
    await renderWithProviders(
      <MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'invalid', message: 'Grid zone does not match the square and digits' }} />,
    );
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Grid zone does not match the square and digits');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/components/menu/mgrs-fields.test.ts src/components/menu/MgrsInput.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/components/menu/mgrs-fields.ts`:

```ts
import { parseMgrs, splitMgrs, toMgrs, type MgrsParts } from '@/lib/geo/coords/mgrs';
import type { LatLon } from '@/lib/geo/types';

export const EMPTY_MGRS: MgrsParts = { zoneBand: '', square: '', easting: '', northing: '' };

export type MgrsFieldStatus =
  | { status: 'empty' }
  | { status: 'incomplete' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; coord: LatLon };

const ZONE_BAND = /^\d{1,2}[C-HJ-NP-X]$/;
const SQUARE = /^[A-HJ-NP-Z]{2}$/;

/**
 * Status of the four MGRS fields while the user types. Only `valid` carries a coordinate; the
 * map and the draft move only then, so partial input never jumps the map.
 */
export function evaluateMgrsFields(parts: MgrsParts): MgrsFieldStatus {
  const zoneBand = parts.zoneBand.replace(/\s+/g, '').toUpperCase();
  const square = parts.square.replace(/\s+/g, '').toUpperCase();
  const easting = parts.easting.replace(/\s+/g, '');
  const northing = parts.northing.replace(/\s+/g, '');
  if (!zoneBand && !square && !easting && !northing) return { status: 'empty' };
  if (/\D/.test(easting) || /\D/.test(northing)) return { status: 'invalid', message: 'Easting and northing are digits only' };
  if (northing.length > easting.length) {
    return { status: 'invalid', message: 'Easting and northing need the same number of digits' };
  }
  if (!ZONE_BAND.test(zoneBand) || !SQUARE.test(square) || easting.length === 0 || northing.length < easting.length) {
    if (zoneBand.length > 3 || square.length > 2 || easting.length > 5) return { status: 'invalid', message: 'Not an MGRS reference' };
    return { status: 'incomplete' };
  }
  const result = parseMgrs({ zoneBand, square, easting, northing });
  return result.ok ? { status: 'valid', coord: result.value } : { status: 'invalid', message: result.message };
}

/** Ten-digit MGRS fields for a coordinate (empty outside MGRS coverage). */
export function mgrsFieldsFor(coord: LatLon): MgrsParts {
  const mgrs = toMgrs(coord, 5);
  if (!mgrs.ok) return EMPTY_MGRS;
  const parts = splitMgrs(mgrs.value);
  return parts.ok ? parts.value : EMPTY_MGRS;
}
```

(Zone `61S` must be `invalid`: the regex accepts it as two digits + band, so `parseMgrs` rejects it with its own message. If `parseMgrs` instead accepts it, add an explicit zone 1–60 check before calling it.)

`src/components/menu/MgrsInput.tsx`:

```tsx
import { useRef } from 'react';
import { Text, View, type TextInput } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { splitMgrs, type MgrsParts } from '@/lib/geo/coords/mgrs';
import { useTheme } from '@/theme/ThemeProvider';

import type { MgrsFieldStatus } from './mgrs-fields';
import { MenuTextField } from './MenuTextField';

type Props = {
  value: MgrsParts;
  onChange: (parts: MgrsParts) => void;
  status: MgrsFieldStatus;
  /** Extra text after "Valid ·", e.g. range and bearing from the user. */
  validDetail?: string;
};

const letters = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const digits = (s: string) => s.replace(/\D/g, '');

/** Four-field MGRS entry (zone+band, 100 km square, easting, northing) with a validation line. */
export function MgrsInput({ value, onChange, status, validDetail }: Props) {
  const { colors } = useTheme();
  const square = useRef<TextInput>(null);
  const easting = useRef<TextInput>(null);
  const northing = useRef<TextInput>(null);

  const onZone = (text: string) => {
    // A whole reference pasted (or typed) into the first field is spread across all four.
    if (letters(text).length > 3) {
      const parts = splitMgrs(text);
      if (parts.ok) {
        onChange(parts.value);
        return;
      }
    }
    const zoneBand = letters(text).slice(0, 3);
    onChange({ ...value, zoneBand });
    if (/^\d{1,2}[A-Z]$/.test(zoneBand)) square.current?.focus();
  };
  const onSquare = (text: string) => {
    const next = letters(text).replace(/\d/g, '').slice(0, 2);
    onChange({ ...value, square: next });
    if (next.length === 2) easting.current?.focus();
  };
  const onEasting = (text: string) => {
    const next = digits(text).slice(0, 5);
    onChange({ ...value, easting: next });
    if (next.length === 5) northing.current?.focus();
  };
  const onNorthing = (text: string) => onChange({ ...value, northing: digits(text).slice(0, 5) });

  const invalid = status.status === 'invalid';
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <View style={{ flex: 3 }}>
          <MenuTextField mono accessibilityLabel="MGRS zone" value={value.zoneBand} onChangeText={onZone} autoCapitalize="characters" autoCorrect={false} invalid={invalid} placeholder="18S" />
        </View>
        <View style={{ flex: 2.5 }}>
          <MenuTextField ref={square} mono accessibilityLabel="100 km square" value={value.square} onChangeText={onSquare} autoCapitalize="characters" autoCorrect={false} maxLength={2} invalid={invalid} placeholder="UJ" />
        </View>
        <View style={{ flex: 6 }}>
          <MenuTextField ref={easting} mono accessibilityLabel="Easting" value={value.easting} onChangeText={onEasting} keyboardType="number-pad" maxLength={5} invalid={invalid} placeholder="00000" />
        </View>
        <View style={{ flex: 6 }}>
          <MenuTextField ref={northing} mono accessibilityLabel="Northing" value={value.northing} onChangeText={onNorthing} keyboardType="number-pad" maxLength={5} invalid={invalid} placeholder="00000" />
        </View>
      </View>
      <View testID="mgrs-status" className="flex-row items-center gap-1">
        {status.status === 'valid' ? (
          <>
            <Icon name="check" size={16} color={colors.success} />
            <Text className="text-sm text-success">Valid</Text>
            {validDetail ? <Text className="text-sm text-text-muted">{` · ${validDetail}`}</Text> : null}
          </>
        ) : status.status === 'invalid' ? (
          <>
            <Icon name="alert-circle-outline" size={16} color={colors.danger} />
            <Text className="shrink text-sm text-danger">{status.message}</Text>
          </>
        ) : (
          <Text className="text-sm text-text-muted">Enter zone, square, easting and northing</Text>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/menu
git commit -m "feat: add four-field MGRS input with live validation"
```

---
### Task 8: Menu registry, MenuHost, app menu and About page

**Files:**
- Create: `src/features/menus/define-menu.ts`, `src/features/menus/registry.ts`, `src/features/menus/MenuHost.tsx`, `src/features/menus/MenuHost.test.tsx`, `src/features/menus/menus/AppRootMenu.tsx`, `src/features/menus/menus/AppRootMenu.test.tsx`, `src/features/about/AboutScreen.tsx`, `src/features/about/AboutScreen.test.tsx`, `src/app/about.tsx`
- Modify: `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: `useMenu`, `topMenu`, `MenuId`, `MenuParams` (Task 3); `Panel`, `Detent` (Task 4); `MenuHeader`, `MenuSection`, `MenuRow` (Task 5); `EDGE`, `GAP`, `TOOLBAR_HEIGHT` (`@/features/map/layout`).
- Produces:
  - `type MenuFamily = 'app' | 'action'`; `type MenuComponentProps<I> = { params: MenuParams<I>; missionId: string }`; `type MenuDefinition<I> = { id; family; title; detents: readonly Detent[]; component }`; `defineMenu(def)` from `@/features/menus/define-menu`.
  - `MENU_REGISTRY` (partial until Task 14) from `@/features/menus/registry`.
  - `MenuHost({ landscape, missionId })` — renders the top menu inside `Panel`, publishes the panel frame to `useMenu.setPanelFrame`, clears it when the stack is empty.
  - `appRootMenu` (`app.root`: "Switch mission", "About"); `AboutScreen`; route `/about`.

- [ ] **Step 1: Write the failing tests**

`src/features/menus/menus/AppRootMenu.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { renderWithProviders } from '@/test-utils/render';

import { AppRootMenu } from './AppRootMenu';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => {
  jest.clearAllMocks();
  useMenu.setState(INITIAL_MENU);
  useMenu.getState().openMenu('app.root', {});
});

describe('AppRootMenu', () => {
  it('switches mission by going back to the list', async () => {
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Switch mission'));
    expect(useMenu.getState().stack).toEqual([]);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('replaces to the list when there is no history', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Switch mission'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('opens the About page', async () => {
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('About'));
    expect(useMenu.getState().stack).toEqual([]);
    expect(mockRouter.push).toHaveBeenCalledWith('/about');
  });
});
```

`src/features/menus/MenuHost.test.tsx`:

```tsx
import { act, screen } from '@testing-library/react-native';

import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { renderWithProviders } from '@/test-utils/render';

import { MenuHost } from './MenuHost';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

beforeEach(() => useMenu.setState(INITIAL_MENU));

describe('MenuHost', () => {
  it('renders nothing without a menu', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    expect(screen.queryByTestId('menu-panel')).toBeNull();
  });

  it('shows the top menu in the panel and publishes the frame', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    await act(async () => useMenu.getState().openMenu('app.root', {}));
    expect(screen.getByTestId('menu-panel')).toBeTruthy();
    expect(screen.getByText('Switch mission')).toBeTruthy();
    expect(useMenu.getState().panelFrame).toMatchObject({ side: 'bottom' });
  });

  it('clears the frame when the menu closes', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    await act(async () => useMenu.getState().openMenu('app.root', {}));
    await act(async () => useMenu.getState().closeMenu());
    expect(screen.queryByTestId('menu-panel')).toBeNull();
    expect(useMenu.getState().panelFrame).toBeNull();
  });
});
```

`src/features/about/AboutScreen.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';

import { renderWithProviders } from '@/test-utils/render';

import { AboutScreen } from './AboutScreen';

const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

describe('AboutScreen', () => {
  it('shows the app name, version and attribution, and goes back', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByText('RTAP')).toBeTruthy();
    expect(screen.getByText('Realtime Team Awareness Platform')).toBeTruthy();
    expect(screen.getByText(`Version ${Constants.expoConfig?.version ?? '—'}`)).toBeTruthy();
    expect(screen.getByText(/Mapbox/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
```

In `src/features/map/MapScreen.test.tsx`, replace the test `'switches mission from the toolbar menu button'` with:

```tsx
  it('opens the app menu from the toolbar and switches mission from it', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('Menu'));
    await fireEvent.press(await screen.findByText('Switch mission'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
```

and add `useMenu.setState(INITIAL_MENU);` to its `beforeEach` (import `INITIAL_MENU, useMenu` from `@/stores/menu`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/menus src/features/about src/features/map/MapScreen.test.tsx`
Expected: FAIL — modules not found; the menu test cannot find "Switch mission".

- [ ] **Step 3: Implement**

`src/features/menus/define-menu.ts`:

```ts
import type { ComponentType } from 'react';

import type { Detent } from '@/components/menu/panel-geometry';

import type { MenuId, MenuParams } from './params';

/** `app` menus close with "Close"; `action` menus have Cancel plus a primary action. */
export type MenuFamily = 'app' | 'action';

export type MenuComponentProps<I extends MenuId> = { params: MenuParams<I>; missionId: string };

export type MenuDefinition<I extends MenuId> = {
  id: I;
  family: MenuFamily;
  title: string;
  /** Bottom-sheet detents in portrait, smallest first. Opens at `half` when listed. */
  detents: readonly Detent[];
  component: ComponentType<MenuComponentProps<I>>;
};

/** Declares a menu once; its params schema lives in `params.ts` under the same id. */
export function defineMenu<I extends MenuId>(definition: MenuDefinition<I>): MenuDefinition<I> {
  return definition;
}
```

`src/features/menus/menus/AppRootMenu.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuRow } from '@/components/menu/MenuRow';
import { MenuSection } from '@/components/menu/MenuSection';
import { useMenu } from '@/stores/menu';

import { defineMenu, type MenuComponentProps } from '../define-menu';

export function AppRootMenu(_props: MenuComponentProps<'app.root'>) {
  const router = useRouter();
  const close = useMenu((s) => s.closeMenu);
  const switchMission = () => {
    close();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View>
      <MenuHeader title="Menu" leading={{ label: 'Close', onPress: close }} />
      <MenuSection>
        <MenuRow icon="swap-horizontal" label="Switch mission" onPress={switchMission} />
        <MenuRow
          icon="information-outline"
          label="About"
          onPress={() => {
            close();
            router.push('/about');
          }}
        />
      </MenuSection>
    </View>
  );
}

export const appRootMenu = defineMenu({ id: 'app.root', family: 'app', title: 'Menu', detents: ['half', 'full'], component: AppRootMenu });
```

`src/features/menus/registry.ts`:

```ts
import type { MenuDefinition } from './define-menu';
import { appRootMenu } from './menus/AppRootMenu';
import type { MenuId } from './params';

/** Every menu, registered once by id. Partial until every menu exists (made total in Task 14). */
export type MenuRegistry = { [I in MenuId]?: MenuDefinition<I> };

export const MENU_REGISTRY: MenuRegistry = {
  'app.root': appRootMenu,
};
```

`src/features/menus/MenuHost.tsx`:

```tsx
import { useEffect, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Panel } from '@/components/menu/Panel';
import { EDGE, GAP, TOOLBAR_HEIGHT } from '@/features/map/layout';
import { topMenu, useMenu } from '@/stores/menu';

import type { MenuComponentProps } from './define-menu';
import type { MenuId, MenuParams } from './params';
import { MENU_REGISTRY } from './registry';

/** Renders the top of the menu stack in the Panel. The map behind stays fully interactive. */
export function MenuHost({ landscape, missionId }: { landscape: boolean; missionId: string }) {
  const insets = useSafeAreaInsets();
  const top = useMenu((s) => topMenu(s));
  const setPanelFrame = useMenu((s) => s.setPanelFrame);
  const definition = top ? MENU_REGISTRY[top.id] : undefined;

  useEffect(() => {
    if (top && !definition) console.error(`[menu] no menu registered for ${top.id}`);
    if (!definition) setPanelFrame(null);
  }, [top, definition, setPanelFrame]);

  if (!top || !definition) return null;
  const Component = definition.component as ComponentType<MenuComponentProps<MenuId>>;
  const initialDetent = definition.detents.includes('half') ? 'half' : definition.detents[0];
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Panel
        landscape={landscape}
        detents={definition.detents}
        initialDetent={initialDetent}
        topReserved={insets.top + EDGE + TOOLBAR_HEIGHT + GAP}
        onFrameChange={setPanelFrame}>
        <Component key={top.id} params={top.params as MenuParams<MenuId>} missionId={missionId} />
      </Panel>
    </View>
  );
}
```

`src/features/about/AboutScreen.tsx`:

```tsx
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Full-screen About page (a route, not a menu). */
export function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <View className="flex-1 bg-surface px-4" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="mb-6 self-start py-2" hitSlop={8}>
        <Text className="text-base text-text-muted">‹ Back</Text>
      </Pressable>
      <Text className="text-3xl font-bold tracking-widest text-text">RTAP</Text>
      <Text className="mt-1 text-base text-text-muted">Realtime Team Awareness Platform</Text>
      <Text className="mt-4 font-mono text-sm text-text-muted">{`Version ${version}`}</Text>
      <Text className="mt-6 text-sm text-text">For training and military simulation. Not for real-world military use.</Text>
      <Text className="mt-6 text-sm text-text-muted">
        Map data © Mapbox © OpenStreetMap. Symbols: milsymbol (MIL-STD-2525C). Magnetic model: WMM2025.
      </Text>
    </View>
  );
}
```

`src/app/about.tsx`:

```tsx
import { AboutScreen } from '@/features/about/AboutScreen';

export default function AboutRoute() {
  return <AboutScreen />;
}
```

Run: `npx expo export --platform ios --output-dir /tmp/rtap-typegen > /dev/null` (typed route `/about`).

In `src/features/map/MissionMap.tsx`:
- import `{ MenuHost } from '@/features/menus/MenuHost'` and `{ useMenu } from '@/stores/menu'`;
- delete the interim `switchMission` function and its comment;
- pass `onMenu={() => useMenu.getState().openMenu('app.root', {})}` to `Toolbar`;
- add an unmount cleanup next to the interaction reset: `useEffect(() => () => { useMenu.getState().closeMenu(); useMenu.getState().setPanelFrame(null); }, []);`
- render `<MenuHost landscape={landscape} missionId={missionId} />` just before `<Toast …/>`.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add menu registry and host, app menu and About page"
```

---

### Task 9: Panel-aware map — camera padding, crosshair, chrome

**Files:**
- Modify: `src/features/map/layout.ts`, `src/features/map/layout.test.ts`, `src/features/map/canvas/MapCanvas.tsx`, `src/features/map/canvas/MapCanvas.test.tsx`, `src/features/map/interaction/Crosshair.tsx`, `src/features/map/controls/MapControls.tsx`, `src/features/map/controls/MapControls.test.tsx`, `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`
- Create: `src/features/map/interaction/Crosshair.test.tsx`

**Interfaces:**
- Consumes: `PanelFrame` (Task 3), `useMenu` (`panelFrame`).
- Produces:
  - `cameraPaddingFor(panel: PanelFrame | null): { paddingTop; paddingRight; paddingBottom; paddingLeft }`
  - `ornamentPositions({ landscape, insets, leftOffset? })` — `leftOffset` (default 0) shifts the logo row right.
  - `Crosshair({ panel })`, `MapControls({ …, panel })`, `MapCanvas({ …, panel })`.
  - Behavior: with a panel open, the camera gets padding equal to the panel area, the crosshair centers in the visible map, the readout card, zoom buttons and location banner hide, recenter lifts above a bottom sheet, the logo row moves right of a left drawer.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/map/layout.test.ts` (import `cameraPaddingFor`):

```ts
  it('pads the camera by the panel area', () => {
    expect(cameraPaddingFor(null)).toEqual({ paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 });
    expect(cameraPaddingFor({ side: 'bottom', size: 320 })).toMatchObject({ paddingBottom: 320, paddingLeft: 0 });
    expect(cameraPaddingFor({ side: 'left', size: 400 })).toMatchObject({ paddingLeft: 400, paddingBottom: 0 });
  });

  it('shifts the logo row right by an offset', () => {
    const p = ornamentPositions({ landscape: true, insets: NO_INSETS, leftOffset: 400 });
    expect(p.attribution.left).toBe(EDGE + 400);
    expect(p.logo.left).toBe(EDGE + 400 + ATTRIBUTION_WIDTH);
  });
```

`src/features/map/interaction/Crosshair.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Crosshair } from './Crosshair';

function frameStyle() {
  return StyleSheet.flatten(screen.getByTestId('crosshair-frame').props.style);
}

describe('Crosshair', () => {
  it('centers on the whole map without a panel', async () => {
    await render(<Crosshair panel={null} />);
    expect(frameStyle()).toMatchObject({ bottom: 0, left: 0 });
  });

  it('centers in the map above a bottom sheet', async () => {
    await render(<Crosshair panel={{ side: 'bottom', size: 320 }} />);
    expect(frameStyle()).toMatchObject({ bottom: 320, left: 0 });
  });

  it('centers in the map right of a left drawer', async () => {
    await render(<Crosshair panel={{ side: 'left', size: 400 }} />);
    expect(frameStyle()).toMatchObject({ bottom: 0, left: 400 });
  });
});
```

Add to `src/features/map/controls/MapControls.test.tsx` (inside the `describe`; `handlers()` exists; import `EDGE` from `../layout` and `StyleSheet` is already imported):

```tsx
  it('hides zoom and lifts recenter above a bottom sheet', async () => {
    await renderWithProviders(<MapControls following={false} canRecenter {...handlers()} panel={{ side: 'bottom', size: 320 }} />);
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('map-controls-bottom').props.style).bottom).toBe(320 + EDGE);
  });
```

and pass `panel={null}` in the existing `MapControls` renders.

Add to `src/features/map/canvas/MapCanvas.test.tsx` (inside the `describe`; `renderCanvas` builds the props):

```tsx
  it('keeps the Mapbox logo row right of a left drawer', async () => {
    await renderCanvas({ panel: { side: 'left', size: 400 } });
    const logo = mapboxMock().__props.MapView.main.logoPosition as { left: number };
    expect(logo.left).toBeGreaterThan(400);
  });
```

and add `panel: null,` to `renderCanvas`'s default props.

Add to `src/features/map/MapScreen.test.tsx`:

```tsx
  it('pads the camera and hides the readout while a panel is open', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    mapboxMock().__camera.setCamera.mockClear();

    await fireEvent.press(screen.getByLabelText('Menu'));
    await waitFor(() =>
      expect(mapboxMock().__camera.setCamera).toHaveBeenCalledWith(
        expect.objectContaining({ padding: expect.objectContaining({ paddingBottom: expect.any(Number) }) }),
      ),
    );
    const padded = mapboxMock().__camera.setCamera.mock.calls.at(-1)?.[0] as { padding: { paddingBottom: number } };
    expect(padded.padding.paddingBottom).toBeGreaterThan(0);
    expect(screen.queryByTestId('readout-coordinate')).toBeNull();

    await act(async () => useMenu.getState().closeMenu());
    await waitFor(() =>
      expect(mapboxMock().__camera.setCamera).toHaveBeenLastCalledWith(
        expect.objectContaining({ padding: { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 } }),
      ),
    );
    expect(screen.getByTestId('readout-coordinate')).toBeTruthy();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/map`
Expected: FAIL — `cameraPaddingFor` missing; Crosshair has no `crosshair-frame`; `panel` props unknown.

- [ ] **Step 3: Implement**

In `src/features/map/layout.ts`:

```ts
import type { PanelFrame } from '@/components/menu/panel-geometry';

export type CameraPadding = { paddingTop: number; paddingRight: number; paddingBottom: number; paddingLeft: number };

/** Camera padding equal to the panel's area, so the camera center is the visible map's center. */
export function cameraPaddingFor(panel: PanelFrame | null): CameraPadding {
  return {
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: panel?.side === 'bottom' ? panel.size : 0,
    paddingLeft: panel?.side === 'left' ? panel.size : 0,
  };
}
```

and change `ornamentPositions` to take an optional `leftOffset`:

```ts
export function ornamentPositions({ landscape, insets, leftOffset = 0 }: { landscape: boolean; insets: Insets; leftOffset?: number }) {
  const left = insets.left + EDGE + leftOffset;
  const top = insets.top + ornamentRowTop(landscape);
  return {
    attribution: { top: top - attributionRaise(landscape), left },
    logo: { top, left: left + ATTRIBUTION_WIDTH },
  };
}
```

In `src/features/map/canvas/MapCanvas.tsx`: add prop `panel: PanelFrame | null` (import the type), and compute the ornaments as:

```tsx
  // A left drawer covers the top-left corner; keep the logo row visible right of it. The drawer
  // width counts from the screen edge, the ornament margin from the safe area: subtract the inset.
  const leftOffset = panel?.side === 'left' ? Math.max(0, panel.size - insets.left) : 0;
  const ornaments = ornamentPositions({
    landscape,
    insets: Platform.OS === 'ios' ? NO_INSETS : insets,
    leftOffset,
  });
```

Replace `src/features/map/interaction/Crosshair.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

import type { PanelFrame } from '@/components/menu/panel-geometry';

const ARM = 14;
const GAP = 5;
const THICKNESS = 1.5;

/** Thin cross with a center dot at the center of the visible map (beside any open panel). */
export function Crosshair({ panel }: { panel: PanelFrame | null }) {
  const frame = {
    bottom: panel?.side === 'bottom' ? panel.size : 0,
    left: panel?.side === 'left' ? panel.size : 0,
  };
  return (
    <View testID="crosshair-frame" pointerEvents="none" style={[StyleSheet.absoluteFill, frame]} className="items-center justify-center">
      <View style={{ width: 2 * (ARM + GAP), height: 2 * (ARM + GAP) }} className="items-center justify-center">
        <View className="absolute bg-text" style={{ width: THICKNESS, height: ARM, top: 0 }} />
        <View className="absolute bg-text" style={{ width: THICKNESS, height: ARM, bottom: 0 }} />
        <View className="absolute bg-text" style={{ height: THICKNESS, width: ARM, left: 0 }} />
        <View className="absolute bg-text" style={{ height: THICKNESS, width: ARM, right: 0 }} />
        <View className="rounded-full bg-text" style={{ width: 4, height: 4 }} />
      </View>
    </View>
  );
}
```

In `src/features/map/controls/MapControls.tsx`: add prop `panel: PanelFrame | null`; give the bottom column `testID="map-controls-bottom"` and `style={{ bottom: (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE, right }}`; render the zoom group only when `!panel` (wrap it in `{panel ? null : (…)}`).

In `src/features/map/MissionMap.tsx`:
- import `cameraPaddingFor` from `./layout` and `type PanelFrame` from `@/components/menu/panel-geometry`;
- `const panel = useMenu((s) => s.panelFrame);`
- apply padding only when the frame changes (not on mount):

```tsx
  const appliedPanel = useRef<PanelFrame | null>(null);
  useEffect(() => {
    if (panel === appliedPanel.current) return;
    appliedPanel.current = panel;
    cameraRef.current?.setCamera({ padding: cameraPaddingFor(panel), ...EASE, animationDuration: 250 });
  }, [panel]);
```

- pass `panel={panel}` to `MapCanvas`, `Crosshair` and `MapControls`;
- render `{panel ? null : <ReadoutCard />}` and `{panel ? null : <LocationBanner landscape={landscape} />}`.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map
git commit -m "feat: pad the camera and move the crosshair beside an open panel"
```

---

### Task 10: Settings menu

**Files:**
- Create: `src/features/menus/menus/settings-format.ts`, `src/features/menus/menus/settings-format.test.ts`, `src/features/menus/menus/SettingsMenu.tsx`, `src/features/menus/menus/SettingsMenu.test.tsx`
- Modify: `src/features/menus/registry.ts`, `src/features/map/MissionMap.tsx`

**Interfaces:**
- Consumes: `useSettings` (`coordinateFormat`, `angleUnit`, `northRef`, `declinationOverrideDeg`, setters, `setDeclinationOverride(deg | null): boolean`); `useInteraction` (`cameraCenter`); `declination(p, date)` (`@/lib/geo/north/magnetic`); `gridMagneticAngle(p, ctx)` (`@/lib/geo/north/convert`); `degToMils` (`@/lib/geo/units/angle`); primitives.
- Produces: `formatEastWest(deg: number | null, unit: AngleUnit): string`; `settingsMenu` (`settings`); the toolbar gear opens it.

- [ ] **Step 1: Write the failing tests**

`src/features/menus/menus/settings-format.test.ts`:

```ts
import { formatEastWest } from './settings-format';

describe('formatEastWest', () => {
  it.each([
    [10.64, 'deg', '10.6° E'],
    [-10.64, 'deg', '10.6° W'],
    [0, 'deg', '0.0° E'],
    [10, 'mil', '178 mils E'],
    [-10, 'mil', '178 mils W'],
    [null, 'deg', '—'],
    [Number.NaN, 'mil', '—'],
  ] as const)('%p %s → %s', (deg, unit, expected) => {
    expect(formatEastWest(deg, unit)).toBe(expected);
  });
});
```

`src/features/menus/menus/SettingsMenu.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { declination } from '@/lib/geo/north/magnetic';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { SettingsMenu } from './SettingsMenu';

const DC = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
  useMenu.setState(INITIAL_MENU);
});

describe('SettingsMenu', () => {
  it('changes coordinate format, angle unit and north reference', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByLabelText('Lat/Lon'));
    await fireEvent.press(screen.getByLabelText('Mils'));
    await fireEvent.press(screen.getByLabelText('Magnetic'));
    expect(useSettings.getState()).toMatchObject({ coordinateFormat: 'latlon', angleUnit: 'mil', northRef: 'magnetic' });
  });

  it('starts a manual declination at the model value and validates edits', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', true);
    const model = Math.round(declination(DC, new Date()) * 10) / 10;
    expect(useSettings.getState().declinationOverrideDeg).toBe(model);

    const field = screen.getByLabelText('Declination degrees');
    await fireEvent.changeText(field, '200');
    await fireEvent(field, 'endEditing');
    expect(screen.getByText('Enter a number from −180 to 180 (east positive)')).toBeTruthy();
    expect(useSettings.getState().declinationOverrideDeg).toBe(model);

    await fireEvent.changeText(field, '-9.5');
    await fireEvent(field, 'endEditing');
    expect(useSettings.getState().declinationOverrideDeg).toBe(-9.5);
    expect(screen.queryByText('Enter a number from −180 to 180 (east positive)')).toBeNull();

    await fireEvent(screen.getByLabelText('Manual declination'), 'valueChange', false);
    expect(useSettings.getState().declinationOverrideDeg).toBeNull();
  });

  it('shows the G-M angle at the crosshair', async () => {
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    expect(screen.getByText(/^G-M angle here: \d+\.\d° [EW]$/)).toBeTruthy();
  });

  it('closes', async () => {
    useMenu.getState().openMenu('settings', {});
    await renderWithProviders(<SettingsMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Close'));
    expect(useMenu.getState().stack).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/menus/menus/settings`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/features/menus/menus/settings-format.ts`:

```ts
import type { AngleUnit } from '@/lib/geo/types';
import { degToMils } from '@/lib/geo/units/angle';

/** Signed east/west angle text: "10.6° W" or "188 mils W" (east positive). */
export function formatEastWest(deg: number | null, unit: AngleUnit): string {
  if (deg === null || !Number.isFinite(deg)) return '—';
  const side = deg >= 0 ? 'E' : 'W';
  const abs = Math.abs(deg);
  return unit === 'mil' ? `${Math.round(degToMils(abs))} mils ${side}` : `${abs.toFixed(1)}° ${side}`;
}
```

`src/features/menus/menus/SettingsMenu.tsx`:

```tsx
import { useState } from 'react';
import { Text, View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuTextField } from '@/components/menu/MenuTextField';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { gridMagneticAngle } from '@/lib/geo/north/convert';
import { declination } from '@/lib/geo/north/magnetic';
import type { AngleUnit, NorthRef } from '@/lib/geo/types';
import { useInteraction } from '@/stores/interaction';
import { useMenu } from '@/stores/menu';
import { useSettings, type CoordinateFormat } from '@/stores/settings';

import { defineMenu, type MenuComponentProps } from '../define-menu';
import { formatEastWest } from './settings-format';

const DECLINATION_ERROR = 'Enter a number from −180 to 180 (east positive)';

export function SettingsMenu(_props: MenuComponentProps<'settings'>) {
  const close = useMenu((s) => s.closeMenu);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const override = useSettings((s) => s.declinationOverrideDeg);
  const setCoordinateFormat = useSettings((s) => s.setCoordinateFormat);
  const setAngleUnit = useSettings((s) => s.setAngleUnit);
  const setNorthRef = useSettings((s) => s.setNorthRef);
  const setDeclinationOverride = useSettings((s) => s.setDeclinationOverride);
  const center = useInteraction((s) => s.cameraCenter);

  const date = new Date();
  const model = center ? declination(center, date) : null;
  const gm = center ? gridMagneticAngle(center, { date, declinationOverrideDeg: override }) : null;
  const [text, setText] = useState(override === null ? '' : String(override));
  const [error, setError] = useState<string | null>(null);

  const toggleManual = (on: boolean) => {
    setError(null);
    if (!on) {
      setDeclinationOverride(null);
      setText('');
      return;
    }
    const start = Math.round((model ?? 0) * 10) / 10;
    setDeclinationOverride(start);
    setText(String(start));
  };

  const commit = () => {
    const value = Number(text.replace(',', '.'));
    if (text.trim() === '' || !setDeclinationOverride(value)) setError(DECLINATION_ERROR);
    else setError(null);
  };

  return (
    <View>
      <MenuHeader title="Settings" leading={{ label: 'Close', onPress: close }} />
      <MenuSection label="Coordinates">
        <MenuSegmented<CoordinateFormat>
          options={[
            { value: 'mgrs', label: 'MGRS' },
            { value: 'latlon', label: 'Lat/Lon' },
          ]}
          value={coordinateFormat}
          onChange={setCoordinateFormat}
        />
      </MenuSection>
      <MenuSection label="Angles">
        <MenuSegmented<AngleUnit>
          options={[
            { value: 'deg', label: 'Degrees' },
            { value: 'mil', label: 'Mils' },
          ]}
          value={angleUnit}
          onChange={setAngleUnit}
        />
      </MenuSection>
      <MenuSection label="North reference">
        <MenuSegmented<NorthRef>
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'magnetic', label: 'Magnetic' },
            { value: 'true', label: 'True' },
          ]}
          value={northRef}
          onChange={setNorthRef}
        />
        <Text className="text-sm text-text-muted">{`G-M angle here: ${formatEastWest(gm, angleUnit)}`}</Text>
      </MenuSection>
      <MenuSection label="Declination">
        <MenuToggle label="Manual declination" value={override !== null} onValueChange={toggleManual} />
        {override !== null ? (
          <>
            <MenuTextField
              mono
              accessibilityLabel="Declination degrees"
              value={text}
              onChangeText={setText}
              onEndEditing={commit}
              onSubmitEditing={commit}
              keyboardType="numbers-and-punctuation"
              invalid={error !== null}
              placeholder="e.g. -10.6"
            />
            {error ? <Text className="text-sm text-danger">{error}</Text> : null}
          </>
        ) : null}
        {model !== null ? <Text className="text-sm text-text-muted">{`Model (WMM2025) here: ${formatEastWest(model, 'deg')}`}</Text> : null}
      </MenuSection>
    </View>
  );
}

export const settingsMenu = defineMenu({ id: 'settings', family: 'app', title: 'Settings', detents: ['half', 'full'], component: SettingsMenu });
```

Register it in `src/features/menus/registry.ts` (`import { settingsMenu } from './menus/SettingsMenu';` and `settings: settingsMenu,`). In `src/features/map/MissionMap.tsx` pass `onSettings={() => useMenu.getState().openMenu('settings', {})}` to `Toolbar`.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS. (G-M sign convention: `gridMagneticAngle` is magnetic north measured from grid north, east positive — keep it.)

- [ ] **Step 5: Commit**

```bash
git add src/features/menus src/features/map/MissionMap.tsx
git commit -m "feat: add settings menu with declination override and G-M angle"
```

---

### Task 11: Draft store and point data helpers

**Files:**
- Create: `src/stores/draft.ts`, `src/stores/draft.test.ts`
- Modify: `src/lib/geo/measure/geodesic.ts`, `src/lib/geo/measure/geodesic.test.ts`, `src/features/map-items/repository.ts`, `src/features/map-items/commands.ts`, `src/features/map-items/map-items.test.ts`

**Interfaces:**
- Produces:
  - `midpoint(a: LatLon, b: LatLon): LatLon` (geodesic) from `@/lib/geo/measure/geodesic`.
  - `observeItem(db, id): Observable<MapItemSnapshot | null>` (null when missing or deleted).
  - `setItemHidden(ctx, id, hidden: boolean): Promise<Result<void, 'write_failed'>>`.
  - `useDraft` — values `mode: 'add' | 'edit' | null`, `itemId`, `coord: LatLon | null`, `coordSource: DraftCoordSource | null`, `coordRev: number` (bumps on every coordinate change, never resets), `coordInputValid: boolean`, `affiliation`, `unitType`, `name`, `nameEdited`, `notes`, `remembered: { affiliation; unitType }`; actions `startAdd({ coord, source })`, `startEdit({ itemId, coord, affiliation, unitType, name, notes })`, `setCoord(coord, source)`, `setCoordInputValid(valid)`, `setAffiliation(a)`, `setUnitType(t)`, `setName(name)`, `setAutoName(name)`, `setNotes(notes)`, `resetAfterAdd(coord)`, `clear()`; `type DraftCoordSource = 'crosshair' | 'self' | 'press' | 'typed' | 'item'`; `type DraftMode`; `INITIAL_DRAFT`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/geo/measure/geodesic.test.ts` (import `midpoint`):

```ts
describe('midpoint', () => {
  it('is equidistant along the geodesic', () => {
    const a = { lat: 38.8977, lon: -77.0365 };
    const b = { lat: 38.95, lon: -76.9 };
    const m = midpoint(a, b);
    const total = inverse(a, b).distanceM;
    expect(inverse(a, m).distanceM).toBeCloseTo(total / 2, 3);
    expect(inverse(m, b).distanceM).toBeCloseTo(total / 2, 3);
  });

  it('returns the start for identical points', () => {
    const a = { lat: 10, lon: 20 };
    expect(midpoint(a, a)).toEqual(a);
  });
});
```

Add to `src/features/map-items/map-items.test.ts` (inside `describe('map items')`; import `observeItem` and `setItemHidden`):

```ts
  it('observes one item and reports null once it is deleted', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!r.ok) throw new Error('setup');
    expect((await firstValueFrom(observeItem(ctx.db, r.value.id)))?.name).toBe('HOS-1');
    await deleteItem(ctx, r.value.id);
    expect(await firstValueFrom(observeItem(ctx.db, r.value.id))).toBeNull();
    expect(await firstValueFrom(observeItem(ctx.db, 'nope'))).toBeNull();
  });

  it('sets visibility explicitly', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!r.ok) throw new Error('setup');
    await setItemHidden(ctx, r.value.id, true);
    await setItemHidden(ctx, r.value.id, true);
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([r.value.id]);
    await setItemHidden(ctx, r.value.id, false);
    expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([]);
  });
```

`src/stores/draft.test.ts`:

```ts
import { INITIAL_DRAFT, useDraft } from './draft';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.95, lon: -77.05 };

beforeEach(() => useDraft.setState(INITIAL_DRAFT));

describe('draft store', () => {
  it('starts an add at a coordinate with the remembered affiliation', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: A, coordSource: 'crosshair', affiliation: 'hostile', name: '', nameEdited: false });
  });

  it('bumps the revision on every coordinate change and ignores invalid ones', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    const rev = useDraft.getState().coordRev;
    useDraft.getState().setCoord(B, 'typed');
    expect(useDraft.getState()).toMatchObject({ coord: B, coordSource: 'typed', coordRev: rev + 1 });
    useDraft.getState().setCoord({ lat: 95, lon: 0 }, 'press');
    expect(useDraft.getState()).toMatchObject({ coord: B, coordRev: rev + 1 });
  });

  it('clears an auto name when the affiliation changes, but keeps an edited one', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    useDraft.getState().setAutoName('HOS-1');
    useDraft.getState().setAffiliation('friend');
    expect(useDraft.getState().name).toBe('');
    useDraft.getState().setName('OBJ IRON');
    useDraft.getState().setAffiliation('neutral');
    expect(useDraft.getState().name).toBe('OBJ IRON');
    useDraft.getState().setAutoName('NEU-1');
    expect(useDraft.getState().name).toBe('OBJ IRON');
  });

  it('returns to auto naming when the user clears the name', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    useDraft.getState().setName('X');
    useDraft.getState().setName('  ');
    expect(useDraft.getState().nameEdited).toBe(false);
  });

  it('resets after an add, keeping affiliation and type', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    useDraft.getState().setAffiliation('friend');
    useDraft.getState().setUnitType('armor');
    useDraft.getState().setName('FRD-7');
    useDraft.getState().setNotes('dug in');
    useDraft.getState().resetAfterAdd(B);
    expect(useDraft.getState()).toMatchObject({ coord: B, coordSource: 'crosshair', affiliation: 'friend', unitType: 'armor', name: '', nameEdited: false, notes: '' });
  });

  it('remembers add choices across clear, but not edit values', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    useDraft.getState().setAffiliation('friend');
    useDraft.getState().clear();
    useDraft.getState().startEdit({ itemId: 'i1', coord: B, affiliation: 'unknown', unitType: 'medical', name: 'UNK-1', notes: '' });
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', itemId: 'i1', nameEdited: true, coordSource: 'item' });
    useDraft.getState().clear();
    expect(useDraft.getState()).toMatchObject({ mode: null, coord: null, affiliation: 'friend' });
    useDraft.getState().startAdd({ coord: A, source: 'press' });
    expect(useDraft.getState().affiliation).toBe('friend');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/stores/draft.test.ts src/lib/geo/measure src/features/map-items`
Expected: FAIL — `midpoint`, `observeItem`, `setItemHidden`, `./draft` missing.

- [ ] **Step 3: Implement**

Add to `src/lib/geo/measure/geodesic.ts`:

```ts
/** Point halfway along the geodesic from a to b (a when they coincide). */
export function midpoint(a: LatLon, b: LatLon): LatLon {
  const { distanceM, azimuthTrue } = inverse(a, b);
  if (azimuthTrue === null) return a;
  return destination(a, azimuthTrue, distanceM / 2);
}
```

Add to `src/features/map-items/repository.ts`:

```ts
/** One item as a snapshot; null when it does not exist or was deleted. */
export function observeItem(db: Database, id: string): Observable<MapItemSnapshot | null> {
  return db
    .get<MapItem>(Tables.mapItems)
    .query(Q.where('id', id))
    .observeWithColumns(['geometry', 'sidc', 'name', 'notes', 'updated_at'])
    .pipe(map((items) => (items[0] ? snapshot(items[0]) : null)));
}
```

Add to `src/features/map-items/commands.ts`:

```ts
/** Sets per-device visibility (local-only view state). Showing an item with no view state is a no-op. */
export async function setItemHidden(ctx: CommandContext, id: string, hidden: boolean): Promise<Result<void, 'write_failed'>> {
  try {
    await ctx.db.write(async () => {
      const existing = await findItemViewState(ctx.db, id);
      if (existing) {
        if (existing.hidden !== hidden) {
          await existing.update((s) => {
            s.hidden = hidden;
          });
        }
      } else if (hidden) {
        await ctx.db.get<ItemViewState>(Tables.itemViewState).create((s) => {
          s.mapItemId = id;
          s.hidden = true;
        });
      }
    });
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
```

`src/stores/draft.ts`:

```ts
import { create } from 'zustand';

import type { Affiliation, UnitType } from '@/features/symbology/presets';
import type { LatLon } from '@/lib/geo/types';

export type DraftMode = 'add' | 'edit';
/** Where the draft coordinate came from; the map follows every source except the crosshair. */
export type DraftCoordSource = 'crosshair' | 'self' | 'press' | 'typed' | 'item';

type DraftValues = {
  mode: DraftMode | null;
  itemId: string | null;
  coord: LatLon | null;
  coordSource: DraftCoordSource | null;
  /** Increments on every coordinate change; never resets, so subscribers never miss a change. */
  coordRev: number;
  /** False while the MGRS fields hold partial or invalid input (Add/Save disabled). */
  coordInputValid: boolean;
  affiliation: Affiliation;
  unitType: UnitType;
  name: string;
  /** True once the user typed a name; auto-names never overwrite it. */
  nameEdited: boolean;
  notes: string;
  /** Last affiliation and type used for adding (rapid entry, and the next time Add opens). */
  remembered: { affiliation: Affiliation; unitType: UnitType };
};

type DraftActions = {
  startAdd: (start: { coord: LatLon | null; source: DraftCoordSource }) => void;
  startEdit: (item: { itemId: string; coord: LatLon; affiliation: Affiliation; unitType: UnitType; name: string; notes: string }) => void;
  setCoord: (coord: LatLon, source: DraftCoordSource) => void;
  setCoordInputValid: (valid: boolean) => void;
  setAffiliation: (affiliation: Affiliation) => void;
  setUnitType: (unitType: UnitType) => void;
  setName: (name: string) => void;
  setAutoName: (name: string) => void;
  setNotes: (notes: string) => void;
  resetAfterAdd: (coord: LatLon | null) => void;
  clear: () => void;
};

export const INITIAL_DRAFT: DraftValues = {
  mode: null,
  itemId: null,
  coord: null,
  coordSource: null,
  coordRev: 0,
  coordInputValid: true,
  affiliation: 'hostile',
  unitType: 'unspecified',
  name: '',
  nameEdited: false,
  notes: '',
  remembered: { affiliation: 'hostile', unitType: 'unspecified' },
};

function isValid(p: LatLon | null): p is LatLon {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** The in-progress point (add or edit). Lives only in memory; commands write it on Add/Save. */
export const useDraft = create<DraftValues & DraftActions>()((set) => ({
  ...INITIAL_DRAFT,
  startAdd: ({ coord, source }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      mode: 'add',
      coord: isValid(coord) ? coord : null,
      coordSource: source,
      coordRev: s.coordRev + 1,
    })),
  startEdit: ({ itemId, coord, affiliation, unitType, name, notes }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      mode: 'edit',
      itemId,
      coord: isValid(coord) ? coord : null,
      coordSource: 'item',
      coordRev: s.coordRev + 1,
      affiliation,
      unitType,
      name,
      nameEdited: true,
      notes,
    })),
  setCoord: (coord, source) =>
    set((s) => (isValid(coord) ? { coord, coordSource: source, coordRev: s.coordRev + 1 } : {})),
  setCoordInputValid: (coordInputValid) => set({ coordInputValid }),
  setAffiliation: (affiliation) =>
    set((s) => ({
      affiliation,
      name: s.nameEdited ? s.name : '',
      remembered: s.mode === 'add' ? { ...s.remembered, affiliation } : s.remembered,
    })),
  setUnitType: (unitType) =>
    set((s) => ({ unitType, remembered: s.mode === 'add' ? { ...s.remembered, unitType } : s.remembered })),
  setName: (name) => set({ name, nameEdited: name.trim() !== '' }),
  setAutoName: (name) => set((s) => (s.nameEdited ? {} : { name })),
  setNotes: (notes) => set({ notes }),
  resetAfterAdd: (coord) =>
    set((s) => ({
      coord: isValid(coord) ? coord : s.coord,
      coordSource: 'crosshair',
      coordRev: s.coordRev + 1,
      coordInputValid: true,
      name: '',
      nameEdited: false,
      notes: '',
    })),
  clear: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      coordRev: s.coordRev,
    })),
}));
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/draft.ts src/stores/draft.test.ts src/lib/geo/measure src/features/map-items
git commit -m "feat: add draft point store, item observer, explicit visibility and midpoint"
```

---

### Task 12: Draft images and DraftLayer

**Files:**
- Modify: `src/features/map/images/map-image-specs.ts`, `scripts/build-map-images.ts`, `src/features/map/images/map-images.ts`, `src/features/map/images/map-images.test.ts`, `src/features/map/layers/styles.ts`, `__mocks__/@rnmapbox/maps.tsx`, `src/test-utils/mapbox-mock.ts`
- Create: `assets/map/draft-ring*.png`, `assets/map/label-chip-accent.png` (generated), `src/features/map/layers/draft-features.ts`, `src/features/map/layers/draft-features.test.ts`, `src/features/map/layers/DraftLayer.tsx`, `src/features/map/layers/DraftLayer.test.tsx`

**Interfaces:**
- Consumes: `useDraft` (Task 11), `midpoint` (Task 11), `describeVector`, `composeSidc`, `usePresence`, `useSettings`, `useTheme`.
- Produces:
  - `MAP_IMAGE_IDS.draftRing = 'draft-ring'`, `MAP_IMAGE_IDS.labelChipAccent = 'label-chip-accent'`; `DRAFT_RING_SIZE`.
  - `draftFeatureCollection(input: DraftFeatureInput | null)`; `type DraftFeatureInput = { coord: LatLon; sidc: string; label: string; self: LatLon | null; rangeLabel: string | null }`. Feature `properties.role`: `'draft'` (point), `'range'` (line self→draft), `'range-label'` (point at the midpoint).
  - Styles: `DRAFT_FILTERS`, `DRAFT_RING_STYLE`, `DRAFT_SYMBOL_STYLE`, `makeDraftLabelStyle(colors)`, `makeRangeLineStyle(colors)`, `makeRangeLabelStyle(colors)`.
  - `DraftLayer()` — source `draft`; layers `draft-range-line` (LineLayer), `draft-range-label`, `draft-ring`, `draft-symbol`, `draft-label`.
  - Mock: `LineLayer` recorded in `__props.LineLayer[id]`.

- [ ] **Step 1: Generate the images**

Add to `src/features/map/images/map-image-specs.ts`:

```ts
/** Draft selection ring canvas at @1x, in px (generated at @1x/@2x/@3x). */
export const DRAFT_RING_SIZE = 72;
export const DRAFT_RING_RADIUS = 24;
```

In `scripts/build-map-images.ts`, import `DRAFT_RING_RADIUS, DRAFT_RING_SIZE` with the other specs and add before the final `console.log`:

```ts
// Draft selection ring: dashed amber circle with four tick marks (mockup "HOS-4 · NEW").
const D = DRAFT_RING_SIZE;
const DC = D / 2;
const ticks = [0, 90, 180, 270]
  .map((a) => {
    const r = (a * Math.PI) / 180;
    const [sx, sy] = [Math.sin(r), -Math.cos(r)];
    const x1 = DC + sx * (DRAFT_RING_RADIUS + 3);
    const y1 = DC + sy * (DRAFT_RING_RADIUS + 3);
    const x2 = DC + sx * (DRAFT_RING_RADIUS + 11);
    const y2 = DC + sy * (DRAFT_RING_RADIUS + 11);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.accent}" stroke-width="2.5" stroke-linecap="round"/>`;
  })
  .join('');
const ring = `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}" viewBox="0 0 ${D} ${D}"><circle cx="${DC}" cy="${DC}" r="${DRAFT_RING_RADIUS}" fill="${colors.accent}" fill-opacity="0.15" stroke="${colors.accent}" stroke-width="2" stroke-dasharray="5 4"/>${ticks}</svg>`;
writeScaled('draft-ring', ring);

// Accent label chip for the draft ("HOS-4 · NEW"): same geometry as the dark chip.
const accentChip = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radiusPx}" fill="${colors.accent}"/></svg>`;
writeFileSync(join(OUT_DIR, 'label-chip-accent.png'), new Resvg(accentChip).render().asPng());
```

Run: `npm run build:map-images`
Expected: `assets/map/` gains `draft-ring.png`, `draft-ring@2x.png`, `draft-ring@3x.png`, `label-chip-accent.png`. View `assets/map/draft-ring@3x.png` with the Read tool: an amber dashed circle with four short ticks.

- [ ] **Step 2: Write the failing tests**

In `src/features/map/images/map-images.test.ts`, extend the files-on-disk test:

```ts
    for (const suffix of ['', '@2x', '@3x']) expect(existsSync(join(ASSETS, `draft-ring${suffix}.png`))).toBe(true);
    expect(existsSync(join(ASSETS, 'label-chip-accent.png'))).toBe(true);
```

`src/features/map/layers/draft-features.test.ts`:

```ts
import { midpoint } from '@/lib/geo/measure/geodesic';

import { draftFeatureCollection } from './draft-features';

const SELF = { lat: 38.8977, lon: -77.0365 };
const DRAFT = { lat: 38.905, lon: -77.03 };

describe('draftFeatureCollection', () => {
  it('is empty without a draft', () => {
    expect(draftFeatureCollection(null).features).toEqual([]);
  });

  it('has only the draft point without a fix', () => {
    const fc = draftFeatureCollection({ coord: DRAFT, sidc: 'SHGPU----------', label: 'HOS-4 · NEW', self: null, rangeLabel: null });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]).toMatchObject({
      geometry: { type: 'Point', coordinates: [DRAFT.lon, DRAFT.lat] },
      properties: { role: 'draft', sidc: 'SHGPU----------', label: 'HOS-4 · NEW' },
    });
  });

  it('adds a range line from the user and a label at its midpoint', () => {
    const fc = draftFeatureCollection({ coord: DRAFT, sidc: 'SHGPU----------', label: 'HOS-4 · NEW', self: SELF, rangeLabel: '1.15 km · 103°' });
    const line = fc.features.find((f) => f.properties.role === 'range');
    const label = fc.features.find((f) => f.properties.role === 'range-label');
    expect(line?.geometry).toEqual({ type: 'LineString', coordinates: [[SELF.lon, SELF.lat], [DRAFT.lon, DRAFT.lat]] });
    const mid = midpoint(SELF, DRAFT);
    expect(label?.geometry).toEqual({ type: 'Point', coordinates: [mid.lon, mid.lat] });
    expect(label?.properties.label).toBe('1.15 km · 103°');
  });
});
```

`src/features/map/layers/DraftLayer.test.tsx`:

```tsx
import { act } from '@testing-library/react-native';

import { composeSidc } from '@/features/symbology/presets';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { DraftLayer } from './DraftLayer';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { role: string; label?: string; sidc?: string } }[] };
const DRAFT = { lat: 38.905, lon: -77.03 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  usePresence.setState(INITIAL_PRESENCE);
});

describe('DraftLayer', () => {
  it('draws the draft symbol and its NEW label', async () => {
    useDraft.getState().startAdd({ coord: DRAFT, source: 'crosshair' });
    useDraft.getState().setAutoName('HOS-4');
    await renderWithProviders(<DraftLayer />);
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features[0].properties).toMatchObject({ role: 'draft', label: 'HOS-4 · NEW', sidc: composeSidc('hostile', 'unspecified') });
    expect(mapboxMock().__props.SymbolLayer['draft-ring']).toBeDefined();
    expect(mapboxMock().__props.LineLayer['draft-range-line']).toBeDefined();
  });

  it('adds the range line once there is a fix and keeps styles stable', async () => {
    useDraft.getState().startAdd({ coord: DRAFT, source: 'crosshair' });
    await renderWithProviders(<DraftLayer />);
    const labelStyle = mapboxMock().__props.SymbolLayer['draft-label'].style;
    await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: 5, timestamp: 1 }));
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features.map((f) => f.properties.role)).toEqual(['draft', 'range', 'range-label']);
    expect(mapboxMock().__props.SymbolLayer['draft-label'].style).toBe(labelStyle);
  });

  it('labels an edit draft EDIT', async () => {
    useDraft.getState().startEdit({ itemId: 'i1', coord: DRAFT, affiliation: 'friend', unitType: 'armor', name: 'FRD-2', notes: '' });
    await renderWithProviders(<DraftLayer />);
    const shape = mapboxMock().__props.ShapeSource.draft.shape as Shape;
    expect(shape.features[0].properties.label).toBe('FRD-2 · EDIT');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest src/features/map/images src/features/map/layers`
Expected: FAIL — `draft-features`, `DraftLayer` missing; mock has no `LineLayer`.

- [ ] **Step 4: Implement**

In `__mocks__/@rnmapbox/maps.tsx` add `LineLayer: {},` to `__props` and:

```tsx
export function LineLayer(props: Props) {
  __props.LineLayer[props.id ?? 'main'] = props;
  return null;
}
```

In `src/test-utils/mapbox-mock.ts` add `'LineLayer'` to the `__props` key union.

In `src/features/map/images/map-images.ts` add the ids and images:

```ts
export const MAP_IMAGE_IDS = {
  self: 'self',
  selfNoHeading: 'self-no-heading',
  labelChip: 'label-chip',
  labelChipAccent: 'label-chip-accent',
  draftRing: 'draft-ring',
} as const;
```

and in `MAP_IMAGES`:

```ts
  [MAP_IMAGE_IDS.labelChipAccent]: { image: require('../../../../assets/map/label-chip-accent.png'), ...LABEL_CHIP_IMAGE_OPTIONS },
  [MAP_IMAGE_IDS.draftRing]: require('../../../../assets/map/draft-ring.png'),
```

`src/features/map/layers/draft-features.ts`:

```ts
import { midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

export type DraftRole = 'draft' | 'range' | 'range-label';

type DraftFeature =
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: { role: DraftRole; sidc?: string; label?: string } }
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: { role: DraftRole } };

export type DraftFeatureCollection = { type: 'FeatureCollection'; features: DraftFeature[] };

export type DraftFeatureInput = { coord: LatLon; sidc: string; label: string; self: LatLon | null; rangeLabel: string | null };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

/** The draft point, plus a range line and its label when the user's position is known. */
export function draftFeatureCollection(input: DraftFeatureInput | null): DraftFeatureCollection {
  if (!input) return { type: 'FeatureCollection', features: [] };
  const features: DraftFeature[] = [
    { type: 'Feature', id: 'draft', geometry: { type: 'Point', coordinates: lonLat(input.coord) }, properties: { role: 'draft', sidc: input.sidc, label: input.label } },
  ];
  if (input.self && input.rangeLabel) {
    features.push(
      { type: 'Feature', id: 'draft-range', geometry: { type: 'LineString', coordinates: [lonLat(input.self), lonLat(input.coord)] }, properties: { role: 'range' } },
      {
        type: 'Feature',
        id: 'draft-range-label',
        geometry: { type: 'Point', coordinates: lonLat(midpoint(input.self, input.coord)) },
        properties: { role: 'range-label', label: input.rangeLabel },
      },
    );
  }
  return { type: 'FeatureCollection', features };
}
```

Add to `src/features/map/layers/styles.ts` (import `type LineLayerStyle` alongside `SymbolLayerStyle`):

```ts
const role = (r: string) => ['==', ['get', 'role'], r];

/** Layer filters for the draft source's three feature roles. */
export const DRAFT_FILTERS = { draft: role('draft'), range: role('range'), rangeLabel: role('range-label') };

export const DRAFT_RING_STYLE: SymbolLayerStyle = {
  iconImage: MAP_IMAGE_IDS.draftRing,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

export const DRAFT_SYMBOL_STYLE: SymbolLayerStyle = {
  iconImage: ['get', 'sidc'],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
};

/** Amber "HOS-4 · NEW" chip below the draft; always shown. */
export function makeDraftLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: ['get', 'label'],
    textFont: MAP_LABEL_FONT,
    textSize: 12,
    textColor: colors['on-accent'],
    textAnchor: 'top',
    textOffset: [0, 2.6],
    iconImage: MAP_IMAGE_IDS.labelChipAccent,
    iconTextFit: 'both',
    iconTextFitPadding: [2, 6, 2, 6],
    textAllowOverlap: true,
    iconAllowOverlap: true,
  };
}

/** Dashed amber range line from the user to the draft. */
export function makeRangeLineStyle(colors: Record<SemanticToken, string>): LineLayerStyle {
  return { lineColor: colors.accent, lineWidth: 2, lineDasharray: [2, 2] };
}

/** "1.15 km · 103°" on a dark chip at the line's midpoint. */
export function makeRangeLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: ['get', 'label'],
    textFont: MAP_LABEL_FONT,
    textSize: 12,
    textColor: colors.accent,
    iconImage: MAP_IMAGE_IDS.labelChip,
    iconTextFit: 'both',
    iconTextFitPadding: [2, 6, 2, 6],
    textAllowOverlap: true,
    iconAllowOverlap: true,
  };
}
```

`src/features/map/layers/DraftLayer.tsx`:

```tsx
import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { composeSidc } from '@/features/symbology/presets';
import { describeVector } from '@/lib/geo/vector';
import { useDraft } from '@/stores/draft';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { draftFeatureCollection } from './draft-features';
import {
  DRAFT_FILTERS,
  DRAFT_RING_STYLE,
  DRAFT_SYMBOL_STYLE,
  makeDraftLabelStyle,
  makeRangeLabelStyle,
  makeRangeLineStyle,
} from './styles';

type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const filter = (f: unknown) => f as Filter;

/** The in-progress point: symbol, dashed ring, NEW/EDIT chip, and range line from the user. */
export function DraftLayer() {
  const { colors } = useTheme();
  const mode = useDraft((s) => s.mode);
  const coord = useDraft((s) => s.coord);
  const affiliation = useDraft((s) => s.affiliation);
  const unitType = useDraft((s) => s.unitType);
  const name = useDraft((s) => s.name);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);

  const labelStyle = useMemo(() => makeDraftLabelStyle(colors), [colors]);
  const lineStyle = useMemo(() => makeRangeLineStyle(colors), [colors]);
  const rangeLabelStyle = useMemo(() => makeRangeLabelStyle(colors), [colors]);

  const shape = useMemo(() => {
    if (!mode || !coord) return draftFeatureCollection(null);
    const v = self ? describeVector(self, coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
    return draftFeatureCollection({
      coord,
      sidc: composeSidc(affiliation, unitType),
      label: `${name.trim() || '…'} · ${mode === 'add' ? 'NEW' : 'EDIT'}`,
      self,
      rangeLabel: v ? `${v.distanceLabel} · ${v.bearingLabel}` : null,
    });
  }, [mode, coord, affiliation, unitType, name, self, angleUnit, northRef, declinationOverrideDeg]);

  return (
    <ShapeSource id="draft" shape={shape}>
      <LineLayer id="draft-range-line" style={lineStyle} filter={filter(DRAFT_FILTERS.range)} />
      <SymbolLayer id="draft-range-label" style={rangeLabelStyle} filter={filter(DRAFT_FILTERS.rangeLabel)} />
      <SymbolLayer id="draft-ring" style={DRAFT_RING_STYLE} filter={filter(DRAFT_FILTERS.draft)} />
      <SymbolLayer id="draft-symbol" style={DRAFT_SYMBOL_STYLE} filter={filter(DRAFT_FILTERS.draft)} />
      <SymbolLayer id="draft-label" style={labelStyle} filter={filter(DRAFT_FILTERS.draft)} />
    </ShapeSource>
  );
}
```

(If `tsc` rejects `shape={shape}`, cast with `shape={shape as GeoJSON.FeatureCollection}`; if it rejects a `LineLayer` filter typed from `SymbolLayer`, add a second `filter` helper typed from `ComponentProps<typeof LineLayer>['filter']`.)

- [ ] **Step 5: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: draw the draft point with ring, NEW label and range line"
```

---

### Task 13: Add Point — form, menu, POINT tool, long-press, map follows the draft

**Files:**
- Create: `src/features/map-items/menus/PointForm.tsx`, `src/features/map-items/menus/AddPointMenu.tsx`, `src/features/map-items/menus/AddPointMenu.test.tsx`, `src/features/map-items/menus/AddPointMenu.failure.test.tsx`
- Modify: `src/features/menus/registry.ts`, `src/features/map/canvas/MapCanvas.tsx`, `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: `useDraft` (Task 11); `MgrsInput`, `evaluateMgrsFields`, `mgrsFieldsFor`, `EMPTY_MGRS` (Task 7); primitives (Tasks 5–6); `placePoint` (`../commands`); `suggestPointName` (`../repository`); `AFFILIATIONS`, `UNIT_TYPES`, `composeSidc` (`@/features/symbology/presets`); `SYMBOL_IMAGES`; `notifySuccess`, `notifyError` (Task 2); `DraftLayer` (Task 12); `useMenu`, `topMenu`, `defineMenu`.
- Produces:
  - `PointForm({ missionId, mode })` — MGRS (with Center/Me), affiliation, name, unit type, notes; edits only the draft store.
  - `addPointMenu` (`point.add`, detents `['peek', 'half', 'full']`), `AddPointMenu`.
  - `MapCanvas` prop `onLongPress?: (coord: LatLon) => void`.
  - MissionMap behavior: POINT toggles `point.add` (toolbar shows it active); long-press opens `point.add` at the press, or moves the draft when `point.add`/`point.edit` is open; whenever the draft coordinate changes from typing, Me, a long-press or an item, the camera eases to it (padding keeps it in the visible center); Center never moves the camera.

- [ ] **Step 1: Write the failing tests**

`src/features/map-items/menus/AddPointMenu.test.tsx`:

```tsx
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { renderWithProviders } from '@/test-utils/render';

import { observeMissionItems } from '../repository';
import { AddPointMenu } from './AddPointMenu';

const CENTER = { lat: 38.8977, lon: -77.0365 };
const OTHER = { lat: 38.95, lon: -77.1 };

beforeEach(() => {
  jest.clearAllMocks();
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: CENTER, zoom: 14, bearing: 0 });
  useMenu.getState().openMenu('point.add', {});
});

async function open(ctx = makeTestContext()) {
  await renderWithProviders(<AddPointMenu params={{}} missionId="m1" />, ctx);
  await screen.findByDisplayValue('HOS-1');
  return ctx;
}

const items = (ctx: ReturnType<typeof makeTestContext>) => firstValueFrom(observeMissionItems(ctx.db, 'm1'));

describe('AddPointMenu', () => {
  it('starts at the crosshair with an auto name', async () => {
    await open();
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(CENTER).northing);
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: CENTER, coordSource: 'crosshair' });
    expect(screen.getByLabelText('Hostile')).toBeSelected();
  });

  it('adds the point, plays a success haptic and stays open for the next one', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    const [item] = await items(ctx);
    expect(item).toMatchObject({ name: 'HOS-1', sidc: composeSidc('hostile', 'unspecified') });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(await screen.findByDisplayValue('HOS-2')).toBeTruthy();
    expect(useDraft.getState()).toMatchObject({ mode: 'add', affiliation: 'hostile', coord: CENTER });
  });

  it('never gives two points the same name when Add is tapped twice quickly', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Add'));
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect((await items(ctx)).length).toBeGreaterThanOrEqual(1));
    const names = (await items(ctx)).map((i) => i.name);
    expect(names.length).toBeLessThanOrEqual(2);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps the map still and disables Add while the MGRS is partial', async () => {
    await open();
    const rev = useDraft.getState().coordRev;
    await fireEvent.changeText(screen.getByLabelText('Northing'), '073');
    expect(screen.getByLabelText('Add')).toBeDisabled();
    expect(useDraft.getState()).toMatchObject({ coord: CENTER, coordRev: rev, coordInputValid: false });
  });

  it('moves the draft to a typed reference', async () => {
    await open();
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    const { coord, coordSource } = useDraft.getState();
    expect(coordSource).toBe('typed');
    expect(coord?.lat).toBeCloseTo(OTHER.lat, 3);
    expect(coord?.lon).toBeCloseTo(OTHER.lon, 3);
    expect(screen.getByLabelText('Add')).toBeEnabled();
  });

  it('renames on affiliation change unless the user typed a name', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Friendly'));
    expect(await screen.findByDisplayValue('FRD-1')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    await fireEvent.press(screen.getByLabelText('Neutral'));
    expect(screen.getByDisplayValue('OBJ IRON')).toBeTruthy();
  });

  it('keeps the form when a long-press moves the draft', async () => {
    await open();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    await fireEvent.press(screen.getByLabelText('Friendly'));
    await act(async () => useDraft.getState().setCoord(OTHER, 'press'));
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(OTHER).northing);
    expect(screen.getByDisplayValue('OBJ IRON')).toBeTruthy();
    expect(useDraft.getState().affiliation).toBe('friend');
  });

  it('uses the crosshair or the user for Center and Me', async () => {
    await open();
    expect(screen.getByLabelText('Me')).toBeDisabled();
    await act(async () => usePresence.getState().setSelfPosition({ position: OTHER, accuracyM: 5, timestamp: 1 }));
    await fireEvent.press(screen.getByLabelText('Me'));
    expect(useDraft.getState()).toMatchObject({ coord: OTHER, coordSource: 'self' });
    await fireEvent.press(screen.getByLabelText('Center'));
    expect(useDraft.getState()).toMatchObject({ coord: CENTER, coordSource: 'crosshair' });
  });

  it('cancels', async () => {
    await open();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(useMenu.getState().stack).toEqual([]);
  });
});
```

`src/features/map-items/menus/AddPointMenu.failure.test.tsx`:

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { AddPointMenu } from './AddPointMenu';

jest.mock('../commands', () => ({
  ...jest.requireActual('../commands'),
  placePoint: jest.fn(async () => ({ ok: false, error: 'write_failed', message: 'disk full' })),
}));

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useToast.setState({ toast: null });
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: { lat: 38.8977, lon: -77.0365 }, zoom: 14, bearing: 0 });
});

it('shows a toast and an error haptic when the point cannot be saved', async () => {
  await renderWithProviders(<AddPointMenu params={{}} missionId="m1" />);
  await screen.findByDisplayValue('HOS-1');
  await fireEvent.press(screen.getByLabelText('Add'));
  await waitFor(() => expect(useToast.getState().toast?.message).toBe('Could not add the point.'));
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  expect(screen.getByDisplayValue('HOS-1')).toBeTruthy();
});
```

Add to `src/features/map/MapScreen.test.tsx` (import `useDraft, INITIAL_DRAFT` from `@/stores/draft`; add `useDraft.setState(INITIAL_DRAFT);` to `beforeEach`):

```tsx
  it('toggles Add Point from the toolbar', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('POINT'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add point');
    expect(screen.getByLabelText('POINT')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('POINT'));
    expect(screen.queryByTestId('menu-panel')).toBeNull();
  });

  it('long-press opens Add Point there, and a second long-press moves the draft and the map', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    const longPress = (lon: number, lat: number) =>
      act(async () =>
        (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {},
        }),
      );

    await longPress(-77.03, 38.9);
    expect(await screen.findByRole('header')).toHaveTextContent('Add point');
    expect(useDraft.getState().coord).toEqual({ lat: 38.9, lon: -77.03 });
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');

    mapboxMock().__camera.setCamera.mockClear();
    await longPress(-77.1, 38.95);
    expect(useDraft.getState()).toMatchObject({ coord: { lat: 38.95, lon: -77.1 }, name: 'OBJ IRON' });
    expect(mapboxMock().__camera.setCamera).toHaveBeenCalledWith(expect.objectContaining({ centerCoordinate: [-77.1, 38.95] }));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/map-items/menus src/features/map/MapScreen.test.tsx`
Expected: FAIL — menu modules missing; POINT disabled; no `onLongPress`.

- [ ] **Step 3: Implement**

`src/features/map-items/menus/PointForm.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { MenuTextField } from '@/components/menu/MenuTextField';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { AFFILIATIONS, composeSidc, UNIT_TYPES, type Affiliation, type UnitType } from '@/features/symbology/presets';
import { SYMBOL_IMAGES } from '@/features/symbology/symbol-images.generated';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { describeVector } from '@/lib/geo/vector';
import { useDraft, type DraftMode } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import { suggestPointName } from '../repository';

const AFFILIATION_LABELS: Record<Affiliation, string> = { friend: 'Friendly', hostile: 'Hostile', neutral: 'Neutral', unknown: 'Unknown' };
const UNIT_OPTIONS = UNIT_TYPES.map((t) => ({ value: t.id, label: t.label }));

/** The shared Add/Edit point form. It edits only the draft store; the menu decides when to write. */
export function PointForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const ctx = useCommandContext();
  const coord = useDraft((s) => s.coord);
  const coordRev = useDraft((s) => s.coordRev);
  const coordSource = useDraft((s) => s.coordSource);
  const affiliation = useDraft((s) => s.affiliation);
  const unitType = useDraft((s) => s.unitType);
  const name = useDraft((s) => s.name);
  const nameEdited = useDraft((s) => s.nameEdited);
  const notes = useDraft((s) => s.notes);
  const setCoord = useDraft((s) => s.setCoord);
  const setCoordInputValid = useDraft((s) => s.setCoordInputValid);
  const setAffiliation = useDraft((s) => s.setAffiliation);
  const setUnitType = useDraft((s) => s.setUnitType);
  const setName = useDraft((s) => s.setName);
  const setNotes = useDraft((s) => s.setNotes);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);

  const [parts, setParts] = useState<MgrsParts>(() => (coord ? mgrsFieldsFor(coord) : EMPTY_MGRS));
  const [showNotes, setShowNotes] = useState(notes !== '');

  // External moves (Center, Me, long-press, reset, item) rewrite the fields; typing does not.
  useEffect(() => {
    if (coord && coordSource !== 'typed') setParts(mgrsFieldsFor(coord));
  }, [coord, coordSource, coordRev]);

  const status = evaluateMgrsFields(parts);
  useEffect(() => {
    setCoordInputValid(status.status === 'valid');
  }, [status.status, setCoordInputValid]);

  const onPartsChange = (next: MgrsParts) => {
    setParts(next);
    const result = evaluateMgrsFields(next);
    if (result.status === 'valid') setCoord(result.coord, 'typed');
  };

  // Auto-name in add mode whenever the name is empty and the user has not typed one.
  const needsName = mode === 'add' && !nameEdited && name === '';
  useEffect(() => {
    if (!needsName) return;
    let live = true;
    void suggestPointName(ctx.db, missionId, affiliation).then((suggestion) => {
      if (live && useDraft.getState().affiliation === affiliation) useDraft.getState().setAutoName(suggestion);
    });
    return () => {
      live = false;
    };
  }, [needsName, affiliation, ctx, missionId]);

  const v = self && coord ? describeVector(self, coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
  const validDetail = v ? `${v.distanceLabel} @ ${v.bearingLabel} ${v.refLabel}` : undefined;

  const toCrosshair = () => {
    const center = useInteraction.getState().cameraCenter;
    if (center) setCoord(center, 'crosshair');
  };
  const toMe = () => {
    if (self) setCoord(self, 'self');
  };

  return (
    <View>
      <MenuSection label="MGRS · Zone / 100K / Easting / Northing">
        <MgrsInput value={parts} onChange={onPartsChange} status={status} validDetail={validDetail} />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <MenuButton label="Center" icon="crosshairs" onPress={toCrosshair} />
          </View>
          <View className="flex-1">
            <MenuButton label="Me" icon="crosshairs-gps" onPress={toMe} disabled={!self} />
          </View>
        </View>
      </MenuSection>
      <MenuSection label="Affiliation">
        <MenuSegmented<Affiliation>
          options={AFFILIATIONS.map((a) => ({
            value: a,
            label: AFFILIATION_LABELS[a],
            icon: <Image source={SYMBOL_IMAGES[composeSidc(a, 'unspecified')]} style={{ width: 30, height: 22 }} resizeMode="contain" />,
          }))}
          value={affiliation}
          onChange={setAffiliation}
        />
      </MenuSection>
      <MenuSection label="Name">
        <MenuTextField mono accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <MenuSection label="Unit type">
        <View className="flex-row items-start gap-2">
          <MenuSelect<UnitType> label="Unit type" options={UNIT_OPTIONS} value={unitType} onChange={setUnitType} />
          <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} />
        </View>
        {showNotes ? <MenuTextField accessibilityLabel="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Notes" /> : null}
      </MenuSection>
    </View>
  );
}
```

`src/features/map-items/menus/AddPointMenu.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { composeSidc } from '@/features/symbology/presets';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useMenu } from '@/stores/menu';

import { placePoint } from '../commands';
import { PointForm } from './PointForm';

export function AddPointMenu({ params, missionId }: MenuComponentProps<'point.add'>) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  const coord = useDraft((s) => s.coord);
  const name = useDraft((s) => s.name);
  const coordInputValid = useDraft((s) => s.coordInputValid);
  // A ref, not state: a second tap in the same frame must see the first tap's lock.
  const busy = useRef(false);

  useEffect(() => {
    const at = params.at ?? useInteraction.getState().cameraCenter;
    useDraft.getState().startAdd({ coord: at, source: params.at ? 'press' : 'crosshair' });
    return () => useDraft.getState().clear();
    // Opened once per panel; later long-presses move the draft instead of reopening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAdd = coord !== null && coordInputValid && name.trim() !== '';

  const add = async () => {
    if (busy.current || !canAdd) return;
    busy.current = true;
    const d = useDraft.getState();
    const result = await placePoint(ctx, {
      missionId,
      coord: d.coord!,
      sidc: composeSidc(d.affiliation, d.unitType),
      name: d.name,
      notes: d.notes.trim() || null,
    });
    busy.current = false;
    if (!result.ok) {
      notifyError(result.error === 'invalid_name' ? 'Enter a name.' : 'Could not add the point.');
      return;
    }
    notifySuccess();
    // Rapid entry: keep affiliation and type, start the next point at the crosshair.
    useDraft.getState().resetAfterAdd(useInteraction.getState().cameraCenter);
  };

  return (
    <View>
      <MenuHeader
        title="Add point"
        leading={{ label: 'Cancel', onPress: close }}
        trailing={{ label: 'Add', icon: 'check', onPress: () => void add(), disabled: !canAdd }}
      />
      <PointForm missionId={missionId} mode="add" />
    </View>
  );
}

export const addPointMenu = defineMenu({ id: 'point.add', family: 'action', title: 'Add point', detents: ['peek', 'half', 'full'], component: AddPointMenu });
```

Register in `src/features/menus/registry.ts`: `import { addPointMenu } from '@/features/map-items/menus/AddPointMenu';` and `'point.add': addPointMenu,`.

In `src/features/map/canvas/MapCanvas.tsx`: add prop `onLongPress?: (coord: LatLon) => void` (import `LatLon`, and `wrapLon` from `@/lib/geo/units/angle`) and pass to `MapView`:

```tsx
      onLongPress={(feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        if (Number.isFinite(lat) && Number.isFinite(lon)) onLongPress?.({ lat, lon: wrapLon(lon) });
      }}
```

In `src/features/map/MissionMap.tsx`:
- import `topMenu` (with `useMenu`), `useDraft` from `@/stores/draft`, `DraftLayer` from `./layers/DraftLayer`;
- `const topId = useMenu((s) => topMenu(s)?.id ?? null);` and `const draftActive = useDraft((s) => s.mode !== null);`
- the map follows the draft:

```tsx
  // The map follows the draft when typing, Me, a long-press or an item moves it — never for Center
  // (already under the crosshair) and never when the user pans (the draft stays put).
  useEffect(
    () =>
      useDraft.subscribe((state, prev) => {
        if (state.coordRev === prev.coordRev || !state.coord || state.coordSource === 'crosshair') return;
        markMoved();
        if (useInteraction.getState().followMode) setFollowMode(false);
        cameraRef.current?.setCamera({ centerCoordinate: [state.coord.lon, state.coord.lat], ...EASE, animationDuration: 400 });
      }),
    [markMoved, setFollowMode],
  );

  const togglePoint = () => {
    if (topId === 'point.add') useMenu.getState().closeMenu();
    else useMenu.getState().openMenu('point.add', {});
  };
  const onLongPress = (coord: LatLon) => {
    const current = topMenu(useMenu.getState())?.id;
    if (current === 'point.add' || current === 'point.edit') useDraft.getState().setCoord(coord, 'press');
    else useMenu.getState().openMenu('point.add', { at: coord });
  };
```

- pass `onLongPress={onLongPress}` to `MapCanvas`; render `{draftActive ? <DraftLayer /> : null}` between `PointsLayer` and `SelfLayer`;
- `Toolbar`: `activeTool={topId === 'point.add' ? 'point' : null}` and `onPoint={togglePoint}`.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS. (If the auto-name `findByDisplayValue('HOS-1')` races in `open()`, it is the suggestion promise; keep `findBy`.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add points from the POINT tool or a long-press"
```

---

### Task 14: Edit Point — tap a point, save, hide, delete

**Files:**
- Create: `src/features/map-items/menus/EditPointMenu.tsx`, `src/features/map-items/menus/EditPointMenu.test.tsx`
- Modify: `src/features/menus/registry.ts`, `src/features/map/layers/PointsLayer.tsx`, `src/features/map/layers/PointsLayer.test.tsx`, `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: `observeItem`, `observeHiddenItemIds` (`../repository`); `updateItem`, `deleteItem`, `setItemHidden` (`../commands`); `pointCoord` (`../geometry`); `decomposeSidc`, `composeSidc`; `PointForm` (Task 13); `MenuToggle`, `MenuActions`, `MenuSection`, `MenuHeader`; feedback.
- Produces:
  - `editPointMenu` (`point.edit`, detents `['peek', 'half', 'full']`); `MENU_REGISTRY` becomes total (`{ [I in MenuId]: MenuDefinition<I> }`).
  - `PointsLayer({ missionId, excludeId?, onItemPress? })` — tapping a symbol calls `onItemPress(id)`; `excludeId` is filtered out (the item being edited is drawn by `DraftLayer` instead).

- [ ] **Step 1: Write the failing tests**

`src/features/map-items/menus/EditPointMenu.test.tsx`:

```tsx
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { MenuHost } from '@/features/menus/MenuHost';
import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { deleteItem, placePoint } from '../commands';
import { pointCoord } from '../geometry';
import { findItem, observeHiddenItemIds } from '../repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const AT = { lat: 38.8977, lon: -77.0365 };
const OTHER = { lat: 38.95, lon: -77.1 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useToast.setState({ toast: null });
});

async function openEditor() {
  const ctx = makeTestContext();
  const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-2', notes: 'hull down' });
  if (!r.ok) throw new Error('setup');
  await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
  await act(async () => useMenu.getState().openMenu('point.edit', { itemId: r.value.id }));
  await screen.findByDisplayValue('FRD-2');
  return { ctx, id: r.value.id };
}

describe('EditPointMenu', () => {
  it('opens prefilled from the item', async () => {
    await openEditor();
    expect(screen.getByRole('header')).toHaveTextContent('Edit point');
    expect(screen.getByLabelText('Friendly')).toBeSelected();
    expect(screen.getByLabelText('Unit type: Armor')).toBeTruthy();
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(AT).northing);
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', notes: 'hull down' });
  });

  it('saves name and position, then closes', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'OBJ IRON');
    const p = mgrsFieldsFor(OTHER);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${p.zoneBand} ${p.square} ${p.easting} ${p.northing}`);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    const item = await findItem(ctx.db, id);
    expect(item?.name).toBe('OBJ IRON');
    expect(pointCoord(item!.geometry)?.lat).toBeCloseTo(OTHER.lat, 3);
  });

  it('hides the item without closing', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent(screen.getByLabelText('Hidden on map'), 'valueChange', true);
    await waitFor(async () => expect(await firstValueFrom(observeHiddenItemIds(ctx.db))).toEqual([id]));
    expect(screen.getByTestId('menu-panel')).toBeTruthy();
  });

  it('deletes after a second tap, without a "missing" message', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByText('Delete point'));
    expect(await findItem(ctx.db, id)).not.toBeNull();
    await fireEvent.press(screen.getByText('Tap again to delete'));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(await findItem(ctx.db, id)).toBeNull();
    expect(useToast.getState().toast).toBeNull();
  });

  it('closes with a message when the item is deleted elsewhere', async () => {
    const { ctx, id } = await openEditor();
    await act(async () => {
      await deleteItem(ctx, id);
    });
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(useToast.getState().toast?.message).toBe('That point no longer exists.');
  });

  it('closes with a message for an unknown item', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    await act(async () => useMenu.getState().openMenu('point.edit', { itemId: 'nope' }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(useToast.getState().toast?.message).toBe('That point no longer exists.');
    expect(useDraft.getState().mode).toBeNull();
  });
});
```

Add to `src/features/map/layers/PointsLayer.test.tsx`:

```tsx
  it('reports taps and leaves out the item being edited', async () => {
    const ctx = makeTestContext();
    const a = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!a.ok) throw new Error('setup');
    const onItemPress = jest.fn();
    await renderWithProviders(<PointsLayer missionId="m1" excludeId={a.value.id} onItemPress={onItemPress} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(props.SymbolLayer['points-symbols'].filter).toEqual(hiddenFilter([a.value.id])));
    await act(async () =>
      (props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: a.value.id } }], coordinates: {}, point: {} }),
    );
    expect(onItemPress).toHaveBeenCalledWith(a.value.id);
  });
```

Add to `src/features/map/MapScreen.test.tsx` (import `placePoint` from `@/features/map-items/commands`):

```tsx
  it('opens Edit Point when a point is tapped', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!p.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: p.value.id } }], coordinates: {}, point: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Edit point');
    expect(await screen.findByDisplayValue('HOS-1')).toBeTruthy();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/map-items/menus/EditPointMenu.test.tsx src/features/map/layers/PointsLayer.test.tsx src/features/map/MapScreen.test.tsx`
Expected: FAIL — module missing; `excludeId`/`onItemPress` unsupported.

- [ ] **Step 3: Implement**

`src/features/map-items/menus/EditPointMenu.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { MenuActions } from '@/components/menu/MenuActions';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { composeSidc, decomposeSidc } from '@/features/symbology/presets';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft } from '@/stores/draft';
import { useMenu } from '@/stores/menu';

import { deleteItem, setItemHidden, updateItem } from '../commands';
import { pointCoord } from '../geometry';
import { observeHiddenItemIds, observeItem, type MapItemSnapshot } from '../repository';
import { PointForm } from './PointForm';

const GONE = 'That point no longer exists.';
const NO_IDS: string[] = [];

export function EditPointMenu({ params, missionId }: MenuComponentProps<'point.edit'>) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  // undefined = still loading; null = missing or deleted.
  const item = useObservable<MapItemSnapshot | null | undefined>(() => observeItem(ctx.db, params.itemId), undefined, [ctx, params.itemId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const ready = useDraft((s) => s.mode === 'edit' && s.itemId === params.itemId);
  const coord = useDraft((s) => s.coord);
  const name = useDraft((s) => s.name);
  const coordInputValid = useDraft((s) => s.coordInputValid);
  const started = useRef(false);
  // Set before we close or delete ourselves, so the item vanishing is not reported as "missing".
  const leaving = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (item === undefined || leaving.current) return;
    const at = item ? pointCoord(item.geometry) : null;
    if (!item || !at) {
      leaving.current = true;
      notifyError(GONE);
      close();
      return;
    }
    if (started.current) return;
    started.current = true;
    const kind = (item.sidc ? decomposeSidc(item.sidc) : null) ?? { affiliation: 'unknown' as const, unitType: 'unspecified' as const };
    useDraft.getState().startEdit({ itemId: item.id, coord: at, affiliation: kind.affiliation, unitType: kind.unitType, name: item.name, notes: item.notes ?? '' });
  }, [item, close]);

  useEffect(() => () => useDraft.getState().clear(), []);

  const canSave = ready && coord !== null && coordInputValid && name.trim() !== '';

  const save = async () => {
    if (busy.current || !canSave) return;
    busy.current = true;
    const d = useDraft.getState();
    const result = await updateItem(ctx, params.itemId, {
      coord: d.coord!,
      name: d.name,
      notes: d.notes.trim() || null,
      sidc: composeSidc(d.affiliation, d.unitType),
    });
    busy.current = false;
    if (result.ok) {
      leaving.current = true;
      notifySuccess();
      close();
    } else if (result.error === 'not_found') {
      leaving.current = true;
      notifyError(GONE);
      close();
    } else {
      notifyError(result.error === 'invalid_name' ? 'Enter a name.' : 'Could not save the point.');
    }
  };

  const remove = async () => {
    if (busy.current) return;
    busy.current = true;
    leaving.current = true;
    const result = await deleteItem(ctx, params.itemId);
    busy.current = false;
    if (result.ok) {
      notifySuccess();
      close();
    } else {
      leaving.current = false;
      notifyError('Could not delete the point.');
    }
  };

  const setHidden = (hidden: boolean) => {
    void setItemHidden(ctx, params.itemId, hidden).then((result) => {
      if (!result.ok) notifyError('Could not change visibility.');
    });
  };

  return (
    <View>
      <MenuHeader
        title="Edit point"
        leading={{ label: 'Cancel', onPress: close }}
        trailing={{ label: 'Save', icon: 'check', onPress: () => void save(), disabled: !canSave }}
      />
      {ready ? (
        <>
          <PointForm missionId={missionId} mode="edit" />
          <MenuSection>
            <MenuToggle label="Hidden on map" value={hiddenIds.includes(params.itemId)} onValueChange={setHidden} />
          </MenuSection>
          <MenuActions destructive={{ label: 'Delete point', confirmLabel: 'Tap again to delete', onConfirm: () => void remove() }} />
        </>
      ) : null}
    </View>
  );
}

export const editPointMenu = defineMenu({ id: 'point.edit', family: 'action', title: 'Edit point', detents: ['peek', 'half', 'full'], component: EditPointMenu });
```


In `src/features/menus/registry.ts`: import `editPointMenu`, add `'point.edit': editPointMenu,`, and make the registry total:

```ts
/** Every menu, registered once by id. */
export type MenuRegistry = { [I in MenuId]: MenuDefinition<I> };
```

In `src/features/map/layers/PointsLayer.tsx`:

```tsx
type Props = { missionId: string; excludeId?: string | null; onItemPress?: (id: string) => void };

export function PointsLayer({ missionId, excludeId = null, onItemPress }: Props) {
  // …existing hooks…
  const filter = useMemo(
    () => hiddenFilter(excludeId ? [...hiddenIds, excludeId] : hiddenIds) as unknown as LayerFilter,
    [hiddenIds, excludeId],
  );
  // …
  return (
    <ShapeSource
      id="points"
      shape={shape}
      onPress={(e) => {
        const id = e.features[0]?.properties?.id;
        if (typeof id === 'string') onItemPress?.(id);
      }}>
      {/* layers unchanged */}
    </ShapeSource>
  );
}
```

In `src/features/map/MissionMap.tsx`: `const editingId = useDraft((s) => (s.mode === 'edit' ? s.itemId : null));` and render `<PointsLayer missionId={missionId} excludeId={editingId} onItemPress={(itemId) => useMenu.getState().openMenu('point.edit', { itemId })} />`.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: edit, hide and delete points by tapping them"
```

---

### Task 15: Skills, docs and device checklist

This task is docs-only. Agents write it; the user runs the device checklist.

**Files:**
- Create: `.agents/skills/menus/SKILL.md`, `.agents/skills/map-item-kinds/SKILL.md`
- Modify: `.agents/rules/repo-overview.mdc`, `docs/superpowers/notes/2026-10-12-native-gate.md`, `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md`

- [ ] **Step 1: Write the menus skill**

`.agents/skills/menus/SKILL.md`:

```markdown
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
   `MenuToggle`, `MenuTextField`, `MenuSegmented`, `MenuSelect`, `MenuActions`, `MgrsInput`.
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
```

- [ ] **Step 2: Write the map-item-kinds skill**

`.agents/skills/map-item-kinds/SKILL.md`:

```markdown
---
name: map-item-kinds
description: Use when adding a new kind of map item (line, polygon, route, range ring…) or changing how an existing kind is stored, drawn, created or edited. End-to-end recipe from geometry to menu.
---

# Adding a map item kind

Points are the reference implementation; follow the same path for each new kind.

1. **Kind and geometry** — add the value to `MapItemKind` (`src/lib/db/models/MapItem.ts`; no
   schema change: `kind` and `geometry` are strings). Add (de)serializers and validation to
   `src/features/map-items/geometry.ts` (GeoJSON, WGS84 `[lon, lat]`), with tests.
2. **Commands** — `placeX` in `src/features/map-items/commands.ts`: validate, stamp
   `createdBy`/`updatedBy`, return a `Result`. Reuse `updateItem`, `deleteItem`,
   `setItemHidden`. Use the `data-layer` skill.
3. **Selector** — a cached FeatureCollection builder in `selectors.ts` (cache by
   `id + updatedAt`, one selector per layer instance), with tests.
4. **Layer** — `src/features/map/layers/<Kind>Layer.tsx`: one `ShapeSource`, `LineLayer` /
   `FillLayer` / `SymbolLayer` with module-constant or theme-memoized styles in `styles.ts`,
   hidden items via `hiddenFilter`, `onPress` → open the edit menu. Follow the
   `map-performance` skill.
5. **Images** — generate any icons in `scripts/build-map-images.ts` and register them in
   `MAP_IMAGES`. Stretch values are in points (rnmapbox multiplies by `scale`).
6. **Tool** — add a `ToolId` and a `ToolButton` in `src/features/toolbar/Toolbar.tsx`; the
   active tool is the one whose menu is open.
7. **Draft** — extend `stores/draft.ts` (e.g. a vertex list) and draw it in a draft layer;
   the map follows draft changes from typing/Me/long-press, never from panning.
8. **Menus** — `x.add` / `x.edit` params + components + registry (use the `menus` skill);
   share one form component between add and edit.
9. **Naming** — extend `naming.ts` if the kind gets auto-names.
10. **Tests** — geometry, commands, selector cache, layer props via `mapboxMock()`, menus
    through `MenuHost`, and one `MapScreen` integration test for the tool.
```

- [ ] **Step 3: Update the overview, gate notes and spec**

In `.agents/rules/repo-overview.mdc`, change the skills line to:

```markdown
- Skills: `geo-library` (coordinates, bearings), `data-layer` (WatermelonDB, sync rules),
  `styling` (semantic tokens), `map-performance` (anything on or over the map),
  `menus` (panels and menus), `map-item-kinds` (new item kinds end to end),
  `commits` (commit messages).
```

Append to `docs/superpowers/notes/2026-10-12-native-gate.md`:

```markdown
## Plan 3 device checks (iOS dev build)

| # | Check | Result |
|---|-------|--------|
| 1 | Landscape with location off: the banner sits below the toolbar; Menu is tappable | PENDING |
| 2 | Hamburger opens the app menu; Switch mission returns to the list; About opens and goes back | PENDING |
| 3 | Gear opens Settings; changing coordinate format, mils and north reference updates the readout after closing | PENDING |
| 4 | Manual declination: toggling on starts at the model value; G-M angle is plausible for your area (compare with NOAA's calculator) | PENDING |
| 5 | Panel in portrait: drag the handle between peek / half / full; flings move one step; the map pans and zooms underneath | PENDING |
| 6 | Panel in landscape: left drawer, toolbar fully visible, Mapbox logo visible right of the drawer | PENDING |
| 7 | With a panel open, the crosshair sits in the middle of the visible map and the readout (in the form) describes that point — risk 5: Mapbox reports the padded center. If not, read the center with `getCoordinateFromView` at the crosshair | PENDING |
| 8 | POINT opens Add Point at the crosshair; the draft shows the amber dashed ring, `HOS-n · NEW` chip and, with a fix, the dashed range line and label | PENDING |
| 9 | Typing MGRS: the map moves only when the reference becomes valid; partial input never jumps | PENDING |
| 10 | Center / Me move the draft (Me eases the map); long-press moves the draft and keeps the form | PENDING |
| 11 | The keyboard never covers the focused field (sheet goes full while typing) | PENDING |
| 12 | Add: success haptic; the panel stays open; the name increments; repeated Adds are quick | PENDING |
| 13 | Tap a point: Edit Point opens prefilled; Save moves/renames it; Hidden on map hides it; Delete needs a second tap | PENDING |
| 14 | Rotate with Add Point open and a half-typed form: nothing typed is lost | PENDING |
| 15 | Accent chip and draft ring render crisply (no stretched corners) | PENDING |
```

In the spec, at the end of Section 11.2 add:

```markdown
- *Implementation note (Plan 3):* params schemas live in `src/features/menus/params.ts`, keyed by
  menu id, so the menu store can validate them without importing UI; `defineMenu` therefore takes
  `id, family, title, detents, component`.
```

and at the end of Section 8.6 add:

```markdown
- *Implementation note (Plan 3):* the selected (edited) item is `draft.itemId`; `PointsLayer`
  leaves it out while `DraftLayer` draws the edit. While a panel is open the readout card, zoom
  buttons and location banner are hidden; recenter stays.
```

- [ ] **Step 4: Commit**

```bash
git add .agents docs
git commit -m "docs: add menus and map-item-kinds skills and Plan 3 device checklist"
```

- [ ] **Step 5: Hand off to the user**

Ask the user to run the Plan 3 checklist on their dev build (`npx expo start --dev-client --clear`) and report each row; record results and apply fixes.
