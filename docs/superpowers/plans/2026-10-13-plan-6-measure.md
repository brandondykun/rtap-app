# Measure Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A MEASURE toolbar mode that shows distance and direction between a start and an end point set by map tap, crosshair (**Set**) or **From me**, snapping to units, points and the user's own marker.

**Architecture:** A pure step module decides what a tap / Set / From me does; a small `measure` Zustand store holds `active`, `start`, `end` (null = live at the crosshair). `MeasureLayer` draws the line, dots and chip; `MeasureCard` (in the top-left stack) shows the readout and buttons. `MissionMap` toggles the mode, routes taps to it ahead of everything else, and turns it off whenever a menu opens.

**Tech Stack:** Expo SDK 57, React Native 0.86, @rnmapbox/maps 10, Zustand, NativeWind, Jest + RNTL 14.

**Spec:** `docs/superpowers/specs/2026-10-13-measure-design.md`

## Global Constraints

- Toolbar **UNIT · POINT · LINE · MEASURE · LAYERS**; MEASURE icon `ruler`; highlighted while on.
- Steps exactly as spec §3.2: no start → start; otherwise → end. From me always sets the start. Restart clears both.
- Readout text `"<distanceLabel> · <bearingLabel> <refLabel>"` from `describeVector` with the user's `angleUnit`, `northRef`, `declinationOverrideDeg`; **Set start** when there is no start.
- Snaps: units/points (their stored coordinate) and the self marker (the self position). Lines do not snap.
- Nothing is saved. Turning on closes menus; any menu opening turns it off; long-press does nothing while on.
- Line: `point-symbol-halo` halo under a 3 pt `accent` line, dashed `[2, 1.5]` while the end is live.
- Accessibility labels: "MEASURE", "From me", "Restart", "Stop measuring", "Set at crosshair".
- Repo rules: `npx jest` green, `npx tsc --noEmit` clean, `npx expo lint` 0 problems; single quotes; never run prettier; Conventional Commits; **no Co-Authored-By or any other trailer in commit messages**; no hex colors outside `src/theme`.

## Review Focus

1. A tap on a unit while measuring must snap to the unit's stored coordinate (not the tap point) and must not open the unit's menu — Task 4 (MapScreen test, tap offset from the unit).
2. Opening any menu (Layers, Settings, Menu, another tool) while measuring turns measuring off and the card/line disappear — Task 4.
3. With no GPS fix, From me is disabled and a self-marker tap cannot happen (no marker) — Task 3 (card test).
4. The live end follows the camera: moving the camera changes the readout and the line end until a tap fixes it — Task 2 (layer test) and Task 4.
5. Start and end at the same place (zero distance) reads `0 m · — <REF>` without crashing — Task 1 (readout test).

---

### Task 1: Measure rules, store and readout

**Files:**
- Create: `src/features/measure/measure-step.ts` (+ `.test.ts`), `src/features/measure/measure-readout.ts` (+ `.test.ts`), `src/stores/measure.ts` (+ `.test.ts`)

**Interfaces:**
- Produces:
  - `type Measure = { start: LatLon | null; end: LatLon | null }`
  - `placePoint(m: Measure, p: LatLon): Measure`, `fromMe(m: Measure, g: LatLon): Measure`, `EMPTY_MEASURE: Measure`
  - `measureReadout(from: LatLon, to: LatLon, s: { angleUnit: AngleUnit; northRef: NorthRef; declinationOverrideDeg: number | null }, date?: Date): string`
  - store `useMeasure` with values `active: boolean`, `start`, `end`; actions `startMeasure()`, `stopMeasure()`, `place(p)`, `setFromMe(g)`, `restart()`; `INITIAL_MEASURE`.

- [ ] **Step 1: Write the failing tests**

`src/features/measure/measure-step.test.ts`:

