# Polygons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users draw named military areas (10 types) either point by point or as a circle (center + radius), and view, edit, hide, find and delete them like lines.

**Architecture:** A new item kind `polygon` whose geometry is always a closed GeoJSON Polygon (a circle is a 64-point ring) with the type and the circle's exact center/radius in `style`. Pure modules hold types, geometry, measurement and the selector; the draft store reuses the line vertex editing (3-point minimum) and uses the existing draft `coord` as the circle center; `PolygonsLayer` / `DraftPolygonLayer` draw them; a polygon adapter plugs `PolygonForm` into the shared item panels; `MissionMap` routes taps to the polygon draft while drawing.

**Tech Stack:** Expo SDK 57, React Native 0.86, WatermelonDB 0.28, @rnmapbox/maps 10, Zustand, zod, geographiclib-geodesic, Jest + RNTL 14.

**Spec:** `docs/superpowers/specs/2026-10-13-polygons-design.md`

## Global Constraints

- No schema change: `kind = 'polygon'`, closed GeoJSON Polygon in `geometry`, `sidc` null, `style` = `{"polygonType":…,"shape":"points"}` or `{"polygonType":…,"shape":"circle","center":{"lat":…,"lon":…},"radiusM":…}`.
- 10 types exactly as spec §3.1 (ids, labels, prefixes; FFA/NFA/RFA/ACA dashed). Label `"<prefix> <name>"`, prefix not repeated.
- Friendly blue outline over the `point-symbol-halo` halo (normal line width 3 pt, halo 5 pt, dash `[2, 1.5]`); fill `friendly` at opacity 0.15; label chip at the center.
- Only the outline and label of a saved polygon are tappable; the fill source has no `onPress`.
- Points shape needs ≥ 3 points (× disabled at 3, hint "A polygon needs at least 3 points"); circle needs a center and 0 < radius ≤ 500 km; a name is required; no auto-names.
- Circle ring: 64 points from `destination(center, 360·i/64, radiusM)`.
- Toolbar **UNIT · POINT · LINE · POLYGON · MEASURE · LAYERS**; POLYGON icon `pentagon-outline`.
- Menu ids `polygon.add` `{}` and `polygon.edit` `{ itemId }`; titles "Add polygon" / "Polygon" / "Edit polygon". Type dropdown alphabetical.
- Plan decision (spec §5 named a `circleCenter` field): the circle center **is** the draft's existing `coord`, so `LocationSection` (MGRS, Center, Map) and the camera-follow on typed grids work unchanged.
- Repo rules: `npx jest` green, `npx tsc --noEmit` clean, `npx expo lint` 0 problems; single quotes; never run prettier; Conventional Commits; **no Co-Authored-By or any other trailer in commit messages**; no hex colors outside `src/theme`.

## Review Focus

1. A tap inside a saved polygon's fill (not on the outline or label) must reach the map: it never opens the polygon, and while drawing it adds a point there — Task 4 (no `onPress` on the fill source) and Task 7 (MapScreen).
2. Switching Shape Points → Circle → Points keeps the drawn points, and Save stores only the shape showing — Task 6 (menu test).
3. A typed radius that is empty, 0, negative or text keeps Save disabled; km and m give the same circle — Task 6.
4. A saved circle reopened for edit shows its exact center grid and radius (not values re-derived from the 64-point ring) — Task 6 (edit test).
5. A stored polygon with unreadable geometry or style (bad JSON, < 3 points, unknown type) is skipped on the map or falls back sensibly, and opening it reports "That polygon no longer exists." — Task 2 (selector) and Task 6 (menu).

---

### Task 1: Polygon types, geometry and measurement

**Files:**
- Create: `src/features/symbology/polygon-types.ts` (+ `.test.ts`), `src/features/map-items/polygon-measure.ts` (+ `.test.ts`)
- Modify: `src/features/map-items/geometry.ts` (+ `geometry.test.ts`), `src/lib/geo/measure/geodesic.ts` (+ `geodesic.test.ts`)

**Interfaces:**
- Produces:
  - `type PolygonType` (10 ids); `type PolygonTypeInfo = { id: PolygonType; label: string; prefix: string; dash: 'solid' | 'dashed' }`; `POLYGON_TYPES`, `polygonTypeInfo(id)`, `polygonLabel(type, name)`
  - `type PolygonShape = { kind: 'points' } | { kind: 'circle'; center: LatLon; radiusM: number }`; `type PolygonStyle = { polygonType: PolygonType; shape: PolygonShape }`; `polygonStyle(type, shape): string`; `polygonStyleOf(style: string | null): PolygonStyle`; `MAX_RADIUS_M = 500_000`
  - `polygonGeometry(points: LatLon[]): string` (closes the ring); `parsePolygonGeometry(json: string): LatLon[] | null` (open ring, ≥ 3)
  - `polygonAreaM2(points: LatLon[]): number` in `geodesic.ts`
  - `circleRing(center: LatLon, radiusM: number, segments = 64): LatLon[]`, `perimeterM(points)`, `areaM2(points)`, `formatArea(m2): string`, `ringCenter(points): LatLon`

- [ ] **Step 1: Write the failing tests**

`src/features/symbology/polygon-types.test.ts`:

```ts
import { POLYGON_TYPES, polygonLabel, polygonStyle, polygonStyleOf, polygonTypeInfo } from './polygon-types';

describe('polygon types', () => {
  it('has the 10 agreed types with prefixes and dashes', () => {
    expect(POLYGON_TYPES.map((t) => [t.id, t.prefix, t.dash])).toEqual([
      ['assembly-area', 'AA', 'solid'],
      ['objective', 'OBJ', 'solid'],
      ['battle-position', 'BP', 'solid'],
      ['engagement-area', 'EA', 'solid'],
      ['named-area-of-interest', 'NAI', 'solid'],
      ['target-area-of-interest', 'TAI', 'solid'],
      ['free-fire-area', 'FFA', 'dashed'],
      ['no-fire-area', 'NFA', 'dashed'],
      ['restrictive-fire-area', 'RFA', 'dashed'],
      ['airspace-coordination-area', 'ACA', 'dashed'],
    ]);
    expect(polygonTypeInfo('airspace-coordination-area').label).toBe('Airspace coordination area');
  });

  it('labels with the prefix once', () => {
    expect(polygonLabel('objective', 'IRON')).toBe('OBJ IRON');
    expect(polygonLabel('objective', ' OBJ IRON ')).toBe('OBJ IRON');
    expect(polygonLabel('no-fire-area', '1')).toBe('NFA 1');
  });

  it('round-trips points and circle styles and falls back sensibly', () => {
    expect(polygonStyleOf(polygonStyle('objective', { kind: 'points' }))).toEqual({ polygonType: 'objective', shape: { kind: 'points' } });
    const circle = { kind: 'circle' as const, center: { lat: 38.9, lon: -77 }, radiusM: 500 };
    expect(polygonStyleOf(polygonStyle('no-fire-area', circle))).toEqual({ polygonType: 'no-fire-area', shape: circle });
    expect(polygonStyleOf(null)).toEqual({ polygonType: 'objective', shape: { kind: 'points' } });
    expect(polygonStyleOf('nope')).toEqual({ polygonType: 'objective', shape: { kind: 'points' } });
    expect(polygonStyleOf('{"polygonType":"x","shape":"circle","center":{"lat":99,"lon":0},"radiusM":5}')).toEqual({ polygonType: 'objective', shape: { kind: 'points' } });
    expect(polygonStyleOf('{"polygonType":"no-fire-area","shape":"circle","center":{"lat":1,"lon":1},"radiusM":0}').shape).toEqual({ kind: 'points' });
  });
});
```

Append to `src/features/map-items/geometry.test.ts` (merge the import):

```ts
describe('polygon geometry', () => {
  const ring = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }, { lat: 0.01, lon: 0.01 }];

  it('closes the ring when storing and opens it when reading', () => {
    const json = polygonGeometry(ring);
    expect(JSON.parse(json)).toEqual({ type: 'Polygon', coordinates: [[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0]]] });
    expect(parsePolygonGeometry(json)).toEqual(ring);
  });

  it('rejects fewer than 3 points, bad JSON, other types and invalid positions', () => {
    expect(parsePolygonGeometry(JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [0, 1], [0, 0]]] }))).toBeNull();
    expect(parsePolygonGeometry('nope')).toBeNull();
    expect(parsePolygonGeometry(JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [1, 1]] }))).toBeNull();
    expect(parsePolygonGeometry(JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [0, 1], [500, 1], [0, 0]]] }))).toBeNull();
  });
});
```

Append to `src/lib/geo/measure/geodesic.test.ts` (merge the import):

```ts
describe('polygonAreaM2', () => {
  it('measures a 0.01° square at the equator in either winding', () => {
    const sq = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }, { lat: 0.01, lon: 0.01 }, { lat: 0.01, lon: 0 }];
    expect(polygonAreaM2(sq)).toBeCloseTo(1_230_907, -2);
    expect(polygonAreaM2([...sq].reverse())).toBeCloseTo(1_230_907, -2);
    expect(polygonAreaM2(sq.slice(0, 2))).toBe(0);
  });
});
```

`src/features/map-items/polygon-measure.test.ts`:

```ts
import { inverse } from '@/lib/geo/measure/geodesic';

import { areaM2, circleRing, formatArea, perimeterM, ringCenter } from './polygon-measure';

const sq = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.01 }, { lat: 0.01, lon: 0.01 }, { lat: 0.01, lon: 0 }];

describe('polygon measurement', () => {
  it('measures the closed perimeter and the area', () => {
    expect(perimeterM(sq)).toBeCloseTo(4437.9, 0);
    expect(areaM2(sq)).toBeCloseTo(1_230_907, -2);
    expect(perimeterM(sq.slice(0, 2))).toBe(0);
  });

  it('builds a 64-point circle ring at the radius', () => {
    const c = { lat: 38.9, lon: -77 };
    const ring = circleRing(c, 500);
    expect(ring).toHaveLength(64);
    for (const p of ring) expect(inverse(c, p).distanceM).toBeCloseTo(500, 3);
  });

  it('formats areas in km² or m²', () => {
    expect(formatArea(1_230_907)).toBe('1.23 km²');
    expect(formatArea(420_000)).toBe('0.42 km²');
    expect(formatArea(8_500)).toBe('8,500 m²');
    expect(formatArea(45_600_000)).toBe('45.6 km²');
    expect(formatArea(250_000_000)).toBe('250 km²');
  });

  it('centers labels on the average of the points', () => {
    expect(ringCenter(sq)).toEqual({ lat: 0.005, lon: 0.005 });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/symbology/polygon-types.test.ts src/features/map-items/geometry.test.ts src/features/map-items/polygon-measure.test.ts src/lib/geo/measure` → FAIL (missing modules / exports).

- [ ] **Step 3: Implement**

`src/features/symbology/polygon-types.ts`:

