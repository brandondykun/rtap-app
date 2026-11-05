import { create } from 'zustand';

import { EMPTY_MEASURE, type Measure, type MeasurePoint, pickPoint, placePoint } from '@/features/measure/measure-step';
import type { LatLon } from '@/lib/geo/types';

type MeasureValues = Measure & { active: boolean };
type MeasureActions = {
  startMeasure: () => void;
  stopMeasure: () => void;
  place: (p: LatLon) => void;
  /** Picks (or lets go) the start or end to move: a tap on its dot. */
  pick: (point: MeasurePoint) => void;
};

export const INITIAL_MEASURE: MeasureValues = { active: false, ...EMPTY_MEASURE };

const valid = (p: LatLon) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** The measure tool (never saved): on/off, the two points and the one picked to move. */
export const useMeasure = create<MeasureValues & MeasureActions>()((set) => ({
  ...INITIAL_MEASURE,
  startMeasure: () => set({ active: true, ...EMPTY_MEASURE }),
  stopMeasure: () => set(INITIAL_MEASURE),
  place: (p) => set((s) => (s.active && valid(p) ? placePoint(s, p) : {})),
  pick: (point) => set((s) => (s.active ? pickPoint(s, point) : {})),
}));
