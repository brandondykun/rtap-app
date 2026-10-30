import { create } from 'zustand';

import * as lineDraft from '@/features/map-items/line-draft';
import type { LineEdit } from '@/features/map-items/line-draft';
import { circleRing } from '@/features/map-items/polygon-measure';
import { formatRangeText, isValidRange, NO_RANGES, parseRangeText, rangeFieldsFor, type RangeField, type UnitRanges } from '@/features/map-items/unit-ranges';
import type { ItemCategory } from '@/features/symbology/categories';
import type { LineType } from '@/features/symbology/line-types';
import { DEFAULT_POLYGON_FILL, MAX_RADIUS_M, type PolygonFill, type PolygonType } from '@/features/symbology/polygon-types';
import type { PointType } from '@/features/symbology/point-types';
import type { Affiliation, Echelon, UnitType } from '@/features/symbology/presets';
import { inverse } from '@/lib/geo/measure/geodesic';
import type { LatLon } from '@/lib/geo/types';

export type UnitPreset = { affiliation: Affiliation; unitType: UnitType };
/** What a long-press adds: an enemy unit of no particular type. */
export const ENEMY_UNIT: UnitPreset = { affiliation: 'hostile', unitType: 'unspecified' };

export type DraftMode = 'add' | 'edit';
/** Where the draft coordinate came from; the map follows every source except the crosshair and drawing taps. */
export type DraftCoordSource = 'crosshair' | 'self' | 'press' | 'typed' | 'item' | 'draw';

export type DraftValues = {
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
  echelon: Echelon;
  pointType: PointType;
  name: string;
  /** True once the user edits the name (even clearing it); auto-names never overwrite it. */
  nameEdited: boolean;
  notes: string;
  /** A unit's or point's ground elevation (m; null unknown) and the coordinate it belongs to; null before any lookup. */
  elevation: { at: LatLon; m: number | null } | null;
  /** What the user typed for each range; parsed at save by `draftRanges` (only the fields the unit type uses count). */
  rangeText: Record<RangeField, string>;
  /** View-only: an existing point shown selected; nothing in the draft can change until Edit. */
  locked: boolean;
  /** Set by tapping the notes in the view: the form's notes field focuses itself (and scrolls into view) once it appears. */
  focusNotes: boolean;
  /** Waiting for the user to tap the map where the point should go (the Map button). */
  picking: boolean;
  /** Line drafts (category 'line'): the points, the selected point, and where the next one goes. */
  vertices: LatLon[];
  selectedVertex: number | null;
  insertAfter: number | null;
  lineType: LineType;
  /** Undo stack of earlier vertex states (most recent last), at most HISTORY_LIMIT. */
  history: LineEdit[];
  /** Polygon drafts (category 'polygon'): type, fill and shape. Points use `vertices`; a circle uses `coord` as its center. */
  polygonType: PolygonType;
  polygonFill: PolygonFill;
  polygonShape: 'points' | 'circle';
  circleRadiusM: number | null;
  /** Bounds to fit the camera to (a saved line opened); `focusRev` increments with each new request. */
  focusBounds: { sw: LatLon; ne: LatLon } | null;
  focusRev: number;
  /** A point the map was asked to center on (tapping a point in the polygon view); `lookRev` increments with each request. */
  lookTarget: LatLon | null;
  lookRev: number;
  /** Last affiliation and types used for adding (rapid entry, and the next time Add opens). */
  remembered: { affiliation: Affiliation; unitType: UnitType; pointType: PointType; lineType: LineType; polygonType: PolygonType };
};

