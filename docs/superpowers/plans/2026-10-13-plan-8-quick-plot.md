# Quick Plot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PLOT toolbar tool that takes a typed MGRS grid in a centered card, shows it on the map as one temporary amber point, and offers Discard / Save unit / Save point.

**Architecture:** A tiny `quickPlot` store (`entryOpen`, `temp`) drives three pieces: `QuickPlotEntry` (top card with the shared four-field `MgrsInput`), `QuickPlotLayer` (reticle, TEMP chip, range line from the user) and `QuickPlotCard` (bottom actions). `MissionMap` toggles it from the toolbar, closes it whenever a menu opens or MEASURE starts, and eases the camera to a new temporary point. `MgrsInput` gains backspace hopping and `autoFocus`.

**Tech Stack:** Expo SDK 57, React Native 0.86, @rnmapbox/maps 10, Zustand, NativeWind, @resvg/resvg-js (image build), Jest + RNTL 14.

**Spec:** `docs/superpowers/specs/2026-10-13-quick-plot-design.md`

## Global Constraints

- Toolbar **UNIT · POINT · LINE · POLYGON · MEASURE · LAYERS · PLOT**; PLOT icon `target`; highlighted while quick plot is active (entry open or a temporary point shown).
- Entry: the shared `MgrsInput` (four fields), no `#`; phone keyboard; zone + square prefilled from the crosshair, focus in Easting; ⊗ "Clear grid" empties all and focuses Zone; amber **Plot** (crosshair glyph) and the Northing return key plot, only for a valid grid.
- Status: `Valid · <distance> @ <bearing> <REF> from you` (describeVector, user unit + north ref); `Valid` alone without GPS; existing error text; nothing while incomplete.
- One temporary point; a new plot replaces it. Nothing is saved unless Save unit / Save point is used (they open `unit.add` / `point.add` with `{ at: temp }`).
- Quick plot closes on: PLOT tapped again, a map tap while the entry is up, Discard, any menu opening, MEASURE starting, leaving the map.
- `MgrsInput`: Backspace in an empty Square/Easting/Northing field focuses the previous field.
- Plan decision (spec §3.3 mentioned extra padding for the bottom card): the camera simply centers the temporary point — the card sits at the bottom, so the center stays clear.
- Repo rules: `npx jest` green, `npx tsc --noEmit` clean, `npx expo lint` 0 problems; single quotes; never run prettier; Conventional Commits; **no Co-Authored-By or any other trailer in commit messages**; no hex colors outside `src/theme` (scripts may read `mapColors`).

## Review Focus

1. Plot with a partial or invalid grid (e.g. easting "253", northing "05") must do nothing — the Plot button disabled and the keyboard's Go ignored — Task 3 (entry test).
2. Save point after plotting must open Add point at exactly the temporary coordinate (not the crosshair) and the TEMP marker/card must disappear — Task 4 (MapScreen test).
3. Opening Layers / Settings / Menu or starting MEASURE while a temporary point is shown removes it and its card — Task 4.
4. Without a GPS fix the temporary point shows (reticle + TEMP) but no range line, and the status reads just "Valid" — Task 2 (features test) and Task 3 (entry test).
5. When the crosshair has no position yet (map not mounted), the entry opens with empty fields focused on Zone instead of crashing — Task 3.

---

### Task 1: MgrsInput backspace hopping and autoFocus

**Files:**
- Modify: `src/components/menu/MgrsInput.tsx`, `src/components/menu/mgrs-fields.ts` (+ `MgrsInput.test.tsx`)

**Interfaces:**
- Produces: `type MgrsField = 'zone' | 'square' | 'easting' | 'northing'`; `fieldBefore(field: MgrsField): MgrsField | null`; `MgrsInput` props `autoFocus?: 'zone' | 'easting'`.

- [ ] **Step 1: Write the failing tests** (append to `MgrsInput.test.tsx`; merge `fieldBefore` into the `./mgrs-fields` import):

