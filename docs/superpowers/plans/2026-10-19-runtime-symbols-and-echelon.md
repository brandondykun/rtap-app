# Runtime Symbols (Skia) and Unit Echelon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw every map/menu symbol on the device with milsymbol + Skia (any SIDC works without a rebuild), then add an Echelon picker to units.

**Architecture:** `features/symbology/render/` holds a pure `symbolSvg(sidc)` (the old build script's drawing, moved into the app), a thin Skia `rasterizeSvg`, and a disk cache behind `getSymbolImage(sidc, { trimmed })` that returns `{ uri, scale }`. The map registers the mission's symbols through a second `<Images>` (plus `onImageMissing` as a safety net); menus use `useSymbolThumbnail`. The pre-built PNGs and build script are removed. Echelon lives in SIDC positions 11–12.

**Tech Stack:** Expo SDK 57, RN 0.86, @shopify/react-native-skia (2.x: `Skia.SVG.MakeFromString`, `Skia.Surface.Make`, `canvas.drawSvg`, `makeImageSnapshot`, `encodeToBytes(ImageFormat.PNG)`, `readPixels`), milsymbol, expo-file-system (`Paths.cache`, `Directory`, `File.write(Uint8Array)`), @rnmapbox/maps 10.3.8 (`<Images images onImageMissing>`, image entries `{ url, scale }`), Zustand, WatermelonDB, jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-19-runtime-symbols-and-echelon-design.md`

## Global Constraints

- One entry point for symbol images: `getSymbolImage(sidc, { trimmed })`; layers keep `iconImage: ['get', 'sidc']`.
- Drawing must match today's: unit `size: 30`, `strokeWidth: 6`, fill by affiliation (`friendly`/`hostile`/`neutral`/`unknown` tokens from `mapColors('dark')`); points `monoColor: friendly`, `outlineColor: point-symbol-halo`, `outlineWidth: 2`, strokes ×1.8, anchor-centered; LZ hand-drawn.
- Cache: `<Paths.cache>/symbols/v<SYMBOL_RENDER_VERSION>/<sidc>@<scale>[-trim].png`; other version folders deleted on first use; concurrent requests share one render; failures log once per key and resolve `null`, never throw.
- Echelon codes (positions 11–12): `--` Unspecified, `-A` Team, `-B` Squad, `-C` Section, `-D` Platoon, `-E` Company, `-F` Battalion, `-G` Regiment, `-H` Brigade, `-I` Division (picker labels are these short forms). Default Unspecified. No database change.
- Install only with `npx expo install @shopify/react-native-skia` (new native module: new development build).
- Commits: Conventional Commits, single quotes, **no attribution trailers** (no Co-Authored-By). Never run prettier. `npx`, not bunx.
- Before every commit: `npx tsc --noEmit` clean, `npx expo lint` 0 problems, `npx jest` with **every suite loading** (check the `Test Suites:` line, not only `Tests:`).
- Crosshair UI, if touched, uses `CrosshairGlyph` (project rule).

## Review Focus

- An existing unit stored as `S?GPU…-----` (no echelon) must still decompose, render and edit as Unspecified (Task 1 test).
- A SIDC the app never composed (e.g. echelon `-J` Corps from another source) must render via milsymbol and read as known for its affiliation/type with echelon Unspecified, not crash (Tasks 1 and 2 tests).
- Two layers asking for the same new symbol at once must render it once (Task 3 test).
- A Skia failure (`MakeFromString` → null) must leave that symbol blank, log once, and not retry in a tight loop (Task 3 test).
- Changing echelon on an existing unit must update the map symbol (new SIDC requested via the hook) (Task 4 test).

---

### Task 1: Echelon in the SIDC model

**Files:**
- Modify: `src/features/symbology/presets.ts`
- Modify: `src/features/symbology/categories.ts` (replace `KNOWN_SIDCS` set with `isKnownSidc`)
- Modify: `src/features/map-items/commands.ts`, `src/features/map-items/selectors.ts`, `src/features/map-items/layer-rows.ts` (use `isKnownSidc`)
- Test: `src/features/symbology/presets.test.ts`, `src/features/symbology/categories.test.ts`

**Interfaces:**
- Produces: `type Echelon = 'unspecified' | 'team' | 'squad' | 'section' | 'platoon' | 'company' | 'battalion' | 'regiment' | 'brigade' | 'division'`; `ECHELONS: readonly { id: Echelon; label: string; code: string }[]`; `composeSidc(affiliation, unitType, echelon?: Echelon): string`; `decomposeSidc(sidc): { affiliation; unitType; echelon } | null`; `isKnownSidc(sidc: string): boolean`.

- [ ] **Step 1: Write the failing tests** — add to `presets.test.ts`:

```ts
import { composeSidc, decomposeSidc, ECHELONS } from './presets';

describe('echelon', () => {
  it('lists Unspecified then Team up to Division with their 2525C codes', () => {
    expect(ECHELONS.map((e) => [e.id, e.label, e.code])).toEqual([
      ['unspecified', 'Unspecified', '--'],
      ['team', 'Team', '-A'],
      ['squad', 'Squad', '-B'],
      ['section', 'Section', '-C'],
      ['platoon', 'Platoon', '-D'],
      ['company', 'Company', '-E'],
      ['battalion', 'Battalion', '-F'],
      ['regiment', 'Regiment', '-G'],
      ['brigade', 'Brigade', '-H'],
      ['division', 'Division', '-I'],
    ]);
  });

  it('puts the echelon in positions 11-12 and defaults to unspecified', () => {
    expect(composeSidc('friend', 'infantry', 'company')).toBe('SFGPUCI----E---');
    expect(composeSidc('hostile', 'armor')).toBe('SHGPUCA--------');
  });

  it('round-trips every echelon and reads stored SIDCs without one as unspecified', () => {
    for (const e of ECHELONS) expect(decomposeSidc(composeSidc('neutral', 'recon', e.id))).toEqual({ affiliation: 'neutral', unitType: 'recon', echelon: e.id });
    expect(decomposeSidc('SUGPU----------')).toEqual({ affiliation: 'unknown', unitType: 'unspecified', echelon: 'unspecified' });
  });

  it('reads an echelon it does not offer (Corps) as unspecified, and rejects non-unit codes', () => {
    expect(decomposeSidc('SFGPUCI----J---')).toEqual({ affiliation: 'friend', unitType: 'infantry', echelon: 'unspecified' });
    expect(decomposeSidc('GFGPGPPK------X')).toBeNull();
    expect(decomposeSidc('SFGPUCI')).toBeNull();
  });
});
```

(The expected string is `S F G P UCI--- -E ---` → `'SFGPUCI----E---'`: positions 5–10 `UCI---`, 11–12 `-E`, 13–15 `---`.)

Add to `categories.test.ts`:

```ts
import { isKnownSidc } from './categories';

it('knows every composable unit SIDC (any echelon) and every point type', () => {
  expect(isKnownSidc('SFGPUCI----E---')).toBe(true);
  expect(isKnownSidc('SHGPU----------')).toBe(true);
  expect(isKnownSidc('GFGPGPPK------X')).toBe(true);
  expect(isKnownSidc('XYZ')).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/symbology`
Expected: FAIL (`ECHELONS`/`isKnownSidc` not exported).

- [ ] **Step 3: Implement** in `presets.ts`:

```ts
export type Echelon = 'unspecified' | 'team' | 'squad' | 'section' | 'platoon' | 'company' | 'battalion' | 'regiment' | 'brigade' | 'division';

/** 2525C echelon amplifier, SIDC positions 11-12 ("--" when unspecified), Team up to Division. */
export const ECHELONS: readonly { id: Echelon; label: string; code: string }[] = [
  { id: 'unspecified', label: 'Unspecified', code: '--' },
  { id: 'team', label: 'Team', code: '-A' },
  { id: 'squad', label: 'Squad', code: '-B' },
  { id: 'section', label: 'Section', code: '-C' },
  { id: 'platoon', label: 'Platoon', code: '-D' },
  { id: 'company', label: 'Company', code: '-E' },
  { id: 'battalion', label: 'Battalion', code: '-F' },
  { id: 'regiment', label: 'Regiment', code: '-G' },
  { id: 'brigade', label: 'Brigade', code: '-H' },
  { id: 'division', label: 'Division', code: '-I' },
];

const ECHELON_CODE = Object.fromEntries(ECHELONS.map((e) => [e.id, e.code])) as Record<Echelon, string>;
const ECHELON_BY_CODE = new Map(ECHELONS.map((e) => [e.code, e.id]));
const AFFILIATION_BY_CODE = new Map(AFFILIATIONS.map((a) => [AFFILIATION_CODE[a], a]));
const UNIT_TYPE_BY_FUNCTION = new Map((Object.keys(UNIT_FUNCTIONS) as UnitType[]).map((t) => [UNIT_FUNCTIONS[t].functionId, t]));

/** 2525C SIDC: scheme S, affiliation, dimension G (ground), status P, function ID, echelon (11-12), then `---`. */
export function composeSidc(affiliation: Affiliation, unitType: UnitType, echelon: Echelon = 'unspecified'): string {
  return `S${AFFILIATION_CODE[affiliation]}GP${UNIT_FUNCTIONS[unitType].functionId}${ECHELON_CODE[echelon]}---`;
}

/** A ground unit SIDC the app can edit; an echelon it does not offer reads as unspecified. */
export function decomposeSidc(sidc: string): { affiliation: Affiliation; unitType: UnitType; echelon: Echelon } | null {
  if (sidc.length !== 15 || sidc[0] !== 'S' || sidc[2] !== 'G' || sidc[3] !== 'P') return null;
  const affiliation = AFFILIATION_BY_CODE.get(sidc[1]);
  const unitType = UNIT_TYPE_BY_FUNCTION.get(sidc.slice(4, 10));
  if (!affiliation || !unitType) return null;
  return { affiliation, unitType, echelon: ECHELON_BY_CODE.get(sidc.slice(10, 12)) ?? 'unspecified' };
}
```

Move `const AFFILIATION_CODE` above these helpers if needed (it must be declared before use at module load). Keep `PRESET_SIDCS` and `DEFAULT_SIDC` (they compose with the default echelon, unchanged values).

In `categories.ts` replace `KNOWN_SIDCS` with:

```ts
const POINT_SIDC_SET: ReadonlySet<string> = new Set(POINT_SIDCS);

/** A SIDC the app can draw and edit: any composable ground unit (any echelon) or a point type; anything else draws as DEFAULT_SIDC. */
export function isKnownSidc(sidc: string): boolean {
  return POINT_SIDC_SET.has(sidc) || decomposeSidc(sidc) !== null;
}
```

(Remove the now-unused `PRESET_SIDCS` import there.) Replace each `KNOWN_SIDCS.has(x)` with `isKnownSidc(x)` in `commands.ts` (2 places), `selectors.ts`, `layer-rows.ts`, and their imports. If any existing test imports `KNOWN_SIDCS`, switch it to `isKnownSidc` (keep its intent).

- [ ] **Step 4: Run to verify**

Run: `npx jest src/features/symbology src/features/map-items`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/symbology src/features/map-items
git commit -m "feat: echelon in unit SIDCs (team up to division) and isKnownSidc"
```

---

### Task 2: Pure symbol drawing (`symbolSvg`) and pixel trimming

**Files:**
- Create: `src/features/symbology/render/symbol-svg.ts`
- Create: `src/features/symbology/render/visible-bounds.ts`
- Test: `src/features/symbology/render/symbol-svg.test.ts`, `src/features/symbology/render/visible-bounds.test.ts`

**Interfaces:**
- Consumes: `decomposeSidc` (Task 1), `POINT_TYPES`, `drawSidcFor`, `LANDING_ZONE_SIDC`, `pointTypeForSidc` from `point-types.ts`, `mapColors` from `@/theme/tokens`.
- Produces: `symbolSvg(sidc: string): string` (map image SVG, anchor-centered for points); `isPointSidc(sidc: string): boolean`; `visibleBounds(rgba: Uint8Array, width: number, height: number): { x: number; y: number; width: number; height: number } | null`.

- [ ] **Step 1: Write the failing tests**

`symbol-svg.test.ts`:

```ts
import { mapColors } from '@/theme/tokens';

import { composeSidc, ECHELONS } from '../presets';
import { LANDING_ZONE_SIDC } from '../point-types';
import { isPointSidc, symbolSvg } from './symbol-svg';

const colors = mapColors('dark');

describe('symbolSvg', () => {
  it('fills units by affiliation', () => {
    expect(symbolSvg(composeSidc('friend', 'infantry'))).toContain(colors.friendly);
    expect(symbolSvg(composeSidc('hostile', 'infantry'))).toContain(colors.hostile);
    expect(symbolSvg(composeSidc('neutral', 'infantry'))).toContain(colors.neutral);
    expect(symbolSvg(composeSidc('unknown', 'infantry'))).toContain(colors.unknown);
  });

  it('draws an echelon marking above the frame for every echelon but unspecified', () => {
    const plain = symbolSvg(composeSidc('friend', 'infantry'));
    for (const e of ECHELONS.filter((x) => x.id !== 'unspecified')) {
      expect(symbolSvg(composeSidc('friend', 'infantry', e.id))).not.toBe(plain);
    }
  });

  it('draws any SIDC milsymbol knows, even one the app never composes (Corps)', () => {
    expect(() => symbolSvg('SFGPUCI----J---')).not.toThrow();
    expect(symbolSvg('SFGPUCI----J---')).toMatch(/^<svg/);
  });

  it('centers point graphics on their anchor and draws the LZ by hand', () => {
    expect(isPointSidc('GFGPGPPK------X')).toBe(true);
    expect(isPointSidc(composeSidc('friend', 'armor'))).toBe(false);
    const checkpoint = symbolSvg('GFGPGPPK------X');
    expect(checkpoint).toContain('<g transform="translate(');
    expect(checkpoint).toContain(colors['point-symbol-halo']);
    expect(symbolSvg(LANDING_ZONE_SIDC)).toContain('>LZ</text>');
  });
});
```

`visible-bounds.test.ts`:

```ts
import { visibleBounds } from './visible-bounds';

function image(width: number, height: number, opaque: [number, number][]) {
  const px = new Uint8Array(width * height * 4);
  for (const [x, y] of opaque) px[(y * width + x) * 4 + 3] = 255;
  return px;
}

describe('visibleBounds', () => {
  it('is the box around the non-transparent pixels', () => {
    expect(visibleBounds(image(10, 8, [[2, 3], [6, 5]]), 10, 8)).toEqual({ x: 2, y: 3, width: 5, height: 3 });
  });
  it('is null for a fully transparent image', () => {
    expect(visibleBounds(image(4, 4, []), 4, 4)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/symbology/render`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`visible-bounds.ts`:

```ts
/** The smallest box holding every pixel with any alpha (RGBA or BGRA rows: alpha is byte 3). Null when empty. */
export function visibleBounds(rgba: Uint8Array, width: number, height: number): { x: number; y: number; width: number; height: number } | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}
```

`symbol-svg.ts` — the drawing moved from `scripts/build-symbols.ts` (same constants and math):

```ts
import ms from 'milsymbol';

import { mapColors } from '@/theme/tokens';

import { drawSidcFor, LANDING_ZONE_SIDC, POINT_TYPES, type PointTypeInfo } from '../point-types';

const colors = mapColors('dark');
const SYMBOL_SIZE = 30; // milsymbol size ≈ frame height in px at @1x
const UNIT_STROKE_WIDTH = 6;
/** Point symbols use the friendly-unit blue, so the two always match. */
const POINT_COLOR = colors.friendly;
const POINT_OUTLINE_WIDTH = 2;
/** milsymbol draws tactical points with 3-unit lines and ignores `strokeWidth` for them. */
const POINT_BASE_LINE = 3;
/** Every stroke of a point symbol is scaled by this, so the lines read on imagery. */
const POINT_LINE_SCALE = 1.8;
const PX_PER_UNIT = SYMBOL_SIZE / 100;
const POINT_LINE_PX = POINT_BASE_LINE * POINT_LINE_SCALE * PX_PER_UNIT;
const POINT_HALO_PX = POINT_OUTLINE_WIDTH * POINT_LINE_SCALE * PX_PER_UNIT;
/** Thicker strokes reach past milsymbol's own bounds: pad the canvas and let them draw there. */
const STROKE_PAD = POINT_HALO_PX + POINT_LINE_PX;

const UNIT_FILL: Record<string, string> = { F: colors.friendly, H: colors.hostile, N: colors.neutral, U: colors.unknown };
const POINT_BY_SIDC = new Map<string, PointTypeInfo>(POINT_TYPES.map((t) => [t.sidc, t]));

export function isPointSidc(sidc: string): boolean {
  return POINT_BY_SIDC.has(sidc);
}

function thickenStrokes(svg: string, factor: number): string {
  return svg.replace(/stroke-width="([\d.]+)"/g, (_, w: string) => `stroke-width="${Number(w) * factor}"`);
}

/** Tactical points are anchored where the graphic marks the spot; pad so the anchor is the image center. */
function centeredOnAnchor(symbol: InstanceType<typeof ms.Symbol>, lineScale: number): string {
  const { x, y } = symbol.getAnchor();
  const { width, height } = symbol.getSize();
  const w = 2 * Math.max(x, width - x) + 2 * STROKE_PAD;
  const h = 2 * Math.max(y, height - y) + 2 * STROKE_PAD;
  const inner = thickenStrokes(symbol.asSVG(), lineScale).replace('<svg ', '<svg overflow="visible" ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<g transform="translate(${w / 2 - x} ${h / 2 - y})">${inner}</g></svg>`
  );
}

/** Landing zone: milsymbol has no LZ point, so draw it in the same white-on-halo style. */
function landingZoneSvg(): string {
  const size = SYMBOL_SIZE + 6;
  const c = size / 2;
  const r = SYMBOL_SIZE / 2 - 2;
  const stroke = (color: string, width: number) => `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    stroke(colors['point-symbol-halo'], POINT_LINE_PX + 2 * POINT_HALO_PX) +
    stroke(POINT_COLOR, POINT_LINE_PX) +
    `<text x="${c}" y="${c + 4.5}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="12" ` +
    `fill="${POINT_COLOR}" stroke="${colors['point-symbol-halo']}" stroke-width="${2 * POINT_HALO_PX}" paint-order="stroke">LZ</text>` +
    `</svg>`
  );
}

