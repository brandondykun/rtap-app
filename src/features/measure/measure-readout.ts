import type { AngleUnit, LatLon, NorthRef } from '@/lib/geo/types';
import { describeVector } from '@/lib/geo/vector';

import type { RangeParts } from '@/features/map/layers/styles';

type ReadoutSettings = { angleUnit: AngleUnit; northRef: NorthRef; declinationOverrideDeg: number | null };

/** "1.29 km" and "039° GRID", apart, for each one's value color. */
export function measureParts(from: LatLon, to: LatLon, s: ReadoutSettings, date = new Date()): RangeParts {
  const v = describeVector(from, to, { date, declinationOverrideDeg: s.declinationOverrideDeg, unit: s.angleUnit, ref: s.northRef });
  return { distance: v.distanceLabel, bearing: `${v.bearingLabel} ${v.refLabel}` };
}

/** "1.29 km · 039° GRID": the same range/bearing text as every other readout. */
export function measureReadout(from: LatLon, to: LatLon, s: ReadoutSettings, date = new Date()): string {
  const { distance, bearing } = measureParts(from, to, s, date);
  return `${distance} · ${bearing}`;
}
