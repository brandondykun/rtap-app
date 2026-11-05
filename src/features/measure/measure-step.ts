import type { LatLon } from '@/lib/geo/types';

export type MeasurePoint = 'start' | 'end';

/** A measurement: the start and the end (null until set), and the point picked on the map to move, if any. */
export type Measure = { start: LatLon | null; end: LatLon | null; editing: MeasurePoint | null };

export const EMPTY_MEASURE: Measure = { start: null, end: null, editing: null };

/** What the next tap or CTR does: set the start, set the end, or (both set, none picked) nothing until a point is picked. */
export type MeasureStep = MeasurePoint | 'pick';

export function measureStep(m: Measure): MeasureStep {
  return m.editing ?? (m.start === null ? 'start' : m.end === null ? 'end' : 'pick');
}

/** A tap, snap or CTR: sets the start, then the end; once both are set, only moves the point picked, then lets it go. */
export function placePoint(m: Measure, p: LatLon): Measure {
  const step = measureStep(m);
  if (step === 'pick') return m;
  return { ...m, [step]: p, editing: null };
}

/** Picks a set point to move with the next tap or CTR; picking it again lets it go. */
export function pickPoint(m: Measure, point: MeasurePoint): Measure {
  if (m[point] === null) return m;
  return { ...m, editing: m.editing === point ? null : point };
}