/** The map image for any SIDC, as SVG: units filled by affiliation, points anchor-centered, the LZ hand-drawn. */
export function symbolSvg(sidc: string): string {
  if (sidc === LANDING_ZONE_SIDC) return landingZoneSvg();
  const point = POINT_BY_SIDC.get(sidc);
  if (point) {
    const symbol = new ms.Symbol(drawSidcFor(point), {
      size: SYMBOL_SIZE,
      monoColor: POINT_COLOR,
      outlineColor: colors['point-symbol-halo'],
      outlineWidth: POINT_OUTLINE_WIDTH,
    });
    return centeredOnAnchor(symbol, POINT_LINE_SCALE);
  }
  return new ms.Symbol(sidc, { size: SYMBOL_SIZE, fillColor: UNIT_FILL[sidc[1]] ?? colors.unknown, strokeWidth: UNIT_STROKE_WIDTH }).asSVG();
}
```

If lint flags `milsymbol` import style, match `scripts/build-symbols.ts` (`import ms from 'milsymbol'`).

- [ ] **Step 4: Run to verify**

Run: `npx jest src/features/symbology/render`
Expected: PASS. If the "echelon marking differs" test fails for some echelon, milsymbol did not draw it: report it (do not weaken the test).

- [ ] **Step 5: Commit**

```bash
git add src/features/symbology/render
git commit -m "feat: draw any symbol as SVG in the app (milsymbol, today's colors and strokes)"
```

---

### Task 3: Skia rasterizer and the symbol image cache

**Files:**
- Run: `npx expo install @shopify/react-native-skia`
- Create: `src/features/symbology/render/rasterize.ts` (Skia only; untested in Jest beyond a smoke import)
- Create: `src/features/symbology/render/symbol-cache.ts`
- Create: `src/features/symbology/render/get-symbol-image.ts` (wires the real deps; the public entry point)
- Modify: `__mocks__/expo-file-system.ts` (add `Paths.cache`, `File.write`, `Directory.list`, `Directory.delete`, `name`)
- Modify: `jest.setup.ts` (stub `@shopify/react-native-skia`)
- Test: `src/features/symbology/render/symbol-cache.test.ts`

**Interfaces:**
- Consumes: `symbolSvg`, `isPointSidc`, `visibleBounds` (Task 2).
- Produces: `type SymbolImage = { uri: string; scale: number }`; `SYMBOL_RENDER_VERSION = 1`; `createSymbolCache(deps: { root: Directory; scale: number; svgFor: (sidc: string) => string; rasterize: (svg: string, scale: number, trim: boolean) => Uint8Array | null; log?: (msg: string) => void }): { get: (sidc: string, opts?: { trimmed?: boolean }) => Promise<SymbolImage | null> }`; `getSymbolImage(sidc: string, opts?: { trimmed?: boolean }): Promise<SymbolImage | null>` (module singleton using Skia, `Paths.cache`, `PixelRatio.get()` rounded and clamped to 1–3).

- [ ] **Step 1: Install**

Run: `npx expo install @shopify/react-native-skia`
Expected: added to dependencies.

- [ ] **Step 2: Extend the file-system mock and stub Skia**

`__mocks__/expo-file-system.ts` additions (keep the existing `__files`, `join`, `move`, `delete`):

```ts
export class Directory {
  uri: string;
  constructor(...segments: (string | { uri: string })[]) {
    this.uri = join(segments);
  }
  get name() {
    return this.uri.split('/').pop() ?? '';
  }
  get exists() {
    return true;
  }
  create = jest.fn();
  /** Direct children: files directly in this folder, and subfolders (by path prefix). */
  list() {
    const prefix = `${this.uri}/`;
    const names = new Set<string>();
    for (const f of __files) if (f.startsWith(prefix)) names.add(f.slice(prefix.length).split('/')[0]);
    return [...names].map((n) => ([...__files].some((f) => f.startsWith(`${prefix}${n}/`)) ? new Directory(this, n) : new File(this, n)));
  }
  delete() {
    for (const f of [...__files]) if (f.startsWith(`${this.uri}/`)) __files.delete(f);
  }
}
```

In `File` add `write(_content: unknown) { __files.add(this.uri); }` and a `get name()` like Directory's. Add `cache: new Directory('file:///cache')` to `Paths`.

`jest.setup.ts` — append (Skia is native; logic is tested through injected fakes). The global
`getSymbolImage` mock keeps screen tests from touching Skia/files (and their output pristine); test
files that test symbol images mock `./get-symbol-image` themselves, which overrides this:

```ts
jest.mock('@shopify/react-native-skia', () => ({ Skia: {}, ImageFormat: { PNG: 4 } }));
jest.mock('@/features/symbology/render/get-symbol-image', () => ({ getSymbolImage: jest.fn(async () => null) }));
```

(Add the second line in Task 3 Step 5 once `get-symbol-image.ts` exists, so the mock target resolves.)

- [ ] **Step 3: Write the failing cache tests** — `symbol-cache.test.ts`:

```ts
import { Directory, File } from 'expo-file-system';

