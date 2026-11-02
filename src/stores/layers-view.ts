import { create } from 'zustand';

import type { ItemCategory } from '@/features/symbology/categories';
import type { Affiliation } from '@/features/symbology/presets';

type LayersViewValues = {
  /** The Layers tab last chosen; null until the user picks one (then the first tab with items opens). */
  tab: ItemCategory | null;
  /** The Units tab's filter chip: one affiliation, or null for All. */
  unitAffiliation: Affiliation | null;
};

type LayersViewActions = { setTab: (tab: ItemCategory) => void; setUnitAffiliation: (affiliation: Affiliation | null) => void };

export const INITIAL_LAYERS_VIEW: LayersViewValues = { tab: null, unitAffiliation: null };

/** Layers panel view state, kept while the app runs (not persisted). */
export const useLayersView = create<LayersViewValues & LayersViewActions>()((set) => ({
  ...INITIAL_LAYERS_VIEW,
  setTab: (tab) => set({ tab }),
  setUnitAffiliation: (unitAffiliation) => set({ unitAffiliation }),
}));
