# Units and Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename today's Add Point to Add Unit and add a separate Point feature (8 control-measure types) with its own menus, symbols, naming, Layers and mission counts.

**Architecture:** Units and points stay one stored item (`kind = 'point'`); `itemCategory(sidc)` decides unit vs point from the symbol code. Add/Edit menus become category-parameterized panels (`AddItemPanel`, `EditItemPanel`) composed from shared form sections, wired as `unit.add`/`unit.edit` and `point.add`/`point.edit`. The draft store carries the category and point type; one `draftSidc` derives the symbol.

**Tech Stack:** Expo SDK 57, React Native 0.86, WatermelonDB 0.28, @rnmapbox/maps 10, Zustand, zod, milsymbol 3 + @resvg/resvg-js (build script), Jest + RNTL 14.

**Spec:** `docs/superpowers/specs/2026-10-13-units-and-points-design.md`

## Global Constraints

- No schema change and no data migration; existing items are units.
- `itemCategory` (src/features/symbology/categories.ts) is the only place that decides unit vs point.
- Point SIDCs exactly as the spec table: CP `GFGPGPPK------X`, OP `GFGPDPO-------X`, LZ `GFGPAAL-------X`, SP `GFGPGPPS------X`, RP `GFGPGPPE------X`, RLY `GFGPGPPR------X`, LU `GFGPGPPL------X`, TRP `GFGPDPT-------X`.
- Point symbols: white lines, thin dark halo, same `SYMBOL_SIZE` as units; LZ is a custom white circle with "LZ".
- Toolbar order **UNIT · POINT · LAYERS**; UNIT icon `account-group-outline`, POINT icon `map-marker-outline`.
- Menu titles: "Add unit" / "Unit" / "Edit unit"; "Add point" / "Point" / "Edit point".
- Auto-names `<PREFIX>-<n>` per prefix per mission (CP, OP, LZ, SP, RP, RLY, LU, TRP; units FRD/HOS/NEU/UNK).
- Long-press with no Add open starts the last-used Add (`lastAddCategory`, not persisted; unit first).
- Repo rules: lint 0 problems (`npx expo lint`), `npx tsc --noEmit` clean, `npx jest` green; single quotes; never run prettier; Conventional Commits; **no Co-Authored-By or any trailer in commit messages**.
- Use the shared `TextField`; menus compose only `src/components/menu` primitives (menus skill).

## Review Focus

1. Items whose SIDC is null or unknown (older or corrupted data) must still draw and list as units with the default symbol — Task 1 (selectors/layer-rows tests).
2. Changing the point type on a draft whose name the user typed must keep that name; auto-names follow the type — Task 3 (draft store test).
3. Tapping UNIT then POINT (switching Add menus) must reset the draft to the new category and show the point symbol, with no leftover unit fields — Task 5 (MapScreen test).
4. Long-press while a point is open read-only starts a new Add of the last-used category rather than moving the viewed point — Task 6 (MapScreen test).
5. A mission with units but no points reads "2 units · 0 points" in the row and "Delete Op Iron and its 2 units and 0 points?" in the confirmation — Task 7 (MissionsScreen test).

---

### Task 1: Point types, categories and symbol images

**Files:**
- Create: `src/features/symbology/point-types.ts`, `src/features/symbology/point-types.test.ts`
- Create: `src/features/symbology/categories.ts`, `src/features/symbology/categories.test.ts`
- Modify: `src/theme/tokens.ts` (two tokens), `scripts/build-symbols.ts`, `src/features/symbology/symbol-images.test.ts`
- Modify: `src/features/map-items/selectors.ts`, `src/features/map-items/layer-rows.ts` (known-SIDC set), their tests
- Generated: `assets/symbols/*.png` (8 × 3 new), `src/features/symbology/symbol-images.generated.ts`

**Interfaces:**
- Produces:
  - `type PointType = 'checkpoint' | 'observation-post' | 'landing-zone' | 'start-point' | 'release-point' | 'rally-point' | 'linkup-point' | 'target-reference-point'`
  - `POINT_TYPES: readonly { id: PointType; label: string; prefix: string; sidc: string }[]`
  - `pointTypeForSidc(sidc: string | null): PointType | null`, `sidcForPointType(type: PointType): string`, `pointTypePrefix(type: PointType): string`, `POINT_SIDCS: readonly string[]`, `LANDING_ZONE_SIDC: string`
  - `type ItemCategory = 'unit' | 'point'`, `itemCategory(sidc: string | null): ItemCategory`, `KNOWN_SIDCS: ReadonlySet<string>` (unit presets ∪ point SIDCs), `typeLabel(sidc: string | null): string | null`

- [ ] **Step 1: Write the failing tests**

`src/features/symbology/point-types.test.ts`:

```ts
import { LANDING_ZONE_SIDC, POINT_SIDCS, POINT_TYPES, pointTypeForSidc, pointTypePrefix, sidcForPointType } from './point-types';

describe('point types', () => {
  it('has the 8 agreed types with their prefixes', () => {
    expect(POINT_TYPES.map((t) => [t.id, t.prefix])).toEqual([
      ['checkpoint', 'CP'],
      ['observation-post', 'OP'],
      ['landing-zone', 'LZ'],
      ['start-point', 'SP'],
      ['release-point', 'RP'],
      ['rally-point', 'RLY'],
      ['linkup-point', 'LU'],
      ['target-reference-point', 'TRP'],
    ]);
  });

  it('round-trips every type through its SIDC', () => {
    for (const t of POINT_TYPES) {
      expect(sidcForPointType(t.id)).toBe(t.sidc);
      expect(pointTypeForSidc(t.sidc)).toBe(t.id);
      expect(pointTypePrefix(t.id)).toBe(t.prefix);
    }
    expect(new Set(POINT_SIDCS).size).toBe(8);
    expect(LANDING_ZONE_SIDC).toBe('GFGPAAL-------X');
  });

  it('returns null for unit or unknown codes', () => {
    expect(pointTypeForSidc('SHGPUCI---------')).toBeNull();
    expect(pointTypeForSidc(null)).toBeNull();
    expect(pointTypeForSidc('nonsense')).toBeNull();
  });
});
```

`src/features/symbology/categories.test.ts`:

```ts
import { itemCategory, KNOWN_SIDCS, typeLabel } from './categories';
import { POINT_TYPES } from './point-types';
import { composeSidc, PRESET_SIDCS } from './presets';

describe('itemCategory', () => {
  it('is point for every point type and unit for everything else', () => {
    for (const t of POINT_TYPES) expect(itemCategory(t.sidc)).toBe('point');
    for (const sidc of PRESET_SIDCS) expect(itemCategory(sidc)).toBe('unit');
    expect(itemCategory(null)).toBe('unit');
    expect(itemCategory('garbage')).toBe('unit');
  });

  it('knows every unit preset and point SIDC', () => {
    expect(KNOWN_SIDCS.size).toBe(PRESET_SIDCS.length + POINT_TYPES.length);
  });

  it('labels the type of units and points', () => {
    expect(typeLabel('GFGPGPPK------X')).toBe('Checkpoint');
    expect(typeLabel(composeSidc('hostile', 'infantry'))).toBe('Infantry');
    expect(typeLabel(null)).toBeNull();
  });
});
```

In `src/features/symbology/symbol-images.test.ts` replace the test body:

```ts
import { KNOWN_SIDCS } from './categories';
import { SYMBOL_IMAGES } from './symbol-images.generated';

describe('generated symbol images', () => {
  it('has an image for every unit preset and point type', () => {
    expect(Object.keys(SYMBOL_IMAGES).sort()).toEqual([...KNOWN_SIDCS].sort());
  });
});
```

