import { toMgrs } from '@/lib/geo/coords/mgrs';
import { formatLatLon, formatMgrs } from '@/lib/geo/format/coords';
import { refLabel } from '@/lib/geo/format/measure';
import type { AngleUnit, LatLon, NorthRef } from '@/lib/geo/types';
import { describeVector } from '@/lib/geo/vector';
import type { CoordinateFormat } from '@/stores/settings';

const NO_VALUE = '—';

export type ReadoutSettings = {
  coordinateFormat: CoordinateFormat;
  angleUnit: AngleUnit;
  northRef: NorthRef;
  declinationOverrideDeg: number | null;
};

export type ReadoutModel = { coordinate: string; distance: string; bearing: string; ref: string };

/** Coordinate text in the user's format. MGRS falls back to lat/lon where MGRS is undefined. */
export function formatCoordinate(p: LatLon, format: CoordinateFormat): string {
  if (format === 'mgrs') {
    const mgrs = toMgrs(p, 5);
    if (mgrs.ok) return formatMgrs(mgrs.value);
  }
  return formatLatLon(p);
}

/** Crosshair readout: coordinate of the map center, and range/bearing from `from` to it. */
export function describeReadout(
  center: LatLon | null,
  from: LatLon | null,
  settings: ReadoutSettings,
  date: Date,
): ReadoutModel {
  const ref = refLabel(settings.northRef);
  const coordinate = center ? formatCoordinate(center, settings.coordinateFormat) : NO_VALUE;
  if (!center || !from) return { coordinate, distance: NO_VALUE, bearing: NO_VALUE, ref };
  const v = describeVector(from, center, {
    date,
    declinationOverrideDeg: settings.declinationOverrideDeg,
    unit: settings.angleUnit,
    ref: settings.northRef,
  });
  return { coordinate, distance: v.distanceLabel, bearing: v.bearingLabel, ref };
}