```ts
import { EMPTY_MEASURE, fromMe, placePoint } from './measure-step';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };
const C = { lat: 38.92, lon: -77 };

describe('measure steps', () => {
  it('sets the start first, then the end, then moves the end', () => {
    const one = placePoint(EMPTY_MEASURE, A);
    expect(one).toEqual({ start: A, end: null });
    const two = placePoint(one, B);
    expect(two).toEqual({ start: A, end: B });
    expect(placePoint(two, C)).toEqual({ start: A, end: C });
  });

  it('From me always sets the start and keeps the end', () => {
    expect(fromMe(EMPTY_MEASURE, A)).toEqual({ start: A, end: null });
    expect(fromMe({ start: B, end: C }, A)).toEqual({ start: A, end: C });
  });
});
```

`src/features/measure/measure-readout.test.ts`:

```ts
import { measureReadout } from './measure-readout';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };
const date = new Date('2026-10-13T00:00:00Z');

describe('measureReadout', () => {
  it('formats distance and bearing in the user unit and north reference', () => {
    expect(measureReadout(A, B, { angleUnit: 'deg', northRef: 'true', declinationOverrideDeg: null }, date)).toBe('1.11 km · 000° TRUE');
    expect(measureReadout(A, B, { angleUnit: 'mil', northRef: 'true', declinationOverrideDeg: null }, date)).toBe('1.11 km · 0000 mils TRUE');
  });

  it('reads a zero-length measurement without a bearing', () => {
    expect(measureReadout(A, A, { angleUnit: 'deg', northRef: 'grid', declinationOverrideDeg: null }, date)).toBe('0 m · — GRID');
  });
});
```

`src/stores/measure.test.ts`:

```ts
import { INITIAL_MEASURE, useMeasure } from './measure';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };

beforeEach(() => useMeasure.setState(INITIAL_MEASURE));

describe('measure store', () => {
  it('starts empty, places points and stops clearing everything', () => {
    const m = () => useMeasure.getState();
    m().startMeasure();
    expect(m()).toMatchObject({ active: true, start: null, end: null });
    m().place(A);
    m().place(B);
    expect(m()).toMatchObject({ start: A, end: B });
    m().restart();
    expect(m()).toMatchObject({ active: true, start: null, end: null });
    m().setFromMe(A);
    m().stopMeasure();
    expect(m()).toMatchObject({ active: false, start: null, end: null });
  });

  it('ignores points while off and invalid points always', () => {
    useMeasure.getState().place(A);
    expect(useMeasure.getState().start).toBeNull();
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 99, lon: 0 });
    expect(useMeasure.getState().start).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/measure src/stores/measure.test.ts` → FAIL (missing modules).

- [ ] **Step 3: Implement**

`src/features/measure/measure-step.ts`:

```ts
import type { LatLon } from '@/lib/geo/types';

/** A measurement: the start, and the end (null = following the crosshair). */
export type Measure = { start: LatLon | null; end: LatLon | null };

export const EMPTY_MEASURE: Measure = { start: null, end: null };

/** A tap, snap or Set: the first point is the start; every later one sets (or moves) the end. */
export function placePoint(m: Measure, p: LatLon): Measure {
  return m.start === null ? { start: p, end: null } : { start: m.start, end: p };
}

/** From me: the start is always the user's position; the end stays. */
export function fromMe(m: Measure, g: LatLon): Measure {
  return { start: g, end: m.end };
}
```

`src/features/measure/measure-readout.ts`:

```ts
import type { AngleUnit, LatLon, NorthRef } from '@/lib/geo/types';
import { describeVector } from '@/lib/geo/vector';

type ReadoutSettings = { angleUnit: AngleUnit; northRef: NorthRef; declinationOverrideDeg: number | null };

/** "1.29 km · 039° GRID": the same range/bearing text as every other readout. */
export function measureReadout(from: LatLon, to: LatLon, s: ReadoutSettings, date = new Date()): string {
  const v = describeVector(from, to, { date, declinationOverrideDeg: s.declinationOverrideDeg, unit: s.angleUnit, ref: s.northRef });
  return `${v.distanceLabel} · ${v.bearingLabel} ${v.refLabel}`;
}
```