Add to `src/features/map-items/selectors.test.ts` (inside the existing `describe`; reuse its item factory, here called `item` — match the file's helper name):

```ts
  it('keeps point SIDCs and falls back to the default symbol for null or unknown codes', () => {
    const select = createPointFeatureSelector();
    const fc = select([
      item({ id: 'p', sidc: 'GFGPGPPK------X' }),
      item({ id: 'n', sidc: null }),
      item({ id: 'u', sidc: 'garbage' }),
    ]);
    expect(fc.features.map((f) => f.properties.sidc)).toEqual(['GFGPGPPK------X', DEFAULT_SIDC, DEFAULT_SIDC]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/symbology src/features/map-items/selectors.test.ts`
Expected: FAIL — cannot find module './point-types' / './categories'.

- [ ] **Step 3: Implement the modules**

`src/features/symbology/point-types.ts`:

```ts
/** Control-measure point types (2525C tactical points), in the order the type selector shows them. */
export type PointType =
  | 'checkpoint'
  | 'observation-post'
  | 'landing-zone'
  | 'start-point'
  | 'release-point'
  | 'rally-point'
  | 'linkup-point'
  | 'target-reference-point';

/** The app's landing-zone code: milsymbol has no LZ point, so scripts/build-symbols.ts draws it. */
export const LANDING_ZONE_SIDC = 'GFGPAAL-------X';

export const POINT_TYPES: readonly { id: PointType; label: string; prefix: string; sidc: string }[] = [
  { id: 'checkpoint', label: 'Checkpoint', prefix: 'CP', sidc: 'GFGPGPPK------X' },
  { id: 'observation-post', label: 'Observation post', prefix: 'OP', sidc: 'GFGPDPO-------X' },
  { id: 'landing-zone', label: 'Landing zone', prefix: 'LZ', sidc: LANDING_ZONE_SIDC },
  { id: 'start-point', label: 'Start point', prefix: 'SP', sidc: 'GFGPGPPS------X' },
  { id: 'release-point', label: 'Release point', prefix: 'RP', sidc: 'GFGPGPPE------X' },
  { id: 'rally-point', label: 'Rally point', prefix: 'RLY', sidc: 'GFGPGPPR------X' },
  { id: 'linkup-point', label: 'Linkup point', prefix: 'LU', sidc: 'GFGPGPPL------X' },
  { id: 'target-reference-point', label: 'Target reference point', prefix: 'TRP', sidc: 'GFGPDPT-------X' },
];

export const POINT_SIDCS: readonly string[] = POINT_TYPES.map((t) => t.sidc);

const BY_ID = new Map(POINT_TYPES.map((t) => [t.id, t]));
const BY_SIDC = new Map(POINT_TYPES.map((t) => [t.sidc, t]));

export function pointTypeForSidc(sidc: string | null): PointType | null {
  return (sidc && BY_SIDC.get(sidc)?.id) || null;
}

export function sidcForPointType(type: PointType): string {
  return BY_ID.get(type)!.sidc;
}

export function pointTypePrefix(type: PointType): string {
  return BY_ID.get(type)!.prefix;
}
```

`src/features/symbology/categories.ts`:

```ts
import { POINT_SIDCS, POINT_TYPES, pointTypeForSidc } from './point-types';
import { decomposeSidc, PRESET_SIDCS, UNIT_TYPES } from './presets';

/** Units carry an affiliation and unit type; points are control measures (checkpoint, LZ, …). */
export type ItemCategory = 'unit' | 'point';

/** The only place that decides unit vs point. Unknown, null and all pre-existing codes are units. */
export function itemCategory(sidc: string | null): ItemCategory {
  return pointTypeForSidc(sidc) ? 'point' : 'unit';
}

/** Every SIDC the app has an image for; anything else draws as DEFAULT_SIDC. */
export const KNOWN_SIDCS: ReadonlySet<string> = new Set([...PRESET_SIDCS, ...POINT_SIDCS]);

/** The type's display label ("Checkpoint", "Infantry"), or null when the code is unknown. */
export function typeLabel(sidc: string | null): string | null {
  const point = pointTypeForSidc(sidc);
  if (point) return POINT_TYPES.find((t) => t.id === point)!.label;
  const unit = sidc ? decomposeSidc(sidc) : null;
  return unit ? UNIT_TYPES.find((t) => t.id === unit.unitType)!.label : null;
}
```

In `src/features/map-items/selectors.ts` and `src/features/map-items/layer-rows.ts`, replace

```ts
import { DEFAULT_SIDC, PRESET_SIDCS } from '@/features/symbology/presets';
```
```ts
const KNOWN_SIDCS: ReadonlySet<string> = new Set(PRESET_SIDCS);
```

with

```ts
import { KNOWN_SIDCS } from '@/features/symbology/categories';
import { DEFAULT_SIDC } from '@/features/symbology/presets';
```

(delete the local `KNOWN_SIDCS` constant; the rest of each file is unchanged).

- [ ] **Step 4: Add tokens and render the point symbols**

In `src/theme/tokens.ts`, in the `dark` theme object after `'map-label-text': 'stone-50',` add:

```ts
  /** Control-measure point symbols (build-time only): white lines with a dark halo. */
  'point-symbol': 'stone-50',
  'point-symbol-halo': 'neutral-950',
```

In `scripts/build-symbols.ts`:
- import `POINT_TYPES, LANDING_ZONE_SIDC` from `'../src/features/symbology/point-types'`;
- after the existing unit loop, add:

```ts
const POINT_OUTLINE_PX = 2;

/** Landing zone: milsymbol has no LZ point, so draw it in the same white-on-halo style. */
function landingZoneSvg(): string {
  const size = SYMBOL_SIZE + 6;
  const c = size / 2;
  const r = SYMBOL_SIZE / 2 - 2;
  const stroke = (color: string, width: number) =>
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    stroke(colors['point-symbol-halo'], 2 + 2 * POINT_OUTLINE_PX) +
    stroke(colors['point-symbol'], 2) +
    `<text x="${c}" y="${c + 4.5}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="12" ` +
    `fill="${colors['point-symbol']}" stroke="${colors['point-symbol-halo']}" stroke-width="${2 * POINT_OUTLINE_PX}" paint-order="stroke">LZ</text>` +
    `</svg>`
  );
}

function writePng(sidc: string, svg: string) {
  for (const scale of [1, 2, 3]) {
    const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, font: { loadSystemFonts: true } }).render().asPng();
    const suffix = scale === 1 ? '' : `@${scale}x`;
    writeFileSync(join(OUT_DIR, `${sidc}${suffix}.png`), png);
  }
}

for (const type of POINT_TYPES) {
  const svg =
    type.sidc === LANDING_ZONE_SIDC
      ? landingZoneSvg()
      : new ms.Symbol(type.sidc, {
          size: SYMBOL_SIZE,
          monoColor: colors['point-symbol'],
          outlineColor: colors['point-symbol-halo'],
          outlineWidth: POINT_OUTLINE_PX,
        }).asSVG();
  writePng(type.sidc, svg);
}
```

- make the unit loop call `writePng(sidc, svg)` instead of its inline loop;
- generate the module from both lists:

```ts
const ALL_SIDCS = [...PRESET_SIDCS, ...POINT_TYPES.map((t) => t.sidc)];
const entries = ALL_SIDCS.map((sidc) => `  '${sidc}': require('../../../assets/symbols/${sidc}.png'),`).join('\n');
```

and log `ALL_SIDCS.length * 3`.

Run: `npm run build:symbols`
Expected: "Wrote 120 PNGs …" (32 × 3 + 8 × 3). Open `assets/symbols/GFGPGPPK------X@3x.png` and `assets/symbols/GFGPAAL-------X@3x.png` with the Read tool and check they are white symbols with a dark outline.

- [ ] **Step 5: Commands accept only known symbols (spec §4.4)**

Add to `src/features/map-items/map-items.test.ts`:

```ts
  it('accepts unit and point symbols and rejects unknown ones', async () => {
    const ctx = makeTestContext();
    expect((await placePoint(ctx, { missionId: 'm1', coord: at, sidc: 'GFGPGPPK------X', name: 'CP-1' })).ok).toBe(true);
    expect(await placePoint(ctx, { missionId: 'm1', coord: at, sidc: 'garbage', name: 'X' })).toMatchObject({ ok: false, error: 'invalid_symbol' });
    const r = await placePoint(ctx, { missionId: 'm1', coord: at, sidc: HOSTILE_INF, name: 'HOS-1' });
    if (!r.ok) throw new Error('setup');
    expect(await updateItem(ctx, r.value.id, { sidc: 'garbage' })).toMatchObject({ ok: false, error: 'invalid_symbol' });
  });
```

In `commands.ts` import `KNOWN_SIDCS` from `@/features/symbology/categories`; add `'invalid_symbol'` to both commands' error unions and, right after the coordinate checks:

```ts
  if (!KNOWN_SIDCS.has(input.sidc)) return err('invalid_symbol', `Unknown symbol ${input.sidc}`);
