import { POLYGON_FILLS, polygonStyleOf, polygonTypeInfo, type PolygonType } from '@/features/symbology/polygon-types';
import type { LatLon } from '@/lib/geo/types';

import { parsePolygonGeometry } from '../../geometry';
import { areaM2, circleRing, perimeterM, ringCenter } from '../../polygon-measure';
import type { MapItemSnapshot } from '../../repository';

export type PolygonSummary = {
  polygonType: PolygonType;
  kind: 'points' | 'circle';
  points: LatLon[];
  center: LatLon;
  perimeterM: number | null;
  radiusM: number | null;
  areaM2: number;
  /** "Objective · 7 points · 15% fill"; a circle has no point count. */
  subtitle: string;
  typeLabel: string;
};

/** What the polygon view shows, read from the saved snapshot; null when its geometry cannot be read. */
export function polygonSummary(item: MapItemSnapshot): PolygonSummary | null {
  const points = parsePolygonGeometry(item.geometry);
  if (!points) return null;
  const { polygonType, shape, fill } = polygonStyleOf(item.style);
  const typeLabel = polygonTypeInfo(polygonType).label;
  const fillLabel = `${POLYGON_FILLS.find((f) => f.id === fill)!.label} fill`;
  if (shape.kind === 'circle') {
    return {
      polygonType,
      kind: 'circle',
      points,
      center: shape.center,
      perimeterM: null,
      radiusM: shape.radiusM,
      areaM2: areaM2(circleRing(shape.center, shape.radiusM)),
      subtitle: `${typeLabel} · ${fillLabel}`,
      typeLabel,
    };
  }
  return {
    polygonType,
    kind: 'points',
    points,
    center: ringCenter(points),
    perimeterM: perimeterM(points),
    radiusM: null,
    areaM2: areaM2(points),
    subtitle: `${typeLabel} · ${points.length} points · ${fillLabel}`,
    typeLabel,
  };
}
