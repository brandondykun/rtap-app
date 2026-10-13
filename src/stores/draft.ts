import { create } from 'zustand';

import type { ItemCategory } from '@/features/symbology/categories';
import type { PointType } from '@/features/symbology/point-types';
import type { Affiliation, UnitType } from '@/features/symbology/presets';
import type { LatLon } from '@/lib/geo/types';

export type DraftMode = 'add' | 'edit';
/** Where the draft coordinate came from; the map follows every source except the crosshair. */
export type DraftCoordSource = 'crosshair' | 'self' | 'press' | 'typed' | 'item';

type DraftValues = {
  mode: DraftMode | null;
  itemId: string | null;
  /** Unit (affiliation + unit type) or point (control-measure type). */
  category: ItemCategory;
  coord: LatLon | null;
  coordSource: DraftCoordSource | null;
  /** Increments on every coordinate change; never resets, so subscribers never miss a change. */
  coordRev: number;
  /** False while the MGRS fields hold partial or invalid input (Add/Save disabled). */
  coordInputValid: boolean;
  affiliation: Affiliation;
  unitType: UnitType;
  pointType: PointType;
  name: string;
  /** True once the user typed a name; auto-names never overwrite it. */
  nameEdited: boolean;
  notes: string;
  /** View-only: an existing point shown selected; nothing in the draft can change until Edit. */
  locked: boolean;
  /** Waiting for the user to tap the map where the point should go (the Map button). */
  picking: boolean;
  /** Last affiliation and types used for adding (rapid entry, and the next time Add opens). */
  remembered: { affiliation: Affiliation; unitType: UnitType; pointType: PointType };
  /** The most recent Add opened (long-press starts it again). Not persisted. */
  lastAddCategory: ItemCategory;
};

type DraftActions = {
  startAdd: (start: { coord: LatLon | null; source: DraftCoordSource; category: ItemCategory }) => void;
  startEdit: (item: {
    itemId: string;
    coord: LatLon;
    category: ItemCategory;
    affiliation: Affiliation;
    unitType: UnitType;
    pointType: PointType;
    name: string;
    notes: string;
  }) => void;
  setCoord: (coord: LatLon, source: DraftCoordSource) => void;
  setCoordInputValid: (valid: boolean) => void;
  setAffiliation: (affiliation: Affiliation) => void;
  setUnitType: (unitType: UnitType) => void;
  setPointType: (pointType: PointType) => void;
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
  category: 'unit',
  coord: null,
  coordSource: null,
  coordRev: 0,
  coordInputValid: true,
  affiliation: 'hostile',
  unitType: 'unspecified',
  pointType: 'checkpoint',
  name: '',
  nameEdited: false,
  notes: '',
  locked: false,
  picking: false,
  remembered: { affiliation: 'hostile', unitType: 'unspecified', pointType: 'checkpoint' },
  lastAddCategory: 'unit',
};

function isValid(p: LatLon | null): p is LatLon {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** The in-progress point (add or edit). Lives only in memory; commands write it on Add/Save. */
export const useDraft = create<DraftValues & DraftActions>()((set) => ({
  ...INITIAL_DRAFT,
  startAdd: ({ coord, source, category }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: category,
      category,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      pointType: s.remembered.pointType,
      mode: 'add',
      coord: isValid(coord) ? coord : null,
      coordSource: source,
      coordRev: s.coordRev + 1,
    })),
  startEdit: ({ itemId, coord, category, affiliation, unitType, pointType, name, notes }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: s.lastAddCategory,
      mode: 'edit',
      itemId,
      category,
      pointType,
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
  setPointType: (pointType) =>
    set((s) => ({
      pointType,
      name: s.nameEdited ? s.name : '',
      remembered: s.mode === 'add' ? { ...s.remembered, pointType } : s.remembered,
    })),
  setName: (name) => set({ name, nameEdited: name.trim() !== '' }),
  setAutoName: (name) => set((s) => (s.nameEdited ? {} : { name })),
  setNotes: (notes) => set({ notes }),
  setLocked: (locked) => set((s) => ({ locked, picking: locked ? false : s.picking })),
  setPicking: (picking) => set((s) => ({ picking: picking && !s.locked && s.mode !== null })),
  clear: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: s.lastAddCategory,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      pointType: s.remembered.pointType,
      coordRev: s.coordRev,
    })),
}));