```tsx
  it('knows which field backspace hops back to', () => {
    expect(fieldBefore('zone')).toBeNull();
    expect(fieldBefore('square')).toBe('zone');
    expect(fieldBefore('easting')).toBe('square');
    expect(fieldBefore('northing')).toBe('easting');
  });

  it('wires backspace on empty fields and the requested autofocus', async () => {
    await renderWithProviders(<MgrsInput value={{ ...EMPTY_MGRS, zoneBand: '18S', square: 'UJ' }} onChange={jest.fn()} status={{ status: 'incomplete' }} autoFocus="easting" />);
    expect(screen.getByLabelText('Easting')).toHaveProp('autoFocus', true);
    expect(screen.getByLabelText('MGRS zone')).toHaveProp('autoFocus', false);
    for (const label of ['100 km square', 'Easting', 'Northing']) expect(screen.getByLabelText(label).props.onKeyPress).toEqual(expect.any(Function));
    // No crash on backspace in an empty field (focus moves natively; checked on device).
    await fireEvent(screen.getByLabelText('Easting'), 'keyPress', { nativeEvent: { key: 'Backspace' } });
  });
```

- [ ] **Step 2: Run** — `npx jest src/components/menu/MgrsInput.test.tsx` → FAIL (`fieldBefore` missing, no `autoFocus`/`onKeyPress`).

- [ ] **Step 3: Implement**

`mgrs-fields.ts`:

```ts
export type MgrsField = 'zone' | 'square' | 'easting' | 'northing';
const ORDER: MgrsField[] = ['zone', 'square', 'easting', 'northing'];

/** The field Backspace in an empty field moves to (none before Zone). */
export function fieldBefore(field: MgrsField): MgrsField | null {
  const i = ORDER.indexOf(field);
  return i > 0 ? ORDER[i - 1] : null;
}
```

`MgrsInput.tsx`:
- Props add `/** Focus this field on mount (quick plot). */ autoFocus?: 'zone' | 'easting';`.
- Add `const zone = useRef<TextInput>(null);` and give the zone `TextField` `ref={zone}`.
- Helper inside the component:

```tsx
  const refs: Record<MgrsField, RefObject<TextInput | null>> = { zone, square, easting, northing };
  const fieldValue: Record<MgrsField, string> = { zone: value.zoneBand, square: value.square, easting: value.easting, northing: value.northing };
  /** Backspace in an empty field hops back to the previous one, so a whole grid can be erased in one go. */
  const hopBack = (field: MgrsField) => (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key !== 'Backspace' || fieldValue[field] !== '') return;
    const prev = fieldBefore(field);
    if (prev) refs[prev].current?.focus();
  };
```

- On the four `TextField`s add `autoFocus={autoFocus === 'zone'}` (zone) / `autoFocus={autoFocus === 'easting'}` (easting) / `autoFocus={false}` (square, northing), and `onKeyPress={hopBack('square')}` etc. on square, easting and northing (zone has none).
- Imports: `type RefObject` from react; `type NativeSyntheticEvent, type TextInputKeyPressEventData` from react-native; `fieldBefore, type MgrsField` from `./mgrs-fields`.

- [ ] **Step 4: Verify** — `npx jest src/components && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: MGRS fields hop back on backspace and can autofocus"`

---

### Task 2: Quick plot store, features, reticle image and map layer

**Files:**
- Create: `src/stores/quick-plot.ts` (+ test), `src/features/quick-plot/quick-plot-features.ts` (+ test), `src/features/map/layers/QuickPlotLayer.tsx` (+ test)
- Modify: `scripts/build-map-images.ts`, `src/features/map/images/map-images.ts` (+ `map-images.test.ts`)

**Interfaces:**
- Produces: `useQuickPlot` with `entryOpen: boolean`, `temp: LatLon | null`, `open()`, `plot(p)`, `close()`, `INITIAL_QUICK_PLOT`; `quickPlotFeatures(temp, self, rangeLabel)`; `MAP_IMAGE_IDS.tempReticle = 'temp-reticle'`; `QuickPlotLayer()`.

- [ ] **Step 1: Write the failing tests**

`src/stores/quick-plot.test.ts`:

```ts
import { INITIAL_QUICK_PLOT, useQuickPlot } from './quick-plot';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.95, lon: -77 };

beforeEach(() => useQuickPlot.setState(INITIAL_QUICK_PLOT));

describe('quick plot store', () => {
  it('opens the entry, plots one point (replacing the last) and closes', () => {
    const q = () => useQuickPlot.getState();
    q().open();
    expect(q()).toMatchObject({ entryOpen: true, temp: null });
    q().plot(A);
    expect(q()).toMatchObject({ entryOpen: false, temp: A });
    q().open();
    q().plot(B);
    expect(q().temp).toEqual(B);
    q().close();
    expect(q()).toMatchObject({ entryOpen: false, temp: null });
  });

  it('ignores invalid coordinates', () => {
    useQuickPlot.getState().plot({ lat: 99, lon: 0 });
    expect(useQuickPlot.getState().temp).toBeNull();
  });
});
```

