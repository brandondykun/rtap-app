import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

type QuickPlotValues = {
  /** The grid entry card is up. */
  entryOpen: boolean;
  /** The one temporary point on the map (never saved unless the user saves it). */
  temp: LatLon | null;
};
type QuickPlotActions = { open: () => void; plot: (p: LatLon) => void; close: () => void };

export const INITIAL_QUICK_PLOT: QuickPlotValues = { entryOpen: false, temp: null };

const valid = (p: LatLon) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** Quick plot (PLOT tool): the entry card and one temporary point. Lives only in memory. */
export const useQuickPlot = create<QuickPlotValues & QuickPlotActions>()((set) => ({
  ...INITIAL_QUICK_PLOT,
  open: () => set({ entryOpen: true }),
  plot: (p) => set(valid(p) ? { entryOpen: false, temp: p } : {}),
  close: () => set(INITIAL_QUICK_PLOT),
}));