`src/stores/measure.ts`:

```ts
import { create } from 'zustand';

import { EMPTY_MEASURE, fromMe, placePoint, type Measure } from '@/features/measure/measure-step';
import type { LatLon } from '@/lib/geo/types';

type MeasureValues = Measure & { active: boolean };
type MeasureActions = {
  startMeasure: () => void;
  stopMeasure: () => void;
  place: (p: LatLon) => void;
  setFromMe: (g: LatLon) => void;
  restart: () => void;
};

export const INITIAL_MEASURE: MeasureValues = { active: false, ...EMPTY_MEASURE };

const valid = (p: LatLon) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** The measure tool (never saved): on/off and the two points. */
export const useMeasure = create<MeasureValues & MeasureActions>()((set) => ({
  ...INITIAL_MEASURE,
  startMeasure: () => set({ active: true, ...EMPTY_MEASURE }),
  stopMeasure: () => set(INITIAL_MEASURE),
  place: (p) => set((s) => (s.active && valid(p) ? placePoint(s, p) : {})),
  setFromMe: (g) => set((s) => (s.active && valid(g) ? fromMe(s, g) : {})),
  restart: () => set((s) => (s.active ? EMPTY_MEASURE : {})),
}));
```

- [ ] **Step 4: Verify** — `npx jest src/features/measure src/stores/measure.test.ts && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: measure steps, readout and store"`

---

### Task 2: Measure map layer

**Files:**
- Create: `src/features/measure/measure-features.ts` (+ `.test.ts`), `src/features/map/layers/MeasureLayer.tsx` (+ `.test.tsx`)
- Modify: `src/features/map/layers/styles.ts` (`makeMeasureChipStyle`), `src/features/map/MissionMap.tsx` (render the layer)

**Interfaces:**
- Consumes: `useMeasure`, `measureReadout`, `useInteraction.cameraCenter`, `useSettings`.
- Produces: `measureFeatures(start: LatLon | null, end: LatLon | null, label: string, live: boolean): FeatureCollection` with roles `'line' | 'dot' | 'chip'` (line carries `live: boolean`); `MeasureLayer()`; `makeMeasureChipStyle(colors)`.

- [ ] **Step 1: Write the failing tests**

`src/features/measure/measure-features.test.ts`:

```ts
import { measureFeatures } from './measure-features';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.91, lon: -77 };

describe('measureFeatures', () => {
  it('draws nothing without a start, only the start dot without an end', () => {
    expect(measureFeatures(null, B, 'x', false).features).toEqual([]);
    expect(measureFeatures(A, null, 'x', true).features.map((f) => f.properties.role)).toEqual(['dot']);
  });

  it('draws the line, both dots and the chip at the midpoint', () => {
    const fc = measureFeatures(A, B, '1.11 km · 000° TRUE', true);
    expect(fc.features.map((f) => f.properties.role)).toEqual(['line', 'dot', 'dot', 'chip']);
    expect(fc.features[0].properties.live).toBe(true);
    const chip = fc.features[3];
    expect(chip.properties.label).toBe('1.11 km · 000° TRUE');
    expect((chip.geometry.coordinates as number[])[1]).toBeCloseTo(38.905, 3);
  });
});
```

`src/features/map/layers/MeasureLayer.test.tsx`:

