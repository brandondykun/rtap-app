import type { CommandContext } from '@/lib/db/command-context';
import type { ItemCategory, ItemRef } from '@/features/symbology/categories';
import { lineTypeOf } from '@/features/symbology/line-types';
import { pointTypeForSidc } from '@/features/symbology/point-types';
import { MAX_RADIUS_M, polygonStyleOf } from '@/features/symbology/polygon-types';
import { decomposeSidc } from '@/features/symbology/presets';
import { elevationAt } from '@/features/map/terrain/elevation';
import type { Result } from '@/lib/result';
import { draftRanges, sameCoord, useDraft } from '@/stores/draft';

import { placeLine, placePoint, placePolygon, updateItem, updateLine, updatePolygon, type PolygonShapeInput } from '../commands';
import { draftSidc } from '../draft-sidc';
import { parseLineGeometry, parsePolygonGeometry, pointCoord } from '../geometry';
import type { MapItemSnapshot } from '../repository';

export type DraftState = ReturnType<typeof useDraft.getState>;

/** What differs between unit/point menus and line menus; the panels do the rest. */
export type ItemAdapter = {
  canSave(d: DraftState): boolean;
  place(ctx: CommandContext, missionId: string, d: DraftState): Promise<Result<{ id: string }, string>>;
  update(ctx: CommandContext, id: string, d: DraftState): Promise<Result<void, string>>;
  /** Loads a saved item into the draft, read-only; false when its geometry is unreadable. */
  select(item: MapItemSnapshot): boolean;
  ref(d: DraftState): ItemRef;
};

const notes = (d: DraftState) => d.notes.trim() || null;

/**
 * A unit's or point's ground elevation where it is saved: the one already looked up for that exact spot (or stored, when it
 * has not moved), otherwise a fresh lookup. The draft keeps it, so the read-only view shows what was saved.
 */
async function savedElevation(d: DraftState): Promise<number | null | undefined> {
  if (!d.coord) return undefined;
  if (d.elevation && sameCoord(d.elevation.at, d.coord)) return d.elevation.m;
  const m = await elevationAt(d.coord);
  useDraft.getState().setElevation(d.coord, m);
  return m;
}

const symbolAdapter: ItemAdapter = {
  canSave: (d) => d.coord !== null && d.coordInputValid && d.name.trim() !== '' && draftRanges(d) !== null,
  place: async (ctx, missionId, d) =>
    placePoint(ctx, { missionId, coord: d.coord!, sidc: draftSidc(d), name: d.name, notes: notes(d), elevationM: await savedElevation(d), ranges: draftRanges(d)! }),
  update: async (ctx, id, d) =>
    updateItem(ctx, id, { coord: d.coord!, name: d.name, notes: notes(d), sidc: draftSidc(d), elevationM: await savedElevation(d), ranges: draftRanges(d)! }),
  select: (item) => {
    const at = pointCoord(item.geometry);
    if (!at) return false;
    const unit = (item.sidc ? decomposeSidc(item.sidc) : null) ?? { affiliation: 'unknown' as const, unitType: 'unspecified' as const, echelon: 'unspecified' as const };
    useDraft.getState().startEdit({
      itemId: item.id,
      coord: at,
      category: pointTypeForSidc(item.sidc) ? 'point' : 'unit',
      affiliation: unit.affiliation,
      unitType: unit.unitType,
      echelon: unit.echelon,
      pointType: pointTypeForSidc(item.sidc) ?? 'checkpoint',
      name: item.name,
      notes: item.notes ?? '',
      elevationM: item.elevationM,
      ranges: { threatRangeM: item.threatRangeM, horizontalRangeM: item.horizontalRangeM, verticalRangeFt: item.verticalRangeFt },
    });
    return true;
  },
  ref: (d) => ({ kind: 'point', sidc: draftSidc(d) }),
};

const lineAdapter: ItemAdapter = {
  canSave: (d) => d.vertices.length >= 2 && d.name.trim() !== '',
  place: (ctx, missionId, d) => placeLine(ctx, { missionId, points: d.vertices, lineType: d.lineType, name: d.name, notes: notes(d) }),
  update: (ctx, id, d) => updateLine(ctx, id, { points: d.vertices, lineType: d.lineType, name: d.name, notes: notes(d) }),
  select: (item) => {
    const points = parseLineGeometry(item.geometry);
    if (!points) return false;
    useDraft.getState().startEditLine({ itemId: item.id, points, lineType: lineTypeOf(item.style), name: item.name, notes: item.notes ?? '' });
    return true;
  },
  ref: () => ({ kind: 'line', sidc: null }),
};

const polygonShape = (d: DraftState): PolygonShapeInput =>
  d.polygonShape === 'circle' ? { kind: 'circle', center: d.coord!, radiusM: d.circleRadiusM! } : { kind: 'points', points: d.vertices };

const polygonAdapter: ItemAdapter = {
  canSave: (d) =>
    d.name.trim() !== '' &&
    (d.polygonShape === 'circle'
      ? d.coord !== null && d.coordInputValid && d.circleRadiusM !== null && d.circleRadiusM > 0 && d.circleRadiusM <= MAX_RADIUS_M
      : d.vertices.length >= 3),
  place: (ctx, missionId, d) => placePolygon(ctx, { missionId, polygonType: d.polygonType, fill: d.polygonFill, name: d.name, notes: notes(d), shape: polygonShape(d) }),
  update: (ctx, id, d) => updatePolygon(ctx, id, { polygonType: d.polygonType, fill: d.polygonFill, name: d.name, notes: notes(d), shape: polygonShape(d) }),
  select: (item) => {
    const ring = parsePolygonGeometry(item.geometry);
    if (!ring) return false;
    const { polygonType, shape, fill } = polygonStyleOf(item.style);
    useDraft.getState().startEditPolygon({
      itemId: item.id,
      polygonType,
      fill,
      shape: shape.kind === 'circle' ? shape : { kind: 'points', points: ring },
      ring,
      name: item.name,
      notes: item.notes ?? '',
    });
    return true;
  },
  ref: () => ({ kind: 'polygon', sidc: null }),
};

export const ITEM_ADAPTERS: Record<ItemCategory, ItemAdapter> = { unit: symbolAdapter, point: symbolAdapter, line: lineAdapter, polygon: polygonAdapter };