```

(in `updateItem`: `if (patch.sidc !== undefined && !KNOWN_SIDCS.has(patch.sidc)) return err('invalid_symbol', …)`). Run `grep -rn "sidc: '" src --include=*.test.*` style search (`grep -rn "sidc: '" src`) and change any test fixture using a code outside `KNOWN_SIDCS` to `'SHGPUCI--------'`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/features/symbology src/features/map-items && npx tsc --noEmit && npx expo lint`
Expected: PASS; 0 lint problems.

- [ ] **Step 7: Commit**

```bash
git add src/features/symbology src/features/map-items/commands.ts src/features/map-items/map-items.test.ts src/features/map-items/selectors.ts src/features/map-items/selectors.test.ts src/features/map-items/layer-rows.ts src/theme/tokens.ts scripts/build-symbols.ts assets/symbols
git commit -m "feat: point types, unit/point categories and point symbols"
```

---

### Task 2: Prefix-based auto-naming

**Files:**
- Modify: `src/features/map-items/naming.ts`, `src/features/map-items/naming.test.ts`, `src/features/map-items/repository.ts`

**Interfaces:**
- Consumes: `pointTypePrefix` (Task 1).
- Produces: `nextNameForPrefix(prefix: string, existingNames: readonly string[]): string`; `nextAutoName(affiliation, names)` unchanged (delegates); `suggestName(db: Database, missionId: string, prefix: string): Promise<string>` in repository; `suggestPointName` removed (callers move to `suggestName` in Task 4).

- [ ] **Step 1: Write the failing test** (append to `naming.test.ts`)

```ts
import { nextNameForPrefix } from './naming';

describe('nextNameForPrefix', () => {
  it('counts each point prefix separately', () => {
    const names = ['CP-1', 'CP-2', 'OP-1', 'HOS-7', 'LZ HAWK'];
    expect(nextNameForPrefix('CP', names)).toBe('CP-3');
    expect(nextNameForPrefix('OP', names)).toBe('OP-2');
    expect(nextNameForPrefix('LZ', names)).toBe('LZ-1');
    expect(nextNameForPrefix('RLY', ['rly-4'])).toBe('RLY-5');
  });
});
```

(Merge the import into the file's existing import line.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/map-items/naming.test.ts` — Expected: FAIL, `nextNameForPrefix` is not a function.

- [ ] **Step 3: Implement**

`naming.ts` becomes:

```ts
import type { Affiliation } from '@/features/symbology/presets';

export const NAME_PREFIX = { friend: 'FRD', hostile: 'HOS', neutral: 'NEU', unknown: 'UNK' } as const satisfies Record<
  Affiliation,
  string
>;

/** `<PREFIX>-<n>` where n is one more than the highest existing number for that prefix. */
export function nextNameForPrefix(prefix: string, existingNames: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let max = 0;
  for (const name of existingNames) {
    const m = pattern.exec(name.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${max + 1}`;
}

export function nextAutoName(affiliation: Affiliation, existingNames: readonly string[]): string {
  return nextNameForPrefix(NAME_PREFIX[affiliation], existingNames);
}
```

In `repository.ts` replace `suggestPointName` with:

```ts
export async function suggestName(db: Database, missionId: string, prefix: string): Promise<string> {
  return nextNameForPrefix(prefix, await getMissionItemNames(db, missionId));
}
```

(import `nextNameForPrefix` instead of `nextAutoName`; drop the `Affiliation` import if unused). `PointForm.tsx` still calls `suggestPointName` until Task 4 — in this task change that one call to `suggestName(ctx.db, missionId, NAME_PREFIX[affiliation])` (import `NAME_PREFIX` from `'../naming'`) so the build stays green.

- [ ] **Step 4: Verify** — `npx jest src/features/map-items && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "refactor: auto-name by prefix so point types can count separately"`

---

### Task 3: Draft category, point type and draftSidc

**Files:**
- Modify: `src/stores/draft.ts`, `src/stores/draft.test.ts`
- Create: `src/features/map-items/draft-sidc.ts`, `src/features/map-items/draft-sidc.test.ts`
- Modify: `src/features/map/layers/DraftLayer.tsx`, `src/features/map/layers/DraftLayer.test.tsx`
- Modify callers of `startAdd`/`startEdit` (`AddPointMenu.tsx`, `EditPointMenu.tsx`) to pass `category: 'unit'` (and `pointType: 'checkpoint'` for startEdit) so the build stays green.

**Interfaces:**
- Consumes: `ItemCategory` (Task 1), `PointType`, `sidcForPointType`.
- Produces (draft store):
  - values: `category: ItemCategory`, `pointType: PointType`, `remembered: { affiliation; unitType; pointType }`, `lastAddCategory: ItemCategory`
  - `startAdd({ coord, source, category })` — sets category, `pointType = remembered.pointType`, `lastAddCategory = category`
  - `startEdit({ itemId, coord, category, affiliation, unitType, pointType, name, notes })`
  - `setPointType(pointType)` — clears an auto-name (like `setAffiliation`), remembers it in add mode
  - `clear()` keeps `remembered` and `lastAddCategory`
- Produces: `draftSidc(d: { category; affiliation; unitType; pointType }): string`

- [ ] **Step 1: Write the failing tests**

Append to `src/stores/draft.test.ts`:

```ts
describe('categories', () => {
  beforeEach(() => useDraft.setState(INITIAL_DRAFT));

  it('starts a point add with the remembered type and records the last Add', () => {
    useDraft.getState().startAdd({ coord: AT, source: 'crosshair', category: 'point' });
    expect(useDraft.getState()).toMatchObject({ category: 'point', pointType: 'checkpoint', lastAddCategory: 'point' });
    useDraft.getState().setPointType('landing-zone');
    useDraft.getState().clear();
    expect(useDraft.getState().lastAddCategory).toBe('point');
    useDraft.getState().startAdd({ coord: AT, source: 'crosshair', category: 'point' });
    expect(useDraft.getState().pointType).toBe('landing-zone');
  });

  it('renames an auto-named draft on type change but keeps a typed name', () => {
    useDraft.getState().startAdd({ coord: AT, source: 'crosshair', category: 'point' });
    useDraft.getState().setAutoName('CP-1');
    useDraft.getState().setPointType('observation-post');
    expect(useDraft.getState().name).toBe('');
    useDraft.getState().setName('OP NORTH');
    useDraft.getState().setPointType('rally-point');
    expect(useDraft.getState().name).toBe('OP NORTH');
  });

  it('does not remember a point type changed while editing', () => {
    useDraft.getState().startEdit({ itemId: 'a', coord: AT, category: 'point', affiliation: 'unknown', unitType: 'unspecified', pointType: 'checkpoint', name: 'CP-1', notes: '' });
    useDraft.getState().setLocked(false);
    useDraft.getState().setPointType('start-point');
    expect(useDraft.getState().remembered.pointType).toBe('checkpoint');
  });
});
```

(`AT` = the file's existing coordinate constant; if it has none, add `const AT = { lat: 38.8977, lon: -77.0365 };`.)

`src/features/map-items/draft-sidc.test.ts`:

```ts
import { composeSidc } from '@/features/symbology/presets';

import { draftSidc } from './draft-sidc';

describe('draftSidc', () => {
  it('composes units from affiliation and type, and points from the point type', () => {
    expect(draftSidc({ category: 'unit', affiliation: 'hostile', unitType: 'armor', pointType: 'checkpoint' })).toBe(composeSidc('hostile', 'armor'));
    expect(draftSidc({ category: 'point', affiliation: 'hostile', unitType: 'armor', pointType: 'landing-zone' })).toBe('GFGPAAL-------X');
  });
});
```

Add to `DraftLayer.test.tsx` (follow its existing render helper and `mapboxMock()` access to the `draft` ShapeSource shape):

```ts
  it('draws the point type symbol and follows type changes', async () => {
    await act(async () => {
      useDraft.getState().startAdd({ coord: AT, source: 'crosshair', category: 'point' });
      useDraft.getState().setAutoName('CP-1');
    });
    await renderLayer();
    const sidc = () => (mapboxMock().__props.ShapeSource.draft.shape as { features: { properties: { sidc?: string } }[] }).features[0].properties.sidc;
    expect(sidc()).toBe('GFGPGPPK------X');
    await act(async () => useDraft.getState().setPointType('observation-post'));
    expect(sidc()).toBe('GFGPDPO-------X');
  });
