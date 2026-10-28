import { create } from 'zustand';

import type { LatLon } from '@/lib/geo/types';

/** The Set manually box: closed, open, or hidden while the user chooses their spot on the map. */
export type ManualEntryPhase = 'closed' | 'entry' | 'choosing';

export type ManualEntryValues = {
  phase: ManualEntryPhase;
  /** Opened from the map's ME readout or from Settings (only the map shows the "change it in Settings" message). */
  origin: 'map' | 'settings';
  /** The saved position the box starts from (Settings → Change), if any. */
  start: LatLon | null;
  /** The spot last chosen on the map. */
  chosen: LatLon | null;
  /** The grid currently in the fields, when valid: previewed on the map. */
  pending: LatLon | null;
};

type ManualEntryActions = {
  open: (origin: 'map' | 'settings', start: LatLon | null) => void;
  startChoosing: () => void;
  choose: (at: LatLon) => void;
  cancelChoosing: () => void;
  setPending: (at: LatLon | null) => void;
  close: () => void;
};

export const INITIAL_MANUAL_ENTRY: ManualEntryValues = { phase: 'closed', origin: 'map', start: null, chosen: null, pending: null };

/** Setting the position by hand. Lives only in memory; the position itself is saved in the my-location store. */
export const useManualEntry = create<ManualEntryValues & ManualEntryActions>()((set) => ({
  ...INITIAL_MANUAL_ENTRY,
  open: (origin, start) => set({ ...INITIAL_MANUAL_ENTRY, phase: 'entry', origin, start }),
  startChoosing: () => set((s) => (s.phase === 'entry' ? { phase: 'choosing' } : {})),
  choose: (at) => set({ phase: 'entry', chosen: at }),
  cancelChoosing: () => set((s) => (s.phase === 'choosing' ? { phase: 'entry' } : {})),
  setPending: (pending) => set({ pending }),
  close: () => set(INITIAL_MANUAL_ENTRY),
}));