```tsx
import { act } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { MeasureLayer } from './MeasureLayer';

jest.mock('@rnmapbox/maps');

type Shape = { features: { properties: { role: string; label?: string; live?: boolean }; geometry: { coordinates: unknown } }[] };
const shape = () => mapboxMock().__props.ShapeSource.measure.shape as Shape;

beforeEach(() => {
  useMeasure.setState(INITIAL_MEASURE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
});

describe('MeasureLayer', () => {
  it('follows the camera with a live, dashed end until the end is fixed', async () => {
    useMeasure.getState().startMeasure();
    useMeasure.getState().place({ lat: 38.9, lon: -77 });
    useInteraction.getState().setCamera({ center: { lat: 38.91, lon: -77 }, zoom: 14, bearing: 0 });
    await renderWithProviders(<MeasureLayer />);
    expect(shape().features.find((f) => f.properties.role === 'line')!.properties.live).toBe(true);
    expect(shape().features.find((f) => f.properties.role === 'chip')!.properties.label).toBe('1.11 km · 000° TRUE');
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.92, lon: -77 }, zoom: 14, bearing: 0 }));
    expect(shape().features.find((f) => f.properties.role === 'chip')!.properties.label).toMatch(/^2\.2\d km/);
    await act(async () => useMeasure.getState().place({ lat: 38.91, lon: -77 }));
    expect(shape().features.find((f) => f.properties.role === 'line')!.properties.live).toBe(false);
    const props = mapboxMock().__props;
    for (const id of ['measure-halo', 'measure-solid', 'measure-dashed']) expect(props.LineLayer[id]).toBeDefined();
    for (const id of ['measure-dots', 'measure-chip']) expect(props.SymbolLayer[id]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/measure src/features/map/layers/MeasureLayer.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`src/features/measure/measure-features.ts`:

```ts
import { midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

type Props = { role: 'line' | 'dot' | 'chip'; live?: boolean; label?: string };
type Feature =
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: Props }
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Props };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

/** The measure line (live = end still following the crosshair), its two dots and the readout chip. */
export function measureFeatures(start: LatLon | null, end: LatLon | null, label: string, live: boolean): { type: 'FeatureCollection'; features: Feature[] } {
  if (!start) return { type: 'FeatureCollection', features: [] };
  if (!end) return { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'start', geometry: { type: 'Point', coordinates: lonLat(start) }, properties: { role: 'dot' } }] };
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'line', geometry: { type: 'LineString', coordinates: [lonLat(start), lonLat(end)] }, properties: { role: 'line', live } },
      { type: 'Feature', id: 'start', geometry: { type: 'Point', coordinates: lonLat(start) }, properties: { role: 'dot' } },
      { type: 'Feature', id: 'end', geometry: { type: 'Point', coordinates: lonLat(end) }, properties: { role: 'dot' } },
      { type: 'Feature', id: 'chip', geometry: { type: 'Point', coordinates: lonLat(midpoint(start, end)) }, properties: { role: 'chip', label } },
    ],
  };
}
```

In `styles.ts` add:

```ts
/** Measure readout chip: dark text on an amber chip at the line's midpoint. */
export function makeMeasureChipStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return {
    textField: ['get', 'label'],
    textFont: MAP_LABEL_FONT,
    textSize: 13,
    textColor: colors['on-accent'],
    iconImage: MAP_IMAGE_IDS.labelChipAccent,
    iconTextFit: 'both',
    iconTextFitPadding: LABEL_CHIP_PADDING,
    textAllowOverlap: true,
    iconAllowOverlap: true,
  };
}
```

`src/features/map/layers/MeasureLayer.tsx`:

```tsx
import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { measureFeatures } from '@/features/measure/measure-features';
import { measureReadout } from '@/features/measure/measure-readout';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { LINE_DASH, makeLineHaloStyle, makeMeasureChipStyle } from './styles';

type Filter = ComponentProps<typeof LineLayer>['filter'];
const LINE = ['==', ['get', 'role'], 'line'] as unknown as Filter;
const LIVE = ['all', ['==', ['get', 'role'], 'line'], ['==', ['get', 'live'], true]] as unknown as Filter;
const FIXED = ['all', ['==', ['get', 'role'], 'line'], ['==', ['get', 'live'], false]] as unknown as Filter;
const DOTS = ['==', ['get', 'role'], 'dot'] as unknown as Filter;
const CHIP = ['==', ['get', 'role'], 'chip'] as unknown as Filter;
const DOT_STYLE = { iconImage: MAP_IMAGE_IDS.lineVertex, iconSize: 0.7, iconAllowOverlap: true, iconIgnorePlacement: true } as const;

