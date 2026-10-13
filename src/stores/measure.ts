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