```ts
import type { LatLon } from '@/lib/geo/types';

/** Military areas the Polygon menu offers (spec 2026-10-13-polygons-design.md §3.1). */
export type PolygonType =
  | 'assembly-area'
  | 'objective'
  | 'battle-position'
  | 'engagement-area'
  | 'named-area-of-interest'
  | 'target-area-of-interest'
  | 'free-fire-area'
  | 'no-fire-area'
  | 'restrictive-fire-area'
  | 'airspace-coordination-area';

export type PolygonTypeInfo = { id: PolygonType; label: string; prefix: string; dash: 'solid' | 'dashed' };

const t = (id: PolygonType, label: string, prefix: string, dash: 'solid' | 'dashed' = 'solid'): PolygonTypeInfo => ({ id, label, prefix, dash });

export const POLYGON_TYPES: readonly PolygonTypeInfo[] = [
  t('assembly-area', 'Assembly area', 'AA'),
  t('objective', 'Objective', 'OBJ'),
  t('battle-position', 'Battle position', 'BP'),
  t('engagement-area', 'Engagement area', 'EA'),
  t('named-area-of-interest', 'Named area of interest', 'NAI'),
  t('target-area-of-interest', 'Target area of interest', 'TAI'),
  t('free-fire-area', 'Free fire area', 'FFA', 'dashed'),
  t('no-fire-area', 'No fire area', 'NFA', 'dashed'),
  t('restrictive-fire-area', 'Restrictive fire area', 'RFA', 'dashed'),
  t('airspace-coordination-area', 'Airspace coordination area', 'ACA', 'dashed'),
];

const BY_ID = new Map(POLYGON_TYPES.map((x) => [x.id, x]));

export function polygonTypeInfo(id: PolygonType): PolygonTypeInfo {
  return BY_ID.get(id)!;
}

/** "OBJ IRON"; the prefix is not repeated when the name already starts with it. */
export function polygonLabel(type: PolygonType, name: string): string {
  const trimmed = name.trim();
  const prefix = polygonTypeInfo(type).prefix;
  if (trimmed.startsWith(`${prefix} `) || trimmed === prefix) return trimmed;
  return `${prefix} ${trimmed}`;
}

/** Points: the geometry is the shape. Circle: the exact center and radius (the geometry is a 64-point ring). */
export type PolygonShape = { kind: 'points' } | { kind: 'circle'; center: LatLon; radiusM: number };
export type PolygonStyle = { polygonType: PolygonType; shape: PolygonShape };

/** Largest circle the app accepts (500 km). */
export const MAX_RADIUS_M = 500_000;

export function polygonStyle(type: PolygonType, shape: PolygonShape): string {
  return JSON.stringify(shape.kind === 'circle' ? { polygonType: type, shape: 'circle', center: shape.center, radiusM: shape.radiusM } : { polygonType: type, shape: 'points' });
}

const validCenter = (c: unknown): c is LatLon => {
  const p = c as Partial<LatLon> | null;
  return !!p && typeof p.lat === 'number' && typeof p.lon === 'number' && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
};

/** Parses `style`: unknown types read as Objective; a circle with a bad center or radius reads as Points. */
export function polygonStyleOf(style: string | null): PolygonStyle {
  let v: { polygonType?: unknown; shape?: unknown; center?: unknown; radiusM?: unknown } = {};
  try {
    v = style ? (JSON.parse(style) ?? {}) : {};
  } catch {
    v = {};
  }
  const polygonType = typeof v.polygonType === 'string' && BY_ID.has(v.polygonType as PolygonType) ? (v.polygonType as PolygonType) : 'objective';
  const circle =
    v.shape === 'circle' && validCenter(v.center) && typeof v.radiusM === 'number' && v.radiusM > 0 && v.radiusM <= MAX_RADIUS_M;
  return { polygonType, shape: circle ? { kind: 'circle', center: { lat: (v.center as LatLon).lat, lon: (v.center as LatLon).lon }, radiusM: v.radiusM as number } : { kind: 'points' } };
}
```

In `geometry.ts` add:

```ts
/** Stores a closed ring (first point repeated at the end). */
export function polygonGeometry(points: LatLon[]): string {
  const ring = points.map((p) => [p.lon, p.lat]);
  return JSON.stringify({ type: 'Polygon', coordinates: [[...ring, ring[0]]] });
}

/** The ring's distinct points (closing point dropped), or null for bad JSON, another type, an invalid position or < 3 points. */
export function parsePolygonGeometry(json: string): LatLon[] | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const g = value as { type?: unknown; coordinates?: unknown } | null;
  if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates) || !Array.isArray(g.coordinates[0])) return null;
  const points: LatLon[] = [];
  for (const c of g.coordinates[0] as unknown[]) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const p = { lat: Number(c[1]), lon: Number(c[0]) };
    if (!isValidLatLon(p)) return null;
    points.push(p);
  }
  const last = points[points.length - 1];
  if (points.length > 1 && last.lat === points[0].lat && last.lon === points[0].lon) points.pop();
  return points.length >= 3 ? points : null;
}
```

In `geodesic.ts` add:

```ts
/** Geodesic area (m², always positive) of the polygon through `points` (implicitly closed). */
export function polygonAreaM2(points: readonly LatLon[]): number {
  if (points.length < 3) return 0;
  const poly = WGS84.Polygon(false);
  for (const p of points) poly.AddPoint(p.lat, p.lon);
  return Math.abs(poly.Compute(false, true).area ?? 0);
}
```

`src/features/map-items/polygon-measure.ts`:

```ts
import { destination, inverse, polygonAreaM2 } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

/** A circle as a closed shape: `segments` points at `radiusM` from the center, clockwise from north. */
export function circleRing(center: LatLon, radiusM: number, segments = 64): LatLon[] {
  return Array.from({ length: segments }, (_, i) => destination(center, (360 * i) / segments, radiusM));
}

/** Closed perimeter in meters (0 for fewer than 3 points). */
export function perimeterM(points: readonly LatLon[]): number {
  if (points.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) total += inverse(points[i], points[(i + 1) % points.length]).distanceM;
  return total;
}

export const areaM2 = polygonAreaM2;

const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "0.42 km²" from 0.01 km² up (2, then 1, then 0 decimals); "8,500 m²" below. */
export function formatArea(m2: number): string {
  const km2 = m2 / 1e6;
  if (km2 < 0.01) return `${group(m2)} m²`;
  if (km2 < 10) return `${km2.toFixed(2)} km²`;
  if (km2 < 100) return `${km2.toFixed(1)} km²`;
  return `${Math.round(km2)} km²`;
}

/** Where a points polygon's label goes: the average of its points. */
export function ringCenter(points: readonly LatLon[]): LatLon {
  const n = points.length;
  return { lat: points.reduce((a, p) => a + p.lat, 0) / n, lon: points.reduce((a, p) => a + p.lon, 0) / n };
}
```

- [ ] **Step 4: Verify** — same jest command → PASS; `npx tsc --noEmit && npx expo lint` clean.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: polygon types, geometry and measurement"`

---

### Task 2: Polygon kind, commands and the saved-polygon selector

**Files:**
- Modify: `src/lib/db/models/MapItem.ts`, `src/features/map-items/commands.ts` (+ `map-items.test.ts`)
- Create: `src/features/map-items/polygon-selectors.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `MapItemKind = 'point' | 'line' | 'polygon'`
  - `type PolygonShapeInput = { kind: 'points'; points: LatLon[] } | { kind: 'circle'; center: LatLon; radiusM: number }`
  - `placePolygon(ctx, { missionId, polygonType, name, notes?, shape: PolygonShapeInput })` → `Result<{ id }, 'invalid_coordinate' | 'too_few_points' | 'invalid_radius' | 'invalid_name' | 'write_failed'>`
  - `updatePolygon(ctx, id, { polygonType?, name?, notes?, shape? })` → `Result<void, … | 'not_found'>`
  - `createPolygonFeatureSelector(): (items) => { fills: FeatureCollection<{ id }>; shapes: FeatureCollection<{ id; role: 'outline' | 'label'; dash; label }> }`

- [ ] **Step 1: Write the failing tests**

Append inside the top `describe` of `map-items.test.ts` (merge imports: `placePolygon, updatePolygon` from `./commands`, `parsePolygonGeometry` from `./geometry`):

```ts
  describe('polygons', () => {
    const tri = [at, { lat: at.lat + 0.01, lon: at.lon }, { lat: at.lat, lon: at.lon + 0.01 }];

    it('places a points polygon and a circle', async () => {
      const ctx = makeTestContext();
      const a = await placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name: ' IRON ', shape: { kind: 'points', points: tri } });
      if (!a.ok) throw new Error('setup');
      const pa = await findItem(ctx.db, a.value.id);
      expect(pa).toMatchObject({ kind: 'polygon', name: 'IRON', sidc: null, style: '{"polygonType":"objective","shape":"points"}' });
      expect(parsePolygonGeometry(pa!.geometry)).toEqual(tri);
      const c = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'circle', center: at, radiusM: 500 } });
      if (!c.ok) throw new Error('setup');
      const pc = await findItem(ctx.db, c.value.id);
      expect(JSON.parse(pc!.style!)).toEqual({ polygonType: 'no-fire-area', shape: 'circle', center: at, radiusM: 500 });
      expect(parsePolygonGeometry(pc!.geometry)).toHaveLength(64);
    });

    it('validates points, radius, name and existence', async () => {
      const ctx = makeTestContext();
      const place = (shape: Parameters<typeof placePolygon>[1]['shape'], name = 'X') => placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name, shape });
      expect(await place({ kind: 'points', points: tri.slice(0, 2) })).toMatchObject({ ok: false, error: 'too_few_points' });
      expect(await place({ kind: 'points', points: [...tri.slice(0, 2), { lat: 99, lon: 0 }] })).toMatchObject({ ok: false, error: 'invalid_coordinate' });
      expect(await place({ kind: 'circle', center: at, radiusM: 0 })).toMatchObject({ ok: false, error: 'invalid_radius' });
      expect(await place({ kind: 'circle', center: at, radiusM: 600_000 })).toMatchObject({ ok: false, error: 'invalid_radius' });
      expect(await place({ kind: 'circle', center: { lat: 99, lon: 0 }, radiusM: 5 })).toMatchObject({ ok: false, error: 'invalid_coordinate' });
      expect(await place({ kind: 'points', points: tri }, '  ')).toMatchObject({ ok: false, error: 'invalid_name' });
      expect(await updatePolygon(ctx, 'nope', { name: 'X' })).toMatchObject({ ok: false, error: 'not_found' });
    });

    it('updates the type alone (keeping the circle) and the shape', async () => {
      const ctx = makeTestContext();
      const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'circle', center: at, radiusM: 500 } });
      if (!r.ok) throw new Error('setup');
      expect(await updatePolygon(ctx, r.value.id, { polygonType: 'free-fire-area', notes: 'n' })).toEqual({ ok: true, value: undefined });
      expect(JSON.parse((await findItem(ctx.db, r.value.id))!.style!)).toEqual({ polygonType: 'free-fire-area', shape: 'circle', center: at, radiusM: 500 });
      await updatePolygon(ctx, r.value.id, { shape: { kind: 'points', points: tri } });
      const item = await findItem(ctx.db, r.value.id);
      expect(item).toMatchObject({ notes: 'n', style: '{"polygonType":"free-fire-area","shape":"points"}' });
      expect(parsePolygonGeometry(item!.geometry)).toEqual(tri);
    });
  });
```

`src/features/map-items/polygon-selectors.test.ts`:

```ts
import { createPolygonFeatureSelector } from './polygon-selectors';
import type { MapItemSnapshot } from './repository';

const ring = [[-77, 38.9], [-76.99, 38.9], [-76.99, 38.91], [-77, 38.9]];

function poly(id: string, updatedAt: number, overrides: Partial<MapItemSnapshot> = {}): MapItemSnapshot {
  return {
    id,
    kind: 'polygon',
    geometry: JSON.stringify({ type: 'Polygon', coordinates: [ring] }),
    sidc: null,
    style: '{"polygonType":"no-fire-area","shape":"points"}',
    name: '1',
    notes: null,
    updatedAt,
    ...overrides,
  };
}