```

(`renderLayer`/`AT` = the file's existing helper/constant names; adapt to what the file defines.)

- [ ] **Step 2: Run to verify failure** — `npx jest src/stores/draft.test.ts src/features/map-items/draft-sidc.test.ts src/features/map/layers/DraftLayer.test.tsx` → FAIL (unknown `category`, missing module).

- [ ] **Step 3: Implement**

`src/stores/draft.ts` changes:

```ts
import type { ItemCategory } from '@/features/symbology/categories';
import type { PointType } from '@/features/symbology/point-types';
```

In `DraftValues` add:

```ts
  /** Unit (affiliation + unit type) or point (control-measure type). */
  category: ItemCategory;
  pointType: PointType;
  /** The most recent Add opened (long-press starts it again). Not persisted. */
  lastAddCategory: ItemCategory;
```

and change `remembered` to `{ affiliation: Affiliation; unitType: UnitType; pointType: PointType }`.

Actions: `startAdd: (start: { coord: LatLon | null; source: DraftCoordSource; category: ItemCategory }) => void;`, `startEdit` input gains `category: ItemCategory; pointType: PointType;`, add `setPointType: (pointType: PointType) => void;`.

`INITIAL_DRAFT` adds `category: 'unit', pointType: 'checkpoint', lastAddCategory: 'unit'` and `remembered: { affiliation: 'hostile', unitType: 'unspecified', pointType: 'checkpoint' }`.

```ts
  startAdd: ({ coord, source, category }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: category,
      category,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      pointType: s.remembered.pointType,
      mode: 'add',
      coord: isValid(coord) ? coord : null,
      coordSource: source,
      coordRev: s.coordRev + 1,
    })),
  startEdit: ({ itemId, coord, category, affiliation, unitType, pointType, name, notes }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: s.lastAddCategory,
      mode: 'edit',
      itemId,
      category,
      coord: isValid(coord) ? coord : null,
      coordSource: 'item',
      coordRev: s.coordRev + 1,
      affiliation,
      unitType,
      pointType,
      name,
      nameEdited: true,
      notes,
      locked: true,
    })),
  setPointType: (pointType) =>
    set((s) => ({
      pointType,
      name: s.nameEdited ? s.name : '',
      remembered: s.mode === 'add' ? { ...s.remembered, pointType } : s.remembered,
    })),
```

`clear` adds `lastAddCategory: s.lastAddCategory,` and `pointType: s.remembered.pointType,`.

`src/features/map-items/draft-sidc.ts`:

```ts
import type { ItemCategory } from '@/features/symbology/categories';
import { sidcForPointType, type PointType } from '@/features/symbology/point-types';
import { composeSidc, type Affiliation, type UnitType } from '@/features/symbology/presets';

