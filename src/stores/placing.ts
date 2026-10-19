import { create } from 'zustand';

/** What UNIT / POINT is waiting to place: the next map tap (or CTR) opens its Add menu. */
export type PlacingCategory = 'unit' | 'point';

type PlacingValues = { category: PlacingCategory | null };
type PlacingActions = { start: (category: PlacingCategory) => void; stop: () => void };

export const INITIAL_PLACING: PlacingValues = { category: null };

/** Placing a unit or point from the toolbar, before its Add menu opens. Lives only in memory. */
export const usePlacing = create<PlacingValues & PlacingActions>()((set) => ({
  ...INITIAL_PLACING,
  start: (category) => set({ category }),
  stop: () => set(INITIAL_PLACING),
}));