describe('createPolygonFeatureSelector', () => {
  it('builds a fill, a dashed outline and a centered label', () => {
    const { fills, shapes } = createPolygonFeatureSelector()([poly('a', 1)]);
    expect(fills.features).toHaveLength(1);
    expect(fills.features[0].properties).toEqual({ id: 'a' });
    const outline = shapes.features.find((f) => f.properties.role === 'outline')!;
    expect(outline.properties).toMatchObject({ id: 'a', dash: 'dashed' });
    expect(outline.geometry.coordinates).toHaveLength(4); // closed
    const label = shapes.features.find((f) => f.properties.role === 'label')!;
    expect(label.properties.label).toBe('NFA 1');
  });

  it('puts a circle label at its exact center, skips unreadable polygons and other kinds, and caches', () => {
    const select = createPolygonFeatureSelector();
    const circle = poly('c', 1, { style: '{"polygonType":"objective","shape":"circle","center":{"lat":38.905,"lon":-76.995},"radiusM":500}' });
    const first = select([poly('a', 1), circle, poly('b', 1, { geometry: 'nope' }), { ...poly('l', 1), kind: 'line' }]);
    expect(first.fills.features.map((f) => f.id)).toEqual(['a', 'c']);
    expect(first.shapes.features.find((f) => f.properties.id === 'c' && f.properties.role === 'label')!.geometry.coordinates).toEqual([-76.995, 38.905]);
    const second = select([poly('a', 1), circle]);
    expect(second.fills.features[0]).toBe(first.fills.features[0]);
    expect(select([poly('a', 2)]).fills.features[0]).not.toBe(first.fills.features[0]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/map-items` → FAIL.

- [ ] **Step 3: Implement**

`MapItem.ts`: `export type MapItemKind = 'point' | 'line' | 'polygon';`

`commands.ts` (imports: `polygonGeometry` from `./geometry`; `MAX_RADIUS_M, polygonStyle, polygonStyleOf, type PolygonType` from `@/features/symbology/polygon-types`; `circleRing` from `./polygon-measure`):

```ts
export type PolygonShapeInput = { kind: 'points'; points: LatLon[] } | { kind: 'circle'; center: LatLon; radiusM: number };
type PolygonShapeError = 'invalid_coordinate' | 'too_few_points' | 'invalid_radius';

/** The stored geometry and style shape for a shape input, or why it is invalid. */
function polygonParts(shape: PolygonShapeInput): { geometry: string; shape: { kind: 'points' } | { kind: 'circle'; center: LatLon; radiusM: number } } | PolygonShapeError {
  if (shape.kind === 'points') {
    if (shape.points.length < 3) return 'too_few_points';
    if (!shape.points.every(isValidLatLon)) return 'invalid_coordinate';
    return { geometry: polygonGeometry(shape.points), shape: { kind: 'points' } };
  }
  if (!isValidLatLon(shape.center)) return 'invalid_coordinate';
  if (!Number.isFinite(shape.radiusM) || shape.radiusM <= 0 || shape.radiusM > MAX_RADIUS_M) return 'invalid_radius';
  return { geometry: polygonGeometry(circleRing(shape.center, shape.radiusM)), shape: { kind: 'circle', center: shape.center, radiusM: shape.radiusM } };
}

const SHAPE_MESSAGES: Record<PolygonShapeError, string> = {
  invalid_coordinate: 'Coordinate is out of range',
  too_few_points: 'A polygon needs at least 3 points',
  invalid_radius: 'Radius must be more than 0 and at most 500 km',
};

export type PlacePolygonInput = { missionId: string; polygonType: PolygonType; name: string; notes?: string | null; shape: PolygonShapeInput };

export async function placePolygon(
  ctx: CommandContext,
  input: PlacePolygonInput,
): Promise<Result<{ id: string }, PolygonShapeError | 'invalid_name' | 'write_failed'>> {
  const parts = polygonParts(input.shape);
  if (typeof parts === 'string') return err(parts, SHAPE_MESSAGES[parts]);
  const name = input.name.trim();
  if (!name) return err('invalid_name', 'Name is required');
  try {
    const item = await ctx.db.write(() =>
      ctx.db.get<MapItem>(Tables.mapItems).create((i) => {
        i.missionId = input.missionId;
        i.kind = 'polygon';
        i.geometry = parts.geometry;
        i.sidc = null;
        i.name = name;
        i.notes = input.notes ?? null;
        i.style = polygonStyle(input.polygonType, parts.shape);
        i.createdBy = ctx.actorId();
        i.updatedBy = ctx.actorId();
      }),
    );
    return ok({ id: item.id });
  } catch (e) {
    return err('write_failed', String(e));
  }
}

export type UpdatePolygonPatch = { polygonType?: PolygonType; name?: string; notes?: string | null; shape?: PolygonShapeInput };

export async function updatePolygon(
  ctx: CommandContext,
  id: string,
  patch: UpdatePolygonPatch,
): Promise<Result<void, 'not_found' | PolygonShapeError | 'invalid_name' | 'write_failed'>> {
  const parts = patch.shape ? polygonParts(patch.shape) : null;
  if (typeof parts === 'string') return err(parts, SHAPE_MESSAGES[parts]);
  if (patch.name !== undefined && !patch.name.trim()) return err('invalid_name', 'Name is required');
  const item = await findItem(ctx.db, id);
  if (!item || item.kind !== 'polygon') return err('not_found', `No polygon ${id}`);
  const current = polygonStyleOf(item.style ?? null);
  try {
    await ctx.db.write(() =>
      item.update((i) => {
        if (parts) i.geometry = parts.geometry;
        i.style = polygonStyle(patch.polygonType ?? current.polygonType, parts ? parts.shape : current.shape);
        if (patch.name !== undefined) i.name = patch.name.trim();
        if (patch.notes !== undefined) i.notes = patch.notes;
        i.updatedBy = ctx.actorId();
      }),
    );
    return ok(undefined);
  } catch (e) {
    return err('write_failed', String(e));
  }
}
```

`src/features/map-items/polygon-selectors.ts`:

```ts
import { polygonLabel, polygonStyleOf, polygonTypeInfo } from '@/features/symbology/polygon-types';
import type { LatLon } from '@/lib/geo/types';

import { parsePolygonGeometry } from './geometry';
import { ringCenter } from './polygon-measure';
import type { MapItemSnapshot } from './repository';

type Ring = [number, number][];
export type PolygonFillFeature = { type: 'Feature'; id: string; geometry: { type: 'Polygon'; coordinates: Ring[] }; properties: { id: string } };
type ShapeProps = { id: string; role: 'outline' | 'label'; dash: 'solid' | 'dashed'; label: string };
export type PolygonShapeFeature =
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: Ring }; properties: ShapeProps }
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: ShapeProps };
export type PolygonFeatures = {
  fills: { type: 'FeatureCollection'; features: PolygonFillFeature[] };
  shapes: { type: 'FeatureCollection'; features: PolygonShapeFeature[] };
};
type Built = { fill: PolygonFillFeature; shapes: PolygonShapeFeature[] };

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];

function build(item: MapItemSnapshot): Built | null {
  const points = parsePolygonGeometry(item.geometry);
  if (!points) return null;
  const { polygonType, shape } = polygonStyleOf(item.style);
  const ring: Ring = [...points.map(lonLat), lonLat(points[0])];
  const props = { id: item.id, dash: polygonTypeInfo(polygonType).dash, label: polygonLabel(polygonType, item.name) };
  const center = shape.kind === 'circle' ? shape.center : ringCenter(points);
  return {
    fill: { type: 'Feature', id: item.id, geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id: item.id } },
    shapes: [
      { type: 'Feature', id: `${item.id}:outline`, geometry: { type: 'LineString', coordinates: ring }, properties: { ...props, role: 'outline' } },
      { type: 'Feature', id: `${item.id}:label`, geometry: { type: 'Point', coordinates: lonLat(center) }, properties: { ...props, role: 'label' } },
    ],
  };
}

/** Saved polygons for PolygonsLayer: fills (not tappable) and outlines + labels; cached per id + updatedAt. */
export function createPolygonFeatureSelector(): (items: readonly MapItemSnapshot[]) => PolygonFeatures {
  let cache = new Map<string, { updatedAt: number; built: Built }>();
  return (items) => {
    const next = new Map<string, { updatedAt: number; built: Built }>();
    const fills: PolygonFillFeature[] = [];
    const shapes: PolygonShapeFeature[] = [];
    for (const item of items) {
      if (item.kind !== 'polygon') continue;
      const cached = cache.get(item.id);
      const built = cached && cached.updatedAt === item.updatedAt ? cached.built : build(item);
      if (!built) continue;
      next.set(item.id, { updatedAt: item.updatedAt, built });
      fills.push(built.fill);
      shapes.push(...built.shapes);
    }
    cache = next;
    return { fills: { type: 'FeatureCollection', features: fills }, shapes: { type: 'FeatureCollection', features: shapes } };
  };
}
```

Note: until Task 6 `itemCategory` treats `kind: 'polygon'` as a unit (the SIDC rule); nothing creates polygons from the UI before then.

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: polygon items, commands and the saved-polygon selector"`

---

### Task 3: Polygon draft state

**Files:**
- Modify: `src/features/map-items/line-draft.ts` (+ test), `src/stores/draft.ts` (+ test), `src/features/map/layers/DraftLayer.tsx` (+ test)

**Interfaces:**
- Consumes: `PolygonType`, `MAX_RADIUS_M`, `inverse`.
- Produces:
  - `canRemove(e, i, min = 2)`, `removeVertex(e, i, min = 2)`
  - draft values `polygonType: PolygonType`, `polygonShape: 'points' | 'circle'`, `circleRadiusM: number | null`, `remembered.polygonType`; the circle center is `coord`
  - actions `startAddPolygon()`, `startEditPolygon({ itemId, polygonType, shape, ring, name, notes })` (shape: `{ kind: 'points'; points } | { kind: 'circle'; center; radiusM }`, ring: the stored points for camera bounds), `setPolygonType(t)`, `setPolygonShape(s)`, `setCircleRadius(m: number | null)`, `setCircleEdge(p)`

- [ ] **Step 1: Write the failing tests**

Append to `line-draft.test.ts`:

```ts
  it('takes a higher minimum for polygons', () => {
    expect(canRemove(three, 0, 3)).toBe(false);
    expect(removeVertex(three, 0, 3)).toBe(three);
    expect(canRemove({ ...three, vertices: [...three.vertices, p(4)] }, 0, 3)).toBe(true);
    expect(removeVertex({ ...empty, vertices: [p(1), p(2)] }, 0, 3).vertices).toEqual([p(2)]);
  });
```

(inside the existing `describe`.)

Append to `src/stores/draft.test.ts`:

```ts
describe('polygon drafts', () => {
  const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 });
  beforeEach(() => useDraft.setState(INITIAL_DRAFT));
  const d = () => useDraft.getState();

  it('starts a points polygon, keeps 3 points at minimum, and keeps both shapes while switching', () => {
    d().startAddPolygon();
    expect(d()).toMatchObject({ mode: 'add', category: 'polygon', polygonType: 'objective', polygonShape: 'points', coord: null, locked: false });
    for (const n of [0, 1, 2]) d().addVertex(p(n));
    d().removeVertex(0);
    expect(d().vertices).toHaveLength(3);
    d().setPolygonShape('circle');
    d().setCoord(p(5), 'press');
    d().setCircleEdge({ lat: 38.95 + 0.0045, lon: -77 });
    expect(d().circleRadiusM).toBeCloseTo(500, -1);
    d().setPolygonShape('points');
    expect(d().vertices).toHaveLength(3);
    expect(d().coord).toEqual(p(5));
  });

  it('accepts only sensible radii and no edge before a center', () => {
    d().startAddPolygon();
    d().setPolygonShape('circle');
    d().setCircleEdge(p(1));
    expect(d().circleRadiusM).toBeNull();
    d().setCircleRadius(-5);
    expect(d().circleRadiusM).toBeNull();
    d().setCircleRadius(1500);
    expect(d().circleRadiusM).toBe(1500);
    d().setCircleRadius(Number.NaN);
    expect(d().circleRadiusM).toBeNull();
  });

  it('opens a saved circle locked with its exact center and radius, and frames it', () => {
    const rev = d().focusRev;
    d().startEditPolygon({ itemId: 'c', polygonType: 'no-fire-area', shape: { kind: 'circle', center: p(1), radiusM: 500 }, ring: [p(0), p(1), p(2)], name: '1', notes: '' });
    expect(d()).toMatchObject({ mode: 'edit', category: 'polygon', polygonShape: 'circle', coord: p(1), circleRadiusM: 500, locked: true, polygonType: 'no-fire-area' });
    expect(d().focusRev).toBe(rev + 1);
  });

  it('remembers the type used last for the next Add polygon', () => {
    d().startAddPolygon();
    d().setPolygonType('engagement-area');
    d().clear();
    d().startAddPolygon();
    expect(d().polygonType).toBe('engagement-area');
  });
});
```

Add to `DraftLayer.test.tsx` (inside its `describe`):

