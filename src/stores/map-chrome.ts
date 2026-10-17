import { create } from 'zustand';

export type ChromeSize = { width: number; height: number };

type MapChromeValues = {
  /** Your grid card (or the action bar in its place), as laid out; zero while hidden. Bottom controls keep clear of it. */
  selfCard: ChromeSize;
  /** The slot that reported `selfCard`. */
  selfCardOwner: string | null;
  /** The crosshair readout card, as laid out; zero while hidden. Your grid card (portrait) or zoom (landscape) sits above it. */
  readoutCard: ChromeSize;
};
type MapChromeActions = {
  setSelfCard: (size: ChromeSize, owner?: string) => void;
  /**
   * Zero the size, but only if `owner` reported it: on rotation the card moves to a new slot, which can
   * report its size before the old slot's unmount cleanup runs.
   */
  clearSelfCard: (owner: string) => void;
  setReadoutCard: (size: ChromeSize) => void;
  clearReadoutCard: () => void;
};

const NO_SIZE: ChromeSize = { width: 0, height: 0 };

export const INITIAL_MAP_CHROME: MapChromeValues = { selfCard: NO_SIZE, selfCardOwner: null, readoutCard: NO_SIZE };

/** Measured sizes of map controls that other controls lay out around. Lives only in memory. */
export const useMapChrome = create<MapChromeValues & MapChromeActions>()((set, get) => ({
  ...INITIAL_MAP_CHROME,
  setSelfCard: (selfCard, owner) => set({ selfCard, selfCardOwner: owner ?? null }),
  clearSelfCard: (owner) => {
    if (get().selfCardOwner === owner) set({ selfCard: NO_SIZE, selfCardOwner: null });
  },
  setReadoutCard: (readoutCard) => set({ readoutCard }),
  clearReadoutCard: () => set({ readoutCard: NO_SIZE }),
}));
