import { create } from 'zustand';

import type { Affiliation, UnitType } from '@/features/symbology/presets';
import type { LatLon } from '@/lib/geo/types';

export type DraftMode = 'add' | 'edit';
/** Where the draft coordinate came from; the map follows every source except the crosshair. */
export type DraftCoordSource = 'crosshair' | 'self' | 'press' | 'typed' | 'item';

type DraftValues = {
  mode: DraftMode | null;
  itemId: string | null;
  coord: LatLon | null;
  coordSource: DraftCoordSource | null;
  /** Increments on every coordinate change; never resets, so subscribers never miss a change. */
  coordRev: number;
  /** False while the MGRS fields hold partial or invalid input (Add/Save disabled). */
  coordInputValid: boolean;
  affiliation: Affiliation;
  unitType: UnitType;
  name: string;
  /** True once the user typed a name; auto-names never overwrite it. */
  nameEdited: boolean;
  notes: string;
  /** View-only: an existing point shown selected; nothing in the draft can change until Edit. */
  locked: boolean;
  /** Waiting for the user to tap the map where the point should go (the Map button). */
  picking: boolean;
  /** Last affiliation and type used for adding (rapid entry, and the next time Add opens). */
  remembered: { affiliation: Affiliation; unitType: UnitType };
};

type DraftActions = {
  startAdd: (start: { coord: LatLon | null; source: DraftCoordSource }) => void;
  startEdit: (item: { itemId: string; coord: LatLon; affiliation: Affiliation; unitType: UnitType; name: string; notes: string }) => void;
  setCoord: (coord: LatLon, source: DraftCoordSource) => void;
  setCoordInputValid: (valid: boolean) => void;
  setAffiliation: (affiliation: Affiliation) => void;
  setUnitType: (unitType: UnitType) => void;
  setName: (name: string) => void;
  setAutoName: (name: string) => void;
  setNotes: (notes: string) => void;
  setLocked: (locked: boolean) => void;
  setPicking: (picking: boolean) => void;
  clear: () => void;
};

export const INITIAL_DRAFT: DraftValues = {
  mode: null,
  itemId: null,
  coord: null,
  coordSource: null,
  coordRev: 0,
  coordInputValid: true,
  affiliation: 'hostile',
  unitType: 'unspecified',
  name: '',
  nameEdited: false,
  notes: '',
  locked: false,
  picking: false,
  remembered: { affiliation: 'hostile', unitType: 'unspecified' },
};

function isValid(p: LatLon | null): p is LatLon {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** The in-progress point (add or edit). Lives only in memory; commands write it on Add/Save. */
export const useDraft = create<DraftValues & DraftActions>()((set) => ({
  ...INITIAL_DRAFT,
  startAdd: ({ coord, source }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      mode: 'add',
      coord: isValid(coord) ? coord : null,
      coordSource: source,
      coordRev: s.coordRev + 1,
    })),
  startEdit: ({ itemId, coord, affiliation, unitType, name, notes }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      mode: 'edit',
      itemId,
      coord: isValid(coord) ? coord : null,
      coordSource: 'item',
      coordRev: s.coordRev + 1,
      affiliation,
      unitType,
      name,
      nameEdited: true,
      notes,
      // Selecting a point shows it read-only; the menu unlocks it on Edit.
      locked: true,
    })),
  setCoord: (coord, source) =>
    // Any move ends a pending map pick (the pick itself arrives through here too).
    set((s) => (isValid(coord) && !s.locked ? { coord, coordSource: source, coordRev: s.coordRev + 1, picking: false } : {})),
  setCoordInputValid: (coordInputValid) => set({ coordInputValid }),
  setAffiliation: (affiliation) =>
    set((s) => ({
      affiliation,
      name: s.nameEdited ? s.name : '',
      remembered: s.mode === 'add' ? { ...s.remembered, affiliation } : s.remembered,
    })),
  setUnitType: (unitType) =>
    set((s) => ({ unitType, remembered: s.mode === 'add' ? { ...s.remembered, unitType } : s.remembered })),
  setName: (name) => set({ name, nameEdited: name.trim() !== '' }),
  setAutoName: (name) => set((s) => (s.nameEdited ? {} : { name })),
  setNotes: (notes) => set({ notes }),
  setLocked: (locked) => set((s) => ({ locked, picking: locked ? false : s.picking })),
  setPicking: (picking) => set((s) => ({ picking: picking && !s.locked && s.mode !== null })),
  clear: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      coordRev: s.coordRev,
    })),
}));