```ts
  it('draws nothing for a polygon draft (its center is drawn by DraftPolygonLayer)', async () => {
    useDraft.getState().startAddPolygon();
    useDraft.getState().setCoord({ lat: 38.9, lon: -77 }, 'press');
    await renderWithProviders(<DraftLayer />);
    expect((mapboxMock().__props.ShapeSource.draft.shape as Shape).features).toEqual([]);
  });
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/map-items/line-draft.test.ts src/stores/draft.test.ts src/features/map/layers/DraftLayer.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`line-draft.ts`:

```ts
/** A saved shape keeps at least `min` points (2 for lines, 3 for polygons); while building (fewer) anything goes. */
export function canRemove(e: LineEdit, i: number, min = 2): boolean {
  return i >= 0 && i < e.vertices.length && (e.vertices.length > min || e.vertices.length < min);
}

export function removeVertex(e: LineEdit, i: number, min = 2): LineEdit {
  if (!canRemove(e, i, min)) return e;
  …(unchanged)
}
```

`draft.ts`:
- imports: `import type { PolygonType } from '@/features/symbology/polygon-types'; import { MAX_RADIUS_M } from '@/features/symbology/polygon-types'; import { inverse } from '@/lib/geo/measure/geodesic';`
- `DraftValues` adds:

```ts
  /** Polygon drafts (category 'polygon'): type and shape. Points use `vertices`; a circle uses `coord` as its center. */
  polygonType: PolygonType;
  polygonShape: 'points' | 'circle';
  circleRadiusM: number | null;
```

  and `remembered` gains `polygonType: PolygonType`.
- `INITIAL_DRAFT` adds `polygonType: 'objective', polygonShape: 'points', circleRadiusM: null` and `remembered.polygonType: 'objective'`.
- `DraftActions` adds:

```ts
  startAddPolygon: () => void;
  startEditPolygon: (polygon: {
    itemId: string;
    polygonType: PolygonType;
    shape: { kind: 'points'; points: LatLon[] } | { kind: 'circle'; center: LatLon; radiusM: number };
    ring: LatLon[];
    name: string;
    notes: string;
  }) => void;
  setPolygonType: (polygonType: PolygonType) => void;
  setPolygonShape: (shape: 'points' | 'circle') => void;
  setCircleRadius: (radiusM: number | null) => void;
  setCircleEdge: (p: LatLon) => void;
```

- Implementations:

```ts
  startAddPolygon: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: s.lastAddCategory,
      mode: 'add',
      category: 'polygon',
      polygonType: s.remembered.polygonType,
      coordRev: s.coordRev,
      focusRev: s.focusRev,
    })),
  startEditPolygon: ({ itemId, polygonType, shape, ring, name, notes }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: s.lastAddCategory,
      mode: 'edit',
      category: 'polygon',
      itemId,
      polygonType,
      polygonShape: shape.kind,
      vertices: shape.kind === 'points' ? shape.points : [],
      // The center is the draft coord; coordRev is left alone so the camera fit below wins.
      coord: shape.kind === 'circle' ? shape.center : null,
      coordSource: shape.kind === 'circle' ? 'item' : null,
      circleRadiusM: shape.kind === 'circle' ? shape.radiusM : null,
      name,
      nameEdited: true,
      notes,
      locked: true,
      coordRev: s.coordRev,
      focusBounds: boundsAround(ring),
      focusRev: s.focusRev + 1,
    })),
  setPolygonType: (polygonType) =>
    set((s) => ({ polygonType, remembered: s.mode === 'add' ? { ...s.remembered, polygonType } : s.remembered })),
  setPolygonShape: (polygonShape) => set((s) => (s.locked ? {} : { polygonShape })),
  setCircleRadius: (radiusM) =>
    set((s) => (s.locked ? {} : { circleRadiusM: radiusM !== null && Number.isFinite(radiusM) && radiusM > 0 && radiusM <= MAX_RADIUS_M ? radiusM : null })),
  setCircleEdge: (p) =>
    set((s) => {
      if (s.locked || !s.coord || !isValid(p)) return {};
      const r = inverse(s.coord, p).distanceM;
      return r > 0 && r <= MAX_RADIUS_M ? { circleRadiusM: r } : {};
    }),
```

- `removeVertex` passes the minimum: `record(s, lineDraft.removeVertex(edit(s), i, s.category === 'polygon' ? 3 : 2))`.

`DraftLayer.tsx`: `if (!mode || !coord || category === 'line' || category === 'polygon') return draftFeatureCollection(null);`

- [ ] **Step 4: Verify** — `npx jest src/features/map-items src/stores src/features/map/layers && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: polygon draft state with points and circle shapes"`

---

### Task 4: Saved polygons on the map

**Files:**
- Modify: `__mocks__/@rnmapbox/maps.tsx`, `src/test-utils/mapbox-mock.ts` (add `FillLayer`), `src/features/map/layers/styles.ts` (+ `styles.test.ts`), `src/features/map/MissionMap.tsx`
- Create: `src/features/map/layers/PolygonsLayer.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `createPolygonFeatureSelector`, `hiddenFilter`, `ItemRef`.
- Produces: `POLYGON_FILL_OPACITY = 0.15`, `makePolygonFillStyle(colors)`, `makePolygonLabelStyle(colors)`; `PolygonsLayer({ missionId, excludeId, onItemPress })` with `onItemPress(id, at, { kind: 'polygon', sidc: null })`.

- [ ] **Step 1: Write the failing tests**

`styles.test.ts` (append; merge imports):

```ts
describe('polygon styles', () => {
  it('fills in light friendly blue', () => {
    const colors = themeColors('dark');
    expect(makePolygonFillStyle(colors)).toEqual({ fillColor: colors.friendly, fillOpacity: POLYGON_FILL_OPACITY });
    expect(POLYGON_FILL_OPACITY).toBe(0.15);
  });
});
```

`src/features/map/layers/PolygonsLayer.test.tsx`:

```tsx
import { act, waitFor } from '@testing-library/react-native';

import { placePolygon } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { PolygonsLayer } from './PolygonsLayer';

jest.mock('@rnmapbox/maps');

const tri = [{ lat: 38.9, lon: -77 }, { lat: 38.91, lon: -77 }, { lat: 38.9, lon: -76.99 }];

describe('PolygonsLayer', () => {
  it('draws fill, outline and label; only the outline/label source is tappable', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'points', points: tri } });
    if (!r.ok) throw new Error('setup');
    const onItemPress = jest.fn();
    await renderWithProviders(<PolygonsLayer missionId="m1" excludeId={null} onItemPress={onItemPress} />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect((props.ShapeSource['polygon-fills'].shape as { features: unknown[] }).features).toHaveLength(1));
    expect(props.ShapeSource['polygon-fills'].onPress).toBeUndefined();
    expect(props.FillLayer['polygons-fill']).toBeDefined();
    for (const id of ['polygons-halo', 'polygons-solid', 'polygons-dashed']) expect(props.LineLayer[id]).toBeDefined();
    expect(props.SymbolLayer['polygons-label']).toBeDefined();
    await act(async () =>
      (props.ShapeSource.polygons.onPress as (e: unknown) => void)({ features: [{ properties: { id: r.value.id } }], coordinates: { latitude: 38.905, longitude: -77 }, point: {} }),
    );
    expect(onItemPress).toHaveBeenCalledWith(r.value.id, { lat: 38.905, lon: -77 }, { kind: 'polygon', sidc: null });
  });

  it('hides hidden and excluded polygons on every layer', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name: 'IRON', shape: { kind: 'points', points: tri } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<PolygonsLayer missionId="m1" excludeId={r.value.id} />, ctx);
    const props = mapboxMock().__props;
    const hidden = JSON.stringify(hiddenFilter([r.value.id]));
    await waitFor(() => expect(JSON.stringify(props.FillLayer['polygons-fill'].filter)).toContain(hidden));
    expect(JSON.stringify(props.SymbolLayer['polygons-label'].filter)).toContain(hidden);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/map/layers` → FAIL.

- [ ] **Step 3: Implement**

Mock (`__mocks__/@rnmapbox/maps.tsx`): add `FillLayer: {}` to `__props` and

```tsx
export function FillLayer(props: Props) {
  __props.FillLayer[props.id ?? 'main'] = props;
  return null;
}
```

`mapbox-mock.ts`: add `'FillLayer'` to the `__props` key union.

`styles.ts` (import `FillLayerStyle` from `@rnmapbox/maps` alongside the others):

```ts
/** Light friendly-blue fill under polygon outlines. */
export const POLYGON_FILL_OPACITY = 0.15;

export function makePolygonFillStyle(colors: Record<SemanticToken, string>): FillLayerStyle {
  return { fillColor: colors.friendly, fillOpacity: POLYGON_FILL_OPACITY };
}

/** "OBJ IRON" chip centered in the polygon. */
export function makePolygonLabelStyle(colors: Record<SemanticToken, string>): SymbolLayerStyle {
  return { ...makePointLabelStyle(colors), textField: ['get', 'label'], textAnchor: 'center', textOffset: [0, 0] };
}
```

`src/features/map/layers/PolygonsLayer.tsx`:

```tsx
import { FillLayer, LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { createPolygonFeatureSelector } from '@/features/map-items/polygon-selectors';
import { observeHiddenItemIds, observeMissionItems, type MapItemSnapshot } from '@/features/map-items/repository';
import { hiddenFilter } from '@/features/map-items/selectors';
import type { ItemRef } from '@/features/symbology/categories';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useTheme } from '@/theme/ThemeProvider';

import { makeLineDashedStyle, makeLineHaloStyle, makeLineStyle, makePolygonFillStyle, makePolygonLabelStyle } from './styles';

type Filter = ComponentProps<typeof LineLayer>['filter'];
const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];
const all = (...parts: unknown[]) => ['all', ...parts] as unknown as Filter;
const OUTLINE = ['==', ['get', 'role'], 'outline'];

type Props = { missionId: string; excludeId?: string | null; onItemPress?: (id: string, at: LatLon, item: ItemRef) => void };

/** Saved polygons: a light fill (not tappable, so taps inside reach the map), then outline and label (tappable). */
export function PolygonsLayer({ missionId, excludeId = null, onItemPress }: Props) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const select = useMemo(() => createPolygonFeatureSelector(), []);
  const { fills, shapes } = useMemo(() => select(items), [select, items]);
  const visible = useMemo(() => hiddenFilter(excludeId ? [...hiddenIds, excludeId] : hiddenIds), [hiddenIds, excludeId]);
  const styles = useMemo(
    () => ({
      fill: makePolygonFillStyle(colors),
      halo: makeLineHaloStyle(colors),
      solid: makeLineStyle(colors),
      dashed: makeLineDashedStyle(colors),
      label: makePolygonLabelStyle(colors),
    }),
    [colors],
  );

  return (
    <>
      <ShapeSource id="polygon-fills" shape={fills}>
        <FillLayer id="polygons-fill" style={styles.fill} filter={visible as unknown as Filter} />
      </ShapeSource>
      <ShapeSource
        id="polygons"
        shape={shapes}
        onPress={(e) => {
          const id = e.features[0]?.properties?.id;
          if (typeof id === 'string') onItemPress?.(id, { lat: e.coordinates.latitude, lon: e.coordinates.longitude }, { kind: 'polygon', sidc: null });
        }}>
        <LineLayer id="polygons-halo" style={styles.halo} filter={all(visible, OUTLINE)} />
        <LineLayer id="polygons-solid" style={styles.solid} filter={all(visible, OUTLINE, ['==', ['get', 'dash'], 'solid'])} />
        <LineLayer id="polygons-dashed" style={styles.dashed} filter={all(visible, OUTLINE, ['==', ['get', 'dash'], 'dashed'])} />
        <SymbolLayer id="polygons-label" style={styles.label} filter={all(visible, ['==', ['get', 'role'], 'label'])} />
      </ShapeSource>
    </>
  );
}
```

`MissionMap.tsx`: import and render `<PolygonsLayer missionId={missionId} excludeId={editingId} onItemPress={onItemPress} />` inside `<MapCanvas>` **before** `<LinesLayer …/>` (areas under lines and symbols).

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src __mocks__ && git commit -m "feat: draw saved polygons with fill, outline and center label"`

---

### Task 5: Polygon draft on the map