`src/features/quick-plot/quick-plot-features.test.ts`:

```ts
import { quickPlotFeatures } from './quick-plot-features';

const T = { lat: 38.91, lon: -77 };
const ME = { lat: 38.9, lon: -77 };

describe('quickPlotFeatures', () => {
  it('draws the TEMP point, and the range line and chip only with my position', () => {
    expect(quickPlotFeatures(T, null, null).features.map((f) => f.properties.role)).toEqual(['temp']);
    const fc = quickPlotFeatures(T, ME, '1.11 km · 000°');
    expect(fc.features.map((f) => f.properties.role)).toEqual(['range', 'range-label', 'temp']);
    expect(fc.features[2].properties.label).toBe('TEMP');
    expect(fc.features[1].properties.label).toBe('1.11 km · 000°');
  });
});
```

`src/features/map/layers/QuickPlotLayer.test.tsx`:

```tsx
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { QuickPlotLayer } from './QuickPlotLayer';

jest.mock('@rnmapbox/maps');

beforeEach(() => {
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('QuickPlotLayer', () => {
  it('draws the reticle, TEMP chip and the range from me', async () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    useQuickPlot.getState().plot({ lat: 38.91, lon: -77 });
    await renderWithProviders(<QuickPlotLayer />);
    const props = mapboxMock().__props;
    const shape = props.ShapeSource['quick-plot'].shape as { features: { properties: { role: string; label?: string } }[] };
    expect(shape.features.find((f) => f.properties.role === 'range-label')!.properties.label).toBe('1.11 km · 000°');
    expect(props.LineLayer['quick-plot-range']).toBeDefined();
    for (const id of ['quick-plot-range-label', 'quick-plot-reticle', 'quick-plot-label']) expect(props.SymbolLayer[id]).toBeDefined();
    expect(props.ShapeSource['quick-plot'].onPress).toBeUndefined();
  });
});
```

`map-images.test.ts`: add `'temp-reticle'` to the existence loop alongside the line images:

```ts
    for (const name of ['line-arrow', 'line-flot-arc', 'line-vertex', 'temp-reticle']) {
```

- [ ] **Step 2: Run** — `npx jest src/stores/quick-plot.test.ts src/features/quick-plot src/features/map/layers/QuickPlotLayer.test.tsx src/features/map/images` → FAIL.

- [ ] **Step 3: Implement**

`src/stores/quick-plot.ts`:

```ts
import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

type QuickPlotValues = {
  /** The grid entry card is up. */
  entryOpen: boolean;
  /** The one temporary point on the map (never saved unless the user saves it). */
  temp: LatLon | null;
};
type QuickPlotActions = { open: () => void; plot: (p: LatLon) => void; close: () => void };

export const INITIAL_QUICK_PLOT: QuickPlotValues = { entryOpen: false, temp: null };

const valid = (p: LatLon) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** Quick plot (PLOT tool): the entry card and one temporary point. Lives only in memory. */
export const useQuickPlot = create<QuickPlotValues & QuickPlotActions>()((set) => ({
  ...INITIAL_QUICK_PLOT,
  open: () => set({ entryOpen: true }),
  plot: (p) => set(valid(p) ? { entryOpen: false, temp: p } : {}),
  close: () => set(INITIAL_QUICK_PLOT),
}));
```

`src/features/quick-plot/quick-plot-features.ts`:

```ts
import { midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

type Role = 'temp' | 'range' | 'range-label';
type Feature =
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: { role: Role; label?: string } }
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: { role: Role; label?: string } };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

/** The temporary point (TEMP chip) and, with my position, the dashed range line and its chip. */
export function quickPlotFeatures(temp: LatLon, self: LatLon | null, rangeLabel: string | null): { type: 'FeatureCollection'; features: Feature[] } {
  const features: Feature[] = [];
  if (self && rangeLabel) {
    features.push(
      { type: 'Feature', id: 'range', geometry: { type: 'LineString', coordinates: [lonLat(self), lonLat(temp)] }, properties: { role: 'range' } },
      { type: 'Feature', id: 'range-label', geometry: { type: 'Point', coordinates: lonLat(midpoint(self, temp)) }, properties: { role: 'range-label', label: rangeLabel } },
    );
  }
  features.push({ type: 'Feature', id: 'temp', geometry: { type: 'Point', coordinates: lonLat(temp) }, properties: { role: 'temp', label: 'TEMP' } });
  return { type: 'FeatureCollection', features };
}
```