/** The measure line from start to end (or to the crosshair while the end is live). */
export function MeasureLayer() {
  const { colors } = useTheme();
  const start = useMeasure((s) => s.start);
  const fixedEnd = useMeasure((s) => s.end);
  const center = useInteraction((s) => s.cameraCenter);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const end = fixedEnd ?? center;
  const shape = useMemo(() => {
    const label = start && end ? measureReadout(start, end, { angleUnit, northRef, declinationOverrideDeg }) : '';
    return measureFeatures(start, end, label, fixedEnd === null);
  }, [start, end, fixedEnd, angleUnit, northRef, declinationOverrideDeg]);
  const styles = useMemo(() => {
    // Measure is drawn in amber over the same dark halo as lines (halo uses the normal 3 pt width).
    const line = { lineColor: colors.accent, lineWidth: 3, lineCap: 'round' as const, lineJoin: 'round' as const };
    return { halo: makeLineHaloStyle(colors), solid: line, dashed: { ...line, lineCap: 'butt' as const, lineDasharray: LINE_DASH }, chip: makeMeasureChipStyle(colors) };
  }, [colors]);

  return (
    <ShapeSource id="measure" shape={shape}>
      <LineLayer id="measure-halo" style={styles.halo} filter={LINE} />
      <LineLayer id="measure-solid" style={styles.solid} filter={FIXED} />
      <LineLayer id="measure-dashed" style={styles.dashed} filter={LIVE} />
      <SymbolLayer id="measure-dots" style={DOT_STYLE} filter={DOTS} />
      <SymbolLayer id="measure-chip" style={styles.chip} filter={CHIP} />
    </ShapeSource>
  );
}
```

(`makeLineHaloStyle` reads `['get', 'width']`; measure features have no `width`, so the `match` falls back to normal = 3 → halo 5. That is intended.)

`MissionMap.tsx`: `const measuring = useMeasure((s) => s.active);` and inside `<MapCanvas>`, after `<DraftLineLayer …/>` and before `<SelfLayer />`: `{measuring ? <MeasureLayer /> : null}`.

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: measure line, dots and readout chip on the map"`

---

### Task 3: Measure card

**Files:**
- Create: `src/features/measure/MeasureCard.tsx` (+ `.test.tsx`)
- Modify: `src/features/map/controls/MapTopLeft.tsx` (render the card while measuring, above the banner)

**Interfaces:**
- Consumes: `useMeasure`, `measureReadout`, `useInteraction.cameraCenter`, `usePresence.selfPosition`, `useSettings`.
- Produces: `MeasureCard()` (no props).

- [ ] **Step 1: Write the failing test** — `src/features/measure/MeasureCard.test.tsx`:

```tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MEASURE, useMeasure } from '@/stores/measure';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { MeasureCard } from './MeasureCard';

const C = { lat: 38.91, lon: -77 };

beforeEach(() => {
  useMeasure.setState(INITIAL_MEASURE);
  usePresence.setState(INITIAL_PRESENCE);
  useInteraction.setState(INITIAL_INTERACTION);
  useSettings.setState({ ...DEFAULT_SETTINGS, northRef: 'true' });
  useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
  useMeasure.getState().startMeasure();
});

describe('MeasureCard', () => {
  it('asks for a start, then sets points at the crosshair and shows the readout', async () => {
    await renderWithProviders(<MeasureCard />);
    expect(screen.getByText('Set start')).toBeTruthy();
    expect(screen.getByLabelText('From me')).toBeDisabled();
    expect(screen.getByLabelText('Restart')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Set at crosshair'));
    expect(useMeasure.getState().start).toEqual(C);
    expect(screen.getByText('0 m · — TRUE')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Restart'));
    expect(useMeasure.getState().start).toBeNull();
  });

  it('measures from the user and stops', async () => {
    usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 });
    await renderWithProviders(<MeasureCard />);
    await fireEvent.press(screen.getByLabelText('From me'));
    expect(screen.getByText('1.11 km · 000° TRUE')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Stop measuring'));
    expect(useMeasure.getState().active).toBe(false);
  });
});
```

