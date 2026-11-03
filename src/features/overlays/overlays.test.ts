import { firstValueFrom } from 'rxjs';

import { deleteItem, placePoint, setItemHidden } from '@/features/map-items/commands';
import { createMission, deleteMission, setBaseHidden } from '@/features/missions/commands';
import { makeTestContext } from '@/lib/db/test-database';

import { createOverlay, deleteOverlay, MAX_OVERLAY_NAME, moveItemToBase, renameOverlay, setAllOverlaysHidden, setItemInOverlay, setOverlayHidden } from './commands';
import { observeBaseHidden, observeItemOverlayIds, observeMapHiddenItemIds, observeMissionOverlays, observeOverlayHiddenItemIds } from './repository';

const at = { lat: 38.9, lon: -77 };
const HOS = 'SHGPUCI--------';

async function setup() {
  const ctx = makeTestContext();
  const m = await createMission(ctx, { name: 'Op Iron' });
  if (!m.ok) throw new Error('setup');
  const missionId = m.value.id;
  const item = async (name: string) => {
    const r = await placePoint(ctx, { missionId, coord: at, sidc: HOS, name });
    if (!r.ok) throw new Error('setup');
    return r.value.id;
  };
  const overlay = async (name: string) => {
    const r = await createOverlay(ctx, { missionId, name });
    if (!r.ok) throw new Error('setup');
    return r.value.id;
  };
  const link = (itemId: string, overlayId: string, inOverlay = true) => setItemInOverlay(ctx, { missionId, itemId, overlayId, inOverlay });
  const overlayHidden = () => firstValueFrom(observeOverlayHiddenItemIds(ctx.db, missionId));
  return { ctx, missionId, item, overlay, link, overlayHidden };
}