`scripts/build-map-images.ts` (append):

```ts
// Quick plot temporary point: amber reticle — translucent disc, dashed ring, four ticks, center dot.
const R = 56;
const RC = R / 2;
const tick = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors['point-symbol-halo']}" stroke-width="5" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.accent}" stroke-width="2.5" stroke-linecap="round"/>`;
const reticle = `<svg xmlns="http://www.w3.org/2000/svg" width="${R}" height="${R}" viewBox="0 0 ${R} ${R}"><circle cx="${RC}" cy="${RC}" r="${RC - 2}" fill="${colors.accent}" fill-opacity="0.15" stroke="${colors.accent}" stroke-opacity="0.5" stroke-width="1.5"/><circle cx="${RC}" cy="${RC}" r="${RC - 12}" fill="none" stroke="${colors.accent}" stroke-width="2.5" stroke-dasharray="5 4"/>${tick(RC, 4, RC, 16)}${tick(RC, R - 16, RC, R - 4)}${tick(4, RC, 16, RC)}${tick(R - 16, RC, R - 4, RC)}<circle cx="${RC}" cy="${RC}" r="4" fill="${colors.text}" stroke="${colors.accent}" stroke-width="2.5"/></svg>`;
writeScaled('temp-reticle', reticle);
```

Run `npm run build:map-images`.

`map-images.ts`: `tempReticle: 'temp-reticle'` in `MAP_IMAGE_IDS` and `[MAP_IMAGE_IDS.tempReticle]: require('../../../../assets/map/temp-reticle.png')` in `MAP_IMAGES`.

`src/features/map/layers/QuickPlotLayer.tsx`:

```tsx
import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { quickPlotFeatures } from '@/features/quick-plot/quick-plot-features';
import { describeVector } from '@/lib/geo/vector';
import { usePresence } from '@/stores/presence';
import { useQuickPlot } from '@/stores/quick-plot';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { makeDraftLabelStyle, makeRangeLabelStyle, makeRangeLineStyle } from './styles';

type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const role = (r: string) => ['==', ['get', 'role'], r] as unknown as Filter;
const RETICLE_STYLE = { iconImage: MAP_IMAGE_IDS.tempReticle, iconAllowOverlap: true, iconIgnorePlacement: true } as const;

