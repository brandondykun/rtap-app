import { create } from 'zustand';

export type ChromeSize = { width: number; height: number };

type MapChromeValues = {
  /** Your grid card at the bottom right, as laid out; zero while it is hidden. Bottom bars keep clear of it. */
  selfCard: ChromeSize;
};
type MapChromeActions = { setSelfCard: (size: ChromeSize) => void };

export const INITIAL_MAP_CHROME: MapChromeValues = { selfCard: { width: 0, height: 0 } };

/** Measured sizes of map controls that other controls lay out around. Lives only in memory. */
export const useMapChrome = create<MapChromeValues & MapChromeActions>()((set) => ({
  ...INITIAL_MAP_CHROME,
  setSelfCard: (selfCard) => set({ selfCard }),
}));