- [ ] **Step 2: Run** — `npx jest src/features/measure/MeasureCard.test.tsx` → FAIL (missing module).

- [ ] **Step 3: Implement** — `src/features/measure/MeasureCard.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { measureReadout } from './measure-readout';

/** Top-left while measuring: the readout, From me, Restart, Stop (×) and the amber Set. */
export function MeasureCard() {
  const { colors } = useTheme();
  const start = useMeasure((s) => s.start);
  const end = useMeasure((s) => s.end);
  const center = useInteraction((s) => s.cameraCenter);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const to = end ?? center;
  const readout = start && to ? measureReadout(start, to, { angleUnit, northRef, declinationOverrideDeg }) : 'Set start';

  const setAtCrosshair = () => {
    const c = useInteraction.getState().cameraCenter;
    if (c) useMeasure.getState().place(c);
  };

  return (
    <View testID="measure-card" className="gap-2 self-start rounded-2xl border border-accent bg-surface-chrome p-3">
      <Text className="text-xs font-bold uppercase tracking-widest text-accent">Measure</Text>
      <Text className="font-mono text-2xl font-semibold text-text">{readout}</Text>
      <View className="flex-row items-center gap-2">
        <MenuButton label="From me" icon="crosshairs-gps" onPress={() => self && useMeasure.getState().setFromMe(self)} disabled={!self} />
        <MenuButton label="Restart" icon="restore" iconOnly onPress={() => useMeasure.getState().restart()} disabled={!start} />
        <MenuButton label="Stop measuring" icon="close" iconOnly onPress={() => useMeasure.getState().stopMeasure()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set at crosshair"
          onPress={setAtCrosshair}
          className="h-12 w-14 items-center justify-center rounded-xl bg-accent">
          <CrosshairGlyph size={22} color={colors['on-accent']} />
        </Pressable>
      </View>
    </View>
  );
}
```

`MapTopLeft.tsx`: import `MeasureCard` and `useMeasure`; `const measuring = useMeasure((s) => s.active);` and render `{measuring ? <MeasureCard /> : null}` as the first child of the stack (the banner follows; it hides while a panel is open, and measuring never has one).

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: measure card with From me, Restart, Stop and Set"`

---

### Task 4: MEASURE tool and map routing

**Files:**
- Modify: `src/features/toolbar/Toolbar.tsx` (+ test), `src/features/map/layers/PointsLayer.tsx` (+ test), `src/features/map/layers/SelfLayer.tsx`, `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: `useMeasure`.
- Produces: `ToolId` adds `'measure'`; Toolbar `onMeasure`; `PointsLayer` `onItemPress(id, at, item, itemAt: LatLon | null)` — `itemAt` is the tapped symbol's stored coordinate; `SelfLayer({ onPress?: (at: LatLon) => void })`.

- [ ] **Step 1: Write the failing tests**

Toolbar test (add):

```tsx
  it('orders UNIT, POINT, LINE, MEASURE, LAYERS and marks MEASURE active', async () => {
    const onMeasure = jest.fn();
    await renderWithProviders(<Toolbar landscape={false} activeTool="measure" onUnit={jest.fn()} onPoint={jest.fn()} onLine={jest.fn()} onMeasure={onMeasure} onLayers={jest.fn()} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.filter((l) => ['UNIT', 'POINT', 'LINE', 'MEASURE', 'LAYERS'].includes(l))).toEqual(['UNIT', 'POINT', 'LINE', 'MEASURE', 'LAYERS']);
    expect(screen.getByLabelText('MEASURE')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('MEASURE'));
    expect(onMeasure).toHaveBeenCalled();
  });