import { createSymbolCache, SYMBOL_RENDER_VERSION } from './symbol-cache';

const fs = jest.requireMock('expo-file-system') as { __files: Set<string> };
const root = new Directory('file:///cache', 'symbols');

function setup(rasterize = jest.fn((_svg: string, _scale: number, _trim: boolean): Uint8Array | null => new Uint8Array([1]))) {
  const svgFor = jest.fn((sidc: string) => `<svg>${sidc}</svg>`);
  const log = jest.fn();
  return { cache: createSymbolCache({ root, scale: 3, svgFor, rasterize, log }), rasterize, svgFor, log };
}

beforeEach(() => fs.__files.clear());

describe('symbol cache', () => {
  it('renders a missing symbol once, writes it under the version folder, and returns its uri and scale', async () => {
    const { cache, rasterize } = setup();
    const img = await cache.get('SFGPUCI----E---');
    expect(img).toEqual({ uri: `file:///cache/symbols/v${SYMBOL_RENDER_VERSION}/SFGPUCI----E---@3.png`, scale: 3 });
    expect(fs.__files.has(img!.uri)).toBe(true);
    expect(rasterize).toHaveBeenCalledWith('<svg>SFGPUCI----E---</svg>', 3, false);
  });

  it('reads an existing file without rendering again (also across cache instances)', async () => {
    await setup().cache.get('SHGPU----------');
    const second = setup();
    await second.cache.get('SHGPU----------');
    expect(second.rasterize).not.toHaveBeenCalled();
  });

  it('shares one render between concurrent requests', async () => {
    const { cache, rasterize } = setup();
    const [a, b] = await Promise.all([cache.get('SNGPU----------'), cache.get('SNGPU----------')]);
    expect(a).toEqual(b);
    expect(rasterize).toHaveBeenCalledTimes(1);
  });

  it('keeps trimmed point thumbnails separate, and trims only points', async () => {
    const { cache, rasterize } = setup();
    expect((await cache.get('GFGPGPPK------X', { trimmed: true }))!.uri).toMatch(/GFGPGPPK------X@3-trim\.png$/);
    expect(rasterize).toHaveBeenLastCalledWith(expect.any(String), 3, true);
    // Units are not padded, so their thumbnail is the map image.
    expect((await cache.get('SFGPU----------', { trimmed: true }))!.uri).toMatch(/SFGPU----------@3\.png$/);
  });

  it('deletes other version folders on first use', async () => {
    fs.__files.add('file:///cache/symbols/v0/OLD@3.png');
    await setup().cache.get('SUGPU----------');
    expect(fs.__files.has('file:///cache/symbols/v0/OLD@3.png')).toBe(false);
  });

  it('resolves null and logs once when a symbol cannot be drawn, without retrying in a loop', async () => {
    const { cache, rasterize, log } = setup(jest.fn(() => null));
    expect(await cache.get('BAD')).toBeNull();
    expect(await cache.get('BAD')).toBeNull();
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('resolves null when drawing throws', async () => {
    const { cache } = setup(jest.fn(() => {
      throw new Error('skia');
    }));
    await expect(cache.get('SFGPU----------')).resolves.toBeNull();
    expect(new File(root, `v${SYMBOL_RENDER_VERSION}`, 'SFGPU----------@3.png').exists).toBe(false);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx jest src/features/symbology/render/symbol-cache.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 5: Implement**

`symbol-cache.ts`:

```ts
import { Directory, File } from 'expo-file-system';

import { isPointSidc } from './symbol-svg';

/** Bump whenever symbol drawing or colors change: older cached images are deleted on first use. */
export const SYMBOL_RENDER_VERSION = 1;

export type SymbolImage = { uri: string; scale: number };

type Deps = {
  root: Directory;
  scale: number;
  svgFor: (sidc: string) => string;
  rasterize: (svg: string, scale: number, trim: boolean) => Uint8Array | null;
  log?: (message: string) => void;
};

/** Symbol PNGs on disk by SIDC, rendered on first use. Never throws; a symbol that cannot be drawn is null (once). */
export function createSymbolCache({ root, scale, svgFor, rasterize, log = console.warn }: Deps) {
  const pending = new Map<string, Promise<SymbolImage | null>>();
  const versionDir = new Directory(root, `v${SYMBOL_RENDER_VERSION}`);
  let prepared = false;

  const prepare = () => {
    if (prepared) return;
    prepared = true;
    try {
      root.create({ intermediates: true, idempotent: true });
      for (const entry of root.list()) if (entry instanceof Directory && entry.name !== `v${SYMBOL_RENDER_VERSION}`) entry.delete();
      versionDir.create({ intermediates: true, idempotent: true });
    } catch (e) {
      log(`[symbols] cache folder: ${String(e)}`);
    }
  };

  const render = async (sidc: string, trim: boolean, key: string): Promise<SymbolImage | null> => {
    prepare();
    const file = new File(versionDir, `${key}.png`);
    if (file.exists) return { uri: file.uri, scale };
    try {
      const png = rasterize(svgFor(sidc), scale, trim);
      if (!png) {
        log(`[symbols] could not draw ${sidc}`);
        return null;
      }
      file.write(png);
      return { uri: file.uri, scale };
    } catch (e) {
      log(`[symbols] could not draw ${sidc}: ${String(e)}`);
      return null;
    }
  };

  return {
    get(sidc: string, opts: { trimmed?: boolean } = {}): Promise<SymbolImage | null> {
      // Only points are padded around their anchor; a unit's thumbnail is its map image.
      const trim = !!opts.trimmed && isPointSidc(sidc);
      const key = `${sidc}@${scale}${trim ? '-trim' : ''}`;
      let job = pending.get(key);
      if (!job) {
        job = render(sidc, trim, key);
        pending.set(key, job);
      }
      return job;
    },
  };
}
```

(A key that resolved null stays in `pending`, so it is not retried; a successful one is also kept, which doubles as a memory cache.)

`rasterize.ts`:

```ts
import { ImageFormat, Skia } from '@shopify/react-native-skia';

import { visibleBounds } from './visible-bounds';

/** SVG → PNG bytes at `scale`, optionally cropped to its visible pixels. Null when Skia cannot parse or draw it. */
export function rasterizeSvg(svgText: string, scale: number, trim: boolean): Uint8Array | null {
  const svg = Skia.SVG.MakeFromString(svgText, Skia.FontMgr.System());
  if (!svg) return null;
  const width = Math.ceil(svg.width() * scale);
  const height = Math.ceil(svg.height() * scale);
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  canvas.drawSvg(svg);
  surface.flush();
  let image = surface.makeImageSnapshot();
  if (trim) {
    const pixels = image.readPixels();
    const box = pixels instanceof Uint8Array ? visibleBounds(pixels, width, height) : null;
    if (box) image = surface.makeImageSnapshot(Skia.XYWHRect(box.x, box.y, box.width, box.height));
  }
  return image.encodeToBytes(ImageFormat.PNG, 100);
}
```

`get-symbol-image.ts`:

```ts
import { Directory, Paths } from 'expo-file-system';
import { PixelRatio } from 'react-native';

import { rasterizeSvg } from './rasterize';
import { createSymbolCache, type SymbolImage } from './symbol-cache';
import { symbolSvg } from './symbol-svg';

let cache: ReturnType<typeof createSymbolCache> | null = null;

/** The one entry point for symbol images (map and menus): a cached PNG for this device's pixel density. */
export function getSymbolImage(sidc: string, opts?: { trimmed?: boolean }): Promise<SymbolImage | null> {
  cache ??= createSymbolCache({
    root: new Directory(Paths.cache, 'symbols'),
    scale: Math.min(3, Math.max(1, Math.round(PixelRatio.get()))),
    svgFor: symbolSvg,
    rasterize: rasterizeSvg,
  });
  return cache.get(sidc, opts);
}

export type { SymbolImage };
```

- [ ] **Step 6: Run to verify**

Run: `npx jest src/features/symbology` then `npx tsc --noEmit`
Expected: PASS; tsc clean (Skia types resolve from the installed package).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json __mocks__/expo-file-system.ts jest.setup.ts src/features/symbology/render
git commit -m "feat: render symbols on the device with Skia, cached on disk by SIDC"
```

---

### Task 4: Map registers symbols at runtime

**Files:**
- Create: `src/features/symbology/render/use-symbol-images.ts`
- Modify: `src/features/map/images/map-images.ts` (drop `...SYMBOL_IMAGES`)
- Modify: `src/features/map/canvas/MapCanvas.tsx` (second `<Images>` with symbol images + `onImageMissing`)
- Modify: `src/features/map/MissionMap.tsx` (collect SIDCs, pass them down)
- Test: `src/features/symbology/render/use-symbol-images.test.tsx`; extend `src/features/map/canvas/MapCanvas.test.tsx`

**Interfaces:**
- Consumes: `getSymbolImage` (Task 3), `observeMissionItems` (`@/features/map-items/repository`), `useDraft`, `draftSidc`.
- Produces: `useSymbolImages(sidcs: readonly string[]): { images: Record<string, { url: string; scale: number }>; request: (sidc: string) => void }`; `MapCanvas` props `symbolImages: Record<string, { url: string; scale: number }>` and `onSymbolMissing: (sidc: string) => void`.

- [ ] **Step 1: Write the failing tests**

`use-symbol-images.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSymbolImages } from './use-symbol-images';

const mockGet = jest.fn(async (sidc: string) => ({ uri: `file:///s/${sidc}.png`, scale: 3 }));
jest.mock('./get-symbol-image', () => ({ getSymbolImage: (s: string) => mockGet(s) }));

beforeEach(() => mockGet.mockClear());

describe('useSymbolImages', () => {
  it('resolves the given SIDCs into Mapbox image entries', async () => {
    const { result } = await renderHook(() => useSymbolImages(['A', 'B']));
    await waitFor(() => expect(Object.keys(result.current.images).sort()).toEqual(['A', 'B']));
    expect(result.current.images.A).toEqual({ url: 'file:///s/A.png', scale: 3 });
  });

  it('keeps the same record when nothing new resolves, and adds new SIDCs (e.g. an echelon change)', async () => {
    const { result, rerender } = await renderHook(({ s }: { s: string[] }) => useSymbolImages(s), { initialProps: { s: ['A'] } });
    await waitFor(() => expect(result.current.images.A).toBeTruthy());
    const first = result.current.images;
    await rerender({ s: ['A'] });
    expect(result.current.images).toBe(first);
    await rerender({ s: ['A', 'C'] });
    await waitFor(() => expect(result.current.images.C).toBeTruthy());
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('fetches a symbol the map reports missing', async () => {
    const { result } = await renderHook(() => useSymbolImages([]));
    await act(async () => result.current.request('Z'));
    await waitFor(() => expect(result.current.images.Z).toBeTruthy());
  });

  it('leaves a symbol out when it cannot be drawn', async () => {
    mockGet.mockResolvedValueOnce(null as never);
    const { result } = await renderHook(() => useSymbolImages(['BAD']));
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current.images.BAD).toBeUndefined();
  });
});
```

In `MapCanvas.test.tsx` add (follow the file's render helper and props; the Mapbox mock records props by component name, and a second `Images` overwrites `__props.Images.main`, so give the symbol one `key`/look it up via the last render — simplest: assert on `screen` or extend the mock to record `props.images` per instance). Minimal version:

```tsx
it('registers symbol images and asks for missing ones', async () => {
  const onSymbolMissing = jest.fn();
  await renderCanvas({ symbolImages: { SFGPU: { url: 'file:///s/SFGPU.png', scale: 3 } }, onSymbolMissing });
  const images = mapboxMock().__props.Images.symbols;
  expect(images.images).toEqual({ SFGPU: { url: 'file:///s/SFGPU.png', scale: 3 } });
  (images.onImageMissing as (k: string) => void)('SHGPU');
  expect(onSymbolMissing).toHaveBeenCalledWith('SHGPU');
});
```

To support `__props.Images.symbols`, change the mock's `Images` to record under `props.testID ?? 'main'` (`__props.Images[props.testID ?? 'main'] = props`), and give the symbol `<Images testID="symbols" …>`. `renderCanvas` is whatever helper the test file uses to render `MapCanvas`; add the two new props to its defaults (`symbolImages: {}`, `onSymbolMissing: jest.fn()`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/symbology/render/use-symbol-images.test.tsx src/features/map/canvas/MapCanvas.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`use-symbol-images.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

import { getSymbolImage } from './get-symbol-image';

type Entry = { url: string; scale: number };

/**
 * Mapbox image entries for symbols, by SIDC. Resolves `sidcs` (the mission's) and anything the map
 * reports missing; the record only changes identity when a new symbol arrives (stable `<Images>`).
 */
export function useSymbolImages(sidcs: readonly string[]): { images: Record<string, Entry>; request: (sidc: string) => void } {
  const [images, setImages] = useState<Record<string, Entry>>({});
  const [extra, setExtra] = useState<readonly string[]>([]);
  const request = useCallback((sidc: string) => setExtra((e) => (e.includes(sidc) ? e : [...e, sidc])), []);
  const key = [...new Set([...sidcs, ...extra])].sort().join('|');

  useEffect(() => {
    let live = true;
    const wanted = key ? key.split('|') : [];
    for (const sidc of wanted) {
      void getSymbolImage(sidc).then((img) => {
        if (!live || !img) return;
        setImages((cur) => (cur[sidc]?.url === img.uri ? cur : { ...cur, [sidc]: { url: img.uri, scale: img.scale } }));
      });
    }
    return () => {
      live = false;
    };
  }, [key]);

  return { images, request };
}
```

(`getSymbolImage` memoizes per key, so re-running the effect for already-resolved SIDCs is cheap and does not re-render.)

`map-images.ts`: remove the `SYMBOL_IMAGES` import and the `...SYMBOL_IMAGES,` line; update its doc comment: "Fixed app images; symbols are registered at runtime (useSymbolImages)."

`MapCanvas.tsx`: add props

```ts
  /** Runtime symbol images by SIDC (useSymbolImages) and the request for one the map reports missing. */
  symbolImages: Record<string, { url: string; scale: number }>;
  onSymbolMissing: (sidc: string) => void;
```

and below `<Images images={MAP_IMAGES} />`:

```tsx
      <Images testID="symbols" images={symbolImages} onImageMissing={onSymbolMissing} />
```

`MissionMap.tsx`: collect the SIDCs and pass them:

```ts
  const itemSidcs = useObservable(
    () => observeMissionItems(ctx.db, missionId).pipe(map((items) => [...new Set(items.map((i) => (i.sidc && isKnownSidc(i.sidc) ? i.sidc : DEFAULT_SIDC)))].sort())),
    [] as string[],
    [ctx, missionId],
  );
  const draftSymbol = useDraft((s) => (s.mode && (s.category === 'unit' || s.category === 'point') ? draftSidc(s) : null));
  const symbolSidcs = useMemo(() => (draftSymbol && !itemSidcs.includes(draftSymbol) ? [...itemSidcs, draftSymbol] : itemSidcs), [itemSidcs, draftSymbol]);
  const symbols = useSymbolImages(symbolSidcs);
```

then `<MapCanvas … symbolImages={symbols.images} onSymbolMissing={symbols.request}>`. Imports: `map` from `rxjs`, `observeMissionItems`, `isKnownSidc`, `DEFAULT_SIDC`, `draftSidc`, `useObservable`, `useSymbolImages`. (Lines and polygons have no point symbol; their `sidc` is null → `DEFAULT_SIDC`, harmless.) `draftSidc` gets the echelon in Task 6; until then this compiles as is.

Update `__mocks__/@rnmapbox/maps.tsx` `Images` to `__props.Images[(props.testID as string) ?? 'main'] = props;`.

- [ ] **Step 4: Run to verify**

Run: `npx jest src/features/map src/features/symbology`
Expected: PASS. Existing MapCanvas/MissionMap tests that render `MapCanvas` directly need the two new props (pass `symbolImages={{}}` and `onSymbolMissing={jest.fn()}`).

- [ ] **Step 5: Commit**

```bash
git add __mocks__/@rnmapbox src/features/map src/features/symbology/render
git commit -m "feat: map registers mission symbols at runtime, with image-missing fallback"
```

---

### Task 5: Menus and lists use runtime thumbnails

**Files:**
- Create: `src/features/symbology/render/use-symbol-thumbnail.ts`
- Create: `src/features/symbology/SymbolImage.tsx` (small component: thumbnail or empty box)
- Modify: `src/features/map-items/menus/UnitForm.tsx`, `src/features/map-items/menus/PointForm.tsx`, `src/features/map-items/menus/LayersMenu.tsx`
- Test: `src/features/symbology/render/use-symbol-thumbnail.test.tsx`; existing form/menu tests keep passing

**Interfaces:**
- Consumes: `getSymbolImage` (Task 3).
- Produces: `useSymbolThumbnail(sidc: string): { uri: string } | null`; `<SymbolImage sidc width height />` (renders `expo-image`/RN `Image` with `resizeMode="contain"`, or a same-size empty `View` while loading).

- [ ] **Step 1: Write the failing test** — `use-symbol-thumbnail.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react-native';

import { useSymbolThumbnail } from './use-symbol-thumbnail';

const mockGet = jest.fn(async (sidc: string, opts?: { trimmed?: boolean }) => ({ uri: `file:///s/${sidc}${opts?.trimmed ? '-trim' : ''}.png`, scale: 3 }));
jest.mock('./get-symbol-image', () => ({ getSymbolImage: (s: string, o?: { trimmed?: boolean }) => mockGet(s, o) }));

it('resolves the trimmed thumbnail, null until it is ready', async () => {
  const { result } = await renderHook(() => useSymbolThumbnail('GFGPGPPK------X'));
  await waitFor(() => expect(result.current).toEqual({ uri: 'file:///s/GFGPGPPK------X-trim.png' }));
  expect(mockGet).toHaveBeenCalledWith('GFGPGPPK------X', { trimmed: true });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/symbology/render/use-symbol-thumbnail.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`use-symbol-thumbnail.ts`:

```ts
import { useEffect, useState } from 'react';

import { getSymbolImage } from './get-symbol-image';

/** A symbol for menus and lists (points cropped to their graphic); null while it renders. */
export function useSymbolThumbnail(sidc: string): { uri: string } | null {
  const [image, setImage] = useState<{ uri: string } | null>(null);
  useEffect(() => {
    let live = true;
    void getSymbolImage(sidc, { trimmed: true }).then((img) => {
      if (live) setImage(img ? { uri: img.uri } : null);
    });
    return () => {
      live = false;
    };
  }, [sidc]);
  return image;
}
```

`SymbolImage.tsx`:

```tsx
import { Image, View } from 'react-native';

import { useSymbolThumbnail } from './render/use-symbol-thumbnail';

/** A symbol thumbnail at a fixed box size; an empty box of the same size while it renders. */
export function SymbolImage({ sidc, width, height }: { sidc: string; width: number; height: number }) {
  const source = useSymbolThumbnail(sidc);
  return source ? <Image testID={`symbol-${sidc}`} source={source} style={{ width, height }} resizeMode="contain" /> : <View style={{ width, height }} />;
}
```

Replace:
- `UnitForm.tsx`: `<Image source={SYMBOL_IMAGES[composeSidc(a, 'unspecified')]} style={{ width: 30, height: 22 }} resizeMode="contain" />` → `<SymbolImage sidc={composeSidc(a, 'unspecified')} width={30} height={22} />`; drop `SYMBOL_IMAGES` and (if unused) `Image` imports.
- `PointForm.tsx`: `<Image source={symbolThumbnail(t.sidc)} style={{ width: 32, height: 26 }} resizeMode="contain" />` → `<SymbolImage sidc={t.sidc} width={32} height={26} />`.
- `LayersMenu.tsx`: `<Image source={symbolThumbnail(row.sidc)} style={{ width: 28, height: 20 }} resizeMode="contain" />` → `<SymbolImage sidc={row.sidc} width={28} height={20} />`.

Delete `src/features/symbology/symbol-thumbnail.ts` (no users left).

In tests that render these menus, the global `getSymbolImage` mock (jest.setup, Task 3) resolves null, so `SymbolImage` shows the empty box. That is fine for those tests; do not assert on images there.

- [ ] **Step 4: Run to verify**

Run: `npx jest src/features/map-items src/features/symbology`
Expected: PASS (fix any test that asserted on the old `Image source` by asserting the row/option label instead).

- [ ] **Step 5: Commit**

```bash
git add src/features/symbology src/features/map-items
git commit -m "feat: menus and lists draw symbol thumbnails at runtime"
```

---

### Task 6: Echelon picker on units

**Files:**
- Modify: `src/stores/draft.ts` (`echelon` field, `setEchelon`, startAdd/startEdit/reset)
- Modify: `src/features/map-items/draft-sidc.ts` (pass echelon)
- Modify: `src/features/map-items/menus/item-adapters.ts` (read echelon when editing)
- Modify: `src/features/map/layers/DraftLayer.tsx` (echelon in the draft symbol)
- Modify: `src/features/map-items/menus/UnitForm.tsx` (Echelon `MenuSelect` below Unit type)
- Modify: `src/features/map/MissionMap.tsx` (draft SIDC selector includes echelon, via `draftSidc(s)` unchanged call)
- Test: `src/stores/draft.test.ts`, `src/features/map-items/draft-sidc.test.ts`, `src/features/map-items/menus/AddUnitMenu.test.tsx` or `UnitForm` test, `src/features/map-items/menus/EditUnitMenu.test.tsx`

**Interfaces:**
- Consumes: `Echelon`, `ECHELONS`, `composeSidc(a, t, echelon)`, `decomposeSidc` (Task 1).
- Produces: draft `echelon: Echelon` (default `'unspecified'`), `setEchelon(echelon)`; `startEdit({… echelon })`; `draftSidc({ category, affiliation, unitType, echelon, pointType })`.

- [ ] **Step 1: Write the failing tests**

`draft-sidc.test.ts`:

```ts
it('includes the unit echelon', () => {
  expect(draftSidc({ category: 'unit', affiliation: 'friend', unitType: 'infantry', echelon: 'platoon', pointType: 'checkpoint' })).toBe('SFGPUCI----D---');
});
```

`draft.test.ts`:

```ts
it('defaults new units to an unspecified echelon and keeps the echelon when editing', () => {
  useDraft.getState().startAdd({ coord: null, source: 'crosshair', category: 'unit' });
  expect(useDraft.getState().echelon).toBe('unspecified');
  useDraft.getState().setEchelon('company');
  expect(useDraft.getState().echelon).toBe('company');
  useDraft.getState().startAdd({ coord: null, source: 'crosshair', category: 'unit' });
  expect(useDraft.getState().echelon).toBe('unspecified');
  useDraft.getState().startEdit({ itemId: 'i1', coord: { lat: 1, lon: 1 }, category: 'unit', affiliation: 'friend', unitType: 'armor', echelon: 'battalion', pointType: 'checkpoint', name: 'A', notes: '' });
  expect(useDraft.getState().echelon).toBe('battalion');
});
```

(Match `startEdit`'s real parameter list; add `echelon` to it.)

Unit form test (in `AddUnitMenu.test.tsx`, using its existing render helper):

```tsx
it('offers an Echelon picker that defaults to Unspecified and sets the symbol', async () => {
  // render the Add unit menu as the file's other tests do
  expect(screen.getByLabelText('Echelon')).toHaveTextContent(/Unspecified/);
  await fireEvent.press(screen.getByLabelText('Echelon'));
  await fireEvent.press(screen.getByText('Company'));
  expect(useDraft.getState().echelon).toBe('company');
});
```

(Use the `MenuSelect` interaction pattern the file already uses for "Unit type"; its accessible label is the `label` prop.)

`EditUnitMenu.test.tsx`:

```tsx
it('shows the stored echelon when editing a unit', async () => {
  // place a unit with sidc 'SHGPUCA----F---' and open Edit as the file's other tests do
  expect(screen.getByLabelText('Echelon')).toHaveTextContent(/Battalion/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/stores/draft.test.ts src/features/map-items`
Expected: FAIL.

- [ ] **Step 3: Implement**

`draft.ts`: add `echelon: Echelon` to the values (initial `'unspecified'`), `setEchelon: (echelon: Echelon) => void` (`set({ echelon })`), set `echelon: 'unspecified'` in `startAdd` (new units always start Unspecified: the echelon is not remembered), add `echelon` to `startEdit`'s parameter and assignment, and to any reset that restores `affiliation`/`unitType` (lines ~315).

`draft-sidc.ts`:

```ts
export function draftSidc(d: { category: ItemCategory; affiliation: Affiliation; unitType: UnitType; echelon: Echelon; pointType: PointType }): string {
  return d.category === 'point' ? sidcForPointType(d.pointType) : composeSidc(d.affiliation, d.unitType, d.echelon);
}
```

`item-adapters.ts`: the fallback becomes `{ affiliation: 'unknown' as const, unitType: 'unspecified' as const, echelon: 'unspecified' as const }` and pass `echelon: unit.echelon` to `startEdit`.

`DraftLayer.tsx`: read `const echelon = useDraft((s) => s.echelon);`, pass it into `draftSidc({ … echelon … })`, add it to the memo deps.

`UnitForm.tsx`: below the Unit type row inside the same `MenuSection` (or a new `MenuSection label="Echelon"`; prefer a new section for clarity):

```tsx
      <MenuSection label="Echelon">
        <MenuSelect<Echelon> label="Echelon" options={ECHELON_OPTIONS} value={echelon} onChange={setEchelon} disabled={locked} />
      </MenuSection>
```

with `const ECHELON_OPTIONS = ECHELONS.map((e) => ({ value: e.id, label: e.label }));` (keep size order, not alphabetical), and `const echelon = useDraft((s) => s.echelon); const setEchelon = useDraft((s) => s.setEchelon);`.

- [ ] **Step 4: Run to verify**

Run: `npx jest` (whole suite; check `Test Suites:` all passed), `npx tsc --noEmit`, `npx expo lint`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/stores src/features/map-items src/features/map
git commit -m "feat: echelon picker on units (team up to division), default unspecified"
```

---

### Task 7: Remove the pre-built symbol pipeline

**Files:**
- Delete: `scripts/build-symbols.ts`, `src/features/symbology/symbol-images.generated.ts`, `src/features/symbology/symbol-images.test.ts`, `assets/symbols/`
- Modify: `package.json` (remove the `build:symbols` script; remove `@resvg/resvg-js` only if `grep -r "resvg" scripts src` finds no other user — `scripts/build-map-images.ts` may use it: keep it then)
- Modify: `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md` §8.2 (one line: "Symbols render on the device with milsymbol + Skia, cached on disk by SIDC (see 2026-10-19 spec).")
- Modify: `.agents/skills/menus/SKILL.md` if it mentions `SYMBOL_IMAGES`/`symbolThumbnail` (point to `SymbolImage`)

- [ ] **Step 1: Confirm nothing still imports the removed files**

Run: `grep -rn "symbol-images.generated\|symbol-thumbnail\|SYMBOL_IMAGES\|SYMBOL_THUMBNAILS\|build-symbols\|assets/symbols" src scripts package.json .agents`
Expected: only the files being deleted (and `package.json`'s script line).

- [ ] **Step 2: Delete and edit as listed above**

```bash
git rm -r scripts/build-symbols.ts src/features/symbology/symbol-images.generated.ts src/features/symbology/symbol-images.test.ts assets/symbols
```

Then edit `package.json`, the architecture spec line and the skill doc.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx expo lint && npx jest`
Expected: clean; every suite loads and passes.

- [ ] **Step 4: Commit**

```bash
git add -A package.json package-lock.json docs .agents scripts src assets
git commit -m "chore: drop the pre-built symbol images and build script"
```

- [ ] **Step 5: Device check (manual; report results)**

New development build (Skia). Open a mission: units and control points look as before (colors, line weights, LZ). Add a unit with each echelon on each affiliation: marking above the frame. Layers and the add/edit forms show thumbnails. Reopen the mission: symbols appear immediately (cache).
