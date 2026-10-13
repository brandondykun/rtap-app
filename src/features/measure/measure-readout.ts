import type { AngleUnit, LatLon, NorthRef } from '@/lib/geo/types';
import { describeVector } from '@/lib/geo/vector';

type ReadoutSettings = { angleUnit: AngleUnit; northRef: NorthRef; declinationOverrideDeg: number | null };

/** "1.29 km · 039° GRID": the same range/bearing text as every other readout. */
export function measureReadout(from: LatLon, to: LatLon, s: ReadoutSettings, date = new Date()): string {
  const v = describeVector(from, to, { date, declinationOverrideDeg: s.declinationOverrideDeg, unit: s.angleUnit, ref: s.northRef });
  return `${v.distanceLabel} · ${v.bearingLabel} ${v.refLabel}`;
}