/** The quick plot temporary point: amber reticle, TEMP chip, and the range line from me. Not tappable. */
export function QuickPlotLayer() {
  const { colors } = useTheme();
  const temp = useQuickPlot((s) => s.temp);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const shape = useMemo(() => {
    if (!temp) return { type: 'FeatureCollection' as const, features: [] };
    const v = self ? describeVector(self, temp, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
    return quickPlotFeatures(temp, self, v ? `${v.distanceLabel} · ${v.bearingLabel}` : null);
  }, [temp, self, angleUnit, northRef, declinationOverrideDeg]);
  const styles = useMemo(() => ({ line: makeRangeLineStyle(colors), range: makeRangeLabelStyle(colors), label: makeDraftLabelStyle(colors) }), [colors]);

  return (
    <ShapeSource id="quick-plot" shape={shape}>
      <LineLayer id="quick-plot-range" style={styles.line} filter={role('range') as never} />
      <SymbolLayer id="quick-plot-range-label" style={styles.range} filter={role('range-label')} />
      <SymbolLayer id="quick-plot-reticle" style={RETICLE_STYLE} filter={role('temp')} />
      <SymbolLayer id="quick-plot-label" style={styles.label} filter={role('temp')} />
    </ShapeSource>
  );
}
```

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS. Read `assets/map/temp-reticle@3x.png`: amber reticle with four ticks and a white center dot.

- [ ] **Step 5: Commit** — `git add -A src scripts assets && git commit -m "feat: quick plot store, temporary point layer and reticle image"`

---

### Task 3: Entry card and temporary-point card

**Files:**
- Create: `src/features/quick-plot/QuickPlotEntry.tsx` (+ test), `src/features/quick-plot/QuickPlotCard.tsx` (+ test)

**Interfaces:**
- Consumes: `useQuickPlot`, `MgrsInput` (`autoFocus`), `mgrsFieldsFor`, `evaluateMgrsFields`, `describeVector`.
- Produces: `QuickPlotEntry({ landscape })`, `QuickPlotCard({ landscape })`.

- [ ] **Step 1: Write the failing tests**

`src/features/quick-plot/QuickPlotEntry.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { QuickPlotEntry } from './QuickPlotEntry';

const C = { lat: 38.9, lon: -77 };
const T = { lat: 38.91, lon: -77 };

beforeEach(() => {
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  useQuickPlot.getState().open();
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('QuickPlotEntry', () => {
  it('prefills zone and square from the crosshair, focuses Easting and plots only a valid grid', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    const g = mgrsFieldsFor(T);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue(g.zoneBand);
    expect(screen.getByLabelText('100 km square')).toHaveDisplayValue(g.square);
    expect(screen.getByLabelText('Easting')).toHaveDisplayValue('');
    expect(screen.getByLabelText('Easting')).toHaveProp('autoFocus', true);
    expect(screen.getByLabelText('Plot')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Easting'), '253');
    await fireEvent.changeText(screen.getByLabelText('Northing'), '05');
    expect(screen.getByLabelText('Plot')).toBeDisabled();
    await fireEvent(screen.getByLabelText('Northing'), 'submitEditing');
    expect(useQuickPlot.getState().temp).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
    await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent(/^Valid$/);
    await fireEvent.press(screen.getByLabelText('Plot'));
    expect(useQuickPlot.getState().temp!.lat).toBeCloseTo(T.lat, 4);
    expect(useQuickPlot.getState().entryOpen).toBe(false);
  });

  it('shows range and bearing from me, and clears to Zone', async () => {
    useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
    usePresence.getState().setSelfPosition({ position: C, accuracyM: 5, timestamp: 1 });
    await renderWithProviders(<QuickPlotEntry landscape />);
    const g = mgrsFieldsFor(T);
    await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
    await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Valid · 1.11 km @ 000° TRUE from you');
    await fireEvent.press(screen.getByLabelText('Clear grid'));
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue('');
    expect(screen.getByLabelText('MGRS zone')).toHaveProp('autoFocus', true);
  });

  it('opens empty on Zone when the crosshair has no position yet', async () => {
    await renderWithProviders(<QuickPlotEntry landscape={false} />);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue('');
    expect(screen.getByLabelText('MGRS zone')).toHaveProp('autoFocus', true);
  });
});
```

`src/features/quick-plot/QuickPlotCard.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { INITIAL_QUICK_PLOT, useQuickPlot } from '@/stores/quick-plot';
import { renderWithProviders } from '@/test-utils/render';

import { QuickPlotCard } from './QuickPlotCard';

const T = { lat: 38.91, lon: -77 };

beforeEach(() => {
  useQuickPlot.setState(INITIAL_QUICK_PLOT);
  useMenu.setState(INITIAL_MENU);
  useQuickPlot.getState().plot(T);
});

describe('QuickPlotCard', () => {
  it('shows the grid and discards', async () => {
    await renderWithProviders(<QuickPlotCard landscape={false} />);
    expect(screen.getByText(formatCoordinate(T, 'mgrs'))).toBeTruthy();
    expect(screen.getByText('TEMP')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Discard'));
    expect(useQuickPlot.getState().temp).toBeNull();
  });

  it.each([
    ['Save unit', 'unit.add'],
    ['Save point', 'point.add'],
  ] as const)('%s opens %s at the temporary point and ends quick plot', async (label, id) => {
    await renderWithProviders(<QuickPlotCard landscape />);
    await fireEvent.press(screen.getByLabelText(label));
    expect(useMenu.getState().stack).toEqual([{ id, params: { at: T } }]);
    expect(useQuickPlot.getState().temp).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `npx jest src/features/quick-plot` → FAIL (missing modules).

- [ ] **Step 3: Implement**

`src/features/quick-plot/QuickPlotEntry.tsx`:

```tsx
import { useState } from 'react';
import { Keyboard, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { MapButton } from '@/features/map/controls/MapButton';
import { EDGE, GAP, TOOLBAR_HEIGHT } from '@/features/map/layout';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { describeVector } from '@/lib/geo/vector';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useQuickPlot } from '@/stores/quick-plot';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

const LANDSCAPE_WIDTH = 520;

/** Zone and 100 km square of the crosshair (most quick plots are nearby); empty before the map has a center. */
function prefill(): MgrsParts {
  const center = useInteraction.getState().cameraCenter;
  if (!center) return EMPTY_MGRS;
  const f = mgrsFieldsFor(center);
  return { ...EMPTY_MGRS, zoneBand: f.zoneBand, square: f.square };
}

/** Quick plot grid entry: centered under the toolbar (above the keyboard), four MGRS fields and Plot. */
export function QuickPlotEntry({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [parts, setParts] = useState<MgrsParts>(prefill);
  // Bumped by Clear: remounts the fields so Zone takes focus.
  const [generation, setGeneration] = useState(0);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const status = evaluateMgrsFields(parts);
  const v = status.status === 'valid' && self ? describeVector(self, status.coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
  const validDetail = v ? `${v.distanceLabel} @ ${v.bearingLabel} ${v.refLabel} from you` : undefined;
  const full = width - insets.left - insets.right - 2 * EDGE;
  const cardWidth = landscape ? Math.min(LANDSCAPE_WIDTH, full) : full;
  const valid = status.status === 'valid';

  const plot = () => {
    if (status.status !== 'valid') return;
    Keyboard.dismiss();
    useQuickPlot.getState().plot(status.coord);
  };
  const clear = () => {
    setParts(EMPTY_MGRS);
    setGeneration((g) => g + 1);
  };

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP }}>
      <View testID="quick-plot-entry" style={{ width: cardWidth }} className="gap-2 rounded-2xl border border-border bg-surface-chrome p-3">
        <View className="flex-row items-start gap-1">
          <View className="flex-1">
            <MgrsInput
              key={generation}
              value={parts}
              onChange={setParts}
              status={status}
              validDetail={validDetail}
              onSubmit={plot}
              autoFocus={generation === 0 && parts.square ? 'easting' : 'zone'}
            />
          </View>
          <MapButton grouped label="Clear grid" icon="close-circle-outline" onPress={clear} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Plot"
          accessibilityState={{ disabled: !valid }}
          disabled={!valid}
          onPress={plot}
          className={`h-12 flex-row items-center justify-center gap-2 rounded-xl bg-accent ${valid ? '' : 'opacity-40'}`}>
          <CrosshairGlyph size={20} color={colors['on-accent']} />
          <Text className="text-lg font-bold text-on-accent">Plot</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

(If `text-on-accent` is not a registered Tailwind color, use `style={{ color: colors['on-accent'] }}` on the Text instead.)

`src/features/quick-plot/QuickPlotCard.tsx`:

```tsx
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { EDGE } from '@/features/map/layout';
import { useMenu } from '@/stores/menu';
import { useQuickPlot } from '@/stores/quick-plot';
import { useTheme } from '@/theme/ThemeProvider';

const LANDSCAPE_WIDTH = 720;

/** Bottom card for the temporary point: TEMP + grid, Discard, Save unit, Save point. */
export function QuickPlotCard({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const temp = useQuickPlot((s) => s.temp);
  if (!temp) return null;
  const full = width - insets.left - insets.right - 2 * EDGE;
  const cardWidth = landscape ? Math.min(LANDSCAPE_WIDTH, full) : full;

  const save = (id: 'unit.add' | 'point.add') => {
    useQuickPlot.getState().close();
    useMenu.getState().openMenu(id, { at: temp });
  };

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ bottom: insets.bottom + EDGE }}>
      <View testID="quick-plot-card" style={{ width: cardWidth }} className="gap-3 rounded-2xl border border-accent bg-surface-chrome p-3">
        <View className="flex-row items-center gap-3">
          <View className="rounded-md border border-accent px-2 py-0.5">
            <Text className="text-xs font-bold tracking-widest text-accent">TEMP</Text>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit className="shrink font-mono text-xl font-semibold text-text">
            {formatCoordinate(temp, 'mgrs')}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <MenuButton label="Discard" icon="trash-can-outline" onPress={() => useQuickPlot.getState().close()} />
          </View>
          <View className="flex-1">
            <MenuButton label="Save unit" icon="rhombus-outline" active onPress={() => save('unit.add')} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save point"
            onPress={() => save('point.add')}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3">
            <Icon name="map-marker-outline" size={18} color={colors['on-accent']} />
            <Text style={{ color: colors['on-accent'] }} className="font-semibold">
              Save point
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Verify** — `npx jest src/features/quick-plot && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: quick plot entry card and temporary-point card"`

---

### Task 4: PLOT tool and map wiring

**Files:**
- Modify: `src/features/toolbar/Toolbar.tsx` (+ test), `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces: `ToolId` adds `'plot'`; Toolbar `onPlot`.

- [ ] **Step 1: Write the failing tests**

Toolbar test:

```tsx
  it('ends with PLOT after LAYERS and marks it active', async () => {
    const onPlot = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="plot" onLayers={jest.fn()} onPlot={onPlot} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.filter((l) => ['LAYERS', 'PLOT'].includes(l))).toEqual(['LAYERS', 'PLOT']);
    expect(screen.getByLabelText('PLOT')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('PLOT'));
    expect(onPlot).toHaveBeenCalled();
  });
```

`MapScreen.test.tsx` (reset `useQuickPlot.setState(INITIAL_QUICK_PLOT)` in the file's `beforeEach`; add before `describe('measure'…)`):

```tsx
  describe('quick plot', () => {
    async function openMap() {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.9, lon: -77 }, zoom: 14, bearing: 0 }));
    }
    const plotGrid = async (p: { lat: number; lon: number }) => {
      const g = mgrsFieldsFor(p);
      await fireEvent.changeText(screen.getByLabelText('Easting'), g.easting);
      await fireEvent.changeText(screen.getByLabelText('Northing'), g.northing);
      await fireEvent.press(screen.getByLabelText('Plot'));
    };

    it('PLOT closes a menu, plots a temporary point, moves the map, and Save point opens Add point there', async () => {
      await openMap();
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      await fireEvent.press(screen.getByLabelText('PLOT'));
      expect(useMenu.getState().stack).toEqual([]);
      expect(screen.getByTestId('quick-plot-entry')).toBeTruthy();
      expect(screen.getByLabelText('PLOT')).toBeSelected();
      mapboxMock().__camera.setCamera.mockClear();
      await plotGrid({ lat: 38.91, lon: -77 });
      expect(screen.queryByTestId('quick-plot-entry')).toBeNull();
      expect(screen.getByTestId('quick-plot-card')).toBeTruthy();
      const temp = useQuickPlot.getState().temp!;
      const moved = mapboxMock().__camera.setCamera.mock.calls.map((c) => (c[0] as { centerCoordinate?: number[] }).centerCoordinate);
      expect(moved).toContainEqual([temp.lon, temp.lat]);
      await fireEvent.press(screen.getByLabelText('Save point'));
      await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'point.add', params: { at: temp } }]));
      expect(useDraft.getState().coord).toEqual(temp);
      expect(screen.queryByTestId('quick-plot-card')).toBeNull();
    });

    it('ends on a map tap while entering, and when Layers opens or MEASURE starts', async () => {
      await openMap();
      await fireEvent.press(screen.getByLabelText('PLOT'));
      await act(async () =>
        (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77, 38.9] }, properties: {} }),
      );
      expect(screen.queryByTestId('quick-plot-entry')).toBeNull();
      await fireEvent.press(screen.getByLabelText('PLOT'));
      await plotGrid({ lat: 38.91, lon: -77 });
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      expect(useQuickPlot.getState().temp).toBeNull();
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      await fireEvent.press(screen.getByLabelText('PLOT'));
      await plotGrid({ lat: 38.91, lon: -77 });
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      expect(useQuickPlot.getState().temp).toBeNull();
      expect(screen.queryByTestId('quick-plot-card')).toBeNull();
    });
  });