```

PointsLayer test: in 'reports taps…', give the press event feature a geometry `{ type: 'Point', coordinates: [-77, 38.9] }` and coordinates `{ latitude: 38.9001, longitude: -77.0001 }`; expect `toHaveBeenCalledWith(a.value.id, { lat: 38.9001, lon: -77.0001 }, { kind: 'point', sidc: HOSTILE_INF }, { lat: 38.9, lon: -77 })`.

MapScreen tests (add a `describe('measure', …)` before `describe('camera padding…')`; import `useMeasure`/`INITIAL_MEASURE` and reset it in the file's `beforeEach`):

```tsx
  describe('measure', () => {
    const mapTap = (lon: number, lat: number) =>
      act(async () => (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }));

    async function openMap() {
      const ctx = makeTestContext();
      const r = await createMission(ctx, { name: 'Op Iron' });
      if (!r.ok) throw new Error('setup');
      const u = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.95, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
      if (!u.ok) throw new Error('setup');
      await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
      await screen.findByTestId('map-view');
      return { unitId: u.value.id };
    }

    it('MEASURE closes an open menu and toggles the card', async () => {
      await openMap();
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      expect(await screen.findByText('Layers')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      expect(useMenu.getState().stack).toEqual([]);
      expect(screen.getByTestId('measure-card')).toBeTruthy();
      expect(screen.getByLabelText('MEASURE')).toBeSelected();
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      expect(screen.queryByTestId('measure-card')).toBeNull();
    });

    it('a map tap sets the start; a unit tap snaps the end without opening the unit; long-press does nothing', async () => {
      const { unitId } = await openMap();
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      await mapTap(-77, 38.9);
      expect(useMeasure.getState().start).toEqual({ lat: 38.9, lon: -77 });
      await act(async () =>
        (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({
          features: [{ properties: { id: unitId, sidc: 'SHGPUCI--------' }, geometry: { type: 'Point', coordinates: [-77, 38.95] } }],
          coordinates: { latitude: 38.9502, longitude: -77.0003 },
          point: {},
        }),
      );
      expect(useMeasure.getState().end).toEqual({ lat: 38.95, lon: -77 });
      expect(useMenu.getState().stack).toEqual([]);
      await act(async () =>
        (mapboxMock().__props.MapView.main.onLongPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [-77.1, 38.8] }, properties: {} }),
      );
      expect(useMenu.getState().stack).toEqual([]);
      expect(useMeasure.getState().end).toEqual({ lat: 38.95, lon: -77 });
    });

    it('a tap on my marker snaps to my position, and opening a menu stops measuring', async () => {
      await openMap();
      await act(async () => usePresence.getState().setSelfPosition({ position: { lat: 38.9, lon: -77 }, accuracyM: 5, timestamp: 1 }));
      await fireEvent.press(screen.getByLabelText('MEASURE'));
      await act(async () => (mapboxMock().__props.ShapeSource.self.onPress as (e: unknown) => void)({ features: [{ properties: {} }], coordinates: { latitude: 38.9003, longitude: -77.0002 }, point: {} }));
      expect(useMeasure.getState().start).toEqual({ lat: 38.9, lon: -77 });
      await fireEvent.press(screen.getByLabelText('LAYERS'));
      expect(useMeasure.getState().active).toBe(false);
      expect(screen.queryByTestId('measure-card')).toBeNull();
    });
  });
```

(Reset presence too: the file's `beforeEach` gains `usePresence.setState(INITIAL_PRESENCE);` if it does not already reset it.)

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/toolbar src/features/map` → FAIL.

- [ ] **Step 3: Implement**

Toolbar: `ToolId = 'unit' | 'point' | 'line' | 'measure' | 'layers'`; prop `onMeasure?: () => void`; `<ToolButton icon="ruler" label="MEASURE" active={activeTool === 'measure'} onPress={onMeasure} />` after LINE.

PointsLayer: prop type `onItemPress?: (id: string, at: LatLon, item: ItemRef, itemAt: LatLon | null) => void`; in `onPress`:

