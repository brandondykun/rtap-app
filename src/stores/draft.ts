import { create } from 'zustand';

import * as lineDraft from '@/features/map-items/line-draft';
import type { LineEdit } from '@/features/map-items/line-draft';
import type { ItemCategory } from '@/features/symbology/categories';
import type { LineType } from '@/features/symbology/line-types';
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
  /** Line drafts (category 'line'): the points, the selected point, and where the next one goes. */
  vertices: LatLon[];
  selectedVertex: number | null;
  insertAfter: number | null;
  lineType: LineType;
  /** Undo stack of earlier vertex states (most recent last), at most HISTORY_LIMIT. */
  history: LineEdit[];
  /** Bounds to fit the camera to (a saved line opened); `focusRev` increments with each new request. */
  focusBounds: { sw: LatLon; ne: LatLon } | null;
  focusRev: number;
  /** Last affiliation and types used for adding (rapid entry, and the next time Add opens). */
  remembered: { affiliation: Affiliation; unitType: UnitType; pointType: PointType; lineType: LineType };
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
  startAddLine: () => void;
  startEditLine: (line: { itemId: string; points: LatLon[]; lineType: LineType; name: string; notes: string }) => void;
  addVertex: (p: LatLon) => void;
  moveVertex: (i: number, p: LatLon) => void;
  removeVertex: (i: number) => void;
  selectVertex: (i: number | null) => void;
  startInsertAfter: (i: number) => void;
  undo: () => void;
  setLineType: (lineType: LineType) => void;
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
  vertices: [],
  selectedVertex: null,
  insertAfter: null,
  lineType: 'phase-line',
  history: [],
  focusBounds: null,
  focusRev: 0,
  remembered: { affiliation: 'hostile', unitType: 'unspecified', pointType: 'checkpoint', lineType: 'phase-line' },
  lastAddCategory: 'unit',
};

export const HISTORY_LIMIT = 50;

function isValid(p: LatLon | null): p is LatLon {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** The points' bounds padded by 15 % (at least ~200 m), for fitting the camera. */
function boundsAround(points: LatLon[]): { sw: LatLon; ne: LatLon } | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.15, 0.002);
  const padLon = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.15, 0.002);
  return {
    sw: { lat: Math.min(...lats) - padLat, lon: Math.min(...lons) - padLon },
    ne: { lat: Math.max(...lats) + padLat, lon: Math.max(...lons) + padLon },
  };
}

const edit = (s: DraftValues): LineEdit => ({ vertices: s.vertices, selected: s.selectedVertex, insertAfter: s.insertAfter });
const apply = (e: LineEdit) => ({ vertices: e.vertices, selectedVertex: e.selected, insertAfter: e.insertAfter });
/** Applies a vertex change and records the previous state for undo (no-ops record nothing). */
const record = (s: DraftValues, next: LineEdit) =>
  next.vertices === s.vertices && next.selected === s.selectedVertex && next.insertAfter === s.insertAfter
    ? {}
    : { ...apply(next), history: [...s.history, edit(s)].slice(-HISTORY_LIMIT) };

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
      focusRev: s.focusRev,
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
      focusRev: s.focusRev,
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
  // Lines are never started by long-press, so lastAddCategory is left alone.
  startAddLine: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: s.lastAddCategory,
      mode: 'add',
      category: 'line',
      lineType: s.remembered.lineType,
      coordRev: s.coordRev,
      focusRev: s.focusRev,
    })),
  startEditLine: ({ itemId, points, lineType, name, notes }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: s.lastAddCategory,
      mode: 'edit',
      category: 'line',
      itemId,
      vertices: points,
      lineType,
      name,
      nameEdited: true,
      notes,
      locked: true,
      coordRev: s.coordRev,
      focusBounds: boundsAround(points),
      focusRev: s.focusRev + 1,
    })),
  addVertex: (p) => set((s) => (s.locked || !isValid(p) ? {} : record(s, lineDraft.addVertex(edit(s), p)))),
  moveVertex: (i, p) => set((s) => (s.locked || !isValid(p) ? {} : record(s, lineDraft.moveVertex(edit(s), i, p)))),
  removeVertex: (i) => set((s) => (s.locked ? {} : record(s, lineDraft.removeVertex(edit(s), i)))),
  // Selection and insert mode are not undoable on their own.
  startInsertAfter: (i) => set((s) => (s.locked ? {} : apply(lineDraft.startInsertAfter(edit(s), i)))),
  selectVertex: (i) => set((s) => (s.locked ? {} : apply(lineDraft.selectVertex(edit(s), i)))),
  undo: () =>
    set((s) => (s.history.length === 0 ? {} : { ...apply(s.history[s.history.length - 1]), history: s.history.slice(0, -1) })),
  setLineType: (lineType) =>
    set((s) => ({ lineType, remembered: s.mode === 'add' ? { ...s.remembered, lineType } : s.remembered })),
  clear: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      lastAddCategory: s.lastAddCategory,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      pointType: s.remembered.pointType,
      coordRev: s.coordRev,
      focusRev: s.focusRev,
    })),
}));