type DraftActions = {
  /** `unitPreset` overrides the remembered affiliation and unit type for this draft only (long-press). */
  startAdd: (start: { coord: LatLon | null; source: DraftCoordSource; category: ItemCategory; unitPreset?: UnitPreset }) => void;
  startEdit: (item: {
    itemId: string;
    coord: LatLon;
    category: ItemCategory;
    affiliation: Affiliation;
    unitType: UnitType;
    echelon: Echelon;
    pointType: PointType;
    name: string;
    notes: string;
    /** The unit's or point's stored elevation. */
    elevationM?: number | null;
    /** The unit's stored ranges. */
    ranges?: UnitRanges;
  }) => void;
  setCoord: (coord: LatLon, source: DraftCoordSource) => void;
  /** Re-centers the map on the draft's coord (the Center button); works while locked and does nothing without a coord. */
  focusItem: () => void;
  /** Re-fits the map to the open polygon or line (the Fit button); works while locked and does nothing without focus bounds. */
  refocus: () => void;
  /** Centers the map on a point (tapping one in the polygon view), keeping the zoom. */
  lookAt: (at: LatLon) => void;
  /** Unlocks the form and asks its notes field to take focus (tapping the notes in the view). */
  editNotes: () => void;
  /** True once after `editNotes`: the notes field calls this when it mounts and focuses itself if it gets true. */
  takeNotesFocus: () => boolean;
  setCoordInputValid: (valid: boolean) => void;
  setAffiliation: (affiliation: Affiliation) => void;
  setUnitType: (unitType: UnitType) => void;
  setEchelon: (echelon: Echelon) => void;
  setPointType: (pointType: PointType) => void;
  setName: (name: string) => void;
  setAutoName: (name: string) => void;
  setNotes: (notes: string) => void;
  /** Kept only while `at` is still the draft's coordinate (a late answer for an old spot is dropped). */
  setElevation: (at: LatLon, m: number | null) => void;
  setRangeText: (field: RangeField, text: string) => void;
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
  startAddPolygon: () => void;
  startEditPolygon: (polygon: {
    itemId: string;
    polygonType: PolygonType;
    fill: PolygonFill;
    shape: { kind: 'points'; points: LatLon[] } | { kind: 'circle'; center: LatLon; radiusM: number };
    ring: LatLon[];
    name: string;
    notes: string;
  }) => void;
  setPolygonType: (polygonType: PolygonType) => void;
  setPolygonShape: (shape: 'points' | 'circle') => void;
  setPolygonFill: (fill: PolygonFill) => void;
  setCircleRadius: (radiusM: number | null) => void;
  setCircleEdge: (p: LatLon) => void;
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
  echelon: 'unspecified',
  pointType: 'checkpoint',
  name: '',
  nameEdited: false,
  notes: '',
  elevation: null,
  rangeText: { threatRangeM: '', horizontalRangeM: '', verticalRangeFt: '' },
  locked: false,
  focusNotes: false,
  picking: false,
  vertices: [],
  selectedVertex: null,
  insertAfter: null,
  lineType: 'phase-line',
  history: [],
  polygonType: 'objective',
  polygonFill: DEFAULT_POLYGON_FILL,
  polygonShape: 'points',
  circleRadiusM: null,
  focusBounds: null,
  focusRev: 0,
  lookTarget: null,
  lookRev: 0,
  remembered: { affiliation: 'hostile', unitType: 'unspecified', pointType: 'checkpoint', lineType: 'phase-line', polygonType: 'objective' },
};

export const HISTORY_LIMIT = 50;

/**
 * The draft's ranges: only the fields the unit type uses are parsed, the rest are null. Null when a used field is invalid.
 * Typed text survives a unit type change; it is dropped here, at save.
 */
export function draftRanges(d: Pick<DraftValues, 'unitType' | 'rangeText'>): UnitRanges | null {
  const out: UnitRanges = { ...NO_RANGES };
  for (const f of rangeFieldsFor(d.unitType)) {
    const v = parseRangeText(d.rangeText[f]);
    if (v === undefined || !isValidRange(f, v)) return null;
    out[f] = v;
  }
  return out;
}

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
/** Exactly the same coordinate (elevation belongs to one spot). */
export const sameCoord = (a: LatLon | null, b: LatLon | null) => a !== null && b !== null && a.lat === b.lat && a.lon === b.lon;