```

(imports: `mgrsFieldsFor` from `@/components/menu/mgrs-fields`, `INITIAL_QUICK_PLOT, useQuickPlot` from `@/stores/quick-plot`.)

- [ ] **Step 2: Run** — `npx jest src/features/toolbar src/features/map/MapScreen.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

Toolbar: `ToolId` adds `'plot'`; prop `onPlot?: () => void`; `<ToolButton icon="target" label="PLOT" active={activeTool === 'plot'} onPress={onPlot} />` after LAYERS.

`MissionMap.tsx`:

```tsx
  const plotEntryOpen = useQuickPlot((s) => s.entryOpen);
  const plotTemp = useQuickPlot((s) => s.temp);
  const quickPlotting = plotEntryOpen || plotTemp !== null;
```

- In the existing `useMenu.subscribe` effect (which stops measuring when a menu opens), also `useQuickPlot.getState().close()` under the same condition (`state.stack.length > 0 && state.stack !== prev.stack`), checking `entryOpen || temp` first.
- Unmount cleanup: `useEffect(() => () => useQuickPlot.getState().close(), []);`
- `toggleMeasure` else-branch: add `useQuickPlot.getState().close();` before `startMeasure()`.
- New:

```tsx
  const toggleQuickPlot = () => {
    const q = useQuickPlot.getState();
    if (q.entryOpen || q.temp) q.close();
    else {
      useMenu.getState().closeMenu();
      useMeasure.getState().stopMeasure();
      q.open();
    }
  };
  // A new temporary point: ease the map to it (the bottom card leaves the center clear).
  useEffect(
    () =>
      useQuickPlot.subscribe((state, prev) => {
        if (!state.temp || state.temp === prev.temp) return;
        markMoved();
        if (useInteraction.getState().followMode) setFollowMode(false);
        followTarget.current = state.temp;
        moveCamera({ centerCoordinate: [state.temp.lon, state.temp.lat], ...EASE, animationDuration: 400 });
      }),
    [markMoved, setFollowMode, moveCamera],
  );
```