**Files:**
- Create: `src/features/map/layers/draft-polygon-features.ts` (+ `.test.ts`), `src/features/map/layers/DraftPolygonLayer.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: draft polygon state, `circleRing`, `ringCenter`, `polygonLabel`, `polygonTypeInfo`, `segmentLengths`, `formatDistance`, `midpoint`, `destination`.
- Produces: `draftPolygonFeatures(d: { polygonShape; vertices; selected; center: LatLon | null; radiusM: number | null; polygonType; name; showDistances }): FeatureCollection` with roles `'fill' | 'outline' | 'segment' | 'vertex' | 'center' | 'radius' | 'label'`; `DraftPolygonLayer({ onVertexPress, onPress })`.

- [ ] **Step 1: Write the failing tests**

`src/features/map/layers/draft-polygon-features.test.ts`:

```ts
import { draftPolygonFeatures } from './draft-polygon-features';

const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 + (n % 2) / 100 });
const base = { polygonShape: 'points' as const, vertices: [], selected: null, center: null, radiusM: null, polygonType: 'objective' as const, name: 'IRON', showDistances: true };

describe('draftPolygonFeatures', () => {
  it('closes a points polygon with a fill, a chip per side and the label', () => {
    const fc = draftPolygonFeatures({ ...base, vertices: [p(0), p(1), p(2)], selected: 2 });
    expect(fc.features.map((f) => f.properties.role)).toEqual(['fill', 'outline', 'segment', 'segment', 'segment', 'vertex', 'vertex', 'vertex', 'label']);
    expect(fc.features.find((f) => f.properties.role === 'label')!.properties.label).toBe('OBJ IRON');
    expect(fc.features.filter((f) => f.properties.role === 'vertex').map((f) => f.properties.selected)).toEqual([false, false, true]);
  });

  it('draws an open line for 2 points and no chips when distances are off', () => {
    const fc = draftPolygonFeatures({ ...base, vertices: [p(0), p(1)], showDistances: false });
    expect(fc.features.map((f) => f.properties.role)).toEqual(['outline', 'vertex', 'vertex']);
  });

  it('draws a circle: center only, then ring, fill and radius chip', () => {
    const c = { lat: 38.9, lon: -77 };
    expect(draftPolygonFeatures({ ...base, polygonShape: 'circle', center: c }).features.map((f) => f.properties.role)).toEqual(['center']);
    const fc = draftPolygonFeatures({ ...base, polygonShape: 'circle', center: c, radiusM: 500 });
    expect(fc.features.map((f) => f.properties.role)).toEqual(['fill', 'outline', 'center', 'radius', 'label']);
    expect(fc.features.find((f) => f.properties.role === 'radius')!.properties.label).toBe('r 500 m');
    expect((fc.features.find((f) => f.properties.role === 'outline')!.geometry.coordinates as unknown[]).length).toBe(65);
  });
});
```

`src/features/map/layers/DraftPolygonLayer.test.tsx`:

```tsx
import { act } from '@testing-library/react-native';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { DraftPolygonLayer } from './DraftPolygonLayer';

jest.mock('@rnmapbox/maps');

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('DraftPolygonLayer', () => {
  it('draws the draft, selects a vertex, and passes other taps on as map taps', async () => {
    const onVertexPress = jest.fn();
    const onPress = jest.fn();
    useDraft.getState().startAddPolygon();
    for (const lat of [38.9, 38.91, 38.92]) useDraft.getState().addVertex({ lat, lon: lat === 38.91 ? -76.99 : -77 });
    await renderWithProviders(<DraftPolygonLayer onVertexPress={onVertexPress} onPress={onPress} />);
    const props = mapboxMock().__props;
    expect(props.FillLayer['draft-polygon-fill']).toBeDefined();
    for (const id of ['draft-polygon-halo', 'draft-polygon-solid', 'draft-polygon-dashed']) expect(props.LineLayer[id]).toBeDefined();
    for (const id of ['draft-polygon-segment', 'draft-polygon-selected', 'draft-polygon-vertex', 'draft-polygon-center', 'draft-polygon-radius', 'draft-polygon-label']) {
      expect(props.SymbolLayer[id]).toBeDefined();
    }
    const press = props.ShapeSource['draft-polygon'].onPress as (e: unknown) => void;
    await act(async () => press({ features: [{ properties: { role: 'label' } }, { properties: { role: 'vertex', index: 2 } }], coordinates: { latitude: 38.92, longitude: -77 }, point: {} }));
    expect(onVertexPress).toHaveBeenCalledWith(2);
    await act(async () => press({ features: [{ properties: { role: 'fill' } }], coordinates: { latitude: 38.91, longitude: -76.995 }, point: {} }));
    expect(onPress).toHaveBeenCalledWith({ lat: 38.91, lon: -76.995 });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/map/layers` → FAIL.

- [ ] **Step 3: Implement**

`src/features/map/layers/draft-polygon-features.ts`:

```ts
import { segmentLengths } from '@/features/map-items/line-measure';
import { circleRing, ringCenter } from '@/features/map-items/polygon-measure';
import { polygonLabel, polygonTypeInfo, type PolygonType } from '@/features/symbology/polygon-types';
import { formatDistance } from '@/lib/geo/format/measure';
import { destination, inverse, midpoint } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

type Role = 'fill' | 'outline' | 'segment' | 'vertex' | 'center' | 'radius' | 'label';
type Props = { role: Role; label?: string; number?: string; index?: number; selected?: boolean; dash?: string };
type Feature =
  | { type: 'Feature'; id: string; geometry: { type: 'Polygon'; coordinates: [number, number][][] }; properties: Props }
  | { type: 'Feature'; id: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; properties: Props }
  | { type: 'Feature'; id: string; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Props };

export type DraftPolygonInput = {
  polygonShape: 'points' | 'circle';
  vertices: LatLon[];
  selected: number | null;
  center: LatLon | null;
  radiusM: number | null;
  polygonType: PolygonType;
  name: string;
  showDistances: boolean;
};

const lonLat = (p: LatLon): [number, number] => [p.lon, p.lat];
const pt = (id: string, p: LatLon, properties: Props): Feature => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: lonLat(p) }, properties });

function closedShape(ring: LatLon[], dash: string): Feature[] {
  const coords = [...ring.map(lonLat), lonLat(ring[0])];
  return [
    { type: 'Feature', id: 'fill', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { role: 'fill' } },
    { type: 'Feature', id: 'outline', geometry: { type: 'LineString', coordinates: coords }, properties: { role: 'outline', dash } },
  ];
}

/** The polygon being drawn: Points (closed from 3, numbered markers, side chips) or Circle (center, ring, radius chip). */
export function draftPolygonFeatures(d: DraftPolygonInput): { type: 'FeatureCollection'; features: Feature[] } {
  const dash = polygonTypeInfo(d.polygonType).dash;
  const label = d.name.trim() ? polygonLabel(d.polygonType, d.name) : '';
  const features: Feature[] = [];
  if (d.polygonShape === 'circle') {
    if (!d.center) return { type: 'FeatureCollection', features };
    if (d.radiusM) features.push(...closedShape(circleRing(d.center, d.radiusM), dash));
    features.push(pt('center', d.center, { role: 'center' }));
    if (d.radiusM) {
      features.push(pt('radius', destination(d.center, 90, d.radiusM), { role: 'radius', label: `r ${formatDistance(d.radiusM)}` }));
      if (label) features.push(pt('label', d.center, { role: 'label', label }));
    }
    return { type: 'FeatureCollection', features };
  }
  const v = d.vertices;
  if (v.length >= 3) features.push(...closedShape(v, dash));
  else if (v.length === 2) features.push({ type: 'Feature', id: 'outline', geometry: { type: 'LineString', coordinates: v.map(lonLat) }, properties: { role: 'outline', dash } });
  if (d.showDistances && v.length >= 2) {
    const sides = segmentLengths(v).map((m, i) => ({ m, a: v[i], b: v[i + 1] }));
    if (v.length >= 3) sides.push({ m: inverse(v[v.length - 1], v[0]).distanceM, a: v[v.length - 1], b: v[0] });
    sides.forEach((s, i) => features.push(pt(`segment-${i}`, midpoint(s.a, s.b), { role: 'segment', label: formatDistance(s.m) })));
  }
  v.forEach((p, i) => features.push(pt(`vertex-${i}`, p, { role: 'vertex', number: String(i + 1), index: i, selected: d.selected === i })));
  if (v.length >= 3 && label) features.push(pt('label', ringCenter(v), { role: 'label', label }));
  return { type: 'FeatureCollection', features };
}
```

`src/features/map/layers/DraftPolygonLayer.tsx`:

```tsx
import { FillLayer, LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import type { LatLon } from '@/lib/geo/types';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { draftPolygonFeatures } from './draft-polygon-features';
import {
  makeLineDashedStyle,
  makeLineHaloStyle,
  makeLineStyle,
  makePolygonFillStyle,
  makePolygonLabelStyle,
  makeRangeLabelStyle,
} from './styles';

type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const role = (r: string, extra?: unknown[]) => (extra ? ['all', ['==', ['get', 'role'], r], extra] : ['==', ['get', 'role'], r]) as unknown as Filter;

const VERTEX_STYLE = {
  iconImage: MAP_IMAGE_IDS.lineVertex,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
  textField: ['get', 'number'],
  textSize: 11,
  textAllowOverlap: true,
  textIgnorePlacement: true,
} as const;
const CENTER_STYLE = { iconImage: MAP_IMAGE_IDS.lineVertex, iconAllowOverlap: true, iconIgnorePlacement: true } as const;
const SELECTED_STYLE = { iconImage: MAP_IMAGE_IDS.draftRing, iconAllowOverlap: true, iconIgnorePlacement: true } as const;

/** The polygon being added or edited (also while viewing a saved one). Taps that miss a vertex count as map taps. */
export function DraftPolygonLayer({ onVertexPress, onPress }: { onVertexPress?: (index: number) => void; onPress?: (at: LatLon) => void }) {
  const { colors } = useTheme();
  const polygonShape = useDraft((s) => s.polygonShape);
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const center = useDraft((s) => s.coord);
  const radiusM = useDraft((s) => s.circleRadiusM);
  const polygonType = useDraft((s) => s.polygonType);
  const name = useDraft((s) => s.name);
  const showDistances = useSettings((s) => s.showLineDistances);
  const shape = useMemo(
    () => draftPolygonFeatures({ polygonShape, vertices, selected, center, radiusM, polygonType, name, showDistances }),
    [polygonShape, vertices, selected, center, radiusM, polygonType, name, showDistances],
  );
  const styles = useMemo(
    () => ({
      fill: makePolygonFillStyle(colors),
      halo: makeLineHaloStyle(colors),
      solid: makeLineStyle(colors),
      dashed: makeLineDashedStyle(colors),
      chip: makeRangeLabelStyle(colors),
      label: makePolygonLabelStyle(colors),
      vertex: { ...VERTEX_STYLE, textColor: colors['surface-input'] },
    }),
    [colors],
  );

  return (
    <ShapeSource
      id="draft-polygon"
      shape={shape}
      onPress={(e) => {
        const index = e.features.find((f) => f.properties?.role === 'vertex')?.properties?.index;
        if (typeof index === 'number') onVertexPress?.(index);
        else onPress?.({ lat: e.coordinates.latitude, lon: e.coordinates.longitude });
      }}>
      <FillLayer id="draft-polygon-fill" style={styles.fill} filter={role('fill') as never} />
      <LineLayer id="draft-polygon-halo" style={styles.halo} filter={role('outline') as never} />
      <LineLayer id="draft-polygon-solid" style={styles.solid} filter={role('outline', ['==', ['get', 'dash'], 'solid']) as never} />
      <LineLayer id="draft-polygon-dashed" style={styles.dashed} filter={role('outline', ['==', ['get', 'dash'], 'dashed']) as never} />
      <SymbolLayer id="draft-polygon-segment" style={styles.chip} filter={role('segment')} />
      <SymbolLayer id="draft-polygon-radius" style={styles.chip} filter={role('radius')} />
      <SymbolLayer id="draft-polygon-selected" style={SELECTED_STYLE} filter={role('vertex', ['==', ['get', 'selected'], true])} />
      <SymbolLayer id="draft-polygon-vertex" style={styles.vertex} filter={role('vertex')} />
      <SymbolLayer id="draft-polygon-center" style={CENTER_STYLE} filter={role('center')} />
      <SymbolLayer id="draft-polygon-label" style={styles.label} filter={role('label')} />
    </ShapeSource>
  );
}
```

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: polygon draft layer for points and circles"`

---

### Task 6: Polygon menus

**Files:**
- Create: `src/features/map-items/menus/PolygonSample.tsx`, `src/features/map-items/menus/PolygonForm.tsx`, `src/features/map-items/menus/AddPolygonMenu.tsx` (+ test), `src/features/map-items/menus/EditPolygonMenu.tsx` (+ test)
- Modify: `src/features/symbology/categories.ts` (+ test), `src/features/map-items/menus/item-adapters.ts`, `item-menus.ts`, `AddItemPanel.tsx`, `form/LocationSection.tsx`, `src/features/map-items/layer-rows.ts` (counts key), `src/features/menus/params.ts`, `src/features/menus/registry.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `MenuVertexRow`, `MgrsInput`, `MenuSegmented`, `MenuSelect`, `LocationSection`.
- Produces: `ItemCategory` adds `'polygon'`; `ITEM_ADAPTERS.polygon`; menu ids `polygon.add` / `polygon.edit`; `PolygonSample({ polygonType, size? })`.

- [ ] **Step 1: Write the failing tests**

`categories.test.ts` — add to the `itemCategory` test: `expect(itemCategory({ kind: 'polygon', sidc: null })).toBe('polygon');`

`src/features/map-items/menus/AddPolygonMenu.test.tsx`:

```tsx
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { selectOptionLabels } from '@/test-utils/menu-select';
import { renderWithProviders } from '@/test-utils/render';

import { parsePolygonGeometry } from '../geometry';
import { observeMissionItems } from '../repository';
import { AddPolygonMenu } from './AddPolygonMenu';

const C = { lat: 38.9, lon: -77 };
const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 + (n % 2) / 100 });

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
  useMenu.getState().openMenu('polygon.add', {});
});