export const useDraft = create<DraftValues & DraftActions>()((set) => ({
  ...INITIAL_DRAFT,
  startAdd: ({ coord, source, category, unitPreset }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      category,
      affiliation: unitPreset?.affiliation ?? s.remembered.affiliation,
      unitType: unitPreset?.unitType ?? s.remembered.unitType,
      // Not remembered: a new unit always starts at Unspecified.
      echelon: 'unspecified',
      pointType: s.remembered.pointType,
      mode: 'add',
      coord: isValid(coord) ? coord : null,
      coordSource: source,
      coordRev: s.coordRev + 1,
      focusRev: s.focusRev,
      lookRev: s.lookRev,
    })),
  startEdit: ({ itemId, coord, category, affiliation, unitType, echelon, pointType, name, notes, elevationM, ranges }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      mode: 'edit',
      itemId,
      category,
      pointType,
      coord: isValid(coord) ? coord : null,
      coordSource: 'item',
      coordRev: s.coordRev + 1,
      focusRev: s.focusRev,
      lookRev: s.lookRev,
      affiliation,
      unitType,
      echelon,
      name,
      nameEdited: true,
      notes,
      elevation: isValid(coord) ? { at: coord, m: elevationM ?? null } : null,
      rangeText: {
        threatRangeM: formatRangeText(ranges?.threatRangeM ?? null),
        horizontalRangeM: formatRangeText(ranges?.horizontalRangeM ?? null),
        verticalRangeFt: formatRangeText(ranges?.verticalRangeFt ?? null),
      },
      // Selecting a point shows it read-only; the menu unlocks it on Edit.
      locked: true,
    })),
  setCoord: (coord, source) =>
    // Any move ends a pending map pick (the pick itself arrives through here too).
    set((s) => (isValid(coord) && !s.locked ? { coord, coordSource: source, coordRev: s.coordRev + 1, picking: false } : {})),
  focusItem: () => set((s) => (s.coord ? { coordRev: s.coordRev + 1, coordSource: 'item' } : {})),
  editNotes: () => set({ locked: false, focusNotes: true }),
  takeNotesFocus: () => {
    if (!useDraft.getState().focusNotes) return false;
    set({ focusNotes: false });
    return true;
  },
  setCoordInputValid: (coordInputValid) => set({ coordInputValid }),
  setAffiliation: (affiliation) =>
    set((s) => ({
      affiliation,
      name: s.nameEdited ? s.name : '',
      remembered: s.mode === 'add' ? { ...s.remembered, affiliation } : s.remembered,
    })),
  setEchelon: (echelon) => set({ echelon }),
  setUnitType: (unitType) =>
    set((s) => ({ unitType, remembered: s.mode === 'add' ? { ...s.remembered, unitType } : s.remembered })),
  setPointType: (pointType) =>
    set((s) => ({
      pointType,
      name: s.nameEdited ? s.name : '',
      remembered: s.mode === 'add' ? { ...s.remembered, pointType } : s.remembered,
    })),
  setName: (name) => set({ name, nameEdited: true }),
  setAutoName: (name) => set((s) => (s.nameEdited ? {} : { name })),
  setNotes: (notes) => set({ notes }),
  setElevation: (at, m) => set((s) => (!s.locked && sameCoord(s.coord, at) ? { elevation: { at, m } } : {})),
  setRangeText: (field, text) => set((s) => (s.locked ? {} : { rangeText: { ...s.rangeText, [field]: text } })),
  // Fits the shape as it is now (a saved edit may have moved it), falling back to the bounds it was opened with.
  refocus: () =>
    set((s) => {
      if (!s.focusBounds) return {};
      const shape =
        s.category === 'polygon' && s.polygonShape === 'circle'
          ? s.coord && s.circleRadiusM ? circleRing(s.coord, s.circleRadiusM) : []
          : s.vertices;
      return { focusBounds: (shape.length >= 2 ? boundsAround(shape) : null) ?? s.focusBounds, focusRev: s.focusRev + 1 };
    }),
  lookAt: (at) => set((s) => ({ lookTarget: at, lookRev: s.lookRev + 1 })),
  setLocked: (locked) => set((s) => ({ locked, picking: locked ? false : s.picking })),
  setPicking: (picking) => set((s) => ({ picking: picking && !s.locked && s.mode !== null })),
  startAddLine: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      mode: 'add',
      category: 'line',
      lineType: s.remembered.lineType,
      coordRev: s.coordRev,
      focusRev: s.focusRev,
      lookRev: s.lookRev,
    })),
  startEditLine: ({ itemId, points, lineType, name, notes }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
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
      lookRev: s.lookRev,
    })),
  addVertex: (p) => set((s) => (s.locked || !isValid(p) ? {} : record(s, lineDraft.addVertex(edit(s), p)))),
  moveVertex: (i, p) => set((s) => (s.locked || !isValid(p) ? {} : record(s, lineDraft.moveVertex(edit(s), i, p)))),
  removeVertex: (i) => set((s) => (s.locked ? {} : record(s, lineDraft.removeVertex(edit(s), i, s.category === 'polygon' ? 3 : 2)))),
  // Selection and insert mode are not undoable on their own.
  startInsertAfter: (i) => set((s) => (s.locked ? {} : apply(lineDraft.startInsertAfter(edit(s), i)))),
  selectVertex: (i) => set((s) => (s.locked ? {} : apply(lineDraft.selectVertex(edit(s), i)))),
  undo: () =>
    set((s) => (s.history.length === 0 ? {} : { ...apply(s.history[s.history.length - 1]), history: s.history.slice(0, -1) })),
  setLineType: (lineType) =>
    set((s) => ({ lineType, name: s.nameEdited ? s.name : '', remembered: s.mode === 'add' ? { ...s.remembered, lineType } : s.remembered })),
  startAddPolygon: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      mode: 'add',
      category: 'polygon',
      polygonType: s.remembered.polygonType,
      coordRev: s.coordRev,
      focusRev: s.focusRev,
      lookRev: s.lookRev,
    })),
  startEditPolygon: ({ itemId, polygonType, fill, shape, ring, name, notes }) =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      mode: 'edit',
      category: 'polygon',
      itemId,
      polygonType,
      polygonFill: fill,
      polygonShape: shape.kind,
      vertices: shape.kind === 'points' ? shape.points : [],
      // The center is the draft coord; coordRev is left alone so the camera fit below wins.
      coord: shape.kind === 'circle' ? shape.center : null,
      coordSource: shape.kind === 'circle' ? 'item' : null,
      circleRadiusM: shape.kind === 'circle' ? shape.radiusM : null,
      name,
      nameEdited: true,
      notes,
      locked: true,
      coordRev: s.coordRev,
      focusBounds: boundsAround(ring),
      focusRev: s.focusRev + 1,
      lookRev: s.lookRev,
    })),
  setPolygonType: (polygonType) =>
    set((s) => ({
      polygonType,
      name: s.nameEdited ? s.name : '',
      remembered: s.mode === 'add' ? { ...s.remembered, polygonType } : s.remembered,
    })),
  setPolygonShape: (polygonShape) => set((s) => (s.locked ? {} : { polygonShape })),
  setPolygonFill: (polygonFill) => set((s) => (s.locked ? {} : { polygonFill })),
  setCircleRadius: (radiusM) =>
    set((s) =>
      s.locked ? {} : { circleRadiusM: radiusM !== null && Number.isFinite(radiusM) && radiusM > 0 && radiusM <= MAX_RADIUS_M ? radiusM : null },
    ),
  setCircleEdge: (p) =>
    set((s) => {
      if (s.locked || !s.coord || !isValid(p)) return {};
      const r = inverse(s.coord, p).distanceM;
      return r > 0 && r <= MAX_RADIUS_M ? { circleRadiusM: r } : {};
    }),
  clear: () =>
    set((s) => ({
      ...INITIAL_DRAFT,
      remembered: s.remembered,
      affiliation: s.remembered.affiliation,
      unitType: s.remembered.unitType,
      pointType: s.remembered.pointType,
      coordRev: s.coordRev,
      focusRev: s.focusRev,
      lookRev: s.lookRev,
    })),
}));
