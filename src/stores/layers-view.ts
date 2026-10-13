import { create } from 'zustand';

import type { ItemCategory } from '@/features/symbology/categories';

type LayersViewValues = {
  /** The Layers tab last chosen; null until the user picks one (then the first tab with items opens). */
  tab: ItemCategory | null;
};

type LayersViewActions = { setTab: (tab: ItemCategory) => void };

export const INITIAL_LAYERS_VIEW: LayersViewValues = { tab: null };

/** Layers panel view state, kept while the app runs (not persisted). */
export const useLayersView = create<LayersViewValues & LayersViewActions>()((set) => ({
  ...INITIAL_LAYERS_VIEW,
  setTab: (tab) => set({ tab }),
}));