async function open(ctx = makeTestContext()) {
  await renderWithProviders(<AddPolygonMenu params={{}} missionId="m1" />, ctx);
  expect(screen.getByRole('header')).toHaveTextContent('Add polygon');
  return ctx;
}
const items = (ctx: ReturnType<typeof makeTestContext>) => firstValueFrom(observeMissionItems(ctx.db, 'm1'));

describe('AddPolygonMenu', () => {
  it('saves a points polygon once it has a name and 3 points, and blocks removal at 3', async () => {
    const ctx = await open();
    await act(async () => {
      for (const n of [0, 1]) useDraft.getState().addVertex(p(n));
    });
    await fireEvent.changeText(screen.getByLabelText('Name'), 'IRON');
    expect(screen.getByLabelText('Save')).toBeDisabled();
    await act(async () => useDraft.getState().addVertex(p(2)));
    expect(screen.getByLabelText('Remove point 1')).toBeDisabled();
    expect(screen.getByText('A polygon needs at least 3 points')).toBeTruthy();
    expect(screen.getByText(/km² *$|m² *$/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    const [item] = await items(ctx);
    expect(item).toMatchObject({ kind: 'polygon', name: 'IRON', style: '{"polygonType":"objective","shape":"points"}' });
    expect(parsePolygonGeometry(item.geometry)).toHaveLength(3);
    expect(useMenu.getState().stack).toEqual([{ id: 'polygon.edit', params: { itemId: item.id } }]);
  });

  it('saves a circle from the crosshair center and a typed radius in km; bad radii keep Save off', async () => {
    const ctx = await open();
    await fireEvent.changeText(screen.getByLabelText('Name'), '1');
    await fireEvent.press(screen.getByLabelText('Circle'));
    await fireEvent.press(screen.getByLabelText('Center'));
    for (const bad of ['', '0', '-3', 'abc']) {
      await fireEvent.changeText(screen.getByLabelText('Radius'), bad);
      expect(screen.getByLabelText('Save')).toBeDisabled();
    }
    await fireEvent.press(screen.getByLabelText('km'));
    await fireEvent.changeText(screen.getByLabelText('Radius'), '1.5');
    expect(useDraft.getState().circleRadiusM).toBe(1500);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect(JSON.parse((await items(ctx))[0].style!)).toEqual({ polygonType: 'objective', shape: 'circle', center: C, radiusM: 1500 });
  });

  it('keeps the points while switching to Circle and back, and saves only the shape showing', async () => {
    const ctx = await open();
    await act(async () => {
      for (const n of [0, 1, 2]) useDraft.getState().addVertex(p(n));
    });
    await fireEvent.changeText(screen.getByLabelText('Name'), 'IRON');
    await fireEvent.press(screen.getByLabelText('Circle'));
    expect(screen.queryByText('POINTS · 3')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Points'));
    expect(screen.getByText('POINTS · 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect(JSON.parse((await items(ctx))[0].style!).shape).toBe('points');
  });

  it('lists polygon types alphabetically', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Polygon type: Objective'));
    expect(selectOptionLabels()).toEqual([
      'Airspace coordination area',
      'Assembly area',
      'Battle position',
      'Engagement area',
      'Free fire area',
      'Named area of interest',
      'No fire area',
      'Objective',
      'Restrictive fire area',
      'Target area of interest',
    ]);
  });
});
```

`src/features/map-items/menus/EditPolygonMenu.test.tsx`:

```tsx
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { MenuHost } from '@/features/menus/MenuHost';
import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { placePoint, placePolygon } from '../commands';
import { findItem } from '../repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

const C = { lat: 38.9, lon: -77 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useToast.setState({ toast: null });
});

describe('EditPolygonMenu', () => {
  it('opens a circle read-only with its exact center and radius, and saves a new radius', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'circle', center: C, radiusM: 500 } });
    if (!r.ok) throw new Error('setup');
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('polygon.edit', { itemId: r.value.id }));
    await screen.findByDisplayValue('1');
    expect(screen.getByRole('header')).toHaveTextContent('Polygon');
    expect(screen.getByLabelText('Radius')).toHaveDisplayValue('500');
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(mgrsFieldsFor(C).northing);
    await fireEvent.press(screen.getByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Radius'), '750');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(JSON.parse((await findItem(ctx.db, r.value.id))!.style!).radiusM).toBe(750));
  });

  it('reports an unreadable polygon and redirects other categories', async () => {
    const ctx = makeTestContext();
    const bad = await placePolygon(ctx, { missionId: 'm1', polygonType: 'objective', name: 'BAD', shape: { kind: 'points', points: [C, { lat: 38.91, lon: -77 }, { lat: 38.9, lon: -76.99 }] } });
    const unit = await placePoint(ctx, { missionId: 'm1', coord: C, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    if (!bad.ok || !unit.ok) throw new Error('setup');
    await ctx.db.write(async () => {
      const record = await findItem(ctx.db, bad.value.id);
      await record!.update((m) => {
        m.geometry = 'nope';
      });
    });
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />, ctx);
    await act(async () => useMenu.getState().openMenu('polygon.edit', { itemId: bad.value.id }));
    await waitFor(() => expect(useToast.getState().toast?.message).toBe('That polygon no longer exists.'));
    await act(async () => useMenu.getState().openMenu('polygon.edit', { itemId: unit.value.id }));
    await waitFor(() => expect(useMenu.getState().stack).toEqual([{ id: 'unit.edit', params: { itemId: unit.value.id } }]));
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/symbology src/features/map-items/menus` → FAIL.

- [ ] **Step 3: Implement**

`categories.ts`: `ItemCategory = 'unit' | 'point' | 'line' | 'polygon'`; `itemCategory`: `if (item.kind === 'polygon') return 'polygon';` before the line check.

`layer-rows.ts`: `const counts = { unit: 0, point: 0, line: 0, polygon: 0 };` (rows/summary for polygons come in Task 8).

`item-menus.ts`: `ITEM_COPY.polygon = { noun: 'polygon', title: 'Polygon' }`; in `openItemMenu`, `else if (category === 'polygon') useMenu.getState().openMenu('polygon.edit', { itemId });`.

`params.ts`: `'polygon.add': z.object({})`, `'polygon.edit': z.object({ itemId: z.string().min(1) })`. `registry.ts`: register `addPolygonMenu`, `editPolygonMenu` (keys in order).

`AddItemPanel.tsx`: start effect `if (category === 'line') useDraft.getState().startAddLine(); else if (category === 'polygon') useDraft.getState().startAddPolygon(); else { …startAdd… }`; trailing label `category === 'line' || category === 'polygon' ? 'Save' : 'Add'`.

`LocationSection.tsx`: `const noun = useDraft((s) => (s.category === 'point' ? 'point' : s.category === 'polygon' ? 'center' : 'unit'));`.

`item-adapters.ts` (imports `placePolygon, updatePolygon`, `parsePolygonGeometry`, `polygonStyleOf`, `MAX_RADIUS_M`, `type PolygonShapeInput`):

```ts
const polygonShape = (d: DraftState): PolygonShapeInput =>
  d.polygonShape === 'circle' ? { kind: 'circle', center: d.coord!, radiusM: d.circleRadiusM! } : { kind: 'points', points: d.vertices };

const polygonAdapter: ItemAdapter = {
  canSave: (d) =>
    d.name.trim() !== '' &&
    (d.polygonShape === 'circle'
      ? d.coord !== null && d.coordInputValid && d.circleRadiusM !== null && d.circleRadiusM > 0 && d.circleRadiusM <= MAX_RADIUS_M
      : d.vertices.length >= 3),
  place: (ctx, missionId, d) => placePolygon(ctx, { missionId, polygonType: d.polygonType, name: d.name, notes: notes(d), shape: polygonShape(d) }),
  update: (ctx, id, d) => updatePolygon(ctx, id, { polygonType: d.polygonType, name: d.name, notes: notes(d), shape: polygonShape(d) }),
  select: (item) => {
    const ring = parsePolygonGeometry(item.geometry);
    if (!ring) return false;
    const { polygonType, shape } = polygonStyleOf(item.style);
    useDraft.getState().startEditPolygon({
      itemId: item.id,
      polygonType,
      shape: shape.kind === 'circle' ? shape : { kind: 'points', points: ring },
      ring,
      name: item.name,
      notes: item.notes ?? '',
    });
    return true;
  },
  ref: () => ({ kind: 'polygon', sidc: null }),
};
```

and `ITEM_ADAPTERS` gains `polygon: polygonAdapter`.

`PolygonSample.tsx`:

```tsx
import { View } from 'react-native';

import { polygonTypeInfo, type PolygonType } from '@/features/symbology/polygon-types';
import { useTheme } from '@/theme/ThemeProvider';

/** A small area swatch: friendly outline (dashed for fire-control areas) over a light fill. */
export function PolygonSample({ polygonType, size = 22 }: { polygonType: PolygonType; size?: number }) {
  const { colors } = useTheme();
  const dashed = polygonTypeInfo(polygonType).dash === 'dashed';
  return (
    <View style={{ width: size, height: size * 0.72, borderWidth: 2, borderRadius: 3, borderColor: colors.friendly, borderStyle: dashed ? 'dashed' : 'solid' }}>
      <View style={{ flex: 1, backgroundColor: colors.friendly, opacity: 0.15 }} />
    </View>
  );
}
```

`PolygonForm.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { MenuVertexRow } from '@/components/menu/MenuVertexRow';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { TextField } from '@/components/ui/TextField';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { POLYGON_TYPES, type PolygonType } from '@/features/symbology/polygon-types';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { formatDistance } from '@/lib/geo/format/measure';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';

import { canRemove } from '../line-draft';
import { segmentLengths } from '../line-measure';
import { areaM2, circleRing, formatArea, perimeterM } from '../polygon-measure';
import { LocationSection } from './form/LocationSection';
import { PolygonSample } from './PolygonSample';

// Listed alphabetically in the dropdown.
const TYPE_OPTIONS = POLYGON_TYPES.map((t) => ({ value: t.id, label: t.label, icon: <PolygonSample polygonType={t.id} /> })).sort((a, b) =>
  a.label.localeCompare(b.label),
);
const SHAPES = [
  { value: 'points' as const, label: 'Points' },
  { value: 'circle' as const, label: 'Circle' },
];
const UNITS = [
  { value: 'm' as const, label: 'm' },
  { value: 'km' as const, label: 'km' },
];

const radiusText = (m: number | null, unit: 'm' | 'km') => (m === null ? '' : unit === 'km' ? String(Number((m / 1000).toFixed(3))) : String(Math.round(m)));

/** Add/Edit polygon: name, type, shape (points list or circle center + radius), notes. Edits only the draft store. */
export function PolygonForm() {
  const name = useDraft((s) => s.name);
  const notes = useDraft((s) => s.notes);
  const polygonType = useDraft((s) => s.polygonType);
  const shape = useDraft((s) => s.polygonShape);
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const insertAfter = useDraft((s) => s.insertAfter);
  const center = useDraft((s) => s.coord);
  const radiusM = useDraft((s) => s.circleRadiusM);
  const locked = useDraft((s) => s.locked);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const showDistances = useSettings((s) => s.showLineDistances);
  const [parts, setParts] = useState<MgrsParts>(EMPTY_MGRS);
  const [showNotes, setShowNotes] = useState(notes !== '');
  const [unit, setUnit] = useState<'m' | 'km'>(radiusM !== null && radiusM >= 1000 ? 'km' : 'm');
  const [radius, setRadius] = useState(() => radiusText(radiusM, unit));
  const status = evaluateMgrsFields(parts);
  const segs = segmentLengths(vertices);
  const edit = { vertices, selected, insertAfter };
  const moving = selected !== null && insertAfter === null;

  // A radius set on the map (edge tap) rewrites the field; typing does not fight it.
  useEffect(() => {
    const typed = Number(radius) * (unit === 'km' ? 1000 : 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing field text from an external store change
    if (radiusM !== null && Math.abs(typed - radiusM) > 0.5) setRadius(radiusText(radiusM, unit));
  }, [radiusM]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRadius = (text: string) => {
    setRadius(text);
    const value = text.trim() === '' ? NaN : Number(text);
    useDraft.getState().setCircleRadius(value * (unit === 'km' ? 1000 : 1));
  };
  const onUnit = (next: 'm' | 'km') => {
    setUnit(next);
    const value = radius.trim() === '' ? NaN : Number(radius);
    useDraft.getState().setCircleRadius(value * (next === 'km' ? 1000 : 1));
  };

  const submitTyped = () => {
    if (status.status !== 'valid') return;
    const d = useDraft.getState();
    if (moving) d.moveVertex(selected, status.coord);
    else d.addVertex(status.coord);
    setParts(EMPTY_MGRS);
  };
  const select = (i: number) => {
    useDraft.getState().selectVertex(i);
    setParts(selected === i ? EMPTY_MGRS : mgrsFieldsFor(vertices[i]));
  };

  const blocked = !locked && vertices.length === 3;
  const pointsTrailing = vertices.length >= 3 ? `${formatDistance(perimeterM(vertices))} · ${formatArea(areaM2(vertices))}` : undefined;
  const circleArea = center && radiusM ? formatArea(areaM2(circleRing(center, radiusM))) : undefined;

  return (
    <View>
      <MenuSection label="Name">
        <TextField mono editable={!locked} accessibilityLabel="Name" value={name} onChangeText={(t) => useDraft.getState().setName(t)} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <MenuSection label="Polygon type">
        <MenuSelect<PolygonType> label="Polygon type" options={TYPE_OPTIONS} value={polygonType} onChange={(t) => useDraft.getState().setPolygonType(t)} disabled={locked} />
      </MenuSection>
      <MenuSection label="Shape">
        <MenuSegmented<'points' | 'circle'> options={SHAPES} value={shape} onChange={(s) => useDraft.getState().setPolygonShape(s)} disabled={locked} />
      </MenuSection>
      {shape === 'points' ? (
        <>
          <MenuSection label={`POINTS · ${vertices.length}`} trailing={pointsTrailing}>
            {vertices.map((v, i) => (
              <MenuVertexRow
                key={i}
                number={i + 1}
                title={formatCoordinate(v, coordinateFormat)}
                detail={i === 0 ? 'start' : `+${formatDistance(segs[i - 1])}`}
                selected={selected === i}
                disabled={locked}
                onPress={() => select(i)}
                onRemove={() => useDraft.getState().removeVertex(i)}
                removeDisabled={!canRemove(edit, i, 3)}
                onInsertAfter={() => useDraft.getState().startInsertAfter(i)}
              />
            ))}
            {blocked ? <Text className="text-sm text-text-muted">A polygon needs at least 3 points</Text> : null}
          </MenuSection>
          {locked ? null : (
            <MenuSection label={moving ? `Move point ${selected! + 1}` : 'New point'}>
              <MgrsInput value={parts} onChange={setParts} status={status} onSubmit={submitTyped} />
              <MenuButton
                label={moving ? `Move point ${selected! + 1} to typed grid` : 'Add new point'}
                icon={moving ? 'check' : 'plus'}
                onPress={submitTyped}
                disabled={status.status !== 'valid'}
              />
            </MenuSection>
          )}
        </>
      ) : (
        <>
          <LocationSection />
          <MenuSection label="Radius" trailing={circleArea}>
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <TextField mono editable={!locked} accessibilityLabel="Radius" value={radius} onChangeText={onRadius} keyboardType="decimal-pad" placeholder="500" />
              </View>
              <View style={{ width: 120 }}>
                <MenuSegmented<'m' | 'km'> options={UNITS} value={unit} onChange={onUnit} disabled={locked} />
              </View>
            </View>
          </MenuSection>
        </>
      )}
      <MenuSection>
        <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={(t) => useDraft.getState().setNotes(t)} multiline placeholder="Notes" /> : null}
      </MenuSection>
      {shape === 'points' ? (
        <MenuSection>
          <MenuToggle label="Show point distances" value={showDistances} onValueChange={(v) => useSettings.getState().setShowLineDistances(v)} />
        </MenuSection>
      ) : null}
    </View>
  );
}
```

(`MenuSegmented` option buttons are labelled by their `label` — `getByLabelText('Circle')` / `'km'` rely on that; check `MenuSegmented.tsx` and add `accessibilityLabel={option.label}` to its option Pressable if it is not already there.)

`AddPolygonMenu.tsx` / `EditPolygonMenu.tsx`:

```tsx
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { AddItemPanel } from './AddItemPanel';
import { PolygonForm } from './PolygonForm';

export function AddPolygonMenu({ missionId }: MenuComponentProps<'polygon.add'>) {
  return <AddItemPanel category="polygon" missionId={missionId} form={<PolygonForm />} />;
}

export const addPolygonMenu = defineMenu({ id: 'polygon.add', family: 'action', title: 'Add polygon', detents: ['peek', 'half', 'full'], component: AddPolygonMenu });
```

```tsx
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';

import { EditItemPanel } from './EditItemPanel';
import { PolygonForm } from './PolygonForm';

export function EditPolygonMenu({ params, missionId }: MenuComponentProps<'polygon.edit'>) {
  return <EditItemPanel category="polygon" itemId={params.itemId} missionId={missionId} form={<PolygonForm />} />;
}

export const editPolygonMenu = defineMenu({ id: 'polygon.edit', family: 'action', title: 'Edit polygon', detents: ['peek', 'half', 'full'], component: EditPolygonMenu });
```

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS (existing unit/point/line menu tests still pass).

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: Add/Edit Polygon menus for points and circles"`

---

### Task 7: POLYGON tool and drawing interaction

**Files:**
- Modify: `src/features/toolbar/Toolbar.tsx` (+ test), `src/features/map/controls/LineDrawBar.tsx` (+ test), `src/features/map/MissionMap.tsx`, `src/features/map/MapScreen.test.tsx`

**Interfaces:**
- Consumes: draft polygon actions, `DraftPolygonLayer`, `PolygonsLayer`.
- Produces: `ToolId` adds `'polygon'`; Toolbar `onPolygon`; `LineDrawBar` serves line and polygon drafts.

- [ ] **Step 1: Write the failing tests**

Toolbar test:

```tsx
  it('orders UNIT, POINT, LINE, POLYGON, MEASURE, LAYERS and marks POLYGON active', async () => {
    const onPolygon = jest.fn();
    await renderWithProviders(
      <Toolbar landscape={false} activeTool="polygon" onUnit={jest.fn()} onPoint={jest.fn()} onLine={jest.fn()} onPolygon={onPolygon} onMeasure={jest.fn()} onLayers={jest.fn()} />,
    );
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels.filter((l) => ['UNIT', 'POINT', 'LINE', 'POLYGON', 'MEASURE', 'LAYERS'].includes(l))).toEqual(['UNIT', 'POINT', 'LINE', 'POLYGON', 'MEASURE', 'LAYERS']);
    expect(screen.getByLabelText('POLYGON')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('POLYGON'));
    expect(onPolygon).toHaveBeenCalled();
  });
```

`LineDrawBar.test.tsx` (append inside the `describe`):

```tsx
  it('guides a circle: center at the crosshair, then the edge', async () => {
    await act(async () => {
      useDraft.getState().startAddPolygon();
      useDraft.getState().setPolygonShape('circle');
    });
    await renderWithProviders(<LineDrawBar panel={null} />);
    await fireEvent.press(screen.getByLabelText('Set center at crosshair'));
    expect(useDraft.getState().coord).toEqual(C);
    await act(async () => useInteraction.getState().setCamera({ center: { lat: 38.9045, lon: -77 }, zoom: 14, bearing: 0 }));
    await fireEvent.press(screen.getByLabelText('Set edge at crosshair'));
    expect(useDraft.getState().circleRadiusM).toBeCloseTo(500, -1);
    expect(screen.queryByLabelText('Undo')).toBeNull();
  });
```

`MapScreen.test.tsx` (add before `describe('measure'…)`):

```tsx
  it('POLYGON: taps add points, a unit tap adds a point, Circle takes center then edge, and a saved fill is not tappable', async () => {
    const ctx = makeTestContext();
    const r = await createMission(ctx, { name: 'Op Iron' });
    if (!r.ok) throw new Error('setup');
    const u = await placePoint(ctx, { missionId: r.value.id, coord: { lat: 38.95, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    const saved = await placePolygon(ctx, { missionId: r.value.id, polygonType: 'objective', name: 'IRON', shape: { kind: 'points', points: [{ lat: 39, lon: -77 }, { lat: 39.01, lon: -77 }, { lat: 39, lon: -76.99 }] } });
    if (!u.ok || !saved.ok) throw new Error('setup');
    await renderWithProviders(<MapScreen missionId={r.value.id} />, ctx);
    await waitFor(() => expect(mapboxMock().__props.ShapeSource['polygon-fills']).toBeDefined());
    expect(mapboxMock().__props.ShapeSource['polygon-fills'].onPress).toBeUndefined();
    await fireEvent.press(await screen.findByLabelText('POLYGON'));
    expect(await screen.findByRole('header')).toHaveTextContent('Add polygon');
    expect(screen.getByLabelText('POLYGON')).toBeSelected();
    const tap = (lon: number, lat: number) =>
      act(async () => (mapboxMock().__props.MapView.main.onPress as (f: unknown) => void)({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }));
    await tap(-77.01, 38.91);
    await tap(-77.02, 38.92);
    await act(async () =>
      (mapboxMock().__props.ShapeSource.points.onPress as (e: unknown) => void)({
        features: [{ properties: { id: u.value.id, sidc: 'SHGPUCI--------' } }],
        coordinates: { latitude: 38.95, longitude: -77 },
        point: {},
      }),
    );
    expect(useDraft.getState().vertices).toHaveLength(3);
    expect(screen.getByRole('header')).toHaveTextContent('Add polygon');
    await fireEvent.press(screen.getByLabelText('Circle'));
    await tap(-77, 38.9);
    expect(useDraft.getState().coord).toEqual({ lat: 38.9, lon: -77 });
    await tap(-77, 38.9045);
    expect(useDraft.getState().circleRadiusM).toBeCloseTo(500, -1);
  });
```

(import `placePolygon` alongside `placeLine, placePoint`.)

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/toolbar src/features/map` → FAIL.

- [ ] **Step 3: Implement**

Toolbar: `ToolId` adds `'polygon'`; prop `onPolygon?: () => void`; `<ToolButton icon="pentagon-outline" label="POLYGON" active={activeTool === 'polygon'} onPress={onPolygon} />` after LINE.

`LineDrawBar.tsx`:

```tsx
  const circle = useDraft((s) => s.category === 'polygon' && s.polygonShape === 'circle');
  const hasCenter = useDraft((s) => s.coord !== null);
  …
  const atCenter = () => {
    const center = useInteraction.getState().cameraCenter;
    if (!center) return;
    const d = useDraft.getState();
    if (circle) {
      if (d.coord === null) d.setCoord(center, 'crosshair');
      else d.setCircleEdge(center);
    } else if (moving) d.moveVertex(selected!, center);
    else d.addVertex(center);
  };
  const centerLabel = circle ? (hasCenter ? 'Set edge at crosshair' : 'Set center at crosshair') : moving ? 'Move to center' : 'Add at center';
```

Render the `centerLabel` button; the Undo/Done button only when `!circle`. Update its doc comment: "While drawing a line or polygon …".

`MissionMap.tsx`:
- `const lineDrawing = useDraft((s) => (s.category === 'line' || s.category === 'polygon') && s.mode !== null && !s.locked);`
- `const drawingPolygon = useDraft((s) => s.mode !== null && s.category === 'polygon');`
- `isDrawingLine` → `isDrawing`: `(d.category === 'line' || d.category === 'polygon') && d.mode !== null && !d.locked` (rename every use).
- `placeLinePoint` → `placeDraftPoint`:

```ts
  /** While a line or polygon is being drawn, map taps (and long-presses, and taps on symbols) go to it. */
  const placeDraftPoint = (at: LatLon) => {
    const d = useDraft.getState();
    if (d.category === 'polygon' && d.polygonShape === 'circle') {
      if (d.coord === null) d.setCoord(at, 'press');
      else d.setCircleEdge(at);
    } else if (d.selectedVertex !== null && d.insertAfter === null) d.moveVertex(d.selectedVertex, at);
    else d.addVertex(at);
  };
```

- `toggleAdd` accepts `'polygon.add'` (`openMenu('polygon.add', {})`); Toolbar `onPolygon={() => toggleAdd('polygon.add')}`; `activeTool` adds `topId === 'polygon.add' ? 'polygon'` (after line).
- Render `{drawingPolygon ? <DraftPolygonLayer onVertexPress={(i) => useDraft.getState().selectVertex(i)} onPress={onMapPress} /> : null}` next to `DraftLineLayer`.

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: POLYGON tool with tap-to-draw points and circles"`

---

### Task 8: Polygons in Layers and mission counts

**Files:**
- Modify: `src/features/map-items/layer-rows.ts` (+ test), `menus/LayersMenu.tsx` (+ test), `src/features/missions/repository.ts`, `format.ts` (+ tests), `MissionsScreen.tsx` (+ test), `missions.test.ts`

**Interfaces:**
- Produces: `LayerRow` gains `polygonType: PolygonType | null`, `areaM2: number | null`, `radiusM: number | null`; `LayerRows.polygons: number`; `observeMissionCategoryCounts → { units, points, lines, polygons }`; `formatCategoryCounts({ units, points, lines, polygons }, joiner?)`.

- [ ] **Step 1: Write the failing tests**

`layer-rows.test.ts`:

```ts
  it('lists polygons with type and area or radius, counts them, and searches their type', () => {
    const tri = JSON.stringify({ type: 'Polygon', coordinates: [[[-77, 38.9], [-76.99, 38.9], [-76.99, 38.91], [-77, 38.9]]] });
    const area = { ...item('a', 'IRON', null), kind: 'polygon' as const, style: '{"polygonType":"objective","shape":"points"}', geometry: tri };
    const circle = { ...item('c', '1', null), kind: 'polygon' as const, style: '{"polygonType":"no-fire-area","shape":"circle","center":{"lat":38.9,"lon":-77},"radiusM":500}', geometry: tri };
    const rows = layerRows([area, circle], [], '');
    expect(rows).toMatchObject({ units: 0, points: 0, lines: 0, polygons: 2, total: 2 });
    expect(rows.rows.find((r) => r.id === 'a')).toMatchObject({ kind: 'polygon', polygonType: 'objective', radiusM: null, coord: null });
    expect(rows.rows.find((r) => r.id === 'a')!.areaM2).toBeGreaterThan(0);
    expect(rows.rows.find((r) => r.id === 'c')).toMatchObject({ polygonType: 'no-fire-area', radiusM: 500 });
    expect(layerRows([area, circle], [], 'no fire').rows.map((r) => r.id)).toEqual(['c']);
  });
```

`format.test.ts`: `formatCategoryCounts({ units: 2, points: 1, lines: 0, polygons: 3 })` → `'2 units · 1 point · 0 lines · 3 polygons'`; with `' and '` → `'2 units, 1 point, 0 lines and 3 polygons'`.

`missions.test.ts`: every `{ units, points, lines }` expectation gains `polygons: 0`; the per-mission count test places one polygon and expects `polygons: 1`.

`MissionsScreen.test.tsx`: `'2 units · 0 points · 0 lines · 0 polygons · Never opened'`, `/^0 units · 0 points · 0 lines · 0 polygons · Opened /`, and `"Delete Op Iron and its 2 units, 0 points, 0 lines and 0 polygons? This can't be undone."`.

`LayersMenu.test.tsx`: summaries gain `· 0 polygons` before `· N hidden`; empty text `Nothing on the map yet. Use UNIT, POINT, LINE, POLYGON or long-press the map.`; add:

```tsx
  it('shows a polygon row with its type and radius, and opens the polygon when tapped', async () => {
    const ctx = makeTestContext();
    const r = await placePolygon(ctx, { missionId: 'm1', polygonType: 'no-fire-area', name: '1', shape: { kind: 'circle', center: at, radiusM: 500 } });
    if (!r.ok) throw new Error('setup');
    await openLayers(ctx);
    expect(await screen.findByText('0 units · 0 points · 0 lines · 1 polygon · 0 hidden')).toBeTruthy();
    expect(screen.getByText('No fire area · r 500 m')).toBeTruthy();
    await fireEvent.press(screen.getByText('1'));
    await waitFor(() => expect(topMenu(useMenu.getState())).toEqual({ id: 'polygon.edit', params: { itemId: r.value.id } }));
  });
```

- [ ] **Step 2: Run to verify failure** — `npx jest src/features/map-items src/features/missions` → FAIL.

- [ ] **Step 3: Implement**

`layer-rows.ts`: `LayerRow` adds `polygonType`, `areaM2`, `radiusM`; `LayerRows` adds `polygons: number`; search label `i.kind === 'line' ? … : i.kind === 'polygon' ? polygonTypeInfo(polygonStyleOf(i.style).polygonType).label : typeLabel(i.sidc)`; rows:

```ts
      const isPolygon = i.kind === 'polygon';
      const ring = isPolygon ? parsePolygonGeometry(i.geometry) : null;
      const pstyle = isPolygon ? polygonStyleOf(i.style) : null;
      …
        coord: isLine || isPolygon ? null : pointCoord(i.geometry),
        polygonType: pstyle ? pstyle.polygonType : null,
        areaM2: ring ? areaM2(ring) : null,
        radiusM: pstyle && pstyle.shape.kind === 'circle' ? pstyle.shape.radiusM : null,
```

(`sidc` stays `DEFAULT_SIDC` for polygons too: `!isLine && !isPolygon && …`); `polygons: counts.polygon`.

`LayersMenu.tsx`: summary adds `` · ${count(polygons)} ${polygons === 1 ? 'polygon' : 'polygons'} `` before hidden; empty text adds `POLYGON`; subtitle detail:

```ts
row.lineType
  ? `${lineTypeInfo(row.lineType).label} · ${formatDistance(row.length ?? 0)}`
  : row.polygonType
    ? `${polygonTypeInfo(row.polygonType).label} · ${row.radiusM !== null ? `r ${formatDistance(row.radiusM)}` : row.areaM2 !== null ? formatArea(row.areaM2) : '—'}`
    : row.coord
      ? formatCoordinate(row.coord, coordinateFormat)
      : '—'
```

leading: `row.polygonType ? <View style={{ width: 28, height: 20, justifyContent: 'center', alignItems: 'center' }}><PolygonSample polygonType={row.polygonType} /></View> : …`.

`missions/repository.ts`: add `items.query(inMission, Q.where('kind', 'polygon')).observeCount()` and return `polygons`.

`format.ts`:

```ts
/** "2 units · 1 point · 0 lines · 3 polygons" (row) or, with ' and ', "2 units, 1 point, 0 lines and 3 polygons" (sentence). */
export function formatCategoryCounts(c: { units: number; points: number; lines: number; polygons: number }, joiner = ' · '): string {
  const parts = [plural(c.units, 'unit'), plural(c.points, 'point'), plural(c.lines, 'line'), plural(c.polygons, 'polygon')];
  return joiner === ' and ' ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts.join(joiner);
}
```

`MissionsScreen.tsx`: `Counts` and `NO_COUNTS` gain `polygons`.

- [ ] **Step 4: Verify** — `npx jest && npx tsc --noEmit && npx expo lint` → PASS.

- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: polygons in Layers and mission counts"`

---

### Task 9: Docs, skills and device checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-tactical-map-architecture-design.md`, `.agents/skills/map-item-kinds/SKILL.md`, `.agents/skills/menus/SKILL.md`, `docs/superpowers/notes/2026-10-12-native-gate.md`

- [ ] **Step 1: Architecture spec** — after §5.4c add:

```markdown
### 5.4d Polygons
Military areas (10 types) are `kind = 'polygon'` items: a closed GeoJSON Polygon in `geometry`
(a circle is a 64-point ring) and `{ polygonType, shape, center?, radiusM? }` in `style`. They are
drawn point by point or as a circle (center + radius); only their outline and label are tappable.
See `2026-10-13-polygons-design.md`.
```

- [ ] **Step 2: map-item-kinds skill** — append:

```markdown
## Worked example: polygons

Polygons reuse the line recipe: `polygon-types.ts`, `polygonGeometry` / `parsePolygonGeometry`,
`placePolygon` / `updatePolygon`, `polygon-selectors.ts` (fills + outlines/labels), `PolygonsLayer`
(fill in its own non-touchable source), the draft store (line vertices with a 3-point minimum;
the circle center is the draft `coord`), `DraftPolygonLayer`, and `ITEM_ADAPTERS.polygon` so the
shared panels host `PolygonForm`.
```

- [ ] **Step 3: menus skill** — in "Item menus" add `polygon.add` / `polygon.edit` to the list and: "`PolygonForm` switches between the points list (as `LineForm`) and a circle (`LocationSection` for the center, a radius field with m/km)."

- [ ] **Step 4: Gate notes** — after the last row add:

```markdown
| 74 | Toolbar reads UNIT · POINT · LINE · POLYGON · MEASURE · LAYERS; POLYGON opens "Add polygon" with the draw bar | PENDING |
| 75 | Points: tap/Add at center/typed grids build a closed, lightly filled shape; side distances (incl. the closing side) and perimeter · area in the header; × disabled at 3 | PENDING |
| 76 | Circle: Set center at crosshair / map tap / typed center, then Set edge at crosshair / map tap or a typed radius (m or km); ring, "r 500 m" chip and area update | PENDING |
| 77 | Each polygon type's look on Satellite, Topo and Dark (dashed FFA/NFA/RFA/ACA); "OBJ IRON" label centered | PENDING |
| 78 | Tap a saved polygon's outline or label: the map fits it and "Polygon" opens; a tap inside its fill does not open it; Edit / Save / Cancel; edit a circle's radius; Hidden; Delete polygon | PENDING |
| 79 | Layers: polygon rows with a swatch and "Objective · 0.42 km²" / "No fire area · r 500 m"; search by type; summary and mission rows count polygons | PENDING |
```

- [ ] **Step 5: Verify and commit** — `npx expo lint` → 0 problems; `git add -A docs .agents && git commit -m "docs: polygons in the spec, skills and device checklist"`
