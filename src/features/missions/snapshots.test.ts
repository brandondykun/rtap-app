import { ImageManipulator } from 'expo-image-manipulator';

import { makeTestContext } from '@/lib/db/test-database';

import { createMission, deleteMission, markMissionOpened } from './commands';
import { findMissionViewState, parseSnapshot } from './repository';
import { deleteMissionSnapshot, snapshotFile } from './snapshot-files';
import { saveMissionSnapshot } from './snapshots';

const fs = jest.requireMock('expo-file-system') as { __files: Set<string> };
const manip = jest.requireMock('expo-image-manipulator') as {
  __source: { width: number; height: number };
  __last: { crop?: unknown; resize?: unknown; save?: unknown };
};

beforeEach(() => {
  fs.__files.clear();
  manip.__last.crop = undefined;
  manip.__last.resize = undefined;
  Object.assign(manip.__source, { width: 1170, height: 2532 });
});

async function opened() {
  const ctx = makeTestContext();
  const m = await createMission(ctx, { name: 'Op Iron' });
  if (!m.ok) throw new Error('setup');
  await markMissionOpened(ctx, m.value.id);
  return { ctx, id: m.value.id };
}

describe('saveMissionSnapshot', () => {
  it('downscales to a 720 px JPEG, stores it per mission and records it on the view state', async () => {
    const { ctx, id } = await opened();
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png');
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///cache/snap.png');
    expect(manip.__last.resize).toEqual({ width: 720, height: null });
    expect(manip.__last.save).toEqual({ format: 'jpeg', compress: 0.7 });
    const uri = 'file:///docs/mission-snapshots/' + id + '.jpg';
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.uri).toBe(uri);
    expect(Number.isFinite(result.value.takenAt)).toBe(true);
    expect(fs.__files.has(uri)).toBe(true);
    const state = await findMissionViewState(ctx.db, id);
    expect(parseSnapshot(state?.snapshot ?? null)).toEqual(result.value);
  });

  it('keeps only the map left uncovered by an open drawer, at any screen size', async () => {
    const { ctx, id } = await opened();
    // Landscape 3x phone: 844 x 390 pt map with a 360 pt drawer on the left.
    Object.assign(manip.__source, { width: 2532, height: 1170 });
    await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png', { view: { width: 844, height: 390 }, panel: { side: 'left', size: 360 } });
    expect(manip.__last.crop).toEqual({ originX: 1080, originY: 0, width: 1452, height: 1170 });
    expect(manip.__last.resize).toEqual({ width: 720, height: null });
    // Landscape 2x tablet: 1366 x 1024 pt map with a 400 pt drawer.
    Object.assign(manip.__source, { width: 2732, height: 2048 });
    await saveMissionSnapshot(ctx, id, 'file:///cache/snap2.png', { view: { width: 1366, height: 1024 }, panel: { side: 'left', size: 400 } });
    expect(manip.__last.crop).toEqual({ originX: 800, originY: 0, width: 1932, height: 2048 });
  });

  it('keeps only the map above an open bottom sheet', async () => {
    const { ctx, id } = await opened();
    await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png', { view: { width: 390, height: 844 }, panel: { side: 'bottom', size: 300 } });
    expect(manip.__last.crop).toEqual({ originX: 0, originY: 0, width: 1170, height: 1632 });
  });

  it('never enlarges a small visible part', async () => {
    const { ctx, id } = await opened();
    // 2x phone, drawer covers 60%: 534 px left, under the 720 px target.
    Object.assign(manip.__source, { width: 1334, height: 750 });
    await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png', { view: { width: 667, height: 375 }, panel: { side: 'left', size: 400 } });
    expect(manip.__last.resize).toEqual({ width: 534, height: null });
  });

  it('keeps the previous picture when a panel covers almost all of the map', async () => {
    const { ctx, id } = await opened();
    await saveMissionSnapshot(ctx, id, 'file:///cache/first.png');
    const before = await findMissionViewState(ctx.db, id);
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png', { view: { width: 390, height: 844 }, panel: { side: 'bottom', size: 800 } });
    expect(result).toMatchObject({ ok: false, error: 'covered' });
    expect((await findMissionViewState(ctx.db, id))?.snapshot).toBe(before?.snapshot);
    expect(fs.__files.has('file:///cache/snap.png')).toBe(false);
  });

  it('overwrites the previous picture at the same path', async () => {
    const { ctx, id } = await opened();
    await saveMissionSnapshot(ctx, id, 'file:///cache/a.png');
    await saveMissionSnapshot(ctx, id, 'file:///cache/b.png');
    expect([...fs.__files].filter((f) => f.includes('mission-snapshots'))).toEqual([snapshotFile(id).uri]);
  });

  it('does not write for a deleted mission', async () => {
    const { ctx, id } = await opened();
    await deleteMission(ctx, id);
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png');
    expect(result.ok).toBe(false);
    expect(fs.__files.has(snapshotFile(id).uri)).toBe(false);
    expect(await findMissionViewState(ctx.db, id)).toBeNull();
  });

  it('deletes the captured image when the mission is already gone', async () => {
    const { ctx, id } = await opened();
    await deleteMission(ctx, id);
    fs.__files.add('file:///cache/snap.png');
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png');
    expect(result).toMatchObject({ ok: false, error: 'not_found' });
    expect(fs.__files.has('file:///cache/snap.png')).toBe(false);
  });

  it('leaves no view state or file when the mission is deleted while the picture is processed', async () => {
    const { ctx, id } = await opened();
    const manipulate = ImageManipulator.manipulate as jest.Mock;
    const real = manipulate.getMockImplementation() as (uri: string) => { renderAsync: () => Promise<unknown> };
    manipulate.mockImplementationOnce((uri: string) => {
      const context = real(uri);
      const render = context.renderAsync;
      // Deleted after the first guard, before the picture is moved and recorded.
      context.renderAsync = async () => {
        await deleteMission(ctx, id);
        return render();
      };
      return context;
    });
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png');
    expect(result).toMatchObject({ ok: false, error: 'not_found' });
    expect(await findMissionViewState(ctx.db, id)).toBeNull();
    expect([...fs.__files]).toEqual([]);
  });

  it('reports a failure without throwing', async () => {
    const { ctx, id } = await opened();
    (ImageManipulator.manipulate as jest.Mock).mockImplementationOnce(() => {
      throw new Error('decode failed');
    });
    const result = await saveMissionSnapshot(ctx, id, 'file:///cache/bad.png');
    expect(result).toMatchObject({ ok: false, error: 'write_failed' });
  });
});

describe('deleting', () => {
  it('deleteMission removes the picture file; deleting a missing file is fine', async () => {
    const { ctx, id } = await opened();
    await saveMissionSnapshot(ctx, id, 'file:///cache/snap.png');
    await deleteMission(ctx, id);
    expect(fs.__files.has(snapshotFile(id).uri)).toBe(false);
    expect(() => deleteMissionSnapshot('nope')).not.toThrow();
  });
});