- `onMapPress`: first line `if (useQuickPlot.getState().entryOpen) { Keyboard.dismiss(); useQuickPlot.getState().close(); return; }` (import `Keyboard` from react-native).
- Render: `{plotTemp ? <QuickPlotLayer /> : null}` inside `<MapCanvas>` after `<MeasureLayer …/>`; after `<MapControls …/>`: `{plotEntryOpen ? <QuickPlotEntry landscape={landscape} /> : null}` and `{plotTemp && !plotEntryOpen ? <QuickPlotCard landscape={landscape} /> : null}`; hide the bottom-left readouts under the card: `{panel || plotTemp ? null : <MapBottomLeft />}`.
- Toolbar: `activeTool={quickPlotting ? 'plot' : measuring ? 'measure' : …}`, `onPlot={toggleQuickPlot}`.

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: PLOT tool for quick temporary grid plots"`

---

### Task 5: Docs and device checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md`, `.agents/skills/menus/SKILL.md`, `docs/superpowers/notes/2026-10-12-native-gate.md`

- [ ] **Step 1: Architecture spec** — after §5.4d add:

```markdown
### 5.4e Quick plot
PLOT is a map mode like MEASURE (not a menu, never stored): `stores/quick-plot.ts` holds the entry
state and one temporary point; `QuickPlotEntry` (four MGRS fields under the toolbar),
`QuickPlotLayer` and `QuickPlotCard` (Discard / Save unit / Save point → the Add menus at that
spot). See `2026-10-13-quick-plot-design.md`.
```

