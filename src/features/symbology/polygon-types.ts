import type { LatLon } from '@/lib/geo/types';

import { mergeStyle } from './style-json';

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
  | 'airspace-coordination-area'
  | 'impact-area';

/** `color` is the affiliation token the outline and fill are drawn in. */
export type PolygonColor = 'friendly' | 'hostile';
export type PolygonTypeInfo = { id: PolygonType; label: string; prefix: string; dash: 'solid' | 'dashed'; color: PolygonColor };

const t = (id: PolygonType, label: string, prefix: string, dash: 'solid' | 'dashed' = 'solid', color: PolygonColor = 'friendly'): PolygonTypeInfo => ({
  id,
  label,
  prefix,
  dash,
  color,
});

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
  t('impact-area', 'Impact area', 'IA', 'solid', 'hostile'),
];

const BY_ID = new Map(POLYGON_TYPES.map((x) => [x.id, x]));

export function polygonTypeInfo(id: PolygonType): PolygonTypeInfo {
  return BY_ID.get(id)!;
}

/** "OBJ IRON"; the prefix is not repeated when the name already starts with it ("OBJ-2"). */
export function polygonLabel(type: PolygonType, name: string): string {
  const trimmed = name.trim();
  const prefix = polygonTypeInfo(type).prefix;
  if (trimmed.startsWith(`${prefix} `) || trimmed.startsWith(`${prefix}-`) || trimmed === prefix) return trimmed;
  return `${prefix} ${trimmed}`;
}

/** Points: the geometry is the shape. Circle: the exact center and radius (the geometry is a 64-point ring). */
export type PolygonShape = { kind: 'points' } | { kind: 'circle'; center: LatLon; radiusM: number };
export type PolygonStyle = { polygonType: PolygonType; shape: PolygonShape; fill: PolygonFill };

/** How solid a polygon's fill is, from see-through to nearly opaque; set per polygon in its menu. */
export type PolygonFill = 'none' | 'light' | 'medium' | 'heavy' | 'solid';
export const POLYGON_FILLS: readonly { id: PolygonFill; label: string; opacity: number }[] = [
  { id: 'none', label: '0%', opacity: 0 },
  { id: 'light', label: '15%', opacity: 0.15 },
  { id: 'medium', label: '30%', opacity: 0.3 },
  { id: 'heavy', label: '50%', opacity: 0.5 },
  { id: 'solid', label: '75%', opacity: 0.75 },
];
/** The fill of polygons saved without one: the original light fill. */
export const DEFAULT_POLYGON_FILL: PolygonFill = 'light';
const FILL_BY_ID = new Map(POLYGON_FILLS.map((f) => [f.id, f]));

export function polygonFillOpacity(fill: PolygonFill): number {
  return FILL_BY_ID.get(fill)!.opacity;
}

/** Largest circle the app accepts (500 km). */
export const MAX_RADIUS_M = 500_000;

/**
 * The style for a polygon; pass its current style when editing, to keep what this app does not know.
 * The default fill is left out, so polygons saved before fills existed read the same.
 */
export function polygonStyle(type: PolygonType, shape: PolygonShape, fill: PolygonFill, existing?: string | null): string {
  const base = shape.kind === 'circle' ? { polygonType: type, shape: 'circle', center: shape.center, radiusM: shape.radiusM } : { polygonType: type, shape: 'points' };
  return mergeStyle(existing, ['polygonType', 'shape', 'center', 'radiusM', 'fill'], fill === DEFAULT_POLYGON_FILL ? base : { ...base, fill });
}

const validCenter = (c: unknown): c is LatLon => {
  const p = c as Partial<LatLon> | null;
  return !!p && typeof p.lat === 'number' && typeof p.lon === 'number' && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
};

/** Parses `style`: unknown types read as Objective; a circle with a bad center or radius reads as Points; a missing or unknown fill reads as the default. */
export function polygonStyleOf(style: string | null): PolygonStyle {
  let v: { polygonType?: unknown; shape?: unknown; center?: unknown; radiusM?: unknown; fill?: unknown } = {};
  try {
    v = style ? (JSON.parse(style) ?? {}) : {};
  } catch {
    v = {};
  }
  const polygonType = typeof v.polygonType === 'string' && BY_ID.has(v.polygonType as PolygonType) ? (v.polygonType as PolygonType) : 'objective';
  const circle =
    v.shape === 'circle' && validCenter(v.center) && typeof v.radiusM === 'number' && v.radiusM > 0 && v.radiusM <= MAX_RADIUS_M;
  const fill = typeof v.fill === 'string' && FILL_BY_ID.has(v.fill as PolygonFill) ? (v.fill as PolygonFill) : DEFAULT_POLYGON_FILL;
  return {
    polygonType,
    shape: circle ? { kind: 'circle', center: { lat: (v.center as LatLon).lat, lon: (v.center as LatLon).lon }, radiusM: v.radiusM as number } : { kind: 'points' },
    fill,
  };
}
