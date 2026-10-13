import type { CommandContext } from '@/lib/db/command-context';
import type { ItemCategory, ItemRef } from '@/features/symbology/categories';
import { lineTypeOf } from '@/features/symbology/line-types';
import { pointTypeForSidc } from '@/features/symbology/point-types';
import { decomposeSidc } from '@/features/symbology/presets';
import type { Result } from '@/lib/result';
import { useDraft } from '@/stores/draft';

import { placeLine, placePoint, updateItem, updateLine } from '../commands';
import { draftSidc } from '../draft-sidc';
import { parseLineGeometry, pointCoord } from '../geometry';
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

const symbolAdapter: ItemAdapter = {
  canSave: (d) => d.coord !== null && d.coordInputValid && d.name.trim() !== '',
  place: (ctx, missionId, d) => placePoint(ctx, { missionId, coord: d.coord!, sidc: draftSidc(d), name: d.name, notes: notes(d) }),
  update: (ctx, id, d) => updateItem(ctx, id, { coord: d.coord!, name: d.name, notes: notes(d), sidc: draftSidc(d) }),
  select: (item) => {
    const at = pointCoord(item.geometry);
    if (!at) return false;
    const unit = (item.sidc ? decomposeSidc(item.sidc) : null) ?? { affiliation: 'unknown' as const, unitType: 'unspecified' as const };
    useDraft.getState().startEdit({
      itemId: item.id,
      coord: at,
      category: pointTypeForSidc(item.sidc) ? 'point' : 'unit',
      affiliation: unit.affiliation,
      unitType: unit.unitType,
      pointType: pointTypeForSidc(item.sidc) ?? 'checkpoint',
      name: item.name,
      notes: item.notes ?? '',
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

export const ITEM_ADAPTERS: Record<ItemCategory, ItemAdapter> = { unit: symbolAdapter, point: symbolAdapter, line: lineAdapter };