```ts
        const g = e.features[0]?.geometry;
        const itemAt = g?.type === 'Point' ? { lat: g.coordinates[1], lon: g.coordinates[0] } : null;
        if (typeof id === 'string') onItemPress?.(id, { lat: e.coordinates.latitude, lon: e.coordinates.longitude }, { kind: 'point', sidc }, itemAt);
```

(Update its doc comment: `at` is the tap point; `itemAt` the symbol's coordinate, for snapping.) `LinesLayer`'s `onItemPress` type is compatible (it passes three args).

SelfLayer:

```tsx
export function SelfLayer({ onPress }: { onPress?: (at: LatLon) => void }) {
  …
  return (
    <ShapeSource id="self" shape={shape} onPress={() => position && onPress?.(position)}>
```

MissionMap:

```tsx
  const measuring = useMeasure((s) => s.active);
  // Any menu opening (a tool, Menu, Settings, a Layers row…) ends measuring.
  useEffect(
    () =>
      useMenu.subscribe((state, prev) => {
        if (state.stack.length > 0 && state.stack !== prev.stack && useMeasure.getState().active) useMeasure.getState().stopMeasure();
      }),
    [],
  );
  useEffect(() => () => useMeasure.getState().stopMeasure(), []);
  const toggleMeasure = () => {
    if (useMeasure.getState().active) useMeasure.getState().stopMeasure();
    else {
      useMenu.getState().closeMenu();
      useMeasure.getState().startMeasure();
    }
  };
```

- `onMapPress`: first `if (useMeasure.getState().active) { useMeasure.getState().place(coord); return; }`.
- `onItemPress(itemId, at, item, itemAt?: LatLon | null)`: first `if (useMeasure.getState().active) { useMeasure.getState().place(itemAt ?? at); return; }` (lines pass no `itemAt` → tap point).
- `onLongPress`: first `if (useMeasure.getState().active) return;` (before `notifyPlaced()`).
- `<SelfLayer onPress={measuring ? (at) => useMeasure.getState().place(at) : undefined} />`.
- Toolbar: `activeTool={measuring ? 'measure' : topId === 'unit.add' ? … }`, `onMeasure={toggleMeasure}`.

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: MEASURE tool with snapping to units, points and my position"`

---

### Task 5: Docs and device checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md`, `.agents/skills/menus/SKILL.md`, `docs/superpowers/notes/2026-10-12-native-gate.md`

- [ ] **Step 1: Architecture spec** — after §5.4b add:

```markdown
### 5.4c Measure
The MEASURE tool is a map mode, not a menu or a stored item: `stores/measure.ts` (start, end or
live at the crosshair), `MeasureLayer`, and `MeasureCard` in the top-left stack. Taps snap to
units, points and the user's marker. See `2026-10-13-measure-design.md`.
```

- [ ] **Step 2: menus skill** — under "Conventions" add: `- **Measure is not a menu.** MEASURE closes the open menu; opening any menu stops measuring (MissionMap). Keep it that way so the map stays clear while aiming.`

- [ ] **Step 3: Gate notes** — after the last row add:

```markdown
| 69 | Toolbar reads UNIT · POINT · LINE · MEASURE · LAYERS; MEASURE closes an open panel and shows the Measure card ("Set start") | PENDING |
| 70 | Tap the map to set the start; pan: the dashed amber line and the readout follow the crosshair; tap to fix the end (solid); tap again moves the end | PENDING |
| 71 | Tap a unit / point: the end snaps onto the symbol and its menu does not open; tap my blue marker: snaps to me; From me sets the start to my GPS position | PENDING |
| 72 | Readout matches the range/bearing elsewhere (deg/mils, GRID/TRUE/MAG from Settings); chip at the line's middle is readable on Satellite, Topo and Dark | PENDING |
| 73 | Set at crosshair, Restart and × (Stop measuring) behave; opening Layers or Menu stops measuring; long-press does nothing while measuring | PENDING |
```

- [ ] **Step 4: Verify and commit** — `npx expo lint` → 0 problems; `git add -A docs .agents && git commit -m "docs: measure tool in the spec, skills and device checklist"`