- [ ] **Step 2: menus skill** — next to the "Measure is not a menu" convention add: `- **Quick plot is not a menu either.** PLOT closes the open menu; any menu opening ends quick plot. Save unit / Save point hand over with openMenu('unit.add' | 'point.add', { at }).`; and under `MgrsInput` mention: "Backspace in an empty field hops to the previous one."

- [ ] **Step 3: Gate notes** — after the last row add:

```markdown
| 81 | Toolbar ends with PLOT (target icon); PLOT closes an open panel and shows the entry card centered under the toolbar, above the keyboard, in portrait and landscape | PENDING |
| 82 | Entry opens with the map's zone and square filled and the cursor in Easting; backspace in an empty field hops back (also in the Unit/Point/Line/Polygon menus); ⊗ clears to Zone | PENDING |
| 83 | Status shows "Valid · distance @ bearing REF from you"; Plot and the keyboard's Go plot only a full valid grid; the map eases to the amber TEMP reticle with the dashed range line from me | PENDING |
| 84 | TEMP card: Discard removes it; Save unit / Save point open Add unit / Add point at that grid; plotting again replaces the temporary point | PENDING |
| 85 | Quick plot ends on PLOT again, a map tap while entering, opening Layers/Menu/Settings, or MEASURE | PENDING |
```

- [ ] **Step 4: Verify and commit** — `npx expo lint` → 0 problems; `git add -A docs .agents && git commit -m "docs: quick plot in the spec, skills and device checklist"`