describe('overlays', () => {
  it('lists the mission overlays all shown at first', async () => {
    const { ctx, missionId, overlay } = await setup();
    await overlay('Phase 1');
    await overlay('Phase 2');
    const list = await firstValueFrom(observeMissionOverlays(ctx.db, missionId));
    expect(list.map((o) => [o.name, o.sortOrder, o.hidden])).toEqual([
      ['Phase 1', 0, false],
      ['Phase 2', 1, false],
    ]);
  });

  it('allows no two overlays of one name in a mission, ignoring case, nor one named Base', async () => {
    const { ctx, missionId, overlay } = await setup();
    const p1 = await overlay('Phase 1');
    const p2 = await overlay('Phase 2');
    expect(await createOverlay(ctx, { missionId, name: ' phase 1 ' })).toMatchObject({ ok: false, error: 'name_taken' });
    expect(await createOverlay(ctx, { missionId, name: 'BASE' })).toMatchObject({ ok: false, error: 'name_taken' });
    expect(await renameOverlay(ctx, p2, 'PHASE 1')).toMatchObject({ ok: false, error: 'name_taken' });
    expect(await renameOverlay(ctx, p2, 'base')).toMatchObject({ ok: false, error: 'name_taken' });
    // Its own name in other case is fine.
    expect((await renameOverlay(ctx, p1, 'PHASE 1')).ok).toBe(true);
    // Another mission may have its own Phase 1.
    const other = await createMission(ctx, { name: 'Op Steel' });
    if (!other.ok) throw new Error('setup');
    expect((await createOverlay(ctx, { missionId: other.value.id, name: 'Phase 1' })).ok).toBe(true);
    expect((await firstValueFrom(observeMissionOverlays(ctx.db, missionId))).map((o) => o.name)).toEqual(['PHASE 1', 'Phase 2']);
  });

  it('adds only one of two overlays of one name made at once', async () => {
    const { ctx, missionId } = await setup();
    const results = await Promise.all([createOverlay(ctx, { missionId, name: 'Fires' }), createOverlay(ctx, { missionId, name: 'fires' })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await firstValueFrom(observeMissionOverlays(ctx.db, missionId))).toHaveLength(1);
  });

  it('lists the overlays A to Z whatever order they were made in, ignoring case, with numbers by value', async () => {
    const { ctx, missionId, overlay } = await setup();
    for (const name of ['Phase 10', 'fires', 'Phase 2', 'Enemy COA 1']) await overlay(name);
    const list = await firstValueFrom(observeMissionOverlays(ctx.db, missionId));
    expect(list.map((o) => o.name)).toEqual(['Enemy COA 1', 'fires', 'Phase 2', 'Phase 10']);
  });

  it('needs a name of 1 to 32 characters, trimmed', async () => {
    const { ctx, missionId, overlay } = await setup();
    expect((await createOverlay(ctx, { missionId, name: '   ' })).ok).toBe(false);
    expect((await createOverlay(ctx, { missionId, name: 'x'.repeat(MAX_OVERLAY_NAME + 1) })).ok).toBe(false);
    const id = await overlay('  Fires  ');
    expect((await renameOverlay(ctx, id, ' Phase 3 ')).ok).toBe(true);
    expect((await firstValueFrom(observeMissionOverlays(ctx.db, missionId)))[0].name).toBe('Phase 3');
  });

  it('shows base items (in no overlay) whatever overlays are hidden', async () => {
    const { ctx, item, overlay, overlayHidden } = await setup();
    await item('BASE');
    const p1 = await overlay('Phase 1');
    await setOverlayHidden(ctx, p1, true);
    expect(await overlayHidden()).toEqual([]);
  });

  it('hides the base (items in no overlay) while Base is hidden, leaving items in a shown overlay', async () => {
    const { ctx, missionId, item, overlay, link, overlayHidden } = await setup();
    const base = await item('BASE');
    const phase = await item('PL ONE');
    const p1 = await overlay('Phase 1');
    await link(phase, p1);
    expect(await firstValueFrom(observeBaseHidden(ctx.db, missionId))).toBe(false);
    await setBaseHidden(ctx, missionId, true);
    expect(await firstValueFrom(observeBaseHidden(ctx.db, missionId))).toBe(true);
    expect(await overlayHidden()).toEqual([base]);
    await setBaseHidden(ctx, missionId, false);
    expect(await overlayHidden()).toEqual([]);
  });

  it('hides and shows every overlay at once, Base too, whether or not each was toggled before', async () => {
    const { ctx, missionId, item, overlay, link, overlayHidden } = await setup();
    const base = await item('BASE');
    const unit = await item('HOS-1');
    const p1 = await overlay('Phase 1');
    await overlay('Phase 2');
    await link(unit, p1);
    await setOverlayHidden(ctx, p1, false);
    await setAllOverlaysHidden(ctx, missionId, true);
    expect((await firstValueFrom(observeMissionOverlays(ctx.db, missionId))).map((o) => o.hidden)).toEqual([true, true]);
    expect(await overlayHidden()).toEqual([base, unit].sort());
    await setAllOverlaysHidden(ctx, missionId, false);
    expect(await overlayHidden()).toEqual([]);
    expect(await firstValueFrom(observeBaseHidden(ctx.db, missionId))).toBe(false);
  });

  it('moves an item back to Base by taking it out of every overlay', async () => {
    const { ctx, item, overlay, link } = await setup();
    const unit = await item('HOS-1');
    await link(unit, await overlay('Phase 1'));
    await link(unit, await overlay('Phase 2'));
    await moveItemToBase(ctx, unit);
    expect(await firstValueFrom(observeItemOverlayIds(ctx.db, unit))).toEqual([]);
  });

  it('hides an item once every overlay it is in is hidden, and shows it while any is shown', async () => {
    const { ctx, item, overlay, link, overlayHidden } = await setup();
    const line = await item('PL ONE');
    const p1 = await overlay('Phase 1');
    const p2 = await overlay('Phase 2');
    await link(line, p1);
    await link(line, p2);
    await setOverlayHidden(ctx, p1, true);
    expect(await overlayHidden()).toEqual([]);
    await setOverlayHidden(ctx, p2, true);
    expect(await overlayHidden()).toEqual([line]);
    await setOverlayHidden(ctx, p1, false);
    expect(await overlayHidden()).toEqual([]);
  });

  it('adds and removes an item from an overlay, once each way', async () => {
    const { ctx, item, overlay, link } = await setup();
    const unit = await item('HOS-1');
    const p1 = await overlay('Phase 1');
    await link(unit, p1);
    await link(unit, p1);
    expect(await firstValueFrom(observeItemOverlayIds(ctx.db, unit))).toEqual([p1]);
    await link(unit, p1, false);
    expect(await firstValueFrom(observeItemOverlayIds(ctx.db, unit))).toEqual([]);
  });

  it('leaves out of the map both items hidden one by one and items the overlays hide', async () => {
    const { ctx, missionId, item, overlay, link } = await setup();
    const a = await item('A');
    const b = await item('B');
    await item('C');
    const p1 = await overlay('Phase 1');
    await link(b, p1);
    await setOverlayHidden(ctx, p1, true);
    await setItemHidden(ctx, a, true);
    expect([...(await firstValueFrom(observeMapHiddenItemIds(ctx.db, missionId)))].sort()).toEqual([a, b].sort());
  });

  it('deleting an overlay keeps its items, back in the base unless in another', async () => {
    const { ctx, missionId, item, overlay, link, overlayHidden } = await setup();
    const unit = await item('HOS-1');
    const p1 = await overlay('Phase 1');
    await link(unit, p1);
    await setOverlayHidden(ctx, p1, true);
    expect(await overlayHidden()).toEqual([unit]);
    await deleteOverlay(ctx, p1);
    expect(await overlayHidden()).toEqual([]);
    expect(await firstValueFrom(observeItemOverlayIds(ctx.db, unit))).toEqual([]);
    expect(await firstValueFrom(observeMissionOverlays(ctx.db, missionId))).toEqual([]);
  });

  it('forgets an item\'s overlays when it is deleted, and a mission\'s overlays with the mission', async () => {
    const { ctx, missionId, item, overlay, link } = await setup();
    const unit = await item('HOS-1');
    const p1 = await overlay('Phase 1');
    await link(unit, p1);
    await deleteItem(ctx, unit);
    expect(await ctx.db.getAll('SELECT id FROM map_item_overlays')).toEqual([]);
    await deleteMission(ctx, missionId);
    expect(await ctx.db.getAll('SELECT id FROM overlays')).toEqual([]);
  });
});