/** The symbol a draft stands for: affiliation + unit type for units, the point type for points. */
export function draftSidc(d: { category: ItemCategory; affiliation: Affiliation; unitType: UnitType; pointType: PointType }): string {
  return d.category === 'point' ? sidcForPointType(d.pointType) : composeSidc(d.affiliation, d.unitType);
}
```

`DraftLayer.tsx`: select `category` and `pointType` from the draft, replace `sidc: composeSidc(affiliation, unitType)` with `sidc: draftSidc({ category, affiliation, unitType, pointType })`, add both to the `useMemo` deps, swap the `composeSidc` import for `import { draftSidc } from '@/features/map-items/draft-sidc';`.

Callers: in `AddPointMenu.tsx` `startAdd({ coord: at, source: …, category: 'unit' })`; in `EditPointMenu.tsx` `selectItem` passes `category: 'unit', pointType: 'checkpoint'`. Update every other `startAdd(`/`startEdit(` in tests (`grep -rn "startAdd(\|startEdit(" src`) to include `category: 'unit'` (and `pointType: 'checkpoint'` for startEdit).

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: draft carries unit/point category and point type"`

---

### Task 4: Unit menus via shared item panels and form sections

Rename today's point menus to unit menus and restructure them so Task 5 only adds the point form.

**Files:**
- Create: `src/features/map-items/menus/item-menus.ts` (copy + helpers), `src/features/map-items/menus/AddItemPanel.tsx`, `src/features/map-items/menus/EditItemPanel.tsx`
- Create: `src/features/map-items/menus/form/LocationSection.tsx`, `src/features/map-items/menus/form/use-auto-name.ts`
- Create (rename): `UnitForm.tsx` (from `PointForm.tsx`), `AddUnitMenu.tsx` (from `AddPointMenu.tsx`), `EditUnitMenu.tsx` (from `EditPointMenu.tsx`), tests `AddUnitMenu.test.tsx`, `AddUnitMenu.failure.test.tsx`, `EditUnitMenu.test.tsx` (git mv from the point tests)
- Modify: `src/features/menus/params.ts`, `src/features/menus/registry.ts`, `src/stores/menu.test.ts`, `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`, `src/features/map-items/menus/LayersMenu.tsx`, `LayersMenu.test.tsx`

**Interfaces:**
- Consumes: `draftSidc`, draft `category`, `suggestName`, `NAME_PREFIX`, `itemCategory`, `pointTypeForSidc`.
- Produces:
  - Menu ids `unit.add` `{ at?: LatLon }`, `unit.edit` `{ itemId }` (and, for Task 5, the existing ids `point.add`/`point.edit` are freed — this task removes them from `MENU_PARAMS`; Task 5 re-adds them).
  - `ITEM_COPY: Record<ItemCategory, { noun: string; title: string }>` = `{ unit: { noun: 'unit', title: 'Unit' }, point: { noun: 'point', title: 'Point' } }`
  - `openItemMenu(itemId: string, sidc: string | null): void` — opens `unit.edit` or `point.edit` by `itemCategory` (until Task 5 lands, always `unit.edit`).
  - `AddItemPanel({ category, at, missionId, form }: { category: ItemCategory; at?: LatLon; missionId: string; form: ReactNode })`
  - `EditItemPanel({ category, itemId, missionId, form }: { category: ItemCategory; itemId: string; missionId: string; form: ReactNode })`
  - `LocationSection()` — MGRS fields, Center, Map, pick hint (moved verbatim from `PointForm`)
  - `useAutoName(missionId: string, mode: DraftMode, prefix: string): void`

- [ ] **Step 1: Move files and rename ids (tests first)**

```bash
git mv src/features/map-items/menus/PointForm.tsx src/features/map-items/menus/UnitForm.tsx
git mv src/features/map-items/menus/AddPointMenu.tsx src/features/map-items/menus/AddUnitMenu.tsx
git mv src/features/map-items/menus/EditPointMenu.tsx src/features/map-items/menus/EditUnitMenu.tsx
git mv src/features/map-items/menus/AddPointMenu.test.tsx src/features/map-items/menus/AddUnitMenu.test.tsx
git mv src/features/map-items/menus/AddPointMenu.failure.test.tsx src/features/map-items/menus/AddUnitMenu.failure.test.tsx
git mv src/features/map-items/menus/EditPointMenu.test.tsx src/features/map-items/menus/EditUnitMenu.test.tsx
```

In the three moved tests and `MapScreen.test.tsx`, `LayersMenu.test.tsx`, `src/stores/menu.test.ts`:
- `'point.add'` → `'unit.add'`, `'point.edit'` → `'unit.edit'`;
- `AddPointMenu` → `AddUnitMenu`, `EditPointMenu` → `EditUnitMenu`;
- titles: `'Add point'` → `'Add unit'`, header `'Point'` → `'Unit'`, `'Edit point'` → `'Edit unit'`, `'Delete point'` → `'Delete unit'`;
- messages: `'That point no longer exists.'` → `'That unit no longer exists.'`, `'Could not add the point.'` → `'Could not add the unit.'`, `'Could not save the point.'` → `'Could not save the unit.'`.

Add to `EditUnitMenu.test.tsx`:

```ts
  it('opens a point in the point menu instead', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: 'GFGPGPPK------X', name: 'CP-1' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('unit.edit', { itemId: r.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'point.edit', params: { itemId: r.value.id } }]));
  });
```

Mark this one test `it.skip` with the comment `// enabled in Task 5 (point.edit exists then)`; Task 5 Step 1 removes the `.skip`.

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/map-items src/features/map src/stores` → FAIL (unknown menu id `unit.add`, missing modules).

- [ ] **Step 3: Params and registry**

`params.ts`: replace the two point entries with

```ts
  'unit.add': z.object({ at: latLon.optional() }),
  'unit.edit': z.object({ itemId: z.string().min(1) }),
```

`registry.ts`: import `addUnitMenu` from `AddUnitMenu` and `editUnitMenu` from `EditUnitMenu`; register `'unit.add': addUnitMenu, 'unit.edit': editUnitMenu` (keys sorted: `app.root`, `layers`, `settings`, `unit.add`, `unit.edit`).

- [ ] **Step 4: Shared helpers**

`src/features/map-items/menus/item-menus.ts`:

```ts
import { itemCategory, type ItemCategory } from '@/features/symbology/categories';
import { useMenu } from '@/stores/menu';

/** Words the shared item menus use per category. */
export const ITEM_COPY: Record<ItemCategory, { noun: string; title: string }> = {
  unit: { noun: 'unit', title: 'Unit' },
  point: { noun: 'point', title: 'Point' },
};

/** Open the right view for a map item (tap on the map or a Layers row). */
export function openItemMenu(itemId: string, sidc: string | null): void {
  if (itemCategory(sidc) === 'point') useMenu.getState().openMenu('point.edit', { itemId });
  else useMenu.getState().openMenu('unit.edit', { itemId });
}
```

Until Task 5 re-adds `point.edit`, write the point branch as `useMenu.getState().openMenu('unit.edit', { itemId })` with the comment `// Task 5: 'point.edit'` so it compiles; Task 5 Step 3 restores the line above.

`src/features/map-items/menus/form/use-auto-name.ts` (the auto-name effect moved out of `PointForm`, keyed by prefix):

```ts
import { useEffect } from 'react';

import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft, type DraftMode } from '@/stores/draft';

import { suggestName } from '../../repository';

/** In add mode, fills an empty, untyped name with the next `<prefix>-n` for the mission. */
export function useAutoName(missionId: string, mode: DraftMode, prefix: string): void {
  const ctx = useCommandContext();
  const needsName = useDraft((s) => mode === 'add' && !s.nameEdited && s.name === '');
  useEffect(() => {
    if (!needsName) return;
    let live = true;
    void suggestName(ctx.db, missionId, prefix).then((suggestion) => {
      // The prefix may have changed (type/affiliation switched) while the query ran.
      if (live && suggestion.startsWith(`${prefix}-`)) useDraft.getState().setAutoName(suggestion);
    });
    return () => {
      live = false;
    };
  }, [needsName, prefix, ctx, missionId]);
}
```

`src/features/map-items/menus/form/LocationSection.tsx`: move from `UnitForm` (the former `PointForm`) everything that renders the `MGRS · Zone / 100K / Easting / Northing` section — the `parts` state, the two effects, `onPartsChange`, `validDetail`, `toCrosshair`, Center and Map buttons and the pick hint — into

```tsx
export function LocationSection() { /* the moved code, returning the <MenuSection label="MGRS · Zone / 100K / Easting / Northing"> … </MenuSection> */ }
```

with the same imports it used. No behavior change.

`UnitForm.tsx` becomes:

```tsx
export function UnitForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const affiliation = useDraft((s) => s.affiliation);
  const unitType = useDraft((s) => s.unitType);
  const name = useDraft((s) => s.name);
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);
  const setAffiliation = useDraft((s) => s.setAffiliation);
  const setUnitType = useDraft((s) => s.setUnitType);
  const setName = useDraft((s) => s.setName);
  const setNotes = useDraft((s) => s.setNotes);
  const [showNotes, setShowNotes] = useState(notes !== '');
  useAutoName(missionId, mode, NAME_PREFIX[affiliation]);

  return (
    <View>
      <LocationSection />
      {/* Affiliation, Name, Unit type + Notes sections exactly as before */}
    </View>
  );
}
```

(Keep the existing Affiliation / Name / Unit type / Notes JSX unchanged.)

- [ ] **Step 5: Category panels**

`AddItemPanel.tsx` — the body of today's `AddPointMenu`, parameterized:

```tsx
export function AddItemPanel({ category, at, missionId, form }: { category: ItemCategory; at?: LatLon; missionId: string; form: ReactNode }) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  const coord = useDraft((s) => s.coord);
  const name = useDraft((s) => s.name);
  const coordInputValid = useDraft((s) => s.coordInputValid);
  const busy = useRef(false);
  const { noun } = ITEM_COPY[category];

  useEffect(() => {
    const start = at ?? useInteraction.getState().cameraCenter;
    useDraft.getState().startAdd({ coord: start, source: at ? 'press' : 'crosshair', category });
    return () => useDraft.getState().clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAdd = coord !== null && coordInputValid && name.trim() !== '';

  const add = async () => {
    if (busy.current || !canAdd) return;
    busy.current = true;
    const d = useDraft.getState();
    const result = await placePoint(ctx, { missionId, coord: d.coord!, sidc: draftSidc(d), name: d.name, notes: d.notes.trim() || null });
    if (!result.ok) {
      busy.current = false;
      notifyError(result.error === 'invalid_name' ? 'Enter a name.' : `Could not add the ${noun}.`);
      return;
    }
    notifySuccess();
    if (useDraft.getState().mode === 'add') openItemMenu(result.value.id, draftSidc(d));
  };

  return (
    <View>
      <MenuHeader
        title={`Add ${noun}`}
        leading={{ label: 'Cancel', onPress: close }}
        trailing={{ label: 'Add', icon: 'check', onPress: () => void add(), disabled: !canAdd }}
      />
      {form}
    </View>
  );
}
```

`AddUnitMenu.tsx`:

```tsx
export function AddUnitMenu({ params, missionId }: MenuComponentProps<'unit.add'>) {
  return <AddItemPanel category="unit" at={params.at} missionId={missionId} form={<UnitForm missionId={missionId} mode="add" />} />;
}

export const addUnitMenu = defineMenu({ id: 'unit.add', family: 'action', title: 'Add unit', detents: ['peek', 'half', 'full'], component: AddUnitMenu });
```

`EditItemPanel.tsx` — the body of today's `EditPointMenu` with these changes:
- props `{ category, itemId, missionId, form }`; `params.itemId` → `itemId`;
- `const { noun, title } = ITEM_COPY[category]; const GONE = \`That ${noun} no longer exists.\`;`
- `selectItem(item)` builds the draft from the item's category:

```ts
function selectItem(item: MapItemSnapshot): boolean {
  const at = pointCoord(item.geometry);
  if (!at) return false;
  const unit = (item.sidc ? decomposeSidc(item.sidc) : null) ?? { affiliation: 'unknown' as const, unitType: 'unspecified' as const };
  useDraft.getState().startEdit({
    itemId: item.id,
    coord: at,
    category: itemCategory(item.sidc),
    affiliation: unit.affiliation,
    unitType: unit.unitType,
    pointType: pointTypeForSidc(item.sidc) ?? 'checkpoint',
    name: item.name,
    notes: item.notes ?? '',
  });
  return true;
}
```

- in the load effect, after the missing/unreadable check and before `selectItem`, redirect the wrong category:

```ts
    if (itemCategory(item.sidc) !== category) {
      leaving.current = true;
      openItemMenu(item.id, item.sidc);
      return;
    }
```

- save uses `sidc: draftSidc(d)`; messages use `noun` (`Could not save the ${noun}.`, `Could not delete the ${noun}.`);
- headers: locked `title={title}`, editing `title={\`Edit ${noun}\`}`; destructive label `\`Delete ${noun}\``;
- render `{form}` where `<PointForm …/>` was.

`EditUnitMenu.tsx`:

```tsx
export function EditUnitMenu({ params, missionId }: MenuComponentProps<'unit.edit'>) {
  return <EditItemPanel category="unit" itemId={params.itemId} missionId={missionId} form={<UnitForm missionId={missionId} mode="edit" />} />;
}

export const editUnitMenu = defineMenu({ id: 'unit.edit', family: 'action', title: 'Edit unit', detents: ['peek', 'half', 'full'], component: EditUnitMenu });
```

- [ ] **Step 6: Callers**

`MissionMap.tsx`: `togglePoint` → `toggleUnit` using `'unit.add'`; `onItemPress` uses `openItemMenu(itemId, sidc)` (PointsLayer change is Task 6 — for now call `useMenu.getState().openMenu('unit.edit', { itemId })`); `onLongPress` uses `'unit.add'`/`'unit.edit'`; `activeTool={topId === 'unit.add' ? 'point' : …}` (toolbar rename is Task 6). `LayersMenu.tsx` row tap: `openItemMenu(row.id, row.sidc)`.

- [ ] **Step 7: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS (one skipped test).

- [ ] **Step 8: Commit** — `git add -A && git commit -m "refactor: rename Add/Edit Point to Unit on shared item panels"`

---

### Task 5: Point form and point menus

**Files:**
- Modify: `src/components/menu/MenuSelect.tsx` (+ `inputs.test.tsx`): optional option icon
- Create: `src/features/map-items/menus/PointForm.tsx`, `AddPointMenu.tsx`, `EditPointMenu.tsx`, `AddPointMenu.test.tsx`, `EditPointMenu.test.tsx`
- Modify: `src/features/menus/params.ts`, `src/features/menus/registry.ts`, `item-menus.ts` (restore point branch), `EditUnitMenu.test.tsx` (un-skip)

**Interfaces:**
- Consumes: `AddItemPanel`, `EditItemPanel`, `LocationSection`, `useAutoName`, `POINT_TYPES`, `pointTypePrefix`, `SYMBOL_IMAGES`, draft `pointType`/`setPointType`.
- Produces: menu ids `point.add` `{ at?: LatLon }`, `point.edit` `{ itemId }`; `MenuSelect` option type `{ value; label; icon?: ReactNode }`.

- [ ] **Step 1: Write the failing tests**

`inputs.test.tsx` (add):

```tsx
  it('MenuSelect shows option icons in the list and the selected value', async () => {
    await renderWithProviders(
      <MenuSelect label="Type" options={[{ value: 'a', label: 'Alpha', icon: <Text>ICON-A</Text> }, { value: 'b', label: 'Bravo' }]} value="a" onChange={jest.fn()} />,
    );
    expect(screen.getByText('ICON-A')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Type: Alpha'));
    expect(screen.getAllByText('ICON-A')).toHaveLength(2);
  });
```

`AddPointMenu.test.tsx` (mirror the setup of `AddUnitMenu.test.tsx`: same `beforeEach`, `CENTER`, `items` helper, `open()` rendering `<AddPointMenu params={{}} missionId="m1" />` and awaiting `findByDisplayValue('CP-1')`; in `beforeEach` open `'point.add'`):

```tsx
describe('AddPointMenu', () => {
  it('starts at the crosshair as a checkpoint named CP-1, with no affiliation or unit type', async () => {
    await open();
    expect(screen.getByRole('header')).toHaveTextContent('Add point');
    expect(screen.getByLabelText('Point type: Checkpoint')).toBeTruthy();
    expect(screen.queryByLabelText('Hostile')).toBeNull();
    expect(screen.queryByLabelText(/^Unit type/)).toBeNull();
    expect(useDraft.getState()).toMatchObject({ mode: 'add', category: 'point', coord: CENTER });
  });

  it('renames with the type and adds the point, then shows it selected', async () => {
    const ctx = await open();
    await fireEvent.press(screen.getByLabelText('Point type: Checkpoint'));
    await fireEvent.press(screen.getByText('Landing zone'));
    expect(await screen.findByDisplayValue('LZ-1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Notes'));
    await fireEvent.changeText(screen.getAllByLabelText('Notes').at(-1)!, 'cold LZ');
    await fireEvent.press(screen.getByLabelText('Add'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    const [item] = await items(ctx);
    expect(item).toMatchObject({ name: 'LZ-1', sidc: 'GFGPAAL-------X', notes: 'cold LZ' });
    expect(useMenu.getState().stack).toEqual([{ id: 'point.edit', params: { itemId: item.id } }]);
  });

  it('numbers each type separately', async () => {
    const ctx = makeTestContext();
    await placePoint(ctx, { missionId: 'm1', coord: CENTER, sidc: 'GFGPGPPK------X', name: 'CP-1' });
    await placePoint(ctx, { missionId: 'm1', coord: CENTER, sidc: composeSidc('hostile', 'infantry'), name: 'HOS-1' });
    await renderWithProviders(<AddPointMenu params={{}} missionId="m1" />, ctx);
    expect(await screen.findByDisplayValue('CP-2')).toBeTruthy();
  });
});
```

`EditPointMenu.test.tsx` (mirror `EditUnitMenu.test.tsx`'s `openEditor` with `placePoint(ctx, { …, sidc: 'GFGPDPO-------X', name: 'OP-1', notes: 'ridge' })` and `openMenu('point.edit', …)`):

```tsx
describe('EditPointMenu', () => {
  it('opens read-only as Point, then edits type and name and saves', async () => {
    const { ctx, id } = await openEditor();
    expect(screen.getByRole('header')).toHaveTextContent('Point');
    expect(screen.getByLabelText('Point type: Observation post')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(screen.getByRole('header')).toHaveTextContent('Edit point');
    await fireEvent.press(screen.getByLabelText('Point type: Observation post'));
    await fireEvent.press(screen.getByText('Rally point'));
    expect(screen.getByDisplayValue('OP-1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByRole('header')).toHaveTextContent('Point'));
    expect((await findItem(ctx.db, id))?.sidc).toBe('GFGPGPPR------X');
  });

  it('deletes after a second tap', async () => {
    const { ctx, id } = await openEditor();
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.press(screen.getByText('Delete point'));
    await fireEvent.press(screen.getByText('Tap again to delete'));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([]));
    expect(await findItem(ctx.db, id)).toBeNull();
  });

  it('opens a unit in the unit menu instead', async () => {
    const ctx = makeTestContext();
    const r = await placePoint(ctx, { missionId: 'm1', coord: AT, sidc: composeSidc('friend', 'armor'), name: 'FRD-1' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('point.edit', { itemId: r.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'unit.edit', params: { itemId: r.value.id } }]));
  });
});
```

Remove the `.skip` added in Task 4 from `EditUnitMenu.test.tsx`.

- [ ] **Step 2: Run to verify failure** — `npx jest src/components/menu src/features/map-items/menus` → FAIL.

- [ ] **Step 3: Implement**

`MenuSelect.tsx`: `type Option<T extends string> = { value: T; label: string; icon?: ReactNode };` (import `type ReactNode` from react). In the trigger, render the current option's icon before the label:

```tsx
const currentOption = options.find((o) => o.value === value);
const current = currentOption?.label ?? '';
…
<View className="shrink flex-row items-center gap-2">
  {currentOption?.icon ?? null}
  <Text numberOfLines={1} className="shrink text-lg text-text">{current}</Text>
</View>
```

and in each list row:

```tsx
<View className="flex-row items-center gap-2">
  {option.icon ?? null}
  <Text className="text-base text-text">{option.label}</Text>
</View>
```

`params.ts`: add back

```ts
  'point.add': z.object({ at: latLon.optional() }),
  'point.edit': z.object({ itemId: z.string().min(1) }),
```

`item-menus.ts`: restore `useMenu.getState().openMenu('point.edit', { itemId })` in the point branch.

`PointForm.tsx`:

```tsx
import { useState } from 'react';
import { Image, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { TextField } from '@/components/ui/TextField';
import { POINT_TYPES, pointTypePrefix, type PointType } from '@/features/symbology/point-types';
import { SYMBOL_IMAGES } from '@/features/symbology/symbol-images.generated';
import { useDraft, type DraftMode } from '@/stores/draft';

import { LocationSection } from './form/LocationSection';
import { useAutoName } from './form/use-auto-name';

const TYPE_OPTIONS = POINT_TYPES.map((t) => ({
  value: t.id,
  label: t.label,
  icon: <Image source={SYMBOL_IMAGES[t.sidc]} style={{ width: 28, height: 22 }} resizeMode="contain" />,
}));

/** Add/Edit point form: location, point type, name, notes. Edits only the draft store. */
export function PointForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const pointType = useDraft((s) => s.pointType);
  const name = useDraft((s) => s.name);
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);
  const setPointType = useDraft((s) => s.setPointType);
  const setName = useDraft((s) => s.setName);
  const setNotes = useDraft((s) => s.setNotes);
  const [showNotes, setShowNotes] = useState(notes !== '');
  useAutoName(missionId, mode, pointTypePrefix(pointType));

  return (
    <View>
      <LocationSection />
      <MenuSection label="Point type">
        <View className="flex-row items-start gap-2">
          <MenuSelect<PointType> label="Point type" options={TYPE_OPTIONS} value={pointType} onChange={setPointType} disabled={locked} />
          <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        </View>
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Notes" /> : null}
      </MenuSection>
      <MenuSection label="Name">
        <TextField mono editable={!locked} accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
    </View>
  );
}
```

(Order follows the unit form's pattern of type-with-Notes; the spec lists Location, Type, Name, Notes as the field set.)

`AddPointMenu.tsx` / `EditPointMenu.tsx`: same shape as the unit files with `category="point"`, `<PointForm …/>`, ids `point.add` / `point.edit`, titles `'Add point'` / `'Edit point'`. Register both in `registry.ts` (keys sorted: `app.root`, `layers`, `point.add`, `point.edit`, `settings`, `unit.add`, `unit.edit`).

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS, no skipped tests.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: Add/Edit Point menus for control-measure points"`

---

### Task 6: Toolbar, map routing and long-press

**Files:**
- Modify: `src/features/toolbar/Toolbar.tsx`, `Toolbar.test.tsx`, `src/features/map/layers/PointsLayer.tsx`, `PointsLayer.test.tsx`, `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: `openItemMenu`, draft `lastAddCategory`.
- Produces: `ToolId = 'unit' | 'point' | 'layers'`; Toolbar props `onUnit`, `onPoint`, `onLayers`; `PointsLayer` `onItemPress(id: string, at: LatLon, sidc: string | null)`.

- [ ] **Step 1: Write the failing tests**

`Toolbar.test.tsx` (add):

```tsx
  it('orders UNIT, POINT, LAYERS and marks the active one', async () => {
    const onUnit = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="unit" onUnit={onUnit} onPoint={jest.fn()} onLayers={jest.fn()} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(labels.filter((l: string) => ['UNIT', 'POINT', 'LAYERS'].includes(l))).toEqual(['UNIT', 'POINT', 'LAYERS']);
    expect(screen.getByLabelText('UNIT')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('UNIT'));
    expect(onUnit).toHaveBeenCalled();
  });
```

`MapScreen.test.tsx` (add; reuse the file's mission setup and long-press helper pattern):

```tsx
  it('UNIT and POINT open their Add menus, and switching resets the draft to the new category', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await fireEvent.press(await screen.findByLabelText('UNIT'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add unit');
    await fireEvent.press(screen.getByLabelText('POINT'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add point');
    expect(screen.getByLabelText('POINT')).toBeSelected();
    expect(useDraft.getState()).toMatchObject({ mode: 'add', category: 'point' });
    expect(screen.queryByLabelText('Hostile')).toBeNull();
  });

  it('tapping a point opens Point; long-press while viewing starts the last-used Add', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const p = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'GFGPGPPK------X', name: 'CP-1' });
    if (!p.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await screen.findByTestId('map-view');
    await fireEvent.press(screen.getByLabelText('POINT'));
    await fireEvent.press(screen.getByText('Cancel'));
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({ features: [{ properties: { id: p.value.id, sidc: 'GFGPGPPK------X' } }], coordinates: { latitude: 38.9, longitude: -77 }, point: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Point');
    await act(async () =>
      (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.1, 38.95] }, properties: {} }),
    );
    expect(await screen.findByRole('header')).toHaveTextContent('Add point');
    expect(useDraft.getState().coord).toEqual({ lat: 38.95, lon: -77.1 });
  });
```

Update the existing "toggles Add Point from the toolbar" test to press `'UNIT'` and expect `'Add unit'`, and every other `'POINT'` press in the file that meant units to `'UNIT'`.

`PointsLayer.test.tsx`: the existing press test now expects `onItemPress` to be called with `(id, at, sidc)` where `sidc` comes from `e.features[0].properties.sidc`.

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/toolbar src/features/map` → FAIL.

- [ ] **Step 3: Implement**

`Toolbar.tsx`: `export type ToolId = 'unit' | 'point' | 'layers';`, add `onUnit?: () => void;` to props and destructuring, tools:

```tsx
      <ToolButton icon="account-group-outline" label="UNIT" active={activeTool === 'unit'} onPress={onUnit} />
      <ToolButton icon="map-marker-outline" label="POINT" active={activeTool === 'point'} onPress={onPoint} />
      <ToolButton icon="layers-outline" label="LAYERS" active={activeTool === 'layers'} onPress={onLayers} />
```

`PointsLayer.tsx`: `onItemPress?: (id: string, at: LatLon, sidc: string | null) => void` and

```tsx
        const props = e.features[0]?.properties;
        const id = props?.id;
        const sidc = typeof props?.sidc === 'string' ? props.sidc : null;
        if (typeof id === 'string') onItemPress?.(id, { lat: e.coordinates.latitude, lon: e.coordinates.longitude }, sidc);
```

`MissionMap.tsx`:

```tsx
  const toggleAdd = (id: 'unit.add' | 'point.add') => {
    if (topId === id) useMenu.getState().closeMenu();
    else if (id === 'unit.add') useMenu.getState().openMenu('unit.add', {});
    else useMenu.getState().openMenu('point.add', {});
  };
  const onItemPress = (itemId: string, at: LatLon, sidc: string | null) => {
    if (useDraft.getState().picking) useDraft.getState().setCoord(at, 'press');
    else {
      notifySelected();
      openItemMenu(itemId, sidc);
    }
  };
  const onLongPress = (coord: LatLon) => {
    notifyPlaced();
    const current = topMenu(useMenu.getState())?.id;
    const adding = current === 'unit.add' || current === 'point.add';
    const editing = (current === 'unit.edit' || current === 'point.edit') && !useDraft.getState().locked;
    if (adding || editing) useDraft.getState().setCoord(coord, 'press');
    else if (useDraft.getState().lastAddCategory === 'point') useMenu.getState().openMenu('point.add', { at: coord });
    else useMenu.getState().openMenu('unit.add', { at: coord });
  };
```

Toolbar props: `activeTool={topId === 'unit.add' ? 'unit' : topId === 'point.add' ? 'point' : topId === 'layers' ? 'layers' : null}`, `onUnit={() => toggleAdd('unit.add')}`, `onPoint={() => toggleAdd('point.add')}`. `editingId` stays `mode === 'edit' ? itemId : null` (both categories).

Note: switching UNIT → POINT replaces the menu; `AddItemPanel`'s unmount `clear()` runs, then the new panel's `startAdd({ category: 'point' })` — covered by the MapScreen test above.

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: UNIT and POINT tools, item routing and last-used long-press"`

---

### Task 7: Layers summary/search and mission counts

**Files:**
- Modify: `src/features/map-items/layer-rows.ts`, `layer-rows.test.ts`, `menus/LayersMenu.tsx`, `menus/LayersMenu.test.tsx`
- Modify: `src/features/missions/repository.ts`, `format.ts`, `format.test.ts`, `missions.test.ts`, `MissionsScreen.tsx`, `MissionsScreen.test.tsx`

**Interfaces:**
- Consumes: `itemCategory`, `typeLabel`, `POINT_SIDCS`.
- Produces: `LayerRows` gains `units: number; points: number`; `observeMissionCategoryCounts(db, missionId): Observable<{ units: number; points: number }>`; `formatCategoryCounts(c: { units: number; points: number }, joiner?: string): string` (default joiner `' · '`).

- [ ] **Step 1: Write the failing tests**

`layer-rows.test.ts` (add; reuse the file's snapshot factory, here `snap`):

```ts
  it('counts units and points and searches type labels too', () => {
    const items = [
      snap({ id: 'a', name: 'CP-1', sidc: 'GFGPGPPK------X' }),
      snap({ id: 'b', name: 'HOS-1', sidc: composeSidc('hostile', 'infantry') }),
      snap({ id: 'c', name: 'BRAVO', sidc: null }),
    ];
    const all = layerRows(items, [], '');
    expect(all).toMatchObject({ units: 2, points: 1, total: 3 });
    expect(layerRows(items, [], 'checkpoint').rows.map((r) => r.id)).toEqual(['a']);
    expect(layerRows(items, [], 'infantry').rows.map((r) => r.id)).toEqual(['b']);
    expect(layerRows(items, [], 'brav').rows.map((r) => r.id)).toEqual(['c']);
  });
```

`format.test.ts` (add):

```ts
describe('formatCategoryCounts', () => {
  it('names both parts with singular and plural', () => {
    expect(formatCategoryCounts({ units: 2, points: 0 })).toBe('2 units · 0 points');
    expect(formatCategoryCounts({ units: 1, points: 1 }, ' and ')).toBe('1 unit and 1 point');
  });
});
```

`missions.test.ts` (add):

```ts
  it('counts units and points per mission', async () => {
    const ctx = makeTestContext();
    const iron = await createMission(ctx, { name: 'Op Iron' });
    if (!iron.ok) throw new Error('setup');
    await placePoint(ctx, { missionId: iron.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    await placePoint(ctx, { missionId: iron.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'GFGPGPPK------X', name: 'CP-1' });
    expect(await firstValueFrom(observeMissionCategoryCounts(ctx.db, iron.value.id))).toEqual({ units: 1, points: 1 });
  });
```

`MissionsScreen.test.tsx`: change `'2 items · Never opened'` → `'2 units · 0 points · Never opened'`, `/^0 items · Opened /` → `/^0 units · 0 points · Opened /`, and both confirmation texts `"Delete Op Iron and its 2 items? This can't be undone."` → `"Delete Op Iron and its 2 units and 0 points? This can't be undone."`.

`LayersMenu.test.tsx`: summary expectations `'N points · M hidden'` → `'<u> units · <p> points · M hidden'` matching each test's fixtures; search field label `'Search points'` → `'Search'`; empty text → `'Nothing on the map yet. Use UNIT, POINT or long-press the map.'`; no-match text → `'Nothing matches.'`.

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/map-items src/features/missions` → FAIL.

- [ ] **Step 3: Implement**

`layer-rows.ts`:

```ts
import { itemCategory, KNOWN_SIDCS, typeLabel } from '@/features/symbology/categories';
…
export type LayerRows = { rows: LayerRow[]; matched: number; total: number; units: number; points: number; hiddenIds: string[] };
…
  const q = query.trim().toLowerCase();
  const matchesQuery = (i: MapItemSnapshot) => i.name.toLowerCase().includes(q) || (typeLabel(i.sidc)?.toLowerCase().includes(q) ?? false);
  const matches = (q ? points.filter(matchesQuery) : [...points]).sort(…unchanged…);
  const pointCount = points.filter((i) => itemCategory(i.sidc) === 'point').length;
  return {
    …unchanged…,
    total: points.length,
    units: points.length - pointCount,
    points: pointCount,
    …
  };
```

(Update the doc comment: "Rows for the Layers list: the mission's units and points matching `query` (name or type label contains, any case) …".)

`LayersMenu.tsx`:
- section label `"Units and points"`;
- summary: ``{`${count(units)} ${units === 1 ? 'unit' : 'units'} · ${count(points)} ${points === 1 ? 'point' : 'points'} · ${count(hiddenIds.length)} hidden`}``;
- search `accessibilityLabel="Search"`, `placeholder="Search names or types"`;
- empty: `Nothing on the map yet. Use UNIT, POINT or long-press the map.`; no match: `Nothing matches.`;
- Show all error: `Could not show the hidden items.`

`missions/repository.ts`: replace `observeMissionItemCount` with

```ts
/** Units and points in a mission, by symbol code (see itemCategory). */
export function observeMissionCategoryCounts(db: Database, missionId: string): Observable<{ units: number; points: number }> {
  const items = db.get<MapItem>(Tables.mapItems);
  return combineLatest([
    items.query(Q.where('mission_id', missionId)).observeCount(),
    items.query(Q.where('mission_id', missionId), Q.where('sidc', Q.oneOf([...POINT_SIDCS]))).observeCount(),
  ]).pipe(map(([all, points]) => ({ units: all - points, points })));
}
```

(import `POINT_SIDCS` from `@/features/symbology/point-types`; update `missions.test.ts` callers of `observeMissionItemCount` to `observeMissionCategoryCounts(...).pipe(map((c) => c.units + c.points))` or assert on the object.)

`format.ts`: replace `formatItemCount` with

```ts
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** "2 units · 1 point" (row) or "2 units and 1 point" (sentence). */
export function formatCategoryCounts(c: { units: number; points: number }, joiner = ' · '): string {
  return `${plural(c.units, 'unit')}${joiner}${plural(c.points, 'point')}`;
}
```

(update `format.test.ts` cases for the removed `formatItemCount`).

`MissionsScreen.tsx`: row uses `const counts = useObservable(() => observeMissionCategoryCounts(ctx.db, mission.id), NO_COUNTS, [ctx, mission.id]);` with module `const NO_COUNTS = { units: 0, points: 0 };`, text `` `${formatCategoryCounts(counts)} · ${formatLastOpened(mission.lastOpenedAt, now)}` ``; `onDelete(counts)`; `pending` holds `counts`; message `` `Delete ${pending.name} and its ${formatCategoryCounts(pending.counts, ' and ')}? This can't be undone.` ``.

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: Layers and mission counts by units and points"`

---

### Task 8: Docs, skills and device checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md`, `.agents/skills/map-item-kinds/SKILL.md`, `.agents/skills/menus/SKILL.md`, `docs/superpowers/notes/2026-10-12-native-gate.md`

- [ ] **Step 1: Architecture spec** — under §5.4 Missions (after its bullets) add:

```markdown
### 5.4a Units and points
Map symbols are **units** (affiliation + unit type) or **points** (control measures: checkpoint,
observation post, landing zone, start/release/rally/linkup points, TRP). Both are stored as
`kind = 'point'` items; `itemCategory(sidc)` (src/features/symbology/categories.ts) is the only
place that tells them apart. Design: `2026-10-13-units-and-points-design.md`.
```

- [ ] **Step 2: map-item-kinds skill** — add a section:

```markdown
## Categories within the point kind

Units and points share `kind = 'point'`. `itemCategory(sidc)` decides which; never test SIDC
prefixes elsewhere. To add a point type: add a row to `POINT_TYPES` (id, label, prefix, SIDC),
run `npm run build:symbols` (a custom SVG in `scripts/build-symbols.ts` if milsymbol cannot draw
it), and extend `point-types.test.ts`. Add/Edit menus are `AddItemPanel` / `EditItemPanel` with a
category and a form (`UnitForm`, `PointForm`) built from `form/LocationSection` and `useAutoName`.
```

- [ ] **Step 3: menus skill** — in the menu list, replace `point.add` / `point.edit` with `unit.add` / `unit.edit` / `point.add` / `point.edit` and add: "Item menus share `AddItemPanel` / `EditItemPanel`; open an item with `openItemMenu(itemId, sidc)`."

- [ ] **Step 4: Gate notes** — after row 53 add:

```markdown
| 54 | Toolbar reads UNIT · POINT · LAYERS; UNIT opens "Add unit" (unchanged form), POINT opens "Add point" (location, Point type with symbols, Name, Notes) | PENDING |
| 55 | Add point: picking a type changes the draft symbol at once and renames CP-1 → LZ-1 etc.; Add shows the point selected as "Point"; Edit/Save/Cancel/Hidden/Delete work | PENDING |
| 56 | Point symbols (white with dark outline) are readable on Satellite, Hybrid, Topo and Dark; the LZ symbol matches the others in size and weight | PENDING |
| 57 | Long-press after using Add point starts Add point; after Add unit starts Add unit; first launch starts Add unit | PENDING |
| 58 | Layers: summary "N units · M points · K hidden"; searching "checkpoint" or "infantry" finds by type; row taps open Unit or Point to match. Missions list shows "N units · M points" | PENDING |
```

- [ ] **Step 5: Verify and commit** — `npx expo lint` → 0 problems; `git commit -am "docs: units and points in the spec, skills and device checklist"`
